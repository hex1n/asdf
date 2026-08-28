#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "rationale.mjs");
const result = spawnSync(process.execPath, [cli, "find", ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});
process.exit(result.status ?? 2);
