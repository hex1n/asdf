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

function compactSection(source, number) {
  const normalized = source.replace(/\r\n?/g, "\n");
  const body = normalized.match(
    new RegExp(`^## ${number}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## ${number + 1}\\.)`, "m"),
  )?.[1];
  assert.ok(body, `missing section ${number}`);
  return body.replace(/\s+/g, " ").trim();
}

function assertMechanismAndBoundaryContract(source) {
  const mechanism = compactSection(source, 2);
  const mainPath = compactSection(source, 5);
  const cleanup = compactSection(source, 7);

  for (const required of [
    "3. compare complete viable implementations",
    "reuse of an existing owner, helper, or type whose full contract matches",
    "direct local code built on the language runtime or standard library",
    "an already-installed dependency",
    "- prefer reuse when the full contract and reason to change match",
    "- prefer the dependency when it is the repository contract",
    "- prefer direct code when the behavior is small, domain-specific",
    "Give each canonical decision one semantic authority.",
    "Repeated enforcement at independent trust boundaries may remain",
    "After selecting the mechanism, use this code-structure preference order:",
  ]) assert.ok(mechanism.includes(required), `missing mechanism contract: ${required}`);

  assert.ok(mainPath.includes("Normalize and validate inputs at each appropriate trust boundary"));
  assert.ok(cleanup.includes("5. rerun the mechanism comparison"));
  assert.ok(cleanup.includes("preserving independent trust-boundary enforcement"));
  assert.ok(cleanup.includes("same canonical decision is independently defined in multiple lifecycle paths"));

  const guidance = `${mechanism} ${mainPath} ${cleanup}`.toLowerCase();
  assert.doesNotMatch(guidance, /\b(?:do not|never)\s+(?:compare|normalize|preserve)\b/);
  assert.doesNotMatch(guidance, /\balways prefer (?:the )?dependency\b/);
  assert.doesNotMatch(guidance, /\b(?:remove|collapse) (?:repeated|independent) trust-boundary enforcement\b/);

  for (const forbidden of [
    "stop at the first mechanism",
    "first applicable step",
    "installed dependency satisfies the same contract",
    "collapse duplicate policy, validation",
    "same rule appears in multiple lifecycle paths",
  ]) assert.ok(!`${mechanism} ${cleanup}`.includes(forbidden), `forbidden contract: ${forbidden}`);
}

test("code-forge routes only active implementation work", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.match(frontmatter, /^description: >$/m);
  assert.match(frontmatter, /correct, clear, change-contained production code/);
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
  assert.match(skill, /Correctness, clarity, containment, and simplicity are separate\s+requirements/);
  assert.match(skill, /Keep each changed unit cohesive around a coherent responsibility/);
  assert.match(skill, /domain-bearing names and explicit control flow/);
  assert.match(skill, /failure behavior are understandable from local context/);
  assert.match(skill, /compound operation may occupy\s+several classes/i);
  assert.match(skill, /every changed production symbol/);
  assert.match(skill, /\[State, effect, and boundary semantics\]\(STATE-AND-EFFECTS\.md\)/);
  assert.match(stateEffects, /Classify each step and handoff independently/);
});

test("code-forge compares mechanisms and preserves trust-boundary enforcement", () => {
  assertMechanismAndBoundaryContract(skill);
});

test("code-forge contract rejects guarded reversals and tolerates reflow", () => {
  for (const [from, to] of [
    ["3. compare complete viable implementations", "3. do not compare complete viable implementations"],
    ["- prefer the dependency when", "- always prefer the dependency when"],
    ["Normalize and validate inputs", "Do not Normalize and validate inputs"],
    ["while preserving independent trust-boundary\n   enforcement", "while removing independent trust-boundary\n   enforcement"],
    ["failure contracts;", "failure contracts; always prefer dependency even when its contract does not fit;"],
    ["failure contracts;", "failure contracts; remove repeated trust-boundary enforcement;"],
    ["the same canonical decision is independently defined in\nmultiple lifecycle paths", "the same rule appears in multiple lifecycle paths"],
  ]) assert.throws(() => assertMechanismAndBoundaryContract(skill.replace(from, to)));

  const reflowed = skill
    .replace("complete viable implementations", "complete viable\nimplementations")
    .replace(/\n/g, "\r\n");
  assert.doesNotThrow(() => assertMechanismAndBoundaryContract(reflowed));
});
