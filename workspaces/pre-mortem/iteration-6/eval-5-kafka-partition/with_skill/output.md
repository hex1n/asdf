# Kafka Partition Scaling Plan — Hardened Strategy

## Final strategy

**Goal:** Resolve consumer lag on a 12-partition Kafka topic without correctness or operational regressions, using a safe, non-disruptive migration.

### Revised plan

**Pre-work (before Day 1)**

1. Audit whether any producer or consumer relies on key-based partition affinity (i.e., message ordering per key, or consumers that process a specific partition subset by index). If ordering per key is required, document which keys are affected and confirm that the new partition count does not break expected co-location.
2. Confirm that the consumer group's `partition.assignment.strategy` is a cooperative rebalancing protocol (`CooperativeStickyAssignor` or `cooperative-sticky` in librdkafka) — not `RangeAssignor` or `RoundRobinAssignor`. Eager protocols cause a stop-the-world rebalance (all partitions revoked simultaneously), which will spike consumer lag during the rebalance, not reduce it.
3. Take a baseline snapshot: consumer group lag per partition, end-to-end latency P50/P99, broker CPU/network, and producer throughput. This is the rollback reference and the success measurement baseline.
4. Confirm that the broker cluster has sufficient leader capacity for 48 partitions (rule of thumb: ~4 partitions per broker per core is the safe operating band; verify against your broker count and core count).

**Day 1 — partition expansion**

5. Increase the topic's partition count from 12 to 48 using `kafka-topics.sh --alter`. This is a one-way, irreversible operation on a running topic. There is no rollback to 12 partitions once applied.
6. Immediately verify that partition leaders have been rebalanced across brokers (run `kafka-topics.sh --describe`; uneven leader distribution will cause hot brokers).
7. Trigger preferred-replica election if leader distribution is skewed.
8. Monitor consumer group for the rebalance triggered by the new partitions. With a cooperative assignor, consumers continue processing existing partitions during reassignment of the new empty ones — confirm this behaviorally via consumer group state.
9. Observe that the 36 new partitions start being produced to (they will not have historical data; this is expected). Confirm producers are routing to new partitions via your partition key hash.

**Day 2 — consumer pod scale-out**

10. Scale consumer pods from the current count to 2× (matching or exceeding 48). Maximum parallelism is one active consumer per partition; pods beyond 48 will idle. Target pod count: 48 (1:1 with partitions) or confirm your target count is ≤ 48.
11. Monitor lag reduction per partition. Lag on pre-existing 12 partitions should drop as work redistributes. Lag on new partitions starts at zero and accumulates only from the moment of creation — this is expected and not a sign of a problem.
12. Set an alert threshold: if aggregate lag is not declining within 30 minutes of pod scale-out, treat as a signal to investigate (e.g., consumers are CPU-bound, not partition-count-bound; or the rebalance is stuck).

**Rollback posture**

- Day 1 partition increase: **irreversible**. The only rollback is to delete and recreate the topic (losing all unconsumed messages). This risk must be acknowledged before execution.
- Day 2 pod scale-out: fully reversible. Scale back to original pod count if pods destabilize the cluster.

---

## Material loopholes found

**L1 — Partition increase is irreversible; the plan has no rollback for Day 1**

Kafka does not support decreasing a topic's partition count. If the Day 1 change causes problems (e.g., key-ordering violations, broker overload), there is no undo. The original plan presents Day 1 as a routine operational step with an implicit assumption of reversibility.

**L2 — Eager rebalance protocol causes a stop-the-world pause that worsens lag before improving it**

If the consumer group uses `RangeAssignor` or `RoundRobinAssignor` (both eager/stop-the-world), all consumers revoke all partitions simultaneously when the partition count changes. During this window — which can last seconds to tens of seconds under load — no consumer is processing. On a topic already lagging, this makes the problem worse. The plan assumes the rebalance is benign.

**L3 — Key-based ordering may be silently broken by repartitioning**

Kafka's default `DefaultPartitioner` (and `murmur2`) maps a message key to a partition via `hash(key) % numPartitions`. Changing `numPartitions` from 12 to 48 changes the mapping for all keys. Any producer or consumer that assumed a given key always lands on the same partition (e.g., for in-order processing or stateful stream joins) will silently process keys on a different partition after the change. Historical messages for a key remain on the old partition; new messages go to a new partition. This is a silent correctness regression, not a visible error.

**L4 — Consumer parallelism ceiling: more pods than partitions are wasted, fewer than 48 leaves capacity unrealized**

Kafka enforces a hard ceiling of one active consumer per partition per consumer group. If 2× pods > 48, the excess pods are idle. If 2× pods < 48, some partitions are under-served. The plan says "double our consumer pods" without anchoring to the new partition count, making the target ambiguous and potentially wrong.

**L5 — Root cause not confirmed: lag may not be partition-count-limited**

The plan assumes lag is caused by insufficient parallelism (not enough partitions/consumers). If the bottleneck is actually consumer CPU saturation, downstream I/O (e.g., a slow database the consumer writes to), or a single-threaded consumer loop, adding partitions and pods will not reduce lag. The plan does not include a step to confirm the hypothesis before executing an irreversible change.

**L6 — Broker capacity for 48 partitions not checked**

Each Kafka partition requires an open file handle, a replication socket, and metadata overhead on every broker. Going from 12 to 48 partitions (4×) on the same broker fleet can cause broker CPU/memory/network pressure, especially if the topic has a replication factor of 3 (resulting in 144 partition replicas). The plan does not include a broker headroom check.

---

## Patches made

**P1 — Add explicit rollback acknowledgment gate for Day 1 (closes L1)**

Insert a mandatory pre-execution sign-off: "This operation is irreversible. The only recovery path is topic deletion, which loses all unconsumed messages. Confirm before proceeding." Do not automate the partition increase; require a human confirmation step.

Evidence basis: Kafka documentation and operational practice (tier 3 — established documented behavior). The irreversibility of partition count increases is a well-known Kafka constraint.

**P2 — Require cooperative rebalancing protocol before proceeding (closes L2)**

Add a pre-work step: inspect the consumer group's assigned `partition.assignment.strategy`. If it is not a cooperative protocol, either (a) migrate consumers to `CooperativeStickyAssignor` in a rolling restart before Day 1, or (b) schedule Day 1 during a low-traffic window and accept the stop-the-world pause, with lag alerting suppressed during the rebalance window. Do not proceed with an eager protocol on a production lagging consumer without one of these mitigations.

Evidence basis: tier 4 (explicit logical reasoning) — cooperative vs. eager rebalance behavior is well-specified in the Kafka protocol documentation and widely documented in engineering blogs. No command was run; label as reasoning-only.

**P3 — Audit and document key-ordering dependencies before Day 1 (closes L3)**

Add a pre-work step: grep producer code for explicit partition key usage; confirm whether any consumer has ordering guarantees per key or stateful joins keyed on partition assignment. If any key-ordering guarantee exists, either (a) use a custom partitioner that preserves the old mapping for existing keys and maps new keys to the full 48-partition range, or (b) drain and recreate the topic. If no key-ordering guarantees exist, document this explicitly so the sign-off is informed.

Evidence basis: tier 4 (logical reasoning) — the murmur2 partition formula is deterministic and the remapping behavior is mechanically certain. No code was inspected; label as reasoning-only pending audit.

**P4 — Anchor target pod count to partition count (closes L4)**

Replace "double our consumer pods" with a concrete target: "scale to N pods where N = min(2 × current, 48), with 48 as the ceiling." If current pods × 2 < 48 and lag is still unacceptable, scale further to 48. If current pods × 2 > 48, stop at 48 — additional pods are wasted.

Evidence basis: tier 3 — Kafka's one-active-consumer-per-partition ceiling is a documented invariant.

**P5 — Confirm lag root cause before executing Day 1 (closes L5)**

Add a pre-work step: sample consumer CPU utilization and downstream dependency latency under current load. If consumer CPU is near saturation, or downstream I/O is the bottleneck, adding partitions will not help — the fix is to scale the downstream system or optimize the consumer loop first. Only proceed with the partition increase if the bottleneck is confirmed to be parallelism-limited (consumers are blocked waiting for new messages, not blocked on processing).

Evidence basis: tier 4 (logical reasoning). No profiling data was provided; this is an assumption that must be verified.

**P6 — Check broker capacity for 48 partitions before Day 1 (closes L6)**

Add a pre-work step: calculate partition-replica count post-change (48 × replication_factor). Compare against current broker count and known per-broker partition limits (Confluent and Apache Kafka guidelines suggest ~4,000 partitions per broker as a soft ceiling; check your broker version and configuration). If broker headroom is insufficient, either add brokers first or use a smaller intermediate partition count (e.g., 24) and scale again after broker capacity is added.

Evidence basis: tier 3 — broker partition limits are documented in Kafka operational guides and Confluent documentation.

---

## Verification basis

- All patches are based on tier 3 (established documented Kafka behavior) and tier 4 (explicit logical reasoning and constraint checks).
- No commands were run, no code was inspected, and no logs were read in this session.
- Patches P2, P3, and P5 are explicitly labeled reasoning-only; they depend on environment-specific inspection that must be performed by the operator.
- The irreversibility of partition count increases (P1) and the one-consumer-per-partition ceiling (P4) are tier-3 facts with high confidence.

---

## Remaining assumptions / unknowns

- **Replication factor of the topic** — unknown. If it is 3, the partition-replica count goes from 36 to 144. Broker impact assessment in P6 depends on this.
- **Current consumer pod count** — unknown. P4's concrete target formula requires this to evaluate whether 2× exceeds the 48-partition ceiling.
- **Consumer group's current rebalance protocol** — unknown. P2 is the highest-operational-risk patch and cannot be verified without inspecting the consumer configuration.
- **Whether producers use explicit key-based partitioning** — unknown. P3 cannot be closed without a code audit.
- **Whether lag is actually parallelism-bound** — assumption, not verified. P5 must be executed before Day 1 to confirm the root-cause hypothesis.
- **Broker fleet size and per-broker partition headroom** — unknown. P6 requires this.

---

## Stop reason

No material loopholes remain open in the patched strategy. All six loopholes have patches with stated verification bases. Five unknowns remain, but they are surfaced and actionable — the operator can resolve each before execution. The patched strategy is concrete enough to execute once the pre-work steps are completed.

---

## Confidence: Medium

The strategy is logically coherent and all material loopholes are patched, but five unknowns (replication factor, pod count, rebalance protocol, key partitioning behavior, lag root cause) are unverified. Confidence would be High after the operator completes the pre-work audit steps in the revised plan. If any of those audits reveals a problem (e.g., key-ordering dependencies exist, or lag is CPU-bound), the plan would require revision before Day 1.
