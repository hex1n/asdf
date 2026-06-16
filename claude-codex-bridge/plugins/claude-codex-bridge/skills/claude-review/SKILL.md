---
name: claude-review
description: Ask Claude Code headlessly to review local git changes. Use when the user invokes /claude-review or asks Codex to forward a review to Claude Code.
---

# claude-review

Forward a code-review request to Claude Code running headless, then report its findings. Do not review the changes yourself.

Let `ARGUMENTS` be the text after `/claude-review` or after a natural-language request to use this skill. If a base branch is mentioned, the diff scope is `git diff <base>...HEAD`; otherwise review uncommitted changes via `git diff HEAD` plus untracked files. Anything else in the arguments is review focus.

## Steps

1. Parse routing flags. Strip `--model <model>` from the review scope/focus text and pass it to Claude as `--model <model>`. Everything else remains the scope/focus text.

2. Billing guard: if the environment variable `ANTHROPIC_API_KEY` is set, unset it for the child process only. Never pass `--bare` and never use `--continue`.

3. Write the following prompt to a temp file, filling in the scope and focus, then pipe it to Claude via stdin:

```text
Review the local git changes in this repository.
Scope: {git status --short + git diff HEAD + git ls-files --others --exclude-standard | git diff <base>...HEAD}
Focus: {user focus, or "general correctness, bugs, and risky changes"}

Output contract - for each finding, one line:
P0-P3 | file:line | problem | evidence
Order by severity. Only report issues grounded in the diff or in files you actually read. No speculation, no style nitpicks unless asked. If there are no findings, say so explicitly.
```

4. Run from the repository root, allowing up to 10 minutes.

PowerShell:

```powershell
Get-Content <tmpfile> -Raw | claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob,Bash" --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)" <optional model arg>
```

POSIX shell:

```sh
env -u ANTHROPIC_API_KEY claude --print --output-format json --strict-mcp-config --tools "Read,Grep,Glob,Bash" --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)" <optional model arg> < "$tmpfile"
```

Replace `<optional model arg>` before running; never include placeholder text literally.

5. Parse the JSON: `result`, `session_id`, `total_cost_usd`, `is_error`.

6. Persist session metadata through the bridge companion, not by writing registry JSON yourself. Resolve `../../scripts/bridge-companion.mjs` relative to this `SKILL.md`, then run from the repository root:

```sh
node "<resolved companion path>" claude register-session --session "<session_id>" --source review
```

7. Report to the user:
   - the full `result` text, unmodified
   - then one final line: `cost: $<total_cost_usd> | session: <session_id>`

8. If the command fails or `is_error` is true, show the raw error output and stop. Do not retry. Do not review the code yourself.
