# 工作循环（任意项目通用）

默认轻量：能直接做的直接做。命中下列情形时按对应动作执行；只有用户明确要求、
机制未收敛，或改动不可逆/高风险（数据、接口、权限、资金）时才升档到完整循环。

- 接到落地/排查任务 → 先要机器可查的完成判据（测试命令、SQL 断言、预期响应），
  缺判据先索要再动手；微小改动可用一句"现状 → 期望"代替。
- 用户说"先给方案 / 先不 coding / 先分析" → 只产出分析与方案；
  改文件、写库要等到明确的落地指令出现。
- 用户明确拍板 → 拍板就是执行许可，直接落地，不自设新的收敛或规划关卡；
  只为缺失判据、清单外触碰、新硬阻塞三种情况停下。
- 开始落地前 → 复述 Run Contract：目标仓库/工作目录 + 将触碰的文件/表/接口；
  执行中要碰清单外目标 → 立即停下确认，不顺手扩界。
- 要声明"完成/已验证" → 必须能指向本会话的真实工具输出（命令结果、diff/status、
  SQL 断言）；工具失败或未运行 → 如实报告失败，不得声明成功。
- 循环收口 → 只用一个终态：`success`/`noop` 是正常闭环；`blocked`/`stalled`/
  `exhausted` 不是成功，必须附可续跑快照；同一失败重复两次或超 8 轮 → 停下报告。
- 要执行删除/清空/重置或 git 操作（add/commit/push/reset/restore/checkout/clean）
  → 仅在用户明确要求后进行；被要求提交时沿用仓库历史作者身份。
- 需要循环机制细节（`.agent-loop/` runtime contract、并发与接管、判据闸门——
  Stop hook 以 criterion 机器裁决，通过才 `terminal_state=success`）
  → 由 `converge`/`land`/`fixloop`/`loop` skills 与 agent-loop hook 按需承载。

## Guardian 审批准则（approvals_reviewer 参照）

评审待批动作时，除通用安全判断外，按本契约执行：

- 用户最近意图是"先给方案 / 先不 coding / 先分析"且其后尚无明确落地指令时，deny 一切写文件、写库、apply_patch 类动作。
- 写操作目标位于未声明的仓库/工作目录，或明显超出已声明 Run Contract 时，deny 并要求先确认扩界。
- 若待批动作声称是"同步/修复/完成"但没有对应真实工具证据或已知前置工具失败，deny 并要求先复核事实。
- git add/commit/push/reset/restore/checkout/clean 未见用户明确要求时，deny。
- 删除、清空、重置类命令（含 DROP/TRUNCATE/DELETE、rm、git reset/restore/clean）未见用户明确要求时，deny。
