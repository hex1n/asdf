---
description: Resume a previous bridge-owned Codex work session
argument-hint: "[--session <session-id>] [--foreground|--wait] [--model <m>] [--effort none|minimal|low|medium|high|xhigh] [--] <follow-up instruction>"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin command wrapper around the bridge companion. Do not act on the follow-up yourself, inspect the repository, summarize Codex output, retry, or reinterpret failures.

Arguments: $ARGUMENTS

Run exactly one Bash command:

```sh
ARGS_FILE="$(mktemp)"
trap 'rm -f "$ARGS_FILE"' EXIT
cat >"$ARGS_FILE" <<'__CLAUDE_CODEX_BRIDGE_CX_RESUME_ARGS_9d1e4c7b2a6f__'
$ARGUMENTS
__CLAUDE_CODEX_BRIDGE_CX_RESUME_ARGS_9d1e4c7b2a6f__
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx resume --args-file "$ARGS_FILE"
```

The companion owns session lookup, UUID validation, job state, background execution, result files, and logs. It never uses `codex exec resume --last`; it resumes only an explicit `--session` value or the bridge-owned session registry.

Return the command output exactly as-is. If it exits non-zero, report that output and stop.
