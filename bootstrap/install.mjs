#!/usr/bin/env node
// Install the asdf agent OS onto this machine (idempotent, dependency-free).
//
// Usage:
//   node bootstrap/install.mjs [--dry-run]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO = path.resolve(process.env.ASDF_INSTALL_REPO ?? path.join(path.dirname(__filename), ".."));
const HOME = path.resolve(process.env.ASDF_INSTALL_HOME ?? os.homedir());

const BEGIN = "<!-- BEGIN EXECUTION CONTRACT (managed by asdf bootstrap/install.mjs) -->";
const END = "<!-- END EXECUTION CONTRACT -->";
const ACTIONS = [];

function plan(kind, detail) {
  ACTIONS.push([kind, detail]);
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, "utf8");
}

function sameFile(a, b) {
  try {
    return fs.realpathSync.native(a) === fs.realpathSync.native(b);
  } catch {
    return false;
  }
}

function sameContent(a, b) {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

function copyFile(src, dst, dry) {
  if (exists(dst)) {
    if (sameFile(src, dst)) {
      plan("same", dst);
      return;
    }
    if (sameContent(src, dst)) {
      plan("ok", dst);
      return;
    }
    plan("update", dst);
  } else {
    plan("new", dst);
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function walkFiles(root) {
  const out = [];
  if (!exists(root)) return out;
  for (const name of fs.readdirSync(root).sort()) {
    const p = path.join(root, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p));
    else if (st.isFile()) out.push(p);
  }
  return out;
}

function copyTree(src, dst, dry) {
  for (const file of walkFiles(src)) {
    copyFile(file, path.join(dst, path.relative(src, file)), dry);
  }
}

function parseFrontmatter(src) {
  const text = readText(src);
  const lines = text.split(/(?<=\n)/);
  if (!lines.length || lines[0].trim() !== "---") return [{}, text];
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (end < 0) return [{}, text];
  const meta = {};
  for (const line of lines.slice(1, end).join("").split(/\r?\n/)) {
    if (!line.trim() || !line.includes(":")) continue;
    const [key, ...rest] = line.split(":");
    const raw = rest.join(":").trim();
    let value = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw.replace(/^['"]|['"]$/g, "");
    }
    meta[key.trim()] = String(value);
  }
  return [meta, lines.slice(end + 1).join("").replace(/^\s+/, "")];
}

function codexCommandSkill(src) {
  const [meta, body] = parseFrontmatter(src);
  const name = path.basename(src, ".md");
  const description = meta.description ?? `${name} workflow command`;
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    "---",
    "",
    `# ${name}`,
    "",
    "Follow this command contract. Treat the user's current prompt after the skill name as the command input.",
    "",
    body,
  ].join("\n");
}

function writeTextIfChanged(dst, text, dry) {
  if (exists(dst)) {
    const existing = readText(dst);
    if (existing === text) {
      plan("ok", dst);
      return;
    }
    plan("update", dst);
  } else {
    plan("new", dst);
  }
  if (!dry) writeText(dst, text);
}

function beginPositions(text) {
  const positions = [];
  let at = text.indexOf(BEGIN);
  while (at >= 0) {
    positions.push([at, BEGIN]);
    at = text.indexOf(BEGIN, at + BEGIN.length);
  }
  return positions;
}

function contractProblem(target) {
  if (!exists(target)) return null;
  const text = readText(target);
  const begins = beginPositions(text);
  const endCount = text.split(END).length - 1;
  if ((begins.length === 0 && endCount === 0) || (begins.length === 1 && endCount === 1 && begins[0][0] < text.indexOf(END))) {
    return null;
  }
  const reversed = begins.length === 1 && endCount === 1 && begins[0][0] > text.indexOf(END);
  return `${target}: malformed contract markers (${begins.length} BEGIN / ${endCount} END${reversed ? ", reversed order" : ""}); reconcile the markers by hand, then re-run`;
}

function mergeContract(blockFile, target, dry) {
  const block = readText(blockFile).trim();
  const wrapped = `${BEGIN}\n${block}\n${END}`;
  let backup = false;
  let text = "";
  let next;
  if (exists(target)) {
    const problem = contractProblem(target);
    if (problem) {
      plan("error", problem);
      return;
    }
    text = readText(target);
    const begins = beginPositions(text);
    if (begins.length) {
      const [start, marker] = begins[0];
      const endStart = text.indexOf(END, start + marker.length);
      const endAfter = endStart + END.length;
      next = text.slice(0, start) + wrapped + text.slice(endAfter);
      if (next === text) {
        plan("ok", `${target} (contract block)`);
        return;
      }
      plan("update", `${target} (contract block)`);
    } else {
      next = `${text.trimEnd()}\n\n${wrapped}\n`;
      plan("append", `${target} (contract block)`);
    }
    backup = true;
  } else {
    next = `${wrapped}\n`;
    plan("new", target);
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (backup) writeText(`${target}.bak`, text);
    writeText(target, next);
  }
}

function dirs(root) {
  if (!exists(root)) return [];
  return fs.readdirSync(root).sort().map((name) => path.join(root, name)).filter((p) => fs.statSync(p).isDirectory());
}

function main() {
  const dry = process.argv.slice(2).includes("--dry-run");
  if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) {
    process.stderr.write("usage: node bootstrap/install.mjs [--dry-run]\n");
    return 2;
  }

  const problems = [
    contractProblem(path.join(HOME, ".claude", "CLAUDE.md")),
    contractProblem(path.join(HOME, ".codex", "AGENTS.md")),
  ].filter(Boolean);
  if (problems.length) {
    process.stdout.write(`asdf agent OS install aborted (nothing written) from ${REPO}\n\n`);
    for (const p of problems) process.stdout.write(`  error   ${p}\n`);
    return 1;
  }

  for (const skill of dirs(path.join(REPO, "skills"))) {
    for (const rt of [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]) {
      copyTree(skill, path.join(rt, path.basename(skill)), dry);
    }
  }

  for (const cmd of walkFiles(path.join(REPO, "bootstrap", "commands")).filter((p) => p.endsWith(".md")).sort()) {
    copyFile(cmd, path.join(HOME, ".claude", "commands", path.basename(cmd)), dry);
    writeTextIfChanged(
      path.join(HOME, ".agents", "skills", path.basename(cmd, ".md"), "SKILL.md"),
      codexCommandSkill(cmd),
      dry,
    );
  }

  mergeContract(path.join(REPO, "bootstrap", "contract", "claude.md"), path.join(HOME, ".claude", "CLAUDE.md"), dry);
  mergeContract(path.join(REPO, "bootstrap", "contract", "codex.md"), path.join(HOME, ".codex", "AGENTS.md"), dry);

  copyFile(path.join(REPO, "bootstrap", "bin", "agent-doctor.mjs"), path.join(HOME, "bin", "agent-doctor.mjs"), dry);
  copyFile(path.join(REPO, "bootstrap", "bin", "agent-workflow-hook.mjs"), path.join(HOME, "bin", "agent-workflow-hook.mjs"), dry);
  copyFile(path.join(REPO, "bootstrap", "bin", "meta-loop.mjs"), path.join(HOME, "bin", "meta-loop.mjs"), dry);

  const order = ["new", "update", "append", "ok", "same", "error"];
  const counts = Object.fromEntries(order.map((k) => [k, 0]));
  process.stdout.write(`asdf agent OS install ${dry ? "(dry run) " : ""}from ${REPO}\n\n`);
  for (const kind of order) {
    const rows = ACTIONS.filter(([k]) => k === kind).map(([, detail]) => detail);
    counts[kind] = rows.length;
    if (["new", "update", "append", "error"].includes(kind)) {
      for (const detail of rows) process.stdout.write(`  ${kind.padEnd(7)} ${detail}\n`);
    }
  }
  process.stdout.write(`\nsummary: ${order.map((k) => `${counts[k]} ${k}`).join(", ")}  (ok=unchanged, same=linked install)\n`);

  const modes = [];
  for (const skill of dirs(path.join(REPO, "skills"))) {
    const probe = path.join(skill, "SKILL.md");
    const row = [];
    for (const [tag, rt] of [["claude", path.join(HOME, ".claude", "skills")], ["codex", path.join(HOME, ".codex", "skills")]]) {
      const target = path.join(rt, path.basename(skill), "SKILL.md");
      if (!exists(target)) row.push(`${tag}=missing`);
      else row.push(`${tag}=${sameFile(probe, target) ? "link" : "copy"}`);
    }
    modes.push(`  ${path.basename(skill).padEnd(26)} ${row.join("  ")}`);
  }
  if (modes.length) {
    process.stdout.write("\ninstall mode per skill (link=source-linked; copy=re-run installer after source edits):\n");
    process.stdout.write(`${modes.join("\n")}\n`);
  }

  process.stdout.write(
    "\nmanual wiring to verify on a new machine (not automated):\n" +
      "  - PATH contains ~/bin (for agent-doctor.mjs and agent-workflow-hook.mjs)\n" +
      "  - PreToolUse/Stop hooks call: node ~/bin/agent-workflow-hook.mjs\n" +
      "  - run: node ~/bin/agent-doctor.mjs  - verifies versions, contract presence, hooks, skill drift\n",
  );

  return counts.error ? 1 : 0;
}

process.exit(main());
