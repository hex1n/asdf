# Verification techniques

Read the section for the selected technique. These techniques supplement the
behavioral and structural verification chosen in [Arborist](../SKILL.md).

## Targeted mutation and fault injection

Ask whether the checks would detect a plausible wrong implementation of an
affected property. Select faults from the behavior and its dependencies,
including relocated logic and retained guards, rather than changed lines alone.

Use an available native mutation tool when its operators fit the risk. A small
manual mutation is sufficient when it answers the question without introducing
tooling overhead. For recovery, retries, and concurrency, inject the relevant
dependency failure or controlled interleaving instead of forcing a source edit.

For each selected fault:

1. Run the relevant baseline and confirm the intended checks execute.
2. Introduce one representative fault in an isolated copy or test harness.
3. Confirm the code under test includes the fault and the intended observation
   detects its consequence.
4. Remove or restore only that experimental change, then rerun the check on the
   actual implementation.

Keep experiments out of shared installations, live data, and live services.
Preserve concurrent edits when restoring a local experiment. A compile failure,
unrelated exception, or harness failure does not show that a behavioral check
detects the intended defect.

Interpret the result by cause:

- **Detected:** the intended check fails for the affected property.
- **Missed:** the fault is reachable and behaviorally meaningful, but the checks
  pass. Strengthen the observation or case and investigate the uncovered risk.
- **Not exercised:** the faulted path was not reached; coverage remains open.
- **Equivalent or irrelevant:** explain why the fault cannot violate this
  contract under supported inputs. Do not count it as detected.
- **Invalid or inconclusive:** the fault or execution failed before the intended
  behavior could be observed. Correct the experiment or report the limitation.

Investigate meaningful survivors rather than optimizing a score. A result
belongs to the exact test and implementation it ran against: editing,
renaming, or retargeting a test afterwards invalidates it, so rerun the fault
against the final test before citing it. Keep the property, decisive command
and result, and remaining gap with the task's evidence.

## Focused independent review

Use a fresh-context agent or an appropriate human reviewer when available and
permitted. The reviewer derives failure cases from the requirements and the code
before seeing the builder's checklist, test conclusions, mutation results, or
suggested findings.

### Brief the reviewer

Give the reviewer:

- the original task and requirements, and the scope boundary;
- the final diff and access to the relevant raw source;
- the before-state when the diff hides it: uncommitted work that adds untracked
  files or continues earlier uncommitted changes needs a snapshot, patch, or
  explicit list of what existed before, otherwise moves, dedupes, and deletions
  are misread;
- the target: the changed contracts, the entry points that reach them, and the
  paths the builder's trace left unresolved. A second full trace is the
  builder's job; the review's budget goes to falsifying the changed contracts;
- the available repository gate commands and their coverage boundaries. Share
  prior results after the reviewer derives its initial failure cases, so they
  can avoid redundant runs without anchoring that first derivation;
- the focus questions below that this change actually threatens, usually two
  or three, with the others left out. A consolidated guard threatens the
  obligation and coverage questions; a moved decision threatens the ownership
  question. A reviewer handed every question sweeps wide and thin, and the
  one finding that needed a single experiment gets diluted across a full tour;
- the report format: findings first, each naming the violated contract or
  structural goal, source or execution evidence with file and line, and the
  consequence; then what was checked and found sound; then what stayed unverified.

Focus the review on the changed contracts and structural targets:

- Does the implementation deliver the intended outcome without preserving the
  defect as its oracle?
- Are affected entry points, data producers, consumers, and reachable mixed
  states missing from the change or its verification?
- Do removed or consolidated guards still protect their original obligations?
- Are decision ownership, caller knowledge, and dependency direction improved
  as requested? Does each new abstraction have a concrete purpose?
- Are obsolete paths actually removable, and have temporary structures met
  their exit conditions?
- Do the checks execute the relevant code and observe the behavior they claim?

### Disposition of findings

Verify each finding before changing code, then give it one disposition and
report all of them, sub-items included, whether or not you acted on them:

- **Confirmed, in scope:** repair and rerun the affected checks.
- **Confirmed, pre-existing or outside the requested scope:** report it with
  its reproduction as an open decision for the user. Tests that lock the
  behavior show it is characterized, not that it is required, as the contract
  section of [Arborist](../SKILL.md#establish-the-contract) states; the
  builder alone does not settle it, and the finding keeps its confirmed label.
- **Refuted:** state the evidence that refutes it.
- **Unverified:** keep it open and say why.

When your evidence and the reviewer's conclusion point opposite ways, the
report carries both, side by side, with the observation each rests on. The
user decides; the builder does not settle it by relabeling the finding.

Severity is judged against this change: a defect the diff did not introduce is
reported as pre-existing, whatever label the reviewer gave it.

## Review lifecycle

Before dispatch, check whether a completed or active independent review covers
the same candidate, scope, and supporting inputs. Reuse valid completed
evidence or await the applicable active review rather than launching another.
An installed review skill is optional: give it to the selected reviewer,
not to a second reviewer. Keep the reviewer context separate from the builder.

Dispatch once the diff is reviewable and continue the remaining checks.
Revisit only the affected conclusions after a material repair, a new path,
an unresolved material finding, or a change to supporting source, configuration,
dependencies, or runtime assumptions. A stable diff alone does not preserve
review evidence.

A review finding or approval cannot substitute for runtime evidence. If a
required review cannot run, fails, or its independence cannot be established,
report it as blocked with the observed cause. Continue implementation and
checks that do not depend on it. Local self-checks remain the builder's work,
not fulfillment of the independent-review requirement. Keep unmet requirements
and high-impact unknowns open.

Only an explicit user decision can change a user-owned review requirement.
Permission to self-review is not completion of an independent-review gate
and does not waive repository-mandated review.
