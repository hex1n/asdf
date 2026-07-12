# Plan Review Routine Pilot Protocol

**问题**: 在 routine 计划上，独立 preflight＋blind full primary＋closure-integrity rubric 是否能以不降低 blocker coverage 的方式减少 review 成本或噪声？  
**状态**: pre-registered before arm outputs  
**日期**: 2026-07-12

## 独立任务样本

每个 design＋plan 配对视为一个联合 candidate，不重复计数。

1. `svelte-todo`
   - `superpowers/tests/subagent-driven-dev/svelte-todo/design.md`
   - `superpowers/tests/subagent-driven-dev/svelte-todo/plan.md`
2. `go-fractals`
   - `superpowers/tests/subagent-driven-dev/go-fractals/design.md`
   - `superpowers/tests/subagent-driven-dev/go-fractals/plan.md`
3. `system-reminder-positioning`
   - `gauntlet/docs/superpowers/specs/2026-05-13-pri-1495-system-reminder-positioning-spec.md`
   - `gauntlet/docs/superpowers/plans/2026-05-13-pri-1495-system-reminder-positioning.md`

前两个是测试夹具；第三个是真实产品代码计划。结论不得外推到所有 routine 任务。

## Arm R-A — 当前流程

- 每个联合 candidate 运行一个完整、blind、全 rubric first-pass reviewer。
- Rubric：coherence、feasibility、compatibility、migration/rollback、verification、scope、state correctness、safety。
- 不修改计划，不执行 closing/revision cycle。

## Arm R-B — 窄候选机制

- mechanical preflight 与 primary reviewer 彼此隔离；
- primary 看不到 preflight 结果；
- primary 使用与 R-A 相同的完整 rubric，并增加通用 closure-integrity criterion；
- 最后合并 mechanical 与 model findings，按语义去重；
- 不调用 specialist，不修改计划。

## 匿名对账

Fresh adjudicator 只看到匿名 A/B 输出与原始联合 candidates。逐条分类 confirmed、unsupported、duplicate，识别 unique-material blocker。

## 指标

- confirmed blockers、should-fix、advisory、verification gaps；
- unsupported 和 duplicate；
- unique-material blocker omissions；
- logical reviewer invocations；
- output characters；
- exact token usage（仅在 runtime 暴露时记录）。

## 决策规则

窄候选仅在以下条件同时成立时获得 routine-pilot 支持：

1. 不遗漏 R-A 的 confirmed unique blocker；
2. R-A 不遗漏 R-B 的 confirmed unique blocker，或 R-B 独有 blocker 经 adjudicator 判断只是 closure rubric 的预期增益；
3. unsupported rate 不高于 R-A；
4. 每任务 model reviewer invocation 不超过 R-A；
5. 不依赖未执行 escalation；
6. 若 token unavailable，至少 deduplicated output characters 不高于 R-A；否则成本规则为 indeterminate。

没有人工 gold set 或 exact token 时，最高结论为 provisional。
