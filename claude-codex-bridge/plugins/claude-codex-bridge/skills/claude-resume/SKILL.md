---
name: claude-resume
description: Resume a bridge-owned headless Claude Code session as a trackable job. Use when the user invokes /claude-resume or asks Codex to resume a prior Claude Code bridge session.
---

# claude-resume

Forward the user's follow-up instruction to the bridge companion. Do not act on the instruction yourself.

Let `ARGUMENTS` be the text after `/claude-resume` or after a natural-language request to use this skill.

## Steps

1. Resolve the companion script path relative to this `SKILL.md`: `../../scripts/bridge-companion.mjs`.
2. Write `ARGUMENTS` exactly to a temporary file. Do not shell-quote, split, trim, or reinterpret the follow-up text.
3. Run exactly one shell command from the repository root:

```sh
node "<resolved companion path>" claude resume --args-file "<temporary arguments file>"
```

The companion owns session lookup, UUID validation, permission mode restoration, billing guardrails, job state, background execution, result files, and logs. It never uses `claude --continue`; it resumes only an explicit `--session` value or the bridge-owned session registry. For an explicit session not already in the registry, pass `--mode consult|review|work`.

Return the command output exactly as-is. If it exits non-zero, report that output and stop. Do not retry.
