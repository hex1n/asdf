---
description: Delegate a task to Claude Code (headless, write-capable)
argument-hint: <task> [--model <model>]
---

Forward the task to Claude Code via the bridge script, then report its result. Do not do the task yourself. The script handles flag parsing, billing guard, the task completion contract, the write-capable tool whitelist (acceptEdits), and the session registry.

Task: $ARGUMENTS

Steps — follow exactly:

1. Write the task above to a temp file verbatim (unique name via `mktemp` / `New-TemporaryFile`; delete it after the run), including any `--model` token — the script parses routing flags itself. Never place the text on a shell command line.

2. Run exactly one command from the repository root (allow up to 15 minutes):
   - POSIX: `bun "$HOME/.codex/bridge/bridge.ts" cc-task --text-file "$f"`
   - PowerShell: `bun "$env:USERPROFILE\.codex\bridge\bridge.ts" cc-task --text-file $f`

3. Report stdout to the user unmodified — it already ends with the `cost: $x.xx | session: <id>` line.

4. On a non-zero exit, show the script's stderr as the error and stop. Do not retry, do not take over the task yourself.
