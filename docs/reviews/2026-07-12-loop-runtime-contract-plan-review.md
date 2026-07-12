# Loop Runtime Contract Plan Review

Date: 2026-07-12  
Candidate: `docs/plans/2026-07-03-loop-runtime-contract-improvement.md`  
Revision: `8248180087a561f72308f4cae288f320aca79219f731cfd167444e39aa8be72c`  
Closing state: `suspended` — required second-model reviewer produced no closing verdict  
Diagnostic fallback verdict: `NO-GO`

## Round Receipts

| Round | Runtime / model | Verdict | Handle | Token usage |
|---|---|---|---|---|
| R0 | Claude Code / unavailable | TIMED-OUT | foreground process | unavailable — host timeout left no recoverable job or telemetry |
| R1 | Claude Code / unavailable | FAILED | `b629891f-17a1-4674-ac1f-f6824302605c`; session `d25f83ff-002a-43ae-a1e6-68c0da12da53` | unavailable — Claude returned an error result without usage/model fields |
| R2 | Codex collaboration / GPT-5-based, exact identifier unavailable | NO-GO (diagnostic only) | `/root/real_plan_diagnostic` | unavailable — collaboration runtime exposed no token receipt |

## Reviewer Findings And Parent Validation

Each entry preserves the diagnostic reviewer's claim, evidence, and affected
section. `Parent validation` is the main agent's independent disposition of that
claim against the pinned plan and current authority sources.

### Blockers

#### B1 — Wrong repository and obsolete runtime surface

- Reviewer claim: The plan targets the wrong repository and obsolete runtime surface.
- Reviewer evidence: Current `AGENTS.md` and `CONTEXT.md` assign portable skills to this repository and runtime ownership to standalone `taskloop`. Planned files `bootstrap/bin/agent-loop.mjs`, `tests/agent_loop.test.mjs`, and `tests/agent_doctor.test.mjs` are absent. Current canonical state is `.taskloop/task.json`, not `.agent-loop/run-contract.json`.
- Affected sections: TL;DR; Runtime Contract schema; Hook, Doctor, Docs, Test, and rollout plans.
- Parent validation: **confirmed**. `AGENTS.md:3`, `CONTEXT.md:67-86`, and filesystem checks directly support the claim.

#### B2 — Shared-worktree partitioning contradicts current architecture

- Reviewer claim: The proposed `partitioned` concurrency mode contradicts current authoritative architecture.
- Reviewer evidence: `CONTEXT.md` defines worktree fan-out and states that there is no shared-worktree partitioned mode, while the plan makes `partitioned` a P1 feature and acceptance criterion.
- Affected sections: Concurrency model §3; Slice 3; acceptance criterion 6.
- Parent validation: **confirmed**. `CONTEXT.md:106` is explicit.

#### B3 — Shared JSON mutation lacks concurrency control

- Reviewer claim: Multiple sessions can lose updates because the shared contract has no lock, compare-and-swap revision, atomic transition boundary, or fencing.
- Reviewer evidence: The plan lets multiple writers and hooks update claims, evidence, iteration, terminal state, and timestamps in one JSON file. Current taskloop wraps load-transition-save with `withTaskLock`; atomic rename alone is documented as insufficient.
- Affected sections: Single source of truth; partitioned mode; terminal machine; Slices 2-3.
- Parent validation: **confirmed**. The plan contains no locking protocol; `taskloop/lib/task-store.mjs:9,118-138` supplies the counterexample.

#### B4 — Terminal semantics conflict with the current canonical model

- Reviewer claim: The proposed terminal model conflicts with current semantics and lacks authoritative transitions.
- Reviewer evidence: The plan introduces `success/noop/blocked/stalled/exhausted`, keeps both `status` and `terminal_state`, and omits transition authority and resume-budget rules. Current semantics use machine success plus human closures and resumable suspension outcomes.
- Affected sections: Terminal state machine; Slice 2; acceptance criteria 3-4.
- Parent validation: **confirmed with wording correction**. The reviewer called machine success `done`; the current implementation name is `achieved`. The structural conflict remains supported by `CONTEXT.md:90-94` and taskloop's lifecycle definitions.

#### B5 — Safety enforcement lacks authorization provenance and interception boundaries

- Reviewer claim: Safety booleans and git permissions are not tied to who granted them, and the plan mixes blocking, escalation, warning, and prompting without fail-open/fail-closed rules.
- Reviewer evidence: Static command matching cannot comprehensively cover wrappers, interpreters, subprocesses, MCP tools, lifecycle scripts, or platform variants.
- Affected sections: Design principle 5; safety budget; Slice 4; acceptance criteria 7-8.
- Parent validation: **confirmed with narrowed wording**. The plan explicitly says the contract does not replace the sandbox, so the finding is not that enforcement is impossible; it is that the proposed enforcement boundary and authorization provenance are underspecified.

### Should-fix

#### S1 — v1 replacement can destroy recoverability

- Reviewer evidence: `init --force --steal` has no mandatory archive, digest, receipt, dry run, rollback, or preservation of prior evidence; current taskloop has an authorized `archive-incompatible-state` flow.
- Affected sections: Design principle 6; compatibility; Slice 1.
- Parent validation: **confirmed**. No archive or rollback step appears in the plan; taskloop requires explicit user authorization and reason.

#### S2 — Criterion success is not bound to the accepted artifact

- Reviewer evidence: The plan lacks criterion provenance, input-drift detection, side-effect detection, artifact revision binding, and freshness after the last substantive write.
- Affected sections: Evidence principle; schema; Slice 2; acceptance criteria 3-4.
- Parent validation: **confirmed**. These bindings are absent from both schema and verification plan.

#### S3 — Review evidence can become stale or replayed

- Reviewer evidence: `review.verdict`, counts, and findings are not bound to criterion generation, task/artifact revision, reviewer identity, or independence level.
- Affected sections: Schema; success rule.
- Parent validation: **confirmed**. The sample review object contains none of those bindings.

#### S4 — Budget semantics are internally incomplete

- Reviewer evidence: `exhausted` includes time and token exhaustion, but the sample schema defines neither time nor token budgets and does not specify consumption or refill semantics.
- Affected sections: Schema; terminal state machine; Slice 2.
- Parent validation: **confirmed**. The mismatch is visible in the plan's own schema and state table.

#### S5 — `status` and `terminal_state` permit contradictory states

- Reviewer evidence: The plan allows `status: closed` beside a separate terminal field without a complete valid-combination invariant or atomic transition table.
- Affected sections: Schema; terminal machine; Doctor; open decision 1.
- Parent validation: **confirmed**. Doctor detecting contradiction does not define or prevent all contradictory combinations.

#### S6 — Claim-overlap validation is underspecified

- Reviewer evidence: Glob examples omit normalization for symlinks, case folding, traversal, generated paths, renames, nested repositories, and pattern intersection; singleton ownership lacks an authoritative registry.
- Affected sections: Partitioned rules; Slice 3; Doctor.
- Parent validation: **confirmed**. No normalization or overlap algorithm is specified.

#### S7 — Git authority is contradictory

- Reviewer evidence: Acceptance criterion 7 permits owner or integrator, while partitioned mode permits only the integrator; read-only versus mutating git commands are not classified.
- Affected sections: Concurrency; Slice 3; acceptance criterion 7.
- Parent validation: **confirmed**. The two rules conflict at plan lines 179 and 385.

#### S8 — `noop` lacks a trustworthy proof rule

- Reviewer evidence: The plan requires evidence but does not define observation, freshness, zero-write invariant, or declaration authority.
- Affected section: Terminal state machine.
- Parent validation: **confirmed**. The plan provides only a label and one sentence.

#### S9 — Stale-session takeover is unsafe

- Reviewer evidence: The 24-hour heuristic lacks liveness, clock-skew, active-process, heartbeat, and concurrent-steal handling.
- Affected sections: Doctor; exclusive concurrency.
- Parent validation: **confirmed**. `--force --steal --reason` records intent but does not supply the missing fencing protocol.

### Optional

#### O1 — Remove automation-template work

- Reviewer evidence: Automation is P2 even though background automation is out of scope and meant to follow runtime stabilization.
- Affected sections: Rollout; non-goals; open decision 4.
- Parent validation: **confirmed**. It is scope noise rather than a correctness blocker.

#### O2 — Mark the historical plan as superseded

- Reviewer evidence: Its terminology and ownership model materially differ from canonical `CONTEXT.md`.
- Affected section: Whole document.
- Parent validation: **confirmed**. A supersession marker would prevent future readers from treating it as current authority.

### Verification gaps

#### V1 — Migration and rollback

- Missing check: Preserve a populated v1 state, archive it with digest and receipt, create v2, fail midway, then restore or retry without evidence loss.
- Parent validation: **confirmed**; no equivalent scenario exists in the plan.

#### V2 — Concurrent mutation stress

- Missing check: Race hook and claim updates across processes and prove no lost counters, claims, evidence, or terminal transitions.
- Parent validation: **confirmed**; listed tests are sequential examples.

#### V3 — State-machine property coverage

- Missing check: Enumerate lifecycle/terminal combinations, illegal transitions, terminal immutability, and budget behavior after resume.
- Parent validation: **confirmed**; no complete transition/property test is proposed.

#### V4 — Adversarial safety interception

- Missing check: Exercise wrappers, aliases, interpreters, subprocesses, lifecycle scripts, quoting, indirect network access, MCP/tool calls, and false-positive recovery.
- Parent validation: **confirmed**; the plan tests only obvious command forms.

#### V5 — Filesystem-adversarial claims

- Missing check: Exercise symlinks, `..`, case folding, renames, glob intersections, nested repositories, generated files, and singleton paths.
- Parent validation: **confirmed**; absent from Slice 3 tests.

#### V6 — Evidence freshness

- Missing check: Green criterion followed by a write, criterion mutation/amendment, stale review, flaky criterion, and side-effecting criterion.
- Parent validation: **confirmed**; freshness is not part of the plan's schema or tests.

#### V7 — Session takeover

- Missing check: Live/crashed owners, clock skew, stale heartbeat, concurrent steals, and unauthorized force/steal.
- Parent validation: **confirmed**; only the happy-path takeover command is named.

#### V8 — Verification against the actual runtime repository

- Missing check: Run standalone taskloop's public CLI, hook-protocol, architecture, installer, lifecycle, ledger, and cross-platform suites.
- Parent validation: **confirmed**. The plan's minimum commands point at files absent from this repository.

## Gate Decision

The exact revision did not pass. The required Claude reviewer never returned a
closing verdict, the diagnostic fallback reported open blockers, and no plan
revision was authorized or produced during this test. Resume by deciding whether
to mark the historical plan superseded or rewrite it against the standalone
taskloop repository, then obtain a complete second-model review of that new
revision.
