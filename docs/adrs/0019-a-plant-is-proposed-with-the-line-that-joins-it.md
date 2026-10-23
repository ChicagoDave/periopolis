# ADR-0019: A plant is proposed with the line that joins it

**Date**: 2026-10-22
**Kind**: technical
**Scope**: domain/site, domain/run, apps/board
**Status**: ACCEPTED

## Context

ADR-0018's Residual named the line breaks it left; its 2026-10-22 note found two causes, the closures (stops and ways in years 7 and 16) and plants that finish before the line reaches them (the haul). This decision is about the second. The plan is `docs/work/archive/plant-ordered-with-its-line/plan.md`.

A plant and the line that joins it are ordered in the same month but as two proposals. `proposeFor` proposes one need at a time and reads the needs again after each (ADR-0008 Consequences, Phase 2), and the needs come in a fixed order: ring, modules, plants, schools, fields, intake, line. So the plant's proposal is placed first and the line's last, with the schools and the rest of the month's needs between them. All of those are class 0 (ADR-0012 Decision 2), crewed in the order they stand, ten at a time. The plant gets a crew at once; its line waits behind every class-0 job placed between them.

Measured with a throwaway probe on the real path, seed 42 (session ff8a39):

| Run | Plant ordered, first crewed | Open class-0 jobs ahead of its line | Line crewed | Plant loose |
|---|---|---|---|---|
| Full first circle, 20 years | 1:3, at once | 20 to 23 | 2:12 to 3:12 | 2:12 to 4:12 |
| From one neighborhood, year 2 | 1:1, at once | 14 to 17 | 2:12 | 2:12 to 3:12 |
| From one neighborhood, years 25-26 | 22:3; 23:12 to 24:12 | 34 to 41 | 26:12 | 25:12 to 27:12 |
| From nothing, years 25-26 | 20:8; 23:12 | 48 to 55 | 25:12 to 26:12 | 25:12 to 27:12 |

A stretch of line takes one crew-year and a plant unit two or more, so the delay is the line's place in the queue, not the crews' number or the line's own time.

## Decision

1. **A plant's proposal carries its line** (David, 2026-10-22). When a proposal adds a plant on a tile the line does not yet reach from a neighborhood or ring (the haul check, line 5), `proposeFor` appends to that same proposal the `layStretch` steps that join it, as `lineSteps` would lay them. Plant and line are one proposal, so one order: on the clock, `inferStep` places them through one `placeOrder` and their jobs stand together in the work in hand.
2. **A plant the line cannot reach is not proposed alone.** If no line can be laid to it, the plant's need ends the list as a "no room" proposal, as any need nothing on the board can meet does today.
3. **The crews are unchanged.** ADR-0012 Decision 2 stands as written: the work keeps its order as placed and the classes order only who gets a crew. Two alternatives were declined: the crews taking a plant's line jobs with it (pairing jobs across orders), and crewing every line job first within class 0. Both would rewrite Decision 2, and the second would move lines that join homes and the ring, not only plants.
4. **No new need or fact shape.** The need answered is still the plant's (`plantUnits`, `modules`, or an `intake`'s water unit); the line need no longer asks for a tile its plant's proposal already joins. The invariant of ADR-0008 Decision 3 (as restated by ADR-0018 Decision 5) is unchanged, since needs are still read off the assessment; only what a proposal's steps hold changes.

## Consequences

- **The haul never breaks.** Measured on the real path, seed 42 (`domain/run/test/past.test.ts`, `founding.test.ts`), after the change:
  - A first circle full to 180,000, twenty years on: the haul in years 2 and 3 is gone. What breaks is stops and ways in the closure years 7 and 16, and, new, one neighborhood of the second circle short of 20 middle seats in year 11 of the wave of families, for 5 line-years (6 before). The full circle's ring, schools and plants still hold (ADR-0018). The city grows into the second circle a little faster: 280,000 people in 56 neighborhoods at year 20 (275,000 in 55), 20 of them in the second circle (19), lived in from year 10, month 12 as before; 27.04 billion to build (26.18), more pieces standing by year 20.
  - Seventy years from one neighborhood and from nothing: 10 and 3 line-years (13 and 5). From one neighborhood the haul in year 2 and years 25 and 26 is gone; from nothing, years 25 and 26, and one neighborhood of the first circle, still growing, is short of 64 elementary seats in year 12 of the wave. 100,000 and 115,000 at year 20, the second circle in year 22 and year 20, 150,000 and 155,000 at year 30, all as before; 235,000 and 230,000 at year 40 (235,000 both), 305,000 at year 50 (295,000); both circles full at 360,000 in year 53, as before.
  - One neighborhood, twenty years: 10 line-years (11), the haul in year 2 gone; everything else unmoved. From nothing and David's founding are unmoved.
- **The two new school breaks** are the wave of families (years 9 to 14) meeting a neighborhood in a growing circle a little earlier than before; neither is in a full circle. They are left as measured: a growing circle's headroom is ADR-0018's "new decision".
  - *Note (2026-10-22, session 9548f4):* measured as the wave on schools sized for an ordinary year, not the order of work (at each break every school was built and the needs were empty), with a third in the same record (one neighborhood, high seats in year 18). ADR-0020 builds every circle's schools with room for the wave; all three are gone, and this record re-pins there.
- **Spend.** The plant's proposal costs more by its line, and the line need's proposal by less, so the price of the same pieces is unchanged (ADR-0012, ADR-0015 Decision 4); the runs above build more by year 20 because the city grows faster, not because the line costs more.
- **The Board** words the month's orders as before, the line now beside its plant: "2 reactor modules and 5 stretches of mover line for power, a water plant unit and 4 stretches of mover line for water", where it said "9 stretches of mover line for the mover line" (`apps/board/test/wording.test.ts`). The 18 browser flows are unmoved.
- **The static Board** lists the plant's proposal with its line in its steps and its price. Its wording (`needText`) words the need, which is unchanged.
- **Tests.** `domain/site/test/propose.test.ts` holds the rule: a new plant the line does not reach comes with the stretches that join it, and accepting that one proposal leaves it on the line; a unit on a plant the line already reaches comes with none; a plant the line cannot reach has no room. `second.test.ts` and `band.test.ts` are re-pinned for it.
- **Parity.** A layout with no proposals in play, and the sketch's clock, which never proposes, are unchanged (ADR-0003).
- **Notes elsewhere.** ADR-0008's Phase 2 Consequence ("knock-on needs follow the addition that causes them") and ADR-0018's 2026-10-22 note carry dated notes pointing here.
- **Future changes.** The closures' stops and ways breaks are a separate decision (a line that holds through a closure).

## Session

Session ff8a39, 2026-10-22, Phases 1 (the cause and the decision) and 2 (the change and the record) of `docs/work/archive/plant-ordered-with-its-line/plan.md`.
