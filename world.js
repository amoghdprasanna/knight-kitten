'use strict';

// ---------------------------------------------------------------------------
// The arena world: a large meadow split into named areas, with parallax
// backdrop, time of day, ambient critters and small interactive details.
// World units are pixels; y grows towards the viewer, z is height.
// ---------------------------------------------------------------------------
const WW = 960, WD = 420;                       // world width and depth
const COTTAGE = { x: 480, y: 150 };             // front wall base of the Human's cottage
const DOOR = { x: 480, y: 159 };                // where wakers ring the bell
const BARN = { x: 800, y: 104 };
const POND = { x: 770, y: 342, rx: 74, ry: 30 };
const DOCK = { x0: 688, x1: 762, y0: 330, y1: 338 };

const ZONES = [
  { name: "THE HUMAN'S GARDEN", x0: 320, x1: 640, y0: 0, y1: 260 },
  { name: 'THE ORCHARD', x0: 0, x1: 320, y0: 0, y1: 320 },
  { name: 'ROCKY HILL', x0: 0, x1: 320, y0: 320, y1: WD },
  { name: 'THE FARM', x0: 640, x1: WW, y0: 0, y1: 275 },
  { name: 'THE POND', x0: 640, x1: WW, y0: 275, y1: WD },
  { name: 'THE OLD ROAD', x0: 320, x1: 640, y0: 260, y1: WD },
];

// Layout of solid things (built into physics by the arena).
const LAYOUT = {
  rocks: [[70, 352, 2], [118, 384, 0], [168, 346, 1], [228, 374, 2], [60, 396, 1], [282, 338, 0],
    [560, 232, 1], [420, 334, 0], [866, 392, 0], [640, 60, 1], [360, 104, 0]],
  bushes: [[438, 126, 0], [522, 126, 1], [434, 178, 1], [528, 178, 0], [350, 162, 0], [612, 250, 1],
    [300, 118, 1], [652, 300, 0], [540, 380, 1], [384, 392, 0], [930, 300, 1], [600, 120, 0]],
  stumps: [[330, 300], [604, 284], [204, 396], [930, 230]],
  well: [400, 214],
  stacks: [[700, 150], [884, 164], [760, 226]],
  bales: [[680, 204], [842, 236], [904, 118], [620, 160], [566, 326], [300, 252]],
  signs: [[496, 246], [500, 394]],
  extraTrees: [[360, 30, 0], [600, 30, 1], [668, 46, 0], [934, 40, 1], [26, 28, 0], [940, 400, 0], [620, 400, 1]],
};

const PATHS = [
  { r: 5, pts: [[480, 160], [478, 190], [486, 230], [474, 270], [482, 320], [478, 370], [480, 410]] },
  { r: 4, pts: [[480, 238], [420, 242], [360, 234], [300, 228], [240, 216], [170, 208], [100, 214]] },
  { r: 4, pts: [[482, 202], [540, 198], [600, 188], [660, 172], [720, 150], [790, 120]] },
  { r: 4, pts: [[480, 334], [560, 330], [640, 334], [690, 334]] },
  { r: 7, pts: [[-10, 405], [WW + 10, 405]] },
];

const TODS = [
  {
    name: 'MORNING', sky: ['#aebcd4', '#f4d8c6'], far: '#aab7c7', near: '#8fa997',
    tint: [255, 242, 236], fog: 0.2, sun: { x: 0.2, y: 18, col: '#ffe3b8' }, mood: 'morning', day: 1,
  },
  {
    name: 'NOON', sky: ['#78ade0', '#d2e8f4'], far: '#a0bacc', near: '#80a58b',
    tint: [255, 255, 255], fog: 0, sun: { x: 0.5, y: 36, col: '#fff6cf' }, mood: 'noon', day: 1,
  },
  {
    name: 'DUSK', sky: ['#46386a', '#f0a26a'], far: '#80607c', near: '#5e536a',
    tint: [255, 200, 168], fog: 0.06, sun: { x: 0.84, y: 8, col: '#ffb36e' }, mood: 'dusk', day: 0.5,
  },
  {
    name: 'NIGHT', sky: ['#0a0f22', '#253259'], far: '#1d2842', near: '#162038',
    tint: [118, 134, 198], fog: 0.05, moon: { x: 0.76, y: 34 }, mood: 'night', day: 0,
  },
];

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dither = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

const scenery = {
  tod: 0, todFrom: 0, todK: 1,
  ground: null, treeLine: null, pondFrames: [], clouds: [], pathMask: null,
  tufts: [], flowers: [], fog: [], butterflies: [], birds: [], fireflies: [], leaves: [],
  ripples: [], puddles: [], stars: [],
};

function lerp(a, b, k) { return a + (b - a) * k; }
function lerpRgb(a, b, k) { return a.map((v, i) => Math.round(lerp(v, b[i], k))); }
function rgbStr(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

function todLook() {
  const a = TODS[scenery.todFrom], b = TODS[scenery.tod];
  const k = Math.min(1, scenery.todK);
  const mix = (x, y) => lerpRgb(hexToRgb(x), hexToRgb(y), k);
  return {
    skyTop: mix(a.sky[0], b.sky[0]), skyBot: mix(a.sky[1], b.sky[1]),
    far: mix(a.far, b.far), near: mix(a.near, b.near),
    tint: lerpRgb(a.tint, b.tint, k), fog: lerp(a.fog, b.fog, k),
    day: lerp(a.day, b.day, k), night: lerp(a.day === 0 ? 1 : 0, b.day === 0 ? 1 : 0, k),
    sun: b.sun || a.sun, moon: b.moon, k,
  };
}

function setTod(i, instant = false) {
  scenery.todFrom = instant ? i : scenery.tod;
  scenery.tod = i;
  scenery.todK = instant ? 1 : 0;
}

function onDock(x, y) { return x > DOCK.x0 && x < DOCK.x1 && y > DOCK.y0 - 2 && y < DOCK.y1 + 2; }
function inPond(x, y, pad = 0) {
  if (pad === 0 && onDock(x, y)) return false;
  return ((x - POND.x) / (POND.rx + pad)) ** 2 + ((y - POND.y) / (POND.ry + pad)) ** 2 < 1;
}
function onPath(x, y) {
  const m = scenery.pathMask;
  if (!m) return false;
  x = Math.round(x); y = Math.round(y);
  return x >= 0 && y >= 0 && x < WW && y < WD + 30 && m[y * WW + x] > 0;
}
function zoneAt(x, y) {
  return ZONES.find(z => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) || ZONES[0];
}

function orchardTrees() {
  const r = seeded(321);
  const out = [];
  for (const y of [56, 112, 168, 228, 284]) {
    for (const x of [48, 112, 176, 244]) {
      const tx = x + Math.round((r() - 0.5) * 18), ty = y + Math.round((r() - 0.5) * 14);
      if (r() < 0.14) continue;
      out.push([tx, ty, r() < 0.5 ? 0 : 1]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// One-time build of the static art
// ---------------------------------------------------------------------------
function initScenery() {
  const rnd = seeded(99);
  const GH = WD + 30;

  // Paths are rasterised into a mask first.
  const mask = new Uint8Array(WW * GH);
  for (const p of PATHS) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [x0, y0] = p.pts[i], [x1, y1] = p.pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s <= len; s += 1.5) {
        const cx = x0 + (x1 - x0) * s / len, cy = y0 + (y1 - y0) * s / len;
        const rr = p.r + Math.sin(s * 0.3) * 0.8;
        for (let dy = -rr - 1; dy <= rr + 1; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > rr + 1) continue;
          const X = Math.round(cx + dx), Y = Math.round(cy + dy);
          if (X < 0 || Y < 0 || X >= WW || Y >= GH) continue;
          mask[Y * WW + X] = Math.max(mask[Y * WW + X], d > rr ? 1 : 2);
        }
      }
    }
  }
  scenery.pathMask = mask;

  const greens = ['#507d36', '#5f8d3e', '#6d9c47', '#7cab52', '#8bb85d'];
  const dirt = ['#8e7349', '#a78a5e', '#bf9f6c'];
  const tilled = ['#7a5a36', '#8e6a40'];
  scenery.ground = fastCanvas(WW, GH, (x, y) => {
    let n = Math.sin(x * 0.05) + Math.sin(y * 0.09 + x * 0.02) + Math.sin((x + y) * 0.035) * 0.8 + Math.sin(x * 0.15 - y * 0.12) * 0.35;
    n = (n + 3) / 6;
    const edge = Math.min(x, WW - x, y + 20, WD + 10 - y) / 40;
    n -= Math.max(0, 0.35 - edge * 0.35);
    // Orchard grass is a little deeper, the farm a little more golden.
    if (x < 320 && y < 320) n -= 0.08;
    const v = Math.max(0, Math.min(0.999, n)) * (greens.length - 1);
    let col = greens[Math.min(greens.length - 1, Math.floor(v) + (v % 1 > dither(x, y) ? 1 : 0))];
    if (x > 650 && y < 270 && y > 20 && dither(x, y) > 0.8) col = '#9fb35a';
    // Tilled crop rows behind the barn.
    if (x > 862 && x < 950 && y > 186 && y < 262) {
      col = (y % 6 < 3) ? tilled[(x + y) % 2] : ((x * 7 + y) % 5 === 0 ? '#9cc46a' : '#5f8d3e');
    }
    const m = mask[y * WW + x];
    if (m === 2) {
      const dv = (Math.sin(x * 0.7 + y * 0.4) + 1) / 2 * 2.99;
      col = dirt[Math.min(2, Math.floor(dv) + (dv % 1 > dither(x, y) ? 1 : 0))];
      if (y > 398 && y < 412 && (Math.abs(y - 402) < 1 || Math.abs(y - 408) < 1) && dither(x, y) < 0.6) col = '#7a6240';
    } else if (m === 1 && dither(x, y) > 0.35) col = '#6f8a43';
    // Worn dirt in front of the cottage and barn doors.
    if (Math.hypot((x - DOOR.x) / 20, (y - DOOR.y) / 7) < 1 && dither(x, y) < 0.75) col = dirt[1];
    if (Math.hypot((x - BARN.x) / 22, (y - BARN.y - 4) / 8) < 1 && dither(x, y) < 0.7) col = dirt[0];
    // Pond shore.
    if (inPond(x, y, 3) && !inPond(x, y, 0.01)) col = dither(x, y) > 0.4 ? '#8e7349' : '#c2a878';
    return col;
  });
  const g = scenery.ground.getContext('2d');
  const dot = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // Clover, daisies, pebbles.
  for (let i = 0; i < 1200; i++) {
    const x = Math.floor(rnd() * WW), y = Math.floor(rnd() * GH);
    if (inPond(x, y, 4)) continue;
    if (onPath(x, y)) { if (rnd() < 0.3) dot(x, y, '#6d5a3a'); continue; }
    const r = rnd();
    if (r < 0.5) dot(x, y, '#9cc46a');
    else if (r < 0.75) dot(x, y, '#3f6a2a', 2);
    else if (r < 0.9) dot(x, y, '#f4f1e6');
    else dot(x, y, '#f2c94c');
  }
  // Fallen apples and mushrooms in the orchard.
  for (const [tx, ty] of orchardTrees()) {
    for (let i = 0; i < 3; i++) dot(tx + Math.floor((rnd() - 0.5) * 22), ty + Math.floor(rnd() * 8) - 2, '#c8423a', 2, 1);
    if (rnd() < 0.4) { const mx = tx + 9, my = ty + 3; dot(mx, my, '#e9e4dc'); dot(mx - 1, my - 1, '#d8433b', 3, 1); }
  }

  // Tree line along the back edge.
  scenery.treeLine = (() => {
    const r2 = seeded(5);
    const circles = [];
    for (let x = -6; x < WW + 10; x += 9 + Math.floor(r2() * 6)) circles.push([x, 20 + Math.floor(r2() * 6), 9 + Math.floor(r2() * 6)]);
    const inside = (x, y) => y < 34 && circles.some(([cx, cy, r]) => Math.abs(x - cx) < r && (x - cx) ** 2 + (y - cy) ** 2 < r * r);
    return blob(WW, 34, inside, ['#16291a', '#1f3a21', '#2b4f2b', '#3e6b37'], 0.15, r2);
  })();

  // Pond animation frames.
  const PW = POND.rx * 2 + 2, PH = POND.ry * 2 + 2;
  scenery.pondFrames = [0, 1, 2, 3, 4, 5].map(f => {
    const cv = fastCanvas(PW, PH, (x, y) => {
      const wx = x + POND.x - POND.rx - 1, wy = y + POND.y - POND.ry - 1;
      if (!inPond(wx, wy, 0.01)) return null;
      const edge = !inPond(wx - 1, wy, 0.01) || !inPond(wx + 1, wy, 0.01) || !inPond(wx, wy - 1, 0.01) || !inPond(wx, wy + 1, 0.01);
      if (edge) return '#2f4f8a';
      const wave = Math.sin(wx * 0.45 + f * 1.05 + wy * 0.8) + Math.sin(wx * 0.17 - f * 1.05);
      if (wave > 1.5) return '#9fd6ef';
      if (wave > 1.0) return '#6fb2dc';
      return (wy - POND.y + POND.ry) < 6 ? '#3f7fb0' : '#4f8fbf';
    });
    const c = cv.getContext('2d');
    for (const [lx, ly] of [[100, 20], [124, 36], [40, 40], [60, 14]]) {
      c.fillStyle = '#6aa64c'; c.fillRect(lx - 2, ly, 5, 1); c.fillRect(lx - 1, ly - 1, 3, 3);
      c.fillStyle = '#3f7d2f'; c.fillRect(lx - 2, ly + 1, 5, 1);
    }
    c.fillStyle = '#f4a3b8'; c.fillRect(125, 35, 1, 1);
    return cv;
  });

  scenery.clouds = [0, 1, 2, 3, 4].map(i => {
    const r3 = seeded(70 + i);
    const w = 30 + Math.floor(r3() * 26), h = 12;
    const circles = [[w * 0.3, 8, 5], [w * 0.5, 6, 6], [w * 0.7, 8, 5], [w * 0.15, 9, 3], [w * 0.85, 9, 3]];
    const img = blob(w, h, (x, y) => y < 11 && circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r),
      ['#c9d2db', '#dfe6ec', '#f2f5f7', '#ffffff'], 0.05, r3);
    return { img, x: r3() * 560, y: 6 + r3() * 26, speed: 1.5 + r3() * 2.5 };
  });

  // Tall grass tufts.
  const blocked = (x, y, pad) => onPath(x, y) || inPond(x, y, 4) || Math.hypot(x - COTTAGE.x, y - COTTAGE.y + 6) < 30 + pad ||
    (Math.abs(x - BARN.x) < 36 && y < BARN.y + 8 && y > BARN.y - 30);
  for (let i = 0; i < 1500; i++) {
    const x = Math.floor(rnd() * (WW - 8)) + 4, y = Math.floor(rnd() * (WD - 16)) + 14;
    if (blocked(x, y, 0)) continue;
    scenery.tufts.push({ x, y, h: 2 + Math.floor(rnd() * 3), col: pick(['#4f7b34', '#87b55a', '#6c9a43', '#9cc46a']), lean: 0 });
  }
  scenery.tufts.sort((a, b) => a.y - b.y);

  // Flower patches that burst into petals when slashed.
  const patches = [[456, 190, 10], [506, 190, 10], [380, 300, 8], [600, 362, 8], [200, 150, 7], [560, 82, 7], [300, 382, 7],
    [660, 250, 7], [140, 260, 7], [90, 120, 6], [860, 300, 7], [720, 80, 6]];
  for (const [px0, py0, n] of patches) {
    for (let i = 0; i < n; i++) {
      const x = Math.round(px0 + (rnd() - 0.5) * 24), y = Math.round(py0 + (rnd() - 0.5) * 12);
      if (onPath(x, y)) continue;
      scenery.flowers.push({ x, y, col: pick(['#f4a3b8', '#f2c94c', '#ffffff', '#9fd6ef', '#e8705a']), cut: 0 });
    }
  }

  for (let i = 0; i < 9; i++) scenery.fog.push({ x: rnd() * WW, y: 20 + rnd() * (WD - 20), w: 50 + rnd() * 60, speed: 3 + rnd() * 5 });
  for (let i = 0; i < 12; i++) scenery.butterflies.push({ x: rnd() * WW, y: 20 + rnd() * (WD - 30), z: 6, a: rnd() * 6, ph: rnd() * 6 });
  for (let i = 0; i < 12; i++) scenery.birds.push(newBird(20 + rnd() * (WW - 40), 24 + rnd() * (WD - 40)));
  for (let i = 0; i < 50; i++) scenery.fireflies.push({ x: rnd() * WW, y: 10 + rnd() * WD, z: 4 + rnd() * 14, ph: rnd() * 6 });
  for (let i = 0; i < 70; i++) scenery.stars.push({ x: rnd(), y: rnd(), ph: rnd() * 6 });
}

function newBird(x, y) {
  return { x, y, z: 0, vx: 0, vz: 0, state: 'sit', t: Math.random() * 2, flip: Math.random() < 0.5 ? 0 : 1, respawn: 0 };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function updateScenery(dt, pushers, view, W, H) {
  scenery.todK = Math.min(1, scenery.todK + dt / 3);
  const look = todLook();

  for (const c of scenery.clouds) { c.x += c.speed * dt; if (c.x > 620) c.x = -60; }
  for (const f of scenery.fog) { f.x += f.speed * dt; if (f.x > WW + 40) f.x = -f.w - 40; }
  for (const f of scenery.flowers) if (f.cut > 0) f.cut -= dt;
  for (const r of scenery.ripples) r.t += dt;
  scenery.ripples = scenery.ripples.filter(r => r.t < 0.8);
  for (const p of scenery.puddles) p.life -= dt;
  scenery.puddles = scenery.puddles.filter(p => p.life > 0);

  const near = (x, y, r) => pushers.find(p => Math.abs(p.x - x) < r && Math.abs(p.y - y) < r * 0.7);

  for (const b of scenery.butterflies) {
    const threat = near(b.x, b.y, 22);
    let sp = 16;
    if (threat) { b.a = Math.atan2(b.y - threat.y, b.x - threat.x); sp = 50; }
    else b.a += (Math.random() - 0.5) * 4 * dt;
    b.x += Math.cos(b.a) * sp * dt;
    b.y += Math.sin(b.a) * sp * 0.6 * dt;
    b.ph += dt * 14;
    b.z = 7 + Math.sin(b.ph * 0.3) * 3;
    if (b.x < 10 || b.x > WW - 10) b.a = Math.PI - b.a;
    if (b.y < 16 || b.y > WD - 10) b.a = -b.a;
    b.x = Math.max(8, Math.min(WW - 8, b.x));
    b.y = Math.max(14, Math.min(WD - 8, b.y));
  }

  for (const b of scenery.birds) {
    b.t -= dt;
    if (b.state === 'sit') {
      if (b.t <= 0) { b.t = 0.4 + Math.random() * 1.2; if (Math.random() < 0.3) b.flip ^= 1; }
      const threat = near(b.x, b.y, 28);
      if (threat || look.day < 0.3) {
        b.state = 'fly';
        b.vx = (threat && b.x < threat.x ? -1 : 1) * (40 + Math.random() * 30);
        b.flip = b.vx > 0 ? 0 : 1;
        b.vz = 50;
        if (threat) sfxSafe('blip');
      }
    } else if (b.state === 'fly') {
      b.vz = Math.min(90, b.vz + 60 * dt);
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.z > 110) { b.state = 'gone'; b.respawn = 6 + Math.random() * 8; }
    } else if (b.state === 'gone') {
      b.respawn -= dt;
      if (b.respawn <= 0 && look.day > 0.3) {
        Object.assign(b, newBird(20 + Math.random() * (WW - 40), 24 + Math.random() * (WD - 40)));
        if (onPath(b.x, b.y) || inPond(b.x, b.y, 2)) { b.state = 'gone'; b.respawn = 2; continue; }
        b.state = 'land';
        b.z = 100;
      }
    } else if (b.state === 'land') {
      b.z -= 55 * dt;
      if (b.z <= 0) { b.z = 0; b.state = 'sit'; }
    }
  }

  for (const f of scenery.fireflies) {
    f.ph += dt;
    f.x += Math.sin(f.ph * 0.7) * 6 * dt;
    f.y += Math.cos(f.ph * 0.5) * 4 * dt;
  }

  if (scenery.tod === 2 && Math.random() < dt * 4) {
    scenery.leaves.push({ x: view.x - 10 + Math.random() * (W + 20), y: view.y + Math.random() * H + 20, z: 60, vx: 12 + Math.random() * 12, ph: Math.random() * 6 });
  }
  for (const l of scenery.leaves) { l.x += l.vx * dt; l.z -= 10 * dt; l.ph += dt * 3; }
  scenery.leaves = scenery.leaves.filter(l => l.z > 0);

  // Grass leans away from whatever stands closest (only what's on screen).
  const x0 = view.x - 10, x1 = view.x + W + 10, y0 = view.y - 10, y1 = view.y + H + 20;
  for (const tf of scenery.tufts) {
    if (tf.y < y0 || tf.y > y1 || tf.x < x0 || tf.x > x1) continue;
    const p = near(tf.x, tf.y, 7);
    const target = p ? (tf.x >= p.x ? 1 : -1) : 0;
    tf.lean += (target - tf.lean) * Math.min(1, dt * 12);
  }
}

function cutFlowers(x, y, rx, ry, onCut) {
  for (const f of scenery.flowers) {
    if (f.cut > 0 || Math.abs(f.x - x) > rx || Math.abs(f.y - y) > ry) continue;
    f.cut = 18 + Math.random() * 10;
    onCut(f);
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function pixDisc(c, x, y, r) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(x) - half, Math.round(y) + dy, half * 2 + 1, 1);
  }
}

function pixEllipse(c, x, y, rx, ry) {
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
    c.fillRect(Math.round(x) - half, Math.round(y) + dy, half * 2 + 1, 1);
  }
}

function drawBackdrop(c, view, W, H, t) {
  const look = todLook();
  const horizon = Math.round(-view.y - 18);
  if (horizon <= 0) return;
  const bands = 8;
  for (let y = 0; y < horizon + 20; y++) {
    const k = Math.min(1, y / (horizon + 10));
    const v = k * (bands - 1);
    const i = Math.floor(v) + ((v % 1) > dither(0, y) ? 1 : 0);
    c.fillStyle = rgbStr(lerpRgb(look.skyTop, look.skyBot, i / (bands - 1)));
    c.fillRect(0, y, W, 1);
  }
  if (look.night > 0.05) {
    for (const s of scenery.stars) {
      if (Math.sin(t * 2 + s.ph) < -0.4) continue;
      c.globalAlpha = look.night * (Math.sin(t * 3 + s.ph) > 0.85 ? 1 : 0.6);
      c.fillStyle = '#e8ecff';
      c.fillRect(Math.round(s.x * W), Math.round(s.y * (horizon - 10)), 1, 1);
    }
    c.globalAlpha = 1;
  }
  if (look.moon && look.night > 0.3) {
    const mx = Math.round(W * look.moon.x), my = horizon - look.moon.y - 20;
    c.fillStyle = '#efeadc';
    pixDisc(c, mx, my, 6);
    c.fillStyle = rgbStr(look.skyTop);
    pixDisc(c, mx + 3, my - 2, 5);
  } else if (look.sun) {
    const sx = Math.round(W * look.sun.x), sy = horizon - look.sun.y;
    c.fillStyle = look.sun.col;
    pixDisc(c, sx, sy, 7);
    c.globalAlpha = 0.25;
    pixDisc(c, sx, sy, 10);
    c.globalAlpha = 1;
  }
  c.globalAlpha = 0.35 + look.day * 0.6;
  for (const cl of scenery.clouds) {
    const x = Math.round(((cl.x - view.x * 0.12) % 680 + 680) % 680 - 60);
    c.drawImage(cl.img, x, Math.round(horizon - 46 + cl.y * 0.6));
  }
  c.globalAlpha = 1;
  const hills = (p, base, amp, f, col) => {
    c.fillStyle = rgbStr(col);
    for (let x = 0; x < W; x++) {
      const wx = x + view.x * p;
      const hgt = base + amp * (Math.sin(wx * f) * 0.6 + Math.sin(wx * f * 2.3 + 1.7) * 0.4);
      const y = Math.round(horizon - hgt);
      c.fillRect(x, y, 1, horizon + 24 - y);
    }
  };
  hills(0.2, 16, 9, 0.018, look.far);
  hills(0.45, 6, 6, 0.035, look.near);
}

// Ground-level layer, drawn with the camera transform applied.
function drawGround(c, view, W, H, t) {
  const sx = Math.max(0, Math.floor(view.x)), sy = Math.max(0, Math.floor(view.y));
  const sw = Math.min(WW - sx, W + 2), sh = Math.min(scenery.ground.height - sy, H + 2);
  if (view.y < 4) c.drawImage(scenery.treeLine, sx, 0, sw, 34, sx, -30, sw, 34);
  if (sw > 0 && sh > 0) c.drawImage(scenery.ground, sx, sy, sw, sh, sx, sy, sw, sh);
  const vis = (x, y, pad = 8) => x > view.x - pad && x < view.x + W + pad && y > view.y - pad && y < view.y + H + pad;

  if (vis(POND.x, POND.y, 90)) {
    const f = Math.floor(t * 4) % scenery.pondFrames.length;
    c.drawImage(scenery.pondFrames[f], POND.x - POND.rx - 1, POND.y - POND.ry - 1);
    // The little dock.
    for (let x = DOCK.x0; x < DOCK.x1; x++) {
      c.fillStyle = x % 5 === 0 ? '#5e3c1f' : x % 2 ? '#9a6a3a' : '#b07c45';
      c.fillRect(x, DOCK.y0, 1, DOCK.y1 - DOCK.y0);
    }
    c.fillStyle = '#4a2d16';
    c.fillRect(DOCK.x0, DOCK.y1, DOCK.x1 - DOCK.x0, 1);
    for (const px of [DOCK.x0 + 6, DOCK.x0 + 30, DOCK.x0 + 54, DOCK.x1 - 2]) c.fillRect(px, DOCK.y1, 2, 3);
  }
  for (const r of scenery.ripples) {
    c.fillStyle = `rgba(220,240,255,${0.7 * (1 - r.t / 0.8)})`;
    const rr = 2 + r.t * 10;
    for (let a = 0; a < Math.PI * 2; a += 0.5) c.fillRect(Math.round(r.x + Math.cos(a) * rr), Math.round(r.y + Math.sin(a) * rr * 0.5), 1, 1);
  }
  for (const p of scenery.puddles) {
    c.globalAlpha = Math.min(1, p.life);
    c.fillStyle = '#2f4f8a';
    pixEllipse(c, p.x, p.y, p.r + 1, Math.round(p.r * 0.45) + 1);
    c.fillStyle = '#5aa7d1';
    pixEllipse(c, p.x, p.y, p.r, Math.round(p.r * 0.45));
    c.fillStyle = '#9fd6ef';
    c.fillRect(Math.round(p.x - p.r / 2), Math.round(p.y - 1), 3, 1);
    c.globalAlpha = 1;
  }
  for (const fl of scenery.flowers) {
    if (!vis(fl.x, fl.y)) continue;
    c.fillStyle = '#3f6a2a';
    c.fillRect(fl.x, fl.y - 1, 1, 2);
    if (fl.cut > 0) continue;
    c.fillStyle = fl.col;
    c.fillRect(fl.x - 1, fl.y - 3, 3, 1);
    c.fillRect(fl.x, fl.y - 4, 1, 3);
    c.fillStyle = '#f2c94c';
    c.fillRect(fl.x, fl.y - 3, 1, 1);
  }
  for (const tf of scenery.tufts) {
    if (!vis(tf.x, tf.y, 4)) continue;
    const lean = Math.round(tf.lean + Math.sin(t * 1.8 + tf.x * 0.13) * 0.4);
    c.fillStyle = tf.col;
    c.fillRect(tf.x, tf.y - tf.h + 1, 1, tf.h);
    c.fillRect(tf.x + lean, tf.y - tf.h, 1, 1);
    if (tf.h > 3) c.fillRect(tf.x - 1, tf.y - 1, 1, 2);
  }
}

function drawCritters(c, view, W, H, t) {
  const look = todLook();
  c.globalAlpha = Math.min(1, look.day * 1.5);
  if (c.globalAlpha > 0.05) {
    for (const b of scenery.butterflies) {
      c.drawImage(SPR.butterfly[Math.floor(b.ph) % 2], Math.round(b.x - 2), Math.round(b.y - b.z - 2));
    }
  }
  c.globalAlpha = 1;
  for (const b of scenery.birds) {
    if (b.state === 'gone') continue;
    const img = SPR.bird[b.state === 'sit' ? 0 : Math.floor(t * 12) % 2];
    c.save();
    c.translate(Math.round(b.x), Math.round(b.y - b.z));
    if (b.flip) c.scale(-1, 1);
    c.drawImage(img, -3, -3);
    c.restore();
    if (b.z < 2) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(Math.round(b.x - 2), Math.round(b.y), 4, 1); }
  }
  for (const l of scenery.leaves) {
    c.fillStyle = Math.sin(l.ph) > 0 ? '#e8963e' : '#b8642a';
    c.fillRect(Math.round(l.x + Math.sin(l.ph) * 3), Math.round(l.y - l.z), 2, 1);
  }
}

function drawFog(c) {
  const look = todLook();
  if (look.fog < 0.01) return;
  c.fillStyle = `rgba(240, 240, 238, ${look.fog})`;
  for (const f of scenery.fog) {
    const x = Math.round(f.x), y = Math.round(f.y);
    c.fillRect(x, y, Math.round(f.w), 4);
    c.fillRect(x + 6, y - 2, Math.round(f.w) - 12, 2);
    c.fillRect(x + 6, y + 4, Math.round(f.w) - 12, 2);
  }
}

function drawTint(c, W, H, tint) {
  const [r, g, b] = tint || todLook().tint;
  if (r > 250 && g > 250 && b > 250) return;
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = `rgb(${r},${g},${b})`;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
}

function drawLights(c, view, lights, t, strengthOverride) {
  const look = todLook();
  const strength = strengthOverride !== undefined ? strengthOverride : look.night * 0.9 + (1 - look.day) * 0.2;
  if (strength < 0.05) return;
  c.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    for (let i = 3; i >= 1; i--) {
      c.globalAlpha = strength * l.a * 0.09;
      c.fillStyle = l.col;
      pixDisc(c, l.x - view.x, l.y - view.y, Math.round(l.r * i / 3));
    }
  }
  if (strengthOverride === undefined) {
    for (const f of scenery.fireflies) {
      const glow = (Math.sin(t * 2.5 + f.ph * 3) + 1) / 2;
      if (glow < 0.3) continue;
      const fx = f.x - view.x, fy = f.y - f.z - view.y;
      if (fx < -4 || fy < -4 || fx > 400 || fy > 260) continue;
      c.globalAlpha = strength * glow;
      c.fillStyle = '#d9ff8a';
      c.fillRect(Math.round(fx), Math.round(fy), 1, 1);
      c.globalAlpha = strength * glow * 0.3;
      pixDisc(c, fx, fy, 2);
    }
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

function sfxSafe(name) {
  if (typeof sfx !== 'undefined' && sfx[name]) sfx[name]();
}
