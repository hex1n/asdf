from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests/fixtures/e2e_test_planner"
PLANNER_REFERENCE = ROOT / "skills/e2e-test-planner/REFERENCE.md"
PLACEHOLDER_PATTERN = re.compile(
    r"\b(tbd|todo|placeholder)\b|to\s+(?:be\s+)?(?:define|defined|fill|filled)\s+later|待定|未定|占位|暂无|待(?:补充|定义|确定|完善)|稍后(?:补充|定义|确定|完善)|后续(?:补充|定义|确定|完善)",
    re.IGNORECASE,
)
VAR_PATTERN = re.compile(r"`([^`]+)`")
IDENTIFIER_VAR_PATTERN = re.compile(
    r"\b(?:[A-Za-z][A-Za-z0-9]*(?:Id|ID|Token|Key|No|Code|Event|Intent)|[a-z]+(?:_[a-z0-9]+)*(?:_id|_token|_key|_no|_code|_event|_intent)|[A-Z]+(?:_[A-Z0-9]+)*(?:_ID|_TOKEN|_KEY|_NO|_CODE|_EVENT|_INTENT))\b"
)
SCENARIO_PATTERN = re.compile(r"\b[-\w]*e2e-\d+[a-z]?\b", re.IGNORECASE)
NODE_PATTERN = re.compile(r"\bn\d+\b", re.IGNORECASE)

WELLFORMED_EXECUTOR_HANDOFF = """## Executor Handoff Index

| Field | Value |
| --- | --- |
| Artifact ID | checkout-e2e-plan 2026-06-21 |
| Contract version | `e2e-plan/v1` |
| Plan source | `docs/checkout-prd.md`, `src/orders`, `src/payments`; payment SLA unsourced |
| Scenario set | CHECKOUT-E2E-001 default node N1; no manual or blocked scenarios |
| DAG nodes | N1 -> CHECKOUT-E2E-001, dependency roots J1-J4, disruptive none |
| Variable ledger | `orderId` and `invoiceId` produced by N1, consumed by cleanup by `orderId` |
| Required capabilities | API, DB, job, stub; no missing gates |
| Cleanup anchors | `orderId` batch prefix, cleanup after invoice probe, low retention risk |
| Execution blockers | payment-provider timeout SLA unsourced |
"""


def delegated_plan(handoff_block: str) -> str:
    """Insert a delegated-execution handoff index after the DAG, before closure."""
    text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
    before, after = text.split("\n## 7. Coverage Matrix", 1)
    return before + "\n" + handoff_block + "\n## 7. Coverage Matrix" + after


def extract_variables(cell: str) -> set[str]:
    return {
        *[variable.lower() for variable in VAR_PATTERN.findall(cell)],
        *[variable.lower() for variable in IDENTIFIER_VAR_PATTERN.findall(cell)],
    }


def parse_markdown_table(test_case: unittest.TestCase, section: str) -> list[dict[str, str]]:
    table_lines = [line.strip() for line in section.splitlines() if line.strip().startswith("|")]
    if len(table_lines) < 3:
        return []
    headers = [cell.strip().lower() for cell in table_lines[0].strip("|").split("|")]
    separator_cells = [cell.strip() for cell in table_lines[1].strip("|").split("|")]
    test_case.assertEqual(len(headers), len(separator_cells), "DAG table separator must match header width")
    test_case.assertTrue(
        all(re.fullmatch(r":?-+:?", cell) for cell in separator_cells),
        f"markdown table is missing its separator row: {table_lines[1]}",
    )
    rows: list[dict[str, str]] = []
    for line in table_lines[2:]:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        test_case.assertEqual(len(headers), len(cells), f"malformed markdown table row: {line}")
        rows.append(dict(zip(headers, cells)))
    return rows


def get_dag_cell(row: dict[str, str], english: str, chinese: str) -> str:
    return row.get(english, row.get(chinese, "")).strip()


def is_source_supported(variable: str, sourced_text: str) -> bool:
    return f"`{variable}`" in sourced_text or variable in sourced_text


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
        ("execution dag", "执行 dag"),
    )
    indexes = [heading_index(*section) for section in core_sections]
    closure_indexes = [
        heading_index("coverage matrix", "覆盖矩阵"),
        heading_index("gaps, assumptions, questions", "缺口、假设与问题", "缺口、假设、问题"),
        heading_index("agent-ready gates", "agent 就绪门禁"),
    ]
    # Execution Order is an optional, human-facing projection of the DAG; the
    # executor derives order from `Depends on`, so it is not a required section.
    execution_order_index = optional_heading_index("execution order", "执行顺序")
    minimal_slice_index = optional_heading_index(
        "minimal first automation slice", "最小首个自动化切片", "最小自动化切片"
    )
    # Executor Handoff Index is an optional delegated-execution projection placed
    # after the DAG and before closure. When present it must carry the locator
    # fields an executor needs; its slice boundary is also used below so its own
    # table does not bleed into DAG table parsing.
    executor_handoff_index = optional_heading_index("executor handoff index", "执行器交接索引")
    test_case.assertEqual(indexes, sorted(indexes))
    test_case.assertEqual(closure_indexes, sorted(closure_indexes))
    test_case.assertGreater(min(closure_indexes), indexes[-1])
    if execution_order_index is not None:
        test_case.assertGreater(execution_order_index, indexes[-1])
    if minimal_slice_index is not None:
        test_case.assertGreater(minimal_slice_index, closure_indexes[-1])
    if executor_handoff_index is not None:
        test_case.assertGreater(executor_handoff_index, indexes[-1])
        test_case.assertLess(executor_handoff_index, min(closure_indexes))
        handoff_section = lower[executor_handoff_index : min(closure_indexes)]
        for handoff_field in (
            "artifact id",
            "contract version",
            "e2e-plan/v1",
            "plan source",
            "scenario set",
            "dag nodes",
            "variable ledger",
            "required capabilities",
            "cleanup anchors",
            "execution blockers",
        ):
            test_case.assertIn(
                handoff_field,
                handoff_section,
                f"executor handoff index missing field: {handoff_field}",
            )

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
    scenario_ids = {
        SCENARIO_PATTERN.search(match.group(0)).group(0).lower()
        for match in scenario_matches
        if SCENARIO_PATTERN.search(match.group(0))
    }
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

    # Migration read-path matrix (conditional projection): a migration that backfills a
    # shared column, changes a table/column shape, or copies/dedups rows can make every
    # writer succeed yet break an existing reader. When a `Migration Read-Path Risk Matrix`
    # is present it must be well-formed, correctly placed (after Risk Map, before Test
    # Scenarios), and SYMMETRIC — every row maps to a real read-path scenario id or a
    # declared blocker. The validator does NOT infer migration intent from prose: a keyword
    # trigger both false-positives on words like "backfill" and is evadable by synonyms, so
    # "a migration plan must include the matrix" is carried by the SKILL instruction and the
    # migration fixture, not forced onto every plan here.
    migration_matrix_index = optional_heading_index(
        "migration read-path risk matrix", "迁移读路径风险矩阵"
    )
    if migration_matrix_index is not None:
        test_case.assertGreater(
            migration_matrix_index, indexes[3], "migration matrix must follow the Risk Map"
        )
        test_case.assertLess(
            migration_matrix_index, indexes[4], "migration matrix must precede the Test Scenarios"
        )
        next_heading = re.search(r"\n##\s", text[migration_matrix_index + 1 :])
        matrix_end = (
            migration_matrix_index + 1 + next_heading.start() if next_heading else len(text)
        )
        matrix_section = text[migration_matrix_index:matrix_end]
        test_case.assertIsNone(
            PLACEHOLDER_PATTERN.search(matrix_section.lower()),
            "migration read-path matrix must not contain placeholders",
        )
        matrix_rows = parse_markdown_table(test_case, matrix_section)
        test_case.assertGreaterEqual(
            len(matrix_rows), 1, "migration read-path matrix must include reader rows"
        )
        header_keys = " | ".join(matrix_rows[0].keys())
        english_columns = ("changed", "reader", "old", "new", "scenario", "decision")
        chinese_columns = ("变更", "读取", "旧", "新", "场景", "决策")
        test_case.assertTrue(
            all(column in header_keys for column in english_columns)
            or all(column in header_keys for column in chinese_columns),
            "migration read-path matrix must use stable columns",
        )
        test_case.assertGreaterEqual(
            len(matrix_rows[0]), 6,
            "migration read-path matrix needs distinct columns, not a merged header",
        )
        for row in matrix_rows:
            scenario_cell = next(
                (value for key, value in row.items() if "scenario" in key or "场景" in key), ""
            )
            decision_cell = next(
                (value for key, value in row.items() if "decision" in key or "决策" in key), ""
            )
            referenced = {
                match.group(0).lower()
                for match in SCENARIO_PATTERN.finditer(scenario_cell.lower())
            }
            # A genuine blocker is the declared value of the scenario or decision cell
            # (`blocker` / `blocker: reason` / 阻塞 / 缺口), not a substring of a compound
            # word like "non-blocker" or "blocker-free" sitting in incidental prose.
            is_blocker = any(
                re.match(r"(?:blocker|阻塞|缺口)\s*(?::|：|$)", value.strip().strip("`").strip().lower())
                is not None
                for value in (scenario_cell, decision_cell)
            )
            test_case.assertTrue(
                referenced or is_blocker,
                "each migration matrix row needs a read-path scenario id or a declared blocker",
            )
            test_case.assertTrue(
                referenced <= scenario_ids,
                f"migration matrix row references unknown scenario: {scenario_cell}",
            )

    # Document-code semantic diff (conditional projection): a documented contract that
    # diverges from code behavior is often the highest-value defect. When a
    # `Document-Code Semantic Diff` is present it must be well-formed, placed after the
    # Source Inventory and before the Test Scenarios, and SYMMETRIC — every non-`match`
    # P0/P1 row resolves to a real scenario id or an explicit closed/blocked decision.
    # Presence is carried by the SKILL instruction, not a prose trigger.
    diff_index = optional_heading_index("document-code semantic diff", "文档-代码语义差异")
    if diff_index is not None:
        test_case.assertGreater(
            diff_index, indexes[0], "doc-code diff must follow the Source Inventory"
        )
        test_case.assertLess(
            diff_index, indexes[4], "doc-code diff must precede the Test Scenarios"
        )
        next_diff_heading = re.search(r"\n##\s", text[diff_index + 1 :])
        diff_end = diff_index + 1 + next_diff_heading.start() if next_diff_heading else len(text)
        diff_section = text[diff_index:diff_end]
        test_case.assertIsNone(
            PLACEHOLDER_PATTERN.search(diff_section.lower()),
            "document-code semantic diff must not contain placeholders",
        )
        diff_rows = parse_markdown_table(test_case, diff_section)
        test_case.assertGreaterEqual(
            len(diff_rows), 1, "document-code semantic diff must include contract rows"
        )
        diff_headers = " | ".join(diff_rows[0].keys())
        english_diff_columns = ("contract", "code", "delta", "risk", "resolution")
        chinese_diff_columns = ("契约", "代码", "差异", "风险", "处置")
        test_case.assertTrue(
            all(column in diff_headers for column in english_diff_columns)
            or all(column in diff_headers for column in chinese_diff_columns),
            "document-code semantic diff must use stable columns",
        )
        test_case.assertGreaterEqual(
            len(diff_rows[0]), 5,
            "document-code semantic diff needs distinct columns, not a merged header",
        )
        for row in diff_rows:
            delta_cell = next(
                (value for key, value in row.items() if "delta" in key or "差异" in key), ""
            )
            risk_cell = next(
                (value for key, value in row.items() if "risk" in key or "风险" in key), ""
            )
            resolution_cell = next(
                (value for key, value in row.items() if "resolution" in key or "处置" in key), ""
            )
            # Only an unresolved P0/P1 divergence must map to a scenario; a verified `match`
            # or a P2 row is informational and skipped.
            delta_value = delta_cell.replace("`", "").strip().lower()
            is_high_risk = re.search(r"\bp[01]\b", risk_cell.lower())
            # `match` is an EXACT value, not a prefix: "match (mostly)" is a hedged
            # divergence, not a verified match, and must not skip the symmetry check.
            if delta_value in ("match", "一致") or is_high_risk is None:
                continue
            referenced = {
                m.group(0).lower() for m in SCENARIO_PATTERN.finditer(resolution_cell.lower())
            }
            # A resolution is a real scenario id or an explicit closed/blocked value, not a
            # substring of incidental prose.
            is_closed = (
                re.match(
                    r"(?:closed|blocked|关闭|阻塞)\s*(?::|：|$)",
                    resolution_cell.replace("`", "").strip().lower(),
                )
                is not None
            )
            test_case.assertTrue(
                referenced or is_closed,
                "each P0/P1 doc-code delta needs a scenario id or a closed/blocked resolution",
            )
            test_case.assertTrue(
                referenced <= scenario_ids,
                f"doc-code diff row references unknown scenario: {resolution_cell}",
            )

    dag_end = executor_handoff_index if executor_handoff_index is not None else min(closure_indexes)
    execution_dag_original = text[indexes[5] : dag_end]
    execution_dag = execution_dag_original.lower()
    dag_header_lines = [line for line in execution_dag.splitlines() if line.strip().startswith("|")]
    test_case.assertTrue(dag_header_lines, "execution DAG must include a table")
    dag_header = dag_header_lines[0]
    english_headers = (
        "node",
        "scenario",
        "depends on",
        "consumes",
        "produces",
        "required capabilities",
        "side-effect scope",
        "isolation key",
        "parallel safety",
        "cleanup dependency",
        "disruptive marker",
    )
    chinese_headers = (
        "节点",
        "场景",
        "依赖",
        "消费",
        "产出",
        "所需能力",
        "副作用范围",
        "隔离键",
        "并行安全",
        "清理依赖",
        "扰动标记",
    )
    test_case.assertTrue(
        all(header in dag_header for header in english_headers)
        or all(header in dag_header for header in chinese_headers),
        "execution DAG must use stable headers",
    )
    dag_rows = parse_markdown_table(test_case, execution_dag_original)
    test_case.assertGreaterEqual(len(dag_rows), 1, "execution DAG must include executable rows")
    dag_scenarios: set[str] = set()
    dependency_graph: dict[str, set[str]] = {}
    produced_by_node = {
        get_dag_cell(row, "node", "节点").lower(): extract_variables(get_dag_cell(row, "produces", "产出"))
        for row in dag_rows
        if get_dag_cell(row, "node", "节点")
    }
    node_ids = set(produced_by_node)
    sourced_before_dag = text[: indexes[5]].lower()
    for row in dag_rows:
        node = get_dag_cell(row, "node", "节点").lower()
        scenario = get_dag_cell(row, "scenario", "场景").lower()
        depends_on_original = get_dag_cell(row, "depends on", "依赖")
        depends_on = depends_on_original.lower()
        consumes = get_dag_cell(row, "consumes", "消费")
        produces = get_dag_cell(row, "produces", "产出")
        capabilities = get_dag_cell(row, "required capabilities", "所需能力").lower()
        side_effect_scope = get_dag_cell(row, "side-effect scope", "副作用范围").lower()
        isolation_key = get_dag_cell(row, "isolation key", "隔离键").lower()
        parallel_safety = get_dag_cell(row, "parallel safety", "并行安全").lower()
        cleanup_dependency = get_dag_cell(row, "cleanup dependency", "清理依赖").lower()
        disruptive_marker = get_dag_cell(row, "disruptive marker", "扰动标记").lower()

        test_case.assertRegex(node, NODE_PATTERN, "execution DAG must use stable node IDs")
        row_scenarios = {match.group(0).lower() for match in SCENARIO_PATTERN.finditer(scenario)}
        test_case.assertTrue(row_scenarios, "each DAG row must map to a scenario")
        test_case.assertTrue(row_scenarios <= scenario_ids, f"DAG row references unknown scenario: {scenario}")
        dag_scenarios.update(row_scenarios)
        test_case.assertRegex(depends_on, r"\b(?:[a-z]*j\d+|n\d+)\b|ready|可用", "each DAG row must cite edges, predecessor nodes, or readiness dependencies")
        test_case.assertGreaterEqual(len(consumes.strip()), 3, "each DAG row must name consumed inputs")
        test_case.assertGreaterEqual(len(produces.strip()), 3, "each DAG row must name produced outputs")
        depends_on_variables = extract_variables(depends_on_original)
        row_consumed_variables = extract_variables(consumes)
        row_produced_variables = extract_variables(produces)
        predecessor_nodes = {match.group(0).lower() for match in NODE_PATTERN.finditer(depends_on_original)}
        dependency_graph[node] = predecessor_nodes
        unknown_predecessors = predecessor_nodes - node_ids
        test_case.assertFalse(unknown_predecessors, f"Depends on references unknown DAG nodes: {sorted(unknown_predecessors)}")
        available_from_predecessors = {
            variable
            for predecessor in predecessor_nodes
            for variable in produced_by_node.get(predecessor, set())
        }
        for variable in row_consumed_variables | depends_on_variables:
            if is_source_supported(variable, sourced_before_dag):
                continue
            test_case.assertNotIn(
                variable,
                row_produced_variables,
                f"DAG node {node} consumes non-source-supported variable it also produces: {variable}",
            )
            test_case.assertIn(
                variable,
                available_from_predecessors,
                f"DAG node {node} consumes variable without source support or predecessor producer: {variable}",
            )
        test_case.assertRegex(
            capabilities,
            r"\b(api|rpc|cli|db|mq|job|log|metric|stub|ui)\b|任务|替身",
            "each DAG row must name required capabilities",
        )
        test_case.assertRegex(
            side_effect_scope,
            r"table|queue|cache|ledger|invoice|order|stock|event|表|队列|缓存|事件|发票|订单|支付",
            "each DAG row must name side-effect scope",
        )
        test_case.assertRegex(
            isolation_key,
            r"`[^`]+`|prefix|batch|trace|tenant|account|id|前缀|批次|租户|账号",
            "each DAG row must name an isolation key",
        )
        test_case.assertRegex(
            parallel_safety,
            r"^(safe|unsafe|unknown|安全|不安全|未知)\s*[:：]\s*\S.{5,}$",
            "parallel safety must be safe/unsafe/unknown with a non-empty reason",
        )
        test_case.assertRegex(
            cleanup_dependency,
            r"cleanup|清理",
            "each DAG row must include cleanup dependencies",
        )
        cleanup_variables = extract_variables(cleanup_dependency)
        test_case.assertTrue(
            cleanup_variables,
            "cleanup dependency must name the produced or source-supported variables needed for cleanup",
        )
        unsupported_cleanup_variables = {
            variable
            for variable in cleanup_variables
            if variable not in row_produced_variables
            and variable not in available_from_predecessors
            and not is_source_supported(variable, sourced_before_dag)
        }
        test_case.assertFalse(
            unsupported_cleanup_variables,
            f"cleanup dependency uses variables without producers or source support: {sorted(unsupported_cleanup_variables)}",
        )
        test_case.assertTrue(
            cleanup_variables & (row_produced_variables | available_from_predecessors)
            or any(is_source_supported(variable, sourced_before_dag) for variable in cleanup_variables),
            "cleanup dependency must be tied to produced or source-supported variables",
        )
        test_case.assertRegex(
            disruptive_marker,
            r"none|concurrency|recovery|compensation|load|race|callback|无|回调|并发|恢复|补偿|压测",
            "each DAG row must mark disruptive behavior or none",
        )
    missing_scenarios = {
        scenario
        for scenario in scenario_ids - dag_scenarios
        if not re.search(rf"\b{re.escape(scenario)}\b.*\b(manual|blocked|手工|阻塞)\b", execution_dag)
    }
    test_case.assertFalse(missing_scenarios, f"scenarios missing from execution DAG: {sorted(missing_scenarios)}")
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str) -> bool:
        if node in visiting:
            return False
        if node in visited:
            return True
        visiting.add(node)
        for predecessor in dependency_graph.get(node, set()):
            if not visit(predecessor):
                return False
        visiting.remove(node)
        visited.add(node)
        return True

    for node in node_ids:
        test_case.assertTrue(visit(node), f"execution DAG contains a cycle involving {node}")


class E2ETestPlannerContractTest(unittest.TestCase):
    def test_skill_keeps_dependency_aware_planning_core(self) -> None:
        # This guard protects only the defining soul of the skill plus the
        # safety/honesty clauses that no other structured test covers. Section
        # ordering, output-language policy, the agent-contract / scenario / DAG
        # field schemas, closure sections, and routing keywords are each asserted
        # by their own dedicated tests below and by assert_valid_generated_plan,
        # so they are intentionally not re-pinned here as literal prose. Reword
        # instructional text freely; only these load-bearing anchors are fixed.
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()

        for marker in (
            "source-backed",
            "dependency-aware",
            "business flow",
            "journey graph",
            "downstream agent",
            "executable handoff",
            "do not write test code unless the user asks",
            "label unverified source-derived defect claims as hypotheses",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, skill)

    def test_reference_defines_executor_handoff_index(self) -> None:
        reference = PLANNER_REFERENCE.read_text(encoding="utf-8").lower()

        for marker in (
            "## executor handoff index",
            "e2e-test-executor",
            "separate agent session",
            "automation",
            "## 执行器交接索引",
            "artifact id",
            "contract version",
            "e2e-plan/v1",
            "plan source",
            "scenario set",
            "dag nodes",
            "variable ledger",
            "required capabilities",
            "cleanup anchors",
            "execution blockers",
            "without reading every scenario body first",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, reference)

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
        plan_index = skill.index("## 5. test scenarios")
        dag_index = skill.index("## 6. execution dag")
        closure_index = skill.index("## 7. closure")

        self.assertLess(source_index, graph_index)
        self.assertLess(graph_index, agent_index)
        self.assertLess(agent_index, risk_index)
        self.assertLess(risk_index, plan_index)
        self.assertLess(plan_index, dag_index)
        self.assertLess(dag_index, closure_index)
        self.assertIn("before scenarios, draw a mermaid business flow diagram", skill)
        self.assertIn("every important diagram edge appears in the table", skill)
        self.assertIn("every later scenario cites the edge ids it covers", skill)
        self.assertIn("before risk mapping, define what a follow-on agent can execute", skill)
        self.assertIn("derive scenarios from the journey graph, not from a generic checklist", skill)
        self.assertIn("execution order can be derived from `depends on`", skill)

    def test_execution_dag_contract_requires_scheduler_facts(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()
        section = skill.split("## 6. execution dag", 1)[1].split("## 7. closure", 1)[0]

        for marker in (
            "executor-consumable dag",
            "does not decide the runtime schedule",
            "`node`",
            "`scenario`",
            "`depends on`",
            "`consumes`",
            "`produces`",
            "`required capabilities`",
            "`side-effect scope`",
            "`isolation key`",
            "`parallel safety`",
            "`cleanup dependency`",
            "`disruptive marker`",
            "`节点`",
            "`场景`",
            "`依赖`",
            "`消费`",
            "`产出`",
            "`所需能力`",
            "`副作用范围`",
            "`隔离键`",
            "`并行安全`",
            "`清理依赖`",
            "`扰动标记`",
            "`safe`, `unsafe`, or `unknown`",
            "every variable used across scenarios has a producer or source-supported fixture and a consumer",
            "produced variables consumed by a node come from predecessor nodes named in `depends on`",
            "the dag is acyclic",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

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

    def test_agent_contract_and_gates_require_runtime_fact_provenance(self) -> None:
        # PLANNER-FACT-CONSISTENCY-GATE: §3 tags every runtime fact with a
        # three-way provenance status, and §7 forbids the same fact being both
        # `confirmed by source` and an unmet gate/blocker. Detecting an actual
        # cross-section contradiction inside a produced plan is semantic, not
        # structural (the same fact is reworded between header and gates), so it
        # stays an instruction rather than a plan validator; this test pins only
        # that the discipline and its closed vocabulary live in the skill.
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()

        contract = skill.split("## 3. agent execution contract", 1)[1].split("## 4. risk map", 1)[0]
        # Pin the three statuses as their exact bilingual paired forms so the
        # check has teeth: a bare "blocked"/"阻塞" would pass via the pre-existing
        # "blockers or gaps" prose and the `阻塞/缺口` label even if the new
        # provenance status were deleted, so only the paired enumeration binds.
        for marker in (
            "provenance",
            "`confirmed by source` / `已确认`",
            "`assumed until executor probe` / `待验证`",
            "`blocked` / `阻塞`",
        ):
            with self.subTest(section="agent-contract", marker=marker):
                self.assertIn(marker, contract)

        closure = skill.split("## 7. closure", 1)[1]
        for marker in (
            "consistent with the run facts",
            "confirmed by source",
            "assumed until executor probe",
        ):
            with self.subTest(section="closure", marker=marker):
                self.assertIn(marker, closure)

    def test_closure_supports_core_slice_triage(self) -> None:
        # PLANNER-CORE-SLICE: when the scenario set exceeds one executor run, the
        # plan triages scenarios into three named slices so the executor can run
        # the Core Slice without re-judging priority. Conditional section + n=1
        # evidence, so it is an instruction protected by a presence test, not a
        # required-section validator. Tokens are the full slice names (bare
        # "slice" would collide with the Minimal First Automation Slice bullet).
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()
        closure = skill.split("## 7. closure", 1)[1]
        for marker in (
            "scenario slices",
            "场景切片",
            "core slice",
            "extended slice",
            "hazardous/defer",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, closure)

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

    def test_reference_defines_migration_read_path_matrix(self) -> None:
        reference = PLANNER_REFERENCE.read_text(encoding="utf-8").lower()

        for marker in (
            "## migration read-path risk matrix",
            "迁移读路径风险矩阵",
            "changed table/column",
            "change kind",
            "reader",
            "old assumption",
            "new shape",
            "equivalence scenario",
            "expected decision",
            "predate this change",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, reference)

    def test_risk_map_requires_migration_read_path_branch(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()
        section = skill.split("## 4. risk map", 1)[1].split("## 5. test scenarios", 1)[0]

        for marker in (
            "migration read-path",
            "downstream reader",
            "do not filter on the new discriminator",
            "migration read-path risk matrix",
            "(reference.md#migration-read-path-risk-matrix)",
            "迁移读路径风险矩阵",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_generated_plan_output_contract_accepts_migration_read_path_matrix(self) -> None:
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8")

        assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_migration_matrix_unknown_scenario(self) -> None:
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8").replace(
            "`RANK-E2E-002` | must-change",
            "`RANK-E2E-999` | must-change",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_migration_matrix_row_without_scenario_or_blocker(self) -> None:
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8").replace(
            "| `RANK-E2E-002` | must-change: reader needs `playId` filter |",
            "| documented | equivalent |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_migration_matrix_blocker_compound_word(self) -> None:
        # Round-2 defect: a hyphenated compound ("non-blocker", "blocker-free") in the
        # decision cell must not satisfy the blocker requirement for a no-scenario row.
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8").replace(
            "| `ranking` rows | row copy: 1 set -> N per-play sets | `RankingMapper.selectBySeason` (filters `seasonId`, not `playId`) | one template set per season | N duplicated sets per season | `RANK-E2E-002` | must-change: reader needs `playId` filter |",
            "| `ranking` rows | row copy: 1 set -> N per-play sets | `RankingMapper.selectBySeason` | one template set per season | N duplicated sets per season | not covered | non-blocker finding |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_accepts_document_code_diff(self) -> None:
        text = (FIXTURES / "valid-doc-code-diff-plan.md").read_text(encoding="utf-8")

        assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_doc_code_diff_unknown_scenario(self) -> None:
        text = (FIXTURES / "valid-doc-code-diff-plan.md").read_text(encoding="utf-8").replace(
            "`DC-E2E-002`", "`DC-E2E-999`",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_doc_code_diff_high_risk_without_resolution(self) -> None:
        text = (FIXTURES / "valid-doc-code-diff-plan.md").read_text(encoding="utf-8").replace(
            "| P1 | `DC-E2E-002` |", "| P1 | noted |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_reference_defines_document_code_diff(self) -> None:
        reference = PLANNER_REFERENCE.read_text(encoding="utf-8").lower()

        for marker in (
            "## document-code semantic diff",
            "文档-代码语义差异",
            "contract",
            "code behavior",
            "delta",
            "risk",
            "resolution",
            "file:line",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, reference)

    def test_source_inventory_requires_document_code_diff(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()
        section = skill.split("## 1. source inventory", 1)[1].split("## 2. business flow", 1)[0]

        for marker in (
            "document-code semantic diff",
            "behavioral contract",
            "(reference.md#document-code-semantic-diff)",
            "文档-代码语义差异",
            "closed/blocked decision",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_source_inventory_ingests_emergent_scenarios(self) -> None:
        skill = (ROOT / "skills/e2e-test-planner/SKILL.md").read_text(encoding="utf-8").lower()
        section = skill.split("## 1. source inventory", 1)[1].split("## 2. business flow", 1)[0]

        for marker in (
            "prior executor run reports",
            "emergent scenarios",
            "risk map and coverage matrix",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, section)

    def test_generated_plan_output_contract_rejects_doc_code_diff_hedged_match(self) -> None:
        # Falsification F1: a hedged "match (mostly)" is a real divergence, not a verified
        # match, so a P1 row labeled that way must still resolve to a scenario or blocker.
        text = (FIXTURES / "valid-doc-code-diff-plan.md").read_text(encoding="utf-8").replace(
            "| documented default never applied | P1 | `DC-E2E-002` |",
            "| match (mostly) | P1 | noted |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_table_without_separator_row(self) -> None:
        # Falsification F2: a table whose `| --- |` separator is omitted must not pass with
        # its first data row silently consumed as the separator.
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8").replace(
            "| --- | --- | --- | --- | --- | --- | --- |\n", "", 1
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_merged_header_matrix(self) -> None:
        # Falsification F3: a single mega-header concatenating the required substrings must
        # not pass the column check as a degenerate one-column table.
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8").replace(
            "| Changed table/column | Change kind | Reader | Old assumption | New shape | Equivalence scenario | Expected decision |\n"
            "| --- | --- | --- | --- | --- | --- | --- |\n"
            "| `ranking` rows | row copy: 1 set -> N per-play sets | `RankingMapper.selectBySeason` (filters `seasonId`, not `playId`) | one template set per season | N duplicated sets per season | `RANK-E2E-002` | must-change: reader needs `playId` filter |\n"
            "| `summary.variantKey` column | backfill | `ReportExporter.dailyBySeason` (aggregates without the variant key) | one aggregate per season | aggregate splits per variant | `blocker` | blocker: report owner must confirm intended shape |",
            "| changed reader old new scenario decision merged |\n| --- |\n| `RANK-E2E-002` |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_migration_matrix_incidental_block_substring(self) -> None:
        # Falsification defect 3: an incidental "non-blocking" / "gap" substring outside the
        # scenario/decision cells must not launder a row that has no scenario id.
        text = (FIXTURES / "valid-migration-plan.md").read_text(encoding="utf-8").replace(
            "| `ranking` rows | row copy: 1 set -> N per-play sets | `RankingMapper.selectBySeason` (filters `seasonId`, not `playId`) | one template set per season | N duplicated sets per season | `RANK-E2E-002` | must-change: reader needs `playId` filter |",
            "| `ranking` rows | row copy (non-blocking read path) | `RankingMapper.selectBySeason` | one template set per season | N duplicated sets per season | no coverage yet | equivalent |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_missing_closure(self) -> None:
        text = (FIXTURES / "missing-closure-plan.md").read_text(encoding="utf-8")

        with self.assertRaises(ValueError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_missing_execution_dag(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        before_dag, after_dag = text.split("\n## 6. Execution DAG", 1)
        _, after_coverage = after_dag.split("\n## 7. Coverage Matrix", 1)
        without_dag = before_dag + "\n## 6. Coverage Matrix" + after_coverage

        with self.assertRaises(ValueError):
            assert_valid_generated_plan(self, without_dag)

    def test_generated_plan_output_contract_rejects_thin_execution_dag(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        before_dag, after_dag = text.split("\n## 6. Execution DAG", 1)
        _, after_coverage = after_dag.split("\n## 7. Coverage Matrix", 1)
        thin_dag = (
            before_dag
            + "\n## 6. Execution DAG\n\n"
            + "| Node | Scenario | Depends on | Consumes | Produces | Required capabilities | Side-effect scope | Isolation key | Parallel safety | Cleanup dependency | Disruptive marker |\n"
            + "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n"
            + "| N1 | CHECKOUT-E2E-001 | none | none | none | none | none | none | ok | none | none |\n"
            + "\n## 7. Coverage Matrix"
            + after_coverage
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, thin_dag)

    def test_generated_plan_output_contract_rejects_dag_unknown_scenario(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| N1 | CHECKOUT-E2E-001 |",
            "| N1 | CHECKOUT-E2E-999 |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_malformed_dag_row(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` | none |",
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` | none |\n"
            "| N2 | CHECKOUT-E2E-999 | J1 | `ghostToken` | `ghostId` | API | order table | `ghostId` | unsafe: bad | reason | cleanup by `ghostId` | none |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_dag_unsourced_consumed_variable(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU |",
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `ghostToken`, stocked SKU |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_unquoted_unsourced_consumed_variable(self) -> None:
        cases = (
            (FIXTURES / "valid-generated-plan.md")
            .read_text(encoding="utf-8")
            .replace(
                "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU |",
                "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | ghostToken, stocked SKU |",
            ),
            (FIXTURES / "valid-generated-plan.md")
            .read_text(encoding="utf-8")
            .replace(
                "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU |",
                "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | ghost_token, stocked SKU |",
            ),
            (FIXTURES / "valid-generated-plan.md")
            .read_text(encoding="utf-8")
            .replace(
                "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU |",
                "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | GHOST_TOKEN, stocked SKU |",
            ),
        )

        for text in cases:
            with self.subTest():
                with self.assertRaises(AssertionError):
                    assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_depends_on_unsourced_variable(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready |",
            "| N1 | CHECKOUT-E2E-001 | J1-J4, ghostToken ready |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_future_producer_not_in_depends(self) -> None:
        base = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        original_row = "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` | none |"
        mutated_row = "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `futureToken`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` | none |"
        future_row = "| N2 | CHECKOUT-E2E-001 | N1 | `orderId` | `futureToken` | API, DB, job, stub | order table | `futureToken` prefix | unsafe: depends on N1 output | cleanup by `futureToken` | none |"
        text = base.replace(original_row, mutated_row + "\n" + future_row)

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_same_node_consumes_own_output(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` |",
            "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `sameNodeToken`, stocked SKU | `sameNodeToken`, `cartId`, `orderId`, `paymentEventId`, `invoiceId` |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_cleanup_from_later_unrelated_node(self) -> None:
        base = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        original_row = "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` | none |"
        mutated_row = "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | cleanup by `futureCleanupId` | none |"
        future_row = "| N2 | CHECKOUT-E2E-001 | N1 | `orderId` | `futureCleanupId` | API, DB, job, stub | order table | `futureCleanupId` prefix | unsafe: depends on N1 output | cleanup by `futureCleanupId` | none |"
        text = base.replace(original_row, mutated_row + "\n" + future_row)

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_cyclic_execution_dag(self) -> None:
        base = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        original_row = "| N1 | CHECKOUT-E2E-001 | J1-J4, provider stub ready | `userId`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` | none |"
        n1 = "| N1 | CHECKOUT-E2E-001 | N2, J1-J4 | `futureToken`, stocked SKU | `cartId`, `orderId`, `paymentEventId`, `invoiceId` | API, DB, job, stub | order, stock, callback ledger, invoice tables | `orderId` batch prefix | unsafe: waits on N2 output | after invoice probe, cleanup by `orderId` | none |"
        n2 = "| N2 | CHECKOUT-E2E-001 | N1 | `orderId` | `futureToken` | API, DB, job, stub | order table | `futureToken` prefix | unsafe: waits on N1 output | cleanup by `futureToken` | none |"
        text = base.replace(original_row, n1 + "\n" + n2)

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_parallel_safety_without_reason(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` |",
            "| `orderId` batch prefix | unsafe: | after invoice probe, cleanup by `orderId` |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_dag_row_without_cleanup_dependency(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8").replace(
            "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` |",
            "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe |",
        )

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_cleanup_without_supported_variable(self) -> None:
        cases = (
            (FIXTURES / "valid-generated-plan.md")
            .read_text(encoding="utf-8")
            .replace(
                "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` |",
                "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | cleanup later |",
            ),
            (FIXTURES / "valid-generated-plan.md")
            .read_text(encoding="utf-8")
            .replace(
                "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `orderId` |",
                "| `orderId` batch prefix | unsafe: main chain consumes produced IDs in order | after invoice probe, cleanup by `ghostCleanupId` |",
            ),
        )

        for text in cases:
            with self.subTest():
                with self.assertRaises(AssertionError):
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
        without_minimal_slice = text.split("\n## 11. Minimal First Automation Slice", 1)[0].rstrip()

        assert_valid_generated_plan(self, without_minimal_slice)

    def test_generated_plan_output_contract_accepts_without_optional_execution_order(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        before, rest = text.split("\n## 9. Execution Order", 1)
        _, after_gates = rest.split("\n## 10. Agent-ready Gates", 1)
        without_execution_order = before + "\n## 10. Agent-ready Gates" + after_gates

        assert_valid_generated_plan(self, without_execution_order)

    def test_generated_plan_output_contract_accepts_delegated_executor_handoff_index(self) -> None:
        # A delegated plan adds the handoff index after the DAG. Its own table must
        # not bleed into DAG parsing, and the plan must still satisfy the full contract.
        text = delegated_plan(WELLFORMED_EXECUTOR_HANDOFF)

        assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_thin_executor_handoff_index(self) -> None:
        # When the handoff index is present it must carry the executor's locator
        # fields; a stub with only an Artifact ID is not an executable handoff.
        thin_handoff = "## Executor Handoff Index\n\n- Artifact ID: checkout-e2e-plan 2026-06-21.\n"
        text = delegated_plan(thin_handoff)

        with self.assertRaises(AssertionError):
            assert_valid_generated_plan(self, text)

    def test_generated_plan_output_contract_rejects_thin_agent_ready_gates(self) -> None:
        text = (FIXTURES / "valid-generated-plan.md").read_text(encoding="utf-8")
        before_gates, after_gates = text.split("## 10. Agent-ready Gates", 1)
        _, after_minimal = after_gates.split("## 11. Minimal First Automation Slice", 1)
        thin_gates = (
            before_gates
            + "## 10. Agent-ready Gates\n\n"
            + "- Entry: ok.\n"
            + "- Exit: done.\n"
            + "- Suspend: stop.\n\n"
            + "## 11. Minimal First Automation Slice"
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
            original.replace("| 节点 | 场景 | 依赖 | 消费 | 产出 | 所需能力 | 副作用范围 | 隔离键 | 并行安全 | 清理依赖 | 扰动标记 |", "| 节点 | 场景 | 前置 | 输入 | 输出 | 能力 | 影响 | 隔离 | 并发 | 清理 | 扰动 |"),
            original.replace("## 7. 覆盖矩阵", "### 覆盖矩阵"),
            original.replace("## 10. Agent 就绪门禁", "## 10. 门禁"),
        )

        for text in cases:
            with self.subTest():
                with self.assertRaises((AssertionError, ValueError)):
                    assert_valid_generated_plan(self, text)


if __name__ == "__main__":
    unittest.main()
