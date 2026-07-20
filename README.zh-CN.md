# asdf-skills

> [English](README.md) | 简体中文

面向 Codex、Claude Code 及兼容 agent runtime 的可移植 skills，覆盖规划、调研、
文档、实现与验证等领域任务。

[`skills/`](skills/) 下的每个目录都是独立的源 skill，包含面向任务的指令，以及可选的
参考资料、脚本或模板。

## Skills

每个 skill 只维护一份源资产，并可作为受管安装 skill 分发到一个或多个 agent runtime。
相关术语见 [CONTEXT.md](CONTEXT.md)。

| 技能 | 领域 | 用途 |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | 规划 | 回到根问题，分离约束与假设并比较机制。 |
| [`plan-review`](skills/plan-review/) | 验证 | 对同一份完整的方案或计划 revision 反复独立证伪，直到所有必需 reviewer 返回 GO 或审查挂起；深度随候选风险标定，并决定 reviewer 强度。 |
| [`deep-research`](skills/deep-research/) | 调研 | 以证据为支撑的技术调研：判断事实真相、行为成因、应得出何种决策。 |
| [`project-docs-layer`](skills/project-docs-layer/) | 准备 | 审计并修复项目开工所需的最小运行文档层。 |
| [`blindspot-pass`](skills/blindspot-pass/) | 准备 | 开工前巡查陌生领域，找出用户「未知的未知」并转化为更好的提示词。 |
| [`e2e-test-planner`](skills/e2e-test-planner/) | 验证 | 基于设计、需求与代码生成可溯源的端到端测试计划。 |
| [`e2e-test-executor`](skills/e2e-test-executor/) | 验证 | 执行端到端测试计划并产出有证据支撑的报告；驱动修复循环直至全绿。 |
| [`generating-api-docs`](skills/generating-api-docs/) | 落地/验证 | 基于代码契约生成跨 RPC 与 HTTP 协议的后端 API 文档。 |
| [`generating-test-scope`](skills/generating-test-scope/) | 验证 | 基于分支 diff 与影响追踪生成 QA 测试范围文档。 |
| [`implementation-notes`](skills/implementation-notes/) | 落地 | 按已批准计划实现时维护偏差日志，把计划未预见的情况回馈给下一轮规划。 |
| [`merge-quiz`](skills/merge-quiz/) | 验证 | 就已完成的改动逐题测验用户，满分通过后才判定可合并。 |

## 生命周期定位

```
准备   project-docs-layer · blindspot-pass      ← 开工前修好文档与提示词
规划   first-principles-planner → plan-review   ← 先定方案，再证伪
实现   implementation-notes                     ← 记录对计划的每次偏离
验证   e2e-test-planner → e2e-test-executor · generating-test-scope · generating-api-docs
批准   merge-quiz                               ← 以人的理解为合并闸门
调研   deep-research                            ← 任意阶段按需触发
        ↑ 偏差与新发现的未知回馈下一轮规划
```

大多数技能保证「事情做对」；其中三个保证「人跟得上」高速的 agent 产出：
`blindspot-pass` 防止未知的未知污染提示词，`implementation-notes` 防止实现中的
临场决定消失在 diff 里，`merge-quiz` 防止批准无人理解的改动。对用户已有方案的
拷问（访谈 / grill 类技能）位于规划与评审之间，不在本仓范围。小改动、熟悉的
代码、全程盯着的会话中，这三个人机同步技能应保持沉默。

## 兼容性

这些 skills 不依赖特定编排 runtime，且每个都可独立分发。
`plan-review` 在两个宿主复用同一套可移植流程：Codex 使用已配置的第二模型 connector
或 fresh collaboration 子代理，Claude Code 使用外部第二模型或 fresh Agent 子代理；
reviewer 始终只读。

## 仓库结构

```
skills/      # 源技能与不可触发支持目录
docs/        # 设计笔记、计划与调研
AGENTS.md    # 技能编写与维护约定
CONTEXT.md   # 技能分发的领域术语
CLAUDE.md    # 面向 Claude Code 的运行时指引
```

每个技能目录包含面向任务的 `SKILL.md`（含 `name` / `description` 路由 frontmatter）、
按需加载的 `REFERENCE.md` 等细节文件，以及可选的 `scripts/` 与 `tests/`。

## 测试

修改 skill 后运行它提供的针对性检查。

## 参与贡献

新增或修改技能前请先阅读 [AGENTS.md](AGENTS.md)。核心约定：

- **规则收割闸（Rule Harvest Gate）**——只有当某规则对应一次重复纠正、已观察到的失效
  模式，或用户明确认可的不变式时才提升为规则，并在最窄的适用层级添加。
- **`SKILL.md` 保持面向任务**——维护性指引放入 `AGENTS.md`，细节放入 `REFERENCE.md`。
- **保持可移植**——标准 Markdown 与仅依赖标准库的脚本；核心技能不引入运行时专属工作流
  脚本或外部依赖。
- **不要修改受管安装副本**——已安装的运行时副本须与源技能逐字节一致；个性化定制请使用
  本地覆盖技能（local override skill）。

技能改进遵循证据闭环（建立基线 → 命名失效模式 → 最窄改动 → 重新验证 → 依据硬闸与判定
规则决策），详见 `AGENTS.md`。
