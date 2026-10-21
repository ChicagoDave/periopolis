/**
 * @file The Board's wording against the sketch's sentences, recorded in the Site's and the Run's parity fixtures, and
 * the sentences built in order adds (ADR-0012): line 6 under construction, and who is held back.
 * Owner context: Board (adapter), tests.
 */
import { describe, expect, it } from 'vitest';
import { DAYS, POPULATION, RATES, assess, dayOf, emptyLayout, needsOf, placeNeighborhood, sizedLayout, starterLayout } from '@city/site';
import type { DayPremises, Facts, Layout, LineCheck, PopulationPremises, Stress, TestId, TileKey } from '@city/site';
import { RULES, notices, startRun, tick, tickMonth } from '@city/run';
import type { Game, HeldBack, MonthRow } from '@city/run';
import { move } from '../src/moves.ts';
import type { ToolId } from '../src/wording.ts';
import { checkDetail, checkTitle, heldBackLine, heldHere, issueText, linesLabel, moveSaid, needText, noticeText, stopsInHand, testLabel } from '../src/wording.ts';
import { DAY_NAME, DAY_PREMISE, POPULATION_PREMISE, dayCaption, hourLabel, monthLine, peopleNow } from '../src/wording.ts';
import { PAUSED_FOR_ORDER, SPEED_NAME, clockStarted, yearLine, yearsUp } from '../src/wording.ts';
import { CIRCLE_CLOSE, CIRCLE_REOPEN, GROUND_TEXT, INFERRED_WHY, LAKE_LABEL, ORDERED_BY_CITY, circleClosedSaid, circleName, currentLabel, inferredCell, inferredLine, vetoSaid } from '../src/wording.ts';
import type { Inferred, InferredWhy } from '@city/run';
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

/**
 * The sketch had one broken case for power, short with one down. Since ADR-0012 Decision 3 as amended (2026-10-18) the
 * Board words a reactor site that carries the peak only while every module runs as its own case, asserted below; for
 * that state the sketch's sentence is the short one, so parity with the fixture reads it that way.
 */
function asSketchWorded(facts: Facts): string {
  if (facts.check === 'power' && facts.case === 'noSpare') return checkDetail({ ...facts, case: 'short' }, RATES);
  return checkDetail(facts, RATES);
}

describe('the line checks, worded', () => {
  for (const c of site.evaluations) {
    it(`${c.name}: every title, line label, detail and tile issue reads as the sketch wrote it`, () => {
      const options: { show?: TestId; now?: Stress } = {};
      if (c.showing) options.show = c.showing;
      if (c.now) options.now = c.now;
      const a = assess(c.state, RATES, options);
      // The sketch wrote fifteen checks; `flow` (line 32, ADR-0016) is worded by the Site's own tests below.
      const worded = a.checks.filter((k) => k.id !== 'flow').map((k) => ({ id: k.id, lines: linesLabel(k.lines), title: checkTitle(k.id), detail: asSketchWorded(k.facts) }));
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

describe('built in order, worded (ADR-0012)', () => {
  const stops = (facts: Facts): LineCheck => ({ id: 'stops', lines: [6], status: 'bad', facts, tiles: ['1,0', '2,0', '3,0'] });
  const without: Facts = { check: 'stops', case: 'without', count: 3 };
  const waiting: Facts = { check: 'stops', case: 'waiting', count: 3 };

  it('line 6 counts only its own neighborhoods as under construction', () => {
    expect(stopsInHand(stops(without), ['2,0', '3,0', '9,9'])).toBe(2);
    expect(stopsInHand({ ...stops(without), id: 'ways' }, ['2,0'])).toBe(0);
  });

  it('with none in hand line 6 keeps its old words; with some, the line is under construction', () => {
    expect(checkDetail(without, RATES)).toBe('3 neighborhoods have no stop on a line to the ring. Draw the mover line through them.');
  });

  it('words the watches of a neighborhood nobody lives in yet on lines 4 and 17 (ADR-0012 Decision 8, amended)', () => {
    expect(checkDetail({ check: 'fields', case: 'waiting', count: 1, sets: 2, fieldWalk: 20 }, RATES)).toBe(
      '1 neighborhood nobody lives in yet is more than a 20-minute walk from fields and cannot ride to them.',
    );
    expect(checkDetail({ check: 'fields', case: 'waiting', count: 3, sets: 0, fieldWalk: 20 }, RATES)).toBe('There are no playing fields yet. Nobody lives here yet to miss them.');
    expect(checkDetail({ check: 'ways', case: 'waiting', share: 0.0464, count: 3 }, RATES)).toBe(
      '4.6% of trips go to 3 neighborhoods nobody lives in yet, longer than people will walk with no mover to take. Nobody makes them yet.',
    );
  });

  it('words a reactor site that carries the peak only while every module runs (ADR-0012 Decision 3, amended)', () => {
    expect(checkDetail({ check: 'power', case: 'noSpare', modules: 1, peakMw: 45, needed: 2, short: [] }, RATES)).toBe(
      '1 module carries a peak of 45 MW only while it runs. With it down for fuel the city has no power. It takes 2.',
    );
    expect(checkDetail({ check: 'power', case: 'noSpare', modules: 2, peakMw: 90, needed: 3, short: [] }, RATES)).toBe(
      '2 modules carry a peak of 90 MW only while all run. With one down for fuel the rest fall short. It takes 3.',
    );
    expect(checkDetail({ check: 'power', case: 'short', modules: 1, peakMw: 90, needed: 3, short: [] }, RATES)).toBe('1 module cannot carry a peak of 90 MW with one down for fuel. It takes 3.');
    expect(checkDetail(without, RATES, 3)).toBe('3 neighborhoods have no stop on a line to the ring. The mover line to them is under construction.');
    expect(checkDetail(without, RATES, 2)).toBe('3 neighborhoods have no stop on a line to the ring. The mover line to 2 of them is under construction. Draw it through the other one.');
    expect(checkDetail(without, RATES, 1)).toBe('3 neighborhoods have no stop on a line to the ring. The mover line to 1 of them is under construction. Draw it through the other 2.');
    expect(checkDetail({ check: 'stops', case: 'without', count: 1 }, RATES, 1)).toBe('1 neighborhood has no stop on a line to the ring. The mover line to it is under construction.');
  });

  it('a neighborhood nobody lives in yet is under construction too, with nothing to draw', () => {
    expect(checkDetail(waiting, RATES)).toBe('3 neighborhoods nobody lives in yet have no stop on a line to the ring.');
    expect(checkDetail(waiting, RATES, 3)).toBe('3 neighborhoods nobody lives in yet have no stop on a line to the ring. The mover line to them is under construction.');
    expect(checkDetail(waiting, RATES, 1)).toBe('3 neighborhoods nobody lives in yet have no stop on a line to the ring. The mover line to 1 of them is under construction.');
  });

  const empty: HeldBack = { hood: '1,0', short: ['power'], seats: ['elementary'] };
  const dry: HeldBack = { hood: '2,0', short: ['power', 'water', 'sewage', 'waste'], seats: [] };
  const share: HeldBack = { hood: '3,0', short: [], seats: ['middle', 'high'] };

  it('held-back neighborhoods are grouped by what they wait for: empty for a service, the childless share for seats', () => {
    expect(heldBackLine([])).toBe('');
    expect(heldBackLine([empty, { ...empty, hood: '4,0' }, dry, share])).toBe(
      '2 neighborhoods stand empty, waiting for power. ' +
        '1 neighborhood stands empty, waiting for power, drinking water, sewage treatment and waste handling. ' +
        '1 neighborhood holds only households with no school-age children, waiting for middle-school and high-school seats.',
    );
  });

  it('a neighborhood short of a service is worded empty whatever seats it also lacks; a month with no homes names none', () => {
    expect(heldBackLine([empty])).toBe('1 neighborhood stands empty, waiting for power.');
    const bare: MonthRow = { year: 1, month: 1, people: 0, homes: 0, arrived: 0, births: 0, deaths: 0, left: 0, spend: {} as MonthRow['spend'], heldBack: [empty] };
    expect(monthLine(bare)).toBe('Year 1, month 1: no homes stand yet, so nobody lives here.');
  });

  it('one held-back neighborhood, for the inspector', () => {
    expect(heldHere(empty)).toBe('Nobody lives here yet. It waits for power.');
    expect(heldHere(share)).toBe('Only households with no school-age children live here. It waits for middle-school and high-school seats.');
  });

  it("the year and the month say what holds neighborhoods back; the sketch's clock says nothing of it", () => {
    const alone = placeNeighborhood(emptyLayout(), '0,0', RATES);
    if (!alone.ok) throw new Error(alone.rejection.reason);
    const year = tick(startRun(alone.layout, 7, RATES, RULES, { inOrder: true }), RATES, RULES).clock?.record[1];
    if (!year) throw new Error('no year');
    expect(yearLine(year)).toContain('Year 1: 0 people.');
    expect(yearLine(year)).toContain('1 neighborhood stands empty, waiting for power, drinking water, sewage treatment and waste handling.');
    const sketch = tick(startRun(alone.layout, 7, RATES, RULES), RATES, RULES).clock?.record[1];
    if (!sketch) throw new Error('no year');
    expect(yearLine(sketch)).not.toContain('stands empty');
    const month = tickMonth(startRun(alone.layout, 7, RATES, RULES, { growth: true, inOrder: true }), RATES, RULES).clock?.growth?.months[0];
    if (!month) throw new Error('no month');
    expect(monthLine(month)).toBe(
      'Year 1, month 1: 0 people in homes for 5,000. Nobody came or went. 1 neighborhood stands empty, waiting for power, drinking water, sewage treatment and waste handling.',
    );
  });
});

describe('the clock started, and the months running on their own', () => {
  it('says what to press next: Play on the month clock, Next year on the yearly one, on the board or an empty site', () => {
    expect(clockStarted(RULES, true, false)).toBe(
      'The clock is on this city at year 0 of 20. What you place now is an order for the 10 crews. When your orders are in, press Play to let the months run, or Next month to step one.',
    );
    expect(clockStarted(RULES, true, true)).toBe(
      'An empty site, year 0, 10 crews. Place your first orders, then press Play to let the months run, or Next month to step one. Undo brings the old city back.',
    );
    // The yearly sentences are the ones the Board said before the month clock was the default.
    expect(clockStarted(RULES, false, false)).toBe(
      'The clock is running on this city: year 0 of 20. What you place now is an order for the 10 crews. Press Next year when your orders are in.',
    );
    expect(clockStarted(RULES, false, true)).toBe('An empty site, year 0, 10 crews. Place your first orders, then press Next year. Undo brings the old city back.');
    expect(yearsUp(RULES)).toBe(' The 20 years are up.');
    expect(PAUSED_FOR_ORDER).toBe('Paused: your order is in. Press Play to carry on.');
    expect(Object.values(SPEED_NAME)).toEqual(['Slow', 'Steady', 'Fast']);
  });
});

describe('the city growing itself, worded (ADR-0015)', () => {
  const GROW = { growth: true, inOrder: true, infer: true } as const;
  const hood = (): Layout => {
    const o = placeNeighborhood(emptyLayout(), '0,0', RATES);
    if (!o.ok) throw new Error('refused');
    return o.layout;
  };

  it('the first month on one neighborhood says what the city ordered, each for its need, and the neighborhood for the people arriving', () => {
    const g = tickMonth(startRun(hood(), 7, RATES, RULES, GROW), RATES, RULES);
    const facts = g.clock?.growth?.months[0]?.inferred;
    if (!facts) throw new Error('nothing ordered');
    expect(inferredLine(facts)).toBe(
      'The city ordered a ring building for a ring, 2 reactor modules for power, a water plant unit for water, a sewage plant unit for sewage, a waste works unit for waste, an elementary school, a middle school and a high school for school seats, playing fields for the walk to the fields, 9 stretches of mover line for the mover line and a neighborhood for the people arriving.',
    );
    expect(inferredCell(facts)).toContain('ring building, 2 reactor modules, water plant unit');
    expect(inferredCell(facts)).toContain('neighborhood');
  });

  it('an empty site\'s first month orders only a neighborhood; a need with no room is said after the orders', () => {
    const g = tickMonth(startRun(emptyLayout(), 7, RATES, RULES, GROW), RATES, RULES);
    const facts = g.clock?.growth?.months[0]?.inferred ?? [];
    expect(inferredLine(facts)).toBe('The city ordered a neighborhood for the people arriving.');
    expect(inferredCell(facts)).toBe('neighborhood');
    const noRoom: Inferred[] = [{ type: 'NoRoom', why: 'ring' }, { type: 'NoRoom', why: 'homes' }];
    expect(inferredLine([{ type: 'CircleOpened', middle: '9,0' }])).toBe('The city is full to its walk, so a new circle opens at 9,0 for the people arriving.');
    expect(inferredCell([{ type: 'CircleOpened', middle: '9,0' }])).toBe('circle at 9,0');
    expect(inferredLine(noRoom)).toBe('The site has no room for a ring and the people arriving.');
    expect(inferredCell(noRoom)).toBe('no room');
    expect(inferredCell([...facts, { type: 'NoRoom', why: 'modules' }])).toBe('neighborhood; no room');
    expect(inferredLine([])).toBe('');
  });

  it('every reason is worded, the veto is said, and the clock started says the city orders for itself', () => {
    for (const why of Object.keys(INFERRED_WHY) as InferredWhy[]) expect(INFERRED_WHY[why].length).toBeGreaterThan(2);
    expect(vetoSaid('water')).toBe('Vetoed: water plant unit. The city will not order it there again; order it yourself to lift the veto.');
    expect(ORDERED_BY_CITY).toBe('ordered by the city');
    expect(clockStarted(RULES, true, true, true)).toBe(
      'An empty site, year 0, 10 crews. Press Play and the city founds itself, or place your first orders, then press Play to let the months run, or Next month to step one. Undo brings the old city back. The city orders what it needs as people arrive; Cancel on the work in hand vetoes an order.',
    );
    expect(clockStarted(RULES, true, false, true)).toContain('The city orders what it needs as people arrive');
    expect(clockStarted(RULES, true, false, false)).not.toContain('The city orders');
    expect(clockStarted(RULES, true, true)).toBe(clockStarted(RULES, true, true, false));
  });
});

describe('the band and the flow, worded (ADR-0016)', () => {
  it('words the three band rejections by tool, the flow check in each case, the tile issue and the intake need', () => {
    expect(moveSaid('hood', { ok: false, rejection: { reason: 'InsideBand', tile: '4,0' } }, RATES)).toBe('Homes stand inside the band; the band is for the plants.');
    expect(moveSaid('ring', { ok: false, rejection: { reason: 'InsideBand', tile: '4,0' } }, RATES)).toBe('The ring stands in the middle of a circle, inside the band.');
    expect(moveSaid('water', { ok: false, rejection: { reason: 'OutsideBand', tile: '1,0' } }, RATES)).toBe('A plant stands on the outer band of a circle, by the shore.');
    expect(moveSaid('hood', { ok: false, rejection: { reason: 'OutsideCircle', tile: '15,-4' } }, RATES)).toBe("That ground is outside the city's circles. Nothing stands there until a circle is opened.");
    expect(moveSaid('hood', { ok: false, rejection: { reason: 'CircleOverlaps', tile: '4,0', shared: '0,0' } }, RATES)).toBe('A circle there would share 0,0 with one that stands. Circles stand side by side along the shore.');
    expect(moveSaid('hood', { ok: true, layout: emptyLayout(), event: { type: 'CircleOpened', middle: '9,0' } }, RATES)).toBe('A circle opens at 9,0: its ring in the middle, three rings of homes, and a band by the shore for its plants.');
    expect(checkDetail({ check: 'ring', case: 'none', rings: 1, short: [{ circle: '9,0', has: 0, needed: 1 }] }, RATES)).toBe('1 circle has no ring yet. Offices, government, the auditorium and fine dining have nowhere to go in it.');
    expect(checkDetail({ check: 'ring', case: 'none', rings: 0, short: [{ circle: '0,0', has: 0, needed: 1 }] }, RATES)).toBe('There is no ring yet. Offices, government, the auditorium and fine dining have nowhere to go.');
    expect(checkDetail({ check: 'ring', case: 'none', rings: 1, short: [{ circle: '9,0', has: 0, needed: 1 }, { circle: '18,0', has: 0, needed: 1 }] }, RATES)).toBe('2 circles have no ring yet. Offices, government, the auditorium and fine dining have nowhere to go in them.');
    expect(checkTitle('flow')).toBe('The intake is upstream of the outfall');
    expect(linesLabel([32])).toBe('Line 32');
    expect(checkDetail({ check: 'flow', case: 'idle' }, RATES)).toBe('With a water plant and a sewage plant in a circle, the lake decides their order along the shore.');
    expect(checkDetail({ check: 'flow', case: 'ordered', circles: 1 }, RATES)).toBe('In the circle the water intake is upstream of the sewage outfall along the shore.');
    expect(checkDetail({ check: 'flow', case: 'ordered', circles: 2 }, RATES)).toBe('In all 2 circles the water intake is upstream of the sewage outfall along the shore.');
    expect(checkDetail({ check: 'flow', case: 'reversed', circles: 1, water: ['0,4'], sewage: ['-1,4'] }, RATES)).toBe('In 1 circle the sewage outfall at -1,4 is upstream of the water intake at 0,4, so the city would drink what it returns.');
    expect(issueText({ kind: 'flowReversed' })).toBe('This plant is on the wrong side: the sewage outfall is upstream of the water intake.');
    expect(needText({ need: 'intake', sewage: ['-1,4'], answers: ['flow'] })).toBe('A water intake upstream of the outfall at -1,4.');
  });
});

describe('the circles, the band and the lake on the map (ADR-0016)', () => {
  it('words open ground by where it lies, names the circles, and words closing and opening a circle and the lake', () => {
    expect(GROUND_TEXT).toEqual({
      inside: 'Open ground inside the band, for homes and the ring.',
      band: 'Open ground on the band, where the plants stand.',
      outside: "Ground outside the city's circles. Nothing stands here until a circle is opened.",
    });
    expect([0, 1, 2, 5].map(circleName)).toEqual(['First circle', 'Second circle', 'Third circle', 'Circle 6']);
    expect(circleClosedSaid('9,0')).toBe('Closed: the circle at 9,0. The city will not open it again; open it yourself to lift the veto.');
    expect(CIRCLE_CLOSE).toBe('Close this circle');
    expect(CIRCLE_REOPEN).toBe('Open the circle again');
    expect(LAKE_LABEL).toBe('Lake');
    expect(currentLabel(1)).toBe('current runs east →');
    expect(currentLabel(-1)).toBe('← current runs west');
  });
});
