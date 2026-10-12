'use strict';

// ---------------------------------------------------------------------------
// Journey: a side-scrolling run across seven lands to Grandma's house.
//
// The Human went on a trip. Ser Biscuit followed. On the way, stray cats
// join the party and run along behind; fish are spent in the shop. Hold
// jump to charge a higher leap, tap again in the air to double jump, and
// slash to break things in the way.
// ---------------------------------------------------------------------------
const LANDS = [
  {
    name: 'THE MISTY MEADOW', sub: 'Home, at dawn', len: 3600, mood: 'morning', tint: [255, 242, 236], time: 'dawn',
    sky: ['#aebcd4', '#f4d8c6'], far: '#aab7c7', hills: '#8fa997', grass: '#6d9c47', grassDark: '#507d36', trail: '#a78a5e',
    obstacles: ['rock', 'log', 'bush'], minions: ['alarm', 'sock'], decor: ['tree', 'bush', 'tree'],
    story: ["The Human left for Grandma's at dawn.", 'Ser Biscuit did not agree to this.'],
  },
  {
    name: 'ORCHARD ROAD', sub: 'Apples and adventure', len: 4200, mood: 'noon', tint: [255, 255, 250], time: 'day',
    sky: ['#86b7e2', '#d8ebf4'], far: '#a3bccc', hills: '#80a58b', grass: '#74a34a', grassDark: '#557f36', trail: '#b39060',
    obstacles: ['log', 'rock', 'crate', 'bush'], minions: ['email', 'bell'], decor: ['tree', 'tree', 'fence'],
    story: ['The road smelled of apples.', 'And of the Human. Faintly.'],
  },
  {
    name: 'RIVER BOTTOMS', sub: 'Cottonwood flats', len: 4400, mood: 'noon', tint: [245, 252, 255], time: 'day', boss: 'vacuum',
    sky: ['#9cc8e6', '#e0eff2'], far: '#93aeb8', hills: '#6f9a80', grass: '#679a52', grassDark: '#4a7a3c', trail: '#9a8462',
    obstacles: ['rock', 'log', 'puddle', 'puddle'], minions: ['duck', 'mosquito'], decor: ['reeds', 'tree', 'reeds'],
    story: ['Water. So much water.', 'Something rumbled behind them...'],
  },
  {
    name: 'THE SANDHILLS', sub: 'Dune country', len: 4400, mood: 'dusk', tint: [255, 236, 210], time: 'hot',
    sky: ['#e6c78e', '#f6e2bc'], far: '#d1ad7a', hills: '#c49a62', grass: '#d0b06c', grassDark: '#a8864a', trail: '#c9a46a',
    obstacles: ['cactus', 'tumbleweed', 'rock', 'cactus'], minions: ['sock', 'bill'], decor: ['cactus', 'dune', 'cactus'],
    story: ['Sand in the paws. Sand everywhere.', 'The party kept going anyway.'],
  },
  {
    name: 'THUNDER PASS', sub: 'Mountain saddle', len: 4400, mood: 'night', tint: [190, 196, 215], time: 'storm', rain: true,
    sky: ['#4f5b70', '#8e99a8'], far: '#56606f', hills: '#4f6458', grass: '#4f7a48', grassDark: '#3a5c36', trail: '#7a6a58',
    obstacles: ['rock', 'log', 'fallingrock', 'rock'], minions: ['mosquito', 'alarm'], decor: ['pine', 'pine', 'rockpile'],
    story: ['The sky grumbled.', 'Ser Biscuit grumbled back.'],
  },
  {
    name: 'THE BIG CITY', sub: 'Rush hour', len: 4600, mood: 'dusk', tint: [235, 215, 225], time: 'dusk', boss: 'monday', city: true,
    sky: ['#4a3d6e', '#e79c7a'], far: '#5a4c70', hills: '#3d3550', grass: '#6b6f78', grassDark: '#4e525c', trail: '#8a8e96',
    obstacles: ['cone', 'crate', 'cone'], minions: ['email', 'bell', 'bill'], decor: ['building', 'lamp', 'building'],
    story: ['So many Humans.', 'None of them the right one.'],
  },
  {
    name: "GRANDMA'S LANE", sub: 'Almost there', len: 3200, mood: 'ending', tint: [255, 205, 175], time: 'sunset', final: true,
    sky: ['#5b4a7a', '#f6a96c'], far: '#8a6a7c', hills: '#6e5a62', grass: '#6a8a46', grassDark: '#4c6a34', trail: '#a78a5e',
    obstacles: ['log', 'rock', 'bush'], minions: ['sock'], decor: ['tree', 'fence', 'bush'],
    story: ['There. A window. A familiar silhouette.'],
  },
];

const JOBS = {
  rock: { spr: () => SPR.rocks[2], w: 14, h: 9 },
  log: { spr: () => SPR.log, w: 20, h: 8 },
  bush: { spr: () => SPR.bush[1], w: 15, h: 9 },
  cactus: { spr: () => SPR.cactus, w: 9, h: 18 },
  cone: { spr: () => SPR.cone, w: 8, h: 10 },
  crate: { spr: () => SPR.crate, w: 12, h: 12, breakable: true },
  tumbleweed: { spr: () => SPR.tumbleweed[0], w: 10, h: 10, breakable: true, roll: 70 },
  puddle: { w: 22, h: 2, harmless: true },
  fallingrock: { spr: () => SPR.rocks[0], w: 12, h: 8, falls: true },
};

const J = { active: false };
const jkit = {
  kind: 'kitten', facing: 1, walkT: 0, blinkT: 2, atkT: 0, combo: 1, yarn: 0, catnip: 0, dashT: 0,
  plunge: false, sprint: false, airborne: false, sleeping: false, scaredT: 0, hurtT: 0,
};
let jt = 0;

const landStart = i => LANDS.slice(0, i).reduce((s, l) => s + l.len, 0);
const TOTAL_LEN = landStart(LANDS.length);

function startJourney(fromChapter = 0) {
  unlockAudio();
  closePanels();
  scene = 'journey';
  document.body.classList.add('journey');
  document.body.classList.remove('city');
  rng = Math.random;
  const start = landStart(fromChapter);
  Object.assign(J, {
    active: true, state: 'run', chapter: -1, dist: start, startDist: start, speed: 72, lap: 0, endless: false,
    kitY: 0, vy: 0, charging: false, chargeT: 0, airJumps: 0, hp: 3, inv: 0, slashCd: 0, hurtT: 0,
    party: [], checkpoint: { chapter: fromChapter, party: [] }, obstacles: [], items: [], strays: [], runaways: [],
    fx: [], texts: [], captions: [], caption: null, banner: null, shake: 0, flash: 0, lightning: 0,
    fish: 0, score: 0, rescued: 0, nextObs: start + 260, nextItem: start + 180, nextStray: start + 420,
    chase: null, end: null, rain: [], palFrom: null, palK: 1, bubbleT: 3,
  });
  for (let i = 0; i < 40; i++) J.rain.push({ x: Math.random() * 400, y: Math.random() * 200 });
  enterLand(fromChapter);
}

function curLand() { return LANDS[((J.chapter % LANDS.length) + LANDS.length) % LANDS.length]; }

function enterLand(i) {
  const prev = J.chapter >= 0 ? curLand() : null;
  J.chapter = i;
  const L = curLand();
  J.palFrom = prev;
  J.palK = prev ? 0 : 1;
  J.banner = { title: L.name, sub: L.sub, t: 3 };
  J.captions = J.endless ? [] : L.story.slice();
  J.caption = null;
  J.captionDelay = 1.6;
  J.checkpoint = { chapter: i, party: J.party.map(c => c.breed) };
  J.landEndAt = J.dist + L.len;
  if (!J.endless) {
    SAVE.journey.reached = Math.max(SAVE.journey.reached || 0, i);
    persist();
  }
  setMusic(L.mood);
  sfx.chime();
}

// ---------------------------------------------------------------------------
// Spawning ahead of the runner
// ---------------------------------------------------------------------------
function landEnd() { return J.landEndAt; }

function spawnAhead() {
  const L = curLand();
  const horizon = J.dist + W + 60;
  const end = J.endless ? Infinity : landEnd();
  const quiet = J.chase || J.end;

  while (J.nextObs < horizon) {
    const x = J.nextObs;
    const gap = J.speed * (1.25 + Math.random() * 1.6) * (J.chase ? 1.5 : 1);
    J.nextObs += Math.max(80, gap);
    if (x > end - 260 || J.state !== 'run' || quiet) continue;
    if (Math.random() < 0.3) {
      const type = pick(L.minions);
      const spr = SPR[type];
      const def = MINIONS[type];
      J.obstacles.push({ kind: 'minion', type, spr, x, h0: def.fly ? 14 : 0, w: spr.w - 2, h: spr.h - 1, hp: def.hp > 2 ? 2 : 1, vx: -(18 + Math.random() * 16), seed: Math.random() * 6, breakable: true });
      if (Math.random() < 0.3) J.obstacles[J.obstacles.length - 1].bubble = { text: pick(def.barks), t: 1.6 };
    } else {
      const type = pick(L.obstacles);
      const d = JOBS[type];
      const o = { kind: type, x, h0: 0, w: d.w, h: d.h, breakable: d.breakable, harmless: d.harmless, vx: d.roll ? -d.roll : 0, spr: d.spr ? d.spr() : null, rot: 0 };
      if (d.falls) { o.h0 = 120; o.falls = true; }
      J.obstacles.push(o);
      // High fish over some obstacles reward a charged jump.
      if (!d.harmless && Math.random() < 0.35) for (let k = 0; k < 3; k++) J.items.push({ kind: 'fish', x: x - 10 + k * 10, h: 40 + Math.sin(k * 1.4) * 6 });
    }
  }
  while (J.nextItem < horizon) {
    const x = J.nextItem;
    J.nextItem += 220 + Math.random() * 260;
    if (x > end - 200 || quiet) continue;
    // A gentle arc of fish along the trail.
    const n = 4 + Math.floor(Math.random() * 3), high = Math.random() < 0.4;
    for (let k = 0; k < n; k++) {
      const h = high ? 14 + Math.sin(k / (n - 1) * Math.PI) * 30 : 6;
      if (!J.obstacles.some(o => Math.abs(o.x - (x + k * 11)) < 14)) J.items.push({ kind: 'fish', x: x + k * 11, h });
    }
  }
  while (J.nextStray < horizon) {
    const x = J.nextStray;
    J.nextStray += 560 + Math.random() * 420;
    if (x > end - 200 || quiet || J.party.length >= 20 || J.obstacles.some(o => Math.abs(o.x - x) < 40)) continue;
    J.strays.push({ x, breed: pickBreed(), t: Math.random() * 6 });
  }
}

function pickBreed() {
  const km = J.dist / 1000;
  const pool = [];
  for (const b of CAT_BREEDS) {
    const tier = CAT_TIERS[b.tier];
    if (km >= tier.unlock) pool.push({ b, w: tier.weight / CAT_BREEDS.filter(x => x.tier === b.tier).length });
  }
  let r = Math.random() * pool.reduce((s, p) => s + p.w, 0);
  for (const p of pool) { r -= p.w; if (r <= 0) return p.b.id; }
  return 'tabby';
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
const KX = () => Math.round(W * 0.34);
const JGROUND = () => H - 24;
const J_GRAV = 500;

function journeyTick(dt) {
  J.prevDist = J.dist;
  jt += dt;
  if (input.pressed.pause && (J.state === 'run' || J.state === 'chase')) { pauseGame(); return; }
  J.shake = Math.max(0, J.shake - dt * 18);
  J.flash = Math.max(0, J.flash - dt);
  J.palK = Math.min(1, J.palK + dt / 3);
  if (J.banner && (J.banner.t -= dt) <= 0) J.banner = null;
  updateCaptions(dt);
  if (J.state === 'over') {
    updateJFx(dt);
    if (J.overFn && (J.overT -= dt) <= 0) { const f = J.overFn; J.overFn = null; f(); }
    return;
  }
  if (J.end) { jUpdateEnding(dt); return; }

  const L = curLand();
  // Speed creeps up slowly through the journey (and each endless lap).
  const target = (72 + Math.min(40, (J.dist - J.startDist) / 900) + J.lap * 10) * (J.chase ? 1.08 : 1);
  J.speed += (target - J.speed) * Math.min(1, dt);
  J.dist += J.speed * dt;
  jkit.walkT += dt * J.speed / 60;
  jkit.blinkT -= dt;
  if (jkit.blinkT < -0.12) jkit.blinkT = rand(2, 4);
  J.inv = Math.max(0, J.inv - dt);
  J.slashCd = Math.max(0, J.slashCd - dt);
  jkit.atkT = Math.max(0, jkit.atkT - dt);
  jkit.hurtT = Math.max(0, jkit.hurtT - dt);

  // Jump: hold to charge, release to leap; tap again in the air to double jump.
  const onGround = J.kitY <= 0 && J.vy <= 0;
  if (onGround) {
    J.kitY = 0; J.vy = 0; J.airJumps = 0;
    if (input.pressed.jump) { J.charging = true; J.chargeT = 0; }
    if (J.charging) {
      J.chargeT = Math.min(0.45, J.chargeT + dt);
      if (!input.held.jump || J.chargeT >= 0.45) jLeap(175 + (J.chargeT / 0.45) * 95);
    }
  } else {
    if (input.pressed.jump && J.airJumps < 1) {
      J.vy = 165;
      J.airJumps = 1;
      sfx.jump();
      jBurst(KX(), JGROUND() - J.kitY, 6, ['#ffffff', '#e9e4dc']);
    }
    J.vy -= J_GRAV * dt;
    J.kitY += J.vy * dt;
    if (J.kitY <= 0) { J.kitY = 0; J.vy = 0; sfx.land(); for (let i = 0; i < 3; i++) jDust(KX(), JGROUND()); }
  }
  jkit.airborne = J.kitY > 1;
  if (input.pressed.attack && J.slashCd <= 0) jSlash();

  spawnAhead();
  updateObstacles(dt);
  updateItems(dt);
  updateStrays(dt);
  updateParty(dt);
  if (J.chase) updateChase(dt);
  updateJFx(dt);
  if (L.rain) updateRain(dt);

  // Crossing into the next land, or reaching Grandma's.
  const end = landEnd();
  if (!J.endless && L.boss && !J.chase && !J.chaseDone && J.dist > end - 2000) startChase(L.boss);
  if (J.dist >= end && !J.chase) {
    if (L.final && !J.endless) startEnding();
    else {
      let next = J.chapter + 1;
      if (J.endless && next % LANDS.length === LANDS.length - 1) next++;   // skip Grandma's on repeat laps
      if (next % LANDS.length === 0 && next > 0) J.lap++;
      J.chaseDone = false;
      enterLand(next);
    }
  }
}

function jLeap(v) {
  J.charging = false;
  J.vy = v;
  sfx.jump();
  // The party follows, back rows a beat later.
  J.party.forEach((c, i) => { c.jumpAt = jt + (Math.floor(i / 2) + 1) * 0.07; c.jumpV = v * 0.92; });
}

function jSlash() {
  J.slashCd = 0.22;
  jkit.atkT = 0.16;
  jkit.combo = jkit.combo % 3 + 1;
  sfx.swing();
  const x0 = J.dist - 2, x1 = J.dist + 30, y0 = J.kitY - 4, y1 = J.kitY + 30;
  let hit = false;
  for (const o of J.obstacles) {
    if (o.dead || o.harmless) continue;
    const top = o.h0 + o.h;
    const back = o.kind === 'proj' ? 14 : 0;
    if (o.x + o.w / 2 < x0 - back || o.x - o.w / 2 > x1 || top < y0 || o.h0 > y1) continue;
    if (o.kind === 'proj') { if (!o.deflected) deflectJ(o); hit = true; continue; }
    if (!o.breakable) continue;
    o.hp = (o.hp || 1) - 1;
    hit = true;
    jSparks(o);
    if (o.hp > 0) { o.x += 34; o.vx = Math.min(o.vx || 0, -10); jText(o.x, o.h0 + o.h + 8, 'CLANK!', '#ffffff'); }
    if (o.hp <= 0) {
      o.dead = true;
      J.score += 15;
      jText(o.x, o.h0 + o.h + 10, '+15', '#ffe08a');
      // Broken things go flying.
      J.fx.push({ kind: 'debris', spr: o.spr, x: o.x, h: o.h0 + 4, vx: 140 + Math.random() * 60, vh: 120, rot: 0, spin: 12, life: 1.2 });
      if (o.kind === 'crate' && Math.random() < 0.7) for (let k = 0; k < 3; k++) J.items.push({ kind: 'fish', x: o.x + 14 + k * 10, h: 8 + k * 6 });
    }
  }
  if (J.chase && J.chase.boss && Math.abs(J.chase.x - J.dist) < 34) { chaseHit(1); hit = true; }
  if (hit) { sfx.hit(1); J.shake = 2; }
}

function hurtJ(src) {
  if (J.inv > 0) return;
  J.inv = 1.2;
  jkit.hurtT = 0.4;
  J.shake = 5;
  sfx.hurt();
  if (J.party.length) {
    // A scared cat runs off home instead of the knight losing a heart.
    const c = J.party.pop();
    J.runaways.push({ breed: c.breed, x: KX() + c.ox, y: c.oy, t: 0 });
    jText(J.dist - 20, 30, `${CAT_BREEDS.find(b => b.id === c.breed).name} got scared!`, '#ff8a7a', 1.4);
  } else {
    J.hp--;
    jText(J.dist, 40, 'Ow!', '#ff6b6b');
    if (J.hp <= 0) journeyOver(src);
  }
}

function boxHit(o) {
  // Forgiving boxes: a near miss should feel like a clean jump.
  const kx0 = J.dist - 3, kx1 = J.dist + 4, ky0 = J.kitY, ky1 = J.kitY + 22;
  const hw = Math.max(2, o.w / 2 - 2);
  return o.x + hw > kx0 && o.x - hw < kx1 && o.h0 + o.h - 1.5 > ky0 && o.h0 < ky1;
}

function updateObstacles(dt) {
  for (const o of J.obstacles) {
    if (o.dead) continue;
    o.x += (o.vx || 0) * dt;
    if (o.kind === 'tumbleweed') { o.rot += dt * 8; o.h0 = Math.abs(Math.sin(jt * 5 + o.x * 0.05)) * 10; }
    if (o.kind === 'minion') o.bob = Math.abs(Math.sin(jt * 8 + o.seed)) * 2;
    if (o.bubble && (o.bubble.t -= dt) <= 0) o.bubble = null;
    if (o.falls) {
      // Falling rocks drop when the runner gets near; their shadow warns first.
      if (o.x - J.dist < 120) o.dropping = true;
      if (o.dropping && o.h0 > 0) { o.vh = (o.vh || 0) - 600 * dt; o.h0 = Math.max(0, o.h0 + o.vh * dt); if (o.h0 === 0) { J.shake = 3; jBurst(o.x - J.dist + KX(), JGROUND(), 6, ['#c9c2b6', '#8b9096']); } }
    }
    if (o.kind === 'proj') {
      o.p += dt / o.T;
      const k = Math.min(1, o.p);
      o.x = lerp(o.sx, o.tx, k);
      o.h0 = lerp(o.sh, 0, k) + o.arc * 4 * k * (1 - k);
      if (o.deflected && k >= 1) { o.dead = true; chaseHit(1, 'RETURN TO SENDER'); continue; }
      if (k >= 1) { o.dead = true; jBurst(o.x - J.dist + KX(), JGROUND(), 5, ['#e9e4dc', '#c9c2b6']); }
    }
    if (o.harmless) {
      if (!o.splashed && Math.abs(o.x - J.dist) < 8 && J.kitY < 2) {
        o.splashed = true;
        jBurst(KX(), JGROUND(), 10, ['#9fd6ef', '#ffffff', '#5aa7d1']);
        sfx.splash();
        if (J.party.length) J.party[0].bubble = { text: 'Mrrow! Wet!', t: 1.2 };
      }
      continue;
    }
    if (o.fallOnly && o.p < 0.55) continue;
    if (!o.deflected && boxHit(o)) {
      if (o.breakable && o.kind !== 'proj') o.dead = true;
      if (o.kind === 'proj') o.dead = true;
      hurtJ(o);
    }
  }
  J.obstacles = J.obstacles.filter(o => !o.dead && o.x > J.dist - KX() - 60);
}

function updateItems(dt) {
  for (const it of J.items) {
    if (it.got) continue;
    if (Math.abs(it.x - J.dist) < 9 && Math.abs(it.h - (J.kitY + 12)) < 16) {
      it.got = true;
      J.fish++;
      J.score += 10;
      addFish(1);
      sfx.pickup();
      jBurst(it.x - J.dist + KX(), JGROUND() - it.h, 5, ['#ffe08a', '#9fd6ef']);
    }
  }
  J.items = J.items.filter(it => !it.got && it.x > J.dist - KX() - 20);
}

function updateStrays(dt) {
  for (const s of J.strays) {
    s.t += dt;
    if (!s.joined && s.x < J.dist + 4) {
      s.joined = true;
      const b = CAT_BREEDS.find(x => x.id === s.breed);
      const cat = { breed: s.breed, ox: 0, oy: 0, h: 0, vh: 0, jumpAt: null, catchUp: 1, bubble: { text: pick(['Mew!', 'Mrrp?', 'Count me in!', 'Adventure!']), t: 1.4 } };
      J.party.push(cat);
      J.rescued++;
      J.score += 50;
      sfx.pickup();
      const tier = CAT_TIERS[b.tier];
      const isNew = !SAVE.journey.cats.includes(s.breed);
      if (isNew) { SAVE.journey.cats.push(s.breed); persist(); }
      J.banner = { title: `${isNew ? 'NEW! ' : ''}${b.name.toUpperCase()}`, sub: `${tier.label ? tier.label + ' - ' : ''}joins the party!`, t: 2.2, small: true };
    }
  }
  J.strays = J.strays.filter(s => !s.joined && s.x > J.dist - KX() - 30);
}

// Party cats run in two rows behind the knight and jump when it jumps.
function updateParty(dt) {
  J.party.forEach((c, i) => {
    const row = i % 2, col = Math.floor(i / 2);
    const tx = -16 - col * 12 - row * 6, ty = row ? 3 : -3;
    c.catchUp = Math.max(0, c.catchUp - dt * 1.5);
    c.ox = tx - c.catchUp * 40;
    c.oy = ty;
    if (c.jumpAt !== null && jt >= c.jumpAt && c.h <= 0) { c.vh = c.jumpV; c.jumpAt = null; }
    if (c.h > 0 || c.vh > 0) {
      c.vh -= J_GRAV * dt;
      c.h = Math.max(0, c.h + c.vh * dt);
      if (c.h === 0) c.vh = 0;
    }
    if (c.bubble && (c.bubble.t -= dt) <= 0) c.bubble = null;
  });
  J.bubbleT -= dt;
  if (J.bubbleT <= 0 && J.party.length) {
    J.bubbleT = 5 + Math.random() * 5;
    pick(J.party).bubble = { text: pick(['Are we there yet?', 'Mew.', 'I smell fish', 'Onward!', 'My paws...', 'Mrrrp!', 'Is that a bird?']), t: 1.6 };
  }
  for (const r of J.runaways) { r.t += dt; r.x -= 110 * dt; }
  J.runaways = J.runaways.filter(r => r.x > -30);
}

function updateRain(dt) {
  for (const r of J.rain) {
    r.x -= 90 * dt; r.y += 160 * dt;
    if (r.y > H) { r.y = -4; r.x = Math.random() * (W + 60); }
    if (r.x < -4) r.x += W + 40;
  }
  J.lightning = Math.max(0, J.lightning - dt);
  if (Math.random() < dt * 0.15) { J.lightning = 0.25; J.flash = 0.25; noise(0.8, 0.12, 120, 60); }
}

// ---------------------------------------------------------------------------
// Boss chases: something from home gives chase. Slash what it throws back.
// ---------------------------------------------------------------------------
function startChase(type) {
  J.chase = { boss: type, x: J.dist - KX() - 30, hp: 3, t: 0, atkT: 2.5, hit: 0 };
  setMusic('boss');
  sfx.boss();
  const def = BOSSES[type];
  J.banner = { title: def.name, sub: type === 'vacuum' ? 'It followed you from home!' : 'Rush hour has a boss.', t: 2.6 };
  J.caption = { text: 'Slash what it throws to send it back!', t: 3 };
}

function updateChase(dt) {
  const C = J.chase;
  C.t += dt;
  C.hit = Math.max(0, C.hit - dt);
  // The boss hovers at the left edge, lunging in now and then.
  const lunge = C.lungeT > 0 ? Math.sin((1 - C.lungeT / 0.9) * Math.PI) * 60 : 0;
  if (C.lungeT > 0) C.lungeT -= dt;
  C.x = J.dist - KX() + 26 + lunge + Math.sin(C.t * 2) * 4;
  C.atkT -= dt;
  if (C.atkT <= 0) {
    C.atkT = 1.6 + Math.random() * 0.8;
    if (C.boss === 'vacuum') {
      if (Math.random() < 0.4) {
        // Lunge along the ground: jump!
        C.lungeT = 0.9;
        C.warn = 0.5;
        sfx.warn();
      } else {
        // Spits a dust bunny that rolls past the runner.
        J.obstacles.push({ kind: 'proj', spr: SPR.tumbleweed[1], x: C.x + 10, sx: C.x + 10, tx: J.dist + 90, sh: 6, h0: 6, arc: 18, T: 1.1, p: 0, w: 9, h: 9 });
        sfx.throw();
      }
    } else {
      // Monday throws meeting invites and sends emails ahead.
      for (let i = 0; i < 2; i++) {
        const T = 1 + i * 0.3;
        J.obstacles.push({ kind: 'proj', spr: SPR.invite, x: C.x + 10, sx: C.x + 10, tx: J.dist + J.speed * T + 24 + i * 16, sh: 30, h0: 30, arc: 46, T, p: 0, w: 7, h: 5, marker: true, fallOnly: true });
      }
      if (Math.random() < 0.4) {
        const spr = SPR.email;
        J.obstacles.push({ kind: 'minion', type: 'email', spr, x: J.dist + W, h0: 0, w: spr.w - 2, h: spr.h - 1, hp: 1, vx: -30, seed: 0, breakable: true, bubble: { text: 'RECURRING!', t: 1.4 } });
      }
      sfx.throw();
    }
  }
  if (C.warn > 0) C.warn -= dt;
  // The lunge hurts if the runner is on the ground in its path.
  if (C.lungeT > 0.2 && C.lungeT < 0.7 && J.kitY < 8 && C.x + 20 > J.dist - 6) hurtJ({});
  if (C.hp <= 0 || C.t > 24) endChase();
}

function deflectJ(o) {
  o.deflected = true;
  o.sx = o.x; o.sh = o.h0; o.tx = J.chase ? J.chase.x : o.x - 60; o.T = 0.4; o.p = 0; o.arc = 12;
  sfx.deflect();
  jText(o.x, o.h0 + 14, 'DENIED!', '#9fd6ef');
}

function chaseHit(n, label = 'BONK!') {
  const C = J.chase;
  if (!C) return;
  C.hp -= n;
  C.hit = 0.15;
  J.shake = 4;
  sfx.heavy();
  jText(C.x, 40, label, '#9fd6ef');
}

function endChase() {
  const C = J.chase;
  const beaten = C.hp <= 0;
  J.chase = null;
  J.chaseDone = true;
  J.score += beaten ? 500 : 200;
  J.fx.push({ kind: 'debris', spr: SPR[C.boss], x: C.x, h: 10, vx: beaten ? -60 : -140, vh: 160, rot: 0, spin: beaten ? 6 : 2, life: 2 });
  J.caption = { text: C.boss === 'vacuum' ? (beaten ? 'The Vacuum choked on its own dust!' : 'The Vacuum got tangled in its cord.') : (beaten ? 'Monday 9AM was rescheduled. Forever.' : 'Monday got stuck in a meeting.'), t: 3 };
  sfx.win();
  setMusic(curLand().mood);
}

// ---------------------------------------------------------------------------
// Ending: Grandma's house, the Human at the door, everyone home.
// ---------------------------------------------------------------------------
function startEnding() {
  J.end = { t: 0, x: J.dist + W * 0.6 };
  J.obstacles = [];
  J.captions = [];
  setMusic('ending');
}

function jUpdateEnding(dt) {
  const E = J.end;
  E.t += dt;
  // Slow to a stop at the door.
  const doorX = E.x - 20;
  const gap = doorX - J.dist;
  const v = Math.max(0, Math.min(J.speed, gap * 1.2));
  J.dist += v * dt;
  jkit.walkT += dt * v / 60;
  if (v < 2) jkit.walkT = 0;
  J.kitY = Math.max(0, J.kitY - 60 * dt);
  updateParty(dt);
  updateJFx(dt);
  if (E.t > 2 && !E.c1) { E.c1 = true; J.caption = { text: 'Ser Biscuit made it.', t: 2.6 }; }
  if (E.t > 4.8 && !E.c2) { E.c2 = true; J.caption = { text: `The Human scooped up all ${J.party.length + 1} of them.`, t: 2.6 }; for (let i = 0; i < 12; i++) J.fx.push({ kind: 'heart', x: E.x - 14 + Math.random() * 20, h: 20 + Math.random() * 10, vh: 20 + Math.random() * 20, life: 2 }); }
  if (E.t > 7.6 && !E.c3) { E.c3 = true; J.caption = { text: 'Home is wherever your Human is.', t: 3 }; }
  if (E.t > 10 && !E.done) {
    E.done = true;
    const km = ((J.dist - J.startDist) / 1000).toFixed(1);
    const rec = setRecord('journey', 'cats', J.rescued);
    SAVE.records.journey.done = true;
    persist();
    showResults({
      title: 'HOME AT LAST', sub: 'The long way to Grandma\'s is complete.', record: rec,
      stats: [['Cats rescued', J.rescued], ['Fish collected', J.fish], ['Distance', `${km} km`], ['Score', J.score], ['Breeds found', `${SAVE.journey.cats.length} of ${CAT_BREEDS.length}`]],
      buttons: [
        { label: 'Keep running', fn: () => { closePanels(); J.end = null; J.endless = true; J.lap = 1; enterLand(1); J.nextObs = J.dist + 200; J.nextItem = J.dist + 120; J.nextStray = J.dist + 300; } },
        { label: 'Modes', fn: goToTitle, back: true },
      ],
    });
  }
}

function journeyOver(src) {
  J.state = 'over';
  sfx.lose();
  const km = ((J.dist - J.startDist) / 1000).toFixed(1);
  setRecord('journey', 'km', Number(km));
  const from = J.checkpoint.chapter;
  J.overT = 0.9;
  J.overFn = () => showResults({
    title: 'SER BISCUIT NEEDS A REST',
    sub: `Stopped in ${curLand().name.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())}.`,
    stats: [['Distance', `${km} km`], ['Cats rescued', J.rescued], ['Fish collected', J.fish], ['Score', J.score]],
    buttons: [
      { label: `Retry from ${LANDS[from % LANDS.length].name.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())}`, fn: () => retryJourney(from) },
      { label: 'Modes', fn: goToTitle, back: true },
    ],
  });
}

function retryJourney(from) {
  const party = J.checkpoint.party;
  startJourney(from);
  // Keep the party from the start of the land, so progress isn't lost.
  J.party = party.map(breed => ({ breed, ox: 0, oy: 0, h: 0, vh: 0, jumpAt: null, catchUp: 0, bubble: null }));
}

// ---------------------------------------------------------------------------
// Captions, effects
// ---------------------------------------------------------------------------
function updateCaptions(dt) {
  if (J.caption) { if ((J.caption.t -= dt) <= 0) J.caption = null; return; }
  if (J.captions.length) {
    J.captionDelay -= dt;
    if (J.captionDelay <= 0) { J.caption = { text: J.captions.shift(), t: 3.2 }; J.captionDelay = 0.6; }
  }
}

function jText(x, h, text, color, life = 0.9) { J.texts.push({ x, h, text, color, life, max: life }); }
function jBurst(sx, sy, n, cols) {
  for (let i = 0; i < n; i++) J.fx.push({ kind: 'px', sx, sy, vx: rand(-50, 50), vy: rand(-70, -10), col: pick(cols), life: rand(0.3, 0.6), max: 0.6 });
}
function jDust(sx, sy) { J.fx.push({ kind: 'px', sx: sx + rand(-4, 2), sy, vx: rand(-40, -10), vy: rand(-12, -2), col: '#d8cfb8', life: 0.4, max: 0.4 }); }
function jSparks(o) { jBurst(o.x - J.dist + KX(), JGROUND() - o.h0 - o.h / 2, 7, ['#ffffff', '#ffe08a']); }

function updateJFx(dt) {
  for (const f of J.fx) {
    f.life -= dt;
    if (f.kind === 'px') { f.sx += f.vx * dt; f.sy += f.vy * dt; f.vy += 160 * dt; }
    else if (f.kind === 'debris') { f.x += f.vx * dt; f.vh -= 500 * dt; f.h += f.vh * dt; f.rot += f.spin * dt; }
    else if (f.kind === 'heart') { f.h += f.vh * dt; }
  }
  J.fx = J.fx.filter(f => f.life > 0);
  for (const tx of J.texts) { tx.h += 14 * dt; tx.life -= dt; }
  J.texts = J.texts.filter(tx => tx.life > 0);
  if (J.state === 'run' && jkit.walkT % 0.5 < dt * 2 && J.kitY === 0 && Math.random() < 0.5) jDust(KX() - 4, JGROUND());
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function palMix(key) {
  const L = curLand();
  if (!J.palFrom || J.palK >= 1) return L[key];
  return rgbStr(lerpRgb(hexToRgb(J.palFrom[key]), hexToRgb(L[key]), J.palK));
}
function palMixRgb(key) {
  const L = curLand();
  if (!J.palFrom || J.palK >= 1) return L[key];
  return lerpRgb(J.palFrom[key], L[key], J.palK);
}

// Deterministic pseudo-random per world slot, so decor stays put.
function slotRand(i, salt) { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); }

// Draws with the trail scrolled to between the last two steps, so it glides.
function journeyDraw() {
  const real = J.dist;
  if (J.prevDist !== undefined && Math.abs(real - J.prevDist) < 50) J.dist = rpx(J.prevDist + (real - J.prevDist) * RALPHA);
  try { journeyDrawAt(); } finally { J.dist = real; }
}

function journeyDrawAt() {
  const L = curLand();
  const gy = JGROUND();
  const shx = J.shake ? Math.round(rand(-J.shake, J.shake)) : 0;
  ctx.save();
  ctx.translate(shx, 0);

  // Sky.
  const top = hexToRgb(L.sky[0]), bot = hexToRgb(L.sky[1]);
  const ftop = J.palFrom && J.palK < 1 ? lerpRgb(hexToRgb(J.palFrom.sky[0]), top, J.palK) : top;
  const fbot = J.palFrom && J.palK < 1 ? lerpRgb(hexToRgb(J.palFrom.sky[1]), bot, J.palK) : bot;
  for (let y = 0; y < gy; y++) {
    const v = (y / gy) * 7;
    const i = Math.floor(v) + ((v % 1) > dither(0, y) ? 1 : 0);
    ctx.fillStyle = rgbStr(lerpRgb(ftop, fbot, Math.min(1, i / 7)));
    ctx.fillRect(-4, y, W + 8, 1);
  }
  // Sun.
  const sunCol = L.time === 'sunset' || L.time === 'dusk' ? '#ffb36e' : L.time === 'storm' ? null : '#fff3cf';
  if (sunCol) {
    ctx.fillStyle = sunCol;
    const sx = L.time === 'dawn' ? W * 0.2 : L.time === 'sunset' ? W * 0.8 : W * 0.6;
    pixDisc(ctx, sx, L.time === 'sunset' || L.time === 'dawn' ? gy - 46 : 26, 8);
  }
  // Far mountains or skyline.
  const far = palMix('far'), hills = palMix('hills');
  if (L.city) {
    for (let i = Math.floor((J.dist * 0.15) / 22) - 1; i < (J.dist * 0.15 + W) / 22 + 1; i++) {
      const bx = i * 22 - J.dist * 0.15, bh = 30 + slotRand(i, 1) * 40;
      ctx.fillStyle = far;
      ctx.fillRect(rpx(bx), Math.round(gy - 20 - bh), 18, bh + 20);
      ctx.fillStyle = '#ffe39a';
      for (let wy = 0; wy < bh - 6; wy += 6) for (let wx = 3; wx < 15; wx += 5) if (slotRand(i * 31 + wy + wx, 2) > 0.55) ctx.fillRect(rpx(bx + wx), Math.round(gy - 16 - bh + wy), 2, 2);
    }
  } else {
    ctx.fillStyle = far;
    for (let x = 0; x < W; x++) {
      const wx = x + J.dist * 0.08;
      const h = 30 + Math.sin(wx * 0.012) * 14 + Math.sin(wx * 0.031 + 1) * 7 + (L.time === 'storm' ? 10 : 0);
      ctx.fillRect(x, Math.round(gy - 14 - h), 1, h + 14);
    }
  }
  ctx.fillStyle = hills;
  for (let x = 0; x < W; x++) {
    const wx = x + J.dist * 0.25;
    const h = 14 + Math.sin(wx * 0.02) * 6 + Math.sin(wx * 0.047 + 2) * 4;
    ctx.fillRect(x, Math.round(gy - 6 - h), 1, h + 6);
  }
  // Mid decor (parallax 0.6).
  const p6 = J.dist * 0.6;
  for (let i = Math.floor(p6 / 46) - 1; i < (p6 + W) / 46 + 2; i++) {
    if (slotRand(i, 3) < 0.35) continue;
    const kind = L.decor[Math.floor(slotRand(i, 4) * L.decor.length)];
    const x = rpx(i * 46 + slotRand(i, 5) * 20 - p6);
    drawDecor(kind, x, gy - 4, i);
  }

  // Ground with the trail.
  const grass = palMix('grass'), grassDark = palMix('grassDark'), trail = palMix('trail');
  ctx.fillStyle = grassDark;
  ctx.fillRect(-4, gy - 4, W + 8, H - gy + 4);
  ctx.fillStyle = grass;
  ctx.fillRect(-4, gy - 4, W + 8, 3);
  ctx.fillStyle = trail;
  ctx.fillRect(-4, gy + 1, W + 8, 9);
  // Ground texture on whole game pixels, slid by the fraction left over.
  const base = Math.floor(J.dist);
  ctx.save();
  ctx.translate(-(J.dist - base), 0);
  for (let x = -4; x < W + 6; x++) {
    const wx = x + base;
    if (dither(wx, 0) > 0.5) { ctx.fillStyle = grass; ctx.fillRect(x, gy, 1, 1); }
    if (dither(wx, 1) > 0.7) { ctx.fillStyle = grassDark; ctx.fillRect(x, gy + 10, 1, 1); }
    if (wx % 37 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, gy + 5, 2, 1); }
    if (wx % 23 === 0) { ctx.fillStyle = grass; ctx.fillRect(x, gy - 6, 1, 3); ctx.fillRect(x + 1, gy - 5, 1, 2); }
  }
  ctx.restore();

  const sx = wx => rpx(wx - J.dist + KX());

  // Strays sitting by the trail.
  for (const s of J.strays) {
    const fr = SPR.cats[s.breed][0];
    ctx.drawImage(fr.img[1], sx(s.x) - 8, gy - 11 + (Math.sin(s.t * 3) > 0.9 ? -1 : 0));
  }
  // Items.
  for (const it of J.items) {
    const bob = Math.round(Math.sin(jt * 5 + it.x) * 1.5);
    ctx.drawImage(SPR.fish.img[0], sx(it.x) - 4, Math.round(gy - it.h - 5 + bob));
  }
  // Obstacles.
  for (const o of J.obstacles) {
    const x = sx(o.x);
    if (x < -40 || x > W + 40) continue;
    if (o.marker && !o.deflected) {
      ctx.fillStyle = Math.floor(jt * 10) % 2 ? 'rgba(255,80,70,0.8)' : 'rgba(255,200,120,0.7)';
      const mx = sx(o.tx);
      ctx.fillRect(mx - 4, gy + 2, 2, 1); ctx.fillRect(mx + 2, gy + 2, 2, 1); ctx.fillRect(mx - 1, gy + 3, 2, 1);
    }
    if (o.kind === 'puddle') {
      ctx.fillStyle = '#2f4f8a'; pixEllipse(ctx, x, gy + 4, 12, 2);
      ctx.fillStyle = '#5aa7d1'; pixEllipse(ctx, x, gy + 4, 11, 1);
      ctx.fillStyle = '#9fd6ef'; ctx.fillRect(x - 5, gy + 3, 4, 1);
      continue;
    }
    if (o.falls && o.h0 > 0) {
      const k = 1 - o.h0 / 120;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`;
      ctx.fillRect(x - 4 - k * 3, gy + 2, 8 + k * 6, 2);
    } else if (!o.falls && o.kind !== 'proj') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x - o.w / 2, gy + 1, o.w, 2);
    }
    const spr = o.spr;
    if (!spr) continue;
    if (o.kind === 'tumbleweed' || o.kind === 'proj') {
      const img = o.kind === 'tumbleweed' ? SPR.tumbleweed[Math.floor(o.rot) % 4].img[0] : spr.img[0];
      ctx.drawImage(img, x - Math.round(img.width / 2), Math.round(gy - o.h0 - img.height + 1));
    } else if (o.kind === 'minion') {
      ctx.drawImage(spr.img[1], x - Math.round(spr.w / 2), Math.round(gy - o.h0 - spr.h + 1 - (o.bob || 0)));
    } else {
      ctx.drawImage(spr.img[0], x - Math.round((spr.ox !== undefined ? spr.ox : spr.w / 2)), Math.round(gy - o.h0 - (spr.oy !== undefined ? spr.oy : spr.h - 1)));
    }
  }
  // Chasing boss.
  if (J.chase) {
    const C = J.chase, spr = SPR[C.boss];
    const x = sx(C.x);
    ctx.drawImage((C.hit > 0 ? spr.white : spr.img)[0], x - Math.round(spr.w / 2), gy - spr.h + 1 + Math.round(Math.abs(Math.sin(jt * 6)) * 2));
    if (C.boss === 'vacuum') for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 18 + ((jt * 80 + i * 13) % 30), gy - 6 - i * 3, 3, 1); }
  }
  // Ending house.
  if (J.end) {
    const c = SPR.cottage[1];
    const hx = sx(J.end.x);
    ctx.drawImage(c.img[0], hx - c.ox, gy - c.oy + 2);
    if (J.end.t > 1.5) drawHuman(hx, gy + 1, J.end.t);
  }

  // Party (back row), knight, party (front row).
  const drawCat = c => {
    const fr = SPR.cats[c.breed][((Math.floor(jkit.walkT * 6 + c.ox) % 2) + 2) % 2];
    const breed = CAT_BREEDS.find(b => b.id === c.breed);
    if (breed.ghost) ctx.globalAlpha = 0.65;
    ctx.drawImage(fr.img[0], KX() + Math.round(c.ox) - 8, Math.round(gy - 10 + c.oy - c.h));
    ctx.globalAlpha = 1;
  };
  J.party.forEach((c, i) => { if (i % 2 === 0) drawCat(c); });
  if (!(J.inv > 0 && jkit.hurtT <= 0 && Math.floor(J.inv * 14) % 2 === 0)) {
    jkit.dashT = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(KX() - 6, gy, 12, 2);
    drawKnight(jkit, KX(), gy + 1 - Math.round(J.kitY) + (J.charging ? 1 : 0));
  }
  J.party.forEach((c, i) => { if (i % 2 === 1) drawCat(c); });
  for (const r of J.runaways) {
    const fr = SPR.cats[r.breed][Math.floor(r.t * 10) % 2];
    ctx.drawImage(fr.img[1], Math.round(r.x) - 8, Math.round(gy - 10 + r.y));
  }

  // Effects.
  for (const f of J.fx) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    if (f.kind === 'px') { ctx.fillStyle = f.col; ctx.fillRect(Math.round(f.sx), Math.round(f.sy), 1, 1); }
    else if (f.kind === 'debris' && f.spr) {
      ctx.save();
      ctx.translate(sx(f.x), Math.round(gy - f.h));
      ctx.rotate(Math.round(f.rot / (Math.PI / 8)) * (Math.PI / 8));
      const img = f.spr.img[0];
      ctx.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
      ctx.restore();
    } else if (f.kind === 'heart') ctx.drawImage(SPR.heart.img[0], sx(f.x) - 3, Math.round(gy - f.h));
    ctx.globalAlpha = 1;
  }
  // Rain.
  if (L.rain) {
    ctx.fillStyle = 'rgba(200,215,235,0.6)';
    for (const r of J.rain) { ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 3); }
  }
  ctx.restore();

  drawTint(ctx, W, H, palMixRgb('tint'));
  if (L.time === 'sunset' || L.time === 'storm' || L.time === 'dusk') {
    drawLights(ctx, { x: 0, y: 0 }, [{ x: KX(), y: gy - 14 - J.kitY, r: 34, col: '#e8b070', a: 1 }], jt, L.time === 'storm' ? 0.5 : 0.35);
  }
  if (J.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${J.flash * 1.6})`; ctx.fillRect(0, 0, W, H); }
}

function drawDecor(kind, x, y, i) {
  if (x < -40 || x > W + 40) return;
  i = Math.abs(i);
  const put = (spr, ox, oy) => ctx.drawImage(spr.img[0], x - ox, y - oy);
  if (kind === 'tree') put(SPR.trees[i % 2], 18, 47);
  else if (kind === 'pine') {
    ctx.fillStyle = '#23402a';
    for (let k = 0; k < 26; k++) ctx.fillRect(x - Math.floor(k / 2.4), y - 30 + k, Math.floor(k / 1.2) + 1, 1);
    ctx.fillStyle = '#4a2d16'; ctx.fillRect(x - 1, y - 4, 3, 4);
  } else if (kind === 'bush') put(SPR.bush[i % 2], 8, 10);
  else if (kind === 'fence') {
    ctx.fillStyle = '#7a4b26';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + k * 10, y - 10, 2, 10);
    ctx.fillStyle = '#9a6a3a';
    ctx.fillRect(x, y - 8, 22, 1); ctx.fillRect(x, y - 4, 22, 1);
  } else if (kind === 'cactus') put(SPR.cactus, 6, 18);
  else if (kind === 'dune') { ctx.fillStyle = '#b8935a'; pixEllipse(ctx, x, y, 24, 5); }
  else if (kind === 'reeds') {
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#5f8f3b' : '#3f6a2a'; ctx.fillRect(x + k * 2, y - 8 - (k % 3) * 2, 1, 8 + (k % 3) * 2); }
    ctx.fillStyle = '#7a4b26'; ctx.fillRect(x + 4, y - 13, 1, 3);
  } else if (kind === 'rockpile') put(SPR.rocks[(i % 2) * 2], 8, 10);
  else if (kind === 'building') {
    const h = 34 + (i % 3) * 10, w = 26;
    ctx.fillStyle = ['#7a6a8a', '#8a6a6a', '#6a7a8a'][i % 3];
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x, y - h, w, 1); ctx.fillRect(x, y - h, 1, h); ctx.fillRect(x + w - 1, y - h, 1, h);
    ctx.fillStyle = '#ffe39a';
    for (let wy = 4; wy < h - 8; wy += 7) for (let wx = 4; wx < w - 4; wx += 6) if (slotRand(i * 17 + wy + wx, 9) > 0.4) ctx.fillRect(x + wx, y - h + wy, 3, 3);
  } else if (kind === 'lamp') {
    ctx.fillStyle = '#2b2220'; ctx.fillRect(x, y - 22, 1, 22); ctx.fillRect(x, y - 22, 4, 1);
    ctx.fillStyle = '#ffe39a'; ctx.fillRect(x + 3, y - 21, 2, 2);
  }
}

// The Human, waiting at the door.
function drawHuman(x, y, et) {
  const hx = Math.round(x + 9), wave = Math.floor(et * 3) % 2;
  const px = (dx, dy, col, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(hx + dx, y - 26 + dy, w, h); };
  px(2, 0, '#4a2d16', 6, 3); px(1, 2, '#4a2d16', 1, 4);         // hair
  px(2, 3, '#e8b897', 6, 5); px(3, 5, '#141414'); px(6, 5, '#141414'); px(4, 7, '#d9668a', 2, 1);  // face
  px(1, 8, '#5b8ee0', 8, 9); px(2, 9, '#2f4f8a', 1, 7);         // shirt
  px(wave ? -1 : 0, wave ? 6 : 9, '#e8b897', 1, 4); px(9, 9, '#e8b897', 1, 4);  // arms
  px(2, 17, '#3a3f5c', 2, 8); px(6, 17, '#3a3f5c', 2, 8);       // legs
  px(1, 25, '#2b2220', 3, 1); px(6, 25, '#2b2220', 3, 1);
}

function journeyUI() {
  const L = curLand();
  const gy = JGROUND();
  const sxw = wx => wx - J.dist + KX();

  // Hearts, fish and party count.
  for (let i = 0; i < 3; i++) uimg(SPR[i < J.hp ? 'heart' : 'heartEmpty'].img[0], 4 + i * 9, 4, 7, 6);
  uimg(SPR.fish.img[0], 4, 14);
  ut(`${SAVE.fish}`, 15, 13, { size: 6, color: '#9fd6ef' });
  uimg(SPR.cats.tabby[0].img[0], 3, 22, 12, 8);
  ut(`${J.party.length}`, 17, 22, { size: 6, color: '#ffd25e' });
  ut(`${J.score}`, W - 4, 3, { size: 8, align: 'right', font: TITLE_FONT, weight: 400, stroke: 3 });

  // Progress to Grandma's.
  if (!J.endless) {
    const bw = Math.min(150, W - 120), bx = W / 2 - bw / 2;
    ut(L.name, W / 2, 3, { size: 6, color: '#f6e9c8', align: 'center' });
    ubar(bx, 12, bw, 2, (J.dist) / TOTAL_LEN, '#ffd25e');
    for (let i = 1; i < LANDS.length; i++) urect(bx + bw * landStart(i) / TOTAL_LEN - 0.3, 11, 0.6, 4, '#1d1816');
    uimg(SPR.cottage[0].img[0], bx + bw - 4, 7, 8, 7);
    uimg(SPR.kitten.idle.img[0], bx + bw * Math.min(1, J.dist / TOTAL_LEN) - 4, 6, 8, 10);
  } else {
    ut(`${L.name}  -  the road goes on (lap ${J.lap})`, W / 2, 3, { size: 6, color: '#f6e9c8', align: 'center' });
  }
  if (J.chase) {
    const C = J.chase;
    ut(BOSSES[C.boss].name, 6, 34, { size: 6, color: '#ff8a7a' });
    ubar(6, 42, 36, 2, C.hp / 3, '#e04b3f', '#5c2320');
    if (C.warn > 0) ut('JUMP!', KX(), gy - 50, { size: 9, color: '#ff5a5a', align: 'center' });
  }

  // Charge meter.
  if (J.charging) ubar(KX() - 8, gy - 40, 16, 2, J.chargeT / 0.45, J.chargeT >= 0.44 ? '#ffffff' : '#ffd25e');

  // Bubbles.
  for (const c of J.party) if (c.bubble) ububble(c.bubble.text, KX() + c.ox, gy - 12 + c.oy - c.h, Math.min(1, c.bubble.t * 4), W);
  for (const s of J.strays) if (sxw(s.x) < W - 10) ububble('?', sxw(s.x), gy - 12, 1, W);
  for (const o of J.obstacles) if (o.bubble) ububble(o.bubble.text, sxw(o.x), gy - o.h0 - o.h - 2, Math.min(1, o.bubble.t * 4), W);
  for (const tx of J.texts) {
    const half = uwidth(tx.text, 5.5) / 2 + 3;
    ut(tx.text, clamp(sxw(tx.x), half, W - half), gy - tx.h - 20, { size: 5.5, color: tx.color, align: 'center', alpha: Math.min(1, tx.life / tx.max * 2) });
  }

  if (J.banner) {
    const a = Math.min(1, J.banner.t * 2);
    const y0 = Math.round(H * 0.24);
    band(y0 - 6, J.banner.small ? 26 : 34, 0.45 * a);
    if (J.banner.small) ut(J.banner.title, W / 2, y0 - 2, { size: 9, color: '#ffd25e', align: 'center', alpha: a });
    else utitle(J.banner.title, W / 2, y0, 11, '#ffd25e', 'center', a);
    ut(J.banner.sub, W / 2, y0 + (J.banner.small ? 10 : 16), { size: 6, color: '#ffffff', align: 'center', alpha: a });
  }
  if (J.caption) {
    const a = Math.min(1, J.caption.t * 2, (3.2 - J.caption.t) * 4 + 0.2);
    band(H - 17, 14, 0.5 * a);
    ut(J.caption.text, W / 2, H - 14, { size: 7, color: '#ffffff', align: 'center', alpha: a, weight: 600 });
  }
  if (jt < 7 && !J.endless && J.chapter === 0 && !J.end) {
    const a = Math.min(1, 7 - jt);
    const hint = input.mode === 'touch' ? 'Hold the left side to charge a jump, tap again for a double jump. HIT to slash.'
      : input.mode === 'pad' ? 'Hold A to charge a jump, A again to double jump. X to slash.'
        : 'Hold SPACE / K to charge a jump, press again to double jump. J to slash.';
    ut(hint, W / 2, H * 0.62, { size: 5.5, color: '#ffffff', align: 'center', alpha: a });
  }
}
