# Session Plan: The 3D angled view that moves through time

**Created**: 2026-10-19
**Plan Status**: ACTIVE
**Queued**: Was queued behind board-auto-run-by-month, DONE and archived 2026-10-19; this plan is next. `.current-plan` is set when its Phase 1 starts.
**Overall scope**: An angled (oblique/isometric) view of the city with building heights, entered from the tile map, that follows the Board's month clock: as the run plays, it shows the city as it stands that month. A new projection and renderer over the same Ground output, not a new Ground (physical-city "Out of scope").
**Bounded contexts touched**: Board (apps/board) primarily; Ground (domain/ground) only in branch A; Run (domain/run) read, not changed.
**Key domain language**: Ground, plan view / angled view, story count, month clock, occupancy, under-construction neighborhood, level of detail.

## Decision David must answer first (the plan branches on it)

What does "moves through time" mean?

- **A. Each neighborhood's ground grows as crews build it and homes fill as people arrive.** Ground must derive a *partial* neighborhood from a build fraction and an occupancy. A Ground change (new pure function and tests, ADR-0005 says figures Ground needs but the Ledger does not derive go to the Ledger first). Sized: **Large**, about 2 phases on top of the shared base. Needs a run-side statement of a neighborhood's build fraction per month, which the run may not expose today (check ADR-0012 Decision 6).
- **B. Finished neighborhoods, the ring, plants and stretches appear on the tilted site map as the run completes them; under-construction tiles are shown as such; occupancy is shown by lit/dark homes.** Board rendering over data the run already has (layout tiles, jobs working/waiting/done, occupancy per neighborhood). Sized: **Medium** per phase, no domain change.

**Decided (David, 2026-10-19): B.** A stays a later plan; Phase 5 stays PENDING. Decisions 1 to 3 below taken as recommended.

**Recommendation (as planned): B first, A as a later plan.** B delivers the visible "city grows" payoff with no domain change; A's partial-neighborhood derivation is only worth its cost once the angled view exists to show it, and it is separable (the renderer takes whatever Ground returns). Phases 1 to 4 below are branch B and are shared by A; Phase 5 is branch A and stays PENDING unless David picks A.

## Other decisions the plan carries (confirm at Phase 1; recommended answer given)

1. **Canvas 2D with a hand-rolled oblique/isometric projection, not WebGL.** Reason: the Pages build is one self-contained 184 KB `dist/index.html` (ADR-0011, no extra asset or worker); three.js adds roughly 600 KB minified, a lightweight renderer still 50 to 150 KB, plus a GL context that Playwright headless and unit tests handle badly. A pure `project(point, height, camera)` function is unit-testable with no browser. Cost: no real lighting or depth buffer, so draw back-to-front (painter's order) and fake shading per face; fine for extruded footprints at 40,000 buildings only with level of detail (below). Revisit WebGL only if measured frame cost fails Phase 4; the projection module is the seam.
2. **Entry:** a third view beside the existing Surface / Sub level switch on the view bar ("Angled"), available on the whole-site map, not a mode inside a single tile's plan. The tile plan view stays. Per-tile angled zoom is a later question.
3. **Level of detail:** far = one extruded block per neighborhood (height from its story count, footprint from the hex tile); mid = rows of townhouses as single slabs; near = individual homes. Chosen by zoom, not by tile count, so cost stays bounded at about 40,000 buildings.
4. **Redraw cost per month tick:** the static city layer is cached to an offscreen canvas and redrawn only when the set of finished or under-construction tiles changes or the camera moves; a month tick repaints only changed tiles (and the lit/dark occupancy overlay). Budget: a Fast-speed tick (~100 ms) must paint in under one frame budget on the 100,000-person city; measure in Phase 4.
5. **Follows the clock by reading, not owning it:** the view subscribes to the same render the auto-run already calls after each `tickMonth`; it holds no run state (state replaced never mutated; seeded randomness only, e.g. for building height jitter, seeded from the tile key).
6. **ADR-worthy: yes, ask David at Phase 2.** Proposed ADR-0013 (Kind technical, Scope apps/board, plus domain/ground if branch A): "the angled view is a pure projection over Ground and the run's state, drawn on canvas 2D; Ground stays plan-view metres plus story counts". Numbering conflicts with the auto-run plan's proposed ADR-0013: whichever lands second takes the next free number.

## References consulted
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — the projection math and any new pure logic are packages or pure modules with tests; Board is the only DOM consumer; domain gets no canvas or clock.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — drawing and wording live in the Board; the domain emits facts only, so the legend, labels and the "under construction" wording are Board-side.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — Ground imports only the Ledger; a figure Ground needs but the Ledger does not derive goes to the Ledger first (bears on branch A).
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — product ADR, Scope apps/board intersects: the Board stays one self-contained published page; no server, no extra asset; a library must fit the single-file build.
- `docs/adrs/0002-no-regular-expressions.md` — no regex anywhere, including parsing and tests.
- Cited from the caller's verified context, not re-read: ADR-0006 (hex tile site, fixes the tile geometry the projection extrudes), ADR-0009 and ADR-0012 (occupancy per neighborhood; under-construction neighborhoods, Decision 6), `docs/work/archive/physical-city/plan.md` (Out of scope: angled view is a new projection and renderer), `docs/brainstorm/future-city/techstack.md` (extruded footprints under a tilted camera; a full simulation is a game engine's job and not chosen), `docs/work/archive/board-auto-run-by-month/plan.md` (the month clock this view follows).
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Angled projection over Ground, as a pure module
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board (adapter): projection of Ground's plan-view metres plus story counts into screen space. No domain change.
- **Entry state**: board-auto-run-by-month is DONE; David has answered A or B and confirmed decisions 1 to 3 above.
- **Deliverable**: A pure `apps/board/src/draw/angled/projection.ts` (project a point at a height under a camera: yaw, pitch, scale; inverse for hit-testing; painter's-order sort key) and `extrude.ts` (a footprint plus story count to visible faces with per-face shade). Header comments per documentation standard `always`. Tests assert numbers: a unit square at height 0 projects to the known quad; heights shift screen y by the known amount; the inverse round-trips; draw order puts nearer footprints later. Behaviour Statements per rule 12.
- **Exit state**: Projection and extrusion are tested pure functions with no DOM import; nothing is drawn yet.
- **Demonstration**: `pnpm --filter @city/board test` runs the projection and extrusion suites green, and the round-trip test shows inverse(project(p)) equals p within tolerance.
- **Demonstrated**: 2026-10-19, session 2c0551. `apps/board/src/draw/angled/projection.ts` (Camera {yaw, pitch in (0, π/2], scale, origin}, GroundPoint, ScreenPoint, DEFAULT_CAMERA, cameraAt, turned, project, unproject, depthOf) and `extrude.ts` (Face, Block, STORY_M 3.2, LIGHT, extrude, blockDepth), both pure, no DOM import (grep for document/window/dom in the folder: 0). `apps/board/test/angled.test.ts` (13) asserts numbers: the unit square under the plan-view camera projects to itself; a π/4 tilt foreshortens y by √2/2 and leaves x; a height of 10 lifts a point by 10·cos(pitch) and not at all in the plan view; scale 10 and origin (100, 50) place (1, 1) at (110, 50 + 10·√2/2); a quarter-turn yaw sends (1, 0) to (0, 1); unproject(project(p)) round-trips within 1e-9 on four cameras and four points at heights 0, 7 and 96; depth grows toward the viewer, reverses under a half-turn and ignores height; cameraAt refuses pitch 0, pitch past π/2 and scale 0. Extrusion: height 0 is one top face at shade 1; straight on, a 2 m block gives one side (the y = 1 edge, ground corners at sin(π/3), upper corners 2·cos(π/3) higher) then the top; turned π/6, two sides, the farther (+x) first, both 0.45 in shadow, and turned half round both lit at 0.45 + 0.5·√2/2; a clockwise footprint paints the same faces as a counter-clockwise one; blockDepth sorts a block 10 m nearer last; refusals on two corners, a negative height and NaN. `pnpm -r test` green (ledger 91, ground 27, site 168, run 182, board 169); `pnpm -r typecheck` clean. [verified: unit tests, "Tests passed" 91/27/168/182/169, 2026-10-19T21:28:48Z, after the last edit at 21:28:32Z] [reported by session, unverified: typecheck, no hook row]
- **Status**: DONE

### Phase 2: Angled view of the site map, finished city at one month (entry and ADR)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board: canvas renderer over `planNeighborhood` / `planRing` output for the tiles the run has finished; view entry beside Surface / Sub level.
- **Entry state**: Phase 1 DONE.
- **Deliverable**: `draw/angled/scene.ts` (pure: turns the run's layout, Ground plans and story counts into a list of extruded blocks, each tagged with tile key, stories, state) and `draw/angled/canvas.ts` (paints the list on a canvas); an "Angled" entry on the view bar; far and mid level of detail; the ADR (ask David, write ADR-0013 or next free number); `docs/domain/board.md` note. Scene tests assert domain state: block count and total stories equal the Ground plan's `data-stories` sum for the same tile, the ring and plants appear where the layout has them.
- **Exit state**: Selecting Angled shows the current run's finished neighborhoods, ring, plants and stretches as extruded blocks on the tilted map; plan view unchanged.
- **Demonstration**: `pnpm --filter @city/board test` green with the scene totals equal to Ground's story sums; a Playwright flow against `dist/index.html` opens Angled on a found city and asserts the scene's block count and the canvas's non-blank pixels (read via the scene's exported summary, not element existence alone).
- **Demonstrated**: 
- **Status**: PENDING

### Phase 3: The view follows the month clock (branch B: completed, under construction, lit and dark)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run state read per month: layout tiles, jobs working/waiting/done, `planned(layout, jobs)`, occupancy per neighborhood (ADR-0009/0012).
- **Entry state**: Phase 2 DONE.
- **Deliverable**: Scene derivation extended with a state per block: standing, under construction (ADR-0012 Decision 6, drawn as scaffold or outline at reduced height), waiting; lit versus dark homes by occupancy fraction (seeded by tile key, so the same fraction lights the same homes); wording for the legend in `wording.ts`. The angled view re-derives from the game after each `tickMonth` render. Tests: scene at month N versus N+k differs exactly by the tiles the run completed; occupancy lit count equals the run's occupancy figure within rounding.
- **Exit state**: With auto-run playing, the angled view shows the city as it stands each month, with under-construction tiles marked and homes filling.
- **Demonstration**: A unit test steps a seeded run month by month and asserts the scene's standing and under-construction sets match the run's at each step; a Playwright flow presses Play at Fast, waits for a later month, and asserts the scene's standing-block count rose.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 4: Camera, level of detail, and redraw cost at 100,000 people
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board performance and interaction; no domain change.
- **Entry state**: Phase 3 DONE.
- **Deliverable**: Camera controls (rotate in quarter turns, tilt, zoom, pan) as Board state, not saved game state; near level of detail (individual homes, rows of townhouses far); offscreen cache of the static layer with per-tile repaint on a month tick; a timing check on the largest seeded city (about 40,000 buildings). If the canvas 2D budget fails, record the measurement and decide on a WebGL seam before closing.
- **Exit state**: Playing at Fast on the largest city paints each tick inside the budget; zoom changes level of detail without exceeding the building cap per frame.
- **Demonstration**: A timing test (scene derivation plus paint call count, not wall-clock flakiness: assert the per-tick repaint touches only changed tiles and the near-LOD block count stays under the cap) is green; one measured per-tick paint time is recorded in the Demonstrated line.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 5 (branch A only; stays PENDING unless David chooses A): Partial neighborhoods grow with crews
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Ground (domain/ground) gains `planPartial(neighborhood, buildFraction, occupancy)`; Ledger/Run supply the build fraction per month if not already exposed.
- **Entry state**: Phases 1 to 4 DONE; David chose A; a fraction per neighborhood per month is derivable from the run (verified in the first tool calls of this phase, else a Run phase precedes).
- **Deliverable**: A pure partial-plan function in Ground with tests (a half-built neighborhood has the first rows, in the order crews build; story sum at fraction 1 equals `planNeighborhood`'s; at 0 is empty); `docs/domain/ground.md` updated; Ground ADR amended or a new one; the scene consumes it instead of the under-construction placeholder.
- **Exit state**: Under-construction tiles show their actual rows going up and homes filling as people arrive.
- **Demonstration**: Ground's suite green with the fraction 1 equals full plan invariant; a scene test across months shows story sums rising monotonically to the finished figure.
- **Demonstrated**: 
- **Status**: PENDING
