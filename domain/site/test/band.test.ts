/**
 * @file Plants stand in the band (ADR-0016 Decisions 2, 4 and 5; `docs/domain/site.md` "The circles and the band"):
 * the three rejections with the layout unchanged, what a restore drops, the starter's plants on the shore, the `flow`
 * check for line 32 in each of its cases, and the intake need a reversed flow raises with where the proposal puts it.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  NEED_CHECKS,
  RATES,
  addPlantUnit,
  addRingBuilding,
  applyProposal,
  assess,
  bandOf,
  circleOf,
  emptyLayout,
  erase,
  layStretch,
  needsOf,
  placeNeighborhood,
  proposeFor,
  restoreLayout,
  ringDistance,
  shoreTiles,
  starterLayout,
  toggleExtra,
  upstreamOf,
} from '../src/index.ts';
import type { Layout, LineCheck, Outcome } from '../src/index.ts';

const ok = (o: Outcome): Layout => {
  if (!o.ok) throw new Error(o.rejection.reason);
  return o.layout;
};
const flowOf = (l: Layout): LineCheck => {
  const c = assess(l, RATES).checks.find((k) => k.id === 'flow');
  if (!c) throw new Error('no flow check');
  return c;
};

describe('the band rule in the commands', () => {
  const start = starterLayout();
  const frozen = JSON.parse(JSON.stringify(start)) as Layout;

  it('a plant off the band is refused OutsideBand, and the layout is unchanged', () => {
    for (const k of ['3,0', '1,2', '0,-3']) {
      expect(addPlantUnit(start, k, 'water', RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideBand', tile: k } });
    }
    expect(addPlantUnit(start, '4,0', 'water', RATES).ok).toBe(true);
    expect(start).toEqual(frozen);
  });

  it('a neighborhood, a ring building or a school on the band is refused InsideBand', () => {
    for (const k of bandOf('0,0')) {
      if (start.tiles[k]) continue;
      expect(placeNeighborhood(start, k, RATES)).toEqual({ ok: false, rejection: { reason: 'InsideBand', tile: k } });
      expect(addRingBuilding(start, k, RATES)).toEqual({ ok: false, rejection: { reason: 'InsideBand', tile: k } });
      expect(toggleExtra(start, k, 'fields', RATES)).toEqual({ ok: false, rejection: { reason: 'InsideBand', tile: k } });
    }
    expect(placeNeighborhood(start, '3,0', RATES).ok).toBe(true);
  });

  it('anything on a tile outside every circle is refused OutsideCircle; erase there says NothingThere', () => {
    for (const k of ['5,0', '15,-4', '-6,4']) {
      expect(placeNeighborhood(start, k, RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideCircle', tile: k } });
      expect(addRingBuilding(start, k, RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideCircle', tile: k } });
      expect(addPlantUnit(start, k, 'power', RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideCircle', tile: k } });
      expect(toggleExtra(start, k, 'high', RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideCircle', tile: k } });
      expect(erase(start, k, RATES)).toEqual({ ok: false, rejection: { reason: 'NothingThere', tile: k } });
    }
    expect(layStretch(start, '4,0', '5,0', RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideCircle', tile: '5,0' } });
    expect(layStretch(start, '5,0', '4,0', RATES)).toEqual({ ok: false, rejection: { reason: 'OutsideCircle', tile: '5,0' } });
    expect(layStretch(start, '3,0', '4,0', RATES).ok).toBe(true);
    expect(start).toEqual(frozen);
  });

  it('with two circles the line may cross the seam from band to band, and a layout with no circles refuses none of this', () => {
    const two: Layout = { ...start, circles: ['0,0', '9,0'] };
    expect(layStretch(two, '4,0', '5,0', RATES).ok).toBe(true);
    expect(addPlantUnit(two, '5,0', 'water', RATES).ok).toBe(true);
    expect(placeNeighborhood(two, '7,0', RATES).ok).toBe(true);
    const free: Layout = { ...start, circles: [] };
    expect(addPlantUnit(free, '3,0', 'water', RATES).ok).toBe(true);
    expect(placeNeighborhood(free, '15,-4', RATES).ok).toBe(true);
  });
});

describe('what a restore keeps', () => {
  it('drops a plant off the band, a home or ring on it, and tiles and stretches outside every circle', () => {
    const r = restoreLayout(
      {
        tiles: { '3,0': { kind: 'water', n: 1 }, '4,0': { kind: 'hood' }, '4,1': { kind: 'ring', n: 2 }, '15,-4': { kind: 'hood' }, '-4,4': { kind: 'water', n: 2 }, '1,0': { kind: 'hood' } },
        lines: { '0,0|1,0': true, '4,0|5,0': true, '5,0|6,0': true, '3,0|4,0': true },
        circles: ['0,0'],
      },
      RATES,
    );
    expect(r).toEqual({ tiles: { '-4,4': { kind: 'water', n: 2 }, '1,0': { kind: 'hood', has: {} } }, lines: { '0,0|1,0': true, '3,0|4,0': true }, circles: ['0,0'] });
  });
});

describe("the starter's plants on the shore", () => {
  it('stand on the shore side of the band, on the line, water upstream of sewage, with flow holding and 15 of 16 lines', () => {
    const s = starterLayout();
    const shore = shoreTiles('0,0', RATES.outline);
    for (const [k, kind] of [['-3,4', 'water'], ['-2,4', 'waste'], ['-1,4', 'sewage'], ['0,4', 'power']] as const) {
      expect(s.tiles[k]?.kind).toBe(kind);
      expect(shore).toContain(k);
    }
    expect(upstreamOf('-3,4', '-1,4', RATES.current)).toBe(true);
    const a = assess(s, RATES);
    expect(a.checks.find((c) => c.id === 'haul')?.status).toBe('ok');
    expect(flowOf(s)).toMatchObject({ status: 'ok', lines: [32], tiles: [], facts: { check: 'flow', case: 'ordered', circles: 1 } });
    expect(a.checks).toHaveLength(16);
    expect(a.checks.filter((c) => c.status === 'ok')).toHaveLength(15);
  });
});

describe('the flow check, line 32', () => {
  it('is idle while a circle lacks a water or a sewage plant, or the layout has no circles', () => {
    expect(flowOf(emptyLayout())).toMatchObject({ status: 'idle', facts: { check: 'flow', case: 'idle' } });
    const noSewage = ok(erase(starterLayout(), '-1,4', RATES));
    expect(flowOf(noSewage).status).toBe('idle');
    expect(flowOf({ ...starterLayout(), circles: [] }).status).toBe('idle');
  });

  it('breaks when the outfall is upstream of the intake, marking both plants, and holds again when a water plant stands upstream', () => {
    let s = ok(erase(starterLayout(), '-3,4', RATES));
    s = ok(addPlantUnit(s, '0,4', 'power', RATES));
    s = ok(erase(s, '0,4', RATES));
    s = ok(erase(s, '0,4', RATES));
    s = ok(erase(s, '0,4', RATES));
    s = ok(erase(s, '0,4', RATES));
    s = ok(addPlantUnit(s, '0,4', 'water', RATES));
    const reversed = flowOf(s);
    expect(reversed).toMatchObject({ status: 'bad', tiles: ['0,4', '-1,4'], facts: { check: 'flow', case: 'reversed', circles: 1, water: ['0,4'], sewage: ['-1,4'] } });
    const a = assess(s, RATES);
    expect(a.per['0,4']?.issues).toEqual([{ kind: 'flowReversed' }]);
    expect(a.per['-1,4']?.issues).toEqual([{ kind: 'flowReversed' }]);
    const mended = ok(addPlantUnit(s, '-4,4', 'water', RATES));
    expect(flowOf(mended).status).toBe('ok');
  });

  it('judges each circle on its own: a second circle with its plants reversed breaks while the first holds', () => {
    let s: Layout = { ...starterLayout(), circles: ['0,0', '9,0'] };
    s = ok(addPlantUnit(s, '5,4', 'sewage', RATES));
    s = ok(addPlantUnit(s, '9,4', 'water', RATES));
    expect(flowOf(s)).toMatchObject({ status: 'bad', facts: { case: 'reversed', circles: 1, water: ['9,4'], sewage: ['5,4'] } });
    s = ok(addPlantUnit(s, '6,4', 'water', RATES));
    expect(flowOf(s)).toMatchObject({ status: 'bad', facts: { water: ['6,4'], sewage: ['5,4'] } });
    s = ok(addPlantUnit(s, '8,4', 'sewage', RATES));
    expect(flowOf(s)).toMatchObject({ status: 'ok', facts: { case: 'ordered', circles: 2 } });
  });

  it('a reversed flow is a need the proposal answers with a water unit on the open band tile farthest upstream', () => {
    let s = ok(erase(starterLayout(), '-3,4', RATES));
    for (let i = 0; i < 4; i++) s = ok(erase(s, '0,4', RATES));
    s = ok(addPlantUnit(s, '0,4', 'water', RATES));
    expect(NEED_CHECKS).toContain('flow');
    const need = needsOf(s, RATES).find((n) => n.need === 'intake');
    expect(need).toEqual({ need: 'intake', sewage: ['-1,4'], answers: ['flow'] });
    const p = proposeFor(s, RATES).find((x) => x.need.need === 'intake');
    if (!p || !p.room) throw new Error('no intake proposal');
    // The new intake comes with the stretch that joins it to the line (ADR-0019).
    expect(p.steps).toEqual([
      { command: 'addPlantUnit', tile: '-4,4', plant: 'water' },
      { command: 'layStretch', from: '-4,4', to: '-3,4' },
    ]);
    const after = applyProposal(s, p.steps, RATES);
    expect(after.ok && flowOf(after.layout).status).toBe('ok');
    expect(after.ok && needsOf(after.layout, RATES).some((n) => n.need === 'intake')).toBe(false);
  });
});

describe('where a new plant goes', () => {
  const lone: Layout = ok(placeNeighborhood(emptyLayout(), '0,0', RATES));
  const plantsOf = (ps: ReturnType<typeof proposeFor>): Record<string, string> => {
    const at: Record<string, string> = {};
    for (const p of ps) if (p.room) for (const st of p.steps) if (st.command === 'addPlantUnit') at[st.plant] = st.tile;
    return at;
  };

  it('on a lone neighborhood every plant is proposed on the shore, water upstream of sewage, the reactor and waste works beside the sewage plant', () => {
    const ps = proposeFor(lone, RATES);
    const at = plantsOf(ps);
    const shore = shoreTiles('0,0', RATES.outline);
    for (const kind of ['power', 'water', 'sewage', 'waste']) expect(shore, kind).toContain(at[kind]);
    expect(upstreamOf(at['water'] ?? '', at['sewage'] ?? '', RATES.current)).toBe(true);
    expect(at['water']).toBe('-4,4');
    expect(ringDistance(at['power'] ?? '', at['sewage'] ?? '')).toBe(1);
    expect(ringDistance(at['waste'] ?? '', at['sewage'] ?? '')).toBeLessThanOrEqual(2);
    const built = applyProposal(lone, ps.flatMap((p) => (p.room ? p.steps : [])), RATES);
    if (!built.ok) throw new Error(built.rejection.reason);
    for (const [kind, k] of Object.entries(at)) expect(built.layout.tiles[k]?.kind).toBe(kind);
    expect(flowOf(built.layout).status).toBe('ok');
    for (const e of Object.keys(built.layout.lines)) for (const end of e.split('|')) expect(circleOf(built.layout.circles, end)).toBe('0,0');
    expect(assess(built.layout, RATES).checks.filter((c) => c.status === 'bad')).toEqual([]);
  });

  it('when the shore is full the band takes the plant; when a circle\'s band is full its plant has no room, never the next circle (its people are served by its own band); sewage with no tile downstream takes the farthest down', () => {
    let s: Layout = { ...lone, circles: ['0,0', '9,0'] };
    for (const k of shoreTiles('0,0', RATES.outline)) s = ok(addPlantUnit(s, k, 'waste', RATES));
    let at = plantsOf(proposeFor(s, RATES));
    expect(at['water']).toBeDefined();
    expect(bandOf('0,0')).toContain(at['water']);
    expect(shoreTiles('0,0', RATES.outline)).not.toContain(at['water']);
    let full: Layout = { ...lone, circles: ['0,0', '9,0'] };
    for (const k of bandOf('0,0')) full = ok(addPlantUnit(full, k, 'waste', RATES));
    const ps = proposeFor(full, RATES);
    at = plantsOf(ps);
    expect(at['water']).toBeUndefined();
    const last = ps[ps.length - 1];
    expect(last && !last.room ? last.need : null).toEqual({ need: 'modules', circle: '0,0', add: 2, answers: ['power'] });
    for (const p of ps) if (p.room) for (const st of p.steps) if (st.command !== 'layStretch') expect(circleOf(full.circles, st.tile)).toBe('0,0');
    let down: Layout = ok(addPlantUnit(lone, '0,4', 'water', RATES));
    at = plantsOf(proposeFor(down, RATES));
    expect(at['sewage']).toBe('-2,4'); // -1,4 went to the reactor, proposed first beside nothing
    down = ok(addPlantUnit(down, at['sewage'] ?? '', 'sewage', RATES));
    expect(flowOf(down).status).toBe('bad');
  });

  it('the flow fact counts only the circles with both plants: one judged and one idle reads as one', () => {
    let s: Layout = { ...starterLayout(), circles: ['0,0', '9,0'] };
    s = ok(addPlantUnit(s, '9,4', 'water', RATES));
    expect(flowOf(s)).toMatchObject({ status: 'ok', facts: { case: 'ordered', circles: 1 } });
    const apart: Layout = { ...ok(erase(starterLayout(), '-1,4', RATES)), circles: ['0,0', '9,0'] };
    expect(flowOf(ok(addPlantUnit(apart, '8,4', 'sewage', RATES))).status).toBe('idle');
  });
});
