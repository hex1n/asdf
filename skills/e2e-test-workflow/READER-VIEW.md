# Reader View

Create a desktop reading view of the finalized Markdown plan or report. Markdown
stays canonical: the page adds no plan facts or test results. Trace every value to
that artifact, the consumed plan, or linked evidence. Skip HTML when the user asks
for Markdown only.

Save the same-stem `.html` beside the artifact. Regenerate the view when its source
changes; preserve historical runs. For a redesign of a historical artifact, create
a separately named preview, retaining the source links and revision. Open the page
when the session can, and return its absolute path. Keep screenshots and DOM dumps
in OS temp, or in the run's attachments when they are evidence.

## Routine execution reports

For a Chinese report using the accepted layout, follow
[report/v1](references/REPORT-FORMAT.md) and run
[render_report.py](scripts/render_report.py). It uses the bundled
[report.css](references/report.css), preserves the Markdown body and computes
the scenario inventory. The executor writes the business facts once; no HTML
author is needed. Legacy reports are adapted in a separate copy with their
facts and provenance preserved. Rendering alone never changes a test verdict.

Run automated structure/link checks each time. Review business expectations and
conclusions against their evidence when they change, then inspect the opening
and longest affected case in a browser. Template or navigation changes require
the full [visual/interaction check](references/READER-DESIGN.md#checks-before-delivery). After a local fix, repeat the affected
checks; reuse still-valid evidence for unchanged parts. Record check results
outside the reader-facing page.

Plans, other interface languages, and an explicitly requested new layout use
the [design hand-off](references/READER-DESIGN.md). A rendering error follows report/v1's failure path;
it does not automatically start a new model-author loop.
