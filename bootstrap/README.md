# bootstrap/ — 机器级引导

装的核心是**个人 agent 工作循环**（判据 → 收敛 → 落地 → 排查 → 判停），在任意项目
零配置生效。循环系统是 **taskloop**（`../taskloop/`）；本目录分发它、契约卡与配套
skills，并注册 hook。项目文档层不在此分发，需要时用 project-docs-layer skill 按
项目审计/修复（四问审计：Start/Verify/Direction/Danger；只写本会话验证过的事实，
循环纪律不进项目文档——机器与契约卡已承载）。

在任意新电脑上装齐：

```bash
git clone <asdf-repo> && cd asdf
node bootstrap/install.mjs             # 或先 --dry-run 预览
node ~/bin/taskloop.mjs status         # 安装后检查（读任务状态，或 'no task'）
```

安装器为 Node built-in only、Windows/macOS/Linux 通用。

## 资产清单

| 目录 | 内容 | 安装目标 |
|---|---|---|
| `../skills/` | 全部源技能；`loop-core/` 是不可触发支持目录 | `~/.claude/skills/`、`~/.codex/skills/` |
| `contract/` | **工作循环契约（默认值卡）**—— 用户级分发的单一源，机器可读源即人读源；双端同义由 `tests/test_bootstrap_contract_parity.py` 守护；循环机制细节不在卡内，由 skills 与 hook 在使用点承载 | Claude：整文件分发为 `~/.claude/rules/work-loop.md`（官方 user rules 机制，每会话加载）；Codex：标记块合并进 `~/.codex/AGENTS.md`。启动文件为 symlink 时一律不写穿，跳过并提示 |
| `../taskloop/bin/` | `taskloop.mjs` 循环系统（envelope 强制 + 判据闸门 PreToolUse/Stop hook + 任务 CLI）；`bin/e2e-report-check.mjs` E2E 报告判据检查器（适配器种子）——均 Node，零额外依赖 | `~/bin/`；安装器同时注册 Claude/Codex PreToolUse/Stop hooks，调用 `node ~/bin/taskloop.mjs` |

## 日常使用：接一个新需求

装齐后不用再"想"流程——它固化在 loop skills、hook 与契约里。默认档是轻量推进：**能直接做就直接做，有判据就落地**；只有用户明确要求、多个机制未收敛，或碰到不可逆/高风险改动时才升档到 `converge` skill。人的拍板优先于流程，不把"按方案来"再改写成新一轮收敛。

**第 0 步 · 判两件事（10 秒）**

- 哪个仓库？老仓库直接走；全新仓库先用 `project-docs-layer` 审计并补最小文档层，不手写。
- 需求多大？决定是否升档：
  - 微小改动（单文件、无数据/接口影响）→ 跳过收敛，一句"现状 → 期望"当判据，直接做或用 `workloop` skill。
  - 碰权限/资金/数据一致性/接口契约/洗数回填 → 升档；落地前至少补齐迁移、回滚、兼容与可复现判据。
  - 其余 → 默认轻量，不自动开长流程。

**第 1 步 · 收敛方案 `converge` skill（先不写码）**

只在显式调用或高风险未收敛时使用。查该仓 `docs/rework-log.md` 或仓库契约指定的 rework log 同类返工 → 重构根问题、分离约束与假设 → 默认 2 个最相关只读视角证伪，高风险再扩到 4 个（coherence/feasibility/scope/adversarial）→ 连续两轮无实质变化才收敛 → 给 2-3 个编号选项 + 推荐 + 各自失败模式。**你单字/数字拍板**（`1`/`可以`/`按这个来`）后进入落地；不满意喊"再来一轮"。

**第 2 步 · 落地 `workloop` skill（拍板后自驱）**

先定判据溯源（given 已给 / recovered 先复现挣红 / absent keep-green）→ 复述目标仓库 + envelope + 机器可查判据（假设存在的表/字段先只读核验）→ 用 `node ~/bin/taskloop.mjs open --goal <...> --criterion <出生即红的 check> --alignment "<绿⇒目标;不覆盖>" --files <glob>` 开任务，state 落 `.taskloop/task.json` 供 hook 记账/拦截；并行循环默认用独立 worktree（各自 `.taskloop/`，一个 integrator 归口 git），无共享 worktree partitioned 模式；若用户明确要求 git 操作，用 `--git-allowed <op>`、`--git-reason <why>` 在 envelope 授权 → 循环：改 → 验 → 自审/必要时独立上下文子代理审（只看正确性/需求缺口，P1/P2/P3 分级，仅 P1 打断）→ 修；每轮 `git status` 核对没越界 → 判据绿才收 `done`。撞上判停条件才回来找你。任何"已读/已写/已完成/已验证"都必须能指向真实工具结果；结局账只证明 hook 观察到的范围/过程，不证明业务正确性。没有 claim-based 成功。

**第 3 步 · 验证（打到真实世界）**

代码层绿不算数：部署 → 重发原始报文 → 逐字段查库对账。对账不符仍走 `workloop` 的 recovered 溯源（复现输入 + 通过标准 → 证据先行定位 → 修 → 生效门：本地服务自起、测试环境等你部署确认，生效后才重放 → 对账，直到 diff 为空）。**你验收 + 测试环境部署**（本地服务 agent 自行启动；无法自行部署的环境仍由你触发）。

**第 4 步 · 留痕（自动）**

返工时 loop skills 按共享 rework-log 规则追加归因；月底元循环（`meta-loop` skill）重跑 `analyze-sessions.py` 看 `loop-health.txt` 趋势。

**判停速记（任何循环都不会无限空转）**

| 循环停在这些点，然后报告 |
|---|
| 判据绿 → `done` |
| 需要触碰 envelope 之外的文件/表 → 停下确认 |
| 判据被证明不可达 → `abandon` 或 `suspend needs_input` |
| 连续两轮无进展 / 同一失败重复两次 → 机器自动 `suspend stuck` |
| 轮次超预算（默认 8）→ 机器自动 `suspend out_of_budget` |

挂起（suspend）不是关闭：任务保持 open，机器自记已改文件，人补剩余判据/当前失败/下一步三行,下一会话直接续。

**贴手卡片**

```
新需求 → 哪个仓库？(新仓先 project-docs-layer)
       → 多大？ 微小=直接做 · 高风险=converge skill 或补迁移回滚判据 · 其余=默认轻
1. converge skill  显式/高风险才用 → 只读证伪 → 编号选项 →〔你拍板〕
2. workloop skill  拍板后执行 → taskloop open（判据溯源+envelope+判据）→ 改验审修循环 → 判据绿收 done
3. 部署+重发报文+查库对账；不符→workloop recovered 溯源 →〔你验收〕
4. 返工按共享 rework-log 规则留痕
判停：envelope 外/不可达/无进展/同错两次/8轮 → done|not_needed|abandon|suspend
完成声明：必须有工具结果/命令输出/diff-status/SQL 断言
```


## 装完手动核对一次

- `~/bin` 在 PATH 里，`node ~/bin/taskloop.mjs status` 可跑
- `~/.claude/skills/` 与 `~/.codex/skills/` 中有 `converge`、`workloop` loop skills；旧
  `land`/`fixloop`/`loop` 受管 wrapper、旧 `.claude/commands/<name>.md` 与
  `.agents/skills/<name>/SKILL.md` 受管 wrapper 会由安装器清理
- `~/.claude/settings.json` 与 `~/.codex/config.toml` 中的 PreToolUse/Stop hooks 已由
  安装器写入，调用 `node ~/bin/taskloop.mjs`；旧 `~/.codex/hooks.json` 及历史 agent-loop
  hook 会被移除
- `node ~/bin/taskloop.mjs status --repo <repo>` 只读查看当前 task.json；
  `node ~/bin/taskloop.mjs hooks` 打印手动接线（安装器已自动接）；
  `close/abandon/not-needed/suspend` 结束或挂起当前任务（终态必填；`done` 现场复跑判据，红则拒绝；suspend 需 `--judgment` 三行）
- 仓库若不在默认位置，安装/维护脚本按 `ASDF_INSTALL_REPO` / `ASDF_INSTALL_HOME` 指向
- 周期性任务不会自动注册：元循环（月度跑 `scripts/analyze-sessions.py` 产出
  `loop-health.txt`）需自行挂 cron/schedule。注册示例——Windows：
  `schtasks /create /tn asdf-meta-loop /sc monthly /d 1 /st 09:00 /tr "python <repo>\scripts\analyze-sessions.py"`；
  Unix：`crontab -e` 加一行 `0 9 1 * * python <repo>/scripts/analyze-sessions.py`
- `~/.claude/settings.json` 与 `~/.codex/config.toml` 仍按机器维护；安装器只管理本仓
  标记的 hook 块，其他配置保留
- Codex 审批层实际生效性：跑 `codex --ask-for-approval never "Summarize current instructions"`
  核对 AGENTS.md 加载链与审批配置是否真的被读取
- 业务仓库的项目级合同条目走各仓库 git，不由本安装器分发

## 边界与威胁模型

- **判据闸门是协作式兜底，不是对抗性防线**：Stop hook 执行 `criterion` 防的是
  "看着像完成了就想停"这类无意提前判停——红判据会真的拦住、失败输出回注，判据绿才
  收 `done`；无需改动为 `not_needed`（带证据）；主动放弃为 `abandoned`（带理由）；
  缺外部输入/重复无进展/超预算为 `suspend`（任务保持 open）。`.taskloop/` 是 agent 的
  合法工作区（task.json 本就靠 CLI 写入其中），一个刻意规避的 agent 能用普通被许可的
  写操作改 `state`/`criterion`、抬高计数器、删除 task.json 或清空结局账，从而在真实判据
  仍红时放行——这类绕过超出本 hook 的能力范围，需要签名/树外状态才能防，本仓不做。
  闸门与结局账定位同源：证明协作过程，不证明业务正确、也不防篡改。
- **机器口径与真实担保**：预算里机器执行的"迭代"（rounds）是**判据红被拦停的次数**，
  跨 episode 累计、续跑不重置。埋头改、从不尝试停的循环由可选的写/墙钟预算
  （`open --writes` / `--wall-clock-minutes`，默认关，只拦真写、读与验证永不拦）兜底。
  在下一条 fail-open 降级之下，整套机制给出的硬担保只有一条且刻意收窄：**环境健康、
  状态文件未被直接改写时，红判据不会被收成 `done`**（stop 闸门与 `done` 动词两条写
  success 的路径都现场复跑判据，没有第三条）。它精确覆盖"看着像完成了"这一最高频
  失效,不承诺更多；判据输入文件在绿判时比对指纹，改动记入结局账。
- **降级永不困死**：状态不可解析/判据不可执行/超时/写盘失败一律放行。
- **会话与 episode**：任务是持久单元，episode 在其下来去；换会话时后一 episode 顶替
  前一个而非共享，快照两半随任务持久。写操作仍由 PreToolUse 的 envelope 拦截。
- **Guardian 准则的生效边界**（Codex）：写在 `~/.codex/AGENTS.md` 的"Guardian 审批准则"
  面向主代理自律；要机制化拦截，还需在 `config.toml` 审批配置侧接入（官方文档口径的
  reviewer 取值/`[auto_review].policy`）——机器级配置不由本仓分发。审批层自带的连续
  拒绝熔断与任务层"8 轮判停"是两个独立维度，互不替代。

## 维护纪律

- 改动先改本目录/`../taskloop/` 的源，再跑 `install.mjs` 分发；不要直接改安装副本
  （与 skill 分发同一防 Cache Drift 纪律）。装齐后分发跟着提交走：安装器把
  `core.hooksPath` 指向仓内 `hooks/`，`hooks/post-commit` 在每次 commit 后静默重跑
  `install.mjs`（失败不阻塞提交，只留一行提示），`hooks/post-merge` 让 `git pull`
  进来的源同样即刻分发；提交时点即证据循环通过时点。安装副本一律是真实
  拷贝——安装器会把历史遗留的 symlink/硬链接装机原地转正（delink），防止未提交的
  WIP 泄漏进活跃会话。`install.mjs --dry-run` 可只读查看当前是否有 new/update 漂移。
- 新增规则先过 [AGENTS.md](../AGENTS.md) 的 Rule Harvest Gate（≥2 次重复纠正或明确
  认可的不变量），写明语料证据；分发后用冷启动会话做证伪验证（不重申约束，诱导违规，
  观察默认行为）。
- 与 loop skills（converge/workloop）的循环契约保持同义：skills 是
  "每次任务显式声明"，契约是"不声明时的默认值"；默认档必须保持轻量，不把 `converge`
  变成用户拍板后的隐式回退步骤。同义由 `tests/test_bootstrap_contract_parity.py`
  机器守护。
- 机器可读运行状态只落目标仓库的 `.taskloop/`（gitignored、非权威）：
  `task.json` 是当前任务的单一状态，承载
  `goal/criterion/alignment/envelope/budget/spent/evidence/episodes/state`；
  出树结局账 `~/.taskloop/outcomes.jsonl` 每任务收口一行，供元循环，不替代
  测试、SQL、API 响应、diff 等业务验证证据。
- 项目级条目不由本安装器分发：用 project-docs-layer 按四问审计生成，只修有名有姓
  的缺陷（stale/undocumented/用户不变量），循环纪律一律不抄进项目文档（机器与
  契约卡已承载，第三份散文副本必漂移），由各仓库自己的 git 管理。用户级契约不放
  工具映射（MCP-vs-CLI 这类属于项目层）。
