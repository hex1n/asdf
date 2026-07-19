---
name: implementation-notes
description: >
  Keeps a deviation log while implementing from an approved plan or spec, so
  the unknowns the plan missed are captured instead of silently absorbed. Use
  when the user asks for implementation notes (实现笔记), a deviation log
  (记录偏离/偏差), or hands over a plan, spec, or prototype to implement and
  wants decisions and departures tracked (按计划实现并记录偏离). Do not use
  for exploratory work with no plan to deviate from, or for diagnosing a
  failure.
---

# Implementation Notes

## Core Move

No plan survives contact with the territory. The moment implementation meets an edge case the plan did not foresee, the choice made right there is exactly what the next planning round needs to learn — so log the deviation as it happens, take the conservative option, and keep going, rather than stopping the run or silently absorbing the change into the diff.

## Process

1. **Open the log.** At the start of implementation, create `implementation-notes.md` at the working root, or the path the user names. It is a temporary working artifact: not committed unless the user asks.
2. **Log at the moment of deviation.** When the territory forces a departure from the plan, write the entry before moving on: what the plan said, what the territory showed, the option chosen, and why. Choose the conservative option — the smallest, most reversible one that keeps the plan's goal intact.
3. **Continue or escalate.** A local deviation is log-and-continue. Stop and report instead when the deviation invalidates the plan's goal, crosses into irreversible or destructive territory, or reveals the problem should be solved a different way altogether.
4. **Record discovered unknowns.** Keep a separate section for surprises that didn't force a deviation but the plan should have known — edge cases, hidden constraints, wrong assumptions. These feed the next planning round.
5. **Replay at the end.** The final report replays the log: every deviation with its choice, every discovered unknown. The log is the learning artifact; the diff alone can't teach what the plan got wrong.

## Completion Criterion

Before reporting done, walk the plan section by section against the final result; every difference must have a matching log entry with its reason. Implementation ends with zero unlogged deviations found by that walk. The user decides whether the notes graduate into durable docs or get discarded.

## Anti-Patterns

- Logging routine mechanical steps that match the plan — the log holds departures, not a diary.
- Silently "improving" on the plan with no entry.
- Stopping the whole run for every local edge case instead of choosing conservatively and continuing.
- Committing the notes file without being asked.
