# claude-codex-bridge installer (Codex side)
# Installs the Codex-side plugin and removes old direct prompt/skill entries.
$ErrorActionPreference = 'Stop'

$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$pluginName = 'claude-codex-bridge'
$marketplaceName = 'claude-codex-bridge'

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { throw "codex CLI not found on PATH" }

if (-not (Test-Path (Join-Path $PSScriptRoot '.agents\plugins\marketplace.json'))) {
    throw "Codex marketplace manifest not found"
}

if (-not (Test-Path (Join-Path $PSScriptRoot "plugins\$pluginName\.codex-plugin\plugin.json"))) {
    throw "Codex plugin manifest not found"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warning "node CLI not found on PATH. Claude-side /cx:work, /cx:resume, /cx:status, /cx:result, and /cx:cancel require Node.js 18.18+."
}

function Remove-LegacyPath {
    param(
        [string] $Path,
        [string] $Label
    )

    if (-not (Test-Path $Path)) {
        return
    }

    $item = Get-Item $Path
    if ($item.LinkType) {
        Remove-Item $Path -Force
        Write-Host "removed legacy ${Label}: $Path"
    } else {
        Move-Item $Path "$Path.bak" -Force
        Write-Host "backup legacy ${Label}: $Path -> $Path.bak"
    }
}

@('cc-ask.md', 'cc-review.md', 'cc-task.md', 'cc-resume.md', 'claude-ask.md', 'claude-review.md', 'claude-task.md', 'claude-resume.md', 'claude-fix.md', 'claude-consult.md', 'claude-work.md') | ForEach-Object {
    Remove-LegacyPath (Join-Path $codexHome "prompts\$_") 'prompt'
}

@('cc-ask', 'cc-review', 'cc-task', 'cc-resume', 'claude-ask', 'claude-task', 'claude-consult', 'claude-review', 'claude-work', 'claude-resume') | ForEach-Object {
    Remove-LegacyPath (Join-Path $codexHome "skills\$_") 'skill'
}

@(
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'AZURE_OPENAI_API_KEY'
) | ForEach-Object {
    if ([Environment]::GetEnvironmentVariable($_)) {
        Write-Warning "$_ is set. Bridge task commands fail closed on direct API billing environment by default; unset it or explicitly set CLAUDE_CODEX_BRIDGE_ALLOW_DIRECT_API_BILLING=1."
    }
}

codex plugin marketplace add "$PSScriptRoot"
codex plugin add "$pluginName@$marketplaceName"

Write-Host ""
Write-Host "Codex side installed as plugin: $pluginName@$marketplaceName"
Write-Host "Open a new Codex session before using /claude-consult, /claude-review, /claude-work, /claude-resume, /claude-status, /claude-result, or /claude-cancel."
Write-Host "Claude-side task commands require Node.js 18.18+ on PATH."
Write-Host ""
Write-Host "Claude side: run these inside Claude Code:"
Write-Host "  /plugin marketplace add `"$PSScriptRoot`""
Write-Host "  /plugin install cx@claude-codex-bridge"
