# Report and delivery

Keep one canonical `execution-report.md` and, unless Markdown-only is requested, one
desktop `execution-report.html`. The report is the default home for the run's facts.
Use the end-user language for headings and prose; only identifiers, closed status
vocabularies, commands, and quoted evidence retain their original spelling.

## Canonical report

Begin with the conclusion and counts. Group the following facts into a short report;
they are required information, not twelve mandatory sections or repeated tables.
Merge small groups and omit inapplicable details instead of filling empty schemas.

| Information | Content |
|---|---|
| Run context | Selected IDs and exclusions, local/test target and actual build/source identity, relevant harness/runtime and real/double boundary, source plan path/hash or ad-hoc contract, timing, and prior run/overrides when present. |
| Scenario results | One row per selected scenario: ID, terminal status, oracle, expected, actual, evidence link, and diagnosis when there is a deficit. Distinct assertions within a bundled case remain distinguishable. |
| Evidence and findings | Per-scenario proof from `SKILL.md`, raw output or its attachment, and each root cause once with affected IDs, disposition, and next step. Shared command output is retained once and referenced by assertion. |
| Continuation and state | Exact rerun command or recorded adapter sequence, next actionable work, and actual cleanup/retention state. A read-only run can state that no business data changed; writes name owner, retained IDs/TTL, recovery/cleanup invocation, and observed cleanup receipt. |

A verdict row should explain the expected/actual difference without joining multiple
documents. Link its detail directly. Source and deployment facts need one home; reuse
that record for provenance and state resumption instead of copying it into several
ledgers. If an existing downstream consumer requires a named schema, retain that
schema for this handoff and name the consumer.

Before delivery, recheck the upstream hash. If it changed, keep the consumed revision
and expectations explicit; reconcile changed source facts without rewriting the
observed result. A conversational source is pinned by its retained scenario contract.

## Additional artifacts

Create only artifacts with a concrete consumer or payload need:

- `attachments/` for large raw output, screenshots, or binary evidence that would
  obscure the proof chain; retain an inline summary and precise pointer.
- `plan-snapshot.md` for otherwise unavailable source facts or complex derived mechanics
  that must be reused. Ordinary resolved commands and inputs fit in the report.
- `scripts/` for genuinely needed replay or owned-data cleanup helpers; prefer existing
  project commands. Read [Replay Entry Points](REFERENCE.md#replay-entry-points) when
  generating a helper or a new orchestrated invocation sequence.
- `issues/` when a repair workflow or named consumer needs separate actionable units.
  Otherwise keep root causes inline. Read [Defect Handoffs](REFERENCE.md#defect-handoffs)
  when creating a fix queue or assigning an unclear disposition.
- Machine-readable metadata/results only for a named machine consumer; they project
  the canonical facts, not a second independent verdict.

Use a fresh continuation directory for a rerun; existing commands remain valid rerun
instructions when the next executor controls capture and report generation. A helper
need not contain a report generator. State who produces the new report: the executor,
the existing harness, or an explicitly requested unattended entry point. A manually
recorded sequence is replayed step by step, inspecting each result before dependent
actions or cleanup. Do not advertise it as an unattended executable.

## Reader View

Author a self-contained desktop HTML page from the finalized canonical report. Start
with the verdict distribution, tested target/revision, significant failures/blockers,
and exact next run or required decision. Show `passed`, `failed`, `blocked`,
`unverified`, and `skipped` counts from the same selected-scenario records. An all-pass
headline requires a nonempty selection with every selected scenario passed. Zero
selected scenarios and all-skipped runs never become successful runs.

Use a comparison table with **Scenario**, **Expected Input**, **Expected Result**, and
**Actual Result**, localized to the audience. Expected fields come from the consumed
plan and approved overrides; actual fields come from this run. Make terminal status
visible, with oracle, diagnosis, evidence, and full effective details expandable in
the same scenario's row. Group shared root causes once and link affected scenarios.

Keep all facts needed to understand, audit, rerun, or clean up accessible in the page.
Embed supporting text/evidence in expandable detail or link bulky canonical/raw
attachments directly for inspection/download. A Markdown, SQL, JSON, or log link does
not require another HTML file. Add a companion only for a real size/navigation need.
Preserve canonical paths and provenance, and audit any extra pages that are created.

Use semantic HTML, inline CSS, native disclosures, UTF-8, localized controls, textual
status labels, visible keyboard focus, and a desktop layout with readable tables and
wrapping. Keep the report readable without JavaScript; optional inline interaction
only filters/navigates existing facts. Use no external fonts, scripts, or CDNs. Escape
raw evidence. Add a flow/timeline only when it explains real dependencies or recovery.

Verify before delivering HTML:

1. Compare each scenario's actual field values, authority, oracle, diagnosis, evidence,
   and cleanup state against Markdown and the consumed plan. Never resolve a mismatch
   by changing the expected result to the actual result.
2. Recompute counts/headline and reconcile selected IDs, unresolved findings,
   exclusions, retained data, and the exact continuation set. IDs/counts alone do not
   establish semantic agreement.
3. Audit local links and fragments, including raw attachments, for existence within
   the intended report/source boundary. Preserve UTF-8 and raw evidence contents.
4. Render at a normal desktop viewport and inspect the opening, scenario/failure
   details, tables, links, focus, wrapping, and overflow. Fix clipped content or
   misleading status/flow presentation.

If render inspection or a necessary fidelity check is unavailable, deliver Markdown
and explain why the HTML view was withheld. File creation alone is not a render pass.

## Final reconciliation

Check selection → results and results → selection, resolving every cited scenario,
root-cause, issue, or evidence reference. Mark references to upstream-only scenarios
as such. Preserve attempted failures and blockers even if later attempts passed.
Cleanup claims require their observed receipt and independent absence/restoration
proof; unresolved evidence or lifecycle obligations remain visible.

Link HTML first when delivered and also provide canonical/raw links when useful.
Summarize every nonzero status count, actionable findings, blockers, and retained data.
