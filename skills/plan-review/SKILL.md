---
name: plan-review
description: >
  Review one completed design or plan through independent falsification until
  the exact final revision passes. Enter only on an explicit review ask against
  one existing design or plan: 审查到通过, 方案评审, 计划评审,
  证伪/多视角审查现有方案或计划, or a second-model review before
  implementation; a candidate merely being finished is not an ask. For competing
  options or an unresolved decision, use first-principles-planner.
---

# Plan Review

Falsify and revise one completed candidate — a design, a plan, or any artifact
that says what will be built and how. Revise only the named candidate;
implementation remains outside this skill.

## Entry Gate

Review verifies an upstream build decision; it never creates one. Before any
freeze, resolve what this review may authorize
([REFERENCE.md](REFERENCE.md#decision-envelope-and-entry-states)):

- The plan carries a Decision Envelope (or equivalent upstream decision
  record) whose decision is `BUILD`: review with
  `review_scope: implementation-authorization`. A review ask alone — even
  "review this before we implement" — never creates that decision; when no
  envelope exists, ask once whether worth-building has been decided, and only
  the user's explicit worth-building confirmation freezes a user-owned `BUILD`.
- The user explicitly asks for a correctness-only review — this takes
  precedence over any non-`BUILD` upstream decision: review with
  `review_scope: correctness-only`, and the report states that no
  implementation authorization is granted.
- The upstream decision is `DEFER`, `NO_BUILD`, or `RESEARCH_FIRST`, or the
  user says worth-building is unsettled: return `DEFERRED` without entering
  the review loop; the value question belongs to the planner, never to a
  reviewer. With no upstream decision either way and no confirmation, return
  `NOT_READY`.

Every closing report separates two tracks:

```text
technical_verdict: GO | NO_GO | SUSPENDED | NONE
implementation_decision: BUILD | DEFER | NO_BUILD | UNCHANGED
```

`GO` states only that the exact current revision passed complete review; it
carries no implementation priority or investment advice. `NONE` records that
no closing technical verdict exists: the loop was not entered (`NOT_READY`,
`DEFERRED`) or implementation intent ended (`WITHDRAWN`). The implementation
decision is copied from the still-valid frozen envelope; `UNCHANGED` means
this review granted and changed nothing — the standing upstream decision,
named in the report, still governs, and after envelope invalidation the
report also states that no valid `BUILD` authorization remains until the
planner re-decides. Both tracks always carry exactly one of their listed
tokens; prose may qualify a token, never replace it. A `DEFERRED`,
`WITHDRAWN`, or exhausted-budget outcome is never a technical pass.

## Exact Gate

Freeze before dispatch. Reviewer class follows depth: full depth requires a
read-only second-model reviewer whenever the runtime has one, because a
different model is a stronger falsifier for same-model blind spots; shallow
depth defaults to the runtime's fresh-context read-only reviewer. An explicit
user request for a second-model reviewer overrides the default at any depth.
When full depth has no second-model reviewer, attempt one and record the failed
probe and its basis at freeze time, then proceed fresh-context: unavailability
is a traced fact, never a self-written sentence, and that review is
independence-limited in its closing report. Freeze:

- the exact candidate and content hash;
- the Decision Envelope and review scope resolved by the Entry Gate;
- author identity; required reviewers, their frozen classes, explicit
  second-model selections, depth, and second-model availability with its basis;
- rubric, authority evidence, constraints, and the resolved budget;
- a ledger for rounds, findings, parent validations, and dispositions.

Budget resolves at freeze to exactly one of: the user's explicit budget, a
default calibrated from the same irreversibility, blast-radius, and value
basis as depth, or user-authorized `unbounded`. A bounded budget is recorded
with an observable unit and threshold — reviewer invocations, wall-clock, or
output volume — plus its basis; a missing budget never resolves to
`unbounded`, and `scripts/check-gate-state.mjs` fails closed without this
record.

Calibrate review depth and expected rounds from irreversibility and blast radius,
and record that basis here at freeze time. Shallow depth is eligible only when
the plan is reversible and has no data-destruction,
external-interface, permission, or funds path: at least one review round.
Otherwise use full depth. When eligibility is uncertain or
contested, use full depth. Depth changes who must review, never what counts as
a pass; the gate below is identical at every depth.

The gate passes only when:

```text
all required reviewers returned GO on the same current revision
and open blockers = 0
and open should-fix findings = 0
and unvalidated findings = 0
and every optional finding has a recorded disposition
and active reviewer invocations = 0
and no material change happened after those reviews
```

The default rubric covers coherence, feasibility, compatibility,
migration/rollback, verification, and scope. Add candidate-specific dimensions
whenever the candidate carries claims the default six do not reach — fidelity to
a source record it transcribes, completeness against an upstream inventory it
compiles — and freeze them with the rest; a claim no rubric dimension names is a
claim no reviewer is asked to attack. Existing-system claims require an authority
source or become verification gaps.

Severity is fixed by consequence, never by review cost: `blocker` — could make
the result unsafe, wrong, unexecutable, or unverifiable; `should-fix` —
materially changes execution behavior, compatibility, migration/rollback,
acceptance evidence, or a key decision; `optional` — wording, non-material
precision, readability, or convenience. When a confirmed blocker or should-fix
is no longer worth fixing, withdraw or suspend instead of closing.

## Evidence Loop

### 1. Freeze

Take an existing plan. If no plan exists, route to the relevant planner and
return after it is complete. Record the candidate hash and reviewers, then the
rubric and evidence scope, depth calibration, budget, and ledger. Freeze the
Decision Envelope beside the candidate; its decision, review scope, and budget
bind every later round.

Keep review records outside the candidate. A material edit creates a new
revision and invalidates every prior GO. A post-GO translation or reformat is
`derived-unreviewed` unless byte-identical.

For long or remote transfer, read
[REFERENCE.md](REFERENCE.md#compact-review-packet).

Completion: every reviewer can access the same exact revision and gate contract.

### 2. Review

Dispatch each required reviewer exactly as frozen by the Exact Gate. The author
is not an independent reviewer. For an unavailable frozen second-model
reviewer, one diagnostic fresh-context round is allowed; then suspend rather
than repeatedly pre-converge.

A self-reread may prepare the packet but cannot satisfy the gate.

The reviewer returns its verdict in-band and must not create, edit, or overwrite
the candidate or review records. Helper agents default to zero. Runtime binding,
helper limits, and retry recovery are in
[REFERENCE.md](REFERENCE.md#runtime-and-invocation).

Give a first-pass reviewer only the candidate, constraints, rubric, and evidence
scope. Run a **blocker sweep**: exhaustively identify independently actionable
blockers and verification gaps that prevent a correctness decision. Keep
should-fix and optional lanes deferred during this sweep; a finding that is
inseparable from a blocker stays inside that blocker. The sweep does not stop
after finding the first reason for NO-GO. Give every result a stable finding ID.
Compare failure and degradation contracts across the frozen evidence. Under the
same execution context, preconditions, policy scope, and authority priority, if
the same missing or invalid condition can produce incompatible outcomes such as
failure, partial success, or stale fallback, record one blocker until an
authority source selects the behavior.

Use one finding per independently actionable root cause. Merge downstream
symptoms that share the same evidence, owner, and remediation; list those
affected sections and consequences inside that finding. Split only when the
owner, remediation, or disposition can differ. Consolidate verification gaps by
missing authority source and next check. Exhaustive means every root cause is
represented, not every symptom is duplicated. A merged finding inherits the
highest severity of any consequence it contains; consolidation never lowers a
gate.

```text
revision: <hash>
review_kind: blocker-sweep | complete
verdict: GO | CONDITIONAL-GO | NO-GO
coverage: {rubric_dimensions: [...], severities: [...]}
blockers: [{id, claim, evidence, affected_section}]
should_fix: [{id, claim, evidence, affected_section}]
optional: [{id, claim, evidence, affected_section}]
verification_gap: [{id, claim, missing_check, affected_section,
                    gap_scope, gap_scope_reason}]
```

For a blocker sweep, coverage lists the inspected rubric dimensions and the two
active severities. A complete review lists every frozen rubric dimension and all
four severities. The parent copies these reviewer-returned fields into the round
report; it does not infer or upgrade coverage or gap scope.

When the blocker sweep returns no blocker or decision-blocking verification gap,
run a complete review on that same revision across every rubric dimension and
severity. Only a complete review may return the closing GO.

Completion: a valid exhaustive blocker-sweep result, a complete all-severity
result when the blocker lane is clear, or an explicit availability/permission
failure is recorded for the attempted invocation.

### 3. Disclose And Validate

Immediately after every attempted review, record one round receipt containing
the runtime/model and observable cost. Read
[REFERENCE.md](REFERENCE.md#round-receipt) for the compact schema. The six
caller-observable measurements are required; missing provider-only telemetry is
unavailable, never zero.

Before remediation, show the user the reviewer's complete verdict and every
finding: stable ID, severity, claim, evidence, affected section, and missing
check where applicable. Never replace this round output with counts or a
summary. If chat length is impractical, archive the complete report and link it
before continuing.

Then the parent validates every finding independently, validating the whole
round in one evidence pass against the frozen candidate, rubric, and authority
sources:

```text
finding_id
parent_validation: confirmed | challenged | needs_evidence
parent_evidence_and_reason
```

Show one parent-validation result for every finding. Preserve reviewer claims
separately. A challenged finding remains open until the reviewer accepts the
rebuttal; `needs_evidence` remains open or becomes a named verification gap.

Completion: every finding has exactly one disclosed validation record backed by
concrete evidence or a named missing-evidence check.

### 4. Adjudicate And Revise

Give every finding an owner and one disposition:

- `fix`: revise the candidate;
- `rebut`: return concrete contrary evidence to the reviewer;
- `accept-risk`: optional findings only;
- `defer-gap`: verification gaps outside closing scope, with owner and next check;
- `needs-input`: a missing user decision or authority source.

Batch compatible fixes. A focused recheck may close findings but cannot close
the gate. Use it only for edits contained by finding-linked scope; uncertainty
or cross-cutting change requires a complete review. See
[REFERENCE.md](REFERENCE.md#focused-recheck).

A revision that materially raises delivery or maintenance cost, shrinks the
expected benefit, changes the core mechanism or applicable scope, or breaks a
key assumption of the frozen Decision Envelope invalidates that envelope:
suspend the review and return the value decision to the planner rather than
reviewing the changed economics to GO.

Completion: every finding is validated, owned, and dispositioned; a new hashed
revision exists or every rebuttal has returned to its reviewer.

### 5. Close Or Continue

Send the complete revised candidate and ledger to every required reviewer. The
final GO must cover the complete current revision. Record, disclose, validate,
and disposition every new finding, then repeat. This closing review returns the
complete set of currently known findings across all severities, grouped by root cause; it
does not stop merely because a non-GO verdict is already justified.

Within the resolved budget, new or narrowing findings are progress and continue
the loop; a bare round count outside the frozen budget never closes or suspends
the gate — an expiring frozen budget is a budget event, not a round count. Each continued
round also requires live implementation intent and an expectation that the next
round closes a gate-blocking finding or changes the technical or implementation
decision. Suspend when a required reviewer remains unavailable, reviewers
disagree, the same blocker survives three consecutive revisions, budget
expires, the Decision Envelope is invalidated, or user input is required; when
continuing is no longer justified while the gate is unpassed, the outcome is
`SUSPENDED` or `WITHDRAWN`, never a pass.

Before success, apply the Exact Gate mechanically with
`scripts/check-gate-state.mjs` when Node is available. Report the two-track
outcome (technical verdict and implementation decision), the final revision,
reviewers and independence level, rounds, finding dispositions, remaining
verification gaps, and each round's model plus observable cost.

Restart all required reviews when a late material edit changes the passed
revision. There is no approximate pass.

Completion: the exact gate passes, or the review suspends with the last revision,
open findings, evidence limitation, and exact next action preserved.
