# CLAUDE.md

Guidance for Claude Code (and other agent runtimes) when working in this repository.

## What this repo is

`asdf-skills` is a collection of **portable agent skills** that can be distributed
into local agent runtimes such as Codex and Claude Code. Each skill is a
self-contained directory under `skills/` with Markdown instructions and, where
needed, stdlib-only helper scripts and tests.

The authoritative conventions live in **[AGENTS.md](AGENTS.md)** — read it before
adding or changing any skill. The domain language for skill distribution
(Source Skill, Managed Installed Skill, Cache Drift, etc.) lives in
**[CONTEXT.md](CONTEXT.md)**.

## Repository layout

- `skills/` — source skills, one directory each. Current skills:
  `bootstrap-agent-os`, `deep-research`, `e2e-test-executor`,
  `e2e-test-planner`, `first-principles-planner`, `generating-api-docs`,
  `generating-test-scope`, `java-stack-craft`.
  - `SKILL.md` — task-facing instructions plus routing frontmatter (`name`, `description`).
  - `REFERENCE.md` / extra `.md` — progressive-disclosure detail loaded on demand.
  - `scripts/` — stdlib-only helper scripts.
  - `tests/` — stdlib `unittest` tests for that skill.
- `tests/` — repo-level contract tests that validate skill structure and routing.
- `bootstrap/` — machine-level install assets (Execution Contract blocks, `/land`
  `/fixloop` `/converge` command templates, agent-doctor, hooks) plus the
  idempotent `install.mjs`; see `bootstrap/README.md`.
- `docs/` — design notes, plans, and research (`docs/plans/`, `docs/research/`).
- `AGENTS.md` — skill-authoring and maintenance conventions.
- `CONTEXT.md` — canonical domain terms for skill distribution.

## Commands

Tests use built-in runtimes only: Node `node:test` for bootstrap runtime scripts
and Python `unittest` for the remaining repo and skill contracts.

```bash
# Node bootstrap contract tests
node --test tests/bootstrap_install.test.mjs tests/agent_doctor.test.mjs tests/agent_workflow_hook.test.mjs tests/meta_loop.test.mjs

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
