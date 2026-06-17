"""Tests for java_advisory_scan.py. Run: python3 tests/test_java_advisory_scan.py."""
import os
import sys
import tempfile
import unittest
import warnings
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import java_advisory_scan as scan  # noqa: E402

warnings.filterwarnings("ignore", category=ResourceWarning)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class JavaAdvisoryScanTest(unittest.TestCase):
    def test_secret_defaults_are_blocker(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/resources/application.yml",
                "ai:\n  gemini:\n    api-key: ${GEMINI_API_KEY:AIza-real-key}\n",
            )

            result = scan.scan_project(str(root))
            findings = result["findings"]

            self.assertEqual(1, len(findings))
            self.assertEqual("blocker", findings[0]["severity"])
            self.assertEqual("security", findings[0]["category"])
            self.assertEqual("P2", findings[0]["proof_tier"])
            self.assertEqual("src/main/resources/application.yml", findings[0]["file"])

    def test_test_like_secret_defaults_are_not_hard_blockers(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/test/resources/application-test.yml",
                "ai:\n  gemini:\n    api-key: ${GEMINI_API_KEY:test-gemini-key}\n",
            )

            default_result = scan.scan_project(str(root))
            included_result = scan.scan_project(str(root), include_tests=True)

            self.assertEqual([], default_result["findings"])
            self.assertEqual("major", included_result["findings"][0]["severity"])
            self.assertEqual("needs-check", included_result["findings"][0]["confidence"])
            self.assertEqual("P3", included_result["findings"][0]["proof_tier"])

    def test_jdk8_flags_too_new_java_features(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>1.8</java.version></properties></project>")
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\nimport java.util.List;\nclass Demo { void x() { var names = List.of(\"a\"); } }\n",
            )

            result = scan.scan_project(str(root))
            rules = [item["rule"] for item in result["findings"]]

            self.assertTrue(any("local-variable type inference" in rule for rule in rules))
            self.assertTrue(any("collection factory methods" in rule for rule in rules))

    def test_jdk_scan_ignores_keywords_inside_string_literals(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>1.8</java.version></properties></project>")
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\n"
                "class Demo {\n"
                "  String text = \" redis record size(more List.of( \";\n"
                "}\n",
            )

            result = scan.scan_project(str(root))

            self.assertFalse(any(item["category"] == "jdk" for item in result["findings"]))

    def test_multimodule_root_scans_main_sources_without_tests_by_default(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "service-a/src/main/java/example/Demo.java",
                "package example;\n"
                "import org.springframework.beans.factory.annotation.Autowired;\n"
                "class Demo {\n"
                "  @Autowired\n"
                "  private Object dependency;\n"
                "}\n",
            )
            write(
                root / "service-b/src/test/java/example/DemoTest.java",
                "package example;\n"
                "import java.util.concurrent.CompletableFuture;\n"
                "class DemoTest { void run() { CompletableFuture.runAsync(() -> work()); } void work() {} }\n",
            )

            default_result = scan.scan_project(str(root))
            included_result = scan.scan_project(str(root), include_tests=True)

            self.assertTrue(any(item["file"] == "service-a/src/main/java/example/Demo.java" for item in default_result["findings"]))
            self.assertFalse(any(item["file"] == "service-b/src/test/java/example/DemoTest.java" for item in default_result["findings"]))
            self.assertTrue(any(item["file"] == "service-b/src/test/java/example/DemoTest.java" for item in included_result["findings"]))

    def test_collectors_to_list_is_not_stream_to_list(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>1.8</java.version></properties></project>")
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\nimport java.util.stream.Collectors;\nclass Demo { Object x(java.util.stream.Stream<String> s) { return s.collect(Collectors.toList()); } }\n",
            )

            result = scan.scan_project(str(root))

            self.assertFalse(any("Stream.toList" in item["rule"] for item in result["findings"]))

    def test_spring_boot_namespace_mismatch(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "pom.xml",
                "<project><parent><artifactId>spring-boot-starter-parent</artifactId><version>2.7.18</version></parent></project>",
            )
            write(root / "src/main/java/example/Demo.java", "package example;\nimport jakarta.validation.Valid;\nclass Demo {}\n")

            result = scan.scan_project(str(root))
            rendered = scan.render_markdown(result)

            self.assertTrue(any(item["category"] == "spring" and item["severity"] == "blocker" for item in result["findings"]))
            self.assertTrue(any(item["proof_tier"] == "P2" for item in result["findings"]))
            self.assertIn("Spring Boot: 2.7.18", rendered)
            self.assertIn("| Severity | Category | Confidence | Proof | Location | Rule | Impact | Fix |", rendered)

    def test_scanner_is_advisory_by_default(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "src/main/resources/application.yml", "api-key: ${API_KEY:sk-real-key}\n")

            result = scan.scan_project(str(root))

            self.assertTrue(result["findings"])
            self.assertFalse(scan.should_fail(result["findings"], "none"))
            self.assertTrue(scan.should_fail(result["findings"], "blocker"))

    def test_field_injection_and_common_pool_are_likely_findings(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\n"
                "import org.springframework.beans.factory.annotation.Autowired;\n"
                "import java.util.concurrent.CompletableFuture;\n"
                "class Demo {\n"
                "  @Autowired\n"
                "  private Object dependency;\n"
                "  @Autowired\n"
                "  private Object otherDependency;\n"
                "  void run() { CompletableFuture.runAsync(() -> work()); }\n"
                "  void work() {}\n"
                "}\n",
            )

            result = scan.scan_project(str(root))
            rules = [item["rule"] for item in result["findings"]]

            self.assertTrue(any("field injection" in rule for rule in rules))
            self.assertTrue(any("common pool" in rule for rule in rules))

    def test_markdown_prioritizes_action_candidates_over_broad_cleanup(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\n"
                "import org.springframework.beans.factory.annotation.Autowired;\n"
                "import java.util.concurrent.CompletableFuture;\n"
                "class Demo {\n"
                "  @Autowired\n"
                "  private Object dependency;\n"
                "  @Autowired\n"
                "  private Object otherDependency;\n"
                "  void run() { CompletableFuture.runAsync(() -> work()); }\n"
                "  void work() {}\n"
                "}\n",
            )

            result = scan.scan_project(str(root))
            rendered = scan.render_markdown(result)

            self.assertIn("## Risk Index", rendered)
            self.assertIn("- Total Risk Signals: 3", rendered)
            self.assertIn("## Action Candidates", rendered)
            candidates = rendered.split("## Action Candidates", 1)[1].split("## Detailed Findings", 1)[0]
            self.assertLess(candidates.find("common pool"), candidates.find("field injection"))
            self.assertEqual(1, candidates.count("field injection hides required dependencies"))
            self.assertIn("examples=2", candidates)
            self.assertIn("Failure Path:", candidates)
            self.assertIn("Fix:", candidates)

    def test_markdown_detail_findings_are_bounded_by_default(self):
        findings = []
        for index in range(scan.DEFAULT_DETAIL_LIMIT + 5):
            findings.append(
                {
                    "severity": "minor",
                    "category": "logging",
                    "confidence": "confirmed",
                    "proof_tier": "P3",
                    "file": f"src/main/java/example/Demo{index}.java",
                    "line": 10,
                    "rule": "console logging bypasses application logging",
                    "impact": "logs lose structure",
                    "fix": "use SLF4J parameterized logging",
                }
            )
        result = {"project": {"jdk": 17, "source": "pom.xml", "spring": {}, "note": None}, "findings": findings}

        rendered = scan.render_markdown(result)

        self.assertIn(f"Showing {scan.DEFAULT_DETAIL_LIMIT} of {scan.DEFAULT_DETAIL_LIMIT + 5} findings", rendered)
        self.assertEqual(scan.DEFAULT_DETAIL_LIMIT, rendered.count("console logging bypasses application logging |"))

    def test_max_findings_preserves_full_summary_and_candidates(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\n"
                "import org.springframework.beans.factory.annotation.Autowired;\n"
                "import java.util.concurrent.CompletableFuture;\n"
                "class Demo {\n"
                "  @Autowired\n"
                "  private Object dependency;\n"
                "  @Autowired\n"
                "  private Object otherDependency;\n"
                "  void run() { CompletableFuture.runAsync(() -> work()); }\n"
                "  void work() {}\n"
                "}\n",
            )

            result = scan.scan_project(str(root), max_findings=1)
            rendered = scan.render_markdown(result)
            candidates = rendered.split("## Action Candidates", 1)[1].split("## Detailed Findings", 1)[0]

            self.assertEqual(1, len(result["findings"]))
            self.assertIn("- Total Risk Signals: 3", rendered)
            self.assertIn("Detailed Findings contains 1 of 3 sorted signals", rendered)
            self.assertIn("common pool", candidates)
            self.assertIn("field injection hides required dependencies", candidates)
            self.assertIn("examples=2", candidates)

    def test_run_async_with_explicit_executor_is_not_flagged(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/java/example/Demo.java",
                "package example;\n"
                "import java.util.concurrent.CompletableFuture;\n"
                "class Demo {\n"
                "  Object executor;\n"
                "  void run() {\n"
                "    CompletableFuture.runAsync(() -> {\n"
                "      work();\n"
                "    }, executor);\n"
                "  }\n"
                "  void work() {}\n"
                "}\n",
            )

            result = scan.scan_project(str(root))

            self.assertFalse(any("common pool" in item["rule"] for item in result["findings"]))

    def test_max_depth_controls_build_file_detection(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "a/b/pom.xml", "<project><properties><java.version>17</java.version></properties></project>")

            shallow = scan.scan_project(str(root), max_depth=1)
            deep = scan.scan_project(str(root), max_depth=2)

            self.assertIsNone(shallow["project"]["jdk"])
            self.assertEqual(17, deep["project"]["jdk"])

    def test_scanner_does_not_include_project_specific_chat_route_rule(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/java/example/ChatController.java",
                "package example;\n"
                "import org.springframework.web.bind.annotation.RequestMapping;\n"
                "@RequestMapping(\"/api/chat\")\n"
                "class ChatController {}\n",
            )
            write(
                root / "src/main/java/example/WebConfig.java",
                "package example;\n"
                "class WebConfig { void add(Object r) { r.toString(); /* addPathPatterns(\"/api/users/**\") */ } }\n",
            )

            result = scan.scan_project(str(root))

            self.assertFalse(any("chat routes" in item["rule"] for item in result["findings"]))


if __name__ == "__main__":
    unittest.main()
