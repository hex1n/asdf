# Adapter · HTTP / REST（Spring MVC）

REST 控制器，直接经 HTTP 暴露。

## 接口发现
- 文件名模式：`Controller\.java`。
- 控制器类：`@RestController`，或 `@Controller` + 方法/类带 `@ResponseBody`。
- 每个接口 = 类级 `@RequestMapping("前缀")` + 方法级 `@GetMapping/@PostMapping/@PutMapping/@DeleteMapping/@PatchMapping`（或 `@RequestMapping(method=...)`）。**完整 path = 类前缀 + 方法路径**。
- 控制器所在包按项目实际布局**就地核实**（模块布局归 profile，不假定固定包名）。

## 地址与信封
- 传输：每个接口自带 **HTTP method + 完整 path**，写进该接口的 `API` 行（如 `POST /api/v1/users`）。基址探 `application.yml` 的 `server.port`/`server.servlet.context-path`/网关前缀，探不到再问。
- **请求字段分布**（请求表**必须加「位置」列**）：
  | 注解 | 位置 |
  |---|---|
  | `@PathVariable` | path |
  | `@RequestParam` | query |
  | `@RequestHeader` | header |
  | `@RequestBody`（对象） | body（其字段逐字段展开，位置标 body） |
  | `@CookieValue` | cookie |
- **响应**：方法返回类型即 `data`。若项目有**统一响应包装**（所有接口返回共用的外壳类，如 Spring `ResponseEntity<T>` 或项目自定义结果类），读其结构（`code`/`message`/`data` 之类）写进「接口约定」，正文「响应结果」只展开 `T`。

## 认证（严格按现存声明，只读不改；疑似缺认证只提示风险）
按项目实际择一识别，**无统一注解表**，常见来源：
- 方法/类注解：`@PreAuthorize`、`@Secured`、`@RolesAllowed`（Spring Security 标准），或项目自定义鉴权注解（名字各异，按职责识别）。
- 拦截器 / `SecurityFilterChain` / `WebSecurityConfigurer`：对某 path 前缀统一鉴权 → 标注该接口受其覆盖。
- 凭证位置：通常 `Authorization` 头（Bearer/Cookie/自定义头），在备注写清。
- 显示：有鉴权 → 🔐（注明机制/所需角色）；确认放行 → 🌐；查不到声明 → 标 🔐? 并提示「未见鉴权声明，需确认」，不擅自下结论。

## 必填
- `@PathVariable` → Y（路径段必填）。
- `@RequestParam`：`required` 默认 **true** → Y；显式 `required=false` 或有 `defaultValue` → N。
- `@RequestHeader`：`required` 默认 true → Y。
- `@RequestBody` 字段：看 `@NotNull/@NotBlank/@NotEmpty/@Valid`（`javax.validation`/`jakarta.validation`）→ Y；无校验注解默认 N。

## ID 类型
以接口签名/DTO 的**报文类型为准**（path/query 常为 String，body 字段按 DTO 声明）。
