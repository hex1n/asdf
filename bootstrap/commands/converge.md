---
description: "Plan convergence: produce a solution without coding, run parallel review from 4 independent lenses (coherence/feasibility/scope/adversarial), absorb confirmed findings, present numbered options."
argument-hint: "[问题/需求描述或文档路径]"
---

把命令后的文本（$ARGUMENTS）当作要收敛方案的问题。按以下契约执行：

1. **先不写代码**。产出方案前先查目标仓库 docs/rework-log.md 有无同类返工记录，有则作为约束输入。然后产出方案：重构根问题 → 分离真约束与假设 → 对比至少两种机制 → 给当前最优（有 first-principles-planner skill 时用它）。
2. **并行证伪**：开 4 个只读子代理独立审查方案，各持一个视角——coherence（自洽性）/ feasibility（可行性）/ scope（范围与影响面）/ adversarial（对抗性反例）。方案范围仅单个文件或单个决策点时，可只开 1-2 个视角或直接给编号选项。
3. **吸收修订**：只吸收被证据确认的问题；修订后连续两轮无实质变化 = 收敛（用户可随时喊"再来一轮"重启）。
4. **终版输出**：2-3 个编号选项 + 明确推荐 + 每个选项的失败模式与被推翻条件；等用户拍板，不擅自落地。
