---
name: claude-verify-review
description: Re-run the bridge's local verification over a Claude review job or review output file without invoking Claude. Use when the user invokes /claude-verify-review or asks Codex to verify, challenge, or re-check a Claude review result locally.
---

# claude-verify-review

Re-run the bridge's local review verification. Do not invoke Claude, inspect the repository yourself, or judge the review conclusion.

Let `ARGUMENTS` be the text after `/claude-verify-review`.

Accepted forms:

- `<job-id> [--json]`
- `--file <review-output.md> [--prompt-file <bundle-or-prompt.txt>] [--json]`

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude verify-review --args-file "<temporary arguments file>"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
