# Review-and-revise

These steps apply only to `review-and-revise`. Keep the shared finding
validation and closing rules in [SKILL.md](SKILL.md#evidence-loop).

## Revise from evidence

Two disciplines govern writing the fix. **Verify before you write**: every
existing-system claim the revision adds or sharpens is checked against its
source — file opened, line cited — before the revision ships; reviewers
falsify your fixes at full invocation cost, and an unverified claim converts
this round's finding into next round's. Write the minimal claim that closes
the finding — asserting a property of the whole component fails where
asserting it only of the members the finding names survives; every word of
scope you add is surface a reviewer can falsify. **Re-derive the wound**: when a finding falsifies
a mechanism the candidate invented, re-derive that section from the authority
sources — the domain record often already holds the answer — rather than
patching the invention; a patched invention is the next round's blocker.

Batch compatible fixes. A focused recheck may close findings but cannot close
the gate. Use it only for edits contained by finding-linked scope; uncertainty
or cross-cutting change requires a complete review. See
[REFERENCE.md](REFERENCE.md#focused-recheck).

For implementation-authorization scope, a revision that materially changes the
frozen BUILD decision's cost, benefit, mechanism, scope, or key assumptions
invalidates that envelope: suspend that authorization gate for a renewed user
or upstream decision. For correctness-only scope, report the changed assumption
and continue technical review while it remains useful and authorized. Ask only
when the technical target itself needs a user decision.

Completion: every finding is validated, owned, and dispositioned; every
existing-system claim the revision adds carries a source verified this round;
a new hashed revision exists or every rebuttal has returned to its reviewer.

## Re-review the revision

Send the complete revised candidate and ledger to this round's reviewers:
mid-loop, when one required reviewer has closed its lane (GO or optional-only
findings) on consecutive revisions while another keeps returning confirmed
defects, run only the still-falsifying lanes; the closing round still sends
the candidate to every required reviewer, and the gate is unchanged. The
final GO must cover the complete current revision. Record, disclose, validate,
and disposition every new finding, then repeat. This closing review returns the
complete set of currently known findings across all severities, grouped by root cause; it
does not stop merely because a non-GO verdict is already justified.

Then apply [Close Or Continue](SKILL.md#5-close-or-continue).
