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

1. Capture a baseline output from the existing skill on a real task or fixture. For a net-new skill with no prior output, write an expected-behavior spec and use it as the baseline instead; the spec must include the failure modes and negative cases the skill must handle, not just the happy path, so the baseline is not an optimistic softball.
2. Name the observed failure mode and the candidate Leitwoerter or rule that should change behavior.
3. Apply the narrowest edit: catalog/routing text, reference rule, script logic, or focused test.
4. Re-run the same real task, plus at least one second sample when generalization risk is meaningful.
5. Decide with the two-layer gate below; do not score the edit on an absolute point scale.
6. Iterate on the weakest failing gate or the lowest-confidence claim until the marginal gain is low or a hard gate fails.

### Why there is no point score

The decision has three outcomes — accept, continue, or reject — so it carries only about one and a half bits. A 100-point scale invents far more resolution than the decision can hold, and because the author is the grader, that surplus precision becomes a place for optimism bias to hide rather than a measure of quality. The honest design replaces measurement with falsifiable gates plus one directional judgment, so the decision matches the evidence you can actually produce.

### Layer 1 — hard gates (binary; all must pass or the edit is rejected)

- A baseline output exists (or, for a net-new skill, the expected-behavior spec) and a real validation artifact is present.
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
- Clear or large improvement with low confidence: continue — run a second diverse sample before accepting; never accept generalization on a single sample.
- Marginal improvement: accept only when it fixes a real reported failure or removes real cost or noise; otherwise reject as not worth the maintenance.
- No improvement, or any regression: reject.

State the magnitude as a falsifiable claim tied to the output diff, so a reviewer can challenge it with "show the output that makes it clear" rather than argue about a number. Accept does not close the loop: if a later real task shows an accepted edit made things worse, reopen it as a new round and reject or revise.

### High-stakes escalation (adversarial falsification)

Because the author is the grader, every magnitude, confidence, and trigger judgment above is self-assessed, so the trigger for the one structural check on that bias must be mechanical rather than another judgment call. Run an independent falsification pass whenever any of these objective conditions hold — do not add scoring resolution instead:

- The edit changes routing, description, or `name` text that decides when the skill loads.
- The edit changes a skill's runtime behavior in a way a passing sample could mask — script logic, or removing or loosening a rule.
- The edit touches two or more skills, or a shared rule in this file.
- The edit changes a hard gate or the decision rule itself.
- The accept decision rests on a single sample.

In the pass, work in a fresh context and try to show the edit is not better or introduces a regression; accept only when that attempt fails. If the runtime cannot supply an independent context, record that in the round notes and mark the accept provisional until a second reviewer or a later session runs the pass — never treat the author's own re-read as the independent check.

### Optional trend log

If you want a number to track rounds, log a relative delta only: per criterion, mark the candidate against the baseline as minus, zero, or plus, and sum the signs. This relative delta is a trend signal for the round notes, never an accept gate, and never an absolute score.

Record each evolution round in this compact format, in chat or a temporary artifact unless the user asks for durable docs:

```md
## Round N

Supersedes: none / Round M (reopened because ...)
Improvement magnitude: none / marginal / clear / large
Generalization confidence: low / high
Hard gates: pass / fail (name any failing gate)
High-stakes escalation: not needed / adversarial falsification result / provisional (no independent context)
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
- continue / accept / accept provisional / reject
```
