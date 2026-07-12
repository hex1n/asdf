---
name: plan-review
description: >
  Review a completed design or plan through independent reviewers until the
  exact final revision passes. Enter only on an explicit review ask against one
  existing plan: 审查到通过, 方案评审, 计划评审, 证伪/多视角审查现有方案,
  收敛到无问题, 出完方案后让第二模型或子代理复审, or a plan review loop before
  implementation; a plan merely being finished is not an ask. For choosing
  among competing options or an unresolved decision (收敛方案, 方案选型,
  多方案对比/证伪), use first-principles-planner. Review depth follows the
  plan's risk; prefer a read-only second model, fall back to a fresh-context
  subagent, and never treat an unavailable reviewer or exhausted budget as a
  pass.
---

# Plan Review

Turn a completed plan into a reviewed revision. Revise the plan artifact only;
implementation remains outside this skill.

## Gate Contract

Define these before the first review:

- **Candidate**: the exact plan text or file to review.
- **Revision**: a content hash when file-backed; otherwise a stable round id and
  an exact copy of the chat artifact.
- **Required reviewers**: reviewers explicitly named by the user; otherwise set
  by the depth calibration below.
- **Rubric and evidence scope**: coherence, feasibility, compatibility,
  migration/rollback, verification, and scope, plus the authority sources needed
  to verify claims about an existing system. Add domain-specific criteria only
  when they decide correctness.
- **Depth**: calibrate reviewer strength and expected rounds to the plan's
  irreversibility and blast radius, and record that basis here at freeze time.
  Shallow depth — one fresh-context subagent round, never less — is eligible
  only when the plan is reversible and touches no data-destruction,
  external-interface, permission, or funds path; every other plan takes full
  depth, the strongest available independent reviewer. A self-reread satisfies
  no depth. When eligibility is uncertain or contested, use full depth.
  Calibration sets depth only — the pass condition below is identical at every
  depth.
- **Budget**: user-supplied when present. Without one, keep iterating while
  findings materially change; a round count alone never closes or suspends the
  gate.
- **Ledger**: stable finding IDs, parent validation records, dispositions,
  reviewer invocations, one round receipt per attempted invocation, and one
  disclosed finding manifest per returned reviewer verdict.

Use this pass condition:

```text
all required reviewers returned GO on the same current revision
and open blockers = 0
and open should-fix findings = 0
and unvalidated findings = 0
and every optional finding has a recorded disposition
and active reviewer invocations = 0
and no material change happened after those reviews
```

A rejected finding is closed only after the reviewer sees the evidence and
accepts the rejection. An accepted residual risk closes an optional finding,
not a blocker or should-fix.

## 1. Freeze A Compact Candidate

Take an existing plan as input. If no plan exists, route to the relevant
planner, finish that plan, then return here. Treat invocation as authority to
revise only the named plan artifact; for a chat-only plan, revise in chat.

Record the revision, required reviewers, rubric and evidence scope, depth
calibration, budget, and ledger. For a long chat-only candidate, use a temporary
file when authorized and give reviewers its path and hash instead of repeatedly
copying the plan or parent transcript. Use
[REFERENCE.md](REFERENCE.md#compact-review-packet) when file-backed transfer or
repository disclosure needs runtime-specific handling.

Keep review records outside the candidate. Appending a review log, translating,
or materially reformatting after GO creates a new hash: mark the result
`derived-unreviewed` or reopen the gate. An exact byte-for-byte copy may inherit
the reviewed hash.

Completion criterion: one exact candidate revision and its gate contract are
available to every reviewer.

## 2. Dispatch Independent Review

Dispatch the strongest required reviewer first, selected by the contract's depth
calibration:

1. A read-only second model when available — required at full depth.
2. A fresh-context read-only subagent at shallow depth, or as recorded fallback
   when the second model is unavailable.
3. Both when the user requires both or names multiple reviewers.

The plan author is not an independent reviewer. A self-reread can prepare the
candidate but cannot satisfy the gate.

Bind reviewer selection to the current runtime using
[REFERENCE.md](REFERENCE.md#runtime-binding), recording the independence level
and every downgrade.

At full depth, an unavailable strongest reviewer permits at most one diagnostic
round by a local fallback. Then suspend rather than repeatedly pre-converge with
a reviewer that cannot close the gate.

Reviewer read-only means: return the verdict in-band; the reviewer must not
create, edit, or overwrite the candidate, a plan file, a review record, memory,
or a sidecar. Helper agents default to zero and do not count as required
reviewers; when a helper is justified, apply
[REFERENCE.md](REFERENCE.md#helper-agents).

Give a first-pass reviewer only the compact review packet: candidate, decision
constraints, rubric, and evidence scope. Do not include the intended answer,
suspected defects, or prior conclusions. Require stable finding IDs and this
response shape:

```text
revision: <id>
verdict: GO | CONDITIONAL-GO | NO-GO
blockers: [{id, claim, evidence, affected_section}]
should_fix: [{id, claim, evidence, affected_section}]
optional: [{id, claim, evidence, affected_section}]
verification_gap: [{id, claim, missing_check, affected_section}]
```

The first pass returns the complete set of currently known findings across every
rubric dimension. It does not stop merely because it already has enough evidence
for a non-GO verdict. Existing-system claims are checked against the evidence
scope or named as verification gaps.

Run reviewers read-only. When repository disclosure is not authorized, use a
fresh local subagent or suspend with the permission blocker; preserve the gate
instead of silently weakening it.

Completion criterion: the strongest available required reviewer returned one
valid exhaustive first-pass result, or an explicit availability/permission
failure and any allowed diagnostic fallback are recorded. Every required
reviewer is needed only for the complete final review.

## 3. Record The Round And Validate Every Finding

Immediately after every review round, record its runtime/model and token receipt
using [REFERENCE.md](REFERENCE.md#round-receipt), including failed or discarded
invocations. Missing telemetry is reported as unavailable, never zero.

Before parent validation, show the user the reviewer's complete verdict and
every finding with its stable ID, severity, claim, evidence, and affected
section or missing check. Never replace this round output with counts or a
summary; when it is too long for chat, archive the complete round report and
give the user its link before continuing.

Then the parent validates every finding independently against the candidate,
frozen rubric, and authority evidence:

```text
finding_id
parent_validation: confirmed | challenged | needs_evidence
parent_evidence_and_reason
```

Validate the whole round in one evidence pass. A `confirmed` finding proceeds to
adjudication. A challenged finding stays open until the reviewer accepts the
rebuttal. A `needs_evidence` finding stays open or becomes an explicit
verification gap; uncertainty is not rejection.

After validation, show one parent-validation result for every finding before
adjudication. Preserve the reviewer's original claim separately from the
parent's status, evidence, and reason so corrections do not silently rewrite
the review output.

Completion criterion: the complete reviewer output has been disclosed, and
every finding from the round has exactly one disclosed validation record backed
by concrete evidence or a named missing-evidence check.

## 4. Adjudicate And Revise In Batches

Create one disposition for every finding:

- **fix**: accept it and revise the candidate;
- **rebut**: attach concrete evidence and return it to the reviewer;
- **accept-risk**: use only for optional findings, naming the residual risk;
- **defer-gap**: use only for a verification gap outside the current plan's
  closing scope, naming its owner and next check;
- **needs-input**: identify the missing decision or evidence.

Evidence outranks reviewer authority. Apply valid findings; rebut false or
out-of-scope findings rather than mechanically expanding the plan. A material
edit creates a new revision and invalidates every prior GO.

Apply compatible fixes together. For edits contained by finding-linked scope that meet every rule in
[REFERENCE.md](REFERENCE.md#focused-recheck), a focused recheck may close findings
but cannot close the gate. Any uncertainty or cross-cutting change requires a
complete review.

Completion criterion: every finding has a validation, owner, and disposition;
either a new candidate revision exists or the reviewer has received evidence for
each rebuttal.

## 5. Re-review The Complete Final Revision

After all known findings are dispositioned, send the complete revised candidate,
its new revision id, the full validation/disposition ledger, evidence scope, and
rubric to the same required reviewers. The final GO must cover the complete
current revision; focused or delta review is never a closing verdict.

Return to adjudication when a reviewer reports a blocker, should-fix, disputed
rebuttal, or new optional finding. Record and validate every new finding before
claiming closure.

Completion criterion: every required reviewer returned GO on the complete same
revision, every finding from that round was validated and dispositioned, and no
required disposition remains open.

## 6. Close Or Suspend The Gate

Before reporting success, re-evaluate the Gate Contract mechanically. The
bundled `scripts/check-gate-state.mjs` can check a JSON state when Node is
available; otherwise apply the same predicate directly. Report:

- final revision id and artifact location;
- reviewers and independence level;
- rounds used;
- findings fixed, rebutted, and accepted as optional risk;
- each round's runtime, provider, model, effort, token categories, helpers, raw
  total, and usage precision;
- verification gaps that remain outside the plan's scope.

For a durable audit record, write a sidecar review record only after GO; keep the
reviewed plan unchanged. A sidecar is evidence, not part of the reviewed
revision.

The gate suspends rather than passes when an explicit budget expires, a required
reviewer remains unavailable after recovery, required reviewers disagree, the
same blocker survives three consecutive revisions, or a finding needs a user
decision. New or narrowing findings are progress and continue the loop when no
explicit budget exists. Preserve the last revision, open findings, and the exact
next action. A resumed run keeps the same gate contract unless the user changes
it.

Completion criterion: the gate is either passed by the exact contract above or
suspended with an evidence-backed continuation state; there is no approximate
pass.

## Failure Recovery

- Apply the recover-before-retry protocol in
  [REFERENCE.md](REFERENCE.md#recover-before-retry). Unknown invocation state
  suspends the lane; it does not authorize a duplicate reviewer.
- Record the reviewer downgrade when using a subagent instead of a requested
  second model.
- Treat a repeated equivalent blocker across three consecutive rounds as
  `needs_input`; additional paraphrases are not progress.
- Restart all required reviews when a late material edit changes the passed
  revision.
