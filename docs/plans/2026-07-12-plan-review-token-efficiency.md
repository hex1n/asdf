# Plan Review Token-Efficiency Improvement Plan

Status: implemented; validated; installed runtime copies synced  
Date: 2026-07-12  
Target: `skills/plan-review/`

## TL;DR

Rework `plan-review` from “fully review every intermediate revision” into a
staged gate:

```text
exhaustive initial review
-> parent validation of every finding
-> batch adjudication and fixes
-> scope-bounded focused rechecks
-> one complete final-revision review by every required reviewer
```

The final pass condition remains unchanged. Savings come from reducing repeated
full-candidate transmission, reviewer fan-out, duplicated evidence gathering,
and failed-invocation replay—not from weakening the final review.

## Desired Outcome

Minimize inference cost per trustworthy reviewed plan while preserving:

- independent review at the risk-calibrated depth;
- independent parent validation of every reviewer finding before adjudication;
- a complete final-revision GO from every required reviewer;
- zero open blockers and should-fix findings;
- an explicit disposition for every optional finding;
- invalidation of stale GO verdicts after material changes;
- honest suspension when reviewers, permissions, or budgets block completion.

## Root Problem

The dominant cost is multiplicative:

```text
review cost ~= complete candidate size
             * complete-review count
             * reviewer/helper fan-out
             * failure/retry multiplier
```

The skill body itself is not the main cost. The observed expensive run combined
six candidate revisions, repeated complete reviews, recursive exploration
agents, and a whole-invocation retry after timeout.

## Evidence From the Observed Run

The 2026-07-12 cost-assurance-plan review chain showed:

- a Codex reviewer re-read five complete candidate revisions;
- the required second model entered only after those five rounds and then found
  implementation-grounded blockers the earlier reviewer had missed;
- two Claude invocations received byte-identical initial candidates;
- each Claude invocation created three exploration agents while the parent also
  performed direct source inspection;
- the failed Claude invocation and descendants consumed about 7.2 million raw
  usage units before a fresh retry consumed about 12.3 million more;
- the final Claude result introduced one new optional polish item, while the
  parent reported only the three previously dispositioned optionals and declared
  the gate passed;
- the reviewed English artifact was later translated, producing a different
  hash and therefore a derived, not exact-reviewed, artifact.

Raw usage includes cached and cache-creation input and is not equivalent to
billed tokens. It is still a valid signal of repeated context processing.

## Redesign Pre-registration And Baseline

This document was written before the candidate skill implementation. Its fixed
definition of better is: preserve the exact final-revision gate and finding
quality while reducing complete-review count, helper fan-out, duplicate retries,
and raw reviewer usage. The discriminating probes are the high-risk and low-risk
samples under Validation Plan, with false-pass states exercised by the mechanical
checker.

Baseline evidence:

- baseline source: the installed pre-change `plan-review` skill, SHA-256
  `1ff4ac6d6783278071218d769d28cda196b7e43e328f1b035ea2c68983b8d4aa`;
- high-risk baseline session: Codex parent
  `019f5524-eec8-7162-b6df-5fcfd72d754e` and reviewer
  `019f5535-7639-79c3-88de-28d337772670` from 2026-07-12;
- baseline failure signals: five complete Codex re-reviews before the required
  second model, a discarded external-review attempt with descendants, a new
  optional omitted from final disposition accounting, and a post-GO translated
  artifact with a different hash;
- baseline positive control: the parent correctly refused a reviewer result that
  said GO while retaining should-fix findings.

Candidate evidence is recorded in temporary artifacts outside the skill folder
and summarized in the Validation Plan as the evolution round proceeds.

## Constraint Split

### True constraints

- Every required reviewer must return GO on the same complete final revision.
- A material candidate change invalidates prior GO verdicts.
- Blockers and should-fix findings cannot close through risk acceptance.
- A reviewer finding cannot drive a revision until the parent has checked whether
  its claim and severity are supported by evidence.
- Every optional finding needs a recorded disposition.
- Reviewers must be independent, read-only, and sufficiently grounded.
- Reviewer unavailability, permission failure, and explicit budget exhaustion
  suspend the gate; none is a pass condition.

### Changeable conventions

- Fully reviewing every intermediate revision.
- Running several fallback rounds before the required strongest reviewer enters.
- Passing long chat candidates by value on every round instead of by path and
  content hash.
- Allowing reviewers to recursively create unbounded helper agents.
- Retrying a timed-out invocation before recovering its session and descendants.
- Tracking findings and dispositions as unkeyed natural-language arrays.

### Load-bearing assumptions to verify

- Scope-bounded focused rechecks retain safety when followed by a complete final
  review.
- An exhaustive initial finding inventory reduces serial “one more issue” rounds.
- Available second-model connectors can read a file-backed candidate or an
  equivalent compact review packet.
- Invocation handles and session artifacts are sufficient to recover or cancel a
  timed-out reviewer before retry.

## Selected Mechanism: Staged Review Gate

### 1. Freeze a review contract

Record before dispatch:

```text
candidate_path
candidate_hash
risk_and_depth
required_reviewers
evidence_scope
rubric
explicit_budget
soft_cost_forecast
```

Materialize a long chat-only candidate once in a temporary review artifact when
the runtime permits it. Pass `path + hash + constraints + rubric + evidence
scope`, not the parent transcript or repeated candidate copies.

### 2. Dispatch the strongest required reviewer first

At full depth, use the required second model for the first authoritative review.
If it is unavailable, a local fallback may perform one diagnostic round, but the
workflow must then suspend rather than repeatedly pre-converge with a reviewer
that cannot close the gate.

At shallow depth, start with one fresh-context reviewer independent from the
author. Reuse that reviewer identity for rechecks where the runtime preserves
independence and saves cached context.

### 3. Require an exhaustive first-pass inventory

The first-pass completion criterion is:

> Every rubric dimension has been checked and the reviewer has returned the
> complete set of currently known blockers, should-fix findings, optional
> findings, and verification gaps. The reviewer does not stop merely because it
> already has enough evidence for a non-GO verdict.

Assign stable IDs:

```text
B-001  blocker
S-001  should-fix
O-001  optional
V-001  verification gap
```

### 4. Parent validates every finding

Before adjudication, the parent agent independently validates every finding from
the completed reviewer round. A reviewer proposes findings; it does not make its
own claims automatically true.

Use one validation record per finding:

```text
finding_id
reviewer_claim
reviewer_evidence
affected_section
severity
parent_validation = confirmed | challenged | needs_evidence
parent_evidence_and_reason
```

Validation rules:

- **confirmed**: the cited evidence supports the finding and its severity;
- **challenged**: concrete candidate or source evidence contradicts the finding,
  shows it is duplicate, or places it outside the frozen rubric and scope;
- **needs_evidence**: available evidence cannot yet establish whether the finding
  is valid.

The parent validates against the candidate, frozen rubric, and authority sources,
not against author preference. Validate the whole round's finding set in one
evidence pass so this step does not become one extra full review per finding.

A challenged finding remains open until its rebuttal is returned to the reviewer
and the reviewer accepts the rebuttal. A `needs_evidence` finding remains open or
becomes an explicit verification gap; uncertainty is never silently interpreted
as rejection.

Completion criterion: every finding emitted in the round has exactly one parent
validation record with concrete evidence or a named missing-evidence check.

### 5. Batch adjudication and fixes

Maintain a separate disposition ledger:

```text
finding_id -> fix | rebut | accept-risk | defer-gap | needs-input
```

Add `defer-gap` only for a confirmed verification gap outside the current closing
scope, with an owner and next check. Only confirmed findings proceed to `fix`,
`accept-risk`, `defer-gap`, or `needs-input`.
`accept-risk` remains legal only for optional findings. A challenged finding uses
`rebut`, and closes only after the reviewer accepts its evidence. Apply all
compatible fixes in one candidate revision instead of serially revising after
each finding.

### 6. Use scope-bounded focused rechecks between full reviews

A focused recheck may close findings but may not close the gate. It is eligible
only when all of these hold:

- changed sections or paths are contained by finding-linked scope;
- goal, constraints, rubric, risk, dependencies, permissions, and public
  interfaces are unchanged;
- the request includes before/after hashes and a cross-impact statement;
- the reviewer confirms that the change did not escape the declared scope.

Any uncertainty or cross-cutting change promotes the round to a complete review.

### 7. Require one complete final review

After all known findings are dispositioned, send every required reviewer:

- the complete current candidate;
- its current content hash;
- the complete disposition ledger;
- the frozen evidence scope and rubric.

Only a GO covering that complete revision can close the gate. A new finding in
the final review reopens adjudication, including a newly introduced optional.

### 8. Evaluate closure mechanically

The close check must establish:

```text
reviewed_hash == current_candidate_hash
required_reviewer_go_hashes == {current_candidate_hash}
open_blockers == []
open_should_fix == []
unvalidated_finding_ids == []
optional_ids - disposition_ids == []
active_reviewer_invocations == []
material_change_after_go == false
```

Natural-language verdict interpretation is not sufficient for these invariants.

### 9. Recover before retry

Every external reviewer invocation should have a persistent handle. On timeout:

1. query invocation and session state;
2. recover any available transcript or result;
3. wait for or cancel descendants;
4. prove that no invocation for the same `revision + reviewer` remains active;
5. start the single permitted fresh retry only when no result is recoverable.

Timeout with unknown state suspends the reviewer lane; it does not authorize an
immediate duplicate invocation.

### 10. Bound reviewer fan-out and writes

Reviewer read-only means returning the verdict in-band without creating,
editing, or overwriting candidate files, plan files, review records, memory, or
sidecars. Only the adjudicating parent may mutate the candidate or write a
post-GO audit sidecar.

Helper agents:

- do not count as required reviewers;
- default to zero;
- require a pre-declared, non-overlapping evidence lane;
- must not repeat source inspection already owned by the parent reviewer.

### 11. Track review economics

Immediately after every reviewer round returns—and before the parent validates
its findings—emit a review-round receipt:

```text
round_id
invocation_id
revision_hash
review_kind = complete | focused | rebuttal-check
verdict
runtime
provider
model
effort
reviewer_session_id_or_opaque_handle
independence_level
model_calls
uncached_input_tokens
cache_read_input_tokens
cache_write_or_creation_tokens
output_tokens
reasoning_tokens
helper_agent_tokens
raw_total_tokens
usage_source
usage_precision = exact | derived | unavailable
usage_unavailable_reason
normalized_cost
```

Use the categories exposed by the runtime rather than collapsing everything into
one misleading total. `raw_total_tokens` is the sum of available physical
categories and is not labeled as billed usage. `normalized_cost` is reported only
when a versioned price source covers the exact provider/model categories;
otherwise report `unknown` with the missing input.

For cumulative runtime counters, snapshot usage immediately before and after the
round and report the non-negative delta. Never sum cumulative snapshots. Helper
agents receive separate child receipts and roll up once into
`helper_agent_tokens`; they are not hidden inside the parent total. A failed,
timed-out, cancelled, or discarded invocation still receives a receipt so retry
cost remains visible.

If a runtime exposes no reliable usage field, report `usage_precision:
unavailable` and the reason. Missing telemetry is not zero usage and is not a
review failure.

After each round, present the receipt with its findings:

| Round | Revision | Kind | Runtime / model | Verdict | Input | Cache read/write | Output | Helpers | Raw total | Precision |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| R1 | `{hash}` | complete | `{runtime} / {model}` | `{verdict}` | `{n}` | `{read}/{write}` | `{n}` | `{n}` | `{n}` | `{precision}` |

At suspension or close, aggregate the per-round receipts without re-reading raw
session logs and report complete-review count, focused-recheck count,
helper-agent count, failed/discarded cost, and totals by runtime/model.

Completion criterion: every completed or attempted reviewer invocation has
exactly one receipt, its model identity is recorded, and every unavailable usage
field names why it could not be measured.

This telemetry is informational and never relaxes the pass condition or turns a
reviewer failure into a pass.

## Alternatives Considered

### Full review after every revision

Strong but unnecessarily expensive. It remains appropriate when every edit is
cross-cutting, the plan is short, or focused-scope eligibility cannot be proven.

### Delta-only review

Cheap but unsafe as a closing mechanism because it can miss cross-section and
constraint interactions. It is acceptable only as an intermediate finding
closure step with a complete final review.

### Fixed review-round cap

Controls cost but can terminate before a trustworthy outcome. Explicit user
budgets may suspend the gate; a round count alone remains neither a pass nor a
suspension condition.

## Implementation Plan

| Priority | Change | Effort | Risk | Value |
|---|---|---:|---|---|
| P0 | Finding IDs, parent validation records, disposition ledger, mechanical close contract | 1.5 days | Medium | Prevent false findings and false passes |
| P0 | Recover-before-retry and single-active-invocation rule | 0.5 day | Low | Prevent whole-run duplication |
| P1 | Exhaustive first pass and focused-recheck eligibility | 0.5 day | Medium | Reduce complete review rounds |
| P1 | File-backed compact review packet | 0.5 day | Low | Reduce candidate replay |
| P1 | Operational read-only and helper fan-out bounds | 0.5 day | Low | Limit side effects and multiplication |
| P1 | Per-round model and token receipts with child roll-up | 0.5 day | Low | Make review cost attributable |
| P2 | Two-domain session replay evaluation | 1 day | Low | Falsify cost/quality claims |
| **Total** | | **5 days** | | |

Expected source changes:

- `skills/plan-review/SKILL.md`: core staged-gate steps and completion criteria;
- `skills/plan-review/REFERENCE.md`: timeout recovery, focused-scope examples,
  and runtime binding details;
- `skills/plan-review/tests/contract.test.mjs`: portable prose invariants;
- `skills/plan-review/scripts/check-gate-state.mjs` plus mandatory table-driven
  malformed-state, stale-revision, finding, receipt, and active-invocation tests.

## Validation Plan

Run the existing skill and the candidate on two divergent real samples:

1. A high-risk infrastructure or protocol plan with compatibility and rollback
   consequences.
2. A reversible, low-risk product or operating-process plan with a much smaller
   candidate and no external-interface change.

Acceptance requires:

- candidate finds at least the baseline's blockers and should-fix findings;
- final gate outcome is identical or stricter;
- every reviewer finding has a parent validation record, and every challenged
  finding is either reviewer-accepted as rebutted or remains visibly open;
- no optional finding lacks a disposition;
- every verification gap is either resolved or explicitly `defer-gap` with an
  owner and next check;
- every attempted review round reports its runtime/model and exact, derived, or
  explicitly unavailable token usage without double-counting cumulative counters;
- no duplicate active reviewer invocation occurs;
- the final artifact hash equals the reviewed hash;
- raw reviewer usage falls at least 50% on the high-risk sample;
- raw reviewer usage falls at least 30% on the low-risk sample.

When a reviewer runtime reports usage as unavailable, first derive the receipt
from local session counters with a recorded command and precision. If neither
direct nor derived usage is available, the quality result may pass but the
token-reduction acceptance claim remains provisional; unavailable telemetry is
never interpreted as meeting the percentage threshold.

Temporary comparison outputs belong outside the skill directory. Record the
evolution round using the repository's Skill Evolution Loop, and run independent
adversarial falsification because the change affects runtime behavior, tests,
and a high-stakes gate.

## Failure Conditions and Fallbacks

The staged gate is not better when:

- most intermediate changes are cross-cutting and therefore always promote to a
  complete review;
- parent validation merely echoes the reviewer, or rejects findings based on
  author preference rather than concrete evidence;
- focused rechecks cause materially more new findings to survive until the final
  review;
- a connector cannot consume file-backed candidates without repeatedly copying
  the full artifact;
- recovery handles cannot prove whether a timed-out reviewer is still active.

In those cases, retain complete review per revision for the affected branch,
while keeping structured findings, mechanical closure, write boundaries, and
recover-before-retry.

## Bestness Check

- **Fit criteria:** final-review trust, inference cost, recovery honesty,
  cross-runtime portability, and implementation complexity.
- **Winner:** staged review gate with focused intermediate closure and one complete
  final review.
- **Closest alternative:** complete review after every revision with an explicit
  user budget.
- **Defeat condition:** intermediate edits are routinely cross-cutting or focused
  rechecks demonstrably hide issues that the baseline reveals earlier.
- **Marginal-gain stop:** do not optimize a few hundred skill-body tokens or remove
  the complete final review until repeated full reviews, fan-out, and failed-run
  duplication have been eliminated.

## Validation Closeout

- `skills/plan-review/tests/gate-state.test.mjs` passes.
- `skills/plan-review/tests/contract.test.mjs` passes after aligning the runtime-binding assertions to the portable reference text.
- Installed runtime copies under `~/.agents/skills/plan-review` were resynced from source and now match byte-for-byte.
- The skill now emits per-round runtime, model, token categories, raw total, and usage precision through its documented receipt format.
