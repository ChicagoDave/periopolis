/**
 * @file The Board's wording against the sketch's sentences, recorded in the Site's and the Run's parity fixtures.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { RATES, assess } from '@city/site';
import type { Layout, Stress, TestId, TileKey } from '@city/site';
import { RULES, notices, startRun, tick } from '@city/run';
import type { Game } from '@city/run';
import { move } from '../src/moves.ts';
import type { ToolId } from '../src/wording.ts';
import { checkDetail, checkTitle, issueText, linesLabel, noticeText, testLabel } from '../src/wording.ts';
import siteRecorded from '../../../domain/site/test/fixtures/parity.json';
import runRecorded from '../../../domain/run/test/fixtures/parity.json';

interface SiteFixture {
  readonly rates: { tests: { id: TestId; label: string }[] };
  readonly evaluations: {
    name: string;
    state: Layout;
    showing: TestId | null;
    now: Stress | null;
    result: { rules: { id: string; lines: string; title: string; detail: string }[]; per: Record<string, { issues: string[] }> };
  }[];
  readonly acts: { tool: ToolId; key: TileKey; from: TileKey | null; before: Layout; said: string; changed: boolean; nextFrom: TileKey | null }[];
}

interface RunFixture {
  readonly steps: { op: string; args: { tool?: ToolId; k?: TileKey; from?: TileKey | null }; before: { state: Layout; clock: Game['clock'] } | null; said: string | null; changed: boolean | null }[];
  readonly leftAlone: { seed: number; final: { state: Layout }; yearly: { year: number; notices: { text: string }[] }[] }[];
}

const site = siteRecorded as unknown as SiteFixture;
const run = runRecorded as unknown as RunFixture;

describe('the line checks, worded', () => {
  for (const c of site.evaluations) {
    it(`${c.name}: every title, line label, detail and tile issue reads as the sketch wrote it`, () => {
      const options: { show?: TestId; now?: Stress } = {};
      if (c.showing) options.show = c.showing;
      if (c.now) options.now = c.now;
      const a = assess(c.state, RATES, options);
      const worded = a.checks.map((k) => ({ id: k.id, lines: linesLabel(k.lines), title: checkTitle(k.id), detail: checkDetail(k.facts, RATES) }));
      expect(worded).toEqual(c.result.rules.map((r) => ({ id: r.id, lines: r.lines, title: r.title, detail: r.detail })));
      const issues: Record<string, string[]> = {};
      for (const [k, p] of Object.entries(a.per)) issues[k] = p.issues.map(issueText);
      const wanted: Record<string, string[]> = {};
      for (const [k, p] of Object.entries(c.result.per)) wanted[k] = p.issues;
      expect(issues).toEqual(wanted);
    });
  }

  it('the stretch tests are labelled as the sketch labelled them', () => {
    expect(site.rates.tests.map((t) => testLabel(t.id, RATES.band))).toEqual(site.rates.tests.map((t) => t.label));
    expect(testLabel('closure', RATES.band)).toBe('one stretch of mover line closed for repairs');
  });
});

describe('moves, worded', () => {
  site.acts.forEach((a, i) => {
    it(`move ${i + 1}: ${a.tool} at ${a.key} says "${a.said}"`, () => {
      const m = move({ layout: a.before, clock: null }, a.tool, a.key, a.from);
      expect(m.said).toBe(a.said);
      expect(m.changed).toBe(a.changed);
      expect(m.from).toBe(a.nextFrom);
    });
  });
});

describe('orders, worded', () => {
  run.steps.forEach((s, i) => {
    const before = s.before;
    if (s.op !== 'order' || !before) return;
    it(`step ${i + 1}: ${s.args.tool} at ${s.args.k} says "${s.said}"`, () => {
      const m = move({ layout: before.state, clock: before.clock }, s.args.tool ?? 'inspect', s.args.k ?? '', s.args.from ?? null);
      expect(m.said).toBe(s.said);
      expect(m.changed).toBe(s.changed);
    });
  });
});

describe('notices, worded', () => {
  for (const r of run.leftAlone) {
    it(`seed ${r.seed}: every year's notices read as the sketch wrote them`, () => {
      let game = startRun(r.final.state, r.seed, RATES, RULES);
      const texts = (g: Game): string[] => (g.clock ? notices(g.clock, RATES.band, RULES).map((n) => noticeText(n, RATES.band, RULES)) : []);
      const years = [texts(game)];
      while (game.clock && game.clock.year < RULES.years) {
        game = tick(game, RATES, RULES);
        years.push(texts(game));
      }
      expect(years).toEqual(r.yearly.map((y) => y.notices.map((n) => n.text)));
    });
  }
});
