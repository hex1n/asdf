#!/usr/bin/env node
// Deterministic git stand-in for review fail-closed tests. Wired through
// CLAUDE_CODEX_BRIDGE_GIT_BIN. Behaviour is driven entirely by env so a test can
// force a specific subcommand to fail, hang, or emit oversized output without
// depending on real-git timing.
//
//   FAKE_GIT_FAIL          comma list of subcommands to fail (diff,show,status,ls-files,rev-parse)
//   FAKE_GIT_DELAY_MS      sleep before responding (drives spawnSync timeouts)
//   FAKE_GIT_DIFF_BYTES    pad diff output to at least this many bytes
//   FAKE_GIT_TRACKED       newline-or-comma list returned by `ls-files`
//   FAKE_GIT_UNTRACKED     newline-or-comma list returned by `ls-files --others`

const args = process.argv.slice(2);
const subcommand = args[0] || "";
const failing = new Set(
  String(process.env.FAKE_GIT_FAIL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

const delayMs = Number(process.env.FAKE_GIT_DELAY_MS || 0);
if (delayMs > 0) {
  await sleep(delayMs);
}

if (failing.has(subcommand)) {
  process.stderr.write(`fake-git: forced failure for ${subcommand}\n`);
  process.exit(128);
}

if (subcommand === "rev-parse") {
  // Mirrors `rev-parse --verify --quiet`: silent non-zero on a bad ref.
  process.stdout.write("0123456789abcdef0123456789abcdef01234567\n");
  process.exit(0);
}

if (subcommand === "diff") {
  if (args.includes("--stat")) {
    process.stdout.write(" fake.txt | 2 +-\n 1 file changed\n");
    process.exit(0);
  }
  let body = "diff --git a/fake.txt b/fake.txt\n--- a/fake.txt\n+++ b/fake.txt\n@@ -1 +1 @@\n-old line\n+new line FAKE_DIFF_MARKER\n";
  const targetBytes = Number(process.env.FAKE_GIT_DIFF_BYTES || 0);
  if (targetBytes > body.length) {
    body += `+${"x".repeat(targetBytes - body.length)}\n`;
  }
  process.stdout.write(body);
  process.exit(0);
}

if (subcommand === "show") {
  process.stdout.write("commit 0123456789\nfake show body FAKE_SHOW_MARKER\n");
  process.exit(0);
}

if (subcommand === "status") {
  process.stdout.write("");
  process.exit(0);
}

if (subcommand === "ls-files") {
  const list = args.includes("--others")
    ? process.env.FAKE_GIT_UNTRACKED
    : process.env.FAKE_GIT_TRACKED;
  process.stdout.write(splitList(list).join("\n") + (list ? "\n" : ""));
  process.exit(0);
}

process.exit(0);

function splitList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
