#!/usr/bin/env node

// Check a reviewer handoff against handoff-schema.json and HANDOFF.md's rules.
//
// The caller who writes the brief is usually the builder of the candidate, so
// the brief's neutrality cannot rest on that caller's reading of the rules.
// Two real briefs showed where a text template leaks: a preamble before the
// first field, a builder's walk-list appended after the last one, a request
// restated in the builder's words — each one allowed by nothing and caught
// by nobody. As JSON the brief has exactly the schema's fields and no room
// beside them; this script applies the schema and the cross-field rules a
// schema cannot express: every reference readable or inlined, the lens lists
// partitioning LENSES.md, the inlined record schema identical to the one the
// record validator will apply, a re-review carrying its prior round.
//
// What it cannot judge is substance. A quoted request that is really a
// paraphrase passes here and is the reviewer's to notice; a passing brief is
// well-formed, which is the precondition for a neutral review, not the review.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DEPTH = 64;
const MAX_ARRAY = 1000;
const MAX_FAILURES = 100;

// ---------------------------------------------------------------------------
// Schema interpreter
//
// Keep this block byte-identical with the copy in every other skill that
// validates an agent-authored record: `node scripts/assert-validator-helpers.mjs`
// fails when they drift. It is duplicated rather than imported because
// AGENTS.md requires each skill to stay independently distributable, and
// install-skills.cjs links the skill directory alone — an import reaching
// outside it resolves in this checkout and nowhere else.
// ---------------------------------------------------------------------------

// >>> shared-validator-helpers
const SUPPORTED_KEYWORDS = new Set([
  "title", "type", "enum", "const", "required", "properties", "additionalProperties",
  "items", "oneOf", "minItems", "maxItems", "uniqueItems", "minLength", "maxLength",
  "pattern", "minimum", "maximum", "visibleContent",
]);

// Expressed as code-point predicates rather than regex literals: U+2028 and
// U+2029 are line terminators in JavaScript source, so a character class
// carrying them ends mid-pattern and the file stops parsing. Predicates also
// avoid the /g-with-.test() trap, where a shared regex keeps lastIndex between
// calls and silently answers the second caller wrong.
function isInvisibleCodePoint(code) {
  return (code >= 0x09 && code <= 0x0d) || code === 0x20 || code === 0xa0 || code === 0xad
    || (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e)
    || (code >= 0x2060 && code <= 0x2064) || (code >= 0x206a && code <= 0x206f)
    || code === 0x3000 || code === 0xfeff;
}

function isControlCodePoint(code) {
  return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
}

function hasVisibleContent(value) {
  if (typeof value !== "string") return false;
  for (const character of value) {
    if (!isInvisibleCodePoint(character.codePointAt(0))) return true;
  }
  return false;
}

// A record arrives from a delegated reviewer, and on a re-review from the
// builder too: it is untrusted text. Control characters reaching a terminal
// through a failure message are an escape-sequence injection, so they are
// stripped here, at the one place every message passes through.
function safeForMessage(value) {
  let out = "";
  for (const character of String(value)) {
    out += isControlCodePoint(character.codePointAt(0)) ? " " : character;
  }
  return out.trim();
}

function quote(value, limit = 120) {
  const clean = safeForMessage(typeof value === "string" ? value : JSON.stringify(value));
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, expected) {
  if (expected === "object") return typeOf(value) === "object";
  if (expected === "integer") return typeOf(value) === "integer";
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  return typeOf(value) === expected;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// A branch's discriminator is its first `const` property. Without it a failed
// `oneOf` can only say "matched 0 of 4", which tells the reviewer nothing about
// which branch it nearly satisfied.
function discriminatorOf(schema) {
  for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
    if (subSchema && typeof subSchema === "object" && "const" in subSchema) {
      return { key, value: subSchema.const };
    }
  }
  return null;
}

function validateAgainstSchema(value, schema, label = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return [`${label}: schema error: not a schema object`];
  }
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      // Silently ignoring an unknown keyword would let a future schema edit
      // add a rule this interpreter never applies, and the record would pass
      // for reasons nobody checked.
      errors.push(`${label}: schema error: unsupported schema keyword "${keyword}"`);
    }
  }
  if ("visibleContent" in schema && schema.type !== "string") {
    errors.push(`${label}: schema error: visibleContent requires type "string"`);
  }
  if (errors.length > 0) return errors;

  if ("type" in schema && !matchesType(value, schema.type)) {
    return [`${label}: must be ${schema.type}, found ${typeOf(value)}`];
  }
  if ("const" in schema && canonical(value) !== canonical(schema.const)) {
    return [`${label}: must be ${quote(schema.const)}`];
  }
  if ("enum" in schema && !schema.enum.some((option) => canonical(option) === canonical(value))) {
    return [`${label}: must be one of ${schema.enum.join(" | ")}, found ${quote(value)}`];
  }
  if (schema.visibleContent === true && !hasVisibleContent(value)) {
    errors.push(`${label}: has no visible content`);
  }
  if (typeof value === "string") {
    const points = [...value];
    if ("minLength" in schema && points.length < schema.minLength) {
      errors.push(`${label}: must be at least ${schema.minLength} characters, found ${points.length}`);
    }
    if ("maxLength" in schema && points.length > schema.maxLength) {
      errors.push(`${label}: must be at most ${schema.maxLength} characters, found ${points.length}`);
    }
    if ("pattern" in schema && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push(`${label}: must match ${schema.pattern}, found ${quote(value)}`);
    }
  }
  if (typeof value === "number") {
    if ("minimum" in schema && value < schema.minimum) errors.push(`${label}: must be at least ${schema.minimum}`);
    if ("maximum" in schema && value > schema.maximum) errors.push(`${label}: must be at most ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if ("minItems" in schema && value.length < schema.minItems) {
      errors.push(`${label}: needs at least ${schema.minItems} item(s)`);
    }
    if ("maxItems" in schema && value.length > schema.maxItems) {
      errors.push(`${label}: allows at most ${schema.maxItems} item(s)`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Map();
      value.forEach((item, index) => {
        const key = canonical(item);
        if (seen.has(key)) errors.push(`${label}[${index}]: duplicate of ${label}[${seen.get(key)}]`);
        else seen.set(key, index);
      });
    }
    if ("items" in schema) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${label}[${index}]`));
      });
    }
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${label}: missing "${key}"`);
    }
    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          errors.push(`${label}: unknown property "${safeForMessage(key)}"`);
        }
      }
    }
    for (const [key, subSchema] of Object.entries(properties)) {
      if (!Object.hasOwn(value, key)) continue;
      errors.push(...validateAgainstSchema(value[key], subSchema, `${label}.${key}`));
    }
  }
  if ("oneOf" in schema) {
    const results = schema.oneOf.map((branch) => validateAgainstSchema(value, branch, label));
    const matched = results.filter((branchErrors) => branchErrors.length === 0).length;
    if (matched !== 1) {
      const named = schema.oneOf.map((branch, index) => ({ branch, index, discriminator: discriminatorOf(branch) }))
        .find(({ discriminator }) => discriminator
          && typeOf(value) === "object"
          && canonical(value[discriminator.key]) === canonical(discriminator.value));
      if (named && matched === 0) {
        errors.push(...results[named.index]);
      } else {
        errors.push(`${label}: must match exactly one schema branch; matched ${matched}`);
      }
    }
  }
  return errors;
}
// <<< shared-validator-helpers

// ---------------------------------------------------------------------------
// Handoff semantics
// ---------------------------------------------------------------------------

const LENS_FILE = "references/LENSES.md";

// One parser decides what a LENSES.md section is, for briefs and records
// alike: two copies would let a brief's partition and a record's partition be
// judged against different heading sets. The sibling script ships in this
// skill's own directory, so the import stays inside what install-skills.cjs
// links. It returns null for an unreadable file; the CLI below treats that as
// a check it cannot run.
const { readLensHeadings } = require("./validate-review-record.cjs");

// A reference names a file the reviewer reads at one exact version, or
// carries the text itself when the reviewer's filesystem cannot reach it.
// The positions are listed rather than detected: `scope.candidate
// .content_identity[].path` and `scope.uncommitted[].path` also carry a
// `path` and are identities, not things the reviewer opens.
function collectReferences(brief) {
  const found = [];
  const add = (label, value) => { if (value && typeof value === "object") found.push({ label, value }); };
  add("$.skill", brief.skill);
  for (const key of ["contract_sources", "repository_rules", "review_checklists"]) {
    (brief.authority?.[key] ?? []).forEach((item, index) => add(`$.authority.${key}[${index}]`, item));
  }
  (brief.lenses?.selected ?? []).forEach((item, index) => add(`$.lenses.selected[${index}].reference`, item?.reference));
  (brief.prior_evidence ?? []).forEach((item, index) => add(`$.prior_evidence[${index}]`, item));
  add("$.report.rules", brief.report?.rules);
  add("$.re_review.previous_report", brief.re_review?.previous_report);
  add("$.re_review.responses", brief.re_review?.responses);
  return found;
}

const CONTENT_HASH = /^sha256\s+([0-9a-f]{64})$/iu;

// A revision is either a content hash of the file as it is now, or a Git
// object name the reviewer reads the file at with `git show`. The check
// follows the same two roads: hash the file, or ask Git whether the path
// exists at that object. Existence in the working tree proves neither — a
// brief naming a revision nobody can read passed on that alone.
function revisionProblem(label, reference, root) {
  const resolved = path.isAbsolute(reference.path) ? reference.path : path.join(root, reference.path);
  const hash = CONTENT_HASH.exec(String(reference.revision).trim());
  if (hash) {
    let content;
    try {
      if (!fs.statSync(resolved).isFile()) throw new Error("not a file");
      content = fs.readFileSync(resolved);
    } catch {
      return `${label}: ${quote(reference.path)} is not a readable file; inline its text or fix the path`;
    }
    const actual = crypto.createHash("sha256").update(content).digest("hex");
    if (actual !== hash[1].toLowerCase()) {
      return `${label}: ${quote(reference.path)} does not match its stated content identity; restate the revision or inline the text`;
    }
    return null;
  }
  const relative = path.relative(root, resolved).replace(/\\/gu, "/");
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return `${label}: ${quote(reference.path)} lies outside the repository at ${quote(root)}, so a commit cannot pin it; give its sha256 content identity instead`;
  }
  // `-t` rather than `-e`: an object existing at that path proves nothing
  // when it is a tree, since `git show` then yields a listing, not the text.
  const probe = spawnSync("git", ["-C", root, "cat-file", "-t", `${reference.revision}:${relative}`], { encoding: "utf8" });
  if (probe.error) {
    return `${label}: cannot verify ${quote(reference.path)} at ${quote(reference.revision)}: ${probe.error.message}`;
  }
  if (probe.status !== 0) {
    return `${label}: ${quote(reference.path)} is not readable at revision ${quote(reference.revision)}; fix the revision, or inline the text`;
  }
  const kind = String(probe.stdout).trim();
  if (kind !== "blob") {
    return `${label}: ${quote(reference.path)} is a ${quote(kind)} at revision ${quote(reference.revision)}, not a file; name the file itself`;
  }
  return null;
}

function referenceProblems(label, reference, root) {
  const problems = [];
  const hasPath = Object.hasOwn(reference, "path");
  const hasText = Object.hasOwn(reference, "text");
  if (!hasPath && !hasText) {
    problems.push(`${label}: names neither a readable path nor inlined text`);
    return problems;
  }
  if (hasPath && !Object.hasOwn(reference, "revision")) {
    problems.push(`${label}: a path needs the revision the reviewer reads it at (commit or content identity)`);
    return problems;
  }
  if (hasPath && !hasText && root !== null) {
    const problem = revisionProblem(label, reference, root);
    if (problem) problems.push(problem);
  }
  return problems;
}

function evaluateHandoff(brief, options = {}) {
  const { schema, lensHeadings = null, recordSchema = null, root = null } = options;
  const failures = [];
  const fail = (message) => failures.push(message);

  if (schema) failures.push(...validateAgainstSchema(brief, schema, "$"));

  // The checks below read fields the schema has already typed; when the brief
  // is not even shaped like one, they would report noise on top of the cause.
  if (failures.length === 0) {
    for (const { label, value } of collectReferences(brief)) {
      failures.push(...referenceProblems(label, value, root));
    }

    // The record schema travels inside the brief so the contract the reviewer
    // writes to is the contract the record validator applies; a copy that
    // drifted from the skill's file means one of the two is being lied to.
    if (recordSchema && canonical(brief.report.record_schema) !== canonical(recordSchema)) {
      fail("$.report.record_schema: differs from review-record-schema.json; inline the schema the record will be validated against");
    }

    const selected = brief.lenses.selected.map((item) => item.heading);
    const excluded = brief.lenses.excluded.map((item) => item.heading);
    const seen = new Map();
    [...selected.map((heading) => ["selected", heading]), ...excluded.map((heading) => ["excluded", heading])]
      .forEach(([side, heading]) => {
        if (seen.has(heading)) fail(`$.lenses: ${quote(heading)} appears under ${seen.get(heading)} and ${side}; each section sits on one side`);
        else seen.set(heading, side);
      });
    if (lensHeadings !== null) {
      for (const heading of seen.keys()) {
        if (!lensHeadings.includes(heading)) fail(`$.lenses: ${quote(heading)} is not a section of ${LENS_FILE}`);
      }
      for (const heading of lensHeadings) {
        if (!seen.has(heading)) fail(`$.lenses: ${quote(heading)} appears under neither selected nor excluded; the selection was not made`);
      }
    }

    const surfaces = new Map();
    brief.scope.coverage_plan.forEach((row, index) => {
      const surface = String(row.surface).replace(/\\/gu, "/").trim();
      if (surfaces.has(surface)) fail(`$.scope.coverage_plan[${index}]: surface ${quote(surface)} already has row ${surfaces.get(surface)}`);
      else surfaces.set(surface, index);
    });

    if (brief.review === "re-review" && !Object.hasOwn(brief, "re_review")) {
      fail('$.re_review: a "re-review" carries the prior report and the builder\'s responses');
    }
    if (brief.review === "initial" && Object.hasOwn(brief, "re_review")) {
      fail('$.re_review: an "initial" review has no prior round to carry');
    }
  }

  const capped = failures.length > MAX_FAILURES;
  return {
    pass: failures.length === 0,
    failures: capped ? failures.slice(0, MAX_FAILURES) : failures,
    ...(capped ? { note: `output capped at ${MAX_FAILURES} of ${failures.length} failures` } : {}),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// JSON.parse recurses, so a deeply nested document can exhaust the stack before
// any check runs. The shape is bounded by scanning the text first.
function textLimitProblem(text) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > MAX_DEPTH) return `input nests deeper than ${MAX_DEPTH} levels`;
    } else if (character === "}" || character === "]") depth -= 1;
  }
  return null;
}

function findOversizedArray(value, label) {
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) return `${label}: holds more than ${MAX_ARRAY} items`;
    for (const [index, item] of value.entries()) {
      const problem = findOversizedArray(item, `${label}[${index}]`);
      if (problem) return problem;
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const problem = findOversizedArray(item, `${label}.${key}`);
      if (problem) return problem;
    }
  }
  return null;
}

function readFileBounded(target) {
  const stats = fs.statSync(target);
  if (!stats.isFile()) throw new Error(`not a regular file: ${target}`);
  if (stats.size > MAX_BYTES) throw new Error(`input exceeds ${MAX_BYTES} byte limit: ${target}`);
  return fs.readFileSync(target, "utf8");
}

function readJson(target) {
  const text = target === "-" ? fs.readFileSync(0, "utf8") : readFileBounded(target);
  const problem = textLimitProblem(text);
  if (problem) throw new Error(problem);
  const value = JSON.parse(text);
  const oversized = findOversizedArray(value, "$");
  if (oversized) throw new Error(oversized);
  return value;
}

const USAGE = 'usage: node validate-handoff.cjs <brief.json> [--root <dir>]  ("-" reads the brief from stdin; relative paths resolve against --root, default the current directory)';

function main(argv) {
  const args = [...argv];
  let root = process.cwd();
  const rootAt = args.indexOf("--root");
  if (rootAt !== -1) {
    root = args[rootAt + 1];
    args.splice(rootAt, 2);
  }
  const [target] = args;
  if (!target || !root) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    const skillDir = path.join(__dirname, "..");
    const schema = JSON.parse(readFileBounded(path.join(skillDir, "handoff-schema.json")));
    // The record schema is the contract the inlined copy is compared with. A
    // copy that cannot be read is a check that cannot run, and a check that
    // cannot run exits 2 rather than passing the brief on the checks left.
    const recordSchemaPath = process.env.SCRUTINEER_RECORD_SCHEMA ?? path.join(skillDir, "review-record-schema.json");
    let recordSchema;
    try {
      recordSchema = JSON.parse(readFileBounded(recordSchemaPath));
    } catch (error) {
      throw new Error(`cannot read the record schema at ${recordSchemaPath}: ${error.message}`);
    }
    const lensPath = process.env.SCRUTINEER_LENSES ?? path.join(skillDir, "references", "LENSES.md");
    const lensHeadings = readLensHeadings(lensPath);
    if (lensHeadings === null) {
      throw new Error(`cannot read the lens sections at ${lensPath}; the lens partition cannot be checked (set SCRUTINEER_LENSES to the skill's references/LENSES.md)`);
    }
    const result = evaluateHandoff(readJson(target), {
      schema,
      recordSchema,
      lensHeadings,
      root: path.resolve(root),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

// require.main is a module identity, not a path comparison, so it stays
// correct when the skill is reached through the symlink or junction that
// install-skills.cjs creates.
if (require.main === module) main(process.argv.slice(2));

module.exports = { validateAgainstSchema, readLensHeadings, collectReferences, referenceProblems, revisionProblem, evaluateHandoff, textLimitProblem };
