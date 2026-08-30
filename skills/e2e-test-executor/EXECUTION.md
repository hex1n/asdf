# Execution control and observation

Read this file after the selection set is fixed and before the first trigger. Follow only the environment and side-effect branches that apply.

Keep execution-stage records on the canonical proof path: append boundary, capability, preflight, ledger, schedule, and planned-command facts to `plan-snapshot.md` until `execution-report.md` exists. Do not create a separate run log, preflight, environment, capability, intake, or evidence-ledger document; raw proof belongs inline in the final report or, only when it would break readability, under `attachments/` as defined by `REPORTING.md`.

## Pin the SUT boundary

Declare every dependency the selected scenarios reach as **real** or a **double** (stub, fixture, record/replay), including the double's source and owner. Open [SUT Boundary](REFERENCE.md#sut-boundary) for the row schema. An undeclared dependency cannot carry a verdict.

If a required real dependency is unreachable, use its already-declared double. When no double exists, capture endpoint, error, timestamp, and retry evidence; mark the scenario `blocked`; classify the root cause as `environment defect` with `BLOCKED-BY-ENVIRONMENT`. It becomes a product defect only when product code ran and violated an established expectation. The only exception is a scenario whose `Purpose` and `Expected Results` explicitly cover dependency-down, timeout, or recovery behavior — a legacy `e2e-plan/v2` plan may carry that declaration in `Automation` instead: the outage is then its expected input, and it passes only when the specified fallback, retry, compensation, or error contract is observed.

## Pin the trigger channel

Build an `Execution Capability Map` for the selected scenarios. Include applicable API/RPC/SDK/CLI/UI controls; DB, MQ, cache, job, and callback access; logs, metrics, and traces; auth, base URLs, test accounts, feature flags, service commands, stubs, toolchains, dependency caches, and cleanup mechanisms.

Name `Trigger Channel Gates` explicitly: tool permission, invoke/service/API allowlists, network path, target or routing overrides, direct-URL fallback, credentials, and the runtime configuration that enables them. Before a trigger, be able to localize a block to the exact layer rather than reporting a generic connection failure. A missing tool, adapter, UI selector, or access right is `tooling defect` with `BLOCKED-BY-TOOLING`, naming the missing capability.

Prefer a project-declared test harness, adapter, CLI wrapper, browser driver, queue/job tool, or callback harness over hand-written mechanics. Open [Execution Adapter Boundary](REFERENCE.md#execution-adapter-boundary) only when choosing or validating an adapter. The executor owns selection, gates, data policy, evidence, diagnosis, cleanup, and reporting; the adapter owns surface-specific resolution, safe describe or dry-run behavior, encoding, invocation, and replay. Invoking an existing harness is allowed. Creating a new test file or method still requires the authorization stated in `SKILL.md`.

## Pin the starting state

A scenario triggers only after its environment fingerprint, data ownership, and schedule are all pinned.

### Environment contract

Resolve concrete values for the effective datasource and expected schema, the actual build/run toolchain, and the running process's deployment fingerprint. A profile name or `reachable` is not a value or fingerprint. Open [Environment Contract preflight](REFERENCE.md#environment-contract-preflight) for the field schema.

After changing config, profiles, flags, stubs, service state, seed data, test data, or deployment, rerun readiness and prove the next response, row, event, log, or artifact reflects the new state. Treat stale snapshots, reused fixtures, cache hits, and missing fingerprints as risks until disproved. An unresolved in-scope field blocks execution.

#### Local branch

For a local run, actively fix reversible environment problems within scope: start declared services, workers, schedulers, stubs, or compose stacks; resolve ports; install declared dependencies; create temporary config; run migrations or seeds; and inspect logs until readiness passes or a blocker is proven. Resolve and record the non-interactive shell's actual tool paths and versions before build or startup. Log each command, port, profile, service, toolchain version, cache/dependency source, file, and temporary change.

Cache misses, downloads, and dependency-resolution timeouts are setup defects unless product code actually ran and failed. Never alter business logic, bypass auth or validation, or edit production templates to make a scenario pass.

#### Test branch

For a confirmed test environment, data creation and cleanup plus job and callback triggering are permitted within the selected plan. Confirm the environment first; do not infer safety from a profile name. Use only test credentials and targets, and keep every mutation attributable and reversible or explicitly retained.

### Data ownership and side-effect branch

Prefer creating required business data through business entry points or existing test tools. Stable, low-side-effect preconfigured data may be reused — accounts, tenants, products, templates, switches, dictionaries, or provider configuration are examples — only after recording its ID, source, current state, why it was reused, whether the run may mutate it, and the effect on reproducibility and cleanup.

Every created or reused entity needs an owner marker such as batch ID, prefix, creator, tenant, trace ID, remark, or scenario ID, plus retention decision, TTL, and cleanup command. Direct DB mutation is allowed only in test when it is the practical hook, with every write/delete logged.

Choose and record one data policy before triggering:

- **preserve traces** is the default for local/test E2E because repair and rerun work may need the scene;
- **clean** applies when the user asks, the plan requires zero retained data, or created data is provably irrelevant to diagnosis and reproducibility.

Record strategy, retention scope, cleanable keys, and do-not-clean items in the `Environment State Ledger`.

#### Read-only branch

Do not create cleanup scripts when nothing was created or mutated. Record the reused identifiers and non-mutation evidence. If existing data could be changed but cannot be restored, keep the scenario read-only or mark its mutation path blocked.

#### Write-path branch

When creating or mutating data, decide cleanup before the write and later emit runnable seed and cleanup scripts when the surface is scriptable. A generated helper that performs this run's mutations is hashed before its first mutation and the hash recorded, under the helper rules in [REPORTING.md](REPORTING.md#keep-one-canonical-proof-path). For an absent target, satisfy [Path Containment Proof](REFERENCE.md#path-containment-proof) before the create call and before the first mutation. Under preserve-traces policy, keep self-owned diagnostic state with owner, TTL, cleanup command, and risk.

When preservation is required, re-risk scenarios involving `soft-delete`, `destructive-delete`, `scope-mutation`, `config-change`, or `external-effect`. Without explicit authorization, downgrade them to read-only verification using existing evidence or a dedicated new fixture. Failure-recovery and replay paths use a dedicated failure-injection fixture; never reuse an already-succeeded state.

### Schedule by root cause

Build a runtime DAG; file order is not execution order. Open [Scheduling by Root Cause](REFERENCE.md#scheduling-by-root-cause) when placing nodes. Default to serial. Parallelize a pair only when isolation keys differ **and** records prove no shared mutable target across locator, effects, readers/receivers, and external target or stub. Differing isolation keys alone do not prove independence. If overlap is unstated, serialize and explain why.

Run dependent chains in DAG order and pass produced variables explicitly. Isolate disruptive nodes. Finish with final consistency and cleanup checks across committed stores, events, logs, metrics, stubs, external side effects, and created data.

## Observe the committed outcome

Name each oracle as `specified`, `derived`, or `implicit`. Open [Oracle Types](REFERENCE.md#oracle-types) when classification is unclear. An implicit oracle is at most `unverified`.

Probe the committed outcome named by Expected Results — row, event, external effect, or user-visible state after propagation — not merely an entry response that accepted work. For asynchronous behavior, wait on a bounded, observable state transition; fixed sleeps alone cannot prove completion.

A scenario passes only when expected probes, waits, invariants, side effects, and cleanup evidence hold. Retain for every executed scenario:

1. exact probe commands or adapter invocations;
2. raw unsummarized output verbatim in a fenced block;
3. created-entity identifiers, or an explicit “none” for a read-only scenario;
4. an exact pre-cleanup re-query command an auditor can run against the live datasource — or, on a replay surface without executable bytes, the recorded adapter invocation that re-reads the committed state — plus its retained output from this run.

Execute that independent re-query and retain its output before any cleanup that intentionally removes the claimed state. If raw evidence was not retained or this pre-cleanup re-query does not reproduce the claim, the result is `unverified`. A post-cleanup absence probe is a separate cleanup oracle: name it as such, retain its exact command and output, and never present an intentionally failing post-cleanup query as the scenario's re-query. Every probe named in the report is exact and replayable — a command or a recorded adapter invocation; “the corresponding command” is neither. When one plan leaf bundles independently verifiable cases, report each separately; an unexecuted case is `blocked` with its missing fixture or capability.

## Execution completion gate

Before cleanup or reporting, confirm:

- every dependency has a boundary row;
- the capability map either satisfies gates or names exact blockers;
- environment contract values and deployment freshness are concrete;
- every entity has ownership and retention metadata;
- schedule decisions cite their root cause;
- every scenario has a terminal status, oracle type, proof chain or explicit deficit, and diagnosis for failures/blockers;
- volatile failure scenes are already preserved.

Then read [REPORTING.md](REPORTING.md).
