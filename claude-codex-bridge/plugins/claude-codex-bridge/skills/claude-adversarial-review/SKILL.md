---
name: claude-adversarial-review
description: Ask Claude Code headlessly for an adversarial review of local git changes, then return the bridge's local verification of the findings. Use when the user invokes /claude-adversarial-review or asks Codex to have Claude challenge or attack a change.
---

# claude-adversarial-review

Forward an adversarial code-review request to Claude Code running headless, then report its findings plus the bridge verification. Do not review the changes yourself.

Let `ARGUMENTS` be the text after `/claude-adversarial-review` or after a natural-language request to use this skill. If a base branch or commit is mentioned, pass that scope to the companion; otherwise review uncommitted changes via `git diff HEAD` plus untracked files. Anything else in the arguments is adversarial review focus.

## Steps

1. Parse routing flags. Strip these execution controls from the review text and pass them to the bridge companion:

- `--model <model>`
- `--base <branch>`
- `--commit <sha>`
- `--path <file-or-dir>`; repeat for multiple paths

Everything else is adversarial review focus. If no `--path` is provided, pass `--path .`.

2. Write the review focus to a temp file, preserving it exactly. Do not run `git diff`, `git status`, or `git ls-files` yourself, and do not assemble a review prompt manually. The companion owns review bundle generation, newline preservation, scope metrics, malformed-bundle limits, adversarial instructions, and local finding verification.

3. Resolve `../../scripts/bridge-companion.mjs` relative to this `SKILL.md`, then run from the repository root in the foreground, allowing up to 10 minutes:

```sh
node "<resolved companion path>" claude adversarial-review --path "<path>" --focus-file "<temporary review focus file>" <optional base/commit/model args>
```

Replace `<optional base/commit/model args>` before running; never include placeholder text literally. The companion owns billing guardrails, review bundle generation, Claude CLI resolution, JSON parsing, result rendering, finding verification, and session tracking.

4. Report the command output exactly as-is. The output includes Claude's original adversarial review followed by `bridge verification`.

5. If the command exits non-zero, show the raw output and stop. Do not retry. Do not review the code yourself or override the bridge verification.
