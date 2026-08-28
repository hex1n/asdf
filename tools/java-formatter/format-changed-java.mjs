#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOL_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = path.join(TOOL_ROOT, "codestyle.xml");
const FORMATTER_POM = path.join(TOOL_ROOT, "pom.xml");
const FORMATTER_SOURCE = path.join(TOOL_ROOT, "src", "main", "java", "dev", "asdf", "tools", "JavaFormatter.java");

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

export function changedPaths(repoRoot) {
  const head = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: repoRoot });
  const tracked = head.status === 0
    ? gitPaths(repoRoot, ["diff", "--name-only", "-z", "--diff-filter=ACMRD", "HEAD", "--"])
    : gitPaths(repoRoot, ["ls-files", "--cached", "-z"]);
  return [...new Set([
    ...tracked,
    ...gitPaths(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ])];
}

export function changedJavaFiles(repoRoot, explicitFiles = []) {
  const candidates = explicitFiles.length > 0 ? explicitFiles : changedPaths(repoRoot);

  return [...new Set(candidates)]
    .filter((file) => file.toLowerCase().endsWith(".java"))
    .map((file) => path.resolve(repoRoot, file))
    .filter((file) => inside(repoRoot, file) && fs.existsSync(file) && fs.statSync(file).isFile());
}

function javaMajorVersion(repoRoot) {
  const result = run("java", ["-version"], { cwd: repoRoot });
  const output = String(result.stderr || "") + String(result.stdout || "");
  const match = output.match(/version "(?:1\.)?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatterCommand(repoRoot, configPath) {
  if (javaMajorVersion(repoRoot) < 8) {
    throw new Error("The Java formatter requires JDK 8 or newer.");
  }
  if (!fs.existsSync(FORMATTER_POM) || !fs.existsSync(configPath)) {
    throw new Error("The Java formatter POM or codestyle.xml is missing.");
  }
  const args = ["-q", "-f", FORMATTER_POM, "-DskipTests", "compile", "exec:java"];
  return process.platform === "win32"
    ? { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "mvn.cmd", ...args] }
    : { command: "mvn", args };
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
  const files = changedJavaFiles(repoRoot, explicitFiles);
  if (files.length === 0) return [];

  const formatter = formatterCommand(repoRoot, configPath);
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "asdf-java-format-"));
  const prepared = [];
  try {
    for (const [index, file] of files.entries()) {
      const before = fs.readFileSync(file, "utf8");
      const temporary = path.join(temporaryDir, String(index) + "-" + path.basename(file));
      fs.writeFileSync(temporary, before, "utf8");
      prepared.push({ file, before, temporary });
    }

    const fileList = path.join(temporaryDir, "files.txt");
    fs.writeFileSync(fileList, prepared.map((item) => item.temporary).join("\n") + "\n", "utf8");
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
  return marker === -1 ? [] : args.slice(marker + 1);
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
  if (!fs.existsSync(DEFAULT_CONFIG)) throw new Error("codestyle.xml is missing.");
  process.stdout.write("Java formatter wrapper self-test OK\n");
}

function shapeProbe(configPath) {
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "asdf-java-shapes-"));
  try {
    const file = path.join(temporaryDir, "ShapeProbe.java");
    const source = [
      "class ShapeProbe {",
      "    public MaintenanceAcceptance acceptDelete(FundTradeDeleteRequest request, MaintenanceAcceptanceSnapshot snapshot, MaintenanceOverlayCommand command) { return null; }",
      "    void assignment() { List<SalesTradeCommandBO> commands = salesTradeCommandService.fetchFullHistoryByMpCodeAndFundCode(mpCode, fundCode); }",
      "    void chain() { effective.add(EffectiveTrade.builder().transactionNo(command.getTransactionNo()).applyDate(command.getApplyDate()).tradeType(command.getTradeType()).tradeValue(command.getTradeValue()).feeRules(command.getFeeRules()).sameDaySequence(sequence).maintained(true).build()); }",
      "}",
      "",
    ].join("\n");
    fs.writeFileSync(file, source, "utf8");
    formatChangedJava({ repoRoot: temporaryDir, explicitFiles: [file], configPath });
    const formatted = fs.readFileSync(file, "utf8");
    const lines = formatted.split(/\r?\n/);
    const declaration = lines.findIndex((line) => line.includes("acceptDelete("));
    const continuation = lines[declaration + 1];
    const firstParameterColumn = lines[declaration].indexOf("FundTradeDeleteRequest");
    if (!continuation || continuation.indexOf("MaintenanceOverlayCommand") !== firstParameterColumn) {
      throw new Error("Method declaration continuation is not aligned under the first parameter.\n" + formatted);
    }
    const assignment = "        List<SalesTradeCommandBO> commands = salesTradeCommandService.fetchFullHistoryByMpCodeAndFundCode(mpCode, fundCode);";
    if (!formatted.includes(assignment)) {
      throw new Error("Simple assignment did not remain on one line.\n" + formatted);
    }
    const stages = [
      ".transactionNo(", ".applyDate(", ".tradeType(", ".tradeValue(",
      ".feeRules(", ".sameDaySequence(", ".maintained(", ".build()",
    ];
    for (const stage of stages) {
      if (!lines.some((line) => line.trimStart().startsWith(stage))) {
        throw new Error("Fluent stage is not vertical: " + stage + "\n" + formatted);
      }
    }
    process.stdout.write("Java formatter shape probe OK\n");
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

function main(args) {
  if (args.includes("--self-test")) return selfTest();
  if (args.includes("--self-test-shapes")) {
    const configIndex = args.indexOf("--config");
    const configPath = configIndex === -1 ? DEFAULT_CONFIG : path.resolve(args[configIndex + 1]);
    return shapeProbe(configPath);
  }
  const changed = formatChangedJava({ cwd: process.cwd(), explicitFiles: parseExplicitFiles(args) });
  if (changed.length > 0) {
    process.stdout.write("Formatted " + changed.length + " changed Java file(s); inspect the diff and stop again.\n");
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
