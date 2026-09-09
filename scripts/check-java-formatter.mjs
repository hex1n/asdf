#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORMATTER = path.join(ROOT, "tools", "java-formatter", "format-changed-java.mjs");
const HOOK = path.join(ROOT, "tools", "java-formatter", "run-agent-hook.mjs");
const CONFIG = path.join(ROOT, "tools", "java-formatter", "codestyle.xml");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function requireStatus(result, expected, label) {
  if (result.status !== expected) {
    throw new Error(label + " exited " + result.status + " instead of " + expected + "\n"
      + String(result.stdout || "") + String(result.stderr || ""));
  }
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, "utf8");
}

function git(repo, args) {
  const result = run("git", args, { cwd: repo });
  requireStatus(result, 0, "git " + args.join(" "));
}

function runShapeContracts(temporaryDir) {
  requireStatus(run(process.execPath, [FORMATTER, "--self-test"]), 0, "formatter self-test");
  requireStatus(run(process.execPath, [HOOK, "--self-test"]), 0, "hook self-test");
  runFormatterShapeContract(temporaryDir);

  const linkedTool = path.join(temporaryDir, "linked-java-formatter");
  fs.symlinkSync(path.dirname(FORMATTER), linkedTool, process.platform === "win32" ? "junction" : "dir");
  const linked = run(process.execPath, [path.join(linkedTool, "format-changed-java.mjs"), "--self-test"]);
  requireStatus(linked, 0, "linked formatter entry point");
  assert.match(linked.stdout, /Java formatter wrapper self-test OK/,
    "linked formatter entry point must execute instead of silently returning");

  const narrowed = path.join(temporaryDir, "narrowed.xml");
  const config = fs.readFileSync(CONFIG, "utf8");
  write(narrowed, config.replace(
    '<setting id="org.eclipse.jdt.core.formatter.lineSplit" value="140"/>',
    '<setting id="org.eclipse.jdt.core.formatter.lineSplit" value="100"/>',
  ));
  assert.throws(
    () => runFormatterShapeContract(temporaryDir, narrowed),
    /shape|continuation|assignment|method declaration/i,
    "lineSplit mutation must kill the accepted generic shape contract",
  );
}

function runFormatterShapeContract(temporaryDir, configPath = CONFIG) {
  const repo = fs.mkdtempSync(path.join(temporaryDir, "shape-contract-"));
  git(repo, ["init", "-q"]);
  const file = path.join(repo, "ShapeProbe.java");
  write(file, [
    "class ShapeProbe {",
    "    public ResultWithAReasonablyLongName accept(RequestWithAReasonablyLongName request, SnapshotWithAReasonablyLongName snapshot, CommandWithAReasonablyLongName command) { return null; }",
    "    void assignment() { List<GenericItemWithLongName> items = service.loadByGroupAndType(groupIdentifier, typeIdentifierWithLongName); }",
    "    void chain() { target.add(Item.builder().first(command.getFirst()).second(command.getSecond()).third(command.getThird()).fourth(command.getFourth()).fifth(command.getFifth()).sixth(sixth).enabled(true).build()); }",
    "    void stream() { BigDecimal total = valuesWithAReasonablyLongName.stream().map(ValueWithAReasonablyLongName::amount).reduce(BigDecimal.ZERO, BigDecimal::add); }",
    "    void shortStream() { long count = values.stream().filter(value -> !value.isEmpty()).count(); }",
    "    void shortBuilder() { Item item = Item.builder().fieldA(fieldA).fieldB(fieldB).build(); }",
    "    void constructorBuilder() { Item constructed = new Item().fieldA(fieldA).fieldB(fieldB).build(); }",
    "    void parenthesizedBuilder() { Item parenthesized = (factory.create()).fieldA(fieldA).fieldB(fieldB).build(); }",
    "    void twoLinkChain() { boolean blank = valueWithAReasonablyLongName.trim().isEmpty(); }",
    "    void genericReceiver() { Map<String, List<GenericItemWithLongName>> grouped = itemsWithAReasonablyLongName.stream().filter(item -> item.isActive()).collect(Collectors.groupingBy(GenericItemWithLongName::group)); }",
    "    void multilineArguments() { MultilineItem multiline = MultilineItem.builder().fieldA(firstArgumentWithAnExtremelyLongNeutralNameDesignedToExceedTheConfiguredLineWidth, secondArgumentWithAnExtremelyLongNeutralNameDesignedToExceedTheConfiguredLineWidth).build(); }",
    "}",
    "",
  ].join("\n"));
  const result = run(process.execPath, [FORMATTER, "--files", file], {
    cwd: repo,
    env: { ...process.env, ASDF_JAVA_FORMAT_CONFIG: configPath },
  });
  requireStatus(result, 3, "generic shape format");

  const formatted = fs.readFileSync(file, "utf8");
  const lines = formatted.split(/\r?\n/);
  const declaration = lines.findIndex((line) => line.includes("accept("));
  const continuation = lines[declaration + 1];
  const firstParameterColumn = lines[declaration].indexOf("RequestWithAReasonablyLongName");
  if (!continuation || continuation.indexOf("CommandWithAReasonablyLongName") !== firstParameterColumn) {
    throw new Error("Method declaration continuation is not aligned under the first parameter.\n" + formatted);
  }
  const assignment = "        List<GenericItemWithLongName> items = service.loadByGroupAndType(groupIdentifier, typeIdentifierWithLongName);";
  if (!formatted.includes(assignment)) {
    throw new Error("Simple assignment did not remain on one line.\n" + formatted);
  }
  assertVerticalChain(formatted, lines, "long count = values.stream()", [
    ".filter(value -> !value.isEmpty())",
    ".count();",
  ]);
  assertVerticalChain(formatted, lines, "Item item = Item.builder()", [
    ".fieldA(fieldA)",
    ".fieldB(fieldB)",
    ".build();",
  ]);
  assertVerticalChain(formatted, lines, "Item constructed = new Item()", [
    ".fieldA(fieldA)",
    ".fieldB(fieldB)",
    ".build();",
  ]);
  assertVerticalChain(formatted, lines, "Item parenthesized = (factory.create())", [
    ".fieldA(fieldA)",
    ".fieldB(fieldB)",
    ".build();",
  ]);
  assertMultilineChainArguments(formatted, lines);
  const twoLink = "        boolean blank = valueWithAReasonablyLongName.trim().isEmpty();";
  if (!formatted.includes(twoLink)) {
    throw new Error("Two-link chain must stay on one line.\n" + formatted);
  }
  assertVerticalChain(formatted, lines, "List<GenericItemWithLongName>> grouped = itemsWithAReasonablyLongName.stream()", [
    ".filter(item -> item.isActive())",
    ".collect(Collectors.groupingBy(GenericItemWithLongName::group));",
  ]);
  const streamDeclaration = lines.findIndex((line) => line.includes("BigDecimal total = valuesWithAReasonablyLongName.stream()"));
  if (streamDeclaration === -1) {
    throw new Error("Stream declaration was not preserved as the expected first line.\n" + formatted);
  }
  const streamMap = lines[streamDeclaration + 1];
  const streamReduce = lines[streamDeclaration + 2];
  const streamIndent = lines[streamDeclaration].indexOf("BigDecimal");
  if (!streamMap || !streamReduce
    || !streamMap.trimStart().startsWith(".map(ValueWithAReasonablyLongName::amount)")
    || !streamReduce.trimStart().startsWith(".reduce(BigDecimal.ZERO, BigDecimal::add);")
    || streamMap.indexOf(".map") !== streamIndent + 8
    || streamReduce.indexOf(".reduce") !== streamIndent + 8) {
    throw new Error("Stream chain is not in the expected continuation shape.\n" + formatted);
  }
  const stages = [
    ".first(", ".second(", ".third(", ".fourth(",
    ".fifth(", ".sixth(", ".enabled(", ".build()",
  ];
  for (const stage of stages) {
    if (!lines.some((line) => line.trimStart().startsWith(stage))) {
      throw new Error("Fluent stage is not vertical: " + stage + "\n" + formatted);
    }
  }
  const repeat = run(process.execPath, [FORMATTER, "--files", file], {
    cwd: repo,
    env: { ...process.env, ASDF_JAVA_FORMAT_CONFIG: configPath },
  });
  requireStatus(repeat, 0, "idempotent fluent-chain format");
  assert.equal(fs.readFileSync(file, "utf8"), formatted, "fluent-chain formatting must be idempotent");
  return formatted;
}

function assertVerticalChain(formatted, lines, declarationText, selectors) {
  const declaration = lines.findIndex((line) => line.includes(declarationText));
  if (declaration === -1) {
    throw new Error("Fluent chain declaration was not preserved: " + declarationText + "\n" + formatted);
  }
  const declarationIndent = lines[declaration].search(/\S/);
  for (const [offset, selector] of selectors.entries()) {
    const line = lines[declaration + offset + 1];
    if (!line || !line.trimStart().startsWith(selector) || line.search(/\S/) !== declarationIndent + 8) {
      throw new Error("Short fluent chain is not vertical: " + selector + "\n" + formatted);
    }
  }
}

function assertMultilineChainArguments(formatted, lines) {
  const declaration = lines.findIndex((line) => line.includes("MultilineItem multiline = MultilineItem.builder()"));
  const field = declaration + 1;
  const secondArgument = lines.findIndex((line, index) => index > field
    && line.includes("secondArgumentWithAnExtremelyLongNeutralNameDesignedToExceedTheConfiguredLineWidth"));
  const build = lines.findIndex((line, index) => index > field && line.trimStart().startsWith(".build();"));
  const declarationIndent = declaration >= 0 ? lines[declaration].search(/\S/) : -1;
  const fieldIndent = field < lines.length ? lines[field].search(/\S/) : -1;
  const argumentIndent = secondArgument >= 0 ? lines[secondArgument].search(/\S/) : -1;
  if (declaration < 0 || !lines[field].trimStart().startsWith(".fieldA(")
    || fieldIndent !== declarationIndent + 8
    || secondArgument <= field || secondArgument >= build
    || argumentIndent <= fieldIndent) {
    throw new Error("Multiline fluent arguments are not aligned beneath their selector.\n" + formatted);
  }
}

function runChangedFileContract(temporaryDir) {
  const repo = path.join(temporaryDir, "repo");
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "formatter@example.invalid"]);
  git(repo, ["config", "user.name", "Formatter Probe"]);
  const changed = path.join(repo, "Changed.java");
  const unchanged = path.join(repo, "Unchanged.java");
  const deleted = path.join(repo, "Deleted.java");
  const notes = path.join(repo, "notes.txt");
  const legacy = path.join(repo, "Legacy.java");
  write(changed, "class Changed {\n    void oldName() {}\n}\n");
  write(unchanged, "class Unchanged {\n}\n");
  write(deleted, "class Deleted {\n}\n");
  write(notes, "kept\n");
  write(legacy, "class Legacy {}\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "baseline"]);

  const javadoc = "/** keep this byte-for-byte */";
  write(changed, javadoc + "\nclass Changed { void changed( ) { } }\n");
  write(path.join(repo, "New.java"), "class New { void added( ) { } }\n");
  fs.rmSync(deleted);
  write(notes, "still not Java\n");
  const legacyJavadoc = "/**\r\n"
    + " * 费用方案:基准档位表与 [0,1] 折扣乘数,0 表示命中档位但不收费。\n"
    + " *\r\n"
    + " * @author hexin\r\n"
    + " * @date 2026/08/07\r\n"
    + " */";
  write(legacy, legacyJavadoc
    + "\r\n@Deprecated\r\nclass Legacy {\r\n\r\n    private int first;\n\n    void changed( ) { }\n}\r\n");
  const unchangedBefore = fs.readFileSync(unchanged, "utf8");

  const first = run(process.execPath, [FORMATTER], { cwd: repo });
  requireStatus(first, 3, "first changed-file format");
  assert.match(fs.readFileSync(changed, "utf8"), /void changed\(\) \{/);
  assert.ok(fs.readFileSync(changed, "utf8").startsWith(javadoc), "Javadoc bytes must remain unchanged");
  assert.match(fs.readFileSync(path.join(repo, "New.java"), "utf8"), /void added\(\) \{/);
  assert.equal(fs.readFileSync(unchanged, "utf8"), unchangedBefore);
  assert.equal(fs.existsSync(deleted), false);
  assert.equal(fs.readFileSync(notes, "utf8"), "still not Java\n");
  const formattedLegacy = fs.readFileSync(legacy, "utf8");
  assert.ok(formattedLegacy.startsWith(legacyJavadoc), "legacy Javadoc bytes must remain unchanged");
  assert.doesNotMatch(formattedLegacy.slice(legacyJavadoc.length), /(^|[^\r])\n/,
    "formatted layout around a preserved Javadoc must use the source's CRLF convention");
  requireStatus(run(process.execPath, [FORMATTER], { cwd: repo }), 0, "idempotent changed-file format");

  const good = fs.readFileSync(changed, "utf8").replace("void changed()", "void changed( )");
  write(changed, good);
  write(path.join(repo, "Broken.java"), "class Broken { void broken( { }\n");
  const goodBeforeFailure = fs.readFileSync(changed, "utf8");
  requireStatus(run(process.execPath, [FORMATTER], { cwd: repo }), 1, "invalid batch");
  assert.equal(fs.readFileSync(changed, "utf8"), goodBeforeFailure,
    "a failing batch must not partially write a valid peer");
}

function runSourceScopeContract(temporaryDir) {
  const repo = path.join(temporaryDir, "source-scope-repo");
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "formatter@example.invalid"]);
  git(repo, ["config", "user.name", "Formatter Probe"]);
  const production = path.join(repo, "src", "main", "java", "Production.java");
  const unitTest = path.join(repo, "src", "test", "java", "ProductionTest.java");
  const appTest = path.join(repo, "app", "test", "src", "Test.java");
  write(production, "class Production { void oldName() {} }\n");
  write(unitTest, "class ProductionTest { void oldName( ) { } }\n");
  write(appTest, "class Test { void oldName( ) { } }\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "baseline"]);

  write(production, "class Production { void changed( ) { } }\n");
  const unitTestBefore = fs.readFileSync(unitTest, "utf8");
  const appTestBefore = fs.readFileSync(appTest, "utf8");
  const productionRun = run(process.execPath, [FORMATTER], { cwd: repo });
  requireStatus(productionRun, 3, "production-only format");
  assert.match(fs.readFileSync(production, "utf8"), /void changed\(\) \{/);
  assert.equal(fs.readFileSync(unitTest, "utf8"), unitTestBefore,
    "src/test Java must remain unchanged by the default formatter scope");
  assert.equal(fs.readFileSync(appTest, "utf8"), appTestBefore,
    "app/test Java must remain unchanged by the default formatter scope");

  const testRun = run(process.execPath, [FORMATTER, "--include-tests", "--files", unitTest, appTest], { cwd: repo });
  requireStatus(testRun, 3, "explicit test format");
  assert.match(fs.readFileSync(unitTest, "utf8"), /void oldName\(\) \{/);
  assert.match(fs.readFileSync(appTest, "utf8"), /void oldName\(\) \{/);
}

function hookRun(repo, stateRoot, label, extraEnv = {}) {
  const result = run(process.execPath, [HOOK], {
    cwd: repo,
    input: "{}",
    env: { ...process.env, ASDF_AGENT_STATE_ROOT: stateRoot, ...extraEnv },
  });
  requireStatus(result, 0, label);
  const output = String(result.stdout || "").trim();
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(label + " returned invalid hook JSON:\n" + output + String(result.stderr || ""));
  }
}

function runHookScopeContract(temporaryDir) {
  const repo = path.join(temporaryDir, "scope-repo");
  const stateRoot = path.join(temporaryDir, "scope-state");
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "formatter@example.invalid"]);
  git(repo, ["config", "user.name", "Formatter Probe"]);
  write(path.join(repo, "notes.txt"), "seed\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "seed"]);
  const peer = path.join(repo, "Peer.java");
  const peerBytes = "class Peer { void peer( ) { } }\n";
  write(peer, peerBytes);
  git(repo, ["add", "Peer.java"]);
  const indexPath = path.join(repo, ".git", "index");
  const indexBefore = fs.readFileSync(indexPath);
  assert.deepEqual(hookRun(repo, stateRoot, "reader A stop"), {});
  const newerBytes = peerBytes.replace("peer", "peerEditing");
  write(peer, newerBytes);
  assert.deepEqual(hookRun(repo, stateRoot, "reader A after writer B"), {});
  assert.equal(fs.readFileSync(peer, "utf8"), newerBytes);
  assert.deepEqual(fs.readFileSync(indexPath), indexBefore, "Stop must not stage or rewrite the index");

  const alternateConfig = path.join(temporaryDir, "profile-upgrade.xml");
  write(alternateConfig, fs.readFileSync(CONFIG, "utf8").replace('value="140"', 'value="100"'));
  assert.deepEqual(hookRun(repo, stateRoot, "profile upgrade", { ASDF_JAVA_FORMAT_CONFIG: alternateConfig }), {});
  assert.equal(fs.readFileSync(peer, "utf8"), newerBytes, "profile changes must not widen writes");

  const worktree = path.join(temporaryDir, "task-worktree");
  git(repo, ["worktree", "add", "-qb", "task", worktree]);
  const taskIndexPath = path.resolve(worktree, run("git", ["rev-parse", "--git-path", "index"], { cwd: worktree }).stdout.trim());
  const taskIndexBefore = fs.readFileSync(taskIndexPath);
  const owned = path.join(worktree, "Owned.java");
  const ownedBytes = "class Owned { void mine( ) { } }\n";
  write(owned, ownedBytes);
  assert.deepEqual(hookRun(worktree, stateRoot, "worktree stop"), {});
  const check = run(process.execPath, [HOOK, "--files", "Owned.java"], { cwd: worktree, input: "{}" });
  requireStatus(check, 0, "explicit Stop check");
  assert.equal(JSON.parse(check.stdout).decision, "block");
  assert.equal(fs.readFileSync(owned, "utf8"), ownedBytes, "explicit Stop check is read-only");
  assert.deepEqual(fs.readFileSync(taskIndexPath), taskIndexBefore, "worktree Stop must not stage files");
  assert.equal(fs.readFileSync(peer, "utf8"), newerBytes, "worktree check must not write the main checkout");
  requireStatus(run(process.execPath, [FORMATTER, "--check", "--files", owned], { cwd: worktree }), 3, "read-only formatter");
  assert.equal(fs.readFileSync(owned, "utf8"), ownedBytes);
  requireStatus(run(process.execPath, [FORMATTER, "--files", owned], { cwd: worktree }), 3, "explicit owned format");
  assert.match(fs.readFileSync(owned, "utf8"), /void mine\(\) \{/);
  assert.equal(fs.readFileSync(peer, "utf8"), newerBytes);
  assert.deepEqual(fs.readFileSync(indexPath), indexBefore);
  requireStatus(run(process.execPath, [FORMATTER, "--files"], { cwd: worktree }), 1, "empty scope must not widen");
}

// A missing checker is a setup failure. Reporting it as a record failure sends
// the reader to inspect rationale files that were never even read.
function runRationaleToolingContract(temporaryDir) {
  const repo = path.join(temporaryDir, "tooling-repo");
  const stateRoot = path.join(temporaryDir, "tooling-state");
  fs.mkdirSync(path.join(repo, "docs", "rationale"), { recursive: true });
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "formatter@example.invalid"]);
  git(repo, ["config", "user.name", "Formatter Probe"]);
  write(path.join(repo, "notes.txt"), "seed\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "seed"]);

  const missing = path.join(temporaryDir, "no-such-rationale.mjs");
  const blocked = hookRun(repo, stateRoot, "missing checker", { ASDF_RATIONALE_CLI: missing });
  assert.equal(blocked.decision, "block", "an unusable rationale checker must stop the handoff");
  assert.match(blocked.reason, /checker is not installed/,
    "the reason must name the missing checker, not the records");
  assert.match(blocked.reason, /install-agent-tools\.mjs --apply|ASDF_RATIONALE_CLI/,
    "the reason must carry the repair step");
  assert.doesNotMatch(blocked.reason, /require attention/,
    "a setup failure must not be reported as a record failure");

  const healthy = hookRun(repo, stateRoot, "installed checker");
  assert.deepEqual(healthy, {}, "a discoverable checker must validate an empty corpus without blocking");

  const noisy = path.join(temporaryDir, "noisy-rationale.mjs");
  write(noisy, "process.stdout.write(JSON.stringify({failures:[{id:'W-001',title:'anchor mismatch',detail:'shape occurs 0 times'}],selectedPaths:['one.java','two.java','three.java']})); process.exitCode=1;\n");
  const compact = hookRun(repo, stateRoot, "compact rationale failure", { ASDF_RATIONALE_CLI: noisy });
  assert.equal(compact.decision, "block", "a rationale failure must still block the handoff");
  assert.match(compact.reason, /W-001/);
  assert.match(compact.reason, /shape occurs 0 times/);
  assert.doesNotMatch(compact.reason, /selectedPaths|one\.java|two\.java|three\.java/,
    "rationale failure output must not dump selectedPaths");
}

const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "asdf-java-formatter-contract-"));
try {
  runShapeContracts(temporaryDir);
  runChangedFileContract(temporaryDir);
  runSourceScopeContract(temporaryDir);
  runHookScopeContract(temporaryDir);
  runRationaleToolingContract(temporaryDir);
  process.stdout.write("Portable Java formatter contract OK\n");
} finally {
  fs.rmSync(temporaryDir, { recursive: true, force: true });
}
