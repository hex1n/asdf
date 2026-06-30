---
name: bootstrap-agent-os
description: Bootstrap or review project-level agent workflow operating docs. Use when the user asks to generate, audit, or repair AGENTS.md, VISION.md as a direction anchor, repo profiles, agent-workflows, goal/evidence/profile structure, or a project-level agent workflow bootstrap. Do not use for feature implementation, E2E test planning or execution, API documentation, product requirements, design docs, business glossary edits, or business-domain documentation unless the task changes agent workflow routing or links those docs from the project operating layer.
---

# Bootstrap Agent OS

Bootstrap a small project-level agent operating layer: startup routing, durable direction, repo profile, goal loop, and evidence structure. Keep it source-backed, tool-neutral, and narrow.

Output language: write generated project documents in the language explicitly requested by the user; if none is explicit, match the user's prompt language. Preserve code identifiers, paths, commands, tool names, enum values, and quoted source text as-is.

## Workflow

### 1. Inventory Operating Assets

Read only the operating assets needed to understand the current shape:

- Root startup files such as `AGENTS.md`, `CLAUDE.md`, or equivalent agent instructions.
- Direction or context anchors such as `VISION.md`, `CONTEXT.md`, or a project glossary.
- Existing workflow directories such as `agent-workflows/`, `docs/agents/`, or `docs/*workflows*/`.
- Existing repo profiles, verification menus, goal templates, evidence indexes, and workflow scripts.

Use `rg --files` to find candidates. Do not load the whole `docs/` tree unless the user asks for a broad audit.

Completion criterion: the current operating assets, missing assets, authority order, and stale or duplicate areas are named before any edit.

### 2. Assign Each Rule To One Layer

Separate durable behavior into four layers:

- Startup route: low-token instructions that decide what to load next.
- Direction anchor: durable system purpose, boundaries, hard gates, and report-only invariants.
- Repo profile: project shape, source routing, verification menu, and tool/capability exposure.
- Workflow assets: goal templates, evidence framework, domain packs, scripts, and reusable run loops.

Use [REFERENCE.md](REFERENCE.md#layer-contracts) for layer contents and anti-contents.

Completion criterion: every candidate rule is assigned to exactly one layer, or rejected as transient task status that should not be persisted.

### 3. Bootstrap Or Repair The Skeleton

If the project already has a convention, follow it. If not, create the smallest useful skeleton from [REFERENCE.md](REFERENCE.md#bootstrap-tree).

Keep `AGENTS.md` short. Move detailed code conventions, domain checks, tool runbooks, and evidence details behind explicit pointers. Prefer a review patch over a rewrite when files already exist.

Completion criterion: a fresh agent can open the root startup file, find the relevant project profile or workflow doc, see the safety boundaries, and avoid loading unrelated documentation.

### 4. Define Goal And Evidence Contracts

For long-running or repeated work, define:

- A measurable outcome and scope.
- Required context and approval boundaries.
- Runtime preconditions and capability exposure checks.
- Code-level evidence versus business/data evidence.
- Loop budget, repeated-failure stop condition, and closeout fields.

Use [REFERENCE.md](REFERENCE.md#goal-and-evidence-contracts) when writing templates or reviewing existing ones.

Completion criterion: completion, blocked, pause, and not-verified states are distinguishable from the written artifacts.

### 5. Self-Check

Before finishing:

- Startup docs are short and route to details instead of embedding them.
- Direction docs contain durable hard gates, not current worktree status.
- Profiles describe how to discover and verify facts, not one feature's temporary facts.
- Workflow assets are tool-neutral unless a tool-specific section is isolated.
- No credentials, private records, production identifiers, or one-off task payloads were promoted into durable docs.
- Generated project docs use the requested output language while preserving literal technical tokens.

## Subagent Prompt

```
Bootstrap or review the project-level agent workflow docs for <project-root>.
First read:
  <skill>/SKILL.md
  <skill>/REFERENCE.md
Then inventory only the project's root agent instructions, direction/context docs, repo profiles, workflow directories, goal/evidence templates, and verification menus.
Produce or patch a narrow operating layer: startup route, direction anchor, repo profile, goal/evidence contracts, and workflow asset index.
Do not implement features, write E2E plans, write API docs, or promote feature-specific facts into durable workflow docs.
Write generated project docs in the user's requested language, or the user's prompt language if no language is explicit.
```
