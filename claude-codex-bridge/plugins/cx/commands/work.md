---
description: Start a trackable Codex work job
argument-hint: "[--foreground|--wait] [--model <m>] [--effort none|minimal|low|medium|high|xhigh] [--] <work request>"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not perform the work yourself, inspect the repository, summarize Codex output, retry, or reinterpret failures.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_WORK_ARGS_6f7e0b8d4a3f__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_WORK_ARGS_6f7e0b8d4a3f__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx work --mode work --args-file "$ARGS_FILE"
```

The companion owns flag parsing, job state, background execution, result files, logs, and session tracking. `/cx:work` defaults to a background job; `--foreground` or `--wait` opts into blocking until completion.

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
