---
description: Ask Claude Code (headless) a read-only question and report its answer
argument-hint: <question> [--model <model>]
---

Forward the question to Claude Code via the bridge script, then report its answer. Do not answer the question yourself. The script handles flag parsing, billing guard, read-only tool limits, and the session registry.

Question: $ARGUMENTS

Steps — follow exactly:

1. Write the question above to a temp file verbatim (unique name via `mktemp` / `New-TemporaryFile`; delete it after the run), including any `--model` token — the script parses routing flags itself. Never place the text on a shell command line.

2. Run exactly one command from the repository root (allow up to 10 minutes):
   - POSIX: `bun "$HOME/.codex/bridge/bridge.ts" cc-ask --text-file "$f"`
   - PowerShell: `bun "$env:USERPROFILE\.codex\bridge\bridge.ts" cc-ask --text-file $f`

3. Report stdout to the user unmodified — it already ends with the `cost: $x.xx | session: <id>` line.

4. On a non-zero exit, show the script's stderr as the error and stop. Do not retry, do not fall back to answering yourself.
