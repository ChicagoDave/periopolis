/**
 * @file What a layout needs to keep its lines whole: the ledger's city needs nothing, an eleventh neighborhood needs
 * the mover line, thirteen need the ring, plants, schools and fields as well, and meeting every need leaves no line
 * broken for want of a built thing.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  NEED_CHECKS,
  RATES,
  addPlantUnit,
  addRingBuilding,
  assess,
  emptyLayout,
  layStretch,
  needsOf,
  placeNeighborhood,
  starterLayout,
  toggleExtra,
} from '../src/index.ts';
import type { Layout, Need, Outcome, PlantKind, TileKey } from '../src/index.ts';

function must(outcome: Outcome): Layout {
  if (!outcome.ok) throw new Error(`refused: ${outcome.rejection.reason}`);
  return outcome.layout;
}

function hoods(layout: Layout, keys: readonly TileKey[]): Layout {
  return keys.reduce((s, k) => must(placeNeighborhood(s, k, RATES)), layout);
}

function plantTile(layout: Layout, kind: PlantKind): TileKey {
  const k = Object.keys(layout.tiles).find((x) => layout.tiles[x]?.kind === kind);
  if (!k) throw new Error(`no ${kind} plant`);
  return k;
}

/** Broken checks a built thing can mend. */
function mendable(layout: Layout): string[] {
  return assess(layout, RATES)
    .checks.filter((c) => c.status === 'bad' && NEED_CHECKS.includes(c.id))
    .map((c) => c.id);
}

/** Every check a need answers, once each. */
function answered(needs: readonly Need[]): string[] {
  return [...new Set(needs.flatMap((n) => n.answers))].sort();
}

const THIRTEEN: readonly TileKey[] = ['2,0', '-3,0', '0,2'];

describe('what a layout needs', () => {
  it("the ledger's city needs nothing", () => {
    expect(needsOf(starterLayout(), RATES)).toEqual([]);
  });

  it('an empty site needs nothing; there is no one to serve', () => {
    expect(needsOf(emptyLayout(), RATES)).toEqual([]);
  });

  it('an eleventh neighborhood off the line needs the line to reach it, and nothing else', () => {
    const s = hoods(starterLayout(), ['2,0']);
    expect(mendable(s).sort()).toEqual(['stops', 'ways']);
    expect(needsOf(s, RATES)).toEqual([{ need: 'line', reach: ['2,0'], answers: ['stops', 'ways'] }]);
  });

  it('a neighborhood in the second circle needs a ring of its own there, and the line; the first ring is not its ring (ADR-0016)', () => {
    const s = hoods({ ...starterLayout(), circles: ['0,0', '9,0'] }, ['6,0']);
    const needs = needsOf(s, RATES);
    expect(needs[0]).toEqual({ need: 'ring', circle: '9,0', buildings: 1, answers: ['ring'] });
    expect(needs.find((n) => n.need === 'line')).toEqual({ need: 'line', reach: ['6,0'], answers: ['stops', 'ways'] });
    expect(needs.filter((n) => n.need === 'schools').map((n) => n.need === 'schools' && n.school)).toEqual(['elementary', 'middle', 'high']);
  });

  it('thirteen neighborhoods outgrow the ring and the plants, and leave pupils and fields short', () => {
    const s = hoods(starterLayout(), THIRTEEN);
    const needs = needsOf(s, RATES);
    expect(needs).toEqual([
      { need: 'ringBuildings', tile: '0,0', add: 1, answers: ['ring'] },
      { need: 'plantUnits', circle: '0,0', plant: 'water', add: 1, answers: ['water'] },
      { need: 'plantUnits', circle: '0,0', plant: 'sewage', add: 1, answers: ['sewage'] },
      { need: 'plantUnits', circle: '0,0', plant: 'waste', add: 1, answers: ['waste'] },
      { need: 'schools', school: 'elementary', add: 1, pupils: 180, near: ['2,0'], answers: ['elementary'] },
      { need: 'schools', school: 'high', add: 1, pupils: 120, near: ['0,2'], answers: ['high'] },
      { need: 'fields', near: ['0,2'], answers: ['fields'] },
      { need: 'line', reach: ['2,0', '-3,0', '0,2'], answers: ['stops', 'ways'] },
    ]);
  });

  it('a lone neighborhood on an empty site needs a whole city around it', () => {
    const s = hoods(emptyLayout(), ['0,0']);
    expect(needsOf(s, RATES).map((n) => n.need)).toEqual([
      'ring',
      'modules',
      'plantUnits',
      'plantUnits',
      'plantUnits',
      'schools',
      'schools',
      'schools',
      'fields',
      'line',
    ]);
    expect(needsOf(s, RATES)[0]).toEqual({ need: 'ring', circle: '0,0', buildings: 1, answers: ['ring'] });
    expect(needsOf(s, RATES)[1]).toEqual({ need: 'modules', circle: '0,0', add: 2, answers: ['power'] });
  });

  it('a module that carries the peak only while it runs still asks for the spare (ADR-0012 Decision 3, amended)', () => {
    const s = must(addPlantUnit(hoods(emptyLayout(), ['0,0']), '4,0', 'power', RATES));
    const power = assess(s, RATES).checks.find((c) => c.id === 'power');
    expect(power?.status).toBe('bad');
    expect(power?.facts.check === 'power' ? power.facts.case : null).toBe('noSpare');
    expect(needsOf(s, RATES).find((n) => n.need === 'modules')).toEqual({ need: 'modules', circle: '0,0', add: 1, answers: ['power'] });
  });

  it('answers exactly the broken checks a built thing can mend, and no more', () => {
    const layouts = [
      starterLayout(),
      hoods(starterLayout(), ['2,0']),
      hoods({ ...starterLayout(), circles: ['0,0', '9,0'] }, ['6,0']),
      hoods(starterLayout(), THIRTEEN),
      hoods(emptyLayout(), ['0,0']),
      hoods(emptyLayout(), ['0,0', '1,0', '2,1']),
    ];
    for (const s of layouts) {
      expect(answered(needsOf(s, RATES))).toEqual(mendable(s).sort());
      expect(needsOf(s, RATES).length === 0).toBe(mendable(s).length === 0);
    }
  });

  it('meeting every need of thirteen neighborhoods leaves no line broken, and the size line waits on people', () => {
    let s = hoods(starterLayout(), THIRTEEN);
    s = must(addRingBuilding(s, '0,0', RATES));
    for (const kind of ['water', 'sewage', 'waste'] as const) s = must(addPlantUnit(s, plantTile(s, kind), kind, RATES));
    s = must(toggleExtra(s, '2,0', 'elementary', RATES));
    s = must(toggleExtra(s, '0,2', 'high', RATES));
    s = must(toggleExtra(s, '0,2', 'fields', RATES));
    s = must(layStretch(s, '1,0', '2,0', RATES));
    s = must(layStretch(s, '-1,0', '-2,0', RATES));
    s = must(layStretch(s, '-2,0', '-3,0', RATES));
    s = must(layStretch(s, '0,1', '0,2', RATES));
    expect(needsOf(s, RATES)).toEqual([]);
    const checks = assess(s, RATES).checks;
    expect(checks.filter((c) => c.status === 'bad')).toEqual([]);
    expect(checks.filter((c) => c.status === 'warn').map((c) => c.id)).toEqual(['size']);
    expect(checks.filter((c) => c.status === 'ok')).toHaveLength(15);
  });

  it('asks nothing of the layout it reads', () => {
    const s = hoods(starterLayout(), THIRTEEN);
    const before = JSON.stringify(s);
    needsOf(s, RATES);
    expect(JSON.stringify(s)).toBe(before);
  });
});
