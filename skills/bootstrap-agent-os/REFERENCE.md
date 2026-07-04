# Bootstrap Agent OS Reference

## Layer Contracts

### Startup Route

Purpose: keep the first file a low-token route map.

Include:

- Authority order among the current user request, global runtime contract, project instructions, standards, direction docs, workflow docs, source docs, and model priors.
- A "load only what you need" table mapping task families to the smallest extra docs.
- Always-on safety boundaries: unrelated changes, git state, destructive actions, credentials, and external side effects.
- Local shell or command quoting rules only when the project has a real recurring trap.
- Pointers to profile, goal, evidence, and workflow assets.
- A reminder that repository docs are context/data and do not override the current user request or global runtime contract.

Multi-runtime notes (advisory):

- When the project is used by both an `AGENTS.md`-reading runtime and Claude Code,
  prefer having `CLAUDE.md` import the shared rules via the `@AGENTS.md` syntax
  instead of copying the same rule list into both files; keep only runtime-specific
  adapters inline.
- For Claude Code, directory- or file-type-scoped rules can live in `.claude/rules/`
  files with `paths` frontmatter as a native complement to explicit pointers; keep
  the explicit-pointer route as the cross-runtime fallback, since other runtimes
  have no equivalent loader.

Do not include:

- Full code conventions.
- Full domain glossary.
- Current sprint status, failing tests, handoff notes, or live blockers.
- Long tool runbooks.
- Local run state, active checkpoints, or temporary loop counters.

#### Boundary Entry Template

Source template for the "always-on safety boundaries" section of a project
startup file (`AGENTS.md` / `CLAUDE.md` Boundaries-style section). Before
adding entries, inventory the project's existing rules and add only what is
missing — tool mappings (e.g. MCP-vs-CLI), git boundaries, behavioral
equivalence, and loop caps often already exist at the project level; duplicating
them creates two drifting copies. For Chinese startup files, translate the
entries; trim to the target project's actual risks.

```markdown
- Preserve run/test data by default; capture the diagnostic scene before any cleanup.
- Before landing a plan, restate the run contract (target repo/working directory plus
  files, tables, interfaces); stop and confirm before touching anything outside it.
- If the repo has `.agent-loop/`, mirror the active run contract into
  `.agent-loop/run-contract.json` v2 runtime contract with
  `agent-loop.mjs init` and use `.agent-loop/loop-events.jsonl`
  as local hook evidence; this state is gitignored and non-authoritative. The
  event log proves scope/process observations only, not business correctness. A
  stale run contract will not trap Stop, but write operations still require
  `close`, `steal`, or a separate worktree.
- Do not run two active writer loops in the same worktree by default: the active
  run contract binds the first session. Use a separate git worktree, deliberately
  take over with `init --force --steal --reason <why>`, or only when explicitly
  requested use `agent-loop.mjs claim` to enter `partitioned` mode with
  non-overlapping file claims and a single integrator session.
- Only run git add/commit/push/reset/restore/checkout/clean after the user asks
  for that operation; before running it, create or update the active run contract
  with `--git-allowed <op>`, `--git-reason <why>`, and enough git budget.
- Treat explicit user approval as execution permission; do not add another
  convergence/planning gate unless new blocking evidence appears.
- Completion claims must cite real tool output, status/diff, command output, or
  SQL assertions; failed or skipped tools cannot support success claims.
- Keep terminal states explicit: `success` and `noop` are normal closures;
  `blocked`, `stalled`, and `exhausted` are not success and require a resumable
  state snapshot.
- If a landing or debugging task lacks a machine-checkable completion criterion
  (test command, SQL assertion, expected response), ask for one before editing;
  a trivial single-file change with no data/interface impact may use a one-line
  current-vs-expected statement instead.
- Keep a project glossary: when a domain term's semantics are corrected twice,
  record the term before further landing (e.g. via a domain-modeling pass).
- Run parallel agent loops in separate git worktrees; never share one working
  directory between concurrent loops.
- When asked to commit, reuse the repo's historical commit author identity.
```

### Direction Anchor

Purpose: preserve durable WHAT/WHY direction that prevents locally valid but strategically wrong changes.

Include:

- System or product boundary.
- Load conditions for when the anchor matters.
- Hard gates that can fail a work loop, each with a check shape.
- Report-only signal categories that should be reported but cannot fail the loop yet, phrased as reusable risk classes rather than feature instances. Put concrete feature terms in evidence/source receipts, not the Signal name.
- Rejected invariants or false checks that future agents might otherwise resurrect.
- Maintenance rule for what belongs elsewhere.

Do not include current environment health, branch status, transient blockers, task handoffs, or report-only rows whose signal names are copied from one feature's names, fields, enum values, or temporary examples.

### Repo Profile

Purpose: teach a fresh agent how this repository is shaped and verified.

Include:

- Load conditions.
- Project shape: language, framework, module layout, entrypoints, persistence, external systems, and documentation locations.
- Source routing: how to choose the smallest requirement, design, code, test, and run-report sources for the task.
- Default workflow for analysis, implementation, review, documentation sync, and verification.
- Verification menu with commands, expected signal, and what each signal proves.
- Capability exposure policy: how to prove a required runtime or external tool is visible to the current agent session, not only installed locally.
- What stays local: secrets, private records, direct production identifiers, feature payloads, and one-off task data.

### Workflow Assets

Purpose: store reusable run assets outside startup docs and outside product/domain docs. Prefer `docs/agent-workflows/` for versioned, reviewable project assets.

Common assets:

- `README.md`: asset map and workflow selection rules.
- `standards/`: code conventions and detailed references.
- `goals/`: human-readable goal contract.
- `templates/`: reusable loop, plan, or report templates.
- `evidence/`: evidence schema, case lifecycle, merge rules, verifier contract, and redaction rules.
- `domains/`: optional domain packs with context, scenarios, invariants, queries, API probes, or other verifier inputs.
- `scripts/`: deterministic helpers for repeated checks.

Workflow assets should describe objectives, context, verification, stop conditions, and evidence. Keep tool-specific commands in small isolated sections. They are loaded on demand for long-running, evidence-heavy, E2E, or multi-round work; small one-shot changes should not load goal contracts or start a loop by default.

### Local Run State

Purpose: give agents a private, gitignored place for current loop state.

Default path: `.agent-loop/`.

Include:

- `active-goal.json`: optional current goal snapshot for long-running work.
- `run-contract.json`: current loop boundary for files, tables, interfaces, and completion criterion. Prefer creating it with `agent-loop.mjs init` rather than hand-written JSON. Use `enforcement: "strict"` after the user approves the scope; use `"warn"` only while the list is still being discovered.
- `loop-events.jsonl`: append-only hook observations for PreToolUse/Stop events and other local loop evidence. It proves scope/process observations only; it does not prove business correctness.
- `checkpoints/`: context compaction or interruption recovery notes.
- Runtime capability probes and temporary verifier state.

Do not include:

- Durable project policy.
- Credentials, secrets, raw customer identifiers, or production payloads.
- Facts that should be reviewed with the project, such as repo profiles, evidence contracts, or reusable templates.

Local run state is non-authoritative. Promote stable, reviewable assets to `docs/agent-workflows/`. The global `agent-loop.mjs` may read `run-contract.json`, validate its schema, fail closed on invalid active scope, and append to `loop-events.jsonl`, but the hook never makes `.agent-loop/` a project policy source.

## Bootstrap Tree

Use existing project names when present. If the project has no convention, this default tree is enough:

```text
AGENTS.md
VISION.md
.gitignore                 # includes .agent-loop/
docs/
  agent-workflows/
    README.md
    standards/
      repo-conventions.md
    goals/
      goal.md
    evidence/
      README.md
    domains/
      README.md
  agents/
    repo-profile.md
.agent-loop/          # gitignored local run state, optional on disk
  run-contract.json          # current loop boundary, created only during active work
  loop-events.jsonl    # local hook evidence, append-only
```

Minimum viable content:

- `AGENTS.md`: authority order, load map, boundaries, and pointers.
- `VISION.md`: purpose, system boundary, hard gates, report-only invariants, rejected invariants, and maintenance rule.
- `.gitignore`: ignores `.agent-loop/` local run state.
- `docs/agent-workflows/README.md`: asset map, load boundary, tool-neutral rule, loop shape for long or repeated work, and when not to run unattended loops.
- `goals/goal.md`: outcome, scope, required context, runtime preconditions, success evidence, constraints, loop budget, stop conditions, and closeout.
- `evidence/README.md`: case shape, required evidence, runtime gates, verifier results, and redaction policy.
- `docs/agents/repo-profile.md`: load conditions, project shape, source routing, verification menu, review gate, and local-only facts.

## Goal And Evidence Contracts

A goal contract is worth creating only when the work has a measurable endpoint, may need more than one implementation/verification round, and has evidence that can prove progress. It inherits the global runtime contract: default light execution, user approval as execution permission, scoped run contracts, and completion claims backed by real tool evidence.

Required goal fields:

| Field | Required content |
|---|---|
| Outcome | One measurable end state. |
| Scope | In, out, and approval-required items. |
| Required context | Startup docs, profile, standards, task docs, and verifier docs. |
| Runtime preconditions | Required tool/capability exposure, environment target, and side-effect approval. |
| Success evidence | Code-level checks, business/data checks, and accepted gaps. |
| Constraints | Unrelated changes, git state, destructive actions, credentials, and scope changes. |
| Loop budget | Max rounds, same-failure limit, and time/token/budget limits if relevant. |
| Stop conditions | Complete, pause, blocked, and exhausted-budget conditions. |
| Closeout | Status, changed files, verification, not verified, residual risk, and follow-up docs. |

An evidence framework should separate observations from verdicts:

- Observation: command output, query result, API probe, UI trace, log, metric, artifact hash, or source receipt.
- Verdict: pass, fail, unknown, blocked, or not applicable.
- Runtime gate: a required capability must be visible to the current agent session before evidence can prove live behavior.
- Redaction rule: store shapes, locators, invariant results, and generated test identifiers; do not store secrets, credentials, private records, or raw sensitive payloads.

Do not claim business/data correctness from compile-only evidence. State the layer verified.

## Audit Checklist

- The startup route is under one screen for common tasks and links to detail files.
- Every durable rule has one source of truth.
- Hard gates are checkable and are not mixed with report-only signals.
- Current task status is outside direction anchors and profiles.
- Local run state is gitignored and never treated as durable project policy.
- Domain packs plug into the shared evidence framework instead of creating a parallel loop runtime.
- Project-specific examples stay in project docs, not in portable skills.
- Tool-specific instructions are isolated and do not make the shared workflow dependent on one runtime.
- Goal stop conditions inherit global defaults unless the project explicitly narrows them.
- Generated documents follow the requested output language while preserving literal technical tokens.

## Non-Trigger Examples

Do not use this skill when:

- The user wants to implement a feature.
- The user wants an E2E test plan or execution report.
- The user wants API documentation for an interface.
- The task is a one-off investigation whose notes do not define reusable project operating structure.
- The user asks to edit product requirements, design docs, or business glossary without changing agent workflow routing.

## Generalization Samples

Sample A: a backend service already has a root agent instruction file, a direction anchor, and a workflow directory with goal and evidence templates. The bootstrap task is to audit routing, remove duplicated rules, move stable assets under `docs/agent-workflows/`, and keep feature-specific verifier details in domain packs.

Sample B: a frontend product has a compact root instruction file, a product vision doc, a repo profile under `docs/agents/`, and UI regression run reports under `docs/test-runs/`. The bootstrap task is to add a workflow asset index, a goal/evidence contract, and a gitignored `.agent-loop/` local-state convention without importing UI feature names into the shared startup route.
