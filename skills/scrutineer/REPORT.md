# Review Report Skeleton

Use this skeleton for every report and re-review so runs read alike and a
caller can reconcile them by identifier. Omit an empty section with one line
saying it is empty; keep the verdict and coverage sections always.

## Skeleton

```markdown
verdict: accept-scoped | needs-attention | blocked
mode: fresh-context | self-review | blocked — <host mechanism and launch evidence>
review_series: <id from the handoff>; round <n>
brief: inline | file <path> — <content identity of the brief as received>
reviewed: <candidate sha or "working tree at <sha>" with its content identity> against <base sha>; <scope summary>

## Findings
### F1 — <title>
- severity: critical | high | medium | low (by consequence)
- attribution: introduced | pre-existing | unknown
- evidence: observed | source-established
- location: <path:line at the reviewed revision>
- line: <verbatim text of the triggering line; for a generated symbol, the generator's line>
- trigger: <input or state that reaches it>
- contract: <requirement, contract, or structural goal violated>
- consequence: <what goes wrong and for whom>
- evidence detail: <command, observation, or source path that decides it>
- repair constraints: <what a fix must restore or preserve; optional>

## Unverified risks
### R1 — <title>
- severity: critical | high | medium | low (consequence if the concern holds)
- unknown: <the missing observation or premise>
- smallest resolving check: <command or inspection>
- blocks: <which conclusion it prevents>

## Decision items
### D1 — <title>
- kind: scope deviation | pre-existing defect | target-versus-preservation conflict
- severity, attribution, evidence: as for a finding; a pre-existing defect keeps
  its confirmed label and fields here
- evidence detail: <what shows it>
- decision needed: <the question for the user>

## Optional improvements
### O1 — <title>: <concrete benefit>

## Parity ledger            (alignment or parity work only)
| obligation | expected | actual | evidence or gap |

## Coverage
- examined in depth: <files, paths, contracts>
- sampled or skipped: <surfaces and why>
- checks run: <command, revision, observation> per check
- limits: <unavailable inputs, failed tools, timeouts, truncation>

## Re-review               (on a requested re-review only)
| id | fact status | builder action | reviewer status | evidence |
```

## Rules

- `verdict` is `needs-attention` when any confirmed finding exists or a credible
  high-impact risk stays unverified; `accept-scoped` when neither exists in the
  inspected scope; `blocked` when the review could not be established or
  completed. A coverage limit never turns `needs-attention` into `accept-scoped`.
- Severity measures consequence; the evidence class says how a finding is
  established. A concern resting on an unchecked premise is an R at any
  severity, so a critical risk stays visible without being reported as
  confirmed; a critical or high R may receive the one-shot falsification check
  and becomes an F only when the observation establishes it. A well-evidenced
  nit stays optional.
- `location` names the reviewed revision and `line` quotes the triggering
  text, so a reference survives the builder's edits and a re-review matches on
  content rather than line numbers. A concern with no quotable line is an R,
  not an F.
- Dispositions apply from the first report onward; the re-review table adds
  the reviewer's check of the new revision. `fact status` is whether
  the finding holds: `confirmed` with its attribution, `refuted`, or
  `unverified`. `builder action` is what the builder did: `repaired` with the
  rerun checks, `refuted` with evidence, `deferred` with an owner, or `open`.
  `reviewer status` is what the new revision shows: `resolved`,
  `still present`, `refuted`, or `unverified`, each from the new revision's
  evidence rather than the action text. `repaired` becomes `resolved` only
  from that evidence; `deferred` keeps `confirmed` and its owner and grants no
  acceptance. Ids stay stable across rounds within a review series; sub-items
  carry their own ids, a merged or reclassified finding keeps its id or names
  the alias, and a new finding never reuses an old id.
- When the builder's evidence and the reviewer's conclusion point opposite
  ways, the report carries both side by side with the observation each rests
  on. The user decides; relabeling the finding settles nothing.
- Coverage lists what the review actually touched. Incomplete review is
  reported as a limit, not as acceptance.
