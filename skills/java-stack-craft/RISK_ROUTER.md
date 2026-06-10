# Java Stack Craft - Risk Router

Use this file to decide what deserves action before applying Java/Spring style rules. The goal is to prevent scanner hits and generic best practices from outranking real production risk.

## Core rule

A rule match is not a reason to edit or report by itself. First name the failure path: what can compile wrong, leak, be attacked, corrupt data, exhaust resources, fail at runtime, or make a focused change untestable.

## Priority ladder

Use the highest applicable tier with concrete evidence:

| Tier | Risk | Examples | Default action |
|---|---|---|---|
| 0 | Hard constraints | target JDK syntax, `javax`/`jakarta`, dirty worktree, sensitive external side effect | block or adapt before editing |
| 1 | Security | committed secrets, auth bypass, SQL injection, disabled TLS/SFTP host verification, unsafe deserialization | fix or report first |
| 2 | Correctness/data integrity | swallowed exceptions, lost interrupt status, broken transaction boundary, wrong idempotency, null/state inconsistency | fix/report before cleanup |
| 3 | Concurrency/resource | unbounded executors, silent rejection, shared mutable singleton state, lock misuse, common-pool blocking | fix/report when reachable |
| 4 | Build/runtime compatibility | wrong namespace, too-new APIs, module JDK mismatch, dependency boundary break | fix/report with compile or source evidence |
| 5 | Maintainability/testability | field injection, over-abstraction, package drift, hard-to-construct class | act when scoped to touched/cohesive code |
| 6 | Style | formatting, naming, import order | leave to formatter unless requested |

## Writing selection

Pick a change only after answering:

- What is the highest-risk concrete failure path in scope?
- Is the evidence from code, a failing command, a scanner signal, or inference?
- Can the change be bounded to one module/class/flow?
- What proof can run in this environment?

If the strongest signal is broad field injection or style drift, do not make it the main production fix unless the user asked for that cleanup. Prefer a smaller correctness, security, concurrency, or build-compatible fix with a clear failure path.

When there is more than one plausible target, write a compact candidate decision table before editing:

| Candidate | Tier | Proof tier | Evidence | Blast radius | Verification | Decision |
|---|---|---|---|---|---|---|
| concrete file/flow | 1-6 | P0-P4 | command/code/scanner/inference | files/modules touched | test/compile/source check | choose/reject + why |

For 3+ plausible targets or high-impact choices, run a lightweight candidate tournament: compare candidates pairwise by the table criteria, drop weaker or duplicate candidates, then challenge the winner with the strongest reason it could be wrong. Keep it only if it still wins on risk, proof, blast radius, and verification.

Choose the candidate that has the best mix of high risk, bounded blast radius, and available proof. Even when only two candidates made the table, challenge the chosen one with the strongest reason it could be wrong before editing; the tournament is the expanded form of this check. Reject candidates that are only broad cleanup, require external side effects, cannot be verified in the current environment, or would turn a legacy-wide pattern into an incidental rewrite.

Proof tiers:

| Tier | Meaning | Claim allowed |
|---|---|---|
| P0 | Compile/test reaches project source and passes, or a static config/build artifact fully determines the defect | High-confidence compile, behavior, or config claim |
| P1 | Focused harness, targeted test, reproduced local check, or a direct code read that verifies the defect on a specific control/data path | Local behavior claim for the checked path |
| P2 | Source-level invariant check when dependency resolution blocks compilation | Degraded verification claim; no compile claim |
| P3 | Scanner-only signal | Discovery signal only |
| P4 | Inference from conventions or incomplete context | `needs-check` only |

## Review ranking

For each candidate finding, require:

- Signal: scanner, search, command output, or code read.
- Evidence: file/line and the relevant control/data path.
- Impact: reachable failure, exploit, data issue, resource issue, or concrete maintenance cost.
- Confidence: `confirmed` only with direct command/control-flow proof; otherwise `likely` or `needs-check`.
- Fix: one practical next step, not a broad rewrite.

For repo audits, report top production risks first. Mention broad maintainability patterns only after higher tiers, or omit them when they do not affect the requested scope.

For broad reviews, sketch the candidate triage before final findings when it changes ranking:

| Candidate | Tier | Proof tier | Evidence | Reachability | Impact | Keep/drop |
|---|---|---|---|---|---|---|
| concrete issue | 1-6 | P0-P4 | command/code/scanner | confirmed/likely/unknown | production failure path | keep/drop + why |

Keep findings that pass the evidence ladder and rank highest by reachable impact. Drop scanner-only or style-only candidates unless the review scope explicitly asks for them.

Review memory can help downgrade repeated Tier 5-6 noise, such as project-wide field injection without a scoped failure path. It must not suppress Tier 1-4 findings, and it must not override fresh code evidence.

## Scanner calibration

Treat `scripts/java_advisory_scan.py` as a discovery aid:

- Scanner output includes `proof_tier`; use it to calibrate claims, not to skip code confirmation.
- JDK and Spring namespace findings can be high severity when the detector agrees.
- Security and concurrency findings need code confirmation before ranking high.
- Field-injection policy (canonical): field injection is backlog signal in legacy Spring projects; escalate it only when it concretely affects construction, lifecycle safety, null-safety, testability, circular dependencies, or the touched/cohesive change.
- Test-source findings are out of scope unless `--include-tests` was intentionally used.
