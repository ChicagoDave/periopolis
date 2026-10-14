# Ledger

**Purpose.** Premises in, consequences out. One derivation, run once per column, so that the car city and your city are worked out by the same arithmetic and the car column, which was never tuned, vouches for the other.

**Package.** `@city/ledger` (`domain/ledger`). Pure and deterministic; imports nothing outside itself. Public interface: `deriveCarCity`, `deriveWalkingCity`, the premise and consequence types, the Revision 3 defaults (`SHARED`, `CAR_CITY`, `WALKING_CITY`, `NEEDS`), the cost placeholders (`COSTS`), and the constants and geometry the Site and Run contexts build on.

**Consumers.** Site takes the tile (5,000 people on 93 acres) and the rates from the walking column of 50,000; the Board shows both columns row by row.

## Terms

| Term | Meaning | Whose word |
|---|---|---|
| Premise | A figure a column is built on. Shared premises hold for both columns; column premises belong to one. | Mine |
| Consequence | A figure the derivation gives. Never set, always derived. | Mine |
| Column | One city worked out: the **car city** or **your city** (the walking city). The page shows them side by side. | Mine |
| Need | One entry of the needs list: what the city must hold and where. A **counted** need takes so many people to keep one open; a **capped** need (a school) holds so many pupils at most. | Mine |
| Tier | Where a need lands: in **every center**, **shared** between centers (a district), in **the middle** of the city, or left **out**. | Mine |
| Hungriest need | The daily need that wants the most people. It sizes the center. | Mine |
| Center | The middle of a neighborhood, with its daily list. In your city a center has as few people as its hungriest need allows, stretched by the band. | Mine |
| District | The ground that shares the kind of school the city has fewest of. Shared needs are counted per district. | Mine |
| Ring | A circle of 25-story buildings in the middle: offices, the civic floors, a few condos, fine dining. Buildings are counted for the floor the middle has to hold, stretched by the band. | Yours (line 19) |
| Band | How far the city must stretch without breaking a line: 20% either way. Schools are counted at the top of it, customers at the bottom. | Mine (line 18 names what stretches, not how far) |
| Slack | How far a placed need can stretch before it breaks: a school's pupils growing to its cap, or a counted need's customers falling to what it needs. Negative means short today. | Mine |
| Stop | Where a mover is boarded. One in each center's ground and one under the ring. | Yours |
| Entry | A sub-level entry shared by the homes within a one-minute walk. | Yours (line 9) |
| Kind of trip | One destination's trips: its share of all trips, its spread of lengths, its walking limit, and the walks a ride of it needs. | Mine |
| Long walk | The 30-minute walk to school or work. | Yours (line 16) |
| Ceiling | People the city holds before the rim is past the long walk from the one middle. | Mine |
| Unit cost | What one of something costs: a square meter of floor, a kilometer of track, a mover, a pupil for a year. A premise with a mark (ADR-0007). | Mine |
| Mark | Whose figure a premise is: **Yours**, **Sourced** (with its source and year) or **Mine**. Line 26. Every premise has one; the Board shows it. | Yours (line 26) |
| Cost row | One unit cost times one ledger count, in one layer. A column carries only the rows it has something of. | Mine |
| Layer | One of six: **groundworks**, **buildings** and **fleet** to build; **upkeep**, **civic services** and **households** to run. Line 25. Each is a total; the whole is the sum. | Yours (line 25) |
| Capital | The three built layers, totalled, per city and per person. | Mine |
| Running cost | The three yearly layers, totalled, per city and per person. | Mine |
| Land | The city's area at the land price. Its own line, outside the six layers. | Yours (line 25) |
| Financing | The groundworks and buildings paid off level over a term at a rate. The yearly cost of the homes appears here and nowhere else (line 28). | Yours (lines 25, 28) |

## The two columns

| | Car city | Your city |
|---|---|---|
| Built form | Houses on lots, with parking at home and away | Townhouses, and the ring |
| Daily needs | A supermarket's worth of people inside a 10-minute drive | Within a walk; the center sized by the hungriest need |
| Vehicles | One per driver, parked 3.3 places each | One fleet of movers, sized for the busiest hour |
| Goods | Van and truck, to the curb | Pipe and dumbwaiter; a porter for big things |

The columns are two types, not one bag of flags: the page never switches a column's form, fleet or access, so neither does the derivation.

The car city is a comparison column and nothing more. There is no car city in the sim: the Site lays out your city only. What may come later, at the edge of the site, is parking, truck docks and train depots where the city meets the outside world (David, 2026-10-12; see the open question on trips that leave the city).

## The nine steps

1. **Built form, and the density it gives.** Footprints, yards, parking, parks and streets per person; land, density, area, radius, the walk from rim to middle, the reserve at the edge.
2. **Centers.** How many people a center has, how many centers the city has, the farthest and typical walk to one.
3. **Needs placed.** For each need: how many each center (or district, or the middle) gets, how many the city gets, who shares one, how far it can stretch.
4. **Trips, by where they go.** One kind for each need, one for office work in the middle, one for other work, one for everything else. Each kind is split into walks, bike rides and rides. Then access: the walk to a stop, the wait, the walk past which a ride is quicker, and door to door.
5. **Vehicles.** Vehicle trips, seats filled, vehicles moving at the peak, the fleet.
6. **Where vehicles wait, and where people meet them.** Parking or depot ground; stops, berths, entries, the walkway and the mover line.
7. **Goods.** Runs for goods; the dumbwaiters, the pipe, totes and porters.
8. **Paths and lanes.** Bike lanes and the speed at which a bike is under the harm line.
9. **Stretch.** How far children can grow before a school is full, how far people can fall before a need runs short, how far the ring can fill, and the ceiling.
10. **Cost.** What the nine steps counted, priced in six layers (ADR-0007). To build: groundworks (streets, the ground where vehicles wait, parks; in your city the sub level as built floor with its track, stops, entries and pipe, and the lanes), buildings (floor by the square meter, low rise and the ring's high rise; dumbwaiters) and fleet (cars or movers). To run each year: upkeep (2% of groundworks and buildings), civic services (pupils, police, fire, health and library per person, electricity from the grid or the city's reactors, water, sewage, waste, goods runs, porters) and households (vehicle-kilometers and vehicles worn out). Then the Land and Financing lines. Both columns through one function. Plants are not ledger counts; their unit costs live here and the Site prices the ones that stand. The Site and the Run price what stands and what a year spends through the same `priceCounts` and `tallyCost`, so the Ledger is the only home of the unit costs and of the arithmetic. The sub level is built floor, not tunnel.

## Rules worth knowing

- A need with no minimum is one per center, district or middle.
- A list that claims more trips than are made is scaled to fit.
- A ride shorter than the walk to a stop has nothing to ride: whoever wanted one goes on foot and is counted as having no ride.
- Ties for the need nearest running short go to the need that wants more people.
- The band is clamped to 0.95; a band of 0 or less is none.
- Money adds rows and moves nothing: every figure of the nine steps is the same with or without a unit cost, and the parity suite compares the old rows only. Floor is priced once; needs and schools are inside it and are not priced again by count. Housing is paid for once: no rent row, the Financing line carries the homes' yearly cost.
- The ledger's car city drives about 2,400 km a car a year, a tenth of AAA's 15,000 miles, because every trip is inside a city a 10-minute drive across. Its per-car cost is a third of AAA's for that reason, and the vouching test allows it.

## Acceptance

Revision 3 for 50,000 people is the oracle (`docs/work/archive/port-city-builder/sketch/ledger/copied.txt`). Among its figures: 2,110 against 13,249 people per km²; 10 centers of 5,000; 9 elementary schools of 400, 3 middle of 600, 2 high of 1,200; 8 ring buildings 272 m across; 76.4% of trips on foot; 159 movers against 42,000 cars; 45 km of sub level; a ceiling of 166,492 people. `domain/ledger/test/published.test.ts` asserts them; `parity.test.ts` asserts every figure of 19 recorded cases against the sketch's model. `cost.test.ts` asserts that every cost row is its count times its premise in one of six layers, that every premise carries a mark, that the floor is priced once, that a changed premise moves only its rows, that the nine steps' figures do not move, and, loosely, that the car column lands near what America pays. At the premises of 2026-10-13 (`docs/brainstorm/future-city/money.md`) the published city costs about 255 against 210 thousand dollars a person to build, about 14,900 against 10,400 a year to run, and about 12,900 against 12,600 a year to finance.
