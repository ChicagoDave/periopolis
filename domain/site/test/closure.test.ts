/**
 * @file The line holds through a closure (ADR-0021): `needsOf` read with a stretch named as closed asks for the way
 * round for the neighborhoods it cuts off, answering exactly the stops and ways checks broken under that closure;
 * `proposeFor` lays the way round without the closed stretch, and once it is laid the closure cuts nobody off. With
 * no stretch named, both read exactly as before.
 * Owner context: Site (domain), tests.
 */
import { describe, expect, it } from 'vitest';
import { NEED_CHECKS, NO_STRESS, RATES, applyProposal, assessCore, bridges, closable, needsOf, proposeFor, starterLayout } from '../src/index.ts';
import type { EdgeKey, Layout, Need } from '../src/index.ts';

const starter = starterLayout();

/** The checks broken under a closure that a built thing can mend. */
function brokenUnder(layout: Layout, closed: readonly EdgeKey[]): string[] {
  return assessCore(layout, { ...NO_STRESS, closed }, RATES)
    .checks.filter((c) => c.status === 'bad' && NEED_CHECKS.includes(c.id))
    .map((c) => c.id);
}

describe('the needs read under a named closure (ADR-0021 Decision 2)', () => {
  const worst = bridges(starter)[0];
  if (!worst) throw new Error('the starter has no bridge');

  it('with no stretch named, the needs are what they were', () => {
    expect(needsOf(starter, RATES, [])).toEqual(needsOf(starter, RATES));
  });

  it('a closed bridge breaks stops and ways, and the line need names the cut-off neighborhoods and answers exactly those checks', () => {
    const under = brokenUnder(starter, [worst.edge]);
    expect(under).toContain('stops');
    expect(under).toContain('ways');
    const line = needsOf(starter, RATES, [worst.edge]).find((n): n is Need & { need: 'line' } => n.need === 'line');
    expect(line).toBeDefined();
    // The stops check marks the cut-off neighborhoods; the ways check marks both ends of every stuck trip, so the reach
    // is wider, and the line is laid only to what is not joined.
    const stops = assessCore(starter, { ...NO_STRESS, closed: [worst.edge] }, RATES).checks.find((c) => c.id === 'stops');
    expect(stops?.status).toBe('bad');
    expect(stops?.tiles.length).toBe(worst.cut);
    for (const t of stops?.tiles ?? []) expect(line?.reach).toContain(t);
    expect([...(line?.answers ?? [])].sort()).toEqual(under.sort());
  });

  it('the invariant: the needs answer exactly the checks broken under the closure', () => {
    for (const edge of closable(starter)) {
      const answered = needsOf(starter, RATES, [edge]).flatMap((n) => n.answers);
      expect([...new Set(answered)].sort()).toEqual([...new Set(brokenUnder(starter, [edge]))].sort());
    }
  });
});

describe('the way round (ADR-0021 Decisions 1 and 2)', () => {
  const worst = bridges(starter)[0];
  if (!worst) throw new Error('the starter has no bridge');

  it('is proposed as new stretches that never include the closed one, and once laid the closure cuts nobody off', () => {
    const [first] = proposeFor(starter, RATES, [], [worst.edge]);
    expect(first?.need.need).toBe('line');
    if (!first || !first.room) throw new Error('no room for the way round');
    expect(first.steps.length).toBeGreaterThan(0);
    for (const s of first.steps) {
      expect(s.command).toBe('layStretch');
      if (s.command === 'layStretch') {
        expect(starter.lines[`${s.from}|${s.to}`] ?? starter.lines[`${s.to}|${s.from}`]).toBeUndefined();
      }
    }
    const laid = applyProposal(starter, first.steps, RATES);
    if (!laid.ok) throw new Error(laid.rejection.reason);
    expect(needsOf(laid.layout, RATES, [worst.edge]).some((n) => n.need === 'line')).toBe(false);
    expect(brokenUnder(laid.layout, [worst.edge])).not.toContain('stops');
    expect(bridges(laid.layout).some((b) => b.edge === worst.edge)).toBe(false);
  });

  it('with no stretch named, the proposals are what they were', () => {
    expect(proposeFor(starter, RATES, [], [])).toEqual(proposeFor(starter, RATES));
  });
});
