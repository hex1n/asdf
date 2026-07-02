# 工作循环与 Execution Contract — 源与分发清单

> 目的：把**个人 agent 工作循环**（任意项目通用的推进流程）和本机会话语料分析中
> 反复口头重申的约束（"循环漏气点"——分析文档含真实业务语料，留在本机、不入公开仓；
> 可用 `docs/research/2026-07-02-analyze-sessions.py` 重跑得到聚合基线）一次性固化到
> 各运行时的启动文件里。流程是主体，契约是兜底。
> 本文件是**源**；下表列出的安装位置是**受管副本**——改这里，然后同步过去，
> 不要单独改副本（与 skill 分发同一纪律，防 Cache Drift）。
> 每条规则都过了 Rule Harvest Gate：来自 ≥2 次重复纠正或明确认可的不变量。

## 分发清单

| 安装位置 | 内容 | 说明 |
|---|---|---|
| `~/.claude/CLAUDE.md` | 工作循环 + 契约（中文块） | Claude Code 全局，任意项目生效 |
| `~/.codex/AGENTS.md` | 工作循环 + 契约（bullet 块） | Codex 全局，任意项目生效 |

项目级**不在本仓分发**：差异条目进各项目自己的启动文件（AGENTS.md / CLAUDE.md 的
Boundaries 类章节），由各仓库的 git 管理；新项目需要操作层时用 bootstrap-agent-os
生成。往任何项目补条目前，先盘点该项目已有规则、只加缺失的——工具映射
（如 MCP-vs-CLI）、git 边界、行为等价、循环上限这类规则往往已在项目层存在，
不要重复造成两处漂移。用户级契约不放工具映射（这是用户级文件自身的章程）。

## 用户级块（单一源，不在此复制）

用户级分发内容 = **工作循环（任意项目通用）+ Execution Contract**，机器可读源即人读源：

- Claude 版：[bootstrap/contract/claude.md](../bootstrap/contract/claude.md)
- Codex 版：[bootstrap/contract/codex.md](../bootstrap/contract/codex.md)

设计重心：**先流程后约束**。工作循环（判据 → 收敛 → 落地 → 排查 → 判停 → 新项目
零配置）是这套体系的主体，在任意项目、任意机器生效，不依赖项目级文件；契约只是
流程之外的兜底不变量。"缺判据先索要"已并入工作循环第 1 步，不再单列。

## 项目级差异条目模板（装入目标项目启动文件的 Boundaries 类章节）

```markdown
- Preserve run/test data by default; capture the diagnostic scene before any cleanup.
- Before landing a plan, restate the touch list (target repo/working directory plus
  files, tables, interfaces); stop and confirm before touching anything outside it.
- If a landing or debugging task lacks a machine-checkable completion criterion
  (test command, SQL assertion, expected response), ask for one before editing;
  a trivial single-file change with no data/interface impact may use a one-line
  current-vs-expected statement instead.
- Keep a project glossary: when a domain term's semantics are corrected twice,
  record the term before further landing (e.g. via a domain-modeling pass).
- Run parallel agent loops in separate git worktrees; never share one working
  directory between concurrent loops.
- When asked to commit, reuse the repo's historical commit author identity.
```

（中文启动文件用对应中文版；按目标项目已有规则裁剪，只加缺失条目。）

## 维护

- 新增规则先进本文件，写明语料证据，再分发；分发后用冷启动会话做证伪验证
  （不重申约束，诱导违规，观察默认行为）。
- 与 slash 模板（[bootstrap/commands/](../bootstrap/commands/)）里的循环契约保持同义：
  模板是"每次任务显式声明"，本契约是"不声明时的默认值"。
- 用户级分发由 [bootstrap/install.py](../bootstrap/install.py) 自动完成（合同块以标记
  幂等合并；机器可读源在 [bootstrap/contract/](../bootstrap/contract/)）；业务仓库的
  项目级条目走各仓库 git，不由安装器分发。
- **Guardian 准则的生效边界**：写在 `~/.codex/AGENTS.md` 的"Guardian 审批准则"面向
  主代理自律；要让审批代理机制化拦截，还需在 `config.toml` 的审批配置侧接入
  （官方文档口径的 reviewer 取值/`[auto_review].policy`）——机器级配置不由本仓分发，
  doctor 会自检当前取值是否在官方合法值内。审批层自带的连续拒绝熔断与任务层
  "8 轮判停"是两个独立维度，互不替代。
