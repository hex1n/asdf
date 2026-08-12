---
name: code-forge
description: >
  Forges correct, change-contained production code with only necessary complexity.
  Use while actively implementing or refactoring already-selected behavior: bound
  the semantic blast radius, preserve protected contracts, choose the smallest
  sufficient mechanism and coherent model, and prove target behavior plus
  containment. Combine with repository, language, security, migration, and testing
  skills. Do not use to decide what to build or compare implementation strategies
  without editing, for read-only diagnosis, completed-diff review, generated-output
  refresh, test execution itself, or docs-only edits.
---

# Code Forge

High-quality production code implements the required behavior, contains change to
the smallest justified semantic boundary, and introduces no more complexity than
the problem requires. Completion needs evidence for both the target behavior and
the containment of protected behavior outside that boundary.

Repository rules, verified domain facts, accepted contracts, and accepted
implementation decisions outrank every general heuristic in this skill. Use it as
foundational coding discipline alongside more specific architecture, language,
security, migration, and testing guidance.

## 1. Start from behavior

Read the current owner, its callers, the nearest comparable implementation, and the
tests that protect it. Carry forward accepted implementation decisions when current
evidence supports them. When evidence requires a deviation, state the contradicted
decision, reason, affected boundary, and revised proof obligation before editing.

Scale the frame to the change risk. For a local, private, reversible change with no
shared callers, persistence, compatibility, concurrency, configuration, or external
effect risk, state only:

```text
Outcome:
Required invariant:
Change boundary:
Proof obligation:
```

Expand the frame when a shared or stateful boundary can enlarge the blast radius:

```text
Outcome:
Required invariants:
Authoritative inputs:
Change boundary:
Intended affected paths:
Protected non-target behavior:
Shared surfaces and blast-radius risks:
State/effect semantics:
Flow:
Proof obligations:
```

Add observed live states and allowed transitions when repair or migration is in
scope. Do not manufacture lifecycle, authority, or compatibility analysis for a
change that has none.

The **blast radius** is the set of observable behaviors that can change through the
edited semantic owners, shared code, contracts, state, timing, transactions,
serialization, configuration, or external effects. It is not a count of lines or
files. Before editing a shared surface, classify each material consumer as:

- **intended:** its behavior is required to change;
- **protected:** it shares the surface but must retain its existing contract;
- **unknown:** its dependency or contract has not yet been resolved.

A high-risk change is not bounded while a material consumer remains unknown.
Investigate it or choose a narrower mechanism.

Separate required behavior from implementation ideas. Summarize the flow in a
short, readable outline. Difficulty explaining it is a signal to investigate the
model, not a size limit that permits flattening valid boundaries. When persisted
values cross scopes, expand the outline with semantic owners, canonical read
authorities, and derived targets. When repair or migration is in scope, classify
the observed contract-backed states and their allowed transitions.

For a bug fix, treat the reported failure as symptom evidence. Search every caller
and sibling entry path that can exhibit it. Fix the narrowest owner whose contract
is genuinely shared by every intended affected path: a common implementation is not
proof of a common contract. When sibling paths have different invariants, authority,
compatibility rules, or reasons to change, isolate the fix at their nearest divergent
boundary.

## 2. Choose the smallest sufficient mechanism and coherent model

Before shaping new code, stop at the first mechanism that fully holds:

1. omit behavior outside the accepted request or contract;
2. reuse an existing owner, helper, type, or repository pattern;
3. use the language runtime or standard library;
4. use a native platform, database, protocol, or infrastructure capability;
5. use an already-installed dependency whose contract fits;
6. write direct local code;
7. add a dependency or abstraction only for a proven capability or stable-boundary
   gap.

A mechanism holds only when it preserves the required behavior, invariants, domain
semantics, protected contracts, security, accessibility, operational constraints,
and both parts of the behavior proof. A shorter candidate that weakens any of them
does not hold. Keep explicitly requested scope; surface optional, contradictory, or
speculative work instead of silently shipping it or scaffolding for it.

Give each rule one authoritative owner. When a value crosses entity or storage
boundaries, distinguish its semantic owner, canonical read authority, and derived
targets. Same-shaped fields at different scopes are not interchangeable until
their semantics are proven identical. A stored derivative can serve audit,
historical time semantics, performance, or availability; give it explicit
synchronization or invalidation semantics instead of implicit fallback authority.

Use this preference order:

1. extend an existing owner that already has the responsibility;
2. write direct local code with domain names;
3. extract a small function when it names a cohesive step or clarifies the flow;
4. introduce an abstraction for a stable boundary or for consumers that share the
   same responsibility and reason to change.

Consumer count is evidence, not a rule. Multiple consumers with different reasons
to change do not justify one abstraction; a single consumer can justify a stable
external contract or architectural boundary. Prefer the shortest coherent diff,
not the fewest lines or files; a boundary earns its size when it contains a distinct
responsibility or contract.

When multiple mechanisms fully satisfy the behavior, prefer the one with the
smallest justified semantic blast radius and conceptual cost. A one-line edit to a
shared helper, public type, global default, transaction boundary, or configuration
source can have a larger radius than a larger isolated diff. Locality is often the
simplest containment mechanism; duplication alone does not justify coupling callers
with different contracts or reasons to change.

## 3. Match patterns to forces

Treat a design pattern as a named response to recurring **forces**. Identify the
pressure before naming the pattern: independently varying policy, lifecycle-specific
behavior, incompatible contracts, constrained construction, composable behavior,
or decoupled reactions.

Prove the force with one observable fact from the requirement or current code: a
decision repeated across owners, reachable state-dependent behavior, foreign types
crossing a boundary, construction that permits invalid objects, or work that must
survive a process or transaction boundary. Compare the direct implementation and
state why it can or cannot keep that fact local.

When the fact cannot remain local, read [Design patterns by force](DESIGN-PATTERNS.md)
before editing and choose the smallest expression that fits repository conventions.
Complete this step with the evidence, selected design, and behavior test. For a
pattern, map roles to domain names; for direct code, name the single owner of the
local decision.

## 4. Match stateful mechanisms and boundaries

When the change touches persistence, shared mutable state, append-only history,
compatibility, migration, concurrency, retry, or an external effect, read
[State, effect, and boundary semantics](STATE-AND-EFFECTS.md) before editing.
Classify every stateful step and effectful handoff: a compound operation may occupy
several classes. Complete this step with each boundary's authority, allowed
transition, selected mechanism, failure policy, and proof obligation.

## 5. Make the main path obvious

Write core behavior top to bottom. Normalize and validate each input once at its
boundary, keep transformations free of side effects where practical, and keep
persistence or integration calls narrow and visible.

Shape methods around cohesive business steps, not arbitrary line counts. A method
earns extraction when its name removes detail from the caller; a wrapper that only
forwards, renames, or rearranges one call adds distance without meaning.

Use domain vocabulary consistently. Prefer data-driven transformations over branch
chains when variation is data. Comments explain non-obvious business reasons,
constraints, or tradeoffs; the code itself explains mechanics.

## 6. Prove behavior at the right level

Behavior proof has two parts:

1. **Target proof:** the requested behavior and invariants hold.
2. **Containment proof:** protected callers, sibling paths, contracts, and state
   transitions remain within their existing behavior unless their change is
   explicitly in scope.

Use the smallest evidence that proves both parts. Add or identify the smallest test
that would fail without the requested behavior. Assert public outcomes and
invariants rather than private helper structure.

Select the risk dimensions that can change correctness at the identified boundary:
normal and edge state, compatibility, retry, partial progress, concurrency,
transaction rollback, ordering, time, resource limits, or remote failure. Test only
the relevant dimensions, but make the selection explicit.

Use focused unit tests for local transformations and integration evidence when risk
lies in persistence, serialization, transactions, concurrency, or remote contracts.
When equal values could hide a dependency on the wrong authority, use deliberately
divergent fixtures so the public result proves which authority was read. Assert a
collaborator interaction only when that interaction is itself part of the contract.

When editing a shared surface, identify at least one discriminating protected path
or stronger equivalent evidence. Containment evidence can be a focused sibling-path
or characterization test, exhaustive call-site reasoning for a closed surface,
compatibility tests for serialized contracts, before/after state and effect
assertions, or a repository-wide search proving no additional material consumer
exists.

## 7. Remove accidental complexity

Once behavior works, inspect the diff as a design artifact:

1. map every changed production symbol, branch, contract, configuration value, and
   state transition to a requirement or observed state;
2. search consumers of every changed shared surface and classify each material one
   as intended, protected, or unknown;
3. require a reason and target proof for every intended change, and containment
   evidence for every protected path;
4. replace or redesign a change whose radius cannot be bounded more cheaply than a
   narrower mechanism;
5. rerun the mechanism ladder against each addition and replace custom code when an
   existing owner, standard library, native capability, or installed dependency
   satisfies the same contract;
6. collapse duplicate policy, validation, normalization, or defaulting into its
   authoritative owner;
7. inline single-use indirection when locality improves and no boundary is lost;
8. remove speculative branches, future-only extension points, and unrelated edits;
9. trace the main path and require every new hop to name a real responsibility or
   boundary.

Treat public APIs, shared helpers, base classes, global configuration, defaults,
schemas, DTOs, enums, serializers, SQL fragments, transaction boundaries, retry
policies, cache or idempotency keys, and event contracts as high-leverage surfaces.

Stop and redesign when the same rule appears in multiple lifecycle paths, when an
abstraction joins different reasons to change, or when helpers hide rather than
remove decisions. Simplicity removes accidental complexity; it preserves necessary
domain, safety, transaction, and integration boundaries.

Make every new dependency, wrapper, configuration switch, interface, factory, or
layer name the current requirement that pays for it; remove it when no such
requirement exists. When accepting a bounded shortcut, record its known ceiling and
observable upgrade trigger in the repository's established debt mechanism without
scaffolding the future solution.

## 8. Finish only when the code is change-safe

The implementation is complete when:

- target behavior and invariants match the request;
- the semantic blast radius is explicitly bounded;
- every material consumer of a changed shared surface is intended or protected;
- intended paths change only as required and protected paths retain their contracts;
- no unresolved high-risk consumer or side effect remains unknown;
- the selected mechanism is the simplest one that satisfies correctness and
  containment;
- state and side-effect semantics use the correct mechanism;
- one authoritative rule produces each canonical decision;
- the main path is readable without reconstructing scattered control flow;
- compatibility and failure policies match their risk;
- relevant tests or runtime evidence pass;
- every changed production concept has a current requirement that pays for it.

Report the selected mechanism, change boundary, target and containment evidence,
any plan deviation, and remaining risk. Keep the report shorter than the code
explanation it replaces.
