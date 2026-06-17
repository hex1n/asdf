---
name: git-resume-miner
description: Analyzes a specified Git author's commits, diffs, and surrounding code to produce evidence-backed backend project contributions, Resume-Ready bullets, interview stories, and Best-Version Tournament pruning. Use when the user wants to mine Git history for resume content, analyze repository contributions, prepare interview narratives, or turn code evidence into a concise Resume-Ready project experience.
---

# Git Resume Miner

## Quick Start

When the user provides a repository and Git author, collect evidence first:

```bash
python3 scripts/git_resume_miner.py --repo . --author "name-or-email" --since 2024-01-01 --until 2024-12-31 --format markdown
```

On Windows, use `python` or `py` if `python3` is unavailable. The script is self-contained and does not read project-specific configuration. It scans the full matching history by default; add `--max-commits N` only for an explicitly bounded exploratory pass. Add `--path service --path api` to narrow scope, `--with-diffs` for built-in redacted diff excerpts, and `--privacy strict` when diff content should not be printed. The script emits UTF-8 output and includes matched-author summaries, evidence warnings, Workstream Candidates, Current-Code Relevance checks, and next inspection commands.

Use script output only as an Evidence Index. Resume-Ready claims must come from representative diffs, current code context, data models, integration points, workflow behavior, and tests. If no author is provided, ask for the Git author name or email.

## Inputs

- Repository path and Git author name/email/regex.
- Optional date/revision/path scope, target role, seniority, language, privacy constraints, and output mode.

## Operating Language

Use these Leitwörter exactly; avoid synonyms that blur the gates.

- **Evidence Index**: script output used to choose what to inspect, never final proof by itself.
- **Workstream**: a candidate contribution theme anchored in co-changed paths, representative diffs, current code, workflow behavior, and tests.
- **Current-Code Relevance**: whether the changed files or equivalent behavior still exist on the target branch.
- **Ownership Boundary**: what the author can defensibly claim based on evidence, current code, and multi-author context.
- **Observed**: directly proven by representative diffs, current code, tests, or authoritative docs.
- **Inferred**: plausible from commit/path evidence but not directly proven.
- **Needs Confirmation**: blocked by missing author identity, deleted code, ambiguous scope, or absent business context.
- **Best-Version Tournament**: pairwise pruning that keeps the strongest non-overlapping Workstreams.
- **Resume-Ready**: final user-facing project framing and bullets with no internal evidence labels or low-level artifact lists.
- **Metric Question**: missing high-value business or scale metric, asked separately instead of invented.

## Workflow

1. Extract the Evidence Index: commits, dates, matched author identities, subjects, changed files, insertions/deletions, top paths, repo-derived terms, Current-Code Relevance, inspection plan, evidence warnings, and optional diff excerpts. Exclude merges unless ownership matters.
2. Establish project positioning and Ownership Boundary before feature narrative. Apply evidence priority: user-provided or corrected framing > authoritative product/architecture docs > current workflow code and tests > repo names, package names, README/POM descriptions, dominant modules, and high-frequency script candidates. Treat weak metadata as clues only; if sources conflict, use neutral framing and state uncertainty instead of asserting a project title.
3. Cluster candidate Workstreams from repo-native evidence: co-changed paths, code identifiers, representative diffs, current code, data models, integration boundaries, operational hooks, tests, and domain workflow. Use script candidates as hints, not labels.
4. Build a contribution ledger with confidence labels: Observed, Inferred, and Needs Confirmation. Treat vague commit subjects as weak evidence until code confirms them, and mark low Current-Code Relevance as historical evidence until current code, release notes, or user context proves it still matters.
5. Calibrate Ownership Boundary before writing bullets:
   - use `designed`, `owned`, or `delivered` only when commits, current code, and diffs support direct ownership of the core design or implementation
   - use `expanded`, `refactored`, `improved`, or `drove` when the work is substantial but the subsystem is clearly multi-author
   - use `participated in` or `contributed to` when evidence shows meaningful work but not end-to-end ownership
6. Run the Best-Version Tournament before writing final bullets:
   - rank Workstreams by Current-Code Relevance, Ownership Boundary, senior complexity, distinct failure mode, and business/platform value
   - when 3+ candidates remain, compare them pairwise and eliminate weaker, overlapping, or less defensible themes
   - downgrade historical code that is deleted or absent from the current branch unless the user asks for archaeology
   - merge candidates that solve the same problem; keep weaker real themes as interview backup
   - choose the strongest four resume bullets by value, not chronology, commit count, or changed lines
7. Select output mode:
   - `analysis`: evidence ledger, contribution map, ranking, confidence labels, and weak spots
   - `resume-ready`: Resume-Ready project description plus 3-5 bullets, preferring 4
   - `compact`: one project description plus four strongest bullets
   - `interview`: STAR stories, architecture narrative, trade-offs, and likely follow-ups
8. Default to `resume-ready` or `compact` when the user asks for "一版", "最佳", "简历版", or a directly usable result. Include only a short evidence note unless the user explicitly asks for full analysis.
9. For `resume-ready` and `compact`, output only the Resume-Ready project framing, strongest bullets, and Metric Questions. Do not include code paths, contribution maps, candidate rankings, or confidence labels unless the user asks.
10. Run a Resume-Ready Defense Check before returning: use the adversarial post-output self-review in [BEST_PRACTICES.md](BEST_PRACTICES.md#resume-ready-defense-check) to argue against the strongest bullet and project framing, require a defensible claim for every final bullet, then remove overstated ownership, duplicate themes, weak support-tool bullets, low-level artifact lists, implementation-layer inventories, unproven metrics, and wording that turns a multi-author subsystem into a single-owner claim.
11. Run the final acceptance gate: one project framing, four strong bullets by default, no low-level artifact lists, no invented metrics, no duplicate problem themes, missing metrics separated as questions, and ownership verbs matching evidence strength.

## Evidence Gates

- Use the full-history Evidence Index to choose what to inspect; do not write final bullets from the script summary alone.
- Confirm `Matched Authors` first. If zero commits or multiple identities appear, resolve the author/date/path scope before writing ownership claims.
- For each kept Workstream, inspect at least one representative full diff and one current surrounding code path unless the output is explicitly historical.
- Use the script's `Next check` commands as the minimum follow-up: inspect the full diff, path history, and current file before promoting a theme.
- Treat `Current-Code Relevance` as a triage signal: high presence strengthens current relevance; low presence requires checking whether the work was deleted, renamed, generated, or replaced before using it as resume value.
- Promote Inferred to Observed only after code or tests show the workflow, boundary, failure mode, or data model behind the commit subject.
- If the user asks for archaeology or interview preparation, keep deleted but meaningful work as an interview backup instead of a primary resume bullet.

## Output Contract

- Inputs and constraints used.
- Project positioning and evidence-backed Ownership Boundary.
- In `analysis`: contribution map, candidate ranking, code evidence, confidence labels, and metric gaps.
- In `resume-ready`/`compact`: Resume-Ready project description and strongest bullets only; remove confidence labels, file names, and low-level artifact lists.
- Current-Code Relevance: note deleted, renamed, or absent evidence in analysis mode; omit or demote it in Resume-Ready output unless the user asks for historical work.
- Interview stories and talking points when requested.
- Follow-up questions only as Metric Questions.

## Quality Bar

- Do not invent product impact, revenue, latency, scale, user count, or production outcomes.
- Prefer ownership, architecture, consistency, reliability, integration, and reuse signals over bare technology labels.
- Keep DTOs, constants, table fields, query methods, and config keys as evidence, not final selling points.
- Do not turn implementation-surface inventories into Resume-Ready value. If a sentence mainly lists code layers, modules, artifacts, or surfaces, rewrite it as workflow scope, failure mode, technical decision, and result value.
- Use short commit hashes and file references as evidence anchors in analysis mode only.
- Do not treat script categories, commit count, or lines changed as proof of value.
- Do not add project-specific configuration to encode business meaning; read diffs and code instead.
- Do not let one dominant module, repo description, package/POM label, or path term name the whole project unless authoritative docs and current workflows support it.
- Treat built-in redaction as best effort for common secret patterns. Manually redact customer names, internal hostnames, and sensitive data before quoting or sharing.
- Keep bundled examples fictional or anonymized.

## References
See [BEST_PRACTICES.md](BEST_PRACTICES.md) for resume pruning rules and [EXAMPLES.md](EXAMPLES.md) for output shapes.
