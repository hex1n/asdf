#!/usr/bin/env node

// Validate an agent-authored review ledger against review-ledger-schema.json and the
// Exact Gate in SKILL.md.
//
// The schema owns the structural layer: which fields exist, their types, and
// the closed vocabularies. It is a separate file rather than constants here
// because it has two consumers — this script interprets it, and REFERENCE.md's
// round-receipt block hands the same field list to the agent that must emit
// one. A vocabulary that lives only in this file is a vocabulary the author
// was never given.
//
// Everything the schema cannot express stays below: receipt-to-report-to-finding
// binding, receipt ordering (a diagnostic follows the FAILED second-model
// invocation it probes; a recovery follows the diagnostic), payload-to-ledger
// field equality, and the gate conditions themselves.

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "review-ledger-schema.json"),
  "utf8",
));

const RECEIPT_SCHEMA = SCHEMA.properties.round_receipts.items;
const FINDING_SCHEMA = SCHEMA.properties.findings.items;

// Only the vocabularies this file still reasons with survive here, and each is
// read from the schema rather than restated: a vocabulary written twice drifts
// on the first edit that remembers only one copy. The rest — review kinds,
// reviewer roles, independence levels, precisions, depths, budget sources —
// are now enforced where they are declared, and naming them again here would
// be the second copy.
const VALID_DISPOSITIONS = new Set(FINDING_SCHEMA.properties.disposition.enum);
const VALID_RECEIPT_VERDICTS = new Set(RECEIPT_SCHEMA.properties.verdict.enum);
const COST_FIELDS = RECEIPT_SCHEMA.required.filter((field) => field.endsWith("_characters")
  || ["model_calls", "wall_clock_ms", "physical_sessions", "retries"].includes(field));

// The subset of verdicts that mean the reviewer actually returned something.
const RETURNED_VERDICTS = new Set(["GO", "CONDITIONAL-GO", "NO-GO"]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function identityString(value) {
  return nonEmptyString(value) && value === value.trim();
}

function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}

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

function evaluateReviewLedger(ledger) {
  const failures = [];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    return { pass: false, failures: ["review ledger must be a JSON object"] };
  }

  // The schema owns structure; every check below reads fields it has already
  // typed and vocabularies it has already closed. Running it first and
  // returning on failure keeps one missing field from producing a page of
  // downstream noise that buries its own cause.
  const structural = validateAgainstSchema(ledger, SCHEMA, "$");
  if (structural.length > 0) return { pass: false, failures: structural };

  // The returned-verdict subset is a semantic distinction the schema cannot
  // make, so it is written here — and pinned to the schema, because a verdict
  // renamed there while this set kept the old spelling would silently stop
  // matching any receipt and quietly skip every report check below.
  for (const verdict of RETURNED_VERDICTS) {
    if (!VALID_RECEIPT_VERDICTS.has(verdict)) {
      failures.push(`schema drift: "${verdict}" is no longer a receipt verdict`);
    }
  }

  const revision = ledger.current_revision;
  const requiredRubric = [...ledger.required_rubric_dimensions].sort();

  const required = ledger.required_reviewers;
  if (required.some((reviewer) => !identityString(reviewer))) {
    failures.push("every required reviewer needs a non-empty identity without surrounding whitespace");
  }
  if (!identityString(ledger.author_identity)) {
    failures.push("author_identity must be a non-empty identity without surrounding whitespace");
  } else if (required.includes(ledger.author_identity)) {
    failures.push("author identity cannot be a required reviewer");
  }

  const explicitSecondModel = ledger.explicit_second_model_reviewers;
  if (explicitSecondModel.some((reviewer) => !identityString(reviewer))) {
    failures.push("every explicit second-model reviewer needs a non-empty identity without surrounding whitespace");
  }
  for (const reviewer of explicitSecondModel) {
    if (!required.includes(reviewer)) {
      failures.push(`explicit second-model reviewer is not required: ${reviewer}`);
    }
  }

  const verdicts = ledger.final_reviewer_verdicts;
  if (verdicts.length !== required.length) failures.push("final_reviewer_verdicts must contain exactly the required reviewers");
  if (verdicts.some((item) => !identityString(item?.reviewer))) {
    failures.push("every final reviewer verdict needs an identity without surrounding whitespace");
  }
  if (new Set(verdicts.map((item) => item?.reviewer)).size !== verdicts.length ||
      verdicts.some((item) => !required.includes(item?.reviewer) || item?.revision !== revision)) {
    failures.push("every final reviewer verdict must uniquely name a required reviewer on the current revision");
  }
  for (const reviewer of required) {
    const current = verdicts.filter((item) => item?.reviewer === reviewer && item?.revision === revision);
    if (current.length !== 1) {
      failures.push(`required reviewer ${reviewer} needs exactly one closing verdict on the current revision`);
    } else if (current[0].verdict !== "GO") {
      failures.push(`required reviewer ${reviewer} has a non-GO closing verdict on the current revision`);
    } else if (current[0].review_kind !== "complete") {
      failures.push(`required reviewer ${reviewer} has no complete review on the current revision`);
    }
  }

  const findings = ledger.findings;
  for (const id of duplicates(findings.map((finding) => finding.id))) {
    failures.push(`duplicate finding ID: ${id}`);
  }

  for (const finding of findings) {
    const id = finding.id;
    if (finding?.severity === "verification_gap" && !nonEmptyString(finding?.missing_check)) {
      failures.push(`${id} verification gap has no missing check`);
    }
    if (finding?.parent_validation_disclosed !== true) {
      failures.push(`${id} parent validation was not disclosed`);
    }
    if (finding?.validation === "needs_evidence") failures.push(`${id} still needs evidence`);
    if (finding?.severity !== "verification_gap" &&
        finding?.validation === "confirmed" && finding?.disposition === "fix" &&
        finding?.closed === true && finding?.revision === revision) {
      failures.push(`${id} cannot be fixed without a new revision`);
    }
    if (finding?.validation === "challenged") {
      if (finding?.disposition !== "rebut" || finding?.reviewer_rebuttal_accepted !== true) {
        failures.push(`${id} is challenged but the reviewer has not accepted the rebuttal`);
      }
    }
    if (finding?.severity === "blocker" || finding?.severity === "should_fix") {
      if (finding?.closed !== true) failures.push(`open ${finding.severity}: ${id}`);
      if (finding?.disposition === "accept-risk") failures.push(`${id} cannot close through accept-risk`);
      const awaitingInput = finding?.disposition === "needs-input" && finding?.closed !== true;
      if (finding?.validation === "confirmed" && finding?.disposition !== "fix" && !awaitingInput) {
        failures.push(`${id} confirmed ${finding.severity} must use fix`);
      }
    }
    if (finding?.severity === "optional") {
      if (!VALID_DISPOSITIONS.has(finding?.disposition)) failures.push(`optional ${id} has no disposition`);
      if (finding?.validation === "confirmed" && !["fix", "accept-risk"].includes(finding?.disposition)) {
        failures.push(`${id} confirmed optional has invalid disposition`);
      }
      if (finding?.closed !== true) failures.push(`optional ${id} is not closed`);
    }
    if (finding?.severity === "verification_gap") {
      if (!["decision_blocking", "outside_closing_scope"].includes(finding?.gap_scope)) {
        failures.push(`${id} verification gap has invalid gap scope`);
      }
      if (!nonEmptyString(finding?.gap_scope_reason)) failures.push(`${id} verification gap has no scope reason`);
      if (finding?.closed !== true) failures.push(`verification gap ${id} is not dispositioned`);
    }
  }

  const active = ledger.active_reviewer_invocations;
  if (active.length > 0) failures.push(`active reviewer invocations remain: ${active.join(", ")}`);
  if (ledger.material_change_after_go !== false) failures.push("material change happened after GO");

  const attempts = ledger.attempted_invocations;
  const receipts = ledger.round_receipts;
  const reports = ledger.round_reports;
  const receiptIds = receipts.map((receipt) => receipt.invocation_id);
  for (const id of duplicates(attempts)) failures.push(`duplicate attempted invocation: ${id}`);
  for (const id of duplicates(receiptIds)) failures.push(`duplicate round receipt: ${id}`);
  for (const attempt of attempts) {
    if (!receiptIds.includes(attempt)) failures.push(`attempted invocation ${attempt} has no round receipt`);
  }
  for (const receiptId of receiptIds) {
    if (!attempts.includes(receiptId)) failures.push(`round receipt ${receiptId} has no attempted invocation`);
  }
  for (const receipt of receipts) {
    const id = receipt.invocation_id;
    if (!identityString(receipt?.reviewer)) {
      failures.push(`${id} receipt reviewer needs an identity without surrounding whitespace`);
    }
    if (receipt?.reviewer_role === "required" && !required.includes(receipt?.reviewer)) {
      failures.push(`${id} required reviewer receipt is not in the frozen required_reviewers`);
    }
    if (required.includes(receipt?.reviewer)) {
      const selectedSecondModel = explicitSecondModel.includes(receipt.reviewer);
      if (selectedSecondModel && receipt?.independence_level === "second-model" &&
          receipt?.reviewer_role !== "required") {
        failures.push(`${id} second-model invocation must use the required reviewer role`);
      }
      if (selectedSecondModel && receipt?.independence_level === "fresh-context" &&
          receipt?.reviewer_role !== "diagnostic") {
        failures.push(`${id} fresh-context fallback must use the diagnostic reviewer role`);
      }
    }
    if (receipt?.reviewer_role === "diagnostic") {
      const sourceId = receipt?.diagnostic_for_invocation_id;
      const receiptIndex = receipts.indexOf(receipt);
      const sourceIndex = receipts.findIndex((candidate) => candidate?.invocation_id === sourceId);
      const source = sourceIndex >= 0 ? receipts[sourceIndex] : null;
      if (!required.includes(receipt?.reviewer) || !explicitSecondModel.includes(receipt.reviewer) ||
          receipt?.independence_level !== "fresh-context") {
        failures.push(`${id} diagnostic fallback must belong to a frozen second-model reviewer`);
      }
      if (!nonEmptyString(sourceId) || sourceIndex < 0 || sourceIndex >= receiptIndex ||
          source?.reviewer !== receipt?.reviewer || source?.reviewer_role !== "required" ||
          source?.independence_level !== "second-model" ||
          !["FAILED", "TIMED-OUT"].includes(source?.verdict)) {
        failures.push(`${id} diagnostic fallback must link to an earlier unavailable second-model invocation`);
      }
    }
    // The schema admits zero for every cost field, because a cancelled or
    // failed invocation legitimately spent nothing. A verdict the reviewer
    // actually returned did not: zero there means the measurement is missing,
    // not that the work was free. `retries` is the one field a real round may
    // leave at zero.
    if (RETURNED_VERDICTS.has(receipt.verdict)) {
      for (const field of COST_FIELDS.filter((name) => name !== "retries")) {
        if (!(receipt[field] > 0)) failures.push(`${id} returned verdict requires positive ${field}`);
      }
    }
  }

  for (const reviewer of explicitSecondModel) {
    const diagnostics = receipts.filter((receipt) =>
      receipt?.reviewer === reviewer && receipt?.reviewer_role === "diagnostic");
    if (diagnostics.length > 1) {
      failures.push(`frozen second-model reviewer ${reviewer} has more than one diagnostic fallback`);
    }
    if (diagnostics.length > 0) {
      // A diagnostic probes an unavailable reviewer; it never substitutes for it.
      // The gate reopens only when that reviewer really returns: a second-model
      // complete GO closing the current revision, recorded after the diagnostic
      // in receipt order — a pre-diagnostic GO is the close the diagnostic put
      // in doubt, not a recovery from it. An unconditional block would punish
      // recovery and push the parent toward discarding the ledger.
      const lastDiagnosticIndex = Math.max(...diagnostics.map((item) => receipts.indexOf(item)));
      const recovered = verdicts.some((verdict) => {
        if (verdict?.reviewer !== reviewer || verdict?.revision !== revision) return false;
        const closingIndex = receipts.findIndex((item) => item?.invocation_id === verdict?.invocation_id);
        const closing = closingIndex > lastDiagnosticIndex ? receipts[closingIndex] : null;
        return closing?.independence_level === "second-model" && closing?.review_kind === "complete" &&
          closing?.verdict === "GO" && closing?.revision_hash === revision;
      });
      if (!recovered) {
        failures.push(`diagnostic fallback for ${reviewer} keeps the gate unpassed until a second-model complete GO closes the current revision`);
      }
    }
  }

  for (const receipt of receipts) {
    if (!RETURNED_VERDICTS.has(receipt?.verdict)) continue;
    const matches = reports.filter((report) => report?.invocation_id === receipt.invocation_id);
    if (matches.length !== 1) {
      failures.push(`${receipt.invocation_id} needs exactly one returned round report`);
      continue;
    }
    const report = matches[0];
    if (report.revision_hash !== receipt.revision_hash || report.verdict !== receipt.verdict ||
        report.review_kind !== receipt.review_kind) {
      failures.push(`${receipt.invocation_id} round report does not match its receipt`);
    }
    if (report.reviewer_output_disclosed !== true) {
      failures.push(`${receipt.invocation_id} reviewer output was not disclosed`);
    }
    for (const id of duplicates(report.finding_ids)) {
      failures.push(`${receipt.invocation_id} round report has duplicate finding ID: ${id}`);
    }
    if (["NO-GO", "CONDITIONAL-GO"].includes(report.verdict) && report.finding_ids.length === 0) {
      failures.push(`${receipt.invocation_id} non-GO verdict requires at least one finding`);
    }
    {
      const payloadIds = report.finding_payloads.map((finding) => finding?.id);
      if (JSON.stringify(payloadIds) !== JSON.stringify(report.finding_ids)) {
        failures.push(`${receipt.invocation_id} finding payload IDs do not match finding_ids`);
      }
      for (const payload of report.finding_payloads) {
        if (payload?.severity === "verification_gap" && !nonEmptyString(payload?.missing_check)) {
          failures.push(`${receipt.invocation_id} verification-gap payload has no missing check`);
        }
        if (payload?.severity === "verification_gap" &&
            (!['decision_blocking', 'outside_closing_scope'].includes(payload?.gap_scope) ||
             !nonEmptyString(payload?.gap_scope_reason))) {
          failures.push(`${receipt.invocation_id} verification-gap payload has invalid scope evidence`);
        }
      }
      if (receipt.review_kind === "blocker-sweep" &&
          report.finding_payloads.some((finding) => !["blocker", "verification_gap"].includes(finding?.severity))) {
        failures.push(`${receipt.invocation_id} blocker-sweep report contains a deferred severity`);
      }
      if (report.verdict === "GO" &&
          report.finding_payloads.some((finding) => ["blocker", "should_fix"].includes(finding?.severity))) {
        failures.push(`${receipt.invocation_id} GO report contains blocker or should-fix findings`);
      }
      if (report.verdict === "GO" && receipt.review_kind === "blocker-sweep" &&
          report.finding_payloads.some((finding) => finding?.severity === "verification_gap" &&
            finding?.gap_scope === "decision_blocking")) {
        failures.push(`${receipt.invocation_id} blocker-sweep GO contains a decision-blocking gap`);
      }
    }
    if (["blocker-sweep", "complete"].includes(receipt.review_kind)) {
      const rubric = Array.isArray(report?.coverage?.rubric_dimensions)
        ? report.coverage.rubric_dimensions : [];
      const severities = Array.isArray(report?.coverage?.severities)
        ? report.coverage.severities : [];
      if (new Set(rubric).size !== rubric.length || new Set(severities).size !== severities.length) {
        failures.push(`${receipt.invocation_id} coverage must not contain duplicates`);
      }
      const expectedSeverities = receipt.review_kind === "blocker-sweep"
        ? ["blocker", "verification_gap"]
        : ["blocker", "optional", "should_fix", "verification_gap"];
      if (JSON.stringify([...rubric].sort()) !== JSON.stringify(requiredRubric) ||
          JSON.stringify([...severities].sort()) !== JSON.stringify([...expectedSeverities].sort())) {
        failures.push(`${receipt.invocation_id} lacks required ${receipt.review_kind} coverage`);
      }
    }
  }
  for (const report of reports) {
    const receipt = receipts.filter((item) => item?.invocation_id === report?.invocation_id);
    if (receipt.length !== 1 || !RETURNED_VERDICTS.has(receipt[0]?.verdict)) {
      failures.push(`round report ${report?.invocation_id ?? "<missing-invocation>"} has no returned-verdict receipt`);
      continue;
    }
    for (const id of report.finding_ids) {
      const matches = findings.filter((finding) => finding?.id === id && finding?.source_invocation_id === report.invocation_id);
      if (matches.length !== 1) failures.push(`${report.invocation_id} manifest finding ${id} must map to exactly one ledger finding`);
      const payload = Array.isArray(report.finding_payloads) ? report.finding_payloads.find((item) => item?.id === id) : null;
      if (matches.length === 1 && payload) {
        for (const field of ["severity", "claim", "evidence", "affected_section", "missing_check", "gap_scope", "gap_scope_reason"]) {
          if ((matches[0][field] ?? null) !== (payload[field] ?? null)) {
            failures.push(`${report.invocation_id} payload for ${id} does not match the ledger`);
          }
        }
      }
    }
  }
  for (const finding of findings) {
    if (!nonEmptyString(finding?.source_invocation_id)) continue;
    const matches = reports.filter((report) => report?.invocation_id === finding.source_invocation_id &&
      Array.isArray(report?.finding_ids) && report.finding_ids.includes(finding.id));
    if (matches.length !== 1) failures.push(`${finding.id} must map back to exactly one source round report`);
  }

  for (const finding of findings) {
    if (!nonEmptyString(finding?.source_invocation_id)) continue;
    const source = receipts.filter((receipt) => receipt?.invocation_id === finding.source_invocation_id);
    if (source.length !== 1) continue;
    if (source[0].revision_hash !== finding.revision) {
      failures.push(`${finding.id} reviewed revision does not match its source receipt`);
    }
    if (finding?.severity === "verification_gap") {
      // Preserve the original gap payload. Resolution is a later review event,
      // not a rewrite of its former scope or a bare closed flag. Supplying
      // missing evidence can resolve a gap without editing the candidate.
      const sourceIndex = receipts.indexOf(source[0]);
      const reviewedAfterGap = verdicts.some((verdict) =>
        verdict?.reviewer === source[0].reviewer && verdict?.revision === revision &&
        verdict?.review_kind === "complete" && verdict?.verdict === "GO" &&
        receipts.findIndex((receipt) => receipt?.invocation_id === verdict?.invocation_id) > sourceIndex);
      const resolved = finding.closed === true && reviewedAfterGap && (
        (finding.validation === "confirmed" && finding.disposition === "fix") ||
        (finding.validation === "challenged" && finding.disposition === "rebut" &&
          finding.reviewer_rebuttal_accepted === true));
      const deferred = finding.closed === true && finding.gap_scope === "outside_closing_scope" &&
        finding.validation === "confirmed" && finding.disposition === "defer-gap";
      if (!resolved && !deferred) {
        failures.push(`${finding.id} verification gap needs a later complete GO accepting its resolution, or an outside-scope deferral`);
      }
    }
  }

  for (const verdict of verdicts) {
    const id = nonEmptyString(verdict?.reviewer) ? verdict.reviewer : "<missing-reviewer>";
    if (!nonEmptyString(verdict?.invocation_id)) {
      failures.push(`closing verdict for ${id} has no invocation ID`);
      continue;
    }
    const source = receipts.filter((receipt) => receipt?.invocation_id === verdict.invocation_id);
    if (source.length !== 1) {
      failures.push(`closing verdict for ${id} must bind exactly one round receipt`);
      continue;
    }
    const receipt = source[0];
    if (receipt.reviewer !== verdict.reviewer || receipt.revision_hash !== verdict.revision ||
        receipt.review_kind !== "complete" || receipt.verdict !== "GO") {
      failures.push(`closing verdict for ${id} does not match its complete GO receipt`);
    }
    if (receipt.reviewer_role !== "required") {
      failures.push(`closing verdict for ${id} must bind a required reviewer receipt`);
    }
    if (explicitSecondModel.includes(verdict.reviewer) && receipt.independence_level !== "second-model") {
      failures.push(`closing verdict for ${id} does not honor its frozen second-model reviewer class`);
    }
    const sourceReport = reports.find((report) => report?.invocation_id === verdict.invocation_id);
    const coveredRubric = Array.isArray(sourceReport?.coverage?.rubric_dimensions)
      ? [...sourceReport.coverage.rubric_dimensions].sort() : [];
    const coveredSeverities = Array.isArray(sourceReport?.coverage?.severities)
      ? [...sourceReport.coverage.severities].sort() : [];
    const requiredSeverities = ["blocker", "optional", "should_fix", "verification_gap"].sort();
    if (JSON.stringify(coveredRubric) !== JSON.stringify(requiredRubric) ||
        JSON.stringify(coveredSeverities) !== JSON.stringify(requiredSeverities)) {
      failures.push(`closing verdict for ${id} lacks complete rubric and severity coverage`);
    }
    const closingFindings = findings.filter((finding) => finding.source_invocation_id === verdict.invocation_id);
    const closingDefects = closingFindings.filter((finding) => ["blocker", "should_fix"].includes(finding.severity));
    if (closingDefects.length > 0) {
      failures.push(`closing GO for ${id} contains blocker or should-fix findings: ${closingDefects.map((finding) => finding.id).join(", ")}`);
    }
  }

  // Depth must buy something. Full depth is chosen for irreversibility and blast
  // radius, so it may not close on a same-model reviewer while a second model was
  // available: that combination was silently passing before.
  if (ledger.review_depth === "full") {
    const closesOnSecondModel = verdicts.some((verdict) => {
      const receipt = receipts.find((item) => item?.invocation_id === verdict?.invocation_id);
      return receipt?.independence_level === "second-model";
    });
    if (!closesOnSecondModel) {
      const availability = ledger.second_model_availability;
      if (!availability || typeof availability !== "object" || Array.isArray(availability)) {
        failures.push("full depth closing without a second-model reviewer requires a recorded second_model_availability");
      } else if (availability.available !== false) {
        failures.push("full depth requires a second-model reviewer when the runtime has one");
      } else if (!nonEmptyString(availability.basis)) {
        failures.push("recorded second-model unavailability needs a basis");
      } else {
        // Unavailability is a fact to be traced, not a sentence to be asserted:
        // hold it to the same standard as the diagnostic fallback — a real
        // attempt that really failed. Otherwise an agent avoiding an expensive
        // second-model call just writes `available: false` and full depth
        // quietly decays into shallow.
        const probeId = availability.probe_invocation_id;
        const probe = receipts.find((item) => item?.invocation_id === probeId);
        if (!nonEmptyString(probeId) || !attempts.includes(probeId)) {
          failures.push("second-model unavailability must name an attempted probe invocation");
        } else if (!probe || probe.independence_level !== "second-model" ||
                   !["FAILED", "TIMED-OUT"].includes(probe.verdict)) {
          failures.push("second-model unavailability must link a second-model probe receipt that FAILED or TIMED-OUT");
        }
      }
    }
  }

  return { pass: failures.length === 0, failures };
}

function readInput(argv) {
  if (argv[0]) return fs.readFileSync(argv[0], "utf8");
  return fs.readFileSync(0, "utf8");
}

function main() {
  try {
    const ledger = JSON.parse(readInput(process.argv.slice(2)));
    const result = evaluateReviewLedger(ledger);
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
if (require.main === module) main();

module.exports = { hasVisibleContent, safeForMessage, validateAgainstSchema, evaluateReviewLedger };
