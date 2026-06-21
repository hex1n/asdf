# Perspective Scan — Independent falsification pass

Date: 2026-06-19
Runner: fresh-context general-purpose subagent (separate context from the change author).
Mandate: adversarial — try to BREAK the three round-2 allowances, not confirm them.
Cases run: A = REST→Kafka event-driven (high conflict, role-swap); B = >80% coverage CI gate (convergent).

## Result on the three claims under test

- allow-`none`: HELD. Direct text ("a forced unique claim is fabrication, not a finding")
  defused fabrication pressure. Could not force an invented unique claim.
- `no direct conflict`: HELD. Conditional correctly scoped to "the roles do not actually
  conflict"; a `none` in one role's observation row did not bleed into a false map verdict.
- two-or-three roles: HELD. "Expand only when an unresolved conflict survives the first pass"
  mechanically blocked a premature third role on the convergent case.

## Genuine weakness the independent pass surfaced (NOT caught by the author)

The `no direct conflict` -> "high-confidence finding" path has an **unguarded role-selection
dependency**. The skill tells you what to do once you have roles, but never validates that the
chosen roles are actually adversarial. Pick two epistemically homogeneous roles and the scan
produces `no direct conflict`, which the skill then upgrades to "high-confidence finding" — a
single-perspective investigation laundered as two-role consensus.

Proposed fix (from the independent pass): before writing `no direct conflict`, name the
strongest position that would oppose the consensus and state why no chosen role holds it; if it
is strong, add that role rather than declaring high-confidence agreement.

## Disposition

Accepted. Fix applied to REFERENCE.md Perspective Scan (contradiction map guard) and protected
by a contract assertion in tests/test_skill_e2e_contracts.py. This run is the recoverable
independent artifact AGENTS.md requires for the high-stakes escalation.
