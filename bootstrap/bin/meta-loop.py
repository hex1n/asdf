#!/usr/bin/env python3
"""Meta-loop backlog CLI - durable, resumable state for the skill-evolution loop.

The meta-loop (analyze sessions -> improve skills) is long and runs across
sessions and months, so it must not live in one chat's context window. This
CLI holds the durable, git-tracked, *sanitized* state a fresh-context Ralph
iteration reads to know its single next unit of work:

    docs/meta-loop/backlog.jsonl   one JSON object per candidate, append/rewrite
    docs/meta-loop/rounds/         one AGENTS.md round note per resolved candidate

Private session corpus (loop-health.txt, corrections.txt) stays gitignored under
docs/research/; only neutral, reviewable improvement candidates and decisions
live here. Stdlib only, cross-platform.

One fresh-context iteration:
    meta-loop.py next            # claim the next unit (in_progress|pending) or "none"
    ...run ONE AGENTS.md evidence round on it...
    meta-loop.py resolve --id ID --decision accept|reject|continue --note PATH
Then exit; the runtime re-feeds a fresh context. See docs/meta-loop/README.md.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

META_DIR = "docs/meta-loop"
BACKLOG = "backlog.jsonl"
ROUNDS = "rounds"
VALID_STATUS = ("pending", "in_progress", "accepted", "rejected", "deferred")
TERMINAL = ("accepted", "rejected", "deferred")
DECISION_TO_STATUS = {"accept": "accepted", "reject": "rejected", "continue": "in_progress"}
# An in_progress claim older than this is treated as stale (crashed round) and
# re-offered by `next`, so a fresh context resumes it instead of stalling.
STALE_CLAIM_SECONDS = 6 * 3600


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def epoch(ts: str) -> float:
    try:
        return time.mktime(time.strptime(ts, "%Y-%m-%dT%H:%M:%SZ"))
    except (ValueError, TypeError):
        return 0.0


def git_root(cwd: Path) -> Path:
    try:
        result = subprocess.run(
            ["git", "-C", str(cwd), "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=2,
        )
    except Exception:
        return cwd.resolve()
    root = result.stdout.strip()
    return Path(root).resolve() if result.returncode == 0 and root else cwd.resolve()


def repo_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    env = os.environ.get("ASDF_REPO")
    if env:
        return Path(env).expanduser().resolve()
    return git_root(Path.cwd())


def backlog_path(repo: Path) -> Path:
    return repo / META_DIR / BACKLOG


def load_backlog(repo: Path) -> list[dict[str, Any]]:
    path = backlog_path(repo)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            rows.append({"_invalid": line})
            continue
        rows.append(data if isinstance(data, dict) else {"_invalid": line})
    return rows


def write_backlog(repo: Path, rows: list[dict[str, Any]]) -> None:
    path = backlog_path(repo)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(row, ensure_ascii=False, sort_keys=True) for row in rows]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def next_id(rows: list[dict[str, Any]]) -> str:
    nums = [int(r["id"][1:]) for r in rows if isinstance(r.get("id"), str) and r["id"][1:].isdigit()]
    return "C%03d" % ((max(nums) + 1) if nums else 1)


def validate_rows(rows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for i, row in enumerate(rows):
        if row.get("_invalid"):
            errors.append(f"line {i + 1}: not valid JSON object")
            continue
        cid = row.get("id")
        if not isinstance(cid, str) or not cid:
            errors.append(f"line {i + 1}: missing id")
        elif cid in seen:
            errors.append(f"duplicate id {cid}")
        else:
            seen.add(cid)
        if not str(row.get("skill", "")).strip():
            errors.append(f"{cid}: missing skill")
        if not str(row.get("failure_mode", "")).strip():
            errors.append(f"{cid}: missing failure_mode")
        status = row.get("status")
        if status not in VALID_STATUS:
            errors.append(f"{cid}: status must be one of {list(VALID_STATUS)}")
        if status in TERMINAL and not str(row.get("decision", "")).strip():
            errors.append(f"{cid}: terminal status requires a decision")
    return errors


def actionable(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The single active unit of work: any in_progress claim (resume/continue
    it — fresh means keep working, stale means a prior round crashed) blocks a
    new claim, enforcing one candidate per iteration; else the oldest pending."""
    in_progress = [r for r in rows if r.get("status") == "in_progress"]
    if in_progress:
        return sorted(in_progress, key=lambda r: str(r.get("claimed_at", "")))[0]
    pending = [r for r in rows if r.get("status") == "pending"]
    if pending:
        return sorted(pending, key=lambda r: str(r.get("created_at", "")))[0]
    return None


def is_stale(row: dict[str, Any]) -> bool:
    return (
        row.get("status") == "in_progress"
        and time.time() - epoch(str(row.get("claimed_at", ""))) > STALE_CLAIM_SECONDS
    )


def cmd_enqueue(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    rows = load_backlog(repo)
    errors = validate_rows(rows)
    if errors:
        print("refusing to enqueue onto an invalid backlog:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    cid = next_id(rows)
    rows.append({
        "id": cid,
        "skill": args.skill.strip(),
        "failure_mode": args.failure.strip(),
        "evidence": (args.evidence or "").strip(),
        "status": "pending",
        "created_at": now(),
        "updated_at": now(),
    })
    write_backlog(repo, rows)
    print(cid)
    return 0


def cmd_next(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    rows = load_backlog(repo)
    errors = validate_rows(rows)
    if errors:
        print("none")
        print("backlog invalid; run `meta-loop.py validate`:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    item = actionable(rows)
    if item is None:
        print("none")
        return 0
    if item.get("status") == "pending":
        item["status"] = "in_progress"
        item["claimed_at"] = now()
        item["updated_at"] = now()
        if args.session:
            item["session"] = args.session.strip()
        write_backlog(repo, rows)
    print(json.dumps(item, ensure_ascii=False, sort_keys=True))
    return 0


def cmd_resolve(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    rows = load_backlog(repo)
    match = [r for r in rows if r.get("id") == args.id]
    if not match:
        print(f"no candidate {args.id}", file=sys.stderr)
        return 1
    row = match[0]
    row["status"] = DECISION_TO_STATUS[args.decision]
    row["decision"] = args.decision
    row["updated_at"] = now()
    if args.note:
        row["round_note"] = args.note.strip()
    write_backlog(repo, rows)
    print(f"{args.id} -> {row['status']}")
    return 0


def summarize(repo: Path) -> tuple[list[dict[str, Any]], dict[str, int]]:
    rows = load_backlog(repo)
    counts: dict[str, int] = {s: 0 for s in VALID_STATUS}
    for r in rows:
        counts[r.get("status", "pending")] = counts.get(r.get("status", "pending"), 0) + 1
    return rows, counts


def cmd_status(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    rows, counts = summarize(repo)
    print(f"repo={repo}")
    print(f"backlog={backlog_path(repo)}")
    print("counts=" + " ".join(f"{s}:{counts.get(s, 0)}" for s in VALID_STATUS))
    item = actionable(rows)
    print("next=" + (item["id"] if item else "none (backlog drained)"))
    stale = [r.get("id") for r in rows if is_stale(r)]
    if stale:
        print("stale_claims=" + ",".join(str(s) for s in stale)
              + " (a prior round likely crashed; the next iteration resumes it)")
    errors = validate_rows(rows)
    print("valid=" + ("true" if not errors else "false"))
    for e in errors:
        print(f"error={e}")
    return 1 if errors else 0


def cmd_list(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    rows = load_backlog(repo)
    for r in rows:
        if args.status and r.get("status") != args.status:
            continue
        print(json.dumps(
            {"id": r.get("id"), "skill": r.get("skill"), "status": r.get("status"),
             "failure_mode": r.get("failure_mode"), "decision": r.get("decision")},
            ensure_ascii=False, sort_keys=True))
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    repo = repo_root(args.repo)
    rows = load_backlog(repo)
    errors = validate_rows(rows)
    if errors:
        print(f"{backlog_path(repo)}: invalid")
        for e in errors:
            print(f"- {e}")
        return 1
    print(f"{backlog_path(repo)}: ok ({len(rows)} candidates)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command")

    enq = sub.add_parser("enqueue", help="add a sanitized improvement candidate")
    enq.add_argument("--repo")
    enq.add_argument("--skill", required=True)
    enq.add_argument("--failure", required=True, help="observed failure mode (neutral wording)")
    enq.add_argument("--evidence", help="pointer to sanitized evidence")
    enq.set_defaults(func=cmd_enqueue)

    nxt = sub.add_parser("next", help="claim and print the next unit of work, or 'none'")
    nxt.add_argument("--repo")
    nxt.add_argument("--session", help="stamp the claim with a session id")
    nxt.set_defaults(func=cmd_next)

    res = sub.add_parser("resolve", help="record a decision for a candidate")
    res.add_argument("--repo")
    res.add_argument("--id", required=True)
    res.add_argument("--decision", required=True, choices=sorted(DECISION_TO_STATUS))
    res.add_argument("--note", help="round-note path or text")
    res.set_defaults(func=cmd_resolve)

    st = sub.add_parser("status", help="show backlog summary and next unit")
    st.add_argument("--repo")
    st.set_defaults(func=cmd_status)

    ls = sub.add_parser("list", help="list candidates (optionally by status)")
    ls.add_argument("--repo")
    ls.add_argument("--status", choices=sorted(VALID_STATUS))
    ls.set_defaults(func=cmd_list)

    val = sub.add_parser("validate", help="validate backlog schema")
    val.add_argument("--repo")
    val.set_defaults(func=cmd_validate)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        return 2
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
