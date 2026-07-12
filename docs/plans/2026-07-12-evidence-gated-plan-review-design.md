# Evidence-Gated Plan Review 最佳设计

日期：2026-07-12  
状态：candidate design；尚未实施  
依据：[官方与社区最佳实践调研](../research/2026-07-12-plan-review-best-practices.md)

## TL;DR

最佳方案不是“多 reviewer 一直审到全部 GO”，而是：

> 一个确定性控制器驱动的、证据约束且按风险升级的 evaluator–optimizer。

核心优化目标是：

```text
在 false-pass rate 不上升的前提下，
降低每个 confirmed blocker 的总 token、成本和延迟。
```

Reviewer 是缺陷搜索器，不是最终裁判；parent 是证据裁决器，不是
reviewer 的复述器；只有确定性控制器可以根据完整 gate 产生 `PASSED`。

## 根问题

方案审查需要回答四个问题：

1. 方案是否存在会导致目标失败的缺陷？
2. Reviewer 的 finding 是否真的成立？
3. 修改后缺陷是否消失且没有引入新问题？
4. 继续审查一轮的预期价值是否高于成本？

因此：

- Reviewer 共识不是正确性证明。
- `GO` 只是绑定特定 revision 的一次观测。
- “零 finding”不是充分通过条件。
- 继续评审必须由风险或新增信息的预期价值支持。

## 目标函数

在满足可审计与安全约束的前提下，最小化：

```text
关键缺陷漏检损失
+ 误报导致的返工
+ review token 和延迟成本
+ 无法审计带来的风险
```

## 参考架构

```text
                 ┌──────────────────────┐
                 │ Deterministic Control │
                 │ revision/risk/budget  │
                 └──────────┬───────────┘
                            │
                  ┌─────────▼─────────┐
                  │ Deterministic      │
                  │ preflight checks   │
                  └─────────┬─────────┘
                            │
                  ┌─────────▼─────────┐
                  │ Primary reviewer   │
                  │ defect discovery   │
                  └─────────┬─────────┘
                            │ findings
                  ┌─────────▼─────────┐
                  │ Evidence           │
                  │ adjudicator        │
                  └──────┬───────┬────┘
                         │       │
                    confirmed  disputed/high-risk
                         │       │
                  ┌──────▼───┐ ┌─▼──────────────┐
                  │ Batch fix │ │ Specialist /   │
                  │ + recheck │ │ human escalation│
                  └──────┬───┘ └─┬──────────────┘
                         └────┬────┘
                              │
                    ┌─────────▼─────────┐
                    │ Closing validation │
                    │ + stop controller  │
                    └────────────────────┘
```

控制流程的是确定性状态机，而不是某个 LLM 对“是否应该结束”的自由判断。

## 1. 冻结 Review Contract

评审开始前固定：

```yaml
candidate:
  artifact_id:
  revision_hash:

rubric:
  version:
  dimensions:
    - correctness
    - feasibility
    - compatibility
    - migration_rollback
    - verification
    - scope
    - safety

risk:
  level: routine | substantial | critical
  reasons: []

budget:
  max_model_calls:
  max_tokens:
  max_cost:
  max_revision_cycles:
  max_wall_clock:

evidence_scope:
  authority_sources: []
  deterministic_checks: []
```

Rubric、risk 或 evidence scope 后续发生变化时，显式产生新的 contract
revision，不能静默改变 closing 条件。

## 2. 确定性 Preflight

先处理不需要 LLM 判断的内容：

- artifact/hash 是否存在并稳定；
- 引用文件、接口、命令是否存在；
- schema 是否有效；
- 内部字段是否矛盾；
- 必需章节和回滚路径是否缺失；
- 可执行测试是否通过；
- 与权威来源的机械一致性。

能由代码确定的事实，不消耗 reviewer token。Preflight 失败可以直接产生机械
finding，无需调用模型。

## 3. 一个强 Primary Reviewer

默认只使用一个强、独立 reviewer。它只收到：

- candidate；
- rubric；
- decision constraints；
- authority evidence；
- deterministic preflight 结果。

不向它提供作者预期答案、主 agent 怀疑的问题、历史 reviewer 结论，或
“这是修改后的更好版本”等暗示。

Reviewer 一次性完成全维度缺陷搜索，不因发现 blocker 而提前停止：

```yaml
verdict: GO | NO_GO | INCONCLUSIVE
findings:
  - id:
    dimension:
    severity: blocker | should_fix | advisory
    claim:
    evidence:
    affected_location:
    missing_check:
    confidence: high | medium | low
```

取消 `CONDITIONAL-GO`。存在未解决条件时使用 `NO_GO` 或
`INCONCLUSIVE`，避免混淆“通过”与“尚有条件”。

## 4. Evidence Adjudication

Parent 对每条 finding 独立复核：

```yaml
finding_id:
validation:
  status: confirmed | rebutted | needs_evidence | human_escalation
  evidence:
  reason:
disposition:
  action: fix | accept_advisory_risk | defer_gap | needs_input
  owner:
```

规则：

- `confirmed blocker/should_fix` 只能修复，不能投票消除；
- `rebutted` 必须有具体证据；
- `needs_evidence` 保持开放；
- 高风险分歧交给人或专科 reviewer；
- reviewer 原始 finding 永远不可被 parent 覆写。

Reviewer 与 adjudicator 使用隔离上下文。Critical 风险优先使用不同模型族或
人类专家。

## 5. 批量修订

将相容 findings 一次性修改，减少重复完整评审。

- **Local**：只影响 finding 指向的局部内容，可以 targeted recheck。
- **Cross-cutting**：改变假设、接口、依赖、风险、权限或回滚策略，必须完整重审。

任何 material change 都产生新 revision，并使旧 closing verdict 失效。

## 6. Adaptive Escalation

第二 reviewer 不是默认步骤，只在以下条件触发：

- `critical` 风险；
- primary reviewer 返回 `INCONCLUSIVE`；
- parent 与 reviewer 对 blocker 存在证据争议；
- 涉及 reviewer 已知弱项；
- 缺陷跨越多个专业领域；
- 历史 eval 显示单 reviewer 在该任务类型漏检率过高。

第二 reviewer 应是正交角色，例如 migration、security、compatibility 或
operations/rollback specialist。不要让两个 reviewer 使用同一个泛化 prompt
重复审查。

## 7. Closing Validation

Closing review 检查完整当前 revision，而不是只看 diff。

```text
deterministic checks pass
and no open confirmed blocker
and no open confirmed should-fix
and every unknown is resolved, explicitly deferred, or human-owned
and every reviewer finding is adjudicated
and closing validation matches current revision
and no material change occurred afterward
and no invocation remains active
```

补充规则：

- 不要求“所有 reviewer 永远一致”；
- 不要求 finding 数量为 0；
- advisory finding 可以在明确 residual risk 后关闭；
- human escalation 未完成时不能通过。

## 8. 停止条件

同时使用三类停止条件。

### 质量停止

达到 closing gate 即通过。

### 资源停止

达到 model calls、token、cost、wall-clock 或 revision cycles 中任一上限即暂停：

```text
SUSPENDED_OUT_OF_BUDGET
```

预算耗尽绝不能解释为通过。

### 边际价值停止

如果连续一轮满足以下条件，暂停自动循环：

- 没有新证据；
- finding 集合只发生措辞变化；
- 相同 blocker 重复出现；
- reviewer 与 parent 的分歧无法通过现有证据解决；
- 预计新增 review 成本高于风险下降收益。

转为 `needs_input` 或 `human_escalation`，不继续消耗 token。

## 9. 风险分级默认配置

| 风险 | Reviewer 策略 | Closing | 默认自动修订轮数 |
|---|---|---|---:|
| Routine | 一个强 reviewer | 同一 reviewer 完整 closing | 1 |
| Substantial | 一个强 reviewer；争议时专科升级 | 完整 closing | 2 |
| Critical | 强 reviewer＋正交 reviewer 或人类专家 | 两条证据链完成 | 2 |
| Inconclusive | 不增加同质 reviewer | 补证或交给人 | 0 |

这些轮数是初始安全默认值，不是质量证明；后续必须根据真实 eval 数据调整。

## 10. Findings 输出策略

区分审计完整性与聊天 token。完整内容写入 immutable review record：

```text
review-record/{contract-id}/{round-id}
```

聊天默认只输出：

- verdict；
- finding 索引；
- 新增、关闭和争议 finding；
- parent validation；
- 完整记录链接。

用户明确要求完整展开时，再在聊天中显示全文。完整 trace 与用户可见输出分离，
避免把审计历史反复注入模型上下文。

## 11. Usage 与 Trace

每次 invocation 记录：

```yaml
invocation_id:
contract_id:
candidate_revision:
review_kind:
reviewer_role:
runtime:
provider:
model_snapshot:
sampling:
  temperature:
  seed:
tokens:
  uncached_input:
  cache_read:
  cache_write:
  output:
  reasoning:
cost:
latency:
result:
retry_of:
```

原则：

- 每次请求独立计量，不从累计计数重复求和；
- failed、timeout、cancelled、discarded 仍保留 receipt；
- 无 telemetry 时写 `unavailable`，不能写 0；
- 审计历史通过引用传递，不反复进入模型上下文。

## 12. 状态模型

```text
FROZEN
  → PREFLIGHT_FAILED
  → REVIEWING
  → ADJUDICATING
  → REVISING
  → CLOSING
  → PASSED

任意非终态
  → NEEDS_INPUT
  → HUMAN_ESCALATION
  → OUT_OF_BUDGET
  → REVIEWER_UNAVAILABLE
```

Reviewer 的 `GO` 不能直接映射为系统 `PASSED`。只有控制器根据完整 gate 才能
产生 `PASSED`。

## 13. Eval Suite

固定样本集至少覆盖：

- 首轮无问题的短计划；
- 含一个隐蔽 blocker；
- 大量低价值 advisory 噪声；
- 错误 reviewer finding；
- authority source 与计划冲突；
- revision 后出现新回归；
- reviewer 超时和恢复；
- primary 与 specialist 分歧；
- critical 计划需要人工升级；
- 20+ findings 的长计划。

核心指标：

```text
blocker recall
finding precision
human agreement
false-pass rate
false-block rate
duplicate finding rate
revision cycles
total tokens
cost per confirmed finding
latency
human escalation rate
```

## 方案对比

| 方案 | 缺陷召回 | 误报控制 | 成本 | 可审计性 | 结论 |
|---|---:|---:|---:|---:|---|
| 纯确定性规则 | 低 | 高 | 最低 | 高 | 无法处理开放性方案问题 |
| 单模型自我反思 | 中低 | 低 | 低 | 中 | 相关偏差严重 |
| 多 reviewer 共识循环 | 中高 | 中低 | 很高 | 中高 | 容易虚假共识和无限循环 |
| 固定 reviewer＋parent | 高 | 中高 | 中 | 高 | 接近最佳，但升级策略僵化 |
| **证据 gate＋自适应升级** | **高** | **高** | **按风险支付** | **高** | **当前最佳** |

## 最佳性检查

- **Fit criteria**：低 false-pass、证据可审计、成本随风险增长、可恢复、可实证校准。
- **Winner**：确定性控制器＋一个强 reviewer＋证据裁决＋按风险升级。
- **最接近替代方案**：固定双 reviewer＋parent validation。
- **翻转条件**：如果真实 plan eval 显示双 reviewer 在相同成本下持续显著提高 blocker recall，应提升默认 reviewer 数量。
- **边际收益停止点**：继续增加 reviewer、状态字段或审计结构，若不能在 eval 上降低 false-pass 或单位有效 finding 成本，就不再增加。

## 实施顺序

| 优先级 | 变更 | 预计工作量 | 风险 | 验证价值 |
|---|---|---:|---|---|
| P0 | 定义 contract、状态机和 closing predicate | 0.5 天 | 中 | 防止错误收口 |
| P0 | 增加 deterministic preflight 与 finding 来源区分 | 0.5 天 | 中 | 直接减少 reviewer token |
| P0 | 将 reviewer 策略改为 primary＋adaptive escalation | 0.5 天 | 中 | 验证单 reviewer 默认路径 |
| P1 | 增加三类停止条件和默认资源预算 | 0.5 天 | 中 | 防止无限循环 |
| P1 | 将完整记录与聊天输出分离 | 0.5 天 | 低 | 降低上下文消耗 |
| P1 | 收敛 receipt、manifest、ledger 的单一事实源 | 1 天 | 高 | 减少重复状态和 checker 漏洞 |
| P2 | 建立真实 plan eval suite 和人工 calibration | 2 天 | 中 | 证明质量与成本收益 |
| **Total** | | **5.5 天** | | |

每个阶段必须以真实任务对照验证；在 false-pass 没有上升且单位 confirmed
finding 成本下降前，不宣称新设计优于当前实现。

## 失败条件

以下情况会使本方案成为错误选择：

- 单 reviewer 在真实计划上的 blocker recall 明显不足；
- deterministic preflight 的维护成本超过其 token 节省；
- parent adjudicator 与 reviewer 具有高度相关偏差；
- adaptive escalation 触发器过宽，实际仍退化为默认多 reviewer；
- 审计记录与聊天分离导致用户无法及时看到关键 finding；
- 边际收益停止规则过早终止，抬高 false-pass。

出现这些证据时，优先调整 reviewer 配置、人工升级门槛和停止策略，而不是继续
增加流程字段。

## 下一步验证

先做一个不改生产 skill 的垂直实验：

1. 从历史计划中选择 routine、substantial、critical 各 3 个，共 9 个样本；
2. 同时运行当前设计和本候选设计；
3. 由盲化人工 reviewer 建立 blocker/advisory 参考集；
4. 比较 false-pass、blocker recall、finding precision、总 token、调用数和延迟；
5. 只有候选设计在 false-pass 不上升的同时降低总成本，才进入 skill 改造。
