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

Investigate meaningful survivors rather than optimizing a score. Keep the
property, decisive command and result, and remaining gap with the task's evidence.

## Focused independent review

Use a fresh-context agent or an appropriate human reviewer when available and
permitted. Give the reviewer the original task and requirements, the final diff,
and access to relevant raw source. Have them derive failure cases before seeing
the builder's checklist, test conclusions, or suggested findings.

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

Require material findings to identify the violated contract or structural goal,
supporting source or execution evidence, and consequence. Verify findings before
changing code. Repair confirmed issues within scope and rerun affected checks.

Start with one focused review. Revisit affected conclusions after a material
design repair, discovery of a new path, or an unresolved material finding.
Do not repeat full reviews solely to accumulate approvals. Review evidence must
still apply to the final material revision.

Independence depends on how the reviewer forms its judgment, not the model name.
A review finding or approval cannot substitute for runtime evidence. If an
independent reviewer is unavailable, label self-review accurately, use the
strongest available checks, and disclose the limitation. Keep unresolved
high-impact claims open.
