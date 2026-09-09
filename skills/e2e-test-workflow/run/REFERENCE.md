# Conditional execution contracts

The ordinary verdict and report contracts live in `RUN.md` and `REPORTING.md`.
Read these sections only for generated replay orchestration or a repair handoff.

## Replay Entry Points

Prefer an existing harness invocation. Generate a helper only for missing mechanics
or a requested executable handoff. A recorded adapter sequence is also a valid
agent-operated replay; distinguish it from an unattended executable.

### Assign responsibilities

Declare what the entry point owns: inputs, invocation, observation/assertions, evidence
capture, report production, and any seed/cleanup. Keep responsibilities it does not
own with the caller or existing harness. A read-only helper can emit assertion results
and raw output while the executor captures evidence and writes the report; it needs
no embedded Markdown/HTML renderer or artificial mutation/cleanup phase.

Each replay writes new evidence only into a fresh continuation directory and
back-links its upstream run/plan. When the caller owns capture, it creates that
continuation before invoking the command. Generated helpers that own capture create
and validate it themselves. Historical reports, evidence, and validated helpers stay
immutable, including during validation probes.

A helper claiming unattended execution must emit sufficient scenario-keyed verdicts,
raw evidence, and consumed source identity to support the canonical report. If it
also promises report generation, validate that report-producing path; otherwise name
the caller that completes the report. Evidence-capture failure is a tooling failure,
not a successful unattended run.

### Preserve verdicts and state

Gate dependent trigger, wait, probe, assertion, and cleanup phases on the preceding
results. Preserve the first business/assertion nonzero or returned adapter failure
through subsequent reporting and exception handling. A parent latches a child's
nonzero before forwarding output; forwarding failures are separate receipts and
cannot replace it. Keep that latched status available to the outermost handler and
final output path. Capture failure evidence before any recovery can overwrite it.

For helpers that create/mutate business state or ownership scaffolding, bind receipts
to helper bytes and source identity, record owned targets and the allowed lifecycle,
and account for partial creation. A failed phase denies ordinary cleanup; retain the
scene and a recoverable cleanup path. A separately authorized cleanup can later act
on that recorded state after sufficient evidence is preserved.

Before cleanup, persist and read-verify the evidence needed for diagnosis and the
current owned-state/verdict record. When canonical-report production belongs to the
entry point, this gate includes that report. A capture/report-write/verification
failure prevents cleanup. Keep recoverable receipts and truthful terminal state;
never prebuild a completed-cleanup claim. After cleanup, retain an independent
absence/restoration observation and update the report/receipt through verified
replacement so a failed update cannot destroy the prior verified evidence.

Validate filesystem parents within the authorized output boundary before creating
targets; reject traversal and symlink escape, then verify the created target. Before
deleting/restoring, verify the recorded owner and exact authorized target. Apply
these checks inside generated helpers that own the operation, including retained-data
cleanup entry points. Record remaining owned data or scaffolding explicitly.

### Validate the responsibilities exercised

Run a representative invocation of the final helper bytes. Verify forwarded inputs,
actual assertions/exit status, capture, and continuation placement for the phases it
owns. An unchanged harness can reuse relevant contract-test evidence plus a smoke
check of this invocation; validate newly introduced wrapper logic separately. If
helper bytes change after validation, rerun the affected validation before delivery.

Choose additional probes only for responsibilities the helper has:

| Responsibility | Required evidence |
|---|---|
| Custom validation, phase gates, or exit-status handling | A relevant invalid-input or nonzero path preserves failure and prevents dependent phases. |
| Business mutation or ownership scaffolding | Failure at a relevant mutation boundary accounts for partial owned state and preserves diagnostic and historical evidence. |
| Cleanup gated by capture or report writing | Capture/report-write or verification failure prevents cleanup and leaves a recoverable evidence path. |
| Deletion or restoration | Authorized cleanup produces a verified absence/restoration receipt; a mismatched owner or out-of-bound target is rejected. |
| Exception handling after a verdict, including output forwarding | A child or assertion nonzero survives a subsequent reporting/output exception, including the outermost handler. |

One probe can cover several relevant risks. A pure read-only helper has no mutation
or cleanup probe requirement. Retain input, result, and evidence for each validation
attempt in its continuation. These receipts can be compact; they need no separate
full report per probe when one validation report clearly distinguishes the attempts.

If an applicable property is unverified, name the limitation and do not advertise
that operation as validated. Deliver an observed existing command or agent-operated
sequence when it provides a verified alternative. An observed product mismatch may
be the expected outcome of a helper validation; preserve both the failed scenario
and the fact that its failure was correctly propagated.

## Defect Handoffs

Scenario results describe observations; a root cause can affect several scenarios.
Record each finding once with an ID, affected scenarios, expected/actual, evidence,
and disposition. Keep findings inline unless a repair workflow or named consumer
needs separate issue documents.

| Disposition | Meaning |
|---|---|
| `OPEN` | Unresolved, actionable now by the named owner within that owner's authority; a delegated executor does not acquire product-fix authority. |
| `CLOSED` | Verified complete or no longer applicable. |
| `MITIGATED` | A workaround exists; residual risk remains explicit. |
| `ACCEPTED` | Deliberately accepted by the named owner. |
| `CONDITIONAL` | Requires a named precondition or owner's decision. |
| `BLOCKED-BY-TOOLING` | A specific execution/observation capability is missing. |
| `BLOCKED-BY-ENVIRONMENT` | A required dependency, sample, or fixture is unavailable. |
| `OUT-OF-SCOPE` | Excluded by the current task boundary or user override. |

Preserve inherited planner dispositions until this run changes the item's state.
Only `OPEN` findings become immediate executable next actions; other findings retain
their missing precondition, decision, capability, or scope reason. Superseded plan
requirements are recorded as overridden, never as product failures.

When using `issues/`, create one document per actionable root cause and an index only
when several issues need a queue. Include reproduction inputs/steps, expected/actual,
evidence, suspected area and fix constraints, and a post-fix verification/closure
rule. Link affected results to that issue. Close a product defect only after the fix
is loaded and its required E2E scenarios and affected dependents have fresh passing
evidence; preserve earlier reports. Issues live only as these local documents.
