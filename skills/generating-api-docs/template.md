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

| # | Interface | Class / Service | Type | Summary |
| --- | --- | --- | --- | --- |
| 1 | [{name}](#{name}) | {className} | added / modified / reused | {summary} |

If enum values come from a lookup interface, point to that interface instead of hard-coding the values here.

---

<a name="{name}"></a>
## 1. {name} - {display name}

+ **API**: RPC -> `{operation identifier or service.method}` / HTTP -> `{METHOD} {full path}`
+ **Auth**: {from profile and adapter}
+ **Change summary**: {request +fieldA, fieldB required Y->N; response +fieldC}. Omit for reused interfaces.

### Request Parameters ({RequestClass})

| Field | Description | Type | Position | Required | Change | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| {field} | {description} | {type} | {path/query/header/body} | Y/N | added / modified / unchanged | {value/length/format; condition for conditional requiredness} |
| {obj}.{sub} | {nested field} | {Type} | body | N | unchanged |  |
| {list}[].{sub} | {list element field} | {Type} | body | N | unchanged |  |
| {deletedField} | {old description} | {old type} | {old position} | - | deleted | Removed from the current contract; old contract was ... |

For RPC, omit the Position column unless the project profile defines a transport envelope that needs it.
For modified rows, write old->new in Notes, such as `required Y->N` or `Long->String`.
For deleted fields, read the old type and description from `git show {base}:file`.

### Request Example

```json
{ "field": "value" }
```

### Response Result ({ResponseClass})

| Field | Description | Type | Change | Notes |
| --- | --- | --- | --- | --- |
| data.field | {description} | {Type} | added / modified / unchanged |  |
| data.list[].sub | {description} | {Type} | unchanged |  |

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

Centralize cross-interface migration rules, fallback behavior, or parameter priority here. Do not add a business-rule section. If a confirmed defect affects integration, mention it briefly and point to the issue or test; keep the main body as the target contract.