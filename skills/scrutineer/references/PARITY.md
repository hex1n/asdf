# Alignment and Parity Review

Read this when the request asks one implementation to match another: a
reference implementation, a specification, a migrated system, or an earlier
version. The rest of [SKILL.md](../SKILL.md) still applies; this file adds the
obligations that branch carries.

## Authoritative target

Identify the authoritative target and any explicit exceptions before deriving
checks. An unresolved conflict between that target and a preservation
requirement is a decision item for the user, not an assumed exemption for the
old behavior.

## Obligation ledger

Derive the affected observable outputs from the request and the target
contract, including fields and branches the patch left unchanged. Compare each
against the target for equivalent inputs and state, preserving every semantic
distinction the target makes between values that look alike: an absent value
against a default, an instantaneous quantity against a cumulative one, an
identifier against its display form.

Record each obligation in the report's parity ledger with expected, actual,
and either the deciding evidence or the unresolved gap. One corrected field or
the first finding does not close the remaining obligations.

A pre-existing mismatch that the requested alignment must remove remains an
unmet delivery requirement; report its origin separately from that
obligation, so attribution and delivery status stay distinct.

## Acceptance

On review and on re-review, reconcile the result against all recorded
obligations, including unchanged outputs and remaining gaps, before
recommending acceptance. An acceptance recommendation with an open obligation
is a coverage limit, not a pass.
