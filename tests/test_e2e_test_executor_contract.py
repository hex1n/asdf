from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/e2e-test-executor/SKILL.md"


EXECUTOR_CONTRADICTIONS = (
    (
        re.compile(
            r"\bdefault(?:s|ing)?\W+(?:to\s+)?(?:generate|write|modify|create).{0,80}\btest code\b"
            r"|\bdefault result\b.{0,80}\bwriting tests\b"
            r"|\bnormal outcome\b.{0,80}\btest code\b"
            r"|\breal runs?\b.{0,40}\boptional\b",
            re.DOTALL,
        ),
        "executor must not default to generating test code",
    ),
    (
        re.compile(
            r"\b(?:preprod|staging|production)\b.{0,80}\b(?:run|execute|continue|validate)\b.{0,80}\bwithout\s+(?:stopping|asking|safety|explicit)"
            r"|\b(?:preprod|staging|production)\b.{0,80}\bexecute immediately\b"
            r"|\b(?:preprod|staging|production)\b.{0,40}\brun now\b"
            r"|\bexecute immediately\b.{0,80}\b(?:preprod|staging|production)\b",
            re.DOTALL,
        ),
        "executor must not run production-like environments without stopping for safety",
    ),
    (
        re.compile(
            r"\bskip.{0,50}\bcapability map\b"
            r"|\bcapability map\b.{0,50}\b(?:optional|not required|skip)"
            r"|\bcapability map\b.{0,80}\bafter scenario execution starts\b"
            r"|\bcapability map\b.{0,80}\bafter the first scenario has started\b",
            re.DOTALL,
        ),
        "executor must not skip capability-map gates",
    ),
    (
        re.compile(
            r"\bscenario\s+can\s+pass.{0,80}\b(?:missing probes?|probes?\s+are\s+missing)\b"
            r"|\bmissing probes?\b.{0,40}\b(?:can|may|should|allowed).{0,20}\bpass\b"
            r"|\bmissing oracle\b.{0,40}\bmay succeed\b"
            r"|\boracle\b.{0,40}\bunavailable\b.{0,60}\b(?:pass|passed)\b"
            r"|\bmark\b.{0,40}\bscenario\b.{0,40}\bpassed\b.{0,40}\bnote\b",
            re.DOTALL,
        ),
        "executor must not pass scenarios with missing probes",
    ),
    (
        re.compile(
            r"\b(?:create|open|file|sync).{0,40}\b(?:remote|github|jira|notion).{0,30}\bissues?\b.{0,40}\bby default\b"
            r"|\balways\b.{0,40}\b(?:file|create|open|sync).{0,40}\b(?:github|jira|notion|linear|remote).{0,30}\bissues?\b",
            re.DOTALL,
        ),
        "executor must not create remote issues by default",
    ),
    (
        re.compile(
            r"\b(?:cache misses?|dependency downloads?|dependency[- ]resolution timeouts?|module downloads?)\b"
            r".{0,100}\b(?:product defects?|product failures?)\b"
            r".{0,80}\b(?:by default|even when no product code executed|before product code executes?)\b"
            r"|\b(?:product defects?|product failures?)\b"
            r".{0,100}\b(?:cache misses?|dependency downloads?|dependency[- ]resolution timeouts?|module downloads?)\b"
            r".{0,80}\b(?:by default|even when no product code executed|before product code executes?)\b",
            re.DOTALL,
        ),
        "executor must not classify dependency setup failures as product defects by default",
    ),
    (
        re.compile(
            r"\b(?:cleanup|clean up|delete|remove|purge)\b"
            r".{0,80}\b(?:failed|failing|bug|defect)\b"
            r".{0,80}\b(?:before|without)\b"
            r".{0,80}\b(?:preserv|captur|snapshot|evidence|scene|现场)\b"
            r"|\b(?:failed|failing|bug|defect)\b"
            r".{0,80}\b(?:cleanup|clean up|delete|remove|purge)\b"
            r".{0,80}\b(?:before|without)\b"
            r".{0,80}\b(?:preserv|captur|snapshot|evidence|scene|现场)\b"
            r"|\b(?:cleanup|clean up|delete|remove|purge)\b"
            r".{0,80}\b(?:evidence|logs?|db rows?|queue|cache|scene|现场)\b"
            r".{0,40}\b(?:allowed|ok|by default)\b"
            r"|\b(?:failure|product defect|unknown mismatch|bug|defect)\b"
            r".{0,120}\b(?:cleanup|clean up|delete|remove|purge)\b"
            r".{0,120}\b(?:rather than|instead of|without|before)\b"
            r".{0,80}\b(?:retain|preserv|captur|raw responses?|db rows?|evidence|scene|现场)\b"
            r"|\b(?:failure|product defect|unknown mismatch|bug|defect)\b"
            r".{0,120}\b(?:cleanup|clean up|delete|remove|purge)\b"
            r".{0,120}\b(?:final summary|from memory|logs? (?:are|is) enough|environment clean)\b"
            r"|\b(?:unknown mismatch|failure|bug|defect)\b"
            r".{0,120}\b(?:cleanup|clean up|delete|remove|purge)\b"
            r".{0,80}\bfirst\b.{0,80}\b(?:from memory|final summary|logs? (?:are|is) enough)\b",
            re.DOTALL,
        ),
        "executor must preserve the failure scene before cleanup",
    ),
)


def assert_no_executor_contradictions(test_case: unittest.TestCase, text: str) -> None:
    lower = text.lower()
    for pattern, message in EXECUTOR_CONTRADICTIONS:
        test_case.assertIsNone(pattern.search(lower), message)


class E2ETestExecutorContractTest(unittest.TestCase):
    def test_description_routes_execution_not_planning(self) -> None:
        text = SKILL.read_text(encoding="utf-8")
        frontmatter = text.split("---", 2)[1].lower()

        for marker in (
            "executes source-backed e2e test plans",
            "local or test environments",
            "evidence-backed reports",
            "run, execute, validate, verify, or report",
            "e2e/end-to-end/端到端/全链路",
            "e2e-test-planner output",
            "apis, rpc/sdk/cli tools, ui, databases, jobs, callbacks, queues, logs, metrics, stubs, or local services",
            "do not use for creating the original test plan",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, frontmatter)

    def test_skill_keeps_execution_boundary(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()

        assert_no_executor_contradictions(self, skill)
        for marker in (
            "default outcome is not test code",
            "real run",
            "report",
            "issue backlog",
            "raw evidence",
            "write or modify tests only when the user explicitly asks",
            "supported environments: local and test only",
            "preprod",
            "production",
            "stop and ask",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, skill)

    def test_workflow_order_is_gate_driven(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()

        expected_order = (
            "## 1. intake",
            "## 2. environment discovery",
            "## 3. data policy",
            "## 4. dag scheduler",
            "## 5. execute and diagnose",
            "## 6. report artifacts",
        )
        indexes = [skill.index(section) for section in expected_order]
        self.assertEqual(indexes, sorted(indexes))

        for index, section in enumerate(expected_order[:-1]):
            body = skill[skill.index(section) : skill.index(expected_order[index + 1])]
            self.assertIn("completion criterion:", body)

    def test_workflow_order_report_section_has_completion_criterion(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 6. report artifacts", 1)[1]

        self.assertIn("completion criterion:", section)

    def test_intake_consumes_planner_contract(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 1. intake", 1)[1].split("## 2. environment discovery", 1)[0]

        for marker in (
            "agent-ready gates",
            "agent execution contract",
            "execution dag",
            "execution order",
            "scenario fields",
            "waits",
            "cleanup",
            "explore the codebase",
            "safe read-only probes",
            "missing or conflicting plan facts are recorded before execution starts",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_environment_discovery_covers_local_and_test_policies(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 2. environment discovery", 1)[1].split("## 3. data policy", 1)[0]

        for marker in (
            "execution capability map",
            "api/rpc/sdk/cli/ui tools",
            "db access",
            "mq/redis/job/callback controls",
            "logs/metrics/traces",
            "auth",
            "base urls",
            "service start commands",
            "build/test toolchains",
            "dependency caches",
            "actively fix reversible environment problems",
            "start declared services",
            "free or change ports",
            "temporary config",
            "run migrations or seeds",
            "toolchain version",
            "cache or dependency source",
            "cache misses",
            "dependency downloads",
            "dependency-resolution timeouts",
            "environment or tooling setup",
            "product code actually executed and failed",
            "do not silently change business logic",
            "automatic data creation, cleanup, job triggering, and callback triggering are allowed",
            "direct db mutation is allowed",
            "ownership and cleanup evidence",
            "capability map satisfies the relevant entry gates",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_data_policy_prefers_self_owned_data_without_hard_categories(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 3. data policy", 1)[1].split("## 4. dag scheduler", 1)[0]

        for marker in (
            "prefer creating the business data",
            "reuse environment data only as a heuristic choice",
            "do not treat that list as closed",
            "record the id, source, current state",
            "why it was not created",
            "reproducibility or cleanup",
            "blocked or downgrade the scenario to read-only verification",
            "owner marker",
            "batch id",
            "trace id",
            "scenario id",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_dag_scheduler_allows_parallelism_only_from_plan_facts(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 4. dag scheduler", 1)[1].split("## 5. execute and diagnose", 1)[0]

        for marker in (
            "build a runtime dag",
            "do not run scenarios in file order by default",
            "depends on",
            "consumes",
            "produces",
            "side-effect scope",
            "isolation key",
            "cleanup dependency",
            "parallel-safety facts",
            "independent probes and isolated scenarios in parallel",
            "dependent business chains by dag order",
            "pass produced variables explicitly",
            "disruptive nodes",
            "concurrency",
            "recovery",
            "compensation",
            "callback-race",
            "load checks in isolation",
            "final consistency and cleanup checks",
            "why each node was parallel, serialized, isolated, skipped, or blocked",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_execute_and_diagnose_requires_evidence_and_classification(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 5. execute and diagnose", 1)[1].split("## 6. report artifacts", 1)[0]

        for marker in (
            "http",
            "rpc",
            "sdk",
            "cli",
            "browser automation",
            "db query",
            "queue/job control",
            "callback harness",
            "log search",
            "metric query",
            "capture inputs, outputs, timestamps",
            "variable values",
            "waits",
            "retries",
            "cleanup actions",
            "preserve the failure scene before cleanup",
            "raw request/response",
            "db rows or query results",
            "queue/job state",
            "logs/traces/metrics",
            "stub or external-system state",
            "config/profile/feature flags",
            "created entity ids",
            "correlation ids",
            "exact rerun command",
            "redact secrets",
            "identifiers needed for reproduction",
            "quarantine or retain self-owned data",
            "owner, ttl, cleanup command, and risk",
            "freshness guard",
            "changing config",
            "re-run the readiness probe",
            "reflects the new state",
            "cache hits",
            "`unchanged` responses",
            "stale snapshots",
            "config fingerprints",
            "product defect",
            "plan defect",
            "environment defect",
            "tooling defect",
            "unknown",
            "missing probe is blocked, not passed",
            "preserved-scene paths or an explicit reason they are unavailable",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_report_artifacts_are_markdown_html_issues_and_evidence(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 6. report artifacts", 1)[1]

        for marker in (
            "e2e-run-<plan-name>-<timestamp>/",
            "execution-report.md",
            "execution-report.html",
            "issue-backlog.md",
            "evidence/",
            "agent handoff source of truth",
            "execution summary",
            "environment & capability map",
            "dag schedule",
            "scenario results",
            "evidence index",
            "data created & cleanup",
            "re-run instructions",
            "human-readable view",
            "must not introduce facts absent from the markdown report or evidence",
            "separate agent-ready backlog",
            "not a remote issue tracker by default",
            "one issue per actionable root cause",
            "issue id",
            "affected scenarios / edges",
            "preserved scene",
            "suspected code area",
            "verification command or scenario",
            "product defects are fix candidates",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_no_template_placeholders_remain(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()

        self.assertIsNone(re.search(r"todo|placeholder|replace with|structuring this skill", skill))

    def test_executor_contract_rejects_adversarial_contradictions(self) -> None:
        skill = SKILL.read_text(encoding="utf-8")
        cases = (
            skill + "\nDefault: generate test code by default before any real run.\n",
            skill + "\nThe normal outcome is test code; real runs are optional.\n",
            skill + "\nThe default result is writing tests.\n",
            skill + "\nFor production, continue execution without stopping for safety review.\n",
            skill + "\nFor staging, execute immediately after reading the plan.\n",
            skill + "\nFor staging, run now.\n",
            skill + "\nIf gates are missing, skip the capability map and continue execution.\n",
            skill + "\nThe capability map can be completed after scenario execution starts.\n",
            skill + "\nThe capability map can be completed after the first scenario has started.\n",
            skill + "\nA scenario can pass when probes are missing.\n",
            skill + "\nIf an oracle is unavailable, mark the scenario passed with a note.\n",
            skill + "\nA missing oracle may succeed.\n",
            skill + "\nCreate remote GitHub issues by default for every product defect.\n",
            skill + "\nAlways file GitHub issues for every product defect.\n",
            skill + "\nAlways open Linear issues for every product defect.\n",
            skill + "\nDependency-resolution timeouts are product defects by default, even when no product code executed.\n",
            skill + "\nCache misses are product failures by default before product code executes.\n",
            skill + "\nDependency downloads should be filed as product defects before product code executes.\n",
            skill + "\nAlways clean up failed scenario data before preserving evidence.\n",
            skill + "\nOn bug, delete DB rows and logs without preserving the failure scene.\n",
            skill + "\nCleanup may remove evidence by default when a defect is filed.\n",
            skill + "\nOn product defect, immediately run the configured cleanup and rely on the final summary rather than retaining raw responses or DB rows.\n",
            skill + "\nWhen an unknown mismatch appears, purge temporary configs and queues first, then document the mismatch from memory.\n",
            skill + "\nIf a failure occurs, delete self-owned records to keep the environment clean; logs are enough for follow-up.\n",
        )

        for text in cases:
            with self.subTest():
                with self.assertRaises(AssertionError):
                    assert_no_executor_contradictions(self, text)


if __name__ == "__main__":
    unittest.main()
