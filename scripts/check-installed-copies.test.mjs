import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareSkillTree, discoverRuntimes, scanSkills, summarize } from "./check-installed-copies.mjs";

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "fake-home-"));
  const skillsRoot = path.join(home, "repo", "skills");
  for (const name of ["alpha-skill", "beta-skill"]) {
    fs.mkdirSync(path.join(skillsRoot, name), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, name, "SKILL.md"), `${name}\n`);
  }
  const install = (runtime, skills) => {
    for (const name of skills) {
      fs.mkdirSync(path.join(home, runtime, "skills", name), { recursive: true });
      fs.writeFileSync(path.join(home, runtime, "skills", name, "SKILL.md"), `${name}\n`);
    }
  };
  return { home, skillsRoot, install };
}

function tempTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "installed-copies-"));
  const source = path.join(root, "skills", "demo-skill");
  const installed = path.join(root, "runtime", "skills", "demo-skill");
  fs.mkdirSync(path.join(source, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(installed, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(source, "SKILL.md"), "body\n");
  fs.writeFileSync(path.join(source, "scripts", "helper.mjs"), "export const x = 1;\n");
  fs.copyFileSync(path.join(source, "SKILL.md"), path.join(installed, "SKILL.md"));
  fs.copyFileSync(path.join(source, "scripts", "helper.mjs"), path.join(installed, "scripts", "helper.mjs"));
  return { root, source, installed, skillsRoot: path.join(root, "skills"), runtimeSkills: path.join(root, "runtime", "skills") };
}

test("byte-identical copies report no drift", () => {
  const { source, installed } = tempTree();
  assert.deepEqual(compareSkillTree(source, installed), { installed: true, drift: [], missing: [], extra: [] });
});

test("a stale copy is reported as drift, not as clean", () => {
  const { source, installed } = tempTree();
  fs.writeFileSync(path.join(installed, "SKILL.md"), "older revision\n");
  const result = compareSkillTree(source, installed);
  assert.deepEqual(result.drift, ["SKILL.md"]);
  assert.equal(summarize([{ skill: "demo", runtime: "rt", ...result }]).pass, false);
});

test("drift is detected in nested script files, not only top-level markdown", () => {
  const { source, installed } = tempTree();
  fs.writeFileSync(path.join(installed, "scripts", "helper.mjs"), "export const x = 2;\n");
  assert.deepEqual(compareSkillTree(source, installed).drift, ["scripts/helper.mjs"]);
});

test("a whitespace-only difference still fails byte-identity", () => {
  const { source, installed } = tempTree();
  fs.writeFileSync(path.join(installed, "SKILL.md"), "body \n");
  assert.deepEqual(compareSkillTree(source, installed).drift, ["SKILL.md"]);
});

test("a missing file in the installed copy is reported", () => {
  const { source, installed } = tempTree();
  fs.rmSync(path.join(installed, "scripts", "helper.mjs"));
  const result = compareSkillTree(source, installed);
  assert.deepEqual(result.missing, ["scripts/helper.mjs"]);
  assert.deepEqual(result.drift, []);
});

test("an extra file in the installed copy is reported and fails the summary", () => {
  const { source, installed } = tempTree();
  fs.writeFileSync(path.join(installed, "LOCAL.md"), "personal divergence\n");
  const result = compareSkillTree(source, installed);
  assert.deepEqual(result.extra, ["LOCAL.md"]);
  assert.equal(summarize([{ skill: "demo", runtime: "rt", ...result }]).pass, false);
});

test("an uninstalled skill is absent, not a drift failure", () => {
  const { source, root } = tempTree();
  const result = compareSkillTree(source, path.join(root, "runtime", "skills", "not-there"));
  assert.equal(result.installed, false);
  const summary = summarize([{ skill: "demo", runtime: "rt", ...result }]);
  assert.equal(summary.pass, true);
  assert.equal(summary.absent.length, 1);
});

test("discovery finds every runtime carrying our skills, not a hard-coded pair", () => {
  const { home, skillsRoot, install } = fakeHome();
  install(".claude", ["alpha-skill", "beta-skill"]);
  install(".codex", ["alpha-skill", "beta-skill"]);
  install(".agents", ["alpha-skill", "beta-skill"]);
  const found = discoverRuntimes([], skillsRoot, home);
  assert.deepEqual(
    found.map((r) => r.label),
    [".agents", ".claude", ".codex"],
  );
  assert.deepEqual(
    found.map((r) => r.installedCount),
    [2, 2, 2],
  );
});

test("a runtime carrying only some of our skills is still discovered with its count", () => {
  const { home, skillsRoot, install } = fakeHome();
  install(".claude", ["alpha-skill", "beta-skill"]);
  install(".factory", ["alpha-skill"]);
  const found = discoverRuntimes([], skillsRoot, home);
  assert.deepEqual(
    found.map((r) => `${r.label}:${r.installedCount}`),
    [".claude:2", ".factory:1"],
  );
});

test("directories with no skill of ours, and non-dot directories, are not runtimes", () => {
  const { home, skillsRoot, install } = fakeHome();
  install(".claude", ["alpha-skill"]);
  fs.mkdirSync(path.join(home, ".unrelated", "skills", "someone-elses-skill"), { recursive: true });
  fs.mkdirSync(path.join(home, "notdot", "skills", "alpha-skill"), { recursive: true });
  assert.deepEqual(
    discoverRuntimes([], skillsRoot, home).map((r) => r.label),
    [".claude"],
  );
});

test("a skill symlinked back at the source counts as installed and compares clean", () => {
  const { home, skillsRoot, install } = fakeHome();
  install(".claude", ["alpha-skill"]);
  const linkDir = path.join(home, ".claude", "skills", "beta-skill");
  try {
    fs.symlinkSync(path.join(skillsRoot, "beta-skill"), linkDir, "junction");
  } catch {
    return; // symlink creation can be unprivileged-blocked; the real repo covers this path
  }
  const found = discoverRuntimes([], skillsRoot, home);
  assert.equal(found[0].installedCount, 2, "a symlinked skill must not be undercounted");
  assert.deepEqual(compareSkillTree(path.join(skillsRoot, "beta-skill"), linkDir), {
    installed: true,
    drift: [],
    missing: [],
    extra: [],
  });
});

test("a backup directory is discovered but flagged so --fix will not overwrite it", () => {
  const { home, skillsRoot, install } = fakeHome();
  install(".claude", ["alpha-skill"]);
  install(".agents-backup-before-update-20260601", ["alpha-skill"]);
  const found = discoverRuntimes([], skillsRoot, home);
  assert.deepEqual(
    found.map((r) => `${r.label}:${r.looksLikeBackup}`),
    [".agents-backup-before-update-20260601:true", ".claude:false"],
  );
});

test("a same-name entry outside target runtimes that is not our link is an override, not drift", () => {
  const { skillsRoot, root } = tempTree();
  // A stale same-name real directory under a non-target runtime: possibly a
  // user-owned local override, so it must not fail the gate or be fixable.
  const overrideDir = path.join(root, "codex-runtime", "skills", "demo-skill");
  fs.mkdirSync(overrideDir, { recursive: true });
  fs.writeFileSync(path.join(overrideDir, "SKILL.md"), "diverged on purpose\n");

  const results = scanSkills(skillsRoot, [{ label: ".codex", skillsDir: path.dirname(overrideDir) }]);
  const summary = summarize(results);

  assert.equal(results[0].override, true);
  assert.equal(summary.pass, true, "an override must not fail the gate");
  assert.deepEqual(summary.dirty, []);
  assert.equal(summary.overrides.length, 1);
});

test("inside target runtimes a stale real copy still fails the gate", () => {
  const { skillsRoot, root } = tempTree();
  const staleDir = path.join(root, "claude-runtime", "skills", "demo-skill");
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, "SKILL.md"), "older revision\n");

  const results = scanSkills(skillsRoot, [{ label: ".claude", skillsDir: path.dirname(staleDir) }]);
  const summary = summarize(results);

  assert.equal(results[0].override, false);
  assert.equal(summary.pass, false, "target runtimes stay hard-gated");
});

test("scanSkills walks every source skill against every runtime", () => {
  const { skillsRoot, runtimeSkills, root } = tempTree();
  fs.mkdirSync(path.join(skillsRoot, "second-skill"), { recursive: true });
  fs.writeFileSync(path.join(skillsRoot, "second-skill", "SKILL.md"), "second\n");
  const other = path.join(root, "runtime2", "skills");
  fs.mkdirSync(other, { recursive: true });
  const results = scanSkills(skillsRoot, [
    { label: "rt1", skillsDir: runtimeSkills },
    { label: "rt2", skillsDir: other },
  ]);
  assert.equal(results.length, 4);
  assert.deepEqual(
    results.map((r) => `${r.skill}@${r.runtime}:${r.installed}`).sort(),
    ["demo-skill@rt1:true", "demo-skill@rt2:false", "second-skill@rt1:false", "second-skill@rt2:false"],
  );
});
