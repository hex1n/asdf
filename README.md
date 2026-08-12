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
| [`plan-review`](skills/plan-review/) | verify | Independently falsify an exact completed design or plan revision until every required reviewer returns GO, or the review suspends; depth follows the candidate's risk and decides reviewer strength. |
| [`deep-research`](skills/deep-research/) | investigate | Evidence-backed technical investigation: what is true, why behavior occurs, which option the evidence supports. |
| [`implementation-mastery`](skills/implementation-mastery/) | investigate | Build a source-backed implementation map for one named target and traverse every behavior-affecting node to closure. |
| [`blindspot-pass`](skills/blindspot-pass/) | prepare | Surface the unknown unknowns between the user and unfamiliar territory before work starts, and turn them into a better prompt. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | verify | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | verify | Execute E2E test plans and produce evidence-backed reports; drives the fix loop until green. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | verify | Generate QA test-scope documents from branch diffs and traced change impact. |
| [`code-forge`](skills/code-forge/) | implement | Forge production behavior with the smallest sufficient mechanism and coherent model while preserving state, effect, boundary, and verification semantics. |
| [`merge-quiz`](skills/merge-quiz/) | verify | Quiz the user on a completed change until a perfect pass, gating merge or approval on their comprehension. |

## Lifecycle placement

```
prepare      blindspot-pass                           ← improve the prompt before work
plan         first-principles-planner → plan-review   ← decide the plan, then falsify it
implement    code-forge                               ← forge code coherently
verify       e2e-test-planner → e2e-test-executor · generating-test-scope · generating-api-docs
approve      merge-quiz                               ← gate merge on the human's comprehension
investigate  deep-research · implementation-mastery   ← answer questions or map code to closure
              ↑ discovered unknowns feed the next plan
```

Most skills keep the work itself correct. Two keep the human in sync with fast
agent output: `blindspot-pass` stops unknown unknowns from shaping the prompt,
and `merge-quiz` stops changes nobody understands from being approved.
Stress-testing a plan the user already holds (interview/grill-style skills)
sits between planning and review and lives outside this repository. On small
changes in familiar code under live supervision, the human-sync skills stay
silent.

## Compatibility

These skills are independent of any orchestration runtime, and each is
independently distributable.
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
