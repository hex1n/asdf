#!/usr/bin/env node

// Link source skills into the runtimes that load them.
//
// Canonical targets are .agents and .claude; the other runtimes on this machine
// read .agents rather than carrying their own copy, so a skill placed anywhere
// else is a stray that will silently fall behind the source.
//
// Every installed entry is a link back at the source tree, never a copy. One
// skill therefore exists once on disk, in this repository: editing the source
// updates every runtime at once and drift is not representable. check-all's
// byte-identity check keeps passing because a link reads as its own target.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_ROOT = path.join(ROOT, "skills");

export const TARGET_RUNTIMES = [".agents", ".claude"];

// Windows refuses directory symlinks without Developer Mode or elevation; a
// junction needs neither, Node reports it via isSymbolicLink(), and readdir
// resolves through it — which is all the drift check relies on.
const LINK_TYPE = process.platform === "win32" ? "junction" : "dir";

export function listSourceSkills(skillsRoot = SKILLS_ROOT) {
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Classify what currently occupies an install path, so the caller can tell a
// no-op from a replacement and never reports "installed" for a stale copy.
export function classify(installPath, sourceDir) {
  let stat;
  try {
    stat = fs.lstatSync(installPath);
  } catch {
    return "absent";
  }
  if (stat.isSymbolicLink()) {
    try {
      return path.resolve(fs.realpathSync(installPath)) === path.resolve(sourceDir) ? "linked" : "relinked";
    } catch {
      return "relinked"; // dangling link
    }
  }
  return "copy";
}

export function linkSkill(installPath, sourceDir) {
  fs.mkdirSync(path.dirname(installPath), { recursive: true });
  fs.rmSync(installPath, { recursive: true, force: true });
  fs.symlinkSync(sourceDir, installPath, LINK_TYPE);
}

export function planInstall(skills, home = os.homedir(), skillsRoot = SKILLS_ROOT) {
  const plan = [];
  for (const runtime of TARGET_RUNTIMES) {
    const skillsDir = path.join(home, runtime, "skills");
    // Only manage a runtime that exists; creating one would install this
    // repository into a tool the user does not run.
    if (!fs.existsSync(path.join(home, runtime))) continue;
    for (const skill of skills) {
      const sourceDir = path.join(skillsRoot, skill);
      const installPath = path.join(skillsDir, skill);
      plan.push({ runtime, skill, installPath, sourceDir, state: classify(installPath, sourceDir) });
    }
  }
  return plan;
}

// A copy of one of our skills under a non-target runtime. Reported by default
// and only removed on request: the directory belongs to another tool.
export function findStrays(skills, home = os.homedir()) {
  const strays = [];
  const wanted = new Set(skills);
  let entries = [];
  try {
    entries = fs.readdirSync(home, { withFileTypes: true });
  } catch {
    return strays;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(".")) continue;
    if (TARGET_RUNTIMES.includes(entry.name)) continue;
    const skillsDir = path.join(home, entry.name, "skills");
    let children = [];
    try {
      children = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!wanted.has(child.name)) continue;
      if (!child.isDirectory() && !child.isSymbolicLink()) continue;
      strays.push({ runtime: entry.name, skill: child.name, installPath: path.join(skillsDir, child.name) });
    }
  }
  return strays.sort((a, b) => a.runtime.localeCompare(b.runtime) || a.skill.localeCompare(b.skill));
}

function main(argv) {
  const apply = argv.includes("--apply");
  const pruneStray = argv.includes("--prune-stray");
  const skills = listSourceSkills();
  const plan = planInstall(skills);
  const strays = findStrays(skills);

  const changes = plan.filter((item) => item.state !== "linked");
  for (const item of changes) {
    const verb = { absent: "link", copy: "replace copy with link", relinked: "repoint link" }[item.state];
    process.stdout.write(`${apply ? "DO" : "would"} ${verb}: ${item.skill} @ ${item.runtime}\n`);
    if (apply) linkSkill(item.installPath, item.sourceDir);
  }
  for (const stray of strays) {
    process.stdout.write(
      `${pruneStray ? (apply ? "DO remove" : "would remove") : "stray"}: ${stray.skill} @ ${stray.runtime}` +
        `${pruneStray ? "" : " — not a target runtime; pass --prune-stray to remove"}\n`,
    );
    if (apply && pruneStray) fs.rmSync(stray.installPath, { recursive: true, force: true });
  }

  const linked = plan.length - changes.length;
  process.stdout.write(
    `${apply ? "applied" : "plan"}: ${skills.length} skills, ${plan.length} install paths across ` +
      `${TARGET_RUNTIMES.join(", ")} — ${linked} already linked, ${changes.length} to change, ` +
      `${strays.length} stray\n`,
  );
  if (!apply && (changes.length || (pruneStray && strays.length))) {
    process.stdout.write("re-run with --apply to make these changes\n");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
