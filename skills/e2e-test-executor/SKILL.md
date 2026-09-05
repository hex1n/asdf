---
name: e2e-test-executor
description: >
  Execute or rerun an existing E2E plan, execution report, or concrete scenario in local or test environments, retaining evidence and reproducible results. A bare E2E request with no plan, report, or concrete scenario needs scenario planning first.
---

# E2E Test Executor

Run the selected scenarios, establish their verdicts, and leave enough evidence to
understand and repeat them. Prefer the project's existing harness or adapter. Author
test code only when the user or the supplied plan's execution method authorizes it;
a coverage or automation label is not that authorization. Product fixes and remote
issue creation require their own authorization.

Use the user's requested language, otherwise the plan's language, then the prior
report's, then the user's prompt. Localize headings and prose; preserve IDs, commands,
status tokens, and raw evidence. Delegation-message language does not change the
intended audience.

## 1. Select and pin the run

Read the upstream plan or report and the latest user constraints before touching the
system. For a continuation, read [RERUN.md](RERUN.md). For legacy plan formats,
inherited scenario fields, or conversational handoffs, read [FIRST-RUN.md](FIRST-RUN.md).
A straightforward plan or concrete scenario can proceed from this entrypoint.

Select explicit user-named scenarios first; otherwise the plan's First Test Slice,
then an explicit legacy default slice/set, then all ready scenarios by priority.
Record selected IDs and exclusions before execution. Lower-layer test mappings and
unimplemented follow-ups are coverage context, not extra E2E scenario nodes. Selecting
a subset preserves its shared prerequisites and safety gates.

Resolve each selected scenario's starting inputs/state, legitimate trigger, final
observation/completion predicate, expected result and authority, and resources it
reads or changes. `execution-anchors/v1` plans supply these as Preconditions, Actions,
Observes, and State Footprint plus verdict facts. Missing business authority or a
contradictory marked anchor is a plan gap; missing live commands, credentials, probes,
or fixtures is an execution blocker. Derive mechanics from available sources before
asking for facts; keep unresolved facts explicit.

**Preserve expected-result authority.** Pin approved expectations and completion
predicates to their source/revision. Code changes can refresh stale locators and
commands, never approve their own changed behavior. Change an expectation only from
a new approved authority or explicit user override; record old/new values, source,
and affected scenarios. If code is the designated contract, use its approved revision.
Unknown authority permits characterization, not a business-correctness pass.

Pin the upstream artifact by content hash and retain the consumed expectations in
this run. For an ad-hoc scenario, record its source instruction and concrete contract.
Create one fresh run directory under the user's output path, or beside the plan as
`e2e-run-<plan-name>-<timestamp>/`. Resolve the existing parent inside the authorized
output/workspace boundary before creation; reject traversal or symlink escape and
verify the resulting child. Keep historical runs immutable. Record these facts in
`execution-report.md` as work proceeds; a separate snapshot is needed only to preserve
otherwise unavailable source facts or complex derived mechanics for a consumer.

## 2. Resolve the execution context

Confirm a local or test target from effective configuration and actual connectivity,
not a profile name. Restricted staging or production requires explicit instructions
for that environment before proceeding. Record the actual entry/harness, relevant
runtime identity, and proof that the tested process/artifact is the intended build.
A reachable endpoint alone is insufficient; a local command can use the source bytes
it actually loads, while a service needs deployed-version or discriminating evidence.

Name reached dependencies as real or declared doubles and make their effect on the
verdict visible. A short context note suffices for a simple command. Only inspect
capabilities and environment fields the selected scenarios use.

Read the applicable sections of [EXECUTION.md](EXECUTION.md) before business writes,
asynchronous work, inter-scenario dependencies, retained-state cleanup, or environment
repair beyond an already-ready harness. Those branches add ownership, setup, waits,
and scheduling detail. Default to serial; independent read-only scenarios need no
DAG table, ownership ledger, seed script, or cleanup script.

## 3. Execute, observe, and classify

Judge the completed contractual outcome. A synchronous query/calculation can finish
in its full response. Compare it with an independently computed approved expectation;
the response cannot supply its own expected value. For persistent writes, read the
required committed state before cleanup; for async effects, observe the completion
predicate. Acceptance alone cannot prove those outcomes. A rejection promising
unchanged state also requires that invariant checked. A path established as read-only
needs no invented datastore or zero-write probe unless requested or a write risk exists.

For each executed scenario retain, together:

- exact trigger/probe commands or adapter invocations and concrete inputs;
- raw output, inline or in a linked attachment, with relevant entity/correlation IDs;
- expected versus actual, the governing authority or independent derivation, and the
  observed assertion result. Persistent-state proof includes the pre-cleanup read and
  output; response-only proof includes the independent calculation/reference context.

Capture volatile failure scenes immediately, before retries or cleanup can destroy
them. Include the state, events, logs, and configuration needed to reproduce the
observed mismatch; redact secrets while preserving usable reproduction identifiers.
A batch command/output may serve several scenarios when each assertion points to its
own slice. A child exit code alone is not proof of all its scenario outcomes.

| Status | Meaning |
|---|---|
| `passed` | The established expected outcome and required evidence are satisfied. |
| `failed` | Valid observation proves a violation of an established expectation. |
| `blocked` | A required starting condition, capability, authority, or completion observation prevents a verdict; say whether a trigger occurred. |
| `skipped` | Deliberately excluded from this selected run, with a reason. |
| `unverified` | Execution occurred but retained evidence or a valid oracle is insufficient. Never use for an unexecuted case. |

Name the oracle `specified` (approved expected value), `derived` (independent
reference, invariant, differential, or metamorphic calculation), or `implicit`
(only no-crash/no-error). An implicit or circular oracle is at most `unverified`.
Classify deficits as `product`, `plan`, `environment`, `tooling`, or `unknown` and
retain their actionable cause once. A process failure or inaccessible dependency is
not automatically a product defect. Retry an intermittent result at most once for
diagnosis, preserving both outcomes; later success never erases the first failure.

## 4. Deliver the result

Read [REPORTING.md](REPORTING.md) when assembling the report and before cleanup.
The default is one Markdown report and one desktop HTML view, with context, scenario
results/evidence, and continuation or cleanup facts. Additional sections and files
need an actual state-management, evidence-size, or handoff purpose.

Completion means every selected ID has an honest terminal status and proof or an
explicit deficit; any retained data has an allowed lifecycle; evidence, current
source/build identity, and rerun instructions agree. Link the report, summarize all
nonzero status counts, and state what remains blocked or retained.
