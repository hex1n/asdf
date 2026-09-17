---
name: rationale-records
description: >
  Maintain personal docs/rationale records that explain why code is implemented
  this way. Use when a change touches code an existing W-record anchors
  or the callers, producers, or configuration that record depends on, when a
  change leaves a constraint a natural-looking rewrite would break, when
  answering a question took reconstructing a rule from source that no record
  states, when the user asks to record or query such a reason, or during
  worktree handoff of rationale notes.
---

# 代码实现理由记录

Rationale is a personal reverse index from a current code snippet to the reason
it is implemented this way. Each record names the file path (文件路径), code
snippet (代码片段), and implementation rationale (实现理由).
It is not project documentation, requirement history,
evidence, or a second test plan.

Ask only:

> If someone rewrites this code in the obvious more natural way, can real
> behavior become wrong?

If no, do not create a record. If yes, search before writing so one invariant has
one current owner.

Reconstruction asks it too. Deriving a rule from source — to write an independent
expectation, to judge a change, to explain a value — is the cost this index exists
to remove, so pay it once and record the answer. Code that has not changed in a
long time never reaches this skill through a change, and stable load-bearing code
is precisely what a rewrite reaches for.

## Main-checkout workflow

1. Confirm this is the main checkout, not a linked worktree.
2. Search by W-ID, `Class#member`, source path with optional line, and domain
   terms. Treat member results as proximity navigation, then read the code.
3. Add or update an active entry under `docs/rationale/<stable-domain>/`. Name
   files `<NN>-<topic>.md` so their reading order is visible. Start every file
   with a topic and one-line `TL;DR` saying what it records. Split large domains
   by stable subdomain or code ownership, never by requirement.
4. Name the record after what it anchors and title it with what a natural rewrite
   would break; use the exact schema in
   [REFERENCE.md](REFERENCE.md#active-entry-schema). IDs are globally unique names,
   never positions.
5. Write a self-contained code explanation. Assume the reader has not seen the
   surrounding code, use plain but technically precise language, and define
   local terms before relying on them. Explain what the snippet does, where its
   input comes from and output goes, why this order/value/owner is necessary,
   and what behavior changes if it is simplified. Use plain language. When order,
   scale, or parallel paths are hard to see, add only the smallest useful text
   flow, call tree, or pseudocode under the explanation. This instruction is complete in
   itself and does not depend on any other installed skill. Preserve the
   mechanism; remove only tests, proof, dates, incidents, review rounds,
   samples, and history.
6. Run a full check after creating, migrating, or restructuring records. Normal
   Codex and Claude Stop hooks use the incremental check.

Before relying on an existing explanation, check whether the current task
changes its callers, producers, configuration, or dependency semantics even if
the anchored snippet is unchanged. Search affected domain terms and source
references, then reread only the explanations whose assumptions could change.
Update or remove stale explanations from current code; preserve a missing fact
as unresolved rather than treating an anchor match as semantic validation.
In linked worktrees, put this correction in the handoff note instead of editing
active records.

The checker proves only mechanics: ordered files, exact schema, unique W-IDs,
existing source paths, and file-unique token snippets. Snippet matching ignores
whitespace, indentation, and line breaks but preserves strings, comments, and
token boundaries. It cannot decide what prose
means. Do not replace the semantic boundary with a keyword blacklist. Before
handoff, read every explanation changed in the task and keep only sentences
needed to teach the anchored code's current mechanism; how it was discovered,
who decided it, dated outcomes, and verification material belong elsewhere.

Active records are personal memory: keep `docs/rationale/` Git-ignored and never
stage or commit it. The checker state and handoff receipts live under the user's
`.agents/state/rationale-records`, not in the repository.

## Linked-worktree workflow

The linked worktree never writes or formally validates active rationale. Complete
the code task, then create one unnumbered note only when a qualifying invariant
was found; otherwise explicitly create a `none` handoff. Seal either outcome in a
manifest with `handoff-create`.

After the task commit is integrated, run `handoff-consume` from the main checkout.
For a note, first merge its current code explanation into active rationale and write the
small resolution file described in the reference. Consumption validates all code
changes since the main checker's last successful HEAD and writes a user-local
receipt. Run `worktree-finish` immediately; its exact receipt is required before
the linked worktree and optional branch can be removed.

Read [REFERENCE.md](REFERENCE.md) for commands, record format, note format, and
failure semantics.
