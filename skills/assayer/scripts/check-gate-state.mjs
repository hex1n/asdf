#!/usr/bin/env node

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const VALID_SEVERITIES = new Set(["blocker", "should_fix", "optional", "verification_gap"]);
const VALID_VALIDATIONS = new Set(["confirmed", "challenged", "needs_evidence"]);
const VALID_DISPOSITIONS = new Set(["fix", "rebut", "accept-risk", "defer-gap", "needs-input"]);
const VALID_PRECISIONS = new Set(["exact", "derived"]);
const VALID_BUDGET_SOURCES = new Set(["explicit", "calibrated-default", "user-authorized-unbounded"]);
const VALID_REVIEW_KINDS = new Set(["blocker-sweep", "complete", "focused", "rebuttal-check"]);
const VALID_INDEPENDENCE_LEVELS = new Set(["fresh-context", "second-model"]);
const VALID_REVIEW_DEPTHS = new Set(["shallow", "full"]);
const VALID_REVIEWER_ROLES = new Set(["required", "diagnostic"]);
const VALID_RECEIPT_VERDICTS = new Set([
  "GO",
  "CONDITIONAL-GO",
  "NO-GO",
  "FAILED",
  "TIMED-OUT",
  "CANCELLED",
  "DISCARDED",
]);
const COST_FIELDS = ["model_calls", "input_characters", "output_characters", "wall_clock_ms", "physical_sessions", "retries"];

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

export function evaluateGateState(state) {
  const failures = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { pass: false, failures: ["gate state must be a JSON object"] };
  }

  const revision = state.current_revision;
  if (!nonEmptyString(revision)) failures.push("current revision is missing");
  if (!Array.isArray(state.required_rubric_dimensions) || state.required_rubric_dimensions.length === 0 ||
      state.required_rubric_dimensions.some((item) => !nonEmptyString(item))) {
    failures.push("required_rubric_dimensions must be a non-empty string array");
  }
  if (Array.isArray(state.required_rubric_dimensions) &&
      new Set(state.required_rubric_dimensions).size !== state.required_rubric_dimensions.length) {
    failures.push("required_rubric_dimensions must not contain duplicates");
  }
  const requiredRubric = Array.isArray(state.required_rubric_dimensions) ? [...state.required_rubric_dimensions].sort() : [];

  if (!Array.isArray(state.required_reviewers)) failures.push("required_reviewers must be an array");
  const required = Array.isArray(state.required_reviewers) ? state.required_reviewers : [];
  if (required.length === 0) failures.push("required reviewers are missing");
  if (required.some((reviewer) => !identityString(reviewer))) {
    failures.push("every required reviewer needs a non-empty identity without surrounding whitespace");
  }
  for (const reviewer of duplicates(required)) failures.push(`duplicate required reviewer: ${reviewer}`);
  if (!identityString(state.author_identity)) {
    failures.push("author_identity must be a non-empty identity without surrounding whitespace");
  } else if (required.includes(state.author_identity)) {
    failures.push("author identity cannot be a required reviewer");
  }
  if (!VALID_REVIEW_DEPTHS.has(state.review_depth)) {
    failures.push("review_depth must be shallow or full");
  }

  if (!Array.isArray(state.explicit_second_model_reviewers)) {
    failures.push("explicit_second_model_reviewers must be an array");
  }
  const explicitSecondModel = Array.isArray(state.explicit_second_model_reviewers)
    ? state.explicit_second_model_reviewers
    : [];
  if (explicitSecondModel.some((reviewer) => !identityString(reviewer))) {
    failures.push("every explicit second-model reviewer needs a non-empty identity without surrounding whitespace");
  }
  for (const reviewer of duplicates(explicitSecondModel)) {
    failures.push(`duplicate explicit second-model reviewer: ${reviewer}`);
  }
  for (const reviewer of explicitSecondModel) {
    if (!required.includes(reviewer)) {
      failures.push(`explicit second-model reviewer is not required: ${reviewer}`);
    }
  }

  if (!Array.isArray(state.final_reviewer_verdicts)) failures.push("final_reviewer_verdicts must be an array");
  const verdicts = Array.isArray(state.final_reviewer_verdicts) ? state.final_reviewer_verdicts : [];
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

  if (!Array.isArray(state.active_reviewer_invocations)) {
    failures.push("active_reviewer_invocations must be an array");
  }
  const active = Array.isArray(state.active_reviewer_invocations)
    ? state.active_reviewer_invocations
    : [];
  if (active.length > 0) failures.push(`active reviewer invocations remain: ${active.join(", ")}`);
  if (state.material_change_after_go !== false) failures.push("material change happened after GO");

  const budget = state.resolved_budget;
  if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
    failures.push("resolved_budget must be a frozen budget object");
  } else if (!VALID_BUDGET_SOURCES.has(budget.source)) {
    failures.push("resolved_budget has invalid source");
  } else if (budget.source === "user-authorized-unbounded") {
    if (budget.user_authorization !== true) {
      failures.push("unbounded budget requires recorded user authorization");
    }
  } else {
    if (!nonEmptyString(budget.unit)) failures.push("resolved_budget has no observable unit");
    if (!Number.isSafeInteger(budget.threshold) || budget.threshold <= 0) {
      failures.push("resolved_budget has no positive threshold");
    }
  }

  if (!Array.isArray(state.attempted_invocations)) failures.push("attempted_invocations must be an array");
  if (!Array.isArray(state.round_receipts)) failures.push("round_receipts must be an array");
  if (!Array.isArray(state.round_reports)) failures.push("round_reports must be an array");
  const attempts = Array.isArray(state.attempted_invocations) ? state.attempted_invocations : [];
  const receipts = Array.isArray(state.round_receipts) ? state.round_receipts : [];
  const reports = Array.isArray(state.round_reports) ? state.round_reports : [];
  const receiptIds = receipts.map((receipt) => receipt?.invocation_id).filter(nonEmptyString);
  if (attempts.some((id) => !nonEmptyString(id))) failures.push("every attempted invocation needs a non-empty ID");
  for (const id of duplicates(attempts)) failures.push(`duplicate attempted invocation: ${id}`);
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
    if (!identityString(receipt?.reviewer)) {
      failures.push(`${id} receipt reviewer needs an identity without surrounding whitespace`);
    }
    if (!nonEmptyString(receipt?.effort)) failures.push(`${id} receipt has no effort`);
    if (!nonEmptyString(receipt?.reviewer_session_id_or_opaque_handle)) {
      failures.push(`${id} receipt has no reviewer session or handle`);
    }
    if (!VALID_REVIEWER_ROLES.has(receipt?.reviewer_role)) {
      failures.push(`${id} receipt has invalid reviewer role`);
    }
    if (receipt?.reviewer_role === "required" && !required.includes(receipt?.reviewer)) {
      failures.push(`${id} required reviewer receipt is not in the frozen required_reviewers`);
    }
    if (!VALID_INDEPENDENCE_LEVELS.has(receipt?.independence_level)) {
      failures.push(`${id} receipt has invalid independence level`);
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
    if (!nonEmptyString(receipt?.measurement_source)) failures.push(`${id} receipt has no measurement source`);
    if (!VALID_PRECISIONS.has(receipt?.measurement_precision)) failures.push(`${id} has invalid measurement precision`);
    for (const field of COST_FIELDS) {
      if (!(field in receipt)) failures.push(`${id} receipt omits ${field}`);
      if (receipt[field] != null && (!Number.isSafeInteger(receipt[field]) || receipt[field] < 0)) {
        failures.push(`${id} receipt has invalid ${field}`);
      }
      if (receipt[field] == null) {
        failures.push(`${id} ${receipt.measurement_precision} measurement omits ${field}`);
      }
    }
    if (VALID_RECEIPT_VERDICTS.has(receipt?.verdict) && ["GO", "CONDITIONAL-GO", "NO-GO"].includes(receipt.verdict)) {
      for (const field of ["model_calls", "input_characters", "output_characters", "wall_clock_ms", "physical_sessions"]) {
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

  const returnedVerdicts = new Set(["GO", "CONDITIONAL-GO", "NO-GO"]);
  for (const receipt of receipts) {
    if (!returnedVerdicts.has(receipt?.verdict)) continue;
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
    if (["NO-GO", "CONDITIONAL-GO"].includes(report.verdict) && report.finding_ids.length === 0) {
      failures.push(`${receipt.invocation_id} non-GO verdict requires at least one finding`);
    }
    if (!Array.isArray(report.finding_payloads)) {
      failures.push(`${receipt.invocation_id} round report finding_payloads must be an array`);
    } else {
      const payloadIds = report.finding_payloads.map((finding) => finding?.id);
      if (JSON.stringify(payloadIds) !== JSON.stringify(report.finding_ids)) {
        failures.push(`${receipt.invocation_id} finding payload IDs do not match finding_ids`);
      }
      for (const payload of report.finding_payloads) {
        if (!nonEmptyString(payload?.id) || !VALID_SEVERITIES.has(payload?.severity) ||
            !nonEmptyString(payload?.claim) || !nonEmptyString(payload?.evidence) ||
            !nonEmptyString(payload?.affected_section)) {
          failures.push(`${receipt.invocation_id} has incomplete finding payload`);
        }
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
    if (receipt.length !== 1 || !returnedVerdicts.has(receipt[0]?.verdict)) {
      failures.push(`round report ${report?.invocation_id ?? "<missing-invocation>"} has no returned-verdict receipt`);
      continue;
    }
    if (!Array.isArray(report.finding_ids)) continue;
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
  if (state.review_depth === "full") {
    const closesOnSecondModel = verdicts.some((verdict) => {
      const receipt = receipts.find((item) => item?.invocation_id === verdict?.invocation_id);
      return receipt?.independence_level === "second-model";
    });
    if (!closesOnSecondModel) {
      const availability = state.second_model_availability;
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

const invokedPath = process.argv[1] ?? "";
let entryHref = "";
try {
  entryHref = pathToFileURL(fs.realpathSync(invokedPath)).href;
} catch {
  try { entryHref = pathToFileURL(invokedPath).href; } catch { entryHref = ""; }
}
// Case/realpath-insensitive compare (Windows drive-letter casing and MSYS path
// translation break exact-equality guards silently: main() never ran, exit 0).
const isEntry = entryHref !== "" && import.meta.url.toLowerCase() === entryHref.toLowerCase();
const looksLikeCli = invokedPath.replace(/\\/g, "/").toLowerCase().endsWith("/check-gate-state.mjs");
if (isEntry || looksLikeCli) await main();
