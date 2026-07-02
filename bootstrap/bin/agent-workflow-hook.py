#!/usr/bin/env python3
"""PreToolUse/Stop hook for project-local agent workflow state.

The hook is intentionally conservative and stdlib-only. It only records state
when a repository already opted in with `.agent-workflows/` or an active
`.agent-workflows/touch-list.json`, so global hook registration does not create
files in every directory an agent visits.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

STATE_DIR = ".agent-workflows"
TOUCH_LIST = "touch-list.json"
LEDGER = "evidence-ledger.jsonl"
VALID_STATUSES = {"active", "closed", "paused"}
VALID_ENFORCEMENT = {"off", "warn", "strict"}
VALID_UNKNOWN_WRITE_POLICY = {"warn", "deny"}
SCOPE_FIELDS = ("files", "tables", "interfaces")

FILE_FIELD_NAMES = (
    "file_path",
    "filepath",
    "path",
    "target_file",
    "filename",
    "absolute_path",
)
COMMAND_FIELD_NAMES = ("command", "cmd", "script")
SQL_FIELD_NAMES = ("query", "sql", "statement")
INTERFACE_FIELD_NAMES = ("service", "interface", "method", "endpoint", "url")
WRITE_TOOL_NAMES = {
    "write",
    "edit",
    "multiedit",
    "apply_patch",
    "notebookedit",
    "update_file",
    "create_file",
}


def load_stdin_json() -> dict[str, Any]:
    if sys.stdin.isatty():
        return {}
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}
    return data if isinstance(data, dict) else {"payload": data}


def normalize_event(value: object) -> str:
    text = str(value or "").lower()
    return re.sub(r"[^a-z0-9]", "", text)


def event_name(payload: dict[str, Any], override: str | None) -> str:
    if override:
        return normalize_event(override)
    for key in ("hook_event_name", "event", "hook", "type"):
        if payload.get(key):
            return normalize_event(payload[key])
    return ""


def pick_mapping(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def tool_input(payload: dict[str, Any]) -> dict[str, Any]:
    for key in ("tool_input", "input", "arguments", "params"):
        mapping = pick_mapping(payload.get(key))
        if mapping:
            return mapping
    return {}


def tool_name(payload: dict[str, Any]) -> str:
    for key in ("tool_name", "tool", "name"):
        if payload.get(key):
            return str(payload[key])
    return ""


def cwd_from_payload(payload: dict[str, Any]) -> Path:
    for key in ("cwd", "workspace_root", "working_directory", "repo_root"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return Path(value).expanduser()
    return Path.cwd()


def git_root(cwd: Path) -> Path:
    try:
        result = subprocess.run(
            ["git", "-C", str(cwd), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=2,
        )
    except Exception:
        return cwd.resolve()
    root = result.stdout.strip()
    return Path(root).resolve() if result.returncode == 0 and root else cwd.resolve()


def workflow_root(cwd: Path) -> Path:
    """Use the nearest opted-in workflow root, falling back to the git root."""
    root = git_root(cwd)
    try:
        current = cwd.resolve()
    except OSError:
        return root
    while True:
        if (current / STATE_DIR).exists():
            return current
        if current == root or current.parent == current:
            return root
        current = current.parent


def load_touch_list(repo: Path) -> dict[str, Any] | None:
    path = repo / STATE_DIR / TOUCH_LIST
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "version": 1,
            "status": "active",
            "enforcement": "strict",
            "files": [],
            "_invalid": f"cannot parse {path}",
        }
    return data if isinstance(data, dict) else None


def is_absolute_pattern(value: str) -> bool:
    return Path(value).is_absolute() or bool(re.match(r"^[A-Za-z]:[/\\]", value))


def validate_touch_list(touch: dict[str, Any] | None) -> list[str]:
    if touch is None:
        return ["missing touch-list.json"]
    errors: list[str] = []
    if touch.get("_invalid"):
        errors.append(str(touch["_invalid"]))
    if touch.get("version") != 1:
        errors.append("version must be 1")
    status = str(touch.get("status", "active")).lower()
    if status not in VALID_STATUSES:
        errors.append(f"status must be one of {sorted(VALID_STATUSES)}")
    enforcement = str(touch.get("enforcement", "warn")).lower()
    if enforcement not in VALID_ENFORCEMENT:
        errors.append(f"enforcement must be one of {sorted(VALID_ENFORCEMENT)}")
    unknown = str(touch.get("unknown_write_policy", "warn")).lower()
    if unknown not in VALID_UNKNOWN_WRITE_POLICY:
        errors.append(f"unknown_write_policy must be one of {sorted(VALID_UNKNOWN_WRITE_POLICY)}")
    for field in SCOPE_FIELDS:
        value = touch.get(field, [])
        if not isinstance(value, list):
            errors.append(f"{field} must be a list")
            continue
        for item in value:
            if not isinstance(item, str) or not item.strip():
                errors.append(f"{field} entries must be non-empty strings")
                continue
            normalized = item.replace("\\", "/").strip()
            if normalized.startswith("../") or normalized == "..":
                errors.append(f"{field} entry must not escape repo: {item}")
            if field == "files" and is_absolute_pattern(item):
                errors.append(f"files entry must be repo-relative, not absolute: {item}")
    if status == "active":
        has_scope = any(normalize_patterns(touch.get(field)) for field in SCOPE_FIELDS)
        if enforcement in {"warn", "strict"} and not has_scope:
            errors.append("active touch-list must include at least one files/tables/interfaces entry")
        if not str(touch.get("criterion", "")).strip():
            errors.append("active touch-list must include criterion")
    return dedupe(errors)


def state_enabled(repo: Path, touch: dict[str, Any] | None) -> bool:
    return touch is not None or (repo / STATE_DIR).is_dir()


def should_enforce(touch: dict[str, Any] | None) -> bool:
    if not touch:
        return False
    return str(touch.get("status", "active")).lower() == "active"


def enforcement_mode(touch: dict[str, Any] | None) -> str:
    mode = str((touch or {}).get("enforcement", "warn")).lower()
    return mode if mode in {"off", "warn", "strict"} else "warn"


def append_ledger(repo: Path, event: dict[str, Any]) -> None:
    state = repo / STATE_DIR
    state.mkdir(parents=True, exist_ok=True)
    event.setdefault("ts", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    path = state / LEDGER
    with path.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")


def read_ledger(repo: Path, limit: int = 5) -> list[dict[str, Any]]:
    path = repo / STATE_DIR / LEDGER
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    for line in lines[-limit:]:
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            data = {"unparseable": line}
        rows.append(data if isinstance(data, dict) else {"payload": data})
    return rows


def walk_values(value: object) -> list[object]:
    out: list[object] = []
    if isinstance(value, dict):
        for child in value.values():
            out.extend(walk_values(child))
    elif isinstance(value, list):
        for child in value:
            out.extend(walk_values(child))
    else:
        out.append(value)
    return out


def string_field_values(mapping: dict[str, Any], names: tuple[str, ...]) -> list[str]:
    found: list[str] = []

    def visit(value: object) -> None:
        if not isinstance(value, dict):
            return
        for key, child in value.items():
            if key.lower() in names and isinstance(child, str) and child.strip():
                found.append(child.strip())
            if isinstance(child, (dict, list)):
                if isinstance(child, dict):
                    visit(child)
                else:
                    for item in child:
                        visit(item)

    visit(mapping)
    return found


def command_values(mapping: dict[str, Any]) -> list[str]:
    return string_field_values(mapping, COMMAND_FIELD_NAMES)


def patch_paths(command: str) -> list[str]:
    paths: list[str] = []
    patterns = (
        r"^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$",
        r"^---\s+(?:a/)?(.+)$",
        r"^\+\+\+\s+(?:b/)?(.+)$",
    )
    for line in command.splitlines():
        for pat in patterns:
            match = re.match(pat, line.strip())
            if match:
                value = match.group(1).strip()
                if value != "/dev/null":
                    paths.append(value)
    return paths


def shell_redirection_paths(command: str) -> list[str]:
    paths: list[str] = []
    # Best-effort only. Complex shell parsing belongs in tests or explicit
    # touch-list declarations, not in a global hook.
    for match in re.finditer(r"(?:>|>>|Out-File\s+-FilePath|Set-Content\s+-Path|Add-Content\s+-Path)\s+(['\"]?)([^'\"\s|;&]+)\1", command, re.I):
        paths.append(match.group(2))
    return paths


def file_targets(tool: str, mapping: dict[str, Any]) -> list[str]:
    targets = string_field_values(mapping, FILE_FIELD_NAMES)
    for command in command_values(mapping):
        targets.extend(patch_paths(command))
        targets.extend(shell_redirection_paths(command))
    return dedupe(targets)


def sql_targets(mapping: dict[str, Any]) -> list[str]:
    targets: list[str] = []
    for sql in string_field_values(mapping, SQL_FIELD_NAMES):
        if not re.search(r"\b(insert|update|delete|merge|drop|truncate|alter|create)\b", sql, re.I):
            continue
        for match in re.finditer(r"\b(?:into|update|from|table|alter\s+table|truncate\s+table)\s+([A-Za-z_][\w.$-]*)", sql, re.I):
            targets.append(match.group(1))
    return dedupe(targets)


def interface_targets(mapping: dict[str, Any]) -> list[str]:
    return dedupe(string_field_values(mapping, INTERFACE_FIELD_NAMES))


def dedupe(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        norm = value.strip()
        if norm and norm not in seen:
            out.append(norm)
            seen.add(norm)
    return out


def looks_like_write(tool: str, mapping: dict[str, Any]) -> bool:
    compact = re.sub(r"[^a-z0-9]", "", tool.lower())
    if compact in WRITE_TOOL_NAMES:
        return True
    if "write" in compact or "edit" in compact or "patch" in compact:
        return True
    for command in command_values(mapping):
        if re.search(
            r"(\*\*\* (?:Add|Update|Delete) File:|>|>>|\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|rm|mv|cp)\b)",
            command,
            re.I,
        ):
            return True
    return bool(sql_targets(mapping))


def normalize_patterns(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(v).replace("\\", "/").strip().lstrip("./") for v in values if str(v).strip()]


def path_relation(repo: Path, raw: str) -> tuple[str | None, str | None]:
    raw = raw.strip().strip("'\"")
    if not raw:
        return None, None
    path = Path(raw).expanduser()
    candidate = path if path.is_absolute() else repo / path
    try:
        resolved = candidate.resolve()
        rel = resolved.relative_to(repo.resolve()).as_posix()
    except (OSError, ValueError):
        return None, str(candidate)
    return rel, str(resolved)


def pattern_matches(rel: str, pattern: str) -> bool:
    pat = pattern.replace("\\", "/").strip().lstrip("./")
    if not pat:
        return False
    if pat in {STATE_DIR, f"{STATE_DIR}/**"}:
        return rel == STATE_DIR or rel.startswith(f"{STATE_DIR}/")
    if any(ch in pat for ch in "*?[]"):
        return fnmatch.fnmatchcase(rel, pat)
    return rel == pat or rel.startswith(pat.rstrip("/") + "/")


def allowed_file(repo: Path, raw: str, patterns: list[str]) -> tuple[bool, str]:
    rel, absolute = path_relation(repo, raw)
    if rel is None:
        return False, f"target outside repo: {raw}"
    if rel == STATE_DIR or rel.startswith(f"{STATE_DIR}/"):
        return True, rel
    if not patterns:
        return False, f"no file touch-list entries allow {rel}"
    if any(pattern_matches(rel, pat) for pat in patterns):
        return True, rel
    return False, rel


def allowed_name(raw: str, patterns: list[str]) -> bool:
    value = raw.strip()
    return any(fnmatch.fnmatchcase(value, pat) for pat in patterns)


def ledger_base(payload: dict[str, Any], repo: Path, event: str, tool: str) -> dict[str, Any]:
    return {
        "evidence_kind": "workflow_hook",
        "event": event,
        "repo": str(repo),
        "session_id": payload.get("session_id") or payload.get("conversation_id"),
        "tool": tool,
    }


def deny(message: str) -> int:
    response = {
        "decision": "deny",
        "permissionDecision": "deny",
        "reason": message,
        "message": message,
    }
    print(json.dumps(response, ensure_ascii=False))
    print(message, file=sys.stderr)
    return 2


def check_pretool(payload: dict[str, Any], repo: Path, touch: dict[str, Any] | None) -> int:
    tool = tool_name(payload)
    mapping = tool_input(payload)
    if not state_enabled(repo, touch):
        return 0

    mode = enforcement_mode(touch)
    validation_errors = validate_touch_list(touch)
    files = normalize_patterns((touch or {}).get("files"))
    tables = normalize_patterns((touch or {}).get("tables"))
    interfaces = normalize_patterns((touch or {}).get("interfaces"))
    base = ledger_base(payload, repo, "PreToolUse", tool)

    if should_enforce(touch) and validation_errors:
        reason = "invalid touch-list: " + "; ".join(validation_errors)
        append_ledger(repo, {**base, "decision": "deny", "reason": reason})
        return deny(reason)

    if not should_enforce(touch) or mode == "off":
        append_ledger(repo, {**base, "decision": "observe"})
        return 0

    failures: list[str] = []
    file_results: list[dict[str, Any]] = []
    for raw in file_targets(tool, mapping):
        ok, detail = allowed_file(repo, raw, files)
        file_results.append({"target": raw, "resolved": detail, "allowed": ok})
        if not ok:
            failures.append(f"file {detail}")

    table_targets = sql_targets(mapping)
    for target in table_targets:
        if tables and not allowed_name(target, tables):
            failures.append(f"table {target}")
        elif not tables:
            failures.append(f"table {target} (no table touch-list entries)")

    rpc_targets = interface_targets(mapping)
    for target in rpc_targets:
        if interfaces and not allowed_name(target, interfaces):
            failures.append(f"interface {target}")

    unknown_write = looks_like_write(tool, mapping) and not (file_results or table_targets or rpc_targets)
    if unknown_write and str((touch or {}).get("unknown_write_policy", "warn")).lower() == "deny":
        failures.append("unknown write target")

    targets = {
        "files": file_results,
        "tables": table_targets,
        "interfaces": rpc_targets,
        "unknown_write": unknown_write,
    }
    if failures:
        decision = "deny" if mode == "strict" else "warn"
        append_ledger(repo, {**base, "decision": decision, "reason": "; ".join(failures), "targets": targets})
        if mode == "strict":
            return deny(
                "agent workflow touch-list denied target(s): "
                + "; ".join(failures)
                + f". Update {STATE_DIR}/{TOUCH_LIST} or narrow the tool call."
            )
        return 0

    append_ledger(repo, {**base, "decision": "allow", "targets": targets})
    return 0


def check_stop(payload: dict[str, Any], repo: Path, touch: dict[str, Any] | None) -> int:
    if not state_enabled(repo, touch):
        return 0
    append_ledger(
        repo,
        {
            **ledger_base(payload, repo, "Stop", tool_name(payload)),
            "decision": "observe",
            "status": payload.get("status") or payload.get("stop_reason"),
        },
    )
    return 0


def repo_from_arg(value: str | None) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    return workflow_root(Path.cwd())


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def cmd_init(args: argparse.Namespace) -> int:
    repo = repo_from_arg(args.repo)
    state = repo / STATE_DIR
    path = state / TOUCH_LIST
    if path.exists() and not args.force:
        print(f"{path} already exists; use --force to replace", file=sys.stderr)
        return 1
    data: dict[str, Any] = {
        "version": 1,
        "status": "active",
        "enforcement": args.enforcement,
        "unknown_write_policy": args.unknown_write_policy,
        "files": normalize_patterns(args.files or []),
        "tables": normalize_patterns(args.tables or []),
        "interfaces": normalize_patterns(args.interfaces or []),
        "criterion": args.criterion.strip(),
    }
    errors = validate_touch_list(data)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    write_json(path, data)
    append_ledger(repo, {"event": "Init", "decision": "observe", "evidence_kind": "workflow_hook", "repo": str(repo)})
    print(f"created {path}")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    repo = repo_from_arg(args.repo)
    touch = load_touch_list(repo)
    errors = validate_touch_list(touch)
    if errors:
        print(f"{repo / STATE_DIR / TOUCH_LIST}: invalid")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"{repo / STATE_DIR / TOUCH_LIST}: ok")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    repo = repo_from_arg(args.repo)
    touch = load_touch_list(repo)
    if touch is None:
        print(f"state=absent repo={repo}")
        return 0
    errors = validate_touch_list(touch)
    print(f"repo={repo}")
    print(f"state=present status={str(touch.get('status', 'active')).lower()} enforcement={enforcement_mode(touch)}")
    print("scope="
          f"files:{len(normalize_patterns(touch.get('files')))} "
          f"tables:{len(normalize_patterns(touch.get('tables')))} "
          f"interfaces:{len(normalize_patterns(touch.get('interfaces')))}")
    print(f"criterion={str(touch.get('criterion', '')).strip() or '(missing)'}")
    print("ledger_note=workflow hook evidence proves scope/process only; it is not business verification")
    if errors:
        print("valid=false")
        for error in errors:
            print(f"error={error}")
        return 1
    print("valid=true")
    for row in read_ledger(repo, limit=args.limit):
        print(
            "ledger="
            + json.dumps(
                {
                    "event": row.get("event"),
                    "decision": row.get("decision"),
                    "reason": row.get("reason"),
                    "ts": row.get("ts"),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
    return 0


def cmd_close(args: argparse.Namespace) -> int:
    repo = repo_from_arg(args.repo)
    touch = load_touch_list(repo)
    if touch is None:
        print(f"{repo / STATE_DIR / TOUCH_LIST} does not exist", file=sys.stderr)
        return 1
    touch["status"] = "closed"
    touch["closed_reason"] = args.reason.strip()
    touch["closed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    write_json(repo / STATE_DIR / TOUCH_LIST, touch)
    append_ledger(
        repo,
        {
            "event": "Close",
            "decision": "observe",
            "evidence_kind": "workflow_hook",
            "repo": str(repo),
            "reason": args.reason.strip(),
        },
    )
    print(f"closed {repo / STATE_DIR / TOUCH_LIST}")
    return 0


def add_cli(parser: argparse.ArgumentParser) -> None:
    sub = parser.add_subparsers(dest="command")
    init = sub.add_parser("init", help="create .agent-workflows/touch-list.json")
    init.add_argument("--repo", help="project root; default is current repo/workflow root")
    init.add_argument("--files", action="append", default=[], help="repo-relative file glob; repeatable")
    init.add_argument("--tables", action="append", default=[], help="table glob; repeatable")
    init.add_argument("--interfaces", action="append", default=[], help="interface/service glob; repeatable")
    init.add_argument("--criterion", required=True, help="machine-checkable completion criterion")
    init.add_argument("--enforcement", choices=sorted(VALID_ENFORCEMENT), default="strict")
    init.add_argument("--unknown-write-policy", choices=sorted(VALID_UNKNOWN_WRITE_POLICY), default="warn")
    init.add_argument("--force", action="store_true", help="replace an existing touch-list")
    init.set_defaults(func=cmd_init)

    status = sub.add_parser("status", help="show current workflow state")
    status.add_argument("--repo", help="project root; default is current repo/workflow root")
    status.add_argument("--limit", type=int, default=5, help="ledger rows to summarize")
    status.set_defaults(func=cmd_status)

    validate = sub.add_parser("validate", help="validate touch-list.json")
    validate.add_argument("--repo", help="project root; default is current repo/workflow root")
    validate.set_defaults(func=cmd_validate)

    close = sub.add_parser("close", help="mark the current touch-list closed")
    close.add_argument("--repo", help="project root; default is current repo/workflow root")
    close.add_argument("--reason", default="complete", help="close reason")
    close.set_defaults(func=cmd_close)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", help="override hook event name for tests/manual runs")
    add_cli(parser)
    args = parser.parse_args()

    if hasattr(args, "func"):
        return args.func(args)

    payload = load_stdin_json()
    event = event_name(payload, args.event)
    repo = workflow_root(cwd_from_payload(payload))
    touch = load_touch_list(repo)

    if event == "pretooluse":
        return check_pretool(payload, repo, touch)
    if event == "stop":
        return check_stop(payload, repo, touch)
    if state_enabled(repo, touch):
        append_ledger(repo, {**ledger_base(payload, repo, event or "unknown", tool_name(payload)), "decision": "observe"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
