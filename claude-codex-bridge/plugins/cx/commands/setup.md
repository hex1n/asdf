---
description: Run local setup diagnostics for the Claude-to-Codex bridge without invoking Codex
argument-hint: "[--json]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not inspect the repository, invoke Codex, repair configuration, or reinterpret failures.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_SETUP_ARGS_87b5e4019f2a__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_SETUP_ARGS_87b5e4019f2a__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx setup --args-file "$ARGS_FILE"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
