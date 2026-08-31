# Portable Java formatter

This directory is the single source of truth for the personal Java formatter
used by Codex and Claude Code. The formatter is Eclipse JDT 3.22 with the
P3C-derived profile in codestyle.xml. Maven dependencies are pinned so JDK 8
remains sufficient.

The installer links this directory and the sibling rationale-records tool under
~/.agents/tools, then merges one Stop hook into each installed runtime. The
hook discovers the Git worktree from its session working directory, formats the
Java files in its watched scope, validates changed rationale anchors, and then
runs docs/tools/run-agent-gates.mjs when that repository provides additional
gates. When it rewrites a file it blocks the stop once so the diff is inspected.

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
