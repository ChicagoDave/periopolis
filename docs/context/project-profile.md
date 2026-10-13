# Project Profile

**Generated**: 2026-10-12
**Repository**: periopolis (formerly simcity-ai; the directory is renamed by hand)

## Domains

- Domain Modeling — planned `domain/ledger`, `domain/site`, `domain/run` as pure bounded contexts (docs/work/port-city-builder/plan.md); today only a JS sketch exists
- Frontend UI — planned `apps/board` (Vite, SVG tile map) as an adapter over the domain; sketch has browser JS pages
- Library / Package — planned `@city/*` workspace packages, each exporting one interface from `index.ts`

Status: pre-implementation. No manifests, source, or tests exist yet; domains come from the plan and techstack.md, not from code.

## Tech Stack

- **Language**: TypeScript (strict, planned); sketch is plain browser JavaScript
- **Runtime**: Node.js (domain and tests), browser (Board)
- **Framework**: Vite for `apps/board` (planned); none for domain
- **Data layer**: None (pure domain; browser storage behind a Board adapter)
- **Messaging**: None (commands answer with events, in-process)
- **Test framework**: Vitest (planned); browser smoke test via Playwright (sketch `look.js` flows)
- **Test command**: `pnpm -r test` (Vitest 5.0.4). Per package: `pnpm --filter @city/ledger test`. Typecheck: `pnpm -r typecheck` (TypeScript 7.0.2).
- **Build tool**: tsc / Vite (planned); sketch uses `build.sh` concatenation
- **Package manager**: pnpm (planned workspace)
- **CI/CD**: None
- **Monorepo**: Yes (pnpm workspaces, planned: `domain/*`, `apps/*`)

## Conventions

- **Test location**: Not yet set; sketch uses `test-*.js` scripts beside sources
- **Test naming**: Vitest tests derived from Behavior Statements; naming not yet fixed
- **Source structure**: Context-based: `domain/<context>` and `apps/<adapter>`; dependencies inward Board → Run → Site → Ledger
- **TypeScript strict mode**: Yes (planned, `strict`); domain compiles without the DOM lib
- **Import style**: ESM; no regular expressions in code; state replaced, never mutated; seeded randomness only
- **Documentation standard**: `always` (header on every file, method header on every public function)

## Mutation Signatures

### Domain Modeling (Ledger, Site, Run)
- **Mutation calls**: Layout commands (placing/removing tiles, neighborhoods, schools, fields, mover line, plants); Run commands (start/stop run, place order, put job first, cancel, advance year). State is replaced, so the mutation is the new state value or events returned.
- **Reporting without mutation**: A command returning an accepted event while the returned layout/run state is unchanged; a rejection missing a specific reason; `derive` results not reflecting changed premises.
- **Test assertions — verify**: The resulting state (layout, jobs, yearly record) and emitted event payload; specific rejection reasons; published figures (e.g. 2,110 and 13,249 people per km², ceiling 166,492); parity fixtures show 0 differences.
- **Test assertions — insufficient**: Only checking a command did not throw; asserting on event emission without the state; mock-only assertions; hardcoded tautologies.

### Frontend UI (Board)
- **Mutation calls**: Dispatching domain commands from clicks; storage adapter writes (localStorage or similar); DOM updates.
- **Reporting without mutation**: A note or sentence shown for an event that the domain did not emit; UI showing success while storage write failed.
- **Test assertions — verify**: Browser smoke flows assert rendered line checks (e.g. 14 of 15), stretch tests, clock year, and persisted storage contents.
- **Test assertions — insufficient**: Element-exists checks; snapshots without domain state assertions.

## Notes

- Parity oracle: `docs/work/port-city-builder/sketch/` (ledger/model.js, builder/engine.js, clock.js, check scripts, `ledger/copied.txt`). Phase 1 is CURRENT.
- `domain/*` must not import DOM or storage; each context depends only on the next inward one.
- Domain notation and ADRs are planned under `docs/domain/` and `docs/adrs/`.
- Phase 1 created the workspace skeleton on 2026-10-12; the test command above is live.
