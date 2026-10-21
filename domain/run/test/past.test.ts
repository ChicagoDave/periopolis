/**
 * @file Past 100,000 and into the second circle, on the real path (ADR-0016; Phase 8 of
 * `docs/work/concentric-site/plan.md`): the real Run on the real Site and Ledger, the month clock built in order with
 * the city growing itself, no stub anywhere. One neighborhood and an empty site run seventy years: each passes 100,000
 * in its fifty-fifth year and levels off toward the population the premises hold, about 114,000, short of the 180,000
 * a circle holds, so neither ever opens the second circle. A first circle filled by the Site's own proposals runs
 * twenty years: the run opens the second circle in its first month, and the second circle's first neighborhood is
 * lived in only once its own ring and plants stand. The figures are the record ADR-0016's Consequences carry, pinned
 * as a check on the premises, not as truth (ADR-0007): a premise that moves moves them.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { LAYERS, POPULATION, RATES, applyProposal, circleOf, emptyLayout, kindOf, moveInGate, placeNeighborhood, proposeFor, proposeNeighborhood } from '@city/site';
import type { Layout } from '@city/site';
import { RULES, startRun, tickMonth, totalSpend } from '../src/index.ts';
import type { Game, MonthRow, RunRules } from '../src/index.ts';

const GROW = { growth: true, inOrder: true, infer: true } as const;

/** What a long run did, month by month, with the moments the record names. */
interface Long {
  readonly game: Game;
  readonly months: readonly MonthRow[];
  /** "year:month" of the first month at or past 100,000 people, or null. */
  readonly past100k: string | null;
  /** "year:month" the run opened a circle, or null. */
  readonly opened: string | null;
  /** "year:month" someone first lived in the second circle, and the game that month; null when nobody did. */
  readonly livedSecond: { readonly at: string; readonly game: Game } | null;
  readonly ms: number;
}

function run(layout: Layout, rules: RunRules): Long {
  const t0 = Date.now();
  let g = startRun(layout, 42, RATES, rules, GROW);
  let past100k: string | null = null;
  let opened: string | null = null;
  let livedSecond: Long['livedSecond'] = null;
  while (g.clock && g.clock.year < rules.years) {
    g = tickMonth(g, RATES, rules);
    const m = g.clock?.growth?.months.at(-1);
    if (!m) continue;
    const at = `${m.year}:${m.month}`;
    if (past100k === null && m.people >= 100000) past100k = at;
    if (opened === null && (m.inferred ?? []).some((f) => f.type === 'CircleOpened')) opened = at;
    const occ = g.clock?.growth?.occupied ?? {};
    if (livedSecond === null && Object.keys(occ).some((k) => circleOf(g.layout.circles, k) === '9,0' && (occ[k] ?? 0) > 0)) livedSecond = { at, game: g };
  }
  return { game: g, months: g.clock?.growth?.months ?? [], past100k, opened, livedSecond, ms: Date.now() - t0 };
}

const hoods = (l: Layout, circle?: string): string[] =>
  Object.keys(l.tiles).filter((k) => l.tiles[k]?.kind === 'hood' && (circle === undefined || circleOf(l.circles, k) === circle));
const peopleAt = (r: Long, year: number): number => Math.round(r.months.find((m) => m.year === year && m.month === 12)?.people ?? -1);

/** The population the premises hold: arrivals at the citywide pace over the share lost each year (ADR-0009). */
const HELD = POPULATION.arrivalsPerYear.value / (POPULATION.movingShare.value * POPULATION.leavingShare.value - (POPULATION.birthsPerThousand.value - POPULATION.deathsPerThousand.value) / 1000);

/** Accept every proposal with room until the layout needs nothing. */
function settle(layout: Layout): Layout {
  let s = layout;
  for (let round = 0; round < 50; round++) {
    const steps = proposeFor(s, RATES).flatMap((p) => (p.room ? p.steps : []));
    if (!steps.length) return s;
    const a = applyProposal(s, steps, RATES);
    if (!a.ok) throw new Error(a.rejection.reason);
    s = a.layout;
  }
  throw new Error('never settled');
}

/** A first circle filled by the Site's own proposals: 36 neighborhoods and what they call for. */
function fullCircle(): Layout {
  let s = emptyLayout();
  for (let i = 0; i < 40; i++) {
    const at = proposeNeighborhood(s, RATES);
    if (!at) return s;
    const o = placeNeighborhood(s, at, RATES);
    if (!o.ok) throw new Error(o.rejection.reason);
    s = settle(o.layout);
  }
  throw new Error('the circle never filled');
}

describe('seventy years growing itself, from one neighborhood and from nothing (seed 42)', () => {
  const long: RunRules = { ...RULES, years: 70 };
  const one = placeNeighborhood(emptyLayout(), '0,0', RATES);
  if (!one.ok) throw new Error('refused');
  const fromOne = run(one.layout, long);
  const fromNothing = run(emptyLayout(), long);

  it("at year 20 each is ADR-0015's record: 56,349 and 53,698 people", () => {
    expect(peopleAt(fromOne, 20)).toBe(56349);
    expect(peopleAt(fromNothing, 20)).toBe(53698);
  });

  it('each passes 100,000 in its fifty-fifth year: from one neighborhood in year 54, month 4; from nothing in year 55, month 5', () => {
    expect(fromOne.past100k).toBe('54:4');
    expect(fromNothing.past100k).toBe('55:5');
    expect(peopleAt(fromOne, 40)).toBe(89311);
    expect(peopleAt(fromNothing, 40)).toBe(88168);
  });

  it('then each levels off toward the ~114,000 the premises hold, in 24 neighborhoods, short of the 180,000 a circle holds: no circle is ever opened', () => {
    expect(Math.round(HELD)).toBe(114286);
    expect(peopleAt(fromOne, 70)).toBe(107217);
    expect(peopleAt(fromNothing, 70)).toBe(106894);
    for (const r of [fromOne, fromNothing]) {
      expect(hoods(r.game.layout)).toHaveLength(24);
      expect(r.game.layout.circles).toEqual(['0,0']);
      expect(r.opened).toBeNull();
      expect(peopleAt(r, 70)).toBeLessThan(HELD);
      // Ten years on it gains under 2,000: the gap to what the premises hold closes by a fixed share a year.
      expect(peopleAt(r, 70) - peopleAt(r, 60)).toBeLessThan(4000);
      expect(r.game.clock?.record.at(-1)?.broken).toEqual([]);
    }
    expect(fromOne.game.clock?.lineYears).toBe(5);
    expect(fromNothing.game.clock?.lineYears).toBe(2);
  });

  it('every month the homes as built cover the people, and seventy years take under three seconds', () => {
    for (const r of [fromOne, fromNothing]) {
      for (const m of r.months) expect(m.people).toBeLessThanOrEqual(m.homes + 1e-6);
      expect(r.ms).toBeLessThan(3000);
    }
  });
});

describe('a first circle full to its 180,000, twenty years on (seed 42)', () => {
  const full = fullCircle();
  const r = run(full, RULES);
  const record = r.game.clock?.record ?? [];

  it('starts full: 36 neighborhoods, 180,000 people, one circle', () => {
    expect(hoods(full)).toHaveLength(36);
    expect(Math.round(record[0]?.pop ?? 0)).toBe(180000);
    expect(full.circles).toEqual(['0,0']);
  });

  it('the run opens the second circle in its first month, as the homes ahead are below the lead with no tile open', () => {
    expect(r.opened).toBe('1:1');
    expect(r.game.layout.circles).toEqual(['0,0', '9,0']);
  });

  it("the second circle's first neighborhood is lived in from year 5, month 12, once its own ring and four plants stand and the gate holds nothing back", () => {
    expect(r.livedSecond?.at).toBe('5:12');
    const g = r.livedSecond?.game;
    if (!g) throw new Error('nobody lived in the second circle');
    const second = Object.keys(g.layout.tiles).filter((k) => circleOf(g.layout.circles, k) === '9,0');
    const kinds = second.map((k) => g.layout.tiles[k]?.kind);
    for (const kind of ['ring', 'water', 'sewage', 'waste', 'power']) expect(kinds).toContain(kind);
    expect(g.layout.tiles['9,0']?.kind).toBe('ring');
    for (const h of hoods(g.layout, '9,0')) expect(moveInGate(g.layout, RATES, h, { [h]: RATES.hood }).short).toEqual([]);
    expect(hoods(r.game.layout, '9,0')).toEqual(['9,-1', '10,-1', '8,0']);
  });

  it('the city shrinks toward what the premises hold, 142,613 at year 20, and the second circle takes only the homes the lead asks for', () => {
    expect(Math.round(record.at(-1)?.pop ?? 0)).toBe(142613);
    expect(record.at(-1)?.homes).toBe(195000);
    for (const m of r.months) expect(m.people).toBeLessThanOrEqual(m.homes + 1e-6);
  });

  it("the squeeze in years 5 to 7 breaks the first circle's ring, schools and plants: a circle built to its full homes has no room for 20% more people in them", () => {
    const broken = record.filter((row) => row.year > 0 && row.bad > 0).map((row) => `${row.year}: ${row.broken.join(', ')}`);
    expect(broken).toEqual([
      '2: haul',
      '3: haul',
      '5: ring, elementary, middle, high, water, sewage, waste',
      '6: ring, elementary, middle, high, water, sewage, waste',
      '7: ring, stops, elementary, high, ways, water, sewage, waste',
      '9: elementary',
      '16: stops, ways',
    ]);
    expect(r.game.clock?.lineYears).toBe(27);
  });

  it('spends what it built: summed over layers equals summed over years, and the capital is what was built since year 0', () => {
    const sums = totalSpend(record);
    const overLayers = LAYERS.reduce((t, l) => t + sums.byLayer[l], 0);
    const overYears = sums.byYear.reduce((t, y) => t + y, 0);
    expect(overLayers).toBeCloseTo(overYears, 3);
    const first = record[0];
    const last = record.at(-1);
    if (!first || !last) throw new Error('no record');
    for (const layer of LAYERS) if (kindOf(layer) === 'capital') expect(sums.byLayer[layer]).toBeCloseTo(last.standing[layer] - first.standing[layer], 3);
    expect(Math.round((sums.capital / 1e9) * 100) / 100).toBe(5.35);
  });
});
