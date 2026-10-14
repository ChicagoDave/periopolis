# Session Plan: Accept the money premises

**Created**: 2026-10-14
**Plan Status**: ACTIVE
**Overall scope**: Walk every unit cost in `domain/ledger/src/cost.ts` from a placeholder to a figure David owns. Research the open Mine premises first so David sees sourced proposals, then review the premises one layer at a time (accept to Yours, change, or stay Mine), record each outcome with its mark and source in the cost module, and rerun the vouching and parity checks. Who pays stays out of scope (money.md "Who pays"). The prior money plan is archived at `docs/work/archive/money/plan.md`.
**Bounded contexts touched**: Ledger (`@city/ledger`, the cost module); Board (recorded figures in `docs/domain/board.md` only, no code change expected); Site and Run read `COSTS` and are re-tested, not edited.
**Key domain language**: Premise, Mark (Yours, Sourced, Mine), Layer (groundworks, buildings, fleet, upkeep, civic services, households), Land, Financing, Bracket, Vouching

## References consulted
- `docs/adrs/0007-cost-is-a-derived-consequence-of-the-ledger.md` — the cost module is the only home of a unit cost; every premise carries a mark; premises are not tuned; a changed placeholder moves exactly the rows that use it, and the published-city figures are pinned in `cost.test.ts` and must be re-pinned with the change.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — parity against the sketch stays at 0 differences; money adds rows and moves no existing count.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — marks and layer names are Board wording; the domain emits the mark, not sentences.
- `docs/adrs/0002-no-regular-expressions.md` — no regexes in any check or script written for this work.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — premises stay in the pure Ledger package; consumers read them.
- `docs/brainstorm/future-city/money.md` — the premise tables (Was/Proposed/Mark/Source), the vouching bands, line 26 (every unit cost has a public source or is Mine), the bracket and sub-level decisions already Yours, and the open questions this plan closes.
- `docs/brainstorm/future-city/overview.md` — lines 20 to 22 owe citations for the per-person counts of electricity, water, sewage and waste.
- `docs/context/project-profile.md` — documentation standard `always`; no regexes; `pnpm -r test` excludes Playwright flows (run `pnpm --filter @city/board test:e2e`).
- `docs/context/session-20261013-2256-main.md` — the money plan is DONE; premises remain placeholders until accepted; carried open item: promote the spend definition to a numbered ADR-0007 Decision (user's call, not part of this plan unless David raises it).
- `docs/work/archive/money/plan.md` — phase shape the previous work used (derive, vouch, then show).
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Source the open Mine premises
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Ledger premises still marked Mine, plus the old or weakly sourced ones
- **Entry state**: No plan active; `money.md` "Sources for the unit costs" lists the premises with Mine marks; `cost.ts` unchanged since the money plan.
- **Deliverable**: For each open Mine premise named in the goal (mover line as a built floor with track and systems; water and sewer rates; per-person counts of electricity, water, sewage and waste for overview lines 20 to 22; vehicle life; stops; entries; goods pipe; dumbwaiters; goods runs; porters; financing term; ground where vehicles wait) a researched proposal in `money.md`: figure, range, source and year, or an explicit "no public benchmark found" with the search done. Also flag Land (2010 data) as Sourced, old. Premises with no source stay Mine and say why. No change to `cost.ts` yet.
- **Exit state**: `money.md` carries a proposed figure and a source or a no-benchmark note for every open Mine premise, so Phases 2 and 3 review sourced proposals, not bare placeholders.
- **Demonstration**: Print the premise table from `money.md` and show every formerly Mine row with either a source link and year or a recorded "no benchmark" note; run `pnpm --filter @city/ledger test` and show it unchanged and green.
- **Demonstrated**: `money.md` gained "Sources found 2026-10-14": 20 rows, every formerly Mine premise with a proposal. 17 carry a source and year (6 plain Sourced, 4 bracketed, 5 derived, 1 weak, 1 analog); 3 stay Mine with the search recorded (mover-line floor width, your city's water a person, the goods run, each with its nearest analog). Land re-checked, no national figure newer than 2010, stays Sourced old. Figures that moved: waiting ground 150 to 250, mover track 25 M to 12 M a km, stop 10 M to 3 M, entry 1 M to 300,000, pipe 2 M to 1 M, dumbwaiter 15,000 to 10,000, vehicle life 12 to 17, porter 60,000 to 54,000, water 7 to 6, sewer 10 to 9, electricity 7,500 to 8,600 kWh, waste 0.72 to 0.89 t. Unchanged: widths, goods run, water 138 and 116, sewage 100, land, term 30. Open Questions restated; the plan-review tension (how an accepted Sourced figure keeps its source) recorded for Phase 2. `pnpm --filter @city/ledger test` 64 passed, `cost.ts` untouched. [verified: test run 2026-10-14 01:00:35 local, 3 files 64 tests; table printed from money.md in session]
- **Status**: DONE

### Phase 2: Review and record the build layers (groundworks, buildings, fleet)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Capital layers: floors, streets, parks, ground where vehicles wait, mover line, stops, entries, goods pipe, dumbwaiters, bike lane, reactor module, plant unit, car, mover
- **Entry state**: Phase 1 done; proposals sourced in `money.md`.
- **Deliverable**: David is shown each build premise in turn, layer by layer (groundworks, then buildings, then fleet), with Was, Proposed, range and source, and decides accepted (Yours), changed (new figure, mark says whose) or stays Mine. Each outcome is recorded in `domain/ledger/src/cost.ts` with its mark and source, `money.md` tables updated, and `cost.test.ts` published-city pins re-pinned for the moved build figures.
- **Exit state**: Every build-layer premise carries a mark David chose; the ledger suite is green with the new pins; ADR-0007 untouched unless a decision changed.
- **Demonstration**: Run `pnpm --filter @city/ledger test` and show green with parity at 0 differences; print the build-layer rows for both columns at 50,000 with their marks.
- **Demonstrated**: Every premise of the build layers carries a mark David chose: groundworks accepted as proposed (mover-line floor width Yours, eleven Sourced accepted; waiting ground 250, mover track 12 M a km, stop 3 M, entry 300,000, pipe 1 M), then buildings and fleet accepted (dumbwaiter 10,000; mover 30,000 after David ruled out robotaxis for cart-class pods on a guideway). Acceptance is an `accepted` flag on a Sourced mark, so an accepted figure keeps its source (ADR-0007 Decision 9 amended; Board words "Sourced 2024, accepted"). Published city a person: car 261,845 / 15,004 / 13,282, yours 198,319 / 10,131 / 11,884 (to build / to run / financing), re-pinned in `cost.test.ts`. Build-layer rows printed for both columns at 50,000, 19 rows, every one Sourced-accepted. `pnpm -r test` ledger 66 / site 96 / ground 27 / run 132 / board 110 (parity suites green), `pnpm -r typecheck` clean, Board e2e 6 passed ($13.4 B to build, $578 M a year). [verified: clean rerun after the last edit (07:47:39Z), finished 2026-10-14T07:49:36Z: typecheck 5 Done, tests 66/96/27/132/110 passed, e2e 6 passed]
- **Status**: DONE

### Phase 3: Review and record the run layers, counts, land and financing
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Running layers (upkeep, civic services, households), the per-person counts, Land and Financing
- **Entry state**: Phase 2 done.
- **Deliverable**: Same review, one layer at a time: upkeep (share, vehicle life), households (running a car, running a mover; the mover's 0.60 a km is a robotaxi figure and is re-sourced for a cart-class pod on a guideway first, per David 2026-10-14 in Phase 2), civic services (goods run, porter, pupil, police, fire, health, library, electricity, water, sewer, waste), the civic counts (electricity, water, sewage, waste per person), then Land and Financing rate and term. Outcomes recorded in `cost.ts` with marks; `money.md` updated; `overview.md` lines 20 to 22 cite the accepted counts (or state they stay Mine); ADR-0007 amended (Consequences, citations owed) if a decision changes; pins re-pinned.
- **Exit state**: Every premise in `COSTS`, the civic counts, Land and Financing carries a mark David chose; the citations owed are cited or declared Mine; money.md Open Questions closed or restated.
- **Demonstration**: Run `pnpm --filter @city/ledger test` and show green with parity at 0 differences; print the full premise list with marks and the six-layer table for both columns at 50,000.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 4: Vouch the accepted figures and refresh the Board's record
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Vouching bands (US stock of structures, schools, getting around, civic) and the Board's documented figures
- **Entry state**: Phase 3 done; all premises marked.
- **Deliverable**: Vouching checks rerun against the accepted premises (stock per person, pupils share, getting-around, civic band) and the result noted in `money.md` Vouching; full `pnpm -r test` and the Board e2e flows run; `docs/domain/board.md` and ADR-0007's pinned published-city figures refreshed to the accepted numbers.
- **Exit state**: Suites green; recorded figures in `board.md` and ADR-0007 match what the code prints; no premise left unreviewed.
- **Demonstration**: Run `pnpm -r test` and `pnpm --filter @city/board test:e2e` and show both green; print the published-city figures and show them equal to those recorded in `board.md` and ADR-0007.
- **Demonstrated**: 
- **Status**: PENDING
