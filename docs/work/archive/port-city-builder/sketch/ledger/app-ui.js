// Builds the page once, then recomputes both columns whenever a premise changes.
(() => {
  const KEY = 'future-city-ledger-v3';
  const D = CityModel.defaults;
  const SCOPES = ['shared', 'old', 'neu'];
  const ASSUMED_PEOPLE = ['produce', 'library', 'doctor', 'park', 'fields', 'auditorium', 'government'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const $ = id => document.getElementById(id);
  let S = clone(D);
  const live = [];        // ledger cells that are recomputed: { num, alt, spec, col }
  const fields = [];      // premise inputs: { input, spec }
  const needRows = [];    // the needs table: one record per need
  const printed = [];     // every ledger line, for the text copy

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved) return;
      for (const scope of SCOPES) {
        for (const k of Object.keys(D[scope])) {
          const v = saved[scope] ? saved[scope][k] : undefined;
          if (typeof D[scope][k] === 'number' && Number.isFinite(v)) S[scope][k] = v;
        }
      }
      const tierIds = TIERS.map(t => t[0]);
      for (const n of S.needs) {
        const was = (saved.needs || []).find(x => x && x.id === n.id);
        if (!was) continue;
        if (tierIds.includes(was.tier)) n.tier = was.tier;
        for (const k of ['people', 'cap', 'share']) if (typeof n[k] === 'number' && Number.isFinite(was[k]) && was[k] >= 0) n[k] = was[k];
      }
    } catch (e) { /* storage is a convenience; the page works without it */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* same */ } }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  const shown = (spec) => Number((S[spec.scope][spec.in] * (spec.scale || 1)).toFixed(4));
  // A value and its unit as one piece of text. Percent and times signs sit against the number.
  const withUnit = (value, unit) => !unit ? value : value + (unit === '%' || unit === '×' ? '' : ' ') + unit;

  // A number field bound to a getter and setter, with range checking.
  function numberField(id, label, o, get, set) {
    const input = el('input', o.assumed ? 'assumed' : '');
    input.type = 'number'; input.inputMode = 'decimal'; input.id = id;
    input.step = o.step || 1; input.min = o.min; input.max = o.max;
    input.value = get();
    input.setAttribute('aria-label', label);
    if (o.w) input.style.width = o.w + 'ch';
    input.addEventListener('input', () => {
      const v = Number(input.value);
      const ok = input.value !== '' && Number.isFinite(v) && v >= o.min && v <= o.max;
      if (ok) { input.removeAttribute('aria-invalid'); set(v); save(); update(); }
      else input.setAttribute('aria-invalid', 'true');
    });
    return input;
  }

  function cell(spec, col, label) {
    const box = el('div', 'val');
    if (spec.in) {
      const name = label + (col === 'both' ? '' : col === 'old' ? ', car city' : ', your city');
      const input = numberField('in-' + spec.scope + '-' + spec.in, name, spec, () => shown(spec), v => { S[spec.scope][spec.in] = v / (spec.scale || 1); });
      box.append(input);
      if (spec.unit) box.append(el('span', 'unit', spec.unit));
      fields.push({ input, spec });
      box.read = () => withUnit(input.value, spec.unit);
    } else if (typeof spec.t === 'string') {
      box.classList.add('text'); box.textContent = spec.t;
      box.read = () => spec.t;
    } else {
      const num = el('span', spec.t && !spec.num ? '' : 'num');
      if (spec.t && !spec.num) box.classList.add('text');
      const alt = el('span', 'alt');
      box.append(num);
      if (spec.unit) box.append(el('span', 'unit', spec.unit));
      box.append(alt);
      live.push({ num, alt, spec, col });
      box.read = () => withUnit(num.textContent, spec.unit);
    }
    return box;
  }

  function sourceLinks(into, keys) {
    (keys || []).forEach((key, j) => {
      const a = el('a', '', keys.length > 1 ? 'source ' + (j + 1) : 'source');
      a.href = SRC[key][1]; a.title = SRC[key][0]; a.setAttribute('aria-label', SRC[key][0]);
      into.append(' ', a);
    });
  }
  function note(parts, cls) {
    const box = el('div', cls || 'note');
    for (const p of parts) {
      const seg = el('span', 'seg');
      seg.append(el('span', 'tag ' + p.tag, p.tag), p.text);
      sourceLinks(seg, p.src);
      box.append(seg);
    }
    return box;
  }

  function ledgerRow(r) {
    const hasField = Boolean((r.both && r.both.in) || (r.old && r.old.in) || (r.neu && r.neu.in));
    const row = el('div', 'row' + (hasField ? ' given' : '') + (r.key ? ' key' : ''));
    row.append(el('div', 'label', r.label));
    const line = { label: r.label };
    if (r.both) { const c = cell(r.both, 'both', r.label); c.classList.add('both'); row.append(c); line.both = c; }
    else { line.old = cell(r.old, 'old', r.label); line.neu = cell(r.neu, 'neu', r.label); row.append(line.old, line.neu); }
    row.append(note(r.note));
    printed.push(line);
    return row;
  }

  function needsTable() {
    const wrap = el('div', 'inset');
    const scroll = el('div', 'scroll');
    const table = el('table', 'needs stack');
    const HEADS = ['Need', 'Where', 'People one needs', 'Share of trips', 'In the city', 'Room to stretch', 'Typical walk'];
    const head = el('tr');
    const LEFT = [1, 2, 3, 5];   // columns that hold a control or words, not a bare number
    HEADS.forEach((h, i) => { const th = el('th', LEFT.includes(i) ? 'l' : '', h); th.scope = 'col'; head.append(th); });
    const thead = el('thead'); thead.append(head);
    const tbody = el('tbody');
    for (const n of D.needs) {
      const info = NEED_INFO[n.id], mine = () => S.needs.find(x => x.id === n.id);
      // Two rows for each need: its settings, then where its number comes from.
      const tr = el('tr', 'set'), why = el('tr', 'why');
      const th = el('th', '', info.label); th.scope = 'row'; th.rowSpan = 2;
      if (info.sub) th.append(el('small', '', info.sub));
      const select = el('select'); select.id = 'need-' + n.id + '-tier'; select.setAttribute('aria-label', info.label + ', where');
      for (const [value, text] of TIERS) { const opt = el('option', '', text); opt.value = value; select.append(opt); }
      select.value = mine().tier;
      select.addEventListener('change', () => { mine().tier = select.value; save(); update(); });
      const key = n.kind === 'cap' ? 'cap' : 'people';
      const people = numberField('need-' + n.id + '-' + key, info.label + (key === 'cap' ? ', largest size' : ', people one needs'),
        { step: key === 'cap' ? 50 : 100, min: key === 'cap' ? 50 : 0, max: 1e6, w: 9, assumed: ASSUMED_PEOPLE.includes(n.id) }, () => mine()[key], v => { mine()[key] = v; });
      const share = numberField('need-' + n.id + '-share', info.label + ', share of trips', { step: 0.5, min: 0, max: 100, w: 6, assumed: true }, () => mine().share, v => { mine().share = v; });
      const cells = { tier: el('td', 'l'), people: el('td', 'l'), share: el('td', 'l'), count: el('td'), enough: el('td', 'enough'), walk: el('td') };
      Object.keys(cells).forEach((k, i) => { cells[k].dataset.label = k === 'people' && key === 'cap' ? 'Largest size' : HEADS[i + 1]; });
      cells.tier.append(select);
      cells.people.append(people, el('span', 'unit', key === 'cap' ? 'pupils at most' : 'people'));
      cells.share.append(share, el('span', 'unit', '%'));
      const noteTd = el('td', 'wrap'); noteTd.colSpan = HEADS.length - 1; noteTd.append(note(info.note));
      tr.append(th, cells.tier, cells.people, cells.share, cells.count, cells.enough, cells.walk);
      why.append(noteTd);
      tbody.append(tr, why);
      const rec = { id: n.id, label: info.label, select, people, share, key, cells, text: '' };
      needRows.push(rec);
      printed.push({ label: info.label, read: () => rec.text });
    }
    table.append(thead, tbody); scroll.append(table); wrap.append(scroll);
    wrap.append(note([
      m('derived', 'Room to stretch is how far the people can fall, or the pupils can grow, before that row breaks. Fits means it holds across the band in step 1. Tight means it holds today and not across the band.'),
      m('assumed', 'The trip shares are my rough splits of measured categories, as shares of the trips in step 1: shopping is 18.4% of US trips, school and church 10.9%, social and recreational 27.5%, work 19%.', ['nhts', 'trends']),
    ], 'note foot'));
    return wrap;
  }

  function harmTable() {
    const wrap = el('div', 'inset');
    const scroll = el('div', 'scroll');
    const table = el('table'); table.id = 'harm';
    scroll.append(table); wrap.append(scroll);
    return wrap;
  }

  function build() {
    const sum = $('sum');
    const head = el('div', 'row head');
    head.append(el('span', '', ''), el('span', '', 'Car city'), el('span', '', 'Your city'));
    sum.append(head);
    for (const r of SUMMARY) {
      const row = el('div', 'row key');
      row.append(el('div', 'label', r.label), cell(r.cell, 'old', r.label), cell(r.cell, 'neu', r.label));
      sum.append(row);
    }
    const ledger = $('ledger');
    SECTIONS.forEach((sec, i) => {
      const h = el('div', 'sec');
      const h3 = el('h3'); h3.append(el('b', '', String(i + 1)), sec.title);
      h.append(h3, el('p', '', sec.gloss));
      ledger.append(h);
      printed.push({ title: (i + 1) + '. ' + sec.title.toUpperCase() });
      for (const part of sec.parts) {
        if (part.custom === 'needs') ledger.append(needsTable());
        else if (part.custom === 'harm') ledger.append(harmTable());
        else for (const r of part.rows) ledger.append(ledgerRow(r));
      }
    });
    const src = $('sources');
    for (const key of Object.keys(SRC)) {
      const li = el('li'); const a = el('a', '', SRC[key][0]); a.href = SRC[key][1]; li.append(a); src.append(li);
    }
  }

  const run = (shared, neu) => ({ old: CityModel.derive(shared, S.old), neu: CityModel.derive(shared, neu || S.neu, S.needs) });

  // stack: on a phone each row becomes a block, with the column heading printed above each value.
  function table(id, headRows, bodyRows, stack) {
    const t = $(id); t.textContent = '';
    const heads = headRows[headRows.length - 1].cells;
    if (stack) t.classList.add('stack');
    const thead = el('thead'), tbody = el('tbody');
    for (const hr of headRows) {
      const tr = el('tr', hr.cls || '');
      for (const h of hr.cells) { const th = el('th', h.cls || '', h.text); if (h.span) th.colSpan = h.span; th.scope = 'col'; tr.append(th); }
      thead.append(tr);
    }
    for (const br of bodyRows) {
      const tr = el('tr');
      br.forEach((c, i) => {
        const td = el(i === 0 ? 'th' : 'td', c && c.cls ? c.cls : '');
        if (i === 0) td.scope = 'row'; else if (stack) td.dataset.label = heads[i].text;
        if (c && c.node) td.append(c.node); else td.textContent = c;
        tr.append(td);
      });
      tbody.append(tr);
    }
    t.append(thead, tbody);
  }
  // state: 'ok' holds, 'tight' holds today only, 'short' does not hold.
  const chip = (state, text) => el('span', 'chip ' + state, text);

  const CHECKS = [
    { label: 'People per km²', get: r => fmt(r.old.density), measured: '986 across all US urban areas. Chicago 1,432, New York 2,309, Los Angeles 2,886.',
      note: 'The ledger counts no industry, institutions or vacant land, and it uses new-home lots, which are smaller than older ones.', src: ['census', 'ng10', 'ng20'] },
    { label: 'Trips by private vehicle', get: r => pct(r.old.ride), measured: '82.6% in 2017, about 90% in 2022',
      note: 'The ledger has no buses or trains. They carry 2.5% of trips.', src: ['trends', 'nhts22'] },
    { label: 'Trips on foot', get: r => pct(r.old.walk), measured: '10.5% in 2017, 6.9% in 2022',
      note: 'The surveys include walks taken for exercise. The ledger counts only walks to somewhere.', src: ['trends', 'nhts22'] },
    { label: 'Vehicle trips per person per day', get: r => fmt(r.old.vehTripsPerPerson, 2), measured: '2.00',
      note: '220 billion vehicle trips in a year of 371 billion person trips, at 3.37 person trips a day.', src: ['nhts'] },
    { label: 'City land that is parking', get: r => pct(r.old.parkingShare), measured: '14% of incorporated Los Angeles County',
      note: 'The spaces-per-vehicle premise comes from the same study, so only the land total is an independent check.', src: ['la'] },
    { label: 'Your city: its movers against the cars they replace, at 5 million people', get: r => pct(r.big.neu.fleet / r.big.old.fleet), measured: 'about 10% in the ITF\'s Lisbon simulation',
      note: 'A different city and a different method. Lisbon\'s vehicles came to the door. Yours meet people at stops.', src: ['itf'] },
  ];

  function withSources(text, keys) {
    const span = el('span', '', text);
    sourceLinks(span, keys);
    return span;
  }

  function updateNeeds(o) {
    const holds = slack => slack >= o.band - 1e-9;
    needRows.forEach((rec, i) => {
      const n = S.needs[i], r = o.needs[i], c = rec.cells;
      c.enough.textContent = '';
      const where = TIERS.find(t => t[0] === n.tier)[1];
      if (n.tier === 'out') {
        c.count.textContent = '–'; c.walk.textContent = '–'; c.enough.textContent = 'left out';
        rec.text = 'left out';
        return;
      }
      c.count.textContent = fmt(r.count);
      const km = r.walkKm;
      c.walk.textContent = fmt(km * 1000 / 80) + ' min';
      if (n.tier !== 'center') c.walk.append(el('span', 'alt', fmt(km * 1000 / 250) + ' by bike'));
      let verdict, state = null;
      if (n.kind === 'cap') {
        verdict = fmt(r.size) + ' pupils each, can grow ' + pct(r.slack, 0);
        state = holds(r.slack) ? 'ok' : 'tight';
      } else if (!(n.people > 0)) verdict = 'no minimum';
      else if (r.slack < -1e-9) { verdict = 'has ' + pct(r.fill, 0) + ' of what it needs'; state = 'short'; }
      else {
        verdict = (n.tier === 'center' && r.each >= 2 ? fmt(r.each) + ' in each, ' : '') + 'can lose ' + pct(r.slack, 0);
        state = holds(r.slack) ? 'ok' : 'tight';
      }
      if (state) c.enough.append(chip(state, state === 'ok' ? 'fits' : state), ' ' + verdict);
      else c.enough.textContent = verdict;
      const asks = n.kind === 'cap' ? 'at most ' + fmt(n.cap) + ' pupils' : n.people > 0 ? 'needs ' + fmt(n.people) + ' people' : 'no minimum';
      rec.text = where.toLowerCase() + '; ' + asks + '; ' + n.share + '% of trips; ' + fmt(r.count) + ' in the city' + (verdict === asks ? '' : '; ' + verdict);
    });
  }

  // What each thing named in line 18 can do before a rule gives, with nothing rebuilt.
  function stretchRows(N) {
    const pop = S.shared.pop, name = id => NEED_INFO[id].label;
    const rows = [];
    rows.push(['More children in the same homes', N.growPupilsId ? pct(N.growPupils, 0) : '–',
      N.growPupilsId ? name(N.growPupilsId) + ' reaches its cap.' : 'No school is on the list.']);
    const already = N.shortIds.length ? ' Already short today: ' + N.shortIds.map(name).join(', ') + '.' : '';
    rows.push(['Fewer people, from emptier homes or lower density', N.shrinkPeopleId ? pct(N.shrinkPeople, 0) : '–',
      (N.shrinkPeopleId ? name(N.shrinkPeopleId) + ' runs short of people.' : 'Nothing on the list needs a minimum.') + already]);
    const ringFirst = !N.growPupilsId || N.ringSlack < N.growPupils;
    rows.push(['More people on the same land', pct(ringFirst ? N.ringSlack : N.growPupils, 0), ringFirst ? 'The ring is full.' : name(N.growPupilsId) + ' reaches its cap.']);
    const times = N.ceilingPop / pop;
    rows.push(['More land at the same density', times > 1 ? fmt(times, 1) + ' times' : 'none',
      times > 1 ? 'At ' + fmt(N.ceilingPop) + ' people on ' + acres(N.ceilingPop / N.density) + ', the rim is ' + fmt(S.neu.longWalkMin) + ' minutes on foot from the middle.'
        : 'The rim is already ' + fmt(N.rimMin) + ' minutes on foot from the middle.']);
    return rows;
  }

  function update() {
    const r = run(S.shared);
    for (const c of live) {
      const col = c.col === 'both' ? 'old' : c.col;
      const o = r[col], prem = S[col], s = c.spec;
      let main;
      if (s.t) main = s.t(o, S, prem);
      else { const x = s.v(o, S, prem); main = s.pct !== undefined ? pct(x, s.pct) : fmt(x, s.d || 0); }
      c.num.textContent = main;
      c.alt.textContent = s.alt ? s.alt(o, S, prem) : '';
      c.alt.hidden = !s.alt;
    }
    updateNeeds(r.neu);

    const line = S.neu.harmLine;
    table('harm',
      [{ cells: [{ text: 'What moves' }, { text: 'Energy' }, { text: 'Near pedestrians?' }] }],
      MOVING.map(([label, kg, kmh]) => {
        const joules = 0.5 * kg * (kmh / 3.6) * (kmh / 3.6), ok = joules <= line;
        const name = el('span', '', label);
        name.append(el('small', '', fmt(kg) + ' kg at ' + kmh + ' km/h'));
        return [{ node: name }, fmt(joules) + ' J', { node: chip(ok ? 'ok' : 'short', ok ? 'allowed' : 'kept apart') }];
      }));

    table('stretch',
      [{ cells: [{ text: 'What moves' }, { text: 'Room' }, { text: 'What gives first', cls: 'wrap' }] }],
      stretchRows(r.neu).map(([what, room, gives]) => [what, room, { cls: 'wrap', node: el('span', '', gives) }]), true);

    r.big = run({ ...S.shared, pop: 5e6 });
    table('checks',
      [{ cells: [{ text: 'Measure' }, { text: 'Ledger' }, { text: 'Measured', cls: 'wrap' }, { text: 'What differs', cls: 'wrap' }] }],
      CHECKS.map(c => [c.label, c.get(r), { cls: 'wrap', node: el('span', '', c.measured) }, { cls: 'wrap', node: withSources(c.note, c.src) }]), true);

    const heights = [2, 3, 4];
    const densities = heights.map(h => run(S.shared, { ...S.neu, stories: h }).neu.density);
    table('walk',
      [{ cls: 'grp', cells: [{ text: '' }, { text: 'Farthest walk, with townhouses of', span: heights.length }] },
       { cells: [{ text: 'People who share one' }].concat(heights.map(h => ({ text: h + ' stories' }))) }],
      [500, 2000, 4000, 5000, 10000, 25000, 50000].map(people =>
        [fmt(people)].concat(densities.map(d => fmt(CityModel.farWalkMin(people, d, S.neu.detour), 1) + ' min'))));

    table('scale',
      [{ cls: 'grp', cells: [{ text: '' }, { text: 'Car city' }, { text: 'Your city', span: 10, cls: 'newc' }] },
       { cells: ['Population', 'By vehicle', 'Radius km', 'Centers', 'Rim to middle on foot', 'Homes inside the walk to work', 'On foot', 'By bike', 'By mover', 'Movers per 1,000', 'Movers ÷ cars', 'Ring buildings'].map(text => ({ text })) }],
      [5e4, 2.5e5, 1e6, 5e6].map(pop => {
        const x = run({ ...S.shared, pop });
        return [fmt(pop), pct(x.old.ride, 0), fmt(x.neu.radiusKm, 1), fmt(x.neu.centers), fmt(x.neu.rimMin) + ' min', pct(x.neu.insideLong, 0), pct(x.neu.walk, 0), pct(x.neu.bike, 0), pct(x.neu.ride, 0),
          fmt(x.neu.fleetPer1000, 1), pct(x.neu.fleet / x.old.fleet), fmt(x.neu.ringBuildings)];
      }));
  }

  function asText() {
    const out = ['FUTURE CITY LEDGER', 'Each line: car city | your city. One value means it is the same in both.', ''];
    for (const p of printed) {
      if (p.title) out.push('', p.title);
      else if (p.read) out.push(p.label + ': ' + p.read());
      else if (p.both) out.push(p.label + ': ' + p.both.read());
      else out.push(p.label + ': ' + p.old.read() + ' | ' + p.neu.read());
    }
    out.push('', 'HOW FAR IT STRETCHES');
    for (const [what, room, gives] of stretchRows(run(S.shared).neu)) out.push(what + ': ' + room + '. ' + gives);
    return out.join('\n');
  }

  $('copy').addEventListener('click', () => {
    const text = asText(), said = $('said'), dump = $('dump');
    const fallback = () => { dump.hidden = false; dump.value = text; dump.focus(); dump.select(); said.textContent = 'Copying is blocked here. The text is selected below.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { said.textContent = 'Copied.'; }, fallback);
    else fallback();
  });
  $('reset').addEventListener('click', () => {
    S = clone(D);
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
    for (const f of fields) { f.input.value = shown(f.spec); f.input.removeAttribute('aria-invalid'); }
    needRows.forEach((rec, i) => {
      const n = S.needs[i];
      rec.select.value = n.tier; rec.people.value = n[rec.key]; rec.share.value = n.share;
      rec.people.removeAttribute('aria-invalid'); rec.share.removeAttribute('aria-invalid');
    });
    update();
    $('said').textContent = 'Back to the starting premises.';
  });

  load();
  build();
  update();
})();
