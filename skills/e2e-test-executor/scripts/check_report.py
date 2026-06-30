#!/usr/bin/env python3
"""Protocol self-check for an e2e-test-executor `execution-report.md`.

SCOPE -- READ THIS FIRST. This checks the report's PROTOCOL self-consistency: the
machine-checkable structural contract in REFERENCE.md section "execution-report.md
structural contract". It does NOT check whether the report is TRUTHFUL. A
structurally clean report can still be a lie -- a fabricated `passed` with a
well-formed evidence link passes every rule here. Report faithfulness (did the
run really happen, does the evidence really prove the verdict, is the diagnosis
right) has no structural oracle; it needs re-execution or human evidence review.
Treat a clean result as "the handoff is well-formed", never "the run was good".

Advisory by default (exit 0, prints findings). Use --strict to gate (exit 1 on
any violation). stdlib-only, portable.

Rule provenance: this mirrors the repo contract function
`assert_valid_execution_report` (tests/test_e2e_test_executor_contract.py), which
stays the repo-level meta check over fixtures; this module is the runtime,
agent-facing entry an executor can run right after writing its report. A
consistency test (skills/e2e-test-executor/tests/test_check_report.py) pins the
two on their overlapping rules so they cannot drift. Two rules here are not yet
in that contract function -- diagnosis-is-a-token and Next-Actions-only-OPEN -- and
get their CI coverage through this script's own tests. The semantic
"reachable is not freshness evidence" is deliberately NOT enforced here: like the
contract, it is left to the SKILL instruction to avoid false positives on a real
but weak value.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Optional

REQUIRED_SECTIONS = [
    "Execution Summary", "Run Metadata", "Environment & Capability Map",
    "DAG Schedule", "Scenario Results", "Evidence Index",
    "Failures / Defects / Plan Gaps", "Data Created & Cleanup",
    "Re-run Instructions", "Next Actions for Agent",
]
LEGAL_STATUS = {"passed", "failed", "blocked", "skipped"}
LEGAL_DIAGNOSIS = {"product", "plan", "environment", "tooling", "unknown"}
# A passed/skipped row legitimately carries no diagnosis; accept dash placeholders.
DIAGNOSIS_BLANKS = {"", "-", "--", chr(0x2014), chr(0x2013)}  # -, em dash (U+2014), en dash (U+2013)
FORBIDDEN_IN_NEXT_ACTIONS = {"CONDITIONAL", "BLOCKED-BY-TOOLING", "OUT-OF-SCOPE"}


def _headings(text: str):
    """Ordered (title, start_index) for every level-2 (## ) heading only."""
    out = []
    for m in re.finditer(r"(?m)^##[ \t]+(.+?)[ \t]*$", text):
        out.append((m.group(1).strip(), m.start()))
    return out


def _section_body(text: str, headings, idx: int) -> str:
    start = headings[idx][1]
    body_start = text.index("\n", start) + 1 if "\n" in text[start:] else len(text)
    end = headings[idx + 1][1] if idx + 1 < len(headings) else len(text)
    return text[body_start:end]


def _parse_table(body: str) -> List[List[str]]:
    rows = []
    for line in body.splitlines():
        if "|" not in line:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells and set("".join(cells)) <= set("-: "):
            continue  # separator row
        rows.append(cells)
    return rows


def _violation(rule: str, severity: str, detail: str) -> dict:
    return {"rule": rule, "severity": severity, "detail": detail}


def check_report(text: str) -> List[dict]:
    """Return a list of protocol violations; empty means the report is well-formed
    (NOT that it is truthful -- see module docstring)."""
    v: List[dict] = []
    headings = _headings(text)
    titles = [t for t, _ in headings]
    pos = {t: s for t, s in headings}

    # R1: required sections present.
    for req in REQUIRED_SECTIONS:
        if req not in pos:
            v.append(_violation("R1-section", "blocker", f"missing required section: {req}"))

    # R2: Execution Summary is the earliest of the required sections.
    present = [pos[r] for r in REQUIRED_SECTIONS if r in pos]
    if "Execution Summary" in pos and present and pos["Execution Summary"] != min(present):
        v.append(_violation("R2-summary-first", "blocker",
                             "Execution Summary must precede every other required section"))

    # Scenario Results table rules.
    if "Scenario Results" in pos:
        idx = titles.index("Scenario Results")
        rows = _parse_table(_section_body(text, headings, idx))
        if not rows:
            v.append(_violation("R3-status", "blocker", "Scenario Results has no table"))
        else:
            header = [h.lower() for h in rows[0]]

            def col(name):
                return header.index(name) if name in header else None

            si, di, pi = col("status"), col("diagnosis"), col("preserved scene")
            saw_status = False
            for r in rows[1:]:
                status = r[si].strip("`").strip().lower() if si is not None and si < len(r) else ""
                if status:
                    saw_status = True
                    if status not in LEGAL_STATUS:
                        v.append(_violation("R3-status", "blocker",
                                             f"illegal scenario status '{status}' (use passed/failed/blocked/skipped)"))
                # R4 (soul clause): a failed row must reference a kept scene on its row.
                if status == "failed":
                    scene = r[pi] if pi is not None and pi < len(r) else ""
                    if "preserved-scenes/" not in scene:
                        v.append(_violation("R4-preserved-scene", "blocker",
                                             f"failed scenario '{r[0]}' has no preserved-scenes/ reference on its row"))
                # NEW G1: diagnosis must be a closed-set token, never prose.
                if di is not None and di < len(r):
                    diag = r[di].strip("`").strip()
                    if diag.lower() not in DIAGNOSIS_BLANKS and diag.lower() not in LEGAL_DIAGNOSIS:
                        kind = "prose, not a token" if " " in diag else "not in closed set"
                        v.append(_violation("G1-diagnosis-token", "major",
                                             f"diagnosis '{diag[:40]}' is {kind} (use product/plan/environment/tooling/unknown)"))
            if rows[1:] and not saw_status:
                v.append(_violation("R3-status", "blocker",
                                     "no scenario row records a passed/failed/blocked/skipped status"))

    # R5: evidence/index.md must be referenced somewhere.
    if "evidence/index.md" not in text:
        v.append(_violation("R5-evidence-index", "blocker", "report does not reference evidence/index.md"))

    # R6: Re-run Instructions must carry an executable command, not only prose.
    if "Re-run Instructions" in pos:
        idx = titles.index("Re-run Instructions")
        body = _section_body(text, headings, idx)
        if "```" not in body and not re.search(r"`[^`]{6,}`", body):
            v.append(_violation("R6-rerun-command", "blocker",
                                 "Re-run Instructions has no executable command (code block or inline command)"))

    # NEW G2: Next Actions for Agent must list only OPEN items.
    if "Next Actions for Agent" in pos:
        idx = titles.index("Next Actions for Agent")
        body = _section_body(text, headings, idx)
        for tok in FORBIDDEN_IN_NEXT_ACTIONS:
            if tok in body:
                v.append(_violation("G2-next-actions-open", "major",
                                     f"Next Actions contains a {tok} item (only OPEN items belong here)"))

    return v


SCOPE_BANNER = (
    "scope: protocol self-consistency only -- a clean report can still be untruthful "
    "(fabricated pass / faked evidence are invisible here); confirm faithfulness by "
    "re-execution or evidence review."
)


def render_text(violations: List[dict], path: str) -> str:
    lines = [f"# execution-report protocol check -- {path}", "", SCOPE_BANNER, ""]
    if not violations:
        lines.append("OK: no protocol violations (well-formed; not a truthfulness claim).")
        return "\n".join(lines)
    order = {"blocker": 0, "major": 1, "minor": 2}
    violations = sorted(violations, key=lambda x: order.get(x["severity"], 9))
    lines.append(f"{len(violations)} violation(s):")
    for x in violations:
        lines.append(f"- {x['severity']} | {x['rule']} | {x['detail']}")
    return "\n".join(lines)


def _resolve_path(arg: str) -> Optional[Path]:
    p = Path(arg)
    if p.is_dir():
        cand = p / "execution-report.md"
        return cand if cand.exists() else None
    return p if p.exists() else None


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Protocol self-check for an e2e execution-report.md")
    parser.add_argument("path", help="execution-report.md file, or a run directory containing one")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any violation is found")
    args = parser.parse_args(argv)

    resolved = _resolve_path(args.path)
    if resolved is None:
        print(f"error: no execution-report.md at {args.path}", file=sys.stderr)
        return 2

    text = resolved.read_text(encoding="utf-8", errors="replace")
    violations = check_report(text)

    if args.format == "json":
        print(json.dumps({"path": str(resolved), "scope": SCOPE_BANNER, "violations": violations},
                         indent=2, ensure_ascii=False))
    else:
        print(render_text(violations, str(resolved)))

    return 1 if (violations and args.strict) else 0


if __name__ == "__main__":
    raise SystemExit(main())
