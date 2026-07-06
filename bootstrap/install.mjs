#!/usr/bin/env node
// Install the asdf agent OS onto this machine (idempotent, dependency-free).
//
// Usage:
//   node bootstrap/install.mjs [--dry-run]

import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO = path.resolve(process.env.ASDF_INSTALL_REPO ?? path.join(path.dirname(__filename), ".."));
const HOME = path.resolve(process.env.ASDF_INSTALL_HOME ?? os.homedir());

const BEGIN = "<!-- BEGIN EXECUTION CONTRACT (managed by asdf bootstrap/install.mjs) -->";
const LEGACY_BEGIN = "<!-- BEGIN EXECUTION CONTRACT (managed by asdf bootstrap/install.py) -->";
const END = "<!-- END EXECUTION CONTRACT -->";
const HOOK_BEGIN = "# BEGIN ASDF AGENT LOOP HOOKS (managed by asdf bootstrap/install.mjs)";
const HOOK_END = "# END ASDF AGENT LOOP HOOKS";
const LEGACY_HOOK_MARKERS = [
  [
    "# BEGIN ASDF AGENT WORKFLOW HOOKS (managed by asdf bootstrap/install.mjs)",
    "# END ASDF AGENT WORKFLOW HOOKS",
  ],
];
const ACTIONS = [];
const WORKFLOW_SKILLS = ["converge", "workloop"];
const LOOP_HOOK_RE = /agent-(?:workflow-hook|loop)\.(?:py|mjs)/i;
// The Stop gate re-runs the done-when criterion, which is budgeted
// CRITERION_TIMEOUT_SECONDS inside taskloop/bin/taskloop.mjs. The runtime's
// outer hook timeout must exceed that budget or the runtime kills the gate
// mid-verdict on any real test suite (Claude Code's default hook timeout is
// 60s; the Codex TOML previously said 30s). 330 = criterion budget + slack.
// tests/bootstrap_install.test.mjs locks this against the runtime constant.
const STOP_HOOK_TIMEOUT_SECONDS = 330;
const PRETOOL_HOOK_TIMEOUT_SECONDS = 30;
const LEGACY_WORKFLOW_HASHES = {
  claude: {
    converge: new Set(["36ac6f3314effe80c8790c2297fda6c03f9b15cbac6eec2c1083e6ad05f5b648"]),
    fixloop: new Set(["6d2b90078aa1f7b94b530eb2604153b28fe3f193ff5a38c0078fc03d2b9e5cde"]),
    land: new Set(["beec6d97c889de8720cd210f22d5630c1fdfdc370962dc9d15be81a0d289e572"]),
    loop: new Set(["9afea4122562e6edbbf2a523e62f923cbcdf882dc02a6ff730df7d27bede0ed6"]),
  },
  codex: {
    converge: new Set(["e7cf11a6e2212a6c9ad4885941e190ba939971190522c55b5bd11e4eb95c232a"]),
    fixloop: new Set(["a8d0f52533fc486924de471ae024656973cf232dbb1ed9577e1784f98bd7e304"]),
    land: new Set(["722fe6556bccedc4a0cc0a08273b2ee6f205fc124bf81481f5341f50f7581289"]),
    loop: new Set(["8793bd11d24445e21ca5d1152f70369940e444cd9c3a4bb3ec03e7000b45f310"]),
  },
};

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

function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
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

function sameInode(a, b) {
  try {
    const sa = fs.statSync(a, { bigint: true });
    const sb = fs.statSync(b, { bigint: true });
    return sa.dev === sb.dev && sa.ino === sb.ino && sa.ino !== 0n;
  } catch {
    return false;
  }
}

// A linked install (dir symlink or hardlinked file into the working tree)
// lets uncommitted edits leak into live sessions before they pass the
// evidence loop. Its content equals the source by definition, so replacing
// it with a real copy loses nothing.
function delinkInstalledSkill(src, dst, dry) {
  if (!exists(dst)) return;
  const probes = ["SKILL.md", "REFERENCE.md"].map((name) => [path.join(src, name), path.join(dst, name)]);
  const linked =
    isSymlink(dst) ||
    probes.some(([a, b]) => exists(a) && exists(b) && (sameFile(a, b) || sameInode(a, b)));
  if (!linked) return;
  plan("update", `${dst} (delink: linked install becomes a managed copy)`);
  if (dry) return;
  if (isSymlink(dst)) {
    try {
      fs.unlinkSync(dst);
    } catch {
      fs.rmdirSync(dst);
    }
  } else {
    fs.rmSync(dst, { recursive: true, force: true });
  }
}

function git(args) {
  return execFileSync("git", ["-C", REPO, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// Distribution rides the commit boundary: a commit is the point where a
// change has passed the evidence loop, so hooks/post-commit re-runs this
// installer and the drift window collapses to zero. Local repo config only;
// anything unexpected degrades to a note and the doctor stays the backstop.
function registerCommitDistribution(dry) {
  if (!exists(path.join(REPO, "hooks", "post-commit"))) {
    plan("ok", "commit-time distribution skipped (no hooks/post-commit in this source tree)");
    return;
  }
  let isRepo = false;
  try {
    isRepo = git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    isRepo = false;
  }
  if (!isRepo) {
    plan("ok", `commit-time distribution skipped (${REPO} is not a git work tree)`);
    return;
  }
  try {
    const gitDir = git(["rev-parse", "--git-dir"]);
    const legacyHooks = path.join(path.isAbsolute(gitDir) ? gitDir : path.join(REPO, gitDir), "hooks");
    const custom = fs.readdirSync(legacyHooks).filter((f) => !f.endsWith(".sample"));
    if (custom.length) {
      plan("error", `.git/hooks has custom hooks (${custom.join(", ")}); switching core.hooksPath would bypass them - merge them into hooks/ first`);
      return;
    }
  } catch {
    /* no legacy hooks dir to protect */
  }
  let current = "";
  try {
    current = git(["config", "--get", "core.hooksPath"]);
  } catch {
    current = "";
  }
  if (current === "hooks") {
    plan("ok", "core.hooksPath already points at hooks/ (commit-time distribution wired)");
    return;
  }
  if (current) {
    plan("error", `core.hooksPath is '${current}'; not overwriting a foreign hooks dir - merge hooks/post-commit yourself`);
    return;
  }
  plan("update", "git config core.hooksPath hooks (post-commit re-runs install.mjs)");
  if (dry) return;
  try {
    git(["config", "core.hooksPath", "hooks"]);
  } catch (err) {
    plan("error", `failed to set core.hooksPath: ${String(err?.message ?? err)}`);
  }
}

function normalizedHash(text) {
  return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function backupPath(target, suffix) {
  const candidate = `${target}.${suffix}`;
  if (!exists(candidate)) return candidate;
  let i = 2;
  while (exists(`${candidate}.${i}`)) i += 1;
  return `${candidate}.${i}`;
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

function isKnownManagedLegacyWorkflowText(text, name, kind) {
  return Boolean(LEGACY_WORKFLOW_HASHES[kind]?.[name]?.has(normalizedHash(text)));
}

function removeManagedLegacyWorkflowFile(target, name, kind, dry) {
  if (!exists(target)) return;
  const text = readText(target);
  if (!isKnownManagedLegacyWorkflowText(text, name, kind)) {
    plan("ok", `${target} (preserved non-managed legacy file)`);
    return;
  }
  const backup = backupPath(target, "bak-asdf-skill-first");
  plan("remove", `${target} (backup: ${backup})`);
  if (!dry) {
    fs.copyFileSync(target, backup);
    fs.rmSync(target, { force: true });
  }
}

function pruneEmptyDir(dir, dry) {
  if (!exists(dir)) return;
  try {
    if (fs.readdirSync(dir).length) return;
    plan("remove", dir);
    if (!dry) fs.rmdirSync(dir);
  } catch {
    // Directory is not empty or not removable; keeping it is harmless.
  }
}

function backupLegacySupportDir(target, dry) {
  if (!exists(target)) return;
  const backup = backupPath(target, "bak-asdf-loop-core");
  plan("remove", `${target} (backup: ${backup})`);
  if (!dry) fs.renameSync(target, backup);
}

function workflowHookCommand() {
  return `node "${path.join(HOME, "bin", "taskloop.mjs")}"`;
}

function pruneWorkflowHookGroups(groups) {
  if (!Array.isArray(groups)) return [];
  const next = [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const hooks = Array.isArray(group.hooks) ? group.hooks : [];
    const kept = hooks.filter((hook) => !LOOP_HOOK_RE.test(String(hook.command ?? "")));
    if (kept.length) next.push({ ...group, hooks: kept });
  }
  return next;
}

function addClaudeHook(settings, event, matcher, command, timeoutSeconds) {
  settings.hooks ??= {};
  settings.hooks[event] = pruneWorkflowHookGroups(settings.hooks[event]);
  settings.hooks[event].push({
    matcher,
    hooks: [{ type: "command", command, timeout: timeoutSeconds }],
  });
}

function configureClaudeHooks(dry) {
  const target = path.join(HOME, ".claude", "settings.json");
  const hadTarget = exists(target);
  const original = hadTarget ? readText(target) : "";
  let settings = {};
  if (hadTarget) {
    try {
      settings = JSON.parse(original);
    } catch (err) {
      plan("error", `${target}: cannot parse JSON (${err.message})`);
      return;
    }
  }
  const command = workflowHookCommand();
  addClaudeHook(settings, "PreToolUse", "Write|Edit|MultiEdit|Bash|PowerShell|mcp__.*", command, PRETOOL_HOOK_TIMEOUT_SECONDS);
  addClaudeHook(settings, "Stop", "*", command, STOP_HOOK_TIMEOUT_SECONDS);
  const next = JSON.stringify(settings, null, 2) + "\n";
  writeTextIfChanged(target, next, dry);
  if (!dry && hadTarget && original !== next) {
    writeText(`${target}.bak-agent-loop-hook`, original);
  }
}

function prunedWorkflowHookJson(value) {
  if (Array.isArray(value)) {
    let changed = false;
    const next = [];
    for (const item of value) {
      const pruned = prunedWorkflowHookJson(item);
      changed ||= pruned.changed;
      if (pruned.drop) {
        changed = true;
        continue;
      }
      next.push(pruned.value);
    }
    return { value: next, changed };
  }
  if (value && typeof value === "object") {
    if (LOOP_HOOK_RE.test(String(value.command ?? ""))) {
      return { drop: true, changed: true };
    }
    let changed = false;
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      const pruned = prunedWorkflowHookJson(child);
      changed ||= pruned.changed;
      if (!pruned.drop) next[key] = pruned.value;
      else changed = true;
    }
    return { value: next, changed };
  }
  return { value, changed: false };
}

function configureCodexHooksJson(dry) {
  const target = path.join(HOME, ".codex", "hooks.json");
  if (!exists(target)) return;
  const before = readText(target);
  if (!LOOP_HOOK_RE.test(before)) {
    plan("ok", `${target} (legacy loop hooks absent)`);
    return;
  }
  let data;
  try {
    data = JSON.parse(before);
  } catch (err) {
    plan("error", `${target}: cannot parse JSON while removing legacy loop hook (${err.message})`);
    return;
  }
  const pruned = prunedWorkflowHookJson(data);
  if (!pruned.changed) {
    plan("ok", `${target} (legacy loop hooks absent)`);
    return;
  }
  const next = JSON.stringify(pruned.value, null, 2) + "\n";
  writeTextIfChanged(target, next, dry);
  if (!dry && before !== next) writeText(`${target}.bak-agent-loop-hook`, before);
}

function stripManagedHookBlock(text) {
  let next = text;
  const markers = [[HOOK_BEGIN, HOOK_END], ...LEGACY_HOOK_MARKERS];
  for (;;) {
    let found = null;
    for (const [begin, endMarker] of markers) {
      const start = next.indexOf(begin);
      if (start >= 0 && (found === null || start < found.start)) found = { begin, endMarker, start };
    }
    if (found === null) return next;
    const end = next.indexOf(found.endMarker, found.start + found.begin.length);
    if (end < 0) return next;
    next = next.slice(0, found.start).trimEnd() + "\n" + next.slice(end + found.endMarker.length).replace(/^\s+/, "");
  }
}

function pruneWorkflowTomlHookGroup(lines, event) {
  const childHeader = new RegExp(`^\\s*\\[\\[hooks\\.${event}\\.hooks\\]\\]\\s*$`);
  const prefix = [];
  const keptChildren = [];
  let sawChild = false;
  for (let i = 0; i < lines.length;) {
    if (!childHeader.test(lines[i])) {
      prefix.push(lines[i]);
      i += 1;
      continue;
    }
    sawChild = true;
    let j = i + 1;
    while (j < lines.length && !/^\s*\[\[/.test(lines[j])) j += 1;
    const child = lines.slice(i, j);
    if (!LOOP_HOOK_RE.test(child.join("\n"))) keptChildren.push(child);
    i = j;
  }
  if (!sawChild) return LOOP_HOOK_RE.test(lines.join("\n")) ? [] : lines;
  if (!keptChildren.length) return [];
  return [...prefix, ...keptChildren.flat()];
}

function stripWorkflowTomlHookBlocks(text) {
  const lines = stripManagedHookBlock(text).split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length;) {
    const header = lines[i].match(/^\s*\[\[hooks\.(PreToolUse|Stop)\]\]\s*$/);
    if (!header) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    const event = header[1];
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j];
      const isHeader = /^\s*\[/.test(line);
      const isChild = new RegExp(`^\\s*\\[\\[hooks\\.${event}\\.hooks\\]\\]\\s*$`).test(line);
      if (isHeader && !isChild) break;
      j += 1;
    }
    out.push(...pruneWorkflowTomlHookGroup(lines.slice(i, j), event));
    i = j;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function managedCodexHookBlock() {
  const command = workflowHookCommand();
  const commandToml = JSON.stringify(command);
  return [
    HOOK_BEGIN,
    '[[hooks.PreToolUse]]',
    'matcher = ".*"',
    '',
    '[[hooks.PreToolUse.hooks]]',
    'type = "command"',
    `command = ${commandToml}`,
    `timeout = ${PRETOOL_HOOK_TIMEOUT_SECONDS}`,
    'statusMessage = "Checking agent loop run contract"',
    '',
    '[[hooks.Stop]]',
    'matcher = ".*"',
    '',
    '[[hooks.Stop.hooks]]',
    'type = "command"',
    `command = ${commandToml}`,
    `timeout = ${STOP_HOOK_TIMEOUT_SECONDS}`,
    'statusMessage = "Checking agent loop stop gate"',
    HOOK_END,
    '',
  ].join("\n");
}

function configureCodexHooks(dry) {
  const target = path.join(HOME, ".codex", "config.toml");
  const before = exists(target) ? readText(target) : "";
  const body = stripWorkflowTomlHookBlocks(before);
  const prefix = body.trimEnd();
  const next = `${prefix ? `${prefix}\n\n` : ""}${managedCodexHookBlock()}`;
  writeTextIfChanged(target, next, dry);
  if (!dry && before && before !== next) writeText(`${target}.bak-agent-loop-hook`, before);
}

function beginPositions(text) {
  const positions = [];
  for (const marker of [BEGIN, LEGACY_BEGIN]) {
    let at = text.indexOf(marker);
    while (at >= 0) {
      positions.push([at, marker]);
      at = text.indexOf(marker, at + marker.length);
    }
  }
  return positions.sort((a, b) => a[0] - b[0]);
}

function jsonConfigProblem(target, options = {}) {
  if (!exists(target)) return null;
  const text = readText(target);
  if (options.onlyIfMatches && !options.onlyIfMatches.test(text)) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (err) {
    return `${target}: cannot parse JSON (${err.message}); fix it by hand, then re-run`;
  }
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

// The Claude-side contract now ships as a whole-file user rule
// (~/.claude/rules/work-loop.md); any marker block a previous installer merged
// into ~/.claude/CLAUDE.md is stale and gets removed here. Never write through
// a symlink: a symlinked CLAUDE.md is owned by another system (e.g. a memory
// vault), so a block inside it must be moved out by hand.
function removeContractBlock(target, dry) {
  if (!exists(target)) return;
  const text = readText(target);
  const begins = beginPositions(text);
  if (!begins.length) return;
  if (isSymlink(target)) {
    plan("error", `${target}: symlink contains a managed contract block; remove it from the link target by hand`);
    return;
  }
  const [start, marker] = begins[0];
  const endStart = text.indexOf(END, start + marker.length);
  const endAfter = endStart + END.length;
  const next = (text.slice(0, start) + text.slice(endAfter)).replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
  plan("remove", `${target} (contract block moved to ~/.claude/rules/work-loop.md)`);
  if (!dry) {
    writeText(`${target}.bak`, text);
    writeText(target, next);
  }
}

// Codex has no user-level rules directory, so the marker merge stays — but a
// symlinked AGENTS.md is owned elsewhere and is never written through.
function guardedMergeContract(blockFile, target, dry) {
  if (isSymlink(target)) {
    if (beginPositions(readText(target)).length) {
      plan("error", `${target}: symlink contains a managed contract block; remove it from the link target by hand`);
    } else {
      plan("ok", `${target} (symlink; contract managed elsewhere, merge skipped)`);
    }
    return;
  }
  mergeContract(blockFile, target, dry);
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

  const claudeMdPath = path.join(HOME, ".claude", "CLAUDE.md");
  const codexAgentsPath = path.join(HOME, ".codex", "AGENTS.md");
  const problems = [
    // Symlinked startup files are never written through, so malformed markers
    // inside a link target are reported at merge time, not as a preflight abort.
    isSymlink(claudeMdPath) ? null : contractProblem(claudeMdPath),
    isSymlink(codexAgentsPath) ? null : contractProblem(codexAgentsPath),
    jsonConfigProblem(path.join(HOME, ".claude", "settings.json")),
    jsonConfigProblem(path.join(HOME, ".codex", "hooks.json"), {
      onlyIfMatches: LOOP_HOOK_RE,
    }),
  ].filter(Boolean);
  if (problems.length) {
    process.stdout.write(`asdf agent OS install aborted (nothing written) from ${REPO}\n\n`);
    for (const p of problems) process.stdout.write(`  error   ${p}\n`);
    return 1;
  }

  for (const skill of dirs(path.join(REPO, "skills"))) {
    for (const rt of [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]) {
      const dest = path.join(rt, path.basename(skill));
      delinkInstalledSkill(skill, dest, dry);
      copyTree(skill, dest, dry);
    }
  }

  registerCommitDistribution(dry);

  // ~/.agents/skills is legacy residue only when it is NOT the live shared
  // cache; when ~/.claude/skills or ~/.codex/skills resolves into it, the
  // installer just wrote the current skills there and must not prune them.
  const agentsSkills = path.join(HOME, ".agents", "skills");
  const agentsIsLiveCache = [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]
    .some((rt) => sameFile(rt, agentsSkills));
  for (const rt of [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]) {
    backupLegacySupportDir(path.join(rt, "workflow-core"), dry);
  }
  if (!agentsIsLiveCache) backupLegacySupportDir(path.join(agentsSkills, "workflow-core"), dry);
  for (const name of WORKFLOW_SKILLS) {
    removeManagedLegacyWorkflowFile(path.join(HOME, ".claude", "commands", `${name}.md`), name, "claude", dry);
    if (agentsIsLiveCache) continue;
    const legacyCodexSkillDir = path.join(agentsSkills, name);
    removeManagedLegacyWorkflowFile(path.join(legacyCodexSkillDir, "SKILL.md"), name, "codex", dry);
    pruneEmptyDir(legacyCodexSkillDir, dry);
  }

  // Claude: the work-loop card is a user-level rules file (loaded every
  // session, same priority as user CLAUDE.md); Codex keeps the marker merge.
  copyFile(path.join(REPO, "bootstrap", "contract", "claude.md"), path.join(HOME, ".claude", "rules", "work-loop.md"), dry);
  removeContractBlock(claudeMdPath, dry);
  guardedMergeContract(path.join(REPO, "bootstrap", "contract", "codex.md"), codexAgentsPath, dry);

  copyFile(path.join(REPO, "taskloop", "bin", "taskloop.mjs"), path.join(HOME, "bin", "taskloop.mjs"), dry);
  copyFile(path.join(REPO, "bootstrap", "bin", "e2e-report-check.mjs"), path.join(HOME, "bin", "e2e-report-check.mjs"), dry);
  configureClaudeHooks(dry);
  configureCodexHooks(dry);
  configureCodexHooksJson(dry);

  const order = ["new", "update", "append", "remove", "ok", "same", "error"];
  const counts = Object.fromEntries(order.map((k) => [k, 0]));
  process.stdout.write(`asdf agent OS install ${dry ? "(dry run) " : ""}from ${REPO}\n\n`);
  for (const kind of order) {
    const rows = ACTIONS.filter(([k]) => k === kind).map(([, detail]) => detail);
    counts[kind] = rows.length;
    if (["new", "update", "append", "remove", "error"].includes(kind)) {
      for (const detail of rows) process.stdout.write(`  ${kind.padEnd(7)} ${detail}\n`);
    }
  }
  process.stdout.write(`\nsummary: ${order.map((k) => `${counts[k]} ${k}`).join(", ")}  (ok=unchanged, same=linked install)\n`);

  const modes = [];
  for (const skill of dirs(path.join(REPO, "skills")).filter((p) => exists(path.join(p, "SKILL.md")))) {
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
    "\nmanual checks after install:\n" +
      "  - PATH contains ~/bin (for taskloop.mjs)\n" +
      "  - PreToolUse/Stop hooks were written to ~/.claude/settings.json and ~/.codex/config.toml\n" +
      "  - run: node ~/bin/taskloop.mjs status  - reads the current task state, or 'no task'\n",
  );

  return counts.error ? 1 : 0;
}

process.exit(main());
