# Backend loop dogfood — harvested findings

Date: 2026-07-03
Method: ran the full backend loop chain against a real, deterministically-buggy
Java service (pure-JDK HTTP orders API + async reservation worker + persisted
stock ledger) to find where the orchestration actually breaks, before deciding
whether to build the E2E→Stop-gate criterion adapter (Move 2). This inverts the
proposal's phase order per the repo's method axiom: dogfool first, harvest, then
make the narrowest edit the evidence supports.

## What was exercised end to end

1. Planner artifact: E2E plan with Scenario Inventory (S001, S002), Execution
   DAG (N2 depends on N1), Agent Execution Contract, Executor Handoff Index,
   candidate runtime criterion.
2. Executor: real HTTP triggers (`curl`) + async worker wait + persisted DB
   inspection. Reproduced a real business-invariant defect — an over-stock order
   (qty 10 vs available 2) was `RESERVED` instead of `REJECTED`, driving the
   stock ledger to `-8`. Produced execution-report.md (frozen sections),
   scenario-results.jsonl, and issues/ISSUE-001.
3. Stop gate wired to the E2E result via a prototype checker criterion.
4. fixloop (the new Move 1 rule): intake from the report's failed row +
   ISSUE-001 + Environment State Ledger; narrow fix (`available > 0` →
   `available >= qty`); rerun scope = failed + DAG dependents.
5. Green closeout: fixed build → S001 RESERVED / S002 REJECTED / stock 2 →
   checker exit 0 → Stop gate `terminal_state: success`.

## Findings

- **F1 — a hand-written E2E criterion is a correctness trap, not just verbose.**
  The naive `jq 'all(.status=="passed")'` passes *vacuously* when a required
  scenario is missing from the report. A report that dropped S002 entirely would
  read green. Closing this by hand required a bespoke required-set check. This is
  a real false-green class, not a convenience gap.

- **F2 — freshness is the load-bearing check, and it is not hand-expressible.**
  The most valuable thing the checker did was **block a stale report**: after the
  fix was compiled but the executor had not been re-run, a plain artifact
  criterion would pass on the previous build's green. The checker caught it only
  because it compared the report's loaded-build fingerprint to the current build
  (exit 2, "re-run executor"). This is the same self-report leak class the loop's
  red-at-init / stalled / amend guards close — here it is "green on stale
  evidence."

- **F3 — scenario-results.jsonl is on-demand, not default.** It had to be
  authored by hand; the always-present, test-frozen artifact is the Markdown
  `Scenario Results` table (closed-set statuses). A checker should key on the
  frozen Markdown as primary and treat the jsonl as an optional fast path.

- **F4 — nothing auto-triggers the executor re-run, and that is correct.** The
  criterion checks artifacts only (idempotent; it must never re-run the executor
  on every stop — that would run the full E2E suite 3–8× and create real data).
  The loop body (fixloop) re-runs the executor once per fix; F2's freshness gate
  is what mechanically enforces that the body actually did so.

- **F5 — the Move 1 fixloop rule held.** Consuming the report gave a clean,
  narrow fix with the correct rerun scope and no friction. No change needed.

- **F6 — environment note (not a system finding).** This sandbox reaps
  long-lived background JVMs; the red path was driven over real HTTP, the green
  re-run through an in-process batch entrypoint calling the identical
  `processReservation` code. Orchestration findings are unaffected.

## Decision on Move 2

Move 2 (a read-only E2E report checker usable as a Stop-gate criterion) is now
**warranted by evidence** — specifically F1 (vacuous-pass) and F2 (stale-green),
which are correctness defects in the hand-written path, not convenience. Refined
requirements harvested from the run:

1. Parse the **default, test-frozen Markdown `Scenario Results`** table as the
   primary source; accept scenario-results.jsonl as an optional fast path (F3).
2. Require an explicit scenario set (`--require-passed S001,S002`); a missing
   required scenario is a failure, never a vacuous pass (F1).
3. Verify **build freshness**: compare the report's loaded-build fingerprint to
   the current build; a mismatch is a blocker (exit 2), not a pass (F2).
4. Exit 0 (all required passed, fresh) / 1 (failed or missing) / 2 (report
   absent/malformed or stale). Read-only and idempotent; never re-runs the
   executor (F4).

Still deliberately **not** warranted: the routing matrix and the six unified
handoff objects from the proposal — the dogfood exercised the existing per-skill
handoffs (Executor Handoff Index, Agent Execution Contract, report contract)
without friction, so there is no observed failure to justify a parallel schema.
