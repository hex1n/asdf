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

export function linkSkill(installPath, sourceDir, io = fs) {
  io.mkdirSync(path.dirname(installPath), { recursive: true });
  // Build the link at a staged sibling first: if creation fails (Windows
  // permissions, locked path, bad target), the existing install must survive
  // rather than having been deleted ahead of a link that never appeared.
  const stagedPath = `${installPath}.staged-link`;
  // The staged path may hold a leftover from a previous failed run — ours to
  // replace only when it is a link back at this skill's source. Anything else
  // there is not ours to delete: stop rather than destroy an unrelated
  // sibling.
  let stagedStat = null;
  try {
    stagedStat = io.lstatSync(stagedPath);
  } catch {}
  if (stagedStat) {
    if (stagedStat.isSymbolicLink() && classify(stagedPath, sourceDir) === "linked") {
      io.rmSync(stagedPath, { recursive: true, force: true });
    } else {
      throw new Error(`staged path ${stagedPath} exists and is not this skill's staged link; move it aside and re-run`);
    }
  }
  io.symlinkSync(sourceDir, stagedPath, LINK_TYPE);
  // From here the old install may be partially or fully deleted at any point
  // (a recursive rmSync can fail halfway through), so on any failure the
  // staged link stays on disk as the recovery path — readdir resolves through
  // it, so the skill's content remains reachable — and the next run reuses or
  // replaces it. Retry the whole destructive sequence once for transient
  // locks, then give up without discarding the staged link.
  try {
    io.rmSync(installPath, { recursive: true, force: true });
    io.renameSync(stagedPath, installPath);
  } catch (error) {
    try {
      io.rmSync(installPath, { recursive: true, force: true });
      io.renameSync(stagedPath, installPath);
    } catch {
      throw new Error(
        `failed to replace ${installPath}; the old install may be incomplete, staged link kept at ${stagedPath}`,
        { cause: error },
      );
    }
  }
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

// A skill of ours under a non-target runtime. Reported by default and only
// removed on request, and even then only when provenance is provable: a link
// resolving back at this repository's source is ours; a same-name real
// directory or a link elsewhere may be a user-owned local override
// (CONTEXT.md: user-owned, separate from us) and is never removed.
export function findStrays(skills, home = os.homedir(), skillsRoot = SKILLS_ROOT) {
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
      const installPath = path.join(skillsDir, child.name);
      strays.push({
        runtime: entry.name,
        skill: child.name,
        installPath,
        ours: classify(installPath, path.join(skillsRoot, child.name)) === "linked",
      });
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
  const prunable = strays.filter((stray) => stray.ours);
  for (const stray of strays) {
    if (!stray.ours) {
      process.stdout.write(
        `kept: ${stray.skill} @ ${stray.runtime} — same name but not a link to this repository; ` +
          `possible local override, never removed\n`,
      );
      continue;
    }
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
  if (!apply && (changes.length || (pruneStray && prunable.length))) {
    process.stdout.write("re-run with --apply to make these changes\n");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
