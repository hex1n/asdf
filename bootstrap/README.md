# bootstrap/ — 机器级引导

装的核心是**个人 agent 工作循环**（判据 → 收敛 → 落地 → 排查 → 判停），在任意项目
零配置生效；skills/commands/doctor 都是这个流程的配套件。项目级操作层不在此分发，
需要时用 bootstrap-agent-os skill 按项目生成。

在任意新电脑上装齐：

```bash
git clone <asdf-repo> && cd asdf
python bootstrap/install.py            # 或先 --dry-run 预览
python ~/bin/agent-doctor.py           # 安装后自检（macOS/Linux 用 python3）
```

安装器与 doctor 均为 stdlib-only、Windows/macOS/Linux 通用（doctor 里仅"读取系统代理"
一项按 OS 分支，其余检查跨平台一致）。

## 资产清单

| 目录 | 内容 | 安装目标 |
|---|---|---|
| `../skills/` | 全部源技能 | `~/.claude/skills/`、`~/.codex/skills/` |
| `commands/` | `/land`、`/fixloop`、`/converge` 循环启动模板 | `~/.claude/commands/`、`~/.agents/skills/<command>/` |
| `contract/` | **工作循环 + Execution Contract**（[设计说明](../docs/execution-contract.md)） | 合并进 `~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`（标记块内替换，不重复追加） |
| `bin/` | `agent-doctor.py` 只读环境自检、`agent-workflow-hook.mjs` Touch 清单/evidence ledger/判据闸门 hook（Node，零额外依赖） | `~/bin/` |

## 日常使用：接一个新需求

装齐后不用再"想"流程——它固化在命令与契约里。默认档是轻量推进：**能直接做就直接做，有判据就落地**；只有用户明确要求、多个机制未收敛，或碰到不可逆/高风险改动时才升档到 `/converge`。人的拍板优先于流程，不把"按方案来"再改写成新一轮收敛。

**第 0 步 · 判两件事（10 秒）**

- 哪个仓库？老仓库直接走；全新仓库先用 `bootstrap-agent-os` 生成项目操作层，不手写。
- 需求多大？决定是否升档：
  - 微小改动（单文件、无数据/接口影响）→ 跳过收敛，一句"现状 → 期望"当判据，直接做或 `/land`。
  - 碰权限/资金/数据一致性/接口契约/洗数回填 → 升档；落地前至少补齐迁移、回滚、兼容与可复现判据。
  - 其余 → 默认轻量，不自动开长流程。

**第 1 步 · 收敛方案 `/converge`（先不写码）**

只在显式调用或高风险未收敛时使用。查该仓 `rework-log.md` 同类返工 → 重构根问题、分离约束与假设 → 默认 2 个最相关只读视角证伪，高风险再扩到 4 个（coherence/feasibility/scope/adversarial）→ 连续两轮无实质变化才收敛 → 给 2-3 个编号选项 + 推荐 + 各自失败模式。**你单字/数字拍板**（`1`/`可以`/`按这个来`）后进入落地；不满意喊"再来一轮"。

**第 2 步 · 落地 `/land`（拍板后自驱）**

复述目标仓库 + Touch 清单 + 机器可查判据（假设存在的表/字段先只读核验）→ 若仓库有 `.agent-workflows/`，用 `node ~/bin/agent-workflow-hook.mjs init --repo <repo> --files <glob> --criterion <check>` 同步写入 `.agent-workflows/touch-list.json` 供 hook 记账/拦截 → 循环：改 → 验 → 自审/必要时独立上下文子代理审（只看正确性/需求缺口，P1/P2/P3 分级，仅 P1 打断）→ 修；每轮 `git status` 核对没越界 → 判据满足才停。撞上判停条件才回来找你。任何"已读/已写/已完成/已验证"都必须能指向真实工具结果；`.agent-workflows/evidence-ledger.jsonl` 只证明 hook 观察到的范围/过程，不证明业务正确性。

**第 3 步 · 验证（打到真实世界）**

代码层绿不算数：部署 → 重发原始报文 → 逐字段查库对账。对账不符转 `/fixloop`（复现输入 + 通过标准 → 证据先行定位 → 修 → 生效门：本地服务自起、测试环境等你部署确认，生效后才重放 → 对账，直到 diff 为空）。**你验收 + 测试环境部署**（本地服务 agent 自行启动；无法自行部署的环境仍由你触发）。

**第 4 步 · 留痕（自动）**

返工时命令自动往 `rework-log.md` 追加归因；月底元循环重跑 `analyze-sessions.py` 看 `loop-health.txt` 趋势。

**判停速记（任何循环都不会无限空转）**

| 循环停在这些点，然后报告 |
|---|
| 判据满足 |
| 需要触碰 Touch 清单外的文件/表 → 停下确认 |
| 判据被证明不可达 |
| 连续两轮无进展（改动与失败现象都没变） |
| 同一失败重复两次 |
| 迭代超 8 轮 |

判停时若任务确需更长跨度，先落可续跑状态快照（已改文件/剩余判据/当前失败现象），下一会话直接续。

**贴手卡片**

```
新需求 → 哪个仓库？(新仓先 bootstrap-agent-os)
       → 多大？ 微小=直接做 · 高风险=/converge 或补迁移回滚判据 · 其余=默认轻
1. /converge  显式/高风险才用 → 只读证伪 → 编号选项 →〔你拍板〕
2. /land      拍板后执行 → Touch清单+判据 → 改验审修循环 → 判停自停
3. 部署+重发报文+查库对账；不符→/fixloop →〔你验收〕
4. 返工自动进 rework-log
判停：清单外/不可达/无进展/同错两次/8轮
完成声明：必须有工具结果/命令输出/diff-status/SQL 断言
```

日常打法的分类展开（六类工作、循环启动语）见
[docs/loop-engineering-playbook.md](../docs/loop-engineering-playbook.md)。

## 不自动化的部分（装完手动核对一次）

- `~/bin` 在 PATH 里（doctor 用 `python`/`python3` 跑，无需 PowerShell）
- `~/.claude/settings.json` 与 `~/.codex/config.toml` 中的 PreToolUse/Stop hooks 调用
  `node ~/bin/agent-workflow-hook.mjs`；doctor 会检查是否已注册
- `node ~/bin/agent-workflow-hook.mjs status --repo <repo>` 可只读查看当前 Touch 清单、
  最近 hook ledger 和 schema 有效性；`close --repo <repo>` 用于结束当前循环
- 仓库若不在 `~/Desktop/asdf`，给 doctor 设 `ASDF_REPO` 环境变量指向仓库根
- 周期性任务不会自动注册：元循环（月度跑 `docs/research/2026-07-02-analyze-sessions.py`
  产出 `loop-health.txt`）与 weekly automation 需自行挂 cron/schedule；doctor 会在
  loop-health.txt 超过 35 天时提醒
- `~/.claude/settings.json` 与 `~/.codex/config.toml` 仍按机器维护（安装器不自动改配置，doctor 只读检查）
- Codex 审批层实际生效性：跑 `codex --ask-for-approval never "Summarize current instructions"`
  核对 AGENTS.md 加载链与审批配置是否真的被读取（doctor 会检查 `approvals_reviewer`
  取值是否在官方合法值内）
- 业务仓库的项目级合同条目走各仓库 git，不由本安装器分发

## 维护纪律

改动先改本目录的源，再跑 `install.py` 分发；不要直接改安装副本
（与 skill 分发同一防 Cache Drift 纪律）。新增规则先过
[docs/execution-contract.md](../docs/execution-contract.md) 的 Rule Harvest Gate。
