/**
 * @file What stands on the site costs: each tile and each stretch of line priced at the Ledger's premises, by layer,
 * with the rows that belong to the city as a whole (the fleet, upkeep, getting around), the Land and Financing lines,
 * and the totals (ADR-0007 Decision 6). The Ledger is the only home of a unit cost and of the pricing arithmetic;
 * this module supplies the counts of what stands.
 * Public interface: SiteCost, costOf.
 * Owner context: Site (domain).
 *
 * A neighborhood is one center's share of the ledger's walking city: its streets, parks, floor, dumbwaiters, pipe,
 * lanes and entries are the ledger's rows divided by the centers, so a finished tile costs exactly its share. Its
 * sub-level walkway stands only where a stop does. A ring building is one building's worth of the middle's floor.
 * A plant is its modules or units at the groundworks premises. A stretch of line is a step of mover floor and track.
 * Schools and fields are inside the floor and the parks, so they add no row (Decision 5). Capital rows count the
 * homes as built; the per-person running rows count the people living in them this year, stress included.
 */
import { COSTS, priceCounts, tallyCost, waterGpd } from '@city/ledger';
import type { CostFigures, CostPremises, CostRow, Counted } from '@city/ledger';
import { edgeEnds } from './board.ts';
import type { EdgeKey, TileKey } from './board.ts';
import type { Core } from './checks.ts';
import type { Layout } from './layout.ts';
import { lineNetwork } from './network.ts';
import type { SiteRates } from './rates.ts';

const DAYS = 365;
const KM = 1000;
const M2_PER_ACRE = 1e6 / 247.105;

/** The site's money: the Ledger's figures, and which tile, stretch or the city as a whole each row belongs to. */
export interface SiteCost extends CostFigures {
  /** Each tile's rows: what stands on it, and the yearly services of the people on it. */
  readonly tiles: Readonly<Record<TileKey, readonly CostRow[]>>;
  /** Each stretch of line's rows: its floor and its track. */
  readonly stretches: Readonly<Record<EdgeKey, readonly CostRow[]>>;
  /** Rows that belong to no one tile: the fleet and where it waits, upkeep, and getting around. */
  readonly city: readonly CostRow[];
  /** The people the per-person figures divide by, this year. */
  readonly pop: number;
}

/**
 * Price what stands on a layout at the Ledger's premises.
 * @param layout - the board
 * @param core - the layout assessed this year: its score gives the fleet and the rides, people the occupants of each
 *   neighborhood (ADR-0009), pop1 a full one's
 * @param rates - the ledger's rates
 * @param k - the premises; the Ledger's COSTS when left out
 * @returns the money, by tile, stretch and the city as a whole
 */
export function costOf(layout: Layout, core: Pick<Core, 'score' | 'pop1' | 'people'>, rates: SiteRates, k: CostPremises = COSTS): SiteCost {
  const base = rates.base;
  const shared = rates.shared;
  const walking = rates.walking;
  const hood = rates.hood;
  const perCenter = (total: number): number => total / base.centers;
  const net = lineNetwork(layout.lines);
  const score = core.score;
  const floorPerBuilding = base.ringNeed > 0 ? base.middleFloorM2 / base.ringNeed : 0;
  const lowRisePerHood = perCenter(Math.max(0, shared.pop * (shared.homeFloor + shared.otherFloor) - base.middleFloorM2));

  const tiles: Record<TileKey, readonly CostRow[]> = {};
  for (const key of Object.keys(layout.tiles)) {
    const t = layout.tiles[key];
    if (!t) continue;
    const counted: Counted[] = [];
    const stop = net.onLine(key);
    if (t.kind === 'hood') {
      // The yearly per-person rows count the people living here this year (ADR-0009); the capital rows, the homes as built.
      const pop1 = core.people[key] ?? core.pop1;
      counted.push(
        { id: 'streets', layer: 'groundworks', count: hood * base.streets, premise: 'streetM2' },
        { id: 'parks', layer: 'groundworks', count: hood * walking.parks, premise: 'parkM2' },
        { id: 'entries', layer: 'groundworks', count: rates.entries, premise: 'entryEach' },
        { id: 'pipe', layer: 'groundworks', count: rates.pipeKm, premise: 'pipeKm' },
        { id: 'lanes', layer: 'groundworks', count: perCenter(base.laneKm), premise: 'laneKm' },
        { id: 'lowRiseFloor', layer: 'buildings', count: lowRisePerHood, premise: 'lowRiseM2' },
        { id: 'dumbwaiters', layer: 'buildings', count: perCenter(base.dumbwaiters), premise: 'dumbwaiterEach' },
      );
      if (stop) {
        counted.push({ id: 'walkwayFloor', layer: 'groundworks', count: rates.walkwayKm * KM * k.walkwayWidthM.value, premise: 'lowRiseM2' });
      }
      counted.push(
        { id: 'schools', layer: 'civic', count: pop1 * shared.gradeShare * k.grades.value, premise: 'pupilYear' },
        { id: 'police', layer: 'civic', count: pop1, premise: 'policePerson' },
        { id: 'fire', layer: 'civic', count: pop1, premise: 'firePerson' },
        { id: 'health', layer: 'civic', count: pop1, premise: 'healthPerson' },
        { id: 'library', layer: 'civic', count: pop1, premise: 'libraryPerson' },
        { id: 'welfare', layer: 'civic', count: pop1, premise: 'welfarePerson' },
        { id: 'higherEducation', layer: 'civic', count: pop1, premise: 'higherEducationPerson' },
        { id: 'administration', layer: 'civic', count: pop1, premise: 'administrationPerson' },
        { id: 'corrections', layer: 'civic', count: pop1, premise: 'correctionsPerson' },
        { id: 'courts', layer: 'civic', count: pop1, premise: 'courtsPerson' },
        { id: 'streetRunning', layer: 'civic', count: hood * base.streets, premise: 'streetRunM2' },
        { id: 'parkRunning', layer: 'civic', count: hood * walking.parks, premise: 'parkRunM2' },
        { id: 'electricity', layer: 'civic', count: (pop1 * k.kwhPerPersonYear.value) / 1000, premise: 'reactorMwh' },
        { id: 'water', layer: 'civic', count: (pop1 * waterGpd(base.yards + base.parks, k) * DAYS) / 1000, premise: 'waterKgal' },
        { id: 'sewer', layer: 'civic', count: (pop1 * k.sewageGpd.value * DAYS) / 1000, premise: 'sewerKgal' },
        { id: 'waste', layer: 'civic', count: pop1 * k.wasteTonsPerPersonYear.value, premise: 'wasteTon' },
        { id: 'goodsRuns', layer: 'civic', count: perCenter(base.goodsRuns) * DAYS, premise: 'goodsRun' },
        { id: 'porters', layer: 'civic', count: perCenter(base.porters), premise: 'porterYear' },
      );
    } else if (t.kind === 'ring') {
      counted.push({ id: 'highRiseFloor', layer: 'buildings', count: t.n * floorPerBuilding, premise: 'highRiseM2' });
    } else if (t.kind === 'power') {
      counted.push({ id: 'reactorModules', layer: 'groundworks', count: t.n, premise: 'reactorModuleEach' });
    } else {
      counted.push({ id: 'plantUnits', layer: 'groundworks', count: t.n, premise: 'plantUnitEach' });
    }
    if (stop) counted.push({ id: 'stations', layer: 'groundworks', count: 1, premise: 'stationEach' });
    tiles[key] = priceCounts(counted, k);
  }

  const stretches: Record<EdgeKey, readonly CostRow[]> = {};
  for (const edge of Object.keys(layout.lines)) {
    const [a, b] = edgeEnds(edge);
    if (!a || !b) continue;
    stretches[edge] = priceCounts(
      [
        { id: 'moverLineFloor', layer: 'groundworks', count: rates.stepKm * KM * k.moverLineWidthM.value, premise: 'lowRiseM2' },
        { id: 'moverTrack', layer: 'groundworks', count: rates.stepKm, premise: 'moverTrackKm' },
      ],
      k,
    );
  }

  const placed = [...Object.values(tiles).flat(), ...Object.values(stretches).flat()];
  const fleetRows = priceCounts(
    [
      { id: 'waiting', layer: 'groundworks', count: score.fleet * base.storagePerVeh, premise: 'waitingM2' },
      { id: 'vehicles', layer: 'fleet', count: score.fleet, premise: 'moverEach' },
    ],
    k,
  );
  const structures = [...placed, ...fleetRows]
    .filter((r) => r.layer === 'groundworks' || r.layer === 'buildings')
    .reduce((t, r) => t + r.cost, 0);
  // The city carries only the rows it has something of: an empty site has no fleet, nothing to keep up, no rides.
  const city = [
    ...fleetRows,
    ...priceCounts(
      [
        { id: 'upkeep', layer: 'upkeep', count: structures, premise: 'upkeepShare' },
        {
          id: 'vehicleKm',
          layer: 'households',
          count: score.vehicleTrips * score.rideKm * (1 + walking.emptyRunning) * DAYS,
          premise: 'moverKm',
        },
        { id: 'vehiclesRenewed', layer: 'households', count: score.fleet / k.vehicleLifeYears.value, premise: 'moverEach' },
      ],
      k,
    ),
  ].filter((r) => r.count > 0);
  const areaM2 = Object.keys(layout.tiles).length * rates.tileAcres * M2_PER_ACRE;
  const figures = tallyCost([...placed, ...city], score.pop, areaM2, k);
  return { ...figures, tiles, stretches, city, pop: score.pop };
}
