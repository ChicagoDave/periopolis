# ADR-0019: A plant is proposed with the line that joins it

**Date**: 2026-10-22
**Kind**: technical
**Scope**: domain/site, domain/run, apps/board
**Status**: ACCEPTED

## Context

ADR-0018's Residual named the line breaks it left; its 2026-10-22 note found two causes, the closures (stops and ways in years 7 and 16) and plants that finish before the line reaches them (the haul). This decision is about the second. The plan is `docs/work/plant-ordered-with-its-line/plan.md`.

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

- **What moves.** The plant's proposal costs more by its line, and the line need's proposal by less, so the city's spend for the same pieces is unchanged in sum (ADR-0012, ADR-0015 Decision 4). On the clock the plant's line is crewed beside it, so the haul breaks the probe found should clear. Records will be re-pinned in Phase 2 from running them, and carried here with ADR-0018's.
- **The static Board** lists the plant's proposal with its line in its steps and its price. Its wording (`needText`) words the need, which is unchanged.
- **Parity.** A layout with no proposals in play, and the sketch's clock, which never proposes, are unchanged (ADR-0003).
- **Notes elsewhere.** ADR-0008's Phase 2 Consequence ("knock-on needs follow the addition that causes them") and ADR-0018's 2026-10-22 note carry dated notes pointing here.
- **Future changes.** The closures' stops and ways breaks are a separate decision (a line that holds through a closure).

## Session

Session ff8a39, 2026-10-22, Phase 1 of `docs/work/plant-ordered-with-its-line/plan.md`.
