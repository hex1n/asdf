---
name: git-resume-miner
description: Analyzes a specified Git author's commits, diffs, and surrounding code to produce evidence-backed backend project contributions, resume bullets, interview stories, and best-version pruning. Use when the user wants to mine Git history for resume content, analyze repository contributions, prepare interview narratives, or turn code evidence into a concise resume-ready project experience.
---

# Git Resume Miner

## Quick Start

When the user provides a repository and Git author, collect evidence first:

```bash
python3 scripts/git_resume_miner.py --repo . --author "name-or-email" --since 2024-01-01 --until 2024-12-31 --format markdown
```

On Windows, use `python` or `py` if `python3` is unavailable. The script is self-contained and does not read project-specific configuration. It scans the full matching history by default; add `--max-commits N` only for an explicitly bounded exploratory pass. Add `--path service --path api` to narrow scope and `--with-diffs` to include built-in redacted diff excerpts for top inspection commits. The script emits UTF-8 output and includes repo-native workstream candidates derived from code identifiers and co-changed paths, plus current-file presence checks that show whether inspected commit paths still exist on the current branch.

Use script output only as an index. Final claims must come from representative diffs, current code context, data models, integration points, workflow behavior, and tests. If no author is provided, ask for the Git author name or email.

## Inputs

- Repository path and Git author name/email/regex.
- Optional date/revision/path scope, target role, seniority, language, privacy constraints, and output mode.

## Workflow

1. Extract evidence: commits, dates, subjects, changed files, insertions/deletions, top paths, repo-derived terms, current-file presence, inspection plan, and optional diff excerpts. Exclude merges unless ownership matters.
2. Establish project positioning before feature narrative: large system, subsystem/domain, user-owned workstream, and feature evidence. Apply evidence priority: user-provided or corrected framing > authoritative product/architecture docs > current workflow code and tests > repo names, package names, README/POM descriptions, dominant modules, and high-frequency script candidates. Treat weak metadata as clues only; if sources conflict, use a neutral framing and state uncertainty instead of asserting a project title.
3. Cluster candidate workstreams from repo-native evidence: co-changed paths, code identifiers, representative diffs, current code, data models, integration boundaries, operational hooks, tests, and domain workflow. Use script candidates as hints, not labels.
4. Build a contribution ledger with confidence labels: `observed`, `inferred`, and `needs confirmation`. Treat vague commit subjects as weak evidence until code confirms them, and mark commits with low current-file presence as historical evidence until current code, release notes, or user context proves they still matter.
5. Calibrate ownership language before writing bullets:
   - use `designed`, `owned`, or `delivered` only when commits, current code, and diffs support direct ownership of the core design or implementation
   - use `expanded`, `refactored`, `improved`, or `drove` when the work is substantial but the subsystem is clearly multi-author
   - use `participated in` or `contributed to` when evidence shows meaningful work but not end-to-end ownership
6. Run the best-version funnel before writing final bullets:
   - rank candidates by current-code evidence, ownership, senior complexity, distinct failure mode, and business/platform value
   - downgrade historical code that is deleted or absent from the current branch unless the user asks for archaeology
   - merge candidates that solve the same problem; keep weaker real themes as interview backup
   - choose the strongest four resume bullets by value, not chronology, commit count, or changed lines
7. Select output mode:
   - `analysis`: evidence ledger, contribution map, ranking, confidence labels, and weak spots
   - `resume-ready`: polished project description plus 3-5 bullets, preferring 4
   - `compact`: one project description plus four strongest bullets
   - `interview`: STAR stories, architecture narrative, trade-offs, and likely follow-ups
8. Default to `resume-ready` or `compact` when the user asks for "一版", "最佳", "简历版", or a directly usable result. Include only a short evidence note unless the user explicitly asks for full analysis.
9. For `resume-ready` and `compact`, output only the final project framing, strongest bullets, and metric questions. Do not include code paths, contribution maps, candidate rankings, or confidence labels unless the user asks.
10. Run a post-output self-review and rewrite once if needed: remove overstated ownership, duplicate themes, weak support-tool bullets, low-level artifact lists, implementation-layer inventories, unproven metrics, and wording that turns a multi-author subsystem into a single-owner claim.
11. Run the final acceptance gate: one project framing, four strong bullets by default, no low-level artifact lists, no invented metrics, no duplicate problem themes, missing metrics separated as questions, and ownership verbs matching evidence strength.

## Evidence Gates

- Use full-history script output to choose what to inspect; do not write final bullets from the script summary alone.
- For each kept workstream, inspect at least one representative full diff and one current surrounding code path unless the output is explicitly historical.
- Treat `Current file presence` as a pruning signal: high presence strengthens current relevance; low presence requires checking whether the work was deleted, renamed, generated, or replaced before using it as resume value.
- Promote a contribution from `inferred` to `observed` only after code or tests show the workflow, boundary, failure mode, or data model behind the commit subject.
- If the user asks for archaeology or interview preparation, keep deleted but meaningful work as an interview backup instead of a primary resume bullet.

## Output Contract

- Inputs and constraints used.
- Project positioning and evidence-backed ownership boundary.
- In `analysis`: contribution map, candidate ranking, code evidence, confidence labels, and metric gaps.
- In `resume-ready`/`compact`: final project description and strongest bullets only; remove confidence labels, file names, and low-level artifact lists.
- Current-code relevance: note deleted, renamed, or absent evidence in analysis mode; omit or demote it in resume-ready output unless the user asks for historical work.
- Interview stories and talking points when requested.
- Follow-up questions only for missing high-value metrics or business context.

## Quality Bar

- Do not invent product impact, revenue, latency, scale, user count, or production outcomes.
- Prefer ownership, architecture, consistency, reliability, integration, and reuse signals over bare technology labels.
- Keep DTOs, constants, table fields, query methods, and config keys as evidence, not final selling points.
- Do not turn implementation-surface inventories into resume-ready value. If a sentence mainly lists code layers, modules, artifacts, or surfaces, rewrite it as workflow scope, failure mode, technical decision, and result value.
- Use short commit hashes and file references as evidence anchors in analysis mode only.
- Do not treat script categories, commit count, or lines changed as proof of value.
- Do not add project-specific configuration to encode business meaning; read diffs and code instead.
- Do not let one dominant module, repo description, package/POM label, or path term name the whole project unless authoritative docs and current workflows support it.
- Treat built-in redaction as best effort for common secret patterns. Manually redact customer names, internal hostnames, and sensitive data before quoting or sharing.
- Keep bundled examples fictional or anonymized.

## References

See [BEST_PRACTICES.md](BEST_PRACTICES.md) for resume pruning rules and [EXAMPLES.md](EXAMPLES.md) for output shapes.
