# Project Profile

**Generated**: 2026-10-13
**Repository**: periopolis (formerly simcity-ai; the directory is renamed by hand)

## Domains

- Domain Modeling — four pure bounded contexts under `domain/`: `@city/ledger` (premises in, consequences out), `@city/site` (layout on the shore board's circles and bands, ADR-0016; 16 line checks, 4 stretch tests), `@city/run` (twenty years on the clock, seeded), `@city/ground` (physical plan of a neighborhood and the ring; ADR-0005)
- Frontend UI — `apps/board` (`@city/board`): Vite + hand-drawn SVG (`src/draw/*`), one self-contained page via vite-plugin-singlefile; holds no rules
- Library / Package — each `@city/*` domain package exports one interface from `src/index.ts` (`main`/`exports` point at the TypeScript source, no build step)

Status: implemented. Domains come from code and manifests; the notation lives in `docs/domain/*.md` and the decisions in `docs/adrs/0001-0005`.

## Tech Stack

- **Language**: TypeScript 7.0.2 (strict)
- **Runtime**: Node.js >=22 (domain and unit tests), browser (Board)
- **Framework**: Vite 8.3.4 for `apps/board` (plain DOM and SVG, no UI framework); none for domain
- **Data layer**: None (pure domain; the Board's `src/storage.ts` hides browser storage behind one interface)
- **Messaging**: None (commands answer with typed events or rejections, in-process)
- **Test framework**: Vitest 5.0.4 (domain and Board unit/wording/session tests); Playwright 1.64.0 (Chromium) for Board flows in `apps/board/test/e2e/flows.spec.ts`
- **Test command**: `pnpm -r test`. Per package: `pnpm --filter @city/ledger test`. Typecheck: `pnpm -r typecheck`. Board browser flows (not part of `pnpm -r test`): `pnpm --filter @city/board test:e2e` (builds, then runs Playwright).
- **Build tool**: tsc (`--noEmit` typecheck only) and Vite (`pnpm -r build`; Board emits `apps/board/dist/index.html`)
- **Package manager**: pnpm 10.28.2 (workspaces: `domain/*`, `apps/*`)
- **CI/CD**: None
- **Monorepo**: Yes (pnpm workspaces; shared `tsconfig.base.json`)

## Conventions

- **Test location**: `test/` directory in each package; Board browser flows in `apps/board/test/e2e/`
- **Test naming**: `*.test.ts` (Vitest), `*.spec.ts` (Playwright); `parity.test.ts` per ported context, with `test/fixtures/parity.json` recorded by `test/record-fixtures.mjs` from the sketch
- **Source structure**: Context-based: `domain/<context>` and `apps/<adapter>`. Dependencies point inward: Board → Run → Site → Ledger, and Board → Ground → Ledger (ADR-0001 as amended by ADR-0005). Ground never imports Site.
- **TypeScript strict mode**: Yes — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. Domain packages use `lib: ["ES2022"]`, `types: []` (no DOM or Node); the Board adds DOM.
- **Import style**: ESM, relative imports with `.ts` extensions allowed, `@city/*` workspace packages; no path aliases
- **Documentation standard**: `always` (`.devarch/descriptor.json`): header on every file, method header on every public function
- **Code rules**: no regular expressions anywhere, tests and scripts included (ADR-0002; parse keys by walking structure, with paired parse and format functions); state replaced, never mutated; seeded randomness only; domain never writes a sentence, the Board words events and facts (ADR-0004); parity with the sketch (ADR-0003)

## Mutation Signatures

### Domain Modeling (Ledger, Site, Run, Ground)
- **Mutation calls**: Site layout commands (placing/removing tiles, neighborhoods, schools, fields, mover line, plants); Run commands (`startRun`, `stopRun`, `tick`, `tickMonth`, `placeOrder`, `cancelJob`, `cancelOrder`, `putFirst`, `restoreClock`; with `infer`, ADR-0015, the run's own `inferStep` orders through `placeOrder` each month). Ledger `derive*` and Ground `planNeighborhood`, `planRing`, `layersAt` are pure derivations. State is replaced, so the mutation is the new state value or the events returned.
- **Reporting without mutation**: A command returning an accepted event while the returned layout/run state is unchanged; a rejection without a specific typed reason; a derived result not reflecting changed premises; the input value being mutated in place.
- **Test assertions — verify**: The resulting state (layout, jobs, yearly record) and emitted event payload; specific typed rejection reasons; published figures (2,110 and 13,249 people per km², ceiling 166,492); parity fixtures show 0 differences; Ground sums reconcile with the Ledger (2,041 homes, 12 km frontage, 33 entries, 1.1/3.7/6.1 km lane, walkway, pipe; `GroundError` on a ring of zero buildings); the input is unchanged after the call.
- **Test assertions — insufficient**: Only checking a command did not throw; asserting on event emission without the state; mock-only assertions; hardcoded tautologies; asserting on sentences from the domain (it emits none).

### Frontend UI (Board)
- **Mutation calls**: Session changes in `src/session.ts` (game, tool in hand, picked tile, undo history); dispatching Site commands or Run orders from clicks (`src/moves.ts`); storage adapter writes (`src/storage.ts`, the sketch's localStorage key and shape); DOM/SVG updates in `src/draw/*`.
- **Reporting without mutation**: A note or sentence shown for an event the domain did not emit; UI showing success while the storage write failed; zoom or level selector changing the label but not the drawn Ground plan.
- **Test assertions — verify**: Wording tests assert the sketch's sentences exactly; session tests assert the resulting game state; Playwright flows assert rendered line checks (e.g. 14 of 15), stretch tests, clock year, persisted storage contents, and the zoomed tile's surface or sub level.
- **Test assertions — insufficient**: Element-exists checks; snapshots without domain state assertions.

## Notes

- Parity oracle: `docs/work/archive/port-city-builder/sketch/` (ledger/model.js, builder/engine.js, clock.js, check scripts, `ledger/copied.txt`). Each ported package's `record-fixtures.mjs` reads it; the sketch is read-only.
- `domain/*` must not import DOM or storage; each context depends only on the inward ones named above. Ground's output is projection-neutral (plan view in metres plus story counts) and tags placements the Ledger leaves open as `placeholders`.
- Active plan: none. Last: `docs/work/archive/arrivals-scale-past-100000/plan.md`, complete and archived 2026-10-21 (ADR-0017, people wait for homes: a waiting list of 30,000 a year drives arrivals, the lead is 30 months of demand, the crews are the brake; Phases 1 to 3 done 2026-10-21, issue 8 closed). Before it: `docs/work/archive/concentric-site/plan.md` (ADR-0016), whose real-path record of a city levelling off near 114,000 is superseded by ADR-0017's: both circles full at 360,000 by year 50.
- Playwright flows are not run by `pnpm -r test`; the Board's `test` script covers only `test/**/*.test.ts`. The flows open the built page, so run them with `pnpm test:e2e` in `apps/board`, which builds first; `npx playwright test` alone runs the last build and can pass on stale code.
