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
5. Decide with the two-layer gate below; do not score the edit on an absolute point scale.
6. Iterate on the weakest failing gate or the lowest-confidence claim until the marginal gain is low or a hard gate fails.

### Why there is no point score

The decision has three outcomes — accept, continue, or reject — so it carries only about one and a half bits. A 100-point scale invents far more resolution than the decision can hold, and because the author is the grader, that surplus precision becomes a place for optimism bias to hide rather than a measure of quality. The honest design replaces measurement with falsifiable gates plus one directional judgment, so the decision matches the evidence you can actually produce.

### Layer 1 — hard gates (binary; all must pass or the edit is rejected)

- A baseline output exists and a real validation artifact is present.
- No unresolved correctness, safety, or privacy regression remains.
- `SKILL.md` stays task-facing and does not become a maintenance manual.
- Runtime portability is preserved.
- The full evidence path is recoverable.
- The edit is the narrowest effective change.
- Store temporary comparison outputs outside the skill folder unless they are durable examples or tests.

Any failing hard gate means reject or continue; never trade a failed gate against a strong judgment elsewhere.

### Layer 2 — decision by improvement and confidence (judged from real output, not scored)

Read the real task output against the baseline and place the edit on two axes:

- Improvement magnitude: none / marginal / clear / large.
- Generalization confidence: low for a single sample, high for two or more diverse samples that pass.

Then apply the decision rule:

- Clear or large improvement with high confidence: accept.
- Clear improvement with low confidence: run a second diverse sample before accepting; never accept generalization on a single sample.
- Marginal improvement: accept only when it fixes a real reported failure or removes real cost or noise; otherwise reject as not worth the maintenance.
- No improvement, or any regression: reject.

State the magnitude as a falsifiable claim tied to the output diff, so a reviewer can challenge it with "show the output that makes it clear" rather than argue about a number.

### High-stakes escalation (adversarial falsification)

When the edit touches a load-bearing rule, has broad blast radius, or sits on a marginal accept/reject line, do not add scoring resolution — add an independent falsification pass. In a fresh context, try to show the edit is not better or introduces a regression. Because the author is the grader, this adversarial falsification is the only structural check on self-bias; accept only when the attempt to break the claim fails.

### Optional trend log

If you want a number to track rounds, log a relative delta only: per criterion, mark the candidate against the baseline as minus, zero, or plus, and sum the signs. This relative delta is a trend signal for the round notes, never an accept gate, and never an absolute score.

Record each evolution round in this compact format, in chat or a temporary artifact unless the user asks for durable docs:

```md
## Round N

Improvement magnitude: none / marginal / clear / large
Generalization confidence: low / high
Hard gates: pass / fail (name any failing gate)
High-stakes escalation: not needed / adversarial falsification result
Relative delta: +x / 0 / -x (trend only)

Task sample:
- project:
- command:
- output artifact:

Wins:
- ...

Regressions:
- ...

Weakest gate or lowest-confidence claim:
- ...

Decision:
- continue / accept / reject
```
