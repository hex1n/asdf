# Loop Runtime Contract 改进计划

日期：2026-07-03

## TL;DR

当前最佳改进不是继续扩写全局 `AGENTS.md` / `CLAUDE.md`，也不是新增第二个
`loop-state.json`。最佳路径是把现有 `.agent-loop/run-contract.json` 升级为
**唯一 runtime contract**：同一个文件同时承载目标、边界、预算、会话归属、终态、证据和审查结果。

目标状态：

- `.agent-loop/run-contract.json` 是当前 agent loop 的唯一事实源。
- hook 负责强制执行边界、git 授权、session 绑定、判据闸门和终态流转。
- doctor 负责发现 schema 漂移、legacy 配置、陈旧 active state 和风险配置。
- docs 只解释语义，不成为第二套执行逻辑。
- 全局启动文件保持短，只保留跨项目稳定契约。
- 并发默认不共享工作区；同一目标分支的多 session 并行优先用独立 worktree。

## 根问题

Loop engineering 要解决的不是“让 agent 多跑几轮”，而是：

> agent 在无人持续盯着时，仍然能在可验证边界内推进、知道何时停止、留下可恢复状态，并且不会把越界、耗尽、卡住或自我声明误报为成功。

现有设计已经有 run contract、Stop hook、criterion、session binding、git 授权和 doctor 检查，但仍有三个结构性缺口：

1. 旧 runtime schema 的语义仍偏“写入范围清单”，没有完整表达 loop 状态。
2. 多 session 只能靠“单 session 绑定”粗暴防并发，缺少显式并发模型。
3. 终态、预算、安全边界、review verdict 还没有成为机器可查字段。

## 设计原则

1. **单一事实源**
   不新增长期并行的 `loop-state.json`。所有 runtime 状态都进入 `.agent-loop/run-contract.json`。

2. **默认独占，显式并发**
   同一 worktree 默认只允许一个 writer session。并行推荐使用独立 worktree。共享 worktree 并发必须显式声明 `partitioned`。

3. **终态不可混淆**
   `success`、`noop`、`blocked`、`stalled`、`exhausted` 必须分开。预算耗尽或同错重复不能叫成功。

4. **证据先于声明**
   完成声明必须由 criterion、测试输出、diff/status、review verdict 或其他真实工具结果支撑。

5. **安全预算进入 contract**
   网络、安装脚本、destructive 操作、git 操作、secret 暴露都应是显式字段，不靠长 prompt 记忆。

6. **v2-only，显式重建**
   保留 `run-contract.json` 文件名和 CLI 入口，但不兼容旧 v1 字段。旧文件由 doctor/validate 明确报错，使用 `init --force --steal --reason <why>` 重新生成 v2 contract。

## Runtime Contract 目标 Schema

`run-contract.json` 继续放在 `.agent-loop/`，仍是 gitignored 的 agent 私有运行状态。

```json
{
  "version": 2,
  "status": "active",
  "terminal_state": "active",
  "goal": "Implement the approved loop runtime contract improvements.",
  "criterion": "node --test tests/agent_loop.test.mjs tests/agent_doctor.test.mjs",
  "enforcement": "strict",
  "unknown_write_policy": "deny",
  "touch": {
    "files": ["bootstrap/bin/agent-loop.mjs", "tests/agent_loop.test.mjs"],
    "tables": [],
    "interfaces": [],
    "git": {
      "allowed_ops": ["add", "commit"],
      "reason": "User explicitly requested commit after validation"
    }
  },
  "budget": {
    "max_iterations": 8,
    "max_git_ops": 2,
    "network_allowed": false,
    "network_allowlist": [],
    "install_scripts_allowed": false,
    "destructive_allowed": false,
    "secrets_policy": "deny_env_dump"
  },
  "session": {
    "mode": "exclusive",
    "owner_session_id": "session-1",
    "started_at": "2026-07-03T00:00:00Z",
    "updated_at": "2026-07-03T00:00:00Z"
  },
  "evidence": {
    "proved": [],
    "missing": [],
    "contradicted": [],
    "last_failure": null,
    "iteration": 0
  },
  "review": {
    "required": false,
    "verdict": "skipped",
    "blocking_count": 0,
    "findings": [],
    "evidence": null
  },
  "concurrency": {
    "mode": "exclusive",
    "integrator_session": null,
    "claims": []
  }
}
```

兼容规则：

- 只接受 `version: 2`。
- 旧 `version: 1` 清单不做自动迁移，避免双 schema 长期并存。
- 新逻辑只扩展 `run-contract.json`，不引入新的 active state 文件。

## 并发模型

### 1. `exclusive`，默认模式

适用：绝大多数落地、排查、文档和配置任务。

规则：

- active contract 绑定一个 `owner_session_id`。
- owner 可以写 touch 范围内目标。
- 其他 session 只能读或审查，不能写，不能执行 git 写操作。
- 接管必须显式 `--force --steal --reason <why>`。

### 2. `worktree fan-out`，推荐并行模式

适用：多个 session 处理同一目标分支的不同范围。

机制：

- 每个 writer 在独立 worktree 或临时分支里运行。
- 每个 worktree 有自己的 `.agent-loop/run-contract.json`。
- 一个 integrator session 负责合并、解决冲突、跑全局 criterion。
- 目标分支只作为集成面，不作为共享写现场。

这是默认推荐的社区最佳实践，因为它天然隔离文件系统、git index、构建产物和未提交状态。

### 3. `partitioned`，显式共享工作区模式

适用：用户明确要求多个 session 在同一 checkout、同一分支上并行写，并且范围可机器切分。

示例：

```json
{
  "concurrency": {
    "mode": "partitioned",
    "integrator_session": "s0",
    "claims": [
      {
        "session_id": "s1",
        "role": "writer",
        "files": ["bootstrap/**"],
        "criterion": "node --test tests/agent_loop.test.mjs",
        "state": "active"
      },
      {
        "session_id": "s2",
        "role": "writer",
        "files": ["tests/**"],
        "criterion": "node --test tests/bootstrap_install.test.mjs",
        "state": "active"
      }
    ]
  }
}
```

硬规则：

- 同一文件不能被两个 active writer claim。
- singleton 文件必须独占，包括 `package.json`、lockfile、全局配置、迁移、生成物、`AGENTS.md`、`CLAUDE.md`。
- 每个 writer 只能写自己 claim 的文件范围。
- `git add/commit/push/reset/restore/checkout/clean` 只能由 `integrator_session` 执行。
- integrator 必须等所有 writer claim 进入 `success/noop/blocked/stalled/exhausted` 后再集成。
- 最终合并前必须跑全局 criterion，局部 criterion 不能替代全局验证。

## 终态机

允许状态：

| 状态 | 含义 | 是否成功 |
|---|---|---|
| `active` | loop 正在进行 | 否 |
| `success` | criterion 通过，阻塞 review 为空 | 是 |
| `noop` | 检查后无可执行工作，且有证据 | 是，但不是变更成功 |
| `blocked` | 缺用户、权限、外部部署、凭证或高风险决策 | 否 |
| `stalled` | 同一失败重复，或连续轮次无实质变化 | 否 |
| `exhausted` | 迭代、时间、git、token 或预算用尽 | 否 |

规则：

- `status: closed` 可以保留为 lifecycle 字段，但不替代 `terminal_state`。
- 只有 `success` 和 `noop` 可作为正常闭环。
- `blocked/stalled/exhausted` 必须留下 `evidence.last_failure` 和 `next_action`。
- Stop hook 不能把 criterion 失败的 run 标为 `success`。

## 安全预算

新增预算字段的目的不是替代 sandbox，而是让高风险动作可见、可审计、可被 doctor 提醒。

建议字段：

- `network_allowed`: 默认 `false`
- `network_allowlist`: 仅在必要时列出 host 或命令级说明
- `install_scripts_allowed`: 默认 `false`
- `destructive_allowed`: 默认 `false`
- `max_git_ops`: 默认 `0`，用户明确要求后再开
- `secrets_policy`: 默认 `deny_env_dump`

高风险默认阻断或要求升级：

- 未知 repo 初始化时执行 README 中的 install/bootstrap 脚本
- `curl | sh`、`Invoke-WebRequest` 下载并执行、远程脚本落盘后执行
- npm/pip/bun/pnpm/yarn postinstall 脚本
- 输出完整 env、token、SSH key、browser profile、credential store
- MCP/tool metadata 要求 agent 修改自身规则或绕过审批
- destructive shell 或 destructive git 操作

## Hook 改动计划

### Slice 1：v2-only schema

目标：

- 只读取 `version: 2`。
- `init` 写 `version: 2`。
- `status/validate/close` 输出新版字段。

验证：

- init 后文件包含 `touch/session/budget/evidence/review/concurrency`。
- v1 fixture 被 validate 和 doctor 拒绝。

### Slice 2：终态机

目标：

- Stop hook 根据 criterion 写入 `terminal_state`。
- criterion 通过则 `success`。
- criterion 失败则更新 `evidence.last_failure` 和 `evidence.iteration`。
- 触达 max iterations 后 `exhausted`，不报成功。

验证：

- 故意失败的 criterion 被阻断并记录 missing/last_failure。
- 修复后 criterion 通过，terminal_state 变 `success`。
- 超过预算后变 `exhausted`，报告仍非成功。

### Slice 3：并发 claim

目标：

- 默认 `exclusive` 行为保持现有 session binding。
- 支持 `partitioned` claims。
- 非 owner session 写入未 claim 文件时阻断。
- 同文件重叠 claim 被 `validate` 拒绝。
- singleton 文件重叠被拒绝。

验证：

- s1 claim `bootstrap/**`，s2 claim `tests/**`，各自写入允许。
- s1 写 `tests/**` 被阻断。
- 两个 claim 同时包含同一文件被拒绝。
- 非 integrator git 操作被阻断。

### Slice 4：安全预算

目标：

- 对 git op 沿用现有授权，但迁移到 `touch.git`。
- 加网络、install script、destructive、secret dump 的可检测拦截。
- 对无法可靠静态判断的 shell 命令给出保守提示。

验证：

- 未授权 git add/commit/push 继续阻断。
- 未授权 `curl | sh`、`npm install` 带脚本类场景被阻断或要求显式预算。
- `env`/secret dump 类命令被阻断或警告。

## Doctor 改动计划

新增检查：

- `run-contract.json` schema version 合法。
- active state 是否陈旧，例如超过 24 小时且 session 不匹配。
- `terminal_state` 是否和 `status` 矛盾。
- `partitioned` claims 是否重叠。
- singleton 文件是否被多个 claim 持有。
- `budget` 是否缺省或危险放开。
- `.agent-loop/**` 是否被 git 跟踪。
- legacy `run contract` v1 是否被明确拒绝并提示重新 `init`。

doctor 输出分级：

- fail：schema 不可解析、legacy Python hook、重叠 claims、危险 git 配置。
- warn：陈旧 active state、预算过宽、review required 但 skipped。
- ok：配置完整且无漂移。

## Docs 改动计划

需要更新：

- `docs/execution-contract.md`
- `docs/loop-engineering-playbook.md`
- `bootstrap/contract/claude.md`
- `bootstrap/contract/codex.md`
- `bootstrap/README.md`

原则：

- 文档只解释 runtime contract，不复制完整实现细节。
- 全局 contract 只写入口和边界，不写长 schema。
- 项目级说明强调 `.agent-loop/**` 是私有状态，不是可评审政策源。
- 明确推荐 `worktree fan-out`，把 `partitioned` 标为高级显式模式。

## 测试计划

新增或扩展：

- `tests/agent_loop.test.mjs`
  - v1 明确 invalid
  - v2 init
  - terminal state
  - stale session
  - partitioned claims
  - integrator-only git ops
  - safety budget
- `tests/agent_doctor.test.mjs`
  - schema drift
  - overlapping claims
  - tracked `.agent-loop`
  - stale active state
  - dangerous budget
- `tests/bootstrap_install.test.mjs`
  - 全局 contract 同步后仍不引入旧 hook
- `tests/test_bootstrap_contract_parity.py`
  - 确保 Claude/Codex contract 对核心概念同义：`terminal_state`、`worktree`、`partitioned`、`git 操作`

最低验证命令：

```powershell
node --test tests/agent_loop.test.mjs tests/agent_doctor.test.mjs tests/bootstrap_install.test.mjs
python tests/test_bootstrap_contract_parity.py
git diff --check
```

## 落地顺序

| 优先级 | 改动 | 预计工作量 | 风险 | 价值 |
|---|---|---:|---|---|
| P0 | `run-contract.json` v2-only schema 读写 | 0.5 天 | 中 | 单一事实源 |
| P0 | terminal state + Stop hook 状态更新 | 0.5 天 | 中 | 防误报成功 |
| P1 | doctor schema/concurrency/stale 检查 | 0.5 天 | 低 | 防配置漂移 |
| P1 | `partitioned` claims + integrator git gate | 1 天 | 中 | 支持共享工作区并发 |
| P1 | safety budget 检查 | 1 天 | 中 | 防未知 repo/脚本/secret 风险 |
| P2 | docs/contract 同步 | 0.5 天 | 低 | 降低使用误解 |
| P2 | automation 模板 | 0.5 天 | 低 | 可选周期触发 |
| **Total** |  | **4 天** |  |  |

## 不做的事

- 不把 `.agent-loop/**` 变成提交的项目政策源。
- 不做完整 orchestrator 平台。
- 不默认启用后台 automations。
- 不让多个 session 默认共享同一个 worktree 写文件。
- 不把安全承诺夸大为对抗性防线；hook 仍是协作式 guardrail，不是防篡改系统。
- 不扩写全局 `AGENTS.md` / `CLAUDE.md` 成长清单。

## 验收标准

第一阶段完成后，应能证明：

1. `agent-loop.mjs init` 生成 v2 `run-contract.json`。
2. 旧 v1 `run-contract.json` 被 validate 和 doctor 明确拒绝，提示重新 `init`。
3. criterion 失败会阻断并写入 `terminal_state/evidence.last_failure`。
4. criterion 通过才进入 `success`。
5. 不同 session 在 `exclusive` 模式下不能写。
6. `partitioned` 模式下 claims 不重叠时可并行写，重叠时阻断。
7. git 写操作只允许 owner 或 integrator 且必须有授权理由。
8. doctor 能发现 schema 漂移、重叠 claims、陈旧 active state 和危险预算。
9. 全局 contract 仍保持短，不泄露实现细节。

## 失败条件

该方案应暂停或调整，如果出现以下任一情况：

- v2 schema 让普通单 session 任务明显变慢或初始化负担明显上升。
- hook 误拦截常规读/写工具，导致 agent 频繁无法推进。
- `partitioned` 模式的复杂度超过收益，测试维护成本过高。
- 官方 Codex/Claude 提供等价跨工具 runtime contract，且能替代本地 hook。
- 安全预算检查误伤过多，无法通过显式授权顺畅恢复。

## 后续决策点

1. 是否保留 `terminal_state` 和 `status` 双字段，还是最终合并为一个字段。
   当前建议保留：`status` 表示 lifecycle，`terminal_state` 表示 loop 语义。

2. 是否允许 `partitioned` 模式自动创建 claims。
   当前建议不允许：必须显式 init/update，避免 agent 自行扩大写入权。

3. 是否引入签名或树外状态。
   当前建议不做：本系统定位为协作式 guardrail，不是对抗性审计系统。

4. 是否把 automation 模板接入真实定时器。
   当前建议后置：先让 runtime contract 稳定，再接周期触发。
