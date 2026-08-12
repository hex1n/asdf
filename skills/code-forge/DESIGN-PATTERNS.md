# Design patterns by force

Read this reference after the evidence criterion in `SKILL.md` proves a force that
direct code cannot keep local. Use each row's invariant to choose the smallest valid
expression.

| Observable forces | Pattern and invariant | Direct expression remains sufficient when |
|---|---|---|
| Policies vary independently behind one stable operation | **Strategy**: isolate each policy and keep selection explicit | A small closed set in one local branch tells the whole story |
| Valid commands and transitions depend on lifecycle state | **State** or explicit state machine: centralize allowed behavior and make invalid transitions visible | State changes only label data; allowed behavior stays the same |
| A foreign or legacy contract differs from the domain | **Adapter**; use an anti-corruption layer for broader translation: contain foreign types, units, errors, and semantics at one boundary | The foreign contract already matches the domain without translation |
| Construction selects variants or must enforce invariants | **Factory** or named creator; use **Builder** for staged readable assembly: every creation path returns a valid object | A constructor or static creator states every invariant clearly |
| Multiple independent optional concerns compose around one operation and their combination or order varies, or the repository already exposes that pipeline seam | **Decorator** or the existing pipeline: keep each concern independent and make composition order visible | One concern or a small closed set has fixed order and remains local to the operation owner |
| An operation has identity, input, and its own queue/cancel/replay/status lifecycle | **Command**: represent immutable intent; add separate persistence, idempotency, and progress semantics when execution must survive failure | The operation executes immediately and has no independent lifecycle |
| Multiple independent in-process reactions follow one fact | **Observer** or domain events: publish the fact and define handler isolation | One owner must complete all reactions atomically |
| Aggregate persistence must preserve domain invariants | **Repository**: expose aggregate-oriented operations and use the existing unit-of-work boundary | A mapper or query service already expresses the required data access directly |
| Business predicates compose or share one semantic definition across callers | **Specification** or first-class predicate: keep composition explicit and test semantic equivalence | One local condition remains clearer than a reusable predicate |
| Producer state and message intent must commit together before cross-process delivery | **Transactional Outbox**: persist both in one local transaction with stable message identity; define retry and ordering | The external action shares the same atomic transaction |
| A consumer must deduplicate delivery and apply local state atomically | **Transactional Inbox** or idempotent consumer: record message identity and apply the state change in one local transaction; define duplicate and ordering behavior | The consumed operation is naturally idempotent and duplicate execution is proven harmless |

Command represents intent, not durable execution. Observer represents reaction, not
cross-process delivery. For reliable integration events, use producer Outbox and
consumer Inbox semantics as required by their separate transaction boundaries.

Preserve the pattern invariant rather than a ceremonial class diagram. Functions,
enums, sealed types, records, or framework mechanisms can express the same pattern.
