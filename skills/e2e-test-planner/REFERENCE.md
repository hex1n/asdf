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
