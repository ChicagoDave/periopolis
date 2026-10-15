# Session Plan: Population from sourced rates, month by month, and an hour-by-hour day view

**Created**: 2026-10-14
**Plan Status**: ACTIVE
**Serves objective**: sustainable-city-shown
**Overall scope**: Close issue 3. Replace the fixed people per tile (5,000) and "homes fill the year they are finished" with a population that changes month by month from sourced yearly rates (births, deaths, in-migration, out-migration) plus a sourced move-in premise for finished homes; keep a separate day view that runs one day hour by hour (trips, peak power, movers in service, school runs) for the people the city has that month. The two stay separate: the month clock owns who lives here, the day view owns how they spend one day.
**Bounded contexts touched**: Ledger (`@city/ledger`: people per tile, `rates.hood`, population premises); Site (`@city/site`: `assessCore` pop1 under a population, ways/power checks); Run (`@city/run`: the clock's step, `docs/domain/run.md`); Board (wording of population facts and the day view, ADR-0004). Ground and Lines read only.
**Key domain language**: Premise, Mark (Yours, Sourced with `accepted`, Mine), Components of change (births, deaths, migration in/out), Move-in rate (how fast finished homes are occupied), Month step, Day view, Hourly curve

## References consulted
- `docs/adrs/0003-parity-port-against-the-sketch.md` — Decision 4: anything new is its own plan starting from the ported code; parity suites compare old fields only (as money did). Yearly sketch paths must stay identical when growth is off, or the departure is recorded in an ADR.
- `docs/adrs/0007-cost-is-a-derived-consequence-of-the-ledger.md` — Decision 9: every premise carries a mark and is sourced before David accepts it; Decision 14: spend per year, so monthly steps must sum to the yearly figures; published-city pins move together.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — population and day-view results are facts; the Board words them.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — rates and curves live in the pure domain packages, no I/O.
- `docs/adrs/0002-no-regular-expressions.md` — no regexes in any check or script.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` and `docs/adrs/0006-the-site-is-a-rectangle-of-hexagonal-tiles.md` — untouched unless a rate needs ground or site shape; read only.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — needs are derived from line checks; a population-dependent check keeps that derivation, it gains an input.
- `docs/brainstorm/future-city/money.md` — the pattern: premise tables with source, year, mark; every figure sourced or Mine.
- `docs/brainstorm/future-city/overview.md` — "Homes fill the year they are finished ... Irvine 62,134 in 1980 and 110,330 in 1990" is the premise being replaced; keep Irvine as a vouching comparator.
- `docs/domain/run.md` — the yearly clock whose step changes.
- `docs/work/archive/widen-civic-layer/plan.md` — phase shape: sourcing and David's decisions as a docs-only Phase 1, then code.
- `docs/context/project-profile.md` — documentation standard `always`; `pnpm -r test` excludes Playwright (run `pnpm --filter @city/board test:e2e`).
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Source the population and day-shape premises
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Population premises (not yet in the Ledger); hourly curves (not yet anywhere)
- **Entry state**: No active plan; population is `rates.hood` people a tile (5,000), Site `pop1 = rates.hood * (1 + stress.people)`, Run fills homes the year they finish. Docs only: no change under `domain/`.
- **Deliverable**: New `docs/brainstorm/future-city/population.md` with premise tables (figure, range, source, year, proposed mark) for: (a) components of change, US crude birth and death rates (CDC/NCHS), net migration and mobility (Census components of change, ACS), their seasonality by month; (b) a move-in premise, how fast finished homes are occupied, from Irvine and other new towns (Irvine 62,134 in 1980, 110,330 in 1990; Reston, Columbia, The Woodlands as available), with the honest note that national natural increase (about 11 births, 9 deaths per 1,000) cannot grow a new city and in-migration does; (c) shrinkage: out-migration and deaths, and a household-size note bearing on people per home; (d) day-view curves: NHTS trip starts by hour, EIA or utility hourly load shapes, school start and end times, movers' service hours, each with source and year; (e) how each maps to the existing daily and peak figures (peakKw 1.5 kW a person). Flagged questions for David per group: which marks, which comparators, month granularity for the clock, what the day view reports. Anything with no public benchmark listed as Mine with the search recorded.
- **Exit state**: `population.md` shows every rate and curve with a source or a no-benchmark note, plus the questions for David; `domain/` untouched; ledger, site and run suites unchanged and green.
- **Demonstration**: Print the `population.md` tables and show every row with a figure and source (or no-benchmark note) and a David question; `git diff --stat -- domain/` empty; `pnpm -r test` green.
- **Demonstrated**: 2026-10-14, session 51a736: `docs/brainstorm/future-city/population.md` written with tables for capacity and occupancy (ledger 2.45 a home against the US household of 2.5), components of change (births 10.7 and deaths 9.2 per 1,000, 2023 final; natural increase 1.5 per 1,000; moving 7.8–8.7% a year), moving in (Irvine about 4,800 a year, The Woodlands 2,100–2,600, Columbia about 2,500), and the day (NHTS 2022 Table 8-1 trips by start period, EIA load shape, NCES school start), each row with a source and year or a Mine note recording the search, and eight questions for David. `git diff --stat -- domain/ apps/` empty; `pnpm -r test` green (ledger 76, site 130, ground 27, run 132, board 121). [verified: test row "76 passed 27 passed 130 passed 132 passed 121 passed" 2026-10-15T01:49:35Z, no domain/apps edit in the session after the last source edit; the document itself and git diff --stat are reported by session, unverified]
- **Status**: DONE

### Phase 2: David decides; ADR-0009 and the Ledger's population premises
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Ledger population premises; the parity boundary of the Run's clock
- **Entry state**: Phase 1 done. Boundary Statement (rule 8a) before editing under `domain/**`.
- **Deliverable**: David decides per group (accept Sourced, make Yours, leave Mine). Write ADR-0009 (Kind technical): two clocks kept separate (month step for population, day view for one day); how ADR-0003 parity is kept (a yearly mode whose results are identical to the sketch with growth off) or the departure recorded explicitly; how ADR-0007 Decision 14 holds (monthly spend sums to the yearly figures); where the move-in premise lives. Population premises land in the Ledger as marked premises with a Behavior Statement per derivation (births, deaths, migration, move-in). The Ledger's people per tile (`rates.hood`, 5,000) stays as a tile's **capacity**, the homes as built, so Ground's plan (ADR-0005), the capital rows and every parity figure do not move; population is **occupancy** against that capacity (plan-review 2026-10-14); `ledger.md` updated. ADR index and Session sections updated.
- **Exit state**: The Ledger derives a month's population change from premises with marks; ADR-0009 ACCEPTED (or DRAFT with its open questions if any, per rule 11a); ledger suite includes tests from the Behavior Statements and an every-premise-marked check; ledger parity unchanged.
- **Demonstration**: `pnpm --filter @city/ledger test` green, showing the new population tests and the unchanged parity suite; print ADR-0009 Decision and Consequences.
- **Demonstrated**: 2026-10-14, session 51a736: David's eight answers recorded in `population.md` ("Decided"); trips a day filed as issue 4. ADR-0009 ACCEPTED (no open questions): two clocks, capacity vs occupancy, a month from yearly rates, a yearly mode for parity, spend summing to the year, the day reconciling with the checks. `domain/ledger/src/population.ts`: `POPULATION` (births 10.7, deaths 9.2 per 1,000, moving 8.7%, leaving half (Mine), arrivals 4,800 a year; Sourced ones accepted) and `monthOf`, with a Behavior Statement; `population.test.ts` 7 tests (full city month, 400 a month into empty homes, ~4,600 people after a year from empty, no arrivals into full homes, refusals, every premise marked). `pnpm --filter @city/ledger test` 83 passed with `parity.test.ts` unchanged; `pnpm -r test` green (site 130, ground 27, run 132, board 121); typecheck clean. Moving is 8.7% (Census 2022, the primary source), not the unverified 7.8% for 2023. [verified: test row "83 passed 130 passed 27 passed 132 passed 121 passed" 2026-10-15T02:00:02Z, after the last source edit (population.test.ts, 01:59:32Z); typecheck clean reported by session, unverified]
- **Status**: DONE

### Phase 3: Site assesses its checks under a population
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site `assessCore`, ways and power checks
- **Entry state**: Phase 2 done; the Ledger exposes population by month. Boundary Statement before editing under `domain/**`.
- **Deliverable**: `assessCore` takes a population as input instead of computing `rates.hood * (1 + stress.people)`; with the fixed 5,000 a tile as that input every existing figure is identical (site parity at 0 differences). Checks that are daily or peak figures (ways, peakKw) read the given population. Needs (ADR-0008) derive from the same checks under that population. Behavior Statements and tests from them.
- **Exit state**: Site checks are a function of the people the city has (occupancy); `rates.hood` remains only as a tile's capacity, the homes as built, which the capital rows and Ground keep reading (`site.md`: "the capital rows count the homes as built").
- **Demonstration**: `pnpm --filter @city/site test` green including parity at 0 differences; a test shows a half-populated layout passing a check that the full one fails (or the reverse), with the figures named.
- **Demonstrated**: 2026-10-14, session 51a736: `assessCore(layout, stress, rates, occupied)` and `assess(…, { occupied })` count each neighborhood's occupants (default `rates.hood`); `Core.people` added; `costOf`'s yearly per-person rows follow the occupants, capital rows the homes as built; daily facts carry `uneven`, worded by the Board ("the emptiest neighborhood") in the same change. `pnpm --filter @city/site test` 137 passed with `parity.test.ts` at 0 differences; `occupancy.test.ts` (7): thirteen neighborhoods break the ring and the plants full, but with the three new ones empty (50,000 living there) the ring and every plant hold; a neighborhood of 400 is short of its daily list and only it is marked; omitting occupancy is the same assessment figure for figure; refusals. `pnpm -r test` green (ledger 83, site 137, ground 27, run 132, board 122), typecheck clean. `rates.hood` remains as capacity in `assess.ts`, `cost.ts` (capital rows) and `run.ts` (homes), per ADR-0009. [verified: test row "83 passed 27 passed 137 passed 132 passed 122 passed 8 passed" 2026-10-15T02:15:06Z, after the last source edit (wording.test.ts, 02:14:34Z); typecheck clean reported by session, unverified]
- **Status**: DONE

### Phase 4: Run steps by the month
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Run's clock; OccupancyChanged, MonthAdvanced style facts (past-tense, ADR-0004)
- **Entry state**: Phases 2 and 3 done. Boundary Statement before editing under `domain/**`.
- **Deliverable**: The Run advances by month: homes are occupied by the move-in premise, population moves by components of change, spend accrues monthly and sums to the yearly figures (Decision 14). A yearly mode reproduces the sketch's paths exactly when growth is off, so the parity suite still replays it; the record gains population fields and the parity test compares old fields only. `run.md` rewritten. Fill speed compared with Irvine's, about 4,800 people a year between 62,134 (1980) and 110,330 (1990), as a vouching figure, not a tuned target; the sized city holds 50,000 at most, so totals are not compared. Integration Reality Statement (rule 13a) for the Run against the real Ledger and Site, no stubs.
- **Exit state**: A run by month and a run by year agree on yearly spend with growth off; with growth on, population by month is a recorded fact.
- **Demonstration**: `pnpm --filter @city/run test` green with parity at 0 differences; print a 10-year monthly population series for a city founded from nothing, its people added a year beside Irvine's ~4,800, and the yearly-sum equality test.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 5: The day view, one day hour by hour
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Day view (new, separate from the Run's month clock): hourly trips, peak power, movers in service, school runs
- **Entry state**: Phases 3 and 4 done; hourly curves accepted in Phase 2.
- **Deliverable**: A pure function from (a population, a layout, a day type) to 24 hourly facts using the accepted curves; its daily total equals the Site's daily figure and its peak hour equals the Site's peak figure, so the two views cannot disagree. It takes no state from the month clock beyond the population handed to it. Behavior Statements and tests.
- **Exit state**: For any month's population the day view returns 24 hours whose totals reconcile with the Site's daily and peak checks.
- **Demonstration**: Test output showing the 24-hour series for the sized city, with sum equal to the Site's daily trips and max equal to peak power; suite green.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 6: The Board words population and the day
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board wording (ADR-0004); marks shown for the new premises
- **Entry state**: Phases 4 and 5 done.
- **Deliverable**: `wording.ts` words the monthly population facts, the move-in premise and every new mark; a month control (or equivalent) and a day view readout in the page; the type check fails if a fact is unworded. `board.md` records the published figures; e2e pins re-pinned in the same change so e2e is never red across a commit. Issue 3 closed with the evidence.
- **Exit state**: A visitor can step the city by month and open one day by hour; every sentence comes from the Board, none from the domain.
- **Demonstration**: `pnpm -r test` and `pnpm --filter @city/board test:e2e` green; a screenshot or e2e assertion shows a month step changing the population and the day view listing 24 hours.
- **Demonstrated**: 
- **Status**: PENDING
