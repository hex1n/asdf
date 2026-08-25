---
name: skill-ab-trial
description: >
  Runs a controlled A/B trial measuring whether one candidate instruction — a
  skill rule, process prescription, or prompt directive — changes what agents
  actually deliver. Use when the user asks to test or quantify an
  instruction's effect (这条规则/指令有没有用测一下, 对指令/提示词/流程做
  A/B 实验、对照实验、消融实验 (ablation), 盲评对比两种提示词或流程), or to
  rerun this trial on a new candidate instruction. Do not use to choose between design options
  without running agent arms (first-principles-planner), to review one
  completed plan (plan-review), or for questions answerable from existing
  evidence without controlled runs (deep-research).
---

# Skill A/B Trial

One candidate instruction, two arms, layered verdicts. The trial answers a
single pre-registered question: does the instruction change what agents
deliver, or is it ritual? Evidence comes from running agents, never from
reading the instruction and judging it plausible.

## 1. Pre-register

Freeze before building anything:

- The **candidate instruction**, verbatim, and the outcome it claims to move.
- **Arms**: treatment = the instruction, verbatim, in the run prompt;
  control = the same prompt without it. Both arms carry an identical
  **deliverable bar** — what must be delivered and to what quality — pinned
  on the deliverable, not the process; a bar that prescribes process in
  either arm measures the bar, not the candidate.
- **Bench shape**: tasks (at least two, different rule domains),
  replications per arm per task (at least two), and the runner model.
- **Metrics**: objective correctness, blinded ranking dimensions, cost
  (tokens, tool calls, wall time), adherence.

Completion: a written pre-registration the rest of the trial is audited
against.

## 2. Build the bench

Per task:

- A **spec** pinning the public interface exactly — file paths, signatures,
  error contract — so external checks run against any arm's deliverable
  unmodified.
- A **reference implementation**, kept outside every run's reach.
- A **held-out oracle**: mechanical checks derived from the spec text alone,
  unseen by any arm.

Two gates before any arm runs:

- The oracle is green on the reference implementation.
- Every worked-example value in a spec is produced by executing the
  reference implementation. A hand-derived example value is a future trap:
  an erratum a run may enshrine as authority.

Completion: oracle green on reference; specs frozen.

## 3. Run the arms

- One isolated working directory per run, initialized with only the spec;
  runs reach neither each other, nor the oracle, nor the reference.
- Same model, same budget posture, same deliverable bar; prompts are
  identical except the candidate block — and, when the candidate itself
  names a deliverable, the control arm's outcome-equivalent bar
  ([REFERENCE.md](REFERENCE.md#arm-prompt-template)).
- Every run keeps an ordered process log (numbered steps as taken) — the raw
  material for the adherence check.

Completion: every run finished with deliverable plus process log.

## 4. Layered verdict

Run every layer. Each layer's blind spot is invisible from inside it, so
cross-layer disagreement is signal to dig, never noise to average away.

- **Oracle**: run the held-out checks on every deliverable. When all arms
  saturate, report saturation explicitly — the discriminating signal moves
  to the next layer; saturation is not "no difference".
- **Blind ranking**: anonymize deliverables (strip process logs and any
  arm-naming file, shuffle labels, record the mapping outside the judged
  material, search the copies for arm-identifying text before dispatch).
  At least two independent judges per task rank all deliverables on the
  pre-registered dimensions, judging from the spec alone, told nothing
  about the arms.
- **Arbitration**: any judge claim that decides the verdict — a defect
  claim, a coverage hole, a suspected invented requirement — is executed as
  a probe before it counts. Judge text is a hypothesis until a run confirms
  it.
- **Adherence**: read the process logs; the treatment arm demonstrably
  performed the instruction and the control arm did not spontaneously adopt
  it. A non-adherent run is void — replaced or reported as attrition, its
  numbers never blended into its arm.

Completion: all four layers reported; every verdict-deciding judge claim
settled by an executed probe.

## 5. Report

One artifact carrying: the pre-registration; per-arm oracle results;
rankings with agreement noted (unanimity or split); arbitrated findings;
cost per arm; adherence evidence; saturation notes; and threats to
validity — replication count, single runner model, task genre, what the
oracle could not see. State findings as directional hypotheses at bench
scale; the accept/reject decision on the instruction belongs to the
caller's own evolution process, fed by this evidence.

Completion: the report artifact exists and covers every layer that ran.

Bench design, arm and judge prompt templates, leak check, arbitration
probes, and the report skeleton: [REFERENCE.md](REFERENCE.md).
