# Session Plan: Money — cost as a derived consequence of the ledger

**Created**: 2026-10-13
**Plan Status**: ACTIVE
**Overall scope**: Brainstorm "Next" item 3. Capital cost to build and yearly cost to run become ledger consequences, derived by the same arithmetic for both columns from new cost premises marked Mine (placeholders David can change). Site and Run then carry the cost of what stands and what is ordered; the Board shows cost rows beside the others. The brainstorm says only "Money" for this item, so this reading is the planner's, to be confirmed by Phase 1's demonstration before anything downstream is touched.
**Bounded contexts touched**: Ledger (`@city/ledger`, Phase 1), Site and Run (Phase 2), Board (Phase 3); docs throughout. Ground is not touched.
**Key domain language**: Premise, Consequence, Column, Capital cost, Running cost (new; per city and per person)

## References consulted
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — domain stays pure; dependencies point inward (Board, Run, Site, Ledger); cost is derived in Ledger and only carried outward.
- `docs/adrs/0002-no-regular-expressions.md` — no regexes anywhere, tests and scripts included; any cost key is walked, never pattern-matched.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — Decision 4 names money as its own plan after the port; Decisions 2 and 3 make the parity suite the first question, so money must add rows and leave all 19 recorded cases and the published figures unchanged.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — the domain emits figures and facts, no sentences; cost wording ("$ per person") is Board wording.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — Ground reads the ledger and never imports Site; it needs no change, but cost rows must not break its plan sums.
- `docs/adrs/0006-the-site-is-a-rectangle-of-hexagonal-tiles.md` — the Site's outline is a rectangle of 115 tiles with parity pinned to hexagon(5); Phase 2 must keep that pin.
- `docs/context/project-profile.md` — documentation standard `always`; no regexes; `pnpm -r test` excludes Playwright flows (run `pnpm --filter @city/board test:e2e`); state replaced, never mutated; seeded randomness only.
- `docs/context/session-20261013-1923-main.md` — Next is item 3, money; no open items or blockers.
- `docs/domain/ledger.md`, `docs/domain/site.md`, `docs/domain/run.md`, `docs/domain/board.md` — Ledger's terms, nine steps and acceptance oracle; consumers of the ledger's figures.
- `docs/brainstorm/future-city/overview.md` — line 227 (item 3 "Money.") and line 248 ("What any of it costs" still unknown).
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Ledger derives capital and running cost for both columns
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Ledger: a new `cost` step after the nine, with cost premises (unit costs, marked Mine) in `premises.ts`/`SHARED` or a sibling `COSTS`, the consequences in `consequences.ts`, and `deriveCarCity`/`deriveWalkingCity` returning cost rows beside the existing ones.
- **Entry state**: ADR-0001 to 0006 in force; `pnpm -r test` green at ledger 41 / site 80 / ground 27 / run 123 / board 101; no cost concept.
- **Deliverable**: ADR-0007 (Kind technical, Scope `domain/ledger`): cost is a derived ledger consequence from Mine premises, one derivation per column, never set; every unit cost is a placeholder David can change; money adds rows and leaves every existing figure unchanged. Capital cost to build, per city and per person: homes, ring buildings, schools, needs (each placed need by count), movers and the sub level, goods pipe, and for the car column parking and roads. Plants (reactor modules, plant units) are not ledger counts (`docs/domain/site.md`: a Site concept, Mine, lines 20 and 22), so their unit costs enter here as premises only and the Site prices them in Phase 2 (plan-review 2026-10-13). Yearly cost to run, per city and per person, from running-cost premises. Unit costs enter as premises only; no figure is hard-coded in the derivation. Tests: each cost row traces to a premise times a ledger count (for example, homes cost equals homes times the unit cost); the two columns use the same function; changing one premise moves exactly the rows that use it; the existing `published.test.ts` and `parity.test.ts` pass untouched (parity compares the old rows only). `docs/domain/ledger.md` gains the terms and the tenth step. Cost placeholders listed in one table so David can confirm or change them.
- **Exit state**: `pnpm -r test` and `pnpm -r typecheck` green; every pre-existing ledger figure identical; cost rows present for both columns at 50,000 people; ADR-0007 written; Site, Run, Board untouched.
- **Demonstration**: Run `pnpm --filter @city/ledger test` and show parity at 0 differences and the published figures unchanged; print the cost rows for both columns at 50,000 (capital and yearly, city and per person) and the placeholder table, so David can confirm the reading before Phase 2.
- **Demonstrated**: `pnpm --filter @city/ledger test` 54 passed (parity 19 cases at 0 differences, published figures unchanged, 13 new cost tests); `pnpm -r test` ledger 54 / site 80 / ground 27 / run 123 / board 101; `pnpm -r typecheck` clean; Site, Run, Board untouched. Cost rows printed for both columns at 50,000 (scratchpad script over the package): to build 12,389 M against 12,345 M dollars (247,770 against 246,906 a person); to run 297 M against 162 M a year (5,941 against 3,237 a person); 21 placeholders listed. Needs and schools are priced inside the floor, not again by count (ADR-0007 Decision 5); plants' unit costs are premises for the Site (Decision 6). ADR-0007 written, ACCEPTED, no open questions. [verified: test event "Tests passed" 54/80/27/123/101, 2026-10-14T01:11:27Z, after last edit 01:11:13Z; typecheck, parity and printed table reported by session, unverified]
- **Status**: DONE

### Phase 2: Site and Run carry the cost of what stands and what is ordered
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site (cost of the tiles built and the layout as it stands, from the walking column's rates) and Run (the spend of an ordered build over the twenty years: capital as homes and buildings finish, running cost by year), in each context's own consequences; Ledger remains the only place a unit cost lives.
- **Entry state**: Phase 1 exit state, with the reading confirmed by the user.
- **Deliverable**: Site reports the capital and yearly running cost of what stands, per tile and for the layout, including the plants that stand (modules and units times the Ledger's unit-cost premises; plan-review 2026-10-13); ADR-0007 names Site and Run as the home of cost-of-what-stands so Phase 2 does not relitigate it (ADR-0005 Decision 2 split the contexts by question); Run reports each year's spend and the twenty-year total as facts (no sentences, ADR-0004). Tests from scenarios: an empty site costs nothing; a finished tile's cost equals the Ledger's per-tile share; Run's spend summed over twenty years equals the cost of what stands plus the running years; seeds and every existing Site and Run scenario and fixture unchanged (Site parity pinned to hexagon(5), ADR-0006).
- **Exit state**: `pnpm -r test` and `pnpm -r typecheck` green; Site parity and Run scenarios at 0 differences; cost facts available to the Board.
- **Demonstration**: Run `pnpm -r test` and show Site and Run parity unchanged and the new cost scenarios passing; print a seeded run's yearly spend and twenty-year total.
- **Demonstrated**: 
- **Status**: PENDING

### Phase 3: The Board shows the cost rows beside the other rows
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board: ledger table rows for capital and yearly cost per city and per person in both columns, the run's spend, and the Board's wording of money (ADR-0004); `docs/domain/board.md`, `docs/domain/site.md`, `docs/domain/run.md`, the overview (item 3 marked done, "what any of it costs" updated), the profile, and the ADR-0003 Decision 4 note.
- **Entry state**: Phase 2 exit state.
- **Deliverable**: Cost rows in the ledger table (existing 14 of 15 lines and every existing row unchanged); the run view shows spend; the six Playwright flows still pass with any new assertions for cost rows; docs describe money and name the placeholders as Mine.
- **Exit state**: `pnpm -r test` and `pnpm --filter @city/board test:e2e` green; the built page shows the cost rows; no stale doc mention.
- **Demonstration**: Build the page and screenshot it with the Playwright browser: cost rows beside the other rows for both columns and the run's spend; run the six flows and show them passing; run `pnpm -r test` once more.
- **Demonstrated**: 
- **Status**: PENDING
