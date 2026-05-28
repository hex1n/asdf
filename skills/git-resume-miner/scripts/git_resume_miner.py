#!/usr/bin/env python3
"""Collect Git commit evidence for resume and interview analysis."""

from __future__ import annotations

import argparse
import collections
import json
import os
import pathlib
import subprocess
import sys
from typing import Any


FIELD_SEP = "\x1f"
RECORD_SEP = "\x1e"

CATEGORY_RULES = [
    ("test", ["test", "spec", "junit", "mock", "assert", "coverage", "测试", "挡板"]),
    ("docs", ["doc", "readme", "markdown", ".md", "文档"]),
    ("build-ci", ["pom.xml", "gradle", "maven", "ci", "workflow", "docker", "jenkins", "配置"]),
    ("bugfix", ["fix", "bug", "repair", "correct", "resolve", "hotfix", "修复", "修改bug", "异常"]),
    ("contract-signing", ["contract", "stamp", "签章", "签订", "合同"]),
    ("loan-disbursement", ["loanapply", "lend", "pay", "放款", "借据", "支付", "流水"]),
    ("repayment-plan", ["repay", "还款", "试算", "扣款"]),
    ("insurance", ["insurance", "保费", "保单", "投保", "理赔"]),
    ("fund-platform", ["fund", "资金平台", "资管", "资金来源"]),
    ("notification", ["notice", "notify", "listener", "message", "mns", "通知", "监听", "推送"]),
    ("data-db", ["sql", "migration", "schema", "database", "dao", "mapper", "字段", "表"]),
    ("feature", ["feat", "feature", "add", "implement", "support", "create", "添加", "实现", "主干"]),
    ("refactor", ["refactor", "cleanup", "rename", "simplify", "rework", "优化", "删除多余代码", "去掉多余代码"]),
    ("performance", ["perf", "optimize", "cache", "latency", "speed", "性能"]),
    ("security-risk", ["permission", "security", "risk", "encrypt", "token", "权限", "加密", "风控"]),
    ("api-integration", ["api", "client", "provider", "rpc", "http", "integration", "接口", "合作方"]),
    ("ui", ["ui", "frontend", "view", "page", "component", "前端", "页面"]),
]


def run_git(repo: str, args: list[str]) -> str:
    result = subprocess.run(
        ["git", "-C", repo, *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "git command failed")
    return result.stdout


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect Git author evidence for resume mining.")
    parser.add_argument("--repo", default=".", help="Git repository path. Defaults to current directory.")
    parser.add_argument("--author", required=True, help="git log --author value, usually name or email.")
    parser.add_argument("--since", help="Start date accepted by git log, for example 2024-01-01.")
    parser.add_argument("--until", help="End date accepted by git log, for example 2024-12-31.")
    parser.add_argument("--rev", default="--all", help="Revision range. Defaults to --all.")
    parser.add_argument("--max-commits", type=int, default=300, help="Maximum commits to collect.")
    parser.add_argument("--include-merges", action="store_true", help="Include merge commits.")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    parser.add_argument("--out", help="Write output to this file instead of stdout.")
    return parser.parse_args()


def safe_int(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return 0


def classify(subject: str, files: list[dict[str, Any]]) -> str:
    haystack = " ".join([subject, *[item["path"] for item in files]]).lower()
    for category, needles in CATEGORY_RULES:
        if any(needle in haystack for needle in needles):
            return category
    return "uncategorized"


def collect_commits(repo: str, args: argparse.Namespace) -> list[dict[str, Any]]:
    pretty = f"{RECORD_SEP}%H{FIELD_SEP}%ad{FIELD_SEP}%an{FIELD_SEP}%ae{FIELD_SEP}%s"
    git_args = [
        "log",
        args.rev,
        f"--author={args.author}",
        f"--max-count={args.max_commits}",
        "--date=short",
        f"--pretty=format:{pretty}",
        "--numstat",
    ]
    if not args.include_merges:
        git_args.append("--no-merges")
    if args.since:
        git_args.append(f"--since={args.since}")
    if args.until:
        git_args.append(f"--until={args.until}")

    raw = run_git(repo, git_args)
    commits: list[dict[str, Any]] = []

    for record in raw.split(RECORD_SEP):
        record = record.strip()
        if not record:
            continue
        lines = record.splitlines()
        fields = lines[0].split(FIELD_SEP)
        if len(fields) != 5:
            continue
        current = {
            "hash": fields[0],
            "short_hash": fields[0][:8],
            "date": fields[1],
            "author_name": fields[2],
            "author_email": fields[3],
            "subject": fields[4],
            "files": [],
            "insertions": 0,
            "deletions": 0,
        }
        for line in lines[1:]:
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            insertions = safe_int(parts[0])
            deletions = safe_int(parts[1])
            path = parts[2]
            current["files"].append({"path": path, "insertions": insertions, "deletions": deletions})
            current["insertions"] += insertions
            current["deletions"] += deletions
        current["category"] = classify(current["subject"], current["files"])
        commits.append(current)
    return commits


def summarize(commits: list[dict[str, Any]]) -> dict[str, Any]:
    directories: collections.Counter[str] = collections.Counter()
    extensions: collections.Counter[str] = collections.Counter()
    categories: collections.Counter[str] = collections.Counter()
    months: collections.Counter[str] = collections.Counter()

    for commit in commits:
        categories[commit["category"]] += 1
        if commit["date"]:
            months[commit["date"][:7]] += 1
        for file_info in commit["files"]:
            path = file_info["path"]
            directory = path.split("/", 1)[0] if "/" in path else "."
            suffix = pathlib.Path(path).suffix or "[none]"
            directories[directory] += 1
            extensions[suffix] += 1

    return {
        "commit_count": len(commits),
        "insertions": sum(commit["insertions"] for commit in commits),
        "deletions": sum(commit["deletions"] for commit in commits),
        "categories": categories.most_common(),
        "top_directories": directories.most_common(15),
        "top_extensions": extensions.most_common(15),
        "monthly_commits": sorted(months.items()),
    }


def render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Git Resume Evidence",
        "",
        "## Inputs",
        f"- Repo: `{payload['repo']}`",
        f"- Author: `{payload['author']}`",
        f"- Since: `{payload.get('since') or 'n/a'}`",
        f"- Until: `{payload.get('until') or 'n/a'}`",
        f"- Revision: `{payload['rev']}`",
        f"- Include merges: `{payload['include_merges']}`",
        "",
        "## Summary",
    ]
    summary = payload["summary"]
    lines.extend(
        [
            f"- Commits: {summary['commit_count']}",
            f"- Insertions: {summary['insertions']}",
            f"- Deletions: {summary['deletions']}",
            f"- Categories: {', '.join(f'{name}={count}' for name, count in summary['categories']) or 'n/a'}",
            f"- Top directories: {', '.join(f'{name}={count}' for name, count in summary['top_directories']) or 'n/a'}",
            "",
            "## Representative Commits",
        ]
    )
    for commit in payload["commits"][:50]:
        files = ", ".join(item["path"] for item in commit["files"][:5])
        if len(commit["files"]) > 5:
            files += ", ..."
        lines.extend(
            [
                f"- `{commit['short_hash']}` {commit['date']} [{commit['category']}] {commit['subject']}",
                f"  - Change size: +{commit['insertions']} -{commit['deletions']}; files: {files or 'n/a'}",
            ]
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    repo = os.path.abspath(args.repo)
    commits = collect_commits(repo, args)
    payload = {
        "repo": repo,
        "author": args.author,
        "since": args.since,
        "until": args.until,
        "rev": args.rev,
        "include_merges": args.include_merges,
        "summary": summarize(commits),
        "commits": commits,
    }
    output = render_markdown(payload) if args.format == "markdown" else json.dumps(payload, indent=2)
    if args.out:
        pathlib.Path(args.out).write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
