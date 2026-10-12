'use strict';

const { Engine, Bodies, Body, Composite, Events } = Matter;

// ---------------------------------------------------------------------------
// Arena: the free-roam brawler used by Story, Endless, Boss Rush and Daily.
//
// Physics is top-down (Matter.js, no gravity) in a world S times larger than
// the pixel grid. Height (z) for jumps, launches and standing on things is
// simulated separately.
// ---------------------------------------------------------------------------
const S = 4;
const Z_GRAVITY = 620;

const CAT = { WALL: 1, KITTEN: 2, ENEMY: 4, DEBRIS: 8, PROP: 16, PLAT: 32 };
const MASK = {
  kitten: CAT.WALL | CAT.ENEMY | CAT.PROP | CAT.PLAT,
  kittenLow: CAT.WALL | CAT.ENEMY | CAT.PROP,
  kittenHigh: CAT.WALL | CAT.PROP,
  dash: CAT.WALL | CAT.PROP | CAT.PLAT,
  dashAir: CAT.WALL | CAT.PROP,
  enemy: CAT.WALL | CAT.KITTEN | CAT.ENEMY | CAT.DEBRIS | CAT.PROP | CAT.PLAT,
  ghost: CAT.WALL,
  none: 0,
  debris: CAT.WALL | CAT.ENEMY | CAT.DEBRIS | CAT.PROP | CAT.PLAT,
  prop: 0xffff,
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
const MINIONS = {
  alarm: { hp: 2, speed: 0.5, r: 5, waker: true, name: 'an alarm clock', barks: ['BRRRING!', 'WAKE UP!', 'RISE & SHINE!', '5 MORE MINS?'] },
  bell: { hp: 1, speed: 0.75, r: 5, waker: true, name: 'a notification', barks: ['DING!', '*ping*', '1 new message', '@Human'] },
  email: { hp: 2, speed: 0.62, r: 5, name: 'an unread email', barks: ['Per my last email', 'URGENT!!!', 'RE: RE: FWD:', 'Quick question'] },
  sock: { hp: 1, speed: 0.9, r: 4, hop: true, name: 'a lost sock', barks: ['Where is my pair?', 'Left one!', '*flop*'] },
  bill: { hp: 4, speed: 0.42, r: 5, heavy: true, name: 'an unpaid bill', barks: ['OVERDUE', 'Pay me', 'FINAL NOTICE', '+late fee'] },
  mosquito: { hp: 1, speed: 0.8, r: 3, fly: true, name: 'a mosquito', barks: ['bzzz', 'BZZZZZZ', '*bite*'] },
  duck: { hp: 1, speed: 0.72, r: 4, name: 'a rubber duck', barks: ['QUACK', 'squeak!', 'Bath time?'] },
};

const BOSSES = {
  monday: {
    name: 'MONDAY 9AM', title: 'Could have been an email', hp: 24, r: 13, speed: 0.42,
    attacks: ['invites', 'charge', 'summon'], intro: 'Quick sync?', taunts: ['Circle back!', 'Per my calendar', 'RECURRING!'], death: 'Could have been... an email...',
  },
  cucumber: {
    name: 'THE CUCUMBER', title: 'Silent green terror', hp: 26, r: 8, speed: 0.3,
    attacks: ['leap', 'vanish', 'leap'], intro: '...', taunts: ['...', '......'], death: '...',
  },
  vacuum: {
    name: 'THE VACUUM', title: 'Devourer of naps', hp: 30, r: 10, speed: 0.5,
    attacks: ['suck', 'charge'], intro: 'VRRRRRRRR!', taunts: ['*slurp*', 'VRRRRR!'], death: 'vrr... rr... r.',
  },
  bath: {
    name: 'BATH TIME', title: 'The wettest evil', hp: 34, r: 15, speed: 0.32,
    attacks: ['fountain', 'ducks', 'slide'], intro: 'Just a quick rinse!', taunts: ['Splish!', 'Rub-a-dub!', 'Behind the ears!'], death: '*gurgle*',
  },
};
const BOSS_ORDER = ['monday', 'cucumber', 'vacuum', 'bath'];

const COMBO_BARKS = { 10: 'For the nap!', 20: 'Tiny but mighty!', 30: 'Meowsterful!', 45: 'Fear the bow!', 60: 'LEGENDARY!' };

const MODS = {
  speedy: { name: 'Speedy', desc: 'Enemies move faster' },
  tanky: { name: 'Tanky', desc: 'Enemies have +1 HP' },
  swarm: { name: 'Swarm', desc: '50% more enemies' },
  alarming: { name: 'Alarming', desc: 'More alarms head for the door' },
  bouncy: { name: 'Bouncy', desc: 'Everything flies further' },
  slippery: { name: 'Slippery', desc: 'The meadow is icy' },
  glass: { name: 'Glass Cannon', desc: '2 hearts, double damage' },
};

// ---------------------------------------------------------------------------
// Physics world
// ---------------------------------------------------------------------------
const engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 6, velocityIterations: 4 });
const pworld = engine.world;

function staticRect(cx, cy, w, h, restitution = 0.3) {
  return Bodies.rectangle(cx * S, cy * S, w * S, h * S, {
    isStatic: true, restitution, friction: 0,
    collisionFilter: { category: CAT.WALL, mask: 0xffff },
  });
}
Composite.add(pworld, [
  staticRect(-10, WD / 2, 32, WD + 80),
  staticRect(WW + 10, WD / 2, 32, WD + 80),
  staticRect(WW / 2, -10, WW + 80, 30),
  staticRect(WW / 2, WD + 10, WW + 80, 32),
  staticRect(COTTAGE.x, COTTAGE.y - 9, 40, 18),
  staticRect(BARN.x, BARN.y - 11, 56, 22),
]);

function circleBody(x, y, r, opts) {
  return Bodies.circle(x * S, y * S, r * S, { inertia: Infinity, friction: 0, frictionStatic: 0, ...opts });
}
const setVel = (e, vx, vy) => Body.setVelocity(e.body, { x: vx * S, y: vy * S });
const getVel = e => ({ x: e.body.velocity.x / S, y: e.body.velocity.y / S });
const speedOf = e => Math.hypot(e.body.velocity.x, e.body.velocity.y) / S;
const setMask = (e, m) => { e.body.collisionFilter.mask = m; };

let contacts = [];
Events.on(engine, 'collisionStart', ev => {
  for (const p of ev.pairs) contacts.push([p.bodyA, p.bodyB]);
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let arenaState = 'attract';   // attract | intro | play | bossIntro | transition | ending | over
let t = 0;
let game = null;
let ents = [];
let props = [];
let obstacles = [];           // static circles enemies steer around
let particles = [];
let texts = [];
const cam = { x: COTTAGE.x - 120, y: 40 };
let view = { x: 0, y: 0 };

const kit = {
  kind: 'kitten', x: DOOR.x, y: 180, z: 0, vz: 0, r: 5, facing: 1, floor: 0, plat: null,
  hp: 5, maxHp: 5, inv: 0, hurtT: 0,
  atkT: 0, combo: 0, window: 0, cd: 0,
  dashT: 0, dashCd: 0, dashX: 0, dashY: 0, plunge: false, plungeFrom: 0, airJumps: 0, airDash: false,
  walkT: 0, blinkT: 2, scaredT: 0, yarn: 0, catnip: 0, wet: 0, sprint: false,
  pullX: 0, pullY: 0, control: false, bubble: null, sleeping: false, zone: null,
  body: circleBody(DOOR.x, 180, 5, { frictionAir: 0.25, density: 0.004, collisionFilter: { category: CAT.KITTEN, mask: MASK.kitten } }),
};
kit.body.ent = kit;
Composite.add(pworld, kit.body);

function placeKitten(x, y) {
  Body.setPosition(kit.body, { x: x * S, y: y * S });
  Body.setVelocity(kit.body, { x: 0, y: 0 });
  kit.x = x; kit.y = y; kit.z = 0; kit.vz = 0;
}

function newArenaGame(modeId, mods = []) {
  game = {
    mode: modeId, mods: new Set(mods), level: 1, speedMul: 1, hpBonus: 0, bossHpMul: 1,
    tod: 0, lap: 0, wave: 0, toSpawn: 0, spawnT: 0, waveGap: 0, phase: 'idle', pool: ['alarm'],
    score: 0, dayScore: 0, combo: 0, comboT: 0, bestCombo: 0,
    nap: 5, napMax: 5, napOn: true, boss: null, hitStop: 0, shake: 0, slowT: 0, flash: 0,
    banner: null, zoneBanner: null, markers: [], rings: [], timers: [], wakerT: 8,
    reason: '', killer: '', overT: 0, hintT: 0, elapsed: 0,
    stats: { kills: 0, chains: 0, bosses: 0, saved: 0 },
    cine: { bars: 0, barsTo: 0, focus: null, title: null },
  };
  const glass = game.mods.has('glass');
  kit.maxHp = glass ? 2 : 5;
  Object.assign(kit, {
    hp: kit.maxHp, inv: 0, yarn: 0, catnip: 0, wet: 0, combo: 0, sleeping: false, bubble: null,
    plunge: false, airJumps: 0, scaredT: 0, hurtT: 0, dashT: 0, zone: null,
  });
  kit.body.frictionAir = game.mods.has('slippery') ? 0.03 : 0.25;
}

function after(sec, fn) { game.timers.push({ t: sec, fn }); }
const hasMod = m => game && game.mods.has(m);

// ---------------------------------------------------------------------------
// Arena population
// ---------------------------------------------------------------------------
function clearEnts() {
  for (const e of ents) if (e.body) Composite.remove(pworld, e.body);
  ents = [];
  particles = [];
  texts = [];
  if (game) { game.markers = []; game.rings = []; }
}

function buildArena() {
  for (const p of props) Composite.remove(pworld, p.body);
  props = [];
  obstacles = [
    { x: COTTAGE.x - 14, y: COTTAGE.y - 8, r: 12 }, { x: COTTAGE.x + 14, y: COTTAGE.y - 8, r: 12 },
    { x: BARN.x - 18, y: BARN.y - 10, r: 15 }, { x: BARN.x + 18, y: BARN.y - 10, r: 15 },
  ];
  const add = (p, solid = true) => {
    p.body.ent = p;
    Composite.add(pworld, p.body);
    props.push(p);
    if (solid && p.body.isStatic) obstacles.push({ x: p.x, y: p.y, r: p.pr || 6 });
    return p;
  };
  const stat = cat => ({ isStatic: true, restitution: 0.5, collisionFilter: { category: cat, mask: MASK.prop } });

  for (const [x, y, v] of [...orchardTrees(), ...LAYOUT.extraTrees]) {
    add({ kind: 'tree', x, y, spr: SPR.trees[v], pr: 5, body: circleBody(x, y, 4, stat(CAT.PROP)) });
  }
  for (const [x, y, v] of LAYOUT.bushes) {
    add({ kind: 'bush', x, y, spr: SPR.bush[v], pr: v ? 7 : 6, body: circleBody(x, y, v ? 6 : 5, stat(CAT.PROP)) });
  }
  const tops = [8, 6, 10];
  for (const [x, y, v] of LAYOUT.rocks) {
    const spr = SPR.rocks[v];
    const pr = Math.floor(spr.w / 2) - 1;
    add({ kind: 'rock', x, y, spr, pr, top: tops[v], body: circleBody(x, y, pr, stat(CAT.PLAT)) });
  }
  for (const [x, y] of LAYOUT.stumps) add({ kind: 'stump', x, y, spr: SPR.stump, pr: 5, top: 7, body: circleBody(x, y, 5, stat(CAT.PLAT)) });
  for (const [x, y] of LAYOUT.stacks) add({ kind: 'stack', x, y, spr: SPR.stack, pr: 10, top: 19, body: circleBody(x, y, 10, stat(CAT.PLAT)) });
  const [wx, wy] = LAYOUT.well;
  add({ kind: 'well', x: wx, y: wy, spr: SPR.well, pr: 8, top: 12, body: circleBody(wx, wy, 8, stat(CAT.PLAT)) });
  for (const [x, y] of LAYOUT.signs) add({ kind: 'sign', x, y, spr: SPR.sign, pr: 2, body: circleBody(x, y, 1.5, stat(CAT.PROP)) }, false);
  for (const [x, y] of LAYOUT.bales) {
    add({
      kind: 'bale', x, y, spr: SPR.bale[0], roll: 0, pr: 6, top: 11,
      body: circleBody(x, y, 6, { frictionAir: game && hasMod('slippery') ? 0.01 : 0.04, density: 0.01, restitution: hasMod('bouncy') ? 0.8 : 0.4, collisionFilter: { category: CAT.PLAT, mask: MASK.prop } }),
    });
  }
}

function spawnCrates(n) {
  for (const p of props.filter(p => p.kind === 'crate')) Composite.remove(pworld, p.body);
  props = props.filter(p => p.kind !== 'crate');
  for (let i = 0; i < n; i++) {
    let x, y, tries = 0;
    do { x = grange(30, WW - 30); y = grange(30, WD - 24); tries++; }
    while (tries < 40 && (inPond(x, y, 10) || onPath(x, y) || props.some(p => Math.hypot(p.x - x, p.y - y) < 22) ||
      Math.hypot(x - COTTAGE.x, y - COTTAGE.y) < 40 || Math.hypot(x - BARN.x, y - BARN.y) < 44));
    const p = { kind: 'crate', x, y, spr: SPR.crate, hp: 2, flash: 0, pr: 5, top: 11 };
    p.body = circleBody(x, y, 5, { frictionAir: 0.2, density: 0.005, collisionFilter: { category: CAT.PLAT, mask: MASK.prop } });
    p.body.ent = p;
    Composite.add(pworld, p.body);
    props.push(p);
  }
}

// The highest surface under (x, y) that is not above height z.
function floorAt(x, y, z) {
  let f = 0, plat = null;
  for (const p of props) {
    if (!p.top || p.top > z + 3.5) continue;
    if (Math.hypot(x - p.x, (y - p.y) * 1.3) < p.pr + 1.5 && p.top > f) { f = p.top; plat = p; }
  }
  return { f, plat };
}

function inView(x, y, pad = 0) {
  return x > cam.x - pad && x < cam.x + W + pad && y > cam.y - pad && y < cam.y + H + pad;
}

// Chasers appear just off screen around the kitten; wakers come from the edges.
function spawnPoint(waker) {
  for (let i = 0; i < 12; i++) {
    let x, y;
    if (waker) {
      const side = gpick(['w', 'e', 's', 's', 'n']);
      if (side === 'w') { x = 12; y = grange(30, WD - 20); }
      else if (side === 'e') { x = WW - 12; y = grange(30, WD - 20); }
      else if (side === 'n') { x = gpick([grange(40, 300), grange(560, 680)]); y = 16; }
      else { x = grange(30, WW - 30); y = WD - 12; }
    } else {
      const a = grand() * Math.PI * 2, r = Math.max(W, H) * 0.62 + grange(0, 40);
      x = clamp(kit.x + Math.cos(a) * r, 14, WW - 14);
      y = clamp(kit.y + Math.sin(a) * r * 0.7, 18, WD - 12);
    }
    if (inPond(x, y, 6) || floorAt(x, y, 99).f > 0) continue;
    if (!inView(x, y, 6) || i > 9) return { x, y };
  }
  return { x: 12, y: WD / 2 };
}

function spawnMinion(type, at) {
  const def = MINIONS[type];
  const p = at || spawnPoint(def.waker);
  const e = {
    kind: 'minion', type, def, spr: SPR[type], x: p.x, y: p.y, z: def.fly ? 14 : 18, vz: def.fly ? 0 : 40,
    r: def.r, hp: def.hp + game.hpBonus + (hasMod('tanky') ? 1 : 0), state: 'enter', t: 0, cd: grange(0.6, 1.6), flash: 0, bubble: null,
    barkT: rand(3, 8), seed: rand(0, 6), hopT: 0, speed: def.speed * game.speedMul * (hasMod('speedy') ? 1.3 : 1),
  };
  e.body = circleBody(p.x, p.y, def.r, {
    frictionAir: hasMod('slippery') ? 0.06 : 0.22, density: def.heavy ? 0.006 : 0.002, restitution: 0.2,
    collisionFilter: { category: CAT.ENEMY, mask: def.fly ? MASK.ghost : MASK.enemy },
  });
  e.body.ent = e;
  Composite.add(pworld, e.body);
  ents.push(e);
  if (Math.random() < 0.3 && inView(p.x, p.y, 20)) say(e, pick(def.barks));
  for (let i = 0; i < 6; i++) dust(p.x, p.y);
  return e;
}

function spawnBoss(type, at) {
  const def = BOSSES[type];
  const hp = Math.round((def.hp + game.lap * 8) * game.bossHpMul * (hasMod('tanky') ? 1.2 : 1));
  const e = {
    kind: 'boss', type, def, spr: SPR[type], x: at.x, y: at.y, z: 0, vz: 0, r: def.r,
    hp, maxHp: hp, phase: 'idle', t: 0, cd: 2, flash: 0, bubble: null, atk: 0, enraged: false,
    alpha: 1, sink: 0, speed: def.speed * Math.min(1.6, game.speedMul) * (hasMod('speedy') ? 1.15 : 1),
    name: def.name + (game.lap ? ' ' + '+'.repeat(game.lap) : ''),
  };
  e.body = circleBody(at.x, at.y, def.r, {
    frictionAir: 0.2, density: 0.02, restitution: 0.2,
    collisionFilter: { category: CAT.ENEMY, mask: MASK.enemy },
  });
  e.body.ent = e;
  Composite.add(pworld, e.body);
  ents.push(e);
  game.boss = e;
  return e;
}

function removeEnt(e) {
  if (e.dead) return;
  e.dead = true;
  if (e.body) Composite.remove(pworld, e.body);
}

// ---------------------------------------------------------------------------
// Speech bubbles, text, particles
// ---------------------------------------------------------------------------
function say(e, text, dur = 1.8) {
  const shown = ents.filter(o => o.bubble && !o.dead).length + (kit.bubble ? 1 : 0);
  if (shown >= 3 && e !== kit && e.kind !== 'boss') return;
  e.bubble = { text, t: dur };
}

function addText(x, y, text, color, life = 0.9, size = 5.5) {
  for (let i = 0; i < 4 && texts.some(o => Math.abs(o.y - y) < 7 && Math.abs(o.x - x) < 40); i++) y -= 7;
  texts.push({ x, y, text, color, life, max: life, size });
}

function burst(x, y, z, n, cols, speed = 60, up = 80, g = true) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({
      x, y, z, vx: Math.cos(a) * rand(0.3, 1) * speed, vy: Math.sin(a) * rand(0.3, 1) * speed * 0.6,
      vz: rand(0.3, 1) * up, life: rand(0.3, 0.7), max: 0.7, col: pick(cols), g,
    });
  }
}

function dust(x, y, z = 1) {
  particles.push({ x: x + rand(-3, 3), y: y + rand(-1, 1), z, vx: rand(-12, 12), vy: rand(-4, 4), vz: rand(8, 20), life: 0.4, max: 0.4, col: '#d8cfb8', g: false });
}

function sparks(x, y, z) { burst(x, y, z, 7, ['#ffffff', '#ffe08a', '#fff4c8'], 90, 60, false); }
function spawnPetals(f) { burst(f.x, f.y, 3, 6, [f.col, f.col, '#7cab52'], 30, 60); }

// ---------------------------------------------------------------------------
// Kitten: walk, sprint (hold dash), dash, double jump, climb, attack, pound
// ---------------------------------------------------------------------------
function updateKitten(dt) {
  for (const k of ['inv', 'hurtT', 'atkT', 'window', 'cd', 'dashCd', 'yarn', 'catnip', 'wet', 'scaredT']) kit[k] = Math.max(0, kit[k] - dt);
  kit.blinkT -= dt;
  if (kit.blinkT < -0.12) kit.blinkT = rand(2, 4);
  if (kit.bubble && (kit.bubble.t -= dt) <= 0) kit.bubble = null;
  for (const p of scenery.puddles) if (Math.hypot(kit.x - p.x, (kit.y - p.y) * 2) < p.r && kit.z < 2) kit.wet = Math.max(kit.wet, 0.3);

  const { f: floor, plat } = floorAt(kit.x, kit.y, kit.z);
  kit.floor = floor;
  kit.plat = plat;
  const grounded = kit.z <= floor + 0.5 && kit.vz <= 0;
  if (grounded) { kit.z = floor; kit.vz = 0; kit.airJumps = 0; kit.airDash = false; }

  const pond = kit.z < 1 && inPond(kit.x, kit.y);
  let vx = 0, vy = 0;
  if (kit.dashT > 0) {
    kit.dashT -= dt;
    vx = kit.dashX * 3.4;
    vy = kit.dashY * 3.4;
    if (Math.random() < 0.6) dust(kit.x, kit.y, kit.z + 1);
  } else if (kit.control) {
    const moving = Math.hypot(input.mx, input.my) > 0.15;
    kit.sprint = input.held.dash && moving && grounded;
    let sp = 1.05 * (kit.catnip > 0 ? 1.45 : 1) * (kit.wet > 0 ? 0.6 : 1) * (pond ? 0.65 : 1) * (kit.sprint ? 1.5 : 1);
    if (kit.atkT > 0 && grounded) sp *= 0.35;
    vx = input.mx * sp;
    vy = input.my * sp * 0.85;
    if (Math.abs(input.mx) > 0.2 && kit.atkT <= 0) kit.facing = Math.sign(input.mx);
    if (moving) kit.walkT += dt * (kit.sprint ? 1.5 : 1); else kit.walkT = 0;
    if (moving && grounded && Math.floor(kit.walkT * 5) !== Math.floor((kit.walkT - dt) * 5)) {
      if (pond || kit.wet > 0) { scenery.ripples.push({ x: kit.x, y: kit.y, t: 0 }); burst(kit.x, kit.y, 1, 2, ['#9fd6ef', '#ffffff'], 20, 40); }
      else dust(kit.x, kit.y, kit.z + 1);
    }

    if (input.pressed.jump) {
      if (grounded) { kit.vz = 180; sfx.jump(); }
      else if (kit.airJumps < 1 && !kit.plunge) {
        // Double jump with a little puff of air.
        kit.vz = 155;
        kit.airJumps = 1;
        sfx.jump();
        burst(kit.x, kit.y, kit.z, 6, ['#ffffff', '#e9e4dc'], 30, -20, false);
      }
    }
    if (input.pressed.dash && kit.dashCd <= 0 && (grounded || !kit.airDash)) {
      const d = moving ? norm(input.mx, input.my) : { x: kit.facing, y: 0 };
      kit.dashX = d.x; kit.dashY = d.y;
      kit.dashT = 0.2;
      kit.dashCd = 0.5;
      if (!grounded) { kit.airDash = true; kit.vz = Math.max(kit.vz, 40); }
      if (Math.abs(d.x) > 0.2) kit.facing = Math.sign(d.x);
      sfx.dash();
    }
    if (input.pressed.attack && kit.cd <= 0 && kit.dashT <= 0) {
      if (kit.z > floor + 6 && !kit.plunge) { kit.plunge = true; kit.plungeFrom = kit.z; kit.vz = -380; }
      else if (kit.z <= floor + 6) attack();
    }
  }
  vx += kit.pullX; vy += kit.pullY;
  kit.pullX = kit.pullY = 0;
  if (hasMod('slippery') && kit.dashT <= 0) {
    const v = getVel(kit);
    setVel(kit, lerp(v.x, vx, 0.08), lerp(v.y, vy, 0.08));
  } else setVel(kit, vx, vy);

  // Height: fall, land on whatever is below, pound when plunging.
  if (!grounded || kit.vz > 0) {
    if (!kit.plunge) kit.vz -= Z_GRAVITY * dt;
    kit.z += kit.vz * dt;
    const below = floorAt(kit.x, kit.y, kit.z).f;
    if (kit.z <= below && kit.vz <= 0) {
      kit.z = below;
      kit.vz = 0;
      if (kit.plunge) { kit.plunge = false; groundPound(kit.plungeFrom - below); }
      else { sfx.land(); for (let i = 0; i < 3; i++) dust(kit.x, kit.y, below + 1); }
    }
  }

  // Collision layers follow height: on the ground you bump into rocks and
  // enemies, a little higher you clear rocks, higher still you clear enemies.
  const high = kit.z >= 3;
  let mask = !high ? MASK.kitten : kit.z < 8 ? MASK.kittenLow : MASK.kittenHigh;
  if (kit.dashT > 0) mask = high ? MASK.dashAir : MASK.dash;
  setMask(kit, mask);

  // Falling beside something taller: slide off its side instead of sinking in.
  if (high && kit.vz <= 0) {
    for (const p of props) {
      if (!p.top || kit.z >= p.top - 3) continue;
      const dx = kit.x - p.x, dy = (kit.y - p.y) * 1.3, d = Math.hypot(dx, dy);
      if (d < p.pr + 1.5) {
        const n = norm(dx || 0.01, dy);
        Body.setPosition(kit.body, { x: (p.x + n.x * (p.pr + kit.r)) * S, y: (p.y + n.y * (p.pr + kit.r) / 1.3) * S });
      }
    }
  }

  // Area names pop up as you explore.
  const z = zoneAt(kit.x, kit.y);
  if (z !== kit.zone) {
    if (kit.zone && arenaState === 'play') game.zoneBanner = { name: z.name, t: 2 };
    kit.zone = z;
  }
}

function hurtKitten(src, dmg = 1) {
  if (kit.inv > 0 || kit.dashT > 0 || arenaState !== 'play') return false;
  kit.hp -= dmg;
  kit.inv = 1.1;
  kit.hurtT = 0.4;
  game.combo = 0;
  game.shake = 5;
  game.hitStop = 0.06;
  const d = norm(kit.x - src.x, kit.y - src.y);
  setVel(kit, d.x * 3, d.y * 3);
  sfx.hurt();
  say(kit, kit.hp <= 1 ? 'Need... nap...' : pick(['Mrrp!', 'Hsss!', 'Ow!']), 1);
  if (kit.hp <= 0) arenaGameOver('fell', src.label || (src.def && src.def.name) || 'a tiny inconvenience');
  return true;
}

// Three-hit combo; the third hit launches. With yarn, every swing spins.
function attack() {
  kit.combo = kit.window > 0 ? kit.combo % 3 + 1 : 1;
  const finisher = kit.combo === 3;
  const fast = kit.catnip > 0 ? 0.6 : 1;
  kit.window = 0.45;
  kit.atkT = 0.16;
  kit.cd = (finisher ? 0.3 : 0.14) * fast;
  const spin = kit.yarn > 0;
  sfx.swing();

  // Aim assist: turn toward the nearest enemy and nudge onto its row.
  let near = null, nd = 38;
  for (const e of ents) {
    if (!isAlive(e) || Math.abs(e.z - kit.z) > 18) continue;
    const d = Math.abs(e.x - kit.x);
    if (d < nd && Math.abs(e.y - kit.y) < 18) { nd = d; near = e; }
  }
  if (near && Math.abs(input.mx) < 0.3) kit.facing = Math.sign(near.x - kit.x) || kit.facing;
  if (near && Math.abs(near.y - kit.y) > 4 && kit.z < 3) {
    Body.setPosition(kit.body, { x: kit.body.position.x, y: kit.body.position.y + clamp(near.y - kit.y, -3, 3) * S });
  }

  const f = kit.facing;
  const inBox = (x, y, z, r) => {
    const dx = x - kit.x, dy = y - kit.y;
    if (Math.abs(z - kit.z) > 18) return false;
    if (spin) return dx * dx + (dy * 1.6) ** 2 < (26 + r) ** 2;
    return dx * f > -6 && dx * f < 22 + r && Math.abs(dy) < 8 + r * 0.7;
  };
  const dirTo = (x, y) => spin ? norm(x - kit.x, (y - kit.y) * 0.5) : { x: f, y: clamp((y - kit.y) * 0.05, -0.4, 0.4) };

  let hits = 0;
  for (const e of ents) {
    if (e.dead) continue;
    if (isAlive(e) && inBox(e.x, e.y, e.z, e.r)) {
      if (e.kind === 'boss' && (e.alpha < 0.5 || e.phase === 'leap')) continue;
      damage(e, finisher ? 2 : 1, dirTo(e.x, e.y), finisher, 0);
      hits++;
    } else if (e.kind === 'debris' && inBox(e.x, e.y, e.z, e.r)) {
      juggle(e, dirTo(e.x, e.y));
      hits++;
    } else if (e.kind === 'proj' && !e.deflected && inBox(e.x, e.y, e.z, 3)) {
      deflect(e);
      hits++;
    }
  }
  for (const p of props) {
    if ((p.kind === 'bale' || p.kind === 'crate') && inBox(p.x, p.y, 0, 6) && kit.z < 8) {
      const d = dirTo(p.x, p.y);
      if (p.kind === 'bale') { Body.setVelocity(p.body, { x: d.x * 5 * S, y: d.y * 5 * S }); addText(p.x, p.y - 16, 'ROLL!', '#f6e09a'); }
      else hitCrate(p, d);
      hits++;
    }
  }
  if (kit.z < 4) cutFlowers(kit.x + (spin ? 0 : f * 12), kit.y, spin ? 28 : 18, spin ? 18 : 9, spawnPetals);

  if (hits) {
    game.hitStop = Math.max(game.hitStop, finisher ? 0.09 : 0.045);
    game.shake = Math.max(game.shake, finisher ? 4 : 2);
    if (finisher) sfx.heavy(); else sfx.hit(game.combo);
  }
}

// Bigger fall, bigger pound.
function groundPound(height) {
  const extra = clamp(height, 0, 60);
  game.shake = 6 + extra / 10;
  game.hitStop = 0.08;
  sfx.pound();
  game.rings.push({ x: kit.x, y: kit.y, r: 2, max: 30 + extra * 0.5, speed: 170, friendly: true, hit: new Set(), z: kit.floor });
  for (let i = 0; i < 12; i++) dust(kit.x + rand(-10, 10), kit.y + rand(-4, 4), kit.floor + 1);
  if (extra > 15) addText(kit.x, kit.y - 36, 'BIG POUND!', '#ffd25e');
  if (kit.floor === 0) cutFlowers(kit.x, kit.y, 26, 14, spawnPetals);
}

// ---------------------------------------------------------------------------
// Damage, launches and chains
// ---------------------------------------------------------------------------
const isAlive = e => !e.dead && (e.kind === 'minion' || e.kind === 'boss');

function bumpCombo() {
  game.combo++;
  game.comboT = 2.6;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  if (COMBO_BARKS[game.combo]) say(kit, COMBO_BARKS[game.combo], 1.4);
}

function damage(e, dmg, dir, launch, chain) {
  if (hasMod('glass')) dmg *= 2;
  if (e.kind === 'boss') {
    if (game.phase !== 'boss') return;
    if (e.phase === 'stuck') dmg *= 2;
    e.hp -= dmg;
    e.flash = 0.1;
    bumpCombo();
    sparks(e.x, e.y, e.z + e.spr.h / 2);
    if (!e.enraged && e.hp <= e.maxHp / 2) { e.enraged = true; say(e, 'GRRR!', 1.2); addText(e.x, e.y - e.spr.h - 6, 'ENRAGED!', '#ff6b6b'); }
    if (e.hp <= 0) bossDefeated(e, dir);
    else {
      if (e.phase !== 'charge' && e.phase !== 'slide') setVel(e, dir.x * 1.4, dir.y * 1.4);
      if (Math.random() < 0.12) say(e, pick(e.def.taunts), 1.2);
    }
    return;
  }
  e.hp -= dmg;
  e.flash = 0.12;
  bumpCombo();
  sparks(e.x, e.y, e.z + e.spr.h / 2);
  if (e.hp <= 0) { kill(e, dir, launch ? 1.4 : 1, chain); return; }
  e.state = 'stun';
  e.t = launch ? 0.6 : 0.3;
  setVel(e, dir.x * (launch ? 4.5 : 2.6), dir.y * (launch ? 4.5 : 2.6));
  if (launch) e.vz = 110;
}

function kill(e, dir, power, chain) {
  const pts = 10 * (1 + Math.floor(game.combo / 10)) * (chain + 1);
  game.score += pts;
  game.stats.kills++;
  if (chain) {
    game.stats.chains++;
    addText(e.x, e.y - 16, `CHAIN x${chain + 1}  +${pts}`, '#9fd6ef', 1.1);
    sfx.chain(chain);
  } else addText(e.x, e.y - 16, `+${pts}`, '#ffe08a');
  if (e.def.waker && Math.hypot(e.x - DOOR.x, e.y - DOOR.y) < 40) { addText(e.x, e.y - 24, 'SAVED!', '#b5e08a'); game.stats.saved++; }
  if (Math.random() < 0.08) dropPickup(e.x, e.y);
  e.bubble = null;
  toDebris(e, dir, power, chain);
}

function toDebris(e, dir, power, chain = 0) {
  const bouncy = hasMod('bouncy');
  e.kind = 'debris';
  e.life = 1.4;
  e.spin = (dir.x >= 0 ? 1 : -1) * rand(10, 16);
  e.angle = 0;
  e.chain = chain;
  e.hits = new Set();
  e.flip = e.x > kit.x ? 1 : 0;
  e.vz = (100 + power * 40) * (bouncy ? 1.3 : 1);
  e.z = Math.max(e.z, 2);
  e.alpha = 1;
  setMask(e, MASK.debris);
  e.body.collisionFilter.category = CAT.DEBRIS;
  e.body.frictionAir = 0.02;
  e.body.restitution = bouncy ? 0.85 : 0.6;
  const p = 5 * power * (bouncy ? 1.4 : 1);
  setVel(e, dir.x * p, dir.y * p);
}

function juggle(e, dir) {
  setVel(e, dir.x * 5, dir.y * 5);
  e.vz = 130;
  e.life = Math.max(e.life, 1.2);
  e.hits.clear();
  e.spin *= -1.2;
  game.score += 5;
  addText(e.x, e.y - e.z - 10, 'JUGGLE', '#ffffff', 0.6);
}

function hitCrate(p, dir) {
  p.hp--;
  p.flash = 0.1;
  Body.setVelocity(p.body, { x: dir.x * 2 * S, y: dir.y * 2 * S });
  sfx.crate();
  if (p.hp > 0) return;
  Composite.remove(pworld, p.body);
  props = props.filter(o => o !== p);
  burst(p.x, p.y, 4, 14, ['#9a6a3a', '#b07c45', '#5e3c1f', '#e6c15e'], 70, 110);
  const r = grand();
  dropPickup(p.x, p.y, r < 0.5 ? 'fish' : r < 0.75 ? 'yarn' : 'catnip');
}

function dropPickup(x, y, type) {
  type = type || pick(['fish', 'fish', 'yarn', 'catnip']);
  ents.push({ kind: 'pickup', type, spr: SPR[type], x, y, z: 6, vz: 80, t: 14, r: 4 });
}

function deflect(p) {
  const b = game.boss;
  p.deflected = true;
  sfx.deflect();
  addText(p.x, p.y - p.z - 8, 'DENIED!', '#9fd6ef', 0.7);
  if (b && isAlive(b)) launchProj(p, p.x, p.y, p.z, b.x, b.y, 0.45, 10);
  else p.dead = true;
}

function processContacts() {
  const list = contacts;
  contacts = [];
  for (const [a, b] of list) {
    const ea = a.ent, eb = b.ent;
    if (!ea || !eb) {
      const e = ea || eb;
      if (e && e.kind === 'boss' && e.phase === 'charge' && e.type === 'vacuum' && e.t < 0) { e.bounces++; game.shake = 3; sfx.heavy(); }
      continue;
    }
    pairHit(ea, eb);
    pairHit(eb, ea);
  }
}

function pairHit(src, e) {
  if (e.dead || src.dead) return;
  if (e.kind === 'boss' && e.type === 'vacuum' && e.phase === 'suck' && ['debris', 'minion', 'bale'].includes(src.kind)) {
    if (src.kind === 'bale') {
      Body.setVelocity(src.body, { x: -src.body.velocity.x, y: -src.body.velocity.y });
      damage(e, 4, { x: 0, y: 0 }, false, 0);
    } else {
      removeEnt(src);
      damage(e, 2, { x: 0, y: 0 }, false, 0);
    }
    if (e.dead || e.kind !== 'boss') return;
    say(e, '*cough* *cough*', 1.2);
    addText(e.x, e.y - e.spr.h - 6, 'IT CHOKED!', '#ffe08a');
    sfx.cough();
    e.phase = 'stuck';
    e.t = 1.2;
    return;
  }
  if (src.kind === 'debris' && isAlive(e) && speedOf(src) > 2.2 && !src.hits.has(e) && src.hits.size < 3) {
    src.hits.add(e);
    const d = norm(src.body.velocity.x, src.body.velocity.y);
    if (e.kind === 'boss') { addText(e.x, e.y - e.spr.h - 4, 'BONK!', '#9fd6ef'); damage(e, 2, d, false, 0); }
    else damage(e, 1, d, true, src.chain + 1);
    game.hitStop = Math.max(game.hitStop, 0.04);
    return;
  }
  if (src.kind === 'bale' && isAlive(e) && speedOf(src) > 1.6) {
    damage(e, e.kind === 'boss' ? 3 : 2, norm(src.body.velocity.x, src.body.velocity.y), true, 1);
    return;
  }
  if ((src.kind === 'debris' || src.kind === 'bale') && e.kind === 'crate' && speedOf(src) > 2) {
    hitCrate(e, norm(src.body.velocity.x, src.body.velocity.y));
  }
}

// ---------------------------------------------------------------------------
// Minion AI: hop in, then chase the kitten (or head for the door), wind up,
// lunge. Everyone steers around trees, rocks and buildings.
// ---------------------------------------------------------------------------
function steer(e, tx, ty) {
  const d = norm(tx - e.x, ty - e.y);
  let ax = 0, ay = 0;
  for (const o of obstacles) {
    const dx = e.x - o.x, dy = e.y - o.y;
    const range = o.r + e.r + 12;
    if (Math.abs(dx) > range || Math.abs(dy) > range) continue;
    const dd = Math.hypot(dx, dy);
    if (dd > range || dd < 0.01 || dx * d.x + dy * d.y > 0) continue;
    const w = (1 - dd / range) * 1.8;
    const tx1 = -dy / dd, ty1 = dx / dd;
    const sgn = tx1 * d.x + ty1 * d.y >= 0 ? 1 : -1;
    ax += (dx / dd * 0.5 + tx1 * sgn) * w;
    ay += (dy / dd * 0.5 + ty1 * sgn) * w;
  }
  return norm(d.x + ax, d.y + ay);
}

// Wakers walk around the cottage to reach the door at the front.
function wakerTarget(e) {
  if (e.y < DOOR.y - 2 && Math.abs(e.x - DOOR.x) < 40) return { x: DOOR.x + (e.x < DOOR.x ? -38 : 38), y: DOOR.y + 6 };
  return DOOR;
}

function updateMinion(e, dt) {
  e.t -= dt;
  e.cd -= dt;
  e.flash = Math.max(0, e.flash - dt);
  if (e.bubble && (e.bubble.t -= dt) <= 0) e.bubble = null;
  e.barkT -= dt;
  if (e.barkT <= 0) { e.barkT = rand(5, 10); if (Math.random() < 0.3 && inView(e.x, e.y)) say(e, pick(e.def.barks)); }

  if (e.def.fly) e.z = (e.state === 'lunge' ? kit.z + 5 : 14 + kit.z * 0.5) + Math.sin(t * 5 + e.seed) * 2;
  else if (e.z > 0 || e.vz) {
    e.vz -= Z_GRAVITY * dt;
    e.z += e.vz * dt;
    if (e.z <= 0) { e.z = 0; e.vz = 0; }
  }
  if (e.state === 'enter') { if (e.z === 0 || e.def.fly) e.state = 'walk'; return; }
  if (e.state === 'stun') { if (e.t <= 0 && (e.z === 0 || e.def.fly)) e.state = 'walk'; return; }
  if (e.z > 0 && !e.def.fly && !e.def.hop) return;

  const target = e.def.waker ? wakerTarget(e) : kit;
  const far = Math.hypot(target.x - e.x, target.y - e.y);
  const doorFar = Math.hypot(DOOR.x - e.x, DOOR.y - e.y);

  if (e.state === 'walk') {
    let sp = e.speed;
    if (e.def.hop && e.z === 0) {
      e.hopT -= dt;
      sp = 0;
      if (e.hopT <= 0) { e.vz = 90; e.hopT = rand(0.15, 0.35); }
    }
    const d = steer(e, target.x, target.y);
    const wob = Math.sin(t * 3 + e.seed) * 0.2;
    setVel(e, (d.x - d.y * wob) * sp, (d.y + d.x * wob) * sp * 0.85);
    // Kittens up on a rock or bale are out of reach of ground minions.
    const reachable = e.def.fly || kit.z < 9;
    if (e.def.waker && doorFar < 9) {
      e.state = 'ring'; e.t = 1.4; setVel(e, 0, 0);
      say(e, e.type === 'alarm' ? 'BRRRRRING!!' : 'DING DING DING!', 1.4);
      sfx.ring();
    } else if (!e.def.waker && reachable && far < 15 + e.r && e.cd <= 0) {
      e.state = 'windup'; e.t = 0.42; setVel(e, 0, 0);
    }
  } else if (e.state === 'windup') {
    setVel(e, 0, 0);
    if (e.t <= 0) { const d = norm(kit.x - e.x, kit.y - e.y); e.state = 'lunge'; e.t = 0.18; e.lx = d.x; e.ly = d.y; e.hit = false; }
  } else if (e.state === 'lunge') {
    setVel(e, e.lx * 3, e.ly * 3);
    if (!e.hit && dist(e, kit) < e.r + kit.r + 3 && Math.abs(kit.z - e.z) < 10) { hurtKitten(e); e.hit = true; }
    if (e.t <= 0) { e.state = 'walk'; e.cd = rand(1, 1.6); }
  } else if (e.state === 'ring') {
    setVel(e, 0, 0);
    if (e.t <= 0) {
      game.nap--;
      sfx.napLost();
      game.shake = 4;
      addText(DOOR.x, DOOR.y - 44, game.nap > 0 ? 'The Human stirs...' : 'THE HUMAN WOKE UP!', '#ff8a7a', 1.6, 6.5);
      burst(e.x, e.y, 6, 10, ['#ffffff', '#c9c2b6'], 40, 60);
      removeEnt(e);
      if (game.nap <= 0) arenaGameOver('woke', e.def.name);
    }
  }
}

// ---------------------------------------------------------------------------
// Boss AI
// ---------------------------------------------------------------------------
function marker(kind, x, y, extra, life) {
  game.markers.push({ kind, x, y, ...extra, t: life, max: life });
}

function launchProj(p, x, y, z, tx, ty, T, arc) {
  Object.assign(p, { x, y, z, sx: x, sy: y, sz: z, tx, ty, T, p: 0, arc });
}

function throwProj(type, from, tx, ty, T, arc) {
  const p = {
    kind: 'proj', type, spr: SPR[type === 'water' ? 'droplet' : 'invite'], deflected: false,
    label: type === 'water' ? 'bathwater' : 'a meeting invite',
  };
  launchProj(p, from.x, from.y, from.z, tx, ty, T, arc);
  ents.push(p);
  marker('circle', tx, ty, { r: type === 'water' ? 8 : 5 }, T);
  return p;
}

function bossTarget(b) { return norm(kit.x - b.x, kit.y - b.y); }

function startBossAttack(b) {
  const list = b.def.attacks;
  const name = b.enraged && grand() < 0.4 ? gpick(list) : list[b.atk++ % list.length];
  const d = bossTarget(b);
  b.phase = name;
  if (Math.random() < 0.35) say(b, pick(b.def.taunts), 1.2);
  if (name === 'invites' || name === 'fountain') {
    b.t = 0.5;
    b.thrown = false;
  } else if (name === 'summon' || name === 'ducks') {
    b.t = 0.6;
    say(b, name === 'ducks' ? 'Rub-a-dub!' : 'RECURRING!', 1.2);
    const n = (b.enraged ? 3 : 2) + (name === 'ducks' ? 1 : 0);
    for (let i = 0; i < n; i++) {
      spawnMinion(name === 'ducks' ? 'duck' : 'email', { x: clamp(b.x + rand(-24, 24), 14, WW - 14), y: clamp(b.y + rand(-14, 14), 20, WD - 14) });
    }
    sfx.quack();
  } else if (name === 'charge' || name === 'slide') {
    b.t = 0.7;
    b.dx = d.x; b.dy = d.y;
    b.bounces = 0;
    marker('line', b.x, b.y, { dx: d.x, dy: d.y, len: 170 }, 0.7);
    sfx.warn();
  } else if (name === 'leap') {
    b.T = b.t = 0.95;
    b.sx = b.x; b.sy = b.y;
    b.tx = clamp(kit.x, 20, WW - 20); b.ty = clamp(kit.y, 24, WD - 16);
    setMask(b, MASK.none);
    marker('circle', b.tx, b.ty, { r: 14, grow: true }, 0.95);
    sfx.jump();
  } else if (name === 'vanish') {
    b.t = 1.1;
    b.vanished = false;
    b.said = false;
  } else if (name === 'suck') {
    b.t = b.enraged ? 3.6 : 3;
    sfx.suck(b.t);
  }
}

function updateBoss(b, dt) {
  b.t -= dt;
  b.flash = Math.max(0, b.flash - dt);
  if (b.bubble && (b.bubble.t -= dt) <= 0) b.bubble = null;
  if (b.phase === 'idle') { setVel(b, 0, 0); return; }
  const d = bossTarget(b);
  const touching = () => dist(b, kit) < b.r + kit.r + 2 && kit.z < 10;

  switch (b.phase) {
    case 'walk': {
      const s = steer(b, kit.x, kit.y);
      setVel(b, s.x * b.speed, s.y * b.speed * 0.85);
      b.cd -= dt;
      if (b.cd <= 0) startBossAttack(b);
      if (b.type === 'bath' && Math.random() < 0.15) {
        particles.push({ x: b.x + rand(-12, 12), y: b.y, z: b.spr.h - 4, vx: 0, vy: 0, vz: 18, life: 1, max: 1, col: '#e8f6ff', g: false });
      }
      return;
    }
    case 'invites':
    case 'fountain': {
      setVel(b, 0, 0);
      if (!b.thrown && b.t <= 0.2) {
        b.thrown = true;
        if (b.phase === 'invites') {
          const n = b.enraged ? 5 : 3;
          for (let i = 0; i < n; i++) {
            throwProj('invite', { x: b.x, y: b.y, z: b.spr.h }, clamp(kit.x + rand(-16, 16), 10, WW - 10), clamp(kit.y + rand(-8, 8), 18, WD - 8), 0.8 + i * 0.12, 24);
          }
          sfx.throw();
        } else {
          const n = b.enraged ? 8 : 5;
          for (let i = 0; i < n; i++) {
            const tx = i === 0 ? kit.x : kit.x + rand(-40, 40), ty = i === 0 ? kit.y : kit.y + rand(-22, 22);
            throwProj('water', { x: b.x, y: b.y, z: b.spr.h }, clamp(tx, 10, WW - 10), clamp(ty, 18, WD - 8), rand(0.8, 1.2), 40);
          }
          sfx.splash();
        }
      }
      if (b.t <= 0) toBossWalk(b);
      return;
    }
    case 'summon':
    case 'ducks': {
      setVel(b, 0, 0);
      if (b.t <= 0) toBossWalk(b);
      return;
    }
    case 'charge':
    case 'slide': {
      if (b.t > 0) { setVel(b, 0, 0); return; }
      if (b.type === 'vacuum') {
        const sp = 3.4;
        b.body.restitution = 1;
        const v = getVel(b);
        const cur = Math.hypot(v.x, v.y);
        if (b.t > -0.05 || cur < 0.5) setVel(b, b.dx * sp, b.dy * sp);
        else setVel(b, v.x / cur * sp, v.y / cur * sp);
        if (b.bounces >= 3 || b.t < -2.2) toBossWalk(b);
      } else {
        const sp = b.phase === 'slide' ? 3 : 3.2;
        setVel(b, b.dx * sp, b.dy * sp);
        if (b.phase === 'slide' && Math.random() < 0.5) {
          particles.push({ x: b.x, y: b.y, z: 2, vx: 0, vy: 0, vz: 10, life: 0.8, max: 0.8, col: '#e8f6ff', g: false });
        }
        if (b.type === 'monday' && b.t < -0.15 && speedOf(b) < 1.2) {
          b.phase = 'stuck'; b.t = 1.4; game.shake = 5; sfx.slam(); say(b, 'Oof.', 1);
        } else if (b.t < -1.2) toBossWalk(b);
      }
      if (touching()) hurtKitten(b);
      return;
    }
    case 'leap': {
      const p = clamp(1 - b.t / b.T, 0, 1);
      Body.setPosition(b.body, { x: lerp(b.sx, b.tx, p) * S, y: lerp(b.sy, b.ty, p) * S });
      setVel(b, 0, 0);
      b.z = Math.sin(Math.PI * p) * 46;
      if (p >= 1) {
        b.z = 0;
        setMask(b, MASK.enemy);
        game.shake = 7;
        sfx.slam();
        game.rings.push({ x: b.x, y: b.y, r: 4, max: 62, speed: 150, friendly: false, hit: new Set(), label: 'a cucumber shockwave', z: 0 });
        for (let i = 0; i < 14; i++) dust(b.x + rand(-12, 12), b.y + rand(-4, 4));
        b.phase = 'stuck';
        b.t = 1.2;
        say(b, '...', 1);
      }
      return;
    }
    case 'vanish': {
      setVel(b, 0, 0);
      if (!b.vanished) {
        b.alpha = clamp(b.t - 0.7, 0, 0.4) / 0.4;
        if (b.t <= 0.7) {
          b.vanished = true;
          Body.setPosition(b.body, { x: clamp(kit.x - kit.facing * 22, 16, WW - 16) * S, y: clamp(kit.y, 24, WD - 14) * S });
        }
      } else {
        b.alpha = clamp((0.7 - b.t) / 0.3, 0, 1);
        if (b.t <= 0.35 && !b.said) { b.said = true; say(b, '...', 0.8); }
        if (b.t <= 0) { b.phase = 'lunge'; b.t = 0.3; b.dx = d.x; b.dy = d.y; b.alpha = 1; }
      }
      return;
    }
    case 'lunge': {
      setVel(b, b.dx * 3.4, b.dy * 3.4);
      if (touching()) hurtKitten(b);
      if (b.t <= 0) toBossWalk(b);
      return;
    }
    case 'suck': {
      setVel(b, 0, 0);
      const f = kit.x > b.x ? 1 : -1;
      const nx = b.x + f * 12, ny = b.y;
      const pullTo = (ox, oy, k) => { const v = norm(nx - ox, ny - oy); return { x: v.x * k, y: v.y * k }; };
      const kd = Math.hypot(kit.x - nx, kit.y - ny);
      if (kd < 140 && kit.dashT <= 0) { const p = pullTo(kit.x, kit.y, 0.6 * (1 - kd / 160)); kit.pullX += p.x; kit.pullY += p.y; }
      if (kd < b.r + 4) hurtKitten(b);
      for (const e of ents) {
        if (e.dead || e === b || !e.body || (e.kind !== 'debris' && e.kind !== 'minion')) continue;
        if (Math.hypot(e.x - nx, e.y - ny) > 160) continue;
        const v = getVel(e), p = pullTo(e.x, e.y, e.kind === 'debris' ? 0.35 : 0.2);
        setVel(e, v.x + p.x, v.y + p.y);
      }
      for (const p of props) {
        if (p.kind !== 'bale' && p.kind !== 'crate') continue;
        const pp = pullTo(p.x, p.y, 0.15);
        Body.setVelocity(p.body, { x: p.body.velocity.x + pp.x * S, y: p.body.velocity.y + pp.y * S });
      }
      if (Math.random() < 0.8) {
        const a = rand(-0.9, 0.9), r = rand(30, 90);
        const sx = nx + f * Math.cos(a) * r, sy = ny + Math.sin(a) * r * 0.5;
        const v = norm(nx - sx, ny - sy);
        particles.push({ x: sx, y: sy, z: rand(2, 14), vx: v.x * 140, vy: v.y * 140, vz: 0, life: r / 140, max: 0.6, col: 'rgba(255,255,255,0.8)', g: false, w: 3 });
      }
      if (b.t <= 0) {
        const dd = bossTarget(b);
        Object.assign(b, { phase: 'charge', t: 0.6, dx: dd.x, dy: dd.y, bounces: 0 });
        marker('line', b.x, b.y, { dx: dd.x, dy: dd.y, len: 170 }, 0.6);
        sfx.warn();
      }
      return;
    }
    case 'stuck': {
      setVel(b, 0, 0);
      b.sink = b.type === 'cucumber' ? 6 : 0;
      if (b.t <= 0) toBossWalk(b);
      return;
    }
  }
}

function toBossWalk(b) {
  b.phase = 'walk';
  b.cd = b.enraged ? grange(1.2, 1.8) : grange(2, 2.8);
  b.alpha = 1;
  b.sink = 0;
  b.body.restitution = 0.2;
  setMask(b, MASK.enemy);
}

// ---------------------------------------------------------------------------
// Projectiles, rings, pickups, debris
// ---------------------------------------------------------------------------
function updateProj(p, dt) {
  p.p += dt / p.T;
  const k = Math.min(1, p.p);
  p.x = lerp(p.sx, p.tx, k);
  p.y = lerp(p.sy, p.ty, k);
  p.z = lerp(p.sz, 0, k) + p.arc * 4 * k * (1 - k);
  if (k < 1) return;
  p.dead = true;
  if (p.deflected) {
    const b = game.boss;
    if (b && isAlive(b) && dist(p, b) < b.r + 10) {
      addText(b.x, b.y - b.spr.h - 6, 'RETURN TO SENDER', '#9fd6ef', 1.1);
      damage(b, 3, norm(b.x - p.sx, b.y - p.sy), false, 0);
    }
    return;
  }
  if (p.type === 'water') {
    scenery.puddles.push({ x: p.x, y: p.y, r: 9, life: 5 });
    burst(p.x, p.y, 2, 8, ['#9fd6ef', '#5aa7d1', '#ffffff'], 50, 70);
    sfx.splash();
  } else burst(p.x, p.y, 2, 5, ['#e9e4dc', '#c9c2b6'], 30, 40);
  if (Math.hypot(kit.x - p.x, (kit.y - p.y) * 1.3) < (p.type === 'water' ? 9 : 7) && kit.z < 8) {
    hurtKitten(p);
    if (p.type === 'water') kit.wet = 1.5;
  }
}

function updateRing(r, dt) {
  r.r += r.speed * dt;
  for (const e of r.friendly ? ents : [kit]) {
    if (e.dead || r.hit.has(e)) continue;
    if (r.friendly && !isAlive(e) && e.kind !== 'debris') continue;
    const dd = Math.hypot(e.x - r.x, (e.y - r.y) * 1.6);
    if (Math.abs(dd - r.r) > 6 || e.z > (r.z || 0) + 4) continue;
    r.hit.add(e);
    if (!r.friendly) { if (hurtKitten(r)) say(kit, 'Should have jumped', 1.2); continue; }
    const d = norm(e.x - r.x, e.y - r.y);
    if (e.kind === 'debris') juggle(e, d);
    else if (e.kind === 'boss') damage(e, 2, d, false, 0);
    else damage(e, 1, d, true, 0);
  }
  if (!r.friendly) {
    for (const p of props) {
      if (p.kind !== 'bale' && p.kind !== 'crate') continue;
      if (Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r) < 5) {
        const d = norm(p.x - r.x, p.y - r.y);
        Body.setVelocity(p.body, { x: d.x * 3 * S, y: d.y * 3 * S });
      }
    }
  }
  if (r.r >= r.max) r.dead = true;
}

function updateDebris(e, dt) {
  e.flash = Math.max(0, (e.flash || 0) - dt);
  e.vz -= Z_GRAVITY * dt;
  e.z += e.vz * dt;
  e.angle += e.spin * dt;
  if (e.z <= 0) {
    if (inPond(e.x, e.y)) {
      burst(e.x, e.y, 2, 12, ['#9fd6ef', '#ffffff', '#5aa7d1'], 50, 110);
      scenery.ripples.push({ x: e.x, y: e.y, t: 0 });
      sfx.splash();
      addText(e.x, e.y - 10, 'SPLOOSH', '#9fd6ef', 0.7);
      removeEnt(e);
      return;
    }
    e.z = 0;
    if (e.vz < -70) { e.vz = -e.vz * 0.45; dust(e.x, e.y); cutFlowers(e.x, e.y, 6, 4, spawnPetals); }
    else { e.vz = 0; e.spin *= 0.9; }
  }
  if (speedOf(e) > 1.5) cutFlowers(e.x, e.y, 4, 3, spawnPetals);
  if (e.z === 0 && speedOf(e) < 0.8) e.life -= dt;
  if (e.life <= 0) {
    burst(e.x, e.y, 3, 8, ['#ffffff', '#e9e4dc', '#c9c2b6'], 40, 50);
    removeEnt(e);
  }
}

function updatePickup(p, dt) {
  p.t -= dt;
  if (p.z > 0 || p.vz > 0) { p.vz -= Z_GRAVITY * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0) p.vz = 0; }
  if (p.t <= 0) { p.dead = true; return; }
  if (Math.hypot(kit.x - p.x, kit.y - p.y) < 9 && kit.z < 12) {
    p.dead = true;
    sfx.pickup();
    burst(p.x, p.y, 6, 10, ['#ffe08a', '#ffffff'], 40, 60);
    if (p.type === 'fish') { kit.hp = Math.min(kit.maxHp, kit.hp + 1); addFish(1); say(kit, 'Nom nom', 1); }
    else if (p.type === 'yarn') { kit.yarn = 8; say(kit, 'Yarn power!', 1.2); }
    else { kit.catnip = 7; say(kit, 'Wheeeee!', 1.2); }
  }
}

// ---------------------------------------------------------------------------
// Generic flow used by the modes: waves, bosses, game over
// ---------------------------------------------------------------------------
function arenaReset(spawn = { x: DOOR.x - 30, y: DOOR.y + 24 }) {
  clearEnts();
  buildArena();
  placeKitten(spawn.x, spawn.y);
  kit.facing = 1;
  cam.x = clamp(kit.x - W / 2, 0, WW - W);
  cam.y = clamp(kit.y - H * 0.58, -60, WD + 12 - H);
}

function beginWave({ count, pool, title, sub }) {
  const g = game;
  g.phase = 'wave';
  g.toSpawn = Math.round(count * (hasMod('swarm') ? 1.5 : 1));
  g.pool = hasMod('alarming') ? [...pool, 'alarm', 'alarm', 'bell'] : pool;
  g.spawnT = 1;
  g.waveGap = 0;
  if (title) g.banner = { title, sub, t: 2.2 };
}

function updateSpawning(dt) {
  const g = game;
  const alive = ents.filter(e => e.kind === 'minion' && !e.dead).length;
  if (g.phase === 'wave') {
    g.spawnT -= dt;
    if (g.toSpawn > 0 && g.spawnT <= 0 && alive < 7 + g.lap + Math.floor(g.level / 4)) {
      g.toSpawn--;
      g.spawnT = grange(0.4, 0.8);
      spawnMinion(gpick(g.pool));
    }
    if (g.toSpawn <= 0 && alive === 0) {
      g.waveGap += dt;
      if (g.waveGap > 1.4) { g.phase = 'idle'; MODE.onWaveCleared(); }
    }
  } else if (g.phase === 'boss' && g.napOn) {
    // A waker sneaks in now and then, so the Human still needs guarding.
    g.wakerT -= dt;
    if (g.wakerT <= 0 && alive < 4) { g.wakerT = grange(7, 11); spawnMinion(gpick(['alarm', 'bell'])); }
  }
}

// Boss entrance cinematic, then the fight. The cucumber is simply... behind you.
function beginBoss(type, { short = false } = {}) {
  const g = game;
  g.phase = 'bossIntro';
  setMusic('boss');
  sfx.boss();
  const at = type === 'cucumber'
    ? { x: clamp(kit.x - kit.facing * 18, 20, WW - 20), y: clamp(kit.y - 2, 24, WD - 14) }
    : { x: clamp(kit.x + (kit.x < WW / 2 ? 1 : -1) * 120, 40, WW - 40), y: clamp(kit.y, 40, WD - 30) };
  const b = spawnBoss(type, at);
  if (type !== 'cucumber') b.z = 60;
  arenaState = 'bossIntro';
  kit.control = false;
  kit.z = kit.floor;
  setVel(kit, 0, 0);
  g.cine = { bars: 0, barsTo: 1, focus: type === 'cucumber' ? kit : b, title: null };
  const k = short ? 0.6 : 1;
  if (type === 'cucumber') {
    after(0.9 * k, () => { kit.facing = Math.sign(b.x - kit.x) || 1; kit.scaredT = 1.2; kit.vz = 140; say(kit, '!!!', 1); sfx.warn(); });
    after(1.8 * k, () => say(b, '...', 1.4));
  } else {
    after(0.6 * k, () => say(b, b.def.intro, 1.6));
  }
  after(1.9 * k, () => { g.cine.title = { name: b.name, sub: b.def.title, t: 0 }; });
  after(4 * k, () => {
    Object.assign(g.cine, { barsTo: 0, title: null, focus: null });
    g.phase = 'boss';
    g.wakerT = 8;
    arenaState = 'play';
    kit.control = true;
    toBossWalk(b);
    b.cd = 1;
  });
  return b;
}

function bossDefeated(b, dir) {
  const g = game;
  g.phase = 'bossDown';
  g.stats.bosses++;
  g.score += 500 * (g.level || 1);
  g.hitStop = 0.25;
  g.slowT = 1.2;
  g.shake = 9;
  g.flash = 0.3;
  say(b, b.def.death, 2);
  b.sink = 0;
  sfx.win();
  setMask(b, MASK.debris);
  toDebris(b, dir.x || dir.y ? dir : { x: 1, y: 0 }, 1.8);
  b.life = 3;
  b.vz = 260;
  for (const e of ents) {
    if (e.kind === 'minion') toDebris(e, norm(e.x - kit.x, e.y - kit.y), 1.2);
    if (e.kind === 'proj') e.dead = true;
  }
  g.markers = [];
  burst(b.x, b.y, 20, 50, ['#ffe08a', '#ffffff', '#f4a3b8', '#9fd6ef'], 140, 180);
  g.nap = Math.min(g.napMax, g.nap + 1);
  kit.hp = Math.min(kit.maxHp, kit.hp + 1);
  for (let i = 0; i < 3; i++) dropPickup(b.x + rand(-14, 14), b.y + rand(-8, 8), 'fish');
  g.banner = { title: 'VICTORY!', sub: `${b.name} falls`, t: 2.4 };
  after(2.6, () => MODE.onBossDefeated(b));
}

function arenaGameOver(reason, killer) {
  const g = game;
  if (arenaState === 'over') return;
  g.reason = reason;
  g.killer = killer;
  g.overT = 0;
  arenaState = 'over';
  kit.control = false;
  setVel(kit, 0, 0);
  sfx.lose();
  after(1.3, () => MODE.onGameOver(reason, killer));
}

// Cold open for Story: an alarm creeps to the door, a tiny knight leaps in.
function playIntro(onDone) {
  const g = game;
  arenaState = 'intro';
  setMusic('title');
  kit.control = false;
  placeKitten(DOOR.x - 120, DOOR.y + 40);
  g.cine = { bars: 0, barsTo: 1, focus: { x: DOOR.x, y: DOOR.y + 30 }, title: null };
  const alarm = spawnMinion('alarm', { x: DOOR.x + 90, y: DOOR.y + 36 });
  alarm.scripted = true;
  alarm.bubble = null;
  g.introAlarm = alarm;
  g.introDone = onDone;
  after(0.8, () => say(alarm, 'BRRRI-', 1.4));
  after(1.7, () => {
    g.introLeap = { t: 0, T: 0.55, sx: kit.x, sy: kit.y, tx: alarm.x - 14, ty: alarm.y };
    kit.facing = 1;
    sfx.jump();
  });
  after(2.25, () => {
    kit.atkT = 0.16;
    kit.combo = 3;
    sfx.heavy();
    g.hitStop = 0.12;
    g.shake = 6;
    sparks(alarm.x, alarm.y, 8);
    alarm.scripted = false;
    alarm.bubble = null;
    toDebris(alarm, { x: 1, y: -0.2 }, 1.6);
    g.introAlarm = null;
  });
  after(2.9, () => { g.cine.title = { name: 'KNIGHT KITTEN', sub: 'Protect the nap', t: 0, big: true }; sfx.win(); });
  after(5.6, endIntro);
}

function endIntro() {
  const g = game;
  if (arenaState !== 'intro') return;
  g.timers = [];
  if (g.introAlarm) { removeEnt(g.introAlarm); g.introAlarm = null; }
  g.introLeap = null;
  kit.z = 0;
  kit.vz = 0;
  g.cine = { bars: 0, barsTo: 0, focus: null, title: null };
  arenaState = 'play';
  kit.control = true;
  g.introDone();
}

function updateIntro(dt) {
  const g = game;
  const a = g.introAlarm;
  if (a && a.scripted && !a.dead) {
    a.z = Math.max(0, a.z - 40 * dt);
    const d = norm(DOOR.x - a.x, DOOR.y - a.y);
    setVel(a, d.x * 0.35, d.y * 0.35);
  }
  if (g.introLeap) {
    const L = g.introLeap;
    L.t += dt;
    const p = Math.min(1, L.t / L.T);
    Body.setPosition(kit.body, { x: lerp(L.sx, L.tx, p) * S, y: lerp(L.sy, L.ty, p) * S });
    kit.z = Math.sin(Math.PI * p) * 34;
    if (p >= 1) { g.introLeap = null; kit.z = 0; dust(kit.x, kit.y); }
  }
  if (input.pressed.attack || input.pressed.jump || input.pressed.pause) endIntro();
}

// Story ending: dawn comes back, the kitten curls up by the door.
function playEnding(onReady) {
  const g = game;
  arenaState = 'ending';
  setMusic('ending');
  kit.control = false;
  clearEnts();
  setTod(0);
  g.banner = null;
  g.cine = { bars: 0, barsTo: 1, focus: { x: DOOR.x, y: DOOR.y + 24 }, title: null };
  g.ending = { t: 0, onReady, fired: false };
}

function updateEnding(dt) {
  const g = game, E = g.ending;
  E.t += dt;
  const target = { x: DOOR.x + 10, y: DOOR.y + 8 };
  if (Math.hypot(target.x - kit.x, target.y - kit.y) > 2 && !kit.sleeping) {
    const v = norm(target.x - kit.x, target.y - kit.y);
    setVel(kit, v.x * 0.7, v.y * 0.7);
    kit.walkT += dt;
    kit.facing = v.x >= 0 ? 1 : -1;
  } else {
    setVel(kit, 0, 0);
    kit.walkT = 0;
    if (!kit.sleeping) { kit.sleeping = true; kit.facing = -1; say(kit, '*yawn*', 1.5); }
  }
  if (E.t > 4.5 && !E.fired) { E.fired = true; E.onReady(); }
}

// ---------------------------------------------------------------------------
// Main arena step
// ---------------------------------------------------------------------------
function arenaTick(dt) {
  // Remember where things were, so drawing can blend towards where they are.
  kit.px = kit.x; kit.py = kit.y; kit.pz = kit.z; cam.px = cam.x; cam.py = cam.y;
  t += dt;
  const g = game;

  if (arenaState === 'attract') { updateAttract(dt); return; }
  if (input.pressed.pause && (arenaState === 'play' || arenaState === 'transition')) { pauseGame(); return; }

  for (const tm of g.timers) tm.t -= dt;
  const due = g.timers.filter(tm => tm.t <= 0);
  g.timers = g.timers.filter(tm => tm.t > 0);
  for (const tm of due) tm.fn();

  g.cine.bars += (g.cine.barsTo - g.cine.bars) * Math.min(1, dt * 6);
  if (g.cine.title) g.cine.title.t += dt;
  if (g.banner && (g.banner.t -= dt) <= 0) g.banner = null;
  if (g.zoneBanner && (g.zoneBanner.t -= dt) <= 0) g.zoneBanner = null;
  g.shake = Math.max(0, g.shake - dt * 18);
  g.flash = Math.max(0, g.flash - dt);

  if (arenaState === 'over') g.overT += dt;
  if (arenaState === 'intro') updateIntro(dt);
  if (arenaState === 'ending') updateEnding(dt);

  if (g.hitStop > 0) { g.hitStop -= dt; updateCamera(dt); return; }

  g.slowT = Math.max(0, g.slowT - dt);
  const scale = g.slowT > 0 ? 0.35 : 1;
  const sdt = dt * scale;
  const frozen = arenaState === 'bossIntro';

  if (arenaState === 'play') g.elapsed += sdt;
  if (arenaState !== 'over' && (!frozen || kit.z > kit.floor)) updateKitten(sdt);
  if (arenaState === 'play') {
    updateSpawning(sdt);
    if (MODE.update) MODE.update(sdt);
    g.comboT -= sdt;
    if (g.comboT <= 0) g.combo = 0;
    g.hintT = Math.max(0, g.hintT - sdt);
  }

  for (const e of ents) {
    if (e.dead) continue;
    if (e.kind === 'minion') {
      if (arenaState === 'play' || (arenaState === 'intro' && !e.scripted)) updateMinion(e, sdt);
      else if (frozen || arenaState === 'over') setVel(e, 0, 0);
    } else if (e.kind === 'boss') {
      if (arenaState === 'play') updateBoss(e, sdt);
      else {
        setVel(e, 0, 0);
        if (frozen && e.z > 0) {
          e.z = Math.max(0, e.z - 120 * sdt);
          if (e.z === 0) { g.shake = 5; sfx.slam(); for (let i = 0; i < 10; i++) dust(e.x, e.y); }
        }
        if (e.bubble && (e.bubble.t -= sdt) <= 0) e.bubble = null;
      }
    } else if (e.kind === 'debris') updateDebris(e, sdt);
    else if (e.kind === 'proj') { if (!frozen && arenaState !== 'over') updateProj(e, sdt); }
    else if (e.kind === 'pickup') updatePickup(e, sdt);
  }
  for (const r of g.rings) if (!r.dead) updateRing(r, sdt);
  g.rings = g.rings.filter(r => !r.dead);
  for (const m of g.markers) m.t -= sdt;
  g.markers = g.markers.filter(m => m.t > 0);

  if (!frozen) {
    Engine.update(engine, 1000 / 60 * scale);
    if (['play', 'intro', 'transition'].includes(arenaState)) processContacts();
    else contacts = [];
  } else contacts = [];

  kit.x = kit.body.position.x / S;
  kit.y = kit.body.position.y / S;
  for (const e of ents) if (e.body && !e.dead) { e.x = e.body.position.x / S; e.y = e.body.position.y / S; }
  for (const p of props) {
    if (p.body.isStatic) continue;
    const nx = p.body.position.x / S, ny = p.body.position.y / S;
    if (p.kind === 'bale') { p.roll += Math.hypot(nx - p.x, ny - p.y); p.spr = SPR.bale[Math.floor(p.roll / 3) % 3]; }
    p.x = nx;
    p.y = ny;
    p.flash = Math.max(0, (p.flash || 0) - dt);
  }
  ents = ents.filter(e => !e.dead);

  updateParticles(sdt);
  updateScenery(sdt, [kit, ...ents.filter(e => e.z < 6)], cam, W, H);
  updateCamera(dt);
}

function updateParticles(sdt) {
  for (const p of particles) {
    if (p.g) p.vz -= 300 * sdt;
    p.x += p.vx * sdt; p.y += p.vy * sdt; p.z += p.vz * sdt;
    if (p.g && p.z < 0) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; }
    p.life -= sdt;
  }
  particles = particles.filter(p => p.life > 0);
  if (particles.length > 500) particles.splice(0, particles.length - 500);
  for (const tx of texts) { tx.y -= 12 * sdt; tx.life -= sdt; }
  texts = texts.filter(tx => tx.life > 0);
}

// Title screen backdrop: a slow tour of the meadow.
function updateAttract(dt) {
  if (!game) newArenaGame('story');
  updateScenery(dt, [kit], cam, W, H);
  kit.blinkT -= dt;
  if (kit.blinkT < -0.12) kit.blinkT = rand(2, 4);
  const tx = clamp(WW / 2 - W / 2 + Math.sin(t * 0.05) * (WW - W) / 2, 0, Math.max(0, WW - W));
  const ty = clamp(150 + Math.sin(t * 0.07) * 120 - H / 2, -50, WD + 12 - H);
  cam.x = lerp(cam.x, tx, 0.02);
  cam.y = lerp(cam.y, ty, 0.02);
}

function updateCamera(dt) {
  const f = game && game.cine.focus ? game.cine.focus : { x: kit.x + input.mx * 24 * (kit.control ? 1 : 0), y: kit.y + input.my * 16 * (kit.control ? 1 : 0) };
  const tx = WW <= W ? (WW - W) / 2 : clamp(f.x - W / 2, 0, WW - W);
  const ty = clamp(f.y - H * 0.58, -60, WD + 12 - H);
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 5));
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 5));
}

// ---------------------------------------------------------------------------
// Drawing: world on the pixel canvas
// ---------------------------------------------------------------------------
function drawShadow(x, y, w, a = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  const hw = Math.max(2, Math.round(w / 2));
  ctx.fillRect(Math.round(x) - hw, Math.round(y), hw * 2, 1);
  ctx.fillRect(Math.round(x) - hw + 1, Math.round(y) - 1, hw * 2 - 2, 1);
  ctx.fillRect(Math.round(x) - hw + 1, Math.round(y) + 1, hw * 2 - 2, 1);
}

function kittenFrame(k) {
  const K = SPR.kitten;
  if (k.sleeping) return K.sleep;
  if (k.scaredT > 0) return K.scared;
  if (k.hurtT > 0) return K.hurt;
  if (k.airborne) return K.jump;
  if (k.walkT > 0) return [K.stepA, K.idle, K.stepB, K.idle][Math.floor(k.walkT * 8) % 4];
  return k.blinkT < 0 ? K.blink : K.idle;
}

// Shared by the arena and Journey: draws the knight with sword and effects.
// Drawn at its exact position (to the nearest screen pixel), with the sprite
// and sword laid out on whole game pixels so they stay lined up.
function drawKnight(k, sx, sy) {
  const ix = Math.round(sx), iy = Math.round(sy);
  const fx = scene === 'city' ? 0 : rpx(sx - ix), fy = scene === 'city' ? 0 : rpx(sy - iy);
  if (fx || fy) { ctx.save(); ctx.translate(fx, fy); drawKnightAt(k, ix, iy); ctx.restore(); }
  else drawKnightAt(k, ix, iy);
}

function drawKnightAt(k, sx, sy) {
  const fr = kittenFrame(k);
  const f = k.facing;
  const fl = f > 0 ? 0 : 1;
  const ox = Math.round(sx) - (f > 0 ? 10 : 13);
  const bob = k.walkT > 0 && Math.floor(k.walkT * 8) % 2 === 0 ? 1 : 0;
  const oy = Math.round(sy) - 31;
  if (k.catnip > 0) { ctx.globalAlpha = 0.35; ctx.drawImage(fr.white[fl], ox - Math.round(f * 3), oy); ctx.globalAlpha = 1; }
  if (k.dashT > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(fr.img[fl], ox - Math.round((k.dashX || f) * 8), oy - Math.round((k.dashY || 0) * 4)); ctx.globalAlpha = 1; }
  ctx.drawImage(fr.img[fl], 0, 0, 24, 25, ox, oy + bob, 24, 25);
  ctx.drawImage(fr.img[fl], 0, 25, 24, 7, ox, oy + 25, 24, 7);
  if (!k.sleeping) drawSword(k, ox, oy + bob, f);
}

function drawKitten() {
  if (kit.inv > 0 && kit.hurtT <= 0 && Math.floor(kit.inv * 14) % 2 === 0) return;
  kit.airborne = kit.z > kit.floor + 1;
  drawKnight(kit, kit.rx === undefined ? kit.x : kit.rx, (kit.ry === undefined ? kit.y : kit.ry) - (kit.rz === undefined ? kit.z : kit.rz));
}

function drawSword(k, ox, oy, f) {
  const mx = lx => (f > 0 ? ox + lx : ox + 23 - lx);
  const spin = k.yarn > 0;
  const p = k.atkT > 0 ? 1 - k.atkT / 0.16 : -1;
  const A0 = -Math.PI / 2 - 0.7, A1 = 0.45;
  let ang = k.airborne ? (k.plunge ? Math.PI / 2 : -0.6) : -Math.PI / 2 + 0.05;
  let hx = 19, hy = 16;
  if (k.dashT > 0 || k.sprint) ang = 0.2;
  if (p >= 0) {
    const e = 1 - (1 - p) * (1 - p);
    ang = spin ? A0 + Math.PI * 2 * e : A0 + (A1 - A0) * e;
    hx = 20; hy = 15;
    ctx.fillStyle = k.combo === 3 ? '#ffe08a' : '#ffffff';
    ctx.globalAlpha = 0.85 * (1 - p * 0.5);
    for (let a = spin ? ang - 2.5 : A0; a <= ang; a += 0.07) {
      for (const r of [12, 15, 18, 21, 23]) {
        ctx.fillRect(mx(Math.round(hx + Math.cos(a) * r)), Math.round(oy + hy + Math.sin(a) * r), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = PALETTE.S;
  for (let i = 0; i <= 4; i++) ctx.fillRect(mx(Math.round(16 + (hx - 16) * i / 4)), Math.round(oy + 14 + (hy - 14) * i / 4), 1, 2);
  const cx = Math.cos(ang) * f, cy = Math.sin(ang);
  const hxs = mx(hx), hys = oy + hy;
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  for (let i = 1; i <= 3; i++) px(hxs - cx * i, hys - cy * i, PALETTE.B);
  px(hxs - cx * 4, hys - cy * 4, PALETTE.g);
  for (let i = -3; i <= 3; i++) px(hxs + cx * 2 - cy * i, hys + cy * 2 + cx * i, i === 0 ? PALETTE.Y : PALETTE.g);
  for (let i = 3; i <= 22; i++) {
    if (i < 21) px(hxs + cx * i + cy, hys + cy * i - cx, PALETTE.S);
    px(hxs + cx * i, hys + cy * i, PALETTE.s);
  }
  ctx.fillStyle = PALETTE.d;
  ctx.fillRect(hxs - 1, hys - 1, 3, 3);
  ctx.fillStyle = PALETTE.s;
  ctx.fillRect(hxs - 1, hys - 1, 2, 2);
}

function drawEnt(e) {
  const spr = e.spr;
  if (e.kind === 'pickup') {
    if (e.t < 3 && Math.floor(e.t * 8) % 2 === 0) return;
    const bob = Math.round(Math.sin(t * 5 + e.x) * 1.5) + 3;
    ctx.drawImage(spr.img[0], Math.round(e.x - spr.w / 2), Math.round(e.y - e.z - spr.h - bob));
    return;
  }
  if (e.kind === 'proj') {
    ctx.drawImage(spr.img[0], Math.round(e.x - spr.w / 2), Math.round(e.y - e.z - spr.h / 2));
    return;
  }
  if (e.kind === 'debris' && e.life < 0.4 && Math.floor(e.life * 14) % 2 === 0) return;
  const flip = e.kind === 'debris' ? e.flip : (kit.x < e.x ? 1 : 0);
  let x = Math.round(e.x - spr.w / 2);
  const y = Math.round(e.y - e.z - spr.h + 1 + (e.sink || 0));
  const winding = e.state === 'windup' || e.state === 'ring' ||
    (e.kind === 'boss' && e.t > 0 && ['charge', 'slide', 'invites', 'fountain'].includes(e.phase));
  if (winding) x += Math.random() < 0.5 ? -1 : 1;
  const img = e.flash > 0 ? spr.white[flip] : spr.img[flip];
  ctx.globalAlpha = e.alpha === undefined ? 1 : e.alpha;
  if (e.kind === 'debris') {
    const ang = Math.round(e.angle / (Math.PI / 8)) * (Math.PI / 8);
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y - e.z - spr.h / 2));
    ctx.rotate(ang);
    ctx.drawImage(img, -Math.round(spr.w / 2), -Math.round(spr.h / 2));
    ctx.restore();
  } else if (e.kind === 'minion' && e.state === 'walk' && !e.def.fly && Math.sin(t * 12 + e.seed) > 0.6) {
    ctx.drawImage(img, x, y + 1, spr.w, spr.h - 1);
  } else {
    ctx.drawImage(img, x, y);
  }
  ctx.globalAlpha = 1;
  if (e.kind === 'boss' && e.phase === 'stuck') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.1;
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(Math.round(e.x + Math.cos(a) * 8), Math.round(y - 4 + Math.sin(a) * 2), 1, 1);
    }
  }
  if (e.kind === 'minion' && e.def.hp > 2) {
    ctx.fillStyle = '#e6c15e';
    for (let i = 0; i < e.hp; i++) ctx.fillRect(Math.round(e.x) - e.hp + i * 2, y - 3, 1, 1);
  }
}

function drawProp(p) {
  const s = p.spr;
  const behind = (p.kind === 'tree' || p.kind === 'barn') && kit.y < p.y && kit.y > p.y - 44 && Math.abs(kit.x - p.x) < 18;
  ctx.globalAlpha = behind ? 0.5 : 1;
  if (p.flash > 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(p.x - s.ox), Math.round(p.y - s.oy), s.w, s.h); }
  else ctx.drawImage(s.img[0], Math.round(p.x - s.ox), Math.round(p.y - s.oy));
  ctx.globalAlpha = 1;
}

function drawMarkers() {
  for (const m of game.markers) {
    ctx.fillStyle = Math.floor(m.t * 10) % 2 === 0 ? 'rgba(255,80,70,0.75)' : 'rgba(255,200,120,0.6)';
    if (m.kind === 'circle') {
      const r = m.grow ? Math.round(m.r * (1 - m.t / m.max) + 4) : m.r;
      for (let a = 0; a < Math.PI * 2; a += 0.35) ctx.fillRect(Math.round(m.x + Math.cos(a) * r), Math.round(m.y + Math.sin(a) * r * 0.5), 2, 1);
      ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y), 3, 1);
    } else {
      for (let i = 10; i < m.len; i += 5) ctx.fillRect(Math.round(m.x + m.dx * i), Math.round(m.y + m.dy * i), 2, 1);
    }
  }
  for (const r of game.rings) {
    ctx.fillStyle = r.friendly ? 'rgba(255,240,180,0.9)' : 'rgba(181,224,138,0.95)';
    for (let a = 0; a < Math.PI * 2; a += 0.12) ctx.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y - (r.z || 0) + Math.sin(a) * r.r * 0.6), 1, 1);
  }
}

function drawCottage() {
  const night = scenery.tod === 3 && scenery.todK > 0.5;
  const c = SPR.cottage[night ? 1 : 0];
  const x = COTTAGE.x - c.ox, y = COTTAGE.y - c.oy;
  ctx.drawImage(c.img[0], x, y);
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i / 4) % 1;
    ctx.fillStyle = `rgba(235,235,235,${0.55 * (1 - k)})`;
    ctx.fillRect(Math.round(x + 35 + Math.sin(k * 6 + i) * 2 + k * 5), Math.round(y + 1 - k * 18), 2, 2);
  }
}

function drawBarn() {
  const b = SPR.barn;
  ctx.drawImage(b.img[0], BARN.x - b.ox, BARN.y - b.oy);
}

function arenaDraw() {
  ctx.fillStyle = '#161a17';
  ctx.fillRect(0, 0, W, H);
  const g = game;
  const sh = g ? g.shake : 0;
  const shx = sh ? Math.round(rand(-sh, sh)) : 0, shy = sh ? Math.round(rand(-sh, sh)) : 0;
  // The camera between the last two steps, snapped to whole screen pixels.
  const blend = (a, b) => (a === undefined || Math.abs(b - a) > 40 ? b : a + (b - a) * RALPHA);
  view = { x: rpx(blend(cam.px, cam.x)) - shx, y: rpx(blend(cam.py, cam.y)) - shy };
  kit.rx = blend(kit.px, kit.x); kit.ry = blend(kit.py, kit.y); kit.rz = blend(kit.pz, kit.z);
  drawBackdrop(ctx, view, W, H, t);
  ctx.save();
  ctx.translate(-view.x, -view.y);

  drawGround(ctx, view, W, H, t);
  if (g) drawMarkers();
  const visible = (x, y, pad = 60) => x > view.x - pad && x < view.x + W + pad && y > view.y - 20 && y < view.y + H + pad;

  drawShadow(kit.rx, kit.ry - kit.floor, Math.max(6, 12 - (kit.rz - kit.floor) / 4));
  for (const e of ents) {
    if (!visible(e.x, e.y)) continue;
    if (e.kind === 'pickup' || e.kind === 'proj') drawShadow(e.x, e.y, 5, 0.2);
    else if (e.spr) drawShadow(e.x, e.y, Math.min(e.spr.w * 0.8, 30) / (e.z / 30 + 1), 0.25);
  }
  for (const p of props) if ((p.kind === 'bale' || p.kind === 'crate') && visible(p.x, p.y)) drawShadow(p.x, p.y, 12, 0.25);

  // Everything stands in depth order by its feet; a kitten on top of
  // something draws after it.
  const kitY = kit.plat && kit.z >= kit.plat.top - 1 ? Math.max(kit.y, kit.plat.y + 0.5) : kit.y + 0.1;
  const list = [{ y: COTTAGE.y, draw: drawCottage }, { y: BARN.y, draw: drawBarn }, { y: kitY, draw: drawKitten }];
  for (const p of props) if (visible(p.x, p.y)) list.push({ y: p.y, draw: () => drawProp(p) });
  for (const e of ents) if (visible(e.x, e.y)) list.push({ y: e.y, draw: () => drawEnt(e) });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) it.draw();

  drawCritters(ctx, view, W, H, t);
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.w || 1, 1);
  }
  ctx.globalAlpha = 1;
  drawFog(ctx);
  ctx.restore();

  drawTint(ctx, W, H);
  const lights = [{ x: kit.x, y: kit.y - kit.z - 10, r: 42, col: '#e8b070', a: 1 }, { x: COTTAGE.x + 10, y: COTTAGE.y - 20, r: 30, col: '#ffcf70', a: 1.4 }];
  if (kit.catnip > 0) lights.push({ x: kit.x, y: kit.y - 12, r: 20, col: '#b5e08a', a: 1 });
  drawLights(ctx, view, lights, t);
  if (g && g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 2})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------------------
// Drawing: sharp UI layer
// ---------------------------------------------------------------------------
function band(y, h, a = 0.55) {
  urect(0, y, W, h, '#100e0d', a);
}

function drawMinimap(x, y, w) {
  const h = Math.round(w * WD / WW);
  const sx = w / WW, sy = h / WD;
  ubox(x - 1, y - 1, w + 2, h + 2, 'rgba(60,92,44,0.85)', 'rgba(233,228,220,0.9)');
  urect(x + (POND.x - POND.rx) * sx, y + (POND.y - POND.ry) * sy, POND.rx * 2 * sx, POND.ry * 2 * sy, '#5aa7d1');
  urect(x, y + 401 * sy, w, 7 * sy, '#a78a5e');
  urect(x + (COTTAGE.x - 12) * sx, y + (COTTAGE.y - 12) * sy, 24 * sx, 12 * sy, '#d8433b');
  urect(x + (BARN.x - 18) * sx, y + (BARN.y - 14) * sy, 36 * sx, 14 * sy, '#8f2a25');
  // Camera frame.
  uctx.strokeStyle = 'rgba(255,255,255,0.7)';
  uctx.lineWidth = 0.4;
  uctx.strokeRect(x + clamp(cam.x, 0, WW) * sx, y + clamp(cam.y, 0, WD) * sy, W * sx, H * sy);
  for (const e of ents) {
    if (!isAlive(e)) continue;
    const col = e.kind === 'boss' ? '#ff8a3a' : e.def.waker ? '#ffd25e' : '#ff5a5a';
    const s = e.kind === 'boss' ? 2.4 : 1.4;
    urect(x + e.x * sx - s / 2, y + e.y * sy - s / 2, s, s, col);
  }
  if (Math.floor(t * 4) % 2 === 0) urect(x + kit.x * sx - 1, y + kit.y * sy - 1, 2, 2, '#ffffff');
}

function drawArenaUI() {
  const g = game;
  if (!g) return;
  const sx = wx => wx - view.x, sy = wy => wy - view.y;

  // In-world words: bubbles and floating numbers.
  if (kit.bubble) ububble(kit.bubble.text, sx(kit.x), sy(kit.y - kit.z - 32), Math.min(1, kit.bubble.t * 4), W);
  for (const e of ents) if (e.bubble && e.spr && !e.dead) ububble(e.bubble.text, sx(e.x), sy(e.y - e.z - e.spr.h), Math.min(1, e.bubble.t * 4), W);
  for (const tx of texts) {
    const half = uwidth(tx.text, tx.size) / 2 + 3;
    ut(tx.text, clamp(sx(tx.x), half, W - half), sy(tx.y), { size: tx.size, color: tx.color, align: 'center', alpha: Math.min(1, tx.life / tx.max * 2) });
  }
  for (const e of ents) {
    if (e.kind === 'minion' && e.state === 'windup') ut('!', sx(e.x), sy(e.y - e.spr.h - 10), { size: 8, color: '#ff5a5a', align: 'center' });
    if (e.kind === 'minion' && e.def.waker && e.state !== 'ring' && inView(e.x, e.y)) ut('z', sx(e.x + e.spr.w / 2 + 2), sy(e.y - e.spr.h - 4), { size: 5, color: '#9fd6ef', align: 'center' });
    if (e.kind === 'boss' && ((e.t > 0 && ['charge', 'slide', 'invites', 'fountain'].includes(e.phase)) || (e.phase === 'leap' && e.t > 0.5))) {
      ut('!', sx(e.x), sy(e.y - e.z - e.spr.h - 12), { size: 10, color: '#ff5a5a', align: 'center' });
    }
  }
  // The Human's Zs over the cottage.
  if (g.napOn) {
    const k = (t * 0.5) % 1;
    ut(g.nap >= 3 ? 'Z' : 'z', sx(COTTAGE.x + 16 + k * 6), sy(COTTAGE.y - 26 - k * 14), { size: 6 + k * 2, color: '#9fd6ef', alpha: 1 - k });
    if (g.nap <= 2 && arenaState === 'play') ut('?!', sx(COTTAGE.x + 12), sy(COTTAGE.y - 34), { size: 7, color: '#ff8a7a' });
  }

  if (arenaState === 'play' || arenaState === 'transition') drawHud();
  drawCine();
}

function drawHud() {
  const g = game;
  for (let i = 0; i < kit.maxHp; i++) uimg(SPR[i < kit.hp ? 'heart' : 'heartEmpty'].img[0], 4 + i * 9, 4, 7, 6);
  let y = 13;
  if (g.napOn) {
    ut('NAP', 4, y, { size: 5.5, color: '#e9e4dc' });
    const danger = g.nap <= 2 && Math.floor(t * 4) % 2 === 0;
    for (let i = 0; i < g.napMax; i++) ut('Z', 20 + i * 5.5, y, { size: 6, color: i < g.nap ? (danger ? '#ff8a7a' : '#9fd6ef') : '#4b4f5a' });
    y += 9;
  }
  let px = 4;
  if (kit.yarn > 0) { uimg(SPR.yarn.img[0], px, y); ubar(px, y + 8, 8, 1, kit.yarn / 8, '#f4a3b8'); px += 11; }
  if (kit.catnip > 0) { uimg(SPR.catnip.img[0], px, y); ubar(px, y + 8, 8, 1, kit.catnip / 7, '#b5e08a'); }

  ut(`${g.score}`, W - 4, 3, { size: 8, align: 'right', font: TITLE_FONT, weight: 400, stroke: 3 });
  const mmW = Math.min(64, Math.round(W * 0.24));
  drawMinimap(W - mmW - 4, 14, mmW);
  const mmBottom = 14 + Math.round(mmW * WD / WW) + 3;
  if (g.combo >= 2) {
    ut(`${g.combo} HITS`, W - 4, mmBottom, { size: 7, color: '#ffd25e', align: 'right' });
    ubar(W - 30, mmBottom + 9, 26, 1, g.comboT / 2.6, '#ffd25e');
  }

  const b = g.boss;
  if (b && !b.dead && g.phase === 'boss' && b.kind === 'boss') {
    ut(b.name, W / 2, 3, { size: 7, color: '#ff8a7a', align: 'center' });
    const bw = Math.min(110, W - 150);
    ubar(W / 2 - bw / 2, 12, bw, 3, b.hp / b.maxHp, b.enraged ? '#ff6b3f' : '#e04b3f', '#5c2320');
  } else if (MODE.hudTitle) {
    ut(MODE.hudTitle(), W / 2, 3, { size: 6, color: '#e9e4dc', align: 'center' });
  }
  if (MODE.hudSub) {
    const s = MODE.hudSub();
    if (s) ut(s, W / 2, 18, { size: 5, color: '#ffd25e', align: 'center' });
  }

  // Off-screen wakers get an arrow at the screen edge.
  for (const e of ents) {
    if (e.kind !== 'minion' || !e.def.waker) continue;
    const ex = e.x - view.x, ey = e.y - view.y - 6;
    if (ex > 0 && ex < W && ey > 0 && ey < H) continue;
    const ax = clamp(ex, 8, W - 8), ay = clamp(ey, 30, H - 10);
    const a = Math.atan2(ey - ay, ex - ax);
    uctx.save();
    uctx.translate(ax, ay);
    uctx.rotate(a);
    uctx.fillStyle = Math.floor(t * 6) % 2 ? '#ff8a7a' : '#ffd25e';
    uctx.strokeStyle = INK;
    uctx.lineWidth = 0.8;
    uctx.beginPath(); uctx.moveTo(4, 0); uctx.lineTo(-3, -3); uctx.lineTo(-3, 3); uctx.closePath();
    uctx.fill(); uctx.stroke();
    uctx.restore();
  }

  if (g.hintT > 0) {
    const a = Math.min(1, g.hintT);
    const hint = input.mode === 'touch' ? 'Stick: move   HIT x3: combo   JUMP twice: double jump   Hold DASH: sprint'
      : input.mode === 'pad' ? 'Stick: move   X: attack   A: jump (x2)   B: dash (hold to sprint)'
        : 'WASD: move   J: attack   K: jump (x2)   L: dash (hold to sprint)';
    band(H - 22, 20, 0.45 * a);
    ut('Stop the alarms reaching the cottage door!', W / 2, H - 20, { size: 5.5, color: '#ffd25e', align: 'center', alpha: a });
    ut(hint, W / 2, H - 12, { size: 5, color: '#ffffff', align: 'center', alpha: a });
  }

  if (g.banner) {
    const a = Math.min(1, g.banner.t * 2);
    const y0 = Math.round(H * 0.26);
    band(y0 - 6, 34, 0.5 * a);
    utitle(g.banner.title, W / 2, y0, 11, '#ffd25e', 'center', a);
    if (g.banner.sub) ut(g.banner.sub, W / 2, y0 + 16, { size: 6, color: '#ffffff', align: 'center', alpha: a });
  }
  if (g.zoneBanner) {
    const a = Math.min(1, g.zoneBanner.t * 1.5, (2 - g.zoneBanner.t) * 3);
    ut(`- ${g.zoneBanner.name} -`, W / 2, H * 0.7, { size: 7, color: '#f6e9c8', align: 'center', alpha: a });
  }
}

function drawCine() {
  const g = game;
  const bh = Math.round(16 * g.cine.bars);
  if (bh > 0) { urect(0, 0, W, bh, '#0d0b0a'); urect(0, H - bh, W, bh, '#0d0b0a'); }
  const ti = g.cine.title;
  if (ti) {
    const drop = Math.max(0, 1 - ti.t * 3);
    const y = Math.round(H * 0.22 - drop * 30);
    band(y - 14, 46);
    if (!ti.big) ut('FINAL BOSS', W / 2, y - 11, { size: 6, color: '#ff5a5a', align: 'center' });
    utitle(ti.name, W / 2, y, ti.big ? 14 : 11, ti.big ? '#ffd25e' : '#ffffff');
    if (ti.t > 0.4) ut(ti.sub, W / 2, y + 18, { size: 7, color: ti.big ? '#ffffff' : '#ffd25e', align: 'center' });
  }
  if (arenaState === 'intro') ut('Attack to skip', W - 4, H - 10, { size: 5, color: '#c9c2b6', align: 'right' });
  if (arenaState === 'ending' && g.ending) {
    const E = g.ending, y = Math.round(H * 0.2);
    if (E.t > 1.5) { band(y - 6, 30); utitle('THE NAP IS SAFE', W / 2, y, 10, '#ffd25e'); }
    if (E.t > 2.6) ut('...until tomorrow.', W / 2, y + 14, { size: 7, color: '#ffffff', align: 'center' });
  }
}
