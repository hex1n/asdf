---
name: implementation-mastery
description: Build a source-backed implementation map for one named target.
disable-model-invocation: true
---

# Implementation Mastery

为用户手动指定的一个需求、函数、模块、分支或 PR 建立实现地图，并遍历到 **closure**。

**Behavioral node**（行为节点）是能改变目标可观察行为的最小分析单元，可以是方法、配置、状态、事件、数据转换或外部契约。inventory 是唯一事实源（canonical），定界时即创建工作文件 `docs/mastery/.work/<target-slug>.inventory.jsonl`（无仓库时放 scratchpad），每行一个节点：`{id, kind, node, why, evidence, state, deps}`。`kind` 分 `behavior` / `context`（evidence frame、范围审计等非行为项）；`state` 只有 `pending`、`explained`、`black-box`；`deps` 是该节点触及的其他节点 ID 列表。工作文件不是交付物——所有交付物从它生成，遍历因此可跨上下文续跑。**Closure = inventory 中 `pending` 为零。**每条新发现的行为影响边当场落为 deps 里的一个 ID——指向新建的 pending 行或 black-box 契约行，不存在第三种去处；deps 全部可解析，判据因此保持二元可查。

## 1. Frame

- 锁定一个目标；先从仓库上下文消解同名符号和边界，只有不同解释会实质改变结论时才询问用户。
- 选择交付面：默认在对话中交付；用户要求持久化时再创建 Markdown 或 HTML。无论哪种交付面，inventory 工作文件都在此时创建。
- 建立 **evidence frame**：记录分析版本、证据来源和可用的验证层级，使“当前实现”“规格意图”和“运行时事实”可以区分。
- 目标是 branch、PR、commit range 或 working-tree change 时，完整读取并执行 [change-target.md](references/change-target.md)。

**完成条件：**目标边界、分析版本、证据范围和交付面均已明确。

## 2. Seed

- 找出全部对外入口：公开接口、路由、消息订阅、定时任务和其他可观察触发点。
- 每个入口向上读取一层调用方以获得使用语境；只有调用方会改变目标语义时才继续向上展开。
- 按开头定义的 schema 写入 inventory 工作文件，为每个节点分配稳定 Node ID（如 `N01`、`B01`）。
- 将框架、标准库、第三方依赖和不改变目标语义的兄弟模块置为 `black-box`，记录输入、输出、副作用和失败契约；契约的 evidence 必须给出依据（官方文档、接口签名、测试）。给不出依据时该行标注 `assumed`，进入风险与证据缺口，交付物中不得呈现为已证实契约。

**完成条件：**每个入口和已发现的行为边都进入 inventory，并有明确的展开或黑盒理由。

## 3. Close

反复取出一个 `pending` 行为节点：

1. 用搜索定位定义、调用点和数据流，随后阅读节点的完整实现。方法节点还要读取会改变其语义的字段、注解、构造和生命周期上下文。
2. 就地解释节点的职责、输入与前置条件、行为分支、输出、状态变化、副作用、错误路径，以及事务和并发语义。
3. 为每个改变行为的条件记录“条件 → 结果/副作用”；将用户可见输出和状态写入追溯到来源。
4. 数据访问节点按证据层级摘录查询，逐层标明：来源形式（MyBatis 动态 SQL、注解 / Provider、JPA 的 JPQL / derived / native / Criteria、QueryDSL、JdbcTemplate、存储过程均适用）→ 归一后的逻辑 SQL →（有运行时证据时）实际 prepared SQL 与绑定值；逻辑 SQL 不得伪称运行时 SQL。动态片段枚举其生效形态（空 / 单元素 / 多元素等），拦截器追加（分页、租户、软删除、分表）单独注明，并写明表、过滤列与事务边界。
5. 将新发现且能改变输出、状态、副作用、安全性或失败语义的边写入当前节点的 deps：指向新建的 pending 行为节点或 black-box 契约行。
6. 只有节点的全部行为结果都有源码锚点、且 deps 全部解析为已存在的 inventory ID 后，才把它标为 `explained`。

**完成条件：**`pending = 0`；所有节点的 deps 均解析为已存在的 inventory ID；每个可观察结果和状态写入都能追溯到一个 `explained` 节点或有依据的 `black-box` 契约。

## 4. Verify

- 使用 **evidence ladder**：先用源码确认；源码无法决定关键结论或用户要求行为验证时，执行最小目标测试；仍需运行时事实且已有授权时，再使用 RPC、E2E、DB 或真实运行证据。
- 分别标明源码确认、测试确认、运行时确认和验证阻断；阻断要关联到尚未确认的具体结论。
- 结构校验（机械、全量、用脚本执行，不靠数数）：inventory 工作文件无 `pending`；deps 中每个 ID 都存在；交付物中 `kind=behavior` 且 `explained` 的条目集合与 inventory 完全双射（无重复、无缺失）；每条目的分支表、锚点、（数据访问节点）SQL 摘录齐备。
- 内容抽查：审计所有高风险边界（权限/隐私、外部写入、事务、并发、不可逆副作用），再抽查至少 3 个 `explained` 节点；不足 3 个时全部审计。对照源码核对“条件 → 结果/副作用”，修复遗漏后再确认 closure。

**完成条件：**结构校验通过；每项关键结论都有证据等级；所有审计差异已解决；剩余证据缺口被准确限定。

## 5. Deliver

- 先交付结论和端到端主线，再给行为节点细节、数据与状态、配置、失败与并发、black-box 契约、完整 inventory、风险和证据缺口。
- **一节点一条目**：`kind=behavior` 且 `explained` 的每个节点在交付物中独立成节并携带其 Node ID，与 inventory 形成 ID 双射；每条目带完整“条件 → 结果/副作用”表、源码锚点和关键代码 / SQL 摘录。节点的 state 标记与风险严重度标记是两个维度，同时呈现、互不替代。
- 只保留与目标有关且有内容的章节；源码锚点使用分析版本下的 `file:line`。
- 用户要求直观展示或 HTML 时，完整读取 [html-output.md](references/html-output.md)，并使用 [mastery-map.html](assets/mastery-map.html) 生成自包含页面。
- 交付后主动提出可按自测题检验；题目覆盖关键分支和隐藏前提，全对即通过本轮地图覆盖范围内的理解检查。

**完成条件：**交付物通过 §4 结构校验；当前行为、规格意图、历史演进、风险与证据缺口在交付物中各归其位；所有请求的交付物均已验证可读。
