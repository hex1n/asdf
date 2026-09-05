# Repository Contract

This repository owns portable skills under `skills/`, user-level tools under
`tools/`, and their maintenance scripts under `scripts/`. This file defines
shared repository rules for every agent runtime.

## Before Working

Inspect the target files and relevant Git status or diff. Preserve pre-existing
and concurrent changes.

Use the requested deliverable to determine the work:

- Information-only audit, review, or explanation: inspect and report.
- Implementation: make focused changes and verify the affected behavior.
  An accompanying audit or review does not cancel an implementation request.

Read [CONTEXT.md](CONTEXT.md) when working on distribution terminology or behavior.

## Source Ownership

Edit repository-owned source assets. Managed installed skills must resolve to,
or remain byte-identical with, their source. Personal divergence belongs in a
separate override skill.

Install managed skills by linking with `node scripts/install-skills.mjs`.
The default invocation previews changes; `--apply` performs them.

Keep user-level tool implementations and runtime hook configuration out of
business repositories. Install tools by link and merge runtime configuration
while preserving unrelated settings. Each tool's README owns its external
requirements and contract commands.

## Skill Changes

Keep each skill independently distributable: standard Markdown instructions,
standard-library-only helper scripts, and no required sibling skill or
orchestration runtime. Core skills carry no runtime-specific workflow scripts,
external dependencies, or broad maintenance checklists unless the user
explicitly requests an exception. Tools may integrate runtimes at their
configuration boundary.

Keep `SKILL.md` task-facing. Put optional execution detail in referenced files
and repository maintenance procedures outside installed skill bodies.

**Create or improve a skill:** use the current runtime's official
`skill-creator` — Codex's built-in skill or Claude Code's official plugin.
Follow that workflow for evaluation and iteration while preserving this
repository's source, distribution, and verification constraints. Use the
current runtime's official guidance for invocation settings and metadata.

**Wording and structure:** use `writing-for-agents` when writing or editing
skills and shared agent instructions. Apply its wording, information hierarchy,
context-pointer, and pruning guidance while preserving the intended behavior.

## Target-Specific Requirements

When changing these targets:

- `tools/java-formatter/` or its installer: read
  [tools/java-formatter/README.md](tools/java-formatter/README.md) and run
  `node scripts/check-java-formatter.mjs`.
- `skills/rationale-records/`: read
  [skills/rationale-records/README.md](skills/rationale-records/README.md) and run
  `node scripts/check-rationale-records.mjs`.

## Verification And Completion

For any skill change or shared maintenance-rule change, run
`node scripts/check-all.mjs` before and after the change, plus relevant focused
checks. It discovers local `.test.mjs` suites and checks skill links and
installed copies. It does not replace target-specific contract
checks or behavioral validation selected by the official `skill-creator`.

For tool or installer changes, run the affected tool's documented contract
checks and relevant maintenance tests.

A portability claim names the platforms actually executed; source-level path
tests do not establish runtime execution on another platform.

Before reporting completion, inspect the final diff and report verification
results and material gaps. Distinguish introduced failures from pre-existing
or environmental ones.
