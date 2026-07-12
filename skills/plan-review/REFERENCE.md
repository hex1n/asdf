# Plan Review Reference

Load only the branch reached by the current review: compact transfer,
runtime/invocation handling, focused recheck, or round receipts.

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

Prefer an available read-only second-model capability. Otherwise use the
runtime's fresh-context read-only agent capability as the recorded fallback.
Record reviewer identity, independence level, disclosure boundary, and every
downgrade.

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
independence_level
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

A `blocker-sweep` report contains only blocker and verification-gap payloads.
Each verification gap declares `gap_scope: decision_blocking |
outside_closing_scope` with an evidence-backed reason. Decision-blocking gaps
remain open; only outside-closing-scope gaps may use `defer-gap`.

The gate state freezes `required_rubric_dimensions`. Every `complete` report
includes `coverage.rubric_dimensions` matching that set and
`coverage.severities` containing blocker, should-fix, optional, and
verification-gap. Closing GO without this coverage evidence fails closed.

When Node is available:

```sh
node scripts/check-gate-state.mjs review-state.json
```

The checker prints `{ "pass": boolean, "failures": [...] }` and exits zero only
for a pass. Its JSON fields mirror the Gate Contract. It is a mechanical guard,
not a substitute for parent finding validation or reviewer judgment.
