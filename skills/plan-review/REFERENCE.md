# Plan Review Reference

Load only the branch reached by the current review: entry states, compact
transfer, runtime/invocation handling, focused recheck, or round receipts.

## Decision Envelope And Entry States

The upstream planner freezes its worth-building decision in this envelope;
review consumes it unchanged and never recomputes value:

```yaml
decision: BUILD | DEFER | NO_BUILD | RESEARCH_FIRST
target_outcome:
baseline_and_frequency:
expected_benefit:
delivery_and_maintenance_cost:
status_quo_or_existing_mechanism:
decision_flip_condition:
review_scope: implementation-authorization | correctness-only
review_budget:
```

When no upstream envelope exists, the Entry Gate may freeze a minimal
user-owned envelope from an explicit user confirmation:
`decision: BUILD, source: user`. An explicit correctness-only ask sets
`review_scope: correctness-only`; its closing report carries
`implementation_decision: UNCHANGED` with an explicit "no implementation
authorization granted" line.

Non-entry and non-pass outcomes:

- `NOT_READY`: no upstream decision either way, no user confirmation, and no
  correctness-only ask; the loop was not entered.
- `DEFERRED`: the upstream decision is `DEFER`, `NO_BUILD`, or
  `RESEARCH_FIRST`; the loop was not entered and the value question stays
  with the planner.
- `WITHDRAWN`: implementation intent ended mid-review.
- `SUSPENDED`: the gate is unpassed and continuing is blocked or no longer
  justified — reviewer unavailable, budget expired, envelope invalidated, or
  user input required.

None of these outcomes is a technical pass, and none of them grants
implementation authorization.

Envelope invalidation is domain-independent: a required fix that turns a
three-day migration into a multi-week build with a permanent reconciliation
layer, and a required fix that turns a one-week process automation into a
cross-system integration project, both break the frozen
`delivery_and_maintenance_cost`; in both cases the review suspends and the
planner re-runs its Value Gate on the revised candidate.

## Compact Review Packet

For a long candidate, prefer one readable artifact over repeated prompt copies:

```text
candidate_path_or_exact_text
candidate_hash
decision_constraints
rubric
evidence_scope
review_kind
finding_ledger_when_rechecking
```

Use a temporary artifact for a chat-only plan only when the runtime permits the
parent to write it. The reviewer remains read-only. If a remote reviewer cannot
read a local path, send the exact candidate once in that reviewer session and
reuse the session for rechecks; do not send the parent transcript.

Repository disclosure is a separate permission decision. When it is not
authorized, use only supplied evidence or suspend the reviewer lane rather than
silently dropping evidence-dependent rubric criteria.

## Runtime And Invocation

Bind each reviewer class frozen by the Exact Gate without reselecting it:
`fresh-context` uses the runtime's read-only agent capability; `second-model`
uses the available read-only second-model capability. Resolve second-model
availability once, at freeze time, from what this runtime actually offers — not
from whether reaching for it feels expensive — and record the basis either way.
Record reviewer identity, independence level, disclosure boundary, and every
availability failure or diagnostic fallback.

Use a persistent invocation handle. Before retrying, query the invocation and
session, recover any result, settle descendants, and prove no invocation for the
same revision and reviewer remains active. Unknown state suspends the lane; it never
authorizes a duplicate invocation. Every retry gets a new handle and receipt.

## Helper Agents

Helpers do not count as required reviewers and default to zero. A helper requires
a pre-declared, non-overlapping evidence lane. Its lane must not repeat source
inspection already owned by the parent reviewer, and its output is evidence for
the parent—not an independent verdict. Include each helper's usage in the round
receipt exactly once.

## Focused Recheck

A focused recheck is an intermediate finding-closure mechanism. It never closes
the gate.

It is eligible only when all are true:

- changed sections or paths are contained by finding-linked scope;
- goal, decision constraints, rubric, risk, dependencies, permissions, and
  public interfaces are unchanged;
- the request supplies before/after hashes and a cross-impact statement;
- the reviewer confirms the edit did not escape the declared scope.

Uncertainty or a cross-cutting change promotes the round to a complete review.
For example, correcting one verification command can be focused when no other
claim depends on it; changing a shared compatibility assumption is complete
review work. The same rule fits a data-migration plan and a customer-onboarding
plan: locality is determined by dependency impact, not by domain vocabulary.

## Round Receipt

Immediately after every attempted review, before parent validation, record:

```text
round_id
invocation_id
revision_hash
review_kind: blocker-sweep | complete | focused | rebuttal-check
verdict
runtime
provider
model
effort
reviewer_session_id_or_opaque_handle
reviewer_role: required | diagnostic
independence_level: fresh-context | second-model
diagnostic_for_invocation_id: <failed second-model invocation; diagnostic only>
model_calls
input_characters
output_characters
wall_clock_ms
physical_sessions
retries
measurement_source
measurement_precision: exact | derived
```

Prefer runtime counters. Otherwise measure the exact submitted/returned text in
characters and elapsed wall-clock. Snapshot cumulative counters immediately
before and after the invocation and use the non-negative delta. A failed,
timed-out, cancelled, or discarded invocation still gets exactly one receipt.
The six observable fields are required; provider-only telemetry may be
unavailable but cannot erase caller-observable measurements. Provider token
categories may be attached when naturally available, but are optional and never
part of the gate.

Compact display:

| Round | Revision | Kind | Runtime / model | Verdict | Calls | In chars | Out chars | Wall ms | Sessions | Retries | Precision |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| R1 | `{hash}` | complete | `{runtime} / {model}` | `{verdict}` | `{n}` | `{n}` | `{n}` | `{n}` | `{n}` | `{n}` | `{precision}` |

## Gate-State Checker

The state uses `final_reviewer_verdicts` for exactly one authoritative closing
verdict per required reviewer on the current revision. Prior NO-GO, focused, and
rebuttal-check history lives in round receipts; it is not mixed into the closing
verdict set. `round_reports` contains exactly one manifest for every receipt that
returned `GO`, `CONDITIONAL-GO`, or `NO-GO`: invocation id, revision, verdict,
reviewer-returned `review_kind`, `reviewer_output_disclosed: true`, the complete finding-ID array, and complete
finding payloads (severity, claim, evidence, affected section, and missing check
when applicable). GO may use explicit empty arrays; NO-GO and CONDITIONAL-GO
require at least one finding. Every manifest payload maps to exactly one ledger finding;
every ledger finding maps back to its source manifest and records
`parent_validation_disclosed: true`. All collection fields are explicit arrays.
Malformed, missing, or unreconciled collections fail closed.

The gate state freezes `author_identity`, `review_depth: shallow | full`,
`explicit_second_model_reviewers` as an array of unique identities drawn from
`required_reviewers`, and `second_model_availability: {available, basis}`; the
author cannot be a required reviewer. A closing receipt for an identity inside
`explicit_second_model_reviewers` must record `reviewer_role: required` and
`independence_level: second-model`. Reviewing with a stronger independence lane
than frozen is an upgrade, never a gate failure.

Depth drives reviewer strength. A `full` depth gate may not close on
fresh-context reviewers alone unless `second_model_availability` records
`available: false`, a non-empty `basis`, and a `probe_invocation_id` naming an
attempted second-model invocation whose receipt is `FAILED` or `TIMED-OUT` —
the same evidence standard the diagnostic fallback already uses. Unavailability
is a traced fact, never a self-written sentence; without that trace an agent
avoiding an expensive second-model call would simply declare it, and full depth
would decay into shallow. Such a close is independence-limited and every report
says so. Claiming availability while closing same-model, and claiming
unavailability without a failed probe, both fail closed. Shallow is unaffected.

A diagnostic fallback keeps the frozen reviewer identity, records
`reviewer_role: diagnostic` and `independence_level: fresh-context`, and links
`diagnostic_for_invocation_id` to an earlier `FAILED` or `TIMED-OUT`
second-model receipt for that reviewer. At most one diagnostic is allowed per
frozen second-model reviewer, and its presence keeps the gate unpassed.

A `blocker-sweep` report contains only blocker and verification-gap payloads.
Each verification gap declares `gap_scope: decision_blocking |
outside_closing_scope` with an evidence-backed reason. Decision-blocking gaps
remain open; only outside-closing-scope gaps may use `defer-gap`.

The gate state freezes `required_rubric_dimensions`. Every `complete` report
includes `coverage.rubric_dimensions` matching that set and
`coverage.severities` containing blocker, should-fix, optional, and
verification-gap. Closing GO without this coverage evidence fails closed.

The gate state also freezes `resolved_budget`:
`{source: explicit | calibrated-default | user-authorized-unbounded, unit,
threshold, user_authorization}`. A bounded source requires a non-empty
observable unit and a positive safe-integer threshold;
`user-authorized-unbounded` requires `user_authorization: true`. A missing or
malformed budget fails closed.

When Node is available:

```sh
node scripts/check-gate-state.mjs review-state.json
```

The checker prints `{ "pass": boolean, "failures": [...] }` and exits zero only
for a pass. Its JSON fields mirror the Gate Contract. It is a mechanical guard,
not a substitute for parent finding validation or reviewer judgment.
