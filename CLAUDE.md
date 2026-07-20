# CLAUDE.md

Guidance for Claude Code (and other agent runtimes) when working in this repository.

## What this repo is

`asdf-skills` ships portable agent skills. This repository owns every skill it
ships:

- **Skills** (`skills/`) — self-contained directories with Markdown
  instructions and, where needed, stdlib-only helper scripts and tests. Each
  skill is independently distributable: it carries what it needs, installs into
  local agent runtimes such as Codex and Claude Code on its own, and depends on
  neither the other skills here nor any orchestration runtime.

The authoritative conventions for skill assets live in
**[AGENTS.md](AGENTS.md)** — read it before adding or changing any skill. The
canonical domain language lives in **[CONTEXT.md](CONTEXT.md)**.

## Repository layout

- `skills/` — source skills, one directory each. The full set:
  `blindspot-pass`, `deep-research`, `e2e-test-executor`, `e2e-test-planner`,
  `first-principles-planner`, `generating-api-docs`, `generating-test-scope`,
  `implementation-notes`, `merge-quiz`, `plan-review`, `project-docs-layer`.
  - `SKILL.md` — task-facing instructions plus routing frontmatter (`name`, `description`).
  - `REFERENCE.md` / extra `.md` — progressive-disclosure detail loaded on demand.
  - `scripts/` — stdlib-only helper scripts.
  - `tests/` — stdlib `unittest` tests for that skill.
- `scripts/` — repository-owned maintenance tooling: `check-all.mjs` (the
  repo-wide gate), `check-installed-copies.mjs`, and per-skill test directories.
- `docs/` — design notes, plans, and research (`docs/plans/`, `docs/research/`).
- `AGENTS.md` — skill-authoring and maintenance conventions (skill assets).
- `CONTEXT.md` — canonical domain language for skill distribution.

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
