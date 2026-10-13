# Ground

**Purpose.** The physical plan of one neighborhood, and (Phase 2) of the ring: the shapes on the surface and on the sub level, in metres, drawn from the figures the Ledger already fixes. The tile map stays the zoomed-out view; the Ground is what a tile holds when you zoom in.

**Package.** `@city/ground` (`domain/ground`). Pure and deterministic; depends on `@city/ledger` alone and never on the Site. Public interface: `planNeighborhood`, `GroundError`, the plan types, and the frame geometry (`hexFrame`, `halfWidthAt`, `insideFrame`).

**Consumers.** The Board draws a plan when a tile is zoomed into (Phase 3). Nothing else reads it yet.

## Terms

| Term | Meaning | Whose word |
|---|---|---|
| Frame | The hexagon one neighborhood stands on, in metres from its middle, x east and y south. A corner points straight up, as on the Site's board. | Mine |
| Row | So many townhouses side by side along a line, each the Ledger's 6 m front and three stories. | Yours (lines 10, 11) |
| Center | The middle of the neighborhood: its daily needs. Drawn as a disc; the Ledger does not size it. | Mine |
| Park | The Ledger's parks per person for the neighborhood's people, as one disc beside the center. | Yours (line 4); the size is the Ledger's |
| Lane | The bike lane: the three edges of the tile this neighborhood keeps, the other three belonging to its neighbors. | Mine; the length is the Ledger's |
| Entry | A sub-level entry, one per one-minute cell of the tile. Each home belongs to its nearest. | Yours (line 9) |
| Walkway | From each entry, one step along the one-minute grid toward the stop. | Mine; the Ledger's model |
| Pipe | The goods pipe, one length under each pair of rows. | Yours (line 7, 12); the length is the Ledger's |
| Stop | The mover stop under the center, with the Ledger's berths. | Yours (line 6) |
| Placeholder | A placement the Ledger does not fix, chosen so the plan could be drawn, named in the plan so the Board can say so. | Mine |

## What the plan fixes, and what it chooses

Fixed by the Ledger and reconciled by guards in `planNeighborhood` (the plan refuses to exist otherwise):

| Figure | How it is laid out | Revision 3, one neighborhood |
|---|---|---|
| Homes | `round(centerPop / hh)`, in whole homes across the rows | 2,041 |
| Frontage | homes × front | 12.2 km |
| Park | parks per person × people, as one disc | 50,000 m² (12 acres) |
| Lane | three tile edges, 3 × corner radius | 1.1 km |
| Entries | `round(entriesPerCenter)`, the stop's among them | 33, about 62 homes each |
| Walkway | (entries − 1) one-minute steps | 3.7 km |
| Pipe | frontage ÷ rows per pipe | 6.1 km |

Chosen, and listed in `plan.placeholders`: the row pitch (the widest quarter-metre step at or under the Ledger's ground per home at which the homes fit; 24.75 m today), where the rows sit, the center's size (80 m radius), the park's position (toward the top corner), which three edges carry the lane, where the entries sit (a hexagonal grid at the Ledger's one-minute spacing, its six directions pointing at the tile's corners; inner rings kept whole, the outer ring's points kept where the homes are), and where the pipe runs.

Two consequences of the placeholders worth knowing: an entry under the center or the park may serve no homes (the stop's does not today), and the farthest home walks about 1.7 minutes to its entry rather than the Ledger's one, because 33 cells do not tile a hexagon exactly. Both move when a placeholder does.

## Acceptance

`domain/ground/test/neighborhood.test.ts` holds the sums to the Ledger's at the precision its page shows, checks every row lies on the tile clear of the center and park, every entry walks one step toward the stop, the pipe runs under each pair of rows, the placeholder list is exactly the seven above, the plan is the same every time, and the three refusals (`figure-not-positive`, `homes-do-not-fit`, `entries-do-not-fit`).
