# asdf — agent 循环工程

> [English](README.md) | 简体中文

一套面向本地运行时（如 **Codex** 与 **Claude Code**）的可移植**个人 agent 工作循环**——
由对本机编码会话的完整分析提炼而来，可装到任意机器、在任意项目零配置生效。
技能（skills）只是循环调用的一个组件，**循环本身才是产物**。

## 工作循环

工作循环把一个任务从接入推进到交付——**判规模 → 必要时收敛 → 落地 → 验证 → 留痕**。
默认档是轻量的：小而清楚的任务直接带判据落地；`/converge` 只用于显式要求、机制未收敛，
或不可逆/高风险改动。你明确拍板后，拍板就是执行许可；除非出现新的硬阻塞，不再自动追加
一轮方案流程。

```bash
python bootstrap/install.py        # 把循环分发到 ~/.claude 与 ~/.codex
python ~/bin/agent-doctor.py        # 安装后自检（macOS/Linux 用 python3）
```

- [`bootstrap/`](bootstrap/) — 机器级安装：工作循环 + Execution Contract 契约块、
  `/converge` `/land` `/fixloop` 命令模板、agent-doctor 自检、可选的 `.agent-workflows`
  hook、幂等安装器。
  其 [README](bootstrap/README.md) 内含**接新需求的工作流程**。
- [`docs/loop-engineering-playbook.md`](docs/loop-engineering-playbook.md) — 日常打法
  手册（六类工作、循环启动语、判停条件）。
- [`docs/execution-contract.md`](docs/execution-contract.md) — 工作循环与 Execution
  Contract 的源与双端分发说明。

## 技能 —— 循环调用的组件

技能是 [`skills/`](skills/) 下的自包含指令单元，循环在各阶段路由到它们。每个技能以
*源技能（source skill）*的形式编写一次，再作为*受管安装技能（managed installed skill）*
分发到各运行时——分发模型见 [CONTEXT.md](CONTEXT.md)。

| 技能 | 循环阶段 | 用途 |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | 收敛 | 重构根本问题，给出当前最佳方案及其失效条件。 |
| [`deep-research`](skills/deep-research/) | 收敛 | 以证据为支撑的技术调研：判断事实真相、行为成因、应得出何种决策。 |
| [`java-stack-craft`](skills/java-stack-craft/) | 落地 | 识别 JDK/Spring profile、匹配本地约定地编写与审查 Java/Spring 代码，含落地契约循环纪律。 |
| [`e2e-test-planner`](skills/e2e-test-planner/) | 验证 | 基于设计、需求与代码生成可溯源的端到端测试计划。 |
| [`e2e-test-executor`](skills/e2e-test-executor/) | 验证 | 执行端到端测试计划并产出有证据支撑的报告；驱动修复循环直至全绿。 |
| [`generating-api-docs`](skills/generating-api-docs/) | 落地/验证 | 基于代码契约生成跨 RPC 与 HTTP 协议的后端 API 文档。 |
| [`generating-test-scope`](skills/generating-test-scope/) | 验证 | 基于分支 diff 与影响追踪生成 QA 测试范围文档。 |
| [`bootstrap-agent-os`](skills/bootstrap-agent-os/) | 新项目 | 生成项目级操作层（启动路由、方向锚点、repo profile、goal loop），让循环在全新 repo 生效。 |

## 仓库结构

```
bootstrap/   # 循环本体：工作循环契约、命令模板、doctor、hook、安装器
skills/      # 循环调用的源技能（每个技能一个目录）
docs/        # loop-engineering 手册、execution-contract 规范、设计笔记
tests/       # 仓库级契约测试：安装器、契约一致性、技能结构
AGENTS.md    # 技能编写与维护约定
CONTEXT.md   # 技能分发的领域术语
CLAUDE.md    # 面向 Claude Code 的运行时指引
```

每个技能目录包含面向任务的 `SKILL.md`（含 `name` / `description` 路由 frontmatter）、
按需加载的 `REFERENCE.md` 等细节文件，以及可选的 `scripts/` 与 `tests/`。

## 测试

测试使用 Python 标准库 `unittest`，无需第三方依赖。

```bash
# 仓库级契约测试（安装器、契约一致性、技能结构）
python3 -m unittest discover -s tests

# 单个技能的测试
python3 -m unittest discover -s skills/java-stack-craft/tests

# 全部（已安装 pytest 时也可用）
python3 -m pytest
```

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
