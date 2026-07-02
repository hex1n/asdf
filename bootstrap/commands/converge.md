---
description: "Plan convergence for explicit or high-risk unresolved decisions: produce a solution without coding, run parallel review, absorb confirmed findings, present numbered options."
argument-hint: "[问题/需求描述或文档路径]"
---

把命令后的文本当作要收敛方案的问题；Claude Code 中即 `$ARGUMENTS`，Codex skill 中即本次输入里跟在 skill/命令名后的文本。按以下契约执行：

0. **使用边界**：只有用户显式调用、多个机制未收敛，或不可逆/高风险改动需要证伪时才执行。用户已经明确拍板（如"按方案1来/落地/开始实现"）后，不得自行回到 `/converge`；除非出现新的硬阻塞，改为报告阻塞并给用户选择。
1. **先不写代码**。产出方案前先查目标仓库 docs/rework-log.md 有无同类返工记录，有则作为约束输入。然后产出方案：重构根问题 → 分离真约束与假设 → 对比至少两种机制 → 给当前最优（有 first-principles-planner skill 时用它）。
2. **并行证伪**：默认开 2 个只读子代理审查最可能失败的视角；只有高风险或跨模块决策才扩到 4 个视角——coherence（自洽性）/ feasibility（可行性）/ scope（范围与影响面）/ adversarial（对抗性反例）。方案范围仅单个文件或单个决策点时，可直接给编号选项。
3. **吸收修订**：只吸收被证据确认的问题；修订后连续两轮无实质变化 = 收敛（用户可随时喊"再来一轮"重启）。
4. **终版输出**：2-3 个编号选项 + 明确推荐 + 每个选项的失败模式与被推翻条件；等用户拍板，不擅自落地。
