#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SCHEMA_VERSION = 6;
const HANDOFF_VERSION = 1;
const DEFAULT_EXTENSIONS = [
  "java", "kt", "kts", "py", "js", "jsx", "ts", "tsx", "go", "rs",
  "cs", "rb", "php", "scala", "c", "cc", "cpp", "h", "hpp",
];
const PRUNE = new Set([".git", "target", "build", "out", "dist", "node_modules", ".worktrees", ".idea"]);
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeIdentity(value) {
  const normalized = path.resolve(value).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function posixRelative(root, file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function under(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function git(cwd, args, { optional = false, encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, { cwd, encoding, windowsHide: true });
  if (result.status !== 0) {
    if (optional) return null;
    const output = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`git ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
  return result.stdout;
}

function findGitRoot(start) {
  const output = git(start, ["rev-parse", "--show-toplevel"], { optional: true });
  return output ? path.resolve(output.trim()) : null;
}

function repositoryInfo(start, explicitRoot = "") {
  const root = explicitRoot ? path.resolve(explicitRoot) : findGitRoot(start);
  if (!root) throw new Error("Cannot locate a Git repository; pass --root.");
  const gitDir = path.resolve(root, git(root, ["rev-parse", "--git-dir"]).trim());
  const commonDir = path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
  return {
    root,
    gitDir,
    commonDir,
    linkedWorktree: normalizeIdentity(gitDir) !== normalizeIdentity(commonDir),
    repoKey: sha256(normalizeIdentity(commonDir)),
    checkoutKey: sha256(normalizeIdentity(root)),
  };
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const staged = `${file}.staged-${process.pid}-${crypto.randomUUID()}`;
  const backup = `${file}.backup-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(staged, text, "utf8");
  const handle = fs.openSync(staged, "r");
  try {
    try {
      fs.fsyncSync(handle);
    } catch (error) {
      if (!["EPERM", "EINVAL", "ENOTSUP"].includes(error?.code)) throw error;
    }
  } finally {
    fs.closeSync(handle);
  }
  const existed = fs.existsSync(file);
  try {
    if (existed) fs.renameSync(file, backup);
    fs.renameSync(staged, file);
    if (existed) fs.rmSync(backup, { force: true });
  } catch (error) {
    try {
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
      if (existed && fs.existsSync(backup)) fs.renameSync(backup, file);
    } catch {}
    throw error;
  } finally {
    if (fs.existsSync(staged)) fs.rmSync(staged, { force: true });
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("-") ? args.shift() : "check";
  const options = {
    command,
    root: "",
    records: "docs/rationale",
    srcFilter: "/src/main/",
    extensions: [],
    quiet: false,
    json: false,
    full: false,
    incremental: false,
    stateRoot: process.env.ASDF_AGENT_STATE_ROOT || path.join(os.homedir(), ".agents", "state", "rationale-records"),
    limit: 50,
    apply: false,
    positional: [],
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--root": options.root = args[++i]; break;
      case "--records": options.records = args[++i]; break;
      case "--src-filter": options.srcFilter = args[++i]; break;
      case "--ext": options.extensions.push(args[++i].replace(/^\./, "")); break;
      case "--state-root": options.stateRoot = path.resolve(args[++i]); break;
      case "--limit": options.limit = Number(args[++i]); break;
      case "--task": options.task = args[++i]; break;
      case "--base": options.base = args[++i]; break;
      case "--note": options.note = args[++i]; break;
      case "--out": options.out = args[++i]; break;
      case "--manifest": options.manifest = args[++i]; break;
      case "--resolution": options.resolution = args[++i]; break;
      case "--main-root": options.mainRoot = args[++i]; break;
      case "--branch": options.branch = args[++i]; break;
      case "--quiet": case "-q": options.quiet = true; break;
      case "--json": options.json = true; break;
      case "--full": options.full = true; break;
      case "--incremental": options.incremental = true; break;
      case "--apply": options.apply = true; break;
      case "--help": case "-h": options.help = true; break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        options.positional.push(arg);
    }
  }
  if (options.extensions.length === 0) options.extensions = [...DEFAULT_EXTENSIONS];
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) throw new Error("--limit must be a positive integer.");
  return options;
}

function printHelp() {
  process.stdout.write(`Rationale records CLI\n\n` +
    `  rationale.mjs check [--full|--incremental] [--root DIR] [--json] [-q]\n` +
    `  rationale.mjs find QUERY [--full] [--limit N]\n` +
    `  rationale.mjs handoff-create --task ID --base SHA --note FILE|none [--out FILE]\n` +
    `  rationale.mjs handoff-consume --manifest FILE [--resolution FILE]\n` +
    `  rationale.mjs worktree-finish --manifest FILE --main-root DIR [--branch NAME] [--apply]\n`);
}

const RE_ANY_HEAD = /^#{1,6}\s/;
const RE_FILE_TITLE = /^#\s+(.+?)\s*$/;
const RE_TLDR = /^>\s*TL;DR[：:]\s*(.+?)\s*$/i;
const RE_HEAD = /^##\s+(W-\d+)\s*·\s*(.+?)\s*$/;
const RE_SOURCE = /^- \*\*源码\*\*\s*`([^`]+)`\s*$/;
const RE_SHAPE = /^- \*\*形状\*\*\s*`(.+)`\s*$/;
const RE_EXPLANATION = /^- \*\*解释\*\*(?:\s+(.+?)\s*)?$/;

function parseRecords(text, rationaleFile, rationaleRel, fileErrors) {
  const entries = [];
  let current = null;
  let lineNumber = 0;
  const lines = text.split("\n");
  const fileTitle = RE_FILE_TITLE.exec(lines[0]?.replace(/\r$/, "") || "");
  const tldr = RE_TLDR.exec(lines[1]?.replace(/\r$/, "") || "");
  if (!fileTitle) fileErrors.push({ id: "FILE", title: rationaleRel, detail: "line 1: expected '# <topic>'" });
  if (!tldr) fileErrors.push({ id: "FILE", title: rationaleRel, detail: "line 2: expected '> TL;DR：<what this file records>'" });
  if (fileTitle && !fileTitle[1].trim()) fileErrors.push({ id: "FILE", title: rationaleRel, detail: "line 1: empty topic" });
  if (tldr && !tldr[1].trim()) fileErrors.push({ id: "FILE", title: rationaleRel, detail: "line 2: empty TL;DR" });
  for (const rawLine of lines) {
    lineNumber += 1;
    const line = rawLine.replace(/\r$/, "");
    if (lineNumber <= 2) continue;
    if (RE_ANY_HEAD.test(line)) {
      current = null;
      const heading = RE_HEAD.exec(line);
      if (heading) {
        current = {
          id: heading[1], title: heading[2].trim(), anchors: [], explanation: "", explaining: false,
          errors: [], rawLines: [line], rationaleFile, rationaleRel, headingLine: lineNumber,
        };
        entries.push(current);
      } else {
        fileErrors.push({ id: "FILE", title: rationaleRel, detail: `line ${lineNumber}: unsupported heading` });
      }
      continue;
    }
    if (!current) {
      if (line.trim()) fileErrors.push({ id: "FILE", title: rationaleRel, detail: `line ${lineNumber}: content is outside an active W entry` });
      continue;
    }
    current.rawLines.push(line);
    if (!line.trim()) continue;
    if (current.explaining && /^\s{2,}\S/.test(line)) {
      current.explanation += `${current.explanation ? "\n" : ""}${line.slice(2).trimEnd()}`;
      continue;
    }
    let match = RE_SOURCE.exec(line);
    if (match) {
      if (current.explaining) current.errors.push(`line ${lineNumber}: **源码** must precede **解释**`);
      current.anchors.push({ source: match[1].trim().replaceAll("\\", "/"), shape: "", sourceLine: lineNumber });
      continue;
    }
    match = RE_SHAPE.exec(line);
    if (match) {
      const anchor = current.anchors.at(-1);
      if (!anchor || anchor.shape) current.errors.push(`line ${lineNumber}: **形状** must follow one unmatched **源码**`);
      else anchor.shape = match[1];
      continue;
    }
    match = RE_EXPLANATION.exec(line);
    if (match) {
      if (current.explaining) current.errors.push(`line ${lineNumber}: duplicate **解释**`);
      current.explaining = true;
      current.explanation = (match[1] || "").trim();
      continue;
    }
    current.errors.push(`line ${lineNumber}: unsupported active-record content`);
  }
  for (const entry of entries) {
    if (entry.anchors.length === 0) entry.errors.push("missing **源码**/**形状** anchor");
    for (const anchor of entry.anchors) {
      if (!anchor.shape) entry.errors.push(`line ${anchor.sourceLine}: missing **形状** after **源码**`);
    }
    if (!entry.explanation) entry.errors.push("missing **解释**");
    entry.raw = entry.rawLines.join("\n").trimEnd();
    entry.hash = sha256(`${entry.rationaleRel}\0${entry.raw}`);
  }
  return entries;
}

function walk(directory, visit) {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!PRUNE.has(entry.name)) walk(target, visit);
    } else if (entry.isFile()) visit(target);
  }
}

function loadCorpus(repo, options, indexSources = false) {
  const recordsRoot = path.resolve(repo.root, options.records);
  const rationaleFiles = [];
  const sourceIndex = new Map();
  const extensionSet = new Set(options.extensions.map((extension) => `.${extension.toLowerCase()}`));
  walk(recordsRoot, (file) => {
    if (path.extname(file).toLowerCase() === ".md") rationaleFiles.push(file);
  });
  if (indexSources) {
    walk(repo.root, (file) => {
      const extension = path.extname(file).toLowerCase();
      if (!extensionSet.has(extension)) return;
      const normalized = file.replaceAll("\\", "/");
      if (options.srcFilter !== "/" && !normalized.includes(options.srcFilter)) return;
      const basename = path.basename(file, extension);
      const bucket = sourceIndex.get(basename) || [];
      bucket.push(file);
      sourceIndex.set(basename, bucket);
    });
  }
  const entries = [];
  const fileErrors = [];
  const fileHashes = {};
  for (const file of rationaleFiles.sort()) {
    const relative = posixRelative(repo.root, file);
    const recordRelative = posixRelative(recordsRoot, file);
    if (!/^[^/]+\/\d{2}-[a-z0-9][a-z0-9-]*\.md$/.test(recordRelative)) {
      fileErrors.push({ id: "FILE", title: relative, detail: "record path must be <stable-domain>/<NN>-<topic>.md" });
    }
    const text = fs.readFileSync(file, "utf8");
    fileHashes[relative] = sha256(text);
    entries.push(...parseRecords(text, file, relative, fileErrors));
  }
  return { recordsRoot, rationaleFiles, entries, sourceIndex, fileErrors, fileHashes };
}

const ANCHOR_OPERATORS = [
  ">>>=", "===", "!==", "...", "<<=", ">>=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "==", "!=", "<=", ">=", "<<", ">>", "::", "->", "?.", "??", "=>", "**", "??=",
].sort((left, right) => right.length - left.length);

function isAnchorWordPart(character) {
  return Boolean(character) && (/[A-Za-z0-9_$]/.test(character) || character.charCodeAt(0) > 127);
}

function readQuotedToken(text, start, quote) {
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === quote) return index + 1;
    index += 1;
  }
  return index;
}

function anchorTokens(text) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const start = index;
    const character = text[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && text[index + 1] === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") index += 1;
      tokens.push({ value: text.slice(start, index), start });
      continue;
    }
    if (character === "/" && text[index + 1] === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index = Math.min(index + 2, text.length);
      tokens.push({ value: text.slice(start, index), start });
      continue;
    }
    if (character === "\"" || character === "'") {
      index = readQuotedToken(text, index, character);
      tokens.push({ value: text.slice(start, index), start });
      continue;
    }
    if (isAnchorWordPart(character)) {
      index += 1;
      while (index < text.length && isAnchorWordPart(text[index])) index += 1;
      tokens.push({ value: text.slice(start, index), start });
      continue;
    }
    const operator = ANCHOR_OPERATORS.find((candidate) => text.startsWith(candidate, index));
    index += operator ? operator.length : 1;
    tokens.push({ value: text.slice(start, index), start });
  }
  return tokens;
}

function findAnchorMatches(text, needle) {
  const expected = anchorTokens(needle);
  if (expected.length === 0) return [];
  const actual = anchorTokens(text);
  const matches = [];
  for (let index = 0; index <= actual.length - expected.length; index += 1) {
    if (expected.every((token, offset) => token.value === actual[index + offset].value)) {
      matches.push(actual[index].start);
      index += expected.length - 1;
    }
  }
  return matches;
}

function lineOfOffset(text, offset) {
  return offset === null || offset === undefined ? null : text.slice(0, offset).split("\n").length;
}

function lineOf(text, needle) {
  return lineOfOffset(text, text.indexOf(needle));
}

function validateEntries(repo, entries, selectedIds = null, fileErrors = []) {
  const failures = [...fileErrors];
  const idOwners = new Map();
  for (const entry of entries) {
    const owners = idOwners.get(entry.id) || [];
    owners.push(entry);
    idOwners.set(entry.id, owners);
  }
  for (const [id, owners] of idOwners) {
    if (owners.length > 1 && (!selectedIds || selectedIds.has(id))) {
      failures.push({ id, title: owners[0].title, detail: `W-ID is duplicated across ${owners.map((entry) => entry.rationaleRel).join(", ")}` });
    }
  }
  let anchors = 0;
  let anchorFailures = 0;
  const resolved = new Map();
  for (const entry of entries) {
    if (selectedIds && !selectedIds.has(entry.id)) continue;
    for (const detail of entry.errors) failures.push({ id: entry.id, title: entry.title, detail });
    for (const anchor of entry.anchors) {
      anchors += 1;
      const target = path.resolve(repo.root, anchor.source);
      if (!under(repo.root, target)) {
        anchorFailures += 1;
        failures.push({ id: entry.id, title: entry.title, detail: `source escapes repository: ${anchor.source}` });
        continue;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        anchorFailures += 1;
        failures.push({ id: entry.id, title: entry.title, detail: `source does not exist: ${anchor.source}` });
        continue;
      }
      const sourceText = fs.readFileSync(target, "utf8");
      const matches = findAnchorMatches(sourceText, anchor.shape);
      const occurrences = matches.length;
      if (occurrences !== 1) {
        anchorFailures += 1;
        failures.push({ id: entry.id, title: entry.title, detail: `shape occurs ${occurrences} times in ${anchor.source}; expected exactly 1` });
        continue;
      }
      resolved.set(`${entry.id}\0${anchor.source}\0${anchor.shape}`, {
        source: anchor.source,
        line: lineOfOffset(sourceText, matches[0]),
      });
    }
  }
  return { failures, anchors, anchorFailures, resolved };
}

function stateFile(repo, options) {
  return path.join(options.stateRoot, `${repo.repoKey}-${repo.checkoutKey}.json`);
}

function readState(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (value.schemaVersion !== SCHEMA_VERSION || typeof value.head !== "string" ||
        typeof value.repoRoot !== "string" || !value.recordHashes || Array.isArray(value.recordHashes) ||
        !value.pathIndex || Array.isArray(value.pathIndex) || !value.fileHashes || Array.isArray(value.fileHashes)) return null;
    if (!Object.values(value.recordHashes).every((hash) => typeof hash === "string") ||
        !Object.values(value.fileHashes).every((hash) => typeof hash === "string") ||
        !Object.values(value.pathIndex).every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"))) return null;
    return value;
  } catch { return null; }
}

function currentHead(repo) {
  return git(repo.root, ["rev-parse", "HEAD"]).trim();
}

function buildState(repo, corpus, head) {
  const hashesById = {};
  const pathIndex = {};
  for (const entry of corpus.entries) {
    const hashes = hashesById[entry.id] || [];
    hashes.push(entry.hash);
    hashesById[entry.id] = hashes;
    for (const anchor of entry.anchors) {
      const bucket = pathIndex[anchor.source] || [];
      if (!bucket.includes(entry.id)) bucket.push(entry.id);
      pathIndex[anchor.source] = bucket.sort();
    }
  }
  const recordHashes = {};
  for (const [id, hashes] of Object.entries(hashesById)) recordHashes[id] = sha256(hashes.sort().join("\0"));
  return {
    schemaVersion: SCHEMA_VERSION,
    repoRoot: normalizeIdentity(repo.root),
    head,
    recordHashes,
    fileHashes: corpus.fileHashes,
    pathIndex,
  };
}

function nulPaths(output) {
  if (!output) return [];
  return output.toString("utf8").split("\0").filter(Boolean).map((item) => item.replaceAll("\\", "/"));
}

function dirtyPaths(repo) {
  return [...new Set([
    ...nulPaths(git(repo.root, ["diff", "--name-only", "-z", "--diff-filter=ACMRD", "HEAD", "--"], { encoding: "buffer" })),
    ...nulPaths(git(repo.root, ["ls-files", "--others", "--exclude-standard", "-z", "--"], { encoding: "buffer" })),
  ])];
}

function committedPaths(repo, previousHead, head) {
  if (previousHead === head) return [];
  const exists = git(repo.root, ["cat-file", "-e", `${previousHead}^{commit}`], { optional: true });
  const ancestor = exists !== null && spawnSync("git", ["merge-base", "--is-ancestor", previousHead, head], {
    cwd: repo.root, windowsHide: true,
  }).status === 0;
  if (!ancestor) return null;
  return nulPaths(git(repo.root, ["diff", "--name-only", "-z", "--diff-filter=ACMRD", previousHead, head, "--"], { encoding: "buffer" }));
}

function renderCheck(result, quiet = false) {
  if (!quiet) {
    for (const failure of result.failures) {
      process.stdout.write(`  FAIL ${failure.id}  ${failure.title}\n       ${failure.detail}\n`);
    }
  }
  process.stdout.write(`记录 ${result.records} · 锚点 ${result.anchors} · OK ${result.ok} · FAIL ${result.failures.length}\n`);
  if (result.skipped) process.stdout.write(`SKIP ${result.reason}\n`);
}

function fullCheck(repo, corpus) {
  const validation = validateEntries(repo, corpus.entries, null, corpus.fileErrors);
  const anchorCount = corpus.entries.reduce((sum, entry) => sum + entry.anchors.length, 0);
  return {
    mode: "full", records: corpus.entries.length, anchors: anchorCount,
    ok: Math.max(0, anchorCount - validation.anchorFailures), failures: validation.failures,
    selectedIds: corpus.entries.map((entry) => entry.id), selectedPaths: [...new Set(corpus.entries.flatMap((entry) => entry.anchors.map((anchor) => anchor.source)))],
  };
}

function incrementalCheck(repo, corpus, options) {
  if (repo.linkedWorktree) {
    return { mode: "incremental", records: corpus.entries.length, anchors: 0, ok: 0, failures: [], skipped: true, reason: "linked-worktree" };
  }
  const file = stateFile(repo, options);
  const prior = readState(file);
  const head = currentHead(repo);
  if (!prior || prior.repoRoot !== normalizeIdentity(repo.root)) {
    const result = fullCheck(repo, corpus);
    if (result.failures.length === 0) atomicWrite(file, `${JSON.stringify(buildState(repo, corpus, head), null, 2)}\n`);
    return { ...result, mode: "full-rebuild" };
  }
  const committed = committedPaths(repo, prior.head, head);
  if (committed === null) {
    const result = fullCheck(repo, corpus);
    if (result.failures.length === 0) atomicWrite(file, `${JSON.stringify(buildState(repo, corpus, head), null, 2)}\n`);
    return { ...result, mode: "full-rebuild-non-ancestor" };
  }
  const changedPaths = new Set([...committed, ...dirtyPaths(repo)]);
  const current = buildState(repo, corpus, head);
  const selectedIds = new Set();
  const rationaleFilesChanged = JSON.stringify(prior.fileHashes) !== JSON.stringify(current.fileHashes);
  for (const id of new Set([...Object.keys(prior.recordHashes), ...Object.keys(current.recordHashes)])) {
    if (prior.recordHashes[id] !== current.recordHashes[id]) selectedIds.add(id);
  }
  for (const changedPath of changedPaths) {
    for (const id of prior.pathIndex[changedPath] || []) selectedIds.add(id);
    for (const id of current.pathIndex[changedPath] || []) selectedIds.add(id);
  }
  const currentIds = new Set(corpus.entries.map((entry) => entry.id));
  const selectedCurrentIds = new Set([...selectedIds].filter((id) => currentIds.has(id)));
  if (selectedIds.size === 0 && !rationaleFilesChanged) {
    if (prior.head !== head) atomicWrite(file, `${JSON.stringify(current, null, 2)}\n`);
    return { mode: "incremental", records: corpus.entries.length, anchors: 0, ok: 0, failures: [], selectedIds: [], selectedPaths: [...changedPaths] };
  }
  const validation = validateEntries(repo, corpus.entries, selectedCurrentIds, rationaleFilesChanged ? corpus.fileErrors : []);
  const anchors = corpus.entries.filter((entry) => selectedCurrentIds.has(entry.id)).reduce((sum, entry) => sum + entry.anchors.length, 0);
  const result = {
    mode: "incremental", records: corpus.entries.length, anchors,
    ok: Math.max(0, anchors - validation.anchorFailures), failures: validation.failures,
    selectedIds: [...selectedIds].sort(), selectedPaths: [...changedPaths].sort(),
  };
  if (result.failures.length === 0) atomicWrite(file, `${JSON.stringify(current, null, 2)}\n`);
  return result;
}

function runCheck(options) {
  const repo = repositoryInfo(process.cwd(), options.root);
  if (options.incremental && !options.full && repo.linkedWorktree) {
    const result = { mode: "incremental", records: 0, anchors: 0, ok: 0, failures: [], skipped: true, reason: "linked-worktree" };
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`); else renderCheck(result, options.quiet);
    return result;
  }
  const corpus = loadCorpus(repo, options);
  if (corpus.rationaleFiles.length === 0) {
    const result = { mode: options.incremental ? "incremental" : "full", records: 0, anchors: 0, ok: 0, failures: [], skipped: true, reason: "no-active-records" };
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`); else renderCheck(result, options.quiet);
    return result;
  }
  const result = options.incremental && !options.full ? incrementalCheck(repo, corpus, options) : fullCheck(repo, corpus);
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`); else renderCheck(result, options.quiet);
  return result;
}

function resolveAnchor(repo, anchor) {
  const file = path.resolve(repo.root, anchor.source);
  if (!fs.existsSync(file)) return { error: `missing ${anchor.source}`, source: anchor.source, line: null };
  const text = fs.readFileSync(file, "utf8");
  const matches = findAnchorMatches(text, anchor.shape);
  return matches.length === 1 ? { source: anchor.source, line: lineOfOffset(text, matches[0]) }
    : { error: `shape occurrences=${matches.length}`, source: anchor.source, line: null };
}

function sourceTarget(repo, corpus, query) {
  const pathMatch = /^(.*\.[A-Za-z0-9]+)(?::(\d+))?$/.exec(query);
  if (pathMatch) {
    const file = path.isAbsolute(pathMatch[1]) ? path.resolve(pathMatch[1]) : path.resolve(repo.root, pathMatch[1]);
    if (fs.existsSync(file)) return { file, line: pathMatch[2] ? Number(pathMatch[2]) : null, proximity: false };
  }
  const symbolMatch = /^([^#]+)(?:#(.+))?$/.exec(query);
  if (!symbolMatch) return null;
  const files = corpus.sourceIndex.get(symbolMatch[1]);
  if (!files || files.length !== 1) return null;
  const text = fs.readFileSync(files[0], "utf8");
  return { file: files[0], line: symbolMatch[2] ? lineOf(text, symbolMatch[2]) : null, proximity: Boolean(symbolMatch[2]) };
}

function runFind(options) {
  const query = options.positional.join(" ").trim();
  if (!query) throw new Error("find requires a query.");
  const repo = repositoryInfo(process.cwd(), options.root);
  const corpus = loadCorpus(repo, options, true);
  const target = sourceTarget(repo, corpus, query);
  const exactId = /^W-\d+$/i.test(query) ? query.toUpperCase() : null;
  const needle = query.toLowerCase();
  const matches = [];
  for (const entry of corpus.entries) {
    const anchors = entry.anchors.map((anchor) => ({ ...anchor, ...resolveAnchor(repo, anchor) }));
    const relevant = target ? anchors.filter((anchor) => path.resolve(repo.root, anchor.source) === target.file) : anchors;
    const searchable = [entry.id, entry.title, entry.explanation, ...entry.anchors.flatMap((anchor) => [anchor.source, anchor.shape])].join("\n").toLowerCase();
    const textMatch = exactId ? entry.id === exactId : searchable.includes(needle);
    if ((target && relevant.length > 0) || (!target && textMatch)) {
      const distance = target?.line ? Math.min(...relevant.map((anchor) => anchor.line ? Math.abs(anchor.line - target.line) : Number.MAX_SAFE_INTEGER)) : 0;
      matches.push({ entry, anchors: relevant, distance });
    }
  }
  matches.sort(target?.line
    ? (a, b) => a.distance - b.distance || a.entry.id.localeCompare(b.entry.id)
    : (a, b) => a.entry.rationaleRel.localeCompare(b.entry.rationaleRel) || a.entry.headingLine - b.entry.headingLine);
  if (matches.length === 0) {
    process.stdout.write(`未找到与“${query}”匹配的 rationale 记录。\n`);
    return 1;
  }
  for (const match of matches.slice(0, options.limit)) {
    process.stdout.write(`${match.entry.rationaleRel}:${match.entry.headingLine}  ${match.entry.id} · ${match.entry.title}\n`);
    for (const anchor of match.anchors) process.stdout.write(`  ${anchor.source}:${anchor.line ?? "?"}${anchor.error ? ` [${anchor.error}]` : ""}\n`);
    if (target?.proximity) process.stdout.write("  [近邻导航：不表示语法级成员归属]\n");
    if (options.full) process.stdout.write(`  解释 ${match.entry.explanation.replaceAll("\n", "\n       ")}\n`);
    process.stdout.write("\n");
  }
  process.stdout.write(`命中 ${matches.length} 条。\n`);
  return 0;
}

function requireOption(options, name) {
  if (!options[name]) throw new Error(`--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required.`);
  return options[name];
}

function relativeFile(root, candidate) {
  const absolute = path.resolve(root, candidate);
  if (!under(root, absolute) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`File is missing or outside checkout: ${candidate}`);
  }
  return { absolute, relative: posixRelative(root, absolute) };
}

function receiptFile(repo, options, handoffId) {
  return path.join(options.stateRoot, "receipts", repo.repoKey, `${handoffId}.json`);
}

function runHandoffCreate(options) {
  const repo = repositoryInfo(process.cwd(), options.root);
  if (!repo.linkedWorktree) throw new Error("handoff-create is only valid in a linked worktree.");
  const taskId = requireOption(options, "task");
  const baseCommit = requireOption(options, "base");
  if (git(repo.root, ["cat-file", "-e", `${baseCommit}^{commit}`], { optional: true }) === null) throw new Error(`Invalid base commit: ${baseCommit}`);
  const noteArg = options.note ?? "none";
  const note = noteArg === "none" ? { kind: "none" } : (() => {
    const file = relativeFile(repo.root, noteArg);
    return { kind: "file", path: file.relative, hash: sha256(fs.readFileSync(file.absolute)) };
  })();
  const manifest = {
    schemaVersion: HANDOFF_VERSION,
    handoffId: crypto.randomUUID(), taskId, worktreeRoot: repo.root,
    worktreePathHash: sha256(normalizeIdentity(repo.root)), baseCommit,
    taskHead: currentHead(repo), note,
  };
  const out = path.resolve(repo.root, options.out || ".scratch/rationale-handoff.json");
  if (!under(repo.root, out)) throw new Error("handoff manifest must stay inside the worktree.");
  atomicWrite(out, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${out}\n`);
  return 0;
}

function readManifest(file) {
  const absolute = path.resolve(file);
  const value = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (value.schemaVersion !== HANDOFF_VERSION || !value.handoffId || !value.taskHead || !value.worktreeRoot || !value.note) {
    throw new Error("Invalid handoff manifest.");
  }
  return { absolute, value };
}

function verifyNote(manifest) {
  if (manifest.note.kind === "none") return "none";
  const file = path.resolve(manifest.worktreeRoot, manifest.note.path);
  if (!under(manifest.worktreeRoot, file) || !fs.existsSync(file)) throw new Error("Handoff note is missing.");
  const digest = sha256(fs.readFileSync(file));
  if (digest !== manifest.note.hash) throw new Error("Handoff note hash does not match the manifest.");
  return digest;
}

function runHandoffConsume(options) {
  const repo = repositoryInfo(process.cwd(), options.root);
  if (repo.linkedWorktree) throw new Error("handoff-consume must run in the main checkout.");
  const { value: manifest } = readManifest(requireOption(options, "manifest"));
  const noteHash = verifyNote(manifest);
  if (spawnSync("git", ["merge-base", "--is-ancestor", manifest.taskHead, "HEAD"], { cwd: repo.root, windowsHide: true }).status !== 0) {
    throw new Error("Task HEAD is not an ancestor of the current main HEAD.");
  }
  if (manifest.note.kind === "file") {
    const resolutionFile = relativeFile(repo.root, requireOption(options, "resolution"));
    const resolution = JSON.parse(fs.readFileSync(resolutionFile.absolute, "utf8"));
    if (resolution.handoffId !== manifest.handoffId || resolution.noteHash !== noteHash || resolution.status !== "processed") {
      throw new Error("Resolution does not prove this handoff note was processed.");
    }
  }
  const corpus = loadCorpus(repo, options);
  const check = incrementalCheck(repo, corpus, { ...options, incremental: true });
  if (check.failures.length > 0 || check.skipped) {
    renderCheck(check, false);
    throw new Error("Main-checkout rationale validation did not pass.");
  }
  const receipt = {
    schemaVersion: HANDOFF_VERSION,
    handoffId: manifest.handoffId,
    taskHead: manifest.taskHead,
    noteHash,
    integratedHead: currentHead(repo),
    selectedPaths: check.selectedPaths || [],
    selectedIds: check.selectedIds || [],
    result: "passed",
  };
  const file = receiptFile(repo, options, manifest.handoffId);
  if (fs.existsSync(file)) throw new Error(`Handoff was already consumed: ${manifest.handoffId}`);
  atomicWrite(file, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${file}\n`);
  return 0;
}

function worktreeStatus(root) {
  return [...new Set([
    ...nulPaths(git(root, ["diff", "--name-only", "-z", "HEAD", "--"], { encoding: "buffer" })),
    ...nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--"], { encoding: "buffer" })),
    ...nulPaths(git(root, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--"], { encoding: "buffer" })),
  ])];
}

function runWorktreeFinish(options) {
  const main = repositoryInfo(process.cwd(), options.mainRoot || options.root);
  if (main.linkedWorktree) throw new Error("worktree-finish must run from the main checkout.");
  const manifestInfo = readManifest(requireOption(options, "manifest"));
  const manifest = manifestInfo.value;
  const taskRoot = path.resolve(manifest.worktreeRoot);
  const task = repositoryInfo(taskRoot);
  if (!task.linkedWorktree || normalizeIdentity(task.commonDir) !== normalizeIdentity(main.commonDir)) throw new Error("Manifest worktree does not belong to this repository.");
  if (sha256(normalizeIdentity(taskRoot)) !== manifest.worktreePathHash) throw new Error("Worktree identity does not match manifest.");
  const mainHead = currentHead(main);
  if (spawnSync("git", ["merge-base", "--is-ancestor", manifest.taskHead, mainHead], { cwd: main.root, windowsHide: true }).status !== 0) {
    throw new Error("Task HEAD is not integrated into main.");
  }
  const receiptPath = receiptFile(main, options, manifest.handoffId);
  if (!fs.existsSync(receiptPath)) throw new Error("Matching main-checkout consumption receipt is missing.");
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  const noteHash = verifyNote(manifest);
  if (receipt.handoffId !== manifest.handoffId || receipt.taskHead !== manifest.taskHead ||
      receipt.noteHash !== noteHash || receipt.integratedHead !== mainHead || receipt.result !== "passed") {
    throw new Error("Consumption receipt does not match this handoff and current integrated HEAD.");
  }
  const allowed = new Set([posixRelative(taskRoot, manifestInfo.absolute)]);
  if (manifest.note.kind === "file") allowed.add(manifest.note.path);
  const leftovers = worktreeStatus(taskRoot).filter((file) => !allowed.has(file));
  if (leftovers.length > 0) throw new Error(`Unconsumed worktree files remain:\n${leftovers.join("\n")}`);
  if (!options.apply) {
    process.stdout.write(`READY ${taskRoot}\nRe-run with --apply to remove the worktree.\n`);
    return 0;
  }
  for (const relative of allowed) {
    const target = path.resolve(taskRoot, relative);
    if (under(taskRoot, target) && fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
  git(main.root, ["worktree", "remove", taskRoot]);
  if (options.branch) git(main.root, ["branch", "-d", options.branch]);
  process.stdout.write(`REMOVED ${taskRoot}\n`);
  return 0;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) { printHelp(); return; }
    let status;
    switch (options.command) {
      case "check": {
        const result = runCheck(options);
        status = result.failures.length > 0 ? 1 : 0;
        break;
      }
      case "find": status = runFind(options); break;
      case "handoff-create": status = runHandoffCreate(options); break;
      case "handoff-consume": status = runHandoffConsume(options); break;
      case "worktree-finish": status = runWorktreeFinish(options); break;
      default: throw new Error(`Unknown command: ${options.command}`);
    }
    process.exitCode = status;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

main();
