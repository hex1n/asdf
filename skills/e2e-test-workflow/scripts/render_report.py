#!/usr/bin/env python3
"""Render report/v1 Markdown without inference, network access or third-party code."""
import argparse
from collections import Counter
from dataclasses import dataclass
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

STATES = ('passed', 'failed', 'blocked', 'unverified', 'skipped')
LABELS = dict(zip(STATES, ('通过', '失败', '阻塞', '未验证', '跳过')))
CASE = re.compile(r'^## ([A-Za-z][A-Za-z0-9_-]*) \[(' + '|'.join(STATES) + r')\] (.+)$')
SHARED = re.compile(r'^## shared:([A-Za-z][A-Za-z0-9_-]*) (.+)$')
# Dispositions are the closed vocabulary of run/REFERENCE.md#defect-handoffs and
# stay in their original spelling under the report language policy.
DISPOSITIONS = ('OPEN', 'CLOSED', 'MITIGATED', 'ACCEPTED', 'CONDITIONAL',
                'BLOCKED-BY-TOOLING', 'BLOCKED-BY-ENVIRONMENT', 'OUT-OF-SCOPE')
ISSUE = re.compile(r'^## issue:([A-Za-z][A-Za-z0-9_-]*) \[(' + '|'.join(DISPOSITIONS) + r')\] (.+)$')
MARKER = '<!-- e2e-reader: report/v1 -->'


class InvalidReport(ValueError):
    pass


@dataclass
class Section:
    id: str
    title: str
    text: str = ''
    status: str = ''
    disposition: str = ''


def parse(text):
    lines = text.splitlines()
    if not lines or lines[0] != MARKER:
        raise InvalidReport('Missing report/v1 marker; adapt a copy of legacy Markdown first.')
    if len(lines) < 3 or not lines[1].startswith('# '):
        raise InvalidReport('Expected a single # report title immediately after marker.')
    title = lines[1][2:].strip()
    overview = Section('overview', title)
    sections = [overview]
    current = overview
    fenced = False
    for line in lines[2:]:
        if line.startswith('```'):
            fenced = not fenced
        if not fenced and line.startswith('## '):
            case, shared, issue = CASE.fullmatch(line), SHARED.fullmatch(line), ISSUE.fullmatch(line)
            if case:
                current = Section(case[1], case[3], status=case[2])
            elif shared:
                current = Section('shared-' + shared[1], shared[2])
            elif issue:
                current = Section('issue-' + issue[1], issue[3], disposition=issue[2])
            elif line.startswith('## issue:'):
                raise InvalidReport('Issue heading needs one disposition of ' + '/'.join(DISPOSITIONS) + ': ' + line)
            else:
                raise InvalidReport('Unsupported section heading: ' + line)
            sections.append(current)
        else:
            current.text += line + '\n'
    if fenced:
        raise InvalidReport('Unclosed code fence.')
    if not title or not overview.text.strip():
        raise InvalidReport('Title and business overview are required.')
    cases = [s for s in sections if s.status]
    if not cases:
        raise InvalidReport('No selected cases; refusing to imply a successful empty run.')
    for case in cases:
        if not case.text.strip() or case.text.lstrip().startswith(('#', '|', '-', '```')):
            raise InvalidReport(case.id + ': start with a business-result paragraph.')
    issues = [s for s in sections if s.disposition]
    for issue in issues:
        if not issue.text.strip() or issue.text.lstrip().startswith(('#', '|', '-', '```')):
            raise InvalidReport(issue.id + ': start with a business-impact paragraph.')
    return overview, cases, [s for s in sections[1:] if not s.status and not s.disposition], issues


class Markdown:
    def __init__(self, source):
        self.source = source
        self.links = []

    def href(self, target):
        if target.startswith('#'):
            result = target
        elif re.match(r'^[A-Za-z]:[\\/]', target):
            path = Path(target)
            if not path.exists():
                raise InvalidReport('Missing local link: ' + target)
            result = path.resolve().as_uri()
        else:
            parts = urlsplit(target)
            if parts.scheme in ('https', 'http', 'mailto'):
                result = target
            elif parts.scheme == 'file':
                name = unquote(parts.path)
                if sys.platform == 'win32' and re.match(r'^/[A-Za-z]:/', name):
                    name = name[1:]
                if parts.netloc:
                    name = '//' + parts.netloc + name
                if not Path(name).exists():
                    raise InvalidReport('Missing file link: ' + target)
                result = target
            elif parts.scheme:
                raise InvalidReport('Unsupported link scheme: ' + parts.scheme)
            else:
                path = (self.source.parent / unquote(parts.path)).resolve()
                if not path.exists():
                    raise InvalidReport('Missing local link: ' + target)
                result = path.as_uri()
                if parts.query:
                    result += '?' + parts.query
                if parts.fragment:
                    result += '#' + parts.fragment
        self.links.append(result)
        return html.escape(result, quote=True)

    def inline(self, text):
        # A documented subset, not a permissive Markdown implementation.
        token = re.compile(r'(`+)(.*?)\1|(!?)\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*', re.S)
        output, cursor = [], 0
        def plain(value):
            if re.search(r'!?\[[^\]]*\]\(|\[[^\]]+\]\[|`|\*\*|~~|<[/!A-Za-z]', value):
                raise InvalidReport('Unsupported inline markup; use supported links/code/emphasis: ' + value[:100])
            return html.escape(value)
        for match in token.finditer(text):
            output.append(plain(text[cursor:match.start()]))
            if match[1]:
                output.append('<code>' + html.escape(match[2]) + '</code>')
            elif match[4]:
                url = self.href(match[5])
                label = html.escape(match[4], quote=True)
                if match[3]:
                    if not url.startswith('file:'):
                        raise InvalidReport('Images must be local evidence files.')
                    output.append(f'<img src="{url}" alt="{label}">')
                else:
                    output.append(f'<a href="{url}">{label}</a>')
            elif match[6]:
                output.append('<strong>' + html.escape(match[6]) + '</strong>')
            else:
                output.append('<em>' + html.escape(match[7]) + '</em>')
            cursor = match.end()
        output.append(plain(text[cursor:]))
        return ''.join(output)

    def blocks(self, text):
        lines, result, i = text.strip().splitlines(), [], 0
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                i += 1
                continue
            if line.startswith('```'):
                if not re.fullmatch(r'```[A-Za-z0-9_-]*', line):
                    raise InvalidReport('Unsupported code fence.')
                body, i = [], i + 1
                while i < len(lines) and lines[i] != '```':
                    body.append(lines[i]); i += 1
                if i == len(lines):
                    raise InvalidReport('Unclosed code fence.')
                result.append('<pre><code>' + html.escape('\n'.join(body)) + '</code></pre>')
                i += 1
            elif line.startswith('|'):
                rows = []
                while i < len(lines) and lines[i].startswith('|'):
                    row = lines[i]
                    if not row.endswith('|') or '\\|' in row:
                        raise InvalidReport('Tables need outer pipes; move literal-pipe evidence to a code block.')
                    rows.append([c.strip() for c in row[1:-1].split('|')]); i += 1
                if len(rows) < 2 or not all(re.fullmatch(r':?-+:?', c) for c in rows[1]):
                    raise InvalidReport('Missing table separator.')
                if any(len(r) != len(rows[0]) for r in rows):
                    raise InvalidReport('Unequal table widths; literal pipes need a different representation.')
                wide = ' class="wide"' if len(rows[0]) > 4 else ''
                result.append('<div class="table-wrap"><table' + wide + '><thead><tr>' + ''.join('<th>' + self.inline(c) + '</th>' for c in rows[0]) + '</tr></thead><tbody>')
                result.extend('<tr>' + ''.join('<td>' + self.inline(c) + '</td>' for c in row) + '</tr>' for row in rows[2:])
                result.append('</tbody></table></div>')
            elif line.startswith('- '):
                items = []
                while i < len(lines) and lines[i].startswith('- '):
                    items.append('<li>' + self.inline(lines[i][2:]) + '</li>'); i += 1
                result.append('<ul>' + ''.join(items) + '</ul>')
            elif re.match(r'^#{3,6} ', line):
                result.append('<h4>' + self.inline(line.lstrip('#').strip()) + '</h4>'); i += 1
            else:
                paragraph = []
                while i < len(lines) and lines[i].strip():
                    candidate = lines[i]
                    if paragraph and re.match(r'^(?:#|\||- |```)', candidate):
                        break
                    if re.match(r'^(?:\s{2,}\S|# |## |>|\d+\. |\* |---|~~~|\[.+\]:)', candidate):
                        raise InvalidReport('Unsupported block: ' + candidate[:100])
                    paragraph.append(candidate); i += 1
                result.append('<p>' + self.inline(' '.join(paragraph)) + '</p>')
        return '\n'.join(result)


class Structure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])


def issue_file(target, home):
    # This run's own issue records: a file under an issues/ directory beside the
    # report. Another run's issue, cited as context, is not this report's to list.
    parts = urlsplit(target)
    if parts.scheme != 'file':
        return False
    path = unquote(parts.path)
    return 'issues' in path.split('/')[:-1] and path.startswith(home)


def render(source, text):
    overview, cases, shared, issues = parse(text)
    md = Markdown(source)
    home = unquote(urlsplit(source.parent.as_uri()).path).rstrip('/') + '/'
    counts = Counter(c.status for c in cases)
    asset = Path(__file__).resolve().parent.parent / 'references' / 'report.css'
    css = asset.read_text(encoding='utf-8')
    main_overview = md.blocks(overview.text)
    rows, bodies, cited = [], [], {}
    for index, case in enumerate(cases):
        first = case.text.strip().split('\n\n', 1)[0].strip()
        summary = md.blocks(first)
        mark = len(md.links)
        content = md.blocks(case.text)
        # Which issues a case is affected by is read off the case's own links.
        cited[case.id] = {t[1:] for t in md.links[mark:] if t.startswith('#')}
        rows.append(f'<tr><td><a href="#{case.id}">{case.id}</a></td><td>{html.escape(case.title)}</td><td class="status {case.status}">{LABELS[case.status]}</td><td>{summary}</td></tr>')
        inherited = ''
        if index == 0:
            inherited = ''.join(f'<details class="nested" id="{s.id}"><summary>{html.escape(s.title)}</summary>{md.blocks(s.text)}</details>' for s in shared)
        opened = ' open' if case.status in ('failed', 'blocked') else ''
        bodies.append(f'<details class="case {case.status}" id="{case.id}"{opened}><summary><span class="summary-line"><span>{case.id} · {html.escape(case.title)}</span><span class="status {case.status}">{LABELS[case.status]}</span></span></summary><div class="case-content">{summary}<details class="nested" id="{case.id}-record"><summary>完整输入、预期、实际与证据</summary>{content}</details>{inherited}<details class="nested"><summary>资料来源</summary><a href="{source.as_uri()}">Markdown 事实来源</a></details></div></details>')
    issue_rows, issue_bodies, covered = [], [], set()
    for issue in issues:
        mark = len(md.links)
        body = md.blocks(issue.text)
        covered.update(t for t in md.links[mark:] if issue_file(t, home))
        ident = issue.id[len('issue-'):]
        affected = [c.id for c in cases if issue.id in cited[c.id]]
        links = '、'.join(f'<a href="#{c}">{c}</a>' for c in affected) or '—'
        issue_rows.append(f'<tr><td><a href="#{issue.id}">{ident}</a></td><td class="disposition" data-disposition="{issue.disposition}">{issue.disposition}</td><td>{html.escape(issue.title)}</td><td>{links}</td></tr>')
        opened = ' open' if issue.disposition == 'OPEN' else ''
        issue_bodies.append(f'<details class="issue-card" data-disposition="{issue.disposition}" id="{issue.id}"{opened}><summary><span class="summary-line"><span>{ident} · {html.escape(issue.title)}</span><span class="disposition">{issue.disposition}</span></span></summary><div class="case-content">{body}</div></details>')
    orphans = sorted({t for t in md.links if issue_file(t, home)} - covered)
    if orphans:
        raise InvalidReport('Issue record linked without its own issue section: ' + ', '.join(orphans))
    issue_link, issues_section = '', ''
    if issues:
        tally = Counter(i.disposition for i in issues)
        spread = ' · '.join(f'{d} {tally[d]}' for d in DISPOSITIONS if tally[d])
        issue_link = '<a href="#issues">问题列表</a>'
        issues_section = (f'<section class="section" id="issues"><h2>问题列表</h2>'
                          f'<p class="small">共 {len(issues)} 项：{spread}。影响场景由各场景的引用得出，与场景计数不同。</p>'
                          '<div class="table-wrap"><table class="overview-table"><thead><tr><th>ID</th><th>处置</th><th>问题</th><th>影响场景</th></tr></thead><tbody>'
                          + ''.join(issue_rows) + '</tbody></table></div>' + ''.join(issue_bodies) + '</section>')
    nav = ''.join(f'<a href="#{c.id}">{c.id}　{html.escape(c.title)}</a>' for c in cases)
    counters = ''.join(f'<div>{LABELS[s]} <b>{counts[s]}</b></div>' for s in STATES)
    state = 'attention' if any(c.status != 'passed' for c in cases) else 'clear'
    script = '''function go(scroll){const id=decodeURIComponent(location.hash.slice(1)||'overview');const t=document.getElementById(id);if(!t)return;for(let n=t;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});if(scroll)t.scrollIntoView()}addEventListener('hashchange',()=>go(true));document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a&&a.hash===location.hash){e.preventDefault();go(true)}});go(!!location.hash);'''
    document = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(overview.title)}</title><style>{css}</style></head><body><div class="shell"><aside class="sidebar"><p class="brand">审阅长卷</p><p class="tag">执行报告</p><nav class="side-nav"><a href="#overview">报告总览</a>{issue_link}<a href="#cases">场景用例</a></nav><nav class="case-links">{nav}</nav></aside><main class="main"><h1>{html.escape(overview.title)}</h1><section class="overview {state}" id="overview">{main_overview}<div class="counts">{counters}</div></section>{issues_section}<section class="section"><h2>场景总览</h2><div class="table-wrap"><table class="overview-table"><thead><tr><th>ID</th><th>场景</th><th>状态</th><th>业务结果与限制</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div></section><section class="section" id="cases"><h2>场景用例</h2>{''.join(bodies)}</section></main><aside class="right"><h2>阅读索引</h2><p>共 {len(cases)} 个场景</p><p>完整输入与证据收在对应场景内。</p><p>共享资料位于首个场景；各场景正文说明适用范围。</p></aside></div><script>{script}</script></body></html>'''
    structure = Structure(); structure.feed(document)
    if len(set(structure.ids)) != len(structure.ids):
        raise InvalidReport('Duplicate or reserved section ID.')
    for target in md.links:
        if target.startswith('#') and unquote(target[1:]) not in structure.ids:
            raise InvalidReport('Missing fragment: ' + target)
    return document, {'counts': {s: counts[s] for s in STATES}, 'cases': [c.id for c in cases],
                      'issues': [i.id[len('issue-'):] for i in issues], 'checked_links': len(md.links)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, help='Default: source with .html suffix')
    args = parser.parse_args()
    source = args.source.resolve()
    output = (args.output or source.with_suffix('.html')).resolve()
    try:
        if source == output or output.suffix.lower() != '.html':
            raise InvalidReport('Output must be a distinct .html file.')
        raw = source.read_bytes()
        page, checks = render(source, raw.decode('utf-8-sig'))
        if source.read_bytes() != raw:
            raise InvalidReport('Source changed while rendering; retry its final revision.')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(page, encoding='utf-8', newline='\n')
        print(json.dumps({'output': str(output), 'source_sha256': hashlib.sha256(raw).hexdigest(), **checks}, ensure_ascii=False))
    except (InvalidReport, OSError, UnicodeError) as error:
        print('Render failed: ' + str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
