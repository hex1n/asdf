---
name: claude-consult
description: Consult Claude Code headlessly with read-only tools and report its answer. Use when the user invokes /claude-consult or asks Codex to forward a read-only question to Claude Code.
---

# claude-consult

Forward the user's question to Claude Code running headless, then report its answer. Do not answer the question yourself.

Let `ARGUMENTS` be the text after `/claude-consult` or after a natural-language request to use this skill.

## Steps

1. Parse routing flags. Strip `--model <model>` from the question text and pass it to the bridge companion as `--model <model>`. Everything else is the question, preserved exactly.

2. Write the question to a temp file, preserving it exactly. Always pass it as a prompt file; do not inline the question as a command-line argument.

3. Resolve `../../scripts/bridge-companion.mjs` relative to this `SKILL.md`, then run from the repository root in the foreground, allowing up to 10 minutes:

```sh
node "<resolved companion path>" claude direct --mode consult --prompt-file "<temporary question file>" <optional model arg>
```

Replace `<optional model arg>` before running; never include placeholder text literally. The companion owns billing guardrails, Claude CLI resolution, JSON parsing, result rendering, and session tracking.

4. Report the command output exactly as-is.

5. If the command exits non-zero, show the raw output and stop. Do not retry. Do not fall back to answering yourself.
