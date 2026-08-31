#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { classify, linkSkill } from "./install-skills.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_SPECS = [
  { name: "java-formatter", source: ["tools", "java-formatter"], install: [".agents", "tools", "java-formatter"] },
  { name: "rationale-records", source: ["skills", "rationale-records"], install: [".agents", "skills", "rationale-records"] },
];
const MANAGED_FRAGMENT = ".agents/tools/java-formatter/run-agent-hook.mjs";
const STATUS = "Formatting changed production Java and checking local rationale/repository gates";

export function hookHandler(runtime, platform = process.platform) {
  const command = 'node "$HOME/.agents/tools/java-formatter/run-agent-hook.mjs"';
  if (runtime === "claude") {
    return { type: "command", command, timeout: 180, statusMessage: STATUS };
  }
  const handler = { type: "command", command, timeout: 180, statusMessage: STATUS };
  if (platform === "win32") {
    handler.commandWindows =
      'powershell -NoProfile -Command "node (Join-Path $HOME \'.agents/tools/java-formatter/run-agent-hook.mjs\')"';
  }
  return handler;
}

function isManaged(handler) {
  return typeof handler.command === "string"
    && handler.command.replaceAll("\\", "/").includes(MANAGED_FRAGMENT);
}

export function mergeStopHook(document, handler) {
  const result = structuredClone(document || {});
  if (!result.hooks || typeof result.hooks !== "object" || Array.isArray(result.hooks)) result.hooks = {};
  const current = Array.isArray(result.hooks.Stop) ? result.hooks.Stop : [];
  const retained = [];
  for (const group of current) {
    if (!group || !Array.isArray(group.hooks)) {
      retained.push(group);
      continue;
    }
    const hooks = group.hooks.filter((candidate) => !isManaged(candidate));
    if (hooks.length > 0) retained.push({ ...group, hooks });
  }
  retained.push({ hooks: [handler] });
  result.hooks.Stop = retained;
  return result;
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error("Refusing to overwrite invalid JSON at " + file, { cause: error });
  }
}

export function writeJsonAtomic(file, value, io = fs) {
  io.mkdirSync(path.dirname(file), { recursive: true });
  const staged = file + ".asdf-tools-staged";
  const backup = file + ".asdf-tools-backup";
  if (io.existsSync(staged) || io.existsSync(backup)) {
    throw new Error("Installer recovery file already exists beside " + file + "; inspect it before retrying.");
  }
  io.writeFileSync(staged, JSON.stringify(value, null, 2) + "\n", "utf8");
  const existed = io.existsSync(file);
  try {
    if (existed) io.renameSync(file, backup);
    io.renameSync(staged, file);
    if (existed) io.rmSync(backup, { force: true });
  } catch (error) {
    try {
      if (io.existsSync(file)) io.rmSync(file, { force: true });
      if (existed && io.existsSync(backup)) io.renameSync(backup, file);
    } catch {}
    throw error;
  } finally {
    if (io.existsSync(staged)) io.rmSync(staged, { force: true });
  }
}

export function planInstall(home = os.homedir(), sourceRoot = ROOT, platform = process.platform) {
  const assets = ASSET_SPECS.map((spec) => {
    const source = path.join(sourceRoot, ...spec.source);
    const installPath = path.join(home, ...spec.install);
    return { name: spec.name, source, installPath, linkState: classify(installPath, source) };
  });
  const configs = [];
  if (fs.existsSync(path.join(home, ".codex"))) {
    const file = path.join(home, ".codex", "hooks.json");
    const before = readJson(file);
    const after = mergeStopHook(before, hookHandler("codex", platform));
    configs.push({ runtime: "codex", file, before, after });
  }
  if (fs.existsSync(path.join(home, ".claude"))) {
    const file = path.join(home, ".claude", "settings.json");
    const before = readJson(file);
    const after = mergeStopHook(before, hookHandler("claude", platform));
    configs.push({ runtime: "claude", file, before, after });
  }
  return {
    assets,
    configs,
  };
}

export function applyInstall(plan) {
  for (const asset of plan.assets) {
    if (asset.linkState !== "linked") linkSkill(asset.installPath, asset.source);
  }
  for (const config of plan.configs) {
    if (JSON.stringify(config.before) !== JSON.stringify(config.after)) {
      writeJsonAtomic(config.file, config.after);
    }
  }
}

function main(args) {
  const apply = args.includes("--apply");
  const plan = planInstall();
  for (const asset of plan.assets) {
    const linkVerb = asset.linkState === "linked" ? "keep link" : "link";
    process.stdout.write((apply ? "DO " : "would ") + linkVerb + ": " + asset.installPath + "\n");
  }
  for (const config of plan.configs) {
    const changed = JSON.stringify(config.before) !== JSON.stringify(config.after);
    process.stdout.write((apply ? "DO " : "would ") + (changed ? "merge" : "keep")
      + " " + config.runtime + " Stop hook: " + config.file + "\n");
  }
  if (apply) {
    applyInstall(plan);
    process.stdout.write("applied: portable agent tools installed for "
      + plan.configs.map((config) => config.runtime).join(", ") + "\n");
  } else {
    process.stdout.write("re-run with --apply to install\n");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
