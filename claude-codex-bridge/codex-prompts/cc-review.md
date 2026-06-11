---
description: Have Claude Code (headless) review local git changes
argument-hint: "[--base <branch>] [review focus] [--model <model>]"
---

Forward a code-review request to Claude Code via the bridge script, then report its findings. Do not review the changes yourself. The script handles flag parsing, billing guard, the review output contract (`P0-P3 | file:line | problem | evidence`), read-only git tool limits, and the session registry.

Review scope / focus from the user: $ARGUMENTS
(Scope is deterministic: pass `--base <branch>` for `git diff <branch>...HEAD`; without it the scope is uncommitted changes. Everything else is review focus — do not guess a base branch from prose.)

Steps — follow exactly:

1. Write the arguments above to a temp file verbatim (unique name via `mktemp` / `New-TemporaryFile`; delete it after the run), including any `--base`/`--model` tokens — the script parses routing flags itself. Never place the text on a shell command line.

2. Run exactly one command from the repository root (allow up to 10 minutes):
   - POSIX: `bun "$HOME/.codex/bridge/bridge.ts" cc-review --text-file "$f"`
   - PowerShell: `bun "$env:USERPROFILE\.codex\bridge\bridge.ts" cc-review --text-file $f`

3. Report stdout to the user unmodified — it already ends with the `cost: $x.xx | session: <id>` line.

4. On a non-zero exit, show the script's stderr as the error and stop. Do not retry, do not review the code yourself.
