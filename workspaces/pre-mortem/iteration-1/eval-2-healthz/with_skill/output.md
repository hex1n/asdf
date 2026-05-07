## Final strategy

Add a `/healthz` HTTP endpoint that:
1. On each request, pings the database with a 2-second timeout.
2. Returns HTTP 200 if the ping completes successfully within 2s.
3. Returns HTTP 503 if the ping fails or times out.
4. Is configured as the K8s liveness probe target, polled every 10s.

---

## Material loopholes found

**L1 — Liveness ≠ Readiness: restarting a healthy pod that cannot reach a broken DB**
A liveness probe is meant to detect that the process itself is stuck/deadlocked. If the database is down or unreachable, the app process is still alive and healthy; it simply cannot serve traffic. Returning 503 on a DB failure causes K8s to kill and restart the pod continuously (CrashLoopBackOff or rapid restart loop), which does not fix the DB and actively degrades the service (restarts drain connection pools, flush in-flight state, and cause unnecessary downtime). This fails the success condition: the cluster is less available, not more, when the DB is unhealthy.

**L2 — Thundering-herd on probe interval vs. timeout ratio**
With a 2s timeout and the probe hitting every 10s, every pod in the deployment issues a real DB ping on every probe cycle. Under a fleet of N pods, this adds N pings/10s to the DB. If the DB is slow (approaching the 2s timeout), all probes will pile up simultaneously, potentially tipping the DB from slow to unavailable — turning a partial degradation into a full outage. This is a concrete scenario where the strategy worsens the system state it is trying to detect.

**L3 — No failureThreshold / periodSeconds configuration stated; K8s will use defaults**
K8s liveness probe defaults are `failureThreshold: 3` and `periodSeconds: 10`. With a 2s DB timeout and a 10s period, three consecutive slow DB pings (6s total DB time over 30s) will kill the pod. Under normal load spikes where DB latency briefly exceeds 2s, this fires spuriously. Without explicit `failureThreshold` and `timeoutSeconds` values in the probe spec, the behavior is non-deterministic across K8s versions and cluster defaults.

**L4 — Goroutine/thread leak if ping timeout is not enforced at the HTTP handler level**
If the DB client's ping respects the 2s context timeout but the HTTP server has a longer (or no) write deadline, a slow DB response can hold the handler goroutine open for longer than 2s, allowing probe connections to accumulate. This is especially sharp at the probe interval: with 10s polling and goroutines that can live up to the server's read/write timeout, the endpoint can become a goroutine accumulation point under DB degradation.

**L5 — 503 is not the correct HTTP status for a probe that K8s uses as a binary alive/dead signal**
K8s liveness probes trigger pod restart on any non-2xx response. Returning 503 is semantically correct for "service unavailable" but practically identical to 500 or 404 from K8s's perspective. This is minor in isolation but becomes material in conjunction with L1: the semantics of the status code reinforce the misuse of liveness for availability signaling.

---

## Patches made

**P1 — Split into liveness and readiness probes (closes L1, L5)**
- `/healthz/live` (liveness): returns 200 if the process can handle requests (no DB check). Typically checks only that the process is not deadlocked (e.g., a trivial in-memory flag or just responds at all).
- `/healthz/ready` (readiness): performs the DB ping with a 2s timeout. Returns 200 if the ping succeeds, 503 otherwise. Configure this as the K8s `readinessProbe`, not `livenessProbe`. When not ready, K8s removes the pod from service endpoints but does not restart it — correct behavior when the DB is down.
- What changes: liveness probe no longer depends on DB reachability.
- Why it closes the loophole: K8s will stop sending traffic to an unready pod without restarting it, preserving the pod's state and connection pool while the DB recovers.
- Evidence basis: reasoning-only, consistent with K8s documented probe semantics (liveness = restart-me, readiness = route-traffic-to-me).
- Remaining unverified: the actual deployment spec; the patch requires the team to update `livenessProbe` and add `readinessProbe` in the manifest.

**P2 — Add result caching / rate-limiting to the readiness ping (closes L2)**
- Cache the last DB ping result for a short interval (e.g., 5s) and serve the cached result to subsequent probe calls within that window. Only issue a real DB ping if the cache has expired.
- Why it closes the loophole: limits DB probe traffic to at most 1 ping per 5s regardless of fleet size, eliminating the thundering-herd amplification.
- Evidence basis: reasoning-only.
- Remaining unverified: cache TTL should be shorter than the readiness probe `periodSeconds` to avoid always serving stale data.

**P3 — Set explicit probe fields in the K8s manifest (closes L3)**
Add to the `readinessProbe` spec:
```yaml
readinessProbe:
  httpGet:
    path: /healthz/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3        # slightly above the handler's 2s DB timeout
  failureThreshold: 2
  successThreshold: 1
```
Set `timeoutSeconds: 3` (one second slack above the 2s handler timeout) so K8s does not time out the probe before the handler has a chance to return 503 cleanly. Set `failureThreshold: 2` to tolerate one transient DB hiccup before marking unready.
- Evidence basis: reasoning-only.

**P4 — Enforce per-request context timeout at the handler level (closes L4)**
In the HTTP handler, derive the DB ping context from the incoming request context with an explicit 2s deadline:
```go
ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
defer cancel()
err := db.PingContext(ctx)
```
Also set the HTTP server's `WriteTimeout` to at least 3s (matching the K8s `timeoutSeconds`) so the handler can always write the response before the server kills the connection.
- Evidence basis: reasoning-only.

---

## Verification basis

All patches are **reasoning-only (tier 4)** — no code was inspected, no commands were run, no existing implementation was read. The analysis is based on K8s probe semantics as documented, standard HTTP server behavior, and logical constraint reasoning. Confidence is limited accordingly.

---

## Remaining assumptions / unknowns

- **Unknown: language / framework.** The implementation language and HTTP framework are not stated. The goroutine/thread leak vector (L4) and the caching pattern (P2) look different in Go vs. Node.js vs. Python. The patches are described generically.
- **Unknown: DB client library.** Whether `PingContext` (or equivalent) propagates context cancellation correctly depends on the driver. Some drivers ignore context on ping. This needs verification.
- **Unknown: existing liveness/readiness probe configuration.** If the service already has liveness/readiness probes, P1 requires coordinated manifest changes. If not, it is additive.
- **Unknown: fleet size.** L2's thundering-herd severity scales with the number of pods. For a single-pod deployment it is minor; for a 50-pod deployment it is material. P2 should be applied if fleet size > ~5 pods.
- **Assumption: DB ping is a lightweight operation.** If `db.Ping()` opens a new connection rather than borrowing from a pool, it can be expensive and may not reflect the health of the pool. Verify that the DB client's ping borrows from the pool.
- **Assumption: K8s version ≥ 1.16.** Readiness probe semantics are stable since 1.0; liveness/readiness split is well-established. No version risk assumed.

---

## Stop reason

Pass 1 found 5 loopholes (L1–L5); all material ones (L1–L4) were patched. Pass 2 attacks the patched whole: with the liveness/readiness split (P1), the DB-down scenario no longer causes restarts; with caching (P2), thundering herd is mitigated; with explicit probe fields (P3), spurious failures from K8s defaults are eliminated; with handler-level timeout (P4), goroutine accumulation is bounded. No new material loophole is introduced by the patches. L5 is rendered moot by P1 (503 on the readiness endpoint is correct and does not trigger restarts). Stop condition met: no known material loopholes remain, all patches have a stated verification basis (reasoning-only), unknowns are explicit, and the patched strategy is concrete enough to implement.

---

## Confidence: Medium

Strategy is logically coherent, all material loopholes are patched, and the patched design aligns with K8s documented probe semantics. Confidence is not High because no code, manifest, or DB client implementation was inspected — the patches are entirely reasoning-only, and the DB client's context-cancellation behavior (the most implementation-specific risk) is unverified.
