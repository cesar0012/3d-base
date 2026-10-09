/* ============================================================
   AETHERIA — modes.js
   Campaña · Defensa Infinita · Arena Suprema (royale) · Mundo Abierto
   ============================================================ */
'use strict';

const Modes = (() => {

  let current = null;
  let instance = null;

  function start(mode, opts = {}) {
    current = mode;
    UI.show('game');
    Game.setPlaying(true);

    const loading = document.getElementById('loading-bar-fill');
    loading.style.width = '0%';
    document.getElementById('screen-loading').classList.add('active');

    // Construcción diferida para mostrar loading
    setTimeout(() => {
      loading.style.width = '45%';
      setTimeout(() => {
        try {
          Combat.reset(Engine.scene, {
            onEnemyKilled: (e) => Game.handleKill(e)
          });
          if (mode === 'campaign') instance = new CampaignMode(opts);
          else if (mode === 'endless') instance = new EndlessMode(opts);
          else if (mode === 'royale') instance = new RoyaleMode(opts);
          else if (mode === 'explore') instance = new ExploreMode(opts);
          loading.style.width = '100%';
          setTimeout(() => {
            document.getElementById('screen-loading').classList.remove('active');
            instance.begin();
          }, 250);
        } catch (err) {
          console.error(err);
          UI.toast('Error al cargar: ' + err.message);
          Game.backToMenu();
        }
      }, 60);
    }, 60);
  }

  function update(dt) { if (instance && Game.playing) instance.update(dt); }
  function stop() { if (instance) instance.cleanup(); instance = null; current = null; }

  /* ==================== BASE ==================== */
  class BaseMode {
    constructor(theme, worldOpts) {
      Engine.buildWorld(theme, worldOpts);
      this.theme = theme;
      this.props = [];
      this.timers = [];
    }
    addProp(p, pos, animate, colR) {
      p.position.copy(pos);
      if (colR) Engine.addCollider(pos.x, pos.z, colR);
      Engine.scene.add(p);
      if (animate && p.userData.anim) {
        const fn = (t) => { if (p.userData.anim) p.userData.anim(t); };
        Engine.registerAnim(fn);
        this.timers.push(fn);
      }
      this.props.push(p);
      return p;
    }
    spawnPlayer(heroId, pos) {
      const p = Combat.createPlayer(heroId || Save.data.activeHero || 'kael', pos);
      Engine.CamRig.yaw = Math.PI;
      return p;
    }
    cleanup() {
      for (const t of this.timers) Engine.unregisterAnim(t);
      this.timers = [];
      Combat.reset();
      Engine.clearWorld();
    }
    later(fn, ms) { const t = setTimeout(() => { if (instance === this) fn(); }, ms); this.timers.push({ _timeout: t }); }
  }

  /* ==================== CAMPAÑA ==================== */
  class CampaignMode extends BaseMode {
    constructor(opts) {
      const L = DATA.CAMPAIGN[opts.levelId - 1];
      super(L.theme, { size: 240, keepClear: 20, seed: 1000 + L.id });
      this.L = L;
      this.wave = 0; this.state = 'intro'; this.stateT = 0;
      this.enemiesToKill = 0; this.spawnQueue = 0; this.spawnTimer = 0;
      this.runStart = 0; this.goldEarned = 0; this.xpEarned = 0;
      this.startHpFrac = 1;
    }
    begin() {
      const p = this.spawnPlayer(null, new THREE.Vector3(0, 0, 26));
      this.runStart = performance.now();
      AudioSys.music(this.L.idxInRegion === 5 ? 'boss' : 'battle');
      UI.modeBanner(this.L.name, DATA.REGIONS[this.L.regionIdx].name);
      UI.updateHUD(0);
      document.getElementById('objective-txt').textContent = '¡Derrota todas las oleadas!';
      this.later(() => this.startWave(), 1800);
      if (!Save.data.tutorial.done) UI.showTutorialTips();
    }
    startWave() {
      if (this.state === 'over') return;
      this.wave++;
      const L = this.L;
      const isFinal = this.wave > L.waves - (L.idxInRegion === 5 ? 1 : 0);
      const isBossWave = this.wave === L.waves;
      UI.waveBanner(this.wave, L.waves);
      AudioSys.music(isBossWave ? 'boss' : 'battle');
      // composición de la oleada
      const count = 4 + this.wave * 2 + L.regionIdx * 2;
      const pool = L.pool;
      this.pendingSpawns = [];
      for (let i = 0; i < count; i++) {
        this.pendingSpawns.push({ type: U.pick(pool), elite: U.chance(0.08 + L.regionIdx * 0.03) });
      }
      if (this.wave === 3 && L.idxInRegion >= 3) {
        this.pendingSpawns.push({ type: pool[pool.length - 1], elite: true });
      }
      this.spawnTimer = 0;
      this.state = 'wave';
      if (isBossWave) {
        this.later(() => {
          const a = Math.random() * Math.PI * 2;
          Combat.spawnBoss(L.boss, { x: Math.sin(a) * 26, z: Math.cos(a) * 26 }, {
            hpScale: DATA.BOSSES[L.boss].hpMult * L.hpScale * 0.6,
            atkScale: DATA.BOSSES[L.boss].atkMult * L.atkScale * 0.5
          });
        }, 1600);
      }
    }
    update(dt) {
      Combat.update(dt);
      this.stateT += dt;
      const p = Combat.player;
      // spawn escalonado
      if (this.state === 'wave' && this.pendingSpawns && this.pendingSpawns.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = 0.45;
          const spec = this.pendingSpawns.shift();
          const a = Math.random() * Math.PI * 2;
          const r = 34 + Math.random() * 14;
          const e = Combat.spawnEnemy(spec.type, { x: Math.sin(a) * r, z: Math.cos(a) * r }, {
            hpScale: this.L.hpScale, atkScale: this.L.atkScale, elite: spec.elite
          });
          if (e) VFX.ringBurst(e.pos, 8, '#ef4444', 2);
        }
      }
      document.getElementById('wave-info').textContent =
        this.state === 'wave' ? `Oleada ${this.wave}/${this.L.waves} · Enemigos: ${Combat.enemies.length + (this.pendingSpawns ? this.pendingSpawns.length : 0)}` : '';
      // fin de oleada
      if (this.state === 'wave' && Combat.enemies.length === 0 && (!this.pendingSpawns || this.pendingSpawns.length === 0)) {
        if (this.wave >= this.L.waves) { this.victory(); }
        else {
          this.state = 'intermission'; this.stateT = 0;
          UI.toast(`Oleada superada. Siguiente en 3s...`);
          this.later(() => this.startWave(), 3000);
        }
      }
      if (p && p.dead && this.state !== 'over') { this.defeat(); }
    }
    victory() {
      if (this.state === 'over') return;
      this.state = 'over';
      const d = Save.data;
      const L = this.L;
      const timeSec = (performance.now() - this.runStart) / 1000;
      const p = Combat.player;
      const hpFrac = p ? p.hp / p.maxHp : 0;
      let stars = 1;
      if (hpFrac > 0.3) stars++;
      if (timeSec < 60 + L.waves * 35) stars++;
      const prev = d.campaign.stars[L.id] || 0;
      d.campaign.stars[L.id] = Math.max(prev, stars);
      if (d.campaign.unlocked < L.id + 1) d.campaign.unlocked = Math.min(DATA.CAMPAIGN.length, L.id + 1);
      const rewards = prev > 0 ? L.rewards.replay : L.rewards.first;
      Game.grantReward(rewards, true);
      d.stats.runs++; d.stats.bossKills += L.idxInRegion === 5 ? 1 : 0;
      Game.missionEvent('runs', 1);
      Game.missionEvent('campaign_new', 1);
      Game.missionEvent('nodmg', hpFrac >= 0.999 ? 1 : 0);
      Save.save();
      Game.setPlaying(false);
      this.later(() => UI.showResults({
        win: true, stars,
        subtitle: `${DATA.REGIONS[L.regionIdx].name} · ${U.mmss(timeSec)}`,
        rows: [
          ['Enemigos derrotados', Combat.killCount],
          ['Mejor combo', Combat.bestCombo],
          ['Vida final', Math.round(hpFrac * 100) + '%']
        ],
        rewards,
        onRetry: () => Game.retry(),
        onNext: L.id < DATA.CAMPAIGN.length ? () => { Game.exitToMenuSilently(); Modes.start('campaign', { levelId: L.id + 1 }); } : null,
        onMenu: () => Game.backToMenu()
      }), 1200);
      Game.checkLevelUp();
    }
    defeat() {
      this.state = 'over';
      Game.setPlaying(false);
      const d = Save.data;
      d.stats.deaths++;
      Save.save();
      this.later(() => UI.showResults({
        win: false,
        subtitle: `Caíste en la oleada ${this.wave}`,
        rows: [['Derrotados', Combat.killCount]],
        rewards: { gold: Math.floor(Combat.killCount * 4), xp: Math.floor(Combat.killCount * 2) },
        onRetry: () => Game.retry(),
        onMenu: () => Game.backToMenu()
      }), 1400);
      Game.grantReward({ gold: Math.floor(Combat.killCount * 4), xp: Math.floor(Combat.killCount * 2) }, true);
      Game.checkLevelUp();
    }
  }

  /* ==================== DEFENSA INFINITA ==================== */
  class EndlessMode extends BaseMode {
    constructor(opts) {
      super('meadow', { size: 220, keepClear: 24, seed: 777 });
      this.wave = 0; this.state = 'prep'; this.prepT = 20; this.over = false;
      this.runGold = 0; this.pendingSpawns = null; this.spawnTimer = 0;
      this.difficulty = opts.startWave ? opts.startWave - 1 : 0;
    }
    begin() {
      Combat.setObjective('crystal');
      const crystal = Combat.placeCrystal(new THREE.Vector3(0, 0, 0));
      crystal.hp = crystal.maxHp = 1500 + Save.data.endless.bestWave * 60;
      this.crystal = crystal;
      this.spawnPlayer(null, new THREE.Vector3(0, 0, 12));
      // torretas decorativas alrededor
      for (const a of [0.6, 2.4, 4.2]) {
        this.addProp(Models.turret(), new THREE.Vector3(Math.sin(a) * 9, Engine.groundY(Math.sin(a) * 9, Math.cos(a) * 9), Math.cos(a) * 9), true, 0.8);
      }
      AudioSys.music('meadow');
      UI.modeBanner('Defensa Infinita', 'Sobrevive al asedio eterno');
      document.getElementById('objective-txt').textContent = 'Protege el Cristal';
      this.waveInfo();
      UI.updateHUD(0);
    }
    waveInfo() {
      document.getElementById('wave-info').textContent =
        this.state === 'prep' ? `Preparación: ${Math.ceil(this.prepT)}s (Oleada ${this.wave + 1})`
        : `Oleada ${this.wave} · Enemigos: ${Combat.enemies.length} · Cristal: ${Math.ceil(this.crystal.hp)}`;
    }
    startWave() {
      this.wave++;
      this.state = 'wave';
      document.getElementById('wave-shop').classList.remove('show');
      UI.waveBanner(this.wave);
      AudioSys.music(this.wave % 10 === 0 ? 'boss' : 'battle');
      const pools = [
        ['slime', 'goblin', 'lobo'],
        ['goblin', 'lobo', 'arquero_g', 'slime_azul'],
        ['esqueleto', 'orco', 'arquero_g', 'bombardero'],
        ['mago_osc', 'espectro', 'orco', 'dragoncito'],
        ['golem', 'espectro', 'dragoncito', 'mago_osc']
      ];
      const tier = Math.min(pools.length - 1, Math.floor((this.wave - 1) / 6));
      const pool = pools[tier];
      const count = 5 + this.wave * 2;
      const hpS = 1 + this.wave * 0.22, atkS = 1 + this.wave * 0.13;
      this.pendingSpawns = [];
      for (let i = 0; i < count; i++) this.pendingSpawns.push({ type: U.pick(pool), elite: U.chance(0.07 + this.wave * 0.004) });
      if (this.wave % 10 === 0) {
        const bosses = ['rey_slime', 'senor_goblin', 'golem_obsidiana', 'lich_escarcha', 'dragon_fuego', 'devorador'];
        const bossId = bosses[Math.min(bosses.length - 1, Math.floor(this.wave / 10) - 1)];
        this.later(() => {
          Combat.spawnBoss(bossId, { x: 0, z: -40 }, {
            hpScale: DATA.BOSSES[bossId].hpMult * (1 + this.wave * 0.12),
            atkScale: DATA.BOSSES[bossId].atkMult * (1 + this.wave * 0.06)
          });
        }, 2000);
      }
      this.spawnTimer = 0;
    }
    update(dt) {
      Combat.update(dt);
      if (this.over) return;
      if (this.state === 'prep') {
        this.prepT -= dt;
        if (this.prepT <= 0) this.startWave();
      } else if (this.state === 'wave' && this.pendingSpawns) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.pendingSpawns.length) {
          this.spawnTimer = Math.max(0.25, 0.7 - this.wave * 0.02);
          const spec = this.pendingSpawns.shift();
          const a = Math.random() * Math.PI * 2, r = 36 + Math.random() * 10;
          Combat.spawnEnemy(spec.type, { x: Math.sin(a) * r, z: Math.cos(a) * r }, {
            hpScale: 1 + this.wave * 0.22, atkScale: 1 + this.wave * 0.13, elite: spec.elite
          });
        }
        if (Combat.enemies.length === 0 && this.pendingSpawns.length === 0) {
          // oleada superada
          this.state = 'prep';
          const bonus = 60 + this.wave * 25;
          Game.addGold(bonus);
          this.runGold += bonus;
          UI.toast(`Oleada ${this.wave} superada · +${bonus} de oro`);
          AudioSys.sfx('victory');
          if (this.wave > Save.data.endless.bestWave) {
            Save.data.endless.bestWave = this.wave;
            Save.save();
          }
          Game.missionEvent('runs', this.wave === 1 ? 1 : 0);
          this.prepT = Math.max(8, 18 - this.wave * 0.3);
          // oferta entre oleadas
          this.shopOffer();
        }
      }
      // cristal destruido o jugador muerto → fin
      if (this.crystal.hp <= 0 || (Combat.player && Combat.player.dead)) this.endRun();
      this.waveInfo();
    }
    shopOffer() {
      const offers = [
        { txt: 'Curar 50% (vida)', fn: () => { const p = Combat.player; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); AudioSys.sfx('heal'); } },
        { txt: '+15% ataque (esta partida)', fn: () => { Combat.player.atk *= 1.15; AudioSys.sfx('levelup'); } },
        { txt: '+25% vida máxima', fn: () => { const p = Combat.player; p.maxHp *= 1.25; p.hp += p.maxHp * 0.2; AudioSys.sfx('levelup'); } },
        { txt: '+10% velocidad', fn: () => { Combat.player.spd *= 1.1; AudioSys.sfx('levelup'); } },
        { txt: 'Reparar Cristal 40%', fn: () => { this.crystal.hp = Math.min(this.crystal.maxHp, this.crystal.hp + this.crystal.maxHp * 0.4); AudioSys.sfx('heal'); } },
        { txt: 'Bomba: daña a todos los enemigos', fn: () => { for (const e of Combat.enemies.slice()) Combat.dealDamage(e, Combat.player.atk * 3, { element: 'fuego' }); VFX.flash('#fb923c', 0.5, 400); AudioSys.sfx('explosion'); } }
      ];
      const picks = [];
      while (picks.length < 3 && offers.length) picks.push(offers.splice(Math.floor(Math.random() * offers.length), 1)[0]);
      const box = document.getElementById('wave-shop');
      box.querySelector('#wave-shop-title').textContent = `Tienda entre oleadas (${Math.ceil(this.prepT)}s)`;
      box.querySelector('#wave-shop-opts').innerHTML = picks.map((o, i) => `<button class="btn btn-gold" data-i="${i}">${o.txt}</button>`).join('');
      box.classList.add('show');
      box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
        picks[+b.dataset.i].fn();
        box.classList.remove('show');
        UI.toast('¡Mejora aplicada!');
      });
    }
    endRun() {
      if (this.over) return;
      this.over = true;
      Game.setPlaying(false);
      const d = Save.data;
      const wave = this.wave;
      const gems = Math.floor(wave / 5) * DATA.eventBuff('bossGemMult');
      const rewards = { gold: this.runGold + wave * 30, gems, xp: wave * 12 };
      Game.grantReward(rewards, true);
      d.stats.runs++;
      if (wave > 1) Game.missionEvent('runs', 1);
      Game.checkLevelUp();
      Save.save();
      document.getElementById('wave-shop').classList.remove('show');
      const cause = this.crystal.hp <= 0 ? 'El Cristal fue destruido' : 'Caíste en combate';
      this.later(() => UI.showResults({
        win: false,
        subtitle: `${cause} · Oleada ${wave}`,
        rows: [
          ['Oleadas', wave], ['Derrotados', Combat.killCount],
          ['Récord', 'Oleada ' + d.endless.bestWave]
        ],
        rewards,
        onRetry: () => Game.retry(),
        onMenu: () => Game.backToMenu()
      }), 1200);
    }
  }

  /* ==================== ARENA SUPREMA (ROYALE) ==================== */
  class RoyaleMode extends BaseMode {
    constructor(opts) {
      super('royale', { size: 300, island: true, water: true, waterLevel: -2.2, keepClear: 12, trees: 60, seed: 4242 });
      this.bots = [];
      this.alive = 20;
      this.zone = { x: 0, z: 0, r: 130, nextR: 100, timer: 30, phase: 0 };
      this.over = false; this.kills = 0; this.placement = 20;
      this.chests = [];
      this.weaponLvl = 0;
      this.dropT = 5; this.dropping = true;
      this.mapMarkers = [];
    }
    begin() {
      const p = this.spawnPlayer(null, new THREE.Vector3(U.rand(-40, 40), 60, U.rand(-40, 40)));
      p.spd += this.weaponLvl * 0;
      AudioSys.music('royale');
      UI.modeBanner('Arena Suprema', '20 luchadores · 1 vencedor');
      document.getElementById('objective-txt').textContent = 'Sé el último en pie';
      // cofres
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = U.rand(15, 120);
        const chest = Models.chest();
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        this.addProp(chest, new THREE.Vector3(x, Engine.groundY(x, z), z), false, 0.45);
        this.chests.push({ mesh: chest, x, z, opened: false });
        this.mapMarkers.push({ x, z });
      }
      // bots: entidades lógicas; se materializan cerca del jugador
      const botNames = ['Ragnar', 'Elisa', 'Torvin', 'Kira', 'Dorn', 'Vex', 'Lyanna', 'Gorzak', 'Mina', 'Fenrir', 'Astrid', 'Krug', 'Sable', 'Nym', 'Orin', 'Thal', 'Zafira', 'Bok', 'Rue'];
      botNames.forEach((name, i) => {
        const a = Math.random() * Math.PI * 2, r = U.rand(20, 115);
        this.bots.push({
          name, x: Math.sin(a) * r, z: Math.cos(a) * r, hp: 900, maxHp: 900, atk: 55 + Math.random() * 40,
          alive: true, wp: { x: U.rand(-100, 100), z: U.rand(-100, 100) }, entity: null, engageT: 0
        });
      });
      document.getElementById('zone-timer').style.display = '';
      document.getElementById('royale-alive').style.display = '';
      document.getElementById('minimap').style.display = '';
      this.updateRoyaleHUD();
      UI.showTutorialTips();
    }
    updateRoyaleHUD() {
      document.getElementById('royale-alive').textContent = `Vivos: ${this.alive}`;
      document.getElementById('zone-timer').textContent = `${U.mmss(this.zone.timer)} · Zona ${Math.round(this.zone.r)}m`;
    }
    update(dt) {
      if (this.over) { Combat.update(dt); return; }
      const p = Combat.player;

      /* Aterrizaje planeando */
      if (this.dropping) {
        this.dropT -= dt;
        p.pos.y = Math.max(Engine.groundY(p.pos.x, p.pos.z), p.pos.y - 16 * dt);
        // steer relativo a cámara (misma convención que el movimiento: X negada)
        const cy = Engine.CamRig.yaw;
        const mvx = (-Math.cos(cy) * Input.moveX + Math.sin(cy) * Input.moveY) * 22 * dt;
        const mvz = (Math.sin(cy) * Input.moveX + Math.cos(cy) * Input.moveY) * 22 * dt;
        p.pos.x = U.clamp(p.pos.x + mvx, -140, 140);
        p.pos.z = U.clamp(p.pos.z + mvz, -140, 140);
        VFX.trail({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, '#e2e8f0', 0.5, 0.4);
        if (p.pos.y <= Engine.groundY(p.pos.x, p.pos.z) + 0.1) {
          this.dropping = false;
          VFX.ring(p.pos, '#38bdf8', 3, 0.5);
          UI.toast('¡Aterrizaje! Busca cofres con botín');
        }
        Combat.update(dt * 0.4);
        return;
      }
      Combat.update(dt);

      /* Zona que se encoge */
      const z = this.zone;
      z.timer -= dt;
      if (z.timer <= 0) {
        z.phase++;
        z.r = Math.max(18, z.nextR);
        z.nextR = Math.max(14, z.r * 0.62);
        z.timer = 34 + z.phase * 4;
        z.x = U.rand(-1, 1) * (130 - z.r) * 0.4; z.z = U.rand(-1, 1) * (130 - z.r) * 0.4;
        UI.toast('¡La zona se encoge!');
        AudioSys.sfx('wave');
      } else if (z.timer < 10 && z.r > z.nextR) {
        // transición suave
        z.r = Math.max(z.nextR, z.r - dt * 2.5);
      }
      // daño fuera de zona
      if (U.dist2(p.pos.x, p.pos.z, z.x, z.z) > z.r) {
        p.hp -= (8 + z.phase * 4) * dt;
        if (Math.random() < dt * 6) VFX.dmgNumber({ x: p.pos.x, y: 2, z: p.pos.z }, 'ZONA', 'player-hit');
        if (p.hp <= 0 && !p.dead) { Combat.damagePlayer(9999, null); }
      }
      // visual del muro de zona
      if (!this.zoneMesh) {
        this.zoneMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1, 1, 60, 48, 1, true),
          new THREE.MeshBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
        );
        Engine.scene.add(this.zoneMesh);
      }
      this.zoneMesh.position.set(z.x, 20, z.z);
      this.zoneMesh.scale.set(z.r, 1, z.r);
      this.zoneMesh.material.opacity = 0.16 + Math.sin(Engine.clockT * 2) * 0.05;

      /* Cofres */
      for (const c of this.chests) {
        if (c.opened) continue;
        if (U.dist2(p.pos.x, p.pos.z, c.x, c.z) < 2) {
          c.opened = true;
          c.mesh.userData.lid.rotation.x = -1.9;
          VFX.burst(c.mesh.position, 22, '#fbbf24', { size: 0.4, speed: 3, up: 5 });
          AudioSys.sfx('chest');
          const roll = Math.random();
          if (roll < 0.3) { p.atk *= 1.18; this.weaponLvl++; UI.toast(`¡Arma mejorada! Nv.${this.weaponLvl} (+18% ATK)`); }
          else if (roll < 0.55) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45); UI.toast('¡Poción de vida!'); AudioSys.sfx('heal'); }
          else if (roll < 0.75) { p.shieldHp += p.maxHp * 0.5; UI.toast('¡Escudo!'); }
          else if (roll < 0.9) {
            UI.toast('¡Bomba!');
            for (const e of Combat.enemies.slice()) if (U.dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < 12) Combat.dealDamage(e, p.atk * 2.5, {});
            VFX.ring(p.pos, '#fb923c', 12, 0.6); AudioSys.sfx('explosion');
          }
          else { Game.addGems(5); UI.toast('¡Gemas del cofre!'); }
          const mi = this.mapMarkers.indexOf(c); if (mi >= 0) this.mapMarkers.splice(mi, 1);
        }
      }

      /* Bots */
      this.botTick(dt, p);
      if (p.dead && !this.over) this.endRun(false);
      this.updateRoyaleHUD();
    }
    botTick(dt, p) {
      const z = this.zone;
      let aliveBots = 0;
      for (const b of this.bots) {
        if (!b.alive) continue;
        aliveBots++;
        // moverse hacia waypoint / centro de zona
        const tx = b.wp.x, tz = b.wp.z;
        const d = U.dist2(b.x, b.z, tx, tz);
        if (d < 3) { b.wp = { x: z.x + U.rand(-1, 1) * z.r * 0.7, z: z.z + U.rand(-1, 1) * z.r * 0.7 }; }
        else {
          const a = U.angleTo(b.x, b.z, tx, tz);
          b.x += Math.sin(a) * 4.5 * dt; b.z += Math.cos(a) * 4.5 * dt;
        }
        // fuera de zona sufre daño
        if (U.dist2(b.x, b.z, z.x, z.z) > z.r) b.hp -= (10 + z.phase * 5) * dt;
        // combate bot vs bot (abstracto)
        b.engageT -= dt;
        if (b.engageT <= 0) {
          b.engageT = 1;
          for (const o of this.bots) {
            if (o === b || !o.alive) continue;
            if (U.dist2(b.x, b.z, o.x, o.z) < 10) {
              o.hp -= b.atk * 0.4;
              if (o.hp <= 0) this.killBot(o, b.name);
            }
          }
        }
        // bot cerca del jugador → materializar como entidad real de combate
        const dp = U.dist2(b.x, b.z, p.pos.x, p.pos.z);
        if (dp < 45 && !b.entity && !p.dead) {
          const e = Combat.spawnEnemy('goblin', { x: b.x, z: b.z }, { hpScale: b.maxHp / DATA.ENEMIES.goblin.hp, atkScale: b.atk / DATA.ENEMIES.goblin.atk, aggroR: 30 });
          if (e) {
            e.name = b.name; b.entity = e; b.isBot = true;
            e.hpBar && (e.hpBar.visible = true);
          }
        }
        if (b.entity) {
          if (b.entity.dead) {
            if (!b.byPlayer) {
              b.byPlayer = true;
              this.kills++;
              UI.addKillFeed(`¡Eliminaste a ${b.name}!`);
              AudioSys.sfx('victory');
            }
            b.alive = false; continue;
          }
          b.x = b.entity.pos.x; b.z = b.entity.pos.z;
          b.hp = b.entity.hp;
        } else if (b.hp <= 0) { this.killBot(b, 'la zona'); }
      }
      this.alive = aliveBots + (Combat.player && !Combat.player.dead ? 1 : 0);
      if (aliveBots === 0 && !this.over) this.endRun(true);
    }
    killBot(b, by) {
      b.alive = false;
      if (b.entity) b.entity.hp = 0, b.entity.dead = true;
      UI.addKillFeed(`${b.name} eliminado por ${by}`);
      this.alive--;
    }
    endRun(won) {
      if (this.over) return;
      this.over = true;
      Game.setPlaying(false);
      const d = Save.data;
      const placement = won ? 1 : this.alive + 1;
      const mult = DATA.eventBuff('royaleMult');
      const rewards = {
        gold: Math.floor((won ? 900 : 500 - placement * 20) * mult),
        gems: Math.floor((won ? 150 : 20) * mult),
        xp: won ? 220 : 60,
        tickets: won ? 1 : 0
      };
      rewards.gold = Math.max(50, rewards.gold);
      Game.grantReward(rewards, true);
      d.royale.kills += this.kills;
      d.stats.runs++;
      if (won) { d.royale.wins++; d.royale.best = Math.max(d.royale.best, 1); }
      Game.missionEvent('royale', 1);
      Game.missionEvent('royale_top', won || placement <= 5 ? 1 : 0);
      Game.checkLevelUp();
      Save.save();
      this.later(() => UI.showResults({
        win: won,
        subtitle: won ? '¡Último en pie!' : `Puesto #${placement} de 20`,
        rows: [['Vivos al final', this.alive]],
        rewards,
        onRetry: () => Game.retry(),
        onMenu: () => Game.backToMenu()
      }), 1000);
    }
    cleanup() {
      if (this.zoneMesh) { Engine.scene.remove(this.zoneMesh); this.zoneMesh.geometry.dispose(); this.zoneMesh.material.dispose(); this.zoneMesh = null; }
      document.getElementById('zone-timer').style.display = 'none';
      document.getElementById('royale-alive').style.display = 'none';
      document.getElementById('minimap').style.display = 'none';
      super.cleanup();
    }
  }

  /* ==================== MUNDO ABIERTO ==================== */
  class ExploreMode extends BaseMode {
    constructor(opts) {
      super('meadow', { size: 340, keepClear: 20, trees: 110, seed: 909 });
      this.camps = [];
      this.shards = [];
      this.chests = [];
      this.npcs = [];
      this.quests = DATA.STORY.quests.map(q => Object.assign({}, q, { prog: 0, done: false, claimed: false }));
      this.nearNpc = null;
      this.over = false;
      this.mapMarkers = [];
      this.storyStep = 0;
    }
    begin() {
      const p = this.spawnPlayer(null, new THREE.Vector3(0, 0, 16));
      AudioSys.music('meadow');
      Engine.setDayNight(true, 1 / 300);
      UI.modeBanner('Valle Esmeralda', 'Mundo Abierto · Explora y restaura');
      document.getElementById('objective-txt').textContent = 'Explora · Habla con los aldeanos';

      /* Aldea */
      const housePos = [[-14, -6], [14, -8], [0, -18]];
      for (const [hx, hz] of housePos) {
        this.addProp(Models.house('meadow'), new THREE.Vector3(hx, Engine.groundY(hx, hz), hz), false, 1.75);
      }
      this.addProp(Models.campfire(), new THREE.Vector3(0, Engine.groundY(0, -2), -2), true, 0.55);
      this.addProp(Models.well(), new THREE.Vector3(5.5, Engine.groundY(5.5, -2), -2), false, 1.1);
      // farolas alrededor de la plaza
      for (const [lx, lz] of [[-5, 3], [5, 3], [-5, -12], [6, -12]]) {
        this.addProp(Models.lamp(), new THREE.Vector3(lx, Engine.groundY(lx, lz), lz), true, 0.35);
      }
      // vallas delimitando la plaza
      const fences = [[-9, 4, 0], [9, 4, 0], [-13, 12, Math.PI / 2], [13, 12, Math.PI / 2]];
      for (const [fx, fz, rot] of fences) {
        const f = this.addProp(Models.fence(8), new THREE.Vector3(fx, Engine.groundY(fx, fz), fz));
        f.rotation.y = rot;
      }
      // barriles y detalles junto a las casas
      for (const [bx, bz] of [[-11.5, -3], [-10.2, -3.2], [12, -4.5], [2.2, -14], [1, -14.4]]) {
        this.addProp(Models.barrel(), new THREE.Vector3(bx, Engine.groundY(bx, bz), bz), false, 0.42);
      }
      /* NPCs */
      const npcDefs = [
        { id: 'elder', model: { hair: '#e2e8f0', hairStyle: 'long', outfit: '#7c3aed', outfit2: '#4c1d95', accent: '#fbbf24', skin: '#ffdbac' }, pos: [-6, -8] },
        { id: 'smith', model: { hair: '#78350f', hairStyle: 'short', outfit: '#78350f', outfit2: '#451a03', accent: '#f87171', skin: '#f3d5b5' }, pos: [16, -6] },
        { id: 'scout', model: { hair: '#059669', hairStyle: 'ponytail', outfit: '#0f766e', outfit2: '#134e4a', accent: '#a7f3d0', skin: '#ffe0c2' }, pos: [8, 10] },
        { id: 'merchant', model: { hair: '#1f2937', hairStyle: 'hood', outfit: '#b45309', outfit2: '#78350f', accent: '#fbbf24', skin: '#ffdbac' }, pos: [-10, 6] }
      ];
      for (const nd of npcDefs) {
        const c = Models.character(Object.assign({ cape: false }, nd.model));
        this.addProp(c.group, new THREE.Vector3(nd.pos[0], Engine.groundY(nd.pos[0], nd.pos[1]), nd.pos[1]), false, 0.55);
        // burbuja de diálogo flotante (canvas con "!")
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const cx2 = cv.getContext('2d');
        cx2.fillStyle = '#fbbf24'; cx2.beginPath(); cx2.arc(32, 26, 18, 0, 7); cx2.fill();
        cx2.beginPath(); cx2.moveTo(22, 38); cx2.lineTo(32, 56); cx2.lineTo(42, 38); cx2.closePath(); cx2.fill();
        cx2.fillStyle = '#422006'; cx2.font = 'bold 30px Rubik, sans-serif'; cx2.textAlign = 'center'; cx2.fillText('!', 32, 36);
        const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
        mark.scale.setScalar(0.55); mark.position.y = 2.35; mark.renderOrder = 15;
        c.group.add(mark);
        this.npcs.push({ id: nd.id, def: DATA.STORY.npcs[nd.id], group: c.group, model: c, x: nd.pos[0], z: nd.pos[1], mark, dwell: 0, cooldown: 0 });
      }
      /* Campamentos enemigos */
      const campDefs = [
        { x: -70, z: -50, types: ['slime', 'slime', 'slime_azul'] },
        { x: 75, z: -60, types: ['goblin', 'goblin', 'arquero_g'] },
        { x: -80, z: 60, types: ['lobo', 'lobo', 'goblin'] },
        { x: 85, z: 55, types: ['esqueleto', 'esqueleto', 'mago_osc'] },
        { x: 0, z: -110, types: ['orco', 'esqueleto', 'arquero_g'] },
        { x: -60, z: 120, types: ['dragoncito', 'golem'] },
        { x: 110, z: 0, types: ['espectro', 'mago_osc', 'esqueleto'] }
      ];
      for (const cd of campDefs) {
        const gy = Engine.groundY(cd.x, cd.z);
        const fire = this.addProp(Models.campfire(), new THREE.Vector3(cd.x, gy, cd.z), true, 0.55);
        for (let i = 0; i < cd.types.length; i++) {
          const a = (i / cd.types.length) * Math.PI * 2;
          const ex = cd.x + Math.sin(a) * 5, ez = cd.z + Math.cos(a) * 5;
          Combat.spawnEnemy(cd.types[i], { x: ex, z: ez }, { hpScale: 2.5, atkScale: 1.6, aggroR: 12 });
        }
        this.camps.push({ x: cd.x, z: cd.z, types: cd.types, respawn: 0 });
        this.mapMarkers.push({ x: cd.x, z: cd.z });
      }
      /* Fragmentos de cristal (12) */
      const shardSpots = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.3;
        const r = 60 + (i % 3) * 35;
        shardSpots.push({ x: Math.sin(a) * r * 1.15, z: Math.cos(a) * r });
      }
      for (const s of shardSpots) {
        if (!Save.data.explore.shards.includes(spotKey(s))) {
          const cry = Models.crystalMesh('#22d3ee', 1.4);
          this.addProp(cry, new THREE.Vector3(s.x, Engine.groundY(s.x, s.z), s.z), true);
          this.shards.push({ x: s.x, z: s.z, mesh: cry, key: spotKey(s) });
        }
      }
      /* Cofres (6) */
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = U.rand(40, 130);
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        const ch = this.addProp(Models.chest(), new THREE.Vector3(x, Engine.groundY(x, z), z));
        this.chests.push({ mesh: ch, x, z, opened: false, respawn: 0 });
      }
      /* Portal decorativo al norte */
      const portal = this.addProp(Models.portal(), new THREE.Vector3(0, Engine.groundY(0, -130), -130), true, 1.5);

      /* Historia inicial */
      this.later(() => {
        UI.showDialogue('Voz del Cristal', DATA.STORY.intro.map(s => s.text), () => {
          UI.toast('Completa misiones hablando con los aldeanos');
        });
      }, 1000);
      this.updateQuestTracker();
      Game.missionEvent('explore', 1);
      document.getElementById('minimap').style.display = '';
      UI.showTutorialTips();
    }
    update(dt) {
      Combat.update(dt);
      if (this.over) return;
      const p = Combat.player;
      /* Respawn de campamentos */
      for (const camp of this.camps) {
        if (camp.respawn > 0) {
          camp.respawn -= dt;
          if (camp.respawn <= 0) {
            for (const t of camp.types) {
              const a = Math.random() * Math.PI * 2;
              Combat.spawnEnemy(t, { x: camp.x + Math.sin(a) * 5, z: camp.z + Math.cos(a) * 5 }, { hpScale: 2.5, atkScale: 1.6, aggroR: 12 });
            }
          }
        } else if (!Combat.enemies.some(e => U.dist2(e.pos.x, e.pos.z, camp.x, camp.z) < 25)) {
          camp.respawn = 40;
        }
      }
      /* Cofres */
      for (const c of this.chests) {
        if (c.opened) {
          c.respawn -= dt;
          if (c.respawn <= 0) { c.opened = false; c.mesh.userData.lid.rotation.x = 0; }
          continue;
        }
        if (U.dist2(p.pos.x, p.pos.z, c.x, c.z) < 2) {
          c.opened = true; c.respawn = 60;
          c.mesh.userData.lid.rotation.x = -1.9;
          const g = U.randInt(80, 200);
          Game.addGold(g);
          if (U.chance(0.3)) Game.addGems(U.randInt(5, 15));
          VFX.burst(c.mesh.position, 18, '#fbbf24', { speed: 3, up: 4 });
          AudioSys.sfx('chest');
          UI.toast(`Cofre abierto: +${g} de oro`);
        }
      }
      /* Fragmentos */
      for (let i = this.shards.length - 1; i >= 0; i--) {
        const s = this.shards[i];
        s.mesh.rotation.y += dt * 0.8;
        if (U.dist2(p.pos.x, p.pos.z, s.x, s.z) < 2.5) {
          Save.data.explore.shards.push(s.key);
          Engine.scene.remove(s.mesh);
          this.shards.splice(i, 1);
          Game.addGems(25);
          VFX.burst(s.mesh.position, 30, '#22d3ee', { size: 0.5, speed: 4, up: 6 });
          AudioSys.sfx('gem');
          VFX.flash('#22d3ee', 0.4, 500);
          const total = Save.data.explore.shards.length;
          UI.toast(`Fragmento ${total}/12 recuperado · +25 gemas`);
          this.updateQuestTracker();
          if (total >= 12) this.finale();
        }
      }
      /* NPCs cercanos: burbuja + botón + auto-diálogo al acercarse */
      this.nearNpc = null;
      for (const n of this.npcs) {
        const d = U.dist2(p.pos.x, p.pos.z, n.x, n.z);
        n.mark.position.y = 2.35 + Math.sin(Engine.clockT * 2.4) * 0.12;
        n.mark.visible = d < 26;
        n.group.rotation.y = U.angleLerp(n.group.rotation.y, U.angleTo(n.x, n.z, p.pos.x, p.pos.z), dt * 3);
        if (n.model && n.model.tick) n.model.tick(dt);
        n.cooldown = Math.max(0, n.cooldown - dt);
        if (d < 5.5) this.nearNpc = n;
        // auto-inicio de conversación al permanecer muy cerca
        if (d < 2.8 && n.cooldown <= 0 && !document.getElementById('dlg-box').classList.contains('show')) {
          n.dwell += dt;
          if (n.dwell > 0.6) { n.dwell = 0; n.cooldown = 8; this.talkTo(n); }
        } else if (d > 3.4) n.dwell = 0;
      }
      const talkBtn = document.getElementById('talk-btn');
      if (this.nearNpc) {
        talkBtn.style.display = '';
        talkBtn.innerHTML = `${Ico.n('chat', 16)} Hablar con ${U.escape(this.nearNpc.def.name)}`;
        talkBtn.onclick = () => this.talkTo(this.nearNpc);
      } else talkBtn.style.display = 'none';

      /* Misiones de caza auto-track */
      for (const q of this.quests) {
        if (q.type === 'kill' && q.done) continue;
      }
      document.getElementById('wave-info').textContent = `Fragmentos ${Save.data.explore.shards.length}/12 · Enemigos: ${Combat.enemies.length}`;
    }
    onEnemyKilled(e) {
      for (const q of this.quests) {
        if (q.type === 'kill' && !q.done && e.typeId === q.target) {
          q.prog++;
          if (q.prog >= q.count) { q.done = true; UI.toast(`Misión lista: ${q.name} — habla con el aldeano`); AudioSys.sfx('victory'); }
          this.updateQuestTracker();
        }
      }
    }
    updateQuestTracker() {
      const d = Save.data;
      const active = this.quests.filter(q => !q.done).slice(0, 2);
      const shardsLeft = 12 - d.explore.shards.length;
      document.getElementById('quest-tracker').innerHTML =
        `<div class="qt-title">MISIONES</div>` +
        active.map(q => `<div class="qt-item">${U.escape(q.text)} <b>${Math.min(q.prog, q.count)}/${q.count}</b></div>`).join('') +
        `<div class="qt-item">Fragmentos: <b>${d.explore.shards.length}/12</b></div>`;
    }
    talkTo(npc) {
      // busca misión reclamable de este NPC
      const claimable = this.quests.find(q => !q.claimed && q.done && q.giver === npc.id);
      const lines = npc.def.lines.slice();
      if (claimable) {
        lines.push(`¡Completaste "${claimable.name}"! Toma tu recompensa.`);
      }
      UI.showDialogue(npc.def.name, lines, () => {
        if (claimable) {
          claimable.claimed = true;
          Game.grantReward(claimable.reward, true);
          Game.checkLevelUp();
          UI.toast('Recompensa de misión reclamada');
          AudioSys.sfx('gem');
          this.updateQuestTracker();
        }
      });
    }
    finale() {
      UI.showDialogue('Voz del Cristal', [
        'El Cristal resplandece una vez más... Gracias, Guardián.',
        'Aetheria está a salvo... por ahora. Nuevas tierras aguardan en futuras expansiones.'
      ], () => {
        Game.grantReward({ gems: 300, gold: 3000 }, true);
        Game.checkLevelUp();
      });
    }
    cleanup() {
      document.getElementById('talk-btn').style.display = 'none';
      document.getElementById('quest-tracker').innerHTML = '';
      document.getElementById('minimap').style.display = 'none';
      super.cleanup();
    }
  }
  function spotKey(s) { return `${Math.round(s.x)}_${Math.round(s.z)}`; }

  return {
    start, update, stop,
    get current() { return current; },
    get instance() { return instance; }
  };
})();
