# Plan Review Eval Infrastructure

**问题**: 如何在不依赖 token telemetry 的情况下，可靠验证 plan-review redesign？
**核心结论**: 使用固定 git base 的 deterministic preflight，加每 arm/样本 3 trials 的 stable-finding 聚合，并以 model calls、输入/输出字符和 wall-clock 作为成本指标。
**产物类型**: supporting
**验证状态**: local tests passed
**开放问题**: 1 - 见文末

## 工具

### Base-revision preflight

```sh
node scripts/plan-review-eval/preflight.mjs preflight-manifest.json
```

Manifest：

```json
{
  "candidate_id": "sample-1",
  "repo": "/absolute/path/to/repo",
  "base_revision": "<commit sha>",
  "candidate_files": ["docs/plans/sample.md"],
  "checks": [
    {
      "id": "target-exists",
      "type": "path_exists",
      "path": "src/target.ts",
      "severity": "blocker",
      "summary": "The implementation target exists at the pinned base.",
      "evidence_refs": [{"path": "docs/plans/sample.md", "lines": "20-24"}]
    },
    {
      "id": "acceptance-present",
      "type": "text_contains",
      "file": "docs/plans/sample.md",
      "needle": "## Acceptance",
      "severity": "should_fix",
      "summary": "The plan contains an acceptance section.",
      "evidence_refs": [{"path": "docs/plans/sample.md", "lines": "1-end"}]
    }
  ]
}
```

支持的确定性 check：

- `path_exists`
- `path_absent`
- `text_contains`
- `text_absent`

所有 candidate 内容和路径检查都通过 `git show <resolved-commit>:<path>` 或
`git cat-file` 读取，不读取当前 checkout。输出同时包含：

- resolved base commit；
- candidate SHA-256；
- 完整 check trace；
- 只含 failed checks 的 `compact_display`。

Script 不执行计划里的 shell command，避免把环境失败误报为 plan defect。

### Three-trial aggregator

```sh
node scripts/plan-review-eval/aggregate-trials.mjs experiment.json
```

每个 trial：

```json
{
  "arm": "baseline",
  "sample_id": "sample-1",
  "trial_id": "baseline-sample-1-1",
  "runtime": "codex",
  "model": "model-snapshot-or-visible-name",
  "experiment_identity": "sha256-of-fixed-experiment-definition",
  "artifact_hash": "sha256-from-preflight",
  "resolved_base_revision": "full-commit-id-from-preflight",
  "adjudication_version": "adjudicator-v1",
  "arm_config_hash": "sha256-of-this-arm-config",
  "invocation_id": "runtime-derived-request-or-job-id",
  "session_id": "runtime-derived-session-id",
  "model_invocations": 1,
  "physical_sessions": 1,
  "retries": 0,
  "input_characters": 12000,
  "output_characters": 2400,
  "wall_clock_ms": 18000,
  "findings": [
    {
      "semantic_key": "missing-rollback",
      "severity": "blocker",
      "validation": "confirmed"
    }
  ]
}
```

Experiment：

```json
{
  "trials_required": 3,
  "provenance_mode": "self_reported",
  "preflight": {
    "candidate_hash": "sha256-from-preflight",
    "resolved_base_revision": "full-commit-id-from-preflight",
    "summary": { "failed": 0 }
  },
  "baseline_arm": "baseline",
  "candidate_arm": "candidate",
  "max_candidate_wall_clock_ratio": 1.1,
  "arms": {
    "baseline": ["three trial objects per sample"],
    "candidate": ["three trial objects per sample"]
  }
}
```

Stable finding 定义为同一 `semantic_key` 在至少 2/3 replicated runs 出现；severity 与
validation 必须作为联合状态同样达到 2/3，不能把不同 trials 的标签拼成一个
从未稳定出现的 confirmed blocker。聚合器要求：

- 两臂覆盖完全相同的 samples；
- 实验至少包含一个 sample，空实验 fail closed；
- 每 arm/sample 恰好 3 个唯一 run records；手填 provenance 只能证明记录不同，不能证明执行独立；
- 所有 trial 使用相同 runtime/model；trial ID、runtime-derived invocation ID
  和 session ID 全局唯一；
- 所有记录绑定相同 experiment identity、候选 artifact hash 和 adjudication version；
  每个 arm 的配置 hash 在该 arm 内保持不变；
- repo 文件名必须是规范化的相对路径；计数必须是安全整数，聚合溢出直接失败；
- 标识符不允许首尾空白；显式提供但格式错误的阈值不回退默认值；
- candidate 不漏 baseline stable confirmed blocker；
- candidate 每 trial unsupported finding 数不增加，避免用额外 findings 稀释分母；
- candidate model invocation 不增加；
- candidate physical sessions 和 retries 不增加；
- candidate 输入＋输出字符严格下降；
- candidate wall-clock 不超过预注册的正数比例；比例上限为 10，乘法溢出 fail closed。

`semantic_key` 和 `validation` 必须来自盲化 adjudication；脚本不尝试用字符串相似度替代语义裁决。

## 已解决的问题

- 当前 checkout 已实施导致计划步骤过期：通过 git base revision 隔离。
- Mechanical lane 由 LLM 执行：preflight 变为 Node stdlib＋git plumbing。
- 单次 reviewer 方差：强制 3 个 run records，2/3 才算 stable；无可信 runtime adapter
  时结论明确标为 provisional，不声称独立试验已验证。
- Token telemetry 缺失：决策使用 model calls、characters、wall-clock、sessions 和 retries。
- Full trace 挤占上下文：preflight 输出单独提供 compact failed-check display。
- Arm 顺序歧义：显式声明 baseline/candidate 名称。

## 尚未解决

- 工具不会自动调用 Codex/Claude；reviewer invocation 由运行时执行后写入 trial JSON。这是有意边界，避免 core eval harness 绑定某个 provider 或凭证系统。
- 没有可信 runtime adapter 时 invocation/session provenance 仍是自报；即使全部门槛通过，
  聚合结果也只返回 `acceptance_status: provisional` 和 `independence_verified: false`。
- 内嵌 preflight 只建立记录间的结构绑定，不能证明来源真实性；因此输出字段为
  `evidence_gates_pass`，刻意不提供容易被解释成最终验收的 `pass`。
- 没有人工 gold set 时，adjudication 仍是模型裁决，最终结论最高为 provisional。

## 验证

```sh
node --test scripts/plan-review-eval/eval-infra.test.mjs
```

测试覆盖：

- checkout 修改后仍从 pinned commit 读取 candidate；
- base path 和 text checks；
- 2/3 stable blocker 聚合；
- 漏 stable blocker、误报增加、字符不降和 trial 缺失时 fail closed。
- 空实验、非法 severity/validation、runtime/model 不可比、重复 trial/runtime
  provenance ID 和非正 wall-clock ratio 时 fail closed。
- 越界路径、不安全整数、聚合溢出、带首尾空白的 ID 和畸形阈值 fail closed。
- artifact/experiment/adjudication 绑定漂移、arm 配置漂移和超大 wall-clock ratio fail closed。
- Severity 必须同样达到 2/3 一致，单次 blocker 标签不会升级为 stable blocker。

## 开放问题

1. 是否需要增加一个 runtime adapter 层自动调用具体 reviewer，还是保留“运行时产出 trial JSON、stdlib 只负责验证聚合”的可移植边界？
