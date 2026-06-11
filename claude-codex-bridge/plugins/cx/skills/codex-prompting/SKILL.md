---
name: codex-prompting
description: Internal guidance for composing Codex prompts inside the cx plugin commands (/cx:ask, /cx:task)
user-invocable: false
disable-model-invocation: true
---

# Codex Prompting

Used by `/cx:ask` and `/cx:task` when assembling the prompt forwarded to `codex exec`. `/cx:review` does not use this skill — the native `codex exec review` subcommand carries its own review contract.

Prompt Codex like an operator, not a collaborator: one task per run, explicit output contract, explicit definition of done. Compact XML blocks, no prose padding.

## Blocks

| Block | Purpose | Used by |
|---|---|---|
| `<task>` | The concrete job plus minimal context (working directory, access level) | ask, task |
| `<compact_output_contract>` | Shape and brevity of the answer; require file:line citations for repo claims | ask |
| `<grounding_rules>` | Only evidence-backed claims; label hypotheses; never invent file contents | ask |
| `<completeness_contract>` | What "done" means; partial work must be reported as partial | task |
| `<verification_loop>` | Run narrowest build/tests after changes; resolve what they reveal; report outcomes | task |
| `<action_safety>` | Stay narrow; no drive-by refactors; stop on risky/destructive steps | task |

## Generic Task Contract

Use the same task execution contract for every write-capable bridge command, regardless of which agent receives it:

```text
<completeness_contract>
Done means: the requested change is implemented, the project still builds, and the narrowest relevant validation available in this repository passes. If validation cannot be run, report exactly why.
</completeness_contract>
<verification_loop>
After making changes, inspect local project conventions to choose the narrowest relevant test/build/check command. Run it, resolve failures caused by your changes, and report the command and outcome.
</verification_loop>
<action_safety>
Stay narrow: change only what the task requires. Do not do drive-by refactors, dependency bumps, generated-file churn, or unrelated formatting. If a risky or destructive step is required, stop and report instead.
</action_safety>
```

## Rules

- Preserve the user's task text verbatim inside `<task>`. Strip routing flags only.
- One task per `codex exec` run. If the user bundled unrelated asks, forward them as-is anyway — splitting is the user's call, not the forwarder's.
- Resume runs get only the delta instruction, not the full block structure, unless direction changed materially. Use an explicit or bridge-recorded session id; do not use "last session" shortcuts.
- Tighten the contract before raising `--effort`. Effort stays unset unless the user asked.
- Remove blocks the task does not need; never add blocks beyond the table above.
