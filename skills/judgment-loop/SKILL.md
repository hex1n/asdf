---
name: judgment-loop
description: >
  Rubric-gated production loop for deliverables whose done-when is judgment,
  not a machine check — documents, plans, reports, designs, 写作, 方案文档,
  分析报告. Use when asked to produce taste-judged work and iterate until it
  holds up. Requires pre-registering a rubric before drafting. For
  machine-checkable outcomes use workloop; for falsifying a decision
  use converge.
argument-hint: "[deliverable request; optional rubric or audience]"
---

# Judgment Loop

The work loop's shape survives where no executable criterion exists, but
every part changes implementation: the **pre-registered rubric** plays
red-at-init (fixed before the draft, or it is post-hoc rationalization),
**fresh-context review** plays the idempotent adjudication, and the terminal
verb is always **human acceptance** — machine judgment only pre-filters.

## Workflow

### 1. Pre-Register The Rubric

Before any drafting, fix a rubric: 3–7 items covering success criteria,
failure modes, anti-goals, and the named audience. Each item must be concrete
enough that a reviewer can point at a violation. Ask the user to approve or
amend it. If no rubric can even be drafted, **do not loop** — exploratory
work without articulable standards is done directly; inventing a
rubber-stamp rubric is this domain's vacuous-criterion trap.

Completion criterion: a rubric exists, predates the first draft, and the
user approved or supplied it.

### 2. Draft

Produce a complete candidate — no placeholder sections. Match the audience
and length the rubric names.

Completion criterion: a reviewer could judge the draft against every rubric
item without asking what is missing.

### 3. Independent Review

Review the draft against the rubric from the most independent perspective the
runtime can supply — a reviewer whose failure modes are least correlated with
the author's. There is an independence ladder, weakest to strongest:

- **self-reread** — never counts as the independent pass (the author's context
  is exactly what is compromised);
- **fresh-context** — a read-only subagent that receives only the rubric and the
  draft, none of the authoring context; washes session-state contamination
  (optimism, sunk cost, tunnel vision) but not model-level blind spots;
- **second-model** — a different model reviews; washes model-level blind spots
  too (uncorrelated weights). Prefer this when available.

Every finding must cite the rubric item it violates. Use the strongest level
available; when you must drop a rung, record the downgrade and mark the round's
verdict provisional. Record the level reached with `taskloop review --level
<...>` so the outcome ledger shows how independently the work was checked.

Completion criterion: a finding list where each finding cites a rubric item,
the review level is recorded, and any downgrade is named.

### 4. Revise Narrowly

Fix confirmed findings only. Do not silently edit the rubric to make a
finding disappear — a rubric change is this domain's moved goalpost and must
be recorded (old item → new item, plus the reason) and re-approved by the
user when it loosens.

Completion criterion: every revision maps to a finding; every rubric change
is recorded with a reason.

### 5. Stop And Hand Over

Stop after two consecutive reviews with no material findings, or at the
shared default cap of four rounds, whichever comes first. Present to the
user: the deliverable, the rubric, the last verdict, and remaining known
weaknesses. Acceptance is the user's verb; a user course correction is
first-class input for the next round, not a process violation.

Completion criterion: the user can accept, redirect, or reject with the
rubric and last verdict in view, without reading the drafting transcript.
