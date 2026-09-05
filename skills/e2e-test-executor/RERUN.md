# Continue a prior run

Read the previous `execution-report.md` and original plan before acting. Create a
fresh continuation directory under `SKILL.md`'s path rules; never rewrite historical
reports, evidence, or helpers. Back-link both sources and pin the current consumed
source revision. Carry forward applicable user overrides and retained-state facts.

## Choose and validate the continuation

Honor the user's explicit scenario selection. Otherwise select previous `failed`,
`blocked`, and `unverified` scenarios plus dependents that consumed the fixed behavior.
Explain any affected dependents excluded by the requested scope; do not silently
claim their regressions were checked. Expand to the entire plan only when impact or
the user requires it. A subset never waives shared prerequisites or safety gates.

Re-derive only mechanics invalidated by changed code, environment, or evidence. Keep
unchanged business expectations pinned to their approved authority, recording any
approved expectation changes separately. Resolve never-executed dependents under
[FIRST-RUN.md](FIRST-RUN.md); preserve existing safety edges and legacy facts.

Prove the fix is loaded in the actual command/process before judging it. Use the
expected version, loaded source/build identity, or a discriminating behavioral
fingerprint; reachability alone does not prove freshness. Reuse prior metadata only
when it still describes the effective target.

Read retained identifiers, ownership, TTL, cleanup commands, and do-not-clean items
before creating or reusing fixtures. Read [EXECUTION.md](EXECUTION.md) for any writes,
async/dependent work, or retained-state cleanup. A previous failure becomes passed
only with this run's fresh outcome and retained proof. Record the new disposition
and evidence here while preserving the original verdict.

## Authorized repair loops

This skill supplies execution and diagnosis; the calling agent owns separately
authorized product fixes. For an explicit iterate-until-green request, retain each
iteration's report as an immutable handoff. Continue from actionable defects and
affected dependents; stop when no actionable defects remain, an external decision
blocks progress, or the user's cap is reached (default eight full E2E rerun cycles).
Report skipped/unverified/blocked work even when no actionable fix remains.
