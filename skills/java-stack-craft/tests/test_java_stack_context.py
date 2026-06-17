"""Tests for java_stack.py. Run: python3 tests/test_java_stack_context.py."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import java_stack  # noqa: E402


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def profile_card_gate_lines():
    profile = Path(__file__).resolve().parents[1] / "PROFILE.md"
    section = profile.read_text(encoding="utf-8").split("Card promotion gate:", 1)[1].split("```md", 1)[0]
    return [line.strip() for line in section.splitlines() if line.strip().startswith("- ")]


class JavaStackContextTest(unittest.TestCase):
    def test_facilities_detect_common_project_seams(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>1.8</java.version></properties></project>")
            write(
                root / "src/main/java/example/OrderService.java",
                "package example;\n"
                "import lombok.extern.slf4j.Slf4j;\n"
                "import org.springframework.transaction.annotation.Transactional;\n"
                "@Slf4j\n"
                "class OrderService {\n"
                "  @Transactional\n"
                "  void save() { log.info(\"saving\"); LoggerUtil.alarm(\"failed\"); }\n"
                "  Object page(int offset, int pageSize) { return mapper.selectPageByProductId(offset, pageSize); }\n"
                "  OrderDTO toDto(OrderEntity entity) { return convert(entity); }\n"
                "}\n",
            )
            write(
                root / "src/main/java/example/GlobalErrors.java",
                "package example;\n"
                "import org.springframework.web.bind.annotation.ControllerAdvice;\n"
                "@ControllerAdvice class GlobalErrors { Result<String> handle(BizException ex) { return null; } }\n",
            )
            write(
                root / "src/main/java/example/JsonConfig.java",
                "package example;\n"
                "import com.fasterxml.jackson.databind.ObjectMapper;\n"
                "class JsonConfig { ObjectMapper mapper; }\n",
            )
            write(
                root / "src/main/java/example/IdempotencyGuard.java",
                "package example;\n"
                "class IdempotencyGuard {}\n",
            )
            write(
                root / "src/test/java/example/OrderServiceTest.java",
                "package example;\n"
                "import org.springframework.boot.test.context.SpringBootTest;\n"
                "@SpringBootTest class OrderServiceTest {}\n",
            )

            result = java_stack.discover_facilities(str(root))
            labels = {item["label"] for item in result["facilities"]}

            self.assertIn("logging/alarm", labels)
            self.assertIn("transaction boundary", labels)
            self.assertIn("pagination/query", labels)
            self.assertIn("mapper/DTO style", labels)
            self.assertIn("exception/result style", labels)
            self.assertIn("JSON/date/id/config helper", labels)
            self.assertIn("project-owned facility-like type", labels)
            self.assertIn("test idiom", labels)
            logging = next(item for item in result["facilities"] if item["label"] == "logging/alarm")
            generic = next(item for item in result["facilities"] if item["label"] == "project-owned facility-like type")
            test_idiom = next(item for item in result["facilities"] if item["label"] == "test idiom")
            self.assertTrue(logging["examples"][0]["file"].startswith("src/main/"))
            self.assertTrue(any(item["signal"] == "type:IdempotencyGuard" for item in generic["examples"]))
            self.assertTrue(test_idiom["examples"][0]["file"].startswith("src/test/"))

    def test_facilities_do_not_treat_dto_pagesize_as_pagination_tool(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "src/main/java/example/OrderDTO.java",
                "package example;\n"
                "class OrderDTO { int pageSize; int pageNo; }\n",
            )
            write(
                root / "src/main/java/example/InsuranceParam.java",
                "package example;\n"
                "class InsuranceParam { static class Policy {} java.util.UUID id; }\n",
            )

            result = java_stack.discover_facilities(str(root))
            labels = {item["label"] for item in result["facilities"]}

            self.assertNotIn("pagination/query", labels)
            self.assertNotIn("project-owned facility-like type", labels)
            self.assertNotIn("JSON/date/id/config helper", labels)

    def test_context_combines_profile_facilities_risk_and_verification_floor(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(
                root / "pom.xml",
                "<project><parent><artifactId>spring-boot-starter-parent</artifactId>"
                "<version>2.7.18</version></parent>"
                "<properties><java.version>1.8</java.version></properties>"
                "<dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies>"
                "</project>",
            )
            write(
                root / "src/main/java/example/AsyncService.java",
                "package example;\n"
                "import java.util.concurrent.CompletableFuture;\n"
                "class AsyncService { void run() { CompletableFuture.runAsync(() -> work()); } void work() {} }\n",
            )
            write(
                root / "src/main/java/example/OrderService.java",
                "package example;\n"
                "import lombok.extern.slf4j.Slf4j;\n"
                "@Slf4j class OrderService { void x() { log.info(\"x\"); } }\n",
            )

            context = java_stack.build_context(str(root))
            rendered = java_stack.render_context_markdown(context)

            self.assertEqual(8, context["target_profile"]["effective_version"])
            self.assertEqual("javax", context["target_profile"]["spring_boot"]["namespace"])
            self.assertTrue(context["project_facilities"])
            self.assertTrue(any("common pool" in item["rule"] for item in context["risk_candidates"]))
            self.assertIn("## Target Profile", rendered)
            self.assertIn("## Project Facilities", rendered)
            self.assertIn("Failure Path:", rendered)
            self.assertIn("Fix:", rendered)
            self.assertIn("## Verification Floor", rendered)

    def test_context_command_writes_repo_profile_by_default_and_preserves_human_notes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>17</java.version></properties></project>")
            write(
                root / "src/main/java/example/OrderService.java",
                "package example;\n"
                "import lombok.extern.slf4j.Slf4j;\n"
                "@Slf4j class OrderService { void x() { log.info(\"x\"); } }\n",
            )

            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                rc = java_stack.main(["context", "--dir", str(root), "--format", "markdown", "--seam", "order-service"])

            profile = root / "docs/agents/java-stack-profile.md"
            self.assertEqual(0, rc)
            self.assertTrue(profile.exists())
            first = profile.read_text(encoding="utf-8")
            self.assertIn(java_stack.GENERATED_START, first)
            self.assertIn(java_stack.GENERATED_END, first)
            self.assertIn("## Project Knowledge Cards", first)
            self.assertIn("would change a future coding, review, or verification choice", first)
            self.assertIn("Card promotion gate:", first)
            self.assertIn("Decision is an imperative action", first)
            self.assertIn("A fact failing any gate stays in the chat/report", first)
            self.assertIn("- Decision:", first)
            self.assertIn("- Use when:", first)
            self.assertIn("- Do not use when:", first)
            self.assertIn("- Evidence:", first)
            self.assertIn("## Human Notes", first)
            self.assertIn("- Touched seam: order-service", first)
            self.assertIn("Context options:", first)
            self.assertIn("max_findings=12", first)
            self.assertIn("Updated repo profile: `docs/agents/java-stack-profile.md`", output.getvalue())

            profile.write_text(first + "\n- Human keeps this note.\n", encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                rc = java_stack.main(["context", "--dir", str(root), "--format", "markdown", "--seam", "order-service"])

            second = profile.read_text(encoding="utf-8")
            self.assertEqual(0, rc)
            self.assertEqual(1, second.count(java_stack.GENERATED_START))
            self.assertEqual(1, second.count(java_stack.GENERATED_END))
            self.assertIn("- Human keeps this note.", second)

    def test_generated_profile_template_matches_profile_card_gate(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>17</java.version></properties></project>")

            with contextlib.redirect_stdout(io.StringIO()):
                rc = java_stack.main(["context", "--dir", str(root)])

            profile = (root / "docs/agents/java-stack-profile.md").read_text(encoding="utf-8")
            self.assertEqual(0, rc)
            for line in profile_card_gate_lines():
                with self.subTest(line=line):
                    self.assertIn(line, profile)

    def test_profile_refresh_repairs_malformed_generated_markers(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>17</java.version></properties></project>")
            profile = root / "docs/agents/java-stack-profile.md"
            write(
                profile,
                "# Java Stack Profile\n\n"
                f"{java_stack.GENERATED_START}\n"
                "partial generated content without an end marker\n\n"
                "## Human Notes\n\n"
                "- Keep this project convention.\n",
            )

            with contextlib.redirect_stdout(io.StringIO()):
                rc = java_stack.main(["context", "--dir", str(root)])

            repaired = profile.read_text(encoding="utf-8")
            self.assertEqual(0, rc)
            self.assertEqual(1, repaired.count(java_stack.GENERATED_START))
            self.assertEqual(1, repaired.count(java_stack.GENERATED_END))
            self.assertNotIn("partial generated content", repaired)
            self.assertIn("- Keep this project convention.", repaired)

    def test_profile_refresh_preserves_cards_after_malformed_generated_start(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>17</java.version></properties></project>")
            profile = root / "docs/agents/java-stack-profile.md"
            write(
                profile,
                "# Java Stack Profile\n\n"
                f"{java_stack.GENERATED_START}\n"
                "partial generated content without an end marker\n\n"
                "## Project Knowledge Cards\n\n"
                "### logging/alarm\n"
                "- Decision: keep using the local alarm helper.\n"
                "- Use when: business alarm paths are touched.\n"
                "- Do not use when: diagnostic-only logs are enough.\n"
                "- Evidence: src/main/java/example/AlarmLogger.java:12\n"
                "- Last verified: test\n",
            )

            with contextlib.redirect_stdout(io.StringIO()):
                rc = java_stack.main(["context", "--dir", str(root)])

            repaired = profile.read_text(encoding="utf-8")
            self.assertEqual(0, rc)
            self.assertEqual(1, repaired.count(java_stack.GENERATED_START))
            self.assertEqual(1, repaired.count(java_stack.GENERATED_END))
            self.assertNotIn("partial generated content", repaired)
            self.assertIn("### logging/alarm", repaired)
            self.assertIn("- Decision: keep using the local alarm helper.", repaired)

    def test_context_command_can_run_without_writing_profile(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>11</java.version></properties></project>")

            with contextlib.redirect_stdout(io.StringIO()):
                rc = java_stack.main(["context", "--dir", str(root), "--no-write-profile"])

            self.assertEqual(0, rc)
            self.assertFalse((root / "docs/agents/java-stack-profile.md").exists())

    def test_context_command_rejects_missing_project_root_without_writing_profile(self):
        with tempfile.TemporaryDirectory() as td:
            missing = Path(td) / "missing-project"

            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as stderr:
                rc = java_stack.main(["context", "--dir", str(missing)])

            self.assertEqual(2, rc)
            self.assertIn("--dir must be an existing project directory", stderr.getvalue())
            self.assertFalse(missing.exists())

    def test_profile_json_is_valid(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", "<project><properties><java.version>17</java.version></properties></project>")

            profile = java_stack.build_profile(str(root))
            payload = json.loads(java_stack.render_profile_json(profile))

            self.assertEqual(17, payload["effective_version"])
            self.assertIn("manifest", payload)


if __name__ == "__main__":
    unittest.main()
