# Agent Workflow Core

Shared reference for the `converge`, `land`, `fixloop`, and `loop` skills. This directory intentionally has no `SKILL.md`: it is supporting material, not an invocable workflow.

## Loop Primitives

- **Goal**: the user-visible outcome, stated without naming an implementation
  unless the user already approved one.
- **run contract**: the repo/worktree plus files, tables, interfaces, or external
  surfaces the loop may touch. Stop before expanding it.
- **Done when**: a machine-checkable completion criterion such as a test command,
  SQL assertion, expected response, diff condition, or deployment fingerprint.
  A trivial single-file change with no data or interface impact may use one
  current-vs-expected sentence. The criterion must be **red before the work and
  idempotent**: it has to fail until the task is done (an already-green criterion
  proves nothing — see red-at-init below), and the stop gate re-runs it on every
  stop, so it must be read-only and side-effect-free.
- **Evidence**: real tool output, status/diff, command output, SQL/API response,
  read-only verification, or an execution report. Prose alone is not evidence.
- **Runtime state**: local agent state under `.agent-loop/`. It is
  gitignored, private to the agent loop, and non-authoritative.

## Runtime Contract

When a target repo has `.agent-loop/`, initialize the active loop with:

```text
node ~/bin/agent-loop.mjs init --repo <repo> --files <glob> --criterion <check>
```

Use v2 `run-contract.json`; v1 state is invalid and must be re-initialized.
`.agent-loop/loop-events.jsonl` proves only scope/process observations.
It does not prove business correctness and cannot replace tests, SQL, API
responses, screenshots, logs, or diff review.

`init` runs the criterion once (**red-at-init**): a done-when criterion for a
task with work to do must be red before the work starts. If it is already green,
strict mode refuses `init` because the criterion cannot discriminate "done" from
"not started". Declare an intentional already-green loop (noop verify,
keep-green regression guard) with `--allow-green-init --reason <why>`.

Abandoned state does not trap Stop, but write operations still require `close`,
`steal`, or a separate worktree. Take over only with:

```text
node ~/bin/agent-loop.mjs init --repo <repo> --force --steal --reason <why> ...
```

Close runtime state through the CLI, not by editing `run-contract.json`:

```text
node ~/bin/agent-loop.mjs close --repo <repo> --terminal-state <success|noop|blocked|stalled|exhausted> --reason <why>
```

Omitting `--terminal-state` means `success`; use an explicit non-success state
when the loop stops without meeting the done-when criterion.

## Terminal States

Use one terminal state in every closeout:

| State | Meaning |
| --- | --- |
| `success` | Done-when criterion passed and required evidence is present. |
| `noop` | Read-only verification showed no change was needed. |
| `blocked` | Missing user input, permission, deployment, capability, or an unreachable criterion prevents progress. |
| `stalled` | The same failure repeated twice, or two consecutive rounds changed neither the failure nor the evidence. |
| `exhausted` | Iteration, budget, or explicit user cap was reached before success. |

`success` and `noop` are normal closures. `blocked`, `stalled`, and `exhausted`
are not success and require a resumable state snapshot.

**Which states the machine holds.** The Stop hook enforces three of these
mechanically from the criterion verdict and its counters: `success` (criterion
green), `stalled` (the same failure signature repeats — default three consecutive
stops), and `exhausted` (the consecutive-block cap). `noop` and `blocked` are
about *why* there was nothing to do or what is missing; the machine cannot derive
them from a verdict, so they remain agent-declared and must be justified in the
closeout. Do not read a machine-held state as more than "the criterion was
green / kept failing the same way / never went green in budget."

## Budget And Rework

- The default cap is eight iterations unless the user states a different cap or
  the target repo declares a stricter budget. Count a meaningful change plus its
  verification attempt as one iteration.
- Stop as `stalled` when the same failure repeated twice, or when two
  consecutive rounds change neither the failure nor the evidence. Stop as
  `exhausted` when the eight-iteration default cap, explicit user cap, or
  runtime budget is reached before success. The Stop hook releases `stalled`
  automatically after the same failure signature repeats (default three
  consecutive stops; override with `budget.max_stall_repeats`), which caps the
  criterion re-runs a genuinely stuck loop pays before it stops.
- Treat a loop as rework when it repairs previously delivered work or resumes a
  prior `blocked`, `stalled`, or `exhausted` closeout. If the target repo has
  `docs/rework-log.md` or its workflow contract names that file, append a
  compact cause line. If no durable rework-log convention exists, include the
  rework cause in the closeout report instead of inventing a new project file.

## Concurrency

Default to one writer loop per worktree. For parallel work, use separate git
worktrees. Use same-worktree `partitioned` mode only when the user explicitly
asks for it:

```text
node ~/bin/agent-loop.mjs claim --repo <repo> --session <id> --files <glob>
```

Claims must not overlap. Git operations belong to one integrator session.

## Git Operations

Run `git add`, `commit`, `push`, `reset`, `restore`, `checkout`, or `clean` only
after the user explicitly asks for that operation. Before the operation, update
the active run contract with:

```text
--git-allowed <op> --git-reason <why>
```

and enough git budget. Destructive git operations still require explicit user
intent even when a budget exists.

## Closeout

Every closeout report includes:

- the final terminal state;
- the done-when verification result or the reason it cannot run;
- the actual touched targets versus the declared run contract;
- evidence links or command outputs for completion claims;
- remaining P2/P3 findings or risks;
- for non-success states, a resumable snapshot: changed files, remaining
  criterion, current failure, and next safe action.
- for rework, the rework-log entry or the closeout-only rework cause.

## Generalization Samples

These primitives must fit at least two different domains:

- backend sample: change an API handler, verify with focused tests and a
  response assertion;
- frontend sample: change a UI workflow, verify with a browser check and DOM or
  screenshot evidence.

Rules that only fit one project, product, table name, enum, or business term do
not belong in this shared reference.
