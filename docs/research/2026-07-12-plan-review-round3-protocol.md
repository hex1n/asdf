# Plan Review Pilot Round 3 Protocol

**问题**: 在 blind primary rubric 中加入通用 closure-integrity 检查，是否能补回 Round 2 唯一漏检 blocker，而不制造跨领域 false blocker？  
**状态**: pre-registered before Round 3 output  
**日期**: 2026-07-12

## 判别样本

1. Target sample：`taskloop/docs/plans/2026-07-12-review-skill-dispatch-protocol.md`。
2. Divergent-domain sample：`taskloop/docs/plans/2026-07-11-criterion-vocabulary-and-state-model.md`。

第二样本验证规则不是只对 review receipt 的字段名过拟合，而能适用于不同状态机/终态设计。

## 新增 Rubric

```text
Closure integrity: when a plan defines a pass, acceptance, terminal, or release
predicate, verify that it accounts for every required obligation, explicit
unknown or verification gap, residual-risk disposition, evidence provenance,
and stale-result invalidation. A zero count or model verdict alone is not proof
of completeness.
```

Reviewer 不获得 Round 1/2 findings、预期答案或漏检 ID。

## 决策规则

机制获得支持仅当：

1. Target sample 返回一个经 adjudicator 确认的 material finding，指出 acceptance 只检查 zero blocking findings，却没有证明 exhaustive rubric、unknown/gap/not-covered 或其他义务已完整记账；
2. Finding 使用通用 closure-integrity 机制，而不是复述某个隐藏 ID；
3. Divergent-domain sample 不新增 unsupported blocker；
4. 两个样本都由一次 blind primary invocation 完成，不调用额外 specialist；
5. 其他新增 findings 的 unsupported rate 不高于 10%。

该 probe 只验证 rubric 修复，不证明整套候选设计或 token 优势。
