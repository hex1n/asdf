---
name: project-docs-layer
description: >
  Audit or set up a target project's operating-docs layer — the durable files
  that tell any agent how to start, verify, and stay safe in that repo
  (AGENTS.md/CLAUDE.md startup instructions, a direction anchor, verification
  commands, project-specific safety boundaries). Use when asked to bootstrap,
  init, write, review, or fix agent docs (初始化/审计项目文档, 写
  CLAUDE.md/AGENTS.md), when startup instructions are stale, or to check
  whether a fresh agent could work from docs alone. Audit-first: documented
  commands are re-run; only verified facts are written. Not for work
  discipline — budgets, gates, envelopes belong to the loop machine.
argument-hint: "[target repo path + setup|audit|repair intent]"
---

# Project Docs Layer

The loop machine owns *how to work* (budgets, criterion gates, envelopes,
terminal states — see `../loop-core/REFERENCE.md`). Project docs own *facts
about this repo* that no machine default can know. This skill checks, and
minimally repairs, exactly that: can a fresh agent answer the four questions
in `REFERENCE.md` — **Start, Verify, Direction, Danger** — from durable docs
alone? Never write work-discipline rules into a target project's docs; the
exclusion list in `REFERENCE.md` is binding for every edit this skill makes.

## 1. Inventory

Find what the docs layer currently is: the startup files the resident agent
runtimes actually load (e.g. AGENTS.md, CLAUDE.md), README, any
context/direction anchor, any contributing/safety doc. Note which files
duplicate each other and which are pointers. Read only — no edits yet.

Completion criterion: a list of existing docs-layer files, each tagged with
the question(s) it serves (or "serves none"), plus "no docs layer" if empty.

## 2. Audit The Four Questions

For each of Start / Verify / Direction / Danger (definitions and per-question
verification methods in `REFERENCE.md`): locate the answer in durable docs,
then verify it against the world — execute the documented build/test/check
commands read-only; confirm referenced paths exist; confirm the direction
anchor still matches the repo's visible state. Classify each question:

- **verified** — documented, and the evidence is green this session;
- **stale** — documented, but execution or inspection contradicts it;
- **undocumented** — a working answer exists in the repo but no doc states it;
- **absent** — no answer exists and there is nothing yet to document.

Completion criterion: a four-row verdict table, each row carrying its
classification and the concrete evidence (command output, path check, or the
observed contradiction) — not prose impressions.

## 3. Fix The Scope

If the request was audit-only, stop here and report the verdict table. For
setup or repair, propose the narrowest edit list: every proposed line is keyed
to a specific `stale`, `undocumented`, or user-supplied-invariant defect from
step 2. `absent` rows get an edit only when the owner supplies the missing
content or the audit itself paid a re-derivation cost; never invent
speculative sections, template scaffolds, or empty placeholder files. Ask the
user before creating any new file.

Completion criterion: an edit list where each item names the audit defect (or
explicit user invariant) it fixes; anything without a named defect is dropped.

## 4. Repair

Apply the edits under these rules, all binding:

- **Verified facts only** — every command written into a doc was executed
  green in this session; a fact that cannot be verified is not written, or is
  written with an explicit "not machine-verified — confirmed by <how>" marker.
- **One canonical home per fact** — when multiple runtimes each load their own
  startup file, pick one canonical file and make the others thin pointers or
  byte-identical stubs; never fork the same fact into divergent copies.
- **Machine before prose** — a fact that can be a script or task-runner target
  becomes one, and the doc points at it, instead of a multi-step procedure.
- **Exclusions honored** — nothing from the exclusion list in `REFERENCE.md`
  (loop discipline, local run state, runtime wiring, speculative structure)
  enters the target docs.

Completion criterion: each written command has a fresh green run in the
transcript; the diff contains no work-discipline rules and no references to
local run state; every fact has exactly one canonical home.

## 5. Re-Audit And Report

Re-run step 2 on the changed docs. Report: the before/after verdict per
question, the diff, evidence for each `verified` claim, and what was
deliberately *not* added with the reason (cut speculative section, machine
already enforces it, owner input still needed).

Completion criterion: the report shows each of the four questions answerable
from the durable docs alone — or names the accepted gap and who owns closing
it — and a follow-up agent could re-run the audit from the report without
rediscovering the repo.
