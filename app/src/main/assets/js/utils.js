/* ============================================================
   AETHERIA — utils.js
   Helpers matemáticos, RNG, audio sintetizado (WebAudio) y guardado
   ============================================================ */
'use strict';

const U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  damp(a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
  rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
  angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); },
  angleLerp(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; },
  fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  },
  mmss(sec) { sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`; },
  todayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  weekKey(d = new Date()) { const o = new Date(d.getFullYear(), 0, 1); const w = Math.floor((d - o) / 6048e5); return `${d.getFullYear()}-W${w}`; },
  daysBetween(aKey, bKey) {
    const a = new Date(aKey + 'T00:00:00'), b = new Date(bKey + 'T00:00:00');
    return Math.round((b - a) / 864e5);
  },
  el(id) { return document.getElementById(id); },
  escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  },
  vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
};

/* ================= AUDIO SINTETIZADO ================= */
const AudioSys = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let sfxOn = true, musicOn = true;
  let musicTimer = null, currentTrack = null, step = 0;

  function init() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
    } catch (e) { ctx = null; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function tone({ freq = 440, freqEnd, type = 'sine', dur = 0.15, vol = 0.5, attack = 0.005, when = 0, dest }) {
    if (!ctx || !sfxOn && dest !== musicGain) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise({ dur = 0.2, vol = 0.4, filter = 1200, when = 0 }) {
    if (!ctx || !sfxOn) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  const SFX = {
    ui: () => tone({ freq: 620, freqEnd: 880, type: 'triangle', dur: 0.07, vol: 0.25 }),
    uiBack: () => tone({ freq: 500, freqEnd: 320, type: 'triangle', dur: 0.08, vol: 0.25 }),
    hit: () => { noise({ dur: 0.08, vol: 0.35, filter: 2200 }); tone({ freq: 200, freqEnd: 90, type: 'square', dur: 0.08, vol: 0.22 }); },
    crit: () => { noise({ dur: 0.14, vol: 0.5, filter: 3500 }); tone({ freq: 320, freqEnd: 70, type: 'sawtooth', dur: 0.16, vol: 0.3 }); },
    swing: () => noise({ dur: 0.12, vol: 0.18, filter: 900 }),
    shoot: () => tone({ freq: 900, freqEnd: 300, type: 'square', dur: 0.1, vol: 0.2 }),
    fireball: () => { noise({ dur: 0.25, vol: 0.3, filter: 800 }); tone({ freq: 300, freqEnd: 120, type: 'sawtooth', dur: 0.25, vol: 0.2 }); },
    ice: () => { tone({ freq: 1400, freqEnd: 2100, type: 'sine', dur: 0.18, vol: 0.25 }); tone({ freq: 1900, freqEnd: 2600, type: 'sine', dur: 0.14, vol: 0.15, when: 0.05 }); },
    thunder: () => { noise({ dur: 0.4, vol: 0.55, filter: 5000 }); tone({ freq: 120, freqEnd: 40, type: 'sawtooth', dur: 0.4, vol: 0.35 }); },
    explosion: () => { noise({ dur: 0.5, vol: 0.6, filter: 700 }); tone({ freq: 90, freqEnd: 30, type: 'sine', dur: 0.5, vol: 0.5 }); },
    coin: () => { tone({ freq: 1200, type: 'square', dur: 0.06, vol: 0.15 }); tone({ freq: 1800, type: 'square', dur: 0.1, vol: 0.15, when: 0.06 }); },
    gem: () => { [880, 1174, 1568, 2093].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.18, vol: 0.2, when: i * 0.07 })); },
    heal: () => { [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.25, vol: 0.22, when: i * 0.08 })); },
    levelup: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.25, when: i * 0.09 })); },
    death: () => tone({ freq: 300, freqEnd: 60, type: 'sawtooth', dur: 0.5, vol: 0.3 }),
    dodge: () => noise({ dur: 0.15, vol: 0.2, filter: 4000 }),
    gacha: () => { [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.25, when: i * 0.1 })); },
    gachaRare: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.45, vol: 0.28, when: i * 0.08 })); noise({ dur: 0.6, vol: 0.12, filter: 6000, when: 0.2 }); },
    wave: () => { tone({ freq: 220, freqEnd: 440, type: 'sawtooth', dur: 0.4, vol: 0.25 }); },
    bossRoar: () => { tone({ freq: 80, freqEnd: 45, type: 'sawtooth', dur: 1.0, vol: 0.5 }); noise({ dur: 0.9, vol: 0.4, filter: 400 }); },
    chest: () => { [660, 880].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.12, vol: 0.2, when: i * 0.1 })); },
    portalanimation: () => tone({ freq: 200, freqEnd: 1200, type: 'sine', dur: 0.6, vol: 0.25 }),
    fail: () => { [330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.3, when: i * 0.15 })); },
    victory: () => { [523, 523, 523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: i === 5 ? 0.6 : 0.16, vol: 0.28, when: i * 0.13 })); }
  };

  /* Música procedural por pistas (escalares + bajo) */
  const TRACKS = {
    menu:   { bpm: 82,  root: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle', bassVol: 0.16, melodyChance: 0.75 },
    meadow: { bpm: 104, root: 262, scale: [0, 2, 4, 7, 9],  wave: 'triangle', bassVol: 0.14, melodyChance: 0.7 },
    battle: { bpm: 138, root: 196, scale: [0, 3, 5, 6, 7, 10], wave: 'sawtooth', bassVol: 0.2, melodyChance: 0.85 },
    boss:   { bpm: 150, root: 165, scale: [0, 1, 5, 6, 8],  wave: 'sawtooth', bassVol: 0.24, melodyChance: 0.9 },
    royale: { bpm: 128, root: 185, scale: [0, 3, 5, 7, 10], wave: 'square',  bassVol: 0.18, melodyChance: 0.8 },
    night:  { bpm: 72,  root: 175, scale: [0, 2, 3, 7, 8],  wave: 'sine',    bassVol: 0.12, melodyChance: 0.55 }
  };

  function playMusicNote(track, when, deg, oct, dur) {
    const semis = track.scale[((deg % track.scale.length) + track.scale.length) % track.scale.length] + 12 * oct;
    const f = track.root * Math.pow(2, semis / 12);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = track.wave; o.frequency.value = f;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.14, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }
  function playBass(track, when, semis, dur) {
    const f = track.root / 2 * Math.pow(2, semis / 12);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(track.bassVol, when + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function music(name) {
    init();
    if (!ctx) return;
    if (currentTrack === name) return;
    stopMusic();
    if (!musicOn || !name) return;
    const track = TRACKS[name]; if (!track) return;
    currentTrack = name; step = 0;
    const stepDur = 60 / track.bpm / 2;
    const tick = () => {
      if (!ctx || currentTrack !== name) return;
      const t = ctx.currentTime + 0.08;
      if (step % 4 === 0) playBass(track, t, track.scale[(step / 4) % track.scale.length], stepDur * 3.4);
      if (Math.random() < track.melodyChance) {
        const deg = Math.floor(Math.random() * track.scale.length * 2) + (U.chance(0.3) ? 5 : 0);
        playMusicNote(track, t, deg, 1, stepDur * (U.chance(0.3) ? 1.8 : 0.9));
      }
      if (U.chance(0.18)) playMusicNote(track, t, 0, 2, stepDur * 0.6);
      step++;
      musicTimer = setTimeout(tick, stepDur * 1000);
    };
    tick();
  }
  function stopMusic() { currentTrack = null; if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; } }

  return {
    init, resume,
    sfx(name) { init(); if (!ctx) return; SFX[name] && SFX[name](); },
    music, stopMusic,
    setSfx(on) { sfxOn = on; }, setMusic(on) { musicOn = on; if (!on) stopMusic(); },
    get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; }
  };
})();

/* ================= GUARDADO ================= */
const Save = (() => {
  const KEY = 'aetheria_save_v2';
  const DEFAULT = () => ({
    ver: 2,
    createdAt: U.todayKey(),
    player: { name: 'Guardián', level: 1, xp: 0, gold: 300, gems: 120, tickets: 3 },
    campaign: { unlocked: 1, stars: {}, /* levelId: 0-3 */ best: {} },
    endless: { bestWave: 0 },
    royale: { wins: 0, best: 0, kills: 0 },
    explore: { shards: [], questsDone: [], storySeen: [] },
    heroes: { owned: ['kael'], levels: { kael: 1 }, shards: {} },
    loadout: { /* heroId: { weapon, head, chest, boots } */ },
    weapons: { owned: { espada_hierro: 1 }, upg: {} },   // owned: itemId -> count ; upg: itemId -> +N
    armor: { owned: { cuero_gorro: 1, cuero_pecho: 1, cuero_botas: 1 }, upg: {} },
    gacha: { pity4: 0, pity5: 0, total: 0 },
    missions: { dailyDate: '', daily: [], weeklyDate: '', weekly: [], claimedDaily: [], claimedWeekly: [] },
    achievements: {}, // id -> progress
    login: { lastDate: '', streak: 0, claimedDays: [] },
    events: { shopRefresh: '', seenNews: false },
    stats: { kills: 0, bossKills: 0, runs: 0, playTime: 0, deaths: 0, goldEarned: 0 },
    settings: { quality: 'auto', camera: 'third', sens: 1, autoAttack: true, dmgNumbers: true, sfx: true, music: true, shake: true },
    tutorial: { done: false, seenCam: false }
  });

  let data = DEFAULT();
  let saveTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = deepMerge(DEFAULT(), parsed);
      }
    } catch (e) { data = DEFAULT(); }
    return data;
  }
  function deepMerge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        deepMerge(base[k], over[k]);
      } else { base[k] = over[k]; }
    }
    return base;
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }, 250);
  }
  function reset() { data = DEFAULT(); try { localStorage.removeItem(KEY); } catch (e) {} save(); return data; }

  return { load, save, reset, get data() { return data; } };
})();
