# ADR-0018: A full circle is built with room for the squeeze

**Date**: 2026-10-21
**Kind**: technical
**Scope**: domain/site, domain/run, apps/board
**Status**: ACCEPTED

## Context

Issue 9. Proposals size what a layout needs for an ordinary year (ADR-0008 Decision 2). A circle that is still growing absorbs a squeeze, line 18's 20% more people in the same homes, because it always has neighborhoods and their needs on order ahead of the people. A full circle has nothing on order. Before this decision, ADR-0017's real-path record showed the cost: a first circle full to 180,000 and run for twenty years broke its ring, schools and plants in squeeze years 5 to 7, broke its schools again in years 9 to 13 and 18 to 20, and lost 42 line-years. The plan is `docs/work/archive/full-circle-headroom-for-squeeze/plan.md`.

## Decision

1. **Headroom once full** (David, 2026-10-21). A circle is full when no tile for homes is open in it (ADR-0016 Decision 3). For a full circle, the needs of its ring, its plants (power, water, sewage, waste) and its schools are read with its neighborhoods at the squeeze. A circle that is still growing is read for an ordinary year. A layout with no circles is read for an ordinary year, so the sketch's fixtures and the parity suites (ADR-0003) do not move.
2. **The squeeze is the stretch test's figure, `rates.band`** (20%, Mine in the Ledger). This decision adds no new premise. `headroomOf(layout, rates)` puts each neighborhood of a full circle at `rates.hood × (1 + rates.band)` and leaves every other neighborhood at its capacity. `needsOf` reads the headroom checks (`HEADROOM_CHECKS`: ring, power, water, sewage, waste, elementary, middle, high) off a second `assessCore` with that occupancy, and every other need off the ordinary year. A negative squeeze is refused with a RangeError.
3. **Fields and the mover line are left out** (David, 2026-10-21). The measured squeeze breaks were the ring, the schools and the plants. The size watch and the daily list never ask for anything (ADR-0008 Decision 3).
4. **One definition of full.** `isFull(layout, middle, outline)` in the Site holds when every on-board home tile of the circle (rings 1 to 3) is taken, which is exactly when `proposeNeighborhood` finds no room there. The Run passes it the planned board, as it does `proposeFor`, so work in hand counts, and the headroom and the next circle are decided in the same month.
5. **The invariant, restated per circle.** ADR-0008 Decision 3 held that the needs are empty exactly when no `NEED_CHECKS` check is broken. It now reads: the needs answer exactly the checks broken in an ordinary year, together with the headroom checks broken in the full circles at the squeeze. `domain/site/test/headroom.test.ts` holds this.
6. **The Board says so.** A need the squeeze adds, which an ordinary year would not ask for, carries `squeeze: true`. `needText` adds "The circle is full, so it is built with room for the squeeze." to it, and words a school need's pupils as "with no seat in a squeeze". A need that an ordinary year asks for is worded as before.

## Consequences

- **The full circle holds.** Measured on the real path, seed 42 (`domain/run/test/past.test.ts`): a first circle filled by the Site's own proposals, now with its headroom, runs twenty years. None of its ring, schools or plants breaks. What still breaks is the line: the haul in years 2 and 3, and stops and ways in years 7 and 16, for 6 line-years (42 before). The second circle still opens in month 1, is lived in from year 10, month 12, and holds 275,000 people in 55 neighborhoods at year 20. It costs 26.18 billion to build.
- **The price is time.** The crews build the full first circle's headroom before the second circle's homes (ADR-0012 Decision 2).
  - From one neighborhood and from nothing, the city reaches 100,000 and 115,000 at year 20, and opens the second circle in year 22 and year 20, all as before.
  - It then reaches 150,000 and 155,000 at year 30 (175,000 before), 235,000 at year 40 (245,000), and 295,000 at year 50.
  - Both circles are full at 360,000 in year 53, three years later than before. Line-years over seventy years stay at 13 and 5.
- **Residual.** The line is not sized for the squeeze. Stops and ways break in squeeze year 7 of the full circle's run, and the haul breaks in years 25 and 26 of the seventy-year runs. A line with headroom would need a new decision.
  - *Note (2026-10-22, session ff8a39):* the line has nothing to size, so this residual is not the squeeze's. The line checks (stops, work, ways, haul) measure connection, not capacity: the haul asks whether each plant is joined to the line, stops whether a lived-in neighborhood has a stop reaching its ring, and neither reads how many people live there. Seed 42's timeline closes a stretch of line in years 7 and 16, exactly the stops and ways breaks, so those are the closures. The haul breaks in years 2 and 3 come before the squeeze and those in years 25 and 26 after every event; their cause is not yet measured (a plant built before the line reaches it is the likely reading). A plan to give the line headroom once full was abandoned for this reason (`docs/work/archive/size-line-for-squeeze-once-full/plan.md`). Fewer line-years would need a different decision: a line that holds through a closure, or a plant joined to the line as it is built.
  - *Note (2026-10-22, session ff8a39):* the haul's cause is measured: a plant's line is proposed apart from it and stands 14 to 55 class-0 jobs behind it. ADR-0019 decides that a plant is proposed with the line that joins it. Its record re-pins this one: the full circle's run loses 5 line-years (stops and ways in 7 and 16, the second circle's middle seats in year 11) and holds 280,000 at year 20 for 27.04 billion; the seventy-year runs 10 and 3 line-years, 305,000 at year 50, both circles still full in year 53.
- **`sizedTo`** trims a layout only while it needs nothing, so in a full circle it keeps the headroom. The starter's circle is not full, so the sized city is unchanged.
- **Notes elsewhere.** ADR-0008 Decisions 2 and 3 are narrowed for full circles, and a note there points here. ADR-0016's Consequences (issue 9) and ADR-0017's record carry dated notes pointing here.
- **Future changes.** A different squeeze figure is a premise change (`rates.band`). Headroom for a growing circle, or for fields and the line, is a new decision.
  - *Note (2026-10-22, session 9548f4):* ADR-0020 decides headroom for a growing circle's schools: every circle's schools, full or growing, are read at the squeeze, so they seat the wave of families; a growing circle's ring and plants stay at an ordinary year. Decision 5's invariant is restated there with the school checks of every circle. The full circle's run re-pins: 4 line-years (the stops and ways of the closure years 7 and 16), 275,000 in 55 neighborhoods at year 20 for 25.82 billion; both circles still full in year 53.

## Session

Session 34f6b4, 2026-10-21, Phase 1 of `docs/work/archive/full-circle-headroom-for-squeeze/plan.md`.
