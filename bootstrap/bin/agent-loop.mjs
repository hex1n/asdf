#!/usr/bin/env node
// PreToolUse/Stop hook and CLI for project-local agent loop runtime state.
//
// The hook is intentionally conservative and dependency-free (node:* builtins
// only, Node 18+). Node is chosen over Python because every machine that runs
// Claude Code or Codex already has Node — the hook adds zero extra runtime
// dependencies. It only records state when a repository already opted in with
// `.agent-loop/` or an active `.agent-loop/run-contract.json`, so global hook
// registration does not create files in every directory an agent visits.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync, execSync } from "node:child_process";
import { parseArgs } from "node:util";

const STATE_DIR = ".agent-loop";
const RUN_CONTRACT = "run-contract.json";
const LOOP_EVENTS = "loop-events.jsonl";
const LOOP_HISTORY = "history.jsonl";
const LEGACY_STATE_DIR = ".agent-workflows";
const LEGACY_RUN_CONTRACT = "touch-list.json";
const LEGACY_LOOP_EVENTS = "evidence-ledger.jsonl";
const VALID_STATUSES = new Set(["active", "closed", "paused"]);
const VALID_ENFORCEMENT = new Set(["off", "warn", "strict"]);
const VALID_UNKNOWN_WRITE_POLICY = new Set(["warn", "deny"]);
const VALID_GIT_OPS = new Set(["add", "commit", "push", "reset", "restore", "checkout", "clean"]);
const SCHEMA_VERSION = 2;
const VALID_SCHEMA_VERSIONS = new Set([SCHEMA_VERSION]);
const VALID_TERMINAL_STATES = new Set(["active", "success", "noop", "blocked", "stalled", "exhausted"]);
const VALID_CONCURRENCY_MODES = new Set(["exclusive", "partitioned"]);
const VALID_CLAIM_STATES = new Set(["active", "success", "noop", "blocked", "stalled", "exhausted"]);
const VALID_REVIEW_VERDICTS = new Set(["skipped", "pass", "fail"]);
const VALID_SECRETS_POLICIES = new Set(["deny_env_dump", "allow_env_dump"]);
const SCOPE_FIELDS = ["files", "tables", "interfaces"];
const SINGLETON_FILE_PATTERNS = [
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "AGENTS.md",
  "CLAUDE.md",
];
// Criterion gate defaults. The consecutive-block cap mirrors Claude Code's
// native 8-consecutive-block Stop-hook override and is the sole release
// trigger, so the hook owns the limit itself (Codex has no native cap).
// It counts CONSECUTIVE red stops and resets on any green, so a healthy long
// loop that reds intermittently is never disarmed — only a genuinely stuck
// loop (cap reds in a row) releases. gate_blocks_total is lifetime telemetry
// only, never a release trigger.
const GATE_BLOCK_CAP = 8;
// Same failure repeated this many consecutive stop attempts releases the gate
// as `stalled` before the blunt GATE_BLOCK_CAP does. A stuck loop that reds the
// identical way is not making progress; releasing early saves wasted criterion
// re-runs and turns the prose "stalled" terminal state into a machine verdict.
// Override per run contract with budget.max_stall_repeats.
const STALL_SIGNATURE_CAP = 3;
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

function stateDirPath(repo) {
  return path.join(repo, STATE_DIR);
}

function legacyStateDirPath(repo) {
  return path.join(repo, LEGACY_STATE_DIR);
}

function migrateLegacyState(repo) {
  const current = stateDirPath(repo);
  const legacy = legacyStateDirPath(repo);
  if (fs.existsSync(current) || !fs.existsSync(legacy)) return;
  try {
    fs.renameSync(legacy, current);
    const legacyContract = path.join(current, LEGACY_RUN_CONTRACT);
    const legacyEvents = path.join(current, LEGACY_LOOP_EVENTS);
    const currentContract = path.join(current, RUN_CONTRACT);
    const currentEvents = path.join(current, LOOP_EVENTS);
    if (fs.existsSync(legacyContract) && !fs.existsSync(currentContract)) fs.renameSync(legacyContract, currentContract);
    if (fs.existsSync(legacyEvents) && !fs.existsSync(currentEvents)) fs.renameSync(legacyEvents, currentEvents);
  } catch {
    // Failing to migrate local runtime state should not make the global hook
    // crash. The next init/status call can recreate canonical state.
  }
}

function runContractPath(repo) {
  migrateLegacyState(repo);
  return path.join(repo, STATE_DIR, RUN_CONTRACT);
}

function loopEventsPath(repo) {
  migrateLegacyState(repo);
  return path.join(repo, STATE_DIR, LOOP_EVENTS);
}

// Use the nearest opted-in loop root, falling back to the git root.
function workflowRoot(cwd) {
  const root = gitRoot(cwd);
  let current;
  try {
    current = resolveBest(cwd);
  } catch {
    return root;
  }
  for (;;) {
    if (fs.existsSync(path.join(current, STATE_DIR)) || fs.existsSync(path.join(current, LEGACY_STATE_DIR))) return current;
    const parent = path.dirname(current);
    if (current === root || parent === current) return root;
    current = parent;
  }
}

function loadTouchList(repo) {
  const file = runContractPath(repo);
  if (!fs.existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {
      version: SCHEMA_VERSION,
      status: "active",
      enforcement: "strict",
      touch: { files: [], tables: [], interfaces: [], git: { allowed_ops: [], reason: "" } },
      _invalid: `cannot parse ${file}`,
    };
  }
  return isPlainObject(data) ? data : null;
}

function objectField(parent, key) {
  const value = (parent ?? {})[key];
  return isPlainObject(value) ? value : {};
}

function runtimeTouch(touch) {
  return objectField(touch, "touch");
}

function runtimeBudget(touch) {
  return objectField(touch, "budget");
}

function runtimeSession(touch) {
  return objectField(touch, "session");
}

function runtimeConcurrency(touch) {
  return objectField(touch, "concurrency");
}

function scopeEntries(touch, field) {
  return runtimeTouch(touch)[field] ?? [];
}

function criterionValue(touch) {
  return String((touch ?? {}).criterion ?? "").trim();
}

function lifecycleStatus(touch) {
  const status = String((touch ?? {}).status ?? "active").toLowerCase();
  return VALID_STATUSES.has(status) ? status : "active";
}

function terminalState(touch) {
  const state = String(touch.terminal_state ?? "active").toLowerCase();
  return VALID_TERMINAL_STATES.has(state) ? state : "active";
}

function setTerminalState(touch, state) {
  touch.terminal_state = state;
}

function ensureEvidence(touch) {
  if (!isPlainObject(touch.evidence)) touch.evidence = {};
  if (!Array.isArray(touch.evidence.proved)) touch.evidence.proved = [];
  if (!Array.isArray(touch.evidence.missing)) touch.evidence.missing = [];
  if (!Array.isArray(touch.evidence.contradicted)) touch.evidence.contradicted = [];
  if (!Array.isArray(touch.evidence.git_ops)) touch.evidence.git_ops = [];
  if (!Number.isFinite(Number(touch.evidence.iteration))) touch.evidence.iteration = 0;
  if (!Object.hasOwn(touch.evidence, "last_failure")) touch.evidence.last_failure = null;
  return touch.evidence;
}

function setLastFailure(touch, failure) {
  const evidence = ensureEvidence(touch);
  evidence.iteration = (Number.parseInt(String(evidence.iteration), 10) || 0) + 1;
  evidence.last_failure = failure;
  if (failure && failure.summary) {
    evidence.missing = dedupe([...evidence.missing, failure.summary]);
  }
}

function sessionIdFromPayload(payload) {
  return (payload.session_id || payload.conversation_id) ?? null;
}

function ownerSessionId(touch) {
  return String(runtimeSession(touch).owner_session_id ?? "").trim();
}

function setOwnerSessionId(touch, sid) {
  if (!sid) return;
  if (!isPlainObject(touch.session)) touch.session = {};
  touch.session.owner_session_id = sid;
  touch.session.updated_at = utcNow();
}

function concurrencyMode(touch) {
  const raw = String(runtimeConcurrency(touch).mode ?? runtimeSession(touch).mode ?? "exclusive").toLowerCase();
  return VALID_CONCURRENCY_MODES.has(raw) ? raw : "exclusive";
}

function claims(touch) {
  const value = runtimeConcurrency(touch).claims;
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

function claimForSession(touch, sid) {
  if (!sid || concurrencyMode(touch) !== "partitioned") return null;
  return claims(touch).find((claim) => String(claim.session_id ?? "").trim() === sid) ?? null;
}

function integratorSession(touch) {
  return String(runtimeConcurrency(touch).integrator_session ?? "").trim();
}

function sessionParticipates(touch, sid) {
  if (!sid) return false;
  if (ownerSessionId(touch) === sid) return true;
  if (integratorSession(touch) === sid) return true;
  return Boolean(claimForSession(touch, sid));
}

function gitConfig(touch) {
  return objectField(runtimeTouch(touch), "git");
}

function budgetValue(touch, key, fallback) {
  const value = runtimeBudget(touch)[key];
  return value === undefined ? fallback : value;
}

function isAbsolutePattern(value) {
  return path.isAbsolute(value) || /^[A-Za-z]:[/\\]/.test(value);
}

function validateTouchList(touch) {
  if (touch === null) return [`missing ${RUN_CONTRACT}`];
  const errors = [];
  if (touch._invalid) errors.push(String(touch._invalid));
  if (!VALID_SCHEMA_VERSIONS.has(touch.version)) errors.push(`version must be ${SCHEMA_VERSION}`);
  for (const field of ["touch", "budget", "session", "evidence", "review", "concurrency"]) {
    if (!isPlainObject(touch[field])) errors.push(`${field} must be an object`);
  }
  const status = String(touch.status ?? "active").toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    errors.push(`status must be one of ${JSON.stringify([...VALID_STATUSES].sort())}`);
  }
  const state = String(touch.terminal_state ?? "active").toLowerCase();
  if (!VALID_TERMINAL_STATES.has(state)) {
    errors.push(`terminal_state must be one of ${JSON.stringify([...VALID_TERMINAL_STATES].sort())}`);
  }
  if (status === "active" && state !== "active") {
    errors.push("active status requires terminal_state active");
  }
  if (status === "closed" && state === "active") {
    errors.push("closed status requires a terminal terminal_state");
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
  const gitAllowed = gitConfig(touch).allowed_ops ?? [];
  if (!Array.isArray(gitAllowed)) {
    errors.push("touch.git.allowed_ops must be a list");
  } else {
    for (const op of gitAllowed) {
      const normalized = String(op).trim().toLowerCase();
      if (normalized !== "*" && !VALID_GIT_OPS.has(normalized)) {
        errors.push(
          `touch.git.allowed_ops entry must be one of ${JSON.stringify([...VALID_GIT_OPS].sort())} or "*": ${op}`,
        );
      }
    }
    if (gitAllowed.length && !String(gitConfig(touch).reason ?? "").trim()) {
      errors.push("touch.git.reason is required when touch.git.allowed_ops is not empty");
    }
  }
  for (const field of SCOPE_FIELDS) {
    const value = scopeEntries(touch, field);
    if (!Array.isArray(value)) {
      errors.push(`touch.${field} must be a list`);
      continue;
    }
    for (const item of value) {
      if (typeof item !== "string" || !item.trim()) {
        errors.push(`touch.${field} entries must be non-empty strings`);
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
  const budget = runtimeBudget(touch);
  const boolFields = ["network_allowed", "install_scripts_allowed", "destructive_allowed"];
  for (const field of boolFields) {
    if (budget[field] !== undefined && typeof budget[field] !== "boolean") {
      errors.push(`budget.${field} must be boolean`);
    }
  }
  if (budget.network_allowlist !== undefined && !Array.isArray(budget.network_allowlist)) {
    errors.push("budget.network_allowlist must be a list");
  }
  if (budget.max_iterations !== undefined && intField(budget.max_iterations, 0) < 1) {
    errors.push("budget.max_iterations must be a positive integer");
  }
  if (budget.max_git_ops !== undefined && Number.parseInt(String(budget.max_git_ops), 10) < 0) {
    errors.push("budget.max_git_ops must be a non-negative integer");
  }
  for (const field of ["max_writes", "max_wall_clock_minutes"]) {
    if (budget[field] !== undefined && Number.parseInt(String(budget[field]), 10) < 0) {
      errors.push(`budget.${field} must be a non-negative integer`);
    }
  }
  const secretsPolicy = String(budget.secrets_policy ?? "deny_env_dump");
  if (!VALID_SECRETS_POLICIES.has(secretsPolicy)) {
    errors.push(`budget.secrets_policy must be one of ${JSON.stringify([...VALID_SECRETS_POLICIES].sort())}`);
  }

  const session = runtimeSession(touch);
  const sessionMode = String(session.mode ?? "exclusive").toLowerCase();
  if (!VALID_CONCURRENCY_MODES.has(sessionMode)) {
    errors.push(`session.mode must be one of ${JSON.stringify([...VALID_CONCURRENCY_MODES].sort())}`);
  }
  const concurrency = runtimeConcurrency(touch);
  const mode = String(concurrency.mode ?? sessionMode).toLowerCase();
  if (!VALID_CONCURRENCY_MODES.has(mode)) {
    errors.push(`concurrency.mode must be one of ${JSON.stringify([...VALID_CONCURRENCY_MODES].sort())}`);
  }
  const review = objectField(touch, "review");
  const verdict = String(review.verdict ?? "skipped").toLowerCase();
  if (!VALID_REVIEW_VERDICTS.has(verdict)) {
    errors.push(`review.verdict must be one of ${JSON.stringify([...VALID_REVIEW_VERDICTS].sort())}`);
  }
  errors.push(...validateClaims(touch));
  if (status === "active") {
    const hasScope = SCOPE_FIELDS.some((field) => normalizePatterns(scopeEntries(touch, field)).length > 0);
    if ((enforcement === "warn" || enforcement === "strict") && !hasScope) {
      errors.push("active run contract must include at least one files/tables/interfaces entry");
    }
    if (!criterionValue(touch)) {
      errors.push("active run contract must include criterion");
    }
  }
  return dedupe(errors);
}

function stateEnabled(repo, touch) {
  if (touch !== null) return true;
  try {
    return fs.statSync(stateDirPath(repo)).isDirectory();
  } catch {
    try {
      return fs.statSync(legacyStateDirPath(repo)).isDirectory();
    } catch {
      return false;
    }
  }
}

function shouldEnforce(touch) {
  if (!touch) return false;
  return lifecycleStatus(touch) === "active" && terminalState(touch) === "active";
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

function appendEvent(repo, event) {
  const state = stateDirPath(repo);
  migrateLegacyState(repo);
  fs.mkdirSync(state, { recursive: true });
  if (event.ts === undefined) event.ts = utcNow();
  fs.appendFileSync(loopEventsPath(repo), jsonSorted(event) + "\n", "utf8");
}

// Out-of-tree terminal history: one line per closed loop under the user's
// home, so terminal states survive the next `init --force` and the meta-loop
// can compute outcome metrics (terminal-state distribution, resumed reworks).
// Best-effort telemetry only: a failure to write must never trap a stop or a
// close, and the file is no more tamper-resistant than the event log — it is
// process evidence, not business verification.
function historyHome() {
  return path.resolve(process.env.USERPROFILE || process.env.HOME || os.homedir());
}

function appendTerminalHistory(repo, touch, via) {
  try {
    const dir = path.join(historyHome(), STATE_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const evidence = touch.evidence && typeof touch.evidence === "object" ? touch.evidence : {};
    const row = {
      ts: utcNow(),
      repo: String(repo),
      via,
      terminal_state: terminalState(touch),
      reason: touch.closed_reason ?? null,
      goal: touch.goal ?? null,
      criterion: criterionValue(touch) ?? null,
      gate_blocks_total: Number.parseInt(String(touch.gate_blocks_total), 10) || 0,
      stall_count: Number.parseInt(String(touch.stall_count), 10) || 0,
      iteration: evidence.iteration ?? null,
      writes: Number.parseInt(String(evidence.writes), 10) || 0,
      resume_count: Number.parseInt(String(touch.resume_count), 10) || 0,
      touched_files: Array.isArray(evidence.touched_files) ? evidence.touched_files.length : 0,
      snapshot: evidence.snapshot ?? null,
      session: ownerSessionId(touch) ?? null,
    };
    fs.appendFileSync(path.join(dir, LOOP_HISTORY), jsonSorted(row) + "\n", "utf8");
  } catch {
    /* degrade, never trap */
  }
}

function readEvents(repo, limit = 5) {
  const file = loopEventsPath(repo);
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

function gitOperations(mapping) {
  const ops = [];
  const optionWithValue = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);
  for (const command of commandValues(mapping)) {
    for (const match of command.matchAll(/\bgit(?:\.exe)?(?:\s+[^;&|()\r\n]+)*/gi)) {
      const argv = splitSimpleCommand(match[0]);
      if (!argv || !argv.length || !/^git(?:\.exe)?$/i.test(argv[0])) continue;
      for (let i = 1; i < argv.length; i++) {
        const token = argv[i];
        if (optionWithValue.has(token)) {
          i += 1;
          continue;
        }
        if (token.startsWith("-")) continue;
        const op = token.toLowerCase();
        if (VALID_GIT_OPS.has(op)) ops.push(op);
        break;
      }
    }
  }
  return dedupe(ops);
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
  // run-contract declarations, not in a global hook.
  const paths = [];
  const re = /(?:>|>>|Out-File\s+-FilePath|Set-Content\s+-Path|Add-Content\s+-Path)\s+(['"]?)([^'"\s|;&]+)\1/gi;
  for (const match of command.matchAll(re)) paths.push(match[2]);
  return paths;
}

// Command text embeds file CONTENT (heredocs, echoed Java/XML/SQL, patch
// bodies), and the best-effort extractors above happily pick code tokens out
// of it: `List<Long> teamIds)` reads as a redirection into "teamIds)", a
// lambda `i -> i.getName()` as a write to "i.getName()", a `--- intro` diff
// line as a path. Only path-shaped tokens may reach scope enforcement — a
// dropped junk token merely skips one enforcement probe, while a false deny
// blocks real work (observed: dozens of code-token denies in one session).
// Explicit tool fields (file_path etc.) stay unfiltered: they are
// authoritative targets by construction.
function plausibleFileTarget(value) {
  const v = String(value ?? "").trim();
  if (!v || v.length > 260) return false;
  if (/^[-+*<>|&]/.test(v)) return false;
  if (/[()<>{}|;`"']/.test(v) || /\s/.test(v)) return false;
  return /[\\/]/.test(v) || /\.[A-Za-z0-9]{1,8}$/.test(v);
}

function fileTargets(tool, mapping) {
  const targets = stringFieldValues(mapping, FILE_FIELD_NAMES);
  for (const command of commandValues(mapping)) {
    targets.push(...patchPaths(command).filter(plausibleFileTarget));
    targets.push(...shellRedirectionPaths(command).filter(plausibleFileTarget));
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

function safetyFailures(touch, mapping) {
  if (!shouldEnforce(touch)) return [];
  const failures = [];
  const networkAllowed = Boolean(budgetValue(touch, "network_allowed", false));
  const installScriptsAllowed = Boolean(budgetValue(touch, "install_scripts_allowed", false));
  const destructiveAllowed = Boolean(budgetValue(touch, "destructive_allowed", false));
  const secretsPolicy = String(budgetValue(touch, "secrets_policy", "deny_env_dump"));
  for (const command of commandValues(mapping)) {
    if (!networkAllowed && /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i.test(command)) {
      failures.push("network command requires budget.network_allowed");
    }
    if (
      !networkAllowed &&
      /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b[\s\S]*(\|\s*(?:sh|bash|pwsh|powershell)|(?:sh|bash|pwsh|powershell)\s+-c)/i.test(command)
    ) {
      failures.push("remote download execution requires explicit network budget");
    }
    if (!installScriptsAllowed && /\b(npm|pnpm|yarn|bun)\s+(?:install|i|add)\b|\bpip(?:3)?\s+install\b/i.test(command)) {
      failures.push("package install command requires budget.install_scripts_allowed");
    }
    if (
      !destructiveAllowed &&
      // Command-position anchored: `rm`/`del`/... only counts at the start of
      // a command (string/line start or after |;&). Embedded content — a Java
      // `void del(...)`, prose mentioning `rd` — must not trip the budget
      // (observed false denies on both runtimes). A content LINE that starts
      // with a destructive token still matches; collaborative model accepts
      // that residual over missing `cmd && rm -rf x`.
      /(?:^|[|;&\n(])\s*(?:sudo\s+)?(?:Remove-Item|rm|del|erase|rmdir|rd)(?:\.exe)?\b/i.test(command) &&
      !/\b(Get-ChildItem|ls|dir)\b/i.test(command)
    ) {
      failures.push("destructive command requires budget.destructive_allowed");
    }
    if (
      secretsPolicy === "deny_env_dump" &&
      /^\s*(?:env|printenv|set|Get-ChildItem\s+Env:)\s*$/i.test(command.trim())
    ) {
      failures.push("environment dump denied by budget.secrets_policy");
    }
  }
  return dedupe(failures);
}

function gitAllowed(touch, op, payload = {}) {
  if (!shouldEnforce(touch)) return false;
  if (concurrencyMode(touch) === "partitioned") {
    const sid = sessionIdFromPayload(payload);
    const integrator = integratorSession(touch);
    if (!sid || !integrator || sid !== integrator) return false;
  }
  const raw = Array.isArray(gitConfig(touch).allowed_ops) ? gitConfig(touch).allowed_ops : [];
  const allowed = raw.map((item) => String(item).trim().toLowerCase());
  return allowed.includes("*") || allowed.includes(op);
}

function gitBudgetFailure(touch, ops) {
  if (!ops.length || !shouldEnforce(touch)) return null;
  const max = Number.parseInt(String(budgetValue(touch, "max_git_ops", 0)), 10) || 0;
  const evidence = ensureEvidence(touch);
  const used = Array.isArray(evidence.git_ops) ? evidence.git_ops.length : 0;
  if (max < 1) return "git operation budget is zero; set budget.max_git_ops via init";
  if (used + ops.length > max) {
    return `git operation budget exceeded: ${used}+${ops.length} > ${max}`;
  }
  return null;
}

function recordGitOps(touch, payload, ops) {
  if (!ops.length || !shouldEnforce(touch)) return;
  const evidence = ensureEvidence(touch);
  const sid = sessionIdFromPayload(payload);
  for (const op of ops) {
    evidence.git_ops.push({ op, session_id: sid, ts: utcNow() });
  }
}

// A mismatch deny is read by a live agent mid-task: hand it commands it can
// run verbatim, not philosophy. Observed failure mode: an agent hit this deny
// dozens of times in one session and went source-diving for the CLI instead
// of closing, stealing, or switching worktree.
function sessionMismatchGuidance(repo, mismatch) {
  const cli = process.argv[1] ?? "agent-loop.mjs";
  let abandoned = "";
  // Best-effort abandonment hint; only meaningful when the expected owner is
  // a concrete session id (not the partitioned-mode role description).
  if (!/\s/.test(String(mismatch.expected ?? ""))) {
    try {
      const rows = readEvents(repo, 200).filter(
        (row) => row && row.session_id === mismatch.expected && row.ts,
      );
      const last = rows.length ? Date.parse(rows[rows.length - 1].ts) : NaN;
      const idleMin = Number.isFinite(last) ? Math.round((Date.now() - last) / 60000) : null;
      if (idleMin === null) {
        abandoned = " The owning session has no recent hook events here - likely abandoned; steal is safe.";
      } else if (idleMin >= 30) {
        abandoned = ` The owning session has been idle for ${idleMin} minutes - likely abandoned; steal is safe.`;
      }
    } catch {
      /* hint is best-effort */
    }
  }
  return (
    `session mismatch: run contract bound to ${mismatch.expected}; current session is ${mismatch.actual}.${abandoned} Pick one:\n` +
    `  node "${cli}" close --repo "${repo}" --terminal-state <success|noop|blocked|stalled|exhausted> --reason "<why>"  # the old loop is finished\n` +
    `  node "${cli}" init --repo "${repo}" --force --steal --reason "<why>" --files "<glob>" --criterion "<check>"  # take over the stale loop\n` +
    `  git worktree add ../<name>-wt  # run parallel loops in separate worktrees`
  );
}

// Naked-write reminder: the repo opted into loop state (.agent-loop/ exists)
// but no ACTIVE run contract covers this write. Remind once per session with
// a copyable init template - never block (trivial single-file changes are
// legitimately contract-free). additionalContext is the only documented
// exit-0 channel that reaches the model on both Claude Code and Codex;
// permissionDecision is deliberately omitted so the reminder never changes
// permission semantics.
function nakedWriteReminder(repo, touch, payload, tool, mapping) {
  const active = touch !== null && lifecycleStatus(touch) === "active";
  if (active) return null;
  const writeShaped =
    fileTargets(tool, mapping).length > 0 ||
    sqlTargets(mapping).length > 0 ||
    looksLikeWrite(tool, mapping);
  if (!writeShaped) return null;
  const sid = sessionIdFromPayload(payload);
  try {
    if (readEvents(repo, 200).some((row) => row && row.naked_write && row.session_id === sid)) return null;
  } catch {
    /* dedup is best-effort */
  }
  const cli = process.argv[1] ?? "agent-loop.mjs";
  return (
    `no active run contract in this loop-enabled repo (${STATE_DIR}/ present). For non-trivial work, open one first:\n` +
    `  node "${cli}" init --repo "${repo}" --files "<glob>" --criterion "<machine-checkable check, red until done>" --goal "<one line>"\n` +
    `Trivial single-file changes may proceed without one. This reminder appears once per session.`
  );
}

function sessionMismatch(touch, payload) {
  if (!shouldEnforce(touch)) return null;
  const sid = sessionIdFromPayload(payload);
  if (!sid) return null;
  if (concurrencyMode(touch) === "partitioned") {
    if (sessionParticipates(touch, sid)) return null;
    return { expected: "partitioned claim or integrator session", actual: sid };
  }
  const expected = ownerSessionId(touch);
  if (!expected || expected === sid) return null;
  return { expected, actual: sid };
}

function bindSessionIfNeeded(repo, touch, payload) {
  if (!shouldEnforce(touch) || touch._invalid || ownerSessionId(touch)) return;
  const sid = sessionIdFromPayload(payload);
  if (!sid) return;
  setOwnerSessionId(touch, sid);
  writeJson(runContractPath(repo), touch);
}

function gitAuthorizationHint(repo, ops) {
  const allowed = ops.map((op) => `--git-allowed ${op}`).join(" ");
  return (
    `Create or update the active run contract with: node ~/bin/agent-loop.mjs init --repo "${repo}" ` +
    `--files <glob> --criterion <check> ${allowed} --git-reason <why>. ` +
    `If an active run contract already belongs to an abandoned session, add --force --steal --reason <why>.`
  );
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
    return patternMatches(left, right) || patternMatches(right, left);
  }
  const lp = patternPrefix(left);
  const rp = patternPrefix(right);
  if (!lp || !rp) return true;
  return lp.startsWith(rp) || rp.startsWith(lp);
}

function validateClaimPatterns(claim, index) {
  const errors = [];
  const files = claim.files ?? [];
  if (!Array.isArray(files) || !files.length) {
    errors.push(`concurrency.claims[${index}].files must be a non-empty list`);
    return errors;
  }
  for (const item of files) {
    if (typeof item !== "string" || !item.trim()) {
      errors.push(`concurrency.claims[${index}].files entries must be non-empty strings`);
      continue;
    }
    const normalized = item.replace(/\\/g, "/").trim();
    if (normalized.startsWith("../") || normalized === ".." || isAbsolutePattern(item)) {
      errors.push(`concurrency.claims[${index}].files entry must be repo-relative: ${item}`);
    }
  }
  return errors;
}

function validateClaims(touch) {
  const errors = [];
  if (concurrencyMode(touch) !== "partitioned") return errors;
  const rows = claims(touch);
  if (!rows.length) {
    errors.push("partitioned concurrency requires at least one claim");
    return errors;
  }
  const seenSessions = new Set();
  for (let i = 0; i < rows.length; i++) {
    const sid = String(rows[i].session_id ?? "").trim();
    if (!sid) errors.push(`concurrency.claims[${i}].session_id is required`);
    else if (seenSessions.has(sid)) errors.push(`duplicate concurrency claim for session ${sid}`);
    else seenSessions.add(sid);
    errors.push(...validateClaimPatterns(rows[i], i));
  }
  for (let i = 0; i < rows.length; i++) {
    const left = normalizePatterns(rows[i].files ?? []);
    for (let j = i + 1; j < rows.length; j++) {
      const right = normalizePatterns(rows[j].files ?? []);
      for (const a of left) {
        for (const b of right) {
          if (patternsOverlap(a, b)) {
            errors.push(
              `concurrency claims overlap: ${rows[i].session_id ?? i} ${a} conflicts with ${rows[j].session_id ?? j} ${b}`,
            );
          }
        }
      }
    }
  }
  for (const singleton of SINGLETON_FILE_PATTERNS) {
    const owners = rows.filter((claim) => normalizePatterns(claim.files ?? []).some((pat) => patternMatches(singleton, pat)));
    if (owners.length > 1) {
      errors.push(`singleton file ${singleton} is claimed by multiple sessions`);
    }
  }
  const integrator = integratorSession(touch);
  if (integrator && seenSessions.has(integrator)) {
    errors.push("integrator_session must not also be a writer claim");
  }
  return errors;
}

function allowedFile(repo, raw, patterns) {
  const [rel, _absolute] = pathRelation(repo, raw);
  if (rel === null) return [false, `target outside repo: ${raw}`];
  if (rel === STATE_DIR || rel.startsWith(`${STATE_DIR}/`)) return [true, rel];
  if (!patterns.length) return [false, `no file run-contract entries allow ${rel}`];
  if (patterns.some((pat) => patternMatches(rel, pat))) return [true, rel];
  return [false, rel];
}

function allowedName(raw, patterns) {
  const value = raw.trim();
  return patterns.some((pat) => fnmatchcase(value, pat));
}

function filePatternsForPayload(touch, payload) {
  if (concurrencyMode(touch) === "partitioned") {
    const claim = claimForSession(touch, sessionIdFromPayload(payload));
    return normalizePatterns(claim?.files ?? []);
  }
  return normalizePatterns(scopeEntries(touch, "files"));
}

function eventBase(payload, repo, event, tool) {
  return {
    evidence_kind: "loop_runtime",
    event,
    repo: String(repo),
    session_id: sessionIdFromPayload(payload),
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
  const gitOps = gitOperations(mapping);
  const deniedGit = gitOps.filter((op) => !gitAllowed(touch, op, payload));
  if (deniedGit.length) {
    const reason =
      `git operation(s) require explicit loop authorization: ${deniedGit.join(", ")}. ` +
      gitAuthorizationHint(repo, deniedGit);
    if (stateEnabled(repo, touch)) {
      appendEvent(repo, { ...eventBase(payload, repo, "PreToolUse", tool), decision: "deny", reason });
    }
    return deny(reason);
  }
  const gitBudget = gitBudgetFailure(touch, gitOps);
  if (gitBudget) {
    const reason = `git operation(s) require explicit loop budget: ${gitBudget}. ${gitAuthorizationHint(repo, gitOps)}`;
    if (stateEnabled(repo, touch)) {
      appendEvent(repo, { ...eventBase(payload, repo, "PreToolUse", tool), decision: "deny", reason });
    }
    return deny(reason);
  }
  if (!stateEnabled(repo, touch)) return 0;

  const mode = enforcementMode(touch);
  const validationErrors = validateTouchList(touch);
  const files = filePatternsForPayload(touch, payload);
  const tables = normalizePatterns(scopeEntries(touch, "tables"));
  const interfaces = normalizePatterns(scopeEntries(touch, "interfaces"));
  const base = eventBase(payload, repo, "PreToolUse", tool);

  const mismatch = sessionMismatch(touch, payload);
  if (mismatch) {
    const reason = sessionMismatchGuidance(repo, mismatch);
    appendEvent(repo, { ...base, decision: "deny", reason });
    return deny(reason);
  }
  bindSessionIfNeeded(repo, touch, payload);

  if (shouldEnforce(touch) && validationErrors.length) {
    const reason = "invalid run contract: " + validationErrors.join("; ");
    appendEvent(repo, { ...base, decision: "deny", reason });
    return deny(reason);
  }

  if (!shouldEnforce(touch) || mode === "off") {
    markDirtyIfWriteShaped(repo, touch, tool, mapping, gitOps);
    const reminder = nakedWriteReminder(repo, touch, payload, tool, mapping);
    if (reminder) {
      appendEvent(repo, { ...base, decision: "warn", naked_write: true, reason: reminder });
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: reminder },
        }) + "\n",
      );
      process.stderr.write(reminder + "\n");
      return 0;
    }
    appendEvent(repo, { ...base, decision: "observe" });
    return 0;
  }

  const runaway = runawayBudgetFailures(touch, tool, mapping, gitOps);
  if (runaway.length) {
    const reason = `run contract runaway budget reached: ${runaway.join("; ")}`;
    if (mode === "strict") {
      const cli = process.argv[1] ?? "agent-loop.mjs";
      appendEvent(repo, { ...base, decision: "deny", runaway_budget: true, reason });
      return deny(
        reason +
          ". Reads and verification commands still run: verify and let the criterion gate adjudicate the stop, " +
          "close with an honest terminal state:\n" +
          `  node "${cli}" close --repo "${repo}" --terminal-state <blocked|stalled|exhausted> --reason "<why>" --snapshot "<changed; remaining; failure; next>"\n` +
          "or re-init with a larger budget and a reason.",
      );
    }
    if (touch.runaway_budget_warned !== true) {
      touch.runaway_budget_warned = true;
      appendEvent(repo, { ...base, decision: "warn", runaway_budget: true, reason });
      writeJson(runContractPath(repo), touch);
    }
  }

  const failures = [];
  failures.push(...safetyFailures(touch, mapping));
  const fileResults = [];
  for (const raw of fileTargets(tool, mapping)) {
    const [ok, detail] = allowedFile(repo, raw, files);
    fileResults.push({ target: raw, resolved: detail, allowed: ok });
    if (!ok) failures.push(`file ${detail}`);
  }

  const tableTargets = sqlTargets(mapping);
  for (const target of tableTargets) {
    if (tables.length && !allowedName(target, tables)) failures.push(`table ${target}`);
    else if (!tables.length) failures.push(`table ${target} (no table run-contract entries)`);
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
    appendEvent(repo, { ...base, decision, reason: failures.join("; "), targets });
    if (mode === "strict") {
      // Teach the blessed path only: narrow first; widen scope with a
      // recorded reason. Never point at the contract file itself.
      const cli = process.argv[1] ?? "agent-loop.mjs";
      return deny(
        "agent loop run contract denied target(s): " +
          failures.join("; ") +
          ". Narrow the tool call to the declared scope, or if the target genuinely belongs to this loop's goal:\n" +
          `  node "${cli}" amend --repo "${repo}" --files "<missing glob>" --reason "<why it belongs>"`,
      );
    }
    // warn mode lets the call through, so it may still mutate state.
    markDirtyIfWriteShaped(repo, touch, tool, mapping, gitOps);
    return 0;
  }

  appendEvent(repo, { ...base, decision: "allow", targets });
  recordGitOps(touch, payload, gitOps);
  const flippedDirty = markDirtyIfWriteShaped(repo, touch, tool, mapping, gitOps, { deferWrite: true });
  if (gitOps.length || flippedDirty) writeJson(runContractPath(repo), touch);
  return 0;
}

// Red-verdict cache support: remember that something write-shaped ran since
// the last criterion verdict. Only a write can turn a red criterion green, so
// the Stop gate may reuse a red verdict while this flag is false. Marking is
// deliberately over-approximate (any file/table/interface target, anything
// that looks like a write, any command or git op counts) — a false "dirty"
// merely costs one extra criterion run, while a false "clean" would hold a
// stale red, which the stall release still bounds.
// A "counted write" is narrower than "dirty-making": the red-verdict cache
// must be invalidated by anything that could mutate state (any shell command,
// any file-target tool including reads), but the write budget must count only
// genuine writes — reads and verification runs never burn it, so a loop over
// budget can always still verify and stop.
function countsAsWrite(tool, mapping, gitOps) {
  return gitOps.length > 0 || looksLikeWrite(tool, mapping);
}

// Cap on the machine-observed changed-files list: enough for any sane loop,
// bounded so a mass rewrite cannot bloat the contract file.
const TOUCHED_FILES_CAP = 50;

function repoRelative(repo, raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const root = path.resolve(String(repo));
  const abs = path.resolve(root, s.replace(/\\/g, "/"));
  if (abs === root) return null;
  if (abs.startsWith(root + path.sep)) return abs.slice(root.length + 1).replace(/\\/g, "/");
  return s;
}

function markDirtyIfWriteShaped(repo, touch, tool, mapping, gitOps, opts = {}) {
  if (!touch || typeof touch !== "object") return false;
  const counted = countsAsWrite(tool, mapping, gitOps);
  const writeShaped =
    counted ||
    fileTargets(tool, mapping).length > 0 ||
    sqlTargets(mapping).length > 0 ||
    interfaceTargets(mapping).length > 0 ||
    commandValues(mapping).length > 0;
  let changed = false;
  if (writeShaped && touch.dirty_since_verdict !== true) {
    touch.dirty_since_verdict = true;
    changed = true;
  }
  if (counted) {
    const evidence = ensureEvidence(touch);
    evidence.writes = (Number.parseInt(String(evidence.writes), 10) || 0) + 1;
    // The machine half of the resumable snapshot: the hook observes every
    // write target, so "changed files" is generated state, never something
    // the agent is asked to remember.
    const touched = Array.isArray(evidence.touched_files) ? evidence.touched_files.map(String) : [];
    for (const raw of fileTargets(tool, mapping)) {
      const rel = repoRelative(repo, raw);
      if (!rel || touched.includes(rel)) continue;
      if (touched.length >= TOUCHED_FILES_CAP) {
        evidence.touched_files_truncated = true;
        break;
      }
      touched.push(rel);
    }
    evidence.touched_files = touched;
    changed = true;
  }
  if (changed && !opts.deferWrite) writeJson(runContractPath(repo), touch);
  return changed;
}

function touchedFilesSummary(touch, limit = 10) {
  const evidence = ensureEvidence(touch);
  const touched = Array.isArray(evidence.touched_files) ? evidence.touched_files.map(String) : [];
  if (!touched.length) return null;
  const shown = touched.slice(0, limit).join(", ");
  const extra = touched.length > limit ? `, +${touched.length - limit} more` : "";
  const truncated = evidence.touched_files_truncated ? ", list capped" : "";
  return `(${touched.length}): ${shown}${extra}${truncated}`;
}

// Runaway-side budget: the stop gate bounds a loop that keeps trying to stop,
// but a loop that never stops consumes no gate budget at all. These checks
// bound it at the only point the machine observes work — write-shaped tool
// calls. Both budgets default to 0 (off): a false trip costs more than the
// rare runaway in a collaborative setting, so the bound is opt-in.
function runawayBudgetFailures(touch, tool, mapping, gitOps) {
  const failures = [];
  if (!countsAsWrite(tool, mapping, gitOps)) return failures;
  const maxWrites = intField(budgetValue(touch, "max_writes", 0), 0);
  if (maxWrites > 0) {
    const writes = Number.parseInt(String(ensureEvidence(touch).writes), 10) || 0;
    if (writes >= maxWrites) {
      failures.push(`write budget exhausted (${writes} write-shaped calls, max_writes ${maxWrites})`);
    }
  }
  const maxMinutes = intField(budgetValue(touch, "max_wall_clock_minutes", 0), 0);
  if (maxMinutes > 0) {
    const started = Date.parse(String(runtimeSession(touch).started_at ?? ""));
    if (Number.isFinite(started)) {
      const elapsedMinutes = (Date.now() - started) / 60000;
      if (elapsedMinutes > maxMinutes) {
        failures.push(
          `wall-clock budget exhausted (${Math.floor(elapsedMinutes)}m since init, max_wall_clock_minutes ${maxMinutes})`,
        );
      }
    }
  }
  return failures;
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

// Stable, dependency-free signature of a failure verdict. Two consecutive red
// stops with the same exit and same output tail are "the same failure"; a
// changed signature means the loop moved and the stall counter resets. FNV-1a
// over exit + tail keeps this deterministic across platforms without importing
// a hash module.
function fnv1aHex(input) {
  const s = String(input ?? "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function failureSignature(exit, tail) {
  return fnv1aHex(`${exit ?? "n/a"} ${String(tail ?? "")}`);
}

// Baseline hash of the done-when criterion, frozen at init. A later mismatch
// is a moved goalpost: the machine cannot judge whether the change is
// legitimate, but it records it so "defining green" stays separable from
// "passing green".
function criterionHash(criterion) {
  return fnv1aHex(String(criterion ?? "").trim());
}

// The criterion is the loop's only sensor, and the files it executes (tests,
// checkers) are usually writable by the same loop it adjudicates. The goalpost
// hash above only covers the command string; these fingerprints cover the
// command's file inputs, so a check weakened mid-loop is visible at green.
// Best-effort heuristic: path-shaped tokens in the criterion that resolve to
// files inside the repo. A criterion with no extractable paths gets an empty
// list and no checking — honest degradation, not silent coverage.
function criterionInputPaths(criterion, repo) {
  const repoRoot = path.resolve(String(repo ?? ""));
  const tokens = String(criterion ?? "").split(/[\s"'();|&<>]+/).filter(Boolean);
  const seen = new Set();
  const inputs = [];
  for (const rawToken of tokens) {
    const token = rawToken.replace(/^--?[\w-]+=/, "");
    if (!token || token.startsWith("-")) continue;
    if (!/[\\/.]/.test(token)) continue;
    if (token.includes("*") || token.includes("?")) continue;
    const rel = token.replace(/\\/g, "/");
    const abs = path.resolve(repoRoot, rel);
    if (abs !== repoRoot && !abs.startsWith(repoRoot + path.sep)) continue;
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (seen.has(rel)) continue;
    seen.add(rel);
    try {
      inputs.push({ path: rel, hash: fnv1aHex(fs.readFileSync(abs, "latin1")) });
    } catch {
      /* unreadable input: skip rather than trap */
    }
  }
  return inputs;
}

// Compare stored input fingerprints against the working tree, adopting the
// current state as the new baseline (mirrors the goalpost check: the machine
// reports the move once; judging its legitimacy stays with the human).
function criterionInputDrift(touch, repo) {
  const inputs = Array.isArray(touch.criterion_inputs) ? touch.criterion_inputs : [];
  const changed = [];
  for (const entry of inputs) {
    if (!entry || typeof entry !== "object") continue;
    const rel = String(entry.path ?? "");
    if (!rel) continue;
    let current;
    try {
      current = fnv1aHex(fs.readFileSync(path.resolve(String(repo), rel), "latin1"));
    } catch {
      current = "missing";
    }
    if (current !== String(entry.hash ?? "")) {
      changed.push(rel);
      entry.hash = current;
    }
  }
  return changed;
}

// Criterion gate: the machine-side stop verdict. Prose contracts stay
// advisory; this makes "green before stop" deterministic in strict mode.
// warn mode runs the criterion and records the verdict without blocking
// (grayscale before flipping to strict). Degrade paths never trap a session:
// unreadable state, non-executable criterion, session mismatch, cap and fuse
// all release the stop with an event record instead of blocking forever.
function checkStop(payload, repo, touch) {
  if (!stateEnabled(repo, touch)) return 0;
  const base = {
    ...eventBase(payload, repo, "Stop", toolName(payload)),
    status: (payload.status || payload.stop_reason) ?? null,
    stop_hook_active: payload.stop_hook_active ?? null,
  };
  const mode = enforcementMode(touch);
  if (!shouldEnforce(touch) || mode === "off") {
    appendEvent(repo, { ...base, decision: "observe" });
    return 0;
  }
  if (touch._invalid) {
    // Unparseable state cannot be safely persisted or gated; PreToolUse
    // already fails closed on it, so blocking the stop too would only trap.
    appendEvent(repo, { ...base, decision: "warn", reason: String(touch._invalid) });
    return 0;
  }

  // Session binding: the run contract belongs to the loop that first ran under
  // it. A stale active run contract (abandoned loop, Esc-interrupted session)
  // must not gate an unrelated session's stops.
  const sid = sessionIdFromPayload(payload);
  const expectedSession = ownerSessionId(touch);
  if (expectedSession && sid && expectedSession !== sid) {
    appendEvent(repo, {
      ...base,
      decision: "warn",
      reason: `session mismatch: run contract bound to ${expectedSession}; close or re-init it for this session`,
    });
    return 0;
  }
  if (!expectedSession && sid) {
    setOwnerSessionId(touch, sid);
    writeJson(runContractPath(repo), touch);
  }

  const validationErrors = validateTouchList(touch);
  const criterion = criterionValue(touch);
  const cap = intField(budgetValue(touch, "max_iterations", touch.gate_block_cap ?? GATE_BLOCK_CAP), GATE_BLOCK_CAP);
  const timeoutSec = intField(touch.criterion_timeout_seconds, CRITERION_TIMEOUT_SECONDS);

  // Goalpost check. The blessed way to change a criterion is `amend` (records a
  // reason and updates the baseline). A criterion changed by editing the run
  // contract directly bypasses that, so surface it loudly here: the machine
  // cannot judge whether the change is legitimate, only that it happened. Reset
  // the stall identity since failures now belong to a different check. Contracts
  // written before this baseline existed adopt it silently (no false event).
  const liveCriterionHash = criterionHash(criterion);
  if (touch.criterion_hash && touch.criterion_hash !== liveCriterionHash) {
    appendEvent(repo, {
      ...base,
      decision: "warn",
      reason:
        "criterion amended outside 'amend' (goalpost moved without a recorded reason); " +
        `previous_hash=${touch.criterion_hash} new_hash=${liveCriterionHash}`,
      criterion_amended: true,
      via: "direct-edit",
    });
    touch.stall_signature = null;
    touch.stall_count = 0;
    touch.stall_history = [];
  }
  touch.criterion_hash = liveCriterionHash;

  let verdict;
  const lastFailure = ensureEvidence(touch).last_failure;
  const reusableRed =
    touch.dirty_since_verdict === false &&
    lastFailure &&
    typeof lastFailure === "object" &&
    String(lastFailure.criterion ?? "") === String(criterion ?? "");
  if (validationErrors.length) {
    verdict = { verdict: "fail", exit: null, output: "invalid run contract: " + validationErrors.join("; ") };
  } else if (reusableRed) {
    // Nothing write-shaped ran since the last red verdict, so the criterion
    // cannot have turned green by itself — reuse the red instead of paying a
    // full re-run. Green is never reused: a pass always comes from a fresh
    // run. Counters still advance below, so a loop that keeps stopping
    // without doing work still releases as stalled.
    verdict = { verdict: "fail", exit: lastFailure.exit ?? null, output: String(lastFailure.output_tail ?? ""), cached: true };
  } else {
    verdict = runCriterion(criterion, repo, timeoutSec);
    touch.dirty_since_verdict = false;
  }

  if (verdict.verdict === "pass") {
    // A green earned by editing the check itself is the one goalpost move the
    // command-string hash cannot see. Warn, never block: the edit may be a
    // legitimate test fix, and judging that stays with the human.
    const inputDrift = criterionInputDrift(touch, repo);
    touch.gate_blocks = 0;
    touch.stall_count = 0;
    touch.stall_signature = null;
    touch.stall_history = [];
    touch.status = "closed";
    touch.closed_at = utcNow();
    touch.closed_reason = "criterion passed";
    setTerminalState(touch, "success");
    const evidence = ensureEvidence(touch);
    evidence.last_failure = null;
    evidence.proved = dedupe([...evidence.proved, criterion]);
    writeJson(runContractPath(repo), touch);
    appendTerminalHistory(repo, touch, "stop-gate");
    if (inputDrift.length) {
      appendEvent(repo, {
        ...base,
        decision: "warn",
        reason:
          `criterion input files changed since init without amend: ${inputDrift.join(", ")} — ` +
          "if the edit redefined done, record it (amend --criterion --reason); a weakened check makes this green unproven",
        criterion_input_modified: true,
        changed_inputs: inputDrift,
      });
    }
    appendEvent(repo, { ...base, decision: "allow", reason: "criterion passed", criterion_exit: 0 });
    return 0;
  }

  if (verdict.verdict === "not_executable") {
    appendEvent(repo, {
      ...base,
      decision: "warn",
      reason: `criterion not executable: ${verdict.detail}; fix the criterion or close the run contract`,
      criterion_exit: verdict.exit,
    });
    return 0;
  }

  // Red criterion. Count consecutive blocks first so the cap holds even if a
  // runtime lacks a native override. gate_blocks_total is lifetime telemetry
  // and never gates a release (a long healthy loop reds many times overall).
  touch.gate_blocks = (Number.parseInt(String(touch.gate_blocks), 10) || 0) + 1;
  touch.gate_blocks_total = (Number.parseInt(String(touch.gate_blocks_total), 10) || 0) + 1;
  const failureLabel =
    (verdict.detail ?? `exit ${verdict.exit ?? "n/a"}`) +
    (verdict.cached ? "; cached verdict - nothing write-shaped ran since the last criterion run" : "");
  const reasonTail = outputTail(verdict.output);

  // Stall detection: an identical failure signature on consecutive stops is not
  // progress. Reset the counter whenever the signature changes so a loop that is
  // actually moving (different failure each round) is never marked stalled.
  const signature = failureSignature(verdict.exit, reasonTail);
  if (touch.stall_signature === signature) {
    touch.stall_count = (Number.parseInt(String(touch.stall_count), 10) || 0) + 1;
  } else {
    touch.stall_signature = signature;
    touch.stall_count = 1;
  }
  const stallCap = intField(budgetValue(touch, "max_stall_repeats", STALL_SIGNATURE_CAP), STALL_SIGNATURE_CAP);

  // A strict two-signature alternation (A,B,A,B,...) never repeats
  // consecutively, so the counter above reads it as progress — fix A breaks B,
  // fix B breaks A. Keep a short signature history and treat a full
  // alternating window of 2 * stallCap stops as the same non-progress loop.
  const oscillationWindow = 2 * stallCap;
  const stallHistory = (Array.isArray(touch.stall_history) ? touch.stall_history : []).map(String);
  stallHistory.push(signature);
  while (stallHistory.length > Math.max(oscillationWindow, 8)) stallHistory.shift();
  touch.stall_history = stallHistory;
  let oscillating = false;
  if (stallHistory.length >= oscillationWindow) {
    const tail = stallHistory.slice(-oscillationWindow);
    oscillating = tail[0] !== tail[1] && tail.every((sig, i) => sig === tail[i % 2]);
  }

  setLastFailure(touch, {
    summary: `criterion failed (${failureLabel})`,
    criterion,
    exit: verdict.exit,
    output_tail: reasonTail,
  });
  writeJson(runContractPath(repo), touch);

  if (mode !== "strict") {
    appendEvent(repo, {
      ...base,
      decision: "warn",
      reason: `criterion failed (${failureLabel})`,
      criterion_exit: verdict.exit,
    });
    return 0;
  }
  // Prefer `stalled` over `exhausted`: stallCap < cap, so a loop reding the
  // identical way releases early with the more informative terminal state; a
  // loop whose failure keeps changing only ever hits the blunt cap.
  const stalled = touch.stall_count >= stallCap || oscillating;
  const exhausted = touch.gate_blocks >= cap;
  if (stalled || exhausted) {
    const state = stalled ? "stalled" : "exhausted";
    const stallDetail =
      oscillating && touch.stall_count < stallCap
        ? `failure signatures alternating in a two-signature cycle across ${oscillationWindow} consecutive stops`
        : `same failure repeated ${touch.stall_count} times`;
    // Exhausted lumps two very different loops: one thrashing and one making
    // real progress slower than its budget. The signature history can tell
    // them apart — all-distinct signatures mean the failure changed on every
    // block, so name the moving case and point it at the lineage-recording
    // resume path instead of handing both the same dead end.
    const moving = !stalled && stallHistory.length >= 2 && new Set(stallHistory).size === stallHistory.length;
    touch.status = "closed";
    touch.closed_at = utcNow();
    touch.closed_reason = stalled
      ? `criterion gate stalled: ${stallDetail}`
      : `criterion gate exhausted${moving ? " while still moving" : ""}`;
    setTerminalState(touch, state);
    writeJson(runContractPath(repo), touch);
    appendTerminalHistory(repo, touch, "stop-gate");
    appendEvent(repo, {
      ...base,
      decision: "release",
      terminal_state: state,
      reason:
        (stalled
          ? `criterion gate released as stalled: ${stallDetail}`
          : `criterion gate released after ${touch.gate_blocks} consecutive blocks ` +
            `(${touch.gate_blocks_total} total this session)` +
            (moving
              ? " — every block had a distinct failure signature, so the loop was still moving when the " +
                "budget ran out; if the progress is real, re-init with the same criterion (lineage is recorded) " +
                "and continue from the snapshot"
              : "")) +
        (touchedFilesSummary(touch) ? `; machine-observed changed files ${touchedFilesSummary(touch)}` : "") +
        "; produce a resumable state snapshot (remaining criterion, current failure, next action — " +
        "changed files are machine-observed) before handing back",
      criterion_exit: verdict.exit,
    });
    return 0;
  }
  appendEvent(repo, {
    ...base,
    decision: "block",
    reason: `criterion failed (${failureLabel})`,
    criterion_exit: verdict.exit,
  });
  return block(
    `completion criterion not met (${failureLabel}): ${criterion}\n` +
      (reasonTail ? `--- criterion output (tail) ---\n${reasonTail}\n` : "") +
      `Fix the failure and re-verify; the stop gate releases as stalled after ${stallCap} identical ` +
      `consecutive failures or as exhausted after ${cap} consecutive blocks. ` +
      "If the criterion itself is wrong, change it with a recorded reason:\n" +
      `  node "${process.argv[1] ?? "agent-loop.mjs"}" amend --repo "${repo}" --criterion "<corrected check>" --reason "<why the goalpost moved>"\n` +
      "or close the run contract.",
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
  const file = runContractPath(repo);
  const existing = loadTouchList(repo);
  if (fs.existsSync(file)) {
    if (!values.force) {
      process.stderr.write(`${file} already exists; use --force to replace\n`);
      return 1;
    }
    const existingStatus = String((existing ?? {}).status ?? "active").toLowerCase();
    const existingSession = ownerSessionId(existing);
    const requestedSession = String(values.session ?? "").trim();
    const sameOwner = existingSession && requestedSession && existingSession === requestedSession;
    if (existingStatus === "active" && !sameOwner && !values.steal) {
      process.stderr.write(
        `${file} is active${existingSession ? ` for session ${existingSession}` : ""}; ` +
          "use the same --session, close it, or pass --steal --reason <why> to take ownership\n",
      );
      return 1;
    }
    if (values.steal && !String(values.reason ?? "").trim()) {
      process.stderr.write("--steal requires --reason <why>\n");
      return 1;
    }
  }
  const now = utcNow();
  const mode = String(values["concurrency-mode"] ?? "exclusive").toLowerCase();
  const data = {
    version: 2,
    status: "active",
    terminal_state: "active",
    goal: String(values.goal ?? values.criterion).trim(),
    enforcement: values.enforcement,
    unknown_write_policy: values["unknown-write-policy"],
    criterion: values.criterion.trim(),
    touch: {
      files: normalizePatterns(values.files ?? []),
      tables: normalizePatterns(values.tables ?? []),
      interfaces: normalizePatterns(values.interfaces ?? []),
      git: {
        allowed_ops: [],
        reason: "",
      },
    },
    budget: {
      max_iterations: intField(values["max-iterations"], GATE_BLOCK_CAP),
      max_git_ops: Number.parseInt(String(values["max-git-ops"] ?? "0"), 10) || 0,
      max_writes: Number.parseInt(String(values["max-writes"] ?? "0"), 10) || 0,
      max_wall_clock_minutes: Number.parseInt(String(values["max-wall-clock-minutes"] ?? "0"), 10) || 0,
      network_allowed: Boolean(values["network-allowed"]),
      network_allowlist: [],
      install_scripts_allowed: Boolean(values["install-scripts-allowed"]),
      destructive_allowed: Boolean(values["destructive-allowed"]),
      secrets_policy: values["secrets-policy"],
    },
    session: {
      mode,
      started_at: now,
      updated_at: now,
    },
    evidence: {
      proved: [],
      missing: [],
      contradicted: [],
      last_failure: null,
      iteration: 0,
    },
    review: {
      required: false,
      verdict: "skipped",
      blocking_count: 0,
      findings: [],
      evidence: null,
    },
    concurrency: {
      mode,
      integrator_session: values["integrator-session"] ? String(values["integrator-session"]).trim() : null,
      claims: [],
    },
  };
  // Session binding is normally adopted from the first hook event; --session
  // pins it explicitly when the caller knows its own id.
  if (values.session && String(values.session).trim()) {
    data.session.owner_session_id = String(values.session).trim();
  }
  if (values["git-allowed"]?.length) {
    data.touch.git.allowed_ops = values["git-allowed"].map((op) => String(op).trim().toLowerCase());
    data.touch.git.reason = String(values["git-reason"] ?? "").trim();
    if (!values["max-git-ops"] || values["max-git-ops"] === "0") {
      data.budget.max_git_ops = data.touch.git.allowed_ops.length;
    }
  }
  const errors = validateTouchList(data);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`error: ${error}\n`);
    return 1;
  }

  // Red-at-init gate: a done-when criterion for a task with work to do must be
  // RED before the work starts. A criterion that is already green cannot tell
  // "done" from "not started", so it proves nothing — the whole point of the
  // stop gate is that "green" is discriminating. Run it once here (the only
  // cheap moment to catch a non-discriminating criterion) with no semantic
  // judgment. Legitimately-green loops (noop verify, keep-green guard) declare
  // intent with --allow-green-init. A criterion the machine cannot execute is
  // refused in strict mode below: the stop gate would silently degrade to warn
  // on every stop, leaving the whole loop gateless without the agent noticing.
  const timeoutSec = intField(values["criterion-timeout-seconds"], CRITERION_TIMEOUT_SECONDS);
  // Persist the budget so the Stop gate uses the same timeout as this init
  // check — checkStop reads criterion_timeout_seconds from the run contract.
  data.criterion_timeout_seconds = timeoutSec;
  const initVerdict = runCriterion(data.criterion, repo, timeoutSec);
  data.evidence.init_criterion = {
    verdict: initVerdict.verdict,
    exit: initVerdict.exit ?? null,
    checked_at: now,
    allow_green_init: Boolean(values["allow-green-init"]),
    // An intentionally-green start is an exception; exceptions carry reasons.
    ...(values["allow-green-init"] ? { reason: String(values.reason ?? "").trim() } : {}),
  };
  // Freeze the criterion baseline so a later goalpost move is recordable —
  // the command string via its hash, the command's file inputs via
  // fingerprints (the check itself must not be silently rewritable mid-loop).
  data.criterion_hash = criterionHash(data.criterion);
  data.criterion_inputs = criterionInputPaths(data.criterion, repo);
  // Task lineage: budgets are per-contract and contracts are cheap to
  // recreate, so a re-init over a non-success close of the same criterion is
  // the same task continuing, not a new one. Record the lineage and resurface
  // the prior snapshot; severing it on purpose (--fresh) must leave a reason.
  const priorNonSuccess =
    isPlainObject(existing) &&
    lifecycleStatus(existing) === "closed" &&
    ["blocked", "stalled", "exhausted"].includes(terminalState(existing));
  const sameCriterion =
    isPlainObject(existing) &&
    String(existing.criterion_hash ?? criterionHash(existing.criterion)) === data.criterion_hash;
  if (priorNonSuccess && sameCriterion && !values.fresh) {
    const priorEvidence = isPlainObject(existing.evidence) ? existing.evidence : {};
    const priorFailure = isPlainObject(priorEvidence.last_failure)
      ? String(priorEvidence.last_failure.summary ?? "").trim()
      : "";
    const priorSnapshot = String(priorEvidence.snapshot ?? "").trim() || priorFailure;
    data.resume_of = {
      closed_at: existing.closed_at ?? null,
      terminal_state: terminalState(existing),
    };
    data.resume_count = (Number.parseInt(String(existing.resume_count), 10) || 0) + 1;
    data.gate_blocks_total = Number.parseInt(String(existing.gate_blocks_total), 10) || 0;
    const priorTouched = touchedFilesSummary(existing);
    process.stdout.write(
      `resuming task: same criterion closed ${terminalState(existing)}` +
        `${existing.closed_at ? ` at ${existing.closed_at}` : ""} (resume #${data.resume_count}); ` +
        `prior snapshot: ${priorSnapshot || "none recorded"}` +
        (priorTouched ? `; machine-observed changed files ${priorTouched}` : "") +
        "\n",
    );
  }
  if (initVerdict.verdict === "not_executable") {
    const mustBlock = String(data.enforcement).toLowerCase() === "strict";
    const message =
      `criterion cannot run at init (${initVerdict.detail ?? "spawn error"}): ${data.criterion}\n` +
      "a criterion the machine cannot execute leaves the loop gateless - the stop gate would " +
      "silently degrade to warn on every stop. Fix the command (path, runtime, quoting) and " +
      "re-run init; if this was a transient environment failure, re-running init is enough.\n";
    if (mustBlock) {
      process.stderr.write(message);
      return 1;
    }
    process.stderr.write(`warning: ${message}`);
  }
  if (initVerdict.verdict === "pass" && !values["allow-green-init"]) {
    const mustBlock = String(data.enforcement).toLowerCase() === "strict";
    const message =
      `criterion is already green before any work: ${data.criterion}\n` +
      "a done-when criterion for a task with work to do must be red at init; " +
      "an already-green criterion cannot prove this loop. Fix the criterion so it " +
      "fails until the work is done, or pass --allow-green-init --reason <why> for " +
      "an intentional noop/keep-green loop.\n";
    if (mustBlock) {
      process.stderr.write(message);
      return 1;
    }
    process.stderr.write(`warning: ${message}`);
  }

  writeJson(file, data);
  appendEvent(repo, {
    event: "Init",
    decision: initVerdict.verdict === "pass" && !values["allow-green-init"] ? "warn" : "observe",
    evidence_kind: "loop_runtime",
    repo: String(repo),
    init_criterion: initVerdict.verdict,
    ...(values["allow-green-init"] ? { green_init_reason: String(values.reason ?? "").trim() } : {}),
    ...(values.steal ? { reason: `stolen: ${values.reason}`, previous_session_id: ownerSessionId(existing) || null } : {}),
    ...(data.resume_of
      ? { resume_count: data.resume_count, resume_of_terminal_state: data.resume_of.terminal_state }
      : {}),
    ...(values.fresh ? { fresh_start: true, fresh_reason: String(values.reason ?? "").trim() } : {}),
  });
  process.stdout.write(`created ${file}\n`);
  return 0;
}

function cmdValidate(values) {
  const repo = repoFromArg(values.repo);
  const touch = loadTouchList(repo);
  const errors = validateTouchList(touch);
  const file = runContractPath(repo);
  if (errors.length) {
    process.stdout.write(`${file}: invalid\n`);
    for (const error of errors) process.stdout.write(`- ${error}\n`);
    return 1;
  }
  process.stdout.write(`${file}: ok\n`);
  return 0;
}

function cmdClaim(values) {
  const repo = repoFromArg(values.repo);
  const file = runContractPath(repo);
  const touch = loadTouchList(repo);
  if (touch === null) {
    process.stderr.write(`${file} does not exist; run init first\n`);
    return 1;
  }
  if (touch.version !== SCHEMA_VERSION) {
    process.stderr.write(`${file} is not a v2 runtime contract; recreate it with init\n`);
    return 1;
  }
  const sid = String(values.session ?? "").trim();
  const files = normalizePatterns(values.files ?? []);
  if (!sid) {
    process.stderr.write("--session is required\n");
    return 1;
  }
  if (!files.length) {
    process.stderr.write("--files is required\n");
    return 1;
  }
  if (!isPlainObject(touch.session)) touch.session = {};
  if (!isPlainObject(touch.concurrency)) touch.concurrency = {};
  touch.session.mode = "partitioned";
  touch.session.updated_at = utcNow();
  touch.concurrency.mode = "partitioned";
  if (values["integrator-session"]) {
    touch.concurrency.integrator_session = String(values["integrator-session"]).trim();
  } else if (!touch.concurrency.integrator_session) {
    touch.concurrency.integrator_session = ownerSessionId(touch) || null;
  }
  if (!Array.isArray(touch.concurrency.claims)) touch.concurrency.claims = [];
  const existingIndex = touch.concurrency.claims.findIndex((claim) => String(claim.session_id ?? "").trim() === sid);
  if (existingIndex !== -1 && !values.force) {
    process.stderr.write(`claim for session ${sid} already exists; use --force to replace\n`);
    return 1;
  }
  const claim = {
    session_id: sid,
    role: String(values.role ?? "writer").trim() || "writer",
    files,
    criterion: String(values.criterion ?? "").trim() || null,
    state: "active",
  };
  if (existingIndex === -1) touch.concurrency.claims.push(claim);
  else touch.concurrency.claims[existingIndex] = claim;
  const errors = validateTouchList(touch);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`error: ${error}\n`);
    return 1;
  }
  writeJson(file, touch);
  appendEvent(repo, {
    event: "Claim",
    decision: "observe",
    evidence_kind: "loop_runtime",
    repo: String(repo),
    session_id: sid,
  });
  process.stdout.write(`claimed ${files.length} file pattern(s) for ${sid}\n`);
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
    `state=present status=${lifecycleStatus(touch)} terminal_state=${terminalState(touch)} enforcement=${enforcementMode(touch)}\n`,
  );
  process.stdout.write(
    "scope=" +
      `files:${normalizePatterns(scopeEntries(touch, "files")).length} ` +
      `tables:${normalizePatterns(scopeEntries(touch, "tables")).length} ` +
      `interfaces:${normalizePatterns(scopeEntries(touch, "interfaces")).length}\n`,
  );
  process.stdout.write(`criterion=${criterionValue(touch) || "(missing)"}\n`);
  process.stdout.write(`concurrency=${concurrencyMode(touch)} owner=${ownerSessionId(touch) || "(unbound)"}\n`);
  const evidence = objectField(touch, "evidence");
  process.stdout.write(
    `evidence=iteration:${Number.parseInt(String(evidence.iteration ?? "0"), 10) || 0} ` +
      `missing:${Array.isArray(evidence.missing) ? evidence.missing.length : 0} ` +
      `contradicted:${Array.isArray(evidence.contradicted) ? evidence.contradicted.length : 0} ` +
      `git_ops:${Array.isArray(evidence.git_ops) ? evidence.git_ops.length : 0}\n`,
  );
  process.stdout.write(
    "events_note=agent loop runtime events prove scope/process only; they are not business verification\n",
  );
  if (errors.length) {
    process.stdout.write("valid=false\n");
    for (const error of errors) process.stdout.write(`error=${error}\n`);
    return 1;
  }
  process.stdout.write("valid=true\n");
  const limit = Number.parseInt(String(values.limit ?? "5"), 10) || 5;
  for (const row of readEvents(repo, limit)) {
    process.stdout.write(
      "event=" +
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
  const file = runContractPath(repo);
  if (touch === null) {
    process.stderr.write(`${file} does not exist\n`);
    return 1;
  }
  // No default terminal state: `success` by omission would let an unfinished
  // loop close green without anyone choosing that, and close is the one
  // success-writing path the stop gate does not adjudicate.
  const requestedTerminalState = String(values["terminal-state"] ?? "").trim();
  if (!requestedTerminalState) {
    process.stderr.write(
      "--terminal-state is required: success|noop|blocked|stalled|exhausted\n",
    );
    return 2;
  }
  if (requestedTerminalState === "active" || !VALID_TERMINAL_STATES.has(requestedTerminalState)) {
    process.stderr.write(
      `terminal-state must be one of ${[...VALID_TERMINAL_STATES].filter((s) => s !== "active").sort().join(", ")}\n`,
    );
    return 2;
  }
  // A closed contract already recorded its one terminal event (and one history
  // row); a retried close must not rewrite the terminal state or append a
  // duplicate row that would pollute the outcome metrics.
  if (lifecycleStatus(touch) === "closed") {
    process.stderr.write(
      `${file} is already closed (terminal_state ${terminalState(touch)}); re-init to start a new loop\n`,
    );
    return 1;
  }
  // Non-success closes must leave a machine-held resumable snapshot: the next
  // loop resumes from it instead of rediscovering the failure scene.
  const snapshot = String(values.snapshot ?? "").trim();
  if (["blocked", "stalled", "exhausted"].includes(requestedTerminalState) && !snapshot) {
    process.stderr.write(
      `--snapshot is required for terminal-state ${requestedTerminalState}: ` +
        '"<remaining criterion; current failure; next safe action>" ' +
        "(changed files are machine-observed in evidence.touched_files)\n",
    );
    return 2;
  }
  // Success through close gets the same adjudication the stop gate applies:
  // green must come from a fresh criterion run. `off` observes nothing, and a
  // criterion the machine cannot execute degrades to a loud warning instead of
  // trapping the close (mirroring the gate's not_executable release).
  if (requestedTerminalState === "success" && enforcementMode(touch) !== "off") {
    const criterion = criterionValue(touch);
    const timeoutSec = intField(touch.criterion_timeout_seconds, CRITERION_TIMEOUT_SECONDS);
    const verdict = runCriterion(criterion, repo, timeoutSec);
    if (verdict.verdict === "fail") {
      const tail = outputTail(verdict.output);
      process.stderr.write(
        `close to success refused: criterion is red (${verdict.detail ?? `exit ${verdict.exit ?? "n/a"}`}): ${criterion}\n` +
          (tail ? `--- criterion output (tail) ---\n${tail}\n` : "") +
          "success must come from a green criterion. Fix the failure and retry, amend the " +
          "criterion with a recorded reason, or close with the honest state " +
          '(blocked|stalled|exhausted) plus --snapshot "<changed; remaining; failure; next>".\n',
      );
      appendEvent(repo, {
        event: "Close",
        decision: "deny",
        evidence_kind: "loop_runtime",
        repo: String(repo),
        reason: "close to success refused: criterion red",
        criterion_exit: verdict.exit,
      });
      return 1;
    }
    if (verdict.verdict === "not_executable") {
      process.stderr.write(
        `warning: criterion cannot run (${verdict.detail ?? "spawn error"}); closing success on the agent's claim alone\n`,
      );
    } else {
      const evidence = ensureEvidence(touch);
      evidence.proved = dedupe([...evidence.proved, criterion]);
      evidence.last_failure = null;
      const inputDrift = criterionInputDrift(touch, repo);
      if (inputDrift.length) {
        process.stderr.write(
          `warning: criterion input files changed since init without amend: ${inputDrift.join(", ")}; ` +
            "if the edit redefined done, record it (amend --criterion --reason)\n",
        );
        appendEvent(repo, {
          event: "Close",
          decision: "warn",
          evidence_kind: "loop_runtime",
          repo: String(repo),
          reason: `criterion input files changed since init without amend: ${inputDrift.join(", ")}`,
          criterion_input_modified: true,
          changed_inputs: inputDrift,
        });
      }
    }
  }
  if (snapshot) {
    ensureEvidence(touch);
    touch.evidence.snapshot = snapshot;
  }
  touch.status = "closed";
  setTerminalState(touch, requestedTerminalState);
  touch.closed_reason = String(values.reason ?? "complete").trim();
  touch.closed_at = utcNow();
  writeJson(file, touch);
  appendTerminalHistory(repo, touch, "close");
  appendEvent(repo, {
    event: "Close",
    decision: "observe",
    evidence_kind: "loop_runtime",
    repo: String(repo),
    reason: String(values.reason ?? "complete").trim(),
    terminal_state: requestedTerminalState,
  });
  process.stdout.write(`closed ${file}\n`);
  return 0;
}

// Blessed contract evolution: the only path that attaches a reason to a moved
// goalpost (criterion) or a widened scope (files). Amending a criterion resets
// the stall identity (failures now belong to a new check); amending scope does
// not (the check is unchanged). Neither refills the block budget — amend fixes
// the target, it does not buy more iterations. Re-init is the way to reset
// budget. Scope amend only appends: narrowing scope is rare enough that
// re-init is the honest path for it.
function cmdAmend(values) {
  const repo = repoFromArg(values.repo);
  const touch = loadTouchList(repo);
  const file = runContractPath(repo);
  if (touch === null) {
    process.stderr.write(`${file} does not exist\n`);
    return 1;
  }
  if (lifecycleStatus(touch) !== "active") {
    process.stderr.write(`${file} is not active (status ${lifecycleStatus(touch)}); re-init to start a new loop\n`);
    return 1;
  }
  const next = String(values.criterion ?? "").trim();
  const addFiles = normalizePatterns(values.files ?? []);
  if (!next && !addFiles.length) {
    process.stderr.write("amend requires --criterion <new check> and/or --files <glob>\n");
    return 2;
  }
  const reason = String(values.reason ?? "").trim();
  if (!reason) {
    process.stderr.write("amend requires --reason <why the goalpost moved>\n");
    return 2;
  }
  const event = {
    event: "Amend",
    decision: "observe",
    evidence_kind: "loop_runtime",
    repo: String(repo),
    reason,
    via: "amend",
  };
  if (next) {
    const previous = criterionValue(touch);
    const previousHash = touch.criterion_hash ?? criterionHash(previous);
    touch.criterion = next;
    touch.criterion_hash = criterionHash(next);
    touch.criterion_inputs = criterionInputPaths(next, repo);
    touch.stall_signature = null;
    touch.stall_count = 0;
    touch.stall_history = [];
    event.criterion_amended = true;
    event.previous_hash = previousHash;
    event.new_hash = touch.criterion_hash;
  }
  if (addFiles.length) {
    if (!isPlainObject(touch.touch)) touch.touch = {};
    touch.touch.files = dedupe([...scopeEntries(touch, "files"), ...addFiles]);
    event.scope_amended = true;
    event.added_files = addFiles;
  }
  const errors = validateTouchList(touch);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`error: ${error}\n`);
    return 1;
  }
  writeJson(file, touch);
  appendEvent(repo, event);
  process.stdout.write(
    `amended ${[next ? "criterion" : null, addFiles.length ? "scope" : null].filter(Boolean).join(" and ")} in ${file}\n`,
  );
  return 0;
}

const CLI_OPTIONS = {
  init: {
    repo: { type: "string" },
    files: { type: "string", multiple: true },
    tables: { type: "string", multiple: true },
    interfaces: { type: "string", multiple: true },
    criterion: { type: "string" },
    "criterion-timeout-seconds": { type: "string" },
    "allow-green-init": { type: "boolean", default: false },
    goal: { type: "string" },
    session: { type: "string" },
    "concurrency-mode": { type: "string", default: "exclusive" },
    "integrator-session": { type: "string" },
    "max-iterations": { type: "string", default: String(GATE_BLOCK_CAP) },
    "max-git-ops": { type: "string", default: "0" },
    "max-writes": { type: "string", default: "0" },
    "max-wall-clock-minutes": { type: "string", default: "0" },
    "network-allowed": { type: "boolean", default: false },
    "install-scripts-allowed": { type: "boolean", default: false },
    "destructive-allowed": { type: "boolean", default: false },
    "secrets-policy": { type: "string", default: "deny_env_dump" },
    "git-allowed": { type: "string", multiple: true },
    "git-reason": { type: "string" },
    enforcement: { type: "string", default: "strict" },
    "unknown-write-policy": { type: "string", default: "warn" },
    force: { type: "boolean", default: false },
    steal: { type: "boolean", default: false },
    fresh: { type: "boolean", default: false },
    reason: { type: "string" },
  },
  status: {
    repo: { type: "string" },
    limit: { type: "string", default: "5" },
  },
  validate: {
    repo: { type: "string" },
  },
  claim: {
    repo: { type: "string" },
    session: { type: "string" },
    files: { type: "string", multiple: true },
    criterion: { type: "string" },
    role: { type: "string", default: "writer" },
    "integrator-session": { type: "string" },
    force: { type: "boolean", default: false },
  },
  close: {
    repo: { type: "string" },
    reason: { type: "string", default: "complete" },
    "terminal-state": { type: "string" },
    snapshot: { type: "string" },
  },
  amend: {
    repo: { type: "string" },
    criterion: { type: "string" },
    files: { type: "string", multiple: true },
    reason: { type: "string" },
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
    if (!VALID_CONCURRENCY_MODES.has(values["concurrency-mode"])) {
      return cliError(`--concurrency-mode must be one of ${[...VALID_CONCURRENCY_MODES].sort().join(", ")}`);
    }
    if (!VALID_SECRETS_POLICIES.has(values["secrets-policy"])) {
      return cliError(`--secrets-policy must be one of ${[...VALID_SECRETS_POLICIES].sort().join(", ")}`);
    }
    if (intField(values["max-iterations"], 0) < 1) {
      return cliError("--max-iterations must be a positive integer");
    }
    if (Number.parseInt(String(values["max-git-ops"]), 10) < 0) {
      return cliError("--max-git-ops must be a non-negative integer");
    }
    for (const flag of ["max-writes", "max-wall-clock-minutes"]) {
      if (Number.parseInt(String(values[flag]), 10) < 0) {
        return cliError(`--${flag} must be a non-negative integer`);
      }
    }
    for (const op of values["git-allowed"] ?? []) {
      const normalized = String(op).trim().toLowerCase();
      if (normalized !== "*" && !VALID_GIT_OPS.has(normalized)) {
        return cliError(`--git-allowed must be one of ${[...VALID_GIT_OPS].sort().join(", ")} or *`);
      }
    }
    if ((values["git-allowed"] ?? []).length && !String(values["git-reason"] ?? "").trim()) {
      return cliError("--git-reason is required when --git-allowed is used");
    }
    if (values["allow-green-init"] && !String(values.reason ?? "").trim()) {
      return cliError("--allow-green-init requires --reason <why a green start is intentional>");
    }
    if (values.fresh && !String(values.reason ?? "").trim()) {
      return cliError("--fresh requires --reason <why the same-criterion lineage is severed>");
    }
    return cmdInit(values);
  }
  if (command === "status") return cmdStatus(values);
  if (command === "validate") return cmdValidate(values);
  if (command === "claim") return cmdClaim(values);
  if (command === "amend") return cmdAmend(values);
  return cmdClose(values);
}

// The CLI's first screen is a copyable init template: agents groping for the
// interface should get the command, not an option dump or a parse error
// (observed: six --help attempts followed by source-diving in one session).
function cmdHelp() {
  process.stdout.write(
    "agent-loop.mjs - project-local run contract + criterion gate (PreToolUse/Stop hook + CLI)\n" +
      "\n" +
      "start a loop (copy, fill in, run):\n" +
      '  node ~/bin/agent-loop.mjs init --repo <repo> --files "<glob>" [--files ...] \\\n' +
      '    --criterion "<machine-checkable check, red until the task is done>" \\\n' +
      '    --goal "<one line>" [--session <id>] [--force]\n' +
      "\n" +
      "other commands:\n" +
      "  status --repo <repo> [--limit N]                       read-only state + recent events\n" +
      '  amend  --repo <repo> [--criterion "<new>"] [--files "<glob>"] --reason "<why>"   move the goalpost / widen scope, recorded\n' +
      '  claim  --repo <repo> --session <id> --files "<glob>"   partitioned same-worktree concurrency\n' +
      '  close  --repo <repo> --terminal-state <success|noop|blocked|stalled|exhausted> --reason "<why>" \\\n' +
      '         [--snapshot "<changed; remaining; failure; next>"]   # success re-runs the criterion; blocked/stalled/exhausted require --snapshot\n' +
      "  validate --repo <repo>                                 schema check only\n" +
      "\n" +
      "rules: the criterion must be executable and red at init; git operations need\n" +
      "--git-allowed <op> --git-reason <why>; state lives in .agent-loop/ (gitignored).\n",
  );
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length && ["help", "--help", "-h"].includes(argv[0])) {
    return cmdHelp();
  }
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
    // (e.g. an unwritable event/state dir). Degrade loudly to a released stop
    // instead of an uncaught non-zero exit that a runtime might misread.
    try {
      return checkStop(payload, repo, touch);
    } catch (err) {
      process.stderr.write(
        `agent-loop: stop gate degraded (${err && err.message ? err.message : err}); allowing stop\n`,
      );
      return 0;
    }
  }
  if (stateEnabled(repo, touch)) {
    appendEvent(repo, {
      ...eventBase(payload, repo, event || "unknown", toolName(payload)),
      decision: "observe",
    });
  }
  return 0;
}

process.exit(main());
