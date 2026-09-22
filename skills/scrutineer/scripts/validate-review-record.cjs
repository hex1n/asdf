#!/usr/bin/env node

// Check a review record against review-record-schema.json and REPORT.md's rules.
//
// REPORT.md states its contract in prose, and prose is enforced by whoever
// happens to remember it. Most of those rules are cross-field — a verdict
// derived from the entries below it, an F that must quote a line, a coverage
// table that must account for every finding's location — so a reviewer can
// satisfy every sentence individually and still return a report the caller
// cannot reconcile. Those rules are mechanical; this script is that check.
//
// The record is JSON and the prose report is derived from it. That split costs
// a rule — the two must not disagree, which REPORT.md states — and buys the
// three things prose cannot give: `additionalProperties: false`, so an R
// carrying an F's evidence class is a structural error rather than a judgement
// call; a schema file the handoff copies verbatim into the reviewer's prompt,
// so the contract that validates the record is the contract the reviewer was
// given; and arrays instead of delimiters, so no lens list needs a separator
// and no empty list needs a magic word.
//
// What it cannot do is judge evidence. A passing record is well-formed, which
// is the precondition for review, not the review. With `--returned` it also
// compares the record the caller delivers against the one the reviewer
// returned, since the caller is usually the builder the record judges.

const fs = require("node:fs");
const path = require("node:path");

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
// Scrutineer semantics
// ---------------------------------------------------------------------------

const KIND_ORDER = ["finding", "risk", "decision", "optional"];
const LENS_FILE = "references/LENSES.md";

function readLensHeadings(lensPath) {
  // An installed skill may be copied without its references, and a caller may
  // validate a record produced in another checkout. A missing LENSES.md
  // disables the two checks that need it and fails nothing else: the partition
  // rule is a property of that file, and without the file there is no property.
  let text;
  try {
    text = fs.readFileSync(lensPath, "utf8");
  } catch {
    return null;
  }
  const headings = [];
  let inFence = false;
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^##\s+(.+?)\s*$/u);
    if (match) headings.push(match[1].trim());
  }
  return headings;
}

// Reports are authored on every platform this skill runs on. A Windows
// reviewer records `src\api\foo.ts` for the same file a `src/` surface covers,
// so separators are folded before any comparison rather than rejected: failing
// an honest path would teach reviewers to distrust the gate.
function normalizePath(value) {
  return String(value).replace(/\\/gu, "/").trim();
}

function pathProblem(value) {
  const filePath = normalizePath(value);
  if (filePath === "") return "is empty";
  if (filePath.startsWith("/")) return `must be repository-relative, not absolute: ${quote(filePath)}`;
  if (/^[A-Za-z]:/u.test(filePath)) return `must be repository-relative, not a drive path: ${quote(filePath)}`;
  if (filePath.startsWith("~")) return `must be repository-relative, not home-anchored: ${quote(filePath)}`;
  for (const character of filePath) {
    if (isControlCodePoint(character.codePointAt(0))) return "must not contain control characters";
  }
  const segments = filePath.split("/");
  if (segments.some((segment) => segment === "..")) return `must not traverse out of the repository: ${quote(filePath)}`;
  if (segments.some((segment, index) => segment === "" && index !== segments.length - 1)) {
    return `must not contain an empty path segment: ${quote(filePath)}`;
  }
  if (segments.some((segment) => segment !== segment.replace(/[ .]+$/u, "") && segment !== "." && segment !== "..")) {
    return `must not end a path segment with a space or dot: ${quote(filePath)}`;
  }
  return null;
}

// A directory surface covers the files beneath it. Matching is on segment
// boundaries so `src/apiv2/x.ts` is not covered by a `src/api` surface.
function covers(surface, filePath) {
  if (surface === filePath) return true;
  const prefix = surface.endsWith("/") ? surface : `${surface}/`;
  return filePath.startsWith(prefix);
}

function entryOrderKey(entry) {
  const kindIndex = KIND_ORDER.indexOf(entry?.kind);
  const number = Number(String(entry?.id ?? "").slice(1));
  return [kindIndex < 0 ? KIND_ORDER.length : kindIndex, Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER];
}

function evaluateRecord(record, options = {}) {
  const { schema, previous = null, lensHeadings = null } = options;
  const failures = [];
  const fail = (message) => failures.push(message);

  if (schema) failures.push(...validateAgainstSchema(record, schema, "$"));
  if (schema && previous) failures.push(...validateAgainstSchema(previous, schema, "$previous"));

  // Every semantic check below reads fields the schema has already typed. When
  // the record is not even shaped like a record, those reads would report
  // noise on top of the real cause, so the structural pass gates them.
  if (failures.length === 0) {
    const entries = record.entries ?? [];
    const coverage = record.coverage ?? {};
    const surfaces = coverage.surfaces ?? [];

    const seenIds = new Map();
    entries.forEach((entry, index) => {
      if (seenIds.has(entry.id)) {
        fail(`$.entries[${index}]: duplicate id ${entry.id}, already used at $.entries[${seenIds.get(entry.id)}]`);
      } else {
        seenIds.set(entry.id, index);
      }
    });

    // Sorted entries make two rounds of the same review diffable, which is the
    // point of stable ids: a caller reconciling round 2 against round 1 reads a
    // diff, not two differently ordered lists.
    const sorted = [...entries].sort((left, right) => {
      const [leftKind, leftNumber] = entryOrderKey(left);
      const [rightKind, rightNumber] = entryOrderKey(right);
      return leftKind - rightKind || leftNumber - rightNumber;
    });
    const orderMismatch = entries.findIndex((entry, index) => entry !== sorted[index]);
    if (orderMismatch !== -1) {
      fail(`$.entries: must be sorted by kind (${KIND_ORDER.join(", ")}) then id number; $.entries[${orderMismatch}] is out of order`);
    }

    const findings = entries.filter((entry) => entry.kind === "finding");
    const risks = entries.filter((entry) => entry.kind === "risk");
    const credibleRisks = risks.filter((entry) => entry.severity === "critical" || entry.severity === "high");

    if (record.mode?.context === "blocked" && record.verdict !== "blocked") {
      fail('$.verdict: mode.context "blocked" requires verdict "blocked"; findings remain in entries');
    }

    if (record.verdict === "accept-scoped") {
      if (findings.length > 0) {
        fail(`$.verdict: "accept-scoped" contradicts ${findings.length} confirmed finding(s): ${findings.map((entry) => entry.id).join(", ")}`);
      }
      if (credibleRisks.length > 0) {
        fail(`$.verdict: "accept-scoped" contradicts unverified high-impact risk(s): ${credibleRisks.map((entry) => entry.id).join(", ")}`);
      }
    }
    if (record.verdict === "needs-attention" && findings.length === 0 && credibleRisks.length === 0) {
      fail('$.verdict: "needs-attention" needs a confirmed finding or a critical/high unverified risk');
    }
    // A blocked review has to say what blocked it; otherwise `blocked` is an
    // unexplained non-answer that no caller can act on.
    if (record.verdict === "blocked" && (coverage.limits ?? []).length === 0) {
      fail('$.coverage.limits: a "blocked" verdict needs the limit that blocked the review');
    }

    const inDepth = [];
    const shallow = new Map();
    const seenSurfaces = new Map();
    surfaces.forEach((row, index) => {
      const problem = pathProblem(row.surface);
      // A surface may name a contract or a module rather than a path, so only
      // a path-shaped surface is path-checked; an absolute one is a mistake in
      // any reading.
      if (problem && /^[/~]|^[A-Za-z]:|\.\./u.test(normalizePath(row.surface))) {
        fail(`$.coverage.surfaces[${index}].surface: ${problem}`);
      }
      const surface = normalizePath(row.surface);
      if (seenSurfaces.has(surface)) {
        fail(`$.coverage.surfaces[${index}]: surface ${quote(surface)} already has row ${seenSurfaces.get(surface)}`);
      } else {
        seenSurfaces.set(surface, index);
      }
      if (row.depth === "in-depth") inDepth.push(surface);
      else shallow.set(surface, row.depth);
    });

    for (const entry of entries) {
      if (!entry.location) continue;
      const problem = pathProblem(entry.location.file);
      if (problem) {
        fail(`$.entries: ${entry.id} location.file ${problem}`);
        continue;
      }
      const filePath = normalizePath(entry.location.file);
      if (inDepth.some((surface) => covers(surface, filePath))) continue;
      const shallowMatch = [...shallow.entries()].find(([surface]) => covers(surface, filePath));
      if (shallowMatch) {
        fail(`$.entries: ${entry.id} locates ${quote(filePath)} in a "${shallowMatch[1]}" coverage surface ${quote(shallowMatch[0])}; an entry with a location needs that surface "in-depth"`);
      } else {
        fail(`$.entries: ${entry.id} locates ${quote(filePath)} in no coverage surface`);
      }
    }

    const applied = coverage.lenses_applied ?? [];
    const excluded = (coverage.lenses_excluded ?? []).map((item) => item.lens);
    const seenExcluded = new Set();
    excluded.forEach((lens, index) => {
      if (seenExcluded.has(lens)) fail(`$.coverage.lenses_excluded[${index}]: lens ${quote(lens)} is listed twice`);
      seenExcluded.add(lens);
    });
    for (const lens of applied) {
      if (excluded.includes(lens)) fail(`$.coverage: lens ${quote(lens)} is both applied and excluded`);
    }
    if (lensHeadings !== null) {
      for (const lens of [...applied, ...excluded]) {
        if (!lensHeadings.includes(lens)) fail(`$.coverage: lens ${quote(lens)} is not a section of ${LENS_FILE}`);
      }
      const accounted = new Set([...applied, ...excluded]);
      for (const heading of lensHeadings) {
        if (!accounted.has(heading)) fail(`$.coverage: lens ${quote(heading)} appears under neither lenses_applied nor lenses_excluded`);
      }
    }

    const reReview = record.re_review ?? [];
    if (record.round > 1 && !previous) {
      fail("$: a re-review needs the previous record to check prior ids and open obligations");
    }
    if (record.round === 1 && (previous || reReview.length > 0)) {
      fail("$.round: a first-round record has no previous record or re-review rows");
    }
    // The previous active ids below determine which rows are owed. A clean
    // preceding review has none; requiring a made-up row would block it.
    const reReviewIds = new Map();
    reReview.forEach((row, index) => {
      if (reReviewIds.has(row.id)) {
        fail(`$.re_review[${index}]: id ${row.id} already has row ${reReviewIds.get(row.id)}`);
      } else {
        reReviewIds.set(row.id, index);
      }
      const currentId = row.current_id ?? row.id;
      const current = entries.find((entry) => entry.id === currentId);
      const closed = row.reviewer_status === "resolved" || row.reviewer_status === "refuted";
      if (row.reviewer_status === "resolved" && (row.fact_status !== "confirmed" || row.builder_action !== "repaired")) {
        fail(`$.re_review[${index}]: "resolved" requires a confirmed issue, a repaired action, and the new revision's evidence`);
      }
      if ((row.reviewer_status === "refuted") !== (row.fact_status === "refuted")) {
        fail(`$.re_review[${index}]: a refuted fact and a refuted reviewer status must agree`);
      }
      if (row.reviewer_status === "still present" && row.fact_status !== "confirmed") {
        fail(`$.re_review[${index}]: "still present" requires fact_status "confirmed"`);
      }
      if (!closed && !current) {
        fail(`$.entries: unresolved prior ${row.id} must remain an entry; omission cannot close it`);
      }
      if (closed && (current || row.current_id !== undefined)) {
        fail(`$.entries: closed prior ${row.id} belongs in re_review, not the current open entries or an alias`);
      }
      if (!closed && current && current.kind === "optional" && !row.id.startsWith("O")) {
        fail(`$.re_review[${index}]: an unresolved material item cannot become optional`);
      }
      // Reclassification preserves the stated fact: a risk has an unchecked
      // premise, while findings and decisions carry established evidence.
      if (!closed && current?.kind === "risk" && row.fact_status !== "unverified") {
        fail(`$.re_review[${index}]: an active risk requires fact_status "unverified"; a confirmed issue cannot be hidden as a risk`);
      }
      if (!closed && current && ["finding", "decision"].includes(current.kind) && row.fact_status !== "confirmed") {
        fail(`$.re_review[${index}]: an active ${current.kind} requires fact_status "confirmed"; an unchecked premise remains a risk`);
      }
      // REPORT.md: `deferred` keeps `confirmed` and its owner and grants no
      // acceptance. A deferred row reading `resolved` is the exact laundering
      // that rule exists to stop.
      if (row.builder_action === "deferred") {
        if (row.fact_status !== "confirmed") {
          fail(`$.re_review[${index}]: a "deferred" builder_action keeps fact_status "confirmed"`);
        }
        if (row.reviewer_status === "resolved") {
          fail(`$.re_review[${index}]: a "deferred" builder_action grants no acceptance, so reviewer_status is not "resolved"`);
        }
      }
    });

    if (previous) {
      if (record.review_series !== previous.review_series) {
        fail("$.review_series: re-review must continue the previous record's series");
      }
      if (record.round !== previous.round + 1) {
        fail("$.round: re-review must follow the previous record's round");
      }
      const previousEntries = (previous.entries ?? []).filter((entry) => entry.kind !== "optional");
      const priorIds = new Set([...(previous.entries ?? []), ...(previous.re_review ?? [])].map((entry) => entry.id));
      for (const row of reReview) {
        if (!priorIds.has(row.id)) fail(`$.re_review: ${row.id} is not an entry in the previous record`);
      }
      for (const entry of previousEntries) {
        if (!reReviewIds.has(entry.id)) {
          fail(`$.re_review: prior ${entry.id} has no row; the builder answers every identifier`);
        }
      }
      // Reuse is only detectable through the title: an id carrying a different
      // title in the new record, with no re-review row tying it to the prior
      // entry, is a new concern wearing an old id. A renamed-but-answered
      // entry keeps its row and is not reported here.
      const currentTitles = new Map(entries.map((entry) => [entry.id, entry.title]));
      for (const entry of previousEntries) {
        const currentTitle = currentTitles.get(entry.id);
        if (currentTitle === undefined) continue;
        if (currentTitle !== entry.title && !reReviewIds.has(entry.id)) {
          fail(`$.entries: ${entry.id} reuses a prior id for a different entry; a new entry takes a new id`);
        }
      }
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
// Delivered record
//
// The reviewer returns a record; the caller, usually the builder whose work
// it judges, delivers one. REPORT.md lets the caller change three things on
// the way: replace `mode.host_evidence` with the verified launch facts,
// append its own `checks_run` rows under a `caller:` prefix, and set verdict
// and `mode.context` to `blocked` with the isolation gap appended to
// `limits`. A limit removed or a sentence softened is a fourth change nobody
// sanctioned, and it is invisible unless the returned record is kept and
// compared.
// ---------------------------------------------------------------------------

const CALLER_PREFIX = /^caller:/iu;
const PENDING = /^\s*pending\b/iu;

function deliveryProblems(delivered, returned) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const same = (left, right) => canonical(left) === canonical(right);
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  if (!isObject(delivered) || !isObject(returned)) return ["$: both the delivered and the returned record must be objects"];

  // What licenses the isolation change is the delivered record's state, not
  // the returned one's: a reviewer that already returned `blocked` for its
  // own reason can still be delivered with the caller's isolation gap added.
  const blocking = delivered.verdict === "blocked";
  if (delivered.verdict !== returned.verdict && !blocking) {
    fail(`$.verdict: ${quote(returned.verdict)} became ${quote(delivered.verdict)}; the caller may only demote a verdict to "blocked"`);
  }

  for (const key of new Set([...Object.keys(delivered), ...Object.keys(returned)])) {
    if (key === "verdict" || key === "mode" || key === "coverage") continue;
    if (!same(delivered[key], returned[key])) fail(`$.${key}: differs from the returned record`);
  }

  const deliveredMode = isObject(delivered.mode) ? delivered.mode : {};
  const returnedMode = isObject(returned.mode) ? returned.mode : {};
  const contextBlocked = blocking && deliveredMode.context === "blocked";
  for (const key of new Set([...Object.keys(deliveredMode), ...Object.keys(returnedMode)])) {
    if (key === "host_evidence") continue;
    if (key === "context" && contextBlocked) continue;
    if (!same(deliveredMode[key], returnedMode[key])) fail(`$.mode.${key}: differs from the returned record`);
  }
  if (blocking && returned.verdict !== "blocked" && deliveredMode.context !== "blocked") {
    fail('$.mode.context: a verdict demoted to "blocked" carries mode.context "blocked"');
  }
  // HANDOFF.md lets a reviewer return this marker when the host receipt
  // arrives after dispatch; delivering it unreplaced is the caller skipping
  // the isolation check the marker exists to hand over.
  if (PENDING.test(String(deliveredMode.host_evidence ?? ""))) {
    fail("$.mode.host_evidence: still pending caller verification; replace it with what the caller observed, a missing receipt included");
  }

  const deliveredCoverage = isObject(delivered.coverage) ? delivered.coverage : {};
  const returnedCoverage = isObject(returned.coverage) ? returned.coverage : {};
  for (const key of new Set([...Object.keys(deliveredCoverage), ...Object.keys(returnedCoverage)])) {
    if (key === "checks_run" || key === "limits") continue;
    if (!same(deliveredCoverage[key], returnedCoverage[key])) fail(`$.coverage.${key}: differs from the returned record`);
  }

  const appendedOnly = (key, allowAppend, describe) => {
    const before = Array.isArray(returnedCoverage[key]) ? returnedCoverage[key] : [];
    const after = Array.isArray(deliveredCoverage[key]) ? deliveredCoverage[key] : [];
    // The returned rows are a prefix of the delivered ones. A removed row
    // shifts everything after it, so the first mismatch is the finding and
    // the rest of the array is reported no further.
    const mismatch = before.findIndex((item, index) => !same(after[index], item));
    if (mismatch !== -1) {
      fail(`$.coverage.${key}[${mismatch}]: the returned ${describe} was changed or removed`);
      return;
    }
    after.slice(before.length).forEach((item, offset) => {
      const problem = allowAppend(item);
      if (problem) fail(`$.coverage.${key}[${before.length + offset}]: ${problem}`);
    });
  };
  appendedOnly("checks_run", (row) => (CALLER_PREFIX.test(String(row?.command ?? "")) ? null : 'an appended row is the caller\'s and says so: its command starts with "caller:"'), "row");
  appendedOnly("limits", () => (contextBlocked ? null : 'a limit is appended only with verdict and mode.context "blocked", naming the isolation gap'), "limit");
  const moved = delivered.verdict !== returned.verdict || deliveredMode.context !== returnedMode.context;
  if (moved && (deliveredCoverage.limits ?? []).length <= (returnedCoverage.limits ?? []).length) {
    fail('$.coverage.limits: a verdict or mode.context moved to "blocked" appends the isolation gap that blocked it');
  }
  return failures;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// JSON.parse recurses, so a deeply nested document can exhaust the stack before
// any check runs. The shape is bounded by scanning the text first, which costs
// one pass and cannot itself overflow.
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

function readRecord(target) {
  const text = target === "-" ? fs.readFileSync(0, "utf8") : readFileBounded(target);
  const problem = textLimitProblem(text);
  if (problem) throw new Error(problem);
  const record = JSON.parse(text);
  const oversized = findOversizedArray(record, "$");
  if (oversized) throw new Error(oversized);
  return record;
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
  // O_NOFOLLOW is not portable to Windows, where this skill runs as often as
  // anywhere, so the input is bounded by size and type instead of by open flag.
  const stats = fs.statSync(target);
  if (!stats.isFile()) throw new Error(`not a regular file: ${target}`);
  if (stats.size > MAX_BYTES) throw new Error(`input exceeds ${MAX_BYTES} byte limit: ${target}`);
  return fs.readFileSync(target, "utf8");
}

const USAGE = 'usage: node validate-review-record.cjs <report.json> [<previous-report.json>] [--returned <returned-report.json>]  ("-" reads the record from stdin; --returned compares a delivered record with the one the reviewer returned)';

function main(argv) {
  const args = [...argv];
  let returnedTarget = null;
  const returnedAt = args.indexOf("--returned");
  if (returnedAt !== -1) {
    returnedTarget = args[returnedAt + 1];
    args.splice(returnedAt, 2);
  }
  const [target, previousTarget] = args;
  if (!target || (returnedAt !== -1 && !returnedTarget)) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    const skillDir = path.join(__dirname, "..");
    const schema = JSON.parse(readFileBounded(path.join(skillDir, "review-record-schema.json")));
    const lensPath = process.env.SCRUTINEER_LENSES ?? path.join(skillDir, "references", "LENSES.md");
    const record = readRecord(target);
    const result = evaluateRecord(record, {
      schema,
      previous: previousTarget ? readRecord(previousTarget) : null,
      lensHeadings: readLensHeadings(lensPath),
    });
    if (returnedTarget) {
      const delivery = deliveryProblems(record, readRecord(returnedTarget));
      result.failures.push(...delivery);
      result.pass = result.failures.length === 0;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

// require.main is a module identity, not a path comparison, so it stays
// correct when the skill is reached through the symlink or junction that
// install-skills.cjs creates — and on Windows, where drive-letter casing and
// MSYS path translation make any argv-versus-module-URL comparison unreliable.
// Getting that wrong exits 0 having checked nothing, the worst failure a gate
// has available.
if (require.main === module) main(process.argv.slice(2));

module.exports = { hasVisibleContent, safeForMessage, validateAgainstSchema, readLensHeadings, normalizePath, pathProblem, evaluateRecord, deliveryProblems, textLimitProblem };
