# Refactor Track

Read this branch only when structural improvement with conserved behavior is
an approved outcome. It specializes the promoted workflow in `SKILL.md`; a
proven L0 equivalent edit still ends in Step 0.

## 1. Freeze the Refactor Contract

Define three things before production edits:

- **Structural Target** — a falsifiable before → after property, such as one
  decision owner, a smaller Interface, an inward dependency, a removed cycle,
  or an obsolete path reaching zero consumers. “Cleaner” is not a target.
- **Behavior Envelope** — the results, errors, side effects, ordering,
  performance, operations, and compatibility that remain conserved.
- **Removal Target** — the old path and temporary structure that should cease
  to exist, including any external condition that delays removal.

Establish characterization evidence through the current Interface for the
approved Behavior Envelope. Current behavior outside that envelope remains
implementation evidence; a disputed behavior needs expected authority or
`NEEDS-DECISION` before it can be preserved or changed intentionally.

Completion: every proposed artifact maps to the Structural Target, Behavior
Envelope, or an explicitly temporary transition need.

## 2. Separate Movement from Meaning

Classify every implementation slice:

- **Mechanical** — move, rename, extract, delegate, or replace representation
  while preserving caller knowledge and observable behavior.
- **Semantic** — change ownership, Interface knowledge, state meaning, errors,
  ordering, side effects, performance, or compatibility.

Keep the two kinds in separate slices and evidence. A Mechanical slice stays
green against characterization evidence. A Semantic slice needs an approved
Intended Change and its own independent proof. If they cannot be separated,
state the mixed obligation explicitly instead of calling the slice mechanical.

Completion: a reviewer can tell which diff proves equivalence and which diff
intentionally changes meaning.

## 3. Choose One Transition Shape

Select the smallest shape justified by caller reachability, release boundaries,
stored data, side effects, and rollback needs:

| Shape | Use when | Required exit |
| --- | --- | --- |
| Direct Replace | Callers are bounded and can move atomically | Old path removed; superseded implementation tests replaced at the target Interface |
| Parallel Change | An Interface has callers that migrate at different times | All callers observed on the new Interface; compatibility surface removed |
| Branch by Abstraction | A long internal replacement must sit behind one stable Interface | Old Adapter removed and temporary Seam collapsed or justified as real variation |
| Strangler | A deployable or externally routed capability moves by cohort or operation | Old route receives no authorized traffic and is removed |
| Expand / Migrate / Contract | Stored data, schema, or serialized fields cross release boundaries | Readers and writers converge; old representation and compatibility logic removed |

Dual-run or shadow comparison is proof, not a second source of truth. Use it
only when effects can be isolated or suppressed; compare observable results and
route decisions through one authoritative path.

Track every temporary artifact:

| Artifact | Owner | Purpose | Exit signal | Removal proof | Status |
| --- | --- | --- | --- | --- | --- |

Preserve all six fields. `Owner` is an accountable human or team role with
authority to confirm the exit signal and approve removal, not an invented
person. A system boundary, external consumer, repository label, or metric is
evidence, not an Owner. If available evidence cannot identify the role, record
`NEEDS-DECISION` in both Owner and Status; do not omit the field or present the
transition as ready for removal.

`Status` is exactly `open`, `NEEDS-DECISION`, or `removed`; values such as
`complete`, `closed`, or `ready` are invalid. Use `open` while an identified
Owner is working toward the exit, and `NEEDS-DECISION` while ownership or an
authority decision is missing. `removed` requires Owner confirmation, actual
removal, and execution of the Removal proof. Keep every row in the final ledger
so the decision and evidence remain visible.

Completion: each temporary Adapter, flag, route, duplicate representation, or
compatibility Interface has a named exit; no transition mechanism is permanent
by accident.

## 4. Migrate in Reversible Slices

Keep every intermediate state buildable, behaviorally valid, and reversible:

1. establish the Behavior Envelope at the current Interface;
2. introduce the target Module or Interface without moving caller behavior;
3. migrate one coherent consumer group;
4. prove behavior, dependency direction, and rollback for that group;
5. repeat until the selected transition's exit signal is true;
6. remove the old path and rerun the full envelope.

After each slice, search for duplicate rules and new callers of the old path.
Stop migration on an unexplained mismatch; classify it as an authority conflict,
an implementation defect, or an intended semantic change before continuing.

Completion: no intermediate state requires two authoritative implementations
of one rule, and each migrated group has an observed rollback point.

## 5. Recover the Complexity

A safe migration is not yet a completed refactor. Close the Structural and
Removal Targets with evidence:

- the Behavior Envelope passes through the target Interface;
- dependency and cycle checks enforce the intended direction;
- the Interface is no wider than the target requires;
- rule and reference searches find one owner and no removable old consumer;
- superseded tests are deleted or replaced by tests at the target Interface;
- expired Adapters, flags, dual paths, compatibility code, and generated
  artifacts are deleted;
- the deletion test and locality check show fewer Modules, facts, and edit
  points must be understood together.

When an external exit condition is still open, report the achieved migration
stage rather than calling the final refactor complete. Preserve only the
temporary artifacts whose ledger rows are `open` or `NEEDS-DECISION`.

## Refactor Handoff

Report the Structural Target and Behavior Envelope, the chosen transition and
current stage, mechanical versus semantic slices, deleted artifacts, the full
Transition Ledger with all six fields, exact verification, rollback evidence,
and whether complexity recovery is complete.
