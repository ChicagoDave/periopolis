# Site

**Purpose.** The ground the city is laid out on, divided into tiles; the commands that lay it out; and the fifteen line checks and four stretch tests that tell whether the city as drawn still honors the lines.

**Package.** `@city/site` (`domain/site`). Pure and deterministic; depends on `@city/ledger` alone. Public interface: the layout and its commands, `assess`, the rates, the board geometry, seating, the line network, and `costOf`, the cost of what stands (with the Ledger's cost names re-exported so the Run depends on the Site alone).

**Consumers.** Run assesses a layout under each year's stress and counts broken lines; the Board draws the layout, turns clicks into commands, and words the findings.

## Terms

| Term | Meaning | Whose word |
|---|---|---|
| Site | The ground the city is laid out on: a rectangle of hexagonal tiles inside an outline, five tile steps across and five rows down from the middle, 115 tiles (ADR-0006). The sketch's board was a hexagon of 91 tiles, which the rectangle holds. | Mine |
| Outline | The site's shape: which tiles are on it. A hexagon of a given radius, or a rectangle of a given half width and half height, both centred on `0,0`. | Mine |
| Tile | One hexagon of the site, named `q,r`: the catchment of one center. 5,000 people on 93.3 acres; a 9.9-minute walk from one middle to the next. | Mine |
| Layout | What stands on each tile and where the mover line runs. A value: commands make new ones and never change the one they were given. | Mine |
| Neighborhood | A tile of 5,000 people with its daily list built in. It may hold an elementary, middle or high school, and playing fields. | Mine |
| Ring | A tile of 25-story buildings, 1 to 40. One building holds the offices and halls of 7,771 people. | Yours (line 19) |
| Plant | A reactor site, water plant, sewage plant or waste works at the edge, 1 to 12 modules or units. One unit serves 60,000 people; one module makes 77 MW. | Mine (lines 20, 22) |
| Stretch | A length of mover line between two neighboring tiles, named `a\|b`. A tile the line touches has a stop under its center. | Mine |
| Need | What a layout lacks to keep its lines whole, typed: a ring or more ring buildings, reactor modules, plant units, schools near the neighborhoods whose pupils have no seat, playing fields, or the mover line run to the tiles it must reach. Each need names the checks it answers. Read off the assessment of an ordinary year, never worked out again, so the needs and the checks cannot disagree (ADR-0008). A check broken for want of people, or only on watch, asks for nothing to be built. | Mine |
| Proposal | A need with a tile chosen for it and the commands that would build it there, not yet built. The layout changes only when the player accepts it, through the ordinary commands (ADR-0008). | Mine |
| Command | What a player may do to the layout. It answers with an event or a rejection, never silently. | Ours |
| Line check | One line tested against the layout: idle (nothing to check yet), ok (holds), warn (watch), bad (broken). Each carries the tiles it marks and the facts behind its status. | Mine |
| Facts | The numbers behind a check's status, typed by check and case. The Board words them; the domain never writes a sentence. | Mine |
| Issue | Something wrong at one tile, typed. A tile's level is the worst of its issues. | Mine |
| Occupancy | The people living in each neighborhood this year, handed to the assessment (`assess`'s `occupied`, `assessCore`'s last parameter); a neighborhood left out holds its capacity, 5,000. Every check counts the people living there: a ring's load, pupils, trips, the daily list (short in any neighborhood below its hungriest need). The capital cost rows keep the homes as built; the yearly per-person rows follow the people (ADR-0009). | Yours (2026-10-14) |
| Day view | One day of a layout's people, hour by hour (`dayOf`, or `dayFrom` an assessment): trips, rides, mover trips, movers moving and parked, power, and pupils going to school in the hour before it starts and coming home in the hour it lets out. Built from the same assessment as the checks, so its trips sum to the day's (people times trips a person a day), its busiest hour is the ledger's peak, its most movers moving is the fleet less its reserve, and its highest power is the power check's peak. It holds no state; the month clock hands it the people (ADR-0009). The sized city's summer weekday: 147,727 trips, 14,773 between 5 and 6 p.m., 75 MW at 5 p.m., 45 MW at 5 a.m., 1,440 MWh, 188.5 of 216.7 movers moving at the busiest hour. | Mine |
| Stress | What is happening to the city in the year it is checked: more or fewer people, more children in every grade or in some grades, stretches closed. | Mine |
| Stretch test | The layout checked at an edge of the band, or with one stretch closed. A line *gives* when the stress leaves it worse off than in an ordinary year. | Mine |
| Bridge | A stretch with no way round it. The closure test closes bridges worst first, the one that cuts off the most neighborhoods ahead, until one breaks a line. | Mine |
| Seating | Pupils go to the nearest school with room; anyone left out is seated by a chain of moves, so nobody is counted out while a seat exists within the walk. | Mine |
| Score | What has been built, how trips are made, the fleet, the sub level, and the same city as a car city from the ledger. | Mine |
| Cost of what stands | Every tile and every stretch priced at the Ledger's premises in the six layers (ADR-0007 Decision 6), with the rows that belong to the city as a whole (the fleet and where it waits, upkeep, getting around), the Land and Financing lines, and the totals. A neighborhood is one center's share of the ledger's walking column, so a finished tile costs exactly its share; its walkway stands only where a stop does. A ring building is one building's worth of the middle's floor. A plant is its modules or units. A stretch is a step of mover floor and track. Schools and fields are inside the floor and the parks and add no row. The capital rows count the homes as built; the yearly per-person rows count the people living in them this year, stress included. The Ledger is the only home of a unit cost; the Site supplies the counts. | Mine |

## Commands

| Command | Event | Rejections |
|---|---|---|
| `placeNeighborhood` | NeighborhoodPlaced | OffBoard, TileTaken |
| `addRingBuilding` | RingStarted, RingBuildingAdded | OffBoard, TileTaken, RingFull (40) |
| `toggleExtra` | ExtraAdded, ExtraRemoved | OffBoard, NotANeighborhood |
| `addPlantUnit` | PlantStarted, PlantUnitAdded | OffBoard, TileTaken, PlantFull (12) |
| `layStretch` | StretchLaid, StretchRemoved | OffBoard, SameTile, NotAdjacent |
| `erase` | LinesThroughTileRemoved, UnitRemoved, TileCleared | OffBoard, NothingThere |

Where the line continues from after a click is the Board's cursor, not a command.

## The fifteen line checks

| Check | Lines | Holds when |
|---|---|---|
| daily | 3, 13, 14 | A neighborhood's people feed every need on the daily list; the doctor's office, wanting 4,000, is the hungriest. |
| size | 3, 14 | The city has the 23,300 people urgent care wants and the 71,300 fine dining wants. Short is a watch, not a break. |
| ring | 10, 19 | Every ring has a building for each 7,771 people that use it. |
| work | 16 | Every neighborhood is within a 30-minute walk of its nearest ring; past it with a mover line is a watch, without one a break. |
| stops | 6 | Every neighborhood has a stop on a line that reaches its ring. |
| elementary, middle, high | 15, 16 | Every pupil has a seat within a 30-minute walk, no school over its cap. |
| fields | 4 | Every neighborhood is within a 20-minute walk of fields, or can ride to them. |
| ways | 17 | Under 0.5% of trips are past the walk with no mover to take. |
| power | 20, 21 | The modules carry the peak (1.5 kW a person) with one down for fuel. |
| water, sewage, waste | 22 | Units serve the whole population. Sewage reports what it cleans against what the reactors take. |
| haul | 5 | Every plant is on the mover line, so nothing is hauled on the surface. |

Trips are counted over the real distances between tiles. Inside the walking limit people walk, with one in ten riding anyway if a mover runs. Past it, half of what is bikeable is biked and the rest rides if a mover runs, or is *stuck* if none does. A trip with nowhere to go (no seat, no fields, no ring) is counted apart, because the line it breaks is the one about that place.

## Scenarios

- **The ledger's city on the board** (`starterLayout`): 14 of 15 lines hold, fine dining to watch. 71% of trips on foot, 11% by bike, 18% by mover; 217 movers against 42,000 cars; 1,399 acres against 5,857. The three band tests hold; a closure gives, because all 14 stretches are spokes.
- **Two far neighborhoods with no line**: work, stops and ways break; 9.1% of trips are stuck; only the two are marked.
- **100,000 on spokes**: every line holds on 649 movers; a closure gives.
- **100,000 with loops**: every line holds, all four stretch tests hold, no bridges left, 584 movers, 30.4 km of line.
- **The ledger's city needs nothing** (`needsOf`): no line a built thing can mend is broken. An empty site needs nothing either.
- **An eleventh neighborhood beside the ledger's city** (at `2,0`): it needs only the mover line run to it; the ring, plants and schools have room to spare. Past the walk to the ring (at `4,-2`) the same line also answers work.
- **Thirteen neighborhoods** (the ledger's city and `2,0`, `-3,0`, `0,2`): one more ring building, one more unit at each plant, an elementary and a high school for 180 and 120 pupils with no seat, fields near `0,2`, and the line to all three. Built, they leave no line broken and the tally at 14 of 15, fine dining to watch, which waits on people, not on anything built.
- **A lone neighborhood on an empty site** needs a whole city: a ring of 1 building, 2 reactor modules, a unit at each plant, a school of each kind, fields and a stop on a line to the ring.
- **Where each need goes** (`proposeFor`, `applyProposal`): one need at a time, its steps applied to a scratch layout and the needs read again, so what an addition calls for in turn is proposed after it. Ring buildings go on the ring that is short, or a new ring on the open tile nearest the neighborhoods; units go on a plant of the kind with room, else a new plant on open ground that borders no neighborhood or ring, nearest the line and farthest from the ring; a school or fields go on the neighborhood without one nearest those left short; the line runs by the fewest stretches from each tile it must reach to the line that joins the ring. Ties go to the tile first in the board's order. The eleventh neighborhood at `2,0` is proposed one stretch to `3,-1`, about 39 million dollars to build; thirteen are proposed one ring building, a unit at each plant, an elementary and a high school, fields at `0,2` and three stretches. Accepting every proposal leaves no line broken. A board with no open ground for a ring is told there is no room, and nothing is proposed past it.
- **The ledger's city sized to its people** (`sizedLayout`): the same tiles and line with 7 ring buildings and 2 reactor modules, one of each fewer; every line it held still holds and one fewer of either would break one. About 243,900 dollars a person to build against the starter's 267,100 and the car city's 261,800; 15,400 a year to run against 15,900. `sizedTo` refuses a layout that still needs something.
- **A city still filling** (occupancy, ADR-0009): thirteen neighborhoods outgrow the ring and the plants, but while the three new ones stand empty the 50,000 living there leave the ring and every plant with room. A neighborhood of 400 still filling cannot yet feed its doctor's office, bakery, butcher or cafés: its daily list is a watch, not a break, since its shops open as people arrive (David, 2026-10-14), and only it is marked. A full neighborhood emptied by a stress below its hungriest need is still broken, and the Board names "the emptiest neighborhood". An empty neighborhood sends no pupils or trips and runs no per-person services, while its streets, parks and floor are still priced as built.
- **What the ledger's city on the board costs** (at the premises of 2026-10-13, `docs/brainstorm/future-city/money.md`): about 14.0 billion dollars to build (groundworks 4.5, buildings 9.4, fleet 0.03) and 592 million a year to run, against the ledger column's 10.5 billion and 520 million: the board stands 3 reactor modules and 3 plant units the column does not count, and the band's 8 ring buildings where the column prices 6.4 buildings' floor. An empty site costs nothing.

## Acceptance

`domain/site/test/parity.test.ts` matches 15 recorded assessments (checks, every tile's report, the score, the stretch tests), 29 moves, 2 seatings, 4 restores and 4 bridge cases against the sketch's `engine.js`. `scenarios.test.ts` asserts the scenarios above in the language of the lines. `cost.test.ts` asserts that an empty site costs nothing, that a finished neighborhood costs the ledger's per-tile share row by row, that plants and stretches are priced at the groundworks premises, that the layers sum to the whole, that a squeeze moves the yearly rows and not the buildings, that a changed premise moves only its rows, and, loosely, that the board's city lands near the column's. `occupancy.test.ts` asserts the city-still-filling scenario, that leaving occupancy out is the same assessment figure for figure, and the refusals. `sized.test.ts` asserts the sized city's scenario, that the starter is untouched, and that sizing a sized city changes nothing; `cost.test.ts` pins its cost against the starter's and the car city's. `propose.test.ts` asserts that on five layouts every proposal is on the board, on open ground or a tile of its own kind, and that accepting all of them through the ordinary commands leaves no line broken; that new plants keep off the ground beside the homes; that a full board says there is no room; and that `applyProposal` answers with every step's event or the first rejection and leaves its layout as it was. `needs.test.ts` asserts the needs scenarios above, that the needs answer exactly the broken checks a built thing can mend on every layout it is given, and that `needsOf` leaves its layout as it was. The parity fixture is unchanged: money adds figures to the score (`vehicleTrips`, `rideKm`) and the record compares only the recorded keys. The sketch's sentences are kept in the fixture for the Board's wording tests in Phase 4.
