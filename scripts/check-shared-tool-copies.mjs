#!/usr/bin/env node

// Some tools ship inside more than one skill so that each skill installs
// standalone (skills must not depend on each other), yet the copies are ONE
// artifact. This check fails the gate the moment a pair diverges, so
// "edited one copy, forgot the other" cannot ship. Fix a divergence by
// editing the first path of the pair and re-copying — never by patching
// both by hand.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// [authoritative copy, replica] — repo-relative.
const PAIRS = [
  ["skills/e2e-test-executor/tools/reader-view.mjs", "skills/e2e-test-planner/tools/reader-view.mjs"],
];

let failed = 0;
for (const [a, b] of PAIRS) {
  const fa = path.join(ROOT, a);
  const fb = path.join(ROOT, b);
  const missing = [[a, fa], [b, fb]].filter(([, f]) => !fs.existsSync(f)).map(([rel]) => rel);
  if (missing.length > 0) {
    console.log(`FAIL  ${a} <-> ${b} — missing: ${missing.join(", ")}`);
    failed++;
    continue;
  }
  const same = fs.readFileSync(fa).equals(fs.readFileSync(fb));
  console.log(`${same ? "PASS" : "FAIL"}  ${a} <-> ${b}${same ? "" : ` — copies differ; edit ${a} and re-copy`}`);
  if (!same) failed++;
}
process.exitCode = failed > 0 ? 1 : 0;
