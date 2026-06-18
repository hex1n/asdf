#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
PY_ROOT=$ROOT
if command -v cygpath >/dev/null 2>&1; then
  PY_ROOT=$(cygpath -w "$ROOT")
fi

if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; sys.exit(0)' >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1 && python -c 'import sys; sys.exit(0)' >/dev/null 2>&1; then
  PYTHON=python
else
  echo "python 3 CLI not found on PATH" >&2
  exit 1
fi

"$PYTHON" - "$PY_ROOT" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
marketplace_path = root / ".agents" / "plugins" / "marketplace.json"
plugin_path = root / "plugins" / "claude-codex-bridge" / ".codex-plugin" / "plugin.json"
claude_marketplace_path = root / ".claude-plugin" / "marketplace.json"
claude_plugin_path = root / "plugins" / "cx" / ".claude-plugin" / "plugin.json"
skills_root = root / "plugins" / "claude-codex-bridge" / "skills"
commands_root = root / "plugins" / "cx" / "commands"
catalog_path = root / "plugins" / "cx" / "scripts" / "bridge-catalog.json"
codex_catalog_path = root / "plugins" / "claude-codex-bridge" / "scripts" / "bridge-catalog.json"

for path in (marketplace_path, plugin_path, claude_marketplace_path, claude_plugin_path, catalog_path, codex_catalog_path):
    if not path.exists():
        raise SystemExit(f"missing required file: {path}")

marketplace = json.loads(marketplace_path.read_text(encoding="utf8"))
plugin = json.loads(plugin_path.read_text(encoding="utf8"))
claude_marketplace = json.loads(claude_marketplace_path.read_text(encoding="utf8"))
claude_plugin = json.loads(claude_plugin_path.read_text(encoding="utf8"))
catalog = json.loads(catalog_path.read_text(encoding="utf8"))
codex_catalog = json.loads(codex_catalog_path.read_text(encoding="utf8"))

if marketplace.get("name") != "claude-codex-bridge":
    raise SystemExit("marketplace name must be claude-codex-bridge")

entries = marketplace.get("plugins")
if not isinstance(entries, list):
    raise SystemExit("marketplace plugins must be a list")

entry = next((item for item in entries if item.get("name") == "claude-codex-bridge"), None)
if not entry:
    raise SystemExit("marketplace must contain claude-codex-bridge plugin entry")

if entry.get("source", {}).get("path") != "./plugins/claude-codex-bridge":
    raise SystemExit("marketplace source path must be ./plugins/claude-codex-bridge")

if plugin.get("name") != "claude-codex-bridge":
    raise SystemExit("plugin name must be claude-codex-bridge")

if plugin.get("skills") != "./skills/":
    raise SystemExit("plugin skills path must be ./skills/")

if claude_marketplace.get("name") != "claude-codex-bridge":
    raise SystemExit("Claude marketplace name must be claude-codex-bridge")

claude_entries = claude_marketplace.get("plugins")
if not isinstance(claude_entries, list):
    raise SystemExit("Claude marketplace plugins must be a list")

claude_entry = next((item for item in claude_entries if item.get("name") == "cx"), None)
if not claude_entry:
    raise SystemExit("Claude marketplace must contain cx plugin entry")

if claude_entry.get("source") != "./plugins/cx":
    raise SystemExit("Claude marketplace source must be ./plugins/cx")

if "no Node runtime" in claude_entry.get("description", ""):
    raise SystemExit("Claude marketplace description must not claim no Node runtime")

if claude_plugin.get("name") != "cx":
    raise SystemExit("Claude plugin name must be cx")

if catalog != codex_catalog:
    raise SystemExit("Claude and Codex bridge catalogs must match")

if catalog.get("schemaVersion") != 1:
    raise SystemExit("bridge catalog schemaVersion must be 1")

profiles = catalog.get("profiles")
session_sources = catalog.get("sessionSources")
entrypoints = catalog.get("entrypoints")
if not isinstance(profiles, dict):
    raise SystemExit("bridge catalog must define profiles")
if not isinstance(session_sources, dict):
    raise SystemExit("bridge catalog must define sessionSources")
if not isinstance(entrypoints, dict):
    raise SystemExit("bridge catalog must define entrypoints")

claude_entrypoints = entrypoints.get("claude")
cx_entrypoints = entrypoints.get("cx")
if not isinstance(claude_entrypoints, dict) or not claude_entrypoints:
    raise SystemExit("bridge catalog must define entrypoints.claude")
if not isinstance(cx_entrypoints, dict) or not cx_entrypoints:
    raise SystemExit("bridge catalog must define entrypoints.cx")

for side in ("claude", "cx"):
    side_profiles = profiles.get(side)
    if not isinstance(side_profiles, dict) or not side_profiles:
        raise SystemExit(f"bridge catalog must define profiles.{side}")
    side_sources = session_sources.get(side)
    if not isinstance(side_sources, list):
        raise SystemExit(f"bridge catalog must define sessionSources.{side}")
    unknown_sources = set(side_sources) - set(side_profiles)
    if unknown_sources:
        raise SystemExit(f"sessionSources.{side} references unknown profiles: {sorted(unknown_sources)}")
    side_entrypoints = entrypoints.get(side)
    for name, spec in side_entrypoints.items():
        profile_name = spec.get("profile")
        if profile_name and profile_name not in side_profiles:
            raise SystemExit(f"entrypoints.{side}.{name} references unknown profile: {profile_name}")
        if spec.get("registerSession") and profile_name not in side_sources:
            raise SystemExit(f"entrypoints.{side}.{name} registers sessions but {profile_name} is missing from sessionSources.{side}")
    for profile_name, profile in side_profiles.items():
        if not isinstance(profile, dict):
            raise SystemExit(f"profiles.{side}.{profile_name} must be an object")
        for key in ("baseArgs", "modeArgs"):
            if not isinstance(profile.get(key), list):
                raise SystemExit(f"profiles.{side}.{profile_name}.{key} must be a list")
            if not all(isinstance(item, str) for item in profile[key]):
                raise SystemExit(f"profiles.{side}.{profile_name}.{key} must contain strings")
        actions = profile.get("actions")
        if not isinstance(actions, dict) or not actions:
            raise SystemExit(f"profiles.{side}.{profile_name}.actions must be a non-empty object")
        for action, args in actions.items():
            if not isinstance(args, list) or not all(isinstance(item, str) for item in args):
                raise SystemExit(f"profiles.{side}.{profile_name}.actions.{action} must be a string list")
        session_actions = {"work", "resume"} & set(actions)
        if session_actions and profile_name not in side_sources:
            raise SystemExit(
                f"profiles.{side}.{profile_name} supports session-producing actions {sorted(session_actions)} "
                f"but is missing from sessionSources.{side}"
            )

def profile_literals(side, profile_name, action):
    profile = profiles[side][profile_name]
    values = []
    values.extend(profile.get("baseArgs", []))
    values.extend(profile.get("actions", {}).get(action, []))
    values.extend(profile.get("modeArgs", []))
    return [
        item for item in values
        if item != "-" and not item.startswith("{")
    ]

def require_profile_literals(text, side, profile_name, action, label):
    for item in profile_literals(side, profile_name, action):
        if len(item) <= 2:
            continue
        if item not in text:
            raise SystemExit(f"{label} must include catalog literal for {side}.{profile_name}.{action}: {item}")

for name, spec in claude_entrypoints.items():
    if not isinstance(spec, dict) or spec.get("type") not in {"direct", "task", "lookup"}:
        raise SystemExit(f"invalid Claude entrypoint spec: {name}")
    profile_name = spec.get("profile")
    skill_name = f"claude-{name}"
    skill = skills_root / skill_name / "SKILL.md"
    if not skill.exists():
        raise SystemExit(f"missing skill: {skill}")
    text = skill.read_text(encoding="utf8")
    if f"name: {skill_name}" not in text:
        raise SystemExit(f"skill {skill_name} must declare name: {skill_name}")
    if spec.get("type") in {"task", "lookup"}:
        if "--args-file" not in text:
            raise SystemExit(f"skill {skill_name} must pass arguments through --args-file")
        if profile_name and f"--mode {profile_name}" not in text:
            raise SystemExit(f"skill {skill_name} must select catalog profile with --mode {profile_name}")
    if spec.get("type") == "direct" and profile_name:
        if "bridge-companion.mjs" not in text:
            raise SystemExit(f"skill {skill_name} must call bridge-companion.mjs")
        if profile_name == "review":
            if "claude review" not in text:
                raise SystemExit(f"skill {skill_name} must call companion review")
            if "--focus-file" not in text:
                raise SystemExit(f"skill {skill_name} must pass review focus through --focus-file")
        else:
            if f"claude direct --mode {profile_name}" not in text:
                raise SystemExit(f"skill {skill_name} must call companion direct with --mode {profile_name}")
            if "--prompt-file" not in text:
                raise SystemExit(f"skill {skill_name} must pass direct prompts through --prompt-file")
    if spec.get("registerSession") and spec.get("type") == "direct" and "session tracking" not in text:
        raise SystemExit(f"skill {skill_name} must say companion owns session tracking")
    if spec.get("registerSession") and spec.get("type") != "direct" and "register-session" not in text:
        raise SystemExit(f"skill {skill_name} must register sessions through the companion")

for name, spec in cx_entrypoints.items():
    if not isinstance(spec, dict) or spec.get("type") not in {"direct", "task", "lookup"}:
        raise SystemExit(f"invalid Codex entrypoint spec: {name}")
    profile_name = spec.get("profile")
    command = commands_root / f"{name}.md"
    if not command.exists():
        raise SystemExit(f"missing Claude command: {command}")
    if spec.get("type") in {"task", "lookup"}:
        text = command.read_text(encoding="utf8")
        if 'scripts/bridge-companion.mjs" cx ' not in text:
            raise SystemExit(f"Claude command {name} must call bridge-companion.mjs")
        if "--args-file" not in text:
            raise SystemExit(f"Claude command {name} must pass arguments through --args-file")
        if profile_name and f"--mode {profile_name}" not in text:
            raise SystemExit(f"Claude command {name} must select catalog profile with --mode {profile_name}")
    if spec.get("type") == "direct" and profile_name:
        text = command.read_text(encoding="utf8")
        if 'scripts/bridge-companion.mjs" cx ' not in text:
            raise SystemExit(f"Claude command {name} must call bridge-companion.mjs")
        if profile_name == "review":
            if "cx review" not in text:
                raise SystemExit(f"Claude command {name} must call companion review")
            if "--focus-file" not in text:
                raise SystemExit(f"Claude command {name} must pass review focus through --focus-file")
        else:
            if f"cx direct --mode {profile_name}" not in text:
                raise SystemExit(f"Claude command {name} must call companion direct with --mode {profile_name}")
            if "--prompt-file" not in text:
                raise SystemExit(f"Claude command {name} must pass direct prompts through --prompt-file")

script_paths = [
    root / "scripts" / "bridge-companion.mjs",
    root / "plugins" / "cx" / "scripts" / "bridge-companion.mjs",
    root / "plugins" / "claude-codex-bridge" / "scripts" / "bridge-companion.mjs",
]
for script_path in script_paths:
    if not script_path.exists():
        raise SystemExit(f"missing companion script: {script_path}")

print("manifest validation passed")
PY

if ! command -v node >/dev/null 2>&1; then
  echo "node CLI not found on PATH" >&2
  exit 1
fi

node -e '
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 18 || (major === 18 && minor < 18)) {
  console.error(`Node.js 18.18+ required, found ${process.versions.node}`);
  process.exit(1);
}
'

node --check "$ROOT/scripts/bridge-companion.mjs"
node --check "$ROOT/plugins/cx/scripts/bridge-companion.mjs"
node --check "$ROOT/plugins/claude-codex-bridge/scripts/bridge-companion.mjs"
cmp "$ROOT/plugins/cx/scripts/bridge-companion.mjs" "$ROOT/plugins/claude-codex-bridge/scripts/bridge-companion.mjs" >/dev/null
cmp "$ROOT/plugins/cx/scripts/bridge-catalog.json" "$ROOT/plugins/claude-codex-bridge/scripts/bridge-catalog.json" >/dev/null
node --test "$ROOT/tests"/*.test.mjs

if [ "${1:-}" = "--installed" ]; then
  "$PYTHON" - "$PY_ROOT" <<'PY'
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
plugin = json.loads((root / "plugins" / "claude-codex-bridge" / ".codex-plugin" / "plugin.json").read_text(encoding="utf8"))
catalog = json.loads((root / "plugins" / "claude-codex-bridge" / "scripts" / "bridge-catalog.json").read_text(encoding="utf8"))
expected_version = plugin["version"]

def run(command):
    return subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

plugin_list = json.loads(run(["codex", "plugin", "list", "--json"]).stdout)
installed = plugin_list.get("installed", [])
entry = next((item for item in installed if item.get("pluginId") == "claude-codex-bridge@claude-codex-bridge"), None)
if not entry:
    raise SystemExit("claude-codex-bridge plugin is not installed")
if not entry.get("installed") or not entry.get("enabled"):
    raise SystemExit("claude-codex-bridge plugin must be installed and enabled")
if entry.get("version") != expected_version:
    raise SystemExit(f"installed plugin version {entry.get('version')} != source version {expected_version}")

prompt = run(["codex", "debug", "prompt-input", "test"]).stdout
for name in catalog["entrypoints"]["claude"]:
    skill = f"claude-{name}"
    if skill not in prompt:
        raise SystemExit(f"installed prompt is missing {skill}")

for forbidden in ("cc-ask", "cc-task", "cc-resume", "cc-review", "gpt-5.3-codex-spark", "|spark"):
    if forbidden in prompt:
        raise SystemExit(f"installed prompt still contains deprecated text: {forbidden}")

match = re.search(r"`r\d+` = `([^`]+/\.codex/plugins/cache/claude-codex-bridge/claude-codex-bridge/[^`]+/skills)`", prompt)
if match:
    installed_root = Path(match.group(1)).parent
else:
    source_path = entry.get("source", {}).get("path")
    if not source_path:
        raise SystemExit("cannot locate installed plugin root")
    installed_root = Path(source_path)

installed_companion = installed_root / "scripts" / "bridge-companion.mjs"
source_companion = root / "plugins" / "claude-codex-bridge" / "scripts" / "bridge-companion.mjs"
installed_catalog = installed_root / "scripts" / "bridge-catalog.json"
source_catalog = root / "plugins" / "claude-codex-bridge" / "scripts" / "bridge-catalog.json"
if not installed_companion.exists():
    raise SystemExit(f"installed companion missing: {installed_companion}")
if not installed_catalog.exists():
    raise SystemExit(f"installed catalog missing: {installed_catalog}")

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if sha256(installed_companion) != sha256(source_companion):
    raise SystemExit("installed companion does not match source companion")
if sha256(installed_catalog) != sha256(source_catalog):
    raise SystemExit("installed catalog does not match source catalog")

for path in installed_root.rglob("*"):
    if not path.is_file() or path.suffix not in {".md", ".mjs", ".json"}:
        continue
    text = path.read_text(encoding="utf8", errors="ignore")
    for forbidden in ("cc-ask", "cc-task", "cc-resume", "cc-review", "gpt-5.3-codex-spark", "|spark"):
        if forbidden in text:
            raise SystemExit(f"installed file {path} contains deprecated text: {forbidden}")

print(f"Codex installed validation passed: {entry['pluginId']} {expected_version} at {installed_root}")
PY
fi
