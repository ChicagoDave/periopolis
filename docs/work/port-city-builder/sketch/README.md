# The sketch

The sources of the two published pages this project grew out of, as they stood on 2026-10-11. They are plain browser JavaScript with no build step beyond concatenation. This plan ports them; nothing here is meant to be extended.

## What is here

`ledger/` is the Future City Ledger (Revision 3): the two-column derivation, car city against your city.

- `model.js` is the derivation itself (`CityModel.derive`). The builder depends on it for its rates and for the size of a tile.
- `app-rows.js`, `app-ui.js`, `part1.html`, `part2.html` are the ledger's page.
- `run.js` runs the model in Node and asserts the car column is unchanged.
- `copied.txt` is the published ledger's own text export for a city of 50,000. Its figures are the oracle for Phase 1.

`builder/` is the Future City Builder (the hex map and the clock).

- `engine.js` is the site: geometry, layout moves, the fifteen line checks, seating, trips, and the four stretch tests.
- `clock.js` is the run: crews, jobs, the timeline of events, the yearly record.
- `ui.js`, `part1.html`, `part2.html` are the page.
- `test-engine.js`, `test-clock.js`, `try-100k.js`, `try-loop.js` are the check scripts. Their printed results are the oracle for Phases 2 and 3.
- `look.js` files (both folders) drive the built page in a browser with Playwright. They are the source of the flows for Phase 4.

## Running it

From `builder/`:

```
node test-engine.js     # the site's checks; ends with the seating and far-pair cases
node test-clock.js      # the clock's checks; ends with "all checks passed"
node try-100k.js        # 100,000 people on spokes, then with loops
sh build.sh             # writes future-city-builder.html, the single page that was published
```

From `ledger/`:

```
node run.js             # the derivation at several city sizes
sh build.sh             # writes future-city-ledger.html
```

The builder's scripts read `../ledger/model.js`, so the two folders have to stay side by side.
