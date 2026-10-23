# Session Plan: School seats for a growing circle (the wave of families meeting a circle still being built)

**Created**: 2026-10-22
**Plan Status**: DONE
**Overall scope**: Confirm why schools break in a circle that is still growing (full-circle run year 11, 20 middle seats at 8,1 in the second circle; from-nothing run year 12, 64 elementary seats at -1,-1 in the first), have David choose the mechanism in a new ADR, then implement it and re-pin the records.
**Bounded contexts touched**: Site (propose, assess, needs), Run (founding and past records), Board (wording only if the Needs card changes)
**Key domain language**: growing circle, headroom (ADR-0018), squeeze (`rates.band`), neighborhood, school seats (elementary, middle, high), proposal (`proposeFor`), crews as the brake (ADR-0017)

## References consulted
- `docs/adrs/0018-a-full-circle-is-built-with-room-for-the-squeeze.md` — headroom applies only once a circle is full; a growing circle is read for an ordinary year, and headroom for a growing circle is explicitly "a new decision". The invariant (Decision 5) says needs equal the broken ordinary checks plus the broken headroom checks in full circles; any new mechanism restates it.
- `docs/adrs/0019-a-plant-is-proposed-with-the-line-that-joins-it.md` — its change surfaced these two breaks; proposals are one need at a time, re-read after each, in a fixed need order, class-0 jobs crewed ten at a time.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — needs are a derived query; empty exactly when no NEED_CHECKS check is broken; the size watch and daily list never ask for anything.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` — build order and class-0 crewing; people move in when served, so the arrival wave is determined by service.
- `docs/adrs/0017-people-wait-for-homes-and-the-crews-are-the-brake.md` — a waiting list drives arrivals; crews are the brake, so extra school work costs time.
- `docs/adrs/0016-the-site-is-concentric-circles-with-an-infrastructure-band.md` — circle, full and second-circle opening definitions.
- `docs/adrs/0009-population-is-occupancy-moved-month-by-month.md` and `docs/adrs/0015-the-run-orders-for-itself-as-people-arrive.md` — occupancy moves monthly; the run orders through `placeOrder` and the player's veto applies.
- `docs/context/project-profile.md` — stack and conventions (TypeScript workspace, pure domain packages, no regular expressions per ADR-0002).
- `docs/context/session-20261022-1213-main.md` — Next Phase names exactly these two breaks as for David to decide; the closure breaks (years 7 and 16) are a separate decision and stay out of scope.
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — Scope apps/board: a push to main is a publish, so the phase commits stay local and publishing stays with finalize.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Measure why the schools break in a growing circle, and record David's mechanism choice (ADR-0020)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site needs (school checks in `assess.ts`, `needsOf`, `proposeFor` in `propose.ts`) against the Run's arrival wave in a growing circle
- **Entry state**: Main at 6a1a2ad, tests green; the two breaks reproduce on the real path (full circle year 11, from nothing year 12) in `domain/run/test/past.test.ts` and `founding.test.ts` records.
- **Deliverable**: A throwaway probe (deleted before commit) that, for each break, prints the month and the circle's occupancy, the school need at the break, when its school was proposed and crewed, and what the class-0 queue held ahead of it. Then a new ADR-0020, Status DRAFT with Open Questions, stating the measured cause and presenting options for David without choosing: (a) headroom for a growing circle (read the schools with the next wave of neighborhoods or the squeeze before the circle is full), (b) proposing schools a lead of N months or neighborhoods ahead of the families (as a check of its own, so needs still answer exactly the broken checks per ADR-0008), (c) ordering a school with the neighborhood it serves (as ADR-0019 does for a plant and its line), (d) leave as a known residual. Each option carries its measured effect on line-years, population at years 20/50 and cost, so the choice is made on numbers. Run `/devarch:adr-interview` with David to resolve the questions; the ADR flips to ACCEPTED only when its Open Questions are empty.
- **Exit state**: ADR-0020 is ACCEPTED with one chosen mechanism, the measured cause of each break recorded in its Context, and no production code changed. Probe files deleted.
- **Demonstration**: The probe's output for both runs, quoted in ADR-0020's Context, shows the month, tile, seat count and queue position for each break; `grep -c "^## Open Questions" docs/adrs/0020-*.md` prints 0 and its Status line reads ACCEPTED.
- **Demonstrated**: [verified: ADR-0020 Context carries the probe's table for both breaks (full circle year 11, 20 middle at 8,1, school 9,-1 at 900/1,000 ordinary; from nothing year 12, 64 elementary at -1,-1, schools at 500/500), needs empty at each break, plus a third (one neighborhood year 18, high); `grep -c "^## Open Questions"` prints 0; Status ACCEPTED, option (a) chosen by David; probe files deleted and needs.ts reverted (git status clean of source)]
- **Status**: DONE

### Phase 2: Build schools the way ADR-0020 decides, and re-pin the records
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site (`propose.ts`, `assess.ts` or the chosen seam), Run (founding and past records), Board wording if a need gains a new reason
- **Entry state**: ADR-0020 ACCEPTED; Behavior Statements for the changed side-effect functions are written before tests, and a Boundary Statement before editing any `**/domain/**` path.
- **Deliverable**: The chosen mechanism in the Site, with its invariant restated per ADR-0018 Decision 5 and a test in `domain/site/test` (new describe or file beside `headroom.test.ts`) tied to the ADR's decisions; the parity suites and the sketch's fixtures unmoved (ADR-0003). Real-path records re-measured and re-pinned in `domain/run/test/past.test.ts` and `founding.test.ts` (the two school breaks gone or the residual stated), plus any `apps/board/test/wording.test.ts` change. Docs and notes updated: `docs/domain/site.md`, `docs/domain/run.md`, `docs/context/project-profile.md`, dated notes on ADR-0018 and ADR-0019 pointing to ADR-0020. Full suite run before commit.
- **Exit state**: Full test suite green; both school breaks no longer appear in the real-path runs (or are recorded as the accepted residual); every changed record and document agrees with the measured figures.
- **Demonstration**: Run the workspace test suite and show it green; the re-pinned `past.test.ts` and `founding.test.ts` assertions show zero school-need broken years for the full-circle (year 11) and from-nothing (year 12) runs, with the new line-years, population at year 20/50 and cost quoted in ADR-0020's Consequences.
- **Demonstrated**: [verified: `pnpm -r test` green (ledger 93, ground 27, site 227, run 241, board 199); `pnpm -r typecheck` clean; `pnpm --filter @city/board test:e2e` 18 passed on a fresh build; `past.test.ts` pins the full circle's broken years as only '7: stops, ways' and '16: stops, ways' (4 line-years) and `founding.test.ts` the one-neighborhood run without '18: high' (9 line-years) and from nothing at 2 line-years, with the figures in ADR-0020's Consequences; unit run corroborated by event-log row 'Tests passed: 93 27 227 241 199' at 2026-10-23T02:34:37Z; the e2e run (18 passed) and typecheck are reported by session, unverified, the flows.spec.ts edit at 02:37:01Z postdating the last logged run]
- **Status**: DONE
