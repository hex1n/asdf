---
name: e2e-test-executor
description: >
  Executes source-backed E2E test plans in local or test environments and produces evidence-backed reports. Use when the user asks to run, execute, validate, verify, or report on an E2E/end-to-end/端到端/全链路 plan or scenario, especially from e2e-test-planner output, using APIs, RPC/SDK/CLI tools, UI, databases, jobs, callbacks, queues, logs, metrics, stubs, or local services; do not use for creating the original test plan.
---

# E2E Test Executor

Execute an existing E2E plan and produce an evidence-backed handoff. The default outcome is not test code; it is a real run, a report, an issue backlog, and raw evidence. Write or modify tests only when the user explicitly asks, or when the plan names that as the execution method.

Supported environments: local and test only. If the target is preprod, staging with production-like restrictions, or production, stop and ask for a narrower read-only task or explicit safety instructions.

## 1. Intake

Read the plan before touching the system. Parse `Agent-ready Gates`, `Agent Execution Contract`, `Execution DAG`, `Execution Order`, scenario fields, waits, cleanup, and issue or gap sections. If the plan lacks a needed locator, variable, command, table, or environment fact, explore the codebase, docs, config, scripts, tests, and safe read-only probes before asking the user.

Completion criterion: every selected scenario is mapped to plan IDs, edge IDs, expected variables, required capabilities, waits, cleanup, and blockers; missing or conflicting plan facts are recorded before execution starts.

## 2. Environment Discovery

Identify whether the run is local or test. Build an `Execution Capability Map` covering available API/RPC/SDK/CLI/UI tools, DB access, MQ/Redis/job/callback controls, logs/metrics/traces, auth, base URLs, test accounts, feature flags, service start commands, stubs, build/test toolchains, dependency caches, and cleanup mechanisms.

For local runs, actively fix reversible environment problems: start declared services, workers, schedulers, stubs, or docker compose; free or change ports; install declared dependencies; create temporary config; run migrations or seeds; and inspect logs until health checks pass or the blocker is proven. Log every file, command, port, profile, service, toolchain version, cache or dependency source, and temporary change. Classify cache misses, dependency downloads, and dependency-resolution timeouts as environment or tooling setup unless product code actually executed and failed. Do not silently change business logic, bypass auth or validation, or edit production templates to make a scenario pass.

For test runs, automatic data creation, cleanup, job triggering, and callback triggering are allowed once the environment is confirmed as test. Prefer business APIs, existing tools, and self-owned data; direct DB mutation is allowed when it is the practical test hook, but every write/delete must be logged with ownership and cleanup evidence.

Completion criterion: scenario execution does not begin until the capability map satisfies the relevant entry gates or names exact blockers.

## 3. Data Policy

Prefer creating the business data needed for this run through business entry points or existing test tools. Reuse environment data only as a heuristic choice for stable, low-side-effect, normally preconfigured inputs such as accounts, tenants, products, templates, switches, dictionaries, or provider configuration. Do not treat that list as closed.

When reusing data, record the ID, source, current state, why it was not created, whether the run can mutate it, and how reproducibility or cleanup is affected. Mark data that may be mutated but cannot be restored as blocked or downgrade the scenario to read-only verification.

Completion criterion: every created or reused entity has an owner marker such as batch ID, prefix, creator, tenant, trace ID, remark, or scenario ID, plus a cleanup or retention decision.

## 4. DAG Scheduler

Build a runtime DAG from the plan; do not run scenarios in file order by default. Use `Depends on`, `Consumes`, `Produces`, side-effect scope, isolation key, cleanup dependency, and parallel-safety facts.

Run independent probes and isolated scenarios in parallel when the DAG proves they are safe. Run dependent business chains by DAG order and pass produced variables explicitly. Run disruptive nodes such as concurrency, recovery, compensation, callback-race, and load checks in isolation. Finish with final consistency and cleanup checks across DB, events, logs, metrics, stubs, external side effects, and created data.

Completion criterion: the report can explain why each node was parallel, serialized, isolated, skipped, or blocked.

## 5. Execute and Diagnose

Use the best available tool for each target surface: HTTP, RPC, SDK, CLI, browser automation, shell command, DB query, queue/job control, callback harness, log search, metric query, or local service command. Capture inputs, outputs, timestamps, variable values, waits, retries, query results, log locators, screenshots when relevant, and cleanup actions under an evidence directory.

On any failure, suspected product defect, or unknown mismatch, preserve the failure scene before cleanup: raw request/response, DB rows or query results, queue/job state, logs/traces/metrics, stub or external-system state, config/profile/feature flags, created entity IDs, correlation IDs, screenshots when relevant, and the exact rerun command. Redact secrets while keeping identifiers needed for reproduction. Do not delete or mutate created data, queues, locks, cache entries, or temporary configs needed for diagnosis until the scene is captured; if cleanup would destroy evidence, quarantine or retain self-owned data and record owner, TTL, cleanup command, and risk.

After changing config, profiles, feature flags, stubs, service state, seed data, or test data, add a freshness guard: re-run the readiness probe and verify the next observed response, row, event, log, or artifact reflects the new state. Treat cache hits, `unchanged` responses, stale snapshots, reused fixtures, or missing config fingerprints as a product, plan, environment, or tooling risk until proven fresh.

Classify every mismatch before filing it: `product defect`, `plan defect`, `environment defect`, `tooling defect`, or `unknown`. A scenario passes only when its expected probes, waits, invariants, side effects, and cleanup evidence are satisfied. A missing probe is blocked, not passed.

Completion criterion: each selected scenario is `passed`, `failed`, `blocked`, or `skipped`, with evidence paths, preserved-scene paths or an explicit reason they are unavailable, and a diagnosis for every failure or blocker.

## 6. Report Artifacts

Create a run directory unless the user specifies an output path:

```text
e2e-run-<plan-name>-<timestamp>/
  execution-report.md
  execution-report.html
  issue-backlog.md
  evidence/
```

`execution-report.md` is the agent handoff source of truth. Include `Execution Summary`, `Environment & Capability Map`, `DAG Schedule`, `Scenario Results`, `Evidence Index`, `Failures / Defects / Plan Gaps`, `Data Created & Cleanup`, `Re-run Instructions`, and `Next Actions for Agent`.

`execution-report.html` is the human-readable view generated from the same facts. It may add summary cards, filters, tables, and collapsible evidence, but it must not introduce facts absent from the Markdown report or evidence.

`issue-backlog.md` is a separate agent-ready backlog, not a remote issue tracker by default. Create one issue per actionable root cause with `Issue ID`, `Type`, `Severity`, `Affected scenarios / edges`, `Expected`, `Actual`, `Evidence`, `Preserved scene`, `Suspected code area`, `Reproduction steps`, `Fix constraints`, `Verification command or scenario`, and `Cleanup / data impact`. Product defects are fix candidates; plan defects revise the plan; environment and tooling defects repair execution.

Completion criterion: the final response links or names the report directory, summarizes pass/fail/blocked counts, and calls out whether cleanup completed.
