import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "bootstrap-agent-os" / "SKILL.md"
REFERENCE = ROOT / "skills" / "bootstrap-agent-os" / "REFERENCE.md"
SPEC = ROOT / "tests" / "fixtures" / "bootstrap_agent_os" / "expected-behavior.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def description(text: str) -> str:
    frontmatter = text.split("---", 2)[1]
    for line in frontmatter.splitlines():
        if line.startswith("description:"):
            return line.split(":", 1)[1].strip()
    return ""


def markdown_section(text: str, heading: str) -> str:
    pattern = rf"^### {re.escape(heading)}\n(?P<body>.*?)(?=^### |\Z)"
    match = re.search(pattern, text, flags=re.MULTILINE | re.DOTALL)
    return match.group("body") if match else ""


class BootstrapAgentOSContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.skill = read(SKILL)
        self.reference = read(REFERENCE)
        self.spec = read(SPEC)

    def test_description_routes_project_agent_bootstrap_requests(self) -> None:
        desc = description(self.skill).lower()
        for marker in (
            "project-level agent workflow",
            "agents.md",
            "vision.md",
            "repo profiles",
            "agent-workflows",
            "goal/evidence/profile structure",
            "do not use",
            "feature implementation",
            "api documentation",
            "product requirements",
            "design docs",
            "business glossary edits",
            "unless the task changes agent workflow routing",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, desc)
        self.assertLessEqual(len(desc), 900)

    def test_runtime_body_stays_english_first(self) -> None:
        self.assertIsNone(
            re.search(r"[\u4e00-\u9fff]", self.skill),
            "Runtime SKILL.md should stay English; generated project docs may be localized.",
        )

    def test_output_language_follows_user_input(self) -> None:
        lower = self.skill.lower()
        for marker in (
            "output language",
            "language explicitly requested by the user",
            "match the user's prompt language",
            "preserve code identifiers",
            "quoted source text",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_workflow_has_layered_bootstrap_gates(self) -> None:
        lower = self.skill.lower()
        for marker in (
            "inventory operating assets",
            "assign each rule to one layer",
            "bootstrap or repair the skeleton",
            "define goal and evidence contracts",
            "self-check",
            "completion criterion",
            "startup route",
            "direction anchor",
            "repo profile",
            "workflow assets",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_reference_defines_bootstrap_contracts(self) -> None:
        lower = self.reference.lower()
        for marker in (
            "## layer contracts",
            "startup route",
            "direction anchor",
            "repo profile",
            "workflow assets",
            "## bootstrap tree",
            "## goal and evidence contracts",
            "runtime gate",
            "audit checklist",
            "non-trigger examples",
            "generalization samples",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_direction_anchor_report_only_rows_are_generic(self) -> None:
        body = markdown_section(self.reference, "Direction Anchor").lower()
        self.assertIn("report-only signal categories", body)
        self.assertIn("reusable risk classes", body)
        self.assertIn("feature instances", body)
        self.assertIn("evidence/source receipts", body)
        self.assertIn("not the signal name", body)
        self.assertIn("signal names are copied from one feature's names, fields, enum values, or temporary examples", body)
        for term in (
            "salesfundmp",
            "fundsalesmrksupport",
            "custom team",
            "challenge",
            "ranking",
            "registration",
            "season",
            "team type",
            "sofarpc",
            "oceanbase",
        ):
            with self.subTest(term=term):
                self.assertNotIn(term, body)

    def test_readme_catalogs_the_skill(self) -> None:
        for path in (ROOT / "README.md", ROOT / "README.zh-CN.md"):
            with self.subTest(path=path.name):
                text = read(path)
                self.assertIn("[`bootstrap-agent-os`](skills/bootstrap-agent-os/)", text)

    def test_expected_behavior_spec_has_two_divergent_samples(self) -> None:
        lower = self.spec.lower()
        for marker in (
            "success criteria",
            "failure modes",
            "negative or non-trigger examples",
            "backend-style sample",
            "frontend-style sample",
            "product requirement, design doc, or business glossary",
            "unless the task changes agent workflow routing",
            "report-only signal names",
            "evidence/source receipts",
            "reusable risk categories",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_portable_body_avoids_source_project_leaks(self) -> None:
        combined = (self.skill + "\n" + self.reference).lower()
        forbidden = (
            "salesfundmp",
            "fundsalesmrksupport",
            "thfund",
            "11111",
            "sofarpc",
            "oceanbase",
            "asset import",
            "custom team",
            "db-mcp",
        )
        for term in forbidden:
            with self.subTest(term=term):
                self.assertNotIn(term, combined)

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
