# AGENTS.md for asdf-skills

This repository contains portable agent skills under `skills/`.

## Skill Evolution

When adding or changing skill rules, apply the Rule Harvest Gate:

- Promote a rule only when it addresses a repeated correction, observed failure mode, or explicit user-approved invariant.
- Check whether existing skill instructions or tests already cover the behavior.
- Add each rule at the narrowest applicable level; prefer one shared maintenance rule over duplicating runtime guidance in every `SKILL.md`.
- Protect load-bearing rules with a small example, stdlib test, or contract check when practical.
- Keep skills portable across agent runtimes: standard Markdown instructions and stdlib-only helper scripts; do not add runtime-specific workflow scripts, external dependencies, or broad checklists to core skills unless the user explicitly asks.
- Keep installed runtime copies of a shared source skill byte-identical with their source skill; put personal divergence in a local override skill instead of editing managed copies.

Keep `SKILL.md` files concise and task-facing. Put maintenance guidance here instead of loading it during normal skill use.

## Skill Evolution Loop

When the user asks to improve a skill, treat it as an evidence loop rather than a wording edit:

Before changing any skill, load and apply `write-a-skill` as the authoring frame for structure, progressive disclosure, bundled resources, and review checklist. If `write-a-skill` is unavailable, record the fallback in the round notes before editing.

1. Capture a baseline output from the existing skill on a real task or fixture.
2. Name the observed failure mode and the candidate Leitwoerter or rule that should change behavior.
3. Apply the narrowest edit: catalog/routing text, reference rule, script logic, or focused test.
4. Re-run the same real task, plus at least one second sample when generalization risk is meaningful.
5. Score the output with an explicit quality rubric and compare delta against the baseline.
6. Iterate on the lowest-scoring dimension until the marginal gain is low or a hard gate fails.

Use hard gates before scoring: baseline output exists, real validation artifact is present, no unresolved correctness/safety/privacy regression exists, `SKILL.md` does not become a maintenance manual, runtime portability is preserved, the full evidence path is recoverable, and the edit is the narrowest effective change. Store temporary comparison outputs outside the skill folder unless they are durable examples or tests.

Use this v3.2 100-point quality rubric unless the task supplies a stricter one:

| Dimension | Points | Check |
|---|---:|---|
| Outcome Delta | 30 | Real task output is materially better than the baseline. |
| Behavioral Reliability | 20 | The skill more consistently drives the intended workflow and avoids wrong paths; Leitwoerter are a mechanism, not a required goal. |
| Validation & Regression Safety | 20 | The same task and meaningful generalization samples pass, and regressions are found and fixed. |
| Skill Design Quality | 15 | The change follows `write-a-skill`: concise `SKILL.md`, progressive disclosure, appropriate references/scripts, and no rule dumping. |
| Evidence Traceability | 10 | Baseline, commands, samples, output artifacts, and failure reasons remain recoverable. |
| Cost & Noise Control | 5 | Low-value noise, duplication, token cost, and maintenance cost are reduced or kept bounded. |

Use these anchors inside each dimension: 0% = no evidence or failure; 40% = local improvement that is not stable; 70% = clear real-task improvement with small regression or weak generalization; 90% = stable multi-sample improvement with low regression risk; 100% = reusable mechanism and low remaining marginal gain.

Accept only when all accept gates pass: total score is at least 90/100, Outcome Delta is at least 22/30, Validation & Regression Safety is at least 16/20, Skill Design Quality is at least 10/15, and candidate score improves over baseline by at least 5 points unless fixing a hard failure. Scores from a single validation sample are capped at 85 when generalization risk exists. Reject immediately if an observed regression remains unresolved. Scores from 80-89 may be accepted only when marginal gain is low and all hard gates pass; 70-79 means continue; below 70 means reject or rethink the mechanism.

Record each evolution round in this compact format, in chat or a temporary artifact unless the user asks for durable docs:

```md
## Round N

Baseline score: xx/100
Candidate score: xx/100
Delta: +x
Score cap: none / reason

Dimension scores:
- Outcome Delta:
- Behavioral Reliability:
- Validation & Regression Safety:
- Skill Design Quality:
- Evidence Traceability:
- Cost & Noise Control:

Task sample:
- project:
- command:
- output artifact:

Wins:
- ...

Regressions:
- ...

Lowest-scoring dimension:
- ...

Decision:
- continue / accept / reject
```
