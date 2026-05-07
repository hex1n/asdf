# Adversarial Review: Kafka Partition Expansion (12 → 48) + Consumer Pod Doubling

**Reviewer role:** Senior advisor, adversarial lens  
**Plan as stated:** Day 1 — bump topic from 12 to 48 partitions. Day 2 — double consumer pods.

---

## Executive Summary

The two-step plan is directionally sound but leaves a cluster of operational and correctness risks unaddressed. Several of them can cause silent data loss, runaway lag, or hard consumer failures. None of the gaps below are theoretical; all have burned production systems.

---

## Gap 1: Partition Count Change Is Not a Zero-Downtime Operation for Keyed Topics

**What Kafka actually does:** Adding partitions does not rebalance existing data. Any message whose key previously mapped to partition `K` via `hash(key) % 12` will now map to a *different* partition via `hash(key) % 48`.

**Consequences:**
- If your consumers depend on key-ordering (e.g., event sourcing, per-user state machines, deduplication windows), messages written before and after the resize will land on *different* partitions for the same key. Consumers reading only one of those partitions get an incomplete, out-of-order view.
- Aggregation logic that relies on a single consumer owning all messages for a given key will silently break.

**Questions to answer before Day 1:**
1. Does this topic carry keyed messages where ordering or co-location per key is semantically meaningful?
2. If yes, is there a migration path (drain existing partitions to zero lag, freeze writes, resize, then resume)?

---

## Gap 2: Consumer Group Rebalance Storm on Day 1

The moment Kafka adds partitions to a live topic, the broker notifies all active consumer groups. Every consumer group with at least one active member will trigger a full rebalance. During eager (stop-the-world) rebalance, **all consumers in the group stop processing** until the rebalance completes.

- With cooperative/incremental rebalance (Kafka 2.4+, `partition.assignment.strategy=CooperativeStickyAssignor`): partial progress continues, but you still get transient duplicate processing at the rebalance boundary.
- With the default `RangeAssignor` or `RoundRobinAssignor`: full stop-the-world.

**Risk:** If you have multiple consumer groups on this topic (analytics, audit, alerting, etc.), each group triggers its own rebalance independently. A spike in consumer lag across all groups simultaneously can breach SLA or overwhelm downstream systems when consumers catch up.

**Mitigation to plan explicitly:**
- Identify every consumer group subscribed to this topic.
- Confirm which assignment strategy each uses.
- Schedule the partition increase during a low-traffic window.
- Have lag dashboards open and alerting suppressed selectively (not globally) during the window.

---

## Gap 3: Day 2 Pod Doubling Triggers a Second Rebalance

Doubling pods the next day creates a second rebalance event. With 48 partitions and, say, 24 pods today, going to 48 pods tomorrow is fine — each pod gets one partition. But:

- If you're currently at 24 pods → 48 pods, the math works out. If you're at a number that doesn't divide evenly into 48, some pods sit idle permanently.
- If your current pod count already meets or exceeds 48 (e.g., you're at 48 pods today managing 12 partitions with 36 idle), the pod doubling does nothing for throughput — you'd have 96 pods competing for 48 partitions.

**Verify:**
```
current_pods <= 48  (otherwise doubling wastes money and adds rebalance churn)
target_pods  <= 48  (hard cap: Kafka will never assign more than one partition per consumer in a group)
```

Also: if your consumer pods use `session.timeout.ms` and `max.poll.interval.ms` tuned for 12-partition load, the partition reassignments under a doubled pod fleet may cause consumers to time out during the rebalance if processing is slow.

---

## Gap 4: Broker-Side Capacity Is Unmentioned

Going from 12 to 48 partitions means:
- **4x more partition-leader replicas** the brokers must manage.
- If replication factor is 3, the cluster now manages 144 partition-replicas instead of 36.
- Each partition is an open file handle + an in-memory index segment on the broker. Under-resourced brokers will hit file descriptor limits or exhibit elevated fetch latency.

**Check before Day 1:**
- Broker file descriptor limits (`ulimit -n`, typically needs to be ≥ 100,000 for large clusters).
- JVM heap headroom on each broker (rule of thumb: ~1 MB heap per partition-replica).
- ISR (in-sync replica) propagation lag — if your brokers are already near capacity, adding replicas can push ISR lag above `replica.lag.time.max.ms`, causing partitions to go under-replicated.

---

## Gap 5: Retention and Storage Footprint Multiplies

Each partition has its own log segment files. With 4x partitions:
- Active segment count on disk goes 4x.
- If `log.retention.bytes` is set per-partition (not per-topic), your total topic storage quota is implicitly 4x'd.
- If `log.retention.bytes` is set per-topic and spread across 4x the partitions, each partition retains 1/4 the data it used to — which may break consumers that rely on long retention for replay or disaster recovery.

**Verify:** Whether retention is configured per-partition or per-topic, and whether the new per-partition size still satisfies your longest consumer replay window.

---

## Gap 6: Schema / Offset Compatibility for Existing Consumer Groups

Consumer group offsets are stored per-partition. When you add partitions 12–47:
- Existing consumers have no committed offsets for the new partitions.
- The `auto.offset.reset` policy (`earliest` vs. `latest`) determines where new partitions start consuming.
- If set to `earliest`, consumers will replay all historical messages in the new partitions — but the new partitions are empty at creation time, so this is safe *unless* you have a custom assignor or external offset management (e.g., Kafka Streams state stores, offsets stored in a database).
- Kafka Streams applications are a special case: adding partitions to an input topic requires repartitioning internal changelog topics and may require a full state store rebuild.

**Action:** Audit whether any consumer is a Kafka Streams application or uses external offset tracking.

---

## Gap 7: Producer-Side Impact Is Not Addressed

The plan mentions only consumers. Producers are affected too:

- If producers use a custom partitioner or send with explicit partition assignment, those assignments are now wrong (12 → 48).
- If producers use the default Kafka partitioner with keys, the routing table changes (see Gap 1).
- If producers use `linger.ms` + `batch.size` tuning calibrated for 12 partitions, batching efficiency may drop after the resize because the producer now routes to more partitions concurrently, reducing average batch fill rate and potentially increasing end-to-end latency.

---

## Gap 8: No Rollback Plan

Kafka partition increases are **irreversible** via standard tooling. You cannot reduce partition count without:
1. Creating a new topic with the desired partition count.
2. Migrating consumers and producers.
3. Draining and deleting the old topic.

The plan has no rollback step because none exists for Day 1 if something goes wrong. This means the operational bar for "go/no-go" on Day 1 must be higher than usual. Define explicit abort criteria *before* the change window, not during it.

---

## Gap 9: Monitoring and Alerting Gaps

Standard monitoring typically covers:
- `kafka_consumer_group_lag` — but alert thresholds tuned for 12-partition lag profiles will likely false-fire or miss issues after a 4x expansion.
- Broker under-replication alerts — need to be active during the change window (do not suppress these).
- Consumer rebalance duration — often not alerted on, but a rebalance that takes more than a few minutes indicates a deeper problem.

**Recommended:** Temporarily lower alert thresholds for consumer lag immediately after the partition increase, then re-calibrate once consumers have redistributed and caught up.

---

## Gap 10: The 24-Hour Gap Between Day 1 and Day 2 Is a Liability

During the 24-hour window after partition increase but before pod doubling:
- Your existing pod count is handling 48 partitions. If your current pod count is 12 (matching the original partition count), each pod is now responsible for 4 partitions instead of 1. Processing throughput per partition drops; lag may build.
- If throughput is bursty, this 24-hour window is where you accumulate technical debt in consumer lag that the Day 2 pod doubling has to burn down.

**Consider:** If the partition increase is truly about throughput, do both steps in the same maintenance window unless there is a deliberate reason to stage them (e.g., verifying broker stability first).

---

## Ordered Pre-Flight Checklist

| # | Check | Owner | Blocking? |
|---|-------|-------|-----------|
| 1 | Confirm topic keys are not semantically ordered / co-location-dependent | App owner | Yes |
| 2 | List all consumer groups on this topic and their assignment strategy | Platform | Yes |
| 3 | Verify broker file descriptor limits and JVM heap headroom | Infra | Yes |
| 4 | Confirm `auto.offset.reset` policy for each consumer group | App owner | Yes |
| 5 | Check for Kafka Streams applications using this topic as input | App owner | Yes |
| 6 | Audit producer custom partitioners or explicit partition assignments | App owner | Yes |
| 7 | Verify retention config is per-topic, not per-partition | Platform | Yes |
| 8 | Confirm target pod count ≤ 48 (new partition count) | Platform | Yes |
| 9 | Re-calibrate lag alert thresholds for 48 partitions | Observability | No |
| 10 | Document abort/rollback criteria (since partition reduction requires topic recreation) | Platform | No |

---

## Recommended Sequencing Change

Instead of Day 1 / Day 2:

1. **Pre-change window (now):** Complete checklist items 1–8 above.
2. **Change window:** Increase partitions AND scale pods in the same window, 30 minutes apart, with lag dashboards live.
3. **Post-change (24 hours):** Monitor lag, ISR health, and rebalance events before closing the change window.

Splitting into two separate days only makes sense if you are deliberately stress-testing the broker tier with 4x partitions before committing to the consumer-side scale-out. If that is the intent, document it explicitly and define pass/fail criteria for the 24-hour soak.

---

## Bottom Line

The two biggest risks — keyed-message ordering corruption (Gap 1) and the irreversibility of the operation (Gap 8) — deserve explicit answers before any change window is scheduled. Everything else is operational hygiene that reduces the probability of a bad outcome, but those two items determine whether the plan is safe to execute at all.
