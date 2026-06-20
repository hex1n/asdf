#!/usr/bin/env node
import fs from "node:fs/promises";

const args = process.argv.slice(2);

if (args.includes("--continue") || args.includes("--bare")) {
  console.error("fake-claude: forbidden resume or billing flag");
  process.exit(80);
}

if (process.env.ANTHROPIC_API_KEY) {
  console.error("fake-claude: ANTHROPIC_API_KEY leaked into child process");
  process.exit(81);
}

if (process.env.OPENAI_API_KEY) {
  console.error("fake-claude: OPENAI_API_KEY leaked into child process");
  process.exit(82);
}

const input = await readStdin();
const delayMs = Number(process.env.FAKE_CLAUDE_DELAY_MS || 0);
if (delayMs > 0) {
  await sleep(delayMs);
}

if (process.env.FAKE_CLAUDE_FAIL === "1") {
  console.error("fake-claude: requested failure");
  process.exit(41);
}

const sessionId =
  process.env.FAKE_CLAUDE_SESSION_ID || "22222222-2222-4222-8222-222222222222";
const resumeIndex = args.indexOf("--resume");
const mode = resumeIndex === -1 ? "work" : "resume";

const result = {
  result: renderResult(mode, args, input),
  session_id: sessionId,
  total_cost_usd: 0.1234,
  is_error: process.env.FAKE_CLAUDE_IS_ERROR === "1",
};

process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.is_error ? 0 : 0);

function renderResult(mode, values, input) {
  if (process.env.FAKE_CLAUDE_RESULT) {
    return process.env.FAKE_CLAUDE_RESULT;
  }

  if (mode === "resume") {
    return [
      "fake claude resume result",
      `session: ${values[values.indexOf("--resume") + 1]}`,
      `args: ${JSON.stringify(values)}`,
      "prompt:",
      input,
    ].join("\n");
  }

  return [
    "fake claude work result",
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
