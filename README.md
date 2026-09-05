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
| [`assayer`](skills/assayer/) | verify | Independently falsify an exact completed design or plan revision until every required reviewer returns GO, or the review suspends; depth follows the candidate's risk and decides reviewer strength. |
| [`deep-research`](skills/deep-research/) | investigate | Evidence-backed technical investigation: what is true, why behavior occurs, which option the evidence supports. |
| [`arborist`](skills/arborist/) | implement | Implement and refactor existing code with preserved behavior, clearer architecture, and verification matched to risk. |
| [`e2e-test-planner`](skills/e2e-test-planner/) | verify | Build source-backed end-to-end test plans from design, requirements, and code. |
| [`e2e-test-executor`](skills/e2e-test-executor/) | verify | Execute E2E test plans and produce evidence-backed reports; drives the fix loop until green. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts. |
| [`generating-test-scope`](skills/generating-test-scope/) | verify | Generate QA test-scope documents from branch diffs and traced change impact. |
| [`rationale-records`](skills/rationale-records/) | navigate | Maintain and query Git-ignored personal current-code rationale, with strict source anchors and worktree handoff. |

## Methods behind the skills

Each skill encodes a small number of established methods rather than a house
style. Knowing which ones explains why a skill insists on a step, and where to
look when extending it.

| Skill | Methods |
|---|---|
| `first-principles-planner` | First-principles reasoning: root reframe (Five Whys for solution-shaped asks), splitting true constraints from conventions and unverified assumptions; option tournament with an inversion test; a Value Gate deciding worth-building before design; a pre-registered Bestness Check with an enforceable stop point. |
| `assayer` | Popperian falsification by independent reviewers, with a second model as a stronger falsifier for same-model blind spots; a fail-closed exact gate with no approximate pass; severity fixed by consequence, never by review cost; an operator-on-call walk for one full-depth reviewer — perspective-based reading (Basili) narrowed to the single perspective an A/B trial found worth its cost; a Decision Envelope separating the technical verdict from the value decision. |
| `deep-research` | Evidence hierarchy (primary versus non-primary sources), triangulation through independent evidence lanes, and strong inference (Platt; Chamberlin's multiple working hypotheses): rival explanations kept alive until a distinguishing check separates them. |
| `arborist` | Observable contracts and traced change impact; deep modules (Ousterhout) and characterization tests (Feathers); staged refactoring through compatibility and obsolete-path removal; verification matched to risk, with targeted mutation and focused independent review when warranted. |
| `e2e-test-planner` | Model-based test design: coverage criteria over the input space (Base-Choice, Pairwise), state graph, and decision logic, where a rule firing on several independent conditions owes one obligation per condition (Ammann & Offutt; the deciding-condition idea from MC/DC); an oracle independent of the implementation, with expected-result authority separated from implementation evidence; change blast radius. |
| `e2e-test-executor` | The RIPR model — reachability and infection as controllability, propagation and revealability as observability; evidence captured in order of volatility (digital forensics); PROV-style provenance so plan, run, and artifacts reconstruct from the artifacts alone; an explicit SUT boundary declaring every real dependency and double. |
| `generating-api-docs` | Design by contract and information hiding (Parnas): document the caller contract, never the implementation; the target contract, never a current defect. |
| `generating-test-scope` | Change-impact analysis by dependency tracing, risk-based test prioritization, and evidence-mapped recommendations. |
| `rationale-records` | Chesterton's fence — record why the code has its exact shape before a natural-looking rewrite removes it; one invariant, one current owner; anchored reverse index from source to reason. |

## Lifecycle placement

```
plan         first-principles-planner → assayer       ← decide the plan, then falsify it
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
`assayer` binds the same portable workflow to each host's read-only reviewer:
a configured second-model connector or fresh collaboration subagent in Codex,
and an external second model or fresh Agent subagent in Claude Code.

## Repository layout

```
skills/      # source skills and non-invocable support directories
tools/       # portable user-level agent tools
scripts/     # installers and contract checks
docs/        # design notes, plans, research
AGENTS.md    # shared repository contract
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

Follow the verification requirements in [AGENTS.md](AGENTS.md#verification-and-completion).

## Contributing

Read [AGENTS.md](AGENTS.md) before repository work. It owns source ownership,
portability, authoring, and verification requirements for skills and tools.
Skill creation and improvement use the current runtime's official
`skill-creator`, with `writing-for-agents` for wording and information structure.
Repository-specific constraints remain in `AGENTS.md`.
