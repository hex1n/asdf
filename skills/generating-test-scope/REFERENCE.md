# generating-test-scope Reference

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
| P0 | User-visible contract, critical workflow, data write/migration, permission, runtime switch, or cross-system interaction changed | changed file plus entrypoint or state boundary |
| P1 | A caller, dependency, compatibility path, or main error branch is plausibly affected | changed file plus traced edge |
| P2 | Low-risk display, copy, test/tooling, docs-adjacent behavior, or broad regression around the touched area | changed file plus reason it is not P0/P1 |
| Non-scope | File is generated, dead, test-only with no product path, or docs-only outside released surface | evidence for exclusion |

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
  - Risk:

### P1
- [ ] Behavior:
  - Evidence:
  - Risk:

### P2
- [ ] Behavior:
  - Evidence:
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
