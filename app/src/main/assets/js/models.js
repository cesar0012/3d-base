/* ============================================================
   AETHERIA — models.js
   Sistema de personajes toon-anime articulados (cel shading),
   enemigos, jefes, armas y props del mundo. 100% procedural.
   ============================================================ */
'use strict';

const Models = (() => {

  /* ---------- Cargador de texturas empaquetadas (CC0 ambientCG) ---------- */
  const texLoader = new THREE.TextureLoader();
  const texCache = {};
  function tex(name) {
    if (texCache[name]) return texCache[name];
    const t = texLoader.load('textures/' + name + '.jpg');
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    texCache[name] = t;
    return t;
  }

  /* ---------- Toon gradient maps ---------- */
  const gradCache = {};
  function gradientMap(steps = 3) {
    if (gradCache[steps]) return gradCache[steps];
    const data = new Uint8Array(steps);
    for (let i = 0; i < steps; i++) data[i] = Math.floor(80 + (175 * i) / (steps - 1));
    const tex = new THREE.DataTexture(data, steps, 1, THREE.LuminanceFormat);
    tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    gradCache[steps] = tex;
    return tex;
  }

  const matCache = {};
  function toonMat(color, opts = {}) {
    const key = color + '|' + (opts.steps || 3) + '|' + (opts.transparent ? 't' : '') + (opts.emissive || '');
    if (!opts.noCache && matCache[key]) return matCache[key];
    const p = {
      color,
      gradientMap: gradientMap(opts.steps || 3)
    };
    if (opts.transparent) { p.transparent = true; p.opacity = opts.opacity !== undefined ? opts.opacity : 0.8; }
    if (opts.emissive) { p.emissive = new THREE.Color(opts.emissive); p.emissiveIntensity = opts.emissiveIntensity || 0.6; }
    const m = new THREE.MeshToonMaterial(p);
    if (!opts.noCache) matCache[key] = m;
    return m;
  }
  function basicMat(color, opts = {}) {
    return new THREE.MeshBasicMaterial(Object.assign({ color }, opts));
  }

  /* ---------- Geometrías base ---------- */
  function capsule(r, h, mat, seg = 8) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
    const top = new THREE.Mesh(new THREE.SphereGeometry(r, seg, 6), mat); top.position.y = h / 2;
    const bot = new THREE.Mesh(new THREE.SphereGeometry(r, seg, 6), mat); bot.position.y = -h / 2;
    g.add(cyl, top, bot);
    return g;
  }
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function sphere(r, mat, w = 10, h = 8) { return new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat); }
  function cone(r, h, mat, seg = 8) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); }
  function cyl(rt, rb, h, mat, seg = 8) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

  /* Outline por casco invertido */
  function addOutline(mesh, scale = 1.06, opacity = 0.9) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x0b0e1a, side: THREE.BackSide, transparent: true, opacity });
    const out = new THREE.Mesh(mesh.geometry, mat);
    out.scale.setScalar(scale);
    out.renderOrder = 1;
    mesh.add(out);
    return out;
  }

  /* ---------- Cara anime (textura canvas) ---------- */
  const faceCache = {};
  function faceTexture(skin, eyeColor, style = 'hero', emotion = 'normal') {
    const key = skin + eyeColor + style + emotion;
    if (faceCache[key]) return faceCache[key];
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 128, 128);
    // Mejillas
    x.fillStyle = 'rgba(255,120,140,0.25)';
    x.beginPath(); x.ellipse(30, 78, 11, 7, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(98, 78, 11, 7, 0, 0, 7); x.fill();
    const eyeH = emotion === 'angry' ? 16 : 22;
    for (const ex of [32, 96]) {
      // Blanco del ojo
      x.fillStyle = '#ffffff';
      x.beginPath(); x.ellipse(ex, 62, 13, eyeH, 0, 0, 7); x.fill();
      // Iris
      const grad = x.createLinearGradient(ex, 40, ex, 84);
      grad.addColorStop(0, eyeColor); grad.addColorStop(1, '#1e293b');
      x.fillStyle = grad;
      x.beginPath(); x.ellipse(ex, 64, 9.5, emotion === 'angry' ? 13 : 15, 0, 0, 7); x.fill();
      // Brillos
      x.fillStyle = '#ffffff';
      x.beginPath(); x.ellipse(ex - 3.5, 58, 3.4, 4.2, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(ex + 4, 70, 1.8, 2.2, 0, 0, 7); x.fill();
    }
    // Cejas
    x.strokeStyle = 'rgba(30,30,50,0.85)'; x.lineWidth = 3.5; x.lineCap = 'round';
    const browY = emotion === 'angry' ? 36 : 34;
    x.beginPath(); x.moveTo(22, browY + (emotion === 'angry' ? 5 : 0)); x.quadraticCurveTo(32, browY - 5, 42, browY + (emotion === 'angry' ? 6 : 1)); x.stroke();
    x.beginPath(); x.moveTo(86, browY + (emotion === 'angry' ? 6 : 1)); x.quadraticCurveTo(96, browY - 5, 106, browY + (emotion === 'angry' ? 5 : 0)); x.stroke();
    // Boca
    x.strokeStyle = '#7f1d1d'; x.lineWidth = 3;
    if (emotion === 'angry') { x.fillStyle = '#7f1d1d'; x.beginPath(); x.ellipse(64, 96, 8, 5, 0, 0, 7); x.fill(); }
    else { x.beginPath(); x.moveTo(56, 94); x.quadraticCurveTo(64, 102, 72, 94); x.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 2;
    faceCache[key] = tex;
    return tex;
  }
  function facePlane(skin, eyeColor, style, emotion, w = 0.5) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.85),
      new THREE.MeshBasicMaterial({ map: faceTexture(skin, eyeColor, style, emotion), transparent: true, depthWrite: false })
    );
    m.renderOrder = 5;
    return m;
  }

  /* ---------- Peinados ---------- */
  function buildHair(style, colorHex, s) {
    const g = new THREE.Group();
    const mat = toonMat(colorHex);
    const dark = toonMat(shade(colorHex, -25));
    if (style === 'spiky') {
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.8 + (i / 6) * Math.PI * 0.6;
        const spk = cone(0.09 * s, 0.34 * s, mat, 5);
        spk.position.set(Math.sin(a) * 0.2 * s, 0.16 * s + Math.abs(Math.cos(a)) * 0.08 * s, -0.02 * s);
        spk.rotation.z = -a * 0.5;
        g.add(spk);
      }
      const cap = sphere(0.31 * s, mat, 10, 8); cap.scale.set(1, 0.72, 1); cap.position.y = 0.06 * s; g.add(cap);
    } else if (style === 'ponytail') {
      const cap = sphere(0.31 * s, mat, 10, 8); cap.scale.set(1, 0.8, 1); cap.position.y = 0.05 * s; g.add(cap);
      const fringe = sphere(0.16 * s, dark, 8, 6); fringe.scale.set(1.5, 0.6, 0.8); fringe.position.set(0, 0.12 * s, 0.2 * s); g.add(fringe);
      const tail = capsule(0.09 * s, 0.42 * s, mat); tail.rotation.x = 0.5; tail.position.set(0, -0.05 * s, -0.3 * s); g.add(tail);
      const tie = cyl(0.1 * s, 0.1 * s, 0.06 * s, dark); tie.rotation.x = 0.5; tie.position.set(0, 0.06 * s, -0.26 * s); g.add(tie);
    } else if (style === 'long') {
      const cap = sphere(0.32 * s, mat, 10, 8); cap.scale.set(1, 0.82, 1); cap.position.y = 0.05 * s; g.add(cap);
      const back = capsule(0.22 * s, 0.55 * s, mat, 10); back.scale.set(1, 1, 0.55); back.position.set(0, -0.28 * s, -0.12 * s); g.add(back);
      for (const side of [-1, 1]) {
        const strand = capsule(0.08 * s, 0.4 * s, mat); strand.position.set(side * 0.26 * s, -0.12 * s, 0.1 * s); g.add(strand);
      }
      const fringe = sphere(0.18 * s, dark, 8, 6); fringe.scale.set(1.4, 0.55, 0.7); fringe.position.set(0.02 * s, 0.14 * s, 0.22 * s); g.add(fringe);
    } else if (style === 'short') {
      const cap = sphere(0.315 * s, mat, 10, 8); cap.scale.set(1, 0.78, 1); cap.position.y = 0.05 * s; g.add(cap);
      const fringe = sphere(0.15 * s, dark, 8, 6); fringe.scale.set(1.5, 0.5, 0.8); fringe.position.set(0, 0.14 * s, 0.2 * s); g.add(fringe);
    } else if (style === 'hood') {
      const h = cone(0.34 * s, 0.5 * s, mat, 8); h.position.y = 0.1 * s; g.add(h);
      const rim = cyl(0.34 * s, 0.3 * s, 0.1 * s, dark); rim.position.y = -0.08 * s; g.add(rim);
    }
    return g;
  }

  function shade(hex, amt) {
    const c = new THREE.Color(hex);
    const hsl = {}; c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, U.clamp(hsl.l + amt / 100, 0, 1));
    return '#' + c.getHexString();
  }
  function complement(hex) { return '#' + new THREE.Color(hex).offsetHSL(0.5, 0, 0).getHexString(); }

  /* ============================================================
     PERSONAJE HÉROE (articulado, anime)
     ============================================================ */
  function character(cfg = {}) {
    const s = cfg.scale || 1.0;
    const skin = cfg.skin || '#ffdbac';
    const outfit = cfg.outfit || '#2563eb';
    const outfit2 = cfg.outfit2 || '#1e3a8a';
    const accent = cfg.accent || '#fbbf24';
    const hairStyle = cfg.hairStyle || 'short';
    const hairColor = cfg.hair || '#3f3f46';

    const skinM = toonMat(skin);
    const outM = toonMat(outfit);
    const out2M = toonMat(outfit2);
    const accM = toonMat(accent);
    const bootM = toonMat('#292524');

    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body); // para bob/lean

    // Torso
    const torso = cyl(0.17 * s, 0.23 * s, 0.52 * s, outM, 10);
    torso.position.y = 0.92 * s;
    body.add(torso);
    const belt = cyl(0.235 * s, 0.235 * s, 0.07 * s, accM, 10);
    belt.position.y = 0.68 * s; body.add(belt);
    const chestPlate = sphere(0.2 * s, out2M, 10, 8);
    chestPlate.scale.set(1.05, 0.7, 0.85); chestPlate.position.y = 1.05 * s; body.add(chestPlate);
    addOutline(torso, 1.05); addOutline(chestPlate, 1.04);
    // Hombreras
    for (const side of [-1, 1]) {
      const pad = sphere(0.11 * s, out2M, 8, 6);
      pad.position.set(side * 0.25 * s, 1.12 * s, 0);
      body.add(pad); addOutline(pad, 1.08);
    }

    // Cabeza
    const headG = new THREE.Group(); headG.position.y = 1.32 * s; body.add(headG);
    const head = sphere(0.26 * s, skinM, 12, 10); headG.add(head); addOutline(head, 1.045);
    const face = facePlane(skin, accent, 'hero', 'normal', 0.34 * s);
    face.position.set(0, -0.01 * s, 0.245 * s); headG.add(face);
    const hair = buildHair(hairStyle, hairColor, s); hair.position.y = 0.1 * s; headG.add(hair);

    // Brazos (pivote en hombro)
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.27 * s, 1.1 * s, 0);
      body.add(shoulder);
      const sleeve = capsule(0.07 * s, 0.3 * s, out2M); sleeve.position.y = -0.15 * s; shoulder.add(sleeve);
      const arm = capsule(0.055 * s, 0.26 * s, skinM); arm.position.y = -0.42 * s; shoulder.add(arm);
      const hand = sphere(0.065 * s, skinM, 8, 6); hand.position.y = -0.58 * s; shoulder.add(hand);
      arms[side === -1 ? 'L' : 'R'] = shoulder;
    }
    // Montura de arma en mano derecha
    const weaponMount = new THREE.Group();
    weaponMount.position.set(0, -0.6 * s, 0.02 * s);
    arms.R.add(weaponMount);

    // Piernas (pivote en cadera)
    const legs = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11 * s, 0.64 * s, 0);
      body.add(hip);
      const leg = capsule(0.075 * s, 0.34 * s, out2M); leg.position.y = -0.2 * s; hip.add(leg);
      const boot = box(0.13 * s, 0.09 * s, 0.2 * s, bootM); boot.position.set(0, -0.44 * s, 0.04 * s); hip.add(boot);
      legs[side === -1 ? 'L' : 'R'] = hip;
    }

    // Capa (opcional)
    let cape = null;
    if (cfg.cape !== false) {
      cape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42 * s, 0.62 * s, 4, 6),
        new THREE.MeshToonMaterial({ color: cfg.capeColor || outfit2, gradientMap: gradientMap(3), side: THREE.DoubleSide })
      );
      cape.position.set(0, 0.95 * s, -0.2 * s);
      body.add(cape);
    }

    const parts = { root, body, torso, headG, head, face, hair, arms, legs, weaponMount, cape };

    /* ===== Decoración única por héroe (siluetas distintivas) ===== */
    if (cfg.heroId && HERO_DECOR[cfg.heroId]) {
      HERO_DECOR[cfg.heroId]({ root, body, torso, headG, head, face, hair, arms, legs, weaponMount, cape }, s, cfg, { box, sphere, cone, cyl, capsule, toonMat, shade });
    }

    /* Animación procedural */
    const A = {
      state: 'idle', t: Math.random() * 10, atkP: 0, atkType: 'espada', castP: 0,
      moveAmt: 0, deadP: 0, flash: 0, hitFlash: 0
    };
    const origMats = [];
    root.traverse(o => { if (o.isMesh && o.material && o.material.color) { origMats.push([o.material, o.material.color ? o.material.color.clone() : null]); } });

    function tick(dt, ctx = {}) {
      A.t += dt;
      const t = A.t;
      const m = A.moveAmt; // 0..1 cantidad de movimiento
      if (A.state === 'dead') {
        A.deadP = Math.min(1, A.deadP + dt * 2.2);
        body.rotation.x = -Math.PI / 2 * A.deadP;
        body.position.y = -0.15 * s * A.deadP;
        return;
      }
      A.deadP = 0; body.rotation.x = 0; body.position.y = 0;
      // Respiración / bob
      const runC = Math.sin(t * (6 + m * 6)) * m;
      body.position.y = Math.abs(Math.sin(t * (6 + m * 6))) * 0.05 * s * m + Math.sin(t * 2) * 0.012 * s;
      body.rotation.x = m * 0.12;
      body.rotation.z = Math.sin(t * 3) * 0.02 * (1 - m);
      // Piernas
      legs.L.rotation.x = runC * 0.85;
      legs.R.rotation.x = -runC * 0.85;
      // Brazos por defecto (balanceo)
      let armLx = -runC * 0.6, armRx = runC * 0.6, armLz = 0.12, armRz = -0.12, armRy = 0;
      const idleSway = Math.sin(t * 2) * 0.05;
      armLx += idleSway; armRx += idleSway;

      if (A.state === 'attack') {
        A.atkP += dt * (2.2 * (A.atkType === 'dagas' ? 1.8 : A.atkType === 'mandoble' || A.atkType === 'martillo' ? 0.8 : 1));
        const p = Math.min(1, A.atkP);
        if (A.atkType === 'arco') {
          armRx = -1.4; armLx = -1.3; armLz = 0.65; armRz = -0.1;
          if (p > 0.6) { armLx = -0.6; armLz = 0.3; }
        } else if (A.atkType === 'baston') {
          armRx = p < 0.4 ? 1.6 : -1.2; armRz = -0.3;
          armLx = 0.3;
        } else if (A.atkType === 'lanza') {
          armRx = p < 0.35 ? 0.8 : -1.5; armRy = 0;
        } else if (A.atkType === 'mandoble' || A.atkType === 'martillo') {
          armRx = p < 0.4 ? 2.4 : p < 0.7 ? -1.4 : -0.4;
          armRz = -0.2;
          body.rotation.x = 0.15 + (p > 0.4 && p < 0.7 ? -0.25 : 0);
        } else { // espada/dagas
          armRx = p < 0.3 ? 1.2 : p < 0.65 ? -1.8 : -0.3;
          armRz = p < 0.3 ? -0.9 : p < 0.65 ? 0.7 : -0.1;
          armRy = p < 0.65 ? (p < 0.3 ? -0.5 : 0.9) : 0;
        }
        if (A.atkP >= 1) { A.state = 'idle'; A.atkP = 0; }
      } else if (A.state === 'cast') {
        A.castP += dt * 1.6;
        const p = Math.min(1, A.castP);
        armRx = -2.6 * Math.sin(p * Math.PI); armRz = -0.4;
        armLx = -1.2 * Math.sin(p * Math.PI);
        if (p >= 1) { A.state = 'idle'; A.castP = 0; }
      } else if (A.state === 'dodge') {
        // handled via root rotation in combat
      }

      arms.L.rotation.x = armLx; arms.L.rotation.z = armLz;
      arms.R.rotation.x = armRx; arms.R.rotation.z = armRz; arms.R.rotation.y = armRy;

      // Capa ondeando
      if (cape) {
        const sway = Math.sin(t * 3.2) * 0.06 + m * 0.55;
        cape.rotation.x = 0.12 + m * 0.5 + sway * 0.4;
        cape.position.z = -0.2 * s - m * 0.14 * s;
      }
      // Cabello sutil
      if (hair) hair.rotation.z = Math.sin(t * 2.6) * 0.03 + m * 0.12;

      // Flash de daño
      if (A.hitFlash > 0) {
        A.hitFlash -= dt * 4;
        const f = Math.max(0, A.hitFlash);
        for (const [mat, orig] of origMats) { if (mat.emissive) mat.emissive.setRGB(f, f * 0.15, f * 0.15); }
        if (A.hitFlash <= 0) for (const [mat] of origMats) { if (mat.emissive) mat.emissive.setRGB(0, 0, 0); }
      }
    }

    function play(name, weaponType) {
      if (weaponType) A.atkType = weaponType;
      A.state = name; A.atkP = 0; A.castP = 0;
    }
    function hitFlash() { A.hitFlash = 1; }

    function setWeapon(wGroup) {
      while (weaponMount.children.length) weaponMount.remove(weaponMount.children[0]);
      if (wGroup) weaponMount.add(wGroup);
    }
    function setFace(emotion) {
      headG.remove(face);
      const nf = facePlane(skin, accent, 'hero', emotion, 0.34 * s);
      nf.position.set(0, -0.01 * s, 0.245 * s);
      headG.add(nf);
      parts.face = nf;
    }

    return { group: root, parts, tick, play, hitFlash, setWeapon, setFace, A, cfg: { skin, outfit, outfit2, accent } };
  }

  /* ============================================================
     DECORACIONES ÚNICAS POR HÉROE — siluetas reconocibles
     ============================================================ */
  const HERO_DECOR = {
    // Kael: banda de guerrero + hombreras reforzadas + cinturón con placa
    kael(P, s, cfg, H) {
      const band = H.cyl(0.27 * s, 0.27 * s, 0.07 * s, H.toonMat(cfg.accent), 12);
      band.position.y = 0.05 * s; P.headG.add(band);
      const knot = H.cone(0.06 * s, 0.22 * s, H.toonMat(cfg.accent), 4);
      knot.position.set(0.12 * s, 0.1 * s, -0.26 * s); knot.rotation.z = 0.7; P.headG.add(knot);
      for (const side of [-1, 1]) {
        const plate = H.sphere(0.15 * s, H.toonMat(H.shade(cfg.outfit2, -12)), 8, 6);
        plate.scale.set(1.2, 0.8, 1.2); plate.position.set(side * 0.28 * s, 1.14 * s, 0); P.body.add(plate);
      }
    },
    // Lyra: capucha de arquera + carcaj con flechas
    lyra(P, s, cfg, H) {
      const hood = H.cone(0.3 * s, 0.42 * s, H.toonMat(cfg.outfit), 8);
      hood.position.set(0, 0.16 * s, -0.04 * s); hood.rotation.x = -0.25; P.headG.add(hood);
      const quiver = H.cyl(0.09 * s, 0.11 * s, 0.5 * s, H.toonMat('#78350f'), 8);
      quiver.position.set(-0.18 * s, 1.0 * s, -0.26 * s); quiver.rotation.z = 0.35; P.body.add(quiver);
      for (let i = 0; i < 3; i++) {
        const arr = H.cyl(0.012 * s, 0.012 * s, 0.55 * s, H.toonMat('#e2e8f0'), 4);
        arr.position.set(-0.18 * s + (i - 1) * 0.04 * s, 1.32 * s, -0.26 * s); arr.rotation.z = 0.35;
        P.body.add(arr);
        const tip = H.cone(0.025 * s, 0.07 * s, H.toonMat('#94a3b8'), 4);
        tip.position.set(-0.26 * s + (i - 1) * 0.035 * s, 1.6 * s, -0.26 * s); P.body.add(tip);
      }
    },
    // Mira: sombrero de maga + falda cónica + cinta estelar
    mira(P, s, cfg, H) {
      const brim = H.cyl(0.42 * s, 0.46 * s, 0.05 * s, H.toonMat(cfg.outfit2), 14);
      brim.position.y = 0.24 * s; P.headG.add(brim);
      const top = H.cone(0.28 * s, 0.55 * s, H.toonMat(cfg.outfit), 10);
      top.position.y = 0.5 * s; top.rotation.z = 0.12; P.headG.add(top);
      const star = H.sphere(0.05 * s, H.toonMat(cfg.accent, { emissive: cfg.accent }), 6, 5);
      star.position.set(0.1 * s, 0.68 * s, 0.14 * s); P.headG.add(star);
      const skirt = H.cone(0.34 * s, 0.55 * s, H.toonMat(cfg.outfit2), 10);
      skirt.position.y = 0.62 * s; P.body.add(skirt);
    },
    // Ronan: yelmo con visor + escudo en brazo izq + tabardo + hombreras doradas
    ronan(P, s, cfg, H) {
      P.hair.visible = false;
      const helm = H.sphere(0.285 * s, H.toonMat(H.shade(cfg.outfit2, -10)), 10, 8);
      helm.position.y = 0.02 * s; P.headG.add(helm);
      const crest = H.cone(0.05 * s, 0.2 * s, H.toonMat(cfg.accent), 4);
      crest.position.y = 0.3 * s; P.headG.add(crest);
      const visor = H.box(0.34 * s, 0.07 * s, 0.08 * s, H.toonMat('#111827'));
      visor.position.set(0, -0.01 * s, 0.24 * s); P.headG.add(visor);
      P.torso.scale.x = 1.18; // complexión más ancha
      for (const side of [-1, 1]) {
        const pad = H.sphere(0.16 * s, H.toonMat(cfg.accent), 8, 6);
        pad.scale.set(1.25, 0.85, 1.25); pad.position.set(side * 0.3 * s, 1.14 * s, 0); P.body.add(pad);
      }
      const shield = H.cyl(0.26 * s, 0.3 * s, 0.06 * s, H.toonMat(cfg.accent), 12);
      shield.rotation.z = Math.PI / 2; shield.position.set(-0.32 * s, 0.78 * s, 0.12 * s);
      P.arms.L.add(shield);
      const boss = H.sphere(0.07 * s, H.toonMat('#fef3c7'), 6, 5);
      boss.position.set(0.07 * s, 0, 0); shield.add(boss);
      const tabard = H.box(0.3 * s, 0.6 * s, 0.03 * s, H.toonMat(cfg.outfit));
      tabard.position.set(0, 0.72 * s, 0.24 * s); P.body.add(tabard);
    },
    // Zed: capucha oscura + bufanda cubrebocas + capa rasgada
    zed(P, s, cfg, H) {
      const hood = H.cone(0.3 * s, 0.45 * s, H.toonMat('#0b1220'), 8);
      hood.position.set(0, 0.14 * s, -0.03 * s); P.headG.add(hood);
      const mask = H.box(0.32 * s, 0.12 * s, 0.12 * s, H.toonMat('#7f1d1d'));
      mask.position.set(0, -0.09 * s, 0.2 * s); P.headG.add(mask);
      const scarf = H.box(0.34 * s, 0.08 * s, 0.3 * s, H.toonMat('#7f1d1d'));
      scarf.position.set(0, 1.05 * s, 0); P.body.add(scarf);
      P.torso.scale.x = 0.92; // silueta esbelta
    },
    // Sylvie: corona de flores + falda de hojas
    sylvie(P, s, cfg, H) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24 * s, 0.03 * s, 6, 14), H.toonMat('#4d7c0f'));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.2 * s; P.headG.add(ring);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = H.sphere(0.05 * s, H.toonMat(i % 2 ? '#f9a8d4' : '#fef3c7'), 6, 5);
        petal.position.set(Math.sin(a) * 0.24 * s, 0.22 * s, Math.cos(a) * 0.24 * s);
        P.headG.add(petal);
      }
      const skirt = H.cone(0.36 * s, 0.5 * s, H.toonMat('#166534'), 10);
      skirt.position.y = 0.64 * s; P.body.add(skirt);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const leafTip = H.cone(0.06 * s, 0.16 * s, H.toonMat('#22c55e'), 5);
        leafTip.position.set(Math.sin(a) * 0.3 * s, 0.42 * s, Math.cos(a) * 0.3 * s);
        leafTip.rotation.x = Math.PI; leafTip.rotation.z = Math.sin(a) * 0.4;
        P.body.add(leafTip);
      }
    },
    // Ignis: pelo llameante + hombreras de obsidiana + ojos brillantes
    ignis(P, s, cfg, H) {
      // llamas sobre la cabeza (cones emisivos)
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.75 + (i / 4) * Math.PI * 0.5;
        const fl = H.cone(0.07 * s, 0.3 * s + Math.random() * 0.12 * s, H.toonMat(i % 2 ? '#fb923c' : '#fbbf24', { emissive: '#f97316' }), 5);
        fl.position.set(Math.sin(a) * 0.18 * s, 0.22 * s + Math.abs(Math.cos(a)) * 0.06 * s, 0);
        fl.rotation.z = -a * 0.4; P.headG.add(fl);
      }
      for (const side of [-1, 1]) {
        const obs = H.box(0.22 * s, 0.12 * s, 0.22 * s, H.toonMat('#1c1917'));
        obs.position.set(side * 0.28 * s, 1.15 * s, 0); obs.rotation.z = side * 0.3; P.body.add(obs);
      }
    },
    // Nyx: corona de huesos + orbe flotante familiar + túnica larga
    nyx(P, s, cfg, H) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const bone = H.cone(0.035 * s, 0.16 * s, H.toonMat('#e7e5e4'), 5);
        bone.position.set(Math.sin(a) * 0.2 * s, 0.26 * s, Math.cos(a) * 0.2 * s);
        bone.rotation.z = Math.sin(a) * 0.5; P.headG.add(bone);
      }
      const robe = H.cone(0.38 * s, 0.7 * s, H.toonMat(cfg.outfit2), 10);
      robe.position.y = 0.56 * s; P.body.add(robe);
      const orb = H.sphere(0.09 * s, new THREE.MeshBasicMaterial({ color: '#c084fc' }), 8, 8);
      orb.position.set(0.34 * s, 1.15 * s, 0.22 * s); P.body.add(orb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#a855f7', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(0.55 * s); glow.position.copy(orb.position); P.body.add(glow);
    }
  };

  /* ============================================================
     ARMAS
     ============================================================ */
  function weapon(type, rarity = 'C', element = null) {
    const g = new THREE.Group();
    const rc = DATA.RARITY[rarity] ? DATA.RARITY[rarity].color : '#9ca3af';
    const ec = element ? DATA.ELEMENTS[element].color : rc;
    const steelM = toonMat('#cbd5e1');
    const edgeM = toonMat('#f1f5f9');
    const gripM = toonMat('#78350f');
    const gemM = basicMat(ec);
    const rarM = toonMat(rc);

    if (type === 'espada') {
      const blade = box(0.055, 0.55, 0.012, steelM); blade.position.y = 0.38; g.add(blade);
      const tip = cone(0.032, 0.1, edgeM, 4); tip.position.y = 0.7; tip.rotation.y = Math.PI / 4; g.add(tip);
      const guard = box(0.16, 0.03, 0.035, rarM); guard.position.y = 0.1; g.add(guard);
      const gem = sphere(0.028, gemM); gem.position.y = 0.11; g.add(gem);
      const grip = cyl(0.022, 0.026, 0.14, gripM); grip.position.y = 0.02; g.add(grip);
      const pommel = sphere(0.03, rarM); pommel.position.y = -0.06; g.add(pommel);
    } else if (type === 'mandoble') {
      const blade = box(0.085, 0.85, 0.02, steelM); blade.position.y = 0.52; g.add(blade);
      const mid = box(0.02, 0.85, 0.035, edgeM); mid.position.y = 0.52; g.add(mid);
      const tip = cone(0.048, 0.14, edgeM, 4); tip.position.y = 1.0; tip.rotation.y = Math.PI / 4; g.add(tip);
      const guard = box(0.26, 0.045, 0.05, rarM); guard.position.y = 0.1; g.add(guard);
      const gem = sphere(0.04, gemM); gem.position.y = 0.13; g.add(gem);
      const grip = cyl(0.026, 0.03, 0.2, gripM); grip.position.y = -0.01; g.add(grip);
    } else if (type === 'lanza') {
      const shaft = cyl(0.02, 0.02, 1.15, gripM); shaft.position.y = 0.35; g.add(shaft);
      const head = cone(0.05, 0.22, edgeM, 4); head.position.y = 1.0; g.add(head);
      const collar = cyl(0.035, 0.035, 0.04, rarM); collar.position.y = 0.87; g.add(collar);
      const tassel = sphere(0.04, basicMat(ec), 6, 5); tassel.position.y = 0.83; g.add(tassel);
    } else if (type === 'arco') {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 6, 16, Math.PI), rarM);
      arc.rotation.z = Math.PI / 2; arc.position.y = 0.3; g.add(arc);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.62), basicMat('#e2e8f0'));
      string.position.y = 0.3; g.add(string);
      const gem = sphere(0.03, gemM); gem.position.y = 0.3; gem.position.x = -0.32; g.add(gem);
    } else if (type === 'baston') {
      const shaft = cyl(0.024, 0.03, 0.95, gripM); shaft.position.y = 0.3; g.add(shaft);
      const head = sphere(0.075, gemM, 8, 8); head.position.y = 0.85; g.add(head);
      const cage1 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 12), rarM); cage1.position.y = 0.85; cage1.rotation.x = Math.PI / 2; g.add(cage1);
      const cage2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 12), rarM); cage2.position.y = 0.85; cage2.rotation.y = Math.PI / 2; cage2.rotation.x = 0.6; g.add(cage2);
    } else if (type === 'dagas') {
      for (const side of [0, 1]) {
        const blade = box(0.04, 0.3, 0.01, steelM); blade.position.set(side * 0.1 - 0.05, 0.22, 0); g.add(blade);
        const tip = cone(0.024, 0.08, edgeM, 4); tip.position.set(side * 0.1 - 0.05, 0.41, 0); tip.rotation.y = Math.PI / 4; g.add(tip);
        const guard = box(0.08, 0.02, 0.03, rarM); guard.position.set(side * 0.1 - 0.05, 0.06, 0); g.add(guard);
        const grip = cyl(0.018, 0.02, 0.1, gripM); grip.position.set(side * 0.1 - 0.05, 0, 0); g.add(grip);
        const gem = sphere(0.02, gemM); gem.position.set(side * 0.1 - 0.05, 0.07, 0.02); g.add(gem);
      }
    } else if (type === 'martillo') {
      const shaft = cyl(0.026, 0.03, 0.75, gripM); shaft.position.y = 0.28; g.add(shaft);
      const headH = box(0.22, 0.14, 0.14, steelM); headH.position.y = 0.68; g.add(headH);
      const face1 = cyl(0.09, 0.09, 0.04, rarM, 8); face1.rotation.z = Math.PI / 2; face1.position.set(0.13, 0.68, 0); g.add(face1);
      const face2 = cone(0.08, 0.08, rarM, 8); face2.rotation.z = Math.PI / 2; face2.position.set(-0.15, 0.68, 0); g.add(face2);
      const gem = sphere(0.035, gemM); gem.position.y = 0.68; gem.position.z = 0.09; g.add(gem);
    }
    return g;
  }
  function weaponGlow(type, element, rarity) {
    // Destello decorativo para SSR+
    if (rarity !== 'SSR' && rarity !== 'UR') return null;
    const color = element ? DATA.ELEMENTS[element].color : DATA.RARITY[rarity].color;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(type === 'mandoble' || type === 'martillo' ? 0.55 : 0.4);
    sp.position.y = type === 'arco' ? 0.3 : 0.45;
    return sp;
  }

  /* ============================================================
     ENEMIGOS
     ============================================================ */
  function slimeModel(colorHex, scale, opts = {}) {
    const g = new THREE.Group();
    const mat = toonMat(colorHex, { transparent: true, opacity: 0.88, noCache: true });
    const core = toonMat(shade(colorHex, -30), { noCache: true });
    const bodyM = sphere(0.55 * scale, mat, 14, 12);
    bodyM.scale.y = 0.75; bodyM.position.y = 0.42 * scale; g.add(bodyM);
    addOutline(bodyM, 1.04, 0.35);
    const inner = sphere(0.2 * scale, core, 8, 8); inner.position.y = 0.35 * scale; g.add(inner);
    for (const side of [-1, 1]) {
      const eye = sphere(0.07 * scale, basicMat('#111827'), 6, 5); eye.position.set(side * 0.18 * scale, 0.55 * scale, 0.44 * scale); g.add(eye);
      const glint = sphere(0.025 * scale, basicMat('#ffffff'), 4, 4); glint.position.set(side * 0.18 * scale, 0.6 * scale, 0.5 * scale); g.add(glint);
    }
    const mouth = box(0.14 * scale, 0.04 * scale, 0.02, basicMat('#111827')); mouth.position.set(0, 0.38 * scale, 0.52 * scale); g.add(mouth);
    g.userData.anim = (t) => {
      const sq = 1 + Math.sin(t * 6) * 0.12;
      bodyM.scale.set(1 / Math.sqrt(sq), 0.75 * sq, 1 / Math.sqrt(sq));
    };
    return g;
  }
  function quadrupedModel(cfg) {
    const { color, scale } = cfg;
    const g = new THREE.Group();
    const furM = toonMat(color);
    const darkM = toonMat(shade(color, -20));
    const bodyM = capsule(0.28 * scale, 0.62 * scale, furM, 10);
    bodyM.rotation.x = Math.PI / 2; bodyM.position.y = 0.62 * scale; g.add(bodyM);
    addOutline(bodyM, 1.04);
    const headG = new THREE.Group(); headG.position.set(0, 0.78 * scale, 0.5 * scale); g.add(headG);
    const headM = sphere(0.22 * scale, furM, 10, 8); headG.add(headM);
    const snout = box(0.12 * scale, 0.1 * scale, 0.16 * scale, darkM); snout.position.set(0, -0.04 * scale, 0.2 * scale); headG.add(snout);
    for (const side of [-1, 1]) {
      const ear = cone(0.06 * scale, 0.14 * scale, darkM, 4); ear.position.set(side * 0.1 * scale, 0.2 * scale, 0); headG.add(ear);
      const eye = sphere(0.035 * scale, basicMat('#fbbf24'), 5, 4); eye.position.set(side * 0.1 * scale, 0.05 * scale, 0.17 * scale); headG.add(eye);
    }
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.16 * scale, 0.5 * scale, sz * 0.3 * scale); g.add(hip);
      const leg = capsule(0.06 * scale, 0.3 * scale, darkM); leg.position.y = -0.2 * scale; hip.add(leg);
      legs.push(hip);
    }
    const tail = cone(0.06 * scale, 0.34 * scale, furM, 5); tail.rotation.x = -1.1; tail.position.set(0, 0.72 * scale, -0.5 * scale); g.add(tail);
    g.userData.anim = (t, move) => {
      const c = Math.sin(t * 9) * move;
      legs[0].rotation.x = c * 0.7; legs[3].rotation.x = c * 0.7;
      legs[1].rotation.x = -c * 0.7; legs[2].rotation.x = -c * 0.7;
      tail.rotation.z = Math.sin(t * 5) * 0.3;
    };
    g.userData.headG = headG;
    return g;
  }
  function humanoidEnemy(cfg) {
    // Reutiliza el sistema del héroe con silueta distinta
    const c = character(Object.assign({
      scale: (cfg.scale || 1) * 0.95,
      skin: cfg.skin || '#e8c8a0',
      hair: cfg.hair || '#1f2937',
      hairStyle: cfg.hairStyle || 'short',
      outfit: cfg.color,
      outfit2: shade(cfg.color, -18),
      accent: cfg.accent || '#ef4444',
      cape: cfg.cape !== undefined ? cfg.cape : false
    }, cfg));
    // Cara enemiga (ojos rojos)
    c.setFace('angry');
    if (cfg.weapon) c.setWeapon(weapon(cfg.weapon, 'C'));
    return c;
  }
  function robeEnemy(cfg) {
    const g = new THREE.Group();
    const scale = cfg.scale || 1;
    const robeM = toonMat(cfg.color);
    const hoodM = toonMat(shade(cfg.color, -25));
    const robe = cone(0.42 * scale, 0.95 * scale, robeM, 10);
    robe.position.y = 0.48 * scale; g.add(robe); addOutline(robe, 1.04);
    const hood = sphere(0.24 * scale, hoodM, 10, 8); hood.position.y = 1.05 * scale; hood.scale.set(1, 1.15, 1); g.add(hood); addOutline(hood, 1.04);
    const face = box(0.24 * scale, 0.16 * scale, 0.1, basicMat('#0b0e1a')); face.position.set(0, 1.02 * scale, 0.17 * scale); g.add(face);
    for (const side of [-1, 1]) {
      const eye = sphere(0.035 * scale, basicMat(cfg.eyeColor || '#f87171'), 5, 4);
      eye.position.set(side * 0.07 * scale, 1.03 * scale, 0.22 * scale); g.add(eye);
    }
    const orb = sphere(0.09 * scale, basicMat(cfg.orbColor || '#a855f7'), 8, 8);
    orb.position.set(0.32 * scale, 0.7 * scale, 0.15 * scale); g.add(orb);
    g.userData.orb = orb;
    // Brazos espectrales
    for (const side of [-1, 1]) {
      const arm = capsule(0.05 * scale, 0.4 * scale, hoodM);
      arm.position.set(side * 0.36 * scale, 0.75 * scale, 0.1 * scale);
      arm.rotation.z = side * 0.5; g.add(arm);
    }
    g.userData.anim = (t) => {
      orb.position.y = 0.7 * scale + Math.sin(t * 3) * 0.05;
      hood.rotation.y = Math.sin(t * 1.2) * 0.1;
    };
    return g;
  }
  function bomberModel(cfg) {
    const g = new THREE.Group();
    const scale = cfg.scale || 1;
    const bodyM = sphere(0.42 * scale, toonMat('#1c1917'), 12, 10);
    bodyM.position.y = 0.45 * scale; g.add(bodyM); addOutline(bodyM, 1.04);
    const cap = sphere(0.2 * scale, toonMat('#dc2626'), 8, 6); cap.position.y = 0.78 * scale; g.add(cap);
    const fuse = cyl(0.015, 0.015, 0.18, basicMat('#a16207')); fuse.position.y = 0.98 * scale; fuse.rotation.z = 0.3; g.add(fuse);
    const spark = sphere(0.05, basicMat('#fbbf24'), 6, 5); spark.position.set(-0.05, 1.08 * scale, 0); g.add(spark);
    g.userData.spark = spark;
    for (const side of [-1, 1]) {
      const eye = sphere(0.06 * scale, basicMat('#fbbf24'), 5, 4); eye.position.set(side * 0.15 * scale, 0.52 * scale, 0.36 * scale); g.add(eye);
    }
    const footL = sphere(0.1 * scale, toonMat('#78350f'), 6, 5); footL.position.set(-0.15 * scale, 0.08 * scale, 0.05 * scale); g.add(footL);
    const footR = footL.clone(); footR.position.x = 0.15 * scale; g.add(footR);
    g.userData.anim = (t) => {
      spark.scale.setScalar(0.8 + Math.sin(t * 20) * 0.4);
      bodyM.position.y = 0.45 * scale + Math.abs(Math.sin(t * 8)) * 0.05;
      footL.position.z = 0.05 * scale + Math.sin(t * 10) * 0.08;
      footR.position.z = 0.05 * scale - Math.sin(t * 10) * 0.08;
    };
    return g;
  }
  function golemModel(cfg) {
    const g = new THREE.Group();
    const scale = cfg.scale || 1;
    const rockM = toonMat(cfg.color || '#78716c');
    const rockD = toonMat(shade(cfg.color || '#78716c', -22));
    const coreM = basicMat(cfg.coreColor || '#fb923c');
    const torso = box(0.9 * scale, 0.85 * scale, 0.6 * scale, rockM); torso.position.y = 1.25 * scale; g.add(torso); addOutline(torso, 1.03);
    const core = sphere(0.14 * scale, coreM, 8, 8); core.position.set(0, 1.3 * scale, 0.32 * scale); g.add(core);
    g.userData.core = core;
    const head = box(0.42 * scale, 0.38 * scale, 0.42 * scale, rockD); head.position.y = 1.9 * scale; g.add(head); addOutline(head, 1.03);
    for (const side of [-1, 1]) {
      const eye = box(0.09 * scale, 0.05 * scale, 0.03, coreM); eye.position.set(side * 0.1 * scale, 1.92 * scale, 0.22 * scale); g.add(eye);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.62 * scale, 1.55 * scale, 0); g.add(shoulder);
      const arm = box(0.32 * scale, 0.8 * scale, 0.32 * scale, rockM); arm.position.y = -0.35 * scale; shoulder.add(arm); addOutline(arm, 1.03);
      const fist = sphere(0.22 * scale, rockD, 8, 6); fist.position.y = -0.8 * scale; shoulder.add(fist);
      arms.push(shoulder);
    }
    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * 0.28 * scale, 0.85 * scale, 0); g.add(hip);
      const leg = box(0.3 * scale, 0.75 * scale, 0.3 * scale, rockD); leg.position.y = -0.4 * scale; hip.add(leg);
      legs.push(hip);
    }
    g.userData.anim = (t, move) => {
      const c = Math.sin(t * 5) * move;
      legs[0].rotation.x = c * 0.4; legs[1].rotation.x = -c * 0.4;
      arms[0].rotation.x = -c * 0.3; arms[1].rotation.x = c * 0.3;
      core.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
    };
    return g;
  }
  function specterModel(cfg) {
    const g = new THREE.Group();
    const scale = cfg.scale || 1;
    const ghostM = toonMat(cfg.color || '#a78bfa', { transparent: true, opacity: 0.75, noCache: true });
    const head = sphere(0.3 * scale, ghostM, 10, 10); head.position.y = 1.15 * scale; g.add(head);
    const eyes = [];
    for (const side of [-1, 1]) {
      const eye = sphere(0.055 * scale, basicMat('#22d3ee'), 5, 4); eye.position.set(side * 0.11 * scale, 1.18 * scale, 0.24 * scale); g.add(eye); eyes.push(eye);
    }
    const mouth = sphere(0.07 * scale, basicMat('#0b0e1a'), 5, 4); mouth.position.set(0, 1.03 * scale, 0.24 * scale); mouth.scale.y = 1.6; g.add(mouth);
    const robe = cone(0.42 * scale, 0.9 * scale, ghostM, 9);
    robe.position.y = 0.55 * scale; g.add(robe);
    const tail = cone(0.2 * scale, 0.5 * scale, ghostM, 8); tail.position.y = 0.15 * scale; tail.rotation.x = Math.PI; g.add(tail);
    for (const side of [-1, 1]) {
      const arm = capsule(0.05 * scale, 0.4 * scale, ghostM); arm.position.set(side * 0.36 * scale, 0.85 * scale, 0.1 * scale); arm.rotation.z = side * 0.7; g.add(arm);
    }
    g.userData.anim = (t) => {
      g.children.forEach(ch => { ch.position.y += 0; });
      head.position.y = 1.15 * scale + Math.sin(t * 2.5) * 0.06;
      robe.position.y = 0.55 * scale + Math.sin(t * 2.5 + 1) * 0.04;
      tail.scale.x = 1 + Math.sin(t * 3) * 0.2;
      eyes.forEach(e => e.scale.setScalar(1 + Math.sin(t * 6) * 0.15));
    };
    return g;
  }
  function dragonModel(cfg) {
    const g = new THREE.Group();
    const scale = cfg.scale || 1;
    const bodyM = toonMat(cfg.color || '#b91c1c');
    const bellyM = toonMat(shade(cfg.color || '#b91c1c', 25));
    const wingM = toonMat(shade(cfg.color || '#b91c1c', -15), { transparent: true, opacity: 0.92, noCache: true });
    const body = capsule(0.32 * scale, 0.6 * scale, bodyM, 10); body.rotation.x = Math.PI / 2 - 0.2; body.position.y = 0.75 * scale; g.add(body); addOutline(body, 1.03);
    const belly = sphere(0.24 * scale, bellyM, 8, 8); belly.scale.set(0.8, 1.6, 0.6); belly.position.set(0, 0.7 * scale, 0.18 * scale); g.add(belly);
    const headG = new THREE.Group(); headG.position.set(0, 1.05 * scale, 0.55 * scale); g.add(headG);
    const head = sphere(0.2 * scale, bodyM, 10, 8); headG.add(head);
    const snout = box(0.14 * scale, 0.1 * scale, 0.18 * scale, bodyM); snout.position.set(0, -0.03 * scale, 0.18 * scale); headG.add(snout);
    for (const side of [-1, 1]) {
      const horn = cone(0.04 * scale, 0.18 * scale, bellyM, 5); horn.position.set(side * 0.1 * scale, 0.18 * scale, -0.05 * scale); horn.rotation.z = side * -0.3; headG.add(horn);
      const eye = sphere(0.04 * scale, basicMat('#fbbf24'), 5, 4); eye.position.set(side * 0.12 * scale, 0.05 * scale, 0.14 * scale); headG.add(eye);
    }
    const wings = [];
    for (const side of [-1, 1]) {
      const wingG = new THREE.Group(); wingG.position.set(side * 0.2 * scale, 0.95 * scale, -0.1 * scale); g.add(wingG);
      const membrane = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * scale, 0.5 * scale, 3, 2), new THREE.MeshToonMaterial({ color: shade(cfg.color || '#b91c1c', -25), gradientMap: gradientMap(3), side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      membrane.position.set(side * 0.4 * scale, 0.1 * scale, 0);
      membrane.rotation.y = side * 0.3;
      wingG.add(membrane);
      wings.push(wingG);
    }
    const tail = cone(0.08 * scale, 0.6 * scale, bodyM, 6); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.7 * scale, -0.7 * scale); g.add(tail);
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.18 * scale, 0.4 * scale, sz * 0.28 * scale); g.add(hip);
      const leg = capsule(0.05 * scale, 0.28 * scale, bodyM); leg.position.y = -0.16 * scale; hip.add(leg);
      legs.push(hip);
    }
    g.userData.anim = (t, move) => {
      const flap = Math.sin(t * 7);
      wings.forEach((w, i) => { w.rotation.z = (i === 0 ? 1 : -1) * (0.2 + flap * 0.45); });
      const c = Math.sin(t * 8) * move;
      legs[0].rotation.x = c * 0.5; legs[3].rotation.x = c * 0.5; legs[1].rotation.x = -c * 0.5; legs[2].rotation.x = -c * 0.5;
      tail.rotation.y = Math.sin(t * 3) * 0.3;
    };
    g.userData.headG = headG;
    return g;
  }

  function enemy(typeId) {
    const e = DATA.ENEMIES[typeId];
    if (!e) return null;
    let g;
    switch (typeId) {
      case 'slime': case 'slime_azul':
        g = slimeModel(e.color, e.scale); break;
      case 'lobo':
        g = quadrupedModel({ color: e.color, scale: e.scale }); break;
      case 'goblin': case 'arquero_g':
        g = attachChar(humanoidEnemy({ scale: e.scale, color: e.color, skin: '#a3e635', hair: '#365314', accent: '#fbbf24', weapon: typeId === 'arquero_g' ? 'arco' : 'espada', hairStyle: 'spiky' })); break;
      case 'esqueleto':
        g = attachChar(humanoidEnemy({ scale: e.scale, color: '#a8a29e', skin: '#e7e5e4', hair: '#e7e5e4', accent: '#f87171', weapon: 'espada', hairStyle: 'short' })); break;
      case 'orco':
        g = attachChar(humanoidEnemy({ scale: e.scale, color: e.color, skin: '#4d7c0f', hair: '#1a2e05', accent: '#ef4444', weapon: 'mandoble', hairStyle: 'spiky', cape: false })); break;
      case 'mago_osc':
        g = robeEnemy({ color: e.color, scale: e.scale, orbColor: '#c084fc' }); break;
      case 'bombardero':
        g = bomberModel({ scale: e.scale }); break;
      case 'golem':
        g = golemModel({ color: e.color, scale: e.scale, coreColor: '#fbbf24' }); break;
      case 'espectro':
        g = specterModel({ color: e.color, scale: e.scale }); break;
      case 'dragoncito':
        g = dragonModel({ color: e.color, scale: e.scale }); break;
      default:
        g = attachChar(humanoidEnemy({ scale: e.scale, color: e.color }));
    }
    return g;
  }
  function attachChar(charObj) {
    charObj.group.userData.charCtrl = charObj;
    return charObj.group;
  }

  function bossDecor(g, bossId) {
    // Corona + anillo de menacing para jefes
    const crown = new THREE.Group();
    const goldM = toonMat('#fbbf24');
    const base = cyl(0.2, 0.23, 0.09, goldM, 8); crown.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = cone(0.045, 0.14, goldM, 4);
      spike.position.set(Math.sin(a) * 0.17, 0.1, Math.cos(a) * 0.17);
      crown.add(spike);
    }
    const el = DATA.BOSSES[bossId];
    const scale = el ? el.scale * 0.55 : 1.6;
    crown.scale.setScalar(scale);
    crown.position.y = 2.1 * scale * 0.75;
    g.add(crown);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 * (scale * 0.5), 0.04, 6, 32),
      basicMat(el ? DATA.ELEMENTS[el.element].color : '#ef4444', { transparent: true, opacity: 0.7 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.12;
    g.add(ring);
    g.userData.ring = ring;
    g.userData.crown = crown;
    return g;
  }

  /* ============================================================
     PROPS DEL MUNDO
     ============================================================ */
  function tree(theme, rng = Math.random) {
    const g = new THREE.Group();
    const trunkM = toonMat(theme === 'volcano' ? '#292524' : theme === 'void' ? '#3f3f46' : '#78350f');
    const trunk = cyl(0.14, 0.2, 1.4, trunkM, 7); trunk.position.y = 0.7; g.add(trunk);
    if (theme === 'snow') {
      const leafM = toonMat('#2d6a4f');
      for (let i = 0; i < 3; i++) {
        const c = cone(1.1 - i * 0.28, 1.1, i === 2 ? toonMat('#e8f4f8') : leafM, 8);
        c.position.y = 1.5 + i * 0.72; g.add(c);
      }
    } else if (theme === 'desert') {
      const cactusM = toonMat('#3f6212');
      const main = capsule(0.28, 1.6, cactusM); main.position.y = 1.1; g.add(main);
      const arm = capsule(0.16, 0.7, cactusM); arm.position.set(0.45, 1.2, 0); g.add(arm);
      const arm2 = capsule(0.16, 0.5, cactusM); arm2.position.set(-0.4, 1.0, 0.1); g.add(arm2);
    } else if (theme === 'volcano' || theme === 'void') {
      const branches = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < branches; i++) {
        const b = cyl(0.05, 0.09, 0.9, trunkM, 5);
        b.position.set((rng() - 0.5) * 0.5, 1.2 + rng() * 0.7, (rng() - 0.5) * 0.5);
        b.rotation.z = (rng() - 0.5) * 1.4; b.rotation.x = (rng() - 0.5) * 1.4;
        g.add(b);
      }
      if (theme === 'void') {
        const crystal = crystalMesh(rng() > 0.5 ? '#a855f7' : '#22d3ee', 0.5 + rng() * 0.4);
        crystal.position.y = 1.8; g.add(crystal);
      }
    } else {
      const leafColors = ['#166534', '#15803d', '#22c55e'];
      const leafM = toonMat(leafColors[Math.floor(rng() * leafColors.length)]);
      for (let i = 0; i < 3; i++) {
        const blob = sphere(0.75 + rng() * 0.4, leafM, 9, 7);
        blob.position.set((rng() - 0.5) * 0.8, 1.7 + rng() * 0.7, (rng() - 0.5) * 0.8);
        blob.scale.y = 0.85;
        g.add(blob);
      }
    }
    const s = 0.8 + rng() * 0.6; g.scale.setScalar(s);
    g.rotation.y = rng() * Math.PI * 2;
    return g;
  }
  function rock(theme, rng = Math.random) {
    const g = new THREE.Group();
    const colors = { meadow: '#94a3b8', desert: '#d6a25e', snow: '#e2e8f0', volcano: '#44403c', void: '#6b21a8', royale: '#8d99ae' };
    const rockM = toonMat(colors[theme] || '#94a3b8');
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const r = sphere(0.35 + rng() * 0.4, rockM, 6, 5);
      r.position.set((rng() - 0.5) * 0.7, rng() * 0.25, (rng() - 0.5) * 0.7);
      r.scale.set(1, 0.7 + rng() * 0.4, 1);
      g.add(r);
    }
    g.rotation.y = rng() * Math.PI * 2;
    return g;
  }
  function crystalMesh(colorHex, h = 1) {
    const g = new THREE.Group();
    const m = toonMat(colorHex, { emissive: colorHex, emissiveIntensity: 0.55, noCache: true });
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 * h, 0), m);
    main.scale.y = 1.8; main.position.y = 0.5 * h; g.add(main);
    for (let i = 0; i < 2; i++) {
      const side = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * h, 0), m);
      side.scale.y = 1.4;
      side.position.set((i - 0.5) * 0.35 * h, 0.28 * h, (i % 2 ? 0.15 : -0.15) * h);
      side.rotation.z = (i - 0.5) * 0.5;
      g.add(side);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: colorHex, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(2.2 * h); glow.position.y = 0.6 * h;
    g.add(glow);
    g.userData.glow = glow;
    return g;
  }
  function chest() {
    const g = new THREE.Group();
    const woodM = toonMat('#92400e');
    const goldM = toonMat('#fbbf24');
    const base = box(0.9, 0.5, 0.6, woodM); base.position.y = 0.25; g.add(base);
    const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); g.add(lid);
    const lidM = box(0.9, 0.3, 0.6, woodM); lidM.position.set(0, 0.15, 0.3); lid.add(lidM);
    const band = box(0.94, 0.12, 0.64, goldM); band.position.y = 0.25; g.add(band);
    const lock = box(0.16, 0.2, 0.08, goldM); lock.position.set(0, 0.42, 0.32); g.add(lock);
    g.userData.lid = lid;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#fbbf24', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.6); glow.position.y = 0.6; g.add(glow);
    return g;
  }
  function portal(colorA = '#22d3ee', colorB = '#a855f7') {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.14, 8, 28), toonMat('#fbbf24'));
    torus.position.y = 1.6; g.add(torus);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.2, 28),
      new THREE.MeshBasicMaterial({ color: colorA, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    inner.position.y = 1.6; g.add(inner);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: colorB, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(3.4); glow.position.y = 1.6; g.add(glow);
    g.userData.anim = (t) => {
      inner.rotation.z = t * 0.8;
      inner.material.opacity = 0.35 + Math.sin(t * 2.5) * 0.15;
      torus.rotation.z = Math.sin(t) * 0.05;
    };
    return g;
  }
  function house(theme = 'meadow') {
    const g = new THREE.Group();
    // Muros con textura de madera CC0
    const wallTex = tex('wood_c');
    wallTex.repeat.set(1.6, 1.2);
    const wallM = new THREE.MeshToonMaterial({ color: theme === 'snow' ? '#d8e4ee' : theme === 'void' ? '#37306b' : '#e8d5a8', map: wallTex, gradientMap: gradientMap(3) });
    const roofColor = { meadow: '#b91c1c', desert: '#d97706', snow: '#0369a1', volcano: '#1c1917', void: '#4c1d95' }[theme] || '#b91c1c';
    const roofM = toonMat(roofColor);
    const beamM = toonMat('#6b4423');
    // zócalo de piedra
    const stoneBase = box(2.56, 0.36, 2.16, toonMat('#94a3b8'));
    stoneBase.position.y = 0.18; g.add(stoneBase);
    const base = box(2.4, 1.7, 2.0, wallM); base.position.y = 1.05; g.add(base);
    // vigas de esquina
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const beam = box(0.16, 1.7, 0.16, beamM);
      beam.position.set(sx * 1.14, 1.05, sz * 0.94); g.add(beam);
    }
    // viga superior
    const topBeam = box(2.5, 0.14, 0.12, beamM);
    topBeam.position.set(0, 1.82, 0.98); g.add(topBeam);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.5, 4), roofM);
    roof.position.y = 2.65; roof.rotation.y = Math.PI / 4; g.add(roof);
    // chimenea
    const chim = box(0.36, 0.9, 0.36, toonMat('#78716c'));
    chim.position.set(0.72, 2.75, -0.3); g.add(chim);
    const chimTop = box(0.46, 0.12, 0.46, toonMat('#57534e'));
    chimTop.position.set(0.72, 3.22, -0.3); g.add(chimTop);
    // puerta con marco
    const doorFrame = box(0.76, 1.14, 0.1, beamM); doorFrame.position.set(0, 0.62, 1.02); g.add(doorFrame);
    const doorTexMat = new THREE.MeshToonMaterial({ color: '#a1691f', map: tex('wood_c'), gradientMap: gradientMap(3) });
    const door = box(0.6, 1.0, 0.09, doorTexMat); door.position.set(0, 0.58, 1.05); g.add(door);
    const knob = sphere(0.035, toonMat('#fbbf24'), 6, 5); knob.position.set(0.2, 0.55, 1.11); g.add(knob);
    // ventanas con marco y cristal cálido
    for (const side of [-1, 1]) {
      const wf = box(0.6, 0.6, 0.08, beamM); wf.position.set(side * 0.72, 1.28, 1.02); g.add(wf);
      const win = box(0.44, 0.44, 0.09, basicMat('#fde68a')); win.position.set(side * 0.72, 1.28, 1.04); g.add(win);
      const mullion = box(0.05, 0.44, 0.1, beamM); mullion.position.set(side * 0.72, 1.28, 1.05); g.add(mullion);
    }
    return g;
  }
  function fence(len = 6) {
    const g = new THREE.Group();
    const woodM = new THREE.MeshToonMaterial({ color: '#a1691f', map: tex('wood_c'), gradientMap: gradientMap(3) });
    const postGeo = new THREE.BoxGeometry(0.14, 0.9, 0.14);
    const n = Math.max(2, Math.round(len / 1.1));
    for (let i = 0; i <= n; i++) {
      const post = new THREE.Mesh(postGeo, woodM);
      post.position.set(-len / 2 + (i / n) * len, 0.45, 0);
      g.add(post);
    }
    for (const yy of [0.35, 0.68]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.07), woodM);
      rail.position.set(0, yy, 0); g.add(rail);
    }
    return g;
  }
  function lamp() {
    const g = new THREE.Group();
    const post = cyl(0.06, 0.09, 2.1, toonMat('#334155'), 7);
    post.position.y = 1.05; g.add(post);
    const arm = box(0.5, 0.07, 0.07, toonMat('#334155'));
    arm.position.set(0.2, 2.05, 0); g.add(arm);
    const cage = box(0.26, 0.32, 0.26, toonMat('#1e293b'));
    cage.position.set(0.42, 1.86, 0); g.add(cage);
    const flame = sphere(0.09, basicMat('#fde68a'), 8, 6);
    flame.position.set(0.42, 1.86, 0); g.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#fbbf24', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.4); glow.position.set(0.42, 1.9, 0); g.add(glow);
    g.userData.anim = (t) => { glow.material.opacity = 0.42 + Math.sin(t * 5 + 1) * 0.12; };
    return g;
  }
  function well() {
    const g = new THREE.Group();
    const stoneM = toonMat('#94a3b8');
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.7, 12, 1, true), stoneM);
    ring.position.y = 0.35; g.add(ring);
    const water = cyl(0.62, 0.62, 0.05, basicMat('#0ea5e9'), 12);
    water.position.y = 0.4; g.add(water);
    for (const side of [-1, 1]) {
      const post = box(0.12, 1.3, 0.12, toonMat('#6b4423'));
      post.position.set(side * 0.62, 1.0, 0); g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 4), toonMat('#b45309'));
    roof.position.y = 1.9; roof.rotation.y = Math.PI / 4; g.add(roof);
    const bar = cyl(0.05, 0.05, 1.2, toonMat('#78350f'), 7);
    bar.rotation.z = Math.PI / 2; bar.position.y = 1.35; g.add(bar);
    const rope = cyl(0.015, 0.015, 0.5, toonMat('#d6d3d1'), 4);
    rope.position.y = 1.1; g.add(rope);
    const bucket = cyl(0.12, 0.09, 0.18, toonMat('#a16207'), 8);
    bucket.position.y = 0.82; g.add(bucket);
    return g;
  }
  function barrel() {
    const g = new THREE.Group();
    const woodM = new THREE.MeshToonMaterial({ color: '#b07a2e', map: tex('wood_c'), gradientMap: gradientMap(3) });
    const body = cyl(0.32, 0.38, 0.72, woodM, 10);
    body.position.y = 0.36; g.add(body);
    for (const yy of [0.14, 0.58]) {
      const hoop = cyl(0.395, 0.395, 0.07, toonMat('#57534e'), 10);
      hoop.position.y = yy; g.add(hoop);
    }
    const lid = cyl(0.33, 0.33, 0.05, toonMat('#8a5a22'), 10);
    lid.position.y = 0.74; g.add(lid);
    return g;
  }
  function campfire() {
    const g = new THREE.Group();
    const woodM = toonMat('#78350f');
    for (let i = 0; i < 4; i++) {
      const log = cyl(0.06, 0.06, 0.7, woodM, 5);
      log.rotation.z = Math.PI / 2.3; log.rotation.y = (i / 4) * Math.PI * 2;
      log.position.y = 0.12; g.add(log);
    }
    const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX.glowTex(), color: '#fb923c', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    fireGlow.scale.setScalar(1.4); fireGlow.position.y = 0.5; g.add(fireGlow);
    const flame = cone(0.22, 0.5, basicMat('#fbbf24'), 6); flame.position.y = 0.38; g.add(flame);
    g.userData.anim = (t) => {
      flame.scale.set(1 + Math.sin(t * 9) * 0.15, 1 + Math.sin(t * 12) * 0.22, 1 + Math.cos(t * 10) * 0.15);
      fireGlow.material.opacity = 0.55 + Math.sin(t * 8) * 0.2;
    };
    return g;
  }
  function baseCrystal() {
    // El Cristal de Aetheria que se defiende
    const g = new THREE.Group();
    const pedM = toonMat('#94a3b8');
    const ped = cyl(1.6, 2.0, 0.5, pedM, 8); ped.position.y = 0.25; g.add(ped);
    const step2 = cyl(1.1, 1.5, 0.4, toonMat('#cbd5e1'), 8); step2.position.y = 0.65; g.add(step2);
    const crystal = crystalMesh('#22d3ee', 2.6);
    crystal.position.y = 1.0; g.add(crystal);
    const floats = [];
    for (let i = 0; i < 4; i++) {
      const shard = crystalMesh('#7dd3fc', 0.45);
      const a = (i / 4) * Math.PI * 2;
      shard.position.set(Math.sin(a) * 1.6, 1.8, Math.cos(a) * 1.6);
      g.add(shard); floats.push(shard);
    }
    g.userData.anim = (t) => {
      crystal.rotation.y = t * 0.5;
      crystal.position.y = 1.0 + Math.sin(t * 1.4) * 0.15;
      floats.forEach((s, i) => {
        const a = (i / 4) * Math.PI * 2 + t * 0.7;
        s.position.set(Math.sin(a) * 1.7, 1.9 + Math.sin(t * 2 + i) * 0.2, Math.cos(a) * 1.7);
        s.rotation.y = -t * 0.8;
      });
    };
    g.userData.crystal = crystal;
    return g;
  }
  function turret() {
    const g = new THREE.Group();
    const stoneM = toonMat('#94a3b8');
    const base = cyl(0.5, 0.7, 1.2, stoneM, 7); base.position.y = 0.6; g.add(base);
    const top = new THREE.Group(); top.position.y = 1.3; g.add(top);
    const head = sphere(0.42, toonMat('#64748b'), 10, 8); head.position.y = 0.2; top.add(head);
    const barrel = cyl(0.07, 0.1, 0.6, toonMat('#334155'), 7); barrel.rotation.x = Math.PI / 2.4; barrel.position.set(0, 0.28, 0.28); top.add(barrel);
    const gem = sphere(0.12, basicMat('#22d3ee'), 8, 6); gem.position.y = 0.55; top.add(gem);
    g.userData.top = top;
    g.userData.anim = (t) => { gem.rotation.y = t * 2; };
    return g;
  }

  /* Barra de vida flotante */
  function hpBar(width = 1.2, color = '#10b981') {
    const g = new THREE.Group();
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#0f172a', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
    bg.scale.set(width, 0.12, 1);
    const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, depthWrite: false, depthTest: false }));
    fg.scale.set(width - 0.03, 0.085, 1);
    fg.center.set(0, 0.5);
    fg.position.set(-(width - 0.03) / 2, 0, 0.001);
    g.add(bg, fg);
    g.userData.fg = fg;
    g.userData.width = width - 0.03;
    g.renderOrder = 20;
    return g;
  }

  function dispose(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (!Object.values(matCache).includes(m)) m.dispose(); });
      }
    });
  }

  return {
    toonMat, basicMat, gradientMap, capsule, box, sphere, cone, cyl, addOutline, tex,
    character, weapon, weaponGlow, enemy, bossDecor,
    tree, rock, crystalMesh, chest, portal, house, campfire, baseCrystal, turret, hpBar,
    fence, lamp, well, barrel,
    faceTexture, shade, dispose
  };
})();
