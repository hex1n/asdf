# Skill A/B Trial — Reference

Consulted on demand from [SKILL.md](SKILL.md); the trial's steps live there.

## Bench design

- The bench assumes mechanically checkable deliverables (code the oracle
  can invoke); for a candidate whose deliverable has no mechanical check,
  build an equivalent spec-keyed check layer or report the oracle layer as
  absent — its verdict weight then rests on the remaining layers.
- Task genre: rule-dense deterministic logic with boundaries and an error
  contract discriminates best — threshold-tiered rules, ordering and
  precedence rules, stateful lifecycle rules, quota or windowing rules.
  Happy-path-only tasks saturate every layer and decide nothing.
- At least two tasks from different rule domains, so a finding is not one
  domain's artifact.
- Pin the interface hard enough that the oracle imports and invokes every
  deliverable unmodified: exact file path, exact export names, exact return
  shapes, one error channel (e.g. thrown errors carrying a `code` field),
  explicit validation order.
- Keep specs decidable: every oracle case must be derivable from the spec
  text alone. Where numeric representation or formatting could diverge, pin
  the algorithm in the spec ("you may implement rounding as ...").
- Mark each worked example as illustrative or authoritative, and generate
  its values by executing the reference implementation — never by hand.

### The authored-bench amplifier

A synthetic bench inflates a candidate's effect whenever the condition the
candidate keys on is something the bench author wrote rather than something
the arm must go and establish. Write a bench where that condition is settled
by a paragraph you authored, and the candidate fires on nearly every item; on
real material the same candidate fires selectively, because the condition is
sometimes true and sometimes not, and finding out costs work.

The tell is a fixture that *states* what the candidate keys on. A rule about
what the verification surface would reveal, keyed on an authored "Verification"
section, is the same failure as a rule about what callers depend on keyed on an
authored consumer list.

Prefer material the arms must interrogate:

- a real repository the arms read to settle the keyed condition themselves;
- a real artifact — plan, design, PR, incident — with defects that a later
  run, review, or fix recorded independently of this trial;
- failing that, an authored bench whose keyed condition is *mixed by
  construction* and whose per-item truth is verified the way an arm would
  verify it, not asserted in the fixture.

Report the bench genre beside the result. An effect measured only on an
authored bench is a hypothesis about the instruction; the same effect surviving
on material the arms had to investigate is evidence about it.

### Real-material benches

Real artifacts buy independence and cost three things:

- **The key is a lower bound, never a rate.** The true defect set is unknown;
  the key holds what some earlier pass happened to record. Score recall as a
  count against that key and arbitrate everything outside it on its merits — an
  arm finding a real defect the key omits is right, not a false positive.
- **Leak-proof the context.** Real repositories carry their own answers:
  execution reports, issue documents, post-mortems, fix commits. Name the
  excluded paths in the arm prompt, require each arm to log every skipped hit,
  and audit those logs before scoring — an arm that read the answers is void
  for the oracle layer, whatever else it produced. Check the candidate artifact
  itself too: a plan that cites its own prior run hands the arms a pointer.
- **Pin the revision.** Record the commit every arm reads. A repository that
  moves between arms is a different bench.

## Arm prompt template

Treatment and control share every line except the candidate block:

```text
You are one run of an experiment. Your working directory is {RUN_DIR} —
work ONLY inside it; do not read or write anything outside it.
Read SPEC.md and implement exactly the pinned interface.
{DELIVERABLE_BAR — identical in both arms, phrased as an outcome}
{CANDIDATE_INSTRUCTION — treatment arm only, verbatim}
Maintain PROCESS_LOG.md: one numbered line per significant step, in the
order taken.
Do not ask the user anything; resolve ambiguities from the spec and record
each resolution.
Final message: deliverable status and the ambiguities you resolved.
```

When the candidate instruction itself names a deliverable, mirror an
outcome-equivalent bar into the control arm so the arms differ by process
only — e.g. a candidate that mandates producing tests pairs with a control
bar of "deliver a test suite thoroughly covering the spec's behavior".

## Anonymization and leak check

1. Copy only deliverable files into fresh per-label directories; exclude
   process logs and run metadata.
2. Shuffle the label order; record the label→run mapping outside the judged
   tree.
3. Search the anonymized tree for arm-identifying vocabulary — the
   candidate instruction's leading words, arm names — before dispatch; a
   hit means re-scrub, then re-search.

## Judge prompt template

```text
You are a blind quality judge. Directory: {JUDGE_DIR} — it contains SPEC.md
and N anonymous solutions P1..PN produced under different conditions you
must not try to guess. Read only within this directory.
Read the spec fully, then every solution fully.
Rank all solutions (1 = best) on: {PRE_REGISTERED_DIMENSIONS}.
Judge only what is in the files, against the spec alone. Do not run
anything.
Final message: exactly this JSON and nothing else —
{"rankings": {...}, "notes": {...}, "flags": ["specific observations with
solution id"]}
```

At least two judges per task. Independent means: each judge runs in its own
fresh context, sees neither another judge's output nor any arm metadata,
and receives the identical prompt. Compare results for agreement. Judges
flag; they do not decide — arbitration executes the flags that matter.

## Arbitration probes

For each verdict-deciding judge claim, write the smallest executable probe:
the input the claim says misbehaves, run against every arm's deliverable,
with the expected value derived from the spec. Probe judge-invented
requirements the same way — a claim the spec does not make downgrades the
judge note, not the solution.

## Adherence check

Search each process log for the instruction's observable markers (the
steps the treatment requires) and for spontaneous adoption in the control
logs. Quote log lines in the report: adherence is demonstrated, not
assumed.

## Cost accounting

Per run: tokens, tool calls, wall time, from the runner's own accounting.
When that telemetry is unavailable, take wall time and step counts from the
process logs and report the missing metrics as unavailable, never zero.
Report per-arm means and the ratio. Cost is a first-class outcome — an
instruction that changes nothing but cost has a verdict.

## Report skeleton

```text
# Trial: {candidate instruction, one line}
Pre-registration: {inline or link}
## Oracle (held-out)            — result per run; saturation note
## Blind ranking                — per task, per judge; agreement
## Arbitrated findings          — claim → probe → result
## Adherence                    — quoted evidence per arm
## Cost                         — per-arm means, ratio
## Directional hypotheses       — statements tied to the data above
## Threats to validity          — from the standing list, plus trial-specific
```

## Threats to validity (standing list)

- Small replication count: direction, never statistics.
- One runner model: instruction effects can be model-relative.
- Pinned interfaces compress the design-quality dimension.
- The oracle sees only what it covers — a saturated oracle plus a
  judge-found, probe-confirmed defect is an expected shape, not a
  contradiction.
- The control bar is outcome-pinned, so the trial compares process
  prescription against outcome prescription, not against no requirement.
- An authored bench amplifies any candidate whose keyed condition the author
  settled in the fixture; on an authored bench, report the measured effect as
  an upper bound.
- On real material the key is a recorded subset of the true defect set, so
  recall is a lower bound and arm-to-arm recall gaps are weaker evidence than
  the same gap on a keyed bench.
