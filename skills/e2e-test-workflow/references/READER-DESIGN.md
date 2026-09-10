# Reader design branch

Read for plans, other interface languages, or a user-requested layout change.
Routine report/v1 rendering uses [READER-VIEW.md](../READER-VIEW.md).

## Hand-off

For the design branch, where subagents are available, a fresh-context agent
authors and checks the page.
Select its model using the rules below. Its brief carries this file's path, the
Markdown artifact and consumed plan paths, the output path, source/workspace
boundaries, the user's language request, and any accepted visual reference.
It returns the page path, each check below as passed / failed / not run with its
scope, and every unresolved finding. The parent relays these unchanged; revisions
go back to the author with the finding. Without subagents, author and check here.

### HTML model selection

Apply these preferences only to the HTML author, respecting an explicit user model
choice and the host's available models. Planning, test execution, and business
review keep their own model selection.

| Work | Claude Code preference | Codex preference |
| --- | --- | --- |
| New layout, visual polish, or substantial restructuring of a long report | `sonnet` | `gpt-5.6-terra`, medium effort |
| Fill a visually accepted template or make a bounded local presentation edit | `haiku` | `gpt-5.6-luna`, medium effort |

The supplied scaffold alone is not an accepted template. An unverified preview or
user dissatisfaction with the layout stays in the design tier. Both tiers run the
same delivery checks. Return conflicting source facts or business expectations to
the parent for resolution; a rendering agent cannot decide a new test oracle.
If a template task requires layout redesign or the cheaper author cannot resolve
a delivery defect, give its artifact and concrete finding to a design-tier author.

Set the model through the host's per-subagent invocation option; mentioning a model
in the task prompt does not select it. In Claude Code, use the supported per-call
`model` option or an HTML-specific agent definition's `model` field. In Codex, use
the available spawn model/effort options with a fresh context. Keep the selection
scoped to this child rather than changing the main model or a global override.
If the host cannot select the preferred model, use an available suitable model and
disclose the fallback.

Record requested model and host-confirmed actual model in the hand-off result,
outside the reader-facing HTML. Use invocation metadata or the host's task view
(Claude Code: `/tasks`); if unobservable, report actual model as unknown. A child's
self-description is not confirmation, and model selection alone proves no measured
cost saving. Host references: [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
and [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Page contract

One HTML file contains its basic layout, typography, and status styles. Use
semantic HTML, inline CSS, system fonts, and native `<details>` disclosures.
The delivered page needs no build step, renderer or external style resource;
the generation-time Markdown contract belongs to report/v1.
An optional Mermaid diagram may load externally; keep an equivalent readable
sequence or dependency description when it cannot render. Preserve actual branch
ownership and order. Add a diagram only when it explains flow, dependency, or
recovery better than the text.

Write headings, paragraphs, lists, and numeric comparisons as those HTML elements.
Reserve `<pre>` for code or raw evidence whose whitespace matters. Convert Markdown
tables to HTML tables; report prose and whole Markdown documents are not raw logs.
Escape evidence, keep UTF-8, localize prose, and retain identifiers and status words.
Status is always text as well as colour, including in diagrams.

Each scenario has one complete case section. An overview summarizes and links
to it; it never substitutes for the full expected inputs, results, or authority.
The case owns its conclusion, expected/actual comparison, evidence, runtime context,
retained resources, and continuation details. Keep shared facts once with explicit
applicability and links from inheriting cases into that detail. Put canonical report,
plan, and attachment links in the case's labelled sources disclosure: the Markdown
is the view's source, not a separate reader-facing report destination. A companion
page needs a concrete size/navigation need and the same checks as the main page.

## Scaffold and reading order

Start from [reader-shell.html](reader-shell.html), copying its inline
CSS into the output. It is a reference skeleton, not a renderer: replace its
placeholders and example slots with source-backed content, remove unused blocks,
and adapt layout to content length. Existing pages may adopt the same structure.
Keep source facts complete while changing their presentation. Use a compact left
contents rail, the main reading column, and optional concise report metadata on the
right. Navigation leads to the overview and cases. Reflow the rails at narrow widths.

Use three reading levels:

1. **Overview**: title, date, outcome, source/target identity, conclusions,
   recommendations, and the next action or decision. A report shows all five status
   counts in a compact strip and highlights material
   failures/blockers with links to their details. A plan shows the business outcome,
   highest-risk branches, decisions, and exact first slice. Long paths and hashes
   belong in linked context details; missing revisions stay explicitly missing.
2. **Comparison**: a compact scenario overview in business order, with ID, meaningful
   name, status or readiness, and a short conclusion. For plans, state the expected
   business outcome. For reports, state what happened to the tested object, with a
   decisive observation and material limits; link known related defects. The status
   column carries the verdict, while the conclusion explains the result beyond
   “passed” or “assertions passed”. Preserve the source verdict and its scope.
   Give ID/status only the width they need. Put long inputs, formulas, and prose in
   full-width scenario details outside the overview table. Within a scenario, align
   corresponding fields in small expected/actual tables when comparison is useful.
3. **Cases**: the case opens to its summary and expected outcome; a report aligns
   the actual result beside it.
   Labelled disclosures within it hold full inputs, expectations, authority,
   observations, evidence, runtime context, source identity, rerun, and lifecycle.
   Use failure evidence for a failing case and assertion evidence for a passing one.
   Supporting details start collapsed; a material failing case may start open.
   Report-wide conclusions and recommendations stay in the overview, with links to
   affected cases, rather than separate global failure, context, or conclusion pages.

Failure emphasis in the opening does not reorder the scenario history or dependency
chain. Overview links reach visible case summaries and open the targeted case;
links to nested evidence also open its enclosing disclosures. Keep native details
usable without JavaScript; small inline navigation enhancement is optional.
Disclosure controls make the next reading action clear. Use informative summaries
such as “E03 · confirmed
fee — expected and actual”, rather than repeating “full details” everywhere.

Keep a clear title/section/body hierarchy, comfortable line spacing, and visible
focus. Use normal proportional text for prose and monospace only for identifiers,
formulas, and code. Let descriptive columns wrap; numeric comparisons align by row
and use tabular digits. Short and long scenarios can use different detail layouts.
Wider evidence tables may scroll inside their container, not the entire page.

## Plan view

Use the same overview, contents, case disclosures, and metadata layout as the
execution report. The overview contains the goal, scope, risk branches, outstanding
decisions, and exact first execution slice by ID. Show plan readiness only when
supported by the plan; execution counts and actual results belong to the run view.
Later run findings never silently rewrite a historical plan.

Preserve the business scenario tree. The comparison gives concise inputs and
expected outcomes; each case's detail retains complete
effective preconditions, actions, observations, state footprint, expected results,
authority, implementation evidence, and coverage links. Its data/context and sources
disclosures include fixture preparation, environment assumptions, planned evidence,
and lifecycle/cleanup obligations. Distinguish these planned arrangements from
observed runtime facts. Link inherited setup from each applicable case.

Resolve inherited fields with the atomic rule in
[plan/PLAN.md](../plan/PLAN.md#3-write-the-scenario-tree) for `execution-anchors/v1`.
An older plan keeps its own inheritance rules and scope; shared facts apply only to
the descendants the source names. Keep models, lower-layer mappings, gaps,
`NEEDS-DECISION` / `BLOCKED` / `OUT-OF-SCOPE` / `ASSUMED` items, exclusions, and
execution or authorization notes accessible without duplicating the tree.

## Report view

Show `passed`, `failed`, `blocked`, `unverified`, and `skipped` counts from the selected
scenario records. Apply [the conclusion rule](../run/REPORTING.md#conclusion-and-counts).
Use that business outcome for the overview headline and visible supporting copy;
keep explanations of formulas, assertions, and verdict scope in the linked details.
If the Markdown leads with test terminology, summarize its supported business
finding faithfully; return ambiguity about that finding to the parent.
The opening names significant failures/blockers and the exact next run or decision;
an all-pass report has no invented warning or empty failure panel.
For multiple failures, keep one overall conclusion and a compact list of distinct
issues, each stating its business impact and linking affected cases. Combine cases
only when a shared issue is established; distinguish issue counts from case counts.
If the list is long, show the highest-impact issues first and disclose the remaining
issue count with a direct path to all affected cases. Full evidence stays in cases.

For each selected scenario, retain the full expected inputs and results from the
consumed plan plus approved overrides. Reformatting may shorten the overview, not
the effective contract. Shared preconditions keep their original applicability.
Show actual inputs and deviations separately: changed fixtures, doubles, or a
subset of planned cases never silently replace the expected fields.

Keep expected and actual values directly comparable, preserving units, precision,
null/zero distinctions, and per-field assertions. Each detail includes the terminal
status, oracle, diagnosis, authority, implementation evidence, and evidence links.
Group a shared root cause once and link affected scenarios. Link each existing local
issue from its overview finding and affected
case, keeping the issue's ID and disposition distinct from the scenario verdict.
The issue link supplements the case's required facts. Preserve source/build
identity, exclusions, exact rerun instructions, retained data and lifecycle, cleanup
proof, and outstanding obligations in the accessible details. A linked source alone
does not replace a required fact in the reading view.

## Checks before delivery

Checks 1–3 always apply; use deterministic evidence for unchanged transformations
and review changed business facts. Check 4 requires an actual browser; describe its observed
result or the concrete access failure. A source inspection is not a visual check.

1. **Fidelity**: compare every scenario's effective fields with the Markdown and,
   for a report, its consumed plan: inputs, expectations, authority, observations,
   footprint, dispositions, actual values, oracle, diagnosis, evidence, and cleanup.
   Include shared facts and which scenarios inherit them. Matching IDs or counts
   alone is insufficient; never change an expectation to match an actual result.
2. **Completeness**: reconcile inventories in both directions: coverage, gaps, and
   first slice for a plan; selected IDs, recomputed counts/headline, findings,
   exclusions, retained data, and continuation set for a report. Summaries add no
   facts or implied results. Check each scenario has one full detail home and that
   visible summaries and collapsed details agree. Check the report opening on its
   own against the business-outcome rule in REPORTING.md. Review each comparison row against
   its own evidence: the conclusion identifies the observed business result (or the
   plan's expected outcome), adds information beyond status, and carries material
   limits or related defect links without implying broader success.
3. **Structure and links**: resolve local links and unique fragments within the
   intended report/source boundary. Check overview links reach visible scenario
   headings, disclosure labels identify their contents, and no placeholders remain.
   Ordinary prose and Markdown tables must be semantic HTML, not preformatted dumps.
   Confirm basic styles are embedded and evidence is escaped without corruption.
4. **Visual and interaction**: inspect screenshots at a normal desktop viewport and
   a narrower desktop width, including the opening, longest scenario expanded, and
   any diagrams. The conclusion, material issue, and next step should be findable
   before reading the evidence. Check heading hierarchy, column allocation, text
   wrapping, clipping, and page overflow. Exercise scenario links, disclosures,
   keyboard focus, and evidence links. Check the page with external resources
   unavailable: basic layout and facts must remain usable, with a readable diagram
   alternative. Distinguish verified network conditions from source-only inference.

Fix observed presentation defects and repeat the affected checks. Report each check
as passed / failed / not run, its scope, and remaining findings. Deliver a page with
unresolved visual checks as an explicitly unverified preview; do not call it visually
accepted. Withhold a page with an unfixable fidelity or completeness disagreement,
and deliver the Markdown with that reason instead.
