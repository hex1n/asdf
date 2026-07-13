# S2 候选输出（first-principles-planner 工作树版，fresh-context 子代理，2026-07-13）

行为要点（对比基线）——无回归检查：
- 价值门禁 → `BUILD`，信封完整：`review_scope: implementation-authorization`、`review_budget: 校准默认（标准深度评审）`、量化收益（22 人时/月 + 监管风险敞口）与翻转条件。
- 完整 Plan 输出保留：独立方案锦标赛升级照常触发（"此处将派发"三机制族），优先级表、垂直切片验证、边界路径齐全——深度规划路径未被削弱。
- 相比基线的增量：正式 BUILD 决策 + 可直接送入 plan-review Entry Gate 的决策信封；其余行为与基线同构。

## 原文决策信封

```yaml
decision: BUILD
target_outcome: 支付回调触发的重复扣款次数降为 0，且不引入新的漏扣/丢单风险
baseline_and_frequency: 当前无幂等防护；每天几十次超时重试，上月造成 11 笔重复扣款，已触发监管口径投诉预警
expected_benefit: 可算部分 ≈ 11笔/月 × 2h = 22 人时/月的退款客诉成本；更重要的是收敛监管风险敞口
delivery_and_maintenance_cost: 标准幂等改造，预计天级工作量；约束建立后维护成本接近零
status_quo_or_existing_mechanism: 人工流程——用户已明确排除（重试发生快于人工介入窗口）
decision_flip_condition: 若该回调接口/账务表即将整体下线或替换
review_scope: implementation-authorization
review_budget: 校准默认（标准深度评审）
```
