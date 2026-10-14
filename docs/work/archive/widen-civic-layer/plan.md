# Session Plan: Widen the civic layer to the local direct spending it omits

**Created**: 2026-10-14
**Plan Status**: DONE
**Overall scope**: Close open item I-2. The civic layer in `domain/ledger/src/cost.ts` counts schools, police, fire, health, libraries, utilities and goods; US local direct spending also carries general government, welfare and social services, roads and parks operations, corrections and more. Source each missing category in `money.md`, have David decide per row (both columns alike, or differing), add the rows and premises, then rerun the vouching and refresh the Board's record. The finding (civic less schools 4,331 a person under the 5,000 to 7,000 band) is closed by adding services, never by loosening or tuning a test.
**Bounded contexts touched**: Ledger (`@city/ledger`, the cost module, rows and premises); Board (wording for new rows and the recorded figures in `docs/domain/board.md`, `wording.ts`, e2e pins); Site (`domain/site/src/cost.ts` prices civic rows, re-tested and edited only if a new row needs a count); Run re-tested.
**Key domain language**: Premise, Mark (Yours, Sourced with `accepted`, Mine), Layer (civic), Row, Vouching, Band, Column (car city, yours)

## References consulted
- `docs/adrs/0007-cost-is-a-derived-consequence-of-the-ledger.md` — Consequences: a new thing the city pays for is a new row id, a count from the ledger and a unit cost in `COSTS` in one change; the Board words every row and mark (type check fails otherwise); premises are not tuned; published-city figures ($13.4 B to build, $571 M a year, 15,400 / 10,000 a person) are pinned in `cost.test.ts` and recorded in the ADR and must be re-pinned together; Decision 9: new premises need a source and David's acceptance before Sourced-accepted.
- `docs/adrs/0004-domain-emits-facts-adapters-word-them.md` — new row ids are worded in the Board, not in the domain.
- `docs/adrs/0003-parity-port-against-the-sketch.md` — parity stays at 0 differences; new rows add, they move no existing sketch count.
- `docs/adrs/0002-no-regular-expressions.md` — no regexes in any check or script.
- `docs/adrs/0001-typescript-workspace-with-pure-domain-packages.md` — premises stay in the pure Ledger package.
- `docs/adrs/0005-ground-is-its-own-context-over-the-ledger.md` — Ground sits over the Ledger; road and park operations that depend on ground read it, not duplicate it.
- `docs/brainstorm/future-city/money.md` — premise tables, "Rerun at the accepted premises, 2026-10-14" (the finding), vouching bands, lines 24 to 28 (every unit cost has a source or is Mine).
- `docs/context/project-profile.md` — documentation standard `always`; no regexes; `pnpm -r test` excludes Playwright (run `pnpm --filter @city/board test:e2e`).
- `docs/context/session-20261014-0046-main.md` — I-2 filed; I-1 (spend definition as numbered Decision) still the user's call, not in this plan.
- `docs/work/archive/accept-money-premises/plan.md` — phase shape: source first in `money.md`, then decide and code, then vouch and record.
- Product ADRs not consulted (no Scope intersection): none

## Phases

### Phase 1: Source the omitted local-spending categories
- **Tier**: Medium
- **Budget**: ~250 tool calls
- **Domain focus**: Civic layer (Ledger premises not yet in `COSTS`)
- **Entry state**: No active plan; `cost.ts` civic rows are schools, police, fire, health, library, water, sewer, waste, goods runs, electricity, porters; the Urban Institute 11,087 a person (2021) breakdown is the existing source.
- **Deliverable**: A "Civic categories not yet counted" section in `money.md`: every US local direct spending category the layer omits (at least general government and administration, welfare and social services, roads and highways operations, parks and recreation operations, corrections, plus any others the source lists: transit, housing and community development, courts, sanitation overlaps, interest and so on), each with a proposed per-person figure, range, source and year, and a note on overlap with rows already counted (waste, water, health, upkeep) so nothing is counted twice. Per row, a flagged question for David: same in both columns, or different (road operations scale with car infrastructure; the walking city has fewer km of road), and whether the category belongs to a city at all (state Medicaid, interest on debt). Categories with no public benchmark are listed as Mine with the search recorded. No change to `cost.ts`.
- **Exit state**: `money.md` shows the missing categories as sourced proposals with per-column questions, sized so their sum can be compared with the 5,000 to 7,000 band; ledger suite unchanged and green.
- **Demonstration**: Print the new `money.md` section and show every category with a figure and source (or a no-benchmark note) and a column question; run `pnpm --filter @city/ledger test` and show it green with `cost.ts` untouched.
- **Demonstrated**: `money.md` "Civic categories not yet counted" lists 15 categories, each with a figure and source (Urban Institute 2021) or a remainder note, an "already counted?" column and a question for David; it also records that the 5,000-7,000 band does not match its source (local less schools is about 3,500; state and local less schools about 8,760). `git diff --stat -- domain/` empty; `pnpm --filter @city/ledger test` 72 passed, 2026-10-14 04:07 local. [verified]
- **Status**: DONE

### Phase 2: David decides per row; add the rows and premises
- **Tier**: Large
- **Budget**: ~400 tool calls
- **Domain focus**: Civic layer rows and premises in `domain/ledger/src/cost.ts`, Board wording
- **Entry state**: Phase 1 done. Boundary Statement (rule 8a) produced before editing under `domain/**`.
- **Deliverable**: David is shown each proposed category in turn and decides: counted in both columns alike, counted with a per-column difference (a count derived from ledger facts such as road km, green ground or pupils, never a per-column constant), left out with the reason recorded, or stays Mine. Accepted rows land in `cost.ts` as new row ids with premises marked Sourced and `accepted: true` (or Yours), with a Behavior Statement for the pricing; `wording.ts` words each new row; Site and Run price them through `priceCounts` with no unit cost of their own. `cost.test.ts` asserts every premise is Yours or Sourced-accepted (none Mine unless David chose so) and the published-city pins move to the new figures, with the moved rows named; if David keeps any premise Mine, the no-Mine test names that premise as its one exception rather than dropping the check. Board e2e pins ($13.4 B to build, $571 M a year) re-pinned in the same change, so e2e is never red across a commit. ADR-0007 Decision 8 amended (dated 2026-10-14) to name the civic categories accepted, and its Session section updated. `money.md` tables updated.
- **Exit state**: Every added premise carries a mark David chose; type check reports no unworded row; ledger, site, ground, run, board suites and e2e green; parity at 0 differences; no existing test loosened; ADR-0007 Decision 8 lists what the civic layer now holds.
- **Demonstration**: Run `pnpm -r typecheck`, `pnpm -r test` and `pnpm --filter @city/board test:e2e` and show green with parity at 0 differences; print the civic rows for both columns at 50,000 with marks and show the only changed pins are the published-city totals.
- **Demonstrated**: `pnpm -r typecheck` 5 Done; `pnpm -r test` ledger 76 (parity included), site 96, ground 27, run 132, board 110 passed; `pnpm --filter @city/board test:e2e` 6 passed, 2026-10-14. Seven civic rows printed a person, car / yours: welfare 2,597 / 2,597, higher education 938 / 938, administration 443 / 443, corrections 262 / 262, courts 158 / 158, street running 274 / 36, park running 111 / 26; all Sourced 2021, accepted. Only changed pins: running a person 15,422 → 20,205 and 10,029 → 14,489 (`cost.test.ts`), board running $571 M → $794 M (e2e). No Mine premise; no Behavior Statement needed (the pricing is pure, rule 12). [verified]
- **Status**: DONE

### Phase 3: Vouch the wider civic layer and refresh the Board's record
- **Tier**: Small
- **Budget**: ~100 tool calls
- **Domain focus**: Vouching bands (civic less schools 5,000 to 7,000; whole civic 40% to 120% of 11,087) and the Board's documented figures
- **Entry state**: Phase 2 done.
- **Deliverable**: Vouching rerun and appended to `money.md` beside the 2026-10-14 rerun, reporting civic less schools against its band as it falls, whether or not it passes (reported, not tuned; if the whole layer now exceeds 120% of 11,087 that is the finding to record, not a reason to loosen the test). `docs/domain/board.md`, the page's money notes and ADR-0007 Consequences refreshed (e2e pins already moved in Phase 2; confirmed here) to agree with what the code prints. I-2 closed in the session summary.
- **Exit state**: Suites and e2e green; the figures in the Board page, `board.md` and ADR-0007 equal those the code prints; the 4,331 finding has a recorded successor.
- **Demonstration**: Run `pnpm -r test` and `pnpm --filter @city/board test:e2e` and show both green; print the published-city figures and show them equal to those in `board.md` and ADR-0007; print civic less schools a person against the band.
- **Demonstrated**: `pnpm -r test` ledger 76, site 96, ground 27, run 132, board 110 passed; `pnpm --filter @city/board test:e2e` 6 passed, after the last edit, 2026-10-14. The page prints "$13.4 B to build … $794 M a year to run" (e2e pin), equal to `board.md` line 34 and ADR-0007's amended Consequence (13.4 billion, 794 million; 20,200 against 14,500 a person, code 20,205 / 14,489). Printed, car a person: civic less schools 9,114 against the old 5,000-7,000 band (over, recorded); government services 7,069 against the restated 8,760 (81%, gap named); whole civic 11,692, 105% of 11,087, inside the test band. Rerun in `money.md` "Rerun with the civic layer widened". [verified]
- **Status**: DONE
