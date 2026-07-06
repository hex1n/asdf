# CLAUDE.md

Guidance for Claude Code (and other agent runtimes) when working in this repository.

## What this repo is

`asdf-skills` builds a portable **personal agent work loop** — judge scope →
converge when needed → land → verify → stop — installable on any machine and
effective in any project with zero per-project config. **The loop is the
product**; the repo ships two asset families:

- **Skills** (`skills/`) — portable components the loop calls at each stage:
  self-contained directories with Markdown instructions and, where needed,
  stdlib-only helper scripts and tests, distributed into local agent runtimes
  such as Codex and Claude Code.
- **Loop machinery** (`taskloop/` + `bootstrap/`) — the taskloop CLI/hooks
  (the loop system), the user-level contract blocks, and the idempotent
  installer that distributes the loop itself.

The authoritative conventions for skill assets live in
**[AGENTS.md](AGENTS.md)** — read it before adding or changing any skill. The
loop machinery's maintenance discipline and semantic boundaries live in
**[bootstrap/README.md](bootstrap/README.md)**. The canonical domain language
(skill distribution and loop engineering) lives in **[CONTEXT.md](CONTEXT.md)**.

## Repository layout

- `skills/` — source skills, one directory each. Current skills:
  `bootstrap-agent-os`, `converge`, `deep-research`, `e2e-test-executor`,
  `e2e-test-planner`, `first-principles-planner`, `fixloop`,
  `generating-api-docs`, `generating-test-scope`, `java-stack-craft`,
  `judgment-loop`, `meta-loop`, `workloop`; `loop-core` is a
  non-invocable shared support directory for the loop skills.
  - `SKILL.md` — task-facing instructions plus routing frontmatter (`name`, `description`).
  - `REFERENCE.md` / extra `.md` — progressive-disclosure detail loaded on demand.
  - `scripts/` — stdlib-only helper scripts.
  - `tests/` — stdlib `unittest` tests for that skill.
- `tests/` — repo-level contract tests that validate skill structure and routing.
- `bootstrap/` — machine-level install assets (the work-loop contract card,
  the e2e-report-check adapter seed) plus the idempotent `install.mjs` that
  distributes the taskloop CLI and registers its hooks; see `bootstrap/README.md`.
- `taskloop/` — clean-room task-first v2 implementation (own CLI, state dir
  `.taskloop/`, outcome ledger, program cards, tests), parallel to and
  independent of the v1 loop machinery; see `taskloop/README.md` and the
  probe-gated rollout plan in `docs/plans/2026-07-06-loop-v2-task-first.md`.
- `scripts/` — repo-level maintenance tooling (e.g. `analyze-sessions.py`,
  the monthly loop-health analyzer).
- `hooks/` — in-repo git hooks (`core.hooksPath` target); `post-commit` and
  `post-merge` re-run `install.mjs` so distribution rides the commit and
  pull boundaries.
- `docs/` — design notes, plans, and research (`docs/plans/`, `docs/research/`).
- `AGENTS.md` — skill-authoring and maintenance conventions (skill assets).
- `CONTEXT.md` — canonical domain language: skill distribution and loop
  engineering.

## Commands

Tests use built-in runtimes only: Node `node:test` for bootstrap runtime scripts
and Python `unittest` for the remaining repo and skill contracts.

```bash
# Node taskloop tests (the loop system) + adapter-seed test
node --test taskloop/tests/taskloop.test.mjs tests/e2e_report_check.test.mjs

# Python repo-level contract tests
python -m unittest discover -s tests

# A single skill's tests
python -m unittest discover -s skills/java-stack-craft/tests
```

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

Before claiming a skill change is done, run the relevant test target above and
report the result. Protect load-bearing rules with a small example or test when
practical.
