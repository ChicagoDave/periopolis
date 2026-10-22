# Session Plan: A waiting list of people drives arrivals; homes are the limit (resolves GitHub issue 8)

**Created**: 2026-10-21 (rewritten in place the same day; replaces the "4.8% scaling past 100,000" plan; slug kept, nothing started, same plan so no supersession)
**Plan Status**: ACTIVE
**Overall scope**: David's decision (2026-10-21): the city is enormously popular, so demand is not the limit, homes are. A waiting list (people) grows each month by `demandPerYear`: **30,000 a year, Mine** (David, 2026-10-21: demand above what the crews can build, so a list forms and the build pace is the visible limit; "enormously popular" is his belief). Frisco TX 2010-2020 (116,989 to ~200,490, +83,520 over the decade, mostly migration; Frisco 2040 Comp Plan Appendices, https://www.friscotexas.gov/DocumentCenter/View/36063/2040-Comp-Plan-Appendices-PDF) is the sourced comparison: a popular city past 100,000 absorbed ~8,350 a year. Each month arrivals = min(empty homes open to arrivals, waiting list), and the list shrinks by those who move in. The fixed citywide `arrivalsPerYear` 4,800 (Irvine) goes away as a premise; Irvine survives only as a comparison row in `docs/brainstorm/future-city/population.md` (decision: remove from code, keep in docs, so no unused marked premise lingers). The Run's homes-ahead lead orders against `demandPerYear`. The list is state on the month clock, so it persists, saves, and is recorded per month; the Board shows it. The real-path record is re-pinned from running the real path.
**Bounded contexts touched**: Ledger (population premises, monthOf), Run (growth month clock, lead, persistence, real-path record), Board (population view and premise wording)
**Key domain language**: waiting list, demandPerYear, empty homes open to arrivals, homes ahead (lead), second circle, real-path record

## What then brakes growth (measured in Phase 1 on the real path, seed 42)
- **The crews.** 10 crews, two crew-years a neighborhood; the lead (75,000 homes) keeps about fifteen neighborhoods in hand, and their needs (schools, ring, plants, stretches) take the crews before the homes (ADR-0012 Decision 2). Every home is taken the year it opens; the list only grows.
- **Then the board.** From one neighborhood and from nothing, seventy years: past 100,000 in year 20 (was 54-55), the second circle opened in years 22 and 20, both circles full by year 50 at 72 neighborhoods and 360,000 people, and no third circle fits the board, so the city holds at 360,000 with the list past 1.1 million. The demand ceiling (30,000 / 0.042, about 714,000) is never reached.
- **The price.** The first residents come later because the crews build fifteen neighborhoods' needs first: David's founding grown by the run in year 10 (was 7), an empty site in year 10 (was 5); a lone neighborhood's fields break six years running (years 3 to 8); the full first circle's schools break in years 9 to 13 and 18 to 20 (42 line-years, was 27). Recorded in `founding.test.ts` and `past.test.ts`.
- Not invented: no build-pace, jobs-a-year or budget premise was added.

## Decided (David, 2026-10-21)
- **Demand**: 30,000 a year, Mine, above the ~25,000 homes a year 10 crews can finish, so the list forms and grows and the crews are the brake. The 8,350 analysis above is superseded: at 30,000 the list grows by roughly 5,000+ a year once the crews are saturated, and the inflow ceiling (30,000 / 0.042, about 714,000) lies far past any 70-year run.
- **Record**: a **new ADR** superseding ADR-0009 Decision 3, with a dated note on ADR-0009 pointing to it.
- **Lead**: 30 months of demand (`rules.lead * demandPerYear / 12`, 75,000 people), replacing ADR-0015 Decision 2's 12,000 (30 months at 400 a month), so the crews, not the lead, are the brake (David, 2026-10-21, after plan-review).
- **Assumed, not yet asked** (Mine, stated in the ADR): the list starts at 0; the list has no ceiling.

## References consulted
- `docs/adrs/0009-population-is-occupancy-moved-month-by-month.md` (technical) — arrivals fill empty homes at a citywide pace of 4,800 a year (Decision 3); a different pace is a premise change, but a waiting list is a model change; Decision 5 (parity/yearly mode unchanged) must hold.
- `docs/adrs/0003-parity-port-against-the-sketch.md` (parity / yearly mode untouched) — growth is opt-in on a run; yearly parity figures must not move. `monthOf` appears only in the month clock (`growth.ts`), so the yearly step is expected untouched; Phase 1 checks that parity tests stay green.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` (move-in gate limits) — arrivals fill only homes the admitted may hold; "empty homes open to arrivals" is `open` in `monthStep`, unchanged.
- `docs/adrs/0015-the-run-orders-for-itself-as-people-arrive.md` (technical) — the lead orders homes ahead of arrivals; the lead must follow the new definition (`rules.lead` months of demand).
- `docs/adrs/0016-the-site-is-concentric-circles-with-an-infrastructure-band.md` (technical) — Consequences hold the Phase 8 real-path record (levels near 114,286, no circle opened); must be re-pinned.
- `docs/adrs/0002-no-regular-expressions.md` (technical) — no regular expressions in code or tests.
- `docs/context/project-profile.md` — workspace and test conventions; documentationStandard is `always`, so every touched file and public function carries headers.
- `docs/context/session-20261020-2305-main.md` — open item 8 is this goal; item 9 (full circles carry no squeeze headroom) is out of scope.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Waiting list in the Ledger and on the Run's month clock
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Ledger PopulationPremises / monthOf (pure); Run month clock (Growth, MonthRow, monthStep) and the lead
- **Entry state**: main at bc42b5d; `arrivalsPerYear` 4,800 is read by `monthOf` and `domain/run/src/infer.ts:109`; `Growth` holds month, occupied, months.
- **Deliverable**: `demandPerYear` (30,000, Mine, with Frisco's ~8,350 named as the sourced comparison) replaces `arrivalsPerYear` on PopulationPremises/POPULATION. `monthOf(people, capacity, waiting, k)` returns the month's `demand` joining the list, `arrived = min(max(0, capacity - stayed), waiting + demand)`, and `waiting` at the month's end (the list shrinks by arrivals); pure, with the invariants waiting >= 0 and arrived <= waiting + demand as guards. `Growth` gains `waiting` (people), `growthOn` starts it at 0, `monthStep` threads it in and out and the placed arrivals (not the unplaced remainder) leave the list, `MonthRow` records `waiting` and `joined` per month; `growthOf` in `run.ts` restores it with the usual dropping of bad values, and saving round-trips it. `infer.ts` lead = `rules.lead * demandPerYear / MONTHS`. Behavior Statements for monthOf, monthStep and the lead. Tests: Ledger `population.test.ts` (list grows by demand, arrivals bounded by empty homes and by the list, list shrinks by arrivals, a full city leaves the list growing); Run `growth.test.ts` (133-138), `movein.test.ts` (144-148), `infer.test.ts` (50) updated; a save/restore test for the list. Parity: yearly-mode and parity suites unchanged and green. Measure and record what brakes growth (crews, jobs, lead) from a real run.
- **Exit state**: Every suite green (the commit gate takes no red suite, so the real-path records `founding.test.ts` and `past.test.ts` were re-pinned here, not in Phase 2, and the Board's premise wording and the two Board tests and two flows that assumed gradual filling with them); no mention of `arrivalsPerYear` remains in code; every Run test that stayed under the old pace is explained, not loosened.
- **Demonstration**: Run the Ledger and Run suites and the parity suites; a 70-year real-path run prints the waiting list per year and the crews' use, showing what the only brake is.
- **Demonstrated**: [verified: `pnpm -r typecheck` clean; `pnpm -r test` 93+27+212+241+197 passed (parity suite included); Board e2e 18 passed; probe of every real-path record recorded above under "What then brakes growth", 2026-10-21]
- **Status**: DONE

### Phase 2: The Board shows the waiting list
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run real-path record (`domain/run/test/past.test.ts`); Board population view and premise wording
- **Entry state**: Phase 1 committed; the real-path records and the premise wording already re-pinned there.
- **Deliverable**: Board: the list's size shown in the population view (the month line and people-now sentence say how many wait), with wording tests and a flow; the premise line for `demandPerYear` already landed in Phase 1.
- **Exit state**: Full workspace tests green including Board unit and e2e flows; the record states the measured outcome without claiming a brake that is not there.
- **Demonstration**: Run the full suite (past.test.ts included) and the Board e2e flow; `#poppremises` shows the demand line and the population view shows the list.
- **Demonstrated**: [verified: `pnpm -r typecheck` clean; `pnpm -r test` 93+27+212+241+197 passed (past.test.ts and parity included); Board `pnpm test:e2e` (fresh build) 18 passed — the founding flow asserts `#poppremises` "People joining the waiting list: 30,000 a year", the month line and `#peoplenow` saying "2,500 / 60,000 / 84,000 / 86,479 people wait for a home", and the month table's Waiting column 86,479; past.test.ts names the crews as the brake, as measured in Phase 1, 2026-10-21]
- **Status**: DONE

### Phase 3: Decision record, docs, close issue 8
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: decision records and domain docs
- **Entry state**: Phase 2 committed.
- **Deliverable**: A new ADR superseding ADR-0009 Decision 3 (David, 2026-10-21) with the waiting list, demand 30,000 Mine, the Frisco comparison, the "popularity is David's belief" mark and the honest statement of the only brake; ADR-0009 pointer; ADR-0012 Decision 4 dated note (arrivals limited by the waiting list, still in tile order and only into admitted homes); ADR-0016 Consequences Phase 8 record and Decision 3's inline note updated with the new figures; ADR-0015 Decision 2 note on the lead (30 months of demand, David 2026-10-21); `docs/domain/run.md` and `docs/domain/ledger.md` updated; `docs/brainstorm/future-city/population.md` adds Frisco (~8,350/yr 2010-2020), The Villages (~3,700/yr 2010-2020 metro) and Milton Keynes (~5,000/yr 1967-1992) to the new-town table, keeping Irvine as comparison; project profile updated. Issue 8 closed with the record cited.
- **Exit state**: Docs agree with code; no doc names 4,800 as a live premise; issue 8 closed.
- **Demonstration**: `gh issue view 8` shows closed; grep of `docs/` and `domain/` for `arrivalsPerYear` finds only history (archives, the superseded decision text).
- **Demonstrated**: [verified: `gh issue view 8` CLOSED (closed 2026-10-21 with ADR-0017 cited); grep for `arrivalsPerYear` over `docs/`, `domain/` and `apps/` (session summaries and archives aside) finds only this plan, ADR-0017's history and ADR-0016's superseded Phase 8 record; `docs/domain/*.md` name 4,800 and 12,000 only as what was replaced; ADR-0017 written, notes on ADR-0009, 0012, 0015 and 0016; ledger.md, run.md, board.md, population.md (Frisco Sourced; The Villages and Milton Keynes Unverified, no source recorded) and the project profile updated, 2026-10-21]
- **Status**: DONE
