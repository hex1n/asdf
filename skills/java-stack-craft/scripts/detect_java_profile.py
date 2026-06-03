#!/usr/bin/env python3
"""Detect the target JDK version from Maven/Gradle build files and emit a
version-gated feature manifest.

The manifest tells an agent which modern Java language/library features are
*final* (safe to use unconditionally) at the project's target version, which
are *preview* (compile only with --enable-preview, so opt-in), and which are
*withdrawn* (must not be used). This keeps generated code both modern and
compilable.

Usage:
    python3 detect_java_profile.py [--dir PATH] [--format markdown|json]
    python3 detect_java_profile.py --pom path/to/pom.xml
    python3 detect_java_profile.py --gradle path/to/build.gradle.kts

The script is self-contained (stdlib only) and reads no project-specific
configuration beyond the build files it parses.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from typing import Optional


# --- Feature catalog -------------------------------------------------------
# (label, min_final_version, kind, note)
# kind: "final"     -> available and stable at >= min version
#       "preview@N"  -> still a preview feature as of JDK N; needs --enable-preview
#       "withdrawn"  -> shipped as preview then removed; do NOT use
# Authoritative feature -> version -> JEP map for the whole skill. This is the
# SINGLE SOURCE OF TRUTH: REFERENCE.md does NOT keep a parallel table, it points
# here. On a new JDK, edit ONLY this list. Tuple: (final_in_version, jep, label, note).
FINAL_FEATURES: list[tuple[int, str, str, str]] = [
    (8, "JSR 335", "Lambdas & functional interfaces (Function/Supplier/Consumer/Predicate)", "Replace anonymous classes and verbose loops."),
    (8, "JSR 335", "Stream API + Collectors", "Use for transform/filter/group; avoid for trivial single-pass loops or side-effect-heavy logic."),
    (8, "JDK 8", "Optional (return values only)", "Never use Optional for fields, parameters, or collections."),
    (8, "JSR 310", "java.time (LocalDate/Instant/Duration)", "Never use java.util.Date/Calendar in new code."),
    (8, "JSR 335", "Default & static interface methods", "Evolve interfaces without breaking implementers."),
    (8, "JDK 8", "CompletableFuture", "Async composition; prefer over raw Future."),
    (9, "JEP 269", "Collection factory methods (List.of/Set.of/Map.of)", "Immutable literals; replace Arrays.asList for constants."),
    (9, "JEP 213", "Stream.takeWhile/dropWhile/ofNullable, private interface methods", ""),
    (10, "JEP 286", "var (local-variable type inference)", "Use when the RHS makes the type obvious; not for public APIs."),
    (11, "JDK 11", "String.strip/isBlank/lines/repeat, Files.readString/writeString", "Replace trim() and manual file readers."),
    (11, "JEP 321", "Standard java.net.http.HttpClient", "Replace HttpURLConnection / legacy Apache client for new code."),
    (11, "JEP 323", "Optional.isEmpty, var in lambda params", ""),
    (14, "JEP 361", "switch expressions (arrow + yield)", "Replace fall-through switch statements; exhaustive over enums."),
    (15, "JEP 378", "Text blocks", "Use for SQL/JSON/HTML literals instead of concatenated strings."),
    (16, "JEP 395", "record (immutable data carriers)", "Use for DTOs, value objects, events, query results."),
    (16, "JEP 394", "Pattern matching for instanceof", "Replace instanceof + cast."),
    (16, "JDK 16", "Stream.toList()", "Replace collect(Collectors.toList()) when an unmodifiable list is fine."),
    (17, "JEP 409", "sealed classes/interfaces", "Model closed type hierarchies; pairs with exhaustive switch."),
    (17, "JEP 356", "RandomGenerator API", ""),
    (21, "JEP 444", "Virtual threads (Thread.ofVirtual / newVirtualThreadPerTaskExecutor)", "Use for high-concurrency blocking I/O; do NOT pool them. On J21-23 blocking inside synchronized PINS the carrier - use ReentrantLock for blocking sections (fixed in J24, see below)."),
    (21, "JEP 441", "Pattern matching for switch (+ guarded patterns)", "Replace type-dispatch if-else chains; exhaustive over sealed types."),
    (21, "JEP 440", "Record patterns (deconstruction)", "Destructure records in switch/instanceof."),
    (21, "JEP 431", "SequencedCollection / SequencedSet / SequencedMap", "getFirst/getLast/reversed without manual indexing."),
    (24, "JEP 491", "synchronized no longer pins virtual threads", "On J24+ blocking inside synchronized no longer pins the carrier; the ReentrantLock workaround needed on J21-23 is no longer required."),
    (25, "JEP 506", "Scoped values", "Prefer over ThreadLocal for immutable per-request context, esp. with virtual threads."),
    (25, "JEP 511/512/513", "Module import declarations, compact source files & instance main, flexible constructor bodies", ""),
]

PREVIEW_FEATURES: list[tuple[int, str, str]] = [
    # (still_preview_as_of_version, label, note)
    (25, "Structured concurrency (java.util.concurrent.StructuredTaskScope)", "Preview through JDK 25 (5th preview); needs --enable-preview. Do not use in production code unless the user opts in."),
    (25, "Primitive types in patterns/instanceof/switch", "Preview through JDK 25; needs --enable-preview."),
    (25, "Stable values (StableValue)", "Preview in JDK 25; needs --enable-preview."),
]

WITHDRAWN_FEATURES: list[tuple[str, str]] = [
    ("String templates (STR.\"...\")", "Shipped as preview in JDK 21-22, REMOVED in JDK 23 for redesign. Do NOT use on any version; concatenate, use formatted(), or text blocks instead."),
]

LTS_VERSIONS = {8, 11, 17, 21, 25}


@dataclass
class Detection:
    source_file: str
    build_tool: str
    raw_value: str
    version: int


@dataclass
class Result:
    detections: list[Detection] = field(default_factory=list)
    effective_version: Optional[int] = None
    effective_source: Optional[str] = None
    note: str = ""
    spring: Optional[dict] = None


# --- Version normalization -------------------------------------------------
def normalize_version(raw: str) -> Optional[int]:
    """Turn '1.8', '8', 'VERSION_17', '21' into an int major version."""
    if raw is None:
        return None
    s = str(raw).strip().strip('"').strip("'")
    m = re.search(r"(?:VERSION_)?(\d+)(?:\.(\d+))?", s)
    if not m:
        return None
    major = int(m.group(1))
    minor = m.group(2)
    # Legacy 1.x scheme: 1.8 -> 8, 1.7 -> 7
    if major == 1 and minor is not None:
        return int(minor)
    return major


# --- Maven parsing ---------------------------------------------------------
def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def parse_pom(path: str) -> Optional[Detection]:
    try:
        tree = ET.parse(path)
    except (ET.ParseError, OSError):
        return _parse_pom_regex(path)
    root = tree.getroot()

    props: dict[str, str] = {}
    for parent in root.iter():
        if _strip_ns(parent.tag) == "properties":
            for child in parent:
                props[_strip_ns(child.tag)] = (child.text or "").strip()

    # Priority: explicit release > java.version (Spring Boot) > source/target
    for key in ("maven.compiler.release", "java.version",
                "maven.compiler.source", "maven.compiler.target"):
        if props.get(key):
            v = normalize_version(props[key])
            if v:
                return Detection(path, "maven", props[key], v)

    # maven-compiler-plugin <configuration><release|source|target>
    for cfg_tag in ("release", "source", "target"):
        for el in root.iter():
            if _strip_ns(el.tag) == cfg_tag and (el.text or "").strip():
                v = normalize_version(el.text)
                if v:
                    return Detection(path, "maven", el.text.strip(), v)

    return _parse_pom_regex(path)


def _parse_pom_regex(path: str) -> Optional[Detection]:
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return None
    for tag in ("maven.compiler.release", "java.version",
                "maven.compiler.source", "maven.compiler.target",
                "release", "source", "target"):
        m = re.search(rf"<{re.escape(tag)}>\s*([^<]+?)\s*</{re.escape(tag)}>", text)
        if m:
            v = normalize_version(m.group(1))
            if v:
                return Detection(path, "maven", m.group(1).strip(), v)
    return None


# --- Gradle parsing --------------------------------------------------------
GRADLE_PATTERNS = [
    r"JavaLanguageVersion\.of\(\s*(\d+)\s*\)",
    r"languageVersion(?:\.set)?\s*[=(]\s*JavaLanguageVersion\.of\(\s*(\d+)\s*\)",
    r"sourceCompatibility\s*=?\s*JavaVersion\.VERSION_(\d+)",
    r"targetCompatibility\s*=?\s*JavaVersion\.VERSION_(\d+)",
    r"sourceCompatibility\s*=?\s*[\"']?(?:1\.)?(\d+)[\"']?",
    r"targetCompatibility\s*=?\s*[\"']?(?:1\.)?(\d+)[\"']?",
    r"release(?:\.set)?\s*[=(]\s*(\d+)",
]


def parse_gradle(path: str) -> Optional[Detection]:
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return None
    # Drop line comments to avoid false hits.
    text = re.sub(r"//.*", "", text)
    for pat in GRADLE_PATTERNS:
        m = re.search(pat, text)
        if m:
            v = normalize_version(m.group(1))
            if v:
                return Detection(path, "gradle", m.group(0).strip(), v)
    return None


# --- Discovery -------------------------------------------------------------
BUILD_FILES = {
    "pom.xml": parse_pom,
    "build.gradle": parse_gradle,
    "build.gradle.kts": parse_gradle,
}
IGNORE_DIRS = {".git", "target", "build", "node_modules", ".idea", "out", ".gradle"}


def _iter_build_files(directory: str, max_depth: int = 4):
    base_depth = directory.rstrip(os.sep).count(os.sep)
    for cur, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        if cur.count(os.sep) - base_depth > max_depth:
            dirs[:] = []
            continue
        for name in BUILD_FILES:
            if name in files:
                yield os.path.join(cur, name), name


def discover(directory: str, max_depth: int = 4) -> list[Detection]:
    detections: list[Detection] = []
    for path, name in _iter_build_files(directory, max_depth):
        det = BUILD_FILES[name](path)
        if det:
            detections.append(det)
    return detections


# --- Spring Boot detection (jakarta vs javax is compile-critical) -----------
# Version starts with a digit so ${property} placeholders are skipped.
SPRING_BOOT_PATTERNS = [
    r"spring-boot-starter-parent</artifactId>\s*<version>\s*(\d[\w.\-]*)",
    r"<version>\s*(\d[\w.\-]*)\s*</version>\s*<artifactId>\s*spring-boot-starter-parent",
    r"<spring-boot\.version>\s*(\d[\w.\-]*)",
    r"spring-boot-dependencies</artifactId>\s*<version>\s*(\d[\w.\-]*)",
    r"org\.springframework\.boot[\"']?\s*\)?\s*version\s*[\"'](\d[\w.\-]*)",
    r"spring-boot-gradle-plugin:(\d[\w.\-]*)",
]


def detect_spring_boot(directory: str, max_depth: int = 4) -> Optional[dict]:
    """Return {version_major, raw, namespace, source} for the shallowest build
    file declaring Spring Boot, or None. namespace is 'jakarta' (Boot >= 3) or
    'javax' (Boot 2.x) — using the wrong one fails to compile."""
    best = None
    has_mvc = has_webflux = False
    for path, _ in _iter_build_files(directory, max_depth):
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue
        # Web-stack signals (any build file). `web(?![\w-])` matches the MVC starter
        # without matching `spring-boot-starter-webflux`.
        if re.search(r"spring-boot-starter-web(?![\w-])", text):
            has_mvc = True
        if re.search(r"spring-boot-starter-webflux", text):
            has_webflux = True
        for pat in SPRING_BOOT_PATTERNS:
            m = re.search(pat, text)
            if not m:
                continue
            raw = m.group(1)
            major = int(re.match(r"\d+", raw).group(0))
            depth = os.path.relpath(path, directory).count(os.sep)
            if best is None or depth < best[0]:
                best = (depth, major, raw, path)
            break
    if best is None:
        return None
    _, major, raw, src = best
    if has_mvc and has_webflux:
        web_stack = "mixed"
    elif has_webflux:
        web_stack = "webflux"
    elif has_mvc:
        web_stack = "mvc"
    else:
        web_stack = None
    return {
        "version_major": major,
        "raw": raw,
        "namespace": "jakarta" if major >= 3 else "javax",
        "source": src,
        "web_stack": web_stack,
    }


def choose_effective(detections: list[Detection], directory: str) -> tuple[Optional[int], Optional[str], str]:
    if not detections:
        return None, None, "No JDK version found in build files."
    # Prefer the shallowest build file (typically the root/parent module).
    def depth(d: Detection) -> int:
        return os.path.relpath(d.source_file, directory).count(os.sep)
    shallowest = min(depth(d) for d in detections)
    roots = [d for d in detections if depth(d) == shallowest]
    root = min(roots, key=lambda d: d.version)
    versions = {d.version for d in detections}
    note = f"Using root build file '{os.path.relpath(root.source_file, directory)}'."
    if len(versions) > 1:
        note += (f" WARNING: modules target different versions {sorted(versions)};"
                 f" code shared across modules must compile on the lowest ({min(versions)}).")
    return root.version, root.source_file, note


# --- Rendering -------------------------------------------------------------
def build_manifest(version: int) -> dict:
    available = [{"feature": label, "since": v, "jep": jep, "note": note}
                 for (v, jep, label, note) in FINAL_FEATURES if v <= version]
    too_new = [{"feature": label, "since": v, "jep": jep}
               for (v, jep, label, note) in FINAL_FEATURES if v > version]
    preview = [{"feature": label, "preview_through": v, "note": note}
               for (v, label, note) in PREVIEW_FEATURES]
    withdrawn = [{"feature": label, "note": note} for (label, note) in WITHDRAWN_FEATURES]
    return {
        "target_version": version,
        "is_lts": version in LTS_VERSIONS,
        "use_freely": available,
        "not_yet_available": too_new,
        "preview_opt_in_only": preview,
        "never_use": withdrawn,
    }


def render_markdown(result: Result) -> str:
    out: list[str] = []
    out.append("# JDK Target & Feature Manifest\n")
    if not result.detections:
        out.append("**No build file with a JDK version was found.** Ask the user "
                   "for the target JDK before choosing Java idioms.\n")
        return "\n".join(out)

    out.append("## Detected\n")
    for d in result.detections:
        out.append(f"- `{d.source_file}` ({d.build_tool}): `{d.raw_value}` -> JDK {d.version}")
    v = result.effective_version
    lts = " (LTS)" if v in LTS_VERSIONS else ""
    out.append(f"\n**Effective target: JDK {v}{lts}** - {result.note}\n")

    if result.spring:
        sp = result.spring
        out.append(f"**Spring Boot {sp['raw']} (major {sp['version_major']})** -> use "
                   f"`{sp['namespace']}.*` for validation/persistence/servlet imports "
                   f"(wrong namespace = compile error).\n")
        ws = sp.get("web_stack")
        if ws == "mixed":
            out.append("**Web stack: MIXED — both `spring-boot-starter-web` (MVC) and "
                       "`-webflux` are on the classpath.** Boot picks MVC/Tomcat at startup, so "
                       "`Flux`/`Mono` endpoints run on servlet threads (not a Reactor event loop). "
                       "Match the style the *touched* class already uses; do not assume the app is "
                       "fully reactive, and do not block a true event loop if a reactive path exists.\n")
        elif ws == "webflux":
            out.append("**Web stack: WebFlux (reactive)** — use `Mono`/`Flux` end to end; "
                       "never block the event loop (`block()`, blocking JDBC, `Thread.sleep`).\n")
        elif ws == "mvc":
            out.append("**Web stack: Spring MVC (blocking servlet)**.\n")

    m = build_manifest(v)
    out.append("## Use freely (final at this version)\n")
    for f in m["use_freely"]:
        tail = f" - {f['note']}" if f["note"] else ""
        out.append(f"- [J{f['since']}, {f['jep']}] {f['feature']}{tail}")

    if m["preview_opt_in_only"]:
        out.append("\n## Preview only - do NOT use unless user opts into --enable-preview\n")
        for f in m["preview_opt_in_only"]:
            out.append(f"- {f['feature']} ({f['note']})")

    if m["never_use"]:
        out.append("\n## Never use (withdrawn)\n")
        for f in m["never_use"]:
            out.append(f"- {f['feature']} - {f['note']}")

    if m["not_yet_available"]:
        out.append("\n## Not available below the target (do not use)\n")
        for f in m["not_yet_available"]:
            out.append(f"- [needs J{f['since']}, {f['jep']}] {f['feature']}")
    return "\n".join(out) + "\n"


def render_json(result: Result) -> str:
    payload = {
        "detections": [asdict(d) for d in result.detections],
        "effective_version": result.effective_version,
        "effective_source": result.effective_source,
        "note": result.note,
        "spring_boot": result.spring,
        "manifest": build_manifest(result.effective_version) if result.effective_version else None,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Detect target JDK and emit a feature manifest.")
    ap.add_argument("--dir", default=".", help="Project directory to scan (default: cwd).")
    ap.add_argument("--pom", help="Parse a specific pom.xml.")
    ap.add_argument("--gradle", help="Parse a specific Gradle build file.")
    ap.add_argument("--format", choices=("markdown", "json"), default="markdown")
    ap.add_argument("--max-depth", type=int, default=4, help="Max module-scan depth.")
    args = ap.parse_args(argv)

    result = Result()
    if args.pom or args.gradle:
        if args.pom:
            d = parse_pom(args.pom)
            if d:
                result.detections.append(d)
        if args.gradle:
            d = parse_gradle(args.gradle)
            if d:
                result.detections.append(d)
        base = os.path.dirname(args.pom or args.gradle) or "."
    else:
        result.detections = discover(args.dir, args.max_depth)
        base = args.dir

    v, src, note = choose_effective(result.detections, base)
    result.effective_version, result.effective_source, result.note = v, src, note
    result.spring = detect_spring_boot(base, args.max_depth)

    out = render_json(result) if args.format == "json" else render_markdown(result)
    sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
