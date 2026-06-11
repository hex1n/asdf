#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
SRC="$SCRIPT_DIR/codex-prompts"
DST="${HOME:?HOME is not set}/.codex/prompts"

if [ ! -d "$SRC" ]; then
  echo "codex-prompts directory not found next to install.sh" >&2
  exit 1
fi

mkdir -p "$DST"

for prompt in "$SRC"/*.md; do
  [ -e "$prompt" ] || continue
  name=$(basename "$prompt")
  target="$DST/$name"
  if [ -e "$target" ] && [ ! -e "$target.bak" ]; then
    cp "$target" "$target.bak"
    echo "backup:    $name -> $name.bak"
  fi
  cp "$prompt" "$target"
  echo "installed: $name"
done

for stale_name in claude-ask.md claude-review.md claude-task.md claude-resume.md claude-fix.md; do
  stale_prompt="$DST/$stale_name"
  if [ -e "$stale_prompt" ]; then
    [ -e "$stale_prompt.bak" ] || cp "$stale_prompt" "$stale_prompt.bak"
    rm "$stale_prompt"
    echo "removed stale: $stale_name -> $stale_name.bak"
  fi
done

if [ "${ANTHROPIC_API_KEY:-}" ]; then
  echo "warning: ANTHROPIC_API_KEY is set in this environment. 'claude --print' will bill it as API usage instead of your subscription. Remove the variable before using the cc-* prompts." >&2
fi

echo ""
echo "Codex side installed. Prompts available in Codex as /cc-ask (etc.) after restarting Codex."
echo ""
echo "Claude side: run these inside Claude Code:"
quoted_dir=$(printf "%s" "$SCRIPT_DIR" | sed "s/'/'\\\\''/g")
echo "  /plugin marketplace add '$quoted_dir'"
echo "  /plugin install cx@claude-codex-bridge"
