# Evidence-Gated Plan Review Validation Rounds 2–3

**问题**: 隔离 deterministic preflight 与 primary reviewer，并补充 closure-integrity rubric，能否恢复候选机制的高风险 blocker coverage？  
**深度**: Deep  
**核心结论**: Preflight 隔离显著恢复 coverage；closure-integrity rubric 在两个领域均产生有效 finding，但仍缺可审计 invocation telemetry，因此机制获得内容支持、尚不能正式 accept。  
**产物类型**: supporting  
**验证状态**: current-state checked  
**开放问题**: 2 - 见文末

## Round 2 — 隔离 Preflight

协议：[2026-07-12-plan-review-round2-protocol.md](2026-07-12-plan-review-round2-protocol.md)

Round 2 复用 Round 1 的 mechanical preflight，只重新运行一个看不到 preflight、旧 findings、候选设计和当前 skill 的 blind primary reviewer。

```text
Arm Z = Round 1 mechanical findings
      + Round 2 blind primary findings
      - within-sample semantic duplicates
```

### 结果

| 指标 | X：当前基线 | Z：隔离 preflight 候选 |
|---|---:|---:|
| Raw findings | 35 | 39 |
| Deduplicated findings | 35 | 36 |
| Confirmed | 34 | 35 |
| Unsupported | 1 | 1 |
| Duplicate | 0 | 3 |
| Confirmed blockers | 9 | 14 |
| Unsupported rate | 2.857% | 2.778% |
| Model reviewer invocations | 9 | 9 |
| Token usage | unavailable | unavailable |

Round 2 找回了 Round 1 候选所漏掉的大部分 blocker，并保留了 mechanical preflight 独有的两个 blocker。5 条预注册规则中 4 条通过：

- 保留 Round 1 Y 的两个 unique confirmed blockers：pass；
- unsupported rate 不高于 X：pass；
- 每计划一个 model reviewer：pass（由 arm artifact 记录，缺 provider token telemetry）；
- 不依赖未执行 escalation：pass；
- 不遗漏 X unique confirmed blocker：fail。

唯一漏检是 `S07-B-002`：review dispatch protocol 把 zero blocking findings 当作足够 acceptance，却没有要求 exhaustive rubric result、verification gaps、not-covered scope 和其他 disposition 被完整记账。

### Round 2 判断

Preflight 隔离是明确改进，但仍不能替代当前路径。失败点从 Round 1 的 4 个 X-only blockers 收窄到一个 closure-integrity blocker。

## Round 3 — Closure-Integrity Rubric

协议：[2026-07-12-plan-review-round3-protocol.md](2026-07-12-plan-review-round3-protocol.md)

新增通用 rubric：

```text
Closure integrity: when a plan defines a pass, acceptance, terminal, or release
predicate, verify that it accounts for every required obligation, explicit
unknown or verification gap, residual-risk disposition, evidence provenance,
and stale-result invalidation. A zero count or model verdict alone is not proof
of completeness.
```

使用两个 blind 样本：

- target：review-skill-dispatch-protocol；
- divergent domain：criterion-vocabulary-and-state-model。

Reviewer 不知道 Round 2 漏检 finding 或任何历史 ID。

### 原始 Findings

| ID | 样本 | Finding | Adjudication |
|---|---|---|---|
| R3-001 | dispatch protocol | zero-blocking receipt 没有证明 obligation、gap、provenance 完整 | confirmed blocker |
| R3-002 | dispatch protocol | complete replay 声明与 lossy ledger、跨 store crash reconciliation 缺口冲突 | confirmed major |
| R3-003 | state model | count-only review gate 没有证明完整 review obligations | confirmed blocker |
| R3-004 | state model | `not_needed` 接受任意非空 evidence，缺 provenance/freshness/stale invalidation | confirmed；severity 从 critical 下调为 major |
| R3-005 | state model | provisional bypass 缺 reason、actor、scope 和 residual-risk disposition | confirmed major |

5 条 findings 全部成立，unsupported rate 为 0%。第二领域没有 unsupported blocker，说明规则没有只对 review receipt 字段名过拟合。

### 决策规则

| Rule | 结果 |
|---|---|
| 找回 target closure-integrity blocker | pass |
| 使用通用机制而非隐藏 ID | pass |
| divergent sample 不产生 unsupported blocker | pass |
| 每样本一次 invocation、无 specialist | indeterminate |
| 其他 finding unsupported rate ≤10% | pass（0%） |

Rule 4 无法关闭：collaboration runtime 没有提供 per-sample model invocation trace 或 token telemetry。主线程可确认只创建了一个 probe subagent 且没有显式 specialist subagent，但这不能证明 provider 内部每样本恰好一次模型调用。

### Round 3 判断

状态：`inconclusive; mechanism supported_on_content`。

Closure-integrity rubric 是有效修复候选，但在 invocation 证据不可用时不能按预注册规则正式 accept，也不能得出 token 优势。

## 连续证据变化

| Round | 机制 | High-risk unique blocker 漏检 | 结果 |
|---|---|---:|---|
| R1 | preflight-informed primary | 4 个 X-only blockers | reject |
| R2 | preflight-hidden blind primary | 1 个 X-only blocker | continue |
| R3 | blind primary + closure-integrity rubric | target 漏检已找回；0 unsupported | content-supported, telemetry-inconclusive |

这支持一个更窄的设计，而不是原完整候选：

```text
deterministic preflight ─┐
                        ├─ independent merge/dedup ─ adjudication
blind full primary ─────┘

primary rubric += closure integrity
```

Preflight 结果不进入 primary prompt；它是独立证据 lane，而不是 reviewer 的注意力路由器。

## 当前决策

- 不实施原始 evidence-gated candidate 全量 redesign；
- 接受“preflight 与 primary 隔离”作为有证据支持的设计方向；
- 接受 closure-integrity rubric 的内容有效性；
- 在有 per-invocation telemetry 前，不宣称成本改善或正式 accept skill evolution；
- 高风险计划继续保留完整 blind primary，不因 preflight 通过而跳过。

## Evidence Loop Round 2–3

Improvement magnitude: clear on observed blocker coverage  
Generalization confidence: low-to-medium；9 个高风险计划＋1 个 divergent-domain probe，但无 routine 样本  
Hard gates: incomplete；correctness evidence passes, usage/invocation evidence unavailable  
High-stakes escalation: fresh blind primary and two fresh adjudicators completed  
Decision: continue; do not implement yet

Wins:

- X-only blocker 漏检从 4 缩小到 1；
- closure-integrity probe 找回最后的已知类别缺陷；
- divergent sample 0 unsupported；
- 不依赖未执行 specialist escalation。

Remaining regressions or unknowns:

- exact token 与 physical model-call telemetry unavailable；
- 没有人工 gold set；
- 仍缺 routine 样本；
- Round 3 只有两个样本，无法证明 rubric 在更广领域不提高 false-positive rate。

## 下一步

下一步不应继续增加 rubric。最有区分力的检查是：

1. 在能输出 per-request usage 的 runtime 中重跑 Round 3，关闭 invocation/token gate；
2. 收集至少 6 个真实 routine 计划，在 blind primary＋独立 preflight 与当前 full-depth 路径之间比较 blocker recall 和实际 token；
3. 由人工专家只裁决 unique blockers 与 severity disagreement，不必重审全部 findings。

## 开放问题

1. 在带精确 usage trace 的 runtime 中，独立 preflight 是否减少 primary 输入/输出 token，还是只增加固定开销？
2. Closure-integrity rubric 在 routine、非软件和无显式状态机的计划上是否仍保持低 false-positive rate？
