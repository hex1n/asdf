#!/usr/bin/env node

// Validate cross-file Markdown anchors inside every source skill.
//
// A skill split across SKILL.md + companion files routes the agent by pointer:
// `Open [X](REFERENCE.md#x)`. A pointer whose anchor no longer resolves reads as
// a live rule but silently reaches nothing, and nothing in this repo caught it —
// the 2026-08-30 e2e review found two such defects by hand, one of them a
// planner field the paired executor still gated on. Anchors are checkable
// mechanically; this script is that check.
//
// Scope is deliberately narrow: relative links between .md files inside one
// skill directory. External URLs, absolute paths, and links that leave the
// skill are another skill's business and are reported as skipped, not failed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = path.join(ROOT, "skills");

// GitHub-flavoured heading -> anchor: lowercase, drop everything that is not a
// word character, space or hyphen, then spaces to hyphens. `&` in a heading
// therefore collapses to a double hyphen, which is why "Gap & Defect
// Disposition" resolves as `gap--defect-disposition`.
export function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    // Each space becomes its own hyphen — runs are NOT collapsed. "Gap &
    // Defect Disposition" drops the "&" and leaves two spaces, so the real
    // anchor is `gap--defect-disposition`; a collapsing `\s+` here reports
    // every such live link as broken.
    .replace(/\s/g, "-");
}

export function headingAnchors(markdown) {
  const anchors = new Set();
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*\S)\s*$/.exec(line);
    if (m) anchors.add(slug(m[2]));
  }
  return anchors;
}

// Only inline links: [text](target). Reference-style links and bare URLs are
// out of scope, as is anything inside a fenced block — a fenced example of a
// broken link is documentation, not a defect.
export function extractLinks(markdown) {
  const links = [];
  let inFence = false;
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      links.push({ target: m[1], line: i + 1 });
    }
  }
  return links;
}

function checkSkill(dir, name) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();

  const anchorsByFile = new Map();
  const textByFile = new Map();
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    textByFile.set(f, text);
    anchorsByFile.set(f, headingAnchors(text));
  }

  const failures = [];
  let checked = 0;
  let skipped = 0;

  for (const f of files) {
    for (const { target, line } of extractLinks(textByFile.get(f))) {
      // A template file's placeholder link (`#{name}`) is filled in by the
      // agent at authoring time; it has no anchor to resolve here.
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/") || /[{}]/.test(target)) {
        skipped++;
        continue;
      }
      const hashAt = target.indexOf("#");
      const filePart = hashAt === -1 ? target : target.slice(0, hashAt);
      const anchor = hashAt === -1 ? "" : target.slice(hashAt + 1);
      const resolved = filePart === "" ? f : filePart;

      // A link that leaves the skill directory is out of scope.
      if (resolved.includes("/") || resolved.includes("..")) {
        skipped++;
        continue;
      }
      checked++;

      if (!anchorsByFile.has(resolved)) {
        failures.push(`${name}/${f}:${line} -> ${target} (no such file in skill)`);
        continue;
      }
      if (anchor && !anchorsByFile.get(resolved).has(anchor)) {
        failures.push(`${name}/${f}:${line} -> ${target} (no heading yields #${anchor})`);
      }
    }
  }
  return { failures, checked, skipped, files: files.length };
}

function main() {
  if (!fs.existsSync(SKILLS)) {
    process.stdout.write("no skills/ directory\n");
    process.exit(0);
  }
  const skills = fs.readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  let totalChecked = 0;
  let totalSkipped = 0;
  const allFailures = [];
  for (const name of skills) {
    const r = checkSkill(path.join(SKILLS, name), name);
    totalChecked += r.checked;
    totalSkipped += r.skipped;
    allFailures.push(...r.failures);
  }

  for (const f of allFailures) process.stdout.write(`BROKEN: ${f}\n`);
  process.stdout.write(
    `${allFailures.length === 0 ? "PASS" : "FAIL"}: ${totalChecked} in-skill anchors across ${skills.length} skills` +
    ` (${allFailures.length} broken, ${totalSkipped} out-of-scope links skipped)\n`,
  );
  process.exit(allFailures.length === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
