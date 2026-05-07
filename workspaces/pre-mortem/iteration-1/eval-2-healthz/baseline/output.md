# Adversarial Review: `/healthz` Endpoint with DB Ping, 2s Timeout, K8s Liveness Probe

---

## Summary of the Plan

- HTTP endpoint `/healthz` returns HTTP 200 if a DB ping succeeds within 2 seconds, 503 otherwise.
- Kubernetes liveness probe polls it every 10 seconds.

---

## Loopholes and Failure Modes

### 1. Liveness vs. Readiness Conflation

Using a DB-dependent check as a **liveness** probe is a category error. Liveness probes signal Kubernetes to **restart** the pod. If the database goes down, every pod fails its liveness probe and gets restarted in a cascade — none of which fixes the database. The correct pattern is:

- **Liveness probe**: only checks that the process itself is alive (e.g., can accept TCP connections or respond to an in-process ping with no external dependencies).
- **Readiness probe**: checks that the pod can serve traffic, including DB connectivity. K8s removes unready pods from the load balancer without restarting them.

Putting DB connectivity in a liveness probe can trigger a full rolling restart storm during any transient database outage.

---

### 2. The 2-Second Timeout Does Not Protect Against Probe Amplification

The probe fires every 10 seconds. With a 2-second timeout, if the database is slow but not timing out (e.g., 1.8s response), each probe creates a connection that holds for nearly the full interval. Under high concurrency or a degraded DB, this can saturate connection pool slots. The healthz endpoint competes directly with application traffic for DB connections — it is not isolated.

Mitigation: use a dedicated, low-privilege DB connection or a cached result with a short TTL (e.g., cache the last ping result for 5 seconds) so the probe does not hammer the pool.

---

### 3. No `failureThreshold` / `initialDelaySeconds` Specification

The plan omits K8s probe parameters beyond the interval. Without specifying:

- `failureThreshold`: K8s defaults to 3 consecutive failures before taking action. A single transient DB blip at startup can restart a pod if `initialDelaySeconds` is not set and the DB hasn't warmed up yet.
- `initialDelaySeconds` or `startupProbe`: On cold start, if the DB connection pool hasn't initialized, the probe will immediately fail. This can create a restart loop on startup before the application is ever ready.
- `timeoutSeconds`: K8s has its own probe timeout separate from your application-level 2s timeout. If they are not aligned, K8s may cancel the probe before the application returns, producing spurious 503-equivalent failures.

---

### 4. The 503 Branch Leaks Internal Error Information

When the DB ping fails, returning a bare 503 says nothing about why — but if the response body includes the error message (e.g., driver error strings, hostnames, credentials fragments), it leaks internal infrastructure topology to anyone who can reach the endpoint. The endpoint should return a generic message in the body, and log the real error internally only.

---

### 5. Endpoint Is Unauthenticated and Network-Exposed

`/healthz` is typically exposed on the same port as application traffic. If the service is internet-facing or partially exposed, an attacker can:

- Use repeated probing to map your DB health state over time (timing oracle).
- Use the 200/503 toggle as an information channel about internal infrastructure changes.
- Trigger load by hammering `/healthz` at a higher rate than K8s does, forcing repeated DB connections.

Mitigation: expose `/healthz` on a separate internal-only port (common pattern: app on 8080, metrics/health on 9090 with network policy blocking external access), or at minimum ensure the endpoint is not routable from outside the cluster.

---

### 6. Timeout Misconfiguration Can Cause Silent Hangs

A 2-second context timeout on the ping is correct in principle, but implementation details matter:

- If the timeout is applied at the HTTP handler level but the DB driver does not respect context cancellation, the goroutine/thread can hang for the full driver-level TCP timeout (often 30s+), leaking goroutines and file descriptors.
- The 2-second wall-clock timeout should be set directly on the DB connection/ping call via a context, **and** the driver must honor `context.Context` cancellation. This must be verified per driver.

---

### 7. No Rate Limiting or Circuit Breaker on the Probe Path

If an external actor (or a misconfigured internal service) hits `/healthz` at high frequency, each request initiates a DB ping. There is no described rate limit. This can degrade the very database health the endpoint is measuring. A simple in-memory rate limiter or result cache with a short TTL (3–5 seconds) prevents this without meaningfully degrading probe accuracy.

---

### 8. The Endpoint Does Not Distinguish Between Degraded and Dead

Binary 200/503 gives K8s no information about partial degradation. A DB that responds in 1.9 seconds (just under the 2s threshold) is functionally impaired but returns 200. Consider:

- Emitting response-time metrics from the probe (even as a response header or in the body) for observability.
- Using a separate slow-query warning threshold in addition to the hard timeout, surfaced through structured logging or a metrics counter.

---

### 9. Single DB Ping Is Not Representative of Real Connectivity

A TCP-level ping (e.g., `SELECT 1` or a driver ping) can succeed while the database is in a state where application queries fail — for example:

- The DB is overloaded and the lightweight ping succeeds but application queries queue and time out.
- The specific database user used for the ping has different privileges or routing than the application user.
- Read replicas are healthy but the primary (which takes writes) is down; the ping hits a replica.

The probe should use the same connection pool and credentials as the application, and ideally execute a query that exercises the actual code path (or at minimum the same pool's `Ping()` method, not a new connection).

---

### 10. Missing Observability Hooks

The plan does not describe what is logged or metered when the probe fails. Silent 503s with no structured log entry, no metric increment, and no alerting rule means a prolonged DB outage may go unnoticed until K8s has already restarted pods multiple times. At minimum, each 503 should emit a structured log entry with a distinct error code and increment a counter exposed to your metrics system.

---

## Priority Ranking

| # | Severity | Issue |
|---|----------|-------|
| 1 | Critical | Liveness probe with DB dependency causes restart storms |
| 2 | High | DB connection pool exhaustion under probe load |
| 3 | High | Missing K8s probe parameters (`failureThreshold`, `initialDelaySeconds`, `timeoutSeconds`) |
| 4 | High | Driver may not honor context cancellation → goroutine leaks |
| 5 | Medium | Endpoint exposed externally → timing oracle / resource amplification |
| 6 | Medium | No rate limiting / result caching on probe path |
| 7 | Medium | Error details potentially leaked in 503 body |
| 8 | Low | Binary health signal hides degraded-but-not-dead states |
| 9 | Low | Ping may not represent application query path |
| 10 | Low | No observability hooks on probe failures |
