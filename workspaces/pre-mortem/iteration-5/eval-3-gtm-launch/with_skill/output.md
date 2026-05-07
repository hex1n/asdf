# Loophole Closure Loop — GTM v2 Launch Plan

**Success condition:** End Q1 with 1,000 paying customers without revenue or reputational damage from the discount mechanics or beta program.

---

## Final strategy

**Phase 0 — Beta (weeks 1–2):**
Recruit 50 design partners with explicit, signed beta agreements that state: (a) beta access is time-limited and ends at public launch, (b) design partners receive a named, expiring post-launch benefit (e.g., "Founding Customer" pricing locked for 12 months, not the public 30% intro discount), and (c) beta feedback is covered by NDA. Do not offer "free forever" access. Track activation, usage depth, and NPS for all 50 partners before launch gate.

**Phase 1 — Public launch (day 1 onward):**
Publish the 30% intro discount with a hard, visible expiration date ("expires [DATE], 60 days from launch") shown at every pricing touchpoint — landing page, checkout, email sequences, and in-app upgrade prompts. The date must be machine-enforced at the billing layer, not only in copy.

**Phase 2 — Discount sunset (day 61):**
On day 61, remove the discount code from all active flows. Provide a 7-day advance warning email to leads who opened pricing pages but did not convert. Do not grandfather any cohort silently; if exceptions are made for enterprise procurement cycles, document them explicitly as named exceptions with an approval gate and a hard outer deadline no later than day 90.

**Phase 3 — Q1 close:**
Track weekly: new trials, trial-to-paid conversion rate, churn from discount-era cohort, and run-rate vs. 1,000-customer target. If conversion rate falls below the threshold needed to reach 1,000 by Q1 end (derive this from trial volume and observed conversion), trigger a defined escalation — either a second limited campaign or a pricing-model adjustment — before the last 3 weeks of Q1.

---

## Material loopholes found

**L1 — Beta partners expect perpetual or grandfathered access (selection effect + reputational damage)**
Design partners often interpret "beta access" as a permanent benefit. Without explicit written terms, partners who are not converted to paid at launch will feel deceived, post negative reviews, or publicly complain — directly violating the no-reputational-damage condition. This meets the material bar: a plausible real input (even one vocal design partner) can cause reputational damage before Q1 closes.

**L2 — Discount expiration is copy-only, not billing-layer enforced (silent revenue leak + execution gap)**
If the 60-day kill is implemented by editing a promo code or flipping a UI flag but not enforced at the billing API/checkout layer, a determined user can: bookmark a deep-link checkout URL that still carries the code, replay a cached page, or exploit a race condition at rollover. This silently undercharges post-day-60 customers. Material: concrete input (checkout replay) causes the strategy to fail the no-revenue-damage condition.

**L3 — No conversion-rate tracking means the 1,000-customer target has no early-warning signal (incomplete execution path)**
The plan jumps from "kill discount on day 61" to "Q1 target of 1,000." There is no stated mechanism to detect that you are off-track with enough runway to correct. If trial volume or conversion rate is insufficient, this is only visible at Q1 close — too late to act. Material: the strategy is non-executable as a recoverable plan without a mid-quarter signal.

**L4 — Enterprise procurement timing conflicts with 60-day discount sunset (external/competitive response + reputational damage)**
Enterprise or mid-market buyers frequently require 4–8 weeks of internal procurement review. A buyer who starts evaluation on day 30 cannot close by day 60. Refusing the discount for a buyer who was actively in-process (and may have been told the discount applies) creates a reputational and trust risk. Silently extending the discount for some buyers while enforcing it for others creates fairness perception risk. Material: a concrete enterprise customer scenario causes both revenue damage (deal lost or discounted past deadline) and reputational damage.

**L5 — No launch-gate criterion on beta (unverified premise)**
The plan assumes the 2-week beta produces sufficient signal to proceed to public launch. If all 50 partners have low activation or report critical bugs, launching publicly anyway causes reputational damage. No criterion is stated for "beta passed." Material: if beta produces negative signal and launch proceeds regardless, early public reviews replicate the damage.

---

## Patches made

**P1 — Closes L1:** Before beta begins, issue signed beta agreements explicitly stating access terms, post-launch pricing treatment, and the absence of any "free forever" clause. The design-partner benefit should be a separately named, clearly scoped "Founding Customer" rate (e.g., 20% lifetime discount or 12-month price lock), distinct from the public 30% intro offer. This removes the ambiguity that creates the expectation gap.
- Evidence basis: reasoning-only. Supported by standard SaaS design-partner practice and the documented risk that ambiguous beta terms produce churn and review damage at launch.
- Remains unverified: specific discount level and whether existing design-partner commitments have already been made without written terms.

**P2 — Closes L2:** Enforce the discount sunset at the billing-layer coupon/SKU level (Stripe coupon expiration date, or equivalent in your billing system), not only in front-end copy. Test the rollover in staging before launch. The 60-day date must be set at coupon creation, not as a to-do on day 59.
- Evidence basis: reasoning-only. Billing-layer enforcement is the standard control for time-limited promotions; copy-only enforcement is a known failure mode.
- Remains unverified: which billing system is in use and whether it supports date-gated coupons natively.

**P3 — Closes L3:** Add a weekly conversion-rate dashboard tracking: new trials started, trials converted to paid, discount-cohort churn, and projected Q1 customers at current rate. Define a go/no-go escalation trigger (e.g., "if projected Q1 customers fall below 800 with more than 3 weeks remaining, activate campaign B"). This must be defined before launch, not reactively.
- Evidence basis: reasoning-only. Standard growth-accounting practice.
- Remains unverified: actual trial volume, conversion rate, and what campaign B consists of.

**P4 — Closes L4:** Add an explicit "procurement exception" policy: buyers who submit a signed order form or LOI before day 60 may have their discount honored up to day 90, subject to named approval. Publish this policy in the sales playbook (not on the public pricing page). This closes the fairness gap by making the exception rule-bound rather than ad hoc, while preserving the hard outer deadline.
- Evidence basis: reasoning-only. Common SaaS deal-desk practice.
- Remains unverified: sales motion (PLG vs. sales-assisted), which determines how common procurement-cycle conflicts will be.

**P5 — Closes L5:** Define a beta launch gate before the beta begins: minimum criteria to proceed to public launch (e.g., 70% of design partners activated core feature, NPS ≥ 30, no P0 bugs open). If criteria are not met at week 2, add a 1-week slip allowance before escalating to a go/no-go decision.
- Evidence basis: reasoning-only. Standard beta-gate practice.
- Remains unverified: what "core feature activation" means for this product, and whether the Q1 timeline can absorb a 1-week slip.

---

## Verification basis

All patches are **reasoning-only (verification hierarchy tier 4)**. No billing system was inspected, no beta agreements were reviewed, no conversion data was available, and no commands or tests were run. The loopholes and patches are supported by explicit logical reasoning, named concrete failure scenarios, and documented SaaS GTM practice — but none have been verified against the actual product, billing infrastructure, or existing partner commitments.

---

## Remaining assumptions / unknowns

- **Pricing level unknown.** The absolute price of v2 is not stated. If price-point is high (enterprise), the procurement-cycle loophole (L4) is more likely to be triggered frequently. If it is low (self-serve PLG), it may be rare.
- **Existing beta commitments unknown.** If verbal or written promises have already been made to design partners about pricing or access, P1 may require retroactive re-negotiation, which is harder and riskier than prospective agreements.
- **Trial volume and conversion rate unknown.** P3's escalation trigger cannot be numerically calibrated without a baseline conversion rate or expected trial volume. The 1,000-customer target requires knowing the trial funnel.
- **Billing system unknown.** P2's enforcement mechanism depends on the billing provider's coupon expiration support. Some providers require custom logic for date-gated discounts.
- **Q1 calendar overlap unknown.** The plan says "next quarter" and "Q1 target." If the public launch happens in November, the 60-day window straddles a holiday procurement pause, compressing the effective selling window and making L4 more severe.
- **Competition / market alternatives unknown.** The plan assumes demand is sufficient to reach 1,000 paying customers organically in Q1. If a competitor runs a comparable launch in the same window, the discount may need to remain competitive longer than 60 days.

---

## Stop reason

Pass 1 found 5 material loopholes; all were patched. Pass 2 was run against the patched whole strategy. Pass 2 found no new material loopholes introduced by the patches — patches are additive (written agreements, billing enforcement, a dashboard, a policy document, a launch gate) and do not create new interdependencies that break the strategy. Stop condition met: no known material loopholes remain, all patches have a stated verification basis, unresolved assumptions are explicit, and the final strategy is concrete enough to execute.

---

## Confidence: Medium

The strategy is logically coherent and all five material loopholes are patched. Confidence is Medium rather than High because: (a) all patches are reasoning-only — no billing system, agreements, or conversion data were inspected; (b) two unknowns (existing beta commitments, Q1 calendar overlap) could materially change the severity of L1 and L4; and (c) the 1,000-customer target cannot be validated as achievable without trial-funnel data.
