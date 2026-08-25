---
name: arborist
description: >
  Implements complex changes in existing systems by separating intended contracts from current behavior, tracing blast radius across affected flows, shaping deep modules at stable seams, and proving unaffected behavior. Use across languages and architectures for feature, fix, or refactor requests where behavior crosses modules, state, data, APIs, events, jobs, or compatibility paths. Do not use for planning-only, diagnosis-only, review-only, test-scope-only, documentation-only, or mechanical edits.
---

# Arborist

Treat a live system as a tree: the **Trunk** is what must remain true, the
**Roots** are where a visible change can propagate through hidden dependencies,
state, and data, and a **Prune or Graft** is the smallest coherent change that
improves the system without damaging its health.

> Trace the roots. Shape the growth. Preserve the living system.

Match the user's language. Preserve code identifiers, paths, commands, literal
values, and quoted contract text exactly.

## 0. Take the L0 Fast Path or Promote

Use **L0** only when inspection proves every condition:

- one private implementation detail changes and its direct consumers are
  bounded;
- observable contracts, shared state and data meaning remain unchanged;
- no cross-Module propagation, asynchronous work, compatibility window,
  security decision, or operational behavior is involved;
- an existing focused proof can exercise the changed detail.

Diff size is not locality evidence. An unknown condition means promotion.

For L0, the entire workflow is:

1. make the direct change without adding an abstraction;
2. run the existing focused command or the test file's native entrypoint;
3. inspect the final diff and repeat the locality check;
4. hand off the outcome, exact proof, and locality result briefly.

Architecture alternatives, a full Impact Ledger, new Seams or Adapters, broad
regression suites, and documentation belong to promoted work. If inspection or
implementation reveals a propagation edge, leave L0 and continue with the
full workflow below.

For promoted or ambiguous work, read [REFERENCE.md](REFERENCE.md) before
editing. Keep discovery and commands native to the repository's actual stack.
When structural improvement with conserved behavior is an approved outcome,
also read [REFACTORING.md](REFACTORING.md) before Step 1 and use its Refactor
Track to specialize Steps 1–6. Feature and fix work stays on the core workflow
unless refactoring is part of the approved change.

## 1. Pin the Intended Change and the Trunk

Write the **Intended Change** as an observable before → after contract: actor,
legitimate entry, conditions, result, side effects, and failure semantics.
Then write the **Conserved Set** — the business outcomes, state and data
properties, interfaces, ordering, compatibility, security, performance, and
operational behavior that this request does not authorize changing.

Keep evidence roles separate:

- **Expected authority** says what should happen: explicit user direction or
  an approved requirement, decision, policy, or published contract.
- **Implementation evidence** says what currently happens: code,
  configuration, schemas, and existing tests.
- **Runtime evidence** says what happened in an observed execution.

Code and existing tests are not expected authority merely because they agree.
Use them to characterize current behavior and reachability. If an unresolved
authority conflict can change the architecture or externally observable
result, stop with `NEEDS-DECISION` instead of choosing the current code by
default.

Completion: every load-bearing behavior is classified as intended, conserved,
assumed with an accepted owner, or `NEEDS-DECISION`.

## 2. Trace the Roots

Trace the normal business flow from its legitimate entry through decisions,
state transitions, and side effects to its committed observable. Then trace
change propagation in both directions:

`changed artifact -> contract/state/data meaning -> writers, readers, callers,
subscribers -> affected flows -> observable outcomes`

Inspect more than static callers. Follow alternate entries, shared stores,
dynamic dispatch, events, scheduled work, callbacks, retries, compensation,
administrative operations, reports, authorization, caches, compatibility
paths, and flows competing for the same state when relevant. Include published
documentation, examples, schemas, generated clients or fixtures, and embedded
instructions when they teach or encode the changed contract.

Maintain an **Impact Ledger** with one row per affected flow:

| Flow | Propagation evidence | Intended effect | Required change or proof | Status |
| --- | --- | --- | --- | --- |

Use only these closing dispositions: implemented, compatibility adapter,
verified unaffected, `NEEDS-DECISION`, blocked with reason, or explicitly out
of scope with accepted residual risk. “Probably unaffected” is not closed.

Completion: every changed contract, discovered consumer, and published
contract surface reaches an observable outcome or reader and has a disposition
in the Impact Ledger.

## 3. Shape the Architecture

Place the behavior in the Module that owns the business decision. Treat its
Interface as everything callers must know — inputs, invariants, ordering,
errors, configuration, and performance characteristics — not just a type
signature.

Prefer a **deep Module**: a small stable Interface hiding substantial behavior.
Choose a **Seam** where behavior can vary without spreading the decision across
callers; use an **Adapter** only when a real production or test variation
occupies that Seam. The goal is **Locality**: change, knowledge, bugs, and
verification concentrate in one place.

For a load-bearing Seam, state at least two credible shapes and select by:

- one source of truth for each business rule;
- dependency direction toward the decision-owning Module;
- explicit state, transaction, idempotency, retry, and concurrency semantics;
- compatibility for callers, stored data, and in-flight work;
- a test surface aligned with the Interface;
- the smallest coherent change, which may be larger than the smallest diff.

Reject a shape that adds pass-through layers, exposes internal seams for test
convenience, duplicates decisions across callers, or distributes one invariant
across unrelated Modules.

Completion: every touched Module has a stated responsibility, every new Seam
has real variation, and the Intended Change is owned in one place.

## 4. Pre-register the Proof

Before production code, map each Intended Change, Conserved Set item, and
Impact Ledger row to independent evidence. Existing implementation-derived
tests may characterize behavior; they do not supply their own business oracle.

Build the first slice as the shortest complete Happy Path from legitimate
entry to committed outcome. Then cover, in risk order, alternate valid routes,
business boundaries, rejection and failure semantics, rollback or
compensation, retry and idempotency, concurrency and ordering, migration, and
compatibility.

Choose evidence at the lowest surface that can prove the obligation:

- domain or property tests for invariants;
- Interface tests for Module behavior;
- contract tests across Adapters;
- integration tests for state, transactions, and infrastructure;
- business-flow regression tests for affected consumers;
- architecture checks for dependency and cycle rules;
- focused runtime probes only when the environment is authorized.

Completion: every proof obligation maps to a command, test, inspection, or an
explicit unverified risk before implementation begins.

## 5. Prune or Graft in Coherent Slices

Implement one observable slice at a time. Put decision logic behind the chosen
Interface, keep adapters translational, make failure and side effects explicit,
and use domain language in names. Preserve unrelated work and avoid unrelated
cleanup.

After each slice:

1. run the narrowest proof that can fail for the new behavior;
2. inspect the diff for duplicated rules, widened Interfaces, hidden side
   effects, and accidental compatibility changes;
3. update the Impact Ledger when the implementation reveals a new dependency;
4. widen verification only after the focused signal is trustworthy.

If a new dependency changes the blast radius or chosen Seam, return to root
tracing and architecture shaping before continuing.

Completion: the Intended Change is implemented through the selected Module,
and no new propagation edge remains outside the Impact Ledger.

## 6. Inspect the Whole Tree

Run the pre-registered proofs, then falsify the implementation:

- vary state, order, timing, retries, and failure points;
- exercise affected flows that should remain unchanged;
- check old and new callers or data during compatibility windows;
- confirm tests actually ran rather than being skipped by the build;
- inspect the final diff against both Intended Change and Conserved Set.

Do not claim the change safe because compilation, a focused unit test, or the
current implementation agrees with itself. Completion requires evidence for
every high-risk Impact Ledger row. Keep unexecuted checks and environmental
limits visible as residual risk.

## Handoff

For L0, use the compact handoff defined in Step 0. For promoted work, lead with
the implemented outcome. Then report:

1. architecture decisions: Module, Interface, Seam, and compatibility;
2. blast radius: affected flows and their dispositions;
3. verification: exact commands and results, including skipped or unavailable
   checks;
4. residual risks, `NEEDS-DECISION` items, and the smallest next proof.

Do not commit, push, deploy, migrate data, call live systems, or expand the
requested product behavior unless the user authorized that action.
