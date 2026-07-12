# Evidence-Gated Plan Review A/B Pilot

**问题**: evidence-gated adaptive design 是否比当前 plan-review 流程以更少调用保持相当的高风险 blocker 发现能力？  
**深度**: Deep  
**核心结论**: 未获得支持；候选设计漏掉 4 个当前流程独有的 confirmed blockers，调用数没有下降，并产生 8 个未执行升级建议。  
**产物类型**: supporting  
**验证状态**: current-state checked  
**开放问题**: 3 - 见文末

## TL;DR

本次按照预注册的[实验协议](2026-07-12-plan-review-ab-protocol.md)，对 9 个真实历史计划运行匿名 A/B 评审，再由第三个 fresh-context adjudicator 盲化核对 findings。

盲化完成后解盲：

- Arm X：当前 `plan-review` first-pass 流程；
- Arm Y：候选 evidence-gated adaptive 流程。

候选设计未通过预注册决策规则：

1. Y 漏掉 4 个 X 独有 confirmed blockers；
2. X、Y 均有 2 个 unsupported findings 和 1 个 duplicate，Y 没有改善误报计数；
3. 两臂都是 9 次逻辑 primary review，Y 没有减少 reviewer 调用；
4. Y 对 8/9 样本建议升级但没有执行，不能用未执行升级补偿已观察到的漏检；
5. Y 输出 24,626 字符，略高于 X 的 24,111 字符，没有显示上下文输出优势；
6. runtime 未暴露精确 token telemetry，因此不能做 token 成本结论。

当前决策：**reject candidate as a replacement; continue design work on the weakest failing mechanism**。保留当前 skill，不按候选文档实施。

## 实验设置

### 样本

使用当前可读取的全部 9 个历史计划，排除候选设计自身：

- 2 个 asdf plan；
- 7 个 taskloop runtime/review plan。

样本显著偏向 substantial/critical 风险，不包含足够 routine 计划，因此本实验只能检验高风险 coverage，不能外推 routine 成本收益。

### 盲化

- X 不读取候选设计或 Y 输出；
- Y 不读取 X 输出；
- adjudicator 只读取匿名 X/Y JSON、协议和原计划；
- adjudicator 明确禁止读取候选设计或当前 plan-review skill；
- 对每个 finding 分类为 `confirmed`、`unsupported` 或 `duplicate`，再识别跨 arm 的 `unique-material` findings。

### 原始临时产物

- `/tmp/plan-review-arm-x.json`
- `/tmp/plan-review-arm-y.json`
- `/tmp/plan-review-adjudication.json`

这些是实验临时输出，不是 canonical repository artifacts；本报告保存所有决策相关统计和 unique blocker 证据。

## 汇总结果

| 指标 | X：当前设计 | Y：候选设计 |
|---|---:|---:|
| Findings | 35 | 22 |
| Confirmed | 32 | 19 |
| Unsupported | 2 | 2 |
| Duplicate | 1 | 1 |
| Confirmed blockers | 10 | 8 |
| Confirmed should-fix | 11 | 7 |
| Confirmed optional/advisory | 2 | 1 |
| Confirmed verification gaps | 9 | 3 |
| Unique-material findings | 21 | 9 |
| Primary reviewer invocations | 9 | 9 |
| Escalation suggestions | 0 | 8 |
| Escalations executed | 0 | 0 |
| Output characters | 24,111 | 24,626 |
| Token usage | unavailable | unavailable |

辅助 precision（不能替代人工 gold precision）：

- X：32/35 = 91.4% confirmed；
- Y：19/22 = 86.4% confirmed。

Y 的 finding 更少，但减少部分包含真实 blocker，不能解释为纯降噪。

## Unique Confirmed Blockers

### X 发现、Y 漏掉

#### S01-B-001 — Agent-private contract 可以扩大自身权限

计划把 touch、budget、review authority 放在同一个 agent-private contract 中，但没有把 contract mutation 限定为 owner-only，也没有其他保护。能写 contract 的 actor 可以扩大写入范围、授权或预算，从而绕过 hook 保证。

#### S03-B-001 — Review gate 接受可伪造的 reviewer 声明

计划允许调用者提交 reviewer identity、level 和 finding counts，却没有绑定 receipt、finding payload、request ID 或执行来源。同一 actor 可以制造 zero-blocking independent review 并释放 gate。

#### S07-B-001 — Review receipt 只证明自洽，不证明真实 reviewer 执行

`record-review` 接受调用者提供的 adapter/execution identity 和 finding counts，却没有 adapter-issued nonce、签名、可信通道 acknowledgement 或 request ownership 检查，因此 receipt 可以被伪造。

#### S09-B-001 — Foreign session 可通过 CLI lifecycle verbs 绕过隔离

计划阻止 foreign session 直接写 control plane，却允许其执行 `amend`、`review`、`suspend`、`abandon`、`achieve` 等会修改同一 task/control plane 的 CLI 动词，从而仍可改变或关闭 owner task。

### Y 发现、X 漏掉

#### Y01-M-B001 — 计划目标文件和验证命令位于错误仓库

计划列出的实现与测试文件在当前 owning repository 中不存在，slices 和 acceptance command 无法按文档执行。该 finding 与此前真实 plan-review 测试发现的 repository ownership drift 一致。

#### Y09-B001 — Foreign outside-write 不使 review freshness 失效

Foreign session 对物理共享 worktree 的 outside write 不增加 artifact revision；若该文件是未声明依赖，已经接受的 review 可能在 artifact 实质变化后仍被视为 fresh。

## 样本级覆盖

| 样本 | X 独有 material | Y 独有 material | X 漏 unique blocker | Y 漏 unique blocker |
|---|---:|---:|---:|---:|
| loop-runtime-contract | 2 | 1 | 1 | 1 |
| plan-review-token-efficiency | 1 | 0 | 0 | 0 |
| criterion-vocabulary/state-model | 3 | 1 | 0 | 1 |
| trust-anchor/earn-red | 1 | 0 | 0 | 0 |
| worktree concurrency | 3 | 1 | 0 | 0 |
| cost-efficient-taskloop | 3 | 2 | 0 | 0 |
| review dispatch protocol | 3 | 2 | 0 | 1 |
| review trigger/assurance | 2 | 0 | 0 | 0 |
| session-scoped hook gate | 3 | 2 | 1 | 1 |

两臂均未实现 complete unique-blocker coverage。实验不能证明 X 是最佳，只能证明 Y 尚不能替代 X。

## 原因分析

### 1. Preflight 没有降低模型调用

候选设计仍为每个计划运行一次 primary reviewer，所以两臂调用数相同。Preflight 只有在以下任一条件成立时才真正省模型成本：

- preflight 可以直接终止无需开放性判断的样本；
- preflight 能缩短 primary 输入或输出；
- primary 根据风险被完全跳过；
- preflight 替代了后续重复 reviewer，而不是叠加在其前面。

本 pilot 没有观察到这些收益。

### 2. Preflight 结果可能锚定 primary reviewer

Y 的 primary 收到 preflight 结果后再审开放问题。较少 findings 可能部分来自关注范围收窄，而非更高 precision。Y 漏掉的四个 blocker 都属于跨层授权或可信来源问题，不是简单 schema/file-existence 检查。

### 3. Adaptive escalation 只记录、不执行

Y 对 8/9 高风险计划建议升级。这说明它自身判断单 primary 不足。如果执行升级，成本会从 9 次 primary 增长到最多 17 次 reviewer invocation；如果不执行，已观察到 blocker coverage 不足。

因此当前 escalation 规则没有形成“按风险省成本”，而是形成“多数高风险样本都需要第二阶段”的延迟双 reviewer。

### 4. 样本风险分布不适合证明 routine 优势

候选架构最可能在 routine 计划上节省成本，但当前没有足够 routine 历史样本。高风险样本上的失败不能证明 routine 路径无效，但足以阻止它替代当前 full-depth 路径。

## Evolution Round

### Round 1

Supersedes: none  
Improvement magnitude: none on measured high-risk samples  
Generalization confidence: low — 9 diverse plans but all偏 substantial/critical  
Hard gates: fail — candidate missed confirmed unique blockers  
High-stakes escalation: completed — fresh anonymous arms plus blind adjudicator  
Relative delta: negative on blocker coverage; zero on invocations; token delta unavailable

Task sample:

- projects: `asdf`, `taskloop`
- baseline artifact: `/tmp/plan-review-arm-x.json`
- candidate artifact: `/tmp/plan-review-arm-y.json`
- validation artifact: `/tmp/plan-review-adjudication.json`
- protocol: [2026-07-12-plan-review-ab-protocol.md](2026-07-12-plan-review-ab-protocol.md)

Wins:

- Y 把机械 findings 与模型 findings 分开；
- Y 显式记录 escalation trigger；
- Y 总 finding 数更少。

Regressions:

- Y 漏 4 个 X 独有 confirmed blockers；
- 调用数没有下降；
- 输出字符没有下降；
- 8 个建议升级未执行，无法维持 coverage；
- confirmed ratio 低于 X。

Weakest gate or lowest-confidence claim:

- “一个 preflight-informed primary reviewer 能以更低成本维持高风险 blocker coverage”被当前输出直接反驳。

Decision: **reject as replacement; continue with a narrower redesign**。

## 下一轮建议

不要直接修改生产 skill。下一轮只验证两个更窄的机制：

1. **Preflight 不进入 primary prompt**：让 deterministic checks 与完整 blind primary review 并行，最后去重，测试是否避免 anchoring；
2. **只在 routine 路径跳过第二 reviewer**：补充至少 6 个真实 routine 计划，比较 single-primary 与当前 full-depth 的 blocker recall 和 token。

高风险路径暂时保留完整 independent review。Adaptive escalation 只有在真实 eval 能证明触发率明显低于当前 8/9 且不漏 blocker 后，才值得进入生产设计。

## 限制

- 没有人工 gold set；blind adjudicator 是独立模型证据裁决，不是 ground truth。
- 精确 token telemetry 不可用，字符数不是 token 或成本的等价替代指标。
- 两个 arm 分别在一个 collaboration subagent session 中完成 9 个逻辑 reviews；物理模型请求与 session 内部 token 未暴露。
- 样本偏向 runtime/state-machine/review assurance，高风险 finding 密度较高。
- Arm 输出使用同一模型家族，独立上下文降低锚定但不消除相关盲区。

## 开放问题

1. 在 routine 计划上，候选 single-primary 路径是否能保持 blocker recall 并减少实际 token？
2. 将 preflight 结果对 primary 隐藏，是否能保留 Y 的机械优势同时恢复跨层 blocker coverage？
3. 人工专家对 6 个 unique blockers 的 severity 和成立性是否与 blind adjudicator 一致？
