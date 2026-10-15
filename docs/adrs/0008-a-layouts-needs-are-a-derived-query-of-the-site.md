# ADR-0008: A layout's needs are a derived query of the Site, proposed and accepted, never placed on their own

**Date**: 2026-10-14
**Kind**: technical
**Scope**: domain/site, apps/board
**Status**: ACCEPTED

## Context

David: "If I add a neighborhood, the planner should know what else the city needs to enable that neighborhood." The fifteen line checks already say what is broken after a placement and mark the tiles, but not how much is missing or what would mend it. The plan (`docs/work/city-needs-for-new-neighborhood/plan.md`) asked two things: where the arithmetic of a need lives, and how the city acts on one, by placing it on its own, proposing it for one-click acceptance, or only listing it.

## Decision

1. **Needs are a query of the Site.** `needsOf(layout, rates)` returns typed `Need` facts: a ring, more ring buildings on a tile, reactor modules, plant units, schools near the neighborhoods whose pupils have no seat, playing fields, and the mover line run to the tiles it must reach. Each names the checks it answers.
2. **A need is read off the assessment, never worked out again.** `needsOf` runs `assessCore` for an ordinary year and translates each broken check's facts and marked tiles into needs. The checks' arithmetic stays where it is; the parity suite (ADR-0003) does not move.
3. **Only what a built thing can mend.** `NEED_CHECKS` lists the checks a need may answer. The size line (a watch that waits on people), the walk to work with a mover (a watch), and the daily list broken under a stress ask for nothing. The invariant, held by a test: the needs are empty exactly when no check in `NEED_CHECKS` is broken, and the checks they answer are exactly the broken ones.
4. **Propose, accept in one click** (David, 2026-10-14). Placing a neighborhood changes nothing else. A Proposal gives each need a tile; the Board lists them with "Add" and "Add all", and the layout changes only on acceptance, through the existing commands, so each step emits its ordinary event and undo works as before. Placing on its own was declined because it rewrites the player's layout and changes what a click means; listing only was declined because the checks already do that.
5. **Needs are facts the Board words** (ADR-0004). `needText` in the Board words every case, and the type checker reports a case it does not.

## Consequences

- A new case of `Need` is a new fact shape and its wording in the same change.
- A check whose case changes shape changes `needsOf`'s reading of it; `needs.test.ts` asserts on every layout it is given that the needs answer exactly the broken checks in `NEED_CHECKS`, so a drift fails there.
- Quantities are what the checks state: ring buildings and plant units by capacity, reactor modules for the peak with one down, schools as at least the unseated pupils over a school's cap. Schools and fields seated by distance rather than capacity are "at least one, near these"; where they go is the Proposal's question (plan Phase 2).
- Placing on its own, if wanted later, is a Board setting, off by default, that calls the same accept path; it is not a change to the Site.
- *Added 2026-10-14, Phase 2:* `proposeFor` proposes one need at a time and re-reads the needs after each, so knock-on needs (a new plant needs the line) follow the addition that causes them; `applyProposal` is the one accept path and runs only the ordinary commands. A proposal carries its price as the change in `costOf`'s build and run totals.
- The starter layout and every existing command are untouched, so the sketch's paths and parity hold by construction.

## Session

Session 51a736, 2026-10-14, Phases 1 and 2 of `docs/work/city-needs-for-new-neighborhood/plan.md`.
