---
name: blindspot-pass
description: >
  Surfaces the unknown unknowns standing between the user and unfamiliar
  territory before work starts, and turns them into a better prompt. Use when
  the user asks for a blindspot pass (盲区扫描, 找盲区), wants their unknown
  unknowns (未知的未知) mapped, or says they are new to a module, codebase
  area, domain, or craft and do not know what to ask
  (不熟悉这块又不知道从哪问起, help me prompt you better). Do not use for
  investigating a specific question the user can already state (use
  deep-research), reviewing an existing plan (use plan-review), or choosing a
  path between options (use first-principles-planner) — including plan-first
  or 先不写代码 asks that want a recommended path rather than a map of
  unknowns.
---

# Blindspot Pass

## Core Move

The prompt is a map; the codebase, domain, and their real constraints are the territory. The gap between them is the user's unknowns, and the dangerous ones are the unknown unknowns — questions they don't know to ask. A blindspot pass surveys the territory on the user's behalf and hands back the questions, hazards, and quality bar they could not have named, before work begins, so the work gets scoped against the territory instead of the map.

## Unknowns Frame

Sort what the pass learns into:

- **Known knowns** — what the prompt already states.
- **Known unknowns** — open questions the user has already named.
- **Unknown knowns** — criteria the user would recognize on sight but never wrote down; surface these as candidate requirements to confirm.
- **Unknown unknowns** — prior art, constraints, conventions, past failures, and quality ceilings the user has not considered; the pass's main product.

## Process

1. **Anchor the starting point.** Establish who the user is relative to this territory: what they already know, what they are trying to do, and how they would recognize success. If the prompt doesn't say, ask once — the same pass serves a newcomer and a veteran differently.
2. **Survey the territory.** Search the codebase, docs, and history — or authoritative external sources when the gap is domain knowledge rather than code — hunting specifically for what the user would not know to ask: existing implementations and prior art, hard constraints, local conventions, past failed attempts, and how good the result can be.
3. **Report blindspots with stakes.** Present findings under the frame above, each with its evidence (file, doc, or source) and its consequence: how knowing it changes the work. A blindspot without a consequence is trivia — cut it.
4. **Convert to a better prompt.** End with the payoff: the focused questions the user should now answer, and a revised prompt draft that folds the resolved unknowns in, ready for the implementing session.

## Completion Criterion

The pass is done when every reported blindspot carries evidence and a consequence, and the user leaves with a revised prompt or an explicit decision list — not a lecture about the territory. The pass ends there; implementation is a separate session with the improved prompt.

## Anti-Patterns

- A general tutorial on the domain instead of the user's specific gaps.
- Blindspots asserted from priors without surveying the territory.
- Findings without evidence or stakes.
- Continuing into implementation inside the pass.
