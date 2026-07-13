# 路由探针结果（两臂，fresh-context 子代理，单盲，2026-07-13）

判定协议：子代理只拿到臂对应的技能 description 列表（4 技能 + none）与 12 条用例，
不知道臂身份、不知道改了什么、不读技能正文。

预期路由：1-6 → first-principles-planner；7-9 → plan-review；10 → diagnosing-bugs
（或 deep-research/none 均记为不误触发 planner）；11-12 → none。

## 结果矩阵

| 用例 | 关键信号（是否被删变体） | 臂 A（基线） | 臂 B（收紧后） |
|---|---|---|---|
| 1 | 先不要写代码（删） | planner ✓ | planner ✓ |
| 2 | 不要直接改代码（删） | planner ✓ | planner ✓ |
| 3 | 给出方案（删） | planner ✓ | planner ✓ |
| 4 | 最佳了吗（删） | planner ✓ | planner ✓ |
| 5 | 值不值得做 | planner ✓ | planner ✓ |
| 6 | 收敛/选型 | planner ✓ | planner ✓ |
| 7 | 方案评审+审查到通过 | plan-review ✓ | plan-review ✓ |
| 8 | 收敛到无问题（删） | plan-review ✓ | plan-review ✓ |
| 9 | 第二模型证伪 | plan-review ✓ | plan-review ✓ |
| 10 | 偶尔超时（负例） | diagnosing-bugs ✓ | diagnosing-bugs ✓ |
| 11 | 计划写完了（负例） | none ✓ | none ✓ |
| 12 | 裸 ROI 算术（负例，F9） | none ✓ | none ✓ |

两臂 12/12 完全一致：被删的 5 个变体词全部经语义分支继续正确路由，
负例（含裸 ROI）在两臂均未过度触发 planner。

完整臂输出（含逐条理由）见本目录 arm 文件旁的会话归档；判定理由要点：
臂 B 对用例 1-4 的理由改为命中"plan-first / no-coding asks"与"best/better plan"
分支语义而非精确词，用例 8 理由为"针对单一现有方案反复收敛至无问题=独立证伪式复审"。

局限：每臂单次运行，无法度量路由稳定性方差；用例集由本轮作者设计
（已刻意让被删变体占正例的 5/9）。

## 增量用例（Codex 证伪 D1/D2 整改，cases2.md，臂 B2 = 修复后描述）

Codex 发现首版收紧误删了 `code review` 排除与 `implementation strategy` 触发；
修复后追加 4 例（含 reviewer 给出的 blocker 反例原句）：

| 用例 | 关键信号 | 臂 A（基线） | 臂 B2（修复后） |
|---|---|---|---|
| 13 | 第一性原理 + review 代码（D1 反例） | none ✓ | none ✓ |
| 14 | implementation strategy（恢复的英文触发） | planner ✓ | planner ✓ |
| 15 | 审查计划（接缝） | plan-review ✓ | plan-review ✓ |
| 16 | 先不要写代码（弱线索被删变体） | planner ✓ | planner ✓ |

两臂 16/16 全量持平。残留局限：未做乱序多次运行的方差测量；
英文被删触发仅覆盖 implementation strategy 一词（upgrade decision 折叠进
adopt/replace/tradeoff 分支，未单测）。
