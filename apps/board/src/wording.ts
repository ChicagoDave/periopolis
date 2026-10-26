/**
 * @file Every sentence the page shows, worded from the domain's typed facts and events (ADR-0004). Nothing else in the
 * Board builds a sentence from rule state. The sketch's sentences are the oracle; test/wording.test.ts holds them to it.
 * Public interface: SITE_NAME, PIECE_NAME, PIECE_MANY, STATUS, LEVEL_NAME, PLACEHOLDER_TEXT, LAYER_NAME, COST_ROW_NAME,
 * PREMISE_UNIT, linesLabel, checkTitle, stopsInHand, checkDetail, issueText, testLabel, moveSaid, orderSaid, noticeText,
 * openedSentence, planCaption, layerLines, placeholderNote, lineAt, markLabel, markText, needText, proposalPrice, needsNow,
 * addedSaid; and the month clock and the day (ADR-0009): POPULATION_PREMISE, DAY_PREMISE, DAY_NAME, monthLine,
 * peopleNow, hourLabel, dayCaption; and who is held back (ADR-0012): heldBackLine, heldHere; and the clock's own
 * sentences: yearLine, yearsUp, clockStarted, PAUSED_FOR_ORDER, SPEED_NAME; the run ordering for itself (ADR-0015): INFERRED_WHY,
 * inferredLine, inferredCell, ORDERED_BY_CITY, vetoSaid; the circles and the band (ADR-0016): GroundKind, GROUND_TEXT,
 * circleName, circleClosedSaid, CIRCLE_REOPEN, CIRCLE_CLOSE, LAKE_LABEL, currentLabel; and the angled view: angledCaption, ANGLED_LABEL, TILT_NAME.
 * Owner context: Board (adapter).
 */
import type { GroundPlan, Layer, Level, Placeholder } from '@city/ground';
import { circleOf, isFull } from '@city/site';
import type { CostId, CostPremiseId, ExtraKind, Facts, Layout, LineCheck, Mark, Need, Outcome, Proposal, PlantKind, SchoolKind, SiteRates, TestId, Tile, TileIssue, TileKey } from '@city/site';
import type { Day, DayPremises, DayType, PopulationPremises } from '@city/site';
import type { Layer as MoneyLayer } from '@city/site';
import type { HeldBack, Inferred, InferredWhy, MonthRow, Notice, OrderEvent, PieceKind, RecordRow, RunRules } from '@city/run';
import type { Speed } from './autorun.ts';
import type { Tilt } from './session.ts';
import { cap, count, fmt, list, low, money, num, years } from './format.ts';

/** The six layers of money (ADR-0007), named. */
export const LAYER_NAME: Readonly<Record<MoneyLayer, string>> = {
  groundworks: 'Groundworks',
  buildings: 'Buildings',
  fleet: 'Fleet',
  upkeep: 'Upkeep',
  civic: 'Civic services',
  households: 'Households',
};

/** Each cost row, named. A row the Ledger or the Site adds and the Board has not named fails the type check. */
export const COST_ROW_NAME: Readonly<Record<CostId, string>> = {
  streets: 'Streets, paths and plazas',
  waiting: 'Ground where vehicles wait',
  parks: 'Parks',
  walkwayFloor: 'Sub-level walkway, as floor',
  moverLineFloor: 'Mover line floor',
  moverTrack: 'Mover track and systems',
  stations: 'Mover stops',
  entries: 'Sub-level entries',
  pipe: 'Goods pipe',
  lanes: 'Bike lanes',
  reactorModules: 'Reactor modules',
  plantUnits: 'Water, sewage and waste units',
  lowRiseFloor: 'Low-rise floor',
  highRiseFloor: 'Ring floor',
  dumbwaiters: 'Dumbwaiters',
  vehicles: 'Vehicles',
  upkeep: 'Upkeep of the structures',
  schools: 'Schools',
  police: 'Police',
  fire: 'Fire',
  health: 'Health',
  library: 'Libraries',
  welfare: 'Public welfare',
  higherEducation: 'Higher education',
  administration: 'Administration',
  corrections: 'Corrections',
  courts: 'Courts',
  streetRunning: 'Running the streets',
  parkRunning: 'Running the parks',
  electricity: 'Electricity',
  water: 'Drinking water',
  sewer: 'Sewage treatment',
  waste: 'Waste',
  goodsRuns: 'Goods runs',
  porters: 'Porters',
  vehicleKm: 'Vehicle-kilometers',
  vehiclesRenewed: 'Vehicles worn out',
  insurance: 'Car insurance',
};

/** What each premise prices one of: "a m²", "each", "a pupil a year". A premise without a unit fails the type check. */
export const PREMISE_UNIT: Readonly<Record<CostPremiseId, string>> = {
  lowRiseM2: 'a m² of floor',
  highRiseM2: 'a m² of floor',
  dumbwaiterEach: 'each',
  streetM2: 'a m²',
  waitingM2: 'a m²',
  parkM2: 'a m²',
  walkwayWidthM: 'm wide',
  moverLineWidthM: 'm wide',
  moverTrackKm: 'a km',
  stationEach: 'each',
  entryEach: 'each',
  pipeKm: 'a km',
  laneKm: 'a km',
  reactorModuleEach: 'a module',
  plantUnitEach: 'a unit',
  carEach: 'a car',
  moverEach: 'a mover',
  upkeepShare: 'of the structures a year',
  // (upkeepShare and financeRate are shares; lineAt words them as percentages.)
  pupilYear: 'a pupil a year',
  policePerson: 'a person a year',
  firePerson: 'a person a year',
  healthPerson: 'a person a year',
  libraryPerson: 'a person a year',
  welfarePerson: 'a person a year',
  higherEducationPerson: 'a person a year',
  administrationPerson: 'a person a year',
  correctionsPerson: 'a person a year',
  courtsPerson: 'a person a year',
  streetRunM2: 'a m² of street a year',
  parkRunM2: 'a m² of park a year',
  gridKwh: 'a kWh',
  reactorMwh: 'a MWh',
  waterKgal: 'a thousand gallons',
  sewerKgal: 'a thousand gallons',
  wasteTon: 'a ton',
  goodsRun: 'a run',
  porterYear: 'a porter a year',
  kwhPerPersonYear: 'kWh a person a year',
  waterBaseGpd: 'gallons a person a day',
  wateringMm: 'mm a year on green ground',
  sewageGpd: 'gallons a person a day',
  wasteTonsPerPersonYear: 'tons a person a year',
  grades: 'school years',
  carKm: 'a km',
  carInsuranceYear: 'a car a year',
  moverKm: 'a km',
  vehicleLifeYears: 'years',
  landM2: 'a m² of land',
  financeRate: 'a year',
  financeYears: 'years',
};

/** Premises that are shares of money, not prices: worded as percentages. */
const SHARE_PREMISES: readonly CostPremiseId[] = ['upkeepShare', 'financeRate'];

/**
 * "748,375 at $300 a m²", or for upkeep "$14.0 B of structures at 2% a year": how many of what, at which premise.
 * @param line - a cost row or a gathered line: its count, premise and the premise's value
 */
export function lineAt(line: { readonly count: number; readonly premise: CostPremiseId; readonly unit: number }): string {
  if (SHARE_PREMISES.includes(line.premise)) return `${money(line.count)} at ${num(100 * line.unit, 1)}% ${PREMISE_UNIT[line.premise]}`;
  return `${num(line.count, line.count < 10 ? 1 : 0)} at ${money(line.unit)} ${PREMISE_UNIT[line.premise]}`;
}

/** A mark as a chip: "Yours", "Sourced 2024", "Sourced 2024, accepted", "Mine". */
export function markLabel(mark: Mark): string {
  switch (mark.kind) {
    case 'yours':
      return 'Yours';
    case 'mine':
      return 'Mine';
    case 'sourced':
      return mark.accepted ? `Sourced ${mark.year}, accepted` : `Sourced ${mark.year}`;
  }
}

/** A mark in words: whose figure it is, and for a sourced one, the source, its year and whether it is accepted. */
export function markText(mark: Mark): string {
  switch (mark.kind) {
    case 'yours':
      return 'Your figure, from the lines.';
    case 'mine':
      return 'My placeholder. No public source found yet.';
    case 'sourced':
      return mark.accepted
        ? `Sourced: ${mark.source} (${mark.year}). Accepted.`
        : `Sourced: ${mark.source} (${mark.year}). A placeholder until accepted.`;
  }
}

/** What stands on a tile, named. */
export const SITE_NAME: Readonly<Record<Tile['kind'] | ExtraKind, string>> = {
  hood: 'Neighborhood',
  ring: 'Ring',
  power: 'Reactor site',
  water: 'Water plant',
  sewage: 'Sewage plant',
  waste: 'Waste works',
  elementary: 'Elementary school',
  middle: 'Middle school',
  high: 'High school',
  fields: 'Playing fields',
};

/** One piece a crew builds, named. */
export const PIECE_NAME: Readonly<Record<PieceKind, string>> = {
  hood: 'neighborhood',
  ring: 'ring building',
  elementary: 'elementary school',
  middle: 'middle school',
  high: 'high school',
  fields: 'playing fields',
  line: 'stretch of mover line',
  power: 'reactor module',
  water: 'water plant unit',
  sewage: 'sewage plant unit',
  waste: 'waste works unit',
};

/** Several pieces, named. */
export const PIECE_MANY: Readonly<Record<PieceKind, string>> = {
  hood: 'neighborhoods',
  ring: 'ring buildings',
  elementary: 'elementary schools',
  middle: 'middle schools',
  high: 'high schools',
  fields: 'sets of playing fields',
  line: 'stretches of mover line',
  power: 'reactor modules',
  water: 'water plant units',
  sewage: 'sewage plant units',
  waste: 'waste works units',
};

/** The two levels of a tile's ground, named. */
export const LEVEL_NAME: Readonly<Record<Level, string>> = { surface: 'Surface', sub: 'Sub level' };

/** Each placement the Ground chose because the ledger does not fix it, named. */
export const PLACEHOLDER_TEXT: Readonly<Record<Placeholder, string>> = {
  'row-pitch': 'the space between rows',
  'row-positions': 'where the rows sit',
  'center-size': 'the size of the center',
  'park-position': 'where the park sits',
  'lane-edges': 'which edges carry the bike lane',
  'entry-positions': 'where the entries sit',
  'pipe-positions': 'where the pipe runs',
  'building-angles': 'where round the plaza the first building stands',
};

/** A check's status, as a chip. */
export const STATUS: Readonly<Record<LineCheck['status'], string>> = { ok: 'Holds', warn: 'Watch', bad: 'Broken', idle: 'Not yet' };

const DAILY: Readonly<Record<string, string>> = {
  bakery: 'the bakery',
  butcher: 'the butcher',
  dining: 'the cafés',
  doctor: "the doctor's office",
};

const PLANT_NOUN: Readonly<Record<'water' | 'sewage' | 'waste', string>> = { water: 'water plant', sewage: 'sewage plant', waste: 'waste works' };
const PLANT_WHAT: Readonly<Record<'water' | 'sewage' | 'waste', string>> = {
  water: 'drinking water',
  sewage: 'sewage treatment',
  waste: 'sorting and digesting',
};

const SCHOOL_KINDS: readonly SchoolKind[] = ['elementary', 'middle', 'high'];

function isSchool(id: string): id is SchoolKind {
  return (SCHOOL_KINDS as readonly string[]).includes(id);
}

/** "Lines 3, 13, 14" or "Line 16". */
export function linesLabel(lines: readonly number[]): string {
  return `${lines.length > 1 ? 'Lines' : 'Line'} ${lines.join(', ')}`;
}

const whose = (kind: SchoolKind): string => (kind === 'elementary' ? 'elementary' : `${kind}-school`);

/** A check's title. */
export function checkTitle(id: LineCheck['id']): string {
  switch (id) {
    case 'daily':
      return 'Every neighborhood feeds its daily list';
    case 'size':
      return 'The city is big enough for urgent care and fine dining';
    case 'ring':
      return 'The ring has room for the offices and halls';
    case 'work':
      return 'Work is within a 30-minute walk';
    case 'stops':
      return 'Every neighborhood has a mover stop';
    case 'elementary':
    case 'middle':
    case 'high':
      return `Every ${whose(id)} pupil has a seat within a 30-minute walk`;
    case 'fields':
      return 'Playing fields are a longer walk or a short ride away';
    case 'ways':
      return 'No trip is left without a way';
    case 'power':
      return 'The reactors carry the peak with one module down';
    case 'water':
      return 'Everyone has treated drinking water';
    case 'sewage':
      return 'All sewage is treated';
    case 'waste':
      return 'Waste is sorted and food waste digested';
    case 'haul':
      return 'Nothing is hauled on the surface';
    case 'flow':
      return 'The intake is upstream of the outfall';
  }
}

/**
 * How many of the neighborhoods a check counts have a stop under construction (ADR-0012 Decision 6); 0 for any check
 * but line 6.
 * @param check - the check
 * @param building - the neighborhoods whose stop the work in hand will give them
 */
export function stopsInHand(check: LineCheck, building: readonly TileKey[]): number {
  if (check.id !== 'stops') return 0;
  return check.tiles.filter((k) => building.includes(k)).length;
}

/** Line 6's neighborhoods whose stop is under construction, after the sentence naming them; draw the rest if asked. */
function underConstruction(n: number, building: number, drawRest: boolean): string {
  if (building >= n) return ` The mover line to ${n === 1 ? 'it' : 'them'} is under construction.`;
  const rest = n - building;
  const draw = drawRest ? ` Draw it through the other ${rest === 1 ? 'one' : String(rest)}.` : '';
  return ` The mover line to ${building} of them is under construction.${draw}`;
}

/**
 * A check's detail sentence, from its facts.
 * @param facts - the check's facts
 * @param rates - the ledger's rates
 * @param building - on line 6, how many of the neighborhoods it counts have a stop under construction (`stopsInHand`)
 */
export function checkDetail(facts: Facts, rates: SiteRates, building = 0): string {
  switch (facts.check) {
    case 'daily':
      if (facts.case === 'idle') return `Place a neighborhood to begin. Each is ${num(facts.hood)} people with its own bakery, butcher, cafés, library, doctor and park.`;
      if (facts.case === 'filling') {
        const text = list(facts.short.map((id) => DAILY[id] ?? id));
        return `${count(facts.count, 'neighborhood is', 'neighborhoods are')} still filling; with ${num(facts.pop1)} people in the emptiest, ${text}${facts.short.length > 1 ? ' wait' : ' waits'} for customers as people move in.`;
      }
      if (facts.case === 'short') {
        const text = list(facts.short.map((id) => DAILY[id] ?? id));
        return `With ${num(facts.pop1)} people in ${facts.uneven ? 'the emptiest neighborhood' : 'a neighborhood'}, ${text}${facts.short.length > 1 ? ' run' : ' runs'} short of customers.`;
      }
      return `${facts.uneven ? 'The emptiest neighborhood' : 'Each neighborhood'} has ${num(facts.pop1)} people. Its hungriest need, the doctor's office, wants ${num(facts.hungriest)}.`;
    case 'size': {
      if (facts.case === 'underFine') {
        return `Fine dining wants ${num(facts.fine)} people in the city. It has ${num(facts.pop)}, which is ${num((100 * facts.pop) / facts.fine)}% of that.`;
      }
      const both = `Urgent care wants ${num(facts.urgent)} people in the city and fine dining ${num(facts.fine)}.`;
      if (facts.case === 'idle') return both;
      return `${both} The city has ${num(facts.pop)}.`;
    }
    case 'ring':
      if (facts.case === 'idle') return 'The ring is the middle: a circle of 25-story buildings.';
      if (facts.case === 'none') {
        return facts.rings
          ? `${count(facts.short.length, 'circle has', 'circles have')} no ring yet. Offices, government, the auditorium and fine dining have nowhere to go in ${facts.short.length === 1 ? 'it' : 'them'}.`
          : 'There is no ring yet. Offices, government, the auditorium and fine dining have nowhere to go.';
      }
      if (facts.case === 'full') {
        return `${facts.rings > 1 ? count(facts.over, 'ring is', 'rings are') : 'The ring is'} full. One building holds the offices and halls of ${num(facts.serves)} people, so ${num(facts.pop)} people take ${facts.needed}.`;
      }
      return `${count(facts.buildings, 'building holds', 'buildings hold')} the offices and halls of ${num(facts.buildings * facts.serves)} people. The city has ${num(facts.pop)}.`;
    case 'work':
      if (facts.case === 'idle') return 'A dashed circle around each ring marks the 30-minute walk.';
      if (facts.case === 'cut') return `${count(facts.count, 'neighborhood is', 'neighborhoods are')} past the walk to the ring and ${facts.count === 1 ? 'has' : 'have'} no mover line to it.`;
      if (facts.case === 'far') return `${count(facts.count, 'neighborhood is', 'neighborhoods are')} past the 30-minute walk. Their people ride a mover to work, or the city needs a second ring.`;
      return `The farthest neighborhood is a ${num(facts.farthestMin)}-minute walk from its ring.`;
    case 'stops':
      if (facts.case === 'idle') return 'A stop sits under the center of any tile the mover line touches.';
      if (facts.case === 'without') {
        const lead = `${count(facts.count, 'neighborhood has', 'neighborhoods have')} no stop on a line to the ring.`;
        if (building > 0) return lead + underConstruction(facts.count, building, true);
        return `${lead} Draw the mover line through ${facts.count === 1 ? 'it' : 'them'}.`;
      }
      if (facts.case === 'waiting') {
        const lead = `${count(facts.count, 'neighborhood nobody lives in yet has', 'neighborhoods nobody lives in yet have')} no stop on a line to the ring.`;
        return building > 0 ? lead + underConstruction(facts.count, building, false) : lead;
      }
      return 'Every neighborhood has a stop under its center, on a line to the ring.';
    case 'elementary':
    case 'middle':
    case 'high': {
      const noun = SITE_NAME[facts.check].toLowerCase();
      if (facts.case === 'idle') return `A school of this kind holds at most ${num(facts.cap)} pupils.`;
      if (facts.case === 'none') return `There is no ${noun} yet. ${num(facts.pupils)} pupils have nowhere to go.`;
      if (facts.case === 'waiting') return `There is no ${noun} yet. No pupils live here yet.`;
      if (facts.case === 'unseated') return `${num(facts.missing)} pupils in ${count(facts.hoods, 'neighborhood', 'neighborhoods')} have no seat within a 30-minute walk. A school holds at most ${num(facts.cap)}.`;
      return `${count(facts.schools, 'school', 'schools')} for ${num(facts.pupils)} pupils. The fullest has ${num(facts.fullest)} of ${num(facts.cap)} seats, and the longest walk is ${num(facts.longestMin)} minutes.`;
    }
    case 'fields':
      if (facts.case === 'idle') return 'Fields sit beside a neighborhood and serve the ones around it.';
      if (facts.case === 'none') return 'There are no playing fields yet.';
      if (facts.case === 'far') return `${count(facts.count, 'neighborhood is', 'neighborhoods are')} more than a ${facts.fieldWalk}-minute walk from fields and cannot ride to them.`;
      if (facts.case === 'waiting') {
        if (facts.sets === 0) return 'There are no playing fields yet. Nobody lives here yet to miss them.';
        return `${count(facts.count, 'neighborhood nobody lives in yet is', 'neighborhoods nobody lives in yet are')} more than a ${facts.fieldWalk}-minute walk from fields and cannot ride to them.`;
      }
      return `${count(facts.sets, 'set', 'sets')} of fields. Every neighborhood is within a ${facts.fieldWalk}-minute walk or a mover ride of one.`;
    case 'ways':
      if (facts.case === 'idle') return 'Past a 15-minute walk people take a mover, or a bike if it is near enough.';
      if (facts.case === 'stuck') return `${num(100 * facts.share, 1)}% of trips are longer than people will walk and have no mover to take. Run the mover line to the tiles marked.`;
      if (facts.case === 'waiting') return `${num(100 * facts.share, 1)}% of trips go to ${count(facts.count, 'neighborhood nobody lives in yet', 'neighborhoods nobody lives in yet')}, longer than people will walk with no mover to take. Nobody makes them yet.`;
      return `${num(100 * facts.foot)}% of trips are on foot, ${num(100 * facts.bike)}% by bike and ${num(100 * facts.ride)}% by mover.${facts.nowhere > 0.0005 ? ` Another ${num(100 * facts.nowhere, 1)}% have no place to go to.` : ''}`;
    case 'power':
      if (facts.case === 'idle') return `A module makes ${facts.moduleMw} MW. The city needs enough to carry its peak while one is down for fuel.`;
      if (facts.case === 'short') return `${facts.modules ? `${count(facts.modules, 'module', 'modules')} cannot` : 'With no modules the city cannot'} carry a peak of ${num(facts.peakMw)} MW with one down for fuel. It takes ${facts.needed}.`;
      if (facts.case === 'noSpare') {
        return facts.modules === 1
          ? `1 module carries a peak of ${num(facts.peakMw)} MW only while it runs. With it down for fuel the city has no power. It takes ${facts.needed}.`
          : `${facts.modules} modules carry a peak of ${num(facts.peakMw)} MW only while all run. With one down for fuel the rest fall short. It takes ${facts.needed}.`;
      }
      return `${count(facts.modules, 'module', 'modules')}. With one down for fuel the rest give ${num(facts.firmMw)} MW, against a peak of ${num(facts.peakMw)} MW.`;
    case 'water':
    case 'sewage':
    case 'waste': {
      const noun = PLANT_NOUN[facts.check];
      if (facts.case === 'idle') return `One unit of a ${noun} serves ${num(facts.serves)} people.`;
      if (facts.case === 'short') return `${facts.units ? `${count(facts.units, 'unit serves', 'units serve')} ${num(facts.cap)} people` : `There is no ${noun} yet`}. The city has ${num(facts.pop)}, which takes ${facts.needed}.`;
      const extra =
        facts.check === 'sewage' && facts.cleansMgd !== null && facts.coolingMgd !== null
          ? ` It cleans ${num(facts.cleansMgd, 1)} million gallons a day, and cooling the reactors takes ${num(facts.coolingMgd, 1)}.`
          : '';
      return `${count(facts.units, 'unit', 'units')} of ${PLANT_WHAT[facts.check]} for ${num(facts.cap)} people.${extra}`;
    }
    case 'haul':
      if (facts.case === 'idle') return 'Plants are reached through the sub level, so each needs the mover line.';
      if (facts.case === 'loose') return `${count(facts.count, 'plant is', 'plants are')} off the mover line. With no trucks on the surface, nothing can reach ${facts.count === 1 ? 'it' : 'them'}.`;
      void rates;
      return 'Every plant is on the mover line, so crews and freight reach it below ground.';
    case 'flow':
      if (facts.case === 'idle') return 'With a water plant and a sewage plant in a circle, the lake decides their order along the shore.';
      if (facts.case === 'reversed')
        return `In ${count(facts.circles, 'circle', 'circles')} the sewage outfall at ${list(facts.sewage)} is upstream of the water intake at ${list(facts.water)}, so the city would drink what it returns.`;
      return `In ${facts.circles === 1 ? 'the circle' : `all ${facts.circles} circles`} the water intake is upstream of the sewage outfall along the shore.`;
  }
}

/** An issue at one tile, as the inspector lists it. */
export function issueText(issue: TileIssue): string {
  switch (issue.kind) {
    case 'dailyShort': {
      const text = list(issue.needs.map((id) => DAILY[id] ?? id));
      return `${cap(text)}${issue.needs.length > 1 ? ' run' : ' runs'} short of people`;
    }
    case 'ringFull':
      return `Needs ${count(issue.needs, 'building', 'buildings')} for ${num(issue.load)} people, and has ${issue.has}`;
    case 'farFromRingNoLine':
      return `A ${num(issue.walkMin)}-minute walk from the ring, with no mover line to it`;
    case 'farFromRing':
      return `A ${num(issue.walkMin)}-minute walk from the ring, so people ride to work`;
    case 'lineMissesRing':
      return 'Its mover line does not reach the ring';
    case 'noStop':
      return 'No mover stop';
    case 'pupilsUnseated':
      return `${num(issue.pupils)} ${whose(issue.school)} pupils have no seat within a 30-minute walk`;
    case 'fieldsFar':
      return `Fields are a ${num(issue.walkMin)}-minute walk away with no mover to them`;
    case 'tripsStuck':
      return `${num(100 * issue.share, issue.share < 0.1 ? 1 : 0)}% of its trips are past the walk with no mover to take`;
    case 'tripsToHereStuck':
      return 'Trips to it are past the walk, and no mover runs here';
    case 'plantOffLine':
      return 'Not on the mover line, so nothing can reach it below ground';
    case 'flowReversed':
      return 'This plant is on the wrong side: the sewage outfall is upstream of the water intake.';
  }
}

/**
 * What the city needs to keep its lines whole, as the needs list words it: one line per thing to build, and for a
 * need the squeeze adds, that it is built with room for the squeeze: in a full circle because it is full (ADR-0018),
 * a school in a growing circle for the wave of families too (ADR-0020).
 * @param need - one need from the Site's `needsOf`
 * @param layout - the board the need was read on, to say whether its circle is full
 * @param rates - the ledger's rates, for the board's outline
 * @returns the sentence
 */
export function needText(need: Need, layout: Layout, rates: SiteRates): string {
  const squeezeSaid = (n: { readonly squeeze?: true }): string => (n.squeeze ? squeezeWhy(need, layout, rates) : '');
  switch (need.need) {
    case 'ring':
      return `A ring of ${count(need.buildings, 'building', 'buildings')} for the offices and halls.${squeezeSaid(need)}`;
    case 'ringBuildings':
      return `${cap(count(need.add, 'more building', 'more buildings'))} on the ring at ${need.tile}.${squeezeSaid(need)}`;
    case 'modules':
      return `${cap(count(need.add, 'more reactor module', 'more reactor modules'))}, to carry the peak with one down for fuel.${squeezeSaid(need)}`;
    case 'plantUnits':
      return `${cap(count(need.add, `more ${PLANT_NOUN[need.plant]} unit`, `more ${PLANT_NOUN[need.plant]} units`))}.${squeezeSaid(need)}`;
    case 'schools': {
      const noun = SITE_NAME[need.school].toLowerCase();
      const seat = need.squeeze ? 'with no seat in a squeeze' : 'with no seat';
      return `${cap(count(need.add, `more ${noun}`, `more ${noun}s`))} near ${list(need.near)}, for ${num(need.pupils)} pupils ${seat}.${squeezeSaid(need)}`;
    }
    case 'fields':
      return `Playing fields near ${list(need.near)}.`;
    case 'line':
      return `The mover line run to ${list(need.reach)}, on a line to the ring.`;
    case 'intake':
      return `A water intake upstream of the outfall at ${list(need.sewage)}.`;
  }
}

/** Why a need the squeeze adds is built: its circle is full (ADR-0018), or, growing, its schools seat the wave (ADR-0020). */
function squeezeWhy(need: Need, layout: Layout, rates: SiteRates): string {
  const circle = needCircle(need, layout);
  if (circle !== null && isFull(layout, circle, rates.outline)) return ' The circle is full, so it is built with room for the squeeze.';
  return ' It is built with room for the squeeze and the wave of families.';
}

/** The circle a need is in, or null when none. */
function needCircle(need: Need, layout: Layout): TileKey | null {
  switch (need.need) {
    case 'ring':
    case 'modules':
    case 'plantUnits':
      return need.circle;
    case 'ringBuildings':
      return circleOf(layout.circles, need.tile);
    case 'schools':
      return need.near[0] === undefined ? null : circleOf(layout.circles, need.near[0]);
    default:
      return null;
  }
}

/**
 * What a proposal adds to the bill, or that the site has no room for it.
 * @param p - one proposal from the Site's `proposeFor`
 */
export function proposalPrice(p: Proposal): string {
  if (!p.room) return 'There is no room on the site for it.';
  if (Math.abs(p.build) < 0.5 && Math.abs(p.run) < 0.5) return 'Inside floor already built; it costs nothing more.';
  // A school or fields nearer home can save money: fewer rides, so a smaller fleet.
  const part = (x: number, what: string): string => (x <= -0.5 ? `${money(-x)} less ${what}` : `${money(Math.max(0, x))} ${what}`);
  return `${cap(part(p.build, 'to build'))}, ${part(p.run, 'a year to run')}.`;
}

/**
 * The needs card's opening sentence.
 * @param count - proposals there are room for
 * @param running - whether the clock runs
 * @param noRoom - whether the last need has no room on the site
 */
export function needsNow(count: number, running: boolean, noRoom: boolean): string {
  if (running) return 'While the clock runs, the crews build what you order. Stop the clock to see what the city needs.';
  if (!count && !noRoom) return 'The city needs nothing more to keep its lines whole.';
  const lead = count ? `${count === 1 ? 'One addition keeps' : `${num(count)} additions keep`} the lines whole that building can mend.` : '';
  const tail = noRoom ? `${lead ? ' ' : ''}The site has no room for the last of what it needs.` : ' Show marks where one goes; Add builds it.';
  return lead + tail;
}

/**
 * What the status line says when proposals are built.
 * @param built - the proposals built, in order
 * @param layout - the board they were proposed on
 * @param rates - the ledger's rates
 */
export function addedSaid(built: readonly Proposal[], layout: Layout, rates: SiteRates): string {
  const first = built[0];
  if (built.length === 1 && first) return `Built: ${low(needText(first.need, layout, rates))}`;
  return `Built ${count(built.length, 'addition', 'additions')}. Undo takes them back one click at a time.`;
}

/** A stretch test's label. */
export function testLabel(id: TestId, band: number): string {
  switch (id) {
    case 'children':
      return `${num(100 * band)}% more children in the same homes`;
    case 'fewer':
      return `${num(100 * band)}% fewer people`;
    case 'more':
      return `${num(100 * band)}% more people on the same land`;
    case 'closure':
      return 'one stretch of mover line closed for repairs';
  }
}

/** The tool a click was made with, as the Board names them. */
export type ToolId = 'inspect' | 'erase' | 'hood' | 'ring' | ExtraKind | 'line' | PlantKind;

/**
 * What a move said, from the layout command's outcome.
 * @param tool - the tool the click was made with
 * @param outcome - what the command answered
 * @param rates - the ledger's rates
 */
export function moveSaid(tool: ToolId, outcome: Outcome, rates: SiteRates): string {
  if (!outcome.ok) {
    const r = outcome.rejection;
    switch (r.reason) {
      case 'OffBoard':
        return 'That is off the site.';
      case 'TileTaken':
        if (tool === 'hood') return `That tile already holds ${r.by === 'hood' ? 'a neighborhood' : 'something else'}.`;
        if (tool === 'ring') return 'A ring needs open ground.';
        return 'That tile is taken. A plant needs open ground.';
      case 'RingFull':
        return 'That ring has no room for another building.';
      case 'PlantFull':
        return 'That site is full.';
      case 'NotANeighborhood':
        return r.extra === 'fields' ? 'Playing fields go beside a neighborhood. Click one.' : 'A school goes in a neighborhood. Click one.';
      case 'SameTile':
        return 'Now click a neighboring tile to run the line to it.';
      case 'NotAdjacent':
        return 'The line runs between neighboring tiles. Starting again from here.';
      case 'NothingThere':
        return 'Nothing to remove there.';
      case 'OutsideCircle':
        return 'That ground is outside the city\'s circles. Nothing stands there until a circle is opened.';
      case 'OutsideBand':
        return 'A plant stands on the outer band of a circle, by the shore.';
      case 'InsideBand':
        return tool === 'ring' ? 'The ring stands in the middle of a circle, inside the band.' : 'Homes stand inside the band; the band is for the plants.';
      case 'CircleOverlaps':
        return `A circle there would share ${r.shared} with one that stands. Circles stand side by side along the shore.`;
    }
  }
  const e = outcome.event;
  switch (e.type) {
    case 'NeighborhoodPlaced':
      return `A neighborhood of ${num(rates.hood)} people.`;
    case 'RingStarted':
      return 'A ring begins, with one 25-story building.';
    case 'RingBuildingAdded':
      return `The ring has ${e.buildings} buildings.`;
    case 'ExtraAdded':
      return `${SITE_NAME[e.extra]} added.`;
    case 'ExtraRemoved':
      return `${SITE_NAME[e.extra]} removed.`;
    case 'PlantStarted':
      return e.plant === 'power' ? `A reactor site with one ${rates.moduleMw} MW module.` : `${SITE_NAME[e.plant]} with one unit, for ${num(rates.plantServes)} people.`;
    case 'PlantUnitAdded':
      return e.plant === 'power' ? `${e.units} modules on this site.` : `${e.units} units at this plant.`;
    case 'StretchLaid':
      return 'Mover line laid. Click the next tile to carry on.';
    case 'StretchRemoved':
      return 'That stretch of mover line is removed.';
    case 'LinesThroughTileRemoved':
      return 'The mover line through that tile is removed.';
    case 'UnitRemoved':
      return `One removed. ${e.left} left.`;
    case 'TileCleared':
      return `${SITE_NAME[e.kind]} removed.`;
    case 'CircleOpened':
      return `A circle opens at ${e.middle}: its ring in the middle, three rings of homes, and a band by the shore for its plants.`;
  }
}

/** What an order said: one sentence per job placed, canceled or piece taken down. */
export function orderSaid(events: readonly OrderEvent[]): string {
  return events
    .map((e) => {
      if (e.type === 'JobCanceled') return `Canceled: ${PIECE_NAME[e.what]}.`;
      if (e.type === 'PieceTakenDown') return `Taken down: ${PIECE_NAME[e.what]}.`;
      return `Ordered: ${PIECE_NAME[e.what]}${e.withSite ? ', with its site' : ''}. ${years(e.total)} of work, ${e.startsNow ? 'starting now.' : 'once a crew is free.'}`;
    })
    .join(' ');
}

const pc = (x: number): string => `${Math.round(100 * x)}%`;

/** A notice's text: what is happening now, or what has been announced. */
export function noticeText(n: Notice, band: number, rules: RunRules): string {
  void rules;
  const last = n.until - 1;
  switch (n.type) {
    case 'families': {
      if (n.when === 'soon') return `Year ${n.start}: a wave of young families. ${pc(band)} more children, first in the elementary schools, then moving up a grade a year.`;
      const kids = n.kids ?? { elementary: 0, middle: 0, high: 0 };
      const parts = SCHOOL_KINDS.filter((s) => kids[s] > 0.0005).map((s) => `${SITE_NAME[s].toLowerCase()}s +${pc(kids[s])}`);
      return `The wave of children: ${parts.join(', ')}. ${n.outlastsRun ? 'It outlasts the run.' : `The last of them are out of high school by year ${n.until}.`}`;
    }
    case 'squeeze':
      return n.when === 'soon'
        ? `Year ${n.start}: a housing squeeze. ${pc(band)} more people in the same homes for ${n.lasts} years.`
        : `A housing squeeze: ${pc(band)} more people in the same homes, through year ${last}.`;
    case 'slump':
      return n.when === 'soon' ? `Year ${n.start}: a slump. ${pc(band)} fewer people for ${n.lasts} years.` : `A slump: ${pc(band)} fewer people, through year ${last}.`;
    case 'closure':
      return n.when === 'soon' ? `Year ${n.start}: a stretch of mover line closes for a year of repairs.` : 'A stretch of mover line is closed this year for repairs.';
  }
}

/** "2 neighborhoods, 1 elementary school": what opened in a year. */
export function openedSentence(bag: Readonly<Partial<Record<PieceKind, number>>>): string {
  return (Object.keys(bag) as PieceKind[])
    .map((what) => {
      const n = bag[what] ?? 0;
      return `${n} ${n === 1 ? PIECE_NAME[what] : PIECE_MANY[what]}`;
    })
    .join(', ');
}

export { isSchool };

/** A tile's ground in one sentence: what the ledger fixed, as the plan laid it out. */
export function planCaption(plan: GroundPlan): string {
  if (plan.kind === 'ring') {
    const f = plan.figures;
    return `The ring: ${count(f.buildings, 'building', 'buildings')} of ${num(f.stories)} stories, ${num(f.acrossM)} m across, round a ${num(f.plazaM2 / 4046.86, 1)}-acre plaza${f.fitsFrame ? '' : ', wider than its tile'}. Below, the stop.`;
  }
  const f = plan.figures;
  return `One neighborhood: ${count(f.homes, 'townhouse', 'townhouses')} of ${num(f.stories)} stories in ${count(f.rows, 'row', 'rows')}, ${num(f.frontageM / 1000, 1)} km of frontage; the center, a ${num(f.parkM2 / 4046.86)}-acre park, ${num(f.laneM / 1000, 1)} km of bike lane. Below, ${count(f.entries, 'entry', 'entries')} of about ${num(f.homesPerEntry)} homes, ${num(f.walkwayM / 1000, 1)} km of walkway, ${num(f.pipeM / 1000, 1)} km of goods pipe, and the stop.`;
}

/** What one level holds, one line per kind of thing, for the legend. */
export function layerLines(layer: Layer, plan: GroundPlan): string[] {
  if (layer.of === 'ring') {
    if (layer.level === 'surface') return [`${count(layer.buildings.length, 'building', 'buildings')} of ${num(plan.figures.stories)} stories`, 'the plaza'];
    return [`the stop, ${count(layer.stop.berths, 'berth', 'berths')}`];
  }
  if (layer.level === 'surface') {
    const homes = layer.rows.reduce((n, r) => n + r.homes, 0);
    return [`${count(homes, 'townhouse', 'townhouses')} in ${count(layer.rows.length, 'row', 'rows')}`, 'the center', `the park, ${num(layer.park.areaM2 / 4046.86)} acres`, `bike lane, ${num(layer.lane.reduce((m, e) => m + e.m, 0) / 1000, 1)} km`];
  }
  const walkway = layer.entries.reduce((m, e) => m + (e.walkway ? e.walkway.m : 0), 0);
  const served = layer.entries.reduce((n, e) => n + e.homes, 0);
  return [
    `${count(layer.entries.length, 'entry', 'entries')}, about ${num(served / layer.entries.length)} homes each`,
    `walkway, ${num(walkway / 1000, 1)} km`,
    `goods pipe, ${num(layer.pipes.reduce((m, p) => m + p.m, 0) / 1000, 1)} km`,
    `the stop, ${count(layer.stop.berths, 'berth', 'berths')}`,
  ];
}

/** The placements the ledger did not fix, as one line. */
export function placeholderNote(plan: GroundPlan): string {
  return `Placed to draw, not fixed by the ledger: ${list(plan.placeholders.map((p) => PLACEHOLDER_TEXT[p]))}.`;
}

/** Each population premise: its name, and its value in words. One the Ledger adds unworded fails the type check. */
export const POPULATION_PREMISE: Readonly<Record<keyof PopulationPremises, { readonly name: string; readonly value: (v: number) => string }>> = {
  birthsPerThousand: { name: 'Births', value: (v) => `${num(v, 1)} a year per 1,000 people` },
  deathsPerThousand: { name: 'Deaths', value: (v) => `${num(v, 1)} a year per 1,000 people` },
  movingShare: { name: 'People who move house', value: (v) => `${num(100 * v, 1)}% a year` },
  leavingShare: { name: 'Movers who leave the city', value: (v) => `${num(100 * v)}% of them` },
  demandPerYear: { name: 'People joining the waiting list', value: (v) => `${num(v)} a year, moving in as homes stand empty` },
  childlessShare: { name: 'People in homes with no school-age children', value: (v) => `${num(100 * v)}% of people` },
};

/** "5 p.m.", "midnight", "noon": a clock hour's start. */
function clock(h: number): string {
  const at = ((h % 24) + 24) % 24;
  if (at === 0) return 'midnight';
  if (at === 12) return 'noon';
  return at < 12 ? `${at} a.m.` : `${at - 12} p.m.`;
}

/** "5 to 6 p.m.", "11 p.m. to midnight": one clock hour. */
export function hourLabel(h: number): string {
  const from = clock(h);
  const to = clock(h + 1);
  // "5 to 6 p.m." when both ends share a.m. or p.m.; the full words otherwise.
  const tail = (x: string): string => x.slice(x.indexOf(' ') + 1);
  const sameHalf = from.indexOf(' ') > 0 && to.indexOf(' ') > 0 && tail(from) === tail(to);
  return sameHalf ? `${from.slice(0, from.indexOf(' '))} to ${to}` : `${from} to ${to}`;
}

/** Hours after midnight as a time of day: 8 is "8 a.m.", 14.5 is "2:30 p.m.". */
function timeOf(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (!m) return clock(h);
  const word = clock(h);
  const at = word.indexOf(' ');
  return at > 0 ? `${word.slice(0, at)}:${String(m).padStart(2, '0')}${word.slice(at)}` : `${word} and ${m} minutes`;
}

/** Each premise of the day: its name, and its value in words. One the Ledger adds unworded fails the type check. */
export const DAY_PREMISE: Readonly<Record<keyof Omit<DayPremises, 'tripPeriods'>, { readonly name: string; readonly value: (v: number) => string }>> & {
  readonly tripPeriods: { readonly name: string; readonly value: (periods: DayPremises['tripPeriods']['value']) => string };
} = {
  tripPeriods: {
    name: 'Trips by the time they start',
    value: (periods) => periods.map((p) => `${clock(p.from)} to ${clock(p.from + p.hours)} ${num(100 * p.share, 1)}%`).join('; '),
  },
  tripPeakHour: { name: 'The busiest hour for trips', value: (v) => `${hourLabel(v)}, with the ledger's 10% of the day's trips` },
  powerPeakHour: { name: 'Power at its peak', value: (v) => hourLabel(v) },
  powerLowHour: { name: 'Power at its lowest', value: (v) => hourLabel(v) },
  powerLowShare: { name: 'The lowest hour against the peak', value: (v) => `${num(100 * v)}%` },
  schoolStart: { name: 'School starts', value: (v) => timeOf(v) },
  schoolHours: { name: 'The school day', value: (v) => `${num(v, 1)} hours` },
};

/** Each kind of day, named. */
export const DAY_NAME: Readonly<Record<DayType, string>> = { summerWeekday: 'A summer weekday' };

/** What a neighborhood held back waits for: a service the city cannot carry it with. */
const WAITS_FOR: Readonly<Record<PlantKind, string>> = { power: 'power', water: 'drinking water', sewage: 'sewage treatment', waste: 'waste handling' };

/** A school whose seats a neighborhood held to the childless share waits for. */
const SEATS_OF: Readonly<Record<SchoolKind, string>> = { elementary: 'elementary', middle: 'middle-school', high: 'high-school' };

/** What one held-back neighborhood waits for, and whether anyone lives there (ADR-0012 Decisions 3 and 5). */
function waiting(h: HeldBack): { empty: boolean; what: string } {
  if (h.short.length) return { empty: true, what: list(h.short.map((p) => WAITS_FOR[p])) };
  return { empty: false, what: `${list(h.seats.map((k) => SEATS_OF[k]))} seats` };
}

/**
 * The neighborhoods held back, in sentences grouped by what they wait for: "6 neighborhoods stand empty, waiting for
 * power." "1 neighborhood holds only households with no school-age children, waiting for high-school seats."
 * @param held - the held-back facts, in the board's tile order
 * @returns the sentences, or '' when nothing is held back
 */
export function heldBackLine(held: readonly HeldBack[]): string {
  const groups: { empty: boolean; what: string; n: number }[] = [];
  for (const h of held) {
    const w = waiting(h);
    const g = groups.find((x) => x.empty === w.empty && x.what === w.what);
    if (g) g.n++;
    else groups.push({ ...w, n: 1 });
  }
  return groups
    .map((g) =>
      g.empty
        ? `${count(g.n, 'neighborhood stands', 'neighborhoods stand')} empty, waiting for ${g.what}.`
        : `${count(g.n, 'neighborhood holds', 'neighborhoods hold')} only households with no school-age children, waiting for ${g.what}.`,
    )
    .join(' ');
}

/**
 * One neighborhood held back, for the inspector: "Nobody lives here yet. It waits for power."
 * @param h - the held-back fact for the neighborhood
 */
export function heldHere(h: HeldBack): string {
  const w = waiting(h);
  return w.empty
    ? `Nobody lives here yet. It waits for ${w.what}.`
    : `Only households with no school-age children live here. It waits for ${w.what}.`;
}

/** The waiting list in a sentence, led by a space ("2,500 people wait for a home."), or nothing when nobody waits. */
function waitSaid(waiting: number): string {
  if (!(waiting >= 0.5)) return '';
  return Math.round(waiting) === 1 ? ' 1 person waits for a home.' : ` ${fmt(waiting)} people wait for a home.`;
}

/** One month of the city's people, in a sentence: who moved, how many wait for a home, and who is held back. */
export function monthLine(row: MonthRow): string {
  const moves: string[] = [];
  if (row.arrived > 0.5) moves.push(`${fmt(row.arrived)} moved in`);
  if (row.births > 0.05) moves.push(`${fmt(row.births, 1)} born`);
  if (row.deaths > 0.05) moves.push(`${fmt(row.deaths, 1)} died`);
  if (row.left > 0.05) moves.push(`${fmt(row.left, 1)} moved away`);
  const lead = `Year ${row.year}, month ${row.month}: ${fmt(row.people)} people in homes for ${fmt(row.homes)}.`;
  if (!row.homes) return `${lead.slice(0, lead.indexOf(':'))}: no homes stand yet, so nobody lives here.${waitSaid(row.waiting)}`;
  const held = row.heldBack?.length ? ` ${heldBackLine(row.heldBack)}` : '';
  return (moves.length ? `${lead} ${cap(list(moves))}.` : `${lead} Nobody came or went.`) + waitSaid(row.waiting) + held;
}

/**
 * Where the month clock stands: "Year 3, month 4 of 12. 5,092 people living in homes for 10,000. 7,500 people wait
 * for a home." The waiting list is left unsaid while nobody is on it.
 * @param year - the year under way (the clock's completed years plus one), or the last year at the horizon
 * @param month - months completed in that year, 0 to 11
 * @param people - people living in the city
 * @param homes - homes as built, in people
 * @param waiting - people on the waiting list
 */
export function peopleNow(year: number, month: number, people: number, homes: number, waiting: number): string {
  const when = month ? `Year ${year}, month ${month} of 12.` : `The start of year ${year}.`;
  return `${when} ${fmt(people)} ${people === 1 ? 'person' : 'people'} living in homes for ${fmt(homes)}.${waitSaid(waiting)}`;
}

/** A sentence's full stop, unless it already ends on one ("6 p.m."). */
const stop = (text: string): string => (text.endsWith('.') ? text : `${text}.`);

/** The day in a sentence: its trips, their busiest hour, power and the movers. */
export function dayCaption(day: Day): string {
  if (!(day.pop > 0)) return `${DAY_NAME[day.day]}, and nobody lives here yet: no trips, no power drawn, every mover parked.`;
  const peak = day.hours[day.tripPeakHour];
  const busiest = Math.max(...day.hours.map((h) => h.moving));
  return (
    `${DAY_NAME[day.day]} for ${fmt(day.pop)} people: ${fmt(day.trips)} trips, ${fmt(peak?.trips ?? 0)} of them from ${stop(hourLabel(day.tripPeakHour))} ` +
    `Power peaks at ${fmt(day.peakMw, 1)} MW and draws ${fmt(day.energyMwh)} MWh over the day. ` +
    `At the busiest hour ${fmt(busiest)} of the ${fmt(day.fleet)} movers are moving; the rest are parked or charging.` +
    (day.pupils > 0.5 ? ` ${fmt(day.pupils)} pupils walk or ride to school and home again.` : '')
  );
}

/** One year of the record, in a sentence. */
export function yearLine(row: RecordRow): string {
  const parts = [`Year ${row.year}: ${fmt(row.pop)} people.`];
  if (row.bad) parts.push(`${row.bad}${row.bad === 1 ? ' line broken: ' : ' lines broken: '}${row.broken.map((id) => low(checkTitle(id))).join('; ')}.`);
  else parts.push(row.pop ? 'Every line held.' : 'Nobody lives here yet.');
  if (row.heldBack?.length) parts.push(heldBackLine(row.heldBack));
  if (Object.keys(row.opened).length) parts.push(`Opened: ${openedSentence(row.opened)}.`);
  return parts.join(' ');
}

/** The run's horizon reached: " The 20 years are up." */
export function yearsUp(rules: RunRules): string {
  return ` The ${rules.years} years are up.`;
}

/**
 * The clock just started, and what to press next: on the month clock, Play lets the months run; year by year, Next
 * year steps one.
 * @param rules - the run's rules (years and crews)
 * @param monthly - whether the run is on the month clock
 * @param empty - whether the site is empty (a city started from nothing) or the city on the board
 */
export function clockStarted(rules: RunRules, monthly: boolean, empty: boolean, infer = false): string {
  const next = monthly ? 'press Play to let the months run, or Next month to step one' : 'press Next year';
  const grows = infer ? ' The city orders what it needs as people arrive; Cancel on the work in hand vetoes an order.' : '';
  if (empty) return `An empty site, year 0, ${rules.crews} crews. ${infer ? 'Press Play and the city founds itself, or place' : 'Place'} your first orders, then ${next}. Undo brings the old city back.${grows}`;
  return monthly
    ? `The clock is on this city at year 0 of ${rules.years}. What you place now is an order for the ${rules.crews} crews. When your orders are in, ${next}.${grows}`
    : `The clock is running on this city: year 0 of ${rules.years}. What you place now is an order for the ${rules.crews} crews. Press Next year when your orders are in.`;
}

/** What the run ordered for (ADR-0015 Decision 2): a need, or homes for the people arriving. */
export const INFERRED_WHY: Readonly<Record<InferredWhy, string>> = {
  ring: 'a ring',
  ringBuildings: 'the ring',
  modules: 'power',
  plantUnits: 'the plants',
  schools: 'school seats',
  fields: 'the walk to the fields',
  line: 'the mover line',
  intake: 'the intake upstream of the outfall',
  homes: 'the people arriving',
};

/** So many of a piece: "a water unit", "3 stretches of line". */
function somePieces(events: readonly OrderEvent[]): string[] {
  const bag: Partial<Record<PieceKind, number>> = {};
  for (const e of events) if (e.type === 'JobOrdered') bag[e.what] = (bag[e.what] ?? 0) + 1;
  return (Object.keys(bag) as PieceKind[]).map((what) => {
    const n = bag[what] ?? 0;
    if (what === 'fields') return n === 1 ? PIECE_NAME[what] : `${n} ${PIECE_MANY[what]}`;
    return n === 1 ? `${'aeiou'.includes(PIECE_NAME[what].charAt(0)) ? 'an' : 'a'} ${PIECE_NAME[what]}` : `${n} ${PIECE_MANY[what]}`;
  });
}

/** A plant unit is ordered for its own service, not for "the plants". */
const PLANT_WHY: Readonly<Partial<Record<PieceKind, string>>> = { water: 'water', sewage: 'sewage', waste: 'waste' };

/** The reason an inferred order is said for: a plant's own service, else the need's. */
function whyOf(f: Extract<Inferred, { type: 'InferredOrder' }>): string {
  const first = f.events.find((e) => e.type === 'JobOrdered');
  return (f.why === 'plantUnits' && first && PLANT_WHY[first.what]) || INFERRED_WHY[f.why];
}

/**
 * What the run ordered for itself after a month's people moved, in a sentence: "The city ordered a neighborhood for the
 * people arriving, and a water unit and 3 stretches of line for the mover line." A need the site has no room for is
 * said after it. Empty when nothing was ordered.
 * @param facts - the month's inferred facts
 */
export function inferredLine(facts: readonly Inferred[]): string {
  const ordered = facts.filter((f): f is Extract<Inferred, { type: 'InferredOrder' }> => f.type === 'InferredOrder');
  const noRoom = facts.filter((f): f is Extract<Inferred, { type: 'NoRoom' }> => f.type === 'NoRoom');
  const parts: string[] = [];
  // Orders for the same reason are said together: "an elementary school and a middle school for school seats".
  const groups: { why: string; pieces: string[] }[] = [];
  for (const f of ordered) {
    const why = whyOf(f);
    const g = groups.find((x) => x.why === why);
    if (g) g.pieces.push(...somePieces(f.events));
    else groups.push({ why, pieces: somePieces(f.events) });
  }
  if (groups.length) parts.push(`The city ordered ${list(groups.map((g) => `${list(g.pieces)} for ${g.why}`))}.`);
  for (const f of facts) if (f.type === 'CircleOpened') parts.push(`The city is full to its walk, so a new circle opens at ${f.middle} for the people arriving.`);
  if (noRoom.length) parts.push(`The site has no room for ${list(noRoom.map((f) => INFERRED_WHY[f.why]))}.`);
  return parts.join(' ');
}

/** The run's orders in a month as a table cell: "neighborhood, water unit, 3 stretches of line", or "no room". */
export function inferredCell(facts: readonly Inferred[]): string {
  const pieces = facts.flatMap((f) => (f.type === 'InferredOrder' ? somePieces(f.events) : f.type === 'CircleOpened' ? [`a circle at ${f.middle}`] : []));
  const noRoom = facts.some((f) => f.type === 'NoRoom');
  const said = pieces.map((p) => (p.startsWith('a ') ? p.slice(2) : p.startsWith('an ') ? p.slice(3) : p)).join(', ');
  return noRoom ? (said ? `${said}; no room` : 'no room') : said;
}

/** A job the run ordered, marked as such in the work in hand. */
export const ORDERED_BY_CITY = 'ordered by the city';

/** Said when the player cancels a job the run ordered: a veto (ADR-0015 Decision 5). */
export function vetoSaid(what: PieceKind): string {
  return `Vetoed: ${PIECE_NAME[what]}. The city will not order it there again; order it yourself to lift the veto.`;
}

/** Where open ground lies (ADR-0016): inside a circle's band, on it, or outside every circle. */
export type GroundKind = 'inside' | 'band' | 'outside';

/** What open ground is for, by where it lies. */
export const GROUND_TEXT: Readonly<Record<GroundKind, string>> = {
  inside: 'Open ground inside the band, for homes and the ring.',
  band: 'Open ground on the band, where the plants stand.',
  outside: "Ground outside the city's circles. Nothing stands here until a circle is opened.",
};

const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth'] as const;

/**
 * A circle's name on the map, by its place in the layout's list: "First circle", "Second circle".
 * @param index - 0 for the first circle
 */
export function circleName(index: number): string {
  const ordinal = ORDINAL[index];
  return ordinal ? `${ordinal} circle` : `Circle ${index + 1}`;
}

/** Said when the player closes a circle the city opened (ADR-0016 Decision 3, the veto of ADR-0015 Decision 5). */
export function circleClosedSaid(middle: TileKey): string {
  return `Closed: the circle at ${middle}. The city will not open it again; open it yourself to lift the veto.`;
}

/** The inspector's button on an empty circle the city opened. */
export const CIRCLE_CLOSE = 'Close this circle';

/** The inspector's button on the middle of a circle the player closed. */
export const CIRCLE_REOPEN = 'Open the circle again';

/** The lake along the south edge of the site, off the board (ADR-0016 Decision 5). */
export const LAKE_LABEL = 'Lake';

/**
 * The way the current runs along the shore, for the map's lake (line 32).
 * @param current - +1 when it runs east, -1 when west
 */
export function currentLabel(current: 1 | -1): string {
  return current > 0 ? 'current runs east →' : '← current runs west';
}

/** Said when an order placed while the months were running pauses them. */
export const PAUSED_FOR_ORDER = 'Paused: your order is in. Press Play to carry on.';

/** The three speeds the months can run at, named. */
export const SPEED_NAME: Readonly<Record<Speed, string>> = { slow: 'Slow', steady: 'Steady', fast: 'Fast' };

/** The button that opens the site from the air, and its pressed state. */
export const ANGLED_LABEL = 'From the air';

/** The button that opens the city IRL. */
export const IRL_LABEL = 'IRL';

/** Said when the city IRL opens. */
export const IRL_OPENED = 'The city IRL. Drag to turn, scroll or the buttons to come nearer, shift-drag to slide. Back to the map returns.';

/** Said, and shown in the view bar, when the browser cannot draw the city IRL. */
export const NO_WEBGL = 'This browser cannot draw the city IRL: it has no WebGL. The site from the air still can.';

/**
 * The view bar's caption on the IRL view: what stands, in blocks and stories; what the crews are building; and how
 * lit the homes are when not every home is lived in.
 * @param blocks - blocks built, scaffolds and strips included
 * @param stories - their stories in all
 * @param sites - tiles under construction
 * @param lit - the homes' lit share, 0 to 1
 */
export function irlCaption(blocks: number, stories: number, sites = 0, lit = 1): string {
  if (!blocks) return 'The city IRL. Nothing stands yet.';
  const parts = [`The city IRL: ${count(blocks, 'block', 'blocks')}, ${fmt(stories)} stories in all.`];
  if (sites) parts.push(`${count(sites, 'tile', 'tiles')} under construction.`);
  if (lit < 0.995) parts.push(`${num(100 * lit)}% of the homes are lit.`);
  return parts.join(' ');
}

/** The three tilts of the view from the air, named. */
export const TILT_NAME: Readonly<Record<Tilt, string>> = { low: 'low', mid: 'mid', high: 'high' };

/**
 * The view bar's caption on the angled view: what stands, in blocks and stories; what the crews are building; and
 * how lit the homes are when not every home is lived in.
 * @param blocks - blocks painted, scaffolds and strips included
 * @param stories - their stories in all
 * @param sites - tiles under construction
 * @param lit - the homes' lit share, 0 to 1
 */
export function angledCaption(blocks: number, stories: number, sites = 0, lit = 1): string {
  if (!blocks) return 'The site from the air. Nothing stands yet.';
  const parts = [`The site from the air: ${count(blocks, 'block', 'blocks')}, ${fmt(stories)} stories in all.`];
  if (sites) parts.push(`${count(sites, 'tile', 'tiles')} under construction.`);
  if (lit < 0.995) parts.push(`${num(100 * lit)}% of the homes are lit.`);
  return parts.join(' ');
}
