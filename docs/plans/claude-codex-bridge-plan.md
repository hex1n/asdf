# Claude ↔ Codex 双向桥 · 实施计划

> 状态:已实施待实机验收 · 模式:全自建(借鉴官方 codex-plugin-cc 思路,不复用其代码)
> 日期:2026-06-11 · 环境:Windows 10 / PowerShell / codex.cmd + claude.cmd 均在 PATH

---

## 1. 目标与非目标

**目标**
- Claude Code 内通过斜杠命令把任务委派给 Codex(review / 咨询 / 执行任务)
- Codex TUI 内通过自定义 prompt 把任务委派给 Claude(review / 咨询 / 执行任务 / 续接会话)
- 两个方向都走各自订阅计费:Codex 走 ChatGPT 登录;Claude 走 OAuth 订阅(6 月 15 日起 `claude --print` 由月度 Agent SDK 额度覆盖)
- 零 Node 运行时、零常驻进程、零状态管理(唯一例外:用户状态目录下按仓库分区的 cx/cc session registry)

**非目标(明确砍掉)**
- Stop review gate(Codex 审 Claude 每轮回复)——双向烧额度,不做
- status / result / cancel 三件套——Claude 侧用 Bash `run_in_background` 原生覆盖
- app-server broker / state.json——一次性进程 + CLI 原生 resume 覆盖
- codex-rescue 式主动求援 subagent——本桥只做显式斜杠命令触发

## 2. 已验证事实(2026-06-11 本机探测)

| # | 事实 | 影响 |
|---|---|---|
| F1 | `codex exec review --uncommitted / --base <branch> / --commit <sha>` 原生存在 | review 命令零拼 prompt,直接转发 |
| F2 | `codex exec resume <session-id>` 存在;`-o <file>` 可落盘最终回复 | resume 与 background 模式的基础 |
| F3 | `-c model_reasoning_effort=<v>` 走 `-c` 覆盖;`-m` 指定模型 | --effort / --model 旗标实现方式 |
| F4 | `claude --print ... --output-format json` 返回 `result` / `session_id` / `total_cost_usd` / `usage` | Codex→Claude 的 resume 与成本展示 |
| F5 | Codex `workspace-write` 沙箱内可成功 shell 出 `claude --print` 并拿回 JSON(33s,无审批) | Codex→Claude 方向畅通,无需沙箱特殊配置 |
| F6 | `codex.cmd` shim 会弄碎嵌套双引号 | **硬规则:所有 prompt 走 stdin(`codex exec -`),禁止命令行参数传 prompt** |
| F7 | 本机装有官方 codex 插件,`/codex:` 前缀被占用 | 自建前缀用 `cx:` |
| F8 | `claude --bare` 跳过 OAuth、只认 `ANTHROPIC_API_KEY` | **禁用 --bare**;调用前确保环境无 `ANTHROPIC_API_KEY`,否则按 API 计费 |
| F9 | `claude --print --continue` 续接"目录最近会话",会撞用户交互式会话 | resume 一律用 `--resume <session_id>`,id 从 JSON 输出捕获 |

## 3. 架构

```
claude-codex-bridge/
├── .claude-plugin/
│   └── marketplace.json              # 本地 marketplace
├── plugins/cx/
│   ├── .claude-plugin/plugin.json    # name: cx
│   ├── commands/
│   │   ├── review.md                 # /cx:review
│   │   ├── ask.md                    # /cx:ask
│   │   └── task.md                   # /cx:task
│   └── skills/
│       └── codex-prompting/
│           └── SKILL.md              # 内部技能,user-invocable: false
├── codex-prompts/                    # 安装到 ~/.codex/prompts/
│   ├── cc-review.md
│   ├── cc-ask.md
│   ├── cc-task.md
│   └── cc-resume.md
├── install.ps1
├── install.sh
└── README.md
```

仓库位置:`C:\Users\hexin\Desktop\asdf\claude-codex-bridge\`

## 4. 逐文件规格

### 4.1 Claude→Codex(plugins/cx/commands/)

所有命令共同纪律(写进每个文件):
- **薄转发**:Claude 只组 prompt + 跑一次 Bash;不自己分析、不复述,stdout 原样返回
- prompt 一律 here-string 经 stdin 传给 `codex exec -`(F6)
- 路由旗标(`--background/--resume/--fresh/--model/--effort`)转发前剥离,不进任务文本
- task 合同通用:`/cx:task` 与 `/cc-task` 共享完成标准、验证循环和动作安全边界;差异只在 CLI、权限和沙箱
- `--model spark` → `gpt-5.3-codex-spark`;`--effort <v>` → `-c model_reasoning_effort=<v>`(合法值 none/minimal/low/medium/high/xhigh)
- Bash 调用失败时如实报告错误,不重试不兜底

**review.md** — `/cx:review [--base <branch>] [--commit <sha>] [自定义审查指令]`
- 无参数 → `codex exec review --uncommitted`
- `--base main` → `codex exec review --base main`
- 自定义指令作为 `[PROMPT]` 经 stdin 传入(steerable review)
- 前台运行;review 通常几分钟内出结果

**ask.md** — `/cx:ask <问题> [--model <m>] [--effort <e>]`
- `codex exec --sandbox read-only --skip-git-repo-check -`,prompt 走 stdin
- prompt 按 codex-prompting 技能组装:`<task>` + `<compact_output_contract>` + `<grounding_rules>`
- 只读沙箱,Codex 可读仓库不可改

**task.md** — `/cx:task <任务> [--resume [session-id]|--fresh] [--background] [--model] [--effort]`
- 默认 `codex exec --sandbox workspace-write -`,prompt 走 stdin
- `--resume [session-id]` → `codex exec resume <session-id> -`(增量指令走 stdin,不重复完整任务);无显式 id 时只读取用户状态目录中的 bridge-owned session registry,禁止 `--last`
- `--background` → Bash `run_in_background: true` + `-o .cx-result-<yyyyMMdd-HHmmss>.md`(完成自动通知,结果文件可查)
- prompt 组装:`<task>` + `<completeness_contract>` + `<verification_loop>` + `<action_safety>`
- 任务模糊且无 `--resume/--fresh` 时:只有 bridge state registry 存在且明显是续接时才 resume,否则 fresh;不问用户

### 4.2 内部技能(plugins/cx/skills/codex-prompting/SKILL.md)

- frontmatter:`user-invocable: false`
- 内容:借鉴 gpt-5-4-prompting 的 XML 块契约,精简为一页:
  - 核心:像操作员一样下指令;一次一个任务;说清"做完"的标准
  - 块清单:`<task>` `<compact_output_contract>` `<structured_output_contract>` `<verification_loop>` `<completeness_contract>` `<grounding_rules>` `<action_safety>`
- ask 用前三类,task 加后三类;review 不经过此技能(原生子命令)

### 4.3 Codex→Claude(codex-prompts/)

所有 prompt 共同纪律(写进每个文件,指令对象是 Codex):
- 调用统一形态:`claude --print --output-format json [--allowedTools ...] < <prompt-file>`
- **禁止** `--bare`、`--continue`;调用前若环境有 `ANTHROPIC_API_KEY` 先在子进程内清掉(PowerShell:`$env:ANTHROPIC_API_KEY=$null`;POSIX:`env -u ANTHROPIC_API_KEY`)(F8)
- 拿到 JSON 后:把 `session_id`、来源命令和 cwd 写入用户状态目录中的 cc session registry;向用户展示 `result` 全文 + 一行 `cost: $<total_cost_usd> | session: <id>`
- `is_error: true` 或命令失败时原样展示错误,不重试

| 文件 | claude 调用 | allowedTools |
|---|---|---|
| **cc-review.md** | review prompt(含 `git diff` 范围说明,$ARGUMENTS 可指定 base/焦点) | `Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)` |
| **cc-ask.md** | $ARGUMENTS 原样为问题 | `Read,Grep,Glob` |
| **cc-task.md** | $ARGUMENTS 为任务 + 通用 task contract + `--permission-mode acceptEdits` | `Read,Edit,Write,Grep,Glob` + 常见生态测试/构建/状态命令白名单 |
| **cc-resume.md** | 读用户状态目录中的 cc session registry;无参数续接 last,`--session <id>` 可回到某个历史 session | 继承 ask/review/task 原权限模式;未知 session 需显式 `--mode` |

review prompt 输出契约:每条发现 = `严重度(P0-P3) | file:line | 问题 | 证据`,只基于 diff 与读到的代码,禁止猜测。

### 4.4 marketplace.json / plugin.json

```json
// .claude-plugin/marketplace.json
{ "name": "claude-codex-bridge",
  "owner": { "name": "hexin" },
  "plugins": [{ "name": "cx", "source": "./plugins/cx",
                "description": "Bidirectional Claude<->Codex bridge (thin CLI wrapper)" }] }

// plugins/cx/.claude-plugin/plugin.json
{ "name": "cx", "version": "0.2.0",
  "description": "Delegate review/ask/task execution to Codex from Claude Code",
  "author": { "name": "hexin" } }
```

### 4.5 install.ps1 / install.sh

1. 复制 `codex-prompts\*.md` → 用户 home 下 `.codex/prompts/`(目录不存在则创建;已存在同名文件先备份为 `.bak`)
2. 迁移旧命令:若存在旧版 `claude-*.md`,先备份为 `.bak` 再移除,避免继续暴露旧 slash command
3. 打印 Claude 侧安装指引:
   `/plugin marketplace add <仓库绝对路径>` → `/plugin install cx@claude-codex-bridge`
4. 检查并警告:环境变量 `ANTHROPIC_API_KEY` 存在时提示会导致 API 计费
5. 插件行为变更时 bump `plugins/cx/.claude-plugin/plugin.json` 的 semver,用户侧通过 `/plugin update cx@claude-codex-bridge` 更新

### 4.6 README.md

安装、4+3 命令速查表、计费说明(Agent SDK credit、不开 usage credits 即熔断)、F6/F8/F9 三个坑的说明、卸载方法。

## 5. 实施顺序(竖切片)

| 步骤 | 内容 | 验证方式 |
|---|---|---|
| S1 | 骨架:marketplace.json + plugin.json + ask.md(最小命令) | `/plugin marketplace add` + `/plugin install` 成功,`/cx:ask 这个仓库是做什么的` 返回 Codex 回答 |
| S2 | cc-ask.md + install.ps1/install.sh | Codex TUI 里 `/cc-ask 这个仓库是做什么的` 返回 Claude 回答 + cost/session 行,用户状态目录生成 cc session registry |
| **检查点** | **双向最小回路打通,确认两边计费归属正常** | 你人工确认 |
| S3 | review.md + cc-review.md | 造一个带瑕疵的临时改动,两边各跑一次 review,输出符合契约 |
| S4 | task.md(含 --resume/--background)+ cc-task.md + cc-resume.md | 小任务双向各执行一次;`/cx:task --resume` 续接成功;`/cc-resume` 续接成功 |
| S5 | codex-prompting/SKILL.md + README.md 收尾 | 通读一致性;`/plugin` 重载无报错 |

S1+S2 完成后停下来给你看效果,确认后再做 S3-S5。

## 6. 验收清单

- [ ] `/cx:review`(无参 + `--base`)、`/cx:ask`、`/cx:task`(fresh/resume/background)全部可用
- [ ] Codex 内 `/cc-review`、`/cc-ask`、`/cc-task`、`/cc-resume` 全部可用
- [ ] Codex→Claude 每次调用展示 cost + session id;session 文件正确滚动更新
- [ ] 含中文/引号/反引号的任务文本不被 shim 弄碎(stdin 路径验证)
- [ ] 环境有 `ANTHROPIC_API_KEY` 时安装脚本与 prompt 均有警告/防护
- [ ] README 含计费说明与已知限制

## 7. 风险与回退

| 风险 | 概率 | 缓解 |
|---|---|---|
| 6.15 前 `claude --print` 仍按 API 计费 | 确定(还有 4 天) | S2 检查点只跑 2-3 次最小调用(每次 ~$0.07-0.23);或等 6.15 后再做 S2 |
| Codex TUI 内沙箱行为与 `codex exec` 探测不一致 | 低 | S2 实测;若被拦,prompt 中加"请求网络审批"指引,或 config.toml 放行 |
| 官方 codex 插件的 hook 在 `-p` 会话里报 EPERM 噪音 | 已观察到,无害 | README 记录;可建议卸载官方插件或忽略 |
| `--background` 输出文件被并发任务覆盖 | 低 | 文件名加时间戳:`.cx-result-<yyyyMMdd-HHmmss>.md` |
| Claude 默认模型 fable-5 较贵/较慢 | 中 | codex-prompts 支持 `--model` 透传(如 `--model sonnet`),README 给出建议 |
