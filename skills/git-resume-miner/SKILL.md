---
name: git-resume-miner
description: Mine a specified Git author's commit history into evidence-backed resume or interview material. Use when the user wants to analyze Git contributions, turn commits/diffs/current code into senior or backend resume bullets, prepare interview narratives, compare contribution workstreams, or produce a Resume-Ready/Interview-Ready project experience.
---

# Git Resume Miner

## Quick Start

When the user provides a repository and Git author, start with an **Evidence Index**:

```bash
python3 scripts/git_resume_miner.py --repo . --author "name-or-email" --since 2024-01-01 --until 2024-12-31 --format markdown
```

On Windows, use `python` or `py` if `python3` is unavailable. The script is self-contained and scans full matching history by default. Use `--max-commits N` only for an explicitly bounded exploratory pass, `--path service --path api` to narrow scope, `--with-diffs` for local redacted diff previews, and `--privacy strict` when diff content should not be printed. Keep merge commits excluded unless merge ownership matters.

If no author is provided, ask for the Git author name or email. Completion criterion: `Matched Authors`, `Evidence Warnings`, scope, and privacy mode are understood before making any ownership claim.

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
- **Defense Card**: private check for each final bullet: winning Workstream, evidence basis, ownership verb, overstatement risk, and Metric Question.
- **Resume-Ready**: final user-facing project framing and bullets with no internal evidence labels or low-level artifact lists.
- **Interview-Ready**: interview stories with concise evidence anchors, trade-off defense, likely follow-ups, and ownership boundaries.
- **Metric Question**: missing high-value business or scale metric, asked separately instead of invented.

## Run Contract

1. Extract the Evidence Index: commits, matched identities, changed files, top paths, Workstream Candidates, Current-Code Relevance, inspection plan, evidence warnings, and optional diff excerpts. Completion criterion: the author boundary and scope are explicit.
2. Establish project positioning and Ownership Boundary before writing feature narrative. Evidence priority is user-provided framing, then authoritative docs, current workflow code/tests, then weak metadata such as repo names, package labels, dominant paths, and script candidates.
3. Form Workstreams from repo-native evidence: co-changed paths, code identifiers, representative diffs, current code, data models, integration boundaries, operational hooks, tests, and domain workflow. Script candidates are hints, not labels.
4. Inspect before promotion. For each kept Workstream, read at least one representative full diff and one current surrounding code path unless the output is explicitly historical. Use the script's `Next check` commands as the minimum follow-up.
5. Build the contribution ledger with `Observed`, `Inferred`, and `Needs Confirmation`. Promote Inferred only after code, tests, docs, or user facts show the workflow, boundary, failure mode, or data model behind the commit subject.
6. Calibrate Ownership Boundary before bullets. Use ownership verbs only as strongly as representative diffs, current code, and multi-author context allow.
7. Run the Best-Version Tournament before final output: compare Workstreams pairwise by evidence strength, ownership, senior complexity, distinctness, and result value; merge overlaps; downgrade low Current-Code Relevance unless archaeology was requested; keep the strongest four resume bullets by value.
8. Select output mode. Use `analysis` for evidence ledgers, `resume-ready` for polished project description plus bullets, `compact` for a directly insertable short version, and `interview` for Interview-Ready stories with evidence anchors, trade-off defense, ownership boundaries, and likely follow-ups.
9. Default to `resume-ready` or `compact` when the user asks for "一版", "最佳", "简历版", or a directly usable result. For resume-ready/compact, do not include code paths, contribution maps, candidate rankings, or confidence labels unless explicitly requested.
10. Run the relevant defense branch before returning: Resume-Ready Defense Check for `resume-ready`/`compact`, Interview-Ready Defense Pack for `interview`, and evidence gate review for `analysis`. Completion criterion: every final bullet has a defensible claim, no invented metric, and an ownership verb that survives interview challenge.
11. Return only the selected mode plus Metric Questions. Completion criterion: one project framing, four strong bullets by default for resume output, no duplicate problem themes, and missing metrics separated as questions.

## Reference Pointers

- Open [BEST_PRACTICES.md](BEST_PRACTICES.md#evidence-sampling-script) for Evidence Index limits, redaction, path filtering, and Current-Code Relevance.
- Open [BEST_PRACTICES.md](BEST_PRACTICES.md#best-version-tournament-funnel) before pruning three or more Workstreams.
- Open [BEST_PRACTICES.md](BEST_PRACTICES.md#ownership-verb-calibration) before choosing `owned`, `designed`, `delivered`, `drove`, `expanded`, `contributed to`, or similar verbs.
- Open [BEST_PRACTICES.md](BEST_PRACTICES.md#resume-ready-defense-check) before returning `resume-ready` or `compact`; build private Defense Cards and remove weak or overstated bullets.
- Open [BEST_PRACTICES.md](BEST_PRACTICES.md#interview-ready-defense-pack) before returning `interview`; keep concise evidence anchors and overstatement risks.
- Open [EXAMPLES.md](EXAMPLES.md) only when output shape, pruning examples, or fictionalized resume-ready phrasing would help.
