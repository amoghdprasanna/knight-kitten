'use strict';

// ---------------------------------------------------------------------------
// Namma Bengaluru: a free-roam, pocket-sized Bengaluru with R.K. Narayan's
// Malgudi round the corner.
//
// Walk anywhere, collect a postcard at every landmark, ride Namma Metro and
// switch views: street (default), drone (zoomed out) and Malgudi sketch (ink
// on paper, after R.K. Laxman's drawings for the TV show). M opens the city
// map, where a destination can be marked.
// ---------------------------------------------------------------------------
const BW = 2000, BH = 1600;                 // city size in world pixels
const BCELL = 4, BGW = BW / BCELL, BGH = BH / BCELL;
const DECK = 20;                            // height of the metro viaduct

const B_ROADS = [
  { name: 'Ambedkar Veedhi', x: 0, y: 346, w: BW, h: 28 },
  { name: 'K.H. Road', x: 686, y: 946, w: BW - 686, h: 28 },
  { name: 'Lawley Road', x: 0, y: 946, w: 686, h: 28, dirt: true },
  { name: 'Race Course Road', x: 686, y: 0, w: 28, h: BH },
  { name: 'Lalbagh Road', x: 1426, y: 0, w: 28, h: BH },
  { name: 'Kabir Street', x: 66, y: 374, w: 28, h: BH - 374, dirt: true },
  { name: 'Market Road', x: 94, y: 652, w: 592, h: 22, dirt: true },
  { name: '11th Main, Jayanagar', x: 1454, y: 1236, w: 546, h: 20, small: true },
  { name: '30th Cross, Jayanagar', x: 1454, y: 1420, w: 546, h: 20, small: true },
  { name: '9th Main, Jayanagar', x: 1690, y: 974, w: 20, h: 626, small: true },
];

const B_DISTRICTS = [
  { name: 'Race Course', x: 0, y: 0, w: 686, h: 346, ground: '#77a34c', mus: 'city' },
  { name: 'Vidhana Veedhi', x: 714, y: 0, w: 712, h: 346, ground: '#7fae54', mus: 'city' },
  { name: 'MG Road', x: 1454, y: 0, w: 546, h: 346, ground: '#77a34c', mus: 'city' },
  { name: 'Malgudi', x: 0, y: 374, w: 686, h: 1226, ground: '#cdb07c', mus: 'malgudi' },
  { name: 'Cubbon Park', x: 714, y: 374, w: 712, h: 572, ground: '#659843', mus: 'city' },
  { name: 'UB City', x: 1454, y: 374, w: 546, h: 572, ground: '#cbc0aa', mus: 'city' },
  { name: 'Lalbagh', x: 714, y: 974, w: 712, h: 626, ground: '#70a548', mus: 'city' },
  { name: 'Jayanagar', x: 1454, y: 974, w: 546, h: 626, ground: '#cfc5b0', mus: 'city' },
];

const B_LAKE = { x: 1230, y: 1320, rx: 120, ry: 52 };
const B_RIVER = { x: 0, y: 1380, w: 686, h: 64 };
const B_STADIUM = { x: 1740, y: 172, rx: 200, ry: 112, irx: 140, iry: 74 };
const B_TRACK = { x: 390, y: 200, rx: 250, ry: 106, w: 22 };
const B_CIRCLE = { x: 1440, y: 1330, r: 46, garden: 18 };
const B_CLOCK = { x: 800, y: 1036, r: 24 };
const B_RAIL_Y = 1062;

const B_LINES = {
  purple: {
    name: 'Purple Line', col: '#8a4fb8', dark: '#5b2f80', light: '#c9a3e6', axis: 'h', at: 360, from: 150, to: 1930,
    stations: [{ id: 'majestic', name: 'Majestic', p: 230 }, { id: 'vidhana', name: 'Vidhana Soudha', p: 980 },
      { id: 'cubbon', name: 'Cubbon Park', p: 1440 }, { id: 'mgroad', name: 'MG Road', p: 1800 }],
  },
  green: {
    name: 'Green Line', col: '#3fa34d', dark: '#24702f', light: '#9fdc8f', axis: 'v', at: 1440, from: 360, to: 1585,
    stations: [{ id: 'cubbon', name: 'Cubbon Park', p: 360 }, { id: 'lalbagh', name: 'Lalbagh', p: 1110 },
      { id: 'southend', name: 'South End Circle', p: 1250 }, { id: 'jayanagar', name: 'Jayanagar', p: 1500 }],
  },
};

// Where you come down the stairs from each station.
function stationExit(lineId, s) {
  const L = B_LINES[lineId];
  if (s.id === 'cubbon') return { x: 1464, y: 388 };
  return L.axis === 'h' ? { x: s.p, y: 388 } : { x: 1464, y: s.p };
}
const B_STATIONS = (() => {
  const out = {};
  for (const [lid, L] of Object.entries(B_LINES)) {
    for (const s of L.stations) {
      if (!out[s.id]) out[s.id] = { id: s.id, name: s.name, lines: [], ...stationExit(lid, s) };
      out[s.id].lines.push(lid);
    }
  }
  return out;
})();

const B_POSTCARDS = [
  { id: 'vidhana', name: 'Vidhana Soudha', x: 1090, y: 318, r: 70, fact: "Karnataka's legislature, finished in 1956 in Bangalore granite. Over the door: Government's Work is God's Work." },
  { id: 'highcourt', name: 'Karnataka High Court', x: 920, y: 486, r: 60, fact: 'Attara Kacheri, the "eighteen offices". The red building (1868) faces Vidhana Soudha across the road.' },
  { id: 'cubbon', name: 'Cubbon Park', x: 980, y: 776, r: 60, fact: 'Laid out in 1870. Its official name is Sri Chamarajendra Park. Morning walkers: countless.' },
  { id: 'library', name: 'State Central Library', x: 1250, y: 652, r: 50, fact: 'Seshadri Iyer Memorial Hall, the red building in Cubbon Park, holds the State Central Library.' },
  { id: 'ubcity', name: 'UB City', x: 1640, y: 776, r: 70, fact: 'Glass towers and a luxury mall on Vittal Mallya Road.' },
  { id: 'stadium', name: 'Chinnaswamy Stadium', x: 1740, y: 180, r: 80, fact: 'Test cricket here since 1974, and home of RCB. Ee sala cup namde!' },
  { id: 'racecourse', name: 'Bangalore Race Course', x: 390, y: 104, r: 80, fact: 'The Bangalore Turf Club has raced horses here for about a century.' },
  { id: 'holidayinn', name: 'Holiday Inn, Race Course Rd', x: 790, y: 338, r: 46, fact: 'A hotel with the racetrack for a neighbour. Room service comes with hoofbeats.' },
  { id: 'glasshouse', name: 'Lalbagh Glass House', x: 1000, y: 1158, r: 70, fact: "Built in 1889, inspired by London's Crystal Palace. Flower shows every January and August." },
  { id: 'rock', name: 'Lalbagh Rock', x: 860, y: 1462, r: 60, fact: 'Some of the oldest rock on Earth, about 3,000 million years old. A Kempegowda tower stands on top.' },
  { id: 'mtr', name: 'MTR, Lalbagh Road', x: 1360, y: 1052, r: 40, fact: 'Mavalli Tiffin Rooms, serving since 1924. Rava idli was invented here when rice ran short in WWII.' },
  { id: 'jayanagar', name: 'Jayanagar Blossom Avenue', x: 1600, y: 1246, r: 70, fact: 'Planned in 1948. When the pink tabebuias bloom, Bengaluru calls it cherry blossom season.' },
  { id: 'metro', name: 'Namma Metro', ride: true, x: 980, y: 388, fact: 'Opened in 2011. The Purple Line runs east to west, the Green Line north to south.' },
  { id: 'malgudi', name: 'Malgudi Station', x: 400, y: 1050, r: 60, fact: "R.K. Narayan's imaginary town. Shankar Nag filmed Malgudi Days (1986) in Agumbe." },
  { id: 'swami', name: 'Swami & Friends', x: 300, y: 852, r: 50, fact: "Swami and Friends (1935) was R.K. Narayan's first novel. Swami still hasn't done his sums." },
  { id: 'sarayu', name: 'Sarayu Ghats', x: 300, y: 1372, r: 50, fact: 'The river Sarayu runs through Malgudi. Best visited after school, says Swami.' },
];

// Buildings: centre x, base y, footprint (fw x fd) and signs drawn on the
// sharp UI layer (positions relative to the sprite's top-left).
const B_BUILDINGS = [
  { spr: 'grandstand', x: 390, y: 80, fw: 216, fd: 30, mcol: '#e9e2d4', signs: [{ x: 110, y: 43, text: 'BANGALORE TURF CLUB', size: 3.6, color: '#ffffff' }] },
  { spr: 'holidayinn', x: 790, y: 326, fw: 96, fd: 46, mcol: '#e9dfcc', signs: [{ x: 55, y: 26, text: 'HOLIDAY INN', size: 4.4, color: '#ffffff' }] },
  { spr: 'vidhana', x: 1090, y: 300, fw: 286, fd: 76, mcol: '#efe6d2', signs: [{ x: 150, y: 48.6, text: "GOVERNMENT'S WORK IS GOD'S WORK", size: 3, color: '#4b4136', outline: null }] },
  { spr: 'highcourt', x: 920, y: 474, fw: 232, fd: 56, mcol: '#c0473c' },
  { spr: 'library', x: 1250, y: 640, fw: 104, fd: 36, mcol: '#c0473c' },
  { spr: 'bandstand', x: 980, y: 760, fw: 30, fd: 12, mcol: '#efe7da' },
  { spr: 'ubcity', x: 1640, y: 760, fw: 180, fd: 70, mcol: '#7fa6c4', signs: [{ x: 95, y: 188, text: 'UB CITY', size: 5, color: '#ffe7a8' }] },
  { spr: 'darshini', x: 1530, y: 922, fw: 40, fd: 14, mcol: '#f2e0b0', signs: [{ x: 22, y: 6.5, text: 'FILTER KAAPI', size: 3.4, color: '#7a2b25', outline: null }] },
  { spr: 'shopSilk', x: 1820, y: 930, fw: 60, fd: 26, mcol: '#e3a64a', signs: [{ x: 32, y: 20, text: 'SILKS', size: 4.4, color: '#ffe7a8' }] },
  { spr: 'shopBooks', x: 1890, y: 930, fw: 60, fd: 26, mcol: '#5b8ee0', signs: [{ x: 32, y: 20, text: 'BOOKS', size: 4.4, color: '#ffffff' }] },
  { spr: 'shopPub', x: 1960, y: 930, fw: 60, fd: 26, mcol: '#7a4a2a', signs: [{ x: 32, y: 20, text: 'BREW PUB', size: 4, color: '#ffd25e' }] },
  { spr: 'glasshouse', x: 1000, y: 1140, fw: 200, fd: 46, mcol: '#bfe3e8' },
  { spr: 'rock', x: 860, y: 1450, fw: 100, fd: 34, mcol: '#9c9a94' },
  { spr: 'mtr', x: 1360, y: 1040, fw: 58, fd: 22, mcol: '#efe7da', signs: [{ x: 32, y: 9, text: 'MTR  1924', size: 4, color: '#2f6b3a', outline: null }] },
  { spr: 'complex', x: 1855, y: 1130, fw: 146, fd: 36, mcol: '#d9cbb0', signs: [{ x: 75, y: 7, text: '4TH BLOCK COMPLEX', size: 4, color: '#ffffff' }] },
  { spr: 'bakery', x: 1760, y: 1226, fw: 48, fd: 18, mcol: '#f0d78a', signs: [{ x: 26, y: 8, text: 'IYENGAR BAKERY', size: 3.4, color: '#b8281e', outline: null }] },
  { spr: 'school', x: 480, y: 520, fw: 124, fd: 38, mcol: '#d9c7a2', signs: [{ x: 65, y: 31, text: 'ALBERT MISSION SCHOOL', size: 3.4, color: '#3d2a1e', outline: null }] },
  { spr: 'temple', x: 560, y: 884, fw: 50, fd: 22, mcol: '#e8dcc0' },
  { spr: 'banyan', x: 300, y: 840, fw: 34, fd: 12, mcol: null },
  { spr: 'mstation', x: 330, y: 1040, fw: 124, fd: 28, mcol: '#e1b45f' },
  { spr: 'board', x: 480, y: 1050, fw: 30, fd: 3, mcol: null, signs: [{ x: 20, y: 5, text: 'MALGUDI', size: 5, color: '#1d1816', outline: null }] },
  { spr: 'tunnel', x: 664, y: 1080, fw: 44, fd: 14, mcol: '#7d705c' },
  { spr: 'hut', x: 200, y: 1530, fw: 36, fd: 16, mcol: '#c9a55a' },
  { spr: 'hut', x: 470, y: 1565, fw: 36, fd: 16, mcol: '#c9a55a' },
  { spr: 'mempi', x: 380, y: 1468, fw: 6, fd: 3, mcol: null, signs: [{ x: 13, y: 3, text: 'TO MEMPI FOREST', size: 3.2, color: '#1d1816', outline: null }] },
  { spr: 'statue', x: 1440, y: 1336, fw: 8, fd: 6, mcol: null },
];
for (const x of [1599, 1881]) for (const y of [91, 249]) B_BUILDINGS.push({ spr: 'flood', x, y, fw: 6, fd: 4, mcol: null });

// Jayanagar and Malgudi houses fill the blocks.
(() => {
  let n = 0;
  const jrow = (xs, y) => xs.forEach(x => B_BUILDINGS.push({ spr: `jhouse${n++ % 6}`, x, y, fw: 44, fd: 18, mcol: '#e9c9a8', house: 'j' }));
  jrow([1500, 1554, 1608, 1662], 1060);
  jrow([1500, 1554, 1608, 1662], 1222);
  jrow([1830, 1890, 1950], 1222);
  for (const y of [1318, 1408, 1500, 1590]) {
    jrow([1500, 1554, 1608, 1662], y);
    jrow([1740, 1794, 1848, 1902, 1956], y);
  }
  const mrow = (xs, y) => xs.forEach(x => B_BUILDINGS.push({ spr: `mhouse${n++ % 4}`, x, y, fw: 40, fd: 16, mcol: '#b9573a', house: 'm' }));
  mrow([140, 196, 252, 308, 364, 580, 636], 640);
  mrow([140, 196, 430, 486, 620], 730);
  mrow([150, 210, 520, 600], 1190);
})();

// ---------------------------------------------------------------------------
// Pixel art for the city, drawn once when the city is first built.
// ---------------------------------------------------------------------------
function bcv(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  const r = (col, x, y, ww = 1, hh = 1) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); };
  fn(r, c, w, h);
  return cv;
}

// A shape given as rows [y, x0, x1]: outline first, then fill per pixel.
function bShape(r, rows, o, fill) {
  for (const [y, x0, x1] of rows) r(o, x0 - 1, y - 1, x1 - x0 + 3, 3);
  for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) r(fill(x, y, x0, x1), x, y);
}

function domeRows(cx, by, rx, ry) {
  const rows = [];
  for (let dy = 0; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    rows.push([by - dy, cx - half, cx + half]);
  }
  return rows;
}

function bDome(r, cx, by, rx, ry, cols, ribs = 0, finial = '#e2b54a') {
  const [o, lit, mid, dark] = cols;
  bShape(r, domeRows(cx, by, rx, ry), o, (x, y, x0, x1) => {
    const k = (x - x0) / Math.max(1, x1 - x0);
    let col = k < 0.28 ? lit : k > 0.68 ? dark : mid;
    if (ribs && (x - cx) % ribs === 0 && col !== lit) col = dark;
    return col;
  });
  r(o, cx - 1, by - ry - 5, 3, 4);
  r(finial, cx, by - ry - 6, 1, 5);
}

function archWindow(r, x, y, w, h, frame, glass) {
  r(frame, x - 1, y, w + 2, h + 1);
  r(frame, x, y - 1, w, 1);
  r(glass, x, y + 1, w, h - 1);
  r(glass, x + 1, y, w - 2, 1);
}

const B_ART = {
  vidhana: () => bcv(300, 140, (r) => {
    const O = '#4b4136', G = '#e6dcc8', G2 = '#d3c7ae', G3 = '#b5a78b', G4 = '#8c7e64', WIN = '#4c4c58', WIN2 = '#6f7584';
    const stone = ['#4b4136', '#f4ecdc', G, G3];
    r(O, 4, 126, 292, 12); r(G3, 5, 127, 290, 10); r(G2, 5, 127, 290, 2);
    // Wings with four floors of windows.
    r(O, 8, 56, 284, 72); r(G, 9, 57, 282, 70); r(G3, 9, 59, 282, 2);
    r(O, 6, 54, 288, 1); r(G2, 6, 55, 288, 2);
    for (let x = 9; x < 291; x += 3) r(G, x, 52, 2, 2);
    for (const y of [75, 93, 111]) r(G2, 9, y, 282, 2);
    for (let x = 14; x < 288; x += 9) {
      if (x > 88 && x < 210) continue;
      for (const y of [62, 80, 98, 115]) { archWindow(r, x, y, 4, 8, G4, WIN); r(WIN2, x, y + 2, 1, 6); }
    }
    // Corner towers with chhatri domes; the flag flies on the east one.
    for (const tx of [8, 260]) {
      r(O, tx, 34, 32, 22); r(G, tx + 1, 35, 30, 21); r(G2, tx + 1, 35, 30, 2); r(G3, tx + 27, 37, 4, 19);
      for (let k = 0; k < 3; k++) archWindow(r, tx + 6 + k * 8, 42, 4, 9, G4, WIN);
      bDome(r, tx + 16, 33, 9, 8, stone, 3);
    }
    r(O, 276, 6, 1, 20);
    r('#ef8b2c', 277, 6, 9, 2); r('#ffffff', 277, 8, 9, 2); r('#2f8a3a', 277, 10, 9, 2); r('#2f4f8a', 281, 8, 1, 2);
    // Central block and portico of twelve columns.
    r(O, 90, 38, 120, 90); r(G, 91, 39, 118, 89);
    r(G2, 91, 41, 118, 3);
    r(G3, 92, 46, 116, 6);           // band for the inscription
    r('#7d715d', 93, 56, 114, 62);
    for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) r('#5f5547', 98 + k * 18, 62 + j * 18, 8, 10);
    for (let i = 0; i < 12; i++) {
      const x = 96 + Math.round(i * 9.6);
      r(O, x - 1, 54, 6, 64); r(G, x, 56, 4, 61); r('#f8f1e3', x, 56, 1, 61); r(G3, x + 3, 56, 1, 61);
      r(G2, x - 1, 54, 6, 3); r(G2, x - 1, 114, 6, 3);
    }
    r(G2, 91, 52, 118, 3); r(O, 91, 55, 118, 1);
    // Drum, main dome and side domes.
    r(O, 120, 22, 60, 17); r(G, 121, 23, 58, 16); r(G2, 121, 23, 58, 2);
    for (let x = 124; x < 178; x += 6) archWindow(r, x, 28, 3, 8, G4, WIN);
    bDome(r, 150, 21, 27, 17, stone, 4);
    r('#e2b54a', 147, 0, 7, 3); r('#b8892a', 148, 1, 5, 1);
    bDome(r, 98, 37, 7, 6, stone, 3);
    bDome(r, 202, 37, 7, 6, stone, 3);
    // Wide front steps.
    for (let k = 0; k < 7; k++) {
      const y = 118 + k * 3, x0 = 100 - k * 3, w = 100 + k * 6;
      r(O, x0, y, w, 1); r(k % 2 ? G2 : G, x0, y + 1, w, 2);
    }
  }),

  highcourt: () => bcv(240, 90, (r) => {
    const O = '#3d2724', RED = '#b8483d', RED2 = '#963a32', RED3 = '#d26355', WH = '#efe7da', WH2 = '#cfc4b2', WIN = '#3a2f2f', ROOF = '#5d4a44';
    r(O, 4, 80, 232, 9); r(WH2, 5, 81, 230, 7); r(WH, 5, 81, 230, 2);
    r(ROOF, 10, 20, 220, 9); r(O, 10, 19, 220, 1); r('#7a645c', 10, 21, 220, 2);
    r(O, 6, 29, 228, 52); r(RED, 7, 30, 226, 50); r(RED3, 7, 30, 226, 1); r(RED2, 222, 30, 12, 50);
    r(WH, 5, 27, 230, 3); r(O, 5, 26, 230, 1);
    r(WH, 7, 55, 226, 2); r(WH2, 7, 57, 226, 1);
    for (let x = 13; x < 228; x += 13) {
      if (x > 82 && x < 156) continue;
      archWindow(r, x, 36, 6, 13, WH, WIN);
      archWindow(r, x, 62, 6, 14, WH, WIN);
      r('#5a4846', x, 38, 1, 11); r('#5a4846', x, 64, 1, 12);
    }
    // Pediment and portico.
    r(O, 84, 24, 72, 57); r(RED2, 85, 25, 70, 55);
    for (let dy = 0; dy <= 18; dy++) {
      const half = Math.round((18 - dy) / 18 * 38);
      r(O, 120 - half - 1, 24 - dy, half * 2 + 3, 1);
      if (half > 1) r(dy < 2 ? WH2 : WH, 120 - half + 1, 24 - dy, half * 2 - 1, 1);
    }
    for (let dy = 3; dy <= 13; dy++) {
      const half = Math.round((16 - dy) / 18 * 30);
      r(RED, 120 - half, 22 - dy + 2, half * 2, 1);
    }
    r(WH, 116, 11, 9, 7); r(O, 117, 12, 7, 5); r(WH, 118, 13, 5, 3); r(O, 120, 13, 1, 2); r(O, 120, 14, 2, 1);
    for (let i = 0; i < 6; i++) {
      const x = 88 + i * 13;
      r(O, x - 1, 26, 6, 54); r(WH, x, 27, 4, 52); r('#ffffff', x, 27, 1, 52); r(WH2, x + 3, 27, 1, 52);
      r(WH2, x - 1, 26, 6, 2);
    }
    for (let k = 0; k < 4; k++) { r(O, 96 - k * 2, 80 + k * 2, 48 + k * 4, 1); r(WH, 96 - k * 2, 81 + k * 2, 48 + k * 4, 1); }
  }),

  library: () => bcv(110, 70, (r) => {
    const O = '#3d2724', RED = '#b8483d', RED2 = '#963a32', WH = '#efe7da', WIN = '#3a2f2f';
    r(O, 4, 62, 102, 7); r('#cfc4b2', 5, 63, 100, 5);
    r(O, 6, 30, 98, 33); r(RED, 7, 31, 96, 31); r(RED2, 92, 31, 11, 31);
    r(WH, 5, 28, 100, 3); r(O, 5, 27, 100, 1);
    for (let x = 0; x < 100; x += 4) r(WH, 6 + x, 25, 2, 2);
    for (const x of [12, 22, 32, 72, 82, 92]) { archWindow(r, x, 36, 5, 10, WH, WIN); archWindow(r, x, 50, 5, 9, WH, WIN); }
    r(O, 40, 14, 30, 49); r(RED, 41, 15, 28, 47); r(WH, 39, 12, 32, 3);
    archWindow(r, 50, 22, 10, 16, WH, WIN);
    r(O, 49, 44, 12, 18); r('#5a3a2a', 50, 45, 10, 17);
    bDome(r, 55, 11, 10, 8, ['#3d2724', '#e9e1d2', '#c9bfae', '#9a9082']);
    for (const x of [6, 98]) { r(O, x, 18, 6, 12); r(WH, x + 1, 19, 4, 11); bDome(r, x + 3, 17, 3, 3, ['#3d2724', '#e9e1d2', '#c9bfae', '#9a9082']); }
  }),

  bandstand: () => bcv(40, 38, (r) => {
    const O = '#3a3a34', WH = '#f2efe6', WH2 = '#cfcabd';
    r(O, 3, 30, 34, 7); r(WH2, 4, 31, 32, 5); r(WH, 4, 31, 32, 1);
    for (const x of [6, 13, 20, 27, 33]) { r(O, x - 1, 16, 3, 15); r(WH, x, 16, 1, 14); }
    r(O, 2, 13, 36, 4); r(WH, 3, 14, 34, 2);
    bDome(r, 20, 13, 16, 9, ['#2f3f2a', '#7fb86a', '#4f8a3c', '#35662b'], 4, '#e6c15e');
  }),

  ubcity: () => bcv(190, 232, (r) => {
    const O = '#22303f', GL = '#7fa6c4', GL2 = '#6890b4', GL3 = '#b4d2e4', GLD = '#45688a', ST = '#d9dee2';
    const tower = (x0, y0, w, y1, seed) => {
      r(O, x0 - 1, y0 - 1, w + 2, y1 - y0 + 2);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const d = (x - x0) + (y1 - y) * 0.6;
          let col = (y - y0) % 4 === 0 ? GLD : (x - x0) % 6 === 0 ? GL2 : GL;
          if (((d + seed) % 46) < 6) col = GL3;
          if (x > x0 + w - 5) col = col === GL3 ? GL : GLD;
          r(col, x, y);
        }
      }
    };
    tower(26, 98, 40, 200, 7);
    tower(126, 66, 38, 200, 21);
    tower(70, 34, 50, 200, 0);
    // The crown of the UB Tower.
    for (let y = 2; y < 34; y++) {
      const k = (34 - y) / 32;
      const half = Math.max(1, Math.round(25 * (1 - k * k * 0.92)));
      r(O, 95 - half - 1, y, half * 2 + 3, 1);
      r(y % 3 === 0 ? ST : GL3, 95 - half, y, half * 2 + 1, 1);
      r(GLD, 95 + Math.round(half * 0.5), y, Math.round(half * 0.5) + 1, 1);
    }
    r(O, 94, 0, 2, 4);
    r(O, 125, 60, 40, 6); r(ST, 126, 61, 38, 4);
    for (let y = 92; y < 98; y++) { const half = (y - 90) * 3; r(O, 46 - half, y, half * 2, 1); r(ST, 47 - half, y, half * 2 - 2, 1); }
    // Podium mall.
    r(O, 3, 180, 184, 51); r('#dacdb6', 4, 181, 182, 49); r('#efe5d3', 4, 181, 182, 2);
    r('#2b2a33', 60, 184, 70, 10);
    r(O, 8, 202, 174, 22); r('#36404c', 9, 203, 172, 20);
    for (let x = 12; x < 180; x += 10) r('#ffd98a', x, 205, 6, 15);
    r('#c9b28a', 4, 197, 182, 4); r('#a89270', 4, 200, 182, 1);
    for (let x = 6; x < 186; x += 12) { r('#3f7a35', x, 226, 6, 3); r('#5a9a45', x + 1, 225, 4, 2); }
  }),

  holidayinn: () => bcv(110, 130, (r) => {
    const O = '#3a3530', CR = '#ece2cf', CR2 = '#cfc2aa', GLS = '#6f93b0', GLS2 = '#9cbdd4', GRN = '#2f8f4e';
    r(O, 3, 70, 104, 52); r(CR2, 4, 71, 102, 50);
    r(O, 14, 20, 82, 102); r(CR, 15, 21, 80, 100); r(CR2, 86, 21, 9, 100);
    r(GRN, 15, 21, 80, 11); r('#56b574', 15, 21, 80, 2); r(O, 14, 32, 82, 1);
    for (let y = 36; y < 104; y += 7) for (let x = 19; x < 90; x += 8) { r(GLS, x, y, 6, 4); r(GLS2, x, y, 2, 4); }
    for (let y = 76; y < 112; y += 8) for (const x of [6, 98]) r(GLS, x, y, 6, 4);
    r(O, 34, 104, 42, 4); r('#d9d2c4', 35, 104, 40, 2);
    r(O, 42, 108, 26, 14); r('#2b3a48', 43, 109, 24, 13); r('#ffd98a', 45, 111, 8, 10); r('#ffd98a', 57, 111, 8, 10);
    r('#bdb5a5', 30, 122, 50, 7); r('#a39b8a', 30, 128, 50, 1);
  }),

  grandstand: () => bcv(220, 50, (r) => {
    const O = '#3a3530', RF = '#ece6da', RF2 = '#c7bfb0', crowd = ['#d8433b', '#f2c94c', '#5b8ee0', '#f1ead8', '#7cc35a', '#c3a0ec', '#2b2220'];
    const rnd = seeded(77);
    r(O, 4, 12, 212, 30); r('#9a948a', 5, 13, 210, 28);
    for (let k = 0; k < 7; k++) {
      const y = 14 + k * 4;
      r('#b5ada0', 5, y, 210, 1);
      for (let x = 6; x < 214; x += 2) if (rnd() < 0.75) r(crowd[Math.floor(rnd() * crowd.length)], x, y + 1, 1, 2);
    }
    for (const x of [8, 60, 110, 160, 210]) { r(O, x - 1, 6, 3, 34); r(RF2, x, 6, 1, 33); }
    r(O, 2, 2, 216, 8); r(RF, 3, 3, 214, 4); r(RF2, 3, 7, 214, 2);
    r(O, 4, 40, 212, 9); r('#2f6b3a', 5, 41, 210, 7); r('#3f8a4c', 5, 41, 210, 1);
  }),

  glasshouse: () => bcv(210, 80, (r) => {
    const O = '#3c4d52', FR = '#f3f6f4', GL = '#bfe3e8', GL2 = '#9fcfd9', PL = '#5a9a45';
    const glass = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        let col = (x - x0) % 5 === 0 || (y - y0) % 5 === 0 ? FR : ((x + y) % 11 < 3 ? GL : GL2);
        if (y > y0 + h - 6 && col !== FR) col = (x * 7 + y) % 5 < 3 ? PL : '#3f7a35';
        r(col, x, y);
      }
    };
    r(O, 4, 70, 202, 9); r('#d8d0c0', 5, 71, 200, 7); r('#efe9dc', 5, 71, 200, 1);
    // Side wings with barrel roofs.
    for (const [x0, x1] of [[8, 74], [136, 202]]) {
      r(O, x0 - 1, 38, x1 - x0 + 2, 33);
      glass(x0, 46, x1 - x0, 24);
      for (let y = 36; y < 46; y++) {
        const inset = Math.round((46 - y) * (46 - y) / 16);
        r(O, x0 + inset - 1, y, x1 - x0 - inset * 2 + 2, 1);
        r((y % 3 === 0) ? FR : GL, x0 + inset, y, x1 - x0 - inset * 2, 1);
      }
    }
    // Central transept with its big arched front.
    r(O, 73, 30, 64, 41);
    glass(74, 30, 62, 40);
    for (let dy = 0; dy <= 26; dy++) {
      const half = Math.round(32 * Math.sqrt(Math.max(0, 1 - (dy / 26) ** 2)));
      r(O, 105 - half - 1, 30 - dy, half * 2 + 3, 1);
      r(FR, 105 - half, 30 - dy, half * 2 + 1, 1);
      if (half > 2) r(dy % 4 ? GL : GL2, 105 - half + 1, 30 - dy, half * 2 - 1, 1);
    }
    for (let a = 0; a <= 8; a++) {
      const ang = Math.PI * a / 8;
      for (let k = 0; k < 26; k++) r(FR, Math.round(105 - Math.cos(ang) * k * 1.2), Math.round(30 - Math.sin(ang) * k));
    }
    r(O, 98, 52, 14, 18); r('#2f4f54', 99, 53, 12, 17); r(FR, 105, 53, 1, 17);
    r('#e2b54a', 104, 0, 3, 4);
  }),

  rock: () => bcv(120, 74, (r) => {
    const O = '#3a3a38', R1 = '#c2bfb6', R2 = '#9c9a94', R3 = '#77756f';
    const rnd = seeded(5);
    const rows = [];
    for (let y = 30; y < 72; y++) {
      const k = (y - 30) / 42;
      const half = Math.round(56 * Math.sqrt(Math.min(1, k * 1.6)) * (0.92 + Math.sin(y * 0.7) * 0.04));
      rows.push([y, 60 - half, 60 + half]);
    }
    bShape(r, rows, O, (x, y, x0, x1) => {
      const k = (x - x0) / Math.max(1, x1 - x0);
      let col = k < 0.3 ? R1 : k > 0.66 ? R3 : R2;
      if (rnd() < 0.08) col = R3;
      return col;
    });
    for (const [x, y, l] of [[40, 50, 12], [72, 46, 10], [58, 60, 14]]) for (let i = 0; i < l; i++) r(R3, x + i, y + Math.round(Math.sin(i * 0.8)));
    // Kempegowda tower: a small stone mantapa.
    const S1 = '#d9cfb8', S2 = '#b3a68a';
    r(O, 48, 26, 24, 6); r(S1, 49, 27, 22, 4);
    for (const x of [50, 57, 63, 69]) { r(O, x - 1, 13, 3, 14); r(S1, x, 13, 1, 13); }
    r(O, 46, 9, 28, 5); r(S1, 47, 10, 26, 3);
    for (let k = 0; k < 4; k++) { r(O, 50 + k * 3, 6 - k * 2, 20 - k * 6, 3); r(k % 2 ? S2 : S1, 51 + k * 3, 6 - k * 2, 18 - k * 6, 2); }
    r('#e2b54a', 59, 0, 2, 2);
  }),

  mtr: () => bcv(64, 46, (r) => {
    const O = '#3a3530', WH = '#f4efe4', WH2 = '#d9d2c4', GR = '#2f6b3a';
    r(O, 2, 4, 60, 8); r('#b5553a', 3, 5, 58, 6); r('#8a3a28', 3, 10, 58, 1);
    r(O, 4, 12, 56, 32); r(WH, 5, 13, 54, 30); r(WH2, 52, 13, 7, 30);
    r(GR, 5, 13, 54, 1); r('#f2e3b0', 8, 5, 48, 7); r(GR, 8, 5, 48, 1); r(GR, 8, 11, 48, 1);
    for (const x of [9, 19, 39, 49]) { r(GR, x - 1, 18, 7, 9); r('#6b8f9c', x, 19, 5, 7); }
    r(O, 27, 26, 10, 18); r('#7a4a2a', 28, 27, 8, 17);
    r(GR, 5, 42, 54, 2);
  }),

  darshini: () => bcv(44, 36, (r) => {
    const O = '#3a3530', CR = '#f2e0b0', GR = '#2f8a3a';
    r(O, 1, 2, 42, 9); r(CR, 2, 3, 40, 7); r(GR, 2, 9, 40, 1);
    r(O, 3, 11, 38, 24); r('#e6d9c0', 4, 12, 36, 22);
    r('#3a2a20', 6, 14, 32, 10);
    r('#b8bec4', 8, 20, 3, 4); r('#e9eef0', 8, 20, 1, 4); r('#b8bec4', 14, 20, 3, 4); r('#b8bec4', 30, 19, 4, 5);
    r('#8a5a3a', 4, 24, 36, 3); r('#6b4a32', 4, 27, 36, 7);
    r(GR, 4, 30, 36, 1);
  }),

  shop: (wall, sign, awning) => bcv(64, 62, (r) => {
    const O = '#3a3530';
    r(O, 3, 4, 58, 56); r(wall, 4, 5, 56, 54); r(shade(wall, -0.12), 52, 5, 8, 54);
    for (let y = 9; y < 14; y += 4) for (let x = 8; x < 56; x += 10) { r(O, x, y, 6, 3); r('#9cbdd4', x, y, 6, 2); }
    r(O, 4, 15, 56, 10); r(sign, 5, 16, 54, 8);
    r(awning, 3, 27, 58, 4); for (let x = 3; x < 61; x += 6) r('#ffffff', x, 27, 3, 4);
    r(O, 8, 32, 48, 26); r('#2b3a48', 9, 33, 46, 25);
    for (let x = 11; x < 54; x += 8) r('#ffd98a', x, 36, 5, 18);
  }),

  complex: () => bcv(150, 58, (r) => {
    const O = '#3a3530', W1 = '#d9cbb0', W2 = '#bfb197';
    const signs = ['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#c3a0ec', '#ee8b3a', '#5b8ee0'];
    r(O, 2, 12, 146, 45); r(W1, 3, 13, 144, 43); r(W2, 3, 34, 144, 2);
    r(O, 2, 2, 146, 11); r('#7a4a2a', 3, 3, 144, 9);
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 20;
      r(signs[i], x, 15, 18, 6);
      r(O, x, 23, 18, 10); r('#9cbdd4', x + 1, 24, 16, 8);
      r(O, x, 38, 18, 18); r(i % 3 ? '#8a8f96' : '#2b3a48', x + 1, 39, 16, 17);
      if (i % 3) for (let y = 40; y < 56; y += 2) r('#a3a9ae', x + 1, y, 16, 1);
      else r('#ffd98a', x + 3, 42, 12, 12);
    }
  }),

  bakery: () => bcv(52, 44, (r) => {
    const O = '#3a3530';
    r(O, 2, 4, 48, 39); r('#f6f0e2', 3, 5, 46, 37);
    r(O, 2, 2, 48, 12); r('#f0d78a', 3, 3, 46, 10); r('#b8281e', 3, 12, 46, 1);
    r('#2f6db0', 2, 15, 48, 4); for (let x = 2; x < 50; x += 6) r('#ffffff', x, 15, 3, 4);
    r(O, 6, 21, 40, 14); r('#3a4a58', 7, 22, 38, 12);
    for (let x = 9; x < 44; x += 6) { r('#e9c07a', x, 30, 4, 3); r('#c9824a', x, 29, 4, 1); r('#f4a3b8', x + 1, 25, 3, 3); }
    r('#8a5a3a', 6, 35, 40, 7); r('#b5824a', 6, 35, 40, 1);
  }),

  school: () => bcv(130, 72, (r) => {
    const O = '#3d2a1e', ST = '#dcc9a3', ST2 = '#bfa982', TL = '#b5553a', TL2 = '#8a3a28';
    r(O, 2, 16, 126, 12); r(TL, 3, 17, 124, 10);
    for (let y = 19; y < 27; y += 3) r(TL2, 3, y, 124, 1);
    r(O, 4, 27, 122, 44); r(ST, 5, 28, 120, 42); r(ST2, 5, 28, 120, 2);
    r('#f1e6c8', 30, 29, 70, 7); r(O, 30, 36, 70, 1);
    for (let x = 9; x < 122; x += 12) {
      r(O, x - 1, 46, 10, 23); r('#4a3a2e', x, 48, 8, 21); r('#4a3a2e', x + 1, 47, 6, 1);
      r(ST2, x + 9, 46, 2, 23);
    }
    for (let x = 9; x < 122; x += 12) { r(O, x + 1, 38, 5, 6); r('#5f6f7a', x + 2, 39, 3, 4); }
    r(O, 56, 0, 18, 28); r(ST, 57, 4, 16, 24); r(TL, 55, 0, 20, 5); r(TL2, 55, 4, 20, 1);
    r(O, 61, 9, 8, 8); r('#2b2220', 62, 10, 6, 7); r('#e6c15e', 63, 12, 4, 4);
  }),

  temple: () => bcv(56, 64, (r) => {
    const O = '#3d2a1e', ST = '#ecdfc0', ST2 = '#cdbb94', fig = ['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#ee8b3a'];
    r(O, 2, 46, 52, 17); r(ST, 3, 47, 50, 15); r('#d8433b', 3, 47, 50, 1); r('#ffffff', 3, 48, 50, 1);
    for (let x = 4; x < 52; x += 4) r(x % 8 ? '#d8433b' : '#ffffff', x, 58, 3, 3);
    r(O, 21, 50, 14, 13); r('#3a2a20', 22, 51, 12, 12); r('#e6c15e', 27, 53, 2, 3);
    for (let k = 0; k < 6; k++) {
      const w = 40 - k * 6, x = 28 - w / 2, y = 40 - k * 7;
      r(O, x - 1, y, w + 2, 7); r(k % 2 ? ST2 : ST, x, y + 1, w, 5);
      for (let fx = x + 2; fx < x + w - 2; fx += 4) r(fig[(fx + k) % fig.length], fx, y + 2, 2, 3);
    }
    r(O, 18, -1, 20, 0);
    r(O, 23, 1, 10, 4); r('#e6c15e', 24, 2, 8, 2);
    for (const x of [24, 28, 32]) { r('#e6c15e', x - 1, -1 + 1, 2, 1); }
  }),

  banyan: () => bcv(140, 104, (r, c) => {
    const rnd = seeded(1935);
    // Stone katte (platform) round the trunk.
    r('#3a3530', 44, 92, 52, 11); r('#b8b0a0', 45, 93, 50, 9); r('#d3cbbb', 45, 93, 50, 2);
    // Trunks and hanging roots.
    for (const [x, w] of [[60, 8], [70, 7], [54, 4], [78, 4]]) { r('#3a2618', x - 1, 50, w + 2, 44); r('#6b4a32', x, 50, w, 43); r('#8a6a4a', x, 50, 1, 43); }
    for (let i = 0; i < 26; i++) {
      const x = 10 + Math.floor(rnd() * 120), y0 = 40 + Math.floor(rnd() * 14), len = 14 + Math.floor(rnd() * 34);
      for (let y = y0; y < y0 + len; y++) r(rnd() < 0.5 ? '#7a5a3a' : '#5a3e2b', x, y);
    }
    const lumps = [];
    for (let i = 0; i < 16; i++) lumps.push({ x: 14 + rnd() * 112, y: 14 + rnd() * 26, r: 13 + rnd() * 10 });
    const can = blob(140, 62, (x, y) => lumps.some(l => (x - l.x) ** 2 + ((y - l.y) * 1.25) ** 2 < l.r * l.r), ['#1a301a', '#2a4f27', '#3a6a33', '#558a44'], 0.14, rnd);
    c.drawImage(can, 0, 0);
  }),

  mstation: () => bcv(130, 58, (r) => {
    const O = '#3d2a1e', OC = '#e1b45f', OC2 = '#c79a48', MR = '#7a2b25', TL = '#b5553a', TL2 = '#8a3a28';
    r(O, 8, 20, 114, 37); r(OC, 9, 21, 112, 35); r(OC2, 9, 21, 112, 2);
    r(MR, 9, 44, 112, 12); r('#5a1f1a', 9, 44, 112, 1);
    for (let x = 14; x < 118; x += 14) archWindow(r, x, 28, 6, 12, '#f4e9d0', '#3a2a20');
    r(O, 56, 26, 18, 30); r('#4a3020', 57, 28, 16, 28); r('#4a3020', 58, 27, 14, 1);
    r('#f4e9d0', 61, 14, 8, 8); r(O, 62, 15, 6, 6); r('#ffffff', 63, 16, 4, 4); r(O, 64, 17, 1, 2); r(O, 65, 18, 1, 1);
    // Tiled platform canopy on iron posts.
    r(O, 0, 6, 130, 13); r(TL, 1, 7, 128, 11);
    for (let y = 9; y < 18; y += 3) r(TL2, 1, y, 128, 1);
    for (let x = 1; x < 129; x += 4) r(TL2, x, 7 + (x % 8 ? 0 : 1), 1, 2);
    r('#5a1f1a', 1, 17, 128, 1);
    for (const x of [4, 124]) { r(O, x - 1, 18, 3, 38); r('#3a5a4a', x, 18, 1, 38); }
  }),

  board: () => bcv(40, 22, (r) => {
    const O = '#1d1816';
    for (const x of [6, 33]) { r(O, x, 9, 2, 13); for (let y = 10; y < 22; y += 4) r('#ffffff', x, y, 2, 2); }
    r(O, 0, 0, 40, 11); r('#f2cf3e', 1, 1, 38, 9);
  }),

  tunnel: () => bcv(50, 46, (r) => {
    const O = '#2f2a24';
    const rows = [];
    for (let y = 2; y < 46; y++) { const half = Math.round(25 * Math.sqrt(Math.min(1, (y - 2) / 20))); rows.push([y, 25 - half, 24 + half]); }
    bShape(r, rows, O, (x, y) => (y < 14 ? '#5d8a3e' : (x + y) % 7 < 2 ? '#8a7c64' : '#a59880'));
    for (let dy = 0; dy < 22; dy++) {
      const half = Math.round(10 * Math.sqrt(Math.max(0, 1 - (Math.max(0, dy - 10) / 12) ** 2)));
      r(dy < 10 ? '#0f0d0b' : '#0f0d0b', 25 - half, 45 - dy, half * 2, 1);
    }
    r('#d9cfb8', 13, 21, 24, 3);
  }),

  hut: () => bcv(40, 34, (r) => {
    const O = '#3d2a1e';
    r(O, 5, 16, 30, 17); r('#d8c39a', 6, 17, 28, 15); r(O, 16, 21, 8, 12); r('#3a2a20', 17, 22, 6, 11);
    for (let y = 2; y < 18; y++) { const half = Math.round((y - 2) * 1.3) + 2; r(O, 20 - half - 1, y, half * 2 + 2, 1); r(y % 3 ? '#c9a55a' : '#a8843e', 20 - half, y, half * 2, 1); }
  }),

  mempi: () => bcv(30, 22, (r) => {
    r('#3d2a1e', 4, 6, 2, 16); r('#3d2a1e', 0, 0, 30, 7); r('#f4e9d0', 1, 1, 26, 5); r('#f4e9d0', 27, 2, 2, 3);
  }),

  statue: () => bcv(12, 24, (r) => {
    r('#3a3530', 1, 16, 10, 8); r('#cfc4b2', 2, 17, 8, 6);
    r('#3a3530', 3, 3, 6, 14); r('#7d8a6a', 4, 4, 4, 12); r('#9aa886', 4, 4, 1, 12); r('#3a3530', 4, 0, 4, 4); r('#7d8a6a', 5, 1, 2, 2);
  }),

  flood: () => bcv(16, 78, (r) => {
    const O = '#2a2a2e';
    for (let y = 12; y < 78; y++) { r(O, 6, y, 4, 1); if (y % 4 === 0) r('#8a8f96', 7, y, 2, 1); }
    r(O, 0, 0, 16, 12); r('#4a4f58', 1, 1, 14, 10);
    for (let y = 2; y < 10; y += 3) for (let x = 2; x < 14; x += 3) r('#f4f1ea', x, y, 2, 2);
  }),

  lamp: () => bcv(8, 26, (r) => {
    r('#2a2a2e', 3, 4, 2, 22); r('#2a2a2e', 1, 2, 6, 3); r('#fff3c8', 2, 3, 4, 1);
  }),

  bench: () => bcv(16, 9, (r) => {
    r('#3d2a1e', 0, 0, 16, 7); r('#9a6a45', 1, 1, 14, 2); r('#b5824a', 1, 4, 14, 2); r('#3d2a1e', 1, 7, 2, 2); r('#3d2a1e', 13, 7, 2, 2);
  }),

  stairs: (col) => bcv(14, 18, (r) => {
    r('#3a3530', 2, 0, 10, 18); for (let y = 1; y < 18; y += 3) { r('#c9c2b6', 3, y, 8, 2); r('#a39b8a', 3, y + 2, 8, 1); }
    r('#3a3530', 0, 0, 4, 6); r(col, 1, 1, 2, 4);
  }),
};

function bHouseJ(seed) {
  const rnd = seeded(seed * 97 + 11);
  const pk = a => a[Math.floor(rnd() * a.length)];
  const wall = pk(['#f3e3c3', '#f2c9a8', '#cfe3d0', '#d8cfe8', '#f5e08a', '#bfd8e8', '#f0b9a0']);
  const door = pk(['#7a4a2a', '#5a3a6a', '#2f5a7a', '#8a2f2a']);
  return bcv(48, 48, (r) => {
    const O = '#3a302b', sh = shade(wall, -0.14), dk = shade(wall, -0.26);
    r(O, 3, 11, 42, 32); r(wall, 4, 12, 40, 30); r(sh, 37, 12, 7, 30);
    r(O, 2, 8, 44, 4); r('#ffffff', 3, 9, 42, 2);
    const tx = rnd() < 0.5 ? 30 : 8;
    r(O, tx, 0, 11, 9); r('#2a2a2e', tx + 1, 1, 9, 8); r('#4a4a52', tx + 2, 1, 2, 8); r('#1a1a1e', tx + 1, 0, 9, 1);
    r(dk, 4, 26, 40, 2);
    r(O, 6, 20, 20, 1); for (let x = 6; x < 26; x += 2) r(O, x, 21, 1, 5);
    r(O, 9, 13, 12, 7); r('#7fa6c4', 10, 14, 10, 5);
    r(O, 29, 14, 10, 8); r('#7fa6c4', 30, 15, 8, 6); r(O, 32, 15, 1, 6); r(O, 35, 15, 1, 6);
    r(O, 9, 30, 9, 12); r(door, 10, 31, 7, 11); r(shade(door, 0.2), 10, 31, 1, 11);
    r(O, 25, 31, 13, 8); r('#6f93b0', 26, 32, 11, 6); for (let x = 27; x < 37; x += 2) r(O, x, 32, 1, 6);
    const cw = pk(['#e9e4dc', '#c9c2b6', wall]);
    r(O, 0, 41, 48, 6); r(cw, 1, 42, 46, 4); r('#2a2a2e', 8, 41, 11, 6); for (let x = 9; x < 19; x += 2) r('#8a8f96', x, 42, 1, 4);
    r('#b5573a', 40, 38, 4, 4); r('#3f7a35', 39, 35, 6, 3); r('#5a9a45', 40, 34, 3, 2);
  });
}

function bHouseM(seed) {
  const rnd = seeded(seed * 53 + 7);
  const pk = a => a[Math.floor(rnd() * a.length)];
  const wall = pk(['#efe6d2', '#e8cf8a', '#c9dce0', '#e9d2b8']);
  return bcv(46, 40, (r) => {
    const O = '#3d2a1e', TL = '#b5553a', TL2 = '#8a3a28';
    r(O, 3, 15, 40, 22); r(wall, 4, 16, 38, 20); r(shade(wall, -0.12), 36, 16, 6, 20);
    r(O, 0, 3, 46, 14); r(TL, 1, 4, 44, 12); r('#cf7352', 1, 4, 44, 1);
    for (let y = 6; y < 16; y += 3) { r(TL2, 1, y, 44, 1); for (let x = 1 + (y % 2) * 2; x < 45; x += 4) r(TL2, x, y - 2, 1, 2); }
    r('#9a4a32', 4, 31, 38, 5); r('#7a3a28', 4, 35, 38, 1);
    for (const x of [6, 38]) { r('#6b4a32', x, 16, 2, 15); }
    r(O, 19, 19, 8, 13); r('#7a4a2a', 20, 20, 6, 12); r('#9a6a45', 20, 20, 1, 12);
    for (const x of [10, 30]) { r(O, x, 20, 6, 6); r('#3a2a20', x + 1, 21, 4, 4); r(wall, x + 2, 21, 1, 4); }
    r('#bdb5a5', 18, 36, 10, 3);
  });
}

// Trees are stamped from a few pre-drawn variants per kind.
const B_TREES = {
  rain: { w: 50, h: 46, pal: ['#1f3a1f', '#2f5a2a', '#46793a', '#6a9e4c'], cw: 50, ch: 30, trunk: 16 },
  pink: { w: 38, h: 40, pal: ['#6b2c48', '#c45386', '#e98bb5', '#fbd0e2'], cw: 38, ch: 26, trunk: 14 },
  gulmohar: { w: 42, h: 38, pal: ['#5a1f14', '#b5381d', '#e2552c', '#f7924f'], cw: 42, ch: 24, trunk: 14 },
  coconut: { w: 34, h: 50 },
  royal: { w: 22, h: 52 },
  bamboo: { w: 26, h: 42 },
};

function bTree(kind, seed) {
  const T = B_TREES[kind];
  const rnd = seeded(seed);
  return bcv(T.w, T.h, (r, c) => {
    if (T.pal) {
      const tx = Math.round(T.w / 2);
      r('#3a2618', tx - 2, T.ch - 6, 5, T.h - T.ch + 6); r('#6b4a32', tx - 1, T.ch - 6, 3, T.h - T.ch + 5); r('#8a6a4a', tx - 1, T.ch - 6, 1, T.h - T.ch + 5);
      r('#6b4a32', tx - 6, T.ch - 4, 5, 1); r('#6b4a32', tx + 2, T.ch - 3, 5, 1);
      const lumps = [];
      for (let i = 0; i < 7; i++) lumps.push({ x: T.cw * (0.2 + rnd() * 0.6), y: T.ch * (0.3 + rnd() * 0.4), r: T.ch * (0.28 + rnd() * 0.16) });
      const can = blob(T.cw, T.ch, (x, y) => lumps.some(l => (x - l.x) ** 2 + ((y - l.y) * 1.2) ** 2 < l.r * l.r), T.pal, 0.16, rnd);
      c.drawImage(can, 0, 0);
      if (kind === 'pink') for (let i = 0; i < 6; i++) r('#6a9e4c', Math.floor(T.cw * (0.25 + rnd() * 0.5)), Math.floor(T.ch * (0.3 + rnd() * 0.5)));
    } else if (kind === 'coconut') {
      const lean = rnd() < 0.5 ? -1 : 1;
      let topX = 17;
      for (let y = 49; y >= 14; y--) {
        const x = Math.round(17 + Math.sin((49 - y) / 35 * 1.3) * 5 * lean);
        topX = x;
        r('#4a3420', x - 2, y, 4, 1); r(y % 3 ? '#9a7a52' : '#7a5a3a', x - 1, y, 2, 1);
      }
      for (let f = 0; f < 8; f++) {
        const a = -Math.PI + (f / 7) * Math.PI + (rnd() - 0.5) * 0.3;
        for (let i = 2; i < 16; i++) {
          const px = Math.round(topX + Math.cos(a) * i), py = Math.round(14 + Math.sin(a) * i * 0.55 + i * i / 26);
          r('#2f5a2a', px, py); r('#5a9a45', px, py + 1);
        }
      }
      r('#6b4a2a', topX - 2, 15, 2, 2); r('#6b4a2a', topX + 1, 16, 2, 2);
    } else if (kind === 'royal') {
      for (let y = 51; y >= 12; y--) { const w = y > 44 ? 4 : 3; r('#5f5a52', 11 - Math.ceil(w / 2), y, w + 1, 1); r('#cfc8b8', 11 - Math.ceil(w / 2) + 1, y, w - 1, 1); }
      r('#3f7a35', 9, 10, 4, 4);
      for (let f = 0; f < 7; f++) {
        const a = -Math.PI + (f / 6) * Math.PI;
        for (let i = 1; i < 11; i++) { const px = Math.round(11 + Math.cos(a) * i), py = Math.round(10 + Math.sin(a) * i * 0.6 + i * i / 18); r('#2f5a2a', px, py); r('#6a9e4c', px, py - 1); }
      }
    } else if (kind === 'bamboo') {
      for (let s = 0; s < 8; s++) {
        const x = 4 + Math.floor(rnd() * 18), top = 4 + Math.floor(rnd() * 12);
        for (let y = top; y < 42; y++) { r('#2f4a1a', x - 1, y, 4, 1); r(y % 6 === 0 ? '#3f5a22' : '#7aa83e', x, y, 2, 1); }
        for (let k = 0; k < 6; k++) { const ly = top + Math.floor(rnd() * 18); r('#3f7a35', x + 2, ly, 4, 2); r('#5a9a45', x - 4, ly + 2, 4, 2); }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Building the city: ground painting, props, collision grid and minimap.
// ---------------------------------------------------------------------------
const BL = { built: false };
const bkit = {
  kind: 'kitten', facing: 1, walkT: 0, blinkT: 2, atkT: 0, combo: 1, yarn: 0, catnip: 0, dashT: 0,
  plunge: false, sprint: false, airborne: false, sleeping: false, scaredT: 0, hurtT: 0,
};

const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad;
const inEll = (x, y, e, rx = e.rx, ry = e.ry) => ((x - e.x) / rx) ** 2 + ((y - e.y) / ry) ** 2 < 1;
const bRoadAt = (x, y, pad = 0) => B_ROADS.find(r => inRect(x, y, r, pad));
const bDistrictAt = (x, y) => B_DISTRICTS.find(d => inRect(x, y, d)) || B_DISTRICTS[0];

function buildCity() {
  const sprites = {};
  for (const [k, fn] of Object.entries(B_ART)) if (fn.length === 0) sprites[k] = fn();
  sprites.shopSilk = B_ART.shop('#f0d9a8', '#8f2a25', '#d8433b');
  sprites.shopBooks = B_ART.shop('#dfe6ea', '#2f4f8a', '#5b8ee0');
  sprites.shopPub = B_ART.shop('#c9a27a', '#3a2418', '#2f6b3a');
  sprites.stairsP = B_ART.stairs(B_LINES.purple.col);
  sprites.stairsG = B_ART.stairs(B_LINES.green.col);
  for (let i = 0; i < 6; i++) sprites[`jhouse${i}`] = bHouseJ(i);
  for (let i = 0; i < 4; i++) sprites[`mhouse${i}`] = bHouseM(i);
  const trees = {};
  for (const kind of Object.keys(B_TREES)) trees[kind] = [0, 1, 2].map(i => bTree(kind, i * 31 + kind.length * 7));
  BL.spr = sprites;
  BL.treeSpr = trees;

  // Static props sorted with everything else by their base y.
  BL.statics = [];
  for (const b of B_BUILDINGS) {
    const img = sprites[b.spr];
    BL.statics.push({ kind: 'bld', b, img, x: Math.round(b.x - img.width / 2), y: b.y - img.height + 1, base: b.y, w: img.width, h: img.height });
  }
  placeTrees();
  placeLamps();
  for (const [x, y] of [[900, 820], [1060, 700], [1180, 560], [880, 600], [1150, 1196], [960, 1196], [1300, 1390], [1660, 1352]]) addStatic(sprites.bench, x, y);
  for (const s of Object.values(B_STATIONS)) addStatic(s.lines.includes('green') && s.id !== 'cubbon' ? sprites.stairsG : sprites.stairsP, s.x + (s.lines[0] === 'green' ? 0 : 14), s.y - 4);

  buildGround();
  buildSolid();
  buildMini();
  BL.built = true;
}

function addStatic(img, x, base, extra = {}) {
  BL.statics.push({ kind: 'img', img, x: Math.round(x - img.width / 2), y: base - img.height + 1, base, w: img.width, h: img.height, ...extra });
}

function bBlocked(x, y, pad = 0) {
  if (x < 4 || y < 4 || x > BW - 4 || y > BH - 4) return true;
  if (bRoadAt(x, y, pad)) return true;
  for (const b of B_BUILDINGS) {
    const img = BL.spr[b.spr];
    const front = b.house || !b.mcol ? 10 : 34;     // keep landmark forecourts clear
    if (x > b.x - img.width / 2 - pad && x < b.x + img.width / 2 + pad && y > b.y - img.height * 0.55 - pad && y < b.y + front + pad) return true;
  }
  if (inEll(x, y, B_LAKE, B_LAKE.rx + 14 + pad, B_LAKE.ry + 12 + pad)) return true;
  if (inRect(x, y, B_RIVER, 8 + pad)) return true;
  if (inEll(x, y, B_STADIUM, B_STADIUM.rx + 10, B_STADIUM.ry + 10)) return true;
  if (inEll(x, y, B_TRACK, B_TRACK.rx + 8, B_TRACK.ry + 8)) return true;
  if (Math.hypot(x - B_CLOCK.x, y - B_CLOCK.y) < B_CLOCK.r + 10) return true;
  if (y > B_RAIL_Y - 30 && y < B_RAIL_Y + 14 && x < 690) return true;
  for (const p of B_PATHS) if (segDist(x, y, p) < p.w / 2 + 3 + pad) return true;
  return false;
}

// Laterite footpaths through the parks.
const B_PATHS = [
  { x0: 714, y0: 560, x1: 1426, y1: 560, w: 9 },
  { x0: 1100, y0: 482, x1: 1100, y1: 946, w: 9 },
  { x0: 740, y0: 930, x1: 1060, y1: 600, w: 8 },
  { x0: 714, y0: 1184, x1: 1426, y1: 1184, w: 9 },
  { x0: 1100, y0: 1184, x1: 1100, y1: 1600, w: 8 },
  { x0: 920, y0: 1184, x1: 862, y1: 1400, w: 8 },
  { x0: 714, y0: 1036, x1: 1300, y1: 1036, w: 8 },
  { x0: 1230, y0: 1184, x1: 1230, y1: 1262, w: 8 },
];
function segDist(x, y, p) {
  const dx = p.x1 - p.x0, dy = p.y1 - p.y0;
  const k = clamp(((x - p.x0) * dx + (y - p.y0) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - (p.x0 + dx * k), y - (p.y0 + dy * k));
}

function placeTrees() {
  const rnd = seeded(2011);
  BL.pinkTrees = [];
  const placed = [];
  const tryTree = (kind, x, y, spacing = 26, force = false) => {
    if (!force && bBlocked(x, y, 4)) return false;
    if (!force && (B_NPCS.some(n => Math.hypot(n.x - x, n.y - y) < 34) || B_POSTCARDS.some(pc => Math.hypot(pc.x - x, pc.y - y) < 30))) return false;
    if (Object.values(B_STATIONS).some(st => Math.hypot(st.x - x, st.y - y) < 26)) return false;
    if (placed.some(p => Math.abs(p.x - x) < spacing && Math.abs(p.y - y) < spacing * 0.7)) return false;
    const img = BL.treeSpr[kind][Math.floor(rnd() * 3)];
    placed.push({ x, y });
    addStatic(img, x, y, { tree: kind, trunk: true });
    if (kind === 'pink') BL.pinkTrees.push({ x, y, h: img.height });
    return true;
  };
  const mix = {
    'Race Course': [['rain', 5], ['coconut', 2], ['gulmohar', 2]],
    'Vidhana Veedhi': [['rain', 5], ['gulmohar', 2], ['pink', 2], ['royal', 1]],
    'MG Road': [['rain', 5], ['gulmohar', 1]],
    Malgudi: [['coconut', 5], ['rain', 3], ['gulmohar', 2]],
    'Cubbon Park': [['rain', 5], ['pink', 3], ['bamboo', 1], ['gulmohar', 2]],
    'UB City': [['coconut', 2], ['pink', 2], ['royal', 2]],
    Lalbagh: [['rain', 4], ['pink', 3], ['royal', 2], ['gulmohar', 2]],
    Jayanagar: [['pink', 3], ['coconut', 1], ['rain', 1]],
  };
  const counts = { 'Race Course': 34, 'Vidhana Veedhi': 30, 'MG Road': 26, Malgudi: 90, 'Cubbon Park': 110, 'UB City': 18, Lalbagh: 110, Jayanagar: 16 };
  // Pink tabebuia avenues first: Jayanagar streets and the Cubbon Park path.
  for (const y of [1232, 1262, 1416, 1446]) for (let x = 1478; x < 1990; x += 40) if (Math.abs(x - 1700) > 16) tryTree('pink', x + (y === 1262 || y === 1446 ? 20 : 0), y, 22, true);
  for (let x = 730; x < 1420; x += 30) { tryTree('pink', x, 552, 20); tryTree('pink', x + 15, 574, 20); }
  for (let y = 380; y < 1590; y += 34) tryTree('coconut', 104, y, 20);
  for (let y = 10; y < BH; y += 22) tryTree(rnd() < 0.5 ? 'rain' : 'coconut', 30 + rnd() * 24, y, 18, true);
  for (let x = 750; x < 1260; x += 56) if (Math.abs(x - 1000) > 70) tryTree('royal', x, 1214, 30);
  for (const d of B_DISTRICTS) {
    const kinds = mix[d.name];
    const total = kinds.reduce((s, k) => s + k[1], 0);
    for (let n = 0, tries = 0; n < counts[d.name] && tries < 2000; tries++) {
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
  for (let x = 40; x < BW; x += 96) { lamp(x, 343); lamp(x + 48, 381); }
  for (let x = 730; x < BW; x += 96) { lamp(x, 943); lamp(x + 48, 981); }
  for (let y = 40; y < BH; y += 96) { if (Math.abs(y - 360) > 20 && Math.abs(y - 960) > 20) { lamp(682, y); lamp(718, y + 48); lamp(1421, y); lamp(1459, y + 48); } }
  for (let x = 130; x < 680; x += 110) lamp(x, 649);
}

function buildGround() {
  const cv = document.createElement('canvas');
  cv.width = BW;
  cv.height = BH;
  const c = cv.getContext('2d');
  const r = (col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const rnd = seeded(1986);
  const ell = (col, e, rx, ry) => { c.fillStyle = col; pixEllipse(c, e.x, e.y, Math.round(rx), Math.round(ry)); };
  const ring = (col, e, rx, ry, step = 0.002) => { for (let a = 0; a < Math.PI * 2; a += step) r(col, Math.round(e.x + Math.cos(a) * rx), Math.round(e.y + Math.sin(a) * ry)); };

  r('#5d8a3e', 0, 0, BW, BH);
  for (const d of B_DISTRICTS) r(d.ground, d.x, d.y, d.w, d.h);
  r('#5a873b', 0, 0, 66, BH);
  // Malgudi: earth with patches of grass.
  for (let i = 0; i < 260; i++) { c.fillStyle = rnd() < 0.7 ? '#a9a865' : '#93a35a'; pixEllipse(c, 96 + rnd() * 590, 380 + rnd() * 1000, 6 + Math.round(rnd() * 16), 3 + Math.round(rnd() * 8)); }
  // Paddy fields south of the Sarayu.
  r('#8fbf4a', 0, 1450, 686, 150);
  for (let y = 1452; y < BH; y += 3) r('#7aa83e', 0, y, 686, 1);
  for (let x = 0; x < 686; x += 56) r('#a68a5a', x, 1450, 3, 150);
  r('#a68a5a', 0, 1520, 686, 3);
  // Vidhana Soudha lawns and forecourt.
  for (let y = 0; y < 300; y += 16) r('#86b45b', 714, y, 712, 8);
  r('#d9d2c2', 940, 300, 300, 42); for (let x = 940; x < 1240; x += 8) r('#c9c0ae', x, 300, 1, 42); for (let y = 300; y < 342; y += 8) r('#c9c0ae', 940, y, 300, 1);
  for (const x of [960, 1180]) { r('#5a3a26', x, 306, 40, 26); for (let i = 0; i < 70; i++) r(['#d8433b', '#f2c94c', '#ffffff', '#f4a3b8'][i % 4], x + 1 + Math.floor(rnd() * 38), 307 + Math.floor(rnd() * 24)); }
  // UB City plaza tiles.
  for (let x = 1454; x < BW; x += 10) r('#bfb39c', x, 374, 1, 572);
  for (let y = 374; y < 946; y += 10) r('#bfb39c', 1454, y, 546, 1);
  // Jayanagar: grass verges and yards.
  for (let i = 0; i < 70; i++) { c.fillStyle = '#9db86a'; pixEllipse(c, 1460 + rnd() * 530, 980 + rnd() * 610, 6 + Math.round(rnd() * 10), 3 + Math.round(rnd() * 4)); }

  // Race course: dirt oval, striped infield, white rails.
  ell('#b98a5a', B_TRACK, B_TRACK.rx, B_TRACK.ry);
  for (let i = 0; i < 900; i++) { const a = rnd() * Math.PI * 2, k = 0.92 + rnd() * 0.08; r('#a87a4c', Math.round(B_TRACK.x + Math.cos(a) * B_TRACK.rx * k), Math.round(B_TRACK.y + Math.sin(a) * B_TRACK.ry * k)); }
  const irx = B_TRACK.rx - B_TRACK.w, iry = B_TRACK.ry - B_TRACK.w;
  for (let dy = -iry; dy <= iry; dy++) {
    const half = Math.round(irx * Math.sqrt(1 - (dy / iry) ** 2));
    r(Math.floor((dy + iry) / 8) % 2 ? '#7fb44f' : '#8cc05a', B_TRACK.x - half, B_TRACK.y + dy, half * 2 + 1, 1);
  }
  ring('#f4f1ea', B_TRACK, B_TRACK.rx, B_TRACK.ry);
  ring('#f4f1ea', B_TRACK, irx, iry);
  r('#f4f1ea', B_TRACK.x + 60, B_TRACK.y + iry, 2, B_TRACK.w);

  // Chinnaswamy: tiers in red and gold, green field, the pitch.
  const S = B_STADIUM;
  const tiers = ['#5d6369', '#c0392b', '#a3a9ae', '#c9a227', '#8a8f96', '#c0392b', '#a3a9ae', '#2b2220'];
  for (let i = 0; i < tiers.length; i++) {
    const k = i / tiers.length;
    ell(tiers[i], S, S.rx - (S.rx - S.irx) * k, S.ry - (S.ry - S.iry) * k);
  }
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * Math.PI * 2, k = 0.08 + rnd() * 0.85;
    const rx = S.irx + (S.rx - S.irx) * k, ry = S.iry + (S.ry - S.iry) * k;
    r(['#f1ead8', '#d8433b', '#f2c94c', '#2b2220', '#5b8ee0'][Math.floor(rnd() * 5)], Math.round(S.x + Math.cos(a) * rx), Math.round(S.y + Math.sin(a) * ry));
  }
  for (let dy = -S.iry; dy <= S.iry; dy++) {
    const half = Math.round(S.irx * Math.sqrt(1 - (dy / S.iry) ** 2));
    r(Math.floor((dy + S.iry) / 7) % 2 ? '#5fa040' : '#6aae49', S.x - half, S.y + dy, half * 2 + 1, 1);
  }
  ring('#f4f1ea', S, S.irx - 8, S.iry - 6);
  r('#d6c08a', S.x - 4, S.y - 14, 9, 28); r('#ffffff', S.x - 4, S.y - 11, 9, 1); r('#ffffff', S.x - 4, S.y + 10, 9, 1);
  r('#8a8f96', S.x - 12, S.y + S.iry - 2, 24, S.ry - S.iry + 6);

  // Lalbagh lake with a sandy shore, the flower clock and rose beds.
  ell('#c9b48a', B_LAKE, B_LAKE.rx + 5, B_LAKE.ry + 4);
  ell('#3f7fa6', B_LAKE, B_LAKE.rx, B_LAKE.ry);
  ell('#4f93bb', B_LAKE, B_LAKE.rx - 6, B_LAKE.ry - 4);
  for (let i = 0; i < 60; i++) r('#8cc4e0', Math.round(B_LAKE.x + (rnd() - 0.5) * B_LAKE.rx * 1.4), Math.round(B_LAKE.y + (rnd() - 0.5) * B_LAKE.ry * 1.2), 3, 1);
  c.fillStyle = '#3f6f2e'; pixDisc(c, B_CLOCK.x, B_CLOCK.y, B_CLOCK.r + 3);
  c.fillStyle = '#d8433b'; pixDisc(c, B_CLOCK.x, B_CLOCK.y, B_CLOCK.r);
  c.fillStyle = '#f2c94c'; pixDisc(c, B_CLOCK.x, B_CLOCK.y, B_CLOCK.r - 3);
  c.fillStyle = '#7cab52'; pixDisc(c, B_CLOCK.x, B_CLOCK.y, B_CLOCK.r - 6);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; r('#ffffff', Math.round(B_CLOCK.x + Math.sin(a) * (B_CLOCK.r - 9)) - 1, Math.round(B_CLOCK.y - Math.cos(a) * (B_CLOCK.r - 9)) - 1, 2, 2); }
  for (const [x, y] of [[1060, 1200], [1130, 1200], [1060, 1226], [1130, 1226], [780, 1210], [840, 1240], [1300, 1120], [1180, 1080]]) {
    r('#5a3a26', x, y, 50, 18);
    for (let i = 0; i < 60; i++) r(['#d8433b', '#f4a3b8', '#ffffff', '#f2c94c', '#c3a0ec'][Math.floor(rnd() * 5)], x + 1 + Math.floor(rnd() * 48), y + 1 + Math.floor(rnd() * 16));
  }
  // Paths.
  for (const p of B_PATHS) {
    const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
    for (let i = 0; i <= len; i++) {
      const x = p.x0 + (p.x1 - p.x0) * i / len, y = p.y0 + (p.y1 - p.y0) * i / len;
      r('#b07650', Math.round(x - p.w / 2) - 1, Math.round(y - p.w / 2) - 1, p.w + 2, p.w + 2);
    }
    for (let i = 0; i <= len; i++) {
      const x = p.x0 + (p.x1 - p.x0) * i / len, y = p.y0 + (p.y1 - p.y0) * i / len;
      r('#c78a5a', Math.round(x - p.w / 2), Math.round(y - p.w / 2), p.w, p.w);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.004) {
    const x = Math.round(B_LAKE.x + Math.cos(a) * (B_LAKE.rx + 14)), y = Math.round(B_LAKE.y + Math.sin(a) * (B_LAKE.ry + 12));
    r('#c78a5a', x - 4, y - 4, 8, 8);
  }

  // The Sarayu, its ghats and the Kabir Street bridge.
  r('#c9b48a', B_RIVER.x, B_RIVER.y - 6, B_RIVER.w, B_RIVER.h + 12);
  r('#4a8db5', B_RIVER.x, B_RIVER.y, B_RIVER.w, B_RIVER.h);
  r('#5a9cc2', B_RIVER.x, B_RIVER.y + 8, B_RIVER.w, B_RIVER.h - 16);
  for (let i = 0; i < 140; i++) r('#9ccbe2', Math.floor(rnd() * B_RIVER.w), B_RIVER.y + 4 + Math.floor(rnd() * (B_RIVER.h - 8)), 4 + Math.floor(rnd() * 6), 1);
  for (let k = 0; k < 8; k++) r(k % 2 ? '#a39b8a' : '#c9c2b6', 236 + k, B_RIVER.y - 18 + k * 3, 128 - k * 2, 3);
  // Railway and the platform.
  r('#bdb5a5', 200, 1040, 270, 14); r('#e8d36a', 200, 1052, 270, 1);
  for (let x = 0; x < 690; x += 5) r('#6b4a32', x, B_RAIL_Y - 6, 3, 13);
  r('#8a8f96', 0, B_RAIL_Y - 4, 690, 1); r('#8a8f96', 0, B_RAIL_Y + 3, 690, 1);
  r('#c9ced2', 0, B_RAIL_Y - 5, 690, 1); r('#c9ced2', 0, B_RAIL_Y + 2, 690, 1);

  // Roads: footpaths, then the carriageways, then the paint.
  const asph = B_ROADS.filter(rd => !rd.dirt);
  for (const rd of B_ROADS.filter(rd => rd.dirt)) {
    r('#b39066', rd.x, rd.y, rd.w, rd.h);
    for (let i = 0; i < rd.w * rd.h / 30; i++) r('#9e7c52', rd.x + Math.floor(rnd() * rd.w), rd.y + Math.floor(rnd() * rd.h), 2, 1);
    if (rd.w > rd.h) { r('#a3825a', rd.x, rd.y + 6, rd.w, 1); r('#a3825a', rd.x, rd.y + rd.h - 7, rd.w, 1); }
    else { r('#a3825a', rd.x + 7, rd.y, 1, rd.h); r('#a3825a', rd.x + rd.w - 8, rd.y, 1, rd.h); }
  }
  for (const rd of asph) {
    const p = rd.small ? 4 : 6;
    r('#b9ae99', rd.x - p, rd.y - p, rd.w + p * 2, rd.h + p * 2);
    for (let x = rd.x - p; x < rd.x + rd.w + p; x += 6) r('#a99d88', x, rd.y - p, 1, rd.h + p * 2);
    for (let y = rd.y - p; y < rd.y + rd.h + p; y += 6) r('#a99d88', rd.x - p, y, rd.w + p * 2, 1);
  }
  c.fillStyle = '#56595f'; pixDisc(c, B_CIRCLE.x, B_CIRCLE.y, B_CIRCLE.r + 4);
  for (const rd of asph) { r('#d8d2c4', rd.x - 1, rd.y - 1, rd.w + 2, rd.h + 2); }
  for (const rd of asph) r(rd.small ? '#62656b' : '#56595f', rd.x, rd.y, rd.w, rd.h);
  c.fillStyle = '#56595f'; pixDisc(c, B_CIRCLE.x, B_CIRCLE.y, B_CIRCLE.r);
  c.fillStyle = '#d8d2c4'; pixDisc(c, B_CIRCLE.x, B_CIRCLE.y, B_CIRCLE.garden + 2);
  c.fillStyle = '#6fa04a'; pixDisc(c, B_CIRCLE.x, B_CIRCLE.y, B_CIRCLE.garden);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; r(i % 2 ? '#f2c94c' : '#d8433b', Math.round(B_CIRCLE.x + Math.cos(a) * 14), Math.round(B_CIRCLE.y + Math.sin(a) * 14)); }
  const onOther = (x, y, self) => asph.some(o => o !== self && inRect(x, y, o, 2)) || Math.hypot(x - B_CIRCLE.x, y - B_CIRCLE.y) < B_CIRCLE.r + 2;
  for (const rd of asph) {
    if (rd.small) continue;
    if (rd.w > rd.h) {
      const y = rd.y + rd.h / 2;
      for (let x = rd.x; x < rd.x + rd.w; x += 14) if (!onOther(x, y, rd) && !onOther(x + 8, y, rd)) r('#ece6d4', x, y, 8, 1);
    } else {
      const x = rd.x + rd.w / 2;
      for (let y = rd.y; y < rd.y + rd.h; y += 14) if (!onOther(x, y, rd) && !onOther(x, y + 8, rd)) r('#ece6d4', x, y, 1, 8);
    }
  }
  // Zebra crossings where roads meet.
  for (const h of asph.filter(rd => rd.w > rd.h)) for (const v of asph.filter(rd => rd.h > rd.w)) {
    if (v.x + v.w < h.x || v.x > h.x + h.w || h.y + h.h < v.y || h.y > v.y + v.h) continue;
    for (const x0 of [v.x - 12, v.x + v.w + 4]) if (inRect(x0, h.y + 2, h)) for (let y = h.y + 2; y < h.y + h.h - 2; y += 4) r('#ece6d4', x0, y, 8, 2);
    for (const y0 of [h.y - 12, h.y + h.h + 4]) if (inRect(v.x + 2, y0, v)) for (let x = v.x + 2; x < v.x + v.w - 2; x += 4) r('#ece6d4', x, y0, 2, 8);
  }
  // Bridge parapets over the Sarayu.
  r('#9a9182', 62, B_RIVER.y - 6, 4, B_RIVER.h + 12); r('#9a9182', 94, B_RIVER.y - 6, 4, B_RIVER.h + 12);
  r('#c9c2b6', 63, B_RIVER.y - 6, 2, B_RIVER.h + 12); r('#c9c2b6', 95, B_RIVER.y - 6, 2, B_RIVER.h + 12);
  // Shadows under the viaducts.
  c.globalAlpha = 0.16;
  r('#000000', B_LINES.purple.from, 356, B_LINES.purple.to - B_LINES.purple.from, 8);
  r('#000000', 1446, B_LINES.green.from, 8, B_LINES.green.to - B_LINES.green.from);
  c.globalAlpha = 1;
  // Fallen petals under the pink trees, kolams in front of houses.
  for (const t of BL.pinkTrees) for (let i = 0; i < 26; i++) r(rnd() < 0.5 ? '#f3a6c8' : '#e98bb5', Math.round(t.x + (rnd() - 0.5) * 34), Math.round(t.y + (rnd() - 0.3) * 14));
  for (const b of B_BUILDINGS) {
    if (!b.house) continue;
    const kx = b.x - 14, ky = b.y + 4;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) r('#ffffff', kx + i * 2, ky + j * 2);
    r(b.house === 'j' ? '#d8433b' : '#f2c94c', kx + 4, ky + 2);
  }

  // Texture: a sprinkle of lighter and darker pixels everywhere.
  const img = c.getImageData(0, 0, BW, BH), d = img.data;
  for (let p = 0, i = 0; p < BW * BH; p++, i += 4) {
    let s = Math.imul(p ^ 0x9e3779b9, 0x85ebca6b);
    s ^= s >>> 13;
    s = Math.imul(s, 0xc2b2ae35);
    const f = ((s >>> 8) & 1023) / 1024;
    const dv = f < 0.09 ? -12 : f > 0.95 ? 9 : 0;
    if (dv) { d[i] = clamp(d[i] + dv, 0, 255); d[i + 1] = clamp(d[i + 1] + dv, 0, 255); d[i + 2] = clamp(d[i + 2] + dv, 0, 255); }
  }
  c.putImageData(img, 0, 0);
  BL.ground = cv;
}

function buildSolid() {
  const g = new Uint8Array(BGW * BGH);
  const mark = (x0, y0, x1, y1) => {
    for (let cy = Math.max(0, Math.floor(y0 / BCELL)); cy <= Math.min(BGH - 1, Math.floor((y1 - 1) / BCELL)); cy++) {
      for (let cx = Math.max(0, Math.floor(x0 / BCELL)); cx <= Math.min(BGW - 1, Math.floor((x1 - 1) / BCELL)); cx++) g[cy * BGW + cx] = 1;
    }
  };
  for (const b of B_BUILDINGS) mark(b.x - b.fw / 2, b.y - b.fd, b.x + b.fw / 2, b.y);
  for (const s of BL.statics) if (s.trunk) mark(s.x + s.w / 2 - 2, s.base - 2, s.x + s.w / 2 + 2, s.base + 1);
  for (let cy = 0; cy < BGH; cy++) {
    for (let cx = 0; cx < BGW; cx++) {
      const x = cx * BCELL + 2, y = cy * BCELL + 2;
      const S = B_STADIUM;
      const inStands = inEll(x, y, S) && !inEll(x, y, S, S.irx, S.iry) && !(Math.abs(x - S.x) < 12 && y > S.y);
      const inLake = inEll(x, y, B_LAKE, B_LAKE.rx - 2, B_LAKE.ry - 2);
      const inRiver = inRect(x, y, B_RIVER) && !(x > 62 && x < 98);
      const inGarden = Math.hypot(x - B_CIRCLE.x, y - B_CIRCLE.y) < B_CIRCLE.garden;
      if (inStands || inLake || inRiver || inGarden) g[cy * BGW + cx] = 1;
    }
  }
  BL.solid = g;
}

function bSolid(x, y) {
  if (x < 2 || y < 2 || x >= BW - 2 || y >= BH - 2) return true;
  return BL.solid[Math.floor(y / BCELL) * BGW + Math.floor(x / BCELL)] === 1;
}

function buildMini() {
  const mw = BW / 8, mh = BH / 8;
  const cv = document.createElement('canvas');
  cv.width = mw;
  cv.height = mh;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(BL.ground, 0, 0, mw, mh);
  for (const s of BL.statics) {
    if (!s.tree) continue;
    c.fillStyle = s.tree === 'pink' ? '#e98bb5' : s.tree === 'gulmohar' ? '#d2552c' : '#3f6a33';
    c.fillRect(Math.round((s.x + s.w / 2) / 8) - 1, Math.round((s.base - 6) / 8) - 1, 2, 2);
  }
  for (const b of B_BUILDINGS) {
    if (!b.mcol) continue;
    const img = BL.spr[b.spr];
    c.fillStyle = '#2b2220';
    c.fillRect(Math.round((b.x - b.fw / 2) / 8) - 1, Math.round((b.y - b.fd - img.height * 0.3) / 8) - 1, Math.ceil(b.fw / 8) + 2, Math.ceil((b.fd + img.height * 0.3) / 8) + 2);
    c.fillStyle = b.mcol;
    c.fillRect(Math.round((b.x - b.fw / 2) / 8), Math.round((b.y - b.fd - img.height * 0.3) / 8), Math.ceil(b.fw / 8), Math.ceil((b.fd + img.height * 0.3) / 8));
  }
  BL.mini = cv;
}

// ---------------------------------------------------------------------------
// Life in the city: traffic, metro trains, the Malgudi train, people, animals.
// ---------------------------------------------------------------------------
// India drives on the left.
const B_LANES = [
  { axis: 'h', at: 356, dir: 1, from: -60, to: BW + 60 }, { axis: 'h', at: 367, dir: -1, from: -60, to: BW + 60 },
  { axis: 'h', at: 956, dir: 1, from: 700, to: BW + 60 }, { axis: 'h', at: 967, dir: -1, from: 700, to: BW + 60 },
  { axis: 'v', at: 707, dir: 1, from: -60, to: BH + 60 }, { axis: 'v', at: 693, dir: -1, from: -60, to: BH + 60 },
  { axis: 'v', at: 1448, dir: 1, from: -60, to: BH + 60 }, { axis: 'v', at: 1432, dir: -1, from: -60, to: BH + 60 },
];
const B_VEH = {
  auto: { len: 18, wid: 9, vmax: 58 },
  bus: { len: 44, wid: 12, vmax: 42 },
  car: { len: 26, wid: 10, vmax: 52 },
  scooter: { len: 12, wid: 5, vmax: 62 },
};
const B_HONKS = ['HONK!', 'POM POM!', 'Side, side!', 'Beep beep!'];

const B_NPCS = [
  { name: 'Swami', x: 284, y: 852, kid: true, skin: '#9a6a45', hair: '#1d1816', top: '#f1ead8', bottom: '#3a4a7a', cap: '#2b2220',
    lines: ['Knights? In Malgudi? Rajam must see this!', "Don't tell Father I skipped arithmetic.", 'The Sarayu is best after school.'] },
  { name: 'Rajam', x: 322, y: 856, kid: true, skin: '#c48a5c', hair: '#2b2220', top: '#9fd6ef', bottom: '#2b2a33',
    lines: ["My father is the Police Superintendent. He'd arrest that sword.", 'Swami says you are a lion. You look like a kitten.'] },
  { name: 'Mani', x: 262, y: 860, kid: true, skin: '#7a5236', hair: '#1d1816', top: '#d8433b', bottom: '#5a4a3a',
    lines: ['I can throw a stone right across the Sarayu.', 'Want a ride on my cycle tyre?'] },
  { name: 'Station Master', x: 300, y: 1050, skin: '#9a6a45', hair: '#2b2220', top: '#f4f1ea', bottom: '#f4f1ea', cap: '#1d1816',
    lines: ['The train is on time. Mostly.', 'Next train goes through the Mempi tunnel.', 'Platform one, kitten. Mind the gap.'] },
  { name: 'Granny', x: 300, y: 1364, skin: '#8a5a3a', hair: '#d9d2c4', top: '#2f8a3a', bottom: '#2f8a3a', saree: true,
    lines: ['Washing clothes at the ghat since 1950.', "Don't fall in, little one. The fish will laugh."] },
  { name: 'Cubbon walker', x: 1000, y: 562, area: { x: 760, y: 548, w: 640, h: 26 }, skin: '#c48a5c', hair: '#d9d2c4', top: '#ffffff', bottom: '#2b2a33',
    lines: ['Third round done. Now, idli.', 'Bengaluru weather, no? Best in India.'] },
  { name: 'Jogger', x: 1100, y: 700, area: { x: 1090, y: 500, w: 20, h: 420 }, skin: '#9a6a45', hair: '#1d1816', top: '#ee8b3a', bottom: '#2b2a33',
    lines: ['Ten thousand steps! Then filter coffee.'] },
  { name: 'Techie', x: 1600, y: 820, area: { x: 1520, y: 800, w: 220, h: 90 }, skin: '#c48a5c', hair: '#2b2220', top: '#5b8ee0', bottom: '#4a4f58',
    lines: ['Sorry, on a call. Standup in five.', 'My commute is two hours. For six kilometres.', 'Hotfix on Friday evening. Classic.'] },
  { name: 'Auto anna', x: 1610, y: 934, skin: '#7a5236', hair: '#1d1816', top: '#d9c7a2', bottom: '#d9c7a2',
    lines: ['Meter? Meter is sleeping. Fifty extra.', 'Bartheera? Coming? Return is empty, saar.', 'Silk Board? Ayyo, no.'] },
  { name: 'Aunty', x: 1610, y: 1330, area: { x: 1470, y: 1324, w: 200, h: 14 }, skin: '#b5784a', hair: '#1d1816', top: '#c3a0ec', bottom: '#c3a0ec', saree: true,
    lines: ['Oota aytha? Have you eaten?', 'Come, come, there is fresh holige.'] },
  { name: 'Flower seller', x: 1880, y: 1150, skin: '#8a5a3a', hair: '#1d1816', top: '#f2c94c', bottom: '#f2c94c', saree: true,
    lines: ['Mallige, jasmine! One metre for the kitten?'] },
  { name: 'Gardener', x: 1050, y: 1250, area: { x: 1040, y: 1196, w: 160, h: 50 }, skin: '#7a5236', hair: '#1d1816', top: '#2f6b3a', bottom: '#d9c7a2',
    lines: ['The flower show is in January. Come back!', 'That clock? Made of flowers. Keeps time too.'] },
  { name: 'Turf fan', x: 300, y: 92, area: { x: 160, y: 84, w: 460, h: 10 }, skin: '#c48a5c', hair: '#5a4a3a', top: '#d8433b', bottom: '#2b2a33',
    lines: ['Number four! Come on, number four!', 'I bet my lunch on the grey one.'] },
  { name: 'Cricket fan', x: 1740, y: 300, skin: '#9a6a45', hair: '#1d1816', top: '#c0392b', bottom: '#2b2220',
    lines: ['Ee sala cup namde!', 'Kohli fan since birth. Before birth, actually.'] },
  { name: 'Guard', x: 1050, y: 334, skin: '#7a5236', hair: '#1d1816', top: '#c9b48a', bottom: '#c9b48a', cap: '#2f4f8a',
    lines: ["Photos are allowed. Climbing the dome is not.", 'Government work is God\'s work. Lunch is at one.'] },
  { name: 'Darshini anna', x: 1530, y: 930, skin: '#8a5a3a', hair: '#1d1816', top: '#ffffff', bottom: '#2f8a3a', shop: 'coffee',
    lines: ['One by two coffee? Free for knights.'] },
  { name: 'Baker', x: 1760, y: 1234, skin: '#c48a5c', hair: '#1d1816', top: '#ffffff', bottom: '#2f6db0', shop: 'cake',
    lines: ['Honey cake, fresh from the oven!'] },
];

function resetCityLife() {
  const rnd = seeded(42);
  BL.vehicles = [];
  const types = ['auto', 'auto', 'auto', 'car', 'car', 'bus', 'scooter'];
  const cols = { car: ['#f4f1ea', '#c9ced2', '#d8433b', '#2f4f8a', '#2b2a33'], bus: ['#2f5fb3', '#c0392b', '#3fa34d'], scooter: ['#d8433b', '#5b8ee0', '#f2c94c', '#f4f1ea'] };
  for (const lane of B_LANES) {
    const span = lane.to - lane.from;
    const n = Math.round(span / 300);
    for (let i = 0; i < n; i++) {
      const type = types[Math.floor(rnd() * types.length)];
      const def = B_VEH[type];
      BL.vehicles.push({ lane, type, p: lane.from + (i + rnd() * 0.5) * span / n, v: def.vmax, vmax: def.vmax * (0.85 + rnd() * 0.3), honkCd: 0, col: cols[type] ? cols[type][Math.floor(rnd() * cols[type].length)] : null, seed: rnd() * 10 });
    }
  }
  BL.trains = [];
  for (const id of Object.keys(B_LINES)) {
    const st = B_LINES[id].stations;
    BL.trains.push({ line: id, p: st[0].p, dir: 1, next: 1, state: 'dwell', t: 2, v: 0 });
    BL.trains.push({ line: id, p: st[st.length - 1].p, dir: -1, next: st.length - 2, state: 'dwell', t: 5, v: 0 });
  }
  BL.steam = { state: 'away', x: -320, t: 6, v: 0 };
  BL.horses = [0, 1, 2, 3, 4].map(i => ({ a: i * 0.35, v: 0.32 + i * 0.012, lane: i % 3, col: ['#6b4a32', '#3a2618', '#8a6a4a', '#d9d2c4', '#2b2220'][i], silk: ['#d8433b', '#f2c94c', '#5b8ee0', '#7cc35a', '#c3a0ec'][i] }));
  BL.ducks = Array.from({ length: 7 }, (_, i) => ({ x: B_LAKE.x + (rnd() - 0.5) * 140, y: B_LAKE.y + (rnd() - 0.5) * 50, vx: 0, vy: 0, t: rnd() * 5, white: i % 3 === 0 }));
  BL.coracle = { x: 200, dir: 1 };
  BL.cart = { x: 160, dir: 1 };
  BL.cows = [{ x: 80, y: 720, lying: true }, { x: 1700, y: 1350, lying: false }, { x: 470, y: 920, lying: false }, { x: 600, y: 1300, lying: true }];
  BL.dog = { x: 1600, y: 1430, tx: 1600, ty: 1430, t: 0, facing: 1 };
  BL.pigeons = [];
  for (const [x, y] of [[1090, 322], [380, 1046], [980, 778], [1855, 1150], [1440, 400]]) {
    for (let i = 0; i < 8; i++) BL.pigeons.push({ hx: x + (rnd() - 0.5) * 40, hy: y + (rnd() - 0.5) * 12, x: 0, y: 0, h: 0, state: 'peck', t: rnd() * 3, vx: 0, vy: 0 });
  }
  for (const p of BL.pigeons) { p.x = p.hx; p.y = p.hy; }
  BL.npcs = B_NPCS.map(n => ({ ...n, hx: n.x, hy: n.y, tx: n.x, ty: n.y, facing: 1, moving: false, wait: rnd() * 3, line: 0, bubble: null }));
  // Fish to find on footpaths and in the parks.
  BL.fishes = [];
  for (let tries = 0; BL.fishes.length < 60 && tries < 6000; tries++) {
    const x = 20 + rnd() * (BW - 40), y = 20 + rnd() * (BH - 40);
    const rd = bRoadAt(x, y);
    if (rd && !rd.dirt) continue;
    if (bSolid(x, y) || bSolid(x, y - 6)) continue;
    if (BL.fishes.some(f => Math.hypot(f.x - x, f.y - y) < 90)) continue;
    BL.fishes.push({ x, y, taken: false, seed: rnd() * 6 });
  }
}

function updateVehicles(dt) {
  const k = BL;
  for (const v of k.vehicles) {
    const L = v.lane, def = B_VEH[v.type];
    let gap = Infinity;
    for (const o of k.vehicles) {
      if (o === v || o.lane !== L) continue;
      const d = (o.p - v.p) * L.dir;
      if (d > 0) gap = Math.min(gap, d - (B_VEH[o.type].len + def.len) / 2);
    }
    // Slow down and honk at a kitten in the lane.
    const along = L.axis === 'h' ? k.x : k.y, across = L.axis === 'h' ? k.y : k.x;
    if (!k.ride && Math.abs(across - L.at) < def.wid / 2 + 5) {
      const d = (along - v.p) * L.dir - def.len / 2;
      if (d > -def.len && d < 46) {
        gap = Math.min(gap, Math.max(0, d - 4));
        if (v.honkCd <= 0 && d < 40) {
          v.honkCd = 2.5 + Math.random() * 2;
          bHorn(v.type);
          const pos = vehPos(v);
          bText(pos.x, pos.y - 18, pick(B_HONKS), '#ffe08a');
        }
      }
    }
    v.honkCd -= dt;
    const target = gap < 6 ? 0 : gap < 36 ? v.vmax * (gap - 6) / 30 : v.vmax;
    v.v = v.v < target ? Math.min(target, v.v + 40 * dt) : Math.max(target, v.v - 160 * dt);
    v.p += v.v * L.dir * dt;
    if (L.dir > 0 && v.p > L.to) v.p = L.from;
    if (L.dir < 0 && v.p < L.from) v.p = L.to;
  }
}

function vehPos(v) {
  const L = v.lane;
  if (L.axis === 'h') return { x: v.p, y: L.at + 4 };
  let x = L.at;
  // Swing round South End Circle.
  if (L.at > 1400 && Math.abs(v.p - B_CIRCLE.y) < 50) x += Math.sign(L.at - 1440) * 22 * Math.cos((v.p - B_CIRCLE.y) / 50 * Math.PI / 2);
  return { x, y: v.p + (L.dir > 0 ? B_VEH[v.type].len / 2 : B_VEH[v.type].len / 2) };
}

function updateTrains(dt) {
  for (const tr of BL.trains) {
    const L = B_LINES[tr.line];
    if (tr.state === 'dwell') {
      if ((tr.t -= dt) <= 0) tr.state = 'run';
      continue;
    }
    const target = L.stations[tr.next].p;
    const rem = (target - tr.p) * tr.dir;
    tr.v = Math.min(110, tr.v + 45 * dt, Math.sqrt(Math.max(0, 2 * 45 * rem)) + 3);
    tr.p += tr.v * tr.dir * dt;
    if ((target - tr.p) * tr.dir <= 0.5) {
      tr.p = target;
      tr.v = 0;
      tr.state = 'dwell';
      tr.t = 3.5;
      if (bOnScreen(trainXY(tr).x, trainXY(tr).y, 40)) bChime(0.5);
      if (tr.next === L.stations.length - 1) tr.dir = -1;
      else if (tr.next === 0) tr.dir = 1;
      tr.next += tr.dir;
    }
  }
}

function trainXY(tr) {
  const L = B_LINES[tr.line];
  return L.axis === 'h' ? { x: tr.p, y: L.at } : { x: L.at, y: tr.p };
}

function updateSteam(dt) {
  const s = BL.steam;
  const STOP = 420;
  s.t -= dt;
  if (s.state === 'away' && s.t <= 0) { s.state = 'arrive'; s.x = -330; s.v = 70; if (BL.district === 'Malgudi') bWhistle(); }
  else if (s.state === 'arrive') {
    const rem = STOP - s.x;
    s.v = Math.max(8, Math.min(70, Math.sqrt(Math.max(0, 2 * 22 * rem))));
    s.x += s.v * dt;
    if (rem <= 0.5) { s.x = STOP; s.state = 'dwell'; s.t = 7; s.v = 0; }
  } else if (s.state === 'dwell' && s.t <= 0) { s.state = 'leave'; if (BL.district === 'Malgudi') bWhistle(); }
  else if (s.state === 'leave') {
    s.v = Math.min(80, s.v + 18 * dt);
    s.x += s.v * dt;
    if (s.x > 1020) { s.state = 'away'; s.t = 16; }
  }
  if (s.state !== 'away' && s.state !== 'dwell' && Math.random() < dt * 9 && s.x > 0 && s.x < 650) {
    BL.fx.push({ kind: 'smoke', x: s.x - 8, y: B_RAIL_Y + 6, h: 34, vx: -10 - s.v * 0.3, vh: 14, life: 1.6, max: 1.6, r: 3 });
  }
}

function updateLife(dt) {
  const k = BL;
  updateVehicles(dt);
  updateTrains(dt);
  updateSteam(dt);
  for (const h of k.horses) h.a += h.v * dt * (0.9 + Math.sin(k.t * 0.7 + h.lane) * 0.15);
  for (const d of k.ducks) {
    if ((d.t -= dt) <= 0) { d.t = 2 + Math.random() * 4; d.vx = (Math.random() - 0.5) * 10; d.vy = (Math.random() - 0.5) * 5; }
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (inEll(nx, ny, B_LAKE, B_LAKE.rx - 12, B_LAKE.ry - 10)) { d.x = nx; d.y = ny; } else { d.vx *= -1; d.vy *= -1; }
  }
  k.coracle.x += k.coracle.dir * 6 * dt;
  if (k.coracle.x > 560 || k.coracle.x < 130) k.coracle.dir *= -1;
  k.cart.x += k.cart.dir * 9 * dt;
  if (k.cart.x > 640 || k.cart.x < 130) k.cart.dir *= -1;
  // The stray dog trots between spots.
  const dg = k.dog;
  if ((dg.t -= dt) <= 0) { dg.t = 3 + Math.random() * 4; dg.tx = 1480 + Math.random() * 500; dg.ty = pick([1430, 1246, 1340, 1520]); }
  const dd = Math.hypot(dg.tx - dg.x, dg.ty - dg.y);
  if (dd > 2) { const s = Math.min(dd, 26 * dt); dg.x += (dg.tx - dg.x) / dd * s; dg.y += (dg.ty - dg.y) / dd * s; dg.facing = dg.tx > dg.x ? 1 : -1; }
  for (const p of k.pigeons) {
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
  // Petals drift down from pink trees near the camera.
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
// Starting, the kitten, postcards and interactions.
// ---------------------------------------------------------------------------
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
  Object.assign(BL, {
    active: true, x: 1090, y: 334, z: 0, vz: 0, view: 'street', mapOpen: false, mapSel: null, ride: null, waypoint: null,
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

  if (k.ride) { rideTick(dt); return; }
  if (k.mapOpen) { mapTick(); return; }
  if (input.pressed.pause) { pauseGame(); return; }
  if (input.pressed.map) { openCityMap(); return; }
  if (input.pressed.view) {
    k.view = B_VIEWS[(B_VIEWS.indexOf(k.view) + 1) % B_VIEWS.length];
    bToast(B_VIEW_INFO[k.view].name, B_VIEW_INFO[k.view].sub);
    sfx.blip();
  }

  // Movement with sprint, dash and filter-coffee boost.
  k.boost = Math.max(0, k.boost - dt);
  const boost = k.boost > 0 ? 1.4 : 1;
  bkit.sprint = input.held.dash && (input.mx || input.my);
  let speed = (bkit.sprint ? 104 : 62) * boost;
  if (input.pressed.dash && (input.mx || input.my)) { k.dashT = 0.16; k.dashV = norm(input.mx, input.my); sfx.dash(); }
  let vx = input.mx * speed, vy = input.my * speed;
  if (k.dashT > 0) { k.dashT -= dt; vx = k.dashV.x * 230; vy = k.dashV.y * 230; }
  bkit.dashT = k.dashT;
  bkit.dashX = k.dashV.x; bkit.dashY = k.dashV.y;
  const moveTo = (nx, ny) => !bSolid(nx - 3, ny) && !bSolid(nx + 3, ny) && !bSolid(nx, ny - 2);
  if (vx && moveTo(k.x + vx * dt, k.y)) k.x += vx * dt;
  if (vy && moveTo(k.x, k.y + vy * dt)) k.y += vy * dt;
  k.x = clamp(k.x, 6, BW - 6);
  k.y = clamp(k.y, 6, BH - 6);
  if (input.mx) bkit.facing = input.mx > 0 ? 1 : -1;
  if (vx || vy) bkit.walkT += dt * (bkit.sprint ? 1.6 : 1); else bkit.walkT = 0;
  bkit.blinkT -= dt;
  if (bkit.blinkT < -0.15) bkit.blinkT = 2 + Math.random() * 3;
  bkit.atkT = Math.max(0, bkit.atkT - dt);
  // Hop.
  if (k.z > 0 || k.vz > 0) {
    k.vz -= 420 * dt;
    k.z = Math.max(0, k.z + k.vz * dt);
    if (k.z === 0) { k.vz = 0; sfx.land(); }
  }
  bkit.airborne = k.z > 0;

  // Vehicles shove the kitten aside.
  for (const v of k.vehicles) {
    const p = vehPos(v), def = B_VEH[v.type];
    const hw = v.lane.axis === 'h' ? def.len / 2 : def.wid / 2, hh = v.lane.axis === 'h' ? def.wid / 2 : def.len / 2;
    const cy = v.lane.axis === 'h' ? p.y - 4 : p.y - def.len / 2;
    if (Math.abs(k.x - p.x) < hw + 3 && Math.abs(k.y - cy) < hh + 3 && k.z < 6) {
      const push = v.lane.axis === 'h' ? { x: 0, y: Math.sign(k.y - cy) || 1 } : { x: Math.sign(k.x - p.x) || 1, y: 0 };
      const nx = k.x + push.x * 3, ny = k.y + push.y * 3;
      if (!bSolid(nx, ny)) { k.x = nx; k.y = ny; }
    }
  }

  // The Malgudi train shoves too.
  const st = k.steam;
  if (st.state !== 'away' && Math.abs(k.y - B_RAIL_Y) < 8 && k.x < st.x + 18 && k.x > st.x - 210 && k.x < 652) {
    k.y = k.y < B_RAIL_Y ? B_RAIL_Y - 9 : B_RAIL_Y + 9;
    if (!st.tootCd || k.t > st.tootCd) { st.tootCd = k.t + 3; bWhistle(); bText(k.x, k.y - 34, 'Koooo!', '#ffffff'); }
  }

  // Where are we?
  const rd = bRoadAt(k.x, k.y);
  const dist0 = bDistrictAt(k.x, k.y);
  k.district = dist0.name;
  k.place = rd ? rd.name : dist0.name;
  if (!k.ride) setMusic(k.clock > 19 * 60 || k.clock < 5 * 60 ? 'night' : dist0.mus);

  // Fish, postcards, waypoint.
  for (const f of k.fishes) {
    if (!f.taken && Math.hypot(f.x - k.x, f.y - k.y) < 10) { f.taken = true; addFish(1); sfx.pickup(); bText(f.x, f.y - 14, '+1 fish', '#9fd6ef'); }
  }
  for (const pc of B_POSTCARDS) if (!pc.ride && Math.hypot(pc.x - k.x, pc.y - k.y) < pc.r) bStamp(pc.id);
  if (k.waypoint && Math.hypot(k.waypoint.x - k.x, k.waypoint.y - k.y) < 34) { bToast('ARRIVED', k.waypoint.name); k.waypoint = null; sfx.chime(); }

  // Something to talk to or use?
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
  for (const n of k.npcs) consider(Math.hypot(n.x - k.x, n.y - k.y), { kind: 'npc', n, label: n.shop === 'coffee' ? 'Filter kaapi' : n.shop === 'cake' ? 'Honey cake' : `Talk to ${n.name}` });
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

function mapLayout() {
  const top = 15, bottom = 13;
  const s = Math.min((W - 12) / BW, (H - top - bottom) / BH);
  const mw = BW * s, mh = BH * s;
  return { s, mw, mh, mx: (W - mw) / 2, my: top + (H - top - bottom - mh) / 2 };
}

// Taps on the map pick a destination; a tap on the minimap opens the map.
window.addEventListener('pointerdown', e => {
  if (scene !== 'city' || paused || menuOpen() || !BL.active) return;
  const rc = uiCanvas.getBoundingClientRect();
  const gx = (e.clientX - rc.left) / rc.width * W, gy = (e.clientY - rc.top) / rc.height * H;
  if (BL.ride && BL.ride.phase === 'pick') {
    const hit = (BL.ride.hits || []).find(h => Math.abs(gx - h.x) < 18 && Math.abs(gy - h.y) < 5);
    if (hit) { BL.ride.sel = hit.sel; confirmRide(); }
    return;
  }
  if (BL.mapOpen) {
    const L = mapLayout();
    let best = null, bd = 9;
    for (const t of mapTargets()) {
      const d = Math.hypot(L.mx + t.x * L.s - gx, L.my + t.y * L.s - gy);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) setWaypoint(best);
    return;
  }
  const mm = miniRect();
  if (gx > mm.x && gx < mm.x + mm.w && gy > mm.y && gy < mm.y + mm.h) openCityMap();
});

// ---------------------------------------------------------------------------
// Namma Metro: pick a station, then ride with a view out of the window.
// ---------------------------------------------------------------------------
function openRidePicker(st) {
  const cols = ['purple', 'green'];
  const col = st.lines[0] === 'green' ? 1 : 0;
  const stations = B_LINES[cols[col]].stations;
  let row = stations.findIndex(s => s.id === st.id);
  row = row === stations.length - 1 ? row - 1 : row + 1;
  BL.ride = { phase: 'pick', from: st.id, sel: { col, row }, nav: { x: 0, y: 0 }, hits: [] };
  sfx.chime();
}

function rideTick(dt) {
  const R = BL.ride;
  if (R.phase === 'pick') {
    if (input.pressed.pause || input.pressed.map) { BL.ride = null; return; }
    const nx = Math.abs(input.mx) > 0.5 ? Math.sign(input.mx) : 0, ny = Math.abs(input.my) > 0.5 ? Math.sign(input.my) : 0;
    if ((nx || ny) && (nx !== R.nav.x || ny !== R.nav.y)) {
      if (nx) R.sel.col = clamp(R.sel.col + nx, 0, 1);
      if (ny) R.sel.row = clamp(R.sel.row + ny, 0, 3);
      sfx.blip();
    }
    R.nav = { x: nx, y: ny };
    if (input.pressed.jump || input.pressed.attack) confirmRide();
    return;
  }
  R.t += dt;
  const seg = R.segs[R.seg];
  const k = clamp(R.t / seg.dur, 0, 1);
  // Trapezoid speed profile: speed up for a quarter, cruise, slow down.
  const e = k < 0.25 ? (8 / 3) * k * k : k > 0.75 ? 1 - (8 / 3) * (1 - k) * (1 - k) : 1 / 6 + (4 / 3) * (k - 0.25);
  R.ease = clamp(e, 0, 1);
  R.s = seg.a + (seg.b - seg.a) * R.ease;
  R.speed = Math.abs(seg.b - seg.a) / seg.dur * (4 / 3) * (k < 0.25 ? k * 4 : k > 0.75 ? (1 - k) * 4 : 1);
  if (!R.said1 && R.t > 0.6) { R.said1 = true; R.caption = { kn: `Mundina nildana: ${seg.toName}`, en: `Next station: ${seg.toName}`, t: 3 }; bChime(0.8); }
  if (!R.said2 && k > 0.72) { R.said2 = true; R.caption = { kn: 'Baagilugalu edagade tereyuttave', en: 'Doors will open on the left', t: 2.6 }; }
  if (R.caption && (R.caption.t -= dt) <= 0) R.caption = null;
  if (k >= 1) {
    if (R.seg < R.segs.length - 1) {
      R.seg++; R.t = 0; R.said1 = false; R.said2 = false;
      R.caption = { kn: 'Itta nildana: Cubbon Park', en: `Change here for the ${B_LINES[R.segs[R.seg].line].name}`, t: 2.4 };
      bChime();
      return;
    }
    const dest = B_STATIONS[R.to];
    BL.x = dest.x; BL.y = dest.y + 4;
    BL.ride = null;
    bToast(dest.name.toUpperCase(), 'Mind the gap');
    bChime();
    if (!SAVE.city.stamps.includes('metro')) bStamp('metro');
  }
}

function confirmRide() {
  const R = BL.ride;
  const lineId = R.sel.col ? 'green' : 'purple';
  const to = B_LINES[lineId].stations[R.sel.row];
  if (to.id === R.from) { sfx.hurt(); return; }
  const from = B_STATIONS[R.from];
  const pos = (lid, id) => B_LINES[lid].stations.find(s => s.id === id).p;
  const segs = [];
  const mk = (lid, a, b, toName) => ({ line: lid, a, b, toName, dur: 2.6 + Math.abs(b - a) / 260 });
  if (from.lines.includes(lineId) || to.id === 'cubbon') {
    const lid = from.lines.includes(lineId) ? lineId : from.lines[0];
    segs.push(mk(lid, pos(lid, R.from), pos(lid, to.id), to.name));
  } else {
    const other = from.lines[0];
    segs.push(mk(other, pos(other, R.from), pos(other, 'cubbon'), 'Cubbon Park'));
    segs.push(mk(lineId, pos(lineId, 'cubbon'), to.p, to.name));
  }
  Object.assign(R, { phase: 'ride', to: to.id, segs, seg: 0, t: 0, s: segs[0].a, speed: 0, ease: 0, said1: false, said2: false, caption: null });
  setMusic('metro');
  sfx.chime();
}

// Landmarks seen out of the window, per line: [sprite, position along the line, distance].
function rideScenery(lineId) {
  const L = B_LINES[lineId];
  const out = [];
  for (const b of B_BUILDINGS) {
    if (b.spr.startsWith('jhouse') || b.spr.startsWith('mhouse') || ['board', 'mempi', 'statue', 'lamp'].includes(b.spr)) continue;
    const along = L.axis === 'h' ? b.x : b.y, d = Math.abs(L.axis === 'h' ? b.y - L.at : b.x - L.at);
    if (d < 520 && along > L.from - 300 && along < L.to + 300) out.push({ img: BL.spr[b.spr], along, d });
  }
  return out.sort((a, b) => b.d - a.d);
}

// ---------------------------------------------------------------------------
// Drawing: the world
// ---------------------------------------------------------------------------
function bOnScreen(x, y, pad = 0) {
  const c = BL.cam;
  return c && x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
}

// 0 = full day, 1 = deep night, plus a warm tint around dusk and dawn.
function bDaylight() {
  const h = BL.clock / 60;
  if (h >= 7 && h < 17.5) return { dark: 0, warm: 0 };
  if (h >= 17.5 && h < 19.5) { const k = (h - 17.5) / 2; return { dark: k * 0.7, warm: Math.sin(k * Math.PI) }; }
  if (h >= 5 && h < 7) { const k = (7 - h) / 2; return { dark: k * 0.7, warm: Math.sin(k * Math.PI) * 0.7 }; }
  return { dark: 0.7, warm: 0 };
}

// Each view renders the world at a different scale (world pixels per screen pixel).
const B_VIEWS = ['street', 'drone', 'sketch', 'close'];
const B_VIEW_INFO = {
  street: { name: 'STREET VIEW', sub: 'Strolling the footpaths', zoom: 2 },
  drone: { name: 'DRONE VIEW', sub: 'Up above the rooftops', zoom: 4 },
  sketch: { name: 'MALGUDI SKETCH', sub: 'Ink and paper, like the old title cards', zoom: 2 },
  close: { name: 'CLOSE-UP', sub: 'Nose to nose with the city', zoom: 1 },
};

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
  if (k.ride && k.ride.phase === 'ride') { drawRide(vw, vh); return; }
  const cx = Math.round(clamp(k.x - vw / 2, 0, BW - vw)), cy = Math.round(clamp(k.y - vh * 0.6, 0, BH - vh));
  k.cam = { x: cx, y: cy, w: vw, h: vh, zoom };
  ctx.fillStyle = '#5d8a3e';
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-cx, -cy);
  ctx.drawImage(k.ground, cx, cy, vw, vh, cx, cy, vw, vh);
  drawGroundLife();

  // Everything with a base y, sorted for depth.
  const list = [];
  for (const s of k.statics) if (s.x + s.w > cx && s.x < cx + vw && s.y < cy + vh && s.base > cy - 4) list.push({ y: s.base, s });
  for (const v of k.vehicles) { const p = vehPos(v); if (bOnScreen(p.x, p.y, 50)) list.push({ y: p.y, v, p }); }
  for (const n of k.npcs) if (bOnScreen(n.x, n.y, 20)) list.push({ y: n.y, n });
  for (const c of k.cows) if (bOnScreen(c.x, c.y, 20)) list.push({ y: c.y, cow: c });
  for (const h of k.horses) {
    const r = B_TRACK.rx - 8 - h.lane * 5, ry = B_TRACK.ry - 8 - h.lane * 4;
    const x = B_TRACK.x + Math.cos(h.a) * r, y = B_TRACK.y + Math.sin(h.a) * ry;
    if (bOnScreen(x, y, 20)) list.push({ y, horse: h, x, dir: -Math.sin(h.a) >= 0 ? 1 : -1 });
  }
  if (bOnScreen(k.dog.x, k.dog.y, 20)) list.push({ y: k.dog.y, dog: k.dog });
  if (k.steam.state !== 'away') list.push({ y: B_RAIL_Y + 8, steam: true });
  if (bOnScreen(k.cart.x, 666, 40)) list.push({ y: 668, cart: true });
  for (const f of k.fishes) if (!f.taken && bOnScreen(f.x, f.y, 10)) list.push({ y: f.y, fish: f });
  for (let x = B_LINES.purple.from + 30; x < B_LINES.purple.to; x += 60) if (bOnScreen(x, 360, 10)) list.push({ y: 361, pillar: x });
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
    }
    else if (it.v) drawVehicle(it.v, it.p);
    else if (it.n) drawPerson(it.n.x, it.n.y, it.n);
    else if (it.cow) drawCow(it.cow);
    else if (it.horse) drawHorse(it.x, it.y, it.horse, it.dir);
    else if (it.dog) drawDog(it.dog);
    else if (it.steam) drawSteam();
    else if (it.cart) drawCart();
    else if (it.fish) { const bob = Math.round(Math.sin(k.t * 4 + it.fish.seed) * 1.5); drawShadow(it.fish.x, it.fish.y, 6, 0.2); ctx.drawImage(SPR.fish.img[0], Math.round(it.fish.x - 4), Math.round(it.fish.y - 9 + bob)); }
    else if (it.pillar) { ctx.fillStyle = '#6e6a62'; ctx.fillRect(it.pillar - 3, 344, 6, 17); ctx.fillStyle = '#a8a294'; ctx.fillRect(it.pillar - 3, 344, 2, 17); }
    else if (it.kitten) { drawCityKitten(); kitDone = true; }
  }
  if (hidden) { ctx.globalAlpha = 0.45; drawCityKitten(); ctx.globalAlpha = 1; }
  drawMetroOverlay();
  // Kitten seen through the viaduct.
  const under = (k.y > 326 && k.y < 380 && k.x > B_LINES.purple.from && k.x < B_LINES.purple.to) || (Math.abs(k.x - 1440) < 18 && k.y > 340);
  if (under) { ctx.globalAlpha = 0.5; drawCityKitten(); ctx.globalAlpha = 1; }
  drawAir();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawNight(vw, vh);
  if (k.view === 'sketch') sketchFilter(vw, vh, cx, cy);
}

function drawCityKitten() {
  const k = BL;
  drawShadow(k.x, k.y, 10);
  if (k.boost > 0 && Math.random() < 0.3) BL.fx.push({ kind: 'steam', x: k.x + rand(-4, 4), y: k.y, h: 26, vh: 12, life: 0.6, max: 0.6, r: 1 });
  drawKnight(bkit, k.x, k.y - k.z);
}

function drawGroundLife() {
  const k = BL;
  // Flower clock hands keep game time.
  const h = k.clock / 60;
  const hand = (a, len, col) => { ctx.fillStyle = col; for (let i = 0; i < len; i++) ctx.fillRect(Math.round(B_CLOCK.x + Math.sin(a) * i), Math.round(B_CLOCK.y - Math.cos(a) * i), 2, 2); };
  if (bOnScreen(B_CLOCK.x, B_CLOCK.y, 30)) {
    hand((h % 12) / 12 * Math.PI * 2, 10, '#2b2220');
    hand((k.clock % 60) / 60 * Math.PI * 2, 15, '#2b2220');
    ctx.fillStyle = '#e6c15e';
    ctx.fillRect(B_CLOCK.x - 1, B_CLOCK.y - 1, 3, 3);
  }
  // Water sparkle, ducks, the coracle.
  if (bOnScreen(B_LAKE.x, B_LAKE.y, 140)) {
    ctx.fillStyle = '#d8eef6';
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4 + Math.floor(k.t * 1.5 + i) * 0.7;
      if ((Math.floor(k.t * 2) + i) % 3) continue;
      ctx.fillRect(Math.round(B_LAKE.x + Math.cos(a) * B_LAKE.rx * 0.6), Math.round(B_LAKE.y + Math.sin(a * 1.3) * B_LAKE.ry * 0.6), 2, 1);
    }
    for (const d of k.ducks) {
      const x = Math.round(d.x), y = Math.round(d.y);
      ctx.fillStyle = '#2b2220'; ctx.fillRect(x - 3, y - 3, 7, 4);
      ctx.fillStyle = d.white ? '#f4f1ea' : '#8a6a4a'; ctx.fillRect(x - 2, y - 2, 5, 2);
      ctx.fillStyle = d.white ? '#f4f1ea' : '#3f7d2f'; ctx.fillRect(x + (d.vx > 0 ? 2 : -3), y - 4, 2, 2);
      ctx.fillStyle = '#ee8b3a'; ctx.fillRect(x + (d.vx > 0 ? 4 : -4), y - 3, 1, 1);
      ctx.fillStyle = '#8cc4e0'; ctx.fillRect(x - 3, y + 1, 7, 1);
    }
  }
  if (bOnScreen(k.coracle.x, 1412, 30)) {
    const x = Math.round(k.coracle.x), y = 1412 + Math.round(Math.sin(k.t * 2) * 0.6);
    ctx.fillStyle = '#3a2618'; ctx.fillRect(x - 8, y - 3, 17, 7);
    ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 7, y - 2, 15, 5);
    ctx.fillStyle = '#a8845a'; for (let i = -6; i < 8; i += 2) ctx.fillRect(x + i, y - 2, 1, 5);
    drawPerson(x, y, { skin: '#7a5236', hair: '#1d1816', top: '#f4f1ea', bottom: '#f4f1ea', facing: k.coracle.dir }, true);
    ctx.fillStyle = '#6b4a32'; ctx.fillRect(x + 4, y - 12, 1, 14);
    ctx.fillStyle = '#8cc4e0'; ctx.fillRect(x - 10, y + 4, 21, 1);
  }
  // Pigeons on the ground.
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
  // Legs or a saree to the feet.
  if (p.saree) { ctx.fillStyle = p.top; ctx.fillRect(X - 2, top + 4, 5, h - 4); ctx.fillStyle = shade(p.top, -0.25); ctx.fillRect(X - 2, top + 7, 5, 1); ctx.fillStyle = '#e6c15e'; ctx.fillRect(X - 2, Y - 2, 5, 1); }
  else if (!sitting) {
    ctx.fillStyle = p.bottom;
    const lh = kid ? 3 : 5;
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

function drawCart() {
  const x = Math.round(BL.cart.x), y = 668, f = BL.cart.dir;
  drawShadow(x, y, 34, 0.2);
  const R = (v, yy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(f > 0 ? x + v : x - v - w + 1, yy, w, h); };
  // Two white bullocks in front.
  for (const oy of [0, 2]) {
    R(8, y - 11 + oy, 12, 6, '#2b2220'); R(9, y - 10 + oy, 10, 4, '#ece6da');
    R(18, y - 13 + oy, 4, 5, '#2b2220'); R(19, y - 12 + oy, 2, 3, '#ece6da'); R(19, y - 15 + oy, 1, 2, '#8a6a4a');
    R(10, y - 5 + oy, 1, 4, '#2b2220'); R(17, y - 5 + oy, 1, 4, '#2b2220');
  }
  R(-16, y - 12, 26, 1, '#6b4a32');
  R(-18, y - 14, 22, 5, '#2b2220'); R(-17, y - 13, 20, 3, '#9a6a45');
  for (let i = 0; i < 6; i++) R(-17 + Math.max(0, 2 - i), y - 20 + i, 20 - Math.max(0, 2 - i) * 2, 1, i % 2 ? '#a8843e' : '#c9a55a');
  ctx.fillStyle = '#2b2220';
  for (let a = 0; a < 6.28; a += 0.5) ctx.fillRect(Math.round(x - f * 8 + Math.cos(a) * 4), Math.round(y - 5 + Math.sin(a) * 4), 1, 1);
}

function drawSteam() {
  const s = BL.steam, y = B_RAIL_Y + 6;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-400, 0, 400 + 652, BH);
  ctx.clip();
  const x0 = Math.round(s.x);
  const wheel = Math.floor(s.x / 4) % 2;
  // Coaches behind the engine.
  for (let i = 0; i < 3; i++) {
    const cx = x0 - 56 - i * 50;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(cx - 23, y - 24, 46, 20);
    ctx.fillStyle = '#8a2f2a'; ctx.fillRect(cx - 22, y - 23, 44, 18);
    ctx.fillStyle = '#5a1f1a'; ctx.fillRect(cx - 22, y - 23, 44, 2);
    ctx.fillStyle = '#e6c15e'; ctx.fillRect(cx - 22, y - 9, 44, 1);
    for (let w = -18; w < 20; w += 7) { ctx.fillStyle = '#2b2220'; ctx.fillRect(cx + w, y - 19, 5, 6); ctx.fillStyle = '#f1ead8'; ctx.fillRect(cx + w + 1, y - 18, 3, 2); }
    ctx.fillStyle = '#2b2220'; ctx.fillRect(cx - 16, y - 5, 6, 5); ctx.fillRect(cx + 10, y - 5, 6, 5);
  }
  // The engine.
  ctx.fillStyle = '#1d1816'; ctx.fillRect(x0 - 28, y - 22, 44, 18);
  ctx.fillStyle = '#2f3138'; ctx.fillRect(x0 - 10, y - 20, 26, 12);
  ctx.fillStyle = '#4a4f58'; ctx.fillRect(x0 - 10, y - 20, 26, 2);
  ctx.fillStyle = '#1d1816'; ctx.fillRect(x0 - 28, y - 30, 16, 12); ctx.fillStyle = '#2f3138'; ctx.fillRect(x0 - 27, y - 29, 14, 9);
  ctx.fillStyle = '#ffd98a'; ctx.fillRect(x0 - 24, y - 27, 6, 4);
  ctx.fillStyle = '#1d1816'; ctx.fillRect(x0 + 8, y - 30, 6, 10); ctx.fillRect(x0 + 6, y - 32, 10, 3);
  ctx.fillStyle = '#d8433b'; ctx.fillRect(x0 + 15, y - 10, 4, 4);
  ctx.fillStyle = '#e6c15e'; ctx.fillRect(x0 + 16, y - 18, 2, 2);
  for (const wx of [-22, -8, 4]) {
    ctx.fillStyle = '#1d1816'; ctx.fillRect(x0 + wx, y - 9, 9, 9);
    ctx.fillStyle = '#d8433b'; ctx.fillRect(x0 + wx + 1, y - 8, 7, 7);
    ctx.fillStyle = '#1d1816'; ctx.fillRect(x0 + wx + 3 + wheel, y - 6, 3, 3);
  }
  ctx.fillStyle = '#c9ced2'; ctx.fillRect(x0 - 18 + wheel * 2, y - 5, 26, 1);
  ctx.restore();
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
  // Vertical: seen from the front (coming down) or the back (going up).
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

// Viaducts, stations and trains, drawn over the ground layer.
function drawMetroOverlay() {
  const k = BL, P = B_LINES.purple, G = B_LINES.green;
  const yd = P.at - DECK;
  if (k.cam.y < P.at + 20 && k.cam.y + k.cam.h > yd - 40) {
    const x0 = Math.max(P.from, k.cam.x - 10), x1 = Math.min(P.to, k.cam.x + k.cam.w + 10);
    ctx.fillStyle = '#4a4740'; ctx.fillRect(x0, yd - 7, x1 - x0, 15);
    ctx.fillStyle = '#c9c2b6'; ctx.fillRect(x0, yd - 6, x1 - x0, 9);
    ctx.fillStyle = '#8a857a'; ctx.fillRect(x0, yd + 3, x1 - x0, 4);
    ctx.fillStyle = '#a39b8a'; for (let x = x0 - (x0 % 6); x < x1; x += 6) { ctx.fillRect(x, yd - 4, 1, 2); ctx.fillRect(x, yd, 1, 2); }
    ctx.fillStyle = '#6e6a62'; ctx.fillRect(x0, yd - 3, x1 - x0, 1); ctx.fillRect(x0, yd + 1, x1 - x0, 1);
    for (const s of P.stations) if (bOnScreen(s.p, yd, 60)) drawStationH(s, P, false);
  }
  if (k.cam.x < G.at + 30 && k.cam.x + k.cam.w > G.at - 30) {
    const y0 = Math.max(G.from, k.cam.y) - DECK, y1 = Math.min(G.to, k.cam.y + k.cam.h + DECK) - DECK;
    ctx.fillStyle = '#4a4740'; ctx.fillRect(G.at - 8, y0, 16, y1 - y0);
    ctx.fillStyle = '#c9c2b6'; ctx.fillRect(G.at - 7, y0, 14, y1 - y0);
    ctx.fillStyle = '#a39b8a'; for (let y = y0 - (y0 % 6); y < y1; y += 6) { ctx.fillRect(G.at - 5, y, 2, 1); ctx.fillRect(G.at + 3, y, 2, 1); }
    ctx.fillStyle = '#6e6a62'; ctx.fillRect(G.at - 4, y0, 1, y1 - y0); ctx.fillRect(G.at + 3, y0, 1, y1 - y0);
    for (const s of G.stations) if (s.id !== 'cubbon' && bOnScreen(G.at, s.p, 60)) drawStationV(s, G, false);
  }
  for (const tr of k.trains) drawMetroTrain(tr);
  for (const s of P.stations) if (bOnScreen(s.p, yd, 60)) drawStationH(s, P, true);
  for (const s of G.stations) if (s.id !== 'cubbon' && bOnScreen(G.at, s.p, 60)) drawStationV(s, G, true);
}

function drawStationH(s, L, roof) {
  const x = s.p, yd = L.at - DECK;
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
  ctx.fillStyle = L.col; ctx.fillRect(x - 5, yd - 34, 10, 9);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, yd - 32, 1, 5); ctx.fillRect(x + 2, yd - 32, 1, 5); ctx.fillRect(x - 2, yd - 31, 1, 1); ctx.fillRect(x + 1, yd - 31, 1, 1); ctx.fillRect(x - 1, yd - 30, 2, 1);
}

function drawStationV(s, L, roof) {
  const y = s.p - DECK, x = L.at;
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
  ctx.fillStyle = L.col; ctx.fillRect(x - 5, y - 49, 10, 9);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 47, 1, 5); ctx.fillRect(x + 2, y - 47, 1, 5); ctx.fillRect(x - 2, y - 46, 1, 1); ctx.fillRect(x + 1, y - 46, 1, 1); ctx.fillRect(x - 1, y - 45, 2, 1);
}

function drawMetroTrain(tr) {
  const L = B_LINES[tr.line];
  const p = Math.round(tr.p);
  if (L.axis === 'h') {
    const yb = L.at - DECK + (tr.dir > 0 ? -1 : 4);
    if (!bOnScreen(p, yb, 80)) return;
    for (let i = 0; i < 3; i++) {
      const x0 = p - 57 + i * 38;
      ctx.fillStyle = '#2b2220'; ctx.fillRect(x0, yb - 11, 37, 11);
      ctx.fillStyle = '#eceaf0'; ctx.fillRect(x0 + 1, yb - 10, 35, 9);
      ctx.fillStyle = L.col; ctx.fillRect(x0 + 1, yb - 4, 35, 3); ctx.fillRect(x0 + 1, yb - 10, 35, 1);
      ctx.fillStyle = '#3a4a58'; for (let wx = 3; wx < 34; wx += 6) ctx.fillRect(x0 + wx, yb - 8, 4, 3);
      ctx.fillStyle = '#9a9aa6'; ctx.fillRect(x0 + 16, yb - 9, 4, 7);
    }
    const nose = tr.dir > 0 ? p + 57 : p - 58;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(nose - 1, yb - 9, 3, 8);
    ctx.fillStyle = '#fff3c8'; ctx.fillRect(nose, yb - 3, 1, 1);
    return;
  }
  const xc = L.at + (tr.dir > 0 ? 3 : -3);
  if (!bOnScreen(xc, p, 80)) return;
  for (let i = 0; i < 3; i++) {
    const y0 = p - DECK - 51 + i * 34;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(xc - 4, y0, 8, 33);
    ctx.fillStyle = '#d9d6de'; ctx.fillRect(xc - 3, y0 + 1, 6, 31);
    ctx.fillStyle = L.col; ctx.fillRect(xc - 3, y0 + 1, 1, 31); ctx.fillRect(xc + 2, y0 + 1, 1, 31);
    ctx.fillStyle = '#a3a9ae'; ctx.fillRect(xc - 1, y0 + 6, 2, 4); ctx.fillRect(xc - 1, y0 + 22, 2, 4);
  }
  const ny = tr.dir > 0 ? p - DECK + 51 : p - DECK - 52;
  ctx.fillStyle = L.col; ctx.fillRect(xc - 4, ny, 8, 2);
  ctx.fillStyle = '#fff3c8'; ctx.fillRect(xc - 3, ny, 1, 1); ctx.fillRect(xc + 2, ny, 1, 1);
}

// Petals, smoke, flying pigeons, coffee steam.
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
  const r = Math.round(255 - dark * 175 + warm * 0), g = Math.round(255 - dark * 160 - warm * 40), b = Math.round(255 - dark * 90 - warm * 90);
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
    for (const s of BL.statics) {
      if (s.kind !== 'bld' || !s.b.mcol || s.b.house === 'j' && Math.sin(s.x) > 0.3) continue;
      if (s.x + s.w < c.x || s.x > c.x + c.w || s.y > c.y + c.h || s.base < c.y) continue;
      ctx.fillStyle = `rgba(255,200,110,${a * 0.5})`;
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

// The view out of the metro window.
function drawRide(vw, vh) {
  const R = BL.ride, seg = R.segs[R.seg], L = B_LINES[seg.line];
  const dir = Math.sign(seg.b - seg.a) || 1;
  const horizon = Math.round(vh * 0.66);
  const day = bDaylight();
  const top = lerpRgb([126, 178, 222], [32, 36, 70], day.dark / 0.7), bot = lerpRgb([214, 234, 242], [92, 70, 110], day.dark / 0.7);
  for (let y = 0; y < horizon; y++) {
    const v = (y / horizon) * 7;
    const i = Math.floor(v) + ((v % 1) > dither(0, y) ? 1 : 0);
    ctx.fillStyle = rgbStr(lerpRgb(top, bot, Math.min(1, i / 7)));
    ctx.fillRect(0, y, vw, 1);
  }
  const s = R.s;
  // Clouds, far skyline of apartment blocks, then landmarks.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 97 - s * 0.05 * dir) % (vw + 80) + vw + 80) % (vw + 80) - 40;
    pixEllipse(ctx, x, 14 + (i * 13) % 30, 14, 4);
  }
  const far = (k, col, hmin, hmax, wmin, step) => {
    const base = Math.floor((s * k * dir) / step);
    for (let j = -2; j < vw / step + 3; j++) {
      const id = base + j;
      const rnd = slotRand(id, k * 10);
      const x = Math.round(j * step - ((((s * k * dir) % step) + step) % step));
      const h = hmin + rnd * (hmax - hmin), w = wmin + slotRand(id, 3) * 16;
      ctx.fillStyle = col;
      ctx.fillRect(x, horizon - h, w, h);
      ctx.fillStyle = shade(col, -0.25);
      ctx.fillRect(x + 2, horizon - h - 4, 5, 4);
      ctx.fillStyle = day.dark > 0.3 ? '#ffd98a' : shade(col, 0.15);
      for (let wy = horizon - h + 4; wy < horizon - 4; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 5) if (slotRand(id + wx, wy) < 0.55) ctx.fillRect(wx, wy, 2, 2);
    }
  };
  far(0.12, day.dark > 0.3 ? '#3a3f5a' : '#a6b4c4', 20, 46, 14, 26);
  for (const it of rideScenery(seg.line)) {
    const sc = clamp(0.62 - it.d / 1100, 0.18, 0.62);
    const x = vw / 2 + (it.along - s) * dir * sc * 0.9;
    const w = it.img.width * sc, h = it.img.height * sc;
    if (x + w / 2 < -10 || x - w / 2 > vw + 10) continue;
    ctx.drawImage(it.img, Math.round(x - w / 2), Math.round(horizon - h + 2), Math.round(w), Math.round(h));
  }
  far(0.45, day.dark > 0.3 ? '#2b2f44' : '#7d8a9a', 10, 26, 18, 34);
  // Ground, trees and the viaduct the train runs on.
  ctx.fillStyle = '#5d8a3e'; ctx.fillRect(0, horizon, vw, vh - horizon);
  const treeStep = 46, tb = Math.floor(s * 1.1 * dir / treeStep);
  for (let j = -2; j < vw / treeStep + 3; j++) {
    const id = tb + j, x = Math.round(j * treeStep - ((((s * 1.1 * dir) % treeStep) + treeStep) % treeStep));
    const kind = slotRand(id, 9) < 0.35 ? 'pink' : slotRand(id, 9) < 0.7 ? 'rain' : 'coconut';
    const img = BL.treeSpr[kind][id & 1 ? 1 : 0];
    ctx.drawImage(img, x, horizon + 6 - img.height + 14);
  }
  const deckY = horizon + 18;
  ctx.fillStyle = '#4a4740'; ctx.fillRect(0, deckY, vw, 9);
  ctx.fillStyle = '#c9c2b6'; ctx.fillRect(0, deckY + 1, vw, 5);
  const ps = 70;
  for (let j = -1; j < vw / ps + 2; j++) {
    const x = Math.round(j * ps - ((((s * 1.3 * dir) % ps) + ps) % ps));
    ctx.fillStyle = '#6e6a62'; ctx.fillRect(x, deckY + 9, 8, vh - deckY - 9);
    ctx.fillStyle = '#a39b8a'; ctx.fillRect(x, deckY + 9, 2, vh - deckY - 9);
  }
  // The train: three cars, Ser Biscuit at a window.
  const tw = 52, ty = deckY - 20, tx0 = Math.round(vw / 2 - tw * 1.5);
  const rock = R.speed > 20 ? (Math.floor(BL.t * 12) % 2) : 0;
  for (let i = 0; i < 3; i++) {
    const x = tx0 + i * tw;
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x, ty - rock, tw - 1, 20);
    ctx.fillStyle = '#eceaf0'; ctx.fillRect(x + 1, ty + 1 - rock, tw - 3, 18);
    ctx.fillStyle = L.col; ctx.fillRect(x + 1, ty + 12 - rock, tw - 3, 5); ctx.fillRect(x + 1, ty + 1 - rock, tw - 3, 1);
    for (let wx = 4; wx < tw - 8; wx += 9) {
      ctx.fillStyle = '#3a4a58'; ctx.fillRect(x + wx, ty + 4 - rock, 7, 6);
      if (slotRand(i * 10 + wx, 1) < 0.5) { ctx.fillStyle = '#2b2220'; ctx.fillRect(x + wx + 2, ty + 6 - rock, 3, 4); }
    }
    ctx.fillStyle = '#9a9aa6'; ctx.fillRect(x + tw / 2 - 3, ty + 3 - rock, 6, 13);
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x + 5, ty + 19, 8, 2); ctx.fillRect(x + tw - 14, ty + 19, 8, 2);
  }
  const fr = SPR.kitten.idle;
  ctx.drawImage(fr.img[0], 0, 0, 24, 14, tx0 + tw + 12, ty + 2 - rock, 12, 7);
  ctx.fillStyle = '#2b2220'; ctx.fillRect(tx0 + tw * 3 - 1, ty + 3 - rock, 3, 14);
  ctx.fillStyle = '#fff3c8'; ctx.fillRect(tx0 + tw * 3, ty + 13 - rock, 1, 2);
  // Speed lines.
  if (R.speed > 40) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(((i * 71 - BL.t * 400) % vw + vw) % vw), deckY + 30 + (i * 7) % (vh - deckY - 32), 18, 1);
  }
  drawNight(vw, vh, false);
  if (BL.view === 'sketch') sketchFilter(vw, vh, 0, 0);
}

// ---------------------------------------------------------------------------
// Drawing: the sharp UI layer
// ---------------------------------------------------------------------------
// Outlined text with a thinner stroke: the default one closes up C and G at small sizes.
function cut(str, x, y, o = {}) { return ut(str, x, y, { stroke: Math.max(0.9, (o.size || 6) * 0.2), ...o }); }

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

function cityUI() {
  const k = BL;
  if (k.ride) { rideUI(); return; }
  const c = k.cam, z = c.zoom;
  const sx = wx => (wx - c.x) / z, sy = wy => (wy - c.y) / z;

  // Signs on buildings, or landmark names from the drone.
  for (const s of k.statics) {
    if (s.kind !== 'bld') continue;
    if (s.x + s.w < c.x || s.x > c.x + c.w || s.y > c.y + c.h || s.base < c.y) continue;
    if (z <= 2 && s.b.signs) for (const g of s.b.signs) cut(g.text, sx(s.x + g.x), sy(s.y + g.y - g.size / 2), { size: g.size / z, color: g.color, align: 'center', outline: g.outline === null ? null : '#1d1816', stroke: g.size * 0.3 / z, weight: 700 });
  }
  if (z > 2) {
    for (const pc of B_POSTCARDS) {
      if (pc.ride || !bOnScreen(pc.x, pc.y, 0)) continue;
      cut(pc.name, sx(pc.x), sy(pc.y) - 12, { size: 4.6, color: SAVE.city.stamps.includes(pc.id) ? '#ffd25e' : '#ffffff', align: 'center' });
    }
  }
  for (const [lid, L] of Object.entries(B_LINES)) {
    for (const s of L.stations) {
      if (lid === 'green' && s.id === 'cubbon') continue;
      const x = L.axis === 'h' ? s.p : L.at, y = L.axis === 'h' ? L.at - DECK - 40 : s.p - DECK - 55;
      if (bOnScreen(x, y, 0)) cut(`${s.name}${s.id === 'cubbon' ? ' (both lines)' : ''}`, sx(x), sy(y) - 5, { size: z > 2 ? 3.6 : 4.2, color: L.light, align: 'center' });
    }
  }

  // Speech, floating text.
  for (const n of k.npcs) if (n.bubble && bOnScreen(n.x, n.y, 0)) ububble(n.bubble.text, sx(n.x), sy(n.y - (n.kid ? 13 : 17)), Math.min(1, n.bubble.t * 4), W);
  for (const tx of k.texts) if (bOnScreen(tx.x, tx.y, 10)) cut(tx.text, sx(tx.x), sy(tx.y), { size: 5, color: tx.color, align: 'center', alpha: Math.min(1, tx.life / tx.max * 2) });

  // Top-left: fish, postcards, clock, place.
  uimg(SPR.fish.img[0], 4, 5);
  cut(`${SAVE.fish}`, 15, 4, { size: 6, color: '#9fd6ef' });
  drawStampIcon(4, 14, 9, 7, true);
  cut(`${SAVE.city.stamps.length}/${B_POSTCARDS.length}`, 15, 13, { size: 6, color: '#ffd25e' });
  cut(fmtClock(k.clock), 4, 23, { size: 5, color: '#f6e9c8' });
  if (k.boost > 0) cut(`Kaapi ${Math.ceil(k.boost)}s`, 4, 31, { size: 4.6, color: '#ffe08a' });
  cut(k.place, W / 2, 4, { size: 6, color: '#ffffff', align: 'center' });
  if (k.view !== 'street') cut({ drone: 'drone view', sketch: 'Malgudi sketch', close: 'close-up' }[k.view], W / 2, 12, { size: 4.4, color: '#d8d0c2', align: 'center' });

  drawCityMini();
  const keys = input.mode === 'touch' ? '' : input.mode === 'pad' ? 'Select map  LB view' : 'M map  V view';
  if (keys) cut(keys, W - 4, 51, { size: 4.2, color: '#d8d0c2', align: 'right' });

  // Waypoint arrow at the screen edge.
  if (k.waypoint) {
    const wx = sx(k.waypoint.x), wy = sy(k.waypoint.y);
    const m = (Math.hypot(k.waypoint.x - k.x, k.waypoint.y - k.y) * 2.5);
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

  // What the jump button does here.
  if (k.near && !k.mapOpen) {
    const key = input.mode === 'touch' ? 'JUMP' : input.mode === 'pad' ? 'A' : 'K';
    const txt = `${key}  ${k.near.label}`;
    const w = uwidth(txt, 5.5) + 10;
    const py = k.card ? H * 0.3 : H - 16;
    ubox(W / 2 - w / 2, py, w, 10, 'rgba(29,24,22,0.82)');
    cut(txt, W / 2, py + 1.5, { size: 5.5, color: '#ffe08a', align: 'center' });
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
    const hint = input.mode === 'touch' ? 'Stick to walk, JUMP to talk or ride, MAP and VIEW up top.' : input.mode === 'pad' ? 'Stick to walk, A to talk or ride, Select for the map, LB to change view.' : 'WASD to walk, K to talk or ride the metro, M for the map, V to change view.';
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
  uctx.globalAlpha = a;
  ubox(x, y, w, h, '#f6efe0', '#1d1816', a);
  urect(x + 2, y + 2, w - 4, 1, '#d8433b', a);
  urect(x + 2, y + h - 3, w - 4, 1, '#2f6db0', a);
  drawStampIcon(x + w - 18, y + 4, 13, 10, true);
  uctx.globalAlpha = 1;
  cut('POSTCARD', x + 5, y + 4, { size: 4, color: '#8a7e72', outline: null, alpha: a });
  cut(card.pc.name, x + 5, y + 8.5, { size: 6.5, color: '#1d1816', outline: null, alpha: a });
  lines.forEach((l, i) => cut(l, x + 5, y + 16 + i * 7, { size: 5, color: '#3a302b', outline: null, weight: 600, alpha: a }));
}

function drawCityMini() {
  const k = BL, m = miniRect();
  const span = 520;                                 // world pixels across the minimap
  const s = m.w / span;
  const wx0 = clamp(k.x - span / 2, 0, BW - span), wy0 = clamp(k.y - span * m.h / m.w / 2, 0, BH - span * m.h / m.w);
  ubox(m.x - 1.5, m.y - 1.5, m.w + 3, m.h + 3, '#1d1816', '#e9e4dc');
  uctx.save();
  uctx.beginPath();
  uctx.rect(m.x, m.y, m.w, m.h);
  uctx.clip();
  uctx.imageSmoothingEnabled = false;
  uctx.drawImage(k.mini, wx0 / 8, wy0 / 8, span / 8, span * m.h / m.w / 8, m.x, m.y, m.w, m.h);
  const X = wx => m.x + (wx - wx0) * s, Y = wy => m.y + (wy - wy0) * s;
  drawMetroLines(X, Y, 0.9);
  for (const tr of k.trains) { const p = trainXY(tr); urect(X(p.x) - 1, Y(p.y) - 1, 2, 2, '#ffffff'); }
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
    if (L.axis === 'h') { uctx.moveTo(X(L.from), Y(L.at)); uctx.lineTo(X(L.to), Y(L.at)); }
    else { uctx.moveTo(X(L.at), Y(L.from)); uctx.lineTo(X(L.at), Y(L.to)); }
    uctx.stroke();
  }
}

function drawCityMap() {
  const k = BL, M = mapLayout();
  urect(0, 0, W, H, '#100e0d', 0.72);
  utitle('NAMMA BENGALURU', W / 2, 3, 6, '#ffd25e');
  ubox(M.mx - 2, M.my - 2, M.mw + 4, M.mh + 4, '#1d1816', '#e9e4dc');
  uctx.imageSmoothingEnabled = false;
  uctx.drawImage(k.mini, M.mx, M.my, M.mw, M.mh);
  const X = wx => M.mx + wx * M.s, Y = wy => M.my + wy * M.s;
  drawMetroLines(X, Y, 1.2);
  for (const d of B_DISTRICTS) cut(d.name, X(d.x + d.w / 2), Y(d.y + d.h / 2) - 2, { size: 3.6, color: 'rgba(255,255,255,0.75)', align: 'center', stroke: 1 });
  for (const tr of k.trains) { const p = trainXY(tr); urect(X(p.x) - 1.2, Y(p.y) - 1.2, 2.4, 2.4, '#ffffff'); }
  const sel = k.mapSel;
  for (const t of mapTargets()) {
    const x = X(t.x), y = Y(t.y);
    if (t.kind === 'station') {
      urect(x - 1.6, y - 1.6, 3.2, 3.2, INK);
      urect(x - 1.1, y - 1.1, 2.2, 2.2, '#ffffff');
    } else {
      drawStampIcon(x - 2.5, y - 2, 5, 4, t.done);
    }
    if (sel && t.id === sel.id) {
      uctx.strokeStyle = Math.sin(k.t * 8) > 0 ? '#ffd25e' : '#ffffff';
      uctx.lineWidth = 0.7;
      uctx.strokeRect(x - 4, y - 4, 8, 8);
    }
  }
  if (k.waypoint) drawArrow(X(k.waypoint.x), Y(k.waypoint.y) - 6, Math.PI / 2);
  const kx = X(k.x), ky = Y(k.y);
  uimg(SPR.kitten.idle.img[0], kx - 4, ky - 9, 8, 10);
  if (sel) {
    const status = sel.kind === 'station' ? 'Namma Metro station' : sel.done ? 'Postcard collected' : 'Postcard to find';
    const txt = `${sel.name}  -  ${status}`;
    const w = uwidth(txt, 5.5) + 10;
    const by = sel.y * M.s + M.my > H / 2 ? M.my + 2 : M.my + M.mh - 12;
    ubox(W / 2 - w / 2, by, w, 10, 'rgba(29,24,22,0.9)');
    cut(txt, W / 2, by + 1.6, { size: 5.5, color: '#ffd25e', align: 'center' });
  }
  const hint = input.mode === 'touch' ? 'Tap a place to head there. MAP to close.' : input.mode === 'pad' ? 'D-pad choose, A set destination, Select close' : 'Arrows choose, K set destination, M close';
  cut(hint, W / 2, H - 10, { size: 4.6, color: '#d8d0c2', align: 'center' });
}

function rideUI() {
  const R = BL.ride;
  if (R.phase === 'pick') {
    // Underneath, the city is still drawn; show a Namma Metro map card.
    const w = Math.min(200, W - 16), h = Math.min(108, H - 14), x = W / 2 - w / 2, y = H / 2 - h / 2;
    ubox(x, y, w, h, 'rgba(29,24,22,0.95)');
    cut('NAMMA METRO', W / 2, y + 4, { size: 7, color: '#ffd25e', align: 'center', font: TITLE_FONT, weight: 400, stroke: 2.4 });
    cut(`From ${B_STATIONS[R.from].name}. Where to?`, W / 2, y + 14, { size: 5, color: '#d8d0c2', align: 'center' });
    R.hits = [];
    ['purple', 'green'].forEach((lid, ci) => {
      const L = B_LINES[lid], cx = x + w * (ci ? 0.72 : 0.28), y0 = y + 30, gap = (h - 44) / 3;
      cut(L.name, cx, y0 - 8, { size: 5, color: L.light, align: 'center' });
      urect(cx - 0.8, y0, 1.6, gap * 3, L.col);
      L.stations.forEach((s, ri) => {
        const sy = y0 + ri * gap, here = s.id === R.from, sel = R.sel.col === ci && R.sel.row === ri;
        urect(cx - 2.5, sy - 2.5, 5, 5, INK);
        urect(cx - 1.8, sy - 1.8, 3.6, 3.6, here ? '#ff8a7a' : '#ffffff');
        const label = here ? `${s.name} (here)` : s.name;
        cut(label, cx + 6, sy - 3, { size: 5, color: sel ? '#ffd25e' : here ? '#ff8a7a' : '#ffffff' });
        if (sel) drawArrow(cx - 7, sy, 0);
        R.hits.push({ x: cx + 14, y: sy, sel: { col: ci, row: ri } });
      });
    });
    const hint = input.mode === 'touch' ? 'Tap a station. II to cancel.' : input.mode === 'pad' ? 'D-pad choose, A ride, Start cancel' : 'Arrows choose, K ride, Esc cancel';
    cut(hint, W / 2, y + h - 9, { size: 4.6, color: '#d8d0c2', align: 'center' });
    return;
  }
  const seg = R.segs[R.seg], L = B_LINES[seg.line];
  band(0, 14, 0.55);
  urect(0, 13, W, 1, L.col);
  cut(`${L.name}  >  ${seg.toName}`, 6, 3.5, { size: 6, color: L.light });
  cut(fmtClock(BL.clock), W - 6, 3.5, { size: 6, color: '#f6e9c8', align: 'right' });
  if (R.caption) {
    const a = Math.min(1, R.caption.t * 3);
    band(H - 26, 22, 0.55 * a);
    cut(R.caption.kn, W / 2, H - 23, { size: 6.5, color: '#ffd25e', align: 'center', alpha: a });
    cut(R.caption.en, W / 2, H - 13, { size: 5, color: '#ffffff', align: 'center', alpha: a });
  }
}
