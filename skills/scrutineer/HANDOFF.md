# Reviewer Handoff

The caller writes the brief as JSON against [handoff-schema.json](handoff-schema.json)
and passes it as the reviewer's whole task. The caller is usually the builder
of the candidate, so the brief's neutrality is a property of its form rather
than of the caller's intent: every field has a shape a script checks, and
material with no field has nowhere to go. Keep the builder's conversation,
reasoning, advisor output, checklists, mutation results, suggested findings,
and task-specific memory out of it.

## Brief

```json
{
  "role": "delegated-reviewer",
  "skill": { "path": "<scrutineer/SKILL.md>", "revision": "<commit or content hash>" },
  "language": "<report language>",
  "review": "initial | re-review",
  "review_series": "<stable id shared by every round on this candidate>",
  "request": {
    "original": [{ "date": "<YYYY-MM-DD>", "text": "<the user's message, verbatim>" }],
    "confirmed_corrections": [{ "date": "<YYYY-MM-DD>", "text": "<the user's correction, verbatim>" }],
    "discovered_requirements": [{ "requirement": "<found during implementation>", "source": "<where it comes from>" }]
  },
  "authority": {
    "contract_sources": [{ "path": "<spec, interface doc, approved plan, or parity target>", "revision": "<...>" }],
    "repository_rules": [{ "path": "<AGENTS.md / CLAUDE.md / CONTRIBUTING>", "revision": "<...>" }],
    "review_checklists": [{ "path": "<repository-owned review list>", "revision": "<...>" }]
  },
  "lenses": {
    "selected": [{ "heading": "<LENSES.md section the change triggers>", "reference": { "path": "<references/LENSES.md>", "revision": "<...>" } }],
    "excluded": [{ "heading": "<section>", "reason": "<the fact in this change that excludes it>" }]
  },
  "scope": {
    "candidate": {
      "revision": "<commit, branch tip, or working tree at <HEAD sha>>",
      "content_identity": [{ "path": "<uncommitted file or supporting input>", "identity": "sha256 <hex>" }]
    },
    "base": "<merge-base sha, parent sha, or HEAD for working-tree review>",
    "uncommitted": [{ "path": "<included path>", "state": "staged | unstaged | untracked" }],
    "before_state": "<snapshot, patch, or list of what existed before moves or deletions, or \"not needed\">",
    "coverage_plan": [{ "surface": "<path, module, or contract>", "depth": "in-depth | sampled | skipped" }]
  },
  "target": {
    "contracts": [{ "contract": "<obligation the change touches>", "source": "<its authority>" }],
    "entry_points": ["<path or symbol that reaches it, producers and consumers included>"],
    "unresolved_paths": ["<what the builder's trace left unobserved; \"unknown\" where that is the truth>"]
  },
  "access": {
    "read_only_mechanism": "<host mechanism from the table below, as configured>",
    "check_entry_points": [{ "command": "<test, lint, or build command>", "covers": "<what it covers>" }],
    "isolated_copy": "<path for authorized experiments, or \"not authorized\">"
  },
  "prior_evidence": [{ "path": "<test results or CI run>", "revision": "<...>" }],
  "report": {
    "rules": { "path": "<scrutineer/REPORT.md>", "revision": "<...>" }
  },
  "record_output": "<path to write the review record, or \"inline\">",
  "re_review": {
    "previous_report": { "path": "<the prior record>", "revision": "<...>" },
    "responses": { "path": "<the builder's per-id answers>", "revision": "<...>" }
  }
}
```

The schema fixes the shape; these are the fields whose meaning it cannot carry.

- `request.original` and `confirmed_corrections` hold the user's messages, one
  item per message with its date, verbatim. A plan, design, or spec the user
  approved is a contract source by path and revision; restated here it puts
  the builder's words where the user's belong, and the reviewer then reviews
  the builder's framing of the request.
- A **reference** (`skill`, the `authority` lists, `lenses.selected[].reference`,
  `prior_evidence`, `report.rules`, `re_review`) is a `path` plus the `revision`
  the reviewer reads it at: a Git object name for a committed file, or
  `sha256 <hex>` of the file as it is now for an uncommitted or untracked one.
  The reviewer reads that exact version, `git show <revision>:<path>` or the
  hash checked, because the caller keeps working while the review runs; the
  validator verifies the same two roads. `text` carries the content only where
  the reviewer's filesystem cannot reach the file. The brief carries no record
  schema: the reviewer writes the record from the template in the `report.rules`
  file.
- `lenses` is the caller's selection, because selection reads the diff and the
  reviewer has not seen it yet: each section of
  [references/LENSES.md](references/LENSES.md) whose trigger the change meets
  goes under `selected` with its heading, the rest under `excluded` with the
  fact that excludes each. The two lists partition that file, every section
  once, on one side or the other.
- `scope.candidate.content_identity` pins the uncommitted files in scope and
  the supporting inputs the review evidence depends on, each `identity` as
  `sha256 <hex>` of the file as it is now, so the reviewer recomputes the
  same digest. `coverage_plan` uses the record's `in-depth | sampled | skipped`
  vocabulary, one row per surface, so the record's `coverage.surfaces` reports
  the plan and its outcome instead of reconstructing them afterward.
- `target`, `prior_evidence`, and `re_review.responses` are builder-held
  navigation: facts and unknowns, never conclusions. An entry point is
  navigation; "this path is safe" is a finding. The reviewer derives its
  checks from the request, the diff, and the authority sources first and
  reads these after, so they focus the work without steering it.

## Check and dispatch

`node <skill-dir>/scripts/validate-handoff.cjs <brief.json>` applies the
schema and the rules it cannot express: every reference readable at its
revision or carrying its text, every content identity the digest of its file
as it is now, the lens lists partitioning LENSES.md, a re-review carrying its
prior round. The caller runs it before dispatch; the
reviewer runs it on acceptance whenever Node and the skill directory are
reachable, and reads for the same things otherwise. It cannot tell a quote
from a paraphrase: a `request.original` item that reads as a task description
rather than a message is the reviewer's to report.

The brief is a file the launch message names, or inline. The launch message
carries the brief's location and the permissions the reviewer runs under;
anything else the reviewer needs to know is a brief field, so it is checked
like one. A brief that fails
the check comes back `blocked` naming the gap, and the corrected brief starts
a new reviewer, because a context that has read builder material is not
restored by ignoring it. Without a review-method skill the reviewer still
derives its checks from the requirements and the diff before reading builder
material, and reports in REPORT.md's skeleton. A length cap set by the caller
bounds the summary, never the required sections.

## Host mechanisms

The caller owns host verification. Check the actual launch configuration and
host receipt for context inheritance and read-only enforcement, bind the
returned result to that reviewer/session, and record those facts in
`mode.host_evidence`, naming each automatic context source the host offers
for the session (memory, project instructions, a resumed transcript) and
showing it off or empty. A role label or planned command is not execution
evidence.

When a session receipt is available only after dispatch, the reviewer may
return its source review with `mode.host_evidence` marked pending caller
verification. It need not discover its own process or read its startup log.
Before delivery the caller replaces that pending value with observed evidence,
checks the record, and renders the report. If isolation cannot be established,
retain the findings and limits but set the overall verdict and `mode.context`
to `blocked`, add the isolation gap to `coverage.limits`, and validate again;
no independent acceptance claim may escape this check. Those are the only
changes a delivery makes to the returned record, and
[REPORT.md](REPORT.md#delivered-record) checks them. Detected
builder-context contamination still requires a new reviewer. Missing receipt
visibility alone does not.

| Host | Fresh context | Read-only enforcement |
|---|---|---|
| Claude Code | The Agent tool with a non-fork subagent type starts an isolated context without the parent transcript. A fork inherits the conversation and does not qualify. | Recommended: a project agent definition under `.claude/agents/` with `disallowedTools: Write, Edit` and `permissionMode: plan`. The built-in `Explore` and `Plan` types also deny Write and Edit but start without the parent's git status, and which project instructions the host loads for them is observed per session rather than fixed, so the brief's `repository_rules` and `scope` must carry everything they need. |
| Codex | `codex exec --sandbox read-only -o <file> "<launch message>"` starts a new session that reads this brief and writes its last message to `<file>`. From inside a sandboxed Codex session the launch itself needs escalation; the reviewer still runs under `read-only`. `codex review --uncommitted`, `--base <branch>`, or `--commit <sha>` runs Codex's own review prompt without this skill; use it only when the user asks for Codex's own opinion, and report it as that. | The `read-only` sandbox policy on the run. |
| Other | Any launch whose configuration shows no transcript inheritance. | The host's tool allowlist or sandbox policy, named in the report. |

When no row applies and the host offers no equivalent, the review is blocked
for lack of context isolation; the caller reports that rather than reviewing
in its own context.
