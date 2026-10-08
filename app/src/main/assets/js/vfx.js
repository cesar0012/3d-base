/* ============================================================
   AETHERIA — vfx.js
   Partículas, cielo, agua, números de daño, telegrafías, flash
   ============================================================ */
'use strict';

const VFX = (() => {

  /* ---------- Texturas utilitarias ---------- */
  let _glowTex = null;
  function glowTex() {
    if (_glowTex) return _glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    _glowTex = new THREE.CanvasTexture(c);
    return _glowTex;
  }
  let _softTex = null;
  function softTex() {
    if (_softTex) return _softTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 1, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    _softTex = new THREE.CanvasTexture(c);
    return _softTex;
  }

  /* ---------- Sistema de partículas (pool con Points) ---------- */
  const MAX_P = 1400;
  let scene = null, geo, points, positions, colors, sizes, pArr = [];
  function initParticles(sc) {
    scene = sc;
    positions = new Float32Array(MAX_P * 3);
    colors = new Float32Array(MAX_P * 3);
    sizes = new Float32Array(MAX_P);
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: softTex() } },
      vertexShader: `
        attribute float size; varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D tex; varying vec3 vColor;
        void main() {
          vec4 t = texture2D(tex, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * t;
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    for (let i = 0; i < MAX_P; i++) pArr.push({ alive: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, grav: -9.8, r: 1, g: 1, b: 1, drag: 0 });
  }

  function spawn(x, y, z, o = {}) {
    for (let i = 0; i < MAX_P; i++) {
      const p = pArr[i];
      if (!p.alive) {
        p.alive = true;
        p.x = x; p.y = y; p.z = z;
        p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
        p.life = p.maxLife = o.life || 0.7;
        p.size = o.size || 0.35;
        p.grav = o.grav !== undefined ? o.grav : -9.8;
        p.drag = o.drag || 0;
        const c = new THREE.Color(o.color || '#ffffff');
        p.r = c.r; p.g = c.g; p.b = c.b;
        return;
      }
    }
  }
  function burst(pos, count, color, o = {}) {
    const spd = o.speed || 4, up = o.up !== undefined ? o.up : 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random();
      spawn(pos.x, pos.y + (o.yOff || 0.5), pos.z, {
        vx: Math.cos(a) * spd * r, vy: up * (0.4 + Math.random() * 0.8), vz: Math.sin(a) * spd * r,
        life: (o.life || 0.7) * (0.6 + Math.random() * 0.7),
        size: (o.size || 0.35) * (0.7 + Math.random() * 0.6),
        color, grav: o.grav !== undefined ? o.grav : -9.8, drag: o.drag || 1.5
      });
    }
  }
  function ringBurst(pos, count, color, radius, o = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      spawn(pos.x, pos.y + (o.yOff || 0.4), pos.z, {
        vx: Math.cos(a) * radius * (o.speed || 1.6), vy: o.vy || 1, vz: Math.sin(a) * radius * (o.speed || 1.6),
        life: o.life || 0.8, size: o.size || 0.4, color, grav: o.grav !== undefined ? o.grav : -2
      });
    }
  }
  function updateParticles(dt) {
    if (!points) return;
    for (let i = 0; i < MAX_P; i++) {
      const p = pArr[i];
      if (!p.alive) { sizes[i] = 0; continue; }
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; p.y = -999; sizes[i] = 0; continue; }
      p.vy += p.grav * dt;
      if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const lr = p.life / p.maxLife;
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
      colors[i * 3] = p.r * lr; colors[i * 3 + 1] = p.g * lr; colors[i * 3 + 2] = p.b * lr;
      sizes[i] = p.size * (0.5 + lr * 0.7);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  }

  /* ---------- Trails de proyectiles ---------- */
  function trail(pos, color, size = 0.3, life = 0.35) {
    spawn(pos.x, pos.y, pos.z, { life, size, color, grav: 0 });
  }

  /* ---------- Anillos de impacto ---------- */
  const rings = [];
  function ring(pos, color = '#ffffff', maxR = 5, dur = 0.5, yOff = 0.15) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.62, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, pos.y + yOff, pos.z);
    scene.add(m);
    rings.push({ m, t: 0, dur, maxR });
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
      const s = 0.4 + p * r.maxR;
      r.m.scale.setScalar(s / 0.5);
      r.m.material.opacity = 0.85 * (1 - p);
    }
  }

  /* ---------- Telegraph (aviso de AoE enemiga) ---------- */
  const telegraphs = [];
  function telegraph(pos, radius, duration, color = '#ef4444') {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, pos.y + 0.12, pos.z);
    scene.add(m);
    const border = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.94, radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    border.rotation.x = -Math.PI / 2;
    border.position.set(pos.x, pos.y + 0.13, pos.z);
    scene.add(border);
    telegraphs.push({ m, border, t: 0, dur: duration });
    return { m, border };
  }
  function updateTelegraphs(dt) {
    for (let i = telegraphs.length - 1; i >= 0; i--) {
      const tg = telegraphs[i];
      tg.t += dt;
      const p = Math.min(1, tg.t / tg.dur);
      tg.m.material.opacity = 0.15 + p * 0.3 + Math.sin(tg.t * 10) * 0.05;
      if (p >= 1) {
        scene.remove(tg.m, tg.border);
        tg.m.geometry.dispose(); tg.m.material.dispose();
        tg.border.geometry.dispose(); tg.border.material.dispose();
        telegraphs.splice(i, 1);
      }
    }
  }
  function clearTelegraphs() {
    telegraphs.forEach(tg => { scene.remove(tg.m, tg.border); tg.m.geometry.dispose(); tg.m.material.dispose(); tg.border.geometry.dispose(); tg.border.material.dispose(); });
    telegraphs.length = 0;
  }

  /* ---------- Números de daño (HTML pool) ---------- */
  let dmgPool = [], dmgLayer = null, cameraRef = null;
  function initDamageNumbers(camera, layerEl) {
    cameraRef = camera; dmgLayer = layerEl;
    for (let i = 0; i < 24; i++) {
      const d = document.createElement('div');
      d.className = 'dmg-num';
      d.style.opacity = '0';
      layerEl.appendChild(d);
      dmgPool.push({ el: d, alive: false, t: 0, x: 0, y: 0, z: 0, rise: 0 });
    }
  }
  const _v = new THREE.Vector3();
  function dmgNumber(pos, text, cls = '') {
    for (const d of dmgPool) {
      if (!d.alive) {
        d.alive = true; d.t = 0; d.rise = 0;
        d.x = pos.x; d.y = pos.y; d.z = pos.z;
        d.el.textContent = text;
        d.el.className = 'dmg-num ' + cls;
        return;
      }
    }
  }
  function updateDamageNumbers(dt) {
    if (!cameraRef || !dmgLayer) return;
    for (const d of dmgPool) {
      if (!d.alive) continue;
      d.t += dt; d.rise += dt * 1.6;
      if (d.t > 0.9) { d.alive = false; d.el.style.opacity = '0'; continue; }
      _v.set(d.x, d.y + d.rise, d.z).project(cameraRef);
      if (_v.z > 1) { d.el.style.opacity = '0'; continue; }
      const sx = (_v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_v.y * 0.5 + 0.5) * window.innerHeight;
      const sc = U.clamp(1.4 - d.rise * 0.3, 0.7, 1.3);
      d.el.style.transform = `translate(-50%,-50%) translate(${sx}px,${sy}px) scale(${sc})`;
      d.el.style.opacity = d.t < 0.15 ? (d.t / 0.15) : String(U.clamp(1.6 - d.t * 1.6, 0, 1));
    }
  }

  /* ---------- Flash de pantalla y shake ---------- */
  let shakeAmt = 0, shakeEnabled = true;
  function shake(amt) { if (shakeEnabled) shakeAmt = Math.min(1.2, shakeAmt + amt); }
  function updateShake(dt) { shakeAmt = Math.max(0, shakeAmt - dt * 2.4); return shakeAmt; }
  let flashEl = null;
  function setFlashEl(el) { flashEl = el; }
  function flash(color = '#ffffff', opacity = 0.5, dur = 200) {
    if (!flashEl) return;
    flashEl.style.background = color;
    flashEl.style.transition = 'none';
    flashEl.style.opacity = String(opacity);
    requestAnimationFrame(() => {
      flashEl.style.transition = `opacity ${dur}ms ease-out`;
      flashEl.style.opacity = '0';
    });
  }

  /* ---------- Cielo procedural ---------- */
  function skyDome(themeColors = {}) {
    const top = themeColors.top || '#3b82f6', mid = themeColors.mid || '#7dd3fc', bot = themeColors.bot || '#fde68a';
    const geo = new THREE.SphereGeometry(560, 24, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(top) },
        midColor: { value: new THREE.Color(mid) },
        botColor: { value: new THREE.Color(bot) },
        offset: { value: 20 }, exponent: { value: 0.7 }
      },
      vertexShader: `varying vec3 vWorld; void main() { vWorld = normalize((modelMatrix * vec4(position,1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor, midColor, botColor; uniform float offset, exponent; varying vec3 vWorld;
        void main() {
          float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = h < 0.5 ? mix(botColor, midColor, smoothstep(0.2, 0.5, h)) : mix(midColor, topColor, smoothstep(0.5, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    return sky;
  }
  function sunSprite(color = '#fff7d6') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.setScalar(90);
    return s;
  }
  /* Nubes: sprites suaves */
  function clouds(n = 14, color = '#ffffff', height = 90) {
    const group = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const w = 30 + Math.random() * 50;
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color, transparent: true, opacity: 0.25 + Math.random() * 0.25, depthWrite: false, fog: false }));
      c.scale.set(w, w * 0.35, 1);
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260;
      c.position.set(Math.cos(a) * r, height + Math.random() * 40, Math.sin(a) * r);
      group.add(c);
    }
    return group;
  }
  /* Estrellas para la noche */
  function stars(n = 300) {
    const group = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.48 + 0.05, r = 500;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const p = new THREE.Points(geo, mat);
    group.add(p);
    group.userData.mat = mat;
    return group;
  }

  /* ---------- Agua animada ---------- */
  function waterPlane(size, colorA = '#0ea5e9', colorB = '#22d3ee') {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        t: { value: 0 },
        colA: { value: new THREE.Color(colorA) },
        colB: { value: new THREE.Color(colorB) },
        fogColor: { value: new THREE.Color('#bae6fd') },
        fogNear: { value: 60 }, fogFar: { value: 320 }
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vWorld;
        void main(){ vUv = uv; vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float t; uniform vec3 colA, colB, fogColor; uniform float fogNear, fogFar;
        varying vec2 vUv; varying vec3 vWorld;
        void main(){
          float w = sin(vUv.x*40.0 + t*1.6) * sin(vUv.y*34.0 - t*1.3);
          float w2 = sin((vUv.x+vUv.y)*60.0 + t*2.2)*0.5;
          vec3 col = mix(colA, colB, 0.5 + w*0.25 + w2*0.25);
          float sparkle = smoothstep(0.92, 1.0, w + w2);
          col += sparkle * 0.35;
          float depth = smoothstep(fogNear, fogFar, length(vWorld.xz));
          col = mix(col, fogColor, depth);
          gl_FragColor = vec4(col, 0.86);
        }`,
      transparent: true
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.userData.mat = mat;
    return m;
  }

  /* ---------- Haz / rayo ---------- */
  const beams = [];
  function beam(from, to, color = '#facc15', dur = 0.18, width = 0.15) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(width, width * 0.5, len, 6, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    scene.add(m);
    beams.push({ m, t: 0, dur });
  }
  function updateBeams(dt) {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t += dt;
      if (b.t >= b.dur) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); beams.splice(i, 1); continue; }
      b.m.material.opacity = 0.95 * (1 - b.t / b.dur);
      b.m.scale.x = b.m.scale.z = 1 - b.t / b.dur;
    }
  }

  /* ---------- Petalos / hojas ambientales ---------- */
  let ambient = null;
  function ambientParticles(color = '#fbcfe8', n = 60, height = 14) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color, transparent: true, opacity: 0.5, depthWrite: false }));
      s.scale.setScalar(0.3 + Math.random() * 0.3);
      s.position.set((Math.random() - 0.5) * 140, Math.random() * height, (Math.random() - 0.5) * 140);
      s.userData.spd = 0.3 + Math.random() * 0.5;
      s.userData.ph = Math.random() * 7;
      g.add(s);
    }
    g.userData.height = height;
    ambient = g;
    return g;
  }
  function updateAmbient(dt, t, center) {
    if (!ambient) return;
    if (center) ambient.position.set(center.x, 0, center.z);
    ambient.children.forEach(s => {
      s.position.y -= s.userData.spd * dt;
      s.position.x += Math.sin(t + s.userData.ph) * dt * 0.5;
      if (s.position.y < 0) { s.position.y = ambient.userData.height; s.position.x = (Math.random() - 0.5) * 140; s.position.z = (Math.random() - 0.5) * 140; }
    });
  }

  function updateAll(dt, t) {
    updateParticles(dt); updateRings(dt); updateTelegraphs(dt); updateDamageNumbers(dt); updateBeams(dt);
  }
  function attachScene(sc) { scene = sc; }

  return {
    glowTex, softTex, initParticles, attachScene, spawn, burst, ringBurst, trail,
    ring, telegraph, clearTelegraphs, initDamageNumbers, dmgNumber,
    shake, updateShake, setFlashEl, flash,
    skyDome, sunSprite, clouds, stars, waterPlane, beam, ambientParticles, updateAmbient,
    updateAll,
    get shakeAmt() { return shakeAmt; },
    setShakeEnabled(v) { shakeEnabled = v; if (!v) shakeAmt = 0; }
  };
})();
