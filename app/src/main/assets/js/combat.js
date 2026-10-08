/* ============================================================
   AETHERIA — combat.js
   Jugador, IA de enemigos, jefes con fases, proyectiles,
   invocaciones, loot y reacciones elementales
   ============================================================ */
'use strict';

/* ---------- Input táctil global (lo alimenta la UI) ---------- */
const Input = {
  moveX: 0, moveY: 0,            // joystick -1..1
  attack: false,                  // botón presionado
  skill1: false, skill2: false, ult: false, dodge: false,
  camDrag: null                   // {id, lastX, lastY}
};

const Combat = (() => {
  const enemies = [];
  const projectiles = [];
  const loot = [];
  const summons = [];
  let player = null;
  let scene = null;
  let callbacks = {}; // onEnemyKilled(enemy), onPlayerDeath(), onCrystalHit etc.
  let objective = 'kills'; // 'kills' | 'crystal' — a quién atacan los enemigos
  let crystalObj = null;   // {group, hp, maxHp, pos}
  let comboCount = 0, comboTimer = 0, bestCombo = 0;
  let killCount = 0;

  function reset(sc, cbs = {}) {
    scene = sc || Engine.scene;
    callbacks = cbs;
    for (const e of enemies) { destroyEnemy(e, false); }
    enemies.length = 0;
    for (const p of projectiles) scene.remove(p.mesh);
    projectiles.length = 0;
    for (const l of loot) scene.remove(l.mesh);
    loot.length = 0;
    for (const s of summons) { if (s.shadow) Engine.removeBlobShadow(s.shadow); scene.remove(s.model.group); }
    summons.length = 0;
    comboCount = 0; comboTimer = 0; bestCombo = 0; killCount = 0;
    player = null; crystalObj = null;
    VFX.clearTelegraphs();
  }

  /* ============================================================
     CÁLCULO DE DAÑO
     ============================================================ */
  function dealDamage(target, rawAtk, opts = {}) {
    if (target.dead) return 0;
    const defMult = 100 / (100 + (target.def || 0));
    let dmg = rawAtk * defMult;
    dmg *= DATA.elementMult(opts.element, target.element);
    let crit = false;
    if (!opts.noCrit && Math.random() < (opts.crit || 0.05)) { dmg *= 1.75; crit = true; }
    dmg = Math.max(1, Math.round(dmg * U.rand(0.92, 1.08)));
    target.hp -= dmg;

    const numPos = { x: target.pos.x, y: (target.hitY || 1.2) + target.h * 0.5, z: target.pos.z };
    if (Save.data.settings.dmgNumbers) {
      const cls = crit ? 'crit' : (opts.element && opts.element !== 'fisico' ? 'elem' : '') + (opts.heal ? 'heal' : '');
      VFX.dmgNumber(numPos, (opts.heal ? '+' : '') + U.fmt(dmg), opts.heal ? 'heal' : crit ? 'crit' : (opts.element && DATA.ELEMENTS[opts.element] && opts.element !== 'fisico' ? 'elem' : ''));
    }
    if (target.model && target.model.hitFlash) target.model.hitFlash();
    VFX.burst({ x: target.pos.x, y: numPos.y, z: target.pos.z }, crit ? 10 : 5, opts.element && DATA.ELEMENTS[opts.element] ? DATA.ELEMENTS[opts.element].color : '#fde68a', { size: 0.3, speed: 3 });
    if (crit) { VFX.shake(0.25); AudioSys.sfx('crit'); Combat.hitStop(70); }
    else AudioSys.sfx('hit');

    // Efectos elementales
    if (opts.effect && !target.dead) applyStatus(target, opts.effect, opts.element);

    if (target.hp <= 0) killTarget(target, opts.byPlayer !== false);
    else if (target.onDamaged) target.onDamaged(dmg, opts);
    return dmg;
  }

  function applyStatus(target, effect, element) {
    const now = Engine.clockT;
    if (effect === 'burn' || effect === 'poison') {
      target.status[effect] = { t: 3, tick: 0.5, dmg: Math.max(2, (target.maxHp || 100) * 0.015), next: now + 0.5 };
    } else if (effect === 'freeze') {
      target.status.freeze = { t: 1.6 };
      VFX.burst(target.pos, 12, '#7dd3fc', { size: 0.35, speed: 2 });
    } else if (effect === 'stun') {
      target.status.stun = { t: 1.2 };
      VFX.dmgNumber({ x: target.pos.x, y: 2, z: target.pos.z }, '¡Aturdido!', 'info');
    } else if (effect === 'root') {
      target.status.root = { t: 2.2 };
      VFX.burst(target.pos, 10, '#4ade80', { speed: 1.5 });
    }
  }

  function killTarget(target, byPlayer = true) {
    if (target.dead) return;
    target.dead = true;
    killCount++;
    if (byPlayer) {
      comboCount++; comboTimer = 3; bestCombo = Math.max(bestCombo, comboCount);
      if (player) player.energy = Math.min(100, player.energy + 8);
      if (callbacks.onEnemyKilled) callbacks.onEnemyKilled(target);
      // Loot
      const nCoins = 1 + Math.floor(target.gold / 8);
      for (let i = 0; i < Math.min(6, nCoins); i++) dropLoot(target.pos, 'coin', target.gold / Math.min(6, nCoins));
      if (U.chance(target.typeId.includes('boss') ? 1 : 0.06)) dropLoot(target.pos, 'gem', 1);
      if (U.chance(0.14)) dropLoot(target.pos, 'heart', 0);
      if (U.chance(0.2)) dropLoot(target.pos, 'energy', 0);
    }
    VFX.burst({ x: target.pos.x, y: 1, z: target.pos.z }, 16, target.color || '#f87171', { size: 0.45, speed: 5, up: 4 });
    VFX.ring(target.pos, target.color || '#f87171', 2.2, 0.4);
    AudioSys.sfx('death');
    if (target.type === 'boss') { VFX.shake(1.0); VFX.flash('#ffffff', 0.5, 400); }
    destroyEnemy(target, true);
  }

  function destroyEnemy(e, animate) {
    const idx = enemies.indexOf(e);
    if (idx >= 0) enemies.splice(idx, 1);
    if (e.shadow) Engine.removeBlobShadow(e.shadow);
    if (e.hpBar) e.model.group.remove(e.hpBar);
    if (animate && e.model) {
      // muerte con hundimiento y fade
      const g = e.model.group;
      let t = 0;
      const fn = (dt) => {
        t += dt;
        g.position.y -= dt * 1.4;
        g.scale.multiplyScalar(1 - dt * 1.8);
        if (t > 0.55) { scene.remove(g); Engine.unregisterAnim(fn); }
      };
      Engine.registerAnim(fn);
    } else if (e.model) scene.remove(e.model.group);
  }

  /* ============================================================
     LOOT
     ============================================================ */
  const lootGeoCache = {};
  function dropLoot(pos, kind, amount) {
    let mesh;
    if (kind === 'coin') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), Models.basicMat('#fbbf24', { emissive: 0 }));
      mesh.material = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
      mesh.rotation.x = Math.PI / 2;
    } else if (kind === 'gem') {
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
    } else if (kind === 'heart') {
      mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#f43f5e', transparent: true }));
      mesh.scale.setScalar(0.7);
    } else {
      mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#fde68a', transparent: true }));
      mesh.scale.setScalar(0.6);
    }
    const a = Math.random() * Math.PI * 2;
    mesh.position.set(pos.x + Math.cos(a) * U.rand(0.2, 1), Engine.groundY(pos.x, pos.z) + 0.5, pos.z + Math.sin(a) * U.rand(0.2, 1));
    scene.add(mesh);
    loot.push({ mesh, kind, amount, t: 0, vy: 3 + Math.random() * 2, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, grounded: false, life: 25 });
  }
  function updateLoot(dt) {
    if (!player) return;
    for (let i = loot.length - 1; i >= 0; i--) {
      const l = loot[i];
      l.t += dt; l.life -= dt;
      if (l.life <= 0) { scene.remove(l.mesh); loot.splice(i, 1); continue; }
      const gy = Engine.groundY(l.mesh.position.x, l.mesh.position.z) + 0.25;
      if (!l.grounded) {
        l.vy -= 12 * dt;
        l.mesh.position.x += l.vx * dt; l.mesh.position.z += l.vz * dt;
        l.mesh.position.y += l.vy * dt;
        if (l.mesh.position.y <= gy) { l.mesh.position.y = gy; l.grounded = true; }
      } else {
        l.mesh.position.y = gy + Math.sin(Engine.clockT * 4 + i) * 0.06;
      }
      const d = U.dist2(l.mesh.position.x, l.mesh.position.z, player.pos.x, player.pos.z);
      if (d < 4 || l.magnet) {
        l.magnet = true;
        const dir = { x: (player.pos.x - l.mesh.position.x) / (d || 1), z: (player.pos.z - l.mesh.position.z) / (d || 1) };
        const sp = 14;
        l.mesh.position.x += dir.x * sp * dt; l.mesh.position.z += dir.z * sp * dt;
        l.mesh.position.y += (player.pos.y + 0.8 - l.mesh.position.y) * dt * 6;
      }
      if (d < 1) {
        if (l.kind === 'coin') { Game.addGold(l.amount); AudioSys.sfx('coin'); }
        else if (l.kind === 'gem') { Game.addGems(l.amount); AudioSys.sfx('gem'); }
        else if (l.kind === 'heart') { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.2); AudioSys.sfx('heal'); VFX.dmgNumber({ x: player.pos.x, y: 2, z: player.pos.z }, '+HP', 'heal'); }
        else if (l.kind === 'energy') { player.energy = Math.min(100, player.energy + 20); AudioSys.sfx('coin'); }
        scene.remove(l.mesh); loot.splice(i, 1);
      }
    }
  }

  /* ============================================================
     JUGADOR
     ============================================================ */
  function createPlayer(heroId, spawnPos) {
    const hero = DATA.HEROES[heroId] || DATA.HEROES.kael;
    const lvl = (Save.data.heroes.levels[heroId] || 1);
    const stats = DATA.heroStats(heroId, lvl);

    // Equipo
    const loadout = Save.data.loadout[heroId] || {};
    const weaponId = loadout.weapon || 'espada_hierro';
    const weaponDef = DATA.WEAPONS[weaponId] || DATA.WEAPONS.espada_hierro;
    const weaponPlus = Save.data.weapons.upg[weaponId] || 0;
    let atk = stats.atk + DATA.weaponAtk(weaponId, weaponPlus);
    let def = stats.def, hp = stats.hp, spd = stats.spd, crit = stats.crit;
    for (const slot of ['head', 'chest', 'boots']) {
      const aId = loadout[slot];
      if (aId && DATA.ARMOR[aId]) {
        const st = DATA.armorStats(aId, Save.data.armor.upg[aId] || 0);
        def += st.def; hp += st.hp; spd += st.spd;
      }
    }
    crit += weaponDef.crit || 0;

    const model = Models.character({
      hair: hero.model.hair, hairStyle: hero.model.hairStyle, skin: hero.model.skin,
      outfit: hero.model.outfit, outfit2: hero.model.outfit2, accent: hero.model.accent,
      cape: hero.rarity === 'SR' || hero.rarity === 'SSR' || hero.rarity === 'UR',
      capeColor: hero.model.outfit2
    });
    model.group.position.copy(spawnPos);
    const wMesh = Models.weapon(weaponDef.type, weaponDef.rarity, weaponDef.element);
    model.setWeapon(wMesh);
    const glow = Models.weaponGlow(weaponDef.type, weaponDef.element, weaponDef.rarity);
    if (glow) model.parts.weaponMount.add(glow);
    scene.add(model.group);
    const shadow = Engine.blobShadow(model.group, 1.4);

    player = {
      type: 'player', heroId, hero, name: hero.name,
      pos: model.group.position, h: 1.8,
      hitY: 1.0,
      model, shadow,
      maxHp: hp, hp,
      atk, def, spd: spd, crit,
      weaponDef, weaponPlus,
      element: weaponDef.element || hero.element,
      energy: 0, dead: false,
      facing: 0,
      state: 'idle', stateT: 0,
      atkCd: 0, atkStage: 0, atkTimer: 0,
      dodgeCd: 0, dodgeT: 0, iframe: 0,
      s1Cd: 0, s2Cd: 0,
      buffs: [], status: {},
      comboMult: 1,
      speedMult: 1, atkMult: 1, shieldHp: 0,
      lastFloorY: spawnPos.y
    };
    return player;
  }

  function playerStats() { return player; }

  const _v3a = new THREE.Vector3(), _v3b = new THREE.Vector3();

  function updatePlayer(dt) {
    const p = player;
    if (!p) return;
    if (p.dead) { p.model.tick(dt); return; }

    p.stateT += dt;
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.iframe = Math.max(0, p.iframe - dt);
    p.s1Cd = Math.max(0, p.s1Cd - dt);
    p.s2Cd = Math.max(0, p.s2Cd - dt);
    // buffs
    p.atkMult = 1; p.speedMult = 1;
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i];
      b.t -= dt;
      if (b.t <= 0) { p.buffs.splice(i, 1); continue; }
      if (b.kind === 'atk') p.atkMult += b.amt;
      if (b.kind === 'spd') p.speedMult += b.amt;
      if (b.kind === 'regen') { p.hp = Math.min(p.maxHp, p.hp + b.amt * dt); }
    }
    // status (del jugador: freeze etc.)
    let statusSpd = 1;
    for (const k in p.status) {
      const s = p.status[k];
      s.t -= dt;
      if (s.t <= 0) { delete p.status[k]; continue; }
      if (k === 'freeze' || k === 'root' || k === 'stun') statusSpd = 0;
    }

    /* Movimiento (relativo a cámara) */
    const mag = Math.min(1, Math.hypot(Input.moveX, Input.moveY));
    let moving = mag > 0.12 && statusSpd > 0;
    const camYaw = Engine.CamRig.yaw;
    let vx = 0, vz = 0;
    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      const ds = p.spd * 2.4;
      vx = Math.sin(p.facing) * ds; vz = Math.cos(p.facing) * ds;
      moving = true;
      p.model.group.rotation.y = p.facing;
    } else if (moving) {
      // Movimiento relativo a cámara: screen-right = -cos(yaw) en X (mano derecha de three.js),
      // por eso moveX entra negado en el ángulo.
      const ang = Math.atan2(-Input.moveX, Input.moveY) + camYaw;
      const sp = p.spd * p.speedMult * statusSpd * mag;
      vx = Math.sin(ang) * sp; vz = Math.cos(ang) * sp;
      p.facing = ang;
      p.model.group.rotation.y = U.angleLerp(p.model.group.rotation.y, ang, Math.min(1, dt * 12));
    }
    p.model.A.moveAmt = U.damp(p.model.A.moveAmt, moving ? 1 : 0, 10, dt);

    // Auto-target: girar hacia enemigo cercano si quieto o atacando
    const tgt = nearestEnemy(p.pos, 14);
    p.target = tgt;
    if (tgt && (p.model.A.state === 'attack' || !moving)) {
      const want = U.angleTo(p.pos.x, p.pos.z, tgt.pos.x, tgt.pos.z);
      p.facing = want;
      p.model.group.rotation.y = U.angleLerp(p.model.group.rotation.y, want, Math.min(1, dt * (p.model.A.state === 'attack' ? 20 : 6)));
    }

    // Integrar
    const nx = p.pos.x + vx * dt, nz = p.pos.z + vz * dt;
    const half = Engine.worldSize / 2 - 3;
    p.pos.x = U.clamp(nx, -half, half);
    p.pos.z = U.clamp(nz, -half, half);
    const gy = Engine.groundY(p.pos.x, p.pos.z);
    p.pos.y = U.damp(p.pos.y, gy, 18, dt);

    // Polvo al correr
    if (moving && Math.random() < dt * 8) VFX.spawn(p.pos.x, gy + 0.1, p.pos.z, { color: '#d9c9a8', life: 0.5, size: 0.3, vy: 1, grav: -1, drag: 2 });

    /* Ataque básico */
    const atkInterval = 0.62 / (p.weaponDef.spd || 1);
    const wantAttack = Input.attack || (Save.data.settings.autoAttack && tgt && U.dist2(p.pos.x, p.pos.z, tgt.pos.x, tgt.pos.z) < attackRange(p));
    if (wantAttack && p.atkCd <= 0 && p.dodgeT <= 0) {
      doPlayerAttack(tgt);
      p.atkCd = atkInterval;
    }

    /* Dodge */
    if (Input.dodge) {
      Input.dodge = false;
      if (p.dodgeCd <= 0 && p.dodgeT <= 0) {
        p.dodgeT = 0.42; p.dodgeCd = 1.1; p.iframe = 0.34;
        AudioSys.sfx('dodge');
        VFX.burst(p.pos, 8, '#e2e8f0', { speed: 3, size: 0.3 });
      }
    }

    /* Habilidades */
    if (Input.skill1) { Input.skill1 = false; useSkill(1); }
    if (Input.skill2) { Input.skill2 = false; useSkill(2); }
    if (Input.ult) { Input.ult = false; useUlt(); }

    p.model.tick(dt);
  }

  function attackRange(p) {
    const t = p.weaponDef.type;
    if (t === 'arco' || t === 'baston') return 16;
    if (t === 'lanza') return 4.2;
    if (t === 'mandoble' || t === 'martillo') return 3.6;
    return 2.9;
  }

  function doPlayerAttack(tgt) {
    const p = player;
    p.atkStage = (p.atkStage + 1) % 3;
    const chainMult = [1, 1.05, 1.35][p.atkStage];
    p.model.play('attack', p.weaponDef.type);
    AudioSys.sfx('swing');
    const type = p.weaponDef.type;

    if (type === 'arco') {
      fireProjectile(p, { dmgMult: chainMult, element: p.element, speed: 26, color: '#fde68a', pierce: 1, aim: true });
    } else if (type === 'baston') {
      fireProjectile(p, { dmgMult: chainMult, element: p.element || 'fuego', speed: 18, color: DATA.ELEMENTS[p.element || 'fuego'].color, radius: 1.6, aim: true, effect: p.element === 'hielo' ? 'freeze' : p.element === 'fuego' ? 'burn' : null });
    } else {
      // Melee: arco frontal
      const range = attackRange(p);
      const arc = type === 'lanza' ? 0.6 : Math.PI * 0.75;
      let hitAny = false;
      for (const e of enemies.slice()) {
        const d = U.dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
        if (d > range + (e.radius || 0.5)) continue;
        const ang = Math.abs(angleDiff(p.facing, U.angleTo(p.pos.x, p.pos.z, e.pos.x, e.pos.z)));
        if (ang < arc) {
          dealDamage(e, p.atk * chainMult * p.atkMult, { element: p.element, crit: p.crit, byPlayer: true });
          knockback(e, p.facing, 2.4);
          hitAny = true;
        }
      }
      // Slash visual
      const slashCol = p.element && p.element !== 'fisico' ? DATA.ELEMENTS[p.element].color : '#fff7cc';
      VFX.ring({ x: p.pos.x + Math.sin(p.facing) * 1.2, y: p.pos.y, z: p.pos.z + Math.cos(p.facing) * 1.2 }, slashCol, 1.6, 0.22, 0.8);
      if (hitAny) Combat.hitStop(45);
    }
  }
  function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
  function knockback(e, ang, force) {
    if (e.type === 'boss') return;
    e.kb = { x: Math.sin(ang) * force, z: Math.cos(ang) * force, t: 0.18 };
  }

  function fireProjectile(from, opts = {}) {
    const p = from === player ? from : from;
    const isPlayer = from === player;
    const start = new THREE.Vector3(from.pos.x, from.pos.y + 1.2, from.pos.z);
    let dir;
    if (opts.dir) dir = opts.dir.clone();
    else {
      const tgt = opts.aim ? (player.target || nearestEnemy(from.pos, 20)) : null;
      const ang = tgt ? U.angleTo(from.pos.x, from.pos.z, tgt.pos.x, tgt.pos.z) : from.facing;
      dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      if (tgt) {
        const ty = (tgt.hitY || 0.8) + (tgt.h || 1) * 0.3;
        const dd = U.dist2(from.pos.x, from.pos.z, tgt.pos.x, tgt.pos.z);
        dir.y = (ty - (from.pos.y + 1.2)) / Math.max(1, dd);
        dir.normalize();
      }
    }
    const color = opts.color || '#fde68a';
    const mesh = new THREE.Mesh(
      opts.radius > 1 ? new THREE.SphereGeometry(opts.radius * 0.5, 8, 8) : new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(start);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(opts.radius > 1 ? 2 : 0.8);
    mesh.add(glow);
    scene.add(mesh);
    projectiles.push({
      mesh, pos: mesh.position,
      vel: dir.clone().multiplyScalar(opts.speed || 20),
      dmg: (isPlayer ? p.atk * (opts.dmgMult || 1) * p.atkMult : opts.dmg || 10),
      element: opts.element || 'fisico',
      fromPlayer: isPlayer, byPlayer: isPlayer,
      pierce: opts.pierce || 0,
      aoe: opts.radius > 1 ? opts.radius : 0,
      effect: opts.effect || null,
      life: opts.life || 2.2,
      homing: opts.homing || false,
      crit: isPlayer ? p.crit : 0,
      gravity: opts.gravity || 0,
      color
    });
    AudioSys.sfx(opts.sfx || 'shoot');
  }

  /* ---------- Habilidades ---------- */
  function useSkill(n) {
    const p = player;
    if (p.dead) return;
    const skillId = n === 1 ? p.hero.skill1 : p.hero.skill2;
    const sk = DATA.SKILLS[skillId];
    if (!sk) return;
    const cdKey = n === 1 ? 's1Cd' : 's2Cd';
    if (p[cdKey] > 0) { AudioSys.sfx('uiBack'); return; }
    p[cdKey] = sk.cd;
    p.model.play('cast');
    AudioSys.sfx(sk.element === 'hielo' ? 'ice' : sk.element === 'rayo' ? 'thunder' : sk.type === 'heal' ? 'heal' : 'fireball');

    switch (sk.type) {
      case 'aoe': {
        const r = sk.radius;
        VFX.ring(p.pos, DATA.ELEMENTS[sk.element].color, r, 0.55);
        VFX.burst(p.pos, 30, DATA.ELEMENTS[sk.element].color, { size: 0.5, speed: r * 1.4, up: 3 });
        VFX.shake(0.35);
        for (const e of enemies.slice()) {
          if (U.dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z) <= r + (e.radius || 0.5)) {
            dealDamage(e, p.atk * sk.dmgMult, { element: sk.element, crit: p.crit, effect: sk.effect });
            knockback(e, U.angleTo(p.pos.x, p.pos.z, e.pos.x, e.pos.z), 3);
          }
        }
        if (sk.shield) { p.shieldHp = p.maxHp * sk.shield; }
        if (sk.lifesteal) { const healed = Math.min(p.maxHp - p.hp, p.atk * 0.5); p.hp += healed; if (healed > 1) VFX.dmgNumber({ x: p.pos.x, y: 2, z: p.pos.z }, '+' + U.fmt(healed), 'heal'); }
        break;
      }
      case 'dash': {
        p.dodgeT = 0.3; p.iframe = 0.3;
        VFX.burst(p.pos, 14, '#e2e8f0', { speed: 4 });
        const tgt = p.target || nearestEnemy(p.pos, 12);
        if (tgt) {
          p.pos.x = tgt.pos.x - Math.sin(U.angleTo(p.pos.x, p.pos.z, tgt.pos.x, tgt.pos.z)) * 0.5;
          p.pos.z = tgt.pos.z - Math.cos(U.angleTo(p.pos.x, p.pos.z, tgt.pos.x, tgt.pos.z)) * 0.5;
        }
        for (const e of enemies.slice()) {
          if (U.dist2(p.pos.x, p.pos.z, e.pos.x, e.pos.z) < sk.dist * 0.5) dealDamage(e, p.atk * sk.dmgMult, { element: sk.element, crit: p.crit });
        }
        break;
      }
      case 'volley': {
        const baseAng = p.facing;
        for (let i = 0; i < sk.count; i++) {
          const spread = (i - (sk.count - 1) / 2) * 0.14;
          setTimeout(() => {
            if (!player || player.dead) return;
            fireProjectile(player, {
              dmgMult: sk.dmgMult, element: sk.element, speed: 30, color: '#fde68a', pierce: 2,
              dir: new THREE.Vector3(Math.sin(baseAng + spread), 0, Math.cos(baseAng + spread)), life: 1.2
            });
          }, i * 60);
        }
        break;
      }
      case 'projectile': {
        fireProjectile(p, { dmgMult: sk.dmgMult, element: sk.element, speed: 20, color: DATA.ELEMENTS[sk.element].color, effect: sk.effect, radius: 0.9, aoe: 2.2 });
        break;
      }
      case 'meteor': {
        const tgt = p.target || nearestEnemy(p.pos, 18);
        const land = tgt ? { x: tgt.pos.x, z: tgt.pos.z, y: tgt.pos.y } : { x: p.pos.x + Math.sin(p.facing) * 8, z: p.pos.z + Math.cos(p.facing) * 8, y: p.pos.y };
        const tg = VFX.telegraph(land, sk.radius, 1.0, '#fb923c');
        // roca cayendo
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), new THREE.MeshBasicMaterial({ color: '#f97316' }));
        rock.position.set(land.x, land.y + 26, land.z);
        scene.add(rock);
        let vy = -22;
        const fn = (dt) => {
          vy -= 30 * dt;
          rock.position.y += vy * dt;
          VFX.trail(rock.position, '#f97316', 0.8, 0.3);
          if (rock.position.y <= land.y + 0.5) {
            Engine.unregisterAnim(fn); scene.remove(rock);
            VFX.burst(land, 40, '#fb923c', { size: 0.6, speed: 7, up: 5 });
            VFX.ring(land, '#f97316', sk.radius, 0.5);
            VFX.shake(0.7); AudioSys.sfx('explosion');
            for (const e of enemies.slice()) {
              if (U.dist2(land.x, land.z, e.pos.x, e.pos.z) <= sk.radius) dealDamage(e, p.atk * sk.dmgMult, { element: 'fuego', crit: p.crit, effect: 'burn' });
            }
          }
        };
        Engine.registerAnim(fn);
        break;
      }
      case 'heal': {
        const healed = p.maxHp * sk.heal;
        p.hp = Math.min(p.maxHp, p.hp + healed);
        p.buffs.push({ kind: 'regen', amt: p.maxHp * 0.02, t: sk.regen });
        VFX.burst(p.pos, 22, '#fde68a', { size: 0.4, speed: 2, up: 5, grav: 2 });
        VFX.dmgNumber({ x: p.pos.x, y: 2.2, z: p.pos.z }, '+' + U.fmt(healed), 'heal');
        break;
      }
      case 'buff': {
        p.buffs.push({ kind: sk.stat, amt: sk.amt, t: sk.dur });
        VFX.ringBurst(p.pos, 20, '#fbbf24', 2);
        break;
      }
      case 'blink': {
        const tgt = p.target || nearestEnemy(p.pos, 14);
        if (tgt) {
          VFX.burst(p.pos, 14, '#c084fc', { speed: 3 });
          const ang = Math.random() * Math.PI * 2;
          p.pos.x = tgt.pos.x + Math.sin(ang) * 1.2; p.pos.z = tgt.pos.z + Math.cos(ang) * 1.2;
          p.facing = U.angleTo(p.pos.x, p.pos.z, tgt.pos.x, tgt.pos.z);
          p.model.group.rotation.y = p.facing;
          VFX.burst(p.pos, 18, '#c084fc', { speed: 4 });
          dealDamage(tgt, p.atk * sk.dmgMult, { element: sk.element, crit: Math.max(p.crit, 0.5) });
        }
        break;
      }
      case 'chain': {
        let from = { pos: { x: p.pos.x, y: p.pos.y + 1.2, z: p.pos.z } };
        let hits = []; let cur = nearestEnemy(p.pos, 12);
        for (let i = 0; i < sk.jumps && cur; i++) {
          VFX.beam(new THREE.Vector3(from.pos.x, from.pos.y, from.pos.z), new THREE.Vector3(cur.pos.x, cur.pos.y + 1, cur.pos.z), '#facc15', 0.22, 0.2);
          dealDamage(cur, p.atk * sk.dmgMult * Math.pow(0.85, i), { element: 'rayo', crit: p.crit });
          hits.push(cur);
          from = cur;
          cur = nearestEnemy(cur.pos, 9, hits);
        }
        AudioSys.sfx('thunder');
        break;
      }
      case 'summon': {
        for (let i = 0; i < sk.count; i++) {
          setTimeout(() => { if (player) summonAlly(p.pos); }, i * 150);
        }
        break;
      }
    }
    if (callbacks.onSkillUsed) callbacks.onSkillUsed(sk);
  }

  function useUlt() {
    const p = player;
    if (p.dead || p.energy < 100) { if (p.energy < 100) AudioSys.sfx('uiBack'); return; }
    p.energy = 0;
    const ult = DATA.ULTS[p.hero.ult];
    if (!ult) return;
    AudioSys.sfx('gachaRare');
    VFX.flash('#ffffff', 0.35, 300);
    VFX.shake(0.8);
    UI.ultBanner(p.hero.name, ult.name);
    p.model.play('cast');

    if (ult.type === 'aoe' || ult.type === 'swordrain') {
      const r = ult.radius || 8;
      const col = DATA.ELEMENTS[ult.element].color;
      VFX.telegraph(p.pos, r, 0.7, col);
      setTimeout(() => {
        if (!player) return;
        VFX.burst(player.pos, 60, col, { size: 0.7, speed: r, up: 6 });
        VFX.ring(player.pos, col, r, 0.8);
        if (ult.type === 'swordrain') {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2, rr = U.rand(r * 0.2, r);
            const sw = Models.weapon('espada', 'SSR', ult.element);
            sw.position.set(player.pos.x + Math.cos(a) * rr, player.pos.y + 14, player.pos.z + Math.sin(a) * rr);
            sw.rotation.z = Math.PI;
            scene.add(sw);
            let vy = -20;
            const fn = (dt) => { vy -= 40 * dt; sw.position.y += vy * dt; if (sw.position.y <= player.pos.y + 0.2) { scene.remove(sw); Engine.unregisterAnim(fn); } };
            Engine.registerAnim(fn);
          }
        }
        for (const e of enemies.slice()) {
          if (U.dist2(player.pos.x, player.pos.z, e.pos.x, e.pos.z) <= r + (e.radius || 0.5)) {
            let mult = ult.dmgMult;
            if (ult.execThreshold && e.hp < e.maxHp * ult.execThreshold) mult *= 4;
            dealDamage(e, player.atk * mult, { element: ult.element, crit: player.crit, effect: ult.effect || null, noCrit: ult.execThreshold != null });
          }
        }
        if (ult.heal) { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * ult.heal); }
      }, 650);
    } else if (ult.type === 'line') {
      const col = DATA.ELEMENTS[ult.element].color;
      for (let i = 1; i <= 14; i++) {
        const x = p.pos.x + Math.sin(p.facing) * i * 1.6, z = p.pos.z + Math.cos(p.facing) * i * 1.6;
        setTimeout(() => {
          if (!player) return;
          VFX.burst({ x, y: player.pos.y, z }, 10, col, { size: 0.6, speed: 3, up: 3 });
          for (const e of enemies.slice()) {
            if (U.dist2(x, z, e.pos.x, e.pos.z) < 2.4) dealDamage(e, player.atk * ult.dmgMult / 3, { element: ult.element, crit: player.crit, effect: 'burn' });
          }
        }, i * 40);
      }
    } else if (ult.type === 'arrowrain') {
      const col = DATA.ELEMENTS[ult.element].color;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 9;
        setTimeout(() => {
          if (!player) return;
          const x = player.pos.x + Math.cos(a) * rr, z = player.pos.z + Math.sin(a) * rr;
          VFX.beam(new THREE.Vector3(x, 16, z), new THREE.Vector3(x, Engine.groundY(x, z), z), col, 0.15, 0.2);
          VFX.burst({ x, y: Engine.groundY(x, z), z }, 6, col, { size: 0.4, speed: 2 });
          for (const e of enemies.slice()) {
            if (U.dist2(x, z, e.pos.x, e.pos.z) < 2.2) dealDamage(e, player.atk * ult.dmgMult / 5, { element: ult.element, crit: player.crit, effect: ult.effect });
          }
        }, 200 + i * 55);
      }
    } else if (ult.type === 'summon') {
      for (let i = 0; i < ult.count; i++) setTimeout(() => { if (player) summonAlly(player.pos); }, i * 120);
    }
    if (callbacks.onUltUsed) callbacks.onUlt(ult);
  }

  function summonAlly(pos) {
    const m = humanoidSkeleton(0.85);
    const a = Math.random() * Math.PI * 2;
    m.group.position.set(pos.x + Math.cos(a) * 2, Engine.groundY(pos.x, pos.z), pos.z + Math.sin(a) * 2);
    scene.add(m.group);
    const shadow = Engine.blobShadow(m.group, 1);
    summons.push({
      model: m, pos: m.group.position, h: 1.5, hitY: 0.8, radius: 0.5,
      hp: 150 + (player ? player.atk * 2 : 0), maxHp: 150 + (player ? player.atk * 2 : 0), def: 10,
      atk: player ? player.atk * 0.7 : 40, element: 'oscuridad',
      atkCd: 0, life: 20, dead: false, status: {}, shadow, color: '#e7e5e4', typeId: 'summon'
    });
    VFX.burst(m.group.position, 12, '#c084fc', { speed: 3 });
  }
  function humanoidSkeleton(scale) {
    return Models.character({
      scale, skin: '#e7e5e4', hair: '#e7e5e4', hairStyle: 'short', outfit: '#44403c', outfit2: '#292524', accent: '#22d3ee', cape: false
    });
  }

  /* ============================================================
     ENEMIGOS
     ============================================================ */
  function spawnEnemy(typeId, pos, opts = {}) {
    const def = DATA.ENEMIES[typeId];
    if (!def) return null;
    const g = Models.enemy(typeId);
    if (!g) return null;
    const charCtrl = g.userData.charCtrl || null;
    g.position.set(pos.x, Engine.groundY(pos.x, pos.z), pos.z);
    scene.add(g);

    const hpScale = opts.hpScale || 1, atkScale = opts.atkScale || 1;
    const e = {
      type: 'enemy', typeId,
      name: def.name, def: def.def, element: def.element,
      pos: g.position, h: 1.6 * def.scale, hitY: 0.7 * def.scale, radius: 0.55 * def.scale,
      model: {
        group: g,
        tick: (dt) => {
          if (charCtrl) { charCtrl.A.moveAmt = e.moveAmt || 0; charCtrl.tick(dt); }
          else if (g.userData.anim) g.userData.anim(Engine.clockT, e.moveAmt || 0);
        },
        play: (st, wt) => { if (charCtrl) charCtrl.play(st, wt); },
        hitFlash: () => { if (charCtrl) charCtrl.hitFlash(); }
      },
      hp: def.hp * hpScale, maxHp: def.hp * hpScale,
      atk: def.atk * atkScale,
      spd: def.spd, behavior: def.behavior, range: def.range,
      xp: def.xp, gold: def.gold, color: def.color,
      state: 'idle', stateT: 0, dead: false, status: {}, kb: null,
      moveAmt: 0, facing: Math.random() * Math.PI * 2,
      aggroR: opts.aggroR || 14, isElite: !!opts.elite,
      shadow: Engine.blobShadow(g, def.scale * 1.5)
    };
    if (opts.elite) {
      e.hp *= 2.6; e.maxHp *= 2.6; e.atk *= 1.5; e.gold *= 3; e.xp *= 3; e.name = 'Élite ' + e.name;
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#f43f5e', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      aura.scale.setScalar(2.4 * def.scale); aura.position.y = 0.8 * def.scale;
      g.add(aura);
    }
    e.hpBar = Models.hpBar(Math.max(0.9, def.scale * 0.9), '#f43f5e');
    e.hpBar.position.y = e.h + 0.55;
    g.add(e.hpBar);
    enemies.push(e);
    return e;
  }

  function nearestEnemy(pos, maxR = 999, exclude = []) {
    let best = null, bd = maxR;
    for (const e of enemies) {
      if (e.dead || exclude.includes(e)) continue;
      const d = U.dist2(pos.x, pos.z, e.pos.x, e.pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function enemyTargetPos(e) {
    if (objective === 'crystal' && crystalObj) {
      if (e.forceTarget === 'player' || (e.aggroPlayer && U.dist2(e.pos.x, e.pos.z, player.pos.x, player.pos.z) < 10)) {
        return player ? player.pos : crystalObj.pos;
      }
      // si el jugador está muy cerca, atácalo
      if (player && !player.dead && U.dist2(e.pos.x, e.pos.z, player.pos.x, player.pos.z) < 3.5) {
        e.aggroPlayer = true;
        return player.pos;
      }
      return crystalObj.pos;
    }
    return player && !player.dead ? player.pos : null;
  }

  function updateEnemies(dt) {
    for (const e of enemies.slice()) {
      if (e.dead) continue;
      e.stateT += dt;
      // status
      let spdMult = 1, canAct = true;
      for (const k in e.status) {
        const s = e.status[k];
        s.t -= dt;
        if (s.t <= 0) { delete e.status[k]; continue; }
        if (k === 'freeze' || k === 'stun' || k === 'root') { spdMult = k === 'root' ? 0 : 0; canAct = k !== 'stun' ? false : false; if (k === 'freeze') canAct = false; }
        if ((k === 'burn' || k === 'poison') && s) {
          s.next -= dt;
          if (s.next <= 0) { s.next = s.tick; dealDamage(e, s.dmg, { element: k === 'burn' ? 'fuego' : 'naturaleza', noCrit: true, byPlayer: true }); }
        }
      }
      // knockback
      if (e.kb) {
        e.kb.t -= dt;
        e.pos.x += e.kb.x * dt * 5; e.pos.z += e.kb.z * dt * 5;
        if (e.kb.t <= 0) e.kb = null;
      }
      if (e.dead) continue;

      const tpos = enemyTargetPos(e);
      if (!tpos) { e.moveAmt = U.damp(e.moveAmt, 0, 8, dt); if (e.model.group.userData.anim) e.model.group.userData.anim(Engine.clockT, 0); continue; }
      const dToT = U.dist2(e.pos.x, e.pos.z, tpos.x, tpos.z);
      const angToT = U.angleTo(e.pos.x, e.pos.z, tpos.x, tpos.z);

      if (e.state === 'idle') {
        if (dToT < e.aggroR) { e.state = 'chase'; e.stateT = 0; }
      } else if (e.state === 'chase') {
        if (!canAct) { e.moveAmt = U.damp(e.moveAmt, 0, 8, dt); }
        else {
          const stopDist = e.behavior === 'ranged' || e.behavior === 'caster' ? e.range * 0.75 : e.range;
          if (dToT > stopDist) {
            const sp = e.spd * spdMult;
            let mx = Math.sin(angToT) * sp, mz = Math.cos(angToT) * sp;
            // separación entre enemigos (evitar apilamiento)
            for (const o of enemies) {
              if (o === e || o.dead) continue;
              const d = U.dist2(e.pos.x, e.pos.z, o.pos.x, o.pos.z);
              if (d < 1.4 && d > 0.01) {
                const push = U.angleTo(o.pos.x, o.pos.z, e.pos.x, e.pos.z);
                mx += Math.sin(push) * sp * 0.5; mz += Math.cos(push) * sp * 0.5;
              }
            }
            e.pos.x += mx * dt; e.pos.z += mz * dt;
            e.facing = angToT;
            e.moveAmt = U.damp(e.moveAmt, 1, 8, dt);
          } else {
            e.moveAmt = U.damp(e.moveAmt, 0, 8, dt);
            e.facing = angToT;
            if (e.stateT > (e.attackDelay !== undefined ? e.attackDelay : 0.4)) {
              e.state = 'windup'; e.stateT = 0;
              e.windupDur = e.behavior === 'bomber' ? 0.6 : e.typeId === 'golem' ? 0.9 : 0.55;
              if (e.behavior === 'bomber') VFX.telegraph(e.pos, 3.2, e.windupDur, '#ef4444');
              else if (e.behavior === 'melee' || e.behavior === 'charger') VFX.telegraph({ x: e.pos.x + Math.sin(angToT) * 1.4, y: e.pos.y, z: e.pos.z + Math.cos(angToT) * 1.4 }, 1.4, e.windupDur, '#f97316');
            }
          }
          // a veces re-targetea al jugador si lo pisa
          if (objective === 'crystal' && player && !player.dead && dToT > e.range && U.dist2(e.pos.x, e.pos.z, player.pos.x, player.pos.z) < 2.5) e.aggroPlayer = true;
          if (e.behavior === 'phaser' && dToT > 6 && U.chance(dt * 0.25)) {
            VFX.burst(e.pos, 10, '#a78bfa', { speed: 2 });
            const ta = Math.random() * Math.PI * 2;
            e.pos.x = tpos.x + Math.sin(ta) * 2.5; e.pos.z = tpos.z + Math.cos(ta) * 2.5;
            VFX.burst(e.pos, 10, '#a78bfa', { speed: 2 });
          }
        }
      } else if (e.state === 'windup') {
        e.moveAmt = U.damp(e.moveAmt, 0, 12, dt);
        e.facing = angToT;
        if (e.stateT >= e.windupDur) {
          if (e.model.play) e.model.play('attack', e.behavior === 'ranged' ? 'arco' : 'espada');
          enemyAttack(e, tpos, dToT, angToT); e.state = 'recover'; e.stateT = 0; e.recoverDur = 0.55;
        }
      } else if (e.state === 'recover') {
        if (e.stateT >= e.recoverDur) { e.state = 'chase'; e.stateT = 0; }
      }
      e.model.group.rotation.y = U.angleLerp(e.model.group.rotation.y, e.facing, Math.min(1, dt * 8));
      const gy = Engine.groundY(e.pos.x, e.pos.z);
      e.pos.y = U.damp(e.pos.y, gy, 14, dt);
      if (e.model.group.userData.anim) e.model.group.userData.anim(Engine.clockT, e.moveAmt);
      // barra de vida
      if (e.hpBar) {
        const r = Math.max(0, e.hp / e.maxHp);
        e.hpBar.userData.fg.scale.x = (e.hpBar.userData.width) * r;
        e.hpBar.visible = r < 1 || e.isElite;
      }
    }
  }

  function enemyAttack(e, tpos, dist, ang) {
    const isCrystal = tpos === (crystalObj && crystalObj.pos);
    switch (e.behavior) {
      case 'melee': case 'charger': {
        if (e.behavior === 'charger' && dist > 3) {
          // embestida
          e.kb = { x: Math.sin(ang) * 8, z: Math.cos(ang) * 8, t: 0.3 };
        }
        if (dist <= e.range + 1.2) {
          if (isCrystal) damageCrystal(e.atk);
          else if (player && !player.dead && U.dist2(e.pos.x, e.pos.z, player.pos.x, player.pos.z) <= e.range + 1.2) damagePlayer(e.atk, e);
        }
        VFX.ring({ x: e.pos.x + Math.sin(ang) * 1.2, y: e.pos.y, z: e.pos.z + Math.cos(ang) * 1.2 }, '#f87171', 1.2, 0.3);
        break;
      }
      case 'ranged': {
        fireProjectile(e, {
          dmg: e.atk, speed: 14, color: '#a3e635', dir: new THREE.Vector3(Math.sin(ang), 0.02, Math.cos(ang)).normalize(),
          life: 2.5, sfx: 'shoot', fromEnemy: true, gravity: 3
        });
        break;
      }
      case 'caster': {
        fireProjectile(e, {
          dmg: e.atk, speed: 10, color: e.typeId === 'dragoncito' ? '#fb923c' : '#a855f7', radius: 1.2,
          dir: new THREE.Vector3(Math.sin(ang), (1.0) / Math.max(4, dist), Math.cos(ang)).normalize(),
          life: 3, sfx: 'fireball', fromEnemy: true, element: e.typeId === 'dragoncito' ? 'fuego' : 'oscuridad'
        });
        break;
      }
      case 'bomber': {
        // explota
        VFX.burst(e.pos, 30, '#fb923c', { size: 0.6, speed: 6, up: 4 });
        VFX.ring(e.pos, '#ef4444', 3.2, 0.5);
        VFX.shake(0.5); AudioSys.sfx('explosion');
        if (U.dist2(e.pos.x, e.pos.z, player.pos.x, player.pos.z) < 3.4) damagePlayer(e.atk, e);
        damageCrystalIfNear(e, 3.4, e.atk);
        e.hp = 0; killTarget(e, true);
        break;
      }
    }
  }
  function damageCrystalIfNear(e, radius, atk) {
    if (crystalObj && U.dist2(e.pos.x, e.pos.z, crystalObj.pos.x, crystalObj.pos.z) < radius + 2) damageCrystal(atk);
  }

  /* ---------- Daño al jugador / cristal ---------- */
  function damagePlayer(rawAtk, source) {
    const p = player;
    if (!p || p.dead || p.iframe > 0) return;
    const defMult = 100 / (100 + p.def);
    let dmg = rawAtk * defMult * U.rand(0.9, 1.1);
    if (p.shieldHp > 0) {
      const absorbed = Math.min(p.shieldHp, dmg);
      p.shieldHp -= absorbed; dmg -= absorbed;
      VFX.dmgNumber({ x: p.pos.x, y: 2.2, z: p.pos.z }, '🛡', 'info');
    }
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.energy = Math.min(100, p.energy + dmg / Math.max(20, p.maxHp) * 40);
    if (Save.data.settings.dmgNumbers) VFX.dmgNumber({ x: p.pos.x, y: 2, z: p.pos.z }, '-' + U.fmt(dmg), 'player-hit');
    p.model.hitFlash();
    VFX.shake(0.3); U.vibrate(30);
    AudioSys.sfx('hit');
    VFX.flash('#ef4444', 0.18, 250);
    comboCount = 0;
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true;
      p.model.play('dead');
      AudioSys.sfx('fail');
      if (callbacks.onPlayerDeath) callbacks.onPlayerDeath();
    }
  }
  function damageCrystal(atk) {
    if (!crystalObj) return;
    crystalObj.hp -= atk;
    VFX.burst(crystalObj.pos, 8, '#22d3ee', { speed: 3 });
    VFX.shake(0.2);
    if (crystalObj.hp <= 0) {
      crystalObj.hp = 0;
      if (callbacks.onCrystalDestroyed) callbacks.onCrystalDestroyed();
    }
  }

  function placeCrystal(pos) {
    const g = Models.baseCrystal();
    g.position.copy(pos);
    scene.add(g);
    Engine.registerAnim((t) => { if (g.userData.anim) g.userData.anim(t); });
    crystalObj = { group: g, pos: g.position, hp: 1000, maxHp: 1000 };
    return crystalObj;
  }

  /* ============================================================
     JEFES
     ============================================================ */
  function spawnBoss(bossId, pos, opts = {}) {
    const B = DATA.BOSSES[bossId];
    if (!B) return null;
    const e = spawnEnemy(B.base, pos, Object.assign({ hpScale: B.hpMult, atkScale: B.atkMult, elite: false }, opts));
    if (!e) return null;
    e.type = 'boss'; e.bossId = bossId;
    e.name = B.name; e.element = B.element;
    e.model.group.scale.setScalar(B.scale);
    e.h = 1.6 * B.scale; e.hitY = 0.7 * B.scale; e.radius = 0.55 * B.scale;
    e.hpBar.parent && e.hpBar.parent.remove(e.hpBar);
    e.hpBar = null; // el HUD dibuja la barra del jefe
    e.aggroR = 999; e.state = 'chase';
    e.patterns = B.patterns.slice(); e.patternIdx = 0; e.phase = 1;
    e.attackDelay = 0.8; e.windupDur = 1.0; e.recoverDur = 1.0;
    e.gold = 220; e.xp = 300; e.color = DATA.ELEMENTS[B.element].color;
    Models.bossDecor(e.model.group, bossId);
    AudioSys.sfx('bossRoar');
    VFX.shake(1.0);
    UI.bossIntro(B);
    return e;
  }

  function bossAI(e, dt) {
    // fases por vida
    const r = e.hp / e.maxHp;
    if (e.phase === 1 && r < 0.7) { e.phase = 2; enrageBoss(e, 1.15); }
    else if (e.phase === 2 && r < 0.4) { e.phase = 3; enrageBoss(e, 1.3); }
    if (e.state === 'windup') {
      // el ataque del jefe se decide al entrar en windup (ver más abajo)
    }
  }
  function enrageBoss(e, mult) {
    e.atk *= mult; e.spd *= 1.15;
    e.attackDelay = Math.max(0.25, e.attackDelay / 1.3);
    VFX.burst(e.pos, 40, '#ef4444', { size: 0.7, speed: 6, up: 5 });
    VFX.flash('#ef4444', 0.4, 400);
    UI.toast('¡El jefe se enfurece!');
    AudioSys.sfx('bossRoar');
  }

  function bossAttack(e, tpos, dist, ang) {
    const pattern = e.patterns[e.patternIdx % e.patterns.length];
    e.patternIdx++;
    const p = player;
    switch (pattern) {
      case 'slam': {
        VFX.telegraph(e.pos, 6, 0.9, '#f97316');
        setTimeout(() => {
          if (e.dead || !p) return;
          VFX.ring(e.pos, '#f97316', 6, 0.6); VFX.shake(0.9); AudioSys.sfx('explosion');
          if (U.dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < 6.5) damagePlayer(e.atk * 1.6, e);
          damageCrystalIfNear(e, 6.5, e.atk * 1.6);
        }, 900);
        break;
      }
      case 'charge': {
        e.kb = { x: Math.sin(ang) * 14, z: Math.cos(ang) * 14, t: 0.55 };
        setTimeout(() => {
          if (e.dead || !p) return;
          if (U.dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < 3) damagePlayer(e.atk * 1.4, e);
        }, 550);
        break;
      }
      case 'throw': case 'boulder': {
        for (let i = -1; i <= 1; i++) {
          fireProjectile(e, {
            dmg: e.atk, speed: 12, color: pattern === 'boulder' ? '#a8a29e' : '#a3e635', radius: pattern === 'boulder' ? 1.4 : 0,
            dir: new THREE.Vector3(Math.sin(ang + i * 0.35), 0.15, Math.cos(ang + i * 0.35)).normalize(),
            life: 3, sfx: 'shoot', fromEnemy: true
          });
        }
        break;
      }
      case 'summon': {
        const pool = ['goblin', 'esqueleto', 'slime_azul', 'espectro'];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          spawnEnemy(U.pick(pool), { x: e.pos.x + Math.cos(a) * 4, z: e.pos.z + Math.sin(a) * 4 }, { hpScale: 3, atkScale: 2 });
        }
        UI.toast('¡El jefe invoca refuerzos!');
        break;
      }
      case 'split': {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          spawnEnemy('slime', { x: e.pos.x + Math.cos(a) * 3, z: e.pos.z + Math.sin(a) * 3 }, { hpScale: 3 });
        }
        break;
      }
      case 'bounce': {
        e.kb = { x: Math.sin(ang) * 10, z: Math.cos(ang) * 10, t: 0.4 };
        break;
      }
      case 'quake': {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            if (e.dead || !p) return;
            const a = Math.random() * Math.PI * 2, rr = 3 + i * 2;
            const x = e.pos.x + Math.cos(a) * rr, z = e.pos.z + Math.sin(a) * rr;
            VFX.telegraph({ x, y: Engine.groundY(x, z), z }, 2.4, 0.7, '#f97316');
            setTimeout(() => {
              if (e.dead || !p) return;
              VFX.burst({ x, y: Engine.groundY(x, z), z }, 12, '#f97316', { speed: 3 });
              if (U.dist2(p.pos.x, p.pos.z, x, z) < 2.6) damagePlayer(e.atk, e);
            }, 700);
          }, i * 180);
        }
        break;
      }
      case 'blizzard': case 'icicle': {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
          fireProjectile(e, {
            dmg: e.atk * 0.8, speed: 9, color: '#7dd3fc',
            dir: new THREE.Vector3(Math.sin(a), 0.05, Math.cos(a)).normalize(),
            life: 3, sfx: 'ice', fromEnemy: true, element: 'hielo'
          });
        }
        break;
      }
      case 'firebreath': {
        for (let i = 0; i < 12; i++) {
          setTimeout(() => {
            if (e.dead || !p) return;
            const a2 = ang + U.rand(-0.3, 0.3);
            fireProjectile(e, {
              dmg: e.atk * 0.45, speed: 13, color: '#fb923c', radius: 0.8,
              dir: new THREE.Vector3(Math.sin(a2), 0.03, Math.cos(a2)).normalize(),
              life: 1.4, sfx: 'fireball', fromEnemy: true, element: 'fuego'
            });
          }, i * 80);
        }
        break;
      }
      case 'swoop': {
        e.kb = { x: Math.sin(ang) * 16, z: Math.cos(ang) * 16, t: 0.5 };
        break;
      }
      case 'meteor': {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2, rr = U.rand(2, 9);
          const x = p ? p.pos.x + Math.cos(a) * rr : e.pos.x, z = p ? p.pos.z + Math.sin(a) * rr : e.pos.z;
          const y = Engine.groundY(x, z);
          VFX.telegraph({ x, y, z }, 2.6, 1.1, '#fb923c');
          setTimeout(() => {
            if (e.dead) return;
            VFX.burst({ x, y, z }, 18, '#fb923c', { size: 0.6, speed: 4, up: 4 });
            AudioSys.sfx('explosion');
            if (p && U.dist2(p.pos.x, p.pos.z, x, z) < 2.8) damagePlayer(e.atk, e);
          }, 1100);
        }
        break;
      }
      case 'voidzone': {
        const a = Math.random() * Math.PI * 2;
        const x = p ? p.pos.x : e.pos.x, z = p ? p.pos.z : e.pos.z;
        const y = Engine.groundY(x, z);
        const zone = VFX.telegraph({ x, y, z }, 4.5, 4, '#a855f7');
        // daño por permanecer
        let ticks = 8;
        const fn = () => {
          if (e.dead || !p) { Engine.unregisterAnim(fnFn); return; }
          if (U.dist2(p.pos.x, p.pos.z, x, z) < 4.5) damagePlayer(e.atk * 0.3, e);
          if (--ticks <= 0) Engine.unregisterAnim(fnFn);
        };
        const fnFn = (dt) => { fnTimer -= dt; if (fnTimer <= 0) { fnTimer = 0.5; fn(); } };
        let fnTimer = 0.5;
        Engine.registerAnim(fnFn);
        break;
      }
      case 'beam': {
        // rayo barrido hacia el jugador
        const from = new THREE.Vector3(e.pos.x, e.pos.y + e.h * 0.6, e.pos.z);
        VFX.beam(from, new THREE.Vector3(tpos.x, tpos.y + 1, tpos.z), '#c084fc', 0.8, 0.6);
        if (p && U.dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < dist + 2 && Math.abs(angleDiff(ang, U.angleTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z))) < 0.3) damagePlayer(e.atk * 1.3, e);
        AudioSys.sfx('thunder');
        break;
      }
      case 'enrage': {
        enrageBoss(e, 1.2);
        e.patterns = e.patterns.filter(pp => pp !== 'enrage');
        break;
      }
    }
  }

  /* ============================================================
     ACTUALIZACIÓN DE PROYECTILES
     ============================================================ */
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;
      if (pr.gravity) pr.vel.y -= pr.gravity * dt;
      if (pr.homing && pr.fromPlayer) {
        const t = nearestEnemy(pr.pos, 8);
        if (t) {
          const want = new THREE.Vector3(t.pos.x - pr.pos.x, (t.pos.y + 0.8) - pr.pos.y, t.pos.z - pr.pos.z).normalize().multiplyScalar(pr.vel.length());
          pr.vel.lerp(want, Math.min(1, dt * 4));
        }
      }
      pr.pos.x += pr.vel.x * dt; pr.pos.y += pr.vel.y * dt; pr.pos.z += pr.vel.z * dt;
      VFX.trail(pr.pos, pr.color, pr.aoe ? 0.5 : 0.22, 0.25);
      let hitSomething = false;
      const gy = Engine.groundY(pr.pos.x, pr.pos.z);
      if (pr.pos.y <= gy + 0.1) hitSomething = true;

      if (pr.fromPlayer) {
        for (const e of enemies.slice()) {
          if (e.dead) continue;
          const d = Math.hypot(pr.pos.x - e.pos.x, (pr.pos.y - (e.pos.y + e.hitY)) * 0.7, pr.pos.z - e.pos.z);
          if (d < (e.radius || 0.5) + 0.35 + (pr.aoe ? pr.aoe * 0.3 : 0)) {
            hitSomething = true;
            if (pr.aoe) {
              VFX.burst(pr.pos, 20, pr.color, { size: 0.5, speed: pr.aoe * 2, up: 3 });
              VFX.ring({ x: pr.pos.x, y: gy, z: pr.pos.z }, pr.color, pr.aoe, 0.4);
              AudioSys.sfx('explosion');
              for (const e2 of enemies.slice()) {
                if (U.dist2(pr.pos.x, pr.pos.z, e2.pos.x, e2.pos.z) <= pr.aoe) dealDamage(e2, pr.dmg, { element: pr.element, crit: pr.crit, effect: pr.effect });
              }
            } else {
              dealDamage(e, pr.dmg, { element: pr.element, crit: pr.crit, effect: pr.effect });
              knockback(e, Math.atan2(pr.vel.x, pr.vel.z), 1.5);
            }
            break;
          }
        }
      } else {
        // proyectil enemigo → jugador o cristal
        if (player && !player.dead) {
          const d = Math.hypot(pr.pos.x - player.pos.x, (pr.pos.y - (player.pos.y + 1)) * 0.7, pr.pos.z - player.pos.z);
          if (d < 0.95) { damagePlayer(pr.dmg, null); hitSomething = true; }
        }
        if (!hitSomething && crystalObj) {
          const d = U.dist2(pr.pos.x, pr.pos.z, crystalObj.pos.x, crystalObj.pos.z);
          if (d < 2.2 && pr.pos.y < 3) { damageCrystal(pr.dmg); hitSomething = true; }
        }
      }

      if (hitSomething || pr.life <= 0) {
        if (pr.aoe && hitSomething && !pr.fromPlayer) {
          VFX.burst(pr.pos, 16, pr.color, { size: 0.5, speed: 4 });
        }
        scene.remove(pr.mesh);
        pr.mesh.geometry.dispose();
        projectiles.splice(i, 1);
      }
    }
  }

  /* ---------- Invocaciones aliadas ---------- */
  function updateSummons(dt) {
    for (let i = summons.length - 1; i >= 0; i--) {
      const s = summons[i];
      s.life -= dt;
      if (s.life <= 0 || s.hp <= 0 || s.dead) {
        VFX.burst(s.pos, 10, '#c084fc', { speed: 2 });
        Engine.removeBlobShadow(s.shadow);
        scene.remove(s.model.group);
        summons.splice(i, 1);
        continue;
      }
      s.atkCd = Math.max(0, s.atkCd - dt);
      const tgt = nearestEnemy(s.pos, 12);
      let moving = false;
      if (tgt) {
        const d = U.dist2(s.pos.x, s.pos.z, tgt.pos.x, tgt.pos.z);
        const ang = U.angleTo(s.pos.x, s.pos.z, tgt.pos.x, tgt.pos.z);
        if (d > 1.6) {
          s.pos.x += Math.sin(ang) * 5.5 * dt; s.pos.z += Math.cos(ang) * 5.5 * dt;
          moving = true;
        } else if (s.atkCd <= 0) {
          s.atkCd = 0.8;
          s.model.play('attack', 'espada');
          dealDamage(tgt, s.atk, { element: 'oscuridad', crit: 0.05 });
        }
        s.model.group.rotation.y = U.angleLerp(s.model.group.rotation.y, ang, Math.min(1, dt * 8));
      }
      s.model.A.moveAmt = U.damp(s.model.A.moveAmt, moving ? 1 : 0, 10, dt);
      s.pos.y = U.damp(s.pos.y, Engine.groundY(s.pos.x, s.pos.z), 14, dt);
      if (s.life < 3) s.model.group.scale.setScalar(Math.max(0.3, s.life / 3));
      s.model.tick(dt);
    }
  }

  /* ---------- Update maestro ---------- */
  let hitStopT = 0;
  function hitStop(ms) { hitStopT = Math.max(hitStopT, ms / 1000); }
  function update(dt) {
    if (hitStopT > 0) { hitStopT -= dt; dt = dt * 0.12; }
    comboTimer -= dt;
    if (comboTimer <= 0 && comboCount > 0) { comboCount = 0; }
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateSummons(dt);
    updateLoot(dt);
    for (const e of enemies) if (e.type === 'boss') bossAI(e, dt);
  }

  /* Enemigos usan bossAttack cuando son jefes */
  const _origEnemyAttack = enemyAttack;
  enemyAttack = function (e, tpos, dist, ang) {
    if (e.type === 'boss') { bossAttack(e, tpos, dist, ang); return; }
    _origEnemyAttack(e, tpos, dist, ang);
  };

  return {
    reset, update, createPlayer, playerStats, spawnEnemy, spawnBoss, nearestEnemy,
    dealDamage, damagePlayer, placeCrystal, dropLoot, fireProjectile,
    hitStop,
    setObjective(o) { objective = o; },
    get enemies() { return enemies; }, get projectiles() { return projectiles; },
    get crystal() { return crystalObj; }, get player() { return player; },
    get combo() { return comboCount; }, get bestCombo() { return bestCombo; },
    get killCount() { return killCount; },
    get boss() { return enemies.find(e => e.type === 'boss'); },
    humanoidSkeleton
  };
})();
