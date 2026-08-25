---
name: e2e-test-planner
description: >
  E2E test plans as business scenario trees, model-driven (input space, state graph, decision logic) and source-backed, with change blast radius. Use when the user asks for an end-to-end, integration, acceptance, or regression test plan or test scenarios from requirements, designs, decisions, or codebase changes. To run an existing plan or scenario use e2e-test-executor.
---

# E2E Test Planner

Write the plan as a business scenario tree. The tree is the single home for scenarios: one primary Happy Path first, then branches attached to the business step or decision they vary, each with its expected result.

Use the user's language unless explicitly asked otherwise. Preserve identifiers, paths, API names, enum values, commands, and quoted source text exactly.

Read [REFERENCE.md](REFERENCE.md) before drafting; it defines the plan shape, model tables, coverage defaults, and leaf contract.

## Principle

A plan is coverage criteria over three models — the **input space**, the **state graph**, and the **decision logic** — with an oracle independent of the implementation on every leaf. Judge every leaf by **RIPR**: it reaches the path, lets a fault infect state, propagates that state to a committed outcome, and reveals it with a concrete expected value.

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

Completion criterion: the plan names one testable outcome, its expected-result authority, its implementation evidence, and the surfaces deliberately excluded. Every later business rule points to an approved authority or is marked `NEEDS-DECISION`.

## 2. Build the Models

Build all three before inventing scenarios. Each row of each model carries separate expected-result authority and implementation evidence, or an explicit unresolved disposition.

### State graph

Reconstruct the normal business flow:

1. Entry and eligibility; when eligibility needs state another flow produces, the trunk starts at that producer flow.
2. Ordered business actions and decisions.
3. State transitions and the committed observable each step leaves — the store, event, or external effect a probe can read.
4. Async continuations, callbacks, retries, or scheduled work.
5. The committed outcome.

Give important steps stable IDs such as B1, B2, and B3. Give affected independent flows their own stable prefixes when useful. A small Mermaid flow or ordered table is enough; model business behavior, not internal call stacks.

Then add the change blast radius. Resolve the change set: for a bounded change it is the diff; for a broad feature it is every shared component, store, or control path the feature reuses, and each existing consumer of those is an affected flow. Translate the change set into changed contracts: business rules, state transitions, data meaning or schema, API or event payloads, permissions, ordering, idempotency, timing, and external effects. Trace propagation outward:

`changed artifact -> changed contract/state/data -> writers, readers, callers, and subscribers -> affected business flows -> observable outcomes`

Inspect direct callers and also alternate entry points, shared readers, scheduled or async work, callbacks, retries, recovery, administrative operations, reports, compatibility paths, and flows that compete for the same state. Treat code as reachability evidence here, not as proof that the reached behavior is correct. If a possible impact cannot be resolved, keep it as `NEEDS-DECISION`, `BLOCKED`, or `OUT-OF-SCOPE` with evidence; do not silently omit it.

### Input space

List every characteristic that varies the outcome and the blocks it partitions into: operation, target state, direction of change, each mutable field, each bound with its boundary and interior blocks, each subject class with a distinct outcome or settlement timing, and each business mode an affected flow runs in.

### Decision logic

List every rule the system decides on: acceptance checks, error codes, judgment order, and the conditions under which each outcome fires.

Completion criterion: the trunk begins at a legitimate entry (reachability) and ends at an observable committed outcome; every changed contract and affected flow is in the state graph; every characteristic that changes an outcome is in the input space; every rule and error code is in the decision logic.

## 3. Choose Coverage Criteria

Name one criterion per model, starting from the [defaults](REFERENCE.md#coverage-criteria-defaults). Weaken a default only with a stated reason and the residual risk.

Completion criterion: each model has a named criterion, and every weakening is written down.

## 4. Derive Test Requirements

Expand each criterion over its model into a numbered test-requirement ledger. Each requirement names its model, its criterion, and the row of the model it covers. Mark an infeasible requirement with the reason instead of deleting it. Merge requirements one leaf can satisfy together and record the merge.

Completion criterion: the ledger is the mechanical expansion of the criteria; every model row appears in at least one requirement or an infeasibility note.

## 5. Instantiate the Scenario Tree

Use one Business Scenario Tree section. Represent hierarchy with nested headings from outcome to business branch to scenario leaf. Keep the scenario fields directly beneath their leaf; do not create a separate scenario inventory, group summary, or detached detailed-scenario section.

Select the shortest source-backed route that reaches the normal committed outcome as the Primary Happy Path. Its Actions execute every trunk step from the first; seeded data stands in only for state no trunk step produces. A normal positive-outcome tree has exactly one. Other successful routes are alternate branches at the decision where they diverge.

If the requested contract has no meaningful successful route, such as a negative-only rule or verification-only migration, say No source-backed Happy Path and give the reason, then put the canonical verification path first. Never manufacture a positive flow.

Order each normal tree as:

1. Primary Happy Path, then the rest of the success matrix in the same branch: one leaf per success-side input-space cell.
2. Blast-radius regression branches that prove other affected business flows still reach their intended outcomes.
3. Alternate valid routes at their divergence point.
4. Input, rule, state, permission, and subject-class branches under the earliest affected business step.
5. Dependency failure, timeout, partial success, rollback, recovery, retry, idempotency, and concurrency branches under the step they disturb.
6. Cross-cutting performance or operability branches only when they span several steps and have an approved acceptance threshold.

The business flow supplies branch names. Labels such as boundary, concurrency, recovery, or performance classify leaves; they do not replace business stages as the tree's top-level structure.

Every leaf follows the contract in [REFERENCE.md](REFERENCE.md#scenario-leaf-contract).

Put shared preconditions at the nearest common branch and repeat only leaf-specific differences. Large trees stay readable by factoring shared context upward, not by moving leaves into a flat matrix.

Completion criterion: the first ordinary branch is the complete Happy Path and its success matrix; every leaf carries its four RIPR fields — Actions (reach), Requirements (infect), Observes (propagate), Oracle with Expected Authority (reveal); every test requirement is instantiated by a leaf or carries an explicit disposition.

## 6. Close Coverage

End with:

- The test-requirement ledger with its leaf column filled: every requirement maps to leaf IDs and a disposition.
- Gaps and Decisions, with each unresolved item marked `NEEDS-DECISION`, `ASSUMED`, `BLOCKED`, or `OUT-OF-SCOPE`.
- The smallest first test slice. For a normal positive-outcome plan, start with the Primary Happy Path, then add the highest-risk branches needed by the request.

Use `ASSUMED` only for a temporary premise explicitly accepted by the user or responsible decision owner, and name that acceptance. Unknown approval status is `NEEDS-DECISION`, not `ASSUMED`.

The ledger is a reconciliation aid, not a second scenario catalog. It contains IDs and dispositions only; scenario meaning remains in the tree.

Completion criterion: every test requirement, approved rule, trunk step, changed contract, and affected flow maps to at least one leaf; every uncovered item has an explicit disposition; no new scenario is introduced outside the tree.

## Deliverable

Use this top-level order:

1. Overview
2. Sources and Models
3. Business Scenario Tree
4. Coverage and Gaps

Save a requested repository artifact under docs/e2e-test/{feature}/{date}-{feature}-e2e-test-plan.md unless the user gives another path. Do not execute tests or write test code unless the user asks.
