from __future__ import annotations

import importlib.util
import json
import pathlib
import tempfile
import types
import unittest
from typing import Any


SKILL_DIR = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "scripts" / "git_resume_miner.py"


def load_miner() -> Any:
    spec = importlib.util.spec_from_file_location("git_resume_miner", SCRIPT)
    if spec is None or spec.loader is None:
        raise AssertionError("failed to load git_resume_miner.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class GitResumeMinerTest(unittest.TestCase):
    def test_current_path_candidates_normalize_rename_syntax(self) -> None:
        miner = load_miner()

        self.assertEqual(
            miner.current_path_candidates("src/{OldOrder.java => NewOrder.java}"),
            ["src/{OldOrder.java => NewOrder.java}", "src/NewOrder.java"],
        )
        self.assertEqual(
            miner.current_path_candidates("old/path.py => new/path.py"),
            ["old/path.py => new/path.py", "new/path.py"],
        )

    def test_workstream_score_downranks_deleted_historical_paths(self) -> None:
        miner = load_miner()

        with tempfile.TemporaryDirectory() as repo:
            present_file = pathlib.Path(repo) / "src" / "service" / "order.py"
            present_file.parent.mkdir(parents=True)
            present_file.write_text("def create_order():\n    return True\n", encoding="utf-8")

            commits = [
                {
                    "hash": "111111111111",
                    "short_hash": "11111111",
                    "date": "2024-01-01",
                    "subject": "feat: remove legacy output",
                    "files": [{"path": "legacy/output.py", "insertions": 0, "deletions": 4000}],
                    "insertions": 0,
                    "deletions": 4000,
                },
                {
                    "hash": "222222222222",
                    "short_hash": "22222222",
                    "date": "2024-02-01",
                    "subject": "feat: add order workflow",
                    "files": [{"path": "src/service/order.py", "insertions": 200, "deletions": 0}],
                    "insertions": 200,
                    "deletions": 0,
                },
            ]

            candidates = miner.build_workstream_candidates(repo, commits)

        by_topic = {candidate["topic"]: candidate for candidate in candidates}
        self.assertLess(by_topic["feat_remove"]["score"], by_topic["feat_add"]["score"])
        self.assertEqual(by_topic["feat_remove"]["current_presence_ratio"], 0)
        self.assertEqual(by_topic["feat_add"]["current_presence_ratio"], 1)

    def test_path_filter_inspection_and_diff_sampling(self) -> None:
        miner = load_miner()
        calls: list[list[str]] = []

        def fake_run_git(repo: str, args: list[str]) -> str:
            calls.append(args)
            if args[0] == "log":
                return (
                    f"{miner.RECORD_SEP}"
                    f"abcdef123456{miner.FIELD_SEP}2024-01-03{miner.FIELD_SEP}Alice"
                    f"{miner.FIELD_SEP}alice@example.com{miner.FIELD_SEP}feat: add order workflow token=secret-value\n"
                    "10\t0\tsrc/service/order.py\n"
                    "5\t0\tsrc/domain/order.py\n"
                )
            if args[0] == "show":
                return (
                    "diff --git a/src/service/order.py b/src/service/order.py\n"
                    "@@ -0,0 +1,3 @@ def create_order(payload):\n"
                    "+def create_order(payload):\n"
                    "+    password = 'secret-value'\n"
                    "+    return payload\n"
                )
            raise AssertionError(f"unexpected git command: {args}")

        miner.run_git = fake_run_git

        with tempfile.TemporaryDirectory() as repo:
            present_file = pathlib.Path(repo) / "src" / "service" / "order.py"
            present_file.parent.mkdir(parents=True)
            present_file.write_text("def create_order(payload):\n    return payload\n", encoding="utf-8")

            args = types.SimpleNamespace(
                repo=".",
                author="alice@example.com",
                since=None,
                until=None,
                rev="--all",
                paths=["src"],
                max_commits=0,
                include_merges=False,
                oldest_first=False,
                top_by_size=False,
                inspection_limit=3,
                with_diffs=True,
                diff_commits=1,
                diff_context=3,
                max_diff_lines=20,
                privacy="standard",
            )

            commits = miner.collect_commits(repo, args)
            inspection_plan = miner.build_inspection_plan(repo, commits, args.inspection_limit)
            diff_samples = miner.collect_diff_samples(repo, args, inspection_plan, miner.BUILT_IN_REDACTION_PATTERNS)
            payload = miner.build_payload(repo, args, miner.BUILT_IN_REDACTION_PATTERNS)

        self.assertFalse(any(part.startswith("--max-count=") for part in calls[0]))
        self.assertEqual(calls[0][-2:], ["--", "src"])
        self.assertEqual(inspection_plan[0]["short_hash"], "abcdef12")
        self.assertIn("src/service/order.py", inspection_plan[0]["files"])
        self.assertEqual(inspection_plan[0]["current_file_hits"], 1)
        self.assertEqual(inspection_plan[0]["current_file_total"], 2)
        self.assertEqual(inspection_plan[0]["current_presence_ratio"], 0.5)
        self.assertIn("src/service/order.py", inspection_plan[0]["current_files_present"])
        self.assertIn("src/domain/order.py", inspection_plan[0]["current_files_missing"])
        self.assertEqual(calls[1][-2:], ["--", "src"])
        self.assertIn("token=[REDACTED]", diff_samples[0]["subject"])
        self.assertIn("create_order", diff_samples[0]["diff_excerpt"])
        self.assertIn("[REDACTED]", diff_samples[0]["diff_excerpt"])
        self.assertNotIn("secret-value", json.dumps(payload, ensure_ascii=False))
        self.assertIn("token=[REDACTED]", payload["commits"][0]["subject"])
        self.assertEqual(payload["matched_authors"][0]["author_email"], "alice@example.com")
        self.assertIn("inspection_commands", payload["inspection_plan"][0])
        self.assertTrue(any("order" in item["topic"] for item in payload["workstream_candidates"]))

    def test_strict_privacy_author_warnings_and_rename_presence(self) -> None:
        miner = load_miner()

        def fake_run_git(repo: str, args: list[str]) -> str:
            if args[0] == "log":
                return (
                    f"{miner.RECORD_SEP}"
                    f"aaaabbbbcccc{miner.FIELD_SEP}2024-02-01{miner.FIELD_SEP}Alice"
                    f"{miner.FIELD_SEP}alice@example.com{miner.FIELD_SEP}feat: rename order workflow\n"
                    "20\t1\tsrc/{OldOrder.java => NewOrder.java}\n"
                    f"{miner.RECORD_SEP}"
                    f"dddd11112222{miner.FIELD_SEP}2024-03-01{miner.FIELD_SEP}Alice Bot"
                    f"{miner.FIELD_SEP}alice-bot@example.com{miner.FIELD_SEP}feat: update callback auth\n"
                    "5\t0\tsrc/service/Callback.java\n"
                )
            if args[0] == "show":
                return (
                    "diff --git a/src/OldOrder.java b/src/NewOrder.java\n"
                    "@@ -1,2 +1,2 @@ secretBusinessMethod\n"
                    "+Authorization: Bearer abc.def.ghi\n"
                    "+jdbc:mysql://user:pass@db.internal/orders\n"
                )
            raise AssertionError(f"unexpected git command: {args}")

        miner.run_git = fake_run_git

        with tempfile.TemporaryDirectory() as repo:
            renamed_file = pathlib.Path(repo) / "src" / "NewOrder.java"
            renamed_file.parent.mkdir(parents=True)
            renamed_file.write_text("class NewOrder {}\n", encoding="utf-8")

            args = types.SimpleNamespace(
                repo=".",
                author="alice",
                since=None,
                until=None,
                rev="--all",
                paths=None,
                max_commits=10,
                include_merges=False,
                oldest_first=False,
                top_by_size=False,
                inspection_limit=5,
                with_diffs=True,
                diff_commits=1,
                diff_context=3,
                max_diff_lines=20,
                privacy="strict",
            )

            payload = miner.build_payload(repo, args, miner.BUILT_IN_REDACTION_PATTERNS)
            rendered = miner.render_markdown(payload)

        self.assertEqual(len(payload["matched_authors"]), 2)
        self.assertTrue(any("Multiple author identities" in warning for warning in payload["evidence_warnings"]))
        self.assertTrue(any("--max-commits" in warning for warning in payload["evidence_warnings"]))
        self.assertTrue(any("--privacy strict" in warning for warning in payload["evidence_warnings"]))
        first_plan = payload["inspection_plan"][0]
        self.assertIn("src/NewOrder.java", first_plan["current_files_present"])
        self.assertTrue(any(command["label"] == "path history" for command in first_plan["inspection_commands"]))
        self.assertTrue(any(command["command"] == "git show HEAD:src/NewOrder.java" for command in first_plan["inspection_commands"]))
        self.assertEqual(payload["diff_samples"][0]["hunk_symbols"], [])
        self.assertEqual(payload["diff_samples"][0]["diff_excerpt"], "[omitted by --privacy strict]")
        self.assertNotIn("abc.def.ghi", json.dumps(payload, ensure_ascii=False))
        self.assertNotIn("user:pass", rendered)
        self.assertNotIn("secretBusinessMethod", rendered)
        self.assertIn("## Matched Authors", rendered)
        self.assertIn("Next check", rendered)

    def test_no_matching_commits_emits_scope_warning(self) -> None:
        miner = load_miner()

        def fake_run_git(repo: str, args: list[str]) -> str:
            if args[0] == "log":
                return ""
            raise AssertionError(f"unexpected git command: {args}")

        miner.run_git = fake_run_git

        args = types.SimpleNamespace(
            repo=".",
            author="missing@example.com",
            since="2024-01-01",
            until="2024-12-31",
            rev="--all",
            paths=None,
            max_commits=0,
            include_merges=False,
            oldest_first=False,
            top_by_size=False,
            inspection_limit=5,
            with_diffs=False,
            diff_commits=0,
            diff_context=3,
            max_diff_lines=20,
            privacy="standard",
        )

        with tempfile.TemporaryDirectory() as repo:
            payload = miner.build_payload(repo, args, miner.BUILT_IN_REDACTION_PATTERNS)
            rendered = miner.render_markdown(payload)

        self.assertEqual(payload["summary"]["commit_count"], 0)
        self.assertEqual(payload["matched_authors"], [])
        self.assertTrue(any("No matching commits" in warning for warning in payload["evidence_warnings"]))
        self.assertIn("## Evidence Warnings", rendered)
        self.assertIn("- n/a", rendered)


if __name__ == "__main__":
    unittest.main()
