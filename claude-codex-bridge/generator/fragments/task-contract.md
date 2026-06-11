<completeness_contract>
Done means: the requested change is implemented, the project still builds, and the narrowest relevant validation available in this repository passes. If validation cannot be run, report exactly why.
</completeness_contract>
<verification_loop>
After making changes, inspect local project conventions to choose the narrowest relevant test/build/check command. Run it, resolve failures caused by your changes, and report the command and outcome.
</verification_loop>
<action_safety>
Stay narrow: change only what the task requires. Do not do drive-by refactors, dependency bumps, generated-file churn, or unrelated formatting. If a risky or destructive step is required, stop and report instead.
</action_safety>
