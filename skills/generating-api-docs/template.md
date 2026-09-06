# {Interface or Feature} API Documentation

> Scope: {interfaces or business chain covered}.
> Baseline: branch `{branch}` compared with `{base}`. Protocol: `{rpc|http}`. Contract source: code.
> Change legend: added / modified / deleted / unchanged.

---

## Interface Convention

Fill this section from the project profile at `docs/api-doc-profile.md`.

+ RPC: dispatch or gateway endpoint, request envelope, and response envelope.
+ HTTP: base URL, context path, response wrapper, and credential position.
+ Shared feature-level terms can live here to avoid repeating them in every interface section.

---

## Table Of Contents

| # | Interface | Class / Service | Type | Compatibility | Summary |
| --- | --- | --- | --- | --- | --- |
| 1 | [{name}](#{name}) | {className} | added / modified / deleted / reused | compatible / breaking / not-assessed | {summary} |

Compatibility answers whether an existing caller survives, so a reader can see
which rows force integration work. Classify by affected behavior, including
shared dependencies; added or reused labels do not establish compatibility.
Use the SKILL.md evidence rules for every assessed interaction. Omit the column
when the document describes no change at all.

If enum values come from a lookup interface, point to that interface instead of hard-coding the values here.

---

<a name="{name}"></a>
## 1. {name} - {display name}

+ **API**: RPC -> `{operation identifier or service.method}` / HTTP -> `{METHOD} {full path}`
+ **Auth**: {from profile and adapter}
+ **Change summary**: {request +fieldA, fieldB required Y->N; response +fieldC}. Omit for reused interfaces.

### Request Parameters ({RequestClass})

| Field | Description | Type | Position | Required | Change | Compatibility | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| {field} | {description} | {type} | {path/query/header/body} | Y/N/conditional/unknown | added / modified / unchanged | compatible / breaking / not-assessed | {value/length/format; condition for conditional requiredness} |
| {obj}.{sub} | {nested field} | {Type} | body | N | unchanged | - |  |
| {list}[].{sub} | {list element field} | {Type} | body | N | unchanged | - |  |
| {deletedField} | {old description} | {old type} | {old position} | - | deleted | compatible / breaking / not-assessed | Removed from the current contract; old contract was ... |

For RPC, omit the Position column unless the project profile defines a transport envelope that needs it.
For modified rows, write old->new in Notes, such as `required Y->N` or `Long->String`.
For deleted fields, read the old type and description from `git show {base}:file`.
Compatibility carries a verdict only on changed rows; unchanged rows use `-`.
Judge each change against accepted old inputs and promised outputs using the
compatibility rules in SKILL.md; the request/response direction alone is insufficient. Omit both columns entirely when the document describes
no change. For nested fields, state whether requiredness applies only when the parent is present.
For responses, record presence and nullability guarantees in Notes, including conditional alternatives.

### Request Example

```json
{ "field": "value" }
```

### Response Result ({ResponseClass})

| Field | Description | Type | Change | Compatibility | Notes |
| --- | --- | --- | --- | --- | --- |
| data.field | {description} | {Type} | added / modified / unchanged | compatible / breaking / not-assessed |  |
| data.list[].sub | {description} | {Type} | unchanged | - |  |

If the project uses a response wrapper, document the wrapper in Interface Convention and expand the business payload here.

### Response Example

```json
{}
```

### Error Codes

| Error code / HTTP status | Message | Meaning |
| --- | --- | --- |
| {code} | {validation message} | Required validation failed |
| - | {business exception message} | {condition} |

---

Repeat the interface section until the inventory is complete.

## Integration Notes, If Needed

Centralize cross-interface migration rules, fallback behavior, or parameter priority here. Include caller-visible business constraints at the operation or field they govern. If a confirmed defect affects integration, mention it briefly and point to the issue or test; keep the main body as the target contract.
