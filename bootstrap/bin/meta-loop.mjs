#!/usr/bin/env node
// Meta-loop backlog CLI - durable, resumable state for the skill-evolution loop.
//
// The meta-loop (analyze sessions -> improve skills) is long and runs across
// sessions and months, so it must not live in one chat's context window. This
// CLI holds the durable, git-tracked, *sanitized* state a fresh-context Ralph
// iteration reads to know its single next unit of work:
//
//     docs/meta-loop/backlog.jsonl   one JSON object per candidate
//     docs/meta-loop/rounds/         one AGENTS.md round note per resolved candidate
//
// Private session corpus (loop-health.txt, corrections.txt) stays gitignored
// under docs/research/; only neutral, reviewable candidates and decisions live
// here. node:* builtins only (Node 18+), matching agent-loop.mjs.
//
// One fresh-context iteration:
//     meta-loop.mjs next            # claim the next unit or "none"
//     ...run ONE AGENTS.md evidence round on it...
//     meta-loop.mjs resolve --id ID --decision accept|reject|continue --note PATH
// Then exit; the runtime re-feeds a fresh context. See docs/meta-loop/README.md.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const META_DIR = "docs/meta-loop";
const BACKLOG = "backlog.jsonl";
const VALID_STATUS = ["pending", "in_progress", "accepted", "rejected", "deferred"];
const TERMINAL = new Set(["accepted", "rejected", "deferred"]);
const DECISION_TO_STATUS = { accept: "accepted", reject: "rejected", continue: "in_progress" };
// An in_progress claim older than this is treated as stale (crashed round) and
// surfaced by `status`, so a missed/stuck month is visible.
const STALE_CLAIM_SECONDS = 6 * 3600;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function now() {
  return new Date().toISOString().slice(0, 19) + "Z";
}

function epoch(ts) {
  const ms = Date.parse(String(ts));
  return Number.isNaN(ms) ? 0 : ms / 1000;
}

function expandUser(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function gitRoot(cwd) {
  try {
    const out = execFileSync("git", ["-C", String(cwd), "rev-parse", "--show-toplevel"], {
      encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "pipe"],
    });
    const root = out.trim();
    if (root) return path.resolve(root);
  } catch {
    // fall through
  }
  return path.resolve(cwd);
}

function repoRoot(arg) {
  if (arg) return path.resolve(expandUser(arg));
  const env = process.env.ASDF_REPO;
  if (env) return path.resolve(expandUser(env));
  return gitRoot(process.cwd());
}

function backlogPath(repo) {
  return path.join(repo, META_DIR, BACKLOG);
}

function loadBacklog(repo) {
  const file = backlogPath(repo);
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let data;
    try {
      data = JSON.parse(line);
    } catch {
      rows.push({ _invalid: line });
      continue;
    }
    rows.push(isPlainObject(data) ? data : { _invalid: line });
  }
  return rows;
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

function writeBacklog(repo, rows) {
  const file = backlogPath(repo);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = rows.map((row) => JSON.stringify(sortDeep(row)));
  fs.writeFileSync(file, lines.length ? lines.join("\n") + "\n" : "", "utf8");
}

function nextId(rows) {
  const nums = rows
    .filter((r) => typeof r.id === "string" && /^C\d+$/.test(r.id))
    .map((r) => Number.parseInt(r.id.slice(1), 10));
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return "C" + String(n).padStart(3, "0");
}

function validateRows(rows) {
  const errors = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    if (row._invalid) {
      errors.push(`line ${i + 1}: not valid JSON object`);
      return;
    }
    const cid = row.id;
    if (typeof cid !== "string" || !cid) errors.push(`line ${i + 1}: missing id`);
    else if (seen.has(cid)) errors.push(`duplicate id ${cid}`);
    else seen.add(cid);
    if (!String(row.skill ?? "").trim()) errors.push(`${cid}: missing skill`);
    if (!String(row.failure_mode ?? "").trim()) errors.push(`${cid}: missing failure_mode`);
    const status = row.status;
    if (!VALID_STATUS.includes(status)) {
      errors.push(`${cid}: status must be one of ${JSON.stringify(VALID_STATUS)}`);
    }
    if (TERMINAL.has(status) && !String(row.decision ?? "").trim()) {
      errors.push(`${cid}: terminal status requires a decision`);
    }
  });
  return errors;
}

function actionable(rows) {
  // The single active unit of work: any in_progress claim (resume/continue it —
  // fresh means keep working, stale means a prior round crashed) blocks a new
  // claim, enforcing one candidate per iteration; else the oldest pending.
  const inProgress = rows.filter((r) => r.status === "in_progress");
  if (inProgress.length) {
    return inProgress.sort((a, b) => String(a.claimed_at ?? "").localeCompare(String(b.claimed_at ?? "")))[0];
  }
  const pending = rows.filter((r) => r.status === "pending");
  if (pending.length) {
    return pending.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))[0];
  }
  return null;
}

function isStale(row) {
  return row.status === "in_progress" && Date.now() / 1000 - epoch(row.claimed_at) > STALE_CLAIM_SECONDS;
}

function cmdEnqueue(v) {
  const repo = repoRoot(v.repo);
  const rows = loadBacklog(repo);
  const errors = validateRows(rows);
  if (errors.length) {
    process.stderr.write("refusing to enqueue onto an invalid backlog:\n");
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    return 1;
  }
  const cid = nextId(rows);
  rows.push({
    id: cid,
    skill: v.skill.trim(),
    failure_mode: v.failure.trim(),
    evidence: (v.evidence ?? "").trim(),
    status: "pending",
    created_at: now(),
    updated_at: now(),
  });
  writeBacklog(repo, rows);
  process.stdout.write(cid + "\n");
  return 0;
}

function cmdNext(v) {
  const repo = repoRoot(v.repo);
  const rows = loadBacklog(repo);
  const errors = validateRows(rows);
  if (errors.length) {
    process.stdout.write("none\n");
    process.stderr.write("backlog invalid; run `meta-loop.mjs validate`:\n");
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    return 1;
  }
  const item = actionable(rows);
  if (item === null) {
    process.stdout.write("none\n");
    return 0;
  }
  if (item.status === "pending" || isStale(item)) {
    item.status = "in_progress";
    item.claimed_at = now();
    item.updated_at = now();
    if (v.session) item.session = v.session.trim();
    writeBacklog(repo, rows);
  }
  process.stdout.write(JSON.stringify(sortDeep(item)) + "\n");
  return 0;
}

function cmdResolve(v) {
  const repo = repoRoot(v.repo);
  const rows = loadBacklog(repo);
  const row = rows.find((r) => r.id === v.id);
  if (!row) {
    process.stderr.write(`no candidate ${v.id}\n`);
    return 1;
  }
  row.status = DECISION_TO_STATUS[v.decision];
  row.decision = v.decision;
  row.updated_at = now();
  if (v.decision === "continue") row.claimed_at = now();
  if (v.note) row.round_note = v.note.trim();
  writeBacklog(repo, rows);
  process.stdout.write(`${v.id} -> ${row.status}\n`);
  return 0;
}

function cmdStatus(v) {
  const repo = repoRoot(v.repo);
  const rows = loadBacklog(repo);
  const counts = Object.fromEntries(VALID_STATUS.map((s) => [s, 0]));
  for (const r of rows) counts[r.status ?? "pending"] = (counts[r.status ?? "pending"] ?? 0) + 1;
  process.stdout.write(`repo=${repo}\n`);
  process.stdout.write(`backlog=${backlogPath(repo)}\n`);
  process.stdout.write("counts=" + VALID_STATUS.map((s) => `${s}:${counts[s] ?? 0}`).join(" ") + "\n");
  const item = actionable(rows);
  process.stdout.write("next=" + (item ? item.id : "none (backlog drained)") + "\n");
  const stale = rows.filter(isStale).map((r) => r.id);
  if (stale.length) {
    process.stdout.write(
      `stale_claims=${stale.join(",")} (a prior round likely crashed; the next iteration resumes it)\n`,
    );
  }
  const errors = validateRows(rows);
  process.stdout.write("valid=" + (errors.length ? "false" : "true") + "\n");
  for (const e of errors) process.stdout.write(`error=${e}\n`);
  return errors.length ? 1 : 0;
}

function cmdList(v) {
  const repo = repoRoot(v.repo);
  for (const r of loadBacklog(repo)) {
    if (v.status && r.status !== v.status) continue;
    process.stdout.write(
      JSON.stringify(sortDeep({
        id: r.id ?? null, skill: r.skill ?? null, status: r.status ?? null,
        failure_mode: r.failure_mode ?? null, decision: r.decision ?? null,
      })) + "\n",
    );
  }
  return 0;
}

function cmdValidate(v) {
  const repo = repoRoot(v.repo);
  const rows = loadBacklog(repo);
  const errors = validateRows(rows);
  if (errors.length) {
    process.stdout.write(`${backlogPath(repo)}: invalid\n`);
    for (const e of errors) process.stdout.write(`- ${e}\n`);
    return 1;
  }
  process.stdout.write(`${backlogPath(repo)}: ok (${rows.length} candidates)\n`);
  return 0;
}

const COMMANDS = {
  enqueue: {
    options: {
      repo: { type: "string" }, skill: { type: "string" },
      failure: { type: "string" }, evidence: { type: "string" },
    },
    required: ["skill", "failure"],
    run: cmdEnqueue,
  },
  next: {
    options: { repo: { type: "string" }, session: { type: "string" } },
    required: [],
    run: cmdNext,
  },
  resolve: {
    options: { repo: { type: "string" }, id: { type: "string" }, decision: { type: "string" }, note: { type: "string" } },
    required: ["id", "decision"],
    run: cmdResolve,
  },
  status: { options: { repo: { type: "string" } }, required: [], run: cmdStatus },
  list: { options: { repo: { type: "string" }, status: { type: "string" } }, required: [], run: cmdList },
  validate: { options: { repo: { type: "string" } }, required: [], run: cmdValidate },
};

function usage() {
  process.stderr.write(
    "usage: meta-loop.mjs {enqueue,next,resolve,status,list,validate} [--repo R] ...\n",
  );
}

function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || !Object.hasOwn(COMMANDS, command)) {
    usage();
    return 2;
  }
  const spec = COMMANDS[command];
  let values;
  try {
    ({ values } = parseArgs({ args: argv.slice(1), options: spec.options, allowPositionals: false }));
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return 2;
  }
  for (const req of spec.required) {
    if (typeof values[req] !== "string" || !values[req]) {
      process.stderr.write(`error: ${command} requires --${req}\n`);
      return 2;
    }
  }
  if (command === "resolve" && !Object.hasOwn(DECISION_TO_STATUS, values.decision)) {
    process.stderr.write(`error: --decision must be one of ${Object.keys(DECISION_TO_STATUS).sort().join(", ")}\n`);
    return 2;
  }
  if (command === "list" && values.status && !VALID_STATUS.includes(values.status)) {
    process.stderr.write(`error: --status must be one of ${VALID_STATUS.join(", ")}\n`);
    return 2;
  }
  return spec.run(values);
}

process.exit(main());
