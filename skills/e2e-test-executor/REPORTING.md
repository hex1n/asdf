# Evidence, artifacts, and provenance

Read this file after the execution shape is known and before cleanup or artifact generation. Volatile failure scenes must already have been captured under `SKILL.md` and `EXECUTION.md`.

## Preserve before cleanup

Retain created data, queues, locks, cache entries, temporary config, raw request/response, committed rows or state, job or event state, logs/traces/metrics, stub or external state, effective flags, entity/correlation IDs, relevant screenshots, and the exact rerun command or recorded invocation sequence when they are needed for diagnosis. If cleanup would destroy evidence, quarantine or retain self-owned data and record its owner, TTL, cleanup command, and risk. Redact secrets while preserving reproduction identifiers.

## Fill the run directory

The run directory was created at intake by [FIRST-RUN.md](FIRST-RUN.md) or [RERUN.md](RERUN.md); write every artifact into it and name its full path in the final response.

Produce only artifacts whose condition applies:

```text
e2e-run-<plan-name>-<timestamp>/
  execution-report.md        # always: canonical handoff and inline proof
  execution-report.html      # unless Markdown-only or render inspection is unavailable
  plan-snapshot.md           # intake/execution stage: derived, ad-hoc, or legacy-derived mechanics plus pre-report execution facts
  scripts/                   # when the run created or mutated scriptable data
  state/                     # only while owned mutable state is retained for diagnosis
  issues/                    # when OPEN actionable root causes exist
    index.md
    ISSUE-001-<short-slug>.md
  attachments/               # only for non-textual or readability-breaking raw evidence
  run-metadata.json          # only for a named machine consumer
  scenario-results.jsonl     # only for rerun/comparison tooling
```

Treat this tree as an allowlist. `state/` is a temporary or retained-data branch, not an audit-artifact branch: after successful cleanup remove its owner marker and empty directory; retain it only when its self-owned mutable contents are still needed, with owner, TTL, cleanup command, and risk in the report. `plan-snapshot.md` is the only intake/execution-stage Markdown companion; fold boundary, preflight, environment, capability, ledger, schedule, run-log, and planned-command facts into it, then into the matching canonical report sections at delivery. Do not emit `run-log.md`, `preflight.md`, or another standalone evidence ledger unless a named consumer requires it. Preserve attempt-specific failure evidence inline; use `attachments/` only under the overflow rule below.

Open [Run Artifact Contract](REFERENCE.md#run-artifact-contract) for the canonical report sections and structural rules; open [Scenario Results & Evidence Legibility](REFERENCE.md#scenario-results--evidence-legibility), [Run Lineage & Emergent Scenarios](REFERENCE.md#run-lineage--emergent-scenarios), and [Environment State Ledger](REFERENCE.md#environment-state-ledger) only while constructing those respective sections.

## Keep one canonical proof path

`execution-report.md` is the source of truth. Put every executed scenario's four proof items inline under `Evidence & Failure Scenes`, one chain per scenario, so verdict and proof share one reading path. Spill to `attachments/` only for non-textual material or raw content large enough to obscure probe → expected → actual; leave a summary, attachment path, and re-query command inline. When one batch probe covers several scenarios, retain it once and point each scenario to its slice.

Each `Scenario Results` row carries status, oracle type, one-line expected and actual, diagnosis, issue link, and evidence link. Use the closed diagnosis token only when a mismatch or verdict deficit exists; use `—` for a clean `passed` or `skipped` row. Record a root cause once in `Failures / Defects / Plan Gaps`; link every affected scenario to it. The ledger carries the deployment/freshness proof. Record every emergent out-of-plan finding in the lineage table, never only in prose.

When data was created or mutated through a scriptable surface, emit paired runnable seed and cleanup scripts under `scripts/`, idempotent where possible, and link them from `Data Created & Cleanup` and the ledger. Markdown-only delivery applies to reports, not executable helpers: use the surface's normal executable extension and make the invocation explicit. A prose-only cleanup command is insufficient in this branch. For a genuinely read-only run, record the absence of created data and do not fabricate scripts.

When this run generates a rerun entry point — an executable helper, or a recorded adapter invocation sequence — open [Replay Entry Point Contract](REFERENCE.md#replay-entry-point-contract) and satisfy it before naming that entry point in `Re-run Instructions`. A read-only run that generates none skips it.

## Dispositions and local issues

Every failure, defect, and gap needs a disposition. Open [Gap & Defect Disposition](REFERENCE.md#gap--defect-disposition) when assigning it.

- Every `OPEN` actionable root cause gets one `issues/ISSUE-*.md`, linked from its failure entry and affected scenario rows.
- `Next Actions for Agent` lists only `OPEN` executable work.
- `CONDITIONAL`, `BLOCKED-BY-TOOLING`, and `BLOCKED-BY-ENVIRONMENT` remain in the failure section with their precondition or missing capability/dependency/fixture.
- Remote tracker creation remains out of scope unless explicitly requested.

Each issue document includes `Issue ID`, `Type`, `Severity`, `Disposition`, `Affected scenarios / edges`, `Expected`, `Actual`, `Evidence / scene`, `Suspected code area`, `Reproduction steps`, `Fix constraints`, `Verification command or scenario`, `Post-fix E2E rerun`, `Closure rule`, and `Cleanup / data impact`.

## Reader View branch

Unless the user requests Markdown-only, create `execution-report.html` only when it can be rendered and visually inspected. Open [Reader View Contract](REFERENCE.md#reader-view-contract) for its projection and link-audit rules.

The Reader View is an answer-first visual index with the complete human report below it, never a second evidence source. Its primary table is `Scenario | Expected Input | Expected Result | Actual Result`; expected columns come from the plan and actual values only from this run, while status and proof remain in row details. Every projection preserves statuses, dispositions, blockers, skipped/unverified items, proof chains, and retention policy.

A delivered Reader View exposes only HTML navigation. For each clickable Markdown, JSON, JSONL, SQL, or text report-suite artifact, generate a UTF-8 HTML companion and link the companion while retaining the canonical/raw source. Audit every internal link and confirm no projection contradicts or omits a canonical Markdown fact needed to understand or audit the verdict. Withhold the Reader View, and state why, when render-and-inspect or link auditing cannot be completed.

## Provenance and rerun handoff

Record a PROV triple in `Run Lineage & Emergent Scenarios`:

- **entities** — upstream plan, upstream run when any, this run's artifacts, downstream work;
- **activity** — this run's selection set, overrides, start, and end;
- **agents** — executing runtime and triggering instruction.

The terminal `Environment State Ledger` is the activity snapshot. Every rerun or investigation back-links the original plan and prior run.

When the user authorizes an iterate-until-green loop, keep the report and issues queue unchanged as this iteration's immutable handoff. The final response additionally names all `OPEN` actionable issues, the next continuation set defined by `RERUN.md`, and the stop condition: no open actionable root causes, a blocker only the user can resolve, the user's cap, or the default eight full rerun cycles.

## Delivery gate

Before final response, verify:

- `execution-report.md` contains every scenario's proof chain, status, oracle, diagnosis, and lineage;
- the ledger records terminal state, fingerprint, retained items, cleanup, and risks;
- every open actionable root cause has an issue with post-fix rerun and closure rule;
- seed/cleanup scripts exist exactly when the write-path condition requires them;
- when a rerun entry point was generated, it satisfies [Replay Entry Point Contract](REFERENCE.md#replay-entry-point-contract), and no instruction chains independent verification and cleanup commands;
- Reader View projection, render inspection, HTML companion links, and link audit pass, or the report records why it was withheld;
- optional machine or overflow artifacts exist only for a real consumer or payload need.
- no unlisted run log, preflight, environment, capability, intake, or evidence-ledger companion was emitted.

In the final response, link Reader View first when delivered, use HTML companions for other user-clickable report-suite links, name canonical/raw paths as code when useful, summarize every nonzero status count, identify blockers and open issues, and state whether cleanup completed or what remains preserved.
