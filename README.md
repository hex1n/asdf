# asdf-skills

> English | [简体中文](README.zh-CN.md)

Portable agent skills and user-level tools for Codex, Claude Code, and
compatible agent runtimes.

Each directory under [`skills/`](skills/) is a self-contained source skill with
task-facing instructions and optional references, scripts, or templates.

## Skills

Skills are authored once as source assets and can be distributed into one or
more agent runtimes as managed installed skills. See [CONTEXT.md](CONTEXT.md)
for the distribution vocabulary.

| Skill | Focus | Purpose |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | plan | Reframe the root problem and compare mechanisms before implementation. |
| [`plan-review`](skills/plan-review/) | verify | Independently falsify an exact completed design or plan revision until every required reviewer returns GO, or the review suspends; depth follows the candidate's risk and decides reviewer strength. |
| [`deep-research`](skills/deep-research/) | investigate | Evidence-backed technical investigation: what is true, why behavior occurs, which option the evidence supports. |
| [`arborist`](skills/arborist/) | implement | Implement complex system changes through intended contracts, deep modules, traced blast radius, and regression evidence. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | verify | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | verify | Execute E2E test plans and produce evidence-backed reports; drives the fix loop until green. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | verify | Generate QA test-scope documents from branch diffs and traced change impact. |
| [`skill-ab-trial`](skills/skill-ab-trial/) | verify | Run a controlled A/B trial to measure whether a candidate instruction changes what agents deliver. |
| [`rationale-records`](skills/rationale-records/) | navigate | Maintain and query Git-ignored personal current-code rationale, with strict source anchors and worktree handoff. |

## Lifecycle placement

```
plan         first-principles-planner → plan-review   ← decide the plan, then falsify it
implement    arborist                                 ← trace the roots, then shape the smallest safe change
verify       e2e-test-planner → e2e-test-executor · generating-test-scope · generating-api-docs
investigate  deep-research                            ← answer questions from evidence
              ↑ discovered unknowns feed the next plan
```

These skills keep the work itself correct. Stress-testing a plan the user
already holds (interview/grill-style skills) sits between planning and review
and lives outside this repository.

## Compatibility

These skills are independent of any orchestration runtime, and each is
independently distributable.
`plan-review` binds the same portable workflow to each host's read-only reviewer:
a configured second-model connector or fresh collaboration subagent in Codex,
and an external second model or fresh Agent subagent in Claude Code.

## Repository layout

```
skills/      # source skills and non-invocable support directories
tools/       # portable user-level agent tools
scripts/     # installers and contract checks
docs/        # design notes, plans, research
AGENTS.md    # skill-authoring and maintenance conventions
CONTEXT.md   # canonical domain terms for skill distribution
CLAUDE.md    # runtime guidance for Claude Code
```

Each skill directory contains a task-facing `SKILL.md` (with `name` / `description`
routing frontmatter), optional `REFERENCE.md` and other detail files loaded on
demand, and optional `scripts/` and `tests/`.

## Agent tools

The [portable Java formatter](tools/java-formatter/) and the scripts inside the
[rationale-records skill](skills/rationale-records/) share one Stop hook for Codex and
Claude Code. Business repositories may carry Git-ignored personal records under
`docs/rationale`, but never formatter/checker executables, runtime hooks, or rationale state.

    node scripts/install-agent-tools.mjs
    node scripts/install-agent-tools.mjs --apply
    node scripts/check-java-formatter.mjs
    node scripts/check-rationale-records.mjs

The installer links the formatter into `~/.agents/tools`, the complete rationale
skill into `~/.agents/skills`, and merges global runtime settings without
replacing unrelated hooks or settings.

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
