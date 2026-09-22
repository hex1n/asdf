#!/usr/bin/env node

// Exercise the review-record state machine through its public API and CLIs. Node only;
// no agent, external toolchain, live service, or installed runtime is required.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function main() {
  const root = path.join(__dirname, "..");
  const skill = path.join(root, "skills", "scrutineer");
  const { readLensHeadings, evaluateRecord } = require(path.join(skill, "scripts", "validate-review-record.cjs"));
  const schema = JSON.parse(fs.readFileSync(path.join(skill, "review-record-schema.json"), "utf8"));
  const lenses = readLensHeadings(path.join(skill, "references", "LENSES.md"));
  assert.ok(lenses?.length, "the real lens file must be readable");
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "scrutineer-records-"));
  const digest = (text) => crypto.createHash("sha256").update(text).digest("hex");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let sequence = 0;
  const results = [];
  function check(name, action) {
    try { action(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  }
  function clean() {
    return {
      verdict: "accept-scoped",
      mode: { context: "fresh-context", host_evidence: "SYNTHETIC fixture; no real reviewer was launched" },
      review_series: "fixture.read-1", round: 1,
      brief: { source: "inline", content_identity: `sha256 ${"b".repeat(64)}` },
      reviewed: { candidate: "1".repeat(40), base: "2".repeat(40), scope: "src/example.cjs" },
      entries: [],
      coverage: {
        surfaces: [{ surface: "src/", depth: "in-depth", evidence: "Synthetic contract fixture" }],
        lenses_applied: lenses, lenses_excluded: [], checks_run: [], limits: [],
      },
    };
  }
  function finding() {
    return { kind: "finding", id: "F1", title: "Incorrect result", severity: "high", attribution: "introduced",
      evidence: "observed", location: { file: "src/example.cjs", line: 1 }, line_text: "return 2;",
      trigger: "input 1", contract: "return the input", consequence: "silently returns the wrong value",
      evidence_detail: "Synthetic observation: expected 1, received 2" };
  }
  function risk(severity = "high") {
    return { kind: "risk", id: "R1", title: "Unknown behavior", severity, unknown: "runtime binding",
      smallest_resolving_check: "inspect effective binding", blocks: "result correctness" };
  }
  function decision() {
    return { kind: "decision", id: "D1", title: "Historical issue", severity: "high",
      decision_kind: "pre-existing defect", attribution: "pre-existing", evidence: "source-established",
      evidence_detail: "Synthetic issue outside the changed path", decision_needed: "schedule separate work" };
  }
  function withFinding() { const r = clean(); r.verdict = "needs-attention"; r.entries = [finding()]; return r; }
  function blocked() {
    const r = clean(); r.verdict = "blocked"; r.mode.context = "blocked";
    r.coverage.limits = ["Synthetic isolation check unavailable"]; return r;
  }
  function next(previous, status = "still present", action = "deferred", fact = "confirmed") {
    const r = clean(); r.review_series = previous.review_series; r.round = previous.round + 1;
    r.reviewed.candidate = "3".repeat(40);
    r.re_review = previous.entries.map(({ id }) => ({ id, fact_status: fact, builder_action: action,
      reviewer_status: status, evidence: "Synthetic new-revision evidence" }));
    return r;
  }
  function save(record, suffix = "record") {
    const file = path.join(temporary, `${++sequence}-${suffix}.json`);
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`); return file;
  }
  function run(script, args, exit) {
    const result = spawnSync(process.execPath, [path.join(skill, "scripts", script), ...args],
      { cwd: root, encoding: "utf8", timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, exit, `${script}: ${result.stdout}\n${result.stderr}`);
    return JSON.parse(result.stdout);
  }
  function validate(record, exit = 0, previous = null, returned = null) {
    return run("validate-review-record.cjs", [save(record), ...(previous ? [save(previous, "previous")] : []),
      ...(returned ? ["--returned", save(returned, "returned")] : [])], exit);
  }
  function merge(records, exit = 0) {
    const out = path.join(temporary, `${++sequence}-merged.json`);
    const map = path.join(temporary, `${sequence}-map.json`);
    const inputs = records.map((r, i) => `read-${i + 1}=${save(r, "input")}`);
    const before = inputs.map((item) => fs.readFileSync(item.slice(item.indexOf("=") + 1), "utf8"));
    run("merge-review-records.cjs", ["--series", "fixture", "--out", out, "--map", map, ...inputs], exit);
    inputs.forEach((item, i) => assert.equal(fs.readFileSync(item.slice(item.indexOf("=") + 1), "utf8"), before[i]));
    if (exit !== 0) { assert.ok(!fs.existsSync(out)); assert.ok(!fs.existsSync(map)); return null; }
    const record = JSON.parse(fs.readFileSync(out, "utf8")); validate(record);
    return { record, map: JSON.parse(fs.readFileSync(map, "utf8")) };
  }
  // The retained artifacts contain real bytes, not just different labels for HEAD.
  function snapshot(text) {
    const artifact = JSON.stringify({ head: "1".repeat(40), files: [{ path: "src/example.cjs", mode: "100644", content: text }] });
    const file = path.join(temporary, `${++sequence}-snapshot.json`);
    fs.writeFileSync(file, artifact);
    return `sha256:${digest(fs.readFileSync(file))}`;
  }
  function dirty(identity) {
    const r = clean(); r.reviewed.candidate = `working tree at ${"1".repeat(40)}`;
    if (identity !== undefined) r.reviewed.candidate_identity = identity;
    r.reviewed.base_identity = `git:${r.reviewed.base}`;
    return r;
  }
  try {
    check("legacy clean record remains valid", () => validate(clean()));
    check("active finding prevents acceptance", () => { const r = clean(); r.entries = [finding()]; validate(r, 1); });
    check("finding record is valid", () => validate(withFinding()));
    check("high risk prevents acceptance", () => { const r = clean(); r.entries = [risk()]; validate(r, 1); });
    check("low risk permits scoped acceptance", () => { const r = clean(); r.entries = [risk("low")]; validate(r); });
    check("decision does not become a change defect", () => { const r = clean(); r.entries = [decision()]; validate(r); });
    check("blocked record is valid", () => validate(blocked()));
    check("blocked context cannot accept", () => { const r = blocked(); r.verdict = "accept-scoped"; validate(r, 1); });
    check("blocked context cannot become needs-attention", () => { const r = blocked(); r.verdict = "needs-attention"; r.entries = [finding()]; validate(r, 1); });
    check("blocked record retains findings", () => { const r = blocked(); r.entries = [finding()]; validate(r); });
    check("blocking reason is required", () => { const r = blocked(); r.coverage.limits = []; validate(r, 1); });
    check("returned comparison does not launder blocked acceptance", () => { const r = blocked(); r.verdict = "accept-scoped"; validate(r, 1, null, r); });
    check("caller may demote a review and retain findings", () => {
      const returned = withFinding(), delivered = clone(returned);
      delivered.verdict = "blocked"; delivered.mode.context = "blocked"; delivered.coverage.limits = ["Observed isolation gap"];
      validate(delivered, 0, null, returned);
    });
    check("caller cannot drop a finding", () => { const returned = withFinding(); validate(clean(), 1, null, returned); });
    check("pending host evidence cannot be delivered", () => { const r = clean(); r.mode.host_evidence = "pending caller verification"; validate(r, 1, null, r); });
    check("clean preceding review permits an empty re-review", () => {
      const p = clean(), r = next(p); validate(r, 0, p);
    });
    check("clean re-review does not require an invented id", () => {
      const p = clean(), r = next(p); r.re_review = [{ id: "F99", fact_status: "confirmed", builder_action: "repaired", reviewer_status: "resolved", evidence: "Invented id, not an earlier concern" }];
      validate(r, 1, p);
    });
    check("confirmed still-present finding cannot masquerade as a low risk", () => {
      const p = withFinding(), r = next(p); r.entries = [risk("low")];
      r.re_review[0].current_id = "R1"; validate(r, 1, p);
    });
    check("an unchecked fact cannot masquerade as a confirmed finding", () => {
      const p = withFinding(), r = next(p, "unverified", "open", "unverified");
      r.entries = [finding()]; r.verdict = "needs-attention"; validate(r, 1, p);
    });
    check("2160 bounded state combinations follow the independent contract table", () => {
      // Literal allowed rows, derived from REPORT.md rather than the validator.
      // A reviewer unable to resolve a previously confirmed concern may retain
      // it as confirmed; a change in its fact_status must also change its kind.
      const table = {
        "resolved/confirmed": { kinds: ["none"], actions: ["repaired"] },
        "refuted/refuted": { kinds: ["none"], actions: ["repaired", "refuted", "open"] },
        "still present/confirmed": { kinds: ["finding", "decision"], actions: ["repaired", "refuted", "deferred", "open"] },
        "unverified/confirmed": { kinds: ["finding", "decision"], actions: ["repaired", "refuted", "deferred", "open"] },
        "unverified/unverified": { kinds: ["risk"], actions: ["repaired", "refuted", "open"] },
      };
      const variants = { none: null, finding: finding(), risk: risk("low"), decision: decision(), optional: { kind: "optional", id: "O1", title: "Clarity", benefit: "Optional reading aid" } };
      const p = withFinding();
      let count = 0, accepted = 0;
      for (const fact of ["confirmed", "refuted", "unverified"])
        for (const action of ["repaired", "refuted", "deferred", "open"])
          for (const status of ["resolved", "still present", "refuted", "unverified"])
            for (const [kind, item] of Object.entries(variants))
              for (const verdict of ["accept-scoped", "needs-attention", "blocked"])
                for (const context of ["fresh-context", "self-review", "blocked"]) {
                  const r = next(p, status, action, fact);
                  r.entries = item ? [clone(item)] : [];
                  if (item && item.id !== "F1") r.re_review[0].current_id = item.id;
                  r.verdict = verdict; r.mode.context = context;
                  r.coverage.limits = verdict === "blocked" ? ["Synthetic unavailable observation"] : [];
                  const rule = table[`${status}/${fact}`];
                  const expected = Boolean(rule && rule.kinds.includes(kind) && rule.actions.includes(action))
                    && (context !== "blocked" || verdict === "blocked")
                    && (verdict === "blocked" || verdict === (kind === "finding" ? "needs-attention" : "accept-scoped"));
                  const got = evaluateRecord(r, { schema, previous: p, lensHeadings: lenses });
                  assert.equal(got.pass, expected, `${fact}/${action}/${status}/${kind}/${verdict}/${context}: ${got.failures.join("; ")}`);
                  count += 1; accepted += Number(expected);
                }
      assert.equal(count, 2160); assert.equal(accepted, 115);
    });
    const previous = withFinding();
    check("unresolved deferred finding cannot vanish", () => validate(next(previous), 1, previous));
    check("unresolved entry must remain even with blocked verdict", () => {
      const r = next(previous); r.verdict = "blocked"; r.coverage.limits = ["Execution unavailable"]; validate(r, 1, previous);
    });
    check("retained deferred finding remains needs-attention", () => {
      const r = next(previous); r.entries = [finding()]; r.verdict = "needs-attention"; validate(r, 0, previous);
    });
    check("actually resolved finding can leave current entries", () => validate(next(previous, "resolved", "repaired"), 0, previous));
    check("refuted finding can leave current entries", () => validate(next(previous, "refuted", "refuted", "refuted"), 0, previous));
    check("unverified prior finding cannot vanish", () => validate(next(previous, "unverified", "open", "unverified"), 1, previous));
    check("missing disposition is rejected", () => { const r = next(previous); r.re_review = []; validate(r, 1, previous); });
    check("re-review requires preceding record", () => validate(next(previous, "resolved", "repaired"), 1));
    check("re-review cannot switch series", () => { const r = next(previous, "resolved", "repaired"); r.review_series = "unrelated"; validate(r, 1, previous); });
    check("re-review cannot skip rounds", () => { const r = next(previous, "resolved", "repaired"); r.round = 4; validate(r, 1, previous); });
    check("first round cannot carry prior-round history", () => validate(clean(), 1, previous));
    check("unrelated disposition id is rejected", () => { const r = next(previous, "resolved", "repaired"); r.re_review[0].id = "F99"; validate(r, 1, previous); });
    check("resolved needs an applied repair", () => validate(next(previous, "resolved", "open"), 1, previous));
    check("refuted status and fact agree", () => validate(next(previous, "refuted", "refuted", "confirmed"), 1, previous));
    check("still-present status needs a confirmed fact", () => { const r = next(previous, "still present", "open", "unverified"); r.entries = [finding()]; r.verdict = "needs-attention"; validate(r, 1, previous); });
    check("resolved finding cannot remain an open entry", () => { const r = next(previous, "resolved", "repaired"); r.entries = [finding()]; r.verdict = "needs-attention"; validate(r, 1, previous); });
    check("high prior risk cannot disappear", () => { const p = clean(); p.verdict = "needs-attention"; p.entries = [risk()]; validate(next(p, "unverified", "open", "unverified"), 1, p); });
    check("resolved prior risk can close", () => { const p = clean(); p.verdict = "needs-attention"; p.entries = [risk()]; validate(next(p, "refuted", "refuted", "refuted"), 0, p); });
    check("deferred decision stays visible without blocking verdict", () => { const p = clean(); p.entries = [decision()]; const r = next(p); r.entries = [decision()]; validate(r, 0, p); });
    check("risk promotion retains an explicit alias to the finding", () => {
      const p = clean(); p.verdict = "needs-attention"; p.entries = [risk()];
      const r = next(p, "still present", "open"); r.verdict = "needs-attention"; r.entries = [finding()];
      r.re_review[0].current_id = "F1"; validate(r, 0, p);
    });
    check("two prior findings can map to one retained root cause", () => {
      const p = withFinding(); p.entries.push({ ...finding(), id: "F2", title: "Related symptom" });
      const r = next(p); r.verdict = "needs-attention"; r.entries = [finding()];
      r.re_review[1].current_id = "F1"; validate(r, 0, p);
    });
    check("alias must point to a retained entry", () => {
      const r = next(previous); r.re_review[0].current_id = "F99"; validate(r, 1, previous);
    });
    check("unresolved finding cannot become an optional suggestion", () => {
      const r = next(previous); r.entries = [{ kind: "optional", id: "O1", title: "Deferred issue", benefit: "No repair" }];
      r.re_review[0].current_id = "O1"; validate(r, 1, previous);
    });
    check("closed entries cannot carry an open alias", () => {
      const r = next(previous, "resolved", "repaired"); r.re_review[0].current_id = "F2"; validate(r, 1, previous);
    });
    check("closed disposition history can be retained in later rounds", () => {
      const p = next(previous, "resolved", "repaired"); const r = clone(p); r.round = 3; validate(r, 0, p);
    });
    check("closed historical id cannot return without a disposition", () => {
      const p = next(previous, "resolved", "repaired"), r = next(p);
      validate(p, 0, previous);
      r.entries = [{ ...finding(), title: "A different cause" }]; r.verdict = "needs-attention";
      assert.match(validate(r, 1, p).failures.join("\n"), /historical F1/u);
    });
    check("unchanged title does not authorize historical id reuse", () => {
      const p = next(previous, "refuted", "refuted", "refuted"), r = next(p);
      validate(p, 0, previous);
      r.entries = [finding()]; r.verdict = "needs-attention";
      assert.match(validate(r, 1, p).failures.join("\n"), /historical F1/u);
    });
    check("a historical concern may reopen with an explicit disposition", () => {
      const p = next(previous, "resolved", "repaired"), r = next(p);
      r.entries = [finding()]; r.verdict = "needs-attention";
      r.re_review = [{ id: "F1", fact_status: "confirmed", builder_action: "open",
        reviewer_status: "still present", evidence: "Synthetic new observation reopens the same concern" }];
      validate(r, 0, p);
    });
    check("a new concern may take a new id after the prior one closed", () => {
      const p = next(previous, "resolved", "repaired"), r = next(p);
      r.entries = [{ ...finding(), id: "F2", title: "A new cause" }]; r.verdict = "needs-attention";
      validate(r, 0, p);
    });
    check("returned-record validation also rejects historical id reuse", () => {
      const p = next(previous, "resolved", "repaired"), r = next(p);
      r.entries = [finding()]; r.verdict = "needs-attention";
      assert.match(validate(r, 1, p, clone(r)).failures.join("\n"), /historical F1/u);
    });
    for (const field of ["candidate", "base"]) {
      check(`contradictory ${field} commit identity is rejected`, () => {
        for (const width of [40, 64]) {
          const r = clean(); r.reviewed[field] = "a".repeat(width);
          r.reviewed[`${field}_identity`] = `git:${"b".repeat(width)}`;
          assert.ok(validate(r, 1).failures.some((failure) => failure.includes(`$.reviewed.${field}_identity`)));
        }
      });
      check(`matching ${field} commit identities remain valid`, () => {
        for (const width of [40, 64]) {
          const r = clean(); r.reviewed[field] = "a".repeat(width);
          r.reviewed[`${field}_identity`] = `git:${r.reviewed[field]}`; validate(r);
        }
      });
      check(`${field} commit comparison ignores display hex casing`, () => {
        const r = clean(); r.reviewed[field] = "A".repeat(40);
        r.reviewed[`${field}_identity`] = `git:${"a".repeat(40)}`; validate(r);
      });
      check(`${field} snapshot digest is not compared as a commit`, () => {
        const r = clean(); r.reviewed[field] = "a".repeat(64);
        r.reviewed[`${field}_identity`] = `sha256:${"b".repeat(64)}`; validate(r);
      });
      check(`${field} display prose is not parsed for a commit`, () => {
        const r = clean(); r.reviewed[field] = `snapshot with navigation from ${"a".repeat(40)}`;
        r.reviewed[`${field}_identity`] = `git:${"b".repeat(40)}`; validate(r);
      });
      check(`conflicting ${field} labels cannot merge behind one identity`, () => {
        const a = clean(), b = clean(); a.reviewed[field] = "a".repeat(40); b.reviewed[field] = "c".repeat(40);
        a.reviewed[`${field}_identity`] = b.reviewed[`${field}_identity`] = `git:${"b".repeat(40)}`;
        merge([a, b], 1);
      });
      check(`returned-record validation rejects a contradictory ${field} identity`, () => {
        const r = clean(); r.reviewed[field] = "a".repeat(40);
        r.reviewed[`${field}_identity`] = `git:${"b".repeat(40)}`;
        assert.ok(validate(r, 1, null, clone(r)).failures.some((failure) => failure.includes(`$.reviewed.${field}_identity`)));
      });
    }
    check("malformed preceding records fail schema validation", () => {
      const p = clone(previous); delete p.reviewed; validate(next(previous, "resolved", "repaired"), 1, p);
    });
    check("same full committed snapshot merges", () => assert.equal(merge([clean(), clean()]).record.verdict, "accept-scoped"));
    check("different commits cannot merge", () => { const r = clean(); r.reviewed.candidate = "4".repeat(40); merge([clean(), r], 1); });
    check("short commit prefix is not immutable identity", () => { const r = clean(); r.reviewed.candidate = "1".repeat(7); merge([clean(), r], 1); });
    check("same branch name is not immutable identity", () => { const r = clean(); r.reviewed.candidate = "main"; merge([r, clone(r)], 1); });
    check("prose around HEAD cannot identify a worktree", () => merge([dirty(), dirty()], 1));
    const identity = snapshot("return 1;\n"), otherIdentity = snapshot("return 2;\n");
    check("same snapshot, different brief and navigation, merges", () => {
      const a = dirty(identity), b = dirty(identity); b.review_series = "fixture.read-2";
      b.brief.content_identity = `sha256 ${digest("different viewpoint")}`; b.reviewed.candidate += " (second read)";
      const { record } = merge([a, b]); assert.equal(record.reviewed.candidate_identity, identity);
    });
    check("same HEAD with different actual snapshots cannot merge", () => merge([dirty(identity), dirty(otherIdentity)], 1));
    check("same snapshot against different bases cannot merge", () => { const r = dirty(identity); r.reviewed.base_identity = `git:${"4".repeat(40)}`; merge([dirty(identity), r], 1); });
    check("component reviews can name no comparison base", () => {
      const r = dirty(identity); r.reviewed.base = "not applicable"; r.reviewed.base_identity = "none"; merge([r, clone(r)]);
    });
    check("candidate identity cannot be none", () => validate(dirty("none"), 1));
    check("malformed identity is rejected", () => validate(dirty("sha256:1234"), 1));
    check("explicit empty identity never falls back to HEAD", () => validate(dirty(""), 1));
    check("pending independent read is rejected", () => { const r = clean(); r.mode.host_evidence = "pending caller verification"; merge([clean(), r], 1); });
    check("re-review cannot be merged as an initial read", () => merge([next(previous, "resolved", "repaired"), clean()], 1));
    check("blocked plus finding remains blocked and retains evidence", () => {
      const { record } = merge([blocked(), withFinding()]); assert.equal(record.verdict, "blocked");
      assert.equal(record.mode.context, "blocked"); assert.equal(record.entries.length, 1); assert.ok(record.coverage.limits.length);
    });
    check("blocked plus clean remains blocked", () => assert.equal(merge([blocked(), clean()]).record.verdict, "blocked"));
    check("findings without blockers remain needs-attention", () => assert.equal(merge([clean(), withFinding()]).record.verdict, "needs-attention"));
    check("co-located findings are retained rather than voted away", () => { const { record, map } = merge([withFinding(), withFinding()]); assert.equal(record.entries.length, 2); assert.equal(map.entries[0].co_located.length, 1); });
    check("snapshot identity survives merge into a valid re-review", () => {
      const a = dirty(identity); a.entries = [finding()]; a.verdict = "needs-attention";
      const p = merge([a, dirty(identity)]).record; validate(next(p, "resolved", "repaired"), 0, p);
    });
    check("preservation checks may pass both versions and reject a mutant", () => {
      const before = (x) => x >= 0 ? x : -x, after = (x) => Math.abs(x), mutant = (x) => x;
      const observes = (fn) => fn(-3) === 3 && fn(0) === 0 && fn(5) === 5;
      assert.ok(observes(before)); assert.ok(observes(after)); assert.equal(observes(mutant), false);
      const text = fs.readFileSync(path.join(skill, "references", "LENSES.md"), "utf8");
      assert.doesNotMatch(text, /Then it protects nothing/u);
      assert.match(text, /preservation test may pass before and after/u);
    });
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  for (const result of results) process.stdout.write(`${result.pass ? "PASS" : "FAIL"}: ${result.name}${result.error ? `\n${result.error}` : ""}\n`);
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`${results.length - failed}/${results.length} review-record contract checks passed (API matrix + synthetic CLI fixtures, not agent behavior).\n`);
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) main();
module.exports = { main };
