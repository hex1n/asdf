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
| Pure calculation or invariant | Example plus property/boundary tests with an independent oracle |
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
