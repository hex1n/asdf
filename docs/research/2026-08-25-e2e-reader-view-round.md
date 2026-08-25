# e2e Reader View round (2026-08-25)

## Round 1

Supersedes: none (first round on the Reader View deliverable layer)
Improvement magnitude: clear
Generalization confidence: high (two domains — transaction estimation and document export — each with a planner and an executor artifact)
Hard gates: pass
High-stakes escalation: required — the edit changes the deliverable contract of two skills. Pass 1 returned NO-GO (two blockers, both fixed); the focused recheck returned ACCEPT.

Task sample:
- project: transaction estimation (`salesfundmp`)
- command: fresh isolated planner/executor projection from the existing canonical artifacts
- baseline artifact: `salesfundmp/docs/e2e-test/transaction-estimation/2026-08-25-transaction-estimation-e2e-test-plan.md` (431 lines / 38 headings); `.../e2e-run-20260825-rpc/execution-report.md` (420 lines / 36 headings). Neither has a picture-first reader layer.
- candidate artifact: `transaction-plan-reader-round5.html`; `transaction-report-reader-round6.html`
- validation artifact / diff: 1440×1100 PNG renders per round; structural projection audit; relative-link audit (`MISSING_COUNT=0`); adversarial and focused falsification results.

## Observed failure modes in the baseline

- The canonical artifacts are complete, but their opening view is a prose/table index. A human must reconstruct the business path, the risk/verdict, the trust boundary, and the next step from several distant sections.
- Audience-language inversion: a Chinese upstream plan yielded an English executor report because the internal delegation prompt was English. The transport language outranked the artifact audience.

## Candidate rules

- `Reader View`: a picture-first, few-words HTML projection at the canonical artifact's same stem, whose cards link back to the canonical Markdown. It is never a second fact source.
- Opening screen answers four questions without scrolling — planner: outcome, business path, highest risks/decisions, First Test Slice; executor: status distribution, run trustworthiness, failures/blockers and causes, exact rerun set.
- Audience language follows explicit end-user direction, otherwise the upstream plan. A delegation or automation prompt is transport, not an audience-language change.
- Flow diagrams: one unbroken row when readable, otherwise a vertical stepper or a true snake whose wrap connector visibly joins the last box of a row to the first box of the next. A trailing arrow into whitespace is invalid; independent rows must never imply a false transition.

## Second-domain check (Generalization Gate)

Document export — a divergent compact plan/report covering PDF/CSV, historical and current snapshots, one failed case, one environment blocker, and one decision gap. Both views generated from the final contract (`document-plan-reader-final.html`, `document-report-reader-final.html`) and passed structural and link audits. The English source stayed English while the Chinese source stayed Chinese, so the language rule was exercised in both directions rather than only the reported one.

## Wins

- Opening screens answer the preregistered planner and executor questions without replacing Markdown.
- Chinese upstream language survives an English transport prompt; the English second-domain source remains English.
- Status buckets, all root causes, exact rerun dependents (including RR-001/RR-002), risks, decisions, and First Test Slice IDs stay visible and traceable.
- The repaired transaction flow is a true snake: `B1 → B2 → B3 → B4 ↓ B5 → B6 → B7 → B8`, implemented as `grid-template-areas: "b1 b2 b3 b4" / "b8 b7 b6 b5"` so DOM order stays logical while visual order stays continuous.

## Regressions

No unresolved regression. Six planner/executor iterations were needed to clear, in order: English UI inherited from the transport prompt (R1), opening-screen overflow and a lost wrap connector plus literal backticks (R2), bilingual headings (R3), omitted rerun dependents and overflowing root-cause prose (R4), generic labels stuck on the legacy report language (R5). Each was repaired before acceptance.

## Verification

- Adversarial falsification (independent, read-only): NO-GO. Blocker 1 — the planner view's 4-column grid marked `B4` as `arrow-down` while `B5` followed in DOM and `B8` sat fourth on that row, readable as `B4 → B8`. Blocker 2 — HTML linked canonical Markdown, attachments, and `issues/ISSUE-001-historical-csv.md` that were absent from the validation packet, failing the recoverable-evidence gate. Not falsified: Markdown-only escape hatch, canonical-as-sole-source, language samples, status-count reconciliation, absence of scripts/CDNs/auto-open.
- Focused falsification after repair: ACCEPT. Snake renders correctly with no plausible `B4 → B8` reading; `MISSING_COUNT=0` for every non-fragment relative `href` across all four HTML files; the planner view is Chinese, carries all 18 scenario IDs and all four opening groups, and invents no material fact.

## Weakest gate or lowest-confidence claim

Structural instructions alone did not prevent the first false connector — the render-and-inspect pass is what caught it. That pass is currently conditional in both REFERENCEs ("when a local browser capability exists"), so a runtime without a browser can ship an unrendered flow that reads wrong.

Closed by a follow-up edit in the same working tree: the pass is now unconditional in both REFERENCEs, and a runtime without a render capability hands off the canonical Markdown alone and says the Reader View was withheld. The edit is derived from this round's own evidence (the R1-R5 sequence, where every visual defect was caught by the render pass and none by the structural rules); it has not itself been re-run against a fresh sample.

## Deferred gap (out of this round's scope)

Planner-side audience-language resolution was never exercised. Both samples projected a *pre-existing* canonical plan, so `e2e-test-planner/REFERENCE.md` ("follows the canonical plan's language") was always satisfied by the source artifact. The transport-vs-audience rule landed only in `e2e-test-executor/SKILL.md`; `e2e-test-planner/SKILL.md` still says only "use the user's language", which under an English delegation prompt authoring a fresh plan over Chinese requirements reproduces the original failure mode one layer upstream. Needs its own round with a from-scratch planner sample.

## Decision

accept
