# E2E Test Planner Reference

## Canonical Plan Shape

# {feature} E2E Test Plan

## Overview

- Business outcome: ...
- Primary Happy Path: HP-001, or No source-backed Happy Path with the reason.
- Scope: ...
- Change set and blast-radius summary: ...
- Execution handoff: execution-anchors/v1
- Model applicability: {state graph: built; input space: built/not applicable; decision logic: built/not applicable}
- Coverage criteria: {one per built model}
- Highest-risk branches: ...
- Unresolved decisions: ...

## Sources and Models

### Sources

| Source | Evidence role | Authority status | Proven fact |
|---|---|---|---|
| {locator} | {expected authority, implementation evidence, or runtime evidence} | {approved by whom, or not established} | {intended rule or current behavior} |

### Model Applicability

| Model | Status | Basis and residual risk |
|---|---|---|
| State graph | built | Mandatory E2E propagation model. |
| Input space | built or not applicable | {characteristics and feasible blocks found, or positive evidence that none applies; residual risk} |
| Decision logic | built or not applicable | {rules, conditions, error codes, or judgment order found, or positive evidence that none applies; residual risk} |

### Business Flow

| Step | Business action or decision | Committed observable | Expected authority | Implementation evidence |
|---|---|---|---|---|
| B1 | ... | ... | ... | ... |

### Change Blast Radius

| Changed artifact | Changed contract, state, or data | Direct flow | Other affected flows | Modes of each affected flow | Tree roots or branches | Evidence |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

When Input Space is `built`, include:

### Input Space

| Characteristic | Observable affected | Blocks | Expected authority | Implementation evidence |
|---|---|---|---|---|
| {operation, target state, direction, field, bound, subject class, mode} | {committed observable from the Business Flow table} | {block 1; block 2; ...} | ... | ... |

When Decision Logic is `built`, include:

### Decision Logic

| Rule or error code | Condition | Outcome | Judgment order | Expected authority | Implementation evidence |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

### Coverage Criteria

| Model | Criterion | Reason and residual risk |
|---|---|---|
| State graph | ... | ... |
| {each optional model whose applicability is `built`} | ... | ... |

## Business Scenario Tree

### Outcome: {observable committed outcome}

#### 1. Primary Happy Path

##### HP-001 {scenario title}

- Priority: P0
- Business Path: {outcome} to Primary Happy Path to {leaf}
- Covers: B1 through Bn
- Requirements: TR-001, ...
- Observes: {committed observable of Bn}
- State Footprint: reads {{resource class}}; writes {{resource class}: ownership/provenance {...}, lifecycle {retain|restore|delete}}; external effects {none | {effect target}: ownership/provenance {...}, lifecycle {retain|restore|delete}}
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
- State Footprint: reads {{resource class}}; writes {{resource class}: ownership/provenance {...}, lifecycle {retain|restore|delete}}; external effects {none | {effect target}: ownership/provenance {...}, lifecycle {retain|restore|delete}}
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

### Ledger Reconciliation

Four mechanical checks over the finished plan. Each names the state it must find, so a reader can run it by eye or by script:

| Check | Passes when |
|---|---|
| Numbering contiguous | The `TR-*` sequence has no hole. A requirement that stops applying keeps its row carrying an `infeasible` or disposition value; it does not vanish and leave a gap. |
| Ledger → tree | Every row whose disposition is `covered` names leaf IDs, and each named leaf lists that `TR` in its `Requirements`. |
| Tree → ledger | Every `TR` named in a leaf's `Requirements` has a row in the ledger. |
| Referenced IDs resolve | Every scenario ID named in the ledger, Gaps and Decisions, or First Test Slice is defined by a leaf in the tree, or is marked as a scenario this plan does not define. |

A `covered` row that fails Ledger → tree is the reconciliation defect this section exists to catch: it is one edit away from closed, and reads closed until the pair is checked.

### Gaps and Decisions

| Item | Disposition | Effect on plan |
|---|---|---|
| ... | NEEDS-DECISION, ASSUMED, BLOCKED, or OUT-OF-SCOPE | ... |

### First Test Slice

1. ...

The heading hierarchy is the tree. Scenario IDs may be referenced by the ledger and gaps, but their definitions appear only below their business branch.

## Reader View Contract

The same-stem `.html` file is the human entry point; the Markdown plan is the canonical agent handoff and sole fact source. Build the HTML only after the Markdown is final. The HTML is a **complete projection**, not a teaser: every source/model row, business-flow step, changed contract, scenario leaf and field, test requirement, gap/disposition, and first-slice item remains available in the HTML. Collapsing secondary detail with `<details>` is allowed; omitting it or requiring a jump to Markdown is not.

### Information architecture: answer first, complete below

Build two deliberate layers:

1. **Opening visual index** — a compact answer-first screen that lets a reader understand what is being proved, how the business flow reaches its committed result, what can invalidate the verdict, and what runs first.
2. **Complete plan view** — semantic HTML for Overview, Sources and Models, the full Business Scenario Tree, and Coverage and Gaps. Give each section, business step, scenario ID, requirement ID, and gap a stable fragment id so the opening index and tables can link into this page without leaving HTML.

The opening visual index contains four groups, all visible on a standard desktop opening screen:

- **Outcome** — one short plain-language sentence naming what the plan proves; keep scope and risk detail out of this card.
- **Business path** — ordered boxes and arrows from legitimate entry to committed observable. Preserve Business Flow order and give every adjacent pair a visible connector. Prefer one unbroken row when readable; otherwise use a vertical stepper or a connected snake. A trailing arrow into whitespace is invalid. Never arrange independent rows so they imply a false transition.
- **Risks and decisions** — the highest-risk branches and every unresolved item that changes whether the plan can give a verdict, each with disposition text/icon as well as color.
- **First Test Slice** — the exact ordered scenario IDs from Markdown, each linked to its full HTML leaf and labeled with a one-line purpose.

### Visual grammar and plain-language reading

Apply a first-time-reader rule to the opening layer: assume the reader knows nothing about this requirement. Explain the business consequence before internal names, use one large relationship picture and few words, and keep each card or node to one claim. Replace acronym-only or implementation-only labels with a plain-language label; preserve the exact technical token next to it only when it helps the reader connect the explanation to evidence. This is progressive disclosure, not simplification by deletion: all domain precision remains in the complete plan layer.

Use the smallest visual that makes the relationship easier to understand:

- Sequence or state change: flow/stepper with explicit connectors.
- Exact mappings, coverage reconciliation, or comparisons: table.
- Business branches and scenario ownership: shallow tree or grouped cards.
- One fact or one action: prose; do not manufacture a diagram.

Place each visual next to the short text it supports. Use real business labels and actual IDs, not generic placeholders. Avoid oversized hero cards, decorative empty space, dense walls of equal-looking cards, tiny type, gradients that reduce contrast, and diagrams that merely restate a list. Set a readable content width, consistent spacing, strong hierarchy, visible focus states, and responsive desktop/mobile layouts.

The Reader View renders the Business Scenario Tree as the plan contract table, one row per scenario, with exactly these primary columns (localized with the plan language): **Scenario**, **Expected Input**, and **Expected Result**. Expected Input resolves inherited Preconditions and Actions before combining their starting state, business operation, and concrete parameters; row details identify the parent facts and leaf overrides that produced the effective anchors. Expected Result comes only from Expected Results and its approved authority; it is never inferred from implementation evidence or a later execution. Keep the owning business branch, Priority, Purpose, Business Path, Covers, Requirements, Observes, State Footprint, Oracle, Expected Authority, and Implementation Evidence in the same row through a compact `details` disclosure. Do not reproduce the Markdown field list below the table.

On narrow screens the semantic table may stack each row as a card, but the three field labels and row identity remain visible. The Markdown heading tree remains canonical; only its browser presentation changes. Plain language simplifies navigation; it never deletes domain precision.

### Browser-only navigation

- Every user-clickable local `href` ends in `.html` (optionally with a fragment) or is a same-page `#fragment`. Never link `.md`, `.json`, `.jsonl`, `.sql`, `.txt`, or `.log` directly from a browser-facing page.
- Keep canonical/raw artifacts unchanged. When the Reader View exposes one, generate a UTF-8 HTML companion: semantic rendering for Markdown, escaped `<pre>` plus title/provenance for JSON/SQL/log/text. Companions work offline and link onward only to HTML or fragments.
- Show canonical/raw paths as non-clickable `<code>` when provenance matters. HTML remains a projection; it does not replace the Markdown authority.

### Rendering and completeness gates

The Reader View follows the canonical plan's language for headings, controls, and explanatory text; do not add bilingual UI unless the plan is bilingual or the user asks. Preserve identifiers and source text as-is. Render Markdown syntax as HTML — inline code uses `<code>`, with no visible backticks, table pipes, or escape residue. Use semantic, offline HTML with inline CSS; no external fonts, scripts, CDNs, or automatic browser opening. Communicate meaning with labels/icons in addition to color.

Do not hand-build a renderer. This skill ships one at [`tools/reader-view.mjs`](tools/reader-view.mjs); it takes a JSON data file and emits the Reader View plus the static audits below (projection inventory, links, encoding — the render-and-inspect visual QA remains the planning agent's own duty):

```bash
node <skill>/tools/reader-view.mjs render <feature-dir>/reader-view.json
node <skill>/tools/reader-view.mjs audit  <feature-dir>/reader-view.json
```

The data file's required keys are the render contract — the tool refuses the file naming any missing one, so build them all before invoking it:

- Top level: `mode` (`"plan"`), `title`, `canonical` (the Markdown plan path), `out` (the HTML file to write), `scenarios`, `opening`. Optional: `subtitle`, `kicker`, `tableNote`, `companions`, `cellAnchors`, `audit`.
- Each scenario row: `id`, `title`, `input` (the resolved Expected Input), `expected` (the resolved Expected Result — from Expected Results only, never inferred). Optional: `branch` (owning business branch header), `priority`, and `fields` (the planning/traceability details disclosure).
- `opening`: `outcome`, `flow`, `risks`, `decisions` (each carrying the item identifier, disposition token, and one-line text as written in Gaps and Decisions), `slice` (`{id, why}` in slice order). Optional: `sideFlows` and group labels.

Beyond those keys, describe only what changes per plan. Use `cellAnchors` to make table-cell IDs (`B1`, `TR-001`) linkable from the opening index. The renderer owns the markdown→HTML engine, the visual grammar, and every static audit rule, so a fix there reaches every future plan. When the tool fails, fall back to the withheld-Reader-View rule at the end of this section rather than writing a replacement.

Before handoff, run both audits:

1. **Projection completeness** — compare Markdown and HTML inventories: top-level sections; source/model/business-flow/blast-radius/input/decision/coverage row counts; every B*/HP-*/scenario/TR-* ID; every effective scenario field after parent inheritance, including Preconditions, Actions, and State Footprint plus their parent/override lineage; every gap and disposition; every First Test Slice ID and order. Any missing item fails the audit. No HTML-only fact may appear.
2. **Navigation and visual QA** — crawl every local `href` from the Reader View and companion pages; every target must be `.html`/`#fragment`, exist, declare UTF-8, and decode without replacement characters. Render at desktop and mobile widths. Inspect the opening screen, every first-level link, flow continuity, contrast, focus, wrapping, horizontal overflow, and expanded scenario detail. A false transition, clipped content, unreadable table, dead link, raw-file browser link, or detail available only in Markdown fails the audit.

Without render capability, hand off canonical Markdown alone and say the Reader View was withheld for lack of a render pass; never hand off an unrendered or knowingly incomplete view.

## Scenario Leaf Contract

| Field | Required content |
|---|---|
| Priority | P0, P1, or P2. Default: the Primary Happy Path, its success matrix, and every changed contract's direct leaf are P0; every other model row is P1; cross-cutting branches are P2. Deviate only with a stated reason. |
| Business Path | Outcome to business branch to leaf. |
| Covers | Stable business-step IDs exercised by the leaf. |
| Requirements | Test-requirement IDs the leaf instantiates. |
| Observes | The committed observable and settlement predicate required by [Execution Anchors](#execution-anchors). |
| State Footprint | The reads, writes, and external effects required by [Execution Anchors](#execution-anchors). |
| Oracle | `specified` (the concrete expected value and its authority) or `derived` (a differential run, replay, invariant, or metamorphic relation, with what it is computed from). A plan never emits `implicit`. |
| Purpose | The rule, risk, or variation this leaf proves. |
| Preconditions | The concrete starting state and input construction or selection facts required by [Execution Anchors](#execution-anchors). |
| Actions | The ordered business actions and entry anchors required by [Execution Anchors](#execution-anchors). |
| Expected Results | Observable pass conditions at the relevant user, API, state, data, event, or external-effect level. If authority is missing, state the unresolved decision instead of asserting a verdict. |
| Expected Authority | Exact approved requirement, design, decision, policy, external contract, or explicit user direction that defines each intended result; otherwise `NEEDS-DECISION` and the missing decision owner. |
| Implementation Evidence | Exact code, configuration, schema, existing-test, or runtime locators that back the Execution Anchors and show current behavior, reachability, or risk. This field does not establish correctness by itself. |

Shared scenario facts may live on the nearest parent branch. Resolve every inheritable field from root to leaf with one atomic-field rule: an omitted child field inherits the nearest ancestor's complete value unchanged; a child that defines the field replaces that complete value and must restate every effective fact in it. Never partially merge, append, or delete inside an inherited field. Reader View and executor use this same reducer, so the effective contract deterministically resolves Preconditions, Actions, Observes, State Footprint, Expected Results, Expected Authority, and Implementation Evidence.

## Execution Anchors

`execution-anchors/v1` is the scenario-tree planner → executor interface. It carries stable, source-backed facts the executor needs to resolve a run while keeping live environment mechanics behind the executor seam. The Overview declares `Execution handoff: execution-anchors/v1`: the `Execution handoff` label follows the plan language, while `execution-anchors/v1` — like `business threshold: none specified` below — is a machine token written verbatim in every plan language, because the executor detects the contract by the token. After inherited parent facts are applied, every leaf resolves these four anchors:

| Anchor | Plan-owned fact |
|---|---|
| Preconditions | Concrete starting-state and input values, or a deterministic construction or entity-selection rule. A fixture or variable ID is concrete only when its values or production rule are present in the plan. Name any source- or safety-required predecessor leaf by stable ID; otherwise each leaf arranges its own starting state. |
| Actions | Ordered business actions. Every trigger names the project-declared adapter or entry surface, its stable locator or operation, and concrete inputs or a deterministic construction rule. |
| Observes | The committed observable — the store, event, or external effect at the end of propagation, never the entry response — and the predicate that proves propagation settled. An asynchronous action names an observable state transition, never a fixed sleep. Record an approved product time threshold when one exists; record `business threshold: none specified` when timing is not part of the contract; use `NEEDS-DECISION` only when correctness depends on a threshold the authority has not defined. Execution-safety bounds belong to the executor. |
| State Footprint | Business resources read, resources written, and external effects; for every writable or external target, name its provenance or ownership class and allowed terminal lifecycle: `retain`, `restore`, or `delete`. Write `none` for an empty class and expose unresolved resources, provenance, or lifecycle authorization instead of implying an empty footprint. |

Co-locate shared anchors at the nearest parent branch and apply the atomic-field reducer above; a leaf either inherits an anchor unchanged or replaces it with its complete effective value. The effective leaf is execution-ready only when all four anchors are concrete. A missing business value is `NEEDS-DECISION`; an implementation anchor that source inspection cannot resolve is `BLOCKED` with the missing evidence or capability. Keep such a leaf in the tree and Gaps and Decisions, but do not describe it as runnable.

The planner does not resolve live base URLs, credentials, environment-specific commands, selectors, safety wait bounds, run-specific owner-marker values, or cleanup implementations. The executor derives those mechanics from the anchors, implementation evidence, and live environment while obeying the footprint's ownership and lifecycle authorization. A plan may preserve an exact project-declared command when it is already the stable adapter interface, but it does not invent one merely to fill the handoff.

## Expected-Result Rules

- Authority status identifies the accountable authority: an approving person or dated decision, a governing policy or versioned external contract, or explicit user direction. An implementation artifact such as a class or enum with no designation as the contract reads `not established` and backs no verdict.
- Assert outcomes, not implementation activity (propagation). State each data outcome as a concrete value computed from the authority (revealability).
- Cover all committed effects that define the business result. If data, events, external calls, or user-visible state must agree, state each one.
- For time bounds, record an approved threshold when timing is contractual; use `NEEDS-DECISION` when correctness depends on an undefined threshold; otherwise record `business threshold: none specified` and leave the execution-safety bound to the executor.
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

## Model Applicability

Record applicability before deriving scenarios or criteria. This table is the single source of truth for which model sections, criteria rows, and test requirements exist.

| Model | Build when | `not applicable` when | Unknown evidence |
|---|---|---|---|
| State graph | Always. Every E2E plan needs a legitimate entry, propagation path, and committed outcome. | Never. | Resolve the missing path facts as `NEEDS-DECISION`; the model remains built. |
| Input space | Source or change evidence identifies a characteristic with multiple feasible blocks and the contract either permits different reachability, state transitions, settlement timing, or committed observables across those blocks, or requires an invariant across them. | Positive source and blast-radius evidence shows no such characteristic exists in scope. | Build it and expose the uncertain characteristic or blocks as `NEEDS-DECISION`. |
| Decision logic | The system selects among outcomes or error codes, a rule has independent conditions, or overlapping rules have a judgment order. | Positive source and blast-radius evidence shows the path has no such choice, condition, error outcome, or ordering rule. | Build it and expose the uncertain rule or condition as `NEEDS-DECISION`. |

A built optional model owns a model section, one coverage criterion, and the requirements generated by that criterion. A `not applicable` model owns none of those; its reason and residual risk live only in `Model Applicability`. If later evidence changes a decision, update the table before adding or removing its downstream records.

An asynchronous continuation, stored-data change, permission, compatibility window, or second affected flow always belongs in the state graph and blast-radius trace. It does not by itself prove that Input Space or Decision Logic is applicable; use each model's own gate.

## Model Rules

State graph:

- One file can affect several contracts; one contract can span several files. Each affected business outcome is its own node; direct-flow coverage does not close an affected neighboring flow.

Input space:

- Model every applicable characteristic with multiple feasible blocks, whether the contract permits an observable difference across those blocks or requires an invariant across them.
- Blocks are partitioned relative to an observable: two inputs that reach the same decision but a different committed observable are different blocks for that observable, so a characteristic that affects several observables has one row per observable. Several observable-specific partitions of the same input are alternative views, not distinct characteristics to cross-combine.
- A bound on an input partitions into a boundary block and an interior block.
- When a step's outcome or settlement timing differs by subject class (product type, account tier, region), each class with a distinct outcome is its own block, the class named in the leaf title.
- A business mode of an affected flow is a block of that flow's characteristic.

Decision logic:

- Each error code is a rule with its own row; when several rules can fire at once, record the judgment order as a rule.

## Coverage Criteria Defaults

Apply a default only to a built model. A `not applicable` model has no criterion and produces no test requirement.

| Model | Default criterion |
|---|---|
| State graph | Every trunk edge, every affected flow, and the producer flow reached by the Primary Happy Path. |
| Input space | Base-Choice over each success-path input model as the floor: first separate accepted blocks that reach the same committed outcome from rejection-only blocks, then use a feasible Primary Happy Path as the base and vary each accepted non-base block once while every other distinct characteristic stays at a compatible base block, keeping the oracle on the affected committed observable. Treat source or blast-radius evidence that an outcome depends jointly on characteristics as an identified interaction; add All-Combinations for up to three distinct characteristics and Pairwise for larger identified interaction sets. Name every applied criterion in the ledger. |
| Decision logic | Every rule and error code with at least one direct assertion; judgment order asserted where rules overlap. When one rule fires on any of several independent conditions, each condition carries its own obligation: a single assertion on the rule executes one condition and leaves the rest unproven, so the ledger would read `covered` while a condition that never fires is indistinguishable from one that is not implemented. Split the condition column into those conditions before expanding. |

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
| Execution handoff | 执行交接 |
| Sources and Models | 来源与模型 |
| Model Applicability | 模型适用性 |
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
| State Footprint | 状态足迹 |
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
