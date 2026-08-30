---
name: e2e-test-executor
description: >
  Executes an existing E2E plan, execution report, or concrete scenario in local or test environments with evidence-backed reports. Use when the user asks to run, execute, rerun, or verify-by-running such a handoff — 执行已有端到端测试计划, 重跑已有 execution-report.md 中的场景, 重跑失败场景, or a named plan/report path. A bare 端到端测试／全链路测试 ask (进行/做/跑/执行…) that names no plan, report, or scenario routes to e2e-test-planner.
---

# E2E Test Executor

Execute an existing E2E plan: a real run, a report, and a local issues queue when bugs exist. Write or modify tests only when the user explicitly asks, or when the plan explicitly names authoring test code as the execution method; a scenario's `Automation` level classifies coverage and is never that authorization.

Supported environments: local and test only. If the target is preprod, staging with production-like restrictions, or production, stop and ask for a narrower read-only task or explicit safety instructions.

Output language: use the end-user language explicitly requested; otherwise inherit the upstream plan's dominant language, then the prior report's language on a rerun, and only when no readable upstream artifact exists infer from the user's prompt. A delegation or automation prompt's language is transport, not an audience-language change, unless it explicitly carries the end user's choice. Write the report, Reader View, and all run artifacts in that language; preserve code identifiers, paths, API names, enum values, logs, and quoted source text as-is. If the language choice remains ambiguous, state the assumed output language once.

## Principle

The only product of a run is a **verdict**, and a verdict is trustworthy only when a fault, if present, would pass all four **RIPR** steps and the proof survives:

- **I1 Controllability** (reach, infect) — the SUT is in the scenario's starting state, triggered through a legitimate channel, and isolated from other scenarios.
- **I2 Observability** (propagate, reveal) — the probe reads the committed outcome the fault would reach, and the oracle can distinguish right from wrong.
- **I3 Evidence integrity** — proof is captured in order of volatility before anything can destroy it, and a pass is proven the same way as a failure.
- **I4 Provenance** — plan → run → artifacts → follow-ups is reconstructible from the artifacts alone.

An `implicit` oracle such as “no crash” cannot prove a correct value, so its verdict is at most `unverified`. A `passed` verdict always retains the exact probe, raw unsummarized output, created-entity identifiers, and an independently runnable re-query. A missing probe is `blocked`; missing retained or reproducible proof is `unverified`; an unexecuted case is never `unverified`.

On any failure, suspected product defect, or unknown mismatch, preserve the scene before cleanup: request/response, committed state, queue or job state, logs/traces/metrics, effective config, identifiers, and the exact rerun command or recorded invocation sequence. Redact secrets without removing reproduction identifiers.

## Progressive runbook

Load only the stage and branch that the current run has reached. Do not pre-read every linked file or all of [REFERENCE.md](REFERENCE.md).

1. **Select and establish lineage.**
   - For a first execution from a plan, named scenario, or conversational handoff, read [FIRST-RUN.md](FIRST-RUN.md).
   - For a continuation that verifies fixes or resumes a prior `execution-report.md`, read [RERUN.md](RERUN.md) instead.
   - Do not touch the SUT until the selected scenarios, upstream artifact, current user overrides, blockers, waits, side effects, isolation, and cleanup policy are recorded.
2. **Control and observe the real run.** Read [EXECUTION.md](EXECUTION.md) after selection is fixed and before the first trigger. Follow only its local or test branch and its read-only or write-path branch. Pin the SUT boundary, trigger channel, environment fingerprint, data ownership, schedule, probe, and oracle before carrying a verdict.
3. **Preserve and deliver.** Read [REPORTING.md](REPORTING.md) after the execution shape is known and before cleanup or artifact generation. Failure-scene preservation above remains immediate; never wait until reporting to capture volatile proof.

[REFERENCE.md](REFERENCE.md) is a field-level lookup, not required cover-to-cover reading. Open only the section named by a runbook rule when that condition occurs.

## Verdict discipline

Every selected scenario ends as `passed`, `failed`, `blocked`, `skipped`, or `unverified`, names its oracle type (`specified`, `derived`, or `implicit`), and carries its four proof items or the exact reason they are unavailable.

Classify each mismatch before filing it; a `Scenario Results` row carries the class as its short token (`product`, `plan`, `environment`, `tooling`, `unknown`):

- `product defect` — reached implementation violates an established expectation;
- `plan defect` — the upstream plan's required expected result is missing or contradictory;
- `environment defect` — a declared dependency, sample, or fixture is unavailable;
- `tooling defect` — the runner lacks a capability needed to trigger or observe;
- `unknown` — the mismatch has not yet been localized.

Executor-derived mechanics do not become plan defects merely because the plan omitted them. Rerun an intermittent result at most once, only to distinguish a product race from an environment, tooling, or still-unknown controllability cause; retain both outcomes, and never convert the original evidence into a pass by retrying.

## Scope boundary

This skill executes and diagnoses. It does not silently change business logic, bypass auth or validation, edit production templates, create remote tracker items, or fix product code. If the user authorizes an iterate-until-green loop, the calling agent consumes this run's local issues queue, dispatches fixes, and invokes the executor again using [RERUN.md](RERUN.md). The default cap is eight full E2E rerun cycles when the user gives no cap.

Completion requires a trustworthy verdict for every selected scenario, retained proof and terminal environment state, reconstructible lineage, and the artifacts required by [REPORTING.md](REPORTING.md). The final response links the Reader View first when delivered, summarizes every nonzero status count, names blockers and open actionable issues, and states whether cleanup completed or what remains preserved.
