---
name: e2e-test-workflow
description: >
  Plan, run, and present end-to-end tests as one workflow: write a source-backed
  E2E, integration, acceptance, or regression test plan when none exists, execute
  the plan's scenarios against a local or test environment, and render desktop
  HTML views of the plan and the execution report. Use for any E2E / 端到端 /
  全链路 / 验收 ask — planning scenarios or coverage, 跑 / 执行 / 重跑 a plan or
  report, or turning an existing E2E plan or execution report into HTML. A unit
  or focused test run uses the repository's own test commands; a plain RPC or
  facade call with no acceptance scenario is an ordinary call.
argument-hint: "[plan | run | render] [feature, plan, or report]"
---

# E2E Test Workflow

Route one E2E ask to its mode, then follow the stage files, each read only when its
stage starts: [plan/PLAN.md](plan/PLAN.md), [run/RUN.md](run/RUN.md), and
[READER-VIEW.md](READER-VIEW.md) for the HTML views. Each stage file sets its own
language policy; an HTML view follows its source Markdown unless the user explicitly
requests another language.

## Pick the mode

An unquoted `plan`, `run`, or `render` standing first after an explicit invocation
(`/e2e-test-workflow run …` in Claude Code, `$e2e-test-workflow run …` in Codex)
selects the mode and outranks conflicting prose; quoted feature names and paths are
operands. Without one, infer the mode from the whole ask:

| Mode | Stages | Selected by |
|---|---|---|
| plan | Plan → render, no execution | `plan`, or 计划 / 场景 / 覆盖 without an ask to run |
| run | Execute → render; when no plan exists, plan → render first | `run`, or an ask to 跑 / 执行 / 重跑 |
| render | Render an existing plan or report, nothing else | `render`, or an ask for the HTML view of an existing artifact |

For run and render, the artifact is the plan (`*-e2e-test-plan.md`) or execution
report (`*-e2e-test-report.md`) the ask names, otherwise the newest one under
`.scratch/{feature}/e2e/` — plans there, reports under its `runs/`. Resolve the feature
from the ask, then from the task the conversation is already about; only when neither
names one, take the newest across `.scratch/*/e2e/`, say which feature that was, and
ask when two are equally recent. A report means a continuation. A named artifact that does not exist is reported as missing, and render
never creates a substitute plan. A scenario described only in the ask is planning
input, however complete it reads; the planning rules scale a plan down to one
scenario. State the mode and the artifacts it starts from before reading any stage's
rules.

## Run the stages

- **plan**: read [plan/PLAN.md](plan/PLAN.md) and follow it through its HTML view;
  its closing hand-off section is for run mode and is not read here.
- **run**: with a plan on disk, read [run/RUN.md](run/RUN.md) and follow it here; it
  ends with the report and its HTML view. Without one, plan first and follow the plan
  file's closing hand-off section, which carries execution on.
- **render**: hand the named artifact to a fresh-context agent per the hand-off in
  [READER-VIEW.md](READER-VIEW.md); without subagents, read that file and author the
  view here.

Deliver with the HTML view first when it exists, then the canonical Markdown, and the
summary the stage file specifies.
