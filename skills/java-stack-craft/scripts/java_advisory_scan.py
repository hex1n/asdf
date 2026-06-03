#!/usr/bin/env python3
"""Advisory scanner for high-frequency Java stack defects.

The scanner is intentionally conservative about enforcement: by default it
prints findings and exits 0. Use --fail-on only when the caller wants a gate.

This is not a full Java static analyzer. Rules are narrow, stdlib-only signals
that help an agent decide what to inspect next.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set

try:
    import detect_java_profile
except Exception:  # pragma: no cover - script can still scan without detector
    detect_java_profile = None


SEVERITY_ORDER = {"blocker": 4, "major": 3, "minor": 2, "nit": 1}
DEFAULT_MAX_DEPTH = 4
IGNORED_DIRS = {".git", "target", "build", "out", "node_modules", ".gradle"}

PROOF_SOURCE_INVARIANT = "P2"
PROOF_SCANNER_SIGNAL = "P3"


@dataclass(frozen=True)
class FindingSpec:
    severity: str
    category: str
    confidence: str
    proof_tier: str
    rule: str
    impact: str
    fix: str


@dataclass(frozen=True)
class LinePatternRule:
    pattern: re.Pattern[str]
    spec: FindingSpec
    code_only: bool = True


@dataclass(frozen=True)
class JdkFeatureRule:
    min_jdk: int
    pattern: re.Pattern[str]
    rule: str
    fix: str


CONFIG_SECRET_SPEC = FindingSpec(
    "blocker",
    "security",
    "confirmed",
    PROOF_SOURCE_INVARIANT,
    "sensitive config uses a non-empty env-var default",
    "a committed default secret can be used outside the app if it is real",
    "remove real defaults, require the environment variable, and rotate any exposed key",
)
CONFIG_TEST_SECRET_SPEC = FindingSpec(
    "major",
    "security",
    "needs-check",
    PROOF_SCANNER_SIGNAL,
    CONFIG_SECRET_SPEC.rule,
    CONFIG_SECRET_SPEC.impact,
    CONFIG_SECRET_SPEC.fix,
)
FIELD_INJECTION_SPEC = FindingSpec(
    "major",
    "spring",
    "likely",
    PROOF_SCANNER_SIGNAL,
    "field injection hides required dependencies",
    "the bean is harder to construct directly and can mask lifecycle/configuration issues",
    "prefer constructor injection with final dependencies when touching this bean",
)
BOOT2_JAKARTA_SPEC = FindingSpec(
    "blocker",
    "spring",
    "confirmed",
    PROOF_SOURCE_INVARIANT,
    "Spring Boot 2 code imports jakarta.*",
    "Boot 2 uses javax namespaces, so this is likely to fail compilation",
    "use the javax.* equivalent or upgrade Spring Boot deliberately",
)
BOOT3_JAVAX_SPEC = FindingSpec(
    "blocker",
    "spring",
    "confirmed",
    PROOF_SOURCE_INVARIANT,
    "Spring Boot 3 code imports legacy javax EE namespaces",
    "Boot 3 uses jakarta namespaces for validation/persistence/servlet APIs",
    "use the jakarta.* equivalent",
)
TEXT_BLOCK_SPEC = FindingSpec(
    "blocker",
    "jdk",
    "confirmed",
    PROOF_SOURCE_INVARIANT,
    "text blocks require JDK 15",
    "source may not compile or run on the detected target JDK",
    "use normal strings or raise the target JDK",
)

ENV_DEFAULT_RE = re.compile(r"\$\{[A-Za-z0-9_.-]+:([^}]+)\}")
SENSITIVE_KEY_RE = re.compile(r"(api[-_.]?key|secret|token|password|credential)", re.IGNORECASE)
TEST_LIKE_DEFAULT_RE = re.compile(r"\b(test|mock|fake|dummy|example|local)\b", re.IGNORECASE)
WEAK_SECRET_DEFAULTS = {"", "changeme", "change-me", "todo", "replace-me", "none", "null"}

LINE_PATTERN_RULES = (
    LinePatternRule(
        re.compile(r"\bExecutors\.(?:newCachedThreadPool|newFixedThreadPool|newSingleThreadExecutor)\s*\("),
        FindingSpec(
            "major",
            "concurrency",
            "likely",
            PROOF_SCANNER_SIGNAL,
            "Executors factory creates an unbounded or opaque executor",
            "service load can accumulate queued work or threads without explicit backpressure",
            "inject a bounded ThreadPoolExecutor with named threads and a rejection policy",
        ),
    ),
    LinePatternRule(
        re.compile(r"catch\s*\([^)]*\b(ignore|ignored)\b[^)]*\)\s*\{\s*\}"),
        FindingSpec(
            "minor",
            "correctness",
            "likely",
            PROOF_SCANNER_SIGNAL,
            "empty catch swallows failures",
            "important cleanup or cancellation errors may disappear during diagnosis",
            "log at debug/trace when safe or narrow the exception and document why it is ignorable",
        ),
    ),
    LinePatternRule(
        re.compile(r"\b(?:\w+\.)?printStackTrace\s*\(|\bSystem\.(?:out|err)\.print"),
        FindingSpec(
            "minor",
            "logging",
            "confirmed",
            PROOF_SCANNER_SIGNAL,
            "console logging bypasses application logging",
            "logs lose structure, levels, and routing",
            "use SLF4J parameterized logging",
        ),
    ),
)

JDK_FEATURE_RULES = (
    JdkFeatureRule(
        10,
        re.compile(r"(^|[;{]\s*)var\s+\w+\s*="),
        "local-variable type inference requires JDK 10",
        "replace var with an explicit type or raise the target JDK",
    ),
    JdkFeatureRule(
        16,
        re.compile(r"^\s*(?:(?:public|protected|private|static|final|abstract|sealed|non-sealed)\s+)*record\s+\w+\s*\("),
        "records require JDK 16",
        "use a normal immutable class or raise the target JDK",
    ),
    JdkFeatureRule(
        9,
        re.compile(r"\b(List|Set|Map)\.of\s*\("),
        "collection factory methods require JDK 9",
        "use Arrays.asList/new HashMap or raise the target JDK",
    ),
    JdkFeatureRule(
        16,
        re.compile(r"(?<!Collectors)\.toList\s*\(\s*\)"),
        "Stream.toList requires JDK 16",
        "use collect(Collectors.toList()) or raise the target JDK",
    ),
    JdkFeatureRule(
        14,
        re.compile(r"\bcase\b.*->"),
        "switch expressions require JDK 14",
        "use classic switch syntax or raise the target JDK",
    ),
)


def _line_iter(path: Path) -> Iterable[tuple[int, str]]:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for idx, line in enumerate(fh, 1):
                yield idx, line.rstrip("\n")
    except OSError:
        return


def _rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def _finding(spec: FindingSpec, path: Path, line: int, root: Path) -> Dict[str, object]:
    return {
        "severity": spec.severity,
        "category": spec.category,
        "confidence": spec.confidence,
        "proof_tier": spec.proof_tier,
        "file": _rel(path, root),
        "line": line,
        "rule": spec.rule,
        "impact": spec.impact,
        "fix": spec.fix,
    }


def _is_ignored_path(path: Path) -> bool:
    return any(part in IGNORED_DIRS for part in path.parts)


def _is_test_path(path: Path) -> bool:
    parts = list(path.parts)
    return "src" in parts and "test" in parts


def _source_roots(root: Path, leaf: str, include_tests: bool = False) -> List[Path]:
    wanted = {("src", "main", leaf)}
    if include_tests:
        wanted.add(("src", "test", leaf))

    roots: List[Path] = []
    for path in sorted(root.rglob(leaf)):
        if not path.is_dir() or _is_ignored_path(path):
            continue
        if len(path.parts) >= 3 and tuple(path.parts[-3:]) in wanted:
            roots.append(path)
    return roots


def _java_files(root: Path, include_tests: bool = False) -> List[Path]:
    files: List[Path] = []
    for base in _source_roots(root, "java", include_tests=include_tests):
        files.extend(path for path in sorted(base.rglob("*.java")) if not _is_ignored_path(path))
    if files:
        return files
    return [
        path
        for path in sorted(root.rglob("*.java"))
        if not _is_ignored_path(path) and (include_tests or not _is_test_path(path))
    ]


def _config_files(root: Path, include_tests: bool = False) -> List[Path]:
    patterns = ["application*.yml", "application*.yaml", "application*.properties"]
    files: List[Path] = []
    for base in _source_roots(root, "resources", include_tests=include_tests):
        for pattern in patterns:
            files.extend(path for path in sorted(base.rglob(pattern)) if not _is_ignored_path(path))
    if not files:
        for pattern in patterns:
            files.extend(
                path
                for path in sorted(root.rglob(pattern))
                if not _is_ignored_path(path) and (include_tests or not _is_test_path(path))
            )
    return files


def detect_project(root: Path, max_depth: int = DEFAULT_MAX_DEPTH) -> Dict[str, object]:
    result: Dict[str, object] = {"jdk": None, "source": None, "spring": None, "note": None}
    if detect_java_profile is None:
        result["note"] = "detect_java_profile.py could not be imported"
        return result

    detections = detect_java_profile.discover(str(root), max_depth=max_depth)
    if detections:
        version, source, note = detect_java_profile.choose_effective(detections, str(root))
        result["jdk"] = version
        result["source"] = source
        result["note"] = note
    result["spring"] = detect_java_profile.detect_spring_boot(str(root), max_depth=max_depth)
    return result


def scan_config_files(root: Path, include_tests: bool = False) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    for path in _config_files(root, include_tests=include_tests):
        for line_no, line in _line_iter(path):
            if not SENSITIVE_KEY_RE.search(line):
                continue
            match = ENV_DEFAULT_RE.search(line)
            if not match:
                continue
            default = match.group(1).strip().strip('"').strip("'")
            if default.lower() in WEAK_SECRET_DEFAULTS:
                continue
            is_test_resource = _is_test_path(path)
            spec = CONFIG_TEST_SECRET_SPEC if is_test_resource or TEST_LIKE_DEFAULT_RE.search(default) else CONFIG_SECRET_SPEC
            findings.append(_finding(spec, path, line_no, root))
    return findings


def scan_java_files(root: Path, project: Dict[str, object], include_tests: bool = False) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    jdk = project.get("jdk")
    spring = project.get("spring") or {}
    spring_major = spring.get("version_major") if isinstance(spring, dict) else None

    for path in _java_files(root, include_tests=include_tests):
        lines = list(_line_iter(path))
        for idx, line in lines:
            code_line = _strip_literals_and_line_comments(line)
            stripped = code_line.strip()

            findings.extend(_scan_field_injection(root, path, lines, idx, stripped))
            findings.extend(_scan_spring_namespace(root, path, idx, stripped, spring_major))
            findings.extend(_scan_run_async(root, path, lines, idx, code_line))
            findings.extend(_scan_line_patterns(root, path, idx, line, code_line))
            findings.extend(_scan_jdk_line(root, path, idx, line, code_line, jdk))

    return findings


def _scan_field_injection(
    root: Path,
    path: Path,
    lines: List[tuple[int, str]],
    idx: int,
    stripped: str,
) -> List[Dict[str, object]]:
    if not re.search(r"@\s*Autowired\b", stripped):
        return []
    next_line = _next_code_line(lines, idx)
    if next_line and re.search(r"\b(private|protected|public)\b", next_line) and "(" not in next_line:
        return [_finding(FIELD_INJECTION_SPEC, path, idx, root)]
    return []


def _scan_spring_namespace(
    root: Path,
    path: Path,
    idx: int,
    stripped: str,
    spring_major: object,
) -> List[Dict[str, object]]:
    if spring_major == 2 and re.match(r"import\s+jakarta\.", stripped):
        return [_finding(BOOT2_JAKARTA_SPEC, path, idx, root)]
    if spring_major == 3 and re.match(r"import\s+javax\.(validation|persistence|servlet)\.", stripped):
        return [_finding(BOOT3_JAVAX_SPEC, path, idx, root)]
    return []


def _scan_run_async(
    root: Path,
    path: Path,
    lines: List[tuple[int, str]],
    idx: int,
    code_line: str,
) -> List[Dict[str, object]]:
    if not re.search(r"\bCompletableFuture\.runAsync\s*\(", code_line):
        return []
    if _run_async_has_explicit_executor(lines, idx):
        return []
    spec = FindingSpec(
        "major",
        "concurrency",
        "likely",
        PROOF_SCANNER_SIGNAL,
        "CompletableFuture.runAsync uses the common pool",
        "blocking service work can starve unrelated common-pool tasks",
        "pass an explicit bounded executor",
    )
    return [_finding(spec, path, idx, root)]


def _scan_line_patterns(
    root: Path,
    path: Path,
    idx: int,
    line: str,
    code_line: str,
) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    for rule in LINE_PATTERN_RULES:
        target = code_line if rule.code_only else line
        if rule.pattern.search(target):
            findings.append(_finding(rule.spec, path, idx, root))
    return findings


def _next_code_line(lines: List[tuple[int, str]], current_idx: int) -> Optional[str]:
    for line_no, line in lines:
        if line_no <= current_idx:
            continue
        stripped = _strip_literals_and_line_comments(line).strip()
        if not stripped or stripped.startswith("//"):
            continue
        return stripped
    return None


def _run_async_has_explicit_executor(lines: List[tuple[int, str]], current_idx: int) -> bool:
    block_parts: List[str] = []
    for line_no, line in lines:
        if line_no < current_idx:
            continue
        block_parts.append(line)
        if line_no - current_idx > 200:
            break
    block = "\n".join(block_parts)
    args = _extract_call_arguments(block, "CompletableFuture.runAsync")
    return len(args) >= 2


def _extract_call_arguments(text: str, marker: str) -> List[str]:
    start = text.find(marker)
    if start < 0:
        return []
    open_idx = text.find("(", start + len(marker))
    if open_idx < 0:
        return []

    args: List[str] = []
    token: List[str] = []
    paren = brace = bracket = angle = 0
    in_string = in_char = False
    escape = False
    idx = open_idx + 1
    while idx < len(text):
        ch = text[idx]
        if escape:
            token.append(ch)
            escape = False
            idx += 1
            continue
        if ch == "\\" and (in_string or in_char):
            token.append(ch)
            escape = True
            idx += 1
            continue
        if in_string:
            token.append(ch)
            if ch == '"':
                in_string = False
            idx += 1
            continue
        if in_char:
            token.append(ch)
            if ch == "'":
                in_char = False
            idx += 1
            continue

        if ch == '"':
            in_string = True
            token.append(ch)
        elif ch == "'":
            in_char = True
            token.append(ch)
        elif ch == "(":
            paren += 1
            token.append(ch)
        elif ch == ")":
            if paren == brace == bracket == angle == 0:
                tail = "".join(token).strip()
                if tail:
                    args.append(tail)
                return args
            paren = max(0, paren - 1)
            token.append(ch)
        elif ch == "{":
            brace += 1
            token.append(ch)
        elif ch == "}":
            brace = max(0, brace - 1)
            token.append(ch)
        elif ch == "[":
            bracket += 1
            token.append(ch)
        elif ch == "]":
            bracket = max(0, bracket - 1)
            token.append(ch)
        elif ch == "<":
            angle += 1
            token.append(ch)
        elif ch == ">":
            angle = max(0, angle - 1)
            token.append(ch)
        elif ch == "," and paren == brace == bracket == angle == 0:
            args.append("".join(token).strip())
            token = []
        else:
            token.append(ch)
        idx += 1
    return []


def _strip_literals_and_line_comments(line: str) -> str:
    chars: List[str] = []
    in_string = False
    in_char = False
    escape = False
    idx = 0

    while idx < len(line):
        ch = line[idx]
        next_ch = line[idx + 1] if idx + 1 < len(line) else ""

        if escape:
            chars.append(" ")
            escape = False
            idx += 1
            continue
        if in_string:
            if ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            chars.append(" ")
            idx += 1
            continue
        if in_char:
            if ch == "\\":
                escape = True
            elif ch == "'":
                in_char = False
            chars.append(" ")
            idx += 1
            continue

        if ch == "/" and next_ch == "/":
            chars.extend(" " for _ in range(len(line) - idx))
            break
        if ch == '"':
            in_string = True
            chars.append(" ")
        elif ch == "'":
            in_char = True
            chars.append(" ")
        else:
            chars.append(ch)
        idx += 1

    return "".join(chars)


def _scan_jdk_line(
    root: Path,
    path: Path,
    idx: int,
    line: str,
    code_line: str,
    jdk: object,
) -> List[Dict[str, object]]:
    if not isinstance(jdk, int):
        return []
    findings: List[Dict[str, object]] = []
    for rule in JDK_FEATURE_RULES:
        if jdk < rule.min_jdk and rule.pattern.search(code_line):
            spec = FindingSpec(
                "blocker",
                "jdk",
                "confirmed",
                PROOF_SOURCE_INVARIANT,
                rule.rule,
                "source may not compile or run on the detected target JDK",
                rule.fix,
            )
            findings.append(_finding(spec, path, idx, root))
    if jdk < 15 and '"""' in line:
        findings.append(_finding(TEXT_BLOCK_SPEC, path, idx, root))
    return findings


def scan_project(
    root_dir: str,
    include_tests: bool = False,
    categories: Optional[Set[str]] = None,
    max_findings: Optional[int] = None,
    max_depth: int = DEFAULT_MAX_DEPTH,
) -> Dict[str, object]:
    root = Path(root_dir).resolve()
    project = detect_project(root, max_depth=max_depth)
    findings = scan_config_files(root, include_tests=include_tests)
    findings.extend(scan_java_files(root, project, include_tests=include_tests))
    if categories:
        findings = [item for item in findings if str(item["category"]) in categories]
    findings.sort(key=lambda item: (-SEVERITY_ORDER.get(str(item["severity"]), 0), str(item["file"]), int(item["line"])))
    if max_findings is not None:
        findings = findings[:max_findings]
    return {"root": str(root), "project": project, "findings": findings}


def render_markdown(result: Dict[str, object]) -> str:
    project = result["project"]
    findings = result["findings"]
    spring = project.get("spring") or {}
    lines = ["# Java Stack Advisory Scan", ""]
    lines.append("## Detected")
    lines.append("")
    lines.append(f"- JDK: {project.get('jdk') or 'unknown'}")
    lines.append(f"- Source: {project.get('source') or 'not found'}")
    if isinstance(spring, dict) and spring:
        lines.append(f"- Spring Boot: {spring.get('raw') or spring.get('version') or 'unknown'}")
        lines.append(f"- Namespace: {spring.get('namespace') or 'unknown'}")
        lines.append(f"- Web stack: {spring.get('web_stack') or 'unknown'}")
    if project.get("note"):
        lines.append(f"- Note: {project.get('note')}")
    lines.append("")
    lines.append("## Findings")
    lines.append("")
    if not findings:
        lines.append("No advisory findings.")
        return "\n".join(lines)

    lines.append("| Severity | Category | Confidence | Proof | Location | Rule | Impact | Fix |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for item in findings:
        location = f"{item['file']}:{item['line']}"
        lines.append(
            "| {severity} | {category} | {confidence} | {proof} | {location} | {rule} | {impact} | {fix} |".format(
                severity=item["severity"],
                category=item["category"],
                confidence=item["confidence"],
                proof=item.get("proof_tier", PROOF_SCANNER_SIGNAL),
                location=location,
                rule=str(item["rule"]).replace("|", "/"),
                impact=str(item["impact"]).replace("|", "/"),
                fix=str(item["fix"]).replace("|", "/"),
            )
        )
    return "\n".join(lines)


def should_fail(findings: List[Dict[str, object]], fail_on: str) -> bool:
    if fail_on == "none":
        return False
    threshold = SEVERITY_ORDER[fail_on]
    return any(SEVERITY_ORDER.get(str(item["severity"]), 0) >= threshold for item in findings)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Advisory Java stack quality scanner")
    parser.add_argument("--dir", default=".", help="Project root or Java module root")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--fail-on", choices=["none", "blocker", "major", "minor", "nit"], default="none")
    parser.add_argument("--include-tests", action="store_true", help="Also scan src/test Java and test resources")
    parser.add_argument("--category", help="Comma-separated categories to keep, e.g. security,concurrency,jdk")
    parser.add_argument("--max-findings", type=int, help="Maximum findings to print after sorting")
    parser.add_argument("--max-depth", type=int, default=DEFAULT_MAX_DEPTH, help="Max module-scan depth for build files")
    args = parser.parse_args(argv)

    categories = None
    if args.category:
        categories = {part.strip() for part in args.category.split(",") if part.strip()}
    result = scan_project(
        args.dir,
        include_tests=args.include_tests,
        categories=categories,
        max_findings=args.max_findings,
        max_depth=args.max_depth,
    )
    if args.format == "json":
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print(render_markdown(result))

    return 1 if should_fail(result["findings"], args.fail_on) else 0


if __name__ == "__main__":
    raise SystemExit(main())
