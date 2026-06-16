# Skill Distribution

This context defines the language for distributing portable agent skills from this repository into local agent runtimes such as Codex and Claude Code.

## Language

**Source Skill**:
A skill directory under the repository `skills/` tree that acts as the source of truth for a managed skill.
_Avoid_: remote copy, upstream folder

**Managed Installed Skill**:
A local installed skill that is controlled by a source skill and should not be edited directly.
_Avoid_: local source, user fork

**Installed Skill Cache**:
The local copy of a managed installed skill that one or more agent runtimes load.
_Avoid_: editable installation, local master

**Agent Runtime**:
A tool that discovers and loads installed skills, such as Codex or Claude Code.
_Avoid_: Codex-only consumer

**Local Override Skill**:
A separate user-owned skill used for personal customisation instead of editing a managed installed skill in place.
_Avoid_: patching the installed cache

**Provenance Record**:
Metadata that identifies the source and last-synced content of a managed installed skill.
_Avoid_: install note, sync log

**Cache Drift**:
A mismatch between an installed skill cache and its last recorded synced content.
_Avoid_: local update, manual fix

## Relationships

- A **Source Skill** produces zero or more **Managed Installed Skills**.
- A **Managed Installed Skill** lives in an **Installed Skill Cache**.
- An **Installed Skill Cache** may be shared by multiple **Agent Runtimes**.
- A **Local Override Skill** is separate from a **Managed Installed Skill**.
- A **Provenance Record** belongs to exactly one **Managed Installed Skill**.
- **Cache Drift** blocks automatic replacement unless the user explicitly forces it.

## Example dialogue

> **Dev:** "Can I change the installed `deep-research` skill directly?"
> **Domain expert:** "No. That is a **Managed Installed Skill** in the shared **Installed Skill Cache** used by **Agent Runtimes** such as Codex and Claude Code; make a **Local Override Skill** if you need personal behaviour."
> **Dev:** "What if the remote source has a newer version?"
> **Domain expert:** "Update it only after checking the **Provenance Record** and confirming there is no **Cache Drift**."

## Flagged ambiguities

- "local skill" can mean either a **Managed Installed Skill** or a **Local Override Skill**. Resolved: repository-managed installs are **Managed Installed Skills** and are treated as read-only cache entries.
- "update" must not mean blind overwrite. Resolved: updates are safe replacements from a source skill after provenance and drift checks.
- "agent runtime" must not mean Codex only. Resolved: Codex and Claude Code are both **Agent Runtimes** that may share the same **Installed Skill Cache**.
