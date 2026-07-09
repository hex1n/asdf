# taskloop 信任层加固方案

Date: 2026-07-09
Source: `docs/research/2026-07-09-taskloop-session-usage-review.md`(2026-07-09 复核版)
Mode: Plan / Deep
Status: 两批已落地并 taskloop done 收口,判据均为 local-only 行为测试(本机无
committed 套件)。批1 P0-1a/1d/1e(id `6206ce97`,`rounds:0` 印证 P0-1b);
批2 P0-1c/P1-1/P1-2(id `42d95596`),另 abandon 2 个可收口的存量 probe。
未 commit;完整回归待有套件的机器。

## TL;DR

本周暴露的不是七个孤立 bug,而是一个结构问题:taskloop 的承诺分布在三层
——**契约文本(劝说)/ CLI(自愿)/ hook(强制)**——每一次失败都发生在承诺落在
比它所需更弱的层上。入口靠文本(输给技能路由)、envelope 匹配和预算计数在 CLI
里是坏的(账在说谎)、弱判据收口无闸门(review 靠自觉)。

**核心动作**:把每条 loop 承诺下沉到能承载它的最强机制层;承载不了的层必须
"响亮失败"而不是静默空转。本轮先修测量仪器(账本与匹配层的确定性 bug),
入口问题只做验证不再加机制。

## 行动计划(优先级表)

每项 = 一个 taskloop 判据点;判据列即出生红判据(除标注外均 repo-owned
`node --test taskloop/tests/taskloop.test.mjs`)。

| 优先级 | 改动 | 判据(出生即红) | 工时 | 风险 |
|---|---|---|---:|---|
| P0-1a ✅ | `--files` 含逗号 → open/amend 均拒绝并提示重复传参;`README.md:54` 示例改为重复 `--files` | 逗号串 open/amend 退出非 0 且报错含改写建议 | 2h | 低 |
| ~~P0-1b~~ | ~~诊断并修 `rounds` 计数~~ **核验后撤销**:`spent.rounds` 仅在判据闸门跑红时 +1(`taskloop.mjs:941`/`:1436`);rounds=0 = 判据闸门未被当驱动器走(agent 在 taskloop 外验证到绿再 done),计数器正常 | 无 bug 可修 → 转为更正报告 F8 因果 + 文档化 rounds 语义 | 1h | — |
| P0-1c ✅ | 账本 row 加 `output_tokens_scope` 标注口径(episode 时间窗、含流式重复、非 task 归因);**未修累加算法**(避免破坏家里套件的既有断言),真正的流式重复累加仍在,待有套件的机器深修 | 账本 row 含非空 scope 标注 | 2h | 低 |
| P0-1d ✅ | `amend` 补 `--git-allowed`/`--git-reason`(复用 open 校验),兑现 `taskloop.mjs:1313` 引导文案 | amend 授权落账、缺 `--git-reason` 被拒 | 2h | 低 |
| P0-1e ✅ | open 时快照 `git status --porcelain`,envelope 内文件已脏则落 `opened_dirty` + 上账本 row | 脏/净 open task 字段正确、账本 open row 带该字段 | 3h | 低 |
| P0-2 | 入口**验证轮**:下一次 Codex 业务实现会话不提醒,观察第一笔写入前是否 open;用 P0-1e 字段量化 | 真实会话证据(非合成实验) | 0(搭便车) | — |
| P1-1 ✅ | 弱判据收口闸门:`done`/`hookStop` 在 `provenance=state-dir` 且最高 review < fresh-context 时拒绝,出路:补 review 或 `done --provisional`(账本记 `provisional:true`)。hookStop 用同 helper 但未单测(spawn stdin 复杂) | done 拒绝/`--provisional` 放行/fresh-context 免豁免/repo 判据不触门,四例齐 | 3h | 低 |
| P1-2 ✅/⚠️ | `open --probe` → task/账本 `kind:"probe"`;abandon 2 个可收口存量 probe。**局限**:`kind` 只对新 open 有效,旧 probe(含刚 abandon 的 2 个)ledger `kind:"task"`;tlfx 下 3 个 task.json 已丢、仍裸 open。旧 probe 识别与 audit 过滤留 P2-1 | `--probe`/普通 open 的 kind 字段正确 | 3h | 低 |
| P1-3 | `fundsalesmrksupport` 项目级判据 profile:沉淀 repo-owned 适配器固定 JAVA_HOME、`-am`、`"-Dtest=..."` 引号、`failIfNoTests` | 下一个业务任务不再新写 ad-hoc `.mjs` | 4h | 中(在目标仓库落) |
| P2-1 ✅ | `taskloop audit [--since]`:真实/probe(kind + scratchpad/goal 启发式)、状态/provenance/review 分布、drift/provisional/opened-dirty 信号、open 列表;**输出前先跑字段可信度自校验**。真实账本验收:自动标出 2 个 token>5M、review 稀缺(none 12/self-reread 1/fresh-context 1)、5 个 probe 全分类(3 孤儿标 `[probe]`) | fixture 账本输出既定聚合 + 坏值告警,5 例齐 | 8h | 低 |
| P2-2 ✅ | 报告证据卫生规则入 meta-loop skill:引用哈希/路径成稿时现场解析一次,失效即改指针或标注 | meta-loop SKILL.md 新增该项 | 1h | 低 |
| **合计** | | | **32h ≈ 4 天** | |

### 顺序与裁决点

- P0-1e 先于 P0-2(观察需要度量字段)。
- P2-1 依赖 P0-1b/1c(字段可信)与 P1-2(probe 分类)。
- **P0-2 是本轮裁决点**:不占工时,但决定入口问题走"已够"还是"升格"。
- 本仓库(asdf)内可机器落地:P0-1a~1e、P1-1、P1-2、P2-1、P2-2。
- **不在本仓库/本会话**:P1-3(在 `fundsalesmrksupport`)、P0-2(需真实会话)。

### 本次落地范围

优先落地 asdf 仓库内、机器可执行、确定性最高的 P0 主体:P0-1a、P0-1d、
P0-1e、P0-1b、P0-1c。P1/P2 视进度接续。P0-2 与 P1-3 明确标注为不可现做。

## 最佳性检查

| 检查项 | 答案 |
|---|---|
| 判准 | ①不新增人肉守卫 ②跨运行时诚实——hook 不在时可度量地暴露,不假装强制 ③账本是唯一度量仪,必须先可信 ④每项自带出生红判据 ⑤`58f571e0` 已落地入口机制先验证再叠加 |
| 胜出机制 | 强制下沉(hook/CLI 闸门)+ 修测量仪 + 入口只验证 |
| 最接近替代 | 入口优先:本轮全部投入 Codex hook 分发或 wrapper |
| 翻盘条件 | 下一次 Codex 会话在新触发句+nudge 下仍先写后开且 `opened_dirty` 显示补开是常态 → 入口机制升格 P0 |
| 边际止损 | 不做 criterion DSL、不做账本迁移重写(append-only 不动)、不为 token 计量追求精确 |

## 根问题与约束(考古)

**根问题**:loop 的价值主张是"绿从世界挣来、账可信、边界强制";本周三个信任面
各有承诺落空——入口(6 任务 2 次先写后开)、账本(envelope 确定性失配 + 预算
字段坏值)、判据(3/3 业务任务 state-dir、review 1/6)。解决 = 每条承诺由最强
可用层持有,且弱层失效可被账本度量。

**真实约束**:Codex 侧 hook 强制未证实可用(隔离实验已证不稳);判据须机器
可执行且幂等;账本 append-only 不可回填;人只持四动词,不得新增"要人当时钟/
守卫"的环节。

**关键假设(不核验会翻盘)**:①`rounds` 不增长根因未定——`9fff27b6`(Claude)是
唯一 rounds=1,但 `d0f52322` 同为 Claude 却是 0,P0-1b 先写红测试再修;
②"Codex hook 不可行"目前只是实验不稳,不是结论——故放 P0-2 验证而非直接建设。

**被否机制**:(A)继续加强契约文案——n=2 已显示文本输给技能路由,边际递减;
(C)运行时收敛(wrapper/弃用 Codex)——成本高、用户在真实使用,仅当翻盘条件
触发且 hook 分发也失败时再议。

**反转测试**:最差情形是"修了一轮仪器,入口原地踏步"。缓解:入口不是被推迟而是
转为测量——P0-1e + P0-2 让下一次会话直接产出裁决证据,失败即触发升格。

## Codex 审查与修复(2026-07-09)

Codex 读工作树 diff 报 5 个问题(3 major/2 minor),全部核实成立并修;修复过程
暴露两层次生问题,一并修。共 6 个 local-only 行为测试文件、31 例,全绿回归。

**批4(修 5 个 finding)**
- P0-1e(major):`opened_dirty` 快照挪到 `runCriterion` **之前**——否则判据自身写
  envelope 会被误记为"open 时已脏"。
- P1-1(major):`review` 记录关联 `criterion_hash`,门只认当前 criterion 的
  review;`amend --criterion` 后旧 review 失效——否则历史 review 冒充当前状态,
  绕过"收口前独立核验"。
- P2-1(major):`auditIsProbe` 让 explicit `kind` 优先,启发式只用于无 kind 旧行
  ——否则 `kind:"task"` 的真任务因 goal/repo 被误判 probe。
- P2-1(minor):audit 坏行计数 + field-trust 告警——否则损坏 JSONL 静默漏计。
- P0-1d(minor):help 补 `--git-reason`。

**批5(次生)**:`appendLedger` 不为无 kind 的旧任务伪造 `kind:"task"`——否则批4 的
explicit-kind 优先会信这个缺省值,把旧 scratchpad probe 误判 real。

**批6(次生)**:账本 append-only,批2 修复前 abandon 的 2 个 probe 已带伪造
`kind:"task"`、无法回填;audit field-trust 标注"scratchpad/temp repo 里的可疑
kind=task",分类不变(尊重 explicit-kind 优先),但让计数偏差可见。真实账本验收:
`real 14` 同时标出 `2 suspicious kind=task`。

## 行为保持重构(2026-07-09,批7,keep-green 收口)

判据:31 例行为测试以 `--keep-green` 回归守卫模式全程保持绿。落地项:

- **closeGreen 收口序列合一**:`cmdDone`/`hookStop` 两扇门的绿收口提交序列
  (closeEpisode→state→ledger→提醒)提取为单一 `closeGreen(repo, task)`——
  P1-1 修复曾被迫改两处,同步危险已被证实。
- **opened_dirty 条件落账**:与 kind 同保真规则——出生快照字段,旧任务无值
  时不落账,不伪造 "confirmed clean" 的 false。
- **collectGrants 显式参数**:`{flags, gitOps, gitReason, files}` 取代原始 CLI
  `values` 包,flag 名回归解析层,调用方不再伪造 values 对象。
- **微清理**:cmdAmend `granted-by` 校验提升到函数头(行为微变:非法值现在
  任何 amend 组合都 fail-fast,原先只在 files/git 分支);runCriterion argv
  只 split 一次;gitOps 改 matchAll 去掉手动 lastIndex;hookPretool 对写目标
  的 repoRelative 只算一次。

## hook 输出协议修复(2026-07-09,批8)

用户观测到 `PreToolUse:Bash hook error — (root): Invalid input`。取证:deny() 的
混装 JSON `{"decision":"deny","permissionDecision":"deny",...}` 对两个运行时都
不合法——Claude 官方文档确认 PreToolUse 顶层无 `decision` 字段、
`permissionDecision` 必须嵌 `hookSpecificOutput`、**exit 2 时 stdout JSON 被
完全忽略**;本机工作中的 Codex hook(`~/.codex/hooks/dangerous-operation-check.js`)
输出的正是 `hookSpecificOutput` 形状 + exit 0。两边协议同形。

修复:deny() 统一为 `hookSpecificOutput.permissionDecision` 形状 + exit 0
(结构化决策生效的前提);stderr 保留人读理由。旧行为靠 exit 2 阻断仍然生效,
丢的是结构化通道 + UI 校验噪声。`block()`(Stop)形状对 Claude 合法,Codex 侧
未验但无观测失败,不动。判据:untracked/envelope 两条 deny 路径 + allow 静默,
3 例,7 文件 34 例全量回归绿。

**两项评估后撤销(核实推翻)**:
- 纯函数 export:`process.exit(main())` 无条件执行,export 需配 import 守卫,
  而 `import.meta.url` 与 argv[1] 的比较在 win32 有盘符大小写等失败模式,
  失败后果是 hook 入口静默 no-op——为省测试 spawn 赌 supervisor 失效不值。
- open 模板常量合一:运行时模板实际只有一处(untracked nudge),help 是另一种
  排版,无重复可去。
