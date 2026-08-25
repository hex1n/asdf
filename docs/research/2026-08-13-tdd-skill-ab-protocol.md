# TDD skill A/B 实验协议(2026-08-13)

> 动机:检验个人 `tdd` skill(`~/.agents/skills/tdd`,red→green 垂直切片指令)
> 对 agent 产出质量是否有可辨增益。设计仿照 Birgitta Böckeler
> 《TDD inside the agent loop - theater or actual value?》的探索性评测
> (https://martinfowler.com/articles/exploring-gen-ai/tdd-in-the-agent-loop.html),
> 背景与动机见 [2026-08-13-tdd-with-ai-agents-chatgpt-dialogue.md](2026-08-13-tdd-with-ai-agents-chatgpt-dialogue.md)。
> 定位与她相同:小样本探索,产出的是假设,不是定论。

## 假设

H0(她的发现):对 agent 下达规定性 TDD 流程指令,相比不作过程约束,
产出的正确性与设计/测试质量无可辨差异。

## 设计

- **任务**(greenfield 业务逻辑,Node ESM stdlib-only,公共 API 在规格中钉死):
  - S:FIFO 分级赎回费计算器(持有天数分层费率、FIFO 消耗、舍入、错误契约)。
  - M:钱包账本(幂等存款重放语义、资金冻结/部分捕获/释放、错误契约、
    失败操作零副作用)。
- **两臂 × 2 重复 × 2 任务 = 8 次编码运行**,全部 Sonnet,互相隔离目录,
  各自只见 SPEC.md:
  - TDD 臂:被要求读取并严格遵循 `~/.claude/skills/tdd/SKILL.md`(red→green
    垂直切片,每个 red/green 记入 BUILD_LOG.md)。seam 预先声明为规格钉死的
    API(适配:skill 要求与用户确认 seam,无人值守运行中以规格代替)。
  - 对照臂:过程完全自由,只要求交付覆盖规格行为与边界的测试套件。
- **评价三层**(比原实验多第一层客观信号):
  1. **留出 oracle 测试**:实验者预先从规格写好(S:14 条,M:13 条,含边界、
     错误契约、幂等语义),agent 不可见;先在参考实现上验证全绿后才投入使用。
     衡量:客观正确性。
  2. **盲评**:评审 agent(默认模型,强于编码模型)只看匿名化的 src+test
    (剥离 BUILD_LOG 等可泄露臂别的文件,标签随机置换),对 4 份/任务排名:
     实现设计质量、测试套件质量(行为性/非套套逻辑/边界覆盖)、规格忠实度。
  3. **过程依从性核对**:读 BUILD_LOG,确认 TDD 臂真的执行了 red→green
    (否则测的不是干预),对照臂没有自发做 TDD。

## 效度威胁(预先声明)

- n=2/臂/任务,只能看方向,不能做统计推断。
- 编码 Sonnet、评审默认模型(能力差距是有意的,同她的 Sonnet 写/Opus 评)。
- API 钉死限制了"设计质量"的可变空间(为 oracle 可运行所必需的取舍)。
- greenfield 小任务;结论不外推到 brownfield 回归保护场景。
- oracle 由实验者从自己写的规格衍生,规格意图即事实源(封闭一致,但不检验
  规格本身的合理性)。

## 产物

- 运行目录与 oracle:session scratchpad `tdd-ab/`(临时,不入库)。
- 结果:`2026-08-13-tdd-skill-ab-results.md`(待运行完成后写入)。
