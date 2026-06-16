---
description: Show bridge-owned Codex job status
argument-hint: "[job-id] [--json]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not inspect the repository or infer status yourself.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_STATUS_ARGS_4e8a2c1f7b0d__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_STATUS_ARGS_4e8a2c1f7b0d__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx status --args-file "$ARGS_FILE"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
