from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests/fixtures/e2e_test_planner"
PLACEHOLDER_PATTERN = re.compile(
    r"\b(tbd|todo|placeholder)\b|to\s+(?:be\s+)?(?:define|defined|fill|filled)\s+later|待定|未定|占位|暂无|待(?:补充|定义|确定|完善)|稍后(?:补充|定义|确定|完善)|后续(?:补充|定义|确定|完善)",
    re.IGNORECASE,
)


def assert_valid_generated_plan(test_case: unittest.TestCase, text: str) -> None:
    lower = text.lower()

    def first_field_line_with(section: str, *aliases: str) -> str:
        normalized_aliases = {alias.lower() for alias in aliases}
        for line in section.splitlines():
            stripped = line.lstrip()
            field_match = re.match(r"^(?:[-*]\s+|\d+\.\s+)?(.+?)\s*[:：]", stripped.lower())
            if field_match and field_match.group(1).strip() in normalized_aliases:
                return line
        return ""

    def assert_executable_line(section: str, field: str, *aliases: str) -> str:
        line = first_field_line_with(section, *aliases)
        test_case.assertTrue(line, field)
        test_case.assertIsNone(PLACEHOLDER_PATTERN.search(line), field)
        test_case.assertGreaterEqual(len(line.strip()), 18, field)
        return line

    def heading_index(*titles: str) -> int:
        for title in titles:
            match = re.search(rf"^##\s+(?:\d+\.\s+)?{re.escape(title)}\s*$", lower, re.MULTILINE)
            if match is not None:
                return match.start()
        raise ValueError(" / ".join(titles))

    def optional_heading_index(*titles: str) -> int | None:
        try:
            return heading_index(*titles)
        except ValueError:
            return None

    core_sections = (
        ("source inventory", "来源清单", "证据清单"),
        (
            "business flow diagram + journey graph",
            "business flow diagram",
            "业务流程图",
            "业务流程图 + 旅程图",
        ),
        ("agent execution contract", "agent 执行契约", "执行契约", "执行合约"),
        ("risk map", "风险图谱", "风险地图"),
        ("test scenarios", "测试场景", "测试计划"),
    )
    indexes = [heading_index(*section) for section in core_sections]
    closure_indexes = [
        heading_index("coverage matrix", "覆盖矩阵"),
        heading_index("gaps, assumptions, questions", "缺口、假设与问题", "缺口、假设、问题"),
        heading_index("execution order", "执行顺序"),
        heading_index("agent-ready gates", "agent 就绪门禁"),
    ]
    minimal_slice_index = optional_heading_index(
        "minimal first automation slice", "最小首个自动化切片", "最小自动化切片"
    )
    test_case.assertEqual(indexes, sorted(indexes))
    test_case.assertEqual(closure_indexes, sorted(closure_indexes))
    test_case.assertGreater(min(closure_indexes), indexes[-1])
    if minimal_slice_index is not None:
        test_case.assertGreater(minimal_slice_index, closure_indexes[-1])

    gates_end = minimal_slice_index if minimal_slice_index is not None else len(lower)
    agent_ready_gates = lower[closure_indexes[-1] : gates_end]
    gate_lines = {
        "entry": assert_executable_line(agent_ready_gates, "entry gate", "entry", "入口门禁"),
        "exit": assert_executable_line(agent_ready_gates, "exit gate", "exit", "退出门禁"),
        "suspend": assert_executable_line(agent_ready_gates, "suspend gate", "suspend", "暂停门禁"),
    }
    test_case.assertRegex(
        gate_lines["entry"],
        r"`[^`]+`|api|endpoint|stub|hook|db|table|queue|redis|service|job|profile|入口|目标|替身|表|任务",
        "entry gate needs executable prerequisites or surfaces",
    )
    test_case.assertRegex(
        gate_lines["exit"],
        r"evidence|captur|probe|response|log|metric|cleanup|record|artifact|证据|保存|探针|响应|日志|清理|确认",
        "exit gate needs evidence criteria",
    )
    test_case.assertRegex(
        gate_lines["suspend"],
        r"stop|suspend|unavailable|missing|cannot|fail|block|暂停|阻塞|缺少|无法|不可用|失败",
        "suspend gate needs blockers that stop execution",
    )

    business_flow = lower[indexes[1] : indexes[2]]
    test_case.assertTrue(
        "```mermaid" in business_flow and any(marker in business_flow for marker in ("flowchart", "sequencediagram", "statediagram")),
        "business flow must include a Mermaid diagram",
    )
    test_case.assertTrue(
        any(marker in business_flow for marker in ("-->", "->>", "-.->")),
        "business flow diagram must show directional edges",
    )
    test_case.assertRegex(business_flow, r"\b[a-z]*j\d+\b", "business flow must use stable edge IDs")
    test_case.assertTrue(
        any(marker in business_flow for marker in ("produces", "产物", "输出", "返回")),
        "business flow must name produced outputs",
    )
    test_case.assertTrue(
        any(marker in business_flow for marker in ("consumes", "依赖", "输入", "取")),
        "business flow must name consumed dependencies",
    )
    table_headers = [
        line
        for line in business_flow.splitlines()
        if line.strip().startswith("|") and any(marker in line for marker in ("edge", "边"))
    ]
    test_case.assertTrue(
        any(any(marker in header for marker in ("source", "receipt", "来源", "证据")) for header in table_headers),
        "business flow edge table must include source receipts",
    )

    agent_contract = lower[indexes[2] : indexes[3]]
    contract_lines = {}
    for field, aliases in (
        ("target surfaces", ("target surfaces", "目标面")),
        ("fixtures", ("fixtures", "测试数据")),
        ("named variables", ("named variables", "变量传递")),
        ("probes/oracles", ("probes/oracles", "探针/oracle")),
        ("waits", ("waits", "等待/预算")),
        ("cleanup", ("cleanup", "隔离/清理")),
        ("blockers", ("blockers/gaps", "阻塞/缺口")),
    ):
        contract_lines[field] = assert_executable_line(agent_contract, field, *aliases)
    test_case.assertRegex(agent_contract, r"\b[a-z]*j\d+\b", "agent contract must tie execution details to journey edges")
    test_case.assertRegex(agent_contract, r"`[^`]+`", "agent contract must include exact sourced locators or variable names")
    test_case.assertRegex(contract_lines["target surfaces"], r"`[^`]+`", "target surfaces need executable locators")
    test_case.assertRegex(contract_lines["target surfaces"], r"\b[a-z]*j\d+\b", "target surfaces must map to journey edges")
    test_case.assertRegex(contract_lines["fixtures"], r",|、| and |/|，", "fixtures need multiple concrete data dependencies")
    test_case.assertRegex(contract_lines["fixtures"], r"\b[a-z]*j\d+\b", "fixtures must map to journey edges")
    test_case.assertRegex(contract_lines["named variables"], r"\b[a-z]*j\d+\b.*`[^`]+`", "variables must map journey edges to named values")
    test_case.assertRegex(contract_lines["probes/oracles"], r"\b[a-z]*j\d+\b", "probes must map to journey edges")
    test_case.assertRegex(contract_lines["probes/oracles"], r"`[^`]+`|api|db|table|表|日志|metric|event|事件", "probes need observable surfaces")
    test_case.assertRegex(contract_lines["waits"], r"\b[a-z]*j\d+\b", "waits must map to journey edges")
    test_case.assertRegex(contract_lines["waits"], r"timeout|budget|poll|wait|等待|超时|预算|轮询", "waits need a bounded wait strategy")
    test_case.assertRegex(contract_lines["cleanup"], r"\b[a-z]*j\d+\b", "cleanup must map to journey edges")
    test_case.assertRegex(contract_lines["cleanup"], r"`[^`]+`", "cleanup must name cleanup keys or records")

    scenario_matches = list(re.finditer(r"^###\s+[-\w]*e2e-\d+[a-z]?\b", lower, re.MULTILINE))
    scenarios = [
        text[match.start() : scenario_matches[index + 1].start() if index + 1 < len(scenario_matches) else len(text)]
        for index, match in enumerate(scenario_matches)
    ]
    test_case.assertGreaterEqual(len(scenarios), 1)
    for scenario in scenarios:
        scenario_lower = scenario.lower()
        scenario_lines = {}
        for field, aliases in (
            ("purpose", ("purpose/risk", "目的")),
            ("priority", ("priority", "优先级")),
            ("sources", ("sources", "来源")),
            ("edges", ("edges", "覆盖边")),
            ("setup", ("setup", "准备")),
            ("steps", ("steps", "步骤和依赖")),
            ("expected", ("expected", "期望")),
            ("automation", ("automation", "自动化级别")),
            ("isolation", ("isolation/cleanup", "隔离/清理")),
        ):
            line = first_field_line_with(scenario_lower, *aliases)
            test_case.assertTrue(line, field)
            test_case.assertIsNone(PLACEHOLDER_PATTERN.search(line), field)
            scenario_lines[field] = line
        test_case.assertRegex(
            scenario_lines["expected"].lower(),
            r"probe|oracle|wait|timeout|assert|invariant|断言|探针|等待|超时|不变量|一致",
            "expected field must contain probes, waits, or invariants",
        )
        test_case.assertTrue(any(alias in scenario_lower for alias in ("target", "surface", "api", "endpoint", "stub", "hook", "目标", "入口", "任务", "替身")))
        test_case.assertTrue(any(alias in scenario_lower for alias in ("probe", "oracle", "wait", "timeout", "assert", "断言", "探针", "等待", "超时")))
        test_case.assertRegex(scenario_lower, r"\b[a-z]*j\d+\b", "scenario must cite business-flow edge IDs")
        test_case.assertRegex(scenario_lower, r"(consumes|produces|capture|captures|取|依赖)")


class E2ETestPlannerContractTest(unittest.TestCase):
    def test_skill_keeps_dependency_aware_planning_core(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()

        for marker in (
            "journey graph",
            "business flow",
            "mermaid",
            "stable edge ids",
            "source-backed",
            "design, requirements, plan documents",
            "codebase behavior",
            "output language",
            "use the language the user explicitly requests",
            "infer from the user's latest prompt",
            "dominant source-document language",
            "mixed-language input",
            "user's conversational language",
            "preserve code identifiers",
            "state the assumed output language once",
            "primary consumer",
            "downstream agent",
            "executable handoff",
            "stable field labels",
            "keep these labels exact",
            "machine-scannable",
            "agent execution contract",
            "target surfaces",
            "data fixtures",
            "named variables",
            "probes/oracles",
            "waits and budgets",
            "blockers or gaps",
            "every claimed behavior has a source receipt",
            "if a later scenario cites a new source",
            "every later scenario cites the edge ids it covers",
            "api variant",
            "required-input branch",
            "business-flow edge",
            "dependency edge",
            "cross-step consistency",
            "concurrency",
            "idempotency and recovery",
            "performance and scale",
            "source-only suspected defects",
            "coverage matrix",
            "level-2 `coverage matrix`",
            "level-2 `gaps, assumptions, questions`",
            "match cleanup to real transaction boundaries",
            "label unverified source-derived defect claims as hypotheses",
            "do not write test code unless the user asks",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, skill)

    def test_description_routes_e2e_plan_requests(self) -> None:
        text = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8")
        frontmatter = text.split("---", 2)[1].lower()

        for marker in (
            "end-to-end test plans",
            "e2e/end-to-end/端到端/全链路 test plan",
            "端到端测试计划",
            "全链路测试计划",
            "端到端测试场景",
            "全链路测试场景",
            "链路测试",
            "全链路回归",
            "end-to-end cross-system business workflow test plan",
            "end-to-end dependency-aware workflow test plan",
            "integration/acceptance/regression coverage of an end-to-end flow",
            "dependent workflows",
            "e2e test scenarios from docs/code analysis",
            "performance, consistency, concurrency, idempotency",
            "do not use for fixing failing tests",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, frontmatter)

    def test_output_language_policy_prefers_user_input(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8")
        policy = skill.split("Output language:", 1)[1].split("## 1. Source Inventory", 1)[0].lower()

        for marker in (
            "explicitly requests",
            "latest prompt",
            "dominant source-document language",
            "mixed-language input",
            "conversational language",
            "preserve code identifiers",
            "paths",
            "api names",
            "enum values",
            "logs",
            "quoted source text",
            "state the assumed output language once",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, policy)
        self.assertLess(policy.index("explicitly requests"), policy.index("latest prompt"))
        self.assertLess(policy.index("latest prompt"), policy.index("dominant source-document language"))

    def test_journey_graph_precedes_risk_map_and_test_plan(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()

        source_index = skill.index("## 1. source inventory")
        graph_index = skill.index("## 2. business flow diagram + journey graph")
        agent_index = skill.index("## 3. agent execution contract")
        risk_index = skill.index("## 4. risk map")
        plan_index = skill.index("## 5. test plan")
        closure_index = skill.index("## 6. closure")

        self.assertLess(source_index, graph_index)
        self.assertLess(graph_index, agent_index)
        self.assertLess(agent_index, risk_index)
        self.assertLess(risk_index, plan_index)
        self.assertLess(plan_index, closure_index)
        self.assertIn("before scenarios, draw a mermaid business flow diagram", skill)
        self.assertIn("every important diagram edge appears in the table", skill)
        self.assertIn("every later scenario cites the edge ids it covers", skill)
        self.assertIn("before risk mapping, define what a follow-on agent can execute", skill)
        self.assertIn("derive scenarios from the journey graph, not from a generic checklist", skill)

    def test_agent_execution_contract_requires_agent_handoff_fields(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()
        section = skill.split("## 3. agent execution contract", 1)[1].split("## 4. risk map", 1)[0]

        for marker in (
            "target surfaces",
            "`target surfaces`",
            "`目标面`",
            "apis, ui routes/selectors",
            "events, jobs, tables, commands",
            "data fixtures and named variables",
            "`fixtures`",
            "`测试数据`",
            "`named variables`",
            "`变量传递`",
            "which ids or tokens each journey edge produces",
            "probes/oracles",
            "`probes/oracles`",
            "`探针/oracle`",
            "waits and budgets",
            "`waits`",
            "`等待/预算`",
            "isolation and cleanup",
            "`cleanup`",
            "`隔离/清理`",
            "blockers or gaps",
            "`blockers/gaps`",
            "`阻塞/缺口`",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_scenario_contract_requires_implementation_ready_fields(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8")
        section = skill.split("For each scenario include:", 1)[1].split(
            "Completion criterion: no scenario assumes", 1
        )[0].lower()

        for marker in (
            "`purpose/risk`",
            "`priority`",
            "`sources`",
            "`edges`",
            "`setup`",
            "`steps`",
            "`expected`",
            "`automation`",
            "`isolation/cleanup`",
            "`目的`",
            "`优先级`",
            "`来源`",
            "`覆盖边`",
            "`准备`",
            "`步骤和依赖`",
            "`期望`",
            "`自动化级别`",
            "`隔离/清理`",
            "target surfaces, environment assumptions",
            "named-variable dependency chain",
            "what each step consumes from previous steps and what it produces",
            "probes, waits, and invariants",
            "match cleanup to real transaction boundaries",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_generated_plan_fixture_satisfies_output_contract(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")

        assert_valid_generated_plan(self, text)

    def test_chinese_generated_plan_fixture_satisfies_output_contract(self) -> None:
        text = (FIXTURES / "valid-generated-plan-zh.md").read_text(encoding="utf-8")

        assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_missing_closure(self) -> None:
        text = (FIXTURES / "missing-closure-plan.md").read_text(encoding="utf-8")

        with self.assertRaises(ValueError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_marker_only_plan(self) -> None:
        text = (FIXTURES / "marker-only-plan.md").read_text(encoding="utf-8")

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_thin_agent_contract(self) -> None:
        text = (FIXTURES / "thin-agent-contract-plan.md").read_text(encoding="utf-8")

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_chinese_placeholder_setup(self) -> None:
        text = (FIXTURES / "valid-generated-plan-zh.md").read_text(encoding="utf-8").replace(
            "- 准备：买家账号、可售商品、支付网关测试替身、订单创建 API、支付回调入口和开票任务。",
            "- 准备：稍后补充。",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_accepts_without_optional_minimal_slice(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        without_minimal_slice = text.split("\n## 10. Minimal First Automation Slice", 1)[0].rstrip()

        assert_valid_generated_plan(self, without_minimal_slice)

    def test_generated_plan_output_contract_rejects_thin_agent_ready_gates(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        before_gates, after_gates = text.split("## 9. Agent-ready Gates", 1)
        _, after_minimal = after_gates.split("## 10. Minimal First Automation Slice", 1)
        thin_gates = (
            before_gates
            + "## 9. Agent-ready Gates\n\n"
            + "- Entry: ok.\n"
            + "- Exit: done.\n"
            + "- Suspend: stop.\n\n"
            + "## 10. Minimal First Automation Slice"
            + after_minimal
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, thin_gates)

    def test_generated_plan_output_contract_rejects_thin_expected_field(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "- Expected: Probes show order is paid; stock decreases once; invoice query references `orderId`; callback id is recorded after the wait.",
            "- Expected: OK.",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_unstable_chinese_field_labels(self) -> None:
        original = (FIXTURES / "valid-generated-plan-zh.md").read_text(encoding="utf-8")
        cases = (
            original.replace("- 变量传递：", "- 命名变量："),
            original.replace("- 准备：", "- 准备数据："),
            original.replace("- 步骤和依赖：", "- 步骤："),
            original.replace("- 期望：", "- 期望结果："),
            original.replace("- 自动化级别：", "- 自动化："),
            original.replace("- 阻塞/缺口：", "- 阻塞："),
            original.replace("## 6. 覆盖矩阵", "### 覆盖矩阵"),
            original.replace("## 9. Agent 就绪门禁", "## 9. 门禁"),
        )

        for text in cases:
            with self.subTest():
                with self.assertRaises((AssertionError, ValueError)):
                    assert_valid_generated_plan(self, text)


if __name__ == "__main__":
    unittest.main()
