---
description: Have Codex review local git changes through the bridge companion
argument-hint: "[--path <file-or-dir>]... [--base <branch>] [--commit <sha>] [--model <m>] [custom review focus]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin forwarding wrapper around the bridge companion. Your only job is to run exactly one companion review call and return its result. Do not review the changes yourself, do not inspect the repository, do not summarize or annotate Codex's findings.

Arguments: $ARGUMENTS

## 1. Parse routing flags

Strip these execution controls from the text and pass them to the companion:

- `--path <file-or-dir>` -> pass through to the companion; repeat for multiple paths. The companion forwards these as Codex review focus text.
- `--base <branch>` -> pass through.
- `--commit <sha>` -> pass through.
- `--model <m>` -> pass through.
- `--effort <e>` -> pass through when present.

Everything else is custom review focus. If no `--path` is provided, pass `--path .`.

## 2. Write the focus file

Write the custom review focus to a temp file, preserving it exactly. Do not run `git diff`, `git status`, or `git ls-files` yourself. The companion owns scope forwarding, newline preservation, stdout capture, and result rendering.

## 3. Run exactly one command

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/bridge-companion.mjs" cx review --path "<path>" --focus-file "<temporary focus file>" <optional base/commit/model/effort args>
```

Replace optional arguments before running; never include placeholder text or square-bracket notation literally. Run in the foreground with a 600000 ms timeout.

## 4. Return

- Return the command stdout exactly as-is. No commentary before or after.
- If the command exits non-zero, show the raw output and stop. Do not perform the review yourself.
