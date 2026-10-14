# ADR-0007: Cost is a derived consequence of the ledger, priced from placeholders

**Date**: 2026-10-13
**Kind**: technical
**Scope**: domain/ledger
**Status**: ACCEPTED

## Context

The brainstorm's "Next" item 3 is the one word "Money", and its open list says "what any of it costs" is still unknown (`docs/brainstorm/future-city/overview.md`). ADR-0003 Decision 4 names money as its own plan after the port. The ledger already counts nearly everything a city is made of, per city and per person, for both columns, by one arithmetic the car column vouches for. The question was where money enters and how far it reaches: a price on every count, or a budget the clock plays with, or a business model for the tool itself. The plan (`docs/work/money/plan.md`) reads it as the first, to be confirmed by the figures it prints.

## Decision

1. Cost is a tenth step of the ledger: a **consequence**, never set, derived once per column from the counts the nine steps give and a list of **unit costs**. `deriveCarCity` and `deriveWalkingCity` take the unit costs as a last parameter and return `cost` beside every other figure.
2. Every unit cost is a **premise marked Mine**: a placeholder in `COSTS` that David can change, and never a figure hard-coded in the derivation. A cost row is exactly one premise times one ledger count, with both kept on the row, so a reader can trace every dollar to the count it prices and the placeholder it was priced at.
3. **Both columns are priced by the same function.** A column lists what it has (the car city has parking and cars; yours has the sub level, the stops, the pipe, the dumbwaiters, the lanes and the movers), and one arithmetic prices the lists and totals them. A difference between the columns is a difference in what they build and run, never in how the money is added up.
4. Two kinds of money: **capital** to build, and **running** cost for a year. Each is a total and a per-person figure. Running cost holds an upkeep row (a share of what was built, vehicles aside), vehicle-kilometers, vehicles worn out, goods runs, and porters where there are any.
5. **Floor is priced once.** Buildings are priced by the square meter of floor the ledger already fixes: low-rise floor (homes, shops, schools, clinics) and the ring's high-rise floor. Needs and schools are inside that floor and are not priced again by count; the plan's "needs by count" was dropped for that reason.
6. **Plants are not ledger counts.** Reactor modules and plant units are Site concepts (`docs/domain/site.md`, Mine, lines 20 and 22), so their unit costs enter here as premises and the Site prices the modules and units that stand. The same holds for everything placed on a layout: the Ledger is the only place a unit cost lives, and the Site and the Run derive the cost of what stands and what is ordered from the Ledger's premises times their own counts. ADR-0005 Decision 2 split Site from Ground by the question each answers; "what does what stands cost" is a Site question because the Site owns what stands.
7. **Money adds rows and moves nothing.** Every figure of the nine steps is identical with and without a cost premise, the parity suite compares the old rows only, and the published figures do not move. The wording of money (dollars, millions, "per person") is the Board's (ADR-0004); the Ledger emits numbers and row ids.

## Consequences

- `domain/ledger/src/cost.ts` holds the premises, the row ids, the pricing and the two column lists. A new thing the city builds is a new row id, a new count from the ledger, and a new unit cost in `COSTS`, in one change; the type checker reports a row the Board has not worded.
- The Site and the Run, in `docs/work/money/plan.md` Phase 2, price what stands from `COSTS` and their own counts. They do not carry unit costs of their own.
- The placeholders are round 2026 dollars and are not tuned. The published city at these placeholders costs about 248 thousand dollars a person to build in the car column and 247 in yours, and about 5,900 against 3,200 a year to run. Those four figures are pinned in `cost.test.ts` as a check on the placeholders, not as truth.
- Changing a placeholder moves exactly the rows that use it, and the test suite asserts that. A redesign of money (a budget the clock spends, a price on land, financing) is a new decision, not a change to a placeholder.

## Session

Session ec9b68, 2026-10-13, Phase 1 of `docs/work/money/plan.md`.
