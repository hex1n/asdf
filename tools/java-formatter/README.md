# Portable Java formatter

This directory is the single source of truth for the personal Java formatter
used by Codex and Claude Code. The formatter is Eclipse JDT 3.22 with the
P3C-derived profile in codestyle.xml, plus the fluent-chain pass in src/.
Maven dependencies are pinned so JDK 8 remains sufficient.

The installer links this directory and the sibling rationale-records tool under
~/.agents/tools, then merges one Stop hook into each installed runtime. Stop
checks rationale anchors and invokes docs/tools/run-agent-gates.mjs when present.
It never runs the formatter in write mode. Repository dispatchers own their own
side effects; the shared formatter does not infer file ownership from timestamps.

The formatter keeps Javadoc blocks byte-for-byte and preserves LF/CRLF layout.
Removing unused imports stays outside its contract.

## Explicit task scope

Before verification and staging, format the files owned by the current task in
that task's worktree. A shell command's cwd does not change its parent session's
Stop cwd. Do not format the whole changed set while another writer uses it.

    node ~/.agents/tools/java-formatter/format-changed-java.mjs --files src/main/java/Example.java
    node ~/.agents/tools/java-formatter/format-changed-java.mjs --check --files src/main/java/Example.java

Direct invocation without --files retains the legacy whole-changed-set behavior;
use it only when that complete set belongs to the task. The automatic Stop hook
never selects this behavior.

The formatter exits 3 when it changed files, or when --check detects required
formatting; 0 means no changes, 1 means execution failed. --check never writes
source. An empty --files list is an error. Production Java is the default scope;
--include-tests admits explicitly requested test files.

Stop optionally accepts --files <paths> for read-only format checks and reports
required formatting as a blocking hook result. Without an explicit list it only
runs the existing rationale/repository checks, so another task's Java changes or
a formatter upgrade cannot create unsolicited source changes. Old observation
cache files are unused and may remain on disk.

Requirements: Node.js 18+, JDK 8+, Maven 3.6+, and Git.

Commands:

    node scripts/install-agent-tools.mjs
    node scripts/install-agent-tools.mjs --apply
    node scripts/check-java-formatter.mjs

Installation is idempotent. Codex requires newly changed hook definitions to
be reviewed once through /hooks.
