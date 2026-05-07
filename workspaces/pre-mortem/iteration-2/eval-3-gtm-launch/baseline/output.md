# Adversarial Review: GTM Plan for v2 Launch

## Executive Summary

The plan as stated — 2-week beta with 50 design partners, public launch with a 30% intro discount, discount killed after 60 days, targeting 1,000 paying customers in Q1 — has serious structural weaknesses. Several of its core assumptions are underspecified to the point of being unfalsifiable before it fails. The success condition of 1,000 paying customers in Q1 is achievable in principle but the current plan does not contain the mechanics to reach it. Below is a full stress-test, organized by phase.

---

## Phase 1: The 2-Week Beta with 50 Design Partners

### The beta is too short to de-risk the launch.

Two weeks is enough time to find obvious bugs. It is not enough time to identify churn patterns, onboarding failures, or the gap between "this is interesting" and "I will pay for this." Design partners who signed up as part of a relationship — not as strangers discovering the product — will give systematically softer feedback. They are motivated to be helpful, not to be honest about whether they would renew.

**Risk:** You will ship a product that passes a friendly beta and encounters real resistance the moment it hits a cold market.

### 50 design partners is a proxy for 50 opinions, not market signal.

If these 50 partners are from the same segment, referral chain, or founder network, the signal is narrower than the sample size implies. You need to confirm:
- What is the ICP (ideal customer profile) they represent?
- Are they the same buyer persona who will convert at public launch?
- What is the activation rate within the beta cohort, not just "feedback received"?

**Risk:** You optimize the product for design-partner behavior and miss the cold-traffic buyer entirely.

### No stated success criteria for the beta before launch proceeds.

The plan has no kill switch. What metric, if unmet, delays the public launch? Without a threshold (e.g., 40 of 50 partners activate core workflow, NPS > 30, support ticket volume below X), the beta is a schedule item rather than a validation gate.

**Risk:** You will launch on schedule regardless of what the beta tells you, because there is no mechanism to pause.

---

## Phase 2: Public Launch with 30% Intro Discount

### The discount attracts price-sensitive customers who are most likely to churn.

A 30% discount at launch is a customer acquisition tactic that optimizes for conversion, not for retention. Customers who converted because of the discount have demonstrated price sensitivity as their primary decision variable. When the discount ends after 60 days, a meaningful fraction will re-evaluate, downgrade, or cancel. You will have spent CAC acquiring customers who self-selected for price sensitivity and then face a price increase at day 61.

**Risk:** The 30% discount inflates Q1 customer counts while manufacturing a churn event at day 61, which falls inside Q1 or early Q2 depending on launch timing. If Q1 is January–March and you launch in January, day 60 is around March 1. A churn wave in early March damages Q1 retention metrics even if gross adds look fine.

### "30% intro discount" lacks structural anchoring.

Is this off MSRP? What is MSRP? If you haven't publicly established a full price before the discount, customers have no reference point, and the discount creates no urgency. Urgency requires a credible full price that the customer believes they are avoiding. If the full price isn't established, the discount is just the price.

**Risk:** The discount fails to accelerate conversion because there is no anchoring. You absorb 30% margin compression without the conversion lift that justifies it.

### No stated acquisition channel or volume assumptions.

To get 1,000 paying customers in Q1, you need a funnel. The plan does not specify:
- What channels drive awareness at launch (paid, content, product-led, partnerships)?
- What is the expected conversion rate from trial/visit to paying customer?
- What is the CAC, and does the unit economics support 1,000 customers before the discount ends?

Without these, the 1,000-customer target is not a plan — it is an aspiration. Back-of-envelope: if your conversion rate from free trial to paid is 10%, you need 10,000 trial signups in Q1. If your landing page converts at 3%, you need 333,000 visitors. Where do they come from? At what cost per click? This arithmetic must close before launch, not after.

**Risk:** The plan has no stated acquisition mechanism capable of generating the trial volume required to hit 1,000 paid customers in Q1.

---

## Phase 3: Kill Discount After 60 Days

### "Kill" is not a communication or retention strategy.

What happens to existing customers when the discount ends? If they were acquired at a discounted rate and are now being moved to full price, you have a contractual and positioning problem. If the discount was "introductory" and customers knew it was time-limited, churn at day 61 is a planned event. If customers did not explicitly understand the discount was expiring, this is a negative billing surprise — one of the highest-churn triggers in SaaS.

**Risk:** If "kill the discount" means existing customers' prices increase, expect 20–40% churn within 30 days of that event depending on your segment. If it means only new customers pay full price, state that clearly — this plan does not.

### 60-day cliff creates a measurement illusion.

If Q1 ends roughly at day 90 and the discount ends at day 60, you will likely report strong Q1 customer counts (gross adds boosted by discount conversion) while the churn triggered by the discount end either appears in Q1's final weeks or rolls into Q2. The 1,000-paying-customers target could technically be met at the day-60 mark and then unmet by day 90.

**Risk:** The plan's success metric (1,000 paying customers in Q1) is ambiguous. Is this a count at end-of-Q1, or peak count during Q1? The distinction matters if the discount-end churn event falls within Q1.

---

## Structural Gaps Across the Full Plan

### No stated ACV or price point.

"1,000 paying customers" is meaningless without knowing what they pay. A plan targeting 1,000 customers at $10/month ($120K ARR) requires completely different acquisition infrastructure than 1,000 customers at $200/month ($2.4M ARR). The marketing spend, channel mix, sales motion, and onboarding complexity differ by an order of magnitude. This plan cannot be stress-tested for feasibility without this number.

### No defined Q1 timeline or launch date.

Q1 is 90 days. If the public launch is on January 1, you have 90 days. If it is February 1, you have 59 days after accounting for a 2-week beta running in January. The math of reaching 1,000 customers changes significantly. The plan assumes the reader knows the launch date; the plan does not state it.

### No stated retention assumption.

Getting to 1,000 paying customers at end-of-Q1 is not the same as acquiring 1,000 customers at any point in Q1. If you acquire 1,100 and churn 200, you end Q1 with 900 — which misses the target. The plan has no stated monthly churn assumption, which means it has no model for whether 1,000 gross adds are sufficient to meet the net target.

### No competitive response modeled.

A public launch with a 30% discount signals desperation or panic pricing to well-capitalized competitors. If a competitor matches or undercuts during your 60-day window, you have no pricing floor and no differentiated value prop defending you. The plan makes no mention of competitive positioning, which is especially dangerous if v2 is entering a crowded segment.

### No stated definition of "paying customer."

Does a customer on a free trial count? A customer who paid for one month and churned? A customer on an annual plan paid upfront? This definition affects whether the 1,000-customer target is measured by contracts signed, MRR active at end-of-quarter, or something else. Ambiguity here means the target can be gamed or disputed after the fact.

---

## Revised Conditions Under Which the Plan Can Work

The plan can succeed if and only if:

1. **The beta produces a hard go/no-go gate** with stated metrics that must be met before public launch proceeds.
2. **The discount is structurally anchored** — full price is publicized before the discount launches, and customers are explicitly told the end date.
3. **The acquisition funnel is modeled** — a stated channel strategy with realistic conversion rate assumptions that, when run through arithmetic, can produce the required trial volume.
4. **"Paying customer" is defined** and the 1,000 target is a net-active count at end-of-Q1, not a gross-add count.
5. **The discount-end transition is a retention event**, not a billing surprise — existing customers are proactively communicated to, offered an upgrade path, or grandfathered, with a modeled churn rate built into the Q1 forecast.
6. **Churn is modeled explicitly** — at minimum, a monthly churn assumption is stated and the gross-add target is adjusted upward accordingly.

Without these six conditions being satisfied, the plan as written is a launch schedule with a revenue aspiration attached, not a GTM plan.

---

## Verdict

The plan is structurally underspecified in ways that make the 1,000-paying-customers target uncheckable before the quarter ends. The biggest single failure mode is not any one tactic — it is that the plan has no model connecting the tactics to the success condition. The 2-week beta, the 30% discount, and the 60-day cliff are all independent events with no stated causal logic linking them to 1,000 net-active paying customers at Q1 close. Build that model first. If the arithmetic doesn't close on paper, it will not close in the market.
