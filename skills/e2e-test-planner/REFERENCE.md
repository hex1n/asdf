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
| Doc: display name uses the team-type alias (`spec §7`) | code emits the raw team-type name (`Service.java:120`) | alias never applied | P1 | `EX-E2E-021` |
| Doc: members removed on withdrawal (`spec §7.2`) | code keeps stale membership rows | unconfirmed product call | P1 | blocked: product owner to confirm intended semantics |
