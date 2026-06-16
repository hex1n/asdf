#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP_NAME = "claude-codex-bridge";
const SCHEMA_VERSION = 1;
const VALID_EFFORTS = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const scriptPath = fileURLToPath(import.meta.url);
const catalogPath = path.join(path.dirname(scriptPath), "bridge-catalog.json");
const BRIDGE_CATALOG = loadBridgeCatalog(catalogPath);
const PROFILES = BRIDGE_CATALOG.profiles;
const SESSION_SOURCES = BRIDGE_CATALOG.sessionSources;

function loadBridgeCatalog(file) {
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  if (catalog.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`unsupported bridge catalog schemaVersion: ${catalog.schemaVersion}`);
  }
  if (!catalog.profiles || typeof catalog.profiles !== "object") {
    throw new Error("bridge catalog must define profiles");
  }
  if (!catalog.sessionSources || typeof catalog.sessionSources !== "object") {
    throw new Error("bridge catalog must define sessionSources");
  }
  return catalog;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv.shift();

  try {
    if (!command) {
      throw new UsageError("usage: bridge-companion.mjs <cx|worker> ...");
    }

    if (command === "worker") {
      await workerMain(argv);
      return;
    }

    if (command !== "cx" && command !== "claude") {
      throw new UsageError(`unsupported side: ${command}`);
    }

    await sideMain(command, argv);
  } catch (error) {
    const exitCode = error instanceof UsageError ? 2 : 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`bridge error: ${message}`);
    process.exit(exitCode);
  }
}

class UsageError extends Error {}

async function sideMain(side, argv) {
  const action = argv.shift();
  if (!action) {
    throw new UsageError(
      `usage: bridge-companion.mjs ${side} <work|resume|status|result|cancel|register-session> ...`,
    );
  }

  if (action === "work" || action === "resume") {
    await runTask(side, action, argv);
    return;
  }

  if (action === "status") {
    await printStatus(side, argv);
    return;
  }

  if (action === "result") {
    await printResult(side, argv);
    return;
  }

  if (action === "cancel") {
    await cancelJob(side, argv);
    return;
  }

  if (action === "register-session") {
    await registerSessionCommand(side, argv);
    return;
  }

  throw new UsageError(`unsupported ${side} action: ${action}`);
}

async function runTask(side, action, argv) {
  const args = await parseTaskArgs(argv, {
    side,
    allowSession: action === "resume",
    allowMode: hasProfiles(side),
  });
  if (!args.request.trim()) {
    throw new UsageError(action === "resume" ? "missing follow-up instruction" : "missing work request");
  }

  const stateRoot = stateRootPath();
  const cwd = path.resolve(process.cwd());
  const repoHash = hashCwd(cwd);
  await ensureStateRoot(stateRoot);

  let resumeFrom = args.session;
  let mode = action === "work" ? (args.mode ?? defaultProfile(side)) : null;
  if (action === "resume") {
    let knownSession = null;
    if (!resumeFrom) {
      const last = await readLastSession(stateRoot, repoHash, side);
      resumeFrom = last?.sessionId ?? null;
      knownSession = last;
    } else if (side === "claude") {
      knownSession = await readSession(stateRoot, repoHash, side, resumeFrom);
    }
    if (!resumeFrom) {
      throw new UsageError(`no bridge-owned ${sideLabel(side)} session to resume; pass --session <session-id>`);
    }
    validateSessionId(resumeFrom);
    mode = knownSession?.source ?? args.mode ?? (side === "cx" ? defaultProfile(side) : null);
    if (!isProfile(side, mode)) {
      if (side === "claude") {
        throw new UsageError(
          `Claude resume needs session metadata or --mode ${profileList(side)} for an explicit session`,
        );
      }
      throw new UsageError(`invalid ${sideLabel(side)} mode: ${mode}`);
    }
  }
  requireSessionSource(side, mode);

  const job = await createJob({
    stateRoot,
    cwd,
    repoHash,
    side,
    action,
    request: args.request,
    model: args.model,
    effort: args.effort,
    background: !args.foreground,
    resumeFrom,
    mode,
  });

  if (job.background) {
    await startBackgroundWorker(stateRoot, job);
    printBackgroundStart(job);
    return;
  }

  const finished = await runWorkerForJob(stateRoot, job);
  await printForegroundResult(finished);
}

async function createJob({
  stateRoot,
  cwd,
  repoHash,
  side,
  action,
  request,
  model,
  effort,
  background,
  resumeFrom,
  mode,
}) {
  const id = makeJobId();
  const paths = pathsForJob(stateRoot, repoHash, id);
  await ensureRepoDirs(stateRoot, repoHash);

  const promptText = action === "work" ? buildWorkPrompt(request) : `${request}\n`;
  await fsp.writeFile(paths.promptFile, promptText, { mode: 0o600 });

  const now = new Date().toISOString();
  const job = {
    schemaVersion: SCHEMA_VERSION,
    id,
    repoHash,
    cwd,
    side,
    action,
    status: "created",
    createdAt: now,
    startedAt: null,
    completedAt: null,
    pid: null,
    childPid: null,
    sessionId: null,
    resumeFrom,
    mode,
    model,
    effort,
    background,
    promptFile: paths.promptFile,
    logFile: paths.logFile,
    resultFile: paths.resultFile,
    exitCode: null,
    errorSummary: null,
  };

  await writeJsonAtomic(paths.jobFile, job);
  await appendIndex(stateRoot, repoHash, job);
  return job;
}

function buildWorkPrompt(request) {
  return `<task>
${request}
Context: the working directory is the repository or project workspace to work in.
</task>
<completeness_contract>
Done means: the requested work is completed and the narrowest relevant validation available in this repository passes. For code changes, the project should still build. If validation cannot be run or does not apply, report exactly why.
</completeness_contract>
<verification_loop>
After making changes, inspect local project conventions to choose the narrowest relevant test/build/check command. Run it when applicable, resolve failures caused by your changes, and report the command and outcome.
</verification_loop>
<action_safety>
Stay narrow: change only what the work request requires. Do not do drive-by refactors, dependency bumps, generated-file churn, or unrelated formatting. If a risky or destructive step is required, stop and report instead.
</action_safety>
`;
}

async function startBackgroundWorker(stateRoot, job) {
  const worker = spawn(
    process.execPath,
    [
      scriptPath,
      "worker",
      job.id,
      "--state-root",
      stateRoot,
      "--repo-hash",
      job.repoHash,
    ],
    {
      cwd: job.cwd,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        CLAUDE_CODEX_BRIDGE_STATE_HOME: stateRoot,
      },
    },
  );

  worker.unref();
  await updateJob(stateRoot, job.repoHash, job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    pid: worker.pid ?? null,
  });
}

async function workerMain(argv) {
  const { jobId, stateRoot, repoHash } = parseWorkerArgs(argv);
  const effectiveStateRoot = stateRoot ?? stateRootPath();
  const located = await findJob(effectiveStateRoot, jobId, repoHash);
  if (!located) {
    throw new Error(`job not found: ${jobId}`);
  }
  await runWorkerForJob(effectiveStateRoot, located);
}

async function runWorkerForJob(stateRoot, job) {
  await ensureStateRoot(stateRoot);
  const startedAt = job.startedAt ?? new Date().toISOString();
  await updateJob(stateRoot, job.repoHash, job.id, {
    status: "running",
    startedAt,
    pid: process.pid,
    errorSummary: null,
  });

  await fsp.appendFile(
    job.logFile,
    `bridge: worker started ${new Date().toISOString()} pid=${process.pid}\n`,
  );

  const runResult = job.side === "claude" ? await runClaude(job, stateRoot) : await runCodex(job, stateRoot);
  const latest = await readJob(stateRoot, job.repoHash, job.id);
  const cancelling = latest.status === "cancelling" || latest.status === "cancelled";
  const completedAt = new Date().toISOString();

  if (cancelling) {
    await updateJob(stateRoot, job.repoHash, job.id, {
      status: "cancelled",
      completedAt,
      exitCode: runResult.exitCode,
      errorSummary: "cancelled by bridge",
    });
    return readJob(stateRoot, job.repoHash, job.id);
  }

  if (runResult.ok) {
    const sessionId = runResult.sessionId ?? (await parseSessionId(job.logFile));
    if (sessionId) {
      await registerSession(stateRoot, job.repoHash, job.side, sessionId, {
        source: sessionSourceFor(job),
        cwd: job.cwd,
        jobId: job.id,
      });
    } else if (job.action === "resume" && job.resumeFrom) {
      await registerSession(stateRoot, job.repoHash, job.side, job.resumeFrom, {
        source: sessionSourceFor(job),
        cwd: job.cwd,
        jobId: job.id,
      });
    }

    await updateJob(stateRoot, job.repoHash, job.id, {
      status: "completed",
      completedAt,
      exitCode: 0,
      sessionId: sessionId ?? job.resumeFrom ?? null,
      errorSummary: null,
    });
    return readJob(stateRoot, job.repoHash, job.id);
  }

  await updateJob(stateRoot, job.repoHash, job.id, {
    status: "failed",
    completedAt,
    exitCode: runResult.exitCode,
    errorSummary: runResult.errorSummary,
  });
  return readJob(stateRoot, job.repoHash, job.id);
}

async function runCodex(job, stateRoot) {
  const codex = process.env.CLAUDE_CODEX_BRIDGE_CODEX_BIN || process.env.CODEX_BIN || "codex";
  const args = codexArgs(job);
  await fsp.appendFile(job.logFile, `bridge: running ${codex} ${args.map(shellish).join(" ")}\n`);

  const logStream = fs.createWriteStream(job.logFile, { flags: "a" });
  const inputHandle = await fsp.open(job.promptFile, "r");
  const childEnv = { ...process.env, CLAUDE_CODEX_BRIDGE_STATE_HOME: stateRoot };
  delete childEnv.ANTHROPIC_API_KEY;

  const child = spawn(codex, args, {
    cwd: job.cwd,
    shell: shouldUseShell(codex),
    env: childEnv,
    stdio: [inputHandle.fd, "pipe", "pipe"],
  });

  await updateJob(stateRoot, job.repoHash, job.id, { childPid: child.pid ?? null });

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  const result = await new Promise((resolve) => {
    let spawnError = null;
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, signal) => {
      resolve({ code, signal, spawnError });
    });
  });

  await new Promise((resolve) => logStream.end(resolve));
  await inputHandle.close().catch(() => {});

  if (result.spawnError) {
    const summary = result.spawnError.message;
    await fsp.appendFile(job.logFile, `bridge: spawn error: ${summary}\n`);
    return { ok: false, exitCode: 127, errorSummary: summary };
  }

  const hasResult = await fileHasContent(job.resultFile);
  if (result.code === 0 && hasResult) {
    return { ok: true, exitCode: 0, errorSummary: null };
  }

  const tail = await tailFile(job.logFile, 20);
  const exitCode = result.code ?? 1;
  const signal = result.signal ? ` signal ${result.signal}` : "";
  const reason = hasResult ? `exit ${exitCode}${signal}` : `empty result, exit ${exitCode}${signal}`;
  return {
    ok: false,
    exitCode,
    errorSummary: `${reason}${tail ? `: ${firstLine(tail)}` : ""}`,
  };
}

async function runClaude(job, stateRoot) {
  const claude = process.env.CLAUDE_CODEX_BRIDGE_CLAUDE_BIN || process.env.CLAUDE_BIN || "claude";
  const args = claudeArgs(job);
  await fsp.appendFile(job.logFile, `bridge: running ${claude} ${args.map(shellish).join(" ")}\n`);

  const logStream = fs.createWriteStream(job.logFile, { flags: "a" });
  const inputHandle = await fsp.open(job.promptFile, "r");
  const childEnv = { ...process.env, CLAUDE_CODEX_BRIDGE_STATE_HOME: stateRoot };
  delete childEnv.ANTHROPIC_API_KEY;

  const child = spawn(claude, args, {
    cwd: job.cwd,
    shell: shouldUseShell(claude),
    env: childEnv,
    stdio: [inputHandle.fd, "pipe", "pipe"],
  });

  await updateJob(stateRoot, job.repoHash, job.id, { childPid: child.pid ?? null });

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  const result = await new Promise((resolve) => {
    let spawnError = null;
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, signal) => {
      resolve({ code, signal, spawnError });
    });
  });

  await new Promise((resolve) => logStream.end(resolve));
  await inputHandle.close().catch(() => {});

  if (result.spawnError) {
    const summary = result.spawnError.message;
    await fsp.appendFile(job.logFile, `bridge: spawn error: ${summary}\n`);
    return { ok: false, exitCode: 127, errorSummary: summary };
  }

  const parsed = await parseClaudeOutput(job.logFile);
  if (result.code === 0 && parsed && parsed.is_error !== true && typeof parsed.result === "string") {
    await fsp.writeFile(job.resultFile, renderClaudeResult(parsed), "utf8");
    return {
      ok: true,
      exitCode: 0,
      errorSummary: null,
      sessionId: normalizeSessionId(parsed.session_id ?? parsed.sessionId),
    };
  }

  const tail = await tailFile(job.logFile, 20);
  const exitCode = result.code ?? 1;
  const signal = result.signal ? ` signal ${result.signal}` : "";
  const reason = parsed?.is_error === true ? "claude returned is_error" : `exit ${exitCode}${signal}`;
  return {
    ok: false,
    exitCode,
    errorSummary: `${reason}${tail ? `: ${firstLine(tail)}` : ""}`,
  };
}

function claudeArgs(job) {
  const args = profileArgs("claude", job.mode ?? defaultProfile("claude"), job.action, job);
  if (job.model) {
    args.push("--model", job.model);
  }
  return args;
}

function profileArgs(side, profileName, action, job) {
  const profile = profileConfig(side, profileName);
  const actionArgs = profile.actions?.[action];
  if (!Array.isArray(actionArgs)) {
    throw new UsageError(`${sideLabel(side)} profile ${profileName} does not support action ${action}`);
  }
  return expandProfileArgs([
    ...arrayField(profile, "baseArgs"),
    ...actionArgs,
    ...arrayField(profile, "modeArgs"),
  ], job);
}

function arrayField(object, key) {
  const value = object?.[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new UsageError(`profile ${key} must be an array`);
  }
  return value;
}

function expandProfileArgs(template, job) {
  const args = [];
  for (const token of template) {
    if (token === "{resultFile}") {
      args.push(job.resultFile);
      continue;
    }
    if (token === "{resumeFrom}") {
      if (!job.resumeFrom) {
        throw new UsageError("resume profile requires a session id");
      }
      args.push(job.resumeFrom);
      continue;
    }
    if (token === "{modelAndEffortArgs}") {
      args.push(...modelAndEffortArgs(job));
      continue;
    }
    args.push(token);
  }
  return args;
}

async function parseClaudeOutput(logFile) {
  let text = "";
  try {
    text = await fsp.readFile(logFile, "utf8");
  } catch {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {}
  const lines = trimmed.split(/\r?\n/).reverse();
  for (const line of lines) {
    const candidate = line.trim();
    if (!candidate.startsWith("{")) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function renderClaudeResult(parsed) {
  const result = parsed.result.endsWith("\n") ? parsed.result : `${parsed.result}\n`;
  const cost = typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd.toFixed(4) : "unknown";
  const sessionId = parsed.session_id ?? parsed.sessionId ?? "none";
  return `${result}cost: $${cost} | session: ${sessionId}\n`;
}

function codexArgs(job) {
  return profileArgs("cx", job.mode ?? defaultProfile("cx"), job.action, job);
}

function modelAndEffortArgs(job) {
  const args = [];
  if (job.model) {
    args.push("-m", job.model);
  }
  if (job.effort) {
    args.push("-c", `model_reasoning_effort=${job.effort}`);
  }
  return args;
}

function shouldUseShell(command) {
  if (process.platform !== "win32") {
    return false;
  }
  const ext = path.extname(command).toLowerCase();
  return ext === ".cmd" || ext === ".bat" || ext === "";
}

async function printForegroundResult(job) {
  if (job.status === "completed") {
    process.stdout.write(await fsp.readFile(job.resultFile, "utf8"));
    if (!String(await fsp.readFile(job.resultFile, "utf8")).endsWith("\n")) {
      process.stdout.write("\n");
    }
    process.stdout.write(
      `bridge: job ${job.id} | status completed | session ${job.sessionId ?? "none"}\n`,
    );
    return;
  }

  const tail = await tailFile(job.logFile, 50);
  process.stdout.write(tail || job.errorSummary || `job ${job.id} failed\n`);
  if (tail && !tail.endsWith("\n")) {
    process.stdout.write("\n");
  }
  process.exit(job.exitCode || 1);
}

function printBackgroundStart(job) {
  const label = sideLabel(job.side);
  const prefix = slashPrefix(job.side);
  process.stdout.write(`${label} ${job.action} started: ${job.id}\n`);
  process.stdout.write(`status: ${prefix}status ${job.id}\n`);
  process.stdout.write(`result: ${prefix}result ${job.id}\n`);
  process.stdout.write(`cancel: ${prefix}cancel ${job.id}\n`);
}

async function printStatus(side, argv) {
  const args = await parseLookupArgs(argv);
  const stateRoot = stateRootPath();
  const cwd = path.resolve(process.cwd());
  const repoHash = hashCwd(cwd);
  await ensureStateRoot(stateRoot);

  if (args.jobId) {
    const job = await findJob(stateRoot, args.jobId, repoHash);
    if (!job) {
      throw new UsageError(`job not found: ${args.jobId}`);
    }
    ensureJobSide(job, side);
    const reconciled = await reconcileJob(stateRoot, job);
    if (args.json) {
      printJson(reconciled);
      return;
    }
    printSingleStatus(reconciled);
    return;
  }

  const jobs = await listRepoJobs(stateRoot, repoHash, side);
  const reconciled = [];
  for (const job of jobs.slice(0, 20)) {
    reconciled.push(await reconcileJob(stateRoot, job));
  }

  if (args.json) {
    printJson(reconciled);
    return;
  }

  if (!reconciled.length) {
    process.stdout.write("No bridge jobs found for this workspace.\n");
    return;
  }

  process.stdout.write("ID | Action | Status | Age | Summary | Next\n");
  process.stdout.write("---|---|---|---|---|---\n");
  for (const job of reconciled) {
    process.stdout.write(
      `${job.id} | ${job.action} | ${job.status} | ${age(job.createdAt)} | ${statusSummary(job)} | ${nextCommand(job)}\n`,
    );
  }
}

async function printResult(side, argv) {
  const args = await parseLookupArgs(argv);
  const stateRoot = stateRootPath();
  const repoHash = hashCwd(path.resolve(process.cwd()));
  await ensureStateRoot(stateRoot);

  const job = args.jobId
    ? await findJob(stateRoot, args.jobId, repoHash)
    : await latestResultJob(stateRoot, repoHash, side);
  if (!job) {
    throw new UsageError(args.jobId ? `job not found: ${args.jobId}` : "no completed or failed bridge job found");
  }
  ensureJobSide(job, side);

  const reconciled = await reconcileJob(stateRoot, job);
  if (args.json) {
    const resultText = (await fileHasContent(reconciled.resultFile))
      ? await fsp.readFile(reconciled.resultFile, "utf8")
      : null;
    printJson({ ...reconciled, resultText });
    return;
  }

  if (reconciled.status === "completed") {
    process.stdout.write(await fsp.readFile(reconciled.resultFile, "utf8"));
    return;
  }

  process.stdout.write(`job: ${reconciled.id}\n`);
  process.stdout.write(`status: ${reconciled.status}\n`);
  if (reconciled.errorSummary) {
    process.stdout.write(`error: ${reconciled.errorSummary}\n`);
  }
  const tail = await tailFile(reconciled.logFile, 50);
  if (tail) {
    process.stdout.write("\nlog tail:\n");
    process.stdout.write(tail);
    if (!tail.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
}

async function cancelJob(side, argv) {
  const args = await parseLookupArgs(argv);
  const stateRoot = stateRootPath();
  const repoHash = hashCwd(path.resolve(process.cwd()));
  await ensureStateRoot(stateRoot);

  const job = args.jobId
    ? await findJob(stateRoot, args.jobId, repoHash)
    : await latestRunningJob(stateRoot, repoHash, side);
  if (!job) {
    throw new UsageError(args.jobId ? `job not found: ${args.jobId}` : "no running bridge job found");
  }
  ensureJobSide(job, side);

  if (!["running", "cancelling"].includes(job.status)) {
    throw new UsageError(`job ${job.id} is ${job.status}, not running`);
  }

  await updateJob(stateRoot, job.repoHash, job.id, {
    status: "cancelling",
    errorSummary: "cancellation requested",
  });
  await killJobProcessTree(job);
  const cancelled = await updateJob(stateRoot, job.repoHash, job.id, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
    errorSummary: "cancelled by bridge",
  });

  if (args.json) {
    printJson(cancelled);
    return;
  }
  process.stdout.write(`cancelled: ${cancelled.id}\n`);
}

async function registerSessionCommand(side, argv) {
  const args = parseRegisterSessionArgs(argv, side);
  const stateRoot = stateRootPath();
  const cwd = path.resolve(process.cwd());
  const repoHash = hashCwd(cwd);
  await ensureStateRoot(stateRoot);
  await registerSession(stateRoot, repoHash, side, args.session, {
    source: args.source,
    cwd,
    jobId: args.jobId,
  });
  process.stdout.write(`${sideLabel(side)} session registered: ${args.session} | source ${args.source}\n`);
}

async function killJobProcessTree(job) {
  const pids = [job.childPid, job.pid].filter((pid) => Number.isInteger(pid) && pid > 0);
  if (!pids.length) {
    return;
  }

  if (process.platform === "win32") {
    for (const pid of pids) {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    }
    return;
  }

  if (job.pid) {
    try {
      process.kill(-job.pid, "SIGTERM");
    } catch {}
  }
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
  await sleep(200);
  for (const pid of pids) {
    if (isPidAlive(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
  }
}

async function reconcileJob(stateRoot, job) {
  if (job.status !== "running" && job.status !== "cancelling") {
    return job;
  }

  const workerAlive = job.pid ? isPidAlive(job.pid) : false;
  const childAlive = job.childPid ? isPidAlive(job.childPid) : false;
  if (workerAlive || childAlive) {
    return job;
  }

  if (job.status === "cancelling") {
    return updateJob(stateRoot, job.repoHash, job.id, {
      status: "cancelled",
      completedAt: job.completedAt ?? new Date().toISOString(),
      errorSummary: "cancelled by bridge",
    });
  }

  if (await fileHasContent(job.resultFile)) {
    return updateJob(stateRoot, job.repoHash, job.id, {
      status: "completed",
      completedAt: job.completedAt ?? new Date().toISOString(),
      exitCode: 0,
    });
  }

  return updateJob(stateRoot, job.repoHash, job.id, {
    status: "orphaned",
    completedAt: job.completedAt ?? new Date().toISOString(),
    errorSummary: "worker pid is no longer running and no result was recorded",
  });
}

async function parseTaskArgs(argv, { side, allowSession, allowMode = false }) {
  const { tokens, rawText } = await extractArgsFile(argv);
  if (rawText !== null) {
    const fixedOptions = parseTaskTokens(tokens, {
      side,
      allowSession,
      allowMode,
      allowRequest: false,
    });
    return parseRawTaskArgs(rawText, { side, allowSession, allowMode, initialOptions: fixedOptions });
  }
  return parseTaskTokens(tokens, { side, allowSession, allowMode });
}

function defaultTaskOptions() {
  return {
    foreground: false,
    model: null,
    effort: null,
    session: null,
    mode: null,
    request: "",
  };
}

async function extractArgsFile(argv) {
  const tokens = [];
  let rawText = null;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--args-file") {
      const file = requireValue(argv, ++i, "--args-file");
      if (rawText !== null) {
        throw new UsageError("--args-file may only be provided once");
      }
      rawText = await fsp.readFile(file, "utf8");
      continue;
    }
    tokens.push(token);
  }
  return { tokens, rawText };
}

function parseTaskTokens(tokens, { side, allowSession, allowMode = false, allowRequest = true }) {
  const options = defaultTaskOptions();
  const request = [];
  let passthrough = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (passthrough) {
      if (!allowRequest) {
        throw new UsageError(`unexpected argument before --args-file: ${token}`);
      }
      request.push(token);
      continue;
    }
    if (token === "--") {
      if (!allowRequest) {
        throw new UsageError("-- is not valid before --args-file");
      }
      passthrough = true;
      continue;
    }
    if (token === "--foreground" || token === "--wait") {
      options.foreground = true;
      continue;
    }
    if (token === "--background") {
      options.foreground = false;
      continue;
    }
    if (token === "--model") {
      options.model = requireValue(tokens, ++i, "--model");
      continue;
    }
    if (token === "--effort") {
      const effort = requireValue(tokens, ++i, "--effort");
      if (!VALID_EFFORTS.has(effort)) {
        throw new UsageError(`invalid --effort value: ${effort}`);
      }
      options.effort = effort;
      continue;
    }
    if (token === "--session" && allowSession) {
      options.session = requireValue(tokens, ++i, "--session");
      validateSessionId(options.session);
      continue;
    }
    if (token === "--mode" && allowMode) {
      const mode = requireValue(tokens, ++i, "--mode");
      if (!isProfile(side, mode)) {
        throw new UsageError(`invalid ${sideLabel(side)} --mode value: ${mode}`);
      }
      options.mode = mode;
      continue;
    }
    if (!allowRequest) {
      throw new UsageError(`unexpected argument before --args-file: ${token}`);
    }
    request.push(token);
  }

  options.request = request.join(" ");
  return options;
}

function parseRawTaskArgs(rawText, { side, allowSession, allowMode = false, initialOptions = null }) {
  const options = initialOptions ? { ...initialOptions, request: "" } : defaultTaskOptions();
  const fixedMode = initialOptions?.mode ?? null;
  let index = 0;

  while (index < rawText.length) {
    index = skipWhitespace(rawText, index);
    if (index >= rawText.length) {
      options.request = "";
      return options;
    }

    const token = readShellToken(rawText, index);
    if (token.value === "--") {
      options.request = rawText.slice(skipWhitespace(rawText, token.end));
      return options;
    }

    if (token.value === "--foreground" || token.value === "--wait") {
      options.foreground = true;
      index = token.end;
      continue;
    }
    if (token.value === "--background") {
      options.foreground = false;
      index = token.end;
      continue;
    }

    const modelValue = inlineFlagValue(token.value, "--model");
    if (token.value === "--model" || modelValue !== null) {
      const value = modelValue !== null
        ? { value: modelValue, end: token.end }
        : readRawFlagValue(rawText, token.end, "--model");
      options.model = value.value;
      index = value.end;
      continue;
    }

    const effortValue = inlineFlagValue(token.value, "--effort");
    if (token.value === "--effort" || effortValue !== null) {
      const value = effortValue !== null
        ? { value: effortValue, end: token.end }
        : readRawFlagValue(rawText, token.end, "--effort");
      if (!VALID_EFFORTS.has(value.value)) {
        throw new UsageError(`invalid --effort value: ${value.value}`);
      }
      options.effort = value.value;
      index = value.end;
      continue;
    }

    const sessionValue = inlineFlagValue(token.value, "--session");
    if (allowSession && (token.value === "--session" || sessionValue !== null)) {
      const value = sessionValue !== null
        ? { value: sessionValue, end: token.end }
        : readRawFlagValue(rawText, token.end, "--session");
      validateSessionId(value.value);
      options.session = value.value;
      index = value.end;
      continue;
    }

    const modeValue = inlineFlagValue(token.value, "--mode");
    if (allowMode && (token.value === "--mode" || modeValue !== null)) {
      const value = modeValue !== null
        ? { value: modeValue, end: token.end }
        : readRawFlagValue(rawText, token.end, "--mode");
      if (!isProfile(side, value.value)) {
        throw new UsageError(`invalid ${sideLabel(side)} --mode value: ${value.value}`);
      }
      if (fixedMode && value.value !== fixedMode) {
        throw new UsageError(`--mode is fixed by wrapper as ${fixedMode}`);
      }
      options.mode = value.value;
      index = value.end;
      continue;
    }

    options.request = rawText.slice(index);
    return options;
  }

  return options;
}

function readRawFlagValue(rawText, start, flag) {
  const valueStart = skipWhitespace(rawText, start);
  if (valueStart >= rawText.length) {
    throw new UsageError(`${flag} requires a value`);
  }
  const value = readShellToken(rawText, valueStart);
  if (value.value === "--") {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

function inlineFlagValue(token, flag) {
  const prefix = `${flag}=`;
  return token.startsWith(prefix) ? token.slice(prefix.length) : null;
}

function skipWhitespace(text, index) {
  let next = index;
  while (next < text.length && /\s/.test(text[next])) {
    next += 1;
  }
  return next;
}

function readShellToken(input, start) {
  let current = "";
  let quote = null;
  let escaped = false;
  let index = start;

  for (; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      break;
    }
    current += char;
  }

  if (escaped) {
    current += "\\";
  }
  if (quote) {
    throw new UsageError("unterminated quote in arguments");
  }
  return { value: current, end: index };
}

async function parseLookupArgs(argv) {
  const { tokens, rawText } = await extractArgsFile(argv);
  const lookupTokens = rawText !== null ? splitCommandLine(rawText) : normalizeArgv(tokens);
  const result = { jobId: null, json: false };
  for (const token of lookupTokens) {
    if (token === "--json") {
      result.json = true;
      continue;
    }
    if (!result.jobId) {
      result.jobId = token;
      continue;
    }
    throw new UsageError(`unexpected argument: ${token}`);
  }
  return result;
}

function parseRegisterSessionArgs(argv, side) {
  const tokens = normalizeArgv(argv);
  const result = { session: null, source: null, jobId: null };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--session") {
      result.session = requireValue(tokens, ++i, "--session");
      validateSessionId(result.session);
      continue;
    }
    if (token === "--source") {
      result.source = requireValue(tokens, ++i, "--source");
      continue;
    }
    if (token === "--job-id") {
      result.jobId = requireValue(tokens, ++i, "--job-id");
      continue;
    }
    throw new UsageError(`unexpected register-session argument: ${token}`);
  }
  if (!result.session) {
    throw new UsageError("register-session requires --session <session-id>");
  }
  if (!result.source) {
    throw new UsageError("register-session requires --source <source>");
  }
  if (!isSessionSource(side, result.source)) {
    throw new UsageError(`${sideLabel(side)} session source must be ${sessionSourceList(side)}`);
  }
  return result;
}

function parseWorkerArgs(argv) {
  const jobId = argv.shift();
  if (!jobId) {
    throw new UsageError("usage: bridge-companion.mjs worker <job-id>");
  }
  let stateRoot = null;
  let repoHash = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--state-root") {
      stateRoot = requireValue(argv, ++i, "--state-root");
      continue;
    }
    if (argv[i] === "--repo-hash") {
      repoHash = requireValue(argv, ++i, "--repo-hash");
      continue;
    }
    throw new UsageError(`unexpected worker argument: ${argv[i]}`);
  }
  return { jobId, stateRoot, repoHash };
}

function normalizeArgv(argv) {
  if (argv.length === 1 && /\s/.test(argv[0])) {
    return splitCommandLine(argv[0]);
  }
  return argv;
}

function splitCommandLine(input) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaped) {
    current += "\\";
  }
  if (quote) {
    throw new UsageError("unterminated quote in arguments");
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function requireValue(tokens, index, flag) {
  const value = tokens[index];
  if (!value) {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

function validateSessionId(sessionId) {
  if (!UUID_RE.test(sessionId)) {
    throw new UsageError(`session id must be UUID-shaped: ${sessionId}`);
  }
}

function normalizeSessionId(sessionId) {
  return typeof sessionId === "string" && UUID_RE.test(sessionId) ? sessionId : null;
}

function hasProfiles(side) {
  return Boolean(PROFILES[side] && typeof PROFILES[side] === "object");
}

function profileConfig(side, profileName) {
  const sideProfiles = PROFILES[side];
  const profile = sideProfiles?.[profileName];
  if (!profile || typeof profile !== "object") {
    throw new UsageError(`unknown ${sideLabel(side)} profile: ${profileName}`);
  }
  return profile;
}

function isProfile(side, profileName) {
  return typeof profileName === "string" && Object.hasOwn(PROFILES[side] ?? {}, profileName);
}

function defaultProfile(side) {
  if (isProfile(side, "work")) {
    return "work";
  }
  return Object.keys(PROFILES[side] ?? {})[0] ?? null;
}

function profileList(side) {
  return Object.keys(PROFILES[side] ?? {}).join("|");
}

function isSessionSource(side, source) {
  const sources = SESSION_SOURCES[side];
  return Array.isArray(sources) && sources.includes(source);
}

function requireSessionSource(side, profileName) {
  if (!isSessionSource(side, profileName)) {
    throw new UsageError(
      `${sideLabel(side)} profile ${profileName} must be listed in sessionSources.${side} before it can create or resume bridge sessions`,
    );
  }
}

function sessionSourceList(side) {
  const sources = SESSION_SOURCES[side];
  return Array.isArray(sources) ? sources.join(", ") : "";
}

function sideLabel(side) {
  return side === "claude" ? "Claude Code" : "Codex";
}

function sessionSourceFor(job) {
  requireSessionSource(job.side, job.mode);
  return job.mode;
}

function stateRootPath() {
  if (process.env.CLAUDE_CODEX_BRIDGE_STATE_HOME) {
    return path.resolve(process.env.CLAUDE_CODEX_BRIDGE_STATE_HOME);
  }
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, APP_NAME);
  }
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(base, APP_NAME);
}

async function ensureStateRoot(stateRoot) {
  await fsp.mkdir(stateRoot, { recursive: true, mode: 0o700 });
  try {
    await fsp.chmod(stateRoot, 0o700);
  } catch {}
}

async function ensureRepoDirs(stateRoot, repoHash) {
  for (const dir of [
    path.join(stateRoot, "jobs", repoHash),
    path.join(stateRoot, "logs", repoHash),
    path.join(stateRoot, "results", repoHash),
    path.join(stateRoot, "prompts", repoHash),
    path.join(stateRoot, "sessions", repoHash),
  ]) {
    await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  }
}

function hashCwd(cwd) {
  return crypto.createHash("sha256").update(path.resolve(cwd)).digest("hex").slice(0, 16);
}

function pathsForJob(stateRoot, repoHash, jobId) {
  return {
    jobFile: path.join(stateRoot, "jobs", repoHash, `${jobId}.json`),
    indexFile: path.join(stateRoot, "jobs", repoHash, "index.json"),
    logFile: path.join(stateRoot, "logs", repoHash, `${jobId}.log`),
    resultFile: path.join(stateRoot, "results", repoHash, `${jobId}.md`),
    promptFile: path.join(stateRoot, "prompts", repoHash, `${jobId}.txt`),
  };
}

async function appendIndex(stateRoot, repoHash, job) {
  const paths = pathsForJob(stateRoot, repoHash, job.id);
  let index = { schemaVersion: SCHEMA_VERSION, jobs: [] };
  try {
    index = await readJson(paths.indexFile);
  } catch {}
  if (!Array.isArray(index.jobs)) {
    index.jobs = [];
  }
  index.jobs = index.jobs.filter((entry) => entry.id !== job.id);
  index.jobs.unshift({
    id: job.id,
    action: job.action,
    createdAt: job.createdAt,
    cwd: job.cwd,
  });
  index.updatedAt = new Date().toISOString();
  await writeJsonAtomic(paths.indexFile, index);
}

async function readJob(stateRoot, repoHash, jobId) {
  return readJson(pathsForJob(stateRoot, repoHash, jobId).jobFile);
}

async function updateJob(stateRoot, repoHash, jobId, patch) {
  const current = await readJob(stateRoot, repoHash, jobId);
  const next = { ...current, ...patch };
  await writeJsonAtomic(pathsForJob(stateRoot, repoHash, jobId).jobFile, next);
  return next;
}

async function findJob(stateRoot, jobId, preferredRepoHash = null) {
  if (preferredRepoHash) {
    const file = pathsForJob(stateRoot, preferredRepoHash, jobId).jobFile;
    if (fs.existsSync(file)) {
      return readJson(file);
    }
  }

  const jobsRoot = path.join(stateRoot, "jobs");
  let repoHashes = [];
  try {
    repoHashes = await fsp.readdir(jobsRoot);
  } catch {
    return null;
  }
  for (const repoHash of repoHashes) {
    const file = pathsForJob(stateRoot, repoHash, jobId).jobFile;
    if (fs.existsSync(file)) {
      return readJson(file);
    }
  }
  return null;
}

async function listRepoJobs(stateRoot, repoHash, side = null) {
  const paths = pathsForJob(stateRoot, repoHash, "placeholder");
  const dir = path.dirname(paths.jobFile);
  const jobs = [];
  let files = [];
  try {
    files = await fsp.readdir(dir);
  } catch {
    return jobs;
  }
  for (const file of files) {
    if (!file.endsWith(".json") || file === "index.json") {
      continue;
    }
    try {
      const job = await readJson(path.join(dir, file));
      if (!side || job.side === side) {
        jobs.push(job);
      }
    } catch {}
  }
  jobs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return jobs;
}

async function latestResultJob(stateRoot, repoHash, side) {
  const jobs = await listRepoJobs(stateRoot, repoHash, side);
  return jobs.find((job) => ["completed", "failed", "cancelled", "orphaned"].includes(job.status)) ?? null;
}

async function latestRunningJob(stateRoot, repoHash, side) {
  const jobs = await listRepoJobs(stateRoot, repoHash, side);
  return jobs.find((job) => ["running", "cancelling"].includes(job.status)) ?? null;
}

function ensureJobSide(job, side) {
  if (job.side !== side) {
    throw new UsageError(`job ${job.id} belongs to ${job.side}, not ${side}`);
  }
}

async function readJson(file) {
  return JSON.parse(await fsp.readFile(file, "utf8"));
}

async function writeJsonAtomic(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(tmp, file);
}

async function readLastSession(stateRoot, repoHash, side) {
  const file = path.join(stateRoot, "sessions", repoHash, `${side}-last-session.json`);
  try {
    const data = await readJson(file);
    const sessionId = data.sessionId ?? data.session_id ?? null;
    return sessionId ? { ...data, sessionId } : null;
  } catch {
    return null;
  }
}

async function readSession(stateRoot, repoHash, side, sessionId) {
  const file = path.join(stateRoot, "sessions", repoHash, `${side}-sessions.json`);
  try {
    const data = await readJson(file);
    const entry = data.sessions?.[sessionId] ?? null;
    if (!entry) {
      return null;
    }
    return { ...entry, sessionId: entry.sessionId ?? entry.session_id ?? sessionId };
  } catch {
    return null;
  }
}

async function registerSession(stateRoot, repoHash, side, sessionId, metadata) {
  if (!sessionId) {
    return;
  }
  await ensureRepoDirs(stateRoot, repoHash);
  const sessionDir = path.join(stateRoot, "sessions", repoHash);
  const registryFile = path.join(sessionDir, `${side}-sessions.json`);
  const lastFile = path.join(sessionDir, `${side}-last-session.json`);
  let registry = { schemaVersion: SCHEMA_VERSION, sessions: {} };
  try {
    registry = await readJson(registryFile);
  } catch {}
  if (!registry.sessions || Array.isArray(registry.sessions)) {
    registry.sessions = {};
  }
  registry.sessions[sessionId] = {
    sessionId,
    session_id: sessionId,
    ...metadata,
    updatedAt: new Date().toISOString(),
  };
  registry.updatedAt = new Date().toISOString();
  await writeJsonAtomic(registryFile, registry);
  await writeJsonAtomic(lastFile, registry.sessions[sessionId]);
}

async function parseSessionId(logFile) {
  let text = "";
  try {
    text = await fsp.readFile(logFile, "utf8");
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const value = JSON.parse(trimmed);
      const found = findSessionId(value);
      if (found) {
        return found;
      }
    } catch {}
  }
  return null;
}

function findSessionId(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const key of ["session_id", "sessionId", "thread_id", "threadId", "conversation_id"]) {
    if (typeof value[key] === "string" && UUID_RE.test(value[key])) {
      return value[key];
    }
  }
  for (const nested of Object.values(value)) {
    const found = findSessionId(nested);
    if (found) {
      return found;
    }
  }
  return null;
}

async function fileHasContent(file) {
  try {
    const stat = await fsp.stat(file);
    return stat.size > 0;
  } catch {
    return false;
  }
}

async function tailFile(file, lines) {
  let text = "";
  try {
    text = await fsp.readFile(file, "utf8");
  } catch {
    return "";
  }
  const parts = text.split(/\r?\n/);
  return parts.slice(Math.max(0, parts.length - lines)).join("\n");
}

function firstLine(text) {
  return text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
}

function makeJobId() {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "_");
  return `job_${stamp}_${crypto.randomBytes(3).toString("hex")}`;
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function statusSummary(job) {
  if (job.errorSummary) {
    return truncate(job.errorSummary, 80);
  }
  if (job.sessionId) {
    return `session ${job.sessionId}`;
  }
  return "-";
}

function nextCommand(job) {
  const prefix = slashPrefix(job.side);
  if (job.status === "running" || job.status === "cancelling") {
    return `${prefix}cancel ${job.id}`;
  }
  return `${prefix}result ${job.id}`;
}

function slashPrefix(side) {
  return side === "claude" ? "/claude-" : "/cx:";
}

function printSingleStatus(job) {
  process.stdout.write(`id: ${job.id}\n`);
  process.stdout.write(`action: ${job.action}\n`);
  process.stdout.write(`status: ${job.status}\n`);
  process.stdout.write(`cwd: ${job.cwd}\n`);
  process.stdout.write(`created: ${job.createdAt}\n`);
  if (job.startedAt) process.stdout.write(`started: ${job.startedAt}\n`);
  if (job.completedAt) process.stdout.write(`completed: ${job.completedAt}\n`);
  if (job.pid) process.stdout.write(`pid: ${job.pid}\n`);
  if (job.childPid) process.stdout.write(`childPid: ${job.childPid}\n`);
  if (job.sessionId) process.stdout.write(`session: ${job.sessionId}\n`);
  if (job.resumeFrom) process.stdout.write(`resumeFrom: ${job.resumeFrom}\n`);
  if (job.errorSummary) process.stdout.write(`error: ${job.errorSummary}\n`);
  process.stdout.write(`log: ${job.logFile}\n`);
  process.stdout.write(`result: ${job.resultFile}\n`);
  process.stdout.write(`next: ${nextCommand(job)}\n`);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function age(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) {
    return "-";
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function truncate(value, length) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= length) {
    return text || "-";
  }
  return `${text.slice(0, length - 1)}...`;
}

function shellish(value) {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(String(value))) {
    return String(value);
  }
  return JSON.stringify(String(value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
