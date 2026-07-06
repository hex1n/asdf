#!/usr/bin/env node
// Read-only E2E execution-report checker, usable as a taskloop Stop-gate
// criterion. It answers one question with an exit code: did the selected
// scenarios pass on the current build? It NEVER re-runs the executor — the Stop
// gate re-runs its criterion on every stop, so a criterion that re-ran the E2E
// suite would run it 3-8x per loop and create real data. The executor runs once
// and writes its report; this checks that report cheaply and idempotently.
//
// Dogfood-harvested requirements (docs/research/2026-07-03-backend-loop-dogfood-harvest.md):
//   F1  require an explicit scenario set — a missing required scenario is a
//       failure, never a vacuous pass.
//   F2  verify build freshness — a report from a previous build must not read
//       green; compare the report's loaded-build fingerprint to the current one.
//   F3  parse the default, test-frozen Markdown `Scenario Results` table as the
//       primary source; accept scenario-results.jsonl only as an opt-in fast path.
//   F4  read-only / idempotent; exit 0 pass, 1 scenario failure, 2 unusable.
//
// Exit: 0 all required passed (and fresh) | 1 a required/any scenario failed or
// a required scenario is missing | 2 report absent/malformed, stale build, or
// freshness unverifiable.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArgs } from "node:util";

const TERMINAL = new Set(["passed", "failed", "blocked", "skipped"]);

function fail(code, message) {
  process.stderr.write(`e2e-report-check: ${message}\n`);
  return code;
}

function splitIds(value) {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== "none");
}

// Parse the Markdown `Scenario Results` table into {id: status}. Robust to
// column order: it locates the Scenario and Status columns from the header.
function parseMarkdownResults(text) {
  const lines = text.split(/\r?\n/);
  let i = lines.findIndex((l) => /^#{1,6}\s+.*scenario results/i.test(l));
  if (i < 0) return null;
  i += 1;
  const rows = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line)) break; // next section
    if (/^\s*\|/.test(line)) rows.push(line);
    else if (rows.length) break; // table ended
  }
  if (rows.length < 2) return null;
  const cells = (row) =>
    row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  const header = cells(rows[0]).map((h) => h.toLowerCase());
  const idCol = header.findIndex((h) => h.includes("scenario"));
  const statusCol = header.findIndex((h) => h === "status" || h.includes("status"));
  if (idCol < 0 || statusCol < 0) return null;
  const map = {};
  for (const row of rows.slice(1)) {
    const c = cells(row);
    if (c.every((x) => /^:?-+:?$/.test(x))) continue; // separator row
    const id = (c[idCol] ?? "").replace(/`/g, "").trim();
    const status = (c[statusCol] ?? "").replace(/`/g, "").trim().toLowerCase();
    if (id && TERMINAL.has(status)) map[id] = status;
  }
  return Object.keys(map).length ? map : null;
}

function parseJsonlResults(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try {
      obj = JSON.parse(t);
    } catch {
      return null;
    }
    const id = String(obj.scenario ?? obj.id ?? "").trim();
    const status = String(obj.status ?? "").trim().toLowerCase();
    if (id && TERMINAL.has(status)) map[id] = status;
  }
  return Object.keys(map).length ? map : null;
}

// Freshness: extract "<algo> <hex>" or "<algo>:<hex>" from the report, hash the
// current build artifact(s) with the same algo, and compare.
function reportFingerprint(text) {
  const m = text.match(/\b(md5|sha1|sha256)\b[\s:=]+([0-9a-f]{32,64})/i);
  return m ? { algo: m[1].toLowerCase(), hex: m[2].toLowerCase() } : null;
}

function currentFingerprint(algo, buildPaths) {
  const hash = crypto.createHash(algo);
  for (const p of buildPaths) {
    hash.update(fs.readFileSync(p));
  }
  return hash.digest("hex");
}

function run(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        report: { type: "string" },
        results: { type: "string" },
        "require-passed": { type: "string" },
        "allow-blocked": { type: "string", default: "none" },
        build: { type: "string" },
        "no-freshness": { type: "boolean", default: false },
      },
      allowPositionals: false,
    }));
  } catch (err) {
    return fail(2, err.message);
  }

  const reportPath = values.report;
  if (!reportPath) return fail(2, "--report <execution-report.md> is required");
  if (!values["require-passed"] || !splitIds(values["require-passed"]).length) {
    return fail(2, "--require-passed <S001,S002,...> is required (an explicit scenario set)");
  }
  if (!fs.existsSync(reportPath)) return fail(2, `report not found: ${reportPath}`);
  const reportText = fs.readFileSync(reportPath, "utf8");

  // Results source: explicit jsonl fast path, else the default Markdown table.
  let results = null;
  let source = "markdown";
  if (values.results) {
    if (!fs.existsSync(values.results)) return fail(2, `results not found: ${values.results}`);
    results = parseJsonlResults(fs.readFileSync(values.results, "utf8"));
    source = "jsonl";
  } else {
    results = parseMarkdownResults(reportText);
  }
  if (!results) return fail(2, `no parseable Scenario Results in ${source} source`);

  // Freshness (F2): one of --build / --no-freshness must be chosen — no silent gap.
  if (!values["no-freshness"]) {
    if (!values.build) {
      return fail(2, "freshness unverified: pass --build <artifact[,artifact]> or --no-freshness");
    }
    const buildPaths = values.build.split(",").map((s) => s.trim()).filter(Boolean);
    for (const p of buildPaths) {
      if (!fs.existsSync(p)) return fail(2, `build artifact not found: ${p}`);
    }
    const fp = reportFingerprint(reportText);
    if (!fp) return fail(2, "report has no loaded-build fingerprint (md5/sha1/sha256); cannot verify freshness");
    const current = currentFingerprint(fp.algo, buildPaths);
    if (current !== fp.hex) {
      return fail(2, `stale report: report build ${fp.algo} ${fp.hex} != current ${current}; re-run the executor`);
    }
  }

  // Verdict (F1): every required scenario must be present and passed (or an
  // explicitly-allowed block); additionally, no scenario anywhere may be failed
  // or unexpectedly blocked.
  const required = splitIds(values["require-passed"]);
  const allowBlocked = new Set(splitIds(values["allow-blocked"]));
  const failures = [];
  for (const id of required) {
    const st = results[id];
    if (st === undefined) failures.push(`${id} missing from report`);
    else if (st === "passed") continue;
    else if (st === "blocked" && allowBlocked.has(id)) continue;
    else failures.push(`${id}=${st}`);
  }
  for (const [id, st] of Object.entries(results)) {
    if (st === "failed") failures.push(`${id}=failed`);
    else if (st === "blocked" && !allowBlocked.has(id)) failures.push(`${id}=blocked`);
  }
  const uniq = [...new Set(failures)];
  if (uniq.length) return fail(1, `not green: ${uniq.join(", ")}`);

  process.stdout.write(
    `e2e-report-check: ${required.length} required scenario(s) passed` +
      (values["no-freshness"] ? " (freshness skipped)" : " on the current build") +
      ` [${source}]\n`,
  );
  return 0;
}

process.exit(run(process.argv.slice(2)));
