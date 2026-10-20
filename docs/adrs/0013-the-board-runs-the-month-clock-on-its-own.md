# ADR-0013: The Board runs the month clock on its own: Play drives the months, an order pauses them, and one Play is one undo

**Date**: 2026-10-19
**Kind**: technical
**Scope**: apps/board
**Status**: ACCEPTED

## Context

Issue 3 (David, 2026-10-14) asked for population data "so we can run the sim hour by hour or day by day or month by month". ADR-0009 built the month clock, and the Board shipped it as a manual Next month tap behind a checkbox, while "Run this city for 20 years" only started the clock at year 0 and waited for Next year. David, 2026-10-18: the ask was "monthly automated incremental and visible progress". The plan `docs/work/archive/board-auto-run-by-month/plan.md` built it and left three choices that a future session touching the clock card or the Board's call to `startRun` would otherwise re-litigate.

The Run is untouched: `tickMonth` is one pure step, the Run's default (`growth` absent) is still the sketch's yearly clock, and the parity suite replays that mode (ADR-0009 Decision 5). Everything here is Board wiring and wording (ADR-0004).

## Decision

1. **The Board's default run is the month clock.** "Start the clock on this city" and "Start a city from nothing" call `startRun` with `growth: true` unless the player checks "Year by year, as the sketch runs it", which is the yearly mode of ADR-0009 Decision 5, kept reachable for the sketch's figures and for the two browser flows pinned on them. The Run's own default does not change.
2. **Starting a run never starts the months.** A new run stands at year 0 with the orders open; Play starts the timer, at Slow, Steady or Fast (1 s, 400 ms, 100 ms a month), and the speed can change while it runs without resetting the month. The timer calls the same month step the Next month tap calls (`monthStep` in `src/autorun.ts`); there is one step, never two.
3. **An order pauses the months.** *Amended 2026-10-19 by ADR-0015: the player's own order; an order the run places for itself with `infer` does not pause.* A move that changes the layout while the months run pauses the timer and says so ("Paused: your order is in. Press Play to carry on."). Selecting a tool, looking at a tile or hovering does not. Stop, a new run, Next year, Next month and undo pause first. The timer stops itself at year 20 and Play goes with it.
4. **One Play is one undo step.** Play remembers one state, where it was pressed; the months it then runs remember nothing. The taps keep one state each. A run of 240 months is one step back, not 240.
5. **The timer lives in memory only.** Storage keeps the clock exactly as before; a reloaded run opens paused in the month it reached and never resumes on its own.

## Consequences

- A control added to the clock card goes through `AutoRun` (`play`, `pause`, `setSpeed`) and the shared step; a second path that calls `tickMonth` directly breaks Decision 2's "one step".
- Any new way to change the layout while the clock runs must pause through `page.commit` or `page.swap`, as every move does today, or it violates Decision 3. *Amended 2026-10-19 by ADR-0015: a new way the player changes the layout; the run's inferred orders are placed inside the month step and do not pause.*
- A sentence the timer says is Board wording (`clockStarted`, `yearsUp`, `PAUSED_FOR_ORDER`, `SPEED_NAME` in `wording.ts`); the Run emits none.
- The yearly checkbox is an opt-out, not a mode the Board promotes; removing it would be a change to Decision 1 and would need the two yearly flows re-pinned on the month clock.
- `apps/board/test/autorun.test.ts` holds Decisions 2 to 4 with a scheduler fired by hand; browser flow 12 holds all five on the built page.
- The Run's `growth` option and the parity suite are unchanged (ADR-0009 Decision 5 carries a pointer here).
- What the run orders for itself as the city grows is not decided here: issue 7 (David, 2026-10-19, "the sim should infer growth") is its own decision, ADR-0015 (2026-10-19).

## Session

Session 2c0551, 2026-10-19; Phase 2 of `docs/work/archive/board-auto-run-by-month/plan.md`.
