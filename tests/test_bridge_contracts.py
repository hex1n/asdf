from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "claude-codex-bridge"

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

# The write-capable task tool whitelist must stay identical wherever a task can
# run (fresh task and resumed task), or a resumed session silently loses or
# gains permissions relative to the session that created it.
TASK_ALLOWED_TOOLS = (
    "Read,Edit,Write,Grep,Glob,Bash(git status *),Bash(git diff *),"
    "Bash(npm test *),Bash(npm run *),Bash(pnpm test *),Bash(pnpm run *),"
    "Bash(yarn test *),Bash(yarn run *),Bash(bun test *),Bash(deno test *),"
    "Bash(pytest *),Bash(python -m pytest *),Bash(uv run pytest *),"
    "Bash(go test *),Bash(cargo test *),Bash(mvn test *),Bash(mvn verify *),"
    "Bash(gradle test *),Bash(gradlew test *),Bash(dotnet test *),"
    "Bash(make test *),Bash(bundle exec rspec *),Bash(rspec *)"
)

REPO_HASH_RULE = (
    "first 16 lowercase hex characters of the SHA-256 of the absolute repository path"
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def normalized_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def task_contract_block(text: str) -> list[str]:
    """Extract the shared completeness/verification/action_safety contract,
    indentation-normalized, so the three copies can be compared verbatim."""
    start = text.index("<completeness_contract>")
    end = text.index("</action_safety>") + len("</action_safety>")
    return normalized_lines(text[start:end])


class BridgeContractsTest(unittest.TestCase):
    def test_generic_task_contract_is_byte_identical_across_copies(self) -> None:
        # README design rule "task 合同通用": same done-standard, verification
        # loop, and action-safety boundary for /cx:task, the codex-prompting
        # skill, and /cc-task. Drift in any copy breaks that invariant silently.
        skill = read(BRIDGE / "plugins/cx/skills/codex-prompting/SKILL.md")
        # SKILL.md names the block twice (a description table and the canonical
        # code block); compare against the canonical "Generic Task Contract" copy.
        skill_canonical = skill[skill.index("## Generic Task Contract") :]
        texts = {
            "task.md": read(BRIDGE / "plugins/cx/commands/task.md"),
            "SKILL.md": skill_canonical,
            "cc-task.md": read(BRIDGE / "codex-prompts/cc-task.md"),
        }
        blocks = {name: task_contract_block(text) for name, text in texts.items()}
        baseline = blocks["task.md"]
        for name, block in blocks.items():
            self.assertEqual(baseline, block, f"task contract drifted in {name}")

    def test_task_whitelist_identical_for_fresh_and_resumed_tasks(self) -> None:
        for path in (
            BRIDGE / "codex-prompts/cc-task.md",
            BRIDGE / "codex-prompts/cc-resume.md",
        ):
            with self.subTest(path=path.name):
                self.assertIn(TASK_ALLOWED_TOOLS, read(path))

    def test_billing_guard_is_baked_into_every_cc_command_template(self) -> None:
        # The guard must live in the runnable command, not only in prose, so a
        # literal "follow exactly" execution cannot bill the API key.
        for path in CC_PROMPTS:
            text = read(path)
            with self.subTest(path=path.name):
                self.assertIn("env -u ANTHROPIC_API_KEY", text)
                self.assertIn("$env:ANTHROPIC_API_KEY = $null", text)

    def test_every_cc_command_forbids_billing_breaking_flags(self) -> None:
        for path in CC_PROMPTS:
            text = read(path)
            with self.subTest(path=path.name):
                self.assertIn("Never pass `--bare`", text)
                self.assertIn("never use `--continue`", text)

    def test_repo_hash_algorithm_pinned_wherever_the_hash_is_used(self) -> None:
        for path in (
            BRIDGE / "plugins/cx/commands/task.md",
            BRIDGE / "codex-prompts/cc-ask.md",
            BRIDGE / "codex-prompts/cc-task.md",
            BRIDGE / "codex-prompts/cc-review.md",
            BRIDGE / "codex-prompts/cc-resume.md",
        ):
            with self.subTest(path=path.name):
                self.assertIn(REPO_HASH_RULE, read(path))

    def test_flag_values_are_shape_checked_before_the_host_command_line(self) -> None:
        # Prompt bodies travel via stdin; flag values land on the host command
        # line. Every file that splices a value must carry its shape check, or
        # `--model "$(...)"` style input executes on the host.
        expectations = {
            "plugins/cx/commands/ask.md": ("[A-Za-z0-9._-]+",),
            "plugins/cx/commands/task.md": ("[A-Za-z0-9._-]+", "UUID-shaped"),
            "plugins/cx/commands/review.md": ("[A-Za-z0-9._/-]+", "[0-9a-fA-F]{4,40}"),
            "codex-prompts/cc-ask.md": ("[A-Za-z0-9._-]+",),
            "codex-prompts/cc-task.md": ("[A-Za-z0-9._-]+",),
            "codex-prompts/cc-review.md": ("[A-Za-z0-9._-]+", "[A-Za-z0-9._/-]+"),
            "codex-prompts/cc-resume.md": ("[A-Za-z0-9._-]+", "UUID-shaped"),
        }
        for rel, markers in expectations.items():
            text = read(BRIDGE / rel)
            for marker in markers:
                with self.subTest(path=rel, marker=marker):
                    self.assertIn(marker, text)

    def test_heredoc_collision_guard_on_every_cx_stdin_path(self) -> None:
        for path in CX_COMMANDS:
            with self.subTest(path=path.name):
                self.assertIn("collision guard", read(path))

    def test_cc_registry_filenames_named_by_every_writer_and_reader(self) -> None:
        for name in ("cc-ask.md", "cc-task.md", "cc-review.md", "cc-resume.md"):
            text = read(BRIDGE / "codex-prompts" / name)
            with self.subTest(path=name):
                self.assertIn("cc-sessions.json", text)
                self.assertIn("cc-last-session.json", text)

    def test_generated_files_match_generator_output(self) -> None:
        # Runtime files are rendered from generator/templates + fragments.
        # A direct edit to a generated file (or a template change without
        # re-rendering) must fail here, not drift silently.
        result = subprocess.run(
            [sys.executable, str(BRIDGE / "generator" / "render.py"), "--check"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_installers_preserve_the_first_backup(self) -> None:
        self.assertIn('[ ! -e "$target.bak" ]', read(BRIDGE / "install.sh"))
        self.assertIn('-not (Test-Path "$target.bak")', read(BRIDGE / "install.ps1"))

    def test_resume_uses_explicit_session_id_not_last_shortcut(self) -> None:
        task = read(BRIDGE / "plugins/cx/commands/task.md")
        self.assertIn("never use `--last`", task)
        resume = read(BRIDGE / "codex-prompts/cc-resume.md")
        self.assertIn("claude --print --resume", resume)
        self.assertNotIn("--continue", resume.replace("never use `--continue`", ""))

    def test_cx_commands_disable_model_invocation(self) -> None:
        for path in CX_COMMANDS:
            with self.subTest(path=path.name):
                self.assertIn("disable-model-invocation: true", read(path))

    def test_plugin_and_marketplace_manifests_are_consistent_json(self) -> None:
        marketplace = json.loads(read(BRIDGE / ".claude-plugin/marketplace.json"))
        plugin = json.loads(read(BRIDGE / "plugins/cx/.claude-plugin/plugin.json"))
        self.assertEqual("cx", plugin["name"])
        plugin_names = {entry["name"] for entry in marketplace["plugins"]}
        self.assertIn(plugin["name"], plugin_names)

    def test_installers_remove_stale_legacy_prompts(self) -> None:
        legacy = ("claude-ask.md", "claude-review.md", "claude-task.md", "claude-resume.md")
        for installer in ("install.sh", "install.ps1"):
            text = read(BRIDGE / installer)
            for name in legacy:
                with self.subTest(installer=installer, prompt=name):
                    self.assertIn(name, text)


if __name__ == "__main__":
    unittest.main()
