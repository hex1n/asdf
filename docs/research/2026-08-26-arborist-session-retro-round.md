# Arborist Evolution — Session-Retro Round

Date: 2026-08-26

## Round 2

Supersedes: none (extends the 2026-08-25 net-new round)
Improvement magnitude: clear (every edit traces to an observed failure in the sample)
Generalization confidence: low (single sample; validation pending, see below)
Hard gates: pass (`node scripts/check-all.mjs` green before and after each edit batch)
High-stakes escalation: not needed
Relative delta: not scored (trend baseline is the 2026-08-25 spec)

Task sample:

- project: business repo `Desktop/11111-salesfundmp` (ISSUE-003 cost-parity batch 2)
- command: `/arborist` invoked manually at session start; session id
  `176ed97c-05c5-4c97-9e72-8e5bb1b3d7c6`
- baseline artifact: that session's transcript (2h13m implementation + Codex
  r6/r7 reviews)
- candidate artifact: `skills/arborist/SKILL.md` (210 → ~239 lines)
- validation artifact / diff: repo gate green; behavioral validation pending

## Observed failure modes (from the sample)

1. **Escape hatch was load-bearing.** Step 4 completion allowed "explicit
   unverified risk" for Conserved Set items, so naming a gap discharged the
   skill's core obligation. The skill was not violated; it approved the failure.
2. **Silent oracle swap.** "A daily-cost assertion that can go red" degraded in
   memory to "I read the code and it looks unchanged"; alignment work used the
   artifact's own former behavior as its oracle ("no longer the fixed 1").
   The existing oracle rule had no completion criterion attached.
3. **Skill executed zero of its own artifacts.** Injected once at session
   start; no Impact Ledger, Conserved Set list, or pre-registered proof list
   ever existed. Behaviors resembling arborist traced to AGENTS.md rules and
   the ponytail hook (re-asserted every turn) instead.
4. **Trigger predicate unevaluable at trigger time.** "Where behavior crosses
   modules/state/…" is a property of the code, known only after reading it —
   after skill selection has already happened. Zero literal user trigger words;
   "按文档落地" (the authority-conflict-densest form) was outside the trigger
   surface entirely.
5. **Design-doc dual role.** The doc's factual claims about current behavior
   (invariant 5) were treated as authority; one was wrong. Four departures from
   the doc were shipped as "disclosed deviations" — exactly the "justified
   departure" the NEEDS-DECISION rule forbids.

## Edits landed (all in `skills/arborist/SKILL.md`, uncommitted as of this note)

- description: evaluable-at-a-glance predicate ("code that already has users,
  stored data, or tests"), literal zh/en trigger words, cheap-misfire note.
- Step 1: design docs mix authority with second-hand implementation evidence;
  re-verify factual claims.
- Step 4: oracle must be independent of the artifact under test; Conserved Set
  checks written first (no intrinsic pull); items close only on a red-capable
  check or `NEEDS-DECISION` — self-written gap notes are not a disposition.
- Step 4: pre-registration written to an untracked scratch file
  (`.scratch/<task>/proofs.md`), one line per item with oracle and check;
  Step 6 reopens and closes against it item by item.
- Step 6: residual risk covers environment-blocked checks only, not checks
  chosen not to be written.

## Pending validation (the reason confidence stays low)

The pre-registration-file rule rests on two claims:

- **Backed:** a proof plan held only in memory gets silently revised
  (observed, failure mode 2). The file makes Step 4 falsifiable and gives
  Step 6 a non-vacuous closure object.
- **Unvalidated hypothesis:** the working-tree file re-anchors attention
  mid-task. Deliberately kept out of the skill text.

Validate on the next real arborist run by post-hoc transcript inspection —
**do not tell the running session it is being observed** (observer effect;
same rationale as `skill-ab-trial`). Two signals:

1. proofs file created before the first line of production code;
2. Step 6 actually reopened it — observable from the file itself: Step 6's
   completion requires every line to carry a closing disposition, so an
   unannotated file is a failed signal without reading the transcript.

Both signals absent → the file requirement is sediment; revert it. One
present → keep, note which claim it supports.

Closed 2026-09-03: both signals observed in the audit of every local arborist
run (Codex 13/13 and Claude 5/5 wrote the file before the first production
edit; closing dispositions were appended in about 26 of 37 archived files).
The file requirement stays. The audit's other findings feed the 2026-09-03
improvement round (header, reader brief, Step 0 completion).
