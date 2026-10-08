/* ============================================================
   AETHERIA — main.js
   Núcleo: bucle de juego, economía, XP, misiones, logros,
   input táctil (joystick/botones/cámara) y pausa
   ============================================================ */
'use strict';

const Game = (() => {
  let playing = false, paused = false, lastT = 0;
  let lastMode = null, lastOpts = null;
  let pendingLevelUp = false;

  /* ---------- Boot ---------- */
  function init() {
    Save.load();
    const { renderer, scene, camera } = Engine.init(document.getElementById('game-canvas'));
    UI.initHUD();

    // Config inicial desde settings
    AudioSys.setSfx(Save.data.settings.sfx);
    AudioSys.setMusic(Save.data.settings.music);
    VFX.setShakeEnabled(Save.data.settings.shake);
    Engine.CamRig.sens = Save.data.settings.sens;
    Engine.CamRig.setMode(Save.data.settings.camera || 'third');

    setupInput();
    setupButtons();
    bindAndroid();

    UI.show('menu');
    requestAnimationFrame(loop);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (playing && !paused) {
      Modes.update(dt);
      const p = Combat.player;
      Engine.update(dt, p ? p.pos : null);
      if (p && !paused) {
        Engine.CamRig.update(dt, new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z));
      }
      UI.updateHUD(dt);
    }
    Engine.renderer.render(Engine.scene, Engine.camera);
  }

  /* ---------- Economía ---------- */
  function addGold(n) { Save.data.player.gold += Math.floor(n); Save.data.stats.goldEarned += Math.floor(n); UI.renderCurrencies(); Save.save(); }
  function addGems(n) { Save.data.player.gems += Math.floor(n); UI.renderCurrencies(); Save.save(); }
  function spendGold(n) {
    if (Save.data.player.gold < n) { UI.toast('🪙 Oro insuficiente'); AudioSys.sfx('uiBack'); return false; }
    Save.data.player.gold -= Math.floor(n); UI.renderCurrencies(); Save.save(); return true;
  }
  function spendGems(n) {
    if (Save.data.player.gems < n) { UI.toast('💎 Gemas insuficientes'); AudioSys.sfx('uiBack'); return false; }
    Save.data.player.gems -= Math.floor(n); UI.renderCurrencies(); Save.save(); return true;
  }
  function grantReward(r, silent) {
    if (r.gold) addGold(r.gold);
    if (r.gems) addGems(r.gems);
    if (r.tickets) { Save.data.player.tickets += r.tickets; UI.renderCurrencies(); Save.save(); }
    if (r.xp) addXP(r.xp);
    if (!silent) UI.toast('🎁 ' + Object.entries(r).map(([k, v]) =>
      `${k === 'gold' ? '🪙' : k === 'gems' ? '💎' : k === 'tickets' ? '🎟️' : '⭐'}+${U.fmt(v)}`).join('  '));
  }
  function addXP(n) {
    const d = Save.data;
    d.player.xp += Math.floor(n);
    let leveled = false;
    while (d.player.xp >= DATA.xpNeeded(d.player.level)) {
      d.player.xp -= DATA.xpNeeded(d.player.level);
      d.player.level++;
      leveled = true;
    }
    if (leveled) {
      pendingLevelUp = true;
      checkLevelUp();
    }
    Save.save();
  }
  function checkLevelUp() {
    if (!pendingLevelUp) return;
    pendingLevelUp = false;
    UI.bigBanner(`<div class="bb-kicker">NIVEL ${Save.data.player.level}</div><div class="bb-main">⬆ ¡GUARDIÁN MEJORADO!</div>`, 'levelup', 2500);
    AudioSys.sfx('levelup');
    grantReward({ gems: 20, gold: 200 * Save.data.player.level }, true);
  }

  /* ---------- Misiones ---------- */
  function ensureMissions() {
    const d = Save.data;
    const today = U.todayKey(), week = U.weekKey();
    if (d.missions.dailyDate !== today) {
      d.missions.dailyDate = today;
      d.missions.daily = pickMissions(DATA.DAILY_POOL, 3);
      d.missions.claimedDaily = [];
    }
    if (d.missions.weeklyDate !== week) {
      d.missions.weeklyDate = week;
      d.missions.weekly = pickMissions(DATA.WEEKLY_POOL, 2);
      d.missions.claimedWeekly = [];
    }
    Save.save();
  }
  function pickMissions(pool, n) {
    const copy = pool.slice();
    const out = [];
    while (out.length < n && copy.length) {
      const m = copy.splice(Math.floor(Math.random() * copy.length), 1)[0];
      out.push({ id: m.id, prog: 0 });
    }
    return out;
  }

  const MISSION_KEYS = {
    kills: ['d_kills_30', 'd_kills_60', 'w_kills_400'],
    boss: ['d_boss_1', 'w_boss_5'],
    runs: ['d_runs_2', 'w_campaign_5'],
    royale: ['d_royale_1'],
    royale_top: ['w_royale_5'],
    explore: ['d_explore_1'],
    gold_earned: ['d_gold_500'],
    upg: ['d_upg_2'],
    combo: ['d_combo_15'],
    nodmg: ['d_nodmg_1'],
    gacha: [],
    campaign_new: ['w_campaign_5'],
    hero_new: []
  };
  function missionEvent(key, amt) {
    if (!amt) return;
    ensureMissions();
    const d = Save.data;
    const ids = MISSION_KEYS[key] || [];
    for (const list of [d.missions.daily, d.missions.weekly]) {
      for (const m of list) {
        if (ids.includes(m.id)) m.prog += amt;
      }
    }
    Save.save();
  }

  /* ---------- Logros ---------- */
  function achProgress(a) {
    const d = Save.data;
    switch (a.id) {
      case 'a_first_blood': return d.stats.kills;
      case 'a_kills_100': return d.stats.kills;
      case 'a_kills_1000': return d.stats.kills;
      case 'a_boss_1': case 'a_boss_10': return d.stats.bossKills;
      case 'a_stars_15': case 'a_stars_45': return Object.values(d.campaign.stars).reduce((x, y) => x + y, 0);
      case 'a_wave_10': case 'a_wave_25': return d.endless.bestWave;
      case 'a_royale_1': case 'a_royale_5': return d.royale.wins;
      case 'a_heroes_3': case 'a_heroes_all': return d.heroes.owned.length;
      case 'a_lvl_10': return d.player.level;
      case 'a_shards_all': return d.explore.shards.length;
    }
    return 0;
  }
  function checkAchievementAuto() {
    // Logros que se completan automáticamente (notificación)
    const d = Save.data;
    for (const a of DATA.ACHIEVEMENTS) {
      if (!d.achievements[a.id + '_claimed'] && !d.achievements[a.id + '_seen'] && achProgress(a) >= a.goal) {
        d.achievements[a.id + '_seen'] = true;
        UI.toast(`🏆 Logro completado: ${a.name} — reclama en Misiones`, 3200);
        AudioSys.sfx('victory');
      }
    }
    Save.save();
  }

  /* ---------- Flujo de partida ---------- */
  function setPlaying(b) { playing = b; if (!b) paused = false; }
  function pause() {
    if (!playing || paused) return;
    paused = true;
    AudioSys.stopMusic();
    UI.showPause();
  }
  function resume() { paused = false; AudioSys.resume(); }
  function retry() {
    Modes.stop();
    UI.show('game');
    startMode(lastMode, lastOpts);
  }
  function startMode(mode, opts) {
    lastMode = mode; lastOpts = opts;
    Modes.start(mode, opts);
  }
  function exitToMenuSilently() {
    playing = false; paused = false;
    Modes.stop();
  }
  function backToMenu() {
    exitToMenuSilently();
    UI.show('menu');
  }
  function handleKill(e) {
    const d = Save.data;
    d.stats.kills++;
    if (e.type === 'boss') { d.stats.bossKills++; Game.missionEvent('boss', 1); }
    Game.missionEvent('kills', 1);
    if (e.gold) Game.missionEvent('gold_earned', e.gold);
    if (Combat.combo >= 15) Game.missionEvent('combo', 1);
    Game.addXP(e.xp || 0);
    if (Modes.instance && Modes.instance.onEnemyKilled) Modes.instance.onEnemyKilled(e);
    checkAchievementAuto();
  }

  /* ---------- Input táctil ---------- */
  function setupInput() {
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    let joyId = null, joyCX = 0, joyCY = 0;
    const R = 46;

    function joyStart(x, y) {
      const r = joy.getBoundingClientRect();
      joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
      joyMove(x, y);
    }
    function joyMove(x, y) {
      let dx = x - joyCX, dy = y - joyCY;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      Input.moveX = dx / R; Input.moveY = -dy / R;
    }
    function joyEnd() {
      joyId = null;
      Input.moveX = 0; Input.moveY = 0;
      knob.style.transform = 'translate(0,0)';
    }

    joy.addEventListener('touchstart', e => {
      e.preventDefault(); AudioSys.init(); AudioSys.resume();
      if (joyId === null) { joyId = e.changedTouches[0].identifier; joyStart(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }
    }, { passive: false });
    joy.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === joyId) joyMove(t.clientX, t.clientY);
    }, { passive: false });
    const joyCancel = e => { for (const t of e.changedTouches) if (t.identifier === joyId) joyEnd(); };
    joy.addEventListener('touchend', joyCancel);
    joy.addEventListener('touchcancel', joyCancel);

    /* Mouse fallback (para pruebas en desktop) */
    let mouseDown = false;
    joy.addEventListener('mousedown', e => { mouseDown = true; AudioSys.init(); joyStart(e.clientX, e.clientY); });
    window.addEventListener('mousemove', e => { if (mouseDown) joyMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (mouseDown) { mouseDown = false; joyEnd(); } });

    /* Botones de acción (touchstart para respuesta inmediata) */
    bindHold('attack-btn', v => Input.attack = v);
    bindTap('dodge-btn', () => Input.dodge = true);
    bindTap('skill-1', () => Input.skill1 = true);
    bindTap('skill-2', () => Input.skill2 = true);
    bindTap('skill-ult', () => Input.ult = true);

    /* Arrastre de cámara en zona derecha (multitouch safe) */
    const camZone = document.getElementById('cam-zone');
    let camId = null, lastX = 0, lastY = 0;
    camZone.addEventListener('touchstart', e => {
      AudioSys.init(); AudioSys.resume();
      if (camId === null) { camId = e.changedTouches[0].identifier; lastX = e.changedTouches[0].clientX; lastY = e.changedTouches[0].clientY; }
    }, { passive: true });
    camZone.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === camId) {
          Engine.CamRig.orbit(t.clientX - lastX, t.clientY - lastY);
          lastX = t.clientX; lastY = t.clientY;
        }
      }
    }, { passive: true });
    const camEnd = e => { for (const t of e.changedTouches) if (t.identifier === camId) camId = null; };
    camZone.addEventListener('touchend', camEnd);
    camZone.addEventListener('touchcancel', camEnd);
    // mouse para desktop
    let camMouse = false;
    camZone.addEventListener('mousedown', e => { camMouse = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mousemove', e => {
      if (camMouse) { Engine.CamRig.orbit(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; }
    });
    window.addEventListener('mouseup', () => camMouse = false);

    // Diálogo: tap para continuar
    const dlg = document.getElementById('dlg-box');
    dlg.addEventListener('click', () => UI.nextDialogue());
  }

  function bindHold(id, fn) {
    const b = document.getElementById(id);
    const on = e => { e.preventDefault(); AudioSys.init(); AudioSys.resume(); fn(true); b.classList.add('pressed'); };
    const off = e => { fn(false); b.classList.remove('pressed'); };
    b.addEventListener('touchstart', on, { passive: false });
    b.addEventListener('touchend', off);
    b.addEventListener('touchcancel', off);
    b.addEventListener('mousedown', on);
    window.addEventListener('mouseup', off);
  }
  function bindTap(id, fn) {
    const b = document.getElementById(id);
    b.addEventListener('touchstart', e => { e.preventDefault(); AudioSys.init(); AudioSys.resume(); fn(); }, { passive: false });
    b.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
  }

  /* ---------- Botones HUD y menú ---------- */
  function setupButtons() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', () => { AudioSys.init(); AudioSys.resume(); fn(); }); };

    // Menú principal
    on('btn-campaign', () => UI.show('map'));
    on('btn-endless', () => startMode('endless', {}));
    on('btn-royale', () => startMode('royale', {}));
    on('btn-explore', () => startMode('explore', {}));
    on('nav-heroes', () => UI.show('heroes'));
    on('nav-armory', () => UI.show('armory'));
    on('nav-gacha', () => UI.show('gacha'));
    on('nav-missions', () => UI.show('missions'));
    on('nav-events', () => UI.show('events'));
    on('nav-settings', () => UI.show('settings'));
    // back buttons
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { AudioSys.sfx('uiBack'); UI.show('menu'); }));

    // Gacha
    on('gacha-single-ticket', () => UI.pull(1, 'tickets'));
    on('gacha-ten-ticket', () => UI.pull(10, 'tickets'));
    on('gacha-single-gems', () => UI.pull(1, 'gems'));
    on('gacha-ten-gems', () => UI.pull(10, 'gems'));

    // HUD
    on('pause-btn', () => pause());
    on('cam-btn', cycleCamera);

    // visibility change → pausa automática
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing && !paused) pause(); });
  }
  function cycleCamera() {
    const modes = ['third', 'aerial', 'first'];
    const names = { third: '🎥 3ª Persona', aerial: '🛰 Vista Aérea', first: '👁 1ª Persona' };
    const cur = Engine.CamRig.mode;
    const next = modes[(modes.indexOf(cur) + 1) % 3];
    Engine.CamRig.setMode(next);
    UI.toast(names[next], 1400);
    AudioSys.sfx('portalanimation');
  }

  /* ---------- Puente Android ---------- */
  function bindAndroid() {
    window.AetheriaBack = () => {
      if (playing && !paused) { pause(); return true; }
      if (paused) { resume(); UI.hidePause(); return true; }
      return false;
    };
  }
  function hidePause() { const p = document.getElementById('screen-pause'); p && p.classList.remove('active'); }

  return {
    init, addGold, addGems, spendGold, spendGems, grantReward, addXP, checkLevelUp,
    missionEvent, ensureMissions, achProgress, checkAchievementAuto,
    setPlaying, pause, resume, retry, startMode, backToMenu, exitToMenuSilently,
    handleKill, cycleCamera, hidePause,
    get playing() { return playing; }, get paused() { return paused; }
  };
})();

/* Arranque */
window.addEventListener('load', () => {
  try {
    Game.init();
  } catch (err) {
    console.error(err);
    const d = document.getElementById('fatal-error');
    if (d) { d.style.display = 'flex'; d.querySelector('.fe-msg').textContent = err.message; }
  }
});
