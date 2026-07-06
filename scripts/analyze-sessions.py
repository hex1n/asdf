# -*- coding: utf-8 -*-
"""Analyze all local Claude Code + Codex sessions and emit corpora + stats.

Canonical location: scripts/analyze-sessions.py (moved from the dated
docs/research/ path; a shim remains there for old cron entries). Outputs
contain personal prompt corpora and default into docs/research/, where they
are gitignored — only loop-health.txt aggregates are safe to share.
"""
import datetime
import json, os, re, sys, glob, io
from collections import Counter, defaultdict

HOME = os.path.expanduser("~")
# Scrub the *current user's* home from project labels in emitted corpora, in
# both the flattened session-dir form (path separators / drive colons become
# dashes) and the native form, so outputs never carry a machine-local username.
HOME_FLAT = re.sub(r"[:\\/]", "-", HOME)

# Repo root (parent of scripts/); outputs default next to the other research
# artifacts so the existing .gitignore entries keep covering them.
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO, "docs", "research")
DEFAULT_HISTORY = os.path.join(HOME, ".taskloop", "outcomes.jsonl")

# Behavior indicators (loop-health 1-4) are computed over a rolling window so
# monthly re-runs can actually move: an all-time denominator freezes the trend.
DEFAULT_WINDOW_DAYS = 90
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def default_since(today):
    return (today - datetime.timedelta(days=DEFAULT_WINDOW_DAYS)).isoformat()


def date_in_window(date_str, since):
    s = str(date_str or "")
    return bool(DATE_RE.match(s)) and s[:10] >= since


def arg_value(argv, flag, default):
    """Value of `flag` in argv, or `default`. A flag given without a value is
    a usage error, not an IndexError crash."""
    if flag not in argv:
        return default
    i = argv.index(flag)
    if i + 1 >= len(argv):
        sys.stderr.write("%s requires a value\n" % flag)
        raise SystemExit(2)
    return argv[i + 1]


def scrub_project(proj):
    s = str(proj)
    s = s.replace(HOME_FLAT + "-", "").replace(HOME_FLAT, "~")
    s = s.replace(HOME + "\\", "~\\").replace(HOME + "/", "~/")
    return s


def truncate(s, n=400):
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]


CORRECTION_PAT = re.compile(
    r"(不对|不是这|不是的|不要|别改|别动|错了|搞错|等等|先别|先不要|回滚|撤销|重新来|重来|"
    r"还是不行|还是报|还是失败|没生效|没有生效|依然报|依然不|不行|白改|改回|你理解错|理解错了|"
    r"\bwrong\b|\brevert\b|\bundo\b|\bstop\b|还原|退回)", re.I)

VERIFY_PAT = re.compile(
    r"(测试|验证|跑一下|跑下|运行一下|执行一下|test|verify|检查一下|确认一下|自测|回归|校验|复测|验一下)", re.I)

# loop-health metric patterns (behavior indicators 1-4)
PULSE_SET = {"继续", "fix", "改", "落地", "改进", "可以", "要", "确认", "同意", "认可",
             "按这个来", "按这个落地", "go", "ok", "1", "2", "3"}
DRIFT_PAT = re.compile(
    r"(我让你|你怎么|别改|别动|不要动|你改的不是|改错|回退|回滚|撤销|都删|删除了|清掉|"
    r"谁让你|越界|扩界|写到.*去了|搞错|改坏)")
HARD_PAT = re.compile(
    r"(报文|SQL|select |断言|预期|期望结果|复现|测试命令|全绿|判据|通过标准|expected|assert|响应结果)", re.I)

NONSUCCESS_STATES = ("abandoned",)


def load_last_jsonl_row(path):
    """Last parseable JSON object line of a jsonl file, or None."""
    try:
        fh = io.open(path, "r", encoding="utf-8", errors="replace")
    except OSError:
        return None
    last = None
    with fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            if isinstance(row, dict):
                last = row
    return last


def health_delta_line(prev, cur):
    """One-line trend versus the previous loop-health run; None without one.
    loop-health.txt is overwritten every run, so this history-backed delta is
    what makes "compare with the previous run" possible."""
    if not isinstance(prev, dict):
        return None

    def diff(key):
        try:
            return int(cur.get(key) or 0) - int(prev.get(key) or 0)
        except (TypeError, ValueError):
            return 0

    return ("delta vs %s: pulse %+d, interrupts %+d, drift_corrections %+d, hard_openings %+d"
            % (prev.get("generated", "?"), diff("pulse"), diff("interrupts"),
               diff("drift"), diff("hard")))


def loop_history_metrics(history_path):
    """Outcome metrics from the out-of-tree taskloop outcome ledger
    (~/.taskloop/outcomes.jsonl, one line per closed task). Returns None when
    the ledger does not exist or holds no parseable rows.

    v2 records the task as the durable unit: one row per close with the task's
    terminal state (done / not_needed / abandoned), how many episodes it spanned,
    and whether its criterion inputs drifted. A task that took more than one
    episode is resumed work (it crossed a suspend/resume), read straight off the
    row instead of joined across rows.

    Opens are audited separately: the engine writes a state:"open" row at
    birth and the terminal row carries the same task id. An open whose id
    never reaches a close is `unclosed` — but the ledger alone cannot tell
    in-flight (suspended, mid-work) from dropped. The machine-checkable
    difference is the live task.json: an unclosed open whose repo still
    holds a task.json with the same id is in-flight; one that does not is
    `vanished` — the task was dropped without a closing verb. Opens are
    never folded into the close distribution."""
    try:
        fh = io.open(history_path, "r", encoding="utf-8", errors="replace")
    except OSError:
        return None
    states = Counter()
    rows = []
    open_ids = []
    closed_ids = set()
    with fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except Exception:
                continue
            if not isinstance(e, dict):
                continue
            state = str(e.get("state") or "?")
            if state == "open":
                open_ids.append((str(e.get("repo") or ""), e.get("id")))
                continue
            if e.get("id") is not None:
                closed_ids.add(e.get("id"))
            states[state] += 1
            try:
                episodes = int(e.get("episodes") or 1)
            except (TypeError, ValueError):
                episodes = 1
            review = str(e.get("review_level") or "none")
            rows.append((str(e.get("repo") or "?"), state, episodes,
                         bool(e.get("criterion_input_drift")), review))
    if not rows and not open_ids:
        return None
    nonsuccess = [i for i, (_, s, _e, _d, _v) in enumerate(rows) if s in NONSUCCESS_STATES]
    resumed = sum(1 for _r, _s, episodes, _d, _v in rows if episodes > 1)
    drift = sum(1 for _r, _s, _e, d, _v in rows if d)
    review_levels = Counter(v for _r, _s, _e, _d, v in rows)
    unclosed = [(r, oid) for r, oid in open_ids if oid not in closed_ids]
    return {
        "states": dict(states),
        "total": len(rows),
        "nonsuccess": len(nonsuccess),
        "resumed": resumed,
        "drift": drift,
        "review_levels": dict(review_levels),
        "reviewed_none": review_levels.get("none", 0),
        "repos": len({r for r, _s, _e, _d, _v in rows}),
        "opened": len(open_ids),
        "unclosed": len(unclosed),
        "vanished": sum(1 for repo, oid in unclosed if oid is None or live_task_id(repo) != oid),
    }


def live_task_id(repo):
    """The id of the live .taskloop/task.json under repo, or None."""
    try:
        with io.open(os.path.join(repo, ".taskloop", "task.json"), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data.get("id") if isinstance(data, dict) else None
    except Exception:
        return None


def history_report_lines(hist, history_path):
    """The loop-health indicator lines for the outcome ledger (5 and 6).

    Rendering is part of the audit: a computed count that never reaches the
    report is invisible to the meta loop."""
    if not hist:
        return ["5. terminal_states: no ledger yet (%s missing; requires taskloop task closes)"
                % history_path]
    dist = " ".join("%s=%d" % (k, v) for k, v in sorted(hist["states"].items()))
    inflight = hist["unclosed"] - hist["vanished"]
    lines = ["5. terminal_states (task closes, all-time): %s (total %d across %d opted-in repos); "
             "opens: %d recorded, in-flight: %d, vanished: %d"
             % (dist, hist["total"], hist["repos"], hist["opened"], inflight, hist["vanished"])]
    rrate = (100.0 * hist["resumed"] / hist["total"]) if hist["total"] else 0.0
    drate = (100.0 * hist["drift"] / hist["total"]) if hist["total"] else 0.0
    nrate = (100.0 * hist["reviewed_none"] / hist["total"]) if hist["total"] else 0.0
    rl = " ".join("%s=%d" % (k, v) for k, v in sorted(hist["review_levels"].items()))
    lines.append("6. resumed_tasks (spanned >1 episode, all-time): %d / %d tasks (%.0f%%); "
                 "criterion_input_drift: %d (%.0f%%); review_level: %s (none: %.0f%%)"
                 % (hist["resumed"], hist["total"], rrate, hist["drift"], drate, rl, nrate))
    return lines


# ---------------- Codex user-text extraction (importable helpers) ----------------

SKIP_PREFIXES = ("<environment_context>", "<user_instructions>", "<ENVIRONMENT", "<permissions",
                 "<turn_aborted", "<system", "<runtime", "<repo", "<collaboration", "<app_context")
ide_re = re.compile(r"## My request for Codex:\s*(.*)", re.S)
cmd_re = re.compile(r"<command-name>\s*/?([\w:-]+)\s*</command-name>")


def codex_user_text(txt):
    if not txt: return None
    if txt.startswith(SKIP_PREFIXES): return None
    if txt.startswith("# Context from my IDE setup"):
        m = ide_re.search(txt)
        return m.group(1).strip() if m else None
    if "[Request interrupted" in txt: return None
    return txt


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    # Windows consoles often run a non-UTF-8 codepage; the output files are
    # always UTF-8, keep the console mirror readable too.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    out_dir = os.path.abspath(arg_value(argv, "--out", DEFAULT_OUT))
    history_path = os.path.abspath(arg_value(argv, "--history", DEFAULT_HISTORY))
    since = arg_value(argv, "--since", default_since(datetime.date.today()))
    if not DATE_RE.match(since):
        sys.stderr.write("--since requires YYYY-MM-DD\n")
        raise SystemExit(2)
    os.makedirs(out_dir, exist_ok=True)

    def w(path):
        return io.open(os.path.join(out_dir, path), "w", encoding="utf-8", errors="replace")

    # ---------------- Claude ----------------
    claude_sessions = []          # dicts
    claude_prompts = []           # (date, project, sessionid, text)
    claude_first = {}             # session -> first prompt
    claude_tool_counter = Counter()
    claude_skill_counter = Counter()
    claude_agent_counter = Counter()
    claude_cmd_counter = Counter()
    claude_interrupts = 0

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

    files = sorted(glob.glob(os.path.join(HOME, ".codex", "sessions", "*", "*", "*", "*.jsonl")))
    files += sorted(glob.glob(os.path.join(HOME, ".codex", "archived_sessions", "*.jsonl")))
    for f in files:
        base = os.path.basename(f)
        m = re.search(r"rollout-(\d{4}-\d{2}-\d{2})", base)
        date = m.group(1) if m else "?"
        sid = base[:-6]
        n_user = 0; n_tools = 0; n_abort = 0; first_prompt = None; cwd = None
        seen = set()
        try:
            fh = io.open(f, "r", encoding="utf-8", errors="replace")
        except OSError:
            continue
        for line in fh:
            if "turn_aborted" in line:
                n_abort += 1
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
        codex_aborts += n_abort
        codex_sessions.append(dict(src="codex", project=cwd or "?", sid=sid, start=date, end=date,
                                   user_turns=n_user, tools=n_tools, interrupts=n_abort, cwd=cwd))
        if first_prompt:
            codex_first[sid] = (cwd or "?", date, first_prompt)

    # ---------------- outputs ----------------
    def dump_prompts(path, rows):
        with w(path) as fo:
            for date, proj, sid, txt in rows:
                proj_s = scrub_project(proj)
                fo.write("[%s] [%s] %s\n" % (date, proj_s[:40], txt))

    dump_prompts("corpus_claude.txt", claude_prompts)
    dump_prompts("corpus_codex.txt", codex_prompts)

    with w("first_prompts.txt") as fo:
        for sid, (proj, date, txt) in sorted(claude_first.items(), key=lambda kv: kv[1][1]):
            fo.write("[claude %s] [%s] %s\n" % (date, scrub_project(proj)[:40], txt))
        for sid, (proj, date, txt) in sorted(codex_first.items(), key=lambda kv: kv[1][1]):
            fo.write("[codex %s] [%s] %s\n" % (date, scrub_project(proj)[:40], txt))

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

    # ---------------- loop-health ----------------
    # Indicators 1-4 are behavior metrics from the session corpora,
    # computed over the rolling window so monthly re-runs show direction;
    # 5-6 are outcome metrics from the out-of-tree terminal history that
    # taskloop appends on every task close (all-time, coverage annotated).
    win_prompts = [p for p in claude_prompts + codex_prompts if date_in_window(p[0], since)]
    pulse = sum(1 for _, _, _, x in win_prompts
                if x.strip().lower() in PULSE_SET or x.strip().startswith("继续"))
    win_corr = sum(1 for _, _, _, x in win_prompts if CORRECTION_PAT.search(x))
    drift = sum(1 for _, _, _, x in win_prompts
                if CORRECTION_PAT.search(x) and DRIFT_PAT.search(x))
    _firsts = list(claude_first.values()) + list(codex_first.values())
    win_firsts = [f for f in _firsts if date_in_window(f[1], since)]
    hard_first = sum(1 for _, _, x in win_firsts if HARD_PAT.search(x))
    win_claude_int = sum(s["interrupts"] for s in claude_sessions
                         if date_in_window(s.get("start"), since))
    win_codex_aborts = sum(s["interrupts"] for s in codex_sessions
                           if date_in_window(s.get("start"), since))
    lh = []
    lh.append("generated: %s" % datetime.date.today().isoformat())
    lh.append("window: since %s for indicators 1-4 (default rolling %d days; --since overrides)"
              % (since, DEFAULT_WINDOW_DAYS))
    lh.append("1. pulse_prompts (继续/fix/落地类脉冲): %d / %d prompts" % (pulse, len(win_prompts)))
    lh.append("2. interrupts: claude=%d codex_aborts=%d" % (win_claude_int, win_codex_aborts))
    lh.append("3. scope_drift_corrections: %d / %d corrections (%.0f%%)"
              % (drift, win_corr, 100.0 * drift / win_corr if win_corr else 0))
    lh.append("4. hard_criteria_openings: %d / %d sessions (%.0f%%)"
              % (hard_first, len(win_firsts), 100.0 * hard_first / len(win_firsts) if win_firsts else 0))
    hist = loop_history_metrics(history_path)
    lh.extend(history_report_lines(hist, history_path))

    # Trend series: loop-health.txt is truncated every run, so append each
    # run's indicator values to a history file and print the delta versus the
    # previous run. Same directory as the other outputs, gitignored.
    run_row = {
        "generated": datetime.date.today().isoformat(),
        "since": since,
        "pulse": pulse,
        "prompts": len(win_prompts),
        "interrupts": win_claude_int + win_codex_aborts,
        "drift": drift,
        "corrections": win_corr,
        "hard": hard_first,
        "sessions": len(win_firsts),
        "states": (hist or {}).get("states"),
        "nonsuccess": (hist or {}).get("nonsuccess"),
        "resumed": (hist or {}).get("resumed"),
        "drift": (hist or {}).get("drift"),
        "reviewed_none": (hist or {}).get("reviewed_none"),
        "opened": (hist or {}).get("opened"),
        "unclosed": (hist or {}).get("unclosed"),
        "vanished": (hist or {}).get("vanished"),
    }
    health_history = os.path.join(out_dir, "loop-health-history.jsonl")
    delta = health_delta_line(load_last_jsonl_row(health_history), run_row)
    if delta:
        lh.append(delta)
    with io.open(health_history, "a", encoding="utf-8") as fo:
        fo.write(json.dumps(run_row, ensure_ascii=False) + "\n")

    lh_text = "\n".join(lh)
    with w("loop-health.txt") as fo:
        fo.write(lh_text + "\n")
    print("\n== LOOP HEALTH ==\n" + lh_text)


if __name__ == "__main__":
    main()
