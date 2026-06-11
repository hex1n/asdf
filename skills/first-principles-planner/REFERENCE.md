# First-Principles Planner Reference

Read this file for Plan mode, Deep plans, ambiguous tradeoffs, or when the
short process in `SKILL.md` is not enough.

## Contents

- Problem Archaeology: root trace, problem statement, assumption audit
- Solution Reconstruction: option categories, inversion test, recommendation chain
- Plan Synthesis: priority table, effort/risk/value, action-first structure
- Evidence Conventions: verified vs unverified claims
- Artifact Location: default path rules for saved Markdown plans
- Plan File Output: saved plan output shape

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

For Light depth, list 3-5 assumptions inline. For Standard/Deep, use:

| # | Assumption | Type | If wrong... | Verification |
|---|---|---|---|---|

Focus on load-bearing assumptions only. The dangerous assumptions are the ones
that feel like facts.

Phase gate: if an assumption can change the root problem or eliminate the
recommended approach, verify it before solution design, or ask one focused
question with a recommended default.

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

### Inversion Test

For the leading candidate (the option tournament's winner), ask:

> Under what conditions would this be the worst approach?

If the failure is plausible and unmitigated, reconsider. Skip only for Light
depth or obvious low-risk decisions.

### Recommendation Chain

Recommend the approach that best satisfies:

- Root problem solved
- True constraints satisfied
- Conventions changed only with clear value
- Primary risk mitigated

If the root differs from the user's framing, reframe explicitly. If the root
confirms their instinct, validate it with evidence.

### Dissenting Path

When recommending against the user's stated approach, also provide:

- Conditions that would justify their approach
- A concrete "if you still want to proceed" path

The goal is an informed decision, not a veto.

## Plan Synthesis

For Plan mode, make the plan operationally specific:

- What changes, including likely files/modules when known
- Effort estimate with arithmetic, not vague size words
- Priority by value/risk ratio
- Dependencies and sequencing
- Code examples only when the mechanism is non-obvious

Prefer independently verifiable vertical slices over layer-by-layer work. A
slice should prove one user/system outcome end to end, even if thin. Avoid
plans that say "DB first, then API, then UI" unless the ordering is forced by a
true dependency. Name how each slice is verified: the outcome to observe, plus
the boundary or failure path that matters when one applies. This is a
verification cue, not a test matrix — skip categories that do not apply.

Use a priority table with a total row:

| Priority | Change | Effort | Risk | Value |
|---|---|---:|---|---|
| **Total** | | sum | | |

Lead with actionable content in the first 20 lines. Put analysis last. Do not
repeat the same reasoning in both action plan and analysis.

## Evidence Conventions

- `verified`: read, fetched, queried, invoked, or ran in this session.
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
