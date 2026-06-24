# E2E Test Executor Reference

## Run Artifact Contract

Use this whenever creating an E2E run directory. The Markdown report remains the agent handoff source of truth and the default home for run and scenario facts. Produce the core files by default; produce the optional files only when a programmatic consumer, rerun/comparison tooling, or the user asks for them.

Core files (always):

| File | Required content |
|---|---|
| `execution-report.md` | Human and agent-readable narrative summary that includes run metadata and per-scenario results inline, backed by the evidence files. |
| `evidence/index.md` | Bounded index of raw requests, responses, DB/query results, logs, metrics, queue/job state, screenshots, configs, and rerun commands. |
| `preserved-scenes/` | Failure-scene snapshots or links, each with owner, TTL, cleanup command, risk, and redaction notes. Produced whenever a scenario failed or is unknown. |

Optional files (only when a consumer needs them):

| File | When to produce | Required content |
|---|---|---|
| `run-metadata.json` | A programmatic consumer needs machine-readable run metadata. | Plan path or ID, plan contract version when present, environment kind, repo commit, selected scenario IDs, command surface, started/finished timestamps, status counts, toolchain versions, cache/dependency sources, and operator/agent identifier when available. |
| `scenario-results.jsonl` | Rerun or comparison tooling consumes per-node rows. | One JSON object per DAG node or scenario with node ID, scenario ID, status, dependency status, consumed variables, produced variables, evidence paths, preserved-scene paths, issue IDs, cleanup status, and diagnosis. |
| `execution-report.html` | A human stakeholder asks for a rendered report. | Human-readable rendering generated from the same facts as the Markdown report and evidence. |
| `issue-backlog.md` | Defects are too many to inline in `execution-report.md`. | Local agent-ready issues only; do not create remote tracker issues by default. |

Optional files must not introduce facts absent from `execution-report.md` or `evidence/`; they only accelerate programmatic or human consumers.

### `execution-report.md` structural contract

A delegated executor's report is machine-checkable. A valid `execution-report.md` must:

- Carry these sections, with `Execution Summary` first: `Execution Summary`, `Run Metadata`, `Environment & Capability Map`, `DAG Schedule`, `Scenario Results`, `Evidence Index`, `Failures / Defects / Plan Gaps`, `Data Created & Cleanup`, `Re-run Instructions`, `Next Actions for Agent`.
- Give every scenario in `Scenario Results` a terminal status from `passed`, `failed`, `blocked`, `skipped` — no other word stands in for a status.
- Reference a kept failure scene (`preserved-scenes/…`) on the same row as any `failed` scenario; a failure with no preserved scene is a contract breach, not a pass.
- Reference the core handoff index `evidence/index.md`.
- Give `Re-run Instructions` at least one executable command, not prose alone.

Completion criterion: a follow-up agent can rerun a scenario, inspect every failure scene, compare expected versus actual probes, and decide cleanup safety from the run directory alone using the core files; optional files are added only when a named consumer needs them.

## Run Lineage & Emergent Scenarios

Keep run provenance and out-of-plan backflow in one place near the top of `execution-report.md`, so a follow-up agent or a later rerun can reconstruct the full chain from the report alone, without grepping the feature's `docs/e2e-test/<feature>/` folder.

Lineage block — a short list naming (use `none` for a field that does not apply):

- `Upstream plan` — the source plan path or ID, and contract version when present;
- `Upstream run` — the prior run directory this run continues, or `none`;
- `Downstream` — reruns or investigation documents spawned by this run, or `none`;
- `Status` — `open` or `closed`.

Emergent scenarios table (only when the run discovered out-of-plan scenarios): one row per finding, with columns. Record every emergent finding as a row here — a finding described only in prose is not tracked and does not satisfy backflow.

| Column | Required content |
|---|---|
| Emergent scenario | A new scenario ID and a one-line purpose. |
| Source trigger | What surfaced it during the run — e.g. a failure, a repro, or an unexpected side effect. |
| Risk family | The risk family the finding belongs to. |
| Plan section to update | The source-plan section or risk family this finding patches; name a new risk family when none fits. |
| Status | `proposed`, `accepted`, or `closed`. |

Completion criterion: the lineage names the upstream plan; every emergent scenario names where it backflows into the plan plus a status; any rerun or investigation document this run spawns back-links to the source plan and the prior run. No out-of-plan P0/P1 finding is left only in this report.

## Environment State Ledger

A resume snapshot near the top of `execution-report.md`: one block that consolidates the environment facts otherwise scattered across `Run Metadata`, `Environment & Capability Map`, and `Data Created & Cleanup`, so a re-opened agent can decide continue/persist/cleanup from the ledger alone. The detail sections stay; the ledger is the index over them.

Carry at least these fields:

| Field | Required content |
|---|---|
| Target | System under test and entry surface: base URL, RPC target, or service, plus the run kind (local/test). |
| Datasource | The database/schema, cache, queue, or store the run reads and writes, named to the concrete instance. |
| Deployment/freshness evidence | Proof the run is on the intended code: version, build, commit, or start time, or a behavioral fingerprint whose result differs between old and new code. A reachable endpoint is not evidence. |
| Isolation namespace | The owner marker scoping this run's writes: batch prefix, tenant, trace ID, or data prefix. |
| Created data | What this run created, by entity and namespace, with counts where they matter. |
| Cleanup policy | Whether the run cleans or preserves, the cleanable keys, and the items that must not be cleaned. |
| Remaining traces | What is intentionally left after the run: retained rows, files, or queue state, with owner and TTL. |
| Tool permissions | Trigger-channel access actually held: the auth, allowlist, routing-override, and fallback-route permissions for the trigger surface — for RPC/SDK, auth/token, invoke and service allowlists, target overrides, and direct-URL fallbacks. |

Write the ledger as a bullet list, one field per line with its value inline after the colon — the table above defines the fields, not the output format.

Completion criterion: an agent reading only the ledger knows whether the environment can continue (freshness evidence is real, not `reachable`), what data persists, and what must not be cleaned. The deployment/freshness evidence and cleanup policy fields name real values, not placeholders. These same facts are gated before the run by the [Environment Contract preflight](#environment-contract-preflight).

## Environment Contract preflight

The §2 completion criterion blocks the first real trigger until three contract facts hold *resolved* values. This is the preflight subset of the [Environment State Ledger](#environment-state-ledger) — the same facts, enforced before the run rather than reported after it. The recurring failure it prevents is starting execution on an *assumed* environment: trusting a profile name, an inherited PATH, or a reachable process instead of the resolved fact.

Scope the contract to what the selected scenarios actually reach — the datasource, toolchain, and process the run will exercise. An in-scope target that cannot be resolved is a blocker; a remote dependency that is merely unreachable follows the §5 dependency-availability rule (mark the dependent scenario `blocked`, or use the declared stub), not a whole-run halt.

`Resolved` means a concrete value read from the effective state and recorded verbatim — never inferred from a name and never `reachable`:

| Contract fact | Resolved means | Assumption that fails the gate |
|---|---|---|
| Effective datasource | The real connection target read from the *effective* config — host, database, schema — plus a probe that the schema or fields the code expects actually exist. | "The active profile/config is named `local`, so it must be the local store." A profile or config name is not a datasource; a column or field the code expects but the target lacks is a schema-vs-code mismatch the probe catches before the run, not mid-scenario. |
| Toolchain identity | The actual tool paths and versions the run's own shell resolves — captured from that shell (the build/runtime tool path and its version output), with any toolchain-selecting env var or version manager pinned. | "The build tools are on PATH." The agent's non-interactive shell resolves PATH and the active toolchain differently from a human interactive shell, so a build can silently use the wrong SDK/runtime version — whatever env var or version manager selects it. |
| Deployment fingerprint | Proof the running process is the artifact under test: a version, build, commit, start time, or behavioral fingerprint that differs between old and new code. | "The process/RPC is reachable, so it is the new code." A reachable endpoint is not proof a build is loaded; a pre-existing process may predate the change. |

When the effective config resolves to the wrong or ambiguous target, promote the corrected contract to an explicit, reproducible override — env vars or launch parameters — and record it as the canonical launch in `Re-run Instructions`, rather than rediscovering it ad hoc on the next run.

Completion criterion: each in-scope contract fact names a resolved value before the first real trigger; any unresolved in-scope field is a `blocked` reason, not an assumption carried into execution.
