# State, effect, and boundary semantics

Read this reference only when the implementation crosses a stateful or effectful
boundary. Classify each step and handoff independently; one workflow can require
several mechanisms.

## State and effect classes

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
that work is complete. This principle never licenses rewriting append-only history
or replaying an external effect.

## Compatibility and failure boundaries

Compatibility code supports proven persisted or external states. Record the state,
translate it once at the owning boundary, and define when that path can disappear.
For an authority migration, declare the read and write authority in each phase, the
cutover and rollback criteria, and how mixed states are detected. After cutover,
legacy inputs stop influencing canonical decisions unless the accepted contract
explicitly retains them.

Define the error and compatibility contract from impact:

- integrity, authorization, and irreversible writes normally fail closed;
- forward-compatible, non-critical reads may preserve unknown values, isolate the
  affected field, or degrade in a controlled and observable way;
- ambiguous state follows the declared failure, quarantine, or preservation policy;
  no path silently invents a valid meaning for unknown state.

Preserve causal exceptions and attach identifiers that locate the failing operation.
Choose explicit failure, quarantine, preservation, or controlled degradation rather
than relying on a broad fallback.
