# claude-codex-bridge

Claude Code ↔ Codex 双向桥:在 Claude Code 里用斜杠命令把任务委派给 Codex,在 Codex 里把任务委派给 Claude Code。

架构 = **意图层 + 机械层**:

- **意图层**(Markdown 薄壳):7 个命令/prompt 只做三件事——把用户文本逐字存进临时文件、调一次 `bridge.ts`、原样转述输出。唯一的判断留给 LLM:`/cx:task` 的"是否在续接上一个任务"和"是否后台跑"。
- **机械层**(`plugins/cx/bridge/bridge.ts`,单文件 Bun 脚本,零 npm 依赖):旗标解析与形状校验、prompt 组装、计费防护、session registry、以 **argv 数组** spawn codex/claude——用户文本从不经过任何 shell 解析,引号/heredoc/注入这整类问题在机制上不存在。

两个方向都走各自的订阅计费。零常驻进程、零状态服务;唯一状态是用户状态目录下按仓库分区的 session registry,由脚本统一读写。

## 前置要求

- 两侧机器都需要 [Bun](https://bun.sh) ≥ 1.0 在 PATH 上(`bun --version` 验证;包括 Codex 沙箱内可见)。
- `codex`、`claude` CLI 均在 PATH。

## 安装

**Codex 侧**(复制 prompts 到 `~/.codex/prompts/`、bridge.ts 到 `~/.codex/bridge/`):

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

装完各自重启一次 TUI。更新插件:bump `plugins/cx/.claude-plugin/plugin.json` 的 semver 后 `/plugin update cx@claude-codex-bridge`;Codex 侧重跑安装脚本(prompts 和 bridge.ts 都要同步)。

## 命令速查

### Claude Code 里(→ Codex)

| 命令 | 作用 | 沙箱 |
|---|---|---|
| `/cx:review [--base <branch>] [--commit <sha>] [焦点]` | Codex 原生 review 本地改动(默认 `--uncommitted`) | review 内置 |
| `/cx:ask <问题> [--model m] [--effort e]` | 只读咨询/诊断/二次意见 | read-only |
| `/cx:task <任务> [--resume [session-id]\|--fresh] [--background] [--model] [--effort]` | 委派执行任务;`--resume` 续接桥接记录的 Codex 线程;`--background` 后台跑 | workspace-write |

通用旗标:`--model spark` → `gpt-5.3-codex-spark`;`--effort` 合法值 `none/minimal/low/medium/high/xhigh`。

### Codex 里(→ Claude)

| 命令 | 作用 | Claude 权限 |
|---|---|---|
| `/cc-review [--base <branch>] [焦点] [--model m]` | Claude 审查本地 git 改动,输出 `P0-P3 \| file:line \| 问题 \| 证据`;基准分支用显式 `--base`,不从语句里猜 | 只读 + 只读 git |
| `/cc-ask <问题> [--model m]` | 只读咨询 | Read/Grep/Glob |
| `/cc-task <任务> [--model m]` | 委派执行任务(acceptEdits + 通用验证 Bash 白名单) | 可写 |
| `/cc-resume <增量指令> [--session id] [--mode ask\|review\|task] [--model m]` | 续接 Claude 会话;无 `--session` 续接 last | 继承原权限模式 |

每次 Codex→Claude 调用末尾显示 `cost: $x.xx | session: <uuid>`。

## 计费说明(重要)

- **Codex 方向**:`codex exec` 走 ChatGPT 订阅登录,无额外费用。
- **Claude 方向**:`claude --print` 自 **2026-06-15** 起由订阅自带的月度 Agent SDK 额度覆盖(Pro $20 / Max 5x $100 / Max 20x $200)。在此之前按 API 计费(实测单次简单问答 $0.07-0.23)。
- **不要开启 usage credits**:额度耗尽时请求直接失败,这是天然的费用熔断;开了就会继续扣钱。
- **不要设置 `ANTHROPIC_API_KEY` 环境变量**:存在时 `claude --print` 优先用它按 API 计费。`bridge.ts` 会在子进程环境里强制移除该变量,但根治办法是不设置它。
- **禁用 `--bare`**:它跳过 OAuth 只认 API key;脚本不会传它。

## 设计规则(改动前先读)

- **机械逻辑只进 `bridge.ts`,不进 Markdown**:任何确定性行为(解析、校验、组 prompt、registry、spawn)改脚本并配测试;Markdown 薄壳只承载意图判断和转述。往 Markdown 里加机械步骤会重新引入"LLM 照散文执行"的漂移面——合同测试会拦截 contract 块、白名单、API key 字样出现在 Markdown 里。
- **用户文本永不上 shell 命令行**:意图层用 Write/temp file 落盘文本,脚本读文件;脚本用 argv 数组 + `shell: false` spawn 子进程。这是 F6(`codex.cmd` shim 弄碎引号)的机制级解法。
- **旗标值先校验再上 argv**:模型名/分支名字符集、effort 枚举、commit 十六进制、session id 必须 UUID;不合格的值整对留在任务文本里走 stdin。已知边界:`--model` 后面任何符合字符集的单词都会被当模型名(charset 无法区分 `flag` 和 `sonnet`)。
- **resume 不用"最近会话"**:`--continue` 和 `codex exec resume --last` 都可能撞上用户正开的交互式会话;脚本只续接显式 UUID 或 bridge registry 记录的 session。
- **薄转发铁律**:转发者不自己分析、不复述、不重试、失败不兜底;`is_error`/非零退出原样转述。
- **不要让模型自动调用桥命令**:`/cx:*` 全部 `disable-model-invocation: true`,只允许用户显式触发。
- **task 白名单是防误操作,不是安全沙箱**:acceptEdits 下被委派的 Claude 可以先改 `package.json`/`Makefile` 再触发白名单里的脚本入口;真正的边界是"只委派你信任的改动"。
- session registry:`<repo-hash>` = 绝对仓库路径 SHA-256 前 16 位小写十六进制;Windows `%LOCALAPPDATA%\claude-codex-bridge\sessions\`,macOS/Linux `${XDG_STATE_HOME:-~/.local/state}/claude-codex-bridge/sessions/`;原子写(temp + rename),坏文件重建不崩溃。
- 建议把 `.cx-result-*.md` 加进目标仓库的 `.gitignore`。

## 测试

`tests/test_bridge_contracts.py`(仓库根)对 `bridge.ts` 做集成测试:用 stub `codex`/`claude` 验证旗标/注入/registry 闭环/计费防护,另查 Markdown 薄壳契约与安装脚本。本地跑:`python -m unittest tests.test_bridge_contracts`(需要 bun)。CI 每次 push 自动跑。

## 已知问题

- **Codex 启动噪音**:`failed to refresh available models`、MCP 连接失败等 ERROR 行是常规噪音,被 `-o` 模式挡在事件流里,失败时脚本只回放尾部 50 行。
- **PowerShell profile 语言模式报错**:Codex 沙箱内每条命令开头可能刷 `Cannot dot-source ... different language mode`,无害。
- **Codex exec 10 秒命令超时**:Codex 内部对单条 shell 命令有 ~10s 超时,大仓库递归扫描可能被截断;已装 ripgrep 可大幅缓解。
- **官方 codex 插件共存**:本插件用 `cx:` 前缀,与官方 `/codex:` 不冲突。

## 卸载

- Claude 侧:`/plugin uninstall cx@claude-codex-bridge`,再 `/plugin marketplace remove claude-codex-bridge`
- Codex 侧:删除 `~/.codex/prompts/cc-*.md` 和 `~/.codex/bridge/`(安装时若覆盖过同名文件,旁边有 `.bak` 备份;重复安装不会覆盖首次备份)。
- session registry:如需彻底清理,删除用户状态目录 `claude-codex-bridge/`(Windows `%LOCALAPPDATA%\claude-codex-bridge\`,macOS/Linux `${XDG_STATE_HOME:-~/.local/state}/claude-codex-bridge/`)。
