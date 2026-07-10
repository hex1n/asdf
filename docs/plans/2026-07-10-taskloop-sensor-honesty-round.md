# taskloop 传感器与基底诚实轮

Date: 2026-07-10
Source: 本日语料收割(`~/.taskloop/outcomes.jsonl` 当日 9 行 + Claude/Codex 双侧 session
语料扫描 + 现场 task.json/history 核验)→ 候选 C1–C9 → Codex `gpt-5.6-sol`(xhigh)
对抗式审查裁决(C1/C2/C4/C5/C6 成立;C3/C7/C9 部分成立;C8 不成立;另 5 条漏项与
优先级重排,全部采纳)。
Mode: Plan / Standard+
Status: 方案已定,未落地。落地按 meta-loop 纪律一轮一任务。

## TL;DR

上一轮(2026-07-09 trust-layer-hardening)解决"承诺落在能承载它的层上";本日语料
证明下一层问题:**承载层自身的传感与记录是坏的**——传感器说谎(判据输入盲区记
`coverage:"full"`,直接绕过 P1-1 弱判据闸门并串联到当日业务仓库的 ADR 违背返工链)、闸门
误发(redirectTargets 扫正文,≥11 次误拒教会 agent 自授 `envelope:*`)、计量表
重复计数(episode/token 虚高 ~20 倍)、状态基底无原子性(双 runtime 并发裸写
task.json)。本轮不加新机制,**修复已有机制的读数与执行可信度**。

## 批 0:活体处置(先于一切代码,人执行)

`86db1b4f`(目标业务仓库)在用户转向后 goal/criterion 未重瞄,与最新意图
相反,判据死锁:审查读取时已 41 episodes / rounds 21 仍在爬升。处置:

```
node "C:\Users\hexin\bin\taskloop.mjs" abandon --repo "<目标业务仓库路径>" --reason "用户转向后 goal/criterion 未重瞄,与最新意图相反;判据死锁 21 轮。经验教训归 C5,重开新任务承接"
```

随后按当前真实意图重开新任务,判据现写现红。不 amend 旧任务——其 41 个 episode
是 C3/C4 的回归 fixture,原样留档。

## 行动计划(判据均 repo-owned `node --test taskloop/tests/taskloop.test.mjs`,keep-green 护航)

### 批 1(P0,传感诚实,~9h)

| 项 | 改动 | 判据(出生即红) | 工时 | 风险 |
|---|---|---|---:|---|
| P0-A | 判据输入解析:`/c/…`↔`C:\…`↔`/C:/…` 归一;路径形 token 解析失败 → 新 provenance 档 `unresolved`(泛化,不做 `/c/` 特判);零输入判据 coverage 记 `unknown` 且 open/amend 警告;`weakCloseBlocked` 把 state-dir 与 unresolved 都算弱 | ①`/c/` 绝对路径指向 state-dir 脚本 → provenance=state-dir,无 review 非 provisional done 被拒 ②EncodedCommand 判据 → coverage≠full + open 警告 ③既有 repo 相对路径流程 keep-green | 4h | 中(动收口闸门,31 例套件护航) |
| P0-B | sticky suspend + rounds 长牙:机器 suspend 落 `task.suspension` 对象 + 账本 `state:"suspended"` 事件行(不混 open/done 终局行);suspension 存在或 `spent.rounds≥budget.rounds` 时 hookPretool 拒写(读/验证永远放行,与 writes/wall/tokens 同构);新增 `resume --reason` 清除 suspension 并落痕 | ①机器 suspend 后写 → deny 且消息含 resume 指引 ②`resume --reason` 后写放行 ③超轮预算拒写但读放行 ④suspended 事件行入账 | 5h | 中(过度拦截,翻盘条件兜底) |

### 批 2(P1,闸门精度 + 基底,~8h)

| 项 | 改动 | 判据 | 工时 | 风险 |
|---|---|---|---:|---|
| P1-A | `redirectTargets` 只认真实重定向算子+可信路径 token,忽略 `2>&1`/`>&2`/`>/dev/null`,不扫 here-string/patch 正文;`looksLikeWrite` 不再把带 stderr 合并的只读命令当写;os.tmpdir 下的写不入 untracked 追踪 | 当日真实误报 fixture:补丁正文含 `> <字段名>` 形字符串、`2>&1` 只读命令、here-string patch → 不 deny;真实 envelope 外重定向写 → deny;`touched_files` 不再混入正文碎片伪路径(单词、引号等) | 5h | 低 |
| P1-B | `saveTask` 临时文件+原子 rename;`loadTask` 解析失败 → stderr 响亮警告,不静默走"无任务"路径(审查漏项 1) | ①撕裂 JSON → hook 输出 state-unreadable 警告 ②win32 rename 覆盖语义测试 | 3h | 低中 |

### 批 3(P1,意图载体 + 记账,~8h)

| 项 | 改动 | 判据 | 工时 | 风险 |
|---|---|---|---:|---|
| P1-C | `amend --goal --reason`;stuck/suspend 提示语加"方向变了→amend --goal/--criterion";resume banner 展示当前 goal(C5,转向的机器载体) | amend --goal 落 amendment、banner 含 goal、help 更新,三例 | 2h | 低 |
| P1-D | 记账重构(按 sol 修正案):token 按 transcript identity 存持久 cursor,增量只计一次;机器 suspend 不再关 episode(挂 suspension,episode 只在真实换 session/终局时关)(C3) | 双 session 交替 + 多次 suspend 的 replay fixture → episode 数=真实连续段数,token 合计≈transcript 正则总量 | 6h | 中(schema 增量,不回填旧账) |

### 批 4(P2,卫生,~9h)

- **P2-A**(C6+C7+漏项 3/4,4h):`;` 与 `,` 同校验;零匹配 envelope 条目警告
  (不硬拒,可预授新文件);修 `WHOLE_REPO_GLOB` 与 `globToRegExp("*")` 语义矛盾;
  所有 envelope 扩张(含 `app/**` 级)落 grants,带 pattern/reason/granted_by。
- **P2-B**(漏项 5,2h):open 先验证新任务可落地再归档旧任务,或归档按 ID 幂等。
  判据:失败的 open 不产生重复 history。
- **P2-C**(C9 最小解,3h):`open/amend --criterion-file <repo相对路径>`:免 shell
  tokenize、文件自动进指纹、provenance 从其位置判定、账本可读。项目级 profile 缓建。

**合计 ~34h ≈ 4–5 天。**

## 最佳性检查

| 检查项 | 答案 |
|---|---|
| 判准 | ①只修已观测的具名失效,不加新机制不加人肉守卫 ②fail-open 信任模型不升级(不进 kit trusted 层) ③每项出生红判据、repo-owned 测试 ④账本 append-only 不回填 ⑤先止血后修根 |
| 胜出机制 | 传感诚实(P0)→ 闸门精度(P1)→ 记账与意图载体(P1)→ 卫生(P2),批序采纳 sol 重排 |
| 最接近替代 | 按原 C1–C9 顺序逐条修——被审查否决:C8 数据已被 C2 误报污染;C4 现场 41 episodes/21 rounds 失控证明其急迫性高于 C2 |
| 翻盘条件 | P0-B 写拒绝一周内误挡真实工作 >1 次且消息引导无法化解 → 降级为仅 stuck-suspension 拒写、超预算只警告;P1-B 发现并发丢更新(非撕裂)频繁 → 升级文件锁 |
| 边际止损 | 不做 criterion DSL、不做账本迁移、不做签名/隔离(kit 探针零触发)、token 只求量级正确 |

## 明确不做/暂缓(带证据)

- **C8 入口升级**:sol 证伪计数(nudge 多为 `2>&1` 只读误报污染)。预注册探针:
  P1-A 落地后干净遥测跑一周,"多文件 untracked 写且零 open"仍 ≥2 会话 → 才升格。
- **C7 乱码检测器**:存储侧为完整 UTF-8,乱码两次现场复现均坏在读取端管道
  (GBK console)。先造可重复失败用例,否则不写检测器。
- **Loop Engineering Kit(qwer DESIGN.md)的签名/隔离 runner/CI 分域**:探针零
  触发,维持"威胁目录,不施工"。本轮采纳其原则而非机制:传感覆盖即信任根、
  盲区必须响亮失败、闸门精度决定边界存亡。

## 裁决点

1. 批 1 落地后:`taskloop audit` 复读一周账本——unresolved-provenance 是否浮出;
   弱收口闸门误伤 ≤1 次/周,超则调参。
2. 批 2 落地后:重测 C8(干净遥测),按预注册探针裁"入口是否升格"。

## 关联

- 上游:`docs/plans/2026-07-09-taskloop-trust-layer-hardening.md`(承诺分层)
- 审查:Codex `gpt-5.6-sol` session `019f4b2b-b3f3-78b2-9601-1d8f8357fa05`
  (对抗式审查,只读核验,裁决与漏项全文见该 session 归档)
- 当日证据:`~/.taskloop/outcomes.jsonl` 2026-07-10 九行;
  目标业务仓库的 `.taskloop/task.json`(86db1b4f 活体)与 `.taskloop/history/`
  归档;Claude 会话 `04a4e71b`/`bb16103f`;Codex 会话 `019f49ae-d4ad`
