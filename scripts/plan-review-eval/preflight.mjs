#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  if (value !== value.trim()) throw new Error(`${label} must not have leading or trailing whitespace`);
  return value;
}

function requireRepoPath(value, label) {
  const file = requireString(value, label);
  if (path.isAbsolute(file) || file.includes("\\") || file.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${label} must be a normalized repo-relative path`);
  }
  return file;
}

function baseFile(repo, revision, file) {
  const result = git(repo, ["show", `${revision}:${file}`]);
  if (!result.ok) throw new Error(`cannot read ${revision}:${file}: ${result.stderr.trim()}`);
  return result.stdout;
}

export function runPreflight(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("manifest must be an object");
  const candidateId = requireString(manifest.candidate_id, "candidate_id");
  const repo = path.resolve(requireString(manifest.repo, "repo"));
  const requestedRevision = requireString(manifest.base_revision, "base_revision");
  const resolved = git(repo, ["rev-parse", "--verify", `${requestedRevision}^{commit}`]);
  if (!resolved.ok) throw new Error(`base_revision is not a commit: ${requestedRevision}`);
  const baseRevision = resolved.stdout.trim();
  if (!Array.isArray(manifest.candidate_files) || manifest.candidate_files.length === 0) {
    throw new Error("candidate_files must be a non-empty array");
  }
  const files = manifest.candidate_files.map((file, index) => requireRepoPath(file, `candidate_files[${index}]`));
  const contents = files.map((file) => ({ file, content: baseFile(repo, baseRevision, file) }));
  const candidateHash = crypto.createHash("sha256")
    .update(contents.map(({ file, content }) => `${file}\0${content.length}\0${content}`).join("\0"))
    .digest("hex");

  if (!Array.isArray(manifest.checks) || manifest.checks.length === 0) throw new Error("checks must be a non-empty array");
  const seen = new Set();
  const checks = manifest.checks.map((check, index) => {
    if (!check || typeof check !== "object" || Array.isArray(check)) throw new Error(`checks[${index}] must be an object`);
    const id = requireString(check.id, `checks[${index}].id`);
    if (seen.has(id)) throw new Error(`duplicate check id: ${id}`);
    seen.add(id);
    const type = requireString(check.type, `${id}.type`);
    const file = check.file == null ? null : requireRepoPath(check.file, `${id}.file`);
    let passed;
    let observed;
    if (type === "path_exists") {
      const result = git(repo, ["cat-file", "-e", `${baseRevision}:${requireRepoPath(check.path, `${id}.path`)}`]);
      passed = result.ok;
      observed = passed ? "exists" : "missing";
    } else if (type === "path_absent") {
      const result = git(repo, ["cat-file", "-e", `${baseRevision}:${requireRepoPath(check.path, `${id}.path`)}`]);
      passed = !result.ok;
      observed = passed ? "absent" : "exists";
    } else if (type === "text_contains" || type === "text_absent") {
      if (!files.includes(file)) throw new Error(`${id}.file must be listed in candidate_files`);
      const needle = requireString(check.needle, `${id}.needle`);
      const content = contents.find((entry) => entry.file === file).content;
      const contains = content.includes(needle);
      passed = type === "text_contains" ? contains : !contains;
      observed = contains ? "present" : "absent";
    } else {
      throw new Error(`unsupported check type: ${type}`);
    }
    const record = {
      id,
      type,
      passed,
      severity: check.severity ?? "should_fix",
      summary: requireString(check.summary, `${id}.summary`),
      evidence_refs: Array.isArray(check.evidence_refs) ? check.evidence_refs : [],
      observed,
    };
    return record;
  });

  return {
    schema_version: 1,
    candidate_id: candidateId,
    repo,
    requested_base_revision: requestedRevision,
    resolved_base_revision: baseRevision,
    candidate_files: files,
    candidate_hash: candidateHash,
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    compact_display: checks.filter((check) => !check.passed).map(({ id, severity, summary, evidence_refs, observed }) => ({
      candidate: candidateId,
      check: id,
      severity,
      summary,
      evidence_refs,
      observed,
    })),
  };
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("usage: preflight.mjs <manifest.json>");
  const manifest = JSON.parse(fs.readFileSync(input, "utf8"));
  process.stdout.write(`${JSON.stringify(runPreflight(manifest), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}
