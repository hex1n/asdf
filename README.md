# asdf — agent loop engineering

> English | [简体中文](README.zh-CN.md)

A portable **personal agent work loop** for local runtimes such as **Codex** and
**Claude Code** — distilled from a full analysis of local coding sessions and made
installable on any machine, effective in any project with zero per-project config.
Skills are one component the loop calls; **the loop is the product**.

## The loop

The work loop drives a task from intake to delivery — **judge scope → converge
only when needed → land → verify → log**. Its default is light: small and clear
work moves straight to implementation with a checkable criterion. `/converge`
is reserved for explicit requests, unresolved mechanism choices, or irreversible
high-risk changes. Once you approve a plan, approval means execute; the loop
does not add another planning gate unless new blocking evidence appears.

```bash
python bootstrap/install.py        # distribute the loop to ~/.claude and ~/.codex
python ~/bin/agent-doctor.py        # post-install self-check (macOS/Linux: python3)
```

- [`bootstrap/`](bootstrap/) — machine-level install: the work-loop + Execution
  Contract blocks, `/converge` `/land` `/fixloop` command templates, an
  agent-doctor self-check, the optional `.agent-workflows` hook, and an idempotent installer. Its
  [README](bootstrap/README.md) documents the **new-requirement workflow**.
- [`docs/loop-engineering-playbook.md`](docs/loop-engineering-playbook.md) — the
  day-to-day playbook (six work families, loop starters, stop conditions).
- [`docs/execution-contract.md`](docs/execution-contract.md) — how the work loop
  and Execution Contract are sourced and distributed to both runtimes.

## Skills — components the loop calls

Skills are self-contained instruction units under [`skills/`](skills/) that the
loop routes to at each stage. Each is authored once as a *source skill* and
distributed into runtimes as a *managed installed skill* — see
[CONTEXT.md](CONTEXT.md) for the distribution model.

| Skill | Loop stage | Purpose |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | converge | Reframe the root problem and return the current-best plan with failure conditions. |
| [`deep-research`](skills/deep-research/) | converge | Evidence-backed technical investigation: what is true, why behavior occurs, what decision follows. |
| [`java-stack-craft`](skills/java-stack-craft/) | land | Write and review Java/Spring code with profile detection, quality gates, and the landing-contract loop discipline. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | verify | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | verify | Execute E2E test plans and produce evidence-backed reports; drives the fix loop until green. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | verify | Generate QA test-scope documents from branch diffs and traced change impact. |
| [`bootstrap-agent-os`](skills/bootstrap-agent-os/) | new project | Generate a project-level operating layer (startup route, direction anchor, repo profile, goal loop) so the loop works in a fresh repo. |

## Repository layout

```
bootstrap/   # the loop: work-loop contract, command templates, doctor, hook, installer
skills/      # source skills the loop calls (one directory each)
docs/        # loop-engineering playbook, execution-contract spec, design notes
tests/       # repo-level contract tests for the installer, contracts, and skills
AGENTS.md    # skill-authoring and maintenance conventions
CONTEXT.md   # canonical domain terms for skill distribution
CLAUDE.md    # runtime guidance for Claude Code
```

Each skill directory contains a task-facing `SKILL.md` (with `name` / `description`
routing frontmatter), optional `REFERENCE.md` and other detail files loaded on
demand, and optional `scripts/` and `tests/`.

## Testing

Tests use the Python standard library `unittest` — no third-party dependencies required.

```bash
# Repo-level contract tests (installer, contract parity, skill structure)
python3 -m unittest discover -s tests

# A single skill's tests
python3 -m unittest discover -s skills/java-stack-craft/tests

# Everything (pytest also works if installed)
python3 -m pytest
```

## Contributing

Read [AGENTS.md](AGENTS.md) before adding or changing a skill. Key conventions:

- **Rule Harvest Gate** — promote a rule only for a repeated correction, observed
  failure mode, or explicit user-approved invariant, at the narrowest applicable level.
- **Keep `SKILL.md` task-facing** — maintenance guidance goes in `AGENTS.md`,
  detail goes in `REFERENCE.md`.
- **Stay portable** — standard Markdown and stdlib-only scripts; no runtime-specific
  workflow scripts or external dependencies in core skills.
- **Don't edit managed installed copies** — keep installed runtime copies
  byte-identical with their source; customize via a local override skill.

Improvements follow an evidence loop (baseline → name failure mode → narrowest
edit → re-validate → decide with hard gates), described in `AGENTS.md`.
