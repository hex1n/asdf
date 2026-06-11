---
description: Delegate a task to Claude Code (headless, write-capable)
argument-hint: <task> [--model <model>]
---

<!-- GENERATED FILE — edit claude-codex-bridge/generator/ (templates + fragments), then run: python claude-codex-bridge/generator/render.py. Direct edits are overwritten and fail the contract tests. -->

Forward the following task to Claude Code running headless, then report its result. Do not do the task yourself.

Task: $ARGUMENTS

Steps — follow exactly:

1. Parse routing flags. Strip `--model <model>` from the task text and pass it to Claude as `--model <model>`. Everything else is the task, preserved exactly. {{include:cc-model-validation noun=task}}

2. {{include:cc-billing-guard}}.

3. Write the following generic task prompt to a temp file (unique name via `mktemp` / `New-TemporaryFile`; delete it after the run), fill in the task, then pipe it to claude via stdin:

   ```text
   <task>
   {task, verbatim}
   Context: the working directory is the repository to change.
   </task>
   {{include:task-contract}}

   End with a short summary of changed files, validation run, validation outcome, and any remaining work.
   ```

4. Run from the repository root (allow up to 15 minutes). Use the current platform's shell equivalent:

   PowerShell (the leading line is the step-2 billing guard, baked in so it cannot be skipped):
   ```powershell
   $env:ANTHROPIC_API_KEY = $null
   Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Edit,Write,Grep,Glob,Bash" --permission-mode acceptEdits --allowedTools "{{include:task-allowed-tools}}" <optional model arg>
   ```

   POSIX shell (the `env -u` prefix is the step-2 billing guard, baked in so it cannot be skipped):
   ```sh
   env -u ANTHROPIC_API_KEY claude --print --output-format json --strict-mcp-config --tools "Read,Edit,Write,Grep,Glob,Bash" --permission-mode acceptEdits --allowedTools "{{include:task-allowed-tools}}" <optional model arg> < "$tmpfile"
   ```

   Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the JSON: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata for follow-ups in the bridge state registry, not in the repository. Store both the last session and a registry entry keyed by `session_id`.

   {{include:cc-state-registry}}

   ```json
   { "session_id": "<session_id>", "source": "task", "cwd": "<absolute repository path>" }
   ```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true: show the raw error output and stop. Do not retry, do not take over the task yourself.
