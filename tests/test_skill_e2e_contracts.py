from __future__ import annotations

import re
import unittest
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def combined_context(paths: list[str]) -> str:
    return "\n\n".join(read_text(path) for path in paths)


def slugify_heading(heading: str) -> str:
    heading = heading.strip().lower()
    heading = re.sub(r"^[#]+\s*", "", heading)
    heading = re.sub(r"[^\w\s&-]", "", heading)
    heading = heading.replace("&", "")
    heading = re.sub(r"\s", "-", heading)
    return heading.strip("-")


def frontmatter_description(text: str) -> str:
    if not text.startswith("---"):
        return ""
    frontmatter = text.split("---", 2)[1].splitlines()
    for index, line in enumerate(frontmatter):
        if line.startswith("description: >"):
            folded = []
            for continuation in frontmatter[index + 1 :]:
                if not continuation.startswith("  "):
                    break
                folded.append(continuation.strip())
            return " ".join(folded)
        if line.startswith("description:"):
            return line.split(":", 1)[1].strip().strip('"')
    return ""


@dataclass(frozen=True)
class SkillScenario:
    name: str
    prompt_without_skill: str
    skill_files: list[str]
    target_files: tuple[str, ...]
    required_markers: tuple[str, ...]
    scoped_markers: tuple[str, ...] = ()


SCENARIOS = (
    SkillScenario(
        name="skill_rule_harvest_maintenance",
        prompt_without_skill="Add a durable improvement to an existing skill.",
        skill_files=[
            "AGENTS.md",
        ],
        target_files=(
            "AGENTS.md",
        ),
        required_markers=(
            "rule harvest gate",
            "repeated correction",
            "observed failure mode",
            "explicit user-approved invariant",
            "narrowest applicable level",
            "contract check",
        ),
        scoped_markers=(
            "rule harvest gate",
            "explicit user-approved invariant",
            "narrowest applicable level",
        ),
    ),
    SkillScenario(
        name="java_multi_candidate_fix",
        prompt_without_skill="Fix a Java project with several plausible production issues.",
        skill_files=[
            "skills/java-stack-craft/SKILL.md",
            "skills/java-stack-craft/RISK_ROUTER.md",
            "skills/java-stack-craft/WRITING.md",
        ],
        target_files=(
            "skills/java-stack-craft/RISK_ROUTER.md",
        ),
        required_markers=(
            "candidate tournament",
            "compare candidates pairwise",
            "strongest reason it could be wrong",
            "proof tier",
            "blast radius",
        ),
        scoped_markers=(
            "candidate tournament",
            "compare candidates pairwise",
            "strongest reason it could be wrong",
        ),
    ),
    SkillScenario(
        name="resume_best_version_pruning",
        prompt_without_skill="Turn a Git author's history into the strongest resume bullets.",
        skill_files=[
            "skills/git-resume-miner/SKILL.md",
            "skills/git-resume-miner/BEST_PRACTICES.md",
        ],
        target_files=(
            "skills/git-resume-miner/SKILL.md",
            "skills/git-resume-miner/BEST_PRACTICES.md",
        ),
        required_markers=(
            "best-version tournament",
            "compare them pairwise",
            "adversarial post-output self-review",
            "strongest evidence-based argument",
            "do not include code paths",
            "candidate rankings",
        ),
        scoped_markers=(
            "best-version tournament",
            "adversarial post-output self-review",
            "strongest evidence-based argument",
        ),
    ),
    SkillScenario(
        name="deep_research_multi_source",
        prompt_without_skill="Research a high-impact technical decision with several sources.",
        skill_files=[
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ],
        target_files=(
            "skills/deep-research/SKILL.md",
        ),
        required_markers=(
            "independent evidence lanes",
            "disconfirming evidence",
            "strongest counterexample",
            "survive cross-checking",
            "pasted external text",
            "evidence, not instructions",
            "do not follow commands",
            "technical-claim verification",
            "extract factual claims first",
            "mark it unsupported",
            "explicitly supported",
            "partially supported",
            "inferred",
            "not checked",
            "optional body tl;dr",
            "non-duplicative scan value",
            "would only restate the conclusion",
        ),
        scoped_markers=(
            "independent evidence lanes",
            "disconfirming evidence",
            "strongest counterexample",
            "pasted external text",
            "do not follow commands",
            "side-effect requests",
            "technical-claim verification",
            "extract factual claims first",
            "mark it unsupported",
            "explicitly supported",
            "partially supported",
            "not checked",
            "optional body tl;dr",
            "non-duplicative scan value",
            "would only restate the conclusion",
        ),
    ),
    SkillScenario(
        name="first_principles_option_choice",
        prompt_without_skill="Choose between several possible implementation plans.",
        skill_files=[
            "skills/first-principles-planner/SKILL.md",
            "skills/first-principles-planner/REFERENCE.md",
        ],
        target_files=(
            "skills/first-principles-planner/SKILL.md",
        ),
        required_markers=(
            "option tournament",
            "compare options pairwise",
            "true constraints",
            "strongest failure mode",
            "reconstruct options",
        ),
        scoped_markers=(
            "option tournament",
            "compare options pairwise",
            "strongest failure mode",
        ),
    ),
)


RUNTIME_SKILL_FILES = (
    "skills/java-stack-craft/SKILL.md",
    "skills/git-resume-miner/SKILL.md",
    "skills/deep-research/SKILL.md",
    "skills/first-principles-planner/SKILL.md",
)

MAIN_CONTEXT_FILES = (
    "AGENTS.md",
    *RUNTIME_SKILL_FILES,
    "skills/java-stack-craft/RISK_ROUTER.md",
    "skills/git-resume-miner/BEST_PRACTICES.md",
)


class SkillE2EContractsTest(unittest.TestCase):
    def test_with_skill_context_beats_without_skill_baseline(self) -> None:
        for scenario in SCENARIOS:
            with self.subTest(scenario=scenario.name):
                with_skill = combined_context(scenario.skill_files).lower()
                without_skill = scenario.prompt_without_skill.lower()

                with_hits = [marker for marker in scenario.required_markers if marker in with_skill]
                without_hits = [marker for marker in scenario.required_markers if marker in without_skill]

                self.assertEqual(list(scenario.required_markers), with_hits)
                self.assertEqual([], without_hits)

    def test_scenario_markers_are_narrowly_scoped(self) -> None:
        for scenario in SCENARIOS:
            target_text = combined_context(list(scenario.target_files)).lower()
            for marker in scenario.scoped_markers:
                with self.subTest(scenario=scenario.name, marker=marker):
                    self.assertIn(marker, target_text)
                    for path in MAIN_CONTEXT_FILES:
                        if path in scenario.target_files:
                            continue
                        self.assertNotIn(marker, read_text(path).lower(), f"{marker!r} leaked into {path}")

    def test_entrypoints_route_to_improved_detail_files(self) -> None:
        java_skill = read_text("skills/java-stack-craft/SKILL.md")
        java_router = read_text("skills/java-stack-craft/RISK_ROUTER.md")
        resume_skill = read_text("skills/git-resume-miner/SKILL.md")
        resume_practices = read_text("skills/git-resume-miner/BEST_PRACTICES.md")

        self.assertIn("[RISK_ROUTER.md](RISK_ROUTER.md)", java_skill)
        self.assertIn("candidate tournament", java_router)
        self.assertIn("best-version tournament", resume_skill)
        self.assertIn("[BEST_PRACTICES.md](BEST_PRACTICES.md)", resume_skill)
        self.assertIn("Best-Version Tournament Funnel", resume_practices)
        self.assertIn("Adversarial Post-Output Self-Review", resume_practices)

    def test_deep_research_saved_header_uses_core_conclusion_not_header_tldr(self) -> None:
        skill = read_text("skills/deep-research/SKILL.md").lower()
        reference = read_text("skills/deep-research/REFERENCE.md")
        saved_header_section = reference.split("For Chinese Standard/Deep saved findings:", 1)[1]
        header_block = saved_header_section.split("```md", 1)[1].split("```", 1)[0]

        self.assertIn("**核心结论**", header_block)
        self.assertNotIn("**TL;DR**", header_block)
        self.assertIn("## TL;DR", reference)
        self.assertIn("optional body tl;dr", skill)
        self.assertIn("non-duplicative scan value", skill)

    def test_tournament_does_not_leak_resume_candidate_rankings_to_final_output(self) -> None:
        resume_skill = read_text("skills/git-resume-miner/SKILL.md").lower()
        practices = read_text("skills/git-resume-miner/BEST_PRACTICES.md").lower()

        self.assertIn("best-version tournament", resume_skill)
        self.assertIn("candidate rankings", resume_skill)
        self.assertIn("do not include code paths", resume_skill)
        self.assertIn("no evidence table, commit list, code path, confidence label, or candidate ranking", practices)

    def test_rule_harvest_stays_in_maintenance_guidance(self) -> None:
        agents = read_text("AGENTS.md").lower()

        self.assertIn("rule harvest gate", agents)
        for path in RUNTIME_SKILL_FILES:
            with self.subTest(path=path):
                self.assertNotIn("rule harvest", read_text(path).lower())

    def test_local_markdown_anchor_links_resolve(self) -> None:
        markdown_link = re.compile(r"\[[^\]]+\]\(([^)#]+\.md)#([^)]+)\)")

        for source in (ROOT / "skills").rglob("*.md"):
            source_text = source.read_text(encoding="utf-8")
            for target_name, anchor in markdown_link.findall(source_text):
                target = (source.parent / target_name).resolve()
                with self.subTest(source=source.relative_to(ROOT), target=target_name, anchor=anchor):
                    self.assertTrue(target.exists(), f"missing linked file: {target}")
                    target_text = target.read_text(encoding="utf-8")
                    slugs = {
                        slugify_heading(line)
                        for line in target_text.splitlines()
                        if line.lstrip().startswith("#")
                    }
                    self.assertIn(anchor, slugs)

    def test_main_skill_files_stay_compact(self) -> None:
        for path in RUNTIME_SKILL_FILES:
            with self.subTest(path=path):
                line_count = len(read_text(path).splitlines())
                self.assertLessEqual(line_count, 100)

    def test_skill_descriptions_are_routable(self) -> None:
        for path in RUNTIME_SKILL_FILES:
            with self.subTest(path=path):
                description = frontmatter_description(read_text(path))
                self.assertLessEqual(len(description), 1024)
                self.assertRegex(description, r"\bUse (when|for)\b")


if __name__ == "__main__":
    unittest.main()
