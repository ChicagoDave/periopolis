# Session Plan: The site is concentric circles — an outer infrastructure band, and a second circle for growth past 100,000

**Created**: 2026-10-20
**Plan Status**: ACTIVE
**Overall scope**: Replace the 115-tile rectangle (ADR-0006) with a circle of hexagonal tiles whose outermost band (hex ring 4 around the city's ring, 24 tiles) holds the infrastructure plants, whose inner rings 1 to 3 (36 tiles) hold neighborhoods within a 30-minute walk of the ring and so carry 100,000 residents with room to 180,000; a second circle, centered 9 steps away, is added for further growth. Needs its own decision (ADR-0016) with five open design questions interviewed before code.
**Bounded contexts touched**: Site (primary: outline, band, placement rules, proposals, second circle); Run (orders the second circle under infer); Board (draws circles and band, wording, e2e); Ground unaffected
**Key domain language**: Circle, Band (infrastructure band), Outline, Plant, Neighborhood, Ring, Proposal, Inferred order
**Source**: David, 2026-10-20: "We should alter the map. It should be concentric circles and an outermost band is where infrastructure resides. And that band should be far enough out to allow for 100,000 residents and then a second main circle would be needed for further population growth."

## References consulted
- `docs/adrs/0006-the-site-is-a-rectangle-of-hexagonal-tiles.md` — Outline is a value (`hexagon`, `rectangle`), `allTiles` walks rows top-down west-east so the sketch's tile order is kept; Decision 5 pins parity to the sketch's `hexagon(5)`. This plan supersedes Decision 3 (the rectangle) in part and must keep Decisions 4 and 5 or amend them by pointer.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — `needsOf`/`proposeFor`/`applyProposal`; where a thing goes is the Proposal's business; the invariant that needs answer exactly the broken `NEED_CHECKS` must hold under band rules.
- `docs/adrs/0015-the-run-orders-for-itself-as-people-arrive.md` — Decision 3 `proposeNeighborhood` picks the open tile nearest the ring (amended by pointer here); every inferred order goes through `placeOrder`; vetoes by piece; the founding record (48,379 / 56,349 / 53,698 people) is the baseline to compare against.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — parity suite stays byte-identical on the sketch's tiles; the new circle is a departure recorded in an ADR, as ADR-0006 did.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — Board -> Run -> Site -> Ledger; Ground never imports Site; Site stays pure.
- `docs/adrs/0002-no-regular-expressions.md` — no regex in code, tests or scripts (tile keys parsed by walking structure).
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — band rejections and circle facts are typed; the Board words them.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — Ground draws one tile and the ring and is unaffected by the outline; keep it so.
- `docs/adrs/0009-population-is-occupancy-moved-month-by-month.md` — arrivals 4,800 a year citywide; growth past 100,000 is a pace question this plan does not reopen.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` — crews build by class; the second circle's plants come before its homes.
- `docs/adrs/0013-the-board-runs-the-month-clock-on-its-own.md` — inferred orders do not pause the months; one Play is one undo.
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — product ADR, Scope apps/board intersects the Board phase; phase commits stay local, a push to main publishes.
- `docs/context/project-profile.md` — `pnpm -r test`, `pnpm -r typecheck`, `pnpm --filter @city/board test:e2e`; documentation standard `always`; state replaced, never mutated.
- `docs/context/session-20261019-2227-main.md` — no open items; sim-infers-growth complete and archived.
- `docs/domain/site.md`, `docs/domain/run.md` — current terms, commands and scenarios the new ones extend.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: The circle and its band — the decision and its scenarios
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site, with Run and Board consequences; the Outline, a new Band and Circle, ADR-0006 Decision 3 and ADR-0015 Decision 3
- **Entry state**: No active plan; the geometry facts established 2026-10-20 (30-minute walk = 3.03 tile steps, rings 1 to 3 around the ring = 36 tiles = 180,000 people, band = hex ring 4 = 24 tiles, plantMax 12, one unit serves 60,000) are verified against `rates.ts` and `board.ts`
- **Deliverable**: ADR-0016 (Kind technical, Scope domain/site, domain/run, apps/board) written with these as Open Questions for `/devarch:adr-interview`, resolved one at a time: (a) the outline: `hexagon(4)` per circle, `hexagon(5)` with ring 5 margin, or a larger board holding several circles; (b) whether the band is a hard Site rule (plants only in the band; neighborhoods and ring never in it; command rejections such as `OutsideBand` / `InsideBand`) or only a proposal rule in `proposeFor` / `proposeNeighborhood`; (c) where the second circle's center goes (8 steps apart so bands touch, or a shared band at the seam) and who triggers it (the Run when ring-3 tiles are full, under infer, or the player); (d) what the starter layout does (its plants sit in ring 3 today) and whether parity fixtures stay pinned to the sketch's hexagon per ADR-0006 Decision 5; (e) whether lines 5 (haul) and 11 (height) get Site checks for the band. Amends ADR-0006 and ADR-0015 Decision 3 by pointer. Domain scenarios in `docs/domain/site.md` (and `run.md` for the second circle) each naming the event, fact or rejection asserted; new terms Circle and Band in the glossary
- **Exit state**: ADR-0016 ACCEPTED with no Open Questions; scenarios written; pointers added in ADR-0006 and ADR-0015; no code moved
- **Demonstration**: `grep` the ADR for each of (a) to (e) answered in a Decision; `grep` site.md for each scenario heading; `pnpm -r test` still green
- **Demonstrated**: 2026-10-20 — ADR-0016 ACCEPTED after the six-question interview (the review's sixth, "full", added) and adr-review 19/19; `grep` finds the six decisions (outline a rectangle along the shore, hard band rule, second circle 8 steps opened by the Run, starter moved, `flow` check for line 32, full at 36) and the scenario groups "The circles and the band" (site.md) and "The city grows past its circle" (run.md); pointer notes in ADR-0006, ADR-0008, ADR-0015; setting brainstorm and lines 30 to 32 added; `pnpm -r test` 91+27+171+220+194 = 703 passed, no source changed [verified: test event "Tests passed" (91+27+171+220+194 = 703), 2026-10-20T08:21:59Z; the grep findings are the session's report]
- **Status**: DONE

### Phase 2: Circles and band geometry — the Outline of concentric hexagons
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site — the rectangle becomes an extent (ADR-0006 Decision 2 as amended), laid along the shore; `Layout.circles`, `hexRing(middle, k)`, `ringDistance`, band tiles and the shore as values; `SiteRates.current`
- **Entry state**: Phase 1 ADR accepted
- **Deliverable**: `rectangle` as an extent with the centred form kept; `SiteRates.outline` from row -4 to 4 and 4 steps west of `0,0` to 4 east of `9,0`; circle, band, ring-distance and shore functions; `Layout.circles` with `emptyLayout` and the starter holding the first and `restoreLayout` defaulting to it; tile order of ADR-0006 Decision 4 unchanged; tests from the first scenario (ring counts 6, 12, 18, 24; band membership; the band's south tiles on the shore; every tile in a circle or open to nothing); parity still pinned to the sketch's `hexagon(5)`; the Board's e2e tile count re-pinned in this phase so the flows stay green (plan-review)
- **Exit state**: The Site's outline is the circle; every existing Site test updated for the new outline or shown unaffected; `pnpm -r typecheck` clean
- **Demonstration**: Vitest on `domain/site` asserting ring counts and band membership of every tile, plus the parity suite at 0 differences
- **Demonstrated**: 2026-10-20 — `rectangleFrom(-4, 13, -4, 4)` is the shipped outline (158 tiles, rows -4 to 4); `circle.ts` gives rings of 6, 12, 18, 24, the band, circle membership, fit and shore tiles; `Layout.circles` carried through every command, the Run's draft and the Board's save, restored with the first when absent; the second circle corrected to `9,0` (8 steps shares `4,0`), the parity guard narrowed to the fixtures' tiles (76 of the sketch's 91 on the board), ADR-0006 and ADR-0015 noted by pointer; the founding tests' four plants stood on the band with the same stretch count (one pin 15.31 → 15.30). mutation-verification: source clean, six test gaps with one root cause (every fixture held the default `['0,0']`), closed by two-circle tests in circle.test.ts (every command event path and an accepted proposal keep `['0,0','9,0']`; a restored two-circle layout keeps tiles and lines and drops a middle off the board), order.test.ts (a run on two circles keeps them through an order, a month, two years and the planned board) and session.test.ts (save and reload on two circles; a save without circles comes back on the first). `pnpm -r typecheck` clean; `pnpm -r test` 91+27+181+221+195 = 715 passed (12 new); `pnpm --filter @city/board test:e2e` 16 passed (26.8 s) with the drawn tile count re-pinned at 158 [verified: test event "Tests passed" (91+27+181+221+195 = 715), 2026-10-20T08:36:04Z, no later edit event; e2e 16 passed and typecheck are the session's report]
- **Status**: DONE

### Phase 3: Plants stand in the band — placement rules and rejections
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site — `addPlantUnit`, `placeNeighborhood`, `addRingBuilding`, `layStretch`, `toggleExtra` rejections `OutsideBand` / `InsideBand` / `OutsideCircle`; the `flow` check for line 32 in `NEED_CHECKS`; the starter's plants moved to the band
- **Entry state**: Phase 2 done
- **Deliverable**: The hard band rule in every placing command with the three typed rejections and the layout unchanged; `restoreLayout` drops what the band forbids; the `flow` check (sixteenth; idle, ok, broken with marked plants; a need `proposeFor` answers on the right end of the band); the starter and `spokesCity` / `loopedCity` moved to band-legal tiles on the shore side, intake upstream of outfall, tally still 14 of 15 (15 of 16 with `flow`), cost figures re-pinned where stated; Board wording for the rejections, the check and "of 16" in the same change (ADR-0004)
- **Exit state**: A plant off the band, a neighborhood or ring in it, or anything outside every circle is refused; `flow` holds on the starter and breaks when reversed; `needsOf` invariant (ADR-0008) holds over sixteen checks
- **Demonstration**: Vitest tests asserting each rejection reason and the unchanged layout; the scenarios suite green with the 100,000-person layouts on band-legal tiles
- **Demonstrated**: 2026-10-20 — every placing command refuses `OutsideCircle` / `OutsideBand` / `InsideBand` with the layout unchanged, keyed to the layout's circles (a circle-less layout is the sketch's free board, which only the parity fixtures and the Run's sketch founding use); `restoreLayout` drops what the band forbids; the sixteenth check `flow` (idle / ordered / reversed, tile issue `flowReversed`) in `NEED_CHECKS` with the `intake` need and its shore proposal; new plants proposed on the shore side, water upstream, sewage downstream, reactor and waste beside it; the starter's plants on the shore (`-3,4` water, `-2,4` waste, `-1,4` sewage, `0,4` power, six stretches from `1,1`), tally 15 of 16; the 100,000-person layouts, David's founding tests and the Board flows re-placed on the band; Board wording for the three rejections, the check, the issue, the need and the inferred reason. Figures moved by the two added stretches are recorded in ADR-0016 Consequences (Phase 3). mutation-verification: source clean; its gaps closed in band.test.ts (shore placement of new plants with the flow holding once built, the shore-full and band-full fallbacks, the line kept inside the circle, the flow's circle count, a before-and-after unchanged check). `pnpm -r typecheck` clean; `pnpm -r test` 91+27+194+221+196 = 729 passed (14 new); `pnpm --filter @city/board test:e2e` 16 passed (25.2 s) [verified: test event "Tests passed" (91+27+194+221+196 = 729), 2026-10-20T09:19:18Z, no later edit event; e2e 16 passed (also in that event) and typecheck are the session's report]
- **Status**: DONE

### Phase 4: Proposals follow the band — where a need and the next neighborhood go
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site — `proposeFor` plantSteps choose band tiles (clustering reactor, sewage and waste for line 22); `proposeNeighborhood` takes the open tile nearest the ring within rings 1 to 3 only
- **Entry state**: Phase 3 done
- **Deliverable**: Proposal rules per ADR-0016 (the shore-side placement of new plants and the intake proposal landed in Phase 3 with the `flow` check); `proposeFor` told the run's vetoes (an `avoid` list, as `proposeNeighborhood` has) so a vetoed plant is proposed on another band tile and the kind still gets built, found in Phase 3 through flow 15 and ADR-0015 Decision 5; `NoRoom` when the circle is full (the trigger for the second circle); tests: an empty circle with one neighborhood proposes all ten needs with room, 100,000 residents (20 neighborhoods, 2 units of each plant) fit with every line held, a 37th neighborhood has no room in the circle
- **Exit state**: A circle fills from the middle out with plants in the band and no neighborhood beside a plant
- **Demonstration**: Vitest filling a circle by repeated `proposeNeighborhood` + `proposeFor` + `applyProposal` to 36 neighborhoods, asserting the layout and that the 37th returns null
- **Demonstrated**: 
- **Status**: PENDING

### Phase 5: The second circle — a Site that can grow past the first
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site — second Circle at the decided center and trigger; the mover line joining circles; `kmBetween` across circles
- **Entry state**: Phase 4 done; ADR-0016 decision (c)
- **Deliverable**: `openCircle(layout, middle)` → `CircleOpened` / `OffBoard` / `CircleOverlaps`, ground with no crew or price; band, placement, proposal and `flow` rules per circle; the walk measured to a neighborhood's own ring; the line crossing the seam band to band so `haul` holds in both; Board wording for the event and rejections; tests from the seventh scenario
- **Exit state**: The Site can lay out two circles and hold the lines across them; `pnpm -r test` green
- **Demonstration**: Vitest placing a full first circle and a second circle's first neighborhood with plants in its band and the stretches joining them, asserting lines 5 and 16 hold
- **Demonstrated**: 
- **Status**: PENDING

### Phase 6: The run orders the second circle when the first is full
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run — `inferStep` orders the second circle on `NoRoom` through `placeOrder`; vetoes; spend equal to hand-ordered
- **Entry state**: Phase 5 done
- **Deliverable**: Inference extended per ADR-0016 (c); a typed fact for the second circle ordered; tests from run.md scenarios (circle full -> circle ordered -> next neighborhood in it; a veto of the circle is remembered; the run without infer unchanged; the parity suite byte-identical)
- **Exit state**: A run on the month clock grows past the first circle on its own
- **Demonstration**: Vitest run from a full first circle ticking months and asserting a neighborhood stands in the second circle with its plants built first
- **Demonstrated**: 
- **Status**: PENDING

### Phase 7: The Board draws the circles and the band
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board — outline drawing, band tinting, wording of the band rejections and circle facts (ADR-0004), e2e tile counts
- **Entry state**: Phase 6 done
- **Deliverable**: Frame from `extent(outline)`; circle edge and band drawn; wording in `wording.ts` for every new rejection and fact (type checker reports a miss); e2e flows count the new drawn tiles instead of 115; a flow showing a plant refused off the band and the city growing into a second circle
- **Exit state**: The built page shows concentric circles with the band; flows pass
- **Demonstration**: `pnpm --filter @city/board test` and `pnpm --filter @city/board test:e2e` green, the flow asserting the drawn tile count and the band refusal sentence
- **Demonstrated**: 
- **Status**: PENDING

### Phase 8: Founding run on the real path — past 100,000 into the second circle
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Run + Site + Board end to end (Integration Reality: real Run, real Site, built page, no stubs)
- **Entry state**: Phases 2 to 7 done
- **Deliverable**: Real-path test running the founding layout and the one-neighborhood start for as long as it takes to pass 100,000 and enter the second circle, recorded against ADR-0015's baseline (48,379 / 56,349 / 53,698 in twenty years); the record and any premise the run shows wrong written into ADR-0016 Consequences; profile and domain docs updated (Site interface, project-profile plan note)
- **Exit state**: Record in ADR-0016; docs list the circle, band and second circle
- **Demonstration**: The real-path Vitest run and the e2e flows green with the printed record written into the ADR
- **Demonstrated**: 
- **Status**: PENDING
