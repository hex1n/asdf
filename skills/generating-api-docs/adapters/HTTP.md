# Adapter: HTTP / REST

HTTP interfaces are exposed through method plus path. For Spring MVC, controller annotations usually define the contract.

## Interface Discovery

+ Find controllers with `@RestController`, or `@Controller` plus response-body behavior.
+ Full path is class-level mapping plus method-level mapping: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`, or `@RequestMapping(method=...)`.
+ Verify package and module layout in the target project; do not assume a fixed package.
+ Completion criterion: controller, method, HTTP method, full path, request model, and response model are located.

## Address And Response Wrapper

+ Base URL: read server port, servlet context path, gateway prefix, README, or deployment docs.
+ API line: write `METHOD {baseUrl}{contextPath}{path}` or the project profile's equivalent.
+ Response wrapper: if the project wraps all responses, read the wrapper fields and document the wrapper in the interface convention section. The response table expands the business payload.

## Parameter Positions

HTTP request tables must include a Position column:

| Annotation | Position |
| --- | --- |
| `@PathVariable` | path |
| `@RequestParam` | query |
| `@RequestHeader` | header |
| `@RequestBody` | body |
| `@CookieValue` | cookie |

For request bodies, recursively expand object fields and mark their position as body.

## Auth

Read existing declarations only. Check method/class annotations, security configuration, filters, and interceptors. Common sources include `@PreAuthorize`, `@Secured`, `@RolesAllowed`, custom auth annotations, `SecurityFilterChain`, and path-prefix rules. If auth cannot be established, mark it unknown and name the missing source; ask only when a user-owned decision is necessary to finish the requested scope.

## Requiredness

+ Resolve requiredness per concrete route and active parameter binding, including optional parameter types.
+ `@PathVariable` defaults to required. A variable in a matched URI template must be supplied to match that route; `required=false` permits an absent binding on an alternate route that omits the variable. Document those routes separately.
+ `@RequestParam` and `@RequestHeader` default to required. `required=false` or a declared `defaultValue` permits omission; document the effective default. Check any additional validation that can still reject the bound value.
+ Body fields: inspect the effective validation entry point, groups, custom checks, deserializer, and defaults. `@Valid` cascades into a present value; it does not itself require non-null. Record conditional constraints explicitly. A missing annotation alone does not prove optionality.
+ Distinguish an absent request body from an absent, null, or empty field. Resolve header/query defaults from their actual binding configuration as well as annotations.

## ID Type

Use the wire type declared by the controller signature or DTO.
