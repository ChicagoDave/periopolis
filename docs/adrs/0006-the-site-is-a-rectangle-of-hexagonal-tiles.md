# ADR-0006: The site is a rectangle of hexagonal tiles that holds the sketch's hexagon

**Date**: 2026-10-13
**Kind**: technical
**Scope**: domain/site
**Status**: ACCEPTED

## Context

The sketch laid the city out on a hexagon of hexagons, five tiles from the middle to the edge, 91 tiles. Drawn, that outline reads as a board game, which the brainstorm's "Next" item 2 (`docs/brainstorm/future-city/overview.md`) asks to remove. The tiles themselves are sound: evenly spaced centers, each home going to its nearest, give hexagonal catchments, and the Ledger's figures per tile (ADR-0005) do not depend on the site's edge. What has to change is only the outline, the set of tiles the site admits.

The Site's parity suite (ADR-0003) records the sketch's board radius and tile count and runs every fixture on the sketch's tiles. ADR-0003 Decision 4 names "a non-hexagon site" as its own plan after the port, starting from the ported code, so this is the first decision the port's freeze allows the Site to make.

## Decision

1. The Site's shape is a value, `Outline`, with two kinds: `hexagon(radius)`, which is the sketch's board, and `rectangle(halfWidth, halfHeight)`. `SiteRates.outline` replaces the bare radius `board`, and `onBoard`, `allTiles`, `neighbors` and `adjacent` take the outline. Tiles are still named `q,r` on the same axial grid with the middle at `0,0`; `kmBetween` and every per-tile figure are unchanged.
2. A rectangle admits a tile when its row is within `halfHeight` of the middle and its center, which sits `q + r/2` steps east of the middle, is within `halfWidth`. Every row then spans the same width on the ground; rows that sit half a step over hold one tile fewer. The sides are a hexagon's sawtooth, which the Board's outline hides. *Amended 2026-10-20 by ADR-0016 Decision 1: a rectangle is an extent (west, east, north, south), of which the centred form is the special case, so two circles at `0,0` and `9,0` fit with no key moved.*
3. *Amended 2026-10-20 by ADR-0016 Decision 1: the city's outline is a rectangle laid along a lake shore, its south edge, from row -4 to row 4 and from 4 steps west of `0,0` to 4 steps east of `9,0`, holding two circles; the shape and Decisions 1, 2, 4 and 5 stand.* The city's outline was `rectangle(5, 5)`: 11 rows, 11 tiles on even rows and 10 on odd rows, 115 tiles, with corners at `-2,-5`, `7,-5`, `-7,5` and `2,5`. It is the smallest rectangle that contains the sketch's hexagon, so every tile, layout, stretch and fixture the sketch recorded is still on the board. A wider, landscape site is a change to the two figures, not to the shape.
4. `allTiles` walks rows from the top and tiles west to east within a row, as the sketch does, so the order over the 91 tiles the two outlines share is the sketch's order. Run's bypass search takes the first joinable stretch in that order and so does not move.
5. *Amended 2026-10-20 by ADR-0016 Decision 4: the nine-row board along the shore does not hold the sketch's rows ±5, so the guard below holds for every tile the fixtures place rather than every tile of the sketch's board.* The parity oracle stays pinned to the sketch's outline. The Site's parity test builds `hexagon(BOARD)` from the fixture, checks its tile count against the recorded 91, and checks that every one of those tiles is inside the city's outline. The shipped rates are not compared to the sketch's radius, because they differ on purpose.

## Consequences

- Site tests that place or restore tiles just outside the hexagon but inside the rectangle (`-6,3`, say) now succeed; tests of refusal use tiles outside the rectangle (`6,0`, `5,1`). `restoreLayout` and `restoreClock` keep only what the outline admits, as before.
- The Board sizes its frame from `extent(outline)` and draws the outline's tiles. How it draws the edge, the tile lines and the page's description of the site is the Board's own change (`docs/work/rectangular-site-outline/plan.md`, Phase 2), governed by ADR-0004 for the wording.
- The Playwright flows that count 91 drawn tiles count 115 once the Board draws the rectangle. The 14-of-15 tally does not move: the starter layout uses only the sketch's tiles.
- Ground's frame (ADR-0005 Consequences) is unaffected by this decision: a tile is the same hexagon under either outline. The frame is revisited only if a tile's shape changes.
- ADR-0003's freeze still governs every figure and rule; the outline is the one departure, recorded here, and a parity difference anywhere else remains a defect in the port.

## Session

Session c16dd8, 2026-10-13, Phase 1 of `docs/work/rectangular-site-outline/plan.md`.
