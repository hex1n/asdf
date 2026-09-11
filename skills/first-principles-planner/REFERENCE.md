# First-Principles Planner Reference

Read this file for Plan mode, Deep plans, ambiguous tradeoffs, or when the
short process in `SKILL.md` is not enough.

## Contents

- Localized Request and Output Rules: localized routing signals, examples, and labels
- Problem Archaeology: root trace, problem statement, assumption audit
- Value Gate and Decision Envelope: mechanism families, economic evidence, envelope schema
- Solution Reconstruction: option categories, independent context, independent option tournament, inversion test, recommendation chain
- Bestness Check: fit criteria, closest alternative, stop point
- Plan Synthesis: scope table, decision pricing, decision-first structure
- Evidence Conventions: verified vs unverified claims
- Artifact Location: default path rules for saved Markdown plans
- Plan File Output: saved plan output shape

## Localized Request and Output Rules

Use this section only when request language, route examples, or saved artifact labels need localized handling. Keep planner mechanics in `SKILL.md`; this section maps language-specific signals and labels.

### Chinese Routing Signals

| Route | Signals |
|---|---|
| Planner | `第一性原理`, `最佳方案`, `最佳实现`, `给出方案`, `先写方案`, `还有更好`, `是否应该`, `最佳了吗`, `取舍`, `架构演进`, `优化方案`, `ROI`, `值不值得做`, `现在要不要做` |
| Research-first | `深度分析`, `排查`, `定位`, `为什么`, `根因`, `掌握链路` |
| Review/critique | `计划评审`, `方案评审`, `审查计划`, `审查方案`, `看看这个计划有没有问题` |

### Chinese Route Examples

- `是否应该替换 X?` / `还有更好的吗?` / `最佳了吗?` -> Decision.
- `先不写代码，给最佳方案` / `给一个架构演进方案` -> Plan; `给最佳方案` selects the route, `先不写代码` only bounds scope.
- `深度分析为什么失败` -> Research-first; plan only if the user asks for a fix path.
- `把方案转成实施计划` / `拆成切片、阶段、工单` -> run the converged-plan conversion check in `SKILL.md` Route Examples.
- `审查这个方案有没有问题` -> use a review skill; re-plan only if asked.

### Chinese Output Labels

For Chinese requests, use Chinese prose and section labels. Keep code identifiers, commands, paths, status tokens, and quoted source text unchanged.

| English label | Chinese label |
|---|---|
| Mode | 模式 |
| Depth | 深度 |
| Input sources | 输入来源 |
| Recommendation | 建议 |
| Current-best path | 当前最佳路径 |
| Bestness Check | 最佳性检查 |
| Coverage map | 覆盖映射 |
| Value Gate | 价值门禁 |
| Decision Envelope | 决策信封 |
| Scope table | 范围与成本 |
| Next verification step | 下一步验证 |
| Root problem | 根问题 |
| True constraints | 真实约束 |
| Assumptions | 假设 |
| Closest alternative | 最接近替代方案 |
| Failure mode | 失败条件 |
| Open questions | 开放问题 |

## Problem Archaeology

### Root Trace

Use Five Whys only when the request is a single solution-shaped statement.

Example:

```text
Stated: "We need to migrate from X to Y"
Why?   -> "X cannot handle our scale"
Why?   -> "X assumes single-tenant architecture"
Why?   -> "X was chosen when we were single-tenant"
Root:  architectural mismatch with current scale, not migration itself
```

For complex systems, prefer multiple traces:

| Trace | Question |
|---|---|
| Business/user outcome | Who is harmed, and what outcome must improve? |
| Technical constraint | What must be true because of architecture, data, API, or runtime? |
| Historical convention | What are we preserving only because it already exists? |
| Operational/release constraint | What must stay safe because of rollout, ownership, compliance, or support? |

Each trace must end in one of:

- **True constraint**: external contract, physical limit, legal/risk boundary
- **Convention**: changeable habit, legacy decision, local preference
- **Unverified assumption**: claim that must be checked before it bears weight

### Problem Statement

Write the problem in outcome terms:

- Undesirable state, without naming a solution
- Who is affected and how
- What "solved" looks like, measured by outcome rather than mechanism

Bad: "We need to add caching to the API."

Good: "Dashboard P95 response time exceeds 2s, causing user drop-off. Solved =
P95 below 500ms without sacrificing data freshness."

### Assumption Audit

State only load-bearing assumptions; a short inline account suffices for Light depth. For multiple interacting assumptions, use:

| # | Assumption | Type | If wrong... | Verification |
|---|---|---|---|---|

Focus on load-bearing assumptions only. The dangerous assumptions are the ones
that feel like facts.

Phase gate: if an assumption can change the root problem or eliminate the
recommended approach, verify it before solution design, or ask one focused
question with a recommended default.

## Value Gate And Decision Envelope

Runs after the constraint split, before options are reconstructed or any
tournament is dispatched. The Bestness Check asks which mechanism wins; the
Value Gate asks whether the winner beats the status quo by enough to build at
all.

### Mechanism Families

Consider these families where feasible; compare viable candidates and explain material exclusions. No fixed candidate count is required:

| Family | Typical form |
|---|---|
| Status quo | keep current behavior and accept the current incident rate |
| Existing capability | an already-built feature, configuration, or runbook covers the main value |
| Human/process adaptation | a checklist, manual step, or cadence change |
| Build or change capability | new or modified product/system capability |

### Economic Evidence

Judge from evidence already at hand; avoid broad research just to populate
fields. Weigh:

- how often the problem occurs and how far it reaches;
- the impact or loss per occurrence;
- the expected benefit range of the winning family, with the arithmetic;
- delivery, maintenance, and opportunity cost;
- the single fact that would flip the decision.

When a load-bearing economic fact is unknown and could flip the decision,
set `RESEARCH_FIRST` naming that fact and its check instead of guessing.
The planning workflow performs the scoped check when available and authorized,
then resumes the decision. Return an unresolved research handoff only when the
check cannot be completed within the request; name the blocker.
Judge the build-or-change family at its cheapest credible mechanism — a
proposed expensive design is not the family's floor. When family-level
economics are too close to call, continue to option reconstruction and freeze
the envelope once the winner is known.

### Decision Envelope

For a durable decision handoff, record the outcome in this envelope; a chat
answer may use a compact equivalent. A technical review can proceed without
it. The envelope constrains implementation authorization only when that gate
is explicitly requested.

```yaml
decision: BUILD | DEFER | NO_BUILD | RESEARCH_FIRST
target_outcome: <the outcome the change must move>
baseline_and_frequency: <status-quo behavior and incident rate>
expected_benefit: <range, with the arithmetic behind it>
delivery_and_maintenance_cost: <build + ongoing + opportunity cost>
status_quo_or_existing_mechanism: <the strongest non-build candidate>
decision_flip_condition: <the fact that would change the decision>
review_scope: implementation-authorization | correctness-only
review_budget: <explicit budget, calibrated default, or user-authorized unbounded>
```

- `BUILD`: continue to option reconstruction; the envelope accompanies the
  plan into review.
- `DEFER` / `NO_BUILD`: answer in Decision mode with the envelope and its flip
  condition; plan synthesis and independent tournaments stay unrun.
  `review_scope` and `review_budget` bind only under `decision: BUILD`; for
  any other decision write `n/a` — a later technical review
  defaults to correctness-only and sets its own budget at entry.
- `RESEARCH_FIRST`: name the missing fact and the check that resolves it.
- A user who has already committed to building is the decision source: record
  `decision: BUILD` and choose the mechanism rather than re-litigating a
  settled choice.

The same shape fits divergent domains: an incident arriving a few times a year
with a mature manual runbook rarely beats `DEFER` against a multi-day build,
while a defect stream causing frequent unrecoverable loss with no safe manual
containment usually resolves to `BUILD`.

## Solution Reconstruction

### Option Categories

Enumerate at least two fundamentally different approaches when possible.
Differences must be in mechanism or responsibility allocation, not just params.

For each approach:

- Mechanism: how it solves the root problem
- Conditions that favor it
- Failure mode, cost, or risk
- Evidence that supports or weakens it

If only one approach is viable, explain why alternatives fail.

### Independent Context

An independent context is a fresh-context subagent where the runtime supports
one, and a separate fresh session otherwise. It receives only the inputs its
task names — never the authoring context's reasoning. Prefer a different
model's runtime when one is available: same-model contexts share blind spots.

### Independent Option Tournament

Replaces the lightweight in-context tournament for the runs that pass the
escalation gate in `SKILL.md` step 5 (the gate's single source of truth); the
in-context version stays the default.

Options drafted in one context anchor on the first idea; independent drafts buy
real mechanism diversity. Two biases must be closed by construction: same-model
drafters converge unless each is assigned a different mechanism family, and the
judge favors its own prior unless the rubric is fixed before any draft exists.

1. **Prepare in the main context**: finish the root trace and constraint
   split; write the problem statement and the full constraint split (true
   constraints, conventions, unverified assumptions). Drafters start with no
   other context — step 4 lists everything they receive.
2. **Pre-register the rubric**: write the Bestness Check fit criteria before
   any draft exists. They are the judging rubric and stay fixed.
3. **Assign mechanism families**: enumerate fundamentally different mechanism
   families (per Option Categories) and assign one per drafter, each an
   [independent context](#independent-context).
4. **Collect option cards**: each drafter receives the problem statement, the
   constraint split, and its assigned family, and returns an option card —
   mechanism, conditions that favor it, failure mode/cost/risk, supporting
   evidence. A card, not a full plan, so candidates stay comparable and cheap
   to judge.
5. **Judge in the main context** against the pre-registered criteria only. A
   criterion discovered mid-judging never decides in place: add it through a
   recorded rubric amendment with its reason, re-judge every card against the
   amended rubric, and name the amendment in the report. Run the
   [inversion test](#inversion-test) on the winner: the main context rules on whether each failure is
   mitigable, and may hand failure-hypothesis generation to one red team in an
   [independent context](#independent-context) (input: problem statement,
   constraint split, winning card) — the context that crowned the winner is
   the least motivated to break it.
6. **Report** the winner through the normal recommendation chain and Bestness
   Check, naming the strongest losing card as the closest alternative.

This escalation diversifies option *generation*. Reviewing an already-drafted
plan belongs to a review skill, not to more tournament rounds.

### Inversion Test

For the leading candidate (the option tournament's winner), ask both
questions:

> Under what conditions would this be the worst approach?

If the failure is plausible and unmitigated, reconsider.

> Of the problem this option claims to solve, what remains after it lands?

An option can survive the failure question while solving only a slice of its
claimed problem. Measure the remainder against the claimed problem's own
definition — the source item's definition when a coverage map exists, the
root problem statement otherwise — never a restatement narrowed during
planning. A remainder that hollows out a coverage-map row or the
recommendation's core claim reopens the choice; any smaller remainder is
written into the recommendation as residual scope or a named non-goal.

Skip only for Light depth or obvious low-risk decisions.

### Recommendation Chain

Recommend the approach that best satisfies:

- Root problem solved
- True constraints satisfied
- Conventions changed only with clear value
- Primary risk mitigated

If the root differs from the user's framing, reframe explicitly. If the root
confirms their instinct, validate it with evidence.

### Bestness Check

Use this for any non-trivial planner recommendation: the default deliverable is
the current-best option under stated constraints, even when the user only asks
for a plan. Best/better wording and repeated localized improvement challenges make the gate
stricter, not newly active. The goal is to prevent a sequence of slightly better
answers by making the stopping rule explicit in the first response.

Answer these five checks compactly:

| Check | Question |
|---|---|
| Fit criteria | Which load-bearing constraints decide "best" for this problem? |
| Winner | Which mechanism wins against those criteria, and why? |
| Closest alternative | What is the strongest competing mechanism? |
| Defeat condition | What new fact would make the closest alternative better? |
| Marginal-gain stop | What further improvement would be too small, too costly, or not decision-relevant? |

If the answer changed since the previous recommendation, name the new criterion
or evidence that changed it. If it did not change, say "current best under these
constraints" and give the next verification step instead of inventing a new
variant.

### Dissenting Path

When recommending against the user's stated approach, also provide:

- Conditions that would justify their approach
- A concrete "if you still want to proceed" path

The goal is an informed decision, not a veto.

## Plan Synthesis

For Plan mode, make the plan specific enough to price and falsify the
decision:

- What changes, including likely files/modules when known
- Effort ranges tied to identifiable work and explicit assumptions; mark unknowns instead of inventing numerical precision
- Code examples only when the mechanism is non-obvious

The plan names its next verification step: the cheapest check that could flip
the decision or reshape the chosen mechanism — a fact to confirm, a log to
read, a measurement to run; a thin spike only when nothing cheaper can
falsify it, with its flip condition stated before it runs.

A BUILD plan also names its acceptance oracle: the observable outcome that
proves the target outcome, plus the boundary or failure path that matters —
stated as observations to make, not as a task breakdown. Order-sensitive
hazards (a change that must land before another to stay safe) are named as
constraints; task-level slicing and sequencing belong to the implementing
session.

For a material investment decision, price it in a scope table; for a bounded implementation choice, a short account of changed responsibilities, dependencies, transition, and acceptance is sufficient. When pricing, rows are the scope components the
decision buys — core (the decision stands on it), supporting (evidence,
observability, closure), optional (separately decidable, excluded from the
total) — not steps in an execution order. Every acceptance-oracle obligation,
named hazard, and true-constraint closure appears as a priced core or
supporting row; optional holds only work whose omission leaves the target
outcome intact. Within a tier, choose and trim by value against risk; moving
a component between tiers reprices the total. The total row finalizes the
delivery component of the envelope's `delivery_and_maintenance_cost` —
ongoing maintenance and opportunity cost are priced beside it in that field —
and a total that materially worsens the Value Gate's economics sends the plan
back through the gate, not onward to review:

| Scope | Component | Effort | Risk | Value |
|---|---|---:|---|---|
| **Total (core + supporting)** | | sum | | |

Put analysis after the decision content — recommendation, decision, oracle,
and next check lead within the first 20 lines; do not repeat the same
reasoning in both.

## Evidence Conventions

- `verified`: source evidence whose identity and relevant version/environment have been established, including still-applicable prior receipts.
- `? unverified`: recalled, inferred, or not checked.
- Quantify feasibility, scale, and effort where possible.
- Present tradeoffs honestly. Do not force a pick when constraints do not
  support one.

## Artifact Location

For saved Markdown artifacts:

1. Use the user-provided path when present.
2. Else use the target workspace's existing docs taxonomy when one exists,
   matching the artifact's type rather than the skill name.
3. Else create and use a type-specific directory under the target workspace:
   `docs/plans/` for implementation/architecture plans, or `docs/decisions/`
   for explicitly saved decision/tradeoff memos.
4. Else use the environment's designated user-facing output directory when one
   exists.
5. Else use the OS temp directory and return the full path, explicitly noting
   why no workspace docs location was available.

Do not write into ADRs, issue files, memory files, or canonical project docs by
default. Planner artifacts belong in clearly labeled planning or decision areas
such as `docs/plans/` or `docs/decisions/`; use canonical repo locations only
when the user asks to persist the artifact there or provides a target path.

Name saved planner artifacts with `YYYY-MM-DD-topic.md` by default. Prefer
updating the same file for the same topic on the same day; add `-2` or `-HHmm`
only when multiple same-day artifacts must coexist, preferring `-HHmm` for
time-sensitive snapshots such as runtime/current-state checks. Do not add
dates to canonical docs such as `CONTEXT.md`, ADRs, or project profiles.

## Plan File Output

When saving a plan:

1. Write/update the artifact first.
2. Put TL;DR and action plan near the top.
3. Put problem archaeology and tradeoff analysis after the actionable plan.
4. Chat response gives only summary, path, and unresolved risks.
