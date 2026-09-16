#!/usr/bin/env node

// Repo-wide verification entry. Local test suites (top-level tests/ and
// per-skill */tests/) are gitignored and never reach CI, so nothing else
// catches a semantic change that skips them — this script is that guard.
//
// It deliberately stops at what runs on any machine with Node alone. Contract
// checks that drive an external toolchain (JDK, Maven) stay out, so "the
// repo-wide gate passed" must not be read as "the tools were exercised": the
// run names them instead of leaving the boundary implicit.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function findTests(dir, seen = new Set()) {
  // Follow directory symlinks: a Dirent reports the link's own type, so an
  // isDirectory()-only walk silently drops every suite behind a symlinked
  // tests directory — and symlinked skill trees are ordinary in this ecosystem.
  let real;
  try { real = fs.realpathSync(dir); } catch { return []; }
  if (seen.has(real)) return [];
  seen.add(real);
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const target = entry.isSymbolicLink() ? fs.statSync(full, { throwIfNoEntry: false }) : entry;
    if (!target) continue;
    if (target.isDirectory()) found.push(...findTests(full, seen));
    else if (entry.name.endsWith(".test.mjs") || entry.name.endsWith(".test.cjs")) found.push(full);
  }
  return found;
}

const suites = [];
const skillsDir = path.join(ROOT, "skills");
if (fs.existsSync(skillsDir)) {
  for (const skill of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (skill.isDirectory()) suites.push(...findTests(path.join(skillsDir, skill.name, "tests")));
  }
}
suites.push(...findTests(path.join(ROOT, "tests")));
suites.push(...findTests(path.join(ROOT, "scripts")));

const steps = [];
if (suites.length > 0) {
  steps.push({ name: `test suites (${suites.length} files)`, args: ["--test", ...suites] });
}
// Both prefixes are discovered, never listed: a check added later must not have
// to remember to announce itself here, and a hand-kept list is how one silently
// stops running. `assert-` is therefore a contract and not decoration — dropping
// `assert-foo.cjs` into scripts/ puts it in the gate, and a script that must stay
// out of the gate says so by taking another prefix. Alphabetical order keeps
// runs comparable; these checks are independent, so no other order is owed.
const scriptsDir = path.join(ROOT, "scripts");
const scriptNames = fs.readdirSync(scriptsDir).sort();
for (const name of scriptNames) {
  if (!name.startsWith("assert-") || name.includes(".test.")) continue;
  steps.push({
    name: name.replace(/^assert-/u, "").replace(/\.[cm]js$/u, "").replace(/-/gu, " "),
    args: [path.join(scriptsDir, name)],
  });
}

let failed = false;
for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) failed = true;
  process.stdout.write(`${result.status === 0 ? "PASS" : "FAIL"}: ${step.name}\n`);
}
if (suites.length === 0) {
  process.stdout.write(`note: no local test suites found on this machine (they are local-only, never published); ran ${steps.map((step) => step.name).join(", ")}\n`);
}
// `contract-` names the scripts that drive an external toolchain (JDK, Maven,
// git fixtures) and therefore stay out of a gate that must run anywhere Node
// does. Naming them on exit keeps the boundary explicit instead of implicit.
const external = scriptNames.filter((name) => name.startsWith("contract-"));
if (external.length > 0) {
  process.stdout.write(`note: not in this gate (external toolchain) — run directly: ${
    external.map((name) => `node scripts/${name}`).join(", ")}\n`);
}
process.exitCode = failed ? 1 : 0;
