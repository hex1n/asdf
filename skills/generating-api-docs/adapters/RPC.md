# Adapter: RPC

RPC interfaces are remote service contracts reached through a registry, gateway, generated client, or dispatch layer. They do not use HTTP method plus URL path as the operation identity.

This adapter is a discovery recipe. Do not hard-code one project's endpoint, envelope fields, wrapper class, auth annotations, validation utilities, or layout into the portable skill.

## Interface Discovery

+ Find service interfaces and implementations. One interface method normally maps to one remote operation.
+ Use framework markers as search anchors, not as defaults: SOFABoot `@SofaService`, Dubbo `@DubboService`, gRPC `.proto` stubs, or the project's equivalent export mechanism.
+ Discover naming and file layout from the target project. Common names such as `*Facade.java`, `*Service.java`, and `*Impl.java` are search seeds only.
+ Completion criterion: interface, implementation, operation method, and model classes are all located in the target project.

## Address And Envelope

+ Operation identifier: if the method has a gateway or dispatch annotation whose value is the external operation key, use that value; otherwise use service interface plus method name.
+ Base endpoint: read configuration, gateway setup, README, or deployment docs; ask only when it cannot be discovered.
+ Request envelope: if calls go through a gateway dispatch object, read the outer request object that carries operation identifier and business payload.
+ Response envelope: read the common wrapper returned by the interface or implementation, including success flag, code, message, data, trace id, or equivalent fields.
+ RPC request tables do not use parameter position columns; fields live in the request object or envelope.

## Auth

Read existing declarations only; do not add missing auth to code. Identify method/class annotations, gateway filters, interceptors, or AOP checks that validate identity, token, role, or permission. If auth cannot be established, mark it unknown and name the missing source; ask only when a user-owned decision is necessary to finish the requested scope.

## Requiredness

Inspect active entry validation, validation groups, schema presence semantics, custom assertions, and defaults. `@Valid` cascades into a present object; it does not require non-null. Distinguish omitted, null, empty, and conditionally required values. Record intended requirements separately from enforcement discrepancies; use unknown when the active validation path cannot be established.

## ID Type

Use the wire contract type declared by the interface or model. If persistence uses a different type, document the wire type and mention the mismatch only when it affects callers.
