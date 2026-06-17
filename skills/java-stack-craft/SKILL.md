---
name: java-stack-craft
description: >
  Writes and reviews version-appropriate Java stack code by detecting the target JDK from Maven/Gradle, matching local conventions, and applying Spring/Java quality gates.
  Use when writing, editing, refactoring, or reviewing Java stack code in Maven, Gradle, or Spring Boot projects — including 写/重构/审查 Java 代码, Spring Boot 接口/服务, Java 并发, JDK 兼容性, 依赖注入, 事务, 优化 Java/Spring 项目 requests — especially when JDK compatibility, Spring conventions, dependency injection, concurrency, tests, or application architecture quality matter.
  Do not use for reproducing/fixing a live JVM incident (use diagnose) or pure what-is-true system investigation (use deep-research) unless the task includes writing or reviewing Java code.
---

# Java Stack Craft

Produce Java that is **modern for its JDK**, **consistent with the project**, **architecturally appropriate** (patterns serve real variation points, never decoration), and **risk-prioritized**. Gates run in order: detect version → conform to conventions → route by production risk → pick idioms/patterns → verify/review. Treat the rules as strong defaults with explainable exceptions; correctness, security, compileability, and concurrency safety are the hard lines.

## Operating Language

Use these Leitwörter exactly; avoid synonyms that blur the gates.

- **Target Profile**: detected JDK, Spring Boot version, namespace, web stack, and module boundary.
- **Project Convention**: observed local style or framework pattern that governs the edit unless it creates a defect.
- **Risk Signal**: scanner hit, command output, diff, or code read that points to possible risk, not an action by itself.
- **Failure Path**: concrete compile, security, correctness, concurrency, resource, runtime, or data-integrity failure that justifies action.
- **Action Candidate**: bounded fix or review finding competing for the next edit or report slot.
- **Proof Tier**: P0-P4 verification strength from [RISK_ROUTER.md](RISK_ROUTER.md#proof-tiers).
- **Verification Floor**: the minimum command, source check, or degraded proof needed before reporting completion.

## Step 1 - Detect the target JDK first (mandatory, once per project)

Never guess the JDK level. Run the detector **once per project per session** and remember its result (effective JDK, Spring Boot version, `jakarta`/`javax`); only re-run when a build file changes — do not re-run before every edit.

```bash
python3 scripts/detect_java_profile.py --dir . --format markdown
```

On Windows use `python` or `py` if `python3` is unavailable. Pass `--dir <project-root>` when the project is not the current directory. The script is stdlib-only — no extra install needed.

The manifest splits features into **use freely** (final at the target), **preview only** (needs `--enable-preview`; do not emit unless the user opts in), **never use** (withdrawn, e.g. string templates), and **not available** (too new). It also reports the **Spring Boot version and the `jakarta`/`javax` namespace** to use (Step 2). On a multi-module project it warns when modules differ; shared code must compile on the **lowest** version. If no build file is found, ask the user for the target JDK rather than defaulting silently. For the full version→feature reasoning see [REFERENCE.md](REFERENCE.md#jdk-feature-matrix).

## Step 2 - Conform to the project's conventions before applying any default

The defaults below are illustrations of principles, not a house style to impose. Detect what the project already does by reading existing code, and match it — error handling, DTO mapping, package layout (by-feature vs by-layer), naming, config, and test idioms.

If the project uses a framework, detect and follow its conventions first. **Spring Boot projects: actually open and read [SPRING_BOOT.md](SPRING_BOOT.md) before writing or reviewing Spring code** — don't work from memory. It covers the entry style (REST / MVC / WebFlux / GraphQL / messaging / none — never convert one into another), validation approach, and the proxy/transaction/bean rules. The compile-critical `jakarta`/`javax` namespace gate and the web stack (MVC / WebFlux / **mixed**) are already reported by the Step 1 detector; trust the detector for those two facts — they do not require reading SPRING_BOOT.md.

When conventions are absent or inconsistent, prefer the principles below and say which default you chose. For formatting (naming case, import order, column width, brace style), follow and run the project's formatter (google-java-format / Spotless / the P3C plugin) rather than hand-aligning or encoding style rules here.

**Precedence when this gate conflicts with the Step 5 quality defaults:** an established project convention wins for *style/structure* (mutable setters, by-layer packaging, a particular mapping approach) — match it, don't crusade. The Step 5 bar wins only when the convention causes a *correctness, concurrency, or security* defect (e.g. shared mutable state on a singleton, swallowed exceptions, blocking I/O on `ForkJoinPool.commonPool`); fix those and say why. When *writing new* code, match the style convention but do **not** propagate a convention that is itself such a defect — use the correct form for the new code and note the divergence. State the conflict either way.

## Step 2.5 - Route by risk, then choose the mode file

- **Risk routing:** read [RISK_ROUTER.md](RISK_ROUTER.md) for non-trivial work before selecting a fix or ranking findings. Scanner hits and generic best practices are signals, not actions; prefer concrete security, correctness, concurrency, build/runtime, and data-integrity risk over maintainability/style cleanup.
- **Optional repo profile:** for repeated or non-trivial work in the same repo, or when `docs/agents/java-stack-profile.md` / `docs/agents/java-stack-review-memory.md` exists, read [PROFILE.md](PROFILE.md). Read the repo profile for writing and review; read review memory for review, noisy maintainability cleanup, or explicit memory updates. These files are soft dependencies: use them to sharpen context and reduce review noise, but verify load-bearing facts from build files, code, and commands.
- **Writing/editing/refactoring:** read [WRITING.md](WRITING.md) before editing. It defines smoke patch vs production fix vs architecture fix, dirty-worktree handling, advisory scanning, and the writing output contract.
- **Reviewing:** read [REVIEW.md](REVIEW.md) before reporting findings. It defines diff review vs focused review vs repo audit, evidence levels, severity calibration, and the review output format.
- **Optional advisory scan:** for non-trivial Spring/Java stack work, run `python3 scripts/java_advisory_scan.py --dir . --format markdown`. The scan is a Risk Signal index, not an oracle; confirm important findings from code and context. Markdown output is bounded by default; use `--detail-limit 0` only when the full table is worth the noise. It emits Proof Tiers, exits 0 by default, and only gates when called with `--fail-on`.

## Step 3 - Write to the version, not below it

Use the highest *final* idiom the target allows; do not ship Java-8-style code into a Java-21 project, and do not emit Java-21 syntax into a Java-11 project.

- **Collections/transforms**: Stream + `Collectors` for map/filter/group; a plain `for` loop when it is clearer or hot-path. Don't `stream()` a loop that a plain `for` reads more clearly.
- **Data carriers**: `record` (J16+) for DTOs, value objects, events, query results; immutable class with a builder below J16.
- **Type dispatch**: pattern-matching `switch` over `sealed` types (J21+) instead of `instanceof` chains or visitor boilerplate.
- **Nullability**: `Optional` for return values only — never fields, parameters, or collections; return empty collections, not `null`.
- **Concurrency**: virtual threads (J21+) for blocking I/O fan-out; do not pool them; prefer immutability over locks.
- **Strings/SQL/JSON**: text blocks (J15+). **Never** string templates — withdrawn in J23.

Avoid the high-frequency language traps (wrapper `==`, `BigDecimal(double)`, for-each mutation, `Executors.*` pools, `SimpleDateFormat`, `return` in `finally`, …) listed in [REFERENCE.md](REFERENCE.md#common-pitfalls).

## Step 4 - Patterns serve variation points, not the reverse

Apply a pattern only when there is **>= 2 real, present variation points** (or a documented near-term one). Otherwise inline it — premature abstraction is the more common defect in agent-written Java.

| Use when | Pattern | Spring-idiomatic form |
|---|---|---|
| Runtime branch set that grows (payment/notify type) | Strategy / Factory | inject `Map<String, Handler>`; pick by key, kill the if-else |
| Many optional params, or required immutability of a wide object | Builder | `@Builder` / static factory; not for a small record |
| Fixed skeleton, variable steps | Template Method | abstract base or a callback param |
| Cross-cutting concern (tx, log, retry) | Decorator / AOP | Spring AOP / `@Transactional`, not hand-rolled |

Anti-patterns to reject: interface with one permanent implementation, strategy for a single algorithm, singleton used as a global mutable, decorator stacks on anemic objects, design-pattern names in class names with no behavior. See [REFERENCE.md](REFERENCE.md#pattern-decision-rules); Spring DI forms in [SPRING_BOOT.md](SPRING_BOOT.md).

## Step 5 - Extensibility & quality bar (review every change against this)

- **Depend on abstractions**: program to interfaces; prefer constructor injection and explicit dependencies for new or touched Spring code. In legacy code, apply the field-injection policy in [RISK_ROUTER.md](RISK_ROUTER.md#scanner-calibration).
- **Layering**: keep entry → service → persistence boundaries clean (names vary by project); no SQL or transport types leaking across boundaries; map persistence entities to DTOs/models at the edge.
- **Put new code where it's cohesive**: add it to the type whose responsibility it already shares (often an existing owner) — but split off a new focused type when piling on would bloat a class or mix concerns (cohesion beats reuse). Either way, don't create an accidental parallel/duplicate of something that exists, and match where sibling types live, including which module in a multi-module build (published API types on the api/facade module, internal projections in the service module).
- **Immutability first**: `final` fields, `record`s, unmodifiable collections; copy on input/output of mutable state.
- **Stateless shared singletons**: DI-managed components are typically singletons — never hold per-request/per-call state in mutable instance fields (a top concurrency bug). Pass state as parameters or keep it in locals. (Spring specifics: SPRING_BOOT.md.)
- **Concurrency & performance**: prefer immutability and no shared mutable state; when sharing is unavoidable use the right tool (`volatile`/`Atomic*`/concurrent collection/lock, atomic compound ops); size pools by CPU vs I/O; mind the virtual-thread pinning version gate (J21-23 vs J24+); **measure before optimizing**. Full rules: [REFERENCE.md](REFERENCE.md#concurrency--performance).
- **Fail loud, fail typed**: specific exceptions, never swallow; no empty `catch`; validate inputs at the boundary; no `e.printStackTrace()` — log via SLF4J with parameterized messages.
- **Open for extension**: new behavior should be a new class/strategy, not an edit to a growing switch — but only once the variation point is real.
- **Naming & cohesion**: intention-revealing names, small focused methods, one reason to change per class.
- **Tests track behavior**: add or update unit tests for changed logic (JUnit 5); constructor injection keeps classes mockable without spinning up the container.

Check every change against [REFERENCE.md](REFERENCE.md#review-checklist) (and [SPRING_BOOT.md](SPRING_BOOT.md#step-c-spring-review-checklist) on Spring projects): when *writing*, rewrite once if a relevant item fails; when *reviewing*, turn failures into prioritized findings. Concrete before/after by JDK level: [EXAMPLES.md](EXAMPLES.md).

## Output contracts

- **Language:** use the user's language for chat, findings, and saved reports; keep code identifiers, commands, and file paths as-is.
- **Writing:** follow [WRITING.md](WRITING.md#step-w5-report-the-result). Scale the report to the change; do not recite irrelevant checklist items.
- **Review:** follow [REVIEW.md](REVIEW.md#step-r5-output-findings). Report findings, not a rewrite, unless the user asks for patches.
