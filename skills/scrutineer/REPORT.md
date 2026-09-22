# Review Record And Report

A review produces two artifacts. The **record** is JSON and is authoritative:
[review-record-schema.json](review-record-schema.json) defines it, [scripts/validate-review-record.cjs](scripts/validate-review-record.cjs)
checks it, and a caller reconciles rounds by its ids. The **prose report** is
rendered from that record for the person reading it, in the user's language.

Write the record first. Prose written first and a record fitted to it afterwards
inverts the dependency, and the two drift on the first correction. Neither
artifact may carry a verdict, severity, evidence class, or limit the other does
not.

## Delivery and retention

Return the record and prose in-band for a review that needs no saved output or
later continuation. When saving is requested or needed for repair/re-review,
use the user's output path; otherwise use `.scratch/review-YYYYMMDD-topic/`
under the target repository, with the review start date and a short subject.
Choose an unused name for a new series; reuse the directory for re-review.
Keep existing audit directories and their references intact.

Save `review-record.json` and `review.md`. The prose links the JSON rather than
embedding another copy. On later rounds, preserve the previous pair and write
`review-record-r2.json` and `review-r2.md` (and so on); link the prior record for
id reconciliation. The record remains the authority for every round. When the
delivered record differs from the one the reviewer returned, keep the returned
one unchanged as `evidence/returned-record.json`, so the difference stays
checkable under [Delivered record](#delivered-record).

Create `evidence/` only for material needed to substantiate findings, reproduce
checks, or continue the review. Capture the exact relevant input, command,
revision, and observation; retain source/input snapshots when a path or hash
alone cannot recover them. A compact task brief belongs here when needed for
continuation. Existing durable evidence can be linked without copying it.

Create `diagnostics/` only for launch failures, troubleshooting, or requested
execution replay. Startup logs, launch scripts, and full transcripts are not
routine deliverables. Put sufficient observed launch facts in
`mode.host_evidence`; retain the necessary receipt excerpt if a reference will
not remain available. Evidence essential to a finding is retained evidence,
even if it was first captured during troubleshooting. Do not delete existing
files or break report links to achieve a smaller directory.

## Record

Return the record in-band unless the handoff names an output path. Write it
from this template: one `entries` item per concern, of the kind it is, and
`parity_ledger` and `re_review` only for parity work and for a round after the
first.

```json
{
  "verdict": "accept-scoped | needs-attention | blocked",
  "mode": { "context": "fresh-context | self-review | blocked", "host_evidence": "<launch facts>" },
  "review_series": "<the brief's review_series>",
  "round": 1,
  "brief": { "source": "inline | file", "path": "<the brief's path, when source is file>", "content_identity": "sha256 <hex of the brief as received>" },
  "reviewed": { "candidate": "<revision reviewed>", "base": "<revision it is compared against>", "scope": "<what the review covered>" },
  "entries": [
    {
      "kind": "finding", "id": "F1", "title": "<...>",
      "severity": "critical | high | medium | low",
      "attribution": "introduced | pre-existing | unknown",
      "evidence": "observed | source-established",
      "location": { "file": "<path at the reviewed revision>", "line": 1 },
      "line_text": "<the triggering line, verbatim>",
      "trigger": "<conditions that reach it>",
      "contract": "<the obligation it breaks>",
      "consequence": "<what goes wrong>",
      "evidence_detail": "<the observation or source reading that establishes it>",
      "repair_constraints": "<what a repair must preserve, when there is any>"
    },
    {
      "kind": "risk", "id": "R1", "title": "<...>",
      "severity": "critical | high | medium | low",
      "unknown": "<the unchecked premise>",
      "smallest_resolving_check": "<the check that would settle it>",
      "blocks": "<the conclusion it prevents>"
    },
    {
      "kind": "decision", "id": "D1", "title": "<...>",
      "decision_kind": "scope deviation | pre-existing defect | target-versus-preservation conflict",
      "severity": "critical | high | medium | low",
      "attribution": "introduced | pre-existing | unknown",
      "evidence": "observed | source-established",
      "location": { "file": "<path, when there is a line to quote>", "line": 1 },
      "evidence_detail": "<...>",
      "decision_needed": "<the choice the user owns>"
    },
    { "kind": "optional", "id": "O1", "title": "<...>", "benefit": "<the concrete benefit>" }
  ],
  "coverage": {
    "surfaces": [{ "surface": "<a surface of the brief's coverage_plan>", "depth": "in-depth | sampled | skipped", "evidence": "<see below>" }],
    "lenses_applied": ["<LENSES.md section heading>"],
    "lenses_excluded": [{ "lens": "<section heading>", "reason": "<the fact that excludes it>" }],
    "checks_run": [{ "command": "<command>", "revision": "<revision it ran at>", "observation": "<what it showed>" }],
    "limits": ["<what the review could not establish>"]
  },
  "parity_ledger": [{ "obligation": "<...>", "expected": "<...>", "actual": "<...>", "evidence_or_gap": "<...>" }],
  "re_review": [{ "id": "F1", "fact_status": "confirmed | refuted | unverified", "builder_action": "repaired | refuted | deferred | open", "reviewer_status": "resolved | still present | refuted | unverified", "evidence": "<what the new revision shows>" }]
}
```

[review-record-schema.json](review-record-schema.json) fixes the shape; these
are the four fields whose meaning it cannot carry:

- `mode.host_evidence` — the caller-verified launch facts bound to the returned
  session: mechanism, inheritance and read-only settings, session reference,
  brief identity, and the state of each automatic context source the host
  offers (memory, project instructions, a resumed transcript). The caller
  resolves any pending verification under
  [HANDOFF.md](HANDOFF.md#host-mechanisms) before delivery; a role label or
  intended launch command is insufficient.
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

## Delivered record

The reviewer returns the record; the caller delivers it, and the caller is
usually the builder the record judges. Three changes are the caller's on the
way: replacing `mode.host_evidence` with the verified launch facts, never
leaving it marked pending; appending its own `checks_run` rows, each command
prefixed `caller:`; and, when isolation cannot be established, setting
`verdict` and `mode.context` to `blocked` with the gap appended to
`coverage.limits`, whatever verdict the reviewer returned. Every other difference,
a limit dropped, a severity moved, an entry reworded, is a new round with the
changed material as its input. The prose is rendered from the delivered
record, so it changes only where the record did. Check the pair with
`node <skill-dir>/scripts/validate-review-record.cjs <delivered.json> --returned <returned.json>`.

## Independent reads

Each read is delivered and checked as its own record under its own
`review_series` and kept as `read-N/review-record.json`, with its returned copy
beside it. The series record is then built from the delivered reads:

`node <skill-dir>/scripts/merge-review-records.cjs --series <series> --out review-record.json --map merge-map.json read-1=<file> read-2=<file>`

It keeps every entry and renumbers it, places entries on one quoted line next
to each other and marks them `co_located` in the map together with the read and
id each came from, keeps each coverage surface at its deepest depth with every
read's account, and derives the verdict from the merged entries. It merges
first-round reads of one candidate, refuses a read whose host evidence is still
pending, and writes nothing unless the result validates. Co-located entries may
be one defect or several, since two distinct defects on one line do occur, so
the builder verifies each before treating two as one. The prose renders from
the merged record and names the read behind each entry from the map; a
re-review answers the merged ids.

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
  completed, including when the caller cannot verify host isolation, with the
  blocking limit in `coverage.limits`. A coverage limit
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
  runs it on receipt, and adds `--returned <returned.json>` to check its own
  delivery. It cannot judge evidence: a passing record is well-formed, not
  correct.
