# Review Record And Report

A review produces two artifacts. The **record** is JSON and is authoritative:
[review-record-schema.json](review-record-schema.json) defines it, [scripts/validate-review-record.cjs](scripts/validate-review-record.cjs)
checks it, and a caller reconciles rounds by its ids. The **prose report** is
rendered from that record for the person reading it, in the user's language.

Write the record first. Prose written first and a record fitted to it afterwards
inverts the dependency, and the two drift on the first correction. Neither
artifact may carry a verdict, severity, evidence class, or limit the other does
not.

## Record

Return the record in-band unless the handoff names an output path. Its fields
are the schema's; these are the four whose meaning the schema cannot carry:

- `mode.host_evidence` — the launch configuration that shows the context is
  fresh, not a role label and not the reviewer's own claim. Without it
  `fresh-context` is the assertion this skill spends four paragraphs refusing
  to accept.
- `location` and `line_text` — the file and line at the reviewed revision, plus
  the triggering line quoted verbatim, so the reference survives the builder's
  edits and a re-review matches on content rather than line numbers. A concern
  with no quotable line is a risk, not a finding, and the schema enforces that
  by requiring `line_text` on findings alone.
- `coverage.surfaces[].depth` — `in-depth` names the checks that reached the
  surface in `evidence`; `sampled` and `skipped` name there why they did not.
- `re_review[].reviewer_status` — what the new revision shows, read from its
  evidence rather than from the builder's action text.

The two lens lists partition [references/LENSES.md](references/LENSES.md):
every section of that file appears once, under `lenses_applied` or under
`lenses_excluded` with the fact that excludes it, spelled as that file spells
it.

## Prose report

Render from the record, findings first, one section per entry kind, keeping
every id, severity, evidence class, and limit the record carries. Omit an empty
section with one line saying it is empty; keep the verdict and coverage
sections always.

```markdown
verdict: <verdict> | mode: <context> — <host_evidence>
review_series: <review_series>; round <round>
brief: <source> <path> — <content_identity>
reviewed: <candidate> against <base>; <scope>

## Findings
### F1 — <title>
- severity / attribution / evidence: <severity> | <attribution> | <evidence>
- location: <file>:<line>  ·  line: <line_text>
- trigger / contract / consequence: <one line each>
- evidence detail: <evidence_detail>
- repair constraints: <repair_constraints, when present>

## Unverified risks
### R1 — <title>
- severity: <severity>
- unknown / smallest resolving check / blocks: <one line each>

## Decision items
### D1 — <title>
- kind: <decision_kind>; severity: <severity>; attribution: <attribution>; evidence: <evidence>
- evidence detail: <evidence_detail>
- decision needed: <decision_needed>

## Optional improvements
### O1 — <title>: <benefit>

## Parity ledger            (alignment or parity work only)
| obligation | expected | actual | evidence or gap |

## Coverage
| surface | depth | evidence or reason |
| lenses applied: <lenses_applied> | lenses excluded: <lens — reason> |
| checks run: <command @ revision — observation> | limits: <limits> |

## Re-review               (round > 1 only)
| id | fact status | builder action | reviewer status | evidence |
```

## Rules

- A decision item carries a finding's own fields because it is a finding the
  user owns rather than the change's defect: a pre-existing defect keeps its
  confirmed label, severity, attribution, and evidence class there, and adds
  `location` when it has one to quote.
- `verdict` is `needs-attention` when any confirmed finding exists or a credible
  high-impact risk stays unverified; `accept-scoped` when neither exists in the
  inspected scope; `blocked` when the review could not be established or
  completed, with the blocking limit in `coverage.limits`. A coverage limit
  never turns `needs-attention` into `accept-scoped`. Only findings and risks
  move the verdict: a decision item is reported for the user's decision and
  leaves it where those two put it, confirmed label and all.
- Severity measures consequence; the evidence class says how a finding is
  established. A concern resting on an unchecked premise is a risk at any
  severity, so a critical risk stays visible without being reported as
  confirmed; a critical or high risk may receive the one-shot falsification
  check and becomes a finding only when the observation establishes it. A
  well-evidenced nit stays optional.
- Pick the severity word from these anchors, so two reviewers of the same
  change land on the same one. Repair cost and evidence strength are not
  inputs; the discriminator is how far the consequence reaches.
  - `critical` — data loss or corruption, a defeated security or tenancy
    boundary, or an outage on a supported path.
  - `high` — a wrong result the caller cannot detect, an unhandled failure on
    valid input, or a removed guard that reopens a defect class the repository
    already closed.
  - `medium` — a real defect the consequence confines: a narrow trigger, a
    visible failure with a workaround, or one caller's broken contract.
  - `low` — a defect whose worst outcome costs a maintainer time: a confusing
    message, a log gap, a misleading name on a live path.
  The medium/high line: `high` reaches the user's data or result silently,
  `medium` stops at one caller or announces itself. When the concrete damage
  resists statement, the severity is lower than it feels.
- Coverage is the claim about what the review touched, and every located entry
  belongs to a surface the record calls `in-depth`. A finding in a sampled or
  skipped surface contradicts itself, so either the surface rises to `in-depth`
  or the concern is a risk. Incomplete review is reported in `limits`, not as
  acceptance.
- Dispositions apply from the first round onward; `re_review` adds the
  reviewer's check of the new revision. `fact_status` is whether the finding
  holds: `confirmed` with its attribution, `refuted`, or `unverified`.
  `builder_action` is what the builder did: `repaired` with the rerun checks,
  `refuted` with evidence, `deferred` with an owner, or `open`.
  `reviewer_status` is what the new revision shows: `resolved`,
  `still present`, `refuted`, or `unverified`. `repaired` becomes `resolved`
  only from that evidence; `deferred` keeps `confirmed` and its owner and
  grants no acceptance. Ids stay stable across rounds within a review series;
  sub-items carry their own ids, a merged or reclassified entry keeps its id or
  names the alias, and a new entry never reuses an old id.
- When the builder's evidence and the reviewer's conclusion point opposite
  ways, both are carried side by side with the observation each rests on. The
  user decides; relabeling the finding settles nothing.
- Check the record before returning it, whenever Node and this skill's
  directory are both reachable:
  `node <skill-dir>/scripts/validate-review-record.cjs <record.json>`, adding the
  prior record's path on a re-review, or `-` to read it from stdin. It applies
  the schema and the rules above it can reach — the fixed vocabulary, the
  verdict against the entries, id stability across rounds, coverage against
  every located entry, the lens partition — and names each violation. A
  reviewer working from an inlined brief has no such directory; then the caller
  runs it on receipt. It cannot judge evidence: a passing record is
  well-formed, not correct.
