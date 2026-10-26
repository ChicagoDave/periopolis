/**
 * @file The city grows past its circle (ADR-0016 Decision 3; `docs/domain/run.md` "The city grows past its circle"):
 * on a run with `infer` whose first circle is full, the month the homes signal finds no open tile the run opens the
 * second circle through `placeOrder`, the month's row carries `CircleOpened`, the next month's neighborhood goes there
 * and its plants, ring and line are ordered before anyone lives in it; a run without `infer` opens nothing; a closed
 * circle is vetoed and the player's own `openCircle` lifts the veto; a stored run reads the circle back.
 * Owner context: Run (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, addPlantUnit, applyProposal, circleOf, emptyLayout, layStretch, openCircle, placeNeighborhood, proposeFor, proposeNeighborhood } from '@city/site';
import type { Layout, Outcome, Proposal } from '@city/site';
import { RULES, circleId, inferStep, placeOrder, restoreClock, startRun, tickMonth, vetoCircle } from '../src/index.ts';
import type { Game, Inferred, MonthRow } from '../src/index.ts';


const ok = (o: Outcome): Layout => {
  if (!o.ok) throw new Error(o.rejection.reason);
  return o.layout;
};

/** Accept every proposal with room until the layout needs nothing. */
function build(layout: Layout): Layout {
  let s = layout;
  for (let round = 0; round < 50; round++) {
    const ps: readonly Proposal[] = proposeFor(s, RATES);
    const steps = ps.flatMap((p) => (p.room ? p.steps : []));
    if (!steps.length) return s;
    const a = applyProposal(s, steps, RATES);
    if (!a.ok) throw new Error(a.rejection.reason);
    s = a.layout;
  }
  throw new Error('never settled');
}

/** One circle filled by the Site's own proposals: 36 neighborhoods and everything they call for. */
function fullCircle(): Layout {
  let s = emptyLayout();
  for (let i = 0; i < 40; i++) {
    const at = proposeNeighborhood(s, RATES);
    if (!at) return s;
    s = build(ok(placeNeighborhood(s, at, RATES)));
  }
  throw new Error('the circle never filled');
}

const hoodsOf = (l: Layout): string[] => Object.keys(l.tiles).filter((k) => l.tiles[k]?.kind === 'hood');

/** A run on the full circle with every neighborhood lived in to its homes, so the homes ahead are below the lead. */
function fullRun(options: { readonly infer?: true } = { infer: true }): Game {
  const layout = fullCircle();
  const g = startRun(layout, 42, RATES, RULES, { growth: true, inOrder: true, ...options });
  if (!g.clock?.growth) throw new Error('no growth');
  const occupied: Record<string, number> = {};
  for (const h of hoodsOf(layout)) occupied[h] = RATES.hood;
  return { layout, clock: { ...g.clock, growth: { ...g.clock.growth, occupied } } };
}

const lastMonth = (g: Game): MonthRow => {
  const rows = g.clock?.growth?.months ?? [];
  const row = rows[rows.length - 1];
  if (!row) throw new Error('no month yet');
  return row;
};
const opened = (facts: readonly Inferred[] | undefined): string[] => (facts ?? []).flatMap((f) => (f.type === 'CircleOpened' ? [f.middle] : []));

describe('the run opens the second circle', () => {
  const start = fullRun();

  it('the first circle is full: 36 neighborhoods and no open tile for homes', () => {
    expect(hoodsOf(start.layout)).toHaveLength(36);
    expect(start.layout.circles).toEqual(['0,0']);
    expect(proposeNeighborhood(start.layout, RATES)).toBeNull();
  });

  it('the month the homes signal finds no room it opens 9,0 through placeOrder, as ground with no job, and the row says CircleOpened', () => {
    const { game, facts } = inferStep(start, RATES, RULES);
    expect(facts.filter((f) => f.type === 'CircleOpened')).toEqual([{ type: 'CircleOpened', middle: '9,0' }]);
    expect(facts.some((f) => f.type === 'NoRoom')).toBe(false);
    expect(game.layout.circles).toEqual(['0,0', '9,0']);
    expect(game.layout.tiles).toEqual(start.layout.tiles);
    expect(game.clock?.jobs.filter((j) => circleOf(['9,0'], j.at) === '9,0')).toEqual([]);
    const month = tickMonth(start, RATES, RULES);
    expect(opened(lastMonth(month).inferred)).toEqual(['9,0']);
    expect(month.layout.circles).toEqual(['0,0', '9,0']);
  });

  it("the next month's neighborhood goes in the second circle beside its middle, and its ring, plants and line are ordered before anyone lives there", () => {
    let g = tickMonth(start, RATES, RULES);
    g = tickMonth(g, RATES, RULES);
    const homes = (lastMonth(g).inferred ?? []).find((f) => f.type === 'InferredOrder' && f.why === 'homes');
    expect(homes && homes.type === 'InferredOrder' ? homes.events[0] : null).toMatchObject({ type: 'JobOrdered', what: 'hood', at: '9,-1' });
    let lived: number | null = null;
    for (let m = 0; m < 120 && lived === null; m++) {
      g = tickMonth(g, RATES, RULES);
      const people = g.clock?.growth?.occupied['9,-1'] ?? 0;
      if (people > 0) lived = m;
    }
    expect(lived).not.toBeNull();
    const second = Object.keys(g.layout.tiles).filter((k) => circleOf(g.layout.circles, k) === '9,0');
    const kinds = second.map((k) => g.layout.tiles[k]?.kind);
    for (const kind of ['ring', 'water', 'sewage', 'waste', 'power']) expect(kinds).toContain(kind);
    expect(g.layout.tiles['9,0']?.kind).toBe('ring');
    expect(Object.keys(g.layout.lines).some((e) => e.split('|').every((end) => circleOf(g.layout.circles, end) === '9,0'))).toBe(true);
    expect(g.clock?.jobs.every((j) => j.inferred === true)).toBe(true);
    // Up to 120 months inferring: well past vitest's five seconds on the publish workflow's runner.
  }, 60000);

  it('a run without infer opens nothing and records nothing', () => {
    const quiet = fullRun({});
    let g = quiet;
    for (let m = 0; m < 3; m++) g = tickMonth(g, RATES, RULES);
    expect(g.layout.circles).toEqual(['0,0']);
    for (const row of g.clock?.growth?.months ?? []) expect(row.inferred).toBeUndefined();
  });

  it('the player closes the opened circle: it is vetoed by its middle, never opened again, and the player\'s own openCircle lifts the veto', () => {
    const { game } = inferStep(start, RATES, RULES);
    const closed = vetoCircle(game, '9,0');
    expect(closed.layout.circles).toEqual(['0,0']);
    expect(closed.clock?.vetoes).toEqual([circleId('9,0')]);
    const again = inferStep(closed, RATES, RULES);
    expect(again.game.layout.circles).toEqual(['0,0']);
    expect(again.facts.filter((f) => f.type === 'CircleOpened')).toEqual([]);
    expect(again.facts).toContainEqual({ type: 'NoRoom', why: 'homes' });
    const own = placeOrder(closed, (plan) => openCircle(plan, '9,0', RATES), RULES);
    if (!own.ok) throw new Error(own.rejection.reason);
    expect(own.game.layout.circles).toEqual(['0,0', '9,0']);
    expect(own.game.clock?.vetoes ?? []).toEqual([]);
    expect(own.events).toEqual([]);
    // Not closable: the first circle, a middle that is no circle, or a circle with a piece standing or in hand.
    expect(vetoCircle(game, '0,0')).toBe(game);
    expect(vetoCircle(game, '5,0')).toBe(game);
    const busy = tickMonth(tickMonth(start, RATES, RULES), RATES, RULES);
    expect(vetoCircle(busy, '9,0')).toBe(busy);
    expect(vetoCircle(closed, '9,0')).toBe(closed);
  });

  it('a stored run reads the circle back: its veto and the CircleOpened fact, and carries on into the second circle', () => {
    const month = tickMonth(start, RATES, RULES);
    const stored = JSON.parse(JSON.stringify(month.clock));
    const back = restoreClock(stored, month.layout, RATES, RULES);
    expect(back?.growth?.months.flatMap((m) => opened(m.inferred))).toEqual(['9,0']);
    const next = tickMonth({ layout: month.layout, clock: back }, RATES, RULES);
    const homes = (lastMonth(next).inferred ?? []).find((f) => f.type === 'InferredOrder' && f.why === 'homes');
    expect(homes && homes.type === 'InferredOrder' ? homes.events[0] : null).toMatchObject({ type: 'JobOrdered', what: 'hood', at: '9,-1' });
    expect(next.layout.circles).toEqual(['0,0', '9,0']);
    const closed = vetoCircle(month, '9,0');
    const backClosed = restoreClock(JSON.parse(JSON.stringify(closed.clock)), closed.layout, RATES, RULES);
    expect(backClosed?.vetoes).toEqual([circleId('9,0')]);
    expect(restoreClock({ ...JSON.parse(JSON.stringify(closed.clock)), vetoes: ['circle@99,0', 'circle@0,0', 'circle@5,0'] }, closed.layout, RATES, RULES)?.vetoes).toEqual(['circle@5,0']);
    const months = stored.growth.months;
    const tampered = { ...stored, growth: { ...stored.growth, months: [{ ...months[0], inferred: [{ type: 'CircleOpened', middle: '99,99' }, { type: 'CircleOpened', middle: 5 }, { type: 'CircleOpened', middle: '9,0' }] }] } };
    expect(restoreClock(tampered, month.layout, RATES, RULES)?.growth?.months[0]?.inferred).toEqual([{ type: 'CircleOpened', middle: '9,0' }]);
    const onlyBad = { ...stored, growth: { ...stored.growth, months: [{ ...months[0], inferred: [{ type: 'CircleOpened', middle: '99,99' }] }] } };
    expect(restoreClock(onlyBad, month.layout, RATES, RULES)?.growth?.months[0]?.inferred).toBeUndefined();
  });

  it('closing: without infer the circle goes but nothing is vetoed; a stretch into the circle blocks it, a stretch elsewhere does not', () => {
    const quiet = fullRun({});
    const two = placeOrder(quiet, (plan) => openCircle(plan, '9,0', RATES), RULES);
    if (!two.ok) throw new Error(two.rejection.reason);
    const closed = vetoCircle(two.game, '9,0');
    expect(closed.layout.circles).toEqual(['0,0']);
    expect(closed.clock?.vetoes).toBeUndefined();
    const { game } = inferStep(start, RATES, RULES);
    const bridged = placeOrder(game, (plan) => layStretch(plan, '4,0', '5,0', RATES), RULES);
    if (!bridged.ok) throw new Error(bridged.rejection.reason);
    expect(vetoCircle(bridged.game, '9,0')).toBe(bridged.game);
    const elsewhere = placeOrder(game, (plan) => layStretch(plan, '4,0', '4,-1', RATES), RULES);
    if (!elsewhere.ok) throw new Error(elsewhere.rejection.reason);
    expect(vetoCircle(elsewhere.game, '9,0').layout.circles).toEqual(['0,0']);
  });

  it('placeOrder keeps the circles through an ordinary order, leaves other vetoes alone, and a refused openCircle changes nothing', () => {
    const { game } = inferStep(start, RATES, RULES);
    const plain = placeOrder(game, (plan) => addPlantUnit(plan, '5,4', 'water', RATES), RULES);
    if (!plain.ok) throw new Error(plain.rejection.reason);
    expect(plain.game.layout.circles).toEqual(['0,0', '9,0']);
    const byRun = placeOrder(game, (plan) => addPlantUnit(plan, '5,4', 'water', RATES), RULES, 'run');
    expect(byRun.ok && byRun.game.layout.circles).toEqual(['0,0', '9,0']);
    const closed = vetoCircle(game, '9,0');
    const withOthers: Game = { ...closed, clock: { ...closed.clock!, vetoes: ['hood@2,0', circleId('9,0')] } };
    const runs = placeOrder(withOthers, (plan) => openCircle(plan, '9,0', RATES), RULES, 'run');
    expect(runs.ok && runs.game.clock?.vetoes).toEqual(['hood@2,0', circleId('9,0')]);
    const player = placeOrder(withOthers, (plan) => openCircle(plan, '9,0', RATES), RULES);
    expect(player.ok && player.game.clock?.vetoes).toEqual(['hood@2,0']);
    const { vetoes: _dropped, ...noVetoes } = closed.clock!;
    void _dropped;
    const unvetoed = placeOrder({ ...closed, clock: noVetoes }, (plan) => openCircle(plan, '9,0', RATES), RULES);
    expect(unvetoed.ok && unvetoed.game.clock?.vetoes).toBeUndefined();
    const refused = placeOrder(game, (plan) => openCircle(plan, '4,0', RATES), RULES);
    expect(refused.ok).toBe(false);
    expect(placeOrder(game, (plan) => openCircle(plan, '20,0', RATES), RULES).ok).toBe(false);
    expect(game.layout.circles).toEqual(['0,0', '9,0']);
  });
});
