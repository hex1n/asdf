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

### Generalization Gate (no instance leaks)

A skill compresses many cases into reusable text, but every edit is triggered by one case, so the default draft over-fits that case: its field names, enums, tech, and internal process vocabulary leak into the portable body. A self-applied "this is generic" label does not catch it — branded nouns (`Redis`, `RPC`) trip the eye, but domain vocabulary (`team-type`, `play`, `season`) reads generic and ships anyway. The only reliable filter is a second, divergent domain.

Before any example, rule, or referenced term enters a portable body (`SKILL.md`, `REFERENCE.md`, an adapter, or a template):

- Name a second, different-domain instance the same example or rule must also fit, then rewrite it to fit both. Fitting two divergent domains forces the wording generic — "the team-type alias" collapses to "a display-name alias", "+playId, teamType" collapses to "+fieldA, fieldB".
- If you cannot name a real second domain, do not promote the rule to a portable body: mark it provisional and scope it to the single skill at the narrowest level. Never invent a fake second domain just to pass the gate.
- Examples use neutral placeholders (`fieldA`, `{field}`, `ENUM_VALUE`), never identifiers copied from the source project. Every referenced doc or process name must resolve in this repo or be defined inline — no dangling pointers to a source project's internal vocabulary.

This makes the optional "second sample" in the loop below the default for any text claiming cross-project reach, and it applies to ordinary authoring, not only the full evidence loop.

## Skill Evolution Loop

When the user asks to improve a skill, treat it as an evidence loop rather than a wording edit:

Before changing any skill, load and apply `writing-great-skills` as the authoring frame for predictability, information hierarchy, context pointers, leading words, progressive disclosure, and pruning. Load it by reading its file: a user-invoked skill (`disable-model-invocation`) is absent from the model-invocable list but still available, so `unavailable` means it cannot be loaded from disk at all — not merely that it is not auto-invocable. Only when `writing-great-skills` truly cannot be loaded, apply the authoring criteria listed above directly and record the fallback in the round notes before editing.

1. Capture a baseline output from the existing skill on a real task or fixture. For a net-new skill with no prior output, write an expected-behavior spec and use it as the baseline instead; the spec must include success criteria, failure modes, and negative or non-trigger examples, not just the happy path, so the baseline is not an optimistic softball.
2. Name the observed failure mode and the candidate Leitwoerter or rule that should change behavior.
3. Apply the narrowest edit: catalog/routing text, reference rule, script logic, or focused test.
4. Re-run the same real task, plus at least one second sample when generalization risk is meaningful. For branch or scenario claims, choose samples that exercise the branch-specific gates and the protected failure mode; a simple smoke sample can be recorded, but it cannot raise generalization confidence to high. Any example or rule entering a portable body additionally passes the Generalization Gate above.
5. Decide with the two-layer gate below; do not score the edit on an absolute point scale.
6. Iterate on the weakest failing gate or the lowest-confidence claim until the marginal gain is low or a hard gate fails.

### Why there is no point score

The quality decision has three terminal outcomes — accept, continue, or reject — so it carries only about one and a half bits. `Accept provisional` is not a fourth quality rating; it is an evidence status for an otherwise acceptable edit that still lacks independent falsification. A 100-point scale invents far more resolution than the decision can hold, and because the author is the grader, that surplus precision becomes a place for optimism bias to hide rather than a measure of quality. The honest design replaces measurement with falsifiable gates plus one directional judgment, so the decision matches the evidence you can actually produce.

### Layer 1 — hard gates (binary; all must pass or the edit is rejected)

- A baseline output exists (or, for a net-new skill, an expected-behavior spec with success criteria, failure modes, and negative or non-trigger examples) and a real validation artifact is present.
- No unresolved correctness, safety, or privacy regression remains.
- `SKILL.md` stays task-facing and does not become a maintenance manual.
- Runtime portability is preserved, and the Generalization Gate holds: no source-project instance reached a portable body without passing the second-domain check or being marked provisional and scoped to one skill.
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
- The edit changes eval cases, graders, acceptance assertions, eval fixtures, or test logic used in the evidence path for a skill acceptance decision.
- The accept decision rests on a single sample.

In the pass, work in a fresh context and try to show the edit is not better or introduces a regression; accept only when that attempt fails. If the runtime cannot supply an independent context, record that in the round notes and mark the accept as provisional until a second reviewer or a later session runs the pass — never treat the author's own re-read as the independent check.

### Evolving toward a better skill, not just a safe change

The gates above keep an incremental edit from regressing. A *redesign* — a structurally different candidate meant to be better, not merely safe — needs more, because the author's judgment that it wins is the weakest evidence available: author and grader are the same person. Do not accept a redesign on an author-side comparison. Pre-register what "better" means and pick a discriminating probe *before* generating the candidate, then validate with the same independent falsification pass the section above defines (fresh context, or a second reviewer or later session). Expect that pass to usually reject the author-judged "improvement" — the redesign is selected by the same optimism the pass exists to catch — and treat generate-and-independently-falsify mainly as a filter that blocks false improvements, not a reliable source of them. Accept a redesign only on a clear, repeated win from that pass; otherwise keep the current design.

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
- baseline artifact:
- candidate artifact:
- validation artifact / diff:

Expected-behavior spec (net-new only):
- success criteria:
- failure modes / negative or non-trigger examples:

Redesign pre-registration (redesign only):
- "better" definition + discriminating probe (fixed before the candidate):

Wins:
- ...

Regressions:
- ...

Weakest gate or lowest-confidence claim:
- ...

Decision:
- continue / accept / reject
```
