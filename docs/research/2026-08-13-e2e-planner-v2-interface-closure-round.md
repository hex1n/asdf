# e2e planner v2 interface-closure round (2026-08-13)

## Round 1

Supersedes: none (first round on the uncommitted `e2e-plan/v2` rework)
Improvement magnitude: clear
Generalization confidence: low (one repository, one paired-skill interface)
Hard gates: pass
High-stakes escalation: required — the edit changes routing/description text, changes script logic, and touches two skills. Pass 1 returned NO-GO (findings fixed); the recheck aborted on a runtime fault, so the accept is provisional. See below.
Relative delta: +5

Task sample:
- project: `asdf-skills`
- command: `node scripts/check-all.mjs`; `node skills/e2e-test-planner/scripts/validate-plan.mjs scripts/fixtures/e2e-plan-v2-valid.md`
- baseline artifact: uncommitted `e2e-plan/v2` rework at session start — gate green at 176 tests, but see failure modes below.
- candidate artifact: this working tree — gate green at 179 tests.
- validation artifact / diff: `git diff skills/ scripts/` plus the three new tests in `scripts/e2e-test-planner-render.test.mjs`.

## Observed failure modes in the baseline

All four were present in a *green* gate, which is why they are worth recording:

1. **Paired-skill contract break.** `e2e-test-executor` §1 parsed `Agent-ready Gates`, `Agent Execution Contract`, `Execution DAG`, `Executor Handoff Index`, `Execution Order`. `validate-plan.mjs` rejects any top-level section outside its nine, so none of those can legally exist in a v2 plan — the executor was told to look for sections the contract forbids.
2. **Routing regression.** The rework deleted the Chinese broad-testing triggers and the executor boundary pointer from the planner description, while `e2e-test-executor`'s description still routes those exact phrases *to* the planner. The symmetric routing landed by `1076837`/`0821a03` was left single-sided.
3. **Unguided required field.** `Plan mode: delta | full` is enum-validated (`validate-plan.mjs`), but no skill body, contract prose, or worker packet said how to choose it; the packet template omitted the field entirely.
4. **Structurally unreachable terminal state.** `SKILL.md` offered `Authorship isolation: unavailable` as a fallback, but the Closure Receipt demanded `Source audit: passed` with `auditor != Author context`. Verified empirically: that combination could never validate, so the documented fallback produced a permanently invalid artifact — and since auditor identity is only a string compare, the practical incentive was to invent a second ID.

## Candidate rules

- The executor reads v2's canonical records and **derives** the DAG, run order, and parallel safety; the plan persists records, not views.
- Delta narrows *ingress*, never record completeness.
- A single-context run closes as `self-audited` with `auditor=self` — an honest terminal state instead of a fabricated identity.

## Second-domain check (Generalization Gate)

The interface rule fits two divergent domains: a payments refund workflow and a firmware rollout workflow. In both, the plan carries per-scenario dependency, isolation, and side-effect facts, and any "execution order" table is a projection of those facts rather than an independent source of truth. Wording stays in contract-neutral terms (`records`, `derive`, `isolation key`) with no source-project identifiers.

## Wins

- The executor's needs are met by fields v2 already carries; no derived section was re-persisted, so v2's "records only" design survives intact.
- The interface is now mechanically protected: a new test fails if the executor names a retired section or drifts from the `SIDE_EFFECT_CLASSES` enum exported by the validator.
- The routing triggers are pinned by a test citing the mined fixture, so the next compression round cannot silently drop them.
- `self-audited` removes the incentive to fabricate an auditor identity while keeping `passed` strictly gated on a distinct auditor.

## Regressions

- Planner `SKILL.md` grew by three paragraphs (save path, plan mode, self-audit); it remains task-facing and under the 12 KB budget the suite asserts.
- Residual risk, accepted: an agent with delegation available could still declare `Authorship isolation: unavailable` to unlock `self-audited`. This is strictly better than the prior incentive — the dishonest path now requires downgrading a visible header field rather than inventing an identity that reads as independent audit.

## Verification

- `node scripts/check-all.mjs` — 179 pass / 0 fail; installed copies 33 byte-identical, 0 drifted.
- Fixture still validates; `render-plan-html.mjs` render and `--check` still bind byte-for-byte.
- Non-vacuity check: the three new guards were replayed against the pre-fix text and caught 6 violations (3 retired sections, v1 side-effect vocabulary, 2 missing v2 sections) plus all 6 missing routing triggers.
- Executor-intake check against `scripts/fixtures/e2e-plan-v2-valid.md`: every section and scenario field the new §1 names resolves *structurally*; the plan contains zero retired v1 sections. This proves the sections exist, not that their values are concrete enough to run — see the deferred gap.
- Post-falsification fixes re-verified: `passed` + `auditor=self` is now rejected while both legitimate audit states still validate; the unsafe parallel-safety mutation now fails 3 of the 4 scheduler assertions.
- Routing fixture (8 cases from `2026-07-17-e2e-routing-boundary-round.md`) replayed against the changed descriptions: all 8 route as expected. Author-side judgement — see the independent pass below.

## Weakest gate or lowest-confidence claim

That an executor agent reading only the new §1 can run a real v2 plan end to end. Verified structurally (every named section and field resolves against the valid fixture), not by an actual execution run against a live system.

## High-stakes escalation

Independent falsification via the local Codex CLI (`codex-cli 0.147.0`, read-only sandbox) — a different model, which AGENTS.md prefers over a same-model fresh context. Prompt and full transcript kept in the session scratchpad.

**Pass 1 verdict: NO-GO** — 3 blockers, 2 majors. The candidate's own test suite was green at 126/126 when this was returned, which is precisely the point of the escalation. Dispositions:

| # | Finding | Verified? | Disposition |
|---|---|---|---|
| 1 | `Source audit: passed` still accepted `auditor=self`, so `passed` could mean a self-audit | Yes — reproduced, returned `valid: true` | **fix** — validator now rejects `auditor=self` outside the `self-audited` state |
| 2 | The valid fixture is not runnable from the handoff alone (no concrete `V-001` values, no numeric wait window) | Yes — `Wait: ... within the source-defined test window`, `Given: source-backed fixture V-001` | **defer-gap** — pre-existing fixture/contract property, not introduced here; see below |
| 3 | Parallel safety not soundly derivable: v2 records no read set, so "neither mutates state the other reads" is unprovable | Yes — sound reasoning; the wording licensed unsafe parallelism | **fix** — derivation now defaults to serializing and names the records it compares |
| 4 | `self-audited` availability is self-attested | Yes | **accept-risk** — disclosed above; strictly better than the prior state, which was both structurally invalid and rewarded fabricating a second identity |
| 5 | New tests do not protect the claimed behavior | Partly | **fix** + **rebut** (below) |

Rebuttal on 5: the routing test's assertions also passing against `HEAD` is not a defect — `HEAD` is a good state, and the regression being guarded is the v2 rework's description, against which the guard fails on all six triggers. The valid half of the finding is that presence-only assertions cannot catch an *over-broad* description, so the test now also asserts both boundary clauses. The executor-test critique was fully valid: Codex defeated it with the mutation "different isolation keys are always parallel-safe", which passed every assertion. That mutation now fails 3 of 4.

## Deferred gap (out of this round's scope)

`scripts/fixtures/e2e-plan-v2-valid.md` satisfies the validator while leaving execution facts abstract — `Given` names `V-001` without concrete values, and both `Wait` fields say "within the source-defined test window" where no source defines a duration. The validator enforces reference integrity, not value concreteness, so a structurally valid plan can still be unrunnable. Owner: e2e planner contract. Next check: decide whether `Given`, `Wait`, and fixture values need concreteness rules (a numeric or source-cited window) or whether that stays a human-review property, then either tighten the contract or state the limit in `SKILL.md`.

**Pass 2 (focused recheck of fixes 1, 3, 5): ABORTED.** The Codex run died partway through on a Windows sandbox fault (`fs sandbox helper failed with status exit code: 0xc0000142`, then `exit -1073741502`), not on a review conclusion, so it returned no verdict. It had copied the repo to a scratch tree and begun mutation-testing the new guards; that scratch tree was moved out of the repository into the session scratchpad rather than deleted, so its mutations remain inspectable.

Before dying it produced one real finding, which was verified and fixed:

- **Major — the parallel-safety guard missed a semantic inversion.** Codex mutated `default to serializing` into `default to parallelizing` while leaving every safety word in place. All four assertions still passed, because `serialize it and say why` later in the same paragraph satisfied the `/serializ/i` check. The guard now pins the default phrase explicitly and asserts the unsafe default is absent; the inversion is rejected. This is the second time in this round that a vocabulary-shaped assertion proved weaker than it looked.

## Decision

**accept — provisional.**

The four baseline failure modes are fixed and mechanically guarded, and the gate is green at 179 pass / 0 fail with 33 installed copies byte-identical. But AGENTS.md does not let the author's own re-read close the escalation, and the recheck of the post-fix revision never completed. Concretely: pass 1's NO-GO findings were fixed *after* it ran, and no independent context has reviewed the current revision. Every defect found in this round was found by the independent pass, not by the author or the suite — so treating a green suite as sufficient here would repeat exactly the mistake the escalation exists to catch.

Next action to close: re-run the focused recheck (`scratchpad/recheck-prompt.txt`) in a working runtime, or have a second reviewer take the current revision, and record the verdict here. Until then this stays provisional and should not be cited as independently validated.
