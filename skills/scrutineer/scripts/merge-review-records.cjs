#!/usr/bin/env node

// Merge the delivered records of independent reads of one candidate into one record.
//
// Independent reads of the same change find different defects: on 2026-09-18 three
// reads of one 20-commit range each confirmed 4 or 5 of the 9 defects their union
// held. A merged record is how those reads reach the builder as one list with one
// set of ids to answer.
//
// The merge keeps every entry. Deduplicating by location looks safe and is not: one
// of those reads reported two distinct defects on the same line, and a location key
// would have folded the second into the first. So entries that share a location
// stay separate and are marked co-located in the merge map; deciding that two of
// them are one defect is a judgment, and it is left to whoever verifies the finding.
// Nothing is voted on either: an entry stands on the evidence its own read gave it.
//
// Each input must already be a delivered record (host evidence verified, checked
// against the returned record). The output is checked with validate-review-record
// before it is written; a merge that would not validate writes nothing.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { evaluateRecord, readLensHeadings, normalizePath } = require("./validate-review-record.cjs");

const KIND_ORDER = ["finding", "risk", "decision", "optional"];
const PREFIX = { finding: "F", risk: "R", decision: "D", optional: "O" };
const DEPTH_RANK = { "in-depth": 2, sampled: 1, skipped: 0 };
const CONTEXT_RANK = { "fresh-context": 0, "self-review": 1, blocked: 2 };
const PENDING = /^\s*pending\b/iu;

function locationKey(entry) {
  if (!entry.location) return null;
  return `${normalizePath(entry.location.file)}\n${String(entry.line_text ?? "").replace(/\s+/gu, " ").trim()}`;
}

// Display text is not a snapshot: two dirty worktrees can share the same HEAD.
// Legacy records can merge only when the entire value is a full immutable id.
// Snapshot digests are produced from the retained content, never from the brief.
function immutableIdentity(value, allowNone = false) {
  if (typeof value !== "string") return null;
  if (allowNone && value === "none") return value;
  if (/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) return `git:${value}`;
  return /^(?:git:(?:[0-9a-f]{40}|[0-9a-f]{64})|sha256:[0-9a-f]{64})$/u.test(value) ? value : null;
}

function sameRevision(left, right) {
  const a = immutableIdentity(left);
  return a !== null && a === immutableIdentity(right);
}

function reviewIdentity(record, field) {
  const explicit = record.reviewed?.[`${field}_identity`];
  return immutableIdentity(explicit ?? record.reviewed?.[field], field === "base" && explicit !== undefined);
}

function refusals(reads) {
  const problems = [];
  if (reads.length < 2) problems.push("a merge needs at least two reads");
  const labels = new Set();
  for (const { label, record } of reads) {
    if (labels.has(label)) problems.push(`read label ${label} is used twice`);
    labels.add(label);
    for (const field of ["candidate", "base"]) {
      if (!reviewIdentity(record, field)) {
        problems.push(`${label}: reviewed.${field} has no immutable identity; provide ${field}_identity from the inspected snapshot, not a branch name, short hash, or prose around HEAD`);
      }
    }
    if (PENDING.test(String(record.mode?.host_evidence ?? ""))) {
      problems.push(`${label}: host_evidence is still pending caller verification; deliver the read before merging it`);
    }
    if ((record.re_review ?? []).length > 0 || record.round !== 1) {
      problems.push(`${label}: round ${record.round} carries a re-review; merge first-round reads, then re-review against the merged ids`);
    }
  }
  const [first] = reads;
  for (const { label, record } of reads.slice(1)) {
    if (reviewIdentity(record, "candidate") !== reviewIdentity(first.record, "candidate") || reviewIdentity(record, "base") !== reviewIdentity(first.record, "base")) {
      problems.push(`${label}: reviewed ${record.reviewed.candidate} against ${record.reviewed.base}, not the candidate and base of ${first.label}`);
    }
  }
  return problems;
}

function mergeRecords(reads, { series, mapPath, lensHeadings = null }) {
  const problems = refusals(reads);
  if (problems.length > 0) return { problems };

  // Entries: kind order first, then co-located entries next to each other, then read
  // order, so a reader of the merged list meets possible duplicates side by side.
  const pooled = [];
  reads.forEach(({ label, record }, readIndex) => {
    record.entries.forEach((entry, entryIndex) => pooled.push({ label, readIndex, entryIndex, entry, loc: locationKey(entry) }));
  });
  const firstSeen = new Map();
  pooled.forEach((item, index) => { if (item.loc && !firstSeen.has(item.loc)) firstSeen.set(item.loc, index); });
  pooled.sort((a, b) => KIND_ORDER.indexOf(a.entry.kind) - KIND_ORDER.indexOf(b.entry.kind)
    || (a.loc ? firstSeen.get(a.loc) : Infinity) - (b.loc ? firstSeen.get(b.loc) : Infinity)
    || a.readIndex - b.readIndex || a.entryIndex - b.entryIndex);
  const counters = { finding: 0, risk: 0, decision: 0, optional: 0 };
  for (const item of pooled) {
    counters[item.entry.kind] += 1;
    item.id = `${PREFIX[item.entry.kind]}${counters[item.entry.kind]}`;
  }
  const entries = pooled.map((item) => ({ ...item.entry, id: item.id }));
  const mapEntries = pooled.map((item) => ({
    id: item.id,
    kind: item.entry.kind,
    title: item.entry.title,
    from: { read: item.label, id: item.entry.id },
    ...(item.entry.location ? { location: `${normalizePath(item.entry.location.file)}:${item.entry.location.line}` } : {}),
    co_located: item.loc ? pooled.filter((other) => other !== item && other.loc === item.loc).map((other) => other.id) : [],
  }));

  // Coverage: a surface keeps its deepest depth and every read's account of it.
  const surfaces = new Map();
  for (const { label, record } of reads) {
    for (const row of record.coverage.surfaces) {
      const key = normalizePath(row.surface);
      const held = surfaces.get(key) ?? { surface: row.surface, depth: row.depth, accounts: [] };
      if (DEPTH_RANK[row.depth] > DEPTH_RANK[held.depth]) held.depth = row.depth;
      held.accounts.push({ depth: row.depth, text: `[${label}] ${row.depth}: ${row.evidence}` });
      surfaces.set(key, held);
    }
  }
  const lensesApplied = [];
  for (const { record } of reads) for (const lens of record.coverage.lenses_applied) if (!lensesApplied.includes(lens)) lensesApplied.push(lens);
  if (lensHeadings) lensesApplied.sort((a, b) => lensHeadings.indexOf(a) - lensHeadings.indexOf(b));
  const excluded = new Map();
  for (const { label, record } of reads) {
    for (const row of record.coverage.lenses_excluded) {
      if (lensesApplied.includes(row.lens)) continue;
      excluded.set(row.lens, [...(excluded.get(row.lens) ?? []), `[${label}] ${row.reason}`]);
    }
  }

  const findings = entries.filter((entry) => entry.kind === "finding");
  const credibleRisks = entries.filter((entry) => entry.kind === "risk" && (entry.severity === "critical" || entry.severity === "high"));
  const anyBlocked = reads.some(({ record }) => record.verdict === "blocked");
  // Incomplete execution outranks the finding verdict; retain the findings.
  const verdict = anyBlocked ? "blocked" : findings.length > 0 || credibleRisks.length > 0 ? "needs-attention" : "accept-scoped";
  const context = reads.map(({ record }) => record.mode.context).sort((a, b) => CONTEXT_RANK[b] - CONTEXT_RANK[a])[0];
  const scopes = [...new Set(reads.map(({ record }) => record.reviewed.scope))];
  const parity = reads.flatMap(({ record }) => record.parity_ledger ?? []);

  const record = {
    verdict,
    mode: { context, host_evidence: reads.map(({ label, record: r }) => `[${label}] ${r.mode.host_evidence}`).join(" ; ") },
    review_series: series,
    round: 1,
    brief: {
      source: "file",
      path: mapPath,
      content_identity: `merge of ${reads.length} reads: ${reads.map(({ label, sha256 }) => `${label} sha256 ${sha256}`).join(", ")}`,
    },
    reviewed: {
      candidate: reads[0].record.reviewed.candidate,
      base: reads[0].record.reviewed.base,
      candidate_identity: reviewIdentity(reads[0].record, "candidate"),
      base_identity: reviewIdentity(reads[0].record, "base"),
      scope: scopes.length === 1 ? scopes[0] : reads.map(({ label, record: r }) => `[${label}] ${r.reviewed.scope}`).join(" | "),
    },
    entries,
    coverage: {
      surfaces: [...surfaces.values()].map((held) => ({
        surface: held.surface,
        depth: held.depth,
        evidence: held.accounts.sort((a, b) => DEPTH_RANK[b.depth] - DEPTH_RANK[a.depth]).map((account) => account.text).join(" | "),
      })),
      lenses_applied: lensesApplied,
      lenses_excluded: [...excluded].map(([lens, reasons]) => ({ lens, reason: reasons.join(" | ") })),
      checks_run: reads.flatMap(({ label, record: r }) => r.coverage.checks_run.map((row) => ({ ...row, command: `[${label}] ${row.command}` }))),
      limits: reads.flatMap(({ label, record: r }) => r.coverage.limits.map((limit) => `[${label}] ${limit}`)),
    },
    ...(parity.length > 0 ? { parity_ledger: parity } : {}),
  };
  const map = {
    review_series: series,
    reads: reads.map(({ label, file, sha256, record: r }) => ({ label, file, sha256, review_series: r.review_series, verdict: r.verdict })),
    entries: mapEntries,
  };
  return { record, map, problems: [] };
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const USAGE = "usage: node merge-review-records.cjs --series <id> --out <merged-record.json> --map <merge-map.json> <label>=<delivered-record.json> <label>=<delivered-record.json> [...]";

function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at === -1) return null;
    const value = args[at + 1];
    args.splice(at, 2);
    return value ?? null;
  };
  const series = take("--series");
  const out = take("--out");
  const mapPath = take("--map");
  if (!series || !out || !mapPath || args.length === 0 || args.some((arg) => !/^[^=]+=.+$/u.test(arg))) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    const skillDir = path.join(__dirname, "..");
    const schema = JSON.parse(fs.readFileSync(path.join(skillDir, "review-record-schema.json"), "utf8"));
    const lensPath = process.env.SCRUTINEER_LENSES ?? path.join(skillDir, "references", "LENSES.md");
    const lensHeadings = readLensHeadings(lensPath);
    if (lensHeadings === null) throw new Error(`cannot read the lens sections at ${lensPath}`);
    const reads = args.map((arg) => {
      const [label, file] = [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)];
      const text = fs.readFileSync(file, "utf8");
      return { label, file, sha256: sha256(text), record: JSON.parse(text) };
    });
    const invalid = reads.flatMap(({ label, record }) => evaluateRecord(record, { schema, lensHeadings }).failures.map((failure) => `${label}: ${failure}`));
    if (invalid.length > 0) {
      process.stdout.write(`${JSON.stringify({ merged: false, problems: invalid }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const result = mergeRecords(reads, { series, mapPath: normalizePath(mapPath), lensHeadings });
    if (result.problems.length > 0) {
      process.stdout.write(`${JSON.stringify({ merged: false, problems: result.problems }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const check = evaluateRecord(result.record, { schema, lensHeadings });
    if (!check.pass) {
      process.stdout.write(`${JSON.stringify({ merged: false, problems: check.failures.map((failure) => `merged record: ${failure}`) }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(out, `${JSON.stringify(result.record, null, 2)}\n`, "utf8");
    fs.writeFileSync(mapPath, `${JSON.stringify(result.map, null, 2)}\n`, "utf8");
    const colocated = result.map.entries.filter((entry) => entry.co_located.length > 0).length;
    process.stdout.write(`${JSON.stringify({ merged: true, verdict: result.record.verdict, entries: result.record.entries.length, co_located: colocated }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

// require.main is a module identity, not a path comparison, so it stays correct
// when the skill is reached through the symlink or junction install-skills.cjs creates.
if (require.main === module) main(process.argv.slice(2));

module.exports = { mergeRecords, locationKey, refusals, sameRevision, immutableIdentity, reviewIdentity };
