'use strict';

// ---------------------------------------------------------------------------
// Bengaluru mode: the map.
//
// Places are given by their real latitude and longitude (from Wikipedia,
// OpenStreetMap-based listings and plus codes) and projected onto the world
// with geo(). As on a tourist map, the old city in the middle is drawn at a
// larger scale (700 px to the km) than the suburbs around it (about 400), so
// its landmarks have room. Each axis is only stretched, never folded, so
// whatever is north or east of something in Bengaluru is north or east of it
// here too. Landmarks are drawn larger than life, as illustrated maps do,
// and a few are nudged (dx, dy) to sit on the right side of their road.
//
// Roads follow their real alignments, slanting where the real road slants.
// Where a landmark faces a road (all the art faces south), that stretch of
// road runs east-west in front of it.
//
// The map runs from Yeshwanthpur in the north-west, where the Green Line
// ends, out past Vijayanagar to Mysore Road at the far end of the Purple
// Line, and east to Indiranagar and Silk Board.
// ---------------------------------------------------------------------------
const B_KM = { lon: 108.48, lat: 110.6 };   // km per degree at 13°N

// Breakpoints [degrees, pixels] for one axis: a start, then spans of [degrees, px per km].
function bWarp(v0, p0, perDeg, spans) {
  const pts = [[v0, p0]];
  for (const [v, pxKm] of spans) { const [pv, pp] = pts[pts.length - 1]; pts.push([v, pp + Math.abs(v - pv) * perDeg * pxKm]); }
  return pts;
}
const B_WX = bWarp(77.524, 0, B_KM.lon, [[77.563, 400], [77.612, 700], [77.648, 400]]);
const B_WY = bWarp(13.0275, 0, B_KM.lat, [[12.993, 420], [12.940, 700], [12.907, 400]]);
function bWarpAt(v, pts) {
  const up = pts[1][0] > pts[0][0];
  let i = 0;
  while (i < pts.length - 2 && (up ? v > pts[i + 1][0] : v < pts[i + 1][0])) i++;
  const [a, pa] = pts[i], [b, pb] = pts[i + 1];
  return pa + (v - a) / (b - a) * (pb - pa);
}
const lonX = lon => Math.round(bWarpAt(lon, B_WX));
const latY = lat => Math.round(bWarpAt(lat, B_WY));
const geo = (lat, lon, dx = 0, dy = 0) => ({ x: lonX(lon) + dx, y: latY(lat) + dy });
// The other way: world pixels back to degrees, and real distances in metres.
const bUnwarp = (p, pts) => bWarpAt(p, pts.map(([v, q]) => [q, v]));
const bMetres = (a, b) => Math.hypot((bUnwarp(a.x, B_WX) - bUnwarp(b.x, B_WX)) * B_KM.lon, (bUnwarp(a.y, B_WY) - bUnwarp(b.y, B_WY)) * B_KM.lat) * 1000;

const BW = 7040, BH = 7200;                 // city size in world pixels

// Geometry shared with the engine.
function segDist(x, y, p) {
  const dx = p.x1 - p.x0, dy = p.y1 - p.y0;
  const k = clamp(((x - p.x0) * dx + (y - p.y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - (p.x0 + dx * k), y - (p.y0 + dy * k));
}
// Distance between a rectangle and a segment (0 when they touch).
function rectSegDist(r, p) {
  const inside = (x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  if (inside(p.x0, p.y0) || inside(p.x1, p.y1)) return 0;
  const edges = [[r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h], [r.x + r.w, r.y + r.h, r.x, r.y + r.h], [r.x, r.y + r.h, r.x, r.y]];
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  let best = Infinity;
  for (const [ax, ay, bx, by] of edges) {
    const d1 = cross(ax, ay, bx, by, p.x0, p.y0), d2 = cross(ax, ay, bx, by, p.x1, p.y1), d3 = cross(p.x0, p.y0, p.x1, p.y1, ax, ay), d4 = cross(p.x0, p.y0, p.x1, p.y1, bx, by);
    if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
    const e = { x0: ax, y0: ay, x1: bx, y1: by };
    best = Math.min(best, segDist(ax, ay, p), segDist(p.x0, p.y0, e), segDist(p.x1, p.y1, e));
  }
  return best;
}
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Neighbourhoods. Later ones sit on top of earlier ones. `trees` is the mix
// of trees and `density` the ground area per tree; `verges` scatters grassy
// patches; `blurb` is shown when you walk in.
// ---------------------------------------------------------------------------
const geoBox = (lat0, lon0, lat1, lon1) => { const a = geo(lat0, lon0), b = geo(lat1, lon1); return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }; };
const gpoly = pts => pts.map(([lat, lon]) => { const p = geo(lat, lon); return [p.x, p.y]; });
const B_DISTRICTS = [
  { name: 'Bengaluru', x: 0, y: 0, w: BW, h: BH, ground: '#c2b8a2', mus: 'city', trees: [['rain', 3], ['coconut', 2], ['gulmohar', 1]], verges: true },
  { name: 'Yeshwanthpur', ...geoBox(13.0275, 77.524, 13.0135, 77.5655), ground: '#c2b8a4', mus: 'city', trees: [['rain', 3], ['coconut', 2]], verges: true, blurb: 'A railway junction and the sandal soap factory' },
  { name: 'Mathikere', ...geoBox(13.0275, 77.5655, 13.0135, 77.5830), ground: '#b9b08a', mus: 'city', trees: [['rain', 4], ['coconut', 2]], verges: true, blurb: 'Quiet lanes beside the IISc woods' },
  { name: 'Rajajinagar', ...geoBox(13.0135, 77.524, 12.9870, 77.5655), ground: '#bdb391', mus: 'city', trees: [['rain', 3], ['coconut', 3], ['pink', 1]], verges: true, blurb: 'ISKCON on its hill, and Orion Mall' },
  { name: 'Vijayanagar', ...geoBox(12.9870, 77.524, 12.9560, 77.5455), ground: '#cfc5b0', mus: 'city', trees: [['rain', 3], ['coconut', 2], ['gulmohar', 1]], verges: true, blurb: 'Busy shopping streets on the Purple Line' },
  { name: 'Binnypet', ...geoBox(12.9870, 77.5455, 12.9560, 77.5655), ground: '#c2b8a4', mus: 'city', trees: [['rain', 2], ['coconut', 2]], verges: true, blurb: 'Old mill lanes by the railway' },
  { name: 'Deepanjali Nagar', ...geoBox(12.9560, 77.524, 12.9400, 77.5560), ground: '#c4b8a2', mus: 'city', trees: [['rain', 2], ['coconut', 2]], verges: true, blurb: 'Mysore Road, on its way out to Mysuru' },
  { name: 'Malleswaram', ...geoBox(13.0135, 77.5655, 12.9905, 77.5800), ground: '#b9b08a', mus: 'city', trees: [['rain', 4], ['coconut', 3], ['pink', 1]], verges: true, density: 9000, blurb: 'Old Bengaluru: temples, flowers, filter coffee' },
  { name: 'Sankey Tank', ...geoBox(13.0135, 77.5738, 13.0030, 77.5830), ground: '#74a34a', mus: 'city', trees: [['rain', 4], ['pink', 2], ['gulmohar', 1]], density: 5000, blurb: "Colonel Sankey's lake, dug in 1882" },
  { name: 'Sadashivanagar', ...geoBox(13.0275, 77.5830, 13.0030, 77.5985), ground: '#8db562', mus: 'city', trees: [['rain', 5], ['gulmohar', 1]], density: 6000, blurb: 'Big gardens, bigger trees' },
  { name: 'Bangalore Palace', ...geoBox(13.0030, 77.5880, 12.9915, 77.5985), ground: '#7fae54', mus: 'city', trees: [['rain', 5], ['royal', 1], ['gulmohar', 1]], density: 7000, blurb: "The Wodeyars' Tudor palace and its grounds" },
  { name: 'Vasanth Nagar', ...geoBox(13.0135, 77.5985, 12.9862, 77.6120), ground: '#c4b8a2', mus: 'city', trees: [['rain', 4], ['gulmohar', 1], ['pink', 1]], verges: true, blurb: 'Bungalows by the Cantonment station' },
  { name: 'Shivajinagar', ...geoBox(12.9862, 77.6005, 12.9810, 77.6120), ground: '#c2b8a4', mus: 'city', trees: [['rain', 1], ['coconut', 1]], density: 20000, blurb: 'Bazaars, a basilica and Russell Market' },
  { name: 'Ulsoor', ...geoBox(12.9900, 77.6120, 12.9705, 77.6300), ground: '#9cbb6e', mus: 'city', trees: [['rain', 4], ['coconut', 2], ['pink', 1]], density: 8000, blurb: "Kempe Gowda's lake and the Someshwara temple" },
  { name: 'Indiranagar', ...geoBox(12.9900, 77.6300, 12.9550, 77.6492), ground: '#c4b8a2', mus: 'city', trees: [['rain', 3], ['pink', 2], ['gulmohar', 1]], verges: true, blurb: 'Cafes, pubs and 100 Feet Road' },
  { name: 'Race Course', ...geoBox(12.9915, 77.5765, 12.9805, 77.5880), ground: '#77a34c', mus: 'city', trees: [['rain', 5], ['gulmohar', 2]], density: 7000, blurb: 'Hoofbeats behind the railings' },
  { name: 'High Grounds', ...geoBox(12.9915, 77.5880, 12.9822, 77.5985), ground: '#86b05a', mus: 'city', trees: [['rain', 5], ['gulmohar', 1], ['royal', 1]], density: 6000, blurb: 'Raj Bhavan and the Planetarium' },
  { name: 'Majestic', ...geoBox(12.9905, 77.5655, 12.9720, 77.5765), ground: '#c2b8a4', mus: 'city', trees: [['rain', 2], ['coconut', 1]], density: 16000, blurb: 'Trains, buses and cinemas, all at once' },
  { name: 'Gandhinagar', ...geoBox(12.9805, 77.5765, 12.9720, 77.5865), ground: '#c2b8a4', mus: 'city', trees: [['rain', 2], ['coconut', 1]], density: 14000, blurb: 'Freedom Park and the old jail walls' },
  { name: 'Vidhana Soudha', ...geoBox(12.9822, 77.5865, 12.9784, 77.5965), ground: '#7fae54', mus: 'city', trees: [['rain', 5], ['gulmohar', 2], ['pink', 2], ['royal', 1]], density: 5000, blurb: "Government's work is God's work" },
  { name: 'MG Road', ...geoBox(12.9822, 77.5965, 12.9640, 77.6120), ground: '#c4b8a2', mus: 'city', trees: [['rain', 2], ['pink', 1]], density: 14000, blurb: 'Boulevard, churches and Brigade Road' },
  { name: 'Chinnaswamy Stadium', ...geoBox(12.9800, 77.5985, 12.9762, 77.6040), ground: '#77a34c', mus: 'city', trees: [['rain', 3], ['gulmohar', 1]], density: 9000, blurb: 'Home of RCB. Ee sala cup namde!' },
  { name: 'Cubbon Park', poly: gpoly([[12.9748, 77.5872], [12.9783, 77.5902], [12.9783, 77.5958], [12.9800, 77.5966], [12.9768, 77.5980], [12.9705, 77.5928], [12.9674, 77.5880]]), ground: '#659843', mus: 'city', trees: [['rain', 5], ['pink', 3], ['bamboo', 1], ['gulmohar', 2]], density: 3600, blurb: 'Three hundred acres of green, since 1870' },
  { name: 'Chickpet', ...geoBox(12.9720, 77.5655, 12.9640, 77.5830), ground: '#c2b8a4', mus: 'city', trees: [['rain', 1], ['coconut', 1]], density: 22000, blurb: 'Silk, steel and a thousand tiny shops' },
  { name: 'K.R. Market', ...geoBox(12.9640, 77.5700, 12.9565, 77.5830), ground: '#c4b496', mus: 'city', trees: [['rain', 1], ['coconut', 1]], density: 20000, blurb: 'Flowers by the tonne, and the old fort' },
  { name: 'Richmond Town', ...geoBox(12.9640, 77.5900, 12.9480, 77.6120), ground: '#bdb391', mus: 'city', trees: [['rain', 4], ['gulmohar', 1], ['pink', 1]], verges: true, blurb: 'Quiet lanes and old bungalows' },
  { name: 'Chamarajpet', ...geoBox(12.9565, 77.5560, 12.9470, 77.5795), ground: '#b9b08a', mus: 'city', trees: [['rain', 3], ['coconut', 2]], verges: true, blurb: 'The cave temple of Gavipuram' },
  { name: 'Basavanagudi', ...geoBox(12.9470, 77.5560, 12.9330, 77.5795), ground: '#b9b08a', mus: 'city', trees: [['rain', 3], ['coconut', 2], ['pink', 1]], verges: true, density: 9000, blurb: 'The Bull Temple and Gandhi Bazaar' },
  { name: 'Lalbagh', poly: gpoly([[12.9545, 77.5832], [12.9545, 77.5872], [12.9508, 77.5915], [12.9447, 77.5908], [12.9445, 77.5832], [12.9488, 77.5808]]), ground: '#70a548', mus: 'city', trees: [['rain', 4], ['pink', 3], ['royal', 2], ['gulmohar', 2]], density: 3600, blurb: "Hyder Ali's garden, with a glass house" },
  { name: 'Wilson Garden', ...geoBox(12.9480, 77.5920, 12.9380, 77.6060), ground: '#bdb391', mus: 'city', trees: [['rain', 3], ['coconut', 2]], verges: true, blurb: 'Between the garden and the start-ups' },
  { name: 'Jayanagar', ...geoBox(12.9380, 77.5760, 12.9190, 77.5960), ground: '#cfc5b0', mus: 'city', trees: [['pink', 3], ['coconut', 1], ['rain', 1]], verges: true, density: 9000, blurb: 'Pink blossoms on a planned suburb' },
  { name: 'Koramangala', ...geoBox(12.9460, 77.6060, 12.9240, 77.6420), ground: '#c4b8a2', mus: 'city', trees: [['rain', 2], ['pink', 1], ['coconut', 1]], verges: true, blurb: 'Start-ups, cafes and a lot of laptops' },
  { name: 'BTM Layout', ...geoBox(12.9240, 77.5960, 12.9070, 77.6195), ground: '#c2b8a4', mus: 'city', trees: [['rain', 2], ['coconut', 1]], verges: true, blurb: 'Under the double-decker flyover' },
  { name: 'Silk Board', ...geoBox(12.9240, 77.6195, 12.9070, 77.6340), ground: '#c2b8a4', mus: 'city', trees: [['rain', 1]], density: 30000, blurb: 'Famous for its traffic. Pack snacks.' },
];

// ---------------------------------------------------------------------------
// Roads. Each is a polyline of points given as [lat, lon] (or [x, y] in
// world pixels); `small` streets are narrower.
// ew() and ns() make straight east-west and north-south roads.
// ---------------------------------------------------------------------------
const ew = (name, lat, lon0, lon1, o = {}) => ({ name, pts: [[lonX(lon0), latY(lat)], [lonX(lon1), latY(lat)]], w: o.small ? 20 : 28, ...o });
const ns = (name, lon, lat0, lat1, o = {}) => ({ name, pts: [[lonX(lon), latY(lat0)], [lonX(lon), latY(lat1)]], w: o.small ? 20 : 28, ...o });
const pl = (name, pts, o = {}) => ({ name, pts: pts.map(p => (p[0] < 20 ? [lonX(p[1]), latY(p[0])] : p)), w: o.small ? 20 : 28, ...o });
// Junctions shared by several roads, and the latitudes of the main east-west roads.
const JN = {
  anandRao: [12.9800, 77.5772], chalukya: [12.9855, 77.5872], krCircle: [12.9748, 77.5862], mysoreBank: [12.9756, 77.5805],
  hudson: [12.9668, 77.5866], queensCircle: [12.9768, 77.5990], queensStatue: [12.9805, 77.5975], richmond: [12.9655, 77.5995],
  dairy: [12.9375, 77.5995], silkBoard: [12.9168, 77.6235], trinity: [12.9748, 77.6185], halasuru: [12.9757, 77.6300],
};
const LATS = { mg: 12.9748, kg: 12.9756, ambedkar: 12.9787, orr: 12.9168, cmh: 12.9786, oldMadras: 12.9757, rail: 12.9819 };
const B_ROADS = [
  // Majestic, the old city and the west.
  ew('Magadi Road', LATS.kg, 77.524, 77.5655),
  ew('Kempegowda Road', LATS.kg, 77.5655, 77.5805),
  pl('Seshadri Road', [JN.anandRao, JN.krCircle]),
  pl('Race Course Road', [JN.anandRao, JN.chalukya]),
  pl('Palace Road', [JN.mysoreBank, [12.9790, 77.5826], JN.chalukya]),
  ns('Avenue Road', 77.5790, LATS.kg, 12.9640),
  pl('Mysore Road', [[12.9640, 77.5745], [12.9600, 77.5660], [12.9535, 77.5440], [12.9522, 77.5373], [12.9465, 77.5298], [12.9430, 77.5245]]),
  ns('K.R. Road', 77.5745, LATS.kg, 12.9418),
  ns('Kanakapura Road', 77.5745, 12.9418, 12.907),
  ns('Sampige Road', 77.5712, 13.0110, 12.9870),
  ns('Margosa Road', 77.5675, 13.0110, 12.9905, { small: true }),
  ew('8th Cross, Malleswaram', 12.9995, 77.5590, 77.5712, { small: true }),
  ew('15th Cross, Malleswaram', 13.0045, 77.5590, 77.5712, { small: true }),
  ew('18th Cross, Malleswaram', 13.0110, 77.5590, 77.5712, { small: true }),
  // Out west: Yeshwanthpur, Rajajinagar, Vijayanagar. Chord Road carries the
  // Green Line north to Yeshwanthpur and, further south, the Purple Line.
  pl('Chord Road', [[13.0262, 77.5497], [12.9800, 77.5497], [LATS.kg, 77.5373], [12.9440, 77.5373]]),
  pl('Tumkur Road', [[13.0232, 77.5497], [13.0268, 77.5430]]),
  pl('Dr. Rajkumar Road', [[12.9905, 77.5590], [13.0200, 77.5590], [13.0232, 77.5497]]),
  ew('Mathikere Main Road', 13.0200, 77.5590, 77.5855),
  ns('West of Chord Road', 77.5420, 13.0262, LATS.kg),
  ew('Rajajinagar Main Road', 12.9905, 77.524, 77.5590),
  ew('Vijayanagar Main Road', 12.9660, 77.524, 77.5455, { small: true }),
  pl('Sankey Road', [[13.0010, 77.5855], [13.0010, 77.5790], [13.0045, 77.5712]]),
  ns('Bellary Road', 77.5855, 13.0275, JN.chalukya[0]),
  ew('Chickpet Main Road', 12.9690, 77.5655, 77.5790, { small: true }),
  // Vidhana Soudha, Cubbon Park and the Cantonment.
  pl('Dr. Ambedkar Veedhi', [JN.krCircle, [LATS.ambedkar, 77.5885], [LATS.ambedkar, 77.5955], JN.queensStatue]),
  ns('Nrupathunga Road', 77.5866, JN.krCircle[0], JN.hudson[0]),
  pl('Kasturba Road', [JN.queensCircle, [12.9705, 77.5935], JN.hudson]),
  ns('Queens Road', 77.5975, JN.queensCircle[0], 12.9915),
  ew('Cubbon Road', JN.queensStatue[0], 77.5975, 77.6062),
  ew('Infantry Road', 12.9826, 77.5975, 77.6062),
  pl('Cunningham Road', [[12.9858, 77.5918], [12.9880, 77.5975]]),
  ew('Jayamahal Road', 12.9915, 77.5855, 77.6062),
  ns('Kamaraj Road', 77.6062, LATS.mg, 13.0135),
  ew('Commercial Street', 12.9822, 77.6062, 77.6120, { small: true }),
  ew('Russell Market Road', 12.9838, 77.6005, 77.6120, { small: true }),
  // MG Road, Ulsoor, Indiranagar.
  pl('MG Road', [JN.queensCircle, [LATS.mg, 77.6000], JN.trinity]),
  pl('Old Madras Road', [JN.trinity, [LATS.oldMadras, 77.6205], JN.halasuru, [12.9895, 77.6492]]),
  ew('Kensington Road', 12.9768, 77.6120, 77.6205, { small: true }),
  ns('Dickenson Road', 77.6120, LATS.mg, 12.9900),
  pl('CMH Road', [JN.halasuru, [LATS.cmh, 77.6300], [LATS.cmh, 77.6492]]),
  ns('100 Feet Road, Indiranagar', 77.6405, LATS.cmh, 12.9550),
  ns('Swami Vivekananda Road', 77.6449, LATS.cmh, 12.9895),
  ns('Brigade Road', 77.6078, LATS.mg, JN.richmond[0], { small: true }),
  ew('Church Street', 12.9728, 77.6010, 77.6078, { small: true }),
  ns("St. Mark's Road", 77.6010, LATS.mg, 12.9690, { small: true }),
  pl('Residency Road', [JN.richmond, [12.9690, 77.6010], [12.9690, 77.6120]]),
  ew('Richmond Road', JN.richmond[0], 77.5995, 77.6120),
  // Lalbagh and the south.
  ns('Lalbagh Road', 77.5866, JN.hudson[0], 12.9545),
  pl('J.C. Road', [[12.9636, 77.5866], [12.9590, 77.5815], [12.9565, 77.5745]]),
  ns('R.V. Road', 77.5803, 12.9488, 12.907),
  ns('Bull Temple Road', 77.5695, 12.9565, 12.9360),
  ew('Gandhi Bazaar Main Road', 12.9455, 77.5695, 77.5745, { small: true }),
  ew('Lalbagh Double Road', 12.9440, 77.5803, 77.5995),
  pl('Hosur Road', [JN.richmond, JN.dairy, [12.9347, 77.6113], [12.9230, 77.6235], JN.silkBoard, [12.907, 77.6235]]),
  ew('Outer Ring Road', LATS.orr, 77.5803, 77.6235),
  pl('Outer Ring Road, HSR', [JN.silkBoard, [12.9230, 77.6300], [12.9230, 77.6492]]),
  ns('11th Main, Jayanagar', 77.5880, 12.9440, LATS.orr, { small: true }),
  ew('30th Cross, Jayanagar', 12.9270, 77.5803, 77.5995, { small: true }),
  ew('9th Cross, Jayanagar', 12.9330, 77.5803, 77.5995, { small: true }),
  ns('Bannerghatta Road', 77.5995, JN.dairy[0], LATS.orr),
  ew('80 Feet Road, Koramangala', 12.9365, 77.6113, 77.6267),
  ns('Inner Ring Road', 77.6267, 12.9365, 12.9690),
  ew('1st Main, Koramangala', 12.9300, 77.6150, 77.6267, { small: true }),
];

// The railway runs in from the west, behind KSR Bengaluru City, to its platforms.
const RAIL_Y = latY(LATS.rail);
const B_RAIL = { y: RAIL_Y, x0: 0, x1: lonX(77.5694) + 240 };
const B_PLATFORMS = [{ x: lonX(77.5694) - 240, y: RAIL_Y + 8, w: 480, h: 32, edge: 'top' }];
// Where an incoming train's engine stops, at the east end of the platform.
const B_TRAIN_STOP = lonX(77.5694) + 190;

const B_LAKES = [
  { name: 'Sankey Tank', ...geo(13.0085, 77.5754), rx: 190, ry: 66, islands: [{ ...geo(13.0088, 77.5732), rx: 26, ry: 11 }] },
  { name: 'Ulsoor Lake', ...geo(12.9822, 77.6190), rx: 230, ry: 165, islands: [{ ...geo(12.9832, 77.6168), rx: 40, ry: 22 }, { ...geo(12.9812, 77.6215), rx: 30, ry: 16 }] },
  { name: 'Lalbagh Lake', ...geo(12.9462, 77.5850), rx: 120, ry: 60 },
];
const B_STADIUM = { ...geo(12.9781, 77.6016), rx: 150, ry: 104, irx: 100, iry: 62 };
const B_TRACK = { ...geo(12.9868, 77.5822), rx: 235, ry: 150, w: 22 };
const B_CIRCLES = [{ name: 'South End Circle', ...geo(12.9372, 77.5803), r: 46, garden: 18 }];
const B_CLOCK = { ...geo(12.9533, 77.5848), r: 24 };   // Lalbagh's flower clock
const B_JAM = { ...geo(12.9240, 77.6170), w: 640, h: 330 };   // Silk Board, where traffic crawls

// Paved squares and forecourts (`col` for a plain fill), striped lawns, flower beds.
const B_PLAZAS = [
  { ...geo(LATS.mg, 77.6000, 0, -40), w: lonX(77.6185) - lonX(77.6000), h: 16 },
  { ...geo(12.9822, 77.6062, 0, 16), w: lonX(77.6120) - lonX(77.6062), h: 30 },
];
const B_LAWNS = [geoBox(12.9822, 77.5865, 12.9795, 77.5965), geoBox(13.0030, 77.5880, 12.9918, 77.5985)];
const B_FLOWERBEDS = [
  [12.9775, 77.5915], [12.9770, 77.5945], [12.9745, 77.5905], [12.9720, 77.5910],
  [12.9525, 77.5835], [12.9525, 77.5866], [12.9495, 77.5880], [12.9478, 77.5825],
  [12.9945, 77.5905], [12.9945, 77.5950], [12.9878, 77.5925], [12.9860, 77.5948],
].map(([lat, lon]) => { const p = geo(lat, lon); return [p.x, p.y]; });
// Laterite paths through the parks.
const gpath = (a, b, w = 9) => { const p = geo(...a), q = geo(...b); return { x0: p.x, y0: p.y, x1: q.x, y1: q.y, w }; };
const B_PATHS = [
  gpath([12.9762, 77.5888], [12.9762, 77.5962]),
  gpath([12.9779, 77.5930], [12.9690, 77.5898]),
  gpath([12.9745, 77.5878], [12.9782, 77.5955], 8),
  gpath([12.9722, 77.5890], [12.9722, 77.5930], 8),
  gpath([12.9542, 77.5852], [12.9452, 77.5852]),
  gpath([12.9495, 77.5808], [12.9495, 77.5905]),
  gpath([12.9520, 77.5830], [12.9465, 77.5888], 8),
  gpath([12.9935, 77.5905], [12.9935, 77.5975], 8),
  gpath([12.9858, 77.5900], [12.9828, 77.5960], 8),
  gpath([13.0058, 77.5735], [13.0058, 77.5790], 8),
  gpath([12.9798, 77.6140], [12.9798, 77.6240], 8),
];
// Rows of trees along avenues: pink tabebuias in Jayanagar and Cubbon Park,
// royal palms in Lalbagh.
const B_TREE_ROWS = [
  ...[12.9330, 12.9270].flatMap(lat => [-24, 26].map(dy => ({ kind: 'pink', x0: lonX(77.5815), y0: latY(lat) + dy, x1: lonX(77.5990), y1: latY(lat) + dy, step: 40, zig: dy > 0 ? 20 : 0, force: true, spacing: 22 }))),
  { kind: 'pink', x0: lonX(77.5880) - 20, y0: latY(12.9435), x1: lonX(77.5880) - 20, y1: latY(12.9180), step: 44, force: true, spacing: 22 },
  { kind: 'pink', x0: lonX(77.5888), y0: latY(12.9762) - 12, x1: lonX(77.5962), y1: latY(12.9762) - 12, step: 34, spacing: 20 },
  { kind: 'pink', x0: lonX(77.5888) + 17, y0: latY(12.9762) + 14, x1: lonX(77.5962), y1: latY(12.9762) + 14, step: 34, spacing: 20 },
  { kind: 'royal', x0: lonX(77.5852) - 20, y0: latY(12.9528), x1: lonX(77.5852) - 20, y1: latY(12.9470), step: 46, spacing: 20 },
  { kind: 'royal', x0: lonX(77.5852) + 20, y0: latY(12.9528), x1: lonX(77.5852) + 20, y1: latY(12.9470), step: 46, spacing: 20 },
];

// ---------------------------------------------------------------------------
// Namma Metro, after the real routes. Points marked 'u' start a stretch that
// runs underground: the Purple Line from just east of Magadi Road to Cubbon
// Park, the Green Line from south of Mantri Square to K.R. Market. Elevated
// stretches follow the road below them, straightened where the real line
// bends (the Purple Line out to Mysore Road, the Green Line up Chord Road to
// Yeshwanthpur). Stations sit at their real places, moved onto the line where
// it has been straightened; `exit` is the street-level entrance for the ones
// underground.
// ---------------------------------------------------------------------------
const yMG = latY(LATS.mg), yKG = latY(LATS.kg), yORR = latY(LATS.orr), yAmb = latY(LATS.ambedkar);
const xRV = lonX(77.5803), xKR = lonX(77.5745), xSampige = lonX(77.5712), xHosur = lonX(77.6235);
const yRajkumar = latY(12.9975), yFort = latY(12.9490);
const xChord = lonX(77.5497), xVijay = lonX(77.5373), yMysore = latY(12.9465);
const B_LINES = {
  purple: {
    name: 'Purple Line', col: '#8a4fb8', dark: '#5b2f80', light: '#c9a3e6',
    pts: [[lonX(77.5266), yMysore], [xVijay, yMysore], [xVijay, yKG], [lonX(77.5620), yKG, 'u'], [lonX(77.5657), yKG, 'u'], [lonX(77.5728), yKG, 'u'], [lonX(77.5840), latY(12.9741), 'u'], [lonX(77.5927), yAmb, 'u'], [lonX(77.5969), latY(12.9811), 'u'],
      [lonX(77.6000), yMG], [lonX(77.6205), yMG], [lonX(77.6205), latY(LATS.oldMadras)], [lonX(77.6300), latY(LATS.oldMadras)], [lonX(77.6300), latY(LATS.cmh)], [lonX(77.6449), latY(LATS.cmh)], [lonX(77.6449), latY(12.9880)]],
    stations: [
      { id: 'mysoreroad', name: 'Mysore Road', x: lonX(77.5298), y: yMysore },
      { id: 'deepanjali', name: 'Deepanjali Nagar', x: xVijay, y: latY(12.9522) },
      { id: 'attiguppe', name: 'Attiguppe', x: xVijay, y: latY(12.9620) },
      { id: 'vijayanagar', name: 'Vijayanagar', x: xVijay, y: latY(12.9708) },
      { id: 'hosahalli', name: 'Hosahalli', x: lonX(77.5455), y: yKG },
      { id: 'magadi', name: 'Magadi Road', x: lonX(77.5554), y: yKG },
      { id: 'cityrail', name: 'City Railway Station', x: lonX(77.5657), y: yKG, exit: [lonX(77.5657), yKG - 22] },
      { id: 'majestic', name: 'Majestic', x: lonX(77.5728), y: yKG, exit: [lonX(77.5728) + 16, yKG - 22] },
      { id: 'visvesvaraya', name: 'Sir M. Visvesvaraya', x: lonX(77.5840), y: latY(12.9741), exit: [lonX(77.5862) - 36, latY(LATS.mg) + 4] },
      { id: 'vidhana', name: 'Vidhana Soudha', x: lonX(77.5927), y: yAmb, exit: [lonX(77.5888) - 30, yAmb + 24] },
      { id: 'cubbon', name: 'Cubbon Park', x: lonX(77.5969), y: latY(12.9811), exit: [lonX(77.5990), latY(LATS.ambedkar) - 4] },
      { id: 'mgroad', name: 'MG Road', x: lonX(77.6068), y: yMG },
      { id: 'trinity', name: 'Trinity', x: lonX(77.6170), y: yMG },
      { id: 'halasuru', name: 'Halasuru', x: lonX(77.6263), y: latY(LATS.oldMadras) },
      { id: 'indiranagar', name: 'Indiranagar', x: lonX(77.6388), y: latY(LATS.cmh) },
      { id: 'svroad', name: 'Swami Vivekananda Road', x: lonX(77.6449), y: latY(12.9860) },
    ],
  },
  green: {
    name: 'Green Line', col: '#3fa34d', dark: '#24702f', light: '#9fdc8f',
    pts: [[xChord, latY(13.0262)], [xChord, yRajkumar], [xSampige, yRajkumar], [xSampige, latY(12.9872), 'u'], [lonX(77.5728), yKG, 'u'], [lonX(77.5748), latY(12.9668), 'u'], [xKR, latY(12.9614), 'u'],
      [xKR, latY(12.9575)], [xKR, yFort], [xRV, yFort], [xRV, yORR], [xKR, yORR], [xKR, latY(12.9128)]],
    stations: [
      { id: 'yeshwanthpur', name: 'Yeshwanthpur', x: xChord, y: latY(13.0232) },
      { id: 'sandalsoap', name: 'Sandal Soap Factory', x: xChord, y: latY(13.0147) },
      { id: 'mahalakshmi', name: 'Mahalakshmi', x: xChord, y: latY(13.0082) },
      { id: 'rajajinagar', name: 'Rajajinagar', x: xChord, y: latY(13.0003) },
      { id: 'kuvempu', name: 'Kuvempu Road', x: lonX(77.5570), y: yRajkumar },
      { id: 'srirampura', name: 'Srirampura', x: lonX(77.5633), y: yRajkumar },
      { id: 'sampige', name: 'Mantri Square Sampige Road', x: xSampige, y: latY(12.9905) },
      { id: 'majestic', name: 'Majestic', x: lonX(77.5728), y: yKG },
      { id: 'chickpete', name: 'Chickpete', x: lonX(77.5748), y: latY(12.9668), exit: [lonX(77.5748) + 30, latY(12.9668)] },
      { id: 'krmarket', name: 'K.R. Market', x: xKR, y: latY(12.9614), exit: [xKR + 28, latY(12.9614) + 10] },
      { id: 'national', name: 'National College', x: xKR, y: latY(12.9505) },
      { id: 'lalbagh', name: 'Lalbagh', x: xRV, y: latY(12.9464) },
      { id: 'southend', name: 'South End Circle', x: xRV, y: latY(12.9388) },
      { id: 'jayanagar', name: 'Jayanagar', x: xRV, y: latY(12.9298) },
      { id: 'rvroad', name: 'R.V. Road', x: xRV, y: latY(12.9215) },
      { id: 'banashankari', name: 'Banashankari', x: xKR, y: latY(12.9152) },
    ],
  },
  yellow: {
    name: 'Yellow Line', col: '#e3b21f', dark: '#9c7a12', light: '#ffe27a',
    pts: [[xRV, latY(12.9215)], [lonX(77.5840), latY(12.9215)], [lonX(77.5840), yORR], [xHosur, yORR], [xHosur, latY(12.9075)]],
    stations: [
      { id: 'rvroad', name: 'R.V. Road', x: xRV, y: latY(12.9215) },
      { id: 'ragigudda', name: 'Ragigudda', x: lonX(77.5884), y: yORR },
      { id: 'jayadeva', name: 'Jayadeva Hospital', x: lonX(77.6001), y: yORR },
      { id: 'btm', name: 'BTM Layout', x: lonX(77.6083), y: yORR },
      { id: 'silkboard', name: 'Central Silk Board', x: lonX(77.6195), y: yORR },
      { id: 'bommanahalli', name: 'Bommanahalli', x: xHosur, y: latY(12.9107) },
    ],
  },
};

// ---------------------------------------------------------------------------
// Landmarks, each at its real place with its postcard. landmark() takes the sprite,
// the latitude and longitude of its middle and { fw, fd } (footprint), dx/dy
// nudges, minimap colour, signs (x, y relative to the sprite, or an anchor)
// and the postcard: name, fact (short and true), and where it is if not just
// in front of the door. Landmarks with a postcard (or `icon`) stand on the
// skyline seen from the metro, named.
// ---------------------------------------------------------------------------
const B_BUILDINGS = [];
const B_POSTCARDS = [];
function landmark(spr, lat, lon, o) {
  const p = geo(lat, lon, o.dx || 0, o.dy || 0);
  const b = { spr, x: p.x, y: p.y + Math.round(o.fd / 2), fw: o.fw, fd: o.fd, mcol: o.mcol === undefined ? '#e9e2d4' : o.mcol, ...(o.signs ? { signs: o.signs } : {}), ...(o.island ? { island: true } : {}) };
  if (o.pc || o.icon) { b.icon = true; b.name = o.pc ? o.pc.name : o.icon; }
  B_BUILDINGS.push(b);
  if (o.pc) B_POSTCARDS.push({ id: o.pc.id || spr, name: o.pc.name, x: b.x + (o.pc.dx || 0), y: b.y + (o.pc.dy === undefined ? 16 : o.pc.dy), r: o.pc.r || 60, fact: o.pc.fact });
  return b;
}
// A postcard for a place without a building of its own.
const place = (id, name, lat, lon, fact, o = {}) => B_POSTCARDS.push({ id, name, ...geo(lat, lon, o.dx || 0, o.dy || 0), r: o.r || 60, fact, ...(o.ride ? { ride: true } : {}) });
const signAt = (text, x, y, size, color = '#ffffff', outline) => ({ x, y, text, size, color, ...(outline === null ? { outline: null } : {}) });

// North-west: Yeshwanthpur and Rajajinagar. ISKCON stands just east of Chord
// Road; WTC and Orion Mall make up Brigade Gateway on Dr. Rajkumar Road.
landmark('iskcon', 13.0098, 77.5512, { dx: 44, fw: 140, fd: 70, mcol: '#f2e2b8', pc: { name: 'ISKCON Temple', fact: 'The Hare Krishna temple on its hill, opened in 1997 by President Shankar Dayal Sharma. Its tower is gold and glass.', r: 70 } });
landmark('wtc', 13.0132, 77.5572, { fw: 70, fd: 40, mcol: '#5f7f9f', pc: { name: 'World Trade Center', fact: 'WTC Bengaluru at Brigade Gateway, one of the tallest towers in the city.', r: 50 } });
landmark('orion', 13.0112, 77.5555, { dx: 47, fw: 140, fd: 40, mcol: '#c9d6e0', signs: [{ anchor: 'sign', text: 'ORION MALL', size: 4.4, color: '#ffffff' }], pc: { name: 'Orion Mall', fact: 'A big mall at Brigade Gateway, with a lake out the back.', r: 50 } });

// North: Malleswaram, the Palace, the Cantonment.
landmark('malleshwara', 13.0050, 77.5714, { dx: 66, dy: -10, fw: 88, fd: 38, mcol: '#e8dcc0', pc: { id: 'malleswaram', name: 'Kadu Malleshwara Temple', fact: 'A 17th-century Shiva temple that gave Malleswaram its name.' } });
landmark('tiffin', 12.9985, 77.5690, { dy: -6, fw: 70, fd: 26, mcol: '#f2e6c8', signs: [{ anchor: 'sign', text: 'CTR', size: 4.4, color: '#ffffff' }], pc: { id: 'ctr', name: 'CTR, Malleswaram', fact: 'Central Tiffin Room: butter-soaked benne masala dosa since the 1920s.', r: 44 } });
landmark('palace', 12.9986, 77.5920, { fw: 320, fd: 60, mcol: '#d8cfbd', pc: { name: 'Bangalore Palace', fact: "The Wodeyars' palace, built in Tudor style and said to be modelled on Windsor Castle." } });
landmark('cantonment', 12.9937, 77.5980, { fw: 148, fd: 40, mcol: '#efe0bf', signs: [{ anchor: 'sign', text: 'BENGALURU CANTONMENT', size: 3.2, color: '#ffffff' }], pc: { name: 'Cantonment Station', fact: 'Trains have run from here since 1864, when the Madras Railway opened its line.' } });
landmark('stmarys', 12.9843, 77.6046, { dy: -4, fw: 104, fd: 48, mcol: '#efe7d8', pc: { name: "St. Mary's Basilica", fact: "One of Bengaluru's oldest churches; in 1973 it became Karnataka's first minor basilica." } });
landmark('russell', 12.9852, 77.6085, { fw: 132, fd: 40, mcol: '#cbb48c', signs: [{ anchor: 'sign', text: 'RUSSELL MARKET', size: 3.4, color: '#ffe7a8' }], pc: { name: 'Russell Market', fact: 'Built in 1927 and named after T.B. Russell, a municipal commissioner.' } });
landmark('gurudwara', 12.9790, 77.6158, { fw: 70, fd: 24, mcol: '#f2efe6', icon: 'Gurudwara' });
landmark('someshwara', 12.9754, 77.6242, { dy: -95, fw: 96, fd: 40, mcol: '#bdb8ac', pc: { name: 'Someshwara Temple', fact: 'One of the oldest temples in the city, enlarged under Kempe Gowda in Vijayanagara times.' } });

// Race Course, Vidhana Soudha, Cubbon Park.
landmark('planetarium', 12.9847, 77.5895, { dy: 10, fw: 70, fd: 36, mcol: '#f4f1ea', signs: [{ anchor: 'sign', text: 'PLANETARIUM', size: 3.2, color: '#ffffff' }], pc: { name: 'Nehru Planetarium', fact: 'Opened in 1989; under its 15 metre dome, 210 people watch the stars at noon.', r: 50 } });
landmark('grandstand', 12.9842, 77.5822, { fw: 216, fd: 30, mcol: '#e9e2d4', icon: 'Race Course', signs: [signAt('BANGALORE TURF CLUB', 110, 43, 3.6)] });
landmark('holidayinn', 12.9815, 77.5780, { dy: -2, fw: 96, fd: 46, mcol: '#e9dfcc', signs: [signAt('HOLIDAY INN', 55, 26, 4.4)], pc: { name: 'Holiday Inn, Race Course Rd', fact: 'A hotel with the racetrack for a neighbour. Room service comes with hoofbeats.', r: 46 } });
landmark('vidhana', 12.9799, 77.5906, { fw: 356, fd: 60, mcol: '#efe6d2', signs: [{ anchor: 'inscription', text: "GOVERNMENT'S WORK IS GOD'S WORK", size: 3, color: '#3a2a1a', outline: null }], pc: { name: 'Vidhana Soudha', fact: "Karnataka's legislature, finished in 1956 in Bangalore granite. Over the door: Government's Work is God's Work.", r: 70, dy: 14 } });
landmark('highcourt', 12.9778, 77.5925, { dy: 46, fw: 232, fd: 56, mcol: '#c0473c', pc: { name: 'Karnataka High Court', fact: 'Attara Kacheri, the "eighteen offices". The red building (1868) faces Vidhana Soudha.' } });
landmark('library', 12.9738, 77.5928, { dx: -34, fw: 104, fd: 36, mcol: '#c0473c', pc: { name: 'State Central Library', fact: 'Seshadri Iyer Memorial Hall, the red building in Cubbon Park, holds the State Central Library.', r: 50 } });
landmark('bandstand', 12.9752, 77.5948, { fw: 30, fd: 12, mcol: '#efe7da', pc: { id: 'cubbon', name: 'Cubbon Park', fact: 'Laid out in 1870. Its official name is Sri Chamarajendra Park. Morning walkers: countless.' } });
landmark('govmuseum', 12.9764, 77.5958, { fw: 126, fd: 36, mcol: '#b8483d', pc: { name: 'Government Museum', fact: "Founded in 1865, one of India's oldest museums; the red building opened in 1877.", r: 50 } });
landmark('museum', 12.9741, 77.5946, { fw: 160, fd: 40, mcol: '#d9c7a2', signs: [signAt('VISVESVARAYA MUSEUM', 85, 12, 3.4)], pc: { name: 'Visvesvaraya Museum', fact: "Named after Sir M. Visvesvaraya, the engineer whose birthday is India's Engineers' Day.", r: 50 } });
landmark('ubcity', 12.9709, 77.5978, { dx: 5, fw: 180, fd: 70, mcol: '#7fa6c4', signs: [signAt('UB CITY', 95, 188, 5, '#ffe7a8')], pc: { name: 'UB City', fact: 'Glass towers and a luxury mall on Vittal Mallya Road.' } });

// Kingfisher Towers: really on the Kasturba Road side of UB City, where the
// towers would hide the road, so here they stand on its east side.
landmark('kingfisher', 12.9722, 77.5956, { dx: 324, dy: 116, fw: 92, fd: 40, mcol: '#e9eef2', pc: { name: 'Kingfisher Towers', fact: 'Luxury towers on Kasturba Road, with a white mansion of a penthouse on the roof.', r: 50 } });

// MG Road, Brigade Road, the Cantonment churches.
landmark('stmarks', 12.9733, 77.6019, { dy: -1, fw: 110, fd: 44, mcol: '#f2efe6', pc: { name: "St. Mark's Cathedral", fact: "One of the city's oldest churches, consecrated in 1816 at the top of MG Road.", r: 50 } });
landmark('hardrock', 12.9692, 77.5999, { fw: 86, fd: 34, mcol: '#9a948a', signs: [{ anchor: 'sign', text: 'HARD ROCK CAFE', size: 3.4, color: '#ffffff' }], pc: { name: 'Hard Rock Cafe', fact: "On St. Mark's Road, a short walk from MG Road. Guitars on the walls, music all night.", r: 45 } });
landmark('mayohall', 12.9724, 77.6105, { fw: 118, fd: 40, mcol: '#f1e8d6', pc: { name: 'Mayo Hall', fact: 'Built to honour Viceroy Lord Mayo; its upper floor has held the Kempegowda Museum since 2011.', r: 50 } });

// Majestic, Gandhinagar, Chickpet, K.R. Market.
landmark('ksrcanopy', 12.9783, 77.5694, { dy: -255, fw: 0, fd: 0, mcol: null });
landmark('ksr', 12.9783, 77.5694, { fw: 290, fd: 60, mcol: '#efe2c0', signs: [signAt('KSR BENGALURU CITY', 150, 46.5, 4)], pc: { name: 'KSR Bengaluru City', fact: "Krantivira Sangolli Rayanna station, the city's main railway terminus.", dy: 22 } });
landmark('busstand', 12.9768, 77.5726, { dx: 60, dy: -4, fw: 270, fd: 50, mcol: '#c9c2b6', signs: [signAt('KEMPEGOWDA BUS STATION', 140, 6.5, 3.8)], pc: { name: 'Kempegowda Bus Station', fact: 'Majestic: buses to everywhere, all leaving at once.', dy: 20 } });
landmark('freedom', 12.9744, 77.5828, { fw: 200, fd: 50, mcol: '#a89a80', signs: [signAt('FREEDOM PARK', 105, 62, 3.6)], pc: { id: 'freedompark', name: 'Freedom Park', fact: 'Once the Central Jail, now a park for concerts and protests.' } });
landmark('townhall', 12.9640, 77.5853, { dx: -26, fw: 160, fd: 50, mcol: '#ece6d8', signs: [signAt('TOWN HALL', 85, 21, 3.6, '#3a3530', null)], pc: { name: 'Town Hall', fact: 'Sir Puttanna Chetty Town Hall (1935), with its tall columns and wide steps.', r: 50 } });
landmark('krmarket', 12.9648, 77.5770, { fw: 220, fd: 40, mcol: '#e3c06a', signs: [signAt('K.R. MARKET', 115, 7, 4.2)], pc: { name: 'K.R. Market', fact: 'City Market, built in 1928: flowers, fruit and plenty of noise.' } });
landmark('fort', 12.9628, 77.5752, { dx: 60, dy: 40, fw: 96, fd: 24, mcol: '#a8a090', pc: { name: 'Bangalore Fort', fact: 'Kempegowda built it in mud in 1537; Hyder Ali rebuilt it in stone. The Delhi Gate still stands.', r: 50 } });
landmark('tipu', 12.9595, 77.5739, { dx: -90, fw: 180, fd: 40, mcol: '#c99a5e', pc: { name: "Tipu Sultan's Summer Palace", fact: 'Finished in 1791 and built almost entirely of teak.' } });
landmark('cinema', 12.9745, 77.5760, { dy: 6, fw: 100, fd: 40, mcol: '#d8433b', signs: [signAt('CINEMA', 55, 9, 5, '#ffe7a8')] });

// Basavanagudi, Lalbagh, Jayanagar.
landmark('gavi', 12.9481, 77.5630, { fw: 124, fd: 44, mcol: '#a8a397', pc: { name: 'Gavi Gangadhareshwara', fact: "At Makara Sankranti, sunset light passes between the stone Nandi's horns to the cave's linga." } });
landmark('bulltemple', 12.9429, 77.5682, { fw: 96, fd: 40, mcol: '#d9cfb8', pc: { name: 'Bull Temple', fact: 'Dodda Basavana Gudi: a granite Nandi about 4.6 metres tall, from the 1500s.' } });
landmark('buglerock', 12.9430, 77.5695, { dx: 76, dy: 10, fw: 100, fd: 34, mcol: '#9c9a94', pc: { name: 'Bugle Rock', fact: 'A Kempegowda watchtower stands on this rock in Basavanagudi.' } });
landmark('vidyarthi', 12.9455, 77.5713, { dy: -26, fw: 60, fd: 20, mcol: '#2f6b3a', signs: [signAt('VIDYARTHI BHAVAN', 32, 8, 3)], pc: { name: 'Vidyarthi Bhavan', fact: 'Crisp masala dosas in Gandhi Bazaar since 1943.', r: 40, dy: 14 } });
landmark('mtr', 12.9555, 77.5854, { dx: -50, fw: 58, fd: 22, mcol: '#efe7da', signs: [signAt('MTR  1924', 32, 9, 4, '#2f6b3a', null)], pc: { name: 'MTR, Lalbagh Road', fact: 'Mavalli Tiffin Rooms, serving since 1924. Rava idli was invented here when rice ran short in the war.', r: 40 } });
landmark('glasshouse', 12.9512, 77.5853, { fw: 200, fd: 46, mcol: '#bfe3e8', pc: { name: 'Lalbagh Glass House', fact: "Built in 1889, inspired by London's Crystal Palace. Flower shows every January and August.", r: 70 } });
landmark('rock', 12.9488, 77.5890, { fw: 100, fd: 34, mcol: '#9c9a94', pc: { name: 'Lalbagh Rock', fact: 'Some of the oldest rock on Earth, about 3,000 million years old, with a Kempegowda tower on top.' } });
landmark('complex', 12.9300, 77.5835, { fw: 146, fd: 36, mcol: '#d9cbb0', signs: [signAt('4TH BLOCK COMPLEX', 75, 7, 4)] });
landmark('bakery', 12.9300, 77.5862, { dx: 30, fw: 48, fd: 18, mcol: '#f0d78a', signs: [signAt('IYENGAR BAKERY', 26, 8, 3.4, '#b8281e', null)] });
landmark('statue', 12.9360, 77.5803, { fw: 8, fd: 6, mcol: null, island: true });

// Mysore Road.
landmark('temple', 12.9500, 77.5320, { dy: 40, fw: 50, fd: 22, mcol: '#e8dcc0', pc: { id: 'anjaneya', name: 'Gali Anjaneya Temple', fact: 'An old Hanuman temple on Mysore Road, on the banks of the Vrishabhavathi river.', r: 50 } });

// Koramangala and Silk Board.
landmark('flyover', LATS.orr, 77.6235, { dx: -200, dy: 52, fw: 0, fd: 0, mcol: null, signs: [signAt('SILK BOARD JN', 160, 6, 4)] });
landmark('darshini', 12.9733, 77.6052, { fw: 40, fd: 14, mcol: '#f2e0b0', signs: [signAt('FILTER KAAPI', 22, 6.5, 3.4, '#7a2b25', null)] });

// Chinnaswamy Stadium: a bowl of stands drawn standing up, with floodlights.
B_BUILDINGS.push({ spr: 'stadium', x: B_STADIUM.x, y: B_STADIUM.y + B_STADIUM.ry + 6, fw: 0, fd: 0, mcol: null, icon: true, name: 'Chinnaswamy Stadium', signs: [{ anchor: 'name', text: 'M. CHINNASWAMY STADIUM', size: 3.6, color: '#ffffff' }] });
const nearB = (spr, dx, dy) => { const b = B_BUILDINGS.find(o => o.spr === spr); return { x: b.x + dx, y: b.y + dy }; };

// Postcards for places that are not buildings, and for the two rides.
place('stadium', 'Chinnaswamy Stadium', 12.9781, 77.6012, 'Test cricket here since 1974, and home of RCB. Ee sala cup namde!', { dy: 120, r: 80 });
place('brigade', 'Brigade Road', 12.9705, 77.6078, 'Shops, music and crowds every weekend, just off MG Road.', { dx: 30 });
place('commercial', 'Commercial Street', 12.9822, 77.6090, 'Bangles, fabric and bargains, in a lane that is always busy.', { dy: 30, r: 70 });
place('ulsoor', 'Ulsoor Lake', 12.9822, 77.6190, "A lake from Kempegowda's time, with small islands to row around.", { dy: 190, r: 80 });
place('indiranagar', '100 Feet Road', 12.9700, 77.6405, 'Indiranagar: cafes, pubs and very good coffee.', { dx: 30 });
place('racecourse', 'Bangalore Race Course', 12.9868, 77.5822, 'The Bangalore Turf Club has raced horses here for about a century.', { r: 80 });
place('sankey', 'Sankey Tank', 13.0085, 77.5754, 'A lake made in 1882 by Colonel Richard Sankey to bring water to the city.', { dy: 90, r: 70 });
place('jayanagar', 'Jayanagar Blossom Avenue', 12.9330, 77.5900, 'Planned in 1948. When the pink tabebuias bloom, Bengaluru calls it cherry blossom season.', { dy: 40, r: 70 });
place('koramangala', 'Koramangala', 12.9365, 77.6200, 'Start-ups, late-night cafes and a lot of laptops.', { dy: 30, r: 70 });
place('silkboard', 'Silk Board Junction', LATS.orr, 77.6235, 'Famous for its traffic. Pack snacks.', { dx: -40, dy: 30, r: 70 });
place('metro', 'Namma Metro', 12.9787, 77.5927, 'Opened in 2011. Purple runs east to west, Green north to south, and the Yellow Line (2025) out past Silk Board.', { ride: true });
place('auto', 'Namma Auto', 12.9748, 77.6050, 'Green and yellow, three wheels and a meter that is always somehow sleeping.', { ride: true });

// ---------------------------------------------------------------------------
// Everyday buildings: rows of shops, homes and offices, placed when the city
// is built so they can be checked against everything else (a row skips any
// spot that would clash with a road, water, a landmark, a stop or a person).
// rowNorth(): a row along the north side of an east-west road, facing it.
// rowSouth(): the south side, set back so the buildings don't hide the road.
// rowBlock(): rows filling an area. Shops are [sign, wall, board, awning].
// ---------------------------------------------------------------------------
const B_ROWS = [];
const rowNorth = (lat, lon0, lon1, kinds, o = {}) => B_ROWS.push({ x0: lonX(lon0), x1: lonX(lon1), base: latY(lat) - (o.half || 14) - 7, kinds, ...o });
const rowSouth = (lat, lon0, lon1, kinds, o = {}) => B_ROWS.push({ x0: lonX(lon0), x1: lonX(lon1), under: latY(lat) + (o.half || 14) + 6, kinds, ...o });
const rowBlock = (lat0, lon0, lat1, lon1, kinds, o = {}) => B_ROWS.push({ area: geoBox(lat0, lon0, lat1, lon1), kinds, ...o });
const B_SHOPS = {
  flowers: ['FLOWERS', '#f0d9a8', '#c0392b', '#f2c94c'], sweets: ['SWEETS', '#f4e3c3', '#8f2a25', '#d8433b'], sarees: ['SAREES', '#e9d2b8', '#6a2e7a', '#c3a0ec'],
  coffee: ['COFFEE', '#f0e6d0', '#5a3a26', '#2f8a3a'], books: ['BOOKS', '#dfe6ea', '#2f4f8a', '#5b8ee0'], bangles: ['BANGLES', '#f4e3c3', '#c0392b', '#f2c94c'],
  fabrics: ['FABRICS', '#e9d2b8', '#2f6db0', '#5b8ee0'], shoes: ['SHOES', '#dfe6ea', '#3a3530', '#d8433b'], jewels: ['JEWELS', '#f0e6d0', '#b8892a', '#f2c94c'],
  kurtas: ['KURTAS', '#f4e3c3', '#2f8a3a', '#7cc35a'], toys: ['TOYS', '#f0d9a8', '#ee8b3a', '#d8433b'], tailor: ['TAILOR', '#e9e4dc', '#5a3a26', '#a8843e'],
  silks: ['SILKS', '#f0d9a8', '#8f2a25', '#d8433b'], spices: ['SPICES', '#f2e0b0', '#a8551d', '#ee8b3a'], music: ['MUSIC', '#e9e4dc', '#3a3530', '#c3a0ec'],
  brewpub: ['BREW PUB', '#c9a27a', '#3a2418', '#2f6b3a'], cafe: ['CAFE', '#f0e6d0', '#5a3a26', '#2f8a3a'], sports: ['SPORTS', '#dfe6ea', '#2f6db0', '#d8433b'],
  fashion: ['FASHION', '#f4e3c3', '#7a52b0', '#c3a0ec'], icecream: ['ICE CREAM', '#fbe3ec', '#d9668a', '#f4a3b8'], games: ['GAMES', '#dfe6ea', '#3a3530', '#5b8ee0'],
  pub: ['PUB', '#c9a27a', '#3a2418', '#2f6b3a'], steel: ['STEEL', '#dfe6ea', '#5d6369', '#a3a9ae'], lodge: ['LODGE', '#f0e6d0', '#2f6b3a', '#7cc35a'],
  mobiles: ['MOBILES', '#dfe6ea', '#2f6db0', '#5b8ee0'], hotel: ['HOTEL', '#f0e6d0', '#8f2a25', '#f2c94c'], textiles: ['TEXTILES', '#e9d2b8', '#6a2e7a', '#d8433b'],
  bags: ['BAGS', '#f4e3c3', '#3a3530', '#ee8b3a'], meals: ['MEALS', '#f2e0b0', '#a8551d', '#ee8b3a'], travels: ['TRAVELS', '#dfe6ea', '#2f6db0', '#5b8ee0'],
  fruits: ['FRUITS', '#f4e3c3', '#2f8a3a', '#ee8b3a'], pooja: ['POOJA', '#f2e0b0', '#a8551d', '#f2c94c'], bananas: ['BANANAS', '#f4e3c3', '#2f8a3a', '#f2c94c'],
  brewery: ['BREWERY', '#c9a27a', '#3a2418', '#ee8b3a'], bakery: ['BAKERY', '#fbe3ec', '#d9668a', '#f4a3b8'], vinyl: ['VINYL', '#e9e4dc', '#3a3530', '#c3a0ec'],
  yoga: ['YOGA', '#dfe6ea', '#2f8a3a', '#7cc35a'], tacos: ['TACOS', '#f4e3c3', '#c0392b', '#f2c94c'], startup: ['STARTUP', '#dfe6ea', '#2f6db0', '#5b8ee0'],
  biryani: ['BIRYANI', '#f4e3c3', '#8f2a25', '#f2c94c'], cowork: ['COWORK', '#e9e4dc', '#3a3530', '#ee8b3a'], dosa: ['DOSA', '#f2e0b0', '#2f6b3a', '#7cc35a'],
  kebabs: ['KEBABS', '#f0d9a8', '#8f2a25', '#ee8b3a'], perfumes: ['PERFUMES', '#e9d2b8', '#2f6b3a', '#f2c94c'], tea: ['TEA', '#f0e6d0', '#2f6b3a', '#d8433b'],
  hardware: ['HARDWARE', '#dfe6ea', '#5d6369', '#ee8b3a'], comics: ['COMICS', '#f4e3c3', '#c0392b', '#5b8ee0'], koshys: ["KOSHY'S", '#f2e6c8', '#8f2a25', '#f2c94c'],
  pharmacy: ['PHARMACY', '#e9f0e9', '#2f8a3a', '#7cc35a'], coconuts: ['COCONUTS', '#f2e0b0', '#2f6b3a', '#7cc35a'],
};
const shopRow = (style, ...names) => names.map(n => ({ shop: B_SHOPS[n], style }));
const homeRow = (...kinds) => kinds;

// Malleswaram, Rajajinagar, Yeshwanthpur, Mathikere.
rowNorth(12.9995, 77.5675, 77.5712, shopRow('bazaar', 'flowers', 'sweets', 'sarees', 'coffee', 'books', 'pooja', 'fruits'), { half: 10 });
rowBlock(13.0105, 77.5655, 13.0005, 77.5710, homeRow('mhouse'));
rowBlock(12.9970, 77.5655, 12.9905, 77.5710, homeRow('mhouse', 'jhouse'));
rowBlock(13.0105, 77.5595, 12.9905, 77.5655, homeRow('jhouse', 'jhouse', 'apartment'));
rowBlock(13.0130, 77.5505, 12.9910, 77.5590, homeRow('jhouse', 'apartment'));
rowBlock(13.0130, 77.5245, 12.9910, 77.5490, homeRow('jhouse', 'jhouse', 'apartment'));
rowNorth(12.9905, 77.5245, 77.5490, shopRow('street', 'sweets', 'mobiles', 'bakery', 'sarees', 'meals', 'pharmacy', 'coffee', 'fruits'));
rowBlock(13.0265, 77.5245, 13.0140, 77.5490, homeRow('office', 'apartment', 'jhouse'));
rowBlock(13.0195, 77.5505, 13.0145, 77.5585, homeRow('apartment', 'office'));
rowBlock(13.0270, 77.5505, 13.0225, 77.5600, homeRow('office', 'apartment'));
rowBlock(13.0265, 77.5600, 13.0120, 77.5850, homeRow('jhouse', 'mhouse', 'jhouse', 'apartment'));
rowBlock(13.0265, 77.5865, 13.0040, 77.5980, homeRow('jhouse', 'apartment'), { gap: 16 });
rowBlock(13.0265, 77.5995, 13.0140, 77.6490, homeRow('jhouse', 'apartment', 'jhouse', 'mhouse'));
rowBlock(13.0130, 77.6125, 12.9905, 77.6490, homeRow('jhouse', 'apartment', 'mhouse'));
// Vijayanagar and Mysore Road.
rowNorth(12.9660, 77.5245, 77.5450, shopRow('street', 'sarees', 'sweets', 'mobiles', 'bakery', 'shoes', 'meals', 'jewels', 'coffee'), { half: 10 });
rowBlock(12.9890, 77.5245, 12.9770, 77.5480, homeRow('jhouse', 'apartment', 'jhouse'));
rowBlock(12.9745, 77.5245, 12.9670, 77.5360, homeRow('jhouse', 'mhouse'));
rowBlock(12.9745, 77.5385, 12.9570, 77.5450, homeRow('jhouse', 'apartment'));
rowBlock(12.9650, 77.5245, 12.9545, 77.5360, homeRow('jhouse', 'jhouse', 'apartment'));
rowBlock(12.9540, 77.5385, 12.9420, 77.5555, homeRow('jhouse', 'mhouse', 'apartment'));
rowBlock(12.9530, 77.5245, 12.9420, 77.5360, homeRow('mhouse', 'jhouse'));
// Majestic, Chickpet, K.R. Market: lodges, cinemas and bazaars.
rowSouth(LATS.kg, 77.5765, 77.5803, shopRow('lodge', 'lodge', 'hotel', 'meals', 'travels', 'sweets', 'books'));
rowNorth(LATS.kg, 77.5600, 77.5655, shopRow('lodge', 'hotel', 'lodge', 'meals', 'travels'));
rowNorth(12.9690, 77.5660, 77.5785, shopRow('bazaar', 'sarees', 'bangles', 'steel', 'silks', 'textiles', 'bags', 'mobiles', 'silks', 'sarees', 'steel'), { half: 10 });
rowSouth(12.9690, 77.5660, 77.5740, shopRow('bazaar', 'textiles', 'silks', 'bangles', 'sarees', 'hotel', 'bags'), { half: 10 });
rowBlock(12.9740, 77.5795, 12.9650, 77.5860, shopRow('bazaar', 'mobiles', 'hotel', 'textiles', 'bags', 'pharmacy', 'meals'));
rowNorth(12.9610, 77.5755, 77.5830, shopRow('bazaar', 'flowers', 'bananas', 'spices', 'coconuts', 'fruits', 'flowers'));
rowBlock(12.9880, 77.5460, 12.9600, 77.5650, homeRow('mhouse', 'jhouse', 'apartment'));
rowBlock(12.9560, 77.5560, 12.9480, 77.5735, homeRow('jhouse', 'mhouse'));
rowBlock(12.9898, 77.5660, 12.9830, 77.5765, shopRow('lodge', 'lodge', 'hotel', 'meals', 'travels', 'lodge', 'mobiles', 'bags'));
rowBlock(12.9752, 77.5660, 12.9725, 77.5790, shopRow('lodge', 'hotel', 'meals', 'sweets', 'travels', 'lodge', 'books'));
rowBlock(12.9718, 77.5745, 12.9695, 77.5790, shopRow('bazaar', 'sarees', 'silks', 'bangles', 'steel'));
rowBlock(12.9682, 77.5660, 12.9645, 77.5740, shopRow('bazaar', 'steel', 'textiles', 'bags', 'hardware', 'silks', 'sarees'));
rowBlock(12.9638, 77.5795, 12.9600, 77.5830, shopRow('bazaar', 'flowers', 'fruits', 'coconuts', 'spices'));
// Shivajinagar, Commercial Street, Vasanth Nagar.
rowNorth(12.9822, 77.6064, 77.6120, shopRow('bazaar', 'bangles', 'fabrics', 'shoes', 'jewels', 'kurtas', 'toys', 'tailor'), { half: 10 });
rowSouth(12.9822, 77.6064, 77.6120, shopRow('bazaar', 'silks', 'spices', 'jewels', 'shoes', 'fabrics'), { half: 10 });
rowSouth(12.9838, 77.6005, 77.6120, shopRow('bazaar', 'biryani', 'kebabs', 'perfumes', 'tea', 'hardware'), { half: 10 });
rowBlock(13.0130, 77.5990, 12.9925, 77.6118, homeRow('jhouse', 'jhouse', 'apartment'));
rowBlock(12.9862, 77.6005, 12.9842, 77.6120, shopRow('bazaar', 'biryani', 'kebabs', 'perfumes', 'tea', 'hardware', 'meals', 'shoes'));
rowBlock(12.9818, 77.6005, 12.9800, 77.6062, shopRow('bazaar', 'tea', 'biryani', 'mobiles', 'hardware'));
rowBlock(12.9905, 77.5990, 12.9870, 77.6060, homeRow('apartment', 'jhouse'));
// MG Road, Brigade Road, Church Street, Richmond Town.
rowNorth(LATS.mg, 77.6075, 77.6180, shopRow('street', 'books', 'music', 'brewpub', 'silks', 'cafe', 'sports', 'fashion', 'books'));
rowNorth(12.9728, 77.6015, 77.6078, shopRow('street', 'koshys', 'books', 'comics', 'cafe', 'pub', 'vinyl'), { half: 10 });
rowSouth(12.9728, 77.6015, 77.6078, shopRow('street', 'pub', 'books', 'cafe', 'games'), { half: 10 });
rowNorth(12.9690, 77.6010, 77.6120, shopRow('street', 'fashion', 'icecream', 'games', 'shoes', 'pub', 'books', 'cafe'));
rowBlock(12.9700, 77.5885, 12.9655, 77.6005, homeRow('office', 'apartment', 'office'));
rowBlock(12.9650, 77.5905, 12.9490, 77.6110, homeRow('jhouse', 'apartment', 'jhouse'));
// Ulsoor and Indiranagar.
rowBlock(12.9760, 77.6125, 12.9715, 77.6290, homeRow('jhouse', 'apartment'));
rowBlock(12.9895, 77.6230, 12.9800, 77.6295, homeRow('jhouse', 'jhouse', 'apartment'));
rowBlock(12.9770, 77.6305, 12.9560, 77.6400, homeRow('jhouse', 'jhouse', 'apartment'));
rowBlock(12.9770, 77.6410, 12.9560, 77.6490, shopRow('street', 'cafe', 'brewery', 'bakery', 'vinyl', 'yoga', 'tacos', 'cafe', 'pub'));
rowBlock(12.9895, 77.6305, 12.9800, 77.6445, homeRow('jhouse', 'apartment'));
// Basavanagudi, Jayanagar, Wilson Garden.
rowNorth(12.9455, 77.5715, 77.5745, shopRow('bazaar', 'flowers', 'fruits', 'pooja', 'sweets'), { half: 10 });
rowBlock(12.9420, 77.5700, 12.9340, 77.5795, homeRow('mhouse', 'jhouse'));
rowBlock(12.9470, 77.5560, 12.9340, 77.5690, homeRow('jhouse', 'mhouse'));
rowBlock(12.9430, 77.5810, 12.9200, 77.5995, homeRow('jhouse'), { gap: 8 });
rowNorth(12.9330, 77.5900, 77.5995, shopRow('bazaar', 'sarees', 'sweets', 'coffee', 'bakery', 'flowers'), { half: 10 });
rowBlock(12.9475, 77.5925, 12.9385, 77.6055, homeRow('jhouse', 'jhouse', 'apartment'));
// Koramangala, BTM, Silk Board.
rowNorth(12.9365, 77.6140, 77.6265, shopRow('street', 'cafe', 'startup', 'biryani', 'cowork', 'dosa', 'cafe', 'pub'));
rowBlock(12.9455, 77.6070, 12.9380, 77.6420, homeRow('office', 'apartment', 'office'));
rowBlock(12.9355, 77.6120, 12.9245, 77.6420, homeRow('apartment', 'jhouse', 'apartment', 'office'));
rowBlock(12.9235, 77.5965, 12.9080, 77.6225, homeRow('apartment', 'jhouse', 'apartment'));
rowBlock(12.9225, 77.6245, 12.9080, 77.6490, homeRow('office', 'apartment'));
// ---------------------------------------------------------------------------
// People, animals and street furniture.
// ---------------------------------------------------------------------------
const B_NPCS = [
  { name: 'Porter', x: lonX(77.5694) - 60, y: RAIL_Y + 36, skin: '#7a5236', hair: '#1d1816', top: '#c0392b', bottom: '#c0392b',
    lines: ['Luggage? I carry anything. Even a knight.', 'Mysuru train, platform one!'] },
  { name: 'Conductor', ...nearB('busstand', -80, 22), skin: '#9a6a45', hair: '#1d1816', top: '#5b7fae', bottom: '#2b2a33',
    lines: ['Right, right! Hold on!', 'Change? Give exact change, please.'] },
  { name: 'Cubbon walker', ...geo(12.9762, 77.5900, 0, 2), area: { ...geo(12.9762, 77.5890, 0, -2), w: lonX(77.5960) - lonX(77.5890), h: 8 }, skin: '#c48a5c', hair: '#d9d2c4', top: '#ffffff', bottom: '#2b2a33',
    lines: ['Third round done. Now, idli.', 'Bengaluru weather, no? Best in India.'] },
  { name: 'Jogger', ...geo(12.9700, 77.5902), area: { ...geo(12.9775, 77.5920, -2, 0), w: 4, h: latY(12.9700) - latY(12.9775) }, skin: '#9a6a45', hair: '#1d1816', top: '#ee8b3a', bottom: '#2b2a33',
    lines: ['Ten thousand steps! Then filter coffee.'] },
  { name: 'Guard', ...nearB('vidhana', -60, 8), skin: '#7a5236', hair: '#1d1816', top: '#c9b48a', bottom: '#c9b48a', cap: '#2f4f8a',
    lines: ['Photos are allowed. Climbing the dome is not.', "Government work is God's work. Lunch is at one."] },
  { name: 'Palace guide', ...nearB('palace', -60, 30), skin: '#c48a5c', hair: '#1d1816', top: '#7a2b25', bottom: '#2b2a33',
    lines: ['The towers were built to look like an English castle.', 'Concerts happen on these grounds. Very loud ones.'] },
  { name: 'Turf fan', ...nearB('grandstand', -60, 14), area: { ...nearB('grandstand', -150, 10), w: 300, h: 10 }, skin: '#c48a5c', hair: '#5a4a3a', top: '#d8433b', bottom: '#2b2a33',
    lines: ['Number four! Come on, number four!', 'I bet my lunch on the grey one.'] },
  { name: 'Cricket fan', x: B_STADIUM.x + 30, y: B_STADIUM.y + B_STADIUM.ry + 24, skin: '#9a6a45', hair: '#1d1816', top: '#c0392b', bottom: '#2b2220',
    lines: ['Ee sala cup namde!', 'Kohli fan since birth. Before birth, actually.'] },
  { name: 'Techie', ...geo(12.9365, 77.6150, 0, 22), area: { ...geo(12.9365, 77.6125, 0, 18), w: lonX(77.6260) - lonX(77.6125), h: 10 }, skin: '#c48a5c', hair: '#2b2220', top: '#5b8ee0', bottom: '#4a4f58',
    lines: ['Sorry, on a call. Standup in five.', 'My commute is two hours. For six kilometres.', 'Hotfix on Friday evening. Classic.'] },
  { name: 'Founder', ...geo(12.9365, 77.6220, 0, 26), skin: '#9a6a45', hair: '#1d1816', top: '#2b2a33', bottom: '#4a4f58',
    lines: ['We are like Uber, but for filter coffee.', 'Series A closes on Monday. Probably.'] },
  { name: 'Commuter', ...geo(LATS.orr, 77.6150, 0, 26), skin: '#c48a5c', hair: '#1d1816', top: '#f4f1ea', bottom: '#2b2a33',
    lines: ['Silk Board. I have been here since Tuesday.', 'Google Maps says forty minutes. Google Maps lies.'] },
  { name: 'Auto anna', ...geo(LATS.mg, 77.6095, 0, 26), skin: '#7a5236', hair: '#1d1816', top: '#d9c7a2', bottom: '#d9c7a2',
    lines: ['Meter? Meter is sleeping. Fifty extra.', 'Bartheera? Coming? Return is empty, saar.', 'Silk Board? Ayyo, no.'] },
  { name: 'Busker', ...geo(LATS.mg, 77.6050, 0, 24), skin: '#c48a5c', hair: '#2b2220', top: '#c3a0ec', bottom: '#2b2a33',
    lines: ['Requests? I know three songs.', 'Brigade Road on a Saturday is the best stage.'] },
  { name: 'Barista', ...geo(12.9700, 77.6405, 26, 0), skin: '#9a6a45', hair: '#2b2220', top: '#5a3a26', bottom: '#2b2a33',
    lines: ['Single origin from Chikmagalur. Smell that.', 'Filter coffee or a flat white? Trick question.'] },
  { name: 'Boatman', ...geo(12.9822, 77.6190, 0, 182), skin: '#7a5236', hair: '#1d1816', top: '#f4f1ea', bottom: '#2f6db0',
    lines: ['Row to the island? Ten minutes, no splashing.'] },
  { name: 'Shopkeeper', ...geo(12.9822, 77.6080, 0, 18), skin: '#c48a5c', hair: '#1d1816', top: '#f2c94c', bottom: '#2b2a33',
    lines: ['Best price, only for you!', 'Bangles in every colour. Even knight grey.'] },
  { name: 'Flower seller', ...nearB('krmarket', -40, 22), skin: '#8a5a3a', hair: '#1d1816', top: '#f2c94c', bottom: '#f2c94c', saree: true,
    lines: ['Mallige, jasmine! One metre for the kitten?', 'Marigolds for the festival, cheap cheap!'] },
  { name: 'Priest', ...nearB('bulltemple', 30, 18), skin: '#9a6a45', hair: '#1d1816', top: '#f4f1ea', bottom: '#ee8b3a',
    lines: ['The big Nandi was carved from a single rock.', 'Come back for the groundnut fair.'] },
  { name: 'Waiter', ...nearB('vidyarthi', 0, 16), skin: '#c48a5c', hair: '#1d1816', top: '#f4f1ea', bottom: '#f4f1ea',
    lines: ['Masala dosa, extra butter? Coming!', 'We carry twenty dosas on one arm.'] },
  { name: 'Aunty', ...geo(12.9330, 77.5850, 0, 28), area: { ...geo(12.9330, 77.5815, 0, 24), w: lonX(77.5875) - lonX(77.5815), h: 8 }, skin: '#b5784a', hair: '#1d1816', top: '#c3a0ec', bottom: '#c3a0ec', saree: true,
    lines: ['Oota aytha? Have you eaten?', 'Come, come, there is fresh holige.'] },
  { name: 'Gardener', ...nearB('glasshouse', 0, 60), area: { ...nearB('glasshouse', -120, 40), w: 240, h: 40 }, skin: '#7a5236', hair: '#1d1816', top: '#2f6b3a', bottom: '#d9c7a2',
    lines: ['The flower show is in January. Come back!', 'That clock? Made of flowers. Keeps time too.'] },
  { name: 'Malleswaram grandma', ...geo(12.9995, 77.5690, 0, 20), skin: '#8a5a3a', hair: '#d9d2c4', top: '#d8433b', bottom: '#d8433b', saree: true,
    lines: ['This street has had the best flowers since my wedding.', 'Malleswaram coffee is the real coffee.'] },
  { name: 'Shopper', ...nearB('orion', 0, 16), area: { ...nearB('orion', -60, 12), w: 120, h: 8 }, skin: '#9a6a45', hair: '#2b2220', top: '#d8433b', bottom: '#2b2a33',
    lines: ['Orion has a lake. A mall with a lake!', 'One more shop. Then home. Probably.'] },
  { name: 'Guitarist', ...nearB('hardrock', -20, 16), skin: '#c48a5c', hair: '#2b2220', top: '#2b2220', bottom: '#2f4f8a',
    lines: ['Rock on, little knight!', 'Bengaluru is the rock capital of India. Fight me.'] },
  { name: 'Hanuman bhakta', ...nearB('temple', 30, 16), skin: '#7a5236', hair: '#1d1816', top: '#ee8b3a', bottom: '#f4f1ea',
    lines: ['Jai Hanuman! The river was clean when I was small.', 'Tuesday and Saturday the line goes round the block.'] },
  { name: 'Darshini anna', ...nearB('darshini', 0, 8), skin: '#8a5a3a', hair: '#1d1816', top: '#ffffff', bottom: '#2f8a3a', shop: 'coffee',
    lines: ['One by two coffee? Free for knights.'] },
  { name: 'Baker', ...nearB('bakery', 0, 10), skin: '#c48a5c', hair: '#1d1816', top: '#ffffff', bottom: '#2f6db0', shop: 'cake',
    lines: ['Honey cake, fresh from the oven!'] },
  { name: 'Devotee', ...nearB('iskcon', 40, 18), skin: '#c48a5c', hair: '#1d1816', top: '#f4f1ea', bottom: '#ee8b3a',
    lines: ['Hare Krishna! The prasadam here is excellent.', 'Count the steps to the top. I got lost at 80.'] },
  { name: 'Choir boy', ...nearB('stmarys', -40, 16), kid: true, skin: '#9a6a45', hair: '#1d1816', top: '#ffffff', bottom: '#d8433b',
    lines: ['The feast in September fills the whole of Shivajinagar.', 'The spire is taller than everything. Almost.'] },
  { name: 'Fruit vendor', ...nearB('russell', 50, 16), skin: '#7a5236', hair: '#1d1816', top: '#7cc35a', bottom: '#2b2a33',
    lines: ['Mangoes from Kolar! Taste first, pay later.', 'Russell Market has everything. Except parking.'] },
  { name: 'Astronomer', ...nearB('planetarium', 46, 16), skin: '#c48a5c', hair: '#d9d2c4', top: '#2f4f8a', bottom: '#2b2a33',
    lines: ['On a clear night you can see Saturn. Clear nights: rare.'] },
];

// Passers-by in the busy streets, each walking up and down a stretch of footpath.
const B_CHATTER = [
  'Traffic, no? Every day the same.', 'Super weather today. Carry an umbrella anyway.', 'Where is the nearest darshini?',
  'One by two coffee, then office.', 'Auto! Auto! Ayyo, gone.', 'Namma Metro is so fast now.', 'Swalpa adjust maadi.',
  'This road was all trees once, my grandfather says.', 'Did you see the cricket last night?', 'I am going to Majestic. Then everywhere.',
];
const B_LOOKS = [['#c48a5c', '#1d1816', '#5b8ee0', '#2b2a33'], ['#9a6a45', '#2b2220', '#f4f1ea', '#3a4a7a'], ['#7a5236', '#1d1816', '#d8433b', '#2b2a33', true],
  ['#b5784a', '#1d1816', '#2f8a3a', '#2f8a3a', true], ['#c48a5c', '#d9d2c4', '#f2c94c', '#5a4a3a'], ['#8a5a3a', '#1d1816', '#c3a0ec', '#c3a0ec', true]];
[
  [LATS.mg, 77.6000, 77.6180, 18], [12.9822, 77.6065, 77.6115, 14], [LATS.kg, 77.5660, 77.5800, 18], [12.9690, 77.5665, 77.5785, 14],
  [12.9995, 77.5660, 77.5710, 14], [12.9365, 77.6120, 77.6260, 18], [12.9455, 77.5698, 77.5742, 14], [12.9838, 77.6010, 77.6110, 14],
  [12.9728, 77.6015, 77.6075, 14], [12.9330, 77.5810, 77.5990, 18], [12.9610, 77.5760, 77.5825, 14], [12.9270, 77.5810, 77.5990, 18],
  [12.9660, 77.5250, 77.5440, 14], [12.9905, 77.5250, 77.5480, 18],
].forEach(([lat, lon0, lon1, dy], i) => {
  const [skin, hair, top, bottom, saree] = B_LOOKS[i % B_LOOKS.length];
  const a = geo(lat, lon0, 0, dy), w = lonX(lon1) - lonX(lon0);
  B_NPCS.push({ name: 'Passer-by', x: a.x + w * ((i * 37) % 100) / 100, y: a.y, area: { x: a.x, y: a.y - 2, w, h: 4 }, skin, hair, top, bottom, ...(saree ? { saree } : {}),
    lines: [B_CHATTER[i % B_CHATTER.length], B_CHATTER[(i * 3 + 1) % B_CHATTER.length]] });
});

const B_BENCHES = [
  [12.9765, 77.5920], [12.9755, 77.5935], [12.9718, 77.5915], [12.9762, 77.5955], [12.9500, 77.5835], [12.9500, 77.5875],
  [12.9470, 77.5870], [12.9810, 77.5895], [12.9780, 77.5835], [13.0060, 77.5770], [12.9800, 77.6160], [12.9450, 77.5720],
].map(([lat, lon]) => { const p = geo(lat, lon); return [p.x, p.y]; });
const B_PIGEONS = [nearB('vidhana', 0, 10), nearB('iskcon', -20, 20), nearB('bandstand', 0, 14), nearB('complex', 0, 18), nearB('ksr', -60, 30), nearB('krmarket', 30, 18), nearB('bulltemple', -30, 14), nearB('stmarys', 30, 14), nearB('townhall', 0, 18)].map(p => [p.x, p.y]);
const B_COWS = [[...Object.values(geo(12.9660, 77.5300, 0, 24)), true], [...Object.values(geo(12.9480, 77.5250, 0, 20)), true], [...Object.values(geo(12.9330, 77.5960, 0, 26)), false], [...Object.values(nearB('krmarket', 90, 50)), false], [...Object.values(geo(12.9995, 77.5600, 0, 24)), true], [...Object.values(geo(12.9300, 77.6200, 0, 20)), false], [...Object.values(nearB('bulltemple', -60, 30)), true]];
const B_DOGS = [
  { ...geo(12.9330, 77.5815, 0, 20), w: lonX(77.5990) - lonX(77.5815), h: 16 },
  { ...geo(12.9365, 77.6130, 0, 18), w: lonX(77.6260) - lonX(77.6130), h: 12 },
  { ...geo(12.9822, 77.6065, 0, 12), w: lonX(77.6115) - lonX(77.6065), h: 10 },
];

// Hawkers' stalls and carts scattered around the markets: [lat, lon, how many, spread in px].
const B_STALL_SPOTS = [
  [12.9648, 77.5770, 14, 170], [12.9852, 77.6085, 10, 130], [12.9455, 77.5720, 6, 70], [12.9995, 77.5690, 6, 80],
  [12.9822, 77.6090, 6, 90], [12.9690, 77.5720, 8, 150], [12.9750, 77.5700, 6, 120], [12.9300, 77.5835, 5, 90],
  [12.9660, 77.5340, 6, 100],
];

// Auto stands: hop in for a ride anywhere (the meter is, of course, sleeping).
const B_AUTO_STANDS = [
  { name: 'Majestic', ...geo(LATS.kg, 77.5680, 0, 24) },
  { name: 'MG Road', ...geo(LATS.mg, 77.6120, -60, 24) },
  { name: 'Lalbagh Main Gate', ...geo(12.9560, 77.5866, 26, 0) },
  { name: 'Jayanagar 4th Block', ...geo(12.9270, 77.5850, 0, 20) },
  { name: 'Koramangala', ...geo(12.9365, 77.6267, -50, 24) },
  { name: 'Indiranagar', ...geo(LATS.cmh, 77.6405, 40, 24) },
  { name: 'Malleswaram', ...geo(12.9995, 77.5700, 0, 18) },
  { name: 'Shivajinagar', ...geo(12.9822, 77.6062, 30, 18) },
  { name: 'Basavanagudi', ...geo(12.9455, 77.5695, 30, 16) },
  { name: 'Silk Board', ...geo(LATS.orr, 77.6235, -120, 26) },
  { name: 'Cantonment', ...geo(12.9915, 77.6000, 0, 24) },
  { name: 'Ulsoor', ...geo(12.9768, 77.6150, 0, 18) },
  { name: 'Rajajinagar', ...geo(12.9905, 77.5440, 0, 24) },
  { name: 'Vijayanagar', ...geo(12.9660, 77.5300, 40, 18) },
  { name: 'Yeshwanthpur', ...geo(13.0200, 77.5640, 0, 22) },
];

// Hidden cats, Rod Hunt style: tucked away all over the city for sharp eyes.
const B_HIDDEN = [
  { name: 'the Palace cat', ...nearB('palace', 175, -10) },
  { name: 'the Cubbon Park cat', ...geo(12.9712, 77.5905) },
  { name: 'the temple cat', ...nearB('bulltemple', 56, -10) },
  { name: 'the mall cat', ...nearB('orion', 84, -8) },
  { name: 'the library cat', ...nearB('library', -62, -8) },
  { name: 'the lake cat', ...geo(12.9822, 77.6190, 245, 30) },
  { name: 'the glass house cat', ...nearB('glasshouse', 112, -10) },
  { name: 'the market cat', ...nearB('russell', -74, -6) },
  { name: 'the rock cat', ...nearB('rock', 58, -6) },
  { name: 'the station cat', ...nearB('ksr', 152, -14) },
  { name: 'the start-up cat', ...geo(12.9300, 77.6280, 0, 22) },
  { name: 'the ISKCON cat', ...nearB('iskcon', -82, -8) },
  { name: 'the Sankey cat', ...geo(13.0085, 77.5754, -205, 10) },
  { name: 'the cathedral cat', ...nearB('stmarks', 62, -8) },
];
