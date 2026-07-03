---
name: fixloop
description: >
  Reproduce-driven diagnose-fix loop. Use for active bugs, failing tests,
  regressions, 排查, 定位, 根因, 修到通过, or "fix until green" requests that
  include or need a reproducible input and a machine-checkable pass criterion.
argument-hint: "[reproduction input or failure scene + pass criterion]"
---

# Fixloop

Treat the user's current prompt as a failure to reproduce, diagnose, repair, and
replay. If the task is only research with no live failure or repair request, use
`deep-research` instead.

Read `../workflow-core/REFERENCE.md` when you need terminal-state, runtime,
concurrency, git, or closeout details.

## Workflow

### 1. Capture Reproduction And Pass Criterion

Identify the original input, command, request, scenario, or failure scene, plus
the pass criterion. If either is missing, ask for it before editing.

Completion criterion: the reproduction input and pass criterion are explicit
enough to replay.

### 2. Diagnose With Evidence

Read logs, tests, code, data, or configuration before forming the fix. Keep at
least two plausible causes alive until one distinguishing check separates them.

Completion criterion: the chosen root cause has evidence, or the blocker is
classified as environment, tooling, permission, deployment, or missing input.

### 3. Repair Narrowly

Make the smallest change that addresses the evidenced cause. Preserve diagnostic
data before cleanup. Do not mutate unrelated behavior to make the symptom
disappear.

Completion criterion: the patch is limited to the cause and remains inside the
run contract.

### 4. Prove The Fix Is Loaded

Replay only against the changed build, process, config, or data. For local
services, start or restart what you can and capture readiness evidence. For
environments you cannot deploy, stop as `blocked` and tell the user exactly what
must be deployed.

Completion criterion: the replay target is fresh, or the loop is blocked on a
named deployment or capability.

### 5. Replay And Reconcile

Replay the original input and compare expected versus actual fields, outputs,
rows, logs, or UI state. Continue while the delta changes and the budget remains.
Use the shared default cap of eight iterations unless the user or target repo
states a different cap.

Completion criterion: the pass criterion is green, or the same failure repeats,
progress stalls, a blocker appears, or the budget is exhausted.

### 6. Report

Report `terminal_state`, reproduction input, expected result, actual result,
evidence location, changed files, and any retained diagnostic scene. Use
`success`, `noop`, `blocked`, `stalled`, or `exhausted` only as defined in the
shared reference. For rework, apply the shared rework-log rule.

Completion criterion: another agent can rerun the same reproduction without
rediscovering the failure scene.
