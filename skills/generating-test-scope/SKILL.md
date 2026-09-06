---
name: generating-test-scope
description: Generates QA test-scope documentation from branch diffs or changed artifacts. Use when the user asks for release test scope, change-impact testing, QA handoff, regression range, or impact analysis from git diff / branch changes. Do not use when the task is only to execute an existing test plan, write API docs, or run tests.
---

# Test Scope Generation

A test scope is an evidence map for release QA: what changed, what can be affected, and what QA should verify first. Do not write a generic test plan; derive scope from the diff and traced impact.

## Core Workflow

### 1. Frame Comparison
- Resolve whether the request covers branch commits, the current working tree, or a release comparison; inspect status first. For branch work, discover the integration branch rather than guessing. Pin the compared revisions, target module, release boundary, and output path.
- Read the project's test-scope convention. If none exists, default to `docs/test-scope/TestScope_{branch}_{YYYYMMDD}.md`.
- Completion criterion: comparison command, scope boundary, and output path are explicit; if the diff cannot be read, report blocked.

### 2. Build Change Inventory
- Use the selected [comparison mode](REFERENCE.md#comparison-modes), retaining its effective baseline, target, commands, and exclusions when delegating. Include staged, unstaged, and relevant untracked changes for working-tree scope. Keep deleted/renamed paths visible.
- Classify by responsibility: external contract, business flow, state/persistence, configuration/runtime, async/scheduled work, UI entrypoint, tests/tooling, or docs-only.
- Completion criterion: every changed artifact has status, responsibility, and risk reason; deleted and renamed paths remain visible.

### 3. Trace Impact Graph
- Trace entrypoints, upstream callers, downstream dependencies, state reads/writes, cross-process contracts, runtime switches, and existing test coverage.
- If the stack is unfamiliar or the impact crosses layers, read [REFERENCE.md](REFERENCE.md#impact-tracing).
- Completion criterion: every P0/P1 recommendation points to a changed artifact or traced dependency; unresolved edges go to Unknowns.

### 4. Tier QA Scope
- Rank by demonstrated failure consequence, reachable exposure, and recovery difficulty, using the project's priority meanings when defined. Boundary type identifies where to investigate, not priority by itself.
- P0: release-critical failures such as authorization escape, irreversible corruption, or an unavailable essential workflow.
- P1: material affected behavior with bounded impact or feasible recovery.
- P2: low-impact, localized regressions.
- Completion criterion: each recommendation names evidence, trigger/precondition, expected observable outcome, risk basis, existing coverage and its limits, and the remaining QA check. Distinguish suggested checks from tests actually executed.

### 5. Write Document
Write to the project convention or the default path. Include Summary, Change Inventory, Impact Graph, QA Scope, Risks and Unknowns, Non-Scope, and Evidence.
Output language: write the generated test-scope document in the language explicitly requested by the user; if none is explicit, match the user's prompt language. Use a project documentation convention only when the user is silent. Keep code identifiers, paths, commands, and literal values unchanged.

### 6. Self-Check
- No "full regression" substitute for bounded scope.
- No high-priority recommendation without evidence.
- Docs-only changes do not become P0 unless the released artifact is documentation.
- Non-scope items explain why they do not need testing. Generated files are excluded only after their generator and runtime/release consumers are accounted for.
- Recheck status or compared revisions before delivery; reconcile new relevant changes or explicitly bound the report to the earlier snapshot.

## Subagent Prompt

```
Generate a test-scope document for {requested outcome and release boundary}; write it to {output_path}.
Comparison mode: {branch | working-tree | release}.
Repository: {root}. Effective baseline: {resolved commit}.
Target: {resolved commit | current working tree}; exclusions: {explicit exclusions or none}.
Use the supplied {comparison commands or captured diff/status/untracked inputs}.
For working-tree mode, include staged, unstaged, and relevant untracked changes;
retain the supplied snapshot boundary and report any later relevant changes.
First read:
  <skill>/SKILL.md
  <skill>/REFERENCE.md
  <project>/docs/test-scope-profile.md, if present
Follow the Core Workflow. Output the change inventory, impact graph, P0/P1/P2 QA scope, risks, Unknowns, and non-scope items.
Every test recommendation must cite a changed artifact or traced dependency. Write the generated document in the user's requested language, or the user's prompt language if no language is explicit.
```
