# Adversarial Review: Kafka Partition Bump (12 → 48) + Consumer Pod Doubling

## Final Strategy (patched)

1. Before increasing partitions, audit whether any consumers depend on key-based ordering guarantees across the full topic. If they do, the 4x partition increase redistributes keys to new partitions and breaks per-key ordering for in-flight messages during the transition — patch this first.
2. Increase the topic from 12 to 48 partitions during a low-traffic window, not as a standalone step.
3. Immediately trigger a full consumer group rebalance after the partition change. Do not wait a day. With the default eager rebalance protocol, all consumers stop consuming during rebalance — if the group is large or uses `range` assignment, this stop can be substantial. Switch to cooperative-sticky rebalance (`partition.assignment.strategy=CooperativeStickyAssignor`) before proceeding if you have not already.
4. Deploy the doubled consumer pods concurrently with or immediately after the rebalance completes — not the following day. Waiting a day means 12 original pods cover 48 partitions (4 partitions/pod), consuming at the same throughput as before. If your scaling goal is to handle the new partition count efficiently, the lag will grow during that 24-hour gap.
5. Verify consumer group lag (via `kafka-consumer-groups.sh --describe` or your monitoring dashboard) after both steps complete.

---

## Material Loopholes Found

### 1. Key-based ordering is silently broken during the transition

**Scenario:** Producers use a non-null message key. At 12 partitions, key K consistently lands on partition P. After the bump to 48, the same key K lands on a different partition. Messages in-flight on old partition P before the bump and new messages on the new partition are now being consumed by different consumers, in different orders, potentially interleaved. If consumers are stateful or downstream systems assume per-key ordering, this is data corruption.

**Classification:** Material — concrete failure mode on any keyed topic where ordering is load-bearing.

### 2. The 24-hour gap leaves you under-resourced for 48 partitions

**Scenario:** After increasing to 48 partitions, your original 12 (or even doubled 24) consumer pods are rebalanced to cover more partitions each. If your traffic is high enough to justify the scaling, the lag will accumulate during the gap. More concretely: if the doubling is the mechanism to handle the new partition count at target throughput, delaying it by a day means a guaranteed lag spike.

**Classification:** Material — directly undermines the throughput goal of the operation.

### 3. Eager rebalance causes a full consumption stop

**Scenario:** With the default eager (stop-the-world) rebalance protocol, every consumer in the group pauses processing when a rebalance is triggered (partition count change always triggers a rebalance). For a group of many pods or a slow `max.poll.interval.ms`, this stop-the-world window can exceed minutes and cause lag accumulation or, worse, consumer pod eviction from the group if the rebalance takes longer than `session.timeout.ms`.

**Classification:** Material — the plan contains no mitigation for rebalance duration or protocol, and the 24-hour gap between steps makes this worse (step 3 triggers another rebalance the next day).

### 4. No rollback path for the partition count increase

**Scenario:** Kafka does not support decreasing partition counts on an existing topic. If the deployment goes wrong (wrong partition count, wrong replication factor, monitoring shows unexpected behavior), the only recovery is deleting and recreating the topic, which means deciding whether to replay from a backup or accept data loss.

**Classification:** Material — the plan has no stated rollback strategy and the operation is irreversible.

---

## Patches Made

### Patch 1 — Key ordering

**What changes:** Before executing, audit producer key usage. If keys are used for ordering:
- Option A (safer): drain in-flight messages on the old partition count before increasing (pause producers briefly, wait for consumer lag to reach zero, then bump partitions).
- Option B: accept the transition window and ensure downstream consumers are idempotent and ordering-tolerant.

**Why it closes the loophole:** Ensures in-flight messages on old partitions are consumed before new key-to-partition mappings take effect.

**Evidence basis:** Reasoning-only. Kafka's partition assignment for keyed messages is `murmur2(key) % numPartitions` — changing `numPartitions` changes the assignment for every key.

**Remains unverified:** Whether your producers actually use keys, and whether consumers depend on per-key ordering. This is a **blocker** if unknown.

### Patch 2 — Close the 24-hour gap

**What changes:** Deploy the doubled consumer pods immediately after the partition increase and rebalance complete (same maintenance window), not the following day.

**Why it closes the loophole:** Ensures throughput capacity matches the new partition count from the start.

**Evidence basis:** Reasoning-only. Partition-per-consumer ratio directly determines per-consumer throughput ceiling; delaying doubling leaves throughput unchanged until day 2.

### Patch 3 — Rebalance protocol

**What changes:** Configure `partition.assignment.strategy=CooperativeStickyAssignor` (Kafka 2.4+) on all consumers before the partition bump. This enables incremental cooperative rebalance — only partitions being moved are paused, not the whole group.

**Why it closes the loophole:** Eliminates stop-the-world rebalance pauses during both the partition-count change and the pod scaling event the next day.

**Evidence basis:** Reasoning-only, but this is established documented Kafka behavior (KIP-429).

**Remains unverified:** Your Kafka broker and client versions. Cooperative rebalance requires Kafka 2.4+ brokers and compatible client versions. Verify before applying.

### Patch 4 — Rollback plan

**What changes:** Before increasing partitions, snapshot the topic configuration and document the recovery procedure explicitly:
- If something goes wrong post-increase: partition count cannot be rolled back; recovery requires topic recreation and replay from the earliest committed offset or an external backup.
- Ensure consumer group offsets are checkpointed (or committed) before starting, so replay is possible.

**Why it closes the loophole:** Makes the irreversibility explicit and ensures the team has a recovery path before taking the irreversible step.

**Evidence basis:** Reasoning-only. Kafka's design does not support partition count reduction; this is a well-known constraint.

---

## Verification Basis

All patches are **reasoning-only (tier 4)**. No configs, code, consumer group state, broker version, or monitoring data were inspected. The plan as provided contains no evidence artifacts.

---

## Remaining Assumptions / Unknowns

- **Unknown:** Whether producers use message keys and whether consumers require per-key ordering. This is the highest-risk unknown — it determines whether the partition change causes silent ordering violations.
- **Unknown:** Current consumer group rebalance protocol (eager vs. cooperative-sticky). If eager, the rebalance stop-the-world window is unquantified.
- **Unknown:** Kafka broker and client versions. Cooperative rebalance and other mitigations have version floors.
- **Unknown:** Current consumer group lag before the operation. If lag is already elevated, the 24-hour gap makes it worse.
- **Unknown:** Replication factor and rack awareness configuration for the new partitions. A 4x partition increase may create replica imbalance if broker count does not divide evenly.
- **Assumption:** The success condition is increased throughput without data loss or ordering violations. If the goal is purely partition count (e.g., to allow future consumer scaling), the ordering and timing constraints relax somewhat.

---

## Likely Failure Modes

1. **Silent per-key ordering violation.** If producers use keys and any consumer or downstream system assumes per-key ordering, the partition bump silently breaks this for all in-flight and future messages on keys whose partition assignment changes. This will not produce an exception — it produces wrong processing order, which may only be detected much later.

2. **Lag spike during the 24-hour gap.** Forty-eight partitions with the original consumer pod count means each pod covers 4x as many partitions. If current throughput saturates the original setup, lag will grow continuously for 24 hours until pods are doubled. Depending on retention settings, this could result in message loss if lag exceeds retention.

3. **Rebalance-induced consumer eviction.** If the eager rebalance protocol is in use and the rebalance takes longer than `session.timeout.ms` (default 10s–45s depending on client), consumers are evicted from the group mid-rebalance, triggering another rebalance, producing a rebalance storm.

---

## Stop Reason

Pass 1 found four material loopholes; all have patches. Pass 2 attacks the patched strategy: the patched whole is logically coherent and the failure modes are now surfaced with mitigations. No new material loopholes introduced by the patches. Stopping after 2 passes. Key blocker (key ordering / producer usage) is unresolved and must be answered before executing.

---

**Confidence: Low**

Key ordering behavior and consumer group protocol are unknown and cannot be resolved without inspecting producer configuration, consumer group configuration, and broker version. The plan cannot be safely executed until the key-ordering unknown is resolved.
