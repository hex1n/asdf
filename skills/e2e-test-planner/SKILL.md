---
name: e2e-test-planner
description: >
  Creates source-backed E2E test plans organized as business scenario trees, separating intended business contracts from current implementation evidence and tracing change blast radius across affected flows. Use when the user asks for an end-to-end, full-chain, integration, acceptance, or regression test plan or test scenarios from requirements, designs, decisions, or codebase changes. Do not use to run an existing plan or concrete scenario; use e2e-test-executor for execution.
---

# E2E Test Planner

Write the plan as a business scenario tree. The tree is the single home for scenarios: one primary Happy Path first, then branches attached to the business step or decision they vary, each with its expected result.

Use the user's language unless explicitly asked otherwise. Preserve identifiers, paths, API names, enum values, commands, and quoted source text exactly.

Read [REFERENCE.md](REFERENCE.md) before drafting; it defines the plan shape and leaf contract.

## 1. Frame the Business Outcome

State:

- The actor, legitimate entry, intended business outcome, and observable completion state.
- The requested scope and explicit non-goals.
- The source that defines the intended result and who approved it.
- The implementation evidence that shows current behavior, reachability, and risk.
- Any conflict or missing authority that prevents a correctness verdict.

Keep these evidence roles separate:

- **Expected-result authority** defines what should happen: explicit user direction, an approved requirement, design, decision, business policy, or published external contract.
- **Implementation evidence** shows what currently happens: code, configuration, schemas, existing tests, and logs.
- **Runtime evidence** shows what happened in one observed execution.

Code and existing tests do not prove business correctness merely because they agree. They may define a verdict only when the user or an approved source explicitly designates them as the contract. If only implementation evidence exists, write a current-behavior characterization, mark the intended result `NEEDS-DECISION`, and do not turn implementation agreement into a pass condition. If sources conflict, name the selected expected-result authority and its approval basis; when that choice is not established, keep the semantic unresolved.

For a bounded change, plan the changed branch and every affected business flow in its blast radius. For a broad feature, cover the full business outcome.

Completion criterion: the plan names one testable outcome, its expected-result authority, its implementation evidence, and the surfaces deliberately excluded. Every later business rule points to an approved authority or is marked `NEEDS-DECISION`.

## 2. Trace the Change Blast Radius

For a change-scoped request, resolve the actual change set before drafting scenarios. Translate changed files and lines into changed contracts: business rules, state transitions, data meaning or schema, API or event payloads, permissions, ordering, idempotency, timing, and external effects.

Then trace outward:

`changed artifact -> changed contract/state/data -> writers, readers, callers, and subscribers -> affected business flows -> observable outcomes`

Inspect direct callers and also alternate entry points, shared readers, scheduled or async work, callbacks, retries, recovery, administrative operations, reports, compatibility paths, and flows that compete for the same state. Treat code as reachability evidence here, not as proof that the reached behavior is correct.

Add every materially affected flow to the plan:

- Put the changed flow under its normal business branch.
- Put preservation checks for other flows under their own regression branches or business roots.
- Attach shared-state and concurrency cases to the earliest transition where the flows can interfere.
- If a possible impact cannot be resolved, keep it as `NEEDS-DECISION`, `BLOCKED`, or `OUT-OF-SCOPE` with evidence; do not silently omit it.

Completion criterion: every changed contract maps to a direct scenario leaf, and every affected flow maps to a regression leaf or an explicit disposition. Testing only the changed entry point is incomplete.

## 3. Prove the Business Trunk

Reconstruct the normal business flow before inventing scenarios:

1. Entry and eligibility.
2. Ordered business actions and decisions.
3. State transitions and externally visible effects.
4. Async continuations, callbacks, retries, or scheduled work.
5. The committed outcome.

Give important steps stable IDs such as B1, B2, and B3. Give affected independent flows their own stable prefixes when useful. A small Mermaid flow or ordered table is enough; model business behavior, not internal call stacks.

Select the shortest source-backed route that reaches the normal committed outcome as the Primary Happy Path. A normal positive-outcome tree has exactly one. Other successful routes are alternate branches at the decision where they diverge.

If the requested contract has no meaningful successful route, such as a negative-only rule or verification-only migration, say No source-backed Happy Path and give the reason, then put the canonical verification path first. Never manufacture a positive flow.

Completion criterion: the trunk begins at a legitimate entry, ends at an observable committed outcome, and every transition has separate expected-result authority and implementation evidence, or an explicit unresolved disposition.

## 4. Grow the Business Scenario Tree

Use one Business Scenario Tree section. Represent hierarchy with nested headings from outcome to business branch to scenario leaf. Keep the scenario fields directly beneath their leaf; do not create a separate scenario inventory, group summary, or detached detailed-scenario section.

Order each normal tree as:

1. Primary Happy Path.
2. Blast-radius regression branches that prove other affected business flows still reach their intended outcomes.
3. Alternate valid routes at their divergence point.
4. Input, rule, state, and permission branches under the earliest affected business step.
5. Dependency failure, timeout, partial success, rollback, recovery, retry, idempotency, and concurrency branches under the step they disturb.
6. Cross-cutting performance or operability branches only when they span several steps and have an approved acceptance threshold.

The business flow supplies branch names. Labels such as boundary, concurrency, recovery, or performance classify leaves; they do not replace business stages as the tree's top-level structure.

Every leaf follows the contract in [REFERENCE.md](REFERENCE.md#scenario-leaf-contract). In particular:

- Expected Results is mandatory and observable.
- Expected Authority names the approved source for every verdict assertion.
- Implementation Evidence names the code, test, schema, or runtime path that made the scenario necessary.
- An unstated or implementation-only behavior becomes `NEEDS-DECISION` plus a non-verdict observation; it is never silently promoted to a pass condition.
- The leaf names every business step it covers.

Put shared preconditions at the nearest common branch and repeat only leaf-specific differences. Large trees stay readable by factoring shared context upward, not by moving leaves into a flat matrix.

Completion criterion: the first ordinary branch is the complete Happy Path; every other leaf is reachable through a named business or blast-radius branch; every verdict has an approved expected authority; every business step, changed contract, affected flow, state transition, and material failure is covered by a leaf or an explicit disposition.

## 5. Close Coverage

End with:

- A compact coverage map from requirements, business-step IDs, changed contracts, and affected flows to scenario leaf IDs.
- Gaps and Decisions, with each unresolved item marked `NEEDS-DECISION`, `ASSUMED`, `BLOCKED`, or `OUT-OF-SCOPE`.
- The smallest first test slice. For a normal positive-outcome plan, start with the Primary Happy Path, then add the highest-risk branches needed by the request.

Use `ASSUMED` only for a temporary premise explicitly accepted by the user or responsible decision owner, and name that acceptance. Unknown approval status is `NEEDS-DECISION`, not `ASSUMED`.

Coverage is a reconciliation aid, not a second scenario catalog. It contains IDs and dispositions only; scenario meaning remains in the tree.

Completion criterion: every approved rule, trunk step, changed contract, and affected flow maps to at least one leaf; every uncovered item has an explicit disposition; no new scenario is introduced outside the tree.

## Deliverable

Use this top-level order:

1. Overview
2. Sources and Business Flow
3. Business Scenario Tree
4. Coverage and Gaps

Save a requested repository artifact under docs/e2e-test/{feature}/{date}-{feature}-e2e-test-plan.md unless the user gives another path. Do not execute tests or write test code unless the user asks.
