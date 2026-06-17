# Java Stack Craft - Review Mode

Use this file when the task is to review Java stack code. Review findings should be actionable, evidence-backed, and proportionate to the requested scope.

## Step R1: Choose the review scope

Choose one mode and say which one you used.

| Mode | Use when | Scope rule |
|---|---|---|
| Diff review | A PR, patch, or changed files are provided | Review touched lines plus blast radius |
| Focused review | User names a class, module, bug type, or concern | Review only that concern and direct dependencies |
| Repo audit | User asks for broad quality/security/Java stack review | Return top findings only, grouped by impact |

Do not turn every review into a repo audit. For repo audits, default to the top 8 findings unless the user asks for exhaustive output.

## Step R2: Gather evidence

Use the main skill gates first: read [WORK_CONTEXT.md](WORK_CONTEXT.md), reuse or refresh the Java Work Context according to its lifecycle rule, read Spring rules for Spring projects, inspect conventions, and read [RISK_ROUTER.md](RISK_ROUTER.md). Read [PROFILE.md](PROFILE.md); the context command creates or updates `docs/agents/java-stack-profile.md` by default. For repeated, broad, or noisy reviews, also read `docs/agents/java-stack-review-memory.md` when present. Then gather only evidence that can change priority.

Useful evidence:

- `mvn -q -DskipTests compile` or Gradle compile for namespace/JDK issues.
- Targeted tests or full tests when the review is about verification health.
- `<java-stack-craft>/scripts/java_stack.py context --dir <project-root>` for Target Profile, Project Facilities, bounded risk candidates, and verification floor.
- `<java-stack-craft>/scripts/java_stack.py scan --dir <project-root>` for focused high-frequency defect signals with proof tiers. Add `--include-tests` only when test source/config quality is in scope. Use `--category`, `--max-findings`, or `--max-depth` when a focused review needs less noise or deeper build-file discovery.
- Direct code reads for concurrency, lifecycle, security, and boundary issues.

Scanner output is advisory. Confirm important findings with code before ranking them high.

Project Knowledge Cards and review memory are advisory. Use a card only when its Use when / Do not use when boundary matches the review scope. Cards may lower repeated maintainability noise or point to local facilities, but they must not suppress new evidence for security, correctness, data integrity, concurrency, resource, or build/runtime failures. If profile facts conflict with build files, detector output, or code, trust live evidence and mark the profile stale.

If a build cannot reach compilation because private repositories, blocked HTTP mirrors, credentials, or missing internal artifacts fail dependency resolution, record the failing stage as a baseline and use source evidence for review. Do not mark compile-related findings `confirmed` unless the command actually reached source compilation.

When reviewing repositories that contain secrets or credentials, report only the file/line, credential type, exposure path, and rotation/removal action. Do not quote or copy secret values, tokens, passwords, hosts with credentials, or connection strings.

## Step R3: Rank by impact, not preference

Severity is contextual:

- **Blocker**: security exposure, won't compile, test suite prevents merge, data race on shared production state, resource exhaustion, or clear runtime correctness failure.
- **Major**: architecture drift, inconsistent state ownership, missing protection on important routes, risky async/threading design, or extensibility problem with near-term cost.
- **Minor**: suboptimal JDK idiom, avoidable coupling, naming/cohesion issue, or low-risk maintainability issue.
- **Nit**: formatter/style issue. Prefer formatter/tooling over manual style review.

Use these as defaults, not rigid labels. If a normally major issue is unreachable in this project, lower it and say why. If a normally minor issue is on a critical path, raise it and show the impact path.

In legacy Spring repos, broad field-injection findings are usually backlog signal, not top repo-audit findings. Rank them by the field-injection policy in [RISK_ROUTER.md](RISK_ROUTER.md#scanner-calibration); findings that do not pass it become a pattern note or are omitted from top findings.

For each candidate finding, apply the [RISK_ROUTER.md](RISK_ROUTER.md) evidence ladder before reporting it:

- Signal: scanner, search, command output, or code read.
- Evidence: exact file/line plus direct control/data path.
- Impact: reachable failure, exploit, data issue, resource issue, or concrete maintenance cost.
- Confidence: `confirmed`, `likely`, or `needs-check`.
- Fix: one practical next step, not a broad rewrite.

Flag newly invented helpers that bypass seam-relevant same-module Project Facilities only when they create a concrete failure path or maintenance cost; otherwise treat them as convention notes, not top findings.

For broad reviews or noisy scans, use the candidate triage table from [RISK_ROUTER.md](RISK_ROUTER.md) to decide keep/drop before writing final findings. If a candidate cannot pass this ladder, drop it from top findings or downgrade it to a pattern note.

If a repeated low-value pattern was intentionally downgraded, follow [PROFILE.md](PROFILE.md). Update `docs/agents/java-stack-review-memory.md` under the path rule there; otherwise mention the suggested memory entry.

## Step R4: Attach confidence

Use one of:

- **confirmed**: code evidence plus command output, reproduction, or directly verified control flow.
- **likely**: code evidence is strong but not run.
- **needs-check**: requires business context, runtime config, or traffic assumptions.

Do not hide uncertainty. It is better to mark a finding `likely` than to overstate it.

When verification strength matters, attach the proof tier from [RISK_ROUTER.md](RISK_ROUTER.md). Do not label a finding `confirmed` from P3 scanner-only evidence or P4 inference.

## Step R5: Output findings

Lead with blockers. If there are none, say so plainly.

When compile/test/source proof is degraded or material to ranking, append the Verification Closure from [RISK_ROUTER.md](RISK_ROUTER.md#verification-closure).

Preferred format:

```text
severity · category · confidence/proof-tier · file:line · rule broken · impact path · one-line fix
```

Examples:

```text
Blocker · security · confirmed/P0 · src/main/resources/application.yml:22 · secret default in config · committed API key can be used outside the app · remove the default, require env vars, and rotate the key.
Major · concurrency · likely/P2 · src/main/java/.../StreamingService.java:49 · unbounded executor · stalled streams can grow threads until the process is saturated · inject a bounded executor or use WebClient streaming with explicit cancellation.
```

For broad reviews, keep the top findings and mention what was not exhaustively reviewed.

When a Project Knowledge Card changed ranking, mention the card title and whether it was used unchanged, updated, marked stale, or skipped because it failed the promotion gate.
