# Setting

Where the city stands, worked out from first principles: the natural resources at hand decide how many people the ground can carry before anything is built. David, 2026-10-20: "what are the local natural resources? waterways, runoff, great lakes, rivers... these all enable certain levels of population." Decided the same day: **a lake shore, on one of the Great Lakes.**

This brainstorm began on 2026-10-20 during Phase 1 of `docs/work/archive/concentric-site/plan.md`, when the question of where the plants stand (ADR-0016) turned out to rest on where the water comes from. The same two marks apply: **Yours** is something David stated, **Mine** is a placeholder Claude filled in so the arithmetic could run.

## Brainstorm Progress

- [x] **The setting** — a lake shore (Yours)
- [x] **Lines** — new numbered premises, 30 to 32
- [ ] **Sources** — a citation for each figure below marked Mine
- [ ] **The checks** — how the Site holds lines 30 to 32 (ADR-0016's plan, or its own)

## What the model has today

Demand only, no source. The money layer carries water at 116 gallons a person a day (113 base plus yards and parks), sewage at 100, and each reactor module takes about 1.4 million gallons a day of cooling, which reused sewage covers (`overview.md`, lines 20 to 23). Nothing says where the water is drawn or where the treated return goes; "whether the loops close" was left open there. The plant checks ask only whether enough units stand, so today population is capped by nothing but the walk.

## Why the source matters

Rain on the city alone cannot supply it. At 36 inches a year a tile of 93.3 acres sheds about 91 million gallons a year, 250,000 gallons a day, 50 gallons a person for 5,000 people: under half the demand (Mine: 1 acre-inch = 27,154 gallons; 36 inches is a Great Lakes-region year). So the city draws from a body of water beyond its edge, and that body's safe yield is the ceiling on its people:

| Source | What it yields | What it means for the ceiling |
|---|---|---|
| A Great Lake | Effectively unbounded for a city of this size: Milwaukee draws on the order of 100 million gallons a day, Chicago's diversion is on the order of 2 billion (Mine, uncited). The Great Lakes Compact (2008) is the rule instead: no diversion out of the basin, and what is withdrawn is returned to it, treated. | Supply never caps the circle. Return flow is the binding rule. |
| A river | Its low flow less what must stay in the channel. | A real ceiling, set by the river. |
| An aquifer | A few million gallons a day from a good well field (Mine). | A real ceiling of a few tens of thousands of people. |
| Rain and a reservoir | What the catchment beyond the city sheds. | A ceiling set by the catchment's size. |

David chose the lake shore. Supply is therefore not the ceiling; the walk (line 16) and the plants (line 22) stay the binding lines, and the lake adds the return-flow rule and a direction.

## What the lake gives the map

- **A shore.** The site has an edge that is water. The circle's band, where the plants stand (ADR-0016), is oriented to it: the intake, the water plant, the sewage plant, the reactors the reclaimed water cools, and the outfall sit on the shore side of the band. Lake water cools the reactors too, which NuScale permits (Mine: a direct-cooled plant on the lake is the usual siting of Great Lakes reactors).
- **Upstream and downstream.** Along a shore the prevailing current carries the outfall away from the intake, so intake and outfall are apart along the shore, not across the circle. A second circle goes along the shore, never between the first circle's intake and its outfall.
- **Runoff.** Roofs, streets and the sub level shed stormwater to the lake through the band. With no parking the city seals less ground than the car city (the ledger's parking row is 0); the retention and the outfall are band work, not a tile's.
- **The lake is not a tile.** The outline stops at the shore; the water is off the board. How the shore is drawn is the Board's (ADR-0014's projection draws ground, not water, today).

## Lines

Added 2026-10-20. David took them as drafted.

30. "The city stands on a lake shore, on one of the Great Lakes." The lake is the city's water, its cooling and its receiving body; the shore is one edge of the site.
31. "The city draws no more water than its source yields, and returns what it takes, treated." On a Great Lake the yield is not the limit; the return is the rule (the Compact). On any other source the yield caps the people.
32. "The intake is upstream of the outfall." Along the shore, the water plant's intake and the sewage plant's outfall are apart in the direction the current runs, and the reactors stand by the sewage plant whose water cools them (line 22).

## Open

- The figures marked Mine above want citations before they go in the ledger (line 26): a Great Lake city's withdrawal, the Compact's return-flow terms, the regional rainfall, NuScale's lake cooling.
- Whether the Site checks lines 31 and 32 (a plant on the wrong side of the band breaks line 32) or holds them by placement alone: ADR-0016, Open Question 5.
- The direction of the current along the shore, which decides which end of the band is upstream. Taken as a premise of the site, Mine, until David names the lake and the shore.
