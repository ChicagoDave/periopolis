# Session Plan: Size the line for the squeeze once a circle is full

**Created**: 2026-10-22
**Plan Status**: ABANDONED
**Abandoned** (David, 2026-10-22, session ff8a39): the premise does not hold. The line checks (stops, work, ways, haul in `domain/site/src/assess.ts`) measure connection, not capacity, so reading occupancy at the squeeze cannot move them. Seed 42's timeline puts the closures in years 7 and 16, exactly the stops/ways breaks, and the haul breaks (years 2-3, 25-26) fall outside the squeeze. ADR-0018's Residual was corrected to say so. No code changed.
**Overall scope**: David's decision (2026-10-22), "headroom once full", extended to the line: once a circle is full, its stops, ways and haul are sized to people x (1 + `rates.band`), the same rule ADR-0018 applies to ring, plants and schools. Target: the full circle's year-7 stops/ways break and the haul breaks in years 2-3 (full circle run) and 25-26 (seventy-year runs) disappear, measured on the real path (`domain/run/test/past.test.ts`, seed 42). Fields stay out of scope. New ADR 0019 extends ADR-0018 and supersedes its Decision 3 clause on the line only.
**Bounded contexts touched**: Site (needs, headroom checks), Run (the needs signal reads `proposeFor`; real-path records), Board (wording only if a record or fact shape it words moves)
**Key domain language**: full circle, headroom, squeeze (band), line (stops, ways, haul), line-years

## Decided (David, 2026-10-22)
- Once full, the line is sized as the ring, plants and schools already are (ADR-0018). Squeeze figure stays `rates.band`; no new premise.
- Fields remain out (ADR-0018 Decision 3 stands for fields; the mover line is the line, so only its fields clause survives).

## References consulted
- `docs/adrs/0018-a-full-circle-is-built-with-room-for-the-squeeze.md` (technical) - Decision 3 left the line out and the Residual and Future changes bullets name this as a new decision; `HEADROOM_CHECKS` (ring, power, water, sewage, waste, elementary, middle, high) and `headroomOf` are the mechanism to extend; invariant (Decision 5) must be restated to include the line checks; Decision 6's `squeeze: true` and `needText` wording carry over.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` (technical) - needs are empty exactly when no `NEED_CHECKS` check is broken (tested in `needs.test.ts`); a new need shape and its wording change together.
- `docs/adrs/0016-the-site-is-concentric-circles-with-an-infrastructure-band.md` (technical) - Decision 3 defines full; per-circle shorts carry a circle in needs.
- `docs/adrs/0017-people-wait-for-homes-and-the-crews-are-the-brake.md` (technical) - the real-path records and crews-as-brake; line headroom lengthens the crews' queue and moves the 360,000-by-year-53 figure.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` (technical) - crews build needs first; extra line capacity may delay homes.
- `docs/adrs/0015-the-run-orders-for-itself-as-people-arrive.md` (technical) - headroom reaches the Run only through `proposeFor`; no second path.
- `docs/adrs/0004-*` / `0003-parity-port-against-the-sketch.md` (technical) - parity suites must stay byte-identical; a layout with no circles is unchanged; the Board words facts, the domain emits them.
- `docs/adrs/0002-no-regular-expressions.md` (technical) - no regular expressions in code or tests.
- `docs/context/project-profile.md` - documentationStandard `always`; `pnpm -r test`, `pnpm -r typecheck`, Board flows via `pnpm test:e2e` (builds first).
- `docs/context/session-20261021-1857-main.md` - most recent session; no open items.
- `docs/archive` precedent: `docs/work/archive/full-circle-headroom-for-squeeze/plan.md` - phase shape.
- Product ADRs not consulted (no Scope intersection): none

## Measured now (ADR-0018 record, seed 42)
- Full first circle, twenty years: 6 line-years, haul years 2-3, stops and ways years 7 and 16.
- Seventy-year runs: 13 and 5 line-years; haul breaks in years 25-26; both circles full at 360,000 in year 53.
- Note: the target names years 7 (stops/ways) and 2-3 (haul); the year-16 stops/ways break is not named in the target and Phase 1 must report whether it also clears or remains as residual.

## Phases

### Phase 1: The line of a full circle is sized to people plus the squeeze (ADR-0019, Site query, Run records)
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Site needs (`HEADROOM_CHECKS`, `headroomOf`, `needsOf`, `isFull`) and the line checks (stops, ways, haul); Run real-path records
- **Entry state**: no other active plan; suite green at HEAD; ADR-0018 accepted; the line checks are assessed only in an ordinary year.
- **Deliverable**: (1) Behavior Statement, then first find, in the Site source, how the line's checks (stops, ways, haul) read occupancy and which `NEED_CHECKS` entries they are, and whether `headroomOf` already reaches them; add them to the headroom set for full circles, keeping the size watch, daily list and fields out. The line need is one layout-wide need (`{need: 'line', reach, answers}`), not per circle, so `needsOf`'s merge gets a line branch: the ordinary line need is kept as is, and the squeeze adds a second line need marked `squeeze: true` whose reach is only the tiles the squeeze adds (squeezed reach minus ordinary reach), so a need an ordinary year asks for is worded as before (ADR-0018 Decision 6; plan-review CONTRADICTION). The `'line'` variant of `Need` gains `squeeze?: true` and `needText`'s line case says it via `squeezeSaid`, in this phase. ADR-0019 decides whether `work` (in `LINE_CHECKS`) joins stops, ways and haul at the squeeze, and how the restated invariant is checked for the line need, which carries reach tiles rather than a circle (plan-review TENSIONs). Headers on every touched file. (2) New ADR-0019 (Kind technical, Scope domain/site, domain/run, apps/board), extending ADR-0018 and superseding only its Decision 3 clause on the line; restated invariant; dated notes on ADR-0018 (Decision 3, Residual, Future changes) and ADR-0017 (record). (3) Tests from scenarios: a full circle's needs ask for line headroom and a growing one does not; a layout with no circles is unchanged; the invariant holds per circle in `headroom.test.ts`; fields still unasked. (4) Re-pin the real-path records from running them, not guessing: `past.test.ts` (full first circle, seventy-year runs), `founding.test.ts`, `circle.test.ts`, `infer.test.ts`, with each figure carried into ADR-0019. Integration Reality Statement: REAL-PATH TEST is `past.test.ts` through production `proposeFor`/`inferStep`, no stub.
- **Exit state**: `pnpm -r test` and `pnpm -r typecheck` green; parity suites byte-identical; the full circle's year-7 stops/ways break and the haul breaks in years 2-3 (full circle run) and 25-26 (seventy-year runs) are gone, or any that remain are named as residual in ADR-0019 with cause; seventy-year runs re-pinned.
- **Demonstration**: run `pnpm -r test` and `pnpm -r typecheck` (green); run `past.test.ts` on the full-first-circle twenty-year run and the seventy-year runs and read the broken checks and line-years per year against ADR-0019's figures; `git diff` over parity test files is empty.
- **Demonstrated**: 
- **Status**: ABANDONED (2026-10-22)

### Phase 2: The Board, the notation and the record agree with the new rule
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board wording of line needs for a full circle (domain emits facts, Board words them); docs
- **Entry state**: Phase 1 done and committed; Board unit tests green at that commit.
- **Deliverable**: Board unit tests and flows (`flows.spec.ts`) re-pinned for any figure that moved; `pnpm test:e2e` run; `docs/domain/site.md` (Need and Full circle rows, scenario, `headroom.test.ts` sentence), `run.md` (moved record), `board.md` (needs card wording if it changed), and `docs/context/project-profile.md` updated where they say the line is not sized for the squeeze; ADR-0018 index/note cross-references verified.
- **Exit state**: `pnpm -r test`, `pnpm -r typecheck` and `pnpm test:e2e` green; docs describe headroom once full including the line; plan DONE and archived.
- **Demonstration**: run `pnpm test:e2e` (builds first) and read the full-first-circle flow passing; grep `docs/domain` for the full-circle clause and read the line named beside ring, plants and schools.
- **Demonstrated**: 
- **Status**: ABANDONED (2026-10-22)
