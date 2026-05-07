# Loophole Closure Loop — Inventory Double-Decrement Fix

## Inputs identified

**Strategy**: In `services/inventory/src/reservation.go`, wrap the stock-decrement inside `tryReserve` in a `sync.Mutex` keyed by SKU id to prevent double-decrement when a customer retries within 200ms.

**Stated success condition**: A retry within 200ms must not cause stock to be decremented twice for the same reservation attempt.

**Constraints**: Go service; per-SKU mutex (not a single global mutex). Repo at `~/code/inventory` — confirmed absent from this system; code was not inspected.

**Available evidence**: User description only. No source code, tests, benchmarks, or command output are available.

**Missing information that could change the answer**:
- Actual implementation of `tryReserve` (signature, return values, caller contract).
- How the per-SKU mutex map itself is allocated, stored, and cleaned up.
- Whether the retry is driven by the HTTP layer, a message queue, or an in-process retry loop.
- Whether the service runs as a single process or is horizontally scaled.
- Whether there is a database or distributed cache that is the authoritative stock store.

---

## Pass 1

### Facts

- The bug is a double-decrement on retry within 200ms. (User-stated.)
- The proposed fix is a `sync.Mutex` keyed by SKU id. (User-stated.)
- The repo does not exist on this system; no code was read. All claims below about the implementation are assumptions.

### Assumptions

- `tryReserve` is called synchronously in a single Go process.
- Stock is held in an in-process data structure (e.g., a `map[string]int`) and not in an external database.
- The per-SKU mutex map is something like `map[string]*sync.Mutex` protected by a second mutex or `sync.Map`.
- The retry is a second HTTP request or goroutine, not a second call within the same goroutine.

### Unknowns

- Is the service horizontally scaled? If yes, a per-process mutex provides no protection across replicas.
- What is the deduplication key? SKU id alone may not be enough — the same SKU can have multiple simultaneous reservations from different customers.
- How long does the mutex stay locked? If the lock is held across a slow I/O path, throughput collapses on high-SKU-contention workloads.
- Is the decrement guarded by an idempotency key, or only by the mutex window?
- Does `tryReserve` return an error on the second call, or silently succeed?

### Material loopholes found

**Loophole 1 — Mutex scope is too coarse for concurrent distinct customers.**
A mutex keyed only by SKU id will serialize all reservations for the same SKU, not just duplicate retries. Under load, this turns a concurrent hot SKU into a sequential bottleneck. If `tryReserve` holds the lock across network I/O or a slow DB write, this is a correctness risk (timeouts, queue buildup) and a performance risk, either of which can constitute a failure of the success condition in production.
*Classification: material* — there is a concrete scenario (high-traffic SKU + slow downstream) where the fix causes failures that the original code did not.

**Loophole 2 — Per-process mutex does not protect against multi-replica double-decrement.**
If the service is deployed with more than one replica (common for inventory services), two replicas can each receive one leg of the retry, each acquire their local mutex, and each decrement. The fix closes the race within one process but leaves the distributed race open.
*Classification: material* — on any horizontally-scaled deployment the stated success condition is not met.

**Loophole 3 — The root cause may be missing idempotency, not a missing lock.**
If the retry carries the same request ID or reservation ID, the correct fix is to deduplicate on that ID (check-then-act with idempotency key) rather than rely on timing (the 200ms window). A mutex-based fix is timing-dependent: a retry arriving at 201ms still double-decrements. Whether 200ms is a hard invariant or an observed symptom is unknown.
*Classification: material* — if the retry can arrive after the mutex is released, the fix does not fully close the bug.

**Loophole 4 — Mutex map lifecycle is unspecified.**
A `map[string]*sync.Mutex` that grows without bound leaks memory as new SKUs are seen. If the map is not bounded or periodically pruned, the fix introduces a memory leak. If the map itself is not protected by a higher-level lock or `sync.Map`, it introduces a map-concurrent-write panic.
*Classification: material* — a map-concurrent-write panic is a crash, which fails the success condition.

### Patches made

**Patch 1 — Narrow the lock scope (reasoning-only).**
Hold the mutex only for the duration of the read-check-decrement critical section, not across any I/O. If the decrement requires a DB write, release the mutex before the write and use an optimistic concurrency check (compare-and-swap or conditional update) at the DB layer. This eliminates the bottleneck on hot SKUs while still preventing the in-process race.

**Patch 2 — Add idempotency key deduplication (reasoning-only).**
Require callers to supply a reservation ID (UUID or request ID). Before decrementing, check a short-lived in-process set (e.g., `sync.Map` with TTL via a background sweeper, or a bounded LRU) for the reservation ID. If already seen, return success without decrementing. This closes the timing dependency of the mutex-window approach and is the correct fix when retries carry the same ID.

**Patch 3 — Use distributed locking or atomic DB operations for multi-replica safety (reasoning-only).**
If the service is horizontally scaled, replace or supplement the in-process mutex with a distributed lock (Redis `SET NX PX`, optimistic DB row lock, or conditional DB update `UPDATE stock SET qty = qty - 1 WHERE qty > 0 AND sku_id = ?`). The conditional DB update is the most robust: it is atomic, survives replica restarts, and does not require a lock service.

**Patch 4 — Use `sync.Map` for the mutex map and add a cleanup sweep (reasoning-only).**
Replace `map[string]*sync.Mutex` with `sync.Map` to eliminate the concurrent-write panic. Add a background goroutine that prunes entries for SKUs not seen in the last N minutes to bound memory.

### Patched strategy snapshot

1. Add a `sync.Map` storing `*sync.Mutex` per SKU id, with a background goroutine to prune stale entries.
2. In `tryReserve`, load-or-store a mutex for the SKU, lock it, perform the read-check-decrement (in-memory or optimistic DB conditional update only — no blocking I/O inside the lock), then unlock.
3. Before decrementing, check a bounded idempotency set for the reservation ID; if present, return without decrementing.
4. If the service runs more than one replica, replace the in-process decrement with a conditional DB atomic update (`UPDATE ... WHERE qty > 0 AND sku_id = ?`) as the authoritative guard; the in-process mutex becomes an optional fast-path pre-check only.

### Verification basis

Tier 4 (explicit logical reasoning and constraint checks) — no code, tests, or commands were available. All patches are labeled reasoning-only.

---

## What to verify (stress-test checklist)

The following are the concrete checks that would either confirm the fix is sufficient or expose the remaining loopholes.

### 1. Idempotency window test
Write a test that calls `tryReserve` twice with the **same reservation ID** separated by exactly 0ms, 50ms, 100ms, 199ms, 200ms, and 250ms. Assert that stock decrements exactly once for each pair. If the decrement occurs twice at 201ms+, the fix is timing-dependent and Patch 2 (idempotency key) is required.

### 2. Concurrent-customer throughput test
Spin up N goroutines (N = 100, 500, 1000), each making a distinct reservation on the same hot SKU simultaneously. Measure latency percentiles (p50, p95, p99) and total throughput. If p99 latency climbs linearly with N, the mutex is held too long (the lock scope spans I/O). Verify by checking whether any I/O call appears between `mu.Lock()` and `mu.Unlock()` in the implementation.

### 3. Multi-replica distributed race test
Start two instances of the service pointed at the same backing store with stock = 1. Fire one reservation request at each replica simultaneously, both for the same SKU. Assert that exactly one succeeds and stock ends at 0, not -1. If both succeed, Patch 3 (conditional DB update or distributed lock) is required.

### 4. Mutex map panic test (race detector)
Run the stress test above under `go test -race`. A concurrent map-write panic or data-race report means the mutex map itself is not concurrency-safe. Fix with `sync.Map`.

### 5. Memory leak test
Run a long-lived test that cycles through 100,000 distinct SKU ids, each seen once. After the test, measure heap size. If heap grows proportionally with SKU count and never shrinks, the mutex map has no pruning and Patch 4 is required.

### 6. Verification that tests cover the actual code path
Confirm that the integration test suite exercises `tryReserve` directly (not a stub or mock). Check `go test -v ./services/inventory/...` output for test names that include "reserve" or "retry". If no such tests exist, the fix is unverified regardless of whether unit tests pass.

---

## Remaining assumptions / unknowns

- Whether the service is horizontally scaled (flips whether the in-process mutex is sufficient).
- Whether retries carry an idempotency key (determines whether Patch 2 is needed or already present).
- Whether the decrement touches a DB or is purely in-memory (determines whether Patch 3 is applicable).
- The actual implementation of `tryReserve` was not read; all loopholes above are conditioned on the described behavior being accurate.

## Likely failure modes

1. **Distributed double-decrement (most likely to be invisible in dev, catastrophic in prod)**: If the service runs more than one replica — typical for any production inventory service — the in-process mutex is invisible to other replicas. Two replicas each receive a retry leg, each pass the mutex check locally, and each decrement. Stock goes to -1. This is the highest-priority check.

2. **Timing-dependent miss**: A retry arriving at 201ms (or any time after the first request completes and the mutex is released) bypasses the protection entirely. If the 200ms window is an observation from logs and not a guaranteed upper bound, the fix will still produce occasional double-decrements under load-induced latency variation.

3. **Hot-SKU serialization causing timeout cascade**: If the lock scope includes a DB write or any blocking call, all concurrent requests for the same SKU queue behind the mutex. Under flash-sale traffic on a single SKU, the queue depth grows until callers time out, producing reservation failures that are misattributed to stock exhaustion.

## Stop reason

Pass 1 found four material loopholes. All were patched with reasoning-only evidence. Pass 2 is not warranted: no new evidence (code, tests, command output) is available to use, and running another reasoning pass over the same assumptions would not increase confidence. The strategy is now concrete enough to execute and the remaining unknowns are explicit.

## Confidence: Low

Code was not inspected; the repo does not exist on this system. All loopholes and patches are derived from the described behavior, not from observed implementation. The fix may already address some of the above (e.g., idempotency may already be implemented elsewhere), but that cannot be confirmed without reading the code. Execute the stress-test checklist above — particularly checks 1, 3, and 4 — before treating the fix as complete.
