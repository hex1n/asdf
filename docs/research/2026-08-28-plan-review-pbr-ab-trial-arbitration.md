# Arbitration of unmatched findings

Every finding the mechanical oracle did not match was read against PLAN.md's
[A]/[C] facts and the candidate text. Verdicts: **seeded** (a key defect the
regex missed), **real** (a defect derivable from PLAN.md that the key did not
seed — an unseeded true positive), **unsupported** (needs a fact PLAN.md does
not state, or is optional-grade under the frozen severity scale).

## Task A

| Class | Verdict | Derivation | Found by |
|---|---|---|---|
| R-2 drops table before R-3 reads it (A-ctl-1/r1 F7) | **seeded A6** — wording "drops … and then reads … cannot be executed" missed the pattern | key A6 | A-ctl-1 r1 → its recall is 10/10, not 9/10 |
| U-A1 V-2 cap scenario unreachable | **real**, should-fix, verification | [A-1] 2%+5%+10% = 17% (≈17.8% even on the [D-3]-inflated base) never exceeds the [A-4] 25% cap, so [V-2] tests a case the design cannot produce and [D-4] is never exercised | treat-1 (r1, r2), treat-2 (r1, r2), ctl-1 (r2), ctl-2 (r1) |
| U-A2 insert/update not atomic, rerun cannot repair | **real**, should-fix, coherence | [D-2] inserts, [D-3] updates in a separate statement; [D-2]'s "if no row exists" guard means a crash between them leaves a fee row with no balance change that no rerun repairs | treat-1 (r1, r2), treat-2 (r2), ctl-1 (r2), ctl-2 (r2) |
| U-A3 R-3 reversal ignores payments made after the fee | **real**, blocker/should-fix, migration/rollback | [C-2] payments decrement `outstanding_cents`; after [D-3] a customer may pay part of the fee; [R-3] subtracts the full fee sum regardless, driving balances negative; [R-4] cannot tell which payments covered fees | treat-1 (r2), ctl-1 (r1), ctl-2 (r1) |
| U-A4 verification has no test for [A-2], [A-3], [A-5], [A-6], rollback | **real**, should-fix, verification | [V] lists only tier boundaries, the cap, a schema suite and a total-increases check | treat-1 (r2), ctl-2 (r1, r2) |
| U-A5 backfill and nightly job double-assess | **real**, should-fix, migration/rollback | [M-4] inserts with no existence check while [D-2] has one; once the table exists the 00:00 job assesses the current tier before the console backfill, so [M-4] hits the [D-1] primary key or double-charges | ctl-2 (r1) |
| tier encoding / zero-fee rows / cent rounding unspecified (A-treat-1/r1 F17) | **unsupported** — optional-grade precision under the frozen scale | — | treat-1 r1 |
| no run report, dry run, or mid-run halt (A-treat-1/r2 F17) | **unsupported** — operational wish resting on nothing in [A]/[C] | — | treat-1 r2 |
| disputed→open retroactive assessment is an unmade decision (A-treat-2/r2 F14) | **unsupported** — needs a policy fact [A] does not state; three other reviewers explicitly declined it for that reason | — | treat-2 r2 |

## Task B

| Class | Verdict | Derivation | Found by |
|---|---|---|---|
| U-B1 V-1 asserts only an upper bound | **real**, should-fix, verification | a limiter that rejects everything — which [D-2] does for rpm = 0 — passes [V-1] | treat-1 (r1) |
| U-B2 clock source for scores/`now` unspecified | **real** (minor), should-fix, coherence | [D-1] scores are "request time in milliseconds" written by six nodes ([C-1]); the plan names no clock | treat-1 (r1, r2), ctl-1 (r1) |
| U-B3 rollout has no cohort rule, promotion or abort criteria | **real**, should-fix, migration/rollback | [M-3] is calendar-driven; no signal, gate, or cohort definition | treat-1 (r1, r2), treat-2 (r1, r2), ctl-1 (r1, r2), ctl-2 (r1) |
| U-B4 M-4 deletes the only rollback target on day 14 | **real**, should-fix, migration/rollback | after [M-4] the flag-off state in [R-1] has no implementation | treat-2 (r1, r2), ctl-1 (r1, r2), ctl-2 (r1, r2) |
| U-B5 no acceptance for rpm = 0, SDK parse, detector match, EVAL | **real**, should-fix, verification | [V] checks none of the [C-2]…[C-5] contracts the design touches | treat-1 (r2), treat-2 (r2) |
| U-B6 path transition gives a tenant an empty window (≈2× rpm) | **real**, should-fix, migration/rollback | fixed-window keys ([C-1]) and sorted sets ([D-1]) are separate counters, so a flag flip mid-window starts the tenant at zero on the new path | treat-1 (r2) |

| U-B7 D-2 returns only admit/reject but D-4 needs `oldest_score` | **real**, should-fix, coherence — surfaced by judge B#1's flag; probe: grep for "only admit / second read" across all eight Task B reports | [D-2]'s atomic script returns a verdict; [D-4] computes Retry-After from the oldest score, which the plan never says how or when to read, forcing a second non-atomic round trip | treat-1 (r1, r2), treat-2 (r1), ctl-1 (r1) |

No Task B finding was unsupported by my reading. Judge B#1 additionally flags the clock-source findings (U-B2) as precision-grade rather than should-fix, and P4/REVIEWER_X F14 (flag absent / config service unreachable) as resting on unstated facts — that finding was regex-matched to seeded B6 by its D-6 anchor and "cache" wording; on reading, its core claim is the 10-minute cache lag (B6), with the unreachable-service clause as an unsupported rider.

## Corrected per-run totals (seeded 10 + real unseeded)

| Run | Seeded (union) | Unseeded real | Unsupported | Real total |
|---|---|---|---|---|
| A-treat-1 | 10 | U-A1 U-A2 U-A3 U-A4 | 2 | 14 |
| A-treat-2 | 10 | U-A1 U-A2 | 1 | 12 |
| A-ctl-1 | 10 | U-A1 U-A2 U-A3 | 0 | 13 |
| A-ctl-2 | 10 | U-A1 U-A2 U-A3 U-A4 U-A5 | 0 | 15 |
| B-treat-1 | 10 | U-B1 U-B2 U-B3 U-B5 U-B6 U-B7 | 0 | 16 |
| B-treat-2 | 10 | U-B3 U-B4 U-B5 U-B7 | 0 | 14 |
| B-ctl-1 | 10 | U-B2 U-B3 U-B4 U-B7 | 0 | 14 |
| B-ctl-2 | 10 | U-B3 U-B4 | 0 | 12 |

Treatment mean real total **14.0** (14, 12, 16, 14); control mean **13.5** (13, 15, 14, 12).
Per task: A treat 13.0 vs ctl 14.0; B treat 15.0 vs ctl 13.0 — the direction flips between tasks.

## Overlap over all real defects (Jaccard of r1 vs r2)

A-treat-1 0.86 · A-treat-2 0.92 · B-treat-1 0.75 · B-treat-2 0.86 → treatment mean **0.85**
A-ctl-1 0.77 · A-ctl-2 0.73 · B-ctl-1 0.86 · B-ctl-2 0.92 → control mean **0.82**
On seeded defects alone every run's overlap is 1.00 in both arms.
