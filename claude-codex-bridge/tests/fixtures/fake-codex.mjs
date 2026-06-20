#!/usr/bin/env node
import fs from "node:fs/promises";

const args = process.argv.slice(2);

if (args.includes("--last")) {
  console.error("fake-codex: --last is forbidden");
  process.exit(70);
}

if (process.env.ANTHROPIC_API_KEY) {
  console.error("fake-codex: ANTHROPIC_API_KEY leaked into child process");
  process.exit(71);
}

const outputPath = valueAfter(args, "-o");
if (!outputPath) {
  console.error("fake-codex: missing -o");
  process.exit(72);
}

const input = await readStdin();
const delayMs = Number(process.env.FAKE_CODEX_DELAY_MS || 0);
if (delayMs > 0) {
  await sleep(delayMs);
}

if (process.env.FAKE_CODEX_FAIL === "1") {
  console.error("fake-codex: requested failure");
  process.exit(31);
}

if (process.env.FAKE_CODEX_EMPTY !== "1") {
  const sessionId =
    process.env.FAKE_CODEX_SESSION_ID || "11111111-1111-4111-8111-111111111111";
  const mode = args[0] === "exec" && args[1] === "resume" ? "resume" : "work";
  const sessionLine = JSON.stringify({ type: "session", session_id: sessionId });
  process.stdout.write(`${sessionLine}\n`);
  await fs.writeFile(outputPath, process.env.FAKE_CODEX_RESULT || renderResult(mode, args, input), "utf8");
}

process.exit(0);

function valueAfter(values, flag) {
  const index = values.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return values[index + 1] || null;
}

function renderResult(mode, values, input) {
  if (mode === "resume") {
    return [
      "fake codex resume result",
      `session: ${values[2]}`,
      `args: ${JSON.stringify(values)}`,
      "prompt:",
      input,
    ].join("\n");
  }

  return [
    "fake codex work result",
    `args: ${JSON.stringify(values)}`,
    "prompt:",
    input,
  ].join("\n");
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
