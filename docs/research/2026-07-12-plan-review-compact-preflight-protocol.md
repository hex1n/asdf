# Compact Preflight Forward Pilot Protocol

**问题**: 预注册 compact preflight display 后，独立 preflight＋blind primary 能否在新 routine slices 上保持 blocker coverage，并降低上下文输出字符？  
**状态**: pre-registered before outputs  
**日期**: 2026-07-12

## 三个新 routine slices

1. `dead-export-removal`
   - source: `gauntlet/docs/superpowers/plans/2026-05-18-pri-1628-cleanup-sweep.md`
   - frozen range: lines 59–90, with document title/goal lines 1–7 as context
2. `move-pick-free-port-test`
   - source: `gauntlet/docs/superpowers/plans/2026-05-18-test-cleanup-plan.md`
   - frozen range: lines 119–151, with document title/goal lines 1–7 as context
3. `real-port-rebind-assertion`
   - source: `gauntlet/docs/superpowers/plans/2026-05-18-test-cleanup-plan.md`
   - frozen range: lines 330–414, with document title/goal lines 1–7 as context

这些 slices 局部、可逆，不改变生产公开接口、持久数据、权限、资金、并发或核心生命周期。

## Arm C-A

每个 slice 一个 blind full primary review，rubric 为 coherence、feasibility、compatibility、verification、scope、safety 和 closure integrity。输出完整 structured findings。

## Arm C-B

- 独立 mechanical preflight，不向 primary 暴露；
- 与 C-A 相同的 blind primary；
- 合并去重。

Preflight 同时产生：

1. full audit trace，保存在临时 artifact，不进入模型或用户上下文；
2. compact display，只包含失败检查：

```json
{
  "candidate": "id",
  "check": "stable_check_id",
  "severity": "blocker|should_fix|advisory",
  "summary": "one bounded sentence",
  "evidence_refs": [{"path": "...", "lines": "..."}]
}
```

Passing checks只在 full trace 中记 count/digest，不进入 compact display。合并后，与 primary finding 语义重复的 compact finding 不再进入上下文显示，但保留 audit trace。

## 指标和规则

1. C-B 不遗漏 C-A confirmed unique blocker；
2. C-A 不遗漏 C-B confirmed unique blocker，除非它是机械检查的预期独有增益；
3. C-B unsupported rate 不高于 C-A；
4. model reviewer invocation 相同且无 specialist；
5. compact merged display characters（B primary＋unique compact preflight）低于 C-A；
6. full audit trace 字符单独报告，不计入模型上下文成本；
7. exact token unavailable 时结论最高为 provisional。

任一质量规则失败则 reject。质量规则通过但字符规则失败则 continue。全部通过则支持 compact-display 机制进入下一阶段，但不等于完整 skill redesign 通过。
