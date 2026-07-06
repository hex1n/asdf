# Criterion Adapter Contract

The done-when criterion is the loop's only sensor. Hand-written checks have
three known correctness traps, observed in real loops rather than imagined:

1. **Vacuous pass** — a check like "all reported items passed" passes when a
   required item is missing from the report entirely.
2. **Stale green** — the evidence predates the current build/state, so the
   check passes on yesterday's world.
3. **Collapsed verdicts** — "cannot adjudicate" (evidence absent, malformed,
   stale) gets reported as pass or as failure, sending the loop body the
   wrong next move.

A **criterion adapter** is a read-only checker whose interface makes those
traps unrepresentable. This file is the socket; adapters are the plugs, and
new plugs are built only when a real criterion-writing failure warrants one.

## Interface requirements

Any adapter pluggable into the stop gate must satisfy all of:

- **Read-only and idempotent.** The gate re-runs the criterion on every stop;
  the adapter must never mutate state or trigger the evidence producer.
- **Explicit required set.** The caller names the required items as arguments
  (e.g. `--require-passed <ids>`). A listed item missing from the evidence is
  a failure, never a vacuous pass; an unlisted item never gates.
- **Three-way exit code.**
  - exit 0 — every required item passed on fresh evidence;
  - exit 1 — a required item failed or is missing (fix the work);
  - exit 2 — cannot adjudicate: evidence absent, malformed, or stale
    (regenerate the evidence; do not touch the work). Exit 2 exists so the
    loop body can tell "the code is wrong" from "the proof is missing".
- **Freshness fingerprint.** When evidence derives from a build, artifact, or
  dataset, the adapter compares the evidence's recorded fingerprint against
  the current one; a mismatch is exit 2, not a pass. An explicit opt-out
  (e.g. `--no-freshness`) is allowed only when there is nothing to
  fingerprint.
- **Failing items named in the output tail.** The gate re-injects only the
  output tail as feedback; the adapter's last lines must name which required
  item failed and why, not just a count.

## Seed implementation

`e2e-report-check.mjs` (installed to `~/bin`) is the reference plug: required
scenario set via `--require-passed`, loaded-build fingerprint for freshness,
exit 0/1/2 exactly as above. Born from two observed defects in a hand-written
E2E criterion (a vacuous `all(passed)` and a stale-report green), not from
speculation — see `docs/research/2026-07-03-backend-loop-dogfood-harvest.md`.

## Two-domain fit

The same socket shapes a data-reconciliation adapter without modification: the
required set is the assertion list, the freshness fingerprint is the dataset
or migration snapshot id, exit 2 covers "the reconciliation query cannot run
or targets a stale snapshot". No such adapter ships today; this sketch exists
to keep the contract generic, and the adapter gets built when a real
reconciliation loop produces its first trapped criterion.
