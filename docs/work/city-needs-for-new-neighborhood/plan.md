# Session Plan: When a neighborhood is added, the city works out what else it needs

**Created**: 2026-10-14
**Plan Status**: ACTIVE
**Overall scope**: Given a layout, the Site derives what the city now lacks to keep the 15 lines whole (school seats, ring room, reactor modules, plant units, mover line reach, playing fields) and where each addition could go; the Board shows it and, per the open decision below, lets David accept it. Includes a city sized to its people (the opening 50,000 city's ring, reactors and plants).
**Bounded contexts touched**: Site (needs and placement, new commands/events/facts), Ledger (only if a sizing figure is missing; added there first), Board (wording, panel, click-through). Not Run, not Ground.
**Key domain language**: Need (what the layout lacks, typed fact), Proposal (a need with a chosen tile, not yet built), Neighborhood, Ring, Plant, Stretch, Line check, Facts.

## Design decision (decided 2026-10-14, session 51a736: David chose **propose, accept in one click**)

How does the city act on a need?
- **Auto-place**: placing a neighborhood also places what it needs. Fastest, but it rewrites the player's layout, changes what a click means, and departs from the sketch on every placement.
- **Propose, accept in one click (recommended)**: placing a neighborhood changes nothing else. The Site derives the needs and a proposed tile for each; the Board lists them ("Needs for this neighborhood") and offers "Add" per need and "Add all". The layout only changes on acceptance, through the existing commands (`addRingBuilding`, `addPlantUnit`, `toggleExtra`, `layStretch`), so each emits its own event as now.
- **List only**: derive the needs, never place. Cheapest, but this is what the line checks already do after the fact ("Run the mover line to the tiles marked"); it adds quantities but not the leap.

Why propose: the Site stays a pure function of the layout (ADR-0004: needs are facts the Board words), the player keeps the say over where things go, and parity holds by construction (ADR-0003): nothing is applied unless accepted, the sketch's paths and `starterLayout` are untouched, and every existing command behaves as before. Auto-place can later be a Board setting, off by default, calling the same accept path. Phase 1 does not depend on the choice; Phase 3 does.

## References consulted
- `docs/adrs/0003-parity-port-against-the-sketch.md` — figures and rules are frozen against the sketch; any new behavior must leave the parity suite green (needs are additive and apply nothing unaccepted).
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — a need is a typed fact shape; adding a case adds its wording in the Board in the same change; the type checker reports an unworded case.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — a figure the Site needs that the Ledger does not derive is added to the Ledger first, not computed from premises in the Site.
- `docs/adrs/0006-the-site-is-a-rectangle-of-hexagonal-tiles.md` — placement proposals use the 115-tile rectangle outline (`onBoard`, `neighbors`), not the hexagon; refusal tiles lie outside the rectangle.
- `docs/adrs/0007-cost-is-a-derived-consequence-of-the-ledger.md` — cost is derived; a new thing the city builds is a new row id and unit cost in the Ledger; a proposal's price goes through `costOf`/`priceCounts`, with no unit cost of its own. The right-sizing phase moves pinned cost figures, which are re-pinned as the ADR already does by amendment.
- `docs/context/project-profile.md` — pure TypeScript domain packages, Vitest, Playwright flows for the Board (`test:e2e` not in `pnpm -r test`); Site depends on Ledger alone; the Board holds no rules.
- `docs/context/session-20261014-0348-main.md` — latest session closed widen-civic-layer; no open blockers carried into this goal.
- Product ADRs not consulted (no Scope intersection): none (the repo has no product ADRs)

## Phases

### Phase 1: Needs of a layout, as typed facts
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site. A new `needsOf(layout, rates)` query: for each line, the shortfall in units (ring buildings for the people's offices, reactor modules to carry the peak with one down, water/sewage/waste units, school seats by grade, playing fields, stops/stretches for unreached tiles). Quantities only, no tiles yet.
- **Entry state**: Plan approved; the open decision may remain open. Suite green on main.
- **Deliverable**: Scenarios in `docs/domain/site.md` (Need, Proposal in the terms table; "adding a neighborhood to a whole city" and "to an empty site"); `domain/site/src/needs.ts` with `Need` fact shapes (header comments, one reason to change), derived from the same arithmetic the checks use (shared helpers extracted from `assess.ts`, not a second copy); the Board's wording entry for every Need case in the same change (ADR-0004 Consequences; the type checker proves coverage); an ADR "A neighborhood's needs are a derived query of the Site" (Kind technical, Scope domain/site, apps/board) recording the decision (propose, accept in one click); tests from the scenarios, including: a whole starter layout has no needs; adding one neighborhood yields exactly the needs the checks go bad on, and no more; meeting every need leaves no line broken for lack of a built thing, with the tally back at 14 of 15, 1 to watch (the size line waits on people, ADR-0006 Consequences), checked here by building quantities on a scratch layout in the test.
- **Exit state**: `needsOf` exported from `@city/site`; the invariant "needs empty iff no line is broken for lack of a built thing" is a test; parity suite and `pnpm -r typecheck` green.
- **Demonstration**: `pnpm --filter @city/site test` green, including a test that places an 11th neighborhood on the starter layout and prints the resulting Need facts, and a test that the starter layout's needs are empty.
- **Demonstrated**: 2026-10-14, session 51a736: `pnpm -r test` green (ledger 76, site 105, ground 27, run 132, board 112) and `pnpm -r typecheck` clean. `needs.test.ts` asserts the starter and an empty site need nothing; an 11th neighborhood at `2,0` needs only `{ need: 'line', reach: ['2,0'], answers: ['stops','ways'] }`; thirteen need ring +1, a unit at each plant, two schools, fields and the line; built by hand they leave 14 ok, size on watch, none broken; the needs answer exactly the broken `NEED_CHECKS` on six layouts. Built by reading `assessCore`'s checks rather than extracting helpers (ADR-0008 Decision 2), so `assess.ts` and the parity suite are untouched. [reported by session, unverified]
- **Status**: DONE

### Phase 2: Where each need goes (Proposal)
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Site. `proposeFor(layout, rates)` turns needs into Proposals with a tile: ring buildings on the ring tile with room or the nearest open tile; plants on edge tiles; schools and fields on the neighborhood that lacks them nearest the demand; mover line as the shortest run of stretches to unreached tiles through existing stops. Deterministic (ties broken by tile key), applies nothing.
- **Entry state**: Phase 1 done: `needsOf` exported.
- **Deliverable**: `domain/site/src/propose.ts`; Proposal fact shapes carrying need, tile and the commands that would carry it out; each proposal's price through `costOf`; tests from scenarios (proposal tiles are on the board, open or the right kind, and applying all proposals via the existing commands brings every check to ok; proposals for an already-whole layout are empty; a full board yields a "no room" fact rather than an invalid tile).
- **Exit state**: `proposeFor` exported; applying its proposals in order through the existing commands never rejects; existing command behavior and parity untouched.
- **Demonstration**: a test that starts from the starter layout, adds a neighborhood, applies every proposal through the existing commands, and asserts `assess` reports no line broken (14 of 15, 1 to watch: the size line waits on people); suite green.
- **Demonstrated**: 2026-10-14, session 51a736: `pnpm -r test` green (ledger 76, site 122, ground 27, run 132, board 112), `pnpm -r typecheck` clean. `propose.test.ts`: the starter is proposed nothing; an 11th neighborhood at `2,0` is proposed one stretch `2,0|3,-1` (about 39 M to build); thirteen are proposed ring +1, a unit at each plant, two schools, fields and three stretches; on five layouts every step is on the board and on open ground or its own kind, and accepting all through `applyProposal` leaves `assess` with no line broken (size on watch; `work` on watch where a mover runs past the walk); a full board yields `{ room: false }` for the ring. [verified: site test row "6 passed 122 passed" 2026-10-15T00:18:25Z, after the last source edit; ledger/ground/run/board counts and typecheck reported by session, unverified]
- **Status**: DONE

### Phase 3: The Board offers the additions
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Board (adapter). Words each Need and Proposal (ADR-0004), shows "Needs for this layout" with the price, previews proposed tiles on the map, "Add" per proposal and "Add all", each going through the existing commands so the existing events and undo path apply. Built as decided in the open decision (if auto-place is chosen: a Board setting, off by default, that calls the same accept path).
- **Entry state**: Phase 2 done; decision made (propose, accept in one click).
- **Deliverable**: wording entries for every Proposal case (Need wording landed in Phase 1; type checker proves coverage), panel and preview in `src/draw/*`/`page.ts`, Playwright flow: place a neighborhood, see the needs, add all, see the broken lines go ok and the tally return to 14 of 15, 1 to watch; wording and session tests.
- **Exit state**: placing a neighborhood on the Board leads to a visible, acceptable list of what it needs; without accepting, the layout is exactly what the player drew.
- **Demonstration**: `pnpm --filter @city/board test:e2e` green with the new flow; the built `dist/index.html` opened shows the panel after placing a neighborhood.
- **Demonstrated**: 2026-10-14, session 51a736: `pnpm --filter @city/board test:e2e` 7 passed on the built `dist/index.html`, including the new flow: the starter's card says it needs nothing; a neighborhood at `2,0` shows one line, Show marks it, Add builds it and the tally returns to "14 of 15 hold, 1 to watch"; two more show 8 additions, Add all builds them back to 14 of 15, and Undo brings the 8 back. `pnpm -r test` green (ledger 76, site 122, ground 27, run 132, board 121), typecheck clean. Screenshots of the card in the running app checked by eye; a saving is worded "less" (a high school nearer home cuts rides). [verified: test row "76 passed 122 passed 27 passed 132 passed 121 passed 7 passed" 2026-10-15T00:24:39Z, after the last source edit (00:21:01Z); typecheck and screenshots reported by session, unverified]
- **Status**: DONE

### Phase 4: A city sized to its people
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Ledger/Site/Money. Today the opening city's ring (8 buildings, room for 62,170), 3 reactor modules and plants are sized independent of population (build cost about 267 thousand a person against the car city's 262). Size them from the people with the same arithmetic the needs use, and show the effect on the per-person build figure.
- **Entry state**: Phase 1 done (the arithmetic exists); Phases 2 and 3 not required. ADR-0003 consideration: `starterLayout` is the sketch's layout and stays as is. The right-sized opening city is a separate, additional layout offered alongside it (or the starter is amended by an explicit ADR decision if David prefers), so parity needs no waiver.
- **Deliverable**: a sized layout built from `needsOf` (starter plus accepted needs, trimmed to the minimum), tests that it breaks no line and costs less per person than the 50,000 starter, ADR-0007 consequence amended with the new pinned figures, the Board offering it as an opening choice if David wants that.
- **Exit state**: the per-person build cost of the sized city is pinned in `cost.test.ts` and documented; the parity suite on `starterLayout` unchanged.
- **Demonstration**: `pnpm -r test` green; a test printing build cost per person for starter and sized layouts, with the sized one lower and no line broken.
- **Demonstrated**: 2026-10-14, session 51a736: `pnpm -r test` green (ledger 76, site 130, ground 27, run 132, board 121), typecheck clean, `test:e2e` 8 passed. `sizedLayout` (new `domain/site/src/sized.ts`, trimming through `erase` while `needsOf` stays empty and no held line breaks) keeps 7 of 8 ring buildings and 2 of 3 reactor modules, same statuses as the starter (14 ok, size on watch), one fewer of either breaks a line. Pinned in the Site's `cost.test.ts`: build 243,852 a person against the starter's 267,052 and the car city's 261,845; run 15,408 against 15,872. The parity suite and `starterLayout` are unchanged; the Board offers "Load it sized to its people" (flow: $12.2 B to build, 14 of 15, Undo back to $13.4 B). ADR-0007 Consequences amended. [verified: test row "76 passed 130 passed 27 passed 132 passed 121 passed" 2026-10-15T00:34:51Z, after the last source edit (00:34:25Z); typecheck and test:e2e 8 passed reported by session, unverified]
- **Status**: DONE
