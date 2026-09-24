#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { classify, linkSkill } = require("./install-skills.cjs");

const ROOT = path.join(__dirname, "..");
// The user-level rules file is one source with two runtime entry points:
// Codex reads ~/.codex/AGENTS.md itself, so that path becomes a file symlink,
// or a byte-identical copy where a file symlink needs elevation (Windows
// without Developer Mode) — the installed-copies gate then re-checks the copy.
// Claude Code reads ~/.claude/CLAUDE.md and expands `@path` imports, so one
// import line there needs no link and no copy on any platform.
const RULES_SOURCE_NAME = "global-agent-rules.md";
const ASSET_SPECS = [
  { name: "java-formatter", source: ["tools", "java-formatter"], install: [".agents", "tools", "java-formatter"] },
  { name: "rationale-records", source: ["skills", "rationale-records"], install: [".agents", "skills", "rationale-records"] },
];
const MANAGED_FRAGMENT = ".agents/tools/java-formatter/run-agent-hook.mjs";
const STATUS = "Formatting changed production Java and checking local rationale/repository gates";

function hookHandler(runtime, platform = process.platform) {
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

function mergeStopHook(document, handler) {
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

function writeJsonAtomic(file, value, io = fs) {
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

function firstLine(text) {
  return String(text).split(/\r?\n/u, 1)[0];
}

function importLine(source) {
  return "@" + source.split(path.sep).join("/");
}

// What occupies the Codex rules path. "stale" is a copy this installer made
// that fell behind the source; "foreign" is content the user wrote themselves
// or a link elsewhere, which is reported and never replaced. The provenance
// test is the source's first line, the same kind of marker isManaged() uses
// for the Stop hook. An empty file counts as absent: a runtime creates one
// as a placeholder.
function classifyRulesCopy(target, source, io = fs) {
  let stat;
  try {
    stat = io.lstatSync(target);
  } catch {
    return "absent";
  }
  if (stat.isSymbolicLink()) {
    try {
      return io.realpathSync(target) === io.realpathSync(source) ? "linked" : "foreign";
    } catch {
      return "foreign";
    }
  }
  const content = io.readFileSync(target);
  if (content.length === 0) return "absent";
  const expected = io.readFileSync(source);
  if (content.equals(expected)) return "copy";
  return firstLine(content.toString("utf8")) === firstLine(expected.toString("utf8")) ? "stale" : "foreign";
}

// Link first; a copy only where the platform refuses a file symlink to this
// user. With linkOnly, a refused link leaves an existing copy untouched, so a
// re-run after gaining the privilege upgrades the copy and a re-run without it
// changes nothing.
function installRulesCopy(target, source, io = fs, { linkOnly = false } = {}) {
  io.mkdirSync(path.dirname(target), { recursive: true });
  const staged = target + ".asdf-tools-staged";
  if (io.existsSync(staged)) {
    throw new Error("Installer recovery file already exists beside " + target + "; inspect it before retrying.");
  }
  let mode;
  try {
    io.symlinkSync(source, staged, "file");
    mode = "linked";
  } catch (error) {
    if (error.code !== "EPERM" && error.code !== "EACCES") throw error;
    if (linkOnly) return "copy";
    io.copyFileSync(source, staged);
    mode = "copied";
  }
  try {
    io.rmSync(target, { force: true });
    io.renameSync(staged, target);
  } catch (error) {
    io.rmSync(staged, { force: true });
    throw error;
  }
  return mode;
}

function classifyRulesImport(target, source, line, io = fs) {
  let stat;
  try {
    stat = io.lstatSync(target);
  } catch {
    return "absent";
  }
  if (stat.isSymbolicLink()) {
    try {
      if (io.realpathSync(target) === io.realpathSync(source)) return "linked";
    } catch {}
  }
  const content = io.readFileSync(target, "utf8");
  if (content.trim() === "") return "absent";
  return content.split(/\r?\n/u).some((candidate) => candidate.trim() === line) ? "present" : "append";
}

// The user's own CLAUDE.md keeps everything it has; the import line is added
// below it, the way mergeStopHook adds one hook beside the user's hooks.
function installRulesImport(target, line, io = fs) {
  io.mkdirSync(path.dirname(target), { recursive: true });
  let existing = "";
  try {
    existing = io.readFileSync(target, "utf8");
  } catch {}
  const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
  io.appendFileSync(target, separator + line + "\n", "utf8");
}

function planRules(home, sourceRoot, io = fs) {
  const source = path.join(sourceRoot, RULES_SOURCE_NAME);
  const rules = [];
  if (io.existsSync(path.join(home, ".codex"))) {
    const target = path.join(home, ".codex", "AGENTS.md");
    rules.push({ runtime: "codex", mode: "file", source, target, state: classifyRulesCopy(target, source, io) });
  }
  if (io.existsSync(path.join(home, ".claude"))) {
    const target = path.join(home, ".claude", "CLAUDE.md");
    const line = importLine(source);
    rules.push({ runtime: "claude", mode: "import", source, target, line, state: classifyRulesImport(target, source, line, io) });
  }
  return rules;
}

function applyRules(rules, io = fs) {
  const outcomes = [];
  for (const rule of rules) {
    let outcome = rule.state;
    if (rule.mode === "file") {
      if (rule.state === "absent" || rule.state === "stale") outcome = installRulesCopy(rule.target, rule.source, io);
      else if (rule.state === "copy") outcome = installRulesCopy(rule.target, rule.source, io, { linkOnly: true });
    } else if (rule.state === "absent" || rule.state === "append") {
      installRulesImport(rule.target, rule.line, io);
      outcome = "present";
    }
    outcomes.push({ ...rule, outcome });
  }
  return outcomes;
}

function describeRule(rule, apply) {
  const prefix = apply ? "DO " : "would ";
  if (rule.mode === "file") {
    switch (rule.state) {
      case "absent": return prefix + "install rules (link, or copy where a file symlink needs elevation): " + rule.target;
      case "stale": return prefix + "refresh stale rules copy: " + rule.target;
      case "copy": return prefix + "keep rules copy, upgrading to a link if the platform now allows one: " + rule.target;
      case "linked": return prefix + "keep rules link: " + rule.target;
      default: return "SKIP rules: " + rule.target + " holds content this installer did not write; merge "
        + RULES_SOURCE_NAME + " into it by hand";
    }
  }
  switch (rule.state) {
    case "absent": return prefix + "create rules import " + rule.line + ": " + rule.target;
    case "append": return prefix + "append rules import " + rule.line + " to: " + rule.target;
    case "linked": return prefix + "keep rules link: " + rule.target;
    default: return prefix + "keep rules import: " + rule.target;
  }
}

function planInstall(home = os.homedir(), sourceRoot = ROOT, platform = process.platform) {
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
    rules: planRules(home, sourceRoot),
  };
}

function applyInstall(plan) {
  for (const asset of plan.assets) {
    if (asset.linkState !== "linked") linkSkill(asset.installPath, asset.source);
  }
  for (const config of plan.configs) {
    if (JSON.stringify(config.before) !== JSON.stringify(config.after)) {
      writeJsonAtomic(config.file, config.after);
    }
  }
  return { rules: applyRules(plan.rules || []) };
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
  for (const rule of plan.rules) {
    process.stdout.write(describeRule(rule, apply) + "\n");
  }
  if (apply) {
    const { rules } = applyInstall(plan);
    process.stdout.write("applied: portable agent tools installed for "
      + plan.configs.map((config) => config.runtime).join(", ") + "\n");
    for (const rule of rules) {
      process.stdout.write("rules " + rule.runtime + ": " + rule.outcome + " — " + rule.target + "\n");
    }
  } else {
    process.stdout.write("re-run with --apply to install\n");
  }
}

// require.main is a module identity, not a path comparison, so it stays correct
// when this script is reached through a symlink or junction, and on Windows,
// where drive-letter casing and MSYS path translation make any
// argv-versus-module-URL comparison unreliable. The ESM form this replaced
// silently exited 0 without running, which for a gate or an installer is the
// worst failure available.
if (require.main === module) main(process.argv.slice(2));

module.exports = {
  RULES_SOURCE_NAME,
  hookHandler,
  mergeStopHook,
  writeJsonAtomic,
  importLine,
  classifyRulesCopy,
  installRulesCopy,
  classifyRulesImport,
  installRulesImport,
  planRules,
  applyRules,
  planInstall,
  applyInstall,
};
