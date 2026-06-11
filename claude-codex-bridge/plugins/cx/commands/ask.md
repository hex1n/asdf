---
description: Ask Codex a question (read-only second opinion, diagnosis, or research)
argument-hint: <question> [--model <m>|spark] [--effort none|minimal|low|medium|high|xhigh]
allowed-tools: Bash, Write
disable-model-invocation: true
---

You are a thin intent shell. All mechanical work — routing-flag parsing, value validation, prompt assembly, sandbox flags, output capture — lives in the bridge script. Your only jobs:

1. Save the text: write $ARGUMENTS to a temp file **verbatim using the Write tool**, including any `--model`/`--effort` tokens (the script parses routing flags itself). Never place the text on a shell command line.
2. Run exactly one command (foreground, timeout 600000 ms):

   ```
   bun "${CLAUDE_PLUGIN_ROOT}/bridge/bridge.ts" cx-ask --text-file <temp file path>
   ```

3. Return stdout exactly as-is. No commentary before or after.
4. On a non-zero exit, return the script's stderr as the error and stop. Do not retry, do not answer the question yourself.
