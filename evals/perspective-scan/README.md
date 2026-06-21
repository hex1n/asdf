# Perspective Scan Eval Workspace

A recoverable, version-controlled eval harness for the `deep-research` **Perspective Scan**
([skills/deep-research/REFERENCE.md](../../skills/deep-research/REFERENCE.md#perspective-scan)).
It replaces ephemeral chat validation with a labeled fixture set a later session — human or
model — can re-run and falsify.

## Two layers, honestly separated

A static test cannot execute model behavior. So this workspace is graded on two layers, and
the test suite only claims the first:

1. **Contract + fixture wellformedness (static, in `tests/test_skill_e2e_contracts.py`).**
   The trigger gate, the skip clauses, and the anti-regression allowances (`none`,
   `no direct conflict`, two-or-three-role selection) exist and are single-sourced in the
   skill; every case in `cases.jsonl` is wellformed; each `should_not_trigger` case names a
   skip clause that literally exists in the skill. This proves the *contract*, not the output.

2. **Output quality (model-in-the-loop, graded against `RUBRIC.md`).**
   Whether the scan actually fires on the right cases, produces real contradictions, honors
   `none`, and avoids forced role performance. A static regex can never verify this — a model
   run produces the transcript and a human or grading model marks it.

## Files

- `cases.jsonl` — six labeled cases: two should-trigger, two should-not-trigger, one
  anti-regression (allow `none` / `no direct conflict`), one output-quality.
- `RUBRIC.md` — output-quality grading criteria for the model-in-the-loop layer.
- `runs/` — recorded run transcripts (`<YYYY-MM-DD>-<case_id>.md`); this is the recoverable
  artifact the repo's evidence-governance rule requires.

## Running the model-in-the-loop layer

For each case, give a fresh agent the `deep-research` skill plus the case `prompt`, then grade
the transcript against `RUBRIC.md` and the case `checks`. Adversarial intent: try to show the
scan over-fires, performs roles, or manufactures conflict. Save the transcript under `runs/`.

This is the independent falsification pass AGENTS.md requires for high-stakes skill edits; the
author's own re-read does not count.
