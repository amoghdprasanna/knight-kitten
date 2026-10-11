'use strict';

// ---------------------------------------------------------------------------
// Sharp UI layer.
//
// The game art lives on a tiny pixel canvas that is scaled up. All text and
// HUD go on this second canvas, which is sized to the real device pixels, so
// words stay crisp and readable at any scale. Drawing uses game-pixel
// coordinates (the context is pre-scaled by U).
// ---------------------------------------------------------------------------
const uiCanvas = document.getElementById('ui');
const uctx = uiCanvas.getContext('2d');
let U = 1;                                   // device pixels per game pixel
const UI_FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';
const TITLE_FONT = '"Press Start 2P", monospace';
const INK = '#1d1816';

function resizeUI(cssScale, gw, gh) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  uiCanvas.width = Math.round(gw * cssScale * dpr);
  uiCanvas.height = Math.round(gh * cssScale * dpr);
  uiCanvas.style.width = gw * cssScale + 'px';
  uiCanvas.style.height = gh * cssScale + 'px';
  U = cssScale * dpr;
}

function uiClear() {
  uctx.setTransform(1, 0, 0, 1, 0, 0);
  uctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  uctx.setTransform(U, 0, 0, U, 0, 0);
}

// Outlined text. Sizes are in game pixels. Returns the width in game pixels.
function ut(str, x, y, o = {}) {
  const size = o.size || 6;
  uctx.save();
  uctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  uctx.font = `${o.weight || 700} ${size}px ${o.font || UI_FONT}`;
  uctx.textAlign = o.align || 'left';
  uctx.textBaseline = o.base || 'top';
  const w = uctx.measureText(str).width;
  if (o.outline !== null) {
    uctx.lineJoin = 'round';
    uctx.lineWidth = o.stroke || Math.max(1.2, size * 0.32);
    uctx.strokeStyle = o.outline || INK;
    uctx.strokeText(str, x, y);
  }
  uctx.fillStyle = o.color || '#ffffff';
  uctx.fillText(str, x, y);
  uctx.restore();
  return w;
}

function utitle(str, x, y, size, color, align = 'center', alpha = 1) {
  return ut(str, x, y, { size, color, align, font: TITLE_FONT, weight: 400, stroke: size * 0.42, alpha });
}

function uwidth(str, size = 6, font = UI_FONT, weight = 700) {
  uctx.font = `${weight} ${size}px ${font}`;
  return uctx.measureText(str).width;
}

function uimg(img, x, y, w = img.width, h = img.height, alpha = 1) {
  uctx.imageSmoothingEnabled = false;
  uctx.globalAlpha = alpha;
  uctx.drawImage(img, x, y, w, h);
  uctx.globalAlpha = 1;
}

function urect(x, y, w, h, col, alpha = 1) {
  uctx.globalAlpha = alpha;
  uctx.fillStyle = col;
  uctx.fillRect(x, y, w, h);
  uctx.globalAlpha = 1;
}

// A chunky pixel-style panel with notched corners.
function ubox(x, y, w, h, fill = 'rgba(29,24,22,0.78)', border = '#e9e4dc', alpha = 1) {
  uctx.globalAlpha = alpha;
  uctx.fillStyle = border;
  uctx.fillRect(x + 1, y, w - 2, h);
  uctx.fillRect(x, y + 1, w, h - 2);
  uctx.fillStyle = fill;
  uctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  uctx.globalAlpha = 1;
}

function ubar(x, y, w, h, frac, col, bg = '#3a302b') {
  urect(x - 0.5, y - 0.5, w + 1, h + 1, INK);
  urect(x, y, w, h, bg);
  urect(x, y, Math.max(0, Math.min(1, frac)) * w, h, col);
}

// Speech bubble pointing down at (x, y), kept inside the screen.
function ububble(text, x, y, alpha = 1, screenW = 9999) {
  const size = 5.2;
  const tw = uwidth(text, size);
  const w = tw + 6, h = size + 4;
  const bx = Math.max(2, Math.min(screenW - w - 2, x - w / 2));
  const by = Math.max(24, y - h - 4);
  uctx.globalAlpha = alpha;
  uctx.fillStyle = INK;
  uctx.fillRect(bx - 0.6, by - 0.6, w + 1.2, h + 1.2);
  uctx.fillStyle = '#fbf7ee';
  uctx.fillRect(bx, by, w, h);
  const tx = Math.max(bx + 3, Math.min(bx + w - 3, x));
  uctx.beginPath();
  uctx.moveTo(tx - 2, by + h);
  uctx.lineTo(tx, by + h + 3);
  uctx.lineTo(tx + 2, by + h);
  uctx.closePath();
  uctx.fill();
  uctx.strokeStyle = INK;
  uctx.lineWidth = 0.6;
  uctx.stroke();
  uctx.globalAlpha = 1;
  ut(text, bx + w / 2, by + 2, { size, color: INK, align: 'center', outline: null, alpha });
}

// ---------------------------------------------------------------------------
// DOM menus: title, shop, help, results, pause. Navigable by touch, mouse,
// keyboard (arrows + Enter) and gamepad (d-pad + A, B for back).
// ---------------------------------------------------------------------------
const panels = {};
let openPanelId = null;

function setupPanels() {
  for (const el of document.querySelectorAll('.panel')) panels[el.id] = el;
}

function openPanel(id) {
  for (const [pid, el] of Object.entries(panels)) el.classList.toggle('open', pid === id);
  openPanelId = id;
  document.body.classList.toggle('in-menu', !!id);
  if (id) {
    const first = panels[id].querySelector('[autofocus], button:not([disabled])');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }
}

function closePanels() { openPanel(null); }
function menuOpen() { return openPanelId !== null; }

function menuButtons() {
  if (!openPanelId) return [];
  return [...panels[openPanelId].querySelectorAll('button:not([disabled])')].filter(b => b.offsetParent !== null);
}

// Moves focus to the nearest button in the pressed direction.
function menuNav(dx, dy) {
  const btns = menuButtons();
  if (!btns.length) return;
  const cur = document.activeElement;
  if (!btns.includes(cur)) { btns[0].focus(); return; }
  const r0 = cur.getBoundingClientRect();
  const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
  let best = null, bestScore = Infinity;
  for (const b of btns) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const vx = c.x - c0.x, vy = c.y - c0.y;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = b; }
  }
  if (!best) {
    // Wrap around in reading order.
    const i = btns.indexOf(cur);
    best = btns[(i + (dx + dy > 0 ? 1 : -1) + btns.length) % btns.length];
  }
  best.focus();
  sfxSafe('blip');
}

function menuActivate() {
  const el = document.activeElement;
  if (el && el.tagName === 'BUTTON' && menuButtons().includes(el)) el.click();
}

function menuBack() {
  if (!openPanelId) return;
  const back = panels[openPanelId].querySelector('[data-back]');
  if (back) back.click();
}

function el(id) { return document.getElementById(id); }

function html(strings, ...vals) {
  return strings.reduce((s, str, i) => s + str + (i < vals.length ? String(vals[i]).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) : ''), '');
}

// Results screen: title, subtitle, rows of stats, and action buttons.
function showResults({ title, sub, stats = [], record = false, buttons = [] }) {
  el('r-title').textContent = title;
  el('r-sub').textContent = sub || '';
  el('r-record').style.display = record ? 'block' : 'none';
  el('r-stats').innerHTML = stats.map(([k, v]) => html`<div><span>${k}</span><b>${v}</b></div>`).join('');
  const box = el('r-buttons');
  box.innerHTML = '';
  buttons.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    if (b.back) btn.dataset.back = '1';
    if (i === 0) btn.setAttribute('autofocus', '');
    btn.addEventListener('click', () => { sfxSafe('blip'); b.fn(); });
    box.appendChild(btn);
  });
  openPanel('p-results');
}
