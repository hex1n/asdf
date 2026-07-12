# Plan Review Redesign — Evolution Round

## Round 1

Supersedes: none
Improvement magnitude: clear
Generalization confidence: low
Hard gates: pass for candidate generation; real A/B confidence gate remains
High-stakes escalation: initial NO-GO, two repair rounds, closing GO
Relative delta: positive (trend only)

Task sample:

- project: `asdf-skills`
- baseline artifact: prior `skills/plan-review/SKILL.md` and `REFERENCE.md`
- candidate artifact: current working-tree versions
- validation: `node --test skills/plan-review/tests/*.test.mjs` and
  `node --test scripts/plan-review-eval/eval-infra.test.mjs`

Redesign pre-registration:

- Better means preserving the exact-revision evidence gate, complete per-round
  findings, and parent validation while reducing always-loaded instructions and
  removing mandatory provider token categories.
- Discriminating probes: contract tests, gate counterexamples, source/runtime
  byte identity, and independent attempts to obtain an invalid PASS.

Generalization Gate:

- The same rules must fit a software migration plan and a customer-onboarding
  plan. Portable text uses candidate, revision, finding, evidence, and scope;
  runtime-specific agent names were removed from the portable reference.

Wins:

- `SKILL.md`: 1681 to about 1008 words (about 40% reduction).
- `SKILL.md` + `REFERENCE.md`: 2565 to about 1736 words (about 32% reduction).
- Provider token categories are optional; calls, characters, wall-clock,
  sessions, and retries are required observable cost.
- Round reports now retain complete finding payloads and reconcile them with the
  parent-validation ledger.
- A closing GO containing blocker or should-fix findings fails closed.

Independent findings and dispositions:

- `PR-GATE-001`: confirmed, fixed with a closing-GO defect check and negative test.
- `PR-GATE-002`: confirmed, fixed with complete payload/ledger reconciliation.
- `PR-COST-001`: confirmed, fixed by requiring exact/derived observable fields
  and positive returned-invocation measurements.
- `PR-SCOPE-001`: confirmed, fixed by restoring the default rubric.
- `PR-PORT-001`: challenged as an existing capability mapping, then removed to
  eliminate portability ambiguity.
- `PR-DOC-001`: confirmed, fixed by reflowing the review lane.
- `PR-TEST-001`: challenged; this repository intentionally keeps `tests/`
  local-only under `.gitignore`. The validation commands and outputs remain in
  this durable round record.
- `PR-EVAL-001`: confirmed, fixed with three negative tests.
- `PR-GATE-003`: confirmed in closing review round 2; fixed by requiring at
  least one complete finding for every NO-GO or CONDITIONAL-GO result.
- `PR-DOC-002`: confirmed in round 2; fixed by distinguishing required
  caller-observable measurements from optional provider telemetry.
- Closing revision hashes: `SKILL.md` `14ec1ad...`, `REFERENCE.md` `7290aa...`,
  checker `09df901...`; independent reviewer returned GO with no blocker,
  should-fix, or optional finding.

Weakest gate or lowest-confidence claim:

- No three-trial baseline/candidate run on two diverse real plan samples has yet
  established high generalization confidence. Self-reported runtime provenance
  also limits acceptance to provisional without a trusted adapter.

Decision:

- Continue. Candidate generation and installation are accepted. Overall redesign
  remains provisional until two diverse real plans complete baseline/candidate
  three-trial comparison (`PR-EVIDENCE-002`).

## Round 2 — Asset Loan Real-Plan Pilot

Supersedes: Round 1 (reopened because real-task cost was unverified)
Improvement magnitude: none for the cost objective
Generalization confidence: low
Hard gates: fail (observable cost/output regression)
High-stakes escalation: real blinded baseline/candidate calls

Task sample:

- project: `/Users/hex1n/Workspace/asset_loan`
- candidate: `docs/superpowers/specs/2026-05-10--fund-backtest-design.md`
- frozen evidence: candidate, companion account-reconstruction design,
  `AGENTS.md`, and root `pom.xml`
- runtime/model: Codex CLI 0.144.1 / `gpt-5.6-sol`, low reasoning,
  ephemeral read-only sessions
- baseline artifact: `/tmp/plan-review-bounded-baseline-A-1.json`
- candidate artifact: `/tmp/plan-review-bounded-candidate-A-1.json`

Observed output:

- An initial unbounded baseline probe cost 57,994 tokens and 161.8 seconds;
  it was excluded from A/B quality comparison and used only to bound the pilot.
- Bounded baseline: 5 blockers, 7 should-fix, 2 optional, 4 verification gaps;
  8,244 output characters.
- Bounded candidate: 8 blockers, 15 should-fix, 3 optional, 7 verification
  gaps; 17,547 output characters and 43,903 reported tokens.
- The candidate added some plausible defects (unit conversion, ex-dividend
  double counting, and income-identity closure), but more than doubled output
  and substantially expanded the validation burden.

Weakest gate:

- One run per arm cannot estimate finding stability, but the candidate already
  fails the primary cost/output direction. Further trials would spend material
  tokens without making this observed regression disappear.

Decision:

- Reject the current redesign for the stated cost-reduction objective. Stop the
  remaining calls. Rework the candidate around review-scope budgeting and
  evidence-lane control before another A/B round.

## Round 3 — Root-Cause Consolidation

Supersedes: Round 2
Improvement magnitude: pending real output
Generalization confidence: low

Pre-registered change:

- Preserve exhaustive root-cause coverage while merging downstream symptoms
  that have the same evidence, owner, remediation, and disposition.
- Consolidate verification gaps by missing authority source and next check.
- Split only independently actionable findings; do not impose a numeric cap.

Generalization Gate:

- The rule must group both financial-calculation symptoms caused by one
  accounting-contract ambiguity and deployment symptoms caused by one missing
  platform authority source. The wording uses only portable root-cause,
  evidence, owner, remediation, disposition, and authority-source terms.

Discriminating probe:

- Re-run only the bounded candidate arm on the same asset-loan design with the
  same model and reasoning effort. A promising result must materially reduce
  output/finding count while retaining the baseline's five blocker themes.

Observed output:

- Root-cause candidate: 4 blockers, 6 should-fix, 1 optional, 5 verification
  gaps; 8,809 output characters and 35,591 tokens.
- Versus the previous candidate, output fell about 49.8% and reported tokens
  about 18.9%.
- Quality gate failed: two baseline missing-data-policy blockers were merged and
  demoted to should-fix. Parent validation confirmed the contradiction remained.

Decision:

- Continue with the narrowest rule: a merged finding inherits the highest
  severity among its consequences; consolidation never lowers a gate.

Severity-dominance probe:

- Output: 8 blockers, 5 should-fix, 1 optional, 4 verification gaps; 9,530
  characters and 30,389 tokens.
- All five baseline blocker themes were retained, including the consolidated
  missing-data-policy contradiction at blocker severity.
- Cost gate still failed against the bounded baseline: both returned 18
  findings, while candidate output was 15.6% longer (9,530 versus 8,244
  characters). One run cannot establish stable token savings.

Round 3 decision:

- Reject root-cause consolidation as a sufficient standalone cost mechanism.
  It improves the rejected candidate substantially and preserves blocker
  severity, but does not beat baseline observable output cost.
- The next candidate must change review sequencing: blocker/root-cause discovery
  first, followed by one complete closing review after blockers clear. Further
  wording-only compression is not justified by this evidence.

## Round 4 — Blocker Sweep

Supersedes: Round 3
Improvement magnitude: pending real output
Generalization confidence: low

Pre-registered change:

- Opening rounds exhaustively cover independently actionable blockers and
  decision-blocking verification gaps only.
- Should-fix and optional lanes become active in the complete all-severity review
  after the blocker lane clears.
- The exact closing gate is unchanged; only a complete current-revision review
  can return closing GO.

Discriminating probe:

- Same asset-loan candidate, evidence scope, runtime/model, and low reasoning.
- Retain the bounded baseline's five blocker themes.
- Opening-round output must be materially below 8,244 baseline characters; no
  should-fix or optional findings should be emitted during the blocker sweep.

Observed output:

- 4 blockers, 0 should-fix, 0 optional, 2 verification gaps; 4,219 output
  characters and 28,308 tokens.
- Output beat the bounded baseline by 48.8% and the original candidate token
  count by 35.5%.
- Quality gate failed: the sweep omitted the baseline's event-source and
  money-income missing-data policy conflicts. Parent validation confirmed these
  share one failure/degradation-contract root cause and remain blocking.

Decision:

- Continue without another Round 4 call. Add a generic contract comparison:
  incompatible failure, partial-success, or stale-fallback outcomes for the same
  missing/invalid condition form one blocker until an authority source chooses.
- Generalization check: the same rule applies to missing financial market data
  and to a deployment plan whose dependency outage is variously specified as
  fail-closed, degraded operation, or stale-cache fallback.

Failure-contract probe:

- 7 blockers, 0 should-fix, 0 optional, 3 verification gaps; 6,161 output
  characters and 22,649 tokens.
- All five bounded-baseline blocker themes were retained. The event-source and
  money-income missing-data contradictions were each returned as blockers.
- Output beat bounded baseline by 25.3%; reported tokens beat the original
  candidate by 48.4%.
- Artifact:
  `/tmp/plan-review-bounded-candidate-A-blocker-sweep-contract.json`.

Gate hardening after independent falsification:

- A confirmed fix cannot close on the same revision where it was found.
- Decision-blocking verification gaps remain open; only evidence-backed
  outside-closing-scope gaps may defer.
- Blocker-sweep reports reject should-fix/optional payloads, and a
  blocker-sweep GO cannot close the exact gate.

## Diverse Sample — Facade Doc / Mock Platform

- Project: `/Users/hex1n/Workspace/sofa-facade-doc`.
- Baseline: 2 blockers, 6 should-fix, 2 optional, 6 verification gaps; 10,102
  output characters.
- Candidate blocker sweep: 2 blockers, 0 should-fix, 0 optional, 2 verification
  gaps; 3,397 output characters and 26,522 tokens.
- Output reduction: 66.4%.
- The facade-class-loading blocker was retained. Real-chain acceptance moved
  from blocker to a more accurate decision-blocking verification gap; a new
  production-enablement safety blocker was found.
- The artifact exposed a schema gap: reviewer output had not yet been required
  to return review kind, coverage manifest, or gap scope. The task-facing schema
  now requires these fields and forbids the parent from inferring/upgrading them.

Final manifest hardening:

- Round reports preserve reviewer-returned `review_kind` and must match the
  receipt; a parent cannot upgrade blocker-sweep to complete.
- Verification-gap scope/reason is present in reviewer payload and reconciled
  with the parent ledger.
- Closing complete reports must match frozen rubric dimensions and all four
  severities.

## Final Decision

Improvement magnitude: clear
Generalization confidence: high for two diverse real-plan probes
Hard gates: pass
Independent closing review: GO

- Accept the blocker-sweep plus complete-closing-review design.
- Asset-loan output fell 25.3% versus bounded baseline while retaining every
  baseline blocker theme after the failure-contract rule was added.
- Facade Doc / Mock Platform output fell 66.4%, retained gate-relevant roots,
  and found an additional production-enablement blocker.
- Exact closing strength is preserved through reviewer-returned review kind,
  frozen rubric/all-severity coverage, immutable revision transitions, and
  reviewer-payload/parent-ledger reconciliation.
- Provider token categories remain optional. Calls, input/output characters,
  wall-clock, physical sessions, and retries are the required cost receipt.

## Full Closing-Path Fixture

- Durable fixture:
  `scripts/plan-review-eval/fixtures/closing-pass.json`.
- Proves `blocker-sweep NO-GO → parent confirmed/fix → new revision → complete
  all-severity GO → exact gate PASS`.
- Negative mutations fail for same-revision fix, parent-upgraded review kind,
  and missing closing coverage.
- Direct checker result: `{ "pass": true, "failures": [] }`.
- Coverage is enforced for every blocker-sweep and complete report, including
  non-closing history; duplicate rubric/coverage members fail closed.
- The authoritative final-verdict set exactly matches required reviewers on the
  current revision; stale GO history stays only in receipts/reports.
- Same-revision fixes fail for every severity, attempt IDs are non-empty and
  unique, and every GO report rejects blocker/should-fix payloads.
- Eval infrastructure: 16/16 tests; skill contract/gate: 42/42 tests.
- Independent adversarial closing-path review: GO after four falsification/fix
  rounds; combined 58/58 tests passed.
