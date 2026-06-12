#!/usr/bin/env bun
/**
 * claude-codex-bridge mechanical core.
 *
 * Single file, zero npm dependencies, node:-compatible APIs only (runs under
 * Bun, and under Node >= 22 with --experimental-strip-types as a fallback).
 *
 * The Markdown commands/prompts are thin intent shells: they save the user's
 * verbatim text to a file and invoke one subcommand here. Everything
 * deterministic lives in this file: routing-flag parsing with shape
 * validation, prompt assembly, session registry, billing guard, and spawning
 * codex/claude with argv arrays so no shell ever parses user text.
 *
 * Subcommands (cx-* spawn codex; cc-* spawn claude):
 *   cx-ask | cx-task | cx-review | cc-ask | cc-task | cc-review | cc-resume
 * Common options:
 *   --text-file <path>   user text, verbatim, routing flags included
 *   --repo <path>        repository root (default: cwd)
 *   --follow-up          (cx-task) intent signal: resume last session if one exists
 *   --self-test          print parsed decisions as JSON instead of spawning
 *
 * Exit codes: 0 ok · 1 child CLI failed · 2 usage/registry error
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------- validation

const MODEL_RE = /^[A-Za-z0-9._-]+$/;
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;
const COMMIT_RE = /^[0-9a-fA-F]{4,40}$/;
const MODEL_ALIASES: Record<string, string> = { spark: "gpt-5.3-codex-spark" };

// ------------------------------------------------------------- flag stripping

interface ValueFlagSpec {
  flag: string;
  validate: (value: string) => boolean;
}

/**
 * Remove the first `--flag <value>` occurrence whose value passes its shape
 * check. An invalid value means the pair is NOT a routing flag: both tokens
 * stay in the text (this is what keeps `--model "$(rm -rf ~)"` inert — it
 * rides the stdin path instead of the argv path).
 */
function takeValueFlag(text: string, spec: ValueFlagSpec): { text: string; value?: string } {
  const re = new RegExp(`(^|\\s)${spec.flag}(?:\\s+|=)(\\S+)`);
  const match = re.exec(text);
  if (!match || !spec.validate(match[2])) return { text };
  return {
    text: (text.slice(0, match.index) + match[1] + text.slice(match.index + match[0].length)).trim(),
    value: match[2],
  };
}

/** Remove the first bare `--flag` occurrence. */
function takeBoolFlag(text: string, flag: string): { text: string; present: boolean } {
  const re = new RegExp(`(^|\\s)${flag}(?=\\s|$)`);
  const match = re.exec(text);
  if (!match) return { text, present: false };
  return {
    text: (text.slice(0, match.index) + match[1] + text.slice(match.index + match[0].length)).trim(),
    present: true,
  };
}

/** `--resume` with a UUID-shaped value, or bare `--resume` (value stays in text). */
function takeResumeFlag(text: string): { text: string; resume: boolean; sessionId?: string } {
  const withId = new RegExp(`(^|\\s)--resume(?:\\s+|=)(${UUID_RE.source.slice(1, -1)})(?=\\s|$)`, "i");
  const m1 = withId.exec(text);
  if (m1) {
    return {
      text: (text.slice(0, m1.index) + m1[1] + text.slice(m1.index + m1[0].length)).trim(),
      resume: true,
      sessionId: m1[2].toLowerCase(),
    };
  }
  const bare = takeBoolFlag(text, "--resume");
  return { text: bare.text, resume: bare.present };
}

// ----------------------------------------------------------------- registry

function stateDir(repo: string): string {
  const hash = createHash("sha256").update(resolve(repo)).digest("hex").slice(0, 16);
  const base =
    process.platform === "win32"
      ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "claude-codex-bridge", "sessions")
      : join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "claude-codex-bridge", "sessions");
  return join(base, hash);
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
}

function readJsonObject(path: string): Record<string, unknown> {
  // A registry file that fails to parse is rebuilt, never a crash.
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

interface CcEntry {
  session_id: string;
  source: "ask" | "review" | "task";
  cwd: string;
}

function saveCxSession(repo: string, sessionId: string): void {
  const dir = stateDir(repo);
  const sessions = readJsonObject(join(dir, "cx-sessions.json"));
  sessions[sessionId] = { session_id: sessionId, cwd: resolve(repo) };
  atomicWrite(join(dir, "cx-sessions.json"), JSON.stringify(sessions, null, 2) + "\n");
  atomicWrite(join(dir, "cx-last-session"), sessionId + "\n");
}

function lastCxSession(repo: string): string | undefined {
  try {
    const id = readFileSync(join(stateDir(repo), "cx-last-session"), "utf8").trim();
    return UUID_RE.test(id) ? id.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

function saveCcSession(repo: string, entry: CcEntry): void {
  const dir = stateDir(repo);
  const sessions = readJsonObject(join(dir, "cc-sessions.json"));
  sessions[entry.session_id] = entry;
  atomicWrite(join(dir, "cc-sessions.json"), JSON.stringify(sessions, null, 2) + "\n");
  atomicWrite(join(dir, "cc-last-session.json"), JSON.stringify(entry, null, 2) + "\n");
}

// ------------------------------------------------------------------- prompts

const TASK_CONTRACT = `<completeness_contract>
Done means: the requested change is implemented, the project still builds, and the narrowest relevant validation available in this repository passes. If validation cannot be run, report exactly why.
</completeness_contract>
<verification_loop>
After making changes, inspect local project conventions to choose the narrowest relevant test/build/check command. Run it, resolve failures caused by your changes, and report the command and outcome.
</verification_loop>
<action_safety>
Stay narrow: change only what the task requires. Do not do drive-by refactors, dependency bumps, generated-file churn, or unrelated formatting. If a risky or destructive step is required, stop and report instead.
</action_safety>`;

const CX_ASK_PROMPT = (question: string) => `<task>
${question}
Context: the working directory is the repository to inspect. You have read-only access.
</task>
<compact_output_contract>
Lead with the conclusion, then supporting detail. Be concise. Every claim about this repository must cite file paths (file:line where possible).
</compact_output_contract>
<grounding_rules>
Only state what you can support by reading files in this repository or by well-established general knowledge. Label hypotheses as hypotheses. Never invent file contents or APIs.
</grounding_rules>`;

const CX_TASK_PROMPT = (task: string) => `<task>
${task}
Context: the working directory is the repository to change.
</task>
${TASK_CONTRACT}`;

const CC_TASK_PROMPT = (task: string) => `${CX_TASK_PROMPT(task)}

End with a short summary of changed files, validation run, validation outcome, and any remaining work.`;

const CC_REVIEW_PROMPT = (scope: string, focus: string) => `Review the local git changes in this repository. Run these git commands yourself to establish the scope, then review their output:
Scope: ${scope}
Focus: ${focus || "general correctness, bugs, and risky changes"}

Output contract — for each finding, one line:
P0-P3 | file:line | problem | evidence
Order by severity. Only report issues grounded in the diff or in files you actually read. No speculation, no style nitpicks unless asked. If there are no findings, say so explicitly.`;

// ------------------------------------------------------------ claude tooling

const CC_READONLY_TOOLS = "Read,Grep,Glob";
const CC_REVIEW_TOOLS = "Read,Grep,Glob,Bash";
const CC_REVIEW_ALLOWED =
  "Read,Grep,Glob,Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git ls-files *)";
const CC_TASK_TOOLS = "Read,Edit,Write,Grep,Glob,Bash";
const CC_TASK_ALLOWED =
  "Read,Edit,Write,Grep,Glob,Bash(git status *),Bash(git diff *),Bash(npm test *),Bash(npm run *)," +
  "Bash(pnpm test *),Bash(pnpm run *),Bash(yarn test *),Bash(yarn run *),Bash(bun test *),Bash(deno test *)," +
  "Bash(pytest *),Bash(python -m pytest *),Bash(uv run pytest *),Bash(go test *),Bash(cargo test *)," +
  "Bash(mvn test *),Bash(mvn verify *),Bash(gradle test *),Bash(gradlew test *),Bash(dotnet test *)," +
  "Bash(make test *),Bash(bundle exec rspec *),Bash(rspec *)";

function ccModeArgs(source: CcEntry["source"]): string[] {
  switch (source) {
    case "ask":
      return ["--strict-mcp-config", "--tools", CC_READONLY_TOOLS, "--allowedTools", CC_READONLY_TOOLS];
    case "review":
      return ["--strict-mcp-config", "--tools", CC_REVIEW_TOOLS, "--allowedTools", CC_REVIEW_ALLOWED];
    case "task":
      return [
        "--strict-mcp-config",
        "--tools",
        CC_TASK_TOOLS,
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        CC_TASK_ALLOWED,
      ];
  }
}

// ------------------------------------------------------------------ spawning

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Resolve a bare command name to a concrete executable path on Windows.
 *
 * Bun (the runtime this bridge ships on) does not honour PATHEXT for `spawn`
 * when `shell: false`, so a bare `codex` / `claude` — which exist only as
 * `.cmd` launchers — fail with ENOENT. We resolve the full path ourselves and
 * hand spawn an absolute path, which Bun launches directly. This keeps
 * `shell: false`, so no shell ever parses our argv or the user's text. On
 * POSIX (and when the name already contains a path) the bare name is returned
 * unchanged and spawn resolves it via PATH as before.
 */
function resolveExecutable(cmd: string): string {
  if (process.platform !== "win32" || /[\\/]/.test(cmd)) return cmd;
  const exts = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.trim()).filter(Boolean);
  for (const dir of (process.env.PATH ?? "").split(";")) {
    if (!dir) continue;
    for (const ext of [...exts, ""]) {
      const candidate = join(dir, cmd + ext);
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        /* not here — keep looking */
      }
    }
  }
  return cmd; // let spawn surface a clear ENOENT
}

/**
 * Spawn a child, feed it `stdin`, and collect its output. Asynchronous because
 * Bun's *synchronous* spawn (spawnSync and Bun.spawnSync alike) is broken on
 * Windows — it fails every call with `ENOTCONN: socket is not connected`.
 * Async spawn works on both runtimes and all platforms.
 */
function run(cmd: string, args: string[], stdin: string | undefined, timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<RunResult> {
  return new Promise((settle) => {
    const child = spawn(resolveExecutable(cmd), args, {
      env,
      shell: false, // argv arrays only — no shell ever parses our args or user text
      windowsHide: true,
    });

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    let done = false;
    let timedOut = false;
    let overflowed = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const finish = (status: number, hint?: string): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const stderr = Buffer.concat(errChunks).toString("utf8") + (hint ? `\nbridge: ${hint}` : "");
      settle({ status, stdout: Buffer.concat(outChunks).toString("utf8"), stderr });
    };

    child.stdout.on("data", (d: Buffer) => {
      outLen += d.length;
      if (outLen > MAX_BUFFER) {
        overflowed = true;
        child.kill();
        return;
      }
      outChunks.push(d);
    });
    child.stderr.on("data", (d: Buffer) => {
      errLen += d.length;
      if (errLen <= MAX_BUFFER) errChunks.push(d);
    });

    child.on("error", (e: NodeJS.ErrnoException) => {
      finish(1, e.code === "ENOENT" ? `${cmd} is not on PATH` : String(e));
    });
    child.on("close", (code) => {
      if (timedOut) return finish(1, `${cmd} exceeded ${timeoutMs} ms`);
      if (overflowed) return finish(1, `${cmd} output exceeded ${MAX_BUFFER} bytes`);
      finish(code ?? 1);
    });

    // A child that exits before draining stdin yields EPIPE; that surfaces via
    // the exit status, so the write error itself is safe to swallow.
    child.stdin.on("error", () => {});
    child.stdin.end(stdin ?? "");
  });
}

function tail(text: string, lines: number): string {
  return text.split("\n").slice(-lines).join("\n");
}

function fail(message: string, code: 1 | 2): never {
  process.stderr.write(message.endsWith("\n") ? message : message + "\n");
  process.exit(code);
}

/** Billing guard: the child must never see ANTHROPIC_API_KEY (forces API billing). */
function claudeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return env;
}

// --------------------------------------------------------------- codex side

const CODEX_TIMEOUT_MS = 600_000;
const CLAUDE_ASK_TIMEOUT_MS = 600_000;
const CLAUDE_TASK_TIMEOUT_MS = 900_000;

function codexOutFile(repo: string, background: boolean): string {
  if (!background) return join(mkdtempSync(join(tmpdir(), "cx-")), "result.md");
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15).replace(/(\d{8})(\d{6}).*/, "$1-$2");
  return join(resolve(repo), `.cx-result-${stamp}-${randomBytes(2).toString("hex")}.md`);
}

// --------------------------------------------------------------- usage report

function num(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

interface TokenCounts {
  in?: number;
  cached?: number;
  out?: number;
  reasoning?: number;
}

/** Compact "tokens: in=… (cached …) out=… (reasoning …)" line; "" when nothing is known. */
function tokenLine(t: TokenCounts): string {
  const parts: string[] = [];
  if (t.in !== undefined) parts.push(`in=${t.in}${t.cached ? ` (cached ${t.cached})` : ""}`);
  if (t.out !== undefined) parts.push(`out=${t.out}${t.reasoning ? ` (reasoning ${t.reasoning})` : ""}`);
  return parts.length ? `tokens: ${parts.join(" ")}` : "";
}

/**
 * Codex (`--json`) emits a `turn.completed` event carrying token usage; codex
 * never reports a dollar cost, so we surface tokens only. Last turn wins (a
 * single `codex exec` has exactly one turn).
 */
function extractCodexUsage(eventStream: string): TokenCounts | undefined {
  let usage: TokenCounts | undefined;
  for (const line of eventStream.split("\n")) {
    const s = line.trim();
    if (!s.startsWith("{") || !s.includes('"turn.completed"')) continue;
    try {
      const u = (JSON.parse(s) as { usage?: Record<string, unknown> }).usage;
      if (u && typeof u === "object") {
        usage = {
          in: num(u.input_tokens),
          cached: num(u.cached_input_tokens),
          out: num(u.output_tokens),
          reasoning: num(u.reasoning_output_tokens),
        };
      }
    } catch {
      /* ignore malformed event lines */
    }
  }
  return usage;
}

/** Blank-line-separated token footer for codex output, or "" when usage is absent. */
function codexUsageFooter(eventStream: string): string {
  const line = tokenLine(extractCodexUsage(eventStream) ?? {});
  return line ? `\n\n${line}\n` : "";
}

async function runCodex(args: string[], stdin: string | undefined, outFile: string): Promise<string> {
  const result = await run("codex", args, stdin, CODEX_TIMEOUT_MS);
  const output = existsSync(outFile) && statSync(outFile).size > 0 ? readFileSync(outFile, "utf8") : "";
  if (result.status !== 0 || output === "") {
    fail(tail(result.stdout + "\n" + result.stderr, 50), 1);
  }
  return output + codexUsageFooter(result.stdout);
}

function extractCodexSessionId(eventStream: string): string | undefined {
  // Defensive: accept any session/thread id key carrying a UUID, first hit wins.
  const re = /"(?:session_?id|thread_?id|sessionId|threadId)"\s*:\s*"([0-9a-f-]{36})"/i;
  const match = re.exec(eventStream);
  return match && UUID_RE.test(match[1]) ? match[1].toLowerCase() : undefined;
}

async function cxAsk(text: string, repo: string, selfTest: boolean): Promise<void> {
  let model: string | undefined, effort: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  ({ text, value: effort } = takeValueFlag(text, { flag: "--effort", validate: (v) => EFFORTS.has(v) }));
  model = model ? (MODEL_ALIASES[model] ?? model) : undefined;

  const outFile = codexOutFile(repo, false);
  // --json gives the JSONL event stream we parse for token usage; -o still holds the answer.
  const args = ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--color", "never", "--json", "-o", outFile];
  if (model) args.push("-m", model);
  if (effort) args.push("-c", `model_reasoning_effort=${effort}`);
  args.push("-");

  if (selfTest) return selfTestPrint({ argv: ["codex", ...args], stdin: CX_ASK_PROMPT(text) });
  process.stdout.write(await runCodex(args, CX_ASK_PROMPT(text), outFile));
}

async function cxTask(text: string, repo: string, followUp: boolean, selfTest: boolean): Promise<void> {
  let model: string | undefined, effort: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  ({ text, value: effort } = takeValueFlag(text, { flag: "--effort", validate: (v) => EFFORTS.has(v) }));
  model = model ? (MODEL_ALIASES[model] ?? model) : undefined;
  const fresh = takeBoolFlag(text, "--fresh");
  text = fresh.text;
  const background = takeBoolFlag(text, "--background");
  text = background.text;
  const resume = takeResumeFlag(text);
  text = resume.text;

  let sessionId: string | undefined;
  if (!fresh.present) {
    if (resume.sessionId) sessionId = resume.sessionId;
    else if (resume.resume || followUp) {
      sessionId = lastCxSession(repo);
      if (resume.resume && !sessionId) {
        fail("bridge: no bridge-owned Codex session to resume for this repository (registry empty or invalid).", 2);
      }
    }
  }

  const outFile = codexOutFile(repo, background.present);
  let args: string[];
  let stdin: string;
  if (sessionId) {
    // resume does not accept --color but does accept --json (token usage) and -o.
    args = ["exec", "resume", sessionId, "-c", "sandbox_mode=workspace-write", "--json", "-o", outFile];
    if (model) args.push("-m", model);
    if (effort) args.push("-c", `model_reasoning_effort=${effort}`);
    args.push("-");
    stdin = text; // delta instruction only, never the full contract again
  } else {
    args = ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "--color", "never", "--json", "-o", outFile];
    if (model) args.push("-m", model);
    if (effort) args.push("-c", `model_reasoning_effort=${effort}`);
    args.push("-");
    stdin = CX_TASK_PROMPT(text);
  }

  if (selfTest) return selfTestPrint({ argv: ["codex", ...args], stdin, sessionId, background: background.present });
  const result = await run("codex", args, stdin, CODEX_TIMEOUT_MS);
  const output = existsSync(outFile) && statSync(outFile).size > 0 ? readFileSync(outFile, "utf8") : "";
  if (result.status !== 0 || output === "") fail(tail(result.stdout + "\n" + result.stderr, 50), 1);
  if (!sessionId) {
    const found = extractCodexSessionId(result.stdout);
    if (found) saveCxSession(repo, found);
  }
  process.stdout.write(output + codexUsageFooter(result.stdout));
}

async function cxReview(text: string, repo: string, selfTest: boolean): Promise<void> {
  let model: string | undefined, base: string | undefined, commit: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  ({ text, value: base } = takeValueFlag(text, { flag: "--base", validate: (v) => BRANCH_RE.test(v) }));
  ({ text, value: commit } = takeValueFlag(text, { flag: "--commit", validate: (v) => COMMIT_RE.test(v) }));
  model = model ? (MODEL_ALIASES[model] ?? model) : undefined;
  const focus = text.trim();

  const outFile = codexOutFile(repo, false);
  const args = ["exec", "review"];
  if (base) args.push("--base", base);
  else if (commit) args.push("--commit", commit);
  else args.push("--uncommitted");
  args.push("--json", "-o", outFile); // --json for token usage; review rejects --color
  if (model) args.push("-m", model);
  if (focus) args.push("-");

  if (selfTest) return selfTestPrint({ argv: ["codex", ...args], stdin: focus || undefined });
  process.stdout.write(await runCodex(args, focus || undefined, outFile));
}

// --------------------------------------------------------------- claude side

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ClaudeJson {
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  is_error?: boolean;
  usage?: ClaudeUsage;
}

async function runClaude(args: string[], stdin: string, timeoutMs: number, selfTest: boolean): Promise<ClaudeJson | void> {
  const argv = ["--print", "--output-format", "json", ...args];
  if (selfTest) return selfTestPrint({ argv: ["claude", ...argv], stdin, billingGuard: true });
  const result = await run("claude", argv, stdin, timeoutMs, claudeEnv());
  if (result.status !== 0) fail(tail(result.stdout + "\n" + result.stderr, 50), 1);
  let parsed: ClaudeJson;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    fail("bridge: claude did not return valid JSON:\n" + tail(result.stdout + "\n" + result.stderr, 50), 1);
  }
  if (parsed.is_error) fail(parsed.result ?? "claude reported is_error with no result text", 1);
  return parsed;
}

function reportClaude(parsed: ClaudeJson, repo: string, source: CcEntry["source"]): void {
  if (parsed.session_id && UUID_RE.test(parsed.session_id)) {
    saveCcSession(repo, { session_id: parsed.session_id.toLowerCase(), source, cwd: resolve(repo) });
  }
  const cost = typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd.toFixed(2) : "?";
  const u = parsed.usage;
  // Claude reports usage and a dollar cost. "in" is total input volume (fresh +
  // cache create + cache read); the cached portion is annotated separately.
  const tokens = tokenLine(
    u
      ? {
          in: (num(u.input_tokens) ?? 0) + (num(u.cache_read_input_tokens) ?? 0) + (num(u.cache_creation_input_tokens) ?? 0) || undefined,
          cached: num(u.cache_read_input_tokens),
          out: num(u.output_tokens),
        }
      : {},
  );
  const meta = [tokens, `cost: $${cost}`, `session: ${parsed.session_id ?? "unknown"}`].filter(Boolean).join(" | ");
  process.stdout.write(`${parsed.result ?? ""}\n\n${meta}\n`);
}

async function ccAsk(text: string, repo: string, selfTest: boolean): Promise<void> {
  let model: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  const args = [...ccModeArgs("ask")];
  if (model) args.push("--model", model);
  const parsed = await runClaude(args, text, CLAUDE_ASK_TIMEOUT_MS, selfTest);
  if (parsed) reportClaude(parsed, repo, "ask");
}

async function ccReview(text: string, repo: string, selfTest: boolean): Promise<void> {
  let model: string | undefined, base: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  ({ text, value: base } = takeValueFlag(text, { flag: "--base", validate: (v) => BRANCH_RE.test(v) }));
  const scope = base
    ? `\`git diff ${base}...HEAD\``
    : "uncommitted changes via `git status --short`, `git diff HEAD`, and `git ls-files --others --exclude-standard`";
  const args = [...ccModeArgs("review")];
  if (model) args.push("--model", model);
  const parsed = await runClaude(args, CC_REVIEW_PROMPT(scope, text.trim()), CLAUDE_ASK_TIMEOUT_MS, selfTest);
  if (parsed) reportClaude(parsed, repo, "review");
}

async function ccTask(text: string, repo: string, selfTest: boolean): Promise<void> {
  let model: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  const args = [...ccModeArgs("task")];
  if (model) args.push("--model", model);
  const parsed = await runClaude(args, CC_TASK_PROMPT(text), CLAUDE_TASK_TIMEOUT_MS, selfTest);
  if (parsed) reportClaude(parsed, repo, "task");
}

async function ccResume(text: string, repo: string, selfTest: boolean): Promise<void> {
  let model: string | undefined, session: string | undefined, mode: string | undefined;
  ({ text, value: model } = takeValueFlag(text, { flag: "--model", validate: (v) => MODEL_RE.test(v) }));
  ({ text, value: session } = takeValueFlag(text, { flag: "--session", validate: (v) => UUID_RE.test(v) }));
  ({ text, value: mode } = takeValueFlag(text, { flag: "--mode", validate: (v) => ["ask", "review", "task"].includes(v) }));

  const dir = stateDir(repo);
  const sessions = readJsonObject(join(dir, "cc-sessions.json")) as Record<string, CcEntry>;
  let entry: CcEntry | undefined;
  if (session) {
    entry = sessions[session.toLowerCase()];
    if (!entry && !mode) {
      fail(`bridge: session ${session} is not in the registry; rerun with --session ${session} --mode ask|review|task`, 2);
    }
    if (!entry) entry = { session_id: session.toLowerCase(), source: mode as CcEntry["source"], cwd: resolve(repo) };
  } else {
    entry = readJsonObject(join(dir, "cc-last-session.json")) as unknown as CcEntry;
    if (!entry.session_id || !UUID_RE.test(entry.session_id) || !["ask", "review", "task"].includes(entry.source)) {
      fail("bridge: no resumable bridge-owned Claude session for this repository; start one with /cc-ask, /cc-review, or /cc-task.", 2);
    }
  }

  const args = [...ccModeArgs(entry.source), "--resume", entry.session_id];
  if (model) args.push("--model", model);
  const parsed = await runClaude(args, text, CLAUDE_TASK_TIMEOUT_MS, selfTest);
  if (parsed) reportClaude(parsed, repo, entry.source);
}

// ---------------------------------------------------------------------- main

function selfTestPrint(decision: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(decision, null, 2) + "\n");
}

async function main(argv: string[]): Promise<void> {
  const [subcommand, ...rest] = argv;
  let textFile: string | undefined;
  let repo = process.cwd();
  let followUp = false;
  let selfTest = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--text-file") textFile = rest[++i];
    else if (rest[i] === "--repo") repo = rest[++i];
    else if (rest[i] === "--follow-up") followUp = true;
    else if (rest[i] === "--self-test") selfTest = true;
    else fail(`bridge: unknown option ${rest[i]}`, 2);
  }
  if (!textFile) fail("bridge: --text-file <path> is required", 2);
  let text: string;
  try {
    text = readFileSync(textFile, "utf8").trim();
  } catch {
    fail(`bridge: cannot read text file ${textFile}`, 2);
  }

  switch (subcommand) {
    case "cx-ask": return cxAsk(text, repo, selfTest);
    case "cx-task": return cxTask(text, repo, followUp, selfTest);
    case "cx-review": return cxReview(text, repo, selfTest);
    case "cc-ask": return ccAsk(text, repo, selfTest);
    case "cc-review": return ccReview(text, repo, selfTest);
    case "cc-task": return ccTask(text, repo, selfTest);
    case "cc-resume": return ccResume(text, repo, selfTest);
    default:
      fail(`bridge: unknown subcommand ${subcommand ?? "(none)"}; expected cx-ask|cx-task|cx-review|cc-ask|cc-task|cc-review|cc-resume`, 2);
  }
}

main(process.argv.slice(2)).catch((err) => {
  fail(`bridge: ${err instanceof Error ? err.message : String(err)}`, 1);
});
