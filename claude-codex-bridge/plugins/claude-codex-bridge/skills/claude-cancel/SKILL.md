---
name: claude-cancel
description: Cancel a running bridge-owned headless Claude Code job. Use when the user invokes /claude-cancel.
---

# claude-cancel

Cancel a bridge-owned Claude job through the companion. Do not find or kill processes yourself.

Let `ARGUMENTS` be the text after `/claude-cancel`.

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude cancel --args-file "<temporary arguments file>"
```

The companion only cancels jobs recorded in bridge state. It must not kill arbitrary Claude or Codex processes.

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
