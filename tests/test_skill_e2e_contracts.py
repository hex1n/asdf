from __future__ import annotations

import json
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
            "writing-great-skills",
            "progressive disclosure",
            "information hierarchy",
            "context pointers",
            "leading words",
            "pruning",
            "baseline output",
            "real task",
            "two-layer gate",
            "quality decision",
            "evidence status",
            "hard gates",
            "improvement magnitude",
            "generalization confidence",
            "adversarial falsification",
            "objective conditions",
            "net-new skill",
            "failure modes",
            "negative or non-trigger examples",
            "baseline artifact",
            "candidate artifact",
            "validation artifact / diff",
            "relative delta",
            "regressions",
            "continue / accept / accept provisional / reject",
            "marginal gain",
        ),
        scoped_markers=(
            "rule harvest gate",
            "explicit user-approved invariant",
            "narrowest applicable level",
            "writing-great-skills",
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
            "interview-ready",
            "evidence anchors",
            "trade-off defense",
            "ownership boundaries",
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
            "interview-ready",
            "evidence anchors",
            "trade-off defense",
            "ownership boundaries",
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
        name="deep_research_mixed_investigation",
        prompt_without_skill="Determine whether this repository's configured dependency supports a documented behavior.",
        skill_files=[
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ],
        target_files=(
            "skills/deep-research/SKILL.md",
            "skills/deep-research/REFERENCE.md",
        ),
        required_markers=(
            "mixed investigation",
            "mixed applicability check",
            "local applicability gate",
            "local fact",
            "external source",
            "published artifact",
            "applicability result",
            "applies",
            "does not apply",
            "unknown/blocked",
            "conflict",
            "do not use external docs to override local code",
            "do not use local behavior to assert general external product behavior",
        ),
        scoped_markers=(
            "mixed applicability check",
            "local fact",
            "applicability result",
            "unknown/blocked",
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
            "do not stop at clarification",
            "current-best path under that default",
            "flip the recommendation",
            "what would change the recommendation",
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
            "do not stop at clarification",
            "current-best path under that default",
            "flip the recommendation",
            "what would change the recommendation",
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
        self.assertIn("[BEST_PRACTICES.md](BEST_PRACTICES.md#best-version-tournament-funnel)", resume_skill)
        self.assertIn("Best-Version Tournament Funnel", resume_practices)
        self.assertIn("Adversarial Post-Output Self-Review", resume_practices)

    def test_git_resume_entrypoint_stays_runtime_skeleton(self) -> None:
        resume_skill = read_text("skills/git-resume-miner/SKILL.md")

        self.assertIn("## Run Contract", resume_skill)
        self.assertIn("## Reference Pointers", resume_skill)
        self.assertIn("Completion criterion", resume_skill)
        self.assertIn("[BEST_PRACTICES.md](BEST_PRACTICES.md#evidence-sampling-script)", resume_skill)
        self.assertIn("[BEST_PRACTICES.md](BEST_PRACTICES.md#resume-ready-defense-check)", resume_skill)
        self.assertIn("[BEST_PRACTICES.md](BEST_PRACTICES.md#interview-ready-defense-pack)", resume_skill)
        self.assertIn("Defense Card", resume_skill)
        self.assertNotIn("## Output Contract", resume_skill)
        self.assertNotIn("## Quality Bar", resume_skill)

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

    def test_deep_research_mixed_applicability_check_is_explicit(self) -> None:
        skill = read_text("skills/deep-research/SKILL.md").lower()
        reference = read_text("skills/deep-research/REFERENCE.md")
        section = reference.split("### Mixed Applicability Check", 1)[1].split(
            "## Current-State Research", 1
        )[0].lower()

        self.assertIn("[reference.md](reference.md#mixed-applicability-check)", skill)
        self.assertIn("surface the local applicability result", skill)
        for marker in (
            "local fact",
            "external source",
            "published artifact",
            "applicability result",
            "applies",
            "does not apply",
            "unknown/blocked",
            "conflict",
            "next check",
            "a source that says \"feature exists\" is not enough",
            "a local observation is not enough to make a general product claim",
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

    def test_interview_mode_keeps_defensible_evidence_without_full_analysis_dump(self) -> None:
        resume_skill = read_text("skills/git-resume-miner/SKILL.md").lower()
        practices = read_text("skills/git-resume-miner/BEST_PRACTICES.md")
        section = practices.split("## Interview-Ready Defense Pack", 1)[1].split(
            "## Final Acceptance Checklist", 1
        )[0].lower()

        self.assertIn("interview-ready", resume_skill)
        self.assertIn("evidence anchors", resume_skill)
        self.assertIn("trade-off defense", resume_skill)
        self.assertIn("ownership boundaries", resume_skill)
        self.assertIn("one concise evidence anchor per major claim", section)
        self.assertIn("what exactly did you own", section)
        self.assertIn("likely interviewer follow-ups and direct answers", section)
        self.assertIn("do not print the full contribution ledger or candidate ranking", section)

    def test_rule_harvest_stays_in_maintenance_guidance(self) -> None:
        agents = read_text("AGENTS.md").lower()

        self.assertIn("rule harvest gate", agents)
        self.assertIn("skill evolution loop", agents)
        self.assertIn("load and apply `writing-great-skills`", agents)
        self.assertIn("information hierarchy", agents)
        self.assertIn("context pointers", agents)
        self.assertIn("leading words", agents)
        self.assertIn("pruning", agents)
        self.assertIn("progressive disclosure", agents)
        self.assertIn("real validation artifact", agents)
        self.assertIn("store temporary comparison outputs outside the skill folder", agents)
        self.assertIn("do not score the edit on an absolute point scale", agents)
        self.assertIn("two-layer gate", agents)
        self.assertIn("quality decision", agents)
        self.assertIn("evidence status", agents)
        self.assertIn("hard gates", agents)
        self.assertIn("net-new skill", agents)
        self.assertIn("failure modes", agents)
        self.assertIn("negative or non-trigger examples", agents)
        self.assertIn("baseline artifact", agents)
        self.assertIn("candidate artifact", agents)
        self.assertIn("validation artifact / diff", agents)
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
                self.assertNotIn("writing-great-skills", read_text(path).lower())
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
        description = frontmatter_description(skill).lower()

        self.assertIn("first-principles recommendations and plans", description)
        self.assertIn("current-best path", description)
        self.assertIn("failure conditions", description)
        self.assertIn("next verification steps", description)
        self.assertIn("avoids coding while choosing a path", description)
        for marker in (
            "先写方案",
            "先不写代码",
            "先不要写代码",
            "先不coding",
            "不coding",
            "不要直接改代码",
        ):
            self.assertIn(marker, description)
        self.assertIn("code/plan review", description)
        for marker in ("计划评审", "方案评审", "审查计划", "审查方案"):
            self.assertIn(marker, description)
        self.assertNotIn("concrete markdown plans", description)
        self.assertIn("choose, keep, replace, or improve a path", skill)
        self.assertIn("challenges the current best", skill)
        self.assertIn("architecture or design direction", skill)
        self.assertIn("explicitly avoids coding while choosing a path", skill)
        self.assertIn("`是否应该替换 X?`", skill)
        self.assertIn("`给一个架构演进方案`", skill)
        self.assertIn("do not create durable artifacts unless explicitly asked", skill.lower())
        self.assertIn("belongs to a review skill", skill)
        self.assertIn("use the user's language for chat and saved artifacts", skill.lower())
        self.assertIn("[REFERENCE.md](REFERENCE.md#artifact-location)", skill)
        self.assertIn("[REFERENCE.md](REFERENCE.md#inversion-test)", skill)
        self.assertIn("[REFERENCE.md](REFERENCE.md#bestness-check)", skill)
        self.assertIn("current-best path", skill)
        self.assertIn("do not stop at clarification", skill)
        self.assertIn("current-best path under that default", skill)
        self.assertIn("flip the recommendation", skill)
        self.assertIn("what would change the recommendation", skill)
        self.assertIn("first answer", skill)
        self.assertIn("first response", reference)
        self.assertIn("even when the user only asks for a plan", " ".join(reference.split()))
        self.assertIn("Defeat condition", reference)
        self.assertIn("Marginal-gain stop", reference)
        prompt_markers = {
            "不要直接改代码，先写方案": ("不要直接改代码", "先写方案"),
            "先不coding，给最佳实现": ("先不coding", "最佳实现"),
        }
        for positive_prompt, markers in prompt_markers.items():
            for marker in markers:
                self.assertIn(marker, description, f"planner description lost trigger coverage for {positive_prompt}")
        self.assertIn("plan review", skill.lower())
        self.assertIn("belongs to a review skill", skill)
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

    def test_planner_both_output_modes_front_load_current_best_path(self) -> None:
        skill = read_text("skills/first-principles-planner/SKILL.md")
        reference = read_text("skills/first-principles-planner/REFERENCE.md")
        output_mode = skill.split("## Output Mode", 1)[1].split("## Depth", 1)[0]
        lower_output_mode = output_mode.lower()
        plan_synthesis = reference.split("## Plan Synthesis", 1)[1].split("## Evidence Conventions", 1)[0].lower()
        decision_row = next(line for line in output_mode.splitlines() if line.startswith("| Decision |"))
        plan_row = next(line for line in output_mode.splitlines() if line.startswith("| Plan |"))

        self.assertIn("front-load the recommendation", lower_output_mode)
        self.assertIn("current-best path", lower_output_mode)
        self.assertIn("compressed bestness check", lower_output_mode)
        self.assertIn("next verification step before archaeology", lower_output_mode)
        self.assertIn("next step", decision_row)
        self.assertIn("compressed **Bestness Check**", decision_row)
        self.assertIn("Bestness Check near the top", plan_row)
        self.assertIn("non-trivial recommendations", decision_row)
        self.assertIn("non-trivial recommendations", plan_row)
        self.assertIn("lead with actionable content in the first 20 lines", plan_synthesis)
        self.assertIn("put analysis last", plan_synthesis)

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

    def test_java_description_routes_plan_implementation_to_java_skill(self) -> None:
        description = frontmatter_description(read_text("skills/java-stack-craft/SKILL.md"))

        self.assertIn("landing an accepted plan into Java stack code", description)
        self.assertIn("按计划落地 Java 改动", description)
        self.assertIn("根据计划实现 Java/Spring 改动", description)
        self.assertIn("根据方案实现 Java/Spring 改动", description)
        self.assertNotIn("落地方案", description)
        self.assertIn("pure planning", description)
        self.assertIn("architecture/design discussion", description)
        self.assertIn("feasibility research", description)
        self.assertIn("non-Java implementation", description)
        self.assertIn("unless the task includes writing or reviewing Java stack code", description)

    def test_java_bundled_scripts_are_not_resolved_from_target_repo(self) -> None:
        skill = read_text("skills/java-stack-craft/SKILL.md")
        writing = read_text("skills/java-stack-craft/WRITING.md")
        review = read_text("skills/java-stack-craft/REVIEW.md")
        context = read_text("skills/java-stack-craft/WORK_CONTEXT.md")

        self.assertIn("<java-stack-craft>/scripts/java_stack.py context --dir <project-root>", skill)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py context --dir <project-root>", context)
        self.assertIn("docs/agents/java-stack-profile.md", skill)
        self.assertIn("docs/agents/java-stack-profile.md", context)
        self.assertIn("writes the repo profile by default", skill)
        self.assertIn("generated block", context)
        self.assertIn("hand-written notes outside that block are preserved", context)
        self.assertIn("--no-write-profile", context)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py profile --dir <project-root>", context)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py facilities --dir <project-root>", context)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py scan --dir <project-root>", context)
        self.assertIn("Resolve `<java-stack-craft>` to this skill directory", skill)
        self.assertIn("target project (`.` only if current dir is target)", skill)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py scan --dir <project-root>", skill)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py scan --dir <project-root>", writing)
        self.assertIn("not the target repo", writing)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py context --dir <project-root>", review)
        self.assertIn("<java-stack-craft>/scripts/java_stack.py scan --dir <project-root>", review)
        self.assertNotIn("python3 scripts/detect_java_profile.py --dir .", skill)
        self.assertNotIn("python3 scripts/java_advisory_scan.py --dir .", skill)
        self.assertNotIn("python3 scripts/java_advisory_scan.py --dir .", writing)

    def test_java_work_context_is_first_class(self) -> None:
        skill = read_text("skills/java-stack-craft/SKILL.md")
        writing = read_text("skills/java-stack-craft/WRITING.md")
        review = read_text("skills/java-stack-craft/REVIEW.md")
        context = read_text("skills/java-stack-craft/WORK_CONTEXT.md")
        profile = read_text("skills/java-stack-craft/PROFILE.md")

        self.assertIn("build Java Work Context", skill)
        self.assertIn("**Java Work Context**", skill)
        self.assertIn("reuse the current Java Work Context", skill)
        self.assertIn("project-local long-term profile plus a refreshable generated snapshot", context)
        self.assertIn("Project Knowledge Cards", context)
        self.assertIn("Project Knowledge Cards", profile)
        self.assertIn("future-choice test", profile)
        self.assertIn("Card promotion gate", profile)
        self.assertIn("Decision is an imperative action", profile)
        self.assertIn("Use when / Do not use when define the branch boundary", profile)
        self.assertIn("A fact failing any gate stays in the chat/report", profile)
        self.assertIn("Relevant Project Knowledge Cards considered", writing)
        self.assertIn("which choice each changed", writing)
        self.assertIn("Knowledge Card closure", writing)
        self.assertIn("used `<card>` unchanged", writing)
        self.assertIn("marked `<card>` stale", writing)
        self.assertIn("card title", review)
        self.assertIn("Decision:", profile)
        self.assertIn("Use when:", profile)
        self.assertIn("Do not use when:", profile)
        self.assertIn("Evidence:", profile)
        self.assertIn("Useless facts merely summarize the repo", profile)
        self.assertNotIn("## Detected Target", profile)
        self.assertNotIn("## Project Shape", profile)
        self.assertIn("common seam catalog and generic type detector are search seeds", context)
        for marker in (
            "Target Profile",
            "Project Facilities",
            "Risk Candidates",
            "Verification Floor",
        ):
            self.assertIn(marker, context)
            self.assertIn(marker, writing)
        self.assertIn("[WORK_CONTEXT.md](WORK_CONTEXT.md)", skill)
        self.assertIn("[WORK_CONTEXT.md](WORK_CONTEXT.md)", writing)
        self.assertIn("[WORK_CONTEXT.md](WORK_CONTEXT.md)", review)
        self.assertIn("Target Profile, Project Facilities, bounded risk candidates, and verification floor", review)

    def test_java_project_facilities_are_discovered_before_inventing_helpers(self) -> None:
        skill = read_text("skills/java-stack-craft/SKILL.md")
        writing = read_text("skills/java-stack-craft/WRITING.md")
        review = read_text("skills/java-stack-craft/REVIEW.md")

        self.assertIn("**Project Facility**", skill)
        self.assertIn("relevant to the seam being changed", skill)
        self.assertIn("prefer relevant **Project Facilities** before inventing a parallel path", skill)
        self.assertIn("Common examples include logging/alarm", skill)
        self.assertIn("transaction boundaries", skill)
        self.assertIn("pagination/query helpers", skill)
        self.assertIn("JSON/date/id utilities", skill)
        self.assertIn("touched-flow and same-module sibling code", skill)
        self.assertIn("Seam-relevant Project Facilities searched", writing)
        self.assertIn("Prefer seam-relevant Project Facilities before inventing new helpers", writing)
        self.assertIn("common examples include logging/alarm", writing)
        self.assertIn("Create or adapt a helper when no fitting facility exists", writing)
        self.assertIn("the local one has a defect", writing)
        self.assertIn("real variation point", writing)
        self.assertIn("wrong bounded context", writing)
        self.assertIn("Project Facilities reused, or why creating/adapting a helper was the better fit", writing)
        self.assertIn("bypass seam-relevant same-module Project Facilities", review)
        self.assertIn("concrete failure path or maintenance cost", review)

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


class PerspectiveScanContractTest(unittest.TestCase):
    """Contract + fixture wellformedness for the deep-research Perspective Scan.

    These checks verify the *contract*, not live model behavior: the trigger gate,
    skip clauses, and anti-regression allowances exist and are single-sourced, and
    every eval case is wellformed and bound to a clause that exists in the skill.
    Output quality (real contradiction, no forced role performance) is graded by the
    model-in-the-loop layer described in evals/perspective-scan/RUBRIC.md.
    """

    REQUIRED_LABELS = {
        "should_trigger",
        "should_not_trigger",
        "anti_regression",
        "anti_regression_high_conflict",
        "output_quality",
    }
    CASE_FIELDS = {
        "id",
        "label",
        "scenario",
        "depth",
        "prompt",
        "expected_decision",
        "gate_reason",
        "checks",
    }
    # The eval fixtures live in the recoverable eval workspace, which is not
    # committed. When it is absent (clean checkout) the eval-data tests skip
    # rather than error; the skill-contract tests do not depend on it.
    CASES_PATH = ROOT / "evals" / "perspective-scan" / "cases.jsonl"
    CASES_AVAILABLE = CASES_PATH.exists()

    def setUp(self) -> None:
        self.skill = read_text("skills/deep-research/SKILL.md")
        self.reference = read_text("skills/deep-research/REFERENCE.md")
        self.scan = self.reference.split("## Perspective Scan", 1)[1].split(
            "## Current-State Research", 1
        )[0]
        self.cases = (
            [
                json.loads(line)
                for line in self.CASES_PATH.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            if self.CASES_AVAILABLE
            else []
        )

    def test_pointer_is_gated_not_unconditional(self) -> None:
        # The SKILL.md pointer must gate on exploratory/strategic + Deep, so the scan
        # does not fire on every External question. This is the false-positive guard.
        pointer = [line for line in self.skill.splitlines() if "#perspective-scan" in line]
        self.assertEqual(1, len(pointer), "expected exactly one gated pointer")
        line = pointer[0].lower()
        self.assertIn("deep", line)
        self.assertIn("exploratory or strategic", line)

    def test_skip_clauses_and_antiregression_are_single_sourced(self) -> None:
        scan = self.scan.lower()
        # Skip clauses that produce the should_not_trigger decisions.
        self.assertIn("single factual answer", scan)
        self.assertIn("pure codebase investigation", scan)
        # Anti-regression allowances that defuse forced novelty and ritual conflict.
        self.assertIn("write `none`", scan)
        self.assertIn("no direct conflict", scan)
        self.assertIn("fabrication, not a finding", scan)
        # Role-selection guard: consensus must survive the strongest opposing position,
        # so `no direct conflict` cannot launder homogeneous role selection into a finding.
        self.assertIn("homogeneous role selection", scan)
        # Roster discipline: two or three roles, not all five by default.
        self.assertIn("two or three roles", scan)
        # The allowances live only in the scan section, not duplicated elsewhere.
        self.assertEqual(1, self.reference.count("no direct conflict"))

    def test_consensus_guard_precedes_the_no_conflict_allowance(self) -> None:
        # An independent falsification pass (2026-06-19) broke an earlier guard three
        # ways: the `no direct conflict` write sat BEFORE the guard (a top-to-bottom
        # reader bypassed it by early termination), "strongest" was unenforceable
        # (a strawman satisfied the letter), and there was no exit for a genuinely
        # uncontested finding (the guard forced a junk role). The rewrite must keep
        # all three closed; these are structural, not phrase-presence, checks.
        scan = self.scan.lower()
        # Placement: the opposing-position check must precede the consensus write, so
        # the `no direct conflict` permission is never reachable before the guard.
        self.assertLess(
            scan.index("strongest opposing position"),
            scan.index("no direct conflict"),
            "consensus write must come after the opposing-position check",
        )
        # Anti-strawman: the opposition must be a real expert position, not a soft target.
        self.assertIn("substantial expert community", scan)
        # Exit clause: a genuinely uncontested finding must not be forced to add a role.
        self.assertIn("no credible opposition", scan)
        # False-attribution defense: "holds" is prescriptive, so a descriptive or
        # adjacent role stance cannot be claimed to already hold the opposition.
        self.assertIn("not merely describes or borders", scan)

    @unittest.skipUnless(
        CASES_AVAILABLE, "evals/perspective-scan/cases.jsonl not committed"
    )
    def test_eval_cases_are_wellformed(self) -> None:
        self.assertEqual(7, len(self.cases))
        labels = [c["label"] for c in self.cases]
        self.assertEqual(self.REQUIRED_LABELS, set(labels))
        self.assertEqual(2, labels.count("should_trigger"))
        self.assertEqual(2, labels.count("should_not_trigger"))
        for case in self.cases:
            with self.subTest(case=case.get("id")):
                self.assertEqual(self.CASE_FIELDS, set(case))
                self.assertIn(case["expected_decision"], {"trigger", "no_trigger"})
                self.assertTrue(case["checks"], "each case needs grading checks")
                self.assertTrue(case["gate_reason"].strip())

    @unittest.skipUnless(
        CASES_AVAILABLE, "evals/perspective-scan/cases.jsonl not committed"
    )
    def test_no_trigger_cases_bind_to_a_real_skip_clause(self) -> None:
        scan = self.scan.lower()
        for case in self.cases:
            if case["label"] != "should_not_trigger":
                continue
            with self.subTest(case=case["id"]):
                self.assertEqual("no_trigger", case["expected_decision"])
                # The decision must rest on a clause that actually exists in the skill,
                # not on a label the fixture invented.
                if case["scenario"] == "codebase":
                    self.assertIn("pure codebase investigation", scan)
                else:
                    self.assertIn("single factual answer", scan)

    @unittest.skipUnless(
        CASES_AVAILABLE, "evals/perspective-scan/cases.jsonl not committed"
    )
    def test_trigger_cases_match_the_gate(self) -> None:
        for case in self.cases:
            if case["expected_decision"] != "trigger":
                continue
            with self.subTest(case=case["id"]):
                self.assertIn(case["scenario"], {"external", "mixed"})
                self.assertEqual("deep", case["depth"])

    def test_scan_markers_do_not_leak_into_other_skills(self) -> None:
        markers = ("perspective scan", "contradiction map", "no direct conflict")
        for path in MAIN_CONTEXT_FILES:
            if path.startswith("skills/deep-research/"):
                continue
            text = read_text(path).lower()
            for marker in markers:
                with self.subTest(path=path, marker=marker):
                    self.assertNotIn(marker, text, f"{marker!r} leaked into {path}")


if __name__ == "__main__":
    unittest.main()
