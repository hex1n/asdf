---
description: Continue a previous headless Claude Code session with a follow-up instruction
argument-hint: "<follow-up instruction> [--session <session-id>] [--mode ask|review|task] [--model <model>]"
---

<!-- GENERATED FILE — edit claude-codex-bridge/generator/ (templates + fragments), then run: python claude-codex-bridge/generator/render.py. Direct edits are overwritten and fail the contract tests. -->

Send a follow-up instruction to a previous headless Claude Code session, then report its result. Do not act on the instruction yourself.

Follow-up: $ARGUMENTS

Steps — follow exactly:

1. Parse routing flags. Strip them from the follow-up text:
   - `--session <session-id>` selects a specific Claude session instead of the latest bridge-recorded session.
   - `--mode ask|review|task` supplies the permission mode when the selected session is not already in the registry.
   - `--model <model>` passes through to Claude as `--model <model>`. {{include:cc-model-validation noun=follow-up}}

2. Read session metadata from the bridge state registry outside the repository.
   - `<repo-hash>` is the first 16 lowercase hex characters of the SHA-256 of the absolute repository path. The writer (`/cc-ask`, `/cc-task`, `/cc-review`) computes it the same way; if you compute it differently here, every lookup misses.
   - PowerShell base: `$env:LOCALAPPDATA\claude-codex-bridge\sessions\<repo-hash>\`
   - POSIX base: `${XDG_STATE_HOME:-$HOME/.local/state}/claude-codex-bridge/sessions/<repo-hash>/`
   - Registry file: `cc-sessions.json`
   - Last-session pointer: `cc-last-session.json`
   - If `--session <session-id>` is present, look that id up in `cc-sessions.json`.
   - If no `--session` is present, read `cc-last-session.json`.
   - If only the legacy `.codex/claude-last-session` file exists, stop and tell the user to start a new `/cc-*` session first; the legacy file lacks the permission mode needed for safe resume.
   - If the selected session is not in the registry and no `--mode` was provided, stop and ask the user to rerun with `--session <id> --mode ask|review|task`.
   - If `source`/`--mode` is not one of `ask`, `review`, or `task`, stop and report that the session metadata is invalid.
   - Validate that session ids are UUID-shaped before passing them to `claude --resume`.

3. {{include:cc-billing-guard}}.

4. Write the follow-up text to a temp file, preserving it exactly. Send only the follow-up text — do not restate the original task.

5. Run from the repository root (allow up to 15 minutes). Preserve the original permission boundary:
   - `source: "ask"` uses only `Read,Grep,Glob`
   - `source: "review"` uses `Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)`
   - `source: "task"` uses `--permission-mode acceptEdits` and the write-capable task tool list

   Substitute the mode-specific argument exactly:
   - ask: `--allowedTools "Read,Grep,Glob"`
   - review: `--allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)"`
   - task: `--permission-mode acceptEdits --allowedTools "{{include:task-allowed-tools}}"`

   Use the current platform's shell equivalent:

   PowerShell:
   ```powershell
   $modeArgs = switch ("<source>") {
       "ask" { @("--strict-mcp-config", "--tools", "Read,Grep,Glob", "--allowedTools", "Read,Grep,Glob") }
       "review" { @("--strict-mcp-config", "--tools", "Read,Grep,Glob,Bash", "--allowedTools", "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)") }
       "task" { @("--strict-mcp-config", "--tools", "Read,Edit,Write,Grep,Glob,Bash", "--permission-mode", "acceptEdits", "--allowedTools", "{{include:task-allowed-tools}}") }
   }
   $env:ANTHROPIC_API_KEY = $null  # step-2 billing guard, baked in so it cannot be skipped
   Get-Content <tmpfile> -Raw | claude --print --resume <session-id> --output-format json @modeArgs <optional model arg>
   ```

   POSIX shell:
   ```sh
   case "$source" in
     ask) set -- --strict-mcp-config --tools "Read,Grep,Glob" --allowedTools "Read,Grep,Glob" ;;
     review) set -- --strict-mcp-config --tools "Read,Grep,Glob,Bash" --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)" ;;
     task) set -- --strict-mcp-config --tools "Read,Edit,Write,Grep,Glob,Bash" --permission-mode acceptEdits --allowedTools "{{include:task-allowed-tools}}" ;;
   esac
   env -u ANTHROPIC_API_KEY claude --print --resume "$session_id" --output-format json "$@" <optional model arg> < "$tmpfile"
   ```

   Replace `<optional model arg>` before running; never include placeholder text literally.

6. Parse the JSON: `result`, `session_id`, `total_cost_usd`, `is_error`.

7. Update the bridge state registry with the returned `session_id`, same `source`, and current cwd. Also update the last-session pointer to the returned session. Update files atomically: write to a temp file in the same directory, then rename over the target.

8. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

9. If the command fails or `is_error` is true: show the raw error output and stop. Do not retry.
