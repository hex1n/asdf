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
