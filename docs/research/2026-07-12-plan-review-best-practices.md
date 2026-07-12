# LLM 方案审查 Skill：官方与社区研究最佳实践

**问题**: 面向已完成方案的 LLM 审查 skill，官方指南与一手研究支持什么设计？  
**深度**: Deep  
**核心结论**: 当前证据最支持“证据约束、按风险升级的 evaluator–optimizer”，不支持把 reviewer 数量、轮数或“零 finding”本身当作质量保证。  
**产物类型**: supporting  
**验证状态**: external-call tested  
**开放问题**: 3 - 见文末

## 结论

没有官方或研究界公认的“plan review skill 标准”。最接近共识的参考架构是：

1. 冻结被审对象、成功标准、rubric 与证据范围；
2. 优先运行确定性验证，再用一个强、独立、rubric 驱动的模型 reviewer 检查开放性问题；
3. reviewer 输出可定位、可证伪的结构化 findings，而不是只给分数或结论；
4. 由具备原始证据访问权的 adjudicator 逐条确认、反驳或升级；高风险争议交给人，而不是靠模型投票解决；
5. 批量修订后复核当前完整对象；
6. 用明确通过条件、重试/轮次/成本上限和边际收益条件结束，而不是无限循环到随机出现“零 finding”；
7. 记录完整 trace、模型快照、采样配置、revision、token、成本与最终处置，并用真实任务集持续校准 reviewer。

这可以概括为 **evidence-gated evaluator–optimizer with calibrated escalation**。

## 证据地图

| 设计问题 | 证据支持的做法 | 证据强度 |
|---|---|---|
| 是否使用迭代评审 | 仅当评价标准清楚，且反馈能带来可测改进时使用 evaluator–optimizer | 官方工程经验，强 |
| 是否默认多 reviewer | 不默认；只有正交维度、独立证据路径、真正需要多视角或高风险校准时增加 | 官方经验与研究反例共同支持，强 |
| Reviewer 是否能直接裁决 | 不能自证；结合确定性 grader、证据检查、人工/专家校准 | 官方 eval 指南与研究，强 |
| Finding 应如何表达 | rubric 维度、具体 claim、证据、位置、建议检查、unknown/uncertainty | 多个一手来源方向一致，强 |
| 是否循环到零 finding | 不应把零 finding 当充分条件；使用精确 gate 加资源与边际收益停止条件 | 间接但一致，较强 |
| 是否记录 token/model | 按 invocation/run 记录模型快照、请求数、输入/缓存/输出/推理 token、成本 | 官方 SDK/API，强 |
| 是否需要 exact revision | 有利于可复现和防止 stale verdict，但没有直接研究证明某种 hash schema 最优 | 工程推断，中等 |
| 是否必须先向用户展示 finding 再复核 | 可见 critique 有助于人发现缺陷；严格的展示顺序没有直接证据 | 部分支持，中低 |

## 推荐参考架构

### 1. Intake 与冻结

- 记录 candidate revision、rubric version、authority sources 和风险级别。
- Rubric 按独立维度拆分，例如正确性、可实施性、兼容性、迁移/回滚、验证、范围与安全。
- 对每个维度定义 `pass / fail / unknown`；`unknown` 必须触发补证或升级，不能被折算成 pass。
- 先确认任务与 grader 没有歧义，并保留已知可通过的 reference case。

### 2. 分层 grader，而不是纯 LLM 投票

按成本和确定性排序：

1. schema、hash、测试、依赖存在性、状态机不变量等确定性检查；
2. 一个强模型进行整体、rubric 驱动的审查；
3. 仅对高风险、争议或 reviewer 已知盲区增加第二模型、专科 reviewer 或顺序置换复审；
4. 无法由证据解决的高风险分歧升级给人。

Anthropic 的 agent eval 指南明确推荐“能确定性判断时使用确定性 grader，必要时再用模型 grader，并由人工周期校准”。单一评价层无法覆盖所有错误。

### 3. Reviewer 输出契约

每条 finding 至少包含：

```text
id
rubric_dimension
severity
claim
evidence_or_citation
affected_location
missing_check
confidence_or_unknown
```

研究表明，模型在已知错误位置时更容易修复，而自行定位推理错误更不可靠。因此 actionable finding 的关键不是篇幅，而是位置和证据精度。

### 4. Adjudication

- Adjudicator 必须重新访问原始 candidate 和 authority evidence。
- 每条 finding 分为 confirmed、rebutted、needs-evidence 或 human-escalation。
- 不以 reviewer 权威或多数票替代证据。
- Reviewer 与 adjudicator 使用不同上下文；高风险时优先不同模型族或人类专家。
- 对 pairwise 比较随机交换顺序或做 position-consistency 检查，降低位置偏差。

OpenAI 的 critique 研究支持“让 critique 帮助最终裁决者发现问题”，但没有证明另一个 LLM 能像专家一样稳定完成最终裁决。因此 parent-agent adjudication 应被视作需要校准的组件，而不是可信根。

### 5. 修订与复核

- 合并相容修改，避免一条 finding 一次完整重审。
- 局部修改先做 targeted recheck；涉及假设、接口、依赖或风险的修改做完整复核。
- Closing verdict 绑定当前完整 revision、reviewer、rubric、模型快照和 invocation trace。
- 不把“所有 reviewer 同意”当作事实正确性的替代品。

### 6. 停止与预算

推荐同时使用三类停止条件：

- **质量 gate**：没有未处置的 blocking finding，确定性检查通过，所有 unknown 已补证或升级；
- **资源 gate**：最大模型调用、token、成本或 wall-clock；
- **边际价值 gate**：新一轮未产生新的证据、finding 集合不再实质变化，或预计风险下降不值得新增成本。

预算耗尽的结果是 `suspended/inconclusive`，不是 pass。研究没有支持“更多轮单调变好”：scalable oversight 实验中，三轮相对一轮没有显著收益。

### 7. 可观测性和持续校准

每次 invocation 记录：

- candidate 与 rubric revision；
- runtime、provider、精确模型 snapshot、sampling settings；
- input、cached input、output、reasoning token；
- latency、cost、tool calls、finish reason；
- 原始 findings、adjudication、最终 disposition；
- 失败、超时、重试和 discarded 调用。

建立真实 plan 样本库，至少测量：finding precision/recall、人工认同率、遗漏 blocker、重复 finding、收敛轮数、总 token、延迟和每个有效 finding 的成本。模型升级或 rubric 修改后跑 regression suite。

## 不建议作为默认最佳实践的设计

### 默认多个同质 reviewer

多 agent 在可并行的广度搜索中可能明显增益，但 Anthropic 报告其研究系统约使用单次 chat 的 15 倍 token；对依赖共享上下文的任务未必适合。方案审查通常共享同一 candidate，重复同质 reviewer 容易产生相关错误，而不是真正独立性。

### 无限循环直到“零 finding”

LLM judge 具有随机性、位置偏差、verbosity bias 和 self-enhancement bias。零 finding 可能只是采样结果，不能单独证明方案正确。

### Reviewer 多数票作为事实裁决

多数模型可能共享训练数据、提示结构和偏差。证据、确定性检查和专家裁决比一致票数更可靠。

### 同一模型无外部证据地自我反思

研究对此存在冲突：有任务显示 self-refine 有效，也有研究显示 intrinsic self-correction 会停滞或变差。可以把它作为低成本 heuristic，但不能作为高风险 closing gate。

### 把完整 findings 全量重复塞回聊天上下文

完整审计记录应保存，但运行时应传递稳定 ID、相关 evidence slice 和必要上下文。全量复制每轮历史会增加成本并强化锚定效应。

## 与当前 plan-review 的非约束性对照

当前设计与外部基线一致的部分：exact revision、结构化 findings、parent validation、失败恢复、per-round usage、focused recheck、完整 closing review、fail-closed。

值得重新考虑的部分：

- full-depth 默认要求第二模型，外部证据更支持风险触发而非普遍强制；
- “所有 required reviewers GO”适合作为流程一致性 gate，但不是事实正确性的充分条件；
- 无用户预算时持续到 findings 不再变化，仍需要默认资源上限和边际价值停止规则；
- parent agent 尚无人工校准集，不能假设它能可靠否决或确认 reviewer；
- 每轮完整 findings 应保留在审计记录中，聊天可采用稳定索引和链接，避免重复 token；
- 应增加 reviewer bias probes、真实样本 eval suite 和人工 calibration，而不是继续增加状态字段。

## 主要来源

1. [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), 2024-12-19。
2. [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09。
3. [Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), 2025-06-13。
4. [OpenAI: AI-written critiques help humans notice flaws](https://openai.com/index/critiques/), 2022。
5. [OpenAI: Measuring model performance on real-world tasks / GDPval](https://openai.com/index/gdpval/), 2025 snapshot。
6. [OpenAI Agents SDK: Usage](https://openai.github.io/openai-agents-python/usage/), retrieved 2026-07-12。
7. [OpenAI Agents SDK: Tracing](https://openai.github.io/openai-agents-python/tracing/), retrieved 2026-07-12。
8. [Zheng et al.: Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685), 2023。
9. [Shi et al.: Judging the Judges — Position Bias](https://arxiv.org/abs/2406.07791), 2024。
10. [Du et al.: Improving Factuality and Reasoning through Multiagent Debate](https://arxiv.org/abs/2305.14325), 2023。
11. [Kenton et al.: On scalable oversight with weak LLMs judging strong LLMs](https://arxiv.org/abs/2407.04622), 2024。
12. [Huang et al.: Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798), ICLR 2024。
13. [Tyen et al.: LLMs cannot find reasoning errors, but can correct them given the error location](https://arxiv.org/abs/2311.08516), 2023。

## 来源审计

| 主张 | 来源 | 获取方式 |
|---|---|---|
| Evaluator–optimizer 只适用于清晰标准和可测改进 | Anthropic Building effective agents | 2026-07-12 fetched |
| 结合 deterministic/model/human graders，并运行多 trials | Anthropic Demystifying evals | 2026-07-12 fetched |
| Multi-agent 可能显著增益但消耗约 15× chat tokens | Anthropic multi-agent research system | 2026-07-12 fetched |
| Critique 可帮助最终裁决者发现更多缺陷 | OpenAI critiques | 2026-07-12 fetched |
| LLM judge 存在位置、冗长和 self-enhancement bias | Zheng et al.; Shi et al. | 2026-07-12 fetched |
| Debate 的额外轮数不保证提升 | Kenton et al. | 2026-07-12 fetched |
| 错误位置明确时修复更可靠 | Tyen et al. | 2026-07-12 fetched |
| Agent SDK 可按 run/request 记录 token 与 trace | OpenAI Agents SDK docs | 2026-07-12 fetched |

## 调研收口

- **已确认答案**：最佳证据支持分层验证、结构化 critique、独立 adjudication、风险升级、可观测性和有限停止条件；不支持默认堆 reviewer 或无限 review。
- **最强反例**：多 agent debate 在部分数学、事实性和广度搜索任务中确实显著提升结果，因此不能把单 reviewer 绝对化。
- **翻转条件**：若针对真实 plan-review 数据集的对照实验表明，多模型全深度循环在相同成本下持续降低漏检 blocker，推荐架构应提高默认 reviewer 数量或轮数。
- **停止原因**：官方指南、生产案例、正向研究和反向研究四条证据线已经覆盖主要设计争议；继续增加同类来源不会改变当前结论。

## 开放问题

1. 在真实软件方案审查中，一个强综合 reviewer 与多个专科 reviewer 的成本—召回率曲线如何？
2. LLM parent 对 findings 的确认准确率与专家相比是多少，哪些风险级别必须由人裁决？
3. 哪一种边际价值停止指标最能预测“再审一轮是否值得”：新证据率、finding churn、人工认可增量，还是每个有效 finding 的成本？
