'use strict';

// ---------------------------------------------------------------------------
// Palette. Each character in a sprite row maps to a colour; '.' is transparent.
// ---------------------------------------------------------------------------
const PALETTE = {
  k: '#2b2220', // outline
  e: '#141414', // eye
  h: '#ffffff', // white / highlight
  f: '#ecd0a6', // fur
  F: '#c99d6e', // fur shade
  w: '#f8eedc', // muzzle
  p: '#f4a3b8', // pink
  P: '#d9668a', // dark pink
  s: '#eef1f3', // steel light
  S: '#aeb6bd', // steel
  d: '#6e767e', // steel dark
  m: '#8d939a', // chainmail
  M: '#5c6268', // chainmail dark
  b: '#7a4b26', // leather
  B: '#4a2d16', // leather dark
  g: '#e6c15e', // gold
  c: '#f1ead8', // cape
  C: '#c8bca2', // cape shade
  r: '#d8433b', // red
  R: '#8f2a25', // dark red
  y: '#f2c94c', // yellow
  Y: '#b8892a', // dark yellow
  v: '#7cc35a', // green
  V: '#3f7d2f', // dark green
  l: '#b5e08a', // light green
  n: '#a3a9ae', // grey
  N: '#5d6369', // dark grey
  q: '#9fd6ef', // light blue
  Q: '#5aa7d1', // water
  x: '#e9e4dc', // paper
  z: '#c9c2b6', // paper shade
  o: '#ee8b3a', // orange
  O: '#a8551d', // dark orange
  u: '#5b8ee0', // blue
  U: '#2f4f8a', // dark blue
};

// Characters that never get automatic shading.
const NO_SHADE = new Set(['k', 'e', 'h']);

// ---------------------------------------------------------------------------
// Characters (all face right). `eyes` are stamped on as angry eyes + brows.
// `big` sprites are upscaled 2x with Scale2x so they keep a 1px pixel grid.
// ---------------------------------------------------------------------------
const KITTEN_TOP = [
  '......kk......kk.pp.pp..',
  '.....kpfk....kfpkpPPPp..',
  '....kfffffffffffkpp.pp..',
  '...kfFffFffFfffffk......',
  '...kfffffffffffffk......',
  null, null, null,            // eyes: filled from KITTEN_FACES
  '.nnkFpffwwPwwffpfknn....',
  '..nkFFffwkwkwffFFkn.....',
  '....kFFfwwwwwfFFk.......',
  '.cc..kkkkkkkkkkk........',
  '.cCkssSkssssssssk.......',
  '.cCksSdkssssSSSdk.......',
  'ccCkdddksssSSSddk.......',
  'cCCkbbsssssSSSSdk.......',
  'cCCksbbssssSSSSdk.......',
  'ccCkssbbsssSSSSdk.......',
  'cCCksssbbssSSSddk.......',
  'cCCkbbbbbggbbbbbk.......',
  'ccCkmMmMmMmMmMmMk.......',
  'cCCkMmMmMmMmMmMmk.......',
  'cCkmMmMmMmMmMmMmMk......',
  'cCkMmMmMmMmMmMmMmk......',
  'cCkkkkkkkkkkkkkkkk......',
];

const KITTEN_FACES = {
  open: ['...kfffehfffffehfk......', '...kfffeefffffeefk......', '...kfffeefffffeefk......'],
  blink: ['...kfffffffffffffk......', '...kfffffffffffffk......', '...kfffkkfffffkkfk......'],
  hurt: ['...kfffkfffffffkfk......', '...kffffkfffffkffk......', '...kfffkfffffffkfk......'],
  scared: ['...kfffhhfffffhhfk......', '...kfffhefffffehfk......', '...kfffhhfffffhhfk......'],
};

const KITTEN_LEGS = {
  idle: [
    'cC.kssSk..kssSk.........',
    'cCCksSdk..ksSdk.........',
    'cC.kdddk..kdddk.........',
    '.C.kssSk..kssSk.........',
    '...ksSdk..ksSdk.........',
    '...ksssSk.ksssSk........',
    '...kkkkkk.kkkkkk........',
  ],
  stepA: [
    'cC.kssSk...kssSk........',
    'cCksSdk....ksSdk........',
    'cCkdddk.....kdddk.......',
    '.kssSk......kssSk.......',
    '.ksSdk......ksSdk.......',
    '.ksssSk.....ksssSk......',
    '.kkkkkk.....kkkkkk......',
  ],
  stepB: [
    'cC.kssSk.kssSk..........',
    'cCCksSdk.ksSdk..........',
    'cC.kdddk.kdddk..........',
    '.C.kssSk.kssSk..........',
    '...ksSdk.kkkkkk.........',
    '...ksssSk...............',
    '...kkkkkk...............',
  ],
  jump: [
    'cC.kssSkkssSk...........',
    'cCCksSdkksSdk...........',
    '.C.ksssSksssSk..........',
    '...kkkkkkkkkkk..........',
    '........................',
    '........................',
    '........................',
  ],
};

const SPRITE_DEFS = {
  alarm: {
    rows: [
      '.kkk....kkk.',
      'kyyyk..kyyyk',
      'kyykkkkkkyyk',
      '.kkrrrrrrkk.',
      '.krhhhhhhrk.',
      'krhhhhhhhhrk',
      'krhhhhhhhhrk',
      'krhhhhhhhhrk',
      'krhhhkkhhhrk',
      '.krhhhhhhrk.',
      '..krrrrrrk..',
      '.kk.kkkk.kk.',
    ],
    eyes: [[3, 5], [7, 5]],
  },
  email: {
    rows: [
      'kkkkkkkkkkkk',
      'kxkxxxxxxkxk',
      'kxxkxxxxkxxk',
      'kxxxkxxkxxxk',
      'kxxxxkkxxxxk',
      'kxxxxxxxxxxk',
      'kxxxxxxxxxxk',
      'kxxxxxxxxxxk',
      'kzzzzzzzzzzk',
      'kkkkkkkkkkkk',
    ],
    eyes: [[2, 6], [8, 6]],
  },
  sock: {
    rows: [
      '.kkkkkk...',
      '.krrrrk...',
      '.khhhhk...',
      '.krrrrk...',
      '.khhhhk...',
      '.khhhhk...',
      '.khhhhk...',
      '.khhhhkk..',
      '.khhhhhhk.',
      '.krrrrrrrk',
      '.khhhhhhhk',
      '..kkkkkkk.',
    ],
    eyes: [[2, 5], [4, 5]],
    eyeSize: 1,
  },
  bell: {
    rows: [
      '.....kk..rr.',
      '....kyyk.rhr',
      '...kyyyyk.r.',
      '..kyyyyyyk..',
      '..kyyyyyyk..',
      '..kyyyyyyk..',
      '.kyyyyyyyyk.',
      '.kyyyyyyyyk.',
      'kyyyyyyyyyyk',
      'kYYYYYYYYYYk',
      'kkkkkkkkkkkk',
      '.....kk.....',
    ],
    eyes: [[3, 5], [7, 5]],
  },
  bill: {
    rows: [
      'kkkkkkkkkk',
      'kxxxxxxxxk',
      'kxxxxxxxxk',
      'kxxxxxxxxk',
      'kxxxxxxxxk',
      'kxzzzzzzxk',
      'kxxxxxxxxk',
      'kxzzzzxxxk',
      'kxxxxxxxxk',
      'kxxxxxrrxk',
      'kxzxzxzxzk',
      'k.k.k.k.k.',
    ],
    eyes: [[2, 2], [6, 2]],
  },
  mosquito: {
    rows: [
      '...qq.qq..',
      '..qqqqqq..',
      '.NNNNNNNk.',
      'NNNNNNNrkk',
      '.NNNNNNN..',
      '.k.k.k....',
      'k.k.k.....',
    ],
  },
  duck: {
    rows: [
      '...kkk....',
      '..kyyyk...',
      '..kyyykoo.',
      '..kyyykOk.',
      'kk.kyyk...',
      'kykkyyykk.',
      'kyyyyyyyyk',
      'kYyyyyyyYk',
      '.kYYYYYYk.',
      '..kkkkkk..',
    ],
    eyes: [[4, 1]],
    eyeSize: 1,
  },

  cucumber: {
    big: true,
    rows: [
      '....kkkk....',
      '...kvvvvk...',
      '..kvlvvvVk..',
      '..kvlvvvVk..',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvvvkkvvVk.',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvlvvvvvVk.',
      '.kvvvvvvvVk.',
      '.kvlvvvvvVk.',
      '..kvvvvvVk..',
      '..kvvvvvVk..',
      '...kVVVVk...',
      '....kkkk....',
    ],
    eyes: [[3, 6], [7, 6]],
  },
  monday: {
    big: true,
    rows: [
      '...nn......nn.....',
      'kkknnkkkkkknnkkkkk',
      'krrrrrrrrrrrrrrrrk',
      'krrhhhhhrhhhrhhhrk',
      'krrhrhrhrhrhrhrhrk',
      'krrhrhrhrhhhrhrhrk',
      'krrrrrrrrrrrrrrrrk',
      'kxxxxxxxxxxxxxxxxk',
      'kxzxxzxxzxxzxxzxxk',
      'kxxxxxxxxxxxxxxxxk',
      'kxxxxxxxxxxxxxxxxk',
      'kxxxxxxxxxxxxxxxxk',
      'kxxxxxxxxxxxxxxxxk',
      'kxxxxxxkkkkxxxxxxk',
      'kxxxxxkxxxxkxxxxxk',
      'kxzxxzxxzxxzxxzxxk',
      'kzzzzzzzzzzzzzzzzk',
      'kkkkkkkkkkkkkkkkkk',
    ],
    eyes: [[5, 10], [11, 10]],
  },
  vacuum: {
    big: true,
    rows: [
      'kkkk..........',
      'kNNk..........',
      '.kNk..........',
      '..kNk.........',
      '...kNk........',
      '...kkkkkkkk...',
      '..krrrrrrrrk..',
      '..krrrrrrrRk..',
      '..krrrrrrrRk..',
      '..krrrrrrrRk..',
      '..krrrrrrrRk..',
      '..krrrrrrrRk..',
      '..krrrrrrrRk..',
      '..krrrkkkrRk..',
      '..krrkrrrkRk..',
      '..krrrrrrrRk..',
      '..kNNNNNNNNk..',
      'kkkNNNNNNNNNNk',
      'kNNNNNNNNNNNNk',
      'kkkkkkkkkkkkkk',
      '.kk.......kk..',
    ],
    eyes: [[4, 9], [8, 9]],
  },
  bath: {
    big: true,
    rows: [
      '..q...qq...q..........',
      '.qhq.qhhq.qhq.....kkk.',
      '..q...qq...q......kNk.',
      'kkkkkkkkkkkkkkkkkkkkkk',
      'kQQQQQQQQQQQQQQQQQQQQk',
      'khhhhhhhhhhhhhhhhhhhhk',
      'khhhhhhhhhhhhhhhhhhhhk',
      'khhhhhhhhhhhhhhhhhhhhk',
      'khhhhhhhhhhhhhhhhhhhhk',
      'khhhhhhhkkkkkkhhhhhhhk',
      '.khhhhhkhhhhhhkhhhhhk.',
      '.khhhhhhhhhhhhhhhhhhk.',
      '..kkkkkkkkkkkkkkkkkk..',
      '..kk..............kk..',
    ],
    eyes: [[6, 6], [14, 6]],
  },

  heart: { rows: ['.kk.kk.', 'krhkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'] },
  heartEmpty: { rows: ['.kk.kk.', 'kNNkNNk', 'kNNNNNk', '.kNNNk.', '..kNk..', '...k...'] },
  invite: { rows: ['kkkkkkk', 'kxkxkxk', 'kxxkxxk', 'kxxrxxk', 'kkkkkkk'] },
  droplet: { rows: ['.q.', 'qhq', 'qQq', '.Q.'] },
  fish: { rows: ['.kkkk..k.', 'kqqqqkkqk', 'kqeqqqqqk', 'kQQQQkkQk', '.kkkk..k.'] },
  yarn: { rows: ['..kkk..', '.kpPpk.', 'kpPpPpk', 'kPpPpPk', 'kpPpPpk', '.kpPpk.', '..kkkPP'] },
  catnip: { rows: ['...k...', '..kvk..', '.kvlvk.', 'kvlvVvk', '.kvVvk.', '..kVk..', '...k...'] },
};

// ---------------------------------------------------------------------------
// Sprite building
// ---------------------------------------------------------------------------
function stampEyes(grid, def) {
  if (!def.eyes) return;
  const size = def.eyeSize || 2;
  const set = (x, y, c) => {
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[y].length) grid[y][x] = c;
  };
  def.eyes.forEach(([x, y], i) => {
    const left = i === 0;
    if (size === 1) {
      set(x, y, 'e');
      if (def.eyes.length < 2) return;
      if (left) { set(x - 1, y - 2, 'k'); set(x, y - 1, 'k'); }
      else { set(x, y - 1, 'k'); set(x + 1, y - 2, 'k'); }
      return;
    }
    set(x, y, 'e'); set(x + 1, y, 'h'); set(x, y + 1, 'e'); set(x + 1, y + 1, 'e');
    if (left) {
      set(x - 1, y - 2, 'k'); set(x, y - 2, 'k'); set(x + 1, y - 1, 'k'); set(x + 2, y - 1, 'k');
    } else {
      set(x - 1, y - 1, 'k'); set(x, y - 1, 'k'); set(x + 1, y - 2, 'k'); set(x + 2, y - 2, 'k');
    }
  });
}

// Scale2x / EPX: doubles a pixel grid while rounding off diagonal staircases.
function scale2x(grid) {
  const h = grid.length, w = grid[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : grid[y][x]);
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (C === A && C !== D && A !== B) p1 = A;
      if (A === B && A !== C && B !== D) p2 = B;
      if (D === C && D !== B && C !== A) p3 = C;
      if (B === D && B !== A && D !== C) p4 = D;
      out[y * 2][x * 2] = p1; out[y * 2][x * 2 + 1] = p2;
      out[y * 2 + 1][x * 2] = p3; out[y * 2 + 1][x * 2 + 1] = p4;
    }
  }
  return out;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// Draws a grid with simple automatic shading: pixels touching the edge
// above get a highlight, pixels touching the edge below get a shadow.
function renderGrid(grid, flip, solid, pal = PALETTE) {
  const h = grid.length, w = grid[0].length;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  const edge = (x, y) => {
    const ch = y < 0 || y >= h || x < 0 || x >= w ? '.' : grid[y][x];
    return ch === '.' || ch === 'k';
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (!ch || ch === '.') continue;
      let col = pal[ch] || '#ff00ff';
      if (solid) col = solid;
      else if (!NO_SHADE.has(ch)) {
        if (edge(x, y + 1)) col = shade(col, -0.16);
        else if (edge(x, y - 1)) col = shade(col, 0.14);
      }
      c.fillStyle = col;
      c.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
  return cv;
}

function makeSprite(grid, pal = PALETTE) {
  return {
    w: grid[0].length, h: grid.length,
    img: [renderGrid(grid, false, null, pal), renderGrid(grid, true, null, pal)],
    white: [renderGrid(grid, false, '#ffffff', pal), renderGrid(grid, true, '#ffffff', pal)],
  };
}

const toGrid = rows => {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(w, '.').split(''));
};

function buildSprites() {
  const out = {};
  for (const [name, def] of Object.entries(SPRITE_DEFS)) {
    let grid = toGrid(def.rows);
    stampEyes(grid, def);
    if (def.big) grid = scale2x(grid);
    out[name] = makeSprite(grid);
  }
  out.cats = buildCats();
  Object.assign(out, buildProps());
  return out;
}

// Kitten animation frames (one face + one pair of legs each), recoloured
// with the equipped cape, bow and armor.
function buildKitten(look) {
  const pal = { ...PALETTE };
  if (look) {
    Object.assign(pal, { c: look.cape.c, C: look.cape.C, s: look.armor.s, S: look.armor.S, d: look.armor.d, 5: look.bow.p, 6: look.bow.P });
  } else Object.assign(pal, { 5: PALETTE.p, 6: PALETTE.P });
  const kit = (face, legs) => {
    const rows = KITTEN_TOP.slice();
    rows.splice(5, 3, ...KITTEN_FACES[face]);
    const grid = toGrid([...rows, ...KITTEN_LEGS[legs]]);
    // The bow sits on the right ear; give it its own colours.
    for (let y = 0; y < 3; y++) for (let x = 16; x < grid[y].length; x++) {
      if (grid[y][x] === 'p') grid[y][x] = '5';
      else if (grid[y][x] === 'P') grid[y][x] = '6';
    }
    return makeSprite(grid, pal);
  };
  return {
    idle: kit('open', 'idle'), blink: kit('blink', 'idle'),
    stepA: kit('open', 'stepA'), stepB: kit('open', 'stepB'),
    jump: kit('open', 'jump'), hurt: kit('hurt', 'jump'),
    scared: kit('scared', 'jump'), sleep: kit('blink', 'idle'),
  };
}

// ---------------------------------------------------------------------------
// Rescued cats for Journey mode: one running sprite, many coats.
// ---------------------------------------------------------------------------
const CAT_ROWS = [
  '.........k...k..',
  '........kfk.kfk.',
  '........kfffffk.',
  '.k......kfefefk.',
  'kfk.....kffpffk.',
  '.kfkkkkkkfffffk.',
  '..kfffffffffffk.',
  '..kfffffffffFk..',
  '..kFFkkkkkkFFk..',
];
const CAT_LEGS = [
  ['..kfk.....kfk...', '..kk......kk....'],
  ['....kfk.kfk.....', '....kk...kk.....'],
];

// tier: 0 common, 1 uncommon (1 km), 2 rare (3 km), 3 very rare (6 km), 4 legendary (10 km)
const CAT_BREEDS = [
  { id: 'tabby', name: 'Tabby', tier: 0, f: '#d9a35f', F: '#a8743a', marks: [[5, 6, 'F'], [7, 6, 'F'], [9, 6, 'F'], [10, 2, 'F'], [12, 2, 'F']] },
  { id: 'gray', name: 'Gray Shorthair', tier: 0, f: '#a3a9ae', F: '#6e767e' },
  { id: 'ginger', name: 'Ginger', tier: 0, f: '#ec9a4a', F: '#b86a2a', marks: [[4, 6, 'F'], [6, 6, 'F'], [8, 6, 'F']] },
  { id: 'black', name: 'Black Cat', tier: 0, f: '#3c3636', F: '#241f1f', e: '#f2c94c' },
  { id: 'white', name: 'Snowball', tier: 0, f: '#f6f2ea', F: '#c9c2b6' },
  { id: 'tuxedo', name: 'Tuxedo', tier: 1, f: '#3c3636', F: '#241f1f', e: '#9fd6ef', marks: [[12, 4, 'h'], [12, 5, 'h'], [13, 5, 'h'], [12, 6, 'h'], [3, 9, 'h'], [11, 9, 'h']] },
  { id: 'calico', name: 'Calico', tier: 1, f: '#f6f2ea', F: '#c9c2b6', marks: [[4, 6, 'o'], [5, 6, 'o'], [5, 7, 'o'], [8, 6, 'k'], [9, 6, 'k'], [9, 2, 'o'], [10, 2, 'o'], [13, 2, 'k']] },
  { id: 'siamese', name: 'Siamese', tier: 1, f: '#f1e4cc', F: '#6b4a32', e: '#5aa7d1', marks: [[11, 4, 'F'], [12, 4, 'F'], [9, 1, 'F'], [13, 1, 'F'], [3, 9, 'F'], [11, 9, 'F'], [0, 4, 'F'], [1, 3, 'F']] },
  { id: 'blue', name: 'Russian Blue', tier: 2, f: '#7d8aa3', F: '#566176', e: '#7cc35a' },
  { id: 'sphynx', name: 'Sphynx', tier: 2, f: '#e9bfae', F: '#c98f7c', marks: [[6, 7, 'F'], [7, 6, 'F']] },
  { id: 'coon', name: 'Maine Coon', tier: 2, f: '#8a6a4a', F: '#5e4430', marks: [[0, 4, 'F'], [1, 3, 'f'], [5, 6, 'F'], [8, 6, 'F']] },
  { id: 'ghost', name: 'Ghost Cat', tier: 3, f: '#dfeefa', F: '#a8c4dc', e: '#5aa7d1', ghost: true },
  { id: 'galaxy', name: 'Galaxy Cat', tier: 3, f: '#3b2f6b', F: '#231a45', e: '#f2c94c', marks: [[5, 6, 'h'], [9, 7, 'y'], [11, 3, 'h'], [7, 6, 'q']] },
  { id: 'lucky', name: 'Lucky Cat', tier: 4, f: '#f2c94c', F: '#b8892a', e: '#141414', marks: [[9, 5, 'r'], [10, 5, 'r'], [11, 5, 'g'], [12, 5, 'r'], [13, 5, 'r']] },
];
const CAT_TIERS = [
  { label: '', weight: 100, unlock: 0 },
  { label: 'UNCOMMON', weight: 40, unlock: 1 },
  { label: 'RARE', weight: 16, unlock: 3 },
  { label: 'VERY RARE', weight: 6, unlock: 6 },
  { label: 'LEGENDARY', weight: 2, unlock: 10 },
];

function buildCats() {
  const out = {};
  for (const b of CAT_BREEDS) {
    const pal = { ...PALETTE, f: b.f, F: b.F, e: b.e || '#141414' };
    out[b.id] = CAT_LEGS.map(legs => {
      const grid = toGrid([...CAT_ROWS, ...legs]);
      for (const [x, y, c] of b.marks || []) if (grid[y][x] === 'f' || grid[y][x] === 'F') grid[y][x] = c;
      return makeSprite(grid, pal);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Procedural pixel art for props: drawn pixel by pixel with shading + outline
// ---------------------------------------------------------------------------
function pixCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  draw((x, y, col) => { if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }, c);
  return cv;
}

// Like pixCanvas but writes straight into ImageData, for large images.
// `colorAt(x, y)` returns a '#rrggbb' string or null for transparent.
const rgbCache = new Map();
function fastCanvas(w, h, colorAt) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  const img = c.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = colorAt(x, y);
      if (!col) continue;
      let rgb = rgbCache.get(col);
      if (!rgb) { rgb = hexToRgb(col); rgbCache.set(col, rgb); }
      const i = (y * w + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// Fills a shape given by inside(x, y) with outline, highlight, mid and shadow.
function blob(w, h, inside, pal, noise = 0.12, rnd = Math.random) {
  const [outline, dark, mid, light] = pal;
  return fastCanvas(w, h, (x, y) => {
    if (!inside(x, y)) return null;
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) return outline;
    let col = mid;
    if (!inside(x - 1, y - 2) || !inside(x, y - 2)) col = light;
    else if (!inside(x + 1, y + 2) || !inside(x + 2, y + 1)) col = dark;
    if (rnd() < noise) col = col === light ? mid : col === mid ? (rnd() < 0.5 ? light : dark) : mid;
    return col;
  });
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function buildProps() {
  const out = {};
  const rnd = seeded(7);
  // Props are drawn with their anchor (ox, oy) at the object's foot position.
  const asProp = (cv, ox, oy) => ({ w: cv.width, h: cv.height, img: [cv, cv], ox, oy });

  out.trees = [0, 1].map(variant => {
    const W = 36, H = 48;
    const circles = variant
      ? [[18, 14, 11], [10, 20, 8], [26, 19, 9], [18, 25, 9]]
      : [[18, 12, 10], [11, 19, 9], [25, 21, 8], [17, 26, 10], [27, 12, 6]];
    const inCanopy = (x, y) => circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
    const canopy = blob(W, H, inCanopy, ['#1c3519', '#2c5527', '#3f7a35', '#6aa64c'], 0.18, rnd);
    const cv = pixCanvas(W, H, (px, c) => {
      for (let y = 26; y < H - 1; y++) {
        for (let x = 15; x < 21; x++) {
          const col = x === 15 || x === 20 ? '#2b2220' : x === 16 ? '#8a5d34' : x > 18 ? '#4a2d16' : '#6b4423';
          px(x, y, rnd() < 0.15 && x > 15 && x < 20 ? '#4a2d16' : col);
        }
      }
      for (let x = 13; x < 23; x++) px(x, H - 1, '#2b2220');
      px(13, H - 2, '#2b2220'); px(22, H - 2, '#2b2220'); px(14, H - 2, '#6b4423'); px(21, H - 2, '#4a2d16');
      c.drawImage(canopy, 0, 0);
      for (let i = 0; i < 4; i++) px(8 + Math.floor(rnd() * 20), 10 + Math.floor(rnd() * 14), '#e8705a');
    });
    return asProp(cv, 18, 47);
  });

  out.rocks = [[14, 9], [10, 7], [18, 11]].map(([w, h], i) => {
    const r2 = seeded(30 + i);
    const b0 = r2() * 6, b1 = r2() * 6;
    const inside = (x, y) => {
      const nx = (x - w / 2 + 0.5) / (w / 2), ny = (y - h + 0.5) / (h - 0.5);
      if (ny > 0) return false;
      const a = Math.atan2(ny, nx);
      const rr = 1 + 0.12 * Math.sin(a * 3 + b0) + 0.08 * Math.sin(a * 5 + b1);
      return nx * nx + ny * ny < rr * rr;
    };
    const cv = blob(w, h, inside, ['#2b2220', '#5f646b', '#8b9096', '#b8bdc1'], 0.1, r2);
    const c = cv.getContext('2d');
    c.fillStyle = '#5f8f3b';
    for (let k = 0; k < 3; k++) c.fillRect(2 + Math.floor(r2() * (w - 5)), 2 + Math.floor(r2() * 2), 2, 1);
    return asProp(cv, Math.floor(w / 2), h - 1);
  });

  // Hay bale, three frames so it visibly rolls.
  out.bale = [0, 1, 2].map(off => {
    const W = 16, H = 12;
    const r3 = seeded(50);
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const rx = x < 3 ? 3 - x : x > W - 4 ? x - (W - 4) : 0;
      const ry = y < 3 ? 3 - y : y > H - 4 ? y - (H - 4) : 0;
      return rx * rx + ry * ry <= 9;
    };
    const cv = blob(W, H, inside, ['#4a3512', '#b08d34', '#e2c063', '#f6e09a'], 0.2, r3);
    const c = cv.getContext('2d');
    c.fillStyle = '#c9a64a';
    for (let x = 2 + off; x < W - 2; x += 3) {
      for (let y = 2; y < H - 2; y++) if (inside(x, y)) c.fillRect(x, y, 1, 1);
    }
    c.fillStyle = '#7a4b26';
    for (const x of [5, 10]) c.fillRect(x, 1, 1, H - 2);
    return asProp(cv, 8, 11);
  });

  out.crate = asProp(pixCanvas(12, 12, px => {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const edge = x === 0 || y === 0 || x === 11 || y === 11;
        const frame = x === 1 || y === 1 || x === 10 || y === 10;
        const brace = x === y || x === 11 - y;
        let col = edge ? '#2b2220' : frame ? '#7a4b26' : brace ? '#8a5d34' : (y % 3 === 0 ? '#9a6a3a' : '#b07c45');
        if (!edge && y === 10) col = '#5e3c1f';
        px(x, y, col);
      }
    }
    for (const [x, y] of [[1, 1], [10, 1], [1, 10], [10, 10]]) px(x, y, '#e6c15e');
  }), 6, 11);

  out.butterfly = [
    pixCanvas(5, 3, px => { px(0, 0, '#f4a3b8'); px(1, 1, '#f4a3b8'); px(2, 1, '#2b2220'); px(3, 1, '#f4a3b8'); px(4, 0, '#f4a3b8'); px(0, 2, '#d9668a'); px(4, 2, '#d9668a'); }),
    pixCanvas(5, 3, px => { px(1, 1, '#f4a3b8'); px(2, 1, '#2b2220'); px(3, 1, '#f4a3b8'); px(2, 0, '#d9668a'); }),
  ];
  out.bird = [
    pixCanvas(6, 4, px => {
      px(1, 1, '#4a2d16'); px(2, 1, '#7a4b26'); px(3, 1, '#7a4b26'); px(4, 0, '#7a4b26'); px(5, 0, '#e6c15e');
      px(1, 2, '#4a2d16'); px(2, 2, '#9a6a3a'); px(3, 2, '#9a6a3a'); px(2, 3, '#2b2220'); px(3, 3, '#2b2220');
    }),
    pixCanvas(6, 4, px => {
      px(0, 0, '#4a2d16'); px(1, 1, '#4a2d16'); px(2, 2, '#7a4b26'); px(3, 2, '#7a4b26'); px(4, 1, '#4a2d16'); px(5, 0, '#4a2d16');
    }),
  ];

  // A haystack: two bales with a third on top. Tall enough to stand on.
  out.stack = (() => {
    const cv = pixCanvas(22, 20, (px, c) => {
      c.drawImage(out.bale[0].img[0], 0, 8);
      c.drawImage(out.bale[1].img[0], 6, 8);
      c.drawImage(out.bale[2].img[0], 3, 0);
    });
    return asProp(cv, 11, 19);
  })();

  out.bush = [0, 1].map(v => {
    const r4 = seeded(80 + v);
    const w = v ? 18 : 14, h = v ? 11 : 9;
    const circles = v ? [[5, 6, 5], [11, 5, 6], [14, 7, 4]] : [[4, 5, 4], [9, 4, 5], [11, 6, 3]];
    const inside = (x, y) => y < h && circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
    const cv = blob(w, h, inside, ['#1c3519', '#2c5527', '#3f7a35', '#6aa64c'], 0.2, r4);
    const c = cv.getContext('2d');
    c.fillStyle = v ? '#f4a3b8' : '#ffffff';
    for (let i = 0; i < 3; i++) c.fillRect(3 + Math.floor(r4() * (w - 6)), 2 + Math.floor(r4() * (h - 5)), 1, 1);
    return asProp(cv, Math.floor(w / 2), h - 1);
  });

  out.stump = asProp(pixCanvas(12, 9, px => {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
      const top = ((x - 5.5) / 6) ** 2 + ((y - 2.5) / 2.6) ** 2 < 1;
      const side = y >= 2 && x >= 0 && x < 12 && y < 8 && Math.abs(x - 5.5) < 6;
      if (top) {
        const edge = ((x - 5.5) / 6) ** 2 + ((y - 2.5) / 2.6) ** 2 > 0.55;
        const ring = Math.abs(((x - 5.5) / 3.5) ** 2 + ((y - 2.5) / 1.5) ** 2 - 1) < 0.35;
        px(x, y, edge ? '#5e3c1f' : ring ? '#b07c45' : '#d9b07a');
      } else if (side) px(x, y, x === 0 || x === 11 || y === 7 ? '#2b2220' : x > 7 ? '#4a2d16' : x % 3 === 0 ? '#5e3c1f' : '#6b4423');
    }
    for (const x of [1, 10]) px(x, 8, '#2b2220');
  }), 6, 8);

  out.well = asProp(pixCanvas(18, 24, px => {
    // Roof.
    for (let y = 0; y < 5; y++) for (let x = 1 + (4 - y); x < 17 - (4 - y); x++) px(x, y, y === 4 || x === 1 + (4 - y) || x === 16 - (4 - y) ? '#2b2220' : y % 2 ? '#8f2a25' : '#b23a32');
    // Posts.
    for (let y = 5; y < 14; y++) { px(3, y, '#5e3c1f'); px(14, y, '#5e3c1f'); px(4, y, '#8a5d34'); px(13, y, '#4a2d16'); }
    for (let x = 4; x < 14; x++) px(x, 7, '#4a2d16');
    px(9, 8, '#8b9096'); px(9, 9, '#8b9096'); px(8, 10, '#7a4b26'); px(9, 10, '#9a6a3a'); px(10, 10, '#7a4b26');
    // Stone ring.
    for (let y = 12; y < 24; y++) for (let x = 0; x < 18; x++) {
      const ex = (x - 8.5) / 9;
      if (Math.abs(ex) >= 1) continue;
      const rim = ((x - 8.5) / 9) ** 2 + ((y - 14) / 3) ** 2 < 1;
      const hole = ((x - 8.5) / 6) ** 2 + ((y - 14) / 1.6) ** 2 < 1;
      if (y <= 16 && rim) { px(x, y, hole ? '#141414' : '#b8bdc1'); continue; }
      if (y > 14 && y < 23) {
        const brick = ((y + (Math.floor(x / 3) % 2)) % 3 === 0) || x % 3 === 0;
        px(x, y, x === 0 || x === 17 ? '#2b2220' : brick ? '#5f646b' : x > 11 ? '#7d8288' : '#8b9096');
      }
      if (y === 23 && Math.abs(ex) < 0.95) px(x, y, '#2b2220');
    }
  }), 9, 23);

  out.sign = asProp(pixCanvas(14, 16, px => {
    for (let y = 4; y < 16; y++) { px(6, y, '#5e3c1f'); px(7, y, '#8a5d34'); }
    for (let y = 0; y < 7; y++) for (let x = 0; x < 14; x++) {
      const edge = y === 0 || y === 6 || x === 0 || x === 13;
      px(x, y, edge ? '#2b2220' : y === 3 ? '#9a6a3a' : '#b07c45');
    }
    // Little arrows painted on the board.
    for (const [x, y] of [[3, 2], [2, 3], [3, 4], [4, 3], [5, 3], [10, 2], [11, 3], [10, 4], [9, 3], [8, 3]]) px(x, y, '#f1ead8');
  }), 7, 15);

  // Journey obstacles.
  out.log = asProp(pixCanvas(22, 9, px => {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 22; x++) {
      const endCap = x > 17 && ((x - 19) / 2.6) ** 2 + ((y - 4) / 4.4) ** 2 < 1;
      const body = x <= 19 && y > 0 && y < 8;
      if (endCap) {
        const ring = Math.abs(((x - 19) / 1.6) ** 2 + ((y - 4) / 2.6) ** 2 - 1) < 0.4;
        px(x, y, ((x - 19) / 2.6) ** 2 + ((y - 4) / 4.4) ** 2 > 0.7 ? '#2b2220' : ring ? '#b07c45' : '#d9b07a');
      } else if (body) px(x, y, y === 1 || y === 7 || x === 0 ? '#2b2220' : y < 3 ? '#8a5d34' : (x + y * 3) % 7 === 0 ? '#4a2d16' : '#6b4423');
    }
    px(6, 0, '#3f7d2f'); px(7, 0, '#6aa64c');
  }), 11, 8);

  out.cactus = asProp(pixCanvas(13, 19, px => {
    const inside = (x, y) => (Math.abs(x - 6) <= 2 && y >= 1 && y < 19) ||
      (x >= 1 && x <= 3 && y >= 5 && y <= 11) || (x >= 1 && x <= 5 && y >= 10 && y <= 12) ||
      (x >= 9 && x <= 11 && y >= 3 && y <= 9) || (x >= 7 && x <= 11 && y >= 8 && y <= 10);
    for (let y = 0; y < 19; y++) for (let x = 0; x < 13; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      px(x, y, edge ? '#1c3519' : x % 2 ? '#3f7a35' : '#5f9a45');
    }
    px(6, 0, '#f4a3b8'); px(5, 1, '#f4a3b8'); px(7, 1, '#f4a3b8');
  }), 6, 18);

  out.tumbleweed = [0, 1, 2, 3].map(rot => {
    const r5 = seeded(90 + rot);
    const cv = pixCanvas(12, 12, px => {
      for (let i = 0; i < 70; i++) {
        const a = r5() * Math.PI * 2 + rot * 0.4, rr = 2 + r5() * 3.6;
        px(Math.round(6 + Math.cos(a) * rr), Math.round(6 + Math.sin(a) * rr), r5() < 0.4 ? '#7a5a2e' : r5() < 0.6 ? '#b08d4a' : '#5e4424');
      }
    });
    return asProp(cv, 6, 11);
  });

  out.cone = asProp(pixCanvas(9, 11, px => {
    for (let y = 0; y < 11; y++) {
      const half = y === 10 ? 4 : Math.floor(y / 3) + 1;
      for (let x = 4 - half; x <= 4 + half; x++) {
        const edge = x === 4 - half || x === 4 + half || y === 0 || y === 10;
        px(x, y, edge ? '#2b2220' : (y === 4 || y === 5) ? '#ffffff' : x > 4 ? '#c25e22' : '#ee8b3a');
      }
    }
  }), 4, 10);

  out.barn = buildBarn();
  out.cottage = [false, true].map(night => buildCottage(night));
  return out;
}

// A red barn with a gambrel roof and a big X door.
function buildBarn() {
  const W = 64, H = 52;
  const cv = pixCanvas(W, H, px => {
    const roofBot = 22;
    for (let y = 2; y <= roofBot; y++) {
      const k = (y - 2) / (roofBot - 2);
      const half = Math.round(k < 0.45 ? 10 + k * 40 : 28 + (k - 0.45) * 8);
      for (let x = 32 - half; x < 32 + half; x++) {
        if (x < 0 || x >= W) continue;
        const edge = x === 32 - half || x === 32 + half - 1 || y === 2 || y === roofBot;
        const shingle = (y % 3 === 0) ? '#4a2d16' : x >= 32 ? '#6b4423' : '#7a4b26';
        px(x, y, edge ? '#2b2220' : shingle);
      }
    }
    for (let y = roofBot + 1; y < H; y++) for (let x = 4; x < 60; x++) {
      const edge = x === 4 || x === 59 || y === H - 1;
      const trim = x === 5 || x === 58 || y === roofBot + 1;
      const plank = x % 4 === 0;
      px(x, y, edge ? '#2b2220' : trim ? '#f1ead8' : plank ? '#a8352e' : x > 44 ? '#b23a32' : '#c63d35');
    }
    // Big door with a white X.
    for (let y = 32; y < H - 1; y++) for (let x = 22; x < 42; x++) {
      const edge = x === 22 || x === 41 || y === 32;
      const xx = (x - 22) / 19, yy = (y - 32) / (H - 34);
      const cross = Math.abs(xx - yy) < 0.07 || Math.abs(xx - (1 - yy)) < 0.07 || x === 23 || x === 40 || y === 33 || x === 31 || x === 32;
      px(x, y, edge ? '#2b2220' : cross ? '#f1ead8' : '#8f2a25');
    }
    // Hayloft window with hay poking out.
    for (let y = 9; y < 17; y++) for (let x = 27; x < 37; x++) {
      const edge = x === 27 || x === 36 || y === 9 || y === 16;
      px(x, y, edge ? '#f1ead8' : y > 12 ? (x % 2 ? '#e2c063' : '#b08d34') : '#2b2220');
    }
  });
  return { w: W, h: H, img: [cv, cv], ox: 32, oy: H - 1 };
}

// The Human's cottage: timber walls, red roof, and a window showing the sleeping Human.
function buildCottage(night) {
  const W = 48, H = 44;
  const cv = pixCanvas(W, H, px => {
    const roofTop = 4, roofBottom = 21, wallBottom = H - 1;
    for (let y = 2; y < 14; y++) for (let x = 33; x < 38; x++) {
      px(x, y, x === 33 || x === 37 || y === 2 ? '#2b2220' : (x + y) % 3 === 0 ? '#5f646b' : '#8b9096');
    }
    for (let y = roofTop; y <= roofBottom; y++) {
      const half = Math.round((y - roofTop) * 1.35) + 2;
      for (let x = 24 - half; x < 24 + half; x++) {
        if (x < 0 || x >= W) continue;
        const edge = x === 24 - half || x === 24 + half - 1 || y === roofBottom;
        const row = (y - roofTop) % 3 === 0;
        const right = x >= 24;
        let col = row ? '#8f2a25' : right ? '#b23a32' : '#d8433b';
        if ((x + Math.floor(y / 3)) % 4 === 0 && !row) col = right ? '#9c322b' : '#c63d35';
        px(x, y, edge ? '#2b2220' : col);
      }
    }
    for (let y = roofBottom + 1; y <= wallBottom; y++) {
      for (let x = 6; x < 42; x++) {
        const edge = x === 6 || x === 41 || y === wallBottom;
        const beam = x === 7 || x === 40 || x === 23 || x === 24 || y === roofBottom + 1 || y === 32;
        const brace = y > 32 && (x - 8 === y - 33 || 39 - x === y - 33);
        let col = x > 32 ? '#d7ccb3' : '#ebe2cc';
        if (beam || brace) col = '#5e3c1f';
        px(x, y, edge ? '#2b2220' : col);
      }
    }
    for (let y = 31; y < wallBottom; y++) for (let x = 20; x < 28; x++) {
      const edge = x === 20 || x === 27 || y === 31;
      px(x, y, edge ? '#2b2220' : x % 2 === 0 ? '#8a5d34' : '#7a4b26');
    }
    px(25, 37, '#e6c15e');
    const glass = night ? '#ffe39a' : '#9fd6ef';
    for (let y = 25; y < 31; y++) for (let x = 10; x < 17; x++) {
      const edge = x === 10 || x === 16 || y === 25 || y === 30;
      px(x, y, edge ? '#2b2220' : x === 13 || y === 27 ? '#5e3c1f' : glass);
    }
    // The sleeping Human: pillow, head, blue blanket.
    for (let y = 24; y < 32; y++) for (let x = 29; x < 39; x++) {
      const edge = x === 29 || x === 38 || y === 24 || y === 31;
      px(x, y, edge ? '#2b2220' : night ? '#f7d58a' : '#b9e2f3');
    }
    for (let x = 30; x < 33; x++) for (let y = 27; y < 29; y++) px(x, y, '#ffffff');
    px(31, 26, '#4a2d16'); px(32, 26, '#4a2d16'); px(31, 27, '#e8b897'); px(32, 27, '#e8b897');
    for (let x = 33; x < 38; x++) { px(x, 28, '#5b8ee0'); px(x, 29, '#2f4f8a'); }
    for (let x = 30; x < 38; x++) px(x, 30, '#2f4f8a');
    for (let x = 9; x < 18; x++) px(x, 31, '#5e3c1f');
    for (const x of [10, 12, 14, 16]) px(x, 30, x % 4 ? '#f4a3b8' : '#f2c94c');
  });
  return { w: W, h: H, img: [cv, cv], ox: 24, oy: H - 1 };
}
