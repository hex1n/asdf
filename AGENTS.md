# AGENTS.md for asdf-skills

This repository contains portable agent skills under `skills/`.

## Skill Evolution

When adding or changing skill rules, apply the Rule Harvest Gate:

- Promote a rule only when it addresses a repeated correction, observed failure mode, or explicit user-approved invariant.
- Check whether existing skill instructions or tests already cover the behavior.
- Add each rule at the narrowest applicable level; prefer one shared maintenance rule over duplicating runtime guidance in every `SKILL.md`.
- Protect load-bearing rules with a small example, stdlib test, or contract check when practical.
- Keep skills portable across agent runtimes: standard Markdown instructions and stdlib-only helper scripts; do not add runtime-specific workflow scripts, external dependencies, or broad checklists to core skills unless the user explicitly asks.
- Keep installed runtime copies of a shared source skill byte-identical with their source skill; put personal divergence in a local override skill instead of editing managed copies.

Keep `SKILL.md` files concise and task-facing. Put maintenance guidance here instead of loading it during normal skill use.
