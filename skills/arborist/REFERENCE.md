# Arborist Reference

Read this reference before editing on any promoted change, and again whenever
blast radius, architecture, or verification surface remains ambiguous. Derive
runtime wiring, build boundaries, and proof commands from the repository
rather than assuming an ecosystem.

## Runtime and Data-flow Impact Tracing

Start from symbols and files, then follow runtime wiring and data meaning.

### Entrypoints and dispatch

- HTTP or RPC handlers, UI actions, message consumers, schedulers, command-line
  commands, batch jobs, callbacks, hooks, and administrative endpoints.
- Dependency injection, factories and registries, plugin discovery, dynamic
  dispatch, reflection or metaprogramming, decorators or macros, code
  generation, configuration, build selection, and feature switches.
- Shared middleware, base types, interceptors, exception or error handlers,
  serializers, and generated clients that affect multiple implementations
  without direct calls.

### State and contracts

- Database tables, queries, migrations, constraints, transaction boundaries,
  locks, generated identifiers, caches, indexes, search projections, and
  outbox or inbox records.
- Request and response types, RPC or command signatures, error codes, event
  payloads, headers, enum values, nullability, default values, field ordering
  where serialized, and backward/forward compatibility.
- Retry keys, idempotency keys, deduplication windows, ordering guarantees,
  timeout policy, partial success, compensation, and terminal states.

### Indirect consumers

- Reporting, reconciliation, audit, alarm, analytics, export, cleanup,
  recovery, manual operations, and historical-data paths.
- Consumers that read the same state, protocol, file, or event without
  importing the changed symbol or package.
- Tests and fixtures that reveal supported behavior but may lag or encode a
  previous implementation decision.

Search broadly with repository-native tools. Treat call graphs and IDE usages
as leads, then confirm runtime reachability through wiring, configuration, and
data flow.

## Architecture Probes

Use these probes on the proposed shape:

### Ownership

- Which Module owns the business decision?
- If that Module disappeared, would its complexity disappear or spread into
  callers? Spreading complexity is evidence that the Module earns its place.
- Does one rule have one implementation, or are callers coordinating it?

### Interface

- Can callers use the Module without knowing its internal workflow?
- Are invariants, ordering, error modes, side effects, configuration, and
  performance characteristics explicit?
- Can the Interface shrink while preserving capability?

### Seam and Adapter

- What genuinely varies at the Seam?
- Are there at least two justified Adapters, commonly production and test, or
  is the new abstraction hypothetical?
- Does the Adapter translate technology concerns while the Module owns the
  decision?

### Locality

- Can a later rule change be implemented once?
- Can verification stay at the Interface when internals are refactored?
- Does the change reduce or increase the number of Modules a maintainer must
  understand simultaneously?

Common warning signs include chains of pass-through layers, untyped containers
hiding contracts, global or service-locator access hiding dependencies,
transaction or cancellation semantics split across callbacks and concurrent
tasks, and status or schema changes whose consumers were inferred only from
imports.

## Proof Matrix

Map system property to the evidence most likely to falsify it. Use project
capabilities already present; adding a library is a separate design decision.

| Property | Strong evidence |
| --- | --- |
| Pure calculation or invariant | Example plus property/boundary tests with an independent oracle; where no authority states the value, a metamorphic relation over paired runs |
| State transition | Transition table tests, illegal-transition probes, committed-state assertions |
| Persistence or transaction | Real-store integration test, constraint/rollback probe, migration rehearsal |
| API or RPC compatibility | Producer/consumer contract test and old/new payload fixtures |
| Event or scheduled flow | Delivery, duplicate, ordering, retry, timeout, and compensation probes |
| Idempotency | Replay after intervening state changes; assert stable result and no duplicate side effects |
| Concurrency | Controlled interleaving, lock/version conflict, and at-most/at-least-once assertions |
| Architecture | Dependency, cycle, and package/module rules executed in the build |
| Performance | Query counts, bounded work, benchmark or representative load with an approved threshold |
| Operations | Structured error, log/metric/alarm, correlation, and recovery-path inspection |

## Repository-native Verification

Discover the relevant commands from the changed component's manifests, build
scripts, CI configuration, and repository instructions; a stray fixture or
neighboring toolchain is not evidence that it builds the changed path. In a
multi-language repository, verify each affected component with its own native
tooling, then verify the contracts that connect them.

A scoped gate — one driven by an explicit file list, package filter, or opt-in
manifest — reports only what its scope contains, and new files sit outside
every such scope by default, so enrolling them is part of the change. Report
such a gate as its verdict together with its coverage set, never the verdict
alone: "N files clean, and these new files are outside the list" is the honest
form of a number that would otherwise read as full coverage.

Run the narrowest relevant target first, but distinguish syntax or type
checking, compilation, test compilation, test discovery, and actual test
execution. Inspect configuration for skipped suites, profiles or build tags,
filters, integration phases, generated sources, cached results, and required
services before claiming evidence. A green command that did not execute the
relevant proof leaves the obligation open.

Time the narrowest command that builds and tests the changed path once,
before the proofs are pre-registered; that figure and the count of separate
runs the proofs need are what the `Runs:` header records. A build that recompiles
components the change does not touch is narrowed to the changed component
and the tests that exercise it. A run expected to outlast the runtime's
foreground limit is started so that limit cannot kill it — a background job
the runtime tracks, or a run the user launches — with its output written to
a log file in the task directory; evidence cites the log path and line
rather than a terminal excerpt.

The change's diff, wherever these mechanics name it, is the working tree
against the change's base revision, added files included, produced by one
recorded command so that a later run reproduces it byte for byte.

A mutation's evidence is two files in the task directory: the mutant as a
patch against the change (`mutants/<identifier>.patch`) and the full log
of one command sequence — apply the patch, run the checks, reverse the
patch, run the checks again — so the red and the green sit in one file
with the apply and the reverse between them. The log opens with the test
command, the diff command, the `sha256` of the change's diff at that
moment, and the `sha256` of the patch; the pre-registration line cites
both files. Step 6 reproduces the diff with the recorded command and
recomputes both digests: a mismatch means the run predates the final tree
or the patch changed, and the mutation is re-run. A reader
re-runs only in an isolated copy of the checkout — a VCS worktree or a
plain directory copy at the change's base, with the handed-over diff
applied and checked by producing the same diff there and comparing the
two byte for byte; nothing built there is installed to a shared cache, a
toolchain whose build cache is shared by default is given a cache of its
own, and the run confirms it executes the copy's source rather than the
original checkout's. A reader that cannot make such a copy re-runs nothing
and reports each item it could not re-run. After a read that stopped early,
the builder diffs the checkout against the diff it handed over: a reader's
mutant found there is restored and the restore recorded in the
pre-registration file before any other step; any other difference is
reported, not restored.

A wide gate run once may fail on tests that name no line of the seam.
Classify each failure before reporting the gate: introduced by this change;
pre-existing, shown by running that test alone — never the whole gate again
— against the pre-change tree, a worktree at the base commit or a run log
from before the change; or absent from the tree — a filter that tolerates a
missing test passes silently, so name every listed test the tree does not
hold. The gate's verdict is reported with all three lists.
