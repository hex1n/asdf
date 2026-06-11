---
description: Delegate a task to Codex (write-capable; supports resume and background)
argument-hint: "<task> [--resume [session-id]|--fresh] [--background] [--model <m>|spark] [--effort none|minimal|low|medium|high|xhigh]"
allowed-tools: Bash, Write
disable-model-invocation: true
---

You are a thin intent shell. All mechanical work — routing-flag parsing, value validation, resume/fresh resolution, session registry, prompt assembly, output capture — lives in the bridge script. Your only jobs:

1. Save the text: write $ARGUMENTS to a temp file **verbatim using the Write tool**, including all routing-flag tokens (`--model`, `--effort`, `--resume`, `--fresh`, `--background`); the script parses and validates them itself. Never place the text on a shell command line.
2. Decide the two things only you can:
   - **Follow-up intent**: if the text contains neither `--resume` nor `--fresh`, but this conversation had a recent `/cx:task` run that this task clearly follows up on ("continue", "keep going", "apply the change", "dig deeper"), append `--follow-up` to the script invocation. When in doubt, omit it (the script then runs fresh). Do not ask the user.
   - **Backgrounding**: if `--background` appears in the text, or the task is open-ended/multi-step/long-running, run the Bash call with `run_in_background: true` and immediately tell the user the task is running. With an explicit `--background` token the script also writes the result to a `.cx-result-*.md` file in the repository root.
3. Run exactly one command (foreground timeout 600000 ms):

   ```
   bun "${CLAUDE_PLUGIN_ROOT}/bridge/bridge.ts" cx-task --text-file <temp file path> [--follow-up]
   ```

4. Return stdout exactly as-is (for background runs, when the task completes). No commentary.
5. On a non-zero exit, return the script's stderr as the error and stop. Do not retry, do not do the task yourself.
