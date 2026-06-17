# Git Resume Miner Examples

## Example Request

```text
分析这个项目里 author=developer-name 从 2024-01 到 2024-09 的提交，沉淀成 Java 后端简历项目经历，并准备面试话术。
```

## Evidence Command

```bash
python3 scripts/git_resume_miner.py \
  --repo /path/to/repo \
  --author "developer-name" \
  --since 2024-01-01 \
  --until 2024-09-30 \
  --path service \
  --path domain \
  --with-diffs \
  --privacy strict \
  --format markdown
```

Merge commits are excluded by default because they usually add weak resume evidence. Add `--include-merges` only when merge ownership is relevant. Matching history is not capped by default; use `--max-commits N` only when you deliberately want a quick sample before the full pass.

The script is self-contained. It does not read category, taxonomy, or redaction config files; business meaning comes from reading diffs and surrounding code. Workstream Candidates are generated from identifiers and co-changed paths; treat them as prompts for inspection, not final labels.

The inspection plan reports `Matched Authors`, `Evidence Warnings`, `Current-Code Relevance`, and `Next check` commands. Use them to confirm the author boundary, decide whether to inspect current code, search for renames, or treat the commit as historical evidence before writing a resume bullet.

## Project Positioning Example

Weak framing:

```text
Project name: Bonus campaign service, inferred from a repo description and a dominant bonus/ directory.
```

Rewrite:

```text
Project description:
Backend support for customer operations and transaction workflows. Evidence shows work across campaign configuration, transaction processing, settlement recovery, and async compensation; the exact internal project name needs confirmation.
```

Reason:

```text
The repo description and dominant directory are weak metadata. They can guide inspection, but final project framing must follow user-provided context, authoritative docs, and current workflow evidence.
```

## Output Shape

```md
Inputs:
- Repo: /path/to/repo
- Author: developer-name
- Range: 2024-01-01..2024-09-30
- Target: Java backend resume, Chinese interview prep
- Paths: service, domain
- Privacy: strict

Evidence Warnings:
- Multiple author identities matched; confirm they belong to the same person before calibrating ownership language.

Matched Authors:
- Developer Name <developer@example.com>: 18 commits
- Developer Name <developer@users.noreply.example>: 3 commits

Project Positioning:
- Large project: multi-tenant order fulfillment and settlement platform.
- Subsystem: order state flow, payment settlement, reconciliation, notification, or data-sync domain.
- User-owned workstream: the specific product integration or workflow proven by commits and code.

Contribution Map:
- Order fulfillment workflow and domain rules
  Evidence: a1b2c3d, e4f5g6h, touched service/, domain/, database migration files
  Confidence: Observed for implementation ownership; Inferred for business impact

Inspection Plan:
- a1b2c3d score=8.8 add product order workflow
  Why inspect: change_size=480, file_count=6, directory_breadth=2
  Current-Code Relevance: 5/6 currently present (0.833)
  Present now: service/OrderWorkflowService.java, domain/OrderState.java
  Missing now: database/migration/20240101_add_order_audit.sql
  Next check (full diff): git show --find-renames a1b2c3d
  Next check (path history): git log --follow -- service/OrderWorkflowService.java
  Next check (current file): git show HEAD:service/OrderWorkflowService.java
  Subject terms: product=1, order=1, workflow=1
  Path terms: service=2, domain=2, order=2
  Files: service/OrderWorkflowService.java, domain/OrderState.java
- i7j8k9l score=6.5 handle provider callback retry
  Why inspect: change_size=260, file_count=4, directory_breadth=2
  Current-Code Relevance: 4/4 currently present (1.0)
  Present now: client/ProviderClient.java, handler/CallbackHandler.java
  Missing now: n/a
  Subject terms: handle=1, provider=1, callback=1, retry=1
  Path terms: client=1, provider=1, handler=1
  Files: client/ProviderClient.java, handler/CallbackHandler.java

Code Evidence:
- service/OrderWorkflowService.java: handles state transitions and failure compensation.
  Commits: a1b2c3d, e4f5g6h. Confidence: Observed.
- database/migration/...sql: adds workflow audit table and indexes used by state queries.
  Commits: q1w2e3r. Confidence: Observed.

Workstream Candidates:
- order_workflow: current files present, multiple representative commits. Validate as a likely resume theme.
- provider_callback: strong diff evidence but shared ownership. Use `expanded` or `improved`, not `owned`, unless the user confirms ownership.
- doc_generator: real contribution but narrower than transaction consistency. Keep as interview backup unless the target role values internal tooling.

Scoring Note:
- Candidate score is weighted by current code relevance so deleted historical paths are less likely to dominate the first inspection pass. Still read representative diffs and current code before deciding value.

Diff Samples:
- a1b2c3d touched workflow state handlers and persistence mapping. Use this only as a preview; read the full diff and current files before writing final claims.

Key Contributions:
- Productized workflow extension: used state-machine nodes to isolate business-line rules from the shared lifecycle, preserving workflow extensibility. Evidence: a1b2c3d, e4f5g6h. Confidence: Observed.
- Transaction status consistency: used async messaging, idempotency locks, and state checks to reduce duplicate callbacks, concurrent transitions, and ambiguous intermediate states. Evidence: i7j8k9l. Confidence: Observed.
- Downstream settlement data trust: reconciled external settlement records against platform calculations before persistence, protecting fee and sync data consistency. Evidence: m1n2o3p. Confidence: Inferred. Metric Question: production impact metric needed.

STAR Story:
- Situation: A multi-tenant transaction platform needed to add a new business-line workflow without breaking shared lifecycle behavior.
- Task: Own the backend integration boundary for the product-specific workflow.
- Action: Extended state handlers, persistence mappings, provider clients, callback validation, idempotency locks, and compensation paths.
- Result: Code evidence supports delivered workflow coverage; ask user for launch, volume, latency, or defect metrics.

Follow-up Questions:
- Was this feature shipped to production, and roughly how many users or cases did it affect?
- Were there before/after metrics for latency, defects, manual review time, or release frequency?
```

## Resume-Ready Shape

Use this fictionalized shape when the user asks for a version that can go into a resume. Prefer four bullets, remove overlaps, and do not include confidence labels or real project/customer/product names in skill examples.

Before writing the final version, prune the evidence:

```md
Candidate Ranking:
1. Transaction consistency recovery - keep as bullet. Current code, multiple diffs, clear failure mode.
2. Async task reliability - keep as bullet. Reusable infrastructure and retry/serial execution behavior.
3. Domain workflow extension - keep as bullet. Strong ownership and business workflow depth.
4. Data trust before downstream sync - keep as bullet. Distinct consistency boundary.
5. Thread-pool monitoring - interview backup. Useful, but narrower and weaker than the core workflow.
6. Historical deleted integration - downgrade. Commit evidence exists, but Current-Code Relevance is low and no current replacement path has been verified.

Pruning Decision:
- Merge "async retry" and "message idempotency" into one reliability bullet.
- Use early platform cleanup as project context, not a final bullet.
- Keep four bullets ordered by resume value, not chronology.
- Downgrade verbs when evidence shows multi-author ownership. Prefer "expanded" or "contributed to" over "owned" for shared subsystems.
- Move support tooling to interview backup when it is weaker than the four core system contributions.

Final Output Decision:
- Return only the resume-ready project description, core contributions, and metric questions.
- Do not include this ranking table unless the user explicitly asks for analysis.
- Run one self-review pass before returning and rewrite overstated ownership or duplicate themes.
```

```md
项目名称：企业级订单履约与结算平台

项目描述：
面向多业务线交易场景的后端核心系统，承载订单状态流转、支付结算、对账处理、外部通知和下游数据同步等关键链路。负责某业务线后端接入，将差异化规则纳入平台通用履约生命周期，保障交易状态流转和外部系统数据同步的一致性与可扩展性。

核心贡献：
- 业务流程产品化扩展：基于状态机与节点化处理模型，将核心履约节点接入平台统一生命周期，隔离业务线差异规则，保持主链路可扩展。
- 外部服务接入标准化：封装外部服务请求、结果查询和状态映射能力，统一成功、失败、处理中等状态语义，降低外部系统差异对内部交易流程的影响。
- 交易状态一致性治理：通过异步消息、分布式锁和状态校验，治理外部系统重复回调、中间态重试和并发推进问题，保障交易状态流转一致性。
- 下游数据可信保障：在结算数据落库前对外部记录和平台测算结果进行维度校验，保障费用、账务和同步数据一致。

待补充指标：
- 上线订单量或交易规模
- 状态异常、人工对账、缺陷率或接入周期的前后变化
```

Do not append code paths, commit hashes, confidence labels, or the candidate ranking after the resume-ready section. Those belong in `analysis` mode.

## Senior Gate Example

Weak:

```text
状态机编排：实现多个状态节点和 DTO。
```

Rewrite:

```text
业务流程扩展：基于状态机与节点化处理模型，将业务线差异规则接入平台统一生命周期，降低新增场景对通用交易主链路的侵入。
```

Overlapping:

```text
多系统协同交付：贯通订单、支付、结算、通知等多个系统边界，沉淀业务线接入复用路径。
```

Action:

```text
If this mostly repeats workflow extension or provider integration, merge it into those bullets or drop it unless there is a unique metric.
```

Engineering title:

```text
接入边界抽象：封装外部服务状态。
```

Rewrite:

```text
外部服务接入标准化：统一外部服务请求、查询和状态映射能力，降低外部系统差异对内部交易流程的影响。
```

Implementation-layer inventory:

```text
覆盖接口层、业务层、任务层、持久化层等多层开发。
```

Rewrite:

```text
贯通运营配置、计划执行、交易处理和异常恢复链路，将服务端实现表达为业务流程闭环，而不是代码分层清单。
```

## Review Checklist

- Every resume bullet has at least one evidence anchor.
- Each primary bullet has Current-Code Relevance evidence, or is explicitly framed as historical/interview material.
- Key contribution themes must be problem/domain oriented, not bare technology tags like `state machine orchestration` or `async idempotency`.
- Resume-Ready output prefers four bullets; use five only when the fifth has distinct senior-level value.
- Merge or drop bullets that repeat the same contribution theme or result.
- Each highlight should carry one idea only; split mixed bullets.
- DTOs, constants, fields, and query methods appear only as evidence, not as final resume selling points.
- Code-structure inventories appear only in analysis mode unless the user asks for architecture detail.
- Unsupported business metrics are written as questions, not claims.
- If a contribution lacks quantified impact, mark it `Needs Confirmation` and ask one focused Metric Question.
- Remove `Observed`, `Inferred`, and `Needs Confirmation` labels from Resume-Ready bullets.
- Remove code paths, commit hashes, and candidate rankings from Resume-Ready output unless explicitly requested.
- Apply the 20-second scan test: scope, technical judgment, solved problem, and result value must be visible fast.
- The strongest bullets appear first and match the target role.
- Interview stories include enough technical depth for follow-up questions.
