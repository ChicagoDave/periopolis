# ADR-0020: A growing circle's schools are built with room for the wave

**Date**: 2026-10-22
**Kind**: technical
**Scope**: domain/site, domain/run, apps/board
**Status**: ACCEPTED

## Context

ADR-0019's record left two school breaks in a circle still growing, and named them the wave of families (seed 42: years 9 to 21, up to `rates.band`, 20%, more children, a grade a year) meeting a growing circle. A third is in the same record: one neighborhood, twenty years, breaks its high schools in year 18. ADR-0018 builds a *full* circle's ring, plants and schools with room for the squeeze and reads a growing circle for an ordinary year only; headroom for a growing circle is its "new decision". The plan is `docs/work/school-seats-for-a-growing-circle/plan.md`.

A throwaway probe (deleted) read each break at its year's end on the real path, seed 42:

| Run | Year | Break | Where | Wave this year | The school it walks to | Needs that month |
|---|---|---|---|---|---|---|
| Full first circle | 11 | 20 middle pupils unseated | 8,1, second circle, growing | middle +13.3% | 9,-1: 900 of 1,000 in an ordinary year, 1,000 of 1,000 in the wave | none |
| From nothing | 12 | 64 elementary pupils unseated | -1,-1, first circle, growing | elementary +10% | -1,0 and 0,-1 at 500 of 500 in an ordinary year; 1,-2 at 440, 2,-1 at 360, all full in the wave | none |

The cause is the wave, not the order of work. At each break every school the neighborhood can walk to is built and standing, the needs read for an ordinary year are empty, and nothing for the schools is in hand: the schools were sized to an ordinary year with 0 to 10% to spare, and the wave adds 10 to 20%. A full circle holds because its schools are built to the squeeze's 20% more people (ADR-0018), which seats the wave's 20% more children as well. So two of the plan's candidate mechanisms do not reach the cause and were not measured: proposing schools some months ahead of the families, and ordering a school with the neighborhood it serves. Both change *when* a school is ordered, and every school here was ordered and built in time.

Measured with each remaining option in place (a temporary change to `needsOf`, reverted), seed 42:

| | Now | (a) schools in every circle read at the squeeze | (b) ADR-0018's headroom in every circle | (c) leave as residual |
|---|---|---|---|---|
| Full circle, 20 years | 5 line-years (stops and ways 7, 16; middle 11); 280,000; 27.04 bn | 4 (stops and ways 7, 16); 275,000; 25.82 bn | 4 (stops and ways 7, 16); 260,000; 23.83 bn | as now |
| One neighborhood, 20 years | 10 (ring 1, fields 3-8, stops and ways 16, high 18); 100,000; 26.14 bn | 9 (high 18 gone); 100,000; 25.79 bn | 10 (high 18 gone, fields 9 added); 85,000; 23.64 bn | as now |
| From nothing, 20 years | 3 (elementary 12; stops and ways 16); 115,000; 29.27 bn | 2 (stops and ways 16); 90,000; 24.91 bn | 2; 85,000; 24.65 bn | as now |
| Seventy years, one neighborhood / from nothing | 10 / 3; 150,000 / 155,000 at 30, 235,000 / 230,000 at 40, 305,000 both at 50 | 9 / 2; 140,000 / 155,000, 225,000 / 220,000, 295,000 / 300,000 | 10 / 2; 140,000 / 155,000, 220,000 / 215,000, 290,000 both | as now |
| Both circles full at 360,000 | year 53 | year 53 | year 53 | year 53 |

Both (a) and (b) end every school break. The price is time, as in ADR-0018: the crews build the extra schools before homes, so the city is smaller at years 20 to 50 (by 0 to 25,000 under (a), 15,000 to 30,000 under (b)) and has built less by year 20, while both circles still fill in year 53. (b) also builds the ring and plants of a growing circle to the squeeze, which no break here asks for, costs the most people, and adds a fields break in year 9 from one neighborhood.

## Decision

1. **Every circle's schools are read at the squeeze** (David, 2026-10-22, option (a)). `needsOf` reads the elementary, middle and high schools with each neighborhood of every circle, full or growing, holding `rates.hood` more `rates.band`. A school need that an ordinary year would not ask for is marked `squeeze`, as ADR-0018's are. The marker keeps one meaning, a need the squeeze adds; whether the circle is full is the layout's to say (`isFull`), not the marker's, so the `Need` shape is unchanged.
2. **Only the schools.** A growing circle's ring and plants are still read for an ordinary year; a full circle keeps ADR-0018's headroom for its ring, plants and schools. Option (b), ADR-0018's headroom in every circle, was declined: no break asks for it, and it costs the most people.
3. **The figure is the squeeze's, `rates.band`.** The wave adds at most `rates.band` more children to a grade (`waveIn` is at most 1), so the squeeze's figure seats it. The needs do not read the timeline: they stay a query of the Site alone (ADR-0008), and a school is built with room before any wave is announced.
4. **The invariant**, restating ADR-0018 Decision 5: the needs are empty exactly when no `NEED_CHECKS` check is broken in an ordinary year, no headroom check is broken in a full circle at the squeeze, and no school check is broken in any circle at the squeeze. A layout with no circles is read for an ordinary year only.

## Consequences

- **The school breaks are gone.** Measured on the real path, seed 42 (`domain/run/test/past.test.ts`, `founding.test.ts`; Phase 2 re-measured every figure Phase 1 found): the full first circle's middle seats in year 11, the from-nothing run's elementary seats in year 12, and one neighborhood's high seats in year 18 no longer break. The full circle loses 4 line-years (5), the stops and ways of the closure years 7 and 16; one neighborhood over twenty years 9 (10); from nothing 2 (3); the seventy-year runs 9 and 2 (10 and 3). David's founding grown still holds every line, 90,000 people in 18 neighborhoods at year 20, with 8 middle and 7 high schools ordered (6 and 6); by hand it is unmoved.
- **The price is time.** The crews build the extra schools before homes (ADR-0012 Decision 2). The full circle holds 275,000 at year 20 (280,000) for 25.82 billion (27.04); from nothing 90,000 at year 20 (115,000) for 24.91 billion (29.27); one neighborhood 100,000 as before, for 25.79 billion (26.14). From nothing the first circle fills later, so at year 20 it is 90,000 in 18 neighborhoods (115,000 in 23) and the second circle is not yet open. David's founding grown has its first residents in year 11 (10) for 24.84 billion (25.16). Seventy years, one neighborhood and from nothing: past 100,000 in year 19, month 12 and year 21, month 12 (20:12 and 19:12); the second circle opened in year 23, month 1 and year 24, month 12 (22:1 and 20:6); 140,000 and 155,000 at year 30 (150,000 and 155,000), 225,000 and 220,000 at year 40 (235,000 and 230,000), 295,000 and 300,000 at year 50 (305,000 both). Both circles are full at 360,000 in year 53, as before.
- **Residual.** The line's closures (stops and ways in years 7 and 16) remain, a separate decision (ADR-0019 Future changes). A growing circle's ring and plants are not built for the squeeze or the wave; none of them breaks in the record.
- **The Board** words a need marked `squeeze` by its circle: in a full circle as now ("The circle is full, so it is built with room for the squeeze."); a school in a growing circle as built with room for the squeeze and the wave of families. `squeezeSaid` in `apps/board/src/wording.ts` reads the circle with `isFull`, and `apps/board/test/wording.test.ts` holds both sentences.
- **Tests.** A test beside `domain/site/test/headroom.test.ts` holds the rule: a growing circle's schools are needed to the squeeze and marked `squeeze`, its ring and plants are not.
- **Parity.** The sketch's clock never proposes, so its fixtures and the parity suites are unmoved (ADR-0003).
- **The starter is a growing circle** (its one circle at `0,0`, not full), measured unchanged: its schools hold at the squeeze, so it needs nothing and the sized starter (ADR-0008 Phase 4, `sizedTo`) and its browser flow are as before. One neighborhood more is not: at `2,0` it now asks for an elementary and a high school to the squeeze before its line (3 proposals, 1 before), and thirteen neighborhoods for three elementary schools and a high school (10 proposals, 8 before); `domain/site/test/needs.test.ts`, `propose.test.ts`, `apps/board/test/needs.test.ts` and the needs card's browser flow are re-pinned for it.
- **Notes elsewhere.** ADR-0018's Future changes ("headroom for a growing circle ... is a new decision") and ADR-0019's "The two new school breaks" carry dated notes pointing here.
- **Future changes.** A growing circle's ring and plants built to the squeeze, or the needs reading the wave's own figure from the timeline, would each be a new decision.

## Session

Session 9548f4, 2026-10-22, Phases 1 (the cause and the decision) and 2 (the change and the record) of `docs/work/school-seats-for-a-growing-circle/plan.md`.
