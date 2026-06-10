# Java Stack Craft - Optional Repo Profile

Use this file when repeated or non-trivial work in the same Java stack repo would benefit from durable local context. The profile and review memory are **soft dependencies**: they sharpen writing and review, but missing or stale files must not block work.

## Paths

- Repo profile: `docs/agents/java-stack-profile.md`
- Review memory: `docs/agents/java-stack-review-memory.md`

These paths are inside the target repo being worked on, not inside this skill. Create or update them when the user asked for profile/memory capture, when the current task already includes repo documentation edits, or when this optional profile/memory flow was explicitly enabled and local docs writes are acceptable. Otherwise report the suggested update.

## Hard vs soft facts

- Hard facts still come from live evidence: target JDK, Spring Boot version, `javax`/`jakarta`, module build files, and compile/test commands.
- Soft facts come from the profile: conventions, known dependency blockers, test seams, hotspots, and prior decisions.
- If profile facts conflict with the detector, build files, or code, trust the live evidence and mark the profile stale.

## Profile workflow

1. Read `docs/agents/java-stack-profile.md` if it exists.
2. Run the JDK detector once per project session; compare the result with the profile.
3. Capture only stable engineering facts that help future Java stack work.
4. Redact secrets, tokens, credentials, connection strings, and private hosts with embedded credentials.
5. Write or update the profile only under the path rule above; otherwise mention the proposed profile change in the final report.

Suggested profile template:

```md
# Java Stack Profile

## Detected Target
- Last checked:
- Build files:
- Effective JDK:
- Spring Boot:
- Namespace:
- Web stack:

## Build And Verification
- Compile:
- Focused tests:
- Full tests:
- Formatter/static checks:
- Known dependency blockers:
- Degraded verification fallback:

## Project Shape
- Modules:
- Entry styles:
- Package convention:
- DTO/entity/mapper convention:
- Error handling convention:
- Transaction boundary convention:

## Hard Lines
- Security:
- Correctness/data integrity:
- Concurrency/resource:
- Build/runtime compatibility:

## Test Seams
- Reliable seams:
- Unreliable seams:
- Test data/config notes:

## Hotspots
- Security/config:
- Mapper/persistence:
- Async/concurrency:
- Legacy conventions to match:
- Legacy conventions not to propagate:
```

## Review memory workflow

Use `docs/agents/java-stack-review-memory.md` to remember repeated legacy patterns that were intentionally downgraded or ignored in reviews. This is ranking memory, not a waiver. Never let it suppress new evidence for security, correctness, data integrity, concurrency, resource, or build/runtime failures.

Suggested review-memory template:

```md
# Java Stack Review Memory

## Pattern: <short name>
- Decision:
- Applies when:
- Do not report when:
- Still report when:
- Evidence:
- Last reviewed:
```

Good memory entries are narrow. For example, "project-wide field injection is backlog signal only" is useful only when paired with "still report when it affects construction, lifecycle safety, null-safety, testability, circular dependencies, or a touched/cohesive component."

## Consumption rules

- Writing mode reads the profile when present before choosing a target; it still verifies load-bearing facts from code/build files. It reads review memory only when the task is explicitly about noisy maintainability cleanup or memory updates.
- Review mode reads both the profile and review memory when present before ranking noisy candidates.
- Missing files are fine; proceed silently unless the user specifically asked to use, create, or update them.
- For Codex and Claude portability, keep the files plain Markdown and avoid runtime-specific metadata.
