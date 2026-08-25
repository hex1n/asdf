# TDD 与 AI 编码代理 —— ChatGPT 对话存档

> 来源:https://chatgpt.com/share/6a7d2703-17d4-83e8-868d-3d646c3a1de1 (2026-08-13)。
> 对话由一张文章截图触发 —— Birgitta Böckeler,《TDD inside the agent loop -
> theater or actual value?》,martinfowler.com "Exploring Generative AI" 系列:
> https://martinfowler.com/articles/exploring-gen-ai/tdd-in-the-agent-loop.html
> 截图内容与原文核对见下节;ChatGPT 回应逐字保留,其中与原文不符处已标注。

## 一句话结论

ChatGPT 的论点:Agent 自己写测试、自己实现、自己判定通过,只是"自己出题、自己
考试、自己宣布满分"(即标题里的 theater);TDD 在 AI 时代应被重新定义为**验证
协议**——人定义不可误解的行为约束 + Agent 快速实现 + 外部验证闭环,信任根必须
是外部系统。原文的实证结论更进一步:盲评下 agent-loop TDD 对代码质量**没有可
辨增益**,非 TDD 方案反而略高(详见"原文核对"节)。

## 原文截图内容(触发对话的图,逐字)

文章开头列出 TDD 与 AI 编码结合的三种用法:

> 1. **Human writes the tests**: A human defines the test scenarios in some
>    form, be it in natural language, in BDD style, or directly in code. Then
>    AI writes the implementation to make those tests pass (with maybe a first
>    step that transforms the human's scenarios into code).
> 2. **Review checkpoint for the human**: AI writes a failing test, human looks
>    at it to review that the test is testing the wanted behavior, then AI
>    writes the implementation
> 3. **Fully inside the agentic loop**: Prompt an agent to write failing tests
>    first, one by one, and then write the implementation and check that the
>    previously failing test is green.
>
> At this stage, that last usage is by far the most common one. But does it
> really make a difference, asking an agent to follow a TDD workflow fully
> inside its own loop? Does it really provide value, or is it one of the rare
> examples where what's good for the human might be irrelevant or bad for a
> coding agent?
>
> I created an exploratory evaluation setup to scratch the surface of this
> question and see what I would find. It is far from a comprehensive and
> structured eval result, but it did create some hypotheses to think about if
> you are working hard to get your agent to use TDD.

## 原文核对(2026-08-13,对照 martinfowler.com 全文)

ChatGPT 的回应有两处与原文不符或缺失:

- **"作者认为(模式一)是目前最可靠的模式"是 ChatGPT 编的**。原文只说模式三
  "by far the most common",没有对任何模式下"最可靠"的判断。
- **ChatGPT 完全没提原文的实证部分**——而那才是文章的主体。评测设置:大中小三
  个 greenfield 业务逻辑任务,带/不带 TDD 指令各跑两遍,Sonnet 4.6 写代码,
  Opus 4.8 盲评质量,附 80% 覆盖率要求。**结果:带不带 TDD 指令看不出质量差
  异,非 TDD 方案在设计与测试质量上反而略高**。作者的假设:非 TDD 运行先做完
  整设计(架构、数据类型、边界)再写码,而 TDD 的增量切片会把早期设计决策锁
  死且不再回头修正。
- 作者的实际建议:放弃对 agent 的规定性 TDD 指令;改用 mutation testing 监控
  回归质量、静态分析/代码评审触发重构、探索 "Approved Scenarios" 之类的信心
  构建手段。结语:"the role of TDD as we've known it is significantly smaller
  than pre-GenAI."

也就是说,ChatGPT 的"验证协议"重构方向与原文精神一致(信任根外置),但原文的
实证结论比 ChatGPT 的转述更激进:**连 agent 内部的增量 red→green 循环本身,
对代码质量都未见增益,甚至可能因过早锁定设计而有害**。

## 与本仓库的关联

- 对话点名了本仓库的 loop engineering 工作:verify gate、failure signature、
  trust root、blast radius 正是在回答"谁来证明 Agent 的结果是真的正确"。
- 模式二(AI 写 failing test → 人审核测试是否表达了正确需求 → 再实现)对应一
  个廉价检查点:在 red 与 green 之间由人确认测试内容。核对结果(2026-08-13):
  个人 `tdd` skill(`~/.agents/skills/tdd`,非本仓库资产)只有 seam 级确认
  ("Test only at pre-agreed seams…confirm them with the user"),red 测试内容
  本身没有人工审核门;防自证的 anti-tautology 规则由 agent 自查,不是人工门。
- 原文实证结果与该 `tdd` skill 的核心规则有张力:skill 强制 vertical slices
  ("one test → one implementation → repeat"),而原文的假设恰恰是这种增量切
  片让 agent 过早锁定设计、事后不再修正,盲评中非 TDD 方案设计质量反而略高。
  若要采纳原文建议,方向不是给循环加规则,而是质疑"让 agent 在自己 loop 里跑
  TDD"这件事本身,把信心构建移到外部(mutation testing、静态分析触发重构、
  Approved Scenarios、人工审核 red 测试)。
- 后续:照原文设置对该 `tdd` skill 做了受控 A/B(协议
  [2026-08-13-tdd-skill-ab-protocol.md](2026-08-13-tdd-skill-ab-protocol.md),
  结果 [2026-08-13-tdd-skill-ab-results.md](2026-08-13-tdd-skill-ab-results.md)):
  方向与她一致且更陡——正确性无差异、盲评四评审零分歧地把对照臂排前、
  TDD 臂多花 ~45% tokens,并出现一例"把规格勘误用测试钉死"的穿透两层
  绿灯的真 bug。

## 对话正文(ChatGPT 回应,逐字)

这张图讨论的是一个很有意思的问题:

**"TDD(测试驱动开发)放进 Agent Loop 里,到底是真正提升代码质量,还是只是人类工程师时代的仪式感(theater)?"**

作者是 Birgitta Böckeler(Distinguished Engineer, AI-assisted delivery)。核心问题是:**人类需要 TDD 的原因,是否同样适用于 AI Coding Agent?**

文章列了三种 AI + TDD 模式:

### 1. 人写测试,AI 写实现(Human writes tests)

流程:

```
人定义测试场景
        ↓
AI 根据测试实现代码
        ↓
测试通过
```

例如:

人:

> 当用户余额不足时,支付应该失败,并返回余额不足错误。

AI:

```java
@Test
void should_fail_when_balance_insufficient() {
    ...
}
```

然后实现业务代码。

这个模式本质是:

**人负责定义行为边界,AI负责填实现。**

作者认为这是目前最可靠的模式。*(存档注:此句原文没有,见"原文核对"节。)*

---

### 2. AI 写失败测试,人审核,再实现(Review checkpoint)

流程:

```
AI 创建 failing test
        ↓
人检查测试是否表达正确需求
        ↓
AI 实现
        ↓
Green
```

类似:

```
Red → Human Review → Green
```

这里 TDD 变成了一个**人和 Agent 的交接点**。

价值:

- 防止 AI 测错东西
- 给人一个低成本检查点
- 避免直接接受 AI 的设计假设

---

### 3. 完全 Agent 内部 TDD Loop

流程:

```
Prompt Agent
↓
Agent 写 failing test
↓
Agent 实现
↓
Agent 运行测试
↓
通过
```

也就是:

```
AI 自己 Red
AI 自己 Green
AI 自己判断完成
```

作者的问题:

> 这种 TDD 对 Agent 真有价值吗?

---

## 关键争议

传统 TDD 对人的价值:

### 1. 强迫人思考需求

人写测试的时候,会问:

- 什么是正确行为?
- 边界是什么?
- 异常是什么?
- 哪些情况不能发生?

TDD 最大价值不是测试,而是**设计反馈循环**。

---

但是 Agent 不一样。

Agent 的问题不是:

> "不知道怎么写代码"

而是:

> "不知道什么代码才是正确的"

所以:

如果 Agent 自己生成测试:

```
Agent:
我觉得应该这样测试
↓
Agent:
我实现一下
↓
Agent:
测试通过
```

可能只是:

```
自己出题
自己考试
自己宣布满分
```

这就是标题里的:

> theater(表演)

---

## 和你的 Loop Engineering 很相关

你之前设计 asdf/taskloop 的核心,其实正好踩中了这个问题。

你的方向不是:

```
Agent:
写代码
跑测试
完成
```

而是增加:

```
外部可信反馈
```

例如:

```
Plan
 ↓
Execute
 ↓
Verify
 ↓
Review
 ↓
Correct
```

区别:

### 普通 Agent TDD

```
Agent
 ├── 写测试
 ├── 写代码
 └── 判断成功
```

信任根:

❌ Agent 自己

---

### 可信 Agent Loop

```
Agent
 |
执行
 |
外部验证
 |
真实反馈
 |
修正
```

信任根:

✅ 外部系统

例如:

- Maven test
- Checkstyle
- SpotBugs
- Sonar
- integration test
- API contract test
- database migration test
- benchmark
- human approval

---

## 我认为文章里最重要的一点

对于 AI Coding:

**TDD 不应该被当成开发流程,而应该被重新定义为"验证协议"。**

传统:

```
Test → Code → Refactor
```

AI时代更应该:

```
Intent
 ↓
Executable Specification
 ↓
Implementation
 ↓
Independent Verification
```

测试不是为了指导 AI 写代码。

测试是为了限制 AI 自由发挥。

---

## 放到你的 Java 后端场景

例如收益挑战赛清算:

需求:

> 赎回 30 天内手续费 0.5%,超过 90 天手续费 0。

不要让 Agent:

```
自己设计 fee test
自己实现 fee calculator
自己验证
```

风险:

它可能:

- 测试覆盖自己的错误理解
- 忽略 FIFO
- 忽略 T+N
- 忽略分红再投资

更好的 Loop:

```
业务规则文档
      ↓
人工确认关键case

例如:

Case1:
买入100份
30天赎回50份
手续费=?

Case2:
多个lot FIFO

Case3:
分红再投资后赎回

      ↓

Agent生成测试

      ↓

Agent实现

      ↓

真实历史数据回放验证

      ↓

人工review
```

这里 TDD 才产生价值。

---

## 我的判断

这篇文章的问题非常准确。

结论:

- **TDD 对 Agent 不是无价值**
- 但是"Agent 自己执行 TDD"价值有限
- 真正有价值的是:

> 人定义不可误解的行为约束 + Agent 快速实现 + 外部验证闭环

所以未来 AI 工程最佳实践可能不是:

```
AI-TDD
```

而是:

```
Specification Driven Development
+
Verification Driven Agent Loop
```

这和你之前做的 Loop Engineering 方向其实比单纯"让 Claude Code 写测试再写代码"更接近未来生产级模式。你关注的 **verify gate、failure signature、trust root、blast radius**,本质上是在解决这篇文章提出的问题:**谁来证明 Agent 的结果是真的正确,而不是只是测试通过。**
