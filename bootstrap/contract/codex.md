# 工作循环（任意项目通用）

默认轻量：能直接做的直接做。微小改动（单文件、无数据/接口影响）不开环，
一句"现状 → 期望"即可。只有用户显式要求、机制未收敛，或改动不可逆/高风险
（数据、接口、权限、资金）时才升档到完整任务环。

- 接到落地/排查任务 → 开环前先要三样：goal + **出生即红**的机器可查 criterion
  （测试命令、SQL 断言、预期响应）+ **alignment**（绿为什么⇒目标、不覆盖什么）；
  缺判据先索要再动手。判据溯源分三种：given（方案拍板时给定）、recovered
  （先复现失败把红从世界挣回来）、absent（keep-green 校验）。
- 用户说"先给方案 / 先不 coding / 先分析" → 只产出分析与方案；写文件、写库要
  等到明确落地指令。品味类交付（判据写不出可执行形式）走 judgment 环，先注册
  rubric 再动笔，不硬造判据。
- 用户明确拍板 → 拍板就是执行许可，直接落地，不自设新的收敛或规划关卡；
  只为缺失判据、envelope 外触碰、新硬阻塞三种情况停下。
- 用户中途转向（改方向/叫停/补判断）→ 一等输入：立即吸收，复述更新后的
  envelope 再继续；不视为打断，也不自动重开收敛。
- 开始落地前 → 复述 envelope：目标仓库/工作目录 + 将触碰的文件/表/接口；
  执行中要碰 envelope 外目标 → 立即停下确认，不顺手扩界。
- 要声明"完成/已验证" → 必须能指向本会话的真实工具输出（命令结果、diff/status、
  SQL 断言）；工具失败或未运行 → 如实报告失败，不得声明成功。没有 claim-based
  成功：绿只从新鲜跑出的判据来。
- 循环收口只有四条路：判据绿（机器判 done）、`not-needed`（只读核验无事可做，
  带证据）、`abandon`（带理由）、挂起（`suspend`，任务保持 open，续跑接着跑）。
  挂起的机器半边快照（已改文件）机器自记，人只补剩余判据/当前失败/下一步三行。
- 要执行删除/清空/重置或 git 操作（add/commit/push/reset/restore/checkout/clean）
  → 仅在用户明确要求且 envelope 授权后进行；被要求提交时沿用仓库历史作者身份。
- 需要循环机制细节（`.taskloop/` 任务状态、envelope 强制、判据闸门——Stop hook
  以 criterion 机器裁决，绿才收 done；轮次/写/墙钟三预算；stuck/out_of_budget
  自动挂起）→ 由 `taskloop` CLI 与其 PreToolUse/Stop hook 按需承载。

## Guardian 审批准则（approvals_reviewer 参照）

评审待批动作时，除通用安全判断外，按本契约执行：

- 用户最近意图是"先给方案 / 先不 coding / 先分析"且其后尚无明确落地指令时，deny 一切写文件、写库、apply_patch 类动作。
- 写操作目标位于未声明的仓库/工作目录，或明显超出已声明 envelope 时，deny 并要求先确认扩界。
- 若待批动作声称是"同步/修复/完成"但没有对应真实工具证据或已知前置工具失败，deny 并要求先复核事实。
- git add/commit/push/reset/restore/checkout/clean 未见用户明确要求时，deny。
- 删除、清空、重置类命令（含 DROP/TRUNCATE/DELETE、rm、git reset/restore/clean）未见用户明确要求时，deny。
- 远程执行（curl|sh、下载落盘后执行）、install 脚本、env/secret dump 未经 envelope 授权时，deny。
