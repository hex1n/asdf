#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
CODEX_HOME="${CODEX_HOME:-${HOME:?HOME is not set}/.codex}"
PLUGIN_NAME="claude-codex-bridge"
MARKETPLACE_NAME="claude-codex-bridge"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found on PATH" >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/.agents/plugins/marketplace.json" ]; then
  echo "Codex marketplace manifest not found: $SCRIPT_DIR/.agents/plugins/marketplace.json" >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/plugins/$PLUGIN_NAME/.codex-plugin/plugin.json" ]; then
  echo "Codex plugin manifest not found: $SCRIPT_DIR/plugins/$PLUGIN_NAME/.codex-plugin/plugin.json" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "warning: node CLI not found on PATH. Claude-side /cx:work, /cx:resume, /cx:status, /cx:result, and /cx:cancel require Node.js 18.18+." >&2
fi

cleanup_path() {
  path=$1
  label=$2
  if [ -L "$path" ]; then
    rm "$path"
    echo "removed legacy $label: $path"
  elif [ -e "$path" ]; then
    backup="$path.bak"
    mv "$path" "$backup"
    echo "backup legacy $label: $path -> $backup"
  fi
}

for prompt_name in cc-ask.md cc-review.md cc-task.md cc-resume.md claude-ask.md claude-review.md claude-task.md claude-resume.md claude-fix.md claude-consult.md claude-work.md; do
  cleanup_path "$CODEX_HOME/prompts/$prompt_name" "prompt"
done

for skill_name in cc-ask cc-review cc-task cc-resume claude-ask claude-task claude-consult claude-review claude-work claude-resume; do
  cleanup_path "$CODEX_HOME/skills/$skill_name" "skill"
done

for billing_env in \
  ANTHROPIC_API_KEY \
  ANTHROPIC_AUTH_TOKEN \
  CLAUDE_CODE_USE_BEDROCK \
  CLAUDE_CODE_USE_VERTEX \
  AWS_ACCESS_KEY_ID \
  AWS_SECRET_ACCESS_KEY \
  AWS_SESSION_TOKEN \
  GOOGLE_APPLICATION_CREDENTIALS \
  OPENAI_API_KEY \
  OPENAI_BASE_URL \
  AZURE_OPENAI_API_KEY
do
  eval "billing_value=\${$billing_env:-}"
  if [ "$billing_value" ]; then
    echo "warning: $billing_env is set. Bridge task commands fail closed on direct API billing environment by default; unset it or explicitly set CLAUDE_CODEX_BRIDGE_ALLOW_DIRECT_API_BILLING=1." >&2
  fi
done

codex plugin marketplace add "$SCRIPT_DIR"
codex plugin add "$PLUGIN_NAME@$MARKETPLACE_NAME"

echo ""
echo "Codex side installed as plugin: $PLUGIN_NAME@$MARKETPLACE_NAME"
echo "Open a new Codex session before using /claude-consult, /claude-review, /claude-work, /claude-resume, /claude-status, /claude-result, or /claude-cancel."
echo "Claude-side task commands require Node.js 18.18+ on PATH."
echo ""
echo "Claude side: run these inside Claude Code:"
quoted_dir=$(printf "%s" "$SCRIPT_DIR" | sed "s/'/'\\\\''/g")
echo "  /plugin marketplace add '$quoted_dir'"
echo "  /plugin install cx@claude-codex-bridge"
