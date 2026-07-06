---
name: land
description: >
  Landing loop for approved implementation work. Use after the user approves a
  plan or says to implement, land, apply, proceed, 按方案落地, 开始实现, or 改.
  Requires a run contract and a machine-checkable done-when criterion before
  editing; routes self-driving requests to the loop skill.
argument-hint: "[approved plan or implementation request; optional run contract and done-when criterion]"
---

# Land

Treat the user's current prompt as approved landing input. If the prompt only
asks for analysis or options, do not edit; route to `converge` or answer in
planning mode.

Read `../loop-core/REFERENCE.md` when you need terminal-state, runtime,
concurrency, git, or closeout details.

## Workflow

### 1. Frame The Landing

Restate `Goal`, `run contract`, and `Done when` before the first edit. If the done
criterion is missing, ask for it before editing; for a trivial single-file change
with no data or interface impact, state one current-vs-expected sentence.

Completion criterion: the target repo/worktree, run contract, and done criterion
are explicit and checkable.

### 2. Open Runtime State

If the repo has `.agent-loop/`, initialize v2 runtime state with
`agent-loop.mjs init`. Do not hand-write `run-contract.json`. If you find
stale active state, use `close`, `steal`, or a separate worktree according to
the shared reference.

Completion criterion: runtime state is initialized or the reason it is not used
is stated.

### 3. Change, Verify, Review, Fix

Make the narrowest change that can satisfy the done criterion. Run the smallest
relevant verification after each meaningful change. For non-trivial changes,
perform an independent read-only review when the runtime supports it; otherwise
record the downgrade and do a focused read-only self-review.

Completion criterion: either the done criterion passes, or the loop has a named
non-success terminal state.

### 4. Stop Without Drifting

Stop for exactly one of these states: `success`, `noop`, `blocked`, `stalled`, or
`exhausted`. Stop immediately before touching anything outside the run contract.
Do not re-enter `converge` after approval unless new blocking evidence appears
or the user asks to reconsider. Use the shared default cap of eight iterations
unless the user or target repo states a different cap.

Completion criterion: the terminal state is named and supported by evidence.

### 5. Report

Report the terminal state, verification output, actual touched targets versus
the declared run contract, evidence for completion claims, and remaining risks.
For `blocked`, `stalled`, or `exhausted`, include a resumable state snapshot.
For rework, apply the shared rework-log rule.

Completion criterion: a follow-up agent can continue or audit the landing from
the report without guessing what changed or why the loop stopped.
