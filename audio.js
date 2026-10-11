'use strict';

// Tiny WebAudio synth: sound effects plus a procedural chiptune loop whose
// mood follows the time of day. Everything routes through one master gain.
let actx = null;
let master = null;
let soundOn = true;

function unlockAudio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = soundOn ? 1 : 0;
      master.connect(actx.destination);
      setInterval(scheduleMusic, 50);
    } catch { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}

function toggleSound() {
  soundOn = !soundOn;
  if (master) master.gain.value = soundOn ? 1 : 0;
  try { localStorage.setItem('knightKittenSound', soundOn ? '1' : '0'); } catch { /* blocked */ }
  const el = document.getElementById('m-sound');
  if (el) el.textContent = `SOUND: ${soundOn ? 'ON' : 'OFF'}`;
}

try { soundOn = localStorage.getItem('knightKittenSound') !== '0'; } catch { /* blocked */ }

function tone(freq, dur, type = 'square', vol = 0.1, slideTo = null, delay = 0) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.15, freq = 2500, sweepTo = null, delay = 0) {
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buf;
  const f = actx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const sfx = {
  swing: () => noise(0.08, 0.16, 3400),
  hit: n => { tone(420 + Math.min(n, 12) * 40, 0.08, 'square', 0.07, 140); noise(0.06, 0.12, 1200); },
  heavy: () => { tone(180, 0.18, 'square', 0.1, 60); noise(0.12, 0.2, 700); },
  chain: n => tone(600 + n * 140, 0.12, 'square', 0.07, 1200 + n * 200),
  hurt: () => tone(320, 0.3, 'sawtooth', 0.1, 70),
  jump: () => tone(300, 0.1, 'square', 0.045, 620),
  land: () => noise(0.06, 0.08, 500),
  dash: () => noise(0.14, 0.12, 1800, 600),
  pound: () => { tone(110, 0.3, 'sawtooth', 0.12, 40); noise(0.25, 0.2, 400); },
  warn: () => { tone(880, 0.06, 'square', 0.05); tone(880, 0.06, 'square', 0.05, null, 0.11); },
  ring: () => { for (let i = 0; i < 6; i++) tone(i % 2 ? 1320 : 1180, 0.05, 'square', 0.04, null, i * 0.06); },
  napLost: () => [660, 520, 390].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, null, i * 0.12)),
  pickup: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.05, null, i * 0.06)),
  crate: () => { noise(0.15, 0.2, 900); tone(160, 0.1, 'square', 0.06, 90); },
  splash: () => noise(0.25, 0.14, 1800, 500),
  throw: () => tone(700, 0.15, 'triangle', 0.06, 1200),
  deflect: () => tone(800, 0.12, 'square', 0.07, 1700),
  slam: () => { tone(80, 0.45, 'sawtooth', 0.13, 35); noise(0.35, 0.22, 300); },
  suck: dur => noise(dur, 0.1, 300, 1600),
  cough: () => { tone(200, 0.1, 'square', 0.08, 120); tone(170, 0.1, 'square', 0.08, 100, 0.14); },
  quack: () => tone(520, 0.08, 'sawtooth', 0.05, 380),
  boss: () => { tone(98, 1.4, 'sawtooth', 0.08, 49); tone(147, 1.4, 'sawtooth', 0.05, 73); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.07, null, i * 0.1)),
  chime: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.5, 'triangle', 0.06, null, i * 0.18)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, null, i * 0.17)),
  blip: () => tone(660, 0.03, 'square', 0.03),
};

// ---------------------------------------------------------------------------
// Music: bass + arpeggio + hat, eighth-note steps, four-bar progressions.
// ---------------------------------------------------------------------------
const MOODS = {
  title: { bpm: 92, root: 57, prog: [0, 5, 7, 3], minor: false, lead: 'triangle' },
  morning: { bpm: 100, root: 60, prog: [0, 5, 9, 7], minor: false, lead: 'triangle' },
  noon: { bpm: 116, root: 62, prog: [0, 7, 9, 5], minor: false, lead: 'square' },
  dusk: { bpm: 92, root: 57, prog: [0, 5, 3, 7], minor: true, lead: 'triangle' },
  night: { bpm: 80, root: 55, prog: [0, 8, 3, 10], minor: true, lead: 'triangle' },
  boss: { bpm: 144, root: 52, prog: [0, 0, 3, 5], minor: true, lead: 'square' },
  ending: { bpm: 72, root: 60, prog: [0, 9, 5, 7], minor: false, lead: 'triangle' },
  // Bengaluru: a flat second for a Mayamalavagowla flavour, a gentle Malgudi, a brisk metro.
  city: { bpm: 104, root: 62, prog: [0, 1, 0, 8], minor: false, lead: 'triangle' },
  malgudi: { bpm: 84, root: 60, prog: [0, 5, 7, 5], minor: false, lead: 'triangle' },
  metro: { bpm: 126, root: 64, prog: [0, 5, 0, 7], minor: false, lead: 'square' },
};
const music = { mood: 'title', step: 0, next: 0, on: true };

function setMusic(mood) {
  if (music.mood === mood) return;
  music.mood = mood;
  music.step = 0;
}

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function scheduleMusic() {
  if (!actx || !music.on) return;
  const m = MOODS[music.mood];
  if (music.next < actx.currentTime) music.next = actx.currentTime + 0.05;
  const stepDur = 60 / m.bpm / 2;
  while (music.next < actx.currentTime + 0.25) {
    const s = music.step;
    const bar = Math.floor(s / 8) % 4;
    const root = m.root + m.prog[bar];
    const chord = [0, m.minor ? 3 : 4, 7, 12];
    const delay = music.next - actx.currentTime;
    if (s % 4 === 0) tone(midi(root - 24), stepDur * 3.5, 'triangle', 0.06, null, delay);
    const arp = chord[[0, 1, 2, 3, 2, 1, 0, 2][s % 8]];
    tone(midi(root + arp), stepDur * 0.9, m.lead, m.lead === 'square' ? 0.018 : 0.03, null, delay);
    if (s % 2 === 1) noise(0.03, 0.025, 7000, null, delay);
    if (music.mood === 'boss' && s % 4 === 2) noise(0.08, 0.05, 200, null, delay);
    music.step++;
    music.next += stepDur;
  }
}
