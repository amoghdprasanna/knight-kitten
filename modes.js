'use strict';

// ---------------------------------------------------------------------------
// Arena game modes. Each mode supplies the rules (what comes next after a
// wave or a boss, what ends the run, what the HUD says) on top of arena.js.
// ---------------------------------------------------------------------------
let MODE = { onWaveCleared() {}, onBossDefeated() {}, onGameOver() {} };

const DAYS = [
  { pool: ['alarm', 'email', 'bell'], base: 4, boss: 'monday' },
  { pool: ['email', 'sock', 'bill', 'alarm', 'mosquito'], base: 5, boss: 'cucumber' },
  { pool: ['sock', 'bill', 'bell', 'mosquito', 'alarm'], base: 6, boss: 'vacuum' },
  { pool: ['duck', 'email', 'sock', 'bill', 'mosquito', 'alarm', 'bell'], base: 7, boss: 'bath' },
];
const DAY_SUBS = ['', 'The sun climbs', 'Shadows grow long', 'The nap deepens'];

function fmtTime(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}
const modsLine = () => [...game.mods].map(m => MODS[m].name).join('  -  ');

function startArenaMode(id) {
  unlockAudio();
  closePanels();
  scene = 'arena';
  document.body.classList.remove('journey', 'city');
  rng = id === 'daily' ? seeded(hashString('knight-kitten-' + todayKey())) : Math.random;
  newArenaGame(id, id === 'daily' ? dailyMods() : []);
  MODE = ARENA_MODES[id];
  MODE.start();
}

function dailyMods() {
  const pool = Object.keys(MODS);
  const a = gpick(pool);
  let b = gpick(pool);
  while (b === a) b = gpick(pool);
  return [a, b];
}

function retryButtons(retryLabel, retry) {
  return [
    { label: retryLabel, fn: () => { closePanels(); retry(); } },
    { label: 'Modes', fn: goToTitle, back: true },
  ];
}

// ---------------------------------------------------------------------------
// Story: morning to night, three waves then a boss each time of day.
// ---------------------------------------------------------------------------
function storyDay(i) {
  const g = game;
  g.tod = i;
  setTod(i, scenery.tod === i);
  setMusic(TODS[i].mood);
  g.wave = 0;
  g.dayScore = g.score;
  g.level = i + 1 + g.lap * 4;
  g.speedMul = 1 + g.lap * 0.12;
  spawnCrates(4);
  kit.control = true;
  arenaState = 'play';
  if (i === 0 && g.lap === 0) g.hintT = 10;
  storyNextWave();
}

function storyNextWave() {
  const g = game;
  g.wave++;
  if (g.wave > 3) { beginBoss(DAYS[g.tod].boss); return; }
  beginWave({ count: DAYS[g.tod].base + g.wave * 2 + g.lap, pool: DAYS[g.tod].pool, title: TODS[g.tod].name, sub: `Wave ${g.wave} of 3` });
}

const ARENA_MODES = {
  story: {
    start() {
      game.napOn = true;
      arenaReset();
      setTod(0, true);
      if (!SAVE.seenIntro) { SAVE.seenIntro = true; persist(); playIntro(() => storyDay(0)); }
      else storyDay(0);
    },
    hudTitle: () => `${TODS[game.tod].name}  -  wave ${Math.min(game.wave, 3)} of 3${game.lap ? `  -  day ${game.lap + 1}` : ''}`,
    onWaveCleared: storyNextWave,
    onBossDefeated() {
      const g = game;
      if (g.tod === 3) {
        const rec = setRecord('story', 'score', g.score);
        setRecord('story', 'days', g.lap + 1);
        playEnding(() => showResults({
          title: 'THE NAP IS SAFE', sub: '...until tomorrow.', record: rec,
          stats: [['Score', g.score], ['Best combo', g.bestCombo], ['Bosses beaten', g.stats.bosses], ['Alarms stopped', g.stats.saved]],
          buttons: [
            { label: `Day ${g.lap + 2} (harder)`, fn: () => { closePanels(); g.lap++; kit.sleeping = false; kit.bubble = null; arenaReset(); storyDay(0); } },
            { label: 'Modes', fn: goToTitle, back: true },
          ],
        }));
        return;
      }
      arenaState = 'transition';
      const next = g.tod + 1;
      setTod(next);
      sfx.chime();
      g.banner = { title: TODS[next].name, sub: DAY_SUBS[next], t: 2.6 };
      after(3, () => storyDay(next));
    },
    onGameOver(reason, killer) {
      const g = game;
      setRecord('story', 'score', g.score);
      const woke = reason === 'woke';
      showResults({
        title: woke ? 'THE HUMAN WOKE UP' : 'SER BISCUIT IS TOO TIRED',
        sub: woke ? `Rudely awakened by ${killer}.` : `Bested by ${killer}.`,
        stats: [['Score', g.score], ['Best combo', g.bestCombo], ['Reached', `${TODS[g.tod].name.toLowerCase()}, wave ${g.wave}`]],
        buttons: retryButtons(`Retry the ${TODS[g.tod].name.toLowerCase()}`, () => {
          g.score = g.dayScore; g.combo = 0; g.nap = g.napMax;
          kit.hp = kit.maxHp; kit.inv = 1.5; g.timers = [];
          arenaReset({ x: kit.x, y: kit.y });
          storyDay(g.tod);
        }),
      });
    },
  },

  // -------------------------------------------------------------------------
  // Endless: waves forever, a boss every fifth, a new twist every few waves.
  // -------------------------------------------------------------------------
  endless: {
    start() { endlessStart(); },
    hudTitle: () => `ENDLESS  -  wave ${game.wave}`,
    hudSub: () => game.mods.size ? modsLine() : '',
    onWaveCleared: endlessNext,
    onBossDefeated() { arenaState = 'play'; endlessNext(); },
    onGameOver(reason, killer) { endlessResults('endless', reason, killer); },
  },

  // -------------------------------------------------------------------------
  // Daily: an Endless run with today's two modifiers and a seeded sequence.
  // -------------------------------------------------------------------------
  daily: {
    start() {
      endlessStart();
      game.banner = { title: 'DAILY CHALLENGE', sub: modsLine(), t: 3 };
    },
    hudTitle: () => `DAILY ${todayKey()}  -  wave ${game.wave}`,
    hudSub: modsLine,
    onWaveCleared: endlessNext,
    onBossDefeated() { arenaState = 'play'; endlessNext(); },
    onGameOver(reason, killer) { endlessResults('daily', reason, killer); },
  },

  // -------------------------------------------------------------------------
  // Boss Rush: the four bosses back to back against the clock.
  // -------------------------------------------------------------------------
  bossrush: {
    start() {
      const g = game;
      g.napOn = false;
      arenaReset({ x: 480, y: 280 });
      setTod(0, true);
      g.rushIdx = -1;
      kit.control = true;
      arenaState = 'play';
      rushNext();
    },
    hudTitle: () => `BOSS RUSH  -  ${game.rushIdx + 1} of 4`,
    hudSub: () => fmtTime(game.elapsed),
    onWaveCleared() {},
    onBossDefeated() {
      const g = game;
      kit.hp = Math.min(kit.maxHp, kit.hp + 2);
      if (g.rushIdx >= 3) {
        const rec = setRecord('bossrush', 'time', Math.round(g.elapsed * 10) / 10, true);
        showResults({
          title: 'RUSH COMPLETE', sub: 'Four bosses. One tiny knight.', record: rec,
          stats: [['Time', fmtTime(g.elapsed)], ['Best time', fmtTime(SAVE.records.bossrush.time)], ['Best combo', g.bestCombo], ['Score', g.score]],
          buttons: retryButtons('Run it again', () => startArenaMode('bossrush')),
        });
        return;
      }
      arenaState = 'play';
      setTod(g.rushIdx + 1);
      sfx.chime();
      after(1.5, rushNext);
    },
    onGameOver(reason, killer) {
      const g = game;
      showResults({
        title: 'RUSH OVER', sub: `Bested by ${killer}.`,
        stats: [['Bosses beaten', g.stats.bosses], ['Time', fmtTime(g.elapsed)], ['Best combo', g.bestCombo]],
        buttons: retryButtons('Try again', () => startArenaMode('bossrush')),
      });
    },
  },
};

function rushNext() {
  const g = game;
  g.rushIdx++;
  g.tod = g.rushIdx;
  g.level = g.rushIdx + 1;
  beginBoss(BOSS_ORDER[g.rushIdx], { short: true });
}

function endlessStart() {
  const g = game;
  g.napOn = true;
  arenaReset();
  setTod(0, true);
  setMusic('morning');
  g.wave = 0;
  spawnCrates(4);
  kit.control = true;
  arenaState = 'play';
  g.hintT = 8;
  endlessNext();
}

function endlessPool(w) {
  const pool = ['alarm', 'email', 'bell'];
  if (w >= 3) pool.push('sock', 'mosquito');
  if (w >= 6) pool.push('bill');
  if (w >= 9) pool.push('duck');
  return pool;
}

function endlessNext() {
  const g = game;
  g.wave++;
  g.level = 1 + g.wave * 0.5;
  g.speedMul = 1 + Math.min(0.6, g.wave * 0.025);
  g.hpBonus = Math.floor(g.wave / 12);
  const tod = Math.floor((g.wave - 1) / 4) % 4;
  if (tod !== g.tod) { g.tod = tod; setTod(tod); setMusic(TODS[tod].mood); sfx.chime(); }
  // Endless adds a twist every four waves; the Daily keeps its fixed pair.
  if (g.mode === 'endless' && g.wave > 1 && (g.wave - 1) % 4 === 0 && g.mods.size < 4) {
    const options = Object.keys(MODS).filter(m => m !== 'glass' && !g.mods.has(m));
    const m = gpick(options);
    g.mods.add(m);
    if (m === 'slippery') kit.body.frictionAir = 0.03;
    after(0.3, () => { g.banner = { title: `+ ${MODS[m].name.toUpperCase()}`, sub: MODS[m].desc, t: 2.4 }; });
  }
  if (g.wave % 5 === 0) {
    g.bossHpMul = 1 + (g.wave / 5 - 1) * 0.25;
    beginBoss(BOSS_ORDER[(g.wave / 5 - 1) % 4], { short: g.wave > 5 });
    return;
  }
  if (g.wave % 3 === 0) spawnCrates(3);
  beginWave({ count: 4 + Math.round(g.wave * 1.6), pool: endlessPool(g.wave), title: `WAVE ${g.wave}`, sub: g.wave % 5 === 4 ? 'A boss is coming...' : '' });
}

function endlessResults(id, reason, killer) {
  const g = game;
  const reached = g.wave;
  const recWave = setRecord(id === 'daily' ? 'daily' : 'endless', id === 'daily' ? todayKey() : 'wave', id === 'daily' ? g.score : reached);
  if (id === 'endless') setRecord('endless', 'score', g.score);
  const woke = reason === 'woke';
  showResults({
    title: woke ? 'THE HUMAN WOKE UP' : 'SER BISCUIT IS TOO TIRED',
    sub: woke ? `Rudely awakened by ${killer}.` : `Bested by ${killer}.`,
    record: recWave,
    stats: [['Wave reached', reached], ['Score', g.score], ['Best combo', g.bestCombo], ['Chains', g.stats.chains]]
      .concat(id === 'daily' ? [['Today\'s twist', modsLine()]] : [['Best wave', SAVE.records.endless.wave || reached]]),
    buttons: retryButtons(id === 'daily' ? 'Try today again' : 'Play again', () => startArenaMode(id)),
  });
}
