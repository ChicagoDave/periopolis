# Board

**Purpose.** The web adapter: the Future City Builder page. It draws the site, turns clicks into layout commands or crews' orders, words every event, check, issue and notice, and shows the score, the line checks, the stretch tests and the clock. Zoomed into a tile, it draws that tile's ground from the Ground's plan, one level at a time. It holds no rules.

**Package.** `apps/board` (`@city/board`, Vite). Depends on `@city/site`, `@city/run` and `@city/ground` (and `@city/ledger` through them). `pnpm --filter @city/board build` emits one self-contained page at `apps/board/dist/index.html`, so it can still be published the way the sketch was.

## What the Board owns

| Concern | Module | Note |
|---|---|---|
| Every sentence | `src/wording.ts` | Worded from typed facts and events (ADR-0004). Tested against the sketch's recorded sentences. |
| The line cursor | `src/moves.ts` | Where the mover line continues from after a click. A click with a tool becomes a Site command, or a Run order while the clock runs. |
| The session | `src/session.ts` | The game, the tool in hand, the tile picked, the stretch test shown, the view (the map, or one tile's ground at a level; never saved), the history undo keeps. |
| Storage | `src/storage.ts` | A saved game behind one interface. The browser store keeps the sketch's key and shape, so a city saved from the published page still loads. |
| Drawing | `src/draw/*` | The board (SVG), the tray, the score, the clock card and the work in hand, the inspector, the rules and the stretch tests. |
| A tile's ground | `src/draw/ground.ts` | The Ground's plan of a neighborhood or the ring, one SVG unit to the metre, with a legend, a scale bar and the placements the ledger did not fix; the view bar with the way back and the level switch. Rows, entries and buildings carry their counts as data attributes so a flow can add them up. |
| The text export | `src/export.ts` | "Copy the city as text", for pasting back into a conversation. Carries a MONEY section: the layers, every row with its mark, and the run's spend so far. |
| What the city needs | `src/draw/needs.ts`, `accept` in `src/moves.ts` | The Site's proposals for the layout (ADR-0008), one line each with its price, Show (marks its tiles) and Add, and Add all. Building goes through the Site's `applyProposal` and the ordinary commit, so undo and saving work as for any move. Holds no rules: the Board never decides what a city needs or where it goes. |
| Money | `src/money.ts`, `src/draw/money.ts` | The Site's cost of what stands gathered by row id in layer order (`linesOf`), and the run's spend so far (`spentSoFar`); the card that shows them. The Board prices nothing: it asks `costOf` and `totalSpend` and words the layers, rows, premises and marks. |

The page's HTML and styles are the sketch's two halves, plus the view bar and the ground's styles added for the physical city.

## Zooming in

"Look closer" in the inspector, on a neighborhood or a ring, shows that tile's ground in place of the map; the tile map is the zoomed-out view and does not change. The view bar names the tile, switches between the surface and the sub level, and goes back. The view lives in the session only: a reload opens on the map, and a tile that loses its ground (erased, undone, the site cleared) sends the view back to the map on the next redraw. The plan is Ground's; the Board picks a level with `layersAt` and words the caption, the legend and the placeholder note.

## What the city needs

The card under the inspector lists what the layout lacks to keep its lines whole, in the order the Site proposes it, each with what it adds to the bill (a school or fields nearer home can cost less, since fewer people ride). Show marks the tiles a proposal touches; Add builds it, with any plant or ring proposed earlier that its line runs to; Add all builds every one. A whole city reads "The city needs nothing more to keep its lines whole." While the clock runs nothing is proposed, since an order is not built yet and proposing again would order it twice; stop the clock to see what the city needs. A full board says it has no room. The size line is never on the list: it waits on people (ADR-0006, 14 of 15).

## Money

"What it costs" (lines 24 to 29, ADR-0007) sits under the stretch tests. A headline gives what stands costs to build and to run, a person and in all, with the Land and Financing lines. A table gives the six layers, the two totals, Land and Financing for this city, a person, and the car city of the same size a person (from the Score's car comparison, which carries the car column's cost). A disclosure lists every row: how many at which unit cost, the cost, and the premise's mark as a chip, **Yours**, **Sourced** with its year (the source in the chip's title), **Sourced, accepted** when David has accepted it, or **Mine**. While the clock runs the card adds what the run has spent so far, by layer and in all, and the record gains a Spent column, one year's outlay. An empty site says nothing costs anything yet; year 0 says nothing is spent yet. A row the Ledger or the Site adds without a name here, or a premise without a unit, fails the type check. The notes under the game say how spend is paid and that every premise has been accepted (2026-10-14), with water following the green ground.

## Flows

Six flows run in Chromium against the built page (`pnpm --filter @city/board test:e2e`):

1. The opening city holds 14 of 15 lines, fine dining to watch; the closure test can be shown on the board and shows 12 of 15; the money card reads $13.4 B to build and $794 M a year, ten layer rows, every row's chip a mark (Yours, Sourced or Mine) with accepted Sourced chips among them, no spend without a clock.
2. Two far neighborhoods with no line break three lines; only they are marked; their issues read as the sketch wrote them; undo brings the city back.
3. Founding from nothing: nothing costs or is spent at year 0; orders for plants, a ring and a line; year 1 opens three stretches and spends on groundworks alone; homes and schools ordered on building sites; a waiting job put first; the inspector on a building site; year 3 with homes for 10,000; the clock stopped.
4. The ledger's city run to year 20: a closure announced and shown; 20 years in the strip and 21 rows in the record with a Spent column; twenty years' spend by six layers; the export carries the clock and the money; the run survives a reload.
5. Undo, clear and storage: a placed tile goes on undo and the button disables; the board survives a reload without a clock; clear then undo brings the city back, and a cleared site costs nothing; a corrupt save falls back to the ledger's city.
6. A tile's ground: zoomed into the neighborhood at 1,0, the rows drawn add up to the Ground's 2,041 homes; the sub level shows its 33 entries (adding up to the same homes), 32 walkways, the pipes and the stop, and nothing from the surface; back on the map, 115 tiles inside one drawn outline and 14 of 15 lines; the ring shows 8 buildings of 25 stories; removing them one by one returns the view to the map when the tile is bare; a reload opens on the map.

## Acceptance

`apps/board/test/wording.test.ts` holds every sentence to the sketch's: 15 recorded assessments' titles, line labels, details and tile issues; 29 moves; 25 orders; every year's notices on 2 runs; the stretch tests' labels. `money.test.ts` holds the dollar formatting, the mark wording, every premise's unit and layer's name, the rows gathered by id in layer order summing the Site's rows, and the spend so far. `session.test.ts` covers the session and the storage adapter with the memory store: what is saved, what undo brings back, the 80-step history, a store that throws, and the view (opens on the map, looks only at ground, switches level, is never saved, returns to the map when the ground goes). The six flows above are the browser smoke test.

## Not in the Board

Nothing here decides whether a line holds, what a trip does, or what a year brings. Those are the Site's and the Run's, and the Board asks them.
