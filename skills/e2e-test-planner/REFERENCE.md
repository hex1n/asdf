# E2E Test Planner Reference

## Canonical Plan Shape

# {feature} E2E Test Plan

## Overview

- Business outcome: ...
- Primary Happy Path: HP-001, or No source-backed Happy Path with the reason.
- Scope: ...
- Change set and blast-radius summary: ...
- Highest-risk branches: ...
- Unresolved decisions: ...

## Sources and Business Flow

### Sources

| Source | Evidence role | Authority status | Proven fact |
|---|---|---|---|
| {locator} | {expected authority, implementation evidence, or runtime evidence} | {approved by whom, or not established} | {intended rule or current behavior} |

### Change Blast Radius

| Changed artifact | Changed contract, state, or data | Direct flow | Other affected flows | Tree roots or branches | Evidence |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

### Business Flow

| Step | Business action or decision | State or effect | Expected authority | Implementation evidence |
|---|---|---|---|---|
| B1 | ... | ... | ... | ... |

## Business Scenario Tree

### Outcome: {observable committed outcome}

#### 1. Primary Happy Path

##### HP-001 {scenario title}

- Priority: P0
- Business Path: {outcome} to Primary Happy Path to {leaf}
- Covers: B1 through Bn
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
- Purpose: ...
- Preconditions: ...
- Actions: ...
- Expected Results:
  - ...
- Expected Authority: ...
- Implementation Evidence: ...

## Coverage and Gaps

### Coverage

| Contract, step, or affected flow | Scenario leaves | Disposition |
|---|---|---|
| ... | ... | covered, NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE |

### Gaps and Decisions

| Item | Disposition | Effect on plan |
|---|---|---|
| ... | NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE | ... |

### First Test Slice

1. ...

The heading hierarchy is the tree. Scenario IDs may be referenced by coverage and gaps, but their definitions appear only below their business branch.

## Scenario Leaf Contract

| Field | Required content |
|---|---|
| Priority | P0, P1, or P2; the Primary Happy Path is P0. |
| Business Path | Outcome to business branch to leaf. |
| Covers | Stable business-step IDs exercised by the leaf. |
| Purpose | The rule, risk, or variation this leaf proves. |
| Preconditions | Only the starting state and input facts needed to understand the scenario. |
| Actions | Business actions in order; preserve important inputs and decisions. |
| Expected Results | Observable pass conditions at the relevant user, API, state, data, event, or external-effect level. If authority is missing, state the unresolved decision instead of asserting a verdict. |
| Expected Authority | Exact approved requirement, design, decision, policy, external contract, or explicit user direction that defines each intended result; otherwise `NEEDS-DECISION` and the missing decision owner. |
| Implementation Evidence | Exact code, configuration, schema, existing-test, or runtime locators that show current behavior, reachability, or risk. This field does not establish correctness by itself. |

Shared preconditions may live on the parent branch. A leaf then states only its overrides, but it still owns its actions, expected results, expected authority, and implementation evidence.

## Expected-Result Rules

- Assert outcomes, not implementation activity.
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

Do not use `ASSUMED` merely because a document is published, a test passes, or the current implementation is internally consistent.

## Blast-Radius Rules

- Start from changed contracts, not changed filenames. One file can affect several contracts; one contract can span several files.
- Trace both producers and consumers of changed state, data, APIs, events, permissions, and external effects.
- Include synchronous, async, scheduled, retry, recovery, administrative, reporting, compatibility, and alternate-entry flows when they can observe or mutate the changed contract.
- Put every affected business outcome in the scenario tree. Direct-flow coverage does not close an affected neighboring flow.
- Reconcile every changed contract and affected flow in Coverage and Gaps, including explicit non-coverage decisions.

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
| Sources and Business Flow | 来源与业务流程 |
| Business Scenario Tree | 业务场景树 |
| Outcome | 业务结果 |
| Primary Happy Path | 主流程 Happy Path |
| Priority | 优先级 |
| Business Path | 业务路径 |
| Covers | 覆盖步骤 |
| Purpose | 目的 |
| Preconditions | 前置条件 |
| Actions | 测试动作 |
| Expected Results | 预期结果 |
| Expected Authority | 预期依据 |
| Implementation Evidence | 实现证据 |
| Change Blast Radius | 变更爆炸半径 |
| Affected Flows | 受影响流程 |
| Coverage and Gaps | 覆盖与缺口 |
| Gaps and Decisions | 缺口与决策 |
| First Test Slice | 首轮测试切片 |
