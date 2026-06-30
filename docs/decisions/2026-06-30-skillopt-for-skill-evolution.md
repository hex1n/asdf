---
status: accepted
---

# 是否用 SkillOpt（或其机制）训练我的 agent skill 文档

**模式**: Decision（adopt 决策，第一性原理）　**深度**: Deep
**输入**: 本会话 deep-research 已验证事实（见 `docs/research/2026-06-30-skillopt.md`）+ 本仓库 `AGENTS.md`。未新增外部源。
**一句话结论**: 不引入 SkillOpt 作训练器；以现有 `AGENTS.md` evidence loop 为骨架，选择性嫁接其三个纪律装置，且仅在"评估信号可客观造出"的切口才试自动训练。

## 决定（action-first）

1. **不把 SkillOpt 当训练器整体引入。** 第一性原理下瓶颈是**评估信号**，不是优化算法；SkillOpt 全部价值押在你最缺的那个原子上。
2. **以 `AGENTS.md` 的 evidence loop 为骨架（选项 C）**，仅嫁接 SkillOpt 三个纪律装置：
   - **rejected-edit buffer** — 记录被拒编辑，防重复犯错（仅当同一失败模式重复出现时启用）。
   - **edit budget** — 每轮只改有限几处（= 你已有的"最窄编辑"）。
   - **留出 gate** — 在留出样本上验证候选（= 你已有的"第二个 diverse sample"）。
3. **`skillopt_sleep` 只当"失败案例线索源"**，从真实会话捞候选失败案例；**它的 rubric judge 绝不作 gate 权威**——gate 永远走 C 的两层 gate + 对抗性证伪。
4. **唯一要先验证的事（flip 点）见下方"下一步验证"步骤 1。** 先花约半天验证它，再谈建任何系统。

## Bestness Check

| 检查 | 结论 |
|---|---|
| 适配标准 | ① 直面"评估信号稀缺"真约束 ② 不破坏可移植 + 反自评分原则 ③ ROI 匹配低频改动 ④ 可独立验证 |
| 胜者 | **D = C 骨架 + 嫁接 SkillOpt 三装置 + B 仅作线索源 + A 仅用于可校验切口** |
| 最近替代 | 纯 C（现状）。D 相对 C 的增量 = 系统化失败捕获 + 一个切口的自动信号 |
| 击败条件 | 若 skill 改动其实高频，或你愿为某 skill 投入造带标注数据集 → A 在该切口自动训练 ROI 翻正，值得升级 |
| 边际停止点 | 跑完"失败账本 + 一次窄评估实验"后若不显著优于纯 C，**停在 C，不再建系统** |

## 下一步验证（成本递增，做完一步再定下一步）

| # | 步骤 | 验证什么 | 成本 |
|---|---|---|---|
| 1 | 选 `java-stack-craft`（代码能否编译/过测试）或 `e2e-test-executor`（断言通过率）的一个**有客观判定**子任务，捞 5–10 个真实历史案例，人工标"当前 skill 做对/做错" | **评估信号能否低噪声稳定造出来** —— 决定全局的 flip 点 | ~半天 |
| 2 | 信号稳 → 在该切口手动跑一轮 edit-budget loop（先不引入 SkillOpt） | 自动信号驱动的改进是否优于纯人工 | 1–2 天 |
| 3 | 信号不稳（noisy）→ 确认退化为"C + 失败账本"，关闭自动训练分支 | 收敛到强化版 C | — |

**失败条件**: 步骤 1 的评估信号无法低噪声判定 → SkillOpt 系自动 gate 对你不成立，D 退化为"C + 失败账本"（这本身是好结局）。

---

## 步骤 1 实测结果（2026-06-30，本会话实跑）`verified`

**信号源发现**: java-stack-craft 自带 `scripts/java_advisory_scan.py` —— 一个确定性、stdlib-only 的 Java 缺陷扫描器，支持 `--fail-on` 作 gate。它本身就是一个现成的"评估信号生成器"（无需 LLM）。

**实验**: 用 `EXAMPLES.md` 的 15 个专家标注 BAD/GOOD 对照（9 个落在扫描器设计覆盖内、6 个为语义/架构缺陷），各跑扫描器，量化判别力与盲区。脚本见 scratchpad `step1_signal_eval.py`。

| 缺陷面 | 案例 | 结果 |
|---|---|---|
| JDK 编译性（J8 中 var/record/text block/switch expr） | 4 | 确定性命中，GOOD 干净 |
| Spring 命名空间（Boot2 import jakarta） | 1 | 命中 blocker |
| 密钥 / Executors 池 / runAsync common pool / printStackTrace | 4 | 命中，GOOD 干净 |
| 语义正确性（wrapper `==`、`BigDecimal(0.1)`、for-each 改集合、空 catch return null） | 4 | **全部漏报** |
| 并发原子性（check-then-act on ConcurrentHashMap） | 1 | **漏报** |
| 架构（单实现套 interface+factory+strategy） | 1 | **漏报** |

- **机检覆盖内 9/9 完美判别，0 误报**；**覆盖外 6/6 盲区**。
- **结论（评估信号分层 YES/NO）**: 能确定性零噪声造出信号的薄子集，**已被确定性规则覆盖 → 不需要训练，且把命中数当 gate 会触发 Goodhart**；真正需要训练改进的语义/架构/并发判断（skill 主体价值）**无低噪声自动信号**。
- **flip 条件未触发**: 在 java-stack-craft 切口上，**自动训练 ROI 为负**——能自动评的不需训练，需训练的不能自动评。决策主体（不整体引入 SkillOpt、以 C 为骨架 + 失败账本）由此获实测支撑，记为 `accepted`。

**实验边界（诚实标注）**: ① proxy 局限——测的是"扫描器分 BAD/GOOD"，非"评估 skill 真实产出质量"，Goodhart 风险真实；② 15 例小样本且由我从 EXAMPLES.md 改写，但 6/6 盲区是结构性的（扫描器无对应规则），非样本偏差；③ "GOOD 零误报"仅对特定样本成立，真实代码误报率 > 0；④ 旁支：跑 skill 自带测试 4 个失败，全为 Windows 路径分隔符硬编码（`/` vs `\`），是 java-stack-craft 的真实跨平台测试缺陷，检测逻辑无误。

## 步骤 1b 实测结果：e2e-test-executor 切口（2026-06-30，本会话实跑）`verified`

**修正上一轮假设**: "断言通过率是天然客观信号"是**错的**——通过率衡量被测系统、非 skill 执行质量，且 skill 纪律明文反对拿它当目标（missing probe→blocked、outage≠pass、不许改业务逻辑求 pass）。真正可自动化的信号是"报告协议自洽性"。

**信号源**: 该 skill **无自带脚本**；REFERENCE.md（l.26-36）明文声称报告 "machine-checkable" 并列出规则。实验自写 report-linter 编码这些规则，对 9 个标注报告样本测捕获边界。脚本见 scratchpad `step1b_e2e_signal_eval.py`。

| 缺陷类 | 样本 | 结果 |
|---|---|---|
| 协议自洽性（非法状态、failed 无 preserved scene、缺 section、Re-run 无命令、diagnosis 散文化、Next Actions 含 CONDITIONAL、freshness=reachable） | 7 | **7/7 确定性捕获，good 0 误报** |
| 报告忠实性（结构完美但 `passed` 实为造假、证据编造） | 1 | **1/1 盲区** |

- **分层**: 可机检层 = 协议自洽性（这里恰是 skill 的核心纪律，linter 作为 CI 守门有真实价值）；不可机检层 = 报告忠实性（passed 真伪、证据真伪、分类对错），无 oracle，需重执行或人工。
- **ROI**: 把协议 linter 当训练 gate → Goodhart（学会产出合规外壳、内容可造假，且造假的正是"是否真执行"）。自动训练 ROI 仍为负。**正向副产品**: 该 linter 值得作为 lint/CI 工具落地（确定性守门，非训练）；e2e-test-executor 当前无 `scripts/`/`tests/`，是真实缺口。
- **实验边界**: linter+样本均我自写（非 skill 自带），属"可机检边界论证"而非"现成信号实测"；未真跑端到端执行（环境无被测系统）；合成样本规整，真实报告上 linter 更脆。

## 两切口收敛结论

| 切口 | 可机检层 | 机检盲区（= 主体价值） | 自动训练 ROI |
|---|---|---|---|
| java-stack-craft | 编译性/命名空间（薄、已被规则覆盖） | 语义正确性、并发、架构 | 负 |
| e2e-test-executor | 报告协议自洽性（厚、即核心纪律） | 报告忠实性（passed/证据真伪） | 负 |

**能确定性机检的都是"协议/编译外壳"，每个 skill 的主体价值都落在机检盲区；任一可机检信号当训练 gate 都触发 Goodhart。** D 方案的"自动训练分支"在两个已测切口均不成立 → 全面退化为"C + 失败账本"。决策主体由此双切口实测支撑。

**剩余开放（已收窄）**: `first-principles-planner` / `deep-research` / `e2e-test-planner` 未单独测，但其产物同为"判断密集、无客观 oracle"，预期同结论；除非出现一个 skill 其产物有覆盖**主体价值**的客观 oracle，否则结论稳定。

---

## 第一性原理分析（archaeology）

### 根问题重构（Five Whys）

表层问的是"能否用 SkillOpt"，往下追：

```text
Stated: 想用 SkillOpt 训练我的 skill
Why?  -> 想让 skill 持续变好、少犯重复错
Why?  -> 手动改慢、靠灵感、不系统
Why?  -> 缺"什么算更好"的客观信号 + 缺把失败沉淀成规则的纪律
Root: 在"质量信号稀缺且主观"条件下，让 skill 文档可靠朝更好演化、不退化、不过拟合单案例
```

### 训练的三个原子（第一性拆解）

任何"训练"= 评估信号 + 变异机制 + 选择 gate。逐一对照：

| 训练原子 | SkillOpt 怎么做 | 你的处境 | 稀缺度 |
|---|---|---|---|
| ① 评估信号（梯度来源） | 自动 hard/soft 打分 + 留出集 | 产出主观、无 ground-truth | **真正稀缺、决定一切** |
| ② 变异机制（怎么改） | optimizer 模型产编辑 | 人/LLM 都能产 | 不稀缺 |
| ③ 选择 gate（留/丢） | 自动严格大于 gate | `AGENTS.md` 已有两层 gate + 对抗证伪 | **已解决** |

**核心洞察**: SkillOpt 自动化了①②③，但其有效性 100% 押在①——而①正是你唯一缺、且因领域本质（主观产出）难补的。文档自承 *"noisy scoring kills the optimizer"*。直接采用 = 在最薄弱地基上盖最重的楼。`verified`（前序 research 实读 `docs/guide/new-benchmark.md`、`env_template.py`、`skillopt_sleep/mine.py`）。

### 约束拆分

| 类型 | 内容 |
|---|---|
| 真约束（不可协商） | skill 产出主观、无客观 ground-truth（领域本质）；skill 必须可移植（`AGENTS.md` 硬门）；作者=评分者偏差必须独立证伪（`AGENTS.md` 已立，第一性上正确） |
| 惯例（可挑战） | "像训练 NN 一样优化 prompt"是 SkillOpt 的框架选择，非唯一路径；"每会话自动演化"是节奏选择 |
| 该丢的假设 | "自动化=更好"（信号稀缺时反而放大噪声）；"必须有训练循环"（也许只需更好的失败捕获纪律） |

### 选项淘汰（pairwise 对真约束）

- **A 照搬主训练器**: 撞"主观无 ground-truth" → 通用方案淘汰；仅在可校验子任务上存活。
- **B skillopt_sleep**: rubric judge 仍是 LLM 自评、信号弱，**不能当 gate 权威**；但能自动从会话捞失败案例，有价值。
- **C 现有 evidence loop**: 过全部真约束；唯一弱点是失败案例靠人记得。
- **D（胜者）= C 骨架 + B 仅作线索源 + A 仅用于可校验切口 + 嫁接三装置。**

### Inversion Test（D 的最强失败模式与防御）

- 把 B 的会话 harvest 当 gate → 噪声编辑。**防御**: B 只供候选失败案例，gate 永远走 C。
- 为可校验切口造 env 工程量 > 收益（改动低频，ROI 可能为负）。**防御**: 先只做最便宜切口验证 ROI，不先建框架。
- 嫁接机制变流程负担。**防御**: 仅"同一失败模式重复出现"时启用 buffer，平时纯 C。

inversion 后 D 成立，且点醒真答案：**D 的轻量版才对 —— 不是建系统，是补"失败案例账本"+ 在唯一可校验切口试一次。**

## 关联

- 证据来源: `docs/research/2026-06-30-skillopt.md`
- 方法论骨架: `AGENTS.md`（Rule Harvest Gate / Skill Evolution Loop / 两层 gate / 对抗性证伪）
