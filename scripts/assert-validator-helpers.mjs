#!/usr/bin/env node

// Pin the schema-interpreter block that several skills each carry a copy of.
//
// A skill must stay independently distributable: install-skills.cjs links the
// skill directory alone, so a helper imported from a shared path in this repo
// resolves here and nowhere else. The interpreter is therefore duplicated —
// deliberately — and duplication without a pin is drift waiting to happen. One
// skill gains a keyword, another silently keeps ignoring it, and two records
// that should be checked the same way are not.
//
// The block is delimited in each file by the two markers below. Everything
// between them must match byte for byte across every copy.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPEN = "// >>> shared-validator-helpers";
const CLOSE = "// <<< shared-validator-helpers";

function collectScripts(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectScripts(full));
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".cjs")) found.push(full);
  }
  return found;
}

const skillsDir = path.join(ROOT, "skills");
const copies = [];
for (const file of fs.existsSync(skillsDir) ? collectScripts(skillsDir) : []) {
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf(OPEN);
  const end = text.indexOf(CLOSE);
  if (start === -1 && end === -1) continue;
  const relative = path.relative(ROOT, file).replace(/\\/gu, "/");
  if (start === -1 || end === -1 || end < start) {
    process.stdout.write(`FAIL: ${relative} has an unbalanced shared-validator-helpers marker\n`);
    process.exitCode = 1;
    continue;
  }
  copies.push({ relative, block: text.slice(start, end + CLOSE.length) });
}

if (copies.length === 0) {
  process.stdout.write("PASS: no shared validator helpers to pin\n");
} else {
  const [reference, ...rest] = copies;
  const drifted = rest.filter((copy) => copy.block !== reference.block);
  for (const copy of drifted) {
    // Name the first differing line: "they differ" sends the reader diffing
    // two hundred lines by eye.
    const left = reference.block.split("\n");
    const right = copy.block.split("\n");
    const at = left.findIndex((line, index) => line !== right[index]);
    process.stdout.write(`FAIL: ${copy.relative} drifted from ${reference.relative} at block line ${at + 1}\n`);
    process.stdout.write(`  ${reference.relative}: ${JSON.stringify(left[at] ?? "<end of block>")}\n`);
    process.stdout.write(`  ${copy.relative}: ${JSON.stringify(right[at] ?? "<end of block>")}\n`);
  }
  if (drifted.length > 0) process.exitCode = 1;
  else process.stdout.write(`PASS: ${copies.length} identical shared validator helper blocks (${copies.map((copy) => copy.relative).join(", ")})\n`);
}
