# bootstrap/ — 机器级引导

装的核心是**个人 agent 工作循环**（判据 → 收敛 → 落地 → 排查 → 判停），在任意项目
零配置生效；skills/commands/doctor 都是这个流程的配套件。项目级操作层不在此分发，
需要时用 bootstrap-agent-os skill 按项目生成。

在任意新电脑上装齐：

```bash
git clone <asdf-repo> && cd asdf
python bootstrap/install.py            # 或先 --dry-run 预览
pwsh ~/bin/agent-doctor.ps1            # 安装后自检
```

安装器是幂等的（重复跑只报告 `ok`/`same`），stdlib-only，Windows/macOS/Linux 通用。

## 资产清单

| 目录 | 内容 | 安装目标 |
|---|---|---|
| `../skills/` | 全部源技能 | `~/.claude/skills/`、`~/.codex/skills/` |
| `commands/` | `/land`、`/fixloop`、`/converge` 循环启动模板 | `~/.claude/commands/`、`~/.codex/prompts/` |
| `contract/` | **工作循环 + Execution Contract**（[设计说明](../docs/execution-contract.md)） | 合并进 `~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`（标记块内替换，不重复追加） |
| `bin/` | `agent-doctor.ps1` 只读环境自检 | `~/bin/` |

## 日常使用：接一个新需求

装齐后不用再"想"流程——它固化在命令与契约里。主干：**判规模 → 收敛 → 落地 → 验证 → 留痕**，人只在两个点介入：**方案拍板**、**最终验收**，中间是自驱循环。

**第 0 步 · 判两件事（10 秒）**

- 哪个仓库？老仓库直接走；全新仓库先用 `bootstrap-agent-os` 生成项目操作层，不手写。
- 需求多大？决定抄不抄近道：
  - 微小改动（单文件、无数据/接口影响）→ 跳过收敛，一句"现状 → 期望"当判据，直接 `/land`。
  - 碰权限/资金/数据一致性 → 反向升档，落地前先写一个可复现的失败测试。
  - 其余（多数）→ 走全套。

**第 1 步 · 收敛方案 `/converge`（先不写码）**

查该仓 `rework-log.md` 同类返工 → 重构根问题、分离约束与假设 → 四个只读子代理并行证伪（coherence/feasibility/scope/adversarial）→ 连续两轮无实质变化才收敛 → 给 2-3 个编号选项 + 推荐 + 各自失败模式。**你单字/数字拍板**（`1`/`可以`/`按这个来`），不满意喊"再来一轮"。

**第 2 步 · 落地 `/land`（拍板后自驱）**

复述目标仓库 + Touch 清单 + 机器可查判据（假设存在的表/字段先只读核验）→ 循环：改 → 验 → 独立上下文子代理审（只看正确性/需求缺口，P1/P2/P3 分级，仅 P1 打断）→ 修；每轮 `git status` 核对没越界 → 判据满足才停。撞上判停条件才回来找你。

**第 3 步 · 验证（打到真实世界）**

代码层绿不算数：部署 → 重发原始报文 → 逐字段查库对账。对账不符转 `/fixloop`（复现输入 + 通过标准 → 证据先行定位 → 修 → 你说"请部署" → 重放 → 对账，直到 diff 为空）。**你验收 + 做部署动作**（部署是真约束，仍由你触发）。

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
       → 多大？ 微小=直接/land · 高风险=先写失败测试 · 其余=全套
1. /converge  先不写码 → 四视角证伪 → 编号选项 →〔你拍板〕
2. /land      Touch清单+判据 → 改验审修循环 → 判停自停
3. 部署+重发报文+查库对账；不符→/fixloop →〔你验收〕
4. 返工自动进 rework-log
判停：清单外/不可达/无进展/同错两次/8轮
```

日常打法的分类展开（六类工作、循环启动语）见
[docs/loop-engineering-playbook.md](../docs/loop-engineering-playbook.md)。

## 不自动化的部分（装完手动核对一次）

- `~/bin` 在 PATH 里
- 非 Windows 机器需先安装 PowerShell Core（`pwsh`，macOS：`brew install powershell`，
  Linux：见微软官方源）才能跑 agent-doctor.ps1；注意脚本内的注册表/盘符检查项仅在
  Windows 上有意义
- 仓库若不在 `~/Desktop/asdf`，给 doctor 设 `ASDF_REPO` 环境变量指向仓库根
- 周期性任务不会自动注册：元循环（月度跑 `docs/research/2026-07-02-analyze-sessions.py`
  产出 `loop-health.txt`）与 weekly automation 需自行挂 cron/schedule；doctor 会在
  loop-health.txt 超过 35 天时提醒
- `~/.claude/settings.json` 与 `~/.codex/config.toml`（机器差异大，安装器不改配置，doctor 只检查存在性）
- Codex 审批层实际生效性：跑 `codex --ask-for-approval never "Summarize current instructions"`
  核对 AGENTS.md 加载链与审批配置是否真的被读取（doctor 会检查 `approvals_reviewer`
  取值是否在官方合法值内）
- 业务仓库的项目级合同条目走各仓库 git，不由本安装器分发

## 维护纪律

改动先改本目录的源，再跑 `install.py` 分发；不要直接改安装副本
（与 skill 分发同一防 Cache Drift 纪律）。新增规则先过
[docs/execution-contract.md](../docs/execution-contract.md) 的 Rule Harvest Gate。
