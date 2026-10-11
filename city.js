'use strict';

// ---------------------------------------------------------------------------
// Bengaluru mode: building the city, life on its streets, rides, drawing and
// the HUD. The layout lives in city-data.js and the pixel art in city-art.js.
//
// Walk anywhere, collect a postcard at every landmark, ride Namma Metro, and
// switch views: street, drone, Malgudi sketch (ink on paper, after R.K.
// Laxman's drawings for Malgudi Days) and close-up. M opens the city map,
// where a destination can be marked.
// ---------------------------------------------------------------------------
const BCELL = 4, BGW = BW / BCELL, BGH = BH / BCELL;   // collision grid
const DECK = 20;                                        // metro viaduct height
const TILE = 512;                                       // ground is drawn in tiles
const BUCKET = 256;                                     // props are bucketed for culling

const BL = { built: false };
const bkit = {
  kind: 'kitten', facing: 1, walkT: 0, blinkT: 2, atkT: 0, combo: 1, yarn: 0, catnip: 0, dashT: 0,
  plunge: false, sprint: false, airborne: false, sleeping: false, scaredT: 0, hurtT: 0,
};

const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad;
const inEll = (x, y, e, rx = e.rx, ry = e.ry) => ((x - e.x) / rx) ** 2 + ((y - e.y) / ry) ** 2 < 1;
const bRoadAt = (x, y, pad = 0) => {
  let best = null;
  for (const r of B_ROADS) if (inRect(x, y, r, pad) && (!best || r.small)) best = r;
  return best;
};
const bDistrictAt = (x, y) => B_DISTRICTS.find(d => inRect(x, y, d)) || B_DISTRICTS[0];

// ---------------------------------------------------------------------------
// Metro lines are polylines; positions along them are distances `s`.
// ---------------------------------------------------------------------------
function setupLines() {
  for (const L of Object.values(B_LINES)) {
    L.segs = [];
    let s = 0;
    for (let i = 0; i < L.pts.length - 1; i++) {
      const [x0, y0] = L.pts[i], [x1, y1] = L.pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      L.segs.push({ x0, y0, x1, y1, s0: s, len, axis: y0 === y1 ? 'h' : 'v' });
      s += len;
    }
    L.len = s;
    for (const st of L.stations) st.s = lineProject(L, st.x, st.y).s;
  }
}

function linePoint(L, s) {
  s = clamp(s, 0, L.len);
  let g = L.segs[L.segs.length - 1];
  for (const seg of L.segs) if (s <= seg.s0 + seg.len) { g = seg; break; }
  const k = g.len ? (s - g.s0) / g.len : 0;
  return { x: g.x0 + (g.x1 - g.x0) * k, y: g.y0 + (g.y1 - g.y0) * k, axis: g.axis };
}

function lineProject(L, x, y) {
  let best = { s: 0, d: Infinity };
  for (const g of L.segs) {
    const dx = g.x1 - g.x0, dy = g.y1 - g.y0;
    const k = clamp(((x - g.x0) * dx + (y - g.y0) * dy) / (dx * dx + dy * dy), 0, 1);
    const d = Math.hypot(x - (g.x0 + dx * k), y - (g.y0 + dy * k));
    if (d < best.d) best = { s: g.s0 + g.len * k, d };
  }
  return best;
}

setupLines();

// Stations by id, with the spot on the footpath where you climb the stairs.
const B_STATIONS = (() => {
  const out = {};
  for (const [lid, L] of Object.entries(B_LINES)) {
    for (const st of L.stations) {
      if (!out[st.id]) {
        const axis = linePoint(L, st.s).axis;
        const exit = B_INTERCHANGES[st.id] ? { ...B_INTERCHANGES[st.id] } : axis === 'h' ? { x: st.x, y: st.y + 28 } : { x: st.x + 26, y: st.y };
        out[st.id] = { id: st.id, name: st.name, lines: [], ...exit };
      }
      out[st.id].lines.push(lid);
    }
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Building the city.
// ---------------------------------------------------------------------------
function buildCity() {
  const sprites = {};
  for (const [k, fn] of Object.entries(B_ART)) if (fn.length === 0) sprites[k] = fn();
  sprites.buglerock = B_ART.rock();
  sprites.stairsP = B_ART.stairs(B_LINES.purple.col);
  sprites.stairsG = B_ART.stairs(B_LINES.green.col);
  for (let i = 0; i < 6; i++) sprites[`jhouse${i}`] = bHouseJ(i);
  for (let i = 0; i < 4; i++) sprites[`mhouse${i}`] = bHouseM(i);
  // Give the flat elevations depth: roofs and side walls.
  for (const k of Object.keys(sprites)) {
    const d = B_DEPTH[k] || B_DEPTH[k.replace(/\d+$/, '')];
    if (d) sprites[k] = bExtrude(sprites[k], d[0], d[1] || 0);
    if (B_DECOR[k]) B_DECOR[k](sprites[k].getContext('2d'), sprites[k].oy || 0);
  }
  const shops = new Map();
  for (const b of B_BUILDINGS) {
    if (!b.shop) continue;
    const key = b.shop.join();
    if (!shops.has(key)) shops.set(key, bExtrude(B_ART.shop(...b.shop), B_DEPTH.shop[0]));
    b.img = shops.get(key);
  }
  for (const b of B_BUILDINGS) if (!b.img) b.img = sprites[b.spr];
  BL.spr = sprites;
  BL.treeSpr = {};
  for (const kind of Object.keys(B_TREES)) BL.treeSpr[kind] = [0, 1, 2].map(i => bTree(kind, i * 31 + kind.length * 7));

  BL.statics = [];
  for (const b of B_BUILDINGS) {
    const img = b.img;
    BL.statics.push({ kind: 'bld', b, img, x: Math.round(b.x - (img.fw || img.width) / 2), y: b.y - img.height + 1, base: b.y, w: img.width, h: img.height });
  }
  buildBlockedMask();
  placeTrees();
  placeLamps();
  for (const [x, y] of [[2300, 1700], [2600, 1820], [2200, 2100], [2850, 2000], [2150, 2690], [2420, 2690], [2550, 2950], [1650, 1600], [1900, 1900], [1700, 600], [4000, 690], [1250, 3200]]) addStatic(sprites.bench, x, y);
  for (const s of Object.values(B_STATIONS)) addStatic(s.lines.includes('green') && !s.lines.includes('purple') ? sprites.stairsG : sprites.stairsP, s.x + 14, s.y - 2);

  BL.buckets = new Map();
  for (const s of BL.statics) {
    const key = `${Math.floor((s.x + s.w / 2) / BUCKET)},${Math.floor(s.base / BUCKET)}`;
    if (!BL.buckets.has(key)) BL.buckets.set(key, []);
    BL.buckets.get(key).push(s);
  }
  BL.maxW = Math.max(...BL.statics.map(s => s.w));
  BL.maxH = Math.max(...BL.statics.map(s => s.h));
  buildGroundOps();
  BL.tiles = new Map();
  buildSolid();
  buildMini();
  BL.built = true;
}

function addStatic(img, x, base, extra = {}) {
  BL.statics.push({ kind: 'img', img, x: Math.round(x - img.width / 2), y: base - img.height + 1, base, w: img.width, h: img.height, ...extra });
}

// Laterite paths through the parks.
const B_PATHS = [
  { x0: 2064, y0: 1760, x1: 3006, y1: 1760, w: 9 },
  { x0: 2560, y0: 1414, x1: 2560, y1: 2286, w: 9 },
  { x0: 2100, y0: 2260, x1: 2480, y1: 1900, w: 8 },
  { x0: 2064, y0: 2120, x1: 3006, y1: 2120, w: 8 },
  { x0: 1514, y0: 2660, x1: 3006, y1: 2660, w: 9 },
  { x0: 2050, y0: 2314, x1: 2050, y1: 3046, w: 9 },
  { x0: 2050, y0: 2760, x1: 1820, y1: 2940, w: 8 },
  { x0: 1600, y0: 1500, x1: 1950, y1: 1500, w: 8 },
  { x0: 1775, y0: 1730, x1: 1775, y1: 2200, w: 8 },
];
function segDist(x, y, p) {
  const dx = p.x1 - p.x0, dy = p.y1 - p.y0;
  const k = clamp(((x - p.x0) * dx + (y - p.y0) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - (p.x0 + dx * k), y - (p.y0 + dy * k));
}

// A coarse mask of places where trees and fish must not go.
function buildBlockedMask() {
  const C = 8, gw = BW / C, gh = BH / C;
  const m = new Uint8Array(gw * gh);
  const mark = (x0, y0, x1, y1) => {
    for (let cy = Math.max(0, Math.floor(y0 / C)); cy <= Math.min(gh - 1, Math.floor(y1 / C)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / C)); cx <= Math.min(gw - 1, Math.floor(x1 / C)); cx++) m[cy * gw + cx] = 1;
  };
  const markEll = (e, rx, ry) => mark(e.x - rx, e.y - ry, e.x + rx, e.y + ry);
  for (const r of B_ROADS) mark(r.x - 8, r.y - 8, r.x + r.w + 8, r.y + r.h + 8);
  for (const b of B_BUILDINGS) {
    const front = b.house || !b.mcol ? 10 : 34;
    mark(b.x - b.img.width / 2 - 4, b.y - b.img.height * 0.55, b.x + b.img.width / 2 + 4, b.y + front);
  }
  for (const l of B_LAKES) markEll(l, l.rx + 16, l.ry + 14);
  markEll(B_STADIUM, B_STADIUM.rx + 12, B_STADIUM.ry + 12);
  markEll(B_TRACK, B_TRACK.rx + 10, B_TRACK.ry + 10);
  markEll(B_CLOCK, B_CLOCK.r + 10, B_CLOCK.r + 10);
  mark(0, RAIL_Y - 30, 1500, RAIL_Y + 44);
  for (const p of B_PATHS) {
    const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
    for (let i = 0; i <= len; i += 6) { const x = p.x0 + (p.x1 - p.x0) * i / len, y = p.y0 + (p.y1 - p.y0) * i / len; mark(x - 8, y - 8, x + 8, y + 8); }
  }
  for (const L of Object.values(B_LINES)) for (const g of L.segs) mark(Math.min(g.x0, g.x1) - 14, Math.min(g.y0, g.y1) - 40, Math.max(g.x0, g.x1) + 14, Math.max(g.y0, g.y1) + 14);
  for (const st of Object.values(B_STATIONS)) mark(st.x - 30, st.y - 30, st.x + 30, st.y + 20);
  for (const n of B_NPCS) mark(n.x - 24, n.y - 24, n.x + 24, n.y + 16);
  for (const pc of B_POSTCARDS) mark(pc.x - 22, pc.y - 22, pc.x + 22, pc.y + 16);
  BL.mask = { m, C, gw, gh };
}
const bMasked = (x, y) => x < 0 || y < 0 || x >= BW || y >= BH || BL.mask.m[Math.floor(y / BL.mask.C) * BL.mask.gw + Math.floor(x / BL.mask.C)] === 1;

function placeTrees() {
  const rnd = seeded(2011);
  BL.pinkTrees = [];
  const near = new Map();
  const tryTree = (kind, x, y, spacing = 26, force = false) => {
    if (!force && bMasked(x, y)) return false;
    const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of near.get(`${cx + i},${cy + j}`) || []) if (Math.abs(p.x - x) < spacing && Math.abs(p.y - y) < spacing * 0.7) return false;
    const key = `${cx},${cy}`;
    if (!near.has(key)) near.set(key, []);
    near.get(key).push({ x, y });
    const img = BL.treeSpr[kind][Math.floor(rnd() * 3)];
    addStatic(img, x, y, { tree: kind, trunk: true });
    if (kind === 'pink') BL.pinkTrees.push({ x, y, h: img.height });
    return true;
  };
  const mix = {
    Rajajinagar: [['rain', 3], ['coconut', 2], ['pink', 1]],
    Vijayanagar: [['rain', 3], ['coconut', 2], ['gulmohar', 1]],
    Malleswaram: [['coconut', 3], ['rain', 3], ['pink', 1]],
    'Sankey Tank': [['rain', 4], ['pink', 2], ['gulmohar', 1]],
    'Bangalore Palace': [['rain', 5], ['royal', 1], ['gulmohar', 1]],
    'Commercial Street': [['rain', 1]],
    Ulsoor: [['rain', 4], ['coconut', 2], ['pink', 1]],
    Majestic: [['rain', 2], ['coconut', 1]],
    'Race Course': [['rain', 5], ['gulmohar', 2]],
    'Vidhana Soudha': [['rain', 5], ['gulmohar', 2], ['pink', 2], ['royal', 1]],
    Chinnaswamy: [['rain', 5], ['gulmohar', 1], ['pink', 1]],
    Indiranagar: [['rain', 3], ['pink', 2]],
    'Freedom Park': [['rain', 4], ['gulmohar', 2]],
    'Cubbon Park': [['rain', 5], ['pink', 3], ['bamboo', 1], ['gulmohar', 2]],
    'MG Road': [['rain', 2], ['pink', 1]],
    'K.R. Market': [['rain', 1], ['coconut', 1]],
    Basavanagudi: [['rain', 3], ['coconut', 2], ['pink', 1]],
    Lalbagh: [['rain', 4], ['pink', 3], ['royal', 2], ['gulmohar', 2]],
    Jayanagar: [['pink', 3], ['coconut', 1], ['rain', 1]],
    Koramangala: [['rain', 2], ['pink', 1], ['coconut', 1]],
  };
  // Pink tabebuia avenues first: Jayanagar streets, Cubbon Park's path.
  for (const y of [3246, 3274, 3416, 3444]) for (let x = 1540; x < 2990; x += 40) if (Math.abs(x - 2050) > 30 && Math.abs(x - 2550) > 20) tryTree('pink', x + (y === 3274 || y === 3444 ? 20 : 0), y, 22, true);
  for (let x = 2080; x < 3000; x += 34) { tryTree('pink', x, 1752, 20); tryTree('pink', x + 17, 1774, 20); }
  for (let y = 2340; y < 2650; y += 50) { tryTree('royal', 2030, y, 20); tryTree('royal', 2070, y, 20); }
  for (const d of B_DISTRICTS) {
    const kinds = mix[d.name];
    const total = kinds.reduce((s, k) => s + k[1], 0);
    const count = Math.round(d.w * d.h / (d.name === 'Cubbon Park' || d.name === 'Lalbagh' ? 4200 : 12000));
    for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
      const x = d.x + 10 + rnd() * (d.w - 20), y = d.y + 20 + rnd() * (d.h - 24);
      let pr = rnd() * total, kind = kinds[0][0];
      for (const [k, w] of kinds) { pr -= w; if (pr <= 0) { kind = k; break; } }
      if (tryTree(kind, Math.round(x), Math.round(y))) n++;
    }
  }
}

function placeLamps() {
  const img = BL.spr.lamp;
  BL.lamps = [];
  const lamp = (x, y) => { addStatic(img, x, y, { lamp: true }); BL.lamps.push({ x, y: y - 24 }); };
  for (const r of B_ROADS) {
    if (r.dirt || r.small) continue;
    if (r.w > r.h) for (let x = r.x + 40; x < r.x + r.w - 20; x += 96) { lamp(x, r.y - 3); lamp(x + 48, r.y + r.h + 7); }
    else for (let y = r.y + 40; y < r.y + r.h - 20; y += 96) { lamp(r.x - 4, y); lamp(r.x + r.w + 4, y + 48); }
  }
  for (let x = 60; x < 740; x += 120) lamp(x, 1383);
}

// ---------------------------------------------------------------------------
// The ground is a list of drawing operations, replayed per 512px tile on
// demand (and once at 1/8 scale for the minimap).
// ---------------------------------------------------------------------------
function buildGroundOps() {
  const ops = [];
  const rnd = seeded(1986);
  const op = (x0, y0, x1, y1, draw, detail = false) => ops.push({ x0, y0, x1, y1, draw, detail });
  const rect = (col, x, y, w, h, detail = false) => op(x, y, x + w, y + h, c => { c.fillStyle = col; c.fillRect(x, y, w, h); }, detail);
  const ell = (col, e, rx, ry) => op(e.x - rx, e.y - ry, e.x + rx, e.y + ry, c => { c.fillStyle = col; pixEllipse(c, e.x, e.y, Math.round(rx), Math.round(ry)); });
  const disc = (col, x, y, r) => op(x - r, y - r, x + r, y + r, c => { c.fillStyle = col; pixDisc(c, x, y, r); });
  const ring = (col, e, rx, ry) => op(e.x - rx - 1, e.y - ry - 1, e.x + rx + 1, e.y + ry + 1, c => {
    c.fillStyle = col;
    for (let a = 0; a < Math.PI * 2; a += 0.6 / Math.max(rx, ry)) c.fillRect(Math.round(e.x + Math.cos(a) * rx), Math.round(e.y + Math.sin(a) * ry), 1, 1);
  });
  // Many small specks, bucketed so each tile only replays its own.
  const specks = (items, detail = true) => {
    const groups = new Map();
    for (const it of items) {
      const key = `${Math.floor(it[0] / 256)},${Math.floor(it[1] / 256)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    }
    for (const list of groups.values()) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y, w, h] of list) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
      op(x0, y0, x1, y1, c => { for (const [x, y, w, h, col] of list) { c.fillStyle = col; c.fillRect(x, y, w, h); } }, detail);
    }
  };

  rect('#5d8a3e', 0, 0, BW, BH);
  for (const d of B_DISTRICTS) rect(d.ground, d.x, d.y, d.w, d.h);
  // Grass verges in the busier districts.
  for (const name of ['Jayanagar', 'Majestic', 'K.R. Market', 'Koramangala', 'Malleswaram', 'Basavanagudi', 'Commercial Street', 'Indiranagar', 'Rajajinagar', 'Vijayanagar']) {
    const d = B_DISTRICTS.find(x => x.name === name);
    for (let i = 0; i < d.w * d.h / 9000; i++) ell('#9db86a', { x: d.x + 10 + rnd() * (d.w - 20), y: d.y + 10 + rnd() * (d.h - 20) }, 6 + Math.round(rnd() * 10), 3 + Math.round(rnd() * 4));
  }
  // Mowed stripes on the Vidhana Soudha and Palace lawns, tiles on plazas.
  const stripes = [];
  for (let y = 774; y < 1386; y += 16) stripes.push([2064, y, 942, 8, '#86b45b']);
  for (let y = 0; y < 746; y += 16) stripes.push([2064, y, 942, 8, '#86b45b']);
  specks(stripes, false);
  rect('#d9d2c2', 2480, 1370, 320, 16);
  const tiles = [];
  for (const d of B_DISTRICTS.filter(x => ['MG Road', 'Commercial Street', 'Indiranagar', 'Koramangala'].includes(x.name))) {
    for (let x = d.x; x < d.x + d.w; x += 10) tiles.push([x, d.y, 1, d.h, '#b5a992']);
    for (let y = d.y; y < d.y + d.h; y += 10) tiles.push([d.x, y, d.w, 1, '#b5a992']);
  }
  specks(tiles);
  // Flower beds.
  for (const [x, y] of [[2490, 1340], [2740, 1340], [2400, 2700], [2480, 2700], [2400, 2730], [2480, 2730], [1600, 2400], [1650, 2440], [2700, 2400], [2560, 2400], [2300, 1820], [2800, 2200], [1700, 1560], [2420, 680], [2620, 680]]) {
    rect('#5a3a26', x, y, 50, 18);
    const dots = [];
    for (let i = 0; i < 60; i++) dots.push([x + 1 + Math.floor(rnd() * 48), y + 1 + Math.floor(rnd() * 16), 1, 1, ['#d8433b', '#f4a3b8', '#ffffff', '#f2c94c', '#c3a0ec'][Math.floor(rnd() * 5)]]);
    specks(dots);
  }

  // Race course: dirt oval, striped infield, white rails.
  const T = B_TRACK, irx = T.rx - T.w, iry = T.ry - T.w;
  ell('#b98a5a', T, T.rx, T.ry);
  op(T.x - irx, T.y - iry, T.x + irx, T.y + iry, c => {
    for (let dy = -iry; dy <= iry; dy++) {
      const half = Math.round(irx * Math.sqrt(1 - (dy / iry) ** 2));
      c.fillStyle = Math.floor((dy + iry) / 8) % 2 ? '#7fb44f' : '#8cc05a';
      c.fillRect(T.x - half, T.y + dy, half * 2 + 1, 1);
    }
  });
  ring('#f4f1ea', T, T.rx, T.ry);
  ring('#f4f1ea', T, irx, iry);
  rect('#f4f1ea', T.x + 60, T.y + iry, 2, T.w);

  // Chinnaswamy: tiers in red and gold, green field, the pitch, the gate.
  const S = B_STADIUM;
  ['#5d6369', '#c0392b', '#a3a9ae', '#c9a227', '#8a8f96', '#c0392b', '#a3a9ae', '#2b2220'].forEach((col, i, all) => {
    const k = i / all.length;
    ell(col, S, S.rx - (S.rx - S.irx) * k, S.ry - (S.ry - S.iry) * k);
  });
  const crowd = [];
  for (let i = 0; i < 3000; i++) {
    const a = rnd() * Math.PI * 2, k = 0.08 + rnd() * 0.85;
    crowd.push([Math.round(S.x + Math.cos(a) * (S.irx + (S.rx - S.irx) * k)), Math.round(S.y + Math.sin(a) * (S.iry + (S.ry - S.iry) * k)), 1, 1, ['#f1ead8', '#d8433b', '#f2c94c', '#2b2220', '#5b8ee0'][Math.floor(rnd() * 5)]]);
  }
  specks(crowd);
  op(S.x - S.irx, S.y - S.iry, S.x + S.irx, S.y + S.iry, c => {
    for (let dy = -S.iry; dy <= S.iry; dy++) {
      const half = Math.round(S.irx * Math.sqrt(1 - (dy / S.iry) ** 2));
      c.fillStyle = Math.floor((dy + S.iry) / 7) % 2 ? '#5fa040' : '#6aae49';
      c.fillRect(S.x - half, S.y + dy, half * 2 + 1, 1);
    }
  });
  ring('#f4f1ea', S, S.irx - 8, S.iry - 6);
  rect('#d6c08a', S.x - 4, S.y - 14, 9, 28);
  rect('#8a8f96', S.x - 12, S.y + S.iry - 2, 24, S.ry - S.iry + 6);

  // Lakes, with islands and a footpath round them.
  for (const l of B_LAKES) {
    ell('#c78a5a', l, l.rx + 16, l.ry + 14);
    ell('#c9b48a', l, l.rx + 5, l.ry + 4);
    ell('#3f7fa6', l, l.rx, l.ry);
    ell('#4f93bb', l, l.rx - 6, l.ry - 4);
    const glints = [];
    for (let i = 0; i < l.rx / 3; i++) glints.push([Math.round(l.x + (rnd() - 0.5) * l.rx * 1.4), Math.round(l.y + (rnd() - 0.5) * l.ry * 1.2), 3, 1, '#8cc4e0']);
    specks(glints);
    for (const isl of l.islands || []) { ell('#c9b48a', isl, isl.rx + 3, isl.ry + 3); ell('#5a8a3e', isl, isl.rx, isl.ry); }
  }
  // Lalbagh's flower clock.
  disc('#3f6f2e', B_CLOCK.x, B_CLOCK.y, B_CLOCK.r + 3);
  disc('#d8433b', B_CLOCK.x, B_CLOCK.y, B_CLOCK.r);
  disc('#f2c94c', B_CLOCK.x, B_CLOCK.y, B_CLOCK.r - 3);
  disc('#7cab52', B_CLOCK.x, B_CLOCK.y, B_CLOCK.r - 6);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rect('#ffffff', Math.round(B_CLOCK.x + Math.sin(a) * (B_CLOCK.r - 9)) - 1, Math.round(B_CLOCK.y - Math.cos(a) * (B_CLOCK.r - 9)) - 1, 2, 2); }
  // Paths.
  for (const p of B_PATHS) {
    const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
    op(Math.min(p.x0, p.x1) - p.w, Math.min(p.y0, p.y1) - p.w, Math.max(p.x0, p.x1) + p.w, Math.max(p.y0, p.y1) + p.w, c => {
      for (const [col, grow] of [['#b07650', 1], ['#c78a5a', 0]]) {
        c.fillStyle = col;
        for (let i = 0; i <= len; i++) c.fillRect(Math.round(p.x0 + (p.x1 - p.x0) * i / len - p.w / 2) - grow, Math.round(p.y0 + (p.y1 - p.y0) * i / len - p.w / 2) - grow, p.w + grow * 2, p.w + grow * 2);
      }
    });
  }

  // The railway into KSR and its platform.
  rect('#bdb5a5', 1000, 1068, 480, 32); rect('#e8d36a', 1000, 1068, 480, 1);
  rect('#9a948a', 0, RAIL_Y - 8, 1480, 17);
  const sleepers = [];
  for (let x = 0; x < 1480; x += 5) sleepers.push([x, RAIL_Y - 6, 3, 13, '#6b4a32']);
  specks(sleepers, false);
  rect('#8a8f96', 0, RAIL_Y - 4, 1480, 1); rect('#8a8f96', 0, RAIL_Y + 3, 1480, 1);
  rect('#c9ced2', 0, RAIL_Y - 5, 1480, 1); rect('#c9ced2', 0, RAIL_Y + 2, 1480, 1);

  // Roads: footpaths, carriageways, then the paint.
  const asph = B_ROADS.filter(r => !r.dirt);
  for (const rd of B_ROADS.filter(r => r.dirt)) {
    rect('#b39066', rd.x, rd.y, rd.w, rd.h);
    const ruts = [];
    for (let i = 0; i < rd.w * rd.h / 30; i++) ruts.push([rd.x + Math.floor(rnd() * rd.w), rd.y + Math.floor(rnd() * rd.h), 2, 1, '#9e7c52']);
    specks(ruts);
    if (rd.w > rd.h) { rect('#a3825a', rd.x, rd.y + 6, rd.w, 1); rect('#a3825a', rd.x, rd.y + rd.h - 7, rd.w, 1); }
    else { rect('#a3825a', rd.x + 7, rd.y, 1, rd.h); rect('#a3825a', rd.x + rd.w - 8, rd.y, 1, rd.h); }
  }
  for (const rd of asph) {
    const p = rd.small ? 4 : 6;
    rect('#b9ae99', rd.x - p, rd.y - p, rd.w + p * 2, rd.h + p * 2);
    const grid = [];
    for (let x = rd.x - p; x < rd.x + rd.w + p; x += 6) grid.push([x, rd.y - p, 1, rd.h + p * 2, '#a99d88']);
    for (let y = rd.y - p; y < rd.y + rd.h + p; y += 6) grid.push([rd.x - p, y, rd.w + p * 2, 1, '#a99d88']);
    specks(grid);
  }
  for (const c0 of B_CIRCLES) disc('#56595f', c0.x, c0.y, c0.r + 4);
  for (const rd of asph) rect('#d8d2c4', rd.x - 1, rd.y - 1, rd.w + 2, rd.h + 2);
  for (const rd of asph) rect(rd.small ? '#62656b' : '#56595f', rd.x, rd.y, rd.w, rd.h);
  for (const c0 of B_CIRCLES) {
    disc('#56595f', c0.x, c0.y, c0.r);
    disc('#d8d2c4', c0.x, c0.y, c0.garden + 2);
    disc('#6fa04a', c0.x, c0.y, c0.garden);
  }
  const onOther = (x, y, self) => asph.some(o => o !== self && inRect(x, y, o, 2)) || B_CIRCLES.some(c0 => Math.hypot(x - c0.x, y - c0.y) < c0.r + 2);
  const paint = [];
  for (const rd of asph) {
    if (rd.small) continue;
    if (rd.w > rd.h) { const y = rd.y + rd.h / 2; for (let x = rd.x; x < rd.x + rd.w; x += 14) if (!onOther(x, y, rd) && !onOther(x + 8, y, rd)) paint.push([x, y, 8, 1, '#ece6d4']); }
    else { const x = rd.x + rd.w / 2; for (let y = rd.y; y < rd.y + rd.h; y += 14) if (!onOther(x, y, rd) && !onOther(x, y + 8, rd)) paint.push([x, y, 1, 8, '#ece6d4']); }
  }
  for (const h of asph.filter(r => r.w > r.h)) for (const v of asph.filter(r => r.h > r.w)) {
    if (v.x + v.w < h.x || v.x > h.x + h.w || h.y + h.h < v.y - 2 || h.y > v.y + v.h + 2) continue;
    for (const x0 of [v.x - 12, v.x + v.w + 4]) if (inRect(x0, h.y + 2, h)) for (let y = h.y + 2; y < h.y + h.h - 2; y += 4) paint.push([x0, y, 8, 2, '#ece6d4']);
    for (const y0 of [h.y - 12, h.y + h.h + 4]) if (inRect(v.x + 2, y0, v)) for (let x = v.x + 2; x < v.x + v.w - 2; x += 4) paint.push([x, y0, 2, 8, '#ece6d4']);
  }
  specks(paint, false);
  // Viaduct shadows.
  for (const L of Object.values(B_LINES)) for (const g of L.segs) {
    op(Math.min(g.x0, g.x1), Math.min(g.y0, g.y1) - 4, Math.max(g.x0, g.x1) + 14, Math.max(g.y0, g.y1) + 4, c => {
      c.globalAlpha = 0.16; c.fillStyle = '#000000';
      if (g.axis === 'h') c.fillRect(Math.min(g.x0, g.x1), g.y0 - 4, Math.abs(g.x1 - g.x0), 8);
      else c.fillRect(g.x0 + 6, Math.min(g.y0, g.y1), 8, Math.abs(g.y1 - g.y0));
      c.globalAlpha = 1;
    });
  }
  // Fallen petals under pink trees, kolams in front of homes.
  const petals = [];
  for (const t of BL.pinkTrees) for (let i = 0; i < 26; i++) petals.push([Math.round(t.x + (rnd() - 0.5) * 34), Math.round(t.y + (rnd() - 0.3) * 14), 1, 1, rnd() < 0.5 ? '#f3a6c8' : '#e98bb5']);
  specks(petals);
  const kolam = [];
  for (const b of B_BUILDINGS) {
    if (!b.house) continue;
    const kx = b.x - 14, ky = b.y + 4;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) kolam.push([kx + i * 2, ky + j * 2, 1, 1, '#ffffff']);
    kolam.push([kx + 4, ky + 2, 1, 1, b.house === 'j' ? '#d8433b' : '#f2c94c']);
  }
  specks(kolam);
  BL.groundOps = ops;
}

function groundTile(tx, ty) {
  const key = `${tx},${ty}`;
  let cv = BL.tiles.get(key);
  if (cv) { BL.tiles.delete(key); BL.tiles.set(key, cv); return cv; }
  cv = document.createElement('canvas');
  cv.width = cv.height = TILE;
  const c = cv.getContext('2d');
  const x0 = tx * TILE, y0 = ty * TILE;
  c.translate(-x0, -y0);
  for (const o of BL.groundOps) if (o.x1 > x0 && o.x0 < x0 + TILE && o.y1 > y0 && o.y0 < y0 + TILE) o.draw(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  // Texture: a sprinkle of lighter and darker pixels, fixed to the world.
  const img = c.getImageData(0, 0, TILE, TILE), d = img.data;
  for (let y = 0, i = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++, i += 4) {
      let s = Math.imul(((y0 + y) * BW + x0 + x) ^ 0x9e3779b9, 0x85ebca6b);
      s ^= s >>> 13;
      s = Math.imul(s, 0xc2b2ae35);
      const f = ((s >>> 8) & 1023) / 1024;
      const dv = f < 0.09 ? -12 : f > 0.95 ? 9 : 0;
      if (dv) { d[i] = clamp(d[i] + dv, 0, 255); d[i + 1] = clamp(d[i + 1] + dv, 0, 255); d[i + 2] = clamp(d[i + 2] + dv, 0, 255); }
    }
  }
  c.putImageData(img, 0, 0);
  BL.tiles.set(key, cv);
  while (BL.tiles.size > 48) BL.tiles.delete(BL.tiles.keys().next().value);
  return cv;
}

// Draws one ground tile ahead of time near the camera, so walking stays smooth.
function warmTiles() {
  const c = BL.cam;
  if (!c) return;
  for (let ty = Math.floor((c.y - TILE / 2) / TILE); ty <= Math.floor((c.y + c.h + TILE / 2) / TILE); ty++) {
    for (let tx = Math.floor((c.x - TILE / 2) / TILE); tx <= Math.floor((c.x + c.w + TILE / 2) / TILE); tx++) {
      if (tx < 0 || ty < 0 || tx * TILE >= BW || ty * TILE >= BH || BL.tiles.has(`${tx},${ty}`)) continue;
      groundTile(tx, ty);
      return;
    }
  }
}

function buildSolid() {
  const g = new Uint8Array(BGW * BGH);
  const mark = (x0, y0, x1, y1) => {
    for (let cy = Math.max(0, Math.floor(y0 / BCELL)); cy <= Math.min(BGH - 1, Math.floor((y1 - 1) / BCELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / BCELL)); cx <= Math.min(BGW - 1, Math.floor((x1 - 1) / BCELL)); cx++) g[cy * BGW + cx] = 1;
  };
  const fill = (x0, y0, x1, y1, test) => {
    for (let cy = Math.max(0, Math.floor(y0 / BCELL)); cy <= Math.min(BGH - 1, Math.floor(y1 / BCELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / BCELL)); cx <= Math.min(BGW - 1, Math.floor(x1 / BCELL)); cx++)
        if (test(cx * BCELL + 2, cy * BCELL + 2)) g[cy * BGW + cx] = 1;
  };
  for (const b of B_BUILDINGS) if (b.fw) mark(b.x - b.fw / 2, b.y - b.fd, b.x + b.fw / 2, b.y);
  for (const s of BL.statics) if (s.trunk) mark(s.x + s.w / 2 - 2, s.base - 2, s.x + s.w / 2 + 2, s.base + 1);
  for (const l of B_LAKES) fill(l.x - l.rx, l.y - l.ry, l.x + l.rx, l.y + l.ry, (x, y) => inEll(x, y, l, l.rx - 2, l.ry - 2));
  const S = B_STADIUM;
  fill(S.x - S.rx, S.y - S.ry, S.x + S.rx, S.y + S.ry, (x, y) => inEll(x, y, S) && !inEll(x, y, S, S.irx, S.iry) && !(Math.abs(x - S.x) < 12 && y > S.y));
  for (const c0 of B_CIRCLES) fill(c0.x - c0.garden, c0.y - c0.garden, c0.x + c0.garden, c0.y + c0.garden, (x, y) => Math.hypot(x - c0.x, y - c0.y) < c0.garden);
  BL.solid = g;
}

function bSolid(x, y) {
  if (x < 2 || y < 2 || x >= BW - 2 || y >= BH - 2) return true;
  return BL.solid[Math.floor(y / BCELL) * BGW + Math.floor(x / BCELL)] === 1;
}

function buildMini() {
  const cv = document.createElement('canvas');
  cv.width = BW / 8;
  cv.height = BH / 8;
  const c = cv.getContext('2d');
  c.scale(1 / 8, 1 / 8);
  for (const o of BL.groundOps) if (!o.detail) o.draw(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (const s of BL.statics) {
    if (!s.tree) continue;
    c.fillStyle = s.tree === 'pink' ? '#e98bb5' : s.tree === 'gulmohar' ? '#d2552c' : '#3f6a33';
    c.fillRect(Math.round((s.x + s.w / 2) / 8) - 1, Math.round((s.base - 6) / 8) - 1, 2, 2);
  }
  for (const b of B_BUILDINGS) {
    if (!b.mcol || !b.fw) continue;
    const top = (b.y - b.fd - b.img.height * 0.3) / 8, h = (b.fd + b.img.height * 0.3) / 8;
    c.fillStyle = '#2b2220';
    c.fillRect(Math.round((b.x - b.fw / 2) / 8) - 1, Math.round(top) - 1, Math.ceil(b.fw / 8) + 2, Math.ceil(h) + 2);
    c.fillStyle = b.mcol;
    c.fillRect(Math.round((b.x - b.fw / 2) / 8), Math.round(top), Math.ceil(b.fw / 8), Math.ceil(h));
  }
  BL.mini = cv;
}

// ---------------------------------------------------------------------------
// Life in the city: traffic, trains, people and animals.
// ---------------------------------------------------------------------------
const B_VEH = {
  auto: { len: 18, wid: 9, vmax: 58 },
  bus: { len: 44, wid: 12, vmax: 42 },
  car: { len: 26, wid: 10, vmax: 52 },
  scooter: { len: 12, wid: 5, vmax: 62 },
};
const B_HONKS = ['HONK!', 'POM POM!', 'Side, side!', 'Beep beep!'];

// India drives on the left: eastbound traffic keeps to the north side.
const B_LANES = (() => {
  const out = [];
  for (const r of B_ROADS) {
    if (r.dirt || r.small) continue;
    if (r.w > r.h) {
      out.push({ road: r, axis: 'h', at: r.y + 10, dir: 1, from: r.x, to: r.x + r.w });
      out.push({ road: r, axis: 'h', at: r.y + 21, dir: -1, from: r.x, to: r.x + r.w });
    } else {
      out.push({ road: r, axis: 'v', at: r.x + 21, dir: 1, from: r.y, to: r.y + r.h });
      out.push({ road: r, axis: 'v', at: r.x + 7, dir: -1, from: r.y, to: r.y + r.h });
    }
  }
  return out;
})();

function resetCityLife() {
  const rnd = seeded(42);
  BL.vehicles = [];
  const types = ['auto', 'auto', 'auto', 'car', 'car', 'bus', 'scooter', 'scooter'];
  const cols = { car: ['#f4f1ea', '#c9ced2', '#d8433b', '#2f4f8a', '#2b2a33'], bus: ['#2f5fb3', '#c0392b', '#3fa34d'], scooter: ['#d8433b', '#5b8ee0', '#f2c94c', '#f4f1ea'] };
  for (const lane of B_LANES) {
    lane.cars = [];
    const span = lane.to - lane.from;
    const n = Math.max(1, Math.round(span / 340));
    for (let i = 0; i < n; i++) {
      const type = types[Math.floor(rnd() * types.length)];
      const def = B_VEH[type];
      const v = { lane, type, p: lane.from + (i + 0.2 + rnd() * 0.5) * span / n, v: def.vmax, vmax: def.vmax * (0.85 + rnd() * 0.3), honkCd: 0, col: cols[type] ? cols[type][Math.floor(rnd() * cols[type].length)] : null };
      BL.vehicles.push(v);
      lane.cars.push(v);
    }
  }
  BL.trains = [];
  for (const [id, L] of Object.entries(B_LINES)) {
    const st = L.stations;
    BL.trains.push({ line: id, s: st[0].s, dir: 1, next: 1, state: 'dwell', t: 2, v: 0 });
    BL.trains.push({ line: id, s: st[st.length - 1].s, dir: -1, next: st.length - 2, state: 'dwell', t: 5, v: 0 });
    BL.trains.push({ line: id, s: st[3].s, dir: 1, next: 4, state: 'dwell', t: 8, v: 0 });
  }
  BL.train = { x: -300, dir: 1, state: 'away', t: 4, v: 0 };
  BL.horses = [0, 1, 2, 3, 4].map(i => ({ a: i * 0.35, v: 0.3 + i * 0.012, lane: i % 3, col: ['#6b4a32', '#3a2618', '#8a6a4a', '#d9d2c4', '#2b2220'][i], silk: ['#d8433b', '#f2c94c', '#5b8ee0', '#7cc35a', '#c3a0ec'][i] }));
  BL.ducks = [];
  for (const l of B_LAKES) for (let i = 0; i < Math.round(l.rx / 30); i++) BL.ducks.push({ lake: l, x: l.x + (rnd() - 0.5) * l.rx, y: l.y + (rnd() - 0.5) * l.ry, vx: 0, vy: 0, t: rnd() * 5, white: i % 3 === 0 });
  BL.boats = [0, 1, 2].map(i => ({ a: i * 2.1, v: 0.05 + i * 0.01, col: ['#f2c94c', '#d8433b', '#ffffff'][i] }));
  BL.cows = [{ x: 500, y: 1180, lying: true }, { x: 2552, y: 3330, lying: false }, { x: 980, y: 2600, lying: false }, { x: 600, y: 2600, lying: true }, { x: 1300, y: 560, lying: true }, { x: 3900, y: 3300, lying: false }];
  BL.dogs = [{ x: 2300, y: 3430, tx: 2300, ty: 3430, t: 0, facing: 1, area: { x: 1540, y: 3250, w: 1440, h: 200 } }, { x: 3600, y: 2960, tx: 3600, ty: 2960, t: 0, facing: 1, area: { x: 3100, y: 2950, w: 1400, h: 40 } }];
  BL.pigeons = [];
  for (const [x, y] of [[2640, 1378], [760, 640], [2450, 1975], [2780, 3250], [1500, 1440], [1240, 1380], [1000, 2500], [990, 3320]]) {
    for (let i = 0; i < 8; i++) BL.pigeons.push({ hx: x + (rnd() - 0.5) * 40, hy: y + (rnd() - 0.5) * 10, x: 0, y: 0, h: 0, state: 'peck', t: rnd() * 3, vx: 0, vy: 0 });
  }
  for (const p of BL.pigeons) { p.x = p.hx; p.y = p.hy; }
  BL.npcs = B_NPCS.map(n => ({ ...n, tx: n.x, ty: n.y, facing: 1, moving: false, wait: rnd() * 3, line: 0, bubble: null }));
  BL.fishes = [];
  for (let tries = 0; BL.fishes.length < 180 && tries < 20000; tries++) {
    const x = 20 + rnd() * (BW - 40), y = 20 + rnd() * (BH - 40);
    const rd = bRoadAt(x, y);
    if (rd && !rd.dirt) continue;
    if (bSolid(x, y) || bSolid(x, y - 6) || (bMasked(x, y) && !rd)) continue;
    if (BL.fishes.some(f => Math.abs(f.x - x) < 120 && Math.abs(f.y - y) < 120)) continue;
    BL.fishes.push({ x, y, taken: false, seed: rnd() * 6 });
  }
}

function vehPos(v) {
  const L = v.lane, def = B_VEH[v.type];
  let x = L.axis === 'h' ? v.p : L.at, y = L.axis === 'h' ? L.at + def.wid / 2 : v.p + def.len / 2;
  // Swing round roundabouts.
  for (const c0 of B_CIRCLES) {
    const along = L.axis === 'h' ? v.p - c0.x : v.p - c0.y, across = L.axis === 'h' ? L.at - c0.y : L.at - c0.x;
    if (Math.abs(along) < 54 && Math.abs(across) < 20) {
      const off = Math.sign(across || 1) * 24 * Math.cos(along / 54 * Math.PI / 2);
      if (L.axis === 'h') y += off; else x += off;
    }
  }
  return { x, y };
}

function updateVehicles(dt) {
  const k = BL;
  for (const L of B_LANES) {
    for (const v of L.cars) {
      const def = B_VEH[v.type];
      let gap = Infinity;
      for (const o of L.cars) {
        if (o === v) continue;
        let d = (o.p - v.p) * L.dir;
        if (d < 0) d += L.to - L.from;
        gap = Math.min(gap, d - (B_VEH[o.type].len + def.len) / 2);
      }
      const along = L.axis === 'h' ? k.x : k.y, across = L.axis === 'h' ? k.y - def.wid / 2 : k.x;
      if (!k.ride && Math.abs(across - L.at) < def.wid / 2 + 5) {
        const d = (along - v.p) * L.dir - def.len / 2;
        if (d > -def.len && d < 46) {
          gap = Math.min(gap, Math.max(0, d - 4));
          if (v.honkCd <= 0 && d < 40) {
            v.honkCd = 2.5 + Math.random() * 2;
            bHorn(v.type);
            const p = vehPos(v);
            bText(p.x, p.y - 18, pick(B_HONKS), '#ffe08a');
          }
        }
      }
      v.honkCd -= dt;
      const pos = vehPos(v);
      const vmax = inRect(pos.x, pos.y, B_JAM) ? 7 : v.vmax;
      const target = gap < 6 ? 0 : gap < 36 ? vmax * (gap - 6) / 30 : vmax;
      v.v = v.v < target ? Math.min(target, v.v + 40 * dt) : Math.max(target, v.v - 160 * dt);
      v.p += v.v * L.dir * dt;
      if (L.dir > 0 && v.p > L.to) v.p = L.from;
      if (L.dir < 0 && v.p < L.from) v.p = L.to;
    }
  }
}

function updateTrains(dt) {
  for (const tr of BL.trains) {
    const L = B_LINES[tr.line];
    if (tr.state === 'dwell') {
      if ((tr.t -= dt) <= 0) tr.state = 'run';
      continue;
    }
    const target = L.stations[tr.next].s;
    const rem = (target - tr.s) * tr.dir;
    tr.v = Math.min(110, tr.v + 45 * dt, Math.sqrt(Math.max(0, 2 * 45 * rem)) + 3);
    tr.s += tr.v * tr.dir * dt;
    if ((target - tr.s) * tr.dir <= 0.5) {
      tr.s = target;
      tr.v = 0;
      tr.state = 'dwell';
      tr.t = 3.5;
      const p = linePoint(L, tr.s);
      if (bOnScreen(p.x, p.y, 40)) bChime(0.5);
      if (tr.next === L.stations.length - 1) tr.dir = -1;
      else if (tr.next === 0) tr.dir = 1;
      tr.next += tr.dir;
    }
  }
}

// Trains run in from the west to KSR Bengaluru City, wait, and pull out again.
function updateTrain(dt) {
  const s = BL.train;
  s.t -= dt;
  if (s.state === 'away' && s.t <= 0) { s.state = 'arrive'; s.x = -300; s.dir = 1; s.v = 80; if (bOnScreen(0, RAIL_Y, 600)) bWhistle(); }
  else if (s.state === 'arrive') {
    const rem = B_TRAIN_STOP - s.x;
    s.v = Math.max(6, Math.min(80, Math.sqrt(Math.max(0, 2 * 24 * rem))));
    s.x += s.v * dt;
    if (rem <= 0.5) { s.x = B_TRAIN_STOP; s.state = 'dwell'; s.t = 10; s.v = 0; }
  } else if (s.state === 'dwell' && s.t <= 0) { s.state = 'leave'; s.dir = -1; if (bOnScreen(s.x, RAIL_Y, 300)) bWhistle(); }
  else if (s.state === 'leave') {
    s.v = Math.min(80, s.v + 20 * dt);
    s.x -= s.v * dt;
    if (s.x < -320) { s.state = 'away'; s.t = 14; }
  }
}

function updateLife(dt) {
  const k = BL;
  updateVehicles(dt);
  updateTrains(dt);
  updateTrain(dt);
  for (const h of k.horses) h.a += h.v * dt * (0.9 + Math.sin(k.t * 0.7 + h.lane) * 0.15);
  for (const b of k.boats) b.a += b.v * dt;
  for (const d of k.ducks) {
    if ((d.t -= dt) <= 0) { d.t = 2 + Math.random() * 4; d.vx = (Math.random() - 0.5) * 10; d.vy = (Math.random() - 0.5) * 5; }
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (inEll(nx, ny, d.lake, d.lake.rx - 12, d.lake.ry - 10)) { d.x = nx; d.y = ny; } else { d.vx *= -1; d.vy *= -1; }
  }
  for (const dg of k.dogs) {
    if ((dg.t -= dt) <= 0) { dg.t = 3 + Math.random() * 4; dg.tx = dg.area.x + Math.random() * dg.area.w; dg.ty = dg.area.y + Math.random() * dg.area.h; }
    const dd = Math.hypot(dg.tx - dg.x, dg.ty - dg.y);
    if (dd > 2) { const s = Math.min(dd, 26 * dt); dg.x += (dg.tx - dg.x) / dd * s; dg.y += (dg.ty - dg.y) / dd * s; dg.facing = dg.tx > dg.x ? 1 : -1; }
  }
  for (const p of k.pigeons) {
    if (Math.abs(p.hx - k.x) > 400 || Math.abs(p.hy - k.y) > 300) continue;
    const near = Math.hypot(p.x - k.x, p.y - k.y) < 24;
    if (p.state === 'peck') {
      if (near) { p.state = 'fly'; p.vx = (p.x - k.x || 1) * 3 + (Math.random() - 0.5) * 40; p.vy = (Math.random() - 0.5) * 30; p.t = 4 + Math.random() * 3; if (Math.random() < 0.2) noise(0.2, 0.05, 2600); }
      else if ((p.t -= dt) <= 0) { p.t = 0.5 + Math.random() * 2; p.x = clamp(p.x + (Math.random() - 0.5) * 6, p.hx - 22, p.hx + 22); }
    } else if (p.state === 'fly') {
      p.h = Math.min(40, p.h + 60 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if ((p.t -= dt) <= 0) p.state = 'return';
    } else {
      const d = Math.hypot(p.hx - p.x, p.hy - p.y);
      const s = Math.min(d, 70 * dt);
      if (d > 0.5) { p.x += (p.hx - p.x) / d * s; p.y += (p.hy - p.y) / d * s; }
      p.h = Math.max(0, p.h - 30 * dt);
      if (d < 1 && p.h <= 0) { p.state = 'peck'; p.t = 1; }
    }
  }
  for (const n of k.npcs) {
    if (n.bubble && (n.bubble.t -= dt) <= 0) n.bubble = null;
    if (!n.area) continue;
    if (n.bubble) { n.moving = false; continue; }
    const d = Math.hypot(n.tx - n.x, n.ty - n.y);
    if (d < 1) {
      n.moving = false;
      if ((n.wait -= dt) <= 0) { n.wait = 1 + Math.random() * 3; n.tx = n.area.x + Math.random() * n.area.w; n.ty = n.area.y + Math.random() * n.area.h; }
    } else {
      const s = Math.min(d, (n.name === 'Jogger' ? 34 : 16) * dt);
      n.x += (n.tx - n.x) / d * s;
      n.y += (n.ty - n.y) / d * s;
      n.facing = n.tx > n.x ? 1 : -1;
      n.moving = true;
    }
  }
  const cam = k.cam;
  if (cam && k.petals.length < 140) {
    for (const t of k.pinkTrees) {
      if (t.x < cam.x - 20 || t.x > cam.x + cam.w + 20 || t.y < cam.y || t.y > cam.y + cam.h + 50) continue;
      if (Math.random() < dt * 0.9) k.petals.push({ x: t.x + rand(-14, 14), y: t.y + rand(-4, 6), h: t.h - 16 + rand(-6, 6), vx: rand(4, 12), life: 0, sway: Math.random() * 6, col: Math.random() < 0.5 ? '#f8c3d9' : '#e98bb5' });
    }
  }
  for (const p of k.petals) {
    if (p.h > 0) { p.h -= 9 * dt; p.x += (p.vx + Math.sin(k.t * 3 + p.sway) * 8) * dt; } else p.life += dt;
  }
  k.petals = k.petals.filter(p => p.life < 2.5);
  for (const f of k.fx) { f.life -= dt; f.x += (f.vx || 0) * dt; f.h += (f.vh || 0) * dt; if (f.kind === 'smoke') f.r += dt * 3; }
  k.fx = k.fx.filter(f => f.life > 0);
  for (const tx of k.texts) { tx.life -= dt; tx.y -= 10 * dt; }
  k.texts = k.texts.filter(tx => tx.life > 0);
}

// ---------------------------------------------------------------------------
// Sounds made from the shared synth.
// ---------------------------------------------------------------------------
function bHorn(type) {
  const f = type === 'bus' ? 220 : type === 'auto' ? 520 : type === 'scooter' ? 700 : 380;
  tone(f, 0.09, 'square', 0.04); tone(f * 1.06, 0.09, 'square', 0.04, null, 0.13);
}
function bWhistle() { tone(988, 0.7, 'triangle', 0.05, 1046); tone(1318, 0.7, 'triangle', 0.03, 1396); }
function bChime(vol = 1) { [659, 523, 784].forEach((f, i) => tone(f, 0.35, 'triangle', 0.05 * vol, null, i * 0.22)); }
function bMoo() { tone(150, 0.5, 'sawtooth', 0.05, 110); }

function bText(x, y, text, color = '#ffffff', life = 1.2) { BL.texts.push({ x, y, text, color, life, max: life }); }
function bToast(text, sub = '', t = 2.2) { BL.toast = { text, sub, t, max: t }; }

// ---------------------------------------------------------------------------
// Starting, moving, postcards and interactions.
// ---------------------------------------------------------------------------
const B_START = { x: 2640, y: 1381 };

function startCity() {
  unlockAudio();
  closePanels();
  if (!BL.built) buildCity();
  scene = 'city';
  paused = false;
  document.body.classList.add('city');
  document.body.classList.remove('journey');
  rng = Math.random;
  if (!SAVE.city) SAVE.city = { stamps: [] };
  SAVE.city.stamps = SAVE.city.stamps.filter(id => B_POSTCARDS.some(p => p.id === id));
  Object.assign(BL, {
    active: true, x: B_START.x, y: B_START.y, z: 0, vz: 0, view: 'street', mapOpen: false, mapSel: null, mapZoom: 1, ride: null, waypoint: null,
    clock: 8 * 60, t: 0, texts: [], fx: [], petals: [], card: null, near: null, boost: 0, dashT: 0, dashV: { x: 0, y: 0 },
    district: '', place: '', toast: null, cakeCd: 0, banner: { title: 'NAMMA BENGALURU', sub: 'Find a postcard at every landmark', t: 4.5 }, cam: null,
  });
  Object.assign(bkit, { facing: 1, walkT: 0, atkT: 0, airborne: false, dashT: 0, sprint: false });
  resetCityLife();
  setMusic('city');
  sfx.chime();
}

function bStamp(id) {
  if (SAVE.city.stamps.includes(id)) return;
  const pc = B_POSTCARDS.find(p => p.id === id);
  SAVE.city.stamps.push(id);
  addFish(5);
  persist();
  sfx.pickup();
  setTimeout(() => sfxSafe('chime'), 250);
  BL.card = { pc, t: 6.5 };
  if (BL.waypoint && BL.waypoint.id === id) BL.waypoint = null;
  if (SAVE.city.stamps.length === B_POSTCARDS.length) {
    addFish(100);
    setTimeout(() => { BL.banner = { title: 'NAMMA BENGALURU!', sub: 'Every postcard found. +100 fish', t: 6 }; sfx.win(); }, 3500);
  }
}

function cityTick(dt) {
  const k = BL;
  k.t += dt;
  k.clock = (k.clock + dt * 1.6) % 1440;
  if (k.banner && (k.banner.t -= dt) <= 0) k.banner = null;
  if (k.toast && (k.toast.t -= dt) <= 0) k.toast = null;
  if (k.card && (k.card.t -= dt) <= 0) k.card = null;
  k.cakeCd -= dt;
  updateLife(dt);
  warmTiles();

  if (k.ride) { rideTick(dt); return; }
  if (k.mapOpen) { mapTick(); return; }
  if (input.pressed.pause) { pauseGame(); return; }
  if (input.pressed.map) { openCityMap(); return; }
  if (input.pressed.view) {
    k.view = B_VIEWS[(B_VIEWS.indexOf(k.view) + 1) % B_VIEWS.length];
    bToast(B_VIEW_INFO[k.view].name, B_VIEW_INFO[k.view].sub);
    sfx.blip();
  }

  // Movement with sprint, dash and the filter-coffee boost.
  k.boost = Math.max(0, k.boost - dt);
  const boost = k.boost > 0 ? 1.4 : 1;
  bkit.sprint = input.held.dash && (input.mx || input.my);
  const speed = (bkit.sprint ? 104 : 62) * boost;
  if (input.pressed.dash && (input.mx || input.my)) { k.dashT = 0.16; k.dashV = norm(input.mx, input.my); sfx.dash(); }
  let vx = input.mx * speed, vy = input.my * speed;
  if (k.dashT > 0) { k.dashT -= dt; vx = k.dashV.x * 230; vy = k.dashV.y * 230; }
  bkit.dashT = k.dashT;
  bkit.dashX = k.dashV.x; bkit.dashY = k.dashV.y;
  const free = (nx, ny) => !bSolid(nx - 3, ny) && !bSolid(nx + 3, ny) && !bSolid(nx, ny - 2);
  if (vx && free(k.x + vx * dt, k.y)) k.x += vx * dt;
  if (vy && free(k.x, k.y + vy * dt)) k.y += vy * dt;
  k.x = clamp(k.x, 6, BW - 6);
  k.y = clamp(k.y, 6, BH - 6);
  if (input.mx) bkit.facing = input.mx > 0 ? 1 : -1;
  if (vx || vy) bkit.walkT += dt * (bkit.sprint ? 1.6 : 1); else bkit.walkT = 0;
  bkit.blinkT -= dt;
  if (bkit.blinkT < -0.15) bkit.blinkT = 2 + Math.random() * 3;
  bkit.atkT = Math.max(0, bkit.atkT - dt);
  if (k.z > 0 || k.vz > 0) {
    k.vz -= 420 * dt;
    k.z = Math.max(0, k.z + k.vz * dt);
    if (k.z === 0) { k.vz = 0; sfx.land(); }
  }
  bkit.airborne = k.z > 0;

  // Vehicles and trains shove the kitten aside.
  for (const v of k.vehicles) {
    const p = vehPos(v), def = B_VEH[v.type];
    if (Math.abs(p.x - k.x) > 60 || Math.abs(p.y - k.y) > 60) continue;
    const hw = v.lane.axis === 'h' ? def.len / 2 : def.wid / 2, hh = v.lane.axis === 'h' ? def.wid / 2 : def.len / 2;
    const cy = v.lane.axis === 'h' ? p.y - def.wid / 2 : p.y - def.len / 2;
    if (Math.abs(k.x - p.x) < hw + 3 && Math.abs(k.y - cy) < hh + 3 && k.z < 6) {
      const push = v.lane.axis === 'h' ? { x: 0, y: Math.sign(k.y - cy) || 1 } : { x: Math.sign(k.x - p.x) || 1, y: 0 };
      if (!bSolid(k.x + push.x * 3, k.y + push.y * 3)) { k.x += push.x * 3; k.y += push.y * 3; }
    }
  }
  const st = k.train;
  if (st.state !== 'away' && st.state !== 'dwell' && Math.abs(k.y - RAIL_Y) < 8 && Math.abs(k.x - st.x) < 120) {
    k.y = k.y < RAIL_Y ? RAIL_Y - 9 : RAIL_Y + 9;
    if (!st.tootCd || k.t > st.tootCd) { st.tootCd = k.t + 3; bWhistle(); bText(k.x, k.y - 34, 'Paaaam!', '#ffffff'); }
  }

  // Where are we?
  const rd = bRoadAt(k.x, k.y);
  const dist0 = bDistrictAt(k.x, k.y);
  k.district = dist0.name;
  k.place = rd ? rd.name : dist0.name;
  setMusic(k.clock > 19 * 60 || k.clock < 5 * 60 ? 'night' : dist0.mus);

  for (const f of k.fishes) {
    if (!f.taken && Math.abs(f.x - k.x) < 10 && Math.abs(f.y - k.y) < 10) { f.taken = true; addFish(1); sfx.pickup(); bText(f.x, f.y - 14, '+1 fish', '#9fd6ef'); }
  }
  for (const pc of B_POSTCARDS) if (!pc.ride && Math.abs(pc.x - k.x) < pc.r && Math.hypot(pc.x - k.x, pc.y - k.y) < pc.r) bStamp(pc.id);
  if (k.waypoint && Math.hypot(k.waypoint.x - k.x, k.waypoint.y - k.y) < 34) { bToast('ARRIVED', k.waypoint.name); k.waypoint = null; sfx.chime(); }

  k.near = findNear();
  if (input.pressed.jump) {
    if (k.near) interact(k.near);
    else if (k.z === 0) { k.vz = 120; sfx.jump(); }
  }
  if (input.pressed.attack) {
    bkit.atkT = 0.16;
    bkit.combo = bkit.combo % 3 + 1;
    sfx.swing();
    for (const p of k.pigeons) if (p.state === 'peck' && Math.hypot(p.x - k.x, p.y - k.y) < 40) { p.state = 'fly'; p.vx = (p.x - k.x) * 2 + rand(-20, 20); p.vy = rand(-20, 20); p.t = 4; }
    for (const c of k.cows) if (Math.hypot(c.x - k.x, c.y - k.y) < 26) { bMoo(); bText(c.x, c.y - 18, 'Mooo.', '#ffffff'); }
  }
}

function findNear() {
  const k = BL;
  let best = null, bd = 24;
  const consider = (d, obj) => { if (d < bd) { bd = d; best = obj; } };
  for (const s of Object.values(B_STATIONS)) consider(Math.hypot(s.x - k.x, s.y - k.y) - 8, { kind: 'metro', s, label: `Ride Namma Metro (${s.name})` });
  for (const n of k.npcs) if (Math.abs(n.x - k.x) < 30) consider(Math.hypot(n.x - k.x, n.y - k.y), { kind: 'npc', n, label: n.shop === 'coffee' ? 'Filter kaapi' : n.shop === 'cake' ? 'Honey cake' : `Talk to ${n.name}` });
  for (const c of k.cows) consider(Math.hypot(c.x - k.x, c.y - k.y), { kind: 'cow', c, label: 'Pat the cow' });
  return best;
}

function interact(it) {
  const k = BL;
  if (it.kind === 'metro') { openRidePicker(it.s); return; }
  if (it.kind === 'cow') { bMoo(); bText(it.c.x, it.c.y - 18, 'Mooo.', '#ffffff'); return; }
  const n = it.n;
  const line = n.lines[n.line % n.lines.length];
  n.line++;
  n.bubble = { text: `${n.name}: ${line}`, t: 3.2 };
  n.facing = k.x > n.x ? 1 : -1;
  sfx.blip();
  if (n.shop === 'coffee') { k.boost = 25; bText(k.x, k.y - 34, 'Filter kaapi! Speed up', '#ffe08a', 1.8); sfx.pickup(); }
  if (n.shop === 'cake') {
    if (k.cakeCd <= 0) { k.cakeCd = 40; addFish(3); bText(k.x, k.y - 34, 'Honey cake! +3 fish', '#ffe08a', 1.8); sfx.pickup(); }
    else n.bubble.text = `${n.name}: Next batch is in the oven.`;
  }
}

// ---------------------------------------------------------------------------
// City map (M): the whole city, with postcards and stations to aim for.
// ---------------------------------------------------------------------------
function mapTargets() {
  const out = B_POSTCARDS.filter(p => !p.ride).map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, kind: 'postcard', done: SAVE.city.stamps.includes(p.id) }));
  for (const s of Object.values(B_STATIONS)) out.push({ id: `st-${s.id}`, name: `${s.name} metro`, x: s.x, y: s.y, kind: 'station', lines: s.lines });
  return out;
}

function openCityMap() {
  const k = BL;
  k.mapOpen = true;
  const tg = mapTargets();
  const cur = k.waypoint ? tg.find(t => t.id === k.waypoint.id) : null;
  k.mapSel = cur || tg.filter(t => !t.done).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y))[0] || tg[0];
  k.mapNav = { x: 0, y: 0 };
  sfx.blip();
}

function mapTick() {
  const k = BL;
  if (input.pressed.map || input.pressed.pause) { k.mapOpen = false; sfx.blip(); return; }
  if (input.pressed.view || input.pressed.dash) { k.mapZoom = k.mapZoom === 1 ? 2.5 : 1; sfx.blip(); }
  const nx = Math.abs(input.mx) > 0.5 ? Math.sign(input.mx) : 0, ny = Math.abs(input.my) > 0.5 ? Math.sign(input.my) : 0;
  if ((nx || ny) && (nx !== k.mapNav.x || ny !== k.mapNav.y)) {
    const cur = k.mapSel;
    let best = null, bs = Infinity;
    for (const t of mapTargets()) {
      if (t.id === cur.id) continue;
      const vx = t.x - cur.x, vy = t.y - cur.y;
      const along = vx * nx + vy * ny;
      if (along <= 8) continue;
      const score = along + Math.abs(vx * ny - vy * nx) * 2;
      if (score < bs) { bs = score; best = t; }
    }
    if (best) { k.mapSel = best; sfx.blip(); }
  }
  k.mapNav = { x: nx, y: ny };
  if (input.pressed.jump || input.pressed.attack) setWaypoint(k.mapSel);
}

function setWaypoint(t) {
  BL.waypoint = { id: t.id, name: t.name, x: t.x, y: t.y };
  BL.mapOpen = false;
  bToast('DESTINATION SET', t.name);
  sfx.pickup();
}

// Where the map sits on screen; zoomed in, it follows the selection.
function mapLayout() {
  const top = 15, bottom = 13;
  const fit = Math.min((W - 12) / BW, (H - top - bottom) / BH);
  const s = fit * BL.mapZoom;
  const vw = Math.min(W - 12, BW * s), vh = Math.min(H - top - bottom, BH * s);
  const vx = (W - vw) / 2, vy = top + (H - top - bottom - vh) / 2;
  const focus = BL.mapSel || BL;
  const ox = clamp(focus.x * s - vw / 2, 0, BW * s - vw), oy = clamp(focus.y * s - vh / 2, 0, BH * s - vh);
  return { s, vx, vy, vw, vh, X: wx => vx + wx * s - ox, Y: wy => vy + wy * s - oy };
}

// Taps pick a map destination or a metro station; a tap on the minimap opens the map.
window.addEventListener('pointerdown', e => {
  if (scene !== 'city' || paused || menuOpen() || !BL.active) return;
  const rc = uiCanvas.getBoundingClientRect();
  const gx = (e.clientX - rc.left) / rc.width * W, gy = (e.clientY - rc.top) / rc.height * H;
  if (BL.ride && BL.ride.phase === 'pick') {
    const hit = (BL.ride.hits || []).find(h => Math.abs(gx - h.x) < 22 && Math.abs(gy - h.y) < 4.5);
    if (hit) { BL.ride.sel = hit.sel; confirmRide(); }
    return;
  }
  if (BL.mapOpen) {
    const L = mapLayout();
    let best = null, bd = 9;
    for (const t of mapTargets()) {
      const d = Math.hypot(L.X(t.x) - gx, L.Y(t.y) - gy);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) setWaypoint(best);
    return;
  }
  const mm = miniRect();
  if (gx > mm.x && gx < mm.x + mm.w && gy > mm.y && gy < mm.y + mm.h) openCityMap();
});

// ---------------------------------------------------------------------------
// Rides: pick a Namma Metro station, then ride with a stop at every station.
// ---------------------------------------------------------------------------
const B_COLS = ['purple', 'green', 'yellow'];

// The lines to ride from one station to another, changing at interchanges:
// a list of legs { line, a, b } with station ids.
function routeLegs(fromId, toId) {
  const from = B_STATIONS[fromId], to = B_STATIONS[toId];
  const prev = new Map(), queue = [];
  for (const l of from.lines) { prev.set(l, null); queue.push(l); }
  while (queue.length) {
    const l = queue.shift();
    if (to.lines.includes(l)) {
      const lines = [], vias = [];
      for (let cur = l; cur;) {
        lines.unshift(cur);
        const p = prev.get(cur);
        if (!p) break;
        vias.unshift(p.via);
        cur = p.l;
      }
      return lines.map((ln, i) => ({ line: ln, a: i ? vias[i - 1] : fromId, b: i < lines.length - 1 ? vias[i] : toId }));
    }
    for (const ic of Object.keys(B_INTERCHANGES)) {
      if (!B_STATIONS[ic].lines.includes(l)) continue;
      for (const l2 of B_STATIONS[ic].lines) if (!prev.has(l2)) { prev.set(l2, { l, via: ic }); queue.push(l2); }
    }
  }
  return [];
}

function openRidePicker(st) {
  const col = B_COLS.indexOf(st.lines[0]);
  const stations = B_LINES[B_COLS[col]].stations;
  let row = stations.findIndex(s => s.id === st.id);
  row = row === stations.length - 1 ? row - 1 : row + 1;
  BL.ride = { kind: 'metro', phase: 'pick', from: st.id, sel: { col, row }, nav: { x: 0, y: 0 }, hits: [] };
  sfx.chime();
}

function confirmRide() {
  const R = BL.ride;
  const lineId = B_COLS[R.sel.col];
  const to = B_LINES[lineId].stations[R.sel.row];
  if (to.id === R.from) { sfx.hurt(); return; }
  // Break the journey into hops between neighbouring stations: the train stops at every one.
  const hops = [];
  const legs = routeLegs(R.from, to.id);
  legs.forEach((leg, li) => {
    const L = B_LINES[leg.line], st = L.stations;
    const ia = st.findIndex(x => x.id === leg.a), ib = st.findIndex(x => x.id === leg.b), step = Math.sign(ib - ia);
    for (let i = ia; i !== ib; i += step) {
      const a = st[i], b = st[i + step];
      hops.push({ line: leg.line, a: a.s, b: b.s, toName: b.name, toId: b.id, dur: 1.5 + Math.abs(b.s - a.s) / 340,
        change: i + step === ib && li < legs.length - 1 ? B_LINES[legs[li + 1].line].name : null });
    }
  });
  Object.assign(R, { phase: 'move', to: to.id, toName: to.name, hops, hop: 0, t: 0, s: hops[0].a, speed: 0, caption: { kn: `Mundina nildana: ${hops[0].toName}`, en: `Next station: ${hops[0].toName}`, t: 2.6 } });
  setMusic('metro');
  sfx.chime();
}

function rideTick(dt) {
  const R = BL.ride;
  if (R.phase === 'pick') {
    if (input.pressed.pause || input.pressed.map) { BL.ride = null; return; }
    const nx = Math.abs(input.mx) > 0.5 ? Math.sign(input.mx) : 0, ny = Math.abs(input.my) > 0.5 ? Math.sign(input.my) : 0;
    if ((nx || ny) && (nx !== R.nav.x || ny !== R.nav.y)) {
      if (nx) R.sel.col = clamp(R.sel.col + nx, 0, B_COLS.length - 1);
      R.sel.row = clamp(R.sel.row + ny, 0, B_LINES[B_COLS[R.sel.col]].stations.length - 1);
      sfx.blip();
    }
    R.nav = { x: nx, y: ny };
    if (input.pressed.jump || input.pressed.attack) confirmRide();
    return;
  }
  // Hold dash to hurry the train along.
  R.fast = input.held.dash;
  R.t += dt * (R.fast ? 3 : 1);
  if (R.caption && (R.caption.t -= dt) <= 0) R.caption = null;
  const hop = R.hops[R.hop], last = R.hop === R.hops.length - 1;
  if (R.phase === 'move') {
    const k = clamp(R.t / hop.dur, 0, 1);
    // Trapezoid speed profile: speed up for a quarter, cruise, slow down.
    const e = k < 0.25 ? (8 / 3) * k * k : k > 0.75 ? 1 - (8 / 3) * (1 - k) * (1 - k) : 1 / 6 + (4 / 3) * (k - 0.25);
    R.s = hop.a + (hop.b - hop.a) * clamp(e, 0, 1);
    R.speed = Math.abs(hop.b - hop.a) / hop.dur * (4 / 3) * (k < 0.25 ? k * 4 : k > 0.75 ? (1 - k) * 4 : 1);
    if (k >= 1) {
      R.phase = 'dwell'; R.t = 0; R.speed = 0;
      R.caption = hop.change ? { kn: `Ee nildana: ${hop.toName}`, en: `Change here for the ${hop.change}`, t: 2.2 }
        : last ? { kn: `Ee nildana: ${hop.toName}`, en: 'Baagilugalu edagade tereyuttave. Doors open on the left.', t: 2.2 }
          : { kn: `Ee nildana: ${hop.toName}`, en: hop.toName, t: 1.4 };
      bChime(last || hop.change ? 1 : 0.5);
    }
    return;
  }
  if (R.t < (last || hop.change ? 1.6 : 1)) return;
  if (!last) {
    R.hop++; R.phase = 'move'; R.t = 0;
    R.caption = { kn: `Mundina nildana: ${R.hops[R.hop].toName}`, en: `Next station: ${R.hops[R.hop].toName}`, t: 1.8 };
    return;
  }
  const dest = B_STATIONS[R.to];
  BL.x = dest.x; BL.y = dest.y + 4;
  BL.ride = null;
  bToast(dest.name.toUpperCase(), 'Mind the gap');
  bChime();
  if (!SAVE.city.stamps.includes('metro')) bStamp('metro');
}

// ---------------------------------------------------------------------------
// Drawing: the world
// ---------------------------------------------------------------------------
const B_VIEWS = ['street', 'drone', 'sketch', 'close'];
const B_VIEW_INFO = {
  street: { name: 'STREET VIEW', sub: 'Strolling the footpaths', zoom: 2 },
  drone: { name: 'DRONE VIEW', sub: 'Up above the rooftops', zoom: 4 },
  sketch: { name: 'MALGUDI SKETCH', sub: 'Ink and paper, like the old title cards', zoom: 2 },
  close: { name: 'CLOSE-UP', sub: 'Nose to nose with the city', zoom: 1 },
};

function bOnScreen(x, y, pad = 0) {
  const c = BL.cam;
  return c && x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
}

// 0 = full day, 0.7 = deep night, plus a warm tint around dusk and dawn.
function bDaylight() {
  const h = BL.clock / 60;
  if (h >= 7 && h < 17.5) return { dark: 0, warm: 0 };
  if (h >= 17.5 && h < 19.5) { const k = (h - 17.5) / 2; return { dark: k * 0.7, warm: Math.sin(k * Math.PI) }; }
  if (h >= 5 && h < 7) { const k = (7 - h) / 2; return { dark: k * 0.7, warm: Math.sin(k * Math.PI) * 0.7 }; }
  return { dark: 0.7, warm: 0 };
}

function cityDraw() {
  const k = BL;
  const zoom = k.ride ? 2 : B_VIEW_INFO[k.view].zoom;
  if (canvas.width !== W * zoom || canvas.height !== H * zoom) {
    canvas.width = W * zoom;
    canvas.height = H * zoom;
    ctx.imageSmoothingEnabled = false;
  }
  const vw = canvas.width, vh = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (k.ride && k.ride.phase !== 'pick') { drawRide(vw, vh); return; }
  const cx = Math.round(clamp(k.x - vw / 2, 0, BW - vw)), cy = Math.round(clamp(k.y - vh * 0.6, 0, BH - vh));
  k.cam = { x: cx, y: cy, w: vw, h: vh, zoom };
  ctx.fillStyle = '#5d8a3e';
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-cx, -cy);
  for (let ty = Math.floor(cy / TILE); ty <= Math.floor((cy + vh - 1) / TILE); ty++) {
    for (let tx = Math.floor(cx / TILE); tx <= Math.floor((cx + vw - 1) / TILE); tx++) {
      if (tx * TILE < BW && ty * TILE < BH) ctx.drawImage(groundTile(tx, ty), tx * TILE, ty * TILE);
    }
  }
  drawGroundLife();

  // Everything with a base y, sorted for depth.
  const list = [];
  for (let by = Math.floor(cy / BUCKET); by <= Math.floor((cy + vh + BL.maxH) / BUCKET); by++) {
    for (let bx = Math.floor((cx - BL.maxW) / BUCKET); bx <= Math.floor((cx + vw + BL.maxW) / BUCKET); bx++) {
      for (const s of BL.buckets.get(`${bx},${by}`) || []) if (s.x + s.w > cx && s.x < cx + vw && s.y < cy + vh && s.base > cy - 4) list.push({ y: s.base, s });
    }
  }
  for (const v of k.vehicles) { const p = vehPos(v); if (bOnScreen(p.x, p.y, 50)) list.push({ y: p.y, v, p }); }
  for (const n of k.npcs) if (bOnScreen(n.x, n.y, 20)) list.push({ y: n.y, n });
  for (const c of k.cows) if (bOnScreen(c.x, c.y, 20)) list.push({ y: c.y, cow: c });
  for (const dg of k.dogs) if (bOnScreen(dg.x, dg.y, 20)) list.push({ y: dg.y, dog: dg });
  if (bOnScreen(B_TRACK.x, B_TRACK.y, 300)) {
    for (const h of k.horses) {
      const x = B_TRACK.x + Math.cos(h.a) * (B_TRACK.rx - 8 - h.lane * 5), y = B_TRACK.y + Math.sin(h.a) * (B_TRACK.ry - 8 - h.lane * 4);
      if (bOnScreen(x, y, 20)) list.push({ y, horse: h, x, dir: -Math.sin(h.a) >= 0 ? 1 : -1 });
    }
  }
  if (k.train.state !== 'away' && bOnScreen(k.train.x, RAIL_Y, 200)) list.push({ y: RAIL_Y + 8, rail: true });
  for (const f of k.fishes) if (!f.taken && bOnScreen(f.x, f.y, 10)) list.push({ y: f.y, fish: f });
  for (const L of Object.values(B_LINES)) for (const g of L.segs) {
    if (g.axis !== 'h' || !bOnScreen((g.x0 + g.x1) / 2, g.y0, Math.abs(g.x1 - g.x0) / 2 + 10)) continue;
    for (let x = Math.min(g.x0, g.x1) + 30; x < Math.max(g.x0, g.x1); x += 60) if (bOnScreen(x, g.y0, 10)) list.push({ y: g.y0 + 1, pillar: x, py: g.y0 });
  }
  list.push({ y: k.y, kitten: true });
  list.sort((a, b) => a.y - b.y);
  let kitDone = false, hidden = false;
  for (const it of list) {
    if (it.s) {
      const s = it.s;
      const covers = kitDone && k.x > s.x + 2 && k.x < s.x + s.w - 2 && k.y - 12 > s.y && k.y - 12 < s.base - 4;
      if (covers && s.tree) { ctx.globalAlpha = 0.45; ctx.drawImage(s.img, s.x, s.y); ctx.globalAlpha = 1; }
      else ctx.drawImage(s.img, s.x, s.y);
      if (covers && !s.tree && !s.lamp) hidden = true;
    } else if (it.v) drawVehicle(it.v, it.p);
    else if (it.n) drawPerson(it.n.x, it.n.y, it.n);
    else if (it.cow) drawCow(it.cow);
    else if (it.horse) drawHorse(it.x, it.y, it.horse, it.dir);
    else if (it.dog) drawDog(it.dog);
    else if (it.rail) drawRailTrain(BL.train.x, RAIL_Y + 6, BL.train.dir, BL.train.x);
    else if (it.fish) { const bob = Math.round(Math.sin(k.t * 4 + it.fish.seed) * 1.5); drawShadow(it.fish.x, it.fish.y, 6, 0.2); ctx.drawImage(SPR.fish.img[0], Math.round(it.fish.x - 4), Math.round(it.fish.y - 9 + bob)); }
    else if (it.pillar) { ctx.fillStyle = '#6e6a62'; ctx.fillRect(it.pillar - 3, it.py - 16, 6, 17); ctx.fillStyle = '#a8a294'; ctx.fillRect(it.pillar - 3, it.py - 16, 2, 17); }
    else if (it.kitten) { drawCityKitten(); kitDone = true; }
  }
  if (hidden) { ctx.globalAlpha = 0.45; drawCityKitten(); ctx.globalAlpha = 1; }
  drawMetroOverlay();
  if (bUnderDeck(k.x, k.y)) { ctx.globalAlpha = 0.5; drawCityKitten(); ctx.globalAlpha = 1; }
  drawAir();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawNight(vw, vh);
  if (k.view === 'sketch') sketchFilter(vw, vh, cx, cy);
}

function bUnderDeck(x, y) {
  for (const L of Object.values(B_LINES)) for (const g of L.segs) {
    if (g.axis === 'h' && y > g.y0 - 34 && y < g.y0 + 20 && x > Math.min(g.x0, g.x1) && x < Math.max(g.x0, g.x1)) return true;
    if (g.axis === 'v' && Math.abs(x - g.x0) < 18 && y > Math.min(g.y0, g.y1) - 10 && y < Math.max(g.y0, g.y1) + 10) return true;
  }
  return false;
}

function drawCityKitten() {
  const k = BL;
  drawShadow(k.x, k.y, 10);
  if (k.boost > 0 && Math.random() < 0.3) BL.fx.push({ kind: 'steam', x: k.x + rand(-4, 4), y: k.y, h: 26, vh: 12, life: 0.6, max: 0.6, r: 1 });
  drawKnight(bkit, k.x, k.y - k.z);
}

function drawGroundLife() {
  const k = BL;
  // The flower clock keeps game time.
  if (bOnScreen(B_CLOCK.x, B_CLOCK.y, 30)) {
    const hand = (a, len) => { ctx.fillStyle = '#2b2220'; for (let i = 0; i < len; i++) ctx.fillRect(Math.round(B_CLOCK.x + Math.sin(a) * i), Math.round(B_CLOCK.y - Math.cos(a) * i), 2, 2); };
    hand(((k.clock / 60) % 12) / 12 * Math.PI * 2, 10);
    hand((k.clock % 60) / 60 * Math.PI * 2, 15);
    ctx.fillStyle = '#e6c15e';
    ctx.fillRect(B_CLOCK.x - 1, B_CLOCK.y - 1, 3, 3);
  }
  for (const l of B_LAKES) {
    if (!bOnScreen(l.x, l.y, l.rx + 20)) continue;
    ctx.fillStyle = '#d8eef6';
    for (let i = 0; i < 14; i++) {
      if ((Math.floor(k.t * 2) + i) % 3) continue;
      const a = i * 2.4 + Math.floor(k.t * 1.5 + i) * 0.7;
      ctx.fillRect(Math.round(l.x + Math.cos(a) * l.rx * 0.6), Math.round(l.y + Math.sin(a * 1.3) * l.ry * 0.6), 2, 1);
    }
  }
  for (const d of k.ducks) {
    if (!bOnScreen(d.x, d.y, 6)) continue;
    const x = Math.round(d.x), y = Math.round(d.y);
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x - 3, y - 3, 7, 4);
    ctx.fillStyle = d.white ? '#f4f1ea' : '#8a6a4a'; ctx.fillRect(x - 2, y - 2, 5, 2);
    ctx.fillStyle = d.white ? '#f4f1ea' : '#3f7d2f'; ctx.fillRect(x + (d.vx > 0 ? 2 : -3), y - 4, 2, 2);
    ctx.fillStyle = '#ee8b3a'; ctx.fillRect(x + (d.vx > 0 ? 4 : -4), y - 3, 1, 1);
    ctx.fillStyle = '#8cc4e0'; ctx.fillRect(x - 3, y + 1, 7, 1);
  }
  const U = B_LAKES[1];
  for (const b of k.boats) {
    const x = Math.round(U.x + Math.cos(b.a) * U.rx * 0.7), y = Math.round(U.y + Math.sin(b.a) * U.ry * 0.62);
    if (!bOnScreen(x, y, 20)) continue;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x - 8, y - 5, 16, 7);
    ctx.fillStyle = b.col; ctx.fillRect(x - 7, y - 4, 14, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 9, 5, 5);
    drawPerson(x - 3, y - 2, { skin: '#c48a5c', hair: '#2b2220', top: '#5b8ee0', bottom: '#2b2a33', facing: 1 }, true);
    ctx.fillStyle = '#8cc4e0'; ctx.fillRect(x - 9, y + 2, 18, 1);
  }
  for (const p of k.pigeons) {
    if (p.h > 0 || !bOnScreen(p.x, p.y, 4)) continue;
    const x = Math.round(p.x), y = Math.round(p.y), peck = Math.floor(k.t * 3 + p.hx) % 4 === 0 ? 1 : 0;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x - 2, y - 3 + peck, 5, 3);
    ctx.fillStyle = '#8a8f9c'; ctx.fillRect(x - 1, y - 2 + peck, 3, 1);
    ctx.fillStyle = '#5d6370'; ctx.fillRect(x + 1, y - 4 + peck, 2, 2);
  }
}

function drawPerson(x, y, p, sitting = false) {
  const X = Math.round(x), Y = Math.round(y);
  const kid = p.kid, h = kid ? 11 : 15;
  if (!sitting) drawShadow(X, Y, 6, 0.22);
  const step = p.moving ? Math.floor(BL.t * 7 + X) % 2 : 0;
  const top = Y - h;
  const f = p.facing || 1;
  ctx.fillStyle = '#2b2220';
  ctx.fillRect(X - 3, top - 1, 7, h + 1);
  if (p.saree) {
    ctx.fillStyle = p.top; ctx.fillRect(X - 2, top + 4, 5, h - 4);
    ctx.fillStyle = shade(p.top, -0.25); ctx.fillRect(X - 2, top + 7, 5, 1);
    ctx.fillStyle = '#e6c15e'; ctx.fillRect(X - 2, Y - 2, 5, 1);
  } else if (!sitting) {
    const lh = kid ? 3 : 5;
    ctx.fillStyle = p.bottom;
    ctx.fillRect(X - 2, Y - lh, 2, lh - step);
    ctx.fillRect(X + 1, Y - lh, 2, lh - (1 - step));
    ctx.fillStyle = p.top;
    ctx.fillRect(X - 2, top + 4, 5, h - 4 - lh);
  } else { ctx.fillStyle = p.top; ctx.fillRect(X - 2, top + 4, 5, 4); }
  ctx.fillStyle = p.skin;
  ctx.fillRect(X - 1, top, 4, 4);
  ctx.fillStyle = p.hair;
  ctx.fillRect(X - 1, top, 4, 1);
  ctx.fillRect(f > 0 ? X - 1 : X + 2, top, 1, 3);
  if (p.cap) { ctx.fillStyle = p.cap; ctx.fillRect(X - 2, top - 1, 6, 2); }
  ctx.fillStyle = '#141414';
  ctx.fillRect(f > 0 ? X + 2 : X - 1, top + 1, 1, 1);
  ctx.fillStyle = p.skin;
  ctx.fillRect(f > 0 ? X + 3 : X - 3, top + 5 + step, 1, 3);
}

function drawCow(c) {
  const x = Math.round(c.x), y = Math.round(c.y);
  drawShadow(x, y, 16, 0.22);
  ctx.fillStyle = '#2b2220';
  if (c.lying) {
    ctx.fillRect(x - 9, y - 7, 18, 7); ctx.fillStyle = '#ece6da'; ctx.fillRect(x - 8, y - 6, 16, 5);
    ctx.fillStyle = '#d9d2c4'; ctx.fillRect(x - 8, y - 2, 16, 1); ctx.fillStyle = '#c9c2b6'; ctx.fillRect(x - 3, y - 8, 4, 2);
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x + 7, y - 10, 6, 6); ctx.fillStyle = '#ece6da'; ctx.fillRect(x + 8, y - 9, 4, 4);
    ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x + 8, y - 13, 1, 3); ctx.fillRect(x + 11, y - 13, 1, 3);
    return;
  }
  ctx.fillRect(x - 9, y - 12, 17, 8); ctx.fillStyle = '#ece6da'; ctx.fillRect(x - 8, y - 11, 15, 6);
  ctx.fillStyle = '#c9c2b6'; ctx.fillRect(x - 3, y - 13, 5, 2);
  ctx.fillStyle = '#2b2220';
  for (const lx of [-8, -5, 3, 6]) ctx.fillRect(x + lx, y - 5, 2, 5);
  ctx.fillRect(x + 7, y - 14, 6, 6); ctx.fillStyle = '#ece6da'; ctx.fillRect(x + 8, y - 13, 4, 4);
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x + 8, y - 18, 1, 4); ctx.fillRect(x + 11, y - 18, 1, 4);
  ctx.fillStyle = '#d8433b'; ctx.fillRect(x + 8, y - 15, 1, 2);
  ctx.fillStyle = '#2b2220'; ctx.fillRect(x - 10, y - 11, 1, 6);
}

function drawHorse(x, y, h, dir) {
  const X = Math.round(x), Y = Math.round(y), g = Math.floor(BL.t * 10 + h.lane) % 2;
  drawShadow(X, Y, 14, 0.22);
  const R = (v, yy, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(dir > 0 ? X + v : X - v - w + 1, yy, w, hh); };
  R(-7, Y - 11, 14, 6, '#2b2220'); R(-6, Y - 10, 12, 4, h.col);
  R(5, Y - 15, 4, 6, '#2b2220'); R(6, Y - 14, 3, 4, h.col); R(8, Y - 13, 2, 2, h.col);
  for (const [lx, ph] of [[-5, g], [-3, 1 - g], [3, g], [5, 1 - g]]) R(lx + (ph ? 1 : -1), Y - 5, 1, 5, '#2b2220');
  R(-8, Y - 10, 2, 4, '#2b2220');
  R(-2, Y - 17, 4, 6, '#2b2220'); R(-1, Y - 16, 2, 4, h.silk); R(-1, Y - 18, 2, 2, h.silk);
}

function drawDog(d) {
  const x = Math.round(d.x), y = Math.round(d.y), f = d.facing;
  const moving = Math.hypot(d.tx - d.x, d.ty - d.y) > 2;
  drawShadow(x, y, 9, 0.2);
  ctx.fillStyle = '#2b2220'; ctx.fillRect(x - 5, y - 7, 10, 5);
  ctx.fillStyle = '#c99d6e'; ctx.fillRect(x - 4, y - 6, 8, 3);
  ctx.fillStyle = '#2b2220'; ctx.fillRect(x + f * 4 - 1, y - 10, 4, 4); ctx.fillStyle = '#c99d6e'; ctx.fillRect(x + f * 4, y - 9, 2, 2);
  ctx.fillStyle = '#2b2220';
  const g = moving ? Math.floor(BL.t * 8) % 2 : 0;
  for (const lx of [-4, 3]) ctx.fillRect(x + lx + g, y - 2, 1, 2);
  ctx.fillRect(x - f * 6, y - 9 + (Math.floor(BL.t * 6) % 2), 1, 3);
}

// An Indian Railways train: a red-and-white electric engine and five coaches.
function drawRailTrain(cx, y, dir, phase) {
  const R = (x, yy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), yy, w, h); };
  const wheel = Math.floor(phase / 4) % 2;
  for (let i = 1; i <= 5; i++) {
    const x = cx - dir * i * 50 - 23;
    R(x, y - 22, 48, 18, '#2b2220'); R(x + 1, y - 21, 46, 16, '#a8322a'); R(x + 1, y - 21, 46, 2, '#d9d6de');
    R(x + 1, y - 10, 46, 2, '#d9d6de');
    for (let w = 4; w < 44; w += 7) { R(x + w, y - 17, 5, 5, '#2b2220'); R(x + w + 1, y - 16, 3, 2, '#c9d6e0'); }
    R(x + 5, y - 5, 7, 5, '#2b2220'); R(x + 36, y - 5, 7, 5, '#2b2220');
  }
  const ex = cx - 26;
  R(ex, y - 24, 52, 20, '#2b2220'); R(ex + 1, y - 23, 50, 18, '#d8433b'); R(ex + 1, y - 13, 50, 3, '#ffffff'); R(ex + 1, y - 10, 50, 2, '#f2c94c');
  const nose = dir > 0 ? ex + 44 : ex + 1;
  R(nose, y - 21, 7, 6, '#9cc4dc'); R(nose + (dir > 0 ? 6 : 0), y - 8, 1, 2, '#fff3c8');
  R(ex + 12, y - 28, 28, 4, '#2b2220'); R(ex + 14, y - 32, 1, 4, '#2b2220'); R(ex + 14, y - 32, 12, 1, '#2b2220');
  for (const wx of [4, 14, 34, 44]) { R(ex + wx, y - 5, 6, 5, '#1d1816'); R(ex + wx + 1 + wheel, y - 4, 2, 2, '#8a8f96'); }
}

function drawVehicle(v, p) {
  const def = B_VEH[v.type], L = v.lane;
  const X = Math.round(p.x), Y = Math.round(p.y);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (L.axis === 'h') {
    const f = L.dir, len = def.len, x0 = X - len / 2;
    const FR = (dx, y, w, h, col) => R(f > 0 ? x0 + dx : x0 + len - dx - w, y, w, h, col);
    drawShadow(X, Y, len, 0.25);
    if (v.type === 'auto') {
      FR(1, Y - 13, 15, 10, '#2b2220'); FR(2, Y - 12, 13, 4, '#f0c419'); FR(2, Y - 12, 13, 1, '#ffe27a');
      FR(2, Y - 8, 13, 5, '#2e7d32'); FR(12, Y - 9, 4, 4, '#9cc4dc'); FR(9, Y - 9, 3, 5, '#1d1816');
      FR(16, Y - 7, 2, 4, '#2b2220'); FR(16, Y - 6, 1, 1, '#fff3c8');
      FR(1, Y - 3, 4, 3, '#1d1816'); FR(13, Y - 3, 4, 3, '#1d1816');
    } else if (v.type === 'bus') {
      FR(0, Y - 18, len, 15, '#2b2220'); FR(1, Y - 17, len - 2, 13, v.col); FR(1, Y - 17, len - 2, 1, shade(v.col, 0.25));
      for (let wx = 3; wx < len - 8; wx += 6) FR(wx, Y - 15, 5, 5, '#9cc4dc');
      FR(len - 6, Y - 16, 5, 8, '#9cc4dc'); FR(len - 13, Y - 9, 4, 6, '#2b2220');
      FR(2, Y - 8, len - 4, 1, '#ffffff'); FR(len - 7, Y - 18, 6, 2, '#ee8b3a');
      FR(4, Y - 4, 6, 4, '#1d1816'); FR(len - 12, Y - 4, 6, 4, '#1d1816');
    } else if (v.type === 'car') {
      FR(1, Y - 9, len - 2, 6, '#2b2220'); FR(2, Y - 8, len - 4, 4, v.col);
      FR(6, Y - 13, 13, 5, '#2b2220'); FR(7, Y - 12, 11, 4, v.col); FR(8, Y - 12, 4, 3, '#9cc4dc'); FR(13, Y - 12, 4, 3, '#9cc4dc');
      FR(len - 3, Y - 7, 2, 2, '#fff3c8'); FR(3, Y - 4, 5, 4, '#1d1816'); FR(len - 9, Y - 4, 5, 4, '#1d1816');
    } else {
      FR(1, Y - 6, 10, 3, '#2b2220'); FR(2, Y - 5, 8, 2, v.col); FR(1, Y - 3, 3, 3, '#1d1816'); FR(8, Y - 3, 3, 3, '#1d1816');
      drawPerson(f > 0 ? x0 + 5 : x0 + len - 5, Y - 4, { skin: '#9a6a45', hair: '#2b2220', top: '#5b8ee0', bottom: '#2b2a33', cap: '#d8433b', facing: f }, true);
    }
    return;
  }
  const w = def.wid, len = def.len, x0 = X - Math.floor(w / 2), y1 = Y, y0 = Y - len;
  const front = L.dir > 0;
  drawShadow(X, Y, w + 2, 0.25);
  if (v.type === 'auto') {
    R(x0 - 1, y0 + 2, w + 2, len - 2, '#2b2220'); R(x0, y0 + 3, w, 7, '#f0c419'); R(x0, y0 + 3, w, 1, '#ffe27a');
    R(x0, y0 + 10, w, len - 10, '#2e7d32');
    if (front) { R(x0 + 1, y0 + 10, w - 2, 3, '#9cc4dc'); R(X - 1, y1 - 4, 2, 2, '#fff3c8'); } else R(x0 + 2, y1 - 5, w - 4, 2, '#f2c94c');
  } else if (v.type === 'bus') {
    R(x0 - 1, y0, w + 2, len, '#2b2220'); R(x0, y0 + 1, w, len - 2, v.col);
    R(x0 + 1, y0 + 2, w - 2, len - 10, shade(v.col, 0.15)); for (let yy = y0 + 4; yy < y1 - 10; yy += 6) R(x0 + 1, yy, w - 2, 1, shade(v.col, -0.2));
    if (front) { R(x0 + 1, y1 - 9, w - 2, 5, '#9cc4dc'); R(x0 + 1, y1 - 3, 2, 1, '#fff3c8'); R(x0 + w - 3, y1 - 3, 2, 1, '#fff3c8'); R(x0 + 2, y1 - 11, w - 4, 2, '#ee8b3a'); }
    else { R(x0 + 2, y1 - 8, w - 4, 4, '#3a4a58'); R(x0 + 1, y1 - 3, 2, 1, '#d8433b'); R(x0 + w - 3, y1 - 3, 2, 1, '#d8433b'); }
  } else if (v.type === 'car') {
    R(x0 - 1, y0 + 4, w + 2, len - 4, '#2b2220'); R(x0, y0 + 5, w, len - 6, v.col);
    R(x0 + 1, y0 + 9, w - 2, 9, shade(v.col, 0.12)); R(x0 + 1, front ? y0 + 18 : y0 + 7, w - 2, 3, '#9cc4dc');
    R(x0, y1 - 2, 2, 1, front ? '#fff3c8' : '#d8433b'); R(x0 + w - 2, y1 - 2, 2, 1, front ? '#fff3c8' : '#d8433b');
  } else {
    R(X - 2, y0 + 2, 5, len - 2, '#2b2220'); R(X - 1, y0 + 3, 3, len - 4, v.col);
    drawPerson(X, y1 - 3, { skin: '#9a6a45', hair: '#2b2220', top: '#5b8ee0', bottom: '#2b2a33', cap: '#d8433b', facing: 1 }, true);
  }
}

// Viaducts, stations and trains, drawn over the street.
function drawMetroOverlay() {
  const k = BL, c = k.cam;
  for (const L of Object.values(B_LINES)) {
    for (const g of L.segs) {
      if (g.axis === 'h') {
        const yd = g.y0 - DECK;
        if (c.y > g.y0 + 20 || c.y + c.h < yd - 40) continue;
        const x0 = Math.max(Math.min(g.x0, g.x1) - 7, c.x - 10), x1 = Math.min(Math.max(g.x0, g.x1) + 7, c.x + c.w + 10);
        if (x1 <= x0) continue;
        ctx.fillStyle = '#4a4740'; ctx.fillRect(x0, yd - 7, x1 - x0, 15);
        ctx.fillStyle = '#c9c2b6'; ctx.fillRect(x0, yd - 6, x1 - x0, 9);
        ctx.fillStyle = '#8a857a'; ctx.fillRect(x0, yd + 3, x1 - x0, 4);
        ctx.fillStyle = '#a39b8a'; for (let x = x0 - (x0 % 6); x < x1; x += 6) { ctx.fillRect(x, yd - 4, 1, 2); ctx.fillRect(x, yd, 1, 2); }
        ctx.fillStyle = '#6e6a62'; ctx.fillRect(x0, yd - 3, x1 - x0, 1); ctx.fillRect(x0, yd + 1, x1 - x0, 1);
      } else {
        const x = g.x0;
        if (c.x > x + 30 || c.x + c.w < x - 30) continue;
        const y0 = Math.max(Math.min(g.y0, g.y1) - 7, c.y) - DECK, y1 = Math.min(Math.max(g.y0, g.y1) + 7, c.y + c.h + DECK) - DECK;
        if (y1 <= y0) continue;
        ctx.fillStyle = '#4a4740'; ctx.fillRect(x - 8, y0, 16, y1 - y0);
        ctx.fillStyle = '#c9c2b6'; ctx.fillRect(x - 7, y0, 14, y1 - y0);
        ctx.fillStyle = '#a39b8a'; for (let y = y0 - (y0 % 6); y < y1; y += 6) { ctx.fillRect(x - 5, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1); }
        ctx.fillStyle = '#6e6a62'; ctx.fillRect(x - 4, y0, 1, y1 - y0); ctx.fillRect(x + 3, y0, 1, y1 - y0);
      }
    }
  }
  const stations = [];
  for (const L of Object.values(B_LINES)) for (const st of L.stations) {
    if (!bOnScreen(st.x, st.y, 70)) continue;
    stations.push({ st, L, axis: linePoint(L, st.s).axis });
  }
  for (const s of stations) (s.axis === 'h' ? drawStationH : drawStationV)(s.st, s.L, false);
  for (const tr of k.trains) drawMetroTrain(tr);
  for (const s of stations) (s.axis === 'h' ? drawStationH : drawStationV)(s.st, s.L, true);
}

function drawStationH(st, L, roof) {
  const x = st.x, yd = st.y - DECK;
  if (!roof) {
    ctx.fillStyle = '#4a4740'; ctx.fillRect(x - 46, yd - 12, 92, 22);
    ctx.fillStyle = '#d9d2c4'; ctx.fillRect(x - 45, yd - 11, 90, 4); ctx.fillRect(x - 45, yd + 5, 90, 4);
    ctx.fillStyle = L.light; ctx.fillRect(x - 45, yd - 8, 90, 1); ctx.fillRect(x - 45, yd + 5, 90, 1);
    return;
  }
  ctx.fillStyle = '#3a3530'; ctx.fillRect(x - 48, yd - 26, 96, 9);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 47, yd - 25, 94, 5);
  ctx.fillStyle = L.col; ctx.fillRect(x - 47, yd - 20, 94, 2);
  for (const px of [-44, -15, 14, 43]) { ctx.fillStyle = '#3a3530'; ctx.fillRect(x + px - 1, yd - 18, 2, 8); }
  drawMetroLogo(x, yd - 34, L.col);
}

function drawStationV(st, L, roof) {
  const y = st.y - DECK, x = st.x;
  if (!roof) {
    ctx.fillStyle = '#4a4740'; ctx.fillRect(x - 14, y - 34, 28, 52);
    ctx.fillStyle = '#d9d2c4'; ctx.fillRect(x - 13, y - 33, 6, 50); ctx.fillRect(x + 7, y - 33, 6, 50);
    ctx.fillStyle = L.light; ctx.fillRect(x - 8, y - 33, 1, 50); ctx.fillRect(x + 7, y - 33, 1, 50);
    return;
  }
  ctx.fillStyle = '#3a3530'; ctx.fillRect(x - 16, y - 40, 32, 7); ctx.fillRect(x - 16, y + 16, 32, 5);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 15, y - 39, 30, 4); ctx.fillRect(x - 15, y + 17, 30, 3);
  ctx.fillStyle = L.col; ctx.fillRect(x - 15, y - 35, 30, 2);
  ctx.fillStyle = '#3a3530'; ctx.fillRect(x - 16, y - 33, 2, 49); ctx.fillRect(x + 14, y - 33, 2, 49);
  drawMetroLogo(x, y - 49, L.col);
}

function drawMetroLogo(x, y, col) {
  ctx.fillStyle = col; ctx.fillRect(x - 5, y, 10, 9);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y + 2, 1, 5); ctx.fillRect(x + 2, y + 2, 1, 5); ctx.fillRect(x - 2, y + 3, 1, 1); ctx.fillRect(x + 1, y + 3, 1, 1); ctx.fillRect(x - 1, y + 4, 2, 1);
}

function drawMetroTrain(tr) {
  const L = B_LINES[tr.line];
  const mid = linePoint(L, tr.s);
  if (!bOnScreen(mid.x, mid.y, 120)) return;
  for (let i = -1; i <= 1; i++) {
    const p = linePoint(L, tr.s + i * 38);
    if (p.axis === 'h') {
      const yb = Math.round(p.y - DECK + (tr.dir > 0 ? -1 : 4)), x0 = Math.round(p.x - 18);
      ctx.fillStyle = '#2b2220'; ctx.fillRect(x0, yb - 11, 37, 11);
      ctx.fillStyle = '#eceaf0'; ctx.fillRect(x0 + 1, yb - 10, 35, 9);
      ctx.fillStyle = L.col; ctx.fillRect(x0 + 1, yb - 4, 35, 3); ctx.fillRect(x0 + 1, yb - 10, 35, 1);
      ctx.fillStyle = '#3a4a58'; for (let wx = 3; wx < 34; wx += 6) ctx.fillRect(x0 + wx, yb - 8, 4, 3);
      ctx.fillStyle = '#9a9aa6'; ctx.fillRect(x0 + 16, yb - 9, 4, 7);
    } else {
      const xc = Math.round(p.x + (tr.dir > 0 ? 3 : -3)), y0 = Math.round(p.y - DECK - 17);
      ctx.fillStyle = '#2b2220'; ctx.fillRect(xc - 4, y0, 8, 33);
      ctx.fillStyle = '#d9d6de'; ctx.fillRect(xc - 3, y0 + 1, 6, 31);
      ctx.fillStyle = L.col; ctx.fillRect(xc - 3, y0 + 1, 1, 31); ctx.fillRect(xc + 2, y0 + 1, 1, 31);
      ctx.fillStyle = '#a3a9ae'; ctx.fillRect(xc - 1, y0 + 6, 2, 4); ctx.fillRect(xc - 1, y0 + 22, 2, 4);
    }
  }
}

function drawAir() {
  const k = BL;
  for (const p of k.petals) {
    if (!bOnScreen(p.x, p.y, 4)) continue;
    ctx.globalAlpha = p.h > 0 ? 1 : Math.max(0, 1 - p.life / 2.5);
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y - p.h), p.h > 0 && Math.floor(k.t * 6 + p.sway) % 2 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  for (const f of k.fx) {
    const a = f.life / f.max;
    if (f.kind === 'smoke') { ctx.globalAlpha = a * 0.75; ctx.fillStyle = '#e9e4dc'; pixDisc(ctx, f.x, f.y - f.h, Math.round(f.r)); }
    else if (f.kind === 'steam') { ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(f.x), Math.round(f.y - f.h), 1, 1); }
  }
  ctx.globalAlpha = 1;
  for (const p of k.pigeons) {
    if (p.h <= 0 || !bOnScreen(p.x, p.y, 50)) continue;
    const x = Math.round(p.x), y = Math.round(p.y - p.h), flap = Math.floor(k.t * 12 + p.hx) % 2;
    ctx.fillStyle = '#5d6370'; ctx.fillRect(x - 1, y, 3, 2);
    ctx.fillStyle = '#8a8f9c'; ctx.fillRect(x - 3, y - flap, 2, 1); ctx.fillRect(x + 2, y - flap, 2, 1);
  }
}

function drawNight(vw, vh, lights = true) {
  const { dark, warm } = bDaylight();
  if (dark <= 0.01 && warm <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const r = Math.round(255 - dark * 175), g = Math.round(255 - dark * 160 - warm * 40), b = Math.round(255 - dark * 90 - warm * 90);
  ctx.fillStyle = `rgb(${clamp(r, 0, 255)},${clamp(g, 0, 255)},${clamp(b, 0, 255)})`;
  ctx.fillRect(0, 0, vw, vh);
  ctx.globalCompositeOperation = 'lighter';
  if (dark > 0.25 && lights) {
    const c = BL.cam, a = (dark - 0.25) * 0.5;
    ctx.fillStyle = `rgba(255,214,140,${a})`;
    for (const l of BL.lamps) {
      if (!bOnScreen(l.x, l.y, 20)) continue;
      pixDisc(ctx, l.x - c.x, l.y - c.y + 8, 10);
      pixDisc(ctx, l.x - c.x, l.y - c.y + 8, 5);
    }
    ctx.fillStyle = `rgba(255,200,110,${a * 0.5})`;
    for (const s of BL.statics) {
      if (s.kind !== 'bld' || !s.b.mcol || (s.b.house === 'j' && Math.sin(s.x) > 0.3)) continue;
      if (s.x + s.w < c.x || s.x > c.x + c.w || s.y > c.y + c.h || s.base < c.y) continue;
      ctx.fillRect(s.x - c.x + s.w * 0.2, s.y - c.y + s.h * 0.4, s.w * 0.6, s.h * 0.4);
    }
  }
  ctx.restore();
}

// Ink-and-paper filter: edges become pen lines, shadows become hatching.
function sketchFilter(vw, vh, ox, oy) {
  const img = ctx.getImageData(0, 0, vw, vh), d = img.data, n = vw * vh;
  if (!BL.lum || BL.lum.length !== n) BL.lum = new Float32Array(n);
  const L = BL.lum;
  for (let p = 0, i = 0; p < n; p++, i += 4) L[p] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  for (let y = 0; y < vh; y++) {
    for (let x = 0; x < vw; x++) {
      const p = y * vw + x, i = p * 4, l = L[p];
      const e = Math.abs(l - L[x < vw - 1 ? p + 1 : p]) + Math.abs(l - L[y < vh - 1 ? p + vw : p]);
      const wx = x + ox, wy = y + oy;
      let v;
      if (e > 44) v = 0;
      else if (l < 70) v = ((wx + wy) & 1) ? 1 : 0;
      else if (l < 115) v = ((wx + wy) % 3 === 0) ? 0.5 : 2;
      else if (l < 160) v = ((wx - wy) % 5 === 0) ? 1.4 : 2.6;
      else v = 3;
      let r, g, b;
      if (v === 0) { r = 40; g = 31; b = 24; }
      else if (v <= 1) { r = 74; g = 60; b = 46; }
      else if (v <= 1.5) { r = 128; g = 108; b = 84; }
      else if (v <= 2) { r = 196; g = 178; b = 146; }
      else if (v <= 2.6) { r = 222; g = 206; b = 174; }
      else { r = 240; g = 229; b = 204; }
      const grain = ((Math.imul(wx * 73856093 ^ wy * 19349663, 2654435761) >>> 24) & 7) - 3;
      d[i] = r + grain; d[i + 1] = g + grain; d[i + 2] = b + grain;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Rides: the view from beside the viaduct. The real buildings and trees along
// the route pass by, nearer ones faster; the city's landmarks stand on the
// skyline with their names; the train stops at every station.
// ---------------------------------------------------------------------------
const B_SKIP_RIDE = ['statue', 'flood', 'ksrcanopy', 'flyover'];

// Buildings and trees near the line: how far along it, and how far from it.
function rideItems(line) {
  BL.rideCache = BL.rideCache || {};
  if (BL.rideCache[line]) return BL.rideCache[line];
  const L = B_LINES[line], near = [], icons = [];
  for (const st of BL.statics) {
    if (st.lamp || (st.kind === 'bld' && B_SKIP_RIDE.includes(st.b.spr))) continue;
    const cx = st.x + (st.img.fw || st.w) / 2;
    const p = lineProject(L, cx, st.base);
    if (st.kind === 'bld' && st.b.icon && p.d < 1500) {
      const pc = B_POSTCARDS.filter(c => !c.ride).sort((a, b) => Math.hypot(a.x - cx, a.y - st.base) - Math.hypot(b.x - cx, b.y - st.base))[0];
      icons.push({ img: st.img, along: p.s, d: p.d, name: pc && Math.hypot(pc.x - cx, pc.y - st.base) < 260 ? pc.name : '' });
    } else if (p.d < 320 && p.d > 16) near.push({ img: st.img, along: p.s, d: p.d });
  }
  icons.sort((a, b) => b.d - a.d);
  near.sort((a, b) => b.d - a.d);
  return (BL.rideCache[line] = { near, icons });
}

function drawRide(vw, vh) {
  const R = BL.ride, hop = R.hops[R.hop], L = B_LINES[hop.line];
  const dir = Math.sign(hop.b - hop.a) || 1, s = R.s;
  const day = bDaylight();
  const wrap = (v, m) => ((v % m) + m) % m;
  const horizon = Math.round(vh * 0.58), deckY = Math.round(vh * 0.8);
  R.boards = []; R.labels = [];
  // Sky and clouds.
  const top = lerpRgb([104, 164, 222], [28, 32, 64], day.dark / 0.7), bot = lerpRgb([222, 238, 244], [92, 70, 110], day.dark / 0.7);
  for (let y = 0; y < horizon; y++) {
    const v = (y / horizon) * 7, i = Math.floor(v) + ((v % 1) > dither(0, y) ? 1 : 0);
    ctx.fillStyle = rgbStr(lerpRgb(top, bot, Math.min(1, i / 7)));
    ctx.fillRect(0, y, vw, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 9; i++) pixEllipse(ctx, wrap(i * 97 - s * 0.03 * dir, vw + 80) - 40, Math.round(horizon * (0.1 + (i * 13 % 36) / 100)), 16, 4);
  // A hazy far skyline of apartment blocks with water tanks.
  const step = 22, base = Math.floor(s * 0.08 * dir / step);
  for (let j = -2; j < vw / step + 3; j++) {
    const id = base + j, x = Math.round(j * step - wrap(s * 0.08 * dir, step));
    const h = 14 + slotRand(id, 1) * 30, w = 12 + slotRand(id, 3) * 14;
    ctx.fillStyle = day.dark > 0.3 ? '#3a3f5a' : '#bcc6d0'; ctx.fillRect(x, horizon - h, w, h);
    ctx.fillStyle = day.dark > 0.3 ? '#2a2e44' : '#a8b4c0'; ctx.fillRect(x + 2, horizon - h - 3, 4, 3);
    ctx.fillStyle = day.dark > 0.3 ? '#ffd98a' : '#cdd6de';
    for (let wy = horizon - h + 3; wy < horizon - 3; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (slotRand(id + wx, wy) < 0.5) ctx.fillRect(wx, wy, 2, 2);
  }
  const ground = rgbStr(lerpRgb([126, 164, 88], [40, 56, 40], day.dark / 0.7));
  ctx.fillStyle = ground; ctx.fillRect(0, horizon, vw, vh - horizon);
  const { near, icons } = rideItems(hop.line);
  // Landmarks on the skyline: big, slow, named.
  for (const it of icons) {
    const p = 1 - it.d / 1500;
    const sc = 0.22 + 0.36 * p, par = 0.3 + 0.55 * p;
    const x = vw / 2 + (it.along - s) * dir * par;
    const w = it.img.width * sc, h = it.img.height * sc;
    if (x + w < -30 || x - w > vw + 30) continue;
    const by = horizon + 4 + p * 20;
    ctx.drawImage(it.img, Math.round(x - w / 2), Math.round(by - h), Math.round(w), Math.round(h));
    if (it.name && p > 0.35 && Math.abs(x - vw / 2) < vw * 0.45) R.labels.push({ x, y: by - h - 3, text: it.name });
  }
  // Homes, shops and trees close to the line: small steps of depth, fast.
  for (const it of near) {
    const p = 1 - it.d / 320;
    const sc = 0.42 + 0.4 * p, par = 0.85 + 0.45 * p;
    const x = vw / 2 + (it.along - s) * dir * par;
    const w = it.img.width * sc, h = it.img.height * sc;
    if (x + w < -20 || x - w > vw + 20) continue;
    const by = horizon + 26 + p * (deckY - horizon - 30);
    ctx.drawImage(it.img, Math.round(x - w / 2), Math.round(by - h), Math.round(w), Math.round(h));
  }
  // Stations: platform, canopy in the line colour, and a name board.
  for (const st of L.stations) {
    const x = vw / 2 + (st.s - s) * dir * 1.4;
    if (x < -200 || x > vw + 200) continue;
    const pw = 220, y0 = deckY - 46;
    ctx.fillStyle = '#3a3530'; ctx.fillRect(Math.round(x - pw / 2 - 2), y0 - 2, pw + 4, 9);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(Math.round(x - pw / 2), y0, pw, 5); ctx.fillStyle = L.col; ctx.fillRect(Math.round(x - pw / 2), y0 + 5, pw, 2);
    for (let px = -pw / 2 + 4; px <= pw / 2 - 4; px += 36) { ctx.fillStyle = '#8a8f96'; ctx.fillRect(Math.round(x + px), y0 + 7, 3, deckY - y0 - 7); }
    ctx.fillStyle = '#1d1816'; ctx.fillRect(Math.round(x - 46), y0 - 18, 92, 14); ctx.fillStyle = L.col; ctx.fillRect(Math.round(x - 45), y0 - 17, 90, 12);
    R.boards.push({ x, y: y0 - 11, text: st.name });
  }
  // The viaduct and its pillars rushing past.
  ctx.fillStyle = '#4a4740'; ctx.fillRect(0, deckY, vw, 10);
  ctx.fillStyle = '#c9c2b6'; ctx.fillRect(0, deckY + 1, vw, 6);
  ctx.fillStyle = '#8a857a'; ctx.fillRect(0, deckY + 7, vw, 3);
  for (let j = -1; j < vw / 80 + 2; j++) {
    const x = Math.round(j * 80 - wrap(s * 1.5 * dir, 80));
    ctx.fillStyle = '#6e6a62'; ctx.fillRect(x, deckY + 10, 10, vh - deckY - 10);
    ctx.fillStyle = '#a8a294'; ctx.fillRect(x, deckY + 10, 3, vh - deckY - 10);
  }
  // The train, with Ser Biscuit at a window.
  const rock = R.speed > 30 ? Math.floor(BL.t * 12) % 2 : 0;
  const tw = 54, ty = deckY - 21, tx0 = Math.round(vw / 2 - tw * 2);
  for (let i = 0; i < 4; i++) {
    const x = tx0 + i * tw;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x, ty - rock, tw - 1, 21);
    ctx.fillStyle = '#eceaf0'; ctx.fillRect(x + 1, ty + 1 - rock, tw - 3, 19);
    ctx.fillStyle = L.col; ctx.fillRect(x + 1, ty + 13 - rock, tw - 3, 5); ctx.fillRect(x + 1, ty + 1 - rock, tw - 3, 2);
    for (let wx = 4; wx < tw - 8; wx += 9) { ctx.fillStyle = '#3a4a58'; ctx.fillRect(x + wx, ty + 5 - rock, 7, 6); }
    ctx.fillStyle = R.phase === 'dwell' ? '#3a4a58' : '#9a9aa6'; ctx.fillRect(x + tw / 2 - 3, ty + 4 - rock, 6, 13);
  }
  const nose = dir > 0 ? tx0 + tw * 4 - 1 : tx0 - 2;
  ctx.fillStyle = '#2b2220'; ctx.fillRect(nose, ty + 3 - rock, 3, 15); ctx.fillStyle = '#fff3c8'; ctx.fillRect(nose + (dir > 0 ? 2 : 0), ty + 14 - rock, 1, 2);
  ctx.drawImage(SPR.kitten.idle.img[0], 0, 0, 24, 14, tx0 + tw + 13, ty + 4 - rock, 12, 7);
  if (R.speed > 60) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(wrap(i * 71 - BL.t * 500 * dir, vw)), deckY + 16 + (i * 7) % Math.max(1, vh - deckY - 18), 22, 1);
  }
  drawNight(vw, vh, false);
  if (BL.view === 'sketch') sketchFilter(vw, vh, 0, 0);
}

// ---------------------------------------------------------------------------
// Drawing: the sharp UI layer
// ---------------------------------------------------------------------------
// Outlined text with a slightly thinner stroke for the busy city HUD.
function cut(str, x, y, o = {}) { return ut(str, x, y, { stroke: Math.max(0.9, (o.size || 6) * 0.22), ...o }); }

function miniRect() { return { x: W - 62, y: 4, w: 58, h: 44 }; }

function bWrap(text, maxW, size) {
  const out = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && uwidth(t, size) > maxW) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

function fmtClock(m) {
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  return `${(h + 11) % 12 + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// A small key cap ("M") followed by what it does ("Map"). Returns the width.
function keyHint(key, label, x, y, align = 'left') {
  const kw = uwidth(key, 4.2) + 3, lw = uwidth(label, 4.4);
  const x0 = align === 'right' ? x - kw - 2 - lw : x;
  ubox(x0, y, kw, 6.4, '#f1ebdf', '#1d1816');
  cut(key, x0 + kw / 2, y + 0.6, { size: 4.2, color: '#1d1816', align: 'center', outline: null });
  cut(label, x0 + kw + 2, y + 0.4, { size: 4.4, color: '#f1ebdf' });
  return kw + 2 + lw;
}

function cityUI() {
  const k = BL;
  if (k.ride) { rideUI(); return; }
  const c = k.cam, z = c.zoom;
  const sx = wx => (wx - c.x) / z, sy = wy => (wy - c.y) / z;

  // Signs on buildings up close, landmark names from the drone.
  if (z <= 2) {
    for (const s of k.statics) {
      if (s.kind !== 'bld' || !s.b.signs) continue;
      if (s.x + s.w < c.x || s.x > c.x + c.w || s.y > c.y + c.h || s.base < c.y) continue;
      for (const g of s.b.signs) {
        const a = g.anchor ? s.img.anchors[g.anchor] : { x: g.x, y: g.y + (s.img.oy || 0) };
        cut(g.text, sx(s.x + a.x), sy(s.y + a.y - g.size / 2), { size: g.size / z, color: g.color, align: 'center', outline: g.outline === null ? null : '#1d1816', stroke: g.size * 0.24 / z });
      }
    }
  } else {
    for (const pc of B_POSTCARDS) {
      if (pc.ride || !bOnScreen(pc.x, pc.y, 0)) continue;
      cut(pc.name, sx(pc.x), sy(pc.y) - 12, { size: 4.6, color: SAVE.city.stamps.includes(pc.id) ? '#ffd25e' : '#ffffff', align: 'center' });
    }
  }
  const labelled = new Set();
  for (const L of Object.values(B_LINES)) {
    for (const st of L.stations) {
      if (labelled.has(st.id)) continue;
      labelled.add(st.id);
      const axis = linePoint(L, st.s).axis;
      const x = st.x, y = axis === 'h' ? st.y - DECK - 40 : st.y - DECK - 55;
      if (bOnScreen(x, y, 0)) cut(`${st.name}${B_INTERCHANGES[st.id] ? ' (change here)' : ''}`, sx(x), sy(y) - 5, { size: z > 2 ? 3.6 : 4.2, color: L.light, align: 'center' });
    }
  }

  for (const n of k.npcs) if (n.bubble && bOnScreen(n.x, n.y, 0)) ububble(n.bubble.text, sx(n.x), sy(n.y - (n.kid ? 13 : 17)), Math.min(1, n.bubble.t * 4), W);
  for (const tx of k.texts) if (bOnScreen(tx.x, tx.y, 10)) cut(tx.text, sx(tx.x), sy(tx.y), { size: 5, color: tx.color, align: 'center', alpha: Math.min(1, tx.life / tx.max * 2) });

  // Top-left: fish, postcards, clock.
  uimg(SPR.fish.img[0], 4, 5);
  cut(`${SAVE.fish}`, 15, 4, { size: 6, color: '#9fd6ef' });
  drawStampIcon(4, 14, 9, 7, true);
  cut(`${SAVE.city.stamps.length}/${B_POSTCARDS.length}`, 15, 13, { size: 6, color: '#ffd25e' });
  cut(fmtClock(k.clock), 4, 23, { size: 5, color: '#f6e9c8' });
  if (k.boost > 0) cut(`Kaapi ${Math.ceil(k.boost)}s`, 4, 31, { size: 4.6, color: '#ffe08a' });
  cut(k.place, W / 2, 4, { size: 6, color: '#ffffff', align: 'center' });
  if (k.place !== k.district) cut(k.district, W / 2, 12, { size: 4.4, color: '#d8d0c2', align: 'center' });

  drawCityMini();
  if (input.mode === 'keys') { const w = keyHint('V', `View: ${B_VIEW_INFO[k.view].name.toLowerCase()}`, W - 4, 51, 'right'); keyHint('M', 'Map', W - 4 - w - 6, 51, 'right'); }
  else if (input.mode === 'pad') cut('Select: map   LB: view', W - 4, 51, { size: 4.2, color: '#d8d0c2', align: 'right' });

  if (k.waypoint) {
    const wx = sx(k.waypoint.x), wy = sy(k.waypoint.y);
    const m = Math.hypot(k.waypoint.x - k.x, k.waypoint.y - k.y) * 2.5;
    const label = `${k.waypoint.name}  ${m > 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m'}`;
    if (wx < 8 || wx > W - 8 || wy < 8 || wy > H - 8) {
      const kx = sx(k.x), ky = sy(k.y) - 12;
      const ang = Math.atan2(wy - ky, wx - kx);
      const ex = clamp(kx + Math.cos(ang) * 400, 12, W - 12), ey = clamp(ky + Math.sin(ang) * 400, 30, H - 22);
      drawArrow(ex, ey, ang);
      cut(label, clamp(ex, 40, W - 40), ey + (ey > H / 2 ? -12 : 7), { size: 4.4, color: '#ffd25e', align: 'center' });
    } else {
      const bob = Math.sin(k.t * 5) * 1.5;
      drawArrow(wx, wy - 26 + bob, Math.PI / 2);
      cut(label, wx, wy - 40, { size: 4.4, color: '#ffd25e', align: 'center' });
    }
  }

  if (k.near && !k.mapOpen) {
    const key = input.mode === 'touch' ? 'JUMP' : input.mode === 'pad' ? 'A' : 'K';
    const kw = uwidth(key, 4.2) + 3;
    const w = kw + uwidth(k.near.label, 5.5) + 12;
    const py = k.card ? H * 0.3 : H - 16;
    const x0 = W / 2 - w / 2;
    ubox(x0, py, w, 10, 'rgba(29,24,22,0.86)');
    ubox(x0 + 4, py + 1.8, kw, 6.4, '#ffd25e', '#1d1816');
    cut(key, x0 + 4 + kw / 2, py + 2.4, { size: 4.2, color: '#1d1816', align: 'center', outline: null });
    cut(k.near.label, x0 + 7 + kw, py + 1.5, { size: 5.5, color: '#ffe08a' });
  }

  if (k.card) drawPostcard(k.card);
  if (k.toast) {
    const a = Math.min(1, k.toast.t * 3, (k.toast.max - k.toast.t) * 6);
    band(Math.round(H * 0.2) - 4, k.toast.sub ? 22 : 14, 0.45 * a);
    cut(k.toast.text, W / 2, Math.round(H * 0.2) - 2, { size: 8, color: '#ffd25e', align: 'center', alpha: a, font: TITLE_FONT, weight: 400, stroke: 3 });
    if (k.toast.sub) cut(k.toast.sub, W / 2, Math.round(H * 0.2) + 9, { size: 5, color: '#ffffff', align: 'center', alpha: a });
  }
  if (k.banner) {
    const a = Math.min(1, k.banner.t * 2);
    const y0 = Math.round(H * 0.3);
    band(y0 - 6, 34, 0.45 * a);
    utitle(k.banner.title, W / 2, y0, 10, '#ffd25e', 'center', a);
    cut(k.banner.sub, W / 2, y0 + 15, { size: 6, color: '#ffffff', align: 'center', alpha: a });
  }
  if (k.t < 9 && !k.mapOpen) {
    const a = Math.min(1, 9 - k.t);
    const hint = input.mode === 'touch' ? 'Stick to walk, JUMP to talk or ride, MAP and VIEW up top.' : input.mode === 'pad' ? 'Stick to walk, A to talk or ride, Select for the map, LB to change view.' : 'WASD to walk, K to talk or ride, M for the map, V to change view.';
    cut(hint, W / 2, H - 16, { size: 5, color: '#ffffff', align: 'center', alpha: a });
  }
  if (k.mapOpen) drawCityMap();
}

function drawArrow(x, y, ang) {
  uctx.save();
  uctx.translate(x, y);
  uctx.rotate(ang);
  uctx.fillStyle = '#1d1816';
  uctx.beginPath(); uctx.moveTo(7, 0); uctx.lineTo(-4, -5.5); uctx.lineTo(-2, 0); uctx.lineTo(-4, 5.5); uctx.closePath(); uctx.fill();
  uctx.fillStyle = '#ffd25e';
  uctx.beginPath(); uctx.moveTo(5.5, 0); uctx.lineTo(-3, -4); uctx.lineTo(-1.2, 0); uctx.lineTo(-3, 4); uctx.closePath(); uctx.fill();
  uctx.restore();
}

function drawStampIcon(x, y, w, h, filled) {
  urect(x - 0.5, y - 0.5, w + 1, h + 1, INK);
  urect(x, y, w, h, filled ? '#f6e9c8' : '#6e6258');
  urect(x + 1, y + 1, w - 2, h - 2, filled ? '#d8433b' : '#8a7e72');
  urect(x + w / 2 - 1, y + h / 2 - 1, 2, 2, '#ffd25e');
}

function drawPostcard(card) {
  const a = Math.min(1, card.t * 2, (6.5 - card.t) * 5);
  const w = Math.min(190, W - 20), x = W / 2 - w / 2;
  const lines = bWrap(card.pc.fact, w - 30, 5);
  const h = 18 + lines.length * 7;
  const y = H - h - 4;
  ubox(x, y, w, h, '#f6efe0', '#1d1816', a);
  urect(x + 2, y + 2, w - 4, 1, '#d8433b', a);
  urect(x + 2, y + h - 3, w - 4, 1, '#2f6db0', a);
  uctx.globalAlpha = a;
  drawStampIcon(x + w - 18, y + 4, 13, 10, true);
  uctx.globalAlpha = 1;
  cut('POSTCARD', x + 5, y + 3.5, { size: 4, color: '#8a7e72', outline: null, alpha: a });
  cut(card.pc.name, x + 5, y + 8, { size: 6.5, color: '#1d1816', outline: null, alpha: a });
  lines.forEach((l, i) => cut(l, x + 5, y + 16 + i * 7, { size: 5, color: '#3a302b', outline: null, alpha: a }));
}

function drawCityMini() {
  const k = BL, m = miniRect();
  const span = 640, spanY = span * m.h / m.w;
  const s = m.w / span;
  const wx0 = clamp(k.x - span / 2, 0, BW - span), wy0 = clamp(k.y - spanY / 2, 0, BH - spanY);
  ubox(m.x - 1.5, m.y - 1.5, m.w + 3, m.h + 3, '#1d1816', '#e9e4dc');
  uctx.save();
  uctx.beginPath();
  uctx.rect(m.x, m.y, m.w, m.h);
  uctx.clip();
  uctx.imageSmoothingEnabled = false;
  uctx.drawImage(k.mini, wx0 / 8, wy0 / 8, span / 8, spanY / 8, m.x, m.y, m.w, m.h);
  const X = wx => m.x + (wx - wx0) * s, Y = wy => m.y + (wy - wy0) * s;
  drawMetroLines(X, Y, 0.9);
  for (const tr of k.trains) { const p = linePoint(B_LINES[tr.line], tr.s); urect(X(p.x) - 1, Y(p.y) - 1, 2, 2, '#ffffff'); }
  for (const pc of B_POSTCARDS) {
    if (pc.ride) continue;
    const done = SAVE.city.stamps.includes(pc.id);
    urect(X(pc.x) - 1.2, Y(pc.y) - 1.2, 2.4, 2.4, INK);
    urect(X(pc.x) - 0.8, Y(pc.y) - 0.8, 1.6, 1.6, done ? '#ffd25e' : '#ffffff');
  }
  if (k.waypoint) { const b = Math.sin(k.t * 6) > 0; urect(X(k.waypoint.x) - 1.5, Y(k.waypoint.y) - 1.5, 3, 3, b ? '#ff5a5a' : '#ffd25e'); }
  uctx.strokeStyle = 'rgba(255,255,255,0.6)';
  uctx.lineWidth = 0.4;
  if (k.cam) uctx.strokeRect(X(k.cam.x), Y(k.cam.y), k.cam.w * s, k.cam.h * s);
  urect(X(k.x) - 1.5, Y(k.y) - 1.5, 3, 3, INK);
  urect(X(k.x) - 1, Y(k.y) - 1, 2, 2, Math.sin(k.t * 8) > 0 ? '#ff8a7a' : '#ffffff');
  uctx.restore();
  cut('N', m.x + 3, m.y + 1, { size: 4, color: '#ffffff' });
}

function drawMetroLines(X, Y, wid) {
  for (const L of Object.values(B_LINES)) {
    uctx.strokeStyle = L.col;
    uctx.lineWidth = wid;
    uctx.beginPath();
    L.pts.forEach(([x, y], i) => (i ? uctx.lineTo(X(x), Y(y)) : uctx.moveTo(X(x), Y(y))));
    uctx.stroke();
  }
  uctx.strokeStyle = '#3a2618';
  uctx.setLineDash([1, 1]);
  uctx.lineWidth = wid * 0.8;
  uctx.beginPath(); uctx.moveTo(X(60), Y(RAIL_Y)); uctx.lineTo(X(1470), Y(RAIL_Y)); uctx.stroke();
  uctx.setLineDash([]);
}

function drawCityMap() {
  const k = BL, M = mapLayout();
  urect(0, 0, W, H, '#100e0d', 0.72);
  utitle('NAMMA BENGALURU', W / 2, 3, 6, '#ffd25e');
  ubox(M.vx - 2, M.vy - 2, M.vw + 4, M.vh + 4, '#1d1816', '#e9e4dc');
  uctx.save();
  uctx.beginPath(); uctx.rect(M.vx, M.vy, M.vw, M.vh); uctx.clip();
  uctx.imageSmoothingEnabled = false;
  uctx.drawImage(k.mini, M.X(0), M.Y(0), BW * M.s, BH * M.s);
  drawMetroLines(M.X, M.Y, k.mapZoom > 1 ? 1.6 : 1.1);
  const lab = k.mapZoom > 1 ? 4.4 : 3.4;
  // District names, skipping any that would collide with one already drawn.
  const placed = [];
  for (const d of [...B_DISTRICTS].sort((a, b) => b.w * b.h - a.w * a.h)) {
    const w = uwidth(d.name, lab), x = M.X(d.x + d.w / 2), y = M.Y(d.y + d.h / 2) - 2;
    const box = { x: x - w / 2 - 1, y: y - 1, w: w + 2, h: lab * 1.4 };
    if (placed.some(p => p.x < box.x + box.w && box.x < p.x + p.w && p.y < box.y + box.h && box.y < p.y + p.h)) continue;
    placed.push(box);
    cut(d.name, x, y, { size: lab, color: 'rgba(255,255,255,0.78)', align: 'center', stroke: 0.9 });
  }
  for (const tr of k.trains) { const p = linePoint(B_LINES[tr.line], tr.s); urect(M.X(p.x) - 1.2, M.Y(p.y) - 1.2, 2.4, 2.4, '#ffffff'); }
  const sel = k.mapSel;
  for (const t of mapTargets()) {
    const x = M.X(t.x), y = M.Y(t.y);
    if (t.kind === 'station') { urect(x - 1.6, y - 1.6, 3.2, 3.2, INK); urect(x - 1.1, y - 1.1, 2.2, 2.2, '#ffffff'); }
    else drawStampIcon(x - 2.5, y - 2, 5, 4, t.done);
    if (sel && t.id === sel.id) {
      uctx.strokeStyle = Math.sin(k.t * 8) > 0 ? '#ffd25e' : '#ffffff';
      uctx.lineWidth = 0.7;
      uctx.strokeRect(x - 4, y - 4, 8, 8);
    }
  }
  if (k.waypoint) drawArrow(M.X(k.waypoint.x), M.Y(k.waypoint.y) - 6, Math.PI / 2);
  uimg(SPR.kitten.idle.img[0], M.X(k.x) - 4, M.Y(k.y) - 9, 8, 10);
  uctx.restore();
  if (sel) {
    const status = sel.kind === 'station' ? 'Namma Metro station' : sel.done ? 'Postcard collected' : 'Postcard to find';
    const txt = `${sel.name}  -  ${status}`;
    const w = uwidth(txt, 5.5) + 10;
    const by = M.Y(sel.y) > H / 2 ? M.vy + 2 : M.vy + M.vh - 12;
    ubox(W / 2 - w / 2, by, w, 10, 'rgba(29,24,22,0.9)');
    cut(txt, W / 2, by + 1.6, { size: 5.5, color: '#ffd25e', align: 'center' });
  }
  if (input.mode === 'touch') cut('Tap a place to head there. MAP to close.', W / 2, H - 10, { size: 4.6, color: '#d8d0c2', align: 'center' });
  else if (input.mode === 'pad') cut('D-pad: choose   A: go there   B: zoom   Select: close', W / 2, H - 10, { size: 4.6, color: '#d8d0c2', align: 'center' });
  else {
    const items = [['Arrows', 'Choose'], ['K', 'Go there'], ['V', k.mapZoom > 1 ? 'Zoom out' : 'Zoom in'], ['M', 'Close']];
    const total = items.reduce((s, [a, b]) => s + uwidth(a, 4.2) + 5 + uwidth(b, 4.4) + 8, -8);
    let x = W / 2 - total / 2;
    for (const [a, b] of items) x += keyHint(a, b, x, H - 10) + 8;
  }
}

function rideUI() {
  const R = BL.ride;
  if (R.phase === 'pick') {
    const w = Math.min(250, W - 8), h = Math.min(132, H - 6), x = W / 2 - w / 2, y = H / 2 - h / 2;
    ubox(x, y, w, h, 'rgba(29,24,22,0.95)');
    cut('NAMMA METRO', W / 2, y + 4, { size: 7, color: '#ffd25e', align: 'center', font: TITLE_FONT, weight: 400, stroke: 2.4 });
    cut(`From ${B_STATIONS[R.from].name}. Where to?`, W / 2, y + 13, { size: 5, color: '#d8d0c2', align: 'center' });
    R.hits = [];
    B_COLS.forEach((lid, ci) => {
      const L = B_LINES[lid], cx = x + 7 + ci * (w - 10) / 3, y0 = y + 29;
      const gap = (h - 42) / 9;
      cut(L.name, cx, y0 - 8, { size: 5, color: L.light });
      urect(cx - 0.8, y0, 1.6, gap * (L.stations.length - 1), L.col);
      L.stations.forEach((s, ri) => {
        const sy = y0 + ri * gap, here = s.id === R.from, sel = R.sel.col === ci && R.sel.row === ri;
        urect(cx - 2.5, sy - 2.5, 5, 5, INK);
        urect(cx - 1.8, sy - 1.8, 3.6, 3.6, here ? '#ff8a7a' : B_INTERCHANGES[s.id] ? '#ffd25e' : '#ffffff');
        cut(here ? `${s.name} (here)` : s.name, cx + 5, sy - 2.6, { size: 4.3, color: sel ? '#ffd25e' : here ? '#ff8a7a' : '#ffffff' });
        if (sel) drawArrow(cx - 7, sy, 0);
        R.hits.push({ x: cx + 22, y: sy, sel: { col: ci, row: ri } });
      });
    });
    if (input.mode === 'touch') cut('Tap a station. II to cancel.', W / 2, y + h - 8, { size: 4.6, color: '#d8d0c2', align: 'center' });
    else if (input.mode === 'pad') cut('D-pad: choose   A: ride   Start: cancel', W / 2, y + h - 8, { size: 4.6, color: '#d8d0c2', align: 'center' });
    else {
      const items = [['Arrows', 'Choose'], ['K', 'Ride'], ['Esc', 'Cancel']];
      const total = items.reduce((s, [a, b]) => s + uwidth(a, 4.2) + 5 + uwidth(b, 4.4) + 8, -8);
      let kx = W / 2 - total / 2;
      for (const [a, b] of items) kx += keyHint(a, b, kx, y + h - 9) + 8;
    }
    return;
  }
  const hop = R.hops[R.hop], L = B_LINES[hop.line];
  const z = canvas.width / W;
  for (const lb of R.labels || []) if (lb.x > -40 && lb.x < canvas.width + 40) cut(lb.text, lb.x / z, Math.max(32, lb.y / z - 5), { size: 4.6, color: '#ffffff', align: 'center' });
  for (const b of R.boards || []) if (b.x > -50 && b.x < canvas.width + 50) cut(b.text, b.x / z, b.y / z - 2.6, { size: 4.6, color: '#ffffff', align: 'center', outline: null });
  band(0, 14, 0.55);
  urect(0, 13, W, 1, L.col);
  cut(`${L.name}  >  ${R.toName}`, 6, 3.5, { size: 6, color: L.light });
  cut(fmtClock(BL.clock), W - 6, 3.5, { size: 6, color: '#f6e9c8', align: 'right' });
  const left = R.hops.length - R.hop - (R.phase === 'dwell' ? 1 : 0);
  cut(R.phase === 'dwell' ? `At ${hop.toName}` : `Next: ${hop.toName}`, 6, 16, { size: 5, color: '#ffffff' });
  cut(left > 0 ? `${left} stop${left === 1 ? '' : 's'} to go` : 'Arriving', 6, 23, { size: 4.4, color: '#d8d0c2' });
  if (!R.fast) {
    const key = input.mode === 'touch' ? 'DASH' : input.mode === 'pad' ? 'B' : 'L';
    if (input.mode === 'keys') keyHint(key, 'Hold to hurry', W - 50, 16); else cut(`Hold ${key} to hurry`, W - 6, 16, { size: 4.4, color: '#d8d0c2', align: 'right' });
  }
  if (R.caption) {
    const a = Math.min(1, R.caption.t * 3);
    band(H - 26, 22, 0.55 * a);
    cut(R.caption.kn, W / 2, H - 23, { size: 6.5, color: '#ffd25e', align: 'center', alpha: a });
    cut(R.caption.en, W / 2, H - 13, { size: 5, color: '#ffffff', align: 'center', alpha: a });
  }
}
