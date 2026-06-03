# Java Stack Craft - Reference

Detailed reasoning behind the SKILL.md gates. The `scripts/detect_java_profile.py` manifest is the source of truth for *what* is available; this file is the *why* and the judgment calls.

## JDK feature matrix

The authoritative feature → version → JEP map lives in **one place**: `scripts/detect_java_profile.py` (`FINAL_FEATURES` / `PREVIEW_FEATURES` / `WITHDRAWN_FEATURES`). Step 1 runs it and prints, for the *detected* target, what is **use-freely** (final, with its JEP), **preview-only**, **withdrawn**, and **not-yet-available** — so this file deliberately keeps **no parallel table** (one source = no drift). On a new JDK release, edit only that list. "LTS" anchors: 8, 11, 17, 21, 25.

Two headline gates worth memorizing (the script enforces both with exact versions/JEPs):
- **`record` (J16), `sealed` (J17), and virtual threads + pattern-matching `switch` + record patterns (J21)** are the modern-Java backbone — don't ship below-target verbosity into a project that allows them.
- **String templates (`STR."..."`) are withdrawn — removed in J23; never emit them on any version.** Structured concurrency is still preview through J25 (opt-in only). Virtual-thread `synchronized` pinning is fixed in **J24 (JEP 491)**; on J21–23 use `ReentrantLock` for blocking sections.

### Version-targeting rule
- Write to the **target**, not the latest you know. A J11 project must not get `record` or `switch` patterns.
- Multi-module: code shared across modules must compile on the **lowest** target the manifest reports.
- Preview features only with explicit user opt-in *and* build config for `--enable-preview`.

## Pattern decision rules

The dominant defect in agent-written Java is **over-engineering**: abstractions with one implementation, factories for one product, layers of indirection around trivial logic. The bar:

> Introduce an abstraction only when there are **two or more real, present variation points**, or one variation point the user has explicitly said is coming. One implementation = inline it.

| Force in the code | Right tool | Wrong tool |
|---|---|---|
| Set of runtime branches keyed by a value, and the set grows | Strategy injected as `Map<String, T>` (Spring auto-populates by bean name) | giant `if/else`/`switch`, or strategy for a single case |
| Object with many optional fields, must be immutable | Builder / static factory | telescoping constructors; builder for a 2-field record |
| Algorithm skeleton fixed, a couple of steps vary | Template Method or a passed callback/`Function` | copy-pasted methods; deep inheritance trees |
| Cross-cutting concern (transaction, retry, cache, audit) | Spring AOP / `@Transactional` / `@Cacheable` | hand-rolled decorator chains |
| Choosing one collaborator at startup by config/profile | DI + `@Conditional`/`@Profile` | reflection-based service locators, manual singletons |
| Building one complex aggregate from parts | Factory method | exposing a half-built mutable object |

Reject on sight: `*Manager`/`*Helper`/`*Util` god classes, `AbstractFactoryProviderImpl`-style naming with no behavior, singletons holding mutable state, an interface created "for testability" when a constructor-injected concrete class would mock fine, inheritance used for code reuse instead of composition.

## Common pitfalls

Deterministic bug-preventers — high-frequency defects in agent-written Java. These are rules, not judgment calls — apply them every time. (Distilled from Google Java Style and Alibaba P3C; dated/format-only rules deliberately excluded.)

**Equality & numbers**
- Compare wrapper objects (`Integer`, `Long`, ...) with `.equals()`, never `==` — `==` only works by accident inside the -128..127 cache.
- Start `equals` from a constant or known-non-null side: `"ACTIVE".equals(status)`, not `status.equals("ACTIVE")`.
- Override `hashCode` whenever you override `equals` (mandatory for `Set` elements and `Map` keys).
- Never `new BigDecimal(double)` (precision loss) — use `new BigDecimal("0.1")` or `BigDecimal.valueOf(d)`; compare with `compareTo`, not `equals`.
- Never compare floating-point with `==`; use a tolerance or `BigDecimal`.

**Collections & streams**
- Do not add/remove elements inside a `for-each` loop — use `Iterator.remove()` or `removeIf`, else `ConcurrentModificationException`.
- `Arrays.asList(...)` is fixed-size: `add`/`remove` throw `UnsupportedOperationException`; wrap in `new ArrayList<>(...)` if you must mutate.
- `collection.toArray()` (no arg) returns `Object[]` — use `toArray(new T[0])`.
- **Never discard a stream result.** `list.stream().sorted()/filter()/map()...collect(...)` returns a *new* value and never mutates the source — a `sorted().collect()` whose result is ignored is a silent no-op (e.g. you keep using the original unsorted list). Assign and use it.
- Do not `.get(0)` / `iterator().next()` a list that can be empty (`IndexOutOfBoundsException`/`NoSuchElementException`); guard with `isEmpty()` or use `stream().findFirst()`. A later `== null` check is dead code if `.get(0)` already threw.

**Concurrency**
- Create thread pools with an explicit `ThreadPoolExecutor` (named `ThreadFactory`, bounded queue), **not** `Executors.newFixed/Cached/SingleThread*` — their unbounded queues/thread counts cause OOM. *Exception:* J21+ `Executors.newVirtualThreadPerTaskExecutor()` for blocking-I/O fan-out is correct (and must not be pooled).
- Always `ThreadLocal.remove()` in a `finally` when the thread may be reused from a pool (leak otherwise); prefer scoped values on J25+.
- Acquire a `Lock` outside the `try`, and put `unlock()` as the first line of `finally`.
- `SimpleDateFormat`/`Date`/`Calendar` are not thread-safe — use `java.time` (`DateTimeFormatter`, `Instant`, `LocalDate`); these are immutable and safe to share.
- Never swallow `InterruptedException` — restore it with `Thread.currentThread().interrupt()` (or propagate). A broad `catch (Exception e)` around a lock's `tryLock()`/`await()`/`sleep()` silently eats the interrupt; catch it explicitly and restore.

**Control flow & misc**
- Never `return`/`break`/`continue` from a `finally` block — it swallows exceptions and discards the `try` result.
- Add `@Override` wherever it is legal (catches signature drift at compile time).
- Precompile regex as a `static final Pattern` constant; do not `Pattern.compile` inside a method body or loop.
- Concatenate in a loop with `StringBuilder`, not `+` (each `+` allocates).
- SLF4J: the number of `{}` placeholders must equal the number of arguments (a `{}` with no matching arg prints literally); pass a `Throwable` as the *last* argument (not concatenated into the message) so the stack trace is logged.
- Prefer pre-checks over catching `RuntimeException` for control flow (guard a possible NPE/index instead of wrapping in try-catch) — but keep exceptions where they genuinely signal failure; do not over-correct into catch-free code.

## Concurrency & performance

Correctness first; **measure before optimizing** (these rules prevent bugs and obvious waste, not micro-tuning — do not over-optimize speculatively).

**Thread safety**
- Default to **no shared mutable state**: immutable objects (`final` fields, `record`) and method-local variables are free of data races and can be shared safely. Reach for synchronization only when sharing mutable state is unavoidable.
- Cross-thread visibility is not free: a field read/written by multiple threads needs `volatile`, `synchronized`, an `Atomic*`, or a concurrent collection to establish happens-before — a plain field can read stale forever.
- Pick the lightest tool: single-writer flag/reference → `volatile`; read-modify-write counter → `Atomic*` (lock-free CAS); multiple fields that must stay consistent → a lock.
- Safe publication: publish references via `final`/`volatile`/concurrent collections; never let `this` escape from a constructor.

**Use the library, do not hand-roll**
- `ConcurrentHashMap` over `synchronized`/`Hashtable`; but get-then-put is a race — use `compute`/`merge`/`putIfAbsent` for compound updates.
- Read-mostly small list → `CopyOnWriteArrayList`; producer/consumer → `BlockingQueue`; counters/limits → `Atomic*`/`Semaphore`; async composition → `CompletableFuture` (with an explicit executor, never blocking the common pool).
- Prefer `synchronized` for simple mutual exclusion; use `ReentrantLock` only when you need timeout/interruptible/fairness/multiple conditions; read-heavy → `ReadWriteLock`/`StampedLock`. Always lock outside `try`, `unlock()` in `finally`.

**Thread pools & virtual threads**
- Size platform pools by workload — these are *starting points*, then tune by measured latency/throughput: CPU-bound ≈ cores + 1; I/O-bound larger (or use virtual threads). Always a bounded queue, an explicit rejection policy, and a named `ThreadFactory`; shut down with `shutdown()` + `awaitTermination()`. (Pool creation via `ThreadPoolExecutor`, not `Executors.*` — see Common pitfalls.)
- Virtual threads (J21+): one per task (`newVirtualThreadPerTaskExecutor`), **never pooled**; cap concurrency with a `Semaphore`, not a smaller pool. **Version gate:** on **J21-23** blocking inside `synchronized` pins the carrier — use `ReentrantLock` for blocking sections; on **J24+** (JEP 491) this is fixed. Under millions of virtual threads `ThreadLocal` cost is amplified → prefer scoped values (J25 final).

**Performance**
- Reduce lock contention: shrink critical sections, narrow lock scope, use concurrent collections instead of coarse locks; never call an unknown/alien method while holding a lock (deadlock + blocking risk).
- Reduce allocation/GC pressure: `StringBuilder` in loops; avoid autoboxing in hot paths (primitives, `IntStream`); reuse expensive thread-safe singletons (`Pattern`, Jackson `ObjectMapper`).
- `parallelStream` only for CPU-bound, large, side-effect-free, non-blocking work — it uses the shared `ForkJoinPool`; in request paths default to sequential.
- Backend hotspots: eliminate **N+1 queries** (batch/join), batch writes, cache with bounded size, apply backpressure (bounded queues) — avoid unbounded buffering.

**Classic concurrency bugs**
- Double-checked locking: the field **must** be `volatile`; better, use the static holder idiom or an enum singleton.
- check-then-act races: `if (!map.containsKey) map.put(...)`, or `size()` then act — use the atomic method instead.
- Shared `SimpleDateFormat`/`Random` are unsafe → `DateTimeFormatter` (immutable) / `ThreadLocalRandom`; deadlock prevention → global lock ordering and `tryLock` timeouts.

## Review checklist

Run after every Java change; rewrite once if any line fails.

**Version fit**
- [ ] Used the highest *final* idiom the target JDK allows; no below-target verbosity, no above-target syntax.
- [ ] No preview/withdrawn feature emitted (string templates especially).

**Architecture**
- [ ] Every new interface/abstraction maps to >= 2 real variation points; otherwise inlined.
- [ ] Constructor injection, not field injection; dependencies are `final`.
- [ ] Layer boundaries intact: no JPA entities or web types crossing into other layers; DTO mapping at the edge.
- [ ] Composition over inheritance; no deep hierarchies for reuse.

**Correctness & safety**
- [ ] No swallowed exceptions; specific exception types; inputs validated at the boundary.
- [ ] `Optional` only as a return type; collections returned empty, never `null`.
- [ ] Immutable where possible (`final`, `record`, unmodifiable collections); no shared mutable state without explicit synchronization.
- [ ] Shared singletons / DI-managed components are stateless — no mutable instance fields holding per-call state.
- [ ] Shared mutable state uses the right tool (`volatile`/`Atomic*`/concurrent collection/lock); compound ops on `ConcurrentHashMap` are atomic; no check-then-act races. (See Concurrency & performance.)
- [ ] Virtual threads (if J21+) not pooled; on J21-23 no blocking inside `synchronized` (use `ReentrantLock`); concurrency capped with a `Semaphore`.
- [ ] Streams are pure (no side effects in `map`/`filter`); no `parallelStream()` without a measured reason.
- [ ] Logging via SLF4J with parameterized messages (`log.info("x={}", x)`); no `System.out`/`printStackTrace`; no log-and-rethrow.
- [ ] Resources closed with try-with-resources.
- [ ] None of the Common pitfalls above present (wrapper `==`, `BigDecimal(double)`, for-each mutation, `Executors.*` pools, unremoved `ThreadLocal`, `SimpleDateFormat`, `return` in `finally`, etc.).

**Tests**
- [ ] Changed behavior has matching unit tests (JUnit 5); meaningful assertions, not just "no exception".
- [ ] Tests construct the class directly via constructor injection; no field-injection-only design that forces a container.

**Clarity**
- [ ] Intention-revealing names; methods small and single-purpose; one reason to change per class.
- [ ] No dead abstraction layers, no speculative generality (YAGNI).

## Framework layers

This file is language-level Java. Framework-specific rules live in their own file so they load only when relevant:
- **Spring Boot** (convention detection, `jakarta`/`javax` namespace, proxy/transaction/bean rules, examples): [SPRING_BOOT.md](SPRING_BOOT.md).
