# Java Stack Craft - Work Context

Use this file before non-trivial Java writing, refactoring, plan landing, or review. A Java Work Context is the profile-backed evidence packet the agent must assemble before choosing code changes or ranking findings. It prevents the common failure where the agent knows generic Java/Spring rules but misses the target version, local helper APIs, project conventions, risk priority, or verification limits.

## Build the context

Java Work Context is a project-local long-term profile plus a refreshable generated snapshot, not a per-message ritual. By default the context command creates or updates `docs/agents/java-stack-profile.md` inside the target repo. Reuse that profile when the project root, build files, branch/working tree, touched seam, and context options are unchanged. Refresh it when any of those facts change, when the profile is absent, or when a new task targets a different module or concern.

Run the bundled facade from the skill directory, not from the target project:

```bash
python3 <java-stack-craft>/scripts/java_stack.py context --dir <project-root> --format markdown
```

Resolve `<java-stack-craft>` to this skill directory; `--dir` points at the Java project (`.` only when the current directory is the target). The facade is stdlib-only. It composes the same detector and advisory scanner used by the lower-level commands, plus bounded Project Facility discovery. The generated block in `docs/agents/java-stack-profile.md` is replaced on refresh; hand-written notes outside that block are preserved.

Use `--seam <module-or-flow>` when the task has a known touched seam. Use `--no-write-profile` only for read-only targets, throwaway validation, or when the user explicitly wants no repo doc change.

For focused work, use subcommands:

```bash
python3 <java-stack-craft>/scripts/java_stack.py profile --dir <project-root> --format markdown
python3 <java-stack-craft>/scripts/java_stack.py facilities --dir <project-root> --format markdown
python3 <java-stack-craft>/scripts/java_stack.py scan --dir <project-root> --format markdown
```

## Context fields

Treat the context as evidence, not an oracle. Confirm load-bearing facts from code before editing.

| Field | Purpose | Must do with it |
|---|---|---|
| Target Profile | JDK, Spring Boot, namespace, web stack, module/build source | Keep syntax and Spring imports within the detected target; ask for JDK if absent |
| Project Facilities | Seed signals for common Java/Spring seams plus generic project-owned facility-like types | Prefer seam-relevant facilities before inventing helpers; verify the exact sibling code before reuse |
| Risk Candidates | Bounded scanner signals with severity, proof tier, and candidate failure path | Pick by concrete Failure Path and Verification Floor, not by generic best practice |
| Verification Floor | Smallest compile/test/source check that supports the intended claim | Report degraded proof when compile/test cannot reach project source |

## How to consume it

1. Name whether the work is writing, review, or accepted-plan landing.
2. Capture the Target Profile once per project session; re-run only if build files, working tree, target module, or touched seam changed.
3. Read `docs/agents/java-stack-profile.md`; treat the generated block as a freshness-checked snapshot and Project Knowledge Cards as soft repo memory. Name the card that changed a choice, or say `no-card`.
4. Read same-module or touched-flow code for any Project Facility that the context flags as relevant.
5. Use [RISK_ROUTER.md](RISK_ROUTER.md) to choose the Action Candidate when more than one risk is plausible.
6. Load [SPRING_BOOT.md](SPRING_BOOT.md) before Spring writing or review; the context tells you which Boot namespace and web-stack facts to trust.
7. State the Verification Floor before editing or before final review findings.

## Boundaries

- Do not use the context to justify broad cleanup. It narrows what to inspect; it does not authorize a repo rewrite.
- Do not claim a facility exists only from a category hit. The common seam catalog and generic type detector are search seeds, not an exhaustive convention map. Open the referenced file/line or a same-module sibling before relying on it.
- Do not rank scanner-only findings as confirmed. P3 remains discovery evidence until a code path or command proves it.
- Do not edit the generated block by hand. Put stable project conventions and decisions in Project Knowledge Cards outside the generated markers.
- Do not add profile facts that only describe the repo. A useful card must say what to do, when to do it, when not to do it, and what evidence backs it.
- Do not treat a stale profile as authority. If build files, Git HEAD/worktree, touched seam, or context options changed, refresh or mark the profile stale before relying on it.
