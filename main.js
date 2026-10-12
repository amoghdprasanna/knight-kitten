'use strict';

// ---------------------------------------------------------------------------
// Boot, menus and the main loop. `scene` is menu | arena | journey.
// ---------------------------------------------------------------------------
let scene = 'menu';
let paused = false;
let lastMode = 'story';

function pauseGame() {
  paused = true;
  openPanel('p-pause');
}

function resumeGame() {
  paused = false;
  closePanels();
}

function goToTitle() {
  paused = false;
  scene = 'menu';
  document.body.classList.remove('journey', 'city');
  BL.active = false;
  if (canvas.width !== W * RS) resize();
  rng = Math.random;
  clearEnts();
  newArenaGame('story');
  arenaState = 'attract';
  buildArena();
  placeKitten(DOOR.x - 20, DOOR.y + 20);
  setTod(0, true);
  setMusic('title');
  refreshTitle();
  openPanel('p-title');
}

function refreshTitle() {
  const r = SAVE.records;
  const set = (id, text) => { const e = el(id); if (e) e.textContent = text; };
  set('rec-story', r.story.score ? `Best ${r.story.score}` : 'Morning to night');
  set('rec-journey', SAVE.journey.cats.length ? `Cats found ${SAVE.journey.cats.length} of ${CAT_BREEDS.length}` : 'Seven lands to cross');
  set('rec-endless', r.endless.wave ? `Best wave ${r.endless.wave}` : 'How long can you last?');
  set('rec-bossrush', r.bossrush.time ? `Best ${fmtTime(r.bossrush.time)}` : 'Beat the clock');
  set('rec-daily', r.daily[todayKey()] ? `Today ${r.daily[todayKey()]}` : todayKey());
  set('rec-city', SAVE.city.stamps.length ? `Postcards ${SAVE.city.stamps.length} of ${B_POSTCARDS.length}` : 'Explore the city');
  set('fish-count', `${SAVE.fish}`);
  const cont = el('m-continue');
  const reached = SAVE.journey.reached || 0;
  cont.style.display = reached > 0 ? '' : 'none';
  cont.textContent = `Continue journey: ${LANDS[reached].name.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase())}`;
  set('m-sound-title', `Sound: ${soundOn ? 'on' : 'off'}`);
}

function refreshShop() {
  el('shop-fish').textContent = `${SAVE.fish} fish`;
  const list = el('shop-list');
  list.innerHTML = '';
  for (const slot of ['cape', 'bow', 'armor']) {
    for (const item of COSMETICS[slot]) {
      const key = `${slot}:${item.id}`;
      const owned = SAVE.owned.includes(key);
      const equipped = SAVE.equip[slot] === item.id;
      const btn = document.createElement('button');
      const swatch = item.c || item.p || item.S;
      btn.innerHTML = html`<span class="sw" style="background:${swatch}"></span>${item.name}<small>${equipped ? 'Equipped' : owned ? 'Equip' : `${item.price} fish`}</small>`;
      if (!owned && SAVE.fish < item.price) btn.classList.add('locked');
      btn.addEventListener('click', () => {
        if (!owned) {
          if (SAVE.fish < item.price) { sfx.hurt(); return; }
          SAVE.fish -= item.price;
          SAVE.owned.push(key);
        }
        SAVE.equip[slot] = item.id;
        persist();
        rebuildKitten();
        sfx.pickup();
        refreshShop();
      });
      list.appendChild(btn);
    }
  }
}

function setupMenus() {
  setupPanels();
  const on = (id, fn) => el(id).addEventListener('click', () => { sfxSafe('blip'); fn(); });
  for (const m of ['story', 'endless', 'bossrush', 'daily']) on(`m-${m}`, () => { lastMode = m; startArenaMode(m); });
  on('m-journey', () => { lastMode = 'journey'; startJourney(0); });
  on('m-city', () => { lastMode = 'city'; startCity(); });
  on('m-continue', () => { lastMode = 'journey'; startJourney(SAVE.journey.reached || 0); });
  on('m-shop', () => { refreshShop(); openPanel('p-shop'); });
  on('m-help', () => openPanel('p-help'));
  on('m-sound-title', () => { toggleSound(); refreshTitle(); });
  on('shop-back', () => { refreshTitle(); openPanel('p-title'); });
  on('help-back', () => openPanel('p-title'));
  on('p-resume', resumeGame);
  on('p-restart', () => {
    paused = false;
    closePanels();
    if (lastMode === 'journey') startJourney(J.checkpoint.chapter);
    else if (lastMode === 'city') startCity();
    else startArenaMode(lastMode);
  });
  on('p-sound', () => { toggleSound(); el('p-sound').textContent = `Sound: ${soundOn ? 'on' : 'off'}`; });
  on('p-quit', goToTitle);
  document.addEventListener('visibilitychange', () => { if (document.hidden && scene !== 'menu' && !menuOpen()) pauseGame(); });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
SPR = buildSprites();
rebuildKitten();
resize();
window.addEventListener('resize', resize);
initScenery();
setupTouch();
setupMenus();
if (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches) enableTouch();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
goToTitle();

let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  pollInput();
  if (paused || menuOpen()) {
    if (paused && input.pressed.pause) resumeGame();
    consumeInput();
  }
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    if (!paused) {
      if (scene === 'journey') journeyTick(STEP);
      else if (scene === 'city') cityTick(STEP);
      else arenaTick(STEP);
    }
    consumeInput();
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  RALPHA = clamp(acc / STEP, 0, 1);
  uiClear();
  if (scene !== 'city') { ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.imageSmoothingEnabled = false; }
  if (scene === 'journey') { journeyDraw(); journeyUI(); }
  else if (scene === 'city') { cityDraw(); cityUI(); }
  else { arenaDraw(); if (scene === 'arena') drawArenaUI(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
