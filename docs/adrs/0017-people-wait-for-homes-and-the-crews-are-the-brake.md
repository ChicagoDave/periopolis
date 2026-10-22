# ADR-0017: People wait for homes — a waiting list drives arrivals, and the crews are the brake

**Date**: 2026-10-21
**Kind**: technical
**Scope**: domain/ledger, domain/run, apps/board
**Status**: ACCEPTED
**Supersedes**: ADR-0009 Decision 3, its arrivals clause only

## Context

Issue 8: ADR-0016's real-path record (Phase 8) showed that under ADR-0009's premises a growing city levels off near 114,000 people. Each year 4.35% of people leave the city against 0.15% natural growth, while arrivals were capped at 4,800 a year (Irvine 1980–1990, `arrivalsPerYear`), so the city settles where leavers match arrivals, 4,800 / 0.042. No run that grows fills a circle, and none reaches the second. ADR-0016 left open which premise was wrong.

David first chose to scale arrivals past 100,000, at 4.8% of the people a year. He then checked 4,800 against public data: Irvine, The Villages, Milton Keynes, and Frisco TX, which grew from 116,989 to about 200,490 between 2010 and 2020, about 8,350 a year and mostly by migration (Frisco 2040 Comp Plan Appendices, https://www.friscotexas.gov/DocumentCenter/View/36063/2040-Comp-Plan-Appendices-PDF). He replaced the scaling with a different model (David, 2026-10-21): the city is enormously popular, so demand is not the limit; homes are. A pace is a premise, but a waiting list changes the model, so it needs its own decision. The plan is `docs/work/arrivals-scale-past-100000/plan.md`.

## Decision

1. **A waiting list of people** (David, 2026-10-21). People who want to live here join a list each month. Each month the people who arrive are the smaller of two numbers: the empty homes open to arrivals, and the people on the list. Those who move in leave the list, and anyone left unplaced stays on it.
2. **Demand is 30,000 a year, Mine** (`demandPerYear` on `POPULATION`, replacing `arrivalsPerYear`). That is more than the roughly 25,000 a year that ten crews can build homes for, so the list forms and grows, and the build pace is the visible limit. That the city is "enormously popular" is David's belief, not a source. Frisco's ~8,350 a year is the sourced comparison for a popular city past 100,000, and the figure is marked Mine for that reason. Irvine's 4,800 stays as a comparison row in `docs/brainstorm/future-city/population.md`, not as a premise in code.
3. **The list starts at 0 and has no ceiling** (Mine, assumed, not yet asked). A run starts with nobody waiting. A run restored from a save made before the list existed also restores at 0. Nobody gives up waiting.
4. **The list is state on the month clock.** `Growth.waiting` holds it, and each `MonthRow` records the month's `joined` and `waiting`. It is stored and restored, and bad values are dropped to 0. `monthOf(people, capacity, waiting, k)` in the Ledger is pure: it refuses a negative or non-finite list with a RangeError, and it never lets arrivals exceed the list plus the month's joiners. The yearly mode, the sketch's clock and the parity suite do not read the list and are unchanged (ADR-0009 Decision 5, ADR-0003).
5. **The lead is 30 months of demand** (David, 2026-10-21, after plan-review). The run's homes signal (ADR-0015 Decision 2) orders a neighborhood when the homes ahead fall below `rules.lead × demandPerYear / 12`, which is 75,000 people. This replaces ADR-0015 Decision 2's 12,000, which was 30 months at 400 a month. At 12,000 the lead, not the crews, would hold the city back.
6. **The Board says the list.** The population premises name the demand ("People joining the waiting list: 30,000 a year, moving in as homes stand empty"). The month line and the people-now sentence say how many wait for a home, and say nothing while nobody does. The month table has a Waiting column.

## Consequences

- **The crews are the brake, and nothing else is.** Measured on the real path, seed 42 (`domain/run/test/past.test.ts`, `founding.test.ts`): every home is taken the year it opens and the list only grows. No build pace, jobs-a-year or budget premise was added to make that so.
  - From one neighborhood, the city reaches 100,000 at year 20. From nothing, it reaches 115,000 at year 20, passing 100,000 in year 19.
  - The second circle opens in year 22 from one neighborhood and in year 20 from nothing.
  - Both circles are full by year 50: 72 neighborhoods and 360,000 people. That figure holds to year 70, because no third circle fits the board, while the list passes 1.1 million.
  - Line-years over seventy years: 13 from one neighborhood, 5 from nothing.
  - The ceiling the premises would allow, 30,000 / 0.042 ≈ 714,000, is never reached. The board caps the city first.
- **The price of the lead.** The crews build the needs of about fifteen neighborhoods in hand before the homes (ADR-0012 Decision 2), so the first residents come later:
  - The first residents arrive in year 10, both in David's founding grown by the run (previously year 7) and from an empty site (previously year 5).
  - A lone neighborhood's fields break six years running, years 3 to 8.
  - A full first circle grows to 275,000 people at year 20 in 55 neighborhoods, with 42 line-years (previously 27). Its schools break in years 9 to 13 and 18 to 20, and it costs 26.18 billion to build.
  - The second circle's first neighborhood is lived in from year 10, month 12 (previously year 5).
  - David's founding by hand has 48 line-years (previously 46).

  A shorter lead or more crews would change these figures. Either is a change to a premise, not to this decision.
- ADR-0009 Decision 3 keeps its rates (births, deaths, movers, leavers) and loses its arrivals clause to Decision 1 here. A note on ADR-0009 points here, and ADR-0009 stays ACCEPTED.
- ADR-0012 Decision 4's "at no more than 4,800 a year" now reads "as far as the waiting list holds people". Arrivals still go in tile order and only into homes the gate admits. A note on ADR-0012 says so.
- ADR-0015 Decision 2's lead is now 75,000. A note on ADR-0015 says so.
- ADR-0016 Decision 3's "about forty years" and its Phase 8 record are superseded by the figures above. Notes on ADR-0016 say so.
- Issue 9 is outside this decision. A circle built to its full homes still has no headroom for the squeeze.
- A different demand, a start or ceiling for the list, or people who give up waiting would each be a change to a premise, not to this decision.

## Session

Session e62d2d, 2026-10-21, Phase 1 of `docs/work/arrivals-scale-past-100000/plan.md`. Session 34f6b4, 2026-10-21, Phases 2 and 3.
