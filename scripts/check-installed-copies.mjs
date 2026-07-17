#!/usr/bin/env node

// Compare source skills against their installed runtime copies.
//
// AGENTS.md requires every installed runtime copy to stay byte-identical with
// its source skill. Nothing enforced that, so a copy could silently sit two
// revisions behind while the source looked correct in review.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Runtimes are discovered, never hard-coded: this machine carries our skills in
// .agents, .claude, .codex and .factory, and a hard-coded pair silently reported
// PASS while a third runtime sat two revisions behind.
const BACKUP_HINT = /backup|[-_]bak(\b|[-_])|\.old$/i;

function listFilesRecursive(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}

function sameBytes(a, b) {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

export function compareSkillTree(sourceDir, installedDir) {
  if (!fs.existsSync(installedDir)) return { installed: false, drift: [], missing: [], extra: [] };
  const sourceFiles = listFilesRecursive(sourceDir);
  const installedFiles = listFilesRecursive(installedDir);
  const installedSet = new Set(installedFiles);
  const drift = [];
  const missing = [];
  for (const rel of sourceFiles) {
    if (!installedSet.has(rel)) missing.push(rel);
    else if (!sameBytes(path.join(sourceDir, rel), path.join(installedDir, rel))) drift.push(rel);
  }
  const sourceSet = new Set(sourceFiles);
  const extra = installedFiles.filter((rel) => !sourceSet.has(rel));
  return { installed: true, drift, missing, extra };
}

export function scanSkills(skillsRoot, runtimeRoots) {
  const results = [];
  const skills = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const skill of skills) {
    for (const runtime of runtimeRoots) {
      const compared = compareSkillTree(path.join(skillsRoot, skill), path.join(runtime.skillsDir, skill));
      results.push({ skill, runtime: runtime.label, runtimeSkillsDir: runtime.skillsDir, ...compared });
    }
  }
  return results;
}

export function summarize(results) {
  const clean = results.filter((r) => r.installed && !r.drift.length && !r.missing.length && !r.extra.length);
  const dirty = results.filter((r) => r.installed && (r.drift.length || r.missing.length || r.extra.length));
  const absent = results.filter((r) => !r.installed);
  return { clean, dirty, absent, pass: dirty.length === 0 };
}

export function discoverRuntimes(explicit, skillsRoot, home = os.homedir()) {
  if (explicit.length) {
    return explicit.map((dir) => ({
      label: path.basename(path.dirname(dir)) || dir,
      skillsDir: dir,
      installedCount: null,
      looksLikeBackup: false,
    }));
  }
  const sourceSkills = new Set(
    fs
      .readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const found = [];
  let entries = [];
  try {
    entries = fs.readdirSync(home, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(".")) continue;
    const skillsDir = path.join(home, entry.name, "skills");
    let installedCount = 0;
    try {
      for (const child of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        // A runtime may symlink a skill straight back at the source tree; that
        // counts as installed (and compares as identical), so isDirectory alone
        // would undercount the runtime.
        if (!sourceSkills.has(child.name)) continue;
        if (child.isDirectory() || child.isSymbolicLink()) installedCount += 1;
      }
    } catch {
      continue;
    }
    if (installedCount === 0) continue;
    found.push({
      label: entry.name,
      skillsDir,
      installedCount,
      looksLikeBackup: BACKUP_HINT.test(entry.name),
    });
  }
  return found.sort((a, b) => a.label.localeCompare(b.label));
}

function applyFix(result, skillsRoot) {
  const sourceDir = path.join(skillsRoot, result.skill);
  const targetDir = result.runtimeSkillsDir ? path.join(result.runtimeSkillsDir, result.skill) : null;
  if (!targetDir) return [];
  const fixed = [];
  for (const rel of [...result.drift, ...result.missing]) {
    const from = path.join(sourceDir, rel);
    const to = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    fixed.push(rel);
  }
  return fixed;
}

function main(argv) {
  const fix = argv.includes("--fix");
  const json = argv.includes("--json");
  const skillsRoot = path.resolve(
    argv.find((a) => a.startsWith("--skills-dir="))?.split("=")[1] ??
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills"),
  );
  if (!fs.existsSync(skillsRoot)) {
    process.stderr.write(`skills directory not found: ${skillsRoot}\n`);
    process.exitCode = 2;
    return;
  }
  const explicit = argv.filter((a) => a.startsWith("--runtime=")).map((a) => path.resolve(a.split("=")[1]));
  const runtimes = discoverRuntimes(explicit, skillsRoot);

  if (!runtimes.length) {
    process.stderr.write("no runtime carries any skill from this repository\n");
    process.exitCode = 2;
    return;
  }

  let results = scanSkills(skillsRoot, runtimes);
  const fixedLog = [];
  const skippedBackups = [];
  if (fix) {
    for (const result of summarize(results).dirty) {
      const runtime = runtimes.find((entry) => entry.label === result.runtime);
      if (runtime?.looksLikeBackup) {
        skippedBackups.push(result);
        continue;
      }
      const fixed = applyFix(result, skillsRoot);
      if (fixed.length) fixedLog.push({ skill: result.skill, runtime: result.runtime, files: fixed });
    }
    results = scanSkills(skillsRoot, runtimes);
  }

  const { clean, dirty, absent, pass } = summarize(results);

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ pass, runtimes, dirty, absent, fixed: fixedLog, skippedBackups }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(
      `runtimes: ${runtimes
        .map((r) => `${r.label}${r.installedCount == null ? "" : ` (${r.installedCount})`}${r.looksLikeBackup ? " [backup]" : ""}`)
        .join(", ")}\n`,
    );
    for (const entry of fixedLog) {
      process.stdout.write(`synced ${entry.skill} @ ${entry.runtime}: ${entry.files.join(", ")}\n`);
    }
    for (const result of skippedBackups) {
      process.stdout.write(`skipped ${result.skill} @ ${result.runtime}: looks like a backup, not overwriting\n`);
    }
    for (const result of dirty) {
      const parts = [];
      if (result.drift.length) parts.push(`drift: ${result.drift.join(", ")}`);
      if (result.missing.length) parts.push(`missing: ${result.missing.join(", ")}`);
      if (result.extra.length) parts.push(`extra: ${result.extra.join(", ")}`);
      process.stdout.write(`DRIFT ${result.skill} @ ${result.runtime} — ${parts.join("; ")}\n`);
    }
    for (const result of absent) {
      process.stdout.write(`not installed: ${result.skill} @ ${result.runtime}\n`);
    }
    process.stdout.write(
      `${pass ? "PASS" : "FAIL"}: ${clean.length} byte-identical, ${dirty.length} drifted, ${absent.length} not installed\n`,
    );
    if (!pass) process.stdout.write("run with --fix to sync source into the installed copies\n");
  }
  process.exitCode = pass ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
