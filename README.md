# asdf-skills

> English | [简体中文](README.zh-CN.md)

Portable agent skills and user-level tools for Codex, Claude Code, and
compatible agent runtimes.

Each directory under [`skills/`](skills/) is a self-contained source skill with
task-facing instructions and optional references, scripts, or templates.

## Skills

Skills are authored once as source assets and can be distributed into one or
more agent runtimes as managed installed skills. See [CONTEXT.md](CONTEXT.md)
for the distribution vocabulary.

| Skill | Focus | Purpose |
| --- | --- | --- |
| [`first-principles-planner`](skills/first-principles-planner/) | plan | Plan or decide from the root problem: separate constraints from assumptions, compare mechanisms, and return the current-best path with its failure condition and next check; also answers whether to build at all and challenges to a recommendation just given. |
| [`assayer`](skills/assayer/) | review | Independently falsify one completed design or plan revision: review-only ends after one complete round with GO, NO_GO, or SUSPENDED; on request, review-and-revise iterates on the exact final revision until every required reviewer returns GO or the review suspends. Depth follows the candidate's risk and decides reviewer strength. |
| [`deep-research`](skills/deep-research/) | investigate | Evidence-backed investigation whose deliverable is written findings, not a fix: what is true, why behavior occurs, which option the evidence supports. |
| [`arborist`](skills/arborist/) | implement | Implement, fix, refactor, or migrate code that already has callers, stored data, or tests to keep working, or land an adjudicated plan; delivers the change with evidence that affected contracts hold, structural improvement when requested, and verification matched to risk. |
| [`scrutineer`](skills/scrutineer/) | review | Review code and changes through evidence-backed counterexamples; separate defects, unverified risks, decision items, and optional improvements without editing the candidate. |
| [`e2e-test-workflow`](skills/e2e-test-workflow/) | verify | Plan, execute, and present end-to-end tests: source-backed scenario trees, evidence-backed execution reports that hand defects back for separately authorized fixes, with a capped iterate-until-green loop on explicit request, and HTML reader views. Typed first, `plan`, `run`, `render`, or `brief` selects the mode: plan and render it; run, planning first when no plan exists, and render; render an existing artifact; or brief a finished report for readers outside the run, delivered with it. |
| [`generating-api-docs`](skills/generating-api-docs/) | land/verify | Generate backend API docs across RPC and HTTP protocols from code-backed contracts, for one interface, one requirement's backend API, or a branch's API changes. |
| [`rationale-records`](skills/rationale-records/) | navigate | Record why current code is implemented this way and find the reason by file path or code snippet; keep records personal and Git-ignored, with worktree handoff. |

## Methods behind the skills

Each skill encodes a small number of established methods rather than a house
style. Knowing which ones explains why a skill insists on a step, and where to
look when extending it.

### `first-principles-planner`

- **First-principles reasoning:** separate true constraints from conventions and unverified assumptions, then work from the root problem.
- **Five Whys (Toyota):** for a single solution-shaped ask; a system traces its business, technical, historical, and operational roots instead.
- **Value Gate:** the status quo is the baseline against existing capability, process adaptation, and system change, so design starts only when building is worth it.
- **Option tournament and inversion (Jacobi, popularized by Munger):** compare fundamentally different mechanisms, then ask when the winner would be the worst approach and what remains unsolved after it lands.
- **Pre-registration (experimental science) with an explicit stopping rule (Simon's satisficing):** the Bestness Check writes down fit criteria, closest alternative, defeat condition, and marginal-gain stop before recommending.

### `assayer`

- **Popperian falsification:** independent reviewers attack the candidate, with a second model as a stronger falsifier for same-model blind spots.
- **Fail-closed gating (safety engineering):** the exact gate refuses on anything missing or unreconciled; there is no approximate pass.
- **Consequence-based severity:** fixed by consequence, never by review cost.
- **Perspective-based reading (Basili):** at full depth one reviewer walks the candidate as the operator on call, the single perspective an A/B trial found worth its cost.
- **Decision Envelope:** the technical verdict stays separate from the value decision, which review never recomputes.

### `deep-research`

- **Evidence hierarchy:** primary sources outrank non-primary ones.
- **Triangulation:** claims are cross-checked across independent evidence lanes.
- **Strong inference (Platt; Chamberlin's multiple working hypotheses):** rival explanations stay alive until a distinguishing check separates them.

### `arborist`

- **Contract thinking:** define the change as an observable outcome, the behavior that must stay true, and evidence that separates success from a plausible wrong result; a bug fix's oracle is independent of the defect.
- **Change impact analysis (Bohner & Arnold):** trace producers and consumers from real entry points, separating source-level reachability from the path actually taken.
- **Legacy-code technique (Feathers):** characterization tests preserve existing behavior; seams exist only for demonstrated variation.
- **Deep modules (Ousterhout):** substantial coherent complexity behind a small interface that states everything callers must know.
- **DRY in its original sense (Hunt & Thomas):** one authoritative owner per rule; callers use the decision without reproducing its conditions.
- **Evolutionary refactoring patterns (Fowler's catalog):** parallel change, branch by abstraction, strangler, expand-migrate-contract, each exiting on obsolete-path removal.
- **Incremental delivery:** load-bearing assumptions are checked before each slice, every slice is verifiable, and intermediate states stay valid for callers and data.
- **Verification matched to risk:** mutation analysis (DeMillo) and focused independent review when warranted.

### `scrutineer`

- **Popperian falsification, in both directions:** challenge the implementation with counterexamples, then seek evidence that refutes each candidate finding.
- **Contract-based review:** the object under challenge is a threatened requirement or compatibility contract, never historical behavior alone.
- **Consequence-based severity:** kept separate from evidence strength.
- **Findings and remedies validated separately:** a confirmed defect does not show that a fix preserves the contracts.
- **Revision-bound evidence:** every finding is reproducible at the reviewed revision.
- **Independent reads over one deeper read:** a review that gates acceptance runs two or three fresh reads with different entries and merges them without dropping or voting; each finding stands on its own evidence.

### `e2e-test-workflow`

- Planning
  - **Model-based test design (Ammann & Offutt):** coverage criteria over the input space (Base-Choice, Pairwise), the state graph, and decision logic; a rule firing on several independent conditions owes one obligation per condition, the deciding-condition idea from MC/DC.
  - **Independent oracle:** expected-result authority is separated from implementation evidence.
  - **Change impact analysis (Bohner & Arnold):** follow affected contracts through shared writers, readers, callers, and subscribers.
- Execution
  - **RIPR model's shape:** per scenario, a reachable trigger, propagation to a system-level outcome, and a bounded observable completion predicate.
  - **Order of volatility (digital forensics):** volatile failure scenes are captured before retries or cleanup can destroy them.
  - **PROV-style provenance:** plan, run, and artifacts reconstruct from the artifacts alone.
  - **Explicit SUT boundary:** every real dependency and double is declared.
- Presentation
  - **Single source of truth:** Markdown is canonical; HTML is a checked projection of it.
  - **A derived view restates, never computes:** a brief carries only values the canonical report already states, each linked back to the case or finding that established it.

### `generating-api-docs`

- **Design by contract (Meyer) and information hiding (Parnas):** document the caller contract, never the implementation.
- **Target contract:** the intended external contract, never a current defect.
- **Authority separated from evidence:** the approved contract decides what the interface promises, the inspected revision fills in what the contract leaves open, and a disagreement between them is reported as a defect.

### `rationale-records`

- **Chesterton's fence:** record why code is implemented this way and what behavior a seemingly simpler rewrite would break.
- **DRY in its original sense (Hunt & Thomas):** one invariant, one current owner.
- **Code-to-reason lookup:** each record pairs a file path with a code snippet that matches exactly once in that file, so a maintainer can find the implementation rationale from the code.
- **A record is an interruption:** its title names what a natural rewrite would break, because the reader arrives mid-edit and the anchor has already answered whether the record applies to them.

## Lifecycle placement

```
plan         first-principles-planner → assayer       ← decide the plan, then falsify it
implement    arborist                                 ← trace the roots, then shape the smallest safe change
review-code  scrutineer                            ← challenge the code and the findings; report without editing
verify       e2e-test-workflow (plan → run → render · brief) · generating-api-docs
investigate  deep-research                            ← answer questions from evidence
              ↑ discovered unknowns feed the next plan
```

These skills keep the work itself correct. Stress-testing a plan the user
already holds (interview/grill-style skills) sits between planning and review
and lives outside this repository.

## Compatibility

These skills are independent of any orchestration runtime, and each is
independently distributable.
`assayer` binds the same portable workflow to each host's read-only reviewer:
a fresh-context reviewer uses the runtime's read-only agent capability, a
second-model reviewer uses the read-only second-model capability the runtime
offers, and availability is resolved and recorded once at freeze time.

`e2e-test-workflow` is model-invoked in both hosts; typed by hand, a leading `plan`,
`run`, `render`, or `brief` selects the mode: `/e2e-test-workflow plan …` in Claude Code,
`$e2e-test-workflow plan …` in Codex. It replaces the retired `e2e-test-planner` and
`e2e-test-executor`; on a machine that installed those, remove only the install
entries for those two names whose stored link target points into this repository's
`skills/` tree, keep real directories and foreign links, then run the installer.

`scrutineer` can run directly or in a fresh-context reviewer delegated by an
implementation workflow. It owns code review, `arborist` owns implementation,
and `assayer` owns design/plan review; none requires the others to be installed.

## Repository layout

```
skills/      # source skills, one directory per skill
tools/       # portable user-level agent tools
scripts/     # installers and contract checks
docs/        # research notes and plans (local-only, Git-ignored)
evals/       # eval run artifacts (local-only, Git-ignored)
tests/       # test suites run by the gate (local-only, Git-ignored)
AGENTS.md    # shared repository contract
CONTEXT.md   # canonical domain terms for skill distribution
CLAUDE.md    # Claude Code entry: one @AGENTS.md import
global-agent-rules.md  # portable user-level rules for any repository
```

Each skill directory contains a task-facing `SKILL.md` (with `name` / `description`
routing frontmatter), optional `REFERENCE.md` and other detail files loaded on
demand, and optional `scripts/` and local-only `tests/`.

## Agent tools

The [portable Java formatter](tools/java-formatter/) and the scripts inside the
[rationale-records skill](skills/rationale-records/) share one Stop hook for Codex and
Claude Code. Business repositories may carry Git-ignored personal records under
`docs/rationale`, but never formatter/checker executables, runtime hooks, or rationale state.

    node scripts/install-agent-tools.cjs
    node scripts/install-agent-tools.cjs --apply
    node scripts/contract-java-formatter.mjs
    node scripts/contract-rationale-records.mjs

The installer links the formatter into `~/.agents/tools`, the complete rationale
skill into `~/.agents/skills`, and merges global runtime settings without
replacing unrelated hooks or settings.

It also installs [`global-agent-rules.md`](global-agent-rules.md), the user-level
rules for every repository: `~/.codex/AGENTS.md` becomes a file symlink to it, or
a byte-identical copy where a file symlink needs elevation (Windows without
Developer Mode), and `~/.claude/CLAUDE.md` gets one `@import` line pointing at it.
Existing content in either file is kept; a Codex file the installer did not write
is reported, never replaced. `node scripts/assert-installed-copies.cjs` re-checks
the copy, so re-run the installer after editing the rules file.

## Testing

Follow the verification requirements in [AGENTS.md](AGENTS.md#verification-and-completion).

## Contributing

Read [AGENTS.md](AGENTS.md) before repository work. It owns source ownership,
portability, authoring, and verification requirements for skills and tools.
Skill creation and improvement use the current runtime's official
`skill-creator`, with `writing-for-agents` for wording and information structure.
Repository-specific constraints remain in `AGENTS.md`.
