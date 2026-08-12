# Change Target Evidence Frame

当目标是 branch、PR、commit range 或 working-tree change 时，执行本规则。最终有效差异回答“现在实现了什么”；历史记录只解释“如何演变”。

## 1. 固定比较框架

- 固定被分析的 HEAD/提交哈希。
- 优先使用用户指定的比较点；否则根据仓库上下文选择上游或默认分支的 merge-base，并明确记录该选择。
- 记录工作区状态，将 tracked modification、untracked artifact 和本次生成文件分别标注。
- 将证据分成四个平面：
  - **Current**：HEAD 相对基线的最终有效差异。
  - **History**：功能提交的演进和曾经存在的瞬态实现。
  - **Working tree**：尚未进入目标提交范围的本地内容。
  - **Intent**：需求、设计、测试范围或验收标准描述的期望。

**完成条件：**HEAD、baseline、merge-base、工作区状态和四类证据均可追溯。

## 2. 建立候选面

- 从最终 diff、相关提交和目标领域词汇分别寻找候选文件与入口。
- 将同一分支中的无关提交和文件排除出目标闭包，同时保留排除理由。
- 为多入口或多场景变更建立覆盖矩阵：

```text
Scene | Entry | Observable field/state | Policy/condition | Current status | Evidence
```

- 对每个目标场景检查相邻但未修改的入口；记录它是已覆盖、明确排除，还是疑似遗漏。
- 对历史中出现、最终快照中消失的行为标为 transient，并定位覆盖或回退它的提交。

**完成条件：**每个候选文件、提交、入口和业务场景都被归为 implemented、missing、excluded 或 unrelated，且带证据。

## 3. 形成结论

- 用 Current 平面陈述当前实现。
- 用 Intent 对比当前覆盖，报告确认缺口和规格歧义。
- 用 History 解释关键设计演变、覆盖和回退，不把 transient 行为描述为当前能力。
- 用 Working tree 补充本地证据，并明确它尚不属于提交范围。
- 将发现分类为 confirmed gap、risk、assumption 或 evidence gap。

**完成条件：**读者不会把最终实现、历史瞬态、本地材料和规格期望混为一谈；所有声称“全部”的范围都有覆盖矩阵支撑。
