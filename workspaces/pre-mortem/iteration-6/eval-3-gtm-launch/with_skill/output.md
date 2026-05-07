# GTM Launch Plan — Hardened Strategy

## Final Strategy

**Phase 0 — Beta (Weeks 1–2)**
Recruit 50 design partners under a signed Design Partner Agreement (DPA) that:
- Grants them a named, locked-in lifetime discount (e.g., 20% off, labeled "Founding Partner") as their beta benefit — separate from and clearly distinguished from the public 30% intro discount.
- Explicitly states they are NOT eligible for the public 30% intro discount (prevents double-stacking).
- Requires a minimum feedback commitment (e.g., two structured sessions) to activate the discount benefit.
- Includes a confidentiality clause covering pricing and unreleased features.

Instrumentation: tag every beta account with a `cohort=design_partner` flag in billing before public launch.

**Phase 1 — Public Launch (Day 0 through Day 60)**
- Offer a 30% intro discount, time-gated to the first 60 calendar days post-launch.
- Display the exact expiration date (not "60 days") on every pricing page, checkout screen, and in the confirmation email — e.g., "Discount expires [DATE]."
- Apply the discount at the account level, not the seat/plan level, to prevent gaming via plan downgrades and re-upgrades within the window.
- Define "start of discount window" as the public launch date, not the individual customer's signup date, and state this explicitly in Terms of Service and on the pricing page.
- Do not allow the 30% rate to be locked in via annual pre-payment beyond the 60-day window unless that is an intended commercial decision (decide before launch and encode it in billing logic).

**Phase 2 — Discount Sunset (Day 61+)**
- On Day 61, the checkout flow shows full price to new visitors. Existing paying customers retain the rate they signed up at (grandfather by billing record, not by manual process).
- Send a sunset reminder email at Day 45 and Day 58 to all users who started a trial or viewed pricing but have not converted. Frame it as urgency, not apology.
- Prepare a CS playbook for the expected "I missed the deadline" requests: define who (if anyone) can approve a one-time exception, at what discount floor, and require manager sign-off. Publish this internally before Day 61 so individual reps don't make inconsistent promises.

**Phase 3 — Q1 Closing (Day 61 through end of Q1)**
- Back-calculate the customer acquisition rate needed: if "next quarter" is Q1 and "launch" is early in that quarter, 60 days may consume most of Q1. Confirm the timeline arithmetic — see Unknowns.
- Hold a conversion review at Day 30 and Day 50 to check whether the pipeline supports 1,000 customers by quarter-end. If the Day 30 review shows conversion rate below target, do not extend the discount — instead activate an alternate lever (e.g., onboarding concierge, annual plan incentive, or referral program) that does not reopen the discount debate.
- Do not conflate 1,000 activations with 1,000 paying customers. Define "paying customer" in the CRM before launch (e.g., completed first billing cycle, not just credit card on file).

---

## Material Loopholes Found

**L1 — Design partners can claim the public 30% discount on top of (or instead of) their beta benefit.**
The plan runs a beta program and then a public 30% discount with no stated separation. A design partner who receives a modest beta benefit (early access, small courtesy discount) can sign up again at public launch under a new account or simply ask to have the 30% applied. This is a concrete, trivially executable revenue-integrity failure: 50 sophisticated early customers, each with a direct relationship with your sales/CS team, are highly likely to ask.

**L2 — "60-day discount" is ambiguous: 60 days from launch or 60 days from each customer's signup.**
If the discount is per-customer-signup-date, a customer who signs up on Day 59 locks in the discount for another 60 days (until Day 119). This is a common billing implementation default. At scale, late-window signups produce a long tail of discounted revenue that was not in the plan.

**L3 — No conversion rate checkpoint; the plan assumes 1,000 customers will materialize from the pipeline without a stated mechanism to course-correct.**
If conversion is running below target at Day 30, the natural response is "extend the discount." That reopens the revenue and reputational problem the plan was designed to avoid. Without a pre-committed alternative lever, the team will extend the discount under pressure.

**L4 — Selection effect: 30% off for 60 days preferentially attracts price-sensitive customers, increasing churn risk post-discount.**
Customers acquired primarily on price are more likely to churn when they face renewal at full price. If the Q1 target is 1,000 paying customers and the measurement is end-of-Q1 (not end-of-Q2), this loophole may not break the Q1 number — but it will break Q2 retention and make Q1 success misleading. This is material if "paying customers" is intended to mean durable ARR, not just headcount at a point in time.

**L5 — "Kill discount after 60 days" is not operationally specified.**
Who turns it off? If it is a manual billing operation or a feature flag flip, it can be forgotten, delayed, or inconsistently applied (some plans off, some on). A single sales rep saying "I can extend it for you" retroactively undermines the sunset.

---

## Patches Made

**P1 (closes L1):** Design Partner Agreement contractually separates beta benefits from public launch pricing. The DPA explicitly states design partners are ineligible for the 30% intro discount. The `cohort=design_partner` billing tag enforces this in checkout logic (the tag disables the intro discount code for that account). Verification basis: tier 4 (logical reasoning — assumes DPA is legally reviewed and billing tag is implemented before public launch; these are pre-launch engineering/legal tasks, not verified here).

**P2 (closes L2):** Define discount expiration as a fixed calendar date (launch date + 60 days), not per-customer-account age. Display the exact date at every pricing touchpoint. Encode it as a hardcoded billing rule, not a per-account rolling timer. Verification basis: tier 4 (reasoning-only — billing implementation must be validated before launch).

**P3 (closes L3):** Pre-commit to a Day 30 and Day 50 conversion review with an alternative lever menu that does not include discount extension. Identify at least one lever before launch (e.g., onboarding concierge, annual plan discount, referral credit). This makes "extend the discount" not the default under pressure because a decision process with alternatives already exists. Verification basis: tier 4 (reasoning-only).

**P4 (closes L4):** Two options — present both, user chooses scope.

- *Minimum patch:* Add a retention checkpoint at Day 90 (30 days post-discount-end) to measure churn among discount-acquired cohort vs. organic cohort. If churn is materially higher, adjust Q2 CAC and sales messaging before committing to Q2 targets. This doesn't prevent the selection effect but makes it visible before it corrupts planning.

- *Larger alternative:* Replace the 30% time-based discount with cohort-capped "Founding Customer" pricing — e.g., first 500 customers get 20% off permanently (and publicly labeled as such). This closes the selection-effect loophole (customers self-select on product value + status, not pure price), the procurement-gaming loophole (no 60-day window to game), and the sunset-complaint loophole simultaneously. Trade-off: lower headline discount (20% vs. 30%) may reduce conversion velocity; permanent discount reduces LTV vs. a 60-day discount. Choose this if brand positioning and LTV matter more than conversion velocity in Q1.

**P5 (closes L5):** Implement discount expiration as an automated billing rule, not a manual process. Assign a named owner (e.g., RevOps) to verify the cutover on Day 61. Define the CS exception policy in writing before launch (discount floor, approval chain, maximum number of exceptions). Verification basis: tier 4 (reasoning-only — billing automation is a pre-launch engineering task).

---

## Verification Basis

All patches are reasoning-only (tier 4). No code, billing system, CRM, or contract was inspected in this session. The logical chain is sound under the stated assumptions, but the following must be verified before launch:

- Billing system supports account-level cohort tags that can gate promotional codes.
- DPA has been reviewed by legal and signed before beta participants access the product.
- The fixed-date discount expiration is enforced in the billing rule, not in a per-account timer.
- The CS exception policy is written and distributed to all customer-facing staff before Day 61.

---

## Remaining Assumptions / Unknowns

**U1 — Timeline arithmetic is unverified.** "Next quarter" and "Q1 target" are ambiguous. If the public launch is mid-Q1, 60 discount days + conversion lag may leave fewer than 30 remaining days to hit 1,000 customers at full price. If the launch is at the start of Q1 and Q1 is 90 days, the math is feasible. Clarify: what is the assumed launch date relative to Q1 start, and how many days remain after Day 60 to close the gap to 1,000?

**U2 — Conversion rate assumptions are unstated.** The plan asserts 1,000 paying customers is achievable but provides no funnel data (traffic, trial-to-paid rate, ACV) to validate it. If the required conversion rate is implausible given the pipeline, no discount mechanics fix will matter. This is the single assumption most likely to flip the success condition.

**U3 — "Paying customer" definition is unspecified.** Whether a customer counts at trial-start, credit-card-on-file, first charge, or first full billing cycle materially changes whether 1,000 is the right Q1 number.

**U4 — Design partner beta feedback loop is undefined.** The plan assumes 2 weeks of beta produces signal that improves the launch. If feedback is not collected and acted on, beta is a liability (public launch with known bugs or confusion) not an asset. Minimum viable structure: a defined feedback collection mechanism and a go/no-go gate before public launch.

---

## Stop Reason

Three passes were run. Pass 1 found five material loopholes (L1–L5). Pass 2 verified patches and found no new material loopholes introduced by the patches. Pass 3 checked unknowns and timeline — U1 and U2 are unresolved but cannot be closed without user-provided data; they are surfaced as unknowns, not blocked. No material loopholes remain under available evidence. Strategy is concrete enough to execute. Stopping.

---

## Confidence: Medium

Strategy is logically coherent and all material loopholes are patched, but key verification is unavailable: billing system behavior, DPA enforceability, and — most importantly — whether the 1,000-customer pipeline assumption is realistic (U2). If U2 is wrong, the strategy fails the success condition regardless of how cleanly the discount mechanics are executed.
