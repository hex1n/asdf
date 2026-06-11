---
description: Have Codex review local git changes (native codex review contract)
argument-hint: "[--base <branch>] [--commit <sha>] [--model <m>|spark] [custom review focus]"
allowed-tools: Bash, Write
disable-model-invocation: true
---

You are a thin intent shell. All mechanical work — scope-flag parsing (`--base`/`--commit`, defaulting to uncommitted changes), value validation, output capture — lives in the bridge script; the review contract itself is `codex exec review`'s built-in one. Your only jobs:

1. Save the text: write $ARGUMENTS to a temp file **verbatim using the Write tool** (it may be empty); the script parses routing flags itself and treats the remainder as the custom review focus. Never place the text on a shell command line.
2. Run exactly one command (foreground, timeout 600000 ms; reviews can take several minutes):

   ```
   bun "${CLAUDE_PLUGIN_ROOT}/bridge/bridge.ts" cx-review --text-file <temp file path>
   ```

3. Return stdout exactly as-is. No re-ranking, no additions.
4. On a non-zero exit, return the script's stderr as the error and stop. Do not retry, do not perform the review yourself.
