# Domain Language

Canonical terms for this repository's two asset families: **skill
distribution** and **loop engineering**. Entries are definitions with
pointers — the rule bodies live in the named sources
([AGENTS.md](AGENTS.md), [bootstrap/README.md](bootstrap/README.md),
[bootstrap/contract/](bootstrap/contract/)) and are not restated here.

## Skill Distribution

This context defines the language for distributing portable agent skills from this repository into local agent runtimes such as Codex and Claude Code. The same Source / Managed / Cache Drift model governs the other bootstrap-managed assets: contract blocks merged into user-level startup files and `bin/` scripts installed to `~/bin` (see the maintenance discipline in [bootstrap/README.md](bootstrap/README.md)).

### Language

**Source Skill**:
A skill directory under the repository `skills/` tree that acts as the source of truth for a managed skill.
_Avoid_: remote copy, upstream folder

**Managed Installed Skill**:
A local installed skill that is controlled by a source skill and should not be edited directly.
_Avoid_: local source, user fork

**Installed Skill Cache**:
The local copy of a managed installed skill that one or more agent runtimes load.
_Avoid_: editable installation, local master

**Agent Runtime**:
A tool that discovers and loads installed skills, such as Codex or Claude Code.
_Avoid_: Codex-only consumer

**Local Override Skill**:
A separate user-owned skill used for personal customisation instead of editing a managed installed skill in place.
_Avoid_: patching the installed cache

**Provenance Record**:
Metadata that identifies the source and last-synced content of a managed installed skill.
_Avoid_: install note, sync log

**Cache Drift**:
A mismatch between an installed skill cache and its last recorded synced content.
_Avoid_: local update, manual fix

### Relationships

- A **Source Skill** produces zero or more **Managed Installed Skills**.
- A **Managed Installed Skill** lives in an **Installed Skill Cache**.
- An **Installed Skill Cache** may be shared by multiple **Agent Runtimes**.
- A **Local Override Skill** is separate from a **Managed Installed Skill**.
- A **Provenance Record** belongs to exactly one **Managed Installed Skill**.
- **Cache Drift** blocks automatic replacement unless the user explicitly forces it.

### Example dialogue

> **Dev:** "Can I change the installed `deep-research` skill directly?"
> **Domain expert:** "No. That is a **Managed Installed Skill** in the shared **Installed Skill Cache** used by **Agent Runtimes** such as Codex and Claude Code; make a **Local Override Skill** if you need personal behaviour."
> **Dev:** "What if the remote source has a newer version?"
> **Domain expert:** "Update it only after checking the **Provenance Record** and confirming there is no **Cache Drift**."

### Flagged ambiguities

- "local skill" can mean either a **Managed Installed Skill** or a **Local Override Skill**. Resolved: repository-managed installs are **Managed Installed Skills** and are treated as read-only cache entries.
- "update" must not mean blind overwrite. Resolved: updates are safe replacements from a source skill after provenance and drift checks.
- "agent runtime" must not mean Codex only. Resolved: Codex and Claude Code are both **Agent Runtimes** that may share the same **Installed Skill Cache**.

## Loop Engineering

Language for the work-loop machinery. The loop system is **taskloop**
(`taskloop/`); semantics and boundaries live in
[taskloop/README.md](taskloop/README.md), with the always-loaded default card
under [bootstrap/contract/](bootstrap/contract/).

### Language

**Work Loop**:
The product of this repository: the judge-scope → converge-when-needed → work → verify → stop cycle, distributed into user-level runtime files by `bootstrap/install.mjs`.
_Avoid_: workflow automation, skill collection

**Task**:
The durable unit of one loop run: goal, red-at-birth criterion, alignment line, envelope, task-level budgets, and evidence. Episodes (single continuous runs) come and go underneath it; budgets live on the task and are never refilled by resuming.
_Avoid_: run (that is an episode), session

**Envelope**:
The files/tables/interfaces/git surface a task may touch, declared at `open`. The PreToolUse hook denies writes outside it; reads are never blocked. Stop before expanding it.
_Avoid_: scope list, run contract (the v1 name)

**Task State**:
The machine-readable state of a task: `.taskloop/task.json`, created with `taskloop open`. Gitignored agent-private state; never a project policy source.
_Avoid_: run-contract.json (the v1 file), loop state file

**Criterion Gate (判据闸门)**:
The Stop-hook machine adjudication that runs the task's `criterion` and closes `done` only on a fresh green run. A collaborative backstop against unintended early stops, not an adversarial defense. There is no claim-based success.
_Avoid_: test gate, tamper-proof gate

**Terminal State**:
The closure of a task: `done` (criterion green) is the only machine-written success; `not_needed` and `abandoned` are human-declared closures. Suspend is not a closure — its outcomes `needs_input`/`stuck`/`out_of_budget` keep the task open for the next episode.
_Avoid_: success, finished

**Driver (驱动器)**:
The component that re-prompts the loop across turns so a human is not the per-turn clock (`/goal` criterion re-check, or `ralph-loop` fresh-context re-feed). Driver + criterion gate + criterion together close the loop; the taskloop stop gate already blocks a premature stop within a turn.
_Avoid_: scheduler, cron job

**Concurrency Mode**:
How parallel writers share work: worktree fan-out (one worktree per writer, each with its own `.taskloop/` task, one integrator). There is no shared-worktree partitioned mode.
_Avoid_: multi-session (ambiguous)

**Integrator Session**:
The single session allowed to run git operations and merge across worktrees after each writer's task reaches a terminal state.
_Avoid_: main session

**Outcome Ledger**:
`~/.taskloop/outcomes.jsonl` — one out-of-tree, append-only row per task close (state, episodes, criterion_input_drift). The runtime only writes it; it feeds the meta loop and is not tamper-resistant.
_Avoid_: audit log

**Episode**:
One continuous run of a task under a single session. A task suspends and resumes across episodes; the machine records the changed-files half of the snapshot from its own observations, the human supplies the three judgment lines.
_Avoid_: session (a session may span or drop episodes)

### Flagged ambiguities

- "Task" vs "Episode": the durable unit vs one continuous run. Resolved: budgets and identity belong to the **Task**; an **Episode** is a run underneath it, and resuming never refills the task budget.
- "gate" can mean the criterion gate, an approval gate, or a review gate. Resolved: **Criterion Gate** is only the Stop-hook criterion adjudication; approval and review gates are named separately.
- The outcome ledger is not an audit log. Resolved: it records collaborative outcome/process only; business correctness needs tests, SQL, API responses, or diffs.
