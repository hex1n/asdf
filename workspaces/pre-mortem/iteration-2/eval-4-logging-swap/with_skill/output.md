## Final strategy

Switch logging from Winston to Pino with a drop-in adapter across ~30 services, 10 per week over 3 weeks, with the following required additions:

1. Set `messageKey: 'message'` in every Pino logger config to preserve the field name Winston consumers expect.
2. Set `timestamp: () => `,"timestamp":"${new Date().toISOString()}"`` (or equivalent) to emit `timestamp` as an ISO 8601 string, matching Winston's default format.
3. Add a custom error serializer that flattens error fields to match Winston's `{ message, stack }` top-level structure, or explicitly update all log consumers to handle Pino's `{ err: { message, type, stack } }` wrapper — as a deliberate decision, not a silent change.
4. Before rollout, grep all services for `logger.verbose(` and `logger.silly(`. Establish explicit level mappings in the adapter (e.g., `verbose` → `debug`, `silly` → `trace`) and update any alerting rules that reference these level names.
5. Add `process.on('exit', () => logger.flush())` (or use `pino.final`) in every migrated service's shutdown path to prevent log loss on process exit.
6. Add an explicit go/no-go gate between each 10-service wave: 24h observation window with pass criteria of (a) log pipeline ingest rate unchanged, (b) error-rate dashboards show no new anomalies, (c) spot-check at least 3 sampled log lines from switched services against expected JSON schema. Halt and revert the wave if any criterion fails.

## Material loopholes found

1. **`message` vs `msg` field divergence**: Winston emits `message`; Pino emits `msg` by default. Any log consumer, alert rule, or dashboard querying `message` will silently receive null after switching.

2. **`timestamp` vs `time` field divergence**: Winston emits `timestamp` as an ISO 8601 string; Pino emits `time` as epoch milliseconds by default. Downstream consumers parsing `timestamp` or expecting an ISO string will silently miss or misparse the time field.

3. **Error serialization mismatch**: Winston error logs use a flat `{ message, stack }` structure at the top level; Pino wraps errors as `{ err: { message, type, stack } }`. Error-based alerting and log parsing break silently.

4. **No wave gate**: Without a defined success criterion between rollout waves, a systematic field-mapping bug introduced in wave 1 propagates silently to all 30 services before discovery.

5. **Winston `verbose`/`silly` levels have no Pino equivalent**: If any services use these levels, they either map silently to a different severity or are dropped, breaking alert thresholds. Conditional on actual usage.

6. **Log flush on graceful shutdown**: Pino's async destination does not auto-drain on `process.exit`. Services without explicit flush calls drop terminal log lines.

## Patches made

**P1 — Field name**: Set `pino({ messageKey: 'message' })` universally. Closes loophole 1 by aligning the message field name to what consumers expect.
*Evidence basis: Pino documentation (tier 3 — established documented behavior). What remains unverified: that all logger instantiation sites use the shared config.*

**P2 — Timestamp field**: Configure `timestamp: () => \`,"timestamp":"${new Date().toISOString()}"\`` or equivalent to emit `timestamp` as ISO 8601. Closes loophole 2.
*Evidence basis: reasoning-only (Pino timestamp API is documented; exact formatter must be validated against actual output). What remains unverified: output format verified against Winston baseline.*

**P3 — Error serialization**: Add `serializers: { err: pino.stdSerializers.err }` and a `formatters.log` shim to flatten err fields, or commit to updating log consumers. Closes loophole 3.
*Evidence basis: reasoning-only. What remains unverified: exact serializer output compared against Winston baseline for the error shapes in use.*

**P4 — Level mapping**: Pre-migration grep for `verbose`/`silly`; configure explicit mappings in adapter; update alert rules. Closes loophole 5 if usage exists.
*Evidence basis: reasoning-only. What remains unverified: actual level usage in services.*

**P5 — Wave gate**: Require explicit 24h pass/fail criteria before advancing each wave. Closes loophole 4.
*Evidence basis: reasoning-only (standard release-gate practice).*

**P6 — Graceful shutdown flush**: Add `logger.flush()` to shutdown hooks in every migrated service. Closes loophole 6.
*Evidence basis: Pino documentation (tier 3). What remains unverified: flush behavior under actual process exit signals in each service runtime.*

## Verification basis

Tier 3 (established documented behavior) for Pino's `messageKey`, `timestamp`, and `pino.final` APIs. All patches are reasoning-only in the absence of code inspection or test execution — no service code, adapter source, or log consumer configuration was inspected in this session.

## Remaining assumptions / unknowns

- The "drop-in adapter" identity and its actual API coverage are unknown. If it wraps `createLogger`, `.child()`, `.add()`, and `.configure()`, it may silently no-op calls using less-common Winston API surface.
- Services are assumed to initialize loggers through a single shared module. If any service instantiates Pino directly in multiple files without the shared config, P1/P2/P3 patches will not apply there.
- Low-traffic services (e.g., one request per day) may show no anomalies in a 24h gate window even if broken; no sampled log lines will be available to spot-check.
- Total service count and whether all 30 services use logging identically is unverified.

## Stop reason

Pass 3 found no new unambiguously material loopholes beyond those already patched or flagged as conditional unknowns. Stop condition is met: no known material loopholes remain under available evidence, all patched loopholes have a verification basis (reasoning-only, labeled), unresolved assumptions are explicit, and the final strategy is concrete enough to execute.

## Confidence

**Medium** — strategy is logically coherent and all identified material loopholes are patched, but no service code, adapter source, log consumer configuration, or actual JSON output was inspected. The three field-format patches (P1, P2, P3) must be verified against actual output before wave 1 launches.
