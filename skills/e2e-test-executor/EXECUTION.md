# Stateful and dependent execution

Read only the applicable sections before setup, writes, async work, shared-state
scheduling, or cleanup. Record each fact once in the report or a linked existing
harness receipt; a named table is unnecessary unless it clarifies the run.

## Environment and dependency readiness

Use effective targets for the reached stores, queues, services, and external effects.
Verify the schema/fields actually used, the tool paths/versions the run's shell loads,
and the intended build in the running process. Omit irrelevant capabilities. After
changing configuration, services, fixtures, or deployment, recheck readiness and prove
the next response or state reflects the new setup.

In local scope, repair reversible setup issues: start declared services/workers/stubs,
resolve ports and declared dependencies, use temporary configuration, and run required
migrations/seeds. Retain the actual commands and changes. Downloads/cache failures
remain setup problems unless product code ran and violated an expectation. Preserve
business logic and existing authorization/validation boundaries.

Prefer declared harnesses and adapters; use their safe describe/probe surfaces to
resolve invocation details. Record only the selected target, operation, inputs,
relevant options, and actual permissions. Localize blockers to credentials, tooling,
network, routing, or dependency readiness from evidence instead of a generic failure.

A required real dependency that is unreachable blocks its dependent scenarios unless
the plan already permits a declared double. Keep real/double coverage explicit; do
not silently replace a real integration boundary. An intentionally unavailable
upstream is valid input only for a scenario whose authority specifies the fallback,
timeout, or recovery result. Time and randomness are dependencies too: control them
or observe them independently; inferring an expected clock/random value from the
response under test is circular.

## Business data and ownership

Before a business mutation, resolve the footprint's target provenance, owner or
run namespace, permitted effects, and terminal lifecycle (`retain`, `restore`, or
`delete`). Unknown ownership or recovery/retention authority blocks that mutation.
Create fixtures through legitimate business entries or declared test tools. Reused
read-only data needs its source, identifier, and reproducibility limits; it needs no
invented owner marker, TTL, or cleanup. Mutated shared data needs explicit restoration
or retention authority. Direct database mutation is a test-environment hook only,
with the affected records and commands retained.

For created/mutated data, record the owner, identifiers, original state when restoring,
cleanup command, retention scope/TTL, and allowed lifecycle. Preserve diagnostic
traces by default when the lifecycle permits it; honor a user's clean/retain override.
A retention override requires reconsidering destructive, configuration, scope-changing,
and external-effect scenarios. Use an owned fixture or an authorized read-only
alternative when the original route would violate it. Failure injection and replay
use dedicated fixtures, never an already-succeeded business state.

Existing seed/cleanup commands are valid reproducible handoffs. Generate helpers only
when existing entry points cannot provide the required replay or retained-data cleanup;
then read [Replay Entry Points](REFERENCE.md#replay-entry-points). A scriptable write
alone does not require a new script pair. Preserve enough inputs and exact invocations
to reconstruct the fixture and restore/delete only the authorized targets.

## Order, waits, and interference

Keep a short ordered list for a linear dependent run. Build a DAG when branching
prerequisites, shared mutable state, or cleanup dependencies make that list ambiguous.
Retain source-backed prerequisite edges and explicitly pass produced values. Parallel
execution requires evidence of disjoint mutable targets and effects across records,
readers/receivers, and external targets/stubs; different isolation keys alone are not
proof. Serialize unresolved overlap. Isolate disruptive recovery or concurrency work.

Wait on bounded observable completion predicates, not fixed sleeps alone. Use approved
business thresholds when present. With `business threshold: none specified`, choose
and record a finite execution-safety bound from the environment; it is not a product
oracle. A missing completion/probe capability is `blocked`. Exceeding a contractual
threshold is `failed` only after valid trigger and observation are established;
exceeding only a safety bound is `blocked` as incomplete observation, preserving any
more specific environment/tooling cause.

Finish dependent chains with the contractual cross-store/event/external consistency
checks. For a rejection that promises unchanged state, retain a before/after or other
independent invariant probe, including when the error response itself is correct.

## Preserve and clean up

Before cleanup, persist and verify the diagnostic evidence, owned identifiers, and
observed verdict in the canonical report or its linked durable receipts. Capture
failure state before further actions can overwrite it. If capture fails or required
diagnosis still needs the scene, preserve owned state under its permitted lifecycle,
record the failure and recovery path, and report any lifecycle obligation still unmet.
Never trade lost evidence for an apparently clean run.

Delete or restore only the recorded owned targets under the authorized lifecycle.
For filesystem cleanup, resolve the target inside the authorized run namespace,
reject traversal/symlink escape, and verify the matching owner before deletion.
After cleanup, perform an independent absence/restoration check and record its exact
invocation and output. Distinguish not attempted, retained, pending, and verified
completed cleanup. Remove empty ownership scaffolding only after its owned data is
settled. Cleanup success does not convert a failed scenario into a pass.
