# Review Lenses

Read only the section whose trigger the change meets. Each question names the
consequence a "no" carries; a "no" becomes a finding only with the evidence
[SKILL.md](../SKILL.md#test-the-failure-hypothesis) requires, and a question
with no consequence in this change is skipped, not reported.

## Error handling and fallbacks

Trigger: a catch or except block, error callback, fallback or default value on
failure, retry loop, or null-safe navigation that skips a failing operation.

- Which error types can this catch swallow beyond the one it intends? An
  unrelated failure caught here is lost with it.
- After the catch, does execution continue with partial state? Name the state
  that is now inconsistent for later callers.
- Does a fallback run without the caller or user knowing? A masked failure
  turns a visible outage into a silent wrong answer.
- Does production code fall back to a mock, stub, or fake? That path ships
  test behavior to users.
- When retries are exhausted, who is told? Silent exhaustion looks like a hang
  or a stale result.
- Does the log carry what a debugger needs later: operation, identifiers,
  state? A bare message cannot be traced to a cause.
- Should this error propagate instead? A local catch that prevents cleanup or
  rollback upstream is a resource or data defect.
- Does the user-facing message name what failed? A generic phrase makes the
  user retry the wrong thing.

## Tests

Trigger: test files added, changed, deleted, skipped, or loosened; a new branch
without a test; changed helpers or fixtures.

- For each changed behavior, which test fails if it regresses? A branch with
  no such test is a coverage gap; name the branch.
- Does the test assert the contract's property or the patch's current output?
  A test that snapshots the patch passes on the defect it should catch.
- Would the test still pass with the fix reverted? Then it protects nothing.
- Are rejecting cases present for validation logic: invalid, empty, boundary,
  oversized inputs? Validation without a rejecting test drifts open.
- Does the test depend on order, shared mutable state, time, or network? It
  passes alone and fails in CI, or the reverse.
- Does a mock replace the component under test? Then the test exercises the
  mock.
- Was a test deleted, skipped, or its assertion weakened? Each is a removed
  guard; the change must say what now covers that obligation.
- Do fixtures match the current schema or contract? A stale fixture tests
  yesterday's shape.

## Comments and documentation

Trigger: a comment, docstring, README, or API doc added or changed; code
changed beneath an existing comment.

- Does each claim match the code: parameters, return, side effects, handled
  edge cases? The next maintainer follows a wrong comment.
- Did the change alter code beneath an unchanged comment? Rot starts here.
- Does a TODO or FIXME describe work already done, or work this change now
  depends on?
- Does a documented example still run against the current signature?
- Is a documented precondition or invariant enforced in code, or only stated?
  A prose-only guard does not exist at runtime.
- Does the comment describe a temporary state the change made permanent?

## Types and invariants

Trigger: a new or changed type, data model, enum, union, DTO, or state
machine.

- Which invariants does the type carry: field relationships, valid
  transitions, ranges? An unlisted invariant is enforced nowhere.
- Can an invalid instance be constructed? Then every consumer inherits the
  check.
- Is every mutation point guarded the way construction is? One unguarded
  setter reopens the invariant.
- Can external code break the invariant through an exposed mutable internal?
- Does the type make an illegal state unrepresentable where the language
  allows, or rely on documentation to forbid it?
- Did the change widen a type: optional field, nullable, new union member?
  Each consumer that assumed the narrower shape is a reachable defect; name
  them.
- For an enum or union, does every switch handle the new member, or fall into
  a default that hides it?

## Dependencies and configuration

Trigger: a dependency version change, a change to resolved dependency versions,
build or CI configuration, environment variable, feature flag, or default value.

- Read the resolved dependency tree, from a lockfile or the build tool's
  dependency report, not only the manifest: which transitive versions moved?
  A transitive bump changes behavior the manifest never mentions.
- Read the changelog between the two versions, not the version number: which
  listed breaking or behavior changes does this code touch?
- Does the change bundle more than one dependency? A regression cannot be
  attributed to either.
- Does a changed default alter behavior for deployments that never set it?
  Name the environments affected.
- Does a new variable or flag define its absent-value behavior? Missing
  configuration in one environment becomes a runtime failure there.
- Is a removed or renamed configuration key still read anywhere? A stale
  reader takes the default silently.
