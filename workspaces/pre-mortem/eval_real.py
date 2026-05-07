#!/usr/bin/env python3
"""Trigger eval for the REAL skill at ~/.claude/skills/pre-mortem.

Swaps the description in SKILL.md, runs claude -p per query in parallel,
counts how many invoke Skill(skill="pre-mortem"), and restores.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

SKILL_PATH = Path(
    os.environ.get("SKILL_PATH", str(Path.home() / ".claude/skills/pre-mortem/SKILL.md"))
)
SKILL_NAME = "pre-mortem"


def read_skill():
    return SKILL_PATH.read_text()


def write_description(content: str, new_description: str) -> str:
    """Replace `description:` line in YAML frontmatter."""
    m = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not m:
        raise ValueError("No frontmatter found")
    fm = m.group(1)
    new_fm = re.sub(
        r"^description:.*$",
        f"description: {new_description}",
        fm,
        flags=re.MULTILINE,
    )
    return f"---\n{new_fm}\n---\n" + content[m.end():]


def run_query(query: str, timeout: int, model: str) -> bool:
    """Return True if Claude invokes the pre-mortem skill."""
    cmd = [
        "claude", "-p", query,
        "--output-format", "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--model", model,
    ]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    triggered = False
    accumulated_json = ""
    pending_tool = False
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        cwd=str(Path.home()), env=env,
    )
    start = time.time()
    try:
        for line in proc.stdout:
            if time.time() - start > timeout:
                break
            try:
                ev = json.loads(line.decode("utf-8", errors="replace"))
            except json.JSONDecodeError:
                continue
            if ev.get("type") == "stream_event":
                se = ev.get("event", {})
                t = se.get("type", "")
                if t == "content_block_start":
                    cb = se.get("content_block", {})
                    if cb.get("type") == "tool_use" and cb.get("name") == "Skill":
                        pending_tool = True
                        accumulated_json = ""
                elif t == "content_block_delta" and pending_tool:
                    delta = se.get("delta", {})
                    if delta.get("type") == "input_json_delta":
                        accumulated_json += delta.get("partial_json", "")
                        if SKILL_NAME in accumulated_json:
                            triggered = True
                            break
                elif t in ("content_block_stop", "message_stop"):
                    if pending_tool and SKILL_NAME in accumulated_json:
                        triggered = True
                    pending_tool = False
                    if t == "message_stop":
                        break
            elif ev.get("type") == "result":
                break
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
    return triggered


def evaluate(eval_set, runs_per_query, timeout, model, workers):
    results = {}
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futures = {}
        for item in eval_set:
            for _ in range(runs_per_query):
                futures[ex.submit(run_query, item["query"], timeout, model)] = item
        for f in as_completed(futures):
            item = futures[f]
            q = item["query"]
            results.setdefault(q, {"item": item, "triggers": []})
            try:
                results[q]["triggers"].append(f.result())
            except Exception as e:
                print(f"WARN: {e}", file=sys.stderr)
                results[q]["triggers"].append(False)
    out = []
    for q, d in results.items():
        item = d["item"]
        n = len(d["triggers"])
        t = sum(d["triggers"])
        rate = t / n if n else 0.0
        passed = (rate >= 0.5) if item["should_trigger"] else (rate < 0.5)
        out.append({
            "query": q, "should_trigger": item["should_trigger"],
            "trigger_rate": rate, "triggers": t, "runs": n, "pass": passed,
        })
    out.sort(key=lambda r: (not r["should_trigger"], not r["pass"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval-set", required=True)
    ap.add_argument("--description", required=True, help="Description to test (or path to file)")
    ap.add_argument("--runs-per-query", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=45)
    ap.add_argument("--workers", type=int, default=10)
    ap.add_argument("--model", default="claude-opus-4-7")
    ap.add_argument("--label", default="candidate")
    ap.add_argument("--output", default=None)
    args = ap.parse_args()

    desc = args.description
    if Path(desc).exists():
        desc = Path(desc).read_text().strip()

    eval_set = json.loads(Path(args.eval_set).read_text())
    original = read_skill()
    try:
        SKILL_PATH.write_text(write_description(original, desc))
        print(f"[{args.label}] swapped description, running {len(eval_set)} queries × {args.runs_per_query}", file=sys.stderr)
        results = evaluate(eval_set, args.runs_per_query, args.timeout, args.model, args.workers)
    finally:
        SKILL_PATH.write_text(original)
        print(f"[{args.label}] restored original description", file=sys.stderr)

    pos = [r for r in results if r["should_trigger"]]
    neg = [r for r in results if not r["should_trigger"]]
    pos_pass = sum(1 for r in pos if r["pass"])
    neg_pass = sum(1 for r in neg if r["pass"])
    summary = {
        "label": args.label,
        "description": desc,
        "positive_pass_rate": f"{pos_pass}/{len(pos)}",
        "negative_pass_rate": f"{neg_pass}/{len(neg)}",
        "overall": f"{pos_pass + neg_pass}/{len(results)}",
        "results": results,
    }
    if args.output:
        Path(args.output).write_text(json.dumps(summary, indent=2, ensure_ascii=False))

    print(f"\n=== [{args.label}] ===", file=sys.stderr)
    print(f"positive (should-trigger): {pos_pass}/{len(pos)}", file=sys.stderr)
    print(f"negative (should-not):     {neg_pass}/{len(neg)}", file=sys.stderr)
    print(f"overall: {pos_pass + neg_pass}/{len(results)}", file=sys.stderr)
    for r in results:
        tag = "PASS" if r["pass"] else "FAIL"
        exp = "T" if r["should_trigger"] else "F"
        print(f"  [{tag}] {r['triggers']}/{r['runs']} exp={exp}: {r['query'][:80]}", file=sys.stderr)


if __name__ == "__main__":
    main()
