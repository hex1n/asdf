# Value Gate / Decision Envelope 行为探针归档

配套轮次笔记：`../2026-07-13-value-gate-decision-envelope-round.md`。

三个臂，同一组固定场景提示词（`S1`–`S5-prompt.md`）与夹具（`fixtures/`），
均为 fresh-context 子代理执行「读取技能原文 → 处理场景」：

- `baseline/` — git `15fffe7` 的技能文本（改动前）。S2/S3/S5 为行为要点 +
  关键结构摘录；S1/S4 为完整原文。
- `candidate/` — 首版候选（Codex 独立证伪之前的工作树）。行为要点 + 决策信封
  原文；证伪发现 F4 指出其中 S1/S5 早于 `review_scope: n/a` 规则，故不作为
  最终验收证据，仅保留为演化轨迹。
- `final/` — 全部证伪修复落地后的最终修订，五个样例完整原文，是验收所依据的
  证据臂。

场景设计：S1 低频+已有替代（数据管道），S2 高频重大影响（支付幂等，
无回归检查），S3 技术连贯但上游不建设（审查入口），S4 审查修复击穿经济性
（信封失效），S5 第二领域（内部流程自动化，Generalization Gate）。
