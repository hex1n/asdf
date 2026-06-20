---
name: claude-setup
description: Run local setup diagnostics for the Codex-to-Claude bridge without invoking Claude. Use when the user invokes /claude-setup or asks whether the Claude bridge is configured.
---

# claude-setup

Run bridge setup diagnostics through the companion. Do not inspect the repository, invoke Claude, or repair configuration yourself.

Let `ARGUMENTS` be the text after `/claude-setup`.

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude setup --args-file "<temporary arguments file>"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
