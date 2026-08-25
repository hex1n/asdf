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

| Characteristic | Observable affected | Blocks | Expected authority | Implementation evidence |
|---|---|---|---|---|
| {operation, target state, direction, field, bound, subject class, mode} | {committed observable from the Business Flow table} | {block 1; block 2; ...} | ... | ... |

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

| TR | Model | Criterion | Coverage obligation | Observable | Scenario leaves | Disposition |
|---|---|---|---|---|---|---|
| TR-001 | ... | ... | {edge, rule, base tuple, block pair, or complete tuple} | {committed observable} | ... | covered, infeasible, NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE |

### Gaps and Decisions

| Item | Disposition | Effect on plan |
|---|---|---|
| ... | NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE | ... |

### First Test Slice

1. ...

The heading hierarchy is the tree. Scenario IDs may be referenced by the ledger and gaps, but their definitions appear only below their business branch.

## Reader View Contract

The same-stem `.html` file is the human entry point; the Markdown plan is the canonical agent handoff and sole fact source. Build the HTML only after the Markdown is final. It is a projection: a visible fact, scenario, requirement, priority, risk, gap, disposition, or slice item must already exist in Markdown and link back to its heading or row.

Use a picture-first opening screen with large shapes and short labels:

- **Outcome** — one short plain-language sentence naming what the plan proves; keep scope and risk detail out of this card.
- **Business path** — ordered boxes and arrows from legitimate entry to committed observable. Preserve the Business Flow order and give every adjacent pair a visible connector. Prefer one unbroken row when it remains readable; otherwise use a vertical stepper or snake whose wrap connector visibly joins the last box of one row to the first box of the next. A trailing arrow into whitespace is invalid. Never arrange independent rows so they imply a false transition.
- **Risks and decisions** — the highest-risk branches and every unresolved item that changes whether the plan can give a verdict, each with its disposition text/icon as well as color.
- **First Test Slice** — the exact ordered scenario IDs from Markdown, with one-line purposes.

On a standard desktop opening screen, all four groups are visible together. Compress labels and put explanations below the fold rather than letting one large outcome card, a long flow, or expanded risk prose push another group out of view.

Below the opening screen, render the complete scenario tree as compact business-branch groups. Include every scenario ID and priority, but link to the canonical leaf for actions, expected results, authority, implementation evidence, and other detail instead of copying those paragraphs. Use `<details>` for secondary branches when useful.

The Reader View follows the canonical plan's language for headings, buttons, cards, and explanatory text; do not add bilingual UI labels unless the canonical plan is bilingual or the user asks. Preserve identifiers and source text as-is. Render Markdown syntax as HTML — inline code uses `<code>`, with no visible backticks, table pipes, or escape residue. Use semantic, responsive HTML and inline CSS that works offline. Communicate meaning with labels/icons in addition to color. Use no external fonts, scripts, CDNs, or automatic browser opening.

Before handoff, reconcile the projection against Markdown: every scenario and First Test Slice ID resolves; every displayed priority, risk, gap, and disposition agrees; the canonical relative link resolves; no HTML-only fact exists. Then render and inspect the opening screen at desktop width, checking ordered flow, readable contrast, overflow, and whether the four questions above are answerable without scrolling into detail. This pass is required: structural rules alone do not catch a flow that renders into a false transition. Without a render capability, hand off the canonical Markdown alone and say the Reader View was withheld for lack of a render pass; never hand off an unrendered view.

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

- Authority status identifies the accountable authority: an approving person or dated decision, a governing policy or versioned external contract, or explicit user direction. An implementation artifact such as a class or enum with no designation as the contract reads `not established` and backs no verdict.
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

- Blocks are partitioned relative to an observable: two inputs that reach the same decision but a different committed observable are different blocks for that observable, so a characteristic that affects several observables has one row per observable. Several observable-specific partitions of the same input are alternative views, not distinct characteristics to cross-combine.
- A bound on an input partitions into a boundary block and an interior block.
- When a step's outcome or settlement timing differs by subject class (product type, account tier, region), each class with a distinct outcome is its own block, the class named in the leaf title.
- A business mode of an affected flow is a block of that flow's characteristic.

Decision logic:

- Each error code is a rule with its own row; when several rules can fire at once, record the judgment order as a rule.

## Coverage Criteria Defaults

| Model | Default criterion |
|---|---|
| State graph | Every trunk edge, every affected flow, and the producer flow reached by the Primary Happy Path. |
| Input space | Base-Choice over each success-path input model as the floor: first separate accepted blocks that reach the same committed outcome from rejection-only blocks, then use a feasible Primary Happy Path as the base and vary each accepted non-base block once while every other distinct characteristic stays at a compatible base block, keeping the oracle on the affected committed observable. Treat source or blast-radius evidence that an outcome depends jointly on characteristics as an identified interaction; add All-Combinations for up to three distinct characteristics and Pairwise for larger identified interaction sets. Name every applied criterion in the ledger. |
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
