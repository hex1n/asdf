---
name: claude-status
description: Show status for bridge-owned headless Claude Code jobs. Use when the user invokes /claude-status.
---

# claude-status

Show bridge job status through the companion. Do not inspect the repository or infer status yourself.

Let `ARGUMENTS` be the text after `/claude-status`.

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude status --args-file "<temporary arguments file>"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
