# Independent Option Tournament — baseline-vs-candidate probe evidence

Date: 2026-07-12 (probes ran 2026-07-11 to 2026-07-12).
Subject: the `Independent Option Tournament` escalation in
`skills/first-principles-planner/REFERENCE.md` — independent fresh-context
drafters produce option cards per assigned mechanism family; the main context
judges against a pre-registered rubric.
Question: does the escalation produce better option sets than the default
in-context lightweight tournament, and at what cost?

## Verdict (summary)

- **Clear, repeated win under an unchanged metric**: the candidate
  (independent tournament) beat the baseline (in-context tournament) in two
  consecutive probes under an identical, prospectively fixed decision rule,
  across two divergent domains. Generalization confidence: **medium** (one of
  the two wins is sensitive to a single flagged grader judgment).
- **The repeatable edge is breadth, not winner quality**: the candidate
  surfaced exactly one extra *genuine* (non-strawman) mechanism family per
  probe that the baseline never produced. The baseline escaped the user's
  anchor and picked defensible winners in all three probes — the in-context
  tournament is not broken.
- **Cost is stable at ~5-6x baseline tokens**, which justifies the narrow
  escalation gate (Deep-depth decision whose wrong choice is costly to
  reverse, or explicit user request) rather than default use.

## Design under test

`skills/first-principles-planner/SKILL.md` step 4 gates the escalation;
`REFERENCE.md#independent-option-tournament` defines the procedure. Bias
closures under test: same-model drafter convergence (closed by assigning one
mechanism family per drafter), judge bias (closed by pre-registering the
Bestness Check fit criteria before any draft; mid-judging criteria enter only
via a recorded rubric amendment plus uniform re-judging), drafter context loss
(closed by passing the full problem statement + constraint split), cost
mismatch (closed by the escalation gate).

The text passed a fresh-context falsification review and a second-model
(Codex) review before probing; the Codex pass rejected the original step-5
wording (a named-as-new criterion could still decide in place) and the rule
was tightened before any probe ran.

## Method

Each probe is an A/B run on a self-contained, solution-shaped fixture question
(stated facts only; no repo exploration; Chinese output):

- **Baseline arm**: one fresh-context agent follows the skill with the
  in-context lightweight tournament only.
- **Candidate arm**: a fresh orchestrator does root trace, constraint split,
  rubric pre-registration, and family assignment; the parent session acts only
  as a message bus; one fresh drafter per family returns an option card
  (mechanism / favoring conditions / failure mode / evidence); the orchestrator
  is resumed to judge and report.
- **Grading**: a separate fresh-context grader receives both arms' option sets
  anonymized (Arm 1/Arm 2 by recorded coin flip), format-normalized, evidence
  sections stripped for length symmetry, and counts pre-registered measures.
  The grader never learns which arm used which procedure.
- **Pre-registration**: measures, decision rule, and (from Probe 3) the
  interpretation of win/lose were written to disk before either arm ran.

### Metric evolution (disclosed)

- **v1 (Probe 1)**: primary = raw distinct mechanism family count. Result
  exposed a flaw: raw count rewards graveyard padding — the baseline's +3
  family lead consisted entirely of options the blind grader classified as
  strawmen.
- **v2 (Probes 2-3)**: primary = **non-strawman** family count, with
  constraint-grounding not lower; both arms present only options that entered
  their final comparison. v2 was designed after seeing Probe 1 data and
  applied prospectively only — Probe 1's verdict under v1 stands as recorded.

## Probes and results

All gradings blind; Arm assignment by coin flip recorded before grading.

### Probe 1 — skill distribution drift (fixture: "switch to a symlink farm?")

| Measure (v1) | Baseline | Candidate |
|---|---|---|
| Raw distinct families (primary) | **5** | 4 |
| Strawmen | 3/6 | **0/4** |
| Anchor escape | yes | yes |
| Constraint grounding | 66.7% | **100%** |
| Winner = anchor? | no | no |

v1 rule (raw families strictly greater AND strawmen not higher): **no win**
(4 < 5). Post-hoc observations recorded but not used: non-strawman families
were 2 vs 4; the candidate's family count is capped by the skill text itself
("3-4 families"); the baseline's lead came entirely from strawmen.

### Probe 2 — order-store sharding migration (fixture: "app-level dual-write?")

| Measure (v2) | Baseline | Candidate |
|---|---|---|
| Non-strawman families (primary) | 2 | **3** (grader flagged an alternate defensible reading of one option giving 4) |
| Strawmen | 0/3 | 0/4 |
| Anchor escape | yes | yes |
| Constraint grounding | 100% | 100% |
| Winner = anchor? | no (CDC) | no (CDC + pre-work gates) |

v2 rule: **clear improvement** (3 > 2, grounding equal). The extra genuine
family was storage-engine-level replication/resharding. Cross-arm winners
converged (both CDC) — a validity note. All four candidate cards independently
derived the same structural conclusion (sharded binlog topology needs an
aggregation layer), an evidence shape the single-context baseline cannot
produce.

### Probe 3 — exactly-once batch jobs (fixture: "Redis SETNX+TTL lock?")

| Measure (v2, unchanged) | Baseline | Candidate |
|---|---|---|
| Non-strawman families (primary) | 2 | **3** |
| Strawmen | 0/4 | 0/4 |
| Anchor escape (escape-family count) | yes (1) | yes (2) |
| Constraint grounding | 100% | 100% |
| Winner = anchor? | no (lock+idempotency layered combo) | no (effect-layer idempotency + gates) |

v2 rule: **clear improvement** (3 > 2, grounding equal). The extra genuine
family was the claim-based task queue. This was the strongest baseline of the
three probes — it surfaced the effect-layer idempotency family on its own and
won with a layered combination.

**Sensitivity disclosure**: the Probe 3 win hinges on one grader judgment the
grader itself flagged as weaker — folding the baseline's centralized-scheduler
option into the lock family. Under the alternate reading the primary is a 3=3
tie. Mirror fact: Probe 2's single flagged judgment cut the opposite way (the
candidate could have counted 4). Each probe carried exactly one contested
family call; they cut in opposite directions.

## Rule-execution observations

- The tightened step-5 rule (mid-judging criteria never decide in place)
  demonstrably executed: both Probe 2 and Probe 3 judge reports opened with an
  explicit "considered new criteria, declined with reasons, no rubric
  amendment" declaration.
- Probe 3's judge ran a genuine inversion test that attached pre-work
  verification gates to the winner and named the conditions under which the
  closest alternative should be re-evaluated.

## Known limits

- **In-harness drafters are not perfectly context-free**: one Probe 1 drafter
  cited the host repo's git status with zero tool calls — harness system
  context leaks into "fresh" subagents. Strict independence needs a second
  runtime.
- Both arms run the same model; diversity gains come from context isolation
  plus family assignment, not model diversity.
- Fixtures are realistic but synthetic; no live-task probe has run.
- v2 was chosen after Probe 1's data (disclosed); it has since been confirmed
  twice prospectively, once with the sensitivity caveat above.
- Family assignment involves one contested judgment call per probe; the
  measure is countable but not fully mechanical.

## Cost (measured, subagent tokens)

| Probe | Baseline | Candidate | Ratio |
|---|---|---|---|
| 1 | ~47k | ~236k | ~5.0x |
| 2 | ~46k | ~259k | ~5.6x |
| 3 | ~47k | ~236k | ~5.0x |

Graders: ~57-68k per probe (shared overhead). Wall clock: candidate ~2x
baseline (drafters run in parallel; prep and judging serialize).

## Status and decisions

- Text level: accepted after fresh-context + second-model reviews (Round 1),
  with the second-model REJECT finding fixed before probing.
- Behavior level: clear, repeated win under an unchanged prospective metric →
  the escalation section was upgraded from provisional to accepted, with the
  Probe 3 sensitivity caveat on record.
- The escalation gate stays narrow; the measured ~5-6x cost ratio is the
  standing justification.
- Follow-up extension (step 5 red-team option for inversion-test
  failure-hypothesis generation) has text-level dual-review evidence only
  (Codex ACCEPT, fresh-context ACCEPT WITH NITS); no behavioral probe.

Primary artifacts (pre-registrations, run notes, arm outputs, grader reports)
were produced in the working session's scratchpad; the tables above carry the
graded data in full.
