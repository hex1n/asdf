# E2E Execution Report — 代扣结果通知 (withhold-notice)

Plan: evals/e2e-skills/real-repo/2026-06-21-withhold-notice-plan-zh.md
Plan contract version: e2e-plan/v1
Run directory: e2e-run-withhold-notice-20260621T101500/

## Execution Summary

3 scenarios selected, 3 executed: 1 `passed`, 1 `failed`, 1 `blocked`. The main
withhold-notice path produced a consistent repay-plan state and one emitted event;
the amount-mismatch callback surfaced a suspected product defect; the duplicate-callback
idempotency scenario was blocked by an unreachable settlement stub.

## Run Lineage & Emergent Scenarios

Lineage:
- Upstream plan: `evals/e2e-skills/real-repo/2026-06-21-withhold-notice-plan-zh.md` (e2e-plan/v1)
- Upstream run: none (first run)
- Downstream: WN-S2 defect investigation pending
- Status: open

Emergent scenarios discovered during this run (out of plan):

| Emergent scenario | Source trigger | Risk family | Plan section to update | Status |
|---|---|---|---|---|
| WN-E1 partial-success amount reconciliation | WN-S2 amount mismatch still advanced `result_status` | cross-step consistency | Risk Map: amount-validation consistency | proposed |

## Environment State Ledger

- Target: `POST /fund/loan/withhold/notice` @ `http://localhost:18080` (test)
- Datasource: schema `asset_loan_test` — tables `repay_plan`, `repay_apply`
- Deployment/freshness evidence: commit `0e03ed0`, build `2026-06-21T09:50`, service start `2026-06-21T10:05`; readiness `GET /actuator/health` = UP before the first scenario
- Isolation namespace: batch prefix `E2EWN-` on every created row
- Created data: 3 `repay_plan` rows under `E2EWN-`
- Cleanup policy: clean by `batch_no LIKE 'E2EWN-%'`; WN-S2 rows must not be cleaned until the defect is confirmed
- Remaining traces: `E2EWN-S2%` rows retained (owner `E2EWN-S2`, TTL 72h); 2 of 3 rows cleaned
- Tool permissions: test service token (`config/test-token`); invoke allowlist passes; no target override; direct-URL fallback available

## Run Metadata

- Plan source: evals/e2e-skills/real-repo/2026-06-21-withhold-notice-plan-zh.md
- Plan contract version: e2e-plan/v1
- Environment kind: test
- Repo commit: 0e03ed0
- Selected scenarios: WN-S1, WN-S2, WN-S3
- Started / finished: 2026-06-21T10:15:00 / 2026-06-21T10:21:30
- Status counts: passed=1, failed=1, blocked=1
- Toolchain: openjdk-17.0.10, gradle-8.5
- Cache/dependency source: local ~/.gradle, offline mode off

## Environment & Capability Map

- API: `POST /fund/loan/withhold/notice` (test base url `http://localhost:18080`)
- DB: `repay_plan`, `repay_apply` (test schema `asset_loan_test`)
- MQ: withhold-result topic via local RocketMQ stub
- Callback harness: settlement provider stub at `http://localhost:19090`
- Auth: test service token from `config/test-token`
- Cleanup: batch prefix `E2EWN-` on all created rows

## DAG Schedule

- N1 (WN-S1) ran first: independent main-path probe, parallel-safe.
- N2 (WN-S2) ran after N1: consumes `noticeNo` produced by N1.
- N3 (WN-S3) isolated last: duplicate-callback race, marked disruptive.

## Scenario Results

| Scenario | Node | Status | Evidence | Preserved scene |
|---|---|---|---|---|
| WN-S1 主路径代扣成功通知 | N1 | `passed` | evidence/index.md#wn-s1 | — |
| WN-S2 回调金额与计划不一致 | N2 | `failed` | evidence/index.md#wn-s2 | preserved-scenes/wn-s2/ |
| WN-S3 重复回调幂等 | N3 | `blocked` | evidence/index.md#wn-s3 | preserved-scenes/wn-s3/ |

## Evidence Index

Raw requests, responses, DB query results, MQ payloads, and rerun commands are bounded
in `evidence/index.md`. Each scenario block links its request/response and the committed
`repay_plan` row snapshot.

## Failures / Defects / Plan Gaps

- WN-S2 (`product defect`, suspected): callback amount `1200.00` did not match plan
  `1000.00`, yet `repay_apply.result_status` advanced to `SUCCESS`. Expected a rejection
  per `ValidatorFilterChain`. Preserved scene: `preserved-scenes/wn-s2/`.
- WN-S3 (`environment defect`): settlement provider stub unreachable; scenario needs the
  live duplicate-callback path. Blocked per plan suspend gate; not a product defect.

## Data Created & Cleanup

- Created `repay_plan` rows with batch prefix `E2EWN-`; 2 of 3 cleaned.
- WN-S2 rows retained for diagnosis (owner `E2EWN-S2`, TTL 72h, cleanup
  `DELETE FROM repay_plan WHERE batch_no LIKE 'E2EWN-S2%'`).

## Re-run Instructions

Re-run the whole selection against the test environment with:

```bash
./gradlew :hfax_loan_service:test --tests '*WithHoldNotice*' -Denv=test
```

WN-S2 alone reruns via `curl -X POST http://localhost:18080/fund/loan/withhold/notice -d @evidence/wn-s2/request.json`.

## Next Actions for Agent

- File the WN-S2 amount-mismatch as a product-defect issue against `ValidatorFilterChain`.
- Restore the settlement stub, then rerun WN-S3 to clear the block.
- Run cleanup for `E2EWN-S2%` after the defect is confirmed.
