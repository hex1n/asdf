---
name: generating-api-docs
description: Generates API docs for backend interfaces across protocols (RPC e.g. SOFABoot/Dubbo, and HTTP/REST) and across projects. Use when the user wants to document a single interface, a whole requirement's backend API, or the API changes on a branch.
---

# API Documentation Generation

API documentation is a caller contract: write only what a caller needs to invoke the interface correctly. Do not document implementation details.

This skill has three parts: the protocol-neutral **spine** in this file, protocol **adapters** in `adapters/{rpc|http}.md`, and the project **profile** at `docs/api-doc-profile.md`. The adapter explains how to discover facts for a protocol; the profile records what was discovered for the current project.

Before writing, build the interface inventory. Design documents may define scope and business meaning, but code is the source of truth for structure and fields.

## Commands

```bash
/generating-api-docs [--rpc|--http] Interface
/generating-api-docs [--rpc|--http] Interface method
/generating-api-docs --feature <feature-or-branch>
/generating-api-docs --diff [baseBranch]
/generating-api-docs --batch I1 I2
```
If the protocol is not explicit, detect it in step 1.

## Workflow

### 0. Read Design Context, If Any
- Search `docs/**/{feature}*` for requirements, design notes, technical plans, or branch plans.
- Use design context for scope, business terms, value meaning, and field constraints.
- Completion criterion: every interface, operation key, or business constant named by the design context is in the inventory candidates.

### 1. Load Or Build Project Profile
- Find `docs/api-doc-profile.md`; if absent, check `.api-doc-profile.md` at the repository root.
- Treat an existing profile as a discovery index. Recheck the endpoint, validation, serialization, auth, and output conventions used by this task against current sources; update stale facts and retain unresolved values as unknown.
- Detect the protocol and read its adapter when the profile is missing, incomplete, or contradicted by current code:
  - RPC: service/export annotations, registry or gateway dispatch, service interfaces, or generated stubs.
  - HTTP: controllers, route annotations, HTTP method/path declarations.
- Write discovered project conventions to `docs/api-doc-profile.md`.
- Completion criterion: protocol, base URL or dispatch endpoint, operation identifier, request envelope, response wrapper, auth, required-field rule, module layout, ID convention, and output directory are known or marked `unknown`.

Profile skeleton:
- Protocol: rpc / http / both
- Base endpoint:
- Operation identifier:
- RPC request envelope:
- Response wrapper:
- Auth:
- Required-field rule:
- Module layout:
- ID convention:
- Output directory:

### 2. Build Interface Inventory
- Single interface or method: inventory is the target interface or method.
- Feature request: inventory is changed interfaces plus operation keys, methods, or constants named by design context.
- Diff request: resolve the requested base/head or working-tree snapshot first. Include changed interfaces and reverse-trace changed DTOs, validators, serializers, shared wrappers, auth configuration, schemas, and dispatch rules to affected operations. Include deletions and referenced reused interfaces; record unresolved consumers as coverage gaps.
- Classify each item as added, modified, deleted, or reused.
- Completion criterion: all relevant interfaces are covered, including reused interfaces that did not change and therefore cannot be found by diff alone.

```bash
git diff {base}...HEAD --name-only | grep -E "{profile file pattern}"
git show {base}:path/to/file.java
grep -rE "\b{method}\b" {source-root} --include="{profile file pattern}"
```

### 3. Align Only Unknown Decisions
- Use code and design context when they determine the value; do not ask about facts that can be read.
- Ask once, with the inventory attached, only for unresolved decisions.
- Completion criterion: user-owned decisions needed to proceed are resolved; factual unknowns carry their missing source and impact. Use code-declared wire types and the default expansion below unless the user requests another presentation.

Common decisions:
- Scope: whole feature / single interface
- Nested objects: expand fully / reference type only
- Enum source: caller-supplied code / lookup interface
- Field-level change markers: include / omit
- Compatibility scope: the supported contract/version and rollout direction, when not established by project evidence
- ID type: code-declared type / normalized string

### 4. Parse Each Interface From Code
- Interface declaration: extract address or route and operation identifier according to the profile.
- Implementation and validation: extract auth and required fields according to the profile.
- Request and response models: resolve generics, wire names, ignored fields, null handling, defaults, and active validation paths. Expand nested objects and list elements; for recursion, link back to the already-defined type instead of expanding indefinitely.
- Completion criterion: each documented fact has a source; unresolved type, requiredness, or behavior is explicitly unknown with a next check. Distinguish declared intent from enforced behavior when they disagree.

### 5. Write Markdown
- Use the profile output directory. If absent, find the majority location of existing `*_API_Doc.md` files with a filesystem glob; do not use `git ls-files` because it misses untracked docs. Fall back to `docs/facade/`.
- Read `template.md` and fill it using profile facts.
- File names: `{Interface}_API_Doc.md`, `{feature}_API_Doc.md`, or `API_Changes_{date}.md`.
- Output language: write the generated API document in the language explicitly requested by the user; if none is explicit, match the user's prompt language. Use a project documentation convention only when the user is silent. Keep code identifiers, field names, operation keys, and literal enum values unchanged.

### 6. Self-Check
- Every Markdown anchor target exists.
- Table of contents and interface sections match.
- Every changed or deleted interface carries a Compatibility verdict, and every changed field row carries one; no changed row is left blank.
- Include caller-visible preconditions, conditional requirements, ordering, idempotency, and errors when supported. Exclude private implementation mechanisms. Check examples against documented fields, wire types, and constraints; label synthetic examples as illustrative.
- Known defects are not written as the target contract. Mention at most a short note pointing to the issue or test.

## Contract Rules

**Target contract**: describe the intended external contract, not current bugs or internal implementation.

**Field expansion**: use `field.sub`, `field[].sub`, and `data.field` paths. Expand acyclic fields in place; use explicit type links for cycles and polymorphic alternatives. Requiredness distinguishes missing, null, empty, and conditionally required values; absence of a discovered constraint is not proof that a field is optional.

**Field-level changes**:
- Add a one-line change summary for added or modified interfaces.
- Add a Change column when documenting a modified interface.
- For modified fields, write `old->new` in the note, such as `required Y->N`, `Long->String`, or `enum +ENUM_VALUE`.
- Deleted fields stay visible. Read their old type and description from `git show {base}:file`, mark them deleted, and note the former contract.
- A fully added interface can mark the section as added without marking every field.

**Compatibility**: every changed or deleted interface carries exactly one
verdict — `compatible`, `breaking`, or `not-assessed` — against the supported
old contract. Establish that contract from its published schema, declarations,
documented guarantees, or other authoritative evidence. A counterexample that
was valid under the old contract and fails under the new one establishes
`breaking`, even when the actual caller inventory is unavailable. Record known
consumer impact and missing consumer inventory separately; unknown impact
does not erase a proven contract violation.

Assess compatibility for the supported old caller talking to the new server;
include the reverse direction when rollout or mixed versions require it.
Compare accepted inputs, promised outputs, and observable effects, using the
actual wire format. Include source/library compatibility when callers use
published signatures or generated clients. Known consumer checks can demonstrate
additional breaks; absence of observed usage does not retire a published
guarantee. These are investigation prompts, not automatic verdicts:

| Change | What must be established |
| --- | --- |
| Request field added | Old requests remain valid; any required value has a compatible default or negotiated version |
| Request field removed | Old payloads are still accepted and dropping the value preserves promised semantics |
| Response field added | Supported consumers tolerate unknown fields and the payload still satisfies the schema |
| Response field removed or made nullable | Published presence/nullability guarantees remain satisfied; if a guarantee is removed, report breaking |
| Type, enum, or validation changed | Old valid inputs remain accepted and new outputs remain within consumers' supported domain |
| Route or operation replaced | The old entry remains supported, or report breaking and name its replacement |

A proven old-contract violation is `breaking`; all affected contract obligations
established preserved is `compatible`; otherwise use `not-assessed` and name
the undecidable obligation and missing evidence. Aggregate interfaces as breaking if any change is
breaking, otherwise not-assessed if any remains unknown. Describe the breaking
interaction and migration, not just the changed declaration.

**Protocol-specific facts** such as auth, requiredness, address, request envelope, response wrapper, parameter position, and ID type live in adapters and the project profile. Do not duplicate those rules in this spine.

## Execution Strategy

| Scenario | Execution |
| --- | --- |
| Contract facts fit current context | Write directly, including feature or multi-interface docs |
| Scope exceeds current context or diff is large | Delegate to a subagent |
| Batch interfaces | Delegate independent interfaces in parallel |

## Subagent Prompt

```
Generate API documentation for {scope}; write it to {output_path}.
First read:
  <project>/docs/api-doc-profile.md
  <skill>/SKILL.md
  <skill>/template.md
  <skill>/adapters/{rpc|http}.md when the profile is missing, incomplete, or contradicted by current code
Follow the workflow, contract rules, adapter, and project profile. Verify fields from code; label missing factual evidence as unknown with its next check. Write the generated document in the user's requested language, or the user's prompt language if no language is explicit.
```
