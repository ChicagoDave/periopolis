# Run

**Purpose.** Twenty years on the clock. Crews turn orders into buildings over years, people move in as their homes are finished, and the stretches line 18 allows for happen to the city on a timeline dealt at the start of a run. Each year the city is checked as it stands, and every broken line counts one line-year against the run.

**Package.** `@city/run` (`domain/run`). Pure and deterministic; depends on `@city/site` alone. The one random source is a seeded generator, so a run replays from its seed. Public interface: `startRun`, `stopRun`, `tick`, `placeOrder`, `cancelJob`, `putFirst`, `inHand`, `notices`, `stressAt`, `restoreClock`, and the rules.

**Consumers.** The Board shows the clock card, the work in hand and the notices, and turns clicks into orders.

## Terms

| Term | Meaning | Whose word |
|---|---|---|
| Game | What stands and the clock, or no clock when the board is a plain plan. A value. | Mine |
| Clock | The year, the work in hand, the events dealt, the record, and the line-years so far. | Mine |
| Run | Twenty years on the clock, from a seed. | Mine |
| Crew | One of ten. A crew does one job at a time and is whatever it takes to finish a neighborhood in two years. | Mine |
| Job | An order that takes years to become a piece: what, where, years left, years in all. Jobs are worked in the order they stand; the first ten with work left have a crew. | Mine |
| Piece | Anything a crew builds: a neighborhood (2 years), a ring building (2), an elementary or middle school (1), a high school (2), fields (1), a stretch of line (1), a module (1, or 3 with its site), a plant unit (2). | Mine |
| Planned board | The layout as it will stand when the work in hand is done. Orders are made on it. | Mine |
| Order | A layout command applied to the planned board. What came is ordered as jobs; what went is canceled from the work in hand, the latest first, or taken down if it already stands. | Mine |
| Ready | A finished job waiting for the place it stands in: a school for its neighborhood, a further module for its site. It takes no crew while it waits. | Mine |
| Event | One of five things that happen in a run, each announced ahead: a housing squeeze (20% more people, 3 years), a closure (one stretch of line, 1 year), a wave of young families (20% more children, 13 years, moving up a grade a year), a second closure, a slump (20% fewer people, 4 years). | Mine |
| Notice | What the player is told about an event: happening now, or announced for soon. Typed; the Board words it. | Mine |
| Stress | The events running in a year, as the stress the Site checks the layout under. | Mine |
| Record | One row a year: people, homes, lines held, watched and broken, which broke, and what opened. | Mine |
| Line-year | One line broken for one year, summed over years 1 on. Year 0 is noted and does not count. | Mine |

## The year

1. The first ten jobs with work left each lose a year.
2. Finished jobs open on the layout, neighborhoods before what stands in them. A school whose neighborhood is not there yet, or a module whose site is not, stays ready.
3. A closure announced this year picks its stretch: one of the closable stretches, from the seed and the event's id. With no line there is nothing to close and no notice.
4. The city is checked under this year's stress. The row goes in the record and its broken lines into the line-years.

The squeeze is over before the wave arrives, so no two events push the same line past the band. That is what makes the promise hold.

## The promise

Each event is one of the four stretch tests come true. A city where every line holds and all four stretch tests hold cannot be broken by anything the clock deals. The ledger's city with twelve more stretches, so every stop has a second way, is left alone for twenty years on 25 timelines and loses 0 line-years. On spokes it loses 3 or 4, all in closure years.

## Scenarios

- **Mechanics**: a reactor's first module takes three years with its site and the second one year; a school ordered on a building site waits for its homes and opens with them; twelve one-year jobs on ten crews leave two waiting until one is put first; ordering a finished stretch again takes it down and ordering one in hand cancels it; canceling a reactor site drops its later module instead; canceling a neighborhood drops its schools; stopping the clock finishes the work in hand at once.
- **Founding 100,000 from nothing**: everything else ordered ahead of the homes, 151 crew-years in all. Left to run, 3 line-years; with a bypass laid when each closure is announced, 0 or 1. Homes for 100,000 by year 20 on every seed tried.

## Acceptance

`domain/run/test/parity.test.ts` matches 64 recorded steps (start, order, tick, first, cancel, stop, with the work in hand after each), the wave table, 7 timelines, 6 restores, the 25 promise runs, and the ledger's city left alone on 2 seeds with every year's notices and stress, against the sketch's `clock.js`. `scenarios.test.ts` asserts the scenarios above and replays the sketch's founding script on 4 seeds against the recorded records. The sketch's sentences (what an order said) are kept in the fixture for the Board's wording tests in Phase 4.
