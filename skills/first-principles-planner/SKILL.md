---
name: first-principles-planner
description: >
  Creates first-principles recommendations and plans by reframing the root
  problem, separating constraints from assumptions, comparing mechanisms, and
  returning the current-best path with failure conditions and next verification
  steps. Use when the user asks for a best/better plan, architecture or design
  direction, implementation strategy, tradeoff/adopt/replace/upgrade decision,
  or explicitly avoids coding while choosing a path; examples include 第一性原理,
  最佳方案, 最佳实现, 给出方案, 先写方案, 先不写代码, 先不要写代码,
  先不coding, 不coding, 不要直接改代码, 还有更好, 是否应该, 最佳了吗, 取舍,
  架构演进, and 优化方案. Do not use for pure fact-finding research, live bug
  diagnosis, implementation, code/plan review, 计划评审, 方案评审, 审查计划,
  审查方案, durable ADR/CONTEXT capture, or skill-writing audits unless the user
  explicitly asks to re-plan from first principles.
---

# First-Principles Planner

## Core Move

Plan from the root problem, not from the user's first proposed solution. A planner recommendation should be the current-best path under stated constraints, not the first viable path. Before recommending anything, separate true constraints, conventions, and unverified assumptions.

## Routing Gate

Choose the route before work:

- **Planner**: strategic plan, design direction, architecture evolution, improvement proposal, technology tradeoff, or "best/better solution" request.
- **Research-first**: pure fact-finding requests such as `深度分析`, `排查`, `定位`, `为什么`, `根因`, `掌握链路`, "investigate", "trace", or "figure out why". If the prompt also asks for `最佳方案`, `第一性原理`, `给出方案`, or `先不写代码`, gather facts first, then return to planner mode.
- **Review/critique**: plan review, document review, or "看看这个计划有没有问题" belongs to a review skill. Use this skill only if the user asks to re-plan from first principles.
- **No full planner**: implementation, testing, approval, durable ADR/CONTEXT capture, or narrow code-change tasks unless the user says to plan first.

If running as a subagent, use the full planner only for delegated planning, architecture, strategy, or proposal synthesis. Implementation, testing, review, approval, and narrow research subagents should use at most a short assumption check.

## Hard Gates

- If the stated solution is not tied to an outcome, rewrite the problem statement before comparing options.
- If a load-bearing unknown could change the recommendation, verify it or ask one focused question with a recommended default; do not stop at clarification when a safe default exists — state the default, give the current-best path under that default, and name the fact that would flip the recommendation.
- If the plan has no independently verifiable next step, shrink it to a vertical slice or a decision.
- **Artifact Gate:** use a chat-first plan by default. Do not create durable artifacts unless explicitly asked, a target path is provided, or the result is a reusable handoff into named next work; then use [REFERENCE.md](REFERENCE.md#artifact-location).
- Saved plans use `docs/plans/` by default; saved decision/tradeoff memos use `docs/decisions/` by default. Chat-only plans still name where an artifact would go if requested.

## Output Mode

Use the user's language for chat and saved artifacts. For Standard or deeper work, state `Mode`, `Depth`, and input sources actually read in this session, then front-load the recommendation: current-best path, compressed Bestness Check, and next verification step before archaeology. For Light decisions, keep the first line compact. Do not add external sources just to make a plan look researched.

| Mode | Use when | Shape |
|---|---|---|
| Decision | The user asks whether to choose, keep, replace, or improve a path, or challenges the current best: "还有更好?", "是否应该?", "最佳了吗?" | 10-20 lines: recommendation, why, when wrong, next step; include a compressed **Bestness Check** for non-trivial recommendations |
| Plan | The user asks for a best/better plan, implementation strategy, architecture or design direction, or explicitly avoids coding while choosing a path: "最佳方案", "最佳实现", "给出方案", "先不写代码" | Chat-first plan by default; save only through the Artifact Gate; put the Bestness Check near the top for non-trivial recommendations |

## Depth

| Signal | Depth |
|---|---|
| Narrow, well-understood choice | Light |
| Multiple viable approaches | Standard |
| User states a solution, not the problem | Standard+ (Standard with a mandatory root reframe) |
| Recurring/stuck/conventional problem | Deep |
| Any current-best recommendation with non-obvious tradeoffs | Deep |

## Process

1. **Preflight**: gather only context needed for the selected mode; list load-bearing unknowns and research any unknown that could change the root.
2. **Root trace**: use Five Whys for a single solution-shaped statement; for systems, trace business/user, technical, historical, and operational roots.
3. **Constraint split**: classify load-bearing factors as true constraints, conventions, or unverified assumptions.
4. **Reconstruct options**: compare fundamentally different mechanisms by fit, failure mode, cost, and risk. When 3+ options remain or impact is high, run a lightweight option tournament: compare options pairwise against true constraints, drop weaker or duplicate mechanisms, then test the winner against its strongest failure mode (the inversion test in [REFERENCE.md](REFERENCE.md#inversion-test)).
5. **Recommend**: pick the approach that solves the root under true constraints after the inversion test (skip it only for Light depth or obvious low-risk decisions); if rejecting the user's approach, include what would justify it.
6. **Bestness Check**: for non-trivial recommendations, including the first response, state the fit criteria, winner, closest alternative, what would beat it, and the marginal-gain stop point. Details: [REFERENCE.md](REFERENCE.md#bestness-check).
7. **Synthesize**: make Plan outputs specific enough to predict what changes, in what order, and why.

For Plan mode, Deep plans, or ambiguous tradeoffs, read [REFERENCE.md](REFERENCE.md) before writing the final answer.

## Route Examples

- `是否应该替换 X?` / `还有更好的吗?` / `最佳了吗?` -> Decision.
- `先不写代码，给最佳方案` / `给一个架构演进方案` -> Plan.
- `深度分析为什么失败` -> Research-first; plan only if the user asks for a fix path.
- `审查这个方案有没有问题` -> use a review skill; re-plan only if asked.

## Acceptance Gate

Before final answer, ensure the root problem is named, true constraints are separated from assumptions, at least two mechanisms are compared or one viable path is justified, and the recommendation includes its failure mode plus the next verifiable step. For non-trivial recommendations, include the Bestness Check in the first answer or explain why the decision is low-risk enough to skip it; if any question remains, pair it with the default path and what would change the recommendation.

## Anti-Patterns

- Treating "use solution X" as the problem statement.
- Writing a large plan for a small decision.
- Re-running research inside planner instead of invoking/using research.
- Using planner as a plan-review or code-review skill.
- Turning a plan into ADR/CONTEXT memory without the user asking.
- Letting implementation subagents inherit a full planning workflow.
- Being contrarian for novelty; first principles means grounding, not automatic disagreement.
