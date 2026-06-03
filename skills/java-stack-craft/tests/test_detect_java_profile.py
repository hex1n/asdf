"""Tests for detect_java_profile.py. Run: python3 tests/test_detect_java_profile.py."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import detect_java_profile as dj  # noqa: E402


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class DetectJavaProfileTest(unittest.TestCase):
    def test_normalize_legacy_and_modern(self):
        self.assertEqual(8, dj.normalize_version("1.8"))
        self.assertEqual(8, dj.normalize_version("8"))
        self.assertEqual(17, dj.normalize_version("17"))
        self.assertEqual(21, dj.normalize_version("VERSION_21"))
        self.assertEqual(11, dj.normalize_version('"11"'))
        self.assertIsNone(dj.normalize_version("garbage"))

    def test_parse_pom_property_priority(self):
        with tempfile.TemporaryDirectory() as td:
            pom = Path(td) / "pom.xml"
            write(
                pom,
                '<project xmlns="http://maven.apache.org/POM/4.0.0">'
                "<properties><maven.compiler.source>1.8</maven.compiler.source>"
                "<maven.compiler.release>17</maven.compiler.release></properties></project>",
            )
            det = dj.parse_pom(str(pom))
            self.assertIsNotNone(det)
            self.assertEqual(17, det.version)

    def test_parse_pom_spring_boot_java_version(self):
        with tempfile.TemporaryDirectory() as td:
            pom = Path(td) / "pom.xml"
            write(
                pom,
                '<project xmlns="http://maven.apache.org/POM/4.0.0">'
                "<properties><java.version>21</java.version></properties></project>",
            )
            self.assertEqual(21, dj.parse_pom(str(pom)).version)

    def test_parse_pom_compiler_plugin(self):
        with tempfile.TemporaryDirectory() as td:
            pom = Path(td) / "pom.xml"
            write(
                pom,
                '<project xmlns="http://maven.apache.org/POM/4.0.0"><build><plugins><plugin>'
                "<artifactId>maven-compiler-plugin</artifactId>"
                "<configuration><source>1.8</source><target>1.8</target></configuration>"
                "</plugin></plugins></build></project>",
            )
            self.assertEqual(8, dj.parse_pom(str(pom)).version)

    def test_parse_gradle_toolchain(self):
        with tempfile.TemporaryDirectory() as td:
            build = Path(td) / "build.gradle.kts"
            write(build, "java {\n toolchain { languageVersion.set(JavaLanguageVersion.of(21)) }\n}")
            self.assertEqual(21, dj.parse_gradle(str(build)).version)

    def test_parse_gradle_source_compatibility(self):
        with tempfile.TemporaryDirectory() as td:
            build = Path(td) / "build.gradle"
            write(build, "sourceCompatibility = JavaVersion.VERSION_17")
            self.assertEqual(17, dj.parse_gradle(str(build)).version)

    def test_gradle_ignores_comments(self):
        with tempfile.TemporaryDirectory() as td:
            build = Path(td) / "build.gradle"
            write(build, "// JavaLanguageVersion.of(8)\nsourceCompatibility = '11'")
            self.assertEqual(11, dj.parse_gradle(str(build)).version)

    def test_choose_effective_prefers_root_and_warns(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            write(root / "pom.xml", '<project><properties><java.version>17</java.version></properties></project>')
            write(root / "legacy" / "pom.xml", '<project><properties><java.version>8</java.version></properties></project>')
            dets = dj.discover(str(root))
            version, _, note = dj.choose_effective(dets, str(root))
            self.assertEqual(17, version)
            self.assertIn("WARNING", note)
            self.assertIn("8", note)

    def test_manifest_gates_features(self):
        manifest = dj.build_manifest(11)
        labels = " ".join(feature["feature"] for feature in manifest["use_freely"])
        self.assertIn("Lambdas", labels)
        self.assertIn("var", labels)
        self.assertTrue(all("record" not in feature["feature"] for feature in manifest["use_freely"]))
        self.assertTrue(any("record" in feature["feature"] for feature in manifest["not_yet_available"]))
        self.assertTrue(any("String templates" in feature["feature"] for feature in manifest["never_use"]))
        self.assertIs(manifest["is_lts"], True)

    def test_manifest_j21_has_virtual_threads(self):
        manifest = dj.build_manifest(21)
        self.assertTrue(any("Virtual threads" in feature["feature"] for feature in manifest["use_freely"]))

    def test_spring_boot_3_parent_is_jakarta(self):
        with tempfile.TemporaryDirectory() as td:
            write(
                Path(td) / "pom.xml",
                '<project><parent><groupId>org.springframework.boot</groupId>'
                "<artifactId>spring-boot-starter-parent</artifactId>"
                "<version>3.2.1</version></parent></project>",
            )
            sp = dj.detect_spring_boot(td)
            self.assertEqual(3, sp["version_major"])
            self.assertEqual("jakarta", sp["namespace"])

    def test_spring_boot_2_property_is_javax(self):
        with tempfile.TemporaryDirectory() as td:
            write(
                Path(td) / "pom.xml",
                '<project><properties><spring-boot.version>2.7.18</spring-boot.version>'
                "</properties></project>",
            )
            sp = dj.detect_spring_boot(td)
            self.assertEqual(2, sp["version_major"])
            self.assertEqual("javax", sp["namespace"])

    def test_spring_boot_gradle_plugin(self):
        with tempfile.TemporaryDirectory() as td:
            write(Path(td) / "build.gradle.kts", 'plugins { id("org.springframework.boot") version "3.3.0" }')
            sp = dj.detect_spring_boot(td)
            self.assertEqual(3, sp["version_major"])
            self.assertEqual("jakarta", sp["namespace"])

    def test_spring_boot_property_placeholder_skipped(self):
        with tempfile.TemporaryDirectory() as td:
            write(
                Path(td) / "pom.xml",
                '<project><parent><artifactId>spring-boot-starter-parent</artifactId>'
                "<version>${revision}</version></parent></project>",
            )
            self.assertIsNone(dj.detect_spring_boot(td))

    def test_no_spring_boot_returns_none(self):
        with tempfile.TemporaryDirectory() as td:
            write(Path(td) / "pom.xml", '<project><properties><java.version>17</java.version></properties></project>')
            self.assertIsNone(dj.detect_spring_boot(td))

    def test_no_build_file_does_not_default_to_jdk8(self):
        rendered = dj.render_markdown(dj.Result())

        self.assertIn("Ask the user", rendered)
        self.assertNotIn("default conservatively to JDK 8", rendered)

    def test_web_stack_mixed_when_both_starters(self):
        with tempfile.TemporaryDirectory() as td:
            write(
                Path(td) / "pom.xml",
                '<project><parent><groupId>org.springframework.boot</groupId>'
                "<artifactId>spring-boot-starter-parent</artifactId><version>2.7.18</version></parent>"
                "<dependencies>"
                "<dependency><artifactId>spring-boot-starter-web</artifactId></dependency>"
                "<dependency><artifactId>spring-boot-starter-webflux</artifactId></dependency>"
                "</dependencies></project>",
            )
            self.assertEqual("mixed", dj.detect_spring_boot(td)["web_stack"])

    def test_web_stack_webflux_only_not_misread_as_mvc(self):
        with tempfile.TemporaryDirectory() as td:
            write(
                Path(td) / "pom.xml",
                '<project><parent><groupId>org.springframework.boot</groupId>'
                "<artifactId>spring-boot-starter-parent</artifactId><version>3.2.1</version></parent>"
                "<dependencies>"
                "<dependency><artifactId>spring-boot-starter-webflux</artifactId></dependency>"
                "</dependencies></project>",
            )
            self.assertEqual("webflux", dj.detect_spring_boot(td)["web_stack"])


if __name__ == "__main__":
    unittest.main()
