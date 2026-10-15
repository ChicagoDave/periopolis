/**
 * @file What the city costs, in six layers: groundworks, buildings and fleet to build; upkeep, civic services and
 * households to run; with Land and Financing as their own lines (ADR-0007, lines 24 to 28). Every premise carries a
 * mark: Yours, Sourced (with its source and year) or Mine. Nothing here is tuned; a Sourced figure is still a
 * placeholder until David accepts it, and an accepted one keeps its source and says so (Decision 9 as amended).
 * Public interface: Layer, LAYERS, Kind, kindOf, Mark, Marked, CostPremises, CostPremiseId, COSTS, CostId, Counted,
 * CostRow, LandLine, FinancingLine, CostFigures, priceCounts, levelPayment, tallyCost, waterGpd, carCost, walkingCost.
 * Owner context: Ledger (domain).
 *
 * Money is in dollars of the source's year, not escalated. A row is one premise times one ledger count, and both
 * columns are priced by the same function, so a difference between the columns is a difference in what they build
 * and run, never in the arithmetic. The Ledger is the only place a unit cost lives, and the only place the pricing
 * arithmetic lives: the Site and the Run price what stands from these premises and their own counts through
 * priceCounts and tallyCost (Decision 6).
 */
import type { CarCityLedger, WalkingCityLedger } from './consequences.ts';
import type { CarCityPremises, SharedPremises, WalkingCityPremises } from './premises.ts';

/** The six layers of line 25. The first three are built once; the last three are paid every year. */
export type Layer = 'groundworks' | 'buildings' | 'fleet' | 'upkeep' | 'civic' | 'households';

/** The layers in the order they are built and paid. */
export const LAYERS: readonly Layer[] = ['groundworks', 'buildings', 'fleet', 'upkeep', 'civic', 'households'];

/** Capital is paid once; running cost is paid each year. */
export type Kind = 'capital' | 'running';

/**
 * Which kind of money a layer is.
 * @param layer - one of the six
 * @returns capital for the three built layers, running for the three yearly ones
 */
export function kindOf(layer: Layer): Kind {
  return layer === 'groundworks' || layer === 'buildings' || layer === 'fleet' ? 'capital' : 'running';
}

/**
 * Whose figure a premise is (line 26). A Sourced mark names its source and year, and whether David has accepted it:
 * an accepted Sourced figure is his and still cites its source. A Mine figure he accepts becomes Yours, so only a
 * Sourced mark carries the flag. The Board words the mark.
 */
export type Mark =
  | { readonly kind: 'yours' }
  | { readonly kind: 'mine' }
  | { readonly kind: 'sourced'; readonly source: string; readonly year: number; readonly url: string; readonly accepted: boolean };

/** A premise with its mark. */
export interface Marked {
  readonly value: number;
  readonly mark: Mark;
}

const YOURS: Mark = { kind: 'yours' };
/** A Sourced mark, not yet accepted. Shared with the package's other premises (population.ts); not re-exported. */
export function sourced(source: string, year: number, url: string): Mark {
  return { kind: 'sourced', source, year, url, accepted: false };
}
/** David accepted this Sourced figure. Accepting a Mine figure makes it Yours instead, so anything else is refused. */
export function accept(mark: Mark): Mark {
  if (mark.kind !== 'sourced') throw new Error(`only a sourced mark is accepted, not ${mark.kind}; an accepted Mine figure is Yours`);
  return { ...mark, accepted: true };
}

/**
 * The premises money is built from: unit costs, and the per-person counts the civic layer needs that the nine steps
 * do not give. To build: per m², per km or per piece. To run: per year, per km, per unit.
 */
export interface CostPremises {
  // Buildings
  /** Floor in a house, a townhouse, a shop, a school or the sub level, per m² built. */
  readonly lowRiseM2: Marked;
  /** Floor in a ring building, per m² built. */
  readonly highRiseM2: Marked;
  /** One dumbwaiter. */
  readonly dumbwaiterEach: Marked;
  // Groundworks
  /** Streets, paths and plazas, per m² of ground given to movement. */
  readonly streetM2: Marked;
  /** Ground where vehicles wait, surface parking or a depot, per m². */
  readonly waitingM2: Marked;
  /** Parks, per m². */
  readonly parkM2: Marked;
  /** Width of the sub-level walkway, m. It is built floor, priced at lowRiseM2. */
  readonly walkwayWidthM: Marked;
  /** Width of the mover line's floor, m. Built floor, priced at lowRiseM2. */
  readonly moverLineWidthM: Marked;
  /** The mover line's track and systems on that floor, per km, civil works aside. */
  readonly moverTrackKm: Marked;
  /** One mover stop with its berths. */
  readonly stationEach: Marked;
  /** One sub-level entry: stairs and a lift in the built floor. */
  readonly entryEach: Marked;
  /** Goods pipe as a duct in the sub level, per km. */
  readonly pipeKm: Marked;
  /** Bike lane, per km. */
  readonly laneKm: Marked;
  /** Reactor module, each. Not a ledger count; the Site prices the modules that stand. */
  readonly reactorModuleEach: Marked;
  /** Water, sewage or waste plant unit, each. Not a ledger count; the Site prices the units that stand. */
  readonly plantUnitEach: Marked;
  // Fleet
  /** One car. */
  readonly carEach: Marked;
  /** One mover, of whatever size. */
  readonly moverEach: Marked;
  // Upkeep
  /** Upkeep a year, as a share of the groundworks and buildings. */
  readonly upkeepShare: Marked;
  // Civic services: unit costs
  /** One pupil for a year of school. */
  readonly pupilYear: Marked;
  readonly policePerson: Marked;
  readonly firePerson: Marked;
  readonly healthPerson: Marked;
  readonly libraryPerson: Marked;
  /** Public welfare, Medicaid among it: the city carries the state's share (line 27). */
  readonly welfarePerson: Marked;
  readonly higherEducationPerson: Marked;
  /** Financial administration and central staff. */
  readonly administrationPerson: Marked;
  readonly correctionsPerson: Marked;
  readonly courtsPerson: Marked;
  /** Running the streets a year, per m² of street: snow, signals, traffic control, safety. Building them is groundworks. */
  readonly streetRunM2: Marked;
  /** Running the parks a year, per m² of park: staff, grounds and programs. Building them is groundworks. */
  readonly parkRunM2: Marked;
  /** Electricity bought from the grid, per kWh. The car city. */
  readonly gridKwh: Marked;
  /** Electricity made at the city's own reactors, per MWh: operations and fuel. Your city. */
  readonly reactorMwh: Marked;
  /** Drinking water, per 1,000 gallons. */
  readonly waterKgal: Marked;
  /** Sewage treated, per 1,000 gallons. */
  readonly sewerKgal: Marked;
  /** Waste collected and disposed of, per ton. */
  readonly wasteTon: Marked;
  /** One goods run by van or truck. */
  readonly goodsRun: Marked;
  /** One porter for a year. */
  readonly porterYear: Marked;
  // Civic services: counts the nine steps do not give (lines 20 to 22)
  /** Electricity a person uses in a year, kWh. */
  readonly kwhPerPersonYear: Marked;
  /** Water a person uses in a day before any green ground is watered, gallons: indoors, commerce, institutions, leaks. */
  readonly waterBaseGpd: Marked;
  /** Water given to green ground (yards and parks) in a year, mm: liters on each square meter. */
  readonly wateringMm: Marked;
  /** Sewage a person makes in a day, gallons. */
  readonly sewageGpd: Marked;
  /** Waste a person makes in a year, tons. */
  readonly wasteTonsPerPersonYear: Marked;
  /** School years, kindergarten to twelfth grade. */
  readonly grades: Marked;
  // Households
  /** Running a car one km: fuel and maintenance; not insurance, depreciation or finance. */
  readonly carKm: Marked;
  /**
   * Insuring one car for a year, the car city only. Priced per car, not per km, because the ledger's cars drive far
   * less than AAA's 15,000 miles. Your city has no row: the city indemnifies its citizens (line 29).
   */
  readonly carInsuranceYear: Marked;
  /** Running a mover one km, depreciation aside. */
  readonly moverKm: Marked;
  /** Years a vehicle lasts before it is replaced. */
  readonly vehicleLifeYears: Marked;
  // Land and financing
  /** Urban land, per m². */
  readonly landM2: Marked;
  /** Interest on the capital, a year. */
  readonly financeRate: Marked;
  /** Years the capital is paid off over. */
  readonly financeYears: Marked;
}

/** Which premise a row is priced at. */
export type CostPremiseId = keyof CostPremises;

/**
 * The premises as found on 2026-10-13 and 2026-10-14 (`docs/brainstorm/future-city/money.md`, "Sources for the unit
 * costs" and "Sources found 2026-10-14"). Every premise accepted 2026-10-14
 * (`docs/work/archive/accept-money-premises/plan.md`).
 */
export const COSTS: CostPremises = {
  lowRiseM2: {
    value: 1750,
    mark: accept(
      sourced(
        'NAHB construction cost survey, 428,215 dollars for 2,647 ft2',
        2024,
        'https://eyeonhousing.org/2024/09/economies-of-scale-in-single-family-home-construction/',
      ),
    ),
  },
  highRiseM2: {
    value: 3200,
    mark: accept(sourced('RSMeans, office 11 to 20 stories, 202 to 395 a ft2', 2025, 'https://www.rsmeans.com/resources/cost-to-build-an-office')),
  },
  dumbwaiterEach: {
    value: 10000,
    mark: accept(
      sourced('Fixr, residential dumbwaiter 8,000 to 12,000 installed, national average 10,000', 2025, 'https://www.fixr.com/costs/dumbwaiter-installation'),
    ),
  },
  streetM2: {
    value: 300,
    mark: accept(sourced('FDOT cost per mile, new two-lane urban arterial about 9.1 M a mile', 2024, 'https://www.fdot.gov/fpo/fpc/reports/costpermile')),
  },
  waitingM2: {
    value: 250,
    mark: accept(
      sourced(
        'Between pavement alone, 2 to 4.50 a ft2 (HomeAdvisor 2025), and a finished surface lot at 18,947 a space (UCF E-1, January 2026)',
        2026,
        'https://fp.ucf.edu/wp-content/uploads/projects/costs/2026/24134001%20Creation%20of%20E-1%20Surface%20Parking%20Lot.pdf',
      ),
    ),
  },
  parkM2: {
    value: 50,
    mark: accept(
      sourced('Neighborhood park about 180,000 an acre with basic amenities', 2026, 'https://LittleRock.gov/!userfiles/editor/docs/parks/appendixe.pdf'),
    ),
  },
  walkwayWidthM: {
    value: 3,
    mark: accept(
      sourced(
        'NACTO Urban Street Design Guide, pedestrian through zone 8 to 12 ft downtown',
        2013,
        'https://nacto.org/publication/urban-street-design-guide/street-design-elements/sidewalks/sidewalk-zones/',
      ),
    ),
  },
  moverLineWidthM: { value: 6, mark: YOURS },
  moverTrackKm: {
    value: 12e6,
    mark: accept(
      sourced(
        'Airport people movers 24 to 75 M a mile with civil works 50 to 70% of it (Kerr 2005); Heathrow ULTra 30 M pounds for 3.8 km (2011)',
        2005,
        'https://rosap.ntl.bts.gov/view/dot/17794/dot_17794_DS1.pdf',
      ),
    ),
  },
  stationEach: {
    value: 3e6,
    mark: accept(
      sourced(
        'ULTra city study, a PRT station 0.48 M pounds; Miami Metromover about 18 M a station with its guideway',
        2005,
        'https://en.wikipedia.org/wiki/Ultra_(personal_rapid_transit)',
      ),
    ),
  },
  entryEach: {
    value: 300000,
    mark: accept(
      sourced(
        'A new two-stop commercial elevator 120,000 to 290,000 installed, from cost guides; stairs on top',
        2026,
        'https://new.risingsunartscentre.org/news/commercial-elevator-cost-for-two-story-building-2026.html',
      ),
    ),
  },
  pipeKm: {
    value: 1e6,
    mark: accept(
      sourced(
        'Analog: Envac vacuum waste network at Konza, 8 M euros for 15 km with inlets and station; a goods pipe at twice that',
        2023,
        'https://capitalfm.africa/envac-deploys-8mn-smart-waste-system-at-konza/',
      ),
    ),
  },
  laneKm: {
    value: 300000,
    mark: accept(sourced('Protected bike lanes 133,000 to 537,000 a mile', 2024, 'https://earth911.com/business-policy/are-bike-lanes-worth-the-cost/')),
  },
  reactorModuleEach: {
    value: 1e9,
    mark: accept(
      sourced(
        'Between NuScale 2020 at 2,850 a kW (220 M a module) and UAMPS 2023 at about 20,000 a kW (1.5 B)',
        2023,
        'https://world-nuclear-news.org/articles/nuscale-announces-smr-power-uprate',
      ),
    ),
  },
  plantUnitEach: {
    value: 50e6,
    mark: accept(
      sourced(
        'Secondary wastewater 5 to 7 M a MGD; one unit of 60,000 people is about 7 MGD',
        2025,
        'https://www.waterandwastewater.com/how-much-does-a-wastewater-treatment-plant-cost/',
      ),
    ),
  },
  carEach: {
    value: 48000,
    mark: accept(
      sourced('AAA Your Driving Costs, depreciation 4,334 a year over five years', 2025, 'https://mwg.aaa.com/news/press-release/september-16-2025'),
    ),
  },
  moverEach: {
    value: 30000,
    mark: accept(
      sourced(
        'Between a street-legal 4-seat lithium cart at 14,999 (Club Car) and a guided pod at the price of a family car (ULTra); a cart body on a guideway, not a robotaxi',
        2025,
        'https://clubcar.com/en-us/personal/street-legal-vehicles',
      ),
    ),
  },
  upkeepShare: {
    value: 0.02,
    mark: accept(sourced('National Academies, 2 to 4% of replacement value a year', 1998, 'https://nap.nationalacademies.org/read/9807/chapter/4')),
  },
  pupilYear: {
    value: 16526,
    mark: accept(sourced(
      'Census Bureau, Annual Survey of School System Finances, FY2023 current spending a pupil',
      2023,
      'https://www.census.gov/newsroom/press-releases/2025/2023-annual-survey-of-school-system-finances.html',
    )),
  },
  policePerson: {
    value: 450,
    mark: accept(sourced(
      'Urban Institute, state and local direct spending 11,087 a person, police about 4%',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/state-and-local-expenditures',
    )),
  },
  firePerson: {
    value: 220,
    mark: accept(sourced(
      'Urban Institute, fire protection about 2% of 11,087 a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/state-and-local-expenditures',
    )),
  },
  healthPerson: {
    value: 1100,
    mark: accept(sourced(
      'Urban Institute, health and hospitals about 10% of 11,087 a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/state-and-local-expenditures',
    )),
  },
  libraryPerson: {
    value: 45,
    mark: accept(sourced(
      'Urban Institute, libraries under 1% of 11,087 a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/state-and-local-expenditures',
    )),
  },
  welfarePerson: {
    value: 2597,
    mark: accept(sourced(
      'Urban Institute, state and local public welfare 2,597 a person; 81% medical vendor payments, mostly Medicaid',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/public-welfare-expenditures',
    )),
  },
  higherEducationPerson: {
    value: 938,
    mark: accept(sourced(
      'Urban Institute, state and local higher education 938 a person, gross of tuition and charges',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/higher-education-expenditures',
    )),
  },
  administrationPerson: {
    value: 443,
    mark: accept(sourced(
      'Urban Institute, financial administration and central staff about 4% of 11,087 a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/state-and-local-expenditures',
    )),
  },
  correctionsPerson: {
    value: 262,
    mark: accept(sourced(
      'Urban Institute, state and local corrections 262 a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/criminal-justice-police-corrections-courts-expenditures',
    )),
  },
  courtsPerson: {
    value: 158,
    mark: accept(sourced(
      'Urban Institute, state and local courts 158 a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/criminal-justice-police-corrections-courts-expenditures',
    )),
  },
  streetRunM2: {
    value: 2.41,
    mark: accept(sourced(
      'Urban Institute, highways and roads 622 a person, 44% operations (274), over the car city’s 113.8 m² of street a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/highway-and-road-expenditures',
    )),
  },
  parkRunM2: {
    value: 2.58,
    mark: accept(sourced(
      'Urban Institute, parks and recreation about 1% of 11,087 a person (111), over the car city’s 42.9 m² of park a person',
      2021,
      'https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/state-and-local-backgrounders/state-and-local-expenditures',
    )),
  },
  gridKwh: {
    value: 0.17,
    mark: accept(sourced('US residential average 17.2 to 17.8 cents a kWh', 2025, 'https://www.energysage.com/local-data/electricity-cost/')),
  },
  reactorMwh: {
    value: 32,
    mark: accept(sourced(
      'NEI Nuclear Costs in Context, total generating cost 31.76 a MWh in 2023',
      2023,
      'https://www.nei.org/getContentAsset/47fa8caa-9b0d-4029-932c-07f902e82f4f/8d8ff8d6-b2ae-401b-a63c-f6b108e809d2/2024-Costs-in-Context-final.pdf',
    )),
  },
  waterKgal: {
    value: 6,
    mark: accept(
      sourced(
        'AWWA and Raftelis rate survey: average residential water bill 45.09 a month at 7,500 gallons, about 6.00 a thousand gallons',
        2022,
        'https://www.awwa.org/AWWA-Articles/awwa-launches-online-platform-for-waterwastewater-rate-information',
      ),
    ),
  },
  sewerKgal: {
    value: 9,
    mark: accept(
      sourced(
        'Bluefield Research: sewer about 59% of the combined bill, 19.33 a month more than water; against the AWWA bill about 8.60 a thousand gallons',
        2024,
        'https://www.bluefieldresearch.com/ns/u-s-water-and-sewer-bill-has-increased-24-in-five-years-raising-affordability-concerns/',
      ),
    ),
  },
  wasteTon: {
    value: 160,
    mark: accept(sourced('Landfill tipping 62.28 a ton in 2024, collection about 100 more', 2024, 'https://css.umich.edu/sites/default/files/2025-09/CSS04-15.pdf')),
  },
  goodsRun: { value: 300, mark: YOURS },
  porterYear: {
    value: 54000,
    mark: accept(
      sourced(
        'BLS: hand laborers and material movers, median 37,680 a year (May 2024); wages are 70.1% of compensation (ECEC, December 2025)',
        2024,
        'https://www.bls.gov/ooh/transportation-and-material-moving/hand-laborers-and-material-movers.htm',
      ),
    ),
  },
  kwhPerPersonYear: {
    value: 8600,
    mark: accept(
      sourced(
        'EIA retail sales 2024: residential 1,483 and commercial 1,451 billion kWh, over a population past 340 million',
        2024,
        'https://www.eia.gov/electricity/annual/html/epa_02_05.html',
      ),
    ),
  },
  waterBaseGpd: {
    value: 113,
    mark: accept(
      sourced(
        'USGS 2015: public supply 39,000 Mgal a day for 283 million people, 138 a person; less EPA WaterSense outdoor use, 30% of 82 gallons domestic',
        2015,
        'https://www.usgs.gov/mission-areas/water-resources/science/public-supply-water-use',
      ),
    ),
  },
  wateringMm: {
    value: 150,
    mark: accept(
      sourced(
        'EPA WaterSense: outdoor use about 30% of household water, about 25 gallons a person a day, over the car city’s 228.5 m² of yards and parks a person',
        2021,
        'https://19january2021snapshot.epa.gov/watersense/outdoors_.html',
      ),
    ),
  },
  sewageGpd: {
    value: 100,
    mark: accept(
      sourced(
        'Design standard: 100 gallons a person a day of residential and commercial flow (Iowa DNR, Ten States Standards)',
        2021,
        'https://iowadnr.gov/media/5656/download',
      ),
    ),
  },
  wasteTonsPerPersonYear: {
    value: 0.89,
    mark: accept(
      sourced(
        'EPA Facts and Figures: 292.4 million tons of municipal solid waste in 2018, 4.9 pounds a person a day',
        2018,
        'https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling/national-overview-facts-and-figures-materials',
      ),
    ),
  },
  grades: { value: 13, mark: YOURS },
  carKm: {
    value: 0.14,
    mark: accept(
      sourced(
        'AAA Your Driving Costs: fuel 13 cents a mile and maintenance about 10 cents a mile',
        2025,
        'https://newsroom.aaa.com/wp-content/uploads/2025/09/UPDATE-AAA-Fact-Sheet-Your-Driving-Cost-9.2025-1.pdf',
      ),
    ),
  },
  carInsuranceYear: {
    value: 1694,
    mark: accept(
      sourced(
        'AAA Your Driving Costs: full-coverage insurance 1,694 a year',
        2025,
        'https://newsroom.aaa.com/wp-content/uploads/2025/09/UPDATE-AAA-Fact-Sheet-Your-Driving-Cost-9.2025-1.pdf',
      ),
    ),
  },
  moverKm: {
    value: 0.1,
    mark: accept(
      sourced(
        'Derived for a cart-class pod on a guideway: energy 0.08 to 0.16 kWh a km (Club Car Onward), maintenance under a car, battery wear, cleaning and control; 0.05 to 0.20 a km',
        2025,
        'https://www.clubcar.com/en/personal/street-legal-vehicles/onward-4-passenger/specifications',
      ),
    ),
  },
  vehicleLifeYears: {
    value: 17,
    mark: accept(
      sourced(
        'Greene and Leard, median expected life of a US passenger car about 17 years (2002 to 2020); a mover on a guideway at the same',
        2024,
        'https://ideas.repec.org/a/eee/transa/v180y2024ics0965856424000302.html',
      ),
    ),
  },
  landM2: {
    value: 126,
    mark: accept(sourced(
      'Albouy, Ehrlich and Shin, average US urban land 511,000 an acre',
      2010,
      'https://www.6sqft.com/study-shows-huge-disparity-in-u-s-urban-land-value-with-nyc-making-up-10/',
    )),
  },
  financeRate: {
    value: 0.043,
    mark: accept(sourced(
      '30-year AAA municipal yield 4.2 to 4.5% through 2025',
      2025,
      'https://www.parametricportfolio.com/-/media/files/insights-and-research/municipal-bond-market-insight/positioned-for-performance_july-2025.pdf',
    )),
  },
  financeYears: {
    value: 30,
    mark: accept(
      sourced(
        'Statutory maxima 20 to 40 years by what is built: Ohio allows 40 for water and sewer works, 30 for recreation and land',
        2025,
        'https://codes.ohio.gov/ohio-revised-code/section-133.20',
      ),
    ),
  },
};

/**
 * The rows. A column carries only the rows it has something of; the two plant rows are the Site's alone, since
 * plants are not ledger counts (Decision 6).
 */
export type CostId =
  // groundworks
  | 'streets'
  | 'waiting'
  | 'parks'
  | 'walkwayFloor'
  | 'moverLineFloor'
  | 'moverTrack'
  | 'stations'
  | 'entries'
  | 'pipe'
  | 'lanes'
  | 'reactorModules'
  | 'plantUnits'
  // buildings
  | 'lowRiseFloor'
  | 'highRiseFloor'
  | 'dumbwaiters'
  // fleet
  | 'vehicles'
  // upkeep
  | 'upkeep'
  // civic
  | 'schools'
  | 'police'
  | 'fire'
  | 'health'
  | 'library'
  | 'welfare'
  | 'higherEducation'
  | 'administration'
  | 'corrections'
  | 'courts'
  | 'streetRunning'
  | 'parkRunning'
  | 'electricity'
  | 'water'
  | 'sewer'
  | 'waste'
  | 'goodsRuns'
  | 'porters'
  // households
  | 'vehicleKm'
  | 'vehiclesRenewed'
  | 'insurance';

/** One row of cost: so many of something, priced at one premise, is this much. */
export interface CostRow {
  readonly id: CostId;
  readonly layer: Layer;
  /** How many: m², km, pieces, pupils, kWh, vehicle-km a year, or dollars of structures for the upkeep row. */
  readonly count: number;
  /** The premise the count is priced at; its mark is on the premise. */
  readonly premise: CostPremiseId;
  /** The premise's value. */
  readonly unit: number;
  /** count times unit. */
  readonly cost: number;
}

/** The Land line: the city's ground at the land price. Outside the six layers. */
export interface LandLine {
  readonly areaM2: number;
  readonly unit: number;
  readonly cost: number;
}

/** The Financing line: the structures' capital paid off level over the term at the rate. Outside the six layers. */
export interface FinancingLine {
  /** What is financed: groundworks and buildings. The fleet is renewed, not financed. */
  readonly capital: number;
  readonly rate: number;
  readonly years: number;
  /** The level payment a year. */
  readonly yearly: number;
}

/** A column's money: the rows in their layers, the layer totals, the two kinds, and the two lines outside them. */
export interface CostFigures {
  readonly rows: readonly CostRow[];
  readonly layers: Readonly<Record<Layer, number>>;
  readonly capitalTotal: number;
  readonly capitalPerPerson: number;
  readonly runningTotal: number;
  readonly runningPerPerson: number;
  readonly land: LandLine;
  readonly financing: FinancingLine;
}

/** A count waiting to be priced: so many of something, in a layer, at a premise. */
export interface Counted {
  readonly id: CostId;
  readonly layer: Layer;
  readonly count: number;
  readonly premise: CostPremiseId;
}

const DAYS = 365;
const LITERS_A_GALLON = 3.785411784;

/**
 * Water a person uses in a day: the base, and the watering of green ground, which is where a city of lawns differs
 * from a city of townhouses. A millimeter of water on a square meter is a liter. Both columns and the Site use it.
 * @param greenM2 - yards and parks a person, m²
 * @param k - the premises of money
 * @returns gallons a person a day
 * @throws RangeError when the green ground is negative or not a number
 */
export function waterGpd(greenM2: number, k: CostPremises): number {
  if (!(greenM2 >= 0)) throw new RangeError(`green ground must be zero or more, not ${greenM2}`);
  return k.waterBaseGpd.value + (k.wateringMm.value * greenM2) / LITERS_A_GALLON / DAYS;
}
const KM = 1000;

/**
 * Price counts at the premises: each row is its count times its premise's value.
 * @param rows - the counts
 * @param k - the premises
 * @returns one row per count, in the same order
 */
export function priceCounts(rows: readonly Counted[], k: CostPremises): CostRow[] {
  return rows.map((r) => {
    const unit = k[r.premise].value;
    return { id: r.id, layer: r.layer, count: r.count, premise: r.premise, unit, cost: r.count * unit };
  });
}

function sum(rows: readonly CostRow[]): number {
  return rows.reduce((t, r) => t + r.cost, 0);
}

/**
 * The level yearly payment that pays off a capital sum over so many years at a rate. A rate of 0 divides evenly.
 * @throws RangeError when the term is under a year
 */
export function levelPayment(capital: number, rate: number, years: number): number {
  if (!(years > 0)) throw new RangeError('financing needs a term of at least a year');
  if (rate <= 0) return capital / years;
  return (capital * rate) / (1 - (1 + rate) ** -years);
}

/**
 * Total priced rows by layer and kind, and add the Land and Financing lines: the one tally the Ledger, the Site and
 * the Run share (Decisions 3 and 6). Upkeep is not added here; the caller counts it as a row.
 * @param rows - the priced rows, upkeep among them
 * @param pop - the people the totals are divided by; 0 gives 0 a person, for a site with nobody on it
 * @param areaM2 - the ground the Land line prices
 * @param k - the premises
 * @returns the money
 */
export function tallyCost(rows: readonly CostRow[], pop: number, areaM2: number, k: CostPremises): CostFigures {
  const layers = {} as Record<Layer, number>;
  for (const layer of LAYERS) layers[layer] = sum(rows.filter((r) => r.layer === layer));
  const capitalTotal = layers.groundworks + layers.buildings + layers.fleet;
  const runningTotal = layers.upkeep + layers.civic + layers.households;
  const structures = layers.groundworks + layers.buildings;
  return {
    rows,
    layers,
    capitalTotal,
    capitalPerPerson: pop > 0 ? capitalTotal / pop : 0,
    runningTotal,
    runningPerPerson: pop > 0 ? runningTotal / pop : 0,
    land: { areaM2, unit: k.landM2.value, cost: areaM2 * k.landM2.value },
    financing: {
      capital: structures,
      rate: k.financeRate.value,
      years: k.financeYears.value,
      yearly: levelPayment(structures, k.financeRate.value, k.financeYears.value),
    },
  };
}

/** The figures the two columns share, whichever column. */
interface Shared {
  readonly areaKm2: number;
  /** Yards a person, m². Green ground, watered. */
  readonly yards: number;
  /** Parks a person, m². Green ground, watered. */
  readonly parks: number;
  readonly fleet: number;
  readonly vehTrips: number;
  readonly rideKm: number;
  readonly goodsRuns: number;
  readonly streets: number;
}

/**
 * Prices the counted rows and totals them by layer and kind, then adds the Land and Financing lines. The one
 * arithmetic both columns share (Decision 3).
 * @param s - the shared premises, for the people and the per-person civic rows
 * @param f - the column's shared figures
 * @param counted - the column's rows, less upkeep and the civic per-person rows, which are added here
 * @param k - the premises
 * @returns the column's money
 */
function figures(
  s: SharedPremises,
  f: Shared,
  counted: readonly Counted[],
  k: CostPremises,
): CostFigures {
  if (!(s.pop > 0)) throw new RangeError('cost needs people to be counted per person');
  const built = priceCounts(counted, k);
  const structures = sum(built.filter((r) => r.layer === 'groundworks' || r.layer === 'buildings'));
  const pupils = s.pop * s.gradeShare * k.grades.value;
  const civic: Counted[] = [
    { id: 'upkeep', layer: 'upkeep', count: structures, premise: 'upkeepShare' },
    { id: 'schools', layer: 'civic', count: pupils, premise: 'pupilYear' },
    { id: 'police', layer: 'civic', count: s.pop, premise: 'policePerson' },
    { id: 'fire', layer: 'civic', count: s.pop, premise: 'firePerson' },
    { id: 'health', layer: 'civic', count: s.pop, premise: 'healthPerson' },
    { id: 'library', layer: 'civic', count: s.pop, premise: 'libraryPerson' },
    { id: 'welfare', layer: 'civic', count: s.pop, premise: 'welfarePerson' },
    { id: 'higherEducation', layer: 'civic', count: s.pop, premise: 'higherEducationPerson' },
    { id: 'administration', layer: 'civic', count: s.pop, premise: 'administrationPerson' },
    { id: 'corrections', layer: 'civic', count: s.pop, premise: 'correctionsPerson' },
    { id: 'courts', layer: 'civic', count: s.pop, premise: 'courtsPerson' },
    { id: 'streetRunning', layer: 'civic', count: s.pop * f.streets, premise: 'streetRunM2' },
    { id: 'parkRunning', layer: 'civic', count: s.pop * f.parks, premise: 'parkRunM2' },
    { id: 'water', layer: 'civic', count: (s.pop * waterGpd(f.yards + f.parks, k) * DAYS) / 1000, premise: 'waterKgal' },
    { id: 'sewer', layer: 'civic', count: (s.pop * k.sewageGpd.value * DAYS) / 1000, premise: 'sewerKgal' },
    { id: 'waste', layer: 'civic', count: s.pop * k.wasteTonsPerPersonYear.value, premise: 'wasteTon' },
    { id: 'goodsRuns', layer: 'civic', count: f.goodsRuns * DAYS, premise: 'goodsRun' },
  ];
  return tallyCost([...built, ...priceCounts(civic, k)], s.pop, f.areaKm2 * 1e6, k);
}

/** The household rows every column has: vehicles driven and vehicles worn out. */
function gettingAround(
  f: Shared,
  emptyRunning: number,
  perKm: 'carKm' | 'moverKm',
  each: 'carEach' | 'moverEach',
  k: CostPremises,
): Counted[] {
  return [
    { id: 'vehicleKm', layer: 'households', count: f.vehTrips * f.rideKm * (1 + emptyRunning) * DAYS, premise: perKm },
    { id: 'vehiclesRenewed', layer: 'households', count: f.fleet / k.vehicleLifeYears.value, premise: each },
  ];
}

/**
 * The car city's money: houses and shops, streets, parking, parks, a car for most people, grid power.
 * @param s - the shared premises
 * @param c - the car city's premises
 * @param f - the car column's figures, before cost
 * @param k - the premises of money
 * @returns what the car city costs to build and to run
 */
export function carCost(
  s: SharedPremises,
  c: CarCityPremises,
  f: Omit<CarCityLedger, 'cost'>,
  k: CostPremises,
): CostFigures {
  const counted: Counted[] = [
    { id: 'streets', layer: 'groundworks', count: s.pop * f.streets, premise: 'streetM2' },
    { id: 'waiting', layer: 'groundworks', count: s.pop * f.parkingGround, premise: 'waitingM2' },
    { id: 'parks', layer: 'groundworks', count: s.pop * c.parks, premise: 'parkM2' },
    { id: 'lowRiseFloor', layer: 'buildings', count: s.pop * (s.homeFloor + s.otherFloor), premise: 'lowRiseM2' },
    { id: 'vehicles', layer: 'fleet', count: f.fleet, premise: 'carEach' },
    { id: 'electricity', layer: 'civic', count: s.pop * k.kwhPerPersonYear.value, premise: 'gridKwh' },
    ...gettingAround(f, c.emptyRunning, 'carKm', 'carEach', k),
    { id: 'insurance', layer: 'households', count: f.fleet, premise: 'carInsuranceYear' },
  ];
  return figures(s, f, counted, k);
}

/**
 * Your city's money: townhouses and the ring, paths, parks, the built sub level and its movers, the pipe, the
 * lanes, power from the city's own reactors, porters.
 * @param s - the shared premises
 * @param c - your city's premises
 * @param f - your column's figures, before cost
 * @param k - the premises of money
 * @returns what your city costs to build and to run
 */
export function walkingCost(
  s: SharedPremises,
  c: WalkingCityPremises,
  f: Omit<WalkingCityLedger, 'cost'>,
  k: CostPremises,
): CostFigures {
  const floor = s.pop * (s.homeFloor + s.otherFloor);
  const counted: Counted[] = [
    { id: 'streets', layer: 'groundworks', count: s.pop * f.streets, premise: 'streetM2' },
    { id: 'waiting', layer: 'groundworks', count: f.storageM2, premise: 'waitingM2' },
    { id: 'parks', layer: 'groundworks', count: s.pop * c.parks, premise: 'parkM2' },
    { id: 'walkwayFloor', layer: 'groundworks', count: f.walkwayKm * KM * k.walkwayWidthM.value, premise: 'lowRiseM2' },
    { id: 'moverLineFloor', layer: 'groundworks', count: f.moverKm * KM * k.moverLineWidthM.value, premise: 'lowRiseM2' },
    { id: 'moverTrack', layer: 'groundworks', count: f.moverKm, premise: 'moverTrackKm' },
    { id: 'stations', layer: 'groundworks', count: f.stations, premise: 'stationEach' },
    { id: 'entries', layer: 'groundworks', count: f.entries, premise: 'entryEach' },
    { id: 'pipe', layer: 'groundworks', count: f.pipeKm, premise: 'pipeKm' },
    { id: 'lanes', layer: 'groundworks', count: f.laneKm, premise: 'laneKm' },
    { id: 'lowRiseFloor', layer: 'buildings', count: Math.max(0, floor - f.middleFloorM2), premise: 'lowRiseM2' },
    { id: 'highRiseFloor', layer: 'buildings', count: f.middleFloorM2, premise: 'highRiseM2' },
    { id: 'dumbwaiters', layer: 'buildings', count: f.dumbwaiters, premise: 'dumbwaiterEach' },
    { id: 'vehicles', layer: 'fleet', count: f.fleet, premise: 'moverEach' },
    { id: 'electricity', layer: 'civic', count: (s.pop * k.kwhPerPersonYear.value) / 1000, premise: 'reactorMwh' },
    { id: 'porters', layer: 'civic', count: f.porters, premise: 'porterYear' },
    ...gettingAround(f, c.emptyRunning, 'moverKm', 'moverEach', k),
  ];
  return figures(s, f, counted, k);
}
