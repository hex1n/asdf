#!/usr/bin/env python3
"""Install the asdf agent OS onto this machine (idempotent, stdlib-only).

Distributes: skills, slash/prompt command templates, Execution Contract
blocks, and the agent-doctor script.

Usage:
    python bootstrap/install.py [--dry-run]

Safe to re-run: unchanged targets are reported as `ok`, linked installs
(source and target are the same file) as `same`, and the contract block is
replaced in place between its markers instead of being appended twice.
Config wiring (settings.json / config.toml hook registration, PATH for
~/bin) is intentionally NOT automated; the summary prints what to check.
"""
from __future__ import annotations

import argparse
import filecmp
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


def merge_contract(block_file: Path, target: Path, dry: bool) -> None:
    block = block_file.read_text(encoding="utf-8").strip()
    wrapped = f"{BEGIN}\n{block}\n{END}"
    if target.exists():
        text = target.read_text(encoding="utf-8")
        if BEGIN in text and END in text:
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
    else:
        new = wrapped + "\n"
        plan("new", f"{target}")
    if not dry:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(new, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="report without writing")
    dry = ap.parse_args().dry_run

    # 1. skills -> both runtimes
    for skill in sorted((REPO / "skills").iterdir()):
        if not skill.is_dir():
            continue
        for rt in (HOME / ".claude" / "skills", HOME / ".codex" / "skills"):
            copy_tree(skill, rt / skill.name, dry)

    # 2. command templates -> claude commands/ and codex prompts/
    for cmd in sorted((REPO / "bootstrap" / "commands").glob("*.md")):
        copy_file(cmd, HOME / ".claude" / "commands" / cmd.name, dry)
        copy_file(cmd, HOME / ".codex" / "prompts" / cmd.name, dry)

    # 3. Execution Contract blocks
    merge_contract(REPO / "bootstrap" / "contract" / "claude.md", HOME / ".claude" / "CLAUDE.md", dry)
    merge_contract(REPO / "bootstrap" / "contract" / "codex.md", HOME / ".codex" / "AGENTS.md", dry)

    # 4. doctor script
    copy_file(REPO / "bootstrap" / "bin" / "agent-doctor.ps1", HOME / "bin" / "agent-doctor.ps1", dry)

    # summary
    order = ("new", "update", "append", "ok", "same")
    counts = {k: 0 for k in order}
    print(f"asdf agent OS install {'(dry run) ' if dry else ''}from {REPO}\n")
    for kind in order:
        rows = [d for k, d in ACTIONS if k == kind]
        counts[kind] = len(rows)
        if kind in ("new", "update", "append"):
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
        "  - PATH contains ~/bin (for agent-doctor.ps1)\n"
        "  - run: pwsh ~/bin/agent-doctor.ps1  (verifies versions, contract presence, skill drift)"
    )


if __name__ == "__main__":
    main()
