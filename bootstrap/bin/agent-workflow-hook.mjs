#!/usr/bin/env node
// PreToolUse/Stop hook for project-local agent workflow state.
//
// The hook is intentionally conservative and dependency-free (node:* builtins
// only, Node 18+). Node is chosen over Python because every machine that runs
// Claude Code or Codex already has Node — the hook adds zero extra runtime
// dependencies. It only records state when a repository already opted in with
// `.agent-workflows/` or an active `.agent-workflows/touch-list.json`, so
// global hook registration does not create files in every directory an agent
// visits.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync, execSync } from "node:child_process";
import { parseArgs } from "node:util";

const STATE_DIR = ".agent-workflows";
const TOUCH_LIST = "touch-list.json";
const LEDGER = "evidence-ledger.jsonl";
const VALID_STATUSES = new Set(["active", "closed", "paused"]);
const VALID_ENFORCEMENT = new Set(["off", "warn", "strict"]);
const VALID_UNKNOWN_WRITE_POLICY = new Set(["warn", "deny"]);
const SCOPE_FIELDS = ["files", "tables", "interfaces"];
// Criterion gate defaults. The consecutive-block cap mirrors Claude Code's
// native 8-consecutive-block Stop-hook override and is the sole release
// trigger, so the hook owns the limit itself (Codex has no native cap).
// It counts CONSECUTIVE red stops and resets on any green, so a healthy long
// loop that reds intermittently is never disarmed — only a genuinely stuck
// loop (cap reds in a row) releases. gate_blocks_total is lifetime telemetry
// only, never a release trigger.
const GATE_BLOCK_CAP = 8;
const CRITERION_TIMEOUT_SECONDS = 300;

const FILE_FIELD_NAMES = [
  "file_path",
  "filepath",
  "path",
  "target_file",
  "filename",
  "absolute_path",
];
const COMMAND_FIELD_NAMES = ["command", "cmd", "script"];
const SQL_FIELD_NAMES = ["query", "sql", "statement"];
const INTERFACE_FIELD_NAMES = ["service", "interface", "method", "endpoint", "url"];
const WRITE_TOOL_NAMES = new Set([
  "write",
  "edit",
  "multiedit",
  "apply_patch",
  "notebookedit",
  "update_file",
  "create_file",
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadStdinJson() {
  if (process.stdin.isTTY) return {};
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    return {};
  }
  if (!raw.trim()) return {};
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
  return isPlainObject(data) ? data : { payload: data };
}

function normalizeEvent(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function eventName(payload, override) {
  if (override) return normalizeEvent(override);
  for (const key of ["hook_event_name", "event", "hook", "type"]) {
    if (payload[key]) return normalizeEvent(payload[key]);
  }
  return "";
}

function pickMapping(value) {
  return isPlainObject(value) ? value : {};
}

function toolInput(payload) {
  for (const key of ["tool_input", "input", "arguments", "params"]) {
    const mapping = pickMapping(payload[key]);
    if (Object.keys(mapping).length) return mapping;
  }
  return {};
}

function toolName(payload) {
  for (const key of ["tool_name", "tool", "name"]) {
    if (payload[key]) return String(payload[key]);
  }
  return "";
}

function expandUser(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function cwdFromPayload(payload) {
  for (const key of ["cwd", "workspace_root", "working_directory", "repo_root"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return expandUser(value);
  }
  return process.cwd();
}

// Path.resolve(strict=False) equivalent: resolve symlinks on the existing
// prefix, keep the non-existing tail normalized.
function resolveBest(p) {
  const abs = path.resolve(String(p));
  const tail = [];
  let cur = abs;
  for (;;) {
    try {
      const real = fs.realpathSync(cur);
      return tail.length ? path.join(real, ...tail) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

function gitRoot(cwd) {
  try {
    const out = execFileSync("git", ["-C", String(cwd), "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const root = out.trim();
    if (root) return resolveBest(root);
  } catch {
    // fall through to cwd
  }
  return resolveBest(cwd);
}

// Use the nearest opted-in workflow root, falling back to the git root.
function workflowRoot(cwd) {
  const root = gitRoot(cwd);
  let current;
  try {
    current = resolveBest(cwd);
  } catch {
    return root;
  }
  for (;;) {
    if (fs.existsSync(path.join(current, STATE_DIR))) return current;
    const parent = path.dirname(current);
    if (current === root || parent === current) return root;
    current = parent;
  }
}

function loadTouchList(repo) {
  const file = path.join(repo, STATE_DIR, TOUCH_LIST);
  if (!fs.existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {
      version: 1,
      status: "active",
      enforcement: "strict",
      files: [],
      _invalid: `cannot parse ${file}`,
    };
  }
  return isPlainObject(data) ? data : null;
}

function isAbsolutePattern(value) {
  return path.isAbsolute(value) || /^[A-Za-z]:[/\\]/.test(value);
}

function validateTouchList(touch) {
  if (touch === null) return ["missing touch-list.json"];
  const errors = [];
  if (touch._invalid) errors.push(String(touch._invalid));
  if (touch.version !== 1) errors.push("version must be 1");
  const status = String(touch.status ?? "active").toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    errors.push(`status must be one of ${JSON.stringify([...VALID_STATUSES].sort())}`);
  }
  const enforcement = String(touch.enforcement ?? "warn").toLowerCase();
  if (!VALID_ENFORCEMENT.has(enforcement)) {
    errors.push(`enforcement must be one of ${JSON.stringify([...VALID_ENFORCEMENT].sort())}`);
  }
  const unknown = String(touch.unknown_write_policy ?? "warn").toLowerCase();
  if (!VALID_UNKNOWN_WRITE_POLICY.has(unknown)) {
    errors.push(
      `unknown_write_policy must be one of ${JSON.stringify([...VALID_UNKNOWN_WRITE_POLICY].sort())}`,
    );
  }
  for (const field of SCOPE_FIELDS) {
    const value = touch[field] ?? [];
    if (!Array.isArray(value)) {
      errors.push(`${field} must be a list`);
      continue;
    }
    for (const item of value) {
      if (typeof item !== "string" || !item.trim()) {
        errors.push(`${field} entries must be non-empty strings`);
        continue;
      }
      const normalized = item.replace(/\\/g, "/").trim();
      if (normalized.startsWith("../") || normalized === "..") {
        errors.push(`${field} entry must not escape repo: ${item}`);
      }
      if (field === "files" && isAbsolutePattern(item)) {
        errors.push(`files entry must be repo-relative, not absolute: ${item}`);
      }
    }
  }
  if (status === "active") {
    const hasScope = SCOPE_FIELDS.some((field) => normalizePatterns(touch[field]).length > 0);
    if ((enforcement === "warn" || enforcement === "strict") && !hasScope) {
      errors.push("active touch-list must include at least one files/tables/interfaces entry");
    }
    if (!String(touch.criterion ?? "").trim()) {
      errors.push("active touch-list must include criterion");
    }
  }
  return dedupe(errors);
}

function stateEnabled(repo, touch) {
  if (touch !== null) return true;
  try {
    return fs.statSync(path.join(repo, STATE_DIR)).isDirectory();
  } catch {
    return false;
  }
}

function shouldEnforce(touch) {
  if (!touch) return false;
  return String(touch.status ?? "active").toLowerCase() === "active";
}

function enforcementMode(touch) {
  const mode = String((touch ?? {}).enforcement ?? "warn").toLowerCase();
  return VALID_ENFORCEMENT.has(mode) ? mode : "warn";
}

function utcNow() {
  return new Date().toISOString().slice(0, 19) + "Z";
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
}

function jsonSorted(value) {
  return JSON.stringify(sortDeep(value));
}

function appendLedger(repo, event) {
  const state = path.join(repo, STATE_DIR);
  fs.mkdirSync(state, { recursive: true });
  if (event.ts === undefined) event.ts = utcNow();
  fs.appendFileSync(path.join(state, LEDGER), jsonSorted(event) + "\n", "utf8");
}

function readLedger(repo, limit = 5) {
  const file = path.join(repo, STATE_DIR, LEDGER);
  if (!fs.existsSync(file)) return [];
  let lines;
  try {
    lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.length);
  } catch {
    return [];
  }
  const rows = [];
  for (const line of lines.slice(-limit)) {
    let data;
    try {
      data = JSON.parse(line);
    } catch {
      data = { unparseable: line };
    }
    rows.push(isPlainObject(data) ? data : { payload: data });
  }
  return rows;
}

function stringFieldValues(mapping, names) {
  const found = [];
  const visit = (value) => {
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (names.includes(key.toLowerCase()) && typeof child === "string" && child.trim()) {
        found.push(child.trim());
      }
      if (isPlainObject(child)) visit(child);
      else if (Array.isArray(child)) for (const item of child) visit(item);
    }
  };
  visit(mapping);
  return found;
}

function commandValues(mapping) {
  return stringFieldValues(mapping, COMMAND_FIELD_NAMES);
}

function patchPaths(command) {
  const paths = [];
  const patterns = [
    /^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$/,
    /^---\s+(?:a\/)?(.+)$/,
    /^\+\+\+\s+(?:b\/)?(.+)$/,
  ];
  for (const line of command.split(/\r?\n/)) {
    const trimmed = line.trim();
    for (const pat of patterns) {
      const match = trimmed.match(pat);
      if (match) {
        const value = match[1].trim();
        if (value !== "/dev/null") paths.push(value);
      }
    }
  }
  return paths;
}

function shellRedirectionPaths(command) {
  // Best-effort only. Complex shell parsing belongs in tests or explicit
  // touch-list declarations, not in a global hook.
  const paths = [];
  const re = /(?:>|>>|Out-File\s+-FilePath|Set-Content\s+-Path|Add-Content\s+-Path)\s+(['"]?)([^'"\s|;&]+)\1/gi;
  for (const match of command.matchAll(re)) paths.push(match[2]);
  return paths;
}

function fileTargets(tool, mapping) {
  const targets = stringFieldValues(mapping, FILE_FIELD_NAMES);
  for (const command of commandValues(mapping)) {
    targets.push(...patchPaths(command));
    targets.push(...shellRedirectionPaths(command));
  }
  return dedupe(targets);
}

function sqlTargets(mapping) {
  const targets = [];
  for (const sql of stringFieldValues(mapping, SQL_FIELD_NAMES)) {
    if (!/\b(insert|update|delete|merge|drop|truncate|alter|create)\b/i.test(sql)) continue;
    const re = /\b(?:into|update|from|table|alter\s+table|truncate\s+table)\s+([A-Za-z_][\w.$-]*)/gi;
    for (const match of sql.matchAll(re)) targets.push(match[1]);
  }
  return dedupe(targets);
}

function interfaceTargets(mapping) {
  return dedupe(stringFieldValues(mapping, INTERFACE_FIELD_NAMES));
}

function dedupe(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const norm = value.trim();
    if (norm && !seen.has(norm)) {
      out.push(norm);
      seen.add(norm);
    }
  }
  return out;
}

function looksLikeWrite(tool, mapping) {
  const compact = tool.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (WRITE_TOOL_NAMES.has(compact)) return true;
  if (compact.includes("write") || compact.includes("edit") || compact.includes("patch")) return true;
  for (const command of commandValues(mapping)) {
    if (
      /(\*\*\* (?:Add|Update|Delete) File:|>|>>|\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|rm|mv|cp)\b)/i.test(
        command,
      )
    ) {
      return true;
    }
  }
  return sqlTargets(mapping).length > 0;
}

function normalizePatterns(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v) => String(v).trim())
    .map((v) => String(v).replace(/\\/g, "/").trim().replace(/^[./]+/, ""));
}

function pathRelation(repo, raw) {
  raw = raw.trim().replace(/^['"]+/, "").replace(/['"]+$/, "");
  if (!raw) return [null, null];
  const expanded = expandUser(raw);
  const candidate = path.isAbsolute(expanded) ? expanded : path.join(repo, expanded);
  let resolved;
  let rel;
  try {
    resolved = resolveBest(candidate);
    rel = path.relative(resolveBest(repo), resolved);
  } catch {
    return [null, String(candidate)];
  }
  if (!rel || rel === "." ) rel = ".";
  if (rel.startsWith("..") || path.isAbsolute(rel)) return [null, String(candidate)];
  return [rel.split(path.sep).join("/"), String(resolved)];
}

// Minimal fnmatch.fnmatchcase equivalent: *, ?, [seq], [!seq].
function globToRegExp(pat) {
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "*") {
      re += "[\\s\\S]*";
    } else if (c === "?") {
      re += "[\\s\\S]";
    } else if (c === "[") {
      let j = i + 1;
      if (pat[j] === "!") j++;
      if (pat[j] === "]") j++;
      while (j < pat.length && pat[j] !== "]") j++;
      if (j >= pat.length) {
        re += "\\[";
      } else {
        let stuff = pat.slice(i + 1, j).replace(/\\/g, "\\\\");
        if (stuff[0] === "!") stuff = "^" + stuff.slice(1);
        else if (stuff[0] === "^") stuff = "\\" + stuff;
        re += "[" + stuff + "]";
        i = j;
      }
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + re + "$");
}

function fnmatchcase(name, pat) {
  return globToRegExp(pat).test(name);
}

function patternMatches(rel, pattern) {
  const pat = pattern.replace(/\\/g, "/").trim().replace(/^[./]+/, "");
  if (!pat) return false;
  if (pat === STATE_DIR || pat === `${STATE_DIR}/**`) {
    return rel === STATE_DIR || rel.startsWith(`${STATE_DIR}/`);
  }
  if (/[*?[\]]/.test(pat)) return fnmatchcase(rel, pat);
  return rel === pat || rel.startsWith(pat.replace(/\/+$/, "") + "/");
}

function allowedFile(repo, raw, patterns) {
  const [rel, _absolute] = pathRelation(repo, raw);
  if (rel === null) return [false, `target outside repo: ${raw}`];
  if (rel === STATE_DIR || rel.startsWith(`${STATE_DIR}/`)) return [true, rel];
  if (!patterns.length) return [false, `no file touch-list entries allow ${rel}`];
  if (patterns.some((pat) => patternMatches(rel, pat))) return [true, rel];
  return [false, rel];
}

function allowedName(raw, patterns) {
  const value = raw.trim();
  return patterns.some((pat) => fnmatchcase(value, pat));
}

function ledgerBase(payload, repo, event, tool) {
  return {
    evidence_kind: "workflow_hook",
    event,
    repo: String(repo),
    session_id: (payload.session_id || payload.conversation_id) ?? null,
    tool,
  };
}

function deny(message) {
  const response = {
    decision: "deny",
    permissionDecision: "deny",
    reason: message,
    message,
  };
  process.stdout.write(JSON.stringify(response) + "\n");
  process.stderr.write(message + "\n");
  return 2;
}

// Stop-hook block: exit 2 + stderr is the shared Claude Code / Codex protocol
// ("decision": "block" forces continuation; stderr becomes model feedback).
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
  process.stderr.write(reason + "\n");
  return 2;
}

function checkPretool(payload, repo, touch) {
  const tool = toolName(payload);
  const mapping = toolInput(payload);
  if (!stateEnabled(repo, touch)) return 0;

  const mode = enforcementMode(touch);
  const validationErrors = validateTouchList(touch);
  const files = normalizePatterns((touch ?? {}).files);
  const tables = normalizePatterns((touch ?? {}).tables);
  const interfaces = normalizePatterns((touch ?? {}).interfaces);
  const base = ledgerBase(payload, repo, "PreToolUse", tool);

  if (shouldEnforce(touch) && validationErrors.length) {
    const reason = "invalid touch-list: " + validationErrors.join("; ");
    appendLedger(repo, { ...base, decision: "deny", reason });
    return deny(reason);
  }

  if (!shouldEnforce(touch) || mode === "off") {
    appendLedger(repo, { ...base, decision: "observe" });
    return 0;
  }

  const failures = [];
  const fileResults = [];
  for (const raw of fileTargets(tool, mapping)) {
    const [ok, detail] = allowedFile(repo, raw, files);
    fileResults.push({ target: raw, resolved: detail, allowed: ok });
    if (!ok) failures.push(`file ${detail}`);
  }

  const tableTargets = sqlTargets(mapping);
  for (const target of tableTargets) {
    if (tables.length && !allowedName(target, tables)) failures.push(`table ${target}`);
    else if (!tables.length) failures.push(`table ${target} (no table touch-list entries)`);
  }

  const rpcTargets = interfaceTargets(mapping);
  for (const target of rpcTargets) {
    if (interfaces.length && !allowedName(target, interfaces)) failures.push(`interface ${target}`);
  }

  const unknownWrite =
    looksLikeWrite(tool, mapping) && !(fileResults.length || tableTargets.length || rpcTargets.length);
  if (unknownWrite && String((touch ?? {}).unknown_write_policy ?? "warn").toLowerCase() === "deny") {
    failures.push("unknown write target");
  }

  const targets = {
    files: fileResults,
    tables: tableTargets,
    interfaces: rpcTargets,
    unknown_write: unknownWrite,
  };
  if (failures.length) {
    const decision = mode === "strict" ? "deny" : "warn";
    appendLedger(repo, { ...base, decision, reason: failures.join("; "), targets });
    if (mode === "strict") {
      return deny(
        "agent workflow touch-list denied target(s): " +
          failures.join("; ") +
          `. Update ${STATE_DIR}/${TOUCH_LIST} or narrow the tool call.`,
      );
    }
    return 0;
  }

  appendLedger(repo, { ...base, decision: "allow", targets });
  return 0;
}

function touchListPath(repo) {
  return path.join(repo, STATE_DIR, TOUCH_LIST);
}

function intField(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasShellSyntax(command) {
  return /[|&;<>\n\r]/.test(command);
}

function splitSimpleCommand(command) {
  const args = [];
  let current = "";
  let quote = null;
  const text = command.trim();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && text[i + 1] === quote) {
        current += text[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (quote) return null;
  if (current) args.push(current);
  return args.length ? args : null;
}

// Run the declared completion criterion. Executing it grants the agent no new
// capability (the agent can already run commands); the gate only turns the
// criterion the loop templates require into a machine verdict at Stop time.
function runCriterion(criterion, repo, timeoutSec) {
  const opts = {
    cwd: repo,
    encoding: "utf8",
    timeout: timeoutSec * 1000,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  };
  const argv = hasShellSyntax(criterion) ? null : splitSimpleCommand(criterion);
  try {
    const stdout = argv
      ? execFileSync(argv[0], argv.slice(1), opts)
      : execSync(criterion, opts);
    return { verdict: "pass", exit: 0, output: String(stdout ?? "") };
  } catch (err) {
    const output = String(err.stdout ?? "") + String(err.stderr ?? "");
    if (err.signal || err.code === "ETIMEDOUT") {
      return { verdict: "fail", exit: null, output, detail: `timed out or killed after ${timeoutSec}s` };
    }
    const status = typeof err.status === "number" ? err.status : null;
    if (status === null || status === 126 || status === 127) {
      return { verdict: "not_executable", exit: status, output, detail: `command not executable (exit ${status ?? "spawn error"})` };
    }
    return { verdict: "fail", exit: status, output };
  }
}

function outputTail(text, limit = 2000) {
  const trimmed = String(text ?? "").trim();
  return trimmed.length > limit ? "..." + trimmed.slice(-limit) : trimmed;
}

// Criterion gate: the machine-side stop verdict. Prose contracts stay
// advisory; this makes "green before stop" deterministic in strict mode.
// warn mode runs the criterion and records the verdict without blocking
// (grayscale before flipping to strict). Degrade paths never trap a session:
// unreadable state, non-executable criterion, session mismatch, cap and fuse
// all release the stop with a ledger record instead of blocking forever.
function checkStop(payload, repo, touch) {
  if (!stateEnabled(repo, touch)) return 0;
  const base = {
    ...ledgerBase(payload, repo, "Stop", toolName(payload)),
    status: (payload.status || payload.stop_reason) ?? null,
    stop_hook_active: payload.stop_hook_active ?? null,
  };
  const mode = enforcementMode(touch);
  if (!shouldEnforce(touch) || mode === "off") {
    appendLedger(repo, { ...base, decision: "observe" });
    return 0;
  }
  if (touch._invalid) {
    // Unparseable state cannot be safely persisted or gated; PreToolUse
    // already fails closed on it, so blocking the stop too would only trap.
    appendLedger(repo, { ...base, decision: "warn", reason: String(touch._invalid) });
    return 0;
  }

  // Session binding: the touch-list belongs to the loop that first ran under
  // it. A stale active touch-list (abandoned loop, Esc-interrupted session)
  // must not gate an unrelated session's stops.
  const sid = (payload.session_id || payload.conversation_id) ?? null;
  if (touch.session_id && sid && touch.session_id !== sid) {
    appendLedger(repo, {
      ...base,
      decision: "warn",
      reason: `session mismatch: touch-list bound to ${touch.session_id}; close or re-init it for this session`,
    });
    return 0;
  }
  if (!touch.session_id && sid) {
    touch.session_id = sid;
    writeJson(touchListPath(repo), touch);
  }

  const validationErrors = validateTouchList(touch);
  const criterion = String(touch.criterion ?? "").trim();
  const cap = intField(touch.gate_block_cap, GATE_BLOCK_CAP);
  const timeoutSec = intField(touch.criterion_timeout_seconds, CRITERION_TIMEOUT_SECONDS);

  let verdict;
  if (validationErrors.length) {
    verdict = { verdict: "fail", exit: null, output: "invalid touch-list: " + validationErrors.join("; ") };
  } else {
    verdict = runCriterion(criterion, repo, timeoutSec);
  }

  if (verdict.verdict === "pass") {
    touch.gate_blocks = 0;
    writeJson(touchListPath(repo), touch);
    appendLedger(repo, { ...base, decision: "allow", reason: "criterion passed", criterion_exit: 0 });
    return 0;
  }

  if (verdict.verdict === "not_executable") {
    appendLedger(repo, {
      ...base,
      decision: "warn",
      reason: `criterion not executable: ${verdict.detail}; fix the criterion or close the touch-list`,
      criterion_exit: verdict.exit,
    });
    return 0;
  }

  // Red criterion. Count consecutive blocks first so the cap holds even if a
  // runtime lacks a native override. gate_blocks_total is lifetime telemetry
  // and never gates a release (a long healthy loop reds many times overall).
  touch.gate_blocks = (Number.parseInt(String(touch.gate_blocks), 10) || 0) + 1;
  touch.gate_blocks_total = (Number.parseInt(String(touch.gate_blocks_total), 10) || 0) + 1;
  writeJson(touchListPath(repo), touch);

  const released = touch.gate_blocks > cap;
  const reasonTail = outputTail(verdict.output);
  const failureLabel = verdict.detail ?? `exit ${verdict.exit ?? "n/a"}`;
  if (mode !== "strict") {
    appendLedger(repo, {
      ...base,
      decision: "warn",
      reason: `criterion failed (${failureLabel})`,
      criterion_exit: verdict.exit,
    });
    return 0;
  }
  if (released) {
    appendLedger(repo, {
      ...base,
      decision: "release",
      reason:
        `criterion gate released after ${touch.gate_blocks} consecutive blocks ` +
        `(${touch.gate_blocks_total} total this session); ` +
        "produce a resumable state snapshot (changed files, remaining criterion, current failure) before handing back",
      criterion_exit: verdict.exit,
    });
    return 0;
  }
  appendLedger(repo, {
    ...base,
    decision: "block",
    reason: `criterion failed (${failureLabel})`,
    criterion_exit: verdict.exit,
  });
  return block(
    `completion criterion not met (${failureLabel}): ${criterion}\n` +
      (reasonTail ? `--- criterion output (tail) ---\n${reasonTail}\n` : "") +
      `Fix the failure and re-verify; the stop gate releases after ${cap} consecutive blocks. ` +
      `If the criterion itself is wrong, update it via ${STATE_DIR}/${TOUCH_LIST} or close the touch-list.`,
  );
}

function repoFromArg(value) {
  if (value) return resolveBest(expandUser(value));
  return workflowRoot(process.cwd());
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(sortDeep(data), null, 2) + "\n", "utf8");
}

function cmdInit(values) {
  const repo = repoFromArg(values.repo);
  const file = path.join(repo, STATE_DIR, TOUCH_LIST);
  if (fs.existsSync(file) && !values.force) {
    process.stderr.write(`${file} already exists; use --force to replace\n`);
    return 1;
  }
  const data = {
    version: 1,
    status: "active",
    enforcement: values.enforcement,
    unknown_write_policy: values["unknown-write-policy"],
    files: normalizePatterns(values.files ?? []),
    tables: normalizePatterns(values.tables ?? []),
    interfaces: normalizePatterns(values.interfaces ?? []),
    criterion: values.criterion.trim(),
  };
  // Session binding is normally adopted from the first hook event; --session
  // pins it explicitly when the caller knows its own id.
  if (values.session && String(values.session).trim()) {
    data.session_id = String(values.session).trim();
  }
  const errors = validateTouchList(data);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`error: ${error}\n`);
    return 1;
  }
  writeJson(file, data);
  appendLedger(repo, {
    event: "Init",
    decision: "observe",
    evidence_kind: "workflow_hook",
    repo: String(repo),
  });
  process.stdout.write(`created ${file}\n`);
  return 0;
}

function cmdValidate(values) {
  const repo = repoFromArg(values.repo);
  const touch = loadTouchList(repo);
  const errors = validateTouchList(touch);
  const file = path.join(repo, STATE_DIR, TOUCH_LIST);
  if (errors.length) {
    process.stdout.write(`${file}: invalid\n`);
    for (const error of errors) process.stdout.write(`- ${error}\n`);
    return 1;
  }
  process.stdout.write(`${file}: ok\n`);
  return 0;
}

function cmdStatus(values) {
  const repo = repoFromArg(values.repo);
  const touch = loadTouchList(repo);
  if (touch === null) {
    process.stdout.write(`state=absent repo=${repo}\n`);
    return 0;
  }
  const errors = validateTouchList(touch);
  process.stdout.write(`repo=${repo}\n`);
  process.stdout.write(
    `state=present status=${String(touch.status ?? "active").toLowerCase()} enforcement=${enforcementMode(touch)}\n`,
  );
  process.stdout.write(
    "scope=" +
      `files:${normalizePatterns(touch.files).length} ` +
      `tables:${normalizePatterns(touch.tables).length} ` +
      `interfaces:${normalizePatterns(touch.interfaces).length}\n`,
  );
  process.stdout.write(`criterion=${String(touch.criterion ?? "").trim() || "(missing)"}\n`);
  process.stdout.write(
    "ledger_note=workflow hook evidence proves scope/process only; it is not business verification\n",
  );
  if (errors.length) {
    process.stdout.write("valid=false\n");
    for (const error of errors) process.stdout.write(`error=${error}\n`);
    return 1;
  }
  process.stdout.write("valid=true\n");
  const limit = Number.parseInt(String(values.limit ?? "5"), 10) || 5;
  for (const row of readLedger(repo, limit)) {
    process.stdout.write(
      "ledger=" +
        jsonSorted({
          event: row.event ?? null,
          decision: row.decision ?? null,
          reason: row.reason ?? null,
          ts: row.ts ?? null,
        }) +
        "\n",
    );
  }
  return 0;
}

function cmdClose(values) {
  const repo = repoFromArg(values.repo);
  const touch = loadTouchList(repo);
  const file = path.join(repo, STATE_DIR, TOUCH_LIST);
  if (touch === null) {
    process.stderr.write(`${file} does not exist\n`);
    return 1;
  }
  touch.status = "closed";
  touch.closed_reason = String(values.reason ?? "complete").trim();
  touch.closed_at = utcNow();
  writeJson(file, touch);
  appendLedger(repo, {
    event: "Close",
    decision: "observe",
    evidence_kind: "workflow_hook",
    repo: String(repo),
    reason: String(values.reason ?? "complete").trim(),
  });
  process.stdout.write(`closed ${file}\n`);
  return 0;
}

const CLI_OPTIONS = {
  init: {
    repo: { type: "string" },
    files: { type: "string", multiple: true },
    tables: { type: "string", multiple: true },
    interfaces: { type: "string", multiple: true },
    criterion: { type: "string" },
    session: { type: "string" },
    enforcement: { type: "string", default: "strict" },
    "unknown-write-policy": { type: "string", default: "warn" },
    force: { type: "boolean", default: false },
  },
  status: {
    repo: { type: "string" },
    limit: { type: "string", default: "5" },
  },
  validate: {
    repo: { type: "string" },
  },
  close: {
    repo: { type: "string" },
    reason: { type: "string", default: "complete" },
  },
};

function cliError(message) {
  process.stderr.write(`error: ${message}\n`);
  return 2;
}

function runCli(command, argv) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: CLI_OPTIONS[command], allowPositionals: false }));
  } catch (err) {
    return cliError(err.message);
  }
  if (command === "init") {
    if (typeof values.criterion !== "string" || !values.criterion.trim()) {
      return cliError("init requires --criterion (machine-checkable completion criterion)");
    }
    if (!VALID_ENFORCEMENT.has(values.enforcement)) {
      return cliError(`--enforcement must be one of ${[...VALID_ENFORCEMENT].sort().join(", ")}`);
    }
    if (!VALID_UNKNOWN_WRITE_POLICY.has(values["unknown-write-policy"])) {
      return cliError(
        `--unknown-write-policy must be one of ${[...VALID_UNKNOWN_WRITE_POLICY].sort().join(", ")}`,
      );
    }
    return cmdInit(values);
  }
  if (command === "status") return cmdStatus(values);
  if (command === "validate") return cmdValidate(values);
  return cmdClose(values);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length && Object.hasOwn(CLI_OPTIONS, argv[0])) {
    return runCli(argv[0], argv.slice(1));
  }

  let eventOverride;
  try {
    const { values } = parseArgs({
      args: argv,
      options: { event: { type: "string" } },
      allowPositionals: false,
    });
    eventOverride = values.event;
  } catch (err) {
    return cliError(err.message);
  }

  const payload = loadStdinJson();
  const event = eventName(payload, eventOverride);
  const repo = workflowRoot(cwdFromPayload(payload));
  const touch = loadTouchList(repo);

  if (event === "pretooluse") return checkPretool(payload, repo, touch);
  if (event === "stop") {
    // The stop gate must never crash a turn's end over an environment fault
    // (e.g. an unwritable ledger/state dir). Degrade loudly to a released stop
    // instead of an uncaught non-zero exit that a runtime might misread.
    try {
      return checkStop(payload, repo, touch);
    } catch (err) {
      process.stderr.write(
        `agent-workflow-hook: stop gate degraded (${err && err.message ? err.message : err}); allowing stop\n`,
      );
      return 0;
    }
  }
  if (stateEnabled(repo, touch)) {
    appendLedger(repo, {
      ...ledgerBase(payload, repo, event || "unknown", toolName(payload)),
      decision: "observe",
    });
  }
  return 0;
}

process.exit(main());
