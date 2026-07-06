#!/usr/bin/env node
// Read-only, cross-platform self-check for the local agent environment.

import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const HOME = path.resolve(process.env.USERPROFILE || process.env.HOME || os.homedir());
const IS_WIN = process.platform === "win32";
const TTY = process.stdout.isTTY;
const CYAN = TTY ? "\x1b[36m" : "";
const GREEN = TTY ? "\x1b[32m" : "";
const RESET = TTY ? "\x1b[0m" : "";
let FAILURES = 0;
const LOOP_HOOK_RE = /agent-loop\.mjs/i;
const LEGACY_LOOP_HOOK_RE = /agent-workflow-hook\.(?:py|mjs)/i;
const STATE_DIR = ".agent-loop";
const RUN_CONTRACT = "run-contract.json";
const LEGACY_STATE_DIR = ".agent-workflows";

function section(title) {
  process.stdout.write(`\n${CYAN}=== ${title} ===${RESET}\n`);
}

function item(key, val) {
  process.stdout.write(`  ${key.padEnd(28)} ${val}\n`);
}

function failItem(key, val) {
  FAILURES += 1;
  item(key, `FAIL: ${val}`);
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
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    return { _invalid: err.message };
  }
}

function run(cmd, timeout = 8000) {
  try {
    const out = execFileSync(cmd[0], cmd.slice(1), {
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return String(out ?? "").trim();
  } catch (err) {
    return String(err.stdout || err.stderr || "").trim();
  }
}

function whichAll(name) {
  const exts = IS_WIN ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.PS1").split(";") : [""];
  const found = [];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, IS_WIN ? name + ext.toLowerCase() : name);
      if (!exists(p)) continue;
      let real;
      try {
        real = fs.realpathSync.native(p);
      } catch {
        real = p;
      }
      if (!found.includes(real)) found.push(real);
    }
  }
  return found;
}

function which(name) {
  return whichAll(name)[0] ?? null;
}

function versionOf(src) {
  const lower = src.toLowerCase();
  const cmd = IS_WIN && (lower.endsWith(".cmd") || lower.endsWith(".bat"))
    ? ["cmd", "/c", src, "--version"]
    : [src, "--version"];
  return run(cmd).split(/\r?\n/)[0] || "?";
}

function fileHas(p, pattern) {
  return pattern.test(readText(p));
}

function hookCommandPresent(value) {
  if (Array.isArray(value)) return value.some(hookCommandPresent);
  if (value && typeof value === "object") {
    if (LOOP_HOOK_RE.test(String(value.command ?? ""))) return true;
    return Object.values(value).some(hookCommandPresent);
  }
  return false;
}

function claudeHookEventStatus(settingsPath, event) {
  const data = readJson(settingsPath);
  if (data._invalid) return "MISSING";
  return hookCommandPresent(data.hooks?.[event]) ? "ok" : "MISSING";
}

function codexTomlHookEventBlocks(text, event) {
  const lines = text.split(/\r?\n/);
  const header = new RegExp(`^\\s*\\[\\[hooks\\.${event}\\]\\]\\s*$`);
  const childHeader = new RegExp(`^\\s*\\[\\[hooks\\.${event}\\.hooks\\]\\]\\s*$`);
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!header.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j];
      if (/^\s*\[\[hooks\./.test(line) && !childHeader.test(line)) break;
      if (/^\s*\[[^\[]/.test(line)) break;
      j += 1;
    }
    blocks.push(lines.slice(i, j).join("\n"));
  }
  return blocks;
}

function codexHookEventStatus(configPath, hooksJsonPath, event) {
  const text = readText(configPath);
  const childHeader = new RegExp(`^\\s*\\[\\[hooks\\.${event}\\.hooks\\]\\]\\s*$`, "m");
  if (codexTomlHookEventBlocks(text, event).some((block) => childHeader.test(block) && LOOP_HOOK_RE.test(block))) {
    return "ok";
  }
  const hooks = readJson(hooksJsonPath);
  return hookCommandPresent(hooks?.[event]) ? "ok" : "MISSING";
}

function workflowHookRegistrationStatus(claudeSettings, codexCfg, codexHooksJson) {
  const claudePre = claudeHookEventStatus(claudeSettings, "PreToolUse");
  const claudeStop = claudeHookEventStatus(claudeSettings, "Stop");
  const codexPre = codexHookEventStatus(codexCfg, codexHooksJson, "PreToolUse");
  const codexStop = codexHookEventStatus(codexCfg, codexHooksJson, "Stop");
  const ok = [claudePre, claudeStop, codexPre, codexStop].every((v) => v === "ok");
  return {
    ok,
    label: `claude=PreToolUse:${claudePre},Stop:${claudeStop} codex=PreToolUse:${codexPre},Stop:${codexStop}`,
  };
}

function installedSkillStatus(root, name) {
  const p = path.join(root, name, "SKILL.md");
  if (!exists(p)) return { ok: false, label: "MISSING" };
  const text = readText(p);
  const hasName = new RegExp(`^name:\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(text);
  const hasDescription = /^description:\s*.+$/m.test(text);
  return hasName && hasDescription ? { ok: true, label: "ok" } : { ok: false, label: "malformed" };
}

// ~/.agents/skills counts as legacy residue only when it is NOT the live
// shared cache: on machines where ~/.claude/skills or ~/.codex/skills is a
// symlink resolving into ~/.agents/skills, that directory IS the install
// target, so its loop skills are current managed copies, not leftovers.
function agentsSkillsIsLiveCache() {
  const agents = path.join(HOME, ".agents", "skills");
  let agentsReal;
  try {
    agentsReal = fs.realpathSync.native(agents);
  } catch {
    return false;
  }
  for (const rt of [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]) {
    try {
      if (fs.realpathSync.native(rt) === agentsReal) return true;
    } catch {
      // runtime skills dir missing; keep checking the other runtime
    }
  }
  return false;
}

function legacyWorkflowEntryStatus(name, agentsIsLiveCache) {
  const claudeCommand = path.join(HOME, ".claude", "commands", `${name}.md`);
  const codexWrapper = path.join(HOME, ".agents", "skills", name, "SKILL.md");
  const leftovers = [];
  if (exists(claudeCommand)) leftovers.push(path.relative(HOME, claudeCommand));
  if (exists(codexWrapper) && !agentsIsLiveCache) leftovers.push(path.relative(HOME, codexWrapper));
  return leftovers.length
    ? { ok: false, label: `legacy entries remain (${leftovers.join(", ")})` }
    : { ok: true, label: "ok" };
}

function pathNameContains(root, needle, maxEntries = 2000) {
  if (!exists(root)) return false;
  let count = 0;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      count += 1;
      if (count > maxEntries) return false;
      if (entry.name.toLowerCase().includes(needle)) return true;
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
    }
  }
  return false;
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

const IGNORED_DIR_PARTS = new Set(["__pycache__"]);
const IGNORED_SUFFIXES = new Set([".pyc", ".pyo"]);

function treeHash(root) {
  const h = crypto.createHash("sha256");
  for (const file of walkFiles(root)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const parts = rel.split("/");
    if (parts.some((part) => part.startsWith(".") || IGNORED_DIR_PARTS.has(part))) continue;
    if (IGNORED_SUFFIXES.has(path.extname(file))) continue;
    h.update(rel);
    h.update(fs.readFileSync(file));
  }
  return h.digest("hex");
}

function sameFile(a, b) {
  try {
    return fs.realpathSync.native(a) === fs.realpathSync.native(b);
  } catch {
    return false;
  }
}

function dirs(root) {
  if (!exists(root)) return [];
  return fs.readdirSync(root).sort().map((name) => path.join(root, name)).filter((p) => fs.statSync(p).isDirectory());
}

function sourceSkillDirs(srcRoot) {
  return dirs(srcRoot).filter((p) => exists(path.join(p, "SKILL.md")));
}

function loopSupportDirs(srcRoot) {
  return ["loop-core"].map((name) => path.join(srcRoot, name)).filter((p) => exists(path.join(p, "REFERENCE.md")));
}

function daysSinceMtime(p) {
  const ms = Date.now() - fs.statSync(p).mtimeMs;
  return Math.floor(ms / 86400000);
}

function normalizePatterns(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v) => String(v).trim())
    .map((v) => String(v).replace(/\\/g, "/").trim().replace(/^[./]+/, ""));
}

function patternPrefix(pattern) {
  const pat = String(pattern ?? "").replace(/\\/g, "/").trim().replace(/^[./]+/, "");
  const idx = pat.search(/[*?[\]]/);
  const raw = idx === -1 ? pat : pat.slice(0, idx);
  return raw.replace(/[^/]*$/, "");
}

function patternsOverlap(a, b) {
  const left = String(a ?? "").replace(/\\/g, "/").trim().replace(/^[./]+/, "");
  const right = String(b ?? "").replace(/\\/g, "/").trim().replace(/^[./]+/, "");
  if (!left || !right) return true;
  if (left === right) return true;
  if (!/[*?[\]]/.test(left) && !/[*?[\]]/.test(right)) {
    return left === right || left.startsWith(`${right.replace(/\/+$/, "")}/`) || right.startsWith(`${left.replace(/\/+$/, "")}/`);
  }
  const lp = patternPrefix(left);
  const rp = patternPrefix(right);
  if (!lp || !rp) return true;
  return lp.startsWith(rp) || rp.startsWith(lp);
}

function workflowRuntimeFindings(touch) {
  const errors = [];
  const warnings = [];
  if (!touch || touch._invalid) return { errors: [touch?._invalid || `cannot parse ${RUN_CONTRACT}`], warnings };
  if (touch.version !== 2) errors.push(`${RUN_CONTRACT} must use v2 runtime contract; recreate it with agent-loop.mjs init`);
  if (!touch.touch || typeof touch.touch !== "object") errors.push("touch must be an object");
  if (!touch.budget || typeof touch.budget !== "object") errors.push("budget must be an object");
  if (!touch.session || typeof touch.session !== "object") errors.push("session must be an object");
  if (!touch.evidence || typeof touch.evidence !== "object") errors.push("evidence must be an object");
  if (!touch.review || typeof touch.review !== "object") errors.push("review must be an object");
  if (!touch.concurrency || typeof touch.concurrency !== "object") errors.push("concurrency must be an object");
  const status = String(touch.status ?? "active");
  const terminal = String(touch.terminal_state ?? "active");
  if (status === "active" && terminal !== "active") errors.push("active status requires terminal_state active");
  if (status === "closed" && terminal === "active") errors.push("closed status requires terminal terminal_state");
  const budget = touch.budget || {};
  if (budget.network_allowed === true) warnings.push("network_allowed=true");
  if (budget.install_scripts_allowed === true) warnings.push("install_scripts_allowed=true");
  if (budget.destructive_allowed === true) warnings.push("destructive_allowed=true");
  if (String(budget.secrets_policy ?? "deny_env_dump") !== "deny_env_dump") warnings.push(`secrets_policy=${budget.secrets_policy}`);
  const concurrency = touch.concurrency || {};
  if (String(concurrency.mode ?? "exclusive") === "partitioned") {
    const claims = Array.isArray(concurrency.claims) ? concurrency.claims : [];
    if (!claims.length) errors.push("partitioned concurrency requires claims");
    const seen = new Set();
    for (const claim of claims) {
      const sid = String(claim?.session_id ?? "").trim();
      if (!sid) errors.push("partitioned claim is missing session_id");
      else if (seen.has(sid)) errors.push(`duplicate partitioned claim for ${sid}`);
      else seen.add(sid);
    }
    for (let i = 0; i < claims.length; i++) {
      const left = normalizePatterns(claims[i]?.files ?? []);
      for (let j = i + 1; j < claims.length; j++) {
        const right = normalizePatterns(claims[j]?.files ?? []);
        for (const a of left) {
          for (const b of right) {
            if (patternsOverlap(a, b)) errors.push(`partitioned claims overlap: ${a} conflicts with ${b}`);
          }
        }
      }
    }
  }
  return { errors, warnings };
}

function recentSandboxLogs() {
  const dir = path.join(HOME, ".codex");
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^sandbox.*\.log$/.test(name))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function probeTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function main() {
  section("CLI versions");
  for (const c of ["claude", "codex", "node", "python", "git", "rg"]) {
    const src = which(c);
    item(c, src ? `${versionOf(src)}  [${src}]` : "NOT FOUND");
  }
  for (const c of ["claude", "codex"]) {
    const paths = whichAll(c);
    if (paths.length > 1) item(`${c} duplicates`, `WARN: ${paths.join(" | ")}`);
  }

  section("Processes (residual detection)");
  try {
    const listing = IS_WIN ? run(["tasklist", "/FO", "CSV", "/NH"]).toLowerCase() : run(["ps", "-A", "-o", "comm="]).toLowerCase();
    for (const p of ["claude", "codex", "node"]) {
      const n = (listing.match(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      item(p, n ? `${n} running` : "none");
    }
  } catch {
    item("process scan", "unavailable on this platform");
  }

  section("Proxy / network");
  item("env HTTP_PROXY", process.env.HTTP_PROXY || process.env.http_proxy || "(unset)");
  item("env HTTPS_PROXY", process.env.HTTPS_PROXY || process.env.https_proxy || "(unset)");
  if (IS_WIN) {
    const proxy = run([
      "reg",
      "query",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
      "/v",
      "ProxyEnable",
    ]);
    item("Windows user proxy", proxy ? proxy.replace(/\s+/g, " ").trim() : "unreadable");
  } else {
    item("system proxy", "(env vars above are the effective proxy on this OS)");
  }
  item("Chrome CDP :9222", await probeTcp("127.0.0.1", 9222, 500) ? "listening" : "not listening (claude-in-chrome/playwright CDP unavailable)");

  section("Agent config presence");
  const claudeMd = path.join(HOME, ".claude", "CLAUDE.md");
  const codexAgents = path.join(HOME, ".codex", "AGENTS.md");
  const claudeSettings = path.join(HOME, ".claude", "settings.json");
  const codexCfg = path.join(HOME, ".codex", "config.toml");
  const codexHooksJson = path.join(HOME, ".codex", "hooks.json");
  const workflowHook = path.join(HOME, "bin", "agent-loop.mjs");
  item("~/.claude/settings.json", exists(claudeSettings) ? "ok" : "MISSING");
  const claudeRules = path.join(HOME, ".claude", "rules", "work-loop.md");
  item("~/.claude/rules/work-loop.md", fileHas(claudeRules, /工作循环/) ? "ok (work-loop card present)" : "WARN: work-loop card missing; run node bootstrap/install.mjs");
  if (fileHas(claudeMd, /BEGIN EXECUTION CONTRACT/)) {
    item("~/.claude/CLAUDE.md", "WARN: stale managed contract block; run node bootstrap/install.mjs to migrate it to rules/work-loop.md");
  }
  item("~/.codex/config.toml", exists(codexCfg) ? "ok" : "MISSING");
  const codexAgentsIsLink = (() => {
    try {
      return fs.lstatSync(codexAgents).isSymbolicLink();
    } catch {
      return false;
    }
  })();
  item("~/.codex/AGENTS.md", codexAgentsIsLink
    ? "ok (symlink; contract managed elsewhere)"
    : fileHas(codexAgents, /工作循环/) ? "ok (contract present)" : "WARN: no work-loop contract; run node bootstrap/install.mjs");
  item("~/bin/agent-loop.mjs", exists(workflowHook) ? "ok" : "MISSING");
  const nodePaths = whichAll("node");
  item("node runtime (for hook)", nodePaths[0] || "MISSING (agent-loop.mjs needs node)");
  const legacyWorkflowHook = fileHas(claudeSettings, LEGACY_LOOP_HOOK_RE)
    || fileHas(codexCfg, LEGACY_LOOP_HOOK_RE)
    || fileHas(codexHooksJson, LEGACY_LOOP_HOOK_RE);
  if (legacyWorkflowHook) {
    failItem("legacy loop hook", "agent-workflow-hook.py/.mjs is still registered; run node bootstrap/install.mjs");
  } else {
    item("legacy loop hook", "ok (no old hook registrations)");
  }
  const legacyContractMarker = [claudeMd, codexAgents].filter((p) => fileHas(p, /managed by asdf bootstrap\/install\.py/i));
  if (legacyContractMarker.length) {
    failItem("legacy contract marker", `${legacyContractMarker.map((p) => path.relative(HOME, p)).join(", ")} still references install.py; run node bootstrap/install.mjs`);
  } else {
    item("legacy contract marker", "ok");
  }
  const workflowHooks = workflowHookRegistrationStatus(claudeSettings, codexCfg, codexHooksJson);
  if (workflowHooks.ok) {
    item("loop hook registration", workflowHooks.label);
  } else {
    failItem("loop hook registration", workflowHooks.label);
  }
  const mcp = (readText(codexCfg).match(/^\[mcp_servers\./gm) || []).length;
  if (exists(codexCfg)) item("codex MCP servers", mcp);
  const agentsIsLiveCache = agentsSkillsIsLiveCache();
  const loopCoreClaude = exists(path.join(HOME, ".claude", "skills", "loop-core", "REFERENCE.md"));
  const loopCoreCodex = exists(path.join(HOME, ".codex", "skills", "loop-core", "REFERENCE.md"));
  if (loopCoreClaude && loopCoreCodex) {
    item("loop-core support", "claude=ok codex=ok");
  } else {
    failItem("loop-core support", `claude=${loopCoreClaude ? "ok" : "MISSING"} codex=${loopCoreCodex ? "ok" : "MISSING"}`);
  }
  const legacyWorkflowCoreRoots = [path.join(HOME, ".claude", "skills", "workflow-core"), path.join(HOME, ".codex", "skills", "workflow-core")];
  if (!agentsIsLiveCache) legacyWorkflowCoreRoots.push(path.join(HOME, ".agents", "skills", "workflow-core"));
  const legacyWorkflowCore = legacyWorkflowCoreRoots
    .filter((p) => exists(path.join(p, "REFERENCE.md")));
  if (legacyWorkflowCore.length) {
    failItem("legacy workflow-core support", `${legacyWorkflowCore.map((p) => path.relative(HOME, p)).join(", ")} remains; run node bootstrap/install.mjs`);
  } else {
    item("legacy workflow-core support", "ok");
  }
  for (const f of ["loop", "land", "fixloop", "converge"]) {
    const claudeSkill = installedSkillStatus(path.join(HOME, ".claude", "skills"), f);
    const codexSkill = installedSkillStatus(path.join(HOME, ".codex", "skills"), f);
    const skillStatus = `claude=${claudeSkill.label} codex=${codexSkill.label}`;
    if (claudeSkill.ok && codexSkill.ok) item(`skill ${f}`, skillStatus);
    else failItem(`skill ${f}`, skillStatus);
    const legacy = legacyWorkflowEntryStatus(f, agentsIsLiveCache);
    if (legacy.ok) item(`legacy ${f}`, legacy.label);
    else failItem(`legacy ${f}`, legacy.label);
  }
  const goalMarkers = [
    path.join(HOME, ".claude", "commands", "goal.md"),
    path.join(HOME, ".agents", "skills", "goal", "SKILL.md"),
  ];
  const ralphFound = pathNameContains(path.join(HOME, ".claude", "plugins"), "ralph-loop")
    || pathNameContains(path.join(HOME, ".codex", "plugins", "cache"), "ralph-loop");
  if (goalMarkers.some(exists)) item("loop driver dependency", "ok (/goal marker found)");
  else if (ralphFound) item("loop driver dependency", "ok (ralph-loop marker found)");
  else item("loop driver dependency", "WARN: loop skill needs /goal or ralph-loop for autonomous re-feed; no local marker found");
  if (fileHas(path.join(HOME, ".claude", "settings.json"), /"skipDangerousModePermissionPrompt"\s*:\s*true/)) {
    item("skipDangerousPrompt", "WARN: true - dangerous-mode confirmations are skipped (weakens the only prompt-layer friction on scope drift)");
  }
  const reviewer = readText(codexCfg).match(/approvals_reviewer\s*=\s*"([^"]+)"/);
  if (reviewer) {
    const ar = reviewer[1];
    let note;
    if (ar === "user" || ar === "auto_review") note = `ok (${ar})`;
    else if (ar === "guardian_subagent") note = "ok (guardian_subagent - legacy alias of auto_review, still accepted; prefer migrating to auto_review)";
    else note = `WARN: '${ar}' is not in the documented value set (user/auto_review, legacy guardian_subagent) - verify against official Codex docs whether this reviewer actually runs; the AGENTS.md Guardian criteria only bind if the approvals layer is live`;
    item("approvals_reviewer", note);
  }

  section("Skill drift (source vs installed)");
  const repo = path.resolve(process.env.ASDF_REPO || path.join(HOME, "Desktop", "asdf"));
  const srcRoot = path.join(repo, "skills");
  if (exists(srcRoot)) {
    const linked = new Set();
    const copied = new Set();
    for (const sk of [...sourceSkillDirs(srcRoot), ...loopSupportDirs(srcRoot)]) {
      for (const rt of [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]) {
        const inst = path.join(rt, path.basename(sk));
        if (!exists(inst)) continue;
        if (treeHash(sk) !== treeHash(inst)) failItem(`${path.basename(sk)} -> ${rt}`, "DRIFT");
        const probeSrc = path.join(sk, "SKILL.md");
        const probeInst = path.join(inst, "SKILL.md");
        if (exists(probeSrc) && exists(probeInst)) {
          (sameFile(probeSrc, probeInst) ? linked : copied).add(path.basename(sk));
        } else {
          copied.add(path.basename(sk));
        }
      }
    }
    item("linked installs", [...linked].sort().join(", "));
    item("copied installs", `${[...copied].sort().join(", ")}  <- re-run install.mjs after source edits`);
    item("drift scan", "done (DRIFT is a failed post-install check)");
  } else {
    item("drift scan", `WARN: source repo not found at ${srcRoot} (set ASDF_REPO env var); scan skipped`);
  }

  section("Loop health review");
  const loopHealth = path.join(repo, "docs", "research", "loop-health.txt");
  if (exists(loopHealth)) {
    const age = daysSinceMtime(loopHealth);
    const note = age > 35 ? " - WARN: monthly review due (run scripts/analyze-sessions.py)" : "";
    item("loop-health.txt", `age ${age} days${note}`);
  } else {
    item("loop-health.txt", "missing - run scripts/analyze-sessions.py to create the baseline");
  }
  // Read-only probe: is the monthly meta-loop registered with the OS scheduler,
  // or does it still run on a human clock? Optional either way — this never
  // fails the doctor, it only surfaces the gap.
  const schedProbeName = IS_WIN ? "schtasks" : "crontab";
  const schedProbe = which(schedProbeName);
  if (!schedProbe) {
    item("meta-loop schedule", `unknown - ${schedProbeName} not on PATH; if wanted, register the monthly meta-loop manually (see bootstrap/README.md)`);
  } else {
    const schedOut = IS_WIN ? run([schedProbe, "/query", "/tn", "asdf-meta-loop"]) : run([schedProbe, "-l"]);
    item(
      "meta-loop schedule",
      /asdf-meta-loop|analyze-sessions/i.test(schedOut)
        ? "registered"
        : "WARN: not registered - the monthly meta-loop still relies on a human clock; optional, see bootstrap/README.md for schtasks/crontab one-liners",
    );
  }
  section("Agent loop runtime contract");
  const workflowState = path.join(repo, STATE_DIR, RUN_CONTRACT);
  if (exists(workflowState)) {
    const touch = readJson(workflowState);
    const findings = workflowRuntimeFindings(touch);
    if (findings.errors.length) {
      failItem(`${STATE_DIR}/${RUN_CONTRACT}`, findings.errors.join("; "));
    } else {
      item(`${STATE_DIR}/${RUN_CONTRACT}`, `ok (v2, ${touch.status}/${touch.terminal_state})`);
    }
    item("runtime safety budget", findings.warnings.length ? `WARN: ${findings.warnings.join(", ")}` : "ok");
  } else {
    item(`${STATE_DIR}/${RUN_CONTRACT}`, "absent");
  }
  if (exists(path.join(repo, LEGACY_STATE_DIR))) {
    failItem(LEGACY_STATE_DIR, `legacy runtime state present; run node ~/bin/agent-loop.mjs status --repo "${repo}" to migrate`);
  }
  if (exists(path.join(repo, ".git"))) {
    const trackedWorkflow = run(["git", "-C", repo, "ls-files", STATE_DIR, LEGACY_STATE_DIR], 3000);
    if (trackedWorkflow.trim()) {
      failItem("agent loop state tracked", trackedWorkflow.replace(/\r?\n/g, ", "));
    } else {
      item("agent loop state tracked", "ok (private state not tracked)");
    }
  } else {
    item("agent loop state tracked", "skipped (repo is not a git checkout)");
  }

  section("Disk");
  try {
    const usage = fs.statfsSync(HOME);
    const free = usage.bavail * usage.bsize / 2 ** 30;
    const total = usage.blocks * usage.bsize / 2 ** 30;
    item(`${path.parse(HOME).root || "/"} free`, `${free.toFixed(1)} GB free / ${total.toFixed(1)} GB total`);
  } catch {
    item("disk", "unreadable");
  }

  section("Recent sandbox errors (codex)");
  const logs = recentSandboxLogs();
  if (logs.length) {
    const newest = logs[0];
    const errs = readText(newest).split(/\r?\n/).filter((line) => /SetTokenInformation|error/.test(line));
    item(path.basename(newest), errs.length ? `last errors: ${errs.length} (see file)` : "clean");
  } else {
    item("sandbox log", "none");
  }

  if (FAILURES) {
    process.stdout.write(`\nDone. Read-only check; nothing was changed. ${FAILURES} failure(s) found.\n`);
    return 1;
  }
  process.stdout.write(`\n${GREEN}Done. Read-only check; nothing was changed.${RESET}\n`);
  return 0;
}

process.exit(await main());
