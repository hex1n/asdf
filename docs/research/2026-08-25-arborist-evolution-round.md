# Arborist Skill Evolution (formerly System Weaver)

Date: 2026-08-25

## Expected-behavior baseline

This is a net-new skill. The baseline is therefore an expected-behavior spec,
not an earlier skill output.

### Root problem

An implementation agent can make a locally plausible change while treating
current code as the business contract, missing indirect consumers, choosing a
shallow architecture, and declaring success from self-derived tests. In a
complex existing system that produces the characteristic failure: “this place
was changed and another flow broke.”

### Success criteria

For a non-trivial implementation request, the skill changes observable agent
behavior so that the run:

1. separates expected-result authority from current implementation and runtime
   evidence;
2. states the intended behavioral delta and the behaviors not authorized to
   change;
3. traces propagation through callers, readers, writers, events, jobs,
   compatibility paths, and shared state rather than stopping at a static call
   graph;
4. chooses the decision-owning Module and a stable Interface/Seam that
   concentrates complexity instead of adding pass-through layers;
5. maps every high-risk affected flow to independent verification before code;
6. implements a complete Happy Path first, then failure, boundary, retry,
   concurrency, migration, and compatibility obligations in risk order;
7. reports exact evidence and leaves skipped checks or unresolved authority as
   visible risk rather than claiming broad safety.

### Protected failure modes

- **Code-as-contract**: code and matching tests are promoted into intended
  business truth without approval.
- **Smallest-diff trap**: the run patches several callers instead of making the
  smallest coherent change in the decision-owning Module.
- **Call-graph myopia**: data, messages, schedulers, reports, recovery, or
  compatibility consumers disappear from blast-radius analysis.
- **Shallow architecture**: new interfaces or services merely pass decisions
  through and widen the surface callers must understand.
- **Self-exam**: implementation-derived tests are treated as an independent
  oracle, or compilation/focused-unit green is reported as regression safety.
- **Ceremony inflation**: a proven-local edit receives a full architecture
  document and speculative abstraction despite no system-level risk.

### Negative and non-trigger examples

The skill should not route for planning-only, diagnosis-only, review-only,
test-scope-only, documentation-only, formatting, generated-code refresh, or a
mechanical one-file rename with no semantic or consumer impact. It should not
claim authorization to commit, push, deploy, migrate, or call live systems.

## Generalization gate

The portable wording must fit both of these divergent domains without using
either domain's identifiers in `SKILL.md` or `REFERENCE.md`:

1. a Java order-lifecycle change with persistent state, an event, a scheduled
   continuation, idempotency, and conserved fulfillment behavior;
2. a Go developer-tooling change that adds exact resource links across invoke,
   replay, session retention, and MCP response assembly while preserving
   existing URIs and safety behavior.

The common abstraction is therefore not a product-specific workflow. It is:

`intended contract -> conserved behavior -> propagation graph -> Module/Seam -> proof obligations`

## Discriminating probes

### S1 — stateful Java business change

Give a fresh run a small existing Java repository in which an order can be
paid, scheduled for fulfillment, and reported. Ask it to add cancellation with
state rules, exactly-once event emission, idempotent replay, audit history, and
the requirement that scheduled fulfillment skip cancelled orders. Hold back
tests for illegal transitions, duplicate events, scheduler behavior, and
unchanged payment behavior.

The probe discriminates only if the run must touch or explicitly account for
the domain Module, persistence, event Adapter, scheduler consumer, reporting,
and compatibility of existing behavior.

### S2 — cross-module developer-tool change

Use a clean scratch clone of `sofarpc-cli`. Ask the run to return an exact
captured-plan resource link, in addition to the existing latest-plan link,
from the invoke and replay paths when a plan ID is available. Existing resource
URIs, link behavior without a captured plan, replay safety, and ordering are
conserved. Focused MCP tests and broad Go checks are the available evidence.

The probe discriminates whether the run follows resource construction through
session capture, invoke/replay response assembly, tests, and documentation,
instead of patching one handler.

### N1 — non-trigger routing

“Correct one typo in a private test description; behavior and generated output
are unchanged.” The skill should stay out of the way.

## Candidate

- Source skill: `skills/system-weaver/`
- Candidate leading words: 经, 纬, 织补, Intended Change, Conserved Set,
  Impact Ledger, Locality
- Narrowness claim: one implementation skill plus one conditionally loaded
  reference; no runtime-specific scripts, dependencies, or source-project
  identifiers in the portable body.

## Round 1

Supersedes: none

Improvement magnitude: clear. In both real implementation probes, the run
separated the requested contract from current behavior, selected one decision
owner, traced indirect consumers, implemented the Happy Path and conserved
flows, and reported exact evidence. The Java probe closed scheduler and
reporting consumers; the corrected Go rerun closed both runtime and published
contract surfaces using repository-native checks.

Generalization confidence: high. A stateful Java business flow and a Go
developer-tool flow both passed, and the rule changed after the first Go run
was rerun against that same discriminating task in a fresh context.

Hard gates: pass. The expected-behavior baseline predates the candidate
outputs; both real validation artifacts are recoverable under ignored
`evals/system-weaver-round1/`; no correctness, safety, privacy, portability,
or identifier-leak regression remains; the portable body stays task-facing;
and the accepted fix changed only the two falsified rules plus the matching
negative-route phrase.

High-stakes escalation: the first independent read-only falsification failed
the candidate because non-Java work could be exposed to Maven/Gradle guidance
and published contract surfaces were not explicit impact targets. The
candidate then isolated Java verification, required other stacks to retain
repository-native commands, and added documentation, examples, schemas,
generated clients or fixtures, and embedded instructions to impact closure.
A second independent falsification passed both original counterexamples and
the local-ceremony attack. The fresh Go rerun independently updated published
contract surfaces and never invoked Maven or Gradle. A final routing check
also passed the new `documentation-only` exclusion without suppressing complex
implementation work that happens to include documentation.

Task samples:

- Java project: `evals/system-weaver-round1/java-case/`
  - approved contract: `SPEC.md`
  - baseline and final visible command: `./run-visible-tests.sh`
  - result: `VISIBLE TESTS PASS`
  - independent compile/oracle: `javac -source 1.8 -target 1.8 -Xlint:all`
    over production sources plus `java-oracle/HiddenOracle.java`, followed by
    `java -cp "$oracle_classes" example.orders.HiddenOracle`
  - result: `HIDDEN ORACLE PASS`
  - the held-out oracle initially encoded an empty non-cancelled report value,
    contrary to the pre-approved `null` contract. The oracle was corrected;
    implementation and visible tests were not changed to satisfy the faulty
    test. This is direct evidence that tests were not promoted to business
    authority.
- Go project, candidate v1: `evals/system-weaver-round1/sofarpc-case/`
  - result: focused tests, `go test ./internal/mcp`, `go vet ./...`,
    `go test -race ./...`, `go build ./...`, and `git diff --check` passed
  - value: produced the first real output, but did not override the independent
    falsifier's two skill-level findings merely because repository-local rules
    happened to make the run update documentation.
- Go project, corrected candidate: `evals/system-weaver-round1/sofarpc-case-v2/`
  - same approved task in a clean clone and fresh agent context
  - red-first focused tests demonstrated missing exact-link behavior
  - result: focused MCP tests, `go test ./internal/mcp`, `go vet ./...`,
    `go test -race ./...`, `go build ./...`, and `git diff --check` passed
  - published English and Chinese docs, architecture, embedded instructions,
    prompts, and changelog were included; no Maven/Gradle command ran

Static validation:

- The bundled `quick_validate.py` could not start because the local interpreter
  lacks its external `yaml` module. A Ruby stdlib-equivalent check of every
  validator predicate passed: valid frontmatter mapping and keys, valid
  `system-weaver` name, 486-character description, and no TODO placeholder.
- `node scripts/check-all.mjs` passed 109 repository tests and installed-copy
  integrity checks; the new skill is correctly reported as not yet installed.
- `git diff --check` passed.
- A case-insensitive scan of `skills/system-weaver/` found no identifiers from
  either validation project.

Expected-behavior spec: all seven success criteria and all six protected
failure modes above were exercised. Planning-only, review-only,
test-scope-only, documentation-only, and mechanical work remain excluded by
routing; N1 therefore stays out of the workflow.

Wins:

- Code and tests stayed implementation evidence; the approved contract
  corrected a bad oracle instead of the oracle redefining behavior.
- The Java run placed state transitions in the aggregate, kept orchestration at
  the service interface, and accounted for scheduler, reporting, events,
  idempotency, and unchanged fulfillment.
- The corrected Go run centralized link construction, preserved ordering and
  safety branches, traced published contract surfaces, and used only native Go
  verification despite an unrelated fixture `pom.xml`.
- The shortest Happy Path was implemented first in both runs, followed by
  branch, failure, idempotency, compatibility, and conserved-flow evidence.

Regressions: candidate v1 had two real instruction gaps; both were fixed before
acceptance. No unresolved regression remains in the accepted candidate.

Weakest gate or lowest-confidence claim: neither fixture can prove behavior
against a live external system. Optional tagged E2E was not run for the Go
sample, and the Java fixture has no defined atomic persistence/event failure
contract. Both remain explicit sample risks rather than unsupported safety
claims.

Decision: accept.

## Round 2

Supersedes: Round 1, reopened because the user rejected Java as a privileged
scope. The workflow was language-neutral in its core, but the routing
description said "especially in Java," the reference pointer foregrounded
complex Java systems, and the only detailed impact-tracing section was named
and written for Java. That wording could suppress discovery or distort
execution in other stacks even though the earlier Go probe passed.

Improvement magnitude: clear. The user-reported scope bias was removed from the
description, reference pointer, impact-tracing section, architecture warnings,
and verification rules rather than hidden by deleting one phrase. The same Go
task still produced a deep, evidence-backed implementation without Java
vocabulary or commands.

Generalization confidence: high. The accepted candidate has real Java and Go
implementation outputs, plus an independent routing and behavior
falsification across Java, Go, TypeScript, Python, and Rust.

Hard gates: pass. The Round 2 failure and probes were fixed before editing;
the portable body contains no favored language, framework, or build-tool name;
the correction stays within the existing skill and reference; and all real
validation artifacts remain recoverable under ignored `evals/` paths.

High-stakes escalation: pass. A fresh independent reviewer could not construct
a Java-bias, depth-regression, or routing-boundary counterexample after the
description and reference-loading route changed.

Task samples:

- Same-task rerun: the exact captured-plan resource-link task from S2 in a
  third clean Go clone and fresh context. The run must select the skill, load
  the reference when appropriate, trace published contract surfaces, and use
  only repository-native Go checks.
  - artifact: `evals/system-weaver-round2/sofarpc-case-v3/`
  - result: exact-link construction remained centralized; invoke, replay,
    resource, prompt, embedded instruction, documentation, and compatibility
    surfaces were closed in the Impact Ledger
  - verification: focused red-first tests, `go test ./internal/mcp -count=1`,
    `go vet ./...`, `go test -race ./...`, `go build ./...`, and
    `git diff --check` all passed; no Java build command or live external call
    ran
- Routing falsification: complex cross-module changes expressed for Java, Go,
  TypeScript, Python, and Rust must all route for behavioral risk rather than
  language identity. Planning-only, review-only, documentation-only, and
  mechanical requests must remain excluded.
  - result: PASS for all five implementation stacks and all four exclusion
    branches
  - retained depth: runtime wiring covered handlers, UI actions, consumers,
    schedulers, plugins, dynamic dispatch, metaprogramming, middleware,
    serialization, code generation, configuration, and indirect data readers
  - retained proof: repository-native validation still separates syntax/type
    checks, compilation, test compilation, discovery, execution, and skipped
    or cached suites

Expected-behavior spec:

- success criteria: no language is privileged in the description, entrypoint,
  impact tracing, architecture probes, proof matrix, or verification rules;
  repository-native wiring and tool discovery replace ecosystem-specific
  commands; Java remains supported as one ordinary instance.
- failure modes: removing only the phrase "especially in Java" while leaving
  a Java-shaped reference; replacing Java bias with a list of favored
  languages; flattening verification into generic advice that no longer
  distinguishes compilation, discovery, execution, and skipped tests; or
  widening the skill into planning, review, and mechanical work.
- negative examples: a typo-only change and a documentation-only request must
  still stay out; a complex non-Java implementation request must not require
  Java vocabulary or build tools to qualify.

Weakest gate or lowest-confidence claim: whether generic terminology still
drives concrete runtime-wiring and test-execution checks without relying on
ecosystem names. The Go rerun and five-stack falsification both did so; only
Go and Java have full implementation artifacts, while the other three stacks
remain tabletop probes.

Static validation:

- the stdlib-equivalent frontmatter check passed with a valid 501-character
  description and no unfinished placeholder;
- `node scripts/check-all.mjs` passed all 109 repository tests and runtime-copy
  integrity checks;
- `git diff --check` passed;
- an exact-word scan found no language, framework, or build-tool name in
  `skills/system-weaver/`.

Wins:

- Runtime and data-flow mechanisms now drive impact discovery; language names
  no longer decide whether the skill applies.
- Verification commands come from the affected component's manifests, build
  scripts, CI, and repository instructions. Stray fixtures cannot select a
  neighboring toolchain.
- Multi-language repositories explicitly verify each component with native
  tooling and then verify their connecting contracts.
- Removing Java specificity did not weaken state, transaction, concurrency,
  compatibility, generated-source, or skipped-test checks.

Regressions: none observed. Java remains covered as one ordinary runtime; the
negative routing branches remain excluded.

Decision: accept.

## Round 3

Supersedes: Round 2, reopened because the user explicitly required simple
tasks to avoid architecture ceremony. The accepted text said a proven-local
edit should "keep the same gates but compress the written analysis." That
leaves all six complex-workflow stages visible and can still induce an
Intended Change document, full Impact Ledger, architecture alternatives, or
speculative Seams when the skill is explicitly invoked for a trivial change.

Improvement magnitude: clear. On the same task, the baseline emitted Intended
Change, Conserved Set, a one-row Impact Ledger, architecture ownership, and an
unavailable broad-tool probe. The candidate used only the L0 locality check,
direct edit, existing focused test, final locality inspection, and compact
handoff.

Generalization confidence: high. The same Python task passed before/after
comparison, an independent reviewer failed to force ten classes of short but
high-impact changes into L0, and the previous Java/Go complex probes remain on
the promoted path.

Hard gates: pass. The baseline and candidate artifacts are recoverable under
ignored `evals/system-weaver-round3/`; the correction is confined to the
entrypoint and its Change Depth reference row; no complex-workflow assurance,
safety boundary, portability, or routing exclusion regressed.

High-stakes escalation: pass. Independent falsification attacked shared
status, query/schema, API/serialization, routing/flags, authorization,
transaction, concurrency, scheduled work, generated clients, and
cross-language contracts. Every case failed at least one L0 condition and was
promoted. Unknowns and newly discovered propagation edges also promote.

Task samples:

- Simple-task baseline and rerun: explicitly invoke the skill to replace a
  private one-file clamp helper's branches with one behavior-equivalent
  expression. The task declares no API, state, schema, async, compatibility,
  dependency, or consumer effect and requires only its focused tests.
  - baseline artifact: `evals/system-weaver-round3/simple-baseline/`
  - baseline output: five compressed workflow artifacts plus an unnecessary
    attempt to invoke unavailable `pytest`; native `unittest` passed 3/3
  - candidate artifact: `evals/system-weaver-round3/simple-candidate/`
  - candidate output: no reference load, Impact Ledger, architecture options,
    abstraction, broad-tool probe, or documentation; one native `unittest`
    command passed 3/3 and the final locality check stayed L0
- Promotion falsification: a short change to a shared status, schema, routing
  rule, authorization check, transaction boundary, or concurrency primitive
  must not enter L0 merely because the diff is small.
  - result: PASS; the strongest attempted counterexample was a one-line lock
    change in a private cache helper, which still promoted because concurrency
    and ordering semantics are shared and equivalence was unknown

Expected-behavior spec:

- L0 eligibility must be proved before implementation: one private
  implementation detail, bounded consumers, and no observable contract,
  shared state or data meaning, async work, compatibility path, security or
  operational effect.
- An L0 run performs only the direct edit, the narrowest focused proof, and a
  final diff/locality check.
- An L0 run does not create architecture alternatives, new Seams or Adapters,
  a full Impact Ledger, broad regression suites, or documentation unless a
  newly discovered propagation edge invalidates L0.
- Any failed locality condition or newly discovered propagation edge promotes
  the task before implementation or immediately when discovered; diff size is
  never evidence of locality.
- Negative examples: a private equivalent refactor stays L0; a one-line enum,
  query, schema, route, permission, or lock change can be L2/L3 when consumers
  share its meaning.

Weakest gate or lowest-confidence claim: the fast path must reduce observable
ceremony without becoming an escape hatch from blast-radius analysis. The
candidate met both sides. L0 remains intentionally narrow: a simple-looking
change that alters an observable contract is promoted even when its code is
local.

Static validation:

- the stdlib-equivalent frontmatter check passed with the unchanged valid
  501-character description;
- `node scripts/check-all.mjs` passed all 109 repository tests and runtime-copy
  integrity checks;
- `git diff --check` passed;
- the portable body still privileges no language or build tool.

Wins:

- L0 exits before the six-stage complex workflow and before loading the
  reference.
- Its complete work product is now bounded to direct edit, existing focused
  proof, final locality/diff inspection, and compact handoff.
- Architecture alternatives, full Impact Ledger, new Seams/Adapters, broad
  regression, and documentation are explicitly promotion-only.
- Diff size cannot establish locality; unknown conditions and new propagation
  edges force promotion.

Regressions: none observed. Complex Java and Go behavior remains governed by
the full workflow; simple automatic routing exclusions remain unchanged.

Decision: accept.

## Round 4

Supersedes: Round 3, reopened because the user explicitly required complete
refactoring capability. The accepted workflow could conserve behavior, shape
deep Modules, and migrate coherent slices, but it did not give refactoring its
own target contract, distinguish mechanical from semantic movement, select a
migration shape, govern temporary compatibility layers, or require deletion
and measured complexity recovery.

Improvement magnitude: clear. The baseline agent produced a good centralized
Module and compatibility Adapter from general capability, but accountability,
transition state, and final-completion semantics were only narrative. The
accepted candidate produced a falsifiable Refactor Contract, explicit
Mechanical slices, selected Parallel Change, full Transition Ledger, removal
proof, rollback anchor, and the correct conclusion that structural ownership
improved while the externally gated final refactor remains incomplete.

Generalization confidence: high. The same Python implementation task passed in
a fresh context, and independent TypeScript client/worker plus Java/relational
service simulations exercised separate release boundaries, side effects,
dependency cycles, and stored-data contraction.

Hard gates: pass. The baseline and two candidate artifacts are recoverable
under ignored `evals/system-weaver-round4/`; the new branch is conditionally
loaded only for approved refactors; the portable body contains no project or
ecosystem identifiers; L0 and ordinary feature/fix paths remain intact; and no
unsafe deletion, dual authority, or unowned transition is accepted.

High-stakes escalation: pass after iterative falsification-driven corrections.
Candidate v1 omitted the Owner column when evidence did not name a responsible
role. The first correction still allowed an external system to masquerade as
Owner; the second allowed invalid terminal values such as `complete` to make a
row disappear; a final consistency probe exposed ambiguity between `open` and
`NEEDS-DECISION` when ownership was unknown. The accepted rule restricts Owner
to an accountable human/team role, uses `open` only while an identified Owner
works toward exit, requires both Owner and Status to be `NEEDS-DECISION` while
ownership or authority is missing, requires confirmation plus actual deletion
plus Removal proof for `removed`, and keeps every row in the final six-field
Ledger. The final independent replay passed.

Task samples:

- Python baseline and rerun: centralize one duplicated pricing rule behind one
  stable Interface, migrate two callers, retain one published compatibility
  entry until an external version milestone, preserve result and error
  behavior, and define the old path's exit condition.
  - baseline artifact: `evals/system-weaver-round4/refactor-baseline/`
  - baseline result: one pricing owner, three forwarding entry points, behavior
    and AST checks, 5 tests passing; external exit was described but no durable
    Transition Ledger or accountable Owner disposition was required
  - candidate v1: `evals/system-weaver-round4/refactor-candidate/`; behavior and
    structure passed, but the final Ledger silently omitted Owner and was
    rejected
  - accepted candidate: `evals/system-weaver-round4/refactor-candidate-v2/`
  - accepted result: 6 tests passed; one owner enforced by AST/rule search;
    exact signatures, results, validation order, rounding, exceptions, and
    compatibility remained conserved
  - both temporary rows retain all six fields with Owner and Status both
    `NEEDS-DECISION`; the handoff calls the current state an active
    compatibility window rather than a completed final refactor
- Divergent-domain falsification: apply the branch to a compiled service with
  dependency cycles and a stored-schema migration, and to a client/worker
  system requiring a long-lived Interface transition. Direct replacement,
  parallel change, branch by abstraction, strangler, and expand/migrate/
  contract must be selected by evidence rather than used as a checklist.
  - result: PASS; ordinary feature/fix routing, L0, abstraction necessity,
    side-effect isolation, schema contraction, external compatibility,
    characterization authority, slice classification, deletion, and
    complexity-recovery attacks were all closed

Expected-behavior spec:

- A refactor starts with a structural target stated as a falsifiable property,
  a Behavior Envelope, and a removal target; "cleaner" is not a target.
- Characterization tests may freeze current behavior inside the approved
  Behavior Envelope, but cannot convert disputed current behavior into
  expected authority.
- Mechanical movement and semantic change remain separate slices with separate
  evidence.
- The migration shape follows caller reachability, release boundaries, stored
  data, and rollback needs. Every temporary Adapter, flag, dual path, or
  compatibility Interface has an owner, purpose, exit condition, and removal
  proof.
- Each slice remains behaviorally valid and rollbackable; callers migrate
  through the target Interface instead of accumulating a second source of
  truth.
- Completion requires old-path deletion when its exit condition is met,
  obsolete-test deletion or replacement, dependency/cycle checks, Interface
  contraction, and evidence that locality or simultaneous knowledge improved.
- Negative examples: ordinary feature/fix work does not load the refactor
  branch; a private equivalent refactor remains L0; a compatibility layer with
  an unmet external exit condition remains explicit rather than being deleted
  for a cosmetically clean final diff.

Weakest gate or lowest-confidence claim: the branch must produce a genuinely
better final structure, not merely a safe migration with permanent scaffolding.
The accepted artifact reduced pricing decision owners and edit points from
three to one while truthfully leaving the externally gated Removal Target open.
The compiled/stored-data cases remain independent simulations rather than full
implementation artifacts.

Static validation:

- the stdlib-equivalent frontmatter check passed with the unchanged valid
  501-character description;
- `node scripts/check-all.mjs` passed all 109 repository tests and runtime-copy
  integrity checks;
- `git diff --check` passed;
- the portable skill and Refactor Track privilege no language or build tool.

Wins:

- Refactor work now has its own conditionally loaded branch rather than adding
  ceremony to feature, fix, or L0 work.
- Structural Target, Behavior Envelope, and Removal Target separate
  architectural improvement from behavior preservation and transition debt.
- Mechanical movement cannot hide Semantic change; mixed obligations must be
  disclosed and proved independently.
- Direct Replace, Parallel Change, Branch by Abstraction, Strangler, and
  Expand/Migrate/Contract are selected by reachability and release evidence,
  not applied as a checklist.
- Temporary structure is accountable, exit-bound, proof-bound, and retained in
  the final Ledger even after removal.
- Completion requires deletion and observable locality/depth improvement, not
  merely a green migration.

Regressions: none observed. The accepted candidate preserved every behavior
and compatibility contract, introduced no hypothetical variation, and did not
claim completion while the external Owner and exit evidence were unavailable.

Decision: accept.

## Round 5

Supersedes: Round 4 for naming and metaphor only. The user accepted the
behavior but found `system-weaver` insufficiently evocative, rejected a
culture-specific image, and explicitly confirmed `arborist` as the replacement.

Improvement magnitude: clear for the reported naming failure. The identity now
expresses a living system, hidden dependency roots, local pruning, structural
grafting, and controlled growth. No runtime rule changed.

Generalization confidence: high. An independent routing probe selected the
skill for a cross-Module feature and a behavior-conserving refactor, while
excluding a private mechanical rename, planning, diagnosis, diff review, and
literal fruit-tree pruning.

Hard gates: pass. The folder and frontmatter are `arborist`; active catalog
links resolve to that folder; L0, promoted work, and the Refactor Track retain
their previous gates; historical artifacts keep their original evidence paths;
and no active `system-weaver` invocation path remains.

High-stakes escalation: pass. A fresh read-only reviewer tried to produce a
routing or behavior regression from only the candidate files and realistic
requests. Its strongest collision probe was a mature apple-tree pruning
request; the unchanged discriminating description correctly kept the Skill
out. It found no weaker completion, proof, or refactor gate.

Redesign pre-registration:

- Better meant making the system image easier to recall without changing the
  workflow's decisions.
- The discriminating probe required complex implementation and refactor work
  to route in, non-implementation and literal tree-care work to route out, and
  behavioral parity across L0, promoted work, and the Refactor Track.
- Failure meant horticulture misrouting, stale catalog/install paths,
  rewritten history, weakened gates, or extra ceremony for simple work.

Task sample and validation:

- source candidate: `skills/arborist/`
- historical implementation artifacts: unchanged under
  `evals/system-weaver-round1/` through `evals/system-weaver-round4/`
- frontmatter: valid `name: arborist`; the discriminating description remains
  501 characters
- `node scripts/check-all.mjs`: all 109 repository tests and runtime-copy
  integrity checks passed
- `git diff --check`, active-name/metaphor scan, and trailing-whitespace scan:
  passed
- installed state: the source Skill is not installed in any runtime; this is
  reported as absent rather than drift

Expected-behavior spec:

- complex cross-Module feature, fix, and approved refactor implementation
  requests select the Skill based on behavior and propagation risk;
- planning, diagnosis, review, test-scope, documentation, purely mechanical
  edits, and literal tree-care requests remain outside its routing boundary;
- a proven-local edit still ends at L0, while an unknown or propagation edge
  promotes it;
- the Arborist image changes recall and vocabulary, not authorization,
  architecture, proof, or completion semantics.

Wins:

- `Trunk`, `Roots`, and `Prune or Graft` replace the previous culture-specific
  vocabulary with one coherent, cross-domain image.
- The name now covers growth, repair, refactoring, and complexity recovery
  without implying that every task needs structural work.
- README catalogs and lifecycle maps use the new identity consistently.

Regressions: none observed. Literal tree care did not trigger, simple work did
not promote, and every Round 4 refactor obligation remained intact.

Decision: accept.
