/**
 * @file The assessment with its stretch tests: the board in an ordinary year, under this year's stress, and at each
 * edge of the band, with one stretch of mover line closed.
 * Public interface: TestId, BAND_TESTS, Given, StretchTest, Assessment, assess.
 * Owner context: Site (domain).
 */
import type { EdgeKey, TileKey } from './board.ts';
import { assessCore } from './assess.ts';
import type { CheckId, CheckStatus, Core, Facts, Score, Stress } from './checks.ts';
import { NO_STRESS } from './checks.ts';
import type { Layout } from './layout.ts';
import { bridges } from './network.ts';
import type { SiteRates } from './rates.ts';

/** The four stretch tests. */
export type TestId = 'children' | 'fewer' | 'more' | 'closure';

/** The three tests at the edges of the band, as the stress each applies. */
export function bandTests(band: number): readonly { readonly id: Exclude<TestId, 'closure'>; readonly stress: Stress }[] {
  return [
    { id: 'children', stress: { people: 0, children: band } },
    { id: 'fewer', stress: { people: -band, children: 0 } },
    { id: 'more', stress: { people: band, children: 0 } },
  ];
}

/** A line that gives under a stretch: worse off than in an ordinary year. */
export interface Given {
  readonly id: CheckId;
  readonly status: CheckStatus;
  readonly facts: Facts;
}

/** One stretch test's result. */
export type StretchTest =
  | { readonly id: Exclude<TestId, 'closure'>; readonly gives: readonly Given[] }
  | {
      readonly id: 'closure';
      readonly gives: readonly Given[];
      /** The stretch whose closing broke a line, or null when none does. */
      readonly edge: EdgeKey | null;
      /** Stretches with no way round them. */
      readonly weak: number;
      /** Stretches of line in all. */
      readonly lines: number;
    };

/** The board assessed: shown as asked, with the stretch tests always measured from an ordinary year. */
export interface Assessment extends Core {
  readonly tests: readonly StretchTest[];
  /** The stretch test being shown, or null for the board as it stands this year. */
  readonly showing: TestId | null;
  /** The score this year, whatever is shown. */
  readonly today: Score;
}

const RANK: Readonly<Record<CheckStatus, number>> = { idle: 0, ok: 0, warn: 1, bad: 2 };

/** What to show, and what is happening this year. */
export interface AssessOptions {
  /** Show the board under one stretch test instead of as it stands. */
  readonly show?: TestId | null;
  /** This year's stress, from the clock. Absent means an ordinary year. */
  readonly now?: Stress | null;
  /** People living in each neighborhood before the stress (ADR-0009). Absent means every neighborhood is full. */
  readonly occupied?: Readonly<Record<TileKey, number>>;
}

/**
 * Assess a layout: this year's checks and score, and the four stretch tests measured from an ordinary year, so they
 * stay a forecast. If all four hold, nothing the clock deals can break a line.
 * @param layout - the board
 * @param rates - the ledger's rates
 * @param options - what to show and what is happening this year
 */
export function assess(layout: Layout, rates: SiteRates, options: AssessOptions = {}): Assessment {
  const occupied = options.occupied ?? {};
  const plain = assessCore(layout, NO_STRESS, rates, occupied);
  const today = options.now ? assessCore(layout, options.now, rates, occupied) : plain;
  const was: Partial<Record<CheckId, number>> = {};
  for (const c of plain.checks) was[c.id] = RANK[c.status];
  // A line gives when the stretch leaves it worse off than it is in an ordinary year.
  const given = (then: Core): Given[] =>
    then.checks
      .filter((c) => RANK[c.status] > (was[c.id] ?? 0))
      .map((c) => ({ id: c.id, status: c.status, facts: c.facts }));
  const stretched: Partial<Record<TestId, Core>> = {};
  const tests: StretchTest[] = bandTests(rates.band).map((t) => {
    const then = assessCore(layout, t.stress, rates, occupied);
    stretched[t.id] = then;
    return { id: t.id, gives: given(then) };
  });
  // The fourth test: close the stretches with no way round them, worst first, until one breaks something.
  const weak = bridges(layout);
  let hit: { then: Core; gives: Given[]; edge: EdgeKey } | null = null;
  for (const w of weak) {
    const then = assessCore(layout, { people: 0, children: 0, closed: [w.edge] }, rates, occupied);
    const gives = given(then);
    if (gives.length) {
      hit = { then, gives, edge: w.edge };
      break;
    }
  }
  if (hit) stretched.closure = hit.then;
  tests.push({
    id: 'closure',
    gives: hit ? hit.gives : [],
    edge: hit ? hit.edge : null,
    weak: weak.length,
    lines: Object.keys(layout.lines).length,
  });
  const show = options.show ?? null;
  const shown = show ? stretched[show] : undefined;
  return { ...(shown ?? today), tests, showing: shown ? show : null, today: today.score };
}
