/**
 * @file The second circle (ADR-0016 Decisions 1 and 3; `docs/domain/site.md` "The circles and the band", seventh
 * scenario): `openCircle` lays out another circle or refuses; a neighborhood in the second circle walks to the second
 * ring, not the first, and is served by its own band; the next neighborhood fills the first circle before the second;
 * and the line crosses the seam from band to band so that `haul` holds for both circles' plants.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  RATES,
  addPlantUnit,
  addRingBuilding,
  adjacent,
  erase,
  layStretch,
  lineNetwork,
  applyProposal,
  assess,
  bandOf,
  circleOf,
  circleTiles,
  edgeEnds,
  emptyLayout,
  moveInGate,
  needsOf,
  openCircle,
  placeNeighborhood,
  proposeCircle,
  proposeFor,
  proposeNeighborhood,
  starterLayout,
} from '../src/index.ts';
import type { Avoided, Layout, LineCheck, Outcome, Proposal } from '../src/index.ts';

const ok = (o: Outcome): Layout => {
  if (!o.ok) throw new Error(o.rejection.reason);
  return o.layout;
};
const checkOf = (l: Layout, id: LineCheck['id']): LineCheck | undefined => assess(l, RATES).checks.find((c) => c.id === id);

/** Accept every proposal with room, round after round, until the layout needs nothing or something has no room. */
function build(layout: Layout): { layout: Layout; noRoom: readonly Proposal[] } {
  let s = layout;
  for (let round = 0; round < 50; round++) {
    const ps = proposeFor(s, RATES);
    if (!ps.length) return { layout: s, noRoom: [] };
    const noRoom = ps.filter((p) => !p.room);
    const steps = ps.flatMap((p) => (p.room ? p.steps : []));
    if (!steps.length) return { layout: s, noRoom };
    const a = applyProposal(s, steps, RATES);
    if (!a.ok) throw new Error(a.rejection.reason);
    s = a.layout;
    if (noRoom.length) return { layout: s, noRoom };
  }
  throw new Error('the circle never settled');
}

/** The starter grown by proposal, one neighborhood after another, until the first circle has no room. */
function firstCircleFull(layout: Layout): Layout {
  let s = build(layout).layout;
  for (let i = 0; i < 40; i++) {
    const at = proposeNeighborhood(s, RATES);
    if (!at || circleOf(s.circles, at) !== '0,0') return s;
    s = build(ok(placeNeighborhood(s, at, RATES))).layout;
  }
  throw new Error('the first circle never filled');
}

const two = (): Layout => ok(openCircle(starterLayout(), '9,0', RATES));

describe('openCircle', () => {
  it('at 9,0 on the starter answers CircleOpened, and the two bands touch at a seam with no tile in both', () => {
    const o = openCircle(starterLayout(), '9,0', RATES);
    expect(o.ok && o.event).toEqual({ type: 'CircleOpened', middle: '9,0' });
    const s = ok(o);
    expect(s.circles).toEqual(['0,0', '9,0']);
    expect(s.tiles).toEqual(starterLayout().tiles);
    expect(s.lines).toEqual(starterLayout().lines);
    const seam = bandOf('0,0').filter((a) => bandOf('9,0').some((b) => adjacent(a, b, RATES.outline)));
    expect(seam.length).toBeGreaterThan(0);
    for (const k of circleTiles('9,0')) expect(circleOf(['0,0'], k)).toBeNull();
  });

  it('at 4,0 is refused CircleOverlaps naming the shared tile; at 20,0 and 12,0 OffBoard; at 0,0 CircleOverlaps; the layout unchanged', () => {
    const start = starterLayout();
    const over = openCircle(start, '4,0', RATES);
    expect(!over.ok && over.rejection).toEqual({ reason: 'CircleOverlaps', tile: '4,0', shared: '4,0' });
    expect(!openCircle(start, '20,0', RATES).ok && openCircle(start, '20,0', RATES)).toMatchObject({ rejection: { reason: 'OffBoard', tile: '20,0' } });
    expect(openCircle(start, '12,0', RATES)).toMatchObject({ ok: false, rejection: { reason: 'OffBoard', tile: '12,0' } });
    expect(openCircle(start, '0,0', RATES)).toMatchObject({ ok: false, rejection: { reason: 'CircleOverlaps', tile: '0,0' } });
    expect(openCircle(two(), '9,0', RATES)).toMatchObject({ ok: false, rejection: { reason: 'CircleOverlaps', tile: '9,0', shared: '9,0' } });
    expect(openCircle(starterLayout(), '5,0', RATES)).toMatchObject({ ok: false, rejection: { reason: 'CircleOverlaps', tile: '5,0', shared: '4,0' } });
    expect(start).toEqual(starterLayout());
  });

  it('the next circle is proposed 9 steps east along the shore, never when it is closed, does not fit, or there is no circle to stand beside', () => {
    expect(proposeCircle(starterLayout(), RATES)).toBe('9,0');
    expect(proposeCircle(starterLayout(), RATES, ['9,0'])).toBeNull();
    expect(proposeCircle(two(), RATES)).toBeNull();
    expect(proposeCircle({ ...emptyLayout(), circles: [] }, RATES)).toBeNull();
    const o = openCircle(starterLayout(), proposeCircle(starterLayout(), RATES) ?? '', RATES);
    expect(o.ok).toBe(true);
  });

  it('on a layout with no circles opens the first', () => {
    const o = openCircle({ ...emptyLayout(), circles: [] }, '9,0', RATES);
    expect(o.ok && o.layout.circles).toEqual(['9,0']);
  });
});

describe('a neighborhood in the second circle', () => {
  it('walks to the second ring, not the first, and without one its circle has no ring while the first ring stands', () => {
    const lone = ok(placeNeighborhood(two(), '8,0', RATES));
    const none = assess(lone, RATES);
    expect(none.per['8,0']?.ring).toBeNull();
    expect(checkOf(lone, 'ring')).toMatchObject({ status: 'bad', tiles: ['8,0'], facts: { case: 'none', rings: 1, short: [{ circle: '9,0', has: 0, needed: 1 }] } });
    expect(none.per['0,0']?.load).toBe(50000);
    expect(checkOf(lone, 'work')?.status).toBe('ok');
    expect(needsOf(lone, RATES)[0]).toEqual({ need: 'ring', circle: '9,0', buildings: 1, answers: ['ring'] });
    const ringed = ok(addRingBuilding(lone, '9,0', RATES));
    const r = assess(ringed, RATES);
    expect(r.per['8,0']?.ring?.key).toBe('9,0');
    expect(r.per['9,0']?.load).toBe(5000);
    expect(r.per['0,0']?.load).toBe(50000);
    expect(checkOf(ringed, 'ring')?.status).toBe('ok');
  });

  it('is served by its own band: the first circle\'s plants do not count for it, and the gate holds it while they are the only ones', () => {
    const lone = ok(placeNeighborhood(two(), '8,0', RATES));
    for (const kind of ['water', 'sewage', 'waste'] as const) {
      expect(checkOf(lone, kind)).toMatchObject({ status: 'bad', tiles: [], facts: { case: 'short', short: [{ circle: '9,0', has: 0, needed: 1 }] } });
    }
    expect(checkOf(lone, 'power')).toMatchObject({ status: 'bad', facts: { case: 'short', short: [{ circle: '9,0', has: 0, needed: 2 }] } });
    expect(moveInGate(lone, RATES, '8,0', {}).short).toEqual(['power', 'water', 'sewage', 'waste']);
    expect(moveInGate(lone, RATES, '1,0', {}).short).toEqual([]);
    expect(needsOf(lone, RATES).filter((n) => n.need === 'plantUnits')).toEqual([
      { need: 'plantUnits', circle: '9,0', plant: 'water', add: 1, answers: ['water'] },
      { need: 'plantUnits', circle: '9,0', plant: 'sewage', add: 1, answers: ['sewage'] },
      { need: 'plantUnits', circle: '9,0', plant: 'waste', add: 1, answers: ['waste'] },
    ]);
    let served = lone;
    for (const [k, kind] of [['5,4', 'water'], ['7,4', 'sewage'], ['6,4', 'waste'], ['8,4', 'power']] as const) served = ok(addPlantUnit(served, k, kind, RATES));
    served = ok(addPlantUnit(served, '8,4', 'power', RATES));
    for (const kind of ['water', 'sewage', 'waste', 'power'] as const) expect(checkOf(served, kind)?.status).toBe('ok');
    expect(moveInGate(served, RATES, '8,0', {}).short).toEqual([]);
    expect(checkOf(served, 'flow')).toMatchObject({ status: 'ok', facts: { case: 'ordered', circles: 2 } });
    // The other way round: the first circle short, the second served; and a module without its spare carries people.
    const dry = ok(erase(served, '-3,4', RATES));
    expect(checkOf(dry, 'water')).toMatchObject({ status: 'bad', tiles: [], facts: { short: [{ circle: '0,0', has: 0, needed: 1 }] } });
    expect(moveInGate(dry, RATES, '8,0', {}).short).toEqual([]);
    expect(moveInGate(dry, RATES, '1,0', {}).short).toEqual(['water']);
    const oneModule = ok(erase(served, '8,4', RATES));
    expect(checkOf(oneModule, 'power')).toMatchObject({ status: 'bad', tiles: ['8,4'], facts: { case: 'noSpare', short: [{ circle: '9,0', has: 1, needed: 2 }] } });
    expect(moveInGate(oneModule, RATES, '8,0', {}).short).toEqual([]);
  });

  it('its ring is proposed on its own middle; vetoed there, elsewhere in its circle; vetoed everywhere in it, no room, and nothing goes in the first circle', () => {
    const lone = ok(placeNeighborhood(two(), '8,0', RATES));
    const ringStep = (avoid: readonly Avoided[]): Proposal | undefined => proposeFor(lone, RATES, avoid).find((p) => p.need.need === 'ring');
    const plain = ringStep([]);
    expect(plain && plain.room && plain.steps[0]).toEqual({ command: 'addRingBuilding', tile: '9,0' });
    const moved = ringStep([{ what: 'ring', at: '9,0' }]);
    const tile = moved && moved.room && moved.steps[0]?.command === 'addRingBuilding' ? moved.steps[0].tile : null;
    expect(tile).not.toBe('9,0');
    expect(circleOf(lone.circles, tile ?? '')).toBe('9,0');
    const ringed = ok(addRingBuilding(lone, tile ?? '', RATES));
    expect(assess(ringed, RATES).per['8,0']?.ring?.key).toBe(tile);
    const everywhere = circleTiles('9,0').map((k) => ({ what: 'ring', at: k }));
    const none = proposeFor(lone, RATES, everywhere);
    expect(none[0]).toEqual({ need: { need: 'ring', circle: '9,0', buildings: 1, answers: ['ring'] }, room: false });
    expect(none).toHaveLength(1);
  });

  it('the next neighborhood fills the first circle before the second, then goes beside the second middle', () => {
    expect(circleOf(two().circles, proposeNeighborhood(two(), RATES) ?? '')).toBe('0,0');
    const full = firstCircleFull(two());
    expect(Object.keys(full.tiles).filter((k) => full.tiles[k]?.kind === 'hood' && circleOf(full.circles, k) === '0,0')).toHaveLength(36);
    expect(proposeNeighborhood(full, RATES)).toBe('9,-1');
    expect(proposeNeighborhood({ ...full, circles: ['0,0'] }, RATES)).toBeNull();
  });
});

describe('the line across the seam', () => {
  it('a full first circle and the second circle\'s first neighborhood: its ring, its plants in its band, the stretches joining the circles, lines 5 and 16 held', () => {
    const full = firstCircleFull(two());
    const at = proposeNeighborhood(full, RATES);
    const { layout: s, noRoom } = build(ok(placeNeighborhood(full, at ?? '', RATES)));
    expect(noRoom).toEqual([]);
    expect(s.tiles['9,0']?.kind).toBe('ring');
    const second = Object.keys(s.tiles).filter((k) => circleOf(s.circles, k) === '9,0');
    const plants = second.filter((k) => ['power', 'water', 'sewage', 'waste'].includes(s.tiles[k]?.kind ?? ''));
    expect(plants.map((k) => s.tiles[k]?.kind).sort()).toEqual(['power', 'sewage', 'waste', 'water']);
    for (const k of plants) expect(bandOf('9,0')).toContain(k);
    const seam = Object.keys(s.lines).filter((e) => {
      const [a, b] = edgeEnds(e);
      return circleOf(s.circles, a) !== circleOf(s.circles, b);
    });
    expect(seam.length).toBeGreaterThanOrEqual(1);
    for (const e of seam) for (const end of edgeEnds(e)) expect(bandOf(circleOf(s.circles, end) ?? '')).toContain(end);
    for (const e of Object.keys(s.lines)) for (const end of edgeEnds(e)) expect(circleOf(s.circles, end)).not.toBeNull();
    const a = assess(s, RATES);
    expect(a.per['9,-1']?.ring?.key).toBe('9,0');
    expect(checkOf(s, 'haul')).toMatchObject({ status: 'ok', facts: { case: 'reached' } });
    expect(checkOf(s, 'work')).toMatchObject({ status: 'ok' });
    expect(checkOf(s, 'flow')).toMatchObject({ status: 'ok', facts: { case: 'ordered', circles: 2 } });
    expect(a.checks.filter((c) => c.status === 'bad')).toEqual([]);
    expect(needsOf(s, RATES)).toEqual([]);
  });

  it('a second ring with no line: the line runs from the neighborhood to its ring and on to the first ring\'s network; already joined to its ring, only the seam run is added', () => {
    const s = ok(addRingBuilding(ok(placeNeighborhood(two(), '8,0', RATES)), '9,0', RATES));
    const line = proposeFor(s, RATES).find((p) => p.need.need === 'line');
    if (!line || !line.room) throw new Error('no line proposed');
    const steps = line.steps.filter((st) => st.command === 'layStretch');
    expect(steps[0]).toEqual({ command: 'layStretch', from: '8,0', to: '9,0' });
    const joined = applyProposal(s, steps, RATES);
    if (!joined.ok) throw new Error(joined.rejection.reason);
    const net = lineNetwork(joined.layout.lines);
    expect(net.segments('8,0', '9,0')).toBe(1);
    expect(net.segments('8,0', '0,0')).not.toBeNull();
    expect(checkOf(joined.layout, 'stops')?.status).toBe('ok');
    expect(checkOf(joined.layout, 'haul')?.status).toBe('ok');
    for (const e of Object.keys(joined.layout.lines)) for (const end of edgeEnds(e)) expect(circleOf(s.circles, end)).not.toBeNull();
    // Joined to its own ring already: the proposal adds the seam run only, and never re-lays a standing stretch.
    const own = ok(layStretch(s, '8,0', '9,0', RATES));
    const seamOnly = proposeFor(own, RATES).find((p) => p.need.need === 'line');
    if (!seamOnly || !seamOnly.room) throw new Error('no line proposed');
    const laid = seamOnly.steps.filter((st) => st.command === 'layStretch');
    expect(laid.length).toBe(steps.length - 1);
    for (const st of laid) if (st.command === 'layStretch') expect(own.lines[`${st.from}|${st.to}`] ?? own.lines[`${st.to}|${st.from}`]).toBeUndefined();
    expect(applyProposal(own, laid, RATES).ok).toBe(true);
  });

  it('a layout with no circles keeps the sketch\'s rule: the line joins any ring, nothing is judged by circle, and no ring means no line', () => {
    const free: Layout = { ...emptyLayout(), circles: [] };
    const s = ok(placeNeighborhood(free, '0,0', RATES));
    expect(needsOf(s, RATES)[0]).toEqual({ need: 'ring', circle: null, buildings: 1, answers: ['ring'] });
    expect(checkOf(s, 'water')).toMatchObject({ facts: { short: [{ circle: null, has: 0, needed: 1 }] } });
    const far = ok(addRingBuilding(ok(placeNeighborhood(s, '4,0', RATES)), '1,0', RATES));
    const grown = build(far).layout;
    expect(Object.keys(grown.lines).length).toBeGreaterThan(0);
    expect(assess(grown, RATES).per['4,0']?.ring?.key).toBe('1,0');
    expect(checkOf(grown, 'stops')?.status).toBe('ok');
    const noRing = proposeFor(ok(placeNeighborhood(s, '4,0', RATES)), RATES);
    expect(noRing[0]?.need.need).toBe('ring');
  });
});
