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

function section(title) {
  process.stdout.write(`\n${CYAN}=== ${title} ===${RESET}\n`);
}

function item(key, val) {
  process.stdout.write(`  ${key.padEnd(28)} ${val}\n`);
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

function codexCommandSkillStatus(name) {
  const p = path.join(HOME, ".agents", "skills", name, "SKILL.md");
  if (!exists(p)) return "MISSING";
  const text = readText(p);
  const hasName = new RegExp(`^name:\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(text);
  const hasDescription = /^description:\s*.+$/m.test(text);
  return hasName && hasDescription ? "ok" : "WARN: malformed";
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

function daysSinceMtime(p) {
  const ms = Date.now() - fs.statSync(p).mtimeMs;
  return Math.floor(ms / 86400000);
}

function parseUtc(ts) {
  const ms = Date.parse(String(ts));
  return Number.isNaN(ms) ? null : ms / 1000;
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
  const codexCfg = path.join(HOME, ".codex", "config.toml");
  const workflowHook = path.join(HOME, "bin", "agent-workflow-hook.mjs");
  item("~/.claude/settings.json", exists(path.join(HOME, ".claude", "settings.json")) ? "ok" : "MISSING");
  item("~/.claude/CLAUDE.md", fileHas(claudeMd, /Execution Contract/) ? "ok (contract present)" : "WARN: no Execution Contract section");
  item("~/.codex/config.toml", exists(codexCfg) ? "ok" : "MISSING");
  item("~/.codex/AGENTS.md", fileHas(codexAgents, /Execution Contract/) ? "ok (contract present)" : "WARN: no Execution Contract section");
  item("~/bin/agent-workflow-hook.mjs", exists(workflowHook) ? "ok" : "MISSING");
  const nodePaths = whichAll("node");
  item("node runtime (for hook)", nodePaths[0] || "MISSING (agent-workflow-hook.mjs needs node)");
  const claudeWorkflowHook = fileHas(path.join(HOME, ".claude", "settings.json"), /agent-workflow-hook\.mjs/);
  const codexWorkflowHook = fileHas(codexCfg, /agent-workflow-hook\.mjs/) || fileHas(path.join(HOME, ".codex", "hooks.json"), /agent-workflow-hook\.mjs/);
  item("workflow hook registration", `claude=${claudeWorkflowHook ? "ok" : "MISSING"} codex=${codexWorkflowHook ? "ok" : "MISSING"}`);
  const mcp = (readText(codexCfg).match(/^\[mcp_servers\./gm) || []).length;
  if (exists(codexCfg)) item("codex MCP servers", mcp);
  for (const f of ["loop", "land", "fixloop", "converge"]) {
    const cc = exists(path.join(HOME, ".claude", "commands", `${f}.md`));
    const cx = codexCommandSkillStatus(f);
    item(`cmd /${f}`, `claude=${cc ? "ok" : "MISSING"} codex_skill=${cx}`);
  }
  const goalMarkers = [
    path.join(HOME, ".claude", "commands", "goal.md"),
    path.join(HOME, ".agents", "skills", "goal", "SKILL.md"),
  ];
  const ralphFound = pathNameContains(path.join(HOME, ".claude", "plugins"), "ralph-loop")
    || pathNameContains(path.join(HOME, ".codex", "plugins", "cache"), "ralph-loop");
  if (goalMarkers.some(exists)) item("loop driver dependency", "ok (/goal marker found)");
  else if (ralphFound) item("loop driver dependency", "ok (ralph-loop marker found)");
  else item("loop driver dependency", "WARN: /loop needs /goal or ralph-loop for autonomous re-feed; no local marker found");
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
    for (const sk of dirs(srcRoot)) {
      for (const rt of [path.join(HOME, ".claude", "skills"), path.join(HOME, ".codex", "skills")]) {
        const inst = path.join(rt, path.basename(sk));
        if (!exists(inst)) continue;
        if (treeHash(sk) !== treeHash(inst)) item(`${path.basename(sk)} -> ${rt}`, "DRIFT");
        const probeSrc = path.join(sk, "SKILL.md");
        const probeInst = path.join(inst, "SKILL.md");
        (exists(probeSrc) && exists(probeInst) && sameFile(probeSrc, probeInst) ? linked : copied).add(path.basename(sk));
      }
    }
    item("linked installs", [...linked].sort().join(", "));
    item("copied installs", `${[...copied].sort().join(", ")}  <- re-run install.mjs after source edits`);
    item("drift scan", "done (only DRIFT lines above are problems)");
  } else {
    item("drift scan", `WARN: source repo not found at ${srcRoot} (set ASDF_REPO env var); scan skipped`);
  }

  section("Loop health review");
  const loopHealth = path.join(repo, "docs", "research", "loop-health.txt");
  if (exists(loopHealth)) {
    const age = daysSinceMtime(loopHealth);
    const note = age > 35 ? " - WARN: monthly review due (run analyze-sessions.py)" : "";
    item("loop-health.txt", `age ${age} days${note}`);
  } else {
    item("loop-health.txt", "missing - run docs/research/2026-07-02-analyze-sessions.py to create the baseline");
  }
  const metaCli = path.join(HOME, "bin", "meta-loop.mjs");
  item("~/bin/meta-loop.mjs", exists(metaCli) ? "ok" : "MISSING (run install.mjs)");
  const backlog = path.join(repo, "docs", "meta-loop", "backlog.jsonl");
  if (exists(backlog)) {
    const counts = {};
    let stale = 0;
    for (const raw of readText(backlog).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const st = String(row.status ?? "pending");
      counts[st] = (counts[st] ?? 0) + 1;
      if (st === "in_progress") {
        const claimed = parseUtc(row.claimed_at);
        if (claimed !== null && Date.now() / 1000 - claimed > 6 * 3600) stale += 1;
      }
    }
    const summary = Object.keys(counts).sort().map((k) => `${k}:${counts[k]}`).join(" ") || "empty";
    const note = stale ? ` - WARN: ${stale} stale claim(s), a prior round likely crashed` : "";
    item("meta-loop backlog", `${summary}${note}`);
  } else {
    item("meta-loop backlog", "absent (no candidates enqueued yet)");
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

  process.stdout.write(`\n${GREEN}Done. Read-only check; nothing was changed.${RESET}\n`);
  return 0;
}

process.exit(await main());
