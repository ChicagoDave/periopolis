# ADR-0015: On a run that opts in, the Run orders what the city needs as people arrive, and the player intervenes

**Date**: 2026-10-19
**Kind**: technical
**Scope**: domain/run, domain/site, apps/board
**Status**: ACCEPTED

## Context

David, 2026-10-19 (issue 7): "the sim should infer growth". Of three readings he confirmed this one: as people arrive and homes fill, the run itself orders the next neighborhood, plant unit, reactor module, school, fields or stretch instead of waiting for the player to place it; the player watches the city grow and intervenes. Today the Board's clock runs the months on its own (ADR-0013) but builds only what the player orders; a city left to run fills its homes and stops.

Two decisions drew the boundary this one moves. ADR-0008 Decision 4 declined letting the planner place on its own for the static board: a proposal is accepted in one click, and its Consequences left self-placing as "a Board setting, off by default, that calls the same accept path". ADR-0012 Decision 7 said "the Run orders nothing itself": with no restoring job in hand, an emergency shows only as the broken line. ADR-0013 Decision 3 has every order pause the months, which a run that orders for itself would trip every month.

What the Site already knows: `needsOf` reads a layout's needs off its broken checks, never re-derived (ADR-0008 Decision 2), and `proposeFor` gives each need its tiles and the ordinary commands that would build it, one need at a time so knock-on needs follow. An empty site needs nothing, because nobody is failed; one neighborhood on its own needs the ring, two reactor modules, a water, a sewage and a waste unit, three schools, fields and nine stretches of line, and the site has room for all of it (checked 2026-10-19: `needsOf` and `proposeFor` on `emptyLayout(RATES)` returned nothing, and on it with `placeNeighborhood` at tile 0,0 returned those ten needs, every proposal with room). No need ever asks for a neighborhood: homes are not a broken line, so the next neighborhood is the one thing the run must infer from the people rather than from the checks.

Not decided here: the pace of growth (ADR-0009 Decision 3 keeps the sourced rates), the yearly mode (it stays), and who pays.

## Decision

1. **A mode beside the others, which the Board turns on.** `startRun(…, { infer: true })` lets the run order for itself. It requires `growth` and `inOrder`; asked for without either, `startRun` refuses with an error, because inference reads the people of the month clock and relies on crews building what the city needs first. The clock carries the flag, so a stored run restores with it; a run stored before this decision restores without it, and a stored clock with the flag but no vetoes restores with none. Without the flag the clock is exactly as it was, and the parity suite replays without it, byte-identical (ADR-0003).

2. **Two signals, both read off what already exists.** Each month, after the people have moved (ADR-0009), the run reads:
   - **Needs**, from `proposeFor` on the planned board (what stands plus the work in hand, `planned(layout, jobs)`), with every home full as built. Reading the planned board means a need already ordered, by the player or by the run, is never ordered twice (the double-order ADR-0008's Consequences warn of); reading homes as built means the infrastructure is ordered ahead of the people who will need it, as ADR-0012 has the crews build it. Every proposal with room becomes an order. A need the board has no room for is recorded as a fact and not ordered.
   - **Homes**, from the people: the homes ahead of arrivals are the capacity of every neighborhood standing or in hand, less the people living there. A neighborhood in hand counts whether or not it will be admitted when it opens, because the needs signal orders the services that admit it. When the homes ahead fall below the lead, **30 months of arrivals at the citywide pace** (David, 2026-10-19: 400 a month, so 12,000 people, about two neighborhoods and a half, since a neighborhood takes a crew two years and fills in about twelve and a half months), the run orders one neighborhood that month, and no more than one a month. The lead is a premise on the run's rules, marked Mine, not a figure in the signal. From an empty site the homes ahead are zero, so a run from nothing orders its first neighborhood in its first month and the needs follow it.

3. **Where the neighborhood goes is the Site's question** (ADR-0008 Consequences: where a thing goes is the Proposal's business). `proposeNeighborhood(layout, rates)` beside `proposeFor` names the open tile `placeNeighborhood` would accept that is nearest the ring, or nearest the standing neighborhoods when there is no ring, first in the board's tile order among equals; null when no tile is open. The Run places nothing by its own geometry.

4. **Every inferred order goes through `placeOrder`**, the same path as the player's, with a proposal's steps as the layout command. It becomes jobs in the work in hand, crewed by class (ADR-0012 Decision 2), paid as pieces finish (ADR-0007 Decision 14), priced from the same premises. The run's spend for the same pieces equals a hand-ordered run's to the cent; inference changes when the money is spent, never its sum for the same work.

5. **The player stands beside the run.** The player's orders, cancels and `putFirst` work as they do today, through the same work in hand:
   - A player's order for a need suppresses the inferred one by construction, since the run reads the planned board that carries it.
   - **A veto is the player cancelling a job the run ordered, or taking down a piece the run built.** The clock remembers the vetoed piece (its kind and place) for the rest of the run and the run never orders it again, however often the need re-arises. The player ordering that same piece themselves lifts the veto: it is their order then. Cancelling or taking down the player's own pieces remembers nothing; if a need re-arises from it, the run orders it again.
   - `putFirst` moves an inferred job as it moves any job: first within its class.

6. **An emergency is ordered the month it breaks.** When people living there are left short of water, sewage, waste or power (ADR-0012 Decision 7), `needsOf` states the shortfall as a need and the run orders the restoring units that month; the emergency class crews them first. ADR-0012 Decision 7's "the Run orders nothing itself" holds for every run without `infer` and is amended by this decision for runs with it.

7. **No budget** (David, 2026-10-19). The run orders what the signals say and the money is recorded and shown as it is today. A budget the clock spends, with what waits when a year would pass it and who pays, stays its own decision, as ADR-0007 Decision 14 reserves it.

8. **The Run says what it ordered, and the Board words it** (ADR-0004). Each month's row carries typed facts: `InferredOrder` (the need it answers, or `homes`, and the order's events) for each order placed, and `NoRoom` for a need the board cannot hold. The vetoes are on the clock and restore from storage. The work in hand marks which jobs the run ordered.

9. **On the Board: a control, no pause, one undo, a veto.** A "Let the city grow itself" control on the clock card passes `infer: true` to `startRun`, **on by default** for every run the Board starts on the month clock (David, 2026-10-19), so "Start the clock on this city" and "Start a city from nothing" grow the city on their own unless the player turns it off before starting; the yearly mode cannot infer and its two flows are untouched. This amends ADR-0008's "off by default". An inferred order does not pause the months: ADR-0013 Decision 3 and its "any new way to change the layout while the clock runs must pause" consequence are amended to the player's own moves, which still pause. One Play stays one undo step (ADR-0013 Decision 4); the orders the run placed during it come back with it. The work-in-hand card marks inferred jobs and its Cancel on one is the veto of Decision 5. Storage restores the flag and the vetoes.

## Consequences

- ADR-0008 Decision 4 stands for the static board; its Consequences' "a Board setting, off by default, that calls the same accept path" is realised here as a Run mode the Board turns on, calling `proposeFor` and `applyProposal` through `placeOrder`, and the "off by default" half is amended: on the Board it is on by default (Decision 9).
- ADR-0012 Decision 7's "the Run orders nothing itself" and ADR-0013 Decision 3's pause-on-order are each amended for runs with `infer`, by a note in those ADRs pointing here. The session that flips this ADR to ACCEPTED writes those notes, and the one in ADR-0008's Consequences, in the same commit; none of the three changes Status, since each still governs every run without `infer`.
- A new Site function, `proposeNeighborhood`, joins `proposeFor`; `needsOf` and the checks do not move.
- A new fact shape (`InferredOrder`, `NoRoom`) is a new wording in the Board in the same change; the type checker reports a case it does not word.
- The parity suite, the yearly mode and every run without `infer` are unchanged.
- The scenarios that hold Decisions 1 to 9 are in `docs/domain/run.md` under "The city grows itself", each naming the state it asserts; the plan's Phases 2 to 5 derive their tests from them.
- A budget the clock spends, a different lead, or a smarter placement of the neighborhood is a change to a premise or a new decision, not to the signals.
- *Added 2026-10-20, Phase 5 (`domain/run/test/founding.test.ts`, the real Run on the month clock, built in order, twenty years):* David's founding of 2026-10-15 as placed, by hand, ends with 18,000 people in 6 neighborhoods held for middle and high seats, 3 lines broken (ring, power, haul) and 46 line-years, 6.82 billion to build. The same founding with the city growing itself ends with 48,379 people in 12 neighborhoods, every line held, nobody held back, 0 line-years, 15.31 billion to build; the run ordered the second module, 7 ring buildings, 6 elementary, 3 middle and 2 high schools, 10 stretches and 7 neighborhoods. The price of building in order: its first residents come in year 7, not year 5, because the crews build what the run ordered before the homes. One neighborhood on an empty site (seed 42) grows to 56,349 people in 14 neighborhoods with every line held at year 20 and 5 line-years: the ring the lone neighborhood lacks in its first year, and three times a piece that opened a year before its stretch (haul in years 2 and 7, stops and ways in year 16), since a knock-on need is ordered the month after the piece that causes it. An empty site (seed 42) grows to 53,698 people in 13 neighborhoods, 3 line-years, the first residents in year 5. Each twenty-year run takes about 100 ms. No premise moved; the one consequence the runs show is the month's lag between a piece and its knock-on stretch, which is the signal as decided, not a defect in it.

## Session

Session bae1e1, 2026-10-19; Phase 1 of `docs/work/archive/sim-infers-growth/plan.md`.
