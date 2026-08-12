import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = fs.readFileSync(path.join(ROOT, "skills", "code-forge", "SKILL.md"), "utf8");
const stateEffects = fs.readFileSync(
  path.join(ROOT, "skills", "code-forge", "STATE-AND-EFFECTS.md"),
  "utf8",
);

test("code-forge routes only active implementation work", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.match(frontmatter, /^description: >$/m);
  assert.match(frontmatter, /actively implementing or refactoring already-selected behavior/);
  assert.match(frontmatter, /compare implementation strategies\s+without editing/);
  assert.match(frontmatter, /semantic blast radius/);
});

test("code-forge scales framing and requires containment", () => {
  assert.match(skill, /Scale the frame to the change risk/);
  assert.match(
    skill,
    /```text\nOutcome:\nRequired invariant:\nChange boundary:\nProof obligation:\n```/,
  );
  assert.match(skill, /\*\*intended:\*\*/);
  assert.match(skill, /\*\*protected:\*\*/);
  assert.match(skill, /\*\*unknown:\*\*/);
  assert.match(skill, /a common implementation is not\nproof of a common contract/);
  assert.match(skill, /Behavior proof has two parts/);
  assert.match(skill, /compound operation may occupy\s+several classes/i);
  assert.match(skill, /every changed production symbol/);
  assert.match(skill, /\[State, effect, and boundary semantics\]\(STATE-AND-EFFECTS\.md\)/);
  assert.match(stateEffects, /Classify each step and handoff independently/);
});
