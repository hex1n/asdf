# asdf-skills

> English | [简体中文](README.zh-CN.md)

Portable agent skills for planning, research, documentation, implementation,
and verification across Codex, Claude Code, and compatible agent runtimes.

Each directory under [`skills/`](skills/) is a self-contained source skill with
task-facing instructions and optional references, scripts, or templates.

## Skills

Skills are authored once as source assets and can be distributed into one or
more agent runtimes as managed installed skills. See [CONTEXT.md](CONTEXT.md)
for the distribution vocabulary.

| Skill | Focus | Purpose |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | plan | Reframe the root problem and compare mechanisms before implementation. |
| [`plan-review`](skills/plan-review/) | verify | Re-review an exact completed-plan revision with a second model or fresh-context subagent until every required reviewer returns GO; review depth follows plan risk. |
| [`deep-research`](skills/deep-research/) | investigate | Evidence-backed technical investigation: what is true, why behavior occurs, which option the evidence supports. |
| [`project-docs-layer`](skills/project-docs-layer/) | prepare | Audit and repair the operating-docs layer a project needs before work starts. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | verify | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | verify | Execute E2E test plans and produce evidence-backed reports; drives the fix loop until green. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | verify | Generate QA test-scope documents from branch diffs and traced change impact. |

## Compatibility

These skills are independent of any orchestration runtime. They may compose
with the standalone [taskloop](https://github.com/hex1n/taskloop) project, but
this repository does not own or distribute taskloop, `workloop`, or `loop-core`.
`plan-review` binds the same portable workflow to each host's read-only reviewer:
a configured second-model connector or fresh collaboration subagent in Codex,
and an external second model or fresh Agent subagent in Claude Code.

## Repository layout

```
skills/      # source skills and non-invocable support directories
docs/        # design notes, plans, research
AGENTS.md    # skill-authoring and maintenance conventions
CONTEXT.md   # canonical domain terms for skill distribution
CLAUDE.md    # runtime guidance for Claude Code
```

Each skill directory contains a task-facing `SKILL.md` (with `name` / `description`
routing frontmatter), optional `REFERENCE.md` and other detail files loaded on
demand, and optional `scripts/` and `tests/`.

## Testing

Run the focused checks provided by the skill being changed.

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
