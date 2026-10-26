# ADR-0022: Every decision is weighed for an eventual game

**Date**: 2026-10-25
**Kind**: process
**Status**: ACCEPTED

## Context

On 2026-10-21 David raised gamifying Periopolis out of curiosity, prompted by Permit Pending (https://permit.petercai.com), and parked it. The open question is recorded in `docs/brainstorm/future-city/overview.md`. On 2026-10-25, during ADR-0021's interview, he set the direction: the best way to promote Periopolis is to eventually gamify it. "We're not doing that today, but I want that considered at every decision." A direction that lives only in one machine's memory reaches neither other sessions nor other developers. So it is recorded here.

## Decision

1. **Each design decision is weighed with a game lens** (David, 2026-10-25). An ADR's options, and any plan or proposal that chooses between designs, say in a line each how the option would read in a game:
   - whether it leaves the player a meaningful choice;
   - whether an event gives lead time to respond;
   - whether consequences stay visible.
2. **The lens weighs. It does not decide.** The sim's truth comes first: physics and arithmetic stay non-negotiable, and the Ledger with its marks is what Periopolis has that a game like Permit Pending lacks. Where the lens and the sim disagree, the ADR says so, and David chooses.
3. **Nothing is built for the game yet.** No game features, landing page, scenarios or 3D view are planned or built until David decides to gamify.

## Consequences

- ADRs from ADR-0021 on carry a game-lens line for each option. Earlier ADRs are not revisited for it.
- Mechanisms that the run carries out for itself are preferred in a shape a player could later take over, such as the run's orders being vetoable (ADR-0015). This is a preference, not a rule.
- When David decides to gamify, that is its own ADR, and the lens lines are its starting evidence.

## Session

585eb2, during Phase 1 of `docs/work/archive/line-holds-through-a-closure/plan.md` (ADR-0021's interview).
