# Session Plan: A full circle is built with headroom for the squeeze (resolves GitHub issue 9)

**Created**: 2026-10-21
**Plan Status**: ACTIVE
**Overall scope**: David's decision (2026-10-21), "headroom once full": when a circle has no open tile for homes (full: 36 neighborhoods, ADR-0016 Decision 3), the Site's proposals size that circle's ring, schools and plants to its people plus the squeeze, line 18's +20% people in the same homes, instead of an ordinary year. A circle still growing gets no extra headroom; its capacity ordered ahead absorbs the squeeze. The squeeze figure is the existing `SiteRates.band` (ledger, 20%, Mine, the stress `bandTests` already applies); no new number. Needs a new ADR narrowing ADR-0008 Decisions 2 and 3 for full circles.
**Bounded contexts touched**: Site (needs, proposals), Run (the needs signal reads `proposeFor`; real-path records), Board (wording and flows only if a record they pin moves)
**Key domain language**: full circle, headroom, squeeze (band), ordinary year, Proposal, line-years

## Decided (David, 2026-10-21)
- **Headroom once full**, per circle, only for a circle with no open tile for homes. A growing circle gets none.
- **Squeeze figure** is `rates.band`, not a new premise.
- **Record**: a new ADR, with dated notes on ADR-0008 (Decisions 2 and 3) and ADR-0016 (Consequences, issue 9 line).

## Measured now (domain/run/test/past.test.ts, seed 42)
- First circle full to 180,000, twenty years: ring, schools and plants break in squeeze years 5-7, schools again in 9-13 and 18-20; 42 line-years, 26.18 bn.
- From one neighborhood / nothing, seventy years: 13 and 5 line-years; both circles full at 360,000 by year 50.

## References consulted
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` (technical) — Decision 2 has `needsOf` read an ordinary year; Decision 3 holds the invariant that needs are empty exactly when no `NEED_CHECKS` check is broken (tested in `needs.test.ts`). The new ADR must narrow both for full circles and keep the invariant statable (broken under the stress that applies to each circle); parity suite (ADR-0003) must not move.
- `docs/adrs/0016-the-site-is-concentric-circles-with-an-infrastructure-band.md` (technical) — Decision 3 defines full (no open tile in the band; 36 neighborhoods, 180,000); Consequences name issue 9 and hold the Phase 8 record; per-circle shorts (`CircleShort`) are how needs already carry a circle.
- `docs/adrs/0017-people-wait-for-homes-and-the-crews-are-the-brake.md` (technical) — the real-path records (42 line-years, 26.18 bn, 13 and 5 line-years, 360,000 by year 50) were re-pinned here and will move again.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` (technical) — crews build needs first (Decision 2); extra headroom needs lengthen the crews' queue and may delay homes.
- `docs/adrs/0015-the-run-orders-for-itself-as-people-arrive.md` (technical) — the run's needs signal reads `proposeFor`; headroom reaches the run through it and must not add a second path.
- `docs/adrs/0002-no-regular-expressions.md` (technical) — no regular expressions in code or tests.
- `docs/adrs/0003-parity-port-against-the-sketch.md` (technical) — parity suites stay unchanged; headroom applies only to circles, and a layout with no circles (the sketch) is unchanged.
- `docs/context/project-profile.md` — documentationStandard `always`; `pnpm -r test`, `pnpm -r typecheck`, Board flows via `pnpm test:e2e` (builds first).
- `docs/context/session-20261021-1857-main.md` — most recent session; issue 9 is its open item.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Full circles are sized to people plus the squeeze (ADR, Site query, Run records)
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Site needs and proposals (full circle, `CircleShort`, `needsOf`, `proposeFor`); Run real-path records
- **Entry state**: no active plan; suite green at HEAD; issue 9 open; `needsOf` assesses only `NO_STRESS`.
- **Deliverable**: (1) New ADR-0018 (Kind technical, Scope domain/site, domain/run), Decision: a full circle's ring, schools and plants are needed to its people at `+band`; a growing circle's at an ordinary year; the invariant restated per circle; what `sizedTo` keeps in a full circle stated; dated notes on ADR-0008, ADR-0016 and ADR-0017 (its Consequences' record points to ADR-0018 for the re-pinned figures; plan-review 2026-10-21). (2) Behavior Statement, then the Site change (full read off the same planned board `proposeNeighborhood` reads, work in hand counted, so headroom and the next circle agree on the month; plan-review 2026-10-21): `needsOf`/`proposeFor` assess each full circle under `{ people: rates.band }` for the checks in `NEED_CHECKS` that the stress touches (ring, power, water, sewage, waste, schools; never the size watch or the daily list), exposed as a query (for example `isFull(layout, circle)` in `circle.ts`) so the Run and the Board read one definition; headers on every touched file. If `Need` gains a case or a field the Board words, `needText` and its wording test change in this phase too (ADR-0008 Consequences: a new fact shape and its wording in the same change; plan-review 2026-10-21). (3) Tests from scenarios: needs of a full circle ask for headroom and a growing one does not; a layout with no circles gives the same needs as before; the ADR-0008 invariant holds per circle; `needs.test.ts` and `propose` tests extended. (4) Re-pin the real-path records the change moves, from running them, not guessing: `past.test.ts` (full first circle: years 5-7 / 9-13 / 18-20, 42 line-years, 26.18 bn; the 70-year runs: 13 and 5 line-years), `founding.test.ts`, `circle.test.ts`, `infer.test.ts`, with each new figure carried into ADR-0018 and the dated notes. Integration Reality Statement: the REAL-PATH TEST is `past.test.ts` through the production `proposeFor`/`inferStep`, with no stub.
- **Exit state**: `pnpm -r test` and `pnpm -r typecheck` green; parity suites byte-identical; the first-circle-full run shows no squeeze line-year from the ring, schools or plants of a full circle (or the residual, named in the ADR); the seventy-year runs re-pinned.
- **Demonstration**: run `pnpm -r test` and `pnpm -r typecheck` (green); run `past.test.ts` on the full-first-circle twenty-year run and read the line-years per circle and year against the ADR's stated figures; `git diff` over parity test files is empty.
- **Demonstrated**: [verified: `pnpm -r typecheck` clean; `pnpm -r test` 93+27+220+241+198 passed (Site +8 in `headroom.test.ts`, Board +1 squeeze wording); Board `pnpm test:e2e` 18 passed on a fresh build, no flow moved; `past.test.ts` full first circle: broken only '2: haul', '3: haul', '7: stops, ways', '16: stops, ways', 6 line-years (was 42), no ring, school or plant line-year; seventy-year runs 150,000/155,000 at year 30, 235,000 at 40, 295,000 at 50, 360,000 from year 53, 13 and 5 line-years; founding, circle and infer records unmoved; `git diff --stat` over `*parity*` empty; ADR-0018 written with notes on ADR-0008, 0016 and 0017, 2026-10-21]
- **Status**: DONE

### Phase 2: The Board, the notation and the issue agree with the new rule
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board wording of needs for a full circle (ADR-0004: the domain emits facts, the Board words them); docs
- **Entry state**: Phase 1 done and committed; Board unit tests green at that commit.
- **Deliverable**: Board flows (`flows.spec.ts`) and unit tests re-pinned for any figure that moved (the saved full first circle, the second circle opening); `pnpm test:e2e` run; `docs/domain/run.md`, `ledger.md`/site notation and `docs/context/project-profile.md` updated where they state sizing to an ordinary year; GitHub issue 9 closed with the ADR and commit cited.
- **Exit state**: `pnpm -r test`, `pnpm -r typecheck` and `pnpm test:e2e` green; docs describe headroom once full; issue 9 closed; plan DONE and archived.
- **Demonstration**: run `pnpm test:e2e` (builds first) and read the full-first-circle flow passing; grep `docs/domain` for the sentence on sizing to an ordinary year and read the headroom clause beside it; `gh issue view 9` shows CLOSED.
- **Demonstrated**: [verified: `pnpm -r test` 93+27+220+241+198 passed; Board `pnpm test:e2e` (fresh build) 18 passed, the full-first-circle flow among them, no flow re-pinned since none moved; `docs/domain/site.md` Need row reads the ordinary year with the full circle's squeeze clause beside it, a Full circle row and scenario and the `headroom.test.ts` sentence added; `run.md` and `board.md` carry the moved record and the needs card's squeeze wording; profile updated; `gh issue view 9` CLOSED with ADR-0018 cited, 2026-10-22]
- **Status**: DONE
