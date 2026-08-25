# e2e-test-executor：第一性原理改进方案

日期：2026-08-25 ｜ 状态：提案 ｜ 前置：`abda1a6`（planner 换 MDTD 骨架）、executor 工作区重构版（未提交）

## 0. 公理

一次执行的唯一产物是 **verdict**。一个 verdict 可信，当且仅当：

1. 缺陷若存在，这次执行能把它暴露出来 —— **RIPR** 四步全部成立；
2. 暴露它的证据在执行结束后仍可独立复核 —— **证据完整**；
3. 这次执行能被放回它的上下文 —— **溯源完整**。

executor 做的每件事要么服务于 1（让 RIPR 成立），要么服务于 2/3（让 verdict 可审计）。两者都不服务的规则不属于 executor。

由 RIPR 推出 executor 只需保证四个不变量：

| 不变量 | 守的是 RIPR 哪一步 | 理论来源 |
|---|---|---|
| **I1 可控性** — SUT 处于场景起始状态、经合法通道触发、与其他场景互不干扰 | R、I | Freedman 可测性；Hermetic testing；Luo flaky 分类学 |
| **I2 可观察性** — 探针落在错误会传播到的提交结果上，oracle 有分辨力 | P、R | RIPR；Barr oracle 分类 |
| **I3 证据完整** — 证据按易失性顺序先采后清，pass 与 fail 同等举证 | R（复核） | RFC 3227 |
| **I4 溯源完整** — 计划→运行→产物→后续 的链可从产物自身重建 | 复现 | W3C PROV |

## 1. 从不变量推出的规则（新增／改写）

### I1 可控性

**I1.1 SUT 边界声明**（新）。执行前声明每个外部依赖是 *真实* 还是 *替身*，替身的来源（stub / record-replay / fixture）和所有者。没声明边界的依赖不能承载 verdict。
— 现状：环境段是操作清单（起服务、装依赖），没有"边界"概念；依赖不可用的处理散在 §3。

**I1.2 起始状态 = 环境指纹 + 数据所有权 + 时序**（改写）。三者各有一个已存在的规则（preflight 指纹、owner marker、DAG），但没有被说成同一件事。改写为一句：起始状态未被这三项同时钉住的场景不触发。

**I1.3 调度 = flaky 根因表**（改写）。现在的 DAG 段是经验句堆叠。按 Luo 分类学改成表：

| 根因 | 判定输入 | 调度决策 |
|---|---|---|
| 顺序依赖 | `Depends on` / `Consumes` / `Produces` | 拓扑序，显式传变量 |
| 共享可变状态 | `Target locator`、`Effects`、`Readers/receivers`、`External target/stub` 有交集 | 串行 |
| 异步等待 | 场景声明 `Wait` | 等条件不等时长；无条件即 blocked |
| 资源泄漏 | cleanup 依赖 | 清理边是 DAG 边 |
| 时间／随机 | 场景用到时钟或随机 | 固定注入，否则 `unverified` |
| 并发／恢复／负载 | 场景类型 | 单独隔离运行 |

"isolation key 不同也不证明安全"这条 harvest 规则变成表里"共享可变状态"一行的判定输入，不再是散句。

### I2 可观察性

**I2.1 Oracle 类型**（新）。每个 verdict 标注 oracle 类型：
- `specified` — 计划给出的具体期望值（planner 的 concrete value）；
- `derived` — 差分／重放／不变量算出；
- `implicit` — 只有"没崩、没报错"。
`implicit` 只能产出 `unverified`，永远不是 `passed`。这是"四件证据"背后缺失的那条原理：证据再全，oracle 没分辨力也看不出错。

**I2.2 freshness 是可达性问题**（改写归位）。"reachable ≠ loaded"现在放在可观察性里，按原理它是 I1：旧代码在跑，缺陷根本没被到达。指纹规则搬到 I1.2，可观察性只留"探针落在提交结果上"。

**I2.3 探针位置 = 传播终点**（改写）。现有"assert outcomes not activity"改写为可检查的形式：探针必须读 planner 叶里 Expected Results 指向的那张表／那个事件，不是入口响应。上一轮 WN-001 只断受理放行就是这条的反例。

### I3 证据完整

保留现有四件证据、parity、`unverified`、易失性顺序，不改语义，只把"先采后清"升为 I3 的定义句，四件证据是它的最低要求。

### I4 溯源完整

**I4.1 PROV 三元**（改写）。lineage 字段按 entity / activity / agent 定义：
- entity：`Upstream plan`、`Upstream run`、本次产物、`Downstream`；
- activity：run 本身（开始/结束时间、选择集、override）；
- agent：执行者（运行时／模型）、触发者（用户指令）。
Environment State Ledger 是 activity 的终态快照。现在字段一样，只是没有原理把它们绑在一起；绑上以后新增字段有落点。

## 2. 结构

```
Principle     四个不变量各一句 + "不服务于四者的规则不属于本技能"
1. Intake     原样
2. I1 可控性  SUT 边界声明 → 起始状态三件套 → flaky 根因表调度
3. I2 可观察性  oracle 类型 → 探针位置 → 四件证据 parity
4. I3+I4 证据与溯源  易失性顺序 → 报告产物（指针到 REFERENCE）→ PROV lineage → fix loop
```

REFERENCE 新增三张表：SUT 边界声明、flaky 根因→调度、oracle 类型；lineage 段按 PROV 重排字段。

## 3. 现有规则去向

| 类别 | 处理 |
|---|---|
| 22 条护栏否定句 | 逐条归到 I1–I4；能归的保留并配正向目标；归不到的删（预计 3–5 条是重述） |
| §2 环境操作清单（起服务、端口、PATH） | 保留为 I1.2 的"环境指纹"支撑，压成一段 |
| §3 外部依赖不可用 | 并入 I1.1 边界声明：未声明替身的真实依赖不可用 → blocked + environment defect |
| 报告字段契约 | 已在 REFERENCE，不动 |
| fix loop | 原样，归 I4（activity 的续接） |

## 4. 验证

1. 用 `skill-ab-trial` 对同一份计划（fd-trade-maintenance v3）跑两版 executor，各一次。
2. 指标（全部可从 execution-report.md 机械统计）：
   - verdict 带 oracle 类型的比例；`implicit` 却标 `passed` 的数量（目标 0）；
   - 四件证据齐全的 verdict 比例；
   - 探针落在提交结果表而非入口响应的比例；
   - 串行/并行决策能对应到根因表某一行的比例；
   - lineage 三元字段齐全。
3. 硬门：新版在指标 1、2 上不劣于旧版且 `implicit→passed` 为 0，才合并。

## 5. 代价

SKILL.md 预计 3400 → 3000 词（表进 REFERENCE，散句删）；REFERENCE +3 表约 +400 词。一次 A/B 约 30–40 分钟子代理时间。
