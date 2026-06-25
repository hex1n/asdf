---
name: e2e-test-executor
description: >
  Executes source-backed E2E test plans in local or test environments and produces evidence-backed reports. Use when the user asks to run, execute, validate, verify, or report on an E2E/end-to-end/端到端/全链路 plan or scenario, especially from e2e-test-planner output, using APIs, RPC/SDK/CLI tools, UI, databases, jobs, callbacks, queues, logs, metrics, stubs, or local services; do not use for creating the original test plan.
---

# E2E Test Executor

Execute an existing E2E plan and produce an evidence-backed handoff. The default outcome is not test code; it is a real run, a report, an issue backlog, and raw evidence. Write or modify tests only when the user explicitly asks, or when the plan names that as the execution method.

Supported environments: local and test only. If the target is preprod, staging with production-like restrictions, or production, stop and ask for a narrower read-only task or explicit safety instructions.

Output language: use the language the user explicitly requests; otherwise infer from the user's latest prompt, then the plan's dominant language. Write the report and all run artifacts in that language; preserve code identifiers, paths, API names, enum values, logs, and quoted source text as-is. If the language choice remains ambiguous, state the assumed output language once.

## 1. Intake

Read the plan before touching the system. Parse `Agent-ready Gates`, `Agent Execution Contract`, `Execution DAG`, `Executor Handoff Index` when present, `Execution Order`, scenario fields, waits, cleanup, and issue or gap sections. If the plan lacks a needed locator, variable, command, table, or environment fact, explore the codebase, docs, config, scripts, tests, and safe read-only probes before asking the user.

When this run continues a prior run — a re-run to verify fixes — first read the prior run's `execution-report.md`: take its `failed` and `blocked` scenarios plus open defects as the selection set, carry its `Environment State Ledger` as the resume snapshot (what persists, what must not be cleaned), and record it as `Upstream run`. Re-run those scenarios and their DAG dependents — whatever consumed the fixed behavior — not only the single fixed scenario and not the whole plan, so a fix-induced downstream regression is caught. The Environment Contract preflight must prove the fix is the loaded build (deployment fingerprint) before re-validating, never the pre-fix process. A previously `failed` scenario that now meets its probes flips to `passed`; update its defect status and back-link the lineage.

On any start or continuation, re-read the user's latest constraints before trusting the plan, and record an `Execution Contract Override` ([REFERENCE.md](REFERENCE.md#execution-contract-override)) for anything the user changed since the plan was written — excluded scenarios, a data-retention decision, tool constraints (e.g. MCP-only, no CLI), or a changed exit criterion. An override **supersedes** the matching plan default: mark that plan requirement `superseded`, never report it as `failed` or unmet.

Completion criterion: every selected scenario is mapped to plan IDs, edge IDs, expected variables, required capabilities, waits, cleanup, and blockers; missing or conflicting plan facts are recorded before execution starts. For a re-run, the selection set is the prior run's failed and blocked scenarios plus their dependents, and the upstream run is recorded.

## 2. Environment Discovery

Identify whether the run is local or test. Build an `Execution Capability Map` covering available API/RPC/SDK/CLI/UI tools, DB access, MQ/cache/job/callback controls, logs/metrics/traces, auth, base URLs, test accounts, feature flags, service start commands, stubs, build/test toolchains, dependency caches, and cleanup mechanisms. Treat the trigger channel itself as a first-class gate, not just endpoint reachability: the permission, allowlist, routing-override, and fallback-route controls that authorize a trigger on whatever surface applies — for RPC/SDK these are invoke and service allowlists, target overrides, and direct-URL fallbacks; for HTTP, API-key/origin allowlists, gateway routes, and CORS — together with the runtime env that unlocks them; surface these as a named `Trigger Channel Gates` facet of the capability map. Before a real trigger, be able to localize a block to a specific layer such as tool permission, network connectivity, service registration, or business handler rather than reporting a generic failure. When a scenario cannot run for lack of a capability — a tool, an MCP surface, a UI selector, or an access right — attribute it as `BLOCKED-BY-TOOLING` naming the specific missing capability, never a generic failure or an `incomplete`.

For local runs, actively fix reversible environment problems: start declared services, workers, schedulers, stubs, or docker compose; free or change ports; install declared dependencies; create temporary config; run migrations or seeds; and inspect logs until health checks pass or the blocker is proven. The agent's non-interactive shell resolves PATH and the active toolchain differently from a human interactive shell; resolve and record the actual tool paths and versions the run will use before building or starting services, and never rely on inherited PATH or a runtime's default toolchain. Log every file, command, port, profile, service, toolchain version, cache or dependency source, and temporary change. Classify cache misses, dependency downloads, and dependency-resolution timeouts as environment or tooling setup unless product code actually executed and failed. Do not silently change business logic, bypass auth or validation, or edit production templates to make a scenario pass.

For test runs, automatic data creation, cleanup, job triggering, and callback triggering are allowed once the environment is confirmed as test. Prefer business APIs, existing tools, and self-owned data; direct DB mutation is allowed when it is the practical test hook, but every write/delete must be logged with ownership and cleanup evidence.

Completion criterion: scenario execution does not begin until the capability map satisfies the relevant entry gates — including trigger-channel permissions — or names exact blockers. Before the first real trigger, run an `Environment Contract` preflight — resolve and record concrete values, not profile-name inferences or `reachable`, for the effective datasource (and the schema the code expects), the build/run toolchain identity, and the running process's deployment fingerprint the selected scenarios actually reach; an unresolved in-scope contract field is a blocker, not an assumption carried into execution. See [REFERENCE.md](REFERENCE.md#environment-contract-preflight).

## 3. Data Policy

Prefer creating the business data needed for this run through business entry points or existing test tools. Reuse environment data only as a heuristic choice for stable, low-side-effect, normally preconfigured inputs such as accounts, tenants, products, templates, switches, dictionaries, or provider configuration. Do not treat that list as closed.

When reusing data, record the ID, source, current state, why it was not created, whether the run can mutate it, and how reproducibility or cleanup is affected. Mark data that may be mutated but cannot be restored as blocked or downgrade the scenario to read-only verification.

Decide the run's data policy before executing and confirm it rather than letting the user discover it afterward: clean (restore created data to zero) or preserve traces (leave self-owned rows, files, and queue state for later inspection). Default to cleanup, but switch to preserve whenever the user will inspect the store, database, or external state after the run, or when retained data is needed to diagnose a failure. Record the chosen policy — strategy, retention scope, cleanable keys, and items that must not be cleaned — in the `Environment State Ledger`, so no one learns post-hoc that data was, or was not, cleaned.

When the policy is preserve, or the user requires data retention, re-risk every scenario whose plan `Side-effect Class` is `soft-delete`, `destructive-delete`, `config-change`, or scope-mutating: without explicit authorization, downgrade it to read-only verification using existing evidence or a dedicated new fixture. Never mutate already-succeeded state to simulate a failure — failure-recovery and replay paths use a dedicated failure-injection fixture, not edits to real successful records.

Completion criterion: every created or reused entity has an owner marker such as batch ID, prefix, creator, tenant, trace ID, remark, or scenario ID, plus a cleanup or retention decision; the run-level data policy — clean or preserve traces — is decided up front and recorded in the ledger.

## 4. DAG Scheduler

Build a runtime DAG from the plan; do not run scenarios in file order by default. Use `Depends on`, `Consumes`, `Produces`, side-effect scope, isolation key, cleanup dependency, and parallel-safety facts.

Run independent probes and isolated scenarios in parallel when the DAG proves they are safe. Run dependent business chains by DAG order and pass produced variables explicitly. Run disruptive nodes such as concurrency, recovery, compensation, callback-race, and load checks in isolation. Finish with final consistency and cleanup checks across DB, events, logs, metrics, stubs, external side effects, and created data.

Completion criterion: the report can explain why each node was parallel, serialized, isolated, skipped, or blocked.

## 5. Execute and Diagnose

Use the best available tool for each target surface: HTTP, RPC, SDK, CLI, browser automation, shell command, DB query, queue/job control, callback harness, log search, metric query, or local service command. Capture inputs, outputs, timestamps, variable values, waits, retries, query results, log locators, screenshots when relevant, and cleanup actions under an evidence directory.

On any failure, suspected product defect, or unknown mismatch, preserve the failure scene before cleanup: raw request/response, DB rows or query results, queue/job state, logs/traces/metrics, stub or external-system state, config/profile/feature flags, created entity IDs, correlation IDs, screenshots when relevant, and the exact rerun command. Redact secrets while keeping identifiers needed for reproduction. Do not delete or mutate created data, queues, locks, cache entries, or temporary configs needed for diagnosis until the scene is captured; if cleanup would destroy evidence, quarantine or retain self-owned data and record owner, TTL, cleanup command, and risk.

After changing config, profiles, feature flags, stubs, service state, seed data, or test data, add a freshness guard: re-run the readiness probe and verify the next observed response, row, event, log, or artifact reflects the new state. This covers redeploys and rebuilds, not just config or data: after a deploy, prove the new code is actually running — capture a version, build number, commit, or start time, or when none is exposed design a behavioral fingerprint whose result differs between the old and new code. A reachable endpoint or RPC is not evidence that a fix is loaded. Treat cache hits, `unchanged` responses, stale snapshots, reused fixtures, or missing config fingerprints as a product, plan, environment, or tooling risk until proven fresh.

Classify every mismatch before filing it: `product defect`, `plan defect`, `environment defect`, `tooling defect`, or `unknown`. A scenario passes only when its expected probes, waits, invariants, side effects, and cleanup evidence are satisfied. A missing probe is blocked, not passed.

When a required external dependency — a third-party service, database, message queue, cache, or callback endpoint — is unreachable or unavailable at run time, prefer the plan's declared stub or 挡板; if none exists and the scenario needs the live dependency, mark the scenario `blocked` or suspend per the plan's gates, capture the unreachable evidence (endpoint, error, timestamp, retry), and classify it as an `environment defect` — never `passed`, and not a `product defect` unless product code actually executed and returned the fault. The only exception is a scenario whose declared purpose and `Automation` level is the dependency-down, timeout, or recovery path: there the outage is an expected input, and the scenario still passes only when its expected degraded behavior — fallback, retry, compensation, or error contract — is observed and asserted; an outage alone is never a pass.

Completion criterion: each selected scenario is `passed`, `failed`, `blocked`, or `skipped`, with evidence paths, preserved-scene paths or an explicit reason they are unavailable, and a diagnosis for every failure or blocker.

## 6. Report Artifacts

Create a run directory unless the user specifies an output path; default it beside the plan being executed — under the plan's `docs/e2e-test/<feature>/` folder — so the plan and its runs stay paired, otherwise a stated working path whose full location the final response names. Produce the core artifacts by default; produce machine-readable or rendered artifacts only when a programmatic consumer, rerun/comparison tooling, or the user asks for them.

```text
e2e-run-<plan-name>-<timestamp>/
  execution-report.md        # core: agent handoff source of truth
  evidence/                  # core: raw, non-reconstructable evidence
    index.md
  preserved-scenes/          # core: kept whenever a scenario failed or is unknown
  # optional, on demand:
  run-metadata.json          # when a programmatic consumer needs machine metadata
  scenario-results.jsonl     # when rerun/comparison tooling consumes per-node rows
  execution-report.html      # when a human stakeholder asks for a rendered report
  issue-backlog.md           # when defects are too many to inline in the report
```

Use [REFERENCE.md](REFERENCE.md#run-artifact-contract) for the run file fields.

`execution-report.md` is the agent handoff source of truth and the default home for run and scenario facts. Include `Execution Summary`, `Run Lineage & Emergent Scenarios`, `Environment State Ledger`, `Run Metadata`, `Environment & Capability Map`, `DAG Schedule`, `Scenario Results`, `Evidence Index`, `Failures / Defects / Plan Gaps`, `Data Created & Cleanup`, `Re-run Instructions`, and `Next Actions for Agent`. Inline the issue backlog here unless it is large enough to need its own file.

`Run Lineage & Emergent Scenarios` keeps provenance and backflow in one place near the top: a lineage block naming the upstream plan (plus the upstream run, downstream reruns or investigations, and status where they apply), and an emergent-scenarios table when the run finds out-of-plan scenarios. Record each emergent finding as a table row — its source trigger, new scenario id, risk family, the plan section or risk family to update, and a status — so no out-of-plan P0/P1 finding is left only in the report; any rerun or investigation this run spawns back-links to the source plan and the prior run. See [REFERENCE.md](REFERENCE.md#run-lineage--emergent-scenarios) for the fields.

`Environment State Ledger` is the resume snapshot: a single block near the top that consolidates the environment facts otherwise scattered across `Run Metadata`, the Capability Map, and `Data Created & Cleanup` — target, datasource, deployment/freshness evidence, isolation namespace, created data, cleanup policy, remaining traces, and tool permissions — so a re-opened agent learns from the ledger alone whether the environment can continue, what data persists, and what must not be cleaned. Its `deployment/freshness evidence` field carries the §5 build/deploy fingerprint (a version, build, commit, start time, or behavioral fingerprint), never just `reachable`. See [REFERENCE.md](REFERENCE.md#environment-state-ledger) for the fields.

`evidence/` and `preserved-scenes/` hold non-reconstructable raw evidence and failure-scene snapshots; never downgrade them to optional.

Every item in `Failures / Defects / Plan Gaps` carries a **disposition** ([REFERENCE.md](REFERENCE.md#gap--defect-disposition)): `OPEN`/`CLOSED`/`MITIGATED`/`ACCEPTED`/`CONDITIONAL`/`BLOCKED-BY-TOOLING`/`OUT-OF-SCOPE`, so a closed, accepted, or tooling-blocked item is never read as a live failure. `Next Actions for Agent` lists only `OPEN`, truly-executable steps; a `CONDITIONAL` or `BLOCKED-BY-TOOLING` item stays in Failures/Defects with its precondition or missing capability named, never copied into Next Actions as a plain to-do.

When the user has overridden plan defaults, record an `Execution Contract Override` block near the top of the report ([REFERENCE.md](REFERENCE.md#execution-contract-override)): each row names the superseded plan default and the new rule (excluded scenarios, retention policy, tool constraints, or a changed exit criterion).

Optional artifacts must not introduce facts absent from `execution-report.md` or `evidence/`. `run-metadata.json` and `scenario-results.jsonl` are machine projections of the report's `Run Metadata` and `Scenario Results`; `execution-report.html` is a human-readable rendering that may add summary cards, filters, tables, and collapsible evidence. Any rendered or projected artifact is generated from `execution-report.md`'s final structure and must preserve its disposition/status columns, blocking notes, ignored items, and data-retention policy; after generating, check it for escape residue and broken tables so a clean Markdown is never contradicted by a misleading render. `issue-backlog.md`, when split out, is a separate agent-ready backlog, not a remote issue tracker by default. Create one issue per actionable root cause with `Issue ID`, `Type`, `Severity`, `Affected scenarios / edges`, `Expected`, `Actual`, `Evidence`, `Preserved scene`, `Suspected code area`, `Reproduction steps`, `Fix constraints`, `Verification command or scenario`, and `Cleanup / data impact`. Product defects are fix candidates; plan defects revise the plan; environment and tooling defects repair execution.

Completion criterion: the final response links or names the report directory, summarizes pass/fail/blocked counts, and calls out whether cleanup completed; core artifacts exist and optional artifacts are produced only when a consumer needs them.
