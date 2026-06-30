# Expected Behavior: bootstrap-agent-os

## Success Criteria

- The skill is triggered by requests to create, audit, or repair project-level agent workflow docs.
- The output separates startup route, direction anchor, repo profile, workflow assets, goal contract, and evidence contract.
- The portable skill body does not contain source-project names, business terms, tool-specific private runbooks, credentials, or production identifiers.
- Generated project documents follow the user's requested language while preserving literal technical tokens.
- A fresh agent can use the resulting startup route to decide which project docs to read next.

## Failure Modes

- The skill rewrites the repository into a broad project-management framework instead of a narrow operating layer.
- Startup docs become long manuals rather than pointers.
- Direction anchors contain transient failing tests, branch status, or handoff notes.
- Direction anchors put one feature's terms in report-only signal names instead of evidence/source receipts and reusable risk categories.
- Repo profiles contain one feature's temporary facts as global rules.
- Evidence docs treat a locally installed checker as proof that the current agent session can access a live capability.

## Negative Or Non-Trigger Examples

- "Implement this Java service change" should use an implementation skill, not this bootstrap skill.
- "Write an E2E test plan for this feature" should use an E2E planner, not this bootstrap skill.
- "Generate API docs for this interface" should use an API documentation skill, not this bootstrap skill.
- "Research this business rule" should use a research workflow unless the result changes project-level routing.
- "Edit this product requirement, design doc, or business glossary" should not use this skill unless the task changes agent workflow routing or links those docs from the operating layer.

## Two Divergent Samples

Backend-style sample: a service repository has root agent instructions, a direction anchor, workflow assets, domain evidence packs, and command verifiers. The expected output is an audit or patch plan that deduplicates layer ownership and keeps runtime evidence behind profile/workflow pointers.

Frontend-style sample: a web application has root agent instructions, product direction docs, repo profile notes, UI regression run reports, and screenshot evidence. The expected output is the same layer structure, with UI verifier details kept in the profile or evidence assets rather than the startup route.
