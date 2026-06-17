# Java Stack Craft - Repo Profile

Use this file to manage the default project-local long-term profile for Java stack work. The profile and review memory are **soft dependencies**: they sharpen writing and review, but missing or stale files must not block work.

## Paths

- Repo profile: `docs/agents/java-stack-profile.md`
- Review memory: `docs/agents/java-stack-review-memory.md`

These paths are inside the target repo being worked on, not inside this skill. The `context` command updates `docs/agents/java-stack-profile.md` by default. Use `--no-write-profile` only for read-only targets, throwaway validation, or explicit no-doc runs. Create or update review memory only when repeated review noise or an explicit memory update justifies it.

## Useful vs useless profile facts

- Hard facts still come from live evidence: target JDK, Spring Boot version, `javax`/`jakarta`, module build files, and compile/test commands.
- Useful soft facts change a future choice: which repo-owned API to call, where code belongs, which import/namespace/test seam to use, which legacy convention to match, or which convention not to propagate.
- Useless facts merely summarize the repo: module lists, generic stack descriptions, broad scanner counts, or "uses Spring Boot" without a decision boundary.
- If profile facts conflict with the detector, build files, or code, trust the live evidence and mark the profile stale.

## Profile workflow

1. Read `docs/agents/java-stack-profile.md`; if it is missing, run `java_stack.py context --dir <project-root>` to create it.
2. Trust the generated block only after its Git/build/touched-seam/context-options freshness keys still match the current task.
3. Run the JDK detector once per project session; compare the result with the profile.
4. Capture stable engineering facts as Project Knowledge Cards outside the generated block.
5. Redact secrets, tokens, credentials, connection strings, and private hosts with embedded credentials.
6. Never hand-edit the generated block; rerun the context command to update it.

## Project Knowledge Cards

This is the useful part of the profile. Add a card only when it passes the future-choice test: "Would this change the next coding, review, or verification choice?" If not, leave it out.

Card promotion gate:

- Decision is an imperative action, not a project description.
- Use when / Do not use when define the branch boundary.
- Evidence points to file:line, command output, or a named code-read source.
- Last verified is a date, commit, or current-task marker.
- A fact failing any gate stays in the chat/report, not the profile.

```md
### <seam or convention>
- Decision: <what to do next time>
- Use when: <scope where the decision applies>
- Do not use when: <negative boundary or failure mode>
- Evidence: <file:line plus command or code-read source>
- Last verified: <date or commit>
```

Good cards are narrow:

- `logging/alarm`: "Use `AlarmLogger` for business alarms in service module; regular SLF4J only for diagnostic logs; evidence: ..."
- `transaction boundary`: "Put `@Transactional` on service methods, not controllers/util helpers; do not self-invoke transactional methods; evidence: ..."
- `pagination/query`: "Use existing mapper page method or PageHelper seam; do not slice lists in memory for DB-backed queries; evidence: ..."
- `test seam`: "Use `BaseIntegrationTest` only when loading Spring context is required; prefer plain JUnit for mapper-free domain logic; evidence: ..."

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

- Writing mode reads or creates the profile before choosing a target; it still verifies load-bearing facts from code/build files. It reads review memory only when the task is explicitly about noisy maintainability cleanup or memory updates.
- Review mode reads or creates the profile, then reads review memory when present before ranking noisy candidates.
- Missing profile files should be created by the context command when local docs writes are acceptable. Missing review memory is fine.
- For Codex and Claude portability, keep the files plain Markdown and avoid runtime-specific metadata.
