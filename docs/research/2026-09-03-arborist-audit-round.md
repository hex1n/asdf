# arborist 审计轮：把判断改成产物（2026-09-03）

> 来源：同日对本机全部 arborist 运行的审计（Codex 15 次真实落地、Claude Code 7 次、37 份
> `proofs.md`），方法上延续 [08-30 存档探针](2026-08-30-arborist-stored-data-invariant-archive-probe.md)。
> 本文记录一轮**未完成**的演化：文本改动已落地并经四轮独立证伪收敛，但缺少改后真实运行产物，
> 按 `AGENTS.md` 只能记 continue，不能 accept。

## Round 1

Supersedes: none（08-26 复盘轮的"待验证"两项由本轮审计关闭：文件先于代码 Codex 13/13、Claude 5/5；闭合追加约 26/37）
Improvement magnitude: 待定（文本层面 clear；行为层面无改后样本）
Generalization confidence: low（改后 0 次真实运行）
Hard gates: fail — "a real validation artifact is present" 不满足；其余门（portable、task-facing、narrowest、evidence recoverable）通过
High-stakes escalation: 已做 4 轮 Codex（gpt-5.5，`codex exec --sandbox read-only`）只读证伪；r1 REJECT → r2 REJECT → r3 ACCEPT-WITH-EDITS → r4 REJECT（三条文本缺陷已修，决定性一条为验证产物缺失）
Relative delta: not scored

Task sample:

- project: `salesfundmp`（Java 8 + MyBatis）与 `sofarpc-cli`（Go）的既有运行存档，作为基线
- command: 事后读 transcript 与 `.scratch/*/proofs.md`；无改后运行
- baseline artifact: `evals/arborist-2026-09-03-audit-round/arborist-audit-2026-09-03.md`（ignored）
- candidate artifact: `skills/arborist/SKILL.md` 工作树改动；diff 存 `evals/arborist-2026-09-03-audit-round/arborist-round-diff.patch`
- validation artifact / diff: `node scripts/check-all.mjs` 每轮通过（39 tests）；Codex 证伪 r1–r4 存同目录 `codex-falsify-result*.md`；**改后真实运行：无**

## 审计基线（22 次真实运行 + 37 份 proofs.md）

| 规则 | 基线 |
|---|---|
| Step 0 L0 快路 | 0/22 走过；一行改动 13–24 分钟全流程 |
| critical 判定 | 存档 11/37 写出；3 份 critical 既无读者也无 NEEDS-DECISION |
| 守恒项 mutation 实跑 | 10/37；8/37 拿 Intended Change 修复前的红冒充；7 份"必须红"计划未执行 |
| 独立读者 | 12/37；每次启用都有发现（批量 mapper `now()` 旁路、恒绿夹具、误删校验、周末 MODIFY/DELETE 静默 no-op、聚合赎回漏洞） |
| digest | 记了没人查；sofarpc 的 ledger 在 digest 后被原地改写 |
| proofs.md 先于代码 | 稳定成立 |
| append-only | 用户看不懂："proofs.md 这个不都完成了吗 我看里面的状态还是没变呀" |

根因判断：被跳过的规则都只活在实现者脑中，跳过时没有东西变红；唯一有效的机制（读者）有效是因为它检查文件。

## 改动（全部在 `skills/arborist/SKILL.md`）

- Step 0：L0 工作流第 1 步先写四条件与证据；新增 Completion（分支前写下，promoted 进 proofs.md 头部）。
- Step 4：文件头部 `Task:` / `L0:` / `Critical:`；守恒项行自带 mutation 与恢复步骤；full Impact Ledger 存同目录；
  `Digest: sha256:<hex>` 在最后一条预注册行后追加，Step 5 追加义务后刷新，Step 6 校验最后一个；
  文件散文随会话语言、固定 token 保持英文；Closure 表由 Step 6 在证伪后追加，修复后追加新行、末行为准；
  "each Conserved Set item gets its own mutant; the red an Intended Change shows before its fix is that change's proof"。
  scratch 位置改为"仓库已忽略的位置或树外临时目录"，改 ignore 配置需授权。
- Step 6：读者为正向默认；五项清单每项带 anchor（命令、输出摘录、文件行），空 pass 不算结果；
  含 digest 复算、枚举搜索重跑并扩到所有写法、每守恒项 mutation 重跑并说明如何违反属性、删除守卫处置、
  diff 对照头部与标识符；派不出读者时 handoff 写明尝试的机制与失败原因；Completion 改为列表。
- 未按 Codex 建议删除的一句："The file's prose follows the conversation's language"。
  理由：今早用户观察到 13/36 份 proofs.md 为英文（"现在我看怎么我生成的proofs.md 都是英文的"），
  用户裁定"改 术语可以不用中文化"；进入依据是 Rule Harvest Gate 的观察失败，状态 provisional。
- 成本：SKILL.md 2614 → 3105 词（+19%）。Step 4 仍是最长的一步，重组属重设计，未做。
  仅在 Step 4 内加了 `### Oracles` 与 `### The pre-registration file` 两个小标题切分两类内容，语义与顺序不变；
  是否外提文件规格到模板文件，等下 5 次运行看头部/digest/Closure 的出现率是否落后于其它项再定。

## Codex 证伪四轮抓到并已修的缺陷

r1：digest 在头部内只覆盖三行、Closure "one row per line" 自指递归、读者清单可空填、"子代理从文件继承语言"是无依据断言。
r2：Step 0 Completion 在 Step 4 前无处可写、守恒项行未要求写 mutation、读者只引红不引恢复后绿、Closure 生命周期不可执行、digest 未指明算法、"asked" 让单 agent 也要找人。
r3：Closure 排在证伪之前、L0 的 Completion 与 handoff 时序矛盾、"ignored" 位置在无 ignore 的仓库里会引入无关 diff、读者不可用无回执。
r4：L0 "entire workflow" 列表漏了记录步骤、Step 5 追加义务后 digest 未覆盖、读者的红需归因到属性。

四轮未被反驳的部分：L0 条件未放宽（每轮都尝试 enum/schema/auth/lock 反例失败）；无项目词汇泄漏；核心方向"更好"。

## Wins（文本层）

- 四类被跳过的判断（L0、critical、每守恒项 mutation、digest）各有了一个文件位置和一个消费者（读者清单）。
- 读者从"环境提供时"变为默认，且输出有形状约束。

## Regressions

- 正文加长 19%；L0 多了四行记录（Codex r4 认为对真正的 L0 任务是额外负担，已把它并入 L0 第 1 步以消除"entire workflow"矛盾，负担本身保留）。
- 语言规则保留但未验证。

## Weakest gate or lowest-confidence claim

没有改后真实运行。头部/清单会不会被空填（Goodhart）只能由真实运行回答。

## Round 1 · 改后第一次真实运行（同日下午，salesfundmp）

任务：维护回放申购份额按 4 位落账（17 行生产代码、2 个测试）；Claude Code 会话 `5bb58962`，
06:43 进入 arborist，07:40 派出独立读者，07:57 用户将读者杀掉，08:02 用户："复盘一下 这执行得太久了 这个任务整了1个多小时了"。
产物存 `evals/arborist-2026-09-03-audit-round/round2-baseline/`（proofs.md、ledger.md、head-check.summary、实现者写的 7 条改进提案）。

按 Round 1 验收 oracle 逐项读 proofs.md：

| 项 | 结果 |
|---|---|
| 头部 `Task:`/`L0:`/`Critical:` | 有，四条 L0 各带证据，`Critical: yes` 带理由；非空填 |
| `Digest:` | 有，随 Step 5 两次追加各刷新一次，Closure 后再刷新（共 4 个） |
| 每守恒项 mutation 行 | 5 条 CS：CS-1、CS-4 真跑并记录红/绿摘录；CS-1 首版断言只看账本合计，变异不红，补断言后才红（Step 5 追加行记录）；CS-2 降级为 residual risk；CS-3 inspection；CS-5 写 `oracle: implementation`（不是两种 oracle kind 之一）且无 mutation |
| Closure 表 | 有，7 行；标 self-verified |
| 读者 | 派出，brief 要求重跑全部变异，等于再排 4 次构建；用户中止；工作树残留 `// MUTANT CS-4`，靠事先备份的 `hook.fixed.java` 还原并再跑一次绿 |
| Critical + self-verified → NEEDS-DECISION | **未出现**：整个会话没有 NEEDS-DECISION 字样；用户在 handoff 前打断 |

成本：9 次 Maven 运行 × 约 3 分钟（`-pl app/test -am` 每次重编 13 个模块），一条串三次构建的前台命令撞 10 分钟超时；
45 类交付 profile 3 个既有失败（在 HEAD 上只重跑 3 个失败类确认）、4 个名单类在工作区不存在被 `-DfailIfNoTests=false` 静默跳过。

判断：Round 1 的文本改动在真实运行里被执行了（头部、digest、Closure、至少两条真实 mutation），
Goodhart 空填未出现；暴露的新失败模式是**证明成本按义务数线性放大**、**读者把构建者的变异再付一遍**、
**读者中止后变异体残留**、**断言观测不到变异写入的值**。Round 2 针对这四条。

## Decision

- **continue**。验收 oracle（写在 plan 里）：下 5 次真实运行事后抽查——头部四行 5/5、critical 判定 5/5、
  读者派出或 self-verified 带回执 5/5、每守恒项 mutation 行引用红/绿 5/5、Closure 表 5/5、
  proofs 写作占工具调用 ≤ 25%；读者发现率归零而模板 100% 填写即反转，转向 stdlib 检查脚本或回滚。
- 更便宜的先行样本：在 `salesfundmp` 上重跑一个存档任务（同任务）加 `sofarpc-cli` 一个 Go 任务（异域），
  Codex 与 Claude 各一，按同一口径读 proofs.md。

## Round 2

Supersedes: none（叠在 Round 1 未提交改动之上；触发点是 Round 1 的第一次真实运行）
Improvement magnitude: clear（文本层：读者默认零构建、变异证据落文件并绑定最终树、复核中止有还原协议；行为层待验）
Generalization confidence: low（仅 Java/Maven 一次运行；Go/Python 只做了思想实验）
Hard gates: fail — "a real validation artifact is present" 对改后文本不满足；其余门通过（portable、task-facing、narrowest、evidence recoverable；`check-all` 每版通过）
High-stakes escalation: Codex（gpt-5.5，`codex exec --sandbox read-only`）五轮：r1 REJECT → r2 REJECT → r3 REJECT → r4 REJECT → r5 **ACCEPT**
Relative delta: not scored

Task sample:

- project: `salesfundmp`（Java 8 + Maven）份额落账精度任务，会话 `5bb58962`，见上节
- command: 事后读 proofs.md、transcript、实现者提案；无改后运行
- baseline artifact: `evals/arborist-2026-09-03-audit-round/round2-baseline/`（proofs.md、ledger.md、head-check.summary、提案、改前 SKILL/REFERENCE 副本）
- candidate artifact: `skills/arborist/SKILL.md`、`skills/arborist/REFERENCE.md` 工作树改动；逐版 diff 存 `round2-skill-diff-r{1..5}.patch`、`round2-reference-diff-r{1..5}.patch`
- validation artifact / diff: `round2-check-all-{before,after,after-r2..r5}.log` 全部 exit 0；Codex 提示与结果 `round2-codex-falsify-{prompt,result}-r{1..5}.md`；**改后真实运行：无**

### 对实现者 7 条提案的处置

| 提案 | 处置 | 落点 |
|---|---|---|
| P1 按预算裁剪变异 | 拒绝。`Runs:` 头部只记成本（命令、实测时间、运行次数）；"cost alone never drops a proof"。r1 证伪指出"预算不可承受"无人定义会被 agent 自裁停工，r2 起删除预算权 | SKILL 第 4 步头部 |
| P2 合并运行、长命令落日志 | 采纳。IC 基线红按 native command 合跑一次；每个变异一次运行带全部检查；超前台上限的运行以后台任务或用户启动方式执行并写日志 | SKILL 第 4 步；REFERENCE |
| P3 断言与变异同路径 | 采纳收窄版：CS 行写明变异写入的值与读取它的断言；"ask what implementation keeps the check green under its mutation; if one exists, move the check" | SKILL 第 4 步 |
| P4 读者静态/动态拆分 | 用更强形式替代（见下） | SKILL 第 6 步 |
| P5 复核隔离与还原 | 采纳。读者只在隔离副本（worktree 或目录副本，按记录的 diff 命令逐字节核对）重跑；做不出副本就不重跑；中止后构建者只还原读者的变异体，其它差异只报告 | REFERENCE |
| P6 既有失败分类 | 采纳：本轮引入 / 既有（只重跑该失败类） / 名单缺席（容忍缺失的过滤器静默通过，必须点名） | REFERENCE |
| P7 促升≠逐条构建 | 删除（P1 的复述） | — |

### 用户中途提出的观察及其结果

"之前那个任务相当于自己做了一次测试+变异，然后读者又做了一遍测试+变异。"
这句改变了 P4 的方向：不是把读者的重跑变"可选"，而是把变异证据做成可核验的产物，让读者默认不构建。
最终契约（REFERENCE `Repository-native Verification`）：

- 变异证据 = `mutants/<ID>.patch` + 一次命令序列（应用补丁 → 跑检查 → 还原补丁 → 再跑）的完整日志；日志开头记测试命令、diff 命令、变更 diff 的 sha256、补丁的 sha256。
- "变更 diff" 定义一次：工作树对基线修订、含新增文件、由一条记录的命令生成以便逐字节复现。
- 第 6 步第 3 项：读者重算两个 digest，核对补丁改的是守恒项守的生产代码而非检查、红是该项自己的检查失败且消息能被性质解释、日志显示先应用后红、先还原后绿；缺文件/digest 不符/红解释不了 → 在隔离副本重跑并补存；critical 另抽跑"错了代价最大"的一条。
- 读者报告先落文件再开始任何重跑。

### Codex 五轮各自抓到并已修的缺陷

r1：预算阈值无人定义可致自裁停工；第 4/6 步 Completion 因此矛盾；多变异合跑归因不清；无 worktree 时回退到共享检出变异；"compare tree against diff" 无定义；"test host" 非通用词；日志重定向不能免于前台超时。
r2：存储证据未绑定最终树（实现后路径可能被绕开）；NEEDS-DECISION 项与 Step 6 Completion 矛盾（Round 1 遗留）；恢复会覆盖用户合法编辑；隔离副本对未跟踪文件无法核对；共享构建缓存；"每条 IC 基线红一次运行"过度概括；读者报告未落盘；补存缺失文件未要求；抽跑"of your choosing"可挑软柿子。
r3：diff 生成契约（staged/unstaged/untracked/CRLF）未定义；第 3 项仍量化 NEEDS-DECISION 项；把 IC 的红贴进日志冒充变异需明说"该项自己的检查"；计时句与第 0 步时序矛盾；"diffing the copy against it" 不可执行；Python editable install 逃逸副本。
r4：补丁与执行无因果绑定（从未应用的补丁 + 真实红绿对）；一句冗余（"The written file is what Step 6 closes against"）。
r5：无新反例；ACCEPT。

### Wins（文本层）

- 读者默认零构建，独立性由产物核验承担；critical 只多一次构建。
- 变异证据从"摘录"变成可重算的文件契约，审计中的"IC 红冒充变异"在补丁文件上直接可见。
- 读者中止不再留下变异体（只在隔离副本构建），构建者的恢复动作有定义且不破坏合法编辑。
- 成本可见（`Runs:`）但不再是裁剪证明的理由。

### Regressions

- SKILL.md 3111 → 3436 词（+10.4%）；REFERENCE 855 → 1360 词。Codex r5 未再找到可删句。
- 证据契约变重：一次变异要写补丁、记两个 digest、一条命令序列。是否会被空填或手写，只能由真实运行回答。
- 内部一致的伪造（补丁、日志、digest 一起编）明确放在威胁模型之外，只靠 critical 抽跑。

### Weakest gate or lowest-confidence claim

- 没有改后真实运行。最先该看的：`mutants/` 目录与带 digest 的日志是否真的出现；读者是否零构建完成并给出锚点；`Runs:` 是否推动了合并运行（本任务 9 次应降到 4 次左右：IC 基线红 1、CS-1 1、CS-4 1、交付 profile 1）。

### Decision

- **continue**。验收 oracle：下一次 salesfundmp 任务（同域）加一次 Go/Python 任务（异域），事后读 proofs.md 与任务目录——`Runs:` 行 2/2、`mutants/*.patch` 与日志 2/2、读者报告文件 2/2 且零构建或仅一次抽跑、总构建次数 ≤ 义务数的一半。
  任一域出现手写日志或 digest 空填即反转，转向审计轮预留的 stdlib 脚本方案（apply → run → reverse → run，脚本写日志）。
