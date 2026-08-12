# HTML Output

当用户要求 HTML、可视化或更直观的实现地图时，使用 `assets/mastery-map.html` 生成一个可离线打开的自包含页面。

## 生成

1. 复制模板到用户指定位置；未指定时使用 `docs/mastery/<target-slug>.html`。
2. 替换模板中的全部 `{{PLACEHOLDER}}`：
   - `TITLE`、`TARGET`、`REVISION`、`BASELINE`、`EVIDENCE`
   - `SUMMARY_HTML`、`STATS_HTML`、`MAINLINE_HTML`
   - `EVIDENCE_FRAME_HTML`（change 类目标填充四证据平面 `.plane-grid`；其余目标删除该 section 与对应导航链接）
   - `COVERAGE_HTML`、`DETAILS_HTML`、`DATA_HTML`
   - `RISKS_HTML`、`INVENTORY_ROWS`
3. 使用模板已有的组件类表现信息（条目内容完整性由 SKILL §3/§5 定义，此处只规定标记）：
   - 主链路使用 `.flow-step`（`h3` + `p`，序号由 CSS 计数器生成）。
   - 汇总指标使用 `.stat-card`。
   - 行为节点开标签固定为 `<details class="node-card" data-node-id="N07" data-state="explained">`——属性顺序固定，校验脚本依赖它；左侧彩条跟随 `data-state`。默认展开关键入口和高风险节点。节点主体标记：职责段落 → `<h4>` 分节 → 分支表 `<div class="table-wrap branches" tabindex="0">` → 代码 / SQL 摘录 `.code-caption` + `<pre class="code-block" tabindex="0">`（每个证据层级各一段）→ 末尾 `<p class="anchors">`。
   - state 用 `.badge.explained/.pending/.black-box`，风险严重度另用 `.badge.risk`；两枚 badge 可并存于同一 summary，互不替代。
   - inventory 行开标签固定为 `<tr data-node-id="N07" data-kind="behavior" data-state="explained">`（`kind` 取 `behavior|context`），五列：`ID | Node | Why in scope | Evidence | State`。
   - 颜色和主题一律经 CSS 变量：页面自动跟随系统明暗主题，调色只改 `:root` 与 dark 块中的 token。
4. 对代码、路径和用户输入进行 HTML 转义。页面使用用户当前语言；必要时同步调整模板中的固定标签。
5. 保持页面自包含：CSS 和 JavaScript 内联，不依赖 CDN、字体服务或远程图片。
6. 删除没有目标相关内容的 section，并同步删除对应导航链接。

HTML 是独立交付面，不要求同时创建 Markdown。用户要求两种格式时，从同一 inventory 和 evidence frame 生成，并保持 revision、结论和状态一致。

## 内容要求

- 顶部直接展示目标、分析版本、基线和证据等级。
- 主线区让读者按顺序走完端到端路径。
- 覆盖区展示场景、入口及 implemented/missing/excluded 状态。
- 节点区执行 SKILL §5 的“一节点一条目”（Node ID 双射）；折叠详细分支，降低首屏认知负担。
- 数据访问节点的查询证据按 SKILL §3 的层级逐段放入 `.code-caption` + `.code-block`，动态形态进分支表。
- 风险区区分 confirmed gap、risk、assumption 和 evidence gap。
- inventory 提供关键词和状态筛选，且交付时 `pending = 0`。

## 验证

- 搜索并清除所有未替换的 `{{PLACEHOLDER}}`。
- 检查导航链接对应存在的 section ID，inventory 筛选使用有效的 `data-state`。
- 双射校验（脚本执行，不靠数数）：

  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync(process.argv[1],'utf8');const g=re=>new Set([...h.matchAll(re)].map(m=>m[1]));const inv=g(/<tr data-node-id=\"([^\"]+)\" data-kind=\"behavior\" data-state=\"explained\"/g);const cards=g(/<details class=\"node-card\" data-node-id=\"([^\"]+)\"/g);const miss=[...inv].filter(x=>!cards.has(x));const extra=[...cards].filter(x=>!inv.has(x));if(miss.length||extra.length){console.error('MISSING:'+miss+' EXTRA:'+extra);process.exit(1)}console.log('bijection OK, nodes='+inv.size)" <生成的.html>
  ```
- 在可用浏览器中打开并检查桌面端、窄屏、明暗两种主题、折叠节点和筛选交互；浏览器不可用时，至少完成静态结构检查并明确说明未做视觉验证。
- 抽查 HTML 与 inventory 中至少 3 个节点，确认状态、源码锚点和结论一致。

**完成条件：**页面可离线打开、无未替换占位符、无缺失导航目标、双射校验通过，且视觉与内容抽查均通过或被明确标记为受阻。
