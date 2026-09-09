# Review Report Skeleton

Use this skeleton for every report and re-review so runs read alike and a
caller can reconcile them by identifier. Omit an empty section with one line
saying it is empty; keep the verdict and coverage sections always.

## Skeleton

```markdown
verdict: accept-scoped | needs-attention | blocked
mode: fresh-context | self-review | blocked — <host mechanism and launch evidence>
reviewed: <candidate sha or "working tree at <sha>"> against <base sha>; <scope summary>

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
| id | builder disposition | reviewer status | evidence |
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
- Builder dispositions for re-review: `repaired` with the rerun checks,
  `refuted` with evidence, `deferred` with an owner, or `open`. Reviewer
  statuses: `resolved`, `still present`, `refuted`, `unverified`, each from the
  new revision's evidence rather than the disposition text.
- Coverage lists what the review actually touched. Incomplete review is
  reported as a limit, not as acceptance.
