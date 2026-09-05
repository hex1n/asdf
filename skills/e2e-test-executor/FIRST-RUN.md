# Additional intake cases

Read only for an inherited/legacy plan shape or a conversational handoff. Selection,
expected authority, source pinning, and run-directory rules live in `SKILL.md`.

## Scenario-tree inheritance

For `execution-anchors/v1`, resolve shared fields from root to leaf: an omitted child
field inherits the nearest complete parent value; a defined child field replaces the
whole value. Partial append/delete inside an inherited field is invalid. Preserve
all four anchors and the approved verdict facts. Priority, business-step IDs,
requirement links, layer-allocation tables, and a formal ledger are optional unless
an existing consumer explicitly requires them. Missing such annotations alone is
not a plan defect.

Derive live mechanics from the effective facts: trigger from Actions, probe and wait
from Observes, inputs/dependencies from Preconditions, and ownership/lifecycle from
State Footprint. Mark derived mechanics in the report; a separate `plan-snapshot.md`
is useful only when their volume or reuse warrants it. Missing or contradictory
marked anchors remain plan gaps instead of being silently repaired from current code.

## Older plans

For a tree without the handoff marker, preserve existing scenario definitions,
Agent Execution Contracts, DAG/safety edges, gates, defaults, and slices. Derive only
absent anchors/mechanics, mark them `legacy-derived`, and keep existing scheduling
and safety facts even when they are not produced-value dependencies.

For `Contract: e2e-plan/v2`, read Scenario Contracts, Gates (`GT-*`), Gaps (`G-*`),
Coverage Obligations, and Flow and Impact Edges as its canonical records. Resolve
order from Depends on, Consumes, Produces, Slice, and Priority. This format has no
separate Execution DAG/Order or handoff index; conflicting duplicates require
reconciliation rather than ignoring either safety constraint.

## Conversational handoff

Materialize the concrete scenario contract, source instruction, and selected IDs in
the report before execution. Keep a snapshot only when the original source would
otherwise be lost. Source-backed intermediate steps and locators are mechanics;
invented business inputs or expectations are not.

If the user actually needs scenario design, complete that planning first, using
`e2e-test-planner` when available, then resume execution from its artifact. An already
concrete scenario does not require creating a separate full planning document.
