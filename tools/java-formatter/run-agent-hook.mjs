#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { findGitRoot, formatChangedJava } from "./format-changed-java.mjs";

const TOOL_ROOT = path.dirname(fileURLToPath(import.meta.url));
// The rationale checker is a separate asset, so this tool locates it instead of
// assuming one layout: an explicit override, the sibling source tree, then the
// installed skill. A missing checker is a setup failure, never a record failure.
const RATIONALE_SOURCE_CLI = path.resolve(TOOL_ROOT, "..", "..", "skills", "rationale-records", "scripts", "rationale.mjs");
const RATIONALE_INSTALLED_CLI = path.join(os.homedir(), ".agents", "skills", "rationale-records", "scripts", "rationale.mjs");
function readInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) return { raw: "", value: {} };
  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    return { raw, value: {} };
  }
}

export function blockingPayload(input, reason) {
  return input.stop_hook_active
    ? { continue: false, stopReason: reason }
    : { decision: "block", reason };
}

export function repositoryDispatcher(repoRoot) {
  const candidate = path.join(repoRoot, "docs", "tools", "run-agent-gates.mjs");
  return fs.existsSync(candidate) ? candidate : null;
}

function parseStructuredOutput(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  for (const line of text.split(/\r?\n/).reverse()) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  return null;
}

function oneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function summarizeGateFailure(label, output) {
  const structured = parseStructuredOutput(output);
  if (structured && Array.isArray(structured.failures)) {
    const failures = structured.failures;
    const lines = failures.slice(0, 8).map((failure) => {
      const id = oneLine(failure.id) || "unknown";
      const title = oneLine(failure.title);
      const detail = oneLine(failure.detail);
      return "- " + id + (title ? " " + title : "") + (detail ? ": " + detail : "");
    });
    if (failures.length > lines.length) lines.push("- ... " + (failures.length - lines.length) + " more failure(s)");
    return label + ": " + failures.length + " failure(s)" + (lines.length > 0 ? "\n" + lines.join("\n") : ".");
  }
  const text = oneLine(output);
  return label + (text ? ": " + text.slice(-1600) : ": checker exited without structured failure details.");
}

function runRepositoryDispatcher(repoRoot, dispatcher, rawInput) {
  const result = spawnSync(process.execPath, [dispatcher], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    input: rawInput,
    env: { ...process.env, ASDF_SHARED_JAVA_FORMATTER: "1" },
  });
  if (result.status !== 0) {
    const output = [result.error && result.error.message, result.stdout, result.stderr]
      .filter(Boolean).join("\n").trim();
    throw new Error(summarizeGateFailure("Repository delivery gates failed", output));
  }
  const output = String(result.stdout || "").trim();
  if (!output || output === "{}") return null;
  try {
    return JSON.parse(output);
  } catch {
    throw new Error("Repository delivery gates returned invalid hook JSON:\n" + output.slice(-4000));
  }
}

// An explicit override never degrades silently: pointing it at a missing file
// is a configuration error, not a reason to fall back to another checker.
export function resolveRationaleCli(env = process.env, candidates = [RATIONALE_SOURCE_CLI, RATIONALE_INSTALLED_CLI]) {
  const override = env.ASDF_RATIONALE_CLI;
  if (override) return fs.existsSync(override) ? override : null;
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function runRationaleGate(repoRoot) {
  const cli = resolveRationaleCli();
  if (!cli) {
    throw new Error("This repository has docs/rationale, but the rationale-records checker is not installed.\n"
      + "Install it from the asdf-skills source tree with: node scripts/install-agent-tools.mjs --apply\n"
      + "Or point ASDF_RATIONALE_CLI at an existing rationale.mjs.");
  }
  const result = spawnSync(process.execPath,
    [cli, "check", "--incremental", "--root", repoRoot, "--json", "-q"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  const output = [result.error && result.error.message, result.stdout, result.stderr]
    .filter(Boolean).join("\n").trim();
  if (result.status !== 0) {
    throw new Error(summarizeGateFailure("Rationale records require attention", output));
  }
}

function selfTest() {
  const claude = blockingPayload({ stop_hook_active: true }, "x");
  const codex = blockingPayload({}, "x");
  if (claude.continue !== false || claude.stopReason !== "x") throw new Error("Claude block payload mismatch.");
  if (codex.decision !== "block" || codex.reason !== "x") throw new Error("Codex block payload mismatch.");

  const present = fileURLToPath(import.meta.url);
  const absent = present + ".missing";
  if (resolveRationaleCli({ ASDF_RATIONALE_CLI: present }) !== present) {
    throw new Error("An existing override must win over the discovered checkers.");
  }
  if (resolveRationaleCli({ ASDF_RATIONALE_CLI: absent }) !== null) {
    throw new Error("A missing override must fail instead of silently falling back.");
  }
  if (resolveRationaleCli({}, [absent, present]) !== present) {
    throw new Error("Discovery must skip a missing candidate and take the next one.");
  }
  if (resolveRationaleCli({}, [absent]) !== null) {
    throw new Error("An absent checker must resolve to null, not to a path that cannot run.");
  }

  const compact = summarizeGateFailure("Rationale records require attention", JSON.stringify({
    failures: [{ id: "W-001", title: "anchor mismatch", detail: "shape occurs 0 times" }],
    selectedPaths: ["first.java", "second.java", "third.java"],
  }));
  if (!compact.includes("W-001") || !compact.includes("shape occurs 0 times")) {
    throw new Error("Structured rationale failure details were lost.");
  }
  if (compact.includes("selectedPaths") || compact.includes("first.java")) {
    throw new Error("Structured rationale failure summary leaked selectedPaths.");
  }

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "asdf-hook-dispatch-"));
  try {
    if (repositoryDispatcher(temporary) !== null) throw new Error("Missing dispatcher was discovered.");
    const target = path.join(temporary, "docs", "tools");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "run-agent-gates.mjs"), "", "utf8");
    if (!repositoryDispatcher(temporary)) throw new Error("Existing dispatcher was not discovered.");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  process.stdout.write("Agent hook router self-test OK\n");
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const input = readInput();
  const repoRoot = findGitRoot(process.cwd());
  if (!repoRoot) {
    process.stdout.write("{}\n");
    return;
  }

  try {
    const marker = process.argv.indexOf("--files");
    if (marker !== -1) {
      const files = process.argv.slice(marker + 1);
      if (files.length === 0 || files.some((file) => file.startsWith("--"))) {
        throw new Error("Stop formatting checks require an explicit non-empty --files list.");
      }
      const pending = formatChangedJava({ repoRoot, explicitFiles: files, checkOnly: true });
      if (pending.length > 0) {
        const names = pending.map((file) => path.relative(repoRoot, file)).join(", ");
        process.stdout.write(JSON.stringify(blockingPayload(input.value,
          "Java formatting required for explicit files: " + names
          + ". Run format-changed-java.mjs --files <task-owned files>, inspect, then verify and stage.")) + "\n");
        return;
      }
    }

    if (fs.existsSync(path.join(repoRoot, "docs", "rationale"))) runRationaleGate(repoRoot);

    const dispatcher = repositoryDispatcher(repoRoot);
    const result = dispatcher ? runRepositoryDispatcher(repoRoot, dispatcher, input.raw) : null;
    process.stdout.write(JSON.stringify(result || {}) + "\n");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const reason = "Java formatting, rationale records, or repository delivery gates failed.\n\n" + detail.slice(-6000);
    process.stdout.write(JSON.stringify(blockingPayload(input.value, reason)) + "\n");
  }
}

main();
