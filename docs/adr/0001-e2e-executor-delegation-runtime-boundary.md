---
status: accepted
---

# E2E executor delegation wiring stays in the runtime layer, not in the portable skill

We want to run `e2e-test-executor` with context isolation and without blocking the
main session — i.e. as a backgrounded subagent. But `subagent` and
`run_in_background` are Claude-Code-specific harness features; Codex (another target
**Agent Runtime**) has no equivalent and reaches background execution through a
separate bridge, and `AGENTS.md` requires source skills to stay portable across
runtimes. So we decided to keep **all subagent/background wiring out of the portable
e2e skills** and trigger delegation from the runtime/orchestration layer instead: a
full-tool subagent launched with `run_in_background` invokes the executor against an
**already-green delegation contract**. The skills stay runtime-neutral — the planner
already says "a separate agent session, or automation", never "subagent" — and the
contract reuses the planner's existing `Agent-ready Gates` + `Executor Handoff Index`:
every gate (environment is local/test, data policy, isolation namespace, safety
boundary) is resolved in the main session *before* backgrounding, and the subagent
returns-and-reports on any new gate rather than guessing or escalating scope.

## Considered Options

- **A — put "run yourself as a backgrounded subagent" into `e2e-test-executor/SKILL.md`.**
  Rejected: violates the `AGENTS.md` portability gate, binds the skill to one runtime,
  and Codex cannot honor it.
- **B — a thin Claude-Code-only slash command / wrapper outside `skills/`** that
  encapsulates the launch. Deferred: a new artifact to maintain with no demonstrated
  repeated pain yet; revisit under the Rule Harvest Gate if the manual invocation
  recurs.
- **C (chosen) — document the invocation as a usage recipe** under `docs/recipes/`,
  with zero change to the portable skills. See
  [`docs/recipes/e2e-executor-background-delegation.md`](../recipes/e2e-executor-background-delegation.md).

## Consequences

- Observability shifts off the (isolation-hidden) subagent transcript onto the on-disk
  run directory: `execution-report.md`, `evidence/`, and the `Environment State Ledger`
  are the source of truth. The subagent's final return is only a pointer — run path,
  pass/fail/blocked counts, cleanup status, and any early-return blocker.
- The polished `execution-report.md` only lands at the end of the run; mid-run, progress
  is visible as `evidence/` grows. That is the cost of trading live visibility for
  non-blocking execution.
- Backgrounding is safe **only** when the plan's `Agent-ready Gates` are all green first.
  A plan with unresolved gates must not be backgrounded — run it in the foreground until
  the gates close.
