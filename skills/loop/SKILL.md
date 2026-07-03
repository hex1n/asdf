---
name: loop
description: >
  Self-driving loop driver. Use when the user authorizes one run-until condition
  such as loop until, keep going until, 自己跑到, 循环到X为止, or 授权一次自驱,
  with a machine-checkable completion criterion.
argument-hint: "[done-when criterion + optional run contract or loop body]"
---

# Loop

This skill is the driver, not the body. It keeps the agent moving until a
machine-checkable condition holds, so the user is not the per-turn clock.

Read `../workflow-core/REFERENCE.md` when you need terminal-state, runtime,
concurrency, git, or closeout details.

## Workflow

### 1. Require A Done-When Criterion

The prompt must contain a machine-checkable criterion: test command, SQL
assertion, expected response, diff condition, or equivalent. If it does not,
ask for the criterion before starting.

Completion criterion: the loop can decide green versus red without user taste.

### 2. Set Gate And Driver

If `.agent-loop/` exists, initialize v2 runtime state so the Stop hook can
run the criterion. Use `/goal <criterion>` or the `ralph-loop` plugin when
available for autonomous re-feed. If no driver is available, state the downgrade
and run one `land` or `fixloop` pass instead of promising autonomy.

Completion criterion: the loop has a driver, or the report names the degraded
single-pass mode.

### 3. Choose The Body

Use `land` for approved implementation work. Use `fixloop` for a live failure
that must be reproduced and repaired. Do not put body-specific repair or landing
rules in this driver.

Completion criterion: exactly one body owns the next action.

### 4. Continue Until A Terminal State

Continue without asking between rounds unless the loop needs a run contract
expansion, user-only input, irreversible/high-risk approval, or a non-success
terminal state. Stop on `success`, `noop`, `blocked`, `stalled`, or `exhausted`.
Use the shared default cap of eight iterations unless the user or target repo
states a different cap.

Completion criterion: every continuation is justified by the done criterion,
and every stop has a named terminal state.

### 5. Handoff

Report the terminal state, final criterion output, touched targets, and a
resumable snapshot for non-success states. For rework, apply the shared
rework-log rule.

Completion criterion: the user can see why the loop stopped without reading the
whole transcript.
