#!/usr/bin/env node
// Reader View 工具 · e2e-test-planner / e2e-test-executor 共用
//
//   node reader-view.mjs render <data.json>
//   node reader-view.mjs audit  <data.json>
//
// 存在的理由：两个 skill 的 Reader View 契约只规定产出形态，不规定怎么产出，
// 于是每轮都手搓一个渲染器 + 一个审计脚本，再靠 `cp` 复用——复制出来的东西会陈旧。
// 实测在一个会话内因此出过四次事故：报告字段陈旧、首屏结论句写着上一轮的计数、
// 首屏脚注引用已解除的缺陷、审计页清单指向不存在的伴生页。
// 把渲染与审计收敛到这里，每轮只产出数据文件，陈旧就没有藏身处。
//
// 降级：本工具缺失或失败时，回到两个 skill 各自的条款——只交付 Markdown，
// 并说明 Reader View 因缺少渲染能力而 withheld。不要手搓替代品。

import fs from 'node:fs';
import path from 'node:path';

/* ─────────────────────────── markdown → html ─────────────────────────── */

const esc = v => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// 浏览器导航面只允许 .html 与同页 fragment；原始产物一律走伴生页
function htmlHref(href) {
    if (href.startsWith('#') || /^(https?:|mailto:)/i.test(href)) return href;
    const [p, frag] = href.split('#');
    const mapped = /\.md$/i.test(p) ? p.replace(/\.md$/i, '.html')
        : /\.(sql|json|jsonl|txt|log)$/i.test(p) ? p + '.html'
            : p;
    return frag ? `${mapped}#${frag}` : mapped;
}

function inline(text) {
    const out = [];
    const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
        out.push(esc(text.slice(last, m.index)));
        if (m[1] !== undefined) out.push(`<code>${esc(m[1])}</code>`);
        else if (m[2] !== undefined) out.push(`<strong>${inline(m[2])}</strong>`);   // 递归：粗体里的 `code` 不能被吞
        else out.push(`<a href="${esc(htmlHref(m[4]))}">${inline(m[3])}</a>`);
        last = m.index + m[0].length;
    }
    out.push(esc(text.slice(last)));
    return out.join('');
}

const slug = s => s.replace(/[^0-9A-Za-z一-龥]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// 标题里的显式 ID 用前缀匹配：`### G-02（…）` 也要拿到 id="g-02"
const ID_PREFIX = /^((?:HP|SC|DEF|GAP|TR|EMG|PROBE|ISSUE|B|S|G)-\d+[a-z]?)/;

function mdToHtml(md) {
    const lines = md.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const l = lines[i];

        if (l.startsWith('```')) {
            const buf = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
            i++;
            out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
            continue;
        }

        const h = l.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            const explicit = h[2].match(ID_PREFIX);
            const id = explicit ? explicit[1].toLowerCase() : slug(h[2]);
            out.push(`<h${h[1].length} id="${esc(id)}">${inline(h[2])}</h${h[1].length}>`);
            i++; continue;
        }

        if (l.trim().startsWith('|')) {
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
            // 按未转义的竖线切分，再把 \| 还原——行内代码里的竖线不得切断单元格
            const cells = rows.map(r => r.trim().replace(/^\|/, '').replace(/\|$/, '')
                .split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|')));
            const head = cells[0], body = cells.slice(2);
            out.push(`<div class="tw"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
                + `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
            continue;
        }

        if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) {
            const ol = /^\s*\d+\./.test(l);
            const items = [];
            while (i < lines.length &&
                (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
                const m2 = lines[i].match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
                if (m2) items.push(m2[1]); else items[items.length - 1] += ' ' + lines[i].trim();
                i++;
            }
            out.push(`<${ol ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`);
            continue;
        }

        if (l.trim() === '') { i++; continue; }

        const buf = [l];
        i++;
        while (i < lines.length && lines[i].trim() !== '' && !/^[#|`]|^\s*[-*]\s|^\s*\d+\.\s/.test(lines[i])) buf.push(lines[i++]);
        out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    return out.join('\n');
}

/* ─────────────────────────────── 样式 ─────────────────────────────── */

// 配色与排版遵循 dataviz 技能的参考实例：
//   状态色固定为 good/critical/warning/serious，且**从不单独承载含义**——
//   validate_palette.js 实测 critical↔good 在 deutan 下 ΔE 仅 4.1（经典红绿），
//   warning/serious 对浅色底 <3:1。因此每个状态一律配图标 + 文字标签，
//   数字与标签一律穿墨色，identity 由旁边的小色标承载。
//   英雄数字每视图恰好一个、≥48px、同一无衬线、比例数字（非 tabular）。
const CSS = `
:root{
--page:#f3f2ee;--card:#ffffff;--line:rgba(11,11,11,.09);--hair:rgba(11,11,11,.06);
--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--accent:#1c5cab;--accent2:#104281;
--good:#0ca30c;--critical:#d03b3b;--warning:#fab219;--serious:#ec835a;--neutral:#898781;
--shadow:0 1px 2px rgba(11,11,11,.04),0 2px 6px rgba(11,11,11,.03)}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);
 font:16px/1.75 "Segoe UI","Microsoft YaHei",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:36px 28px 80px}
.kicker{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--ink2)}
.kicker::before{content:"";width:22px;height:4px;border-radius:2px;background:var(--accent);flex:0 0 auto}
h1{font-size:29px;line-height:1.3;margin:0 0 8px;letter-spacing:-.015em}
h2{font-size:20px;margin:56px 0 18px;padding-bottom:10px;border-bottom:2px solid var(--line);letter-spacing:.01em}
h3{font-size:16px;margin:32px 0 10px}h4{font-size:14.5px;margin:20px 0 6px;color:var(--ink2)}
p,li,td,th,dt,dd,a,h1,h2,h3,h4{overflow-wrap:anywhere;word-break:break-word}
code{background:#efede7;border-radius:4px;padding:.12em .38em;color:#3f3e3a;
 font-family:"Cascadia Mono",Consolas,"Courier New",monospace;font-size:.84em;overflow-wrap:anywhere}
pre{background:#1a1a19;color:#e8e7e0;border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:12.5px;line-height:1.6}
pre code{background:none;color:inherit;padding:0}
a{color:var(--accent);text-underline-offset:3px;text-decoration-color:rgba(28,92,171,.35)}
a:hover{color:var(--accent2);text-decoration-color:currentColor}
a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.sub{color:var(--muted);margin:0 0 30px;font-size:12.5px;line-height:2.1}
.sub code{background:#eae8e1;color:var(--ink2)}

/* 卡片：白面浮在暖灰页面上，轻阴影分层，不用重块 */
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin:0 0 16px;box-shadow:var(--shadow)}
.lbl{display:flex;align-items:center;gap:8px;font-size:11.5px;letter-spacing:.1em;color:var(--ink2);text-transform:uppercase;margin:0 0 14px;font-weight:700}
.lbl::before{content:"";width:14px;height:3px;border-radius:2px;background:var(--accent);flex:0 0 auto}

/* 英雄数字：每视图一个，墨色 + 旁置色标承载状态，比例数字，≥48px */
.hero{display:flex;align-items:baseline;gap:14px;margin:2px 0 6px}
.hero .mark{width:12px;height:46px;border-radius:3px;flex:0 0 auto;align-self:center}
.hero .fig{font-size:56px;font-weight:650;line-height:1;letter-spacing:-.02em;color:var(--ink)}
.hero .cap{font-size:15px;color:var(--ink2)}
.outcome .lead{margin:0;font-size:18px;line-height:1.65;color:var(--ink)}

/* KPI 行：stat tile 独立成卡，非零态带同色浅底，零值退到页面底色 */
.verdicts{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:16px}
.v{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.v .n{display:block;font-size:27px;font-weight:650;line-height:1.15;color:var(--ink)}
.v .k{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);margin-top:6px}
.v .k i{width:8px;height:8px;border-radius:50%;flex:0 0 auto;font-style:normal}
.v .k code{font-size:11px;background:none;padding:0;color:var(--muted)}
.v .k i.b-passed{background:var(--good)}.v .k i.b-failed{background:var(--critical)}
.v .k i.b-blocked{background:var(--warning)}.v .k i.b-unverified{background:var(--serious)}
.v .k i.b-skipped{background:var(--neutral)}
.v.passed:not(.zero){background:#f2faf2;border-color:#c2e5c2}
.v.failed:not(.zero){background:#fbf1f1;border-color:#f0c3c3}
.v.blocked:not(.zero){background:#fdf7ea;border-color:#f2ddad}
.v.unverified:not(.zero){background:#fcf8f5;border-color:#fadfd4}
.v.zero{background:transparent;border-color:var(--hair)}
.v.zero .n,.v.zero .k{color:var(--muted)}
.v.zero .k i{background:var(--neutral)!important;opacity:.4}
.headline{font-size:14.5px;margin:16px 0 0;padding-top:14px;border-top:1px solid var(--hair);line-height:1.8;color:var(--ink)}

/* 信任条：键值对，不做成卡片 */
.trust{display:grid;grid-template-columns:repeat(4,1fr);gap:0;font-size:13px}
.trust div{padding:2px 18px 2px 0;border-right:1px solid var(--hair);line-height:1.7}
.trust div+div{padding-left:18px}
.trust div:last-child{border-right:none}
.trust .t{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;font-weight:600}
/* 步进图：细连接符、发丝边，不做成一排色块 */
.flow{display:flex;flex-wrap:nowrap;align-items:stretch;gap:0}
.node{flex:1 1 0;min-width:0}
.node a{display:block;height:100%;text-decoration:none;color:inherit;padding:4px 14px 4px 0;border-radius:8px}
.node a:hover .nplain{color:var(--accent)}
.nid{display:block;font-size:10.5px;font-weight:700;color:var(--accent);letter-spacing:.06em;margin-bottom:5px}
.nplain{display:block;font-size:14px;font-weight:600;line-height:1.45;color:var(--ink)}
.ntech{display:block;font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.45}
.arrow{align-self:flex-start;color:var(--muted);font-size:14px;flex:0 0 auto;padding:2px 12px 0 0}
.sideflows{margin-top:16px;padding-top:14px;border-top:1px solid var(--hair);font-size:12.5px;color:var(--muted);
 display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
.side{text-decoration:none;color:var(--ink2);border-bottom:1px dotted var(--line);padding-bottom:1px}
.side:hover{color:var(--accent)}.side .nid{display:inline;margin:0 4px 0 0}.side .ntech{display:inline;margin-left:5px}

.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.two .card{margin:0 0 16px}
.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:start}.three .card{margin:0}
/* 根因表(宽) + 重跑队列(窄) 并排：四组首屏一屏内可见 */
.ldr{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start}.ldr .card{margin:0}
ul.bare{margin:0;padding:0}
.dec li{margin:0 0 10px;list-style:none;font-size:12.5px;line-height:1.55;color:var(--ink2)}
.dec li .hd{display:flex;align-items:center;gap:8px;margin-bottom:2px}
.dec li a{font-weight:600}
.risk li{margin:0 0 10px;list-style:none;font-size:13px;line-height:1.6;color:var(--ink2);
 padding-left:22px;position:relative}
.ric{position:absolute;left:0;top:0;color:var(--warning);font-size:12px;font-style:normal}
ol.slice{margin:0;padding-left:0;list-style:none;counter-reset:s}
ol.slice li{margin:0 0 10px;font-size:13px;line-height:1.55;counter-increment:s;padding-left:26px;position:relative}
ol.slice li::before{content:counter(s);position:absolute;left:0;top:1px;width:18px;height:18px;border-radius:50%;
 background:#e8eef7;color:var(--accent);font-size:11px;font-weight:700;text-align:center;line-height:18px}
ol.slice .why{color:var(--muted);font-size:12px;display:block;margin-top:2px}
ol.rerun{margin:0;padding-left:0;list-style:none;counter-reset:r;font-size:13.5px}
ol.rerun li{margin:0 0 12px;counter-increment:r;padding-left:28px;position:relative;line-height:1.65}
ol.rerun li::before{content:counter(r);position:absolute;left:0;top:2px;width:19px;height:19px;border-radius:50%;
 background:#e8eef7;color:var(--accent);font-size:11px;font-weight:700;text-align:center;line-height:19px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
.tw{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 16px;box-shadow:var(--shadow)}
.card .tw{border:none;border-radius:0;box-shadow:none;margin:0}
.card .tw thead th{background:transparent}
th,td{border-bottom:1px solid var(--hair);padding:10px 14px;text-align:left;vertical-align:top;line-height:1.65}
thead th{background:#faf9f6;font-size:11px;letter-spacing:.07em;text-transform:uppercase;
 color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);padding-top:12px;padding-bottom:12px}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#fbfaf7}
/* 首列多为 ID：anywhere 会把最小内容宽算成一个字符，让 SC-403 竖排断行；
   break-word 保住整词的最小宽，长 token 仍会在溢出时断，长路径列不受影响 */
td:first-child{font-variant-numeric:tabular-nums}
td:first-child{overflow-wrap:break-word;word-break:normal}
/* ID 里的连字符是默认换行点，会把 SC-403 断成两行；首列内联代码整体不换行，宽表由 .tw 横向滚动兜底 */
td:first-child code{white-space:nowrap}

/* 状态/处置一律「小色标 + 图标 + 文字」，颜色从不单独承载含义；胶囊底色只是第三层冗余 */
.badge,.disp{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--ink2);white-space:nowrap;
 padding:2px 9px 2px 8px;border-radius:999px;background:#f4f3ee;border:1px solid var(--hair)}
.badge::before,.disp::before{content:"";width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:var(--neutral)}
.b-passed{background:#f2faf2;border-color:#c2e5c2}
.b-passed::before{background:var(--good)}
.b-failed{background:#fbf1f1;border-color:#f0c3c3}
.b-failed::before{background:var(--critical)}
.b-blocked{background:#fdf7ea;border-color:#f2ddad}
.b-blocked::before{background:var(--warning)}
.b-unverified{background:#fcf8f5;border-color:#fadfd4}
.b-unverified::before{background:var(--serious)}
.b-skipped::before{background:var(--neutral)}
.b-oracle{background:none;border:none;padding:0;color:var(--muted);font-weight:500}.b-oracle::before{display:none}
.disp.d-open{background:#fbf1f1;border-color:#f0c3c3}
.disp.d-open::before{background:var(--critical)}
.disp.d-block{background:#fdf7ea;border-color:#f2ddad}
.disp.d-block::before{background:var(--warning)}
.disp.d-done{background:#f2faf2;border-color:#c2e5c2}
.disp.d-done::before{background:var(--good)}
.disp.d-info::before{background:var(--neutral)}
#tree .branchrow th,#exec .branchrow th{background:#e9f0f8;
 font-size:14.5px;color:#17416f;border-bottom:2px solid var(--accent);padding-top:12px;padding-bottom:12px;text-transform:none;letter-spacing:0}
.scid{font-weight:700;text-decoration:none;font-size:15px}
.sctitle{margin-top:5px;font-weight:600;line-height:1.45;font-size:14px}
.pri{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--ink2);margin-left:10px}
.pri::before{content:"";width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:var(--neutral)}
.pP0::before{background:var(--critical)}.pP1::before{background:var(--warning)}.pP2::before{background:var(--neutral)}
details{margin-top:8px}summary{cursor:pointer;font-size:13px;color:var(--accent)}summary:hover{color:var(--accent2)}
dl{margin:8px 0 0;font-size:13px}dt{font-weight:700;color:var(--muted);margin-top:7px}dd{margin:2px 0 0}
.note{font-size:13px;color:var(--muted)}
@media (max-width:1000px){
 .wrap{padding:24px 18px 64px}
 .verdicts{grid-template-columns:repeat(3,1fr)}.trust,.three,.two{grid-template-columns:1fr 1fr}
 .ldr{grid-template-columns:1fr}
 .trust div{border-right:none;padding-left:0}
 .lane .row{grid-template-columns:1fr}.lane .hd{display:none}
 .flow{flex-wrap:wrap}.node{flex:1 1 100%}.arrow{flex:1 1 100%;text-align:center;transform:rotate(90deg);margin:-2px 0}
 /* 非 stack 表：窄屏在 .tw 容器内横向滚动，绝不逐字竖排 */
 .tw table:not(.stack){min-width:640px}
 table.stack thead{display:none}table.stack tr{display:block;border-bottom:2px solid var(--line)}
 /* !important：压过 widthCss 里 #exec/#tree 按列声明的百分比宽 */
 table.stack td{display:block;width:auto!important;border-bottom:none}
 table.stack td::before{content:attr(data-l);display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}}
@media (max-width:700px){.trust,.three,.two{grid-template-columns:1fr}
 .verdicts{grid-template-columns:repeat(2,1fr)}.v .k{flex-wrap:wrap}}
`;

/* ───────────────────────────── 首屏视觉索引 ───────────────────────────── */

const dispClass = d => /^OPEN/.test(d) ? 'd-open'
    : /^(FIXED|RESOLVED|CLOSED)/.test(d) ? 'd-done'
        : /^(BLOCKED|NEEDS-DECISION|ASSUMED)/.test(d) ? 'd-block' : 'd-info';
// 色标（颜色）+ 文字（语义）已构成 dataviz 要求的双通道；再加一个图标字符是第三层冗余
const dispIcon = () => '';

// 根因索引是「精确映射」，dataviz 的形态启发式对此给的是表格，不是卡片墙。
function laneHtml(lane) {
    return `<div class="tw"><table><thead><tr>
<th style="width:84px">ID</th><th>诊断</th><th style="width:126px">处置</th><th style="width:112px">影响场景</th><th style="width:56px">详情</th>
</tr></thead><tbody>
${lane.map(r => `<tr><td><strong>${esc(r.id)}</strong></td><td>${esc(r.diag)}</td>`
        + `<td><span class="disp ${dispClass(r.disp)}">${dispIcon(r.disp)} ${esc(r.disp)}</span></td>`
        + `<td><code>${esc(r.scen)}</code></td><td><a href="${esc(htmlHref(r.href))}">查看</a></td></tr>`).join('\n')}
</tbody></table></div>`;
}

// dataviz 的「>7 个色类改表格」说的是**颜色类别**数，不是行数。
// 8 条未决项若只落在 3–4 种处置上，列表仍然读得动；处置种类过多才需要表格。
function decisionsHtml(decisions) {
    const classes = new Set(decisions.map(d => dispClass(d.disp))).size;
    if (classes <= 6) {
        // ID 与处置同行、说明另起一行：窄列里也不会把处置标签挤碎
        return `<ul class="bare dec">${decisions.map(d =>
            `<li><span class="hd"><a href="#${esc(d.id.toLowerCase())}">${esc(d.id)}</a>`
            + `<span class="disp ${dispClass(d.disp)}">${dispIcon(d.disp)} ${esc(d.disp)}</span></span>`
            + `${esc(d.text)}</li>`).join('')}</ul>`;
    }
    return `<div class="tw"><table><thead><tr>
<th style="width:60px">ID</th><th style="width:150px">处置</th><th>说明</th>
</tr></thead><tbody>${decisions.map(d =>
        `<tr><td><a href="#${esc(d.id.toLowerCase())}">${esc(d.id)}</a></td>`
        + `<td><span class="disp ${dispClass(d.disp)}">${dispIcon(d.disp)} ${esc(d.disp)}</span></td>`
        + `<td>${esc(d.text)}</td></tr>`).join('')}</tbody></table></div>`;
}

// 英雄数字：每视图恰好一个，墨色，比例数字；状态由旁置色标承载
function heroHtml(verdicts) {
    const n = k => (verdicts.find(v => v.k === k) || { n: 0 }).n;
    const passed = n('passed'), bad = n('failed') + n('blocked') + n('unverified');
    const total = verdicts.reduce((s, v) => s + v.n, 0);
    const clean = bad === 0;
    const color = n('failed') ? 'var(--critical)' : clean ? 'var(--good)' : 'var(--warning)';
    const fig = clean ? `${passed}/${total}` : String(bad);
    const cap = clean ? '全部通过' : `未通过或未证实（共 ${total} 个场景）`;
    return `<div class="hero"><span class="mark" style="background:${color}"></span>`
        + `<span class="fig">${esc(fig)}</span><span class="cap">${esc(cap)}</span></div>`;
}

function flowHtml(flow, sideFlows) {
    const nodes = flow.map((s, i) =>
        `<div class="node" role="listitem"><a href="#${esc(s.href || 'step-' + s.id)}">`
        + `<span class="nid">${esc(s.id)}</span><span class="nplain">${esc(s.plain)}</span>`
        + `<span class="ntech">${esc(s.tech)}</span></a></div>`
        + (i < flow.length - 1 ? '<div class="arrow" aria-hidden="true">→</div>' : '')).join('\n');
    const side = (sideFlows || []).length
        ? `<div class="sideflows">${esc(sideFlows[0].lead || '同一批事实还被这些流程读写：')}`
        + (sideFlows.filter(s => s.id).map(s => `<a class="side" href="#${esc(s.href || 'step-' + s.id)}">`
            + `<span class="nid">${esc(s.id)}</span> ${esc(s.plain)}<span class="ntech">${esc(s.tech)}</span></a>`).join(''))
        + '</div>' : '';
    return `<div class="flow" role="list" aria-label="业务流程">\n${nodes}\n</div>${side}`;
}

function openingPlan(o) {
    return `
<section class="card outcome" aria-labelledby="h-outcome">
<p class="lbl" id="h-outcome">${esc(o.outcomeLabel || '这份计划要证明什么')}</p>
<p>${o.outcome}</p></section>

<section class="card" aria-labelledby="h-flow">
<p class="lbl" id="h-flow">${esc(o.flowLabel || '业务从哪里进、到哪里算完')}</p>
${flowHtml(o.flow, o.sideFlows)}</section>

<div class="three">
<section class="card" aria-labelledby="h-risk">
<p class="lbl" id="h-risk">${esc(o.riskLabel || '最可能让结论不成立的风险')}</p>
<ul class="bare risk">${o.risks.map(t => `<li><span class="ric" aria-hidden="true">⚠</span>${esc(t)}</li>`).join('')}</ul></section>
<section class="card" aria-labelledby="h-dec">
<p class="lbl" id="h-dec">${esc(o.decisionLabel || '会影响能否给出结论的未决项')}</p>
${decisionsHtml(o.decisions)}</section>
<section class="card" aria-labelledby="h-slice">
<p class="lbl" id="h-slice">${esc(o.sliceLabel || '首轮先跑这些')}</p>
<ol class="slice">${o.slice.map(f => `<li><a href="#${esc(f.id)}">${esc(f.id)}</a><span class="why">${esc(f.why)}</span></li>`).join('')}</ol></section>
</div>`;
}

function openingRun(o) {
    return `
<section class="card" aria-labelledby="h-verdict">
<p class="lbl" id="h-verdict">${esc(o.verdictLabel || '本轮判定分布')}</p>
${heroHtml(o.verdicts)}
<div class="verdicts">${o.verdicts.map(v =>
        `<div class="v ${v.k}${v.n === 0 ? ' zero' : ''}"><span class="n">${v.n}</span>`
        + `<span class="k"><i class="b-${v.k}"></i>${esc(v.label)} <code>${esc(v.k)}</code></span></div>`).join('')}</div>
<p class="headline">${o.headline}</p></section>

<section class="card" aria-labelledby="h-trust">
<p class="lbl" id="h-trust">${esc(o.trustLabel || '这轮跑在什么上面')}</p>
<div class="trust">${o.trust.map(t => `<div><span class="t">${esc(t.t)}</span>${t.v}</div>`).join('')}</div></section>

<div class="ldr">
<section class="card" aria-labelledby="h-lane">
<p class="lbl" id="h-lane">${esc(o.laneLabel || '未通过与阻塞根因（每个根因一行）')}</p>
${laneHtml(o.lane)}</section>

<section class="card" aria-labelledby="h-rerun">
<p class="lbl" id="h-rerun">${esc(o.rerunLabel || '下一步该跑什么（仅 OPEN 且可执行）')}</p>
<ol class="rerun">${o.rerun.map(r => `<li>${r.t} — <code>${esc(r.ids)}</code> · <a href="${esc(htmlHref(r.href))}">详情</a></li>`).join('')}</ol>
${o.rerunNote ? `<p class="note">${o.rerunNote}</p>` : ''}</section>
</div>`;
}

/* ─────────────────────────── 场景表（两种列形） ─────────────────────────── */

function scenarioTable(data) {
    const run = data.mode === 'run';
    const cols = run
        ? [['c-sc', '场景'], ['c-in', '预期输入'], ['c-out', '预期结果'], ['c-act', '实际结果']]
        : [['c-sc', '场景'], ['c-in', '预期输入'], ['c-out', '预期结果']];
    const width = run ? { 'c-sc': 20, 'c-in': 26, 'c-out': 26, 'c-act': 28 } : { 'c-sc': 26, 'c-in': 37, 'c-out': 37 };
    const tid = run ? 'exec' : 'tree';

    const groups = [];
    for (const s of data.scenarios) {
        const g = s.branch || '';
        if (!groups.length || groups[groups.length - 1].key !== g) groups.push({ key: g, items: [] });
        groups[groups.length - 1].items.push(s);
    }

    const rows = groups.map(g => {
        const head = g.key ? `<tr class="branchrow"><th colspan="${cols.length}" id="branch-${slug(g.key)}">${esc(g.key)}</th></tr>` : '';
        return head + g.items.map(s => {
            const badges = run
                ? `<div style="margin-top:5px"><span class="badge b-${s.status}">${esc(s.status)}</span> <span class="badge b-oracle">${esc(s.oracle)}</span></div>`
                : (s.priority ? `<span class="pri p${esc(s.priority)}">${esc(s.priority)}</span>` : '');
            const fields = Object.entries(s.fields || {})
                .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
            return `<tr id="${esc(s.id)}">
<td class="c-sc" data-l="场景"><a class="scid" href="#${esc(s.id)}">${esc(s.id)}</a>${run ? '' : badges}
${run ? badges : ''}<div class="sctitle">${esc(s.title)}</div>
<details><summary>${esc(run ? '状态 · 判定 · 证据链' : '规划与追溯字段')}</summary><dl>${fields}</dl></details></td>
<td class="c-in" data-l="预期输入">${s.input}</td>
<td class="c-out" data-l="预期结果">${s.expected}</td>
${run ? `<td class="c-act" data-l="实际结果">${s.actual}</td>` : ''}
</tr>`;
        }).join('\n');
    }).join('\n');

    const widthCss = `<style>${cols.map(([c]) => `#${tid} .${c}{width:${width[c]}%}`).join('')}</style>`;
    return widthCss + `<div class="tw"><table class="stack" id="${tid}">
<thead><tr>${cols.map(([c, n]) => `<th class="${c}">${esc(n)}</th>`).join('')}</tr></thead>
<tbody>\n${rows}\n</tbody></table></div>`;
}

/* ──────────────────────────────── 渲染 ──────────────────────────────── */

const page = (title, sub, body, kicker) => `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><div class="wrap">${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}${body}</div></body></html>`;

// 表格首列常常是可被链接的 ID（业务步骤 B1、需求 TR-001、缺口 G-01：…），但 markdown 表格不带锚点。
// 由数据文件声明 cellAnchors: [{pattern, prefix, lower}]，在完整层里给匹配的单元格补 id。
// 按**前缀**匹配，因此「G-01：后面还有一句话」这种单元格也能拿到 id。
function anchorCells(html, rules) {
    for (const { pattern, prefix, lower } of rules || []) {
        const re = new RegExp(`<td>(${pattern})`, 'g');
        html = html.replace(re, (_, id) => {
            const anchor = `${prefix || ''}${lower ? id.toLowerCase() : id}`;
            return `<td id="${anchor}">${id}`;
        });
    }
    return html;
}

function render(data, dir) {
    const canonicalMd = fs.readFileSync(path.join(dir, data.canonical), 'utf8');
    let full = mdToHtml(canonicalMd.split('\n').slice(1).join('\n'));   // 去掉 H1，标题由 page() 出
    full = anchorCells(full, data.cellAnchors);
    const opening = data.mode === 'run' ? openingRun(data.opening) : openingPlan(data.opening);

    const links = (data.companions || []).map(c =>
        `<a href="${esc(htmlHref(c.src))}">${esc(c.label || path.basename(c.src))}</a>`).join('、');

    const body = opening
        + `<h2 id="sec-exec">${data.mode === 'run' ? '场景对照表' : '业务场景树'}</h2>`
        + `<p class="note">${data.tableNote || ''}</p>`
        + scenarioTable(data)
        + `<h2 id="sec-full">完整${data.mode === 'run' ? '报告' : '计划'}</h2>`
        + `<p class="note">以下为规范文档的完整投影。规范来源（浏览器不跳转）：<code>${esc(data.canonical)}</code>`
        + (links ? `；另见 ${links}` : '') + '。</p>'
        + full;

    // 伴生页不带 kicker：它们是细节投影，不是报告/计划本体
    const kicker = data.kicker ?? (data.mode === 'run' ? 'E2E 执行报告' : 'E2E 测试计划');
    fs.writeFileSync(path.join(dir, data.out), page(data.title, data.subtitle, body, kicker), 'utf8');

    for (const c of data.companions || []) {
        const src = path.join(dir, c.src);
        const outRel = htmlHref(c.src);
        const raw = fs.readFileSync(src, 'utf8');
        const back = path.relative(path.dirname(path.join(dir, outRel)), path.join(dir, data.out)).replaceAll('\\', '/');
        const inner = /\.md$/i.test(c.src)
            ? mdToHtml(raw.split('\n').slice(1).join('\n'))
            : `<pre><code>${esc(raw)}</code></pre>`;
        fs.writeFileSync(path.join(dir, outRel),
            page(c.label || path.basename(c.src),
                `规范来源（浏览器不跳转）：<code>${esc(c.src)}</code> · <a href="${esc(back)}">返回</a>`, inner), 'utf8');
    }
    return (data.companions || []).length;
}

/* ──────────────────────────────── 审计 ──────────────────────────────── */

function audit(data, dir) {
    const md = fs.readFileSync(path.join(dir, data.canonical), 'utf8');
    const html = fs.readFileSync(path.join(dir, data.out), 'utf8');
    const a = data.audit || {};
    let fail = 0;
    const check = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
    const ids = (s, re) => [...new Set([...s.matchAll(re)].map(m => m[0]))].sort();

    // 1 契约章节
    if (a.sections) {
        const miss = a.sections.filter(s => !md.includes(`## ${s}`));
        check(`Markdown 含全部 ${a.sections.length} 个契约章节`, miss.length === 0, miss.join(','));
        check('HTML 投影含全部契约章节', a.sections.every(s => html.includes(s)), '');
    }

    // 2 ID 清单双向一致（HTML 不得出现 md 没有的事实）
    for (const [label, src] of Object.entries(a.idPatterns || {})) {
        const re = new RegExp(src, 'g');
        const A = ids(md, re), B = ids(html, re);
        const miss = A.filter(x => !B.includes(x)), extra = B.filter(x => !A.includes(x));
        check(`投影完整性 · ${label}（md ${A.length}）`, !miss.length && !extra.length,
            miss.length ? `HTML 缺 ${miss}` : extra.length ? `HTML 多出 ${extra}` : '一一对应');
    }

    // 3 表格行数
    const sec = h => {
        const L = md.split('\n'); const lvl = h.match(/^#+/)[0].length;
        const s = L.findIndex(x => x.trim() === h); const out = [];
        for (let i = s + 1; i < L.length; i++) { const m = L[i].match(/^(#+)\s/); if (m && m[1].length <= lvl) break; out.push(L[i]); }
        return out.join('\n');
    };
    for (const t of a.tables || []) {
        const want = sec(t.mdHeading).split('\n').filter(l => l.trim().startsWith('|')).length - 2;
        const at = html.indexOf(`id="${t.anchor}"`);
        const tbl = at < 0 ? null : (html.slice(at).match(/<table[^>]*>[\s\S]*?<\/table>/) || [null])[0];
        const got = tbl ? (tbl.match(/<tr(?![^>]*class="branchrow")/g) || []).length - 1 : -1;
        check(`投影完整性 · 表「${t.name}」行数`, want === got, `md ${want} / html ${got}`);
    }

    // 4 选择集每项都有行、字段齐备
    const need = a.requiredFields || [];
    const bad = [];
    for (const id of a.selected || []) {
        const m = html.match(new RegExp(`<tr id="${id}">[\\s\\S]*?</tr>`));
        if (!m) { bad.push(`${id}:缺行`); continue; }
        for (const f of need) if (!m[0].includes(`<dt>${f}</dt>`)) bad.push(`${id}:${f}`);
    }
    check(`选择集 ${(a.selected || []).length} 项均有行与必备字段`, bad.length === 0, bad.slice(0, 6).join(' | '));

    // 5 判定卡计数（run）
    if (data.mode === 'run') {
        for (const v of data.opening.verdicts)
            check(`判定卡 ${v.k} = ${v.n}（含零）`,
                new RegExp(`class="v ${v.k}[^"]*"[\\s\\S]{0,80}>${v.n}<`).test(html), '');
        const tally = [...html.matchAll(/<span class="badge b-(passed|failed|blocked|skipped|unverified)">/g)]
            .reduce((o, m) => (o[m[1]] = (o[m[1]] || 0) + 1, o), {});
        const expect = Object.fromEntries(data.opening.verdicts.filter(v => v.n).map(v => [v.k, v.n]));
        check('场景行状态与判定卡一致', JSON.stringify(tally) === JSON.stringify(expect),
            `行 ${JSON.stringify(tally)} / 卡 ${JSON.stringify(expect)}`);
    }

    // 6 首屏无陈旧 token —— 这条是本工具存在的直接理由
    const opening = html.slice(0, html.indexOf('id="sec-exec"'));
    for (const tok of a.staleTokens || [])
        check(`首屏无陈旧引用 ${tok}`, !new RegExp(tok).test(opening),
            (opening.match(new RegExp(tok + '[^<]{0,40}')) || [''])[0]);

    // 7 导航 / 编码 / 渲染残留
    const pages = [data.out, ...(data.companions || []).map(c => htmlHref(c.src))];
    const boundary = path.resolve(dir, a.linkBoundary || '..');
    const navBad = [], deadFrag = [], encBad = [], residue = [];
    for (const p of pages) {
        const fp = path.join(dir, p);
        if (!fs.existsSync(fp)) { navBad.push(`${p}:不存在`); continue; }
        const s = fs.readFileSync(fp, 'utf8');
        if (!s.includes('charset="utf-8"')) encBad.push(`${p}:无 UTF-8`);
        if (s.includes('�')) encBad.push(`${p}:替换字符`);
        const vis = s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '');
        if (/`/.test(vis)) residue.push(`${p}:可见反引号`);
        if (/\|\s*-{3,}/.test(vis)) residue.push(`${p}:表格分隔残留`);
        for (const h of [...s.matchAll(/href="([^"]+)"/g)].map(m => m[1])) {
            if (/^(https?:|mailto:)/.test(h)) continue;
            if (h.startsWith('#')) { if (!s.includes(`id="${h.slice(1)}"`)) deadFrag.push(`${p}${h}`); continue; }
            const [pp, fr] = h.split('#');
            if (!pp.endsWith('.html')) { navBad.push(`${p} → ${h}（非 .html）`); continue; }
            const tgt = path.resolve(path.dirname(fp), pp);
            if (!fs.existsSync(tgt)) { navBad.push(`${p} → ${h}（目标缺失）`); continue; }
            if (!tgt.startsWith(boundary)) { navBad.push(`${p} → ${h}（逃出报告套件）`); continue; }
            if (fr && !fs.readFileSync(tgt, 'utf8').includes(`id="${fr}"`)) deadFrag.push(`${p} → ${h}`);
        }
    }
    check(`导航 · ${pages.length} 个页面无原始文件链接、无越界`, !navBad.length, navBad.slice(0, 4).join(' | '));
    check('导航 · 无死锚点', !deadFrag.length, deadFrag.slice(0, 4).join(' | '));
    check('编码 · UTF-8 且无替换字符', !encBad.length, encBad.join(' | '));
    check('渲染 · 无可见反引号与表格分隔残留', !residue.length, residue.join(' | '));

    console.log(fail === 0 ? '\nAUDIT RESULT: 全部通过' : `\nAUDIT RESULT: ${fail} 项失败`);
    return fail;
}

/* ──────────────────────────────── 入口 ──────────────────────────────── */

const [, , cmd, dataPath] = process.argv;
if (!cmd || !dataPath || !['render', 'audit'].includes(cmd)) {
    console.error('用法: node reader-view.mjs <render|audit> <data.json>');
    process.exit(2);
}
const abs = path.resolve(dataPath);
const dir = path.dirname(abs);
const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
for (const k of ['mode', 'title', 'canonical', 'out', 'scenarios', 'opening']) {
    if (!(k in data)) { console.error(`数据文件缺必填字段: ${k}`); process.exit(2); }
}
if (!['plan', 'run'].includes(data.mode)) { console.error('mode 必须是 plan 或 run'); process.exit(2); }
// 列契约的必填字段：缺了必须在这里炸掉，而不是把字面 undefined 渲染进页面
// （plan 三列：场景/预期输入/预期结果；run 四列再加实际结果与状态、判定器）
{
    const needK = data.mode === 'run'
        ? ['id', 'title', 'input', 'expected', 'actual', 'status', 'oracle']
        : ['id', 'title', 'input', 'expected'];
    const miss = data.scenarios.flatMap(s =>
        needK.filter(k => s[k] === undefined || s[k] === null).map(k => `${s.id || '?'}:${k}`));
    if (miss.length) {
        console.error(`场景行缺列契约必填字段（共 ${miss.length} 处）: ${miss.slice(0, 8).join('  ')}${miss.length > 8 ? '  …' : ''}`);
        process.exit(2);
    }
}

if (cmd === 'render') {
    const n = render(data, dir);
    console.log(`written ${data.out} + ${n} companions`);
} else {
    process.exit(audit(data, dir) === 0 ? 0 : 1);
}
