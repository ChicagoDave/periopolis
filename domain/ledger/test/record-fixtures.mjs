// Records the parity fixtures for @city/ledger from the sketch's model.js, the ledger as published on 2026-10-11.
// Run once from the repository root when the fixtures are to be refreshed:
//   node domain/ledger/test/record-fixtures.mjs
// The sketch is archived with its plan, so after docs/work/port-city-builder/ moves to docs/work/archive/,
// point SKETCH at the archive. The recorded JSON is what the tests read; this script is not run by them.
import { createRequire } from 'node:module';
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SKETCH = join(here, '../../../docs/work/port-city-builder/sketch/ledger/model.js');
// The repository is ES modules, so the sketch's CommonJS file is copied under a .cjs name before it is required.
const copy = join(mkdtempSync(join(tmpdir(), 'ledger-sketch-')), 'model.cjs');
copyFileSync(SKETCH, copy);
const M = createRequire(import.meta.url)(copy);
const { shared, old, neu, needs } = M.defaults;

// The sketch's needs carry no 'people' discriminator; the port's do. Both derive the same.
const typedNeeds = needs.map((n) => (n.kind === 'cap' ? n : { ...n, kind: 'people' }));

const cases = [];
const car = (name, s, c) => cases.push({ name, column: 'car', shared: s, premises: c, result: M.derive(s, c) });
const walking = (name, s, c) =>
  cases.push({ name, column: 'walking', shared: s, premises: c, result: M.derive(s, c, needs) });

car('car city, Revision 3', shared, old);
walking('your city, Revision 3', shared, neu);
for (const band of [0, 0.1, 0.3]) walking(`band ${band}`, shared, { ...neu, band });
for (const stories of [2, 4]) walking(`${stories} stories`, shared, { ...neu, stories });
for (const k of [2, 4, 7]) walking(`${k} stops a center`, shared, { ...neu, stopsPerCenter: k });
walking('no long walk', shared, { ...neu, longWalkMin: 0 });
walking('cowork and condos', shared, { ...neu, coworkShare: 0.5, condoShare: 0.1 });
for (const pop of [250000, 1000000, 5000000]) {
  car(`car city, ${pop} people`, { ...shared, pop }, old);
  walking(`your city, ${pop} people`, { ...shared, pop }, neu);
}
car('car city, no empty running, 2 stories', shared, { ...old, stories: 2, emptyRunning: 0.1 });

const json = JSON.stringify(
  { recorded: '2026-10-12', source: 'docs/work/port-city-builder/sketch/ledger/model.js', needs: typedNeeds, cases },
  (_k, v) => (v === Infinity ? 'Infinity' : v === -Infinity ? '-Infinity' : v),
  1,
);
writeFileSync(join(here, 'fixtures/parity.json'), json + '\n');
console.log(`recorded ${cases.length} cases`);
