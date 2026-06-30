# Expected Behavior Spec: generating-test-scope

## Success Criteria

- Given a backend service diff, produce a scope from changed files through entrypoints, data/state boundaries, and caller/dependency edges.
- Given a frontend route plus adapter diff, produce a scope from UI entrypoint through network contract, state handling, and visible behaviors.
- Every P0/P1 recommendation includes evidence: a changed artifact or a traced dependency.
- Deleted and renamed artifacts remain visible in the change inventory.
- Unknown impact edges are listed as Unknowns, not silently promoted into tests.
- Generated documentation uses the user's requested language, or the user's prompt language when no language is explicit, while preserving code identifiers, paths, and commands.

## Failure Modes

- Classifies every change with one Java-only table instead of using project responsibilities.
- Recommends "full regression" without a bounded reason.
- Marks high-priority tests without evidence.
- Drops deleted fields, deleted files, renamed paths, or documentation-only exclusions.
- Confuses executing tests with defining the release test scope.

## Negative Or Non-Trigger Examples

- "Run these test cases and report the result."
- "Generate API docs for the changed interface."
- "Tell me the Maven test command for this module."
- "Review this pull request for code defects."

## Held-Out Samples

- Backend-style sample: a request model, persistence query, and service flow change should produce contract, state, and caller coverage.
- Frontend-style sample: a route component and API adapter change should produce UI behavior, network contract, and state handling coverage.
