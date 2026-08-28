#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SCRIPT_DIR, "..");
const STAGED_CLI = path.join(SCRIPT_DIR, "skill", "scripts", "rationale.mjs");
const CLI = fs.existsSync(STAGED_CLI)
  ? STAGED_CLI
  : path.join(ROOT, "skills", "rationale-records", "scripts", "rationale.mjs");
const STAGED_SKILL = path.join(SCRIPT_DIR, "skill", "SKILL.md");
const SKILL = fs.existsSync(STAGED_SKILL)
  ? STAGED_SKILL
  : path.join(ROOT, "skills", "rationale-records", "SKILL.md");

function run(args, cwd, stateRoot) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, ASDF_AGENT_STATE_ROOT: stateRoot },
  });
}

function expect(result, status, label) {
  if (result.status !== status) {
    throw new Error(`${label} exited ${result.status} instead of ${status}\n${result.error?.message || ""}\n${result.stdout || ""}${result.stderr || ""}`);
  }
  return String(result.stdout || "") + String(result.stderr || "");
}

function git(repo, args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true });
  expect(result, 0, `git ${args.join(" ")}`);
  return String(result.stdout || "").trim();
}

function initRepo(repo) {
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "rationale@example.invalid"]);
  git(repo, ["config", "user.name", "Rationale Contract"]);
  fs.writeFileSync(path.join(repo, ".gitignore"), "docs/rationale/\n.scratch/\n", "utf8");
}

function activeRecord(shape = "apply(first, second);") {
  return [
    "# Execution ordering",
    "> TL;DR：Records call-order invariants shared by the execution path.",
    "",
    "## W-001 · 调用顺序保持先一后二",
    "",
    "- **源码** `src/main/java/sample/Alpha.java`",
    `- **形状** \`${shape}\``,
    "- **源码** `src/main/java/sample/Beta.java`",
    "- **形状** `alpha.preserveOrder();`",
    "- **解释** 第一行先建立状态，第二行再读取它。流程是 first → state → second；交换顺序会读到未初始化值。",
    "",
  ].join("\n");
}

function listFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(target));
    else files.push(target);
  }
  return files;
}

function stage(name) {
  process.stderr.write(`[contract] ${name}\n`);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "asdf-rationale-v6-"));
try {
  const skill = fs.readFileSync(SKILL, "utf8");
  for (const contract of ["personal", "Git-ignored", "current", "linked worktree", "handoff-consume"]) {
    assert.match(skill, new RegExp(contract, "i"), `skill must state ${contract}`);
  }
  stage("skill contract");

  const repo = path.join(temporary, "contract-repo");
  const stateRoot = path.join(temporary, "state");
  initRepo(repo);
  const sourceDir = path.join(repo, "src", "main", "java", "sample");
  const rationaleDir = path.join(repo, "docs", "rationale", "execution");
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(rationaleDir, { recursive: true });
  const alpha = path.join(sourceDir, "Alpha.java");
  const beta = path.join(sourceDir, "Beta.java");
  const rationale = path.join(rationaleDir, "01-ordering.md");
  fs.writeFileSync(alpha, "class Alpha { void preserveOrder() { apply(first, second); } }\n", "utf8");
  fs.writeFileSync(beta, "class Beta { void callRule() { alpha.preserveOrder(); } }\n", "utf8");
  fs.writeFileSync(rationale, activeRecord(), "utf8");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "baseline"]);
  assert.equal(git(repo, ["ls-files", "docs/rationale"]), "", "active rationale must stay ignored");
  stage("fixture committed");

  const full = JSON.parse(expect(run(["check", "--full", "--json"], repo, stateRoot), 0, "full check"));
  assert.equal(full.failures.length, 0);
  assert.equal(full.anchors, 2);
  for (const query of ["W-001", "Alpha#preserveOrder", "src/main/java/sample/Alpha.java:1", "调用顺序"]) {
    const found = expect(run(["find", query], repo, stateRoot), 0, `find ${query}`);
    assert.match(found, /W-001/);
    if (query.includes("#")) assert.match(found, /近邻导航/);
  }
  stage("full check and navigation");

  const rebuilt = JSON.parse(expect(run(["check", "--incremental", "--json"], repo, stateRoot), 0, "initial incremental"));
  assert.equal(rebuilt.mode, "full-rebuild");
  const stateFile = listFiles(stateRoot).find((file) => file.endsWith(".json"));
  assert.ok(stateFile, "incremental check must create user-local state");
  stage("incremental state");

  fs.writeFileSync(rationale, activeRecord("apply(second, first);"), "utf8");
  const ignoredEdit = JSON.parse(expect(run(["check", "--incremental", "--json"], repo, stateRoot), 1, "ignored rationale edit"));
  assert.equal(ignoredEdit.failures.length > 0, true, "ignored rationale edits must still be checked");
  stage("ignored rationale edit");

  fs.writeFileSync(rationale, activeRecord(), "utf8");
  expect(run(["check", "--incremental", "--json"], repo, stateRoot), 0, "rationale repair");
  fs.writeFileSync(stateFile, "{broken", "utf8");
  const corrupt = JSON.parse(expect(run(["check", "--incremental", "--json"], repo, stateRoot), 0, "corrupt state rebuild"));
  assert.equal(corrupt.mode, "full-rebuild");
  stage("corrupt state rebuild");

  const beforeFailure = fs.readFileSync(stateFile, "utf8");
  fs.writeFileSync(alpha, "class Alpha { void preserveOrder() { apply(second, first); } }\n", "utf8");
  const sourceFailure = JSON.parse(expect(run(["check", "--incremental", "--json"], repo, stateRoot), 1, "changed source"));
  assert.equal(sourceFailure.failures.length > 0, true);
  assert.equal(fs.readFileSync(stateFile, "utf8"), beforeFailure, "failed checks must not advance state");
  fs.writeFileSync(rationale, activeRecord("apply(second, first);"), "utf8");
  expect(run(["check", "--incremental", "--json"], repo, stateRoot), 0, "shape repair");
  stage("source change selection");

  const duplicate = path.join(rationaleDir, "02-duplicate.md");
  fs.writeFileSync(duplicate, activeRecord("apply(second, first);"), "utf8");
  const duplicateResult = JSON.parse(expect(run(["check", "--incremental", "--json"], repo, stateRoot), 1, "cross-file duplicate"));
  assert.match(JSON.stringify(duplicateResult.failures), /duplicated/);
  fs.rmSync(duplicate);
  expect(run(["check", "--incremental", "--json"], repo, stateRoot), 0, "duplicate repair");
  stage("duplicate ID rejection");

  const invalid = path.join(rationaleDir, "03-invalid.md");
  fs.writeFileSync(invalid, "# 调研记录\n\n这里放一轮评审证据。\n", "utf8");
  const invalidResult = JSON.parse(expect(run(["check", "--incremental", "--json"], repo, stateRoot), 1, "unsupported file content"));
  assert.match(JSON.stringify(invalidResult.failures), /outside|unsupported/);
  fs.rmSync(invalid);
  stage("invalid file rejection");

  const handoffRepo = path.join(temporary, "handoff-main");
  const taskRoot = path.join(temporary, "handoff-task");
  const handoffState = path.join(temporary, "handoff-state");
  initRepo(handoffRepo);
  const handoffSource = path.join(handoffRepo, "src", "main", "java", "sample", "Version.java");
  const handoffRationale = path.join(handoffRepo, "docs", "rationale", "versioning", "01-current-version.md");
  fs.mkdirSync(path.dirname(handoffSource), { recursive: true });
  fs.mkdirSync(path.dirname(handoffRationale), { recursive: true });
  fs.writeFileSync(handoffSource, "class Version { int current() { return 1; } }\n", "utf8");
  fs.writeFileSync(handoffRationale, [
    "# Version selection",
    "> TL;DR：Records invariants for selecting the current version.",
    "",
    "## W-001 · 当前版本值保持一致",
    "",
    "- **源码** `src/main/java/sample/Version.java`",
    "- **形状** `return 1;`",
    "- **解释** 该常量是持久化版本的唯一当前值，返回其他值会让调用方按错误版本解码。",
    "",
  ].join("\n"), "utf8");
  git(handoffRepo, ["add", "."]);
  git(handoffRepo, ["commit", "-qm", "baseline"]);
  const base = git(handoffRepo, ["rev-parse", "HEAD"]);
  expect(run(["check", "--incremental", "--json"], handoffRepo, handoffState), 0, "handoff baseline state");
  git(handoffRepo, ["worktree", "add", "-q", "-b", "task-rationale", taskRoot, "HEAD"]);
  const linkedCheck = JSON.parse(expect(run(["check", "--incremental", "--json"], taskRoot, handoffState), 0, "linked skip"));
  assert.equal(linkedCheck.reason, "linked-worktree");
  stage("linked worktree skip");
  const taskSource = path.join(taskRoot, "src", "main", "java", "sample", "Version.java");
  fs.writeFileSync(taskSource, "class Version { int current() { return 2; } }\n", "utf8");
  git(taskRoot, ["add", "."]);
  git(taskRoot, ["commit", "-qm", "change version"]);
  const manifestPath = expect(run([
    "handoff-create", "--task", "TASK-1", "--base", base, "--note", "none",
  ], taskRoot, handoffState), 0, "none handoff").trim();
  assert.equal(fs.existsSync(manifestPath), true);
  stage("none handoff sealed");
  git(handoffRepo, ["merge", "--ff-only", "task-rationale"]);

  const delayedFailure = run(["handoff-consume", "--manifest", manifestPath], handoffRepo, handoffState);
  assert.notEqual(delayedFailure.status, 0, "none handoff must still check base-to-integrated source changes");
  stage("post-merge stale anchor rejection");
  fs.writeFileSync(handoffRationale, fs.readFileSync(handoffRationale, "utf8").replace("return 1;", "return 2;"), "utf8");
  const receiptPath = expect(run(["handoff-consume", "--manifest", manifestPath], handoffRepo, handoffState), 0, "consume repaired handoff").trim();
  assert.equal(fs.existsSync(receiptPath), true);
  stage("main receipt");
  assert.match(expect(run([
    "worktree-finish", "--manifest", manifestPath, "--main-root", handoffRepo, "--branch", "task-rationale",
  ], handoffRepo, handoffState), 0, "finish dry-run"), /READY/);
  assert.match(expect(run([
    "worktree-finish", "--manifest", manifestPath, "--main-root", handoffRepo,
    "--branch", "task-rationale", "--apply",
  ], handoffRepo, handoffState), 0, "finish apply"), /REMOVED/);
  assert.equal(fs.existsSync(taskRoot), false, "verified linked worktree must be removed");

  process.stdout.write("Personal rationale v6 contract OK\n");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
