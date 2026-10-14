# Session Plan: A plain rectangular site outline with fainter tile lines

**Created**: 2026-10-13
**Plan Status**: ACTIVE
**Overall scope**: Brainstorm "Next" item 2. The site stops being a hexagon of hexagons (reads as Catan) and becomes a plain rectangle of the same hexagonal tiles, drawn with fainter tile lines. Tiles, spacing, nearest-center assignment and hexagonal catchments do not change.
**Bounded contexts touched**: Site (`@city/site`: the board geometry and `RATES.board`), Run (`@city/run`: iterates the site's tiles), Board (`apps/board`: map drawing, export, e2e). Ground is revisited only for the frame it draws into (ADR-0005).
**Key domain language**: Site, Tile, Stretch, Layout, Outline (new: the site's shape)

## References consulted
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — domain stays pure; the outline lives in Site, the drawing in the Board; Site depends on Ledger alone.
- `docs/adrs/0002-no-regular-expressions.md` — any new key or outline parsing is walked, never pattern-matched, tests included.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — the sketch's fixtures are on a 91-tile hexagon; a new shape departs from the sketch on purpose, so parity must be kept for everything the old shape contained and the departure recorded as a decision (ADR-0006). Review asks first whether the parity suite passes.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — the domain emits no sentence; the site description in the page text is Board wording.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — Consequences name this change: when the Site's outline changes, the frame Ground draws into is the thing to revisit; the plan's sums are frame-independent.
- `docs/context/project-profile.md` — documentation standard `always` (headers on every file, public function); no regexes; Playwright flows are not part of `pnpm -r test`, run `pnpm --filter @city/board test:e2e`.
- `docs/context/session-20261013-1831-main.md` — Next is item 2; the six Board flows assert 91 tiles and 14 of 15 lines.
- `docs/brainstorm/future-city/overview.md`, `docs/domain/site.md`, `docs/domain/board.md` — the item's text, the Site term ("a hexagon of hexagons, five tiles from middle to edge, 91 tiles"), and the Board's flow list.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Site takes an Outline, a rectangle holding the old hexagon
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site: board geometry (`domain/site/src/board.ts`), `RATES.board`, and every caller that passes it (`commands.ts`, `layout.ts`, Run's `run.ts`, Run and Site tests, record scripts).
- **Entry state**: Suite green on the 91-tile hexagon; ADR-0001 to 0005 in force; no outline concept.
- **Deliverable**: ADR-0006 (Kind technical, Scope `domain/site`): the site is a rectangle of hexagonal tiles in axial `q,r` named as before, wide enough to contain the old hexagon of radius 5 so every layout, fixture and stretch name in the sketch stays valid (the smallest such rectangle is 11 rows by 11 or 12 tiles; the chosen size is recorded, with whether the middle stays at 0,0). An outline value replaces the bare radius in `onBoard`, `allTiles`, `neighbors`, `adjacent` and `RATES`; distances (`kmBetween`) unchanged. Tests: tile count and corners of the new outline; the 91 old tiles all on it; off-board rejections for tiles just outside the rectangle; neighbors at the rectangle's edge; `restoreLayout` still drops tiles off the outline. The sketch's outline (the radius-5 hexagon) keeps a constructor, and the parity suite compares that outline's radius and tile count (5, 91) against the fixture while the shipped `RATES` carries the rectangle; ADR-0006 records that the parity oracle is pinned to the sketch's outline (ADR-0003 Decision 4). `allTiles` keeps the sketch's walk order over the old 91 tiles, so Run's bypass search (first joinable stretch wins) does not move; any fixture that iterates all tiles is re-checked and, if a result moves, the move is explained in the ADR, not hidden.
- **Exit state**: `pnpm -r test` and `pnpm -r typecheck` green; the Board still builds, drawing the rectangle's tiles in the old way; ADR-0006 written.
- **Demonstration**: Run `pnpm -r test` and show parity at 0 differences, Site and Run scenarios unchanged, and the new outline tests (tile count, 91-in-rectangle, edge rejection) passing.
- **Demonstrated**: `pnpm -r test` ledger 41 / site 80 / ground 27 / run 123 / board 101 passed, Site parity at 0 differences with the oracle pinned to `hexagon(5)` (91 tiles, all inside the rectangle), Run scenarios and bypass search unchanged, outline tests (115 tiles, row widths, corners, edge rejections, edge neighbors, restore) passing; `pnpm -r typecheck` clean; `pnpm --filter @city/board build` ok. ADR-0006 written.
- **Status**: DONE

### Phase 2: The Board draws a plain rectangle with fainter tile lines
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board: `src/draw/board.ts` (viewBox, `HALF_W`/`HALF_H`, the scale corner placed in the "empty corner the hexagon leaves", tile loop), `index.html` styles (`.hex` stroke fainter; hover, picked, warn and bad strokes keep their weight so state still reads), `src/main.ts` and `src/export.ts` (callers of `allTiles`), the site description text and `aria-label` ("Each hexagon is the ground..."), and the zoomed-view frame in `src/draw/ground.ts` (ADR-0005). The rectangle is drawn as one plain outline around the tiles.
- **Entry state**: Phase 1 exit state; the Board draws all outline tiles but with the hexagon's viewBox and strong lines.
- **Deliverable**: A drawn rectangular site outline; tile lines at reduced contrast with the outline stronger than the lines; hit-testing and keyboard focus over the new tile set; viewBox fits the rectangle; scale bar moved into a corner that is free; page text no longer calls the site a hexagon. The six Playwright flows updated: tile count 91 becomes the outline's count (asserted at `flows.spec.ts` lines 209 and 224), 14 of 15 lines stays. Board unit tests (wording, session) green.
- **Exit state**: `pnpm --filter @city/board test:e2e` passes all six flows; `pnpm -r test` green; the built page opens on a rectangle with hexagonal tiles.
- **Demonstration**: Build the page and screenshot it with the Playwright browser: a rectangular outline, fainter tile lines, the ledger's city in place with 14 of 15 lines; run the six flows and show them passing with the new tile count.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 3: Docs and records describe the new figure
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Documentation: `docs/domain/site.md` (Site term, count), `docs/domain/board.md` (flow 6's "91 tiles", Drawing note), `docs/domain/ground.md` if its frame text names the site, `docs/brainstorm/future-city/overview.md` (item 2 marked done with date and ADR-0006; Tile term and "hexagon" wording kept for the tile itself), `docs/context/project-profile.md`, `docs/domain/README.md` and the ADR-0003 consequence note.
- **Entry state**: Phase 2 exit state.
- **Deliverable**: Every doc that states "a hexagon of hexagons", "91 tiles" or the five-tiles radius is corrected or says why it stays (the sketch's own record). No stale mention left.
- **Exit state**: A search for "hexagon of hexagons", "91" and "five tiles from middle to edge" across `docs/` (excluding the archive and the sketch) finds only intended mentions; suites still green.
- **Demonstration**: Run the search and show each hit is either updated or a deliberate historical mention; run `pnpm -r test` once more.
- **Demonstrated**: 
- **Status**: PENDING
