from __future__ import annotations

import re
import unicodedata
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/e2e-test-executor/SKILL.md"
REFERENCE = ROOT / "skills/e2e-test-executor/REFERENCE.md"
FIXTURES = ROOT / "tests/fixtures/e2e_test_executor"


# The 10 sections `execution-report.md` must carry (executor SKILL.md §6) and the four
# legal terminal scenario statuses (executor SKILL.md §5). Symmetric to the planner's
# `assert_valid_generated_plan`: a static, paraphrase-robust structural contract over a
# run-artifact *instance* — it reads the report text, never executes a live run.
EXECUTION_REPORT_SECTIONS = (
    "Execution Summary",
    "Run Metadata",
    "Environment & Capability Map",
    "DAG Schedule",
    "Scenario Results",
    "Evidence Index",
    "Failures / Defects / Plan Gaps",
    "Data Created & Cleanup",
    "Re-run Instructions",
    "Next Actions for Agent",
)
SCENARIO_STATUSES = ("passed", "failed", "blocked", "skipped")


_PLACEHOLDER_VALUES = (
    "na", "tbd", "tbc", "tbf", "todo", "none", "pending", "unknown",
    "seeabove", "seebelow", "seeplan", "later", "fixlater", "待定", "待补充", "无",
)


def _is_placeholder(value: str) -> bool:
    """True when a backflow target / upstream-plan value names nothing real.

    Denylist over an NFKC-normalised, invisible-mark-stripped, punctuation-compacted form,
    so dotted (`n.a.`), spaced (`see below`), full-width (`ｎ／ａ`), and zero-width/RTL
    obfuscations collapse onto the same blocked token. Like the planner's PLACEHOLDER_PATTERN
    this is non-exhaustive: a novel natural-language deferral still passes, and the SKILL
    instruction carries the "name a real target" requirement for that residual.
    """
    text = unicodedata.normalize("NFKC", value)
    text = "".join(ch for ch in text if unicodedata.category(ch) not in ("Cf", "Cc"))
    text = text.strip(" -—–`").strip().lower()
    compact = re.sub(r"[.\s/]", "", text)
    return len(text) < 3 or len(compact) < 2 or compact in _PLACEHOLDER_VALUES


def assert_valid_execution_report(test_case: unittest.TestCase, text: str) -> None:
    def section_span(title: str):
        head = re.search(rf"^##\s+{re.escape(title)}\s*$", text, re.MULTILINE)
        if head is None:
            return None
        begin = head.end()
        nxt = re.search(r"^##\s+", text[begin:], re.MULTILINE)
        return begin, (begin + nxt.start() if nxt else len(text))

    # R1 + R2: every required section is present and Execution Summary leads.
    starts = []
    for title in EXECUTION_REPORT_SECTIONS:
        span = section_span(title)
        test_case.assertIsNotNone(span, f"execution-report missing section: {title}")
        starts.append(span[0])
    test_case.assertEqual(
        starts[0], min(starts), "Execution Summary must be the first report section"
    )

    s_begin, s_end = section_span("Scenario Results")
    scenario_results = text[s_begin:s_end]

    # R3a: at least one scenario carries a legal terminal status. A report with no
    # passed/failed/blocked/skipped marker is not an executed run.
    statuses = re.findall(r"`(" + "|".join(SCENARIO_STATUSES) + r")`", scenario_results)
    test_case.assertTrue(
        statuses,
        "Scenario Results must record a status in passed/failed/blocked/skipped",
    )

    # R3b (soul clause): every `failed` row must reference a kept failure scene on the
    # same row — a failure without a preserved scene is an evidence-loss contract breach.
    for line in scenario_results.splitlines():
        if "`failed`" in line:
            test_case.assertIn(
                "preserved-scenes/",
                line,
                "a `failed` scenario must reference preserved-scenes/ on its row",
            )

    # R4: evidence/index.md is the core handoff index; the report must point at it.
    test_case.assertIn(
        "evidence/index.md", text, "execution-report must reference evidence/index.md"
    )

    # R5: Re-run Instructions must carry an executable command, not just prose.
    r_begin, r_end = section_span("Re-run Instructions")
    test_case.assertRegex(
        text[r_begin:r_end],
        r"```|`[^`]{6,}`",
        "Re-run Instructions must include an executable rerun command",
    )

    # R6: Run Lineage & Emergent Scenarios (conditional projection): when present, the
    # lineage must name the upstream plan, and every emergent (out-of-plan) scenario must
    # name a backflow target (a plan section or risk family) plus a status — an out-of-plan
    # finding may never be left only in the report. Presence is carried by the SKILL
    # instruction, like the planner-side Executor Handoff Index. Findings written as prose
    # instead of table rows are prohibited by the SKILL instruction, not caught structurally
    # here: a content scan for finding-language false-positives on legitimate lineage prose
    # (the C2 content-trigger lesson), so this validator enforces table-row quality only.
    lineage_span = section_span("Run Lineage & Emergent Scenarios") or section_span(
        "运行血缘与新增场景"
    )
    if lineage_span is not None:
        lineage_text = text[lineage_span[0] : lineage_span[1]]
        # The lineage must NAME a real upstream plan, not merely carry the label: a value
        # of `none`/`TBD`/empty for the plan defeats provenance (unlike `Upstream run`,
        # where `none` is legal on a first run).
        plan_line = re.search(
            r"(?im)^[ \t]*[-*]?[ \t]*(?:upstream plan|上游计划)[ \t]*[:：][ \t]*(.*)$",
            lineage_text,
        )
        test_case.assertIsNotNone(plan_line, "Run Lineage must name the upstream plan")
        test_case.assertFalse(
            _is_placeholder(plan_line.group(1) if plan_line else ""),
            "Run Lineage `Upstream plan` must name a real plan path or ID, not a placeholder",
        )
        table_lines = [
            line.strip() for line in lineage_text.splitlines() if line.strip().startswith("|")
        ]
        if table_lines:
            test_case.assertGreaterEqual(
                len(table_lines), 3,
                "emergent-scenarios table needs a header, a separator, and at least one row",
            )
            header_cells = [cell.strip().lower() for cell in table_lines[0].strip("|").split("|")]
            header_text = " | ".join(header_cells)
            test_case.assertTrue(
                all(token in header_text for token in ("emergent", "trigger", "risk", "update", "status"))
                or all(token in header_text for token in ("新增", "触发", "风险", "更新", "状态")),
                "emergent-scenarios table must use stable columns",
            )
            test_case.assertGreaterEqual(
                len(header_cells), 5,
                "emergent-scenarios table needs distinct columns, not a merged header",
            )
            separator = [cell.strip() for cell in table_lines[1].strip("|").split("|")]
            test_case.assertTrue(
                all(re.fullmatch(r":?-+:?", cell) for cell in separator),
                "emergent-scenarios table is missing its separator row",
            )
            for line in table_lines[2:]:
                cells = [cell.strip() for cell in line.strip("|").split("|")]
                test_case.assertEqual(
                    len(cells), len(header_cells), f"malformed emergent-scenario row: {line}"
                )
                row = dict(zip(header_cells, cells))
                target = next(
                    (value for key, value in row.items() if "update" in key or "plan" in key or "更新" in key),
                    "",
                )
                status = next(
                    (value for key, value in row.items() if "status" in key or "状态" in key), ""
                )
                test_case.assertFalse(
                    _is_placeholder(target),
                    "each emergent scenario must name a real plan section or risk family to update",
                )
                status_value = (
                    unicodedata.normalize("NFKC", status.strip(" -—–`")).strip().lower()
                )
                test_case.assertIn(
                    status_value,
                    ("proposed", "accepted", "closed", "已提议", "已接受", "已关闭"),
                    "each emergent scenario status must be proposed/accepted/closed",
                )

    # R7: Environment State Ledger (conditional projection): when present, the resume
    # snapshot must carry a non-placeholder deployment/freshness evidence field (the
    # DEPLOY-FINGERPRINT output: a version/build/commit/start-time or a behavioral
    # fingerprint) and a non-placeholder cleanup-policy field, so a re-opened agent learns
    # from the ledger alone whether the run is on fresh code and what must not be cleaned.
    # The other six ledger fields are carried by the SKILL instruction, not gated here
    # (avoid over-rigid field-by-field enforcement). The semantic "a reachable endpoint is
    # not freshness evidence" is likewise instruction-side: `_is_placeholder` rejects empty/
    # TBD/none, but a real-word non-proof such as "reachable" passes structurally — the SKILL
    # carries that rule, the same boundary as the lineage prose-vs-table case above.
    ledger_span = section_span("Environment State Ledger") or section_span("环境状态台账")
    if ledger_span is not None:
        ledger_text = text[ledger_span[0] : ledger_span[1]]
        # Check EVERY field-line whose label names the field, not just the first match: a
        # decoy bullet (e.g. "Pre-deployment check: ok") must not be able to shadow a hollow
        # real field ("Deployment/freshness evidence: TBD"). The freshness field is keyed on
        # the two DEPLOY-FINGERPRINT evidence modes — `evidence`/`fingerprint` (and
        # 证据/指纹/新鲜度) — which real labels carry ("Deployment/freshness evidence",
        # "Build fingerprint", "部署证据"), while the looser `deployment` is avoided (it also
        # reads on an unrelated field such as a deployment target).
        freshness_values = re.findall(
            r"(?im)^[ \t]*[-*]?[ \t]*[^:：\n]*(?:evidence|fingerprint|freshness|证据|指纹|新鲜度)[^:：\n]*[:：][ \t]*(.*)$",
            ledger_text,
        )
        test_case.assertTrue(
            freshness_values,
            "Environment State Ledger must carry a deployment/freshness evidence field",
        )
        for value in freshness_values:
            test_case.assertFalse(
                _is_placeholder(value),
                "ledger deployment/freshness evidence must be real (version/build/commit/"
                "start-time or a behavioral fingerprint), not a placeholder",
            )
        # `cleanup`, `clean up`, and `clean-up` are all valid label spellings; match all so a
        # real value is neither missed (false-negative on a hollow value) nor rejected.
        cleanup_values = re.findall(
            r"(?im)^[ \t]*[-*]?[ \t]*[^:：\n]*(?:clean[ \t-]*up|清理)[^:：\n]*[:：][ \t]*(.*)$",
            ledger_text,
        )
        test_case.assertTrue(
            cleanup_values, "Environment State Ledger must carry a cleanup policy field"
        )
        for value in cleanup_values:
            test_case.assertFalse(
                _is_placeholder(value),
                "ledger cleanup policy must name a real policy, not a placeholder",
            )


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
            "executor handoff index",
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
            "mq/cache/job/callback controls",
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

    def test_data_policy_decides_cleanup_vs_preserve_up_front(self) -> None:
        # EXEC-DATA-POLICY: the run-level clean-vs-preserve decision is made and
        # confirmed BEFORE executing, then recorded in the Environment State
        # Ledger, so the user is never surprised post-hoc. The output artifact
        # (strategy / retention scope / cleanable keys / must-not-clean) is
        # already carried + validated by the ledger Cleanup policy + Remaining
        # traces fields; this pins only the up-front decision discipline, which
        # is a behavior, not a structurally checkable property of the report.
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 3. data policy", 1)[1].split("## 4. dag scheduler", 1)[0]

        for marker in (
            "decide the run's data policy before executing",
            "preserve traces",
            "default to cleanup",
            "items that must not be cleaned",
            "run-level data policy",
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

    def test_dependency_availability_gate(self) -> None:
        # Load-bearing protector for the dependency-availability rule. A presence test
        # (the canonical §5 tokens are intact) is robust where a regex contradiction
        # tripwire is not: two independent falsification passes broke a regex guard
        # for this invariant — it leaked endless paraphrases and, worse, false-positived
        # on correct negated phrasings like "never mark passed when unreachable". Pin the
        # rule here; do not reintroduce a contradiction regex for this semantic invariant.
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 5. execute and diagnose", 1)[1].split("## 6. report artifacts", 1)[0]

        for marker in (
            "unreachable or unavailable at run time",
            "declared stub or 挡板",
            "mark the scenario `blocked` or suspend",
            "capture the unreachable evidence",
            "never `passed`",
            "not a `product defect` unless product code actually executed",
            "expected degraded behavior",
            "an outage alone is never a pass",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_report_artifacts_are_tiered_core_and_optional(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 6. report artifacts", 1)[1]

        core_markers = (
            "e2e-run-<plan-name>-<timestamp>/",
            "execution-report.md",
            "evidence/",
            "index.md",
            "preserved-scenes/",
            "reference.md#run-artifact-contract",
            "agent handoff source of truth",
            "execution summary",
            "run metadata",
            "environment & capability map",
            "dag schedule",
            "scenario results",
            "evidence index",
            "data created & cleanup",
            "re-run instructions",
            "not a remote issue tracker by default",
            "one issue per actionable root cause",
            "issue id",
            "affected scenarios / edges",
            "preserved scene",
            "suspected code area",
            "verification command or scenario",
            "product defects are fix candidates",
        )
        for marker in core_markers:
            with self.subTest(core=marker):
                self.assertIn(marker, section)

        # Core artifacts are produced by default; derived artifacts are gated on a consumer.
        self.assertRegex(section, r"\bcore\b")
        self.assertRegex(section, r"\bby default\b")
        self.assertRegex(section, r"optional|on demand|on-demand")
        self.assertIn("must not introduce facts absent from", section)
        # Non-reconstructable evidence must never be downgraded to optional.
        self.assertIn("never downgrade them to optional", section)

        # Machine-readable and rendered artifacts stay named but read as optional, not required.
        for optional_marker in (
            "run-metadata.json",
            "scenario-results.jsonl",
            "execution-report.html",
            "issue-backlog.md",
        ):
            with self.subTest(optional=optional_marker):
                self.assertIn(optional_marker, section)

    def test_reference_defines_run_artifact_contract(self) -> None:
        reference = REFERENCE.read_text(encoding="utf-8").lower()

        for marker in (
            "## run artifact contract",
            "core files",
            "optional files",
            "only when a programmatic consumer",
            "must not introduce facts absent from",
            "run-metadata.json",
            "plan path or id",
            "plan contract version",
            "environment kind",
            "repo commit",
            "status counts",
            "toolchain versions",
            "cache/dependency sources",
            "scenario-results.jsonl",
            "one json object per dag node or scenario",
            "evidence paths",
            "preserved-scene paths",
            "issue ids",
            "cleanup status",
            "evidence/index.md",
            "preserved-scenes/",
            "owner, ttl, cleanup command, risk",
            "redaction notes",
            "run directory alone",
            # execution-report.md structural contract — single source for assert_valid_execution_report
            "structural contract",
            "with `execution summary` first",
            "no other word stands in for a status",
            "a failure with no preserved scene is a contract breach",
            "at least one executable command",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, reference)

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

    def test_valid_execution_report_passes_structural_contract(self) -> None:
        report = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        assert_valid_execution_report(self, report)

    def test_execution_report_contract_rejects_structural_defects(self) -> None:
        # Bidirectional half: each mutation breaks exactly one run-artifact invariant and
        # must be caught. Mirrors the planner's missing-closure fixture, kept inline so the
        # mutation and the broken rule are co-located.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")

        mutations = {
            # R1: a required section is dropped (heading renamed).
            "missing Re-run Instructions section": good.replace(
                "## Re-run Instructions", "## Rerun Steps"
            ),
            # R3b: a `failed` row loses its preserved scene.
            "failed row without preserved scene": good.replace(
                "`failed` | evidence/index.md#wn-s2 | preserved-scenes/wn-s2/ |",
                "`failed` | evidence/index.md#wn-s2 | — |",
            ),
            # R3a: no legal terminal status remains in Scenario Results.
            "no legal scenario status": good.replace("`passed`", "`done`")
            .replace("`failed`", "`broken`")
            .replace("`blocked`", "`stuck`"),
            # R4: the core evidence index is no longer referenced.
            "no evidence index reference": good.replace("evidence/index.md", "evidence-summary"),
            # R5: Re-run Instructions degrades to prose with no command.
            "rerun section without a command": good.replace(
                "```bash\n./gradlew :hfax_loan_service:test --tests '*WithHoldNotice*' -Denv=test\n```\n\n"
                "WN-S2 alone reruns via `curl -X POST http://localhost:18080/fund/loan/withhold/notice -d @evidence/wn-s2/request.json`.",
                "Re-run by re-executing the withhold-notice selection in the test environment.",
            ),
        }

        for label, mutated in mutations.items():
            with self.subTest(mutation=label):
                self.assertNotEqual(mutated, good, f"mutation was a no-op: {label}")
                with self.assertRaises(AssertionError):
                    assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_emergent_scenario_without_backflow_target(self) -> None:
        # An emergent (out-of-plan) finding may not be left only in the report: it must
        # name the plan section / risk family it backflows into.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "| cross-step consistency | Risk Map: amount-validation consistency | proposed |",
            "| cross-step consistency | — | proposed |",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_lineage_without_upstream_plan(self) -> None:
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace("- Upstream plan:", "- Source plan:")
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_emergent_placeholder_target(self) -> None:
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "| cross-step consistency | Risk Map: amount-validation consistency | proposed |",
            "| cross-step consistency | n/a | proposed |",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_emergent_table_without_separator(self) -> None:
        # A malformed emergent table (separator row dropped) must not skip validation.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace("|---|---|---|---|---|\n", "", 1)
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_merged_header_emergent_table(self) -> None:
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "| Emergent scenario | Source trigger | Risk family | Plan section to update | Status |\n"
            "|---|---|---|---|---|\n"
            "| WN-E1 partial-success amount reconciliation | WN-S2 amount mismatch still advanced `result_status` | cross-step consistency | Risk Map: amount-validation consistency | proposed |",
            "| emergent trigger risk update status merged |\n| --- |\n| WN-E1 placeholder |",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_lineage_upstream_plan_placeholder(self) -> None:
        # Falsification D2: the upstream plan must be a real reference, not `none`/`TBD`.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "- Upstream plan: `evals/e2e-skills/real-repo/2026-06-21-withhold-notice-plan-zh.md` (e2e-plan/v1)",
            "- Upstream plan: none",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_emergent_status_placeholder(self) -> None:
        # Falsification D3: status must be proposed/accepted/closed, not `tbd`/`-`.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "| Risk Map: amount-validation consistency | proposed |",
            "| Risk Map: amount-validation consistency | tbd |",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_emergent_fullwidth_placeholder_target(self) -> None:
        # Falsification D4b: a full-width placeholder must NFKC-normalize before the check.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "| cross-step consistency | Risk Map: amount-validation consistency | proposed |",
            "| cross-step consistency | ｎ／ａ | proposed |",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_emergent_deferral_target_variants(self) -> None:
        # Falsification round-2 residuals: dotted / spaced / deferral / invisible-char
        # placeholders must collapse onto a blocked token via the normalised denylist.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        for variant in ("pending", "n.a.", "tbd.", "see below", "fix later", "n/a‏", "---"):
            with self.subTest(variant=variant):
                mutated = good.replace(
                    "| cross-step consistency | Risk Map: amount-validation consistency | proposed |",
                    f"| cross-step consistency | {variant} | proposed |",
                )
                self.assertNotEqual(mutated, good)
                with self.assertRaises(AssertionError):
                    assert_valid_execution_report(self, mutated)

    def test_execution_report_accepts_freetext_backflow_target(self) -> None:
        # No allowlist false-positive: a real target need not contain plan-section keywords.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        for target in ("idempotency invariant", "concurrency window"):
            with self.subTest(target=target):
                mutated = good.replace(
                    "| cross-step consistency | Risk Map: amount-validation consistency | proposed |",
                    f"| cross-step consistency | {target} | proposed |",
                )
                self.assertNotEqual(mutated, good)
                assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_ledger_placeholder_freshness(self) -> None:
        # DEPLOY-FINGERPRINT: a placeholder deployment/freshness evidence value defeats the
        # "is this fresh code?" question the ledger exists to answer.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "Deployment/freshness evidence: commit `0e03ed0`, build `2026-06-21T09:50`, "
            "service start `2026-06-21T10:05`; readiness `GET /actuator/health` = UP before the first scenario",
            "Deployment/freshness evidence: TBD",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_ledger_without_freshness_evidence(self) -> None:
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "- Deployment/freshness evidence: commit `0e03ed0`, build `2026-06-21T09:50`, "
            "service start `2026-06-21T10:05`; readiness `GET /actuator/health` = UP before the first scenario\n",
            "",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_ledger_placeholder_cleanup(self) -> None:
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "Cleanup policy: clean by `batch_no LIKE 'E2EWN-%'`; WN-S2 rows must not be cleaned until the defect is confirmed",
            "Cleanup policy: n/a",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_ledger_decoy_deployment_label_hides_tbd(self) -> None:
        # Independent-falsification D1: a decoy bullet whose label merely contains
        # "deployment" must not shadow a hollow real freshness field (first-match bypass).
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "- Deployment/freshness evidence: commit `0e03ed0`, build `2026-06-21T09:50`, "
            "service start `2026-06-21T10:05`; readiness `GET /actuator/health` = UP before the first scenario",
            "- Pre-deployment check (deployment): config v2 loaded\n"
            "- Deployment/freshness evidence: TBD",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_accepts_spaced_clean_up_label(self) -> None:
        # Independent-falsification D2: "Clean up policy" (two words) is a valid label; a real
        # policy value must be accepted, not rejected as a missing field.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace("- Cleanup policy:", "- Clean up policy:")
        self.assertNotEqual(mutated, good)
        assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_spaced_clean_up_placeholder(self) -> None:
        # D2 other half: a hollow "Clean up policy" value is still caught.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "- Cleanup policy: clean by `batch_no LIKE 'E2EWN-%'`; WN-S2 rows must not be cleaned until the defect is confirmed",
            "- Clean up policy: TBD",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_accepts_alternate_freshness_evidence_labels(self) -> None:
        # Confirmation round F2/F3: the field is defined by its value, so real labels other
        # than the canonical one — "Deployment evidence", "Build fingerprint" (a behavioral
        # fingerprint per DEPLOY-FINGERPRINT) — must be accepted, not rejected as missing.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        original = (
            "- Deployment/freshness evidence: commit `0e03ed0`, build `2026-06-21T09:50`, "
            "service start `2026-06-21T10:05`; readiness `GET /actuator/health` = UP before the first scenario"
        )
        for label_value in (
            "- Deployment evidence: commit `0e03ed0`, build `2026-06-21T09:50`",
            "- Build fingerprint: `/version` returns build `2026-06-21T09:50`, distinct from the prior build",
        ):
            with self.subTest(label=label_value):
                mutated = good.replace(original, label_value)
                self.assertNotEqual(mutated, good)
                assert_valid_execution_report(self, mutated)

    def test_execution_report_rejects_alternate_freshness_label_placeholder(self) -> None:
        # Broadening the label keyword must not open a false-negative: a hollow value under an
        # alternate label is still caught.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace(
            "- Deployment/freshness evidence: commit `0e03ed0`, build `2026-06-21T09:50`, "
            "service start `2026-06-21T10:05`; readiness `GET /actuator/health` = UP before the first scenario",
            "- Build fingerprint: TBD",
        )
        self.assertNotEqual(mutated, good)
        with self.assertRaises(AssertionError):
            assert_valid_execution_report(self, mutated)

    def test_execution_report_accepts_hyphenated_clean_up_label(self) -> None:
        # Confirmation round F1: "Clean-up policy" (hyphen) is a valid spelling.
        good = (FIXTURES / "valid-execution-report.md").read_text(encoding="utf-8")
        mutated = good.replace("- Cleanup policy:", "- Clean-up policy:")
        self.assertNotEqual(mutated, good)
        assert_valid_execution_report(self, mutated)

    def test_report_documents_environment_state_ledger(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 6. report artifacts", 1)[1]
        for marker in (
            "environment state ledger",
            "deployment/freshness evidence",
            "cleanup policy",
            "remaining traces",
            "(reference.md#environment-state-ledger)",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_reference_defines_environment_state_ledger(self) -> None:
        reference = REFERENCE.read_text(encoding="utf-8").lower()
        for marker in (
            "## environment state ledger",
            "deployment/freshness evidence",
            "isolation namespace",
            "cleanup policy",
            "remaining traces",
            "tool permissions",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, reference)

    def test_freshness_guard_covers_redeploy_fingerprint(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 5. execute and diagnose", 1)[1].split("## 6.", 1)[0]
        for marker in ("redeploy", "behavioral fingerprint", "not evidence"):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_environment_discovery_gates_trigger_channels(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 2. environment discovery", 1)[1].split("## 3.", 1)[0]
        for marker in (
            "trigger channel",
            # EXEC-CAPABILITY-GATES output requirement: the capability map carries
            # a named `Trigger Channel Gates` facet, not just prose about gating.
            "named `trigger channel gates` facet",
            # Pin the general control vocabulary, not one framework's instance:
            # `routing-override` is the principle; `target override` is the RPC
            # example that stays in the prose but must not be the load-bearing pin.
            "allowlist",
            "routing-override",
            "service registration",
            "business handler",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_report_documents_run_lineage_and_emergent_backflow(self) -> None:
        skill = SKILL.read_text(encoding="utf-8").lower()
        section = skill.split("## 6. report artifacts", 1)[1]

        for marker in (
            "run lineage & emergent scenarios",
            "upstream plan",
            "emergent",
            "source trigger",
            "risk family",
            "plan section or risk family to update",
            "left only in the report",
            "(reference.md#run-lineage--emergent-scenarios)",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_reference_defines_run_lineage_and_emergent_backflow(self) -> None:
        reference = REFERENCE.read_text(encoding="utf-8").lower()

        for marker in (
            "## run lineage & emergent scenarios",
            "upstream plan",
            "upstream run",
            "downstream",
            "emergent scenario",
            "source trigger",
            "risk family",
            "plan section to update",
            "back-links to the source plan and the prior run",
            "no out-of-plan p0/p1 finding is left only in this report",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, reference)


if __name__ == "__main__":
    unittest.main()
