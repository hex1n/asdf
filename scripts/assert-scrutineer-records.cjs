#!/usr/bin/env node

// Node-only regression gate for the review record's mechanical contracts.
// These records are synthetic controls, not claims of live agent execution.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function run(root = path.join(__dirname, "..")) {
  const skill = path.join(root, "skills", "scrutineer");
  const { evaluateRecord, readLensHeadings, deliveryProblems } = require(path.join(skill, "scripts", "validate-review-record.cjs"));
  const { mergeRecords } = require(path.join(skill, "scripts", "merge-review-records.cjs"));
  const schema = JSON.parse(fs.readFileSync(path.join(skill, "review-record-schema.json"), "utf8"));
  const lensHeadings = readLensHeadings(path.join(skill, "references", "LENSES.md"));
  assert.ok(lensHeadings?.length, "the gate needs the actual lens vocabulary");
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
  const a = "1".repeat(40), b = "2".repeat(40);
  let count = 0;
  const test = (label, check) => { check(); count += 1; process.stdout.write(`PASS: ${label}\n`); };
  const clean = () => ({
    verdict: "accept-scoped",
    mode: { context: "fresh-context", host_evidence: "SYNTHETIC: no live reviewer was launched by this gate." },
    review_series: "fixture.read-1", round: 1,
    brief: { source: "inline", content_identity: `sha256 ${hash("fixture brief")}` },
    reviewed: { candidate: a, base: b, scope: "src/example.cjs" },
    entries: [],
    coverage: {
      surfaces: [{ surface: "src/", depth: "in-depth", evidence: "Synthetic record consistency check." }],
      lenses_applied: lensHeadings, lenses_excluded: [], checks_run: [], limits: [],
    },
  });
  const finding = () => ({
    kind: "finding", id: "F1", title: "Wrong return value", severity: "high",
    attribution: "introduced", evidence: "observed",
    location: { file: "src/example.cjs", line: 1 }, line_text: "return 2;",
    trigger: "input 1", contract: "return the supplied value", consequence: "silent wrong result",
    evidence_detail: "SYNTHETIC: expected 1, observed 2.",
  });
  const open = () => { const r = clean(); r.verdict = "needs-attention"; r.entries = [finding()]; return r; };
  const blocked = () => {
    const r = clean(); r.verdict = "blocked"; r.mode.context = "blocked";
    r.coverage.limits = ["SYNTHETIC: isolation could not be verified."]; return r;
  };
  const rerun = () => {
    const r = clean(); r.round = 2; r.reviewed.candidate = "3".repeat(40);
    r.re_review = [{ id: "F1", fact_status: "confirmed", builder_action: "repaired",
      reviewer_status: "resolved", evidence: "SYNTHETIC: the new revision meets the contract." }];
    return r;
  };
  const evaluate = (r, previous = null) => evaluateRecord(r, { schema, lensHeadings, previous });
  const good = (r, previous = null) => { const v = evaluate(r, previous); assert.equal(v.pass, true, v.failures.join("\n")); };
  const bad = (r, previous = null, text = null) => {
    const v = evaluate(r, previous); assert.equal(v.pass, false, "inconsistent record passed");
    if (text) assert.match(v.failures.join("\n"), text);
  };
  const merge = (left, right) => mergeRecords([
    { label: "left", file: "left.json", sha256: hash(JSON.stringify(left)), record: left },
    { label: "right", file: "right.json", sha256: hash(JSON.stringify(right)), record: right },
  ], { series: "fixture-merged", mapPath: "merge-map.json", lensHeadings });
  const working = (content) => {
    const r = clean(); r.reviewed.candidate = `working tree at ${a}`;
    r.reviewed.snapshot = { candidate: `sha256 ${hash(content)}`, base: `git-commit ${b}` };
    return r;
  };

  test("clean legacy record", () => good(clean()));
  test("live finding prevents acceptance", () => { const r = open(); r.verdict = "accept-scoped"; bad(r); });
  test("needs-attention with finding", () => good(open()));
  test("blocked record preserves findings", () => { const r = blocked(); r.entries = [finding()]; good(r); });
  test("blocked context cannot accept", () => { const r = blocked(); r.verdict = "accept-scoped"; bad(r, null, /context.*blocked/); });
  test("blocked context cannot become needs-attention", () => {
    const r = blocked(); r.entries = [finding()]; r.verdict = "needs-attention"; bad(r);
  });
  test("honest coverage blocker may have a fresh context", () => { const r = blocked(); r.mode.context = "fresh-context"; good(r); });
  test("unexplained blocker refused", () => { const r = blocked(); r.coverage.limits = []; bad(r); });
  test("resolved finding leaves the active list", () => good(rerun(), open()));
  test("refuted finding leaves the active list", () => {
    const r = rerun(); Object.assign(r.re_review[0], { fact_status: "refuted", builder_action: "refuted", reviewer_status: "refuted" }); good(r, open());
  });
  test("deferred still-present finding cannot disappear", () => {
    const r = rerun(); Object.assign(r.re_review[0], { builder_action: "deferred", reviewer_status: "still present" });
    bad(r, open(), /needs a current/);
  });
  test("unverified fix cannot erase the open concern", () => {
    const r = rerun(); r.re_review[0].reviewer_status = "unverified"; bad(r, open(), /needs a current/);
  });
  test("deferred finding stays visible and needs attention", () => {
    const r = rerun(); r.verdict = "needs-attention"; r.entries = [finding()];
    Object.assign(r.re_review[0], { builder_action: "deferred", reviewer_status: "still present" }); good(r, open());
  });
  test("deferred is not resolved", () => { const r = rerun(); r.re_review[0].builder_action = "deferred"; bad(r, open()); });
  test("unrepaired action cannot claim resolution", () => { const r = rerun(); r.re_review[0].builder_action = "open"; bad(r, open()); });
  test("confirmed cannot claim refutation", () => { const r = rerun(); r.re_review[0].reviewer_status = "refuted"; bad(r, open()); });
  test("resolved concern cannot still be active", () => {
    const r = rerun(); r.verdict = "needs-attention"; r.entries = [finding()]; bad(r, open(), /still points to active/);
  });
  test("re-review requires its prior record", () => bad(rerun(), null, /requires the previous/));
  test("clean prior review permits an empty reconciliation", () => {
    const r = clean(); r.round = 2; r.re_review = []; good(r, clean());
  });
  test("third round cannot lose an unresolved concern", () => {
    const prior = rerun(); prior.verdict = "needs-attention"; prior.entries = [finding()];
    Object.assign(prior.re_review[0], { builder_action: "open", reviewer_status: "still present" });
    const next = copy(prior); next.round = 3; next.entries = []; next.verdict = "accept-scoped"; bad(next, prior);
  });
  test("historical identifiers need explicit reconciliation", () => {
    const prior = rerun(); const next = open(); next.round = 3; next.re_review = []; bad(next, prior);
  });
  test("exact display commit cannot contradict its snapshot", () => {
    const r = clean(); r.reviewed.snapshot = { candidate: `git-commit ${"4".repeat(40)}`, base: `git-commit ${b}` }; bad(r);
  });
  test("prior identifier cannot be omitted", () => { const r = rerun(); r.re_review = []; bad(r, open()); });
  test("another series cannot supply the prior record", () => { const r = rerun(); r.review_series = "other"; bad(r, open()); });
  test("rounds cannot skip the previous revision", () => { const r = rerun(); r.round = 3; bad(r, open()); });
  test("first round cannot carry a previous record", () => bad(clean(), open()));
  test("invented historical identifier is refused", () => { const r = rerun(); r.re_review[0].id = "F2"; bad(r, open()); });
  test("explicit reclassification preserves an unverified risk", () => {
    const r = rerun(); r.verdict = "needs-attention";
    r.entries = [{ kind: "risk", id: "R1", title: "Caller reachability uncertain", severity: "high",
      unknown: "deployed route", smallest_resolving_check: "inspect actual routing", blocks: "affected route acceptance" }];
    Object.assign(r.re_review[0], { current_id: "R1", fact_status: "unverified", builder_action: "open", reviewer_status: "unverified" });
    good(r, open());
  });
  test("reclassification cannot point at a missing concern", () => {
    const r = rerun(); Object.assign(r.re_review[0], { current_id: "R1", fact_status: "unverified", builder_action: "open", reviewer_status: "unverified" }); bad(r, open());
  });
  test("reclassification cannot demote a still-confirmed defect to a risk", () => {
    const r = rerun(); r.verdict = "needs-attention";
    r.entries = [{ kind: "risk", id: "R1", title: "Uncertain", severity: "high", unknown: "x", smallest_resolving_check: "check", blocks: "acceptance" }];
    Object.assign(r.re_review[0], { current_id: "R1", builder_action: "open", reviewer_status: "still present" }); bad(r, open());
  });
  test("properly attributed pre-existing issue may be an explicit decision", () => {
    const r = rerun();
    r.entries = [{ kind: "decision", id: "D1", title: "Historical defect", decision_kind: "pre-existing defect", severity: "high",
      attribution: "pre-existing", evidence: "source-established", evidence_detail: "SYNTHETIC: before-state establishes the same defect outside scope.", decision_needed: "Schedule a separate repair." }];
    Object.assign(r.re_review[0], { current_id: "D1", builder_action: "deferred", reviewer_status: "still present" }); good(r, open());
  });
  test("same exact legacy commits merge", () => { const x = merge(clean(), clean()); assert.deepEqual(x.problems, []); good(x.record); });
  test("different legacy commits refused", () => { const r = clean(); r.reviewed.candidate = "4".repeat(40); assert.ok(merge(clean(), r).problems.length); });
  test("short prefix is not an immutable revision", () => { const r = clean(); r.reviewed.candidate = a.slice(0, 7); assert.ok(merge(clean(), r).problems.length); });
  test("embedded same HEAD with different bytes refused", () => {
    const x = clean(), y = clean(); x.reviewed.candidate = `working tree at ${a}; file sha256 ${hash("before")}`;
    y.reviewed.candidate = `working tree at ${a}; file sha256 ${hash("after")}`; assert.ok(merge(x, y).problems.length);
  });
  test("identical prose without snapshot evidence is still insufficient", () => {
    const r = clean(); r.reviewed.candidate = `working tree at ${a}`; assert.ok(merge(r, copy(r)).problems.length);
  });
  test("same worktree snapshot with different briefs and labels merges", () => {
    const x = working("candidate bytes"), y = working("candidate bytes");
    y.brief.content_identity = `sha256 ${hash("independent entry point")}`; y.reviewed.candidate = "isolated copy used by another reader";
    const out = merge(x, y); assert.deepEqual(out.problems, []); good(out.record);
    assert.deepEqual(out.record.reviewed.snapshot, x.reviewed.snapshot);
  });
  test("changed worktree bytes refused despite equal HEAD", () => assert.ok(merge(working("before"), working("after")).problems.length));
  test("changed base snapshot refused", () => {
    const x = working("candidate"), y = copy(x); y.reviewed.snapshot.base = `git-commit ${"4".repeat(40)}`; assert.ok(merge(x, y).problems.length);
  });
  test("incomplete explicit identity is not replaced by a legacy fallback", () => {
    const r = clean(); r.reviewed.snapshot = { candidate: `sha256 ${hash("x")}` }; bad(r); assert.ok(merge(r, clean()).problems.length);
  });
  test("blocked read dominates merge while findings and limits survive", () => {
    const x = merge(blocked(), open()); assert.deepEqual(x.problems, []);
    assert.equal(x.record.verdict, "blocked"); assert.equal(x.record.mode.context, "blocked");
    assert.equal(x.record.entries.length, 1); assert.equal(x.record.coverage.limits.length, 1); good(x.record);
  });
  test("same-line distinct defects survive merge", () => {
    const x = open(), y = open(); y.entries[0].title = "Another contract on the same line";
    const out = merge(x, y); assert.equal(out.record.entries.length, 2); assert.equal(out.map.entries[0].co_located.length, 1); good(out.record);
  });
  test("pending host evidence cannot merge", () => { const r = clean(); r.mode.host_evidence = "pending caller verification"; assert.ok(merge(r, clean()).problems.length); });
  test("delivery cannot rewrite snapshot identity", () => {
    const before = working("before"), after = working("after"); assert.ok(deliveryProblems(after, before).some((p) => p.includes("reviewed")));
  });
  test("delivery cannot silently drop a finding", () => {
    assert.ok(deliveryProblems(clean(), open()).length);
  });
  test("preservation test accepts before/refactor and detects regression", () => {
    const verifies = (f) => f(-3) === 3 && f(0) === 0 && f(5) === 5;
    assert.equal(verifies((x) => x >= 0 ? x : -x), true);
    assert.equal(verifies(Math.abs), true);
    assert.equal(verifies((x) => x), false);
  });
  test("Tests lens distinguishes reproduction from preservation", () => {
    const text = fs.readFileSync(path.join(skill, "references", "LENSES.md"), "utf8");
    assert.ok(!text.includes("Then it protects nothing."));
    assert.ok(text.includes("A preservation test may pass before and after the change;"));
  });

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "scrutineer-record-regression-"));
  try {
    const write = (name, value) => { const f = path.join(temp, name); fs.writeFileSync(f, JSON.stringify(value)); return f; };
    const execute = (script, args) => {
      const result = spawnSync(process.execPath, [path.join(skill, "scripts", script), ...args], { encoding: "utf8", timeout: 10000, cwd: temp });
      assert.equal(result.error, undefined, String(result.error)); return result;
    };
    test("CLI refuses blocked/accept even with --returned", () => {
      const r = blocked(); r.verdict = "accept-scoped"; const f = write("inconsistent.json", r);
      const out = execute("validate-review-record.cjs", [f, "--returned", f]); assert.equal(out.status, 1); assert.equal(JSON.parse(out.stdout).pass, false);
    });
    test("CLI refuses deletion of deferred finding", () => {
      const r = rerun(); Object.assign(r.re_review[0], { builder_action: "deferred", reviewer_status: "still present" });
      assert.equal(execute("validate-review-record.cjs", [write("next.json", r), write("previous.json", open())]).status, 1);
    });
    test("CLI accepts verified resolution", () => {
      assert.equal(execute("validate-review-record.cjs", [write("resolved.json", rerun()), write("previous.json", open())]).status, 0);
    });
    test("CLI mismatch writes neither merged record nor map", () => {
      const out = path.join(temp, "refused.json"), map = path.join(temp, "refused-map.json");
      const result = execute("merge-review-records.cjs", ["--series", "series", "--out", out, "--map", map,
        `left=${write("left.json", working("left"))}`, `right=${write("right.json", working("right"))}`]);
      assert.equal(result.status, 1); assert.equal(fs.existsSync(out), false); assert.equal(fs.existsSync(map), false);
    });
    test("CLI valid merge preserves blocker and entry", () => {
      const out = path.join(temp, "merged.json"), map = path.join(temp, "map.json");
      const result = execute("merge-review-records.cjs", ["--series", "series", "--out", out, "--map", map,
        `left=${write("left.json", blocked())}`, `right=${write("right.json", open())}`]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(JSON.parse(fs.readFileSync(out)).verdict, "blocked"); assert.equal(JSON.parse(fs.readFileSync(out)).entries.length, 1);
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  process.stdout.write(`Scrutineer record contract checks: ${count} passed. No live agent runs.\n`);
  return count;
}

if (require.main === module) run();
module.exports = { run };
