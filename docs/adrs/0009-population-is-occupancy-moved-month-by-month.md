# ADR-0009: Population is occupancy of the homes as built, moved month by month from sourced rates; the day view is separate

**Date**: 2026-10-14
**Kind**: technical
**Scope**: domain/ledger, domain/site, domain/run, apps/board
**Status**: ACCEPTED

## Context

Issue 3: David asked for "standard population growth/shrinkage data so we can run the sim hour by hour or day by day or month by month". Today a finished neighborhood holds exactly 5,000 people the year it is finished, and people vary only through the stress band. The sources (`docs/brainstorm/future-city/population.md`) show that natural increase is about 1.5 per 1,000 a year, so a new city grows by people moving in, and that new towns filled at a few thousand people a year at most. Population changes over months; trips and power change over hours. The plan (`docs/work/archive/population-from-sourced-rates/plan.md`) needed the shape of both before code.

## Decision

1. **Two clocks, kept separate** (David, 2026-10-14). The Run's month clock owns who lives here. The day view owns how they spend one day, hour by hour, for the people the month clock hands it; it holds no state of its own.
2. **Capacity and occupancy.** The Ledger's 5,000 a tile stays the tile's capacity, the homes as built, which Ground draws (ADR-0005) and the capital rows price. Population is occupancy: how many live in those homes this month. Crowding above capacity stays the stress band's.
3. **A month from yearly rates.** `monthOf(people, capacity)` in the Ledger takes a twelfth of each yearly rate: births 10.7 and deaths 9.2 per 1,000 (CDC/NCHS 2023), 8.7% of people moving house (Census CPS 2022) of whom half leave the city (Mine), and arrivals into empty homes at no more than 4,800 a year citywide (Irvine 1980–1990). No seasons yet.
4. **Premises with marks** (ADR-0007 Decision 9). `POPULATION` holds each rate as a marked premise; David accepted the Sourced ones on 2026-10-14.
5. **Parity is kept by a yearly mode.** The sketch's clock is yearly with homes full the year they finish. The Run keeps that as its yearly mode, identical to the sketch, and the month clock is a mode beside it; the parity suite replays the yearly mode and compares the record's old fields only (ADR-0003 Decision 4).
6. **Spend stays yearly in sum** (ADR-0007 Decision 14). A month's spend is what stands at its end less what stood at its start, and a twelfth of the year's running bill; twelve months sum to the year's spend.
7. **The day reconciles with the checks.** The day view's trips sum to the day's trips and its busiest hour is the ledger's peak (10% of trips, kept by David); NHTS 2022's shares by start time fill the rest of the day. A summer weekday is the default day.

## Consequences

- Ground, the capital rows and every parity figure stay where they are: nothing that reads the homes as built moves.
- The Site's checks take a population instead of `rates.hood × (1 + stress)` (plan Phase 3); at 5,000 a tile every figure is identical.
- *Added 2026-10-14, Phase 3:* `assessCore` takes each neighborhood's occupants (`occupied`), and `assess` carries them into every assessment it makes, the stretch tests included. The daily list is fed or short by the emptiest neighborhood, and its facts say `uneven` when the neighborhoods differ, so the Board names "the emptiest neighborhood" instead of "each". `Core.pop1` stays a full neighborhood under the stress; `Core.people` holds each neighborhood's occupants.
- *Added 2026-10-14, Phase 4:* the Run's month clock is opt-in (`startRun(…, { growth: true })`); crews still work by the year and their work opens in month 12, new neighborhoods empty. Arrivals fill empty homes in tile order, so one neighborhood fills at a time, and a neighborhood filling is too empty to keep its daily list. *Decided by David, 2026-10-14:* short only in neighborhoods still filling is a watch (the daily check's `filling` case), not a break, because their shops open as people arrive; short in a full neighborhood (a deep slump) is still broken. The sized city founded from nothing so watches its daily list until it is full (year 16) and counts no line-years for it. The event stresses (squeeze, slump) still apply on top of occupancy. The yearly path and its parity suite are unchanged.
- A city that builds faster than 4,800 people a year arrive has empty homes, and the month clock shows them; a full city of 50,000 loses about 2,175 people a year to moving and refills from arrivals.
- Trips a person a day stays 3.37 (NHTS 2017) here; NHTS 2022's 2.3 was issue 4, decided in ADR-0010 (keep 3.37).
- A seasonal rate, a different leaving share, or a different pace is a change to a premise, not to this decision.

## Session

Session 51a736, 2026-10-14, Phases 2 to 4, and session c465b8, Phases 5 and 6, of `docs/work/archive/population-from-sourced-rates/plan.md`.
