# Execution hand-off

Read from the end of planning, when execution goes to a fresh-context agent.
The parent composes the brief, keeps control while the agent runs, and owns every
repair loop; the agent executes, diagnoses, and renders.

## The brief

Carry, in this order:

- This skill's directory, naming [RUN.md](RUN.md) as the rules to follow; it ends
  with the report and its HTML view.
- The plan path and the mode `run`; for a continuation, the prior report path too.
- The scenario selection.
- Every constraint and authorization the user stated in this conversation, quoted
  verbatim: target environment, retained-data preferences, test-code authority.
- The agent's scope: execution, diagnosis, and rendering only. Product fixes stay
  with the parent whatever the user authorized; the agent records defects locally —
  findings carrying a disposition from [Defect Handoffs](REFERENCE.md#defect-handoffs),
  the owner, and any missing authorization, plus `issues/` documents when a repair
  queue needs them — and stops there.
- The user's output path when one was given; otherwise RUN.md's default location
  applies.
- The return contract below, spelled out.

## While the agent runs

Forward later user constraints and any interruption request to the agent as they
arrive, and relay its permission requests and progress. An interrupted agent returns
the durable report or receipt path it reached and every outstanding state obligation:
retained data, pending cleanup, unfinished evidence capture.

## The return

The agent returns the report path, the HTML path with the checks that ran on it or
the reason it was withheld,
the run summary — every nonzero status count, actionable findings, blockers, retained
data, and what remains blocked or undecided — and outstanding state obligations. Relay them unchanged; the parent need not reread the report to
deliver.

## Repair loops

Before the first product fix, read [Authorized repair loops](INTAKE.md#authorized-repair-loops):
the parent owns the cumulative rerun count and the stopping conditions, the default
cap included. Each continuation brief names the prior report, the count so far and the
remaining cap, and the intended fixed build identity the agent must prove loaded
before judging the fix.
