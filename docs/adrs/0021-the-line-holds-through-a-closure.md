# ADR-0021: The line holds through a closure

**Date**: 2026-10-23
**Kind**: technical
**Scope**: domain/site, domain/run, apps/board
**Status**: ACCEPTED

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

2. **The Site orders the way round, as a need read under the named closure** (David 2026-10-25). Once a closure's stretch is named, the Site's checks run with that stretch closed; the neighborhoods it cuts off break the stops and ways checks, and the need is the way round. `needsOf` takes the year's closed stretches as `assessCore` already does (`stress.closed`); the need is the existing `line` need for the cut-off neighborhoods, and `proposeFor` lays it with the closed stretch treated as absent, so the fewest new stretches join the closed stretch's two ends without it and the `Need` shape and the Board's wording are unchanged. The proposal is ordered and crewed like any other need (ADR-0008). The Run orders nothing for itself (not ADR-0015's route), so the line's shape is reasoned about in one place and the Board explains the way round as it explains every other need. If Phase 2 finds the `line` need cannot carry it, a new need kind is recorded here as an amendment.

3. **The closed stretch is named when the closure is announced, a year ahead, and the way round waits its turn in the queue** (David 2026-10-25). Today a closure carries `notice: 1`, and `yearPasses` draws its stretch when the year reaches `start - notice`, which is the close of the year before: announcement and naming are already one moment, and the stretch is known only as the closure year's months begin. A closure now carries `notice: 2`, so it is announced and its stretch drawn at the close of the year two before it; the year before runs its twelve months with the closure announced and its stretch named, and the Site reads it for that whole year, so the need, proposal and order come a year early. The way round is an ordinary class-0 job: it is not put first (not ADR-0012 Decision 7's emergency route). Phase 2 measures whether a year's lead time holds every closure on seed 42; if it does not, put-first is the measured fallback, and this decision is amended rather than silently bent.
   *Amended 2026-10-25 (Phase 2, session 0ba30d), on two measurements.* **The way round is put first.** With a year's lead time and the way round in its turn, the one-neighborhood and from-nothing runs hold both closures, but the full first circle still loses year 7 (2 line-years): its way round is ordered the month the stretch is named, year 5 month 12, and the second circle's ring, plants and line keep more than ten class-0 jobs ahead of it through years 6 and 7, so it opens at the close of year 7, a year late. So the run puts the way round first in the work in hand the month it orders it, first within class 0 as `putFirst` does (ADR-0012 Decision 2); every closure measured then holds. Only the way round is put first: the line an ordinary year would ask for on the same board waits its turn, and the `InferredOrder` fact carries `first` so the same orders placed by hand are put first the same way (the ADR-0015 Decision 5 replay holds to the cent). **The two-year notice is the in-order run's.** The sketch parity suite compares every year's notices against the sketch's clock (ADR-0003), so `beginClock` gives closures `notice: 2` only on a run built in order (`inOrder`, ADR-0012; every run the Board starts on the month clock), by hand or growing itself, so a player gets the same year's warning the run does; the sketch's clock keeps its one year and is byte-identical. David's founding by hand (ADR-0012's 48 line-years) is unmoved by the earlier draw.

## Consequences

- No closure on seed 42's real path cuts anyone off (Phase 2, 2026-10-25, `domain/run/test/past.test.ts` and `founding.test.ts`): the full first circle's twenty years lose no line-years (4 before), 280,000 people in 56 neighborhoods at year 20 for 26.73 bn (275,000 in 55, 25.82 bn); one neighborhood 7 line-years (9), the ring in year 1 and the fields in years 3 to 8, 100,000 at year 20 for 25.65 bn; from nothing no line-years (2), 100,000 in 20 neighborhoods (90,000 in 18) for 26.65 bn; the seventy-year runs 7 and 0 (9 and 2), both circles full in year 53 as before, 145,000 and 140,000 at year 30 (140,000 and 155,000), 225,000 each at year 40, 295,000 each at year 50. David's founding grown (seed 7) is unchanged. The stretches drawn moved with the draw: the full circle's year 16 closes `-2,0|-3,0`, one neighborhood's `-1,0|0,-1`. The from-nothing run gains 10,000 people because the full first year's lead time lets its line be laid where the closures fall, not because the closure's way round adds homes; the gain was not traced further.
- The naming moves in the Run timeline: a closure in year 7 is announced, and its stretch drawn, at the close of year 5, and `namedClosures` names it for years 6 and 7. Every closure carries its stretch from announcement on, and a game can show the player the threat with a year to answer it.
- The way round jumps the class-0 queue (the amendment to Decision 3); nothing else does. A crew-year goes to it ahead of the ring, plants and stretches already in hand, and the records above carry that cost.
- `needsOf` and `proposeFor` take the year's closed stretches; `proposeFor` lays the line as if a closed stretch were not there and never over it, so the way round is never the closed stretch laid again. The needs are still a query of one layout: the Run passes the list, the Site never reads the clock.
- `needsOf` and `proposeFor` take the year's named closures, so the Site is no longer a pure ordinary-year query. ADR-0018 Decision 5's invariant is restated: needs equal the checks broken under the year's known stresses. A year with no named closure reads exactly as before.
- The Board shows the way round as a need with a proposal, in the same words as any other need; no second explanation path is added, and the player's veto (ADR-0015) reaches it as it reaches every order.
- Amends ADR-0020 Decision 3 ("the needs do not read the timeline"): the needs read the timeline's named closures, and nothing else of it. ADR-0008 Decision 2's ordinary year is narrowed the same way. Phase 2 of `docs/work/line-holds-through-a-closure/plan.md` writes the dated notes on ADR-0008 and ADR-0020, and on ADR-0018 and ADR-0019 for the re-pinned figures.
- Each closure adds a stretch that stays after the closure ends, so the line slowly gains loops where closures have fallen.
- The record keeps line-years honest: a way round that is not built in time leaves the closure's breaks in the record.

## Session

585eb2 (Phase 1 of `docs/work/line-holds-through-a-closure/plan.md`); 0ba30d resolved Q-2 and Q-3 (2026-10-25).
