# Session Plan: The line holds through a closure (the stops and ways breaks in years 7 and 16)

**Created**: 2026-10-22
**Plan Status**: ACTIVE
**Overall scope**: Measure why the line's stops and ways checks break in the closure years 7 and 16 of seed 42's timeline (the only line-year source left in the records), have David choose the mechanism in a new ADR, then build it and re-pin the records. The mechanism is David's to choose; this plan does not decide it.
**Bounded contexts touched**: Site (line checks in `assess.ts`, `needsOf`, `proposeFor`), Run (the timeline's closures, founding and past records), Board (wording only if a need or closure gains a new reason)
**Key domain language**: closure (a stretch of line closed for a year in the timeline), stops, ways, line-year, mover line, stretch, neighborhood, squeeze, crews as the brake

## References consulted
- `docs/adrs/0019-a-plant-is-proposed-with-the-line-that-joins-it.md` — its Future changes names this as a separate decision ("a line that holds through a closure"); proposals are one need at a time, class-0 jobs crewed ten at a time; the line need no longer asks for a tile its plant's proposal joins.
- `docs/adrs/0018-a-full-circle-is-built-with-room-for-the-squeeze.md` — its 2026-10-22 note (ff8a39) found stops and ways measure connection, not capacity, and tied the breaks to the closures in years 7 and 16; Decision 5's invariant (needs equal the broken checks) must be restated by any new mechanism; the size-line-for-squeeze plan was abandoned for this reason.
- `docs/adrs/0020-a-growing-circles-schools-are-built-with-room-for-the-wave.md` — Residual: the line's closures remain, a separate decision; current records (full circle 4 line-years, 275,000 in 55 neighborhoods at year 20 for 25.82 bn) are the baseline to re-pin.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — needs are a derived query, empty exactly when no NEED_CHECKS check is broken.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` — build order and class-0 crewing; people move in when served.
- `docs/adrs/0017-people-wait-for-homes-and-the-crews-are-the-brake.md` — crews are the brake, so any extra line work costs time.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — parity against the sketch stays unmoved; the sketch's clock never proposes.
- `docs/context/project-profile.md` — TypeScript workspace, pure domain packages, no regular expressions (ADR-0002), documentation standard.
- `docs/context/session-20261022-1802-main.md` — hands the closure breaks to David as a separate decision, deliberately not filed as an issue.
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — product ADR, Scope apps/board intersects Phase 2's Board test paths: a push to main is a publish, so phase commits stay local and publishing stays with finalize.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Measure why the line breaks in the closure years, and record David's mechanism choice (ADR-0021)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site line checks (stops, ways) against the Run timeline's closures in years 7 and 16
- **Entry state**: Main at 5ed8601, tests green; the full first circle's twenty-year record breaks only '7: stops, ways' and '16: stops, ways' (4 line-years) in `domain/run/test/past.test.ts`.
- **Deliverable**: A throwaway probe (deleted before commit) that, for each closure year, prints which stretch closes and when, which neighborhoods lose a stop reaching their ring and which ways break, the months the line is down, what the run does about it (needs raised, proposals, jobs queued and crewed), and whether the other records (one neighborhood, from nothing, the seventy-year runs) meet the same closures. Then ADR-0021, DRAFT with Open Questions, stating the measured cause and presenting the options for David without choosing (candidates to measure, not to pick: a second route or redundant stretch so a closure leaves stops and ways connected; the run reopening or rerouting around a closure within the year; counting a closure's months as a closed line rather than a broken check; leaving the closures as the accepted residual). David is interviewed via `/devarch:adr-interview`, one question at a time, and his choice recorded.
- **Exit state**: ADR-0021 is ACCEPTED with one chosen mechanism and the measured cause of each closure break in its Context; no production code changed; probe files deleted.
- **Demonstration**: The probe's output for both closure years quoted in ADR-0021's Context; `grep -c "^## Open Questions" docs/adrs/0021-*.md` prints 0 and the Status line reads ACCEPTED.
- **Demonstrated**: 2026-10-25 (session 0ba30d): probe output for both closure years is quoted in ADR-0021's Context table; `grep -c "^## Open Questions" docs/adrs/0021-*.md` prints 0 and the Status line reads ACCEPTED after Q-2 (Site need under the named closure) and Q-3 (closures carry notice 2, the way round waits its turn in class 0) were resolved and adr-review scored 21/21; no production code changed, probe deleted. [reported by session, unverified]
- **Status**: DONE

### Phase 2: Build the line the way ADR-0021 decides, and re-pin the records
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site (`assess.ts`, `needs.ts`, `propose.ts` or the chosen seam), Run (timeline and the founding and past records), Board wording if a need gains a new reason
- **Entry state**: ADR-0021 ACCEPTED; Behavior Statements for changed side-effect functions are written before tests, and a Boundary Statement before editing any `**/domain/**` path.
- **Deliverable**: The chosen mechanism with its invariant restated per ADR-0018 Decision 5 and a test in `domain/site/test` tied to the ADR's decisions; parity suites and sketch fixtures unmoved (ADR-0003). Real-path records re-measured and re-pinned in `domain/run/test/past.test.ts` and `founding.test.ts` (the closure line-years gone or the residual stated), any `apps/board/test/wording.test.ts` and e2e change, and docs and notes updated (`docs/domain/site.md`, `docs/domain/run.md`, `docs/context/project-profile.md`, dated notes on ADR-0018, ADR-0019 and ADR-0020).
- **Exit state**: Full test suite, typecheck and Board e2e green; the years 7 and 16 breaks no longer appear in the real-path runs (or are recorded as the accepted residual); every changed record and document agrees with the measured figures.
- **Demonstration**: `pnpm -r test`, `pnpm -r typecheck` and `pnpm --filter @city/board test:e2e` run green; the re-pinned `past.test.ts` shows the full circle with zero (or the stated residual of) line-years, with the new population at year 20 and cost quoted in ADR-0021's Consequences.
- **Demonstrated**: 
- **Status**: PENDING
