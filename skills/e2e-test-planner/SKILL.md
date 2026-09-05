---
name: e2e-test-planner
description: >
  Create source-backed E2E, integration, acceptance, or regression test plans as business scenario trees from requirements, designs, decisions, or code changes. Use for planning scenarios and coverage; executing an existing plan, report, or concrete scenario belongs to e2e-test-executor.
---

# E2E Test Planner

Produce an executable business scenario tree with justified expectations and visible
coverage gaps. Scale the supporting analysis to the behavior: a short flow and
coverage note can support a small plan; interactions and shared changes need models.
Use the user's language, preserving identifiers, commands, and quoted evidence.

## 1. Establish the outcome and evidence

Name the actor, legitimate entry, completed business outcome, requested test boundary,
and exclusions. Separate **expected-result authority** (approved requirements,
decisions, policies, external contracts, or explicit user direction) from
**implementation evidence** (code, configuration, schemas, tests, and logs).

Pin intended behavior to its authority and revision. Current code and tests establish
reachability and current behavior; they define correctness only when explicitly
designated as the contract at a particular revision. With no established authority,
retain useful characterization scenarios and mark the intended result
`NEEDS-DECISION`. Agreement with the implementation does not resolve that decision.

Trace the normal route from entry to completed outcome. Include a producer flow when
it creates a prerequisite the journey must exercise. For a change, follow affected
contracts through shared writers, readers, callers, and subscribers to other business
outcomes. Inspect alternate entries and asynchronous or recovery paths the change
can reach; retain unresolved impact as a gap instead of silently narrowing scope.

## 2. Identify coverage and choose its layer

Account for the requested rules, accepted and rejected input partitions, boundaries,
state transitions, and affected flows. A short list mapping these to scenarios or
gaps is sufficient when the mapping is direct.

Read [Coverage Models](REFERENCE.md#coverage-models) when conditions interact,
rules overlap, retries or concurrency introduce alternative transitions, a shared
change affects multiple flows, or the user requests a matrix or formal traceability.
Build only the models that explain those obligations. The reference also defines
when an explicit test-requirement ledger is useful; a simple plan needs neither
that ledger nor a table proving that unused models are inapplicable.

Allocate each obligation to the lowest layer that exposes the fault: unit for local
calculations and validation; integration for component contracts, persistence, and
adapters; E2E for the requested journeys and system-level propagation. Preserve the
user's requested boundary. Local permutations may share an E2E representative only
with source-backed equivalence at that boundary and a stated residual risk.

An existing lower-layer test counts as mapped coverage only after inspecting its
inputs and assertions. Missing tests remain explicit follow-ups. A coverage mapping
is a plan fact, never an executed-pass claim, and never authorization to write tests.

## 3. Write the scenario tree

Keep each scenario's definition under its business branch. Put the shortest complete
Primary Happy Path first, then attach variants at the step where they diverge. Include
affected-flow regressions and source-backed failure or recovery branches. When the
contract is negative-only, put its canonical verification path first and explain why
there is no positive Happy Path.

Declare `Execution handoff: execution-anchors/v1` in the overview; localize the label,
preserve the token. Each stable scenario ID has a purpose and these effective facts:

| Fact | Required content |
|---|---|
| Preconditions | Concrete starting state and inputs, or deterministic construction/selection rules; predecessor scenario IDs only where genuinely required. |
| Actions | Ordered business actions through a source-backed entry or adapter, naming the stable operation and its inputs. |
| Observes | Final contractual observation and completion predicate. Record an approved product time threshold, or `business threshold: none specified`. |
| State Footprint | Resources read, written, and external effects; `none` for an empty class. Every writable/external target names provenance or ownership and allowed lifecycle: `retain`, `restore`, or `delete`. |
| Expected Results | Concrete values, errors, or invariants that distinguish correct from incorrect behavior. |
| Oracle / Expected Authority | `specified` for approved expected values, or `derived` for an independent reference/relation; name the governing source, revision, and calculation. |
| Implementation Evidence | Locators supporting the entry, state, observation, and footprint; these establish mechanics, not business correctness. |

The first four facts are the execution anchors. Resolve business facts here; the
executor resolves live targets, credentials, commands, safety wait bounds, owner
markers, and cleanup implementations. Keep a known project command when it is the
stable entry interface. Missing business decisions stay `NEEDS-DECISION`; missing
source anchors stay `BLOCKED`. Either can be planned, but neither is execution-ready.

A synchronous query or calculation can finish in its complete response. Establish a
read-only footprint from the adapter and inspected call path; that alone creates no
extra runtime zero-write obligation. Mutations and asynchronous work require their
contractual state, event, or external effect; acceptance alone is insufficient. A
rejection promising unchanged state also needs that invariant observed. Add a
non-mutation probe to a read-only path only when requested or a reachable write risk
requires it. Execution-safety timeouts are not business failure thresholds.

Co-locate shared facts on the nearest parent. An omitted child field inherits the
complete parent value; a child replacement restates the whole effective field.
This atomic rule also governs execution and HTML projection. Add priority, step IDs,
and `Requirements` links when they aid selection or traceability; their absence does
not invalidate an otherwise complete handoff.

## 4. Close and deliver

Use an overview, the scenario tree, and coverage/gaps as the default shape. Place
sources beside the facts they support; add flow diagrams and model tables where
they explain a decision. Do not reproduce the tree as a second scenario inventory.

Check that every in-scope obligation has a scenario, an inspected lower-layer
assertion, or an explicit gap; all referenced IDs resolve; inherited anchors and
expected values are coherent. When using a ledger, reconcile both mapping directions.
End with the smallest useful first slice: the Happy Path and highest-risk required
branches, identified by scenario ID.

Use `NEEDS-DECISION` for unresolved authority, `BLOCKED` for unavailable execution
evidence or capability, and `OUT-OF-SCOPE` for a stated exclusion. `ASSUMED` requires
an explicitly accepted temporary premise and the accepting owner. Keep unresolved
items and missing lower-layer tests visible without inflating the E2E tree.

Save Markdown under `docs/e2e-test/{feature}/{date}-{feature}-e2e-test-plan.md` unless
the user specifies a path. Unless Markdown-only is requested, read the
[Reader View Contract](REFERENCE.md#reader-view-contract) and create a desktop HTML
companion. Link the HTML and canonical Markdown when available. Planning ends with
the plan; execute tests or implement test code only when the task authorizes it.
