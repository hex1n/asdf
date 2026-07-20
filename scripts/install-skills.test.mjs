import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { TARGET_RUNTIMES, classify, findStrays, linkSkill, listSourceSkills, planInstall } from "./install-skills.mjs";

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-skills-"));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function makeSource(root, names) {
  for (const name of names) {
    fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.writeFileSync(path.join(root, name, "SKILL.md"), `# ${name}\n`);
  }
  return root;
}

test("classify separates absent, copy, correct link, and wrong link", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha", "beta"]);
    const alpha = path.join(source, "alpha");
    const installRoot = path.join(dir, "install");
    fs.mkdirSync(installRoot, { recursive: true });

    assert.equal(classify(path.join(installRoot, "alpha"), alpha), "absent");

    const copy = path.join(installRoot, "copy");
    fs.mkdirSync(copy);
    fs.writeFileSync(path.join(copy, "SKILL.md"), "# alpha\n");
    assert.equal(classify(copy, alpha), "copy");

    const good = path.join(installRoot, "good");
    linkSkill(good, alpha);
    assert.equal(classify(good, alpha), "linked");

    // A link is only "linked" when it points at this skill's own source;
    // pointing at a sibling must not read as installed.
    const wrong = path.join(installRoot, "wrong");
    linkSkill(wrong, path.join(source, "beta"));
    assert.equal(classify(wrong, alpha), "relinked");
  } finally {
    cleanup();
  }
});

test("linkSkill replaces an existing real copy rather than nesting inside it", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha"]);
    const target = path.join(dir, "install", "alpha");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "stale.md"), "old\n");

    linkSkill(target, path.join(source, "alpha"));

    assert.equal(classify(target, path.join(source, "alpha")), "linked");
    assert.deepEqual(fs.readdirSync(target), ["SKILL.md"]);
    assert.equal(fs.existsSync(path.join(target, "alpha")), false, "must replace, not nest");
  } finally {
    cleanup();
  }
});

test("planInstall covers every target runtime that exists and skips ones that do not", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha", "beta"]);
    const home = path.join(dir, "home");
    // Only the first target runtime exists on this machine.
    fs.mkdirSync(path.join(home, TARGET_RUNTIMES[0], "skills"), { recursive: true });

    const plan = planInstall(["alpha", "beta"], home, source);

    assert.equal(plan.length, 2, "absent runtime must not be created");
    assert.deepEqual([...new Set(plan.map((p) => p.runtime))], [TARGET_RUNTIMES[0]]);
    assert.deepEqual(plan.map((p) => p.state), ["absent", "absent"]);
  } finally {
    cleanup();
  }
});

test("findStrays reports our skills outside target runtimes and ignores foreign ones", () => {
  const { dir, cleanup } = scratch();
  try {
    const home = path.join(dir, "home");
    const ours = ["alpha", "beta"];

    // A target runtime is never a stray, however many of our skills it holds.
    fs.mkdirSync(path.join(home, TARGET_RUNTIMES[0], "skills", "alpha"), { recursive: true });
    // A non-target runtime carrying one of ours is a stray...
    fs.mkdirSync(path.join(home, ".other", "skills", "beta"), { recursive: true });
    // ...but its own unrelated skills are none of our business.
    fs.mkdirSync(path.join(home, ".other", "skills", "someone-elses"), { recursive: true });
    // A non-runtime dotdir without a skills/ tree must not crash the scan.
    fs.mkdirSync(path.join(home, ".config"), { recursive: true });

    const strays = findStrays(ours, home);

    assert.deepEqual(
      strays.map((s) => `${s.skill} @ ${s.runtime}`),
      ["beta @ .other"],
    );
  } finally {
    cleanup();
  }
});

test("the repository's own skills all resolve as source directories", () => {
  const skills = listSourceSkills();
  assert.ok(skills.length > 0, "expected at least one source skill");
  assert.deepEqual([...skills].sort(), skills, "listSourceSkills must return a stable sorted list");
});
