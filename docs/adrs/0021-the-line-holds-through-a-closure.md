# ADR-0021: The line holds through a closure

**Date**: 2026-10-23
**Kind**: technical
**Scope**: domain/site, domain/run, apps/board
**Status**: DRAFT

## Context

After ADR-0020 the only line-years left in the full first circle's twenty-year record are stops and ways in years 7 and 16, the two closures of seed 42's timeline (events #2 and #4: a stretch of mover line closed for one year). ADR-0018's 2026-10-22 note found that stops and ways measure connection, not capacity, so no headroom reaches them, and ADR-0019 and ADR-0020 left "a line that holds through a closure" as a separate decision. The plan is `docs/work/line-holds-through-a-closure/plan.md`.

A throwaway probe (deleted) read each closure on the real path, seed 42, at the year's end:

| Run | Year | Stretch closed | Cut off | Breaks | Stretches / closable / bridges (cutting a neighborhood) |
|---|---|---|---|---|---|
| Full first circle | 7 | -1,0 to -2,0, two neighborhoods | -2,0 and -3,0 | stops (2 neighborhoods), ways (2.9% of trips stuck) | 65 / 38 / 38 (36) |
| Full first circle | 16 | -2,1 to -3,1, two neighborhoods | -3,1 | stops (1), ways (1.4%) | 76 / 60 / 60 (52) |
| One neighborhood | 7 | -1,0 to 0,0, a neighborhood and open ground | nobody | nothing (fields breaks that year as before) | 20 / 3 / 3 (1) |
| One neighborhood | 16 | -1,0 to -2,0 | -2,0 | stops (1), ways (2.7%) | 33 / 20 / 20 (14) |
| From nothing | 7 | -1,0 to 0,0, open ground and the ring | nobody (nobody lives there yet) | nothing | 19 / 19 / 19 (0) |
| From nothing | 16 | -1,1 to -2,1 | -2,1 | stops (1), ways (3.1%) | 32 / 18 / 18 (11) |

The seventy-year runs meet the same two closures as their twenty-year runs, with the same outcome. Closures account for all 4 of the full circle's line-years, 2 of one neighborhood's 9, and both of from nothing's 2.

The cause is the shape of the line, not the order of work or its size. The Site lays the line by the fewest stretches (`proposeFor`), so the line is a tree. In every closure year measured, every closable stretch is a bridge: no stretch has a way round it. A closure draws its stretch evenly among the closable ones (`pickEdge`), and most of those cut off at least one neighborhood. In each closure year the needs are empty. `needsOf` reads an ordinary year, and the closure is the Run timeline's, so nothing is proposed, ordered or crewed for it. The stretch is named at the close of the year before (year 6 and year 15): the run learns which stretch closes only as the closure year's months begin.

Every closure measured has a way round it of one new stretch, joining the two ends of the closed stretch through a neighbor tile already on the line: -2,0 to -2,1 in year 7 and -3,1 to -3,2 in year 16 (full circle); -2,0 to -2,1 and -2,1 to -2,2 in the others' year 16. A stretch takes a crew one year, and what opens at the year's close counts for that year's record.

Measured with option (b) in place (the probe ordered the one-stretch way round as the run, the moment the stretch was named; no production code changed), seed 42:

| | Now | (b) way round, in the queue | (b) way round, put first |
|---|---|---|---|
| Full circle, 20 years | 4 line-years (stops and ways 7, 16); 275,000; 25.82 bn | 2 (stops and ways 7: 19 class-0 jobs ahead of 10 crews; year 16 had 6 ahead and held); 280,000; 26.73 bn | 0; 280,000; 26.73 bn |
| One neighborhood, 20 years | 9 (ring 1, fields 3-8, stops and ways 16); 100,000 | 7 (stops and ways 16 gone); 100,000; 25.65 bn | 7; 100,000; 25.65 bn |
| From nothing, 20 years | 2 (stops and ways 16); 90,000 | 0; 100,000; 26.65 bn | 0; 100,000; 26.65 bn |
| Seventy years, one neighborhood / from nothing | 9 / 2 | 7 / 0 | not run |

The population and capital rising with (b) were not traced. The way round changes the board, so the second closure draws a different stretch (full circle year 16: -2,0 to -3,0, not -2,1 to -3,1).

Options:

- **(a) The line is laid with a way round.** The Site's proposals give each neighborhood two ways to its ring, so no closable stretch is a bridge and no closure cuts anyone off. This is permanent redundancy, built ahead of any closure. Not measured. As a floor, the full circle's line has 18 dead ends (11 of them neighborhoods), so it needs at least 9 more joins, each of one or more stretches, and the crews' time on them comes before homes (ADR-0017).
- **(b) The way round is ordered when the closure's stretch is named.** Only the stretch the closure cuts gets a way round, one stretch in every case measured. In the queue it misses the full circle's year 7. Put first, it holds every closure measured.
- **(c) A closure is a watch, not a break.** A stretch closed for repairs makes stops and ways a warn, not bad, for its year, so the record counts no line-years for it. Nothing is built. By arithmetic, not measured: full circle 0, one neighborhood 7, from nothing 0, with population and cost as now. The record would then stop telling the player that people were cut off.
- **(d) Leave the closures as the accepted residual.** The records stay as they are, and closures are the line-years left.

Weighed with the game lens of ADR-0022:
- (a) takes the closure away as a threat, and makes resilience a fixed rule instead of a strategy the player chooses.
- (b) makes a closure an event with a response, and a game can later hand that response to the player (the run's orders can already be vetoed, ADR-0015). As measured, though, the stretch is named only as the closure begins, so a player would get no warning.
- (c) hides the consequence, so the player gets no feedback.
- (d) is a penalty with nothing to do about it.

## Decision

1. **The way round is ordered when a closure's stretch is named** (option (b), David 2026-10-25). A closure whose stretch is a bridge gets a way round: the fewest new stretches that join the closed stretch's two ends without it, one in every case measured. The line stays as the Site lays it (no standing redundancy, (a)), and a closure that cuts people off still counts as broken in the record (not a watch, (c)).

## Consequences

- No closure measured on seed 42's real path cuts anyone off, provided the way round is built before the closure's year closes. Who orders it, when the stretch is named, and how it is crewed are still open (Q-2, Q-3), and the measured figures depend on the crew order: in the queue 2 line-years for the full circle, put first 0.
- Each closure adds a stretch that stays after the closure ends, so the line slowly gains loops where closures have fallen.
- The record keeps line-years honest: a way round that is not built in time leaves the closure's breaks in the record.

## Open Questions

### Q-2: Who orders the way round: the Site, as a need read under the named closure (ADR-0008), or the Run, ordering for itself (ADR-0015)?
- **Why it matters**: as a Site need, the way round shows up through `needsOf` and `proposeFor`, and so on the Board as a need with a proposal, and ADR-0018 Decision 5's invariant (needs equal the broken checks) has to cover a stress. As a Run order, the Site stays an ordinary-year query, and the way round is an inferred job the player can cancel or veto.
- **Blocks**: Phase 2's seam.

### Q-3: When is the closed stretch named, and how is the way round crewed?
- **Why it matters**: today the stretch is named at the close of the year before, so the way round has only the closure year itself. Crewed ahead of the queue (like ADR-0012 Decision 7's emergency) it holds every closure measured, while waiting its turn in class 0 misses the full circle's year 7. Naming the stretch when the closure is announced would give a year's lead time, which a game needs and which might let it wait its turn, but that was not measured, and it changes which stretch is drawn.
- **Blocks**: Phase 2's timeline and crew order, and the figures to re-pin.

## Session

585eb2 (Phase 1 of `docs/work/line-holds-through-a-closure/plan.md`).
