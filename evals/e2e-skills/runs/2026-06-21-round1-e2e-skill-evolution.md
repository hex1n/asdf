# E2E planner/executor — Round-1 evolution evidence

Date: 2026-06-21
Skills under test: `skills/e2e-test-planner/` and `skills/e2e-test-executor/` @ working tree
Baseline: HEAD `0e03ed0` (Merge e2e planner and executor skills)
Candidate: uncommitted working tree
Runner/grader: Claude (Opus 4.8) — **author + runner + grader; NOT independent context.**
See the Independence caveat at the end.

This round retro-fits the `AGENTS.md` Skill Evolution Loop onto a batch of edits that
were landed first as engineering changes (first-principles review of the two skills,
plus a user-driven "产物太多" concern) and only afterwards measured against the loop. The
gates below are therefore an honest after-the-fact audit, not a clean before-the-fact run.

## Authoring frame applied (AGENTS.md:22)

Loaded `~/.claude/skills/writing-great-skills/SKILL.md` and re-read the candidate against
its levers. Findings:

- **Progressive disclosure — pass.** Both new `REFERENCE.md` files move bulky field tables
  (Run Artifact Contract; Executor Handoff Index fields) down the ladder, reached by a
  context pointer from `SKILL.md`. Top stays legible.
- **Leading words — pass.** `core` / `optional` / `on demand` / `non-reconstructable` carry
  the artifact-tiering behaviour in few tokens.
- **Pruning — pass.** Planner contract's keeps-core test went from ~60 literal prose markers
  to 8 load-bearing anchors; removes change-detector sediment without losing the soul clause.
- **Completion criteria — checkable.** Executor §6 now ends on "core artifacts exist and
  optional artifacts are produced only when a consumer needs them" (done/not-done observable).
- **Duplication — two minor hits (see Regressions).** Not blocking; logged as collapse
  candidates, kept double because the two sites load at different times/audiences.

## Change set (candidate vs baseline)

1. **`skills/e2e-test-executor/REFERENCE.md` (new)** — authoritative Run Artifact Contract,
   split into Core (always) vs Optional (only when a consumer needs them) tiers.
2. **`skills/e2e-test-planner/REFERENCE.md` (new)** — Executor Handoff Index field definitions
   disclosed off the always-loaded skill body.
3. **executor `SKILL.md` §6** — artifact tiering (P1a): default = `execution-report.md` +
   `evidence/` + `preserved-scenes/`; `run-metadata.json` / `scenario-results.jsonl` /
   `execution-report.html` / `issue-backlog.md` demoted to optional/on-demand. Safety invariant
   added: `evidence/` and `preserved-scenes/` "never downgrade to optional".
4. **executor `SKILL.md` §1** — parse `Executor Handoff Index` when present.
5. **planner `SKILL.md`** — delegated-execution branch adds the `Executor Handoff Index`
   section after the DAG; §7 `Execution Order` demoted from required to **optional** (the
   executor derives order from the DAG `Depends on`), kept (not deleted) as a human-facing
   projection.
6. **Contract tests (4 files)** — encode the tiered artifact contract; converge planner
   keeps-core markers 60→8; move `Execution Order` from required closure to optional in
   `assert_valid_generated_plan`; add `accepts_without_optional_execution_order`.

## Task sample / artifacts

- project: asdf-skills
- command: `python3 -m unittest discover -s tests -q`
- baseline artifact: HEAD `0e03ed0` skill text (`git show 0e03ed0:skills/...`)
- candidate artifact: working-tree diff (`git diff` + two untracked `REFERENCE.md`)
- validation artifact: full suite **76 tests OK**; planner fixture-level proof via
  `assert_valid_generated_plan` + `accepts_without_optional_execution_order`
  (omitting the now-optional section still validates); executor proof is marker/structure-level
  (no executor-specific fixture exists — recorded as a coverage gap, not a pass).

## Layer 1 — hard gates (AGENTS.md:35-43)

- Baseline exists + real validation artifact present — **pass** (HEAD baseline; 76-test run).
- No correctness/safety/privacy regression — **pass**; core/safety invariants preserved
  (`evidence/` + `preserved-scenes/` never optional; optional artifacts must not introduce
  facts absent from the report/evidence).
- `SKILL.md` stays task-facing, not a manual — **pass**; field tables moved to `REFERENCE.md`,
  bodies got shorter.
- Runtime portability preserved — **pass**; stdlib `unittest` only, no new deps.
- Full evidence path recoverable — **pass**; git diff + test run + this note.
- Narrowest effective change — **pass** with one caveat: P2b demoted rather than deleted; the
  two duplications below are the only non-minimal residue, both non-blocking.
- Temporary comparison outputs outside the skill folder — **pass**; this note lives in
  `evals/`, not under `skills/`.

All hard gates pass.

## Layer 2 — improvement × confidence (AGENTS.md:47-61)

- **Improvement magnitude: clear.** Default executor output drops from 7 artifacts to 3 core
  + 4 on-demand (directly treats "产物太多"); planner sheds a required derived section; the
  planner contract sheds ~52 brittle prose markers while keeping the soul clause. Each is
  visible in the diff.
- **Generalization confidence: low.** Single author, single context. Fixture-level proof
  exists for the planner relaxation; executor relaxation has no independent fixture and no
  second diverse sample.

Decision rule: clear improvement + low confidence ⇒ *continue* (never accept generalization
on a single sample). Because the high-stakes escalation below cannot run in an independent
context here, the terminal status is **accept provisional**, not accept.

## High-stakes escalation (AGENTS.md:64-73)

Mechanically triggered — three objective conditions hold:
- The edit touches **two skills** (planner + executor) and a batch spanning both.
- It **loosens/removes rules** (artifacts → optional; `Execution Order` → optional; 60→8 markers).
- The accept would rest on a **single sample**.

The required independent falsification pass **was run** in a fresh context: a separate
general-purpose subagent, given only a neutral statement of the change set (not the "this is an
improvement" framing) and explicitly forbidden from reading this `evals/` note, was tasked to
*try to falsify* that the batch is an improvement — to actively hunt for a dropped constraint,
self-contradiction, lowered default-correctness, or any regression.

**Verdict: FALSIFICATION FAILED (edits hold up).** Both must-check points independently
confirmed; no regression found. It was not a rubber stamp — it independently observed that
executor `preserved-scenes/` is a *net tightening* (absent from the baseline directory tree
entirely) and surfaced four genuine test-coverage gaps (see Follow-up below), none of which is a
regression introduced by this batch; they are inherent limits of static-text contracts.

Honest downgrade: the independent context is a fresh-context same-model subagent, not a human
second reviewer. That clears the AGENTS.md "author's own re-read is not the independent check"
bar (different context, adversarial framing, blind to the author's notes), but a human transcript
review would raise assurance further if desired.

## Relative delta (trend only)

artifact over-production −→+ (+1) · contract rigidity −→+ (+1) · derived-section redundancy
−→+ (+1) · progressive disclosure 0→+ (+1) · duplication 0→− (−1) · independent falsification
0→+ (+1, fresh-context pass, FALSIFICATION FAILED). Sum: **+4**, trend only, not a score.

## Wins

- Treats the reported "产物太多" root cause with a tiered contract, core safety evidence pinned.
- De-rigidifies the planner contract (change-detector → load-bearing anchors), lowering future
  maintenance friction.
- `Execution Order` relaxed without breaking existing full-form plans (fixture proves both
  directions).

## Regressions

- **Duplication (minor): the "optional artifacts must not introduce facts absent from the
  report/evidence" invariant lives in BOTH** executor `SKILL.md §6` **and** `REFERENCE.md`.
  Kept in `SKILL.md` because it is an always-loaded safety invariant; `REFERENCE.md` restates
  it to close its own contract table. Collapse candidate: have `REFERENCE.md` point back
  instead of restating.
- **Duplication (minor): the `Executor Handoff Index` trigger condition** ("delegated to
  `e2e-test-executor`, a separate agent session, or automation") appears in the planner
  primary-consumer paragraph AND in §6's delegated-execution branch. Announce-then-specify is
  defensible; collapse candidate is to trim the trigger restatement in the intro.
- **Coverage gap:** executor has no fixture; its relaxation is only marker/structure-tested.

## Weakest gate / lowest-confidence claim

Generalization confidence is **low** (single author context) and the high-stakes independent
falsification did not run. The "clear improvement" magnitude is falsifiable against the diff;
the residual risk is whether an independent agent reading only the relaxed skills still produces
the core artifacts by default and still derives execution order from the DAG.

## Follow-up (test-coverage gaps surfaced by the independent pass)

These are not regressions in this batch; they are pre-existing limits of the static-text
contracts, made visible by the relaxations. Candidates for a next round, ordered by severity:

1. No test asserts the **conditional trigger** for `Executor Handoff Index`: that a delegated plan
   includes it and a standalone plan omits it. An agent could skip it under delegation undetected.
2. `preserved-scenes/` population on failure is asserted only as a string in §6, never as live
   behavior — inherently untestable by text contracts, but the most operationally critical invariant.
3. No test checks that an **inlined** issue backlog in `execution-report.md` carries the full
   required schema fields; a thin inline summary could still pass.
4. The optional `Execution Order` section, when present, is accepted but its content is not
   validated against the DAG `Depends on`.

## Decision

**accept.** Engineering correctness is established (76 tests, narrowest edits, portability intact),
and the AGENTS.md high-stakes requirement is met: a fresh-context, adversarially-framed
independent falsification pass tried to break the batch and failed to find a regression. The two
duplication items and the four coverage gaps above are follow-up candidates, not blockers.

## Independence caveat

The independent check was performed by a fresh-context same-model subagent — blind to this note,
given a neutral change statement, and tasked to falsify rather than confirm. This clears the
AGENTS.md bar that the author's own re-read is not the independent check. It is not a human second
reviewer; a human transcript review remains available to raise assurance further but is not
required to lift the provisional status under AGENTS.md:73 once a fresh-context pass has run.

---

## Round 2

Supersedes: none (extends Round 1; acts on two follow-up items it surfaced)
Improvement magnitude: clear (B1 fixes a real validator/skill inconsistency) + marginal (A2 dedup)
Generalization confidence: high — deterministic contract fix with bidirectional tests and a
mutation proof, not a sample-dependent behavior claim.
Hard gates: pass
High-stakes escalation: not needed — single skill touched (planner only), the change *tightens*
(adds a check) rather than loosens, and both directions are tested; none of the mechanical
triggers fire.
Relative delta: validator/skill self-consistency 0→+ (+1) · handoff-field coverage 0→+ (+1) ·
trigger-condition duplication 0→− then closed (+1). Sum **+3**, trend only.

Task sample:
- project: asdf-skills
- command: `python3 -m unittest discover -s tests -q`
- baseline: Round-1 working tree (76 tests)
- candidate: + DAG-slice boundary fix, + optional Executor Handoff Index field check, + intro dedup
- validation artifact: **78 tests OK** (76 + 2 new); mutation proof that the *old* DAG slice
  `text[indexes[5]:min(closure_indexes)]` pulls a 2-column handoff table into the 11-column DAG
  parse (`column widths: [2, 11]`), which would make any delegated plan fail its own contract.

### B1 — validator/skill inconsistency on delegated plans (the real find)

The skill (§6) tells the agent to insert an `Executor Handoff Index` table immediately after the
DAG when execution is delegated. But `assert_valid_generated_plan` sliced the DAG region up to the
first closure heading, so that handoff table was parsed as DAG rows — a delegated plan could not
pass the planner's own contract. Fix: slice the DAG region to the handoff heading when present, and
add an optional handoff check (position after DAG / before closure + the 9 locator fields from
`REFERENCE.md`). Two new tests: `accepts_delegated_executor_handoff_index` (well-formed delegated
plan validates) and `rejects_thin_executor_handoff_index` (Artifact-ID-only stub is rejected) — a
green/red mutation pair.

### A2 — duplication collapse

The `Executor Handoff Index` trigger condition ("delegated to `e2e-test-executor`, a separate agent
session, or automation") + the `REFERENCE.md` link were stated in both the planner intro and §6.
Intro now carries a short pointer ("also emit the compact Executor Handoff Index described after the
Execution DAG"); the full trigger condition, placement, and link are single-sourced to §6.

### Deferred this round, with reason

- **A1 (duplication: "optional artifacts must not introduce facts…" in executor SKILL §6 + REFERENCE):**
  kept double on purpose. The SKILL copy is an always-loaded safety invariant (correctly high
  prominence); the REFERENCE copy closes its own contract table (co-location). Collapsing either
  weakens one site; not worth it.
- **B2 (preserved-scenes populated on failure):** inherently untestable by a static text contract;
  needs a live executor run, which there is no fixture for.
- **B3 (inlined issue-backlog carries full schema) / B4 (Execution Order content matches the DAG):**
  low-value, higher-brittleness semantic checks on optional/advisory sections; rejected as not worth
  the maintenance per the marginal-improvement rule.

Wins: closes a contract gap that would have bitten every delegated plan; removes token noise.
Regressions: none found; suite 76→78, all green.
Weakest gate: executor still has no fixture, so its artifact-tiering relaxation remains marker-tested
only (carried over from Round 1, not introduced here).

Decision: **accept.** Deterministic fix, bidirectional tests, mutation-proven necessity, no
mechanical high-stakes trigger. Round-1 batch remains **accept** under its fresh-context pass.

## Round 3 — real-repo diverse sample (live falsification, not a fixture)

All prior evidence used curated fixtures. This round authors a genuine plan from real code and runs
it through the planner's own output contract — the "real task + ≥1 diverse sample vs fixture" leg.

Sample repo: `<workspace:asset_loan>` (分期乐资方代扣 / hfax_loan_service), a Java consumer-finance
system. Flow chosen: 代扣结果通知 (withhold result notification → repay-plan settlement). Real source
receipts: `FundLoanWithHoldNoticeReq.java` (callback entry, fields `buzNo`/`amount`/`repayFlowNo`),
`ValidatorFilterChain.java` (`PRIORITY_USER_REPEAT_REPAY` idempotency, `PRIORITY_REMOTE_AMOUNT` vs
`PRIORITY_LOCAL_AMOUNT` reconciliation), `ResultStatusEnum.java` (SUCCESS=10/FAIL=9),
`RepayPlanEnum.java` (product-routed repay-plan beans). Plan authored as the **delegated/Chinese**
variant (carries `执行器交接索引`) to exercise the most recently changed code path (B1) on fresh material.

Artifact (outside skill folder, per AGENTS.md:43):
`evals/e2e-skills/real-repo/2026-06-21-withhold-notice-plan-zh.md`.

Result — `assert_valid_generated_plan`: **PASS** on the real authored plan. The delegated 2-col
handoff table after the DAG validates without bleeding into the 11-col DAG parse → B1 fix confirmed
on real, non-fixture input.

Falsification battery on the real plan (prove the validator bites on this fresh sample, not just the
fixture):

| Mutation | Expected | Got |
|---|---|---|
| M1 drop handoff index (standalone branch) | PASS (optional) | PASS |
| M2 handoff index missing `Variable ledger` field | FAIL | FAIL |
| M3 DAG consumes unsourced `ghostToken` | FAIL | FAIL |
| M4 handoff index placed after closure | FAIL | FAIL |
| M5 parallel-safety reason removed | FAIL | FAIL |

5/5 as expected. The contract accepts a genuine real-code plan, treats the handoff index as optional,
and rejects incomplete/misplaced handoff, unsourced variables, and reasonless parallel-safety on
real-shaped material. Suite still 78 green.

Decision: **accept** holds — now backed by a live diverse sample, not fixtures alone. No new failure
mode surfaced; no edit was needed this round (validation-only).

### Executor on the same real sample

The executor's contract is **text-only**: `test_e2e_test_executor_contract.py` validates `SKILL.md`/
`REFERENCE.md` markers, section ordering, and an adversarial-contradiction guard
(`assert_no_executor_contradictions`). There is **no executable run-artifact validator** — by design,
since the executor's output is a live run that mutates DB/MQ/stub state. So "run on the real repo"
cannot mean the same machine-checked thing the planner got.

What is deliberately **not** done: actually executing the WITHHOLD flow against `<workspace:asset_loan>`.
That is a live consumer-finance system (writes repay流水/明细, needs fund-provider stubs) → destructive
+ external side effect, unauthorized, no harness. Authoring a run report that *looks* executed would
fabricate evidence; refused. This is the correct finding, not a gap to paper over — it is the same
read-only/mutating asymmetry that keeps planner and executor separate skills.

What is done honestly on real material:

1. **Guard falsification** (executor's real contract surface): 7 realistic subtle mutations injected
   into the executor SKILL (default-to-test-code, run-prod-without-stopping, skip-capability-map,
   pass-on-missing-probe, default-remote-issues, dependency-timeout-as-product-defect,
   cleanup-before-preserve-scene). All 7 bite (FAIL); original SKILL stays clean. The guard catches
   real regressions, not just the literal injected strings in the suite.
2. **Real planner→executor handoff** integration: fed the real WITHHOLD plan into the facts the
   executor §1 Intake consumes (agent-ready gates, agent execution contract, execution DAG, executor
   handoff index, execution order, scenario fields, waits, cleanup). All 8 present → the real plan is
   a complete executor input; the two skills compose on real material, not just fixtures.

Suite 78 green throughout. Executor decision: **accept** for the contract surface that exists; the
live-run gate remains intentionally out of scope (no fixture/harness, would require live mutation).

## Round 4 — executor dependency-availability gate (挡板)

Trigger: user-approved invariant — "第三方服务/DB 不可达或不可用时能加挡板吗". Rule Harvest Gate: user
asked for it; narrowest level = executor only (planner is read-only; runtime dependency availability
is the executor's concern).

Baseline coverage check first (avoid sediment): §2 already gates pre-flight ("execution does not
begin until the capability map satisfies entry gates or names exact blockers"); §5 already says "a
missing probe is blocked, not passed" and classifies `environment defect`; an existing guard forbids
calling dependency *setup* failures (cache/deps) product defects. Genuine gap: **runtime** third-party/
DB/MQ/Redis unreachability — the stub-or-stop decision, "never `passed`", and "not a product defect
unless product code actually executed and returned the fault".

Edit (narrowest): one paragraph appended to §5's classification block (co-located with the existing
classify/blocked logic, no new section, no §2 duplication):
> When a required third-party service, database, message queue, Redis, or callback endpoint is
> unreachable or unavailable at run time, prefer the plan's declared stub or 挡板; if none exists and
> the scenario needs the live dependency, mark the scenario `blocked` or suspend per the plan's gates,
> capture the unreachable evidence …, and classify it as an `environment defect` — never `passed`, and
> not a `product defect` unless product code actually executed and returned the fault. The exception is
> a scenario whose purpose is the dependency-down, timeout, or recovery path …

Load-bearing protection (two new tests):
- `test_dependency_availability_gate` — marker test pinning the rule's 7 anchors in §5.
- New `EXECUTOR_CONTRADICTIONS` entry + 7 adversarial cases — bites on: dependency unreachable →
  mark passed/success (both orders); third-party/DB/MQ outage → product defect *by default*; service
  unreachable → skip & continue/pass.

Bidirectional falsification: original SKILL stays clean (no false positive on the legit new rule);
7/7 adversarial injections caught. The bidirectional run surfaced two real regex bugs before they
shipped — plural word-boundaries `\boutage\b` and `product\s+defect\b` missed "outages"/"defects";
fixed to `outages?` / `defects?`. (Evidence the green/red pair does real work, not decoration.)

Two-layer gate: L1 hard gates — suite 78→79 green, legit-clean + adversarial-bite both hold, no
contradiction with existing guards. L2 — improvement clear (closes a real runtime-availability gap the
user hit), generalization confidence high (additive tightening, matches existing vocabulary
blocked/environment-defect/stub/挡板).

High-stakes: this *adds* a hard gate (new contradiction guard). Additive tightening, single skill,
bidirectional-tested — not a loosen/reroute. Per the cautious reading I still treat "adds a hard gate"
as escalation-worthy. Author's own re-read is not the independent check.

Decision: **accept provisional.** Rule + guard implemented and bidirectionally proven on this context;
to lift to `accept`, run an independent fresh-context falsification pass (as done for Round 1).

## Round 5 — independent falsification kills the regex guard; pivot to a presence protector

Two independent fresh-context falsification passes (general-purpose subagents, blind to the
implementation, told only the rule and asked to break the guard) were run against the dependency
contradiction regex.

- **Pass A** (hardened the guard once). Author's first cut leaked simple plural/synonym paraphrases.
  Subagent found verb/outcome/skip synonyms and an exception-clause framing slipping past. Verdict:
  **FALSIFIED.** Response: broadened the arm by synonym *class* (constants `_DEP_TRIG/_DEP_VERB/
  `_DEP_POS/_DEP_SKIP`), 8 arms, wider windows. Re-verified: 21/21 of the pass-A evasions then bit.
- **Pass B** (independent, against the hardened 8-arm guard). Verdict: **FALSIFIED again**, with
  *structural* findings, not just vocabulary:
  1. **False positives on correct text** (the disqualifier): the guard fires on
     `"Never mark a scenario passed when the endpoint is unreachable."` and `"Do not consider the
     scenario passed when a dependency is unreachable."` — i.e. it flags the *correct strengthening
     edit*. Cause is structural: every `TRIG…VERB…POS` arm also matches `never VERB…POS…TRIG`, and
     Python `re` has no clean variable-length lookbehind to subtract the negation.
  2. **Unbounded false negatives**: outcome synonyms not in `_DEP_POS` ("fine", "non-issue", "good"),
     skip synonyms ("gloss over", "let it slide"), verb-free notation ("service unavailable → pass",
     "DB unreachable = passed"), trigger gaps ("offline", "not responding", "unresponsive"),
     distance > the 160-char window, and **all Chinese** ("数据库连不上就当通过"). The arms race is
     unwinnable for a semantic property over natural language.

**First-principles decision (acting on what falsification proved).** A regex contradiction-tripwire is
the wrong tool for this semantic invariant. The *robust* protector already existed:
`test_dependency_availability_gate` is a **presence test** that pins the canonical §5 rule tokens — it
cannot be fooled by paraphrase (it asserts the rule is *present*, not the *absence* of infinite
contradictions) and cannot false-positive on correct text (correct text contains those tokens). Kept
it; **removed** the brittle 8-arm regex arm, the `_DEP_*` constants, the 7 dependency adversarial
cases, and the `test_dependency_availability_guard_catches_synonym_evasions` teach-to-the-test battery
(overfit to pass-A's strings). Added a docstring on the presence test telling future maintainers not to
reintroduce a contradiction regex for this invariant. Net: simplification, not capitulation.

Why this is sound, not goalpost-moving: the Rule Harvest Gate requires *protecting a load-bearing rule*
— i.e. detecting that it was weakened/removed — which the presence test does completely. Verified
bidirectionally: presence test PASSES on the real skill and BITES when the rule is weakened
(`"an outage alone is never a pass" → "may be treated as a pass"` drops the marker → fail). Residual,
accepted: a future editor who *adds* a contradicting line elsewhere while leaving §5 intact is caught
by neither presence nor (proven-leaky) regex — code review covers that narrow case, and it is far less
likely than weakening the canonical rule itself. Suite: 80 → **79 green** (removed the overfit battery).

Two-layer gate: L1 — suite green; protector bites on weakening; no false positive on the real skill or
on correct negated phrasings (the removed arm's defect is gone by construction). L2 — improvement is a
*correctness* gain (eliminates a test that fails on correct edits) and *generalizes* (presence is
paraphrase- and language-robust where regex was neither).

Decision: **accept.**
- The behavioral 挡板 — executor `SKILL.md` §5 dependency-availability rule — is the real deliverable;
  it is sound and unchanged.
- Its protection is now `test_dependency_availability_gate` (presence), the mechanism that withstands
  paraphrase; the regex contradiction approach is **rejected for this invariant** and documented as
  such in-code so it is not re-added.
- Independence satisfied: two separate fresh-context subagents, the second against the hardened build;
  both FALSIFIED, and the accept rests on a protector whose soundness does not depend on out-guessing
  an attacker (presence, not enumeration).

## Round 6 — close the planner/executor verification asymmetry (run-artifact contract)

Trigger: second first-principles pass ("现在两个 skill 是否最佳设计了"). Root finding: the two skills'
*verification* paradigms were asymmetric. Planner had an executable structural validator
(`assert_valid_generated_plan`) over a plan instance; executor had only text-only contract checks over
`SKILL.md`/`REFERENCE.md` and **no validator over a run-artifact instance**. The prior "executor can't be
statically validated because its output is a destructive live run" was an *unverified assumption*, not a
true constraint: `execution-report.md` is markdown, validatable offline exactly like a plan — the
validator reads the report text, it never executes a run.

Edit (symmetric to the planner):
- New `assert_valid_execution_report(test_case, text)` in the executor contract test — six executable
  invariants over a report instance: (R1) 10 required sections present, (R2) `Execution Summary` first,
  (R3a) ≥1 terminal status ∈ {passed,failed,blocked,skipped} in Scenario Results, (R3b, soul clause)
  every `failed` row references `preserved-scenes/` on the same row, (R4) `evidence/index.md` referenced,
  (R5) `Re-run Instructions` carries an executable command, not prose.
- Single source of truth for the contract written into `REFERENCE.md` → "execution-report.md structural
  contract" (the validator enforces what REFERENCE documents; symmetric to where the planner defines its
  handoff fields). Extended the REFERENCE presence test with 5 markers so the doc can't silently drift.
- Fixture `tests/fixtures/e2e_test_executor/valid-execution-report.md` (a synthetic but realistic
  withhold-notice run: 1 passed / 1 failed-with-scene / 1 blocked). **Placed under `tests/fixtures/`, not
  `evals/`** — deliberately diverging from the earlier "synthetic samples go in evals/" note: a test
  fixture is a first-class part of the suite (the test cannot run without it) and the planner validator
  already keeps its fixtures in `tests/fixtures/e2e_test_planner/`. AGENTS.md:43 governs *transient round
  comparison output*, not permanent test fixtures. Convention + symmetry win here.

Bidirectional falsification: valid fixture PASSES; 5 mutations each break exactly one invariant and were
verified to bite with the *intended* message (R1 missing section / R3b failed-without-scene / R3a no legal
status / R4 no evidence index / R5 rerun without command) — not incidentally tripping a different rule.

Two-layer gate: L1 — suite 79→**81 green**, valid-PASS + 5/5 mutation-BITE both hold, no regression in the
existing text contract. L2 — improvement is a genuine coverage gain (executor now has the run-artifact
structural floor it lacked) and generalizes (static, paraphrase-robust, language-agnostic on structure).

Decision: **accept.** The planner/executor pair is now symmetric at the verification layer: each has an
executable structural validator over its primary artifact (plan / run report) plus text contracts over the
skill body. Residual, accepted: the validator checks report *structure and evidence-integrity*, not whether
the run's *findings* are true — that is the executor's runtime job and out of scope for a static contract.

Architecture verdict (answering the first-principles question): the two-skill split, progressive
disclosure, and now the symmetric validators are at current-best; marginal-gain stop reached. Do **not**
resume regex contradiction work (Round 5) and do **not** merge the skills (safety/side-effect asymmetry is
the load-bearing constraint).
