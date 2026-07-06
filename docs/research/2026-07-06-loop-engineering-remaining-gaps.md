# 当前仓库与 Loop Engineering 的剩余差距（实现层核对）

> 系列第三篇。前两篇：[通用概念解读](2026-07-06-loop-engineering-general-concept.md)
> 回答"loop engineering 是什么"；[概念 vs 本仓对照](2026-07-06-loop-engineering-concept-vs-repo.md)
> 回答"本仓超出通用概念的地方"。本篇回答剩下的方向：**对照通用 loop engineering
> 的理想形态与本仓自己的声明，当前实现还差什么**。
>
> 方法：不停留在文档层，逐条把声明（bootstrap/README、loop-core、playbook、
> 2026-07-03 改进计划）对到 `agent-loop.mjs` / `agent-doctor.mjs` /
> `analyze-sessions.py` 的真实代码上核对。每条差距标注证据位置和类别：
> **结构性缺口**（通用概念的部件本仓没有承载）、**声明-实现漂移**（文档说了、
> 代码没做或做了一半）、**已计划未做**（计划文档里排期后置）、**显式不做**
> （威胁模型/不做清单里白纸黑字放弃——不算差距，但列出以划清边界）。

## 一句话结论

判停这条腿（red-at-init、判据闸门、五值终态、震荡检测、amend 不补预算、终态
history）已经做到实现层完整、超出通用做法；**真正的剩余差距集中在另外两条腿**：
**驱动**（自驱声明依赖不随本仓分发的外部插件，跨会话驱动完全没有承载）和
**上下文经济**（可续跑快照是纯 prose 纪律，机器不持有、不校验、无 resume 通道）。
此外有四处声明-实现漂移值得清理（`review` 死 schema、`close` 路径的 success
旁通闸门、"Execution Contract" 术语悬空、resume 率指标是粗代理）。

## 先划定边界：已核实为"确实落地"的部分

为避免把已完成项误报为差距，以下机制逐一在代码里核实过，2026-07-03 改进计划的
P0/P1 切片实质已全部落地：

- v2-only schema（`touch/budget/session/evidence/review/concurrency` 全字段校验）；
- red-at-init 且**不可执行判据在 strict 模式拒绝 init**（"判据机器跑不动 = 闸门
  静默降级"被前置堵住，`agent-loop.mjs` cmdInit）；
- 判据闸门：红判据拦停、失败输出回注、绿必来自新鲜运行、无写操作间只复用红判
  （`dirty_since_verdict`）；
- 终态机：同签名重复 → `stalled`（默认 3 次，`max_stall_repeats` 可调）、双签名
  严格交替 → 震荡 `stalled`、连续拦停达 cap → `exhausted`，`stalled` 优先于
  `exhausted`；
- 移动球门柱检测：`criterion_hash` 基线 + 绕过 `amend` 的直接改档在下次 stop 记
  `via: direct-edit` 事件；`amend` 重置 stall 身份但不补预算；
- 安全预算四类拦截（network / install scripts / destructive / env dump）与 git
  预算、会话绑定、partitioned claim 重叠校验；
- 终态 history 出树汇聚（`~/.agent-loop/history.jsonl`）+ `analyze-sessions.py`
  六指标 + 趋势 delta 序列；
- 分发跟着 commit/pull 边界走（`hooks/post-commit`、`post-merge`），doctor 退居兜底。

差距在下面。

## G1 · 驱动器不随产品分发（结构性缺口，最大）

**声明**：CONTEXT.md "Driver + criterion gate + criterion 三者合起来才闭合"；
playbook 第 3 节"授权一次，你就从人肉时钟里撤出，agent 自驱到判据满足"。

**实现**：本仓分发的只有闸门和判据纪律。驱动器一栏写的是 `/goal` 和
`ralph-loop`——两者都是**外部插件，`install.mjs` 不分发**（grep 安装器无任何
driver 资产）。`skills/loop/SKILL.md` 第 2 步自己承认降级路径："If no driver is
available, state the downgrade and run one `land` or `fixloop` pass instead of
promising autonomy."

**实际后果**：一台新机器跑完 `install.mjs`，得到的循环**不是自驱的**：

- 会话内：Claude 端 Stop hook 拦停 + 失败回注事实上构成会话内驱动（agent 被迫
  继续），这条腿是通的；
- 跨会话 / fresh-context 重喂：零承载。ralph-loop 式"每圈清空上下文重开"只存在
  于文档引用里；
- 定时驱动：playbook §4.5 标注"可选"，手动挂 cron；改进计划后续决策点 4 明确
  "automation 模板后置"。

即"人肉时钟"只在**单会话内**被撤出；跨会话的时钟仍然是人（或用户自装的第三方
插件）。这是通用概念六部件中"驱动"一项在产品分发层的空位。类别：结构性缺口，
其中 automation 模板部分是**已计划未做**（P2）。

## G2 · 上下文经济没有机制承载（结构性缺口）

**声明**：通用概念把上下文经济列为核心难点第 3 条；本仓的答案是"fresh context
重喂 + 非成功终态强制可续跑快照"（bootstrap/README、loop-core Closeout）。

**实现**：快照是**纯 prose 纪律**：

- `cmdClose` 对非成功终态**不要求、不校验、不存储**任何快照字段——只记
  `closed_reason`（agent-loop.mjs:1883 起）；
- 闸门在 stalled/exhausted 释放时只**输出一句提示文本**让 agent 自己产快照
  （agent-loop.mjs:1559 "produce a resumable state snapshot … before handing
  back"）；
- 契约里机器持有的断点信息只有 `evidence.last_failure`；快照规定的四要素
  （已改文件/剩余判据/当前失败/下一步）中前两项和第四项没有任何机器字段；
- **没有 `resume` 子命令**：续跑 = 重新 `init`，而 re-init 有意重置预算和 stall
  历史——续跑与新循环在机器层不可区分。

**实际后果**：快照写没写、写得够不够续跑，完全靠 agent 自律 + 用户肉眼；指标 6
（非成功终态续跑率）测的是"续跑发生了没有"，而续跑本身没有机制化交接。这与
"机械的归机器"的自我定位不一致——快照恰恰是最机械的部分。类别：结构性缺口。

## G3 · `close` 路径的 `success` 旁通判据闸门（声明-实现漂移）

**声明**：bootstrap/README"判据通过才写入 `terminal_state=success`"。

**实现**：写 `success` 有两条路径。Stop 闸门路径确实先跑判据（agent-loop.mjs:
1447 起）；但 **CLI `close` 路径不跑判据**——`cmdClose` 直接接受
`--terminal-state success` 并落盘、写 history，且 **`--terminal-state` 缺省值
就是 `success`**（agent-loop.mjs:1891 "the default is success"）。

**实际后果**：一个忘了带 flag 的 `close`（本意可能是 blocked）会以 success 进入
终态分布，污染指标 5；一个"看着像完成了"的 agent 走 close 路径可以完全不经判据
拿到 success。这**不是**威胁模型里"刻意规避的 agent 改 `.agent-loop/` 状态"那
一类（那是普通写操作绕过，已显式放弃防御）——这是**受祝福的 CLI 入口本身**留了
一扇不设闸的门。协作式模型下最窄的修法很便宜：close 到 success 时复用
`runCriterion` 跑一次，红则拒绝并提示用正确的非成功终态；缺省值从 `success`
改为必填。类别：漂移（软点），修复成本低。

## G4 · `review` 字段是死 schema（已计划未做 → 漂移）

**声明**：2026-07-03 改进计划设计原则 4"完成声明必须由 criterion、测试输出、
diff/status、**review verdict** 或其他真实工具结果支撑"，schema 里
`review.required/verdict/blocking_count/findings` 全套字段；doctor 计划里有
"review required but skipped" 的 warn 项。

**实现**：字段只有**校验**（validateTouchList 检查 verdict 枚举合法），**没有
任何写入路径**——CLI 子命令只有 `init/status/validate/claim/amend/close`，无
`review` 命令；闸门在判 success 时不看 `review.blocking_count`（计划里的终态机
定义是 "`success` = criterion 通过，阻塞 review 为空"，实现只查了前半句）；
doctor 也没有 review-skipped 检查。`land` skill 第 3 步的独立审查（P1/P2/P3
分级）结果从不落进契约。

**实际后果**：审查环的产物停留在会话文本里，机器不知道"review 该做没做、做了
是什么裁决"。要么按计划补 `review` 子命令 + 闸门联动，要么承认审查是 prose 纪律
并把死字段从 schema 删掉——现在的状态是两头都不占。类别：已计划未做，且 schema
先行造成漂移。

## G5 · "Execution Contract" 术语悬空（文档漂移）

playbook §1 表格把约束前置写成 "Run Contract + **Execution Contract**"，§3 说
"负向约束（不删数据、行为等价、优先 MCP）随 Execution Contract 固化后，启动语
里可以省掉这部分"。但这个词**在整个仓库没有定义**：CONTEXT.md 领域语言无此条目
（只有 Run Contract / Runtime Contract），bootstrap 无此资产；改进计划引用的
`docs/execution-contract.md` 不存在。仓里唯一带这个名字的是 e2e-test-planner 的
"Agent Execution Contract"——完全不同的东西（E2E 计划里给执行代理的交接块）。

**实际后果**：读者（含 agent）无法解引用"负向约束固化到哪里"。这恰好违反本仓
自己的 Generalization Gate 条款"每个被引用的文档或流程名必须在本仓可解析或就地
定义——不留悬空指针"（AGENTS.md）。最窄修法：要么在 CONTEXT.md 定义它并指明
承载体（现状看，负向约束实际由契约卡的删除/git 条款 + `budget.destructive_allowed`
承载），要么把 playbook 的两处改成已有术语。类别：文档漂移。

## G6 · 判据-目标对齐停在 prose（已知边界，可最窄机器化）

loop-core "Criterion-Goal Alignment" 一节已经诚实点破：red-at-init 只能证明判据
可判别"做没做"，不能证明判据覆盖目标；弱判据让闸门变橡皮图章。当前的对策是
一行 prose 纪律（init 时记 alignment line，closeout 复读）。机器层零承载：
契约无 `alignment` 字段，init 不提示、closeout 不检查这行存在。

这属于本质困难（对齐判断需要语义理解，机器裁决不了），但"这行字**存在与否**"
是机器可查的——一个可选的 `--alignment "<green ⇒ goal met because …; not
covered: …>"` 字段 + status/close 时回显，能把纪律的遗忘成本从零抬到可见。
类别：已知边界，存在最窄机器化空间。

## G7 · 判据形态适配器只有 E2E 一种（已计划未做）

playbook §3 列了五类可验证判停形态（状态变化 / 计数 / 数值阈值 / 结构校验 /
对账 diff 为空），并在 §2.2 承诺排查环的配套工装："固定报文集 + SQL 断言集自动
diff，让这个环彻底一条命令化"。实际 ship 的判据适配器只有一个：
`e2e-report-check.mjs`（E2E 报告的必过集 + 新鲜度检查，dogfood 的 F1/F2 证据
充分）。SQL 断言集 diff、对账 diff 这两类形态没有对应的可复用检查器，每个循环
现场手写 shell。

这符合本仓"有观察到的失败才建工装"的方法论（E2E 检查器正是 dogfood 出 F1/F2
才建的），所以不是欠账而是**待证据触发**——但对照通用概念"反馈信号工程化"，
排查/数据修复这条最高频的环，其判据仍是一次性手工品。类别：已计划未做
（playbook 承诺过），触发条件是下一次真实排查循环的摩擦证据。

## G8 · partitioned 并发的 claim 生命周期只有前半段（实现薄）

`claim` 子命令能创建 claim（重叠校验、singleton 校验、integrator 归属都有），
但 claim 的 `state` 字段**没有任何转移路径**：无 per-claim close，整约 `close`
一刀切。计划文档的硬规则"integrator 必须等所有 writer claim 进入
success/noop/blocked/stalled/exhausted 后再集成"没有机器承载——claims 永远
`active`，integrator 靠会话文本判断 writer 完没完。同理"最终合并前必须跑全局
criterion"也无闸门联动。

考虑到 partitioned 本来就是显式高级模式、推荐路径是 worktree fan-out，这条薄
可以接受；但 worktree fan-out 本身也是纯 prose（无创建/集成工具支撑），两条
并发路径一条薄一条空。类别：实现薄；按"failure-driven"纪律，等真实并行循环的
摩擦证据再补是合理的，只是应知道它现在薄在哪。

## G9 · stall 签名对输出噪声敏感（小）

stall 签名 = FNV-1a(exit + 输出尾 2000 字符)（agent-loop.mjs:1327-1345）。判据
输出里带时间戳、耗时、随机端口等噪声时，同一失败每轮签名都不同 → 机器永远判不出
`stalled`，只能靠 8 轮 `exhausted` 兜底。兜底存在所以不失控，但"同错两次即停"
的精细语义在噪声判据下静默退化为"8 轮才停"。最窄修法：签名前剥离常见噪声
（ISO 时间戳、`\d+ms`、内存地址）或允许契约声明 `stall_signature_filter`。
类别：小缺口，有界。

## G10 · 元循环的后半段全靠人（部分为设计决定）

前半段（度量）已机器化：六指标、滚动窗口、趋势 delta、终态分布、续跑率。
后半段——从数字到改进——完全人肉：

- **候选提取**：playbook §2.5 "drift 出的改进点以脱敏措辞记为改进候选"没有任何
  脚本支撑，`analyze-sessions.py` 输出计数器和 top 片段，不输出候选；
- **调度**：月度重跑靠手动 cron（doctor 只在 loop-health.txt 超 35 天时提醒、
  只读检查 `asdf-meta-loop` 任务注册与否）；
- **证据循环**（baseline → 最窄修改 → 独立证伪）是 AGENTS.md 的 prose 流程。

其中调度后置是改进计划的显式决定（"先让 runtime contract 稳定，再接周期触发"），
证伪需要人/独立上下文是方法论本身的要求；真正可自动化而未自动化的是**候选提取**
（正则命中的纠正/abort 上下文片段 → 脱敏候选列表），它现在是每月一次的人工阅读
成本。类别：混合——调度是已计划未做，候选提取是可收窄的人肉环节。

## G11 · 安全预算的检测面 = shell 正则可识别子集（与威胁模型一致，列出以明确覆盖面）

network/install/destructive/env-dump 四类拦截靠对 Bash 命令串的正则
（agent-loop.mjs:737-778）。`python -c "requests.post(…)"`、`git clone`、
runtime 内发起的网络、编辑器工具写 shell 脚本再执行，都在检测面外。代码注释
自己声明了保守匹配 + 协作模型。这与"协作式兜底"的定位自洽，**不算漂移**；
列出是因为对照通用概念"越界防护前置"的理想，应明确本仓的前置防护覆盖的是
"shell 正则可识别"这个子集，其余靠契约卡的自律条款。

## G12 · 续跑率指标是粗代理（小）

指标 6 的"resumed"判定：某仓库一次非成功 close 之后，history 里**只要再出现
同仓库的任何一行**就算已续跑（analyze-sessions.py:150-152）。同仓库后来跑了
不相干的新循环也会把烂尾的 blocked 记成"已续跑"，指标系统性偏乐观。history 行
里已有 goal/criterion 可用于更强的匹配（同判据或同 goal 才算续跑）。类别：小，
但它是六指标里唯一衡量"快照有没有被接住"的，而 G2 说明快照本身无机制——两个
弱点叠加，"烂尾率"目前实际不可信。

## 显式不做清单（不算差距，划界用）

以下在通用 loop engineering 讨论里常被期待、本仓已白纸黑字放弃，本篇不计入差距：

- **对抗性防护**（签名/树外状态防篡改）——README 边界与威胁模型、改进计划
  后续决策点 3 双处声明不做；
- **完整 orchestrator 平台 / 默认后台 automation / 默认共享 worktree 写**——
  改进计划"不做的事"清单；
- **部署自动化**——playbook 把部署标为人的"真约束"角色，属人机分工设计而非缺口；
- **Codex Guardian 审批的机制化拦截**——依赖机器级 `config.toml`，本仓声明
  不分发、doctor 只校验取值合法性。

## 排序建议

| 差距 | 类别 | 修复成本 | 建议 |
|---|---|---|---|
| G3 close 旁通闸门 | 漂移 | 低（close-to-success 复跑判据 + 缺省改必填） | 先修：它直接污染唯一的结果指标源 |
| G5 Execution Contract 悬空 | 文档漂移 | 低（定义或改词） | 先修：违反自家 Generalization Gate 条款 |
| G4 review 死字段 | 计划未做 | 中（补写入路径）或低（删字段） | 二选一做决定，不要维持两头空 |
| G12 续跑率粗代理 | 小 | 低（按 goal/criterion 匹配） | 顺手修，否则指标 6 不可信 |
| G2 快照无机制 | 结构性 | 中（close 非成功态要求快照字段 + `status` 回显） | 下一个最窄切片的候选 |
| G1 驱动器缺位 | 结构性 | 高（分发一个最小驱动或接 automation 模板） | 等 G2 落地后再论——快照/续跑是跨会话驱动的前置 |
| G6/G7/G8/G9/G10 | 各类 | — | 按 failure-driven 纪律等证据触发，不预建 |

排序逻辑：先清漂移（声明与实现不一致比功能缺失更伤——它让文档失信），再补
结构缺口中依赖链上游的一个（G2 是 G1 的前置：没有机器持有的快照，跨会话驱动
无物可喂），其余维持本仓自己的证据触发纪律。
