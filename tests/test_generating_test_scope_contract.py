import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "generating-test-scope" / "SKILL.md"
REFERENCE = ROOT / "skills" / "generating-test-scope" / "REFERENCE.md"
SPEC = ROOT / "tests" / "fixtures" / "generating_test_scope" / "expected-behavior.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def description(text: str) -> str:
    frontmatter = text.split("---", 2)[1]
    for line in frontmatter.splitlines():
        if line.startswith("description:"):
            return line.split(":", 1)[1].strip()
    return ""


class GeneratingTestScopeContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.skill = read(SKILL)
        self.reference = read(REFERENCE)
        self.spec = read(SPEC)

    def test_skill_is_routable_but_not_overbroad(self) -> None:
        desc = description(self.skill).lower()
        for marker in (
            "test-scope",
            "qa handoff",
            "regression range",
            "git diff",
            "do not use",
            "execute an existing test plan",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, desc)
        self.assertLessEqual(len(desc), 1024)

    def test_runtime_workflow_has_skillopt_style_gate_markers(self) -> None:
        lower = self.skill.lower()
        for marker in (
            "frame comparison",
            "build change inventory",
            "trace impact graph",
            "tier qa scope",
            "write document",
            "self-check",
            "completion criterion",
            "unknowns",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_runtime_skill_body_stays_english_first(self) -> None:
        self.assertIsNone(
            re.search(r"[\u4e00-\u9fff]", self.skill),
            "Runtime SKILL.md should stay English; localized docs belong outside the portable skill body.",
        )

    def test_generated_document_language_follows_user_input(self) -> None:
        lower = self.skill.lower()
        self.assertIn("output language", lower)
        self.assertIn("language explicitly requested by the user", lower)
        self.assertIn("match the user's prompt language", lower)
        self.assertIn("keep code identifiers", lower)
        self.assertIn("user's requested language", lower)
        self.assertIn("user's prompt language", lower)
    def test_reference_defines_general_impact_and_scope_rubric(self) -> None:
        lower = self.reference.lower()
        for marker in (
            "contract boundary",
            "state boundary",
            "runtime boundary",
            "call boundary",
            "coverage boundary",
            "qa scope rubric",
            "non-trigger examples",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_expected_behavior_spec_covers_two_divergent_samples(self) -> None:
        lower = self.spec.lower()
        for marker in (
            "success criteria",
            "failure modes",
            "negative or non-trigger examples",
            "backend-style sample",
            "frontend-style sample",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_old_java_only_baseline_did_not_leak_into_portable_body(self) -> None:
        old_baseline_terms = (
            "*Facade*.java",
            "Service ->",
            "Service ->",
            "DAO",
            "DTO",
            "@Resource",
            "@Autowired",
            "--module challenge",
        )
        for term in old_baseline_terms:
            with self.subTest(term=term):
                self.assertNotIn(term, self.skill)
                self.assertNotIn(term, self.reference)

    def test_markdown_links_resolve(self) -> None:
        link = re.compile(r"\[[^\]]+\]\(([^)#]+\.md)#([^)]+)\)")
        for source in (SKILL, REFERENCE):
            text = read(source)
            for target_name, anchor in link.findall(text):
                target = source.parent / target_name
                self.assertTrue(target.exists(), f"missing linked file: {target}")
                slugs = {
                    re.sub(r"[^\w\s&-]", "", line.lstrip("# ").strip().lower())
                    .replace("&", "")
                    .replace(" ", "-")
                    for line in read(target).splitlines()
                    if line.startswith("#")
                }
                self.assertIn(anchor, slugs)


if __name__ == "__main__":
    unittest.main()