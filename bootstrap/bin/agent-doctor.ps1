# agent-doctor.ps1 - read-only self-check for the local agent environment.
# Source runbook: ~/.codex/runbooks/local-environment-diagnostics.md
# Rules: never mutate state; report facts + risk; admin rights are NOT assumed.

$ErrorActionPreference = 'SilentlyContinue'

function Section($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Item($k, $v) { Write-Host ("  {0,-28} {1}" -f $k, $v) }

Section 'CLI versions'
foreach ($c in 'claude', 'codex', 'node', 'python', 'git', 'rg') {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) {
        $ver = try { (& $c --version 2>$null | Select-Object -First 1) } catch { '?' }
        Item $c "$ver  [$($cmd.Source)]"
    } else { Item $c 'NOT FOUND' }
}
# duplicate installs on PATH (a recurring failure mode: multi-install conflicts)
foreach ($c in 'claude', 'codex') {
    $all = @(Get-Command $c -All -ErrorAction SilentlyContinue)
    if ($all.Count -gt 1) { Item "$c duplicates" ("WARN: " + (($all | ForEach-Object Source) -join ' | ')) }
}

Section 'Processes (residual detection)'
foreach ($p in 'claude', 'codex', 'node') {
    $procs = @(Get-Process -Name $p -ErrorAction SilentlyContinue)
    if ($procs) {
        $age = ($procs | Sort-Object StartTime | Select-Object -First 1).StartTime
        Item $p "$($procs.Count) running, oldest since $age"
    } else { Item $p 'none' }
}

Section 'Proxy / network'
Item 'env HTTP_PROXY'  ($env:HTTP_PROXY  ?? '(unset)')
Item 'env HTTPS_PROXY' ($env:HTTPS_PROXY ?? '(unset)')
$inet = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
Item 'Windows user proxy' ("Enable=$($inet.ProxyEnable) Server=$($inet.ProxyServer)")
$cdp = Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue
Item 'Chrome CDP :9222' ($(if ($cdp) { 'listening' } else { 'not listening (claude-in-chrome/playwright CDP unavailable)' }))

Section 'Agent config presence'
Item '~/.claude/settings.json'    ($(if (Test-Path "$HOME\.claude\settings.json") { 'ok' } else { 'MISSING' }))
Item '~/.claude/CLAUDE.md'        ($(if (Select-String -Path "$HOME\.claude\CLAUDE.md" -Pattern 'Execution Contract' -Quiet) { 'ok (contract present)' } else { 'WARN: no Execution Contract section' }))
Item '~/.codex/config.toml'       ($(if (Test-Path "$HOME\.codex\config.toml") { 'ok' } else { 'MISSING' }))
Item '~/.codex/AGENTS.md'         ($(if (Select-String -Path "$HOME\.codex\AGENTS.md" -Pattern 'Execution Contract' -Quiet) { 'ok (contract present)' } else { 'WARN: no Execution Contract section' }))
$mcp = (Select-String -Path "$HOME\.codex\config.toml" -Pattern '^\[mcp_servers\.' -AllMatches).Count
Item 'codex MCP servers' $mcp
foreach ($f in 'land', 'fixloop', 'converge') {
    $cc = Test-Path "$HOME\.claude\commands\$f.md"; $cx = Test-Path "$HOME\.codex\prompts\$f.md"
    Item "cmd /$f" ("claude=" + $(if ($cc) { 'ok' } else { 'MISSING' }) + " codex=" + $(if ($cx) { 'ok' } else { 'MISSING' }))
}
$setRaw = Get-Content "$HOME\.claude\settings.json" -Raw -ErrorAction SilentlyContinue
if ($setRaw -match '"skipDangerousModePermissionPrompt"\s*:\s*true') {
    Item 'skipDangerousPrompt' 'WARN: true - dangerous-mode confirmations are skipped (weakens the only prompt-layer friction on scope drift)'
}
$cfgRaw = Get-Content "$HOME\.codex\config.toml" -Raw -ErrorAction SilentlyContinue
if ($cfgRaw -match 'approvals_reviewer\s*=\s*"([^"]+)"') {
    $ar = $Matches[1]
    $arNote = if ($ar -in @('user', 'auto_review')) { "ok ($ar)" }
              else { "WARN: '$ar' is not in the documented value set (user/auto_review) - verify against official Codex docs whether this reviewer actually runs; the AGENTS.md Guardian criteria only bind if the approvals layer is live" }
    Item 'approvals_reviewer' $arNote
}

Section 'Skill drift (source vs installed)'
$repo = if ($env:ASDF_REPO) { $env:ASDF_REPO } else { "$HOME\Desktop\asdf" }
$src = Join-Path $repo 'skills'
if (Test-Path $src) {
    $linked = @(); $copied = @()
    foreach ($sk in (Get-ChildItem $src -Directory)) {
        foreach ($rt in "$HOME\.claude\skills", "$HOME\.codex\skills") {
            $inst = Join-Path $rt $sk.Name
            if (Test-Path $inst) {
                # ignore dot-directories (.archive etc.) - local-only, not distributed assets
                $hashes = { param($root) Get-ChildItem $root -Recurse -File |
                    Where-Object { $_.FullName.Substring($root.Length) -notmatch '[\\/]\.' } |
                    Get-FileHash | ForEach-Object Hash }
                $d = Compare-Object @(& $hashes $sk.FullName) @(& $hashes $inst)
                if ($d) { Item "$($sk.Name) -> $rt" 'DRIFT' }
                $lt = (Get-Item $inst -Force).LinkType
                if ($lt) { $linked += $sk.Name } else { $copied += $sk.Name }
            }
        }
    }
    Item 'linked installs' (($linked | Select-Object -Unique) -join ', ')
    Item 'copied installs' ((($copied | Select-Object -Unique) -join ', ') + '  <- re-run install.py after source edits')
    Item 'drift scan' 'done (only DRIFT lines above are problems)'
} else {
    Item 'drift scan' "WARN: source repo not found at $src (set ASDF_REPO env var); scan skipped"
}

Section 'Loop health review'
$lh = Join-Path $repo 'docs\research\loop-health.txt'
if (Test-Path $lh) {
    $age = (New-TimeSpan -Start (Get-Item $lh).LastWriteTime -End (Get-Date)).Days
    $note = if ($age -gt 35) { " - WARN: monthly review due (run analyze-sessions.py)" } else { '' }
    Item 'loop-health.txt' ("age $age days$note")
} else {
    Item 'loop-health.txt' 'missing - run docs/research/2026-07-02-analyze-sessions.py to create the baseline'
}

Section 'Disk'
$c = Get-PSDrive C
Item 'C: free' ("{0:N1} GB free / {1:N1} GB total" -f ($c.Free/1GB), (($c.Used+$c.Free)/1GB))

Section 'Recent sandbox errors (codex)'
$sb = Get-ChildItem "$HOME\.codex\sandbox*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($sb) {
    $err = @(Select-String -Path $sb.FullName -Pattern 'SetTokenInformation|error' | Select-Object -Last 3)
    Item $sb.Name ($(if ($err) { "last errors: " + ($err.Count) + " (see file)" } else { 'clean' }))
} else { Item 'sandbox log' 'none' }

Write-Host "`nDone. Read-only check; nothing was changed." -ForegroundColor Green
