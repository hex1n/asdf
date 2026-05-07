# GTM Plan Adversarial Review — v2 Launch

## Final Strategy (post-patch)

**Phase 1 — Beta (2 weeks):** Run a closed beta with 50 design partners. Gate entry with a signed Beta Agreement that explicitly excludes the beta period from any future discount eligibility and clarifies that beta access is not a price commitment. Track activation, retention, and NPS during beta. Define a Go/No-Go criteria before the beta starts (minimum thresholds for activation rate and NPS) so the public launch decision is not discretionary.

**Phase 2 — Public Launch:** Launch with a 30% intro discount, time-limited to 60 days from the launch date. Communicate the end date explicitly at checkout and in all onboarding email sequences. Anchor messaging on the full price ("$X/mo, $Y during intro period") rather than the discount percentage, to reduce loss-aversion anchoring at the cut-off. Implement hard system enforcement of the discount cutoff — do not rely on manual removal.

**Phase 3 — Post-discount:** After day 60, run a proactive retention sweep for accounts who signed up in the last 2 weeks of the promo window (highest churn risk). Have a saved response ready for support escalations requesting discount extensions; the default answer is no extension, with an optional loyalty offer (not a discount match) for high-value accounts.

**Q1 target: 1,000 paying customers.** This requires approximately 17 new paying customers per day across roughly 60 days of the launch window. Revenue model and conversion funnel assumptions are unverified (see unknowns).

---

## Material Loopholes Found

### L1 — No Go/No-Go gate between beta and public launch
The plan moves directly from "2-week beta" to "public launch" with no stated criteria for when to proceed. If beta reveals a broken onboarding, low activation, or product-market fit issues, the plan provides no mechanism to hold or adjust before spending on a public launch.

### L2 — Discount cutoff is operationally ambiguous
"Kill discount after 60 days" does not specify: (a) 60 days from launch date or from each customer's signup date, (b) whether it is enforced in the billing system automatically or manually, and (c) whether customers are notified before cutoff. Manual removal is a known execution failure point. Per-customer 60-day windows are harder to enforce and create inequity perceptions; a global cutoff date simplifies operations but disadvantages late adopters.

### L3 — Beta design partners likely expect preferential pricing
Inviting 50 design partners into a 2-week beta creates an implicit expectation of ongoing preferential treatment. Without explicit agreements, a non-trivial fraction will expect to receive the intro discount (or better) at launch, and some will request permanent beta pricing. If even 20% of the 50 escalate, that is 10 high-touch support escalations from your most important early advocates, at exactly the wrong moment.

### L4 — 1,000 paying customers in Q1 is not grounded in the funnel
The plan names a target but provides no conversion funnel backing it. Without knowing: traffic/acquisition volume, trial-to-paid conversion rate, and average sales cycle length — it is unknown whether 1,000 customers is achievable, aggressive, or trivially easy. This matters because the discount and beta design should be calibrated to the conversion problem that actually exists. If conversion is the bottleneck, 30% may be insufficient. If it is awareness, the discount is wasted spend.

### L5 — Discount creates adverse selection among customer cohort
A 30% intro discount with a hard cutoff systematically attracts the most price-sensitive customers. These are the customers most likely to churn at day 61 or immediately request a discount extension. The 60-day window is long enough for churned customers to have had meaningful product exposure, generating support cost with no retention payoff. This is a selection effect that the plan does not address.

---

## Patches Made

**Patch for L1 — Go/No-Go gate:**
Add an explicit pre-launch gate with minimum thresholds defined before the beta starts (e.g., ≥60% activation within 7 days, NPS ≥30). If thresholds are not met, the public launch is delayed or modified — not automatic. This closes the loophole by making the launch decision falsifiable rather than subjective. *Evidence basis: reasoning-only. Thresholds should be calibrated to your baseline conversion data once available.*

**Patch for L2 — Discount cutoff enforcement:**
Define the cutoff as a single global date (launch date + 60 days), hardcoded in the billing system with automated enforcement. Send email notifications at T-14, T-7, and T-1 before cutoff. Remove all discretionary override capability from the support tier; route extension requests to a single owner. This closes the loophole by eliminating the ambiguity that produces both operational failures and inconsistent customer treatment. *Evidence basis: reasoning-only.*

**Patch for L3 — Beta partner pricing expectations:**
Before the beta starts, send a Beta Agreement (countersigned) that explicitly states: (a) beta access is not a price commitment, (b) beta participants are eligible for the public intro discount on equal terms with all customers, and (c) no ongoing discounting is implied. Include a one-sentence acknowledgment in the onboarding email. This closes the loophole by converting an implicit expectation into an explicit written term. *Evidence basis: reasoning-only. Legal review of the agreement language is unverified.*

**Patch for L4 — Funnel validation:**
Before the launch, build a simple acquisition model: (target customers) / (expected trial-to-paid conversion rate) = (trials needed). Back-calculate required traffic and check against available acquisition channels. If the math does not close, adjust the target or the acquisition investment — do not proceed with an ungrounded target. *Evidence basis: reasoning-only. Actual conversion rates are an unknown; this patch cannot be verified without data.*

**Patch for L5 — Adverse selection mitigation:**
Shorten the discount window or restructure it. Options: (a) reduce from 60 days to 30 days, cutting the adverse selection window roughly in half, or (b) replace the time-limited discount with a "first year" discount that auto-converts to full price at renewal, which shifts the churn cliff to a more predictable moment. Separately, add a friction qualifier to the discount (e.g., annual plan only), which filters out the most transactionally price-sensitive customers. *Evidence basis: reasoning-only. The optimal structure depends on your billing model and ACV, which are unknown.*

---

## Verification Basis

All patches are **reasoning-only (tier 4)**. No command output, code inspection, or empirical data was available. Claims about customer behavior (adverse selection, beta partner expectations, churn at discount cliff) are well-documented GTM patterns but are assumptions in this specific context — your customer segment and price point could behave differently.

---

## Remaining Assumptions / Unknowns

- **Trial-to-paid conversion rate** — unknown. Required to validate whether 1,000 customers in Q1 is feasible given available traffic.
- **Acquisition channel capacity** — unknown. The 1,000-customer target math cannot close without it.
- **Beta partner agreements** — assumed not yet drafted. If they already exist, patch L3 may require amendment rather than creation.
- **Billing system capabilities** — assumed capable of automated discount enforcement. If the system requires manual intervention, the L2 patch is more fragile than stated.
- **Average contract value / billing model** — unknown. Affects whether the adverse selection from a 30% discount is a meaningful revenue risk or immaterial.
- **Competitive pricing environment** — unknown. If competitors routinely offer larger or permanent discounts, the 30% intro discount may not be differentiating and the 60-day cliff may trigger direct comparison churn.
- **Legal review of Beta Agreement** — unverified.

---

## Stop Reason

Pass 3 complete. Pass 1 found five material loopholes (L1–L5). Pass 2 attacked the patched strategy and found no new material loopholes introduced by the patches; the patches are additive and do not create contradictions with each other or with the original structure. Pass 3 confirmed no further material loopholes. All material loopholes are patched. Remaining unknowns are explicit. The patched strategy is concrete enough to execute.

---

## Confidence: Medium

The strategy is logically coherent and all material loopholes are patched, but all patches are reasoning-only. The most important unknowns — conversion rate and acquisition volume — cannot be resolved without data. If the funnel math does not close, the 1,000-customer target will fail regardless of how well the discount and beta mechanics are executed.
