# Plan Review Pilot Round 2 Protocol

**问题**: 将 deterministic preflight 与 primary reviewer 隔离后，是否能恢复候选设计在高风险计划上的 blocker coverage？  
**状态**: pre-registered before Round 2 output  
**日期**: 2026-07-12

## 固定输入

- 使用 Round 1 相同的 9 个历史计划。
- 基线使用 Round 1 Arm X 原始结果，不重新生成。
- 复用 Round 1 Arm Y 的 `mechanical_findings`，不重新运行 preflight。
- 新运行一个看不到任何 preflight、X/Y 输出、候选设计或当前 skill 的 blind primary reviewer。

## Arm Z 构造

```text
Arm Z = Round 1 Y mechanical_findings
      + Round 2 blind primary findings
      - within-sample semantic duplicates
```

Blind primary 只收到原计划和以下固定 rubric：coherence、feasibility、compatibility、migration/rollback、verification、scope、concurrency/state-machine correctness、safety。要求完整 first pass，不因一个 blocker 提前停止。

## 对账

Fresh-context adjudicator 匿名比较：

- Arm X：Round 1 baseline；
- Arm Z：机械 preflight 与 blind primary 的合并结果。

Adjudicator 不读取候选设计、当前 skill 或 Round 1 adjudication conclusion。它逐项检查原计划和 authority sources，分类 confirmed、unsupported、duplicate，并识别 unique-material blocker。

## 决策规则

Round 2 机制仅在以下条件同时成立时获得支持：

1. Z 不漏 X 的 confirmed unique blocker；
2. Z 保留 Round 1 Y 的两个 unique confirmed blockers，或以等价 finding 覆盖；
3. unsupported finding rate 不高于 X；
4. Z 的 model reviewer invocation 仍为每计划 1 次；
5. 不依赖未执行 escalation 才达到 coverage。

精确 token telemetry 不可用时，成本结论继续保持 unresolved。即使 coverage 通过，也只能支持“preflight 隔离”机制，不能证明完整候选设计最佳。
