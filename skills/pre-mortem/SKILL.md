---
name: pre-mortem
description: Use only when the user explicitly invokes this skill (by name, slash form, or one of the trigger verbs below) on a non-trivial draft strategy, plan, architecture choice, migration approach, bug-fix approach, or code-change plan. Trigger verbs (closed set): pre-mortem, do a pre-mortem on, challenge, harden, falsify, stress-test, find loopholes in, poke holes in, adversarially review, break, attack. Performs bounded adversarial passes to find material loopholes, patch them, and verify the patched strategy. Not for trivial edits, formatting, simple renames, typos, routine implementation, casual "double-check this" requests, or general code review.
---

# Pre-mortem

## Objective

Harden a draft strategy by trying to break it, patching material loopholes, and verifying the patched version.

The goal is not reassurance.
The goal is not a longer answer.
The goal is a strategy that is harder to falsify.

Use calibrated confidence. Do not use absolute confidence for non-trivial claims.

## Triviality early-exit

After loading, first check whether the target is non-trivial: does it have multiple steps, hidden dependencies, edge cases, or nontrivial failure modes? If it is trivial (a typo, a rename, a one-line fix with obvious correctness, a formatting change), exit immediately with one sentence saying so. Do not run a pass on trivial targets.

## Default output behavior

The final response is the merged final state of the strategy after all passes — not a transcript of how you got there. Don't write Pass 1 / Pass 2 / Pass 3 sections; don't restate the loophole list pass by pass; don't duplicate the final strategy at the top and again at the bottom. The category sweep, per-pass attacker work, and analyst trim happen in your head — they're scratch work, not output.

The Final response format below is a maximum structure. Omit any section that is empty: no loopholes found → omit "Material loopholes found" and "Patches made" entirely; just report the strategy, verification, and confidence. Show pass-by-pass detail only if the user explicitly asks for it.

## Inputs

Identify:

- the current strategy or draft plan,
- the intended success condition,
- relevant constraints,
- available evidence,
- missing information that could change the answer.

Handling missing inputs:

- Missing **success condition** → block. Ask the user; do not invent one.
- Missing **strategy or draft** → prefer asking one clarifying question over inventing one. Only construct a provisional strategy if the user declines to provide one or the request is exploratory; label it provisional and stress-test it as written, not a strawman.
- Missing **constraints** → ask one targeted question if the gap is likely to flip the answer; otherwise list it under unknowns.
- Missing **evidence** → mark relevant claims as assumptions or unknowns. Do not fabricate evidence.

## Definitions

A **fact** is supported by user input, inspected code, tests, documentation, command output, or another explicit source.

An **assumption** is plausible but not verified.

An **unknown** is missing information that could materially change the answer.

A **loophole** is a flaw in the strategy.

### Material vs minor (decisive test)

A loophole is **material** if any of the following hold:
- unpatched, the strategy fails the stated success condition on a plausible real input,
- it makes the strategy non-executable, factually wrong, or actively misleading,
- it invalidates the verification (the check does not actually prove the claim).

A loophole is **minor** if the strategy still meets its success condition but is suboptimal, stylistically weaker, or could be cleaner.

When in doubt, tie the call to the success condition: if you can name a concrete input or scenario where the strategy fails the success condition, it is material; otherwise it is minor.

**Examples.**

*Example 1 — material.* Strategy: "Add a NOT NULL column with a default to a 50M-row table via a single ALTER." Loophole: on the chosen DB engine this rewrites the whole table under an exclusive lock, blocking writes for ~10 min during business hours. This is material — there is a concrete scenario (production traffic during the window) where the strategy fails the success condition (deploy without downtime).

*Example 2 — minor.* Same strategy, different loophole: the new column's name uses camelCase while the rest of the table uses snake_case. Real flaw, but the strategy still meets its success condition. Note it under "remaining assumptions / unknowns" or skip; do not run another pass for it.

*Example 3 — material via invalidated verification.* Strategy: "The fix is correct because `pytest tests/auth/` passes." Loophole: the failing path is in `tests/auth/integration/`, which is excluded by a `pytest.ini` marker and never ran. The verification doesn't prove the claim, so the strategy is unverified — treat as material.

A **false alarm** is a suspected issue that becomes invalid after inspection or reasoning.

## Core loop

Run one pass first; run more only if the previous one earned them (see Pass cap).

A pass means: try to break the strategy as it stands, sort what surfaces into material vs. minor (§Definitions), patch the material using the strongest evidence available (§Patch rule, §Verification hierarchy), and decide whether what's left still has cracks worth another pass. Subsequent passes attack the patched whole — patches can introduce new flaws elsewhere or invalidate prior verification, so the question is whether the new whole still meets the success condition, not whether the patch in isolation is fine.

### Three stances: attacker, analyst, engineer

Attacking, classifying, and patching are different mental jobs. Switching stance deliberately is the single highest-leverage technique for finding more material loopholes — adversarial thinking is voice-cued, and reviewer voice produces reviewer-grade findings.

**Attacker.** Imagine how the strategy fails in production. What input breaks it? Which assumption silently doesn't hold? Which race condition surfaces under load? Which class of user does the strategy attract that you didn't intend? Defer "is this material?", "can I patch this?", "do I have evidence?" to the analyst stage — bringing those questions in while attacking censors the candidate before it's named. Borrow the attacker's voice: "this will burn", "this silently corrupts", "this drops on the floor under N concurrent requests".

**Sweep these categories explicitly.** Write a one-line raw candidate per category; skip a category only when the strategy plainly doesn't expose that surface. When in doubt, write the candidate — the cost is one line, the cost of a missing-category miss is much higher. Don't classify materiality yet; you're generating candidates, not findings.

- silent data corruption
- runtime exceptions (including crashes triggered by inputs the strategy didn't name)
- resource amplification under load (throughput, fanout, downstream backpressure)
- selection effects (the strategy attracting the wrong inputs / users / counterparties)
- operational rollback and recovery (including cascading regressions through shared artifacts)
- external/competitive response
- observability and alerting gaps (including instrumentation that breaks under the change — APM hooks, log redaction, trace injection)
- behavior at boundaries the strategy did not name (other systems, other clusters, other tenants, other environments)
- test-infrastructure regressions hidden by the change

Why this is a sweep, not a prime: the model's natural attack pattern is 4–6 confident attacks then stop. Material misses cluster in categories that didn't get touched at all — not in categories that got lighter coverage. Naming a one-line candidate per category surfaces the missing-category problem cheaply. You can drop a candidate in the analyst stage; you cannot drop one you never named.

**Analyst.** Apply the material/minor cut from §Definitions to the attacker's list. Items that don't meet the material bar are noted briefly or dropped — not patched.

**Engineer.** Design the patch (see §Patch rule), including whether to surface a larger alternative.

The stances are **sequential, not iterative**. Once you start classifying, do not loop back to attack mode — re-entering attack mode mid-classification is the recipe for finding fewer attacks, because every new candidate has to survive both filters before it gets named.

The most common failure of this loop is suppressing candidates during the attacker stage because they "feel minor" or "feel out of scope". Once 5–6 confident material items are filed, the sweep tends to stop, and items that were cognitively cheaper to skip — silent corruption, latent runtime exceptions, resource amplification, selection effects, test-mock regressions — get missed entirely, even when they meet the material bar.

### Pass-1 termination branch

A clean pass 1 is a valid result. If pass 1 finds **no material loopholes** and the Stop condition (below) is otherwise met, stop and report the strategy. Do not invent loopholes to justify additional passes. (This is a single instance of the general Stop condition, called out here because it is the most common termination case and the easiest to violate.)

### Pass cap

Run another pass only if the previous pass found material loopholes.

- Default maximum: 3 passes.
- May exceed 3 only if there is **objective new evidence** to use. New evidence means: a command/test/build executed in the current session and its output observed, a file/doc read for the first time in this session, or a fresh user-provided input or artifact revision. Restating, re-summarizing, or re-reasoning over evidence already considered does **not** count.
- Absolute ceiling: **5 passes**, regardless of new evidence.

If a material loophole cannot be patched because critical information is missing, stop and report it as unresolved. Do not pretend closure.

## Additional angles (optional)

If the attacker sweep felt thin, these are further lenses to pull on. Not a separate gate — use them when the sweep didn't surface enough, or to sanity-check from a different framing:

- unverified premises, ambiguous or missing requirements, hidden dependencies, edge cases
- incompatible behavior, incorrect data flow, incomplete execution paths
- circular reasoning, fixes that address symptoms but not causes, changes broader than necessary

For code-related tasks: whether the relevant code path was actually inspected, whether similar existing code contradicts the strategy, whether callers or downstream behavior are affected, whether tests prove the intended behavior (not something nearby), whether the build/lint/type-check/test commands are sufficient.

### Special check: verification that does not prove the claim

This is the highest-leverage check and easiest to miss. Before accepting any verification, ask:

- Does the test exercise the code path the strategy actually changes?
- Does the command output prove the claim, or just prove something nearby?
- Does the inspected file contain the logic in question, or only call it?
- Does the analogy actually apply, or are the cases superficially similar?

If verification does not prove the claim, treat that as a material loophole.

## Patch rule

For each material loophole, patch the strategy. A patch should make four things legible to the reader: what's changing, why that closes the loophole, what evidence supports the call (using §Verification hierarchy; label reasoning-only patches as such), and what stays unverified. If any one of these is already obvious from the surrounding prose, don't restate it.

Default to the minimum patch that closes the loophole — preserve the user's intent.

### Offer a larger alternative when it dominates

When a larger or restructuring patch is **materially superior** to the minimum, present both with a one-line trade-off and let the user choose the scope. The user owns scope decisions; your job is to make the trade-off legible, not pre-decide it.

Material superiority means the larger patch wins on at least one of:

- number of distinct material loopholes it closes simultaneously,
- elimination of a class of failure mode (rather than a single instance),
- significant reduction in ongoing operational or cognitive complexity.

Stylistic preference is not material superiority. "I'd redesign this" is not a trade-off worth surfacing.

Example: minimum patch — add a discount expiration date to checkout copy (closes one ambiguity loophole). Larger patch — replace the 60-day time-based discount with cohort-capped "Founding Customer" pricing (closes the same ambiguity plus procurement-gaming and selection-effect loopholes simultaneously). Present both; the user picks based on whether the GTM frame is mutable.

## Verification hierarchy

Use the strongest available verification.

Prefer, in order:

1. Command output, tests, builds, reproduction results, evals.
2. Direct inspection of code, docs, configs, schemas, or logs.
3. Existing analogous implementation or established documented behavior.
4. Explicit logical reasoning, counterexamples, and constraint checks.

Patch evidence cites this hierarchy. Reasoning-only patches must be labeled as such.

Do not claim a command, test, build, inspection, or check was performed unless it was actually performed.

## Stop condition

Stop when the strategy is concrete enough to execute, no known material loopholes remain under available evidence, every patch has a stated verification basis, and unresolved unknowns are visible to the reader. If a material loophole stays unpatched because the information needed isn't available, name the blocker — don't endorse the strategy.

## Confidence calibration

Use:

- **High**: material loopholes were patched, verification used strong evidence (tier 1 or 2 of the hierarchy), the inspected surface covers the strategy's critical paths, and remaining assumptions are minor.
- **Medium**: strategy is logically coherent and material loopholes are patched, but some important verification is unavailable, or coverage of critical paths is partial.
- **Low**: key assumptions remain unverified, blockers remain, coverage is thin, or the strategy cannot be adequately checked.

Confidence depends on evidence and coverage, not on the number of passes.

### Failure-mode disclosure when confidence is low

If confidence is Low (or blockers remain), the user needs to know what's most likely to break — list 1–3 concrete failure modes naming the input, code path, environment, or assumption that would trip first. Without it, "low confidence" is a label the user can't act on.

## Final response format

Return only the sections that have content. Omit empty sections.

1. **Final strategy**
2. **Material loopholes found** (omit if none)
3. **Patches made** (omit if none)
4. **Verification basis** (always include; cite hierarchy tier)
5. **Remaining assumptions / unknowns** (omit if none)
6. **Likely failure modes** (required if confidence is Low or blockers remain; omit otherwise)
7. **Stop reason**
8. **Confidence**: high / medium / low
