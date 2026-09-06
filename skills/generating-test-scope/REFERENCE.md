# generating-test-scope Reference

## Comparison Modes

Resolve named refs to commits before inventorying. Carry the effective baseline
and target into every delegated task; the mode determines what is included:

| Mode | Comparison |
| --- | --- |
| Branch | Resolve `git merge-base {base} {head}` as the effective baseline, then compare that commit to the resolved head. This is the change set represented by `{base}...{head}`. |
| Working tree | Compare the requested baseline commit to the current tracked tree with `git diff {baseline}`. Use `git status --short`, staged/unstaged diffs as needed, and `git ls-files --others --exclude-standard` to account for relevant untracked content. Default the baseline to HEAD only when the request covers uncommitted changes alone. |
| Release | Compare the two specified resolved snapshots directly with `git diff {old-release} {new-release}`; do not substitute their merge base. |

Use `--name-status` for inventory, then inspect changed content and old/deleted
definitions from the same effective baseline. For working-tree reports, retain
the inspected diff and relevant untracked content or hashes when needed to bind
the report to a snapshot. A status listing alone does not prove file content is
unchanged. A delegated task inherits these inputs and the requested release
boundary; a generic branch template must not replace them.

## Impact Tracing

Use the smallest set of traces that explains the risk:

- **Contract boundary**: exported API, CLI command, event payload, scheduled job, UI route, report, or file format.
- **State boundary**: schema, migration, query, cache, search index, filesystem write, external storage, or derived artifact.
- **Runtime boundary**: feature flag, environment variable, permission, credential source, deployment descriptor, or startup path.
- **Call boundary**: direct caller, indirect caller, shared model, shared validator, shared utility, or adapter layer.
- **Coverage boundary**: existing unit, integration, E2E, smoke, or manual checks that already exercise the changed path.

Stop tracing when the next edge is speculative. Put the missing edge in Unknowns instead of inventing a dependency.

## QA Scope Rubric

| Tier | Include when | Evidence required |
| --- | --- | --- |
| P0 | Release-critical failure consequence, reachable in the release | traced entry/state boundary, consequence, exposure, recovery difficulty |
| P1 | Material behavior affected with bounded impact or feasible recovery | changed artifact and traced edge with failure consequence |
| P2 | Localized low-impact regression | changed artifact and a reason the consequence is limited |
| Non-scope | No affected released behavior, or covered through a named authoritative source/generator | consumer/release evidence and any remaining check |

Prefer a narrow P0 with explicit follow-up Unknowns over a broad P0 that hides uncertainty.

## Output Template

```md
# Test Scope: {branch}

## Summary
- Base/head:
- Change count:
- Highest risk:
- Unknowns:

## Change Inventory
| Path | Status | Responsibility | Risk reason |
| --- | --- | --- | --- |

## Impact Graph
| Changed artifact | Traced impact | Evidence |
| --- | --- | --- |

## QA Scope
### P0
- [ ] Behavior:
  - Evidence:
  - Expected outcome:
  - Existing coverage and remaining check:
  - Risk:

### P1
- [ ] Behavior:
  - Evidence:
  - Expected outcome:
  - Existing coverage and remaining check:
  - Risk:

### P2
- [ ] Behavior:
  - Evidence:
  - Expected outcome:
  - Existing coverage and remaining check:
  - Risk:

## Risks And Unknowns
| Item | Why it matters | Next check |
| --- | --- | --- |

## Non-Scope
| Item | Reason |
| --- | --- |
```

## Non-Trigger Examples

- "Run the existing E2E plan" -> use the executor for the test plan.
- "Create API documentation for this interface" -> use the API documentation skill.
- "Which unit test command should I run?" -> answer from the project README or profile.
- "Review this implementation for bugs" -> use a code-review or stack-specific skill.
