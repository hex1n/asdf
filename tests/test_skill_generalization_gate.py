"""Contract test for the Generalization Gate (see AGENTS.md).

Freezes the manual pre-commit gate-scan into a mechanical regression guard:
portable skill bodies must not carry the source-project instance leaks that were
cleaned out, and the gate rule itself must stay documented.

Scope is deliberate. This catches the *unambiguous, token-shaped* leaks — the
specific source-project domain vocabulary, dangling internal references, and
project-specific detection annotations we removed. It does NOT police branded
framework/product names (a legitimate `@KafkaListener` example, or SOFARPC /
Dubbo named in an adapter): those can be the framework a skill legitimately
targets, and a denylist cannot tell a legit framework example from a
category/product confusion. Judgment-level leaks stay the human N>=2
Generalization Gate's job, per AGENTS.md.

Note: AGENTS.md itself is intentionally out of scope — it must name leak
examples (team-type, playId) to teach the rule, and it is not a portable skill
body. Only files under skills/ (excluding test/fixture dirs) are scanned.
"""
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

# .md files under these segments are not portable skill bodies; they may carry
# concrete domains on purpose (skill-level tests, fixtures).
_EXCLUDED_SEGMENTS = {"tests", "fixtures"}


def _skill_body_files():
    files = []
    for path in SKILLS_DIR.rglob("*.md"):
        if _EXCLUDED_SEGMENTS & set(path.relative_to(SKILLS_DIR).parts):
            continue
        files.append(path)
    return files


# Each entry is (term, whole_word). whole_word=True wraps the term in \b...\b so
# that, e.g., a hit requires the standalone token; whole_word=False is a plain
# substring match, used for terms that contain spaces or non-word characters
# (a leading "@", a "/") where \b boundaries do not behave usefully.
_SOURCE_DOMAIN_VOCAB = [
    ("playId", True),
    ("teamType", True),
    ("team-type", True),
    ("seasonId", True),
    ("FIELD_OPTION", True),
]
_DANGLING_REFERENCES = [
    ("Spec Guard", False),
    ("docs/business-rules", False),
]
_PROJECT_DETECTION_ANNOTATIONS = [
    ("@OperationType", False),
]


def _present(term, whole_word, text):
    if whole_word:
        return re.search(rf"\b{re.escape(term)}\b", text) is not None
    return term in text


class GeneralizationGateContractTest(unittest.TestCase):
    def _assert_terms_absent(self, terms, label):
        offenders = []
        for path in _skill_body_files():
            text = path.read_text(encoding="utf-8")
            for term, whole_word in terms:
                if _present(term, whole_word, text):
                    offenders.append(
                        f"{path.relative_to(REPO_ROOT).as_posix()}: {term!r}"
                    )
        self.assertFalse(
            offenders,
            f"{label} leaked into portable skill bodies. Generalize per the "
            "AGENTS.md Generalization Gate (use a neutral placeholder, or a term "
            "that fits a second divergent domain):\n  " + "\n  ".join(sorted(offenders)),
        )

    def test_scan_covers_skill_bodies(self):
        # Guard against a path bug silently making the deny-tests vacuous.
        names = {p.relative_to(SKILLS_DIR).as_posix() for p in _skill_body_files()}
        self.assertIn("generating-api-docs/SKILL.md", names)
        self.assertGreater(len(names), 5)

    def test_no_source_project_domain_vocabulary(self):
        self._assert_terms_absent(_SOURCE_DOMAIN_VOCAB, "Source-project domain vocabulary")

    def test_no_dangling_internal_references(self):
        self._assert_terms_absent(_DANGLING_REFERENCES, "Dangling internal reference")

    def test_no_project_specific_detection_annotations(self):
        self._assert_terms_absent(
            _PROJECT_DETECTION_ANNOTATIONS, "Project-specific detection annotation"
        )

    def test_generalization_gate_is_documented(self):
        agents = (REPO_ROOT / "AGENTS.md").read_text(encoding="utf-8")
        for marker in ("Generalization Gate", "second, different-domain", "provisional"):
            with self.subTest(marker=marker):
                self.assertIn(marker, agents)


if __name__ == "__main__":
    unittest.main()
