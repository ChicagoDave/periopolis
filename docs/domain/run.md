# Run

**Purpose.** Twenty years on the clock. Crews turn orders into buildings over years, people move in as their homes are finished (or, on a run with growth, month by month at the citywide pace, ADR-0009), and the stretches line 18 allows for happen to the city on a timeline dealt at the start of a run. Each year the city is checked as it stands, and every broken line counts one line-year against the run.

**Package.** `@city/run` (`domain/run`). Pure and deterministic; depends on `@city/site` alone. The one random source is a seeded generator, so a run replays from its seed. Public interface: `startRun`, `stopRun`, `tick`, `tickMonth`, the month clock (`growthOn`, `monthStep`, `occupiedOf`, `homesOf`), `placeOrder`, `cancelJob`, `putFirst`, `inHand`, `notices`, `stressAt`, `restoreClock`, `totalSpend`, and the rules.

**Consumers.** The Board shows the clock card, the work in hand and the notices, and turns clicks into orders.

## Terms

| Term | Meaning | Whose word |
|---|---|---|
| Game | What stands and the clock, or no clock when the board is a plain plan. A value. | Mine |
| Clock | The year, the work in hand, the events dealt, the record, and the line-years so far. | Mine |
| Run | Twenty years on the clock, from a seed. | Mine |
| Crew | One of ten. A crew does one job at a time and is whatever it takes to finish a neighborhood in two years. | Mine |
| Job | An order that takes years to become a piece: what, where, years left, years in all. Jobs are worked in the order they stand; the first ten with work left have a crew. With `inOrder` (ADR-0012), which the Board always starts, they are taken class by class first: emergencies, then the line, ring, plants and schools, then fields, then neighborhoods. | Mine |
| Piece | Anything a crew builds: a neighborhood (2 years), a ring building (2), an elementary or middle school (1), a high school (2), fields (1), a stretch of line (1), a module (1, or 3 with its site), a plant unit (2). | Mine |
| Planned board | The layout as it will stand when the work in hand is done. Orders are made on it. | Mine |
| Order | A layout command applied to the planned board. What came is ordered as jobs; what went is canceled from the work in hand, the latest first, or taken down if it already stands. | Mine |
| Ready | A finished job waiting for the place it stands in: a school for its neighborhood, a further module for its site. It takes no crew while it waits. | Mine |
| Event | One of five things that happen in a run, each announced ahead: a housing squeeze (20% more people, 3 years), a closure (one stretch of line, 1 year), a wave of young families (20% more children, 13 years, moving up a grade a year), a second closure, a slump (20% fewer people, 4 years). | Mine |
| Notice | What the player is told about an event: happening now, or announced for soon. Typed; the Board words it. | Mine |
| Stress | The events running in a year, as the stress the Site checks the layout under. | Mine |
| Record | One row a year: people, homes, lines held, watched and broken, which broke, what opened, what stands costs, and what the year spent. | Mine |
| Growth | The month clock on a run started with `{ growth: true }` (ADR-0009): the month of the year, the people living in each neighborhood, and every month recorded. Without it the clock is the sketch's, and homes fill the year they finish. | Yours (2026-10-14) |
| Month | One twelfth of a year on a run with growth. The city's people change by the Ledger's `monthOf`; births, deaths and leavers fall on each neighborhood by its share of the people, and arrivals fill empty homes in the board's tile order, at most 400 a month. Crews still work by the year: their work opens at the twelfth month, the new neighborhoods empty, and the year is recorded under the people living there. A month's spend is a twelfth of its running bill; the twelfth month carries the year's change in what stands. | Yours (2026-10-14) |
| Line-year | One line broken for one year, summed over years 1 on. Year 0 is noted and does not count. | Mine |
| Standing | What stands costs at the end of a year, by layer, from the Site's cost of what stands under that year's stress: the three built layers as the capital standing, the three yearly ones as the year's bill. | Mine |
| Spend | The year's outlay by layer (ADR-0007 Decisions 6 and 14). To build is paid as things finish: a built layer's spend is what stands at the end of the year less what stood a year before, so a piece taken down, or a fleet that shrinks with the people, comes off that year's spend. To run is paid every year: a yearly layer's spend is the year's bill. Year 0 spends nothing; what already stood was paid before the clock started. `totalSpend` sums the record by layer, by year and in all, years 1 on. | Yours |

## The year

1. The first ten jobs with work left each lose a year.
2. Finished jobs open on the layout, neighborhoods before what stands in them. A school whose neighborhood is not there yet, or a module whose site is not, stays ready.
3. A closure announced this year picks its stretch: one of the closable stretches, from the seed and the event's id. With no line there is nothing to close and no notice.
4. The city is checked under this year's stress. The row goes in the record and its broken lines into the line-years.
5. What stands is priced under the same stress; the row carries the standing by layer and the year's spend against the row before.

The squeeze is over before the wave arrives, so no two events push the same line past the band. That is what makes the promise hold.

## The promise

Each event is one of the four stretch tests come true. A city where every line holds and all four stretch tests hold cannot be broken by anything the clock deals. The ledger's city with twelve more stretches, so every stop has a second way, is left alone for twenty years on 25 timelines and loses 0 line-years. On spokes it loses 3 or 4, all in closure years.

## Scenarios

- **Mechanics**: a reactor's first module takes three years with its site and the second one year; a school ordered on a building site waits for its homes and opens with them; twelve one-year jobs on ten crews leave two waiting until one is put first; ordering a finished stretch again takes it down and ordering one in hand cancels it; canceling a reactor site drops its later module instead; canceling a neighborhood drops its schools; stopping the clock finishes the work in hand at once.
- **Founding 100,000 from nothing**: everything else ordered ahead of the homes, 151 crew-years in all. Left to run, 3 line-years; with a bypass laid when each closure is announced, 0 or 1. Homes for 100,000 by year 20 on every seed tried.
- **What a founding spends**: from an empty site, the spend summed over twenty years is the cost of what stands at year 20 plus the running bills of years 1 to 20; summed over layers it equals summed over years. A stretch finishes in a year and is paid before the neighborhood's floor; no mover is bought until someone rides; a stretch taken down comes off that year's groundworks. Seed 42, a ring, a reactor and four neighborhoods on spokes ordered at year 0: 4.9 billion to build and 4.1 to run over twenty years, 9.1 in all.

- **The sized city founded from nothing, with growth** (seed 42): every piece ordered at year 0. Neighborhoods open from year 2; from year 3 people arrive at the full 4,800 a year, Irvine's pace, and the city grows by 2,600 to 4,700 a year net of leavers; it is full, 50,000, in year 16, after which 2,175 a year leave and as many arrive. While a neighborhood fills it is too empty to keep its daily list; that is a watch, not a broken line, so filling counts no line-years (David, 2026-10-14). By year 20 no line is broken. With the homes full, twelve months of running spend equal the year's to the cent.
- **Built in order, people when served** (ADR-0012, `inOrder`; from `docs/work/tests/city-261015.txt`). Given an empty site and, ordered at year 0 in this order, six neighborhoods round a ring building with three elementary schools and two sets of fields, then the mover line through all six, a reactor, and a water, a sewage and a waste unit:
  - When the clock runs, then the stretches, the ring, the reactor and the plant units have crews before any neighborhood, and the neighborhoods are worked last, in the order they were placed.
  - When a neighborhood is finished but its water, sewage, waste or power is not open for its people, then it holds nobody, the clock says what it lacks, and its own breaks are a watch that counts no line-years.
  - When the plants and the reactor carry it but it has no stop on a finished line to the ring, then everyone may move in; line 6 and line 17 are broken and count; while its stretches are in hand, line 6 says the line to it is under construction.
  - When the plants and the reactor carry it but its pupils have no seats within a 30-minute walk, then only the childless share moves in, with no pupils, and the clock says it lacks school seats; when its seats open, it fills.
  - When a lived-in neighborhood is left short of water, sewage, waste or power by a squeeze, nobody leaves, the line is broken and counts, and a unit of the short kind in hand takes a crew ahead of everything else.
  - Without `inOrder` the same orders play exactly as the sketch's clock: homes first, 30,000 people at year 2, line 6 broken (the parity suite).
- **The ledger's city with growth**: full from the start, it refills its 181 leavers a month and stays at 50,000; it records the same lines and the same capital spend as the run without growth.

## Acceptance

`domain/run/test/parity.test.ts` matches 64 recorded steps (start, order, tick, first, cancel, stop, with the work in hand after each), the wave table, 7 timelines, 6 restores, the 25 promise runs, and the ledger's city left alone on 2 seeds with every year's notices and stress, against the sketch's `clock.js`. `scenarios.test.ts` asserts the scenarios above and replays the sketch's founding script on 4 seeds against the recorded records. `spend.test.ts` asserts the spend scenarios: year 0, the twenty-year identities, the order of paying, the take-down, and a stored clock reading its money back (a row written before money restores zeros). The sketch's clock has no money, so parity compares the record's old fields only, as ADR-0007 Decision 7 has the ledger do. The sketch's sentences (what an order said) are kept in the fixture for the Board's wording tests in Phase 4. `order.test.ts` asserts the build order (ADR-0012 Decision 2) on David's founding of 2026-10-15: the first year's crews go to the ring, the schools and the first six stretches, not the homes; every stretch and plant stands before the first neighborhood opens; without `inOrder` the same orders open the homes at year 2 with one stretch built; by year 20 the same city stands either way and cost the same to build; an order's `startsNow`, the work in hand and putting a home first all follow the classes; a stored run keeps `inOrder` only when it was stored as `true`. `growth.test.ts` asserts the month clock on the real Ledger and Site: a run without growth has no month clock; months advance to the year's end; the full city stays full and its months' running spend is the year's; the founding with growth fills at the pace and watches its daily list while filling; a stored month clock reads back.
