# Perspective Scan — Consensus guard, second independent falsification

Date: 2026-06-19
Runner: fresh-context general-purpose subagent (separate context from the change author),
mandate "break the guard, do not confirm it."
Target: the single guard sentence added after the first falsification pass —
"Before claiming consensus, name the strongest position that would oppose it; if no chosen
role holds that position, the agreement may be an artifact of homogeneous role selection —
add a role that holds it before trusting the finding."

## Attack result — the guard was partially broken

The subagent ran the scan on three convergent questions (RAG vs fine-tuning, REST vs queues,
pair programming) and attacked four vectors:

| Vector | Result | Defect |
|---|---|---|
| 1. Strawman opposition | DEFEATED | "strongest" was unenforceable; a model can name a weak opposition, call it strongest, dismiss it, and launder consensus within the rule's letter. |
| 2. False attribution | HELD (weakly) | Re-attributing the opposing position to an already-chosen role is caught only when role stances were written specifically; vague stances let it slide. |
| 3. Order-of-reading bypass | DEFEATED | The guard sat AFTER the `no direct conflict` allowance. A model writes `no direct conflict` at that step and stops, never reaching the guard. |
| 4. Role-bloat regression | Real (introduced by the guard) | No exit for a genuinely uncontested finding; the guard pushes toward inventing a junk opposing role. |

## Fix applied (REFERENCE.md Perspective Scan, contradiction-map paragraph)

Rewrote the no-conflict branch so the guard is a precondition, not a trailing afterthought:

- **Placement (Vector 3):** "do not record consensus yet — first name the strongest opposing
  position ...". The `no direct conflict` permission now appears only at the end, after the
  check, so a top-to-bottom reader cannot record consensus before running the guard.
- **Anti-strawman (Vector 1):** "the strongest opposing position actually held by a substantial
  expert community (a strawman you can dismiss does not count)."
- **Exit clause (Vector 4):** "Only once a chosen role covers that opposition, or no credible
  opposition exists, record `no direct conflict` ..." — uncontested findings no longer force a
  role.

Vector 2 (vague-stance false attribution) is mitigated by the existing Output requirement that
each role state a specific position with a source receipt or `unsupported`; not separately
re-worded.

## Contract protection

Added `test_consensus_guard_precedes_the_no_conflict_allowance`:
- `assertLess(index("strongest opposing position"), index("no direct conflict"))` — locks the
  placement that Vector 3 exploited. Mutation-checked: moving the consensus write before the
  guard flips the assertion to False (test goes red), so the check is non-vacuous.
- `assertIn("substantial expert community")` — locks the anti-strawman anchor.
- `assertIn("no credible opposition")` — locks the uncontested-finding exit.

Suite: 34 tests OK. SKILL.md = 100 lines. `no direct conflict` still single-sourced (count 1).

## Third independent pass — re-attack of the rewrite

Runner: a second fresh-context general-purpose subagent, same break-it mandate, given the
rewritten contradiction-map rule. Cases: intermittent fasting (homogeneous-role trap),
central-bank asset-price targeting (false-attribution trap), "does the atmosphere contain
oxygen" (genuine-consensus / over-correction test).

Result on the three fixes from the second pass:

| Vector | Result | Note |
|---|---|---|
| 1. Order/early-termination | HELD strongly | "do not record consensus yet — first name…" forced the check before any consensus write. |
| 2. Strawman | HELD (marginal) | "substantial expert community" blocked caricatures; "substantial" stays good-faith calibrated. |
| 4. Exit-clause abuse | HELD on prominent oppositions | Softer when the real opposition is obscure; mitigated because the naming step runs before the exit. |
| 5. Over-correction | HELD cleanly | Genuine consensus (oxygen) recorded as `no direct conflict` with no junk role and no manufactured dispute. |
| 3. False attribution | DEFEATED (partial) | "if a chosen role already holds that position" had no test for "holds"; a descriptive/historical role stance was conflated with prescriptive advocacy to skip adding a role. |

This is the residual the author had explicitly declined to re-word after the second pass
(betting the per-role "specific position + receipt" requirement covered it). The independent
pass showed that bet was wrong: receipts do not stop descriptive→prescriptive conflation.

Fix applied (single highest-value change the pass recommended): define "holds" in REFERENCE.md —
"A role counts as holding that position only if its stated stance prescribes it, not merely
describes or borders it." Contract-locked by `assertIn("not merely describes or borders")` in
the guard test. Vectors 2 and 4 left as known good-faith residuals rather than gold-plated, to
avoid reference-section sprawl.

Suite after fix: 34 tests OK. SKILL.md = 100 lines. `no direct conflict` single-sourced.
Placement invariant still holds.

## Disposition

Three independent passes now exist. The first two found genuine author-blind defects (homogeneous
-role laundering; then placement/strawman/exit). The third confirmed those fixes HELD under fresh
attack and surfaced one remaining gap (false attribution), now fixed and contract-locked. Each
named defect was independently demonstrated before being fixed, satisfying the AGENTS.md
high-stakes independent-falsification requirement. The latest fix (the "holds" definition) is
validated-by-construction against a demonstrated failure plus contract-protected; marginal gain of
a fourth pass is low — the surviving residuals (calibration of "substantial", obscure-opposition
exit) are good-faith judgment calls, not mechanical bypasses.
