---
name: first-principles-planner
description: >
  Plan or decide from the root problem: compare mechanisms and return the
  current-best path with its failure condition and next check. Use for 最佳方案 /
  方案选型 / 要不要做（ROI） asks, and for a challenge to a recommendation just
  given. Reviewing one existing plan is assayer.
---

# First-Principles Planner

## Core Move

Plan from the root problem, not from the user's first proposed solution. A planner recommendation should be the current-best path under stated constraints, not the first viable path. Before recommending anything, separate true constraints, conventions, and unverified assumptions.

## Routing Gate

Choose the route before work:

- **Planner**: strategic plan, design direction, architecture evolution, improvement proposal, technology tradeoff, or "best/better solution" request.
- **Research-first**: pure fact-finding requests, including localized investigation phrases in [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules), "investigate", "trace", or "figure out why". If the prompt also includes localized best-plan signals from that reference, gather facts first, then return to planner mode.
- **Review/critique**: plan review, document review, or any localized review phrase from [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules) belongs to a review skill. Use this skill only if the user asks to re-plan from first principles.
- **No full planner**: implementation, testing, approval, execution breakdown of an already-converged plan (see Route Examples), durable ADR/CONTEXT capture, or narrow code-change tasks unless the user says to plan first.

If running as a subagent, use the full planner only for delegated planning, architecture, strategy, or proposal synthesis. Implementation, testing, review, approval, and narrow research subagents should use at most a short assumption check.

## Hard Gates

- If the stated solution is not tied to an outcome, rewrite the problem statement before comparing options.
- When the request ties the plan to a source framework — any source with enumerable items to answer, such as an article's claims, an audit's findings, or a review checklist — include a coverage map: every source item resolves to a plan item or a named non-goal, judged against the source item's own definition rather than the plan's restatement of it.
- If a load-bearing unknown could change the recommendation, verify it or ask one focused question with a recommended default; do not stop at clarification when a safe default exists — state the default, give the current-best path under that default, and name the fact that would flip the recommendation.
- If the plan has no independently verifiable next step, shrink it to a decision plus its first check.
- **Artifact Gate:** use a chat-first plan by default. Do not create durable artifacts unless explicitly asked, a target path is provided, or the result is a reusable handoff into named next work; then use [REFERENCE.md](REFERENCE.md#artifact-location).
- Saved plans use `docs/plans/` by default; saved decision/tradeoff memos use `docs/decisions/` by default. Chat-only plans need no hypothetical output path.

## Output Mode

Use the user's language for chat and saved artifacts; for localized fixed labels, use [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules). For Standard or deeper work, front-load the recommendation, decisive evidence, strongest alternative, and next verification step. Mode/depth labels are optional unless the user needs them to understand scope; express the Bestness Check naturally rather than forcing a fixed heading. For Light decisions, keep the first line compact. Do not add external sources just to make a plan look researched.

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
| Consequential uncertainty, difficult reversal, or coupled tradeoffs that a short comparison cannot settle | Deep |
| The request ties the plan to a source framework | Coverage map; depth follows the actual decision risk |

## Process

1. **Preflight**: gather only context needed for the selected mode; list load-bearing unknowns and research any unknown that could change the root.
2. **Root trace**: use Five Whys for a single solution-shaped statement; for systems, trace business/user, technical, historical, and operational roots.
3. **Constraint split**: classify load-bearing factors as true constraints, conventions, or unverified assumptions.
4. **Value Gate**: when whether to build remains open, compare the status quo with credible alternatives: existing capability, process adaptation, and system change where viable. Explain exclusions rather than invent candidates to meet a count. Judge benefit, delivery/maintenance/opportunity cost, and the decision-flipping uncertainty from evidence; mark unsupported estimates. Record `BUILD`, `DEFER`, `NO_BUILD`, or `RESEARCH_FIRST` using the [decision envelope](REFERENCE.md#value-gate-and-decision-envelope) when a durable handoff needs it, or a compact equivalent in chat. `DEFER`/`NO_BUILD` ends investment planning; `RESEARCH_FIRST` resolves the missing fact within the authorized scope. When the user already decided to build, inherit that decision and choose how; reopen it only for new evidence that materially breaks its assumptions.
5. **Reconstruct options**: compare fundamentally different mechanisms by fit, failure mode, cost, and risk. When 3+ options remain or impact is high, run a lightweight option tournament: compare options pairwise against true constraints, drop weaker or duplicate mechanisms, then test the winner against its strongest failure mode (the inversion test in [REFERENCE.md](REFERENCE.md#inversion-test)). For a Deep-depth decision whose wrong choice would be costly to reverse, or when the user explicitly asks for independently drafted options, run the independent option tournament in [REFERENCE.md](REFERENCE.md#independent-option-tournament) instead.
6. **Recommend**: pick the approach that solves the root under true constraints after the inversion test; if rejecting the user's approach, include what would justify it.
7. **Bestness Check**: for non-trivial recommendations, including the first response, answer the five checks in [REFERENCE.md](REFERENCE.md#bestness-check). The stop point is enforceable and ends option refinement only: once further selection work cannot change the Value Gate decision, the winning mechanism, or the next verification step, stop comparing mechanisms and complete the plan's required content (rollback, permissions, migration safety, acceptance evidence) for the chosen path.
8. **Synthesize**: make Plan outputs specific enough to predict what changes and why.

For Plan mode, Deep plans, or ambiguous tradeoffs, read [REFERENCE.md](REFERENCE.md) before writing the final answer.

## Route Examples

- `Should we replace X?` / `Is there a better path?` -> Decision.
- `Plan first; do not change code yet` / `Give an implementation strategy` -> Plan.
- `Deeply analyze why X fails` -> Research-first; plan only if the user asks for a fix path.
- `Turn the plan we converged on into an execution breakdown (slices, phases, tickets)` -> check the facts stated since convergence against the decision's flip conditions — a scan of the conversation, not fresh analysis. A broken assumption, an adverse cost or timeline shift, or an unaccepted doubt fails the check; a doubt is accepted only by naming the risk and choosing to proceed, never by the conversion ask itself. All clear -> hand back for execution shaping. Any hit, no converged plan, or flip conditions no longer visible in this conversation -> run Plan mode.
- `Review this plan` -> use a review skill; re-plan only if asked.
- Localized route examples live in [REFERENCE.md](REFERENCE.md#localized-request-and-output-rules).

## Acceptance Gate

Before final answer, ensure the root problem is named, true constraints are separated from assumptions, at least two mechanisms are compared or one viable path is justified, and the recommendation includes its failure mode plus the next verifiable step. When the request proposes new or changed capability, the answer carries the Value Gate decision and its flip condition. For non-trivial recommendations, include the Bestness Check in the first answer or explain why the decision is low-risk enough to skip it; if any question remains, pair it with the default path and what would change the recommendation. When the plan carries a coverage map, verify it in an independent context ([REFERENCE.md](REFERENCE.md#independent-context)) given only the source material and the final plan.

## Anti-Patterns

- Writing a large plan for a small decision.
- Treating technical bestness as build authorization. A standing `DEFER` or `NO_BUILD` prevents an implementation-authorization handoff; correctness-only review may still inform a later decision.
- Being contrarian for novelty; first principles means grounding, not automatic disagreement.
