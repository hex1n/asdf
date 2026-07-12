# Plan Review Reference

Load only the branch reached by the current review: compact packet transfer,
focused recheck, round receipts, or failed-invocation recovery. The portable
gate and ordered steps remain in `SKILL.md`.

## Compact Review Packet

For a long candidate, prefer one readable artifact over repeated prompt copies:

```text
candidate_path_or_exact_text
candidate_hash
decision_constraints
rubric
evidence_scope
review_kind
finding_ledger_when_rechecking
```

Use a temporary artifact for a chat-only plan only when the runtime permits the
parent to write it. The reviewer remains read-only. If a remote reviewer cannot
read a local path, send the exact candidate once in that reviewer session and
reuse the session for rechecks; do not send the parent transcript.

Repository disclosure is a separate permission decision. When it is not
authorized, use only supplied evidence or suspend the reviewer lane rather than
silently dropping evidence-dependent rubric criteria.

## Runtime Binding

- In Codex, prefer a configured second-model connector and use a fresh
  collaboration subagent as the recorded fallback.
- In Claude Code, prefer a configured external second model and use a fresh
  read-only Agent subagent as the recorded fallback.
- In either runtime, keep the reviewer read-only and record reviewer identity,
  independence level, disclosure boundary, and every downgrade.

## Helper Agents

Helpers do not count as required reviewers and default to zero. A helper requires
a pre-declared, non-overlapping evidence lane. Its lane must not repeat source
inspection already owned by the parent reviewer, and its output is evidence for
the parent—not an independent verdict. Include each helper's usage in the round
receipt exactly once.

## Focused Recheck

A focused recheck is an intermediate finding-closure mechanism. It never closes
the gate.

It is eligible only when all are true:

- changed sections or paths are contained by finding-linked scope;
- goal, decision constraints, rubric, risk, dependencies, permissions, and
  public interfaces are unchanged;
- the request supplies before/after hashes and a cross-impact statement;
- the reviewer confirms the edit did not escape the declared scope.

Uncertainty or a cross-cutting change promotes the round to a complete review.
For example, correcting one verification command can be focused when no other
claim depends on it; changing a shared compatibility assumption is complete
review work. The same rule fits a data-migration plan and a customer-onboarding
plan: locality is determined by dependency impact, not by domain vocabulary.

## Round Receipt

Immediately after every review round returns, and before the parent validates
findings, record runtime, provider, model, and effort plus these fields:

```text
round_id
invocation_id
revision_hash
review_kind: complete | focused | rebuttal-check
verdict
runtime
provider
model
effort
reviewer_session_id_or_opaque_handle
independence_level
model_calls
uncached_input_tokens
cache_read_input_tokens
cache_write_or_creation_tokens
output_tokens
reasoning_tokens
helper_agent_tokens
raw_total_tokens
usage_source
usage_precision: exact | derived | unavailable
usage_unavailable_reason
normalized_cost
```

Keep token categories separate. `raw_total_tokens` is the sum of available
physical categories, not billed usage. Report uncached input, cache read, cache
write or creation, output, reasoning, and helper-agent usage separately. Report normalized cost only when a
versioned price source covers the provider/model categories; otherwise use
`unknown` and name the missing input.

For cumulative counters, snapshot usage immediately before and after the round
and report the non-negative delta; never sum cumulative snapshots. Helper-agent
usage gets child receipts and rolls up once. A failed, timed-out, cancelled, or
discarded invocation still gets exactly one round receipt so retry cost remains
visible.

Use `usage_precision: exact | derived | unavailable`. Missing telemetry is not
zero usage. When unavailable, record why. At close, aggregate existing receipts
by runtime/model without re-reading raw session logs.

Compact display:

| Round | Revision | Kind | Runtime / model | Verdict | Input | Cache read/write | Output | Helpers | Raw total | Precision |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| R1 | `{hash}` | complete | `{runtime} / {model}` | `{verdict}` | `{n}` | `{read}/{write}` | `{n}` | `{n}` | `{n}` | `{precision}` |

## Recover Before Retry

Use a persistent invocation handle for every external reviewer.

1. Query the invocation and reviewer-session state.
2. Recover any available result before deciding to retry.
3. Wait for or cancel descendants and record their receipts.
4. Prove that no invocation for the same revision and reviewer remains active.
5. Start the single permitted fresh retry only when no result is recoverable.

If the invocation state is unknown, suspend the reviewer lane with the handle and
next status check. Unknown is not failure and does not authorize a duplicate
invocation. A retry gets a new handle and its own receipt; the discarded attempt
remains in the cost summary.

## Gate-State Checker

The state uses `final_reviewer_verdicts` for exactly one authoritative closing
verdict per required reviewer on the current revision. Prior NO-GO, focused, and
rebuttal-check history lives in round receipts; it is not mixed into the closing
verdict set. `round_reports` contains exactly one manifest for every receipt that
returned `GO`, `CONDITIONAL-GO`, or `NO-GO`: invocation id, revision, verdict,
`reviewer_output_disclosed: true`, and the complete finding-ID array, including
an explicit empty array. Every manifest ID maps to exactly one ledger finding;
every ledger finding maps back to its source manifest and records
`parent_validation_disclosed: true`. All collection fields are explicit arrays.
Malformed, missing, or unreconciled collections fail closed.

When Node is available:

```sh
node scripts/check-gate-state.mjs review-state.json
```

The checker prints `{ "pass": boolean, "failures": [...] }` and exits zero only
for a pass. Its JSON fields mirror the Gate Contract. It is a mechanical guard,
not a substitute for parent finding validation or reviewer judgment.
