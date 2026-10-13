# Board

**Purpose.** The web adapter: the Future City Builder page. It draws the site, turns clicks into layout commands or crews' orders, words every event, check, issue and notice, and shows the score, the line checks, the stretch tests and the clock. It holds no rules.

**Package.** `apps/board` (`@city/board`, Vite). Depends on `@city/site` and `@city/run` (and `@city/ledger` through them). `pnpm --filter @city/board build` emits one self-contained page at `apps/board/dist/index.html`, so it can still be published the way the sketch was.

## What the Board owns

| Concern | Module | Note |
|---|---|---|
| Every sentence | `src/wording.ts` | Worded from typed facts and events (ADR-0004). Tested against the sketch's recorded sentences. |
| The line cursor | `src/moves.ts` | Where the mover line continues from after a click. A click with a tool becomes a Site command, or a Run order while the clock runs. |
| The session | `src/session.ts` | The game, the tool in hand, the tile picked, the stretch test shown, the history undo keeps. |
| Storage | `src/storage.ts` | A saved game behind one interface. The browser store keeps the sketch's key and shape, so a city saved from the published page still loads. |
| Drawing | `src/draw/*` | The board (SVG), the tray, the score, the clock card and the work in hand, the inspector, the rules and the stretch tests. |
| The text export | `src/export.ts` | "Copy the city as text", for pasting back into a conversation. |

The page's HTML and styles are the sketch's two halves, unchanged.

## Flows

Five flows run in Chromium against the built page (`pnpm --filter @city/board test:e2e`):

1. The opening city holds 14 of 15 lines, fine dining to watch; the closure test can be shown on the board and shows 12 of 15.
2. Two far neighborhoods with no line break three lines; only they are marked; their issues read as the sketch wrote them; undo brings the city back.
3. Founding from nothing: orders for plants, a ring and a line; year 1 opens three stretches; homes and schools ordered on building sites; a waiting job put first; the inspector on a building site; year 3 with homes for 10,000; the clock stopped.
4. The ledger's city run to year 20: a closure announced and shown; 20 years in the strip and 21 rows in the record; the export carries the clock; the run survives a reload.
5. Undo, clear and storage: a placed tile goes on undo and the button disables; the board survives a reload without a clock; clear then undo brings the city back; a corrupt save falls back to the ledger's city.

## Acceptance

`apps/board/test/wording.test.ts` holds every sentence to the sketch's: 15 recorded assessments' titles, line labels, details and tile issues; 29 moves; 25 orders; every year's notices on 2 runs; the stretch tests' labels. `session.test.ts` covers the session and the storage adapter with the memory store: what is saved, what undo brings back, the 80-step history, and a store that throws. The five flows above are the browser smoke test.

## Not in the Board

Nothing here decides whether a line holds, what a trip does, or what a year brings. Those are the Site's and the Run's, and the Board asks them.
