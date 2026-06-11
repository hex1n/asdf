---
description: Delegate a task to Claude Code (headless, write-capable)
argument-hint: <task> [--model <model>]
---

Forward the following task to Claude Code running headless, then report its result. Do not do the task yourself.

Task: $ARGUMENTS

Steps — follow exactly:

1. Parse routing flags. Strip `--model <model>` from the task text and pass it to Claude as `--model <model>`. Everything else is the task, preserved exactly. A `--model` value must match `[A-Za-z0-9._-]+` — it is spliced onto the claude command line while the task travels via stdin. If the token after `--model` does not match, treat both tokens as task text and pass no `--model`.

2. Billing guard: if the environment variable `ANTHROPIC_API_KEY` is set, make sure the claude invocation does not see it (POSIX shell: prefix the command with `env -u ANTHROPIC_API_KEY`; PowerShell: set `$env:ANTHROPIC_API_KEY = $null` before the call — Codex starts a fresh shell per command, so this does not leak beyond the invocation). Never pass `--bare` and never use `--continue`.

3. Write the following generic task prompt to a temp file (unique name via `mktemp` / `New-TemporaryFile`; delete it after the run), fill in the task, then pipe it to claude via stdin:

   ```text
   <task>
   {task, verbatim}
   Context: the working directory is the repository to change.
   </task>
   <completeness_contract>
   Done means: the requested change is implemented, the project still builds, and the narrowest relevant validation available in this repository passes. If validation cannot be run, report exactly why.
   </completeness_contract>
   <verification_loop>
   After making changes, inspect local project conventions to choose the narrowest relevant test/build/check command. Run it, resolve failures caused by your changes, and report the command and outcome.
   </verification_loop>
   <action_safety>
   Stay narrow: change only what the task requires. Do not do drive-by refactors, dependency bumps, generated-file churn, or unrelated formatting. If a risky or destructive step is required, stop and report instead.
   </action_safety>

   End with a short summary of changed files, validation run, validation outcome, and any remaining work.
   ```

4. Run from the repository root (allow up to 15 minutes). Use the current platform's shell equivalent:

   PowerShell (the leading line is the step-2 billing guard, baked in so it cannot be skipped):
   ```powershell
   $env:ANTHROPIC_API_KEY = $null
   Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Edit,Write,Grep,Glob,Bash" --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Grep,Glob,Bash(git status *),Bash(git diff *),Bash(npm test *),Bash(npm run *),Bash(pnpm test *),Bash(pnpm run *),Bash(yarn test *),Bash(yarn run *),Bash(bun test *),Bash(deno test *),Bash(pytest *),Bash(python -m pytest *),Bash(uv run pytest *),Bash(go test *),Bash(cargo test *),Bash(mvn test *),Bash(mvn verify *),Bash(gradle test *),Bash(gradlew test *),Bash(dotnet test *),Bash(make test *),Bash(bundle exec rspec *),Bash(rspec *)" <optional model arg>
   ```

   POSIX shell (the `env -u` prefix is the step-2 billing guard, baked in so it cannot be skipped):
   ```sh
   env -u ANTHROPIC_API_KEY claude --print --output-format json --strict-mcp-config --tools "Read,Edit,Write,Grep,Glob,Bash" --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Grep,Glob,Bash(git status *),Bash(git diff *),Bash(npm test *),Bash(npm run *),Bash(pnpm test *),Bash(pnpm run *),Bash(yarn test *),Bash(yarn run *),Bash(bun test *),Bash(deno test *),Bash(pytest *),Bash(python -m pytest *),Bash(uv run pytest *),Bash(go test *),Bash(cargo test *),Bash(mvn test *),Bash(mvn verify *),Bash(gradle test *),Bash(gradlew test *),Bash(dotnet test *),Bash(make test *),Bash(bundle exec rspec *),Bash(rspec *)" <optional model arg> < "$tmpfile"
   ```

   Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the JSON: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata for follow-ups in the bridge state registry, not in the repository. Store both the last session and a registry entry keyed by `session_id`.

   State directory (`<repo-hash>` is the first 16 lowercase hex characters of the SHA-256 of the absolute repository path; compute it this exact way every time or resume lookups will miss):
   - PowerShell: `$env:LOCALAPPDATA\claude-codex-bridge\sessions\<repo-hash>\`
   - POSIX: `${XDG_STATE_HOME:-$HOME/.local/state}/claude-codex-bridge/sessions/<repo-hash>/`

   Files (must match what `/cc-resume` reads): `cc-sessions.json` is a JSON object mapping `session_id` → entry; `cc-last-session.json` holds the entry for the most recent session. Update files atomically: write to a temp file in the same directory, then rename over the target; rebuild a file that fails to parse.

   ```json
   { "session_id": "<session_id>", "source": "task", "cwd": "<absolute repository path>" }
   ```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true: show the raw error output and stop. Do not retry, do not take over the task yourself.
