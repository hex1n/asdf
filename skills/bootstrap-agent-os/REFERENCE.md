# Bootstrap Agent OS Reference

## Layer Contracts

### Startup Route

Purpose: keep the first file a low-token route map.

Include:

- Authority order among project instructions, standards, direction docs, workflow docs, source docs, and model priors.
- A "load only what you need" table mapping task families to the smallest extra docs.
- Always-on safety boundaries: unrelated changes, git state, destructive actions, credentials, and external side effects.
- Local shell or command quoting rules only when the project has a real recurring trap.
- Pointers to profile, goal, evidence, and workflow assets.

Do not include:

- Full code conventions.
- Full domain glossary.
- Current sprint status, failing tests, handoff notes, or live blockers.
- Long tool runbooks.

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

Purpose: store reusable run assets outside startup docs and outside product/domain docs.

Common assets:

- `README.md`: asset map and workflow selection rules.
- `standards/`: code conventions and detailed references.
- `goals/`: human-readable goal contract.
- `templates/`: reusable loop, plan, or report templates.
- `evidence/`: evidence schema, case lifecycle, merge rules, verifier contract, and redaction rules.
- `domains/`: optional domain packs with context, scenarios, invariants, queries, API probes, or other verifier inputs.
- `scripts/`: deterministic helpers for repeated checks.

Workflow assets should describe objectives, context, verification, stop conditions, and evidence. Keep tool-specific commands in small isolated sections.

## Bootstrap Tree

Use existing project names when present. If the project has no convention, this default tree is enough:

```text
AGENTS.md
VISION.md
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
docs/
  agents/
    repo-profile.md
```

Minimum viable content:

- `AGENTS.md`: authority order, load map, boundaries, and pointers.
- `VISION.md`: purpose, system boundary, hard gates, report-only invariants, rejected invariants, and maintenance rule.
- `agent-workflows/README.md`: asset map, tool-neutral rule, required loop shape, and when not to run unattended loops.
- `goals/goal.md`: outcome, scope, required context, runtime preconditions, success evidence, constraints, loop budget, stop conditions, and closeout.
- `evidence/README.md`: case shape, required evidence, runtime gates, verifier results, and redaction policy.
- `docs/agents/repo-profile.md`: load conditions, project shape, source routing, verification menu, review gate, and local-only facts.

## Goal And Evidence Contracts

A goal contract is worth creating only when the work has a measurable endpoint, may need more than one implementation/verification round, and has evidence that can prove progress.

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
- Domain packs plug into the shared evidence framework instead of creating a parallel loop runtime.
- Project-specific examples stay in project docs, not in portable skills.
- Tool-specific instructions are isolated and do not make the shared workflow dependent on one runtime.
- Generated documents follow the requested output language while preserving literal technical tokens.

## Non-Trigger Examples

Do not use this skill when:

- The user wants to implement a feature.
- The user wants an E2E test plan or execution report.
- The user wants API documentation for an interface.
- The task is a one-off investigation whose notes do not define reusable project operating structure.
- The user asks to edit product requirements, design docs, or business glossary without changing agent workflow routing.

## Generalization Samples

Sample A: a backend service already has a root agent instruction file, a direction anchor, and a workflow directory with goal and evidence templates. The bootstrap task is to audit routing, remove duplicated rules, and keep feature-specific verifier details in domain packs.

Sample B: a frontend product has a compact root instruction file, a product vision doc, a repo profile under `docs/agents/`, and UI regression run reports under `docs/test-runs/`. The bootstrap task is to add a workflow asset index and a goal/evidence contract without importing UI feature names into the shared startup route.
