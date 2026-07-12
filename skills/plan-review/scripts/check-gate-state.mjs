#!/usr/bin/env node

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const VALID_SEVERITIES = new Set(["blocker", "should_fix", "optional", "verification_gap"]);
const VALID_VALIDATIONS = new Set(["confirmed", "challenged", "needs_evidence"]);
const VALID_DISPOSITIONS = new Set(["fix", "rebut", "accept-risk", "defer-gap", "needs-input"]);
const VALID_PRECISIONS = new Set(["exact", "derived", "unavailable"]);
const VALID_REVIEW_KINDS = new Set(["complete", "focused", "rebuttal-check"]);
const VALID_RECEIPT_VERDICTS = new Set([
  "GO",
  "CONDITIONAL-GO",
  "NO-GO",
  "FAILED",
  "TIMED-OUT",
  "CANCELLED",
  "DISCARDED",
]);
const TOKEN_FIELDS = [
  "uncached_input_tokens",
  "cache_read_input_tokens",
  "cache_write_or_creation_tokens",
  "output_tokens",
  "reasoning_tokens",
  "helper_agent_tokens",
];

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}

export function evaluateGateState(state) {
  const failures = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { pass: false, failures: ["gate state must be a JSON object"] };
  }

  const revision = state.current_revision;
  if (!nonEmptyString(revision)) failures.push("current revision is missing");

  if (!Array.isArray(state.required_reviewers)) failures.push("required_reviewers must be an array");
  const required = Array.isArray(state.required_reviewers) ? state.required_reviewers : [];
  if (required.length === 0) failures.push("required reviewers are missing");
  if (required.some((reviewer) => !nonEmptyString(reviewer))) {
    failures.push("every required reviewer needs a non-empty identity");
  }
  for (const reviewer of duplicates(required)) failures.push(`duplicate required reviewer: ${reviewer}`);

  if (!Array.isArray(state.final_reviewer_verdicts)) failures.push("final_reviewer_verdicts must be an array");
  const verdicts = Array.isArray(state.final_reviewer_verdicts) ? state.final_reviewer_verdicts : [];
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

  if (!Array.isArray(state.findings)) failures.push("findings must be an array");
  const findings = Array.isArray(state.findings) ? state.findings : [];
  const findingIds = findings.map((finding) => finding?.id).filter(nonEmptyString);
  if (findingIds.length !== findings.length) failures.push("every finding needs a stable finding ID");
  for (const id of duplicates(findingIds)) failures.push(`duplicate finding ID: ${id}`);

  for (const finding of findings) {
    const id = nonEmptyString(finding?.id) ? finding.id : "<missing-id>";
    if (!VALID_SEVERITIES.has(finding?.severity)) failures.push(`${id} has invalid severity`);
    if (!nonEmptyString(finding?.claim)) failures.push(`${id} has no reviewer claim`);
    if (!nonEmptyString(finding?.evidence)) failures.push(`${id} has no reviewer evidence`);
    if (!nonEmptyString(finding?.affected_section)) failures.push(`${id} has no affected section`);
    if (finding?.severity === "verification_gap" && !nonEmptyString(finding?.missing_check)) {
      failures.push(`${id} verification gap has no missing check`);
    }
    if (!nonEmptyString(finding?.source_invocation_id)) failures.push(`${id} has no source invocation`);
    if (!nonEmptyString(finding?.revision)) failures.push(`${id} has no reviewed revision`);
    if (!nonEmptyString(finding?.owner)) failures.push(`${id} has no owner`);
    if (!VALID_VALIDATIONS.has(finding?.validation)) failures.push(`${id} has no valid parent validation`);
    if (!nonEmptyString(finding?.parent_evidence_and_reason)) {
      failures.push(`${id} has no parent validation evidence and reason`);
    }
    if (finding?.parent_validation_disclosed !== true) {
      failures.push(`${id} parent validation was not disclosed`);
    }
    if (finding?.validation === "needs_evidence") failures.push(`${id} still needs evidence`);
    if (finding?.disposition != null && !VALID_DISPOSITIONS.has(finding.disposition)) {
      failures.push(`${id} has invalid disposition`);
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
      if (finding?.validation === "confirmed" && finding?.disposition !== "defer-gap") {
        failures.push(`${id} confirmed verification gap must use defer-gap`);
      }
      if (finding?.closed !== true) failures.push(`verification gap ${id} is not dispositioned`);
    }
  }

  if (!Array.isArray(state.active_reviewer_invocations)) {
    failures.push("active_reviewer_invocations must be an array");
  }
  const active = Array.isArray(state.active_reviewer_invocations)
    ? state.active_reviewer_invocations
    : [];
  if (active.length > 0) failures.push(`active reviewer invocations remain: ${active.join(", ")}`);
  if (state.material_change_after_go !== false) failures.push("material change happened after GO");

  if (!Array.isArray(state.attempted_invocations)) failures.push("attempted_invocations must be an array");
  if (!Array.isArray(state.round_receipts)) failures.push("round_receipts must be an array");
  if (!Array.isArray(state.round_reports)) failures.push("round_reports must be an array");
  const attempts = Array.isArray(state.attempted_invocations) ? state.attempted_invocations : [];
  const receipts = Array.isArray(state.round_receipts) ? state.round_receipts : [];
  const reports = Array.isArray(state.round_reports) ? state.round_reports : [];
  const receiptIds = receipts.map((receipt) => receipt?.invocation_id).filter(nonEmptyString);
  for (const id of duplicates(receiptIds)) failures.push(`duplicate round receipt: ${id}`);
  for (const attempt of attempts) {
    if (!receiptIds.includes(attempt)) failures.push(`attempted invocation ${attempt} has no round receipt`);
  }
  for (const receiptId of receiptIds) {
    if (!attempts.includes(receiptId)) failures.push(`round receipt ${receiptId} has no attempted invocation`);
  }
  for (const receipt of receipts) {
    const id = nonEmptyString(receipt?.invocation_id) ? receipt.invocation_id : "<missing-invocation>";
    if (!nonEmptyString(receipt?.round_id)) failures.push(`${id} receipt has no round ID`);
    if (!nonEmptyString(receipt?.invocation_id)) failures.push("round receipt has no invocation ID");
    if (!nonEmptyString(receipt?.revision_hash)) failures.push(`${id} receipt has no revision hash`);
    if (!VALID_REVIEW_KINDS.has(receipt?.review_kind)) failures.push(`${id} has invalid review kind`);
    if (!VALID_RECEIPT_VERDICTS.has(receipt?.verdict)) failures.push(`${id} has invalid receipt verdict`);
    if (!nonEmptyString(receipt?.runtime)) failures.push(`${id} receipt has no runtime`);
    if (!nonEmptyString(receipt?.provider)) failures.push(`${id} receipt has no provider`);
    if (!nonEmptyString(receipt?.model)) failures.push(`${id} receipt has no model`);
    if (!nonEmptyString(receipt?.reviewer)) failures.push(`${id} receipt has no reviewer identity`);
    if (!nonEmptyString(receipt?.effort)) failures.push(`${id} receipt has no effort`);
    if (!nonEmptyString(receipt?.reviewer_session_id_or_opaque_handle)) {
      failures.push(`${id} receipt has no reviewer session or handle`);
    }
    if (!nonEmptyString(receipt?.independence_level)) failures.push(`${id} receipt has no independence level`);
    if (!Number.isInteger(receipt?.model_calls) || receipt.model_calls < 0) {
      failures.push(`${id} receipt has invalid model call count`);
    }
    if (!nonEmptyString(receipt?.usage_source)) failures.push(`${id} receipt has no usage source`);
    if (!VALID_PRECISIONS.has(receipt?.usage_precision)) failures.push(`${id} has invalid usage precision`);
    if (receipt?.usage_precision === "unavailable" && !nonEmptyString(receipt?.usage_unavailable_reason)) {
      failures.push(`${id} unavailable usage has no unavailable reason`);
    }
    for (const field of TOKEN_FIELDS) {
      if (!(field in receipt)) failures.push(`${id} receipt omits ${field}`);
      if (receipt[field] != null && (!Number.isFinite(receipt[field]) || receipt[field] < 0)) {
        failures.push(`${id} receipt has invalid ${field}`);
      }
    }
    if (!("raw_total_tokens" in receipt)) failures.push(`${id} receipt omits raw_total_tokens`);
    if (receipt?.usage_precision === "exact" || receipt?.usage_precision === "derived") {
      const values = TOKEN_FIELDS.map((field) => receipt[field]).filter(Number.isFinite);
      if (values.length === 0) failures.push(`${id} ${receipt.usage_precision} usage has no token category`);
      const sum = values.reduce((total, value) => total + value, 0);
      if (!Number.isFinite(receipt?.raw_total_tokens) || receipt.raw_total_tokens !== sum) {
        failures.push(`${id} raw total does not equal reported token categories`);
      }
    } else if (receipt?.usage_precision === "unavailable" && receipt?.raw_total_tokens != null) {
      failures.push(`${id} unavailable usage must not invent a raw total`);
    }
  }

  const returnedVerdicts = new Set(["GO", "CONDITIONAL-GO", "NO-GO"]);
  for (const receipt of receipts) {
    if (!returnedVerdicts.has(receipt?.verdict)) continue;
    const matches = reports.filter((report) => report?.invocation_id === receipt.invocation_id);
    if (matches.length !== 1) {
      failures.push(`${receipt.invocation_id} needs exactly one returned round report`);
      continue;
    }
    const report = matches[0];
    if (report.revision_hash !== receipt.revision_hash || report.verdict !== receipt.verdict) {
      failures.push(`${receipt.invocation_id} round report does not match its receipt`);
    }
    if (report.reviewer_output_disclosed !== true) {
      failures.push(`${receipt.invocation_id} reviewer output was not disclosed`);
    }
    if (!Array.isArray(report.finding_ids)) {
      failures.push(`${receipt.invocation_id} round report finding_ids must be an array`);
      continue;
    }
    if (report.finding_ids.some((id) => !nonEmptyString(id))) {
      failures.push(`${receipt.invocation_id} round report has an invalid finding ID`);
    }
    for (const id of duplicates(report.finding_ids)) {
      failures.push(`${receipt.invocation_id} round report has duplicate finding ID: ${id}`);
    }
  }
  for (const report of reports) {
    const receipt = receipts.filter((item) => item?.invocation_id === report?.invocation_id);
    if (receipt.length !== 1 || !returnedVerdicts.has(receipt[0]?.verdict)) {
      failures.push(`round report ${report?.invocation_id ?? "<missing-invocation>"} has no returned-verdict receipt`);
      continue;
    }
    if (!Array.isArray(report.finding_ids)) continue;
    for (const id of report.finding_ids) {
      const matches = findings.filter((finding) => finding?.id === id && finding?.source_invocation_id === report.invocation_id);
      if (matches.length !== 1) failures.push(`${report.invocation_id} manifest finding ${id} must map to exactly one ledger finding`);
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
  }

  return { pass: failures.length === 0, failures };
}

function readInput(argv) {
  if (argv[0]) return fs.readFileSync(argv[0], "utf8");
  return fs.readFileSync(0, "utf8");
}

async function main() {
  try {
    const state = JSON.parse(readInput(process.argv.slice(2)));
    const result = evaluateGateState(state);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
