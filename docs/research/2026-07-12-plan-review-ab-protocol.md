# Plan Review A/B Pilot Protocol

**问题**: evidence-gated adaptive design 是否比当前 plan-review 流程以更少调用保持相当的高风险 blocker 发现能力？  
**状态**: pre-registered before arm outputs  
**日期**: 2026-07-12

## 样本

排除候选设计自身，使用当前可读取的全部 9 个历史计划：

1. `asdf/docs/plans/2026-07-03-loop-runtime-contract-improvement.md`
2. `asdf/docs/plans/2026-07-12-plan-review-token-efficiency.md`
3. `taskloop/docs/plans/2026-07-11-criterion-vocabulary-and-state-model.md`
4. `taskloop/docs/plans/2026-07-11-trust-anchor-and-earn-red.md`
5. `taskloop/docs/plans/2026-07-11-worktree-concurrency-and-envelope-overlap.md`
6. `taskloop/docs/plans/2026-07-12-cost-efficient-taskloop.md`
7. `taskloop/docs/plans/2026-07-12-review-skill-dispatch-protocol.md`
8. `taskloop/docs/plans/2026-07-12-review-trigger-and-assurance-policy.md`
9. `taskloop/docs/plans/2026-07-12-session-scoped-hook-gate.md`

样本限制：该集合偏向 substantial/critical runtime 设计，没有足够 routine 历史计划；不得外推 routine 成本收益。

## Arm A — Current Design

- 按当前 `skills/plan-review/SKILL.md` 冻结并审查每个计划。
- full-depth 使用完整 rubric 的单次诊断 reviewer 输出，模拟 strongest reviewer 的 first pass。
- 输出完整 findings，不实施修订。
- 本 pilot 不把 fallback 当作 closing GO。

## Arm B — Candidate Design

- 先执行确定性 preflight。
- 再由一个强 primary reviewer 只审查 preflight 无法确定的开放性问题。
- 第二 reviewer 仅在 critical、inconclusive 或证据争议时触发；本轮只记录触发建议，不自动增加调用。
- 输出机械 findings 与 model findings，保持来源分离，不实施修订。

## 盲化对账

第三个 fresh-context adjudicator 只获得匿名 `Arm X` / `Arm Y` 输出和原计划，不知道哪一组是候选设计。对每个 finding 判定：

- `confirmed`：有计划或权威来源的具体证据；
- `unsupported`：证据不足或无法定位；
- `duplicate`：与同 arm 已有 finding 等价；
- `unique-material`：另一 arm 未发现且会改变方案或验证范围。

## 预注册指标

- confirmed blocker 数；
- confirmed should-fix 数；
- unsupported finding 数；
- duplicate finding 数；
- unique-material finding 数；
- reviewer invocation 数；
- token usage（仅使用 runtime 实际 telemetry；不可用时记 `unavailable`）；
- 输出字符数，作为 token 不可用时的非等价辅助指标；
- escalation trigger 数。

## 决策规则

候选设计仅在以下条件同时成立时获得 pilot 支持：

1. 没有漏掉 Arm A 的 confirmed unique blocker；
2. false/unsupported finding 不增加；
3. reviewer invocation 数减少，或在相同调用数下减少重复输出；
4. 没有依靠未执行的 escalation 才维持 blocker coverage。

若缺少人工 gold set 或精确 token telemetry，结论最高为 `provisional`，不能宣称候选设计已证明更优。
