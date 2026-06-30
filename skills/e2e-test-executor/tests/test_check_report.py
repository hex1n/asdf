"""Tests for check_report.py. Run: python3 -m unittest discover -s skills/e2e-test-executor/tests

Reuses the repo's authoritative execution-report fixture
(tests/fixtures/e2e_test_executor/valid-execution-report.md) and pins the runtime
check_report() against the repo contract function assert_valid_execution_report()
on their overlapping rules, so the two cannot drift.
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))  # so `tests.<contract module>` resolves to repo-root/tests
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import check_report as cr  # noqa: E402
from tests.test_e2e_test_executor_contract import assert_valid_execution_report  # noqa: E402

FIXTURE = REPO_ROOT / "tests/fixtures/e2e_test_executor/valid-execution-report.md"

# A second, divergent domain (content moderation) — same protocol, different nouns —
# so the rules are proven domain-neutral, not overfit to the withhold-notice fixture.
SECOND_DOMAIN_REPORT = """# E2E Execution Report — content moderation submit

Plan: docs/e2e-test/moderation/submit-plan.md

## Execution Summary

2 scenarios selected, 2 executed: 1 `passed`, 1 `failed`.

## Run Metadata

- Environment kind: test
- Selected scenarios: MOD-S1, MOD-S2

## Environment & Capability Map

- API: `POST /moderation/submit` (test base url `http://localhost:18080`)

## DAG Schedule

- N1 (MOD-S1) first, N2 (MOD-S2) after.

## Scenario Results

| Scenario | Status | Expected | Actual | Diagnosis | Evidence | Preserved scene |
|---|---|---|---|---|---|---|
| MOD-S1 clean text accepted | `passed` | verdict=allow | allow | — | evidence/index.md#mod-s1 | — |
| MOD-S2 banned phrase blocked | `failed` | verdict=block | allow | `product` | evidence/index.md#mod-s2 | preserved-scenes/mod-s2/ |

## Evidence Index

See evidence/index.md for raw artifacts, organized per scenario.

- mod-s1: probe -> expected -> actual -> raw

## Failures / Defects / Plan Gaps

- MOD-S2 (`product defect`; `OPEN`): a banned phrase passed moderation. Preserved scene: preserved-scenes/mod-s2/.

## Data Created & Cleanup

- No persistent data created; submissions are stateless.

## Re-run Instructions

```bash
pytest -k moderation_submit -Denv=test
```

## Next Actions for Agent

- File MOD-S2 as a product defect against the moderation rule chain.
"""


def rules(violations):
    return {v["rule"] for v in violations}


class CheckReportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.good = FIXTURE.read_text(encoding="utf-8")

    # --- the authoritative good report passes cleanly ---
    def test_valid_fixture_has_no_violations(self):
        self.assertEqual([], cr.check_report(self.good))

    # --- one mutation per rule must be caught with the right rule id ---
    def test_missing_required_section(self):
        mutated = self.good.replace("## Re-run Instructions", "## Rerun Steps")
        self.assertIn("R1-section", rules(cr.check_report(mutated)))

    def test_illegal_scenario_status(self):
        mutated = (self.good.replace("`passed`", "`done`")
                   .replace("`failed`", "`broken`")
                   .replace("`blocked`", "`stuck`"))
        self.assertIn("R3-status", rules(cr.check_report(mutated)))

    def test_failed_row_without_preserved_scene(self):
        mutated = self.good.replace(
            "| evidence/index.md#wn-s2 | preserved-scenes/wn-s2/ |",
            "| evidence/index.md#wn-s2 | — |",
        )
        self.assertIn("R4-preserved-scene", rules(cr.check_report(mutated)))

    def test_no_evidence_index_reference(self):
        mutated = self.good.replace("evidence/index.md", "evidence-summary")
        self.assertIn("R5-evidence-index", rules(cr.check_report(mutated)))

    def test_rerun_without_executable_command(self):
        mutated = self.good.replace(
            "```bash\n./gradlew :hfax_loan_service:test --tests '*WithHoldNotice*' -Denv=test\n```\n\n"
            "WN-S2 alone reruns via `curl -X POST http://localhost:18080/fund/loan/withhold/notice "
            "-d @evidence/wn-s2/request.json`.",
            "Re-run by hand in the test environment.",
        )
        self.assertIn("R6-rerun-command", rules(cr.check_report(mutated)))

    # --- the two gap rules this script adds on top of the contract function ---
    def test_diagnosis_prose_is_flagged(self):
        mutated = self.good.replace(
            "| `product` | evidence/index.md#wn-s2 |",
            "| the call returned five hundred | evidence/index.md#wn-s2 |",
        )
        self.assertIn("G1-diagnosis-token", rules(cr.check_report(mutated)))

    def test_next_actions_with_conditional_is_flagged(self):
        mutated = self.good.replace(
            "- Run cleanup for `E2EWN-S2%` after the defect is confirmed.",
            "- CONDITIONAL: retry the run once the settlement stub is restored",
        )
        self.assertIn("G2-next-actions-open", rules(cr.check_report(mutated)))

    def test_blocked_by_tooling_in_failures_is_not_flagged(self):
        # The fixture carries `BLOCKED-BY-TOOLING` in Failures/Defects (legal there);
        # G2 must scope to Next Actions only and not false-positive on it.
        self.assertNotIn("G2-next-actions-open", rules(cr.check_report(self.good)))

    # --- the SCOPE blind spot, encoded as a regression test ---
    def test_fabricated_pass_is_invisible_by_design(self):
        # A structurally flawless report whose `passed` contradicts its own expected/actual
        # is a fidelity defect, not a protocol defect: check_report MUST stay blind to it.
        lie = self.good.replace("一致，事件已消费", "事件丢失，状态不一致")  # keep status `passed`
        self.assertNotEqual(lie, self.good)
        self.assertEqual([], cr.check_report(lie))

    # --- generalization: a second, divergent domain passes and its mutations are caught ---
    def test_second_domain_report_passes(self):
        self.assertEqual([], cr.check_report(SECOND_DOMAIN_REPORT))

    def test_second_domain_mutations_are_caught(self):
        no_scene = SECOND_DOMAIN_REPORT.replace(
            "| evidence/index.md#mod-s2 | preserved-scenes/mod-s2/ |",
            "| evidence/index.md#mod-s2 | — |",
        )
        self.assertIn("R4-preserved-scene", rules(cr.check_report(no_scene)))
        prose = SECOND_DOMAIN_REPORT.replace(
            "| `product` | evidence/index.md#mod-s2 |",
            "| the model let a slur through | evidence/index.md#mod-s2 |",
        )
        self.assertIn("G1-diagnosis-token", rules(cr.check_report(prose)))

    # --- anti-drift: agree with the repo contract on overlapping rules ---
    def test_agrees_with_contract_on_good_report(self):
        assert_valid_execution_report(self, self.good)  # contract: no raise
        self.assertEqual([], cr.check_report(self.good))  # script: no violation

    def test_agrees_with_contract_on_overlapping_mutations(self):
        overlapping = [
            self.good.replace("## Re-run Instructions", "## Rerun Steps"),          # R1
            self.good.replace("| evidence/index.md#wn-s2 | preserved-scenes/wn-s2/ |",
                              "| evidence/index.md#wn-s2 | — |"),                    # R4
            self.good.replace("evidence/index.md", "evidence-summary"),             # R5
        ]
        for mutated in overlapping:
            with self.subTest(mutated=mutated[:40]):
                self.assertNotEqual(mutated, self.good)
                with self.assertRaises(AssertionError):
                    assert_valid_execution_report(self, mutated)      # contract catches it
                self.assertTrue(cr.check_report(mutated))             # script catches it too

    # --- CLI behaviour: advisory by default, gates only under --strict ---
    def test_cli_advisory_vs_strict_exit_codes(self):
        with tempfile.TemporaryDirectory() as td:
            run_dir = Path(td)
            bad = run_dir / "execution-report.md"
            bad.write_text(self.good.replace("## Evidence Index", "## Proof Dump"), encoding="utf-8")
            self.assertEqual(0, cr.main([str(bad)]))               # advisory: never gates
            self.assertEqual(1, cr.main([str(bad), "--strict"]))   # strict: gates on violation
            # directory resolution + clean report under strict exits 0
            good_dir = run_dir / "good"
            good_dir.mkdir()
            (good_dir / "execution-report.md").write_text(self.good, encoding="utf-8")
            self.assertEqual(0, cr.main([str(good_dir), "--strict"]))


if __name__ == "__main__":
    unittest.main()
