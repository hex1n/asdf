import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyInstall,
  hookHandler,
  mergeStopHook,
  planInstall,
  writeJsonAtomic,
} from "./install-agent-tools.mjs";

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-agent-tools-"));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("hook definitions are portable for Codex and Claude", () => {
  const codexWindows = hookHandler("codex", "win32");
  const codexLinux = hookHandler("codex", "linux");
  const claude = hookHandler("claude", "win32");

  assert.match(codexWindows.commandWindows, /Join-Path \$HOME/);
  assert.equal(codexLinux.commandWindows, undefined);
  assert.match(codexLinux.command, /\$HOME\/\.agents\/tools\/java-formatter/);
  assert.equal(claude.commandWindows, undefined);
});

test("hook merge preserves unrelated settings and is idempotent", () => {
  const original = {
    model: "kept",
    hooks: {
      Stop: [
        { matcher: "kept", hooks: [{ type: "command", command: "node keep.mjs" }] },
        { hooks: [{ type: "command", command: 'node "$HOME/.agents/tools/java-formatter/run-agent-hook.mjs"' }] },
      ],
      SessionStart: [{ hooks: [{ type: "command", command: "node start.mjs" }] }],
    },
  };
  const handler = hookHandler("claude", "linux");
  const once = mergeStopHook(original, handler);
  const twice = mergeStopHook(once, handler);

  assert.equal(once.model, "kept");
  assert.deepEqual(once.hooks.SessionStart, original.hooks.SessionStart);
  assert.equal(once.hooks.Stop.length, 2);
  assert.equal(once.hooks.Stop[0].hooks[0].command, "node keep.mjs");
  assert.deepEqual(twice, once);
});

test("atomic JSON write preserves the original when replacement fails", () => {
  const { dir, cleanup } = scratch();
  try {
    const file = path.join(dir, "settings.json");
    fs.writeFileSync(file, "{\"kept\":true}\n", "utf8");
    let renameCount = 0;
    const flaky = {
      ...fs,
      renameSync: (from, to) => {
        renameCount += 1;
        if (renameCount === 2) throw new Error("simulated replacement failure");
        fs.renameSync(from, to);
      },
    };
    assert.throws(() => writeJsonAtomic(file, { changed: true }, flaky), /simulated/);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { kept: true });
  } finally {
    cleanup();
  }
});

test("temp-home install links formatter and rationale skill and merges both runtime configs", () => {
  const { dir, cleanup } = scratch();
  try {
    const home = path.join(dir, "home");
    const source = path.join(dir, "source");
    fs.mkdirSync(path.join(source, "tools", "java-formatter"), { recursive: true });
    fs.mkdirSync(path.join(source, "skills", "rationale-records", "scripts"), { recursive: true });
    fs.writeFileSync(path.join(source, "tools", "java-formatter", "run-agent-hook.mjs"), "", "utf8");
    fs.writeFileSync(path.join(source, "skills", "rationale-records", "scripts", "check-anchors.mjs"), "", "utf8");
    fs.mkdirSync(path.join(home, ".codex"), { recursive: true });
    fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(home, ".codex", "hooks.json"), "{\"description\":\"kept\"}\n", "utf8");
    fs.writeFileSync(path.join(home, ".claude", "settings.json"), "{\"model\":\"kept\"}\n", "utf8");

    const plan = planInstall(home, source, "win32");
    applyInstall(plan);
    const second = planInstall(home, source, "win32");

    assert.equal(second.assets.every((asset) => asset.linkState === "linked"), true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(home, ".codex", "hooks.json"), "utf8")).description, "kept");
    assert.equal(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")).model, "kept");
    assert.equal(second.configs.every((config) => JSON.stringify(config.before) === JSON.stringify(config.after)), true);
  } finally {
    cleanup();
  }
});
