# TDD skill A/B 实验 Round 2 预注册(2026-08-13)

> Round 1:[协议](2026-08-13-tdd-skill-ab-protocol.md) /
> [结果](2026-08-13-tdd-skill-ab-results.md)。Round 2 针对 round 1 的两条
> 效度威胁:单运行模型(Sonnet)、单任务域组。按 `skill-ab-trial` skill 执行。

## 候选指令(与 round 1 相同)

`~/.claude/skills/tdd/SKILL.md` 的 red→green 流程处方:test-first 垂直切片,
一个失败测试(先运行观察失败)→ 最小实现 → 重复;声称改善的结果:实现与
测试质量。

## 两臂

- **处理臂**:提示词要求读取并严格遵循该 tdd skill(seam 预声明为规格钉死
  的 API);每个 red/green 记入 PROCESS_LOG.md。
- **对照臂**:过程自由;结果等价门槛——"交付彻底覆盖规格行为与边界的测试
  套件"。
- 其余提示词逐行相同(隔离目录、只见 SPEC.md、stdlib ESM、PROCESS_LOG.md、
  不得向用户提问)。

## Bench 形状

- **任务 R**:滑动窗口限流器(配额/窗口规则域:窗口边界、突发信用、
  时间回退错误、per-key 隔离)。
- **任务 P**:促销叠加引擎(顺序/优先级规则域:类型分组优先级、排他选择、
  封顶与地板、舍入、资格判定基准)。
- 两个域均与 round 1(FIFO 分层费率;幂等/资金冻结生命周期)不同。
- 重复:2 次/臂/任务 → 8 次编码运行。
- **运行器:Codex CLI**(经 codex 插件调用;与 round 1 的 Sonnet 构成
  跨模型复现检验)。评审:默认强模型 × 2/任务,独立新上下文,盲评
  (与 round 1 同一评审安排,保持评审层可比)。

## 指标(与 round 1 相同)

留出 oracle 正确性;盲评三维排名(实现设计质量、测试套件质量、规格忠实度);
成本(Codex 侧遥测缺失时按 REFERENCE 规则以日志墙钟/步数代替并标注不可得);
依从性(PROCESS_LOG 证据)。

## 裁决规则

四层裁决照 skill 执行;结论按方向性假设陈述,与 round 1 合并后作为
tdd skill 处置决定的证据基础。预期可证伪点:若 Codex 上处理臂在盲评或
oracle 上系统性占优,则 round 1 的"过程处方无增益"结论不可泛化到跨模型。

## Bench 门(执行前)

- oracle 先在参考实现上全绿;
- 规格中的 worked example 值全部由执行参考实现生成(round 1 勘误教训的
  固化规则)。
