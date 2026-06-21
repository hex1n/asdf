# Perspective Scan — Round-2 model-in-the-loop validation

Date: 2026-06-19
Skill under test: skills/deep-research/REFERENCE.md @ working tree (round-2 wording:
allow-`none`, `no direct conflict`, two-or-three-role roster)
Runner/grader: Claude (Opus 4.8) — **author + runner + grader; NOT independent context.**
See Independence caveat at the end.

Purpose: validate the round-2 changes (anti-regression allowances + roster discipline),
not the round-1 gate routing.

## Case 5 — anti_regression — ">80% coverage as a hard CI gate worth it?" → trigger

Roles run (2-3, not 5): Practitioner, Academic, Skeptic.

- Practitioner: 80% baseline acceptable; hard enforcement breeds bad tests. Evidence:
  Atlassian, stouf/Medium. Unique: tests get "tightly coupled to implementation details".
- Academic: no consensus; ETH Zurich found 80% threshold "not that promising"; favor
  context-aware policy. Evidence: arxiv 2502.17378, arxiv 1712.05078. Unique: `none`.
- Skeptic: coverage measures the wrong thing; critical paths uncovered at 80%. Evidence:
  testim.io, codecov. Unique: `none` (same direction as Academic, not independent).

Contradiction map: `no direct conflict` — stances converge (80% is a weak signal; quality
beats threshold). Recorded as a high-confidence finding, not a manufactured dispute.

Grade vs RUBRIC:
- allow-none honored: PASS — `none` emerged twice, genuinely (not padded).
- no direct conflict honored: PASS — agreement recorded, not faked into a dispute.
- roster discipline: PASS — 3 roles.
- Known weakness: topic was author-chosen with known convergence; proves allow-none fires
  under convergence, NOT that an empty role stays `none` under a high-conflict topic.
  That second property is tested by Case 6's roster restraint.

## Case 6 — output_quality — "Is Kubernetes dominance durable over 3 years?" → trigger

Roles run (3): Practitioner, Skeptic, Historian.

- Practitioner: complex/stateful stays on K8s; hybrid future. Evidence: signoz, cycle.io.
- Skeptic: cracks widening. Evidence: 68% of DevOps teams struggle (learning curve);
  Lambda 40% of serverless; Wasm cuts edge overhead 50%. Unique: greenfield bypassing K8s.
- Historian: incumbent decay is slow (Linux/x86 analogy). Evidence: `unsupported` — analogy
  marked, not dressed as data. Unique: incumbency inertia != technical superiority.

Contradiction map: real conflict — Skeptic (erosion) vs Historian/Practitioner (incumbency).
Distinguishing check: does serverless/Wasm growth appear in NEW greenfield selection, or only
at the edge? → fed back as a lane target.

Grade vs RUBRIC:
- source independence: PASS — Skeptic uses three distinct artifact types; Historian analogy
  marked `unsupported`.
- real contradiction: PASS — clashing claims + a usable distinguishing check.
- no forced role performance: PASS — Incentive Analyst withheld under 2-3 discipline though it
  had a material angle (AWS serverless lock-in); roster stayed at 3.
- evidence discipline: PASS — every role claim sourced or marked unsupported.

## Case 3 — no_trigger — Spring REQUIRES_NEW rollback behavior

Decision: NO scan. Skip clause hit: "single factual answer". Answered from official
docs/source. PASS (gate held; round-1 behavior unchanged).

## Case 4 — no_trigger — OrderService.create() timeout

Decision: NO scan. Skip clause hit: "pure Codebase Investigation". Routed to evidence lanes +
hypothesis tournament. PASS (gate held; round-1 behavior unchanged).

## Verdict

Round-2 changes do what they claim: allow-`none` and `no direct conflict` fire on real
convergent evidence without padding; roster stays at 2-3 and withholds a 4th role that had a
real angle; no-trigger gates hold. One real weakness in the EVAL DESIGN (not the skill): the
anti-regression case is a self-chosen convergent topic.

## Independence caveat

This run was produced and graded by the same agent that authored the change. Per AGENTS.md, an
author's own pass is NOT the independent falsification. To close that, a fresh-context agent
should run at least Case 5 and Case 6 from the prompt alone and a separate reviewer should grade
the transcript against RUBRIC.md. Until then the output-quality layer stays `accept provisional`.
