---
name: project-docs-layer
description: >
  Audit, set up, or repair a repository's agent-facing operating layer:
  repository-scoped instructions and durable evidence for startup,
  verification, conventions, context, and safety. Use when asked whether a
  fresh agent can work safely from repository evidence alone, or to create,
  audit, or fix AGENTS.md, CLAUDE.md, or another runtime's repository
  instructions whose operational guidance is missing or stale.
---

# Project Docs Layer

Project docs own durable facts about a repository that an agent runtime cannot
infer safely. Host-level workflow owns generic work discipline. Audit first,
then minimally repair only the repository facts that are missing, stale, or
noncanonical.

Before inventory, read [REFERENCE.md](REFERENCE.md). Its answer ladder,
five-question contract, evidence rules, aggregation rule, and exclusions are
binding. Re-read its repair sections before changing files.

## 1. Inventory

Find every durable home that answers **Start, Verify, Conventions, Direction,
or Danger**: CI and task-runner definitions, manifests, lint/format configs,
runtime startup files such as AGENTS.md or CLAUDE.md, README, context anchors,
and contributing or safety docs. Record executable homes before prose, and
note duplicates and pointers.

Keep inventory read-only. Inspect a docs-gaps sink only if one already exists.
Treat a re-derivation cost paid in the current session as audit evidence, but
do not create or update a sink during audit.

Completion criterion: every discovered home is listed with its path, the
question(s) it serves, and its rung; report "no docs layer" if none exists.

## 2. Audit The Five Questions

For every discovered home, verify the claims it exposes using the per-question
methods in `REFERENCE.md`. Resolve pointers and compare prose with the visible
repository state. Before executing a documented command, inspect its
definition and dependencies. Run it without further approval only when its
effects stay in disposable local state, do not modify tracked content or leave
durable untracked artifacts, and require no credentials, installation, network
access, or shared or production state. Snapshot the existing repository state
(for example, version-control status) before execution and check it afterward.
Otherwise, leave the command unexecuted and report the verification gap and
authority needed to close it. Classify a documented home whose required
evidence cannot be obtained as `unverified`, not `stale`.

Classify each home, then aggregate each question using the precedence and
absence rules in `REFERENCE.md`. Do not let a verified executable home hide a
stale prose instruction, or choose one rung when several homes exist.

Completion criterion: a five-row verdict table lists every answer home and
rung, the aggregate verdict, concrete evidence, every defect, and any command
not run with the reason.

## 3. Fix The Scope

For an audit-only request, report the verdict table and proposed docs-gap
entries, confirm no durable repository change came from the audit, then stop
without editing repository files.

For setup or repair, propose the narrowest edit list. Key every edit to a
named audit defect or explicit user invariant; drop anything without one.
Owner-supplied content becomes an explicit invariant rather than an `absent`
answer. Ask before creating a file, changing executable automation such as CI
or task-runner definitions, or taking any action whose effects exceed the
authority already granted by the request.

Completion criterion: every edit names the defect or invariant it fixes and
all new files, automation changes, and authority expansions are approved.

## 4. Repair

Apply only the approved edits:

- **Down the ladder within scope** — prefer an existing executable home over
  duplicated prose. Propose a new executable home separately; do not turn a
  docs repair into an automation change without approval.
- **Evidence matches the claim** — write a command only when its observed
  outcome matches the documented expectation, including an explicitly
  explained expected failure. Mark non-executable facts with their inspection
  or owner-confirmation provenance.
- **One canonical home per fact** — keep other runtime startup files as thin
  pointers or byte-identical stubs, and remove or repair discoverable stale
  copies.
- **Exclusions honored** — keep host workflow, runtime-local state, runtime
  wiring, and speculative structure out of repository operating docs.

Completion criterion: every edit stays within approved scope; every written
claim carries rung-appropriate evidence; every affected fact has one canonical
home; the diff contains no excluded material.

## 5. Re-Audit And Report

Re-run step 2 on the changed layer. Report the before/after aggregate verdict,
all homes and rungs, the diff, evidence for each verified claim, commands not
run, and material deliberately omitted. For surviving prose, name its
freshness steady state: project automation, an owner-approved recurring guard,
or accepted decay.

Completion criterion: a fresh agent can answer the five questions from durable
homes alone, or the report names each accepted gap, its evidence, and the owner
or authority needed to close it. A follow-up agent can repeat the audit without
rediscovering the repository.
