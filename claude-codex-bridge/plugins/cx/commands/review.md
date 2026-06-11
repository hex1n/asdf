---
description: Have Codex review local git changes (native codex review contract)
argument-hint: "[--base <branch>] [--commit <sha>] [--model <m>|spark] [custom review focus]"
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin forwarding wrapper around the Codex CLI. Your only job is to run exactly one `codex exec review` call and return its result. Do not review the changes yourself, do not inspect the repository, do not summarize or annotate Codex's findings.

Arguments: $ARGUMENTS

## 1. Parse routing flags

Strip these from the text; whatever remains is the custom review focus (may be empty).

- `--base <branch>` → review changes against that base branch.
- `--commit <sha>` → review the changes introduced by that commit.
- `--model <m>` → add `-m <m>`. Map `spark` to `gpt-5.3-codex-spark`.
- If neither `--base` nor `--commit` is given, default to `--uncommitted` (staged + unstaged + untracked).

## 2. Run exactly one command

`codex exec review` carries its own built-in review contract — do not add your own prompt structure. Only pass the user's custom focus, if any, via stdin (`-`); never as a command-line argument (the Windows `codex.cmd` shim mangles nested quotes).

POSIX shell:
```sh
OUT="$(mktemp)" ; LOG="$(mktemp)"
# scope = --uncommitted | --base <branch> | --commit <sha>
if codex exec review {scope} -o "$OUT" <optional model arg> - <<'CODEX_PROMPT' >"$LOG" 2>&1
{custom review focus, omit heredoc and trailing "-" entirely if empty}
CODEX_PROMPT
then
  if [ -s "$OUT" ]; then cat "$OUT"; else tail -n 50 "$LOG"; exit 1; fi
else
  status=$?
  tail -n 50 "$LOG"
  exit "$status"
fi
```

PowerShell:
```powershell
$OUT = New-TemporaryFile
$LOG = New-TemporaryFile
@'
{custom review focus, omit stdin pipe and trailing "-" entirely if empty}
'@ | codex exec review {scope} -o "$($OUT.FullName)" <optional model arg> - *> "$($LOG.FullName)"
$status = $LASTEXITCODE
if ($status -eq 0 -and (Get-Item "$($OUT.FullName)").Length -gt 0) {
    Get-Content "$($OUT.FullName)" -Raw
} else {
    Get-Content "$($LOG.FullName)" -Tail 50
    if ($status -eq 0) { exit 1 } else { exit $status }
}
```

If there is no custom focus, run the command without the trailing `-` and without the heredoc.
Replace `<optional model arg>` before running; never include placeholder text or square-bracket notation literally.

Run in the foreground with a 600000 ms timeout. Reviews can take several minutes.

## 3. Return

- Return the content of the `-o` file exactly as-is. No commentary, no re-ranking, no additions.
- If the exit code is non-zero or the `-o` file is empty, report the last ~50 lines of the stream log file as the error and stop. Do not perform the review yourself.
