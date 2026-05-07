# Claude Code Skills

A collection of [Claude Code](https://claude.com/claude-code) skills, with the eval workspaces used to develop and harden them.

## Layout

```
skills/
  <skill-name>/
    SKILL.md          # the skill itself — drop this folder into ~/.claude/skills/
workspaces/
  <skill-name>/
    iteration-*/      # eval runs (with-skill vs baseline) used during development
    eval_set.json     # test prompts and assertions
    ...
```

## Skills

### `pre-mortem`

Hardens a draft strategy by trying to break it. Performs bounded adversarial passes (default cap 3) to find material loopholes, patch them, and verify the patched plan. Use on non-trivial strategies, migration plans, architecture choices, or bug-fix approaches — not on trivial edits.

Trigger verbs: `pre-mortem`, `do a pre-mortem on`, `challenge`, `harden`, `falsify`, `stress-test`, `find loopholes in`, `poke holes in`, `adversarially review`, `break`, `attack`.

**Install — Claude Code:**

```bash
cp -r skills/pre-mortem ~/.claude/skills/
```

**Install — Codex CLI:**

```bash
cp -r skills/pre-mortem ~/.agents/skills/
```

(Both tools use the same `SKILL.md` format; the only difference is the install path. After installing in Codex, restart it so `~/.codex/config.toml` re-scans skills.)

Then in any session:

```
/pre-mortem
```

or just describe a plan and ask the agent to "harden this" / "find loopholes in this" / "do a pre-mortem on this".

## Adding new skills

1. Drop the skill folder under `skills/<name>/`.
2. If you used the `skill-creator` workflow, copy the eval runs to `workspaces/<name>/`.
3. Add a section to this README.
