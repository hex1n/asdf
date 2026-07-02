---
description: "Diagnose-fix loop driven by a reproducible input and a machine-checkable pass criterion: locate→fix→(user redeploys)→replay→reconcile until green."
argument-hint: "[复现报文/ID/错误现场 + 修好的标准（SQL 断言或预期值）]"
---

把命令后的文本（$ARGUMENTS）当作排查输入：复现报文/ID/错误现场，以及通过标准。按以下循环契约执行：

1. **入口检查**：缺"复现输入"或"机器可查的通过标准"任一 → 先索要，再开始。
2. **循环**：定位（先查库/查日志/读代码，证据先行，不凭猜测下结论）→ 最窄修复 → 需要部署时明确说"请部署"，等用户回复部署完成 → 重发原始输入 → 逐字段对账。
3. **判停**：对账不符继续循环；通过后输出结论表格（输入 / 预期 / 实际 / 证据位置）然后停；同一失败连续出现两次，或迭代超过 8 轮 → 停下报告，不空转。因同错/超轮判停时，往仓库 docs/rework-log.md 追加一行归因，并评估是否需要新增判据或固化规则。
4. **数据纪律**：执行数据默认保留；诊断现场在任何清理前必须先留存。

> Claude Code 端可用原生 `/goal <通过标准>` 承接本循环的跨轮自动推进，免人工敲"继续"（Codex 端无对应机制，此为单端可选加速项）。
