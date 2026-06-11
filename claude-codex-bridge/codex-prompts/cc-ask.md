---
description: Ask Claude Code (headless) a read-only question and report its answer
argument-hint: <question> [--model <model>]
---

Forward the following question to Claude Code running headless, then report its answer. Do not answer the question yourself.

Question: $ARGUMENTS

Steps — follow exactly:

1. Parse routing flags. Strip `--model <model>` from the question text and pass it to Claude as `--model <model>`. Everything else is the question, preserved exactly.

2. Billing guard: if the environment variable `ANTHROPIC_API_KEY` is set, unset it for the child process only (PowerShell: run the command in a scope where `$env:ANTHROPIC_API_KEY = $null`; POSIX shell: prefix the command with `env -u ANTHROPIC_API_KEY`). Never pass `--bare` and never use `--continue` — both break subscription billing or session isolation.

3. Write the question to a temp file, preserving it exactly. Always pipe stdin into Claude; do not inline the question as a command-line argument, because shell quoting and interpolation differ across platforms.

4. Run from the repository root (foreground, allow up to 10 minutes). Use the current platform's shell equivalent:

   PowerShell:
   ```powershell
   Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" <optional model arg>
   ```

   POSIX shell:
   ```sh
   claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" <optional model arg> < "$tmpfile"
   ```

   Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the single JSON object from stdout. Fields you need: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata for follow-ups in the bridge state registry, not in the repository. Store both the last session and a registry entry keyed by `session_id`.

   State directory:
   - PowerShell: `$env:LOCALAPPDATA\claude-codex-bridge\sessions\<repo-hash>\`
   - POSIX: `${XDG_STATE_HOME:-$HOME/.local/state}/claude-codex-bridge/sessions/<repo-hash>/`

   Registry entry:

   ```json
   { "session_id": "<session_id>", "source": "ask", "cwd": "<absolute repository path>" }
   ```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true: show the raw error output and stop. Do not retry, do not fall back to answering yourself.
