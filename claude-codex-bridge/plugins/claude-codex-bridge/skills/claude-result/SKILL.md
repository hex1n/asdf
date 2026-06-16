---
name: claude-result
description: Print the result or failure details for a bridge-owned headless Claude Code job. Use when the user invokes /claude-result.
---

# claude-result

Fetch bridge job output through the companion. Do not inspect the repository, summarize the result, retry, or reinterpret failures.

Let `ARGUMENTS` be the text after `/claude-result`.

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude result --args-file "<temporary arguments file>"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
