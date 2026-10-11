'use strict';

// Unified input: keyboard, on-screen touch controls and gamepads all feed the
// same `input` object. `pressed` flags are edge-triggered and cleared by the
// game after each simulation step; `mx`/`my` is the movement vector.
const input = {
  mx: 0, my: 0,
  pressed: { attack: false, jump: false, dash: false, pause: false, any: false },
  held: { attack: false, jump: false, dash: false },
  mode: 'keys',               // keys | touch | pad
};
const touchHeld = { attack: false, jump: false, dash: false };

const KEYMAP = {
  attack: ['KeyJ', 'KeyZ', 'KeyF'],
  jump: ['KeyK', 'KeyX', 'Space'],
  dash: ['KeyL', 'KeyC', 'ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'],
};
const keysDown = new Set();

function press(action) {
  input.pressed[action] = true;
  input.pressed.any = true;
}

function consumeInput() {
  for (const k in input.pressed) input.pressed[k] = false;
}

window.addEventListener('keydown', e => {
  if (menuOpen()) {
    // Menus: arrows move focus, Enter/Space press, Escape goes back.
    const nav = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
    if (nav) { e.preventDefault(); menuNav(nav[0], nav[1]); return; }
    if (e.code === 'Escape') { e.preventDefault(); menuBack(); return; }
    if (e.code === 'KeyM') toggleSound();
    unlockAudio();
    return;
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keysDown.add(e.code);
  if (e.repeat) return;
  unlockAudio();
  if (e.code === 'KeyM') { toggleSound(); return; }
  input.mode = 'keys';
  for (const [action, codes] of Object.entries(KEYMAP)) if (codes.includes(e.code)) press(action);
  input.pressed.any = true;
});
window.addEventListener('keyup', e => keysDown.delete(e.code));
window.addEventListener('blur', () => keysDown.clear());

// ---------------------------------------------------------------------------
// Touch: a floating joystick on the left half, buttons on the right
// ---------------------------------------------------------------------------
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const STICK_R = 50;

function enableTouch() {
  if (input.mode !== 'touch') {
    input.mode = 'touch';
    document.body.classList.add('touch');
  }
}

function setupTouch() {
  const zone = document.getElementById('stick-zone');
  const base = document.getElementById('stick');
  const knob = document.getElementById('knob');

  zone.addEventListener('pointerdown', e => {
    if (document.body.classList.contains('journey')) {
      // In Journey the whole left side is a big jump button.
      zone.setPointerCapture(e.pointerId);
      stick.id = e.pointerId;
      touchHeld.jump = true;
      press('jump');
      return;
    }
    if (stick.id !== null) return;
    stick.id = e.pointerId;
    stick.ox = e.clientX;
    stick.oy = e.clientY;
    stick.x = stick.y = 0;
    zone.setPointerCapture(e.pointerId);
    base.style.display = 'block';
    base.style.left = e.clientX + 'px';
    base.style.top = e.clientY + 'px';
    knob.style.transform = 'translate(0px, 0px)';
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / STICK_R);
    stick.x = m < 0.18 ? 0 : (dx / STICK_R);
    stick.y = m < 0.18 ? 0 : (dy / STICK_R);
  });
  const end = e => {
    if (e.pointerId !== stick.id) return;
    touchHeld.jump = false;
    stick.id = null;
    stick.x = stick.y = 0;
    base.style.display = 'none';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);

  for (const [id, action] of [['b-attack', 'attack'], ['b-jump', 'jump'], ['b-dash', 'dash'], ['b-pause', 'pause']]) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('down');
      touchHeld[action] = true;
      press(action);
    });
    const up = () => { el.classList.remove('down'); touchHeld[action] = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Any touch or click anywhere counts as "any" for menus.
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') enableTouch();
    input.pressed.any = true;
    unlockAudio();
  }, true);

  // Stop iOS gestures from zooming or scrolling the page.
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) {
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchmove', e => { if (!e.target.closest('.panel')) e.preventDefault(); }, { passive: false });
}

// ---------------------------------------------------------------------------
// Gamepads (standard mapping): stick/d-pad move, X attack, A jump, B dash.
// ---------------------------------------------------------------------------
const padPrev = [];
let padNavPrev = { x: 0, y: 0 };

function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
    let x = pad.axes[0] || 0, y = pad.axes[1] || 0;
    if (Math.hypot(x, y) < 0.25) x = y = 0;
    if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
    if (menuOpen()) {
      // D-pad / stick moves through menu buttons, A presses, B goes back.
      const nx = Math.abs(x) > 0.5 ? Math.sign(x) : 0, ny = Math.abs(y) > 0.5 ? Math.sign(y) : 0;
      if ((nx || ny) && (nx !== padNavPrev.x || ny !== padNavPrev.y)) { menuNav(nx, ny); input.mode = 'pad'; }
      padNavPrev = { x: nx, y: ny };
      if (b(0) && !padPrev[0]) menuActivate();
      if (b(1) && !padPrev[1]) menuBack();
      for (let i = 0; i < 16; i++) padPrev[i] = b(i);
      return { x: 0, y: 0, held: {} };
    }
    const map = [[2, 'attack'], [3, 'attack'], [0, 'jump'], [1, 'dash'], [5, 'dash'], [9, 'pause']];
    for (const [i, action] of map) {
      if (b(i) && !padPrev[i]) { press(action); input.mode = 'pad'; }
    }
    for (let i = 0; i < 16; i++) padPrev[i] = b(i);
    if (x || y) input.mode = 'pad';
    return { x, y, held: { jump: b(0), dash: b(1) || b(5), attack: b(2) || b(3) } };
  }
  return { x: 0, y: 0, held: {} };
}

// Called once per frame before the simulation steps.
function pollInput() {
  let x = 0, y = 0;
  const k = c => keysDown.has(c);
  if (k('KeyA') || k('ArrowLeft')) x -= 1;
  if (k('KeyD') || k('ArrowRight')) x += 1;
  if (k('KeyW') || k('ArrowUp')) y -= 1;
  if (k('KeyS') || k('ArrowDown')) y += 1;
  x += stick.x;
  y += stick.y;
  const p = pollPad();
  x += p.x;
  y += p.y;
  input.held.jump = KEYMAP.jump.some(k) || k('KeyW') || k('ArrowUp') || touchHeld.jump || !!p.held.jump;
  input.held.dash = KEYMAP.dash.some(k) || touchHeld.dash || !!p.held.dash;
  input.held.attack = KEYMAP.attack.some(k) || touchHeld.attack || !!p.held.attack;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  input.mx = x;
  input.my = y;
}
