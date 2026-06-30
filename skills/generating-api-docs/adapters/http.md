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

Read existing declarations only. Check method/class annotations, security configuration, filters, and interceptors. Common sources include `@PreAuthorize`, `@Secured`, `@RolesAllowed`, custom auth annotations, `SecurityFilterChain`, and path-prefix rules. If no declaration is found, mark auth as unknown and ask for confirmation.

## Requiredness

+ `@PathVariable`: Y.
+ `@RequestParam`: Y unless `required=false` or `defaultValue` is present.
+ `@RequestHeader`: Y unless `required=false` is present.
+ `@RequestBody` fields: Y when validation annotations such as `@NotNull`, `@NotBlank`, `@NotEmpty`, or `@Valid` require them; otherwise N.

## ID Type

Use the wire type declared by the controller signature or DTO.