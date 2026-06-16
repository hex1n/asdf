import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const bridgeRoot = path.dirname(testDir);
const companion = path.join(bridgeRoot, "scripts", "bridge-companion.mjs");
const companionImpl = path.join(bridgeRoot, "plugins", "cx", "scripts", "bridge-companion.mjs");
const catalog = path.join(bridgeRoot, "plugins", "cx", "scripts", "bridge-catalog.json");
const fakeCodex = path.join(testDir, "fixtures", "fake-codex.mjs");
const fakeClaude = path.join(testDir, "fixtures", "fake-claude.mjs");

test("foreground cx work writes state, result, log, prompt, and session registry", async (t) => {
  const ctx = await makeContext(t);
  const result = runCompanion(ctx, [
    "cx",
    "work",
    "--foreground",
    "--model",
    "codex-test-model",
    "--effort",
    "low",
    "--",
    "change exactly one file",
  ], {
    ANTHROPIC_API_KEY: "must-not-leak",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake codex work result/);
  assert.match(result.stdout, /bridge: job job_/);
  assert.equal(await pathExists(path.join(ctx.cwd, ".cx-result-ignored.md")), false);

  const jobs = await readJobs(ctx.stateRoot);
  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.equal(job.action, "work");
  assert.equal(job.mode, "work");
  assert.equal(job.status, "completed");
  assert.equal(job.model, "codex-test-model");
  assert.equal(job.effort, "low");
  assert.equal(job.background, false);
  assert.equal(job.sessionId, "11111111-1111-4111-8111-111111111111");

  const prompt = await fs.readFile(job.promptFile, "utf8");
  assert.match(prompt, /change exactly one file/);
  assert.match(prompt, /<completeness_contract>/);

  const lastSession = await readJson(
    path.join(ctx.stateRoot, "sessions", job.repoHash, "cx-last-session.json"),
  );
  assert.equal(lastSession.sessionId, "11111111-1111-4111-8111-111111111111");
  assert.equal(lastSession.source, "work");
});

test("args-file cx work preserves request text verbatim after routing flags", async (t) => {
  const ctx = await makeContext(t);
  const request = [
    'change JSON {"a": "b c"}',
    'keep quoted text: "hello world"',
    String.raw`keep backslashes: C:\tmp\bridge\file.txt`,
    "keep markdown:",
    "```js",
    "console.log('x y');",
    "```",
  ].join("\n");
  const argsFile = await writeArgsFile(ctx, `--foreground --model codex-test-model --effort low --\n${request}`);

  const result = runCompanion(ctx, ["cx", "work", "--args-file", argsFile]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake codex work result/);
  assert.match(result.stdout, /"codex-test-model"/);
  assert.match(result.stdout, /model_reasoning_effort=low/);

  const jobs = await readJobs(ctx.stateRoot);
  assert.equal(jobs.length, 1);
  const prompt = await fs.readFile(jobs[0].promptFile, "utf8");
  assert.ok(prompt.includes(request), prompt);
});

test("args-file cx work treats routing-looking text inside request as request", async (t) => {
  const ctx = await makeContext(t);
  const request = 'write docs that mention --model "literal value" and --effort high';
  const argsFile = await writeArgsFile(ctx, `--foreground ${request}`);

  const result = runCompanion(ctx, ["cx", "work", "--args-file", argsFile]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--model "literal value"/);
  assert.doesNotMatch(result.stdout, /model_reasoning_effort=high/);
  assert.doesNotMatch(result.stdout, /"-m"/);
});

test("cx work accepts wrapper-fixed mode before args-file", async (t) => {
  const ctx = await makeContext(t);
  const argsFile = await writeArgsFile(ctx, '--foreground --model codex-test-model -- write with "quoted text"');

  const result = runCompanion(ctx, [
    "cx",
    "work",
    "--mode",
    "work",
    "--args-file",
    argsFile,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake codex work result/);
  assert.match(result.stdout, /"--sandbox","workspace-write"/);
  assert.match(result.stdout, /"codex-test-model"/);

  const jobs = await readJobs(ctx.stateRoot);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].mode, "work");
});

test("session-producing profile must be declared in sessionSources", async (t) => {
  const ctx = await makeContext(t);
  const toolDir = path.join(ctx.cwd, "tool");
  await fs.mkdir(toolDir, { recursive: true });
  const script = path.join(toolDir, "bridge-companion.mjs");
  const catalogFile = path.join(toolDir, "bridge-catalog.json");
  await fs.copyFile(companionImpl, script);
  const catalogJson = JSON.parse(await fs.readFile(catalog, "utf8"));
  catalogJson.sessionSources.cx = [];
  await fs.writeFile(catalogFile, `${JSON.stringify(catalogJson, null, 2)}\n`, "utf8");

  const result = runCompanionScript(ctx, script, [
    "cx",
    "work",
    "--foreground",
    "--",
    "should fail before creating a job",
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be listed in sessionSources\.cx/);
});

test("cx work defaults to background and result can be fetched later", async (t) => {
  const ctx = await makeContext(t);
  const start = runCompanion(ctx, ["cx", "work", "--", "background task"]);

  assert.equal(start.status, 0, start.stderr);
  assert.match(start.stdout, /Codex work started: job_/);
  const jobId = parseJobId(start.stdout);

  const completed = await waitForJob(ctx, jobId, "completed");
  assert.equal(completed.status, "completed");

  const status = runCompanion(ctx, ["cx", "status", jobId]);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, new RegExp(`id: ${jobId}`));
  assert.match(status.stdout, /status: completed/);

  const result = runCompanion(ctx, ["cx", "result", jobId]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake codex work result/);
  assert.match(result.stdout, /background task/);
});

test("failed worker records failed state and exposes log tail", async (t) => {
  const ctx = await makeContext(t);
  const result = runCompanion(ctx, ["cx", "work", "--foreground", "--", "fail task"], {
    FAKE_CODEX_FAIL: "1",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /fake-codex: requested failure/);

  const jobs = await readJobs(ctx.stateRoot);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "failed");
  assert.equal(jobs[0].exitCode, 31);

  const fetched = runCompanion(ctx, ["cx", "result", jobs[0].id]);
  assert.equal(fetched.status, 0, fetched.stderr);
  assert.match(fetched.stdout, /status: failed/);
  assert.match(fetched.stdout, /fake-codex: requested failure/);
});

test("cx cancel only cancels a bridge-owned running job", async (t) => {
  const ctx = await makeContext(t);
  const start = runCompanion(ctx, ["cx", "work", "--", "long task"], {
    FAKE_CODEX_DELAY_MS: "5000",
  });
  assert.equal(start.status, 0, start.stderr);
  const jobId = parseJobId(start.stdout);

  await waitForJob(ctx, jobId, "running");
  const cancelled = runCompanion(ctx, ["cx", "cancel", jobId]);
  assert.equal(cancelled.status, 0, cancelled.stderr);
  assert.match(cancelled.stdout, new RegExp(`cancelled: ${jobId}`));

  const finalJob = await waitForJob(ctx, jobId, "cancelled");
  assert.equal(finalJob.status, "cancelled");

  const result = runCompanion(ctx, ["cx", "result", jobId]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /status: cancelled/);
});

test("cx resume uses bridge session registry and never passes --last", async (t) => {
  const ctx = await makeContext(t);
  const work = runCompanion(ctx, ["cx", "work", "--foreground", "--", "seed session"]);
  assert.equal(work.status, 0, work.stderr);

  const resume = runCompanion(ctx, [
    "cx",
    "resume",
    "--foreground",
    "--",
    "continue the previous work",
  ]);
  assert.equal(resume.status, 0, resume.stderr);
  assert.match(resume.stdout, /fake codex resume result/);
  assert.match(resume.stdout, /session: 11111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(resume.stdout, /--last/);

  const jobs = await readJobs(ctx.stateRoot);
  const resumeJob = jobs.find((job) => job.action === "resume");
  assert.ok(resumeJob);
  assert.equal(resumeJob.resumeFrom, "11111111-1111-4111-8111-111111111111");
  assert.equal(resumeJob.mode, "work");
  assert.equal(resumeJob.status, "completed");
});

test("foreground claude work writes result, cost footer, and Claude session registry", async (t) => {
  const ctx = await makeContext(t);
  const result = runCompanion(ctx, [
    "claude",
    "work",
    "--foreground",
    "--model",
    "claude-sonnet-4-5",
    "--",
    "change through Claude",
  ], {
    ANTHROPIC_API_KEY: "must-not-leak",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake claude work result/);
  assert.match(result.stdout, /cost: \$0\.1234 \| session: 22222222-2222-4222-8222-222222222222/);
  assert.match(result.stdout, /"--permission-mode","acceptEdits"/);
  assert.match(result.stdout, /"--model","claude-sonnet-4-5"/);

  const jobs = await readJobs(ctx.stateRoot);
  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.equal(job.side, "claude");
  assert.equal(job.action, "work");
  assert.equal(job.mode, "work");
  assert.equal(job.status, "completed");
  assert.equal(job.sessionId, "22222222-2222-4222-8222-222222222222");

  const lastSession = await readJson(
    path.join(ctx.stateRoot, "sessions", job.repoHash, "claude-last-session.json"),
  );
  assert.equal(lastSession.sessionId, "22222222-2222-4222-8222-222222222222");
  assert.equal(lastSession.source, "work");
});

test("claude work accepts wrapper-fixed mode before args-file", async (t) => {
  const ctx = await makeContext(t);
  const argsFile = await writeArgsFile(ctx, '--foreground -- read-only follow-up with "quoted text"');

  const result = runCompanion(ctx, [
    "claude",
    "work",
    "--mode",
    "consult",
    "--args-file",
    argsFile,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake claude work result/);
  assert.match(result.stdout, /"--allowedTools","Read,Grep,Glob"/);
  assert.doesNotMatch(result.stdout, /acceptEdits/);

  const jobs = await readJobs(ctx.stateRoot);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].mode, "consult");

  const lastSession = await readJson(
    path.join(ctx.stateRoot, "sessions", jobs[0].repoHash, "claude-last-session.json"),
  );
  assert.equal(lastSession.source, "consult");
});

test("claude work defaults to background and result can be fetched later", async (t) => {
  const ctx = await makeContext(t);
  const start = runCompanion(ctx, ["claude", "work", "--", "background Claude task"]);

  assert.equal(start.status, 0, start.stderr);
  assert.match(start.stdout, /Claude Code work started: job_/);
  assert.match(start.stdout, /status: \/claude-status job_/);
  const jobId = parseJobId(start.stdout);

  const completed = await waitForJob(ctx, jobId, "completed", "claude");
  assert.equal(completed.status, "completed");

  const status = runCompanion(ctx, ["claude", "status", jobId]);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, new RegExp(`id: ${jobId}`));
  assert.match(status.stdout, /status: completed/);
  assert.match(status.stdout, new RegExp(`next: /claude-result ${jobId}`));

  const result = runCompanion(ctx, ["claude", "result", jobId]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fake claude work result/);
  assert.match(result.stdout, /background Claude task/);
});

test("claude resume uses bridge registry and does not use --continue", async (t) => {
  const ctx = await makeContext(t);
  const work = runCompanion(ctx, ["claude", "work", "--foreground", "--", "seed Claude session"]);
  assert.equal(work.status, 0, work.stderr);

  const resume = runCompanion(ctx, [
    "claude",
    "resume",
    "--foreground",
    "--",
    "continue through Claude",
  ]);

  assert.equal(resume.status, 0, resume.stderr);
  assert.match(resume.stdout, /fake claude resume result/);
  assert.match(resume.stdout, /session: 22222222-2222-4222-8222-222222222222/);
  assert.match(resume.stdout, /"--resume","22222222-2222-4222-8222-222222222222"/);
  assert.doesNotMatch(resume.stdout, /--continue/);

  const jobs = await readJobs(ctx.stateRoot);
  const resumeJob = jobs.find((job) => job.side === "claude" && job.action === "resume");
  assert.ok(resumeJob);
  assert.equal(resumeJob.resumeFrom, "22222222-2222-4222-8222-222222222222");
  assert.equal(resumeJob.mode, "work");
  assert.equal(resumeJob.status, "completed");
});

test("claude register-session lets explicit resume recover consult permissions", async (t) => {
  const ctx = await makeContext(t);
  const sessionId = "33333333-3333-4333-8333-333333333333";

  const registered = runCompanion(ctx, [
    "claude",
    "register-session",
    "--session",
    sessionId,
    "--source",
    "consult",
  ]);
  assert.equal(registered.status, 0, registered.stderr);
  assert.match(registered.stdout, new RegExp(sessionId));

  const resume = runCompanion(ctx, [
    "claude",
    "resume",
    "--foreground",
    "--session",
    sessionId,
    "--",
    "continue read-only consult",
  ]);

  assert.equal(resume.status, 0, resume.stderr);
  assert.match(resume.stdout, /fake claude resume result/);
  assert.match(resume.stdout, /"--allowedTools","Read,Grep,Glob"/);
  assert.doesNotMatch(resume.stdout, /acceptEdits/);
});

async function makeContext(t) {
  await fs.chmod(fakeCodex, 0o755);
  await fs.chmod(fakeClaude, 0o755);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ccb-test-"));
  const cwd = path.join(root, "repo");
  const stateRoot = path.join(root, "state");
  await fs.mkdir(cwd, { recursive: true });
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  return { cwd, stateRoot };
}

async function writeArgsFile(ctx, text) {
  const file = path.join(ctx.cwd, `args-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  await fs.writeFile(file, text, "utf8");
  return file;
}

function runCompanion(ctx, args, env = {}) {
  return runCompanionScript(ctx, companion, args, env);
}

function runCompanionScript(ctx, script, args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ctx.cwd,
    env: {
      ...process.env,
      CLAUDE_CODEX_BRIDGE_STATE_HOME: ctx.stateRoot,
      CLAUDE_CODEX_BRIDGE_CODEX_BIN: fakeCodex,
      CLAUDE_CODEX_BRIDGE_CLAUDE_BIN: fakeClaude,
      ...env,
    },
    encoding: "utf8",
    timeout: 30000,
  });
}

async function readJobs(stateRoot) {
  const jobsRoot = path.join(stateRoot, "jobs");
  const repoHashes = await fs.readdir(jobsRoot);
  const jobs = [];
  for (const repoHash of repoHashes) {
    const repoDir = path.join(jobsRoot, repoHash);
    const files = await fs.readdir(repoDir);
    for (const file of files) {
      if (!file.endsWith(".json") || file === "index.json") {
        continue;
      }
      jobs.push(await readJson(path.join(repoDir, file)));
    }
  }
  jobs.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return jobs;
}

async function waitForJob(ctx, jobId, expectedStatus, side = "cx") {
  const deadline = Date.now() + 30000;
  let last = null;
  while (Date.now() < deadline) {
    const status = runCompanion(ctx, [side, "status", jobId, "--json"]);
    if (status.status === 0) {
      last = JSON.parse(status.stdout);
      if (last.status === expectedStatus) {
        return last;
      }
      if (expectedStatus === "completed" && last.status === "failed") {
        throw new Error(`job failed: ${status.stdout}`);
      }
    }
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${jobId} to become ${expectedStatus}; last=${JSON.stringify(last)}`);
}

function parseJobId(output) {
  const match = output.match(/job_\d{8}_\d{6}_[0-9a-f]{6}/);
  assert.ok(match, `missing job id in output: ${output}`);
  return match[0];
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function pathExists(file) {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
