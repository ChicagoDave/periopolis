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
| Unit cost | What one of something costs: a square meter of floor, a kilometer of line, a mover, a porter for a year. A premise, every one a placeholder (ADR-0007). | Mine |
| Cost row | One unit cost times one ledger count. A column carries only the rows it has something of. | Mine |
| Capital | What the city costs to build: every row of what stands, totalled, per city and per person. | Mine |
| Running cost | What the city costs for a year: upkeep as a share of what was built, vehicle-kilometers, vehicles worn out, goods runs and porters. | Mine |

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
10. **Cost.** What the nine steps counted, priced: floor by the square meter (low rise, and the ring's high rise), streets, the ground where vehicles wait, parks, the vehicles themselves, and in your city the walkway, the mover line, the stops, the entries, the pipe, the dumbwaiters and the lanes. Then a year's running cost. Both columns through one function (ADR-0007). Plants are not ledger counts; their unit costs live here and the Site prices the ones that stand.

## Rules worth knowing

- A need with no minimum is one per center, district or middle.
- A list that claims more trips than are made is scaled to fit.
- A ride shorter than the walk to a stop has nothing to ride: whoever wanted one goes on foot and is counted as having no ride.
- Ties for the need nearest running short go to the need that wants more people.
- The band is clamped to 0.95; a band of 0 or less is none.
- Money adds rows and moves nothing: every figure of the nine steps is the same with or without a unit cost, and the parity suite compares the old rows only. Floor is priced once; needs and schools are inside it and are not priced again by count.

## Acceptance

Revision 3 for 50,000 people is the oracle (`docs/work/archive/port-city-builder/sketch/ledger/copied.txt`). Among its figures: 2,110 against 13,249 people per km²; 10 centers of 5,000; 9 elementary schools of 400, 3 middle of 600, 2 high of 1,200; 8 ring buildings 272 m across; 76.4% of trips on foot; 159 movers against 42,000 cars; 45 km of sub level; a ceiling of 166,492 people. `domain/ledger/test/published.test.ts` asserts them; `parity.test.ts` asserts every figure of 19 recorded cases against the sketch's model. `cost.test.ts` asserts that every cost row is its count times its unit, that the floor is priced once, that a changed placeholder moves only its rows, and that the nine steps' figures do not move; at the placeholders the published city costs about 248 against 247 thousand dollars a person to build and about 5,900 against 3,200 a year to run.
