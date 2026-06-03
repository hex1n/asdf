# Java Stack Craft - Spring Boot Layer

Load this file when the project depends on Spring Boot (`spring-boot-starter*` in the build file). The language-level rules live in [REFERENCE.md](REFERENCE.md); this file adds the framework layer on top of them. If the project is plain Java with no Spring, ignore this file.

## Step A: Detect the Spring Boot version and conventions first

The rules below are illustrations of principles, not a house style to impose. Detect what the project already does and match it.

**Spring Boot major version → EE/validation namespace (compile-critical):**
- Boot **3.x → `jakarta.*`** (`jakarta.validation`, `jakarta.persistence`, `jakarta.servlet`).
- Boot **2.x → `javax.*`**.
- **`detect_java_profile.py` (Step 1) reports this** as `spring_boot` / `namespace`; trust it. If absent (e.g. version set via a property placeholder), fall back to the `spring-boot-starter-parent` version, the `spring-boot-dependencies` BOM, or existing imports. The wrong namespace does not compile — treat this like the JDK version gate.

**Web/entry style — match what exists, never convert one into another:**

| Style | Tell-tale | Boundary you write |
|---|---|---|
| REST | `@RestController`, `@*Mapping`, JSON DTOs | request/response DTOs, `ResponseEntity` if used elsewhere |
| Server-side MVC | `@Controller` returning view names, Thymeleaf/JSP | model attributes + view, form-backing objects |
| Reactive WebFlux | `Mono`/`Flux`, `RouterFunction` | reactive types end-to-end; never block |
| GraphQL | `@QueryMapping`/`@SchemaMapping` | schema-mapped methods, input types |
| Messaging | `@KafkaListener`/`@RabbitListener`/`@JmsListener` | message payload + ack/retry semantics |
| Batch / scheduled | `@Scheduled`, Spring Batch `Job`/`Step` | tasklet/chunk or scheduled method |
| No web layer | library/service module only | public service API; no transport types |

**Validation approach — may not be Bean Validation at all:** the project may validate with `@Valid` annotations, manually in the service, or via domain-model invariants. Follow the existing approach. The transferable principle is **validate at the boundary and keep persistence entities from leaking out**, regardless of mechanism.

**Other conventions to mirror, not invent:** error handling (`@ControllerAdvice`/`@ExceptionHandler` vs per-call vs `Result`-type returns), DTO mapping (MapStruct vs manual vs records), package layout (by-feature vs by-layer), config (`@ConfigurationProperties` vs `@Value`), build/test idioms.

When conventions are absent or inconsistent, prefer the principles below and state which default you chose.

## Step B: Spring Boot principles (apply within the project's style)

- **Constructor injection only** — never field `@Autowired`. A single-constructor bean needs no annotation; dependencies are `final` and the class is unit-testable without a container.
- **Beans are singletons by default — keep them stateless.** Never hold per-request/per-call state in mutable instance fields (a top concurrency bug). Per-request state goes in method params, request scope, or scoped values.
- **Proxy-based annotations require external calls.** `@Transactional`/`@Async`/`@Cacheable` only take effect on `public` methods invoked *through the bean's proxy*. A `this.otherMethod()` self-call silently bypasses the proxy (no transaction, no async, no cache). Call through the injected bean or restructure.
- **Transactions at the service layer**, never on controllers or private methods; keep transaction scope tight. Set `@Transactional(rollbackFor = Exception.class)` (or a specific checked type) — by default Spring only rolls back on unchecked exceptions, so a checked exception commits a half-done transaction.
- **Typed configuration** via `@ConfigurationProperties` (records on Boot 3) when the project centralizes config that way; do not sprinkle `@Value` if typed config already exists.
- **Do not leak persistence entities across the entry boundary** — map to DTOs/models, whatever the project's edge is (REST body, view model, message payload, GraphQL type).
- **Log with SLF4J** (`private static final Logger log = LoggerFactory.getLogger(X.class)`), parameterized messages; do not log-and-rethrow the same exception.
- **Concurrency**: framework infrastructure beans are thread-safe and meant to be shared singletons — reuse one `ObjectMapper`/`RestTemplate`/`WebClient`, do not create per request. `@Async` needs an explicit, bounded `Executor` bean (do not rely on the default `SimpleAsyncTaskExecutor`); `@Async`/`@Scheduled` follow the same proxy rule (no self-invocation). In WebFlux never block the event loop (`block()`, blocking JDBC, `Thread.sleep`); offload to `boundedElastic` or use reactive drivers. General concurrency rules: [REFERENCE.md](REFERENCE.md#concurrency--performance).

## Step C: Spring review checklist

Run alongside the language-level checklist in [REFERENCE.md](REFERENCE.md#review-checklist).

- [ ] Validation/EE namespace matches the Boot version (`jakarta.*` on 3.x, `javax.*` on 2.x).
- [ ] Entry style matches the project's existing style; no REST imposed on an MVC/messaging/WebFlux codebase.
- [ ] Constructor injection; no field `@Autowired`; dependencies `final`.
- [ ] Singleton beans are stateless — no mutable instance fields holding request/call state.
- [ ] No proxy self-invocation of `@Transactional`/`@Async`/`@Cacheable`.
- [ ] `@Transactional` only on public service methods; not on controllers or private methods.
- [ ] `@Transactional` sets `rollbackFor` so checked exceptions also roll back.
- [ ] Persistence entities do not cross the entry boundary; mapped to DTOs/models.
- [ ] Logging via SLF4J parameterized messages; no `System.out`/`printStackTrace`.
- [ ] Infra beans (`ObjectMapper`/`RestTemplate`/`WebClient`) reused as singletons; `@Async` uses an explicit bounded executor; no blocking calls on a WebFlux event loop.

## Examples

### Replace a growing if-else with injected strategies (Spring DI)
```java
// BAD: switch that grows with every new channel
void notify(String channel, Message m) {
    switch (channel) {
        case "email" -> emailSender.send(m);
        case "sms"   -> smsSender.send(m);
        case "push"  -> pushSender.send(m);   // every new channel edits this method
    }
}

// GOOD: Strategy + DI. New channel = new bean, zero edits here. (>= 2 variation points, real)
interface NotificationSender { String channel(); void send(Message m); }

@Service
class NotificationService {
    private final Map<String, NotificationSender> byChannel;
    NotificationService(List<NotificationSender> senders) {     // constructor injection
        this.byChannel = senders.stream()
                .collect(Collectors.toUnmodifiableMap(NotificationSender::channel, s -> s));
    }
    void notify(String channel, Message m) {
        var sender = byChannel.get(channel);
        if (sender == null) throw new UnknownChannelException(channel);
        sender.send(m);
    }
}
```

### Constructor injection, typed exceptions, no null
```java
// BAD: field injection, swallowed exception, null return
@Service
class OrderService {
    @Autowired private OrderRepository repo;
    Order find(String id) {
        try { return repo.findById(id).orElse(null); }
        catch (Exception e) { return null; }      // hides failures, forces null checks
    }
}

// GOOD
@Service
class OrderService {
    private final OrderRepository repo;
    OrderService(OrderRepository repo) { this.repo = repo; }   // explicit, testable

    Order find(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));  // typed, loud
    }
}
```

### Boundary mapping & validation — conform to the project's style

The principle is **validate at the entry boundary and never leak persistence entities out** — independent of web style or validation library. The snippets are illustrations; detect the project's style first.

```java
// IF the project is REST + Bean Validation.
// NOTE namespace: Spring Boot 3.x -> jakarta.validation.*, Boot 2.x -> javax.validation.*
record CreateOrderRequest(
        @NotBlank String sku,
        @Positive int quantity) {}

@PostMapping("/orders")
ResponseEntity<OrderResponse> create(@Valid @RequestBody CreateOrderRequest req) {
    Order order = orderService.place(req.sku(), req.quantity());
    return ResponseEntity.status(CREATED).body(OrderResponse.from(order)); // DTO out, not entity
}
```

The same principle in a **non-REST** project — e.g. a Kafka consumer with service-layer validation (no Bean Validation):
```java
@KafkaListener(topics = "orders")
void onOrder(OrderMessage msg) {
    orderService.place(msg.sku(), msg.quantity());   // validate inside place(); entity stays in the service
}

// service enforces the invariant itself, since this project does not use @Valid
Order place(String sku, int quantity) {
    if (sku == null || sku.isBlank()) throw new IllegalArgumentException("sku required");
    if (quantity <= 0) throw new IllegalArgumentException("quantity must be positive");
    ...
}
```
