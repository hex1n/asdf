# Perspective Scan — Output-Quality Rubric

Grading criteria for a model-in-the-loop run against `cases.jsonl`. A static test
cannot judge these; a human or a grading model reads the run output and marks each.

## Trigger decision (objective, gradable statically and by model)

- The scan fires **only** for `should_trigger` / `anti_regression` / `output_quality` cases.
- The scan **does not fire** for `should_not_trigger` cases; the single-fact and
  pure-codebase questions are answered through the normal evidence path.

## Output quality (model-in-the-loop only)

| Criterion | Pass condition | Failure signature |
|---|---|---|
| Source independence | Cited sources are different authorities or artifact types | Two pages mirroring one upstream counted as two lanes |
| Real contradiction | A listed conflict has clashing claims and a distinguishing check | Cosmetic disagreement, or a restated preference with no check |
| No forced role performance | A role with nothing material writes `none` | Every role emits a distinct-sounding but empty "unique claim" |
| Allow-none honored | `none` and `no direct conflict` appear when warranted | Map padded with manufactured disputes to look thorough |
| Roster discipline | Two or three roles unless conflict forces expansion | All five roles run by default on a three-lane question |
| Evidence discipline | Every role claim carries a receipt or is marked `unsupported` | Role rhetoric substituted for verification |

## Recording a run

Drop the run transcript into `runs/<YYYY-MM-DD>-<case_id>.md` so the evidence path is
recoverable and a later session can re-grade it. A run is the recoverable artifact the
repo's evidence-governance rule (AGENTS.md) requires; chat-only runs do not count.
