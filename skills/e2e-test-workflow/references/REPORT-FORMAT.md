# Deterministic execution-report view

Use this format for new Chinese execution reports that use the accepted reader
layout. The renderer consumes the canonical Markdown directly; it neither invokes
a model nor decides business outcomes. Plan views, other interface languages and
requested redesigns use the design branch in [READER-VIEW.md](../READER-VIEW.md).

## Write once

The first two lines are the marker and report title. The introduction states the
business outcome, significant issues and next action. Each selected scenario has
one level-two heading: stable ID, terminal status, and meaningful name. Its first
paragraph is the business result shown in the comparison table; the rest holds
the full effective contract, actual evidence, authority and lifecycle.

```markdown
<!-- e2e-reader: report/v1 -->
# 交易确认验证报告

确认记录缺失，业务验证未通过。问题及下一步见 [F01](issues/F01.md)。

## E01 [failed] 确认交易

任务已完成，但预期确认记录未生成。[F01](issues/F01.md) 待修复决定。

### 预期与实际

| 字段 | 预期 | 实际 |
|---|---|---|
| record | 存在 | null |

完整输入、独立期望及证据写在本例；共享环境见 [运行上下文](#shared-context)。
资料来源：[消费计划](plan-snapshot.md)、[原始响应](attachments/response.json)。

## shared:context 运行上下文与保留现场

本段适用于 E01；记录实际环境、版本、权限、保留状态及继续方式。
```

Use `passed`, `failed`, `blocked`, `unverified`, or `skipped` exactly as assigned
under RUN.md. The heading owns that verdict; counts and the comparison table are
computed from these headings. Keep issue dispositions in their records and linked
business summaries. One issue can affect several cases; case counts are not issue
counts. The renderer checks syntax and references, not issue correctness or whether
the introduction agrees with the evidence.

Shared sections use `## shared:ID Title` and live inside the first case's
disclosures. Each inheriting case explicitly links `#shared-ID` and states its
applicability. This placement does not make every shared fact apply to every case.
IDs are ASCII letters followed by letters, digits, underscores or hyphens. IDs
must be unique, including generated `CASE-record`, `shared-ID`, `overview` and
`cases`. Other level-two headings are rejected. Level-three through level-six
headings organize a case's body.

## Render and validate

From any working directory, use the installed skill's actual script path:

```text
python <skill>/scripts/render_report.py <report.md> --output <report.html>
```

Python 3.10+ and its standard library suffice. Output defaults to the same-stem
HTML; source Markdown is never overwritten. A successful call returns the source
hash, selected IDs, computed counts and checked-link count. It does not certify
business correctness or browser appearance.

The supported Markdown subset is paragraphs, flat `-` lists, headings, fenced
code with triple backticks, pipe tables with outer pipes, inline code, `**bold**`,
`*emphasis*`, inline links and local images. Link destinations with spaces use
percent encoding; parentheses in destinations also need encoding. Literal pipes
inside table cells are unsupported; move that evidence to a code block. Nested
lists, reference links, raw HTML and other block syntaxes need an explicit source
adaptation; the helper rejects recognized unsupported syntax rather than silently
dropping it. Underscores remain literal, including field identifiers.

Local links are resolved against the Markdown and emitted as absolute file URLs,
so the HTML can be placed elsewhere on the same machine. It is not a bundled
export. Local targets must exist; same-page fragments must resolve. Remote links
are retained without network verification. Cross-file fragment contents and issue
semantics remain the executor's checks. Local images remain evidence attachments.

For a legacy report, adapt a separately named Markdown copy: add explicit case
headings from its recorded verdicts, preserve all effective case facts and shared
applicability, and rebase relative links. Keep the historical source and its hash.
An unknown verdict or ambiguous ownership is a source-resolution task, not a
renderer inference. Do not silently retrofit an old report in place.

On failure, inspect the concise error and fix the affected input or helper. A
validation failure leaves an existing HTML untouched; it is stale, not a valid
view of the failed input. If the contract cannot represent the source faithfully,
deliver the Markdown with the unresolved rendering gap instead of automatically
cycling through model authors. Use the design branch when the user requests a
new layout or a view outside this supported scope.
