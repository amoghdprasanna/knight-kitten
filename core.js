'use strict';

// ---------------------------------------------------------------------------
// Shared setup: the pixel canvas, helpers, saved progress and cosmetics.
//
// The canvas is sized in whole "game pixels" so it fills any screen (iPad,
// phone, desktop) at an integer scale; the sharp UI canvas sits on top.
// ---------------------------------------------------------------------------
const STEP = 1 / 60;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 240, H = 144, PXS = 1;
// The game is drawn in "game pixels", but the canvas itself has one pixel
// per CSS pixel (RS of them per game pixel). Sprites stay blocky, while the
// camera and the kitten can sit between game pixels, so scrolling is smooth.
let RS = 1;
// How far the display is between the last two simulation steps (0..1).
let RALPHA = 1;
const rpx = v => Math.round(v * RS) / RS;

function resize() {
  const iw = window.innerWidth, ih = window.innerHeight;
  PXS = Math.max(1, Math.round(ih / 150));
  H = Math.min(200, Math.max(110, Math.ceil(ih / PXS)));
  W = Math.min(380, Math.max(160, Math.ceil(iw / PXS)));
  RS = PXS;
  canvas.width = W * RS;
  canvas.height = H * RS;
  canvas.style.width = W * PXS + 'px';
  canvas.style.height = H * PXS + 'px';
  ctx.imageSmoothingEnabled = false;
  resizeUI(PXS, W, H);
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

// Gameplay randomness can be seeded (the Daily Challenge uses this so
// everyone gets the same run); visual effects keep using Math.random.
let rng = Math.random;
const grand = () => rng();
const grange = (a, b) => a + rng() * (b - a);
const gpick = arr => arr[Math.floor(rng() * arr.length)];

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Save data: fish (currency), cosmetics, records, journey progress.
// ---------------------------------------------------------------------------
const SAVE_KEY = 'knightKittenSave';
const SAVE = Object.assign({
  fish: 0,
  owned: ['cape:cream', 'bow:pink', 'armor:steel'],
  equip: { cape: 'cream', bow: 'pink', armor: 'steel' },
  records: { story: {}, endless: {}, bossrush: {}, daily: {}, journey: {} },
  journey: { reached: 0, cats: [] },
  city: { stamps: [] },
  seenIntro: false,
}, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })());

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch { /* storage blocked */ }
}

// Updates a record if the new value is better; returns true when it is.
function setRecord(mode, key, value, lowerIsBetter = false) {
  const r = SAVE.records[mode] || (SAVE.records[mode] = {});
  const old = r[key];
  const better = old === undefined || (lowerIsBetter ? value < old : value > old);
  if (better) { r[key] = value; persist(); }
  return better;
}

function addFish(n) {
  SAVE.fish += n;
  persist();
}

// ---------------------------------------------------------------------------
// Cosmetics: palette swaps applied to the kitten sprite.
// ---------------------------------------------------------------------------
const COSMETICS = {
  cape: [
    { id: 'cream', name: 'Cream Cape', price: 0, c: '#f1ead8', C: '#c8bca2' },
    { id: 'royal', name: 'Royal Blue', price: 40, c: '#5b8ee0', C: '#2f4f8a' },
    { id: 'crimson', name: 'Crimson', price: 60, c: '#d8433b', C: '#8f2a25' },
    { id: 'forest', name: 'Forest', price: 60, c: '#6aa64c', C: '#2f5a2a' },
    { id: 'midnight', name: 'Midnight', price: 100, c: '#4a4f75', C: '#262940' },
  ],
  bow: [
    { id: 'pink', name: 'Pink Bow', price: 0, p: '#f4a3b8', P: '#d9668a' },
    { id: 'gold', name: 'Gold Bow', price: 30, p: '#f2c94c', P: '#b8892a' },
    { id: 'sky', name: 'Sky Bow', price: 30, p: '#9fd6ef', P: '#5aa7d1' },
    { id: 'violet', name: 'Violet Bow', price: 50, p: '#c3a0ec', P: '#7a52b0' },
  ],
  armor: [
    { id: 'steel', name: 'Steel Armor', price: 0, s: '#eef1f3', S: '#aeb6bd', d: '#6e767e' },
    { id: 'rose', name: 'Rose Armor', price: 120, s: '#ffe4ec', S: '#f4a3b8', d: '#b8607a' },
    { id: 'obsidian', name: 'Obsidian', price: 150, s: '#8c8eaa', S: '#55576f', d: '#2c2d3c' },
    { id: 'gold', name: 'Gold Armor', price: 200, s: '#fff3bf', S: '#e6c15e', d: '#a8801e' },
  ],
};

function equippedLook() {
  const get = slot => COSMETICS[slot].find(c => c.id === SAVE.equip[slot]) || COSMETICS[slot][0];
  return { cape: get('cape'), bow: get('bow'), armor: get('armor') };
}

let SPR = null;
function rebuildKitten() { SPR.kitten = buildKitten(equippedLook()); }
