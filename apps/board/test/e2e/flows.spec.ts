/**
 * @file The Board's six flows in a browser, on the built page: the opening city, two far neighborhoods, a founding run
 * through year 3, the ledger's city run to year 20, undo and storage, and a tile's ground zoomed into at both levels.
 * Owner context: Board (adapter), tests.
 */
import { planNeighborhood, planRing } from '@city/ground';
import { RATES } from '@city/site';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const url = `file://${join(here, '../../dist/index.html')}`;

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
  await page.locator('#work button[id^="first-"]').last().click();
  await expect(page.locator('#said')).toHaveText('Playing fields goes first. Whatever lost its crew keeps the work done on it.');
  await page.click('#tool-inspect');
  await tile(page, '1,0').click();
  await expect(page.locator('#inspector h2')).toHaveText('Building site');
  await expect(page.locator('#board .tile.site')).toHaveCount(7);
  await page.click('#tick');
  await page.click('#tick');
  await expect(page.locator('#clocknow')).toContainText('Year 3 of 20.');
  await expect(page.locator('#clocknow')).toContainText('Homes for 10,000 people.');
  await page.click('#yr-2');
  await expect(page.locator('#said')).toContainText('Year 2:');
  await page.click('#stop');
  await expect(page.locator('#said')).toHaveText('The clock is stopped. Work in hand was finished at once.');
  await expect(page.locator('#clocknow')).toHaveText('The clock is stopped. What you place is built at once.');
});

test("the ledger's city run to year 20 records every year, survives a reload and exports its clock", async ({ page }) => {
  await page.click('#run');
  await expect(page.locator('#clocknow')).toContainText('Year 0 of 20.');
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
  // The site is a rectangle of 115 tiles (ADR-0006), drawn inside one outline.
  await expect(page.locator('#board .tile')).toHaveCount(115);
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
  await expect(page.locator('#board .tile')).toHaveCount(115);
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
