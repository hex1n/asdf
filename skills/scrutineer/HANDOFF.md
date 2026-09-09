# Reviewer Handoff

The caller fills this template and passes it as the reviewer's whole brief.
A neutral handoff is checkable: every field below is present, and nothing
from the excluded list is. Keep the builder's conversation, conclusions,
suggested findings, and task-specific memory out of it.

## Template

```text
role: delegated-reviewer          # perform the review; do not delegate it again
skill: <path to scrutineer/SKILL.md, or its contents>
language: <report language>

request:
  original: <the user's request, verbatim or faithfully summarized>
  confirmed_corrections: <user corrections made during the work, with dates>
  discovered_requirements: <requirements found during implementation, each with its source>

authority:
  contract_sources: <specs, interface docs, target implementation for parity work>
  repository_rules: <AGENTS.md / CLAUDE.md / CONTRIBUTING and the rules that apply>
  review_checklists: <repository-owned review lists, or "none found">

scope:
  candidate: <commit, branch tip, or "working tree at <HEAD sha>">
  base: <merge-base sha, parent sha, or HEAD for working-tree review>
  uncommitted: <included paths, staged/unstaged/untracked, or "none">
  before_state: <snapshot, patch, or list of what existed before moves/deletions, or "not needed">
  coverage_plan: <for a large change: in depth / sampled / left out; otherwise "full">

access:
  read_only_mechanism: <host mechanism from the table below, as configured>
  check_entry_points: <test/lint/build commands and what each covers>
  isolated_copy: <path for authorized experiments, or "not authorized">

prior_evidence: <link to test results or CI runs; consult after deriving checks>
report: <path to scrutineer/REPORT.md>
```

Excluded from the handoff: the builder's transcript, reasoning, advisor
output, checklist, mutation results, suggested findings, and memory files
written for the task. Prior test evidence is linked, not summarized, so the
reviewer derives its own checks first.

## Host mechanisms

Record the mechanism actually used and its launch evidence in the report's
execution mode line. A role label or the reviewer's own claim is not evidence.

| Host | Fresh context | Read-only enforcement |
|---|---|---|
| Claude Code | The Agent tool with a non-fork subagent type starts an isolated context without the parent transcript. A fork inherits the conversation and does not qualify. | Recommended: a project agent definition under `.claude/agents/` with `disallowedTools: Write, Edit` and `permissionMode: plan`. The built-in `Explore` and `Plan` types also deny Write and Edit but skip CLAUDE.md and the parent's git status, so the handoff's `repository_rules` and `scope` must carry everything they need. |
| Codex | `codex exec --sandbox read-only "<handoff>"` starts a new session that carries this brief. `codex review --uncommitted`, `--base <branch>`, or `--commit <sha>` runs Codex's own review prompt without this skill; use it only when the user asks for Codex's own opinion, and report it as that. | The `read-only` sandbox policy on the run. |
| Other | Any launch whose configuration shows no transcript inheritance. | The host's tool allowlist or sandbox policy, named in the report. |

When no row applies and the host offers no equivalent, the review is blocked
for lack of context isolation; the caller reports that rather than reviewing
in its own context.
