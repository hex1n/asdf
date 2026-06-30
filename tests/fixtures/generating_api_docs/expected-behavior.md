# Expected Behavior Spec: generating-api-docs

## Success Criteria

- Given an RPC-style interface, load or build a project profile, use the RPC adapter only when profile data is missing, and document the service operation plus request/response envelopes.
- Given an HTTP-style interface, load or build a project profile, use the HTTP adapter only when profile data is missing, and document method/path, parameter locations, auth, and response shape.
- Given a feature or diff request, build an interface inventory from changed interfaces plus design-doc references, including reused interfaces that did not change.
- Given a changed contract field, show added, modified, and deleted fields at field level; deleted fields remain visible from the base version.
- Generated documentation describes the external contract needed by callers, not internal business rules, private events, or implementation details.
- Generated documentation uses the user's requested language, or the user's prompt language when no language is explicit, while preserving code identifiers and literal API values.

## Failure Modes

- Hard-codes one project's operation annotation, envelope, auth mechanism, or output directory into the portable skill body.
- Uses a design document as the source of truth for field structure after code conflicts with the document.
- Drops reused but unchanged interfaces from feature-level docs.
- Hides deleted request/response fields because they are absent from the current code.
- Treats RPC fields as HTTP path/query/header/body positions, or omits HTTP parameter locations.

## Negative Or Non-Trigger Examples

- "Review this API implementation for defects."
- "Execute an RPC call and compare database state."
- "Generate QA test scope for this branch."
- "Explain this business rule."

## Held-Out Samples

- RPC sample: a service method with request/response models and a shared response wrapper should produce an operation identifier, request envelope, response envelope, recursive fields, and field-level changes.
- HTTP sample: a controller method with path/query/header/body inputs should produce method/path, parameter locations, auth, response wrapper handling, and field-level changes.
