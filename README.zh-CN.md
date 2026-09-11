# asdf-skills

> [English](README.md) | 简体中文

面向 Codex、Claude Code 及兼容 agent runtime 的可移植 skills 与用户级工具。

[`skills/`](skills/) 下的每个目录都是独立的源 skill，包含面向任务的指令，以及可选的
参考资料、脚本或模板。

## Skills

每个 skill 只维护一份源资产，并可作为受管安装 skill 分发到一个或多个 agent runtime。
相关术语见 [CONTEXT.md](CONTEXT.md)。

| 技能 | 领域 | 用途 |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | 规划 | 从根问题出发做规划或决策：分离约束与假设、比较机制，给出当前最佳路径及其失败条件和下一步检查；也回答值不值得做，以及对刚给出建议的质疑。 |
| [`assayer`](skills/assayer/) | 审查 | 对同一份完整的方案或计划 revision 独立证伪：仅审查模式一轮完整审查后以 GO、NO_GO 或 SUSPENDED 结束；用户要求修订时进入审查并修订模式，在同一最终 revision 上迭代，直到所有必需 reviewer 返回 GO 或审查挂起。深度随候选风险标定，并决定 reviewer 强度。 |
| [`deep-research`](skills/deep-research/) | 调研 | 以证据为支撑的调研，交付书面结论而非修复：判断事实真相、行为成因、证据支持哪个选项。 |
| [`arborist`](skills/arborist/) | 实现 | 在已有调用方、存储数据或测试需要继续工作的代码上实现、修复、重构或迁移，或落地已裁决的方案；交付改动并附上受影响契约仍成立的证据，按要求改善结构，按风险选择验证。 |
| [`scrutineer`](skills/scrutineer/) | 审查 | 用有证据的反例审查代码与变更，区分缺陷、未验证风险、待决事项和可选改进；只读报告，不代替实施修复。 |
| [`e2e-test-workflow`](skills/e2e-test-workflow/) | 验证 | 规划、执行并呈现端到端测试：可溯源的业务场景树、把缺陷交回调用方另行授权修复的证据化执行报告，明确要求时才做有上限的直至全绿循环，以及 HTML 阅读视图。开头带 `plan`、`run` 或 `render` 时选定模式：plan 出计划并渲染；run 执行并渲染，无计划时先规划；render 只渲染已有产物。 |
| [`generating-api-docs`](skills/generating-api-docs/) | 落地/验证 | 基于代码契约生成跨 RPC 与 HTTP 协议的后端 API 文档，范围可为单个接口、一个需求的后端 API 或一个分支的 API 变更。 |
| [`generating-test-scope`](skills/generating-test-scope/) | 验证 | 基于分支 diff 与影响追踪生成 QA 测试范围文档。 |
| [`rationale-records`](skills/rationale-records/) | 导航 | 维护和反查 Git 忽略的个人当前代码理由，并提供严格源码锚点与 worktree 交接。 |

## 各 skill 背后的方法论

每个 skill 都只落在少数几个成熟方法论上，而不是一套自创风格。知道它用的是什么方法论，才能解释它为什么坚持某一步，也知道扩展时该去查什么。

### `first-principles-planner`

- **第一性原理推理**：先分清真约束、惯例与未验证假设，再从根问题出发。
- **Five Whys（丰田）**：用于单一解法形状的请求；系统性问题则沿业务、技术、历史、运维四条根追溯。
- **价值门禁**：以现状为基线，与复用现有能力、改流程、改系统比较，值得做才进入设计。
- **方案锦标赛与反演思维（Jacobi，经 Munger 推广）**：比较本质不同的机制，再问赢家在什么条件下最差、落地后还剩多少问题。
- **预注册（实验科学）与显式停止规则（Simon 的满意化）**：Bestness Check 在推荐前写下评判标准、最强替代、被击败条件和边际收益停止点。

### `assayer`

- **波普尔证伪**：由独立 reviewer 攻击方案，第二模型作为对同模型盲区更强的证伪者。
- **失效关闭（安全工程的 fail-closed）**：精确门禁遇到缺失或不一致就不通过，不存在近似通过。
- **按后果定严重度**：只由后果决定，不由评审成本决定。
- **Perspective-Based Reading（Basili）**：full depth 时让一名 reviewer 以"值班运维"视角走读，A/B 实验把视角收窄到唯一值回成本的那个。
- **Decision Envelope**：技术判定与价值决策分开，评审不重算价值。

### `deep-research`

- **证据层级**：一手来源优先于非一手来源。
- **三角验证**：结论经多条独立证据通道交叉印证。
- **强推断（Platt；Chamberlin 的多重工作假设）**：让竞争解释并存，直到区分性检查把它们分开。

### `arborist`

- **契约式思维**：把改动定义为可观察结果、须保住的行为和区分成败的证据；修 bug 的预言机独立于缺陷本身。
- **变更影响分析（Bohner & Arnold）**：沿真实入口追踪生产者与消费者，区分源码可达与实际走到的路径。
- **遗留代码工作法（Feathers）**：特征化测试保住现有行为；接缝只为已证明的变化而设。
- **深 Module（Ousterhout）**：把大块内聚的复杂度藏在小接口后面，接口写全调用方必须知道的一切。
- **DRY 的原义（Hunt & Thomas）**：一条规则只有一个权威所有者，调用方只用不复制。
- **演进式重构模式（Fowler 目录）**：并行变更、抽象分支、绞杀者、扩展-迁移-收缩，以旧路径删除为退出。
- **增量交付**：每个切片前先验证会让它出错的承重假设，切片可验证，中间状态对调用方和数据始终有效。
- **按风险选择验证**：需要时加变异分析（DeMillo）和独立审查。

### `scrutineer`

- **波普尔证伪，双向**：先用反例挑战实现，再找能推翻候选发现的证据。
- **契约式审查**：挑战对象是受威胁的需求或兼容契约，而非历史行为本身。
- **后果与置信分离的严重度**：按后果判定，与证据强度无关。
- **问题与修法分别验证**：缺陷成立不等于修法保住了契约。
- **证据绑定被审版本**：每条发现都能在被审版本上复现。

### `e2e-test-workflow`

- 规划
  - **基于模型的测试设计（Ammann & Offutt）**：对输入空间（Base-Choice、Pairwise）、状态图、决策逻辑施加覆盖准则；复合规则的每个独立条件各欠一条义务，判定条件思想取自 MC/DC。
  - **独立预言机**：期望结果权威与实现证据分离。
  - **变更影响分析（Bohner & Arnold）**：沿共享写者、读者、调用方与订阅者追踪变更可达的路径。
- 执行
  - **RIPR 模型的骨架**：每个场景写明可达的触发、传播到系统级结果、有界的可观测完成谓词。
  - **按易失性顺序采证（数字取证）**：易失的失败现场在重试或清理前先采集。
  - **PROV 式溯源**：计划、运行、产物仅凭产物即可重建。
  - **显式的 SUT 边界**：声明每个真实依赖与替身。
- 呈现
  - **单一事实来源**：Markdown 为正本，HTML 是经核对的投影。

### `generating-api-docs`

- **契约式设计（Meyer）与信息隐藏（Parnas）**：只写调用方契约，不写实现。
- **目标契约**：写意图中的外部契约，不写当前缺陷。

### `generating-test-scope`

- **变更影响分析（Bohner & Arnold）**：从 diff 出发沿调用方、依赖、状态读写和跨进程契约追踪影响图。
- **风险驱动测试（Amland）**：按失败后果、可达暴露面和恢复难度分级。
- **建议映射到证据**：每条建议都指明它依据的证据。

### `rationale-records`

- **切斯特顿的栅栏**：在看似自然的重写抹掉它之前，先记下代码为什么是这个精确形状。
- **DRY 的原义（Hunt & Thomas）**：一条不变量只有一个当前所有者。
- **锚定反查索引**：从源码片段反查到理由，每个锚点在文件内唯一命中。

## 生命周期定位

```
规划   first-principles-planner → assayer       ← 先定方案，再证伪
实现   arborist                                 ← 先追根系，再做最小安全改造
审查   scrutineer                            ← 证伪实现，也核实发现；只读报告
验证   e2e-test-workflow（plan → run → render）· generating-test-scope · generating-api-docs
调研   deep-research                            ← 按需求证
        ↑ 新发现的未知回馈下一轮规划
```

这些技能保证「事情做对」。对用户已有方案的拷问（访谈 / grill 类技能）位于
规划与评审之间，不在本仓范围。

## 兼容性

这些 skills 不依赖特定编排 runtime，且每个都可独立分发。
`assayer` 在两个宿主复用同一套可移植流程：fresh-context reviewer 使用 runtime 的只读
agent 能力，second-model reviewer 使用 runtime 提供的只读第二模型能力，可用性在冻结时
一次判定并记录；reviewer 始终只读。

`e2e-test-workflow` 在两个宿主中都由模型自动触发；手动输入时开头的 `plan`、`run`
或 `render` 选定模式：Claude Code 用 `/e2e-test-workflow plan …`，Codex 用
`$e2e-test-workflow plan …`。它取代已退役的 `e2e-test-planner` 与 `e2e-test-executor`；
装过这两个名字的机器，只删除链接目标写着本仓库 `skills/` 目录的那两条安装链接（目标已不存在，
看链接本身记录的路径），保留真实目录和指向别处的链接，然后重新运行安装器。

`scrutineer` 可独立调用，也可交给实现流程中的 fresh-context reviewer 使用。
它负责代码审查，`arborist` 负责实施，`assayer` 负责方案/计划评审；三者均无强制依赖。

## 仓库结构

```
skills/      # 源技能，每个目录一个 skill
tools/       # 可移植的用户级 agent 工具
scripts/     # 安装器与契约检查
docs/        # 调研笔记与计划（仅本机，Git 忽略）
evals/       # 评测运行产物（仅本机，Git 忽略）
tests/       # check-all 运行的测试套件（仅本机，Git 忽略）
AGENTS.md    # 跨运行时共用仓库约定
CONTEXT.md   # 技能分发的领域术语
CLAUDE.md    # 面向 Claude Code 的运行时指引
```

每个技能目录包含面向任务的 `SKILL.md`（含 `name` / `description` 路由 frontmatter）、
按需加载的 `REFERENCE.md` 等细节文件，以及可选的 `scripts/` 与仅本机的 `tests/`。

## Agent 工具

[可移植 Java formatter](tools/java-formatter/) 与
[rationale-records skill](skills/rationale-records/) 内的脚本为 Codex 和 Claude Code 共用一个 Stop Hook。
业务仓库可以在 `docs/rationale` 下保存 Git 忽略的个人记录，但不保存 formatter/checker 执行器、运行时 Hook 或 rationale 状态。

    node scripts/install-agent-tools.mjs
    node scripts/install-agent-tools.mjs --apply
    node scripts/check-java-formatter.mjs
    node scripts/check-rationale-records.mjs

安装器把 formatter 链接到 `~/.agents/tools`、完整 rationale skill 链接到
`~/.agents/skills`，合并全局运行时配置时保留已有 Hook 和其他设置。

## 测试

遵循 [AGENTS.md](AGENTS.md#verification-and-completion) 中的验证要求。

## 参与贡献

仓库工作开始前阅读 [AGENTS.md](AGENTS.md)。它统一定义 skills 与工具的源码归属、
可移植性、编写和验证要求。创建和改进 skill 使用当前运行时官方的 `skill-creator`，
措辞与信息组织使用 `writing-for-agents`。仓库特有的约束继续由 `AGENTS.md` 定义。
