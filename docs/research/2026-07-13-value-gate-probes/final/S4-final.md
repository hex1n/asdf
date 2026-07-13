# S4 终版输出（plan-review 最终修订，fresh-context 子代理，2026-07-13）——完整原文

# Plan Review 继续处理：第 2 轮 — 判定 F-001 与信封失效检查

## 当前定位

我们处在证据循环的 **第 3 步已完成、第 4 步（Adjudicate And Revise）进行中**：

- R1（fresh-context subagent，shallow 深度，blocker sweep）已交出 1 个 blocker：`F-001`。
- 父级独立验证已完成且结论是 `confirmed`——对账层确实是满足"漏发率不高于现状"这条验收标准的唯一可行修复。
- Step 3（Disclose And Validate）的完成条件已满足：该 finding 有且只有一条已披露的验证记录，证据具体（事件总线 SLA 99.9%→月折算约 43 分钟窗口）。

接下来我要做的不是直接给 F-001 挂 `fix` 然后去改方案，而是先做技能要求的**信封失效检查**。

## 第一步要做的事：核对冻结的 Decision Envelope 是否仍然有效

冻结时记录的立项理由本质上就是这次审查的 Decision Envelope：

| 字段 | 冻结值 | 修复 F-001 后 |
|---|---|---|
| `delivery_and_maintenance_cost` | 3 人日交付，无新增长期维护 | 10-12 人日交付（+233%~300%），新增一个需要随事件 schema 演进持续维护的对账层 |
| `expected_benefit` | 运维每月省约 2 小时人工核对 | 不变 |

这正好落在技能规定的失效条件上：

> "A revision that materially raises delivery or maintenance cost ... or breaks a key assumption of the frozen Decision Envelope invalidates that envelope: suspend the review and return the value decision to the planner rather than reviewing the changed economics to GO."

而且 REFERENCE.md 给出的例子几乎就是这个案例本身："a required fix that turns a three-day migration into a multi-week build with a permanent reconciliation layer" —— 三天迁移变成带永久对账层的数周构建，和这里 3 人日→10-12 人日 + 永久对账层完全对应。这不是边界模糊的判断，是命中技能明确列出的失效范例。

**结论：这个 Decision Envelope 失效了。**

## 第二步：我不会做的事

- 不会把 F-001 disposition 定为 `fix` 后自己动手在 `docs/plans/notify-migration.md` 上加对账层设计再送去复审——那等于"把变了经济性的方案审到 GO"，技能明确禁止这条路径。
- 不会因为父级已 `confirmed` 就默认继续往下走 focused recheck 或下一轮 complete review——blocker sweep 有 blocker 未清，本来就不该进入 complete review；而这里更进一步，连"清掉这个 blocker"这件事本身都需要先由规划者重新拍板，不是审查者能单方面继续的。
- 不会调用任何真实的外部模型或子代理（遵守探针约束），也不会修改任何文件。

## 第三步：F-001 的处置（disposition）

- `finding_id`: F-001
- `disposition`: `needs-input`
- `owner`: 规划者 / 用户（worth-building 的再决策权不在审查者）
- 理由：修复本身在技术上无争议（父级已 confirmed 是唯一可行修复），但修复的代价改变了立项时的成本假设，这是一个缺失的价值判断，不是缺失的证据（所以不是 `defer-gap`），也不是可选项（不能 `accept-risk`），也没有反证可提（不是 `rebut`）。

## 第四步：本轮收口——两轨结论

```text
technical_verdict: SUSPENDED
implementation_decision: 冻结信封已失效；在规划者重新决策之前，不存在有效的 BUILD 授权
                         （不是简单沿用旧信封的 UNCHANGED）
```

依据：

> "Suspend when ... the Decision Envelope is invalidated ... the outcome is SUSPENDED or WITHDRAWN, never a pass."
> "after envelope invalidation the report also states that no valid BUILD authorization remains until the planner re-decides."

即：这不是 NO_GO（NO_GO 需要跑完一轮 complete review 才能下的结论，而我们还没到那一步），也绝不是把它算作某种"隐性通过"——`SUSPENDED` 本身在技能里被明确排除在 pass 之外。

## 需要规划者重新回答的问题（交还的具体价值决策）

1. 新经济性（10-12 人日 + 永久维护 vs. 每月省约 2 小时人工核对）是否仍然值得做？
2. 是否有比"事件流+邮件日志双写对账"更轻量的补偿机制能满足"不漏发"，还是应该放宽验收标准第 3 条本身（例如改为"漏发率不高于现状 ± 事件总线 SLA 窗口内的可接受抖动"）？
3. 如果规划者仍选 BUILD 且采纳对账层方案，这个新方案在范围、机制、维护负担上已经实质性变化——回到审查时需要**重新走 Freeze**：重新确认 Decision Envelope、并重新做深度校准（新增的常驻对账组件是否还满足"可逆、无数据破坏/外部接口/权限/资金路径"这条 shallow 资格，需要重新判断，不能沿用旧的 shallow 结论）。

## 一个旁注（不影响本次结论，但会挡住未来的收口）

冻结记录写的是"预算：用户未明确给出"。按技能规则，缺失预算不能默认解析为 `unbounded`，必须在冻结时解析为用户显式值或一个有可观察单位和阈值的 calibrated-default；如果台账里确实没有这个具体阈值，`scripts/check-gate-state.mjs` 会因为 `resolved_budget` 缺失而 fail closed。这个缺口眼下被信封失效这件更上游的问题盖过了，但等规划者重新决策、审查重新 Freeze 时需要一并补上，否则即使后续技术审查全部 GO，机械门禁检查也过不了。

---

**一句话小结**：这一轮不会继续"改方案→再审"的循环，而是在 Adjudicate 阶段就止步——F-001 的唯一可行修复让原定 3 人日/无新增维护的立项假设不再成立，触发 Decision Envelope 失效，本轮技术结论为 `SUSPENDED`，价值判断交还给规划者，在其重新决策之前不存在有效的实施（BUILD）授权。

---

归档备注（父级）：`implementation_decision` 以自由文本替代了枚举 token `UNCHANGED`（语义正确、含必需的"无有效 BUILD 授权"声明，但逃逸枚举）。据此在 SKILL.md 两轨段补充一句"两轨必须各写一个所列 token；散文只能限定 token，不能替代"。该补充晚于本探针，属最终修订的一部分，已由合同测试保护。
