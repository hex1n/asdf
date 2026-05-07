## Final strategy

1. Generate the CSV inside a consistent database snapshot (or take a write-quiesce on `orders` before CSV generation) and record the snapshot timestamp or LSN.
2. Validate the CSV before touching the database: check row counts, verify all target `user_id` values exist in `users`, check for nulls, duplicates, and encoding issues.
3. Drop the FK constraint on `orders.user_id`.
4. Run the batch-update Python script with:
   - Idempotent, checkpointed execution (track last processed `orders.id`; skip already-updated rows on restart).
   - Index-aware batching (prefer PK-range batching over value-scan batching at 80M rows).
5. After the script completes, run a reconciliation query before proceeding: `SELECT COUNT(*) FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE u.id IS NULL` — must return 0. Also verify rows created after the CSV snapshot timestamp have valid `user_id` values under the new mapping.
6. Maintain the write-quiesce or application-level guard throughout steps 3–8 (not just through the batch update).
7. Recreate the FK as NOT VALID: `ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;` — this is near-instant and does not take a prolonged lock.
8. Run `ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;` during a low-traffic window. This takes only a `SHARE UPDATE EXCLUSIVE` lock (non-blocking to reads and writes), but the write-quiesce / app-guard must remain active until this step succeeds.
9. Release the write-quiesce / app-guard.

---

## Material loopholes found

**L1 — CSV correctness unverified before execution**
If the CSV has missing rows, stale values, or encoding errors, some `user_id` values will be updated incorrectly or left at old values. The FK recreation will either fail or silently succeed while orphaned rows remain. No verification step was described in the original plan.

**L2 — Application writes during migration window create untracked rows**
Between the FK drop and FK recreation, application writes can insert rows with arbitrary `user_id` values. These rows are not in the CSV and will not be updated by the batch script, leaving them orphaned or with stale values after the constraint is re-added.

**L3 — FK recreation under load causes prolonged exclusive lock on 80M rows**
`ALTER TABLE orders ADD CONSTRAINT ... FOREIGN KEY` without `NOT VALID` performs a full table scan under `SHARE ROW EXCLUSIVE` lock, blocking concurrent writes to `orders` for potentially minutes to hours at this scale on RDS Postgres 14.

**L4 — No idempotency or checkpoint in the batch script**
If the script crashes mid-run and is restarted from scratch, already-updated rows will be re-processed. If the mapping assumes old values, re-applying on already-updated rows corrupts data.

**L5 — Batch query performance on 80M rows without index awareness**
Batching by `user_id` value without index awareness causes sequential scans. At 80M rows this will be extremely slow and may cause lock contention.

**L6 — CSV snapshot vs. live data race (silent correctness failure)**
Rows inserted after the CSV snapshot but before the FK drop are not in the CSV. If their `user_id` values remain valid in `users` post-migration, the reconciliation query passes silently while those rows hold pre-migration (stale) `user_id` values.

**L7 — VALIDATE CONSTRAINT can fail if write-quiesce is released too early**
Releasing the write-quiesce after `ADD CONSTRAINT NOT VALID` but before `VALIDATE CONSTRAINT` allows new writes with bad `user_id` values (the `NOT VALID` flag does not block them). `VALIDATE CONSTRAINT` then fails.

---

## Patches made

**P1 (closes L1):** Add a CSV pre-flight validation step: row count check, referential check against `users`, null/duplicate/encoding checks. Add a post-script reconciliation query (`LEFT JOIN users … WHERE u.id IS NULL` must return 0) before any constraint operation.

**P2 (closes L2):** Coordinate with the application layer. Preferred: write-quiesce on `orders` starting before CSV generation (cleanest) or before FK drop (minimum). If live migration is required, add an application-level guard enforcing new FK semantics before the DB constraint is re-added. Extend the quiesce through `VALIDATE CONSTRAINT` completion (see P7).

**P3 (closes L3):** Use `NOT VALID` on FK recreation: `ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;` — completes near-instantly with no prolonged lock. Follow with a separate `ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;` during low-traffic hours using only `SHARE UPDATE EXCLUSIVE` lock (non-blocking).

**P4 (closes L4):** Make the batch script idempotent. Track a `migrated` flag per row or checkpoint the last processed `orders.id`. On restart, skip already-processed rows. Alternatively, process by `orders.id` keyset range and record the high-water mark to a durable checkpoint file.

**P5 (closes L5):** Verify that `orders.user_id` is indexed (expected given it was an FK column, but confirm via `\d orders`). Prefer PK-range batching (`WHERE id BETWEEN $low AND $high`) over value-scan batching for predictable performance on large tables.

**P6 (closes L6):** Take the write-quiesce before CSV generation, not after. This eliminates the snapshot race entirely. If the quiesce cannot start before CSV generation, validate post-script that all `orders` rows with `created_at > snapshot_time` have `user_id` values valid under the new mapping.

**P7 (closes L7):** Keep the write-quiesce / app-guard active until `VALIDATE CONSTRAINT` completes successfully. Document this explicitly in the migration runbook. Do not release access until the validation step returns without error.

---

## Verification basis

All patches are **reasoning-only (tier 4)** — no commands were executed in this session, no schema was inspected, and no RDS environment was accessed. Verification is based on:

- Documented Postgres 14 lock behavior for `ALTER TABLE … ADD CONSTRAINT FOREIGN KEY` vs. `NOT VALID` + `VALIDATE CONSTRAINT` (established documented behavior, tier 3).
- Documented behavior of `SHARE UPDATE EXCLUSIVE` vs. `SHARE ROW EXCLUSIVE` lock modes in Postgres (tier 3).
- Logical constraint analysis of batch idempotency, CSV snapshot races, and reconciliation query coverage (tier 4).

The patches have not been tested against the actual schema, CSV, or RDS instance.

---

## Remaining assumptions / unknowns

- **CSV provenance:** It is assumed the CSV was produced from a consistent query. If it was assembled from multiple queries at different times, the snapshot race (L6) is wider than assumed.
- **Application write rate:** The write-quiesce window duration is unknown. If writes to `orders` are high-frequency and a quiesce is operationally infeasible, P2/P6/P7 require an alternative application-guard design.
- **Other constraints and triggers on `orders.user_id`:** Partial indexes, check constraints, or triggers referencing `user_id` are not accounted for. These could fail independently during the migration window or be silently violated.
- **Read replicas and replication lag:** If read replicas serve application traffic during the migration, replication lag could cause them to serve stale or inconsistent `user_id` data during the batch-update window.
- **Batch chunk size:** Not specified. Chunks that are too large will cause long-running transactions, table bloat from dead tuples, and autovacuum contention. Chunks that are too small increase script overhead. Typical safe range for a table this size is 1,000–10,000 rows per commit.
- **Postgres autovacuum behavior during batch updates:** 80M row updates will generate substantial dead tuple volume. Autovacuum may not keep pace, causing table bloat and query plan degradation during the migration window. Consider running `VACUUM` manually after the batch completes and before `VALIDATE CONSTRAINT`.

---

## Stop reason

Pass 3 found no new material loopholes in the fully patched strategy. All identified material loopholes have patches with a stated verification basis. Remaining items are unknowns and minor risks that do not invalidate the patched strategy on their own. Stop condition met.

---

## Confidence: Medium

The patched strategy is logically coherent and all material loopholes have been addressed. Confidence is medium rather than high because: (1) no schema, CSV, or RDS environment was inspected — the actual `orders` table structure, existing indexes, and application write patterns are unverified; (2) the `NOT VALID` + `VALIDATE CONSTRAINT` approach is well-documented for Postgres but has not been confirmed against this specific RDS configuration; (3) the write-quiesce feasibility is an unknown that could force a more complex alternative design.
