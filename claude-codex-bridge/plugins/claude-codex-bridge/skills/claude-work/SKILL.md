---
name: claude-work
description: Start a trackable headless Claude Code work job. Use when the user invokes /claude-work or asks Codex to forward write-capable work to Claude Code.
---

# claude-work

Forward the user's work request to the bridge companion. Do not perform the work yourself.

Let `ARGUMENTS` be the text after `/claude-work` or after a natural-language request to use this skill.

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file. Do not shell-quote, split, trim, or reinterpret the request text.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude work --mode work --args-file "<temporary arguments file>"
```

The companion owns flag parsing, billing guardrails, prompt construction, job state, background execution, result files, logs, and session tracking. `/claude-work` defaults to a background job; `--foreground` or `--wait` opts into blocking until completion.

Return the command output exactly as-is. If it exits non-zero, report that output and stop. Do not retry or take over the work.
