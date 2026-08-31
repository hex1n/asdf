# E2E Test Executor Reference

## Run Artifact Contract

Use this whenever creating an E2E run directory. The Markdown report remains the agent handoff source of truth and the default home for run, scenario, evidence, and failure-scene facts. Produce both default core files unless the user explicitly requests Markdown-only. Produce conditional core directories only when their trigger exists. Produce optional files only when a programmatic consumer or rerun/comparison tooling needs them.

Default core file:

| File | Required content |
|---|---|
| `execution-report.md` | Human and agent-readable report with run metadata, per-scenario results, inline evidence/scene proof chains, defect dispositions, cleanup state, and rerun instructions. |
| `execution-report.html` | Picture-first, few-words [Reader View](#reader-view-contract) projected from the Markdown facts. |

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

Optional and overflow artifacts must not introduce facts absent from `execution-report.md`; they only preserve bulky raw data or accelerate programmatic and human consumers.

### `execution-report.md` structural contract

A delegated executor's report is machine-checkable. A valid `execution-report.md` must:

- Carry these sections, with `Execution Summary` first: `Execution Summary`, `Run Lineage & Emergent Scenarios`, `Environment State Ledger`, `Execution Contract Override` (when the user overrode plan defaults), `Run Metadata`, `Environment & Capability Map`, `DAG Schedule`, `Scenario Results`, `Evidence & Failure Scenes`, `Failures / Defects / Plan Gaps`, `Data Created & Cleanup`, `Re-run Instructions`, `Next Actions for Agent`.
- Give every scenario in `Scenario Results` a terminal status from `passed`, `failed`, `blocked`, `skipped`, `unverified` - no other word stands in for a status - and an [oracle type](#oracle-types).
- Carry the [SUT Boundary](#sut-boundary) table inside `Environment & Capability Map`, and cite a [root-cause row](#scheduling-by-root-cause) for every node in `DAG Schedule`.
- Link any `failed` scenario row directly to an evidence/scene anchor in the same report or to an `attachments/` artifact; a failure with no evidence/scene link is a contract breach, not a pass.
- Include scenario-keyed proof chains in `Evidence & Failure Scenes`: probe, expected, actual, raw evidence summary or attachment paths, retained scene, cleanup safety, and rerun cue.
- Link every `OPEN` actionable root cause in `Failures / Defects / Plan Gaps` to a local `issues/ISSUE-*.md` document on the same item, and link the same issue from every affected `Scenario Results` row.
- Give `Re-run Instructions` at least one executable command — or, for a replay surface without executable bytes, the recorded adapter invocation sequence — not prose alone.
- Reconcile IDs in **both** directions, because a one-directional read passes while half the pair is missing: every scenario in the recorded selection set has a `Scenario Results` row; every `issues/ISSUE-*.md` is linked from at least one row; every scenario, issue, or root-cause ID cited anywhere in the report resolves to something this report defines, or is marked as belonging to the upstream plan rather than this run. Take the selection set from the set recorded at intake, not from the IDs the report happens to mention — a scenario named only as a neighbouring precondition is a reference, not a selection.

Completion criterion: the report's IDs reconcile in both directions; a follow-up agent can rerun a scenario, inspect every failure scene, compare expected versus actual probes, and decide cleanup safety from the run directory alone using `execution-report.md` plus any referenced attachments; `OPEN` actionable root causes have local issue documents; optional files are added only when a named consumer needs them.

## Path Containment Proof

Creating a directory or file target is itself a write, so a create-then-check sequence has already failed this gate. Every run directory, continuation directory, fixture, and helper-created target satisfies this proof **before** the create call:

1. Canonicalize the existing parent and the user-authorized workspace or output boundary.
2. Prove the parent resolves inside that boundary and is not reached through a symlink or traversal component.
3. Validate the proposed absent target lexically as one direct child — the required prefix where one applies, and no traversal component.
4. Create it, then canonicalize the result and re-prove the direct-child relation.

Record the validated parent and proposed target in the `Environment State Ledger` before writing. A relative path, system temporary directory, or tool default carries its own authorization only when the user established that boundary. When any step fails, stop before the create call and either choose an in-boundary target or mark that path blocked.

Recursive deletion satisfies the same proof plus an ownership check: canonicalize both the run directory and the target, require the target to be a direct non-symlink child of the canonical run directory, and require the owner marker's recorded run or entity identity to match the requested cleanup. Reject a lexical match that contains traversal, resolves elsewhere, or carries a mismatched owner.

## Replay Entry Point Contract

Open this section only when the run generates a rerun entry point. Generated replay helpers are evidence-bearing interfaces, not disposable conveniences. A rerun entry point is either an **executable helper** — a script, CLI wrapper, or test task whose bytes and exit status the run controls — or, when the replay surface is an adapter without executable bytes (a browser connector, an MCP tool, a queue or job console), the **recorded adapter invocation sequence** the agent replays step by step, named as such in `Re-run Instructions`. The first group binds every replay surface; the second binds executable helpers only.

### Every replay surface

- Expose rerun as one orchestration entry point — the executable helper, or the recorded adapter invocation sequence the agent replays step by step. It creates a fresh continuation directory, invokes any lower-level seed/verify/cleanup helpers there, and never writes mutable state into the current historical run or overwrites its report, attachments, metadata, or fixture-path records. `Re-run Instructions` invoke this entry point, not a loose sequence whose later commands can run after an earlier failure.
- Phase-gate the trigger, wait, probe, verification, and cleanup flow inside that entry point. A failed trigger, wait, probe, or oracle — a nonzero status or an adapter's returned error — stops later business phases and denies cleanup even when report verification succeeds; capture and retain the scene instead. Latch that first failure through every later recovery action: neither a later success nor a generic fallback status can mask it.
- Treat every continuation, including a forced-failure probe, as a run: create its canonical `execution-report.md` (and `plan-snapshot.md` when intake facts are needed), back-link the original plan and historical run, assign terminal scenario status/oracle/diagnosis, and keep all phase receipts there. Do not invent `execution-attempt.md`, a probe-only log, or another report name.
- After any trigger or mutation, capture the best available committed state, events/jobs/queues, logs, identifiers, exact probe commands or adapter invocations and their outputs, phase receipts, historical hash receipts, and exact rerun command or recorded invocation sequence before cleanup even when wait, probe, oracle evaluation, or report generation failed. Count ownership scaffolding such as a created state directory or owner marker as mutation even when no business row or file appeared; the report and ledger must describe its actual terminal state.
- Materialize the canonical report with the captured pre-cleanup scene and the literal terminal field `cleanup: pending`, then read/hash-verify the bytes at that exact path before cleanup; `retained` describes a later denied-cleanup terminal state and is not a synonym at this gate. This applies after any mutation, including continuation-directory or owner-marker scaffolding followed by a pre-trigger block. Persist the verification receipt and canonical-report hash before cleanup. A report-write or verification failure skips cleanup and retains the owned scene with owner, TTL, cleanup command, and risk in that continuation's canonical report. After safe cleanup, run an exact separately named absence oracle, retain its command and output, and update the canonical report through a write-read-hash-verify-and-replace sequence; if the update cannot be verified, keep the already verified pending report intact rather than truncating or overwriting it.
- If capture is incomplete or retained state is still needed to diagnose the failure, skip cleanup and record owner, TTL, cleanup command, and risk. Otherwise cleanup may run, but its status is reported separately. Successful cleanup removes business state, ownership scaffolding, and the empty state directory unless the report names a retained-state reason. Parse the terminal report semantically: `cleanup: completed` requires the observed cleanup status and output and a passing absence oracle, with no stale `not executed`, `pending`, or retained-state claim; substring presence alone cannot pass this gate.
- Before recursive deletion, satisfy the deletion clause of [Path Containment Proof](#path-containment-proof).
- Apply the same ownership, containment, proof, and first-failure gates to a retained-state cleanup entry point. On success it removes owned business state, the owner marker, and the empty state directory, then updates `execution-report.md` with the observed cleanup status, stdout, stderr (or the adapter's returned output), and exact absence-oracle receipt through the verified replacement sequence above. Build that terminal update from the observed receipt after cleanup; never install a prebuilt final report that still says `not executed`, `pending`, or `retained`. It creates no unlisted root-level result file and leaves the canonical report truthful if its update fails.

### Executable helpers only

- Preserve the first nonzero status through every later exception handler: a catch/finally path reports later tooling errors separately but exits with the earlier nonzero when one already exists. A parent orchestration entry point latches a child's nonzero status before forwarding the child's stdout/stderr or performing any other fallible handoff; forwarding errors are separate tooling receipts and cannot replace the latched child status.
- Bind evidence to executable bytes: hash every generated helper before the first mutation, record those hashes in the canonical report or snapshot, and re-hash them at delivery. A changed helper invalidates the run and requires a fresh execution; never advertise or validate helper bytes edited after the recorded attempt.
- Satisfy [Path Containment Proof](#path-containment-proof) inside generated helpers, not only in the agent's own steps.
- Audit every mutable path against the fresh continuation before advertising the entry point as runnable.

### Contract probes before advertising an executable helper

Run these three safe probes, then the two checks below them:

1. **Pre-trigger block** — force a nonzero after continuation and ownership scaffolding exist but before the business trigger.
2. **Business-phase failure** — mutate a dedicated fixture and force a real wait, probe, or oracle failure while report verification still succeeds.
3. **Report-write failure** — mutate a dedicated fixture, then simulate failure of the first canonical-report write or verification. This probe must prove cleanup was skipped while the scene remained, then write a recovery canonical report.

Each probe must preserve the first nonzero status, produce a canonical continuation report, retain the failure scene before any cleanup, truthfully report and clean or intentionally retain all scaffolding, name owner, TTL, exact cleanup command, and risk whenever state remains, report cleanup or retention separately, and store before/after historical-report and attachments hashes as probe-interval receipts in that continuation report.

Then also:

- Exercise the retained-state cleanup entry point and prove its owner check, allowlist, absence oracle, and canonical-report update.
- Inject a parent-side output-forwarding failure after a child nonzero and prove the advertised parent still exits with the child's first nonzero.

If any branch cannot be proven, mark the helper unverified and do not present it as the rerun command.

## Reader View Contract

`execution-report.html` is the human entry point; `execution-report.md` remains the canonical report and sole evidence source. Build the HTML only after Markdown is final. Use two layers: an answer-first visual index, then a complete semantic HTML projection of every report section and every scenario proof chain. `<details>` may collapse secondary material, but the user must not need Markdown to see a fact needed to understand, audit, rerun, or clean up the run. A visible count, status, scenario, diagnosis, disposition, issue, environment fact, rerun item, or next action must already exist in Markdown and trace back to its heading or evidence/defect row.

Treat the Reader View and every page reachable from it as an HTML-only navigation surface:

- Every user-clickable local `href` ends in `.html` (optionally with a fragment) or is a same-page `#fragment`. Never link `.md`, `.json`, `.jsonl`, `.sql`, `.txt`, or `.log` directly from a browser-facing page.
- Keep each canonical/raw artifact unchanged, and generate a UTF-8 HTML companion beside it or in the same run directory. Markdown companions render semantic headings, tables, lists, links, and code blocks; JSON/JSONL/SQL/log/text companions may use an escaped `<pre>` with a short title and provenance label. Every companion declares `<meta charset="utf-8">`, works offline, and links onward only to HTML companions or fragments.
- The full-detail/canonical link in the opening Reader View points to an HTML detail projection. Show the canonical Markdown or raw path as non-clickable `<code>` when provenance matters.
- This requirement is about browser navigation, not duplication of authority: HTML companions are projections; Markdown and raw files remain the source of truth.

Use a picture-first opening screen with large status shapes and short labels:

- **Verdict distribution** — cards for `passed`, `failed`, `blocked`, `unverified`, and `skipped`, including zeroes. The headline names every nonzero non-passing bucket and never implies green/pass merely because execution finished.
- **Trust strip** — target, deployment/freshness evidence, selected scope, and cleanup/retention state from the Environment State Ledger.
- **Failure and blocker lane** — each failed, blocked, or unverified root cause with diagnosis, disposition text/icon, affected scenario IDs, and an evidence or issue link.
- **Rerun lane** — the exact rerun set and only the `OPEN` items eligible for `Next Actions for Agent`; keep conditional and blocked work visibly distinct.

On a standard desktop opening screen, all four groups are visible together. The non-passing lane is **index-only**: one compact row per root cause containing ID, diagnosis, disposition, affected scenarios, and a detail link — no reason prose or separate scenario chips. Every root cause remains visible in this opening index. The rerun lane expands every explicitly named dependent into the exact ID set; a dependent mentioned only in prose but absent from that set is an omission.

Below the opening screen, render every scenario result once as the execution comparison table, keyed by the upstream plan's scenario ID, with exactly these primary columns (localized with the report language): **Scenario**, **Expected Input**, **Expected Result**, and **Actual Result**. Expected Input and Expected Result are copied from the upstream plan contract; Actual Result contains only runtime observations from this run. Never backfill either expected column from the actual response. Keep status, oracle, diagnosis, path/requirements/observes, evidence/scene, issue, and the complete probe chain in that row through compact badges, links, and a `details` disclosure. Do not reproduce the Markdown scenario field or bullet dump below the table.

Keep bulky raw evidence in its canonical artifact, expose it through an HTML companion, and keep the probe→expected→actual proof chain in the complete HTML layer. Use `<details>` for secondary environment, lineage, and cleanup summaries when useful.

Apply the same visual grammar as a focused explanatory artifact: sequence/state change uses a connected flow or timeline; mappings and comparisons use tables; hierarchy uses grouped cards or a shallow tree; single facts stay prose. Put visuals beside the short text they clarify, use real labels/IDs, and avoid oversized hero blocks, decorative whitespace, dense undifferentiated cards, and diagrams that only restate lists. Scenario detail answers in plain language: why it ran, how it was triggered, where the committed result was observed, and how the oracle decided the verdict; exact identifiers and evidence remain intact.

The Reader View follows the resolved audience language from `SKILL.md` for headings, buttons, cards, and explanatory text — this can differ from a legacy report's language when the upstream plan or user establishes the audience. Do not add bilingual UI labels unless the resolved audience artifact is bilingual or the user asks. Translate generic field and section labels; preserve identifiers, commands, logs, enum tokens, and quoted evidence as-is, showing preserved machine tokens as code/badges rather than appending them to translated labels. Render Markdown syntax as HTML — inline code uses `<code>`, with no visible backticks, table pipes, or escape residue. Use semantic, responsive HTML and inline CSS that works offline. Communicate status with labels/icons in addition to color. Use no external fonts, scripts, CDNs, or automatic browser opening.

Do not hand-build a renderer. This skill ships one at [`tools/reader-view.mjs`](tools/reader-view.mjs); it takes a JSON data file and emits the Reader View, its HTML companions, and the static audits below:

```bash
node <skill>/tools/reader-view.mjs render <run-dir>/reader-view.json
node <skill>/tools/reader-view.mjs audit  <run-dir>/reader-view.json
```

The data file's required keys are the render contract — the tool refuses the file naming any missing one, so build them all before invoking it:

- Top level: `mode` (`"run"`), `title`, `canonical` (the Markdown report path), `out` (the HTML file to write), `scenarios`, `opening`. Optional: `subtitle`, `kicker`, `tableNote`, `companions` (`{src, label}` per artifact), `cellAnchors`, `audit`.
- Each scenario row: `id`, `title`, `input`, `expected`, `actual`, `status`, `oracle`. Optional: `branch` (grouping header) and `fields` (the row's `details` disclosure).
- `opening`: `verdicts` (all five buckets, zeroes included, as `{k, n, label}`), `trust`, `lane`, `rerun`, `headline`. Optional: group labels and `rerunNote`.

Beyond those keys, describe only what changes per run — titles, opening groups, scenario rows, companions, and the audit's expected sections, ID patterns, selection set, and stale tokens. The renderer owns the markdown→HTML engine, the visual grammar, companion generation, and every static audit rule, so a fix there reaches every future run. Hand-copying a previous run's renderer is what produced stale headlines, stale first-screen footnotes, and companion links to files that no longer existed; a data file has nowhere for that staleness to hide. When the tool is absent or fails, fall back to the withheld-Reader-View rule at the end of this section rather than writing a replacement.

Before handoff, close both audits — and know the duty split: the tool's `audit` covers only the **static** half (projection inventory, link targets, encoding, render residue); everything requiring rendered eyes stays the executing agent's work, and a green tool exit is not the gate. **Projection completeness** (tool): compare Markdown and HTML inventories for every required report section, scenario/status/oracle/diagnosis, proof chain, defect/disposition/issue, rerun ID, next action, environment/fingerprint fact, created-data key, cleanup state, and nonzero/zero verdict count; any missing item fails. **Navigation** (tool): crawl every local `href` in `execution-report.html` and all reachable companion pages; fail if a target is not `.html`/`#fragment`, is missing, escapes the intended report suite, lacks UTF-8 metadata, or contains decode replacement characters, or if serialized visible text carries a bare backtick or table-pipe residue outside `<code>`/`<pre>`. **Visual QA** (agent): render desktop and mobile widths; open every first-level link and inspect flow continuity, contrast, focus, wrapping, horizontal overflow, tables, and expanded detail. The opening index must expose every root cause and exact rerun set; the complete layer must expose every fact required to audit the verdict. Without render capability, hand off canonical Markdown alone and say the Reader View was withheld; never hand off an unrendered or incomplete view.

## Scenario Results & Evidence Legibility

A delegated report is read scenario-first. The recurring failure it prevents: a reader - human or follow-up agent - forced to join three places (the status table, the `Failures` prose, and separate evidence/scene directories) to reconstruct one scenario's story. Co-locate the story instead.

**Self-contained `Scenario Results` row.** Beside its terminal status, each row carries the expected outcome, the actual outcome, a diagnosis-classification token, an issue link when the row is affected by an actionable root cause, and one evidence/scene link:

| Scenario | Status | Oracle | Expected | Actual | Diagnosis | Issue | Evidence / scene |
|---|---|---|---|---|---|---|---|
| {scenario-id} | `failed` | `specified` | {what the probe asserts} | {what was observed} | `ENUM_VALUE` | issues/ISSUE-001-{slug}.md | #scenario-evidence-scene |

- `Oracle` is the [oracle type](#oracle-types) token; an `implicit` row cannot show `passed`.

- `Expected`/`Actual` are one-line deltas, not full prose - depth lives in the evidence/scene block the row links to. Keep cells terse so the table stays scannable when scenarios are many.
- `Diagnosis` is the `SKILL.md` mismatch class written as its short token only (`product`/`plan`/`environment`/`tooling`/`unknown` — `product defect` is written `product`) - a closed-set enum, never a sentence. The full reason and disposition stay single-sourced in `Failures / Defects / Plan Gaps`.
- `Issue` is a local `issues/ISSUE-*.md` link for each affected `OPEN` actionable root cause. Use a dash when the row has no actionable issue. A row affected by an `OPEN` actionable root cause must not omit the issue link.
- `Evidence / scene` links to a same-report anchor by default; use `attachments/` only for bulky raw data. Do not create `evidence/`, `preserved-scenes/`, or per-scenario directories by default.
- This is healthy denormalization: a status or enum token restated on the index row is near-zero drift; a paragraph restated is not. Never copy the failure-reason prose onto the row.

**Scenario and defect are different units.** `Scenario Results` is keyed by scenario; `Failures / Defects / Plan Gaps` is keyed by defect/root-cause, which can fan out to several scenarios. When one defect spans multiple scenarios, write it once in `Failures` with a defect id and an affected-scenario list, create one local issue document for that root cause, and link every affected row to the same issue - do not restate it per row. This is why the two sections cannot be merged: they project the same data on different axes.

**Local issue documents.** `issues/` is a local fix queue. Repair agents can scan this directory, pick `OPEN` issue documents, implement a targeted fix, and then invoke this executor for the named post-fix E2E rerun. Create one `issues/ISSUE-*.md` document per `OPEN` actionable root cause, not per scenario. Each issue carries `Issue ID`, `Type`, `Severity`, `Disposition`, `Affected scenarios / edges`, `Expected`, `Actual`, `Evidence / scene`, `Suspected code area`, `Reproduction steps`, `Fix constraints`, `Verification command or scenario`, `Post-fix E2E rerun`, `Closure rule`, and `Cleanup / data impact`. An issue can move to `CLOSED` only after the fix is loaded, the named E2E rerun and affected DAG dependents pass, and the rerun report/issue status are updated. These files are local handoff artifacts only; remote tracker creation or sync stays out of scope unless explicitly requested.

**Evidence & Failure Scenes.** Organize the report section as one short proof chain per scenario: probe, expected, actual, raw evidence summary or attachment paths, retained scene / cleanup safety, and rerun cue. A `Scenario Results` evidence link lands on this proof, not an undifferentiated dump. The chain is domain-neutral: a `failed` payment-validation scenario reads `probe: result field after the callback / expected: rejected / actual: ENUM_VALUE / raw: request, response, row snapshot`; a `failed` content-moderation scenario reads `probe: verdict field after submit / expected: blocked / actual: ENUM_VALUE / raw: request, response, audit record` - the shape is identical, only the field/entity terms differ.

Completion criterion: a reader learns a scenario's verdict and why from its row alone, following the row's issue link reaches the actionable root-cause document, and following the evidence/scene link reaches a per-scenario proof chain; no failure-reason prose is duplicated between a row and `Failures`.

## Run Lineage & Emergent Scenarios

Keep run provenance and out-of-plan backflow in one place near the top of `execution-report.md`, so a follow-up agent or a later rerun can reconstruct the full chain from the report alone, without grepping the feature's `docs/e2e-test/<feature>/` folder.

Lineage block — a PROV triple as a short list (use `none` for a field that does not apply):

- Entities — `Upstream plan` (the source plan path or ID, and contract version when present); `Upstream run` (the prior run directory this run continues); `Downstream` (reruns or investigation documents spawned by this run);
- Activity — `Run` (this run directory, start and end, selection set, and any `Execution Contract Override`);
- Agents — `Executor` (the runtime and model that ran it) and `Trigger` (the user instruction or automation that started it);
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

The environment contract in `EXECUTION.md` blocks the first real trigger until three contract facts hold *resolved* values. This is the preflight subset of the [Environment State Ledger](#environment-state-ledger) — the same facts, enforced before the run rather than reported after it. The recurring failure it prevents is starting execution on an *assumed* environment: trusting a profile name, an inherited PATH, or a reachable process instead of the resolved fact.

Scope the contract to what the selected scenarios actually reach — the datasource, toolchain, and process the run will exercise. An in-scope target that cannot be resolved is a blocker; a remote dependency that is merely unreachable follows the [SUT Boundary](#sut-boundary) rule (switch to the declared double, or mark the dependent scenario `blocked`), not a whole-run halt.

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

A superseded plan requirement is marked `superseded` wherever it appears (gates, exit criteria, scenario results) — never `failed`, `incomplete`, or left looking unmet. A data-retention override additionally triggers the re-risk in `EXECUTION.md`'s write-path branch of every `destructive-delete`, `soft-delete`, `scope-mutation`, `config-change`, or `external-effect` scenario.

Completion criterion: every constraint the user changed after planning appears as an override row; no plan default an override replaced is reported as an unmet requirement.

## Execution Adapter Boundary

Use this boundary whenever a scenario trigger goes through a project-declared adapter, harness, wrapper, driver, query tool, queue/job control, callback harness, or local service command instead of direct manual observation.

The E2E executor owns orchestration: scenario selection, DAG order, environment and trigger-channel gates, data policy, evidence capture, diagnosis, cleanup, report lineage, and final status. The adapter or tool owns action mechanics: target or locator resolution, operation or selector discovery, describe/preflight/dry-run behavior, request or action construction, input encoding, metadata/options, invocation, navigation, querying, and replay.

Do not copy adapter-specific invocation, navigation, or query rules into this skill or into the report as reusable guidance. Record only the adapter evidence needed for the run: adapter/tool or command name, version or path when available, target or locator, operation or action, selected inputs, metadata/options that affect behavior, describe/preflight/dry-run evidence when available, raw artifact paths, correlation IDs, and the failure layer.

If more than one adapter or tool is available, choose the one declared by the plan, project docs, repository scripts, or environment contract. If none is declared, use a safe read-only describe/list/probe command before any real trigger; when no safe adapter, tool, or command can trigger the scenario, record `BLOCKED-BY-TOOLING` with the missing adapter or tool capability. Do not hand-roll surface payloads or UI actions, or author new test code, merely to avoid the blocker.

Completion criterion: the report can separate E2E orchestration evidence from adapter/tool action evidence, names the adapter or tool used or the missing capability, and preserves enough raw artifacts for a follow-up agent to replay through the same declared surface without copying surface-specific rules into this executor.

## SUT Boundary

Declared before the first trigger as a facet of `Environment & Capability Map`, one row per dependency the selected scenarios reach. A verdict rests only on dependencies that have a row.

| Dependency | Kind | Source | Owner | Scenarios |
|---|---|---|---|---|
| {service, database, queue, cache, callback endpoint, clock, external API} | `real` or `double` (`stub`, `record-replay`, `fixture`) | {live target, or the double's location and the recording/fixture it plays} | {who maintains the double or the live target} | {scenario IDs that reach it} |

- A `real` dependency that is unreachable at run time switches to its declared double; with no double declared, the dependent scenario is `blocked` with an `environment defect`, except a scenario whose declared purpose is the dependency-down path.
- A `double` on a path the plan's Expected Results depend on is named in the scenario's evidence, so a reader knows which part of the outcome was computed by a stand-in.
- The clock is a dependency: a scenario that reads time or randomness names either its injected `double` or an independently observed `real` value the run recorded and recomputed its expected values from. Inferring that value from the same response being judged is circular and does not count as observation; a verdict whose expectation depends on a value the run neither controlled nor independently observed is `unverified`.

## Scheduling by Root Cause

Each row is one way scenarios interfere with each other — the flaky-test root causes — and the placement it forces. Every node in `DAG Schedule` cites the row that placed it.

| Root cause | Judged from | Decision |
|---|---|---|
| Order dependency | v2: `Depends on`, `Consumes`, `Produces`. Anchors v1: named predecessor leaves or gates in concrete `Preconditions`, plus produced values recorded at derivation. | Topological order; produced variables passed explicitly. |
| Shared mutable state | v2: overlap in `Target locator`, closed edge `Effects` / `Readers/receivers`, `External target/stub`. Anchors v1: overlap in `State Footprint` reads, writes, and external effects — a common route, table, queue, job, flag, cache, or external endpoint. | Serialize; differing isolation keys alone never prove safety. Unstated overlap serializes, with the reason. |
| Asynchronous wait | The scenario's settlement predicate | Wait on the stated observable condition. Use an approved business threshold when one exists. When the plan records the verbatim token `business threshold: none specified` (the same token in every plan language), the executor chooses and records a finite execution-safety bound from the live environment and available tooling; that bound is not `NEEDS-DECISION` and is never a product oracle. Use `NEEDS-DECISION` only when correctness depends on a business threshold the authority has not defined. A missing settlement condition or unavailable wait/probe capability is `blocked`. When a valid trigger and reachable dependencies/probe are established, exceeding an approved business threshold is `failed`; exceeding only the execution-safety bound is `blocked` as incomplete observation, while evidence that localizes the delay to environment or tooling keeps the scenario blocked under that diagnosis. |
| Resource leak | Cleanup dependencies between scenarios | Cleanup is a DAG edge; a scenario that reuses another's namespace runs after its cleanup or is isolated. |
| Time or randomness | The scenario reads a clock, sequence, or random source | Inject a fixed value through a declared double, or record the observed value and recompute expectations from it. |
| Disruptive load | Concurrency, recovery, compensation, callback-race, or load scenario | Run in isolation, after the chains it could disturb; final consistency and cleanup checks follow. |

## Oracle Types

Every verdict names one oracle type in its `Scenario Results` row. Only an oracle that can tell a wrong value from a right one can support `passed`.

| Type | Meaning | Strongest verdict |
|---|---|---|
| `specified` | The plan's Expected Results give the concrete expected value, computed from the expected-result authority. | `passed` |
| `derived` | The expected value is computed independently of the implementation under test — a differential run, a replay, an invariant, or a metamorphic relation — and the derivation is recorded. | `passed` |
| `implicit` | Only "no crash, no error, request accepted" is checked. | `unverified` |

A `derived` oracle whose derivation reads the same code path it judges is `implicit`.

## Gap & Defect Disposition

One closed disposition vocabulary for `Failures / Defects / Plan Gaps`, so a reader never mistakes a settled item for a pending failure. Specifics (which tool is missing, which decision closed it) go in the item's reason, not the token — that keeps the vocabulary portable. The planner's gap vocabulary is a different set (`NEEDS-DECISION`, `ASSUMED`, `BLOCKED`, `OUT-OF-SCOPE`): a row inherited from the plan's Gaps and Decisions keeps its planner token verbatim until this run actually changes its state; a state this run settles or discovers takes a token from the table below. Never invent synonyms — a run that wrote `RESOLVED` where the set says `CLOSED` is the observed drift this rule exists to stop.

| Disposition | Meaning |
|---|---|
| `OPEN` | Real, unresolved, and executable now by the acting agent within its authority. |
| `CLOSED` | Verified done, or no longer applicable. |
| `MITIGATED` | A workaround is in place; residual risk is noted. |
| `ACCEPTED` | Known and deliberately accepted; no action planned. |
| `CONDITIONAL` | Actionable only once a stated precondition holds, including a required user or owner decision; the precondition and decision owner are named. |
| `BLOCKED-BY-TOOLING` | Cannot proceed for lack of a specific capability; the missing capability is named in the reason. |
| `BLOCKED-BY-ENVIRONMENT` | Cannot proceed because a dependency, sample, or fixture the scenario needs is unavailable in this environment; the missing dependency or data is named in the reason. |
| `OUT-OF-SCOPE` | Excluded from this run by scope or user override. |

Only `OPEN` items belong in `Next Actions for Agent`. A `CONDITIONAL`, `BLOCKED-BY-TOOLING`, `BLOCKED-BY-ENVIRONMENT`, or `OUT-OF-SCOPE` item stays in `Failures / Defects / Plan Gaps` with its precondition, missing capability, missing dependency or fixture, or scope reason named — never copied into Next Actions as a plain to-do.
