#!/usr/bin/env node

// Pin the reader's shared stylesheet to one definition.
//
// report/v1 inlines references/report.css; the design branch copies
// references/reader-shell.html's inline CSS into the page it authors. Both
// therefore ship the same base styles, and nothing stopped one from being
// restyled while the other kept the old look — which is how the two drifted
// apart before: 9.9KB of shell CSS against 11.9KB in report.css, same class
// names, different values.
//
// Neither file may import the other: a rendered page must stand alone with no
// external style resource. So the shared part is delimited in both files and
// this gate compares it byte for byte, the same way assert-validator-helpers
// pins the duplicated schema interpreter.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REFERENCES = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '..', 'skills', 'e2e-test-workflow', 'references');
const BEGIN = '/* shared-report-styles:begin';
const END = '/* shared-report-styles:end */';

function extract(file) {
  const text = fs.readFileSync(path.join(REFERENCES, file), 'utf8');
  const start = text.indexOf(BEGIN);
  const stop = text.indexOf(END);
  if (start === -1 || stop === -1 || stop < start) {
    return { file, error: `missing ${start === -1 ? 'begin' : 'end'} marker` };
  }
  if (text.indexOf(BEGIN, start + 1) !== -1 || text.indexOf(END, stop + 1) !== -1) {
    return { file, error: 'marker appears more than once' };
  }
  return { file, block: text.slice(start, stop + END.length) };
}

function main() {
  const sources = ['report.css', 'reader-shell.html'].map(extract);
  const broken = sources.filter((entry) => entry.error);
  if (broken.length) {
    for (const entry of broken) process.stdout.write(`FAIL: ${entry.file} — ${entry.error}\n`);
    process.exitCode = 1;
    return;
  }
  const [reference, ...rest] = sources;
  const drifted = rest.filter((entry) => entry.block !== reference.block);
  if (drifted.length) {
    for (const entry of drifted) {
      process.stdout.write(
        `DRIFT ${entry.file}: shared block differs from ${reference.file} ` +
        `(${entry.block.length} bytes vs ${reference.block.length})\n`);
    }
    process.stdout.write('FAIL: shared reader styles\n');
    process.stdout.write(`edit ${reference.file} and copy its marked block into the others\n`);
    process.exitCode = 1;
    return;
  }
  const lines = reference.block.split('\n').length;
  process.stdout.write(
    `PASS: ${sources.length} identical shared reader style blocks ` +
    `(${lines} lines, ${reference.block.length} bytes)\n`);
}

main();
