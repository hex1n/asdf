#!/usr/bin/env python3
"""Collect Git commit evidence for resume and interview analysis."""

from __future__ import annotations

import argparse
import collections
import json
import os
import pathlib
import re
import subprocess
import sys
from typing import Any


FIELD_SEP = "\x1f"
RECORD_SEP = "\x1e"

DIFF_FILE_RE = re.compile(r"^diff --git a/(.*?) b/(.*)$")
HUNK_HEADER_RE = re.compile(r"^@@.*@@\s*(.*)$")
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_]{2,}|[\u4e00-\u9fff]{2,}")
IDENTIFIER_TOKEN_RE = re.compile(r"[A-Z]+(?=[A-Z][a-z]|$)|[A-Z]?[a-z]+|[0-9]+|[\u4e00-\u9fff]{2,}")
BUILT_IN_REDACTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"(password|passwd|secret|token|api[_-]?key|access[_-]?key)(\s*[:=]\s*)(['\"]?)[^'\"\s]+",
            re.IGNORECASE,
        ),
        r"\1\2\3[REDACTED]",
    ),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED]"),
    (
        re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.DOTALL),
        "[REDACTED]",
    ),
]
LOW_SIGNAL_SUBJECT_RE = re.compile(
    r"^(init|initial|format|reformat|vendor|generated|代码迁移|代码调整|删除不需要的代码)$",
    re.IGNORECASE,
)


def configure_utf8_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def run_git(repo: str, args: list[str]) -> str:
    result = subprocess.run(
        ["git", "-C", repo, *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
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
    parser.add_argument("--path", dest="paths", action="append", help="Limit evidence to a Git pathspec. Repeatable.")
    parser.add_argument(
        "--max-commits",
        type=int,
        default=0,
        help="Maximum commits to collect. Defaults to 0, meaning no limit.",
    )
    parser.add_argument("--include-merges", action="store_true", help="Include merge commits.")
    parser.add_argument("--oldest-first", action="store_true", help="Render commits from oldest to newest.")
    parser.add_argument("--top-by-size", action="store_true", help="Render commits by changed-line count, descending.")
    parser.add_argument("--inspection-limit", type=int, default=12, help="Number of commits to include in the inspection plan.")
    parser.add_argument("--with-diffs", action="store_true", help="Include redacted diff excerpts for top inspection commits.")
    parser.add_argument("--diff-commits", type=int, default=5, help="Number of inspection commits to sample with --with-diffs.")
    parser.add_argument("--diff-context", type=int, default=3, help="Unified diff context lines for --with-diffs.")
    parser.add_argument("--max-diff-lines", type=int, default=160, help="Maximum diff lines per sampled commit.")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    parser.add_argument("--out", help="Write output to this file instead of stdout.")
    args = parser.parse_args()
    if args.oldest_first and args.top_by_size:
        parser.error("--oldest-first and --top-by-size cannot be used together")
    if args.max_commits < 0:
        parser.error("--max-commits must be 0 or greater")
    return args


def safe_int(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return 0


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for match in TOKEN_RE.finditer(text):
        piece = match.group(0)
        for token_match in IDENTIFIER_TOKEN_RE.finditer(piece):
            token = token_match.group(0).lower()
            if len(token) < 2 or token.isdigit():
                continue
            tokens.append(token)
    return tokens


def top_terms(values: list[str], limit: int = 8) -> list[tuple[str, int]]:
    counter: collections.Counter[str] = collections.Counter()
    for value in values:
        counter.update(tokenize(value))
    return counter.most_common(limit)


def path_terms(files: list[dict[str, Any]]) -> list[tuple[str, int]]:
    pieces: list[str] = []
    for file_info in files:
        path = file_info["path"]
        pieces.extend(pathlib.PurePosixPath(path.replace("\\", "/")).parts)
    return top_terms(pieces)


def topic_phrases_from_text(text: str) -> list[str]:
    tokens = tokenize(text)
    if not tokens:
        return []

    phrases: list[str] = []
    if len(tokens) == 1:
        phrases.append(tokens[0])
    else:
        phrases.append("_".join(tokens[:2]))
        if len(tokens) >= 3:
            phrases.append("_".join(tokens[:3]))
    return phrases


def topic_candidates_for_commit(commit: dict[str, Any], limit: int = 8) -> list[str]:
    counter: collections.Counter[str] = collections.Counter()

    def add_phrases(text: str, weight: int) -> None:
        for phrase in topic_phrases_from_text(text):
            counter[phrase] += weight

    add_phrases(commit["subject"], 4)
    for file_info in commit["files"]:
        path = pathlib.PurePosixPath(file_info["path"].replace("\\", "/"))
        add_phrases(path.stem, 3)
    return [topic for topic, _count in counter.most_common(limit * 2)]


def current_path_exists(repo: str, git_path: str) -> bool:
    if not git_path or "{" in git_path or "=>" in git_path:
        return False
    return os.path.exists(os.path.join(repo, git_path.replace("/", os.sep)))


def percentile(values: list[int], ratio: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * ratio)))
    return ordered[index]


def document_tokens_for_commit(commit: dict[str, Any]) -> set[str]:
    values = [commit["subject"]]
    for file_info in commit["files"]:
        path = pathlib.PurePosixPath(file_info["path"].replace("\\", "/"))
        values.extend(path.parts)
        values.extend(pathlib.PurePosixPath(part).stem for part in path.parts)

    tokens: set[str] = set()
    for value in values:
        tokens.update(tokenize(value))
    return tokens


def build_token_document_counts(commits: list[dict[str, Any]]) -> collections.Counter[str]:
    doc_counts: collections.Counter[str] = collections.Counter()
    for commit in commits:
        doc_counts.update(document_tokens_for_commit(commit))
    return doc_counts


def is_single_token_noise_topic(
    topic: str,
    doc_counts: collections.Counter[str],
    high_doc_threshold: int,
) -> bool:
    if "_" in topic:
        return False
    return doc_counts.get(topic, 0) >= high_doc_threshold


def parent_concentration(cluster: dict[str, Any]) -> float:
    parent_counter = cluster.get("parent_counter") or {}
    total_refs = cluster.get("total_file_refs") or 0
    if not parent_counter or total_refs <= 0:
        return 0.0
    return max(parent_counter.values()) / total_refs


def is_repo_wide_topic(
    cluster: dict[str, Any],
    broad_count_threshold: int,
    median_parent_concentration: float,
) -> bool:
    return (
        cluster["commit_count"] >= broad_count_threshold
        and parent_concentration(cluster) <= median_parent_concentration
    )


def build_workstream_candidates(repo: str, commits: list[dict[str, Any]], limit: int = 15) -> list[dict[str, Any]]:
    clusters: dict[str, dict[str, Any]] = {}
    token_doc_counts = build_token_document_counts(commits)
    high_doc_threshold = max(percentile(list(token_doc_counts.values()), 0.85), round(len(commits) ** 0.5), 2)
    for commit in commits:
        topics = topic_candidates_for_commit(commit)
        if not topics:
            continue
        commit_score, _reasons = score_commit(commit)
        for topic in topics:
            cluster = clusters.setdefault(
                topic,
                {
                    "topic": topic,
                    "commit_count": 0,
                    "insertions": 0,
                    "deletions": 0,
                    "latest_date": "",
                    "current_file_hits": 0,
                    "total_file_refs": 0,
                    "path_counter": collections.Counter(),
                    "parent_counter": collections.Counter(),
                    "representative_commits": [],
                },
            )
            cluster["commit_count"] += 1
            cluster["insertions"] += commit["insertions"]
            cluster["deletions"] += commit["deletions"]
            cluster["latest_date"] = max(cluster["latest_date"], commit["date"])
            for file_info in commit["files"]:
                path = file_info["path"]
                parent = str(pathlib.PurePosixPath(path.replace("\\", "/")).parent)
                cluster["total_file_refs"] += 1
                cluster["path_counter"][path] += 1
                cluster["parent_counter"][parent] += 1
                if current_path_exists(repo, path):
                    cluster["current_file_hits"] += 1
            cluster["representative_commits"].append(
                {
                    "hash": commit["hash"],
                    "short_hash": commit["short_hash"],
                    "date": commit["date"],
                    "subject": commit["subject"],
                    "score": commit_score,
                    "change_size": commit["insertions"] + commit["deletions"],
                }
            )

    candidates: list[dict[str, Any]] = []
    cluster_commit_counts = [cluster["commit_count"] for cluster in clusters.values()]
    median_cluster_count = percentile(cluster_commit_counts, 0.50)
    broad_count_threshold = max(percentile(cluster_commit_counts, 0.95), median_cluster_count * 4, 2)
    concentration_values = [round(parent_concentration(cluster) * 1000) for cluster in clusters.values()]
    median_parent_concentration = percentile(concentration_values, 0.50) / 1000 if concentration_values else 0
    for cluster in clusters.values():
        if is_single_token_noise_topic(cluster["topic"], token_doc_counts, high_doc_threshold):
            continue
        if is_repo_wide_topic(cluster, broad_count_threshold, median_parent_concentration):
            continue
        total_refs = cluster["total_file_refs"]
        current_ratio = round(cluster["current_file_hits"] / total_refs, 3) if total_refs else 0
        concentration = round(parent_concentration(cluster), 3)
        cluster_score = (
            cluster["commit_count"] * 2
            + min(cluster["insertions"] + cluster["deletions"], 5000) / 500
            + min(cluster["current_file_hits"], 20) / 2
            + concentration * 5
        )
        representatives = sorted(
            cluster["representative_commits"],
            key=lambda item: (item["score"], item["change_size"], item["date"]),
            reverse=True,
        )[:5]
        candidates.append(
            {
                "topic": cluster["topic"],
                "score": round(cluster_score, 2),
                "commit_count": cluster["commit_count"],
                "insertions": cluster["insertions"],
                "deletions": cluster["deletions"],
                "latest_date": cluster["latest_date"],
                "current_file_hits": cluster["current_file_hits"],
                "total_file_refs": total_refs,
                "current_presence_ratio": current_ratio,
                "path_concentration": concentration,
                "representative_paths": [
                    path for path, _count in cluster["path_counter"].most_common(8)
                ],
                "representative_commits": representatives,
            }
        )

    candidates.sort(key=lambda item: (item["score"], item["commit_count"], item["latest_date"]), reverse=True)
    return candidates[: max(limit, 0)]


def collect_commits(repo: str, args: argparse.Namespace) -> list[dict[str, Any]]:
    pretty = f"{RECORD_SEP}%H{FIELD_SEP}%ad{FIELD_SEP}%an{FIELD_SEP}%ae{FIELD_SEP}%s"
    git_args = [
        "log",
        args.rev,
        f"--author={args.author}",
        "--date=short",
        f"--pretty=format:{pretty}",
        "--numstat",
    ]
    if args.max_commits > 0:
        git_args.append(f"--max-count={args.max_commits}")
    if not args.include_merges:
        git_args.append("--no-merges")
    if args.oldest_first:
        git_args.append("--reverse")
    if args.since:
        git_args.append(f"--since={args.since}")
    if args.until:
        git_args.append(f"--until={args.until}")
    if args.paths:
        git_args.extend(["--", *args.paths])

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

        current["subject_terms"] = top_terms([current["subject"]])
        current["path_terms"] = path_terms(current["files"])
        commits.append(current)

    if args.top_by_size:
        commits.sort(key=lambda commit: commit["insertions"] + commit["deletions"], reverse=True)
    return commits


def summarize(commits: list[dict[str, Any]]) -> dict[str, Any]:
    directories: collections.Counter[str] = collections.Counter()
    extensions: collections.Counter[str] = collections.Counter()
    months: collections.Counter[str] = collections.Counter()
    terms: collections.Counter[str] = collections.Counter()

    for commit in commits:
        terms.update(dict(commit["subject_terms"]))
        terms.update(dict(commit["path_terms"]))
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
        "top_directories": directories.most_common(15),
        "top_extensions": extensions.most_common(15),
        "top_terms": terms.most_common(20),
        "monthly_commits": sorted(months.items()),
    }


def score_commit(commit: dict[str, Any]) -> tuple[float, list[str]]:
    size = commit["insertions"] + commit["deletions"]
    files = commit["files"]
    top_dirs = {
        file_info["path"].split("/", 1)[0] if "/" in file_info["path"] else "."
        for file_info in files
    }

    score = min(size, 500) / 100
    score += min(len(files), 10) * 0.5
    score += min(len(top_dirs), 4) * 0.5

    reasons = [
        f"change_size={size}",
        f"file_count={len(files)}",
        f"directory_breadth={len(top_dirs)}",
    ]
    if LOW_SIGNAL_SUBJECT_RE.match(commit["subject"].strip()):
        score -= 4
        reasons.append("low_signal_subject")
    if len(files) >= 100:
        score -= 2
        reasons.append("large_file_count_penalty")
    return round(score, 2), reasons


def build_inspection_plan(commits: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    candidates = []
    for commit in commits:
        score, reasons = score_commit(commit)
        candidates.append(
            {
                "hash": commit["hash"],
                "short_hash": commit["short_hash"],
                "date": commit["date"],
                "subject": commit["subject"],
                "score": score,
                "reasons": reasons,
                "subject_terms": commit["subject_terms"],
                "path_terms": commit["path_terms"],
                "files": [item["path"] for item in commit["files"][:8]],
            }
        )
    candidates.sort(key=lambda item: (item["score"], item["date"], item["short_hash"]), reverse=True)
    return candidates[: max(limit, 0)]


def redact_sensitive(text: str, patterns: list[tuple[re.Pattern[str], str]]) -> str:
    redacted = text
    for pattern, replacement in patterns:
        redacted = pattern.sub(replacement, redacted)
    return redacted


def redact_payload(value: Any, patterns: list[tuple[re.Pattern[str], str]]) -> Any:
    if isinstance(value, str):
        return redact_sensitive(value, patterns)
    if isinstance(value, list):
        return [redact_payload(item, patterns) for item in value]
    if isinstance(value, tuple):
        return [redact_payload(item, patterns) for item in value]
    if isinstance(value, dict):
        return {key: redact_payload(item, patterns) for key, item in value.items()}
    return value


def extract_diff_metadata(diff_text: str) -> tuple[list[str], list[str]]:
    files: list[str] = []
    hunk_symbols: list[str] = []
    for line in diff_text.splitlines():
        file_match = DIFF_FILE_RE.match(line)
        if file_match:
            files.append(file_match.group(2))
            continue
        hunk_match = HUNK_HEADER_RE.match(line)
        if hunk_match:
            symbol = hunk_match.group(1).strip()
            if symbol and symbol not in hunk_symbols:
                hunk_symbols.append(symbol)
    return files[:20], hunk_symbols[:20]


def collect_diff_samples(
    repo: str,
    args: argparse.Namespace,
    inspection_plan: list[dict[str, Any]],
    redaction_patterns: list[tuple[re.Pattern[str], str]],
) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    for item in inspection_plan[: max(args.diff_commits, 0)]:
        git_args = [
            "show",
            "--format=",
            f"--unified={max(args.diff_context, 0)}",
            "--no-ext-diff",
            "--find-renames",
            item["hash"],
        ]
        if args.paths:
            git_args.extend(["--", *args.paths])
        raw_diff = run_git(repo, git_args)
        files, hunk_symbols = extract_diff_metadata(raw_diff)
        diff_lines = redact_sensitive(raw_diff, redaction_patterns).splitlines()
        max_lines = max(args.max_diff_lines, 0)
        excerpt = "\n".join(diff_lines[:max_lines])
        samples.append(
            {
                "hash": item["hash"],
                "short_hash": item["short_hash"],
                "subject": redact_sensitive(item["subject"], redaction_patterns),
                "files": [redact_sensitive(file, redaction_patterns) for file in files],
                "hunk_symbols": [redact_sensitive(symbol, redaction_patterns) for symbol in hunk_symbols],
                "diff_excerpt": excerpt,
                "truncated": len(diff_lines) > max_lines,
            }
        )
    return samples


def format_terms(terms: list[tuple[str, int]]) -> str:
    return ", ".join(f"{term}={count}" for term, count in terms) or "n/a"


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
        f"- Paths: `{', '.join(payload['paths']) if payload['paths'] else 'n/a'}`",
        f"- Include merges: `{payload['include_merges']}`",
        f"- Order: `{payload['order']}`",
        f"- With diffs: `{payload['with_diffs']}`",
        "",
        "## Summary",
    ]
    summary = payload["summary"]
    lines.extend(
        [
            f"- Commits: {summary['commit_count']}",
            f"- Insertions: {summary['insertions']}",
            f"- Deletions: {summary['deletions']}",
            f"- Top directories: {format_terms(summary['top_directories'])}",
            f"- Top terms: {format_terms(summary['top_terms'])}",
        ]
    )

    if payload["workstream_candidates"]:
        lines.extend(["", "## Repo-Native Workstream Candidates"])
        for candidate in payload["workstream_candidates"]:
            lines.extend(
                [
                    f"- `{candidate['topic']}` score={candidate['score']} commits={candidate['commit_count']} latest={candidate['latest_date']}",
                    f"  - Change size: +{candidate['insertions']} -{candidate['deletions']}",
                    f"  - Current file presence: {candidate['current_file_hits']}/{candidate['total_file_refs']} ({candidate['current_presence_ratio']})",
                    f"  - Representative paths: {', '.join(candidate['representative_paths'][:5]) or 'n/a'}",
                ]
            )

    lines.extend(["", "## Inspection Plan"])
    for item in payload["inspection_plan"]:
        files = ", ".join(item["files"][:5])
        if len(item["files"]) > 5:
            files += ", ..."
        lines.extend(
            [
                f"- `{item['short_hash']}` {item['date']} score={item['score']} {item['subject']}",
                f"  - Why inspect: {', '.join(item['reasons'])}",
                f"  - Subject terms: {format_terms(item['subject_terms'])}",
                f"  - Path terms: {format_terms(item['path_terms'])}",
                f"  - Files: {files or 'n/a'}",
            ]
        )

    lines.extend(["", "## Representative Commits"])
    for commit in payload["commits"][:50]:
        files = ", ".join(item["path"] for item in commit["files"][:5])
        if len(commit["files"]) > 5:
            files += ", ..."
        lines.extend(
            [
                f"- `{commit['short_hash']}` {commit['date']} {commit['subject']}",
                f"  - Change size: +{commit['insertions']} -{commit['deletions']}; files: {files or 'n/a'}",
            ]
        )

    if payload["diff_samples"]:
        lines.extend(["", "## Diff Samples"])
        for sample in payload["diff_samples"]:
            lines.extend(
                [
                    f"### `{sample['short_hash']}` {sample['subject']}",
                    f"- Files: {', '.join(sample['files']) or 'n/a'}",
                    f"- Hunk symbols: {', '.join(sample['hunk_symbols']) or 'n/a'}",
                    f"- Truncated: `{sample['truncated']}`",
                    "",
                    "```diff",
                    sample["diff_excerpt"],
                    "```",
                    "",
                ]
            )
    return "\n".join(lines).rstrip() + "\n"


def build_payload(
    repo: str,
    args: argparse.Namespace,
    redaction_patterns: list[tuple[re.Pattern[str], str]],
) -> dict[str, Any]:
    commits = collect_commits(repo, args)
    inspection_plan = build_inspection_plan(commits, args.inspection_limit)
    diff_samples = collect_diff_samples(repo, args, inspection_plan, redaction_patterns) if args.with_diffs else []
    order = "size" if args.top_by_size else "oldest" if args.oldest_first else "newest"
    payload = {
        "repo": repo,
        "author": args.author,
        "since": args.since,
        "until": args.until,
        "rev": args.rev,
        "paths": args.paths or [],
        "include_merges": args.include_merges,
        "order": order,
        "with_diffs": args.with_diffs,
        "summary": summarize(commits),
        "workstream_candidates": build_workstream_candidates(repo, commits),
        "inspection_plan": inspection_plan,
        "diff_samples": diff_samples,
        "commits": commits,
    }
    return redact_payload(payload, redaction_patterns)


def main() -> int:
    configure_utf8_stdio()
    args = parse_args()
    repo = os.path.abspath(args.repo)
    redaction_patterns = BUILT_IN_REDACTION_PATTERNS
    payload = build_payload(repo, args, redaction_patterns)
    output = render_markdown(payload) if args.format == "markdown" else json.dumps(payload, indent=2, ensure_ascii=False)
    if args.out:
        pathlib.Path(args.out).write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
