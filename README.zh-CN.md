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
| [`first-principles-planner`](skills/first-principles-planner/) | 规划 | 回到根问题，分离约束与假设并比较机制。 |
| [`assayer`](skills/assayer/) | 验证 | 对同一份完整的方案或计划 revision 反复独立证伪，直到所有必需 reviewer 返回 GO 或审查挂起；深度随候选风险标定，并决定 reviewer 强度。 |
| [`deep-research`](skills/deep-research/) | 调研 | 以证据为支撑的技术调研：判断事实真相、行为成因、应得出何种决策。 |
| [`arborist`](skills/arborist/) | 实现 | 实现与重构现有代码，保住受影响行为，改善代码与架构，并按风险选择验证方式。 |
| [`code-reviewer`](skills/code-reviewer/) | 审查 | 用有证据的反例审查代码与变更，区分缺陷、未验证风险和可选改进；只读报告，不代替实施修复。 |
| [`e2e-test-workflow`](skills/e2e-test-workflow/) | 验证 | 规划、执行并呈现端到端测试：可溯源的业务场景树、驱动修复循环直至全绿的证据化执行报告、HTML 阅读视图。开头带 `plan`、`run` 或 `render` 时选定模式：plan 出计划并渲染；run 执行并渲染，无计划时先规划；render 只渲染已有产物。 |
| [`generating-api-docs`](skills/generating-api-docs/) | 落地/验证 | 基于代码契约生成跨 RPC 与 HTTP 协议的后端 API 文档。 |
| [`generating-test-scope`](skills/generating-test-scope/) | 验证 | 基于分支 diff 与影响追踪生成 QA 测试范围文档。 |
| [`rationale-records`](skills/rationale-records/) | 导航 | 维护和反查 Git 忽略的个人当前代码理由，并提供严格源码锚点与 worktree 交接。 |

## 各 skill 背后的方法

每个 skill 都只落在少数几个成熟方法上，而不是一套自创风格。知道它用的是什么方法，才能解释它为什么坚持某一步，也知道扩展时该去查什么。

| Skill | 方法 |
|---|---|
| `first-principles-planner` | 第一性原理：回到根问题（对"解法形状"的请求用 Five Whys），把真约束与惯例、未验证假设分开；带反演测试的方案锦标赛；先过 Value Gate 判断值不值得做，再设计；预先登记的 Bestness Check 与可执行的停止点。 |
| `assayer` | 波普尔证伪：由独立 reviewer 攻击方案，第二模型作为对同模型盲区更强的证伪者；失效关闭的精确门禁，不存在近似通过；严重度只由后果决定，不由评审成本决定；full depth 时让一名 reviewer 以"值班运维"视角走读——Perspective-Based Reading（Basili）经 A/B 实验收窄到唯一值回成本的那个视角；Decision Envelope 把技术判定与价值决策分开。 |
| `deep-research` | 证据层级（一手与非一手来源）、多条独立证据通道的三角验证、强推断（Platt；Chamberlin 的多重工作假设）：让竞争解释并存，直到区分性检查把它们分开。 |
| `arborist` | 可观察契约与变更影响追踪；深 Module（Ousterhout）与特征化测试（Feathers）；通过兼容迁移和旧路径删除完成重构；按风险选择验证，在需要时加入定向变异和独立审查。 |
| `code-reviewer` | 基于契约的双向证伪：用反例挑战实现，再核对能推翻候选发现的证据；严重度与证据强度分离；分别验证问题与修法；证据绑定被审版本。 |
| `e2e-test-workflow` | 规划：基于模型的测试设计——对输入空间（Base-Choice、Pairwise）、状态图、决策逻辑三个模型施加覆盖准则，复合规则的每个独立条件各欠一条义务（Ammann & Offutt；判定条件思想取自 MC/DC）；预言机独立于实现，期望结果权威与实现证据分离；变更爆炸半径。执行：RIPR 模型——可达与感染对应可控性，传播与揭示对应可观测性；按易失性顺序采集证据（数字取证）；PROV 式溯源，使计划、运行、产物仅凭产物即可重建；显式的 SUT 边界，声明每个真实依赖与替身。呈现：Markdown 为正本，HTML 是经核对的投影。 |
| `generating-api-docs` | 契约式设计与信息隐藏（Parnas）：只写调用方契约，不写实现；写目标契约，不写当前缺陷。 |
| `generating-test-scope` | 基于依赖追踪的变更影响分析、基于风险的测试优先级、每条建议都映射到证据。 |
| `rationale-records` | 切斯特顿的栅栏——在看似自然的重写抹掉它之前，先记下代码为什么是这个精确形状；一条不变量只有一个当前所有者；从源码到理由的锚定反查索引。 |

## 生命周期定位

```
规划   first-principles-planner → assayer       ← 先定方案，再证伪
实现   arborist                                 ← 先追根系，再做最小安全改造
审查   code-reviewer                            ← 证伪实现，也核实发现；只读报告
验证   e2e-test-workflow（plan → run → render）· generating-test-scope · generating-api-docs
调研   deep-research                            ← 按需求证
        ↑ 新发现的未知回馈下一轮规划
```

这些技能保证「事情做对」。对用户已有方案的拷问（访谈 / grill 类技能）位于
规划与评审之间，不在本仓范围。

## 兼容性

这些 skills 不依赖特定编排 runtime，且每个都可独立分发。
`assayer` 在两个宿主复用同一套可移植流程：Codex 使用已配置的第二模型 connector
或 fresh collaboration 子代理，Claude Code 使用外部第二模型或 fresh Agent 子代理；
reviewer 始终只读。

`e2e-test-workflow` 在两个宿主中都由模型自动触发；手动输入时开头的 `plan`、`run`
或 `render` 选定模式：Claude Code 用 `/e2e-test-workflow plan …`，Codex 用
`$e2e-test-workflow plan …`。它取代已退役的 `e2e-test-planner` 与 `e2e-test-executor`；
装过这两个名字的机器，只删除链接目标写着本仓库 `skills/` 目录的那两条安装链接（目标已不存在，
看链接本身记录的路径），保留真实目录和指向别处的链接，然后重新运行安装器。

`code-reviewer` 可独立调用，也可交给实现流程中的 fresh-context reviewer 使用。
它负责代码审查，`arborist` 负责实施，`assayer` 负责方案/计划评审；三者均无强制依赖。

## 仓库结构

```
skills/      # 源技能与不可触发支持目录
tools/       # 可移植的用户级 agent 工具
scripts/     # 安装器与契约检查
docs/        # 设计笔记、计划与调研
AGENTS.md    # 跨运行时共用仓库约定
CONTEXT.md   # 技能分发的领域术语
CLAUDE.md    # 面向 Claude Code 的运行时指引
```

每个技能目录包含面向任务的 `SKILL.md`（含 `name` / `description` 路由 frontmatter）、
按需加载的 `REFERENCE.md` 等细节文件，以及可选的 `scripts/` 与 `tests/`。

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
