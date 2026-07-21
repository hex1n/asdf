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

test("a failed link creation leaves the existing install in place", () => {
  const { dir, cleanup } = scratch();
  try {
    const target = path.join(dir, "install", "alpha");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "stale.md"), "old\n");

    // A null byte makes symlinkSync reject the target before anything is
    // deleted, standing in for Windows permission or path-locking failures.
    assert.throws(() => linkSkill(target, "bad\0target"));

    assert.deepEqual(fs.readdirSync(path.dirname(target)), ["alpha"], "no staged leftovers");
    assert.equal(fs.readFileSync(path.join(target, "stale.md"), "utf8"), "old\n", "old install must survive");
  } finally {
    cleanup();
  }
});

test("a rename failure after the old install is removed keeps the link recoverable", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha"]);
    const alpha = path.join(source, "alpha");
    const target = path.join(dir, "install", "alpha");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "stale.md"), "old\n");

    // One transient rename failure: the retry must still land the link.
    let failures = 1;
    const flaky = {
      ...fs,
      renameSync: (from, to) => {
        if (failures-- > 0) throw new Error("EPERM: simulated lock");
        fs.renameSync(from, to);
      },
    };
    linkSkill(target, alpha, flaky);
    assert.equal(classify(target, alpha), "linked");

    // Rename keeps failing after the old install is gone: the staged link
    // must survive on disk so the skill is recoverable, not silently absent.
    const broken = { ...fs, renameSync: () => { throw new Error("EPERM: simulated lock"); } };
    assert.throws(() => linkSkill(target, alpha, broken), /staged link kept/);
    assert.equal(classify(`${target}.staged-link`, alpha), "linked", "staged link must survive");
  } finally {
    cleanup();
  }
});

test("a removal that fails halfway through the old install keeps the staged link as recovery", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha"]);
    const alpha = path.join(source, "alpha");
    const target = path.join(dir, "install", "alpha");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "stale.md"), "old\n");

    // Removing the old install deletes part of it, then fails — the staged
    // link must survive as the recovery path, not be discarded as if the old
    // install were still intact.
    const partial = {
      ...fs,
      rmSync: (p, opts) => {
        if (p === target) {
          fs.rmSync(path.join(target, "stale.md"), { force: true });
          throw new Error("EBUSY: simulated lock");
        }
        fs.rmSync(p, opts);
      },
    };
    assert.throws(() => linkSkill(target, alpha, partial), /staged link kept/);
    assert.equal(classify(`${target}.staged-link`, alpha), "linked", "staged link must survive");
  } finally {
    cleanup();
  }
});

test("an occupied staged path that is not ours stops the install without deleting it", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha"]);
    const alpha = path.join(source, "alpha");
    const target = path.join(dir, "install", "alpha");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "stale.md"), "old\n");
    // A real directory owned by the user happens to sit on the staged path.
    const occupied = `${target}.staged-link`;
    fs.mkdirSync(occupied, { recursive: true });
    fs.writeFileSync(path.join(occupied, "data.md"), "user data\n");

    assert.throws(() => linkSkill(target, alpha), /not this skill's staged link/);

    assert.equal(fs.readFileSync(path.join(occupied, "data.md"), "utf8"), "user data\n", "must not delete");
    assert.equal(fs.readFileSync(path.join(target, "stale.md"), "utf8"), "old\n", "old install untouched");
  } finally {
    cleanup();
  }
});

test("a leftover staged link from a prior failed run does not block the next install", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha"]);
    const alpha = path.join(source, "alpha");
    const target = path.join(dir, "install", "alpha");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "stale.md"), "old\n");

    const broken = { ...fs, renameSync: () => { throw new Error("EPERM: simulated lock"); } };
    assert.throws(() => linkSkill(target, alpha, broken), /staged link kept/);

    linkSkill(target, alpha);

    assert.equal(classify(target, alpha), "linked");
    assert.equal(fs.existsSync(`${target}.staged-link`), false, "leftover staged link cleaned up");
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

test("only a link back at our source is prunable; a same-name local override is not", () => {
  const { dir, cleanup } = scratch();
  try {
    const source = makeSource(path.join(dir, "skills"), ["alpha", "beta"]);
    const home = path.join(dir, "home");
    // A link resolving back at our source under a non-target runtime: ours.
    linkSkill(path.join(home, ".other", "skills", "alpha"), path.join(source, "alpha"));
    // A same-name real directory: a user-owned local override, never ours.
    fs.mkdirSync(path.join(home, ".codex", "skills", "beta"), { recursive: true });
    fs.writeFileSync(path.join(home, ".codex", "skills", "beta", "SKILL.md"), "# local override\n");

    const strays = findStrays(["alpha", "beta"], home, source);

    assert.deepEqual(
      strays.map((s) => `${s.skill} @ ${s.runtime}: ${s.ours ? "ours" : "kept"}`),
      ["beta @ .codex: kept", "alpha @ .other: ours"],
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
