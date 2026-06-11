# claude-codex-bridge installer (Codex side)
# Copies codex-prompts/*.md to ~/.codex/prompts/ so they appear as slash commands in Codex.
$ErrorActionPreference = 'Stop'

$src = Join-Path $PSScriptRoot 'codex-prompts'
$dst = Join-Path $env:USERPROFILE '.codex\prompts'

if (-not (Test-Path $src)) { throw "codex-prompts directory not found next to install.ps1" }
New-Item -ItemType Directory -Force $dst | Out-Null

Get-ChildItem $src -Filter *.md | ForEach-Object {
    $target = Join-Path $dst $_.Name
    if ((Test-Path $target) -and -not (Test-Path "$target.bak")) {
        Copy-Item $target "$target.bak"
        Write-Host "backup:    $($_.Name) -> $($_.Name).bak"
    }
    Copy-Item $_.FullName $target -Force
    Write-Host "installed: $($_.Name)"
}

$stalePrompts = @('claude-ask.md', 'claude-review.md', 'claude-task.md', 'claude-resume.md', 'claude-fix.md')
foreach ($staleName in $stalePrompts) {
    $stalePrompt = Join-Path $dst $staleName
    if (Test-Path $stalePrompt) {
        if (-not (Test-Path "$stalePrompt.bak")) { Copy-Item $stalePrompt "$stalePrompt.bak" }
        Remove-Item $stalePrompt -Force
        Write-Host "removed stale: $staleName -> $staleName.bak"
    }
}

$bridgeDst = Join-Path $env:USERPROFILE '.codex\bridge'
New-Item -ItemType Directory -Force $bridgeDst | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'plugins\cx\bridge\bridge.ts') (Join-Path $bridgeDst 'bridge.ts') -Force
Write-Host "installed: bridge.ts -> $bridgeDst\bridge.ts"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Warning "bun is not on PATH. The cc-* prompts and /cx:* commands run 'bun bridge.ts'; install Bun first (https://bun.sh)."
}

if ($env:ANTHROPIC_API_KEY) {
    Write-Warning "ANTHROPIC_API_KEY is set in this environment. 'claude --print' will bill it as API usage instead of your subscription. Remove the variable before using the cc-* prompts."
}

Write-Host ""
Write-Host "Codex side installed. Prompts available in Codex as /cc-ask (etc.) after restarting Codex."
Write-Host ""
Write-Host "Claude side: run these inside Claude Code:"
Write-Host "  /plugin marketplace add `"$PSScriptRoot`""
Write-Host "  /plugin install cx@claude-codex-bridge"
