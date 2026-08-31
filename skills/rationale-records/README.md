# Personal rationale records

This directory contains one cross-platform Node.js CLI for Git-ignored,
current-code rationale. The active corpus is a personal navigation index, not
repository documentation:

```text
docs/rationale/
├── identity/
│   ├── 01-canonical-keys.md
│   └── 02-normalization.md
└── scheduling/
    └── 01-retry-boundary.md
```

Files are created only when the first qualifying invariant exists. Large domains
split by stable subdomain or code ownership, not by requirement or review round.
Every file starts with a topic and a one-line `TL;DR` describing its scope; the
two-digit prefix makes the reading order explicit.

## Entry

```markdown
# Identity · canonical keys
> TL;DR：Records which identities remain stable across persistence boundaries.

## W-001 · 一句话点明这段代码在解释什么

- **源码** `relative/path/File.ext`
- **形状** `one behavior-bearing token sequence unique inside that file`
- **解释** 先说明这段代码做什么，再沿数据或控制流解释为什么这样写，以及简化后会改变什么
```

Repeat source/shape pairs as needed. W-IDs are repository-wide unique. Active
files contain no dates, tests, proof, evidence, review history, or obsolete
entries. The source path must exist and the token shape must occur once; the
`解释` text walks through the anchored code instead of restating a rule. An
indented text flow or pseudocode block is optional when order is otherwise hard
to see.

The CLI validates structure and source linkage. Shape matching ignores source
whitespace, indentation, and line breaks while preserving strings, comments,
and token boundaries. It does not use an unbounded
keyword blacklist to classify prose; the installed skill owns the semantic
review that keeps process and proof material out of active explanations.

## CLI

```bash
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" check --full
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" check --incremental
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find W-001
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find TypeName#member
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find path/to/File.ext:120 --full
```

Full and incremental checks have only PASS, FAIL, and explicit SKIP outcomes.
Incremental state is versioned and atomically replaced under
`~/.agents/state/rationale-records`; invalid state triggers a full rebuild.

Linked worktrees skip the formal check. Use `handoff-create`, merge the task,
then run `handoff-consume` and `worktree-finish` from the main checkout. See the
installed skill reference for the complete handoff contract.
