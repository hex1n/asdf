---
name: converge
description: >
  Plan convergence for explicit or high-risk unresolved decisions. Use when the
  user asks to compare options, first-principles plan, 最佳方案, 先给方案,
  先不写代码, or when irreversible/high-risk work needs falsification before
  implementation.
argument-hint: "[problem, decision, or plan to converge]"
---

# Converge

Converge produces a decision-ready plan. It does not edit files or implement the
plan unless the user later gives explicit landing approval.

Read `../workflow-core/REFERENCE.md` only when the plan needs loop terminal
states, evidence, or handoff fields.

## Workflow

### 1. Confirm The Boundary

Use this skill only for explicit planning, unresolved mechanism choices, or
irreversible/high-risk decisions. If the user already approved a plan, do not
return here unless new blocking evidence appears or the user asks to reconsider.

Completion criterion: the output is clearly planning-only or the task is routed
to `land`.

### 2. Reframe From First Principles

Use `first-principles-planner` when available. State the root problem, true
constraints, assumptions, at least two mechanisms, current-best option, failure
mode, and what would change the recommendation.

Completion criterion: the recommendation is tied to constraints rather than to
the first proposed solution.

### 3. Falsify

Inspect prior rework notes when present. Use independent read-only subagents for
the most likely failure perspectives when the runtime supports them; otherwise
record the downgrade and perform focused read-only checks. For high-risk or
cross-module decisions, cover coherence, feasibility, scope, and adversarial
counterexamples.

Completion criterion: only evidence-backed objections change the plan.

### 4. Stop Converging

Stop when two consecutive rounds produce no material change, the decision is
small enough for direct numbered options, or a blocker prevents further
falsification.

Completion criterion: the plan is stable enough for the user to choose.

### 5. Present Choices

Return two or three numbered options, a clear recommendation, each option's
failure mode, and the condition that would overturn the recommendation. Wait for
the user's approval before implementation.

Completion criterion: the user can reply with a number or explicit approval and
the next agent can land without reopening planning.
