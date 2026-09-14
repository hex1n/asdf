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

1. Run the baseline on the unmutated code and confirm the intended checks
   execute and pass. Only a passing check can detect a fault.
2. Introduce one representative fault in an isolated copy or test harness.
3. Confirm the code under test includes the fault and the intended observation
   detects its consequence.
4. Remove or restore only that experimental change, then rerun the check on the
   actual implementation.

Keep experiments out of shared installations, live data, and live services.
Preserve concurrent edits when restoring a local experiment. A compile failure,
unrelated exception, or harness failure does not show that a behavioral check
detects the intended defect.

Interpret each result by cause. A verdict is differential and per test: the
test passed on the baseline and fails on the fault, on the assertion for the
property under test; an exit code only locates a failure. A scripted batch
records this for every fault.

- **Detected:** the intended check fails for the affected property.
- **Missed:** the fault is reachable and behaviorally meaningful, but the checks
  pass. Strengthen the observation or case and investigate the uncovered risk.
- **Not exercised:** the faulted path was not reached; coverage remains open.
- **Equivalent or irrelevant:** explain why the fault cannot violate this
  contract under supported inputs. Do not count it as detected.
- **Invalid or inconclusive:** the fault or execution failed before the intended
  behavior could be observed, including a harness or test double lacking the
  input the fault now reaches. Correct the experiment or report the limitation.

Investigate meaningful survivors rather than optimizing a score. A result
belongs to the exact test and implementation it ran against: editing,
renaming, or retargeting a test afterwards invalidates it, so rerun the fault
against the final test before citing it. Keep the property, decisive command
and result, and remaining gap with the task's evidence.
