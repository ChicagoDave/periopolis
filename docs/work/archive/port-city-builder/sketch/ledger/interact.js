// Drive the page the way a reader would: turn the dials, move a need, reload, reset, copy.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) problems.push('console: ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  await page.goto('file://' + __dirname + '/preview.html'); await page.waitForTimeout(400);
  const row = label => page.evaluate(l => {
    const r = Array.from(document.querySelectorAll('#ledger .row')).find(x => x.querySelector('.label').textContent === l);
    return r ? Array.from(r.querySelectorAll('.val')).map(c => { const i = c.querySelector('input'); return i ? i.value : c.textContent; }).join(' | ') : 'MISSING';
  }, label);
  const need = id => page.evaluate(i => { const s = document.getElementById('need-' + i + '-tier'); const tr = s.closest('tr'); return Array.from(tr.children).slice(4).map(c => c.textContent).join(' ; '); }, id);
  const stretch = () => page.evaluate(() => Array.from(document.querySelectorAll('#stretch tbody tr')).map(tr => Array.from(tr.children).map(c => c.textContent).join(' ; ')).join('\n    '));
  const anyBad = () => page.evaluate(() => Array.from(document.querySelectorAll('#ledger .val, #sum .val, td')).filter(c => c.textContent.includes('NaN') || c.textContent.includes('Infinity') || c.textContent.includes('undefined')).map(c => c.textContent.slice(0, 40)));
  const show = async (title, labels) => { console.log('\n# ' + title); for (const l of labels) console.log('  ' + l + ' => ' + await row(l)); const bad = await anyBad(); if (bad.length) console.log('  BAD CELLS: ' + bad.join(' / ')); };
  const KEY = ['People a center has', 'Farthest walk to the center', 'Ring buildings', 'On foot', 'By vehicle', 'Door to door, average ride', 'Vehicles', 'Mover stops', 'Sub level to build'];

  await show('defaults', KEY); console.log('  elementary: ' + await need('elementary')); console.log('  stretch:\n    ' + await stretch());

  await page.fill('#in-neu-band', '0');
  await show('no stretch band', KEY); console.log('  elementary: ' + await need('elementary')); console.log('  doctor: ' + await need('doctor')); console.log('  stretch:\n    ' + await stretch());
  await page.fill('#in-neu-band', '20');

  await page.fill('#in-neu-stopsPerCenter', '33');
  await show('a mover stop at every entry', ['Farthest walk to a stop', 'On foot', 'By vehicle', 'Trips that want a ride and have none to take', 'Door to door, average ride', 'Vehicles', 'Mover stops', 'Sub-level walkway, entries to stops', 'Mover line, linking the stops', 'Sub level to build']);
  await page.fill('#in-neu-stopsPerCenter', '1');

  await page.fill('#in-neu-longWalkMin', '15');
  await show('school and work at 15 minutes', ['Homes inside the walk to work in the middle', 'People the city holds before the rim is past that walk', 'On foot', 'By vehicle']); console.log('  stretch:\n    ' + await stretch());
  await page.fill('#in-neu-longWalkMin', '30');

  await page.selectOption('#need-urgent-tier', 'center');
  await show('urgent care in every center', ['People the hungriest daily need wants', 'People a center has', 'Centers in the city', 'Farthest walk to the center', 'On foot']);
  await page.selectOption('#need-urgent-tier', 'district');

  for (const id of ['bakery', 'butcher', 'dining', 'doctor']) await page.selectOption('#need-' + id + '-tier', 'out');
  await show('nothing hungry on the daily list', ['People the hungriest daily need wants', 'People a center has', 'Farthest walk to the center']); console.log('  stretch:\n    ' + await stretch());

  await page.reload(); await page.waitForTimeout(300);
  console.log('\n# after a reload: bakery tier = ' + await page.inputValue('#need-bakery-tier'));
  await page.fill('#in-shared-pop', '1000');
  await show('a city of 1,000', KEY); console.log('  stretch:\n    ' + await stretch());
  await page.fill('#in-shared-pop', '5000000');
  await show('a city of 5 million', KEY);

  await page.click('#reset'); await page.waitForTimeout(100);
  await show('after reset', ['Population', 'People a center has', 'On foot', 'Vehicles', 'Sub level to build']); console.log('  elementary: ' + await need('elementary'));
  await page.click('#copy'); await page.waitForTimeout(200);
  let text = '';
  try { text = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { text = await page.inputValue('#dump'); }
  require('fs').writeFileSync('copied.txt', text);
  console.log('  said: ' + await page.textContent('#said') + ' | copied ' + text.split('\n').length + ' lines');
  console.log('\nproblems: ' + (problems.length ? problems.join('\n') : 'none'));
  await browser.close();
})();
