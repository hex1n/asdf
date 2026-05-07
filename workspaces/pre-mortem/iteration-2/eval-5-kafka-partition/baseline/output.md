# Adversarial Review: Kafka Partition Scaling Plan

## Summary of Stated Plan
- Increase Kafka topic partition count from 12 to 48 (4x increase)
- Double the number of consumer pod replicas
- Sequence: partition change first, consumer scale-out the following day

---

## Critical Issues

### 1. Partition Increase Is Not Live-Reversible
Once you increase partition count, it cannot be decreased without deleting and recreating the topic. If the partition increase causes problems — ordering violations, consumer rebalancing storms, offset management issues — your only rollback is a full topic recreation and replay. The plan has no rollback strategy. This is the single most dangerous gap.

### 2. The Overnight Gap Creates a High-Risk Window
Between partition change day and consumer scale-out day, your 12 consumer pods will be assigned to 48 partitions. That is 4 partitions per pod instead of 1. During this window:
- If those pods are already near CPU or memory limits, the temporary 4x partition load per pod could cause consumer lag to spike sharply or pods to OOM-kill and restart.
- Consumer rebalancing will trigger immediately when partitions are reassigned, causing a pause in consumption that compounds the lag spike.
- Any incident during the overnight window may require emergency consumer scale-out at an inconvenient time.

The plan treats the gap as benign. It is not.

### 3. Consumer Group Offset Handling Is Unspecified
When partitions are added, the new partitions start at offset 0 (or latest, depending on auto.offset.reset). You have not specified:
- What `auto.offset.reset` is configured to for your consumer groups
- Whether producers will begin writing to new partitions before consumers are ready
- Whether any downstream system depends on ordered consumption across all partitions

If `auto.offset.reset=earliest` and producers start filling new partitions, you may process a flood of "new" messages you did not intend to replay. If `auto.offset.reset=latest`, you silently skip everything produced to new partitions before consumers catch up.

### 4. Partition Key Distribution Is Unverified
Going from 12 to 48 partitions changes the result of `hash(key) % partitionCount` for every key. Unless your producers use sticky partitioning or a partition-count-independent hashing scheme (e.g., consistent hashing outside Kafka), messages for a given key that were on partition N will now go to a different partition. This breaks ordering guarantees for any key-based ordering your consumers depend on. The plan does not mention whether key ordering is a correctness requirement or whether this redistribution has been analyzed.

### 5. Consumer Pod Doubling May Underprovision
You are going from 12 to 48 partitions (4x) but only doubling consumer pods (likely 12 to 24 or similar). With 24 pods and 48 partitions, each pod handles 2 partitions. This is probably fine for steady state, but the math should be explicit. More importantly: if the goal is 1 partition per pod for maximum parallelism, doubling is insufficient — you need to quadruple.

### 6. Rebalance Storm Risk at Scale-Out
When you add consumer pods the next day, the entire consumer group will rebalance. With 48 partitions and a large group, depending on your `partition.assignment.strategy`:
- Cooperative sticky rebalancing (recommended) will minimize disruption.
- Eager rebalancing (the default in many older client versions) will cause all consumers to stop, all partitions to be unassigned, and then reassigned. This creates a full consumption pause across all 48 partitions simultaneously.

The plan does not specify the assignment strategy or the expected rebalance duration. In a busy topic, even a 30-second full rebalance pause can produce significant consumer lag.

### 7. No Mention of Producer-Side Impact
A 4x partition increase means the producer's internal metadata will be invalidated and refreshed. Producers using `round-robin` or `sticky` partitioner will immediately start distributing across 48 partitions. If producers are batching and you have per-partition buffer limits, memory pressure on producers can increase. This is rarely catastrophic but is entirely absent from the plan.

### 8. Monitoring and Alerting Plan Is Missing
The plan describes what to deploy and in what order, but not:
- What metrics will be watched during and after the partition change
- What consumer lag threshold triggers a rollback decision (which, again, is not defined)
- Who is on call during both deployment windows
- How long after each step before the change is declared stable

---

## Lower-Priority Observations

- **Broker-side impact**: 4x partition increase means 4x more partition leader elections distributed across brokers, 4x more log segments, and potentially 4x more open file handles. On a small cluster this can be meaningful. Verify broker file descriptor limits and replication overhead before proceeding.
- **Schema registry / serialization**: If you use Avro/Protobuf with a schema registry keyed by topic, partition changes are transparent. If any consumer has bespoke partition-aware logic, audit it.
- **Lag baseline**: You should capture a consumer lag baseline before the change so you have a clear before/after comparison rather than trying to remember what "normal" looked like.
- **Testing in a non-production environment**: The plan does not mention whether this has been validated in staging. A 4x partition increase on a cloned topic with mirrored consumer groups would surface most of these issues before production.

---

## Recommended Mitigations Before Proceeding

1. Define a rollback plan. The only real rollback for a partition increase is topic recreation — document the replay strategy, the estimated time, and who authorizes it.
2. Close the overnight gap. Either scale consumers immediately after the partition change (same deployment window), or accept that you will have a degraded window and alert on consumer lag during it.
3. Verify key ordering requirements. If any consumer depends on per-key ordering, audit whether the partition redistribution breaks correctness.
4. Confirm consumer assignment strategy. Ensure cooperative-sticky rebalancing is configured to avoid a full consumption pause during scale-out.
5. Set explicit lag alerting thresholds for both windows (post-partition-change and post-consumer-scale).
6. Run this in staging first if you have not already.
