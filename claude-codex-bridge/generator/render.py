#!/usr/bin/env python3
"""Render the bridge's runtime command/prompt files from templates + fragments.

Usage:
  python render.py          # rewrite generated files in place
  python render.py --check  # exit 1 if any generated file is stale

Edit generator/templates/ and generator/fragments/, never the generated files.

Directive syntax inside templates:
  {{include:fragment-name}}              inline or whole-line include
  {{include:fragment-name key=value}}    substitute {key} inside the fragment

A directive alone on a line is a block include: every non-empty fragment line
inherits the directive line's leading whitespace. A directive embedded in a
line is an inline include and the fragment must be a single line.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

GENERATOR = Path(__file__).resolve().parent
TEMPLATES = GENERATOR / "templates"
FRAGMENTS = GENERATOR / "fragments"
BRIDGE = GENERATOR.parent

DIRECTIVE = re.compile(r"\{\{include:([A-Za-z0-9._-]+)((?:\s+[a-z_]+=[^\s}]+)*)\}\}")
UNFILLED = re.compile(r"\{[a-z][a-z_]*\}")


def fragment_text(name: str, raw_params: str) -> str:
    path = FRAGMENTS / f"{name}.md"
    if not path.exists():
        raise SystemExit(f"unknown fragment: {name}")
    text = path.read_text(encoding="utf-8").rstrip("\n")
    for token in raw_params.split():
        key, value = token.split("=", 1)
        placeholder = "{" + key + "}"
        if placeholder not in text:
            raise SystemExit(f"fragment {name}: unknown parameter {key}")
        text = text.replace(placeholder, value)
    leftover = UNFILLED.search(text)
    if leftover:
        raise SystemExit(f"fragment {name}: unfilled parameter {leftover.group(0)}")
    return text


def render_inline(match: re.Match[str]) -> str:
    body = fragment_text(match.group(1), match.group(2))
    if "\n" in body:
        raise SystemExit(f"fragment {match.group(1)} is multi-line; use a block include")
    return body


def render_template(text: str) -> str:
    out_lines: list[str] = []
    for line in text.splitlines():
        block = DIRECTIVE.fullmatch(line.strip())
        if block:
            indent = line[: len(line) - len(line.lstrip())]
            body = fragment_text(block.group(1), block.group(2))
            out_lines.extend(indent + part if part else "" for part in body.splitlines())
        else:
            out_lines.append(DIRECTIVE.sub(render_inline, line))
    return "\n".join(out_lines) + "\n"


def main() -> int:
    check = "--check" in sys.argv[1:]
    stale: list[str] = []
    for template in sorted(TEMPLATES.rglob("*.md")):
        rel = template.relative_to(TEMPLATES)
        target = BRIDGE / rel
        rendered = render_template(template.read_text(encoding="utf-8"))
        current = target.read_text(encoding="utf-8") if target.exists() else None
        if rendered == current:
            continue
        if check:
            stale.append(str(rel))
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(rendered, encoding="utf-8")
            print(f"rendered: {rel}")
    if check:
        if stale:
            print("stale generated files (run: python claude-codex-bridge/generator/render.py):")
            for rel in stale:
                print(f"  {rel}")
            return 1
        print("generated files up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
