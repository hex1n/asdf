import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const skillRoot = path.join(repoRoot, "skills", "project-docs-layer");
const skillPath = path.join(skillRoot, "SKILL.md");
const referencePath = path.join(skillRoot, "REFERENCE.md");
const skill = fs.readFileSync(skillPath, "utf8");
const reference = fs.readFileSync(referencePath, "utf8");
const combined = `${skill}\n${reference}`;

test("portable frontmatter contains only routing fields", () => {
  const match = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "SKILL.md must start with YAML frontmatter");
  const keys = [...match[1].matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((item) => item[1]);
  assert.deepEqual(keys, ["name", "description"]);

  const descriptionLines = match[1]
    .split(/\r?\n/)
    .slice(2)
    .filter((line) => /^\s{2}/.test(line))
    .map((line) => line.trim());
  assert.ok(descriptionLines.join(" ").length <= 512, "description must stay compact");
});

test("all local Markdown pointers resolve", () => {
  for (const file of [skillPath, referencePath]) {
    const body = fs.readFileSync(file, "utf8");
    const targets = [
      ...[...body.matchAll(/\]\(([^)#]+\.md)(?:#[^)]+)?\)/g)].map((match) => match[1]),
      ...[...body.matchAll(/`((?:\.{1,2}\/)[^`]+\.md)`/g)].map((match) => match[1]),
    ];
    for (const target of targets) {
      const resolved = path.resolve(path.dirname(file), target);
      assert.ok(fs.existsSync(resolved), `${path.basename(file)} has a dangling pointer: ${target}`);
    }
  }
});

test("portable body has no repository-external workflow instance leaks", () => {
  for (const token of ["taskloop", "loop-core", ".taskloop", "outcome-ledger", "--keep-green"]) {
    assert.doesNotMatch(combined, new RegExp(token.replace(".", "\\."), "i"));
  }
});

test("audit, aggregation, safety, and evidence contracts stay explicit", () => {
  const scopeSection = skill.match(/## 3\. Fix The Scope([\s\S]*?)## 4\. Repair/i)?.[1] ?? "";
  assert.match(scopeSection, /audit-only request/i);
  assert.match(scopeSection, /stop\s+without editing repository files/i);
  assert.match(reference, /stale > undocumented > unverified > verified > absent/);
  assert.match(reference, /verified competing home does not hide it/i);
  assert.match(reference, /shared\s+or\s+production state/i);
  assert.match(reference, /do not modify tracked content or leave durable untracked artifacts/i);
  assert.match(skill, /observed\s+outcome matches the documented expectation/i);
});

test("command-safety recovery and audit-time exclusions stay explicit", () => {
  assert.match(reference, /safety\s+judgment\s+was\s+wrong/i);
  assert.match(reference, /snapshot\s+pair\s+attributes\s+to\s+the\s+command/i);
  assert.match(reference, /Reclassify\s+the\s+command\s+as\s+requiring\s+authority/i);
  assert.match(skill, /command-safety\s+recovery\s+rule\s+in\s+`REFERENCE\.md`/i);
  assert.match(reference, /Exclusions\s+during\s+every\s+audit/);
  assert.match(reference, /report\s+discovered\s+excluded\s+material\s+as\s+a\s+defect/i);
});

test("blocked evidence has a non-fabricated verdict", () => {
  assert.match(skill, /required\s+evidence cannot be obtained as `unverified`, not `stale`/i);
  assert.match(reference, /durable home exists[\s\S]{0,180}safe execution[\s\S]{0,120}unavailable/i);
  assert.match(reference, /missing evidence alone does\s+not make the home `stale`/i);
});
