# Session Plan: Build in order, and say line 6 is under construction

**Created**: 2026-10-15
**Plan Status**: ACTIVE
**Overall scope**: Make the Run build what the city needs first (mover line and plants before homes) and keep a finished neighborhood empty until the city can carry it (mover stop, water, sewage, waste, power, school seats); word line 6 as "under construction" while its stretches are ordered but not built. This changes Run behaviour pinned by the sketch's parity fixtures, so an ADR comes first.
**Bounded contexts touched**: Run (crews, move-in), Site (a read of what a neighborhood needs to be lived in, no new arithmetic), Board (wording only). Ledger and Ground unchanged.
**Key domain language**: crews, job (ordered piece), build order, occupancy / move-in (ADR-0009), line 6 (mover stop), neighborhood standing empty, under construction (a fact the Board words, ADR-0004)

## Decisions already made (David, 2026-10-15)
1. "Build in order" means both: (a) crews take what the city needs first, the mover line and plants (power, water, sewage, waste), before homes, whatever the placement order; (b) a finished neighborhood stands empty until what it needs is open.
2. Moving in is gated on all of: a stop on a line to the ring (line 6); water, sewage and waste capacity (line 22); power, reactor modules carrying the peak with one down (lines 20, 21); school seats within a 30-minute walk (line 15).
3. Line 6's Board wording, when the neighborhoods' stretches are ordered but not built, says the line is under construction instead of only "Draw the mover line through them."

## Evidence
`docs/work/tests/city-261015.txt`: 6 neighborhoods opened at year 2 with 30,000 people while every mover stretch past the first six was still "waiting" for crews. Crews are 10 (`domain/run/src/rules.ts`); jobs are worked strictly in placement order (`domain/run/src/run.ts` `yearPasses`, `order.ts`).

## References consulted
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — dependencies point inward (Board, Run, Site, Ledger); Run may read Site, Site must not import Run, domain imports no infrastructure.
- `docs/adrs/0002-no-regular-expressions.md` — no regular expressions anywhere, tests and scripts included.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — behaviour was frozen at the sketch; anything new is its own plan and must leave the parity suite proving the old figures (Decision 4's pattern: compare old fields/rows only).
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — domain emits typed facts, never sentences; "under construction" is a fact the Board words.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — needs are read off the assessment, never re-derived; the move-in gate must read the same checks, not duplicate their arithmetic.
- `docs/adrs/0009-population-is-occupancy-moved-month-by-month.md` — arrivals fill empty homes in tile order at no more than 4,800 a year; the month clock is opt-in beside a parity-pinned yearly mode; crews work by the year and their work opens in month 12; the move-in gate narrows "which empty homes arrivals may fill".
- `docs/context/project-profile.md` — Run/Site/Board layout, test command `pnpm -r test`, Board e2e `pnpm --filter @city/board test:e2e`, documentation standard `always`, strict TypeScript.
- `docs/context/session-20261014-2353-main.md` — newest session: O-2 Phases 1 and 2 done; nothing in its open items touches Run.
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — product ADR, Scope apps/board intersects Phase 4: the Board is rebuilt and republished from main by the workflow (typecheck, `pnpm -r test`, e2e must pass); a wording change is shipped by merging, no extra publish step.
- Product ADRs not consulted (no Scope intersection): none
- ADRs 0005, 0006, 0007, 0010 read as technical: ground/site shape, cost and trips figures, unaffected by this plan except that ADR-0007's spend must stay yearly in sum if jobs reorder.

## Phases

### Phase 1: ADR-0012, build order and move-in gate, with scenarios and the parity decision
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Run (crews, jobs, move-in) and its parity pin to the sketch (ADR-0003, ADR-0009 Decision 5).
- **Entry state**: This plan approved by David; the two parity options below put to him.
- **Deliverable**: `docs/adrs/0012-*.md` (Kind technical, Scope domain/run, domain/site, apps/board) recording: the build-order rule (priority classes: mover line and plants first, then ring and schools and fields, then neighborhoods; placement order within a class; the exact class list is decided here); the move-in gate (the four conditions, read from Site's assessment, not re-derived); how parity is handled; what "under construction" means as a fact. Plus Given/When/Then scenarios from `city-261015.txt` (the founding run: at year 2 no neighborhood is lived in; when the line, plants and reactors are open it fills) written into the ADR or `docs/domain/`. Recommended parity handling, to confirm with David: opt-in rule beside the sketch's, as ADR-0009 did for growth (`inOrder` on the Run's rules; the parity suite replays with it off and stays byte-identical; the Board turns it on). The alternative, re-recording the fixtures from a changed sketch, breaks ADR-0003 Decision 1 and is recommended against. Open questions (partial gate: does a neighborhood fill once its own conditions hold or must the city's all hold; does the stress/line-years record count an empty neighborhood) go in the ADR's Open Questions for the adr-interview.
- **Exit state**: ADR-0012 ACCEPTED (no open questions left), an "Added 2026-10-15" note on ADR-0009 Consequences pointing at it (arrivals no longer fill every empty home in tile order), scenarios written, parity handling fixed.
- **Demonstration**: `ls docs/adrs/0012-*` and grep its Status line for ACCEPTED and its Decision list for the four gate conditions and the parity decision.
- **Demonstrated**: 2026-10-15 — `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` reads `**Status**: ACCEPTED` with no Open Questions section (grep count 0) after the adr-interview (Q-1 each neighborhood on its own; Q-2 an empty neighborhood is a watch; Q-3 people stay and a breakdown is an emergency; David also made the stop and the schools soft conditions) and adr-review (14/17, its three gaps fixed before the flip). Decision 1 records the parity handling (opt-in `inOrder`, fixtures byte-identical); Decision 3 the four conditions, two hard and two soft. ADR-0009 carries one "Added 2026-10-15" note; the scenarios are in `docs/domain/run.md` ("Built in order, people when served"). [reported by session, unverified]
- **Status**: DONE

### Phase 2: Crews take the city's needs first (build order)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run, Job aggregate and the crew assignment in `yearPasses`/`order.ts`.
- **Entry state**: ADR-0012 ACCEPTED.
- **Deliverable**: Priority classes on `Job`, crews assigned class by class then placement order in `yearPasses`, `startsNow` in `JobOrdered` consistent with it; behind the rule decided in Phase 1 so the yearly parity mode is untouched. Behavior Statement and tests from the scenarios: with 10 crews and homes ordered before mover stretches and plants, the stretches and plants are worked first; the existing waiting/waits-for host rules (`waitsFor`) still hold; spend stays yearly in sum (ADR-0007 Decision 14).
- **Exit state**: `pnpm --filter @city/run test` green including `parity.test.ts` unchanged; a scenario test reproduces the founding run's ordering and shows the mover stretches before the neighborhoods.
- **Demonstration**: Run the Run package tests; show the parity suite green with its fixtures unmodified (`git diff --stat domain/run/test/fixtures` empty) and the new ordering test asserting job completion years by class.
- **Demonstrated**: 2026-10-15 — `pnpm -r test`: ledger 91, ground 27, site 148, run 153 (142 before, plus 11 in `domain/run/test/order.test.ts`), board 130, all passed; `pnpm -r typecheck` 0 errors; `git diff --stat` on `domain/{run,site,ledger}/test/fixtures` empty, so the parity suite passes against unchanged fixtures. `order.test.ts` replays David's city-261015 orders: with `inOrder` year 1 opens six stretches and leaves every home untouched, and every stretch and plant stands before the first neighborhood opens (after year 2); without it the homes open at year 2 with one stretch built, as the sketch does. The emergency class (Decision 7) needs lived-in shortfalls and lands with Phase 3's gate. [verified: test event 2026-10-15T08:29:37Z, 91 27 148 153 130 passed, after the last source edit; typecheck and fixture diff reported by session, unverified]
- **Status**: DONE

### Phase 3: A finished neighborhood stands empty until the city can carry it (move-in gate)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run occupancy (`growth.ts`: `monthStep`, `occupiedOf`) reading Site's assessment (lines 6, 15, 20, 21, 22); mutation signature of arrivals.
- **Entry state**: Phase 2 done.
- **Deliverable**: The gate as ADR-0012 Decisions 3, 4, 7, 8 and 9 settle it (David's interview, 2026-10-15): water, sewage, waste and power are hard (no one moves in without them); no stop keeps no one out (line 6 and 17 break and count); without school seats only the childless share moves in (a new Ledger premise, Mine); a neighborhood nobody lives in is a watch; people never leave, and units restoring a lived-in shortfall take crews first. Arrivals fill admitted neighborhoods up to what they may hold, still in tile order and within 4,800 a year. A Site read (for example a `moveInGate` query next to `needsOf`) that reads the existing checks' facts, with the invariant tested that the gate holds exactly when none of its checks is broken for that neighborhood. Run emits a fact naming what holds a neighborhood empty. Behavior Statement per side-effect function, tests from the scenarios, Integration Reality Statement not needed (no owned subprocess).
- **Exit state**: In the founding scenario no one moves in until the line, plants, reactors and schools are open, then neighborhoods fill at Irvine's pace; the `filling` watch and line-year counts behave as ADR-0012 decided; `pnpm -r test` and `pnpm -r typecheck` green.
- **Demonstration**: `pnpm -r test` and typecheck pass; a Run test replays the layout from `docs/work/tests/city-261015.txt` and prints year-by-year people: 0 while the gate is shut, rising only after it opens.
- **Demonstrated**: 2026-10-16 — `pnpm -r test`: ledger 91, ground 27, site 159 (11 new in `domain/site/test/movein.test.ts`), run 170 (17 new in `domain/run/test/movein.test.ts`, four of them closing mutation-verification's gaps), board 130, all passed; `pnpm -r typecheck` 0 errors; board e2e 10 passed; `git diff --stat` on `domain/{run,site,ledger}/test/fixtures` empty. `movein.test.ts` replays city-261015 year by year: as David placed it (one reactor module, which cannot carry a peak with one down) people are 0 in every year 0 to 20, every neighborhood held back for power; with a second module 0 until the plants open, then the childless share (18,000 from year 7) held back for middle and high seats; with the schools too 0 until the line, both modules and the plants stand, then 30,000; with growth 0 until it opens, then at most 400 a month to full. Thirteen neighborhoods are admitted in tile order up to 60,000; a water unit taken down keeps everyone and its replacement takes a crew ahead of ten stretches. [verified: test event 2026-10-16T14:58:31Z, 91 27 159 170 130 passed, after the last source edit; run 17 movein tests also passed; typecheck, e2e and fixture diff reported by session, unverified]
- **Status**: DONE

### Phase 4: Line 6 says under construction, on the Board and on the live site
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Board wording (ADR-0004); a new fact case on the `stops` check (Run reports mover stretches ordered but not built; Site stays layout-only).
- **Entry state**: Phase 3 done.
- **Deliverable**: A typed fact (for example `stops` case `building` with the count of stretches in hand) from Run/Board plumbing, and `wording.ts` wording it: line 6, when neighborhoods lack a stop but stretches are ordered, reads that the line is under construction (instead of only "Draw the mover line through them"); a neighborhood standing empty is worded as waiting on what it needs. Wording tests, a Board e2e flow, and the Playwright flows run against https://periopolis.city after merge.
- **Exit state**: Board shows "under construction" for line 6 when stretches are in hand and the old text when none are ordered; tests green; published (ADR-0011).
- **Demonstration**: `pnpm --filter @city/board test` and `test:e2e` pass; `BOARD_URL=https://periopolis.city pnpm --filter @city/board test:e2e` passes after the workflow deploys.
- **Demonstrated**: 2026-10-16 — `pnpm -r test`: ledger 91, ground 27, site 159, run 182 (12 new in `domain/run/test/living.test.ts`), board 144 (session, wording and the new `export.test.ts`), all passed; `pnpm -r typecheck` 0 errors; `pnpm --filter @city/board test:e2e` 11 passed; fixtures unchanged. Pushed as fdd89e7; the "Publish the Board" workflow (run 38986911353) built, tested and deployed; `BOARD_URL=https://periopolis.city pnpm --filter @city/board test:e2e` then passed 11 of 11, flow 11 showing a neighborhood standing empty, line 6 reading "The mover line to it is under construction." while its stretch is in hand, and the line holding once it opens. [verified: test event 2026-10-16T21:21:43Z, 91 27 159 182 144 passed, after the last source edit; workflow run and live e2e seen this session]
- **Status**: DONE
