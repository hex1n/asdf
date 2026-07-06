# Loop Core

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
  stop (reusing the last red verdict only when nothing write-shaped ran in
  between; green always comes from a fresh run), so it must be read-only and
  side-effect-free.
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

When the done-when is an E2E result, do not make the criterion re-run the
executor — the Stop gate re-runs its criterion on every stop. Let the loop body
run the executor once, then point the criterion at the report:

```text
node ~/bin/e2e-report-check.mjs --report <execution-report.md> --require-passed <ids> --build <artifact>
```

It is read-only and idempotent: exit 0 when the required scenarios passed on the
current build, 1 on a scenario failure or a missing required scenario, 2 on a
stale report (its loaded-build fingerprint differs from the current build),
absent/malformed report, or unverifiable freshness. Pass `--no-freshness` only
when there is no build artifact to fingerprint.

Abandoned state does not trap Stop, but write operations still require `close`,
`steal`, or a separate worktree. Take over only with:

```text
node ~/bin/agent-loop.mjs init --repo <repo> --force --steal --reason <why> ...
```

Close runtime state through the CLI, not by editing `run-contract.json`:

```text
node ~/bin/agent-loop.mjs close --repo <repo> --terminal-state <success|noop|blocked|stalled|exhausted> --reason <why>
```

`--terminal-state` is required. `close --terminal-state success` re-runs the
criterion and refuses on red — success always comes from a fresh green run,
on the stop-gate path and the close path alike. `blocked`, `stalled`, and
`exhausted` additionally require
`--snapshot "<changed files; remaining criterion; current failure; next safe action>"`;
the snapshot is stored in the contract (`evidence.snapshot`) so the next loop
resumes from machine-held state instead of rediscovering the failure scene.
`noop` needs neither: it is a normal closure whose criterion is legitimately
still red.

If the criterion itself turns out wrong, change it through `amend`, not by
editing `run-contract.json`:

```text
node ~/bin/agent-loop.mjs amend --repo <repo> --criterion <new check> --reason <why the goalpost moved>
```

`amend` records the change with its reason and resets stall tracking (failures
now belong to a different check) but does **not** refill the block budget —
amend fixes the target, it does not buy more iterations; re-init resets budget.
Re-init is not an anonymous budget refill either: initializing over a
non-success close of the **same criterion** is the same task continuing, so
`init` records the lineage (`resume_of`, a cumulative `resume_count`, carried
gate telemetry) and resurfaces the prior close's snapshot. Severing that
lineage on purpose requires `--fresh --reason <why>`.
Changing the criterion by direct file edit still works but is flagged at the
next stop as an unrecorded goalpost move: the machine cannot judge whether the
change is legitimate, only that "defining green" and "passing green" stayed
separable and auditable. Drift is only checked in `warn`/`strict` enforcement;
`off` observes nothing, including moved goalposts.

The same discipline covers the criterion's file inputs: `init` fingerprints
repo files named in the criterion command, and a green whose check files
changed since init is released with a `criterion_input_modified` warning —
editing the test instead of the code is the goalpost move the command-string
hash cannot see. A legitimate check fix goes through `amend --reason` like any
other redefinition of done.

## Criterion-Goal Alignment

Red-at-init proves the criterion can discriminate "done" from "not started";
it cannot prove the criterion covers the goal. A weak criterion (a file
exists, a command merely runs) turns the stop gate into a rubber stamp.

- When restating the run contract at init, record one alignment line:
  "criterion green ⇒ goal met, because <what the check actually exercises>;
  not covered: <known gaps>". If the honest line is "criterion green proves
  little", strengthen the criterion before starting the loop.
- Verification that stays outside the machine criterion (slow suites, manual
  checks, deployment smoke) must be named in the alignment line and reported
  as closeout evidence instead of being silently dropped.
- At closeout, re-read the alignment line: when the work revealed that the
  criterion under-covers the goal, `amend` it with a reason — or report the
  gap explicitly — before claiming `success`.

Two-domain fit: a backend loop whose criterion runs focused API tests but not
the data backfill it also changed; a docs loop whose criterion checks that
links resolve but not that the new section renders in the published site.
Both need the gap named at init and re-checked at closeout.

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
stops — or two signatures strictly alternate across twice the stall cap, the
oscillation case), and `exhausted` (the consecutive-block cap). `noop` and `blocked` are
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
  consecutive stops; override with `budget.max_stall_repeats`) or after two
  failure signatures strictly alternate across twice the stall cap (fix A
  breaks B, fix B breaks A), which caps the criterion re-runs a genuinely
  stuck loop pays before it stops.
- The stop gate bounds a loop that keeps trying to stop; a loop that never
  stops consumes no gate budget. The opt-in runaway budgets bound that side:
  `init --max-writes <n>` and `--max-wall-clock-minutes <m>` (both default
  off) make the PreToolUse hook deny further write-shaped calls once crossed —
  reads and verification commands always still run, so an over-budget loop can
  always verify, stop, or close honestly.
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
