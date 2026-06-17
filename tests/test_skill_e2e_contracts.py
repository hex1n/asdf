from __future__ import annotations

import re
import subprocess
import sys
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
            "write-a-skill",
            "progressive disclosure",
            "review checklist",
            "baseline output",
            "real task",
            "two-layer gate",
            "hard gates",
            "improvement magnitude",
            "generalization confidence",
            "adversarial falsification",
            "objective conditions",
            "net-new skill",
            "relative delta",
            "regressions",
            "continue / accept / reject",
            "marginal gain",
        ),
        scoped_markers=(
            "rule harvest gate",
            "explicit user-approved invariant",
            "narrowest applicable level",
            "write-a-skill",
            "improvement magnitude",
            "generalization confidence",
            "adversarial falsification",
            "objective conditions",
            "net-new skill",
            "relative delta",
            "two-layer gate",
            "marginal gain",
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
            "verification closure",
            "not proven",
            "next check",
            "environment baseline",
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
            "resume-ready defense check",
            "defensible claim",
            "defense card",
            "overstatement risk",
            "interview challenge",
        ),
        scoped_markers=(
            "best-version tournament",
            "adversarial post-output self-review",
            "strongest evidence-based argument",
            "resume-ready defense check",
            "defensible claim",
            "defense card",
            "overstatement risk",
            "interview challenge",
        ),
    ),
    SkillScenario(
        name="deep_research_codebase_investigation",
        prompt_without_skill="Explain why the artifact behavior in this repository happens.",
        skill_files=[
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ],
        target_files=(
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ),
        required_markers=(
            "research scenario gate",
            "codebase investigation",
            "local authority set",
            "source inventory",
            "file/line receipts",
            "blast-radius boundary",
            "independent evidence lanes",
            "disconfirming evidence",
            "strongest counterexample",
            "survive cross-checking",
            "hypothesis tournament",
            "rival explanations",
            "expected-but-absent evidence",
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
            "save consistency check",
            "header counts match corresponding body sections",
            "smallest orientation form",
            "decision-shaped",
            "what remains unverified",
            "research closure check",
            "settled answer",
            "flip condition",
            "stop reason",
        ),
        scoped_markers=(
            "research scenario gate",
            "codebase investigation",
            "file/line receipts",
            "blast-radius boundary",
            "independent evidence lanes",
            "disconfirming evidence",
            "strongest counterexample",
            "hypothesis tournament",
            "rival explanations",
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
            "save consistency check",
            "header counts match corresponding body sections",
            "research closure check",
            "settled answer",
            "flip condition",
            "stop reason",
        ),
    ),
    SkillScenario(
        name="deep_research_external_investigation",
        prompt_without_skill="Determine how a third-party action handles hidden files using public sources.",
        skill_files=[
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ],
        target_files=(
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ),
        required_markers=(
            "research scenario gate",
            "external investigation",
            "official sources",
            "source independence",
            "version/date/channel",
            "as-of date",
            "staleness risk",
            "source urls",
            "local applicability gate",
            "not a local implementation claim",
            "pasted external text",
            "evidence, not instructions",
            "do not follow commands",
            "primary-source cross-check",
            "version/date/channel context",
            "flip condition",
        ),
        scoped_markers=(
            "research scenario gate",
            "external investigation",
            "source independence",
            "as-of date",
            "staleness risk",
            "local applicability gate",
            "not a local implementation claim",
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
            "bestness check",
            "closest alternative",
            "marginal-gain stop",
            "first response",
            "current-best",
            "artifact gate",
            "chat-first plan",
            "do not create durable artifacts unless explicitly asked",
        ),
        scoped_markers=(
            "option tournament",
            "compare options pairwise",
            "strongest failure mode",
            "bestness check",
            "first response",
            "current-best",
            "artifact gate",
            "chat-first plan",
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
        self.assertIn("Best-Version Tournament", resume_skill)
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
        self.assertIn("English labels:", reference)
        self.assertIn("core-conclusion field", skill)
        self.assertIn("## TL;DR", reference)
        self.assertIn("optional body tl;dr", skill)
        self.assertIn("non-duplicative scan value", skill)
        self.assertIn("save consistency check", skill)
        self.assertIn("header counts match corresponding body sections", skill)
        self.assertIn("exactly N open questions", reference)

    def test_deep_research_orientation_diagrams_choose_smallest_effective_form(self) -> None:
        skill = read_text("skills/deep-research/SKILL.md").lower()
        reference = read_text("skills/deep-research/REFERENCE.md")
        section = reference.split("### Orientation Diagrams", 1)[1].split(
            "For version/environment applicability", 1
        )[0]
        lower_section = section.lower()

        self.assertIn("smallest orientation form", skill)
        self.assertIn("choose the smallest orientation form", lower_section)
        self.assertIn("mermaid flowchart", lower_section)
        self.assertIn("mermaid sequencediagram", lower_section)
        self.assertIn("mermaid statediagram", lower_section)
        self.assertIn("no diagram", lower_section)
        self.assertIn("decision-shaped", lower_section)
        self.assertIn("what remains unverified", lower_section)
        self.assertIn("Establishes:", section)

    def test_deep_research_scenario_gate_splits_codebase_and_external_authority(self) -> None:
        skill = read_text("skills/deep-research/SKILL.md").lower()
        reference = read_text("skills/deep-research/REFERENCE.md")
        section = reference.split("## Research Scenario Gate", 1)[1].split(
            "## Current-State Research", 1
        )[0].lower()

        self.assertIn("[reference.md](reference.md#research-scenario-gate)", skill)
        for marker in (
            "codebase investigation",
            "external investigation",
            "mixed investigation",
            "local authority set",
            "official sources",
            "local applicability gate",
            "source independence",
            "file/line receipts",
            "as-of date",
            "staleness risk",
            "do not use external docs to override local code",
            "do not use local behavior to assert general external product behavior",
        ):
            self.assertIn(marker, section)

    def test_deep_research_closure_check_settles_or_stops(self) -> None:
        skill = read_text("skills/deep-research/SKILL.md").lower()
        reference = read_text("skills/deep-research/REFERENCE.md")
        section = reference.split("### Research Closure Check", 1)[1].split(
            "### Saved Artifact Headers", 1
        )[0].lower()

        self.assertIn("[reference.md](reference.md#research-closure-check)", skill)
        self.assertIn("settled answer", skill)
        self.assertIn("strongest unresolved counterexample", skill)
        self.assertIn("flip condition", skill)
        self.assertIn("stop reason", skill)
        self.assertIn("which independent evidence lanes support it", section)
        self.assertIn("what specific evidence would change", section)
        self.assertIn("why should the investigation stop now", section)

    def test_tournament_does_not_leak_resume_candidate_rankings_to_final_output(self) -> None:
        resume_skill = read_text("skills/git-resume-miner/SKILL.md").lower()
        practices = read_text("skills/git-resume-miner/BEST_PRACTICES.md").lower()

        self.assertIn("best-version tournament", resume_skill)
        self.assertIn("candidate rankings", resume_skill)
        self.assertIn("do not include code paths", resume_skill)
        self.assertIn("no evidence table, commit list, code path, confidence label, or candidate ranking", practices)

    def test_resume_ready_defense_check_keeps_final_bullets_defensible(self) -> None:
        resume_skill = read_text("skills/git-resume-miner/SKILL.md").lower()
        practices = read_text("skills/git-resume-miner/BEST_PRACTICES.md")
        section = practices.split("## Resume-Ready Defense Check", 1)[1].split(
            "## Final Acceptance Checklist", 1
        )[0].lower()

        self.assertIn("[best_practices.md](best_practices.md#resume-ready-defense-check)", resume_skill)
        self.assertIn("defensible claim", resume_skill)
        self.assertIn("defense card", section)
        self.assertIn("which kept workstream won", section)
        self.assertIn("which representative diff, current code, test, doc, or user-provided fact", section)
        self.assertIn("why the chosen verb is justified", section)
        self.assertIn("what would be exaggerated under interview challenge", section)
        self.assertIn("what focused metric question remains", section)

    def test_rule_harvest_stays_in_maintenance_guidance(self) -> None:
        agents = read_text("AGENTS.md").lower()

        self.assertIn("rule harvest gate", agents)
        self.assertIn("skill evolution loop", agents)
        self.assertIn("load and apply `write-a-skill`", agents)
        self.assertIn("progressive disclosure", agents)
        self.assertIn("review checklist", agents)
        self.assertIn("real validation artifact", agents)
        self.assertIn("store temporary comparison outputs outside the skill folder", agents)
        self.assertIn("do not score the edit on an absolute point scale", agents)
        self.assertIn("two-layer gate", agents)
        self.assertIn("hard gates", agents)
        self.assertIn("net-new skill", agents)
        self.assertIn("improvement magnitude: none / marginal / clear / large", agents)
        self.assertIn("generalization confidence", agents)
        self.assertIn("never accept generalization on a single sample", agents)
        self.assertIn("adversarial falsification", agents)
        self.assertIn("objective conditions", agents)
        self.assertIn("relative delta", agents)
        self.assertIn("decision:", agents)
        for path in RUNTIME_SKILL_FILES:
            with self.subTest(path=path):
                self.assertNotIn("rule harvest", read_text(path).lower())
                self.assertNotIn("skill evolution loop", read_text(path).lower())
                self.assertNotIn("write-a-skill", read_text(path).lower())
                self.assertNotIn("improvement magnitude", read_text(path).lower())
                self.assertNotIn("adversarial falsification", read_text(path).lower())

    def test_artifact_naming_rule_stays_aligned_across_skills(self) -> None:
        naming_rule = (
            "add `-2` or `-HHmm` only when multiple same-day artifacts must coexist, "
            "preferring `-HHmm` for time-sensitive snapshots such as runtime/current-state checks"
        )
        for path in (
            "skills/deep-research/SKILL.md",
            "skills/first-principles-planner/REFERENCE.md",
        ):
            with self.subTest(path=path):
                normalized = " ".join(read_text(path).split())
                self.assertIn(naming_rule, normalized)

    def test_planner_gates_stay_scoped_and_single_sourced(self) -> None:
        skill = read_text("skills/first-principles-planner/SKILL.md")
        reference = read_text("skills/first-principles-planner/REFERENCE.md")
        agents = read_text("AGENTS.md")

        self.assertIn("do not create durable artifacts unless explicitly asked", skill.lower())
        self.assertIn("belongs to a review skill", skill)
        self.assertIn("use the user's language for chat and saved artifacts", skill.lower())
        self.assertIn("[REFERENCE.md](REFERENCE.md#artifact-location)", skill)
        self.assertIn("[REFERENCE.md](REFERENCE.md#inversion-test)", skill)
        self.assertIn("[REFERENCE.md](REFERENCE.md#bestness-check)", skill)
        self.assertIn("current-best path", skill)
        self.assertIn("first answer", skill)
        self.assertIn("first response", reference)
        self.assertIn("even when the user only asks for a plan", " ".join(reference.split()))
        self.assertIn("Defeat condition", reference)
        self.assertIn("Marginal-gain stop", reference)
        # the location ladder is single-sourced in REFERENCE.md
        self.assertIn("OS temp directory", reference)
        self.assertNotIn("designated output directory", skill)
        # distribution maintenance guidance lives in AGENTS.md, not the loaded skill body
        self.assertNotIn("byte-identical", skill.lower())
        self.assertIn("byte-identical", agents.lower())

    def test_planner_artifact_gate_is_chat_first_for_unsaved_plans(self) -> None:
        skill = read_text("skills/first-principles-planner/SKILL.md")
        reference = read_text("skills/first-principles-planner/REFERENCE.md")
        lower_skill = skill.lower()

        self.assertIn("**Artifact Gate:**", skill)
        self.assertIn("chat-first plan by default", lower_skill)
        self.assertIn("do not create durable artifacts unless explicitly asked", lower_skill)
        self.assertIn("a target path is provided", lower_skill)
        self.assertIn("reusable handoff into named next work", lower_skill)
        self.assertIn("save only through the Artifact Gate", skill)
        self.assertNotIn("write a Markdown artifact by default", skill)
        self.assertIn("## Artifact Location", reference)
        self.assertIn("## Plan File Output", reference)

    def test_java_gates_stay_single_sourced(self) -> None:
        skill = read_text("skills/java-stack-craft/SKILL.md")
        examples = read_text("skills/java-stack-craft/EXAMPLES.md")
        review = read_text("skills/java-stack-craft/REVIEW.md")
        writing = read_text("skills/java-stack-craft/WRITING.md")

        # the mandatory Spring read gate has no skip clause
        self.assertNotIn("skip the file", skill)
        # runtime portability is maintenance guidance (AGENTS.md), not skill body
        self.assertNotIn("Runtime portability", skill)
        self.assertIn("stdlib-only", read_text("AGENTS.md"))
        self.assertIn("use the user's language", skill.lower())
        # one finding format, defined in REVIEW.md and referenced by EXAMPLES.md
        finding_format = (
            "severity · category · confidence/proof-tier · file:line · "
            "rule broken · impact path · one-line fix"
        )
        self.assertIn(finding_format, review)
        self.assertIn("[REVIEW.md](REVIEW.md#step-r5-output-findings)", examples)
        # field-injection policy is single-sourced in RISK_ROUTER.md
        for text in (skill, writing, review):
            self.assertIn("(RISK_ROUTER.md#scanner-calibration)", text)

    def test_java_verification_closure_prevents_degraded_proof_overclaiming(self) -> None:
        skill = read_text("skills/java-stack-craft/SKILL.md")
        router = read_text("skills/java-stack-craft/RISK_ROUTER.md")
        review = read_text("skills/java-stack-craft/REVIEW.md")
        writing = read_text("skills/java-stack-craft/WRITING.md")

        self.assertIn("## Verification Closure", router)
        for marker in (
            "Claim",
            "Evidence",
            "Proof tier",
            "Verification floor",
            "Not proven",
            "Next check",
            "environment baseline",
            "P3 scanner-only evidence cannot be `confirmed`",
            "degraded verification",
        ):
            self.assertIn(marker, router)

        self.assertIn("(RISK_ROUTER.md#verification-closure)", writing)
        self.assertIn("(RISK_ROUTER.md#verification-closure)", review)
        self.assertIn("Verification Closure", skill)

    def test_java_script_suite_passes(self) -> None:
        result = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-q"],
            cwd=ROOT / "skills" / "java-stack-craft",
            capture_output=True,
            text=True,
        )
        self.assertEqual(0, result.returncode, result.stderr)

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
