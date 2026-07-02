---
description: "Diagnose-fix loop driven by a reproducible input and a machine-checkable pass criterion: locate→fix→take effect (auto-start local services; user deploys test envs)→replay→reconcile until green."
argument-hint: "[复现报文/ID/错误现场 + 修好的标准（SQL 断言或预期值）]"
---

把命令后的文本当作排查输入；Claude Code 中即 `$ARGUMENTS`，Codex skill 中即本次输入里跟在 skill/命令名后的文本。输入应包含复现报文/ID/错误现场，以及通过标准。按以下循环契约执行：

1. **入口检查**：缺"复现输入"或"机器可查的通过标准"任一 → 先索要，再开始。
2. **循环**：定位（先查库/查日志/读代码，证据先行，不凭猜测下结论）→ 最窄修复 → **生效门**：重放必须打在已生效的修复上——本地能自行启动/重启的服务，直接构建并起服务，确认就绪（健康检查或启动日志）后重放；无法自行部署的环境（如测试环境）才交代「改了什么、部署什么」并停下等用户确认完成，期间不做其他改动 → 重放原始输入 → 逐字段对账。若目标仓库已有 `.agent-workflows/`，用 `node ~/bin/agent-workflow-hook.mjs init --repo <repo> ...` 把本轮文件/表/接口边界写入 `.agent-workflows/touch-list.json`，并让 hook 证据留在 `.agent-workflows/evidence-ledger.jsonl`。ledger 只证明范围/过程，不证明修复正确；每个"已修/已验证"结论必须引用真实工具结果；工具失败或未执行时只能报告失败。
3. **判停**：对账不符继续循环；通过后输出结论表格（输入 / 预期 / 实际 / 证据位置）然后停；同一失败连续出现两次，或迭代超过 8 轮 → 停下报告，不空转。仓库启用 `.agent-workflows/` 且 touch-list active 时，判停由判据闸门机器裁决：Stop hook 执行 `criterion`，strict 下未通过不放行，连续 8 次或累计 12 次拦截后强制放行。因同错/超轮判停时，往仓库 docs/rework-log.md 追加一行归因，并评估是否需要新增判据或固化规则。
4. **数据纪律**：执行数据默认保留；诊断现场在任何清理前必须先留存。

> Claude Code 与 Codex 端均可用原生 `/goal <通过标准>` 承接本循环的跨轮自动推进，免人工敲"继续"（可选加速项）。
