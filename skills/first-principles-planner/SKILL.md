---
name: first-principles-planner
description: >
  Creates first-principles recommendations and plans: reframes the root
  problem, separates constraints from assumptions, compares mechanisms, and
  returns the current-best path with failure conditions and next verification
  steps. Use for a best/better plan, implementation strategy, or design
  direction (最佳方案, 还有更好, 优化方案, 架构演进), plan-first / no-coding
  asks (先写方案, 先不写代码,
  先不coding), adopt/replace/tradeoff decisions (是否应该, 取舍), converging
  or falsifying competing options or an unresolved decision (收敛方案,
  方案选型, 多方案对比/证伪), deciding whether something is worth building or
  worth doing now (ROI, 值不值得做, 现在要不要做), and 第一性原理 asks. Do
  not use for pure fact-finding research, live bug diagnosis, implementation,
  code review, reviewing or falsifying one existing plan (计划评审, 方案评审
  — use plan-review), durable ADR/CONTEXT capture, or skill-writing audits
  unless the user explicitly asks to re-plan from first principles.
---

# First-Principles Planner

## Core Move

Plan from the root problem, not from the user's first proposed solution. A planner recommendation should be the current-best path under stated constraints, not the first viable path. Before recommending anything, separate true constraints, conventions, and unverified assumptions.

## Routing Gate

Choose the route before work:

- **Planner**: strategic plan, design direction, architecture evolution, improvement proposal, technology tradeoff, or "best/better solution" request.
- **Research-first**: pure fact-finding requests, including localized investigation phrases in [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules), "investigate", "trace", or "figure out why". If the prompt also includes localized best-plan or no-coding planning signals from that reference, gather facts first, then return to planner mode.
- **Review/critique**: plan review, document review, or any localized review phrase from [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules) belongs to a review skill. Use this skill only if the user asks to re-plan from first principles.
- **No full planner**: implementation, testing, approval, durable ADR/CONTEXT capture, or narrow code-change tasks unless the user says to plan first.

If running as a subagent, use the full planner only for delegated planning, architecture, strategy, or proposal synthesis. Implementation, testing, review, approval, and narrow research subagents should use at most a short assumption check.

## Hard Gates

- If the stated solution is not tied to an outcome, rewrite the problem statement before comparing options.
- If a load-bearing unknown could change the recommendation, verify it or ask one focused question with a recommended default; do not stop at clarification when a safe default exists — state the default, give the current-best path under that default, and name the fact that would flip the recommendation.
- If the plan has no independently verifiable next step, shrink it to a decision plus its first check.
- **Artifact Gate:** use a chat-first plan by default. Do not create durable artifacts unless explicitly asked, a target path is provided, or the result is a reusable handoff into named next work; then use [REFERENCE.md](REFERENCE.md#artifact-location).
- Saved plans use `docs/plans/` by default; saved decision/tradeoff memos use `docs/decisions/` by default. Chat-only plans still name where an artifact would go if requested.

## Output Mode

Use the user's language for chat and saved artifacts; for localized fixed labels, use [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules). For Standard or deeper work, state `Mode`, `Depth`, and input sources actually read in this session, then front-load the recommendation: current-best path, compressed Bestness Check, and next verification step before archaeology. For Light decisions, keep the first line compact. Do not add external sources just to make a plan look researched.

| Mode | Use when | Shape |
|---|---|---|
| Decision | The user asks whether to choose, keep, replace, or improve a path, or challenges the current best. | 10-20 lines: recommendation, why, when wrong, next step; include a compressed **Bestness Check** for non-trivial recommendations |
| Plan | The user asks for a best/better plan, implementation strategy, architecture or design direction, or explicitly avoids coding while choosing a path. | Chat-first plan by default; save only through the Artifact Gate; put the Bestness Check near the top for non-trivial recommendations |

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
4. **Value Gate**: decide whether the winner is worth building before designing it. Compare at least four mechanism families as real candidates — keep the status quo, use an existing capability, adapt the human/process workflow, build or change system capability — and judge net gain over the status quo from evidence already at hand: frequency and blast radius, per-incident impact, expected benefit range, delivery plus maintenance plus opportunity cost, and the fact that would flip the decision. Judge the build family at its cheapest credible mechanism, not the user's proposed one; when family-level economics are too close to call, continue to step 5 and settle the decision once the winner is known. Freeze the outcome as a Decision Envelope ([REFERENCE.md](REFERENCE.md#value-gate-and-decision-envelope)) with one decision: `BUILD`, `DEFER`, `NO_BUILD`, or `RESEARCH_FIRST`. `BUILD` continues to step 5; `RESEARCH_FIRST` names the missing decision-flipping fact and routes to research; `DEFER` or `NO_BUILD` ends the run as a compact Decision-mode answer carrying the envelope — plan synthesis and independent option tournaments stay unrun. When the user has already committed to building and asks only how, record `decision: BUILD` with the user as its source and continue. A `BUILD` envelope's cost is provisional until the scope table prices it in step 8; a priced total that materially worsens the gate's economics reruns this gate before any handoff.
5. **Reconstruct options**: compare fundamentally different mechanisms by fit, failure mode, cost, and risk. When 3+ options remain or impact is high, run a lightweight option tournament: compare options pairwise against true constraints, drop weaker or duplicate mechanisms, then test the winner against its strongest failure mode (the inversion test in [REFERENCE.md](REFERENCE.md#inversion-test)). For a Deep-depth decision whose wrong choice would be costly to reverse, or when the user explicitly asks for independently drafted options, run the independent option tournament in [REFERENCE.md](REFERENCE.md#independent-option-tournament) instead.
6. **Recommend**: pick the approach that solves the root under true constraints after the inversion test (skip it only for Light depth or obvious low-risk decisions); if rejecting the user's approach, include what would justify it.
7. **Bestness Check**: for non-trivial recommendations, including the first response, state the fit criteria, winner, closest alternative, what would beat it, and the marginal-gain stop point. The stop point is enforceable and ends option refinement only: once further selection work cannot change the Value Gate decision, the winning mechanism, or the next verification step, stop comparing mechanisms and complete the plan's required content (rollback, permissions, migration safety, acceptance evidence) for the chosen path. Details: [REFERENCE.md](REFERENCE.md#bestness-check).
8. **Synthesize**: make Plan outputs specific enough to predict what changes and why.

For Plan mode, Deep plans, or ambiguous tradeoffs, read [REFERENCE.md](REFERENCE.md) before writing the final answer.

## Route Examples

- `Should we replace X?` / `Is there a better path?` -> Decision.
- `Plan first; do not change code yet` / `Give an implementation strategy` -> Plan.
- `Deeply analyze why X fails` -> Research-first; plan only if the user asks for a fix path.
- `Review this plan` -> use a review skill; re-plan only if asked.
- Localized route examples live in [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules).

## Acceptance Gate

Before final answer, ensure the root problem is named, true constraints are separated from assumptions, at least two mechanisms are compared or one viable path is justified, and the recommendation includes its failure mode plus the next verifiable step. When the request proposes new or changed capability, the answer carries the Value Gate decision and its flip condition. For non-trivial recommendations, include the Bestness Check in the first answer or explain why the decision is low-risk enough to skip it; if any question remains, pair it with the default path and what would change the recommendation.

## Anti-Patterns

- Treating "use solution X" as the problem statement.
- Writing a large plan for a small decision.
- Treating technical bestness as build authorization: synthesizing or reviewing a plan whose Value Gate decision is `DEFER` or `NO_BUILD`.
- Re-running research inside planner instead of invoking/using research.
- Using planner as a plan-review or code-review skill.
- Turning a plan into ADR/CONTEXT memory without the user asking.
- Letting implementation subagents inherit a full planning workflow.
- Being contrarian for novelty; first principles means grounding, not automatic disagreement.
