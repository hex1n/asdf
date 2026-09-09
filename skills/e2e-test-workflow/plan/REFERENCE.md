# Planning reference

Read the section selected by the task. The ordinary planning and handoff rules live
in `PLAN.md`; this file supplies expanded coverage analysis.

## Coverage Models

Use explicit models when interactions make omissions hard to see in a short tree.
Choose the applicable rows below and state the reason for the added analysis. Leave
unused models absent; unknown behavior remains a named gap, not proof of absence.

| Model | Build for | Record |
|---|---|---|
| State graph | Alternative transitions, async work, recovery, concurrency, or affected flows sharing state. | Entry, transitions and their conditions, produced/consumed state, completion observations, and source-backed dependency edges. A short ordered flow suffices for a linear path. |
| Input space | Several characteristics or partitions whose interactions can change outcomes or must preserve an invariant. | Characteristic, affected observable, feasible accepted/rejected blocks, boundaries and interior values, and constraints. |
| Decision logic | Overlapping rules, independent conditions, error precedence, or competing outcomes. | Rule/error, conditions, expected outcome, and judgment order. Each independent condition of an OR rule needs its own obligation. |

Each row distinguishes the expected authority from implementation evidence. Cite
shared sources once and link rows to them. Model business outcomes rather than
internal call stacks. A changed contract may span files, and a shared file may
affect several contracts; direct-flow coverage does not close neighboring flows.

Trace a shared change as:

`changed contract/state/data → writers/readers/callers/subscribers → affected flow → outcome`

Include relevant modes and alternate entry, scheduled, callback, retry, recovery,
administrative, reporting, and compatibility paths. Make unresolved reachability or
scope explicit. Concurrent flows belong at the shared transition; recovery belongs
at the failure it repairs. Independent outcomes may use separate tree roots.

Partition relative to the observable: an input can preserve one field and change
another. Different views of one characteristic are not separate variables to
cross-combine. Distinct account classes, business modes, or settlement timings need
distinct blocks when their contractual outcomes differ.

### Coverage criteria

Choose a criterion for each built model and state any weakening with its residual
risk. Start with these defaults:

| Model | Default obligations |
|---|---|
| State graph | Every trunk edge and affected flow; the Happy Path exercises the producer flow for prerequisites it creates. Include identified ordering, recovery, and consistency risks. |
| Input space | Base-Choice: a feasible accepted base tuple, then each accepted non-base block with other characteristics held at compatible base values. Cover rejected blocks separately. For source-backed interactions, use All-Combinations for up to three coupled characteristics, Pairwise for larger interaction sets. |
| Decision logic | Each rule, error code, and independently firing condition, plus precedence where rules overlap. |

Expand the selected criterion into actual obligations: Base-Choice tuples, feasible
pairs for Pairwise, complete feasible tuples for All-Combinations, or rule/transition
assertions. Mark infeasible combinations with their constraint. A negative assertion
cannot close an accepted outcome. Merge obligations one test can satisfy, preserving
which ones it proves and the independent expected result.

### Test-requirement ledger

Use a ledger when a selected criterion generates combinations or many-to-many
mappings that are hard to inspect in the tree, or when the user/consumer requires
formal traceability. A small model with direct mappings can use annotated scenarios
and coverage notes. Recording more tables is not itself stronger coverage.

| Requirement | Model / criterion | Obligation and observable | Layer | Coverage reference | Disposition |
|---|---|---|---|---|---|
| TR-001 | ... | ... | unit / integration / e2e | Scenario ID, inspected test assertion, or follow-up | covered / planned / infeasible / NEEDS-DECISION / BLOCKED / OUT-OF-SCOPE |

`covered` means mapped to a defined scenario or an inspected lower-layer assertion,
not executed. `planned` identifies a missing or uninspected lower-layer test, its
needed assertion, and next step. Keep it in gaps. Framework names and file paths
alone do not prove coverage. Preserve the requested boundary and distinct system
risks when allocating local permutations to lower layers.

Every covered ledger row resolves to a scenario that cites it or an inspected test
that asserts it; every scenario requirement link resolves back to its row. Keep IDs
stable when revising a referenced plan; document retired obligations when existing
references need them. Consecutive numbering is unnecessary. Old plans without layer
columns or a ledger remain valid; preserve their established coverage mappings.
