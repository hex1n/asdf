# Recipe:把 e2e-test-executor 跑成「后台 subagent」

让 `e2e-test-executor` 在**独立上下文**里、**不阻塞主 session** 地执行一份既有计划。

这是一个**调用层 / 编排层的姿势**,对可移植的 `skills/` 零改动。决策背景与可移植性
边界见 [ADR 0001](../adr/0001-e2e-executor-delegation-runtime-boundary.md)。

> ⚠️ 这套写法用到 `run_in_background` 和 Claude Code 的 Agent 工具,**只对 Claude Code
> 这个 Agent Runtime 有效**。Codex 走的是另一座桥(见 `docs/plans/claude-codex-bridge-plan.md`)。
> 永远不要把这些细节写进 `skills/` 里的 `SKILL.md`。

## 何时用

- 计划已经由 `e2e-test-planner` 产出,且你**不想被冗长的执行过程占住主上下文 / 主 session**。
- executor 那一跑很长(环境探查、DAG 调度、诊断、报告),你想边等边干别的。

只要 isolation 或 non-blocking 占一样,就适用;两样都要时收益最大。

## 前提:门禁必须先全绿(这是放行条件)

后台 subagent **跑起来就问不了人**,所以所有「stop and ask」必须在主 session 里**前置
解决**,固化成一份**委派契约**。直接复用计划里已有的 `Agent-ready Gates / Agent 就绪门禁`
+ `Executor Handoff Index / 执行器交接索引`,逐条确认:

| 门禁 | 必须在主 session 里定死的取值 |
| --- | --- |
| 环境 | 确认是 `local` 或 `test`(executor 只支持这两个;preprod/staging/prod 一律不后台化) |
| 数据策略 | `clean`(跑完归零)还是 `preserve traces`(留痕给你事后查) |
| 隔离命名空间 | batch ID / 前缀 / 租户 / trace ID 等 owner 标记 |
| 安全边界 | 允许哪些写/触发(建数据、触发 job、回调),禁止哪些 |
| 触发通道 | 计划里 `Trigger Channel Gates` 涉及的权限/allowlist/路由是否已就绪 |

**`Agent-ready Gates` 没全绿的计划,不要后台化**——留在前台一直跑到门禁关闭为止。

## 发起姿势

用**全权限** agent(`general-purpose` 或 `claude`)——**不要用只读的 `Explore`**,
executor 要跑命令、查库、控队列——并打开 `run_in_background`:

```
Agent(
  subagent_type: "general-purpose",
  run_in_background: true,
  description: "background e2e executor run",
  prompt: """
  按 e2e-test-executor skill 执行计划:<计划文件路径>

  委派契约(门禁已在主 session 全部前置解决,不要再问、不要自行升级权限):
  - 环境:test(或 local),禁止触碰 preprod/staging/prod
  - 数据策略:clean(或 preserve traces)
  - 隔离命名空间:<batch-id / 前缀 / trace-id>
  - 安全边界:允许 <…>;禁止 <…>
  - 输出目录:<run 目录路径,或让 executor 自建>

  约定:运行中若撞到任何【新的】阻塞或模糊门禁(超出上述契约),
  一律【停下来返回一份 blocker 报告】,绝不猜测、绝不自行扩大权限。
  最终只返回:run 目录路径 + pass/fail/blocked 计数 + cleanup 状态 + 提前返回的 blocker(若有)。
  """
)
```

## 运行中怎么看进度

不靠 subagent 的对话流(被隔离藏起来了),**靠 run 目录**:

- `evidence/` 会持续增长——这是过程中可见的进度。
- `execution-report.md` 和 `Environment State Ledger` 是事实源;但**精修后的报告在收尾
  阶段才成型**,中途看到的是「证据在长」。这是用实时可见性换不阻塞的必然取舍。

## 完成 / 提前返回怎么处理

- **正常完成**:后台任务结束时主 session 收到通知,把 subagent 返回的指针(run 路径 +
  pass/fail/blocked + cleanup 状态)转述给你;细节去 run 目录里读。
- **撞新门提前返回**:主 session 读 `Environment State Ledger`(它就是续跑快照)→ 要么
  解决该门禁后重新 spawn 一个后台 subagent 续跑,要么把 blocker 转述给你定夺。

## 不要做的事

- ❌ 不要把 `subagent` / `run_in_background` 写进 `skills/` 里的 `SKILL.md` 或 `REFERENCE.md`
  (违反 `AGENTS.md` 可移植性门禁;Codex 无法兑现)。
- ❌ 不要用只读的 `Explore` agent 跑 executor。
- ❌ 不要在 `Agent-ready Gates` 没全绿时就后台化。
- ❌ 不要让 subagent 在契约之外「自己猜一个门禁的答案」继续跑。

## 何时升级成一个 slash command(选项 B)

当你发现**反复手敲上面这段发起姿势**时,再考虑封装成一个 Claude Code slash command
(参考 cx-bridge 的做法)。在出现重复痛点之前别做——按 Rule Harvest Gate,它是个要维护
且只对 Claude Code 有效的新产物。
