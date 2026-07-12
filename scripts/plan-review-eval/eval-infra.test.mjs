import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { runPreflight } from "./preflight.mjs";
import { aggregateExperiment } from "./aggregate-trials.mjs";
import { evaluateGateState } from "../../skills/plan-review/scripts/check-gate-state.mjs";

const CLOSING_FIXTURE = new URL("./fixtures/closing-pass.json", import.meta.url);

function closingFixture() {
  return JSON.parse(fs.readFileSync(CLOSING_FIXTURE, "utf8"));
}

test("full blocker-sweep to complete-review closing path passes", () => {
  assert.deepEqual(evaluateGateState(closingFixture()), { pass: true, failures: [] });
});

test("closing fixture fails on same-revision fix, upgraded kind, or missing coverage", () => {
  let state = closingFixture();
  state.findings[0].revision = state.current_revision;
  assert.match(evaluateGateState(state).failures.join("\n"), /cannot be fixed without a new revision/);

  state = closingFixture();
  state.round_reports[0].review_kind = "complete";
  assert.match(evaluateGateState(state).failures.join("\n"), /round report does not match its receipt/);

  state = closingFixture();
  delete state.round_reports[1].coverage;
  assert.match(evaluateGateState(state).failures.join("\n"), /lacks complete rubric and severity coverage/);
});

test("every sweep and complete report needs unique exact coverage", () => {
  let state = closingFixture();
  delete state.round_reports[0].coverage;
  assert.match(evaluateGateState(state).failures.join("\n"), /lacks required blocker-sweep coverage/);

  state = closingFixture();
  state.round_receipts[0].review_kind = "complete";
  state.round_reports[0].review_kind = "complete";
  assert.match(evaluateGateState(state).failures.join("\n"), /lacks required complete coverage/);

  state = closingFixture();
  state.required_rubric_dimensions.push("scope");
  state.round_reports[0].coverage.rubric_dimensions.push("scope");
  state.round_reports[1].coverage.rubric_dimensions.push("scope");
  assert.match(evaluateGateState(state).failures.join("\n"), /must not contain duplicates|coverage must not contain duplicates/);
});

test("final verdicts, optional fixes, and attempts fail closed", () => {
  let state = closingFixture();
  state.final_reviewer_verdicts.push({
    ...state.final_reviewer_verdicts[0], revision: "sha256:old", invocation_id: "invocation-close",
  });
  assert.match(evaluateGateState(state).failures.join("\n"), /exactly the required reviewers|current revision/);

  state = closingFixture();
  state.findings[1].disposition = "fix";
  assert.match(evaluateGateState(state).failures.join("\n"), /cannot be fixed without a new revision/);

  state = closingFixture();
  state.attempted_invocations.push("invocation-close");
  assert.match(evaluateGateState(state).failures.join("\n"), /duplicate attempted invocation/);
});

test("every GO report rejects gate-blocking findings", () => {
  let state = closingFixture();
  state.round_receipts[0].verdict = "GO";
  state.round_reports[0].verdict = "GO";
  assert.match(evaluateGateState(state).failures.join("\n"), /GO report contains blocker or should-fix findings/);

  state = closingFixture();
  state.round_receipts[0].review_kind = "complete";
  state.round_reports[0].review_kind = "complete";
  state.round_receipts[0].verdict = "GO";
  state.round_reports[0].verdict = "GO";
  state.round_reports[0].coverage.severities = ["blocker", "should_fix", "optional", "verification_gap"];
  assert.match(evaluateGateState(state).failures.join("\n"), /GO report contains blocker or should-fix findings/);
});

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

test("preflight reads the pinned base revision rather than the current checkout", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "plan-review-preflight-"));
  git(repo, "init");
  git(repo, "config", "user.email", "eval@example.invalid");
  git(repo, "config", "user.name", "Eval Fixture");
  fs.writeFileSync(path.join(repo, "plan.md"), "# Plan\nrequired marker\n");
  fs.writeFileSync(path.join(repo, "target.txt"), "present\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo, "plan.md"), "# Plan\nchanged checkout\n");
  fs.rmSync(path.join(repo, "target.txt"));

  const result = runPreflight({
    candidate_id: "sample",
    repo,
    base_revision: base,
    candidate_files: ["plan.md"],
    checks: [
      { id: "marker", type: "text_contains", file: "plan.md", needle: "required marker", summary: "marker exists at base" },
      { id: "target", type: "path_exists", path: "target.txt", summary: "target exists at base" },
      { id: "unexpected", type: "text_absent", file: "plan.md", needle: "forbidden", summary: "forbidden text absent" },
    ],
  });
  assert.equal(result.resolved_base_revision, base);
  assert.deepEqual(result.summary, { total: 3, passed: 3, failed: 0 });
  assert.deepEqual(result.compact_display, []);
  assert.match(result.candidate_hash, /^[a-f0-9]{64}$/);
});

test("preflight fails closed on unsupported or unpinned inputs", () => {
  assert.throws(() => runPreflight({}), /candidate_id/);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "plan-review-empty-checks-"));
  git(repo, "init");
  git(repo, "config", "user.email", "eval@example.invalid");
  git(repo, "config", "user.name", "Eval Fixture");
  fs.writeFileSync(path.join(repo, "plan.md"), "# Plan\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  assert.throws(() => runPreflight({
    candidate_id: "empty",
    repo,
    base_revision: "HEAD",
    candidate_files: ["plan.md"],
    checks: [],
  }), /checks must be a non-empty array/);
});

function trial(arm, sample, number, overrides = {}) {
  return {
    arm,
    sample_id: sample,
    trial_id: `${arm}-${sample}-${number}`,
    runtime: "test-runtime",
    model: "test-model",
    experiment_identity: "experiment-v1",
    artifact_hash: "artifact-sha256",
    resolved_base_revision: "base-commit-sha",
    adjudication_version: "adjudicator-v1",
    arm_config_hash: `${arm}-config-sha256`,
    invocation_id: `invocation-${arm}-${sample}-${number}`,
    session_id: `session-${arm}-${sample}-${number}`,
    model_invocations: 1,
    input_characters: arm === "candidate" ? 80 : 100,
    output_characters: arm === "candidate" ? 40 : 60,
    wall_clock_ms: arm === "candidate" ? 90 : 100,
    physical_sessions: 1,
    retries: 0,
    findings: [],
    ...overrides,
  };
}

test("three-trial aggregation compares stable blockers and observable cost", () => {
  const blocker = { semantic_key: "missing-rollback", severity: "blocker", validation: "confirmed" };
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [
        trial("baseline", "s1", 1, { findings: [blocker] }),
        trial("baseline", "s1", 2, { findings: [blocker] }),
        trial("baseline", "s1", 3),
      ],
      candidate: [
        trial("candidate", "s1", 1, { findings: [blocker] }),
        trial("candidate", "s1", 2, { findings: [blocker] }),
        trial("candidate", "s1", 3),
      ],
    },
  };
  const result = aggregateExperiment(experiment);
  assert.equal(result.evidence_gates_pass, true);
  assert.equal("pass" in result, false);
  assert.equal(result.acceptance_status, "provisional");
  assert.equal(result.independence_verified, false);
  assert.equal(result.stability_threshold, 2);
  assert.deepEqual(result.comparisons.s1.candidate.stable_confirmed_blockers, ["missing-rollback"]);
  assert.ok(result.comparisons.s1.candidate.output_characters < result.comparisons.s1.baseline.output_characters);
});

test("aggregation rejects missed stable blockers, worse noise, and missing trials", () => {
  const blocker = { semantic_key: "unsafe-close", severity: "blocker", validation: "confirmed" };
  const noise = { semantic_key: "noise", severity: "should_fix", validation: "unsupported" };
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [
        trial("baseline", "s1", 1, { findings: [blocker] }),
        trial("baseline", "s1", 2, { findings: [blocker] }),
        trial("baseline", "s1", 3),
      ],
      candidate: [
        trial("candidate", "s1", 1, { findings: [noise] }),
        trial("candidate", "s1", 2, { findings: [noise] }),
        trial("candidate", "s1", 3, { input_characters: 200, output_characters: 200 }),
      ],
    },
  };
  const result = aggregateExperiment(experiment);
  assert.equal(result.evidence_gates_pass, false);
  assert.match(result.failures.join("\n"), /misses stable blockers|unsupported findings per trial increased|total characters did not decrease/i);

  experiment.arms.candidate.pop();
  assert.throws(() => aggregateExperiment(experiment), /exactly 3 trials/);
});

test("aggregation rejects vacuous experiments and malformed findings", () => {
  assert.throws(() => aggregateExperiment({
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: { baseline: [], candidate: [] },
  }), /at least one sample and trial/);

  const malformed = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [
        trial("candidate", "s1", 1, { findings: [{ semantic_key: "noise", severity: "other", validation: "unsupported " }] }),
        trial("candidate", "s1", 2),
        trial("candidate", "s1", 3),
      ],
    },
  };
  assert.throws(() => aggregateExperiment(malformed), /invalid finding severity|validation/);
});

test("unsupported noise cannot be diluted and blocker severity must be stable", () => {
  const unsupported = { semantic_key: "noise", severity: "should_fix", validation: "unsupported" };
  const confirmed = (key) => ({ semantic_key: key, severity: "advisory", validation: "confirmed" });
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1, { findings: [unsupported] }), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [
        trial("candidate", "s1", 1, { findings: [unsupported, confirmed("a")] }),
        trial("candidate", "s1", 2, { findings: [unsupported, confirmed("b")] }),
        trial("candidate", "s1", 3, { findings: [confirmed("c")] }),
      ],
    },
  };
  const result = aggregateExperiment(experiment);
  assert.equal(result.evidence_gates_pass, false);
  assert.match(result.failures.join("\n"), /unsupported findings per trial increased/i);

  const mixedSeverity = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [
        trial("candidate", "s1", 1, { findings: [{ semantic_key: "mixed", severity: "blocker", validation: "confirmed" }] }),
        trial("candidate", "s1", 2, { findings: [{ semantic_key: "mixed", severity: "advisory", validation: "confirmed" }] }),
        trial("candidate", "s1", 3),
      ],
    },
  };
  const mixed = aggregateExperiment(mixedSeverity);
  assert.equal(mixed.comparisons.s1.candidate.stable_findings[0].severity, "mixed");
  assert.deepEqual(mixed.comparisons.s1.candidate.stable_confirmed_blockers, []);
});

test("aggregation enforces comparable runtime, global trial ids, sessions, and retries", () => {
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [trial("candidate", "s1", 1), trial("candidate", "s1", 2), trial("candidate", "s1", 3)],
    },
  };
  experiment.arms.candidate[0].model = "different-model";
  assert.throws(() => aggregateExperiment(experiment), /same runtime and model/);

  experiment.arms.candidate[0].model = "test-model";
  experiment.arms.candidate[0].trial_id = experiment.arms.baseline[0].trial_id;
  assert.throws(() => aggregateExperiment(experiment), /duplicate global trial_id/);

  experiment.arms.candidate[0].trial_id = "candidate-s1-new";
  experiment.arms.candidate[0].physical_sessions = 2;
  experiment.arms.candidate[1].retries = 1;
  const result = aggregateExperiment(experiment);
  assert.equal(result.evidence_gates_pass, false);
  assert.match(result.failures.join("\n"), /physical sessions increased|retries increased/i);
});

test("severity and validation must be stable as one joint state", () => {
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [
        trial("candidate", "s1", 1, { findings: [{ semantic_key: "x", severity: "blocker", validation: "unsupported" }] }),
        trial("candidate", "s1", 2, { findings: [{ semantic_key: "x", severity: "blocker", validation: "confirmed" }] }),
        trial("candidate", "s1", 3, { findings: [{ semantic_key: "x", severity: "advisory", validation: "confirmed" }] }),
      ],
    },
  };
  const result = aggregateExperiment(experiment);
  assert.deepEqual(result.comparisons.s1.candidate.stable_confirmed_blockers, []);
  assert.deepEqual(result.comparisons.s1.candidate.stable_findings[0], {
    semantic_key: "x",
    appearances: 3,
    severity: "mixed",
    validation: "mixed",
  });
});

test("aggregation requires unique runtime provenance and a positive wall-clock ratio", () => {
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [trial("candidate", "s1", 1), trial("candidate", "s1", 2), trial("candidate", "s1", 3)],
    },
  };
  experiment.arms.candidate[0].invocation_id = experiment.arms.baseline[0].invocation_id;
  assert.throws(() => aggregateExperiment(experiment), /duplicate runtime invocation_id/);

  experiment.arms.candidate[0].invocation_id = "unique-invocation";
  experiment.arms.candidate[0].session_id = experiment.arms.baseline[0].session_id;
  assert.throws(() => aggregateExperiment(experiment), /duplicate runtime session_id/);

  experiment.arms.candidate[0].session_id = "unique-session";
  experiment.max_candidate_wall_clock_ratio = -1;
  assert.throws(() => aggregateExperiment(experiment), /must be positive/);
});

test("preflight rejects paths outside the pinned repository", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "plan-review-path-"));
  git(repo, "init");
  git(repo, "config", "user.email", "eval@example.invalid");
  git(repo, "config", "user.name", "Eval Fixture");
  fs.writeFileSync(path.join(repo, "plan.md"), "# Plan\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  assert.throws(() => runPreflight({
    candidate_id: "bad-path",
    repo,
    base_revision: "HEAD",
    candidate_files: ["plan.md"],
    checks: [{ id: "outside", type: "path_absent", path: "../outside", summary: "outside absent" }],
  }), /normalized repo-relative path/);
});

test("aggregation rejects unsafe counts, whitespace IDs, and malformed ratios", () => {
  const experiment = {
    trials_required: 3,
    provenance_mode: "self_reported",
    preflight: { candidate_hash: "artifact-sha256", resolved_base_revision: "base-commit-sha", summary: { failed: 0 } },
    baseline_arm: "baseline",
    candidate_arm: "candidate",
    arms: {
      baseline: [trial("baseline", "s1", 1), trial("baseline", "s1", 2), trial("baseline", "s1", 3)],
      candidate: [trial("candidate", "s1", 1), trial("candidate", "s1", 2), trial("candidate", "s1", 3)],
    },
  };
  experiment.arms.baseline[0].wall_clock_ms = Number.MAX_VALUE;
  assert.throws(() => aggregateExperiment(experiment), /safe integer/);

  const largeSafeCount = Math.floor(Number.MAX_SAFE_INTEGER / 2);
  for (const baselineTrial of experiment.arms.baseline) baselineTrial.wall_clock_ms = largeSafeCount;
  assert.throws(() => aggregateExperiment(experiment), /exceeds the safe integer range/);

  for (const baselineTrial of experiment.arms.baseline) baselineTrial.wall_clock_ms = 100;
  experiment.arms.candidate[0].invocation_id = `${experiment.arms.baseline[0].invocation_id} `;
  assert.throws(() => aggregateExperiment(experiment), /leading or trailing whitespace/);

  experiment.arms.candidate[0].invocation_id = "unique-invocation";
  experiment.max_candidate_wall_clock_ratio = "2";
  assert.throws(() => aggregateExperiment(experiment), /finite number/);

  experiment.max_candidate_wall_clock_ratio = Number.MAX_VALUE;
  assert.throws(() => aggregateExperiment(experiment), /must not exceed 10/);

  experiment.max_candidate_wall_clock_ratio = 1.1;
  for (const armTrials of Object.values(experiment.arms)) {
    for (const run of armTrials) run.artifact_hash = "different-artifact";
  }
  assert.throws(() => aggregateExperiment(experiment), /match the supplied preflight candidate hash/);
});
