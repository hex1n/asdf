---
name: workloop
description: >
  The one work loop for approved, machine-verifiable work. Use after a plan is
  approved or to implement/land/apply/proceed (按方案落地, 开始实现, 改), to
  diagnose and fix a live failure (排查, 定位, 根因, 修到通过, fix until green),
  or to self-drive until a criterion holds (循环到X为止, 授权一次自驱). Needs a
  machine-checkable done-when criterion and an envelope before editing. For
  taste-judged deliverables use judgment-loop; to falsify a decision use
  converge.
argument-hint: "[approved work or failure scene + done-when criterion + optional envelope]"
---

# Workloop

One shell, three criterion sources. The only real fork is **where the red comes
from**; after that the body is identical. If the prompt only asks for analysis
or options, do not edit — route to `converge` or answer in planning mode. For a
deliverable whose done-when is taste, use `judgment-loop`.

Read `../loop-core/REFERENCE.md` for terminal-state, task-state, concurrency,
git, and closeout details, and `../loop-core/ADAPTERS.md` before hand-writing a
criterion that reads external evidence.

## 1. Source The Criterion

- **given** — the approved plan already carries the check (test command, SQL
  assertion, expected response, diff condition). Restate it and open.
- **recovered** — you hold only a failure. Reproduce it first: replay the input,
  fix the environment, capture the real red output. The red is *earned from the
  world*, not declared. When the input is an `e2e-test-executor` execution
  report, take intake from its `failed`/`blocked` scenario rows and their linked
  `issues/ISSUE-*.md`, carry its Environment State Ledger as the resume
  snapshot, and set the rerun scope to those scenarios plus their DAG
  dependents — consume the report contract, do not re-derive from one error.
- **absent (keep-green)** — a verification task whose criterion is legitimately
  green; open with the keep-green reason and close `not_needed` with evidence if
  no change is warranted.

Completion criterion: goal, envelope, and a red-at-birth machine criterion (plus
its alignment line) are explicit; for a recovered criterion, the reproduction is
replayable from the report or scene, not from memory.

## 2. Open The Task

Open taskloop state: `taskloop open --goal <...> --criterion <...> --alignment
"green ⇒ goal because <...>; not covered: <...>" --files <glob>`. `open` refuses
an already-green or non-executable criterion. Do not hand-write `task.json`.

Completion criterion: the task is open, or the reason it is not used is stated.

## 3. Run The Body

Make the narrowest change that can satisfy the criterion; run the smallest
relevant verification after each meaningful change; each round `status`-checks
that nothing left the envelope. The body is identical across sources with one
branch — **recovered adds a freshness gate**: replay only against the changed
build/process/config/data, because a green on the old world's evidence does not
count. Keep at least two plausible causes alive until one distinguishing check
separates them.

The criterion gate proves the check passes; it does not prove the change is
structurally right. When the criterion is a **weak proxy for done** — a
refactor, a migration, a design-shaped change where "green" leaves the real
done-ness (coverage, coherence, "is this the right structure") unjudged, as the
alignment line should admit — the criterion alone is a rubber stamp. There, take
an independent review at the strongest level the runtime supports (second-model
> fresh-context > self-reread; self-reread never counts), feed its findings back
into this body, and record the level with `taskloop review --level <...>` so the
ledger shows how independently it was checked. When you must drop a rung, record
the downgrade.

Completion criterion: the criterion passes; for a criterion-weak change, an
independent review at a recorded level fed its findings back, or the downgrade
is named.

## 4. Stop Without Drifting

Close exactly one of three ways: `done` (criterion green from a fresh run),
`not_needed` (read-only check, with evidence), or `abandoned` (with reason). A
`suspend` (`stuck` / `out_of_budget` / `needs_input`) is **not** a close — it
keeps the task open for the next episode. Stop immediately before touching
anything outside the envelope;
do not re-open `converge` after approval unless new blocking evidence appears.
Continue between rounds without asking unless the loop needs an envelope
expansion, user-only input, or irreversible/high-risk approval. Use the shared
default cap of eight rounds unless the user or target repo states another cap.
For autonomy across turns, use `/goal` or the `ralph-loop` plugin as the driver;
if none is available, state the downgrade and run a single pass.

Completion criterion: the terminal state is named and supported by evidence.

## 5. Report

Report the terminal state, verification output, actual touched targets (the
machine records changed files) versus the declared envelope, evidence for
completion claims, and remaining risks. For a suspend, supply the three judgment
lines (remaining criterion, current failure, next safe action). For rework,
apply the shared rework-log rule.

Completion criterion: a follow-up agent can continue or audit the work from the
report without rediscovering the scene or guessing why the loop stopped.
