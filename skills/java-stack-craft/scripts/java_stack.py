#!/usr/bin/env python3
"""Unified Java Stack Craft facade.

This stdlib-only CLI composes the existing target detector and advisory scanner
with bounded Project Facility discovery. It gives agents one stable entrypoint
for pre-work Java context while keeping mandatory profile detection separate
from advisory risk signals.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set

import detect_java_profile
import java_advisory_scan


IGNORED_DIRS = {".git", "target", "build", "out", "node_modules", ".gradle", ".idea"}
DEFAULT_FACILITY_LIMIT = 5
DEFAULT_CONTEXT_FINDINGS = 12
DEFAULT_PROFILE_RELATIVE = Path("docs/agents/java-stack-profile.md")
GENERATED_START = "<!-- java-stack-craft:generated:start -->"
GENERATED_END = "<!-- java-stack-craft:generated:end -->"
BUILD_FILE_NAMES = {
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "gradle.properties",
    "mvnw",
    "gradlew",
}


@dataclass(frozen=True)
class FacilitySpec:
    key: str
    label: str
    patterns: tuple[re.Pattern[str], ...]
    hint: str


FACILITY_SPECS: tuple[FacilitySpec, ...] = (
    FacilitySpec(
        "logging_alarm",
        "logging/alarm",
        (
            re.compile(r"@\s*Slf4j\b"),
            re.compile(r"\bLoggerFactory\.getLogger\b"),
            re.compile(r"\bLoggerUtil\b"),
            re.compile(r"\bAlarm(?:Util|Service)?\b"),
            re.compile(r"\blog\.(?:trace|debug|info|warn|error)\s*\("),
        ),
        "Match the project's normal log/alarm path before adding new logging helpers.",
    ),
    FacilitySpec(
        "transaction",
        "transaction boundary",
        (
            re.compile(r"@\s*Transactional\b"),
            re.compile(r"@\s*TransactionalEventListener\b"),
            re.compile(r"\bTransactionTemplate\b"),
            re.compile(r"\bPropagation\.[A-Z_]+\b"),
        ),
        "Reuse the local transaction boundary style; avoid hand-rolled transaction helpers.",
    ),
    FacilitySpec(
        "pagination_query",
        "pagination/query",
        (
            re.compile(r"\bRowBounds\b"),
            re.compile(r"\bPageHelper\b"),
            re.compile(r"\bPageRequest\b"),
            re.compile(r"\bPageable\b"),
            re.compile(r"\bIPage\s*<"),
            re.compile(r"\bselect\w*Page\w*\s*\("),
        ),
        "Prefer existing paging/query helpers or mapper methods over ad hoc slicing.",
    ),
    FacilitySpec(
        "mapper_dto",
        "mapper/DTO style",
        (
            re.compile(r"@\s*Mapper\b"),
            re.compile(r"\bMapStruct\b"),
            re.compile(r"\b(?:DTO|Dto|Request|Response|VO|Entity)\b"),
            re.compile(r"\b(?:toDto|toEntity|fromEntity|convert)\s*\("),
        ),
        "Follow local mapping and boundary object style before introducing new DTO plumbing.",
    ),
    FacilitySpec(
        "exception_result",
        "exception/result style",
        (
            re.compile(r"@\s*ControllerAdvice\b"),
            re.compile(r"@\s*ExceptionHandler\b"),
            re.compile(r"\b(?:Biz|Business|Service|Domain)Exception\b"),
            re.compile(r"\bErrorCode\b"),
            re.compile(r"\bResult\s*<"),
            re.compile(r"\b(?:ApiResponse|BaseResponse|ResponseResult)\b"),
        ),
        "Match the project failure/result contract instead of inventing a new wrapper.",
    ),
    FacilitySpec(
        "json_date_id_config",
        "JSON/date/id/config helper",
        (
            re.compile(r"\bObjectMapper\b"),
            re.compile(r"\bDateTimeFormatter\b"),
            re.compile(r"\b(?:IdGenerator|Snowflake)\b"),
            re.compile(r"@\s*ConfigurationProperties\b"),
            re.compile(r"@\s*Value\s*\("),
        ),
        "Use existing serialization, time, id, and config conventions where they own the seam.",
    ),
    FacilitySpec(
        "test_idiom",
        "test idiom",
        (
            re.compile(r"@\s*SpringBootTest\b"),
            re.compile(r"\bMockMvc\b"),
            re.compile(r"@\s*ExtendWith\b"),
            re.compile(r"\bMockito\b"),
            re.compile(r"\bAssertions?\.\w+\s*\("),
        ),
        "Mirror the local test seam before adding a new test style.",
    ),
)

GENERIC_FACILITY_BUCKET = {
    "key": "project_owned_facility_type",
    "label": "project-owned facility-like type",
    "hint": "Use as a generic search seed for local helpers/APIs beyond the common seam catalog.",
}
TYPE_DECL_RE = re.compile(r"\b(?:class|interface|enum|record)\s+([A-Z][A-Za-z0-9_]*)\b")
FACILITY_TYPE_RE = re.compile(
    r"(?:Util|Utils|Helper|Template|Mapper|Converter|Client|Gateway|Adapter|Registry|Resolver|Provider|"
    r"Factory|Generator|Validator|Guard|Support|Interceptor|Filter|Advice|"
    r"Aspect|Executor|Scheduler)$"
)
NON_FACILITY_TYPE_RE = re.compile(r"(?:DTO|Dto|Entity|Request|Response|VO|BO|PO|DO|Model|Event|Command)$")


def _is_ignored(path: Path) -> bool:
    return any(part in IGNORED_DIRS for part in path.parts)


def _rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def _sha256_short(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _iter_build_files(root: Path) -> List[Path]:
    files: List[Path] = []
    if not root.exists():
        return files
    for path in root.rglob("*"):
        if not path.is_file() or _is_ignored(path):
            continue
        if path.name in BUILD_FILE_NAMES:
            files.append(path)
    return sorted(files, key=lambda item: _rel(item, root))


def _build_files_signature(root: Path) -> Dict[str, object]:
    files = _iter_build_files(root)
    if not files:
        return {"files": [], "signature": "no-build-files-found"}
    digest = hashlib.sha256()
    rendered: List[str] = []
    for path in files:
        rel = _rel(path, root)
        rendered.append(rel)
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        try:
            digest.update(path.read_bytes())
        except OSError:
            digest.update(b"<unreadable>")
        digest.update(b"\0")
    return {"files": rendered, "signature": digest.hexdigest()[:16]}


def _git_output(root: Path, args: Sequence[str]) -> Optional[str]:
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), *args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def _status_line_touches_profile(line: str, profile_rel: str) -> bool:
    path_part = line[3:] if len(line) > 3 else line
    return any(part.strip() == profile_rel for part in path_part.split(" -> "))


def _git_state(root: Path, profile_path: Path) -> Dict[str, object]:
    profile_rel = _rel(profile_path, root)
    head = _git_output(root, ["rev-parse", "HEAD"])
    status = _git_output(root, ["status", "--porcelain", "--untracked-files=all"])
    if head is None or status is None:
        return {
            "head": "not-a-git-repo",
            "dirty_paths": "unknown",
            "worktree_signature": "not-a-git-repo",
        }
    status_lines = [
        line
        for line in status.splitlines()
        if line and not _status_line_touches_profile(line, profile_rel)
    ]
    signature = "clean" if not status_lines else _sha256_short("\n".join(status_lines).encode("utf-8"))
    return {"head": head, "dirty_paths": len(status_lines), "worktree_signature": signature}


def _profile_path(root: Path, profile_path: Optional[str]) -> Path:
    if profile_path:
        candidate = Path(profile_path).expanduser()
        return candidate if candidate.is_absolute() else root / candidate
    return root / DEFAULT_PROFILE_RELATIVE


def _iter_files(root: Path, include_tests: bool = True) -> Iterable[Path]:
    suffixes = {".java", ".kt", ".groovy", ".xml", ".yml", ".yaml", ".properties"}
    files: List[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or _is_ignored(path) or path.suffix not in suffixes:
            continue
        parts = set(path.parts)
        if not include_tests and "test" in parts:
            continue
        files.append(path)

    def priority(path: Path) -> tuple[int, str]:
        parts = path.parts
        is_test = "test" in parts
        is_main = "main" in parts
        if is_main and not is_test:
            bucket = 0
        elif not is_test:
            bucket = 1
        else:
            bucket = 2
        return bucket, str(path)

    yield from sorted(files, key=priority)


def _line_iter(path: Path) -> Iterable[tuple[int, str]]:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for idx, line in enumerate(fh, 1):
                yield idx, line.rstrip("\n")
    except OSError:
        return


def _generic_facility_names(path: Path, line: str) -> List[str]:
    names = TYPE_DECL_RE.findall(line)
    return [
        name
        for name in names
        if name == path.stem and FACILITY_TYPE_RE.search(name) and not NON_FACILITY_TYPE_RE.search(name)
    ]


def _add_example(bucket: Dict[str, object], root: Path, path: Path, line_no: int, signal: str, per_category: int) -> None:
    bucket["count"] = int(bucket["count"]) + 1
    examples = bucket["examples"]
    if isinstance(examples, list) and len(examples) < per_category:
        examples.append({"file": _rel(path, root), "line": line_no, "signal": signal})


def build_profile(root_dir: str, max_depth: int = java_advisory_scan.DEFAULT_MAX_DEPTH) -> detect_java_profile.Result:
    result = detect_java_profile.Result()
    result.detections = detect_java_profile.discover(root_dir, max_depth)
    version, source, note = detect_java_profile.choose_effective(result.detections, root_dir)
    result.effective_version = version
    result.effective_source = source
    result.note = note
    result.spring = detect_java_profile.detect_spring_boot(root_dir, max_depth)
    return result


def render_profile_json(profile: detect_java_profile.Result) -> str:
    payload = {
        "detections": [detect_java_profile.asdict(item) for item in profile.detections],
        "effective_version": profile.effective_version,
        "effective_source": profile.effective_source,
        "note": profile.note,
        "spring_boot": profile.spring,
        "manifest": detect_java_profile.build_manifest(profile.effective_version) if profile.effective_version else None,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True)


def discover_facilities(
    root_dir: str,
    include_tests: bool = True,
    per_category: int = DEFAULT_FACILITY_LIMIT,
) -> Dict[str, object]:
    root = Path(root_dir).resolve()
    buckets: Dict[str, Dict[str, object]] = {
        spec.key: {"key": spec.key, "label": spec.label, "hint": spec.hint, "count": 0, "examples": []}
        for spec in FACILITY_SPECS
    }
    buckets[GENERIC_FACILITY_BUCKET["key"]] = {
        **GENERIC_FACILITY_BUCKET,
        "count": 0,
        "examples": [],
    }
    for path in _iter_files(root, include_tests=include_tests):
        for line_no, line in _line_iter(path):
            for spec in FACILITY_SPECS:
                matched = next((pattern.pattern for pattern in spec.patterns if pattern.search(line)), None)
                if not matched:
                    continue
                _add_example(buckets[spec.key], root, path, line_no, matched, per_category)
            if path.suffix == ".java":
                for name in _generic_facility_names(path, line):
                    _add_example(
                        buckets[GENERIC_FACILITY_BUCKET["key"]],
                        root,
                        path,
                        line_no,
                        f"type:{name}",
                        per_category,
                    )
    facilities = [bucket for bucket in buckets.values() if int(bucket["count"]) > 0]
    return {"root": str(root), "facilities": facilities}


def render_facilities_markdown(result: Dict[str, object]) -> str:
    lines = ["# Project Facilities", ""]
    facilities = result.get("facilities") or []
    if not facilities:
        lines.append("No common Project Facility signals were found. Confirm by reading same-module sibling code before inventing helpers.")
        return "\n".join(lines) + "\n"
    lines.append("| Facility | Signals | Examples | Use |")
    lines.append("|---|---:|---|---|")
    for facility in facilities:
        examples = facility.get("examples") or []
        rendered = ", ".join(f"`{item['file']}:{item['line']}`" for item in examples)
        lines.append(
            f"| {facility['label']} | {facility['count']} | {rendered} | {facility['hint']} |"
        )
    return "\n".join(lines) + "\n"


def _categories(raw: Optional[str]) -> Optional[Set[str]]:
    if not raw:
        return None
    return {part.strip() for part in raw.split(",") if part.strip()}


def flatten_action_candidates(candidates: Sequence[Dict[str, object]]) -> List[Dict[str, object]]:
    flattened: List[Dict[str, object]] = []
    for candidate in candidates:
        finding = dict(candidate.get("finding") or {})
        if not finding:
            continue
        finding["count"] = candidate.get("count", 1)
        finding["location"] = f"{finding.get('file')}:{finding.get('line')}"
        flattened.append(finding)
    return flattened


def build_context(
    root_dir: str,
    include_tests: bool = False,
    categories: Optional[Set[str]] = None,
    max_findings: int = DEFAULT_CONTEXT_FINDINGS,
    max_depth: int = java_advisory_scan.DEFAULT_MAX_DEPTH,
    touched_seam: Optional[str] = None,
) -> Dict[str, object]:
    root_path = Path(root_dir).resolve()
    if not root_path.is_dir():
        raise ValueError(f"--dir must be an existing project directory: {root_path}")
    root = str(root_path)
    profile = build_profile(root, max_depth=max_depth)
    scan = java_advisory_scan.scan_project(
        root,
        include_tests=include_tests,
        categories=categories,
        max_findings=max_findings,
        max_depth=max_depth,
    )
    facilities = discover_facilities(root, include_tests=True)
    return {
        "root": root,
        "target_profile": json.loads(render_profile_json(profile)),
        "project_facilities": facilities["facilities"],
        "risk_candidates": flatten_action_candidates(scan.get("action_candidates", [])),
        "risk_summary": scan.get("summary", {}),
        "displayed_findings": scan.get("findings", []),
        "verification_floor": verification_floor(profile, scan),
        "touched_seam": touched_seam or "unspecified",
        "context_options": {
            "include_tests": include_tests,
            "categories": sorted(categories) if categories else "all",
            "max_findings": max_findings,
            "max_depth": max_depth,
        },
    }


def verification_floor(profile: detect_java_profile.Result, scan: Dict[str, object]) -> Dict[str, str]:
    if not profile.effective_version:
        return {
            "floor": "Ask for or locate the target JDK before writing Java syntax.",
            "not_proven": "Java syntax compatibility and Spring namespace safety.",
        }
    project = scan.get("project") if isinstance(scan, dict) else {}
    spring = project.get("spring") if isinstance(project, dict) else None
    if spring:
        floor = "Run targeted Maven/Gradle compile when dependency access allows; otherwise verify namespace and touched source invariants."
    else:
        floor = "Run the smallest Maven/Gradle compile or focused test that reaches touched source; otherwise use source-level invariants."
    return {
        "floor": floor,
        "not_proven": "Runtime behavior, full compile, and user-impact claims remain unproven until a project command reaches the relevant source/tests.",
    }


def render_context_markdown(context: Dict[str, object]) -> str:
    lines = ["# Java Work Context", ""]
    profile = context["target_profile"]
    spring = profile.get("spring_boot")
    lines.append("## Target Profile")
    if profile.get("effective_version"):
        source = profile.get("effective_source") or "unknown"
        lines.append(f"- JDK: {profile['effective_version']} from `{source}`")
        lines.append(f"- Note: {profile.get('note') or 'none'}")
    else:
        lines.append("- JDK: unknown; ask before choosing Java syntax")
    if spring:
        stack = spring.get("web_stack") or "not detected"
        lines.append(f"- Spring Boot: {spring.get('raw')} -> `{spring.get('namespace')}.*`; web stack: {stack}")
    else:
        lines.append("- Spring Boot: not detected")
    lines.append("")

    lines.append("## Project Facilities")
    facilities = context.get("project_facilities") or []
    if not facilities:
        lines.append("- No common facility signals found; read touched-flow sibling code before inventing helpers.")
    else:
        for facility in facilities:
            examples = ", ".join(f"`{item['file']}:{item['line']}`" for item in facility.get("examples", []))
            lines.append(f"- {facility['label']}: {facility['count']} signals; examples {examples}. {facility['hint']}")
    lines.append("")

    lines.append("## Risk Candidates")
    candidates = context.get("risk_candidates") or []
    if not candidates:
        lines.append("- No action candidates from the bounded advisory scan.")
    else:
        for item in candidates[:8]:
            location = item.get("location") or "multiple"
            lines.append(
                f"- {item.get('severity')} / {item.get('category')} / {item.get('proof_tier')}: "
                f"{item.get('rule')} ({location}); Failure Path: {item.get('impact')}; Fix: {item.get('fix')}"
            )
    lines.append("")

    vf = context["verification_floor"]
    lines.append("## Verification Floor")
    lines.append(f"- Floor: {vf['floor']}")
    lines.append(f"- Not proven: {vf['not_proven']}")
    return "\n".join(lines) + "\n"


def _profile_state(root: Path, profile_path: Path, context: Dict[str, object]) -> Dict[str, object]:
    build = _build_files_signature(root)
    git = _git_state(root, profile_path)
    options = context.get("context_options") or {}
    return {
        "generated_at": _utc_now(),
        "project_root": str(root),
        "profile_path": _rel(profile_path, root),
        "touched_seam": context.get("touched_seam") or "unspecified",
        "context_options": options,
        "build_files": build["files"],
        "build_files_signature": build["signature"],
        "git_head": git["head"],
        "dirty_paths": git["dirty_paths"],
        "worktree_signature": git["worktree_signature"],
    }


def render_generated_profile_block(context: Dict[str, object], state: Dict[str, object]) -> str:
    options = state.get("context_options") or {}
    option_text = ", ".join(f"{key}={value!r}" for key, value in sorted(options.items())) or "none"
    lines = [
        GENERATED_START,
        "_Generated by java-stack-craft. Edit outside this generated block; rerun `java_stack.py context` to refresh._",
        "",
        "## Generated Snapshot",
        f"- Generated at: {state['generated_at']}",
        f"- Project root: `{state['project_root']}`",
        f"- Profile path: `{state['profile_path']}`",
        f"- Git HEAD: `{state['git_head']}`",
        f"- Worktree signature: `{state['worktree_signature']}` ({state['dirty_paths']} dirty paths excluding this profile)",
        f"- Build files signature: `{state['build_files_signature']}`",
        f"- Build files: {', '.join(f'`{item}`' for item in state['build_files']) or 'none found'}",
        f"- Touched seam: {state['touched_seam']}",
        f"- Context options: `{option_text}`",
        "- Refresh when build files, Git HEAD/worktree, touched seam, or context options changed.",
        "",
    ]
    rendered_context = render_context_markdown(context).splitlines()
    if rendered_context and rendered_context[0] == "# Java Work Context":
        rendered_context = rendered_context[2:]
    lines.extend(rendered_context)
    lines.extend(
        [
            "",
            "## Generated Boundaries",
            "- Treat generated facts as soft context until confirmed from live code, build files, or commands.",
            "- Risk Candidates are snapshot signals, not durable waivers or confirmed findings.",
            "- If the snapshot used filtered context options, refresh with defaults before broad writing or review.",
            "- Preserve stable repo conventions and human decisions outside this generated block.",
            GENERATED_END,
        ]
    )
    return "\n".join(lines) + "\n"


def merge_profile_document(existing: str, generated_block: str) -> str:
    start = existing.find(GENERATED_START)
    end = existing.find(GENERATED_END)
    if start != -1 and end != -1 and start < end:
        end += len(GENERATED_END)
        merged = existing[:start] + generated_block.rstrip("\n") + existing[end:]
        return merged if merged.endswith("\n") else merged + "\n"
    if start != -1 or end != -1:
        if start != -1:
            prefix = existing[:start].rstrip()
            tail = existing[start + len(GENERATED_START) :]
            human_starts = [
                idx
                for marker in ("\n## Project Knowledge Cards", "\n## Human Notes")
                for idx in [tail.find(marker)]
                if idx != -1
            ]
            if human_starts:
                preserved = tail[min(human_starts) :].lstrip()
            else:
                recovered = tail.strip()
                preserved = f"## Recovered Profile Content\n\n{recovered}\n" if recovered else ""
            existing = prefix + ("\n\n" + preserved if preserved else "\n")
        else:
            existing = existing[end + len(GENERATED_END) :].lstrip()
        start = existing.find(GENERATED_START)
        end = existing.find(GENERATED_END)
        if start != -1 and end != -1 and start < end:
            end += len(GENERATED_END)
            merged = existing[:start] + generated_block.rstrip("\n") + existing[end:]
            return merged if merged.endswith("\n") else merged + "\n"

    if existing.strip():
        lines = existing.splitlines()
        if lines and lines[0].startswith("# "):
            rest = "\n".join(lines[1:]).lstrip()
            merged = f"{lines[0]}\n\n{generated_block}"
            if rest:
                merged += f"\n{rest}\n"
            return merged if merged.endswith("\n") else merged + "\n"
        return f"# Java Stack Profile\n\n{generated_block}\n## Human Notes\n\n{existing.strip()}\n"

    return (
        "# Java Stack Profile\n\n"
        f"{generated_block}\n"
        "## Project Knowledge Cards\n\n"
        "Add a card only when it would change a future coding, review, or verification choice.\n\n"
        "### <seam or convention>\n"
        "- Decision:\n"
        "- Use when:\n"
        "- Do not use when:\n"
        "- Evidence:\n"
        "- Last verified:\n\n"
        "## Human Notes\n\n"
        "- Put short caveats here only when they do not deserve a Project Knowledge Card. Do not edit the generated block.\n"
    )


def write_repo_profile(context: Dict[str, object], profile_path: Optional[str] = None) -> Path:
    root = Path(str(context["root"])).resolve()
    path = _profile_path(root, profile_path)
    state = _profile_state(root, path, context)
    generated_block = render_generated_profile_block(context, state)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(merge_profile_document(existing, generated_block), encoding="utf-8")
    return path


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--dir", default=".", help="Project root or Java module root")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--max-depth", type=int, default=java_advisory_scan.DEFAULT_MAX_DEPTH, help="Max module-scan depth")


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Java Stack Craft context facade")
    sub = parser.add_subparsers(dest="command", required=True)

    profile_p = sub.add_parser("profile", help="Detect JDK/Spring target profile")
    add_common_args(profile_p)

    facilities_p = sub.add_parser("facilities", help="Discover bounded Project Facility signals")
    add_common_args(facilities_p)
    facilities_p.add_argument("--include-tests", action="store_true", help="Include test source/resource signals")
    facilities_p.add_argument("--per-category", type=int, default=DEFAULT_FACILITY_LIMIT, help="Example limit per facility category")

    scan_p = sub.add_parser("scan", help="Run the advisory Java stack scanner")
    add_common_args(scan_p)
    scan_p.add_argument("--fail-on", choices=["none", "blocker", "major", "minor", "nit"], default="none")
    scan_p.add_argument("--include-tests", action="store_true")
    scan_p.add_argument("--category", help="Comma-separated categories to keep")
    scan_p.add_argument("--max-findings", type=int)
    scan_p.add_argument("--detail-limit", type=int, default=java_advisory_scan.DEFAULT_DETAIL_LIMIT)

    context_p = sub.add_parser("context", help="Build pre-work Java Work Context")
    add_common_args(context_p)
    context_p.add_argument("--include-tests", action="store_true")
    context_p.add_argument("--category", help="Comma-separated scanner categories to keep")
    context_p.add_argument("--max-findings", type=int, default=DEFAULT_CONTEXT_FINDINGS)
    context_p.add_argument("--seam", help="Touched module, flow, or concern used as a freshness key")
    context_p.add_argument(
        "--profile-path",
        default=str(DEFAULT_PROFILE_RELATIVE),
        help="Repo-local profile path to update by default; relative paths resolve from --dir",
    )
    context_p.add_argument("--no-write-profile", action="store_true", help="Print context without writing the repo profile")

    args = parser.parse_args(argv)

    if args.command == "profile":
        profile = build_profile(args.dir, max_depth=args.max_depth)
        print(render_profile_json(profile) if args.format == "json" else detect_java_profile.render_markdown(profile))
        return 0
    if args.command == "facilities":
        result = discover_facilities(args.dir, include_tests=args.include_tests, per_category=max(0, args.per_category))
        print(json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True) if args.format == "json" else render_facilities_markdown(result))
        return 0
    if args.command == "scan":
        categories = _categories(args.category)
        result = java_advisory_scan.scan_project(
            args.dir,
            include_tests=args.include_tests,
            categories=categories,
            max_findings=args.max_findings,
            max_depth=args.max_depth,
        )
        if args.format == "json":
            print(json.dumps(result, indent=2, sort_keys=True))
        else:
            print(java_advisory_scan.render_markdown(result, detail_limit=max(0, args.detail_limit)))
        return 1 if java_advisory_scan.should_fail(result["findings"], args.fail_on) else 0
    if args.command == "context":
        try:
            result = build_context(
                args.dir,
                include_tests=args.include_tests,
                categories=_categories(args.category),
                max_findings=args.max_findings,
                max_depth=args.max_depth,
                touched_seam=args.seam,
            )
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2
        profile_path = None
        if not args.no_write_profile:
            try:
                profile_path = write_repo_profile(result, args.profile_path)
            except OSError as exc:
                print(f"Failed to update repo profile: {exc}", file=sys.stderr)
                return 1
            result["repo_profile_path"] = _rel(profile_path, Path(str(result["root"])).resolve())
        if args.format == "json":
            print(json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True))
        else:
            print(render_context_markdown(result))
            if profile_path:
                print(f"Updated repo profile: `{result['repo_profile_path']}`")
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
