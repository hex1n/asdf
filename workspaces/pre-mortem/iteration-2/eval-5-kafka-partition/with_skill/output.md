## Final strategy

1. Increase the Kafka topic partition count from 12 to 48 using `kafka-topics.sh --alter`.
2. Deploy the partition change and allow it to settle (Day 1).
3. The next day, double the number of consumer pods (from current count to 2×), so the new consumer group can spread across the 48 partitions.
4. Verify consumer group lag returns to baseline after the scale-out.

---

## Material loopholes found

**Loophole 1 — Consumer rebalance storm on existing in-flight consumers (Day 1).**
Increasing the partition count on a live topic triggers a consumer group rebalance immediately for any currently-running consumers. If consumers are mid-processing (e.g., holding uncommitted offsets), the rebalance can cause duplicate processing or lag spikes before Day 2. The strategy does not acknowledge or mitigate this.

**Loophole 2 — New partitions are empty; existing data does not redistribute.**
Kafka does not move existing messages when partitions are added. Partitions 12–47 will be empty until new messages arrive. If producers use key-based partitioning (e.g., `hash(key) % numPartitions`), the routing for all existing keys changes the moment partition count changes. Messages produced after the alter but before consumers have rebalanced may land on partitions with no active consumer, causing lag.

**Loophole 3 — Consumer-to-partition assignment ceiling.**
With 12 partitions and (assumed) 12 consumer pods, doubling to 24 pods against 48 partitions is a 1:2 ratio — fine. But if the current pod count is already above 12 or the doubling overshoots 48, some pods will be idle (Kafka assigns at most one consumer per partition per group). The strategy does not verify the current pod count relative to new partition count.

**Loophole 4 — No rollback path for the partition change.**
Kafka does not support decreasing partition count after an increase. If the partition increase is applied and a problem is found (e.g., wrong topic targeted, broker disk imbalance), the only recourse is deleting and recreating the topic, which destroys all unconsumed messages. The strategy has no stated rollback procedure.

**Loophole 5 — Broker-side partition leader imbalance.**
48 partitions will be distributed across brokers. If the cluster has fewer than 4 brokers (or brokers are unevenly provisioned), the new partitions will be assigned unevenly, creating hotspots. The strategy does not account for preferred-replica election or partition reassignment after the alter.

---

## Patches made

**Patch 1 — Schedule the alter during a low-traffic window and pre-notify consumers.**
Change: Execute `--alter` during off-peak hours. Before the alter, pause or drain in-flight consumers if possible, or at minimum accept a brief rebalance-induced lag spike and monitor it to completion before calling Day 1 done.
Why it closes Loophole 1: Rebalance during low traffic minimizes duplicate-processing risk; monitoring confirms stability before proceeding to Day 2.
Evidence: Reasoning-only (no live cluster inspected). Kafka documentation specifies that partition count increases trigger rebalance; timing and draining are operational mitigations.
Remaining unverified: Whether the consumer group uses `READ_COMMITTED` or `READ_UNCOMMITTED`, which affects duplicate exposure.

**Patch 2 — Confirm producer partitioning strategy before applying the change.**
Change: Before the alter, audit whether producers use key-based or round-robin partitioning. If key-based, coordinate a producer restart or rolling deploy so they use the new partition count. If round-robin, no producer change is needed.
Why it closes Loophole 2: Ensures messages do not pile up on new partitions before consumers are assigned to them.
Evidence: Reasoning-only. Key-based partitioning semantics are documented Kafka behavior.
Remaining unverified: Actual producer configuration.

**Patch 3 — Verify current pod count and set target explicitly.**
Change: Before Day 2, confirm the current number of consumer pods. Set the Day 2 target to `min(2 × current, 48)` — never exceed the partition count, as extra pods will be idle and waste resources.
Why it closes Loophole 3: Prevents over-scaling beyond the partition ceiling.
Evidence: Reasoning-only.
Remaining unverified: Current pod count and whether the orchestrator (Kubernetes, ECS, etc.) enforces a hard pod ceiling.

**Patch 4 — Document the no-rollback constraint and add a dry-run / staging verification step.**
Change: Add an explicit pre-flight step: run the alter on a staging cluster with the same topic config, verify behavior, then apply to production. Accept in writing (runbook) that the partition increase is irreversible.
Why it closes Loophole 4: Eliminates the most common source of irreversible mistakes (wrong topic name, wrong cluster) and ensures the team understands the irreversibility before executing.
Evidence: Reasoning-only.
Remaining unverified: Whether a staging environment exists with representative data.

**Patch 5 — Run preferred-replica election after the alter.**
Change: After `--alter`, run `kafka-leader-election.sh --election-type PREFERRED` (or the equivalent admin API call) to rebalance partition leadership across brokers.
Why it closes Loophole 5: Ensures new partitions get preferred leaders spread across brokers, avoiding hotspots.
Evidence: Reasoning-only. Kafka documentation specifies that newly created partitions may not have balanced preferred leaders without an explicit election.
Remaining unverified: Broker count and current partition distribution.

---

## Verification basis

Tier 4 (explicit logical reasoning and documented Kafka behavior). No live cluster, broker configs, producer configs, consumer group configs, or infrastructure details were inspected in this session. All patches are reasoning-only and must be validated against the actual environment before execution.

---

## Remaining assumptions / unknowns

- **Current consumer pod count**: unknown. The plan says "double," but the absolute number determines whether doubling exceeds the new partition ceiling.
- **Producer partitioning strategy**: unknown. Key-based vs. round-robin materially changes the producer coordination required.
- **Broker count and disk headroom**: unknown. 48 partitions on a small cluster can create leader imbalance and disk pressure.
- **Consumer group offset commit behavior**: unknown. At-least-once vs. exactly-once semantics determines the blast radius of a rebalance during the alter.
- **Whether a staging cluster exists**: unknown. Dry-run patch is contingent on this.
- **Replication factor**: unknown. If RF=3 and there are fewer than 3 brokers, the alter will fail or leave under-replicated partitions.
- **Retention and throughput**: unknown. 4× partition count means 4× file handles and 4× partition metadata overhead on brokers; acceptable at most scales but worth confirming.

---

## Stop reason

Pass 1 found 5 material loopholes; all were patched with reasoning-only evidence. Pass 2 attacked the patched whole — the patched strategy is logically coherent and meets the success condition (safe partition scale-out + consumer scale-out without data loss or extended outage), but all verification is tier-4 because no system artifacts were available to inspect. No new material loopholes in the patched whole. Stop condition met: no remaining unpatched material loopholes, all patches have a stated verification basis (reasoning-only, labeled), and unknowns are explicit.

---

**Confidence: Medium** — Strategy is logically coherent and material loopholes are patched, but every patch is reasoning-only with no live cluster, config, or code inspection. Confidence would reach High only after the unknowns above (producer strategy, pod count, broker count, staging validation) are resolved against actual system state.
