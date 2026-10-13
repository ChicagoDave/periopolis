// One pass: play the builder and the clock in a browser, record what the page says, and take the pictures to look at.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + __dirname + '/preview.html';
  const problems = [];
  const watch = (page, name) => {
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) problems.push(name + ' console: ' + m.text()); });
    page.on('pageerror', e => problems.push(name + ' pageerror: ' + e.message));
  };
  const overflow = async (page, name) => { const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); console.log(name, d.sw > d.cw ? 'HORIZONTAL OVERFLOW ' + JSON.stringify(d) : 'no overflow'); };
  const tile = (page, k) => page.locator('#board .tile[data-k="' + k + '"]');
  const text = (page, sel) => page.textContent(sel);
  const place = async (page, tool, keys) => { await page.click('#tool-' + tool); for (const k of keys) await tile(page, k).click(); };

  // desktop, light: the builder as before
  const d = await (await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'light' })).newPage();
  watch(d, 'desktop');
  await d.goto(url); await d.waitForTimeout(500);
  await overflow(d, 'desktop');
  console.log('start:', await text(d, '#tally'), '| clock:', await text(d, '#clocknow'));
  console.log('tests:', await d.evaluate(() => Array.from(document.querySelectorAll('#tests li')).map(li => li.querySelector('.chip').textContent + ' ' + li.querySelector('.title').textContent).join(' | ')));
  await d.click('#test-closure'); await d.waitForTimeout(100);
  console.log('closure shown:', await text(d, '#bannertext'), '|', await text(d, '#tally'));
  await d.click('#today');

  // found a city from nothing: orders, three years, a building site, the work list
  await d.click('#found'); await d.waitForTimeout(100);
  console.log('founded:', await text(d, '#said'));
  await place(d, 'power', ['3,-1', '3,-1']); await place(d, 'water', ['3,-2']); await place(d, 'sewage', ['-3,1']); await place(d, 'waste', ['-3,2']);
  await place(d, 'ring', ['0,0']); await place(d, 'line', ['0,0', '1,0', '2,-1', '3,-1']);
  console.log('after orders:', await text(d, '#worknow'), '|', await text(d, '#said'));
  await d.click('#tick'); await d.waitForTimeout(80);
  console.log('year 1:', await text(d, '#said'));
  await place(d, 'hood', ['1,0', '2,-1']); await place(d, 'elementary', ['1,0', '2,-1']); await place(d, 'middle', ['1,0']); await place(d, 'high', ['2,-1']); await place(d, 'fields', ['2,-1']);
  await place(d, 'line', ['2,-1', '3,-2']); await place(d, 'line', ['0,0', '-1,1', '-2,1', '-3,1']); await place(d, 'line', ['-2,1', '-3,2']);
  console.log('more orders:', await text(d, '#worknow'));
  const firstBtn = d.locator('#work button[id^="first-"]').last();
  if (await firstBtn.count()) { await firstBtn.click(); console.log('first:', await text(d, '#said')); }
  await tile(d, '1,0').click(); await d.click('#tool-inspect'); await tile(d, '1,0').click();
  console.log('site inspector:', (await text(d, '#inspector')).slice(0, 160));
  await d.screenshot({ path: 'c-desktop-founding.png', fullPage: true });
  await d.click('#tick'); await d.click('#tick'); await d.waitForTimeout(80);
  console.log('year 3:', await text(d, '#said'), '| clock:', await text(d, '#clocknow'));
  await d.click('#yr-2'); console.log('year 2 cell:', await text(d, '#said'));
  await d.click('#undo'); console.log('undo:', await text(d, '#clocknow'));
  await d.click('#stop'); console.log('stopped:', await text(d, '#said'), '|', await text(d, '#tally'));

  // run the ledger's city until a closure is announced, then to the end
  await d.click('#starter'); await d.click('#run'); await d.waitForTimeout(80);
  let shot = false;
  for (let y = 1; y <= 20; y++) {
    await d.click('#tick');
    if (!shot && await d.locator('#notices button').count()) { shot = true; await d.locator('#notices button').first().click(); await d.waitForTimeout(60); console.log('closure announced in year', y, ':', await text(d, '#notices')); await d.screenshot({ path: 'c-desktop-run.png' }); }
  }
  console.log('end of run:', await text(d, '#clocknow'), '| tick disabled:', await d.isDisabled('#tick'));
  console.log('strip:', await d.evaluate(() => Array.from(document.querySelectorAll('.yr')).map(b => b.querySelector('.m').textContent || '.').join('')));
  await d.click('#recordbox summary'); await d.waitForTimeout(60);
  console.log('record rows:', await d.locator('#recordrows tr').count());
  await d.click('#copy'); await d.waitForTimeout(150);
  console.log('export has clock:', (await d.inputValue('#dump')).includes('CLOCK'));
  await d.reload(); await d.waitForTimeout(300);
  console.log('after reload:', await text(d, '#said'), '|', await text(d, '#clocknow'));
  await overflow(d, 'desktop at the end');

  // phone, dark: the clock card and a run under way
  const p = await (await browser.newContext({ viewport: { width: 400, height: 860 }, colorScheme: 'dark', deviceScaleFactor: 2, hasTouch: true })).newPage();
  watch(p, 'phone');
  await p.goto(url); await p.waitForTimeout(500);
  await p.tap('#run');
  for (let y = 1; y <= 7; y++) await p.tap('#tick');
  await p.tap('#tool-hood'); await tile(p, '2,0').tap(); await p.tap('#tool-line'); await tile(p, '1,0').tap(); await tile(p, '2,0').tap();
  await overflow(p, 'phone');
  const y = await p.evaluate(() => document.getElementById('boardscroll').getBoundingClientRect().top + window.scrollY);
  await p.evaluate(v => window.scrollTo(0, v - 10), y); await p.waitForTimeout(100);
  await p.screenshot({ path: 'c-phone-board.png' });
  const y2 = await p.evaluate(() => document.getElementById('clock').getBoundingClientRect().top + window.scrollY);
  await p.evaluate(v => window.scrollTo(0, v - 10), y2); await p.waitForTimeout(100);
  await p.screenshot({ path: 'c-phone-clock.png' });
  console.log('problems:', problems.length ? problems.join('\n') : 'none');
  await browser.close();
})();
