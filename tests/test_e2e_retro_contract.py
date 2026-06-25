"""Contract test for the retrospective-driven e2e rules (mechanisms A-F).

Presence guard that pins the load-bearing tokens added from a real e2e-session
retrospective into both e2e skills, so they cannot silently regress:
- A: a shared Gap & Defect Disposition vocabulary (planner gaps + executor defects)
- B: Execution Contract Override (executor intake + report)
- C: Side-effect Class taxonomy + authorization gate (planner) and retention re-risk (executor)
- D: required-vs-optional capability gate (planner) + BLOCKED-BY-TOOLING attribution (executor)
- E: single-source render that preserves disposition + an integrity check (executor)

These are presence assertions over the skill bodies — the same style the e2e
contract suites use — and they do not validate a live run. The vocabulary is
duplicated across the two independently-shipped skills on purpose; pinning it in
both here is what keeps the copies from drifting.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLANNER_SKILL = ROOT / "skills/e2e-test-planner/SKILL.md"
PLANNER_REF = ROOT / "skills/e2e-test-planner/REFERENCE.md"
EXEC_SKILL = ROOT / "skills/e2e-test-executor/SKILL.md"
EXEC_REF = ROOT / "skills/e2e-test-executor/REFERENCE.md"

DISPOSITION = (
    "OPEN", "CLOSED", "MITIGATED", "ACCEPTED",
    "CONDITIONAL", "BLOCKED-BY-TOOLING", "OUT-OF-SCOPE",
)
SIDE_EFFECT_CLASSES = (
    "read-only", "additive-retained", "soft-delete", "destructive-delete",
    "config-change", "external-file", "async-replay",
)


def _read(path):
    return path.read_text(encoding="utf-8")


class E2ERetroContractTest(unittest.TestCase):
    def _assert_all_in(self, terms, text, label):
        for term in terms:
            with self.subTest(term=term):
                self.assertIn(term, text, f"{label} missing token: {term}")

    # A - shared disposition vocabulary, identical in both skills' REFERENCE.
    def test_disposition_vocabulary_in_both_references(self):
        for path, label in ((PLANNER_REF, "planner"), (EXEC_REF, "executor")):
            text = _read(path)
            self.assertIn(
                "Gap & Defect Disposition", text,
                f"{label} REFERENCE missing the disposition section",
            )
            self._assert_all_in(DISPOSITION, text, f"{label} disposition vocabulary")

    def test_disposition_referenced_from_skill_bodies(self):
        self.assertIn("disposition", _read(PLANNER_SKILL).lower())
        self.assertIn("disposition", _read(EXEC_SKILL).lower())

    # C - Side-effect Class taxonomy + authorization/fixture gate (planner).
    def test_side_effect_class_taxonomy(self):
        self.assertIn("Side-effect Class", _read(PLANNER_SKILL))
        ref = _read(PLANNER_REF)
        self.assertIn("Side-effect Class", ref)
        self._assert_all_in(SIDE_EFFECT_CLASSES, ref, "planner side-effect classes")
        self.assertRegex(ref.lower(), r"authoriz")
        self.assertIn("fixture", ref.lower())

    # C / replay - executor re-risks destructive classes under retention; no mutate-success.
    def test_executor_rerisks_destructive_classes_under_retention(self):
        skill = _read(EXEC_SKILL).lower()
        self.assertIn("re-risk", skill)
        self.assertIn("already-succeeded state", skill)
        self.assertIn("failure-injection fixture", skill)

    # B - Execution Contract Override (executor intake + REFERENCE) + superseded rule.
    def test_execution_contract_override(self):
        self.assertIn("Execution Contract Override", _read(EXEC_SKILL))
        self.assertIn("Execution Contract Override", _read(EXEC_REF))
        self.assertIn("superseded", _read(EXEC_SKILL).lower())

    # D - required-vs-optional capability gate (planner) + BLOCKED-BY-TOOLING (executor).
    def test_capability_gate_and_blocked_by_tooling(self):
        planner = _read(PLANNER_SKILL).lower()
        self.assertIn("required capabilities", planner)
        self.assertIn("optional probes", planner)
        self.assertIn("BLOCKED-BY-TOOLING", _read(EXEC_SKILL))

    # E - single-source render preserves disposition + integrity check (executor).
    def test_render_preserves_disposition_and_checks_integrity(self):
        skill = _read(EXEC_SKILL).lower()
        self.assertIn("escape residue", skill)
        self.assertIn("disposition", skill)


if __name__ == "__main__":
    unittest.main()
