# -*- coding: utf-8 -*-
"""Analyze all local Claude Code + Codex sessions and emit corpora + stats."""
import json, os, re, sys, glob, io
from collections import Counter, defaultdict

HOME = os.path.expanduser("~")
OUT = os.path.dirname(os.path.abspath(__file__))
if "--out" in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])
    os.makedirs(OUT, exist_ok=True)

def w(path):
    return io.open(os.path.join(OUT, path), "w", encoding="utf-8", errors="replace")

def truncate(s, n=400):
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]

CORRECTION_PAT = re.compile(
    r"(不对|不是这|不是的|不要|别改|别动|错了|搞错|等等|先别|先不要|回滚|撤销|重新来|重来|"
    r"还是不行|还是报|还是失败|没生效|没有生效|依然报|依然不|不行|白改|改回|你理解错|理解错了|"
    r"\bwrong\b|\brevert\b|\bundo\b|\bstop\b|还原|退回)", re.I)

VERIFY_PAT = re.compile(
    r"(测试|验证|跑一下|跑下|运行一下|执行一下|test|verify|检查一下|确认一下|自测|回归|校验|复测|验一下)", re.I)

# loop-health metric patterns (playbook §5 four indicators)
PULSE_SET = {"继续", "fix", "改", "落地", "改进", "可以", "要", "确认", "同意", "认可",
             "按这个来", "按这个落地", "go", "ok", "1", "2", "3"}
DRIFT_PAT = re.compile(
    r"(我让你|你怎么|别改|别动|不要动|你改的不是|改错|回退|回滚|撤销|都删|删除了|清掉|"
    r"谁让你|越界|扩界|写到.*去了|搞错|改坏)")
HARD_PAT = re.compile(
    r"(报文|SQL|select |断言|预期|期望结果|复现|测试命令|全绿|判据|通过标准|expected|assert|响应结果)", re.I)


# ---------------- Claude ----------------
claude_sessions = []          # dicts
claude_prompts = []           # (date, project, sessionid, text)
claude_first = {}             # session -> first prompt
claude_tool_counter = Counter()
claude_skill_counter = Counter()
claude_agent_counter = Counter()
claude_cmd_counter = Counter()
claude_interrupts = 0

cmd_re = re.compile(r"<command-name>\s*/?([\w:-]+)\s*</command-name>")

for f in sorted(glob.glob(os.path.join(HOME, ".claude", "projects", "*", "*.jsonl"))):
    project = os.path.basename(os.path.dirname(f))
    sid = os.path.basename(f)[:-6]
    n_user = 0; n_tools = 0; first_ts = None; last_ts = None; first_prompt = None
    n_interrupt = 0
    cwd = None
    try:
        fh = io.open(f, "r", encoding="utf-8", errors="replace")
    except OSError:
        continue
    for line in fh:
        if len(line) < 10:
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        if not isinstance(e, dict):
            continue
        ts = e.get("timestamp")
        if ts:
            if first_ts is None: first_ts = ts
            last_ts = ts
        t = e.get("type")
        if t == "user":
            if e.get("isSidechain"):
                continue
            if cwd is None: cwd = e.get("cwd")
            msg = e.get("message") or {}
            c = msg.get("content")
            texts = []
            if isinstance(c, str):
                texts = [c]
            elif isinstance(c, list):
                texts = [i.get("text", "") for i in c if isinstance(i, dict) and i.get("type") == "text"]
            for txt in texts:
                if not txt: continue
                if "[Request interrupted by user" in txt:
                    n_interrupt += 1
                    continue
                m = cmd_re.search(txt)
                if m:
                    claude_cmd_counter[m.group(1)] += 1
                    continue
                if e.get("isMeta"): continue
                if txt.startswith(("<system-reminder", "<local-command", "Caveat:", "<command-")):
                    continue
                n_user += 1
                date = (ts or "")[:10]
                claude_prompts.append((date, project, sid, truncate(txt)))
                if first_prompt is None:
                    first_prompt = truncate(txt, 500)
        elif t == "assistant":
            msg = e.get("message") or {}
            c = msg.get("content")
            if isinstance(c, list):
                for i in c:
                    if isinstance(i, dict) and i.get("type") == "tool_use":
                        n_tools += 1
                        name = i.get("name", "?")
                        claude_tool_counter[name] += 1
                        inp = i.get("input") or {}
                        if name == "Skill":
                            claude_skill_counter[inp.get("skill", "?")] += 1
                        elif name in ("Task", "Agent"):
                            claude_agent_counter[inp.get("subagent_type", "general")] += 1
    fh.close()
    claude_interrupts += n_interrupt
    claude_sessions.append(dict(src="claude", project=project, sid=sid, start=first_ts, end=last_ts,
                                user_turns=n_user, tools=n_tools, interrupts=n_interrupt, cwd=cwd))
    if first_prompt:
        claude_first[sid] = (project, (first_ts or "")[:10], first_prompt)

# ---------------- Codex ----------------
codex_sessions = []
codex_prompts = []
codex_first = {}
codex_fn_counter = Counter()
codex_aborts = 0

SKIP_PREFIXES = ("<environment_context>", "<user_instructions>", "<ENVIRONMENT", "<permissions",
                 "<turn_aborted", "<system", "<runtime", "<repo", "<collaboration", "<app_context")
ide_re = re.compile(r"## My request for Codex:\s*(.*)", re.S)

def codex_user_text(txt):
    if not txt: return None
    if txt.startswith(SKIP_PREFIXES): return None
    if txt.startswith("# Context from my IDE setup"):
        m = ide_re.search(txt)
        return m.group(1).strip() if m else None
    if "[Request interrupted" in txt: return None
    return txt

files = sorted(glob.glob(os.path.join(HOME, ".codex", "sessions", "*", "*", "*", "*.jsonl")))
files += sorted(glob.glob(os.path.join(HOME, ".codex", "archived_sessions", "*.jsonl")))
for f in files:
    base = os.path.basename(f)
    m = re.search(r"rollout-(\d{4}-\d{2}-\d{2})", base)
    date = m.group(1) if m else "?"
    sid = base[:-6]
    n_user = 0; n_tools = 0; first_prompt = None; cwd = None
    seen = set()
    try:
        fh = io.open(f, "r", encoding="utf-8", errors="replace")
    except OSError:
        continue
    for line in fh:
        if "turn_aborted" in line:
            codex_aborts += 1
        # cheap pre-filter
        if ('"role":"user"' not in line and '"role": "user"' not in line
                and 'session_meta' not in line and '"function_call"' not in line
                and 'user_message' not in line):
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        if not isinstance(e, dict): continue
        payload = e.get("payload") if isinstance(e.get("payload"), dict) else e
        pt = payload.get("type")
        if pt == "session_meta" or "cwd" in payload and pt not in ("message",):
            cwd = cwd or payload.get("cwd")
        if pt == "message" and payload.get("role") == "user":
            c = payload.get("content")
            texts = []
            if isinstance(c, list):
                texts = [i.get("text", "") for i in c if isinstance(i, dict)
                         and i.get("type") in ("input_text", "text")]
            elif isinstance(c, str):
                texts = [c]
            for txt in texts:
                if txt.startswith("<environment_context>") and cwd is None:
                    mm = re.search(r"<cwd>(.*?)</cwd>", txt)
                    if mm: cwd = mm.group(1)
                u = codex_user_text(txt)
                if u:
                    key = u[:120]
                    if key in seen: continue
                    seen.add(key)
                    n_user += 1
                    codex_prompts.append((date, cwd or "?", sid, truncate(u)))
                    if first_prompt is None:
                        first_prompt = truncate(u, 500)
        elif pt == "function_call":
            n_tools += 1
            codex_fn_counter[payload.get("name", "?")] += 1
    fh.close()
    codex_sessions.append(dict(src="codex", project=cwd or "?", sid=sid, start=date, end=date,
                               user_turns=n_user, tools=n_tools, interrupts=0, cwd=cwd))
    if first_prompt:
        codex_first[sid] = (cwd or "?", date, first_prompt)

# ---------------- outputs ----------------
def dump_prompts(path, rows):
    with w(path) as fo:
        for date, proj, sid, txt in rows:
            proj_s = str(proj).replace("C--Users-hexin-", "").replace("C:\\Users\\hexin\\", "~\\")
            fo.write("[%s] [%s] %s\n" % (date, proj_s[:40], txt))

dump_prompts("corpus_claude.txt", claude_prompts)
dump_prompts("corpus_codex.txt", codex_prompts)

with w("first_prompts.txt") as fo:
    for sid, (proj, date, txt) in sorted(claude_first.items(), key=lambda kv: kv[1][1]):
        fo.write("[claude %s] [%s] %s\n" % (date, str(proj).replace("C--Users-hexin-", "")[:40], txt))
    for sid, (proj, date, txt) in sorted(codex_first.items(), key=lambda kv: kv[1][1]):
        fo.write("[codex %s] [%s] %s\n" % (date, str(proj).replace("C:\\Users\\hexin\\", "~\\")[:40], txt))

# corrections & verification
with w("corrections.txt") as fo:
    for src, rows in (("claude", claude_prompts), ("codex", codex_prompts)):
        for date, proj, sid, txt in rows:
            if CORRECTION_PAT.search(txt):
                fo.write("[%s %s] %s\n" % (src, date, txt[:300]))

n_corr = sum(1 for _, _, _, t in claude_prompts + codex_prompts if CORRECTION_PAT.search(t))
n_verify = sum(1 for _, _, _, t in claude_prompts + codex_prompts if VERIFY_PAT.search(t))

def fmt_counter(c, n=30):
    return "\n".join("  %6d  %s" % (v, k) for k, v in c.most_common(n))

stats = []
stats.append("== CLAUDE ==")
stats.append("sessions: %d, prompts: %d, interrupts: %d" % (len(claude_sessions), len(claude_prompts), claude_interrupts))
by_proj = Counter(s["project"] for s in claude_sessions)
stats.append("sessions by project:\n" + fmt_counter(by_proj, 20))
stats.append("top tools:\n" + fmt_counter(claude_tool_counter, 35))
stats.append("skills invoked:\n" + fmt_counter(claude_skill_counter, 40))
stats.append("subagents:\n" + fmt_counter(claude_agent_counter, 20))
stats.append("slash commands:\n" + fmt_counter(claude_cmd_counter, 40))
turns = sorted(s["user_turns"] for s in claude_sessions)
if turns:
    stats.append("user turns/session: median=%d p90=%d max=%d, 1-turn sessions=%d" % (
        turns[len(turns)//2], turns[int(len(turns)*0.9)], turns[-1], sum(1 for t in turns if t <= 1)))
stats.append("")
stats.append("== CODEX ==")
stats.append("sessions: %d, prompts: %d, aborted-turn markers: %d" % (len(codex_sessions), len(codex_prompts), codex_aborts))
by_proj2 = Counter(str(s["cwd"]) for s in codex_sessions)
stats.append("sessions by cwd:\n" + fmt_counter(by_proj2, 25))
stats.append("function calls:\n" + fmt_counter(codex_fn_counter, 25))
turns2 = sorted(s["user_turns"] for s in codex_sessions)
if turns2:
    stats.append("user turns/session: median=%d p90=%d max=%d, 1-turn sessions=%d" % (
        turns2[len(turns2)//2], turns2[int(len(turns2)*0.9)], turns2[-1], sum(1 for t in turns2 if t <= 1)))
stats.append("")
stats.append("== CROSS ==")
stats.append("correction-flavored prompts: %d / %d" % (n_corr, len(claude_prompts) + len(codex_prompts)))
stats.append("verification-flavored prompts: %d" % n_verify)

# monthly activity
mon = Counter()
for d, _, _, _ in claude_prompts: mon["claude " + d[:7]] += 1
for d, _, _, _ in codex_prompts: mon["codex " + d[:7]] += 1
stats.append("monthly prompt volume:\n" + "\n".join("  %s: %d" % (k, mon[k]) for k in sorted(mon)))

out = "\n".join(stats)
with w("stats.txt") as fo:
    fo.write(out)
print(out)


# ---------------- loop-health (playbook §5 four indicators) ----------------
import datetime
_all_prompts = claude_prompts + codex_prompts
pulse = sum(1 for _, _, _, x in _all_prompts
            if x.strip().lower() in PULSE_SET or x.strip().startswith("继续"))
drift = sum(1 for _, _, _, x in _all_prompts
            if CORRECTION_PAT.search(x) and DRIFT_PAT.search(x))
_firsts = list(claude_first.values()) + list(codex_first.values())
hard_first = sum(1 for _, _, x in _firsts if HARD_PAT.search(x))
lh = []
lh.append("generated: %s" % datetime.date.today().isoformat())
lh.append("1. pulse_prompts (继续/fix/落地类脉冲): %d" % pulse)
lh.append("2. interrupts: claude=%d codex_aborts=%d" % (claude_interrupts, codex_aborts))
lh.append("3. scope_drift_corrections: %d / %d corrections (%.0f%%)"
          % (drift, n_corr, 100.0 * drift / n_corr if n_corr else 0))
lh.append("4. hard_criteria_openings: %d / %d sessions (%.0f%%)"
          % (hard_first, len(_firsts), 100.0 * hard_first / len(_firsts) if _firsts else 0))
lh_text = "\n".join(lh)
with w("loop-health.txt") as fo:
    fo.write(lh_text + "\n")
print("\n== LOOP HEALTH ==\n" + lh_text)
