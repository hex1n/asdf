#!/usr/bin/env python3
"""Install the asdf agent OS onto this machine (idempotent, stdlib-only).

Distributes: skills, slash command templates, Execution Contract
blocks, agent-doctor, and the agent workflow hook.

Usage:
    python bootstrap/install.py [--dry-run]

Safe to re-run: unchanged targets are reported as `ok`, linked installs
(source and target are the same file) as `same`, and the contract block is
replaced in place between its markers instead of being appended twice.
Config wiring (settings.json / config.toml hook registration, PATH for
~/bin) is intentionally NOT automated by the installer; the summary prints
what to check.
"""
from __future__ import annotations

import argparse
import ast
import filecmp
import json
import os
import shutil
from pathlib import Path

# env overrides exist for the test suite (tests/test_bootstrap_install.py)
REPO = Path(os.environ.get("ASDF_INSTALL_REPO") or Path(__file__).resolve().parent.parent)
HOME = Path(os.environ.get("ASDF_INSTALL_HOME") or Path.home())

BEGIN = "<!-- BEGIN EXECUTION CONTRACT (managed by asdf bootstrap/install.py) -->"
END = "<!-- END EXECUTION CONTRACT -->"

ACTIONS: list[tuple[str, str]] = []


def plan(kind: str, detail: str) -> None:
    ACTIONS.append((kind, detail))


def copy_file(src: Path, dst: Path, dry: bool) -> None:
    if dst.exists():
        try:
            if os.path.samefile(src, dst):
                plan("same", f"{dst}")
                return
        except OSError:
            pass
        if filecmp.cmp(src, dst, shallow=False):
            plan("ok", f"{dst}")
            return
        plan("update", f"{dst}")
    else:
        plan("new", f"{dst}")
    if not dry:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def copy_tree(src: Path, dst: Path, dry: bool) -> None:
    for f in sorted(src.rglob("*")):
        if f.is_file():
            copy_file(f, dst / f.relative_to(src), dry)


def read_frontmatter(src: Path) -> tuple[dict[str, str], str]:
    """Parse the simple YAML front matter used by command templates."""
    text = src.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return {}, text
    end = next((i for i, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
    if end is None:
        return {}, text
    meta_text = "".join(lines[1:end])
    body = "".join(lines[end + 1:])
    meta: dict[str, str] = {}
    for line in meta_text.splitlines():
        if not line.strip() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        raw = value.strip()
        try:
            parsed = ast.literal_eval(raw)
        except (SyntaxError, ValueError):
            parsed = raw
        meta[key.strip()] = str(parsed)
    return meta, body.lstrip()


def codex_command_skill(src: Path) -> str:
    meta, body = read_frontmatter(src)
    name = src.stem
    description = meta.get("description", f"{name} workflow command")
    return (
        "---\n"
        f"name: {name}\n"
        f"description: {json.dumps(description, ensure_ascii=False)}\n"
        "---\n\n"
        f"# {name}\n\n"
        "Follow this command contract. Treat the user's current prompt after the "
        "skill name as the command input.\n\n"
        f"{body}"
    )


def write_text_if_changed(dst: Path, text: str, dry: bool) -> None:
    if dst.exists():
        try:
            existing = dst.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            existing = ""
        if existing == text:
            plan("ok", f"{dst}")
            return
        plan("update", f"{dst}")
    else:
        plan("new", f"{dst}")
    if not dry:
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(text, encoding="utf-8")


def contract_problem(target: Path) -> str | None:
    """Describe a malformed marker state, or None for the two well-formed
    states (no block / exactly one ordered block). A truncated, duplicated,
    or reversed block would otherwise be silently swallowed on a later run."""
    if not target.exists():
        return None
    text = target.read_text(encoding="utf-8")
    n_begin, n_end = text.count(BEGIN), text.count(END)
    if (n_begin, n_end) not in ((0, 0), (1, 1)) or (
            n_begin == 1 and text.index(BEGIN) > text.index(END)):
        return (f"{target}: malformed contract markers ({n_begin} BEGIN / {n_end} END"
                f"{', reversed order' if (n_begin, n_end) == (1, 1) else ''}); "
                "reconcile the markers by hand, then re-run")
    return None


def merge_contract(block_file: Path, target: Path, dry: bool) -> None:
    block = block_file.read_text(encoding="utf-8").strip()
    wrapped = f"{BEGIN}\n{block}\n{END}"
    backup = False
    if target.exists():
        problem = contract_problem(target)
        if problem:
            plan("error", problem)
            return
        text = target.read_text(encoding="utf-8")
        if BEGIN in text:
            pre, rest = text.split(BEGIN, 1)
            _, post = rest.split(END, 1)
            new = f"{pre}{wrapped}{post}"
            if new == text:
                plan("ok", f"{target} (contract block)")
                return
            plan("update", f"{target} (contract block)")
        else:
            new = text.rstrip() + "\n\n" + wrapped + "\n"
            plan("append", f"{target} (contract block)")
        backup = True
    else:
        new = wrapped + "\n"
        plan("new", f"{target}")
    if not dry:
        target.parent.mkdir(parents=True, exist_ok=True)
        if backup:
            target.with_name(target.name + ".bak").write_text(text, encoding="utf-8")
        target.write_text(new, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="report without writing")
    dry = ap.parse_args().dry_run

    # 0. pre-flight: a malformed contract target aborts the whole install
    # before anything is written, so a non-zero exit implies zero side effects
    problems = [p for p in (
        contract_problem(HOME / ".claude" / "CLAUDE.md"),
        contract_problem(HOME / ".codex" / "AGENTS.md"),
    ) if p]
    if problems:
        print(f"asdf agent OS install aborted (nothing written) from {REPO}\n")
        for p in problems:
            print(f"  error   {p}")
        raise SystemExit(1)

    # 1. skills -> both runtimes
    for skill in sorted((REPO / "skills").iterdir()):
        if not skill.is_dir():
            continue
        for rt in (HOME / ".claude" / "skills", HOME / ".codex" / "skills"):
            copy_tree(skill, rt / skill.name, dry)

    # 2. command templates -> claude commands/ and Codex skills
    # (skills appear in Codex slash selectors).
    for cmd in sorted((REPO / "bootstrap" / "commands").glob("*.md")):
        copy_file(cmd, HOME / ".claude" / "commands" / cmd.name, dry)
        write_text_if_changed(
            HOME / ".agents" / "skills" / cmd.stem / "SKILL.md",
            codex_command_skill(cmd),
            dry,
        )

    # 3. Execution Contract blocks
    merge_contract(REPO / "bootstrap" / "contract" / "claude.md", HOME / ".claude" / "CLAUDE.md", dry)
    merge_contract(REPO / "bootstrap" / "contract" / "codex.md", HOME / ".codex" / "AGENTS.md", dry)

    # 4. local helper scripts
    copy_file(REPO / "bootstrap" / "bin" / "agent-doctor.py", HOME / "bin" / "agent-doctor.py", dry)
    copy_file(
        REPO / "bootstrap" / "bin" / "agent-workflow-hook.py",
        HOME / "bin" / "agent-workflow-hook.py",
        dry,
    )

    # summary
    order = ("new", "update", "append", "ok", "same", "error")
    counts = {k: 0 for k in order}
    print(f"asdf agent OS install {'(dry run) ' if dry else ''}from {REPO}\n")
    for kind in order:
        rows = [d for k, d in ACTIONS if k == kind]
        counts[kind] = len(rows)
        if kind in ("new", "update", "append", "error"):
            for d in rows:
                print(f"  {kind:7} {d}")
    print(
        "\nsummary: "
        + ", ".join(f"{counts[k]} {k}" for k in order)
        + f"  (ok=unchanged, same=linked install)"
    )

    # install mode per skill: link = source-linked (edits to source take effect
    # immediately); copy = physical copy (re-run install.py after source changes)
    modes = []
    for skill in sorted((REPO / "skills").iterdir()):
        if not skill.is_dir():
            continue
        probe = skill / "SKILL.md"
        row = []
        for tag, rt in (("claude", HOME / ".claude" / "skills"), ("codex", HOME / ".codex" / "skills")):
            target = rt / skill.name / "SKILL.md"
            if not target.exists():
                row.append(f"{tag}=missing")
                continue
            try:
                linked = os.path.samefile(probe, target)
            except OSError:
                linked = False
            row.append(f"{tag}={'link' if linked else 'copy'}")
        modes.append(f"  {skill.name:26} {'  '.join(row)}")
    if modes:
        print("\ninstall mode per skill (link=source-linked; copy=re-run installer after source edits):")
        print("\n".join(modes))

    print(
        "\nmanual wiring to verify on a new machine (not automated):\n"
        "  - PATH contains ~/bin (for agent-doctor.py and agent-workflow-hook.py)\n"
        "  - PreToolUse/Stop hooks call: python ~/bin/agent-workflow-hook.py  (macOS/Linux: python3)\n"
        "  - run: python ~/bin/agent-doctor.py  (macOS/Linux: python3) - verifies versions, contract presence, hooks, skill drift"
    )

    if counts["error"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
