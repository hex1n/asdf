---
description: Continue a previous headless Claude Code session with a follow-up instruction
argument-hint: "<follow-up instruction> [--session <session-id>] [--mode ask|review|task] [--model <model>]"
---

Send a follow-up instruction to a previous headless Claude Code session via the bridge script, then report its result. Do not act on the instruction yourself. The script resolves the session from the bridge registry (`--session <id>` for a specific one, otherwise the last bridge-owned session), preserves that session's original permission boundary (ask/review/task), validates session ids, and applies the billing guard.

Follow-up: $ARGUMENTS

Steps — follow exactly:

1. Write the follow-up above to a temp file verbatim (unique name via `mktemp` / `New-TemporaryFile`; delete it after the run), including any `--session`/`--mode`/`--model` tokens — the script parses routing flags itself. Send only the follow-up text; do not restate the original task. Never place the text on a shell command line.

2. Run exactly one command from the repository root (allow up to 15 minutes):
   - POSIX: `bun "$HOME/.codex/bridge/bridge.ts" cc-resume --text-file "$f"`
   - PowerShell: `bun "$env:USERPROFILE\.codex\bridge\bridge.ts" cc-resume --text-file $f`

3. Report stdout to the user unmodified — it already ends with the `cost: $x.xx | session: <id>` line.

4. On a non-zero exit, show the script's stderr as the error and stop (exit code 2 means a registry/usage problem — relay the script's guidance, e.g. rerunning with `--session <id> --mode ask|review|task`). Do not retry.
