// Test pipeline for Knight Kitten. Runs the game in headless Chrome and checks:
//   boot     page loads, no errors, every menu button is there
//   modes    each mode survives several minutes of a bot playing it
//   city     Bengaluru layout: overlaps, reachability, signs, rides, views
//   text     spelling of every player-facing string
//   shots    screenshots of key scenes in tests/output/ for a human to look at
//
// Usage: npm test            (everything)
//        npm test -- --quick (shorter bot runs)
//        npm test -- city    (only the named suites)
// Chrome is found via CHROME_PATH, or the usual install locations.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import wordListPath from 'word-list';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'output');
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const ONLY = args.filter(a => !a.startsWith('--'));
const want = name => !ONLY.length || ONLY.includes(name);

// ---------------------------------------------------------------------------
// Static server and browser.
// ---------------------------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css' };
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.');
  return found;
}

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------
const results = [];
function report(suite, name, problems, info = '') {
  results.push({ suite, name, problems });
  const ok = !problems.length;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${suite} / ${name}${info ? `  (${info})` : ''}`);
  for (const p of problems.slice(0, 25)) console.log(`          - ${p}`);
  if (problems.length > 25) console.log(`          ... and ${problems.length - 25} more`);
}

async function openGame(browser, { width = 1280, height = 720, touch = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, hasTouch: touch, isMobile: false });
  const errors = [];
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => { if (!/fonts\.g/.test(r.url())) errors.push(`request failed: ${r.url()}`); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  return { page, errors };
}

// ---------------------------------------------------------------------------
// Suites.
// ---------------------------------------------------------------------------
async function suiteBoot(browser) {
  const { page, errors } = await openGame(browser);
  const info = await page.evaluate(() => ({
    title: document.getElementById('p-title').classList.contains('open'),
    buttons: [...document.querySelectorAll('#p-title button')].map(b => b.id),
    font: getComputedStyle(document.querySelector('.card button')).fontFamily,
    jersey: document.fonts.check('16px "Jersey 10"'),
  }));
  const problems = [...errors];
  if (!info.title) problems.push('title menu is not open after load');
  for (const id of ['m-story', 'm-journey', 'm-endless', 'm-bossrush', 'm-daily', 'm-city', 'm-shop', 'm-help']) if (!info.buttons.includes(id)) problems.push(`missing menu button #${id}`);
  if (!info.jersey) problems.push('Jersey 10 font did not load (check the network or the font link)');
  report('boot', 'page loads cleanly', problems, `${info.buttons.length} buttons`);
  await page.close();
}

async function suiteModes(browser) {
  const minutes = QUICK ? 1 : 4;
  for (const mode of ['story', 'endless', 'bossrush', 'daily', 'journey']) {
    const { page, errors } = await openGame(browser);
    const out = await page.evaluate((mode, minutes) => {
      const log = [];
      let steps = 0;
      try {
        SAVE.seenIntro = true;
        if (mode === 'journey') startJourney(0); else startArenaMode(mode);
        for (; steps < 60 * 60 * minutes; steps++) {
          if (menuOpen()) {
            if (openPanelId === 'p-results') { log.push(document.getElementById('r-title').textContent); closePanels(); if (mode === 'journey') startJourney(0); else startArenaMode(mode); }
            continue;
          }
          input.mx = input.my = 0;
          if (mode === 'journey') {
            for (const o of J.obstacles) {
              const dx = o.x - J.dist;
              if (dx < 0 || dx > 60 || o.harmless) continue;
              if (o.breakable && dx < 26 && o.h0 < 26) { input.pressed.attack = true; break; }
              if (!o.breakable && dx < 34 && J.kitY === 0) { input.pressed.jump = true; input.held.jump = o.h > 12; break; }
            }
            journeyTick(1 / 60);
          } else {
            const live = ents.filter(isAlive);
            const tgt = live.sort((a, b) => dist(a, kit) - dist(b, kit))[0];
            if (tgt) {
              const d = norm(tgt.x - kit.x, tgt.y - kit.y);
              if (dist(tgt, kit) > 16) { input.mx = d.x; input.my = d.y; }
              if (dist(tgt, kit) < 28 && steps % 6 === 0) input.pressed.attack = true;
            }
            arenaTick(1 / 60);
          }
          if (steps % 120 === 0) { uiClear(); if (mode === 'journey') { journeyDraw(); journeyUI(); } else { arenaDraw(); drawArenaUI(); } }
          consumeInput();
        }
      } catch (e) { return { thrown: `${e.message} | ${e.stack.split('\n').slice(1, 3).join(' | ')}`, steps, log }; }
      return { steps, log };
    }, mode, minutes);
    const problems = [...errors];
    if (out.thrown) problems.push(`threw after ${(out.steps / 3600).toFixed(1)} min: ${out.thrown}`);
    report('modes', mode, problems, `${(out.steps / 3600).toFixed(1)} min simulated${out.log.length ? `, results: ${[...new Set(out.log)].join(', ')}` : ''}`);
    await page.close();
  }
}

async function suiteCity(browser) {
  const { page, errors } = await openGame(browser);
  const t0 = Date.now();
  await page.evaluate(() => { SAVE.city = { stamps: [] }; startCity(); });
  const buildMs = Date.now() - t0;

  // Layout audit: things that overlap, sit in water, or can't be reached.
  const audit = await page.evaluate(() => {
    const out = { overlap: [], road: [], hidesRoad: [], water: [], unreachable: [], signs: [], facts: [], misc: [] };
    const rectOf = b => ({ x: b.x - b.fw / 2, y: b.y - b.fd, w: b.fw, h: b.fd });
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const named = b => `${b.spr}${b.signs && b.signs[0] ? ` "${b.signs[0].text}"` : ''} @${b.x},${b.y}`;
    const solidB = B_BUILDINGS.filter(b => b.fw);
    const cell = new Map();
    for (const b of solidB) { const k = `${Math.floor(b.x / 400)},${Math.floor(b.y / 400)}`; if (!cell.has(k)) cell.set(k, []); cell.get(k).push(b); }
    const around = b => { const near = []; const cx = Math.floor(b.x / 400), cy = Math.floor(b.y / 400); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) near.push(...(cell.get(`${cx + i},${cy + j}`) || [])); return near; };
    for (const a of solidB) {
      const r = rectOf(a);
      for (const b of around(a)) if (a !== b && (a.x < b.x || a.x === b.x && a.y < b.y) && hit(r, rectOf(b))) out.overlap.push(`${named(a)} overlaps ${named(b)}`);
      for (const g of B_RSEGS) if (!a.island && rectSegDist(r, g) < g.hw) out.road.push(`${named(a)} sits on ${g.road.name}`);
      // The picture above the footprint must not hide a road's carriageway.
      const pr = bPicRect(a), above = { x: pr.x, y: pr.y, w: pr.w, h: r.y - pr.y };
      if (above.h > 0 && !a.island) for (const g of B_RSEGS) if (rectSegDist(above, g) < g.hw - 4) { out.hidesRoad.push(`${named(a)} hides ${g.road.name}`); break; }
      for (const l of B_LAKES) if (inEll(r.x + r.w / 2, r.y + r.h / 2, l, l.rx + r.w / 2, l.ry + r.h / 2)) out.water.push(`${named(a)} is in ${l.name}`);
      if (hit(r, B_RIVER)) out.water.push(`${named(a)} is in the Sarayu`);
      if (r.x < 0 || r.y < 0 || r.x + r.w > BW || r.y + r.h > BH) out.misc.push(`${named(a)} is outside the map`);
      // A building south of another must not cover its front with its picture.
      for (const b of around(a)) if (b !== a && b.y > a.y && b.img.height > 30 && hit(bFrontRect(a), bPicRect(b))) out.overlap.push(`${named(b)} hides the front of ${named(a)}`);
    }
    for (const L of Object.values(B_LINES)) for (const g of L.segs) if (!g.under && g.axis === 'd') out.misc.push(`${L.name} has a slanting elevated stretch at ${g.x0},${g.y0}`);
    // Flood fill the walkable grid from the start.
    const seen = new Uint8Array(BGW * BGH);
    const q = [Math.floor(B_START.y / BCELL) * BGW + Math.floor(B_START.x / BCELL)];
    seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop(), cx = c % BGW, cy = (c / BGW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= BGW || ny >= BGH) continue;
        const n = ny * BGW + nx;
        if (!seen[n] && !BL.solid[n]) { seen[n] = 1; q.push(n); }
      }
    }
    const reach = (x, y, r = 6) => {
      for (let dy = -r; dy <= r; dy += BCELL) for (let dx = -r; dx <= r; dx += BCELL) {
        const cx = Math.floor((x + dx) / BCELL), cy = Math.floor((y + dy) / BCELL);
        if (cx >= 0 && cy >= 0 && cx < BGW && cy < BGH && seen[cy * BGW + cx]) return true;
      }
      return false;
    };
    for (const pc of B_POSTCARDS) if (!pc.ride && !reach(pc.x, pc.y, pc.r * 0.7)) out.unreachable.push(`postcard "${pc.name}" at ${pc.x},${pc.y}`);
    for (const s of Object.values(B_STATIONS)) if (!reach(s.x, s.y)) out.unreachable.push(`metro exit ${s.name} at ${s.x},${s.y}`);
    for (const s of B_STEAM_STOPS) if (!reach(s.exit.x, s.exit.y)) out.unreachable.push(`steam stop ${s.name}`);
    for (const n of B_NPCS) if (!reach(n.x, n.y, 18)) out.unreachable.push(`${n.name} at ${n.x},${n.y}`);
    for (const c of BL.cows) if (!reach(c.x, c.y, 18)) out.unreachable.push(`cow at ${c.x},${c.y}`);
    let fishSolid = 0, fishUnreach = 0;
    for (const f of BL.fishes) { if (bSolid(f.x, f.y)) fishSolid++; else if (!reach(f.x, f.y)) fishUnreach++; }
    if (fishSolid) out.misc.push(`${fishSolid} fish inside walls or water`);
    if (fishUnreach) out.misc.push(`${fishUnreach} fish can't be reached`);
    if (BL.fishes.length < 100) out.misc.push(`only ${BL.fishes.length} fish placed`);
    for (const n of B_NPCS) if (n.area && (n.area.w < 0 || n.area.h < 0)) out.misc.push(`${n.name} has a bad walking area`);
    // Signs must fit on their buildings at street zoom.
    for (const b of B_BUILDINGS) for (const g of b.signs || []) {
      const w = uwidth(g.text, g.size);
      const a = g.anchor ? b.img.anchors && b.img.anchors[g.anchor] : { x: g.x };
      if (!a) { out.signs.push(`"${g.text}" has no ${g.anchor} anchor on ${b.spr}`); continue; }
      const lo = a.w ? a.x - a.w / 2 - 1 : -2, hi = a.w ? a.x + a.w / 2 + 1 : b.img.width + 2;
      if (a.x - w / 2 < lo || a.x + w / 2 > hi) out.signs.push(`"${g.text}" (${w.toFixed(0)}px) does not fit ${b.spr} (${a.w ? `${a.w}px board` : `${b.img.width}px`})`);
    }
    // Postcard facts fit on the card (four lines at most).
    for (const pc of B_POSTCARDS) {
      const lines = bWrap(pc.fact, Math.min(190, W - 20) - 30, 5);
      if (lines.length > 4) out.facts.push(`"${pc.name}" fact wraps to ${lines.length} lines`);
    }
    // Station ids on lines must be unique per line and on the polyline.
    for (const [id, L] of Object.entries(B_LINES)) for (const st of L.stations) {
      const p = lineProject(L, st.x, st.y);
      if (p.d > 1) out.misc.push(`${id} station ${st.name} is ${p.d.toFixed(0)}px off the line`);
    }
    return { ...out, reachable: seen.reduce((s, v) => s + v, 0), statics: BL.statics.length, trees: BL.statics.filter(s => s.tree).length, fish: BL.fishes.length };
  });
  report('city', 'buildings do not overlap', audit.overlap);
  report('city', 'buildings stay off roads', audit.road);
  report('city', 'buildings do not hide roads', audit.hidesRoad);
  report('city', 'buildings stay out of water', audit.water);
  report('city', 'everything is reachable on foot', audit.unreachable, `${audit.reachable} walkable cells`);
  report('city', 'signs fit their buildings', audit.signs);
  report('city', 'postcard facts fit the card', audit.facts);
  report('city', 'misc layout checks', audit.misc, `${audit.statics} props, ${audit.trees} trees, ${audit.fish} fish, built in ${buildMs} ms`);

  // Rides: every metro pair, both ways on the steam train.
  const rides = await page.evaluate(() => {
    const problems = [];
    let n = 0;
    const runRide = () => { for (let i = 0; i < 60 * 60 && BL.ride; i++) { cityTick(1 / 60); if (i % 30 === 0) { cityDraw(); uiClear(); cityUI(); } consumeInput(); } };
    for (const from of Object.values(B_STATIONS)) {
      B_COLS.forEach((lid, col) => B_LINES[lid].stations.forEach((to, row) => {
        if (to.id === from.id) return;
        BL.ride = null; BL.mapOpen = false; BL.x = from.x; BL.y = from.y;
        cityTick(1 / 60); consumeInput();
        if (!BL.near || BL.near.kind !== 'metro') { problems.push(`no metro prompt at ${from.name}`); return; }
        input.pressed.jump = true; cityTick(1 / 60); consumeInput();
        if (!BL.ride) { problems.push(`picker did not open at ${from.name}`); return; }
        BL.ride.sel = { col, row };
        input.pressed.jump = true; cityTick(1 / 60); consumeInput();
        runRide();
        const dest = B_STATIONS[to.id];
        if (BL.ride) problems.push(`${from.name} -> ${to.name} never arrived`);
        else if (Math.hypot(BL.x - dest.x, BL.y - dest.y) > 8) problems.push(`${from.name} -> ${to.name} ended at ${BL.x | 0},${BL.y | 0}`);
        n++;
      }));
    }
    for (let i = 0; i < 2; i++) {
      const s = B_STEAM_STOPS[i];
      BL.ride = null; BL.x = s.exit.x; BL.y = s.exit.y;
      cityTick(1 / 60); consumeInput();
      if (!BL.near || BL.near.kind !== 'steam') { problems.push(`no Malgudi Express prompt at ${s.name}`); continue; }
      input.pressed.jump = true; cityTick(1 / 60); consumeInput();
      runRide();
      const to = B_STEAM_STOPS[1 - i].exit;
      if (Math.hypot(BL.x - to.x, BL.y - to.y) > 8) problems.push(`steam ride from ${s.name} ended at ${BL.x | 0},${BL.y | 0}`);
      n++;
    }
    // Autos: from every stand to the postcard farthest from it.
    for (const a of B_AUTO_STANDS) {
      const pc = B_POSTCARDS.filter(p => !p.ride).sort((p, q) => Math.hypot(q.x - a.x, q.y - a.y) - Math.hypot(p.x - a.x, p.y - a.y))[0];
      BL.ride = null; BL.mapOpen = false; BL.x = a.x; BL.y = a.y; BL.waypoint = { id: pc.id, name: pc.name, x: pc.x, y: pc.y };
      cityTick(1 / 60); consumeInput();
      if (!BL.near || BL.near.kind !== 'auto') { problems.push(`no auto prompt at the ${a.name} stand`); continue; }
      input.pressed.jump = true; cityTick(1 / 60); consumeInput();
      if (!BL.ride) { problems.push(`no auto from ${a.name}`); continue; }
      runRide();
      if (BL.ride) problems.push(`auto from ${a.name} to ${pc.name} never arrived`);
      else if (Math.hypot(BL.x - pc.x, BL.y - pc.y) > 140) problems.push(`auto from ${a.name} to ${pc.name} stopped ${Math.hypot(BL.x - pc.x, BL.y - pc.y) | 0}px short`);
      else if (bSolid(BL.x, BL.y)) problems.push(`auto from ${a.name} left the kitten inside something at ${BL.x | 0},${BL.y | 0}`);
      n++;
    }
    return { problems, n, stamps: SAVE.city.stamps };
  });
  report('city', 'every metro, steam and auto ride arrives', rides.problems, `${rides.n} rides`);

  // Walk a bot to every postcard and check it gets stamped; render all views as it goes.
  const walk = await page.evaluate(quick => {
    const problems = [];
    const views = new Set();
    let slowest = 0;
    SAVE.city.stamps = [];
    for (const pc of B_POSTCARDS.filter(p => !p.ride)) {
      BL.x = pc.x + (pc.r * 0.9); BL.y = pc.y;
      if (bSolid(BL.x, BL.y)) { BL.x = pc.x; BL.y = pc.y + pc.r * 0.6; }
      for (let i = 0; i < (quick ? 60 : 240) && !SAVE.city.stamps.includes(pc.id); i++) {
        const d = norm(pc.x - BL.x, pc.y - BL.y);
        input.mx = d.x; input.my = d.y;
        cityTick(1 / 60); consumeInput();
      }
      if (!SAVE.city.stamps.includes(pc.id)) problems.push(`walking up to "${pc.name}" did not give its postcard`);
      BL.view = B_VIEWS[SAVE.city.stamps.length % B_VIEWS.length];
      views.add(BL.view);
      const a = performance.now();
      cityDraw(); uiClear(); cityUI();
      slowest = Math.max(slowest, performance.now() - a);
    }
    input.mx = input.my = 0;
    // Map, zoom, waypoint, night.
    openCityMap(); input.pressed.view = true; cityTick(1 / 60); consumeInput();
    cityDraw(); uiClear(); cityUI();
    input.pressed.jump = true; cityTick(1 / 60); consumeInput();
    if (!BL.waypoint) problems.push('choosing a place on the map did not set a destination');
    BL.clock = 22 * 60; BL.view = 'sketch'; cityDraw(); uiClear(); cityUI();
    BL.view = 'street';
    return { problems, views: [...views], slowest: slowest.toFixed(1), stamps: SAVE.city.stamps.length };
  }, QUICK);
  report('city', 'postcards, map and views work', walk.problems, `${walk.stamps} postcards, views ${walk.views.join('/')}, slowest frame ${walk.slowest} ms`);
  report('city', 'no errors while exploring', errors);
  await page.close();
}

// Every string a player can read, gathered from the running game and the page.
async function suiteText(browser) {
  const { page, errors } = await openGame(browser);
  const strings = await page.evaluate(() => {
    const out = [];
    const add = (where, s) => { if (typeof s === 'string' && s.trim()) out.push({ where, s }); };
    // Each text node on its own: hidden panels have no layout, so innerText would glue words together.
    for (const root of document.querySelectorAll('.panel, #touch, #rotate')) {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) add(`page #${root.id}`, n.textContent);
    }
    for (const L of LANDS) { add('journey land', L.name); add('journey land', L.sub); L.story.forEach(s => add('journey story', s)); }
    for (const [k, m] of Object.entries(MINIONS)) { add(`minion ${k}`, m.name); m.barks.forEach(b => add(`minion ${k}`, b)); }
    for (const [k, b] of Object.entries(BOSSES)) { for (const f of ['name', 'title', 'intro', 'death']) add(`boss ${k}`, b[f]); b.taunts.forEach(x => add(`boss ${k}`, x)); }
    Object.values(COMBO_BARKS).forEach(s => add('combo', s));
    for (const [k, m] of Object.entries(MODS)) for (const v of Object.values(m)) if (typeof v === 'string') add(`modifier ${k}`, v);
    for (const slot of Object.values(COSMETICS)) slot.forEach(c => add('shop', c.name));
    for (const b of CAT_BREEDS) add('cat breed', b.name);
    for (const r of B_ROADS) add('road', r.name);
    for (const d of B_DISTRICTS) add('district', d.name);
    for (const p of B_POSTCARDS) { add('postcard', p.name); add(`postcard ${p.id}`, p.fact); }
    for (const n of B_NPCS) { add('npc', n.name); n.lines.forEach(l => add(`npc ${n.name}`, l)); }
    for (const b of B_BUILDINGS) for (const g of b.signs || []) add(`sign ${b.spr}`, g.text);
    for (const L of Object.values(B_LINES)) { add('metro', L.name); L.stations.forEach(s => add('metro station', s.name)); }
    for (const v of Object.values(B_VIEW_INFO)) { add('view', v.name); add('view', v.sub); }
    B_HONKS.forEach(h => add('honk', h));
    return out;
  });
  // Text that only lives in the source: string literals in the UI code.
  for (const file of ['ui.js', 'main.js', 'modes.js', 'arena.js', 'journey.js', 'city.js']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/(?:ut|cut|utitle|ububble|bText|bToast|say|addText|jText|showResults)\(\s*(['"`])((?:(?!\1).){3,})\1/g)) strings.push({ where: file, s: m[2].replace(/\s*\$\{[^}]*\}\s*/g, ' ') });
    for (const m of src.matchAll(/(?:title|sub|hint|label|text|kn|en): (['"`])((?:(?!\1).){3,})\1/g)) strings.push({ where: file, s: m[2].replace(/\s*\$\{[^}]*\}\s*/g, ' ') });
  }
  const dict = new Set(fs.readFileSync(wordListPath, 'utf8').split('\n'));
  const allowed = new Set(fs.readFileSync(path.join(ROOT, 'tests', 'allowed-words.txt'), 'utf8').split('\n').map(w => w.trim().toLowerCase()).filter(w => w && !w.startsWith('#')));
  const known = w => {
    const l = w.toLowerCase();
    if (dict.has(l) || allowed.has(l)) return true;
    for (const suf of ["n't", "'s", "'d", "'ll", "'re", "'ve", "'m", 's', 'es', 'ed', 'ing', 'd']) if (l.endsWith(suf) && (dict.has(l.slice(0, -suf.length)) || allowed.has(l.slice(0, -suf.length)))) return true;
    return false;
  };
  const unknown = new Map();
  const style = [];
  for (const { where, s } of strings) {
    for (const raw of s.replace(/[\u200c]/g, '').split(/[^A-Za-z'\u2019]+/)) {
      const w = raw.replace(/^'+|'+$/g, '').replace(/\u2019/g, "'");
      if (w.length < 2 || /^[A-Z]{1,3}$/.test(w)) continue;
      if (!known(w)) unknown.set(w, [...(unknown.get(w) || []), where]);
    }
    if (where.startsWith('page') ? false : / {2,}[a-z]/.test(s.trim().replace(/(^| {2})[->] {2}/g, ' - '))) style.push(`double space in ${where}: "${s.trim().slice(0, 60)}"`);
    if (/\b(\w+) \1\b/i.test(s) && !/(sala|very|no|come|side|right|pom|cheap|beep)/i.test(s.match(/\b(\w+) \1\b/i)[1])) style.push(`repeated word in ${where}: "${s.trim().slice(0, 60)}"`);
  }
  report('text', 'spelling', [...unknown].map(([w, where]) => `"${w}" in ${[...new Set(where)].slice(0, 3).join(', ')}`), `${strings.length} strings checked; add real names to tests/allowed-words.txt`);
  report('text', 'style', style);
  report('text', 'no errors', errors);
  await page.close();
}

async function suiteShots(browser) {
  fs.mkdirSync(OUT, { recursive: true });
  // Scenes are found by postcard or station id, so they follow the map.
  const scenes = [
    { name: 'vidhana-soudha', pc: 'vidhana' },
    { name: 'cubbon-high-court', pc: 'highcourt' },
    { name: 'cubbon-museums', pc: 'govmuseum' },
    { name: 'bangalore-palace', pc: 'palace' },
    { name: 'majestic-ksr', pc: 'ksr' },
    { name: 'mg-road', pc: 'brigade' },
    { name: 'shivajinagar', pc: 'stmarys' },
    { name: 'commercial-street', pc: 'commercial' },
    { name: 'ulsoor', pc: 'ulsoor' },
    { name: 'someshwara', pc: 'someshwara' },
    { name: 'indiranagar', pc: 'indiranagar' },
    { name: 'malleswaram', pc: 'malleswaram' },
    { name: 'iskcon', pc: 'iskcon' },
    { name: 'kr-market-fort', pc: 'krmarket' },
    { name: 'basavanagudi', pc: 'bulltemple' },
    { name: 'gavi-gangadhareshwara', pc: 'gavi' },
    { name: 'lalbagh', pc: 'glasshouse' },
    { name: 'jayanagar', pc: 'jayanagar' },
    { name: 'koramangala', pc: 'koramangala' },
    { name: 'silk-board', pc: 'silkboard' },
    { name: 'malgudi-station', pc: 'malgudi' },
    { name: 'malgudi-swami', pc: 'swami' },
    { name: 'drone', pc: 'cubbon', view: 'drone' },
    { name: 'vidhana-full', pc: 'vidhana', view: 'drone', dy: 110 },
    { name: 'sketch', pc: 'swami', view: 'sketch' },
    { name: 'night', pc: 'brigade', extra: 'night' },
    { name: 'district-title', pc: 'malleswaram', extra: 'title' },
    { name: 'map', pc: 'vidhana', extra: 'map' },
    { name: 'map-zoomed', pc: 'cubbon', extra: 'map-zoom' },
    { name: 'metro-picker', st: 'majestic', extra: 'pick' },
    { name: 'metro-ride', st: 'mgroad', extra: 'ride', to: ['purple', 'indiranagar'] },
    { name: 'metro-outside', st: 'mgroad', extra: 'ride-outside', to: ['purple', 'indiranagar'] },
    { name: 'metro-underground', st: 'majestic', extra: 'ride', to: ['purple', 'vidhana'] },
    { name: 'metro-underground-outside', st: 'majestic', extra: 'ride-outside', to: ['purple', 'vidhana'] },
    { name: 'yellow-line', st: 'rvroad', extra: 'ride', to: ['yellow', 'silkboard'] },
    { name: 'steam-ride', pc: 'malgudi', extra: 'steam' },
    { name: 'auto-ride', pc: 'brigade', extra: 'auto' },
    { name: 'title' },
  ];
  const { page, errors } = await openGame(browser);
  await page.evaluate(() => { SAVE.city = { stamps: [] }; startCity(); });
  for (const sc of scenes) {
    if (sc.name !== 'title') {
      await page.evaluate(sc => {
        closePanels();
        const at = sc.pc ? B_POSTCARDS.find(p => p.id === sc.pc) : B_STATIONS[sc.st];
        BL.ride = null; BL.mapOpen = false; BL.x = at.x; BL.y = at.y + (sc.dy || 0); BL.view = sc.view || 'street'; BL.clock = sc.extra === 'night' ? 21 * 60 : 9 * 60;
        for (let i = 0; i < 200; i++) { cityTick(1 / 60); consumeInput(); }
        // Pop-ups would hide the scene; keep the district title only where it is the subject.
        BL.banner = BL.card = BL.toast = null; BL.t = 30; BL.titleAt = 30; BL.titled = bDistrictAt(BL.x, BL.y).name;
        BL.title = sc.extra === 'title' ? { name: BL.titled, sub: bDistrictAt(BL.x, BL.y).blurb, t: 2, max: 3.4 } : null;
        if (sc.extra === 'map') openCityMap();
        if (sc.extra === 'map-zoom') { openCityMap(); BL.mapZoom = 4.4; }
        if (sc.extra === 'pick') openRidePicker(B_STATIONS[sc.st]);
        BL.rideView = sc.extra === 'ride-outside' ? 'outside' : 'window';
        if (sc.to) {
          openRidePicker(B_STATIONS[sc.st]);
          const col = B_COLS.indexOf(sc.to[0]);
          BL.ride.sel = { col, row: B_LINES[sc.to[0]].stations.findIndex(s => s.id === sc.to[1]) };
          confirmRide(); for (let i = 0; i < 220; i++) cityTick(1 / 60); BL.ride.caption = null;
        }
        if (sc.extra === 'steam') { startSteamRide(0); for (let i = 0; i < 200; i++) cityTick(1 / 60); }
        if (sc.extra === 'auto') { BL.waypoint = { id: 'glasshouse', name: 'Lalbagh Glass House', ...B_POSTCARDS.find(p => p.id === 'glasshouse') }; startAutoRide(B_AUTO_STANDS[1]); for (let i = 0; i < 160; i++) cityTick(1 / 60); BL.ride.caption = null; }
      }, sc);
    } else await page.evaluate(() => goToTitle());
    await new Promise(r => setTimeout(r, 120));
    await page.screenshot({ path: path.join(OUT, `${sc.name}.png`) });
  }
  report('shots', `${scenes.length} screenshots saved to tests/output/`, errors);
  await page.close();
}

// ---------------------------------------------------------------------------
let BASE;
const server = await serve();
BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
console.log(`Testing ${BASE}${QUICK ? ' (quick)' : ''}\n`);
try {
  if (want('boot')) await suiteBoot(browser);
  if (want('text')) await suiteText(browser);
  if (want('city')) await suiteCity(browser);
  if (want('modes')) await suiteModes(browser);
  if (want('shots')) await suiteShots(browser);
} catch (e) {
  report('runner', 'crashed', [e.stack]);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter(r => r.problems.length);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
