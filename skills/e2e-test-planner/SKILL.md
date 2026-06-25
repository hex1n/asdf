---
name: e2e-test-planner
description: >
  Creates source-backed end-to-end test plans from design, requirements, plan documents, and codebase behavior. Use when the user asks for an E2E/end-to-end/端到端/全链路 test plan, 端到端测试计划, 全链路测试计划, 端到端测试场景, 全链路测试场景, 链路测试, 全链路回归, an end-to-end cross-system business workflow test plan, an end-to-end dependency-aware workflow test plan, integration/acceptance/regression coverage of an end-to-end flow, or E2E test scenarios from docs/code analysis covering main paths, dependent workflows, boundary cases, performance, consistency, concurrency, idempotency, or stateful business flows; do not use for fixing failing tests or writing test code unless the user asks for planning first.
---

# E2E Test Planner

Build a source-backed, dependency-aware test plan. The core move is the **business flow**: draw the flow, then back it with edge IDs, carried data, state changes, and side effects before naming scenarios.

Output language: use the language the user explicitly requests; otherwise infer from the user's latest prompt, then the dominant source-document language. For mixed-language input, write prose in the user's conversational language and preserve code identifiers, paths, API names, enum values, logs, and quoted source text as-is. If the language choice remains ambiguous, state the assumed output language once.

Primary consumer: a downstream agent that will implement or execute the plan. Optimize for an executable handoff: stable IDs, stable field labels, machine-scannable headings and tables, exact sourced locators, named variables, probes, waits, cleanup, dependency DAG facts, and blockers. When execution will be delegated, also emit the compact Executor Handoff Index described after the Execution DAG. Avoid approval-only template sections unless the user asks for a formal QA document.

Lead the plan with a short `Overview` / `概览` digest so a reader sees the shape before the section-by-section detail: the coverage in brief (journey edges and scenario count, plus the Core Slice), the top risks, and the open gaps with their disposition. The Overview restates facts sourced in the sections below — a navigation digest, never a new source of truth — so it stays a few lines, not an approval template.

When saving the plan, default to a per-feature folder `docs/e2e-test/<feature>/` inside a repo (otherwise a stated path whose full location the response names), as `<date>-<feature>-e2e-test-plan.md`, so the plan and its later execution runs sit together under one feature directory.

## 1. Source Inventory

Read the smallest authority set that can prove behavior:

- Named design, requirement, and plan documents, plus nearby indexes.
- Relevant code entry points, domain models, state machines, persistence, async jobs, external clients, and existing tests.
- Config, feature flags, permissions, queues, schedulers, and transaction or idempotency hooks that affect end-to-end behavior.
- Prior executor run reports, when iterating on an already-executed plan: fold their `Emergent Scenarios` into the Risk Map and Coverage Matrix so out-of-plan findings are not lost.

Document-code semantic diff: where a source document states a behavioral contract — such as a rule, default, mapping, ordering, or invariant — extract it and compare it against the code's actual behavior. The highest-value defects often live in this gap. Emit a `Document-Code Semantic Diff` / `文档-代码语义差异` ([REFERENCE.md](REFERENCE.md#document-code-semantic-diff)) capturing each contract, the code behavior, the delta, its risk, and the scenario or decision that resolves it.

Completion criterion: every named source is accounted for; every claimed behavior has a source receipt or is marked unverified; out-of-scope surfaces are named. Documented contracts that diverge from code behavior are captured in the Document-Code Semantic Diff, and every P0/P1 divergence maps to a verification scenario or an explicit closed/blocked decision rather than a line buried in risk or assumptions. If a later scenario cites a new source, add it to the inventory before finalizing.

## 2. Business Flow Diagram + Journey Graph

Before scenarios, draw a Mermaid business flow diagram, then back it with a journey graph table. Capture:

- Actors and systems.
- Business entities and states.
- Ordered actions and transitions with stable edge IDs such as `J1`, `J2`, or domain-prefixed equivalents.
- Preconditions, produced outputs, generated identifiers, tokens, persisted records, emitted events, locks, caches, jobs, and external calls.
- Branches, retries, rollbacks, timeouts, duplicate delivery, and eventual consistency windows.

Completion criterion: every important diagram edge appears in the table with consumes, produces, state or side effects, and source receipts; every later scenario cites the edge IDs it covers. Missing, ambiguous, or source-only suspected edges are explicit gaps or hypotheses.

## 3. Agent Execution Contract

Before risk mapping, define what a follow-on agent can execute without rediscovering the business analysis:

- Target surfaces: APIs, UI routes/selectors, events, jobs, tables, commands, harnesses, profiles, feature flags, permissions, and external stubs or mocks.
- Data fixtures and named variables: how required entities are created or found, which IDs or tokens each journey edge produces, and how later steps consume them.
- Probes/oracles: where to assert user-visible, API, DB, event, log, metric, audit, cache, and external-system outcomes.
- Waits and budgets: polling or subscription points, eventual consistency windows, timeout budgets, performance thresholds, and retry limits.
- Isolation and cleanup: ownership of records, provider stubs, queues, locks, caches, schedulers, and idempotency keys.
- Required vs optional capability: split the surfaces above into **required capabilities** (the run cannot proceed without them) and **optional probes** (extra signal only). A missing required capability is a pre-run gate recorded in `Agent-ready Gates`, never something the executor only discovers mid-run.

Use stable field labels so another agent can parse the handoff. For English output, use `Target surfaces`, `Fixtures`, `Named variables`, `Probes/Oracles`, `Waits`, `Cleanup`, and `Blockers/Gaps`. For Chinese output, use `目标面`, `测试数据`, `变量传递`, `探针/Oracle`, `等待/预算`, `隔离/清理`, and `阻塞/缺口`. Keep these labels exact; put longer wording in the field body, not the label.

Tag the provenance of every runtime fact, not only its value. A target surface, trigger channel, datasource, schema or DDL state, credential, permission, feature flag, or external dependency is `confirmed by source` / `已确认` only when a read source proves it now; otherwise it is `assumed until executor probe` / `待验证`, and a known-unavailable prerequisite is `blocked` / `阻塞`. Any runtime state a static read cannot prove live — reachability, connectivity, service registration, readiness, and the like — is an assumption until the executor probes it; do not assert it as established because the plan happens to name it.

Completion criterion: every scenario can be assigned to an execution agent with no hidden setup, hidden prior result, or ambiguous oracle; unknown locators, unavailable test hooks, unsafe cleanup, and unowned dependencies are blockers or gaps; every runtime fact carries one of `confirmed by source`, `assumed until executor probe`, or `blocked`.

## 4. Risk Map

Derive scenarios from the journey graph, not from a generic checklist. Cover each relevant risk family:

- Main path and alternate valid paths.
- Boundary values, empty or large inputs, invalid state transitions, validation errors, and permission failures.
- Cross-step consistency: DB records, external side effects, events, caches, search indexes, invoices, emails, or reports agree after each committed state.
- Read-path equivalence (most commonly a DB migration; the same holds for any shared read surface an existing reader consumes): when a change alters the shape or contents of that surface, every existing downstream reader of it — especially readers that predate the change and do not filter on the new discriminator — still returns equivalent results or is explicitly changed.
- Concurrency: duplicate submissions, simultaneous updates, callback races, lock contention, optimistic or pessimistic conflicts, and lost updates.
- Idempotency and recovery: retries, duplicate callbacks, partial failure, rollback or compensation, and resume after async failure.
- Performance and scale: latency budgets, throughput, queue lag, item counts, fan-out, pagination, memory pressure, or connection pressure.
- Observability and operability: logs, metrics, traces, alerts, audit trails, and support diagnostics for critical failures.

Migration read-path branch: when that family applies, do not stop at writer correctness. Enumerate the readers of each changed table or column and emit a `Migration Read-Path Risk Matrix` / `迁移读路径风险矩阵` ([REFERENCE.md](REFERENCE.md#migration-read-path-risk-matrix)); map each changed shape that has an existing reader to a read-path equivalence scenario or a blocker, not only a write-success scenario.

Completion criterion: each requirement, API variant, required-input branch, state transition, business-flow edge, dependency edge, and high-risk failure mode is covered by at least one scenario or listed as a gap. When the migration read-path branch applies, every changed table or column with an existing reader maps to a read-path equivalence scenario or a blocker. Treat source-only suspected defects as verification targets unless runtime evidence or tests reproduce them.

## 5. Test Scenarios

Write scenarios at the level a downstream implementation agent can execute without rediscovering the analysis. Lead each scenario with a one-line **index/handle** — its DAG node id, priority, `Side-effect Class`, and a readiness-gate reference — so reading a single scenario is self-sufficient for how it schedules and how risky it is, without hopping to the DAG, gates, and slice sections. The index denormalizes only those cheap, closed-set tokens; the Execution DAG (§6) stays the single source of scheduling facts, and each field below stays the home for its own detail. For each scenario include:

- `Purpose/Risk`, `Priority`, `Sources`, `Edges`, `Setup`, `Steps`, `Expected`, `Automation`, and `Isolation/Cleanup` for English output.
- `目的`, `优先级`, `来源`, `覆盖边`, `准备`, `步骤和依赖`, `期望`, `自动化级别`, and `隔离/清理` for Chinese output.
- In `Setup`, include target surfaces, environment assumptions, and any required stubs or test hooks.
- In `Steps`, include the named-variable dependency chain: what each step consumes from previous steps and what it produces.
- In `Expected`, include probes, waits, and invariants at user, API, data, event, external-system, and async levels.
- In `Automation`, name the level: E2E, API integration, contract, load/performance, chaos/recovery, or manual exploratory.
- In `Isolation/Cleanup`, name cleanup, determinism, and flake risks; match cleanup to real transaction boundaries rather than assuming outer test rollback works for committed end-to-end calls.
- `Side-effect Class` / `副作用类型`: classify each scenario by what it does to shared state — `read-only`, `additive-retained`, `soft-delete`, `destructive-delete`, `config-change`, `external-file`, or `async-replay`. A `soft-delete`, `destructive-delete`, or scope-mutating scenario requires explicit user authorization or a dedicated fixture before an executor may run it, and is re-risked whenever a data-retention override is in force ([REFERENCE.md](REFERENCE.md#side-effect-class)).

Completion criterion: no scenario assumes an impossible state, hidden setup, or unavailable previous result.

## 6. Execution DAG

After scenarios, provide an executor-consumable DAG. The DAG states scheduling facts; it does not decide the runtime schedule for a specific machine or environment.

Use a table with one row per executable node. Nodes usually map to scenarios; split setup, probe, disruptive, or cleanup nodes only when a downstream executor needs different dependencies or isolation. Include:

- Node ID and scenario ID.
- Depends on: predecessor nodes, business-flow edges, and required produced variables.
- Consumes and produces: named variables such as IDs, tokens, event IDs, records, and evidence handles.
- Required capabilities: API, RPC, CLI, UI, DB, MQ, job, log, metric, stub, or local service controls.
- Side-effect scope and isolation key: affected tables, queues, caches, external stubs, tenant/account, batch ID, trace ID, or data prefix.
- Parallel safety: `safe`, `unsafe`, or `unknown`, with a short reason.
- Cleanup dependency: when cleanup may run and which produced variables it needs.
- Disruptive marker: concurrency, recovery, compensation, load, callback race, or none.

Use stable table headers. For English output, use `Node`, `Scenario`, `Depends on`, `Consumes`, `Produces`, `Required capabilities`, `Side-effect scope`, `Isolation key`, `Parallel safety`, `Cleanup dependency`, and `Disruptive marker`. For Chinese output, use `节点`, `场景`, `依赖`, `消费`, `产出`, `所需能力`, `副作用范围`, `隔离键`, `并行安全`, `清理依赖`, and `扰动标记`.

Completion criterion: every scenario appears in the DAG or is listed as intentionally manual/blocked; every `unsafe` or `unknown` node has a reason; every variable used across scenarios has a producer or source-supported fixture and a consumer; produced variables consumed by a node come from predecessor nodes named in `Depends on`, not from later or unrelated nodes; the DAG is acyclic; execution order can be derived from `Depends on` without rereading the prose.

Delegated execution branch: add Level-2 `Executor Handoff Index` / `执行器交接索引` immediately after the DAG when execution will be delegated to `e2e-test-executor`, a separate agent session, or automation. Use [REFERENCE.md](REFERENCE.md#executor-handoff-index) for the fields.

## 7. Closure

End with:

- Level-2 `Coverage Matrix` / `覆盖矩阵` mapping requirements, business-flow edges, journey graph edges, and risk families to scenario IDs.
- Level-2 `Gaps, Assumptions, Questions` / `缺口、假设与问题` naming doc/code conflicts, assumptions, and questions that could change the plan. Each gap carries a **disposition** ([REFERENCE.md](REFERENCE.md#gap--defect-disposition)) so an accepted, conditional, or out-of-scope item is never read as a pending one.
- Mark plan defaults the user may later override — the cleanup policy and the run's exit/completion criteria — as `default unless overridden`, so an executor can supersede them cleanly rather than report a superseded criterion as unmet.
- Project-specific technical facts found at run time (wire ID types, real pagination/field names, replay triggers, cache-refresh behavior) are recorded as plan revisions or emergent findings here, never promoted into generic rules.
- Optional Level-2 `Execution Order` / `执行顺序`, only when a human reader wants a ready-made sequence: a recommended dependency order derived from the Execution DAG, not a replacement for it. The executor derives order from the DAG `Depends on`, so this section is not required for agent handoff.
- Level-2 `Agent-ready Gates` / `Agent 就绪门禁`: prerequisites that must hold before automation starts, evidence that marks exit, and blockers that should suspend execution. Keep these gates consistent with the run facts asserted elsewhere in the plan: a fact stated as `confirmed by source` must not also appear here as an unmet prerequisite or blocker, and any runtime fact the executor must still probe — trigger-channel reachability, datasource or DDL readiness, credentials, or dependency availability — is `assumed until executor probe`, not presented as established.
- Level-2 `Scenario Slices` / `场景切片`: identify the `Core Slice` — the smallest set of scenarios that closes the main risk in a single executor run — so an executor can start there without re-triaging priority. When the full scenario set is larger than that Core Slice, also classify the rest as `Extended Slice` (valuable follow-on coverage) or `Hazardous/Defer` (disruptive, costly, or blocked scenarios to isolate or postpone), naming why each non-core scenario is deferred. The `Minimal First Automation Slice`, when the user asks for it, names the Core Slice's concrete starting scenarios.
- Level-2 `Minimal First Automation Slice` / `最小自动化切片` if the user asks how to start, with the scenario IDs and source-backed target surfaces to implement first.

Do not write test code unless the user asks. Label unverified source-derived defect claims as hypotheses.
