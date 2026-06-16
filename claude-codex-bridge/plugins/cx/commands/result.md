---
description: Print the result or failure details for a bridge-owned Codex job
argument-hint: "[job-id] [--json]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not inspect the repository, summarize the result, retry, or reinterpret failures.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_RESULT_ARGS_c3a9f61d8e2b__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_RESULT_ARGS_c3a9f61d8e2b__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx result --args-file "$ARGS_FILE"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
