#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "rationale.mjs");
const args = process.argv.slice(2);
const findAt = args.indexOf("--find");
let forwarded;
if (findAt >= 0) {
  const query = args[findAt + 1];
  if (!query) {
    process.stderr.write("--find requires a query.\n");
    process.exit(2);
  }
  forwarded = ["find", query, ...args.slice(0, findAt), ...args.slice(findAt + 2)];
} else {
  forwarded = ["check", ...args];
}
const result = spawnSync(process.execPath, [cli, ...forwarded], { stdio: "inherit", windowsHide: true });
process.exit(result.status ?? 2);
