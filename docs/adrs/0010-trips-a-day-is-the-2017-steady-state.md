# ADR-0010: Trips a person a day is the 2017 steady state, 3.37, until a survey shows travel has settled

**Date**: 2026-10-14
**Kind**: technical
**Scope**: domain/ledger
**Status**: ACCEPTED

## Context

Issue 4: the ledger's `trips` premise is 3.37 person trips a person a day (NHTS 2017). NHTS 2022's Summary of Travel Trends, Table 4-9, gives 2.3 (±0.05) against 3.4 (±0.04) in 2017. ADR-0009 kept 3.37 for the population plan and left this as its own decision. The figure drives every trip, fleet and cost figure: trying 2.3 fails 26 of 538 tests, the ledger's city needs 148 movers instead of 217, the sized city's summer weekday falls from 147,727 trips to 100,823, costs a person move under 0.3%, and every Site parity case against the sketch fails (its `model.js` fixes 3.37, ADR-0003).

The 2022 report qualifies its own figure: trends "should be interpreted cautiously, as what is being observed is a recovery from the pandemic, not a steady state"; the drop is "a larger decline than any other year by far" and "more research is needed to fully assess the temporary nature of this drop"; and its methods changed (web only, no telephone option, no travel log), which "may affect comparability", corrected by a trip adjustment factor (Section 1.2, Appendix A).

## Decision

1. **The design figure is a steady state** (David, 2026-10-14). The city is sized for an ordinary year, so `trips` stays 3.37 (NHTS 2017), the last survey taken in a settled year.
2. **2022 is not rejected as wrong, only as unsettled.** Its 2.3 stays in `docs/brainstorm/future-city/population.md` as the source on record, and its shares by start time still shape the day view (ADR-0009 Decision 7): those are shares, not the total.
3. **Revisit on evidence of settling.** A later NHTS (or FHWA release) showing trips a person a day has settled is the trigger to reopen this, not a wish to show a smaller fleet.

## Consequences

- No figure, pin or parity fixture moves; the sketch stays the parity reference unchanged.
- The fleet and the day are sized for pre-pandemic travel, so if 2022's level persists the city is over-built for trips; that is the side this errs on.
- A Board stress for a quiet year at 2.3 is possible later as its own work, beside this design figure, not instead of it.
- Changing `trips` is a change to an accepted premise and re-pins the 26 tests named above.

## Session

Session d79db2, 2026-10-14; closes issue 4.
