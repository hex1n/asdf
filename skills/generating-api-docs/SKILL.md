---
name: generating-api-docs
description: Generates API docs for backend interfaces across protocols (RPC e.g. SOFABoot/Dubbo, and HTTP/REST) and across projects. Use when the user wants to document a single interface, a whole requirement's backend API, or the API changes on a branch.
---

# API 文档生成

文档是前后端**契约**：只写「正确调用所需」，不写实现细节。

本 skill 三件套：**spine**（不变流程：定范围 → 装配清单 → 逐接口解析 → 照模板填 → 自检）协议无关，写在本文；**adapter**（`adapters/{rpc|http}.md`）是「怎么探某协议」的配方；**profile**（项目内 `docs/api-doc-profile.md`）是把配方用到本项目的答案——探一次、存一份、之后复用。

落笔前先装配接口**清单**确定范围；范围与语义可参考设计文档，但**结构与字段一律回代码核对**——文档常给旧的或理想化字段名，以代码为准。

## 调用方式

```bash
/generating-api-docs [--rpc|--http] Interface            # 单接口/类
/generating-api-docs [--rpc|--http] Interface method     # 单方法
/generating-api-docs --feature <需求名|分支>              # 需求维度（跨接口）
/generating-api-docs --diff [baseBranch]                 # 变更维度
/generating-api-docs --batch I1 I2                       # 批量
```
协议不显式指定时按步骤 1 自动识别。

## 核心流程

### 0. 读设计文档（若存在）
搜 `docs/**/{需求}*` 的需求/系分/技术方案/plans。用于：① 定范围 ② 业务语义与取值 ③ 字段约束。
**完成判据**：设计文档出现的每个接口 / 操作标识 / 业务常量均已记入清单候选。

### 1. 载入/建立项目档案（profile）
项目专属约定（协议/基址/信封包装类/鉴权机制/必填风格/模块布局/ID/输出目录）**探一次、存一份、之后复用**——避免每次重探。adapter 是「怎么探」的配方，profile 是「本项目探到了什么」的答案。
- **找 profile**：`docs/api-doc-profile.md`（无则看仓库根 `.api-doc-profile.md`）。
  - **有** → 读它拿全部约定，直接跳步骤 2。
  - **无** → 探一次并**写出 profile**：
    1. 识别协议：显式 `--rpc`/`--http` 优先；否则 grep——`@SofaService|@DubboService`（及项目自有的网关派发注解，名见 profile）→ rpc，`@RestController|@*Mapping` → http；都有则按目标文件判定。
    2. **Read `adapters/{rpc|http}.md`**，照其探法在本项目**实读**各约定（**按职责识别，不照搬示例名**）。
    3. 把结果按下方骨架写入 `docs/api-doc-profile.md`。
- **完成判据**：profile 在手（读到或新建），下列项均有值；未探明的标「待确认」留步骤 3 问。

profile 骨架（写成 `docs/api-doc-profile.md`）：
- **协议**：rpc(方言如 SOFARPC) ｜ http ｜ 两者
- **基址**：测试 … ／ 生产 …
- **操作标识**：{网关注解名 ｜ 接口全名.方法}
- **请求信封**（rpc）：{派发入参对象及字段}
- **响应包装**：{外壳类名}｜{字段：是否成功/错误码/错误信息/data/链路号…}
- **鉴权**：{注解名/拦截器 → 含义}；凭证位置 {…}
- **必填判定**：{入口断言工具调用 ｜ @NotNull/@Valid}
- **模块布局**：接口 {…}／实现 {…}／模型 {…}
- **ID**：报文 {String/Long}
- **输出目录**：{docs/facade}
- > 约定有变可删此档重建。

### 2. 装配接口清单（范围先行）
- 单接口 / 单方法：清单即该接口/类。
- `--feature`：清单 =（git diff 变更的接口）∪（设计文档引用的操作标识/业务常量）。
- 每个接口归一类：🆕 新增 / ✏️ 调整 / 复用（代码未改但需联调，如下拉走的通用字典接口）。
- **完成判据**：清单覆盖全部相关接口，且**复用未改**接口未漏——这类代码扫不出，最易漏。

```bash
# 变更接口（文件名模式取自 profile 模块布局；首轮由 adapter 探法得出，如 rpc=*Facade(Impl)?、http=*Controller）
git diff {base}...HEAD --name-only | grep -E "{profile 的文件名模式}"
git show {base}:path/to/file.java   # ✏️ 接口取旧版本，做字段级变更对比
# 设计文档点名、但 diff 扫不到的方法：grep 方法名定位其归属类（复用未改最易漏）
grep -rE "\b{method}\b" {源码根} --include="{profile 的文件名模式}"
```

### 3. 生成前对齐（仅当读完 docs+code 仍无法定值时）
能由代码/文档定值的，**取默认值并在文中注明，不问**；只把**仍悬而未决**的行带着清单一次性确认。`--feature` 不等于必须问。

| 决策点 | 选项（默认在前） |
|---|---|
| 范围 | 整个需求 / 单接口 |
| 嵌套对象 | 全展开 / 仅引用 |
| 枚举取值来源 | 字典下拉驱动 / 前端硬编码 |
| 字段级变更标记 | 标 / 不标 |
| ID 类型 | 按代码原类型 / 统一 String |

### 4. 逐接口解析（**只读**代码，按 profile 约定）
- 接口定义：提**地址/路由 + 操作标识**（profile 说在哪取）。
- 实现/校验：提**认证、必填**（按 profile 的鉴权机制与必填判定）。
- Request/Response 递归**展开到底**（含嵌套 VO）。
- **完成判据**：每个字段都有类型与必填、且回代码核对过，无「待定」。

### 5. 生成 Markdown
- **输出目录**：用 profile 记录的输出目录；profile 未记则探测已有 `*_API_Doc.md` 所在目录（Glob `docs/**/*_API_Doc.md`，取多数；**别用 `git ls-files`**——漏未跟踪文件），兜底 `docs/facade/`。
- Read `template.md` 照其骨架填；「接口约定」信封段照 **profile** 填。
- **文件名**：单/批量 `{Interface}_API_Doc.md`；`--feature` `{需求}_API_Doc.md`；`--diff` `API_Changes_{date}.md`。

### 6. 自检
- 锚点：每个 `[..](#x)` 都有对应 `<a name=x>`；目录项与小节一一对应。
- 契约边界：无业务规则段落、无内部枚举/事件。

## 输出规约（spine，协议无关）

**契约边界** — 只承载契约：
- 业务规则段落不写（业务规则归另一类文档、单独维护，不进 API 契约）；只把影响调用的字段级约束（必填/长度/格式）写进备注。
- 枚举：前端硬编码传 code → 备注内联取值；字典下拉驱动 → 不列字典，指向字典接口。
- 内部枚举/内部事件非对外契约，不写。
- 文档与代码冲突 → 以代码为准记录；影响调用的差异加一行 `⚠️ 与设计不一致` 注明。
- 已知缺陷不写进契约（描述**目标契约**），至多脚注一句，bug 归 issue/测试。

**展开到底** — 嵌套对象逐字段展开，禁「字段同 XXX」跨节引用；同类型多处复用各自展开、用不同前缀区分。记法：`field.sub`（对象子字段）、`field[].sub`（列表子字段）、`data.field`（响应字段）。

**字段级变更**（🆕/✏️ 接口，让「报文怎么变」一眼看清）—
- 接口标题下加一行**变更摘要**：一句话点出请求/响应的关键增删改（如「请求 +fieldA、fieldB 必填→兼容；响应 +fieldC 字段」）。
- 字段表加「变更」列，图例：🆕 新增 / ✏️ 修改 / 🗑️ 删除 /（空）不变。
- **✏️ 行必须写清旧→新**（放备注）：如「必填 Y→N」「类型 Long→String」「枚举 +ENUM_VALUE」「必传→迁移期兼容」。
- **🗑️ 删除的字段仍保留一行**：当前代码已无，从 `git show {base}:file` 取旧版本的类型/说明，变更标 🗑️，备注「已删除（原…）」——否则"少了什么"读者看不到。
- 🆕 新增接口整表默认新增，标题注明「🆕 新增接口」即可，不必逐字段标。

> 认证标注、必填判断、地址与信封、ID 类型——这些**随协议变**，规则在 `adapters/{协议}.md`，不在此重复。

## 跨项目事实（profile 缓存，探一次复用）

**按职责识别，不按名字**：框架/标准注解可直接认（`@SofaService`/`@DubboService`/`@RestController`/`@Valid` 等，跨项目一致）；项目自定义构件（鉴权声明、响应包装、断言工具、操作标识注解）按它**做什么**去找——名字各项目不同，**绝不照搬示例名**。

首轮按 adapter 探法实读（基址探 `application.yml`/`.properties`/README/网关配置；信封读项目自己的包装类；布局按文件实际位置），结果写入 **profile**（步骤 1）；之后各次直接读 profile，探不出的标「待确认」并问。

## 执行策略

| 场景 | 执行方式 |
|---|---|
| 契约能在当前上下文内攒齐 | 直接内联写（即便 `--feature` / 多接口） |
| 范围超出已掌握上下文 / `--diff` 大变更 | Subagent |
| `--batch` 多接口 | 并行 Subagent（run_in_background） |

## Subagent Prompt 模板

子代理能读文件——让它直接 Read 本 SKILL、对应 adapter 与 `template.md`，保持单一事实源（不要粘贴会漂移的副本）：

```
为 {范围} 生成 API 文档，写入 {输出目录}/{名}_API_Doc.md
（协议={rpc|http}，输出目录由父代理探测后给出绝对路径）。
先 Read（绝对路径由父代理给出）：
  <项目>/docs/api-doc-profile.md          # 项目档案：约定已建，直接用
  <…/generating-api-docs/SKILL.md>
  <…/generating-api-docs/template.md>
  # profile 缺失时才 Read <…/adapters/{rpc|http}.md> 现探并补档
严格按其「核心流程」「输出规约」与 profile 约定执行。
```
