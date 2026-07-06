# Loop Core

Shared reference for the `converge`, `workloop`, `judgment-loop`, and `meta-loop` skills. This directory intentionally has no `SKILL.md`: it is supporting material, not an invocable workflow. The loop system these skills route to is **taskloop** (`~/bin/taskloop.mjs`, state under `.taskloop/`); this file is the shared vocabulary.

## Loop Primitives

- **Goal**: the user-visible outcome, stated without naming an implementation
  unless the user already approved one.
- **envelope**: the repo/worktree plus files, tables, interfaces, or external
  surfaces the task may touch. Stop before expanding it.
- **Done when**: a machine-checkable completion criterion such as a test command,
  SQL assertion, expected response, diff condition, or deployment fingerprint.
  A trivial single-file change with no data or interface impact may use one
  current-vs-expected sentence. The criterion must be **red at birth and
  idempotent**: it has to fail until the task is done (an already-green criterion
  proves nothing — `open` refuses it), and the stop gate re-runs it on every
  stop, so it must be read-only and side-effect-free. There is no claim-based
  success: green always comes from a fresh criterion run.
- **alignment**: one line recorded at `open` — "green ⇒ goal because <what the
  check exercises>; not covered: <gaps>". A required field, not prose discipline.
- **Evidence**: real tool output, status/diff, command output, SQL/API response,
  read-only verification, or an execution report. Prose alone is not evidence.
- **Task state**: local agent state under `.taskloop/task.json`. It is
  gitignored, private to the loop, and non-authoritative; the durable unit is
  the task, and episodes come and go underneath it.

## Opening A Task

When work needs the loop supervisor, open a task:

```text
node ~/bin/taskloop.mjs open --repo <repo> --goal "<one line>" \
  --criterion "<executable check, red until done>" \
  --alignment "green ⇒ goal because <...>; not covered: <...>" \
  --files "<glob>" [--rounds 8] [--writes N] [--wall-clock-minutes M]
```

This `taskloop open` runs the criterion once and refuses an already-green start
(red at birth) or one the machine cannot execute. Do not hand-write `task.json`;
the CLI owns it. Prefer a **criterion adapter** over a
hand-written check when the done-when reads evidence produced elsewhere; the
adapter interface in [ADAPTERS.md](ADAPTERS.md) makes the known traps — vacuous
pass, stale green, collapsed verdicts — unrepresentable. `e2e-report-check.mjs`
is the seed adapter (required scenario set + build freshness, exit 0/1/2).

The criterion's own input files are fingerprinted at `open`; a green whose check
files changed since (editing the test instead of the code) is flagged
`criterion_input_drift` in the outcome ledger. A criterion move goes through
`amend --criterion --reason`, not a silent edit.

## Criterion-Goal Alignment

Red-at-birth proves the criterion can tell "done" from "not started"; it cannot
prove the criterion covers the goal. A weak criterion (a file exists, a command
merely runs) turns the stop gate into a rubber stamp.

- The `--alignment` line is required at `open`: "green ⇒ goal met, because <what
  the check exercises>; not covered: <known gaps>". If the honest line is
  "green proves little", strengthen the criterion before starting.
- Verification that stays outside the machine criterion (slow suites, manual
  checks, deployment smoke) must be named in the alignment line and reported as
  closeout evidence instead of being silently dropped.
- At closeout, re-read the alignment line: when the work revealed the criterion
  under-covers the goal, `amend` it with a reason — or report the gap — before
  claiming `done`.

Two-domain fit: a backend loop whose criterion runs focused API tests but not
the data backfill it also changed; a docs loop whose criterion checks that links
resolve but not that the new section renders in the published site. Both need
the gap named at open and re-checked at closeout.

## Terminal States

A task closes exactly one of four ways; the first is machine-adjudicated, the
rest are human-declared:

| State | Meaning |
| --- | --- |
| `done` | Criterion green from a fresh run (stop gate or the `done` verb). |
| `not_needed` | Read-only verification showed no change was needed (`not-needed --evidence`). |
| `abandoned` | Superseded or dropped (`abandon --reason`). |
| suspended | Not a closure: `suspend --outcome <needs_input\|stuck\|out_of_budget> --judgment <...>` leaves the task **open** so the next episode resumes it. |

The machine only ever writes `done`, and only from a green criterion — there is
no path that records success while the criterion is red. `stuck` (same failure
signature repeats, or two signatures alternate) and `out_of_budget` (round
budget spent) are episode outcomes the stop gate assigns automatically, then
suspends the task open. An `out_of_budget` run whose every round failed
differently is reported as still-moving: resume it (rounds are task-level) or
`amend --rounds --reason`.

## Budget And Rework

- The default round budget is eight unless the user or target repo states a
  different cap. Rounds are **task-level**: they accumulate across episodes and
  are never refilled by resuming — same failure repeated twice, or two rounds
  with no change, suspends as `stuck`; the round cap suspends as `out_of_budget`.
  Opt-in `--writes` and `--wall-clock-minutes` bound the never-stopping side;
  reads and verification commands never burn or hit them.
- Treat a task as rework when it repairs previously delivered work or resumes a
  prior non-green close. If the target repo has `docs/rework-log.md` or its
  workflow contract names that file, append a compact rework cause line. If no
  durable rework-log convention exists, include the rework cause in the closeout
  report instead of inventing a new project file.

## Concurrency

Default to one writer task per worktree. For parallel work, use separate git
worktrees — each carries its own `.taskloop/` task. There is no shared-worktree
partitioned mode: git operations belong to one integrator, and a second writer
gets its own worktree, not a claim inside yours.

## Git Operations

Run `git add`, `commit`, `push`, `reset`, `restore`, `checkout`, or `clean` only
after the user explicitly asks for that operation, and only when the task's
envelope authorizes it (`open`/`amend` with `--git-allowed <op> --git-reason
<why>`). Destructive git operations still require explicit user intent even when
authorized.

## Closeout

Every closeout report includes:

- the terminal state (`done` / `not_needed` / `abandoned`, or a suspend outcome);
- the done-when verification result or the reason it cannot run;
- the actual touched targets (machine-observed in `evidence.touched_files`)
  versus the declared envelope;
- evidence links or command outputs for completion claims;
- remaining risks;
- for suspends, the machine half of the snapshot is auto-recorded; the human
  supplies the three judgment lines (remaining criterion, current failure, next
  safe action);
- for rework, the rework-log entry or the closeout-only rework cause.

## Generalization Samples

These primitives must fit at least two different domains:

- backend sample: change an API handler, verify with focused tests and a
  response assertion;
- frontend sample: change a UI workflow, verify with a browser check and DOM or
  screenshot evidence.

Rules that only fit one project, product, table name, enum, or business term do
not belong in this shared reference.
