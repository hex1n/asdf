# Java Stack Craft - Examples

Concrete before/after, organized by the gate that fires. Each shows the *defect* agents commonly produce and the *version-appropriate* fix.

## 1. Write to the version

### Java 8 target — modernize loops, but no records/switch-patterns
```java
// BAD (pre-8 idiom in an 8 project)
List<String> names = new ArrayList<>();
for (User u : users) {
    if (u.isActive()) names.add(u.getName());
}
// GOOD (J8 final features only)
List<String> names = users.stream()
        .filter(User::isActive)
        .map(User::getName)
        .collect(Collectors.toList());   // toList() helper is J16; this project is J8
```

### Java 17 target — use record + switch expression
```java
// BAD: mutable DTO + instanceof chain in a J17 project
class PriceResult { private BigDecimal amount; /* getters/setters */ }

String describe(Shape s) {
    if (s instanceof Circle) { Circle c = (Circle) s; return "circle " + c.radius(); }
    else if (s instanceof Square) { Square sq = (Square) s; return "square " + sq.side(); }
    return "unknown";
}

// GOOD: record + pattern matching for instanceof (J16) + switch expr (J14)
record PriceResult(BigDecimal amount) {}   // immutable data carrier, replaces the mutable class

String describe(Shape s) {
    if (s instanceof Circle c) return "circle " + c.radius();
    if (s instanceof Square sq) return "square " + sq.side();
    return "unknown";
}
```

### Java 21 target — sealed + exhaustive switch + record patterns + virtual threads
```java
// GOOD (J21): closed hierarchy, exhaustive switch, deconstruction
sealed interface Event permits OrderPlaced, OrderShipped {}
record OrderPlaced(String id, BigDecimal total) implements Event {}
record OrderShipped(String id, Instant when) implements Event {}

String handle(Event e) {
    return switch (e) {                       // no default needed: exhaustive over sealed
        case OrderPlaced(var id, var total) -> "placed " + id + " " + total;
        case OrderShipped(var id, var when)  -> "shipped " + id + " at " + when;
    };
}

// Virtual threads for blocking I/O fan-out (J21) — do NOT pool them
List<Result> results = new ArrayList<>();
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {  // close() awaits all tasks
    var futures = ids.stream()
            .map(id -> executor.submit(() -> client.fetch(id)))
            .toList();
    for (var f : futures) {
        results.add(f.get());   // get() throws InterruptedException/ExecutionException — handle/propagate
    }
}
```

### Never use (any version)
```java
// BAD: string templates were REMOVED in JDK 23
String msg = STR."Hello \{name}";
// GOOD
String msg = "Hello %s".formatted(name);
```

## 2. Patterns serve variation points

For the Spring DI form of Strategy (inject `Map<String, Handler>` to kill a growing switch), see [SPRING_BOOT.md](SPRING_BOOT.md#examples). The language-level lesson below is the one agents get wrong most often: **not** abstracting.

### Do NOT over-engineer (the more common agent defect)
```java
// BAD: interface + factory + strategy for ONE implementation that will never vary
interface DiscountStrategy { BigDecimal apply(BigDecimal p); }
class DefaultDiscountStrategy implements DiscountStrategy { /* the only impl, ever */ }
class DiscountStrategyFactory { DiscountStrategy create() { return new DefaultDiscountStrategy(); } }

// GOOD: just write the method. Abstract later when a second rule actually appears.
BigDecimal applyDiscount(BigDecimal price) {
    return price.multiply(new BigDecimal("0.9"));
}
```

## 3. Extensibility & safety (plain Java)

### Constructor injection, typed exceptions, no null
```java
// BAD: swallowed exception, null return — forces null checks on every caller
class OrderService {
    private final OrderRepository repo;
    OrderService(OrderRepository repo) { this.repo = repo; }

    Order find(String id) {
        try { return repo.findById(id).orElse(null); }
        catch (Exception e) { return null; }      // hides failures
    }
}

// GOOD: typed, loud, no null
class OrderService {
    private final OrderRepository repo;
    OrderService(OrderRepository repo) { this.repo = repo; }   // explicit deps, unit-testable

    Order find(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }
}
```

For framework-flavored versions (field-injection fix, `@Service`, boundary mapping/validation across REST vs messaging), see [SPRING_BOOT.md](SPRING_BOOT.md#examples).

## 4. Common pitfalls (highest-frequency)

Full list in [REFERENCE.md](REFERENCE.md#common-pitfalls); the three agents trip on most:

```java
// Wrapper == : works only inside the -128..127 cache, then silently breaks
Integer a = 1000, b = 1000;
if (a == b) { ... }              // BAD: false at runtime
if (a.equals(b)) { ... }         // GOOD (or compare primitive long/int)

// BigDecimal: double constructor loses precision; equals is scale-sensitive
new BigDecimal(0.1);             // BAD: 0.1000000000000000055511...
new BigDecimal("0.1");           // GOOD (or BigDecimal.valueOf(0.1))
new BigDecimal("1.0").equals(new BigDecimal("1.00"));   // BAD: false (different scale)
new BigDecimal("1.0").compareTo(new BigDecimal("1.00")) == 0;  // GOOD: true

// Mutating a collection inside for-each -> ConcurrentModificationException
for (Order o : orders) { if (o.isStale()) orders.remove(o); }   // BAD
orders.removeIf(Order::isStale);                                 // GOOD
```

## 5. Concurrency

Full rules in [REFERENCE.md](REFERENCE.md#concurrency--performance); the two patterns that bite most:

```java
// check-then-act on a ConcurrentHashMap is NOT atomic across the two calls
if (!cache.containsKey(k)) cache.put(k, load(k));   // BAD: two threads both load
cache.computeIfAbsent(k, this::load);               // GOOD: atomic, loads once

// Lazy singleton: static holder idiom — thread-safe, lazy, no locking, no volatile DCL
class Config {
    private Config() {}
    private static class Holder { static final Config INSTANCE = new Config(); }
    static Config get() { return Holder.INSTANCE; }  // JVM guarantees safe class-init
}
```

## 6. Review output (what a finding looks like)

In Review mode, report findings — don't rewrite. One finding = `severity · file:line · rule · one-line fix`, ordered blocker-first. Example over the discarded-stream bug:

```
Blocker · OrderService.java:174 · stream result discarded (no-op sort)
  plans.stream().sorted(comparing(Plan::getTerm)).collect(toList());  // result thrown away
  Code below keeps using the ORIGINAL unsorted `plans` → wrong order.
  Fix: plans = plans.stream().sorted(comparing(Plan::getTerm)).collect(toList());

Major · OrderService.java:106-145 · field injection (20+ @Autowired)
  Prefer constructor injection. NOTE: pervasive project convention (3k+ uses) —
  apply to new/changed code only; do not mass-rewrite. (style→convention wins)

Minor · OrderService.java:493 · SLF4J placeholder/arg mismatch
  log.info("applyNo:{}, productId:{}", applyNo);  // 2 placeholders, 1 arg
  Fix: pass productId too, or drop the placeholder.
```

Note how the Major is *flagged but de-escalated* because it matches an established convention (Step 2 precedence), while the Blocker — a correctness defect — is not.
