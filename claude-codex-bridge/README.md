# claude-codex-bridge

Claude Code ↔ Codex 双向桥:在 Claude Code 里用斜杠命令把任务委派给 Codex,在 Codex 里把任务委派给 Claude Code。

纯薄封装:零 Node 运行时、零常驻进程、零状态管理(唯一例外:用户状态目录下按仓库分区的 cx/cc session registry)。两个方向都走各自的订阅计费。

## 安装

**Codex 侧**(复制 prompts 到 `~/.codex/prompts/`):

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

装完各自重启一次 TUI。

更新本插件时需要同步提升 `plugins/cx/.claude-plugin/plugin.json` 的 semver,然后在 Claude Code 里运行:

```
/plugin update cx@claude-codex-bridge
```

## 命令速查

### Claude Code 里(→ Codex)

| 命令 | 作用 | 沙箱 |
|---|---|---|
| `/cx:review [--base <branch>] [--commit <sha>] [焦点]` | Codex 原生 review 本地改动(默认 `--uncommitted`) | review 内置 |
| `/cx:ask <问题> [--model m] [--effort e]` | 只读咨询/诊断/二次意见 | read-only |
| `/cx:task <任务> [--resume [session-id]\|--fresh] [--background] [--model] [--effort]` | 委派执行任务;`--resume` 续接桥接记录的 Codex 线程或显式 session;`--background` 后台跑 | workspace-write |

通用旗标:`--model spark` → `gpt-5.3-codex-spark`;`--effort` 合法值 `none/minimal/low/medium/high/xhigh`。

### Codex 里(→ Claude)

| 命令 | 作用 | Claude 权限 |
|---|---|---|
| `/cc-review [base/焦点] [--model m]` | Claude 审查本地 git 改动,输出 `P0-P3 \| file:line \| 问题 \| 证据` | 只读 + 只读 git |
| `/cc-ask <问题> [--model m]` | 只读咨询 | Read/Grep/Glob |
| `/cc-task <任务> [--model m]` | 委派执行任务(acceptEdits + 通用验证 Bash 白名单) | 可写 |
| `/cc-resume <增量指令> [--session id] [--mode ask\|review\|task] [--model m]` | 续接 Claude 会话;无 `--session` 时续接 last,有 id 时回到指定 session | 继承原权限模式 |

每次 Codex→Claude 调用末尾会显示 `cost: $x.xx | session: <uuid>`。

## 计费说明(重要)

- **Codex 方向**:`codex exec` 走 ChatGPT 订阅登录,无额外费用。
- **Claude 方向**:`claude --print` 自 **2026-06-15** 起由订阅自带的月度 Agent SDK 额度覆盖(Pro $20 / Max 5x $100 / Max 20x $200)。在此之前按 API 计费(实测单次简单问答 $0.07-0.23)。
- **不要开启 usage credits**:额度耗尽时请求直接失败,这是天然的费用熔断;开了就会继续扣钱。
- **不要设置 `ANTHROPIC_API_KEY` 环境变量**:存在时 `claude --print` 优先用它按 API 计费。安装脚本和各 prompt 都有检查,但根治办法是移除该变量。
- **禁用 `--bare`**:它跳过 OAuth 只认 API key,等于强制 API 计费。

## 设计规则(改动前先读)

- **薄转发铁律**:两侧的命令/prompt 都只做"组 prompt → 跑一次 CLI → 原样返回结果";转发者不自己分析、不复述、不重试、失败不兜底。
- **prompt 一律走 stdin**:Windows 的 `codex.cmd` shim 会弄碎命令行参数里的嵌套引号,各平台 shell 也会插值不同字符。`codex exec -` / `claude --print < prompt` + heredoc/here-string/temp file 是硬规则。
- **旗标值先校验再上命令行**:prompt 走 stdin,但 `--model/--effort/--base/--commit` 的值和 session id 会拼进宿主命令行。值必须通过形状校验(模型/分支名字符集、effort 枚举、commit 十六进制、session id 必须 UUID),不合格就把整对 token 留在任务文本里、不上命令行——这同时挡住命令注入和"任务文本里恰好含 `--model` 字样"的误剥离。
- **task 合同通用**:`/cx:task` 与 `/cc-task` 使用同一套完成标准、验证循环和动作安全边界;差异只在外层 CLI、权限和沙箱。
- **task 白名单是防误操作,不是安全沙箱**:`/cc-task` 在 `acceptEdits` 下放行 `Bash(npm run *)`、`Bash(make test *)` 等脚本入口,被委派的 Claude 完全可以先改 `package.json`/`Makefile` 再触发这些脚本。白名单挡的是无关的 drive-by 命令,挡不住有意为之;真正的安全边界是"只把任务委派给你信任的本机改动",不要据此把它当沙箱用。
- **repo-hash 算法钉死**:registry 按仓库分目录的 `<repo-hash>` = 绝对仓库路径的 SHA-256 取前 16 位小写十六进制。写入(cx-task/cc-ask/cc-task/cc-review)和读取(cc-resume、cx-task resume)必须用同一算法,否则 resume 永远查不到 session。
- **结果一律走 `-o <file>`**:`codex exec` 的 stdout 事件流含大量启动噪音(可超 100KB);最终回复用 `-o` 单独落盘,事件流进日志文件、只在失败时取尾部。
- **resume 不用“最近会话”**:`--continue` 和 `codex exec resume --last` 都可能撞上用户正开的交互式会话。Claude 方向一律 `--resume <session_id>`;无参数 resume 只是读取 bridge registry 的 last 指针,也可用 `--session <id>` 回到历史 session。Codex 方向只续接显式 session 或 bridge registry 中记录的 session。
- **不要让模型自动调用桥命令**:`/cx:*` command 和内部 skill 都禁用 model invocation,只允许用户显式 slash command 触发。
- session registry 存在用户状态目录,不是仓库目录:Windows `%LOCALAPPDATA%\claude-codex-bridge\sessions\`,macOS/Linux `${XDG_STATE_HOME:-~/.local/state}/claude-codex-bridge/sessions/`。
- 建议把 `.cx-result-*.md` 加进目标仓库的 `.gitignore`。

## 已知问题

- **Codex 启动噪音**:`failed to refresh available models`、MCP server 连接失败、websocket 回退等 ERROR 行是常规噪音,已被 `-o` 模式挡在日志文件里,不影响结果。
- **PowerShell profile 语言模式报错**:Codex 沙箱内每条命令开头可能刷 `Cannot dot-source ... different language mode`,来自受限语言模式下加载 profile,无害;Codex 通常自己用 `-NoProfile` 规避。
- **Codex exec 10 秒命令超时**:Codex 内部对单条 shell 命令有 ~10s 超时,大仓库递归扫描可能被截断。已装 ripgrep(`scoop install ripgrep`)大幅缓解;如仍遇到,把任务拆小。
- **官方 codex 插件共存**:本插件用 `cx:` 前缀,与官方 `/codex:` 不冲突;官方插件的 SessionEnd hook 在 headless 会话里可能报无害的 EPERM 噪音。

## 卸载

- Claude 侧:`/plugin uninstall cx@claude-codex-bridge`,再 `/plugin marketplace remove claude-codex-bridge`
- Codex 侧:删除 `~/.codex/prompts/cc-*.md`(安装时若覆盖过同名文件或迁移过旧 `claude-*` 命令,旁边有 `.bak` 备份;重复安装不会覆盖首次备份)。
- session registry:如需彻底清理,删除用户状态目录 `claude-codex-bridge/`(Windows `%LOCALAPPDATA%\claude-codex-bridge\`,macOS/Linux `${XDG_STATE_HOME:-~/.local/state}/claude-codex-bridge/`)。
