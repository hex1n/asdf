# Intake of an existing artifact

Read the section the run needs: inherited scenario fields, a legacy plan shape, or a
continuation of a prior run. Selection, expected authority, source pinning, and
run-directory rules live in `RUN.md`.

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

## Continue a prior run

Read the previous report and the original plan before acting. Create a fresh
continuation directory under `RUN.md`'s path rules; never rewrite historical
reports, evidence, or helpers. Back-link both sources and pin the current consumed
source revision. Carry forward applicable user overrides and retained-state facts.

### Choose and validate the continuation

Honor the user's explicit scenario selection. Otherwise select previous `failed`,
`blocked`, and `unverified` scenarios plus dependents that consumed the fixed behavior.
Explain any affected dependents excluded by the requested scope; do not silently
claim their regressions were checked. Expand to the entire plan only when impact or
the user requires it. A subset never waives shared prerequisites or safety gates.

Re-derive only mechanics invalidated by changed code, environment, or evidence. Keep
unchanged business expectations pinned to their approved authority, recording any
approved expectation changes separately. Resolve never-executed dependents under
[Older plans](#older-plans); preserve existing safety edges and legacy facts.

Prove the fix is loaded in the actual command/process before judging it. Use the
expected version, loaded source/build identity, or a discriminating behavioral
fingerprint; reachability alone does not prove freshness. Reuse prior metadata only
when it still describes the effective target.

Read retained identifiers, ownership, TTL, cleanup commands, and do-not-clean items
before creating or reusing fixtures. Read [EXECUTION.md](EXECUTION.md) for any writes,
async/dependent work, or retained-state cleanup. A previous failure becomes passed
only with this run's fresh outcome and retained proof. Record the new disposition
and evidence here while preserving the original verdict.

### Authorized repair loops

This stage supplies execution and diagnosis; the calling agent owns separately
authorized product fixes. For an explicit iterate-until-green request, retain each
iteration's report as an immutable handoff. Continue from actionable defects and
affected dependents; stop when no actionable defects remain, an external decision
blocks progress, or the user's cap is reached (default eight full E2E rerun cycles).
Report skipped/unverified/blocked work even when no actionable fix remains.
