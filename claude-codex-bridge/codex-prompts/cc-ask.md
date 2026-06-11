---
description: Ask Claude Code (headless) a read-only question and report its answer
argument-hint: <question> [--model <model>]
---

Forward the following question to Claude Code running headless, then report its answer. Do not answer the question yourself.

Question: $ARGUMENTS

Steps — follow exactly:

1. Parse routing flags. Strip `--model <model>` from the question text and pass it to Claude as `--model <model>`. Everything else is the question, preserved exactly. A `--model` value must match `[A-Za-z0-9._-]+` — it is spliced onto the claude command line while the question travels via stdin. If the token after `--model` does not match, treat both tokens as question text and pass no `--model`.

2. Billing guard: if the environment variable `ANTHROPIC_API_KEY` is set, make sure the claude invocation does not see it (POSIX shell: prefix the command with `env -u ANTHROPIC_API_KEY`; PowerShell: set `$env:ANTHROPIC_API_KEY = $null` before the call — Codex starts a fresh shell per command, so this does not leak beyond the invocation). Never pass `--bare` and never use `--continue` — both break subscription billing or session isolation.

3. Write the question to a temp file, preserving it exactly. Create the temp file with a unique name (`mktemp` / `New-TemporaryFile`) and delete it after the run. Always pipe stdin into Claude; do not inline the question as a command-line argument, because shell quoting and interpolation differ across platforms.

4. Run from the repository root (foreground, allow up to 10 minutes). Use the current platform's shell equivalent:

   PowerShell (the leading line is the step-2 billing guard, baked in so it cannot be skipped):
   ```powershell
   $env:ANTHROPIC_API_KEY = $null
   Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" <optional model arg>
   ```

   POSIX shell (the `env -u` prefix is the step-2 billing guard, baked in so it cannot be skipped):
   ```sh
   env -u ANTHROPIC_API_KEY claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" <optional model arg> < "$tmpfile"
   ```

   Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the single JSON object from stdout. Fields you need: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata for follow-ups in the bridge state registry, not in the repository. Store both the last session and a registry entry keyed by `session_id`.

   State directory (`<repo-hash>` is the first 16 lowercase hex characters of the SHA-256 of the absolute repository path; compute it this exact way every time or resume lookups will miss):
   - PowerShell: `$env:LOCALAPPDATA\claude-codex-bridge\sessions\<repo-hash>\`
   - POSIX: `${XDG_STATE_HOME:-$HOME/.local/state}/claude-codex-bridge/sessions/<repo-hash>/`

   Files (must match what `/cc-resume` reads): `cc-sessions.json` is a JSON object mapping `session_id` → entry; `cc-last-session.json` holds the entry for the most recent session. Update files atomically: write to a temp file in the same directory, then rename over the target; rebuild a file that fails to parse.

   Registry entry:

   ```json
   { "session_id": "<session_id>", "source": "ask", "cwd": "<absolute repository path>" }
   ```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true: show the raw error output and stop. Do not retry, do not fall back to answering yourself.
