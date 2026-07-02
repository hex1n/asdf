#!/usr/bin/env python3
"""agent-doctor - read-only, cross-platform self-check for the local agent env.

Runs on Windows, macOS, and Linux (stdlib only). Windows-specific probes
(registry proxy) are guarded by os.name; everything else uses portable stdlib.
Rules: never mutate state; report facts + risk; admin rights are NOT assumed.

Usage:  python agent-doctor.py       (or python3 on macOS/Linux)
Env:    ASDF_REPO  points at the source repo (default: ~/Desktop/asdf)
"""
from __future__ import annotations

import glob
import hashlib
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
IS_WIN = os.name == "nt"
_TTY = sys.stdout.isatty()
_CYAN = "\033[36m" if _TTY else ""
_GREEN = "\033[32m" if _TTY else ""
_RESET = "\033[0m" if _TTY else ""


def section(title: str) -> None:
    print(f"\n{_CYAN}=== {title} ==={_RESET}")


def item(key: str, val: object) -> None:
    print(f"  {key:<28} {val}")


def run(cmd: list[str]) -> str:
    try:
        out = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=8,
        )
        return (out.stdout or out.stderr).strip()
    except Exception:
        return ""


def which_all(name: str) -> list[str]:
    """Every resolved path for `name` across PATH (catches multi-install conflicts)."""
    # On Windows only extensioned files are PATH-executable; on Unix use the exec bit.
    exts = [".exe", ".cmd", ".bat", ".ps1"] if IS_WIN else [""]
    found: list[str] = []
    for d in os.environ.get("PATH", "").split(os.pathsep):
        if not d:
            continue
        for ext in exts:
            p = os.path.join(d, name + ext)
            if os.path.isfile(p) and (IS_WIN or os.access(p, os.X_OK)):
                rp = os.path.realpath(p)
                if rp not in found:
                    found.append(rp)
    return found


def version_of(src: str) -> str:
    """Run `<tool> --version`; on Windows wrap .cmd/.bat via cmd /c so they execute."""
    if IS_WIN and src.lower().endswith((".cmd", ".bat")):
        cmd = ["cmd", "/c", src, "--version"]
    else:
        cmd = [src, "--version"]
    out = run(cmd).splitlines()
    return out[0] if out else "?"


def file_has(path: Path, pattern: str) -> bool:
    try:
        return re.search(pattern, path.read_text(encoding="utf-8", errors="replace"), re.M) is not None
    except OSError:
        return False


def codex_command_skill_status(name: str) -> str:
    path = HOME / ".agents" / "skills" / name / "SKILL.md"
    if not path.exists():
        return "MISSING"
    text = path.read_text(encoding="utf-8", errors="replace")
    has_name = re.search(rf"^name:\s*{re.escape(name)}\s*$", text, re.M)
    has_description = re.search(r"^description:\s*.+$", text, re.M)
    return "ok" if has_name and has_description else "WARN: malformed"


# ---------------- CLI versions ----------------
section("CLI versions")
for c in ("claude", "codex", "node", "python", "git", "rg"):
    src = shutil.which(c)
    if src:
        item(c, f"{version_of(src)}  [{src}]")
    else:
        item(c, "NOT FOUND")
for c in ("claude", "codex"):
    paths = which_all(c)
    if len(paths) > 1:
        item(f"{c} duplicates", "WARN: " + " | ".join(paths))

# ---------------- Processes (residual detection) ----------------
section("Processes (residual detection)")
try:
    if IS_WIN:
        listing = run(["tasklist", "/FO", "CSV", "/NH"]).lower()
    else:
        listing = run(["ps", "-A", "-o", "comm="]).lower()
    for p in ("claude", "codex", "node"):
        n = len(re.findall(re.escape(p), listing))
        item(p, f"{n} running" if n else "none")
except Exception:
    item("process scan", "unavailable on this platform")

# ---------------- Proxy / network ----------------
section("Proxy / network")
item("env HTTP_PROXY", os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy") or "(unset)")
item("env HTTPS_PROXY", os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or "(unset)")
if IS_WIN:
    try:
        import winreg

        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                           r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
        enable, _ = winreg.QueryValueEx(k, "ProxyEnable")
        try:
            server, _ = winreg.QueryValueEx(k, "ProxyServer")
        except OSError:
            server = ""
        item("Windows user proxy", f"Enable={enable} Server={server}")
    except Exception:
        item("Windows user proxy", "unreadable")
else:
    item("system proxy", "(env vars above are the effective proxy on this OS)")
try:
    s = socket.create_connection(("127.0.0.1", 9222), timeout=0.5)
    s.close()
    item("Chrome CDP :9222", "listening")
except OSError:
    item("Chrome CDP :9222", "not listening (claude-in-chrome/playwright CDP unavailable)")

# ---------------- Agent config presence ----------------
section("Agent config presence")
claude_md = HOME / ".claude" / "CLAUDE.md"
codex_agents = HOME / ".codex" / "AGENTS.md"
codex_cfg = HOME / ".codex" / "config.toml"
workflow_hook = HOME / "bin" / "agent-workflow-hook.py"
item("~/.claude/settings.json", "ok" if (HOME / ".claude" / "settings.json").exists() else "MISSING")
item("~/.claude/CLAUDE.md",
     "ok (contract present)" if file_has(claude_md, "Execution Contract") else "WARN: no Execution Contract section")
item("~/.codex/config.toml", "ok" if codex_cfg.exists() else "MISSING")
item("~/.codex/AGENTS.md",
     "ok (contract present)" if file_has(codex_agents, "Execution Contract") else "WARN: no Execution Contract section")
item("~/bin/agent-workflow-hook.py", "ok" if workflow_hook.exists() else "MISSING")
claude_workflow_hook = file_has(HOME / ".claude" / "settings.json", r"agent-workflow-hook\.py")
codex_workflow_hook = (
    file_has(codex_cfg, r"agent-workflow-hook\.py")
    or file_has(HOME / ".codex" / "hooks.json", r"agent-workflow-hook\.py")
)
item(
    "workflow hook registration",
    f"claude={'ok' if claude_workflow_hook else 'MISSING'} "
    f"codex={'ok' if codex_workflow_hook else 'MISSING'}",
)
try:
    mcp = len(re.findall(r"^\[mcp_servers\.", codex_cfg.read_text(encoding="utf-8", errors="replace"), re.M))
    item("codex MCP servers", mcp)
except OSError:
    pass
for f in ("land", "fixloop", "converge"):
    cc = (HOME / ".claude" / "commands" / f"{f}.md").exists()
    cx = codex_command_skill_status(f)
    item(
        f"cmd /{f}",
        f"claude={'ok' if cc else 'MISSING'} codex_skill={cx}",
    )
if file_has(HOME / ".claude" / "settings.json", r'"skipDangerousModePermissionPrompt"\s*:\s*true'):
    item("skipDangerousPrompt",
         "WARN: true - dangerous-mode confirmations are skipped (weakens the only prompt-layer friction on scope drift)")
try:
    m = re.search(r'approvals_reviewer\s*=\s*"([^"]+)"', codex_cfg.read_text(encoding="utf-8", errors="replace"))
    if m:
        ar = m.group(1)
        if ar in ("user", "auto_review"):
            note = f"ok ({ar})"
        elif ar == "guardian_subagent":
            # Accepted legacy alias for auto_review per codex-rs config.schema.json;
            # may be dropped in a future release.
            note = ("ok (guardian_subagent - legacy alias of auto_review, still accepted; "
                    "prefer migrating to auto_review)")
        else:
            note = (
                f"WARN: '{ar}' is not in the documented value set (user/auto_review, legacy "
                "guardian_subagent) - verify against official Codex docs whether this reviewer actually "
                "runs; the AGENTS.md Guardian criteria only bind if the approvals layer is live")
        item("approvals_reviewer", note)
except OSError:
    pass

# ---------------- Skill drift (source vs installed) ----------------
section("Skill drift (source vs installed)")
repo = Path(os.environ.get("ASDF_REPO") or (HOME / "Desktop" / "asdf"))
src_root = repo / "skills"


# Interpreter build artifacts drift independently of the source and are not
# distributed content, so they must not count toward source-vs-installed drift.
_IGNORED_DIR_PARTS = {"__pycache__"}
_IGNORED_SUFFIXES = (".pyc", ".pyo")


def tree_hash(root: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(root).as_posix()
        parts = rel.split("/")
        if any(p.startswith(".") or p in _IGNORED_DIR_PARTS for p in parts):
            continue
        if f.suffix in _IGNORED_SUFFIXES:
            continue
        h.update(rel.encode())
        h.update(f.read_bytes())
    return h.hexdigest()


if src_root.is_dir():
    linked, copied = set(), set()
    for sk in sorted(p for p in src_root.iterdir() if p.is_dir()):
        for rt in (HOME / ".claude" / "skills", HOME / ".codex" / "skills"):
            inst = rt / sk.name
            if not inst.exists():
                continue
            if tree_hash(sk) != tree_hash(inst):
                item(f"{sk.name} -> {rt}", "DRIFT")
            probe_src, probe_inst = sk / "SKILL.md", inst / "SKILL.md"
            try:
                is_link = probe_src.exists() and probe_inst.exists() and os.path.samefile(probe_src, probe_inst)
            except OSError:
                is_link = False
            (linked if is_link else copied).add(sk.name)
    item("linked installs", ", ".join(sorted(linked)))
    item("copied installs", ", ".join(sorted(copied)) + "  <- re-run install.py after source edits")
    item("drift scan", "done (only DRIFT lines above are problems)")
else:
    item("drift scan", f"WARN: source repo not found at {src_root} (set ASDF_REPO env var); scan skipped")

# ---------------- Loop health review ----------------
section("Loop health review")
lh = repo / "docs" / "research" / "loop-health.txt"
if lh.exists():
    age = int((time.time() - lh.stat().st_mtime) // 86400)
    note = " - WARN: monthly review due (run analyze-sessions.py)" if age > 35 else ""
    item("loop-health.txt", f"age {age} days{note}")
else:
    item("loop-health.txt", "missing - run docs/research/2026-07-02-analyze-sessions.py to create the baseline")

# ---------------- Disk ----------------
section("Disk")
try:
    usage = shutil.disk_usage(str(HOME))
    item(f"{HOME.anchor or '/'} free",
         f"{usage.free / 2**30:.1f} GB free / {usage.total / 2**30:.1f} GB total")
except OSError:
    item("disk", "unreadable")

# ---------------- Recent sandbox errors (codex) ----------------
section("Recent sandbox errors (codex)")
logs = sorted(glob.glob(str(HOME / ".codex" / "sandbox*.log")), key=os.path.getmtime, reverse=True)
if logs:
    newest = logs[0]
    try:
        text = Path(newest).read_text(encoding="utf-8", errors="replace")
        errs = [ln for ln in text.splitlines() if re.search(r"SetTokenInformation|error", ln)]
        item(os.path.basename(newest), f"last errors: {len(errs)} (see file)" if errs else "clean")
    except OSError:
        item(os.path.basename(newest), "unreadable")
else:
    item("sandbox log", "none")

print(f"\n{_GREEN}Done. Read-only check; nothing was changed.{_RESET}")
