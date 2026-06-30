# asdf-skills

> English | [简体中文](README.zh-CN.md)

Portable agent skills for local agent runtimes such as **Codex** and **Claude Code**.

Each skill is a self-contained directory under [`skills/`](skills/) with Markdown
instructions and, where needed, stdlib-only helper scripts and tests. Skills are
authored once as a *source skill* and distributed into runtimes as *managed
installed skills* — see [CONTEXT.md](CONTEXT.md) for the distribution model.

## Skills

| Skill | Purpose |
| --- | --- |
| [`bootstrap-agent-os`](skills/bootstrap-agent-os/) | Bootstrap or review project-level agent workflow operating docs: startup route, direction anchor, repo profile, goal loop, and evidence structure. |
| [`deep-research`](skills/deep-research/) | Evidence-backed technical investigation: what is true, why behavior occurs, what decision follows. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | Execute E2E test plans and produce evidence-backed reports. |
| [`first-principles-planner`](skills/first-principles-planner/) | Reframe the root problem and return the current-best plan with failure conditions. |
| [`generating-api-docs`](skills/generating-api-docs/) | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | Generate QA test-scope documents from branch diffs and traced change impact. |
| [`java-stack-craft`](skills/java-stack-craft/) | Write and review Java/Spring code with profile detection and quality gates. |

## Repository layout

```
skills/      # source skills (one directory each)
tests/       # repo-level contract tests for skill structure and routing
docs/        # design notes, plans, research
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
# Repo-level contract tests
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
