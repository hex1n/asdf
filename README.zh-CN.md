# asdf — agent 循环工程

> [English](README.md) | 简体中文

一套面向本地运行时（如 **Codex** 与 **Claude Code**）的可移植**个人 agent 工作循环**——
由对本机编码会话的完整分析提炼而来，可装到任意机器、在任意项目零配置生效。
技能（skills）只是循环调用的一个组件，**循环本身才是产物**。

## 工作循环

工作循环把一个任务从接入推进到交付——**判规模 → 必要时收敛 → 落地 → 验证 → 留痕**。
默认档是轻量的：小而清楚的任务直接带判据落地；`converge` skill 只用于显式要求、
机制未收敛，或不可逆/高风险改动。你明确拍板后，拍板就是执行许可；除非出现新的
硬阻塞，不再自动追加一轮方案流程。

```bash
node bootstrap/install.mjs         # 把循环分发到 ~/.claude 与 ~/.codex
node ~/bin/agent-doctor.mjs         # 安装后自检
```

- [`bootstrap/`](bootstrap/) — 机器级安装：工作循环契约卡
  （源在 [`bootstrap/contract/`](bootstrap/contract/)；Claude 侧装为 user rule，
  Codex 侧合并进 AGENTS.md）、agent-doctor 自检、可选的 `.agent-loop` hook、
  幂等安装器。其 [README](bootstrap/README.md) 内含**接新需求的工作流程**、
  分发清单与维护纪律。

## 技能 —— 循环调用的组件

技能是 [`skills/`](skills/) 下的自包含指令单元，循环在各阶段路由到它们。每个技能以
*源技能（source skill）*的形式编写一次，再作为*受管安装技能（managed installed skill）*
分发到各运行时——分发模型见 [CONTEXT.md](CONTEXT.md)。

| 技能 | 循环阶段 | 用途 |
| --- | --- | --- |
| [`converge`](skills/converge/) | 收敛 | 显式或高风险未收敛决策的只读方案收敛。 |
| [`workloop`](skills/workloop/) | 落地/验证 | 唯一的工作环：判据溯源（given/recovered/absent）→ 开 taskloop 任务 → 改-验-审-修 → 停在明确终态。 |
| [`judgment-loop`](skills/judgment-loop/) | 落地/验证 | 品味类交付物的评分表环：先注册 rubric 再动笔，fresh-context 评审，人验收。 |
| [`meta-loop`](skills/meta-loop/) | 元层 | 循环自身的改进环：loop-health 指标、候选收割、每轮一个证据闸改动。 |
| [`first-principles-planner`](skills/first-principles-planner/) | 收敛 | 重构根本问题，给出当前最佳方案及其失效条件。 |
| [`deep-research`](skills/deep-research/) | 收敛 | 以证据为支撑的技术调研：判断事实真相、行为成因、应得出何种决策。 |
| [`java-stack-craft`](skills/java-stack-craft/) | 落地 | 识别 JDK/Spring profile、匹配本地约定地编写与审查 Java/Spring 代码，含落地契约循环纪律。 |
| [`e2e-test-planner`](skills/e2e-test-planner/) | 验证 | 基于设计、需求与代码生成可溯源的端到端测试计划。 |
| [`e2e-test-executor`](skills/e2e-test-executor/) | 验证 | 执行端到端测试计划并产出有证据支撑的报告；驱动修复循环直至全绿。 |
| [`generating-api-docs`](skills/generating-api-docs/) | 落地/验证 | 基于代码契约生成跨 RPC 与 HTTP 协议的后端 API 文档。 |
| [`generating-test-scope`](skills/generating-test-scope/) | 验证 | 基于分支 diff 与影响追踪生成 QA 测试范围文档。 |
| [`bootstrap-agent-os`](skills/bootstrap-agent-os/) | 新项目 | 生成项目级操作层（启动路由、方向锚点、repo profile、goal loop），让循环在全新 repo 生效。 |

`skills/loop-core/` 是 loop skills 的共享支持目录，不是可触发技能。

## 仓库结构

```
bootstrap/   # 机器安装：工作循环契约、doctor、hook、安装器
skills/      # 源技能与不可触发支持目录
docs/        # 设计笔记、计划与调研
tests/       # 仓库级契约测试：安装器、契约一致性、技能结构
AGENTS.md    # 技能编写与维护约定
CONTEXT.md   # 技能分发的领域术语
CLAUDE.md    # 面向 Claude Code 的运行时指引
```

每个技能目录包含面向任务的 `SKILL.md`（含 `name` / `description` 路由 frontmatter）、
按需加载的 `REFERENCE.md` 等细节文件，以及可选的 `scripts/` 与 `tests/`。

## 测试

bootstrap 运行时脚本使用 Node 内置 `node:test`，其余仓库与技能契约使用 Python 标准库
`unittest`；无需第三方依赖。CI（[`.github/workflows/tests.yml`](.github/workflows/tests.yml)）
在每次 push 与 pull request 上以 Node + Python 双运行时跑全量测试。

```bash
# Node bootstrap 契约测试（安装器、doctor）
node --test tests/bootstrap_install.test.mjs tests/agent_doctor.test.mjs tests/agent_loop.test.mjs tests/e2e_report_check.test.mjs

# Node taskloop（净室 v2）测试
node --test taskloop/tests/taskloop.test.mjs

# Python 仓库级契约测试（契约一致性、技能结构）
python -m unittest discover -s tests

# 单个技能的测试
python -m unittest discover -s skills/java-stack-craft/tests
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
