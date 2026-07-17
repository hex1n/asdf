# Plan Review — Depth Drives Independence

**问题**: `review_depth: shallow | full` 被冻结进 gate state 并校验拼写,但不驱动任何东西。
SKILL.md 却告诉读者 full depth 用于不可逆、数据销毁、外部接口、权限、资金路径的方案 ——
读者据此相信高风险方案得到更强的审查,而 gate 对 full 和 shallow 完全等价。
**核心变更**: reviewer 强度重新由 depth 驱动;full depth 不得仅凭同模型 reviewer 闭合,
除非记录一次**真实发生且真实失败**的 second-model 探测。
**产物类型**: skill evolution round
**验证状态**: 见文末

## Round 1

Supersedes: none(c565d0f 的反向,见"反转既有决定"一节)
Improvement magnitude: clear(死字段 → 驱动 gate;有前后可执行证据)
Generalization confidence: 中(机械 gate 行为由 23 条测试覆盖;真实 full-depth 审查的行为未观测)
Hard gates: pass
High-stakes escalation: 触发(删除并替换 checker 规则 + 反转其测试)—— Opus 独立证伪 SURVIVES-NARROWED,最强批评已修
Relative delta: +(趋势记录,非验收依据)

### 基线证据(改动前,对真实 checker 执行)

```
closing fixture, review_depth "shallow" -> {"pass":true,"failures":[]}
closing fixture, review_depth "full"    -> {"pass":true,"failures":[]}   identical
full depth + zero second-model reviewers -> {"pass":true,"failures":[]}
```

最后一行是关键:一个不可逆、走资金路径的方案,按 full depth 审查,由同模型 reviewer 审,gate 放行。

`review_depth` 在 `check-gate-state.mjs` 中仅出现于 `VALID_REVIEW_DEPTHS` 的拼写校验。

### 根因

c565d0f("fix(plan-review): default to fresh-context reviewers")把 reviewer class 与 depth
解耦("Reviewer class is independent of depth"),depth 随之失去唯一作用,但其约 60 词的
校准说明与 gate 字段都留了下来。该 commit 的 checker 更进一步:**主动 fail** 一个未经用户
点名却使用 second-model 的 required reviewer —— 即禁止使用最强的可用证伪者。

这与本仓库 AGENTS.md 第 91 行直接矛盾:
> Prefer an independent runtime for the pass when one is available — e.g. the local Codex CLI
> — over a fresh context of the same model; a different model is a stronger falsifier for
> same-model blind spots.

### 变更

- SKILL.md:reviewer class 随 depth——full depth 在 runtime 有 second-model 时要求它;
  shallow 默认 fresh-context;用户显式请求在任何 depth 覆盖默认;full depth 无 second-model 时
  须**尝试**并记录失败探测,再以 fresh-context 继续(independence-limited)。
- SKILL.md:"The pass condition below is identical at every depth" →
  "Depth changes who must review, never what counts as a pass"。
- checker:删除"未经点名使用 second-model 即 fail"(更强的 lane 是升级,不是失败)。
- checker:新增 full-depth 规则,并要求 `second_model_availability`
  `{available:false, basis, probe_invocation_id}` 链接到一个 `FAILED`/`TIMED-OUT` 的
  second-model receipt —— 复用 diagnostic fallback 已有的证据标准。
- fixture:携带一次真实失败的探测 receipt(R0),示范无 second-model 主机上 full depth 的合法闭合。

### Generalization Gate

规则只用 depth、reviewer class、independence level、probe、basis 等中性词汇。同一规则须同时适配:
一个不可逆的数据迁移计划(full depth,应招募不同模型证伪者),与一个一次性的、可撤销的
内部流程调整(shallow depth,fresh-context 足够)。两者都不依赖任何具体 runtime 名称。

### 反转既有决定(证伪者点名的最公允一击)

我以"c565d0f 没有证据轮"为由反转其意图,自己却也未写证据轮 —— 用被我指责的同一个无记录标准
再决定一次。本文件即补齐。**仍未做**:未询问用户 c565d0f 当初为何解耦。可能的正当理由包括
每轮成本、Windows 上 second-model 可达性、"whenever the runtime has one" 的非确定性、以及
冻结精确 reviewer 集合的确定性价值。本轮保留了其中的实用内核(不可用不再导致 suspend,
而是记录降级),但该询问仍应发生。

### 独立证伪(Opus,fresh context)

verdict: **SURVIVES-NARROWED** / recommendation: keep-narrowed

| 批评 | 父级验证 | 处置 |
|---|---|---|
| 逃生舱是自证词:`{available:false, basis:"<任意句子>"}` 即通过,无任何机器痕迹;而同一文件里 diagnostic fallback 已有严格的 attempted-invocation + FAILED/TIMED-OUT receipt 模板 —— 手握更强模板却未复用。且因文档现在读起来像"已强制",比旧的死枚举**更容易误导** | confirmed(最强一击) | fix:`probe_invocation_id` 必须链接真实失败探测;新增 5 条负向断言 |
| 反转无记录决定时自己也无记录 | confirmed | fix:本文件;未询问用户一项如实留存 |
| 删规则 + 反转其测试 + 自评 = 自我交易 | 部分 confirmed | 反转的两条断言语义确已改变(禁止更强 lane 本身荒谬),但被删规则可能在保护确定性与成本有界——如实记录,未获行为证据 |
| 更窄替代:直接删除 `review_depth` 及其约 60 词 | 部分 confirmed | 未采纳:会丢弃 AGENTS.md 第 91 行原则的唯一挂钩点 |
| 未探索的第三条路:**无视 depth,总是优先 second-model**,同样的披露式逃生舱 | confirmed 为未探索 | 留作下一轮候选;本轮未评估 |
| 是否给"会计堆"又添一笔(用户已指出会计压过对抗性) | 部分 confirmed | 净增约 40 词 + 1 字段;但它是全文件里唯一让"谁来审"随风险变化的机制 |

### 残余风险与观察项

- 探测记录可能成为**永久默认**:若真实主机上 second-model 长期不可达,full depth 会通过一个
  更难察觉的新机制退化为 shallow。需要真实主机可达率数据,本轮无。
- 真实 full-depth 审查中该规则的行为未观测(仅有 gate 层机械证据)。
- SKILL.md 的文本合同测试(`skills/plan-review/tests/`)因 `.gitignore` 的 `tests/` 规则不存在
  于本机,只活在 Mac 上;本轮对 SKILL.md 正文的改动**在本机无测试网**,须在 Mac 复核。

### 验证

- `node --test scripts/plan-review-eval/eval-infra.test.mjs` — 23/23(新增 2 个测试,含 5 条
  探测追溯负向断言;`closing-pass.json` 直接校验 `{"pass":true,"failures":[]}`)。
- 前后行为对照(见"基线证据"与下表)。

| 场景 | 改动前 | 改动后 |
|---|---|---|
| full + 同模型 + 无记录 | pass | **fail** |
| full + 同模型 + 声称 second-model 可用 | pass | **fail** |
| full + 同模型 + 声称不可用,仅一句 basis | pass | **fail**(须点名探测) |
| full + 同模型 + 点名一次从未发生的探测 | pass | **fail** |
| full + 同模型 + 探测其实成功了 | pass | **fail** |
| full + 同模型 + 探测真实 FAILED/TIMED-OUT + basis | pass | pass(independence-limited) |
| full + second-model reviewer | pass | pass |
| shallow + fresh-context | pass | pass(不变) |

### Decision

**accept**(收窄版):depth 现在真实驱动 reviewer 强度,且"不可用"是可追溯事实而非自证词。
未探索的"总是优先 second-model,不分 depth"留作下一轮;询问用户 c565d0f 的原始理由仍待办。

## 同轮记录:对抗性 reviewer 框架候选 —— REJECTED

用户判断:"它应该是一个对抗性的审查,只是带 loop"。诊断有硬数据支持 ——
`refute`/`disprove`/`adversarial`/"try to show" 在 SKILL.md + REFERENCE.md 中**各 0 次**,
而 `budget` 15 次、`invocation` 15 次、`receipt` 12 次;REFERENCE.md 中 Gate-State Checker(382 词)
+ Round Receipt(187)+ Decision Envelope(233)= 66% 是会计。这个 skill 名为"独立证伪",
正文却从未要求 reviewer 去证伪。

候选:把 reviewer 任务框架从 "exhaustively identify blockers" 改为
"defeat this plan; GO is earned only when your attempt to defeat it fails"。
两个领域(财务对账 / cron 迁移)各 2 trial,判别缺陷 0/2 → 2/2,并独有抓到时区静默数据错误、
价值主张自相矛盾等。

Opus 独立证伪:**REFUTED**。父级逐条验证后全部确认:

- **构造效度污染**:两个探针共享同一"验收看不到它要防的失败"母题,而候选正是指导攻击该结构 ——
  所谓"两个背离领域"是一个母题的两件外衣,非独立样本。
- **严重度通胀**:时区那条,冻结证据里无时区信息,按候选**自己的规则**应为 gap 却给了 blocker。
  根因是 "A case you can demonstrate is a blocker" —— 无系统访问权时 "demonstrate" 等于"能讲个
  可信的故事"。
- **广度换戏剧性**:漏掉基线抓到的"oracle 要 p95 runtime 但只记 exit code,整个验收窗口跑不起来"。

按"证伪失败才采纳" → 不采纳,SKILL.md 的 Review 段未改。方向成立,该措辞不是答案。

**下一轮的前置条件**:探针不得由候选作者设计,不得预设"oracle 空心"母题,须含"健康计划"对照组
与盲态第三方裁定。作者自证的探针会被证伪者一眼看穿。

## Round 2 — 真实 session 证据 → 大幅减重候选 → REFUTED(同日第二次)

Supersedes: none(Round 1 之后的独立一轮)
Improvement magnitude: none(候选被证伪,已 revert)
Generalization confidence: low
Hard gates: **fail**(见"作者的程序违规")
High-stakes escalation: Opus 独立证伪 → **REFUTED / revert-parts**

### 新证据:真实使用被找到了

`~/.codex/sessions/2026/07/16/` 存有一次**真实且成功**的 plan-review loop(审 taskloop 的
`docs/decisions/2026-07-16-loop-engineering-roadmap.md`):6 个只读 reviewer session、51 分钟、
4 个 revision(e804ae68 → 5f6f90ba → 167ccf2b → 23449ecb),
blocker-sweep NO-GO ×2 → complete CONDITIONAL-GO ×2 → complete GO。

**被真实执行的**:冻结 sha256、穷尽 blocker sweep、分阶段严重度、六维 rubric **外加两条手加的
候选专属维度**、证据域、根因合并、结构化输出契约、GO/NO-GO。

**当日 9 个 session 中出现 0 次的**:`review-state`、`check-gate-state`、`round_receipt`、
`measurement_precision`、`input_characters`、`resolved_budget`、`technical_verdict`、
`Decision Envelope`、`implementation_decision`。Entry Gate 自 07-13 就在 skill 里,该 loop 于
07-16 完整跳过它。

### 候选(已 revert)

据此把 3235 词减到 2607:Entry Gate 294→145(删 envelope schema、状态 token、两轨报告)、
Round Receipt 187→89、Gate-State Checker 382→100、budget 三选一→散文、
并重新插入 Round 1 已证伪的"对抗性"措辞。

### 作者的程序违规(证伪者的最强一击,confirmed)

**本文件 Round 1 明写"按'证伪失败才采纳' → 不采纳,SKILL.md 的 Review 段未改";一小时后作者把
那句话加了回去,未开新证据轮。** AGENTS.md 明禁此举("accept only when that attempt fails")。
一个被证伪的 redesign 未经流程复活,比候选本身的任何缺陷都严重。作者另在给证伪者的简报中
错误声称"checker 脚本未改"——它当日被作者改过。**教训:被证伪的想法要复活,必须走新的一轮,
不能靠新证据在原地翻案。**

### Claim B 崩塌:"对抗性"一词并未被证明有效

作者原以为存在干净的自然实验(同 revision e804ae68):

| session | 措辞 | 结果 |
|---|---|---|
| 16:44 | 英文,无"对抗性" | 1 blocker |
| **16:46** | **中文,有"对抗性"** | **1 blocker + 1 gap** ← 作者漏看 |
| 17:08 | 中文,有"对抗性" | 2 blockers |

证伪者找出了作者跳过的 16:46(理由是"markers 少")。**同样的对抗性 prompt 一次 1 个、一次 2 个
——这是 run-to-run variance,不是框架效应。** 混杂变量还有中英文。作者当时以"选择性使用证据"
的方式读了自己找到的数据。

### 其余确认成立的批评

- **幸存者偏差**:那次审查是一份 roadmap 转写文档——无资金路径、无迁移、无不可逆动作,且
  **loop 的 driver 正是该 roadmap 的裁决者本人**。"我审自己的低风险文档时跳过了价值门"不是
  门无用的证据,恰恰是两轨报告要防的利益冲突本身。
- **两轨 token → 散文是已知回归**:`2026-07-13-value-gate-decision-envelope-round.md` 的 F3 记录
  显示,散文正是当初失败的形态,修复才引入"token 必须写,散文只能限定不能替代"。退回散文 =
  重演已修过的失败。
- **skill/script 分叉**:候选让 SKILL.md 称 checker"可选",却不再提 checker 仍强制的
  `COST_FIELDS` / `resolved_budget` / `second_model_availability`。已修:REFERENCE 恢复描述这些字段。
- **循环论证**:把 skill 缩成"某人某次实际做了什么"= 把纪律降级为习惯描述。门的价值恰恰在于
  你不想用时它仍然响。规则该因**被执行时失效或误伤**而删除,不因某个从未触及它的领域没用到而删除。

### 保留(证伪者明确认可)

1. **checker 的 depth 驱动 reviewer 强度**(Round 1,SURVIVES-NARROWED,含 probe 追溯);
   本轮补回 SKILL/REFERENCE 对 `second_model_availability`、`probe_invocation_id` 的描述,消除分叉。
2. **rubric 可定制**——真实 session 手加了两条专属维度,而正文从未说过可以;有直接证据。
3. **术语统一**(design or plan / 方案或计划)——事实修正,非行为改动。

### Round 2 Decision

**reject**。SKILL.md 1854 → 1996 词(**净增 142**),减重目标彻底失败。对抗性核心占比仍约 13%。

残余与下一轮:
- "会计占 87%"是**已量化的事实**,但"删它们"缺证据。缺的不是决心,是**一次让那些机制被真正
  执行、然后观察它们失效或误伤的审查**——零使用不是失效证据。
- 若要再试减重,先回答:那 87% 是有意跳过,还是想用而门槛太高?后者的正确动作是降低执行门槛
  (如 checker 从 session 自动提取状态),而非删除机制。
- "对抗性"若要进正文,需要一个**不由候选作者设计**、控制了语言变量、且 n>1 的对照。
