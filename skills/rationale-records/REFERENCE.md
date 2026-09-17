# Rationale record reference

## Active entry schema

An active rationale file has one ordered filename, one navigation header, then
entries. The file path and header are exact:

```markdown
docs/rationale/<stable-domain>/01-<topic>.md

# <topic>
> TL;DR：一句话说明这个文件记录哪些当前代码约束。
```

Continue with entries in this schema:

```markdown
## W-001 · 一句话点明改成自然写法后哪个行为会变错

- **文件路径** `relative/path/File.ext`
- **代码片段** `one behavior-bearing token sequence unique inside that file`
- **实现理由** 先说明这段代码做什么，再沿数据或控制流解释为什么这样写，以及简化后会改变什么
```

These three labels are the record's only field names; any other line in a record
body is rejected. A continuation line indented by two spaces belongs to the field
above it; reach for an indented `text` block when order, scale, or two parallel
paths are what the reader must see — prose describing a rounding chain is harder
to check than four aligned lines.

A record is an interruption, not a description. Its reader arrives mid-edit
because they touched the anchored snippet, so the anchor has already answered
whether it applies to them and the title is free to answer why they should stop:
name what a natural rewrite breaks. The id names what the record anchors and
`实现理由` carries the reasoning, so a title spent restating the mechanism says
nothing the record does not already say twice. A record whose title cannot name a
consequence is one that failed the entry question and should not exist.

Repeat the `文件路径`/`代码片段` pair when one invariant depends on more than one real
declaration or call. Use repository-relative paths. A snippet must occur exactly
once in its file. Whitespace, indentation, and line breaks are ignored when
matching; strings, comments, and token boundaries are preserved. Anchor
behavior-bearing code, not a comment, import, method signature, or movable
trace.

Anchor where a breaking rewrite would land, which is the title's own test applied
to each pair: change this line the obvious way, and does the consequence in the
title follow? A formula, a constant, a chosen type, an ordering, a write all pass
it. A line that only forwards the value to the next call does not — changing it
produces nothing, and a reader who arrives there finds no reason to stay.

A snippet quotes the code; locating it is what the quotation buys, not the other
way round, and that is why the anchor is text rather than a line number a single
edit would move. So take a whole condition or statement, and when one is not
unique in its file, quote further — the matcher ignores line breaks, so two or
three lines are one snippet — rather than trimming inward until only a fragment
like `.accepts(value)) {` is left, which is unique and still unreadable because
it starts in the middle of an expression.

Past two anchors, the explanation says what each site contributes — an indented
`text` block listing file and role does it in a few lines. A reader who arrived
from the fourth anchor is looking for the sentence that tells them why that line
is in this record, and a single paragraph about the invariant does not have one.

Anchors that answer to different consequences are different records: the per-pair
test is also the splitting test, because a different consequence is a different
title.

The count of anchors under one consequence is not a size, it is how many places
must remember the rule on their own. A single anchor usually means the reason
cannot be carried by the code at all — a chosen constant, a rounding direction,
an order that nothing in the type or the name implies — and the record is where
that knowledge belongs. Several anchors mean the rule is enforced by repetition,
so any one site can be changed alone and break it.

Read the second kind as a refactor already scoped: the record names every site,
so giving the rule one owner is a bounded change, after which the record keeps one
anchor or stops being needed because the shape can no longer be got wrong. Some
rules cannot be centralized — the two ends of a protocol, layers that would take a
worse dependency on each other, a framework contract each implementation must
satisfy on its own — and there the record is the owner, which is not debt.

A W-ID is a name, unique across all files under `docs/rationale`, and never a
position: it says which record this is, not where it sits or when it was written.
Name it after what the record anchors — `W-调用顺序`, in the language the
records are written in — so a reference elsewhere reads without a lookup; a plain
number stays a valid name for records that already carry one. The heading's title
then states the claim about that anchor, and can be rewritten as the explanation
sharpens while the id stays put.

Records inside a file are ordered by the code's own flow, not by id; ids of
neighbouring records have no relation, and a higher one is not newer or better.
Active records carry no obsolete entries: update a still-current entry, or remove
it when the current code no longer needs it.

The title and `实现理由` contain no dates, tests, assertions, mutation results,
proof/evidence, samples, incidents, or review history. `实现理由` talks a maintainer
through the anchored code; it is not a decision log or a generic invariant
slogan. Retain current state distinctions, value flow, ownership, and the causal
chain. Remove how the explanation was proven, not the mechanism that makes it
true.

This is a semantic writing rule, not a deterministic checker claim. The CLI
validates the record format and its connection to source code; it deliberately
does not enumerate forbidden words or pretend to classify prose. The agent that
changes an explanation must reread that explanation before handoff and remove
every sentence that is unnecessary for understanding the current code.

When prose hides an important order or ownership boundary, continue the list
item with the smallest useful text sketch. It is optional, not boilerplate:

````markdown
- **实现理由** 先选择规则，再保留原值，最后计算派生值。
  ```text
  input
    select rule
    preserve original
    derive result
  ```
````

## Commands

Run inside the target Git repository:

```bash
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" check --full
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" check --incremental
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find W-001
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find TypeName#member
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find path/to/File.ext:120 --full
```

The compatibility wrappers `check-anchors.mjs` and `find-rationale.mjs` delegate
to the same CLI. Use `--records`, repeated `--ext`, or `--src-filter /` for a
non-default layout.

`check --full` validates the entire active corpus. `check --incremental` is the
normal Stop-hook route: on the main checkout it selects changed records plus
records pointing at source paths changed since the last successful HEAD; in a
linked worktree it reports `SKIP linked-worktree`. Missing, corrupt, incompatible,
or non-ancestor state causes a full rebuild. Every schema or anchor problem is a
FAIL; there is no warning state, and failed checks do not advance state.

`Class#member` lookup finds the unique class file and sorts by textual proximity.
It is navigation only, not an AST claim that an anchor belongs to that member.

## Worktree handoff

An optional unnumbered note can be free-form but should contain only candidate
current code explanations and code locations. Keep it under `.scratch`, for example
`.scratch/rationale-handoff.md`; do not name new W-IDs in the linked worktree.

```bash
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" handoff-create \
  --task TASK-ID --base BASE-COMMIT --note .scratch/rationale-handoff.md

# Use --note none when the task found no qualifying invariant.
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" handoff-create \
  --task TASK-ID --base BASE-COMMIT --note none
```

After integration, a note requires a main-checkout resolution JSON outside active
rationale:

```json
{
  "handoffId": "copied from the manifest",
  "noteHash": "copied from the manifest",
  "status": "processed"
}
```

Then consume and finish from the main checkout:

```bash
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" handoff-consume \
  --manifest /path/to/worktree/.scratch/rationale-handoff.json \
  --resolution .scratch/rationale-resolution.json

node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" worktree-finish \
  --manifest /path/to/worktree/.scratch/rationale-handoff.json \
  --main-root /path/to/main --branch task-branch

# Re-run only after READY with the same arguments plus --apply.
```

`handoff-consume` requires the task HEAD to be integrated and binds a receipt to
that handoff, note hash, task HEAD, and current main HEAD. `worktree-finish`
refuses stale/missing receipts or any leftover file other than the sealed note
and manifest. Without `--apply` it is a non-destructive readiness check.
