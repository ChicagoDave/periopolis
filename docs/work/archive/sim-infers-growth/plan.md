# Session Plan: I-7 The sim infers growth — the run orders what the city must build as people arrive

**Created**: 2026-10-19
**Plan Status**: DONE
**Overall scope**: On a run that opts in, the Run itself orders the next neighborhood, plant unit, reactor module, school, fields or stretch as people arrive and homes fill, instead of waiting for the player; the player watches the city grow and intervenes. Needs its own decision (what it may order, from what signal, how it pays, how the player's orders and vetoes sit beside it). Not the pace of growth (ADR-0009 Decision 3) and not the removal of the yearly mode.
**Bounded contexts touched**: Run (domain, primary); Site (read only: `needsOf`, `proposeFor`, `applyProposal`); Board (wording, toggle, pause rule)
**Key domain language**: Need, Proposal, Order, Admission (lived in / held back), Month clock (growth), Emergency, Planned board
**Source**: Issue 7 (David, 2026-10-19), confirmed meaning: the run orders for itself; sequenced after angled-view-through-time (archived, done).

## References consulted
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — needs are read off the assessment, never re-derived; Decision 4 declined the planner placing on its own for the static board; Consequences say self-placing, if wanted later, calls the same accept path (`applyProposal`) and is not a change to the Site; the Board proposes nothing while the clock runs because an order not yet in the layout would be ordered twice.
- `docs/adrs/0009-population-is-occupancy-moved-month-by-month.md` — arrivals capped at 4,800 a year citywide; month clock and yearly mode both stay; parity suite replays yearly mode only; growth is opt-in on the clock; the pace of growth is a premise, not this decision.
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` — crews work by class (emergency, then line/ring/plants/schools, fields, neighborhoods); a neighborhood is admitted on its own conditions; Decision 7: "the Run orders nothing itself" is the stated boundary this plan must amend in a new ADR; mode flag is carried by the clock so stored runs restore.
- `docs/adrs/0013-the-board-runs-the-month-clock-on-its-own.md` — an order that changes the layout pauses the months (Decision 3); one Play is one undo step; the Board's `monthStep` is the single step; its Consequences name issue 7 as its own decision. An inferred order must not trip the pause.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — the Run emits typed facts for inferred orders; the Board words them.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — the sketch's clock and parity suite stay byte-identical; inference is an opt-in mode beside it.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — Run depends on Site alone; Run stays pure and seeded, no DOM or storage.
- `docs/adrs/0002-no-regular-expressions.md` — no regex in code, tests or scripts.
- `docs/adrs/0007-cost-is-a-derived-consequence-of-the-ledger.md` — spend is paid as pieces finish; an inferred order changes when spend falls, never its sum for the same work.
- `docs/context/project-profile.md` — test command `pnpm -r test`, typecheck `pnpm -r typecheck`, Playwright flows separate (`pnpm --filter @city/board test:e2e`); documentation standard `always`; state replaced, never mutated.
- `docs/context/session-20261019-1735-main.md` — Next Steps: plan I-7 through session-plan before implementation; no blockers.
- `docs/adrs/0011-the-board-is-published-on-github-pages.md` — product ADR, Scope apps/board intersects Phase 4; a push to main is a publish, so Board growth work stays local until it should be live (phase commits are local).
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: The Run may order for itself — the decision and its scenarios
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run; decision about the boundary ADR-0008 Decision 4 and ADR-0012 Decision 7 drew
- **Entry state**: No active plan; issue 7 confirmed meaning (the run orders for itself, the player intervenes); Site `needsOf` / `proposeFor` / `applyProposal` exist and are tested
- **Deliverable**: ADR-0015 (Kind technical, Scope domain/run, apps/board) deciding, with David one question at a time where open: what may be ordered (neighborhood, plant unit, reactor module, school, fields, stretch, ring building); the signal (empty homes, citywide arrival pace, broken lines, `needsOf`); when it orders (month or year boundary, how far ahead of arrivals, at most how many jobs in hand); how it pays (spend as pieces finish, ADR-0007; any budget cap); how the player's orders, cancels and `putFirst` sit beside it and how a veto is remembered (a cancelled inferred job is not re-ordered); the opt-in flag. Amends ADR-0008 Decision 4 and ADR-0012 Decision 7 by pointer; amends ADR-0013 Decision 3 and its "any new way to change the layout" consequence, scoping the pause to the player's own moves (plan-review 2026-10-19). Run scenarios added to `docs/domain/run.md` with new terms (Inferred order, Veto) in the glossary
- **Exit state**: ADR-0015 ACCEPTED with no Open Questions (or open questions interviewed to closure); run.md scenarios written, each with a named event or fact; pointers added in ADR-0008, ADR-0012, ADR-0013
- **Demonstration**: Read the ADR and `grep` that every Decision names its signal, its limit and its veto rule; `grep` run.md for each scenario heading; `pnpm -r test` still green (no code moved)
- **Demonstrated**: 2026-10-19 — ADR-0015 ACCEPTED, no Open Questions (three resolved by interview: lead 30 months, no budget, Board control on by default); grep finds the signal ("30 months"), the limit ("no more than one a month") and the veto rule ("A veto is the player cancelling") in the Decisions; run.md carries "The city grows itself" with eleven scenarios and the terms Inferred order, Veto, Lead; amendment notes written in ADR-0008, 0012, 0013; `pnpm -r test` green, 657 tests across 33 files, no code moved. [verified: test event "Tests passed" (post-tool-use), 2026-10-20T04:49:46Z; count 657 across 33 files reported by session]
- **Status**: DONE

### Phase 2: Inferred orders — the Run reads the city's needs and orders them as people arrive
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Run — new `infer` module beside `growth.ts`/`order.ts`; reuses Site `proposeFor` and `applyProposal` through the same `placeOrder` path
- **Entry state**: Phase 1 ADR accepted and scenarios written
- **Deliverable**: `startRun(…, { infer: true })` (carried by the clock so a stored run restores; requires `growth` and `inOrder`); a pure, seeded step that, at the decided boundary, reads the needs of the planned board against occupancy and arrivals and places orders through `placeOrder`; a typed `InferredOrder` fact per order in the month and yearly record; the veto memory (cancelled inferred job not re-ordered); tests from each scenario asserting resulting jobs and layout, the input game unchanged, and that `infer` absent leaves clock, record and parity fixtures byte-identical
- **Exit state**: A run with `infer: true` and one neighborhood grows to the city the signal demands with no player order; `pnpm -r test` and `pnpm -r typecheck` green; parity suite 0 differences
- **Demonstration**: Vitest scenario starting a run from one neighborhood with `infer: true`, ticking 240 months, and asserting the layout and the yearly record show the inferred orders and people; plus the parity suite green with 0 differences
- **Demonstrated**: 2026-10-20 — `domain/run/test/infer.test.ts` "twenty years from one neighborhood" starts a run on one neighborhood with `{ growth, inOrder, infer }`, ticks it to year 20 (240 months) and asserts at least ten neighborhoods standing and 40,000 people, every job the run's, the month rows' `InferredOrder` facts naming each neighborhood, homes covering the people every month, and spend summed over layers equal to summed over years and to what was built; 22 tests in all plus 3 Site tests for `proposeNeighborhood`. `pnpm -r test` green, 682 tests across 35 files, the parity suite 0 differences; `pnpm -r typecheck` clean. Probe: the same run takes 122 ms and reaches 14 neighborhoods, 56,000 people. [verified: test event "Tests passed" (91+27+171+204+189 = 682), 2026-10-20T05:03:32Z, after the last source edit 2026-10-20T05:03:22Z; the 35-file count, parity and typecheck results and the probe are reported by session]
- **Status**: DONE

### Phase 3: The player beside the run — orders, vetoes and money
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Run — player's orders, `cancelJob`, `putFirst` and inferred jobs sharing one work in hand; emergency class; spend
- **Entry state**: Phase 2 done; inferred orders flow through `placeOrder`
- **Deliverable**: Player order and inferred order resolve by the ADR's rule (no double-ordering of the same need; player's order for a need suppresses the inferred one; emergency restoration still first per ADR-0012 Decision 7); veto, pause of inference and any spend cap as decided; spend sums equal the same work ordered by hand (ADR-0007); tests from scenarios, each asserting state and a typed rejection reason where an order is refused
- **Exit state**: A mixed run (player places, run infers, player cancels) behaves per the ADR on every scenario; spend sum equals a hand-ordered run of the same pieces
- **Demonstration**: Vitest scenarios for player-order-first, cancel-then-not-reordered, emergency-first and spend-sum equality, all green under `pnpm --filter @city/run test`
- **Demonstrated**: 2026-10-20 — `domain/run/test/player.test.ts`, 9 tests under `pnpm --filter @city/run test`: the take-down veto (the run's fields taken down are vetoed and never rebuilt there; the player's own water plant taken down is re-ordered), `TileTaken` rejection with the game unchanged, putFirst within class, emergency water ordered the month it breaks and crewed from the year's end, and the replay of the run's 240 months of orders by hand yielding the same jobs, layout, occupancy and spend to the cent. Found and fixed on the way: one order adding two modules to a new reactor brought two sites (pinned by a direct test), and a player's order that cancels one of the run's jobs now vetoes it as `cancelOrder` does; the built list restores and is pinned. `pnpm -r test` green, 691 tests across 36 files; typecheck clean; parity 0 differences. [verified: test event "Tests passed" (91+27+171+213+189 = 691), 2026-10-20T05:40:33Z, after the last source edit 2026-10-20T05:40:17Z; the 36-file count, typecheck and parity results are reported by session]
- **Status**: DONE

### Phase 4: The Board lets the city grow — toggle, wording, and the pause rule
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board (adapter) — wording the Run's `InferredOrder` facts (ADR-0004), the opt-in control, ADR-0013 Decisions 3 and 4
- **Entry state**: Phase 3 done; Run emits inferred-order facts
- **Deliverable**: A "Let the city grow itself" control on the clock card passing `infer: true` to `startRun` (default per the ADR); wording in `wording.ts` for every inferred-order fact (type checker reports a missing case); an inferred order does not pause the months and is one undo step with its Play (ADR-0013); the work-in-hand card marks inferred jobs and offers a veto; storage restores the flag; wording and session tests, and browser flow 15 on the built page
- **Exit state**: On the Board, pressing Play on a one-neighborhood city grows it in view without a player order; a player order still pauses; undo returns to the Play start
- **Demonstration**: `pnpm --filter @city/board test` green; `pnpm --filter @city/board test:e2e` flow showing the built page growing past its first neighborhood under Play, with inferred jobs listed and the player's veto removing one
- **Demonstrated**: 2026-10-20 — `pnpm --filter @city/board test` green (194 tests: wording for `inferredLine`, `inferredCell`, `vetoSaid`, `clockStarted` with the control; autorun: a month step says what the city ordered, saves the orders, the timer plays on, one undo takes the Play and the city's orders back; a run without the control places nothing). `pnpm --filter @city/board test:e2e` 16 flows green, flow 15 "the city grows itself": the control on by default and greyed in the yearly mode; from nothing the first month orders a neighborhood and the second its ring, plants, schools and line with nothing placed by hand, marked "ordered by the city" and in the months' "The city ordered" column; Cancel on the city's water unit says "Vetoed" and removes it; Play at Fast builds the city past zero homes without pausing; the player's own order still pauses; two undos return to where Play was pressed; a reload keeps the months' orders and the control hidden. Flows 10 to 14 uncheck the control for their pinned figures. `pnpm -r test` 696 tests across 36 files; typecheck clean. [verified: test events "Tests passed" (91+27+171+213+194 = 696), 2026-10-20T05:49:45Z, and e2e "16 passed", 2026-10-20T05:52:12Z, both after the last source edit 2026-10-20T05:46:01Z; the 36-file count, typecheck and flow 15 step detail are reported by session]
- **Status**: DONE

### Phase 5: Founding run on the real path — calibrate and record
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Run + Board end to end (Integration Reality: the owned Run and built page, no stubs)
- **Entry state**: Phases 2 to 4 done
- **Deliverable**: A real-path test running David's founding layout (`docs/work/tests/city-261015.txt`) and the one-neighborhood start through the real Run on the month clock for twenty years; a record of where the city ends (people, lines held, line-years) against the same city ordered by hand; any premise or ADR-0015 consequence the run shows wrong is noted in ADR-0015; project profile and `docs/domain/run.md` interface lists updated
- **Exit state**: The twenty-year inferred run is recorded in ADR-0015 Consequences; docs list `infer` in the Run's public interface
- **Demonstration**: The real-path Vitest run and the e2e flow green, with the printed twenty-year record (people, line-years) written into ADR-0015
- **Demonstrated**: 2026-10-20 — `domain/run/test/founding.test.ts`, 7 tests on the real Run, Ledger and Site, twenty years each under `pnpm --filter @city/run test`: David's founding by hand ends at 18,000 people held for seats, 3 lines broken, 46 line-years, 6.82 B to build; growing itself, 48,379 people in 12 neighborhoods, every line held, 0 line-years, 15.31 B, first residents year 7 not 5; one neighborhood (seed 42) 56,349 in 14, 5 line-years named by year (1 ring; 2 and 7 haul; 16 stops, ways); an empty site 53,698 in 13, 3 line-years; homes cover the people every month; a run under a second. The record is written into ADR-0015 Consequences, run.md's scenario and Acceptance, and the project profile's Run commands and plan note. `pnpm -r test` 703 tests across 37 files; typecheck clean; `test:e2e` 16 flows passed (26.8 s). [verified: test event "Tests passed" (91+27+171+220+194 = 703), 2026-10-20T05:56:19Z, after the last edit 2026-10-20T05:55:54Z; the 37-file count, typecheck and test:e2e 16 flows (26.8 s), the figures and timing are reported by session]
- **Status**: DONE
