---
description: "Pre-authorized self-driving loop: authorize once with a machine-checkable completion criterion, then the loop drives itself (/goal or the ralph-loop plugin re-feeds each iteration) with the criterion gate as the machine stop — the user steps out of the per-turn clock. Use for 循环到X为止 / loop until / 自己跑到 / 授权一次自驱 requests."
argument-hint: "[完成判据（测试命令/SQL 断言/预期响应）+ 可选 Touch 清单]"
---

把命令后的文本当作**一次性授权 + 完成判据**；Claude Code 中即 `$ARGUMENTS`，Codex skill 中即本次输入里跟在 skill/命令名后的文本。这是**驱动器**：用户授权一次（"循环到 X 为止"），你自驱到判据满足，把用户从**人肉时钟**里撤出来——不要每轮回来敲"继续"。按以下驱动契约执行：

1. **驱动器 / 闸门 / 判停三件套**：
   - **判停**（判据）：`$ARGUMENTS` 必须含机器可查的完成判据（测试命令、SQL 断言、预期响应）。缺判据 → 先索要，再开始；这是唯一开场就必须停下问的情况。
   - **闸门**（机器兜底）：若目标仓库有 `.agent-workflows/`，用 `node ~/bin/agent-workflow-hook.mjs init --repo <repo> --files <glob> --criterion <判据>` 写入 touch-list，让 Stop hook 执行判据、未绿不放行；无 `.agent-workflows/` 时你自己持有判据判停。
   - **驱动器**（自驱推进）：在 `/goal <判据>` 下承载本次循环——每轮结束自动复查判据并续跑，免人工"继续"；Claude 端长自主任务可用官方 `ralph-loop` 插件以 fresh context 重喂驱动器提示。

2. **选循环体**：落地类走 `/land` 契约（复述 Touch 清单+判据 → 改→验→审→修）；排查类走 `/fixloop` 契约（复现输入+通过标准 → 定位→修→生效→重放→对账）。驱动器只负责"自驱重喂"，循环体负责"一轮做什么"。

3. **自驱执行**：改 → 验 → 自审 → 修，判据满足才停。中途**不回来找用户**，除非四种情况：
   - **真阻塞**：判据被证明不可达，或缺少只有用户能给的输入；
   - **不可逆/高风险决策**：数据、接口、权限、资金、跨团队契约、删除类操作——先停下拍板；
   - **越界**：需要触碰 Touch 清单外的目标——立即停下确认；
   - **判停兜底**：同一失败重复两次、或迭代/预算超上限（默认 8 轮）——停下报告，不空转。

4. **判停与交接**：判据满足 → 停下并报告结果（判据验证原文 + 实际触碰清单）。因上限/无进展判停时，报告必须含**可续跑状态快照**（已改文件、剩余判据、当前失败现象），供下一会话或下一轮 fresh context 续接；绝不静默重试。

5. **遵守 Execution Contract**：数据默认保留；完成声明必须引真实工具结果；不主动删除/提交；并行多循环各用独立 git worktree。

> 本命令是**驱动器**：`/goal`（原生，每轮复查判据）或 `ralph-loop`（重喂 fresh context）负责自驱，`agent-workflow-hook.mjs` 判据闸门负责机器兜底判停，判据本身负责终止。三者合起来才是闭合的循环——用户授权一次后撤出，不再当人肉时钟。
