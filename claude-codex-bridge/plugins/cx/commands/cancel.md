---
description: Cancel a running bridge-owned Codex job
argument-hint: "[job-id] [--json]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not find or kill processes yourself.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_CANCEL_ARGS_8b4d7f1e2c9a__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_CANCEL_ARGS_8b4d7f1e2c9a__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx cancel --args-file "$ARGS_FILE"
```

The companion only cancels jobs recorded in bridge state. It must not kill arbitrary Codex or Claude processes.

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
