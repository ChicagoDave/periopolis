/**
 * @file Population: one month of a city's people from yearly rates, each a premise with a mark. The homes as built are
 * the capacity (5,000 a tile, which Ground draws and the capital rows price); what moves is occupancy, how many live in
 * them (ADR-0009). Births and deaths change the people in the homes; people who move house and leave the city empty
 * homes; people arrive into empty homes at no more than a citywide pace, the fastest new town's.
 * Public interface: PopulationPremises, POPULATION, PopulationMonth, monthOf.
 * Owner context: Ledger (domain).
 *
 * Every yearly rate is taken a twelfth a month (David, 2026-10-14: no seasons yet). People are counted as real
 * numbers, as every other ledger figure is; rounding is the Board's.
 */
import { accept, sourced } from './cost.ts';
import type { Marked } from './cost.ts';

/** The yearly rates a city's people change by. */
export interface PopulationPremises {
  /** Births a year per 1,000 people. */
  readonly birthsPerThousand: Marked;
  /** Deaths a year per 1,000 people. */
  readonly deathsPerThousand: Marked;
  /** Share of people who move house in a year, any distance. */
  readonly movingShare: Marked;
  /** Share of those movers who leave the city. */
  readonly leavingShare: Marked;
  /** Most people who arrive in a year, citywide, however many homes stand empty. */
  readonly arrivalsPerYear: Marked;
}

/** The rates as sourced in `docs/brainstorm/future-city/population.md` and decided on 2026-10-14. */
export const POPULATION: PopulationPremises = {
  birthsPerThousand: {
    value: 10.7,
    mark: accept(sourced('CDC NCHS final 2023 births: 3,596,017, 10.7 per 1,000', 2023, 'https://cdc.gov/nchs/fastats/births.htm')),
  },
  deathsPerThousand: {
    value: 9.2,
    mark: accept(
      sourced('NCHS Data Brief 521: 3,090,964 deaths in 2023, over the 2023 resident population', 2023, 'https://cdc.gov/nchs/products/databriefs/db521.htm'),
    ),
  },
  movingShare: {
    value: 0.087,
    mark: accept(sourced('Census CPS: 8.7% of people moved in 2022', 2022, 'https://census.gov/library/stories/2023/09/why-people-move.html')),
  },
  leavingShare: { value: 0.5, mark: { kind: 'mine' } },
  arrivalsPerYear: {
    value: 4800,
    mark: accept(sourced('Census: Irvine, CA grew from 62,134 (1980) to 110,330 (1990), about 4,800 a year', 1990, 'https://www.census.gov/')),
  },
};

/** One month of a city's people. */
export interface PopulationMonth {
  /** People at the start of the month. */
  readonly from: number;
  readonly births: number;
  readonly deaths: number;
  /** People who moved house and left the city. */
  readonly left: number;
  /** People who moved into empty homes. */
  readonly arrived: number;
  /** People at the end of the month. */
  readonly to: number;
  /** Homes as built, in people (capacity). */
  readonly capacity: number;
}

const MONTHS = 12;

/**
 * One month of a city's people.
 * @param people - people at the start of the month
 * @param capacity - the homes as built, in people
 * @param k - the premises; POPULATION when left out
 * @returns the month's births, deaths, leavers and arrivals, and the people at its end
 * @throws RangeError when people or capacity is negative or not a number
 */
export function monthOf(people: number, capacity: number, k: PopulationPremises = POPULATION): PopulationMonth {
  if (!(people >= 0)) throw new RangeError(`people must be zero or more, not ${people}`);
  if (!(capacity >= 0)) throw new RangeError(`capacity must be zero or more, not ${capacity}`);
  const births = (people * k.birthsPerThousand.value) / 1000 / MONTHS;
  const deaths = (people * k.deathsPerThousand.value) / 1000 / MONTHS;
  const left = (people * k.movingShare.value * k.leavingShare.value) / MONTHS;
  const stayed = Math.max(0, people + births - deaths - left);
  // Arrivals fill empty homes only; births in full homes are the stress band's crowding, not arrivals.
  const arrived = Math.min(Math.max(0, capacity - stayed), k.arrivalsPerYear.value / MONTHS);
  return { from: people, births, deaths, left, arrived, to: stayed + arrived, capacity };
}
