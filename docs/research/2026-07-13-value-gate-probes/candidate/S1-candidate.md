# S1 候选输出（first-principles-planner 工作树版，fresh-context 子代理，2026-07-13）

行为要点（对比基线）：
- 模式行明确：「价值门禁判定为 `DEFER`，按流程收敛为紧凑 Decision 式答复；方案重构与独立锦标赛不运行」。
- 四机制族显式对比（现状/现有能力/人工流程调整/建设能力），经济测算含算术（回本 7-30+ 年，维护成本可能超过节省）。
- 完整决策信封 YAML；翻转条件具体；下一步验证是"查一个事实"（发现时长）而非写代码。
- 基线对比：基线方向也是"不建完整模块"但输出为完整 Plan 形态（优先级表、锦标赛对比表、行动计划、反对路径），无正式决策 token、无信封；候选有正式 DEFER 终局 + 可下传契约 + 明确不运行锦标赛。
- 长度：候选仍带支撑分析段（约基线的 2/3 长度），非最紧凑形态，但首屏已是决策+信封。
- 观察项（与 S5 重复出现）：DEFER 信封中 `review_scope: correctness-only（这是决策判断，不是实现授权）`、`review_budget: 不适用`——schema 未定义非 BUILD 决策时这两个字段的填法，模型各自即兴处理。

## 原文决策信封

```yaml
decision: DEFER
target_outcome: 缩短坏文件事故的检测/恢复时间和影响面
baseline_and_frequency: 人工 runbook 回填，2-3 次/年，每次 1-2 小时，近两年零二次事故
expected_benefit: 乐观上限每年省 2-6 工程师小时；暴露窗口收窄价值未量化，但两年证据未显示其造成下游损失
delivery_and_maintenance_cost: 一次性 40-64 小时 + 每年 4-16 小时规则维护 + 单人维护下的真实机会成本（挤占积压需求）
status_quo_or_existing_mechanism: 现有 runbook（两年可靠性证据） + "先查现成监控能否更早告警"这条更便宜的候选
decision_flip_condition: 频率/影响面明显上升；或过去的"无二次事故"其实是运气而非短暴露窗口；或"单人维护"本身升级为要解决的可用性风险；或积压清空使机会成本趋近 0
review_scope: correctness-only（这是决策判断，不是实现授权）
review_budget: 不适用（未进入建设/评审阶段）
```
