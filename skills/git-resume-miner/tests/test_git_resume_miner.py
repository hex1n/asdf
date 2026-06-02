from __future__ import annotations

import importlib.util
import json
import pathlib
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
        )

        commits = miner.collect_commits("repo", args)
        inspection_plan = miner.build_inspection_plan(commits, args.inspection_limit)
        diff_samples = miner.collect_diff_samples("repo", args, inspection_plan, miner.BUILT_IN_REDACTION_PATTERNS)
        payload = miner.build_payload("repo", args, miner.BUILT_IN_REDACTION_PATTERNS)

        self.assertFalse(any(part.startswith("--max-count=") for part in calls[0]))
        self.assertEqual(calls[0][-2:], ["--", "src"])
        self.assertEqual(inspection_plan[0]["short_hash"], "abcdef12")
        self.assertIn("src/service/order.py", inspection_plan[0]["files"])
        self.assertEqual(calls[1][-2:], ["--", "src"])
        self.assertIn("token=[REDACTED]", diff_samples[0]["subject"])
        self.assertIn("create_order", diff_samples[0]["diff_excerpt"])
        self.assertIn("[REDACTED]", diff_samples[0]["diff_excerpt"])
        self.assertNotIn("secret-value", json.dumps(payload, ensure_ascii=False))
        self.assertIn("token=[REDACTED]", payload["commits"][0]["subject"])
        self.assertTrue(any("order" in item["topic"] for item in payload["workstream_candidates"]))


if __name__ == "__main__":
    unittest.main()
