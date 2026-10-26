# Session Plan: SimCity detail for the IRL city (real models, streets, vegetation, vehicles, light, zoom)

**Created**: 2026-10-26
**Plan Status**: ACTIVE
**Overall scope**: Replace the IRL view's massing model (instanced boxes, discs, cones, flat plane) with a game-grade city that holds from drone shot to street corner at 100,000+ people: authored CC0 models fitted to the Ground's footprints, real streets and terrain, vegetation, vehicle models, sun/sky/shadow/AO/bloom, and distance LOD. Domain stays pure; the describer/GL split and the derived scene stay.
**Bounded contexts touched**: Board (apps/board) only for code; Ground, Site, Run, Ledger are read, not changed. ADR work touches ADR-0023 (Decisions 3 and 7), ADR-0011 (Decision 2), ADR-0022 (Decision 3 note).
**Key domain language**: Ground (footprints, story counts, rows, lane), scene (derived, never kept), chunk (a tile's described meshes), mover / line / stretch / stop, fleet, sub level.

## Decisions David must answer first

Defaults let Phase 1 proceed on "go"; each becomes a line in the new ADR with its game-lens line (ADR-0022).

1. **Asset source and license.** Default: authored CC0 GLB kits, namely Kenney City Kit (Suburban, Commercial, Industrial, Roads) and Kenney Car Kit, with Quaternius and Poly Pizza only as CC0 gap-fillers; a manifest records each file's source and license, and CC-BY is refused (attribution burden, harder to vet). Authored for buildings, vehicles, trees and street furniture; procedural stays for what the Ground fixes exactly (street surfaces, terrain, lake, markings, the scaffold). Weighed: much richer procedural generator (keeps ADR-0023 Decision 3 whole, no hosting change, but cannot reach SimCity-grade roofs, chimneys, vehicles without large authoring effort). Game lens: a kit is the shape a modder or scenario author would extend; fitted by rule, so the player's choices, not the artist's, differ between cities.
2. **Art direction.** Default: stylized low-poly with PBR-lit materials and shared palette textures (the Kenney look, which is also what SimCity 2013 and Skylines read as at distance). Realistic photoscan-grade is rejected: tens of MB per kit, no CC0 source covering rows, plants and cabs at one quality. Game lens: one coherent style reads as a game at every zoom; mixed realism reads as a mod.
3. **Hosting.** Default: stay on GitHub Pages; ship a folder `apps/board/dist/assets/` beside `index.html` (GLB compressed with meshopt/Draco, KTX2 or small WebP textures, budget 25 MB total, 8 MB loaded before first paint, the rest lazy by kind). The single-file build keeps the page and bundled code; models load by fetch. Move to a server/CDN only if the budget is exceeded. Amends ADR-0011 Decision 2 ("the built Board and nothing else"). Game lens: a server is where saves and scores live; assets on Pages do not need one yet.
4. **Time-of-day scope.** Default: a continuous sun on a day slider (dawn, noon, dusk, night) plus the existing "Night" button as the preset; sky gradient, fog tint, window lights and street lamps by sun elevation; no weather and no seasons. Game lens: a player wants the lit city at dusk; a clock-tied cycle would fight the month clock, so time of day is a view control, never saved.
5. **Surface traffic.** Default: yes for ambient, cosmetic, pure and seeded like the fleet (ADR-0023 Decision 4): bikes on the lane at a count from the Ledger's lane length, delivery porters (small carts) on the street at a per-home rate; no people, no pedestrians. Fleet movers (pod, cab, shuttle) become real models on the sub level as today. If David says no, Phase 5 drops the surface-traffic deliverable and keeps vehicles-as-models.

Also confirm in Phase 1: row geometry. The brief's 48 m pitch with 36 m between rows was a misread of distinct row lines; `docs/domain/ground.md` lists a row pitch of 24.75 m and rows 12 m deep, so about 12.75 m lies between lines: a lane with sidewalks, not a carriageway with crossings. Phase 1 reads `domain/ground` and fixes the street section from the Ground's real numbers before the ADR states it (plan-review 2026-10-26).

## References consulted
- `docs/adrs/0023-the-irl-view-is-three-js-over-the-derived-scene-with-cosmetic-movers.md` — Decision 3 (procedural-only) and Decision 7 (single page) are amended here; Decisions 1, 2, 4, 5, 6, 8, 9 stand: describer/GL split, scene derived never kept, movers cosmetic, sub level, fallback view, wording in `apps/board/src/wording.ts`.
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — Decision 2 says the site is `index.html` and nothing else; an assets folder needs its amendment; publish workflow tests before it deploys; keep Pages unless a server is chosen.
- `docs/adrs/0022-every-decision-is-weighed-for-an-eventual-game.md` — every option and decision carries a game-lens line; no game features built unasked (the IRL view is a view of the simulator).
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — the Ground fixes footprints and counts; models are scaled to them and the Ground gains no surface.
- `docs/adrs/0016-the-site-is-concentric-circles-with-an-infrastructure-band.md` — the lake is the south edge and the band faces it; terrain and shore follow this.
- `docs/domain/board.md` and `docs/domain/ground.md` — the IRL row (what exists) and the Ground's row pitch, lane and open-ground vocabulary.
- `docs/work/archive/irl-3d-city-view/plan.md` — what shipped and its measurements (105,000 people: 42,861 homes, 2,625 trees, 334 movers, near rebuild 35 ms, frame 21 ms, page 790 kB).
- Standing constraints from the brief: ADR-0001/0004 (pure domain, domain emits facts), ADR-0002 (no regex), `documentationStandard: always`.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Decide the art and hosting, amend ADR-0023 and ADR-0011
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Board IRL view; the decision record.
- **Entry state**: David has answered, or accepted the defaults of, the five decisions above.
- **Deliverable**: ADR-0024 (authored kits fitted to the Ground, art direction, assets beside the page, time of day, surface traffic, each with a game-lens line); dated amendment notes on `docs/adrs/0023-the-irl-view-is-three-js-over-the-derived-scene-with-cosmetic-movers.md` (Decisions 3, 7), `docs/adrs/0011-the-board-is-published-on-github-pages.md` (Decision 2) and `docs/adrs/0022-every-decision-is-weighed-for-an-eventual-game.md` (if scope wording needs it); the asset license manifest format; the real street width read from the Ground.
- **Files**: `docs/adrs/`, `docs/domain/board.md`
- **Exit state**: ADR-0024 ACCEPTED with no open questions; the three amended ADRs point at it; the license rule and size budget are written.
- **Demonstration**: grep for "ADR-0024" in the three amended ADRs shows each carries its dated note; the ADR file's Status line reads ACCEPTED.
- **Demonstrated**: 2026-10-26 — `docs/adrs/0024-the-irl-city-is-built-from-cc0-kits-fitted-to-the-ground.md` written (technical, Scope apps/board and .github/workflows, ACCEPTED, no open questions): seven decisions with game-lens lines, the five David accepted with "go" (CC0 kits fitted to the Ground with a per-file manifest and CC-BY refused; stylized low-poly under PBR; assets beside the page on Pages, 25 MB in all and 8 MB before first paint; a sun on a slider never saved; cosmetic seeded surface traffic, no people) plus the street section and the LOD/frame budget. The street section rests on the Ground read this session: rows 12 m deep on a 24 m pitch, 30 lines, 12 m between lines alternating street (2 m sidewalks, 8 m shared surface) and garden; `docs/domain/ground.md`'s 24.75 m was stale since ADR-0016 and is corrected. Dated notes: ADR-0023 Decisions 3 and 7 (grep ADR-0024: 2), ADR-0011 Decision 2 (1); ADR-0022 needed no note (its Decision 3 already reads the IRL view as a view of the simulator); `docs/domain/board.md` IRL row notes the replacement. The plan's Phase 4 Files gained `angled/scene.ts` and the pitch note was corrected (plan-review's advisories). [reported by session: documentation only, no suite to run]
- **Status**: DONE

### Phase 2: Asset pipeline and the kit manifest
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board adapter boundary; the pure fitting rule.
- **Entry state**: ADR-0024 ACCEPTED.
- **Deliverable**: the chosen CC0 GLBs in `apps/board/public/assets/` with a license manifest; a pure `apps/board/src/draw/irl/kit.ts` (new) mapping each scene kind (townhouse variants, tower, plant kinds, school, tree species, vehicle classes) to a model id and returning the scale/placement that fits a model to a Ground footprint, tested in numbers; the GLB loader and cache inside `apps/board/src/draw/irl/gl.ts` (the only three.js file), meshopt/Draco decode, lazy by kind, a first-paint fallback to the current massing while a kind loads; Vite and `.github/workflows/publish-board.yml` carrying the folder to Pages.
- **Files**: `apps/board/src/draw/irl/kit.ts` (new), `apps/board/src/draw/irl/gl.ts`, `apps/board/public/assets/` (new), `apps/board/vite.config.ts`, `.github/workflows/publish-board.yml`, `apps/board/test/`
- **Exit state**: one model kind (the townhouse) renders from a loaded GLB in the IRL view at periopolis.city's build, fitted to its footprint; the manifest lists every file with source and CC0; total assets under the Phase 1 budget so far.
- **Demonstration**: run the board's unit suite and browser flows against the build; the kit tests show fitted footprints match the Ground's to the centimetre, and a flow reads a data attribute proving a GLB instance is painted.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 3: Streets, terrain and the plaza
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Ground (rows, lane, open ground) and Site (circles, lake shore, ADR-0016).
- **Entry state**: Phase 2 exit; the asset loader works.
- **Deliverable**: street surfaces between rows from the Ground's pitch (carriageway, sidewalks, curbs, crossings, centre markings, the bike lane drawn from `lane`), paths in parks, the centre as a paved plaza with benches and lamps, terrain with grass/soil/paving PBR textures and the lake as water to the south edge, with shore in `apps/board/src/draw/irl/describe.ts` as pure records tested in numbers; no regex.
- **Files**: `apps/board/src/draw/irl/describe.ts`, `apps/board/src/draw/irl/gl.ts`, `apps/board/src/draw/irl/streets.ts` (new), `apps/board/test/`
- **Exit state**: from the air no flat beige plane remains; every row has a street, every park a path, the south shore is water; chunk signatures still rebuild only changed tiles.
- **Demonstration**: a headless-Chromium flow screenshots a drone shot and a street corner on seed 42 and the street/lane counts read from the canvas data attributes match the Ground's; I look at both screenshots.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 4: Buildings as models
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Ground footprints and story counts fitted to authored models; the scene kinds from `sceneOf`.
- **Entry state**: Phase 3 exit.
- **Deliverable**: townhouse variants across a row (bays, stoops, roof ridges, chimneys) picked by seeded hash of the tile key; ring towers with podium, floors and roof plant; plants as facilities by kind (reactor domes and cooling, water works, sewage basins, waste sheds); schools with fields; the scaffold with its crane kept, windows lit by occupancy as now.
- **Files**: `apps/board/src/draw/irl/kit.ts`, `apps/board/src/draw/irl/describe.ts`, `apps/board/src/draw/irl/gl.ts`, `apps/board/src/draw/irl/facade.ts`, `apps/board/src/draw/angled/scene.ts` (schools and fields become scene kinds there, so `sceneOf` stays the one source of what stands, ADR-0023 Decision 2), `apps/board/public/assets/`
- **Exit state**: every kind in `sceneOf` has a model or an explicit procedural reason; no box-with-texture building remains; counts and footprints still equal the Ground's.
- **Demonstration**: the unit suite shows variant choice is stable per key and counts equal the Ground's; screenshots of a row, a ring tower, each plant kind and a school, which I look at.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 5: Vegetation, street furniture and vehicles
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Cosmetic layers: trees, fleet movers (ADR-0023 Decision 4), surface traffic.
- **Entry state**: Phase 4 exit.
- **Deliverable**: street trees along rows, species variety in parks, hedges and gardens behind homes; lamps, benches, hydrants; the fleet as real pod/cab/shuttle models on `apps/board/src/draw/irl/movers.ts` states (pure module unchanged in contract); if decision 5 is yes, a pure seeded surface-traffic module (bikes on the lane, delivery carts) in `apps/board/src/draw/irl/traffic.ts` (new) with no people.
- **Files**: `apps/board/src/draw/irl/movers.ts`, `apps/board/src/draw/irl/traffic.ts` (new), `apps/board/src/draw/irl/gl.ts`, `apps/board/src/draw/irl/kit.ts`, `apps/board/test/`
- **Exit state**: movers and surface traffic are models, deterministic by seed and wall-clock time; none decides a fact of the city.
- **Demonstration**: the movers and traffic tests run in numbers with no DOM (same seed gives same states, none inside a closed stretch); a flow screenshot of the lane and the sub level, which I look at.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 6: Light, sky and atmosphere
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board IRL rendering only.
- **Entry state**: Phase 5 exit (models exist to light).
- **Deliverable**: a pure sun-position function from a time-of-day value; sky gradient, soft shadows, ambient occlusion, bloom at night, distance fog, street lamps and window lights by sun elevation; the day slider on the view bar with all words in `apps/board/src/wording.ts`; session-only state.
- **Files**: `apps/board/src/draw/irl/sun.ts` (new), `apps/board/src/draw/irl/gl.ts`, `apps/board/src/wording.ts`, `apps/board/test/`
- **Exit state**: dawn, noon, dusk and night all read as lit cities; nothing about time of day is saved.
- **Demonstration**: the sun function's tests show elevation and azimuth at the four presets; four screenshots of one street corner, which I look at.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 7: Zoom, level of detail and the measured publish
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Board performance across the zoom range.
- **Entry state**: Phase 6 exit.
- **Deliverable**: LOD by camera distance (impostors and merged far chunks, full models near, instancing throughout, lazy load of far kinds), frame budget held at 105,000 people, the browser flows under software WebGL, the project profile and `docs/domain/board.md` updated, ADR-0023 Consequences line on measurement refreshed.
- **Files**: `apps/board/src/draw/irl/gl.ts`, `apps/board/src/draw/irl/describe.ts`, `apps/board/src/draw/irl/camera.ts`, `apps/board/test/`, `docs/domain/board.md`, `docs/context/project-profile.md`
- **Exit state**: published build passes every flow; measured frame time, draw calls, asset bytes and first-paint bytes recorded; the zoom runs from drone to street corner without a pop that reads as a defect.
- **Demonstration**: headless Chromium on the ledger's city run to 105,000 people prints frame ms, draw calls and bytes, which must stay near the Phase 6 of the earlier plan (frame about 21 ms) and under the Phase 1 asset budget; the publish workflow run is green.
- **Demonstrated**: 
- **Status**: PENDING
