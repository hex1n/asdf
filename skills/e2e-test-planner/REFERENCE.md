# E2E Test Planner Reference

## Executor Handoff Index

Use this when the plan will be executed by `e2e-test-executor`, a separate agent session, or automation. The Markdown plan remains the source of truth; the index is a compact locator so an executor can start without scraping every scenario body.

Place the index after `Execution DAG` and before the closure sections. Use `## Executor Handoff Index` for English output and `## 执行器交接索引` for Chinese output.

Include these fields:

| Field | Required content |
|---|---|
| Artifact ID | Stable plan ID or filename plus timestamp/version if available. |
| Contract version | `e2e-plan/v1`. |
| Plan source | Requirement/design/code sources, commit or document version, and unverified source gaps. |
| Scenario set | Scenario IDs, selected/default nodes, and intentionally manual or blocked scenarios. |
| DAG nodes | Node IDs, scenario IDs, dependency roots, and disruptive markers. |
| Variable ledger | Produced variables, source-supported fixtures, consumers, and cleanup consumers. |
| Required capabilities | API/RPC/CLI/UI/DB/MQ/job/log/metric/stub/local-service capabilities and missing gates. |
| Cleanup anchors | Owner marker, isolation key, cleanup dependency, and retention risk for each mutable side effect. |
| Execution blockers | Missing locators, unsafe data, unavailable hooks, ambiguous oracles, and environment assumptions. |

Completion criterion: an executor can choose nodes, locate variable producers and consumers, see missing capabilities, and find cleanup blockers without reading every scenario body first.

## Plan Readability: Overview & Self-Contained Scenarios

A plan is read two ways: a reviewer skims top-down to judge coverage and risk before greenlighting, and an executor reads one scenario at a time to run it. Both fail the same way when a scenario's facts are scattered — purpose in the scenario body, scheduling in the DAG, side-effect risk and gates in other sections — forcing a multi-section join. Co-locate just enough to answer the two recurring questions: *what does this plan cover and what is unresolved?* and *for this one scenario, how does it schedule and how risky is it?*

**Overview digest (leads the plan).** A short `Overview` / `概览` block above the first numbered section, restating facts sourced below — never a new source of truth:

- Coverage in brief: journey-edge span, scenario count, and the `Core Slice`.
- Top risks: the one or two highest risk families the plan exists to close.
- Open gaps: the unresolved items, each with its disposition token (`OPEN`/`CONDITIONAL`/`OUT-OF-SCOPE`/…), so a reviewer never mistakes a settled item for a pending one.

Keep it a few lines. It is a navigation digest, not an approval template, and it adds no fact absent from the sections below.

**Self-contained scenario index line.** Lead each scenario with a one-line handle carrying its cross-section coordinates as cheap, closed-set tokens:

```text
### {scenario-id} {one-line title}
- Index: node `{node-id}` | priority {ENUM} | Side-effect Class `{ENUM}` | readiness gate → {gate ref}
- Purpose/Risk: …            (the dedicated fields stay; the index only points to them)
```

- The index denormalizes only tokens that are near-zero drift (a node id, a priority enum, the `Side-effect Class` enum, a section reference). Never copy a field's prose onto the index.
- The Execution DAG (§6) stays the single source of scheduling facts (depends/consumes/produces/parallel-safety); the index is a pointer to the node, not a second copy of its row. The full reason/detail stays in each dedicated field.
- The same shape is domain-neutral: a checkout scenario reads `node N1 | priority P0 | Side-effect Class additive-retained | gate → entry stub ready`; a device-provisioning OTA scenario reads `node N3 | priority P1 | Side-effect Class config-change | gate → firmware-mirror reachable` — only the {node}/{ENUM}/{gate} differ, the handle is identical.

Completion criterion: a reviewer learns coverage, top risk, and open gaps from the Overview alone; a reader learns a single scenario's node, priority, side-effect class, and gate from its index line without opening the DAG or gates sections; no scheduling fact is duplicated out of the DAG and no field's prose is copied onto the index.

## Migration Read-Path Risk Matrix

Use this when a change alters the shape or contents of a table or column that existing code already reads — backfilling a column, changing a table/column shape, or copying/de-duplicating rows are common triggers. It forces read-path coverage: a migration can make every writer succeed yet still break an existing query that predates the change and does not filter on the new discriminator. Use `## Migration Read-Path Risk Matrix` for English output and `## 迁移读路径风险矩阵` for Chinese output. Place it after the Risk Map and before the Test Scenarios and Execution DAG.

Enumerate one row per (changed table or column) × (downstream reader). Include these columns:

| Column | Required content |
|---|---|
| Changed table/column | The table or column whose shape or contents this migration alters. |
| Change kind | How the shape or contents change — e.g. backfill, shape/DDL change, row copy/duplication, de-duplication. |
| Reader | The downstream read path and its exact locator: query/mapper/endpoint/report/job; include readers that predate this change. |
| Old assumption | What the reader assumed about row shape, cardinality, or filters before the change. |
| New shape | How the migration changes what that reader now sees (duplicated rows, new nullable column, widened set). |
| Equivalence scenario | The scenario ID asserting the reader's result stays equivalent or its intended new result; or `blocker` when no safe scenario exists. |
| Expected decision | `equivalent`, `must-change`, `blocker`, or `accepted-divergence`. |

Completion criterion: every changed table or column with at least one existing reader has a row; each row names an existing reader locator and either a scenario ID present in Test Scenarios or a blocker; readers that do not filter on the new discriminator are listed explicitly, not assumed safe.

Worked example (illustrative; names are generic):

| Changed table/column | Change kind | Reader | Old assumption | New shape | Equivalence scenario | Expected decision |
|---|---|---|---|---|---|---|
| `summary.tenant_id` (new column) | backfill of a new discriminator column | a daily report query that filters by `date` but not by `tenant_id` | one aggregate per day | rows split per tenant after backfill | `EX-E2E-014` | must-change: report query must add the `tenant_id` filter |

Beyond DB migrations: the same risk — writers all succeed yet an existing reader silently breaks — applies when the changed surface is an API response shape, an event schema, a cache, or a search index an existing consumer reads. This matrix is DB-shaped (table/column); cover those surfaces as read-path-equivalence scenarios or blockers in Test Scenarios rather than forcing them into this table.

## Document-Code Semantic Diff

Use this when a source document states a behavioral contract — such as a rule, default, mapping, ordering, or invariant — that the plan can compare against the code's actual behavior. The most valuable defects often live in this gap: the document says one thing, the code does another. Use `## Document-Code Semantic Diff` for English output and `## 文档-代码语义差异` for Chinese output. Place it after the Source Inventory and before the Test Scenarios.

Enumerate one row per documented contract that could diverge. Include these columns:

| Column | Required content |
|---|---|
| Contract | The documented rule/default/mapping/ordering/invariant and its source locator (doc + section). |
| Code behavior | What the code actually does, with a file:line receipt. |
| Delta | How the contract and the code diverge, or `match` when verified equal. |
| Risk | `P0`, `P1`, or `P2` by blast radius if the delta is a real defect. |
| Resolution | The scenario ID that verifies the delta, or `closed`/`blocked` with the reason. |

Completion criterion: every contract with a non-`match` delta at `P0` or `P1` risk names a scenario ID present in Test Scenarios, or is explicitly `closed`/`blocked`; a delta is never left only as a line in the Risk Map or Gaps section.

Worked example (illustrative; names are generic):

| Contract | Code behavior | Delta | Risk | Resolution |
|---|---|---|---|---|
| Doc: display name uses a code→label alias (`spec §7`) | code emits the raw code value (`Service.java:120`) | alias never applied | P1 | `EX-E2E-021` |
| Doc: child records deleted when the parent is removed (`spec §7.2`) | code keeps orphaned child records | unconfirmed product call | P1 | blocked: product owner to confirm intended semantics |

## Side-effect Class

Tag every scenario with one side-effect class so an executor knows, before running, what the scenario does to shared state and whether it needs authorization. The tag lives on each scenario (the `Side-effect Class` field); use `副作用类型` for Chinese output.

| Class | What it does | Authorization gate |
|---|---|---|
| `read-only` | Reads state, writes nothing. | None. |
| `additive-retained` | Creates self-owned data that is kept. | Owner marker + retention note. |
| `soft-delete` | Logically hides or removes rows (status flag, tombstone). | Explicit authorization or a dedicated fixture. |
| `destructive-delete` | Physically deletes rows, files, or queue state. | Explicit authorization or a dedicated fixture. |
| `config-change` | Mutates shared config, flags, templates, or dictionaries. | Authorization + a restore plan. |
| `external-file` | Reads or writes an external store / object storage. | Capability + cleanup or retention note. |
| `async-replay` | Re-triggers a job, message, or callback. | A legitimate trigger plus a dedicated failure-injection fixture; never mutate already-succeeded state. |

Completion criterion: every scenario names a class; every `soft-delete`/`destructive-delete`/`config-change`/scope-mutating scenario names its authorization or fixture, and is flagged for re-risk under a data-retention override.

## Gap & Defect Disposition

One disposition vocabulary, shared by the planner's gaps and the executor's `Failures / Defects / Plan Gaps`, so a reader never mistakes a settled item for a pending failure. The token is a closed set; specifics (which tool is missing, which decision closed it) go in the item's reason, not the token — that keeps the vocabulary portable.

| Disposition | Meaning |
|---|---|
| `OPEN` | Real, unresolved, must be acted on. As a plan gap: must be resolved before the run. |
| `CLOSED` | Verified done, or no longer applicable. |
| `MITIGATED` | A workaround is in place; residual risk is noted. |
| `ACCEPTED` | Known and deliberately accepted; no action planned. |
| `CONDITIONAL` | Actionable only once a stated precondition holds; the precondition is named. |
| `BLOCKED-BY-TOOLING` | Cannot proceed for lack of a specific capability; the missing capability is named in the reason. |
| `OUT-OF-SCOPE` | Excluded from this plan or run by scope or user override. |

Plans use the pre-run subset (`OPEN`/`CONDITIONAL`/`OUT-OF-SCOPE`/`ACCEPTED`); executors may use all seven. A `CONDITIONAL`, `BLOCKED-BY-TOOLING`, or `OUT-OF-SCOPE` item never appears as a plain to-do or `Next Action` — only `OPEN` items do.
