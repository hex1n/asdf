---
name: arborist
description: >
  Use for 实施 / 实现 / 修复 / 改进 / 重构 / 迁移 / 落地 work on code that already
  has callers, stored data, or tests to keep working: extraction, consolidation,
  or ownership moves of a rule, constant, or value domain (magic values,
  divergent copies of one rule); schema, API, protocol, or data migrations;
  removing, merging, or relaxing a validation or guard; edits that reach more
  than one module or a published interface; landing a design document or
  adjudicated plan — even when the user only says 改一下. Delivers the change
  with evidence that affected contracts hold.
---

# Arborist

Deliver the requested behavior and structural improvement with evidence that
affected contracts hold.

Resolve the uncertainty most likely to make the next change wrong, implement a
coherent slice, and inspect the result. Keep local work lightweight. Add records,
design comparison, and review when they resolve a concrete decision or risk.
Use the user's language for explanations; preserve code identifiers and commands.

When task artifacts need a scratch directory, use `.scratch/YYYYMMDD-task-name/`,
with the task start date in the user's timezone and a short lowercase hyphenated
task name. Reuse that directory when resuming the task; honor a user-specified
output path.

## Establish the contract

Before editing, identify:

- the observable outcome the user wants;
- affected behavior that must remain true;
- the relevant business objects, relationships and rule owners, including requested structural improvements;
- evidence that distinguishes success from a plausible wrong result.

Separate requirements from characterization of existing behavior. Agreement
between code and tests does not settle a disputed requirement. Existing behavior
can be an oracle for preservation; a bug fix needs an expectation independent of
the defect. When an exact answer is unavailable, use a justified invariant,
comparison, replay, or relationship between inputs and outputs.

Account for guards, errors, and effects that will be added, removed, narrowed,
merged, or relocated. Establish each obligation and its owner before the edit.
Use source-established invariants; an added defense needs a reachable failure
that the owning boundary does not already exclude.
Investigate technical unknowns directly. Ask only for missing user-owned intent
or authority decisions, and continue work that does not depend on the answer.

Before each meaningful slice, verify the unconfirmed assumptions that could
make that slice wrong: dependency results, entry guards, or available tool
capabilities. Defer unrelated investigation until a later decision needs it;
keep unresolved load-bearing assumptions visible.

## Trace the affected behavior

Follow real entry points through decisions, state changes, and effects to the
observable result. For shared data, trace both producers and consumers. Inspect
runtime wiring, alternate entry points, historical data, and compatibility where
they can carry the change. Include schemas, generated consumers, documentation,
and examples that encode an affected contract.

Distinguish source-level reachability from the path actually taken for the
relevant inputs and state. When this uncertainty could change the next
implementation decision, use a focused test or run to observe the relevant
branches, state changes, or effects before relying on the causal claim.

Expand until evidence bounds how the change propagates. Record unresolved
paths and causal assumptions, and limit coverage claims to what was actually
checked. When several flows or release stages are involved, keep a compact
impact record connecting them to their contracts and evidence. A local
change usually needs only a brief account.

## Improve code and architecture

Give the requested change a coherent home in the code. When refactoring or
architecture improvement is requested, structural gains are part of the
deliverable. Identify the actual source of complexity: duplicated decisions,
coordinated edits, implicit state, mixed responsibilities, unnecessary indirection,
or misleading domain concepts.

Shape the implementation around the business concepts, rules and relationships
that explain the requested behavior. Choose a representation suited to the
problem: a flow can expose meaningful order, a state model can express lifecycle
constraints, and a relation can express scope or membership. Use the existing
representation when it already makes the relevant meaning clear.

Develop this understanding and the code together. Where a design choice is
unclear, refine a business-level sketch or a thin implementation until the
responsibilities and dependencies can be explained. Adapt reused mechanisms to
confirmed intent; revise assumptions when implementation supplies contrary
evidence. Keep logical dependencies distinct from physical execution, choosing
call boundaries, materialization and scheduling for ownership, validity and cost.
One expression or query may preserve the relevant business relationships.

For repeated data access, derive acquisition and reuse from what keys determine
a result, which consumers share it, and what can invalidate it. Batch or reuse
within that validity scope; repeat a read or check when a relevant change can
alter the next decision. Preserve required observation points and distinguish
what an observation proves from what the effect boundary must enforce.

Use these criteria to shape the implementation:

- **One rule owner.** Each business decision has one authoritative home. Callers
  use its result without reproducing its conditions or reconstructing the
  decision from raw data.
- **Deep modules.** A module hides substantial coherent complexity behind a
  small interface. Group decisions that must change together; hide representation
  and policy choices from callers. Processing order alone does not determine
  module boundaries. Expose required errors, ordering, state, configuration,
  and performance obligations.
- **Clear dependencies.** Dependencies lead toward the owner of a decision.
  Adapters translate external representations and effects at that boundary.
- **Justified seams.** A seam is a replaceable boundary. Add one for demonstrated
  variation, isolation, or a migration need; collapse it when that need expires.
- **State ownership.** Distinguish authoritative facts from derived results and
  execution bookkeeping. Retained state has an owner, a required lifetime, and
  a reason to store rather than recompute it.

Judge a design by how much callers must understand, how many places a rule change
touches, and whether behavior can be tested through the relevant interface.
Line, class, and layer counts are supporting observations. For an unsettled,
material design choice, compare credible alternatives, including deletion or a
direct implementation, against the actual change pressure.

For requested structural work, or structural migration needed by the authorized
implementation, read [Refactoring](references/REFACTORING.md) before choosing the
transition. For compatibility or data migration without a structural redesign,
read its [transition section](references/REFACTORING.md#choose-the-transition).

## Implement coherent slices

Choose a slice with an observable result that can be verified. Distinguish
behavior-preserving movement from intentional changes to semantics. Keep
intermediate states valid for the callers and data that can encounter them.

Read the changed code as an explanation of the requested behavior. Check that
its governing rules and relationships are visible where they are owned. For a
required scope or prerequisite, locate how it is established and what consumes
or relies on it. Reshape meaning carried only by names or comments. Where work
repeats, follow helpers and loops on effectful and no-effect paths; relate keys,
sharing scope, validity and execution counts to input growth. Preparation or
preview alone cannot establish the effectful path's structure or cost.

Run focused verification and inspect the diff after each meaningful slice.
If a new affected path or contract appears, update the scope and design before
relying on earlier evidence. Move behavioral cases with the behavior. Retire
assertions about old internals only after equivalent behavioral coverage exists
at the relevant interface.

## Select verification by risk

Verify at the smallest surface that observes the property. Choose evidence for
the affected behavior; the following are options, not a universal checklist:

| Property | Useful evidence |
| --- | --- |
| New or corrected behavior | Requirement-based examples and failure cases; the original reproduction when feasible |
| Preserved behavior | Focused regressions, characterization, differential checks, or replay |
| Integration and effects | Real wiring, committed state, observable effects, and relevant recovery paths |
| Compatibility | Old and new callers, payloads, and stored data, including reachable mixed states |
| Retry and idempotency | Repeated execution and failures around effects; observe duplicates or omissions |
| Concurrency | Controlled interleavings that can expose the suspected race |
| Performance | The slice's operation counts and retained state at representative scale, plus measured workloads and required thresholds |
| Operations | Actionable diagnostics and demonstrated recovery at the affected boundary |
| Structure | Business rules and relationships recognizable in executable structure; rule ownership, state lifetime, caller knowledge and obsolete path removal |

Discover the repository's actual commands and test entry points. Confirm the
relevant tests execute and observe the claimed result. For new or changed tests,
derive expected behavior from the contract rather than the proposed patch.
When claiming reproduction, confirm the target defect on the before-state when
feasible and its absence after the fix. A check passing both versions can
protect behavior but does not establish reproduction. Keep the limits of
intermittent or unavailable reproduction explicit.

Add or strengthen tests where a missing case matters; routine reversible edits
do not need new tests that merely repeat the implementation.

Use targeted mutation or fault injection when confidence depends on whether
checks detect a plausible critical mistake, especially after guards are
narrowed, consolidated, or moved. Before selecting a fault, writing a mutation
script, or applying a fault by hand, read
[targeted mutation and fault injection](references/VERIFICATION.md#targeted-mutation-and-fault-injection)
for the selection, passing-baseline, isolation, and differential-verdict rules.

Obtain one independent review before reporting completion when the task or
repository rules require it, or when the change touches concurrency or
authorization semantics, data spanning versions or effects that are difficult
to recover, or deletes or consolidates a shared guard; otherwise report the
change as self-reviewed.

The review protocol belongs to the installed review skill. To obtain a review
or act on its report, read the caller section of
[scrutineer](../scrutineer/SKILL.md#enter-a-fresh-review-context) and follow
it: it defines the fresh-context reviewer, the brief in its `HANDOFF.md`, the
report and dispositions in its `REPORT.md`, and when an existing review still
applies. Compose no dispatch from memory. When that skill is absent, use the
reviewer the task or repository names and its protocol; without one, report
the review requirement as unmet.

Local or mechanical edits preserving these contracts need focused verification
only. Review is additional evidence, not a substitute for execution.

Reuse evidence only while its relevant source, inputs, and environment remain
unchanged. Rerun invalidated checks and all required repository gates. A
finding that falsifies one evidence claim (a fixture's stated source, a
claimed reproduction, a reported detection), whoever raises it, reopens every
claim of the same kind in the slice: re-derive each from its source before
reporting, and list the claims rechecked.

When two or more confirmed findings point at one seam, or the candidate repair
amounts to picking which of several authoritative sources or mechanisms wins,
write one root-cause hypothesis that explains them all and run the cheapest
check that could refute it before repairing. If it holds, repair the shared cause and recheck each
finding against the repair; otherwise repair them as independent defects.

## Close the requested outcomes

Before reporting completion, check that the requested behavior has evidence,
affected preserved contracts hold, and the representative case reaches the
intended decisions and effects. Judge behavior, structure, and cost separately
using the relevant evidence above; equivalent results alone establish neither structural
fit nor acceptable cost. Correct unexplained mismatches within scope, or report
the remaining mismatch and its consequence.
When review is required, acceptance also needs a completed review whose evidence
applies to the final material revision, with every finding dispositioned. If that
review is pending or blocked, report implementation and local verification
separately, without claiming complete acceptance.
For refactoring, also close the removal target or state the remaining migration
stage. Inspect the final diff for scope and unintended changes.

Describe structural gains concretely: a decision now has one owner, callers know
fewer details, or a rule change requires fewer coordinated edits. Classify failed
checks as introduced, pre-existing, or environmental. If an essential check could
not run, report the implementation as not fully verified and leave the affected
claim open. Continue independent work when one part is blocked.

Hand off the outcome, structural changes, decisive commands and results, and
remaining gaps in the user's language. On resumption, use the existing task state:
current contract, changes, verification status including any review still
owed, and next unresolved decision.
