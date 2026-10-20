/**
 * @file Where each need goes: proposals for a whole city are empty; an eleventh neighborhood is proposed one stretch of
 * line; every proposal is on the board, on open ground or a tile of its own kind; applying all of them through the
 * ordinary commands leaves no line broken; a board with no room says so rather than naming a tile a command refuses;
 * the next neighborhood goes nearest the ring, or the neighborhoods, or the middle (ADR-0015).
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  NEED_CHECKS,
  RATES,
  allTiles,
  applyProposal,
  assess,
  emptyLayout,
  kmBetween,
  needsOf,
  placeNeighborhood,
  proposeFor,
  proposeNeighborhood,
  starterLayout,
} from '../src/index.ts';
import type { Layout, Proposal, Step, TileKey } from '../src/index.ts';

function hoods(layout: Layout, keys: readonly TileKey[]): Layout {
  return keys.reduce((s, k) => {
    const o = placeNeighborhood(s, k, RATES);
    if (!o.ok) throw new Error(`refused: ${o.rejection.reason}`);
    return o.layout;
  }, layout);
}

/** Apply every proposal in order, failing on any refusal. */
function acceptAll(layout: Layout, proposals: readonly Proposal[]): Layout {
  return proposals.reduce((s, p) => {
    if (!p.room) throw new Error(`no room for ${p.need.need}`);
    const a = applyProposal(s, p.steps, RATES);
    if (!a.ok) throw new Error(`refused: ${a.rejection.reason}`);
    return a.layout;
  }, layout);
}

/** The tiles a step builds on. */
function tilesOf(step: Step): TileKey[] {
  return step.command === 'layStretch' ? [step.from, step.to] : [step.tile];
}

const CASES: readonly (readonly [string, Layout])[] = [
  ['an eleventh neighborhood', hoods(starterLayout(), ['2,0'])],
  ['one past the walk to the ring', hoods(starterLayout(), ['4,-2'])],
  ['thirteen neighborhoods', hoods(starterLayout(), ['2,0', '-3,0', '0,2'])],
  ['a lone neighborhood', hoods(emptyLayout(), ['0,0'])],
  ['four scattered neighborhoods', hoods(emptyLayout(), ['0,0', '1,0', '3,3', '-4,2'])],
];

describe('where each need goes', () => {
  it("the ledger's city is proposed nothing", () => {
    expect(proposeFor(starterLayout(), RATES)).toEqual([]);
  });

  it('an eleventh neighborhood is proposed one stretch to the line, at its price', () => {
    const ps = proposeFor(hoods(starterLayout(), ['2,0']), RATES);
    expect(ps).toHaveLength(1);
    const p = ps[0];
    if (!p?.room) throw new Error('no room');
    expect(p.need).toEqual({ need: 'line', reach: ['2,0'], answers: ['stops', 'ways'] });
    expect(p.steps).toEqual([{ command: 'layStretch', from: '2,0', to: '3,-1' }]);
    expect(p.build).toBeGreaterThan(30e6);
    expect(p.build).toBeLessThan(50e6);
    expect(p.run).toBeGreaterThan(0);
  });

  it('thirteen neighborhoods are proposed a ring building, a unit at each plant, two schools, fields and the line', () => {
    const ps = proposeFor(hoods(starterLayout(), ['2,0', '-3,0', '0,2']), RATES);
    expect(ps.map((p) => (p.room ? p.steps : []))).toEqual([
      [{ command: 'addRingBuilding', tile: '0,0' }],
      [{ command: 'addPlantUnit', tile: '3,-2', plant: 'water' }],
      [{ command: 'addPlantUnit', tile: '-3,1', plant: 'sewage' }],
      [{ command: 'addPlantUnit', tile: '-3,2', plant: 'waste' }],
      [{ command: 'toggleExtra', tile: '2,0', extra: 'elementary' }],
      [{ command: 'toggleExtra', tile: '0,2', extra: 'high' }],
      [{ command: 'toggleExtra', tile: '0,2', extra: 'fields' }],
      [
        { command: 'layStretch', from: '2,0', to: '3,-1' },
        { command: 'layStretch', from: '-3,0', to: '-3,1' },
        { command: 'layStretch', from: '0,2', to: '1,1' },
      ],
    ]);
  });

  for (const [name, layout] of CASES) {
    it(`${name}: every proposal is on the board, on open ground or a tile of its own kind`, () => {
      const board = allTiles(RATES.outline);
      let s = layout;
      for (const p of proposeFor(layout, RATES)) {
        if (!p.room) throw new Error('no room');
        for (const step of p.steps) {
          for (const k of tilesOf(step)) expect(board).toContain(k);
          const t = step.command === 'layStretch' ? undefined : s.tiles[step.tile];
          if (step.command === 'addRingBuilding') expect([undefined, 'ring']).toContain(t?.kind);
          if (step.command === 'addPlantUnit') expect([undefined, step.plant]).toContain(t?.kind);
          if (step.command === 'toggleExtra') {
            expect(t?.kind).toBe('hood');
            expect(t && t.kind === 'hood' ? t.has[step.extra] : true).toBeUndefined();
          }
        }
        const a = applyProposal(s, p.steps, RATES);
        if (!a.ok) throw new Error(a.rejection.reason);
        s = a.layout;
      }
    });

    it(`${name}: accepting every proposal leaves no line broken and nothing more needed`, () => {
      const s = acceptAll(layout, proposeFor(layout, RATES));
      expect(needsOf(s, RATES)).toEqual([]);
      const broken = assess(s, RATES).checks.filter((c) => c.status === 'bad');
      expect(broken).toEqual([]);
      expect(assess(layout, RATES).checks.some((c) => c.status === 'bad' && NEED_CHECKS.includes(c.id))).toBe(true);
    });
  }

  it('a new plant keeps off the ground beside the homes', () => {
    const s = hoods(emptyLayout(), ['0,0']);
    const plants = proposeFor(s, RATES).flatMap((p) => (p.room ? p.steps : [])).filter((x) => x.command === 'addPlantUnit');
    const after = acceptAll(s, proposeFor(s, RATES));
    expect(plants.length).toBeGreaterThan(0);
    for (const step of plants) {
      if (step.command !== 'addPlantUnit') continue;
      const [q, r] = step.tile.split(',').map(Number) as [number, number];
      const beside = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, -1],
        [-1, 1],
      ].map(([dq, dr]) => after.tiles[`${q + (dq ?? 0)},${r + (dr ?? 0)}`]?.kind);
      expect(beside).not.toContain('hood');
      expect(beside).not.toContain('ring');
    }
  });

  it('a board with no open ground for a ring says there is no room, and proposes nothing past it', () => {
    const full = hoods(emptyLayout(), allTiles(RATES.outline));
    const ps = proposeFor(full, RATES);
    expect(ps).toEqual([{ need: needsOf(full, RATES)[0], room: false }]);
    expect(ps[0]?.need.need).toBe('ring');
  });

  it('applying a proposal answers with every step\'s event and leaves the given layout as it was', () => {
    const s = hoods(starterLayout(), ['2,0', '-3,0', '0,2']);
    const before = JSON.stringify(s);
    const last = proposeFor(s, RATES).at(-1);
    if (!last?.room) throw new Error('no room');
    const a = applyProposal(s, last.steps, RATES);
    if (!a.ok) throw new Error(a.rejection.reason);
    expect(a.events.map((e) => e.type)).toEqual(['StretchLaid', 'StretchLaid', 'StretchLaid']);
    expect(Object.keys(a.layout.lines)).toHaveLength(Object.keys(s.lines).length + 3);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('applying a step a command refuses stops there with the rejection', () => {
    const a = applyProposal(starterLayout(), [{ command: 'toggleExtra', tile: '0,0', extra: 'fields' }], RATES);
    expect(a).toEqual({ ok: false, rejection: { reason: 'NotANeighborhood', tile: '0,0', extra: 'fields' } });
  });
});

describe('where the next neighborhood goes (ADR-0015 Decision 3)', () => {
  it('names the open tile nearest the ring, first in tile order among equals, and leaves the layout alone', () => {
    const s = starterLayout();
    const before = JSON.stringify(s);
    const at = proposeNeighborhood(s, RATES);
    expect(at).not.toBeNull();
    expect(s.tiles[at ?? '']).toBeUndefined();
    const ringKm = (k: TileKey): number => kmBetween(k, '0,0', RATES.stepKm);
    const open = allTiles(RATES.outline).filter((k) => !s.tiles[k]);
    const nearest = Math.min(...open.map(ringKm));
    expect(ringKm(at ?? '')).toBeCloseTo(nearest, 9);
    expect(at).toBe(open.find((k) => Math.abs(ringKm(k) - nearest) < 1e-9));
    expect(JSON.stringify(s)).toBe(before);
    expect(placeNeighborhood(s, at ?? '', RATES).ok).toBe(true);
  });

  it('with no ring goes next to the neighborhoods; with nothing standing, the middle; never a tile to avoid', () => {
    const lone = hoods(emptyLayout(), ['3,3']);
    const at = proposeNeighborhood(lone, RATES);
    expect(at).not.toBeNull();
    expect(kmBetween(at ?? '', '3,3', RATES.stepKm)).toBeCloseTo(RATES.stepKm, 9);
    expect(proposeNeighborhood(emptyLayout(), RATES)).toBe('0,0');
    expect(proposeNeighborhood(emptyLayout(), RATES, ['0,0'])).not.toBe('0,0');
    expect(kmBetween(proposeNeighborhood(emptyLayout(), RATES, ['0,0']) ?? '', '0,0', RATES.stepKm)).toBeCloseTo(RATES.stepKm, 9);
  });

  it('is null when no tile is open', () => {
    const tiles: Record<TileKey, { kind: 'hood'; has: Record<string, never> }> = {};
    for (const k of allTiles(RATES.outline)) tiles[k] = { kind: 'hood', has: {} };
    expect(proposeNeighborhood({ tiles, lines: {}, circles: ['0,0'] }, RATES)).toBeNull();
    const open = allTiles(RATES.outline);
    expect(proposeNeighborhood(emptyLayout(), RATES, open)).toBeNull();
  });
});
