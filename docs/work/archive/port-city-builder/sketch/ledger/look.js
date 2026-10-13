const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + __dirname + '/preview.html';
  const problems = [];
  for (const v of [{ name: 'desktop-light', w: 1280, h: 900, scheme: 'light' }, { name: 'phone-dark', w: 400, h: 800, scheme: 'dark' }]) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: v.scheme });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) problems.push(v.name + ' console: ' + m.text()); });
    page.on('pageerror', e => problems.push(v.name + ' pageerror: ' + e.message));
    await page.goto(url); await page.waitForTimeout(600);
    const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
    console.log(v.name, JSON.stringify(dims), dims.sw > dims.cw ? 'HORIZONTAL OVERFLOW' : 'no overflow');
    const wide = await page.evaluate(() => Array.from(document.querySelectorAll('.scroll')).filter(s => s.scrollWidth > s.clientWidth + 1).map(s => (s.querySelector('table') || {}).id || (s.querySelector('table') || {}).className || '?'));
    console.log(v.name, 'tables that scroll sideways:', wide.length ? wide.join(', ') : 'none');
    if (v.name === 'desktop-light') {
      const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#ledger .row')).map(r => {
        const read = c => { const i = c.querySelector('input'); const n = c.querySelector('.num'); const a = c.querySelector('.alt'); return (i ? i.value : n ? n.textContent : c.childNodes[0] ? c.childNodes[0].textContent : c.textContent) + (a && a.textContent ? ' (' + a.textContent + ')' : ''); };
        return r.querySelector('.label').textContent + ' => ' + Array.from(r.querySelectorAll('.val')).map(read).join(' | ');
      }));
      console.log(rows.join('\n'));
      const tables = await page.evaluate(() => ['sum', 'harm', 'stretch', 'checks', 'walk', 'scale'].map(id => id + ':\n' + Array.from(document.querySelectorAll('#' + id + ' tr, #' + id + ' .row')).map(tr => Array.from(tr.children).slice(0, 13).map(c => c.textContent.slice(0, 150)).join(' ; ')).join('\n')).join('\n---\n'));
      console.log(tables);
      const needs = await page.evaluate(() => Array.from(document.querySelectorAll('table.needs tbody tr.set')).map(tr => Array.from(tr.children).slice(0, 7).map(c => { const s = c.querySelector('select'); const i = c.querySelector('input'); return s ? s.value : i ? i.value : c.textContent.slice(0, 60); }).join(' ; ')).join('\n'));
      console.log('needs:\n' + needs);
    }
    await ctx.close();
  }
  console.log('problems:', problems.length ? problems.join('\n') : 'none');
  await browser.close();
})();
