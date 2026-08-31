import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-shared-tool-copies.mjs");

function makeRoot(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "twin-check-"));
  const a = path.join(root, "skills", "e2e-test-executor", "tools");
  const b = path.join(root, "skills", "e2e-test-planner", "tools");
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  fs.writeFileSync(path.join(a, "reader-view.mjs"), "console.log('tool');\n");
  fs.writeFileSync(path.join(b, "reader-view.mjs"), "console.log('tool');\n");
  mutate?.(root);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
}

test("byte-identical copies pass", () => {
  const root = makeRoot();
  const res = run(root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /PASS/);
});

test("a one-byte divergence fails and names the authoritative copy", () => {
  const root = makeRoot((r) => {
    const replica = path.join(r, "skills", "e2e-test-planner", "tools", "reader-view.mjs");
    fs.appendFileSync(replica, " ");
  });
  const res = run(root);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /copies differ; edit skills\/e2e-test-executor/);
});

test("a missing replica fails rather than passing vacuously", () => {
  const root = makeRoot((r) => {
    fs.rmSync(path.join(r, "skills", "e2e-test-planner", "tools", "reader-view.mjs"));
  });
  const res = run(root);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /missing: skills\/e2e-test-planner/);
});
