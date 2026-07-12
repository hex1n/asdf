# Compact Preflight Forward Pilot

**问题**: 预注册 compact preflight display 后，独立 preflight＋blind primary 能否在新 routine slices 上保持 blocker coverage，并降低上下文输出字符？  
**深度**: Deep  
**核心结论**: 未通过；compact trace 分层有效，但候选 arm 仍增加 67.67% 输出，并出现一个基线漏检的真实 blocker和一个 unsupported finding，说明单次 reviewer 方差仍主导结果。  
**产物类型**: supporting  
**验证状态**: current-state checked  
**开放问题**: 2 - 见文末

## 协议与样本

协议：[2026-07-12-plan-review-compact-preflight-protocol.md](2026-07-12-plan-review-compact-preflight-protocol.md)

三个新 routine slices：

1. 删除确认无引用的 dead export；
2. 将一个测试文件移动到正确目录；
3. 给端口 helper 测试增加真实 re-bind 断言。

每个 slice 都冻结精确行区间。A 使用 blind full primary；B 使用独立 mechanical preflight、看不到 preflight 的 blind primary 和预注册 compact display schema。

## 结果

| 指标 | A | B |
|---|---:|---:|
| Primary raw findings | 1 | 7 |
| Compact failed checks | — | 4 |
| Raw merged records | 1 | 11 |
| Semantic deduplicated records | 1 | 10 |
| Confirmed | 1 | 8 |
| Unsupported | 0 | 1 |
| Duplicate | 0 | 1 |
| Environment noise | 0 | 1 |
| Confirmed blockers | 1 | 3 unique concepts after cross-arm comparison |
| Unsupported rate | 0% | 11.11% |
| Primary characters | 7,098 | 10,577 |
| Compact preflight display | — | 1,324 |
| B merged display | — | 11,901 |
| Full preflight audit trace | — | 5,107（不进入上下文） |
| Exact tokens | unavailable | unavailable |

B compact display 比 A 增加 4,803 字符，即 67.67%。完整 trace 已成功从上下文成本中剥离，但 primary reviewer 本身输出更长。

## 预注册规则

| Rule | 结果 |
|---|---|
| B 不漏 A confirmed unique blocker | pass |
| A 不漏 B primary unique blocker，机械独有增益除外 | **fail** |
| B unsupported rate 不高于 A | **fail** |
| Reviewer invocation 相同且无 specialist | pass |
| B compact merged chars < A | **fail** |
| Full trace 单独报告，不计上下文成本 | pass |
| Token unavailable 时结论最高 provisional | pass with constraint |

正式 verdict：**reject**。

## Material Findings

### A/B 都发现：TOCTOU closure blocker

计划要求真实 bind 测试作为 mandatory green gate，却承认 `pickFreePort()` 返回端口后到 test re-bind 之间存在 `EADDRINUSE` 竞争；计划不允许 bounded retry，因此符合实现也可能随机失败。A 的 `CA-001` 与 B 的 `CB-005` 语义等价。

### B primary 独有：unsupported sequential-port uniqueness

`CB-004` 指出计划连续调用两次 `pickFreePort()` 并要求结果不相等，但 API 只保证每次调用时获得一个可用端口；端口关闭后 OS 可以再次分配同一个端口。该 uniqueness assertion 没有 contract 保证，adjudicator 判为 confirmed blocker。A 漏检。

### B mechanical 独有：移动源文件已经不存在

计划要求 `git mv` 的 source 当前不存在，而 destination 已存在，因此冻结命令不能执行。该 finding 属于预期的 deterministic preflight 独有增益。

### B unsupported：baseline count 缺失

`CB-006` 声称计划没有可执行 baseline count，但冻结 slice 不包含前置 phase artifact，无法证明整份计划缺失 baseline，因此不成立。

### Environment noise

`bun run check` 因本机依赖状态缺少 `vite/client` types 失败。该事实属于 checkout/environment limitation，不是三个 frozen candidates 的缺陷，不能进入 plan findings。

## 为什么失败

### 1. Compact display 只解决 trace 重复

Preflight trace 从 5,107 字符压缩为 1,324 字符，证明审计与上下文分层有效。但 B-primary 自身比 A 多 3,479 字符，吞掉了全部收益。

### 2. 单次 reviewer 方差大于当前优化量

A 只有 1 条 finding，B-primary 有 7 条。两者使用同类 blind full rubric，但发现集差异很大；其中既有 B 的真实独有 blocker，也有 unsupported finding。这说明 reviewer sampling/context variance 比 8%左右的字符优化更大。

### 3. 样本已部分实施

当前 checkout 已包含若干计划中的目标变更，导致 preflight 产生“计划步骤已过期”的 findings。这些对当前可执行性成立，但不是原始 pre-implementation plan 质量的纯测量。未来样本必须绑定计划编写时的 base commit 或使用未实施计划。

### 4. Mechanical preflight 仍由 LLM session 生成

虽然逻辑上不算 model reviewer，但实验实际使用了独立 agent session。Exact tokens 不可用时，不能把它视为免费 deterministic script。

## Evidence Loop Decision

Improvement magnitude: no net improvement  
Generalization confidence: low  
Hard gates: fail — quality rule 2/3 and character rule 5  
Independent falsification: completed by fresh blind adjudicator  
Decision: reject this implementation shape; retain only the audit/display separation principle

已获支持：

- Full trace 与 compact context display 分离；
- Preflight 能发现当前可执行性问题；
- Preflight 不应注入 primary prompt。

未获支持：

- 单次 B primary 能稳定维持或改善 precision；
- compact preflight 足以带来整体上下文成本下降；
- LLM 执行的 mechanical lane 可以按“免费确定性检查”计算；
- 当前 routine slices 可以代表原始未实施计划。

## 下一步

停止继续用更多 prompt/rubric 微调。下一次有价值的验证必须同时改变实验基础设施：

1. 为 plan sample 绑定写作时的 git base revision，避免已实施状态污染；
2. 将 preflight 实现为真实 stdlib script，而不是另一个 LLM agent；
3. 每个 arm 每样本运行至少 3 个 trials，测量 finding stability，而不是比较单次随机输出；
4. 使用能提供 per-request token/model trace 的 runtime；
5. 人工只裁决跨 trial 稳定的 unique blockers。

在这些条件具备前，不应继续重写生产 `plan-review`。

## 开放问题

1. 三 trial 聚合后，A/B finding variance 是否收敛到足以检测 5–10% 的成本差异？
2. Stdlib preflight 能覆盖哪些真正确定性的检查，而不把 checkout/environment drift 错报为 plan defect？
