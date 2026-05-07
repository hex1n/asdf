# Adversarial Review: FK Drop / Batch-Update / FK Recreate on 80M-Row orders Table

## Summary Verdict

This plan has at least six distinct failure modes that can corrupt data, cause extended downtime, or silently produce the wrong result. Several of them are non-obvious. None of them are protected against by the stated steps.

---

## Loophole 1: The CSV Is Not the Ground Truth

The data team produced a CSV mapping old user_id → new user_id. There is no stated process for verifying that the CSV is (a) complete, (b) current, or (c) correct.

**What can go wrong:**
- The CSV was generated at T₀. Between T₀ and the migration window, new orders were inserted. Those rows never appear in the CSV and will be silently skipped or left with a stale user_id.
- The CSV generation query may have had a bug (e.g., a JOIN that dropped NULLs, a DISTINCT that collapsed duplicates, an off-by-one in a date filter). There is no checksum or row-count reconciliation step.
- CSV encoding, quote-escaping, or leading-zero issues on user_id values (if they look numeric but are really strings) can cause silent mismatches.

**Patches:**
- Record the exact query and timestamp used to produce the CSV. Re-run it immediately before migration and diff the outputs.
- After loading, `SELECT COUNT(*) FROM orders WHERE user_id NOT IN (SELECT old_id FROM staging_table)` — any unmapped rows must be explicitly accounted for.
- Require the data team to sign off on a row count: CSV rows + unmapped rows + NULL rows must equal `SELECT COUNT(*) FROM orders`.

---

## Loophole 2: Dropping the FK Before the Update Opens a Dirty Window

The stated sequence is: drop FK → batch update → recreate FK.

During the gap between drop and recreate, the application is still running (presumably). Any write that lands during this window:
- Can insert an orders row with a user_id that does not exist in users — permanently, with no FK to catch it.
- Can insert a row with an *old* user_id that is about to be changed, creating a record that will be updated by the batch script but that the application already processed under the old ID.

**What can go wrong:**
- If the application does not go into maintenance mode *before* the FK is dropped, you get a race condition on every insert and update for the entire duration of the batch (hours on 80M rows).
- Even with maintenance mode, if any async job or cron is not blocked, you still have the race.

**Patches:**
- Enumerate every write path to orders: application, async workers, scheduled jobs, ETL pipelines, replication targets. Block all of them before the FK drop, not after.
- Consider an alternative sequence that is safer: add a shadow column `new_user_id`, populate it, then do a single atomic rename + constraint swap inside a transaction (or use a tool like pg_repack / logical replication approach).

---

## Loophole 3: The Batch Script Has No Idempotency or Resume Logic

On 80M rows, the batch will take significant time (likely hours even at 10k rows/batch). Postgres on RDS has no built-in resume. If the script dies at row 40M, re-running it from scratch will re-update rows that were already changed, potentially double-applying the mapping.

**What can go wrong:**
- If the CSV maps user_id 100 → 200, and a row has already been updated to 200, a re-run that naively reads the CSV again and issues `UPDATE ... WHERE user_id = 100` will correctly skip those rows (since no rows match 100 anymore). This sounds safe, but only if the mapping is a pure function. If there are any chained or cyclic remaps (100→200, 200→300), a partial re-run can produce wrong results.
- If the script crashes mid-batch and leaves an open transaction, RDS will hold locks until the connection drops. Depending on lock_timeout and statement_timeout settings, this can block reads as well as writes on hot pages.

**Patches:**
- Make each batch run in its own explicit transaction with a defined `lock_timeout` and `statement_timeout`.
- Log the last successfully committed batch offset (e.g., write a checkpoint to a file or a migration_log table). On restart, skip already-processed batches by reading from the checkpoint.
- Add an assertion at the top of each batch: `SELECT COUNT(*) FROM orders WHERE user_id = old_id AND ctid IN (batch_range)` must equal the expected count before the UPDATE is issued.

---

## Loophole 4: Batch Size and Lock Contention Are Not Analyzed

"Batch update" does not specify batch size, commit interval, or sleep between batches. On a live 80M-row table on RDS Postgres 14:

**What can go wrong:**
- Large batches (e.g., 100k rows) hold row-level locks for longer, increasing the chance of deadlock with application writes.
- Without a sleep between batches, autovacuum cannot keep up with the dead tuple accumulation. Table bloat will accrue. On RDS, autovacuum is constrained by `autovacuum_vacuum_cost_delay` and may fall further behind during the batch.
- If autovacuum is blocked and the table bloats significantly, query plans that rely on table statistics will degrade. Index scans on user_id can regress to sequential scans.
- On RDS, storage I/O is bounded. A batch that hammers a hot index (user_id is likely indexed for the FK) can exhaust IOPS and cause latency spikes that affect all other queries on the instance.

**Patches:**
- Profile the target batch size against a staging environment first. A common safe starting point is 1k–5k rows with a 50ms sleep between commits.
- Run `SELECT n_dead_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname = 'orders'` periodically during the migration. If dead tuples spike, pause and let autovacuum catch up.
- Pre-create a partial index `CREATE INDEX CONCURRENTLY idx_orders_user_id_migration ON orders(user_id)` if the existing FK index is not already covering the update path efficiently.

---

## Loophole 5: Recreating the FK Does Not Validate Historical Data

`CREATE CONSTRAINT ... FOREIGN KEY` on Postgres will, by default, scan every row to verify referential integrity. If any row has a user_id that does not exist in users (e.g., because a row was skipped, because a user was deleted between CSV generation and migration, or because the mapping was wrong), the constraint creation will fail.

**What can go wrong:**
- A failure at the `ADD CONSTRAINT` step leaves the table with no FK and no clear indication of which rows are bad. At 80M rows, diagnosing this under pressure is slow.
- The constraint scan itself takes an `ACCESS SHARE` lock and can take tens of minutes on 80M rows. If this was not accounted for in the maintenance window, you run over.
- If you use `NOT VALID` to skip the scan and validate later, you have a period where the FK is declared but not actually enforced — the table appears safe to application code that checks constraint metadata but is not actually safe.

**Patches:**
- Before recreating the FK, explicitly run: `SELECT o.user_id FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE u.id IS NULL LIMIT 100;` — fail fast if any orphans exist, don't let the constraint creation surface this.
- Time the constraint scan on a staging clone first. Add it to your maintenance window estimate with 2x headroom.
- If using `NOT VALID` + `VALIDATE CONSTRAINT`, document the window during which the constraint is NOT actually enforced and ensure no application code reads `pg_constraint` to make security or authorization decisions.

---

## Loophole 6: No Rollback Plan

The plan states three steps. There is no stated rollback procedure.

**What can go wrong:**
- After the batch completes but before the FK is recreated, you discover the CSV had 50k wrong mappings. Rolling back requires a reverse CSV (which does not exist), another batch run, and another validation pass. On 80M rows this is hours.
- After the FK is recreated, rolling back requires dropping the FK again, running a reverse batch, and re-adding the FK — potentially longer than the original migration.
- If the batch ran without a transaction log or checkpoint file, you cannot determine which rows were successfully updated and which were not.

**Patches:**
- Before starting, take a logical backup of the affected rows (or a full RDS snapshot). RDS automated snapshots may not be granular enough — take a manual snapshot immediately before the maintenance window.
- Pre-generate the reverse CSV from the same source data before the migration begins. Do not depend on generating it after a failure.
- Define explicit rollback decision points: if X% of batches fail, or if constraint recreation takes longer than Y minutes, execute the rollback procedure. Document what "rollback" means for each stage.

---

## What I Would Verify Before Approving This Plan

1. **CSV provenance**: exact query, row count, timestamp, and a second independent reconciliation against the database.
2. **Application write freeze**: confirmed list of all write paths to orders, with evidence each one is blocked during the migration.
3. **Staging dry-run**: full migration on a production-scale RDS clone, with timing data for each phase.
4. **Batch script code review**: idempotency, error handling, checkpointing, per-batch transaction boundaries, lock/statement timeouts.
5. **Autovacuum impact analysis**: dead tuple rate during batch on staging, with a plan for pausing if bloat exceeds threshold.
6. **Orphan pre-check query**: run and confirm zero rows before the FK is recreated.
7. **Manual RDS snapshot**: taken immediately before maintenance window opens, retention confirmed.
8. **Maintenance window math**: constraint scan time + batch time + rollback time at P99, with 2x buffer.
9. **Cyclic or chained mappings**: confirm the CSV has no cycles (A→B, B→A) or chains (A→B→C) that would cause a naive re-run to produce wrong results.
10. **Downstream systems**: any system that caches user_id→orders mappings (read replicas, Redis, data warehouse snapshots) must be invalidated or re-synced after the migration.
