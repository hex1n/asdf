---
name: meta-loop
description: >
  Improvement loop for the work loop itself. Use when the user asks to run the
  meta loop, analyze loop health, 跑元循环, 月度循环复盘, harvest improvement
  candidates from session corpora, or when a scheduled asdf-meta-loop task
  fires. Reads local loop-health metrics and terminal history, harvests
  de-identified candidates, and processes exactly one candidate per
  fresh-context round through the evidence loop.
argument-hint: "[optional: a specific candidate or indicator to focus on]"
---

# Meta Loop

This skill answers one question: **where is the human still doing machine
work?** It never edits business code; its deliverables are metric readings,
candidates, and evidence-gated rule changes at the narrowest level.

## Workflow

### 1. Refresh The Numbers

Run `python scripts/analyze-sessions.py` in the skills repository. Outputs
(loop-health.txt, corpora intermediates) are local and gitignored; they carry
personal prompt text and never enter the repository.

Completion criterion: loop-health.txt regenerated with the behavior and
outcome indicators plus the delta line against the previous run.

### 2. Read Direction, Not Levels

Compare each indicator against the previous run. Machine-regex counting is
stricter than recollection, so absolute values read low; only the direction is
meaningful. A flat number means the play was not adopted — check adoption
(are the loop skills and gate actually being used?) before proposing any new
mechanism.

Completion criterion: every moved indicator has a named hypothesis; every
flat indicator has an adoption check, not a mechanism proposal.

### 3. Harvest Candidates

Candidate pools: correction/abort clusters from the corpora, scope-drift
fixes, runtime memory summaries when present. De-identify wording (no source
project vocabulary) and dedupe against the causes already recorded in
`docs/rework-log.md`.

Completion criterion: a candidate list where each entry names the failure
mode and its narrowest target level — machine (gate/CLI error message,
criterion adapter, hook check) before prose (skill text, contract card).
Rules default into the machine, not prose.

### 4. One Candidate Per Round

Process exactly one candidate per fresh context round using the evidence
loop in AGENTS.md: baseline → narrowest edit → re-validate → independent
falsification when the high-stakes conditions hold. Record the Round format.
Never batch candidates into one round; never accept on the author's re-read.

Completion criterion: the round ends accept / continue / reject with
artifacts, and at most one candidate was touched.

### 5. Land Or File

Accepted edits land at the target level and ride distribution via the commit
boundary. Rejected or unproven candidates are filed as provisional with the
evidence gap named, so the next monthly run picks them up instead of
re-deriving them.

Completion criterion: nothing is half-landed; every candidate is either
landed with passing checks or filed with its missing evidence named.
