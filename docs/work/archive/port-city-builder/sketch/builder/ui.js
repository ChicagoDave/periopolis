// Draws the board and its panels, and turns clicks into moves. The rules live in the engine, time in the clock.
(() => {
  const G = CityGame, C = CityClock, KEY = 'future-city-builder-v1', SVGNS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function svg(tag, attrs, cls) {
    const n = document.createElementNS(SVGNS, tag);
    if (cls) n.setAttribute('class', cls);
    if (attrs) for (const a of Object.keys(attrs)) n.setAttribute(a, attrs[a]);
    return n;
  }
  const fmt = (x, d = 0) => Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: d }) : '–';
  const pct = x => fmt(100 * x) + '%';
  const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
  const low = text => text.charAt(0).toLowerCase() + text.slice(1);

  const TOOLS = [
    { id: 'inspect', group: 'Tools', name: 'Inspect', hint: 'Click a tile to read it.' },
    { id: 'erase', group: 'Tools', name: 'Erase', hint: 'Click a tile to remove what is on it, one building at a time. On open ground it removes the mover line.' },
    { id: 'hood', group: 'On the surface', name: 'Neighborhood', hint: 'Click open ground to found a neighborhood of ' + fmt(G.HOOD) + ' people.' },
    { id: 'ring', group: 'On the surface', name: 'Ring building', hint: 'Click open ground to start a ring. Click a ring to add a 25-story building.' },
    { id: 'elementary', group: 'On the surface', name: 'Elementary school', letter: 'E', hint: 'Click a neighborhood to give it a school of up to 500 pupils. Click again to take it away.' },
    { id: 'middle', group: 'On the surface', name: 'Middle school', letter: 'M', hint: 'Click a neighborhood to give it a school of up to 1,000 pupils. Click again to take it away.' },
    { id: 'high', group: 'On the surface', name: 'High school', letter: 'H', hint: 'Click a neighborhood to give it a school of up to 1,500 pupils. Click again to take it away.' },
    { id: 'fields', group: 'On the surface', name: 'Playing fields', letter: 'F', hint: 'Click a neighborhood to put playing fields beside it. Click again to take them away.' },
    { id: 'line', group: 'On the sub level', name: 'Mover line', hint: 'Click a tile, then a neighbor, to run the mover line between them. Click the same pair again to remove it.' },
    { id: 'power', group: 'At the edge', name: 'Reactor module', hint: 'Click open ground for a reactor site. Click the site to add a ' + G.MODULE_MW + ' MW module.' },
    { id: 'water', group: 'At the edge', name: 'Water plant', hint: 'Click open ground for a water plant. Each click adds a unit for ' + fmt(G.PLANT_SERVES) + ' people.' },
    { id: 'sewage', group: 'At the edge', name: 'Sewage plant', hint: 'Click open ground for a sewage plant. Each click adds a unit for ' + fmt(G.PLANT_SERVES) + ' people.' },
    { id: 'waste', group: 'At the edge', name: 'Waste works', hint: 'Click open ground for a sorting line and digester. Each click adds a unit for ' + fmt(G.PLANT_SERVES) + ' people.' },
  ];
  const LETTER = { elementary: 'E', middle: 'M', high: 'H', fields: 'F' };
  const PLANT_LABEL = { power: 'Power', water: 'Water', sewage: 'Sewage', waste: 'Waste' };
  const SITE_LABEL = { hood: 'Homes', ring: 'Ring', power: 'Power', water: 'Water', sewage: 'Sewage', waste: 'Waste' };
  const STATUS = { ok: 'Holds', warn: 'Watch', bad: 'Broken', idle: 'Not yet' };

  // What stands, and the clock when it is running. Both are replaced, never changed in place, so undo can keep them.
  let state = G.starter(), clock = null;
  let tool = 'inspect', picked = null, lineFrom = null, showing = null, focusKey = '0,0';
  let ev = null, hand = null, news = [];
  let history = [], flash = [], flashTimer = null;

  function save() { try { localStorage.setItem(KEY, JSON.stringify({ tiles: state.tiles, lines: state.lines, clock })); } catch (e) { /* the game plays without storage */ } }
  function restore(raw) {
    const board = raw && typeof raw === 'object' ? G.clean(raw) : null;
    return board ? { state: board, clock: C.clean(raw.clock, board) } : null;
  }
  function load() { try { return restore(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return null; } }
  function say(text) { $('said').textContent = text || ''; }
  const remember = () => { history.push({ state, clock }); if (history.length > 80) history.shift(); };

  // ---- geometry of the drawing ----
  const SIZE = 30, W3 = Math.sqrt(3), PX_KM = SIZE / G.TILE_KM;
  const px = k => { const [q, r] = G.at(k); return [W3 * SIZE * (q + r / 2), 1.5 * SIZE * r]; };
  function hexPoints(cx, cy, s) {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push((cx + s * Math.cos(a)).toFixed(1) + ',' + (cy + s * Math.sin(a)).toFixed(1)); }
    return pts.join(' ');
  }
  const HALF_W = W3 * SIZE * (G.BOARD + 0.5) + 12, HALF_H = 1.5 * SIZE * G.BOARD + SIZE + 12;

  const siteWhen = site => site.status === 'working' ? site.left + ' yr' : 'waits';
  function describe(k) {
    const t = state.tiles[k], info = ev.per[k], site = hand.sites[k];
    if (!t) return site ? 'Building site, ' + SITE_LABEL[site.kind].toLowerCase() + ', ' + (site.status === 'working' ? site.left + (site.left === 1 ? ' year' : ' years') + ' to go' : 'waiting for a crew') : 'Open ground';
    let text = G.NAME[t.kind];
    if (t.kind === 'hood') { const has = G.EXTRAS.filter(x => t.has[x]).map(x => G.NAME[x].toLowerCase()); if (has.length) text += ' with ' + has.join(', '); }
    else if (t.kind === 'ring') text += ' of ' + t.n + (t.n === 1 ? ' building' : ' buildings');
    else text += ', ' + t.n + (t.kind === 'power' ? (t.n === 1 ? ' module' : ' modules') : (t.n === 1 ? ' unit' : ' units'));
    if (info && info.issues.length) text += '. ' + info.issues.length + (info.issues.length === 1 ? ' problem' : ' problems');
    return text;
  }

  function drawBoard() {
    const board = $('board'), hadFocus = board.contains(document.activeElement);
    board.setAttribute('viewBox', [-HALF_W, -HALF_H, 2 * HALF_W, 2 * HALF_H].map(v => v.toFixed(0)).join(' '));
    board.textContent = '';
    // From the ground up: the tiles, the 30-minute circles, the mover line, what stands on each tile, then the labels.
    // Only the tiles take clicks, so nothing drawn above them gets in the way.
    const defs = svg('defs'), hatch = svg('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    hatch.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 6 }, 'hatchline'));
    defs.append(hatch);
    const ground = svg('g'), reach = svg('g', null, 'over'), lines = svg('g', null, 'over'), stands = svg('g', null, 'over'), top = svg('g', null, 'over');
    const rings = Object.keys(state.tiles).filter(k => state.tiles[k].kind === 'ring');
    const text = (x, y, cls, words) => { const n = svg('text', { x, y, 'text-anchor': 'middle' }, cls); n.textContent = words; return n; };
    const badges = (cx, cy, list) => list.forEach((b, i) => {
      const bx = cx + (i - (list.length - 1) / 2) * 11.5, by = cy + 14.5, kind = (b.x === 'fields' ? ' out' : '') + (b.soon ? ' soon' : '');
      stands.append(svg('circle', { cx: bx, cy: by, r: 5 }, 'badge' + kind), text(bx, by + 2.3, 'badgetext' + kind, LETTER[b.x]));
    });

    for (const k of G.allTiles()) {
      const t = state.tiles[k], [cx, cy] = px(k), info = ev.per[k], site = t ? null : hand.sites[k], ordered = hand.extras[k] || {};
      const cls = ['tile', t ? t.kind : site ? 'site' : 'open'];
      if (info && info.level) cls.push(info.level);
      if (k === picked) cls.push('picked');
      if (k === lineFrom && tool === 'line') cls.push('from');
      if (flash.includes(k)) cls.push('flash');
      const g = svg('g', { 'data-k': k, role: 'button', tabindex: k === focusKey ? '0' : '-1', 'aria-label': describe(k) }, cls.join(' '));
      g.append(svg('polygon', { points: hexPoints(cx, cy, SIZE - 1.3) }, 'hex'));
      ground.append(g);
      if (site) {
        stands.append(text(cx, cy - 2.5, 'sitename', SITE_LABEL[site.kind] + (site.n > 1 ? ' ×' + site.n : '')), text(cx, cy + 6.5, 'sitewhen', siteWhen(site)));
        badges(cx, cy + 1.5, G.EXTRAS.filter(x => ordered[x]).map(x => ({ x, soon: true })));
      }
      if (!t) continue;
      const more = hand.more[k] ? '+' + hand.more[k] : '';
      if (t.kind === 'hood') {
        if (!(info && info.stop)) stands.append(svg('circle', { cx, cy, r: 2.6 }, 'plaza'));
        badges(cx, cy, G.EXTRAS.filter(x => t.has[x] || ordered[x]).map(x => ({ x, soon: !t.has[x] })));
      } else if (t.kind === 'ring') {
        const shown = Math.min(t.n, 14);
        for (let i = 0; i < shown; i++) {
          const a = 2 * Math.PI * i / shown - Math.PI / 2, bx = cx + 16.5 * Math.cos(a), by = cy + 16.5 * Math.sin(a);
          stands.append(svg('rect', { x: (bx - 2.6).toFixed(1), y: (by - 2.6).toFixed(1), width: 5.2, height: 5.2 }, 'bldg'));
        }
        const label = text(cx, cy + 3.5, 'onring', t.n + more);
        if (more) label.setAttribute('style', 'font-size:7px');
        stands.append(svg('circle', { cx, cy, r: more ? 9.6 : 8.6 }, 'hub'), label);
      } else {
        stands.append(text(cx, cy - 7.5, 'plantname', PLANT_LABEL[t.kind]), text(cx, cy + 14.5, 'plantn', '×' + t.n + more));
      }
      if (info && info.level) {
        const my = cy - 16;
        stands.append(svg('polygon', { points: [cx - 4.6, my + 3.4, cx + 4.6, my + 3.4, cx, my - 4.2].map(v => v.toFixed(1)).join(' ') }, 'mark ' + info.level));
      }
    }

    for (const g of rings) {
      const [cx, cy] = px(g), r = G.LONG_KM * PX_KM;
      reach.append(svg('circle', { cx, cy, r: r.toFixed(1) }, 'reach'));
    }
    // the line that stands, with any stretch that is closed this year or will be; then the line on order
    const shut = ev.stress.closed || [], doomed = news.filter(n => n.edge && n.when === 'soon').map(n => n.edge);
    const span = e => { const [a, b] = G.ends(e), [x1, y1] = px(a), [x2, y2] = px(b); return { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), mx: (x1 + x2) / 2, my: (y1 + y2) / 2 }; };
    for (const e of Object.keys(state.lines)) {
      const s = span(e), closed = shut.includes(e), soon = !closed && doomed.includes(e);
      lines.append(svg('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }, 'mover' + (closed ? ' closed' : soon ? ' doomed' : '')));
      if (closed) top.append(svg('circle', { cx: s.mx.toFixed(1), cy: s.my.toFixed(1), r: 5.4 }, 'shutdisc'), svg('path', { d: 'M' + (s.mx - 2.4).toFixed(1) + ' ' + (s.my - 2.4).toFixed(1) + ' l4.8 4.8 m0 -4.8 l-4.8 4.8' }, 'shutmark'));
      else if (soon) top.append(svg('circle', { cx: s.mx.toFixed(1), cy: s.my.toFixed(1), r: 5.4 }, 'shutdisc doomed'), text(s.mx.toFixed(1), (s.my + 2.9).toFixed(1), 'shutsoon', '!'));
    }
    for (const e of Object.keys(hand.lines)) { const s = span(e); lines.append(svg('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }, 'mover soon')); }
    for (const k of Object.keys(state.tiles)) {
      if (!ev.per[k].stop || state.tiles[k].kind === 'ring') continue;
      const [cx, cy] = px(k);
      lines.append(svg('circle', { cx, cy, r: 3.9 }, 'stop'));
    }
    if (rings.length) {
      const [cx, cy] = px(rings[0]);
      const label = text(cx, (cy - G.LONG_KM * PX_KM - 4).toFixed(1), 'reachlabel', '30-minute walk');
      top.append(label);
    }
    // a scale, in the empty corner the hexagon leaves: just left of the bottom row, so a phone's first view includes it
    const half = PX_KM / 2, sx = Number((-W3 * SIZE * (G.BOARD / 2 + 0.5) - 10 - half).toFixed(1)), sy = HALF_H - 16;
    top.append(svg('path', { d: 'M' + sx + ' ' + (sy - 4) + ' V' + sy + ' H' + (sx + half).toFixed(1) + ' V' + (sy - 4) }, 'scalebar'));
    const scale = svg('text', { x: sx, y: sy - 8 }, 'scaletext');
    scale.textContent = '500 m';
    const what = svg('text', { x: sx, y: sy + 11 }, 'scaletext');
    what.textContent = 'one tile: ' + fmt(G.HOOD) + ' people, ' + fmt(G.TILE_ACRES) + ' acres';
    top.append(scale, what);

    board.append(defs, ground, reach, lines, stands, top);
    if (hadFocus) { const again = board.querySelector('[tabindex="0"]'); if (again) again.focus(); }
  }

  // ---- the tray ----
  function swatch(t) {
    const s = svg('svg', { viewBox: '-13 -13 26 26', 'aria-hidden': 'true' });
    if (t.id === 'inspect') { s.append(svg('circle', { cx: -2, cy: -2, r: 6 }, 'glyph'), svg('path', { d: 'M3 3 L9 9' }, 'glyph')); return s; }
    if (t.id === 'erase') { s.append(svg('path', { d: 'M-6 -6 L6 6 M6 -6 L-6 6' }, 'glyph')); return s; }
    if (t.id === 'line') { const l = svg('path', { d: 'M-10 6 L10 -6' }, 'mover'); l.setAttribute('style', 'stroke-width:2.6;stroke-dasharray:5 3'); s.append(l, svg('circle', { cx: -10, cy: 6, r: 2.4 }, 'stop'), svg('circle', { cx: 10, cy: -6, r: 2.4 }, 'stop')); return s; }
    if (t.letter) {
      s.append(svg('circle', { cx: 0, cy: 0, r: 8.5 }, t.id === 'fields' ? 'badge out' : 'badge'));
      const label = svg('text', { x: 0, y: 3.6, 'text-anchor': 'middle', style: 'font: 800 10px var(--display)' }, t.id === 'fields' ? 'badgetext out' : 'badgetext');
      label.textContent = t.letter;
      s.append(label);
      return s;
    }
    const g = svg('g', null, 'tile ' + (t.id === 'ring' ? 'ring' : t.id === 'hood' ? 'hood' : t.id));
    g.append(svg('polygon', { points: hexPoints(0, 0, 11.5) }, 'hex'));
    if (t.id === 'ring') for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; g.append(svg('rect', { x: (6 * Math.cos(a) - 1.4).toFixed(1), y: (6 * Math.sin(a) - 1.4).toFixed(1), width: 2.8, height: 2.8 }, 'bldg')); }
    s.append(g);
    return s;
  }
  const toolButtons = {};
  function buildTray() {
    const tray = $('tray');
    const groups = [];
    for (const t of TOOLS) if (!groups.includes(t.group)) groups.push(t.group);
    for (const name of groups) {
      const box = el('div', 'group'), tools = el('div', 'tools');
      box.append(el('h2', '', name), tools);
      for (const t of TOOLS.filter(x => x.group === name)) {
        const b = el('button', 'tool');
        b.type = 'button'; b.id = 'tool-' + t.id;
        const n = el('span', 'n');
        b.append(swatch(t), el('span', '', t.name), n);
        b.addEventListener('click', () => { tool = t.id; lineFrom = null; say(t.hint); render(); });
        toolButtons[t.id] = { b, n };
        tools.append(b);
      }
      tray.append(box);
    }
  }
  function drawTray() {
    const s = ev.score;
    const counts = {
      hood: s.hoods, ring: s.ringBuildings, elementary: s.schools.elementary, middle: s.schools.middle, high: s.schools.high, fields: s.fields,
      line: fmt(s.moverKm, 1) + ' km', power: s.units.power, water: s.units.water, sewage: s.units.sewage, waste: s.units.waste,
    };
    for (const t of TOOLS) {
      toolButtons[t.id].b.setAttribute('aria-pressed', String(t.id === tool));
      toolButtons[t.id].n.textContent = t.id in counts ? String(counts[t.id]) : '';
    }
    $('board').style.cursor = tool === 'inspect' ? '' : 'crosshair';
  }

  // ---- score ----
  function drawScore() {
    const s = ev.score, c = s.car, box = $('score');
    box.textContent = '';
    const stat = (label, mine, car, tone, carTone) => {
      const d = el('div'), dd = el('dd');
      dd.append(el('span', tone ? 'mine ' + tone : 'mine', mine), el('span', carTone ? 'car ' + carTone : 'car', car));
      d.append(el('dt', '', label), dd);
      box.append(d);
    };
    const t = tally(), noWay = s.stuck + s.nowhere, rising = Object.keys(hand.sites).filter(k => hand.sites[k].kind === 'hood').length;
    stat('Your lines', t.checked ? t.ok + ' of ' + t.checked : '–',
      !t.checked ? 'nothing built yet' : t.bad ? t.bad + ' broken' + (t.warn ? ', ' + t.warn + ' to watch' : '') : t.warn ? t.warn + ' to watch' : 'all hold',
      t.bad ? 'bad' : t.warn ? 'warn' : '');
    stat('People', fmt(s.pop), s.hoods + (s.hoods === 1 ? ' neighborhood' : ' neighborhoods') + (rising ? ', ' + rising + ' being built' : ''));
    stat('Ground taken', fmt(s.acres) + ' acres', c ? 'car city: ' + fmt(c.acres) + ' acres' : 'car city: none yet');
    if (c && noWay > 0.005) stat('Trips on foot or bike', pct(s.foot + s.bike), fmt(100 * noWay, noWay < 0.1 ? 1 : 0) + '% have no way to go', '', 'bad');
    else stat('Trips on foot or bike', s.pop ? pct(s.foot + s.bike) : '–', c ? 'car city: ' + pct(c.foot + c.bike) : ' ');
    stat('Vehicles', fmt(s.fleet) + ' movers', c ? 'car city: ' + fmt(c.vehicles) + ' cars' : ' ');
    stat('Ride, door to door', s.door ? fmt(s.door, 1) + ' min' : '–', c ? 'car city: ' + fmt(c.door, 1) + ' min' : ' ');
    stat('Sub level', fmt(s.subLevelKm) + ' km', fmt(s.pipeKm) + ' km of goods pipe');
  }
  function tally() {
    const t = { ok: 0, warn: 0, bad: 0, idle: 0 };
    for (const r of ev.rules) t[r.status]++;
    t.checked = ev.rules.length - t.idle;
    return t;
  }

  // ---- moves ----
  function button(text, fn, cls) { const b = el('button', cls || 'btn small', text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  // One click with one tool. While the clock runs the click is an order for the crews; otherwise it is built at once.
  function move(toolId, k, from) {
    if (clock) { const r = C.order({ state, clock }, toolId, k, from); return { state: r.game.state, clock: r.game.clock, said: r.said, changed: r.changed, from: r.from }; }
    const r = G.act(state, toolId, k, from);
    return { state: r.state, clock: null, said: r.said, changed: r.changed, from: r.from };
  }
  function commit(res) {
    if (res.changed) { remember(); state = res.state; clock = res.clock; save(); }
    say(res.said);
    render();
  }
  const apply = (toolId, k) => commit(move(toolId, k, null));
  function swap(game, words) { remember(); state = game.state; clock = game.clock; lineFrom = null; save(); render(); say(words); }
  function use(k) {
    focusKey = k; picked = k;
    if (tool === 'inspect') { say(describe(k) + '.'); render(); return; }
    const res = move(tool, k, lineFrom);
    if (tool === 'line') lineFrom = res.from;
    commit(res);
  }

  // ---- the clock ----
  const ruleTitle = id => { const r = ev.rules.find(x => x.id === id); return r ? low(r.title) : id; };
  function yearLine(row) {
    const parts = ['Year ' + row.year + ': ' + fmt(row.pop) + ' people.'];
    if (row.bad) parts.push(row.bad + (row.bad === 1 ? ' line broken: ' : ' lines broken: ') + row.broken.map(ruleTitle).join('; ') + '.');
    else parts.push(row.pop ? 'Every line held.' : 'Nobody lives here yet.');
    if (Object.keys(row.opened).length) parts.push('Opened: ' + C.sentence(row.opened) + '.');
    return parts.join(' ');
  }
  function drawClock() {
    const on = Boolean(clock), over = on && clock.year >= C.YEARS, now = $('clocknow');
    for (const id of ['tick', 'stop', 'years', 'notices', 'keeprule', 'recordbox']) $(id).hidden = !on;
    $('run').hidden = on; $('found').hidden = on;
    now.textContent = '';
    if (!on) { now.textContent = 'The clock is stopped. What you place is built at once.'; return; }
    const last = clock.record[clock.record.length - 1];
    now.append(el('b', '', over ? 'Year ' + C.YEARS + '. The run is over.' : 'Year ' + clock.year + ' of ' + C.YEARS + '.'),
      ' Homes for ' + fmt(last.homes) + ' people. ' + (clock.lineYears ? fmt(clock.lineYears) + (clock.lineYears === 1 ? ' broken line-year' : ' broken line-years') : 'No broken line-years') + (over ? '. Stop the clock to build on.' : ' so far.'));
    $('tick').disabled = over;

    // the twenty years: what each past year was like, where the run stands, and when something announced falls
    const strip = $('years'), rows = {};
    strip.textContent = '';
    for (const r of clock.record) rows[r.year] = r;
    const known = clock.events.filter(e => clock.year >= e.start - e.notice && !(e.type === 'closure' && !e.edge));
    for (let y = 1; y <= C.YEARS; y++) {
      const row = rows[y], li = el('li'), b = el('button', 'yr');
      const falls = known.filter(e => y === e.start);
      b.type = 'button'; b.id = 'yr-' + y;
      if (row) b.classList.add(row.bad ? 'broken' : 'clean');
      if (y === clock.year) b.classList.add('now');
      if (falls.length) b.classList.add('event');
      b.append(el('span', 'n', String(y)), el('span', 'm', row ? (row.bad ? (row.bad > 9 ? '9+' : String(row.bad)) : '✓') : ''));
      const words = (row ? yearLine(row) : 'Year ' + y + ' is still to come.') + (falls.length ? ' Something announced starts in this year.' : '');
      b.setAttribute('aria-label', words);
      b.addEventListener('click', () => say(words));
      li.append(b);
      strip.append(li);
    }

    const list = $('notices');
    list.textContent = '';
    if (!news.length && !over) list.append(el('li', 'quiet', 'Nothing is announced. Whatever comes is announced a year or two ahead.'));
    for (const n of news) {
      const li = el('li', n.when);
      if (n.when === 'now') li.append(el('b', '', 'Now. '));
      li.append(n.text);
      if (n.edge) { const b = button('Show it', () => { highlight(G.ends(n.edge)); say('The two ends of that stretch are marked on the board.'); }); b.id = 'show-' + n.id; li.append(b); }
      list.append(li);
    }
    $('keeprule').hidden = !news.length;

    const body = $('recordrows');
    body.textContent = '';
    for (const r of clock.record) {
      const tr = el('tr');
      tr.append(el('td', 'num', String(r.year)), el('td', 'num', fmt(r.pop)), el('td', '', r.bad ? r.bad + ': ' + r.broken.map(ruleTitle).join('; ') : r.pop ? 'none' : '–'), el('td', '', Object.keys(r.opened).length ? C.sentence(r.opened) : '–'));
      body.append(tr);
    }
  }
  function drawWork() {
    const card = $('workcard'), list = $('work');
    card.hidden = !clock;
    list.textContent = '';
    if (!clock) return;
    $('worknow').textContent = hand.list.length
      ? hand.working + ' of ' + hand.crews + ' crews working' + (hand.waiting ? ', ' + hand.waiting + (hand.waiting === 1 ? ' job' : ' jobs') + ' waiting for a crew.' : '.')
      : 'No work in hand. All ' + hand.crews + ' crews are idle. Place something to give them a job.';
    list.hidden = !hand.list.length;
    for (const j of hand.list) {
      const li = el('li'), label = el('button', 'joblabel'), btns = el('span', 'jobbtns');
      const where = j.what === 'line' ? G.ends(j.at) : [j.at];
      const when = j.status === 'working' ? j.left + (j.left === 1 ? ' year' : ' years') + ' to go' : j.status === 'waiting' ? 'waiting for a crew' : 'done, waits for its ' + (j.what === 'power' ? 'site' : 'homes');
      label.type = 'button'; label.id = 'job-' + j.index;
      label.append(cap(C.NAME[j.what]), el('span', '', when));
      label.addEventListener('click', () => { highlight(where); say(cap(C.NAME[j.what]) + ', ' + when + '. Marked on the board.'); });
      if (j.status === 'waiting') { const b = button('First', () => { remember(); clock = C.first({ state, clock }, j.index).clock; save(); say(cap(C.NAME[j.what]) + ' goes first. Whatever lost its crew keeps the work done on it.'); render(); }); b.id = 'first-' + j.index; btns.append(b); }
      const x = button('Cancel', () => { remember(); clock = C.cancel({ state, clock }, j.index).clock; save(); say('Canceled: ' + C.NAME[j.what] + '.'); render(); });
      x.id = 'cancel-' + j.index;
      btns.append(x);
      li.append(label, btns);
      list.append(li);
    }
  }

  // ---- the tile you picked ----
  function facts(rows) {
    const dl = el('dl', 'facts');
    for (const [a, b, sub] of rows) dl.append(el('dt', sub ? 'sub' : '', a), el('dd', '', b));
    return dl;
  }
  // the typical walk to the stop, the wait, then the ride
  const rideMin = hops => G.IN_TILE + CityModel.defaults.neu.waitMin + hops * G.STEP_KM / CityModel.defaults.neu.rideKmh * 60;
  function extraButtons(k, has) {
    const row = el('div', 'row'), ordered = hand.extras[k] || {};
    row.append(el('span', 'lab', 'In this neighborhood'));
    for (const x of G.EXTRAS) {
      const b = button(G.NAME[x] + (ordered[x] ? ' (on order)' : ''), () => apply(x, k));
      b.setAttribute('aria-pressed', String(Boolean(has[x] || ordered[x])));
      row.append(b);
    }
    return row;
  }

  function drawInspector() {
    const box = $('inspector');
    box.textContent = '';
    if (!picked) {
      box.append(el('h2', '', 'Pick a tile'), el('p', 'quiet', 'Click any tile to read it here: who lives there, where they go to school, and how they reach the ring.'));
      return;
    }
    const t = state.tiles[picked], info = ev.per[picked], site = t ? null : hand.sites[picked], more = hand.more[picked] || 0;
    if (site) {
      box.append(el('h2', '', 'Building site'), facts([[SITE_LABEL[site.kind] + (site.n > 1 ? ', ' + site.n + ' on order' : ''), site.status === 'working' ? site.left + (site.left === 1 ? ' year' : ' years') + ' to go' : 'waiting for a crew']]));
      if (site.kind === 'hood') box.append(extraButtons(picked, {}), el('p', 'quiet', 'A school ordered now opens with the homes.'));
      box.append(button(site.kind === 'hood' ? 'Cancel this neighborhood' : 'Cancel one job here', () => apply('erase', picked)));
      return;
    }
    if (!t) {
      box.append(el('h2', '', 'Open ground'), el('p', 'quiet', fmt(G.TILE_ACRES) + ' acres with nothing on it.'));
      const row = el('div', 'row');
      row.append(el('span', 'lab', 'Build here'));
      for (const id of ['hood', 'ring', 'power', 'water', 'sewage', 'waste']) row.append(button(TOOLS.find(x => x.id === id).name, () => apply(id, picked)));
      box.append(row);
      return;
    }
    box.append(el('h2', '', G.NAME[t.kind]));
    if (t.kind === 'hood') {
      const rows = [['People', fmt(ev.pop1)]];
      if (info.ring) {
        rows.push(['Walk to the ring', fmt(info.ring.walk) + ' min']);
        rows.push(['By mover to the ring', info.ring.segs === null ? 'no line' : fmt(rideMin(info.ring.segs)) + ' min']);
      } else rows.push(['Walk to the ring', 'no ring yet']);
      for (const kind of G.SCHOOLS) {
        const g = info.goes[kind], own = info.schools && info.schools[kind];
        rows.push([G.NAME[kind], g.to.length ? fmt(Math.max(...g.to.map(w => w.minutes))) + ' min walk' : 'no seat in reach']);
        if (g.to.length && g.left > 0.5) rows.push(['with no seat', fmt(g.left) + ' pupils', true]);
        if (own) rows.push(['the school here', fmt(own.load) + ' of ' + fmt(own.cap) + ' seats', true]);
      }
      rows.push(['Playing fields', info.fields ? fmt(info.fields.walk) + ' min walk' : 'none yet']);
      box.append(facts(rows), extraButtons(picked, t.has));
    } else if (t.kind === 'ring') {
      const rows = [
        ['Buildings of 25 stories', String(t.n)],
        ['Offices and halls for', fmt(info.cap) + ' people'],
        ['Nearest to', fmt(info.load) + ' people'],
        ['Buildings that takes', String(info.needs)],
      ];
      if (more) rows.push(['On order', String(more)]);
      box.append(facts(rows));
      const row = el('div', 'row');
      row.append(button('Add a building', () => apply('ring', picked)), button('Remove one', () => apply('erase', picked)));
      box.append(row);
    } else {
      const power = t.kind === 'power';
      const rows = power
        ? [['Modules of ' + G.MODULE_MW + ' MW', String(t.n)], ['City peak', fmt(ev.score.peak) + ' MW'], ['Firm with one module down', fmt(ev.score.firmMW) + ' MW'], ['Modules the city needs', String(ev.score.needModules)]]
        : [['Units', String(t.n)], ['Serves', fmt(t.n * G.PLANT_SERVES) + ' people'], ['The city has', fmt(ev.score.pop)]];
      if (more) rows.push(['On order', String(more)]);
      box.append(facts(rows));
      const row = el('div', 'row');
      row.append(button(power ? 'Add a module' : 'Add a unit', () => apply(t.kind, picked)), button('Remove one', () => apply('erase', picked)));
      box.append(row);
    }
    if (info && info.issues.length) {
      const ul = el('ul', 'issues');
      for (const words of info.issues) ul.append(el('li', info.level === 'warn' ? 'warn' : '', words));
      box.append(ul);
    } else box.append(el('p', 'quiet', info && info.stop ? 'On the mover line. Nothing is broken here.' : 'Nothing is broken here.'));
    if (t.kind === 'hood') box.append(button('Remove this neighborhood', () => apply('erase', picked)));
  }

  // ---- your lines ----
  function highlight(keys) {
    flash = keys.slice();
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flash = []; drawBoard(); }, 2600);
    drawBoard();
  }
  function drawRules() {
    const list = $('rules');
    list.textContent = '';
    for (const r of ev.rules) {
      const li = el('li'), b = el('button', 'rulebtn'), words = el('span');
      b.type = 'button'; b.id = 'rule-' + r.id;
      words.append(el('span', 'title', r.title), el('span', 'ref', r.lines), el('span', 'detail', r.detail));
      b.append(el('span', 'chip ' + r.status, STATUS[r.status]), words);
      b.addEventListener('click', () => { if (r.tiles.length) { highlight(r.tiles); say('Marked on the board: ' + r.tiles.length + (r.tiles.length === 1 ? ' tile.' : ' tiles.')); } else say('Nothing on the board to mark for that line.'); });
      li.append(b);
      list.append(li);
    }
    const line = $('tally'), t = tally();
    line.textContent = '';
    if (!t.checked) line.textContent = 'Nothing to check yet.';
    else line.append(el('b', '', String(t.ok)), ' of ' + t.checked + ' hold' + (t.bad ? ', ' + t.bad + ' broken' : '') + (t.warn ? ', ' + t.warn + ' to watch' : '') + '. Click one to mark its tiles.');
  }
  function drawTests() {
    const list = $('tests');
    list.textContent = '';
    for (const t of ev.tests) {
      const li = el('li'), gives = t.gives.length > 0, empty = ev.today.pop === 0, hard = t.gives.some(g => g.status === 'bad'), closure = t.id === 'closure';
      li.append(el('span', 'chip ' + (empty ? 'idle' : gives ? (hard ? 'bad' : 'warn') : 'ok'), empty ? 'Not yet' : gives ? 'Gives' : 'Holds'), el('span', 'title', cap(t.label)));
      let detail;
      if (empty) detail = 'Nothing to stretch yet.';
      else if (gives) detail = 'First to give: ' + low(t.gives[0].title) + '. ' + t.gives[0].detail + (closure ? ' ' + t.weak + ' of the ' + t.lines + (t.lines === 1 ? ' stretch' : ' stretches') + ' of line ' + (t.weak === 1 ? 'has' : 'have') + ' no way round.' : '');
      else if (closure) detail = !t.lines ? 'There is no mover line to close.' : t.weak ? 'Closing any one stretch breaks nothing.' : 'Every stretch has a way round it.';
      else detail = 'Every line that holds today still holds.';
      li.append(el('span', 'detail', detail));
      // while the clock runs the board shows the year as it is, so the look-ahead is switched off
      if (!clock && !(closure && !gives)) {
        const b = button(ev.showing === t.id ? 'Back to today' : 'Show on the board', () => { showing = showing === t.id ? null : t.id; say(showing ? 'The board now shows the city with ' + t.label + '.' : 'Back to today.'); render(); });
        b.id = 'test-' + t.id;
        b.setAttribute('aria-pressed', String(ev.showing === t.id));
        li.append(b);
      }
      list.append(li);
    }
    const banner = $('banner'), test = ev.tests.find(t => t.id === ev.showing);
    banner.hidden = !test;
    if (test) $('bannertext').textContent = 'Stretch test: the board shows the city with ' + test.label + '.';
  }

  function render() {
    hand = C.inHand({ state, clock });
    news = clock ? C.notices(clock) : [];
    if (clock) showing = null;
    ev = G.evaluate(state, showing, clock ? C.stressAt(clock) : null);
    showing = ev.showing;
    drawBoard(); drawTray(); drawScore(); drawClock(); drawInspector(); drawWork(); drawRules(); drawTests();
    $('undo').disabled = history.length === 0;
  }

  function asText() {
    const today = G.evaluate(state, null, clock ? C.stressAt(clock) : null), s = today.score, out = ['FUTURE CITY BUILDER', ''];
    out.push('People: ' + fmt(s.pop) + ' in ' + s.hoods + ' neighborhoods');
    out.push('Ring buildings: ' + s.ringBuildings + '. Schools: ' + s.schools.elementary + ' elementary, ' + s.schools.middle + ' middle, ' + s.schools.high + ' high. Fields: ' + s.fields + '.');
    out.push('Reactor modules: ' + s.units.power + '. Water units: ' + s.units.water + '. Sewage units: ' + s.units.sewage + '. Waste units: ' + s.units.waste + '.');
    out.push('Mover line: ' + fmt(s.moverKm, 1) + ' km with ' + s.stops + ' stops. Sub-level walkway: ' + fmt(s.walkwayKm) + ' km. Goods pipe: ' + fmt(s.pipeKm) + ' km.');
    out.push('Trips: ' + pct(s.foot) + ' on foot, ' + pct(s.bike) + ' by bike, ' + pct(s.ride) + ' by mover' + (s.stuck + s.nowhere > 0.0005 ? ', ' + fmt(100 * (s.stuck + s.nowhere), 1) + '% with no way to go' : '') + '. Movers: ' + fmt(s.fleet) + '. Average ride: ' + fmt(s.door, 1) + ' min door to door.');
    if (s.car) out.push('Car city of the same size: ' + fmt(s.car.acres) + ' acres, ' + fmt(s.car.vehicles) + ' cars, ' + pct(s.car.ride) + ' of trips by car.');
    out.push('', 'LINES');
    for (const r of today.rules) out.push('[' + STATUS[r.status] + '] ' + r.lines + ': ' + r.title + '. ' + r.detail);
    out.push('', 'STRETCH');
    for (const t of today.tests) out.push((t.gives.length ? '[Gives] ' : '[Holds] ') + cap(t.label) + (t.gives.length ? ': ' + t.gives.map(g => g.title).join('; ') : ''));
    if (clock) {
      const last = clock.record[clock.record.length - 1];
      out.push('', 'CLOCK', 'Year ' + clock.year + ' of ' + C.YEARS + '. Homes for ' + fmt(last.homes) + ' people. Broken line-years: ' + clock.lineYears + '.');
      for (const n of news) out.push((n.when === 'now' ? 'Now: ' : 'Announced: ') + n.text);
      for (const r of clock.record) out.push(yearLine(r));
      if (hand.list.length) out.push('Work in hand: ' + hand.list.map(j => C.NAME[j.what] + ' at ' + j.at + ' (' + (j.status === 'working' ? j.left + ' yr' : j.status) + ')').join('; '));
    }
    out.push('', 'TILES (east, down-right)');
    for (const k of G.allTiles()) {
      const t = state.tiles[k];
      if (!t) continue;
      out.push(k + ' ' + t.kind + (t.kind === 'hood' ? (G.EXTRAS.filter(x => t.has[x]).length ? ' with ' + G.EXTRAS.filter(x => t.has[x]).join(', ') : '') : ' x' + t.n));
    }
    out.push('', 'MOVER LINE', Object.keys(state.lines).sort().join('  '));
    return out.join('\n');
  }

  function start(data) {
    const kept = (data && data.game ? restore(data.game) : null) || load();
    state = kept ? kept.state : G.starter();
    clock = kept ? kept.clock : null;
    buildTray();
    const board = $('board');
    board.addEventListener('click', e => { const g = e.target.closest ? e.target.closest('.tile') : null; if (g) use(g.getAttribute('data-k')); });
    board.addEventListener('keydown', e => {
      const g = e.target.closest ? e.target.closest('.tile') : null;
      if (!g) return;
      const k = g.getAttribute('data-k'), [q, r] = G.at(k);
      const tries = { ArrowLeft: [[-1, 0]], ArrowRight: [[1, 0]], ArrowUp: [[0, -1], [1, -1]], ArrowDown: [[0, 1], [-1, 1]] }[e.key];
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); use(k); return; }
      if (!tries) return;
      e.preventDefault();
      const valid = G.allTiles();
      for (const [dq, dr] of tries) {
        const to = G.key(q + dq, r + dr);
        if (valid.includes(to)) { focusKey = to; drawBoard(); const node = board.querySelector('[tabindex="0"]'); if (node) node.focus(); return; }
      }
    });
    const seed = () => 1 + Math.floor(Math.random() * 2147483646);
    $('undo').addEventListener('click', () => { if (!history.length) return; const was = history.pop(); state = was.state; clock = was.clock; lineFrom = null; save(); say('Undone.'); render(); });
    $('starter').addEventListener('click', () => { picked = null; showing = null; swap({ state: G.starter(), clock: null }, 'The ledger\'s city of 50,000 is on the board' + (clock ? ', and the clock is stopped' : '') + '. Undo brings yours back.'); });
    $('clear').addEventListener('click', () => { picked = null; showing = null; swap({ state: G.empty(), clock: null }, 'The site is clear' + (clock ? ', and the clock is stopped' : '') + '. Undo brings the city back.'); });
    $('today').addEventListener('click', () => { showing = null; say('Back to today.'); render(); });
    $('run').addEventListener('click', () => swap(C.start(state, seed()), 'The clock is running on this city: year 0 of ' + C.YEARS + '. What you place now is an order for the ' + C.CREWS + ' crews. Press Next year when your orders are in.'));
    $('found').addEventListener('click', () => { picked = null; swap(C.start(G.empty(), seed()), 'An empty site, year 0, ' + C.CREWS + ' crews. Place your first orders, then press Next year. Undo brings the old city back.'); });
    $('stop').addEventListener('click', () => swap(C.stop({ state, clock }), 'The clock is stopped. Work in hand was finished at once.'));
    $('tick').addEventListener('click', () => {
      if (!clock || clock.year >= C.YEARS) return;
      const next = C.tick({ state, clock }), row = next.clock.record[next.clock.record.length - 1];
      remember(); state = next.state; clock = next.clock; lineFrom = null; save(); render();
      say(yearLine(row) + (clock.year >= C.YEARS ? ' The ' + C.YEARS + ' years are up.' : ''));
    });
    $('copy').addEventListener('click', () => {
      const text = asText(), dump = $('dump');
      const fallback = () => { dump.hidden = false; dump.value = text; dump.focus(); dump.select(); say('Copying is blocked here. The text is selected below.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => say('Copied. Paste it back into the conversation.'), fallback);
      else fallback();
    });
    render();
    say(kept ? (clock ? 'Your run is as you left it, in year ' + clock.year + '.' : 'Your city is as you left it. Pick a tool to carry on.') : 'This is the ledger\'s city of 50,000. Pick a tool and change it, or clear the site and start your own.');
    // start a small screen looking at the middle of the site
    const scroller = $('boardscroll');
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
  }

  // An open page that is handed a new version keeps its game: the viewer passes this snapshot to the next start.
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ game: { tiles: state.tiles, lines: state.lines, clock } }));
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
