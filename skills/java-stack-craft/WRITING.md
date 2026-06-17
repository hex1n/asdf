# Java Stack Craft - Writing Mode

Use this file when the task is to write, edit, refactor, or land an accepted plan into Java stack code. Keep the main skill gates in force, consume the Java Work Context from [WORK_CONTEXT.md](WORK_CONTEXT.md), and choose the smallest workflow that can prove the change.

## Step W1: Pick the writing lane

Choose one lane and say which one you chose. The lane is a default, not a cage; explain any exception.

| Lane | Use when | Expected proof |
|---|---|---|
| Smoke patch | Small quality improvement or skill validation | Targeted compile or focused test |
| Production fix | Bug, failing test, security issue, concurrency risk, or behavior change | Reproduce when practical, fix, then green test/compile |
| Architecture fix | Shared contract, storage model, API boundary, or broad concurrency design | Short design note before editing, then focused vertical slice |

Prefer a real production fix over a cosmetic smoke patch when the user asked to improve a live project. A smoke patch is fine for explicit skill validation, demos, or low-risk cleanup.

Before picking a target, read [RISK_ROUTER.md](RISK_ROUTER.md) for non-trivial work and name the failure path you are improving. Do not choose an edit only because a scanner rule fired. If multiple targets are plausible, fill the candidate decision table from [RISK_ROUTER.md](RISK_ROUTER.md) and choose by risk, blast radius, and available proof. If there is no concrete failure path, call it a smoke patch or ask for a narrower goal.

For repeated or non-trivial repo work, read [WORK_CONTEXT.md](WORK_CONTEXT.md), then reuse or refresh the Java Work Context according to its lifecycle rule. Read [PROFILE.md](PROFILE.md); the context command creates or updates `docs/agents/java-stack-profile.md` by default. Treat Project Knowledge Cards as soft context; if they conflict with detector output, build files, or code, trust live evidence and mark the profile stale in the report.

## Step W2: Bound the write scope

Before editing, identify:

- The Java Work Context summary: Target Profile, relevant Project Facilities, Risk Candidates, and Verification Floor.
- Relevant Project Knowledge Cards considered, which choice each changed, or `no-card` when none applied.
- Whether the worktree is dirty and whether edits are in the original project or a temporary copy.
- The intended files or module boundary.
- Seam-relevant Project Facilities searched in touched-flow and same-module sibling code; examples include logging/alarm, transaction boundaries, pagination/query, mapping, JSON/date/id utilities.
- The risk tier and failure path from [RISK_ROUTER.md](RISK_ROUTER.md).
- The candidate table decision, when there was more than one plausible target.
- The verification command you expect to run.
- Why the change is not only surface cleanup, unless it is explicitly a smoke patch.

If the worktree is dirty, do not revert or overwrite unrelated user changes. For risky experiments, use a temporary copy or ask for the intended write target.

If the project already has failing tests, record the baseline failure before editing when practical. Then use the smallest targeted test or compile command that proves the current change, and do not attribute old failures to the new edit.

If Maven/Gradle cannot reach source compilation because private repositories, blocked HTTP mirrors, credentials, or missing internal artifacts fail dependency resolution, treat that as an environment baseline. Re-run the same command after the edit to confirm the failure stage is unchanged, then add source-level checks that match the risk: focused diff review, advisory scan filtered to touched files/categories, grep/AST checks for the intended invariant, and formatter/static checks that do not require dependency resolution. Report this as degraded verification; do not claim the code compiles.

## Step W3: Use advisory scanning where it helps

The Java Work Context already includes a bounded scan. When a focused scan would add signal, run:

```bash
python3 <java-stack-craft>/scripts/java_stack.py scan --dir <project-root> --format markdown
```

Resolve `<java-stack-craft>` to this skill directory, not the target repo; `--dir` points at the Java project. The scan is evidence, not an oracle. It can miss context and produce advisory findings with proof tiers. By default it scans main code/resources; add `--include-tests` when test source or test configuration is part of the change. Use it to catch high-frequency defects, then decide from code and project conventions. For tiny edits, skip it when it would add no useful signal.

Use `--fail-on blocker` or stricter only when the user, CI, or local workflow explicitly wants the scan as a gate.

Use `--category security,concurrency,jdk` or `--max-findings 20` when a broad scan would produce too much noise for the current task. Use `--max-depth` when build files are intentionally deeper than the default module scan.

When scan output is mostly broad maintainability signal, deliberately look for a stronger scoped risk before editing: a reachable security issue, correctness bug, concurrency/resource issue, or build/runtime compatibility failure. If none is in scope, keep the patch small and report that it is cleanup rather than a production fix.

If the work reveals a stable repo fact that changed the coding or verification choice, follow [PROFILE.md](PROFILE.md): add or update a Project Knowledge Card outside the generated block, redacting secrets and keeping generated detector output script-owned. Do not add descriptive project summaries that would not change a future choice. If a candidate fact fails the card promotion gate, keep it in the result only.

## Step W4: Write with flexible defaults

- Match project conventions for style, package layout, DTO mapping, and test style.
- Prefer seam-relevant Project Facilities before inventing new helpers. Search touched-flow and same-module sibling code for local helpers, wrappers, templates, and idioms that already own the concern; common examples include logging/alarm, transaction boundaries, pagination/query, mapping, and JSON/date/id utilities. Create or adapt a helper when no fitting facility exists, the local one has a defect, the new behavior is a real variation point, or reuse would cross the wrong bounded context.
- Do not propagate conventions that create correctness, security, or concurrency defects.
- Keep abstractions tied to real variation points. If there is one permanent implementation, inline or use the existing concrete type.
- Prefer constructor injection and `final` dependencies for new or touched Spring beans. In legacy Spring codebases dominated by field injection, do not migrate a bean only because the scanner found it; follow the field-injection policy in [RISK_ROUTER.md](RISK_ROUTER.md#scanner-calibration), or migrate when the user asked for DI cleanup.
- Keep Java syntax within the detected target. For JDK 8, avoid `var`, `record`, `List.of`, `Stream.toList`, text blocks, and switch expressions.
- Add or update behavior tests when the change affects logic. For mechanical refactors, a compile or focused existing test may be enough.

## Step W5: Report the result

For a small change, report only the relevant items:

- Detected JDK/Boot/namespace and source build file.
- Files changed.
- Risk tier and concrete failure path improved.
- Candidate chosen/rejected summary when selection was non-obvious.
- Knowledge Card closure: updated `<card>`, used `<card>` unchanged, marked `<card>` stale, or `no-card` with a one-line reason.
- Project Facilities reused, or why creating/adapting a helper was the better fit.
- Conventions matched and any deliberate divergence.
- Any abstraction introduced and its variation point, or state that none was introduced.
- Verification command and result.
- Verification Closure from [RISK_ROUTER.md](RISK_ROUTER.md#verification-closure) when proof is degraded, scanner-backed, or non-obvious.
- Remaining risk or why a broader test was skipped.

For non-trivial fixes or handoffs to another agent, add a compact durable handoff:

- Current behavior.
- Desired behavior.
- Key seams/interfaces touched.
- Acceptance criteria.
- Explicitly out of scope.
- Verification evidence, including proof tier from [RISK_ROUTER.md](RISK_ROUTER.md).
