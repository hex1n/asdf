---
name: arborist
description: >
  Lands a change in a live system: pins what must stay true, traces blast radius to every affected flow, shapes the seam, and proves the untouched behavior still holds. Use for any change to code that already has users, stored data, or tests to keep working — 实现, 修复, 改造, 重构, 继续做完 X, 按设计文档落地, implement, fix, refactor, migrate. Fires broadly; its first step demotes scoped work in four lines. Do not use for planning-only, diagnosis-only, review-only, test-scope-only, documentation-only, or mechanical edits.
---

# Arborist

A live system has behavior that must remain true, hidden paths along which a
visible change propagates through dependencies, state, and data, and a
smallest coherent change that improves it without damaging its health. This
workflow names them the **Conserved Set**, the **Impact Ledger**, and the
**slice**.

Match the user's language. Preserve code identifiers, paths, commands, literal
values, and quoted contract text exactly.

## 0. Take the L0 Fast Path or Promote

Use **L0** only when inspection proves every condition:

- one private implementation detail changes and its direct consumers are
  bounded;
- observable contracts, shared state and data meaning remain unchanged;
- no cross-module propagation, asynchronous work, compatibility window,
  security decision, or operational behavior is involved;
- an existing focused proof can exercise the changed detail.

Diff size is not locality evidence. An unknown condition means promotion.

For L0, the entire workflow is:

1. write the four conditions with their evidence, then make the direct
   change without adding an abstraction;
2. run the existing focused command or the test file's native entrypoint;
3. inspect the final diff and repeat the locality check;
4. hand off the outcome, the exact proof, and that locality record, briefly.

Architecture alternatives, a full Impact Ledger, new seams or adapters, broad
regression suites, and documentation belong to promoted work. If inspection or
implementation reveals a propagation edge, leave L0 and continue with the
full workflow below.

For promoted or ambiguous work, read [REFERENCE.md](REFERENCE.md) before
editing. Keep discovery and commands native to the repository's actual stack.
When structural improvement with conserved behavior is an approved outcome,
also read [REFACTORING.md](REFACTORING.md) before Step 1 and use its Refactor
Track to specialize Steps 1–6. Feature and fix work stays on the core workflow
unless refactoring is part of the approved change.

Completion: the four conditions are written down, each with its evidence,
before the work branches — for L0 the locality record of its first step; for
promoted work the opening `L0:` lines of the pre-registration file (Step 4),
created now, naming the condition that promoted the work.

## 1. Pin the Intended Change and the Conserved Set

Write the **Intended Change** as an observable before → after contract: actor,
legitimate entry, conditions, result, side effects, and failure semantics.
Then write the **Conserved Set** — the business outcomes, state and data
properties, interfaces, ordering, compatibility, security, performance, and
operational behavior that this request does not authorize changing.

Your own deletions belong in the Conserved Set. Every guard, validation,
error path, and assertion the change removes stays conserved until it carries
an explicit disposition. A guard living only in the code you are replacing is
the easiest one to lose, because nothing outside that code names it.

Mark the change **critical** when an error could pass every check and still
cost something not cheaply undone. Money, authorization, irreversible data,
concurrent state, and externally committed side effects are the usual shapes;
the test is the cost of a silent error, not membership in that list. An
unknown signal means critical. Critical is the one classification beyond L0
that changes what closes a step: Step 6.

Keep evidence roles separate:

- **Expected authority** says what should happen: explicit user direction or
  an approved requirement, decision, policy, or published contract.
- **Implementation evidence** says what currently happens: code,
  configuration, schemas, and existing tests.
- **Runtime evidence** says what happened in an observed execution.

Code and existing tests are not expected authority merely because they agree.
Use them to characterize current behavior and reachability. A design document
mixes both roles: what it prescribes is expected authority, but what it claims
about today's behavior is implementation evidence someone else gathered, often
against a codebase that has since moved — re-verify those claims before you
build on them. If an unresolved
authority conflict can change the architecture or externally observable
result, stop with `NEEDS-DECISION` instead of choosing the current code by
default. When expected authority prescribes an architecture and implementation
evidence contradicts it, `NEEDS-DECISION` is the only permitted disposition:
recording it as a logged deviation, a noted tradeoff, or a justified departure
does not discharge the obligation, however strong the evidence.

Completion: every load-bearing behavior, including each guard, validation,
and error path the change removes, is classified as intended, conserved,
assumed with an accepted owner, or `NEEDS-DECISION`, and the change is marked
critical or not.

## 2. Trace Propagation

Trace the normal business flow from its legitimate entry through decisions,
state transitions, and side effects to its committed observable. Then trace
change propagation in both directions:

`changed artifact -> contract/state/data meaning -> writers, readers, callers,
subscribers -> affected flows -> observable outcomes`

Trace inbound as well. When the change reads or validates state it does not
write, its correctness depends on every form that state can take, and each
writer of that state can produce a different form. Enumerate the writers of
each field you depend on by searching the field, column, or constant that
names it, and record that search — not just its result — as the row's
propagation evidence. One writer confirmed is a sample, not a set: logic
fitted to the first writer you find rejects what the others wrote.

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
in the Impact Ledger, and every field the change reads has its writers
enumerated with the search recorded.

## 3. Shape the Architecture

A **Module** is the unit that owns one business decision; place the behavior
in the Module that owns this one. Treat its **Interface** as everything
callers must know — inputs, invariants, ordering, errors, configuration, and
performance characteristics — not just a type signature.

Prefer a **deep Module**: a small stable Interface hiding substantial behavior.
Choose a **Seam** where behavior can vary without spreading the decision across
callers. An **Adapter** is the translational layer that fills a Seam — it
converts technology concerns and owns no decision — and earns its place only
when a real production or test variation occupies that Seam. The goal is
**Locality**: change, knowledge, bugs, and verification concentrate in one
place.

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

### Oracles

Name the **oracle** for every proof and check it is something other than the
artifact under test. For alignment work — make X match Y — the oracle is Y's
current behavior, never X's former behavior: "no longer the old wrong value"
measures distance travelled, not arrival.

An oracle is **specified** — a concrete expected value and the authority it
comes from — or **derived**: a differential run, a replay, an invariant, or a
metamorphic relation that fixes the output's relationship to another run
without stating the value. Reach for a derived oracle when no authority states
the value, which is the ordinary case for a Conserved Set item: the pre-change
build is independent of the artifact under test and is a legitimate oracle for
behavior that must not move — the same characterization evidence
[REFACTORING.md](REFACTORING.md) relies on. It is not an oracle for an Intended
Change, where the old behavior is the thing being replaced. Name which kind
each proof uses; a derived oracle also names what it is compared against.
`NEEDS-DECISION` is for an item neither kind can cover, not for one whose value
no document happens to state.

The Intended Change pulls its own proof into existence: it starts **red** and
turning it green is the work. The Conserved Set never does — nothing goes red
when you skip it, so it is skipped by default. Write its checks first.

Behavior that moves keeps its proofs. When logic relocates to another Module,
every case that covered it gets a disposition — moved to the new owner,
superseded by a named check, or dropped with a reason — as pre-registration
lines, one per disposition, each naming the cases it covers; the new owner is
where the red-capable checks now belong.

A Conserved Set item closes only on a check that goes red when that item
breaks — and red-capable is demonstrated, not asserted: break the guarded
behavior on purpose, watch the check fail, restore it — building the mutant
in place: a mutated artifact installed to a shared cache is a false verdict
for every later run, your own included. Each Conserved Set item gets its own
mutant, whose evidence — the mutant as a patch and the full log of its run,
bound to the final tree as [REFERENCE.md](REFERENCE.md) describes — is
stored in the task directory; and its check reads the value that mutant
writes: a check that observes only a downstream aggregate the mutation
never reaches stays green and proves nothing. Before the line is written,
ask what implementation keeps the check green under its mutation; if one
exists, move the check. The red an Intended Change shows before its fix is
that change's proof, not a Conserved Set
mutation. A guard the change removes is a mutation already run; nothing
going red when it went is the finding, not the all-clear. An item you cannot
cover before implementation is `NEEDS-DECISION` for the user, not a note you
write for yourself; cost alone never drops a proof.

### The pre-registration file

Write the pre-registration into a scratch file the repository already ignores
(for example `.scratch/<task>/proofs.md`) or into a temporary directory
outside the working tree, so it stays out of the change's diff; changing
ignore configuration to host it is a change of its own and needs
authorization. It opens with a header:

- `Task:` one line, and the task directory;
- `L0:` the four Step 0 conditions, each yes/no with its evidence, the
  failing one naming why the work is promoted;
- `Critical:` yes/no with the Step 1 reason; unknown is yes;
- `Runs:` the narrowest command that builds and tests the changed path, its
  time from one measured execution, and the count of separate runs the
  proofs below need.

Then one line per Intended Change, Conserved Set item, and high-risk Ledger
row, each carrying a stable identifier and naming its oracle and its check —
and, for a Conserved Set item, the mutation that must turn the check red,
the value it writes and the assertion that reads that value, and how it is
restored. The full Impact Ledger lives beside the file, in the same
directory, so a reader receives it whole. When the last pre-registration line
is written and before Step 5 begins, append `Digest: sha256:<hex>` over the
file's bytes above it, so the obligations Step 6 closes against are the ones
written; an obligation appended during Step 5 gets a fresh `Digest:` below
it before implementation resumes, and the last digest is the one Step 6
checks. The file's prose follows the conversation's language; the section
names (Intended Change, Conserved Set, Impact Ledger), oracle kinds,
dispositions, and `NEEDS-DECISION` stay fixed English tokens. Its lines
are append-only:
a changed obligation and a disposition are each appended beside the
original, never edited into it. Step 6 appends a `Closure` table after its
proofs and falsification have run — one row per identifier, its disposition
drawn from the six of Step 2, and the line of evidence it rests on — the
readable end state of an append-only file; a repair made after that appends
its evidence and a fresh Closure row for the identifiers it touches, and the
last row for an identifier stands. Case-movement lines keep their own moved,
superseded, or dropped wording; they are evidence, not Closure rows.

Order the proofs: the shortest complete Happy Path from legitimate entry to
committed outcome first, then, in risk order, alternate valid routes,
business boundaries, rejection and failure semantics, rollback or
compensation, retry and idempotency, concurrency and ordering, migration, and
compatibility.

Choose evidence at the lowest surface that can prove the obligation; the
Proof Matrix in [REFERENCE.md](REFERENCE.md) maps each property to the
evidence most likely to falsify it. Proofs one run can carry share it: the
pre-fix reds of the Intended Changes share one run on the pre-change tree
per native command they need, and each mutant's run carries every
registered check. Repository-native Verification in
[REFERENCE.md](REFERENCE.md) holds the execution and evidence mechanics.

Completion: before implementation begins, the pre-registration file exists
with its header, and in it every proof names its oracle kind and an oracle
independent of the
artifact under test; every Intended Change and Impact Ledger row maps to a
command, test, inspection, or an explicit unverified risk; and every
Conserved Set item maps to a red-capable check or a `NEEDS-DECISION`; and
every case of a removed or shrunk check is named on a disposition line.

## 5. Implement in Coherent Slices

Implement one observable slice at a time. Put decision logic behind the chosen
Interface, keep adapters translational, make failure and side effects explicit,
and use domain language in names. Touch only the lines an Intended Change or
a Ledger row names.

After each slice:

1. run the narrowest proof that can fail for the new behavior;
2. inspect the diff for duplicated rules, widened Interfaces, hidden side
   effects, and accidental compatibility changes;
3. update the Impact Ledger when the implementation reveals a new dependency;
4. widen verification only after the focused signal is trustworthy.

If a new dependency changes the blast radius or chosen Seam, return to
propagation tracing (Step 2) and architecture shaping (Step 3) before
continuing.

Completion: the Intended Change is implemented through the selected Module,
and no new propagation edge remains outside the Impact Ledger.

## 6. Inspect the Whole Change

Hand this step to a reader that has not seen Step 5 — a fresh context,
another agent, or a person — carrying only the pre-registration file, the
Impact Ledger, the diff, and the expected authority. The context that built
the change reads its own intent into every check; a reader without that
intent is the cheapest independent judge available, and its findings are
verified by anchor, not adopted. The reader's brief is fixed, and each item
returns its anchor — the command run, the output excerpt observed, and the
file line it was checked against — with a bare pass counting as no result:

1. recompute the last `Digest:` over the file's bytes above it and compare;
2. re-run each enumeration search the Ledger records, widened to every
   syntax that can write the field, and compare what it finds against the
   rows — a set the rows undercount is a finding, and a row that records no
   search is open;
3. verify, for each Conserved Set item not on `NEEDS-DECISION`, the
   mutation its own line names from its stored patch and log: the patch
   changes the code the item guards and nothing in the check — a patch
   that reverses a hunk of the Intended Change is that change's pre-fix
   red, not a mutation — the log's digests match the final diff and the
   patch, the red in it is the item's own check failing with a message the
   named property explains, and the log shows the patch applied before
   that red and reversed before the green; an item missing either file,
   whose digests do not match, or whose red the property does not explain,
   is re-run in the reader's own copy of the tree — storing what it
   lacked — and is a finding if it stays green; for
   a critical change, also re-run the mutation of the item that would cost
   most if wrong, as a spot check;
4. find a disposition line for each guard, validation, or check the change
   removed or narrowed;
5. read the diff against the `L0:` and `Critical:` lines and the
   identifiers: an `L0:` or
   `Critical:` verdict the diff contradicts, and any behavior or propagation
   edge the diff touches that no identifier registers, are findings.

The report is written to a file in the task directory before the first
re-run, so a read that stops early still returns it. A re-run builds only
in a copy of the tree the builder does not share; making that copy, and
recovering the checkout after a read that stopped early, are in
Repository-native Verification in [REFERENCE.md](REFERENCE.md).

If the runtime cannot supply a fresh context or agent, this step runs in the
building context; the handoff then names the mechanism tried and the failure
that blocked it, and every result reaches it labelled self-verified — for a
critical change, self-verified evidence closes nothing: whether to accept it
is a `NEEDS-DECISION` for the user.

Reopen the Step 4 pre-registration file, run its proofs, then falsify the
implementation:

- vary state, order, timing, retries, and failure points;
- exercise affected flows that should remain unchanged;
- check old and new callers or data during compatibility windows;
- confirm tests actually ran rather than being skipped by the build;
- inspect the final diff against both Intended Change and Conserved Set.

Then append the `Closure` table: a row for every identifier, using only the
six dispositions.

Do not claim the change safe because compilation, a focused unit test, or the
current implementation agrees with itself. Residual risk covers the checks
the environment blocked from running, not the checks you chose not to write.

Completion:

- evidence for every high-risk Impact Ledger row; a row whose evidence is a
  pointer closes only when the named artifact holds the item;
- a check seen red under its own stored mutant and green after restore for
  every Conserved Set item not on `NEEDS-DECISION`;
- every pre-registered identifier carrying a closing disposition in the
  `Closure` table;
- every hunk of the final diff mapped to an Intended Change, a Conserved Set
  item, or a Ledger row — a hunk with no mapping is scope drift;
- for a critical change, an independent read that closed this list, or the
  `NEEDS-DECISION` standing in for it.

## Handoff

For L0, use the compact handoff defined in Step 0. For promoted work, lead with
the implemented outcome — for a critical change Step 6 left on
`NEEDS-DECISION`, lead with that instead. Then report:

1. architecture decisions: Module, Interface, Seam, and compatibility;
2. blast radius: affected flows and their dispositions;
3. verification: exact commands and results, including skipped or
   unavailable checks, each marked self-verified or independently read; a
   completeness claim — all, every, full audit — names the enumeration it
   rests on, and without one is reported as a sample;
4. residual risks, `NEEDS-DECISION` items, and the smallest next proof.

Do not commit, push, deploy, migrate data, call live systems, or expand the
requested product behavior unless the user authorized that action.
