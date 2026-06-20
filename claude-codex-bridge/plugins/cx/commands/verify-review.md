---
description: Re-run local verification over a Codex review job or review output file without invoking Codex
argument-hint: "<job-id> | --file <review-output.md> [--prompt-file <bundle-or-prompt.txt>] [--json]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not inspect the repository, invoke Codex, reinterpret findings, or edit any files.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_VERIFY_REVIEW_ARGS_2c0844dd1a6b__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_VERIFY_REVIEW_ARGS_2c0844dd1a6b__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx verify-review --args-file "$ARGS_FILE"
```

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
