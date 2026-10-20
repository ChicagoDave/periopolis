# ADR-0014: The site from the air is a pure projection over the Ground's shapes and the Run's state, painted on canvas 2D

**Date**: 2026-10-19
**Kind**: technical
**Scope**: apps/board
**Status**: ACCEPTED

## Context

David, 2026-10-19: a 3D model of the city as it moves through time. The physical-city plan (`docs/work/archive/physical-city/plan.md`, DONE 2026-10-13) drew one tile's ground as a plan view and left the angled view with heights to a later plan, built so that choosing it would be cheap: the Ground returns plan-view shapes in metres plus each building's story count, and all drawing sits in the Board. `docs/brainstorm/future-city/techstack.md` keeps an angled view on the web as "extruded footprints under a tilted camera", and draws the line at a full simulation with every person and mover animated, which is a game engine's job and not chosen.

Of two readings of "moves through time", David chose branch B (2026-10-19): finished things appear on the tilted map as the run completes them, under-construction tiles marked and homes lit by occupancy (Phase 3 of `docs/work/archive/angled-view-through-time/plan.md`); the ground of a neighborhood growing as crews build it stays a later plan. The Board is one self-contained page on GitHub Pages (ADR-0011), 193 kB built.

## Decision

1. **The angled view is a projection, not a model.** `apps/board/src/draw/angled/projection.ts` is a pure camera (yaw, pitch in (0, π/2], scale in pixels a metre, origin) with `project`, `unproject` and a depth order; `extrude.ts` turns a footprint and a height into the faces that face the viewer, shaded by one fixed light, plus the top. Both are tested in numbers and import no DOM.
2. **The scene is derived, never kept.** `scene.ts` places the Ground's shapes on the map's hex lattice at the Ledger's tile radius: a neighborhood's rows and the ring's buildings as the Ground returns them, each plant a low block, each stretch of line a flat strip. The Ground stays plan-view metres plus story counts (ADR-0005); the view adds no Ground surface and decides no shape. A story is 3.2 m, a plant 2 stories, a strip 24 m wide: marks of Mine, in the view's constants, not the Ledger's premises.
3. **Canvas 2D, no library.** The scene is painted through a `Painter` interface onto the page's canvas, flat strips first and then blocks farthest first, with a veil of ink for shade. three.js would add roughly 600 kB to a 193 kB single page (ADR-0011 Decision 2) and a GL context that the browser flows and unit tests handle badly; a pure projection is tested without a browser. WebGL is revisited only if the Phase 4 timing check fails, and the projection module is the seam.
4. **Detail follows the camera's scale.** Far, a neighborhood is one block the size of its tile; from a quarter pixel a metre (`MID_SCALE`) it is its rows of townhouses. The level of detail is chosen by scale, never by tile count, so the cost of a frame stays bounded as the city grows.
5. **Entry and words are the Board's.** "From the air" on the button row toggles the view; the view bar carries the caption and the way back; the session's view (`angled`) is never saved. Every sentence is in `wording.ts` (ADR-0004).

## Consequences

- A new kind of thing on the site (a school drawn apart, a park, a plant's units) is a new case in `sceneOf` with its stories, and a colour in the page's palette; it is not a Ground change unless the Ground gains the shape.
- The view follows the clock by re-deriving the scene from the game after each render (plan Phase 3): under construction and occupancy are read from the Run's jobs and `occupiedOf`, never kept in the view.
- Camera controls, the near level of detail and an offscreen cache of the static layer (plan Phase 4) change `view.ts` and `canvas.ts`, not the projection or the scene's contract.
- `apps/board/test/angled.test.ts` and `scene.test.ts` hold Decisions 1, 2 and 4 in numbers; browser flow 13 holds the entry and that the canvas is painted. The physical plan view and its flow are unchanged.
- Branch A, a partial neighborhood growing with the crews, is a Ground change under ADR-0005 and its own decision when David chooses it.

## Session

Session 2c0551, 2026-10-19; Phase 2 of `docs/work/archive/angled-view-through-time/plan.md`.
