# E2E Test Executor Reference

## Run Artifact Contract

Use this whenever creating an E2E run directory. The Markdown report remains the agent handoff source of truth and the default home for run, scenario, evidence, and failure-scene facts. Produce the default file by default. Produce conditional core directories only when their trigger exists. Produce optional files only when a programmatic consumer, rerun/comparison tooling, or the user asks for them.

Default core file:

| File | Required content |
|---|---|
| `execution-report.md` | Human and agent-readable report with run metadata, per-scenario results, inline evidence/scene proof chains, defect dispositions, cleanup state, and rerun instructions. |

Conditional core directories:

| Directory / file | Trigger | Required content |
|---|---|---|
| `issues/index.md` | One or more `OPEN` actionable root causes exist. | Local fix-queue table with issue id, disposition, type, severity, affected scenarios, suspected area, and post-fix E2E rerun target. |
| `issues/ISSUE-*.md` | One per `OPEN` actionable root cause. | Local agent-ready issue document; one root cause, not one scenario. The issue is the unit a repair agent scans, fixes, verifies, and closes. |
| `attachments/` | Evidence is too large, binary, or noisy to inline in the report. | Overflow raw payloads, screenshots, long logs, or exported data. Use stable scenario-prefixed filenames; do not create per-scenario directories by default. |

Optional files (only when a consumer needs them):

| File | When to produce | Required content |
|---|---|---|
| `run-metadata.json` | A programmatic consumer needs machine-readable run metadata. | Plan path or ID, plan contract version when present, environment kind, repo commit, selected scenario IDs, command surface, started/finished timestamps, status counts, toolchain versions, cache/dependency sources, and operator/agent identifier when available. |
| `scenario-results.jsonl` | Rerun or comparison tooling consumes per-node rows. | One JSON object per DAG node or scenario with node ID, scenario ID, status, dependency status, consumed variables, produced variables, evidence/scene links, issue IDs, cleanup status, and diagnosis. |
| `execution-report.html` | A human stakeholder asks for a rendered report. | Human-readable rendering generated from the same facts as the Markdown report and attachments. |

Optional and overflow artifacts must not introduce facts absent from `execution-report.md`; they only preserve bulky raw data or accelerate programmatic and human consumers.

### `execution-report.md` structural contract

A delegated executor's report is machine-checkable. A valid `execution-report.md` must:

- Carry these sections, with `Execution Summary` first: `Execution Summary`, `Run Metadata`, `Environment & Capability Map`, `DAG Schedule`, `Scenario Results`, `Evidence & Failure Scenes`, `Failures / Defects / Plan Gaps`, `Data Created & Cleanup`, `Re-run Instructions`, `Next Actions for Agent`.
- Give every scenario in `Scenario Results` a terminal status from `passed`, `failed`, `blocked`, `skipped` - no other word stands in for a status.
- Link any `failed` scenario row directly to an evidence/scene anchor in the same report or to an `attachments/` artifact; a failure with no evidence/scene link is a contract breach, not a pass.
- Include scenario-keyed proof chains in `Evidence & Failure Scenes`: probe, expected, actual, raw evidence summary or attachment paths, retained scene, cleanup safety, and rerun cue.
- Link every `OPEN` actionable root cause in `Failures / Defects / Plan Gaps` to a local `issues/ISSUE-*.md` document on the same item, and link the same issue from every affected `Scenario Results` row.
- Give `Re-run Instructions` at least one executable command, not prose alone.

Completion criterion: a follow-up agent can rerun a scenario, inspect every failure scene, compare expected versus actual probes, and decide cleanup safety from the run directory alone using `execution-report.md` plus any referenced attachments; `OPEN` actionable root causes have local issue documents; optional files are added only when a named consumer needs them.

## Scenario Results & Evidence Legibility

A delegated report is read scenario-first. The recurring failure it prevents: a reader - human or follow-up agent - forced to join three places (the status table, the `Failures` prose, and separate evidence/scene directories) to reconstruct one scenario's story. Co-locate the story instead.

**Self-contained `Scenario Results` row.** Beside its terminal status, each row carries the expected outcome, the actual outcome, a diagnosis-classification token, an issue link when the row is affected by an actionable root cause, and one evidence/scene link:

| Scenario | Status | Expected | Actual | Diagnosis | Issue | Evidence / scene |
|---|---|---|---|---|---|---|
| {scenario-id} | `failed` | {what the probe asserts} | {what was observed} | `ENUM_VALUE` | issues/ISSUE-001-{slug}.md | #scenario-evidence-scene |

- `Expected`/`Actual` are one-line deltas, not full prose - depth lives in the evidence/scene block the row links to. Keep cells terse so the table stays scannable when scenarios are many.
- `Diagnosis` is the section 5 classification token only (`product`/`plan`/`environment`/`tooling`/`unknown`) - a closed-set enum, never a sentence. The full reason and disposition stay single-sourced in `Failures / Defects / Plan Gaps`.
- `Issue` is a local `issues/ISSUE-*.md` link for each affected `OPEN` actionable root cause. Use a dash when the row has no actionable issue. A row affected by an `OPEN` actionable root cause must not omit the issue link.
- `Evidence / scene` links to a same-report anchor by default; use `attachments/` only for bulky raw data. Do not create `evidence/`, `preserved-scenes/`, or per-scenario directories by default.
- This is healthy denormalization: a status or enum token restated on the index row is near-zero drift; a paragraph restated is not. Never copy the failure-reason prose onto the row.

**Scenario and defect are different units.** `Scenario Results` is keyed by scenario; `Failures / Defects / Plan Gaps` is keyed by defect/root-cause, which can fan out to several scenarios. When one defect spans multiple scenarios, write it once in `Failures` with a defect id and an affected-scenario list, create one local issue document for that root cause, and link every affected row to the same issue - do not restate it per row. This is why the two sections cannot be merged: they project the same data on different axes.

**Local issue documents.** `issues/` is a local fix queue. Repair agents can scan this directory, pick `OPEN` issue documents, implement a targeted fix, and then invoke this executor for the named post-fix E2E rerun. Create one `issues/ISSUE-*.md` document per `OPEN` actionable root cause, not per scenario. Each issue carries `Issue ID`, `Type`, `Severity`, `Disposition`, `Affected scenarios / edges`, `Expected`, `Actual`, `Evidence / scene`, `Suspected code area`, `Reproduction steps`, `Fix constraints`, `Verification command or scenario`, `Post-fix E2E rerun`, `Closure rule`, and `Cleanup / data impact`. An issue can move to `CLOSED` only after the fix is loaded, the named E2E rerun and affected DAG dependents pass, and the rerun report/issue status are updated. These files are local handoff artifacts only; remote tracker creation or sync stays out of scope unless explicitly requested.

**Evidence & Failure Scenes.** Organize the report section as one short proof chain per scenario: probe, expected, actual, raw evidence summary or attachment paths, retained scene / cleanup safety, and rerun cue. A `Scenario Results` evidence link lands on this proof, not an undifferentiated dump. The chain is domain-neutral: a `failed` payment-validation scenario reads `probe: result field after the callback / expected: rejected / actual: ENUM_VALUE / raw: request, response, row snapshot`; a `failed` content-moderation scenario reads `probe: verdict field after submit / expected: blocked / actual: ENUM_VALUE / raw: request, response, audit record` - the shape is identical, only the field/entity terms differ.

Completion criterion: a reader learns a scenario's verdict and why from its row alone, following the row's issue link reaches the actionable root-cause document, and following the evidence/scene link reaches a per-scenario proof chain; no failure-reason prose is duplicated between a row and `Failures`.

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
| Cleanup policy | Preserve traces by default for local/test E2E runs; name the retained keys, TTL, cleanup command, and any explicit cleanup override. |
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

## Execution Contract Override

When the user changes the contract after the plan was written, capture it once near the top of `execution-report.md` so every later section and any re-run inherits the corrected contract instead of the stale plan default. Use `## Execution Contract Override` for English output and `## 执行契约覆盖` for Chinese output.

One row per override:

| Column | Required content |
|---|---|
| Supersedes | The plan default being overridden — a cleanup/exit criterion, an included scenario, or a tool assumption. |
| New rule | What now holds: e.g. preserve data, exclude scenarios X/Y, MCP-only (no CLI), a changed exit criterion. |
| Source | Where the constraint came from — the user turn or instruction. |
| Affected | Scenarios, gates, or report sections this override changes. |

A superseded plan requirement is marked `superseded` wherever it appears (gates, exit criteria, scenario results) — never `failed`, `incomplete`, or left looking unmet. A data-retention override additionally triggers the §3 re-risk of every destructive, soft-delete, or scope-mutating scenario.

Completion criterion: every constraint the user changed after planning appears as an override row; no plan default an override replaced is reported as an unmet requirement.

## Execution Adapter Boundary

Use this boundary whenever a scenario trigger goes through a project-declared adapter, harness, wrapper, driver, query tool, queue/job control, callback harness, or local service command instead of direct manual observation.

The E2E executor owns orchestration: scenario selection, DAG order, environment and trigger-channel gates, data policy, evidence capture, diagnosis, cleanup, report lineage, and final status. The adapter or tool owns action mechanics: target or locator resolution, operation or selector discovery, describe/preflight/dry-run behavior, request or action construction, input encoding, metadata/options, invocation, navigation, querying, and replay.

Do not copy adapter-specific invocation, navigation, or query rules into this skill or into the report as reusable guidance. Record only the adapter evidence needed for the run: adapter/tool or command name, version or path when available, target or locator, operation or action, selected inputs, metadata/options that affect behavior, describe/preflight/dry-run evidence when available, raw artifact paths, correlation IDs, and the failure layer.

If more than one adapter or tool is available, choose the one declared by the plan, project docs, repository scripts, or environment contract. If none is declared, use a safe read-only describe/list/probe command before any real trigger; when no safe adapter, tool, or command can trigger the scenario, record `BLOCKED-BY-TOOLING` with the missing adapter or tool capability. Do not hand-roll surface payloads or UI actions merely to avoid the blocker.

Completion criterion: the report can separate E2E orchestration evidence from adapter/tool action evidence, names the adapter or tool used or the missing capability, and preserves enough raw artifacts for a follow-up agent to replay through the same declared surface without copying surface-specific rules into this executor.

## Gap & Defect Disposition

One disposition vocabulary, shared with the planner (its gaps) and used here for `Failures / Defects / Plan Gaps`, so a reader never mistakes a settled item for a pending failure. The token is a closed set; specifics (which tool is missing, which decision closed it) go in the item's reason, not the token — that keeps the vocabulary portable.

| Disposition | Meaning |
|---|---|
| `OPEN` | Real, unresolved, must be acted on. |
| `CLOSED` | Verified done, or no longer applicable. |
| `MITIGATED` | A workaround is in place; residual risk is noted. |
| `ACCEPTED` | Known and deliberately accepted; no action planned. |
| `CONDITIONAL` | Actionable only once a stated precondition holds; the precondition is named. |
| `BLOCKED-BY-TOOLING` | Cannot proceed for lack of a specific capability; the missing capability is named in the reason. |
| `OUT-OF-SCOPE` | Excluded from this run by scope or user override. |

Only `OPEN` items belong in `Next Actions for Agent`. A `CONDITIONAL`, `BLOCKED-BY-TOOLING`, or `OUT-OF-SCOPE` item stays in `Failures / Defects / Plan Gaps` with its precondition, missing capability, or scope reason named — never copied into Next Actions as a plain to-do.
