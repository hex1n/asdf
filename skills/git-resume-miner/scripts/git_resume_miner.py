#!/usr/bin/env python3
"""Collect Git commit evidence for resume and interview analysis."""

from __future__ import annotations

import argparse
import collections
import json
import os
import pathlib
import re
import shlex
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
    (
        re.compile(r"(authorization\s*[:=]\s*bearer\s+)[A-Za-z0-9._~+/=-]+", re.IGNORECASE),
        r"\1[REDACTED]",
    ),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]+", re.IGNORECASE), "Bearer [REDACTED]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"), "[REDACTED]"),
    (
        re.compile(r"([A-Za-z][A-Za-z0-9+.-]*://)([^/@\s:]+):([^/@\s]+)@"),
        r"\1[REDACTED]@",
    ),
    (re.compile(r"\bjdbc:[^'\"\s]+", re.IGNORECASE), "jdbc:[REDACTED]"),
]
LOW_SIGNAL_SUBJECT_RE = re.compile(
    r"^(init|initial|format|reformat|vendor|generated|代码迁移|代码调整|删除不需要的代码)$",
    re.IGNORECASE,
)
CONVENTIONAL_COMMIT_RE = re.compile(r"^([A-Za-z]+)(?:\([^)]+\))?!?:\s*(.+)$")
CONVENTIONAL_COMMIT_TYPES = {
    "build",
    "chore",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "revert",
    "style",
    "test",
}
CHANGE_ACTION_TOPIC_PREFIXES = {
    "add",
    "added",
    "adjust",
    "adjusted",
    "create",
    "created",
    "delete",
    "deleted",
    "document",
    "documented",
    "enable",
    "enabled",
    "expose",
    "exposed",
    "fix",
    "fixed",
    "harden",
    "hardened",
    "handle",
    "handled",
    "implement",
    "implemented",
    "improve",
    "improved",
    "introduce",
    "introduced",
    "keep",
    "kept",
    "migrate",
    "migrated",
    "optimize",
    "optimized",
    "persist",
    "persisted",
    "prepare",
    "prepared",
    "refactor",
    "refactored",
    "remove",
    "removed",
    "rename",
    "renamed",
    "serve",
    "served",
    "strengthen",
    "strengthened",
    "support",
    "supported",
    "tighten",
    "tightened",
    "update",
    "updated",
}
TOPIC_LEADING_STOPWORDS = {"only"}
GENERIC_TOPIC_SUFFIXES = {
    "controller",
    "controllers",
    "dto",
    "dtos",
    "entities",
    "entity",
    "fallback",
    "handler",
    "hasher",
    "helper",
    "helpers",
    "impl",
    "manager",
    "miner",
    "process",
    "reader",
    "service",
    "set",
    "util",
    "utils",
}
BRANCH_LABEL_TOPIC_PREFIXES = {"bug", "bugfix", "feature", "fix", "hotfix", "merge", "release"}
CONFIG_TOPIC_PREFIXES = {"application", "bootstrap", "config", "configuration", "settings"}
ARTIFACT_TOPIC_SUFFIXES = {"constant", "constants", "test", "tests"}
ARTIFACT_TOPIC_PREFIXES = {"spec", "specs", "test", "tests"}
VALIDATION_ARTIFACT_TOPIC_PHRASES = {"real_project"}
VALIDATION_ARTIFACT_TOPIC_TOKENS = {
    "acceptance",
    "baseline",
    "current",
    "desc",
    "diag",
    "diagnostic",
    "eval",
    "fixture",
    "fixtures",
    "permissive",
}
GENERIC_ARTIFACT_PREFIXES = {"abstract", "base", "common", "default", "generated"}
LOW_VALUE_SINGLE_TOKEN_TOPICS = {
    "app",
    "config",
    "demo",
    "example",
    "examples",
    "fixture",
    "fixtures",
    "install",
    "log",
    "logs",
    "marketplace",
    "mock",
    "mockup",
    "plugin",
    "plugins",
    "profile",
    "profiles",
    "setup",
    "task",
    "tasks",
    "temp",
    "tmp",
}
SCHEMA_ACTION_TOKENS = {"add", "alter", "create", "drop", "update"}
SCHEMA_OBJECT_TOKENS = {"column", "constraint", "index", "table"}
ENVIRONMENT_PROFILE_TOKENS = {
    "dev",
    "development",
    "local",
    "preprod",
    "prepublish",
    "prod",
    "production",
    "qa",
    "sandbox",
    "sit",
    "stage",
    "staging",
    "test",
    "uat",
}


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
    parser.add_argument(
        "--privacy",
        choices=["standard", "strict"],
        default="standard",
        help="Use strict to omit diff excerpts and render metadata only.",
    )
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


def topic_phrases_from_tokens(tokens: list[str]) -> list[str]:
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


def topic_phrases_from_text(text: str) -> list[str]:
    return topic_phrases_from_tokens(tokenize(text))


def topic_phrases_from_subject(subject: str) -> list[str]:
    text = subject.strip()
    match = CONVENTIONAL_COMMIT_RE.match(text)
    if match and match.group(1).lower() in CONVENTIONAL_COMMIT_TYPES:
        text = match.group(2)

    tokens = tokenize(text)
    while len(tokens) > 1 and tokens[0] in CHANGE_ACTION_TOPIC_PREFIXES.union(TOPIC_LEADING_STOPWORDS):
        tokens = tokens[1:]
    return topic_phrases_from_tokens(tokens)


def topic_candidates_for_commit(commit: dict[str, Any], limit: int = 8) -> list[str]:
    counter: collections.Counter[str] = collections.Counter()

    def add_phrases(text: str, weight: int) -> None:
        for phrase in topic_phrases_from_text(text):
            counter[phrase] += weight

    for phrase in topic_phrases_from_subject(commit["subject"]):
        counter[phrase] += 4
    for file_info in commit["files"]:
        path = pathlib.PurePosixPath(file_info["path"].replace("\\", "/"))
        add_phrases(path.stem, 3)
    return [topic for topic, _count in counter.most_common(limit * 2)]


def canonical_workstream_topic(topic: str) -> str:
    parts = topic.split("_")
    while len(parts) > 2 and parts[-1] in GENERIC_TOPIC_SUFFIXES:
        parts = parts[:-1]
    return "_".join(parts)


def current_path_candidates(git_path: str) -> list[str]:
    path = (git_path or "").strip()
    if not path:
        return []
    candidates = [path]
    if "=>" in path:
        if "{" in path and "}" in path:
            def replace_brace(match: re.Match[str]) -> str:
                inner = match.group(1)
                if "=>" not in inner:
                    return inner
                return inner.split("=>", 1)[1].strip()

            candidates.append(re.sub(r"\{([^{}]+)\}", replace_brace, path))
        else:
            candidates.append(path.split("=>", 1)[1].strip())

    cleaned: list[str] = []
    for candidate in candidates:
        candidate = candidate.strip()
        if candidate and candidate not in cleaned:
            cleaned.append(candidate)
    return cleaned


def current_existing_path(repo: str, git_path: str) -> str | None:
    for candidate in current_path_candidates(git_path):
        if os.path.exists(os.path.join(repo, candidate.replace("/", os.sep))):
            return candidate
    return None


def current_path_exists(repo: str, git_path: str) -> bool:
    return current_existing_path(repo, git_path) is not None


def current_file_presence(repo: str, files: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    present: list[str] = []
    missing: list[str] = []
    for file_info in files:
        path = file_info["path"]
        current_path = current_existing_path(repo, path)
        if current_path:
            present.append(current_path)
        else:
            candidates = current_path_candidates(path)
            missing.append(candidates[-1] if candidates else path)
    return present, missing


def summarize_authors(commits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    authors: collections.Counter[tuple[str, str]] = collections.Counter()
    for commit in commits:
        authors[(commit["author_name"], commit["author_email"])] += 1
    return [
        {
            "author_name": name,
            "author_email": email,
            "commit_count": count,
        }
        for (name, email), count in authors.most_common()
    ]


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


def is_low_evidence_single_token_surface_topic(cluster: dict[str, Any]) -> bool:
    topic = cluster["topic"]
    if "_" in topic:
        return False
    if topic in {"log", "logs"}:
        return True
    if topic not in LOW_VALUE_SINGLE_TOKEN_TOPICS:
        return False
    return cluster["commit_count"] <= 2 and cluster["total_file_refs"] >= 5


def is_redundant_single_token_topic(cluster: dict[str, Any], clusters: dict[str, dict[str, Any]]) -> bool:
    topic = cluster["topic"]
    if "_" in topic or cluster["commit_count"] > 2:
        return False
    commit_hashes = cluster.get("commit_hashes") or set()
    if not commit_hashes:
        return False
    for peer in clusters.values():
        if peer is cluster or "_" not in peer["topic"]:
            continue
        peer_hashes = peer.get("commit_hashes") or set()
        if commit_hashes.issubset(peer_hashes):
            return True
    return False


def is_redundant_prefix_expansion_topic(cluster: dict[str, Any], clusters: dict[str, dict[str, Any]]) -> bool:
    parts = cluster["topic"].split("_")
    if len(parts) < 3 or cluster["commit_count"] > 2:
        return False
    commit_hashes = cluster.get("commit_hashes") or set()
    for prefix_len in range(2, len(parts)):
        peer = clusters.get("_".join(parts[:prefix_len]))
        if peer and commit_hashes and commit_hashes.issubset(peer.get("commit_hashes") or set()):
            return True
    return False


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
    total_commits: int = 0,
) -> bool:
    total_refs = cluster.get("total_file_refs") or 0
    current_ratio = (cluster.get("current_file_hits") or 0) / total_refs if total_refs else 0
    if 0 < total_commits < 50 and "_" in cluster["topic"] and current_ratio >= 0.5:
        return False
    diffuse_parent_threshold = min(median_parent_concentration, 0.45)
    return (
        cluster["commit_count"] >= broad_count_threshold
        and parent_concentration(cluster) <= diffuse_parent_threshold
    )


def is_branch_label_topic(topic: str) -> bool:
    parts = topic.split("_")
    return bool(parts and parts[0] in BRANCH_LABEL_TOPIC_PREFIXES)


def is_scope_level_topic(cluster: dict[str, Any], total_commits: int) -> bool:
    if total_commits < 20:
        return False
    return cluster["commit_count"] / total_commits >= 0.25


def is_environment_profile_topic(topic: str) -> bool:
    parts = topic.split("_")
    return bool(parts and parts[0] in CONFIG_TOPIC_PREFIXES and any(part in ENVIRONMENT_PROFILE_TOKENS for part in parts[1:]))


def is_artifact_surface_topic(topic: str) -> bool:
    parts = topic.split("_")
    if not parts:
        return False
    if topic in VALIDATION_ARTIFACT_TOPIC_PHRASES:
        return True
    if VALIDATION_ARTIFACT_TOPIC_TOKENS.intersection(parts):
        return True
    if parts[0] in ARTIFACT_TOPIC_PREFIXES:
        return True
    if parts[-1] in ARTIFACT_TOPIC_SUFFIXES:
        return True
    if parts[0] in GENERIC_ARTIFACT_PREFIXES and parts[-1] in GENERIC_TOPIC_SUFFIXES:
        return True
    return bool(SCHEMA_ACTION_TOKENS.intersection(parts) and SCHEMA_OBJECT_TOKENS.intersection(parts))


def cluster_evidence_quality_factor(cluster: dict[str, Any]) -> float:
    if cluster["commit_count"] <= 2 and cluster.get("bulk_commit_count") == cluster["commit_count"]:
        return 0.35
    return 1.0


def build_workstream_candidates(repo: str, commits: list[dict[str, Any]], limit: int = 15) -> list[dict[str, Any]]:
    clusters: dict[str, dict[str, Any]] = {}
    token_doc_counts = build_token_document_counts(commits)
    high_doc_threshold = max(percentile(list(token_doc_counts.values()), 0.85), round(len(commits) ** 0.5), 2)
    for commit in commits:
        topics = []
        seen_topics: set[str] = set()
        for raw_topic in topic_candidates_for_commit(commit):
            topic = canonical_workstream_topic(raw_topic)
            if topic not in seen_topics:
                topics.append((topic, raw_topic))
                seen_topics.add(topic)
        if not topics:
            continue
        commit_score, _reasons = score_commit(commit)
        for topic, raw_topic in topics:
            cluster = clusters.setdefault(
                topic,
                {
                    "topic": topic,
                    "aliases": collections.Counter(),
                    "commit_count": 0,
                    "insertions": 0,
                    "deletions": 0,
                    "latest_date": "",
                    "current_file_hits": 0,
                    "total_file_refs": 0,
                    "path_counter": collections.Counter(),
                    "parent_counter": collections.Counter(),
                    "commit_hashes": set(),
                    "bulk_commit_count": 0,
                    "representative_commits": [],
                },
            )
            cluster["aliases"][raw_topic] += 1
            cluster["commit_count"] += 1
            cluster["insertions"] += commit["insertions"]
            cluster["deletions"] += commit["deletions"]
            cluster["latest_date"] = max(cluster["latest_date"], commit["date"])
            cluster["commit_hashes"].add(commit["hash"])
            if LOW_SIGNAL_SUBJECT_RE.match(commit["subject"].strip()) or len(commit["files"]) >= 100:
                cluster["bulk_commit_count"] += 1
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
        if is_branch_label_topic(cluster["topic"]):
            continue
        if is_environment_profile_topic(cluster["topic"]):
            continue
        if is_artifact_surface_topic(cluster["topic"]):
            continue
        if is_scope_level_topic(cluster, len(commits)):
            continue
        if is_single_token_noise_topic(cluster["topic"], token_doc_counts, high_doc_threshold):
            continue
        if is_low_evidence_single_token_surface_topic(cluster):
            continue
        if is_redundant_single_token_topic(cluster, clusters):
            continue
        if is_redundant_prefix_expansion_topic(cluster, clusters):
            continue
        if is_repo_wide_topic(cluster, broad_count_threshold, median_parent_concentration, len(commits)):
            continue
        total_refs = cluster["total_file_refs"]
        current_ratio = round(cluster["current_file_hits"] / total_refs, 3) if total_refs else 0
        concentration = round(parent_concentration(cluster), 3)
        base_score = (
            cluster["commit_count"] * 2
            + min(cluster["insertions"] + cluster["deletions"], 5000) / 500
            + min(cluster["current_file_hits"], 20) / 2
            + concentration * 5
        )
        current_relevance_factor = 0.4 + current_ratio * 0.6
        evidence_quality_factor = cluster_evidence_quality_factor(cluster)
        cluster_score = base_score * current_relevance_factor * evidence_quality_factor
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
                "current_relevance_factor": round(current_relevance_factor, 3),
                "evidence_quality_factor": round(evidence_quality_factor, 3),
                "path_concentration": concentration,
                "representative_paths": [
                    path for path, _count in cluster["path_counter"].most_common(8)
                ],
                "topic_aliases": [
                    alias
                    for alias, _count in cluster["aliases"].most_common(6)
                    if alias != cluster["topic"]
                ][:5],
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


def command_string(args: list[str]) -> str:
    return shlex.join(args)


def inspection_commands_for_item(item: dict[str, Any]) -> list[dict[str, str]]:
    commands = [
        {
            "label": "full diff",
            "command": command_string(["git", "show", "--find-renames", item["hash"]]),
        }
    ]
    path = (
        item["current_files_present"][0]
        if item["current_files_present"]
        else item["current_files_missing"][0]
        if item["current_files_missing"]
        else item["files"][0]
        if item["files"]
        else ""
    )
    if path:
        commands.append(
            {
                "label": "path history",
                "command": command_string(["git", "log", "--follow", "--", path]),
            }
        )
        if item["current_files_present"]:
            commands.append(
                {
                    "label": "current file",
                    "command": command_string(["git", "show", f"HEAD:{item['current_files_present'][0]}"]),
                }
            )
    return commands


def build_inspection_plan(repo: str, commits: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    candidates = []
    for commit in commits:
        score, reasons = score_commit(commit)
        current_files_present, current_files_missing = current_file_presence(repo, commit["files"])
        current_file_total = len(commit["files"])
        current_presence_ratio = round(len(current_files_present) / current_file_total, 3) if current_file_total else 0
        entry = {
            "hash": commit["hash"],
            "short_hash": commit["short_hash"],
            "date": commit["date"],
            "subject": commit["subject"],
            "score": score,
            "reasons": reasons,
            "subject_terms": commit["subject_terms"],
            "path_terms": commit["path_terms"],
            "files": [item["path"] for item in commit["files"][:8]],
            "current_file_hits": len(current_files_present),
            "current_file_total": current_file_total,
            "current_presence_ratio": current_presence_ratio,
            "current_files_present": current_files_present[:8],
            "current_files_missing": current_files_missing[:8],
        }
        entry["inspection_commands"] = inspection_commands_for_item(entry)
        candidates.append(entry)
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
    strict_privacy = args.privacy == "strict"
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
        if strict_privacy:
            hunk_symbols = []
        diff_lines = redact_sensitive(raw_diff, redaction_patterns).splitlines()
        max_lines = max(args.max_diff_lines, 0)
        excerpt = "[omitted by --privacy strict]" if strict_privacy else "\n".join(diff_lines[:max_lines])
        samples.append(
            {
                "hash": item["hash"],
                "short_hash": item["short_hash"],
                "subject": redact_sensitive(item["subject"], redaction_patterns),
                "files": [redact_sensitive(file, redaction_patterns) for file in files],
                "hunk_symbols": [redact_sensitive(symbol, redaction_patterns) for symbol in hunk_symbols],
                "diff_excerpt": excerpt,
                "truncated": False if strict_privacy else len(diff_lines) > max_lines,
                "privacy": args.privacy,
            }
        )
    return samples


def format_terms(terms: list[tuple[str, int]]) -> str:
    return ", ".join(f"{term}={count}" for term, count in terms) or "n/a"


def build_evidence_warnings(
    args: argparse.Namespace,
    summary: dict[str, Any],
    matched_authors: list[dict[str, Any]],
    inspection_plan: list[dict[str, Any]],
) -> list[str]:
    warnings: list[str] = []
    if summary["commit_count"] == 0:
        warnings.append("No matching commits found; verify --author, --rev, date range, and path filters before concluding there is no contribution evidence.")
    if len(matched_authors) > 1:
        warnings.append("Multiple author identities matched; confirm they belong to the same person before calibrating ownership language.")
    if args.max_commits > 0:
        warnings.append("--max-commits capped history collection; use this only for exploration and rerun uncapped before final claims.")
    low_presence = [
        item for item in inspection_plan
        if item["current_file_total"] > 0 and item["current_presence_ratio"] < 0.5
    ]
    if low_presence:
        warnings.append("Some inspection candidates have low Current-Code Relevance; check for rename, deletion, generated output, or replacement before using them as primary Resume-Ready evidence.")
    if args.privacy == "strict" and args.with_diffs:
        warnings.append("--privacy strict omitted diff excerpts; inspect full diffs locally before writing final claims.")
    return warnings


def render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Git Resume Evidence Index",
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
        f"- Privacy: `{payload['privacy']}`",
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

    if payload["evidence_warnings"]:
        lines.extend(["", "## Evidence Warnings"])
        for warning in payload["evidence_warnings"]:
            lines.append(f"- {warning}")

    lines.extend(["", "## Matched Authors"])
    if payload["matched_authors"]:
        for author in payload["matched_authors"]:
            lines.append(
                f"- {author['author_name']} <{author['author_email']}>: {author['commit_count']} commits"
            )
    else:
        lines.append("- n/a")

    if payload["workstream_candidates"]:
        lines.extend(["", "## Workstream Candidates"])
        for candidate in payload["workstream_candidates"]:
            aliases = f" aliases={', '.join(candidate['topic_aliases'])}" if candidate.get("topic_aliases") else ""
            evidence_factor = candidate.get("evidence_quality_factor", 1)
            lines.extend(
                [
                    f"- `{candidate['topic']}` score={candidate['score']} commits={candidate['commit_count']} latest={candidate['latest_date']}{aliases}",
                    f"  - Change size: +{candidate['insertions']} -{candidate['deletions']}",
                    f"  - Current-Code Relevance: {candidate['current_file_hits']}/{candidate['total_file_refs']} currently present ({candidate['current_presence_ratio']}); factor={candidate['current_relevance_factor']}",
                ]
            )
            if evidence_factor != 1:
                lines.append(f"  - Evidence quality factor: {evidence_factor}")
            lines.append(f"  - Representative paths: {', '.join(candidate['representative_paths'][:5]) or 'n/a'}")

    lines.extend(["", "## Inspection Plan"])
    for item in payload["inspection_plan"]:
        files = ", ".join(item["files"][:5])
        if len(item["files"]) > 5:
            files += ", ..."
        lines.extend(
            [
                f"- `{item['short_hash']}` {item['date']} score={item['score']} {item['subject']}",
                f"  - Why inspect: {', '.join(item['reasons'])}",
                f"  - Current-Code Relevance: {item['current_file_hits']}/{item['current_file_total']} currently present ({item['current_presence_ratio']})",
                f"  - Present now: {', '.join(item['current_files_present'][:5]) or 'n/a'}",
                f"  - Missing now: {', '.join(item['current_files_missing'][:5]) or 'n/a'}",
                f"  - Subject terms: {format_terms(item['subject_terms'])}",
                f"  - Path terms: {format_terms(item['path_terms'])}",
                f"  - Files: {files or 'n/a'}",
            ]
        )
        for command in item["inspection_commands"]:
            lines.append(f"  - Next check ({command['label']}): `{command['command']}`")

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
                    f"- Privacy: `{sample['privacy']}`",
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
    inspection_plan = build_inspection_plan(repo, commits, args.inspection_limit)
    diff_samples = collect_diff_samples(repo, args, inspection_plan, redaction_patterns) if args.with_diffs else []
    order = "size" if args.top_by_size else "oldest" if args.oldest_first else "newest"
    summary = summarize(commits)
    matched_authors = summarize_authors(commits)
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
        "privacy": args.privacy,
        "summary": summary,
        "matched_authors": matched_authors,
        "evidence_warnings": build_evidence_warnings(args, summary, matched_authors, inspection_plan),
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
