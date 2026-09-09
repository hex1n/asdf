---
name: arborist
description: >
  Implement or refactor code that changes a shared contract, moves rule
  ownership, or spans more than one module, with evidence that affected
  contracts hold. Use when the user asks to 按设计文档落地 / 重构 / 迁移 or names
  this skill. A local, contract-preserving fix already covered by AGENTS.md
  runs without it.
---

# Arborist

Deliver the requested behavior and structural improvement with evidence that
affected contracts hold. Work within the user's scope and repository rules.

Resolve the uncertainty most likely to make the next change wrong, implement a
coherent slice, and inspect the result. Keep local work lightweight. Add records,
design comparison, and review when they resolve a concrete decision or risk.
Use the user's language for explanations; preserve code identifiers and commands.

## Establish the contract

Before editing, identify:

- the observable outcome the user wants;
- affected behavior that must remain true;
- any requested structural improvement;
- evidence that distinguishes success from a plausible wrong result.

Separate requirements from characterization of existing behavior. Agreement
between code and tests does not settle a disputed requirement. Existing behavior
can be an oracle for preservation; a bug fix needs an expectation independent of
the defect. When an exact answer is unavailable, use a justified invariant,
comparison, replay, or relationship between inputs and outputs.

Account for guards, errors, and effects that will be removed, narrowed, merged,
or relocated. Establish which obligation each serves before changing it.
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

Use these criteria to shape the implementation:

- **One rule owner.** Each business decision has one authoritative home. Callers
  use that decision without reproducing its conditions.
- **Deep modules.** A module hides substantial coherent complexity behind a
  small interface. The interface includes everything callers must know: errors,
  ordering, state, configuration, and performance obligations as well as signatures.
- **Clear dependencies.** Dependencies lead toward the owner of a decision.
  Adapters translate external representations and effects at that boundary.
- **Justified seams.** A seam is a replaceable boundary. Add one for demonstrated
  variation, isolation, or a migration need; collapse it when that need expires.
- **Direct expression.** Use domain names, readable control flow, and explicit
  effects. Remove duplication and indirection that add no useful distinction.

Judge a design by how much callers must understand, how many places a rule change
touches, and whether behavior can be tested through the relevant interface.
Line, class, and layer counts are supporting observations. For an unsettled,
material design choice, compare credible alternatives, including deletion or a
direct implementation, against the actual change pressure.

For requested structural work, or structural migration needed by the authorized
implementation, read [Refactoring](references/refactoring.md) before choosing the
transition. For compatibility or data migration without a structural redesign,
read its [transition section](references/refactoring.md#choose-the-transition).

## Implement coherent slices

Choose a slice with an observable result that can be verified. Distinguish
behavior-preserving movement from intentional changes to semantics. Keep
intermediate states valid for the callers and data that can encounter them.

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
| Performance | Representative work, resource or operation counts, and required thresholds |
| Operations | Actionable diagnostics and demonstrated recovery at the affected boundary |
| Structure | Rule ownership, caller knowledge, dependency direction, and obsolete path removal |

Discover the repository's actual commands and test entry points. Confirm the
relevant tests execute and observe the claimed result. For new or changed tests,
derive expected behavior from the contract rather than the proposed patch.
When claiming reproduction, confirm the target defect on the before-state when
feasible and its absence after the fix. A check passing both versions can
protect behavior but does not establish reproduction. Keep the limits of
intermittent or unavailable reproduction explicit.

Add or strengthen tests where a missing case matters; routine reversible edits
do not need new tests that merely repeat the implementation.

Use [targeted mutation or fault injection](references/verification.md#targeted-mutation-and-fault-injection)
when confidence depends on whether checks detect a plausible critical mistake,
especially after guards are narrowed, consolidated, or moved. Select faults from
the affected behavior, including unchanged and relocated logic. Use controlled
interleavings or dependency failures when they expose the risk better than a
syntactic mutation.

Run one [focused independent review](references/verification.md#focused-independent-review)
before reporting completion when the task, the repository's AGENTS.md, or a
selected verification Gate asks for it, or when the change touches concurrency
or authorization semantics, data spanning versions or effects that are
difficult to recover, or deletes or consolidates a shared guard; otherwise
report the change as self-reviewed.

Independent means a fresh-context reviewer, such as a subagent, that derives
failure cases from the requirements and code before seeing the builder's
conclusions. A reviewer that reads the builder's reasoning, including an
advisor call, is self-review: useful, and reported as such. The builder owns
the handoff, finding disposition, and affected rechecks; the reviewer owns
the independent pass. Follow [review lifecycle](references/verification.md#review-lifecycle)
for reuse, dispatch, and unavailable-review handling.

Local or mechanical edits preserving these contracts need focused verification
only. Follow stricter repository requirements when present. Review is
additional evidence, not a substitute for execution.

Reuse evidence only while its relevant source, inputs, and environment remain
unchanged. Rerun invalidated checks and all required repository gates.

## Close the requested outcomes

Before reporting completion, check that the requested behavior has evidence,
affected preserved contracts hold, and requested structural gains are observable.
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
current contract, changes, verification status, and next unresolved decision.
