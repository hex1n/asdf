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

Language for the work-loop machinery distributed from `bootstrap/`. Semantics
and boundaries live in [bootstrap/README.md](bootstrap/README.md) and the
contract sources under [bootstrap/contract/](bootstrap/contract/).

### Language

**Work Loop**:
The product of this repository: the judge-scope → converge-when-needed → land → verify → stop cycle, distributed into user-level runtime files by `bootstrap/install.mjs`.
_Avoid_: workflow automation, skill collection

**Run Contract**:
The prose-level agreement for one loop run — target repo/working directory, the files/tables/interfaces to touch, and the completion criterion — restated before landing.
_Avoid_: scope list, runtime contract (that is its machine form)

**Runtime Contract**:
The machine-readable landing of a Run Contract: `.agent-loop/run-contract.json` v2, created with `agent-loop.mjs init`. Gitignored agent-private state; never a project policy source.
_Avoid_: run contract (the prose concept), loop state file

**Criterion Gate (判据闸门)**:
The Stop-hook machine adjudication that runs the contract's `criterion` and admits `terminal_state=success` only when it passes. A collaborative backstop against unintended early stops, not an adversarial defense.
_Avoid_: test gate, tamper-proof gate

**Terminal State**:
The explicit closure of a loop run: `success` and `noop` are normal closures; `blocked`, `stalled`, and `exhausted` are non-success and require a resumable snapshot.
_Avoid_: done, finished

**Driver (驱动器)**:
The component that re-prompts the loop so a human is not the per-turn clock (`/goal` criterion re-check, or `ralph-loop` fresh-context re-feed). Driver + criterion gate + criterion together close the loop.
_Avoid_: scheduler, cron job

**Concurrency Mode**:
How sessions share a working directory: `exclusive` (default single-writer binding), **worktree fan-out** (recommended: one worktree per writer, one integrator), or `partitioned` (explicit non-overlapping claims in one worktree).
_Avoid_: multi-session (ambiguous)

**Integrator Session**:
In `partitioned` mode, the single session allowed to run git operations and merge writer claims after all claims reach a terminal state.
_Avoid_: main session

**Event Log**:
`.agent-loop/loop-events.jsonl` — hook-observed scope/process evidence. It never proves business correctness and is not tamper-resistant.
_Avoid_: audit log

**Abandoned Run Contract**:
An active runtime contract whose owner session is gone. It never traps Stop, but write operations still require `close`, `steal`, or a separate worktree.
_Avoid_: stale lock

### Flagged ambiguities

- "Run Contract" vs "Runtime Contract": the prose agreement and its machine landing were both called "run contract". Resolved: **Run Contract** is the prose-level agreement; **Runtime Contract** is `.agent-loop/run-contract.json` v2. The file name `run-contract.json` is historical and unchanged.
- "gate" can mean the criterion gate, an approval gate, or a review gate. Resolved: **Criterion Gate** is only the Stop-hook criterion adjudication; approval and review gates are named separately.
- The event log is not an audit log. Resolved: it proves collaborative scope/process only; business correctness needs tests, SQL, API responses, or diffs.
