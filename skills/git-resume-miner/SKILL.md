---
name: git-resume-miner
description: Analyzes a specified Git author's commits, diffs, and surrounding code to extract evidence-backed backend project contributions, resume bullets, and interview stories. Use when the user wants to mine Git history for resume content, interview preparation, contribution summaries, STAR stories, or project experience writeups grounded in actual code.
---

# Git Resume Miner

## Quick Start

When the user provides a repository and Git author, first collect evidence:

```bash
python3 scripts/git_resume_miner.py --repo . --author "name-or-email" --since 2024-01-01 --until 2024-12-31 --format markdown
```

Then use commit metadata only as an index. Final claims must come from diffs, current code context, data models, integration points, and workflow behavior. Follow the user's language by default. If no author is provided, ask for the Git author name or email before analysis.

## Required Inputs

- Repository path, Git author name/email/regex, optional date or revision range, target role, seniority, resume language, and privacy constraints.

## Workflow

1. Extract evidence with the script or equivalent `git log` commands: commits, dates, subjects, changed files, insertions/deletions, top directories, file types, activity, and categories. Exclude merges unless ownership matters.
2. Establish project positioning before feature narrative:
   - infer the large system/project from repo name, modules, package layout, domain folders, facades, configs, and data model
   - separate `large project`, `subsystem/domain`, `user-owned workstream`, and `specific feature evidence`
   - treat a product integration or one demand as a contribution under the larger project unless the whole repo is dedicated to it
3. Cluster commits into candidate workstreams:
   - product feature, domain workflow, external integration, data model, reliability, bugfix, test/tooling
   - treat vague subjects like "修改" only as weak evidence until the diff and code confirm meaning
4. Inspect representative diffs and surrounding code: central changes; domain/API/database/integration/risk/test files; entry points; orchestration; domain model; external clients/callbacks/config/error handling; tests and operational hooks.
5. Build a contribution ledger:
   - `observed`: directly supported by commit metadata, diffs, code, tests, docs
   - `inferred`: plausible technical impact from observed evidence
   - `needs confirmation`: business metrics, user impact, production outcomes, ownership scope
6. Group work into narratives: feature delivery, backend/domain modeling, integrations, data migration, reliability, performance, security, risk, testability, tooling, CI/CD, and maintainability.
7. Choose the output mode:
   - `analysis`: evidence ledger, contribution map, code references, confidence labels
   - `resume-ready`: project description plus 3-5 polished bullets, preferring 4; no evidence labels in final bullets
   - `interview`: STAR stories plus architecture, data, integration, and failure-handling talking points
   - `compact`: one project description plus four strongest bullets for a resume
8. Draft bullets using backend resume best practice and STAR framing:
   - for Chinese resumes, title the section `核心贡献`; for English resumes, use `Key Contributions`
   - contribution labels must be problem/domain themes, not bare technology tags; put the technology inside the sentence
   - project experience order: Situation as large-system context, Task as ownership boundary, Action as technical choices, Result as observed or user-supplied outcome
   - keep project descriptions business-first; put mechanisms such as state machines, queues, locks, and idempotency in bullets unless they define the product
   - include metrics when observed; otherwise keep `needs user metric` only in analysis notes, not in resume-ready bullets
   - apply a 20-second scan test: each contribution must quickly show scope, technical judgment, solved problem, and result value
   - keep DTOs, constants, table fields, and query methods in evidence; elevate bullets to domain model, persistence model, external contract, integration boundary, consistency, or reliability
   - replace weak verbs like "participated" with precise ownership verbs when evidence supports it
   - deduplicate before finalizing: merge overlapping bullets and drop summary bullets without a unique problem, decision, or result
   - compress final bullets: remove repeated product names and long stage lists when the project description already provides context
9. Run the senior quality gate before finalizing:
   - ownership boundary is clear
   - system complexity or scale is visible
   - technical decision is explicit
   - solved problem is concrete
   - result value is credible from evidence or marked as a metric question
   - titles are domain/problem oriented, not bare engineering nouns such as orchestration, abstraction, modeling, or DTOs
10. Prepare interview assets: project summary, strongest 3-5 bullets, STAR stories, likely questions, and one architecture narrative covering problem, boundary, flow, consistency, reliability, and trade-offs.

## Output Contract

Return:

- Inputs and constraints used.
- Project positioning: large system, subsystem/domain, user-owned workstream, and evidence.
- Contribution map and code evidence table with file/function, behavior, supporting commits, and confidence.
- Key contributions after senior-level abstraction pass.
- In `analysis` mode, label each contribution `observed`, `inferred`, or `needs user metric`.
- In `resume-ready` and `compact` modes, remove evidence labels from final bullets and keep missing metrics as follow-up questions.
- Interview stories and talking points for architecture, data model, integration, failure handling, and trade-offs.
- Follow-up questions only for missing high-value metrics or business context.

## Quality Bar

- Do not invent product impact, revenue, latency, scale, user count, or production outcomes.
- Prefer ownership, architecture, reliability, integration, and reuse signals; avoid bare technology labels, process narration, and low-level artifact lists.
- Prefer concise resume bullets; use 5 bullets only when each adds a distinct senior-level contribution.
- Use short commit hashes and file references as evidence anchors.
- Explain confidence when a contribution is inferred from code shape rather than commit text.
- Do not claim architecture ownership from a tiny patch; separate implementation, design, and maintenance ownership.
- Do not over-index on commit count or lines changed; use them only to prioritize inspection.
- Do not title a resume project after one demand; use the system/project name, then describe the demand as a module or contribution.
- Drop or rewrite any bullet that fails the senior quality gate; do not pad the resume with task-level implementation.
- Redact secrets, customer names, internal hostnames, and sensitive data before quoting.
- Keep bundled examples fictional or anonymized; do not embed real project, customer, product, author, or proprietary domain details in the skill itself.
- Do not send repository content or personal data outside the local environment without explicit confirmation.

## Examples

See [EXAMPLES.md](EXAMPLES.md) and [BEST_PRACTICES.md](BEST_PRACTICES.md).
