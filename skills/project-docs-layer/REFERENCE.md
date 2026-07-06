# Project Docs Layer — Reference

Detail for the `project-docs-layer` skill: the answer ladder, the
five-question contract, per-question verification methods, freshness steady
states, the harvest loop, the exclusion list, and canonicalization. Loaded on
demand; `SKILL.md` stays task-facing.

## The Answer Ladder

Every fact in the docs layer sits on a rung; repair pushes facts down.

1. **executable** — the answer lives in something the project's own
   automation runs: a CI job, a task-runner target (make/just/npm script), a
   manifest, a lint/format config. Continuously re-verified; cannot silently
   rot while automation stays green.
2. **anchored prose** — a doc line that points at an executable home ("tests:
   see the `test` target; it covers X, not Y"). The pointer can dangle, but
   the fact itself stays machine-owned.
3. **bare prose** — a claim with no executable backing. Legitimate only for
   what has no executable form (tribal context, direction, judgment-shaped
   conventions); it decays from the moment it is written, so it needs a
   freshness steady state (below) or an accepted-decay note.

A repair that deletes prose by giving the fact an executable home is the
best possible edit this skill makes.

## The Five-Question Contract

A repo's docs layer is adequate when a fresh agent — any runtime, no session
history — can answer all five from durable homes in the repo.

### 1. Start

*What is this repo, and how do I build/run/test it here?*
Strongest answer: manifests and task-runner targets, with the startup file
anchoring them ("build/test/run: see Makefile targets"). Verification:
execute the documented commands (read-only targets: build, test, lint —
never deploy/release) and require green, or an explained expected-red (e.g. a
suite that needs credentials, which the doc must say). A command that fails
undocumented is `stale`.

### 2. Verify

*Which commands prove a claim about this repo?*
This is the pool the loop sources red-at-birth criteria from (see
`../loop-core/REFERENCE.md`, "Sourcing The Criterion"): the answer must name
what each check actually exercises — "unit suite covers the core logic, not
the integration path". Verification: run each named check once; confirm the
coverage claim is stated, not implied. A repo whose only documented check is
"the build passes" gets an `undocumented` or `absent` here if stronger checks
exist unlisted — a weak verify answer is what turns downstream criterion
gates into rubber stamps.

### 3. Conventions

*How is code written here?*
Naming, layering, error handling, comment density, test idioms — the
patterns an agent must follow to produce code the repo would have written
itself. Strongest answer: executable — lint/format configs, an exemplar test
the suite runs. Prose conventions are allowed only for what tooling cannot
express (e.g. "wrap external calls in the adapter layer"), and each one is
spot-checked against sampled code: a stated convention the codebase visibly
violates is `stale` (fix the statement or flag the violation — do not leave
the contradiction standing). Two-domain fit: a backend repo pinning its
error-wrapping idiom; a docs site pinning its heading and link style.

### 4. Direction

*What durable context should not be re-derived every session?*
An answer is: a direction/context anchor — domain language, why the repo
exists, current direction, decided-and-closed questions. Verification is
inspection, not execution: spot-check that the anchor's claims match the
repo's visible state (named components exist, described boundaries hold).
This is the only question where `absent` is often the right steady state: a
small repo with no domain-language debt needs no anchor. Create one only when
the audit itself paid a re-derivation cost or the owner supplies the content.

### 5. Danger

*Where are the project-specific safety boundaries?*
The machine already denies generic dangers (destructive git, `curl | sh`,
secret dumps). Docs must cover only what is specific to this repo: generated
or managed paths that must not be hand-edited, commands that touch shared or
production state, data that must not leave the repo. Verification: confirm
each named path/command exists; confirm managed paths are marked at their
canonical home (e.g. the generating tool's config or the startup file), not
scattered. Two-domain fit: a service repo marking its migrations directory
as forward-only; a docs site marking its build output directory as generated.

## Freshness

Session verification ("executed green this session") is the floor, not the
steady state: a prose answer verified today is unverified next month. Every
surviving prose answer gets one of three named steady states, recorded in the
closeout report:

- **project automation** — the strongest: the commands the docs name are
  (or become) part of the project's own CI/check target, so the answer is
  re-verified on the project's cadence. Prefer this whenever the project has
  automation at all.
- **keep-green guard task** — where no CI exists, open a keep-green taskloop
  task whose criterion runs the documented check (`open --keep-green --reason
  "docs freshness guard" --criterion "<the documented command>"`): green is
  its steady state, a red is the docs-rot alarm, and only explicit verbs
  close it (see `../loop-core/REFERENCE.md`, keep-green semantics).
- **accepted decay** — for low-stakes prose, say so: the audit is the only
  re-verification, and the report names that as the accepted gap.

## Harvest

The learning loop that feeds audits between invocations: when any session
pays a **re-derivation cost** the docs should have covered — rediscovering
the test command, re-deriving a convention, tripping a danger nobody wrote
down — that cost is evidence, and it enters the next audit as an
`undocumented` verdict with the session as its citation. This is the same
birth certificate the Rule Harvest Gate accepts (repeated re-derivation,
observed failure, explicit user invariant) — never speculation: a fact no
session has needed does not get written because it "might help".

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
  pointer, not a copy. An executable home outranks any prose home (see the
  answer ladder): when both exist, the prose becomes the pointer.
- When multiple runtimes each load their own startup file, pick one canonical
  startup file; the others are thin pointers or byte-identical stubs. Stub
  parity is verified by the audit (a diff between stubs is a `stale`
  verdict), not promised by prose: divergent near-copies are the
  highest-frequency docs-layer defect, and each copy is individually
  plausible.
- Prefer converting a documented procedure into a script or task-runner
  target and pointing at it. Two-domain fit: a five-step database-reset
  procedure becomes one target; a five-step screenshot-baseline refresh
  becomes one script.

## Audit Verdict Format

One row per question:

| Question | Verdict | Rung | Evidence | Defect (if any) |
|---|---|---|---|---|
| Start | verified / stale / undocumented / absent | executable / anchored / prose | command + exit/output head, or path check | what is wrong, one line |

Evidence is real tool output — command output, a path listing, a quoted
contradiction. Prose impressions do not fill this column.
