/**
 * @file Population: one month of a city's people from yearly rates, each a premise with a mark. The homes as built are
 * the capacity (5,000 a tile, which Ground draws and the capital rows price); what moves is occupancy, how many live in
 * them (ADR-0009). Births and deaths change the people in the homes; people who move house and leave the city empty
 * homes; people who want to live here join a waiting list at a yearly demand, and move from it into empty homes, so the
 * homes, not the demand, are the limit (David, 2026-10-21: the city is enormously popular).
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
  /** People who join the waiting list in a year, wanting to live here; they move in as homes stand empty. */
  readonly demandPerYear: Marked;
  /** Share of people who live in households with no school-age children: who may move into a neighborhood whose
   * pupils have no seats yet (ADR-0012 Decision 3). */
  readonly childlessShare: Marked;
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
  // Mine (David, 2026-10-21): above the 25,000 homes a year ten crews can finish, so a list forms and the build pace is
  // the limit. The sourced comparison is Frisco, TX, past 100,000: about 8,350 a year in 2010-2020, mostly migration.
  demandPerYear: { value: 30000, mark: { kind: 'mine' } },
  // Mine until a source is accepted (ADR-0012 Decision 3). The figure to find is the Census ACS count of people living
  // in households with no member aged 5 to 17, over all people in households.
  childlessShare: { value: 0.6, mark: { kind: 'mine' } },
};

/** One month of a city's people. */
export interface PopulationMonth {
  /** People at the start of the month. */
  readonly from: number;
  readonly births: number;
  readonly deaths: number;
  /** People who moved house and left the city. */
  readonly left: number;
  /** People who joined the waiting list. */
  readonly joined: number;
  /** People who moved from the waiting list into empty homes. */
  readonly arrived: number;
  /** People on the waiting list at the end of the month. */
  readonly waiting: number;
  /** People at the end of the month. */
  readonly to: number;
  /** Homes as built, in people (capacity). */
  readonly capacity: number;
}

const MONTHS = 12;

/**
 * One month of a city's people: a twelfth of the year's demand joins the waiting list, and as many from the list as
 * there are empty homes move in.
 * @param people - people at the start of the month
 * @param capacity - the homes open to arrivals, in people
 * @param waiting - people on the waiting list at the start of the month
 * @param k - the premises; POPULATION when left out
 * @returns the month's births, deaths, leavers, joiners and arrivals, the people at its end and the list left waiting
 * @throws RangeError when people, capacity or waiting is negative or not a number
 */
export function monthOf(people: number, capacity: number, waiting: number, k: PopulationPremises = POPULATION): PopulationMonth {
  if (!(people >= 0)) throw new RangeError(`people must be zero or more, not ${people}`);
  if (!(capacity >= 0)) throw new RangeError(`capacity must be zero or more, not ${capacity}`);
  if (!(waiting >= 0)) throw new RangeError(`waiting must be zero or more, not ${waiting}`);
  const births = (people * k.birthsPerThousand.value) / 1000 / MONTHS;
  const deaths = (people * k.deathsPerThousand.value) / 1000 / MONTHS;
  const left = (people * k.movingShare.value * k.leavingShare.value) / MONTHS;
  const stayed = Math.max(0, people + births - deaths - left);
  const joined = k.demandPerYear.value / MONTHS;
  // Arrivals come off the list into empty homes only; births in full homes are the stress band's crowding, not arrivals.
  const arrived = Math.min(Math.max(0, capacity - stayed), waiting + joined);
  return { from: people, births, deaths, left, joined, arrived, to: stayed + arrived, capacity, waiting: waiting + joined - arrived };
}
