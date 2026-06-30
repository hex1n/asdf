import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "generating-api-docs" / "SKILL.md"
TEMPLATE = ROOT / "skills" / "generating-api-docs" / "template.md"
RPC_ADAPTER = ROOT / "skills" / "generating-api-docs" / "adapters" / "rpc.md"
HTTP_ADAPTER = ROOT / "skills" / "generating-api-docs" / "adapters" / "http.md"
SPEC = ROOT / "tests" / "fixtures" / "generating_api_docs" / "expected-behavior.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def description(text: str) -> str:
    frontmatter = text.split("---", 2)[1]
    for line in frontmatter.splitlines():
        if line.startswith("description:"):
            return line.split(":", 1)[1].strip()
    return ""


class GeneratingApiDocsContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.skill = read(SKILL)
        self.template = read(TEMPLATE)
        self.rpc = read(RPC_ADAPTER)
        self.http = read(HTTP_ADAPTER)
        self.spec = read(SPEC)

    def test_description_routes_backend_api_doc_requests(self) -> None:
        desc = description(self.skill).lower()
        for marker in (
            "api docs",
            "backend interfaces",
            "rpc",
            "http/rest",
            "single interface",
            "api changes on a branch",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, desc)
        self.assertLessEqual(len(desc), 1024)

    def test_profile_adapter_spine_is_single_sourced(self) -> None:
        lower = self.skill.lower()
        for marker in (
            "docs/api-doc-profile.md",
            "adapters/{rpc|http}.md",
            "template.md",
            "profile",
            "adapter",
            "spine",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)
        self.assertIn("docs/api-doc-profile.md", self.template)
        self.assertIn("profile", self.template.lower())

    def test_diff_and_feature_scope_include_reused_and_deleted_contracts(self) -> None:
        for marker in (
            "git diff {base}...HEAD",
            "git show {base}:path/to/file.java",
            "git show {base}:file",
            "reused interfaces",
            "deleted",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.skill)

    def test_recursive_field_paths_and_change_columns_are_documented(self) -> None:
        combined = f"{self.skill}\n{self.template}"
        for marker in (
            "field.sub",
            "field[].sub",
            "data.field",
            "change",
            "old->new",
            "deleted",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker.lower(), combined.lower())

    def test_rpc_and_http_adapters_cover_distinct_protocol_contracts(self) -> None:
        rpc_lower = self.rpc.lower()
        http_lower = self.http.lower()
        for marker in ("operation", "envelope", "request", "response", "auth"):
            with self.subTest(adapter="rpc", marker=marker):
                self.assertIn(marker, rpc_lower)
        for marker in ("http method", "path", "query", "header", "body"):
            with self.subTest(adapter="http", marker=marker):
                self.assertIn(marker, http_lower)
        self.assertIn("do not use parameter position", rpc_lower)
        self.assertIn("position column", http_lower)

    def test_contract_boundary_excludes_internal_details(self) -> None:
        lower = self.skill.lower()
        for marker in (
            "business-rule section",
            "private enum",
            "private event",
            "implementation details",
            "target contract",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_runtime_skill_files_stay_english_first(self) -> None:
        for label, text in (
            ("skill", self.skill),
            ("template", self.template),
            ("rpc", self.rpc),
            ("http", self.http),
        ):
            with self.subTest(label=label):
                self.assertIsNone(
                    re.search(r"[\u4e00-\u9fff]", text),
                    "Runtime API docs skill files should stay English; localized docs belong outside portable skill bodies.",
                )
    def test_generated_document_language_follows_user_input(self) -> None:
        lower = self.skill.lower()
        self.assertIn("output language", lower)
        self.assertIn("language explicitly requested by the user", lower)
        self.assertIn("match the user's prompt language", lower)
        self.assertIn("keep code identifiers", lower)
        self.assertIn("user's requested language", lower)
        self.assertIn("user's prompt language", lower)
    def test_expected_behavior_spec_has_two_held_out_samples(self) -> None:
        lower = self.spec.lower()
        for marker in (
            "success criteria",
            "failure modes",
            "negative or non-trigger examples",
            "rpc sample",
            "http sample",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, lower)

    def test_portable_body_avoids_known_project_instance_leaks(self) -> None:
        combined = f"{self.skill}\n{self.rpc}\n{self.http}\n{self.template}"
        project_terms = (
            "@OperationType",
            "playId",
            "teamType",
            "seasonId",
            "FIELD_OPTION",
        )
        for term in project_terms:
            with self.subTest(term=term):
                self.assertNotIn(term, combined)

    def test_markdown_links_resolve(self) -> None:
        link = re.compile(r"\[[^\]]+\]\(([^)#]+\.md)#([^)]+)\)")
        for source in (SKILL, TEMPLATE, RPC_ADAPTER, HTTP_ADAPTER):
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