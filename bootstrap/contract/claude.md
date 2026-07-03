## 工作循环（任意项目通用）

默认按轻量流程推进任务，不依赖任何项目级文件；只有用户明确要求、多个机制未收敛，
或涉及不可逆/高风险改动（数据、接口、权限、资金、跨团队契约）时才升档。

1. **触发**：先做最小必要核实。接到落地/排查类任务，确定机器可查的完成判据（测试命令、SQL 断言、
   预期响应）；缺判据先索要，再动手。微小改动（单文件、无数据/接口影响）可用一句
   "现状 → 期望"代替正式判据。
2. **收敛**：方案类任务先不写码（建议直接用 Plan Mode 只读模式承载）；`converge` skill
   只用于显式要求或高风险未收敛场景。用户已明确拍板（如"按方案1来/落地/开始实现"）
   后，不自行回到收敛，除非出现新的硬阻塞或用户要求再证伪。
3. **落地**：拍板后按 `land` skill 契约循环——复述 Run Contract + 判据 → 改 → 验 → 审 → 修，
   判据满足才停；需要触碰 Run Contract 之外的目标时立即停下确认。用户拍板是执行许可，不用通用流程
   覆盖用户判断。仓库已有 `.agent-loop/` 时，把当前 Run Contract 同步到
   `.agent-loop/run-contract.json` v2 runtime contract，让 hook 记录/拦截写目标；
   该目录是 gitignored 的 agent 私有运行状态，不是项目政策源。active run contract
   绑定首个会话；并行推进多个循环时默认各用独立 git worktree，不共享工作目录；
   同一 worktree 多 session 只有用户明确要求时才用 `claim` 进入 `partitioned`
   模式；遗弃状态不会卡住 Stop，但写操作仍需 `close`、`steal` 或独立 worktree；
   确需接管旧循环时只用 `init --force --steal --reason <why>` 留痕。
4. **排查**：按 `fixloop` skill 契约——复现输入 + 通过标准 → 定位 → 修 → 重放 → 逐字段对账。
5. **自驱**：用户授权一次（"循环到 X 为止"）后，用 `loop` skill 作驱动器自驱推进，把用户从
   人肉时钟撤出——**驱动器**（`/goal` 每轮复查判据续跑，或 `ralph-loop` 重喂 fresh context）
   负责自驱，**判据闸门**（下条）负责机器兜底判停，**判据**本身负责终止；三者合起来才闭合。
   中途只在真阻塞、不可逆/高风险决策、越界、或判停兜底时回来。
6. **判停**：判据满足、同一失败重复两次、或迭代超 8 轮 → 停下报告；绝不无限空转。
   仓库启用 `.agent-loop/` 且 run contract 处于 active 时，判停由 Stop hook 执行
   criterion 机器裁决（判据闸门）：strict 下未通过不放行，判据通过才进入
   `terminal_state=success`，无须改动为 `noop`，缺外部输入为 `blocked`，
   重复无进展为 `stalled`，预算耗尽为 `exhausted` 并要求可续跑快照；
   闸门只对绑定会话生效，prose 不再是判停的唯一依据。
7. **新项目**：以上零配置即可用；需要项目级操作层（AGENTS.md / VISION.md / goal 合同）
   时，用 bootstrap-agent-os 生成，不手写。
8. **事实校验**：声称"已读/已写/已完成/已验证"必须有真实工具结果或只读复核支撑；
   工具失败、未调用或输出不匹配时，必须报告失败，不能用流程文本替代事实。
9. **元循环**：元循环是离线维护任务；按需或每月重跑 session 分析（analyze-sessions.py）
   对账循环健康指标，产出 loop-health 记录。新规律先过 Rule Harvest Gate 再固化。

## Execution Contract（跨项目执行契约）

- **方案阶段不写码**：用户说"先给方案 / 先不 coding / 先分析"后，只产出分析与方案；
  出现明确落地指令（"落地 / 按这个来 / 开始实现"）前，不改文件、不写库。
- **拍板优先**：用户明确拍板后，把拍板当作执行许可，不再用通用流程覆盖用户判断；
  只为缺失判据、清单外触碰或新发现的硬阻塞停下。
- **Run Contract**：落地前复述目标仓库/工作目录与将要触碰的文件/表/接口；执行中
  需要触碰 Run Contract 之外的目标时，立即停下确认，不得顺手扩界。若仓库已有 `.agent-loop/`，
  同步维护 `.agent-loop/run-contract.json` v2 runtime contract；旧 v1 清单不兼容，
  需重新 `init`。`.agent-loop/loop-events.jsonl` 只作本地 hook 范围/过程证据，
  不能替代测试、SQL、API 响应或 diff 等业务验证证据。
- **事实证据**：完成声明必须附带可复核证据（命令、工具结果、diff/status、SQL 断言等）；
  若工具失败或未执行，不得声明成功。
- **终态清晰**：`success/noop` 是正常闭环；`blocked/stalled/exhausted` 不是成功，
  必须附可续跑状态快照。
- **不主动删除**：不执行删除、清空、重置类操作，除非用户明确要求；确需清理前先留存
  诊断证据。（E2E 运行内的数据留存策略由 e2e-test-executor 的 preserve-by-default
  规则管，此处不重复。）
- **git 操作需授权**：git 操作（add/commit/push/reset/restore/checkout/clean）只有在用户
  明确要求后才执行；执行前必须创建或更新 active run contract，写入 `--git-allowed <op>`、
  `--git-reason <why>` 与足够的 git budget，否则 hook 应拦截。`partitioned` 模式下
  git 操作只归 integrator session。
- **提交身份**：用户要求 git 提交时，沿用该仓库历史提交的作者身份。
