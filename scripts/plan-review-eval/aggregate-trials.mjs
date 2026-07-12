#!/usr/bin/env node

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const VALID_SEVERITIES = new Set(["blocker", "should_fix", "advisory"]);
const VALID_VALIDATIONS = new Set(["confirmed", "unsupported"]);

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  if (value !== value.trim()) throw new Error(`${label} must not have leading or trailing whitespace`);
  return value;
}

function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

function safeSum(values, label) {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) throw new Error(`${label} exceeds the safe integer range`);
  }
  return total;
}

function stableFindings(trials, threshold) {
  const byKey = new Map();
  for (const trial of trials) {
    const trialKeys = new Set();
    for (const finding of trial.findings) {
      const key = requireString(finding.semantic_key, "finding.semantic_key");
      if (trialKeys.has(key)) throw new Error(`trial ${trial.trial_id} repeats semantic_key ${key}`);
      trialKeys.add(key);
      const bucket = byKey.get(key) ?? [];
      bucket.push(finding);
      byKey.set(key, bucket);
    }
  }
  return [...byKey.entries()].filter(([, findings]) => findings.length >= threshold).map(([semantic_key, findings]) => {
    const jointCounts = new Map();
    for (const finding of findings) {
      const joint = `${finding.severity}\0${finding.validation}`;
      jointCounts.set(joint, (jointCounts.get(joint) ?? 0) + 1);
    }
    const stableJoint = [...jointCounts.entries()].find(([, count]) => count >= threshold)?.[0];
    const [severity, validation] = stableJoint ? stableJoint.split("\0") : ["mixed", "mixed"];
    return {
      semantic_key,
      appearances: findings.length,
      severity,
      validation,
    };
  }).sort((a, b) => a.semantic_key.localeCompare(b.semantic_key));
}

function summarizeArm(trials, threshold) {
  const stable = stableFindings(trials, threshold);
  const observed = trials.flatMap((trial) => trial.findings);
  const unsupported = observed.filter((finding) => finding.validation === "unsupported").length;
  return {
    trials: trials.length,
    stable_findings: stable,
    stable_confirmed_blockers: stable.filter((finding) => finding.severity === "blocker" && finding.validation === "confirmed").map((finding) => finding.semantic_key),
    unsupported_findings: unsupported,
    unsupported_per_trial: unsupported / trials.length,
    model_invocations: safeSum(trials.map((trial) => trial.model_invocations), "model_invocations total"),
    input_characters: safeSum(trials.map((trial) => trial.input_characters), "input_characters total"),
    output_characters: safeSum(trials.map((trial) => trial.output_characters), "output_characters total"),
    wall_clock_ms: safeSum(trials.map((trial) => trial.wall_clock_ms), "wall_clock_ms total"),
    physical_sessions: safeSum(trials.map((trial) => trial.physical_sessions), "physical_sessions total"),
    retries: safeSum(trials.map((trial) => trial.retries), "retries total"),
  };
}

export function aggregateExperiment(experiment) {
  if (!experiment || typeof experiment !== "object" || Array.isArray(experiment)) throw new Error("experiment must be an object");
  const requiredTrials = requireCount(experiment.trials_required, "trials_required");
  if (requiredTrials < 3) throw new Error("trials_required must be at least 3");
  const threshold = Math.floor(requiredTrials / 2) + 1;
  const wallClockRatio = experiment.max_candidate_wall_clock_ratio === undefined ? 1.1 : experiment.max_candidate_wall_clock_ratio;
  if (typeof wallClockRatio !== "number" || !Number.isFinite(wallClockRatio)) {
    throw new Error("max_candidate_wall_clock_ratio must be a finite number");
  }
  if (wallClockRatio <= 0) throw new Error("max_candidate_wall_clock_ratio must be positive");
  if (wallClockRatio > 10) throw new Error("max_candidate_wall_clock_ratio must not exceed 10");
  if (experiment.provenance_mode !== "self_reported") throw new Error("provenance_mode must be self_reported");
  if (!experiment.preflight || typeof experiment.preflight !== "object" || Array.isArray(experiment.preflight)) {
    throw new Error("preflight result is required");
  }
  const preflightCandidateHash = requireString(experiment.preflight.candidate_hash, "preflight.candidate_hash");
  const preflightBaseRevision = requireString(experiment.preflight.resolved_base_revision, "preflight.resolved_base_revision");
  if (!experiment.preflight.summary || experiment.preflight.summary.failed !== 0) throw new Error("preflight must have zero failed checks");
  if (!experiment.arms || typeof experiment.arms !== "object" || Array.isArray(experiment.arms)) throw new Error("arms must be an object");
  const armNames = Object.keys(experiment.arms);
  if (armNames.length !== 2) throw new Error("exactly two arms are required");
  const baselineName = requireString(experiment.baseline_arm, "baseline_arm");
  const candidateName = requireString(experiment.candidate_arm, "candidate_arm");
  if (baselineName === candidateName || !armNames.includes(baselineName) || !armNames.includes(candidateName)) {
    throw new Error("baseline_arm and candidate_arm must name the two distinct arms");
  }
  const summaries = {};
  const globalTrialIds = new Set();
  const globalInvocationIds = new Set();
  const globalSessionIds = new Set();
  const runtimeModels = new Set();
  const experimentIdentities = new Set();
  const artifactHashes = new Set();
  const baseRevisions = new Set();
  const adjudicationVersions = new Set();
  const armConfigHashes = new Map();
  for (const arm of armNames) {
    if (!Array.isArray(experiment.arms[arm])) throw new Error(`${arm} trials must be an array`);
    const trials = experiment.arms[arm].map((trial, index) => {
      if (!trial || typeof trial !== "object" || Array.isArray(trial)) throw new Error(`${arm}[${index}] must be an object`);
      if (requireString(trial.arm, `${arm}[${index}].arm`) !== arm) throw new Error(`${arm}[${index}] arm mismatch`);
      requireString(trial.sample_id, `${arm}[${index}].sample_id`);
      requireString(trial.trial_id, `${arm}[${index}].trial_id`);
      requireString(trial.runtime, `${arm}[${index}].runtime`);
      requireString(trial.model, `${arm}[${index}].model`);
      experimentIdentities.add(requireString(trial.experiment_identity, `${arm}[${index}].experiment_identity`));
      artifactHashes.add(requireString(trial.artifact_hash, `${arm}[${index}].artifact_hash`));
      baseRevisions.add(requireString(trial.resolved_base_revision, `${arm}[${index}].resolved_base_revision`));
      adjudicationVersions.add(requireString(trial.adjudication_version, `${arm}[${index}].adjudication_version`));
      const armConfigHash = requireString(trial.arm_config_hash, `${arm}[${index}].arm_config_hash`);
      const priorArmConfigHash = armConfigHashes.get(arm);
      if (priorArmConfigHash && priorArmConfigHash !== armConfigHash) throw new Error(`${arm} arm_config_hash must be constant`);
      armConfigHashes.set(arm, armConfigHash);
      const invocationId = requireString(trial.invocation_id, `${arm}[${index}].invocation_id`);
      const sessionId = requireString(trial.session_id, `${arm}[${index}].session_id`);
      const globalId = trial.trial_id;
      if (globalTrialIds.has(globalId)) throw new Error(`duplicate global trial_id: ${globalId}`);
      globalTrialIds.add(globalId);
      if (globalInvocationIds.has(invocationId)) throw new Error(`duplicate runtime invocation_id: ${invocationId}`);
      if (globalSessionIds.has(sessionId)) throw new Error(`duplicate runtime session_id: ${sessionId}`);
      globalInvocationIds.add(invocationId);
      globalSessionIds.add(sessionId);
      runtimeModels.add(`${trial.runtime}\0${trial.model}`);
      if (!Array.isArray(trial.findings)) throw new Error(`${arm}[${index}].findings must be an array`);
      for (const finding of trial.findings) {
        requireString(finding.semantic_key, "finding.semantic_key");
        if (!VALID_SEVERITIES.has(finding.severity)) throw new Error(`invalid finding severity: ${finding.severity}`);
        if (!VALID_VALIDATIONS.has(finding.validation)) throw new Error(`invalid finding validation: ${finding.validation}`);
      }
      for (const field of ["model_invocations", "input_characters", "output_characters", "wall_clock_ms", "physical_sessions", "retries"]) {
        requireCount(trial[field], `${arm}[${index}].${field}`);
      }
      return trial;
    });
    const samples = new Map();
    for (const trial of trials) {
      const bucket = samples.get(trial.sample_id) ?? [];
      bucket.push(trial);
      samples.set(trial.sample_id, bucket);
    }
    summaries[arm] = {};
    for (const [sample, sampleTrials] of samples) {
      if (sampleTrials.length !== requiredTrials) throw new Error(`${arm}/${sample} needs exactly ${requiredTrials} trials`);
      const ids = sampleTrials.map((trial) => trial.trial_id);
      if (new Set(ids).size !== ids.length) throw new Error(`${arm}/${sample} has duplicate trial_id`);
      summaries[arm][sample] = summarizeArm(sampleTrials, threshold);
    }
  }
  if (globalTrialIds.size === 0) throw new Error("experiment must contain at least one sample and trial");
  if (runtimeModels.size !== 1) throw new Error("all trials must use the same runtime and model for a comparable A/B experiment");
  if (experimentIdentities.size !== 1 || artifactHashes.size !== 1 || adjudicationVersions.size !== 1) {
    throw new Error("all trials must bind to the same experiment identity, artifact, and adjudication version");
  }
  if (!artifactHashes.has(preflightCandidateHash) || baseRevisions.size !== 1 || !baseRevisions.has(preflightBaseRevision)) {
    throw new Error("trials must match the supplied preflight candidate hash and resolved base revision");
  }
  const baselineSamples = Object.keys(summaries[baselineName]).sort();
  const candidateSamples = Object.keys(summaries[candidateName]).sort();
  if (JSON.stringify(baselineSamples) !== JSON.stringify(candidateSamples)) throw new Error("arms must cover the same samples");

  const failures = [];
  const comparisons = {};
  for (const sample of baselineSamples) {
    const baseline = summaries[baselineName][sample];
    const candidate = summaries[candidateName][sample];
    const missed = baseline.stable_confirmed_blockers.filter((key) => !candidate.stable_confirmed_blockers.includes(key));
    if (missed.length > 0) failures.push(`${sample}: candidate misses stable blockers: ${missed.join(", ")}`);
    if (candidate.unsupported_per_trial > baseline.unsupported_per_trial) failures.push(`${sample}: candidate unsupported findings per trial increased`);
    if (candidate.model_invocations > baseline.model_invocations) failures.push(`${sample}: candidate model invocations increased`);
    if (candidate.physical_sessions > baseline.physical_sessions) failures.push(`${sample}: candidate physical sessions increased`);
    if (candidate.retries > baseline.retries) failures.push(`${sample}: candidate retries increased`);
    if (candidate.input_characters + candidate.output_characters >= baseline.input_characters + baseline.output_characters) {
      failures.push(`${sample}: candidate total characters did not decrease`);
    }
    const wallClockLimit = baseline.wall_clock_ms * wallClockRatio;
    if (!Number.isFinite(wallClockLimit)) throw new Error(`${sample}: wall-clock comparison overflowed`);
    if (candidate.wall_clock_ms > wallClockLimit) failures.push(`${sample}: candidate wall-clock exceeded ratio ${wallClockRatio}`);
    comparisons[sample] = { missed_stable_blockers: missed, baseline, candidate };
  }
  return {
    schema_version: 1,
    trials_required: requiredTrials,
    stability_threshold: threshold,
    baseline_arm: baselineName,
    candidate_arm: candidateName,
    evidence_gates_pass: failures.length === 0,
    acceptance_status: failures.length === 0 ? "provisional" : "rejected",
    independence_verified: false,
    provenance_mode: "self_reported",
    failures,
    comparisons,
  };
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("usage: aggregate-trials.mjs <experiment.json>");
  const experiment = JSON.parse(fs.readFileSync(input, "utf8"));
  process.stdout.write(`${JSON.stringify(aggregateExperiment(experiment), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}
