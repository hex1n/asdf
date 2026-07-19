# CLAUDE.md

Guidance for Claude Code (and other agent runtimes) when working in this repository.

## What this repo is

`asdf-skills` ships additional portable agent skills. The standalone
**taskloop** repository owns the loop runtime and producer-agnostic `workloop`
core; this repository ships:

- **Skills** (`skills/`) — portable components the loop calls at each stage:
  self-contained directories with Markdown instructions and, where needed,
  stdlib-only helper scripts and tests, distributed into local agent runtimes
  such as Codex and Claude Code.

The authoritative conventions for skill assets live in
**[AGENTS.md](AGENTS.md)** — read it before adding or changing any skill. The
canonical domain language lives in **[CONTEXT.md](CONTEXT.md)**.

## Repository layout

- `skills/` — source skills, one directory each. Current skills:
  `deep-research`, `e2e-test-executor`,
  `e2e-test-planner`,
  `first-principles-planner`, `plan-review`, `generating-api-docs`, `generating-test-scope`,
  `project-docs-layer`, and other repository-owned domain
  skills. Only `workloop` and `loop-core` come from taskloop.
  - `SKILL.md` — task-facing instructions plus routing frontmatter (`name`, `description`).
  - `REFERENCE.md` / extra `.md` — progressive-disclosure detail loaded on demand.
  - `scripts/` — stdlib-only helper scripts.
  - `tests/` — stdlib `unittest` tests for that skill.
- [hex1n/taskloop](https://github.com/hex1n/taskloop) — the independently
  versioned task-first CLI, runtime installer, tests, and design history.
- `scripts/` — repository-owned maintenance tooling, when present.
- `docs/` — design notes, plans, and research (`docs/plans/`, `docs/research/`).
- `AGENTS.md` — skill-authoring and maintenance conventions (skill assets).
- `CONTEXT.md` — canonical domain language: skill distribution and loop
  engineering.

## Working conventions

When adding or changing a skill, follow `AGENTS.md`:

- **Rule Harvest Gate** — promote a rule only for a repeated correction, observed
  failure mode, or explicit user-approved invariant; add it at the narrowest level.
- **Keep `SKILL.md` task-facing** — maintenance guidance belongs in `AGENTS.md`,
  detail belongs in `REFERENCE.md`, not in the loaded skill body.
- **Stay portable** — standard Markdown instructions and stdlib-only scripts; no
  runtime-specific workflow scripts or external dependencies in core skills.
- **Don't edit managed installed copies** — keep installed runtime copies
  byte-identical with their source; put personal divergence in a local override skill.
- **Evidence loop for improvements** — capture a baseline, name the failure mode,
  make the narrowest edit, re-validate, and decide with the hard gates + two-axis
  rule in `AGENTS.md` (no point scores).

## Verification expectation

Before claiming a skill change is done, run the relevant focused checks and
report the result. Protect load-bearing rules with a small example or test when
practical.

The repo-wide gate is `node scripts/check-all.mjs`: it runs every local test
suite — including the local-only `tests/` directories that CI never sees — plus
the installed-copy check. Run it before and after any skill change; a semantic
edit that skips the local suites is exactly the failure it exists to catch.
