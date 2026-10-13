// Does the shape of the mover line matter? The 100,000 city as spokes only, then with a loop through the second ring of tiles.
const fs = require('fs'), vm = require('vm');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../ledger/model.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/engine.js', 'utf8') + '\nthis.G = CityGame;', ctx);
const G = ctx.G;
let s = G.starter(), from = null;
const click = (tool, k) => { const res = G.act(s, tool, k, from); s = res.state; if (tool === 'line') from = res.from; };
const line = (a, b) => { from = null; click('line', a); click('line', b); };
const add = [['2,0', '1,0'], ['2,-2', '1,-1'], ['1,-2', '1,-1'], ['0,-2', '0,-1'], ['-2,0', '-1,0'], ['-2,2', '-1,1'], ['-1,2', '-1,1'], ['0,2', '0,1'], ['3,0', '2,0'], ['-3,0', '-2,0']];
for (const [k, via] of add) { click('hood', k); line(via, k); click('elementary', k); }
for (const k of ['2,-2', '-2,2', '2,0']) click('middle', k);
for (const k of ['0,-2', '0,2']) click('high', k);
for (const k of ['2,-2', '-2,2']) click('fields', k);
for (let i = 0; i < 8; i++) click('ring', '0,0');
click('power', '3,-1'); click('water', '3,-2'); click('sewage', '-3,1'); click('waste', '-3,2');
const show = label => { const ev = G.evaluate(s, null), sc = ev.score; console.log(label.padEnd(26), '| holds', ev.rules.filter(r => r.status === 'ok').length, 'of', ev.rules.length, '| movers', Math.round(sc.fleet), '(' + (1000 * sc.fleet / sc.pop).toFixed(1) + ' per 1,000)', '| ride door to door', sc.door.toFixed(1), 'min', '| mover line', sc.moverKm.toFixed(1), 'km', '| foot+bike', (100 * (sc.foot + sc.bike)).toFixed(1) + '%'); };
show('spokes only');
const loop = ['2,0', '2,-1', '2,-2', '1,-2', '0,-2', '-1,-1', '-2,0', '-2,1', '-2,2', '-1,2', '0,2', '1,1', '2,0'];
for (let i = 0; i + 1 < loop.length; i++) line(loop[i], loop[i + 1]);
show('spokes and a loop');
