# Project Docs Layer — Reference

Detail for the `project-docs-layer` skill: the four-question contract, the
per-question verification methods, the exclusion list, and canonicalization.
Loaded on demand; `SKILL.md` stays task-facing.

## The Four-Question Contract

A repo's docs layer is adequate when a fresh agent — any runtime, no session
history — can answer all four from durable, reviewable files in the repo.

### 1. Start

*What is this repo, and how do I build/run/test it here?*
An answer is: a startup file the resident runtimes load, stating what the
project is, the layout at whatever depth has proven necessary, and the exact
build/test/run commands. Verification: execute the documented commands
(read-only targets: build, test, lint — never deploy/release) and require
green, or an explained expected-red (e.g. a suite that needs credentials,
which the doc must say). A command that fails undocumented is `stale`.

### 2. Verify

*Which commands prove a claim about this repo?*
This is the pool the loop sources red-at-birth criteria from (see
`../loop-core/REFERENCE.md`, "Sourcing The Criterion"): the doc must name
what each check actually exercises — "unit suite covers the core logic, not
the integration path"; "the render check proves links resolve, not that the
page displays". Verification: run each named check once; confirm the doc's
claim about its coverage is stated, not implied. A repo whose only documented
check is "the build passes" gets an `undocumented` or `absent` here if
stronger checks exist unlisted — a weak verify answer is what turns downstream
criterion gates into rubber stamps.

### 3. Direction

*What durable context should not be re-derived every session?*
An answer is: a direction/context anchor — domain language, why the repo
exists, current direction, decided-and-closed questions. Verification is
inspection, not execution: spot-check that the anchor's claims match the
repo's visible state (named components exist, described boundaries hold).
This is the only question where `absent` is often the right steady state: a
small repo with no domain-language debt needs no anchor. Create one only when
the audit itself paid a re-derivation cost or the owner supplies the content.

### 4. Danger

*Where are the project-specific safety boundaries?*
The machine already denies generic dangers (destructive git, `curl | sh`,
secret dumps). Docs must cover only what is specific to this repo: generated
or managed paths that must not be hand-edited, commands that touch shared or
production state, data that must not leave the repo. Verification: confirm
each named path/command exists; confirm managed paths are marked at their
canonical home (e.g. the generating tool's config or the startup file), not
scattered. Two-domain fit: a service repo marking its migrations directory
as forward-only; a docs site marking its build output directory as generated.

## Exclusion List (never enters target-project docs)

- **Work discipline** — budgets, round caps, stop conditions, criterion-gate
  or envelope rules, verification rituals, closeout formats. The loop machine
  enforces all of it with zero per-project config; a prose copy is a weaker
  duplicate that drifts against the machine and teaches agents to trust text
  over the engine.
- **Local run state** — `.taskloop/`, outcome-ledger rows, session
  transcripts, scratch files. Gitignored, agent-private, non-authoritative;
  promoting them into durable docs launders unreviewed state into policy.
- **Runtime wiring** — hooks, settings files, machine-level install steps.
  Owned by the machine-level installer; also breaks doc portability across
  runtimes.
- **Speculative structure** — template scaffolds, empty placeholder files,
  sections for content nobody has needed yet. The Rule Harvest Gate applies
  to doc lines exactly as to skill rules: a line earns its place via an
  observed failure, a repeated re-derivation, or an explicit user invariant.
- **Unverified commands** — anything not executed green this session, unless
  explicitly marked "not machine-verified — confirmed by <how>".

## Canonicalization

- Every fact gets exactly one canonical home; other files that need it hold a
  pointer, not a copy.
- When multiple runtimes each load their own startup file, pick one canonical
  startup file; the others are thin pointers or byte-identical stubs kept in
  sync. Divergent near-copies are the highest-frequency docs-layer defect:
  flag them as `stale` even when each copy is individually plausible.
- Prefer converting a documented procedure into a script or task-runner
  target and pointing at it. Two-domain fit: a five-step database-reset
  procedure becomes one target; a five-step screenshot-baseline refresh
  becomes one script.

## Audit Verdict Format

One row per question:

| Question | Verdict | Evidence | Defect (if any) |
|---|---|---|---|
| Start | verified / stale / undocumented / absent | command + exit/output head, or path check | what is wrong, one line |

Evidence is real tool output — command output, a path listing, a quoted
contradiction. Prose impressions do not fill this column.
