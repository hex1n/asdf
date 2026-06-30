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
+ Search `docs/**/{feature}*` for requirements, design notes, technical plans, or branch plans.
+ Use design context for scope, business terms, value meaning, and field constraints.
+ Completion criterion: every interface, operation key, or business constant named by the design context is in the inventory candidates.

### 1. Load Or Build Project Profile
+ Find `docs/api-doc-profile.md`; if absent, check `.api-doc-profile.md` at the repository root.
+ If the profile exists, read it and continue to step 2.
+ If the profile is missing, detect the protocol and read only the needed adapter:
+   - RPC: service/export annotations, registry or gateway dispatch, service interfaces, or generated stubs.
+   - HTTP: controllers, route annotations, HTTP method/path declarations.
+ Write discovered project conventions to `docs/api-doc-profile.md`.
+ Completion criterion: protocol, base URL or dispatch endpoint, operation identifier, request envelope, response wrapper, auth, required-field rule, module layout, ID convention, and output directory are known or marked `unknown`.

Profile skeleton:
+- Protocol: rpc / http / both
+- Base endpoint:
+- Operation identifier:
+- RPC request envelope:
+- Response wrapper:
+- Auth:
+- Required-field rule:
+- Module layout:
+- ID convention:
+- Output directory:

### 2. Build Interface Inventory
+ Single interface or method: inventory is the target interface or method.
+ Feature request: inventory is changed interfaces plus operation keys, methods, or constants named by design context.
+ Diff request: inventory comes from changed interface files plus any referenced reused interfaces.
+ Classify each item as added, modified, or reused.
+ Completion criterion: all relevant interfaces are covered, including reused interfaces that did not change and therefore cannot be found by diff alone.

```bash
git diff {base}...HEAD --name-only | grep -E "{profile file pattern}"
git show {base}:path/to/file.java
grep -rE "\b{method}\b" {source-root} --include="{profile file pattern}"
```

### 3. Align Only Unknown Decisions
+ Use code and design context when they determine the value; do not ask about facts that can be read.
+ Ask once, with the inventory attached, only for unresolved decisions.
+ Completion criterion: no field, scope, enum source, nested object strategy, or ID convention remains ambiguous.

Common decisions:
+- Scope: whole feature / single interface
+- Nested objects: expand fully / reference type only
+- Enum source: caller-supplied code / lookup interface
+- Field-level change markers: include / omit
+- ID type: code-declared type / normalized string

### 4. Parse Each Interface From Code
+ Interface declaration: extract address or route and operation identifier according to the profile.
+ Implementation and validation: extract auth and required fields according to the profile.
+ Request and response models: recursively expand nested objects and list elements.
+ Completion criterion: every field has type and requiredness verified from code; no `TBD` remains.

### 5. Write Markdown
+ Use the profile output directory. If absent, find the majority location of existing `*_API_Doc.md` files with a filesystem glob; do not use `git ls-files` because it misses untracked docs. Fall back to `docs/facade/`.
+ Read `template.md` and fill it using profile facts.
+ File names: `{Interface}_API_Doc.md`, `{feature}_API_Doc.md`, or `API_Changes_{date}.md`.
+ Output language: write the generated API document in the language explicitly requested by the user; if none is explicit, match the user's prompt language. Use a project documentation convention only when the user is silent. Keep code identifiers, field names, operation keys, and literal enum values unchanged.

### 6. Self-Check
+ Every Markdown anchor target exists.
+ Table of contents and interface sections match.
+ The document contains caller contract only: no business-rule section, private enum, private event, or implementation details.
+ Known defects are not written as the target contract. Mention at most a short note pointing to the issue or test.

## Contract Rules

**Target contract**: describe the intended external contract, not current bugs or internal implementation.

**Field expansion**: expand nested objects and list elements in place. Use `field.sub`, `field[].sub`, and `data.field` paths. Do not say "same as another section" for reusable types.

**Field-level changes**:
+ Add a one-line change summary for added or modified interfaces.
+ Add a Change column when documenting a modified interface.
+ For modified fields, write `old->new` in the note, such as `required Y->N`, `Long->String`, or `enum +ENUM_VALUE`.
+ Deleted fields stay visible. Read their old type and description from `git show {base}:file`, mark them deleted, and note the former contract.
+ A fully added interface can mark the section as added without marking every field.

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
  <skill>/adapters/{rpc|http}.md only if the profile is missing or incomplete
Follow the workflow, contract rules, adapter, and project profile. Every field must be verified from code. Write the generated document in the user's requested language, or the user's prompt language if no language is explicit.
```