# Session Plan: The physical city (plan view, zoom into the tile map, surface/sub-level switch)

**Created**: 2026-10-13
**Plan Status**: ACTIVE
**Overall scope**: Draw the ground of one neighborhood and of the ring from figures the Ledger already derives, as a plan view you zoom into on the existing tile map, with a switch between surface and sub level. The tile map stays as the zoomed-out view.
**Bounded contexts touched**: Ledger (read only, no change), new Ground (`domain/ground`, pure), Board (adapter)
**Key domain language**: neighborhood, center, ring, plaza, sub level, entry, frontage, tile
**Assumption owned by the user**: plan view, not angled view (overview.md Open Questions). See "Out of scope" below; nothing in Phases 1-4 depends on that choice being final.

## References consulted
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — new context is a new package under `domain/` with `lib: ES2022`, `types: []`, one `index.ts` interface; deps point inward (Board -> Run -> Site -> Ledger; Ground depends on Ledger only).
- `docs/adrs/0002-no-regular-expressions.md` — no regex anywhere, tests included; every key format gets a parse and a format function.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — the physical city is "its own plan after the port, starting from the ported code": this plan; it must not change any ported figure, and the parity suites must stay at zero differences.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — Ground returns typed numbers and shapes, never sentences; labels and captions for the plan live in `apps/board/src/wording.ts`.
- `docs/context/project-profile.md` — `documentationStandard: always`; state replaced, never mutated; seeded randomness only; Board tests assert rendered domain state, not element existence; `pnpm -r test` and `pnpm -r typecheck` are the gates.
- `docs/brainstorm/future-city/overview.md` — the fixed figures (2,041 townhouses, 6 m, 3 stories, 12 km frontage, 12-acre park, 33 entries of ~62 homes, 1.1 km lane, 3.7 km walkway, 6.1 km pipe, ring of 8 x 25 stories round a 6.5-acre plaza 272 m across); placements in the ground plan beyond those figures are "mine" placeholders and must be marked so.
- `docs/domain/board.md`, `docs/domain/site.md`, `docs/domain/ledger.md` — Board owns drawing under `src/draw/*`, holds no rules; Board flows are Playwright against the built page.
- Previous session open items: none that bear on this scope.
- Product ADRs not consulted (no Scope intersection): none (no product ADRs exist)

## Phases

### Phase 1: Ground plan of a neighborhood (new `@city/ground` context)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Ground (new, pure) over Ledger. A `NeighborhoodPlan` value: surface layer (townhouse rows, center, 12-acre park with courts, bike lane) and sub-level layer (33 entries, walkway, goods pipe, mover stop), in metres in the neighborhood's own frame.
- **Entry state**: Repository as of commit 929d8c5; ported Ledger exports the walking-city figures; no `domain/ground`.
- **Deliverable**: Package `domain/ground` (package.json, tsconfig extending base, `index.ts` single interface). `planNeighborhood(ledger)` returns rows, entry points, park, lane and sub-level segments as typed shapes. Invariants as guards: row lengths sum to the ledger's frontage (12 km), home count 2,041, entries 33 with ~62 homes each, lane 1.1 km, walkway 3.7 km, pipe 6.1 km, every home within the stated walk of its entry. Every placement the ledger does not fix is tagged as a placeholder in the type. Behavior Statement, tests derived from it, and a `docs/domain/ground.md` stub. Gate: ADR "Ground is its own context over the Ledger" if the user confirms.
- **Exit state**: `pnpm -r test` and `pnpm -r typecheck` green including `@city/ground`; the existing parity suites unchanged and at zero differences; Ground imports only `@city/ledger`.
- **Demonstration**: Run `pnpm --filter @city/ground test` and show the sums reconcile with the ledger (2,041 homes, 12 km, 33 entries, 1.1/3.7/6.1 km); run `pnpm -r test` and show no parity difference.
- **Demonstrated**: 2026-10-13 — `pnpm --filter @city/ground test`: 17 passed, reconciling 2,041 homes, 12.2 km of frontage, a 50,000 m² park, 33 entries of about 62 homes, 1.1 km of lane, 3.7 km of walkway and 6.1 km of pipe against the Ledger; `pnpm -r test`: ledger 41, ground 17, site 72, run 123, board 97 passed, parity suites unchanged at zero differences; `pnpm -r typecheck` clean; Ground's only outside import is `@city/ledger`. ADR-0005 written (Ground is its own context; ADR-0001 Decision 3 amended). [verified: test event "Tests passed" (ledger 41, ground 17, site 72, run 123, board 97), 2026-10-13T23:48:42Z, after last code edit 23:47:22Z]
- **Status**: DONE

### Phase 2: Ground plan of the ring, and the two levels
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Ground: `RingPlan` (eight 25-story footprints round the plaza, 272 m across, 6.5-acre plaza, the ring's mover stop below) and a `Level` choice (`surface` | `sub`) selecting which layer of either plan is returned.
- **Entry state**: Phase 1 exit state.
- **Deliverable**: `planRing(ledger)` and `layersAt(plan, level)` in `@city/ground`; guards that the eight footprints do not overlap, sit on a circle consistent with the ledger's ring radius, and enclose the plaza area the ledger derives. A rejection for a ring of zero buildings. Behavior Statement and tests; `docs/domain/ground.md` completed.
- **Exit state**: Ground covers every figure listed in the goal; suites green.
- **Demonstration**: `pnpm --filter @city/ground test` shows ring diameter 272 m and plaza 6.5 acres reconcile with the ledger, and a level switch returns only that level's shapes.
- **Demonstrated**: 2026-10-13 — `pnpm --filter @city/ground test`: 27 passed (ring.test.ts 10 new), `planRing` with the Ledger's eight buildings gives 272 m across and a 26,314 m² (6.5-acre) plaza equal to the Ledger's `ringAcrossM` and `plazaM2` to nine decimals; every count 1 to 40 stands clear by the separating-axis check; 21 buildings is the last that fits the tile; `layersAt` returns only the asked level for both plan kinds. `pnpm -r test`: ledger 41, site 72, ground 27, run 123, board 97; `pnpm -r typecheck` clean; Ground still imports only `@city/ledger`; no regular expressions. [verified: test event "Tests passed" 41/72/27/123/97, 2026-10-13T23:53:13Z, after last edit 23:53:03Z]
- **Status**: DONE

### Phase 3: Plan view in the Board — zoom into a tile, switch surface/sub level
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board (adapter). Session gains view state (zoomed-out map, or zoomed into one tile or the ring; level surface or sub). Drawing in a new `src/draw/ground.ts`, wording for captions and layer names in `wording.ts`.
- **Entry state**: Phase 2 exit state; the board draws the tile map only.
- **Deliverable**: Clicking a tile with the inspect action (or a zoom control) shows that tile's plan, scale bar and layer legend in SVG; a surface/sub switch; a back control to the tile map, which is unchanged. A Homes tile shows the neighborhood plan, a Ring tile the ring plan, other tiles show no plan. View state kept in the session and not saved with the city. No rules in the Board; no regular expressions; headers on every file.
- **Exit state**: Board builds to one page; session unit tests cover the view state; the tile map renders as before.
- **Demonstration**: `pnpm --filter @city/board build` then open the page in the browser: zoom into the opening city's neighborhood and the ring, flip the level, return; confirm by eye the counts drawn match Ground (rows, 33 entries).
- **Demonstrated**: 
- **Status**: PENDING

### Phase 4: Browser flow, documentation and close-out
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Board acceptance and the domain notes.
- **Entry state**: Phase 3 exit state.
- **Deliverable**: A sixth Playwright flow: zoom in, assert the rendered entry count, home count and ring building count equal the Ground plan's, switch level and assert the layers swap, return to the tile map and assert 14 of 15 lines still shows. Update `docs/domain/board.md`, `docs/domain/README.md`, the project profile, and the overview's "Next" list (item 1 marked done in plan view). Record any ADR the user confirmed.
- **Exit state**: `pnpm -r test`, `pnpm -r typecheck` and `pnpm --filter @city/board test:e2e` all green; docs match code.
- **Demonstration**: Run `pnpm --filter @city/board test:e2e` and show six flows passing, the new one asserting drawn counts against Ground.
- **Demonstrated**: 
- **Status**: PENDING

## Out of scope (user decision pending)

The **angled view with building heights** is not in this plan. It is a separate later plan, and the work here is built so that choosing it is cheap: Ground returns plan-view shapes in metres plus each building's story count (already ledger data), and all drawing is confined to `apps/board/src/draw/ground.ts`. Switching to angled means a new projection and renderer over the same Ground output, not a new Ground. If the user chooses angled before Phase 3, Phase 3 is rewritten and bigger (Large); Phases 1 and 2 stand unchanged. Plan view or angled view remains the user's decision.
