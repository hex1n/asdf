# Reader View

The HTML page is the human reading view; the Markdown plan or report stays canonical.
Author one desktop page directly from the finalized Markdown — the same-stem `.html`
beside the plan or report — without a bundled renderer or a separate renderer-input
artifact, and again after any later change to the Markdown; skip it when the user asks
for Markdown only. Once written, open it for the user when the session can (`start` on
Windows, `open` on macOS, `xdg-open` on Linux) and give its absolute path. Render-check
screenshots and DOM dumps are scratch: keep them in the OS temp directory, or under the
run's `attachments/` when they are evidence. Read the page contract, the scaffold, the
view section for this artifact, and the checks. The
page adds no plan facts and no test results of its own: every value on it traces to
the Markdown, the consumed plan, or a linked raw attachment.

## Hand-off

Where the runtime offers subagents, a fresh-context agent authors the page, so the
planning or execution context never loads the rest of this file. Its brief carries:
this file's path as the rules to follow; the artifact's Markdown path and, for a
report, the consumed plan's path; the page's location (the same-stem `.html` beside
the artifact); and the user's language request when one was made. It returns the page
path, each check as passed / failed / not run with its scope, and every unresolved
finding; the parent relays them unchanged and never edits the page. Without
subagents, the current context reads on and authors the page.

## Page contract

One HTML file per artifact. Tailwind from its CDN handles layout and styling and
Mermaid from its CDN draws graph-shaped diagrams; those two scripts are the only
external resources — no other fonts, scripts, or stylesheets, and no app code. Keep
the facts readable when the CDNs are unreachable: real HTML text, tables, and native
`<details>` disclosures, with a Mermaid block's source left legible as its fallback.
Use semantic HTML, UTF-8, labels localized to the audience, the status word as text
beside any colour — diagram nodes included — visible keyboard focus, wrapping tables,
and a desktop layout with room for side-by-side comparison. Escape raw evidence.

Each stable scenario ID has one detailed home on the page; summaries and flow diagrams
link to it rather than restating it. Put supporting text and evidence in expandable
sections. Link the canonical Markdown and raw attachments directly for download or
inspection; a Markdown, SQL, JSON, or log attachment needs no page of its own. Add a
companion page only for a real size or navigation need, and audit it like the main
page. Add a flow or timeline only when sequence, dependency, or recovery benefits from
a diagram; preserve actual branch ownership and order.

## Scaffold

Start from this skeleton when creating a page or replacing its skeleton, and keep its
head, adding only CSS that serves accessibility or the offline fallback; `lang` follows
the page language. A revision of an existing page keeps the head and skeleton it has
and needs only the contract, its view, and the checks.

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{artifact title}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      details > summary { cursor: pointer; }
      pre, code, td { overflow-wrap: anywhere; }
      pre { white-space: pre-wrap; word-break: break-word; }
      .overflow-x-auto { overflow-x: auto; }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-6xl mx-auto px-6 py-10 space-y-10">
      <header>…</header>
      <section id="opening">…</section>
      <section id="scenarios">…</section>
      <section id="facts">…</section>
    </main>
  </body>
</html>
```

- **Header**: artifact title, date, source or target and the revision the source
  records — a missing revision is shown as missing, never replaced with the current
  checkout — a link to the canonical Markdown, for a report also the upstream plan path
  as the report records it, marked when the link points at a copy, and a one-line
  legend for the badges.
- **Opening**: the view section's opening facts as short cards. A Mermaid
  `flowchart LR` for the normal flow or a dependency and recovery chain when the view
  calls for a diagram; a `sequenceDiagram` or `timeline` for a run's ordering when it
  explains a failure. Nodes `click` through to the row or table they summarize and
  carry the status word when they are coloured by status; a conditional path the
  source names (a branch that skips a step) is drawn, never folded into the main line.
  Mermaid stays inside a bordered white card so it reads as part of the page.
- **Scenarios**: one `<table>` grouped by business branch — a header row per branch —
  with the view's columns, the scenario ID in `font-mono`, and the row's details in a
  `<details>` inside it. Status badges: `passed` emerald, `failed` rose, `blocked`
  amber, `unverified` slate, `skipped` stone.
- **Facts**: the remaining plan or run facts as `<details>` groups.
- **Style**: editorial, generous whitespace, one accent colour plus rose for failure
  and amber for warnings; `text-xs uppercase tracking-wider` for labels; a table row
  or a bullet wherever it can replace a paragraph.

## Plan view

Open with the business outcome, the normal flow, the highest-risk branches and
decisions, and the exact first test slice by scenario ID.

Show the scenario tree as a grouped comparison table with **Scenario**, **Expected
Input**, and **Expected Result**. Expand each scenario's effective preconditions,
actions, observation, state footprint, expected results, authority, implementation
evidence, and coverage links in its row. Resolve inherited fields with the atomic
rule in [plan/PLAN.md](plan/PLAN.md#3-write-the-scenario-tree) for an
`execution-anchors/v1` plan; an older plan keeps the inheritance it wrote, shown once
where it wrote it and pointed to only from the rows that inherit it under the source's
own scope. Keep every other plan fact — models,
lower-layer mappings, gaps, `NEEDS-DECISION` / `BLOCKED` / `OUT-OF-SCOPE` / `ASSUMED`
items, exclusions, and any plan-level execution or authorization note — accessible in
the page.

## Report view

Open with the verdict distribution, the tested target and revision, the significant
failures and blockers, and the exact next run or required decision. Show `passed`,
`failed`, `blocked`, `unverified`, and `skipped` counts from the same selected-scenario
records as the report, and give the headline the conclusion rule in
[run/REPORTING.md](run/REPORTING.md#conclusion-and-counts).

Use a comparison table with **Scenario**, **Expected Input**, **Expected Result**, and
**Actual Result**. Expected fields are the consumed plan's effective fields plus
approved overrides, copied whole — a shared precondition the plan states once is shown
once and pointed to from the rows it covers; a run that used other inputs, fixtures,
doubles, or a subset of the planned cases shows that in the Actual column as a
deviation, and the row keeps the plan's authority and implementation evidence. Actual
fields come from this run.
Make each terminal status visible, with oracle,
diagnosis, evidence, and full effective details expandable in the same row. Group each
shared root cause once and link its affected scenarios. Keep the facts needed to audit,
rerun, or clean up — source and build identity, rerun command, retained data and its
lifecycle — accessible in the page, preserving canonical paths and provenance.

## Checks before delivery

Checks 1–3 need no browser and always run. Check 4 runs when a headless or real
browser is available, and is reported as done or not done, never implied.

1. Reconcile scenarios by ID and compare effective field values with the Markdown:
   expectations, authority, observations, footprint, and dispositions, and for a
   report also actual values, oracle, diagnosis, evidence, and cleanup state, checked
   against both the report and the consumed plan. Matching IDs or row counts alone do
   not establish fidelity. Never resolve a mismatch by changing an expected result to
   the actual result.
2. Check inventories in both directions: coverage, gaps, and the exact first slice for
   a plan; recomputed counts and headline, selected IDs, unresolved findings,
   exclusions, retained data, and the continuation set for a report. Summaries
   introduce no additional facts or implied results.
3. Check local links and fragments, including raw attachment targets, for existence
   within the intended report or source boundary; preserve UTF-8 and raw evidence.
4. Render at a normal desktop viewport with network access so both CDNs load, and
   inspect the opening, scenario details, tables, diagrams, links, focus, wrapping,
   and overflow; fix clipped content and misleading status or flow presentation. When
   the CDNs are unreachable the check covers only the unstyled fallback — say so.

Deliver the page either way and report each check as passed, failed, or not run, with
its scope (styled render or unstyled fallback) and every unresolved finding; a page
whose check 4 did not run is delivered as "not visually inspected", never as reviewed.
Withhold it only when check 1 or 2 finds a disagreement with the Markdown that cannot
be fixed — a page that contradicts its source is worse than none — and say so.
