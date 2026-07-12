# Plan Review Routine Pilot

**问题**: 独立 preflight＋blind full primary＋closure-integrity rubric 能否在 routine 计划上保持 blocker coverage 并降低 review 成本？  
**深度**: Deep  
**核心结论**: Coverage 与误报门槛通过，但预注册输出成本门槛失败；紧凑 preflight display 有希望逆转字符成本，但属于 post-hoc 线索，尚未构成 acceptance evidence。  
**产物类型**: supporting  
**验证状态**: current-state checked  
**开放问题**: 2 - 见文末

## 样本

按任务而非文档计数，共 3 个独立 routine candidates：

1. `svelte-todo`：test fixture design＋plan；
2. `go-fractals`：test fixture design＋plan；
3. `system-reminder-positioning`：真实产品 spec＋implementation plan。

协议：[2026-07-12-plan-review-routine-pilot-protocol.md](2026-07-12-plan-review-routine-pilot-protocol.md)

## Arms

- A：每任务一个完整 blind primary review；
- B：独立 mechanical preflight＋看不到 preflight 的完整 blind primary＋closure-integrity rubric，最后语义去重。

三条 lane 并行运行；fresh adjudicator 匿名核对 A 与 B，不读取候选设计、当前 skill 或之前 pilot 结论。

## 结果

| 指标 | A | B（合并去重） |
|---|---:|---:|
| Raw findings | 22 | 20 |
| Deduplicated findings | 21 | 18 |
| Confirmed | 17 | 14 |
| Unsupported | 4 | 3 |
| Duplicate | 1 | 1（另移除 2 条 cross-lane duplicates） |
| Unsupported rate | 18.18% | 16.67% |
| Confirmed blockers | 4 | 4 |
| Confirmed should-fix | 7 | 4 |
| Confirmed advisory | 3 | 5 |
| Confirmed verification gaps | 3 | 1 |
| Logical model reviewer invocations | 3 | 3 |
| Exact token | unavailable | unavailable |
| Output characters | 16,213 | 19,055 |

## 预注册规则

| Rule | 结果 | 证据 |
|---|---|---|
| B 不漏 A unique confirmed blocker | pass | 四类 blocker 均有 B 等价 finding |
| A 不漏 B unique confirmed blocker | pass | 没有 B-only unique blocker |
| B unsupported rate 不高于 A | pass | 16.67% < 18.18% |
| B 每任务 model reviewer 不多于 A | pass | 都是 1 次/任务 |
| B 不依赖未执行 escalation | pass | 无 specialist/escalation |
| Token unavailable 时 B characters ≤ A | **fail** | 19,055 > 16,213，增加 2,842（17.53%） |

按预注册规则，routine pilot 不支持候选机制。它保持了 blocker coverage，也略降 unsupported rate，但没有降低可见输出成本。

## 成本来源

| B artifact | Characters |
|---|---:|
| Primary output | 13,186 |
| Full preflight artifact | 8,083 |
| Raw combined | 21,269 |
| Cross-lane deduplicated | 19,055 |

失败不是 primary 输出更长，而是完整 preflight trace 被当作同等用户/上下文输出。完整审计与运行时上下文没有分层。

## Post-hoc Compact Display Probe

该 probe 在看到 pilot 结果后执行，因此不改变正式 verdict。

将完整 preflight JSON 保留为 audit trace，用户/模型上下文只接收：

```text
candidate
check
severity
summary
evidence_refs: [{path, lines}]
```

机械字符测量：

| Display | Preflight chars | 与 primary 合计 | 相对 A |
|---|---:|---:|---:|
| 全部 5 条 compact findings | 2,936 | 16,122 | -91（-0.56%） |
| merge 后 3 条 unique compact findings | 1,681 | 14,867 | -1,346（-8.30%） |

这说明“audit trace 与上下文 display 分离”可能修复成本失败，但必须在新样本上预注册并前瞻验证，不能用本次数据直接 accept。

## 重要限制

- Exact token 和 provider physical-call telemetry 不可用；字符数只是预注册 fallback。
- B-preflight 在实验中由独立 agent session 生成，而未来设计假设它由确定性脚本完成；如果仍需 LLM，实际成本会更高。
- 只有 3 个独立任务，其中 2 个是测试夹具。
- 没有人工 gold set；confirmed/severity 来自 fresh adjudicator。
- A/B 都发现了 4 个 blockers，说明这些“routine”文档并不等于“没有严重计划缺陷”。Routine 描述的是变更风险，不是文档质量。

## Evolution Decision

Improvement magnitude: marginal-to-clear on noise, none on preregistered cost  
Generalization confidence: low  
Hard gates: fail — output-cost rule 6  
Independent falsification: completed through blind adjudication  
Decision: continue; do not implement

获得支持的部分：

- preflight 与 primary 上下文隔离；
- blind full primary 保持 blocker coverage；
- closure-integrity rubric 未提高 unsupported rate；
- audit/display 分层值得做前瞻 probe。

未获得支持的部分：

- 完整 preflight lane 能自动省 token；
- 当前实验形态整体成本低于单 primary；
- 可以仅凭 3 个样本修改生产 skill。

## 下一步

固定 compact preflight schema，在至少 3 个新的 routine tasks 上前瞻运行。完整 trace 只用于审计，compact display 才进入字符/token 成本比较。若 exact usage 仍不可用，必须同时报告 physical agent sessions，不能只计算 logical reviewer invocations。

## 开放问题

1. Compact display 在新 routine 样本上是否仍保持 blocker coverage，同时稳定降低总字符和实际 token？
2. 能否把 preflight 完全实现为 stdlib deterministic checks，避免为“机械 lane”额外消耗一个 LLM session？
