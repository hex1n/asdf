---
name: code-forge
description: Forges production code that is correct, cohesive, readable, and verifiable with only necessary complexity. Use while implementing or refactoring production behavior, including choosing between reuse, standard-library or platform capabilities, existing dependencies, direct code, and design patterns; combine with repository, language, and testing skills. Do not use for read-only diagnosis, completed-diff review, generated-output refresh, or docs-only edits.
---

# Code Forge

High-quality code expresses the right behavior with the fewest necessary concepts.
Repository rules, verified domain facts, and accepted contracts outrank every
general heuristic in this skill. Use it as foundational coding discipline alongside
more specific architecture, language, security, migration, and testing guidance.

## 1. Start from behavior

Read the current owner, its callers, the nearest comparable implementation, and the
tests that protect it. Before editing, state:

```text
Outcome:
Required invariants:
Authoritative inputs:
Observed live states:
State/effect semantics:
Affected callers/entry paths:
Flow:
Behavior proof:
```

Separate required behavior from implementation ideas. Summarize the flow in a
short, readable outline. Difficulty explaining it is a signal to investigate the
model, not a size limit that permits flattening valid boundaries. When persisted
values cross scopes, expand the outline with semantic owners, canonical read
authorities, and derived targets. When repair or migration is in scope, classify
the observed contract-backed states and their allowed transitions.

For a bug fix, treat the reported failure as symptom evidence. Search every caller
and sibling entry path that can exhibit it, then fix the narrowest shared owner that
removes the root cause without changing distinct contracts. Bound the scope
explicitly when one shared fix would conflate behavior that must remain different.

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
semantics, security, accessibility, operational constraints, and behavior proof. A
shorter candidate that weakens any of them does not hold. Keep explicitly requested
scope; surface optional, contradictory, or speculative work instead of silently
shipping it or scaffolding for it.

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

## 4. Match the mechanism to state and effect semantics

Classify the operation before choosing retry or repair behavior:

- **Replaceable projection, cache, or materialized view:** when a complete authority
  exists and replacement is safe, derive desired state and reconcile it while
  preserving required version and concurrency checks.
- **Mutable shared record:** define transaction boundaries, optimistic or
  pessimistic concurrency control, and a conflict policy before updating.
- **Append-only fact, ledger, audit record, or event:** preserve history and ordering;
  append with identity or uniqueness rules instead of reconciling to a snapshot.
- **Non-idempotent external effect:** use an idempotency key, durable state machine,
  outbox/inbox, or transactional handoff appropriate to the contract. Local state
  comparison alone does not prove whether the effect happened.

For a safely replaceable projection, the direct model is:

```text
desired = derive(authoritativeInput)
current = load()
reconcile(current, desired, concurrencyPolicy)
```

Before reconciling, define the complete target identity space, what absence means,
which identities must remain stable, how stale or extra targets are handled, and
whether readers require atomic visibility.

Classify observed live states before repairing them. For each accepted state, name
its authority and allowed transition. Repair only when the observed state and its
authoritative inputs determine one valid target; when multiple valid targets fit,
fail, quarantine, or preserve the state according to the boundary contract.
Existing target data is evidence to compare with that target, not by itself proof
that work is complete. This principle never licenses rewriting append-only history or replaying an external effect.

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

## 6. Handle boundaries deliberately

Compatibility code supports proven persisted or external states. Record the state,
translate it once at the owning boundary, and define when that path can disappear.
For an authority migration, declare the read and write authority in each phase,
the cutover and rollback criteria, and how mixed states are detected. After
cutover, legacy inputs stop influencing canonical decisions unless the accepted
contract explicitly retains them.

Define the error and compatibility contract from impact:

- integrity, authorization, and irreversible writes normally fail closed;
- forward-compatible, non-critical reads may preserve unknown values, isolate the
  affected field, or degrade in a controlled and observable way;
- ambiguous state follows the declared failure, quarantine, or preservation policy;
  no path silently invents a valid meaning for unknown state.

Preserve causal exceptions and attach identifiers that locate the failing operation.
Choose explicit failure, quarantine, preservation, or controlled degradation rather
than relying on a broad fallback.

## 7. Prove behavior at the right level

Add or identify the smallest test that would fail without the requested behavior.
Assert public outcomes and invariants rather than private helper structure.

Select the risk dimensions that can change correctness at the identified boundary:
normal and edge state, compatibility, retry, partial progress, concurrency,
transaction rollback, ordering, time, resource limits, or remote failure. Test only
the relevant dimensions, but make the selection explicit.

Use focused unit tests for local transformations and integration evidence when risk
lies in persistence, serialization, transactions, concurrency, or remote contracts.
When equal values could hide a dependency on the wrong authority, use deliberately
divergent fixtures so the public result proves which authority was read. Assert a
collaborator interaction only when that interaction is itself part of the contract.

## 8. Remove accidental complexity

Once behavior works, inspect the diff as a design artifact:

1. map every changed production file and branch to a requirement or observed state;
2. rerun the mechanism ladder against each addition and replace custom code when an
   existing owner, standard library, native capability, or installed dependency
   satisfies the same contract;
3. collapse duplicate policy, validation, normalization, or defaulting into its
   authoritative owner;
4. inline single-use indirection when locality improves and no boundary is lost;
5. remove speculative branches, future-only extension points, and unrelated edits;
6. trace the main path and require every new hop to name a real responsibility or
   boundary.

Stop and redesign when the same rule appears in multiple lifecycle paths, when an
abstraction joins different reasons to change, or when helpers hide rather than
remove decisions. Simplicity removes accidental complexity; it preserves necessary
domain, safety, transaction, and integration boundaries.

Make every new dependency, wrapper, configuration switch, interface, factory, or
layer name the current requirement that pays for it; remove it when no such
requirement exists. When accepting a bounded shortcut, record its known ceiling and
observable upgrade trigger in the repository's established debt mechanism without
scaffolding the future solution.

## 9. Finish only when the code is change-safe

The implementation is complete when:

- behavior and invariants match the request;
- the selected mechanism is the first ladder rung that fully satisfies them;
- bug fixes resolve the root cause across affected caller paths or explicitly bound
  the distinct behavior left unchanged;
- state and side-effect semantics use the correct mechanism;
- one authoritative rule produces each canonical decision;
- the main path is readable without reconstructing scattered control flow;
- compatibility and failure policies match their risk;
- relevant tests or runtime evidence pass;
- every changed production line has a reason to exist.

Report the selected mechanism, chosen model, verification evidence, and any
remaining risk. Keep the report shorter than the code explanation it replaces.
