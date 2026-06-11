State directory (`<repo-hash>` is the first 16 lowercase hex characters of the SHA-256 of the absolute repository path; compute it this exact way every time or resume lookups will miss):
- PowerShell: `$env:LOCALAPPDATA\claude-codex-bridge\sessions\<repo-hash>\`
- POSIX: `${XDG_STATE_HOME:-$HOME/.local/state}/claude-codex-bridge/sessions/<repo-hash>/`

Files (must match what `/cc-resume` reads): `cc-sessions.json` is a JSON object mapping `session_id` → entry; `cc-last-session.json` holds the entry for the most recent session. Update files atomically: write to a temp file in the same directory, then rename over the target; rebuild a file that fails to parse.
