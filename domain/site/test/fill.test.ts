/**
 * @file A circle fills from the middle out (ADR-0016; `docs/domain/site.md` "The circles and the band", sixth
 * scenario): one neighborhood on an empty circle proposed every need with room; 36 neighborhoods placed by
 * `proposeNeighborhood` fill hex rings 1 to 3 nearest the ring first and the 37th call answers null; 20 neighborhoods
 * and the proposals that follow hold every line at 100,000 people; and a vetoed piece is proposed elsewhere, or has no
 * room when every place for it is vetoed (ADR-0015 Decision 5, `proposeFor`'s avoid list).
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import {
  BAND_RING,
  HOME_RINGS,
  RATES,
  applyProposal,
  assess,
  bandOf,
  emptyLayout,
  placeNeighborhood,
  proposeFor,
  proposeNeighborhood,
  ringDistance,
  shoreTiles,
} from '../src/index.ts';
import type { Avoided, Layout, Outcome, Proposal } from '../src/index.ts';

const ok = (o: Outcome): Layout => {
  if (!o.ok) throw new Error(o.rejection.reason);
  return o.layout;
};

/** Accept every proposal with room, round after round, until the layout needs nothing or something has no room. */
function build(layout: Layout, avoid: readonly Avoided[] = []): { layout: Layout; noRoom: readonly Proposal[] } {
  let s = layout;
  for (let round = 0; round < 50; round++) {
    const ps = proposeFor(s, RATES, avoid);
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

const hoods = (l: Layout): string[] => Object.keys(l.tiles).filter((k) => l.tiles[k]?.kind === 'hood');
const plants = (l: Layout): string[] => Object.keys(l.tiles).filter((k) => ['power', 'water', 'sewage', 'waste'].includes(l.tiles[k]?.kind ?? ''));

/** Neighborhoods placed one after another where the Site puts the next one. */
function grown(n: number): Layout {
  const first = proposeNeighborhood(emptyLayout(), RATES);
  let s = ok(placeNeighborhood(emptyLayout(), first ?? '', RATES));
  s = build(s).layout;
  for (let i = 1; i < n; i++) {
    const at = proposeNeighborhood(s, RATES);
    if (!at) throw new Error(`no room for neighborhood ${i + 1}`);
    s = ok(placeNeighborhood(s, at, RATES));
    s = build(s).layout;
  }
  return s;
}

describe('a circle fills from the middle out', () => {
  it('one neighborhood on an empty circle is proposed every need with room, the ring at the middle, plants on the shore, everything else inside the band, no line broken', () => {
    const one = ok(placeNeighborhood(emptyLayout(), '0,-1', RATES));
    const ps = proposeFor(one, RATES);
    expect(ps.length).toBeGreaterThanOrEqual(10);
    expect(ps.every((p) => p.room)).toBe(true);
    const { layout, noRoom } = build(one);
    expect(noRoom).toEqual([]);
    const shore = shoreTiles('0,0', RATES.outline);
    for (const k of plants(layout)) expect(shore).toContain(k);
    expect(layout.tiles['0,0']?.kind).toBe('ring');
    for (const k of Object.keys(layout.tiles)) {
      if (plants(layout).includes(k)) continue;
      expect(ringDistance('0,0', k)).toBeLessThanOrEqual(HOME_RINGS);
    }
    expect(assess(layout, RATES).checks.filter((c) => c.status === 'bad')).toEqual([]);
  });

  it('36 neighborhoods fill hex rings 1 to 3 nearest the ring first, and the 37th has no room', () => {
    const full = grown(36);
    const h = hoods(full);
    expect(h).toHaveLength(36);
    const ring = Object.keys(full.tiles).find((k) => full.tiles[k]?.kind === 'ring');
    expect(ring).toBe('0,0');
    for (const k of h) {
      expect(ringDistance(ring ?? '', k)).toBeLessThanOrEqual(HOME_RINGS);
      expect(ringDistance(ring ?? '', k)).toBeGreaterThan(0);
    }
    for (const k of bandOf(ring ?? '')) expect(full.tiles[k]?.kind ?? 'open').not.toBe('hood');
    expect(proposeNeighborhood(full, RATES)).toBeNull();
    const twenty = grown(20);
    const rings = hoods(twenty).map((k) => ringDistance('0,0', k));
    expect(rings.filter((r) => r === 1)).toHaveLength(6);
    expect(rings.filter((r) => r === 2)).toHaveLength(12);
    expect(rings.filter((r) => r === 3)).toHaveLength(2);
    expect(Math.max(...rings)).toBe(BAND_RING - 1);
    // Filling the circle with proposals takes seconds, more on the publish workflow's runner: past vitest's five.
  }, 60000);

  it('20 neighborhoods and what they call for hold every line at 100,000 people, on 2 units of each plant and 3 modules', () => {
    const city = grown(20);
    const a = assess(city, RATES);
    expect(a.score.pop).toBe(100000);
    expect(a.checks.filter((c) => c.status === 'bad')).toEqual([]);
    const units = (kind: string): number => Object.values(city.tiles).filter((t) => t.kind === kind).reduce((n, t) => n + (t.kind === 'hood' ? 0 : t.n), 0);
    expect(units('water')).toBe(2);
    expect(units('sewage')).toBe(2);
    expect(units('waste')).toBe(2);
    expect(units('power')).toBe(3);
    expect(a.checks.find((c) => c.id === 'flow')?.status).toBe('ok');
  });
});

describe('a vetoed piece is proposed elsewhere', () => {
  const one = ok(placeNeighborhood(emptyLayout(), '0,-1', RATES));

  it('a vetoed water tile sends the water plant to the next shore tile upstream of the sewage plant', () => {
    const plain = proposeFor(one, RATES).flatMap((p) => (p.room ? p.steps : [])).find((s) => s.command === 'addPlantUnit' && s.plant === 'water');
    expect(plain).toEqual({ command: 'addPlantUnit', tile: '-4,4', plant: 'water' });
    const avoid: Avoided[] = [{ what: 'water', at: '-4,4' }];
    const steps = proposeFor(one, RATES, avoid).flatMap((p) => (p.room ? p.steps : []));
    const water = steps.filter((s) => s.command === 'addPlantUnit' && s.plant === 'water');
    expect(water).toHaveLength(1);
    expect(water[0]).toMatchObject({ tile: '-3,4' });
    const built = build(one, avoid).layout;
    expect(built.tiles['-4,4']).toBeUndefined();
    expect(built.tiles['-3,4']?.kind).toBe('water');
    expect(assess(built, RATES).checks.filter((c) => c.status === 'bad')).toEqual([]);
  });

  it('vetoing every band tile for a plant leaves its need with no room, and nothing of that kind is placed', () => {
    const everywhere: Avoided[] = bandOf('0,0').map((at) => ({ what: 'sewage', at }));
    const { layout, noRoom } = build(one, everywhere);
    expect(noRoom.map((p) => p.need.need)).toContain('plantUnits');
    expect(noRoom.find((p) => p.need.need === 'plantUnits')?.need).toMatchObject({ plant: 'sewage' });
    expect(Object.values(layout.tiles).some((t) => t.kind === 'sewage')).toBe(false);
    expect(layout.tiles['0,0']?.kind).toBe('ring');
    expect(Object.values(layout.tiles).some((t) => t.kind === 'water')).toBe(true);
  });

  it('a vetoed stretch is routed round inside the circle, and the same tiles are still joined to the ring', () => {
    const served = build(one).layout;
    const edges = Object.keys(served.lines).sort();
    const edge = edges.find((e) => e.indexOf('0,0') < 0) ?? edges[0] ?? '';
    expect(served.lines[edge]).toBe(true);
    const rerouted = build(one, [{ what: 'line', at: edge }]).layout;
    expect(rerouted.lines[edge]).toBeUndefined();
    const added = Object.keys(rerouted.lines).filter((e) => !served.lines[e]);
    expect(added.length).toBeGreaterThan(0);
    for (const e of Object.keys(rerouted.lines)) for (const end of e.split('|')) expect(ringDistance('0,0', end)).toBeLessThanOrEqual(BAND_RING);
    expect(assess(rerouted, RATES).checks.filter((c) => c.status === 'bad')).toEqual([]);
    expect(assess(rerouted, RATES).checks.find((c) => c.id === 'haul')?.status).toBe('ok');
    expect(assess(rerouted, RATES).checks.find((c) => c.id === 'stops')?.status).toBe('ok');
  });

  it('a vetoed school goes to another neighborhood that lacks one, and with no other has no room', () => {
    const two = ok(placeNeighborhood(one, '1,0', RATES));
    const plain = build(two).layout;
    expect((plain.tiles['0,-1'] as { has: Record<string, true> }).has['elementary']).toBe(true);
    // Two neighborhoods' pupils want two elementary schools; with one neighborhood vetoed the other takes a school and
    // the second has no room, so the check stays broken for the pupils left over.
    const vetoed = build(two, [{ what: 'elementary', at: '0,-1' }]);
    const schools = vetoed.layout;
    expect(schools.tiles['0,-1']?.kind).toBe('hood');
    expect((schools.tiles['0,-1'] as { has: Record<string, true> }).has['elementary']).toBeUndefined();
    expect((schools.tiles['1,0'] as { has: Record<string, true> }).has['elementary']).toBe(true);
    expect(vetoed.noRoom.map((p) => p.need.need)).toContain('schools');
    expect(assess(schools, RATES).checks.find((c) => c.id === 'elementary')?.status).toBe('bad');
    const alone = build(one, [{ what: 'elementary', at: '0,-1' }]);
    expect(alone.noRoom.map((p) => p.need.need)).toContain('schools');
    expect((alone.layout.tiles['0,-1'] as { has: Record<string, true> }).has['elementary']).toBeUndefined();
  });
});
