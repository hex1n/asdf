# asdf — agent loop engineering

> English | [简体中文](README.zh-CN.md)

A portable **personal agent work loop** for local runtimes such as **Codex** and
**Claude Code** — distilled from a full analysis of local coding sessions and made
installable on any machine, effective in any project with zero per-project config.
Skills are one component the loop calls; **the loop is the product**.

## The loop

The work loop drives a task from intake to delivery — **judge scope → converge
only when needed → work → verify → log**. Its default is light: small and clear
work moves straight to implementation with a checkable criterion. The
`converge` skill is reserved for explicit requests, unresolved mechanism
choices, or irreversible high-risk changes. Once you approve a plan, approval
means execute; the loop does not add another planning gate unless new blocking
evidence appears.

```bash
node bootstrap/install.mjs         # distribute the loop to ~/.claude and ~/.codex
node ~/bin/taskloop.mjs status      # post-install check (reads task state, or 'no task')
```

- [`taskloop/`](taskloop/) — the loop system: the task-first CLI, PreToolUse/
  Stop hooks (envelope + criterion gate), outcome ledger, and program cards.
  See its [README](taskloop/README.md).
- [`bootstrap/`](bootstrap/) — machine-level install: the work-loop contract
  card (sourced in [`bootstrap/contract/`](bootstrap/contract/); installed as
  a Claude user rule and a Codex AGENTS.md block), the e2e-report-check adapter
  seed, and an idempotent installer that distributes taskloop and registers its
  hooks. Its [README](bootstrap/README.md) documents the **new-requirement
  workflow**, the distribution manifest, and the maintenance discipline.

## Skills — components the loop calls

Skills are self-contained instruction units under [`skills/`](skills/) that the
loop routes to at each stage. Each is authored once as a *source skill* and
distributed into runtimes as a *managed installed skill* — see
[CONTEXT.md](CONTEXT.md) for the distribution model.

| Skill | Loop stage | Purpose |
| --- | --- | --- |
| [`converge`](skills/converge/) | converge | Planning-only convergence for explicit or high-risk unresolved decisions. |
| [`workloop`](skills/workloop/) | land/verify | The one work loop for machine-verifiable work: source the criterion (given/recovered/absent), open a taskloop task, change–verify–review–fix, stop at a named terminal state. |
| [`judgment-loop`](skills/judgment-loop/) | land/verify | Rubric-gated production loop for judgment-verified deliverables: pre-registered rubric, fresh-context review, human acceptance. |
| [`meta-loop`](skills/meta-loop/) | meta | Improvement loop for the loop itself: loop-health metrics, candidate harvest, one evidence-gated change per round. |
| [`first-principles-planner`](skills/first-principles-planner/) | converge | Reframe the root problem and return the current-best plan with failure conditions. |
| [`deep-research`](skills/deep-research/) | converge | Evidence-backed technical investigation: what is true, why behavior occurs, what decision follows. |
| [`java-stack-craft`](skills/java-stack-craft/) | land | Write and review Java/Spring code with profile detection, quality gates, and the landing-contract loop discipline. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | verify | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | verify | Execute E2E test plans and produce evidence-backed reports; drives the fix loop until green. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | verify | Generate QA test-scope documents from branch diffs and traced change impact. |
| [`project-docs-layer`](skills/project-docs-layer/) | project docs | Audit or minimally repair a repo's operating docs via the five questions (Start/Verify/Conventions/Direction/Danger), pushing answers toward executable homes; verified facts only, work discipline stays in the machine. |

`skills/loop-core/` is a shared support directory for the loop skills,
not an invocable skill. The loop system these skills drive is **taskloop**
(`taskloop/`); see its [README](taskloop/README.md).

## Repository layout

```
taskloop/    # the loop system: task-first CLI + PreToolUse/Stop hooks + ledger
bootstrap/   # machine install: work-loop contract, adapter seed, installer
skills/      # source skills and non-invocable support directories
docs/        # design notes, plans, research
tests/       # repo-level contract tests for the installer, contracts, and skills
AGENTS.md    # skill-authoring and maintenance conventions
CONTEXT.md   # canonical domain terms for skill distribution
CLAUDE.md    # runtime guidance for Claude Code
```

Each skill directory contains a task-facing `SKILL.md` (with `name` / `description`
routing frontmatter), optional `REFERENCE.md` and other detail files loaded on
demand, and optional `scripts/` and `tests/`.

## Testing

Tests use Node's built-in `node:test` for bootstrap runtime scripts and Python
standard-library `unittest` for the remaining repository and skill contracts.
No third-party dependencies are required. CI ([`.github/workflows/tests.yml`](.github/workflows/tests.yml))
runs the full suite on every push and pull request with both runtimes provisioned.

```bash
# Node taskloop tests (the loop system) + adapter-seed test
node --test taskloop/tests/taskloop.test.mjs tests/e2e_report_check.test.mjs

# Python repo-level contract tests (contract parity, skill structure)
python -m unittest discover -s tests

# A single skill's tests
python -m unittest discover -s skills/java-stack-craft/tests
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
