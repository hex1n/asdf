---
name: meta-loop
description: >
  Improvement loop for the work loop itself. Use when the user asks to run the
  meta loop, analyze loop health, 跑元循环, 月度循环复盘, harvest improvement
  candidates, or when a scheduled asdf-meta-loop task fires. Reads the taskloop
  outcome ledger first (terminal states, episodes, criterion-input drift,
  abandoned reasons), then the session corpora as the behavioral lens, harvests
  de-identified candidates, and processes exactly one per fresh-context round
  through the evidence loop.
argument-hint: "[optional: a specific candidate or indicator to focus on]"
---

# Meta Loop

This skill answers one question: **where is the human still doing machine
work?** It never edits business code; its deliverables are metric readings,
candidates, and evidence-gated rule changes at the narrowest level.

## Workflow

### 1. Read The Outcome Ledger First

The loop's own record is the primary signal: read `~/.taskloop/outcomes.jsonl`
(one row per task close) for the terminal-state distribution
(`done`/`not_needed`/`abandoned`), the rounds and episodes each task spent, the
`criterion_input_drift` rate (a green whose check files were edited), the
`review_level` (how independently each task was checked before closing), and the
`abandon --reason` clusters. Rising `abandoned` or a repeated reason names a
loop stage that keeps failing; drift names a sensor being weakened; many
episodes per task names resume friction; **`review_level: none` correlating with
reopened/reworked tasks names criterion-weak work that closed on a rubber-stamp
criterion without an independent second sensor**. `python
scripts/analyze-sessions.py` computes these as indicators 5–6; the ledger is the
source, not a byproduct.

Completion criterion: each ledger signal that moved has a named loop-stage
hypothesis, sourced from the ledger rows, not from recollection.

### 2. Then The Behavioral Lens (Corpora)

The session corpora are the complementary lens — where the human still acts as
a mechanical role. `analyze-sessions.py` also computes behavior indicators 1–4
(pulse words, no-criterion openings, scope-drift corrections) over a rolling
window; these outputs are local, gitignored, and carry personal prompt text
that never enters the repository. Read direction, not levels: machine-regex
counting reads low, so a flat number means the play was not adopted — check
adoption (are the loop skills and gate actually used?) before proposing any
mechanism.

Completion criterion: every moved indicator has a named hypothesis; every flat
indicator has an adoption check, not a mechanism proposal.

### 3. Harvest Candidates

Turn the signals into candidates: an abandoned-reason or drift cluster from the
ledger, a correction/abort cluster from the corpora, or a runtime memory
summary when present. De-identify wording (no source project vocabulary) and
dedupe against the causes already recorded in `docs/rework-log.md`.

Completion criterion: a candidate list where each entry names the failure
mode and its narrowest target level — machine (gate/CLI error message,
criterion adapter, hook check) before prose (skill text, contract card).
Rules default into the machine, not prose.

### 4. One Candidate Per Round

Process exactly one candidate per fresh context round using the evidence
loop in AGENTS.md: baseline → narrowest edit → re-validate → independent
falsification when the high-stakes conditions hold. Record the Round format.
Never batch candidates into one round; never accept on the author's re-read.

Completion criterion: the round ends accept / continue / reject with
artifacts, and at most one candidate was touched.

### 5. Land Or File

Accepted edits land at the target level and ride distribution via the commit
boundary. Rejected or unproven candidates are filed as provisional with the
evidence gap named, so the next monthly run picks them up instead of
re-deriving them.

Completion criterion: nothing is half-landed; every candidate is either
landed with passing checks or filed with its missing evidence named.

## Evidence Pointer Hygiene

Any evidence pointer that lands in a reading, candidate, or report — a commit
hash, a file path, a ledger row id — is resolved once, live, at write time
(`git cat-file -t <hash>`, read the file, grep the ledger). If it no longer
resolves, repoint it to what is resolvable at write time or mark it explicitly;
never ship a pointer copied from a session transcript without re-resolving it.
History can be rewritten before a report ships, so an unverified hash is the
most common stale pointer — and a report that flags others' bookkeeping must not
inherit the same fault. (Observed: a taskloop review cited two commit hashes
that no longer resolved and trusted ledger counters it never spot-checked.)
