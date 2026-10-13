// Can the first challenge be met? Grow the starter to 100,000 people and see which lines hold.
const fs = require('fs'), vm = require('vm');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../ledger/model.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/engine.js', 'utf8') + '\nthis.G = CityGame;', ctx);
const G = ctx.G;
let s = G.starter(), from = null, moves = 0;
const click = (tool, k) => { const res = G.act(s, tool, k, from); s = res.state; if (tool === 'line') from = res.from; if (res.changed) moves++; else if (tool !== 'line') console.log('  no change:', tool, k, res.said); };
const line = (a, b) => { from = null; click('line', a); click('line', b); };
const report = label => {
  const ev = G.evaluate(s, null), sc = ev.score;
  console.log('\n== ' + label + ' ==  pop', sc.pop, '| moves so far', moves);
  for (const r of ev.rules) if (r.status !== 'ok') console.log('  ' + r.status.toUpperCase(), r.title, '::', r.detail);
  for (const t of ev.tests) if (t.gives.length) console.log('  STRETCH', t.label, '->', t.gives.map(g => g.title + ' (' + g.detail + ')').join(' | '));
  console.log('  foot+bike', (100 * (sc.foot + sc.bike)).toFixed(1) + '%', 'ride', (100 * sc.ride).toFixed(1) + '%', '| movers', Math.round(sc.fleet), '| door', sc.door.toFixed(1), '| acres', Math.round(sc.acres), 'car', Math.round(sc.car.acres), '| sub level km', sc.subLevelKm.toFixed(0));
  return ev;
};
report('starter');
// eight more in the second ring of tiles, two in the third
const add = [['2,0', '1,0'], ['2,-2', '1,-1'], ['1,-2', '1,-1'], ['0,-2', '0,-1'], ['-2,0', '-1,0'], ['-2,2', '-1,1'], ['-1,2', '-1,1'], ['0,2', '0,1'], ['3,0', '2,0'], ['-3,0', '-2,0']];
for (const [k, via] of add) { click('hood', k); line(via, k); }
report('twenty neighborhoods, lines only');
for (const [k] of add) click('elementary', k);
for (const k of ['2,-2', '-2,2', '2,0']) click('middle', k);
for (const k of ['0,-2', '0,2']) click('high', k);
for (const k of ['2,-2', '-2,2']) click('fields', k);
for (let i = 0; i < 8; i++) click('ring', '0,0');
click('power', '3,-1'); click('water', '3,-2'); click('sewage', '-3,1'); click('waste', '-3,2');
const ev = report('twenty neighborhoods, fitted out');
console.log(ev.rules.every(r => r.status === 'ok') ? '\n100,000: every line holds' : '\n100,000: NOT YET CLEAN');
console.log('tests on spokes:', ev.tests.map(t => t.id + '=' + (t.gives.length ? 'gives' : 'holds')).join(' '));
// a second way to every stop: the inner loop, the outer loop, and a second stretch to each plant and far neighborhood
const inner = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
for (let i = 0; i < 6; i++) line(inner[i], inner[(i + 1) % 6]);
const outer = ['2,0', '2,-1', '2,-2', '1,-2', '0,-2', '-1,-1', '-2,0', '-2,1', '-2,2', '-1,2', '0,2', '1,1'];
for (let i = 0; i < 12; i++) line(outer[i], outer[(i + 1) % 12]);
line('3,-1', '3,-2'); line('-3,1', '-3,2'); line('3,0', '3,-1'); line('-3,0', '-3,1');
const ev2 = report('the same, with loops');
console.log('tests with loops:', ev2.tests.map(t => t.id + '=' + (t.gives.length ? 'gives' : 'holds')).join(' '), '| bridges left:', G.bridges(s).length, '| mover line km', ev2.score.moverKm.toFixed(1));
console.log(ev2.rules.every(r => r.status === 'ok') && ev2.tests.every(t => !t.gives.length) ? '\n100,000: every line holds and all four stretch tests hold' : '\n100,000 WITH LOOPS: NOT YET CLEAN');
