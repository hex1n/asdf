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
// Scope is deliberately narrow: relative links written in .md files inside one
// skill directory, subdirectories included (`references/`, `plan/`, `run/`),
// each resolved from the linking file's own directory. A Markdown target must
// exist and yield the anchor; any other file must exist; a directory must exist
// and carries no anchor; a trailing slash demands a directory. Dot segments in
// a target are folded first, as a browser does when it follows the link, and
// the remaining components are then checked one by one against the real
// filesystem, so a path that only works through a symlink still counts and a
// dangling or looping symlink is reported. Name matching is exact-case on
// purpose: a link that only works because Windows ignores case breaks on a
// case-sensitive checkout. External URLs, absolute paths, and links that leave
// the skill are another skill's business and are reported as skipped, not
// failed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = path.join(ROOT, "skills");
const MARKDOWN = /\.md$/i;

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

// The Markdown files whose links are checked, as skill-relative posix paths
// ("run/RUN.md"). Symlinked directories are followed; only a symlink back into
// its own ancestor chain is cut, which is what stops a cycle. An entry whose
// symlink cannot be resolved is not a source and is left out.
export function listMarkdownFiles(dir) {
  const files = [];
  const ancestors = new Set();
  const walk = (rel) => {
    const abs = path.join(dir, rel);
    let real;
    try { real = fs.realpathSync(abs); } catch { return; }
    if (ancestors.has(real)) return;
    ancestors.add(real);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel === "." ? e.name : `${rel}/${e.name}`;
      let target = e;
      if (e.isSymbolicLink()) {
        try { target = fs.statSync(path.join(abs, e.name)); } catch { continue; }
      }
      if (target.isDirectory()) walk(childRel);
      else if (target.isFile() && MARKDOWN.test(e.name)) files.push(childRel);
    }
    ancestors.delete(real);
  };
  walk(".");
  return files.sort();
}

// Resolve a skill-relative target one component at a time against the real
// filesystem: each name must be listed exactly as written (exact case), and
// symlinks are followed by stat, so a finite path through an alias resolves
// while a dangling or looping link surfaces as a reason.
export function resolveTarget(dir, rel) {
  let abs = dir;
  let kind = "dir";
  if (rel === ".") return { kind, abs };
  for (const part of rel.split("/")) {
    if (kind !== "dir") return { error: "not a directory on the path" };
    let names;
    try { names = fs.readdirSync(abs); } catch { return { error: "unreadable directory on the path" }; }
    if (!names.includes(part)) return { error: "no such file or directory in skill" };
    abs = path.join(abs, part);
    let st;
    try { st = fs.statSync(abs); } catch (e) {
      return { error: e && e.code === "ELOOP" ? "symlink loop" : "unresolvable symlink" };
    }
    kind = st.isDirectory() ? "dir" : st.isFile() ? "file" : "other";
  }
  return { kind, abs };
}

export function checkSkill(dir, name) {
  const files = listMarkdownFiles(dir);
  const anchorCache = new Map();
  const anchorsOf = (abs) => {
    let key = abs;
    try { key = fs.realpathSync(abs); } catch {}
    if (!anchorCache.has(key)) anchorCache.set(key, headingAnchors(fs.readFileSync(abs, "utf8")));
    return anchorCache.get(key);
  };

  const failures = [];
  let checked = 0;
  let skipped = 0;

  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    for (const { target, line } of extractLinks(text)) {
      // A template file's placeholder link (`#{name}`) is filled in by the
      // agent at authoring time; it has no anchor to resolve here.
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/") || /[{}]/.test(target)) {
        skipped++;
        continue;
      }
      const hashAt = target.indexOf("#");
      const rawFilePart = hashAt === -1 ? target : target.slice(0, hashAt);
      const anchor = hashAt === -1 ? "" : target.slice(hashAt + 1);
      // A link target is a URL path: `A%20B.md` names the file "A B.md".
      let filePart;
      try {
        filePart = decodeURIComponent(rawFilePart);
      } catch {
        checked++;
        failures.push(`${name}/${f}:${line} -> ${target} (invalid percent-encoding)`);
        continue;
      }
      const wantsDir = filePart.endsWith("/");
      // Resolve from the linking file's directory: "../plan/PLAN.md" written in
      // run/RUN.md names plan/PLAN.md, and a bare "#anchor" names the file itself.
      const resolved = filePart === ""
        ? f
        : path.posix.normalize(path.posix.join(path.posix.dirname(f), filePart)).replace(/\/$/, "") || ".";

      // A link that leaves the skill directory is out of scope.
      if (resolved === ".." || resolved.startsWith("../")) {
        skipped++;
        continue;
      }
      checked++;

      const r = resolveTarget(dir, resolved);
      if (r.error) {
        failures.push(`${name}/${f}:${line} -> ${target} (${r.error})`);
      } else if (wantsDir && r.kind !== "dir") {
        failures.push(`${name}/${f}:${line} -> ${target} (not a directory)`);
      } else if (r.kind === "dir") {
        if (anchor) failures.push(`${name}/${f}:${line} -> ${target} (anchor on a directory)`);
      } else if (r.kind === "file" && MARKDOWN.test(resolved)) {
        if (anchor && !anchorsOf(r.abs).has(anchor)) {
          failures.push(`${name}/${f}:${line} -> ${target} (no heading yields #${anchor})`);
        }
      }
      // Any other existing file (a script, an asset) needs nothing more.
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
