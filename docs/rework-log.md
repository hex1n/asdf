# 返工记录(校准 写前路由)

> 每个工单**合并后**记一行:返工实际来自哪一步,一句话说清。
> 用途:用真实数据校准 [写前路由](backend-write-before-routing.md),而不是靠纸面 review。
>
> 读法:
> - 多来自 ① → `/deep-research` 默认级别调高(更早怀疑现状)。
> - 多来自 ③ → 迁移/回滚 gate 没守住,设计阶段强制补迁移方案。
> - 多来自 ④ → grill 介入太晚,把 `/grill-me` 提前到设计早期。
> - 几乎没有返工来自某行 → 该行可能是 over-engineering,考虑删。

| 日期 | 工单 | 返工来自(①~⑥/无) | 一句话 |
|---|---|---|---|
| 2026-07-02 | bootstrap install.py merge_contract 畸形态吞内容 | 无(设计时未枚举标记畸形态,测试只覆盖正常路径) | 多视角审查实测复现"BEGIN 无 END 二次运行吞用户内容"后返工:加预检+.bak+4 条畸形态测试 |
| 2026-07-02 | bootstrap agent-doctor.py tree_hash 假阳性 DRIFT | 无(原 tree_hash 只跳点号目录,未排除 __pycache__/pyc;脚本零测试) | 多视角审查发现 copy 模式 skill 因构建产物误报漂移:tree_hash 排除 __pycache__/.pyc,补 4 条 doctor 测试 |
| | | | |
