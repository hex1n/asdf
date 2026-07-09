# 最近一周 taskloop 使用评审报告

Date: 2026-07-09
Scope: 2026-07-02 至 2026-07-09, 本机 Codex 与 Claude session 中真实使用
taskloop 的记录。

## 一句话结论

最近一周真正进入 taskloop 账本的使用集中在 2026-07-07 一天:全局账本共有
17 条记录,对应 6 个已完成真实任务和 5 个未关闭的 probe/scratch 任务。
taskloop 已经能承担"落账、判据、收口"的工作,但入口触发仍不稳定:Codex 的
业务实现会话里,两次都是先进入普通实现路径,再由用户提醒"怎么没开
taskloop"后补开。当前最大风险不是 loop 无效,而是 loop 仍然需要人提醒才进入。

## 证据来源

- `~/.taskloop/outcomes.jsonl`: 全局 taskloop outcome 账本。
- `~/.codex/sessions/2026/07/*`: 最近一周 Codex session。
- `~/.claude/history.jsonl` 与 `~/.claude/projects/**`: 最近一周 Claude session。
- 目标仓库局部 `.taskloop/task.json` 与 `.taskloop/history/*.json`。

统计口径:只有 outcome 账本、局部 task state、实际 taskloop 命令能证明真实使用；
仅匹配到 AGENTS/contract 注入文本中的 `taskloop` 不计入真实使用。

复核记录(2026-07-09):账本行数与任务分布、`--files` 逗号串匹配行为、
`--git-allowed` CLI 选项、初稿引用的 commit 哈希,均已对照当前
`taskloop/bin/taskloop.mjs` 源码与 git 历史二次核验,修正处在正文标明。
账本 17 行的构成已核实:6 个真实任务各留 open+done 两行(12 行),
加 5 个仅有 open 的 probe(5 行)。

样本提示:全部真实使用集中在 2026-07-07 一天、3 个会话、6 个真实任务。
本报告按 dogfood 复盘理解,趋势性措辞受 n 限制,不构成使用率趋势结论。

## 总览

| 来源 | 会话/任务 | 仓库 | 结果 | 主要问题 |
|---|---|---|---|---|
| Codex `019f3a92` | `25eb98d0` 字段元数据后端拦截 | `fundsalesmrksupport` | `done` | 先实现,用户提醒后才补开 taskloop |
| Codex `019f3a92` | `18ad74e3` 自定义组织导出排序 | `fundsalesmrksupport` | `done` | 初始实现过复杂,经用户纠偏后复用分页列表路径 |
| Codex `019f3b5b` | `e8acc91c` teamId/playId 口径 | `fundsalesmrksupport` | `done` | 用户提醒后才开 taskloop;判据含 state-dir 适配器 |
| Claude `bf9179bf` | `9fff27b6` Windows 判据执行加固 | `asdf` | `done` | taskloop 自身修复,判据较硬 |
| Claude `bf9179bf` | `d0f52322` 判据来源可见性 | `asdf` | `done` | taskloop 自身修复,后续 commit/push(现历史对应 `b5f1442`) |
| Claude `1d2a75cb`/后台继续 | `58f571e0` 触发加固 | `asdf` | `done` | 机制改进已落地,但还缺新业务会话验证 |
| Claude scratch | `ce96698f`,`69e0296c`,`53102637`,`81dd16fc`,`935d0c1d` | temp dirs | `open` | probe 任务污染全局账本 |

## 会话级内容拆解

### Codex `019f3a92`: 字段元数据拦截与导出排序

#### 用户指令链

字段元数据任务的用户指令是典型的"先分析,再落地,再纠偏":

1. "先帮我看看":要求分析 `FieldMetaFacade.queryFieldMetaByPage` 里原来交给前端的
   `canEdit` 等字段,并把删除/编辑拦截放到后端。
2. "按上面的方案落地":从只读分析切到实现。
3. "怎么没执行我的taskloop":指出 Codex 已经写了代码但没有按契约开任务。
4. "需要判断'赛区未覆盖字段配置'":修正业务口径,不能把条件简化成任意已有战队。

导出排序任务的用户指令更能暴露执行摩擦:

1. "导出战队现在我看排序有点问题呀":提出行为不一致。
2. "感觉为什么实现得这么复杂呢":打断过度方案。
3. "而且条件都还是内存过滤的":指出实现方向仍错。
4. "之前列表查询不是有现成的sql吗?":要求复用现有数据路径。
5. "导出我理解是跟着分页列表来走 包括筛选条件 和排序":给出正确收敛口径。
6. "queryCustomTeamRecordsWithListOrder 我的分页工具有为什么还要单独造一套呢":
   拒绝新造查询/排序工具。
7. "参考一下其他地方的导出":要求按项目既有导出模式做。

#### agent 实际执行路径

字段元数据任务中,Codex 先走普通 Java 实现流程:加载 `java-stack-craft`,阅读 facade、
service、mapper、测试,修改业务代码和测试,尝试跑 `FieldMetaServiceImplTest`。
验证链路依次撞到 `.m2` 沙箱权限、JRE 无 `javac`、设置 JDK 后 `app/test`
历史测试缺失类型,最后降级为主源码编译 + 静态检查。直到用户追问 taskloop,
Codex 才查 `taskloop` 入口,发现裸 `taskloop` 不在 PATH,再定位到
`node C:\Users\hexin\bin\taskloop.mjs`。

补开 taskloop 又经历三段摩擦:

- shell one-liner criterion 被 taskloop 拒绝,因为 criterion runner 不是 shell。
- 完整 PowerShell 路径仍被当成"带参数的可执行文件"而失败。
- `C:\tmp` 写入失败后,临时判据脚本落到仓库 `.taskloop/`。

导出排序任务中,Codex 一开始沿"单独补查询/内存处理"方向推进。用户多次纠偏后,
实现才收敛到最薄路径:`exportCustomTeams` 设置导出分页参数,直接复用
`queryCustomTeams(request)`,让筛选和排序复用分页列表既有 SQL 与分页工具。
taskloop 在 close 时发现 criterion 文件改过,拒绝 `done`;Codex 通过 `amend`
记录"用户要求导出跟分页列表走"后再收口。这是 taskloop 起到正向约束的样本。

#### 摩擦与优化点

- **入口摩擦**:落地指令已经出现,但 taskloop 没有在第一笔写入前启动。
- **技能路由摩擦**:`java-stack-craft` 抢先成为执行框架,但它没有把 taskloop
  open 作为落地前门。
- **判据执行摩擦**:taskloop criterion 与 shell/PowerShell 用户直觉不一致,
  导致临时 `.mjs` 适配器。
- **验证环境摩擦**:Maven 在 Windows + 沙箱 + JRE/JDK + 历史 app/test 基线下
  失败路径很长,需要项目级固定验证命令。
- **方案收敛摩擦**:taskloop 能记录 drift,但不能阻止 agent 先走复杂实现。
  这里真正节省返工的是用户持续追问"为什么单独造一套"。

### Codex `019f3b5b`: teamId/playId 口径落地

#### 用户指令链

这个会话先是领域调研,再进入计划和实施:

1. 分析 `selfProfitRank` 不传 `playId` 是否可行。
2. 追问如果已经有 `teamId`,是否可以反解 `playId`。
3. 扩展到 `AnalyzeFacade` 中战队相关查询是否可不传 `playId`。
4. 要求分析"其他地方都做 teamId -> playId 反解"的影响。
5. 要求列出详情类接口、给出实施方案、检查 `active_time IS NOT NULL` 历史逻辑。
6. 要求落实施计划文档,并开子代理审查计划。
7. 根据审查结果追问 `seasonId + teamId -> playId` 唯一性不足,并补充
   "season 和 teamType 不唯一,因为报名字段选项可能有多个"。
8. "按计划文档落地"后,Codex 仍先进入实现准备;用户随后打断并问"怎么没开taskloop"。

会话中用户还粘贴过带 token 的请求参数。报告不落敏感明文,只记录它说明了
该类 session 需要默认做 token/JWT 脱敏,避免分析报告把凭证持久化。

#### agent 实际执行路径

Codex 前半段执行质量较好:它先做接口/表/历史逻辑分析,产出计划,并用多个子代理
审查计划。子代理发现的关键点包括:

- 不应把已经正确工作的详情接口纳入首批范围。
- `subjectId=null && playId=null` 的默认 tab 契约摇摆。
- `seasonId + teamId` 唯一性前提不足。

这些反馈促使计划收窄:只做 `TeamContextResolver`、`profitRank(subjectId=teamId)`
兜底、`AnalyzeFacade` TEAM membership 口径和相关 mapper/tests,不顺手改变
`rankingList/queryRankingData/querySelfRanking` 入参契约。

进入落地阶段后,同样先漏开 taskloop。补开时出现新的执行摩擦:

- 裸 `taskloop --help` 失败。
- 用较新的 taskloop 入口探测 criterion 格式。
- 因 Windows spawn/cmd.exe 与沙箱限制,部分 taskloop 操作需要升级权限。
- criterion 是 `.taskloop/teamid-context-criterion.mjs`,被标为 `state-dir`。

实现完成后,Codex 跑了更完整的验证链:

- 先跑 state-dir 判据脚本,确认转绿。
- Maven `-Dtest=A,B,C` 在 PowerShell 下被逗号解析打断,加引号后继续。
- `.m2` 权限、JRE/JDK 问题复现;设置 `JAVA_HOME` 后进入真实编译。
- `app/test` 历史基线仍有阻塞,用 `-am -DfailIfNoTests=false` 最终跑到三个新增测试类。
- `taskloop verify` 通过,再记录 `self-reread` review。

自审阶段发现了一个真实语义问题:`subjectId` 为空时现有 `getSubjectId` 会按默认 tab
派生 teamId;新代码如果继续用这个派生值反解 `playId`,会扩大"免传 playId"
契约。Codex 收紧为"只在请求显式传 `subjectId=teamId` 时兜底",并补测试后重新跑验证。

#### 摩擦与优化点

- **计划阶段有效,实施入口失效**:计划审查很充分,但"按计划落地"没有自动触发
  taskloop open。
- **敏感输入持久化风险**:session 分析工具必须默认识别并脱敏 token/JWT。
- **state-dir 判据偏弱**:该任务有真实 JUnit 验证,但 taskloop 的机器判据仍是
  session-authored `.mjs`;收口 review 只有 `self-reread`,应提升到 fresh-context。
- **PowerShell 参数坑可产品化**:`-Dtest=A,B,C` 必须加引号,这应进入项目验证 profile。
- **自审有价值但不稳定**:这次 self-reread 找到了语义 bug,说明 review 有用;
  但靠同一 agent 自审不能替代独立审查。

### Claude `f6169efd`: 本机 v2 安装与 hook 去重

#### 用户指令链

用户先要求"把本机中安装的替换成最新版本",随后在 dry-run 和 settings 内容被读取后,
要求"修根因+加测试再分发"。这不是业务任务,但它解释了后续 taskloop 自身改进的
触发背景。

#### agent 实际执行路径

Claude 先 dry-run `bootstrap/install.mjs`,发现只有 `~/.claude/settings.json`
会 update。继续读取 settings 后,它发现 `PreToolUse` 和 `Stop` 中 taskloop hook
各有两份重复。根因定位到安装器的去重正则仍匹配 v1 历史文件名,不匹配 v2
`taskloop.mjs`,导致每次安装都会再 push 一个 taskloop hook。

后续执行中又暴露了工具层摩擦:

- Edit/Write 多次返回 "updated successfully",但程序化验证发现没有真实落盘。
- `tests/bootstrap_install.test.mjs` 一度显示缺失,说明测试文件创建也出现假成功。
- 只能通过"改完立即程序化验证"确认落盘事实。
- Node 全量套件出现 taskloop 相关预存 Windows 失败,需要区分本次改动与既有失败。

#### 摩擦与优化点

- **工具回执不可信**:任何写文件成功消息都必须用真实读取或测试确认。
- **安装器幂等性要用测试锁住**:hook 去重不是一次性修复,必须有重复安装测试。
- **历史 v1/v2 迁移规则要收口**:去重正则背负历史命名会制造误判;当前产品应明确
  只认 `taskloop.mjs` 或显式迁移旧名。

### Claude `bf9179bf`: 复盘 Codex `019f3a92` 并修 taskloop

#### 用户指令链

该会话从"分析我codex中最新的一个session 会话"开始。用户随后指出
"support项目中单独写了两个mjs 来用于测试 这很奇怪",再要求"给出最佳改进方案"、
追问"上面方案是最佳改进吗",最后下达"开始"和"commit and push"。

#### agent 实际执行路径

Claude 先解析 Codex `019f3a92`,识别出两类问题:

- Codex 没有主动进入 taskloop。
- support 项目里的两个 `.mjs` 不是业务测试,而是为了绕过 taskloop criterion
  执行限制写出的判据适配器。

它随后把问题转化为 taskloop 自身两个任务:

- `9fff27b6`:Windows 判据执行加固,覆盖 glob 假红、受限 env spawn、hooks 路径断言、
  amend UX。
- `d0f52322`:判据来源可见性,包括 session-authored 判据警告、弱判据收口提醒、
  状态目录自忽略。

这两个任务都使用 repo-owned `node --test taskloop/tests/taskloop.test.mjs` 收口。
完成后,用户明确要求 commit/push,Claude 按历史作者提交并推送。

复核修正:session 当时报出的哈希 `86a446f` 在当前 git 历史中已不可解析
(`git cat-file -t` fatal);对应内容现存于 `b5f1442`
(feat(taskloop): win32 criterion hardening + criterion provenance visibility)。
成稿后历史被重写或哈希未经复核,报告证据指针一律应以成稿时可解析的对象为准。

#### 摩擦与优化点

- **好的闭环**:用户指出异常文件,Claude 能把异常归因为 taskloop 产品缺陷,并用
  taskloop 自身判据修复。
- **仍有测试噪声**:Node/Python 套件输出和预存失败需要更清晰的"本次相关/无关"标注。
- **commit/push 授权是会话级明确动词**:这里符合用户明确授权;但 taskloop CLI
  当时没有完整记录 git 授权能力,后续会话又撞到这个缺口。

### Claude `1d2a75cb` 与后台 `4b206a79`: 复盘 Codex `019f3b5b` 并加固触发

#### 用户指令链

用户明确指出新问题:"codex 这个 sessionId ... 分析一下 他不会主动走 taskloop,
需要我显示指定",随后补充"它又在自己造脚本了 --criterion 需要传什么"。
在分析后,用户要求"基于上面分析 使用第一性原理给出最佳改进方案",再说
"上面的除了层4 全部落地"。后台继续阶段用户多次用"继续"推进,最后要求完成后
commit/push。

#### agent 实际执行路径

Claude/后台会话先做深度复盘,确认 `019f3b5b` 的根因不是单点:

- contract 文本存在,但旧文案只说"升档三个入口",没有明确"落地/实现类指令一出,
  第一笔写入前 open"。
- `implement` skill 没有 taskloop 入口,会吸走"按计划落地"。
- 裸 `taskloop` 不在 PATH。
- 已安装 taskloop 与仓库版本存在能力差异。
- state-dir 判据需要更明显的来源警告与收口提醒。

落地时先做实验,尝试用隔离 `CODEX_HOME` 复现 hook deny 是否能回流给模型。但实验发现
hook trust/临时目录别名等环境因素让结果不稳定,于是转向真实历史 rollout 取证。随后
用 taskloop 打开 `58f571e0`,加入无任务写检测、spawn-block 判据分流、契约触发句。

执行中又出现多处摩擦:

- 为红测试追加用例时,第一次未开任务;随后才打开 taskloop。
- 后台长跑任务需要手动停止,否则会持续占用。
- fresh-context review 产生 12 个 findings,需要回灌到实现和测试。
- session 当时 `taskloop amend --git-allowed` 不是可用选项。复核当前 CLI:
  `open` 已支持 `--git-allowed`(强制配 `--git-reason`,`taskloop.mjs:680`/`:777`),
  缺口收窄到 `amend`(选项表 `taskloop.mjs:697-705` 无此项);但 CLI 自己的引导
  文案 `taskloop.mjs:1313` 写着 "Re-open or amend the task with --git-allowed",
  指向一个不存在的 amend 选项——这是 CLI 自我矛盾,不只是契约漂移。
- `done` 因测试文件作为 criterion input 改动而拒绝,必须 amend criterion 后再收口。
- 最终提交并推送(session 报出的 `453598b` 现历史中不可解析,对应内容现存于
  `728f4eb`),但还有一个 hook marker 实验长跑,最后被停止。

#### 摩擦与优化点

- **触发句加固方向正确**:把"落地/实现/修到通过"显式绑定到 open taskloop,
  比抽象"升档"更贴近用户真实指令。
- **hook 实验成本高**:用隔离 Codex 环境验证 hook 行为会被 trust、临时目录、
  PATH alias 等因素干扰;真实 rollout 证据更稳定。
- **CLI 自我矛盾比"契约漂移"定位更准**:`open` 已支持
  `--git-allowed`/`--git-reason`,缺口只在 `amend`;而 `taskloop.mjs:1313` 的引导
  文案自己就建议 `amend ... --git-allowed`。应给 amend 补齐同语义选项,或改掉
  引导文案,二者取一。
- **review 回灌有效但流程重**:fresh-context 找到 12 个 findings,证明值得;
  但需要更清楚的"review finding -> 测试/代码变化 -> amend 原因"链路。

## 关键发现

### F1: Codex 业务会话没有稳定做到"落地前开 taskloop"

两个关键 Codex 业务会话都重复了同一种失败模式:

1. 用户提出实现或按方案落地。
2. Codex 进入普通分析/实现路径。
3. 用户追问"怎么没执行我的 taskloop"或"怎么没开 taskloop"。
4. Codex 才寻找 taskloop CLI、补建 criterion、补开任务。

这说明 contract 已经写进上下文,但在实际技能路由和执行惯性面前权重不够。
对当前 loop 产品来说,这是最高优先级问题:机器机制再完善,如果第一笔写入前
没有进入任务,后续账本只能补救,不能预防。

### F2: taskloop 对"收口可追溯"有效,但不能自动保证方案正确

`18ad74e3` 导出排序任务是正反两面的样本。taskloop 记录了 drift 和 amend:
用户明确要求"导出跟分页列表走,包括筛选条件和排序",判据从内存排序改为复用
`queryCustomTeams` 分页列表路径。这证明 taskloop 能保存口径变化,避免事后
悄悄改判据。

但 taskloop 没有阻止初始方案过复杂。真正把方案拉回正确路径的是用户的产品
与架构判断。结论:taskloop 是执行纪律与证据纪律,不是自动架构审查器。

### F3: 业务判据强度不均衡

`asdf` 中 taskloop 自身任务主要使用 `node --test taskloop/tests/taskloop.test.mjs`,
属于较强的 repo-owned 判据。

`fundsalesmrksupport` 中的业务任务则全部(3/3)依赖 `.taskloop/*.mjs` 判据适配器,
其中不少是源码/字符串断言。这类判据能防止明显漏改,但不能证明真实 DB/RPC
联调、完整 Maven 测试或线上业务语义正确。部分任务 alignment 已经诚实声明
"not covered",这是好的;但 final 或 closeout 里不能把这类绿过度解释成业务闭环。

### F4: Windows 执行摩擦直接制造了临时判据脚本

最近一周的失败链路反复出现:

- `taskloop` 不在 PATH。
- `node`/spawn 在受限环境里失败。
- shell one-liner 不能作为稳定 criterion。
- Windows 绝对路径、`cmd.exe`、EPERM 等执行差异导致假红。

这些摩擦解释了为什么 support 项目中出现 `.taskloop/*.mjs` 适配器。它们不是普通
测试,而是 taskloop 判据适配层。后续 `9fff27b6`、`d0f52322`、`58f571e0` 都是在
修这类失败暴露出的 taskloop 自身问题。

### F5: state-dir 判据需要更高 review 门槛

`e8acc91c` 的 criterion provenance 是 `state-dir`,最后 review level 是
`self-reread`。对业务语义任务来说,这偏弱。state-dir 判据通常由当前 agent
临时写出,天然存在"作者给自己出题"的问题。它可以作为过渡,但收口时应至少配
fresh-context review,并在结论里明确绿只证明哪些约束,不证明哪些外部行为。

### F6: probe/scratch 任务污染全局 outcomes

全局账本中有 5 个 probe/scratch 任务仍为 `open`,例如 `probe`、`g`、
`repro probe`。这些任务对调试 taskloop 有价值,但会污染最近一周使用分析。

这暴露出一个产品层缺口:taskloop 需要区分真实任务与实验探针。否则 outcomes
同时承担审计账本和开发调试日志,后续统计会越来越难。

### F7: envelope 的 `--files` 逗号串是确定性失配,且该样本中 envelope 从未生效

`e8acc91c` 的 envelope 中,多个文件被作为一个逗号分隔字符串传入。复核确认这
不是"可能失配"而是确定性失配:`globToRegExp`(`taskloop/bin/taskloop.mjs:494`)
把逗号当普通字面字符,逗号串 pattern 生成的正则只能匹配路径名里真的含逗号的
文件,即匹配不到任何真实写入目标。

病根还包括文档:`taskloop/README.md:54` 的示例本身就是
`--files "src/**,tests/**"`——README 在主动教这个反模式,修复落点不只在 CLI 校验。

后果按运行时分两种:hook 侧对越界写入是硬 deny(`taskloop.mjs:1340`),在
Claude Code 下逗号串 envelope 会把所有目标内写入误判为越界并拒绝;而
`e8acc91c` 在 Codex 会话中带着这个匹配不到任何文件的 envelope 完成了 19 次
写入、无任何拦截痕迹并正常 `done`——说明该链路上 envelope 强制根本没有生效,
写边界只是账面记录。这比"审计可读性受损"重一档。

应要求重复传多个 `--files`,或者让 CLI 对含逗号的 `--files` 明确报错/拆分,
并同步修正 README 示例。

### F8: 账本遥测字段本身不可信

复核账本时发现两类坏值,报告初稿把账本当可信地基使用而未审计:

- 6 个 done 记录里 5 个 `rounds: 0`(仅 `9fff27b6` 为 1),而同批记录的
  `writes` 高达 19-22、`episodes` 最多 12。轮次计数器几乎不增长,意味着
  "轮次预算"实际没有被记录,更谈不上强制。
- `output_tokens_estimate` 明显失真:`9fff27b6` 记 20,887,104、`e8acc91c` 记
  17,051,414,作为单任务输出 token 不可能成立,估算口径需要重标定。

契约把"预算挂任务上"当一等语义,但账本里预算相关字段是坏的。这与 F6 同属
账本卫生问题,且更隐蔽:probe 污染肉眼可见,坏计数器会被后续任何基于账本的
统计(包括本报告与未来的 audit)静默继承。

## 横向摩擦地图

| 摩擦 | 触发样本 | 影响 | 优化动作 |
|---|---|---|---|
| 落地指令未自动 open | `按上面的方案落地`,`按计划文档落地` 后仍先实现 | taskloop 只能事后补账 | 合约与实现类技能都写明"落地/实现/修到通过 => 第一笔写入前 open" |
| 裸 `taskloop` 不在 PATH | Codex 两次 `taskloop --help` 失败 | agent 转入搜索 CLI 入口,浪费轮次 | 在契约卡给 paste-ready 命令,并保证 installer 创建可用别名或明确不创建 |
| criterion 不是 shell | PowerShell one-liner / 带参数可执行被拒 | 临时 `.mjs` 判据增多 | 文档化 criterion 语法;CLI 对 shell-looking criterion 给可执行错误与改写建议 |
| Windows spawn/EPERM | `cmd.exe`/spawn 受限导致 verify/done 需升级权限 | taskloop 操作噪声高 | 将 spawn-block 诊断分流为明确原因,避免误判为业务红 |
| Maven 环境不稳定 | `.m2` 权限、JRE 无 `javac`、`app/test` 历史基线失败 | 业务验证经常降级 | 为 `fundsalesmrksupport` 建项目验证 profile,固定 JDK、`-am`、引号、`failIfNoTests=false` |
| PowerShell 参数解析 | `-Dtest=A,B,C` 被逗号拆坏 | 假测试失败 | profile 中统一使用 `"-Dtest=A,B,C"` |
| state-dir 判据弱 | `.taskloop/*.mjs` 由当前 session 编写 | 作者给自己出题,绿含义窄 | state-dir close 至少 fresh-context 或标 provisional;优先迁移 repo-owned 判据 |
| 工具写入回执不可信 | Claude Edit/Write 显示成功但文件未落盘 | agent 基于假状态继续 | 写后立刻用读文件/测试/hash 验证关键落盘 |
| probe 污染账本 | temp scratch 中 5 个 open task | audit 统计混入调试任务 | 增加 probe/scratch 分类或 audit 过滤;必要时关闭旧 probe |
| CLI 自我矛盾 | open 支持 `--git-allowed` 而 amend 不支持,`taskloop.mjs:1313` 引导文案却建议 `amend --git-allowed` | 任务中途无法补授 git 权限,引导指向死路 | 给 amend 补 `--git-allowed`/`--git-reason`,或改引导文案 |
| `--files` 逗号串确定性失配 | `e8acc91c` envelope;`README.md:54` 示例教的就是逗号串 | Claude Code 下全部写入被误 deny;Codex 下 envelope 零生效 | CLI 拆分或报错;同步修 README 示例 |
| 账本计数字段坏值 | 5/6 done 记录 `rounds:0`;token 估算达千万级 | 预算语义空转,后续统计静默失真 | 修 rounds 计数与 token 估算口径;audit 前先校验字段 |
| 敏感输入落入 session | `019f3b5b` 中粘贴 token 请求参数 | 报告/工具可能持久化凭证 | session 分析默认 token/JWT 脱敏,报告只记录存在敏感输入 |
| 后台实验长跑 | hook marker 实验长时间未结束 | 会话尾部仍有运行任务 | 实验必须有明确超时/停止条件,final 前清理后台任务 |

## 正向信号

- 6 个真实任务全部最终 `done`,没有靠纯口头声明收口。
- 导出排序任务记录了 criterion drift/amend,说明判据变化有账可查。
- `asdf` 侧的 taskloop 自身修复使用 repo-owned `node --test` 判据,质量明显高于
  临时源码断言。但复核提示:全部 6 个任务中只有 `58f571e0` 收口时有
  fresh-context review,`9fff27b6`/`d0f52322` 的 `review_level` 为 `none`——
  契约允许强判据免 review,但 review 目前是稀缺事件而非常态。
- Claude 会话把 Codex 暴露的问题转化为 taskloop 产品改进,形成了 dogfood
  反馈链。
- `58f571e0` 已经落地无任务写检测、spawn-block 判据分流、契约触发句等加固项,
  但还需要后续新业务会话验证。

## 建议

### P0: 让"落地前 open"成为真正入口

实现类技能和契约触发句都应明确:非微小落地任务,第一笔写入前必须 open
taskloop。仅在 AGENTS 中存在该规则不够,因为实际路由会被 `implement`、
`java-stack-craft` 等技能吸走。

验收方式:找一个新的中等复杂业务实现会话,不显式提醒 taskloop,观察第一笔写入
前是否自动 open。

### P0: 修正 `--files` 逗号串问题

CLI 应二选一:

1. 支持逗号/换行拆分为多个 file pattern。
2. 拒绝含逗号的单个 `--files`,提示用户重复传参。

无论选哪个,都必须同步修正 `taskloop/README.md:54` 的
`--files "src/**,tests/**"` 示例——文档本身在教反模式,只修 CLI 挡不住来源。

这是 envelope 审计能力的基础问题,优先级高于继续扩展报告能力。

### P1: 区分真实任务与 probe

增加 probe/scratch 模式,或在 closeout/audit 中把 temp dir 的探针任务单独分类。
当前 5 个 open probe 不应与真实业务任务混在同一统计里。

### P1: 提升 state-dir 判据收口要求

业务任务若使用 state-dir 判据,建议至少满足:

- final 明确说明绿覆盖什么、不覆盖什么。
- review level 不低于 fresh-context,或显式标记 provisional。
- 能迁移成 repo-owned 判据时,优先迁移。

### P1: 给 `fundsalesmrksupport` 建稳定项目判据

不要每个业务任务临时写 `.taskloop/*.mjs` 字符串检查。更稳的方向是沉淀一个
项目级判据适配器,负责固定 JAVA_HOME/PATH、目标模块、`-am`、`-DfailIfNoTests=false`
等参数,把临时判据缩小到具体测试类或业务断言。

### P2: 做 `taskloop audit --since`

基于 outcomes 直接输出:

- 真实任务 vs probe。
- open/done/suspend 分布。
- criterion provenance 分布。
- review level 分布。
- drift/amend 任务。
- session/transcript 链接。

audit 输出前应先校验账本字段自身可信度(见 F8:rounds 计数、token 估算),
否则坏计数器会被直接搬进统计。

这能把本次人工分析变成可复跑诊断,也能验证后续改动是否真的减少"用户提醒才开 loop"。

## 最终判断

这周 taskloop 不是"没用起来",而是已经被高强度 dogfood 并暴露了四类核心问题:
入口触发、Windows 执行摩擦、判据质量、账本卫生(probe 污染 + 遥测计数字段
坏值)。当前最值得收紧的是入口和判据语义:先保证非微小落地任务第一笔写入前
进入 loop,再保证每次绿色结论都准确表达"绿证明了什么、没证明什么"。

另有一条对报告流程自身的教训:初稿引用的两个 commit 哈希在成稿时已不可解析,
且账本计数字段未经审计就被当作地基——复盘报告引用证据前,指针要现场解析一次,
地基数据要先做一致性抽查。这恰是 F6/F8 指出的问题在报告自己身上的复现。
