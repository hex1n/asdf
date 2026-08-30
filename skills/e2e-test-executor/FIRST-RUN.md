# First-run intake

Read this file only for the first execution of a plan, named scenario, or conversational handoff. A continuation from an earlier execution report uses [RERUN.md](RERUN.md) instead.

## Establish the upstream artifact

Create this run's immutable directory before materializing any snapshot: use the user's output path when provided; otherwise create `e2e-run-<plan-name>-<timestamp>/` beside the plan under its `docs/e2e-test/<feature>/` folder, or a stated working path when no plan location exists. Creating it is a write: satisfy [Path Containment Proof](REFERENCE.md#path-containment-proof) before `mkdir`. This intake gate does not wait for `EXECUTION.md`. The new directory is unique to the run and is never reused by a later rerun. Record its full canonical path immediately. Every file written into it before delivery is an entry of the artifact allowlist in [REPORTING.md](REPORTING.md#fill-the-run-directory).

Read the plan before touching the system. A plan whose header declares `Contract: e2e-plan/v2` keeps its facts in canonical records:

- `Scenario Contracts` supplies mechanics, capabilities, waits, side effects, isolation, and cleanup.
- `Gates` (`GT-*`) supplies entry prerequisites, status, and blocking rules.
- `Gaps` (`G-*`) supplies unresolved facts and dispositions.
- `Coverage Obligations` and `Flow and Impact Edges` state what each scenario must close.
- Derive the runtime DAG and order from `Depends on`, `Consumes`, `Produces`, `Slice`, and `Priority`. This contract has no `Execution DAG`, `Execution Order`, or handoff index; never wait for one, and treat a v2 plan that carries one as invalid.

A scenario-tree plan from e2e-test-planner carries business facts rather than mechanics. A plan whose Overview carries the `execution-anchors/v1` handoff token — the `Execution handoff` label may be localized; the token is verbatim in every plan language — supplies four authoritative anchors per effective leaf after parent inheritance: concrete `Preconditions`; entry-anchored `Actions`; settlement-aware `Observes`; and `State Footprint` with reads, writes, external effects, ownership/provenance, and allowed terminal lifecycle. Resolve every inherited field with the planner contract's atomic-field reducer: an omitted child field inherits the nearest ancestor unchanged; a defined child field replaces the complete inherited value and must restate every effective fact; partial merge, append, or delete is invalid. `Covers`, `Requirements`, `Oracle`, `Expected Results`, `Expected Authority`, and `Implementation Evidence` complete the business verdict and evidence chain. A marked leaf missing an anchor, using an undefined fixture or variable, or contradicting itself is a plan defect and is not runnable; preserve its explicit `NEEDS-DECISION` or `BLOCKED` disposition. For a legacy scenario-tree plan without the marker, preserve every existing scenario definition, Agent Execution Contract, DAG or safety edge, handoff index, declared default scenario set, and named slice. Derive only absent anchors and mechanics, record their lineage as `legacy-derived`, and never replace an existing safety or scheduling fact merely because it is not a produced-value dependency.

Deriving mechanics is executor work, not a plan defect. For every selected leaf, use code, docs, config, scripts, existing tests, and safe read-only probes to derive:

- the live target and exact trigger command or action from the `Actions` entry anchor;
- the wait and committed-state probe from the `Observes` settlement predicate;
- the oracle from `Oracle` and `Expected Results`;
- dependencies and consumed/produced variables from concrete `Preconditions`, including named predecessor leaf or gate IDs, and produced values;
- side-effect class, isolation key, run-specific owner marker, and cleanup operation from `State Footprint`, constrained by its ownership/provenance and allowed terminal lifecycle;
- entry gates from environment notes and available capabilities.

Record derived mechanics per leaf in `plan-snapshot.md` inside the run directory with lineage `derived`, while `Upstream plan` still names the original. The anchors constrain derivation; implementation evidence cannot silently replace their business values, settlement predicate, ownership, or lifecycle authorization. Block a mutating leaf whose effective footprint lacks target provenance/ownership or an allowed terminal lifecycle. A command, credential, live target, or probe unresolved against the environment makes that leaf `blocked` with the next safe probe named, not a plan defect. Ask the user only for facts the available sources cannot yield.

When the plan exists only in conversation, materialize it before execution. If scenario design is the actual task — including a bare request to run E2E tests with no flow, change, fix, or scenario to derive — hand off once to e2e-test-planner and resume from its artifact. Otherwise write only the implied scenario set to `plan-snapshot.md`, mark lineage `ad-hoc`, and use that readable path as `Upstream plan`. Resolving locators, credentials, and necessary intermediate steps from sources is derivation, not invention.

## Select the run

Re-read the user's latest constraints. Record an `Execution Contract Override` when the user changes excluded scenarios, data retention, tool restrictions, or exit criteria after the plan was written. The override supersedes the matching plan default; mark the old requirement `superseded`, never failed. Open [Execution Contract Override](REFERENCE.md#execution-contract-override) only when an override exists.

The selection set is, in order:

1. scenarios the user explicitly named;
2. otherwise the plan's First Test Slice, marked or not;
3. otherwise a legacy plan's explicitly declared default scenario set or named default slice;
4. otherwise every ready scenario in priority order P0 through P2.

A First Test Slice always outranks a separately declared default scenario set. When a plan carries both and they differ, take the slice and record the ignored default set as an explicit selection note.

Write the selection set down before execution. Map every selected scenario to plan IDs, edge IDs, expected variables, required capabilities, waits, cleanup, and blockers. Record missing or conflicting facts before triggering anything. `Upstream plan` must resolve to a readable path, using the materialized snapshot when the source was conversational.

Pin the upstream artifact by **content hash**, not path alone, and record that hash in `plan-snapshot.md` at intake. A path names a file; a run consumes a revision. The report copies the plan's expected values, so an upstream edit after the run silently desynchronizes those copies, and a hash reconstructed afterwards is a guess. Where the plan carries no version history — an untracked or gitignored directory — the hash is the only anchor available. On delivery, re-hash the upstream artifact: an unchanged hash certifies the copied expectations; a changed one means the report states which revision it ran against and reconciles or explicitly retains each copied field.

Scenario selection changes which scenario nodes execute; it does not waive shared entry gates, preconditions, safety checks, or their evidence. Supersede a shared gate only when the user explicitly changes that gate, not merely because the user selected one scenario.

## Intake completion gate

Do not proceed until:

- the selection set and rationale are explicit;
- the upstream plan or snapshot is readable, and its content hash is recorded;
- each selected scenario has a trigger, wait, committed-state probe, oracle, dependencies, side effects, isolation key, and cleanup decision, or an exact blocker;
- current user overrides are recorded;
- the report language and target environment are fixed.

Then read [EXECUTION.md](EXECUTION.md).
