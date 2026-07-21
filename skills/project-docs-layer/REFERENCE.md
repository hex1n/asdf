# Project Docs Layer — Reference

Apply the answer ladder, five-question contract, command-safety rule,
multi-home aggregation, and Exclusions during every audit. Apply Freshness,
Harvest, and Canonicalization only when planning or performing a repair.

## The Answer Ladder

Every fact has one of three rungs; repair pushes it toward the strongest home
that fits the fact.

1. **executable** — the answer lives in automation the project runs, such as a
   CI job, task-runner target, manifest, or lint/format configuration. It stays
   verified only while that automation has a cited current success or an
   in-session execution produces the documented outcome.
2. **anchored** — prose points to an executable home and states the useful
   boundary the executable artifact cannot convey. Resolve the pointer in the
   current session. A dangling pointer is `stale`.
3. **bare** — prose has no executable backing. Use it for durable context,
   intent, judgment-shaped conventions, and safety facts that cannot be
   encoded in automation. Check observable claims in the current session and
   record provenance for claims that require owner authority.

Evidence follows the rung. A path listing does not verify behavior; a green
command does not verify strategic intent. Cite the evidence that actually
supports the claim.

## The Five-Question Contract

A fresh agent with no session history should answer all five questions from
durable repository homes.

### 1. Start

*What is this repository, and how do I build, run, or test it here?*

Prefer manifests and existing task-runner targets, with startup prose pointing
to them. Inspect a command before running it. A documented command is verified
when its observed outcome matches its documented expectation; an unexplained
failure is `stale`, while a documented environmental limitation may remain a
verified expected failure when the observed reason matches.

### 2. Verify

*Which commands prove a particular claim about this repository?*

Name what each check exercises and what it omits. Run each safe named check
once. If stronger checks exist but the durable docs expose only a weaker proxy,
classify the missing coverage as `undocumented`; do not let a green build stand
in for a test, integration check, or artifact-specific validator.

### 3. Conventions

*How is work written here?*

Prefer lint/format configurations and representative executable examples.
Keep prose only for conventions tooling cannot express. Sample the active
languages or layers the docs claim to cover; cite the sampled paths. A stated
convention contradicted by representative current code is `stale`.

Two-domain fit: a service repository may pin an adapter-boundary convention;
a documentation site may pin heading and link style.

### 4. Direction

*What durable context should not be re-derived every session?*

This includes domain language, why the repository exists, current direction,
and decided questions. Check structural claims against the repository. Treat
strategic intent and closed decisions as verified only when they have a durable
authoritative source or explicit owner confirmation; repository shape alone
cannot prove intent. `absent` is often correct for a small repository with no
domain-language or decision debt.

### 5. Danger

*Where are the project-specific safety boundaries?*

Cover generated or managed paths, commands that can affect shared or
production state, and data that must remain controlled. Verify existence plus
the claimed safety behavior: inspect the relevant script/configuration or cite
owner confirmation. Do not infer safety merely because a path or command
exists.

Two-domain fit: a service repository may mark migrations as forward-only; a
documentation site may mark generated output as non-editable.

## Command Safety

Command names are not effect guarantees: build, test, lint, and preview tasks
may write caches, committed artifacts, databases, or remote systems. Inspect
the command definition and its dependencies before execution.

Run without additional approval only when effects stay in disposable local
state, do not modify tracked content or leave durable untracked artifacts, and
need no credentials, dependency installation, network access, deployment, or
shared or production state. Snapshot repository state (for example,
version-control status) before execution and check it afterward. When
uncertain, preserve the gap: report the command, suspected effect, evidence
inspected, and authority needed to run it.

If the after-check shows changes anyway — tracked content modified or durable
untracked artifacts left — the safety judgment was wrong. Stop running further
documented commands under that judgment. Restore exactly what the snapshot
pair attributes to the command: delete the artifacts it created and revert the
tracked modifications it made; leave anything the snapshots cannot attribute
to it untouched and report that residue for the user to disposition.
Reclassify the command as requiring authority, and report the mis-judgment,
the observed effects, and the restoration — or the approval needed to
restore — in the audit output.

## Multi-Home Aggregation

Record every discoverable home before assigning the question-level verdict.
A question may have several rungs; never collapse them into one selected rung.

Apply aggregate precedence
`stale > undocumented > unverified > verified > absent`:

- **stale** — any discoverable home contradicts current evidence, including a
  divergent runtime startup copy. A verified competing home does not hide it.
- **undocumented** — no stale home remains, but a working answer or materially
  stronger verification path exists without a durable home.
- **unverified** — a durable home exists, but its required evidence could not
  be obtained because authority, credentials, environment, or a safe execution
  path is unavailable. Record the exact blocker. Missing evidence alone does
  not make the home `stale`.
- **verified** — at least one durable home answers the question, all
  discoverable competing homes are consistent, and each claim has
  rung-appropriate evidence.
- **absent** — searches found neither a durable answer nor a working fact ready
  to document. Record where the search looked. Owner-supplied content or a
  re-derived working answer changes this to an explicit invariant or
  `undocumented`; it does not remain `absent`.

Consistent duplicate prose may remain `verified` but carries a
`noncanonical-duplicate` defect. Divergent duplicates are `stale`.

## Audit Verdict Format

Use one aggregate row per question while preserving every home:

| Question | Aggregate verdict | Answer homes and rungs | Evidence | Defects / unrun commands |
|---|---|---|---|---|
| Start | verified / stale / undocumented / unverified / absent | `path` (`executable`), `path` (`anchored`) | command outcome, current automation run, pointer resolution, inspection, or owner provenance | one defect or gap per item |

Evidence is tool output or attributable owner evidence, not an impression. An
`absent` row uses `—` for homes and cites the searches that came up empty.

## Freshness

An in-session check is evidence for this audit, not a permanent steady state.
Assign each surviving prose claim one of these states in the closeout report:

- **project automation** — existing project automation continually checks the
  underlying executable fact;
- **owner-approved recurring guard** — the owner explicitly approves a
  scheduled or recurring check in the project's available automation;
- **accepted decay** — no recurring check is justified, so a future audit must
  re-verify the prose.

## Harvest

A re-derivation cost is evidence: a session had to rediscover a command,
convention, direction fact, or safety boundary that durable docs should have
supplied. Report it as `undocumented`; do not promote speculative facts.

If the repository already has an approved durable docs-gap sink, inventory it.
During audit-only, report proposed entries without writing. During repair,
create or update a sink only when the request authorizes it and each entry
names the re-derived fact plus where it was found. Resolve or remove consumed
entries in the same approved repair.

## Exclusions

Keep these out of target-project operating docs. The list binds in both
phases: during audit, report discovered excluded material as a defect on its
home; during repair, keep it out of the diff:

- **Host work discipline** — generic budgets, stop rules, review rituals, and
  closeout formats belong to the host workflow, not repository facts.
- **Runtime-local state** — private ledgers, transcripts, caches, and scratch
  files are non-authoritative.
- **Runtime wiring** — machine-level hooks, settings, and installation steps
  belong to their runtime or installer unless the repository itself owns them.
- **Speculative structure** — empty templates, placeholder files, and sections
  for facts no task or owner has needed.
- **Unsupported claims** — omit a command or fact whose required evidence is
  unavailable, or mark it with the exact provenance and verification gap.

## Canonicalization

- Give each fact one canonical home. Other files point to it instead of
  copying it; an executable home outranks prose for machine-checkable facts.
- When several runtimes load different startup files, pick one canonical file
  and keep the rest as thin pointers or byte-identical stubs. Compare them in
  the audit rather than trusting a parity promise.
- Prefer an existing script or task target over restating its steps. Treat a
  new script, target, lint rule, or CI job as an automation change that needs
  explicit scope and approval.
