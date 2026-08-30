# Rerun intake

Read this file only when verifying fixes, resuming a prior run, or executing scenarios selected from an existing `execution-report.md`. A first execution uses [FIRST-RUN.md](FIRST-RUN.md) instead.

## Preserve prior history

Read the prior run's `execution-report.md` before touching the system. Never edit that report or any attachment in place. Before creating a continuation, canonicalize its existing parent and the user-authorized workspace or output boundary; prove the parent is inside that boundary and is not reached through a symlink or traversal. Validate the proposed absent target lexically as one direct child with the required prefix and no traversal; only then create it, canonicalize the result, and re-prove the direct-child relation. Creating the directory itself is a write, so a create-then-check sequence fails this gate. Use one unique `e2e-run-<plan-name>-<timestamp>/` beside the prior run unless the user supplies another validated output path. Record the prior report as `Upstream run` and back-link both the original plan and prior run. Every generated rerun command or script must target a fresh continuation directory, never the current historical directory. Every file written into the continuation before delivery is an entry of the artifact allowlist in [REPORTING.md](REPORTING.md#fill-the-run-directory).

Carry forward:

- all `failed`, `blocked`, and `unverified` scenarios;
- every open defect and its disposition;
- the `Environment State Ledger` as the resume snapshot, including what persists and what must not be cleaned;
- prior execution overrides that still apply;
- retained entities, owner markers, TTLs, cleanup commands, and failure scenes.

Re-read the user's latest constraints and record any changed exclusions, retention policy, tool restriction, or exit criterion as a new `Execution Contract Override`. An override supersedes the matching prior or plan default; it is never reported as a failure. Open [Execution Contract Override](REFERENCE.md#execution-contract-override) only when an override exists.

## Select the continuation

Select the prior run's `failed`, `blocked`, and `unverified` scenarios plus every DAG dependent that consumed the fixed behavior. Do not rerun only the named failed scenario, because that misses fix-induced downstream regressions; do not rerun the entire plan unless the dependency graph or the user requires it.

Map the continuation set to the same plan IDs, edge IDs, variables, required capabilities, waits, isolation, side effects, and cleanup rules used by the prior run. Re-derive only mechanics invalidated by the fix, environment change, or new evidence, and record each change in the new `plan-snapshot.md` or lineage section.

Before revalidation, prove the fixed build is loaded. The deployment fingerprint must differ in the way the fix predicts — version, commit, build, start time, or a discriminating behavioral fingerprint. Reachability alone is never proof; a stale process means the fixed behavior was not reached.

A previously failed scenario flips to `passed` only when the current run satisfies its committed-state probes and retained-proof contract. Update the copied defect status in this run and back-link the new evidence; never rewrite the historical verdict.

## Rerun completion gate

Do not proceed until:

- the prior report and original plan are readable;
- the continuation set includes affected dependents and explains exclusions;
- retained state and do-not-clean items are carried into the new ledger;
- the expected fixed-build fingerprint is named;
- every selected scenario has current mechanics or an exact blocker;
- current user overrides are recorded.

Then read [EXECUTION.md](EXECUTION.md).
