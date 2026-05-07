# Adversarial Review: `tryReserve` Double-Decrement Fix

**Date:** 2026-05-07  
**Scope:** Proposed fix for double-decrement race condition in `services/inventory/src/reservation.go`  
**Fix as described:** Wrap the stock decrement in a `sync.Mutex` keyed by SKU id.

---

## Note on Code Inspection

The repository at `~/code/inventory` does not exist on this machine. This review is based entirely on the described fix and the general architecture it implies. All findings are derived from the fix description and common patterns in Go inventory services.

---

## Summary Verdict

The proposed fix is **necessary but not sufficient**. It addresses one symptom of the race condition but leaves open several high-severity gaps. Shipping it as-is will reduce (not eliminate) the double-decrement rate and may introduce new failure modes under load.

---

## Finding 1: Per-SKU Mutex Does Not Protect the Read-Modify-Write Sequence

**Severity: Critical**

A mutex keyed by SKU id protects the decrement operation in isolation, but a double-decrement typically arises from a check-then-act race:

```
goroutine A: read stock=1 → check passes → [preempted]
goroutine B: read stock=1 → check passes → decrement → stock=0
goroutine A: resumes     → decrement → stock=-1
```

If the mutex only wraps the `stock--` line (or its equivalent), both goroutines still pass the guard check before either holds the lock. The lock must span the **entire read-check-decrement** sequence atomically, not just the write. Verify that the mutex critical section begins before the availability check and ends after the write (or database commit).

---

## Finding 2: The "200ms Retry Window" Suggests Idempotency Is the Real Fix

**Severity: High**

The fact that the bug manifests only when a customer retries within 200ms points to a missing idempotency key, not primarily a missing mutex. If the client sends two requests with the same reservation intent (e.g., same cart ID or order ID), the correct fix is to deduplicate on a request token before touching stock at all — a mutex will still decrement twice if two distinct goroutines each hold a different lock acquisition slot.

What to verify:
- Is there an idempotency key (reservation ID, request UUID, or order token) in the request?
- Is that key stored and checked in a cache (Redis, in-memory TTL map) before entering `tryReserve`?
- If the same key arrives twice, does the second call return the first result without re-decrementing?

Without idempotency, the mutex merely serializes two decrements rather than eliminating the second one.

---

## Finding 3: Per-SKU Mutex Map Has Its Own Race Condition

**Severity: High**

A "mutex keyed by SKU id" is almost always implemented as a `map[string]*sync.Mutex` plus a global lock or `sync.Map`. A naive implementation introduces a second race:

- Two goroutines concurrently calling `tryReserve` for a new SKU may both evaluate "no entry exists" and both create a new mutex entry, meaning they each acquire a different lock object — giving zero mutual exclusion.

Verify:
- Mutex map access is protected (a `sync.Mutex` protecting the map itself, or `sync.Map`, or a third-party shard-lock library).
- Mutex objects are not leaked: entries for SKUs that are no longer active should be pruned; an unbounded map will grow forever in a long-running service.
- The map lookup, insert-if-absent, and lock acquisition are all inside the same critical section.

---

## Finding 4: Mutex Does Not Cover Persistence — Database Is the Authoritative State

**Severity: High**

If stock is persisted in a database (PostgreSQL, MySQL, etc.) and the service runs multiple instances (horizontally scaled), an in-process `sync.Mutex` provides zero protection across pods. Two replicas will each hold their own mutex, independently read the same stock value, and both decrement.

What to verify:
- Is there a database-level check constraint or `UPDATE ... WHERE stock > 0 RETURNING stock`?
- Is there a distributed lock (Redis `SET NX`, Postgres advisory lock, or equivalent)?
- Is the decrement done with an atomic SQL `UPDATE inventory SET stock = stock - 1 WHERE sku = ? AND stock > 0` and the affected-row-count checked?

If the service is single-instance only, document that constraint explicitly in a comment and in the deployment runbook; a future horizontal scale-out will silently reintroduce the bug.

---

## Finding 5: No Mention of Rollback on Reservation Failure

**Severity: Medium**

If `tryReserve` decrements stock and then a subsequent step (payment authorization, database commit, downstream call) fails, is stock restored? Without a compensating increment or a transactional boundary, a failed reservation permanently removes stock from availability. The proposed mutex does nothing for this.

Verify:
- `defer` or explicit rollback increments stock on all error paths after decrement.
- Integration tests cover the "decrement succeeded, commit failed" path.

---

## Finding 6: Context Cancellation Can Cause Silent Decrement

**Severity: Medium**

Go HTTP handlers cancel their `context.Context` when the client disconnects. If the 200ms retry is a client-side timeout causing a reconnect, the first request's context may be cancelled mid-flight. Verify:

- The function checks `ctx.Err()` before and after acquiring the mutex.
- A cancelled context causes the function to return without decrementing — or to compensate if the decrement already occurred.
- The mutex is not held across a context-sensitive I/O call (database write), which would block all other reservations for the same SKU while the cancelled goroutine waits on the network.

---

## Stress-Testing Checklist

### Functional Correctness

- [ ] **Concurrent same-SKU reservations:** Fire N goroutines simultaneously with the same SKU and stock=1; assert exactly one success and N-1 failures, and that final stock is 0 (not negative).
- [ ] **Retry simulation:** Send two identical requests for the same reservation within 200ms; assert only one decrement occurs.
- [ ] **Idempotency key reuse across restarts:** If the service restarts between retry attempts, does the idempotency cache survive (or is that acceptable)?

### Race Detector

- [ ] Run the full test suite with `go test -race ./...`. A mutex-map race will surface here immediately.

### Negative-Stock Guard

- [ ] Assert that stock never goes below 0 under any concurrent workload; treat a negative value as a Critical alert in production.

### Multi-Instance / Distributed

- [ ] Run two instances against the same database with a shared SKU at stock=1; assert only one reservation succeeds.
- [ ] If the service is intentionally single-instance, add a startup assertion or leader-election guard.

### Load / Throughput Regression

- [ ] Benchmark `tryReserve` before and after the fix; a global or coarse-grained mutex will serialize all SKU operations, cratering throughput for high-velocity SKUs.
- [ ] Verify that lock contention does not cause goroutine pile-up (monitor goroutine count under load).

### Timeout and Cancellation

- [ ] Inject a 150ms artificial delay inside the critical section; verify that concurrent callers queue rather than panic or deadlock.
- [ ] Cancel the context while the mutex is held; verify stock consistency after cancellation.

---

## Recommended Corrective Steps (Priority Order)

1. Widen the mutex critical section to cover the read-check-decrement sequence atomically.
2. Add an idempotency key layer above `tryReserve` so duplicate requests never reach the decrement path.
3. Harden the mutex map against its own race (double-checked locking or `sync.Map`).
4. Replace or supplement the in-process mutex with a database-level atomic decrement (`UPDATE ... WHERE stock > 0`) so correctness does not depend on single-instance deployment.
5. Add rollback logic for all post-decrement failure paths.
6. Run `go test -race` in CI as a required gate.
