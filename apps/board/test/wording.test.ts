/**
 * @file The Board's wording against the sketch's sentences, recorded in the Site's and the Run's parity fixtures.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { DAYS, POPULATION, RATES, assess, dayOf, emptyLayout, needsOf, placeNeighborhood, sizedLayout, starterLayout } from '@city/site';
import type { DayPremises, Layout, PopulationPremises, Stress, TestId, TileKey } from '@city/site';
import { RULES, notices, startRun, tick, tickMonth } from '@city/run';
import type { Game } from '@city/run';
import { move } from '../src/moves.ts';
import type { ToolId } from '../src/wording.ts';
import { checkDetail, checkTitle, issueText, linesLabel, needText, noticeText, testLabel } from '../src/wording.ts';
import { DAY_NAME, DAY_PREMISE, POPULATION_PREMISE, dayCaption, hourLabel, monthLine, peopleNow } from '../src/wording.ts';
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

describe('what the city needs, worded', () => {
  const placed = (layout: Layout, keys: readonly TileKey[]): Layout =>
    keys.reduce((s, k) => {
      const o = placeNeighborhood(s, k, RATES);
      if (!o.ok) throw new Error(o.rejection.reason);
      return o.layout;
    }, layout);

  it('words every need of thirteen neighborhoods, one line each', () => {
    const needs = needsOf(placed(starterLayout(), ['2,0', '-3,0', '0,2']), RATES);
    expect(needs.map(needText)).toEqual([
      '1 more building on the ring at 0,0.',
      '1 more water plant unit.',
      '1 more sewage plant unit.',
      '1 more waste works unit.',
      '1 more elementary school near 2,0, for 180 pupils with no seat.',
      '1 more high school near 0,2, for 120 pupils with no seat.',
      'Playing fields near 0,2.',
      'The mover line run to 2,0, -3,0 and 0,2, on a line to the ring.',
    ]);
  });

  it('words a lone neighborhood\'s ring and reactor modules', () => {
    const needs = needsOf(placed(emptyLayout(), ['0,0']), RATES);
    expect(needs.slice(0, 2).map(needText)).toEqual(['A ring of 1 building for the offices and halls.', '2 more reactor modules, to carry the peak with one down for fuel.']);
  });
});

describe('the daily list in a city still filling (ADR-0009)', () => {
  it('names the emptiest neighborhood when the neighborhoods do not all hold the same', () => {
    const a = assess(starterLayout(), RATES, { occupied: { '1,0': 400 } });
    const daily = a.checks.find((c) => c.id === 'daily');
    if (!daily) throw new Error('no daily check');
    expect(daily.status).toBe('warn');
    expect(checkDetail(daily.facts, RATES)).toBe("1 neighborhood is still filling; with 400 people in the emptiest, the bakery, the butcher, the cafés and the doctor's office wait for customers as people move in.");
    const fed = assess(starterLayout(), RATES, { occupied: { '1,0': 4500 } }).checks.find((c) => c.id === 'daily');
    if (!fed) throw new Error('no daily check');
    expect(checkDetail(fed.facts, RATES)).toBe("The emptiest neighborhood has 4,500 people. Its hungriest need, the doctor's office, wants 4,000.");
  });
});

describe('the month clock, worded (ADR-0009)', () => {
  it('a month on a full city: who was born, died, moved away and moved in', () => {
    const g = tickMonth(startRun(starterLayout(), 7, RATES, RULES, { growth: true }), RATES, RULES);
    const row = g.clock?.growth?.months[0];
    if (!row) throw new Error('no month');
    expect(monthLine(row)).toBe('Year 1, month 1: 50,000 people in homes for 50,000. 175 moved in, 44.6 born, 38.3 died and 181.3 moved away.');
  });

  it('a month with no homes standing says nobody lives here', () => {
    const g = tickMonth(startRun(emptyLayout(), 7, RATES, RULES, { growth: true }), RATES, RULES);
    const row = g.clock?.growth?.months[0];
    if (!row) throw new Error('no month');
    expect(monthLine(row)).toBe('Year 1, month 1: no homes stand yet, so nobody lives here.');
  });

  it('where the clock stands', () => {
    expect(peopleNow(3, 4, 5092.4, 10000)).toBe('Year 3, month 4 of 12. 5,092 people living in homes for 10,000.');
    expect(peopleNow(1, 0, 0, 0)).toBe('The start of year 1. 0 people living in homes for 0.');
  });

  it('every population premise is named and its value worded', () => {
    const lines = (Object.keys(POPULATION) as (keyof PopulationPremises)[]).map((id) => `${POPULATION_PREMISE[id].name}: ${POPULATION_PREMISE[id].value(POPULATION[id].value)}`);
    expect(lines).toEqual([
      'Births: 10.7 a year per 1,000 people',
      'Deaths: 9.2 a year per 1,000 people',
      'People who move house: 8.7% a year',
      'Movers who leave the city: 50% of them',
      'Arrivals into empty homes: 4,800 people a year at most, citywide',
      'People in homes with no school-age children: 60% of people',
    ]);
  });
});

describe('the day, worded (ADR-0009)', () => {
  it('names all 24 hours, each once, midnight to midnight', () => {
    const hours = Array.from({ length: 24 }, (_, h) => hourLabel(h));
    expect(new Set(hours).size).toBe(24);
    expect([hourLabel(0), hourLabel(5), hourLabel(11), hourLabel(12), hourLabel(17), hourLabel(23)]).toEqual([
      'midnight to 1 a.m.',
      '5 to 6 a.m.',
      '11 a.m. to noon',
      'noon to 1 p.m.',
      '5 to 6 p.m.',
      '11 p.m. to midnight',
    ]);
  });

  it('the sized city\'s summer weekday in a sentence', () => {
    expect(dayCaption(dayOf(sizedLayout(RATES), RATES))).toBe(
      "A summer weekday for 50,000 people: 147,727 trips, 14,773 of them from 5 to 6 p.m. Power peaks at 75 MW and draws 1,440 MWh over the day. At the busiest hour 188 of the 217 movers are moving; the rest are parked or charging. 7,800 pupils walk or ride to school and home again.",
    );
  });

  it('an empty city\'s day', () => {
    expect(dayCaption(dayOf(emptyLayout(), RATES))).toBe('A summer weekday, and nobody lives here yet: no trips, no power drawn, every mover parked.');
  });

  it('every premise of the day is named and its value worded', () => {
    const k = DAYS.summerWeekday;
    expect(DAY_NAME.summerWeekday).toBe('A summer weekday');
    expect(DAY_PREMISE.tripPeriods.value(k.tripPeriods.value)).toBe(
      '10 p.m. to 1 a.m. 2%; 1 a.m. to 6 a.m. 2.2%; 6 a.m. to 9 a.m. 17.8%; 9 a.m. to 1 p.m. 23.4%; 1 p.m. to 4 p.m. 23.8%; 4 p.m. to 7 p.m. 22%; 7 p.m. to 10 p.m. 8.9%',
    );
    const rest = (Object.keys(k) as (keyof DayPremises)[]).filter((id): id is Exclude<keyof DayPremises, 'tripPeriods'> => id !== 'tripPeriods');
    expect(rest.map((id) => `${DAY_PREMISE[id].name}: ${DAY_PREMISE[id].value(k[id].value)}`)).toEqual([
      "The busiest hour for trips: 5 to 6 p.m., with the ledger's 10% of the day's trips",
      'Power at its peak: 5 to 6 p.m.',
      'Power at its lowest: 5 to 6 a.m.',
      'The lowest hour against the peak: 60%',
      'School starts: 8 a.m.',
      'The school day: 6.5 hours',
    ]);
  });
});
