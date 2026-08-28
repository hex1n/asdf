# Trial: Perspective-Based Reading for plan-review reviewers

> The skill reviewed here has since been renamed `plan-review` → `assayer`
> (`skills/assayer/`). This record keeps the name it was run under.

Pre-registration, bench (two seeded-defect plans + held-out keys), the 16 run
directories, judge packets and cost telemetry lived in the session scratchpad.
The arbitration record is beside this file:
`2026-08-28-plan-review-pbr-ab-trial-arbitration.md`.

Candidate (verbatim from `skills/plan-review/SKILL.md`, Exact Gate): each
required reviewer reads from one frozen perspective with a scenario, walks the
candidate as that person first, then runs the full-rubric pass; perspectives
across reviewers must cover every rubric dimension; perspective never narrows
what a reviewer must report.

Claimed outcome: larger union of confirmed findings across two reviewers and
lower overlap between them, without more unsupported findings.

Design: 2 tasks (A billing late-fee tiers + backfill; B sliding-window rate
limit + tenant rollout) × 2 arms × 2 replications = 8 review rounds, each with
two reviewers in isolated directories → 16 reviewer runs. Treatment R1 =
implementer, R2 = operator on call. Control R1 = R2 = identical prompt. Runner
and judges: the session model (Opus). Every run has a process log; all 16
completed; no run touched anything outside its directory.

## Oracle (held out) — SATURATED

10 seeded defects per task, keyed by section + pattern.

| Run | R1 recall | R2 recall | Union | Overlap (Jaccard, seeded) |
|---|---|---|---|---|
| A-treat-1 | 10/10 | 10/10 | 10/10 | 1.00 |
| A-treat-2 | 10/10 | 10/10 | 10/10 | 1.00 |
| A-ctl-1 | 10/10* | 10/10 | 10/10 | 1.00 |
| A-ctl-2 | 10/10 | 10/10 | 10/10 | 1.00 |
| B-treat-1 | 10/10 | 10/10 | 10/10 | 1.00 |
| B-treat-2 | 10/10 | 10/10 | 10/10 | 1.00 |
| B-ctl-1 | 10/10 | 10/10 | 10/10 | 1.00 |
| B-ctl-2 | 10/10 | 10/10 | 10/10 | 1.00 |

\* regex scored 9/10; arbitration matched the missing one (A6, "drops … and
then reads … cannot be executed").

Every reviewer in every arm found every seeded defect. The oracle layer
decides nothing about the candidate; it does establish that the runner model
saturates a 10-defect plan of this size regardless of prompt, so the
discriminating signal is in the unseeded findings and the judge layer.

## Arbitrated findings (unmatched → seeded / real / unsupported)

43 unmatched findings read against PLAN.md (`arbitration.md`). Real defects the
key did not seed: 5 in Task A, 7 in Task B (e.g. A: V-2's cap test describes an
arithmetically unreachable case; the insert/update pair is non-atomic and a
rerun cannot repair it; R-3's reversal ignores payments made after the fee.
B: M-4 deletes the only rollback target; the admission script returns only
admit/reject while D-4 needs `oldest_score`; V-1 asserts only an upper bound,
so a reject-everything limiter passes).

| Run | Real total (10 seeded + unseeded) | Unsupported |
|---|---|---|
| A-treat-1 | 14 | 2 |
| A-treat-2 | 12 | 1 |
| A-ctl-1 | 13 | 0 |
| A-ctl-2 | 15 | 0 |
| B-treat-1 | 16 | 0 |
| B-treat-2 | 14 | 0 |
| B-ctl-1 | 14 | 0 |
| B-ctl-2 | 12 | 0 |

Treatment mean 14.0 vs control 13.5; per task the direction flips (A: 13.0 vs
14.0; B: 15.0 vs 13.0). Unsupported findings: treatment 3, control 0.

Overlap over all real defects (Jaccard R1∩R2): treatment mean 0.85, control
0.82. **The candidate's mechanism — perspectives diversify what two reviewers
find — did not appear.** Both reviewers in both arms found the same core set;
the small differences are in the tail and are not smaller in treatment.

## Blind ranking (1 = best; two independent judges per task, told nothing about arms)

Task A (P1=A-treat-2, P2=A-ctl-2, P3=A-treat-1, P4=A-ctl-1):

| Judge | completeness | precision | actionability |
|---|---|---|---|
| A#1 | treat-2 1, treat-1 2, ctl-2 3, ctl-1 4 | ctl-2 1, ctl-1 2, treat-2 3, treat-1 4 | treat-2 1, ctl-2 2, ctl-1 3, treat-1 4 |
| A#2 | treat-2 1, treat-1 2, ctl-2 3, ctl-1 4 | ctl-2 1, ctl-1 2, treat-1 3, treat-2 4 | treat-1 1, treat-2 2, ctl-1 3, ctl-2 4 |

Task B (P1=B-ctl-2, P2=B-treat-1, P3=B-ctl-1, P4=B-treat-2):

| Judge | completeness | precision | actionability |
|---|---|---|---|
| B#1 | treat-1 1, treat-2 2, ctl-1 3, ctl-2 4 | ctl-2 1, ctl-1 2, treat-2 3, treat-1 4 | treat-1 1, treat-2 2, ctl-1 3, ctl-2 4 |
| B#2 | treat-1 1, treat-2 2, ctl-1 3, ctl-2 4 | ctl-2 1, ctl-1 2, treat-1 3, treat-2 4 | ctl-2 1, treat-2 2, ctl-1 3, treat-1 4 |

Agreement across all four judges (arm ranks, 1 = best):

| Dimension | treatment ranks | control ranks | agreement |
|---|---|---|---|
| completeness | {1,2} in 4/4 judges | {3,4} in 4/4 | unanimous |
| precision | {3,4} in 4/4 judges | {1,2} in 4/4 | unanimous |
| actionability | {1,2} in 2/4; {1,4}, {2,4} otherwise | — | split |

Judges A#2 and B#2 also flagged unsupported findings inside *control* reports
that the regex had matched to seeded defects (A-ctl-1 R2 F13 asserts zero-fee
rows as fact; F2 infers status transitions [C] does not state), so the
arbitration table's "unsupported: treatment 3, control 0" counts only
regex-unmatched findings; on the judges' full reading both arms carry a few,
with treatment carrying more root-cause splits.

## Arbitrated judge claims (claim → probe → result)

- "D-2 returns only admit/reject but D-4 needs oldest_score" (B#1, B#2) →
  grep all eight Task B reports for the gap wording → real; reported by
  treat-1 R1+R2, treat-2 R1, ctl-1 R1. Added as U-B7. My regex had absorbed it
  into seeded B3.
- "Clock-source findings are precision-grade, not should-fix" (B#1, B#2) →
  PLAN.md names no clock; the plan as written is per-node so cross-node skew
  presupposes the D-3 fix → downgraded from real-minor to borderline; reported
  in both arms, so it moves no verdict.
- "P4/REVIEWER_X F14 flag-absent/config-unreachable rests on unstated facts"
  (B#1, B#2) → the finding's core is the 10-minute cache lag (seeded B6); the
  unreachable-service clause is an unsupported rider → treatment run B-treat-2
  R1 carries one unsupported clause; arm precision count unchanged in
  direction.
- "Index built outside the maintenance window" (A#1: real feasibility point,
  found by A-ctl-2 R2 and A-treat-1 R1) → PLAN.md states the window and row
  count but not the engine or lock behaviour; four reviewers explicitly
  excluded it as needing an unstated fact → borderline; found in both arms.
- "Flag cannot stop a run in progress" (A#1: unsupported, A-treat-2 R2 F12 and
  A-treat-1 R2 F17) → [C-5] says only that the flag prevents starting →
  unsupported, consistent with my arbitration of A-treat-1 R2 F17.
- "P3/REVIEWER_X (A-treat-1 R1) F4/F5 split one D-3 root cause; P3/REVIEWER_Y
  merges A-3 and C-2 into one finding" (A#1) → read both files → confirmed;
  this is the splitting the precision dimension penalises, and it appears in
  treatment more than control (treatment mean 16.0 findings/reviewer vs 13.9
  for the same real-defect yield).

## Adherence

Treatment (all 8 logs): an explicit perspective walk precedes the full-rubric
pass, e.g. A-treat-1 R1 steps 3–5 "Implementer walk of [D] … Implementer walk
of [M] … Full-rubric pass over the remaining sections"; B-treat-2 R1 steps 3–5
"Implementer walk of [D-1]..[D-8] … Implementer walk of [M-1]..[M-4] …
Full-rubric pass over [G], [R], [V], [S]"; A-treat-1 R2 log header
"perspective: operator on call" with a walk of the three consumers and [R].
Control (all 8 logs): no perspective vocabulary, no role-play, no walk-through
framing; every log goes SPEC → PLAN → dimension-by-dimension pass. No run void.

## Cost (runner telemetry; n = 8 per arm)

| Arm | tokens | tool uses | wall s | findings written |
|---|---|---|---|---|
| treatment | 58,617 | 5.9 | 322 | 16.0 |
| control | 54,840 | 6.1 | 287 | 13.9 |
| ratio | 1.07 | 0.96 | 1.12 | 1.15 |

Treatment writes 15% more findings and spends 7% more tokens / 12% more wall
time for a real-defect yield that is within noise of control (14.0 vs 13.5),
so the extra volume is mostly root-cause splitting and unsupported riders —
exactly what the judges' precision rankings penalise.

## Directional hypotheses (bench scale — direction, not statistics)

1. On plans of this size, the runner saturates the seeded defects with or
   without a perspective; the candidate cannot show a recall effect here.
2. Perspectives do not reduce overlap between two reviewers (0.85 vs 0.82); the
   claimed diversification mechanism is not observed.
3. Perspectives shift the *shape* of the report: judges consistently see the
   treatment pair as more complete and less precise. The completeness signal is
   concentrated in verification/rollout tail findings from the operator
   perspective (U-B5, U-B6, U-A4 appear in treatment more), the precision cost
   in root-cause splitting and a few unsupported operational riders.
4. Net: at ~7% token cost the candidate trades a little precision for a little
   tail completeness, with no recall or overlap gain. As a rule that fires on
   every plan-review it does not earn its place on this evidence; if kept, the
   narrower form is "give the *operator on call* perspective to one reviewer
   at full depth", since that is where the completeness tail came from.

## Threats to validity

- Replication: 2 rounds per arm per task. Direction only.
- One runner model; a weaker model might not saturate and might show a recall
  effect the candidate claims.
- Oracle saturation: the bench's 10 seeded defects were too findable for this
  runner. The judge layer carried the verdict; all four judges, blind and
  independent, agreed on the completeness/precision split across both tasks,
  which is the shape a real (if small) effect would leave rather than noise.
- Author bias: the plans and key were written by the same agent that ran the
  trial; the seeded defects may resemble each other in "findability".
  Unseeded real defects (12 across the two tasks) partly offset this.
- Task A has no feasibility-dimension seeded defect; five of six dimensions
  seeded there.
- Two perspectives only (implementer, operator); the candidate lists five.
- Arm vocabulary appeared naturally in findings ("the implementer", "on-call
  operator") and was scrubbed uniformly across all packets before judging;
  4 of 16 files were touched, meaning replaced by neutral synonyms.
- The control bar is outcome-pinned ("exhaustive across six dimensions"), so
  the comparison is process prescription vs outcome prescription.
