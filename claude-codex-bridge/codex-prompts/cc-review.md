---
description: Have Claude Code (headless) review local git changes
argument-hint: "[base branch and/or review focus] [--model <model>]"
---

Forward a code-review request to Claude Code running headless, then report its findings. Do not review the changes yourself.

Review scope / focus from the user: $ARGUMENTS
(If a base branch is mentioned, the diff scope is `git diff <base>...HEAD`; otherwise uncommitted changes via `git diff HEAD` plus untracked files. Anything else in the arguments is review focus.)

Steps — follow exactly:

1. Parse routing flags. Strip `--model <model>` from the review scope/focus text and pass it to Claude as `--model <model>`. Everything else remains the scope/focus text.

2. Billing guard: if the environment variable `ANTHROPIC_API_KEY` is set, unset it for the child process only (PowerShell: run the command in a scope where `$env:ANTHROPIC_API_KEY = $null`; POSIX shell: prefix the command with `env -u ANTHROPIC_API_KEY`). Never pass `--bare` and never use `--continue`.

3. Write the following prompt to a temp file (fill in the scope description and focus), then pipe it to claude via stdin. Do not run git or inline any diff yourself — Claude has read-only git permission and runs the scope commands itself. The `Scope:` line only *names* the commands that define the review surface; leave them as literal instructions for Claude to run.

   ```
   Review the local git changes in this repository. Run these git commands yourself to establish the scope, then review their output:
   Scope: uncommitted changes via `git status --short`, `git diff HEAD`, and `git ls-files --others --exclude-standard` — OR, if a base branch was given, `git diff <base>...HEAD`.
   Focus: {user focus, or "general correctness, bugs, and risky changes"}

   Output contract — for each finding, one line:
   P0-P3 | file:line | problem | evidence
   Order by severity. Only report issues grounded in the diff or in files you actually read. No speculation, no style nitpicks unless asked. If there are no findings, say so explicitly.
   ```

4. Run from the repository root (allow up to 10 minutes). Use the current platform's shell equivalent:

   PowerShell (the leading line is the step-2 billing guard, baked in so it cannot be skipped):
   ```powershell
   $env:ANTHROPIC_API_KEY = $null
   Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob,Bash" --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)" <optional model arg>
   ```

   POSIX shell (the `env -u` prefix is the step-2 billing guard, baked in so it cannot be skipped):
   ```sh
   env -u ANTHROPIC_API_KEY claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob,Bash" --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)" <optional model arg> < "$tmpfile"
   ```

   Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the JSON: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata for follow-ups in the bridge state registry, not in the repository. Store both the last session and a registry entry keyed by `session_id`.

   ```json
   { "session_id": "<session_id>", "source": "review", "cwd": "<absolute repository path>" }
   ```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true: show the raw error output and stop. Do not retry, do not review the code yourself.
