# Value Gate + Decision Envelope — Evolution Round

**问题**: 最佳方案不一定值得实施；技术审查 GO 不等于应该 BUILD。一个真实会话先投入大量上下文与多轮审查把方案收敛到技术 GO，之后才发现完整实现收益偏低、已有机制可低成本覆盖主要需求——经济性判断晚于深度规划和审查。
**核心变更**: first-principles-planner 在 Constraint Split 之后新增 Value Gate 硬门禁（输出 `BUILD | DEFER | NO_BUILD | RESEARCH_FIRST` 的 Decision Envelope）；plan-review 新增 Entry Gate（上游 BUILD 或明确 correctness-only 才进入循环）、GO/BUILD 两轨分离、信封经济性失效退回规划者、冻结时预算三选一解析。
**产物类型**: skill evolution round
**验证状态**: 见文末验证一节

## Round 1

Supersedes: none
Improvement magnitude: clear（S3 为 large；S2 无回归；S1/S4/S5 为 clear——判断依据见逐样例对比）
Generalization confidence: high（S5 第二领域样例 + S1/S3 源领域样例同时通过；plan-review 侧 S3/S4 两个不同领域场景）
Hard gates: pass
High-stakes escalation: 触发（改动路由描述文本 + 跨两个技能 + 共享契约规则）——Codex 独立证伪结果见下
Relative delta: +4 / 5 样例改进或持平，0 回归（趋势记录，非验收依据）

Task sample:

- project: `asdf-skills`（合成双领域行为探针，非源项目场景）
- command: fresh-context 子代理逐样例执行「读取技能原文 → 处理固定场景提示词」；基线 = git `15fffe7` 技能文本，候选 = 本轮工作树文本
- baseline artifact: `docs/research/2026-07-13-value-gate-probes/baseline/`
- candidate artifact: `docs/research/2026-07-13-value-gate-probes/candidate/`
- validation artifact: `node --test skills/plan-review/tests/*.test.mjs`（47/47），`node --test scripts/plan-review-eval/eval-infra.test.mjs`（16/16），相对链接/锚点闭包检查通过

## 观察到的失败模式 → 对应最窄规则

| 失败模式（基线证据） | 新规则（位置） |
|---|---|
| S3：上游已判定"收益不足不建设"，plan-review 仍进入完整冻结 → full-depth 最强第二模型派发准备 | Entry Gate：上游非 BUILD → `DEFERRED`，不进入循环（plan-review SKILL.md） |
| S3：预算未给时按"发现即进展、继续循环"原文执行 = 隐式无限预算 | 冻结时预算三选一解析；缺省永不解析为 unbounded（plan-review SKILL.md Exact Gate） |
| S1/S5：方向正确（不建）但无正式终局决策、无可下传契约，仍输出大篇幅规划形态 | Value Gate 硬门禁 + Decision Envelope；DEFER/NO_BUILD 收敛为紧凑 Decision 输出，不运行方案合成与锦标赛（planner SKILL.md 步骤 4） |
| S4：经济性被审查修复击穿时，基线靠模型自身判断走到 needs-input 三选项（非确定性，仍留在审查循环内） | 信封失效强制条款：suspend + 价值判断退回规划者，禁止把经济性已变的方案审到 GO（plan-review SKILL.md 步骤 4） |
| GO 语义漂移风险：GO 被读作实施授权（源会话根因） | 两轨输出 `technical_verdict` / `implementation_decision`；GO 不携带实施优先级（plan-review Entry Gate） |
| 候选探针中 2/5 样例即兴填写非 BUILD 信封的 review 字段 | `review_scope`/`review_budget` 仅在 BUILD 下绑定，否则 n/a（planner REFERENCE.md）——本轮内的窄修复 |

## 逐样例对比（决定性差异）

1. **S1 低频+已有替代（数据管道自动重放）**：基线不建完整模块但以完整 Plan 形态输出（优先级表/锦标赛表/行动计划），无决策 token。候选 `DEFER` + 信封 + 明确不运行锦标赛与方案合成；首屏即决策。
2. **S2 高频+重大影响（支付幂等）——无回归检查**：两臂同为完整深度规划 + 独立锦标赛升级；候选额外产出 `BUILD` 信封（review_scope: implementation-authorization），可直接进入 plan-review Entry Gate。深度规划路径未削弱。
3. **S3 技术连贯但上游 NO_BUILD（审查入口）**：基线进入循环并准备昂贵派发 + 隐式无限预算；候选在 Freeze 之前 `DEFERRED`，零 reviewer 派发，两轨输出 + 用户重新进入的两条显式路径。本轮最大差异。
4. **S4 审查修复改变经济性**：基线 needs-input + 三选项（方向对、非确定性）；候选条款驱动——引用信封失效条款与 REFERENCE 判例，`SUSPENDED` + 退回规划者重跑 Value Gate，拒绝 fix/accept-risk/笼统 needs-input 三条歧路。
5. **S5 第二领域（年执行两次的内审归集自动化，已有人工清单）**：候选 `DEFER` + 完整信封 + 紧凑 Decision 输出，通过 Generalization Gate（与源领域无共享词汇；信封字段在两领域同构成立）。

诚实记录：当经济事实在提示词里显眼时，基线规划器已能给出正确方向（S1/S5"暂缓"、S4 needs-input）——本轮的净增量是把这一行为从"模型判断力"固化为"技能协议"：正式终局决策、可冻结下传的契约、入口拦截与确定性的失效退回，并消除隐式无限预算。源会话的失败恰恰发生在协议缺位处（审查入口无价值检查）。

## Generalization Gate

- 双领域：数据管道事故自动化（软件/数据）vs 内部合规审计归集自动化（行政流程）；plan-review 侧迁移计划（S4）vs 自动重放计划（S3）。
- 可移植正文仅使用中性词汇（candidate、revision、envelope、status quo、runbook、reconciliation layer 作为通用示例词）；无源项目名称、字段、会话 ID 或机器本地路径（已扫描确认）。
- REFERENCE 示例以两个背离领域的同构对比呈现（低频+成熟人工兜底 → DEFER；高频不可恢复损失+无安全人工遏制 → BUILD）。

## 保留行为核对（未削弱）

Exact Gate 同修订完整 GO、blocker sweep → complete review、独立第二模型/深度要求、稳定 finding ID 与父级逐项验证、material edit 使旧 GO 失效、focused recheck 不能关闭最终 gate、缺证据/reviewer 失败/预算耗尽绝不视为通过、round receipt 成本记录——全部保留；`a round count alone never closes or suspends the gate` 与 `New or narrowing findings are progress and continue the loop` 原句保留（后者语境从"无预算时"改为"解析后的预算内"）。商业价值重算未塞给 reviewer：Entry Gate 与失效条款只消费/维护上游决策契约。

## 高风险升级：独立证伪（Codex CLI，read-only）

Codex CLI 0.144.1（`codex exec --sandbox read-only`，约 103k tokens）对首版候选返回 **NO-GO**：4 blocker、4 should-fix、1 optional。父级逐条独立验证与处置：

| ID | 严重度 | 发现 | 父级验证 | 处置 |
|---|---|---|---|---|
| F1 | blocker | "用户表达实施意图=用户拥有 BUILD"构成 Value Gate 旁路，重开原失败模式 | confirmed | fix：审查请求（含"实施前审查"措辞）永不创建 BUILD；无信封时问一次"是否已判定值得建设"，仅用户明确确认可记录为用户拥有的 BUILD |
| F2 | blocker | "校准默认"预算无单位无阈值=操作上无界；checker 无预算字段，规则仅是散文；"裸轮数"与预算到期语义冲突 | confirmed | fix：预算必须带可观察单位+阈值；`check-gate-state.mjs` 新增 `resolved_budget` 校验（缺失/畸形/未授权 unbounded 均 fail closed，4 条负向测试）；澄清"冻结预算到期是预算事件，不是裸轮数" |
| F3 | blocker | 两轨状态模型表达不全：无 NONE；UNCHANGED 在信封失效后可被误读为"BUILD 仍有效"；S3 已出现 `不适用` 逃逸 | confirmed | fix：`technical_verdict` 增加 `NONE`（未进入/中途撤回）；写死 UNCHANGED 语义（未授予未改变任何东西；失效后报告必须声明无有效 BUILD 授权直至规划者重定） |
| F4 | blocker | S1/S5 候选产物早于 n/a 规则（未验证最终修订）；部分归档为摘要而非全文 | confirmed | fix：全部修复落地后在最终修订上重跑五个探针，完整原文归档（见"终版探针"一节） |
| F5 | should-fix | Value Gate 在赢家尚不存在时判断"赢家"，可能按用户提议的昂贵机制误判 DEFER | confirmed | fix：按建设族最便宜可信机制判断；族级经济性难分时继续到选项重构、赢家确定后再冻结信封 |
| F6 | should-fix | 边际增益停止可能在计划必备内容（回滚/权限/验收证据）完成前终止 | confirmed | fix：停止条款限定为选型精化；明确"停止比较机制、补全所选路径的计划必备内容" |
| F7 | should-fix | 上游 DEFER + 明确 correctness-only 请求同时命中两条入口分支，无优先级 | confirmed | fix：明确 correctness-only 请求优先于非 BUILD 上游决策（handoff 样例 3 语义） |
| F8 | should-fix | 幅度/最窄声明夸大；信封语义跨两技能重复 | 部分 confirmed | 幅度声明按样例校准（本节及逐样例对比已按"协议固化而非新实质决策"表述）；跨技能 YAML 重复为有意的可移植性代价（两技能须可独立安装），由跨安装合同测试守护分歧——rebut 有据 |
| F9 | optional | `ROI` 触发语偏宽，无负向路由测试 | confirmed（风险存在） | accept-risk：该触发语为任务委托方明确指定；描述中已语境化（"worth building or worth doing now"），记录于此待真实误路由证据出现再收紧 |

修复后验证：合同+gate 测试 51/51（新增 4 条预算负向测试），eval-infra 16/16（closing-pass 夹具已含 `resolved_budget`），链接/锚点闭包通过，三运行时安装副本字节一致。

## 终版探针（证伪修复后的最终修订，F4 整改）

全部五个样例在最终修订上重跑，完整原文见
`2026-07-13-value-gate-probes/final/`：

- **S1**：`DEFER` + 信封（`review_scope: n/a` ✓），按最便宜可信机制给出轻量预检脚本替代（F5 修复可见），无支撑分析拖尾，明显比首版候选紧凑。
- **S2（无回归）**：`BUILD` + 信封（implementation-authorization / 标准一轮评审预算），完整深度规划、锦标赛升级、反演测试全保留。
- **S3**：Entry Gate 拦截 → `DEFERRED`；正确引用"审查请求永不创建 BUILD"（F1 修复）、区分 `DEFERRED`/`NOT_READY`、主动核对 correctness-only 优先级（F7 修复）；两轨输出 `technical_verdict: NONE` / `implementation_decision: DEFER`（F3 修复）。
- **S4**：信封失效 → `SUSPENDED` + 价值判断交还规划者；主动指出冻结状态缺 `resolved_budget` 将被 `check-gate-state.mjs` fail closed（F2 修复在行为上可见）。残留偏差：`implementation_decision` 以正确语义的自由文本替代枚举 token——据此在两轨段追加"token 必写、散文只能限定不能替代"一句（合同测试保护），该句晚于本探针，未再重跑（窄措辞加固，不改变任何分支语义）。
- **S5（第二领域）**：`DEFER` + 信封（`review_scope: n/a` ✓），紧凑 Decision 输出，锦标赛不运行。

## Final Decision

Improvement magnitude: clear（S3 large：入口拦截使昂贵审查循环零启动；S4 clear：判断力行为固化为条款驱动；S1/S5 clear-但主要是协议固化与输出收敛；S2 中性=目标即无回归）
Generalization confidence: high（双领域规划样例 + 双场景审查样例全部通过；跨技能信封契约由跨安装测试守护）
Hard gates: pass（最终修订探针证据完整归档；51/51 + 16/16 测试；链接闭包；三运行时副本字节一致；无源项目实例泄漏）
Independent falsification: Codex NO-GO → 9 项发现全部裁决（7 fix / 1 部分接受+rebut / 1 accept-risk）→ 修复后终版探针复验通过

Decision: **accept**。

残余风险与后续观察：

- S4 归档备注中的 token 纪律句子未经独立复验（provisional 项；下一次真实 plan-review 会话可顺带验证）。
- `ROI` 触发语的误路由风险（F9）保留观察；出现真实误路由即收紧为短语级信号。
- 探针为决策点行为探针，未测量完整多轮审查循环的端到端成本差；真实会话的成本对比留给日常使用数据。

## 验证

```sh
node --test skills/plan-review/tests/contract.test.mjs skills/plan-review/tests/gate-state.test.mjs   # 47/47
node --test scripts/plan-review-eval/eval-infra.test.mjs                                              # 16/16
# 相对链接与锚点闭包：脚本化扫描两技能全部 .md —— 全部可解析
# 安装副本字节一致：~/.claude、~/.codex、~/.agents 三运行时 diff -rq 通过（含合同测试内置校验）
```

Wins:

- 低收益方案在昂贵规划与审查之前终止（S1/S3/S5）。
- 技术 GO 与实施 BUILD 在输出与状态上分离（S3/S4 两轨输出）。
- material revision 改变经济性时确定性重新规划（S4）。
- 预算缺省不再静默无限（S3 基线原文 vs 候选冻结解析）。
- 高收益方案仍获完整严格审查与深度规划（S2）。

Regressions:

- 无观察到的回归；S1 候选输出仍带支撑分析段（非最紧凑形态），记为可接受残留。

Weakest gate or lowest-confidence claim:

- 探针为"决策点行为探针"（在 reviewer 派发前止步），未跑完整多轮真实审查循环的成本对比；DEFER/NO_BUILD 的输出紧凑度改善幅度中等（S1）。

Decision:

- accept（依据与残余风险见上文 Final Decision 一节）。

## Round 2 — Description 同义词收紧

Supersedes: none（Round 1 之上的独立路由文本轮；用户明确要求，含"合同测试不作为约束"）
Improvement magnitude: marginal-但符合接受条件（消除真实 context load：planner description 150→120 词，去掉 8 个堆叠中文变体；plan-review 88→81 词）
Generalization confidence: 高于单样例（12 用例两臂对照，被删变体占正例 5/9），但每臂单次运行，方差未测
Hard gates: pass（基线臂先行捕获；被删变体全部保留在 REFERENCE 中文路由表=渐进披露下沉，无信息丢失）
High-stakes escalation: 触发（路由文本变更）——Codex 结果见下

变更内容：

- planner description：按分支收拢——最佳方案/还有更好/优化方案/架构演进（best-plan 分支）、先写方案/先不写代码/先不coding（plan-first 分支）、是否应该/取舍（取舍分支）；删除 `最佳实现, 给出方案, 先不要写代码, 不coding, 不要直接改代码, 最佳了吗, 审查计划, 审查方案`；负路由指针改写为 "reviewing or falsifying one existing plan (计划评审, 方案评审 — use plan-review)"。
- plan-review description：删除 `收敛到无问题`（与 `审查到通过` 同分支重复）与 "/subagent"（fallback 已在同一 description 后半句表达）。
- 合同测试同步：`收敛到无问题` 断言替换为 `证伪/多视角审查现有方案`；FPP 交叉断言更新为新负路由措辞。

证据：`2026-07-13-value-gate-probes/routing/`（用例、两臂 description、结果矩阵）。两臂 12/12 一致，被删变体经分支语义继续命中，裸 ROI 负例两臂均不误触发。

### Round 2 独立证伪（Codex CLI，read-only，约 62k tokens）

首版收紧返回 **NO-GO**：1 blocker + 2 should-fix，逐条裁决：

| ID | 严重度 | 发现 | 父级验证 | 处置 |
|---|---|---|---|---|
| D1 | blocker | 收紧误删旧负路由中的 code review 排除：「用第一性原理 review 这段代码」会命中 `第一性原理` 且无让路，与正文 Anti-Pattern 矛盾 | confirmed | fix：负路由列表恢复 `code review`；用 reviewer 反例原句做两臂行为复验（两臂均 none） |
| D2 | should-fix | 探针未隔离删除项：无英文被删触发用例（implementation strategy）、无 code review 负例、无接缝用例、无最小对 | confirmed（部分整改） | fix：描述恢复 `implementation strategy`（正文 Route Examples 仍认领它）；追加 4 个针对性用例两臂重跑（16/16 持平）。未整改部分：乱序多次运行的方差测量——记为残留局限 |
| D3 | should-fix | 测试改动引入重复断言（证伪/多视角审查现有方案 ×2），且未保护 `second-model review before implementation` 与 code review 排除 | confirmed | fix：去重并改为保护 `second-model review before implementation`；FPP 交叉测试补 `code review` 排除与 `implementation strategy` 断言 |

Codex 同时确认：8 个被删中文变体全部存在于 REFERENCE 中文路由表；双向互指指针对称；research/diagnosis/implementation/ADR/skill-audit 排除完好。

### Round 2 Decision

修复后：合同+gate 测试 51/51，三运行时副本字节一致，两臂 16/16 路由持平（含 D1 反例）。最终 description：planner ≈122 词（原 150），plan-review ≈81 词（原 88）。

Decision: **accept**。marginal 幅度 + 修复真实 context load 成本，符合"marginal 仅当消除真实成本/噪声时接受"的决策规则。

残余风险：路由方差未测（每臂单次）；D1 修复未跑第二轮完整 Codex（按 reviewer 处方原样恢复被删排除项并以其反例行为复验，记为该轮收口证据）；`upgrade decision` 英文触发折叠进 adopt/replace/tradeoff 分支未单测。

## Round 3 — 去实施切片：Planner 收敛到方向级产出

Supersedes: none（Round 1 之上的产出高度修订；用户观察触发："第一性原理技能生成的计划是较大方向、无法直接实施"，据此去掉任务切片；随后用户追加"上线顺序也可以去掉"）
Improvement magnitude: clear（S2 输出从"逐切片验证 + 上线顺序 choreography"收敛为"方向 + 可观察验收 oracle + 最便宜翻转检查"；决策质量无损失）
Generalization confidence: 中（Plan 模式仅 S2 一个样例反复验证；DEFER 路径样例不受本轮影响）
Hard gates: pass
High-stakes escalation: 触发（规则删除）——Codex 第三轮结果见下

### 变更内容

1. SKILL.md Hard Gate："shrink it to a vertical slice or a decision" → "a decision plus its first check"。
2. SKILL.md 步骤 7 边际停止锚点："first verification slice" → "next verification step"。
3. SKILL.md 步骤 8："what changes, in what order, and why" → "what changes and why"（用户追加指令）。
4. REFERENCE.md Plan Synthesis：删除纵向切片段与 "Dependencies and sequencing" 条目；替换为两段方向级契约——下一步验证（"能翻转决策**或重塑所选机制**的最便宜检查；薄 spike 仅当无更便宜证伪手段，且翻转条件先于运行写明"）与 BUILD 计划的**验收 oracle**（"证明目标结果的可观察结果 + 关键边界/失败路径，以观察表述而非任务分解；顺序敏感风险以约束点名，任务级切片与排序归实施会话"）。
5. 合同测试：新增 9 条断言（正向锚定新契约短语 + 负向钉死 vertical slice / Dependencies and sequencing / in what order / verification slice 不回流）。

### 保留"下一步验证"的实证依据（本地会话核查）

全盘扫描 ~/.claude/projects 与 ~/.codex/sessions，剔除技能开发/探针会话后，真实使用中该技能的"下一步验证"共 7 条：6 条纯查证（确认事实/拉监控/跑测量/问 owner），1 条带明确翻转条件的有界 spike（构建类决策的合法证伪形态），零条退化为任务分解。结论：保留该锚点；spike 形态促成锚定句的"最便宜翻转检查 + 翻转条件先行"措辞。

### Codex 第三轮独立证伪（read-only，约 114k tokens，NO-GO → 修复）

| ID | 严重度 | 发现 | 父级验证 | 处置 |
|---|---|---|---|---|
| R3-1 | blocker | 删切片段连带删掉了唯一的验收 oracle 规则：去切片后 S2 输出只剩"并发/重试模拟测试"这类不可证伪表述（基线有"并发两次回调→恰好一次扣款"） | confirmed | fix：新增方向级验收 oracle 契约（可观察结果+边界路径，非任务分解）；最终复验中 S2 产出显式"验收标准（Acceptance oracle）"小节，三条可观察结果+并发边界路径 |
| R3-2 | should-fix | "翻转决策"过窄：BUILD 后合法首检常是重塑机制细节而非翻转 BUILD/DEFER；"薄 spike"无界定 | confirmed | fix：放宽为"翻转决策或重塑所选机制"；spike 必须先写明翻转条件 |
| R3-3 | should-fix | "Dependencies and sequencing"条目与新锚定句直接矛盾；反分层保护消失 | confirmed（一半已由用户"上线顺序也去掉"指令先行消除） | fix：删条目与"in what order"；顺序敏感风险改为"以约束点名"，不做 choreography |
| R3-4 | should-fix | 新测试只保护短语不保护行为（旧切片文本+锚定句混合体可通过） | confirmed | fix：增加 4 条负向断言钉死旧机制不回流 |
| R3-5 | should-fix | 锦标赛升级缺失不可归因于本轮文本（无因果路径），但"单次方差"未被证明 | confirmed（部分） | 处置：最终修订再跑一次 S2——升级触发。修订后 2/3 次触发 vs 修订前 2/2，样本不足以定论，记为观察项；升级门禁文本全程未改动 |

### 复验（最终修订，S2-r3-final.md）

五个验收点全部通过：BUILD 信封完整；下一步验证="读文档即可，不需要起 spike"（自发拒绝过重形态）；显式验收 oracle 小节（三条观察+边界路径）；无上线顺序 choreography；锦标赛升级触发。测试 51/51；三运行时副本字节一致；规划器全文 slice/切片/sequencing 引用零残留（根因追踪表的运营约束项与锚定句本身除外）。

### Round 3 Decision

Decision: **accept**。

残余风险与观察项：

- 锦标赛升级触发率的方差（修订后 2/3）——无文本因果路径，留给真实使用观察；若真实会话中 Deep+高代价场景漏触发，按新一轮处理。
- "顺序敏感风险以约束点名"这半句未被单独样例验证（S2 最终复验中该场景未出现显式点名，迁移安全以评审范围形式出现——可接受但未压测）。
- Plan 模式仅一个样例域（支付幂等）反复验证；第二个 Plan 域样例留待真实使用。

## Round 4 — 行动计划 → 范围-成本表（给决策定价，而非排任务）

Supersedes: none（Round 3 之上的同方向修订；用户通过该技能当时的命令入口确认执行，现为 /writing-for-agents）
Improvement magnitude: clear（表语义从"带工时的任务优先级清单"变为"给决策定价的范围分层"；两处真 blocker 由 Codex 拦下后修复）
Generalization confidence: 中（仍仅 S2 一个 Plan 域样例；共 3 次复验运行）
Hard gates: pass
High-stakes escalation: 触发（规则修改+删除）——Codex 第四轮 NO-GO → 修复 → 复验通过

### 变更内容

- Plan Synthesis 开头："operationally specific" → "specific enough to price and falsify the decision"；"Priority by value/risk ratio" 条目删除。
- 优先级表（| Priority | Change | … | + P0/P1/P2 工作项行）→ **范围-成本表**：行 = 决策买到的范围组件，core（决策立足）/ supporting（证据、可观测、闭环）/ optional（可单独再决策，不计入合计）；每条验收 oracle 义务、点名风险、真实约束闭合必须出现在计价的 core/supporting 行；optional 只容纳"省略后 target outcome 仍成立"的工作；层内按价值/风险取舍，跨层移动即重定价。
- 单一真源接线（含量纲修正）：表合计 = 信封 `delivery_and_maintenance_cost` 的**交付分量**唯一来源；维护与机会成本在该字段内并列计价。
- 时序闭环（R4-1）：SKILL 步骤 4 增补——BUILD 信封成本在步骤 8 定价前为暂定值；定价合计实质恶化门禁经济性时，先重跑 Value Gate 再交接，不送审。
- "Lead with actionable content in the first 20 lines" 恢复为有界形态（"decision content leads within the first 20 lines"）——Codex R4-6 证明我最初的"重复删除"理由不准确。
- Contents 行、本地化标签（范围与成本）、合同测试（+9 断言，含语义回退负向钉）。
- 同轮并入：plan-review 源文件的手工编辑（描述尾句去重、depth "at least one" 措辞、Exact Gate self-reread 句去重到 Evidence Loop、REFERENCE 最小信封段简化），合同测试随之更新。

### Codex 第四轮独立证伪（read-only，约 89k tokens，NO-GO → 修复）

| ID | 严重度 | 发现 | 父级验证 | 处置 |
|---|---|---|---|---|
| R4-1 | blocker | 门禁冻结成本与表合计"单一真源"时序矛盾：门禁按 3 天判 BUILD、表定价 12 天时，旧决策无人重跑，plan-review 只见已提交信封 | confirmed | fix：门禁成本暂定 + 定价恶化时强制重跑门禁（SKILL 步骤 4 + Plan Synthesis 双侧接线） |
| R4-2 | blocker | 标量 Effort 合计无法承载"交付+维护+机会成本"三量纲；r4 输出已实际出现维护成本散落信封散文 | confirmed | fix：表合计限定为交付分量；维护/机会成本在信封字段内并列计价——终版复验中信封字段已双分量呈现 |
| R4-3 | should-fix | 层分类可被用于压价：r4 输出丢掉了 r3 已定价的监管闭环行却仍承诺监管风险清零（观察到的完整性回归） | confirmed | fix：义务入价规则（oracle 义务/点名风险/约束闭合必须在计价行；optional 仅限省略不破坏 target outcome）——终版复验中数据清理入 Core、复盘材料入 Optional 且给出显式分类理由 |
| R4-4 | should-fix | 删除 value/risk 优先级失去层内取舍规则（optional 升级场景无重定价要求） | confirmed | fix："层内按价值/风险取舍；跨层移动即重定价" |
| R4-5 | should-fix | Contents 行仍写 "priority table" | confirmed | fix：更新为 scope table |
| R4-6 | optional | "20 行规则重复"的删除理由不准确（SKILL front-load 是排序不是界限） | confirmed | fix：恢复有界形态并订正本记录的理由 |
| R4-7 | should-fix | 测试只拒绝旧表字面、放过语义回退 | confirmed（文本断言的固有上限如实记录） | fix：钉住全部新承重短语 + 负向断言；语义级行为保护仍以复验探针为准 |

### 复验（S2-r4-final.md）

R4-2/R4-3 行为验证通过（义务全部入价、信封双量纲）；R4-1/R4-4 本样例未触发对应分支，由文本+测试保护。锦标赛升级本次为"显式推理后拒绝"（可回退的地基性动作），非无声漏掉——修订后 3/5 次触发、2 次带理由不触发，判断型门禁的正常方差区间，继续观察。

### Round 4 Decision

Decision: **accept**。

残余风险与观察项：

- R4-1 门禁重跑与 R4-4 跨层重定价未获行为样例（需一个"定价后经济性恶化"的场景才能触发；留待真实使用）。
- Plan 域仍单样例（支付幂等）×3 次运行；第二 Plan 域留待真实使用。
- 义务入价规则依赖模型对"省略是否破坏 target outcome"的判断；观察到一次防御性分类正确（复盘材料 Optional），对抗性压价场景未测。
