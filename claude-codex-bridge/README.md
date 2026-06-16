# claude-codex-bridge

Claude Code ↔ Codex 双向桥:在 Claude Code 里用斜杠命令把任务委派给 Codex,在 Codex 里把任务委派给 Claude Code。

当前设计:consult/review 保持薄转发;work/resume 通过无第三方依赖的 Node companion 升级为可追踪、可取消、可恢复的任务系统。状态、日志、prompt、result 都写入用户状态目录,不写入目标仓库。两个方向都走各自的订阅计费。

运行时要求:

- Node.js 18.18+。
- Claude Code 侧 `/cx:work`/`/cx:resume` 和 Codex 侧 `/claude-work`/`/claude-resume` 默认创建后台 job。

## 安装

**Codex 侧**(安装本地 Codex plugin):

Windows PowerShell:
```powershell
.\install.ps1
```

macOS / Linux:
```sh
sh ./install.sh
```

**Claude 侧**(在 Claude Code 里):

```
/plugin marketplace add <本仓库绝对路径>
/plugin install cx@claude-codex-bridge
```

Codex 安装脚本会执行:

```sh
codex plugin marketplace add <本目录绝对路径>
codex plugin add claude-codex-bridge@claude-codex-bridge
```

装完各自开启一个新 session。Codex 侧通过正式 plugin `claude-codex-bridge@claude-codex-bridge` 提供 `/claude-*` 入口。

更新 Claude 侧插件时需要同步提升 `plugins/cx/.claude-plugin/plugin.json` 的 semver,然后在 Claude Code 里运行:

```
/plugin update cx@claude-codex-bridge
```

更新 Codex 侧插件时需要同步提升 `plugins/claude-codex-bridge/.codex-plugin/plugin.json` 的 semver,然后重新运行安装脚本。

## 命令速查

### Claude Code 里(→ Codex)

| 命令 | 作用 | 沙箱 |
|---|---|---|
| `/cx:consult <问题> [--model m] [--effort e]` | 只读咨询/诊断/二次意见 | read-only |
| `/cx:work [--foreground\|--wait] [--model m] [--effort e] [--] <工作>` | 委派 Codex 执行可写工作;默认后台 job | workspace-write |
| `/cx:review [--base <branch>] [--commit <sha>] [焦点]` | Codex 原生 review 本地改动(默认 `--uncommitted`) | review 内置 |
| `/cx:resume [--session id] [--foreground\|--wait] [--model m] [--effort e] [--] <增量指令>` | 续接 bridge 记录的 Codex 工作 session 或显式 session;默认后台 job | workspace-write |
| `/cx:status [job-id] [--json]` | 查看 bridge-owned Codex job 状态 | n/a |
| `/cx:result [job-id] [--json]` | 取回 job 结果或失败日志尾部 | n/a |
| `/cx:cancel [job-id] [--json]` | 取消 bridge-owned running job 及其子进程 | n/a |

通用旗标:`--model <model>` 原样传给 Codex;`--effort` 合法值 `none/minimal/low/medium/high/xhigh`。

### Codex 里(→ Claude)

| 命令 | 作用 | Claude 权限 |
|---|---|---|
| `/claude-consult <问题> [--model m]` | 只读咨询 | Read/Grep/Glob |
| `/claude-work [--foreground\|--wait] [--model m] [--] <工作>` | 委派 Claude 执行可写工作;默认后台 job | 可写 |
| `/claude-review [base/焦点] [--model m]` | Claude 审查本地 git 改动,输出 `P0-P3 \| file:line \| 问题 \| 证据` | 只读 + 只读 git |
| `/claude-resume [--session id] [--mode consult\|review\|work] [--foreground\|--wait] [--model m] [--] <增量指令>` | 续接 bridge 记录的 Claude session 或显式 session;默认后台 job | 继承原权限模式 |
| `/claude-status [job-id] [--json]` | 查看 bridge-owned Claude job 状态 | n/a |
| `/claude-result [job-id] [--json]` | 取回 Claude job 结果或失败日志尾部 | n/a |
| `/claude-cancel [job-id] [--json]` | 取消 bridge-owned running Claude job 及其子进程 | n/a |

每次 Codex→Claude 调用末尾会显示 `cost: $x.xx | session: <uuid>`。

## 计费说明(重要)

- **Codex 方向**:`codex exec` 走 ChatGPT 订阅登录,无额外费用。
- **Claude 方向**:`claude --print` 自 **2026-06-15** 起由订阅自带的月度 Agent SDK 额度覆盖(Pro $20 / Max 5x $100 / Max 20x $200)。在此之前按 API 计费(实测单次简单问答 $0.07-0.23)。
- **不要开启 usage credits**:额度耗尽时请求直接失败,这是天然的费用熔断;开了就会继续扣钱。
- **不要设置 `ANTHROPIC_API_KEY` 环境变量**:存在时 `claude --print` 优先用它按 API 计费。安装脚本和各桥接技能都有检查,但根治办法是移除该变量。
- **禁用 `--bare`**:它跳过 OAuth 只认 API key,等于强制 API 计费。

## 设计规则(改动前先读)

- **边界铁律**:consult/review 只做"组装指令 → 跑一次 CLI → 原样返回结果";work/resume 只进入 companion 创建或恢复 job。转发者不自己分析、不复述、不重试、失败不兜底。
- **指令内容一律走文件/stdin**:Windows 的 `codex.cmd` shim 会弄碎命令行参数里的嵌套引号,各平台 shell 也会插值不同字符。`codex exec -` / `claude --print < file` + quoted heredoc/here-string/temp file 是硬规则。stateful bridge 命令必须用 `--args-file`, 不得把整段 request 当作 shell 参数传给 companion。
- **work 合同通用**:`/cx:work` 与 `/claude-work` 使用同一套完成标准、验证循环和动作安全边界;差异只在外层 CLI、权限和沙箱。
- **新增 profile 只改 catalog + wrapper**:`plugins/*/scripts/bridge-catalog.json` 是两侧 profile 参数、session source 和 entrypoint 的事实源。新增 Claude 或 Codex profile 时先加 `profiles.<side>.<profile>` 和 entrypoint,再加一个显式传 `--mode <profile> --args-file <tmp>` 的 thin wrapper; companion 和 verify 不应再新增硬编码 profile 分支。
- **结果一律走 `-o <file>`**:`codex exec` 的 stdout 事件流含大量启动噪音(可超 100KB);最终回复用 `-o` 单独落盘,事件流进日志文件、只在失败时取尾部。
- **job state 不进仓库**:`/cx:work` 和 `/claude-work` 默认后台运行,返回 job id;用对应的 `status`, `result`, `cancel` 命令管理。prompt/log/result/job JSON 都在用户状态目录。
- **resume 不用“最近会话”**:`--continue` 和 `codex exec resume --last` 都可能撞上用户正开的交互式会话。Claude 方向一律 `--resume <session_id>`;无参数 resume 只是读取 bridge registry 的 last 指针,也可用 `--session <id>` 回到历史 session。Codex 方向只续接显式 session 或 bridge registry 中记录的 session。
- **不要让模型自动调用桥命令**:`/cx:*` command 和内部 skill 都禁用 model invocation,只允许用户显式 slash command 触发。
- bridge state 存在用户状态目录,不是仓库目录:Windows `%LOCALAPPDATA%\claude-codex-bridge\`,macOS/Linux `${XDG_STATE_HOME:-~/.local/state}/claude-codex-bridge/`。

## 已知问题

- **Codex 启动噪音**:`failed to refresh available models`、MCP server 连接失败、websocket 回退等 ERROR 行是常规噪音,已被 `-o` 模式挡在日志文件里,不影响结果。
- **PowerShell profile 语言模式报错**:Codex 沙箱内每条命令开头可能刷 `Cannot dot-source ... different language mode`,来自受限语言模式下加载 profile,无害;Codex 通常自己用 `-NoProfile` 规避。
- **Codex exec 10 秒命令超时**:Codex 内部对单条 shell 命令有 ~10s 超时,大仓库递归扫描可能被截断。已装 ripgrep(`scoop install ripgrep`)大幅缓解;如仍遇到,把任务拆小。
- **官方 codex 插件共存**:本插件用 `cx:` 前缀,与官方 `/codex:` 不冲突;官方插件的 SessionEnd hook 在 headless 会话里可能报无害的 EPERM 噪音。

## 验证

```sh
sh ./scripts/verify.sh
```

它会校验 manifest、Node companion 语法和 `node:test` fake CLI 端到端测试。

本机安装后可做完整验证:

```sh
sh ./scripts/verify.sh --installed
```

`--installed` 校验当前覆盖 Codex 侧 plugin cache、prompt 暴露、companion/catalog hash 和废弃 alias 扫描。Claude Code 侧插件安装态由 Claude Code 自己的 `/plugin update cx@claude-codex-bridge` 或 `/plugin install cx@claude-codex-bridge` 管理;更新后需要新开 Claude Code session。

## 卸载

- Claude 侧:`/plugin uninstall cx@claude-codex-bridge`,再 `/plugin marketplace remove claude-codex-bridge`
- Codex 侧:`codex plugin remove claude-codex-bridge@claude-codex-bridge`,再 `codex plugin marketplace remove claude-codex-bridge`。
