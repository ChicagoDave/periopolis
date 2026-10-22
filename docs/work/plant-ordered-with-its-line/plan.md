# Session Plan: A plant is ordered together with the line that joins it (follows ADR-0018's Residual)

**Created**: 2026-10-22
**Plan Status**: ACTIVE
**Overall scope**: David's decision (2026-10-22): a plant comes into use already joined to the line, so it is ordered together with its line and the haul breaks disappear from the real-path records. Closure breaks (stops/ways in years 7 and 16, the closure events) are out of scope. Needs a new ADR-0019 and a dated note on ADR-0018's Residual.
**Bounded contexts touched**: Site (needs, proposals), Run (crews, inference, real-path records), Board (wording and flows only if a pinned record moves)
**Key domain language**: plant, line, haul (a plant is loose when no line path reaches it from a hood or ring), crew, line-years, Proposal

## Target (David, 2026-10-22)
- `domain/run/test/past.test.ts`, seed 42: full first circle, no '2: haul' and '3: haul'; 6 line-years fall to those the closures cost. Seventy-year runs: no haul in years 25-26 (13 and 5 line-years fall by the haul's share); from one neighborhood, also the year-2 loose interval (2:12..3:12) the probe found, reported whether it clears (plan-review TENSION).
- Out of scope: stops/ways in years 7 and 16, closure events.

## Measured (probe, since deleted, seed 42)
- Full circle 20y: water 5,4, sewage 8,4, waste 7,4 finished 2:12, loose until 4:12. Their line jobs (line@5,4|6,4 .. 8,4|9,4, inferred, not started) were in hand while a power job at 9,4 was worked.
- From one 70y: plants at -4,4 / -1,4 / -2,4 loose 2:12..3:12; water 5,4, power 9,4, sewage 8,4, waste 7,4 finished 25:12, 26:12, joined 27:12. From nothing 70y: same four plants loose 25:12..27:12.

## Read by the planner (confirming the session's reading, partly)
- `domain/run/src/crews.ts`: `line`, `ring`, `power`, `water`, `sewage`, `waste` and the schools are all class 0, crewed "in the order they stand" within a class. So a line job ordered after a plant stands behind it, and a power job ordered between them is crewed before the line. The line is not crewed first; ordering is by position in the job list.
- `domain/site/src/needs.ts`: needs are emitted in the fixed order ring, modules, plants, schools, fields, intake, line; the `line` need is read after the plant is applied to a scratch layout (`propose.ts` header: "a new plant needs the line is proposed after it"), so the line is its own later Proposal, placed by `inferStep` (`domain/run/src/infer.ts` ~line 96) as a separate order after the plant's.
- Not yet confirmed: whether the loose interval is queue position (line behind other class-0 jobs), crew count, or build time of the line itself. Phase 1 confirms before choosing.

## References consulted
- `docs/adrs/0018-a-full-circle-is-built-with-room-for-the-squeeze.md` (technical; Scope domain/site, domain/run, apps/board) — its 2026-10-22 note on the Residual names the line breaks as closures and plants built before their line; this plan resolves the second. Records re-pinned there move again.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` (technical) — needs are derived facts; Decision 3's invariant (needs empty exactly when no `NEED_CHECKS` check is broken) and "a new fact shape and its wording in the same change" bind any new Need shape; Decision 4: proposals change nothing.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` (technical) — Decision 2 crews class by class, within a class in standing order; Decision 7 emergency crews; Consequences: reordering crews moves spend between years, never its sum.
- `docs/adrs/0015-the-run-orders-for-itself-as-people-arrive.md` (technical) — inference orders every Site proposal through `proposeFor`; no second path.
- `docs/adrs/0016-the-site-is-concentric-circles-with-an-infrastructure-band.md` (technical) — line is one line crossing the seam band to band (`lineSteps`); plants live in the band.
- `docs/adrs/0017-people-wait-for-homes-and-the-crews-are-the-brake.md` (technical) — crews are the brake; the records here were re-pinned there and in ADR-0018.
- `docs/adrs/0003-parity-port-against-the-sketch.md` (technical) — parity suites unchanged; a layout with no circles and the sketch's clock keep their order.
- `docs/adrs/0002-no-regular-expressions.md` (technical) — no regular expressions.
- `docs/context/project-profile.md` — documentationStandard `always`; `pnpm -r test`, `pnpm -r typecheck`, Board flows via `pnpm test:e2e` (builds first).
- `docs/context/session-20261021-1857-main.md` — most recent session summary.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: The cause of the loose interval is confirmed, and ADR-0019 decides the mechanism
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run crews and inference (`crews.ts`, `jobs.ts`, `run.ts`, `infer.ts`); Site proposals (`propose.ts` `lineSteps`, `needs.ts` order)
- **Entry state**: no other active plan; suite green at HEAD; ADR-0018 note on the Residual written.
- **Deliverable**: (1) A throwaway probe (deleted after) that, for each haul year in the three target runs, records per plant: order month, finish month, its joining line jobs' order month and crew start, and which class-0 jobs stood ahead of them; stated in ADR-0019 Context. (1b) The probe and the three options go to David, who chooses the mechanism before ADR-0019 is written (plan-review TENSION: options (b) and (c) supersede ADR-0012 Decision 2, a decision of David's, which a dated note cannot do; (a) works within it). (2) ADR-0019 (Kind technical, Scope domain/site, domain/run) recording David's choice of mechanism, with the alternatives named: (a) a plant Proposal carries its joining `lineSteps`, so plant and line are one order and one place in the queue; (b) the crews take a plant's line jobs with the plant (a joined pair), leaving proposals separate; (c) crew the line ahead of other class-0 pieces. The choice must keep ADR-0008's invariant statable, keep `proposeFor` the single path (ADR-0015), keep the sketch's clock and parity suites unchanged, and say what happens when the line cannot be laid (no room: the plant is not ordered alone). (3) Dated notes on ADR-0012 (if crew order changes), ADR-0008 (if a Need shape or the proposal contract changes) and ADR-0018's Residual.
- **Exit state**: ADR-0019 written and consistent with the probe; no source change yet; mechanism and expected record movement stated.
- **Demonstration**: read the probe output for the three runs against the ADR's Context table (every haul year's cause named); `git status` shows only docs changed; `pnpm -r test` still green.
- **Demonstrated**: [verified: probe output read for the three runs, every haul year's cause in ADR-0019's Context table (the line's place in the queue, 14-55 class-0 jobs behind its plant); David chose mechanism (a); `git status` shows docs only; `pnpm -r test` 93+27+220+241+198 passed, 2026-10-22, session ff8a39]
- **Status**: DONE

### Phase 2: A plant is ordered with its line (Site/Run change, records, docs)
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Site proposals and/or Run crews per ADR-0019; real-path records; Board wording only if a record moves
- **Entry state**: Phase 1 done and committed; ADR-0019 names the mechanism.
- **Deliverable**: (1) Behavior Statement for each changed side-effect function, then the change per ADR-0019, headers on every touched file; if `Need` or `Proposal` gains a shape the Board words, `needText` and its wording test change in the same change. (2) Tests from scenarios: a plant ordered with no line reaching it comes with its line steps (or is crewed with them); a plant the line cannot reach is not ordered alone; a layout with no circles and the sketch's order are unchanged. (3) Re-pin from running them: `past.test.ts` (full first circle: haul years 2-3 gone, 6 line-years down to the closure share; seventy-year runs: years 25-26 gone, 13 and 5 reduced), and `founding`, `circle`, `infer` records if they move; carry each new figure into ADR-0019 and ADR-0018's note. Integration Reality Statement: REAL-PATH TEST is `past.test.ts` through the production `proposeFor`/`inferStep` and the clock, no stub. (4) Docs: `docs/domain/site.md`, `run.md`, `board.md`, project profile where they state the plant/line order or the moved records; Board flows re-pinned if moved, `pnpm test:e2e` run.
- **Exit state**: `pnpm -r test`, `pnpm -r typecheck`, `pnpm test:e2e` green; parity suites byte-identical; the three runs show no haul break; only closure breaks remain; plan DONE and archived.
- **Demonstration**: run `pnpm -r test`, `pnpm -r typecheck`, `pnpm test:e2e`; read `past.test.ts` records for the three runs against ADR-0019's stated figures; `git diff --stat` over `*parity*` is empty.
- **Demonstrated**: [verified: `pnpm -r typecheck` clean; `pnpm -r test` 93+27+223+241+198 passed; `pnpm --filter @city/board test:e2e` 18 passed on a fresh build; `past.test.ts` and `founding.test.ts` read against ADR-0019's figures: no haul break in any run, full circle 5 line-years (7 and 16 stops/ways, 11 middle), seventy-year 10 and 3, one neighborhood 10; `git diff --stat` over `*parity*` empty; 2026-10-22, session ff8a39]
- **Status**: DONE
