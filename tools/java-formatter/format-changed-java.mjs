#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = path.join(TOOL_ROOT, "codestyle.xml");
const FORMATTER_POM = path.join(TOOL_ROOT, "pom.xml");
const FORMATTER_SOURCE = path.join(TOOL_ROOT, "src", "main", "java", "dev", "asdf", "tools", "JavaFormatter.java");
const FORMATTER_JAR = path.join(TOOL_ROOT, "target", "java-formatter.jar");
const FORMATTER_JAR_STAMP = FORMATTER_JAR + ".sha256";
const TEST_SOURCE_PATTERNS = [
  /(^|\/)src\/test\//,
  /(^|\/)test\//,
  /(^|\/)tests\//,
];

export function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

export function findGitRoot(cwd = process.cwd()) {
  const result = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  return result.status === 0 ? path.resolve(result.stdout.trim()) : null;
}

function gitPaths(repoRoot, args) {
  const result = run("git", args, { cwd: repoRoot, encoding: "buffer" });
  if (result.status !== 0) {
    const output = String(result.stderr || result.stdout || "").trim();
    throw new Error("git " + args.join(" ") + " failed" + (output ? ": " + output : ""));
  }
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function inside(repoRoot, file) {
  const relative = path.relative(repoRoot, file);
  return relative !== "" && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative);
}

// A repository without commits has no base, so every file counts as new; any other
// base that does not resolve is a typo, and falling back to whole files would hide it.
export function resolveBase(repoRoot, base = "HEAD") {
  const result = run("git", ["rev-parse", "--verify", "--quiet", base + "^{commit}"], { cwd: repoRoot });
  if (result.status === 0) return result.stdout.trim();
  if (base === "HEAD") return null;
  throw new Error("--base " + base + " does not name a commit.");
}

export function changedPaths(repoRoot, base = resolveBase(repoRoot)) {
  const tracked = base
    ? gitPaths(repoRoot, ["diff", "--name-only", "-z", "--diff-filter=ACMRD", base, "--"])
    : gitPaths(repoRoot, ["ls-files", "--cached", "-z"]);
  return [...new Set([
    ...tracked,
    ...gitPaths(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ])];
}

function isTestSource(repoRoot, file) {
  const relative = path.relative(repoRoot, file).replaceAll("\\", "/");
  return TEST_SOURCE_PATTERNS.some((pattern) => pattern.test(relative));
}

// Returns the new-side line ranges of the file's diff against base, or null when the
// base does not hold the file and the whole file is the change. A pure deletion
// reports the lines on both sides of the gap it leaves.
export function changedLineRanges(repoRoot, file, base) {
  if (!base) return null;
  const relative = path.relative(repoRoot, file).replaceAll("\\", "/");
  if (run("git", ["cat-file", "-e", base + ":" + relative], { cwd: repoRoot }).status !== 0) return null;
  const diff = run("git", ["diff", "-U0", "--no-color", "--no-ext-diff", base, "--", relative], { cwd: repoRoot, encoding: "buffer" });
  if (diff.status !== 0) {
    throw new Error("git diff " + base + " -- " + relative + " failed: " + String(diff.stderr || "").trim());
  }
  const ranges = [];
  for (const hunk of diff.stdout.toString("utf8").matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    ranges.push(count === 0 ? [Math.max(start, 1), start + 1] : [start, start + count - 1]);
  }
  return ranges;
}

export function changedJavaFiles(repoRoot, explicitFiles = [], options = {}) {
  const includeTests = options.includeTests === true;
  if (explicitFiles.length === 0) {
    return [...new Set(changedPaths(repoRoot, options.base))]
      .filter((file) => file.toLowerCase().endsWith(".java"))
      .map((file) => path.resolve(repoRoot, file))
      .filter((file) => inside(repoRoot, file) && fs.existsSync(file) && fs.statSync(file).isFile())
      .filter((file) => includeTests || !isTestSource(repoRoot, file));
  }

  // A named path the formatter cannot take is an error: dropping it would report a
  // file as formatted or checked when nothing looked at it.
  const cwd = options.cwd || process.cwd();
  const realRoot = canonicalPath(repoRoot);
  const files = [];
  const problems = [];
  for (const named of new Set(explicitFiles)) {
    const file = path.resolve(cwd, named);
    const problem = !fs.existsSync(file) || !fs.statSync(file).isFile() ? "is not an existing file"
      : !file.toLowerCase().endsWith(".java") ? "is not a Java source"
      : !inside(realRoot, canonicalPath(file)) ? "is outside the repository"
      : !includeTests && isTestSource(repoRoot, file) ? "is a test source; add --include-tests to take it"
      : null;
    if (problem) problems.push(named + " " + problem);
    else files.push(file);
  }
  if (problems.length > 0) {
    throw new Error("--files names paths the formatter cannot take:\n  " + problems.join("\n  "));
  }
  return files;
}

function javaMajorVersion(repoRoot) {
  const result = run("java", ["-version"], { cwd: repoRoot });
  const output = String(result.stderr || "") + String(result.stdout || "");
  const match = output.match(/version "(?:1\.)?(\d+)/);
  return match ? Number(match[1]) : 0;
}

// The jar is rebuilt when the POM or Java sources change by content; timestamps are
// not trusted because the tool is reached through links and copies.
function buildInputsDigest() {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(FORMATTER_POM));
  const pending = [path.join(TOOL_ROOT, "src", "main", "java")];
  const sources = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else sources.push(full);
    }
  }
  for (const source of sources.sort()) {
    hash.update(path.relative(TOOL_ROOT, source).replaceAll("\\", "/")).update(fs.readFileSync(source));
  }
  return hash.digest("hex");
}

function ensureFormatterJar(repoRoot) {
  const digest = buildInputsDigest();
  if (fs.existsSync(FORMATTER_JAR) && fs.existsSync(FORMATTER_JAR_STAMP)
    && fs.readFileSync(FORMATTER_JAR_STAMP, "utf8").trim() === digest) return;
  if (javaMajorVersion(repoRoot) < 8) {
    throw new Error("The Java formatter requires JDK 8 or newer.");
  }
  const args = ["-q", "-f", FORMATTER_POM, "-DskipTests", "package"];
  const maven = process.platform === "win32"
    ? { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "mvn.cmd", ...args] }
    : { command: "mvn", args };
  const result = run(maven.command, maven.args, { cwd: TOOL_ROOT });
  if (result.status !== 0 || !fs.existsSync(FORMATTER_JAR)) {
    const output = [result.error && result.error.message, result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error("Building the Java formatter jar failed" + (output ? ":\n" + output : ""));
  }
  fs.writeFileSync(FORMATTER_JAR_STAMP, digest + "\n", "utf8");
}

function formatterCommand(repoRoot, configPath) {
  if (!fs.existsSync(FORMATTER_POM) || !fs.existsSync(configPath)) {
    throw new Error("The Java formatter POM or codestyle.xml is missing.");
  }
  ensureFormatterJar(repoRoot);
  return { command: "java", args: ["-jar", FORMATTER_JAR] };
}

function javadocs(source) {
  return source.match(/\/\*\*[\s\S]*?\*\//g) || [];
}

export function restoreJavadocs(file, before, after, repoRoot = process.cwd()) {
  const original = javadocs(before);
  const formatted = javadocs(after);
  if (original.length !== formatted.length) {
    throw new Error(path.relative(repoRoot, file) + " Javadoc block count changed; refusing to overwrite it.");
  }
  let index = 0;
  return after.replace(/\/\*\*[\s\S]*?\*\//g, () => original[index++]);
}

export function assertJavadocsUnchanged(file, before, after, repoRoot = process.cwd()) {
  const original = javadocs(before);
  const formatted = javadocs(after);
  if (original.length !== formatted.length || original.some((block, index) => block !== formatted[index])) {
    throw new Error(path.relative(repoRoot, file) + " Javadoc would change; refusing to overwrite it.");
  }
}

export function formatterInputs(configPath = DEFAULT_CONFIG) {
  return [
    fileURLToPath(import.meta.url),
    FORMATTER_POM,
    configPath,
    FORMATTER_SOURCE,
  ];
}

export function formatChangedJava(options = {}) {
  const repoRoot = options.repoRoot || findGitRoot(options.cwd);
  if (!repoRoot) return [];
  const explicitFiles = options.explicitFiles || [];
  const configPath = options.configPath || process.env.ASDF_JAVA_FORMAT_CONFIG || DEFAULT_CONFIG;
  const base = resolveBase(repoRoot, options.base || "HEAD");
  const files = changedJavaFiles(repoRoot, explicitFiles, { includeTests: options.includeTests === true, base, cwd: options.cwd })
    .map((file) => ({ file, ranges: changedLineRanges(repoRoot, file, base) }))
    .filter((item) => item.ranges === null || item.ranges.length > 0);
  if (files.length === 0) return [];

  const formatter = formatterCommand(repoRoot, configPath);
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "asdf-java-format-"));
  const prepared = [];
  try {
    for (const [index, { file, ranges }] of files.entries()) {
      const before = fs.readFileSync(file, "utf8");
      const temporary = path.join(temporaryDir, String(index) + "-" + path.basename(file));
      fs.writeFileSync(temporary, before, "utf8");
      prepared.push({ file, before, temporary, ranges });
    }

    // Each line is "<file>\t<ranges>": "*" formats the whole file, "3-7,12-12" only those lines' members.
    const fileList = path.join(temporaryDir, "files.txt");
    fs.writeFileSync(fileList, prepared.map((item) => item.temporary + "\t"
      + (item.ranges === null ? "*" : item.ranges.map(([from, to]) => from + "-" + to).join(","))).join("\n") + "\n", "utf8");
    const result = run(formatter.command, formatter.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ASDF_JAVA_FORMAT_CONFIG: configPath,
        ASDF_JAVA_FORMAT_FILE_LIST: fileList,
      },
    });
    if (result.status !== 0) {
      const output = [
        result.error && result.error.message,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n").trim();
      throw new Error("Eclipse JDT Formatter failed" + (output ? ":\n" + output : ""));
    }

    for (const item of prepared) {
      item.after = restoreJavadocs(item.file, item.before, fs.readFileSync(item.temporary, "utf8"), repoRoot);
      assertJavadocsUnchanged(item.file, item.before, item.after, repoRoot);
    }

    const changed = prepared.filter((item) => item.before !== item.after);
    if (options.checkOnly) return changed.map((item) => item.file);
    const written = [];
    try {
      for (const item of changed) {
        fs.writeFileSync(item.file, item.after, "utf8");
        written.push(item);
      }
    } catch (error) {
      for (const item of written) fs.writeFileSync(item.file, item.before, "utf8");
      throw error;
    }
    return changed.map((item) => item.file);
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

function parseExplicitFiles(args) {
  const marker = args.indexOf("--files");
  if (marker === -1) return [];
  const files = [];
  for (const arg of args.slice(marker + 1)) {
    if (arg.startsWith("--")) break;
    files.push(arg);
  }
  if (files.length === 0) throw new Error("--files requires at least one task-owned path.");
  return files;
}

function parseBase(args) {
  const marker = args.indexOf("--base");
  if (marker === -1) return "HEAD";
  const base = args[marker + 1];
  if (!base || base.startsWith("--")) throw new Error("--base requires a revision.");
  return base;
}

function selfTest() {
  const source = "/** original */\nclass A {}\n";
  assertJavadocsUnchanged("A.java", source, source.replace("class A {}", "class A { }"));
  let rejected = false;
  try {
    assertJavadocsUnchanged("A.java", source, source.replace("original", "changed"));
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Javadoc mutation did not fail.");
  for (const input of formatterInputs()) {
    if (!fs.existsSync(input)) throw new Error("Java formatter input is missing: " + input);
  }
  process.stdout.write("Java formatter wrapper self-test OK\n");
}

function main(args) {
  if (args.includes("--self-test")) return selfTest();
  const changed = formatChangedJava({
    cwd: process.cwd(),
    explicitFiles: parseExplicitFiles(args),
    base: parseBase(args),
    includeTests: args.includes("--include-tests"),
    checkOnly: args.includes("--check"),
  });
  if (changed.length > 0) {
    process.stdout.write((args.includes("--check") ? "Formatting required for " : "Formatted ")
      + changed.length + " Java file(s); inspect the explicit file scope.\n");
    process.exitCode = 3;
  }
}

function canonicalPath(file) {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return path.resolve(file);
  }
}

if (process.argv[1] && canonicalPath(process.argv[1]) === canonicalPath(fileURLToPath(import.meta.url))) {
  Promise.resolve()
    .then(() => main(process.argv.slice(2)))
    .catch((error) => {
      process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
      process.exitCode = 1;
    });
}
