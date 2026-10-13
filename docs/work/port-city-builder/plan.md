# Session Plan: Port the city builder into a tested TypeScript workspace

**Created**: 2026-10-12
**Plan Status**: ACTIVE
**Overall scope**: Move the working ledger and builder out of the single published page into this repository as three pure domain contexts whose rules are proven by tests, with the web board as an adapter over them. Behavior stays what the published page does today; nothing new is designed here.
**Bounded contexts touched**: Ledger, Site, Run (domain, all new); Board (web adapter, new)
**Key domain language**: line (one numbered premise), neighborhood, ring, stretch, run, line-year

## Working material

- `docs/work/port-city-builder/sketch/` holds the page's sources and its check scripts as published on 2026-10-11. They are the parity oracle for this plan and are archived with it. See its `README.md`.
- `docs/brainstorm/future-city/overview.md` holds the 23 lines as stated, the terms, and every placeholder and open question from before this repository existed. `techstack.md` beside it holds the platform decision. Phase 1 records the lines and terms in the notation from there.
- No ADRs, project profile, session summaries or proposals exist yet, so this plan has no "References consulted" section and plan-review has nothing to check it against.

## Conventions this plan holds to

- TypeScript in strict mode, ES modules, one pnpm workspace: `domain/*` for the contexts, `apps/*` for adapters.
- Domain code is pure and deterministic: no DOM, no storage, no wall clock, no random source that is not seeded. The domain packages compile without the DOM library.
- Dependencies point inward: Board → Run → Site → Ledger. Each context exports one intentional interface from its `index.ts`.
- No regular expressions in code. Keys and text are parsed by walking their structure.
- `documentationStandard` is `always`: every file carries a header and every public function a method header.
- Commands are named as intent and answer with events or an explicit rejection. The sentences the page shows are the Board's translation of those events, not part of the domain.

## Phases

### Phase 1: Ledger context: premises in, consequences out
- **Tier**: Medium
- **Budget**: 250
- **Domain focus**: Ledger. A column of premises (the car city, your city) and the needs list derive their consequences: density and land, centers, trips by foot, bike and mover, the fleet, goods, and how far the city stretches.
- **Entry state**: The repository holds only the DevArch setup and this plan with its sketch.
- **Deliverable**: The workspace skeleton (pnpm, TypeScript strict, Vitest). `domain/ledger` (`@city/ledger`) exposing the premises of both columns, the needs list and `derive`. The 23 lines as stated, and the Ledger's terms, recorded in the DDD notation under `docs/domain/`. ADRs for the decisions confirmed as ADR-worthy. Tests derived from Behavior Statements for both columns.
- **Exit state**: For a city of 50,000, both columns reproduce every figure of the published ledger (Revision 3), and `domain/ledger` imports nothing outside itself.
- **Demonstration**: `pnpm --filter @city/ledger test` is green and its report names the published figures it matched, among them 2,110 and 13,249 people per km², 42,000 cars against 159 movers, 10 centers of 5,000 people, and a ceiling of 166,492 people.
- **Demonstrated**: 2026-10-12, session 0b9b51. `pnpm --filter @city/ledger test`: 2 files, 41 tests passed, 0 failed (Vitest 5.0.4). `published.test.ts` names the figures: density 2,110 against 13,249 people per km²; 42,000 cars against 159 movers; 10 centers of 5,000 people; a ceiling of 166,492 people; 8 ring buildings 272 m across; 9 elementary schools of 400. `parity.test.ts` matches every figure of 19 cases recorded from the sketch's `model.js`. `pnpm --filter @city/ledger typecheck` is clean, and `domain/ledger/src` has no import outside itself. [verified: test event "Tests passed, 2 passed 41 passed", 2026-10-13T02:01:59Z UTC, after last code edit 01:48:53Z]
- **Status**: DONE

### Phase 2: Site context: the layout and its lines
- **Tier**: Large
- **Budget**: 400
- **Domain focus**: Site. Tiles, neighborhoods, the ring, schools, fields, the mover line and the plants; the commands that lay them out; the fifteen line checks, seating, trips, and the four stretch tests.
- **Entry state**: Phase 1 is DONE: `@city/ledger` supplies the tile (5,000 people on 93 acres) and the rates.
- **Deliverable**: `domain/site` (`@city/site`): site geometry, the layout, layout commands answering with events or rejections, the assessment of a layout under a stress (line checks, score against a car city), seating by chains of moves, and the stretch tests including one stretch of mover line closed. Site terms and scenarios added to the notation. Scenario tests, plus parity fixtures recorded from the sketch.
- **Exit state**: Every scenario test is green, the parity fixtures show no difference from the sketch, and `domain/site` depends on `@city/ledger` alone.
- **Demonstration**: `pnpm --filter @city/site test` is green and shows the ledger's city holding 14 of 15 lines with fine dining to watch, two far neighborhoods with no line marking only themselves, and 100,000 people with loops holding all four stretch tests; the parity suite reports 0 differences.
- **Demonstrated**: 2026-10-12, session 0b9b51. `pnpm --filter @city/site test`: 2 files, 72 tests passed, 0 failed (Vitest 5.0.4). `scenarios.test.ts` shows the ledger's city holding 14 of 15 lines with fine dining the watch; two far neighborhoods with no line breaking work, stops and ways with only themselves marked and 9.1% of trips stuck; 100,000 on spokes holding every line but giving under a closure; 100,000 with loops holding every line and all four stretch tests on 584 movers. `parity.test.ts` reports 0 differences across 15 recorded assessments, 29 moves, 2 seatings, 4 restores and 4 bridge cases. `pnpm --filter @city/site typecheck` is clean; `domain/site/src` imports `@city/ledger` and nothing else. [verified: test event "Tests passed, 41 passed 72 passed", 2026-10-13T02:25:51Z UTC, after last code edit 02:23:52Z]
- **Status**: DONE

### Phase 3: Run context: twenty years on the clock
- **Tier**: Medium
- **Budget**: 250
- **Domain focus**: Run. Crews, jobs and work in hand; the timeline of five announced events; the yearly record and its line-years.
- **Entry state**: Phase 2 is DONE: `@city/site` lays out and assesses a city under any stress.
- **Deliverable**: `domain/run` (`@city/run`): starting and stopping a run, placing orders as jobs, putting a job first, canceling, advancing a year, and the notices for what is announced. Run terms and scenarios added to the notation. Tests for the job mechanics, for a school waiting on its homes and a module on its site, and for the promise that a city holding all four stretch tests is never broken by a timeline.
- **Exit state**: Every scenario test is green and `domain/run` depends on `@city/site` alone.
- **Demonstration**: `pnpm --filter @city/run test` is green and shows the looped ledger's city left alone on 25 seeded timelines with 0 broken line-years, and a scripted founding reaching homes for 100,000 people by year 20.
- **Demonstrated**: 2026-10-12, session 0b9b51. `pnpm --filter @city/run test`: 2 files, 123 tests passed, 0 failed (Vitest 5.0.4). `scenarios.test.ts` shows the looped ledger's city left alone on 25 seeded timelines with 0 broken line-years (worst run 0), the spoked city losing 3 or 4 line-years only in closure years, the job mechanics (a school waiting on its homes, a module on its site, ten crews over twelve jobs), and the scripted founding reaching 100,000 people by year 20 on 4 seeds with 151 crew-years ordered and 0 to 3 line-years. `parity.test.ts` matches 64 recorded steps, 7 timelines, 6 restores, 25 promise runs and 2 left-alone runs against the sketch's `clock.js`. `pnpm --filter @city/run typecheck` is clean; `domain/run/src` imports `@city/site` and nothing else. [verified: test event "Tests passed, 41 passed 72 passed 123 passed", 2026-10-13T02:41:37Z UTC, after last code edit 02:41:00Z]
- **Status**: DONE

### Phase 4: Board: the web adapter at parity
- **Tier**: Large
- **Budget**: 400
- **Domain focus**: Board. The adapter that draws the site, turns clicks into commands, words the events, and shows the line checks, the stretch tests and the clock. Browser storage sits behind its own adapter.
- **Entry state**: Phases 1 to 3 are DONE: the three contexts are complete and tested.
- **Deliverable**: `apps/board` (`@city/board`, Vite): the board, tray, score, inspector, clock card, work in hand, line checks, stretch tests and notes of the published page, a storage adapter, a browser smoke test replaying the sketch's flows, and a build that still emits one publishable page. The Board words the Site's events, checks and tile issues (the domain emits typed facts, Phase 2); its wording is tested against the sentences recorded in `domain/site/test/fixtures/parity.json`.
- **Exit state**: The app behaves as the published page for the smoke flows, and no domain package imports the DOM or storage.
- **Demonstration**: `pnpm --filter @city/board test:e2e` is green for four flows (the opening city at 14 of 15; two far neighborhoods breaking three lines; a founding run through year 3; the ledger's city run to year 20), and `pnpm --filter @city/board build` emits the single page.
- **Demonstrated**: 
- **Status**: PENDING

## Out of scope

Each of these is its own plan after this one:

- The physical city: zooming from the tile map into drawn neighborhoods, with the surface and the sub level.
- A site that is not a hexagon of hexagons.
- Money.
- The ledger's own page (the two-column derivation) as a second app.
