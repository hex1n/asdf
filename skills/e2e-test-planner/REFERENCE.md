# E2E Test Planner Reference

## Canonical Plan Shape

# {feature} E2E Test Plan

## Overview

- Business outcome: ...
- Primary Happy Path: HP-001, or No source-backed Happy Path with the reason.
- Scope: ...
- Change set and blast-radius summary: ...
- Coverage criteria: {state graph}, {input space}, {decision logic}
- Highest-risk branches: ...
- Unresolved decisions: ...

## Sources and Models

### Sources

| Source | Evidence role | Authority status | Proven fact |
|---|---|---|---|
| {locator} | {expected authority, implementation evidence, or runtime evidence} | {approved by whom, or not established} | {intended rule or current behavior} |

### Business Flow

| Step | Business action or decision | Committed observable | Expected authority | Implementation evidence |
|---|---|---|---|---|
| B1 | ... | ... | ... | ... |

### Change Blast Radius

| Changed artifact | Changed contract, state, or data | Direct flow | Other affected flows | Modes of each affected flow | Tree roots or branches | Evidence |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

### Input Space

| Characteristic | Blocks | Expected authority | Implementation evidence |
|---|---|---|---|
| {operation, target state, direction, field, bound, subject class, mode} | {block 1; block 2; ...} | ... | ... |

### Decision Logic

| Rule or error code | Condition | Outcome | Judgment order | Expected authority | Implementation evidence |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

### Coverage Criteria

| Model | Criterion | Reason and residual risk |
|---|---|---|
| State graph | ... | ... |
| Input space | ... | ... |
| Decision logic | ... | ... |

## Business Scenario Tree

### Outcome: {observable committed outcome}

#### 1. Primary Happy Path

##### HP-001 {scenario title}

- Priority: P0
- Business Path: {outcome} to Primary Happy Path to {leaf}
- Covers: B1 through Bn
- Requirements: TR-001, ...
- Observes: {committed observable of Bn}
- Oracle: specified, {authority}
- Purpose: ...
- Preconditions: ...
- Actions: ...
- Expected Results:
  - ...
- Expected Authority: ...
- Implementation Evidence: ...

#### 2. {business step or decision}

##### {scenario-id} {scenario title}

- Priority: ...
- Business Path: {outcome} to {branch} to {leaf}
- Covers: ...
- Requirements: ...
- Observes: ...
- Oracle: ...
- Purpose: ...
- Preconditions: ...
- Actions: ...
- Expected Results:
  - ...
- Expected Authority: ...
- Implementation Evidence: ...

## Coverage and Gaps

### Test Requirements

| TR | Model | Criterion | Model row covered | Scenario leaves | Disposition |
|---|---|---|---|---|---|
| TR-001 | ... | ... | ... | ... | covered, infeasible, NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE |

### Gaps and Decisions

| Item | Disposition | Effect on plan |
|---|---|---|
| ... | NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE | ... |

### First Test Slice

1. ...

The heading hierarchy is the tree. Scenario IDs may be referenced by the ledger and gaps, but their definitions appear only below their business branch.

## Scenario Leaf Contract

| Field | Required content |
|---|---|
| Priority | P0, P1, or P2. Default: the Primary Happy Path, its success matrix, and every changed contract's direct leaf are P0; every other model row is P1; cross-cutting branches are P2. Deviate only with a stated reason. |
| Business Path | Outcome to business branch to leaf. |
| Covers | Stable business-step IDs exercised by the leaf. |
| Requirements | Test-requirement IDs the leaf instantiates. |
| Observes | The committed observable, from the Business Flow table, where the leaf's probe reads the outcome — the store, event, or external effect at the end of propagation, never the entry response. |
| Oracle | `specified` (the concrete expected value and its authority) or `derived` (a differential run, replay, invariant, or metamorphic relation, with what it is computed from). A plan never emits `implicit`. |
| Purpose | The rule, risk, or variation this leaf proves. |
| Preconditions | Only the starting state and input facts needed to understand the scenario. |
| Actions | Business actions in order; preserve important inputs and decisions. |
| Expected Results | Observable pass conditions at the relevant user, API, state, data, event, or external-effect level. If authority is missing, state the unresolved decision instead of asserting a verdict. |
| Expected Authority | Exact approved requirement, design, decision, policy, external contract, or explicit user direction that defines each intended result; otherwise `NEEDS-DECISION` and the missing decision owner. |
| Implementation Evidence | Exact code, configuration, schema, existing-test, or runtime locators that show current behavior, reachability, or risk. This field does not establish correctness by itself. |

Shared preconditions may live on the parent branch. A leaf then states only its overrides, but it still owns its actions, expected results, expected authority, and implementation evidence.

## Expected-Result Rules

- Assert outcomes, not implementation activity (propagation). State each data outcome as a concrete value computed from the authority (revealability).
- Cover all committed effects that define the business result. If data, events, external calls, or user-visible state must agree, state each one.
- Include time bounds only when an approved authority supplies a threshold. Otherwise mark the threshold `NEEDS-DECISION`.
- Never derive the intended result solely from the current implementation or from tests that merely encode it. Use those sources to describe current behavior and locate risk.
- Split known and unknown semantics. Known parts remain pass or fail assertions. An unknown part is an Observation with disposition `NEEDS-DECISION`, names the evidence to inspect, and cannot pass.
- A source contradiction is not resolved by wording or execution. Observation can establish what the implementation does; only an approved decision can establish what it should do.

## Disposition Rules

- `NEEDS-DECISION`: no approved expected authority exists, or authorities conflict. The item is non-verdict until the named owner decides it.
- `ASSUMED`: the user or responsible owner explicitly accepted a temporary premise. Name who accepted it and keep the conclusion provisional.
- `BLOCKED`: the intended result is known, but required evidence or a safe test surface is unavailable.
- `OUT-OF-SCOPE`: the user or governing scope explicitly excludes the item; name the boundary and any residual risk.
- `infeasible` (test requirements only): the criterion demands a combination the models rule out; name the constraint.

Do not use `ASSUMED` merely because a document is published, a test passes, or the current implementation is internally consistent.

## Model Rules

State graph:

- One file can affect several contracts; one contract can span several files. Each affected business outcome is its own node; direct-flow coverage does not close an affected neighboring flow.

Input space:

- A bound on an input partitions into a boundary block and an interior block, for every operation the bound governs.
- When a step's outcome or settlement timing differs by subject class (product type, account tier, region), each class with a distinct outcome is its own block, the class named in the leaf title.
- A business mode of an affected flow is a block of that flow's characteristic.

Decision logic:

- Each error code is a rule with its own row; when several rules can fire at once, record the judgment order as a rule.

## Coverage Criteria Defaults

| Model | Default criterion |
|---|---|
| State graph | Every trunk edge, every affected flow, and the producer flow reached by the Primary Happy Path. |
| Input space | All-Combinations up to three characteristics, Pairwise beyond, with the criterion named in the ledger; both blocks of every bound. |
| Decision logic | Every rule and error code with at least one direct assertion; judgment order asserted where rules overlap. |

## Tree Construction Rules

- Attach a leaf to the earliest business decision that makes it different from its parent path.
- Keep exactly one Primary Happy Path for the requested normal outcome. An affected independent outcome gets a preservation-regression branch or root, not a competing Primary Happy Path.
- Place a race under the shared state transition it overlaps; place recovery under the failure state it repairs.
- Use a cross-cutting branch only when no single business step owns the behavior.
- When independent outcomes cannot share a meaningful root, create a business forest. Order roots by the user's named outcome, then source-backed criticality and dependency; state when no default root exists.

## Localized Labels

For Chinese output, use:

| English | Chinese |
|---|---|
| Overview | 概览 |
| Sources and Models | 来源与模型 |
| Business Flow | 业务流程 |
| Change Blast Radius | 变更爆炸半径 |
| Affected Flows | 受影响流程 |
| Modes of each affected flow | 各受影响流程的运行模式 |
| Input Space | 输入空间 |
| Characteristic | 特征 |
| Blocks | 取值块 |
| Decision Logic | 决策逻辑 |
| Judgment order | 判定顺序 |
| Coverage Criteria | 覆盖判据 |
| Business Scenario Tree | 业务场景树 |
| Outcome | 业务结果 |
| Primary Happy Path | 主流程 Happy Path |
| Priority | 优先级 |
| Business Path | 业务路径 |
| Covers | 覆盖步骤 |
| Requirements | 测试需求 |
| Observes | 观察点 |
| Oracle | 判定器 |
| Committed observable | 提交后可观察结果 |
| Purpose | 目的 |
| Preconditions | 前置条件 |
| Actions | 测试动作 |
| Expected Results | 预期结果 |
| Expected Authority | 预期依据 |
| Implementation Evidence | 实现证据 |
| Coverage and Gaps | 覆盖与缺口 |
| Test Requirements | 测试需求清单 |
| Gaps and Decisions | 缺口与决策 |
| First Test Slice | 首轮测试切片 |
