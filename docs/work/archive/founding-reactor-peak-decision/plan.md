# Session Plan: Resolve issue 5 — founding as placed never fills (one reactor module cannot carry the peak with one down)

**Created**: 2026-10-18
**Plan Status**: DONE
**Overall scope**: David decides what the power condition for moving in means (keep ADR-0012 Decision 3, amend it to firm-with-all-running, or shrink the module), then the sim and the Board are made to say and do exactly that. Sim work only; no outreach.
**Bounded contexts touched**: Site (power check, move-in gate), Run (move-in, held-back facts), Ledger (only under option c), Board (wording of lines 20/21 and the held-back fact)
**Key domain language**: Move-in gate, firm power (peak carried with one module down), held back (for power), Need, Founding

## References consulted
- `docs/adrs/0012-the-clock-builds-in-order-and-people-move-in-when-served.md` — Decision 3 makes power a hard move-in condition "with one module down (lines 20 and 21)"; Decision 5 has the Run record what holds a neighborhood back; Decision 7 makes a module taken down an emergency; Decision 1 keeps the sketch's parity suite byte-identical. Options b and c amend it.
- `docs/adrs/0008-a-layouts-needs-are-a-derived-query-of-the-site.md` — the gate and needs are read off the checks, never recomputed; a changed case shape changes `needsOf` and its wording in the same change; reactor modules are sized for the peak with one down.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — domain stays pure; wording and adapters live under apps/*.
- `docs/adrs/0002-no-regular-expressions.md` — no regular expressions in any code this plan touches.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — the sketch's parity fixtures stay byte-identical; option c (smaller modules) is the one that could move them.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — the domain emits typed facts; the Board words "how many more modules it takes".
- `docs/domain/site.md` — one module makes 77 MW is marked Mine (line 19), so it is David's to change; Need and Facts vocabulary.
- `docs/context/project-profile.md` — workspace layout and test conventions.
- `docs/context/session-20261017-2246-main.md` — issue 5 is the one short-term open item.
- `docs/objectives/sustainable-city-shown.md` — only O-1 is live; this plan serves it by making the founding fill.
- Product ADRs not consulted (no Scope intersection): none (no product ADRs exist)

## Phases

### Phase 1: Decide the power condition for moving in (ADR-0012 Decision 3)
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Run / Site — the move-in gate's power case and what "carries the peak" means for people moving in
- **Entry state**: David has been put the choice with the figures: his founding orders 6 neighborhoods (30,000 people) and one module; peak 1.5 kW a person is 45 MW; a module makes 77 MW; the check needs ceil(45/77)+1 = 2, so one module is 0 MW firm and nobody moves in for twenty years. Options: (a) keep Decision 3 — the founding is the player's error, work is at most Board wording of how many more modules it takes plus the fixture ordering two; (b) amend Decision 3 — the gate needs modules x 77 MW to carry the peak with all running, the one-down margin stays lines 20/21's standard and shows broken, a module taken down is the Decision 7 emergency; (c) change the premise — smaller modules (Mine, `docs/domain/site.md` line 19) so two are not a 3x overbuild, touching Ledger rates and possibly parity fixtures. David has chosen one. Do not choose for him.
- **Deliverable**: For (b) or (c): an amendment to `docs/adrs/0012-*.md` Decision 3 (and its Consequences, and `docs/domain/site.md` / `docs/domain/run.md` where they state the rule), with any Open Questions left in the ADR. For (a): a closing note on issue 5 recording the decision, and a list of the Board wording work for Phase 2. Phase 2 below is rewritten to the chosen branch.
- **Exit state**: The rule is written down in the domain docs and ADR (or the issue note) in words a test can assert; Phase 2's scope is fixed to one branch.
- **Demonstration**: `grep` of the amended ADR-0012 Decision 3 (or the issue 5 note) shows the chosen rule, and the stated outcome for David's founding is written beside it (fills by year 20 or not; the line 20/21 and held-back wording expected).
- **Demonstrated**: 2026-10-18 — `grep -c -i "amended 2026-10-18" docs/adrs/0012-*.md docs/domain/site.md docs/domain/run.md` shows the amended Decision 3 and the two domain docs stating it; the Consequences entry added 2026-10-18 states the founding's expected outcome (empty until the plants and module open, then the childless share held for seats, lines 20/21 broken with "It takes 2"); Phase 2 below is rewritten to option (b). [reported by session, unverified]
- **Status**: DONE

### Phase 2: Make the sim and the Board speak the chosen rule
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Option (b), chosen 2026-10-18. Site: the `power` check gains a `noSpare` case (bad, lines 20/21) between `short` and `carries`; `moveInGate` lacks power on `idle` and `short` only (still read off the check, ADR-0008); `needsOf` asks for modules on both broken cases. Run: the held-back fact is unchanged in shape (`short: ['power']`), only when it fires. Board: wording for the `noSpare` facts on lines 20/21.
- **Entry state**: Phase 1 done; the chosen branch is recorded; the existing suite is green (`domain/run/test/movein.test.ts` and `order.test.ts` currently assert one module means nobody moves in for twenty years).
- **Deliverable**: Behavior Statement and tests from the Phase 1 scenarios: the founding of 2026-10-15 (`docs/work/tests/city-261015.txt`) replayed in `domain/run/test`; the `movein.test.ts` power scenario updated to the chosen rule (as placed, one module admits the childless share once it and the plants open, held back for seats; lines 20/21 `noSpare` and counted; with no module nobody moves in); the Site check case/facts and `needsOf` kept consistent (`needs.test.ts`); Board wording for lines 20/21 and the held-back fact; parity suite byte-identical (the sketch's city never meets `noSpare`).
- **Exit state**: Whole workspace test run green, parity suite byte-identical; the founding's behaviour matches what Phase 1 wrote down.
- **Demonstration**: Replay David's founding through the Run with in-order mode on and print, for years 1 to 20, the people moved in per neighborhood, the `power` check status and facts for lines 20/21, and the Board text of the held-back reason; it must show the outcome Phase 1 stated in ADR-0012: empty until the plants and the module open, then 18,000 childless held for seats, lines 20/21 broken with "It takes 2". Then run the full test command and see it green.
- **Demonstrated**: 2026-10-18 — David's founding replayed through the Run with `inOrder` (a throwaway vitest file, output kept at the session's scratchpad `founding-demo.txt`): years 1-4 nobody and no module (`idle`); year 5 the plants and the one module open and 18,000 move in, 3,000 in each of the six neighborhoods, held "only households with no school-age children, waiting for middle-school and high-school seats"; from year 5 the power check is bad with "1 module carries a peak of 27 MW only while it runs. With it down for fuel the city has no power. It takes 2." and `power` is in the year's broken lines through year 20; the city never fills (seats, by the founding's own schools). `pnpm -r test`: 91, 27, 164, 182, 145 passed (609); `pnpm -r typecheck` clean; the site and run parity suites unchanged. [verified: test event "Tests passed" 91 27 164 182 145, 2026-10-18T22:24:22Z, after the last source/test edit 22:24:04Z; the demo replay itself is session-reported, unverified]
- **Status**: DONE
