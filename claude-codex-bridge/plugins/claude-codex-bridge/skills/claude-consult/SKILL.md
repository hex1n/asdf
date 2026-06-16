---
name: claude-consult
description: Consult Claude Code headlessly with read-only tools and report its answer. Use when the user invokes /claude-consult or asks Codex to forward a read-only question to Claude Code.
---

# claude-consult

Forward the user's question to Claude Code running headless, then report its answer. Do not answer the question yourself.

Let `ARGUMENTS` be the text after `/claude-consult` or after a natural-language request to use this skill.

## Steps

1. Parse routing flags. Strip `--model <model>` from the question text and pass it to Claude as `--model <model>`. Everything else is the question, preserved exactly.

2. Billing guard: if the environment variable `ANTHROPIC_API_KEY` is set, unset it for the child process only. Never pass `--bare` and never use `--continue`; both break subscription billing or session isolation.

3. Write the question to a temp file, preserving it exactly. Always pipe stdin into Claude; do not inline the question as a command-line argument.

4. Run from the repository root in the foreground, allowing up to 10 minutes.

PowerShell:

```powershell
Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" <optional model arg>
```

POSIX shell:

```sh
env -u ANTHROPIC_API_KEY claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" <optional model arg> < "$tmpfile"
```

Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the single JSON object from stdout. Fields needed: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata through the bridge companion, not by writing registry JSON yourself. Resolve `../../scripts/bridge-companion.mjs` relative to this `SKILL.md`, then run from the repository root:

```sh
node "<resolved companion path>" claude register-session --session "<session_id>" --source consult
```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true, show the raw error output and stop. Do not retry. Do not fall back to answering yourself.
