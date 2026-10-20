/**
 * @file The Board's flows in a browser, on the built page: the front door, the opening city, two far neighborhoods, a founding run
 * through year 3, the ledger's city run to year 20, undo and storage, a tile's ground zoomed into at both levels, what
 * the city needs, the city sized to its people, a city founded month by month with its day hour by hour, and a
 * neighborhood standing empty while its line is under construction (ADR-0012), and a city that grows itself (ADR-0015).
 * Owner context: Board (adapter), tests.
 */
import { planNeighborhood, planRing } from '@city/ground';
import { RATES } from '@city/site';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** The built page from disk, or the published Board when BOARD_URL names it (ADR-0011). */
const url = process.env.BOARD_URL ?? `file://${join(here, '../../dist/index.html')}`;

const tile = (page: Page, k: string) => page.locator(`#board .tile[data-k="${k}"]`);
const place = async (page: Page, tool: string, keys: readonly string[]): Promise<void> => {
  await page.click(`#tool-${tool}`);
  for (const k of keys) await tile(page, k).click();
};

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_') && !m.text().includes('net::')) problems.push(m.text());
  });
  await page.goto(url);
  await expect(page.locator('#tally')).not.toBeEmpty();
  (page as Page & { problems?: string[] }).problems = problems;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { problems?: string[] }).problems ?? []).toEqual([]);
});

test('a first-time visitor sees what the Board claims, the three marks, the source and where to send a review', async ({ page }) => {
  const about = page.locator('#about');
  await expect(about.locator('h2')).toHaveText('What this is, and how to review it');
  await expect(about).toContainText('The claim is that such a city can be planned, built, filled and powered');
  await expect(about.locator('.chip.mark')).toHaveText(['Sourced', 'Yours', 'Mine']);
  await expect(about.locator('a[href="https://github.com/ChicagoDave/periopolis"]')).toBeVisible();
  await expect(page.locator('#review-link')).toHaveAttribute('href', 'https://github.com/ChicagoDave/periopolis/issues/new?template=review.yml');
  await expect(page.locator('#review-link')).toBeInViewport();
});

test("the opening city holds 14 of 15 lines, and a stretch test can be shown", async ({ page }) => {
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
  await expect(page.locator('#clocknow')).toHaveText('The clock is stopped. What you place is built at once.');
  await expect(page.locator('#rule-size .chip')).toHaveText('Watch');
  await expect(page.locator('#rule-size .detail')).toHaveText('Fine dining wants 71,300 people in the city. It has 50,000, which is 70% of that.');
  const chips = await page.locator('#tests li .chip').allTextContents();
  expect(chips).toEqual(['Holds', 'Holds', 'Holds', 'Gives']);
  await page.click('#test-closure');
  await expect(page.locator('#bannertext')).toHaveText('Stretch test: the board shows the city with one stretch of mover line closed for repairs.');
  await expect(page.locator('#tally')).toHaveText('12 of 15 hold, 2 broken, 1 to watch. Click one to mark its tiles.');
  await page.click('#today');
  await expect(page.locator('#banner')).toBeHidden();
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await expect(page.locator('#said')).toHaveText('Neighborhood with elementary school, middle school.');
  await expect(page.locator('#inspector h2')).toHaveText('Neighborhood');
  // Money (ADR-0007): the city priced by layer beside the car city, every row with its mark, no spend without a clock.
  await expect(page.locator('#moneynow')).toContainText('$13.4 B to build');
  // Was $571 M before the civic layer was widened (widen-civic-layer, 2026-10-14).
  await expect(page.locator('#moneynow')).toContainText('$794 M a year to run');
  await expect(page.locator('#layerrows tr')).toHaveCount(10);
  await expect(page.locator('#layerrows tr').first().locator('th')).toHaveText('Groundworks');
  await expect(page.locator('#layerrows tr.total').first().locator('td').nth(2)).toContainText('$');
  await page.click('#costbox summary');
  // Every row shows one mark, Yours, Sourced or Mine; how many of each moves as David accepts premises.
  const chipCount = await page.locator('#costrows .chip.mark').count();
  const yoursChips = await page.locator('#costrows .chip.mark.yours').count();
  const sourcedChips = await page.locator('#costrows .chip.mark.sourced').count();
  const mineChips = await page.locator('#costrows .chip.mark.mine').count();
  expect(chipCount).toBeGreaterThan(20);
  expect(yoursChips + sourcedChips + mineChips).toBe(chipCount);
  expect(yoursChips).toBeGreaterThan(0);
  await expect(page.locator('#costrows .chip.mark.yours').first()).toHaveAttribute('title', 'Your figure, from the lines.');
  expect(await page.locator('#costrows .chip.mark.sourced.accepted').count()).toBeGreaterThan(5);
  await expect(page.locator('#costrows .chip.mark.sourced.accepted').first()).toContainText(', accepted');
  await expect(page.locator('#spentbox')).toBeHidden();
});

test('two far neighborhoods with no line break three lines and are the only tiles marked', async ({ page }) => {
  await place(page, 'hood', ['4,-2', '4,-1']);
  await expect(page.locator('#said')).toHaveText('A neighborhood of 5,000 people.');
  await expect(page.locator('#tally')).toHaveText('11 of 15 hold, 3 broken, 1 to watch. Click one to mark its tiles.');
  await expect(page.locator('#rule-ways .chip')).toHaveText('Broken');
  await expect(page.locator('#rule-ways .detail')).toHaveText('9.1% of trips are longer than people will walk and have no mover to take. Run the mover line to the tiles marked.');
  await expect(page.locator('#board .tile.bad')).toHaveCount(2);
  await expect(tile(page, '4,-2')).toHaveClass(/bad/);
  await expect(tile(page, '1,0')).not.toHaveClass(/bad/);
  await page.click('#tool-inspect');
  await tile(page, '4,-2').click();
  const issues = await page.locator('#inspector .issues li').allTextContents();
  expect(issues).toEqual([
    'A 34-minute walk from the ring, with no mover line to it',
    'No mover stop',
    '29% of its trips are past the walk with no mover to take',
  ]);
  await page.click('#undo');
  await page.click('#undo');
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
});

test('founding a city from nothing: orders, three years, a building site and the work in hand', async ({ page }) => {
  // Year by year, as the sketch runs it: this flow's figures were pinned on the yearly clock.
  await page.check('#yearly');
  await page.click('#found');
  await expect(page.locator('#said')).toHaveText('An empty site, year 0, 10 crews. Place your first orders, then press Next year. Undo brings the old city back.');
  await expect(page.locator('#moneynow')).toHaveText('Nothing stands, so nothing costs anything yet.');
  await expect(page.locator('#spentnow')).toHaveText('Nothing spent yet. Year 0 counts for nothing.');
  await place(page, 'power', ['3,-1', '3,-1']);
  await expect(page.locator('#said')).toHaveText('Ordered: reactor module. 1 year of work, starting now.');
  await place(page, 'water', ['3,-2']);
  await place(page, 'sewage', ['-3,1']);
  await place(page, 'waste', ['-3,2']);
  await place(page, 'ring', ['0,0']);
  await place(page, 'line', ['0,0', '1,0', '2,-1', '3,-1']);
  await expect(page.locator('#said')).toHaveText('Ordered: stretch of mover line. 1 year of work, starting now.');
  await expect(page.locator('#worknow')).toHaveText('9 of 10 crews working.');
  await page.click('#tick');
  await expect(page.locator('#said')).toHaveText('Year 1: 0 people. Nobody lives here yet. Opened: 3 stretches of mover line.');
  // Groundworks first: the three stretches are paid in the year they open, and nothing else is.
  await expect(page.locator('#spentnow')).toContainText('spent in one year');
  await expect(page.locator('#spentrows tr').first().locator('td')).not.toHaveText('$0');
  await expect(page.locator('#spentrows tr').nth(1).locator('td')).toHaveText('$0');
  await place(page, 'hood', ['1,0', '2,-1']);
  await place(page, 'elementary', ['1,0', '2,-1']);
  await place(page, 'middle', ['1,0']);
  await place(page, 'high', ['2,-1']);
  await place(page, 'fields', ['2,-1']);
  await expect(page.locator('#worknow')).toHaveText('10 of 10 crews working, 2 jobs waiting for a crew.');
  // Built in order (ADR-0012), the homes come last in the work in hand; putting one first puts it first among the homes.
  await page.locator('#work button[id^="first-"]').last().click();
  await expect(page.locator('#said')).toHaveText('Neighborhood goes first. Whatever lost its crew keeps the work done on it.');
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await expect(page.locator('#inspector h2')).toHaveText('Building site');
  await expect(page.locator('#board .tile.site')).toHaveCount(7);
  await page.click('#tick');
  await page.click('#tick');
  // The plants, the ring and the schools take the crews before the homes do (ADR-0012), so at year 3 the homes are
  // still building.
  await expect(page.locator('#clocknow')).toContainText('Year 3 of 20.');
  await expect(page.locator('#clocknow')).toContainText('Homes for 0 people.');
  await page.click('#yr-2');
  await expect(page.locator('#said')).toContainText('Year 2:');
  await page.click('#stop');
  await expect(page.locator('#said')).toHaveText('The clock is stopped. Work in hand was finished at once.');
  await expect(page.locator('#clocknow')).toHaveText('The clock is stopped. What you place is built at once.');
});

test("the ledger's city run to year 20 records every year, survives a reload and exports its clock", async ({ page }) => {
  await page.check('#yearly');
  await page.click('#run');
  await expect(page.locator('#clocknow')).toContainText('Year 0 of 20.');
  // The run is built in order (ADR-0012), and the ledger's city is served, so everyone lives there and nothing is held.
  expect(await page.evaluate(() => localStorage.getItem('future-city-builder-v1'))).toContain('"inOrder":true');
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await expect(page.locator('#inspector .facts dd').first()).toHaveText('5,000');
  await expect(page.locator('#inspector .held')).toHaveCount(0);
  let announced = false;
  for (let y = 1; y <= 20; y++) {
    await page.click('#tick');
    if (!announced && (await page.locator('#notices button').count())) {
      announced = true;
      await page.locator('#notices button').first().click();
      await expect(page.locator('#said')).toHaveText('The two ends of that stretch are marked on the board.');
    }
  }
  expect(announced).toBe(true);
  await expect(page.locator('#clocknow')).toContainText('Year 20. The run is over.');
  await expect(page.locator('#tick')).toBeDisabled();
  await expect(page.locator('.yr')).toHaveCount(20);
  await page.click('#recordbox summary');
  await expect(page.locator('#recordrows tr')).toHaveCount(21);
  // The run's money: a Spent column on the record, and the twenty years summed by layer.
  await expect(page.locator('#recordrows tr').first().locator('td')).toHaveCount(5);
  await expect(page.locator('#recordrows tr').first().locator('td').nth(4)).toHaveText('–');
  await expect(page.locator('#recordrows tr').last().locator('td').nth(4)).toContainText('$');
  await expect(page.locator('#spentnow')).toContainText('spent in 20 years');
  await expect(page.locator('#spentnow')).toContainText('The twenty years are up.');
  await expect(page.locator('#spentrows tr')).toHaveCount(6);
  const strip = await page.locator('.yr .m').allTextContents();
  const broken = strip.filter((m) => m !== '✓').length;
  expect(broken).toBeGreaterThanOrEqual(2);
  expect(broken).toBeLessThanOrEqual(4);
  await page.click('#copy');
  await expect(page.locator('#dump')).toBeVisible();
  expect(await page.inputValue('#dump')).toContain('CLOCK');
  expect(await page.inputValue('#dump')).toContain('Year 20 of 20.');
  expect(await page.inputValue('#dump')).toContain('MONEY');
  expect(await page.inputValue('#dump')).toContain('Spent so far, years 1 to 20:');
  await page.reload();
  await expect(page.locator('#said')).toHaveText('Your run is as you left it, in year 20.');
  await expect(page.locator('#clocknow')).toContainText('Year 20. The run is over.');
});

test('undo, clear and storage: tiles come and go, the board survives a reload, and a bad save falls back to the starter', async ({ page }) => {
  await expect(page.locator('#undo')).toBeDisabled();
  await place(page, 'hood', ['4,0']);
  await expect(tile(page, '4,0')).toHaveClass(/hood/);
  await place(page, 'hood', ['4,0']);
  await expect(page.locator('#said')).toHaveText('That tile already holds a neighborhood.');
  await page.click('#undo');
  await expect(page.locator('#said')).toHaveText('Undone.');
  await expect(tile(page, '4,0')).toHaveClass(/open/);
  await expect(page.locator('#undo')).toBeDisabled();
  await place(page, 'ring', ['0,0']);
  await expect(page.locator('#said')).toHaveText('The ring has 9 buildings.');
  await page.reload();
  await expect(page.locator('#said')).toHaveText('Your city is as you left it. Pick a tool to carry on.');
  await expect(page.locator('#inspector')).toBeVisible();
  await page.click('#tool-inspect');
  await tile(page, '0,0').click();
  await expect(page.locator('#said')).toHaveText('Ring of 9 buildings.');
  await page.click('#clear');
  await expect(page.locator('#said')).toHaveText('The site is clear. Undo brings the city back.');
  await expect(page.locator('#tally')).toHaveText('Nothing to check yet.');
  await expect(page.locator('#board .tile.hood')).toHaveCount(0);
  await expect(page.locator('#moneynow')).toHaveText('Nothing stands, so nothing costs anything yet.');
  await expect(page.locator('#layerrows tr').first().locator('td').first()).toHaveText('$0');
  await page.click('#undo');
  await expect(page.locator('#board .tile.hood')).toHaveCount(10);
  await page.evaluate(() => localStorage.setItem('future-city-builder-v1', '{not json'));
  await page.reload();
  await expect(page.locator('#said')).toHaveText("This is the ledger's city of 50,000. Pick a tool and change it, or clear the site and start your own.");
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
});

test("a tile's ground: the drawn homes, entries and ring buildings are the Ground's, the levels swap, and the map comes back whole", async ({ page }) => {
  const hood = planNeighborhood(RATES.shared, RATES.walking, RATES.base);
  const ring = planRing(RATES.walking, RATES.base, 8);
  const sum = (selector: string): Promise<number> =>
    page.locator(selector).evaluateAll((nodes) => nodes.reduce((n, e) => n + Number(e.getAttribute('data-homes')), 0));
  await expect(page.locator('#viewbar')).toBeHidden();
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await page.click('#look');
  await expect(page.locator('#said')).toHaveText(
    'One neighborhood: 2,041 townhouses of 3 stories in 47 rows, 12.2 km of frontage; the center, a 12-acre park, 1.1 km of bike lane. Below, 33 entries of about 62 homes, 3.7 km of walkway, 6.1 km of goods pipe, and the stop.',
  );
  await expect(page.locator('#viewbar')).toBeVisible();
  await expect(page.locator('#viewtext')).toHaveText('Neighborhood at 1,0, 93 acres');
  await expect(page.locator('#level-surface')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#board .ground')).toHaveAttribute('data-level', 'surface');
  await expect(page.locator('#board .g-row')).toHaveCount(hood.figures.rows);
  expect(await sum('#board .g-row')).toBe(hood.figures.homes);
  expect(hood.figures.homes).toBe(2041);
  await expect(page.locator('#board .g-lane')).toHaveCount(3);
  await expect(page.locator('#board .g-entry')).toHaveCount(0);
  await expect(page.locator('#board .tile')).toHaveCount(0);
  await page.click('#level-sub');
  await expect(page.locator('#board .ground')).toHaveAttribute('data-level', 'sub');
  await expect(page.locator('#level-sub')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#board .g-entry')).toHaveCount(hood.figures.entries);
  expect(await sum('#board .g-entry')).toBe(hood.figures.homes);
  await expect(page.locator('#board .g-walkway')).toHaveCount(hood.figures.entries - 1);
  await expect(page.locator('#board .g-pipe')).toHaveCount(hood.sub.pipes.length);
  await expect(page.locator('#board .g-stop')).toHaveCount(1);
  await expect(page.locator('#board .g-row')).toHaveCount(0);
  await page.click('#back');
  await expect(page.locator('#said')).toHaveText('The map.');
  await expect(page.locator('#viewbar')).toBeHidden();
  // The site is a rectangle of 158 tiles along the shore (ADR-0006, ADR-0016), drawn inside one outline.
  await expect(page.locator('#board .tile')).toHaveCount(158);
  await expect(page.locator('#board rect.outline')).toHaveCount(1);
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
  await tile(page, '0,0').click();
  await page.click('#look');
  await expect(page.locator('#said')).toHaveText('The ring: 8 buildings of 25 stories, 272 m across, round a 6.5-acre plaza. Below, the stop.');
  await expect(page.locator('#board .g-bldg')).toHaveCount(ring.figures.buildings);
  await expect(page.locator('#board .g-bldg').first()).toHaveAttribute('data-stories', '25');
  await expect(page.locator('#inspector #look')).toHaveText('Back to the map');
  // Taking the ring down from under the view, one building at a time, sends it back to the map once the tile is bare.
  for (let left = 7; left >= 1; left--) {
    await page.click('#inspector button:has-text("Remove one")');
    await expect(page.locator('#board .g-bldg')).toHaveCount(left);
  }
  await page.click('#inspector button:has-text("Remove one")');
  await expect(page.locator('#viewbar')).toBeHidden();
  await expect(page.locator('#board .tile')).toHaveCount(158);
  await expect(tile(page, '0,0')).toHaveClass(/open/);
  await expect(page.locator('#inspector h2')).toHaveText('Open ground');
  // The view is the page's alone: a reload comes back on the map with the city as saved.
  await page.click('#undo');
  await tile(page, '0,0').click();
  await page.click('#look');
  await expect(page.locator('#viewbar')).toBeVisible();
  await page.reload();
  await expect(page.locator('#viewbar')).toBeHidden();
  await expect(page.locator('#board .tile.ring')).toHaveCount(1);
});

test('a placed neighborhood shows what the city needs, and Add all builds it back to 14 of 15 (ADR-0008)', async ({ page }) => {
  await expect(page.locator('#needsnow')).toHaveText('The city needs nothing more to keep its lines whole.');
  await expect(page.locator('#needlist li')).toHaveCount(0);
  await place(page, 'hood', ['2,0']);
  await expect(page.locator('#tally')).toContainText('broken');
  await expect(page.locator('#needlist li')).toHaveCount(1);
  await expect(page.locator('#needlist li .what')).toHaveText('The mover line run to 2,0, on a line to the ring.');
  await expect(page.locator('#addall')).toBeHidden();
  // Show marks the tiles a proposal touches, without building anything.
  await page.locator('#needlist li').first().getByRole('button', { name: 'Show' }).click();
  await expect(page.locator('#tally')).toContainText('broken');
  await page.locator('#needlist li').first().getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('#said')).toHaveText('Built: the mover line run to 2,0, on a line to the ring.');
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
  await expect(page.locator('#needlist li')).toHaveCount(0);
  // Two more neighborhoods: now the ring, the plants, the schools and the fields fall short as well.
  await place(page, 'hood', ['-3,0', '0,2']);
  await expect(page.locator('#needlist li')).toHaveCount(8);
  await expect(page.locator('#addall')).toBeVisible();
  await page.click('#addall');
  await expect(page.locator('#said')).toHaveText('Built 8 additions. Undo takes them back one click at a time.');
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
  await expect(page.locator('#needsnow')).toHaveText('The city needs nothing more to keep its lines whole.');
  // Undo takes the additions back together, as one move.
  await page.click('#undo');
  await expect(page.locator('#needlist li')).toHaveCount(8);
});

test('the ledger\'s city sized to its people: one ring building and one reactor module fewer, every line still holding, and cheaper', async ({ page }) => {
  await expect(page.locator('#moneynow')).toContainText('$13.4 B to build');
  await page.click('#sized');
  await expect(page.locator('#said')).toHaveText("The ledger's city sized to its 50,000 people: 7 ring buildings and 2 reactor modules, one of each fewer, and every line it held still holds. Undo brings yours back.");
  await expect(page.locator('#tally')).toHaveText('14 of 15 hold, 1 to watch. Click one to mark its tiles.');
  await expect(page.locator('#moneynow')).toContainText('$12.2 B to build');
  await expect(page.locator('#moneynow')).toContainText('$243,852 a person');
  await expect(page.locator('#needsnow')).toHaveText('The city needs nothing more to keep its lines whole.');
  await page.click('#undo');
  await expect(page.locator('#moneynow')).toContainText('$13.4 B to build');
});

test('a city founded month by month: homes fill at Irvine\'s pace, a month step moves the people, and the day lists 24 hours for them (ADR-0009)', async ({ page }) => {
  // The opening city's day, every neighborhood full.
  await expect(page.locator('#daynow')).toContainText('A summer weekday for 50,000 people: 147,727 trips');
  await page.click('#daybox summary');
  await expect(page.locator('#hourrows tr')).toHaveCount(24);
  await expect(page.locator('#hourrows tr.peak th')).toHaveText('5 to 6 p.m.');
  await page.click('#dayprem summary');
  await expect(page.locator('#daypremises li')).toHaveCount(7);
  await expect(page.locator('#daypremises .chip.mark')).toHaveCount(7);
  await page.click('#popbox summary');
  await expect(page.locator('#poppremises li')).toHaveCount(6);
  await expect(page.locator('#poppremises li').nth(4)).toContainText('Arrivals into empty homes: 4,800 people a year at most, citywide');
  await expect(page.locator('#poppremises li').last()).toContainText('People in homes with no school-age children: 60% of people');

  // The month clock is the Board's default run; the city growing itself (ADR-0015) is turned off for the pinned figures.
  await page.uncheck('#grow');
  await page.click('#found');
  await expect(page.locator('#said')).toHaveText(
    'An empty site, year 0, 10 crews. Place your first orders, then press Play to let the months run, or Next month to step one. Undo brings the old city back.',
  );
  await expect(page.locator('#yearlybox')).toBeHidden();
  await expect(page.locator('#play')).toHaveText('Play');
  await expect(page.locator('#peoplenow')).toHaveText('The start of year 1. 0 people living in homes for 0.');
  await expect(page.locator('#daynow')).toHaveText('A summer weekday, and nobody lives here yet: no trips, no power drawn, every mover parked.');
  // People move in only when the city carries them (ADR-0012): two reactor modules, so the peak holds with one down,
  // and a unit of water, sewage and waste. With no school, only the childless share may live there.
  await place(page, 'power', ['3,-1', '3,-1']);
  await place(page, 'water', ['3,-2']);
  await place(page, 'sewage', ['-3,1']);
  await place(page, 'waste', ['-3,2']);
  await place(page, 'hood', ['1,0', '2,-1']);
  await page.click('#month');
  await expect(page.locator('#said')).toHaveText('Year 1, month 1: no homes stand yet, so nobody lives here.');
  await expect(page.locator('#peoplenow')).toHaveText('Year 1, month 1 of 12. 0 people living in homes for 0.');
  // The rest of year 1, then year 2, when the two neighborhoods open and stand empty: the reactor site takes 3 years,
  // and the second module, finished, waits for it.
  await page.click('#tick');
  await page.click('#tick');
  await expect(page.locator('#clocknow')).toContainText('Year 2 of 20.');
  await expect(page.locator('#said')).toContainText('2 neighborhoods stand empty, waiting for power.');
  await expect(page.locator('#peoplenow')).toHaveText('The start of year 3. 0 people living in homes for 10,000.');
  // Year 3, when both modules open and the first 400 move in.
  await page.click('#tick');
  await expect(page.locator('#clocknow')).toContainText('Year 3 of 20.');
  await expect(page.locator('#peoplenow')).toHaveText('The start of year 4. 400 people living in homes for 10,000.');
  await expect(page.locator('#daynow')).toContainText('A summer weekday for 400 people:');
  await page.click('#month');
  await expect(page.locator('#said')).toHaveText(
    'Year 4, month 1: 799 people in homes for 10,000. 400 moved in, 0.4 born, 0.3 died and 1.5 moved away. ' +
      '2 neighborhoods hold only households with no school-age children, waiting for elementary, middle-school and high-school seats.',
  );
  await expect(page.locator('#peoplenow')).toHaveText('Year 4, month 1 of 12. 799 people living in homes for 10,000.');
  await expect(page.locator('#daynow')).toContainText('A summer weekday for 799 people:');
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await expect(page.locator('#inspector .held')).toHaveText('Only households with no school-age children live here. It waits for elementary, middle-school and high-school seats.');
  await expect(page.locator('#hourrows tr')).toHaveCount(24);
  await page.click('#monthbox summary');
  await expect(page.locator('#monthrows tr')).toHaveCount(37);
  // The month clock survives a reload.
  await page.reload();
  await expect(page.locator('#peoplenow')).toHaveText('Year 4, month 1 of 12. 799 people living in homes for 10,000.');
});

test('a neighborhood stands empty until the city carries it, and line 6 says when its line is under construction (ADR-0012)', async ({ page }) => {
  await page.uncheck('#grow');
  await page.click('#found');
  await place(page, 'ring', ['0,0']);
  await place(page, 'hood', ['1,0']);
  await page.click('#tick');
  await page.click('#tick');
  // The homes stand at year 2 with nothing to serve them: nobody moves in, and the year says why.
  await expect(page.locator('#said')).toContainText('Year 2: 0 people.');
  await expect(page.locator('#said')).toContainText('1 neighborhood stands empty, waiting for power, drinking water, sewage treatment and waste handling.');
  await expect(page.locator('#rule-stops .chip')).toHaveText('Watch');
  await expect(page.locator('#rule-stops .detail')).toHaveText('1 neighborhood nobody lives in yet has no stop on a line to the ring.');
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await expect(page.locator('#inspector .held')).toHaveText('Nobody lives here yet. It waits for power, drinking water, sewage treatment and waste handling.');
  await expect(page.locator('#inspector .facts dd').first()).toHaveText('0');
  // Ordering the stretch puts line 6 under construction; when it opens, the neighborhood has its stop.
  await place(page, 'line', ['0,0', '1,0']);
  await expect(page.locator('#rule-stops .detail')).toHaveText('1 neighborhood nobody lives in yet has no stop on a line to the ring. The mover line to it is under construction.');
  await page.click('#tick');
  await expect(page.locator('#rule-stops .detail')).toHaveText('Every neighborhood has a stop under its center, on a line to the ring.');
});

test('the months run on their own: Play moves the people, an order pauses, a reload keeps the month paused, and the run stops itself at year 20', async ({ page }) => {
  await page.uncheck('#grow');
  await page.click('#run');
  await expect(page.locator('#said')).toHaveText(
    'The clock is on this city at year 0 of 20. What you place now is an order for the 10 crews. When your orders are in, press Play to let the months run, or Next month to step one.',
  );
  await expect(page.locator('#play')).toHaveText('Play');
  await expect(page.locator('#speedbox')).toBeVisible();
  await expect(page.locator('#peoplenow')).toHaveText('The start of year 1. 50,000 people living in homes for 50,000.');
  await page.selectOption('#speed', 'fast');
  await page.click('#play');
  await expect(page.locator('#play')).toHaveText('Pause');
  await expect(page.locator('#play')).toHaveAttribute('aria-pressed', 'true');
  // Months pass with nothing pressed: the months list grows past three rows, and the people line and the month said
  // have moved off the start (polled, since at Fast a month is 100 ms and no one moment can be pinned).
  await expect.poll(() => page.locator('#monthrows tr').count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('#peoplenow')).not.toContainText('The start of year 1.');
  await expect(page.locator('#said')).toContainText('people in homes for 50,000.');
  // An order placed while the months run pauses them and says so; the month then holds.
  await place(page, 'hood', ['4,0']);
  await expect(page.locator('#said')).toContainText('Ordered: neighborhood.');
  await expect(page.locator('#said')).toContainText('Paused: your order is in. Press Play to carry on.');
  await expect(page.locator('#play')).toHaveText('Play');
  const held = await page.locator('#peoplenow').textContent();
  await page.waitForTimeout(400);
  await expect(page.locator('#peoplenow')).toHaveText(held ?? '');
  // The timer is in memory only: a reload opens the run paused in the same month, and Play is there to carry on.
  await page.reload();
  await expect(page.locator('#peoplenow')).toHaveText(held ?? '');
  await expect(page.locator('#play')).toHaveText('Play');
  await page.waitForTimeout(400);
  await expect(page.locator('#peoplenow')).toHaveText(held ?? '');
  // Years pass by the tap to the last one; Play runs its twelve months and stops itself at the horizon.
  for (let y = 1; y < 20; y++) await page.click('#tick');
  await expect(page.locator('#clocknow')).toContainText('Year 19 of 20.');
  await expect(page.locator('#play')).toBeVisible();
  await page.click('#play');
  await expect(page.locator('#clocknow')).toContainText('Year 20. The run is over.', { timeout: 30000 });
  await expect(page.locator('#said')).toContainText('The 20 years are up.');
  await expect(page.locator('#play')).toBeHidden();
  await expect(page.locator('#speedbox')).toBeHidden();
  await expect(page.locator('#month')).toBeDisabled();
  await expect(page.locator('#recordrows tr')).toHaveCount(21);
  // One undo goes back to where Play was pressed: the start of year 20, not one month.
  await page.click('#undo');
  await expect(page.locator('#clocknow')).toContainText('Year 19 of 20.');
  await expect(page.locator('#peoplenow')).toContainText('The start of year 20.');
});

test("the site from the air: the ledger's city as 36 blocks of 238 stories on a canvas, painted, and the map comes back", async ({ page }) => {
  await expect(page.locator('#angledcanvas')).toBeHidden();
  await expect(page.locator('#angled')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#angled');
  await expect(page.locator('#said')).toHaveText('The site from the air. Back to the map returns.');
  await expect(page.locator('#angled')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#angledcanvas')).toBeVisible();
  await expect(page.locator('#board')).toBeHidden();
  // What was painted is the scene: 14 strips of line, 10 neighborhoods, 8 ring buildings and 4 plants, their stories summed.
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-blocks', '36');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-stories', '238');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lod', 'far');
  await expect(page.locator('#viewbar')).toBeVisible();
  await expect(page.locator('#viewtext')).toHaveText('The site from the air: 36 blocks, 238 stories in all.');
  await expect(page.locator('#levels')).toBeHidden();
  // The canvas is painted: a good share of its pixels are not the empty ground.
  const painted = await page.evaluate(() => {
    const c = document.getElementById('angledcanvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let on = 0;
    for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) on++;
    return on / (data.length / 4);
  });
  expect(painted).toBeGreaterThan(0.05);
  // Back to the map, by the view bar.
  await page.click('#back');
  await expect(page.locator('#angledcanvas')).toBeHidden();
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#viewbar')).toBeHidden();
  await expect(page.locator('#angled')).toHaveAttribute('aria-pressed', 'false');
  // A cleared site from the air has nothing to paint; pressing the button again returns to the map.
  await page.click('#clear');
  await page.click('#angled');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-blocks', '0');
  await expect(page.locator('#viewtext')).toHaveText('The site from the air. Nothing stands yet.');
  await page.click('#angled');
  await expect(page.locator('#viewbar')).toBeHidden();
  await expect(page.locator('#board')).toBeVisible();
});

test('the site from the air follows the clock: scaffolds for what is ordered, blocks as the crews finish, homes lit as people arrive (ADR-0012, ADR-0009)', async ({ page }) => {
  await page.uncheck('#grow');
  await page.click('#found');
  await place(page, 'power', ['3,-1', '3,-1']);
  await place(page, 'water', ['3,-2']);
  await place(page, 'sewage', ['-3,1']);
  await place(page, 'waste', ['-3,2']);
  await place(page, 'hood', ['1,0', '2,-1']);
  await page.click('#angled');
  // Year 0: six tiles on order, nothing standing.
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-sites', '6');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-blocks', '6');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-stories', '0');
  await expect(page.locator('#viewtext')).toHaveText('The site from the air: 6 blocks, 0 stories in all. 6 tiles under construction.');
  // Year 2: the plants' units and the two neighborhoods stand, empty, waiting for power; the reactor site is still building.
  await page.click('#tick');
  await page.click('#tick');
  await expect(page.locator('#angledcanvas')).toBeVisible();
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-sites', '1');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-stories', '12');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lit', '0.00');
  await expect(page.locator('#viewtext')).toContainText('1 tile under construction. 0% of the homes are lit.');
  // Year 3: both modules open and the first 400 move in, into one of the two neighborhoods.
  await page.click('#tick');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-sites', '0');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-stories', '14');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lit', '0.04');
  await expect(page.locator('#viewtext')).toHaveText('The site from the air: 6 blocks, 14 stories in all. 4% of the homes are lit.');
  // A month later more have come, and the view, still from the air, shows it.
  await page.click('#month');
  const lit = Number(await page.locator('#angledcanvas').getAttribute('data-lit'));
  expect(lit).toBeGreaterThan(0.04);
  await expect(page.locator('#angled')).toHaveAttribute('aria-pressed', 'true');
});

test('the viewer from the air: nearer shows rows then homes, a turn and a tilt repaint, a month repaints only what moved, a drag slides, fit returns', async ({ page }) => {
  await page.click('#angled');
  await expect(page.locator('#aircontrols')).toBeVisible();
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lod', 'far');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-repaint', 'full');
  await expect(page.locator('#air-out')).toBeDisabled();
  await expect(page.locator('#air-tilt')).toHaveText('Tilt: mid');
  // Nearer, four times: the rows of townhouses; three more: every home.
  for (let i = 0; i < 4; i++) await page.click('#air-in');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lod', 'mid');
  await expect(page.locator('#air-out')).toBeEnabled();
  for (let i = 0; i < 3; i++) await page.click('#air-in');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lod', 'near');
  const scaleNear = Number(await page.locator('#angledcanvas').getAttribute('data-scale'));
  expect(scaleNear).toBeGreaterThanOrEqual(1);
  const facesNear = Number(await page.locator('#angledcanvas').getAttribute('data-faces'));
  const blocksNear = Number(await page.locator('#angledcanvas').getAttribute('data-blocks'));
  expect(blocksNear).toBeGreaterThan(20000);
  expect(facesNear).toBeLessThan(3 * blocksNear);
  // A turn and a tilt each repaint the whole frame.
  await page.click('#air-turn');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-repaint', 'full');
  await page.click('#air-tilt');
  await expect(page.locator('#air-tilt')).toHaveText('Tilt: high');
  // A drag slides the site: the scale holds (read after the tilt, which refits), the frame is painted again.
  const scaleTilted = Number(await page.locator('#angledcanvas').getAttribute('data-scale'));
  const box = await page.locator('#angledcanvas').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 3 });
  await page.mouse.up();
  expect(Number(await page.locator('#angledcanvas').getAttribute('data-scale'))).toBeCloseTo(scaleTilted, 2);
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-repaint', 'full');
  // Fit: the whole site again, far.
  await page.click('#air-fit');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-lod', 'far');
  await expect(page.locator('#air-out')).toBeDisabled();
  // On the clock, a month where only who lives where changed repaints a region, or nothing when nobody moved;
  // starting the clock on a city with nothing on order changes nothing visible, so nothing is repainted.
  await page.uncheck('#grow');
  await page.click('#run');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-repaint', 'none');
  await page.click('#month');
  const repaint = await page.locator('#angledcanvas').getAttribute('data-repaint');
  expect(['region', 'none']).toContain(repaint);
  await page.click('#air-turn');
  await expect(page.locator('#angledcanvas')).toHaveAttribute('data-repaint', 'full');
});

test('the city grows itself: from nothing, Play founds it, the work in hand says what the city ordered, a veto holds, a player\'s order still pauses, and undo returns to Play (ADR-0015)', async ({ page }) => {
  // The control is on by default and greyed in the yearly mode.
  await expect(page.locator('#grow')).toBeChecked();
  await page.check('#yearly');
  await expect(page.locator('#grow')).toBeDisabled();
  await page.uncheck('#yearly');
  await expect(page.locator('#grow')).toBeEnabled();
  await page.click('#found');
  await expect(page.locator('#said')).toContainText('Press Play and the city founds itself');
  await expect(page.locator('#said')).toContainText('The city orders what it needs as people arrive; Cancel on the work in hand vetoes an order.');
  await expect(page.locator('#growbox')).toBeHidden();
  // One month: the first neighborhood is ordered with nothing placed by hand, and nothing pauses.
  await page.click('#month');
  await expect(page.locator('#said')).toContainText('The city ordered a neighborhood for the people arriving.');
  await expect(page.locator('#work li')).toHaveCount(1);
  await expect(page.locator('#work li').first()).toHaveClass('inferred');
  await expect(page.locator('#work li').first()).toContainText('ordered by the city');
  await expect(page.locator('#monthrows tr').first().locator('td').last()).toHaveText('neighborhood');
  // The next month the needs follow it: the ring, the plants, the schools, the line, and another neighborhood.
  await page.click('#month');
  await expect(page.locator('#said')).toContainText('The city ordered');
  await expect(page.locator('#said')).toContainText('for a ring');
  await expect(page.locator('#said')).toContainText('for the mover line');
  await expect.poll(() => page.locator('#work li').count()).toBeGreaterThan(10);
  // Cancel on one of the city's orders is a veto: it goes and says so; the rest stay.
  const before = await page.locator('#work li').count();
  const water = page.locator('#work li', { hasText: 'Water plant unit' }).first();
  await water.locator('button', { hasText: 'Cancel' }).click();
  await expect(page.locator('#said')).toContainText('Vetoed: water plant unit. The city will not order it there again; order it yourself to lift the veto.');
  await expect(page.locator('#work li')).toHaveCount(before - 1);
  // Play: the months run, the city builds itself and nothing pauses; the player's own order still pauses.
  await page.selectOption('#speed', 'fast');
  await page.click('#play');
  await expect(page.locator('#play')).toHaveText('Pause');
  // Two neighborhoods can open in one year, so the homes are watched leaving zero rather than reaching one figure.
  await expect(page.locator('#clocknow')).not.toContainText('Homes for 0 people', { timeout: 30000 });
  await expect(page.locator('#play')).toHaveText('Pause');
  await place(page, 'hood', ['4,0']);
  await expect(page.locator('#said')).toContainText('Ordered: neighborhood.');
  await expect(page.locator('#said')).toContainText('Paused: your order is in. Press Play to carry on.');
  await expect(page.locator('#play')).toHaveText('Play');
  // Undo twice: the player's order, then the whole Play, back to where Play was pressed, the city's orders with it.
  await page.click('#undo');
  await page.click('#undo');
  await expect(page.locator('#clocknow')).toContainText('Year 0 of 20. Homes for 0 people.');
  await expect(page.locator('#peoplenow')).toContainText('Year 1, month 2 of 12.');
  // A reload keeps the city growing itself: the months still say what the city ordered, and the control stays hidden.
  await page.reload();
  await expect(page.locator('#peoplenow')).toContainText('Year 1, month 2 of 12.');
  await page.click('#monthbox summary');
  await expect(page.locator('#orderedcol')).toBeVisible();
  await expect(page.locator('#monthrows tr').first().locator('td').last()).toHaveText('neighborhood');
  await expect(page.locator('#growbox')).toBeHidden();
  await expect(page.locator('#play')).toHaveText('Play');
  await page.click('#month');
  await expect(page.locator('#said')).toContainText('The city ordered');
});
