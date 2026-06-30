# asdf-skills

> [English](README.md) | 简体中文

面向本地 agent 运行时（如 **Codex** 与 **Claude Code**）的**可移植 agent 技能**集合。

每个技能是 [`skills/`](skills/) 下一个自包含目录，包含 Markdown 指令，必要时还有仅依赖标准库的辅助脚本和测试。技能以*源技能（source skill）*的形式编写一次，再作为*受管安装技能（managed installed skill）*分发到各运行时——分发模型见 [CONTEXT.md](CONTEXT.md)。

## 技能列表

| 技能 | 用途 |
| --- | --- |
| [`bootstrap-agent-os`](skills/bootstrap-agent-os/) | 生成或审查项目级 agent 工作流操作文档：启动路由、方向锚点、repo profile、goal loop 与 evidence 结构。 |
| [`deep-research`](skills/deep-research/) | 以证据为支撑的技术调研：判断事实真相、行为成因、应得出何种决策。 |
| [`e2e-test-planner`](skills/e2e-test-planner/) | 基于设计、需求与代码生成可溯源的端到端测试计划。 |
| [`e2e-test-executor`](skills/e2e-test-executor/) | 执行端到端测试计划并产出有证据支撑的报告。 |
| [`first-principles-planner`](skills/first-principles-planner/) | 重构根本问题，给出当前最佳方案及其失效条件。 |
| [`generating-api-docs`](skills/generating-api-docs/) | 基于代码契约生成跨 RPC 与 HTTP 协议的后端 API 文档。 |
| [`generating-test-scope`](skills/generating-test-scope/) | 基于分支 diff 与影响追踪生成 QA 测试范围文档。 |
| [`java-stack-craft`](skills/java-stack-craft/) | 在识别 JDK/Spring profile、匹配本地约定的前提下编写与审查 Java/Spring 代码。 |

## 仓库结构

```
skills/      # 源技能（每个技能一个目录）
tests/       # 仓库级契约测试，校验技能结构与路由
docs/        # 设计笔记、方案、调研
AGENTS.md    # 技能编写与维护约定
CONTEXT.md   # 技能分发的领域术语
CLAUDE.md    # 面向 Claude Code 的运行时指引
```

每个技能目录包含面向任务的 `SKILL.md`（含 `name` / `description` 路由 frontmatter）、按需加载的 `REFERENCE.md` 等细节文件，以及可选的 `scripts/` 与 `tests/`。

## 测试

测试使用 Python 标准库 `unittest`，无需第三方依赖。

```bash
# 仓库级契约测试
python3 -m unittest discover -s tests

# 单个技能的测试
python3 -m unittest discover -s skills/java-stack-craft/tests

# 全部（已安装 pytest 时也可用）
python3 -m pytest
```

## 参与贡献

新增或修改技能前请先阅读 [AGENTS.md](AGENTS.md)。核心约定：

- **规则收割闸（Rule Harvest Gate）**——只有当某规则对应一次重复纠正、已观察到的失效模式，或用户明确认可的不变式时才提升为规则，并在最窄的适用层级添加。
- **`SKILL.md` 保持面向任务**——维护性指引放入 `AGENTS.md`，细节放入 `REFERENCE.md`。
- **保持可移植**——标准 Markdown 与仅依赖标准库的脚本；核心技能不引入运行时专属工作流脚本或外部依赖。
- **不要修改受管安装副本**——已安装的运行时副本须与源技能逐字节一致；个性化定制请使用本地覆盖技能（local override skill）。

技能改进遵循证据闭环（建立基线 → 命名失效模式 → 最窄改动 → 重新验证 → 依据硬闸与判定规则决策），详见 `AGENTS.md`。
