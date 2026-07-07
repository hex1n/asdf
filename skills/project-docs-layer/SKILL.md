---
name: project-docs-layer
description: >
  Audit or set up a target project's operating-docs layer — how any agent
  learns to start, verify, write idiomatic code, and stay safe in that repo
  (AGENTS.md/CLAUDE.md startup instructions, verification commands,
  conventions, direction anchor, safety boundaries). Use when asked to
  bootstrap, init, write, review, or fix agent docs (初始化/审计项目文档, 写
  CLAUDE.md/AGENTS.md), when startup instructions are stale, or to check
  whether a fresh agent could work from docs alone. Audit-first; prefers an
  executable home (CI, task runner) over prose; only verified facts are
  written. Not for work discipline — that belongs to the loop machine.
argument-hint: "[target repo path + setup|audit|repair intent]"
---

# Project Docs Layer

The loop machine owns *how to work* (budgets, criterion gates, envelopes,
terminal states — see `../loop-core/REFERENCE.md`). Project docs own *facts
about this repo* that no machine default can know. This skill checks, and
minimally repairs, exactly that: can a fresh agent answer the five questions
in `REFERENCE.md` — **Start, Verify, Conventions, Direction, Danger** — and
is each answer as far down the **answer ladder** as it can go? The best fact
is not prose at all: an **executable home** (CI job, task-runner target, lint
config) is re-verified every time the project's own automation runs, while a
prose answer starts rotting the moment it is written. Never write
work-discipline rules into a target project's docs; the exclusion list in
`REFERENCE.md` is binding for every edit this skill makes.

## 1. Inventory

Find what answers the five questions today — executable homes first, prose
second: CI configs, task-runner files, manifests, lint/format configs, then
the startup files the resident agent runtimes actually load (e.g. AGENTS.md,
CLAUDE.md), README, any context/direction anchor, any contributing/safety
doc. Note which files duplicate each other and which are pointers. Read only
— no edits yet. Check the docs-gaps list (the Harvest sink in
`REFERENCE.md`); a re-derivation cost the driving session itself just paid
is audit evidence too — carry both into step 2, and write the new entry to
the gaps list at repair time (or before stopping, on an audit-only run).

Completion criterion: a list of existing answer homes (executable and prose),
each tagged with the question(s) it serves and its ladder rung, plus "no docs
layer" if empty.

## 2. Audit The Five Questions

For each of Start / Verify / Conventions / Direction / Danger (definitions
and per-question verification methods in `REFERENCE.md`): locate the answer,
name its ladder rung (executable / anchored / bare), then verify
it against the world — execute the documented build/test/check commands
read-only; confirm referenced paths exist; confirm claims match the repo's
visible state. Classify each question:

- **verified** — answered, with the evidence its rung demands (executable:
  the automation's own cited green or an in-session run; anchored/bare:
  checked this session — see *Evidence follows the rung* in `REFERENCE.md`);
- **stale** — answered, but execution or inspection contradicts it;
- **undocumented** — a working answer exists in the repo (or sits in the
  docs-gaps list a prior session recorded — see Harvest) but no home states it;
- **absent** — no answer exists and there is nothing yet to document.

Completion criterion: a five-row verdict table, each row carrying its
classification, its ladder rung, and the concrete evidence (command output,
path check, or the observed contradiction) — not prose impressions.

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

- **Down the ladder first** — before writing prose, ask whether the fact can
  gain an executable home instead: a five-step procedure becomes a
  task-runner target; a convention becomes a lint rule; a "these commands
  work" claim becomes a check the project's automation runs (see Freshness in
  `REFERENCE.md`). Prose that merely restates an executable home becomes a
  pointer to it.
- **Verified facts only** — every prose-written command was executed green
  in this session (an executable-rung answer may instead cite the project
  automation's own green); a fact that cannot be verified is not written, or
  is written with an explicit "not machine-verified — confirmed by <how>"
  marker.
- **One canonical home per fact** — when multiple runtimes each load their own
  startup file, pick one canonical file and make the others thin pointers or
  byte-identical stubs; never fork the same fact into divergent copies.
- **Exclusions honored** — nothing from the exclusion list in `REFERENCE.md`
  (loop discipline, local run state, runtime wiring, speculative structure)
  enters the target docs.

Completion criterion: each written command has a fresh green run in the
transcript; each edit either moved a fact down the ladder or states why it
could not; the diff contains no work-discipline rules and no references to
local run state; every fact has exactly one canonical home.

## 5. Re-Audit And Report

Re-run step 2 on the changed docs. Report: the before/after verdict and rung
per question, the diff, evidence for each `verified` claim, and what was
deliberately *not* added with the reason (cut speculative section, machine
already enforces it, owner input still needed). Where prose answers remain,
name the freshness steady state chosen for them (project CI, a keep-green
guard task, or accepted decay — see `REFERENCE.md`).

Completion criterion: the report shows each of the five questions answerable
from durable homes alone — or names the accepted gap and who owns closing it
— and a follow-up agent could re-run the audit from the report without
rediscovering the repo.
