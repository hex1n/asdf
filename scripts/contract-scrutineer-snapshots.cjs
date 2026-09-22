#!/usr/bin/env node

// Exercise real Git worktrees -> retained snapshots -> review record CLIs.
// This is a contract-* check because Git is an external prerequisite. Review
// records are synthetic; no model, independent reviewer, or isolation claim.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function main(argv) {
  if (argv.length && (argv.length !== 2 || argv[0] !== "--evidence-dir")) {
    process.stderr.write("usage: node contract-scrutineer-snapshots.cjs [--evidence-dir <new-directory>]\n");
    process.exitCode = 2; return;
  }
  const root = path.join(__dirname, "..");
  const skill = path.join(root, "skills", "scrutineer");
  const { readLensHeadings } = require(path.join(skill, "scripts", "validate-review-record.cjs"));
  const lenses = readLensHeadings(path.join(skill, "references", "LENSES.md"));
  assert.ok(lenses?.length, "the real lens file must be readable");
  const environment = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("GIT_") && !["GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_GLOBAL"].includes(key)) delete environment[key];
  }
  const prerequisite = spawnSync("git", ["--version"], { encoding: "utf8", env: environment, timeout: 10000 });
  if (prerequisite.error || prerequisite.status !== 0) {
    process.stderr.write("blocked: Git is unavailable; snapshot contract was not executed\n");
    process.exitCode = 2; return;
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "scrutineer-snapshots-"));
  const evidence = argv.length ? path.resolve(argv[1]) : path.join(temporary, "evidence");
  // A retained run must never overwrite earlier evidence.
  fs.mkdirSync(evidence);
  const commands = [], results = [];
  let sequence = 0;
  const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const write = (name, value) => {
    const file = path.join(evidence, name);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); return file;
  };
  function command(executable, args, cwd, expected = 0) {
    const result = spawnSync(executable, args, { cwd, env: environment, encoding: "utf8", timeout: 20000 });
    commands.push({ executable, args, cwd, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
    assert.ifError(result.error);
    assert.equal(result.status, expected, `${executable}: ${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  }
  const git = (cwd, ...args) => command("git", args, cwd);
  function check(name, action) { action(); results.push({ name, pass: true }); }
  function validate(record, returned = null, expected = 0) {
    const file = write(`record-${++sequence}.json`, record);
    const args = [path.join(skill, "scripts/validate-review-record.cjs"), file];
    if (returned) args.push("--returned", write(`returned-${sequence}.json`, returned));
    const report = JSON.parse(command(process.execPath, args, root, expected));
    assert.equal(report.pass, expected === 0); return file;
  }
  function merge(left, right, expected = 0) {
    const files = [validate(left), validate(right)];
    const output = path.join(evidence, `merged-${++sequence}.json`), map = path.join(evidence, `map-${sequence}.json`);
    const originals = files.map((file) => sha256(fs.readFileSync(file)));
    const result = JSON.parse(command(process.execPath, [path.join(skill, "scripts/merge-review-records.cjs"),
      "--series", "snapshot-fixture", "--out", output, "--map", map,
      `read-1=${files[0]}`, `read-2=${files[1]}`], root, expected));
    assert.equal(result.merged, expected === 0);
    assert.deepEqual(files.map((file) => sha256(fs.readFileSync(file))), originals);
    if (expected !== 0) { assert.equal(fs.existsSync(output), false); assert.equal(fs.existsSync(map), false); return; }
    const record = JSON.parse(fs.readFileSync(output, "utf8")); validate(record); return record;
  }
  try {
    const repository = path.join(temporary, "repository");
    fs.mkdirSync(repository); git(repository, "init", "--template=", "-q");
    git(repository, "config", "core.autocrlf", "false");
    fs.mkdirSync(path.join(repository, "src"));
    fs.writeFileSync(path.join(repository, "src/example.cjs"), "module.exports = x => x;\n");
    fs.writeFileSync(path.join(repository, "src/other.cjs"), "module.exports = 0;\n");
    fs.writeFileSync(path.join(repository, "src/obsolete.cjs"), "module.exports = true;\n");
    git(repository, "add", "--", "src");
    git(repository, "-c", "user.name=Contract Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--no-gpg-sign", "-qm", "fixture base");
    const head = git(repository, "rev-parse", "HEAD");
    function worktree(name) {
      const dir = path.join(temporary, name); git(repository, "worktree", "add", "--detach", "-q", dir, head);
      fs.writeFileSync(path.join(dir, "src/example.cjs"), "module.exports = x => x + 1;\n"); return dir;
    }
    // The fixture manifest covers all tracked and untracked non-ignored files,
    // including unchanged dependencies and tracked deletions. A symlink contributes
    // its target text, never bytes read through it. Supporting inputs are separate.
    function manifest(dir, support) {
      const files = [...new Set([
        ...git(dir, "ls-files", "-z", "--cached").split("\0"),
        ...git(dir, "ls-files", "-z", "--others", "--exclude-standard").split("\0"),
      ].filter(Boolean))].sort().map((file) => {
        const absolute = path.join(dir, file);
        const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
        if (!stat) return { path: file, state: "deleted" };
        assert.ok(stat.isFile() || stat.isSymbolicLink(), "fixture contains only files and symlinks");
        const link = stat.isSymbolicLink();
        return { path: file, mode: link ? "120000" : stat.mode & 0o111 ? "100755" : "100644",
          content_base64: (link ? Buffer.from(fs.readlinkSync(absolute)) : fs.readFileSync(absolute)).toString("base64") };
      });
      return { head: git(dir, "rev-parse", "HEAD"), scope: "all tracked and untracked non-ignored files", files,
        supporting_inputs: [{ name: "execution-settings", content_base64: Buffer.from(support).toString("base64") }] };
    }
    const support = '{"offset":1}\n';
    function freeze(dir, label, settings = support) {
      const value = manifest(dir, settings), bytes = Buffer.from(JSON.stringify(value));
      const file = path.join(evidence, `${label}-snapshot.json`); fs.writeFileSync(file, bytes, { flag: "wx" });
      return { identity: `sha256:${sha256(bytes)}`, value, file };
    }
    function record(snapshot, series, navigation) {
      return { verdict: "accept-scoped", mode: { context: "fresh-context", host_evidence: "SYNTHETIC read; real snapshot, no independent reviewer was launched" },
        review_series: series, round: 1, brief: { source: "inline", content_identity: `sha256 ${sha256(navigation)}` },
        reviewed: { candidate: `working tree at ${head}`, candidate_identity: snapshot.identity, base: head, base_identity: `git:${head}`, scope: "src/" },
        entries: [], coverage: { surfaces: [{ surface: "src/", depth: "in-depth", evidence: "Synthetic review fixture backed by retained source snapshot" }],
          lenses_applied: lenses, lenses_excluded: [], checks_run: [], limits: [] } };
    }
    const aDir = worktree("read-a"), bDir = worktree("read-b");
    const a = freeze(aDir, "a"), b = freeze(bDir, "b");
    check("separate worktrees with identical bytes share an identity", () => assert.equal(a.identity, b.identity));
    check("retained snapshot reconstructs the bytes actually executed", () => {
      const frozen = JSON.parse(fs.readFileSync(a.file, "utf8"));
      const source = frozen.files.find((item) => item.path === "src/example.cjs");
      const file = path.join(temporary, "frozen-example.cjs"); fs.writeFileSync(file, Buffer.from(source.content_base64, "base64"));
      assert.equal(command(process.execPath, ["-e", `process.stdout.write(String(require(${JSON.stringify(file)})(1)))`], temporary), "2");
    });
    const left = record(a, "snapshot.read-1", "request-first"), right = record(b, "snapshot.read-2", "source-first");
    check("different handoff views of the same snapshot merge", () => assert.equal(merge(left, right).reviewed.candidate_identity, a.identity));
    check("delivery preserves identity while adding a caller observation", () => {
      const delivered = clone(left); delivered.coverage.checks_run.push({ command: "caller: executed retained example with input 1", revision: a.identity, observation: "actual result 2" });
      validate(delivered, left);
    });
    const mutations = [
      ["tracked-code", (dir) => fs.writeFileSync(path.join(dir, "src/example.cjs"), "module.exports = x => x + 2;\n")],
      ["unchanged-dependency", (dir) => fs.writeFileSync(path.join(dir, "src/other.cjs"), "module.exports = 1;\n")],
      ["untracked-addition", (dir) => fs.writeFileSync(path.join(dir, "src/new.cjs"), "module.exports = null;\n")],
      ["tracked-deletion", (dir) => fs.unlinkSync(path.join(dir, "src/obsolete.cjs"))],
    ];
    if (process.platform !== "win32") mutations.push(
      ["executable-mode", (dir) => fs.chmodSync(path.join(dir, "src/example.cjs"), 0o755)],
      ["symlink-target", (dir) => { fs.unlinkSync(path.join(dir, "src/obsolete.cjs")); fs.symlinkSync("example.cjs", path.join(dir, "src/obsolete.cjs")); }],
    );
    for (const [label, mutate] of mutations) check(`same HEAD with changed ${label} is not merged`, () => {
      const dir = worktree(label); mutate(dir); const different = freeze(dir, label);
      assert.equal(different.value.head, head); assert.notEqual(different.identity, a.identity);
      merge(left, record(different, "snapshot.read-2", "source-first"), 1);
    });
    check("changed supporting input invalidates an otherwise identical snapshot", () => {
      const different = freeze(aDir, "changed-support", '{"offset":2}\n');
      assert.notEqual(different.identity, a.identity); merge(left, record(different, "snapshot.read-2", "source-first"), 1);
    });
    check("later workspace edits do not rewrite retained evidence", () => {
      const before = fs.readFileSync(a.file); fs.writeFileSync(path.join(aDir, "src/example.cjs"), "module.exports = x => x - 1;\n");
      assert.ok(fs.readFileSync(a.file).equals(before));
      assert.notEqual(`sha256:${sha256(JSON.stringify(manifest(aDir, support)))}`, a.identity);
    });
    check("the caller cannot swap a snapshot during delivery", () => {
      const delivered = clone(left); delivered.reviewed.candidate_identity = freeze(aDir, "later").identity;
      validate(delivered, left, 1);
    });
    const summary = { platform: process.platform, node: process.version, git: prerequisite.stdout.trim(), passed: results.length, results,
      limits: ["Synthetic reviewer records; no fresh-context execution or review quality claim", "Manifest construction is a fixture, not a shipped snapshot builder", ...(process.platform === "win32" ? ["POSIX executable mode and symlink cases not run"] : [])] };
    write("results.json", summary); write("commands.json", commands);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    write("failure.json", { message: error.message, results }); write("commands.json", commands);
    process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { main };
