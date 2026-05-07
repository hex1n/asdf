# Adversarial Review: Kafka Partition Bump (12 → 48) + Consumer Pod Doubling

**Reviewer role:** Senior adversarial advisor  
**Date:** 2026-05-07

---

## Executive Summary

The two-step plan — bump partitions on Day 1, double consumer pods on Day 2 — is directionally reasonable but contains several gaps that could cause data ordering violations, consumer group disruption, lag spikes, and downstream system failures. None of these are hypothetical edge cases; they are well-documented failure modes in production Kafka deployments.

---

## Critical Issues (Will Likely Cause Incidents)

### 1. Consumer Group Rebalance Storm on Day 1

When you add partitions to an existing topic, every consumer group subscribed to that topic triggers a full group rebalance. Depending on your `partition.assignment.strategy` and the number of consumer instances:

- All in-flight message processing stops during rebalance.
- With the default `RangeAssignor`, rebalance time scales poorly as group size grows.
- If rebalance exceeds `max.poll.interval.ms`, consumers are kicked out, causing a cascade of further rebalances.

**What's missing:** You have not specified a rebalance strategy audit or a plan to set `CooperativeStickyAssignor`. Without cooperative rebalancing, you are guaranteeing a full stop-the-world pause across every consumer group at the moment partition count changes.

### 2. Message Ordering Guarantees Are Broken the Moment You Re-partition

Kafka guarantees ordering only within a partition. The moment you go from 12 to 48 partitions, the partition to which a given key is assigned changes (because `hash(key) % 12 ≠ hash(key) % 48`). Any messages in-flight on the old partition layout will be processed interleaved with new messages assigned to different partitions.

**What's missing:** There is no mention of:
- Whether your consumers require per-key ordering (e.g., event sourcing, CDC, deduplication windows).
- A drain-and-cutover strategy: drain all 12 partitions to zero lag before the partition count change takes effect.
- Any downstream systems that assume per-key total ordering (databases with upsert logic, state machines, fraud detection windows).

If ordering matters anywhere in your pipeline, this is a correctness bug, not just a performance concern.

### 3. The One-Day Gap Creates a Temporary Under-Provisioned State

Day 1: 48 partitions, original consumer pod count (e.g., 12 pods → 1 pod per partition at best, likely fewer).  
Day 2: consumer pods doubled.

During the gap, throughput capacity per partition drops because more partitions are being served by the same number of consumers. If your topics carry any meaningful load, you will accumulate lag on Day 1 that your doubled consumers will then race to clear on Day 2, potentially causing downstream pressure spikes.

**What's missing:** A justification for the one-day gap. Unless there is a specific operational reason, partition bump and consumer scaling should happen in coordinated fashion, or the gap risk should be explicitly accepted and monitored with a lag alert threshold.

---

## High-Severity Issues (Probable Production Impact)

### 4. Producer Metadata Refresh Lag

Producers cache topic metadata. After partition count changes, producers continue routing to 12 partitions until they refresh. The refresh interval is controlled by `metadata.max.age.ms` (default: 5 minutes). During that window:

- New partitions 13–47 receive zero traffic.
- Partition skew is extreme.

**What's missing:** A plan to either force producer metadata refresh (restart producers, or set a short `metadata.max.age.ms` before the change), or accept and monitor the skew window.

### 5. Consumer Lag Monitoring Baseline Is Now Invalid

Your current alerting for consumer lag is calibrated to 12 partitions. After the bump, total lag (sum across partitions) is the same data volume, but the per-partition numbers change. Alert thresholds set on per-partition lag will fire false positives. Alert thresholds set on total lag are unaffected — but many teams monitor per-partition.

**What's missing:** Confirmation that your monitoring queries and alert thresholds are partition-count-agnostic (total lag, not per-partition lag), and a post-change alert review step.

### 6. Partition Count vs. Consumer Pod Count Alignment

You are going from 12 → 48 partitions and doubling consumer pods. The final pod count is not specified, but this matters enormously:

- If you currently have 12 pods → you will have 24 pods for 48 partitions → 2 partitions per pod. Fine.
- If you currently have 6 pods → you will have 12 pods for 48 partitions → 4 partitions per pod. Potentially fine, but higher per-pod load.
- If you currently have 24 pods → you will have 48 pods for 48 partitions → 1:1. Good, but the existing 24 pods during the gap on Day 1 means some pods handle 2 partitions, others handle 1, depending on assignment strategy.

**What's missing:** The exact starting pod count and the resulting partition-to-consumer ratio at each stage of the rollout.

### 7. Offset Commit and `__consumer_offsets` Compaction Pressure

Tripling partition count from 12 to 48 increases the number of offset entries in `__consumer_offsets` by 4x (per group, per partition). If you have many consumer groups, this can:

- Spike compaction activity on `__consumer_offsets`.
- Increase broker CPU and I/O during the transition.
- In extreme cases, delay offset commits, causing duplicate delivery.

**What's missing:** A check on the number of consumer groups subscribed to this topic and a broker resource headroom assessment.

---

## Medium-Severity Issues (Operational Risk)

### 8. Schema Registry / Serde Is Partition-Unaware, But Your Consumers May Not Be

If consumers use partition-based routing logic in application code (e.g., `if partition < 12: do X`), that logic is silently wrong after the bump. This is a common pattern in teams that hand-rolled partition-aware consumers before Kafka Streams or consumer group assignment was mature.

**What's missing:** A grep/audit of consumer application code for hardcoded partition count references.

### 9. Kafka Streams and ksqlDB Topologies Must Be Rebuilt

If any part of your pipeline uses Kafka Streams or ksqlDB and reads from this topic, those applications internally create changelog and repartition topics sized to the source topic's partition count at topology build time. Increasing source partitions without rebuilding the topology causes partition count mismatches and halted processing.

**What's missing:** An inventory of all Kafka Streams applications and ksqlDB queries that consume this topic, with a rebuild/reset plan for each.

### 10. MirrorMaker 2 / Replication Pipelines

If this topic is replicated to another cluster (DR, analytics, cross-region) via MirrorMaker 2, the target topic must also be re-partitioned, and the replication connector must be restarted to discover the new partition count.

**What's missing:** Confirmation of whether replication exists and a coordinated re-partition plan for the target cluster.

### 11. No Rollback Plan

You have described a forward-only operation. Kafka does not support decreasing partition count. Once you go to 48, you cannot go back to 12 without deleting and recreating the topic (losing all unprocessed data) or creating a new topic and migrating producers.

**What's missing:** An explicit rollback decision tree: what is the abort criterion, and what is the recovery procedure if something goes wrong on Day 1 before consumers are scaled on Day 2?

---

## Low-Severity Issues (Best Practice Gaps)

### 12. No Mention of Replication Factor Verification

Partition bumps do not change replication factor, but it's worth confirming the current replication factor is adequate for 48 partitions and that broker count supports it without under-replicated partition alarms.

### 13. No Canary / Staged Rollout

Going directly from 12 to 48 (a 4x increase) with no intermediate step (e.g., 12 → 24 → 48) removes the ability to validate behavior at a smaller scale before full commitment.

### 14. No Load Test at Target Partition Count

The assumption that doubling consumer pods is the right scaling multiplier for 4x partitions has not been validated. The relationship between partition count, consumer count, and throughput is not linear in all configurations.

---

## Required Pre-Flight Checklist

Before executing this plan, the following should be confirmed:

- [ ] Rebalance strategy is `CooperativeStickyAssignor` on all consumer groups touching this topic
- [ ] Per-key ordering requirements are documented and a drain strategy exists if ordering is required
- [ ] Starting consumer pod count is specified; final partition-to-consumer ratio is calculated for both Day 1 and Day 2 states
- [ ] Producer `metadata.max.age.ms` strategy is defined (short TTL or forced restart)
- [ ] Consumer lag monitoring is validated as partition-count-agnostic
- [ ] Consumer application code has been audited for hardcoded partition count references
- [ ] Kafka Streams / ksqlDB topology inventory is complete, with rebuild plan
- [ ] MirrorMaker 2 / replication pipeline impact is assessed
- [ ] Broker resource headroom (CPU, I/O, `__consumer_offsets` compaction) is assessed
- [ ] Explicit rollback criteria and recovery procedure are documented
- [ ] Justification for the one-day gap between partition change and consumer scaling is documented, with lag alerting armed for the interim period

---

## Recommended Change to the Plan

1. **Same day (or same change window):** bump partitions and scale consumer pods together, not 24 hours apart. Eliminates the under-provisioned gap entirely.
2. **Before Day 1:** switch all consumer groups to `CooperativeStickyAssignor` and roll that change out ahead of the partition change. This decouples rebalance strategy risk from partition change risk.
3. **Before Day 1:** set `metadata.max.age.ms` to 60 seconds on producers (or plan a coordinated restart) so partition skew window is bounded.
4. **Day 1:** monitor `records-lag-max` and `rebalance-rate` metrics in real time. Have a rollback decision threshold pre-agreed (e.g., "if lag exceeds X after 15 minutes, we pause").
5. **Post-change:** re-validate all alert thresholds and runbooks that reference partition counts.

---

## Verdict

The plan as stated is incomplete. The most dangerous gap is the ordering guarantee issue — if your pipeline is key-ordered-sensitive, you need a drain strategy before the partition change or you will silently corrupt processing order. The second most dangerous gap is the rebalance storm with no cooperative rebalancing configured. Everything else is operational hygiene that should be resolved before this change goes to a change advisory board.
