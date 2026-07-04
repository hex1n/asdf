# 返工记录

> 每个工单**合并后**记一行:返工实际来自工作循环的哪一环(研究不足 / 方案未收敛 /
> 迁移-回滚 gate 未守住 / 验收判据缺失 / 无),一句话说清。用途:用真实数据校准
> 工作循环,而不是靠纸面 review。workflow skills 的 closeout 在返工时按共享
> rework-log 规则追加到这里。
>
> 读法:某一环反复漏气 → 收紧该环的默认档;某一环从不产生返工 → 该环可能
> over-engineering,考虑简化。

| 日期 | 工单 | 返工来自 | 一句话 |
|---|---|---|---|
| 2026-07-02 | bootstrap install.py merge_contract 畸形态吞内容 | 无(设计时未枚举标记畸形态,测试只覆盖正常路径) | 多视角审查实测复现"BEGIN 无 END 二次运行吞用户内容"后返工:加预检+.bak+4 条畸形态测试 |
| 2026-07-02 | bootstrap agent-doctor.py tree_hash 假阳性 DRIFT | 无(原 tree_hash 只跳点号目录,未排除 __pycache__/pyc;脚本零测试) | 多视角审查发现 copy 模式 skill 因构建产物误报漂移:tree_hash 排除 __pycache__/.pyc,补 4 条 doctor 测试 |
