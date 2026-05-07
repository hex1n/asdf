# Loophole Closure Loop — Kafka Partition Scale-Out Plan

## Inputs

**Draft strategy:**
1. Day 1: Bump Kafka topic partitions from 12 to 48.
2. Day 2: Double consumer pods.

**Success condition (stated):** A safe, non-disruptive migration that resolves the consumer-lag problem without correctness or operational regressions.

**Facts:**
- Current partition count: 12 (fact — stated by user).
- Current consumer pods: unspecified count (assumption: ≥1 consumer group).
- Lag exists and consumers cannot keep up (fact — stated by user).

**Assumptions:**
- A single consumer group is involved (assumption — multiple groups would each need independent scaling).
- Consumers are stateless or partition-local (assumption — ordering guarantees and stateful processing affect whether repartitioning is safe).
- The topic uses the default partition-assignment strategy and no sticky or custom partitioner on the producer side.
- No compacted-topic semantics that tie key-based ordering contracts to specific partitions.
- The broker cluster has sufficient capacity (leaders, ISR replicas, file handles) to host 48 partitions.

**Unknowns:**
- Number and nature of consumer groups subscribed to the topic.
- Whether producers use a key-based partitioner and whether downstream consumers depend on per-key ordering within a partition.
- Whether any consumer maintains local state per-partition (e.g., Kafka Streams, local RocksDB store).
- Current broker capacity and replication factor.
- Whether a Kafka upgrade window or maintenance freeze restricts the Day 1 change.

---

## Pass 1

### Attacker sweep

- **Silent data corruption:** Repartitioning redistributes keys to different partitions. Any consumer that assumed a key always lands in the same partition will silently process records out-of-sequence or with stale local state. This is a silent correctness regression, not a latency blip.
- **Runtime exceptions / crashes:** Kafka does not rebalance an existing consumer group until it is restarted or rejoined. After adding partitions, existing pods may not pick up the new 36 partitions until a group rebalance triggers. If Day 2 pods come up before a rebalance, you may get an uneven assignment where old pods hold 0 new partitions and new pods hold all 36, causing a thundering-herd assignment storm.
- **Resource amplification under load:** Tripling partitions (12 → 48) triples the number of partition leaders and replica follower threads on the broker. If the broker is already under load serving 12 partitions, adding 36 more is a non-trivial broker-side amplification event. No broker capacity check is in the plan.
- **Selection effects:** Consumer pods that cannot keep up may already be bottlenecked on a shared downstream resource (DB, cache, external API). More partitions + more pods will amplify calls to that shared resource — the lag problem shifts downstream rather than being resolved.
- **Operational rollback and recovery:** Kafka partition counts cannot be decreased once increased (as of Kafka 3.x with standard topic configs). Day 1 is irreversible. There is no rollback path if the change causes instability.
- **External/competitive response:** n/a — internal infrastructure change.
- **Observability and alerting gaps:** Consumer-lag alerts are typically configured per consumer-group, per-topic. After repartitioning, lag metrics expand from 12 partition-level entries to 48. Dashboards and alert thresholds may silently misreport lag until updated.
- **Behavior at boundaries not named:** Other consumer groups subscribed to the same topic are not mentioned. They will also receive the new partition assignments on their next rebalance, and may not have pods to cover 48 partitions.
- **Test-infrastructure regressions:** Integration test environments that spin up a local Kafka with 12 partitions will no longer match production after Day 1. Tests relying on partition-count assumptions (e.g., exactly-12-partition test fixtures) will silently diverge.

### Analyst — material cut

1. **Key-based ordering / stateful consumer correctness (silent data corruption):** Material. If a key-based partitioner is in use and consumers maintain per-partition state or per-key ordering contracts, repartitioning silently breaks those contracts the moment the first record for a previously-seen key lands on a new partition. The strategy does not mention a consumer drain, state migration, or ordering-safe cutover. Concrete failure: a consumer maintaining an aggregation keyed by `user_id` will split the event stream for the same user across two partitions mid-flight, producing a split-brain aggregate.

2. **Rebalance not guaranteed before Day 2 scaling (runtime / assignment storm):** Material. Adding consumer pods on Day 2 without explicitly triggering a rebalance risks an imbalanced assignment. Concretely: if pods are not cycling and no rebalance has occurred, old pods may hold 0 of the new partitions. The new pods joining triggers a full group rebalance while the old pods are also still live — causing a rebalance storm and a brief consumption pause across all 48 partitions simultaneously.

3. **Broker capacity not checked (resource amplification):** Material. Tripling partition leaders and replicas without a broker headroom check is a plausible production incident vector. No broker assessment step is in the plan.

4. **Irreversibility of partition increase (rollback gap):** Material. The plan has no acknowledgment that Day 1 cannot be rolled back. If broker instability or correctness regressions surface on Day 1, there is no stated fallback.

5. **Lag metric / alert misconfiguration (observability gap):** Material by the success-condition standard. "No operational regressions" includes monitoring. Lag alarms calibrated for 12 partitions will silently underreport (if per-partition thresholds) or over-alert (if sum-based) after repartitioning. The gap is not operational until it is — a silent lag alarm during an actual incident is a regression.

6. **Other consumer groups (boundary behavior):** Material if other groups exist. Unmentioned groups will be force-rebalanced onto 48 partitions they may not have pods to consume. This is unknown but the plan makes no provision for it. Calling this material-conditional.

Minor (not patched):
- Test environment partition-count divergence: real flaw, but does not fail the production success condition directly. Noted under unknowns.

### Patches

**Patch 1 — Key-ordering and stateful-consumer safety gate**
What changes: Before Day 1, audit the producer's partitioner and all consumer groups for key-based ordering dependencies or local per-partition state. If any are found, the migration requires: (a) drain all in-flight messages to the old topic before repartitioning, or (b) use a new topic with 48 partitions and migrate consumers to it (blue/green topic approach) with a cutover at a clean offset boundary. If no ordering or state dependencies exist, document this finding explicitly as the go/no-go gate for Day 1.
Why it closes the loophole: Repartitioning a key-partitioned topic mid-stream is the primary silent-correctness risk. A pre-migration audit either confirms safety or triggers a safer alternative path.
Evidence basis: Reasoning-only (no broker/code inspected in this session). Supported by documented Kafka behavior: `DefaultPartitioner` hashes keys mod partition-count; changing partition-count changes the hash bucket for every key.
What remains unverified: Whether the actual producer uses a custom partitioner or the default; whether consumers maintain local state.

**Patch 2 — Controlled rebalance before Day 2 pod scaling**
What changes: After Day 1 partition increase, perform a rolling restart of all consumer pods (or send a JoinGroup via a consumer coordinator rebalance) to ensure all 48 partitions are assigned before new pods are added on Day 2. Verify via consumer-group describe output (`kafka-consumer-groups.sh --describe`) that all 48 partitions show an active consumer and lag is being drained before proceeding to Day 2.
Why it closes the loophole: Explicit rebalance verification eliminates the risk of an unassigned-partition window and prevents Day 2 pod addition from triggering a blind rebalance storm.
Evidence basis: Reasoning-only. Consistent with documented Kafka consumer group rebalance protocol.
What remains unverified: Whether the consumer framework in use (e.g., librdkafka, Spring Kafka, Confluent Go) supports cooperative incremental rebalance — if not, the rolling restart itself causes a brief stop-the-world rebalance across all consumers.

**Patch 3 — Broker capacity check gate**
What changes: Before Day 1, assess broker capacity: check current partition-leader count per broker, open file-descriptor usage, network throughput headroom, and ISR lag. Establish a go/no-go threshold (e.g., post-change partition-leader count must stay below 80% of the broker's tested stable maximum). Consider spreading the partition increase across multiple brokers using `kafka-reassign-partitions.sh` if brokers are unevenly loaded.
Why it closes the loophole: Tripling partition count without a headroom check is a known broker-overload vector. A broker going into leader election storms or ISR shrink during the partition increase event can cause widespread topic unavailability.
Evidence basis: Reasoning-only.
What remains unverified: Current broker capacity figures (not provided).

**Patch 4 — Accept irreversibility explicitly; define a Day 1 abort criterion**
What changes: Add a pre-Day-1 rollback statement: "Partition count increase cannot be reversed. The abort criterion for Day 1 is: if broker ISR shrink, under-replicated partition count, or consumer exception rate exceeds [threshold] within 30 minutes of the change, escalate to incident response — partition reduction is not available, so mitigation is limited to broker-level throttling, topic recreation (with data replay), or reverting consumer pods." Document this explicitly so the team is not surprised when rollback is unavailable.
Why it closes the loophole: Forces the team to define the failure response before making an irreversible change. Closes the gap between "something went wrong" and "we have no rollback path."
Evidence basis: Reasoning-only. Supported by Kafka documentation: partition count can only be increased, not decreased, via standard topic alter operations.
What remains unverified: Whether the team's incident runbook already covers this scenario.

**Patch 5 — Update lag monitoring before Day 1**
What changes: Before the partition increase, update consumer-lag dashboards and alert rules to account for 48 partitions. For sum-based lag alerts, verify the new threshold is appropriate. For per-partition alerts, ensure 48 partition entries are expected and alert rules will auto-discover new partition offsets. Validate with a dry-run in a staging environment.
Why it closes the loophole: Monitoring gaps during and after the migration window are an operational regression. Updating alerts before the change ensures the team has visibility during the highest-risk window.
Evidence basis: Reasoning-only.
What remains unverified: Which monitoring stack is in use (Prometheus consumer-lag exporter, Confluent Control Center, Datadog, etc.) — the exact config change depends on the tool.

**Patch 6 — Enumerate and check all consumer groups (conditional)**
What changes: Before Day 1, run `kafka-consumer-groups.sh --list` and enumerate every group consuming the topic. For each group, verify it has sufficient pods to consume 48 partitions, or confirm it is tolerant of temporary assignment gaps (e.g., it is a low-priority batch reader). Include all affected groups in the rebalance verification step from Patch 2.
Why it closes the loophole: Other consumer groups are not mentioned in the plan. A group with 12 pods consuming 12 partitions will have 36 unassigned partitions post-increase until it scales — creating unbounded lag accumulation on those partitions for that group.
Evidence basis: Reasoning-only.
What remains unverified: Whether other consumer groups exist for this topic.

---

## Pass 2 — Attack the patched whole

The patched strategy now adds: producer/consumer audit gate, controlled rebalance verification, broker capacity check, irreversibility acknowledgment, monitoring update, and consumer-group enumeration.

### Attacker sweep on the patched strategy

- **Silent data corruption:** The Patch 1 audit gate closes this if executed. One residual: if the audit is done by the wrong team member or documented incorrectly, the gate passes silently for a stateful consumer. Minor — procedural risk, not a strategy flaw.
- **Runtime exceptions:** Patch 2 rolling restart introduces a brief rebalance pause. If the consumer framework uses eager (stop-the-world) rebalance, this could cause a latency spike during the restart. This is bounded and expected, but the plan should acknowledge it.
- **Resource amplification:** Patch 3 broker capacity check closes this. Residual: if the capacity check is done under low-traffic conditions but the increase is applied during peak, headroom may be overstated. Minor — timing risk.
- **Selection effects:** The root cause of the lag is still unverified. If the bottleneck is a shared downstream resource (DB write throughput, external API rate limit), doubling consumer pods will amplify that bottleneck. The plan does not include a root-cause check for the lag.
- **Operational rollback:** Patch 4 closes the rollback-gap acknowledgment. Residual: if a topic-recreation mitigation is needed, the plan does not address data replay infrastructure. Minor for the strategy as written.
- **External/competitive:** n/a.
- **Observability:** Patch 5 closes this.
- **Boundary behavior:** Patch 6 closes the consumer-group gap.
- **Test infrastructure:** Still diverges post-change; noted under unknowns.

### Analyst — material cut (pass 2)

One new material loophole:

**Selection effect — lag root cause not verified:** The plan assumes the lag is caused by insufficient partition-level parallelism. If the actual bottleneck is a shared downstream resource (e.g., a database that can handle 12 concurrent writers at saturation), doubling consumer pods on Day 2 will amplify the bottleneck and increase lag rather than reduce it. The strategy does not include a pre-migration root-cause check. This is material: there is a concrete scenario (downstream resource saturation) where the strategy fails the success condition (lag resolved) and may cause a wider incident.

### Patch 7 — Lag root-cause gate

What changes: Before Day 1, instrument and confirm the actual bottleneck. Check: (a) consumer CPU and memory during peak lag, (b) downstream resource saturation (DB connection pool exhaustion, API rate-limit rejections, cache miss storms), (c) network throughput between broker and consumers. If the bottleneck is downstream resource saturation, the correct fix is either (i) increase the downstream resource capacity concurrently, (ii) add backpressure or batching in the consumer, or (iii) rate-limit consumer concurrency per pod — not simply add more pods.
Why it closes the loophole: Without confirming the bottleneck, adding partitions and pods may amplify a downstream problem rather than resolve the lag.
Evidence basis: Reasoning-only.
What remains unverified: Which downstream systems the consumer writes to and their current saturation level.

---

## Pass 3 — Attack the fully patched whole

The strategy now has seven patches. The core migration is gated behind: root-cause check, producer/consumer audit, broker capacity check, monitoring update, consumer-group enumeration, rebalance verification, and explicit irreversibility acknowledgment.

### Attacker sweep (pass 3)

- **Silent data corruption:** Covered by Patch 1 audit gate. No new surface introduced by passes 1–2 patches.
- **Runtime exceptions:** Rolling restart rebalance pause is acknowledged and bounded.
- **Resource amplification:** Patch 3 and 7 together cover broker and downstream amplification.
- **Selection effects:** Patch 7 closes the root-cause gap.
- **Rollback:** Patch 4 closes the irreversibility gap.
- **Observability:** Patch 5 closes monitoring gap.
- **Boundary behavior:** Patch 6 closes multi-group gap.
- **Test infrastructure:** Still unaddressed; calling out as unknown.
- **Rebalance pause acknowledgment (pass 2 minor):** The rebalance pause during rolling restart is bounded and expected for this operation; it does not block the success condition.

### Analyst — pass 3

No new material loopholes found. All material candidates identified in passes 1 and 2 are patched or explicitly acknowledged. Remaining items are minor or unknowns.

**Stop condition met.**

---

## Final Strategy

**Pre-Day 1 gates (all must pass before proceeding):**

1. **Root-cause confirmation:** Profile consumer metrics and downstream resource saturation at peak lag. Confirm the bottleneck is partition-level parallelism, not a downstream resource ceiling. If downstream resource saturation is the primary bottleneck, address it concurrently or adjust the approach before proceeding.

2. **Producer/consumer audit:** Enumerate all consumer groups consuming the topic. For each: (a) check whether the producer uses a key-based partitioner and whether consumers depend on per-key ordering or maintain per-partition local state; (b) if yes, plan a drain-and-cutover or blue/green topic migration instead of a live partition increase.

3. **Broker capacity assessment:** Check partition-leader count per broker, file-descriptor usage, and network headroom. Confirm post-change partition density stays within the broker's safe operating range. Plan partition reassignment (`kafka-reassign-partitions.sh`) if needed to distribute load.

4. **Monitoring update:** Update consumer-lag dashboards and alert rules to reflect 48 partitions before the change is applied. Validate in staging.

5. **Irreversibility acknowledgment:** Document that the partition increase cannot be reversed. Define the incident escalation criteria (ISR shrink threshold, under-replicated partition alarm, consumer exception rate) that would trigger the incident response path.

**Day 1:**

- Increase topic partition count from 12 to 48 via `kafka-topics.sh --alter`.
- Monitor broker health (under-replicated partitions, ISR shrink, leader election rate) for a minimum of 30 minutes post-change.
- Trigger a rolling restart of all consumer pods to force a rebalance.
- Verify via `kafka-consumer-groups.sh --describe` that all 48 partitions are assigned and lag is being actively drained across all consumer groups before proceeding to Day 2.

**Day 2:**

- Double consumer pods.
- Verify rebalance completes and lag trend is decreasing under the new pod count.
- Confirm downstream resource metrics (DB connections, API error rates) remain within normal bounds.

---

## Material Loopholes Found

1. Key-based ordering / stateful consumer correctness — repartitioning silently breaks per-key ordering contracts and local partition state.
2. Rebalance not guaranteed before Day 2 — new partitions may be unassigned until an explicit rebalance, causing an assignment storm on Day 2.
3. Broker capacity not checked — tripling partition count without headroom assessment is a broker-overload vector.
4. Partition increase is irreversible — no rollback path acknowledged; no abort criterion defined.
5. Lag monitoring misconfiguration — dashboards and alerts calibrated for 12 partitions will silently misreport after repartitioning.
6. Other consumer groups not enumerated — groups not mentioned in the plan will receive 36 new unassigned partitions, accumulating unbounded lag.
7. Lag root cause not verified — if the bottleneck is a shared downstream resource, doubling consumer pods amplifies the problem rather than resolving it.

## Patches Made

| # | Loophole closed | What changes | Evidence basis |
|---|---|---|---|
| 1 | Key-ordering / stateful consumer | Pre-Day-1 audit of partitioner and consumer state dependencies; drain-and-cutover or blue/green topic if ordering contracts found | Reasoning-only |
| 2 | Rebalance not guaranteed | Rolling restart of consumer pods post-Day-1 with verified partition assignment before Day 2 | Reasoning-only |
| 3 | Broker capacity | Pre-Day-1 broker headroom check; partition reassignment if needed | Reasoning-only |
| 4 | Irreversibility | Explicit irreversibility acknowledgment; defined abort/escalation criteria | Reasoning-only |
| 5 | Monitoring gap | Update dashboards and alert rules pre-Day-1; validate in staging | Reasoning-only |
| 6 | Other consumer groups | Enumerate all consumer groups; verify each can consume 48 partitions | Reasoning-only |
| 7 | Lag root cause | Pre-Day-1 bottleneck profiling; verify partition parallelism is the actual constraint | Reasoning-only |

## Verification Basis

All patches are reasoning-only (verification hierarchy tier 4 — explicit logical reasoning). No Kafka broker, consumer code, configuration files, or command outputs were inspected in this session. The claims are grounded in documented Kafka behavior:

- Partition count increases are irreversible in standard Kafka topic operations (documented).
- `DefaultPartitioner` hashes keys mod partition-count; changing partition-count remaps keys (documented Kafka behavior).
- Kafka consumer group rebalance is triggered on membership change or partition-count change, not automatically on partition addition to an existing assignment (documented KIP behavior).

The strategy cannot be fully verified without: broker configuration, consumer group details, producer partitioner code, and downstream resource metrics.

## Remaining Assumptions / Unknowns

- Whether the producer uses a key-based partitioner and whether ordering contracts exist (could require a blue/green topic migration instead of live repartition).
- Whether any consumer maintains per-partition local state (Kafka Streams, custom RocksDB state store).
- Current broker capacity figures — broker-side patches remain unverified.
- Whether the consumer framework supports cooperative incremental rebalance (affects rebalance-pause duration during rolling restart).
- Number and nature of other consumer groups on the topic.
- Nature of downstream resources the consumer writes to, and their current saturation level.
- Test environment partition-count divergence post-migration (minor — does not affect production success condition but is a known divergence to address).

## Stop Reason

Pass 3 found no new material loopholes. All material loopholes from passes 1 and 2 are patched. All remaining items are unknowns requiring operator input before execution, or minor issues that do not fail the success condition. Stop condition met.

## Confidence: Medium

The strategy is logically coherent and all identified material loopholes are patched. Confidence is Medium rather than High because all patches are reasoning-only — no broker configuration, consumer code, or monitoring infrastructure was inspected. The most consequential unknown (whether key-based ordering or local state dependencies exist) could require a fundamentally different migration approach (blue/green topic) and cannot be resolved without inspecting the producer and consumer code.
