# Report and delivery

Keep one canonical report, `{date}-{feature}-e2e-test-report.md` in the run directory,
mirroring the plan's name; it is the default home for the run's facts.
Apply the language policy in [RUN.md](RUN.md); only identifiers, closed status
vocabularies, commands, and quoted evidence retain their original spelling.

For the standard Chinese reader layout, write new reports in
[report/v1](../references/REPORT-FORMAT.md). Its case headings own the selected
IDs and verdicts; the renderer derives the counts and comparison table. Keep the
business conclusion and full evidence in this Markdown, without a second data model.

## Canonical report

### Conclusion and counts

Lead with the observed business outcome: what works, fails, or remains unknown,
the affected object and material impact, then the next action or decision. A reader
should understand this opening without knowing the test's formulas or assertion
vocabulary. Explain the scope and authority of passing checks after that outcome;
matching a planned formula establishes that check, not the formula's business
correctness. When later evidence reveals a defect, lead with it while preserving
the earlier check results and their original expectations.

Account for `passed`, `failed`, `blocked`, `unverified`, and `skipped` from the
selected-scenario records; report/v1 generates their counts in HTML, while other
formats include them explicitly. An all-pass conclusion requires a
nonempty selection with every selected scenario passed; zero selected scenarios and
all-skipped runs are never successful runs.

### Contents

Group the following facts into a short report; they are required information, not
twelve mandatory sections or repeated tables. Merge small groups and omit inapplicable
details instead of filling empty schemas.

| Information | Content |
|---|---|
| Run context | Selected IDs and exclusions, local/test target and actual build/source identity, relevant harness/runtime and real/double boundary, source plan path/hash, timing, and prior run/overrides when present. |
| Scenario results | One record per selected scenario: ID, terminal status, oracle, expected, actual, evidence link, and diagnosis when there is a deficit. Distinct assertions within a bundled case remain distinguishable. |
| Evidence and findings | Per-scenario proof from `RUN.md`, raw output or its attachment, and each root cause once with affected IDs, disposition, and next step. Shared command output is retained once and referenced by assertion. |
| Continuation and state | Exact rerun command or recorded adapter sequence, next actionable work, and actual cleanup/retention state. A read-only run can state that no business data changed; writes name owner, retained IDs/TTL, recovery/cleanup invocation, and observed cleanup receipt. |

A verdict row should explain the expected/actual difference without joining multiple
documents. Link its detail directly. Source and deployment facts need one home; reuse
that record for provenance and state resumption instead of copying it into several
ledgers. If an existing downstream consumer requires a named schema, retain that
schema for this handoff and name the consumer.

Before delivery, recheck the upstream hash. If it changed, keep the consumed revision
and expectations explicit; reconcile changed source facts without rewriting the
observed result.

## Issue records

Reconcile findings with the local files required by
[Defect Handoffs](REFERENCE.md#defect-handoffs). Link each issue from the report's
finding summary and affected scenario results; each issue links back to its source
run and evidence. Keep the report's business conclusion and expected/actual summary
readable without opening the issue file. Finding counts and scenario counts differ.

## Additional artifacts

Create only artifacts with a concrete consumer or payload need:

- `attachments/` for large raw output, screenshots, or binary evidence that would
  obscure the proof chain; retain an inline summary and precise pointer.
- `plan-snapshot.md` for otherwise unavailable source facts or complex derived mechanics
  that must be reused. Ordinary resolved commands and inputs fit in the report.
- `scripts/` for genuinely needed replay or owned-data cleanup helpers; prefer existing
  project commands. Read [Replay Entry Points](REFERENCE.md#replay-entry-points) when
  generating a helper or a new orchestrated invocation sequence.
- Machine-readable metadata/results only for a named machine consumer; they project
  the canonical facts, not a second independent verdict.

Use a fresh continuation directory for a rerun; existing commands remain valid rerun
instructions when the next executor controls capture and report generation. A helper
need not contain a report generator. State who produces the new report: the executor,
the existing harness, or an explicitly requested unattended entry point. A manually
recorded sequence is replayed step by step, inspecting each result before dependent
actions or cleanup. Do not advertise it as an unattended executable.

## Final reconciliation

Check selection → results and results → selection, resolving every cited scenario,
root-cause, issue, or evidence reference. Mark references to upstream-only scenarios
as such. Preserve attempted failures and blockers even if later attempts passed.
Every finding requiring resolution has an existing issue file with matching ID,
affected cases and disposition; verify report-to-issue and issue-to-source links.
Cleanup claims require their observed receipt and independent absence/restoration
proof; unresolved evidence or lifecycle obligations remain visible.

Read the opening on its own: it must identify the business outcome and impact,
retain material uncertainty, and agree with both the scenario results and later
findings. Counts or statements that assertions passed do not satisfy this check.

Link the report and useful raw attachments. Summarize every nonzero status count,
actionable findings, blockers, and retained data.
