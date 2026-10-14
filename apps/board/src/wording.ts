/**
 * @file Every sentence the page shows, worded from the domain's typed facts and events (ADR-0004). Nothing else in the
 * Board builds a sentence from rule state. The sketch's sentences are the oracle; test/wording.test.ts holds them to it.
 * Public interface: SITE_NAME, PIECE_NAME, PIECE_MANY, STATUS, LEVEL_NAME, PLACEHOLDER_TEXT, linesLabel, checkTitle,
 * checkDetail, issueText, testLabel, moveSaid, orderSaid, noticeText, openedSentence, planCaption, layerLines,
 * placeholderNote.
 * Owner context: Board (adapter).
 */
import type { GroundPlan, Layer, Level, Placeholder } from '@city/ground';
import type { ExtraKind, Facts, LineCheck, Outcome, PlantKind, SchoolKind, SiteRates, TestId, Tile, TileIssue } from '@city/site';
import type { Notice, OrderEvent, PieceKind, RunRules } from '@city/run';
import { cap, count, list, num, years } from './format.ts';

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
  }
}

/** A check's detail sentence, from its facts. */
export function checkDetail(facts: Facts, rates: SiteRates): string {
  switch (facts.check) {
    case 'daily':
      if (facts.case === 'idle') return `Place a neighborhood to begin. Each is ${num(facts.hood)} people with its own bakery, butcher, cafés, library, doctor and park.`;
      if (facts.case === 'short') {
        const text = list(facts.short.map((id) => DAILY[id] ?? id));
        return `With ${num(facts.pop1)} people in a neighborhood, ${text}${facts.short.length > 1 ? ' run' : ' runs'} short of customers.`;
      }
      return `Each neighborhood has ${num(facts.pop1)} people. Its hungriest need, the doctor's office, wants ${num(facts.hungriest)}.`;
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
      if (facts.case === 'none') return 'There is no ring yet. Offices, government, the auditorium and fine dining have nowhere to go.';
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
      if (facts.case === 'without') return `${count(facts.count, 'neighborhood has', 'neighborhoods have')} no stop on a line to the ring. Draw the mover line through ${facts.count === 1 ? 'it' : 'them'}.`;
      return 'Every neighborhood has a stop under its center, on a line to the ring.';
    case 'elementary':
    case 'middle':
    case 'high': {
      const noun = SITE_NAME[facts.check].toLowerCase();
      if (facts.case === 'idle') return `A school of this kind holds at most ${num(facts.cap)} pupils.`;
      if (facts.case === 'none') return `There is no ${noun} yet. ${num(facts.pupils)} pupils have nowhere to go.`;
      if (facts.case === 'unseated') return `${num(facts.missing)} pupils in ${count(facts.hoods, 'neighborhood', 'neighborhoods')} have no seat within a 30-minute walk. A school holds at most ${num(facts.cap)}.`;
      return `${count(facts.schools, 'school', 'schools')} for ${num(facts.pupils)} pupils. The fullest has ${num(facts.fullest)} of ${num(facts.cap)} seats, and the longest walk is ${num(facts.longestMin)} minutes.`;
    }
    case 'fields':
      if (facts.case === 'idle') return 'Fields sit beside a neighborhood and serve the ones around it.';
      if (facts.case === 'none') return 'There are no playing fields yet.';
      if (facts.case === 'far') return `${count(facts.count, 'neighborhood is', 'neighborhoods are')} more than a ${facts.fieldWalk}-minute walk from fields and cannot ride to them.`;
      return `${count(facts.sets, 'set', 'sets')} of fields. Every neighborhood is within a ${facts.fieldWalk}-minute walk or a mover ride of one.`;
    case 'ways':
      if (facts.case === 'idle') return 'Past a 15-minute walk people take a mover, or a bike if it is near enough.';
      if (facts.case === 'stuck') return `${num(100 * facts.share, 1)}% of trips are longer than people will walk and have no mover to take. Run the mover line to the tiles marked.`;
      return `${num(100 * facts.foot)}% of trips are on foot, ${num(100 * facts.bike)}% by bike and ${num(100 * facts.ride)}% by mover.${facts.nowhere > 0.0005 ? ` Another ${num(100 * facts.nowhere, 1)}% have no place to go to.` : ''}`;
    case 'power':
      if (facts.case === 'idle') return `A module makes ${facts.moduleMw} MW. The city needs enough to carry its peak while one is down for fuel.`;
      if (facts.case === 'short') return `${facts.modules ? `${count(facts.modules, 'module', 'modules')} cannot` : 'With no modules the city cannot'} carry a peak of ${num(facts.peakMw)} MW with one down for fuel. It takes ${facts.needed}.`;
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
  }
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
