# Portable Java formatter

This directory is the single source of truth for the personal Java formatter
used by Codex and Claude Code. The formatter is Eclipse JDT 3.22 with the
P3C-derived profile in codestyle.xml, plus the fluent-chain pass in src/.
Maven dependencies are pinned so JDK 8 remains sufficient.

The installer links this directory and the sibling rationale-records tool under
~/.agents/tools, then merges one Stop hook into each installed runtime. The
hook discovers the Git worktree from its session working directory, formats the
Java files in its watched scope, validates changed rationale anchors, and then
runs docs/tools/run-agent-gates.mjs when that repository provides additional
gates. When it rewrites a file it blocks the stop once so the diff is inspected.

The formatter keeps Javadoc blocks byte-for-byte. Formatted layout uses CRLF
when the source contains CRLF and LF otherwise. It changes layout only;
removing unused imports stays outside its contract.

## Watched scope

The hook rewrites files, so it formats only what moved while it was watching a
worktree, never the whole HEAD diff. Production Java source is the default
scope; `src/test`, `test`, `tests`, and `app/test` are excluded. Each stop stores
one observation per repository under ~/.agents/state/java-formatter: a digest
per changed Java file and the time of that observation.

A Java file is formatted when its digest differs from the previous observation,
or when it appeared after it. It is adopted unchanged when the repository has no
compatible observation yet, or when it is older than the previous observation —
a fresh install and a `git reset --mixed` therefore leave work the agent never
touched alone. Editing an adopted file brings it back into scope on the next
stop. Changing codestyle.xml or the formatter sources re-applies the profile to
the whole watched scope.

Run `node format-changed-java.mjs` directly to format the complete changed
production set regardless of the watched scope. Use `--include-tests` only when
test sources should be formatted, for example:

    node format-changed-java.mjs --include-tests --files src/test/java/ExampleTest.java

Requirements: Node.js 18+, JDK 8+, Maven 3.6+, and Git.

Commands:

    node scripts/install-agent-tools.mjs
    node scripts/install-agent-tools.mjs --apply
    node scripts/check-java-formatter.mjs

Installation is idempotent. Codex requires newly changed hook definitions to
be reviewed once through /hooks.

## 不属于 agent 的内容不格式化

工作树里内容与 `HEAD` 或合并中的 `MERGE_HEAD` 对应 blob 相同的 Java 文件(`git checkout --`、`git merge`、stash pop 写出的字节)不进入格式化范围;否则合并进来的上游文件每次 Stop 都会被重排一遍。判定用 `git diff --quiet <ref> -- <path>`,与 add 时相同的换行归一化。只在这两个 ref 里比对:其他提交里的内容被检出到工作树仍按 agent 改动处理。
