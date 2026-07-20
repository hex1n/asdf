# E2E planner/executor routing boundary round (2026-07-17)

## Round 1

Supersedes: earlier 2026-07-17 local stopgap edit.
Improvement magnitude: clear.
Generalization confidence: low.
Hard gates: pass.
High-stakes escalation: adversarial falsification passed in a fresh-context subagent after the user authorized subagent use; no separate external CLI runtime was available (`codex` and `claude` commands were absent).
Relative delta: +1.

Task sample:
- project: `asdf-skills`
- command: manual routing check against `skills/e2e-test-planner/SKILL.md` and `skills/e2e-test-executor/SKILL.md`
- baseline artifact: prior descriptions routed broad "do/perform E2E testing" only indirectly and left the Chinese trigger `进行端到端测试` mostly outside description-level routing.
- candidate artifact: `runnable handoff` boundary in both descriptions.
- validation artifact / diff: this file plus `git diff --check -- skills/e2e-test-executor/SKILL.md skills/e2e-test-planner/SKILL.md`

Observed failure mode:
- A broad user request such as `进行端到端测试` can fire `e2e-test-executor` before a runnable plan, report, scenario, target surface, fixtures, steps, and oracles exist.

Candidate rule:
- `e2e-test-planner` produces a runnable handoff.
- `e2e-test-executor` consumes an existing runnable handoff only when the user explicitly asks to run, execute, rerun, or verify by running it.

Second-domain check:
- Fits a checkout/refund business workflow and a firmware rollout workflow: both need planner routing when coverage must be selected, and executor routing only when a plan/report/scenario is already runnable.

Routing fixture:

| User request | Expected route | Reason |
|---|---|---|
| `进行端到端测试` | `e2e-test-planner` | Broad testing request; no runnable handoff. |
| `做全链路测试，覆盖主流程和异常流程` | `e2e-test-planner` | Requests coverage selection and scenario design. |
| `给这个订单导出功能生成端到端测试场景` | `e2e-test-planner` | Scenario-generation request. |
| `执行 docs/e2e-test/export/2026-07-17-export-e2e-test-plan.md` | `e2e-test-executor` | Named existing plan plus explicit execute. |
| `重跑上次 execution-report.md 里失败的场景` | `e2e-test-executor` | Prior run report plus rerun selection. |
| `按已有场景 S-003 调 API 跑一遍验证` | `e2e-test-executor` | Concrete scenario plus verify-by-running. |
| `端到端计划我写完了，放在 docs/e2e-test/ 下` | none / clarify | Mentions a plan but does not ask to run, review, or revise it. |
| `修复失败的 E2E 测试` | none / repair flow | Product/test repair, not plan creation or execution by itself. |

Wins:
- The trigger boundary is positive and shared: `runnable handoff`.
- Chinese broad-testing phrases now sit in model-facing descriptions, not only in executor intake after the skill has already loaded.
- Executor no longer triggers merely because a plan path exists; the user must ask to execute, rerun, or verify by running.

Regressions:
- Description length increased modestly for both skills.
- Independent falsification found no blocker or major issue. One minor wording ambiguity in the executor example was tightened from broad rerun wording to `重跑已有 execution-report.md 中的场景`.

Weakest gate or lowest-confidence claim:
- Generalization confidence remains medium rather than high because the falsification pass used one fresh-context subagent, not multiple runtimes or repeated randomized route trials.

Decision:
- accept.

Adversarial falsification result:
- Verdict: GO.
- Fixture result: all 8 routing fixtures passed.
- Added adversarial cases: broad `过一遍端到端`, plan path mentioned with `先别执行`, execute wording without a handoff, prior `execution-report.md` rerun, and `verify` against a named plan.
- Findings: no blocker, no major issue; one minor ambiguity in executor rerun wording was accepted and tightened.
