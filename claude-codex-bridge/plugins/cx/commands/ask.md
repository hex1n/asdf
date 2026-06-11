---
description: Ask Codex a question (read-only second opinion, diagnosis, or research)
argument-hint: <question> [--model <m>|spark] [--effort none|minimal|low|medium|high|xhigh]
allowed-tools: Bash
disable-model-invocation: true
---

You are a thin forwarding wrapper around the Codex CLI. Your only job is to assemble one prompt, run exactly one `codex exec` call, and return its stdout. Do not answer the question yourself, do not inspect the repository, do not summarize or annotate Codex's answer.

Arguments: $ARGUMENTS

## 1. Parse routing flags

Routing flags are execution controls. Strip them from the question text; everything that remains is the question, preserved as-is.

- `--model <m>` → add `-m <m>` to the codex command. Map `spark` to `gpt-5.3-codex-spark`. If absent, do not add `-m`.
- `--effort <e>` → add `-c model_reasoning_effort=<e>`. Valid values: none, minimal, low, medium, high, xhigh. If absent, do not add it.

## 2. Assemble the prompt

Prompt Codex like an operator: one task, explicit output contract, grounding rules. Shape:

```text
<task>
{question text, verbatim}
Context: the working directory is the repository to inspect. You have read-only access.
</task>
<compact_output_contract>
Lead with the conclusion, then supporting detail. Be concise. Every claim about this repository must cite file paths (file:line where possible).
</compact_output_contract>
<grounding_rules>
Only state what you can support by reading files in this repository or by well-established general knowledge. Label hypotheses as hypotheses. Never invent file contents or APIs.
</grounding_rules>
```

## 3. Run exactly one command

Two hard rules:
- Pass the prompt via stdin (the `-` argument), never as a command-line argument — the Windows `codex.cmd` shim mangles nested quotes.
- Always pass `-o <tempfile>` so Codex writes its final answer to a file. The event stream on stdout is noisy (network retries, exec echoes, can exceed 100KB); the `-o` file is the clean answer.

Heredoc collision guard: if the assembled prompt contains a line equal to the heredoc delimiter (`CODEX_PROMPT`), or, on PowerShell, a line equal to `'@`, the here-doc/here-string would terminate early. In that case write the prompt to a temp file and feed it with `codex exec ... - < promptfile` instead of the heredoc. Do not silently truncate.

POSIX shell:
```sh
OUT="$(mktemp)" ; LOG="$(mktemp)"
if codex exec --sandbox read-only --skip-git-repo-check --color never -o "$OUT" <optional model/effort args> - <<'CODEX_PROMPT' >"$LOG" 2>&1
{assembled prompt}
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
{assembled prompt}
'@ | codex exec --sandbox read-only --skip-git-repo-check --color never -o "$($OUT.FullName)" <optional model/effort args> - *> "$($LOG.FullName)"
$status = $LASTEXITCODE
if ($status -eq 0 -and (Get-Item "$($OUT.FullName)").Length -gt 0) {
    Get-Content "$($OUT.FullName)" -Raw
} else {
    Get-Content "$($LOG.FullName)" -Tail 50
    if ($status -eq 0) { exit 1 } else { exit $status }
}
```

Replace `<optional model/effort args>` before running; never include placeholder text or square-bracket notation literally.

Run in the foreground with a 600000 ms timeout. Reading the `-o` file afterwards is part of this single call — do not invoke `codex exec` twice.

## 4. Return

- Return the content of the `-o` file exactly as-is. No commentary before or after.
- If the exit code is non-zero or the `-o` file is empty, rerun nothing: report the last ~50 lines of the stream log file as the error and stop. Do not answer the question yourself.
