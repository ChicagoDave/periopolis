# Population

How many people the city has, month by month, and how they spend one day, hour by hour: issue 3, Phase 1 of `docs/work/archive/population-from-sourced-rates/plan.md`. Today a finished neighborhood holds exactly 5,000 people the year it is finished (`overview.md`, "Homes fill the year they are finished"), and the only variation is the stress band. This brainstorm sources what replaces that.

The marks are the money brainstorm's (`money.md`, ADR-0007 Decision 9): **Yours** is David's, **Sourced** carries its source and year and stays a placeholder until David accepts it, **Mine** is a placeholder Claude filled in with the search recorded.

Two clocks, kept separate (decided with David, 2026-10-14):
- **The month clock** owns who lives here: occupancy of the homes as built, moved by people arriving and leaving, births and deaths.
- **The day view** owns how they spend one day: trips, power, movers in service and school runs by hour, for the people the month clock hands it.

## Brainstorm Progress

- [x] **Capacity and occupancy**: what stays fixed and what moves
- [x] **Components of change**: births, deaths, moving, with sources
- [x] **Moving in**: how fast finished homes fill, from new towns
- [x] **The day**: hourly shapes for trips, power and school
- [x] **David decides**: the questions at the end, answered 2026-10-14 ("Decided" below)

## Capacity and occupancy

The 5,000 a tile stays. It is the tile's **capacity**, the homes as built, which Ground draws (2,041 townhouses, ADR-0005) and the capital rows price (`site.md`: "the capital rows count the homes as built"). What moves is **occupancy**: how many people live in those homes this month. That keeps Ground, the capital rows and every parity figure where they are (plan-review, 2026-10-14).

| Figure | Value | Source | Mark |
|---|---|---|---|
| People a home in the ledger | 2.45 (5,000 over 2,041 townhouses) | the ledger's own consequence | Yours (lines) |
| Average household, US | 2.5 (2022); 2.53 (2020–2024) | Census CPS via [USAFacts](https://usafacts.org/data/topics/people-society/population-and-demographics/population-data/average-family-size); ACS 5-year via QuickFacts ([ppc.land](https://ppc.land/persons-per-household/)) | Sourced 2022 / 2024 |

The ledger's 2.45 a home is within 2% of the national household, so a full tile at 5,000 is a full tile of ordinary households. Occupancy above capacity is what the stress band already models (+20% in the same homes); this plan keeps that as a stress, not as growth.

## Components of change

Each is a yearly rate a person, taken a twelfth a month unless David wants seasons (question 3).

| Component | Yearly rate | Source | Mark |
|---|---|---|---|
| Births | 10.7 per 1,000 people (3,596,017 births, 2023 final) | [CDC FastStats, Births and Natality](https://cdc.gov/nchs/fastats/births.htm); [NCHS Data Brief 507](https://cdc.gov/nchs/products/databriefs/db507.htm) | Sourced 2023 |
| Deaths | 9.2 per 1,000 (3,090,964 deaths, 2023 final, over the 2023 resident population) | [NCHS Data Brief 521](https://cdc.gov/nchs/products/databriefs/db521.htm); the brief gives the count and age-adjusted rate (750.5 per 100,000), the crude rate is derived here | Sourced 2023 (rate derived) |
| Natural increase | about 1.5 per 1,000 (519,000 people, 2023–24) | Census Vintage 2024 via [Calculated Risk](https://www.calculatedriskblog.com/2024/12/census-us-population-grew-by-nearly-10.html) | Sourced 2024 |
| Moving house, any distance | 7.8% of people a year (2023), 8.7% (2022) | Census CPS historical mobility ([Census, why people move](https://census.gov/library/stories/2023/09/why-people-move.html); 2023 via a secondary summary of Table A-1) | Sourced 2022 (2023 to be checked against Table A-1) |
| Net international migration, US | 2.79 million (2024), 84% of growth | Census Vintage 2024 ([Pioneer Institute](https://pioneerinstitute.org/wp-content/uploads/PNR-607-Mass-Migration-Newsletter-02122025.pdf), [USAFacts](https://media.usafacts.org/m/56f7fa7cbf9d5138/original/USAFacts_2025_DIGITAL_Population.pdf)) | Sourced 2024, context only |

**What these mean for a new city.** Births less deaths add about 75 people a year to a full city of 50,000. Natural increase cannot grow a new city; people moving in do. And people moving out matter as much: at 8% of people moving house a year, a full city of 50,000 sees about 4,000 people move, and if half of them leave the city (below), about 2,000 a year have to be replaced by as many arriving. That turnover, not births, is what a month clock shows in a city that has stopped growing.

Moving house at 7.8 to 8.7% is any move, most of them within a county. How many of a city's movers leave the city depends on its size and its neighbors; the national figure is the ceiling. **Mine**: half of movers leave the city (no benchmark found for a city of 50,000 standing alone; searched CPS mobility tables only).

## Moving in: how fast finished homes fill

New towns grew by a few thousand people a year at their fastest, whatever they had built.

| Town | Census figures | People added a year | Source | Mark |
|---|---|---|---|---|
| Irvine, CA | 62,134 (1980), 110,330 (1990) | about 4,800 | `overview.md` (Census) | Sourced 1990 |
| The Woodlands, TX | about 8,440 (1980), about 29,200 (1990), 55,649 (2000) | about 2,100, then 2,600 | Census CDP figures via [HAR](https://www.har.com/web/ceceliasmith/blogs/32304) and [the Township](https://www.thewoodlandstownship-tx.gov/Community/Business-Resources/Area-Demographics); boundaries differ | Sourced 2000 |
| Columbia, MD | 75,883 (1990); about 3.75% a year 1980–1990 | about 2,500 | [Maryland Manual, 1990 census](https://1999mdmanual.msa.maryland.gov/msa/mdmanual/01glance/html/pop.html); growth rate from [population.city](https://population.city/united-states/columbia3/) | Sourced 1990 (1980 count not verified) |
| Frisco, TX | 116,989 (2010), about 200,490 (2020) | about 8,350, mostly migration | [Frisco 2040 Comp Plan Appendices](https://www.friscotexas.gov/DocumentCenter/View/36063/2040-Comp-Plan-Appendices-PDF) | Sourced 2020 |

*Added 2026-10-21 (ADR-0017, David): the city is enormously popular, so these rows are comparisons, not the premise. People join a waiting list at 30,000 a year (`demandPerYear`, Mine) and move in as homes stand empty; ten crews build homes for about 25,000 a year, so the crews are the brake. Frisco, a popular city past 100,000, is the sourced comparison; Irvine's 4,800, the premise from 2026-10-14 to 2026-10-21, stays here as a comparison only.*

Two ways to turn this into a premise, for David (question 2; answered 2026-10-14 with the citywide pace, and replaced 2026-10-21 by the waiting list, ADR-0017):
- **A citywide pace**: at most about 4,800 people a year arrive (Irvine's decade, the fastest of the three), shared among finished homes that stand empty. A city that builds faster than people come has empty homes, and the month clock shows them.
- **A fill time per neighborhood**: a finished neighborhood fills over so many months. **Mine**: 12 months, which at one neighborhood finished a year matches Irvine's pace. It is simpler, but it lets a city that finishes ten neighborhoods in a year fill all ten.

The Irvine figure stays a comparison either way: a city founded from nothing should add people at about Irvine's pace, not be tuned to it (plan Phase 4).

## The day

The Site checks a day and a peak already: 3.37 trips a person a day (`premises.ts`, NHTS 2017), a peak hour of 10% of trips (`peakShare`), and power for a peak of 1.5 kW a person (`rates.ts`). The day view spreads those over 24 hours, so its sum is the day and its highest hour is the peak; the shapes below only say how.

### Trips by hour

| Start time | 10 p.m.–1 a.m. | 1–6 a.m. | 6–9 a.m. | 9 a.m.–1 p.m. | 1–4 p.m. | 4–7 p.m. | 7–10 p.m. |
|---|---|---|---|---|---|---|---|
| Person trips, 2022 | 2.0% | 2.2% | 17.8% | 23.4% | 23.8% | 22.0% | 8.9% |
| Person trips, 2017 | 2.3% | 1.9% | 16.6% | 25.4% | 22.1% | 22.1% | 9.8% |

Source: [Summary of Travel Trends, 2022 NHTS](https://nhts.ornl.gov/assets/2022/pub/2022_NHTS_Summary_Travel_Trends.pdf), Table 8-1 (Sourced 2022). The travel day runs 4 a.m. to 3:59 a.m.; Figure 8-1 gives vehicle trips by hour as a chart only, so hours within a period are spread evenly unless David wants a shape (**Mine**).

Two things this shows about the ledger:
- **The peak.** 4–7 p.m. holds 22% of trips over three hours, 7.3% an hour on average; Figure 8-1's busiest hour reads under 9%. The ledger's 10% peak hour is on the high side of 2022 and is what the fleet is sized for. Keep it, or move it to the table (question 5).
- **Trips a day.** NHTS 2022 records 2.3 person trips a person a day against 3.4 in 2017 (Table 4-9), the post-pandemic drop. The ledger uses 3.37. This is a change to an accepted premise, not part of this plan unless David raises it (question 6). *Decided 2026-10-14 (ADR-0010):* keep 3.37; the 2022 report calls its figure a recovery, not a steady state, and its methods changed.

### Power by hour

| Figure | Value | Source | Mark |
|---|---|---|---|
| Summer: one peak, late afternoon | highest around 5 to 6 p.m.; lowest around 5 a.m. | [EIA, Today in Energy, 21 Feb 2020](https://www.eia.gov/todayinenergy/detail.php?id=42915) | Sourced 2020 |
| Winter: two peaks | morning and evening, less variable than summer | same | Sourced 2020 |
| Lowest hour against the peak | 0.6 | none found; EIA describes the range in words only; EIA-930 hourly data would give it | Mine |

### School and the movers

| Figure | Value | Source | Mark |
|---|---|---|---|
| High school start | 8:00 a.m. (2017–18); 8:07 (2020–21) | NCES via [Kappan](https://kappanonline.org/start-time-us-high-schools-nces/), [NCES blog](https://nces.ed.gov/blogs/nces/2020/02/19/default), [Start School Later](https://www.startschoollater.net/wake-up-calls-fast-facts) | Sourced 2021 |
| School day | 6.5 hours | not found in this search (NCES school-day tables are the place) | Mine |
| Movers in service | all 24 hours, fleet sized for the peak, the rest parked or charging | the city's choice; no benchmark | Mine |

## Questions for David (Phase 2)

1. **Capacity and occupancy.** Keep 5,000 a tile as the homes as built, with occupancy moving under it? (Recommended: yes; it keeps Ground, the capital rows and parity still.)
2. **Moving in.** A citywide pace of about 4,800 people a year (Irvine), or a fill time per neighborhood (12 months, Mine)? (Recommended: the citywide pace; it is the one the sources support.)
3. **Seasons.** Births, deaths and moves a twelfth a month, or by month of year (births peak in August per secondary reports of CDC 2023 data, unverified)? (Recommended: a twelfth; seasonality can come later.)
4. **Leaving.** Half of movers leave the city (Mine), or another share?
5. **The peak hour.** Keep the ledger's 10%, or take the day's shape from NHTS 2022 and let the peak follow? (Recommended: keep 10% for this plan; the day view's busiest hour equals it by construction.)
6. **Trips a day.** 3.37 (NHTS 2017, accepted) or 2.3 (NHTS 2022)? Outside this plan unless you want it in.
7. **The day.** Which day the view shows by default: a summer weekday, a winter weekday, or both side by side?
8. **Marks.** Accept the Sourced rows above as they stand?

## Decided

David, 2026-10-14 (session 51a736), on the eight questions:

| # | Question | Decision |
|---|---|---|
| 1 | Capacity and occupancy | 5,000 a tile stays the homes as built; occupancy moves month to month under it. |
| 2 | Moving in | A citywide pace: at most about 4,800 people a year arrive (Irvine 1980–1990), shared among empty finished homes. |
| 3 | Seasons | A twelfth of each yearly rate a month. |
| 4 | Leaving | Half of the people who move house leave the city (stays Mine until a benchmark is found). |
| 5 | The peak hour | Keep the ledger's 10%; the day view's busiest hour equals it, and NHTS 2022's shape fills the rest of the day. |
| 6 | Trips a day | Keep 3.37 (NHTS 2017) in this plan; 2.3 (NHTS 2022) is its own issue. Issue 4 kept 3.37 (ADR-0010). |
| 7 | The day | A summer weekday by default. |
| 8 | Marks | Every Sourced row above is accepted as it stands; the Mine rows (half leave, the 0.6 low hour of power, the 6.5-hour school day, movers in service all day) stay Mine. |
