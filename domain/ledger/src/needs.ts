/**
 * @file The needs list: what every center, every district and the middle of the city must hold, and where each lands.
 * Public interface: NeedTier, CountedNeed, CappedNeed, Need, NEEDS, PlacedNeed, PlacedCountedNeed, PlacedCappedNeed,
 * OutNeed, TierShares, Placement, placeNeeds.
 * Owner context: Ledger (domain).
 */
import { TINY } from './constants.ts';
import { roundKm } from './geometry.ts';
import type { SharedPremises, WalkingCityPremises } from './premises.ts';

/** Where a need lands: in every center, shared between centers, in the middle of the city, or left out. */
export type NeedTier = 'center' | 'district' | 'city' | 'out';

/** A need counted by the people it takes to keep one open. 0 people means no minimum. */
export interface CountedNeed {
  readonly id: string;
  readonly tier: NeedTier;
  readonly kind: 'people';
  /** People one of these needs. */
  readonly people: number;
  /** Percent of the car city's trips that go to it. */
  readonly share: number;
}

/** A school: capped at a number of pupils, drawn from a run of grades. */
export interface CappedNeed {
  readonly id: string;
  readonly tier: NeedTier;
  readonly kind: 'cap';
  /** Pupils one of these holds at most. */
  readonly cap: number;
  /** School years it covers. */
  readonly grades: number;
  /** Percent of the car city's trips that go to it. */
  readonly share: number;
}

/** One entry of the needs list. */
export type Need = CountedNeed | CappedNeed;

/** Revision 3 of the ledger: the needs list. */
export const NEEDS: readonly Need[] = [
  { id: 'bakery', tier: 'center', kind: 'people', people: 2100, share: 2 },
  { id: 'butcher', tier: 'center', kind: 'people', people: 3700, share: 2 },
  { id: 'produce', tier: 'center', kind: 'people', people: 0, share: 2 },
  { id: 'dining', tier: 'center', kind: 'people', people: 500, share: 6 },
  { id: 'library', tier: 'center', kind: 'people', people: 0, share: 1 },
  { id: 'doctor', tier: 'center', kind: 'people', people: 4000, share: 2 },
  { id: 'park', tier: 'center', kind: 'people', people: 0, share: 8 },
  { id: 'elementary', tier: 'district', kind: 'cap', cap: 500, grades: 6, share: 5 },
  { id: 'middle', tier: 'district', kind: 'cap', cap: 1000, grades: 3, share: 2 },
  { id: 'high', tier: 'district', kind: 'cap', cap: 1500, grades: 4, share: 2 },
  { id: 'fields', tier: 'district', kind: 'people', people: 0, share: 1 },
  { id: 'urgent', tier: 'district', kind: 'people', people: 23300, share: 0 },
  { id: 'finedining', tier: 'city', kind: 'people', people: 71300, share: 0.5 },
  { id: 'auditorium', tier: 'city', kind: 'people', people: 0, share: 0.5 },
  { id: 'government', tier: 'city', kind: 'people', people: 0, share: 0.5 },
];

/** A need left out of the city. */
export interface OutNeed {
  readonly id: string;
  readonly tier: 'out';
}

/** What every placed need reports. */
interface PlacedBase {
  readonly id: string;
  readonly tier: 'center' | 'district' | 'city';
  /** How many each center (or the district, or the middle) gets. */
  readonly each: number;
  /** How many the city gets. */
  readonly count: number;
  /** People who share one. */
  readonly catch: number;
  /** The median home's walk to it, km. */
  readonly walkKm: number;
}

/** A school placed: it stretches upward, toward its cap. */
export interface PlacedCappedNeed extends PlacedBase {
  readonly grows: true;
  /** Pupils in each. */
  readonly size: number;
  /** Pupils against the cap. */
  readonly fill: number;
  /** How far the pupils can grow before the cap. Infinity when there are no pupils. */
  readonly slack: number;
}

/** A counted need placed: it stretches downward, toward the people it needs. */
export interface PlacedCountedNeed extends PlacedBase {
  readonly grows: false;
  /** Customers against the people it needs; null when it has no minimum. */
  readonly fill: number | null;
  /** How far the people can fall before it runs short; negative when already short; null when it has no minimum. */
  readonly slack: number | null;
}

/** One row of the placed needs. */
export type PlacedNeed = OutNeed | PlacedCappedNeed | PlacedCountedNeed;

/** Trip shares, as fractions, that the list claims for each tier. */
export interface TierShares {
  readonly center: number;
  readonly district: number;
  readonly city: number;
}

/** Where every need lands. */
export interface Placement {
  readonly rows: readonly PlacedNeed[];
  readonly share: TierShares;
  /** Districts in the city: the ground that shares the kind of school the city has fewest of. */
  readonly districts: number;
}

/** The figures of the city a placement needs. */
export interface PlacementGround {
  readonly centerPop: number;
  readonly centers: number;
  readonly density: number;
}

/**
 * Where each need lands, how many the city gets, and how far each can stretch.
 * Schools are counted with the pupils at the top of the band; everything that needs customers is counted
 * with the people at the bottom of it.
 * @param needs - the needs list
 * @param s - the shared premises
 * @param c - your city's premises
 * @param ground - the center size, the count of centers and the density already derived
 * @param band - the stretch the city must hold its rules across, from 0 to 0.95
 * @returns the placed rows, the trip share each tier claims, and the count of districts
 */
export function placeNeeds(
  needs: readonly Need[],
  s: SharedPremises,
  c: WalkingCityPremises,
  ground: PlacementGround,
  band: number,
): Placement {
  const low = 1 - band;
  const high = 1 + band;
  const pupils = (n: CappedNeed): number => s.pop * n.grades * s.gradeShare;
  const schools = (n: CappedNeed): number => Math.max(1, Math.ceil((pupils(n) * high) / n.cap - TINY));
  const fed = (people: number, wants: number): number => Math.max(1, Math.floor((people * low) / wants + TINY));
  const shared = needs.filter((n) => n.tier === 'district');
  const sharedSchools = shared.filter((n): n is CappedNeed => n.kind === 'cap');
  const districts = sharedSchools.length
    ? Math.min(...sharedSchools.map(schools))
    : shared.length
      ? 1
      : 0;
  const share = { center: 0, district: 0, city: 0 };
  const rows: PlacedNeed[] = needs.map((n): PlacedNeed => {
    if (n.tier === 'out') return { id: n.id, tier: 'out' };
    const tier = n.tier;
    share[tier] += n.share / 100;
    if (n.kind === 'cap') {
      let each: number;
      let count: number;
      let size: number;
      let caught: number;
      if (tier === 'center') {
        const here = ground.centerPop * n.grades * s.gradeShare;
        each = Math.max(1, Math.ceil((here * high) / n.cap - TINY));
        count = ground.centers * each;
        size = here / each;
        caught = ground.centerPop;
      } else {
        each = schools(n);
        count = each;
        size = pupils(n) / count;
        // Shared schools spread out; the middle's stay together.
        caught = tier === 'district' ? s.pop / count : s.pop;
      }
      return {
        id: n.id,
        tier,
        grows: true,
        each,
        count,
        size,
        catch: caught,
        fill: size / n.cap,
        slack: size > 0 ? n.cap / size - 1 : Infinity,
        walkKm: roundKm(caught, ground.density) * Math.SQRT1_2 * c.detour,
      };
    }
    // The people one center, or the whole city, brings.
    const place = tier === 'center' ? ground.centerPop : s.pop;
    const each =
      n.people > 0 ? fed(place, n.people) : tier === 'district' ? Math.max(1, districts) : 1;
    const count = (tier === 'center' ? ground.centers : 1) * each;
    const caught = tier === 'district' ? s.pop / each : place;
    const customers = place / each;
    return {
      id: n.id,
      tier,
      grows: false,
      each,
      count,
      catch: caught,
      fill: n.people > 0 ? customers / n.people : null,
      slack: n.people > 0 ? 1 - n.people / customers : null,
      walkKm: roundKm(caught, ground.density) * Math.SQRT1_2 * c.detour,
    };
  });
  return { rows, share, districts };
}
