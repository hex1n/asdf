# first-principles-planner description triggers — regression sample set (F1 round)

Purpose: before consolidating the description's synonym trigger clusters
(audit finding F1), fix a regression set so every pruning step can be checked:
positives must still route to the skill, non-triggers must not. Routing text
is high-stakes per AGENTS.md; no description edit lands without passing this
set plus independent falsification.

Collection method: mined all local Claude Code transcripts
(`~/.claude/projects`, 215 files) for (a) real `Skill` invocations of
first-principles-planner / deep-research / plan-review / diagnosing-bugs /
blindspot-pass paired with the preceding user prompt, and (b) user prompts
containing current trigger or boundary phrases. Prompts are verbatim; sources
are session date + workspace.

Known limits of the evidence:

- Invocation detection sees only `Skill` tool calls. A skill already loaded
  earlier in a session answers without a new call, so false negatives are
  only provable where the user complained in-session.
- Codex sessions carry no skill-invocation signal at all, so Codex prompts
  witness phrase *usage*, not routing outcomes.

## Positives — must still trigger after any pruning

| # | Prompt (verbatim) | Source | Branch |
|---|---|---|---|
| P1 | 根据上面的分析给出最佳改进方案 | 2026-07-12 taskloop | follow-up after analysis — **documented false negative**: did not fire, user complained next turn (「没用第一性原理给出计划呀」). The reason this branch exists; the one sample that must never regress. |
| P2 | 基于上面的分析 你认为最佳的改进方案是什么 | 2026-07-04 asdf-skills worktree | follow-up after analysis (fired) |
| P3 | 基于上面分析 哪些地方可以改进呢 | 2026-07-11 taskloop | follow-up, weak phrasing — no 最佳/方案 keyword, still fired correctly |
| P4 | 根据上面两篇文章的分析 当前的workloop 还有哪些需要改进的点 | 2026-07-26 workloop | follow-up + source framework (the coverage-map incident session) |
| P5 | 每个场景一个文件 我都不好看 不直观呀 使用第一性原理给出最佳改进方案 | 2026-07-04 asdf-skills | explicit 第一性原理 |
| P6 | 根据第一性原理分析一下当前的命名叫taskloop 还有更推荐的命名吗 | 2026-07-11 taskloop | 第一性原理 + naming decision |
| P7 | 交 first-principles 裁 | 2026-07-19 taskloop | skill named directly |
| P8 | 把 envelope 登记左移给出最佳改进计划 | 2026-07-11 taskloop | direct best-plan ask |
| P9 | 现在已经到达第一性原理分析的最佳改进了吗 | 2026-06-26 vault | challenge to a given recommendation |
| P10 | 第一性原理看看是否是最佳方案 | 2026-07-11 taskloop | challenge |
| P11 | 根据描述的问题给出最佳改进方案 (+ pasted bug report) | 2026-07-12 taskloop | fix-path plan from a described problem (fired) |
| P12 | 上面的是最佳方案吗 | 2026-02-08 Codex | challenge with zero context words — hardest routing case |
| P13 | 还有更好的设计吗 除了复制模式 | 2026-03-27 Codex | design-alternative ask (mechanism, not wording) |

## Non-triggers — must not route to the full planner

| # | Prompt (verbatim) | Source | Expected route | Evidence class |
|---|---|---|---|---|
| N1 | 昨天这个项目中做任务 但是我没有开启taskloop 但是遇到删除文件 还是被拦截了 你分析一下 | 2026-07-19 asdf | diagnosis/research | **real misfire — fp fired on a 分析 ask** |
| N2 | 但是我现在说把方案转成实施计划 还是会使用到fpp | 2026-07-19 asdf | conversion check (Route Examples), not full planner | **user-reported misfire**; origin of the converged-plan conversion rule |
| N3 | 这几条规则还有更好的表达吗 | 2026-07-04 asdf-skills worktree | direct wording edit | 还有更好 over-match risk; did not fire (correct) |
| N4 | 项目中的plan gate skill 还有更好的改进吗 (+ skill design description) | 2026-07-11 asdf | skill-writing audit (excluded by description) | did not fire (correct) |
| N5 | 现在的第一性原理 skill 这个命名贴切吗 | 2026-07-13 asdf | skill-design discussion | mentions skill's own name; did not fire (correct) |
| N6 | 还有一个点就是第一性原理skill 其实生成的计划…我在考虑是否应该去掉任务切片相关的 | 2026-07-13 asdf | skill-writing audit | 是否应该 inside excluded context; did not fire (correct) |
| N7 | 能去社区或者官方中调研一下看有哪些可以提供我们借鉴的 我预期是重写这两个文件 或者这两个文件是否有必要 | 2026-07-04 asdf-skills worktree | deep-research (fired) | research verb dominates despite 是否有必要 |
| N8 | 这个仓库 vs loop engineering最佳实践 | 2026-07-11 taskloop | deep-research (fired) | 最佳实践 ≠ 最佳方案 |
| N9 | 冷读深度分析这个仓库 | 2026-07-17 taskloop | deep-research (fired) | |
| N10 | 深度分析当前repo 看有哪些地方可以改进 | 2026-07-19 sofarpc-cli | research-first, planner only after facts | mixed-signal two-step per Routing Gate |
| N11 | 这个文章 vs 当前的taskloop仓库 | 2026-07-19 taskloop | deep-research (fired) | comparison ask |
| N12 | 审查一下这个方案有没有问题 | synthetic | plan-review | no real plan-review invocation found in history; synthetic boundary pending real evidence |
| N13 | 还有更好的命名推荐吗 | 2026-05-23 / 06-03 / 06-16 Codex (recurring) | inline naming suggestion | 还有更好 over-match: naming, not mechanism |
| N14 | 熟悉流程流转…还有更好的描述吗 | 2026-05-31 Codex | inline wording edit | 还有更好 over-match: prose polish (resume text) |
| N15 | 接受 按上面的最佳方案实现 | 2026-02-22 Codex | implementation | acceptance + execute; 最佳方案 as reference, not ask |
| N16 | 能调查一下官方文档 给出最佳方案吗 | 2026-04-12 Codex | research-first, then planner | mixed-signal two-step like N10 |

Borderline, keep observing: 「这份文档的方向对吗」(2026-07-25 workloop) fired
fp; defensible as a Decision-mode direction challenge, but sits near the
document-review boundary. Not in the gate set.

## Codex-side mining (952 sessions, 2025-09 → 2026-07)

Method: phrase-filtered raw lines, parsed only `role=user` `input_text`
records, then stripped compaction replays (`[N] role:` prefixes) and tool
echoes. 83 organic user prompts remained. Organic hit counts:

- 第一性原理 39 · 还有更好 23 · 给出最佳改进 19 · 最佳方案 12 — the four
  workhorses; every real planner ask in Codex history uses one of these (plus
  bare follow-up phrasing).
- 还有更好 splits roughly half/half between genuine design-alternative asks
  (P13) and naming/wording/generic-recommendation asks (N13, N14) — the
  cluster is load-bearing *and* the biggest over-match surface.
- **Zero organic usage in either store**: ROI, 值不值得做, 现在要不要做,
  方案选型, 收敛方案 (as an ask), 多方案对比, 先写方案, 先不写代码,
  先不coding, 架构演进, 优化方案, 计划评审, 方案评审. 是否应该 and 取舍
  appear only in skill-design meta-discussion and eval fixtures.

Prior-round precedent (2026-06-17 Codex session, old `asdf-skills` repo): a
description-compression round already ran once. Its independent falsifier
returned `continue`, warning the compression might drop 先不coding /
不要直接改代码 as real triggers, and the round **restored them as a
precaution — not from observed positives**. That session also added
description trigger-lock tests (`tests/test_skill_e2e_contracts.py`) which
did not survive the repo migration; this round should land a replacement
lock test alongside any description change.

## Branch coverage conclusions

- Keep and protect: 第一性原理, 最佳方案/最佳了吗 (incl. bare challenges,
  P12), 给出最佳改进/follow-up-after-analysis (P1-P4), 还有更好 (with the
  N13/N14 boundary), plan-first exclusions in the negative list that carry
  real routing work (计划评审/方案评审 → plan-review).
- Pruning candidates (zero organic positives anywhere, ~90 words of standing
  context load): ROI / 值不值得做 / 现在要不要做, 方案选型 / 收敛方案 /
  多方案对比, 架构演进 / 优化方案, and the 先写方案 / 先不写代码 /
  先不coding cluster — the last one only over the 2026-06-17 precautionary
  restoration, so its removal needs the falsifier to speak to that precedent
  explicitly.
- 是否应该 / 取舍: only observed in non-trigger contexts (N6); candidate for
  removal or for folding into the challenge branch.

## Routing gate results (draft 1 → draft 2)

Four blind fresh-context judges (two per description variant) routed all 28
samples against the candidate or current description plus five sibling
descriptions (plan-review, deep-research, diagnosing-bugs, blindspot-pass,
codebase-design). N2 exempt (conversion asks are handled post-load either
way). S21 reclassified dual-acceptable: fp's own Routing Gate sends mixed
research+plan asks research-first after loading, so either route is correct.

- Positives: current 13/13 + 13/13; candidate draft 1 13/13 + 12/13 — the
  single miss was S18/P4 (还有哪些需要改进的点, the coverage-map incident
  prompt) judged to deep-research once. Draft 2 adds that weak surface to the
  follow-up example list.
- Non-triggers: current failed 6 surfaces (S03 наming 2/2, S15 wording 2/2,
  S09 skill-improvement 2/2, S27 skill-tradeoff 2/2, S19 naming-fit 1/2,
  S25 resume wording 1/2). Candidate failed 2 (S09 1/2, S27 1/2) — the new
  naming/wording exclusion eliminated S03/S15/S19/S25 entirely.
- Accepted residual: S09/S27 (skill-design asks with better/tradeoff
  wording) stay borderline by design — the "unless the user explicitly asks
  to re-plan from first principles" escape hatch must keep catching P5-type
  explicit asks, so suppressing harder risks real positives.

Draft 2 re-gate (judges C1/C2, full 28 samples): positives 13/13 + 13/13 —
S18 fixed by the added weak surface. Non-triggers: C1 clean; C2 captured
S09/S27 (the pre-declared accepted residual, ~1/2 capture vs current's 2/2)
and routed S11 (深度分析…看有哪些地方可以改进) to the planner once.

**Retraction.** This round first recorded S11 as "dual-acceptable" and
declared the gate passed. The independent falsifier correctly refuted that
as motivated reasoning: S11 was pre-labeled research-first, and the
reclassification happened only after the candidate captured it — the same
criterion-narrowing failure this whole day's work started from. S11 is a
draft-2 fail. Root cause: the added weak surface 还有哪些可以改进的点 is
anaphor-free, so it matches fresh research-led asks. Draft 3 anchors it as
基于上面分析还有哪些可以改进的点 — S18/S06 keep their 上面分析 anchor and
still match; S11 has none and should route to research again.

Pre-registered rules for the draft-3 gate (fixed before judging, no post-hoc
reclassification of any outcome): every P* must route to
first-principles-planner; every N* must route elsewhere; the single standing
exemption is S21 (explicit 给出最佳方案 deliverable with research as the
stated means — the skill's Routing Gate runs such asks research-first after
loading, a rationale grounded in skill text and applied to S21 both times it
was judged); S09/S27 captures count against the gate but ≤1/2 each matches
the documented accepted residual. Any other deviation fails the gate and
forces a revision, not a relabel.

Draft-3 gate result (judges D1/D2): positives 13/13 + 13/13. Non-triggers:
S11 captured by D1 (semantic pull: "analysis framed toward improvement"),
routed to research by D2 — the anchor helped but does not fully suppress;
S09 captured 2/2, exceeding the ≤1/2 allowance; S27 1/2 within allowance.
**Gate: FAIL on its own pre-registered terms (S11 1/2, S09 2/2).**

Draft 4 attempted the prescribed revision — an explicit negative-list clause
for research-verb-led surveys with open-ended improvement tails. It pushed
the flattened description to 1101 chars, tripping this round's own 1050
anti-sediment ceiling (lock test red). Reverted: buying suppression of a
behaviorally-benign borderline with permanent description growth repeats the
sediment failure this round exists to stop. Cumulative candidate-judge data
(4 judges since draft 2): recall 52/52 P verdicts; S09 2/4, S27 2/4, S11 1/4
captures — all three are genuinely mixed asks the skill body handles
post-load (skill-audit exclusion, research-first route); the current
description captures S09/S27 2/2 *plus* four pure-noise surfaces the drafts
suppress completely. Disposition of the failed gate — accept draft 3 with
documented borderline variance, or fund draft 4 by raising the ceiling — is
the user's call.

**Disposition (user, 2026-07-26): option A — accept draft 3.** Rationale:
recall 52/52; the four pure-noise surfaces are fully suppressed; the three
surviving borderlines are genuinely mixed asks the skill body handles
post-load, and none routes worse than under the previous description. The
gate's own FAIL verdict stands on record; acceptance is an explicit user
waiver, not a relabel.

## Independent falsification (Codex, 2026-07-26)

Verdict: REFUTED (two findings sustained, two weakening). Adjudication:

1. **S11 post-hoc reclassification (sustained)** — retracted above; fixed in
   draft 3 by anchoring the weak surface; draft-3 gate rules pre-registered.
2. **Lock test presence-only, never ships (sustained in part)** — assertions
   hardened to positional checks (triggers before "Do not use", guards
   after), closing the "string moved into the negative list" hole. Local-only
   tests are this repo's standing convention (check-all runs them; CI never
   sees any suite), not a defect of this round. The 1050 ceiling stays,
   documented as an anti-sediment tripwire, not a routing claim.
3. **Constructed probes for dropped phrases (weakening only)** — the
   falsifier's ten probes (优化方案/架构演进/先写方案/先不coding/是否应该/
   取舍/值不值得做/现在要不要做/是根治吗/最佳形态了吗 in realistic asks) are
   kept as the observation watchlist for the next window: any real miss on
   these surfaces reopens the pruning decision with organic evidence.
4. **先不coding initial-routing risk (weakening only)** — the retained
   representative 先不写代码 plus the plan-first branch phrase carry initial
   routing; the REFERENCE fallback only helps post-load. Accepted residual.

## Candidate description (draft 3, applied pending re-gate)

Contract constraints from `skills/plan-review/tests/contract.test.mjs`
(matched against the whole SKILL.md, whitespace-flattened):
`competing options or an unresolved decision`, the exact triple
`收敛方案, 方案选型, 多方案对比/证伪`, the contiguous sequence
`code review, reviewing or falsifying one existing plan`, `use plan-review)`,
and `implementation strategy` must all survive. The Chinese triple is
therefore **exempt from pruning this round** despite zero organic usage;
removing it is a two-skill + contract-test change for a later round.

```yaml
description: >
  Creates first-principles recommendations and plans: reframes the root
  problem, compares mechanisms, and returns the current-best path with its
  failure conditions and next verification step. Use for a best/better plan,
  implementation strategy, or design direction (最佳方案, 还有更好,
  给出最佳改进), plan-first asks (先不写代码), adopt/replace/tradeoff and
  worth-building-now decisions (ROI), converging or falsifying competing
  options or an unresolved decision (收敛方案, 方案选型, 多方案对比/证伪),
  第一性原理 asks, and mid-conversation follow-ups — a best-fix ask after
  analysis in this conversation (根据上面分析给出最佳改进方案,
  基于上面分析还有哪些可以改进的点) or a challenge
  to the recommendation just given (上面的是最佳方案/改进吗). Do not use for
  pure fact-finding research, live bug diagnosis, implementation, quick
  naming or wording polish, code review, reviewing or falsifying one existing
  plan (计划评审, 方案评审 — use plan-review), durable ADR/CONTEXT capture,
  or skill-writing audits unless the user explicitly asks to re-plan from
  first principles.
```

Every dropped phrase maps to a retained trigger:

| Dropped | Retained cover | Evidence |
|---|---|---|
| 优化方案, 架构演进 | best/better plan / design direction branch | zero organic in either store |
| 先写方案, 先不coding | representative 先不写代码 (honors the 2026-06-17 restoration by keeping one mixed-language representative instead of the family) | zero organic; REFERENCE Chinese-signals row still carries the full family post-load |
| 是否应该, 取舍 | English branch name "adopt/replace/tradeoff decisions" | only non-trigger contexts observed (N6) |
| 值不值得做, 现在要不要做 + "deciding whether…worth doing now" | "worth-building-now decisions (ROI)" | zero organic |
| 是根治吗, 最佳形态了吗, 最佳了吗 | collapsed challenge example 上面的是最佳方案/改进吗 | all organic challenges use the 最佳 surface (P9, P10, P12) |
| 给出最佳改进方案 (follow-up example) | P1-verbatim 根据上面分析给出最佳改进方案 | P1 |
| "which re-enter this skill for a fresh mechanism comparison" | cut — identity, lives in the body | writing-for-agents: cut identity from descriptions |

Added: "quick naming or wording polish" to the negative list (recurring
organic over-match surface for 还有更好 — N13, N14), placed before the
contract-locked `code review, reviewing…` sequence so it stays contiguous.

Size: 1133 → 972 flattened characters (14% off the every-turn load; the
round's main win is trigger precision — four real over-match surfaces
killed — not raw size).
REFERENCE.md's Chinese Routing Signals table is untouched: it costs nothing
per turn and keeps recognizing the pruned phrases after the skill loads.

## Round closure and follow-ups

All four planned steps ran: draft (3 revisions), blind routing gate (8
candidate-judge passes + 2 baseline), trigger-lock test (positional,
local-only per repo convention), independent Codex falsification (REFUTED →
both sustained findings fixed; retraction recorded above). Applied to
`SKILL.md` under the user's option-A disposition.

Open follow-ups for a later round:

- Observation watchlist: the falsifier's ten constructed probes for dropped
  phrases, plus borderlines S09/S27/S11 — a real-world miss or capture on
  any of them reopens this decision with organic evidence.
- The contract-locked Chinese triple (收敛方案, 方案选型, 多方案对比/证伪)
  keeps zero organic usage; pruning it is a two-skill + contract-test round.
- plan-review boundary still has no organic positive sample (N12 synthetic).
