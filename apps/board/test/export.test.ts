/**
 * @file The text export on a run built in order (ADR-0012): the board as checked for the people living there, who is
 * held back now, and line 6 under construction.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RULES, placeOrder, startRun } from '@city/run';
import { RATES, addRingBuilding, emptyLayout, layStretch, placeNeighborhood } from '@city/site';
import type { Layout, Outcome } from '@city/site';
import { asText } from '../src/export.ts';
import { newSession } from '../src/session.ts';
import { memoryStore } from '../src/storage.ts';

function built(layout: Layout, ...commands: ((l: Layout) => Outcome)[]): Layout {
  return commands.reduce((l, c) => {
    const o = c(l);
    if (!o.ok) throw new Error(o.rejection.reason);
    return o.layout;
  }, layout);
}

const RINGED = built(emptyLayout(), (l) => addRingBuilding(l, '0,0', RATES), (l) => placeNeighborhood(l, '1,0', RATES));
const WAITS = 'Held back now: 1 neighborhood stands empty, waiting for power, drinking water, sewage treatment and waste handling.';

describe('the text export, built in order', () => {
  it('counts the people admitted, not full homes, and says who is held back now', () => {
    const s = newSession(startRun(RINGED, 7, RATES, RULES, { inOrder: true }), memoryStore());
    s.refresh();
    const text = asText(s).split('\n');
    expect(text).toContain('People: 0 in 1 neighborhoods');
    expect(text).toContain(WAITS);
  });

  it('words line 6 as under construction once its stretch is ordered', () => {
    const out = placeOrder(startRun(RINGED, 7, RATES, RULES, { inOrder: true }), (p) => layStretch(p, '0,0', '1,0', RATES), RULES);
    if (!out.ok) throw new Error(out.rejection.reason);
    const s = newSession(out.game, memoryStore());
    s.refresh();
    expect(asText(s).split('\n').find((l) => l.includes('Every neighborhood has a mover stop'))).toBe(
      '[Watch] Line 6: Every neighborhood has a mover stop. 1 neighborhood nobody lives in yet has no stop on a line to the ring. The mover line to it is under construction.',
    );
  });

  it("off the clock, or on the sketch's clock, nothing is held back and everyone lives there", () => {
    for (const game of [{ layout: RINGED, clock: null }, startRun(RINGED, 7, RATES, RULES)]) {
      const s = newSession(game, memoryStore());
      s.refresh();
      const text = asText(s);
      expect(text).not.toContain('Held back now');
      expect(text.split('\n')).toContain('People: 5,000 in 1 neighborhoods');
    }
  });
});
