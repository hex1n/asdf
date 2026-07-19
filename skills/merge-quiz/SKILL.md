---
name: merge-quiz
description: >
  Quizzes the user on a completed change until a perfect pass, gating merge or
  approval on their comprehension. Use when the user asks to be quizzed on the
  work (考考我, quiz me, 测验我), or wants to confirm they understand a large
  change or a long session's output before merging or approving it
  (合并前确认我理解了改动). Do not use for teaching a topic with no completed
  change in scope, for judging the change's quality or correctness (that is
  code review's job), or for delivering a verdict on the work itself — the
  quiz tests the user's understanding, not the work.
---

# Merge Quiz

## Core Move

A diff is a map of the change; its behavior inside the existing system is the territory. After a long session, reading the diff gives the user only light understanding — much of the behavior depends on paths that were already there — so approving on that reading means approving work nobody fully understands. The quiz closes the gap: brief the user, question them until every answer is right, and only then call the change clear to merge.

## Process

1. **Brief first.** Summarize what changed and why, organized by behavior rather than by file, including how the change interacts with what already existed. The quiz tests comprehension of the brief plus the change, not memory of an unread diff.
2. **Compose consequential questions.** Ask what the user must understand to own the change: behavior that depends on pre-existing paths, edge cases and how they are handled, deviations from the original plan, the riskiest decision taken, and what breaks if a stated assumption fails. Skip trivia — identifiers, file names, line counts prove nothing about ownership.
3. **One question at a time.** Grade each answer honestly. A wrong or partial answer gets the correct explanation, and the same ground returns later as a differently-angled question. The quiz ends on a perfect pass, not on question count.
4. **Verdict.** Declare clear-to-merge when every question — including re-tests — has been answered correctly. Otherwise declare not-yet and name the areas the user should re-review before approving.

## Completion Criterion

The quiz is complete only at a perfect pass or an explicit not-yet verdict listing the user's remaining gaps. There is no partial credit and no passing on "close enough".

## Anti-Patterns

- Softball questions the brief just answered verbatim.
- Grading generously to end the session.
- Sliding into re-reviewing or fixing the work; the quiz's subject is the user's understanding.
