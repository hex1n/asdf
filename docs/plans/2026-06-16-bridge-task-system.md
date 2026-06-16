# claude-codex-bridge 任务系统最佳实现方案

Mode: Plan  
Depth: Standard+  
日期: 2026-06-16  
输入来源: `claude-codex-bridge/README.md`, `plugins/cx/commands/*.md`, `plugins/claude-codex-bridge/skills/*/SKILL.md`, `scripts/verify.sh`, 官方 `openai-codex` 插件结构对比

## Implementation Status

状态: P0-P3 已实现并通过端到端验证。审查后发现的 3 个必须修复缺口也已落地: request 通过 `--args-file` 保真传递、Claude session registry 统一走 companion `register-session`、Codex installed plugin 校验覆盖 version/enabled/hash/废弃 alias。随后新增的 profile 扩展设计也已收口到 `bridge-catalog.json` + thin wrapper: companion 从 catalog 读取 `profiles.claude` 与 `profiles.cx` 的执行参数/session source, verify 从 catalog 推导 required wrappers, 并强制 session-producing profile 出现在 `sessionSources`。P4 Codex app-server adapter 按本方案定义保持可选, 未纳入本次交付。

当前验证证据:

- `node --check claude-codex-bridge/scripts/bridge-companion.mjs`
- `node --check claude-codex-bridge/plugins/cx/scripts/bridge-companion.mjs`
- `node --check claude-codex-bridge/plugins/claude-codex-bridge/scripts/bridge-companion.mjs`
- `node --test claude-codex-bridge/tests/*.test.mjs`
- `sh claude-codex-bridge/scripts/verify.sh`
- `sh claude-codex-bridge/scripts/verify.sh --installed`

## Post-review 最佳改进

根问题: bridge 的正确性边界不在“能启动 job”, 而在“用户请求、session、安装态都能被机器稳定复现”。当前实现的主流程可跑通, 但三个缺口会让真实 slash command 输入、跨模式 resume、插件升级变得不可靠。

最佳改进不是继续堆 shell prompt, 而是把 companion 变成所有 stateful 能力的唯一事实源, 并把 request 输入改成不可变原文通道。

落地状态: P0/P1/P2 中与 request 保真、session registry、installed 校验、工作树生成物 ignore 相关的改进已完成。剩余的“清理或拆分无关未跟踪功能包”仍是提交整理问题, 不属于 bridge runtime blocker。

| Priority | Change | Effort | Risk | Value |
|---|---|---:|---|---|
| P0 | 改造 `work/resume` 参数入口: `$ARGUMENTS` 原文写入临时文件或 stdin, companion 只解析 routing flags, request 用 raw span 保留, 不再 `splitCommandLine` 后 `join(" ")` | 4h | 中 | 最高 |
| P0 | 增加 verbatim regression tests: JSON、引号、反斜杠、代码块、多行输入、`--` 后原样保留 | 2h | 低 | 最高 |
| P1 | 让 `claude-consult` 和 `claude-review` 也通过 companion 注册 session, 或至少调用 companion 的 `session register` 子命令, 删除手写旧 registry schema | 4h | 中 | 高 |
| P1 | `verify.sh --installed` 校验 installed plugin version、enabled 状态、installed companion hash、无废弃 model alias 文本 | 3h | 中 | 高 |
| P2 | 安装脚本在检测到同名旧版本时先明确 remove/update, 再 add; 输出当前安装版本和 cache path | 2h | 中 | 中 |
| P2 | 清理工作树生成物: `.DS_Store`, `__pycache__`, 临时 `.codex/` 研究缓存; 增加 repo 级 ignore | 1h | 低 | 中 |
| **Total** | 审查后可靠化补丁 | **16h** |  |  |

推荐顺序:

1. 先修 request 原文保真。它是 bridge 的基础合同, 也是最容易造成静默错误的问题。
2. 再统一 Claude session registry。`resume` 的权限模式恢复依赖 `source`, 不能让 consult/review 写另一套形状。
3. 最后修安装态校验。它不影响源码单测, 但直接影响用户重启 session 后是否真的用到新版插件。

### P0 request 保真设计

不要让 companion 对一整段 `$ARGUMENTS` 做 shell parser。slash command 层应把原始 `$ARGUMENTS` 写入临时文件, 而且不能再用 `printf "%s" "$ARGUMENTS"` 这种 shell 参数通道, 因为很多 slash runtime 会先做文本替换, 内层引号仍会被 shell 解析掉。

POSIX command 应使用 quoted heredoc:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_ARGS_6f7e0b8d4a3f__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_ARGS_6f7e0b8d4a3f__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx work --args-file "$ARGS_FILE"
```

PowerShell command 应使用 single-quoted here-string:

```powershell
$tmp = New-TemporaryFile
@'
$ARGUMENTS
'@ | Set-Content -NoNewline -Encoding utf8 $tmp.FullName
node "$env:CLAUDE_PLUGIN_ROOT/scripts/bridge-companion.mjs" cx work --args-file "$($tmp.FullName)"
```

如果 runtime 将来提供结构化 argument file/env, 优先使用 runtime 原生通道。quoted heredoc 是当前 Markdown slash command 形态下的最小可靠方案。

companion 读取 raw text 后只做轻量 routing parse:

- 只识别开头位置的 `--foreground`, `--wait`, `--background`, `--model <m>`, `--effort <e>`, `--session <id>`, `--mode <mode>`。
- 一旦遇到 `--`, 后面全部作为 request 原文。
- 如果遇到第一个非 routing token, 从该 token 的原始 offset 开始保留到结尾。
- 不删除 request 内部引号、反斜杠、换行和重复空格。

这个机制比“修好 splitCommandLine”更稳, 因为 root problem 不是 shell 解析不够好, 而是用户请求本来就不是 CLI 参数列表。

### P1 session registry 统一设计

`claude-consult`, `claude-review`, `claude-work`, `claude-resume` 都必须通过同一个注册函数产生:

```json
{
  "schemaVersion": 1,
  "sessions": {
    "<session-id>": {
      "sessionId": "<session-id>",
      "session_id": "<session-id>",
      "source": "consult|review|work",
      "cwd": "/absolute/workspace",
      "jobId": "<optional-job-id>",
      "updatedAt": "<iso-time>"
    }
  },
  "updatedAt": "<iso-time>"
}
```

最佳落点是新增 companion 子命令:

```sh
node scripts/bridge-companion.mjs claude register-session --session <id> --source consult|review|work
```

这样 consult/review 可以继续保持前台薄转发, 但 registry schema 不再靠模型手写。

### P1 installed 校验设计

`verify.sh --installed` 应失败于任何 stale cache:

- `codex plugin list --json` 中 `claude-codex-bridge@claude-codex-bridge.version` 必须等于源码 plugin.json version。
- installed plugin 必须 enabled。
- installed companion 与源码 companion hash 相同。
- `codex debug prompt-input test` 必须包含 `/claude-work`, `/claude-status`, `/claude-result`, `/claude-cancel`, `/claude-resume` 对应 skill。
- installed cache 中不得出现废弃入口或 alias, 例如 `cc-task`, `cc-ask`, `gpt-5.3-codex-spark`。

这个校验能直接覆盖“我重启了但当前 session 还是不行”的失败模式。

## TL;DR

根问题不是是否引入 Node, 而是 bridge 需要从“一次性转发命令”升级为“可追踪、可取消、可恢复的任务系统”。

最佳方案: 新增一个无第三方依赖的 Node ESM companion, 作为有状态编排层。Markdown command/skill 仍然是入口, 但 `work/resume/status/result/cancel` 交给 companion 管理。不要第一版接 Codex app-server, 不要第一版引入 Bun 作为运行时依赖, 不要把简单 consult 也复杂化。

第一版只做 Claude Code -> Codex 方向, 因为这里已经有 `/cx:work` 和 `/cx:resume`, 也是最需要 job 管理的一侧。`/cx:work` 默认应该创建后台任务, 跑通后再对称扩展到 Codex -> Claude。

## 目标

把 bridge 的核心能力升级为:

1. 可追踪: 后台任务启动后能用 `/cx:status` 查看状态, 能跨 Claude session 查看最近任务。
2. 可取消: 能用 `/cx:cancel <job-id>` 终止 bridge 启动的任务及其子进程。
3. 可恢复: 能用 `/cx:resume` 续接 bridge 记录的 Codex session, 不依赖 `--last`。
4. 可取回: 能用 `/cx:result <job-id>` 读取最终结果, 即使原始 Claude session 已经结束。
5. 可验证: 每个 job 有 result/log/state 文件, 失败时能定位是启动失败、CLI 失败、超时、取消还是输出为空。

## 非目标

第一版不做:

- Codex app-server broker。
- Stop review gate。
- 自动安装 Codex/Claude CLI。
- Bun 作为用户运行时硬依赖。
- UI dashboard。
- 多机同步。
- 自动重试。
- 模型自己自动触发 bridge 命令。

## 推荐架构

```text
Claude/Codex slash command or skill
  -> node scripts/bridge-companion.mjs <side> <action> ...
      -> parse args
      -> create/read/update job state
      -> assemble prompt into temp/state file
      -> spawn codex or claude CLI
      -> capture log/result/session
      -> render stable command output
```

核心文件:

```text
claude-codex-bridge/
  scripts/
    bridge-companion.mjs
    verify.sh
  plugins/cx/scripts/
    bridge-companion.mjs
    bridge-catalog.json
  plugins/claude-codex-bridge/scripts/
    bridge-companion.mjs
    bridge-catalog.json
  tests/
    bridge-companion.test.mjs
    fixtures/
      fake-codex.mjs
      fake-claude.mjs
  plugins/cx/commands/
    work.md
    resume.md
    status.md
    result.md
    cancel.md
  plugins/claude-codex-bridge/skills/
    claude-work/SKILL.md
    claude-resume/SKILL.md
    claude-status/SKILL.md
    claude-result/SKILL.md
    claude-cancel/SKILL.md
```

第一阶段只新增/改 Claude Code 侧:

```text
/cx:work
/cx:resume
/cx:status
/cx:result
/cx:cancel
```

Codex 侧 `/claude-*` 第二阶段再接入同一个 companion。

## State 模型

状态必须在用户状态目录, 不写目标仓库。

POSIX:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/claude-codex-bridge/
```

Windows:

```text
%LOCALAPPDATA%\claude-codex-bridge\
```

目录布局:

```text
claude-codex-bridge/
  jobs/<repo-hash>/
    index.json
    <job-id>.json
  logs/<repo-hash>/
    <job-id>.log
  results/<repo-hash>/
    <job-id>.md
  prompts/<repo-hash>/
    <job-id>.txt
  sessions/<repo-hash>/
    cx-last-session.json
    cx-sessions.json
    claude-last-session.json
    claude-sessions.json
```

`repo-hash`:

- 输入: 目标 workspace 绝对路径。
- 算法: SHA-256, 取前 16 或 24 位 hex。
- 同时在 job state 保存原始 `cwd`, 便于状态输出可读。

Job JSON:

```json
{
  "schemaVersion": 1,
  "id": "job_20260616_153012_ab12cd",
  "repoHash": "0123abcd4567ef89",
  "cwd": "/absolute/workspace",
  "side": "cx",
  "action": "work",
  "status": "running",
  "createdAt": "2026-06-16T15:30:12.000Z",
  "startedAt": "2026-06-16T15:30:13.000Z",
  "completedAt": null,
  "pid": 12345,
  "childPid": 12346,
  "sessionId": null,
  "resumeFrom": null,
  "model": null,
  "effort": null,
  "background": true,
  "promptFile": "/state/prompts/<repo-hash>/<job-id>.txt",
  "logFile": "/state/logs/<repo-hash>/<job-id>.log",
  "resultFile": "/state/results/<repo-hash>/<job-id>.md",
  "exitCode": null,
  "errorSummary": null
}
```

状态枚举:

```text
created -> running -> completed
                  -> failed
                  -> cancelling -> cancelled
                  -> orphaned
```

`orphaned` 表示 state 记录仍是 running, 但 pid 不存在或无法确认。它不是自动失败, 因为任务可能已经留下 result/log, 需要 `status` 做一次 reconcile。

## Companion CLI 设计

内部命令建议:

```sh
node scripts/bridge-companion.mjs cx work [--foreground|--wait] [--model m] [--effort e] -- <request>
node scripts/bridge-companion.mjs cx resume [--foreground|--wait] [--session id] [--model m] [--effort e] -- <follow-up>
node scripts/bridge-companion.mjs cx status [job-id] [--json]
node scripts/bridge-companion.mjs cx result [job-id] [--json]
node scripts/bridge-companion.mjs cx cancel [job-id] [--json]
node scripts/bridge-companion.mjs worker <job-id>
```

第二阶段扩展:

```sh
node scripts/bridge-companion.mjs claude work ...
node scripts/bridge-companion.mjs claude resume ...
node scripts/bridge-companion.mjs claude status/result/cancel ...
```

实现原则:

- 所有用户 request 先写入 prompt file, 再从文件/pipe 喂给 CLI。
- 不把长 prompt 拼进 shell 字符串。
- 不用 shell 解析复杂命令, Node 用 `spawn(command, args, { shell: false })`。
- Windows 只在确实需要 `.cmd` 解析时用 `shell: true`, 并把参数隔离。
- 原始 CLI stdout/stderr 全量写 log。
- 最终结果只从 result file 读取。

## 后台任务机制

不要依赖 Claude/Codex 的 `run_in_background` 语义作为唯一后台机制。companion 自己负责后台化, 并且 `/cx:work` 默认后台运行:

1. `/cx:work` 调用 companion。
2. companion 创建 job state。
3. companion spawn 一个 detached worker:

```text
node scripts/bridge-companion.mjs worker <job-id>
```

4. 父 companion 立即返回:

```text
Codex work started: <job-id>
status: /cx:status <job-id>
result: /cx:result <job-id>
cancel: /cx:cancel <job-id>
```

5. worker 负责真正运行 `codex exec ...`, 更新 state, 写 result/log。

这样即使 Claude 当前 turn 结束, job 仍然由 OS 进程继续运行。

前台运行只作为调试/小任务逃生口, 用显式参数触发:

```text
/cx:work --foreground <request>
/cx:work --wait <request>
```

推荐把 `--foreground` 和 `--wait` 视为同义词。默认后台的原因是 `/cx:work` 的语义是“交给 Codex 做事”, 用户自然预期能继续使用当前 Claude session, 而不是阻塞到 Codex 完成。

## 取消机制

`cancel` 只能取消 bridge 创建的 job, 不能接受任意 pid。

流程:

1. 读取 job。
2. 校验 `status` 是 `running` 或 `cancelling`。
3. 标记 `cancelling`。
4. 终止进程树:
   - POSIX: 优先 kill detached process group, 再 fallback 到 pid。
   - Windows: `taskkill /PID <pid> /T /F`。
5. worker 或 cancel reconciler 将状态改为 `cancelled`。

不要把 `cancel` 设计成“杀最近的 codex/claude 进程”。这会误伤用户手开的交互式会话。

## 恢复机制

恢复分两层:

1. job 恢复: `/cx:result <job-id>` 能取回历史 job 的结果和日志。
2. agent session 恢复: `/cx:resume` 用 bridge 记录的 Codex session id 调 `codex exec resume <session-id> ...`。

不要使用:

```text
codex exec resume --last
claude --continue
```

因为它们可能撞上用户当前交互式会话。

Codex session id 获取:

- 继续沿用 `codex exec --json` 事件流解析。
- 解析到 thread/session id 后写入 `sessions/<repo-hash>/cx-sessions.json` 和 `cx-last-session.json`。
- 如果某次 run 没解析到 session id, job 仍然可以 completed, 但不可作为默认 resume 目标。

Claude session id 获取:

- 解析 `claude --print --output-format json` 的 `session_id`。
- 写入 `claude-sessions.json` 和 `claude-last-session.json`。

## 命令行为

### `/cx:work`

第一阶段改为调用:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx work "$ARGUMENTS"
```

行为:

- 默认后台: 立即返回 job id 和后续命令。
- 显式前台: `--foreground` 或 `--wait` 时运行到完成, 输出 result, 追加一行 bridge metadata。

建议前台 footer:

```text
bridge: job <job-id> | status completed | session <session-id-or-none>
```

### `/cx:resume`

调用:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx resume "$ARGUMENTS"
```

行为:

- 无 `--session` 时读取 `cx-last-session.json`。
- 有 `--session` 时校验 UUID-shaped。
- 成功后更新 `cx-last-session.json`。

### `/cx:status`

新增 command。

默认显示当前 repo 最近 job:

```text
ID | Action | Status | Age | Summary | Next
```

指定 job id 时显示单 job 详情和 log/result 路径。

### `/cx:result`

新增 command。

- 默认读取当前 repo 最新 completed/failed job。
- 指定 job id 时读取对应 job。
- completed: 输出 result 文件。
- failed/cancelled/orphaned: 输出状态、错误摘要、log tail。

### `/cx:cancel`

新增 command。

- 默认取消当前 repo 最新 running job。
- 指定 job id 时取消对应 job。
- 只取消 bridge state 中记录的 pid。

## 分阶段计划

| Priority | Change | Effort | Risk | Value |
|---|---:|---:|---|---|
| P0 | 新增 `bridge-companion.mjs` 的 state/args/job id/atomic write 基础设施 | 6h | 中 | 高 |
| P1 | 接入 `/cx:work` 默认后台 job worker, 保留显式前台模式 | 8h | 中 | 高 |
| P1 | 新增 `/cx:status` 和 `/cx:result` | 5h | 低 | 高 |
| P1 | 新增 `/cx:cancel` 进程树取消 | 5h | 中 | 高 |
| P1 | 接入 `/cx:resume` 到 companion, 禁用 `--last` | 4h | 中 | 高 |
| P2 | 增加 fake CLI + `node:test` 覆盖 args/state/worker/status/result/cancel | 8h | 中 | 高 |
| P2 | 更新 README, plugin version, install/verify | 3h | 低 | 中 |
| P3 | 将 Codex -> Claude 的 `/claude-work/resume/status/result/cancel` 接入 companion | 10h | 中 | 中 |
| P4 | 可选接 Codex app-server adapter | 12h | 高 | 中 |
| **Total through P2** | 可用 MVP | **39h** |  |  |

推荐交付到 P2 为第一版。P3 是对称化, P4 是官方插件级复杂度。

## 测试方案

使用 Node 内置 `node:test`, 不引入 npm 依赖。

Fake CLI:

```text
tests/fixtures/fake-codex.mjs
tests/fixtures/fake-claude.mjs
```

覆盖:

1. args parser 保留用户 request 原文。
2. state root 在不同平台 env 下解析正确。
3. atomic write 不产生半截 JSON。
4. 默认 background job 创建后立即返回 job id。
5. worker 成功时写 result、log、completed 状态。
6. worker 失败时写 failed、exitCode、errorSummary。
7. cancel 只杀指定 job。
8. status 能 reconcile pid 已不存在的 running job。
9. resume 不用 `--last`, 只用显式或 registry session id。
10. `verify.sh` 能检查 Node 存在、脚本语法、测试通过。

验证命令:

```sh
node --check claude-codex-bridge/scripts/bridge-companion.mjs
node --test claude-codex-bridge/tests/*.test.mjs
sh claude-codex-bridge/scripts/verify.sh
```

## 安全和隐私

风险: prompt、result、log 可能包含用户代码、路径、错误输出。

要求:

- state 目录权限尽量设为 `0700`。
- 不把 prompt/result/log 写进目标 repo。
- `status` 默认只显示摘要, 不打印完整 prompt。
- `result` 才打印完整结果。
- `cancel` 只能按 job id 操作 bridge 记录的 pid。
- 不记录环境变量全文。
- 对 `ANTHROPIC_API_KEY` 继续做 child process unset。

## 取舍分析

### 方案 A: 继续纯 Markdown/shell

优点:

- 最少代码。
- 最少依赖。
- 当前同步命令足够。

失败点:

- 后台任务不可稳定管理。
- 取消只能靠人工找 pid。
- result/log/session state 分散。
- Windows/POSIX shell 差异会持续扩大。

结论: 不满足“可追踪、可取消、可恢复”。

### 方案 B: Node companion + CLI runners

优点:

- 标准 Node 运行时普及, 官方 Claude 插件也采用。
- 不需要 npm 依赖。
- 能统一状态、进程、日志、结果。
- 保留现有 CLI 计费路径和权限边界。
- 后续可加 app-server adapter。

失败点:

- 引入运行时依赖。
- 需要认真处理进程树和 Windows。
- Markdown command 不再完全自描述, 需要 companion 测试兜底。

结论: 当前最佳。

### 方案 C: 直接接 Codex app-server

优点:

- 更接近官方插件。
- 对 Codex 任务的生命周期更细。

失败点:

- 只覆盖 Codex 方向, 对 Claude 方向仍要另写 runner。
- 协议、broker、session 生命周期复杂。
- 第一版容易把问题做大。

结论: 作为 P4 adapter, 不作为第一版根机制。

### 方案 D: Bun runtime

优点:

- 开发体验好。
- 可直接跑 TS。
- 可打单文件二进制。

失败点:

- 用户机器不一定有 Bun。
- Claude 官方插件生态以 Node 为默认要求。
- 多平台二进制发布会增加维护成本。

结论: 可用于开发/test/build, 不作为 runtime 硬依赖。

## Inversion Test

Node companion 会在这些条件下变成坏方案:

1. 用户只需要同步一次性转发。
2. 任务很短, status/result/cancel 几乎不用。
3. 目标用户机器没有 Node, 且不愿安装。
4. 第一版就引入 app-server、hook gate、自动安装, 导致复杂度失控。

缓解:

- 只把 stateful 命令接 Node。
- consult 保持薄封装。
- Node companion 无第三方依赖。
- app-server 和 stop gate 明确推迟。
- 每个阶段都有可运行测试。

## 最小可验证切片

第一 PR/提交只做:

1. `bridge-companion.mjs cx work -- <request>`。
2. 生成 job state/log/result 路径。
3. fake Codex worker 能完成 job。
4. `/cx:status <job-id>` 能看到 running/completed。
5. `/cx:result <job-id>` 能读结果。
6. `node --test` 覆盖成功和失败两条路径。

这个切片证明“可追踪”和“可取回”。之后再加 cancel/resume, 避免一次性吞下所有复杂度。

## 最终推荐

采用方案 B: Node companion + CLI runner adapter。

落地顺序:

1. 先实现 companion core 和 cx work/status/result。
2. 再实现 cancel。
3. 再实现 cx resume。
4. 再扩展到 claude work/resume/status/result/cancel。
5. 最后评估是否需要 Codex app-server adapter。

这个方案解决根问题, 同时保持 bridge 的原始价值: 薄、透明、可审计、依赖少。
