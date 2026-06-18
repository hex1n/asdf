---
description: Consult Codex in read-only mode for a second opinion, diagnosis, or research
argument-hint: <request> [--model <m>] [--effort none|minimal|low|medium|high|xhigh]
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin forwarding wrapper around the bridge companion. Your only job is to run exactly one companion call and return its result. Do not answer the request yourself, do not inspect the repository, do not summarize or annotate Codex's answer.

Arguments: $ARGUMENTS

## 1. Parse routing flags

Routing flags are execution controls. Strip them from the request text; everything that remains is the request, preserved as-is.

- `--model <m>` -> pass `--model <m>` to the companion.
- `--effort <e>` -> pass `--effort <e>` to the companion. Valid values: none, minimal, low, medium, high, xhigh.

## 2. Write the prompt file

Write the request to a temp file, preserving it exactly. Always pass it as `--prompt-file`; never inline the request as a command-line argument. The companion owns the Codex grounding prompt contract.

## 3. Run exactly one command

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx direct --mode consult --prompt-file "<temporary prompt file>" <optional model/effort args>
```

Replace `<optional model/effort args>` before running; never include placeholder text or square-bracket notation literally. Run in the foreground with a 600000 ms timeout.

## 4. Return

- Return the command stdout exactly as-is. No commentary before or after.
- If the command exits non-zero, show the raw output and stop. Do not perform the consultation yourself.
