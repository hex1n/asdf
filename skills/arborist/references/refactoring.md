# Refactoring

Use this branch for structural improvement with preserved behavior. It extends
the implementation loop in [Arborist](../SKILL.md). For compatibility or data
migration alone, start at [Choose the transition](#choose-the-transition) and
apply the migration and removal guidance to the requested outcome.

## Define the targets

Establish three things before restructuring:

- **Structural target:** an observable before-to-after change, such as one rule
  owner, fewer caller obligations, a removed dependency cycle, or fewer places
  that must change together. “Cleaner code” needs a concrete interpretation.
- **Preserved behavior:** results, errors, effects, ordering, performance,
  operations, and compatibility that must continue to hold.
- **Removal target:** the obsolete path and temporary structures that should
  disappear, including any external condition that delays their removal.

Establish characterization evidence through the relevant current interface.
Use requirements to resolve intended changes; preserve characterized behavior
only within the agreed contract. Each proposed artifact should serve a target
or a necessary transition.

## Separate movement from meaning

Keep behavior-preserving movement distinguishable from changes to ownership or
caller obligations. Moving or renaming code can be mechanical; changing state
meaning, errors, ordering, effects, compatibility, or required caller knowledge
needs its own expectation and evidence. Moving a decision to a new owner also
needs structural verification even when its observable behavior is conserved.

Prefer separate slices when this makes equivalence easier to establish. When
movement and semantic change cannot be separated, state both obligations and
verify both. Avoid labeling a slice mechanical because it mostly moves lines.

## Choose the transition

Select the simplest shape supported by actual callers, release boundaries,
stored data, effects, and recovery needs:

| Shape | Use when | Exit |
| --- | --- | --- |
| Direct replacement | All affected callers can move atomically | Old path removed; behavior verified at the target interface |
| Parallel change | Callers adopt an interface at different times | Callers migrated; compatibility surface removed |
| Branch by abstraction | An internal replacement must evolve behind a stable interface | Old adapter removed; temporary seam collapsed or justified by continuing variation |
| Strangler | A routed or deployable capability moves by operation or cohort | Intended traffic migrated; old route retired |
| Expand, migrate, contract | Stored or serialized representations span releases | Readers and writers converge; data verified; old representation retired |

For each meaningful stage, establish:

- which callers, versions, and data can coexist;
- which path owns each decision and effect;
- what observation demonstrates that the stage succeeded;
- how to recover if it fails, given the state it may already have written.

Introduce compatibility before a stage relies on it. Check reachable mixed
states, including older readers and writers that may still be active. Expand
before migrating data; contract only after the remaining consumers and recovery
requirements permit it.

Shadow or differential execution is useful only when duplicate effects are
suppressed or isolated. Keep one authoritative result and effect path while
comparing observable behavior.

Record each temporary adapter, flag, route, or duplicate representation with its
purpose, exit condition, accountable person or team role, and removal evidence.
Use actual ownership evidence. If the owner or an external exit is unknown, mark
it unresolved and keep removal pending while continuing reversible preparations.
Use existing task records; no particular ledger format is required.

## Migrate and verify

Keep each intermediate state valid for its reachable consumers:

1. Establish evidence for the current contracts that the stage must preserve.
2. Introduce the target and any compatibility needed for that stage.
3. Move one coherent consumer group or data cohort.
4. Verify behavior, structural obligations, and the stage's recovery mechanism.
5. Repeat until the transition's exit is supported by evidence.
6. Remove the obsolete path and verify through the target interface.

For an atomic direct replacement, collapse these into one verifiable change.
Do not add a compatibility layer solely to manufacture stages.

After migration slices, check for duplicated rules and new consumers of the old
path. Stop advancing the affected migration on an unexplained mismatch. Resolve
it as a defect, an intended change, or a missing authority decision before moving
more consumers; continue work independent of that mismatch.

Recovery must match the actual state. Code rollback works only while code, data,
and already-emitted effects remain compatible. Otherwise establish a tested
forward repair, restore, or compensation path appropriate to the consequence.
Prepare and test recovery in the authorized environment; deployment, destructive
data changes, and live recovery remain subject to the user's authorization.

## Recover the complexity

Check the targets against the final code and evidence:

- Preserved behavior holds through the target interface, including errors and
  effects previously guarded by the old implementation.
- Decisions have the intended owners, dependencies follow the target direction,
  and callers no longer reproduce hidden rules or coordinate internal steps.
- The interface hides the intended complexity; a facade that leaves all caller
  knowledge in place has not achieved that target.
- Searches and runtime or consumer evidence, as appropriate, establish that old
  paths can be retired. Retain compatibility required by unresolved external exits.
- Remove obsolete implementations, expired adapters and flags, generated
  artifacts, and tests tied solely to retired internals. Preserve behavioral
  cases at the target interface and rerun the affected checks after removal.

Explain the structural gain with concrete changes in caller knowledge, decision
ownership, dependencies, or coordinated edit points. A completed migration stage
can still have an open removal target. Report that stage and its remaining exit
condition instead of claiming the final refactor is complete.
