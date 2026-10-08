/* ============================================================
   AETHERIA — engine.js
   Renderer, mundos temáticos con terreno, iluminación,
   ciclo día/noche y rig de cámara (aérea / 3ª / 1ª persona)
   ============================================================ */
'use strict';

const Engine = (() => {

  let renderer, scene, camera, hemiLight, dirLight, dirLightTarget;
  let quality = 'high';
  let worldRoot = null, animProps = [], terrainMesh = null, waterMesh = null;
  let skyMesh = null, sun = null, starField = null, cloudGroup = null;
  let heightFn = null, worldSize = 300;
  let clockT = 0;
  let dayNightOn = false, daySpeed = 1 / 240; // ciclo completo en 4 min
  let fogColorDay = new THREE.Color(), fogColorNight = new THREE.Color();

  const THEMES = {
    meadow:  { sky: { top: '#2563eb', mid: '#7dd3fc', bot: '#fef3c7' }, fog: '#a8d5f2', sun: '#fff2c8', grass: '#48a860', grass2: '#3d8f52', water: '#0ea5e9', ambient: '#fbcfe8', hemi: 0.85 },
    desert:  { sky: { top: '#0284c7', mid: '#fbbf24', bot: '#fde68a' }, fog: '#f2d5a0', sun: '#fff0b8', grass: '#d9a45b', grass2: '#c08b46', water: '#0ea5e9', ambient: '#fde68a', hemi: 0.9 },
    snow:    { sky: { top: '#1e3a8a', mid: '#93c5fd', bot: '#e0f2fe' }, fog: '#cfe4f5', sun: '#eaf4ff', grass: '#e8f2f8', grass2: '#d5e5ef', water: '#38bdf8', ambient: '#e0f2fe', hemi: 0.95 },
    volcano: { sky: { top: '#450a0a', mid: '#b91c1c', bot: '#f97316' }, fog: '#c26a4a', sun: '#ffca8a', grass: '#5b4a44', grass2: '#4a3c38', water: '#ea580c', ambient: '#fdba74', hemi: 0.7 },
    void:    { sky: { top: '#0f0524', mid: '#4c1d95', bot: '#a78bfa' }, fog: '#6d5b9e', sun: '#d8b4fe', grass: '#4c3a75', grass2: '#3d2f60', water: '#7c3aed', ambient: '#c4b5fd', hemi: 0.6 },
    royale:  { sky: { top: '#0c4a6e', mid: '#38bdf8', bot: '#fde68a' }, fog: '#a5d8e8', sun: '#fff2c8', grass: '#55a06a', grass2: '#47885a', water: '#0ea5e9', ambient: '#bbf7d0', hemi: 0.85 }
  };

  /* ---------- Init ---------- */
  function init(canvas) {
    const s = Save.data.settings;
    quality = s.quality === 'auto' ? guessQuality() : s.quality;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if (quality === 'high') {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

    hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x6b8f5a, 0.9);
    scene.add(hemiLight);
    dirLight = new THREE.DirectionalLight(0xfff2c8, 1.35);
    dirLight.position.set(60, 90, 40);
    if (quality === 'high') {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(1024, 1024);
      dirLight.shadow.camera.left = -60; dirLight.shadow.camera.right = 60;
      dirLight.shadow.camera.top = 60; dirLight.shadow.camera.bottom = -60;
      dirLight.shadow.camera.far = 260;
      dirLight.shadow.bias = -0.002;
    }
    scene.add(dirLight);
    dirLightTarget = new THREE.Object3D();
    scene.add(dirLightTarget);
    dirLight.target = dirLightTarget;

    VFX.attachScene(scene);
    VFX.initParticles(scene);

    window.addEventListener('resize', onResize);
    return { renderer, scene, camera };
  }

  function guessQuality() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    return (mem >= 6 && cores >= 8) ? 'high' : (mem >= 3 ? 'medium' : 'low');
  }
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---------- Construcción de mundo ---------- */
  function clearWorld() {
    if (!worldRoot) return;
    worldRoot.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material._shared) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
    scene.remove(worldRoot);
    worldRoot = null; animProps = []; terrainMesh = null; waterMesh = null;
    if (skyMesh) { scene.remove(skyMesh); skyMesh = null; }
    if (sun) { scene.remove(sun); sun = null; }
    if (starField) { scene.remove(starField); starField = null; }
    if (cloudGroup) { scene.remove(cloudGroup); cloudGroup = null; }
  }

  function buildWorld(themeName, opts = {}) {
    clearWorld();
    const T = THEMES[themeName] || THEMES.meadow;
    worldSize = opts.size || 300;
    worldRoot = new THREE.Group();
    scene.add(worldRoot);

    /* Cielo */
    skyMesh = VFX.skyDome(T.sky);
    skyMesh.userData = { top: T.sky.top, mid: T.sky.mid, bot: T.sky.bot };
    scene.add(skyMesh);
    sun = VFX.sunSprite(T.sun);
    sun.position.set(220, 260, 140);
    scene.add(sun);
    starField = VFX.stars(340);
    scene.add(starField);
    cloudGroup = VFX.clouds(themeName === 'void' ? 8 : 14, themeName === 'volcano' ? '#99552a' : '#ffffff');
    scene.add(cloudGroup);

    /* Fog */
    fogColorDay = new THREE.Color(T.fog);
    fogColorNight = new THREE.Color(shadeHex(T.fog, -38));
    scene.fog = new THREE.Fog(fogColorDay.clone(), worldSize * 0.35, worldSize * 1.35);
    renderer.setClearColor(fogColorDay);

    /* Terreno con altura por tema */
    const seg = quality === 'low' ? 48 : 72;
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    heightFn = makeHeightFn(themeName, opts);
    const cGrass = new THREE.Color(T.grass), cGrass2 = new THREE.Color(T.grass2);
    const cPath = new THREE.Color(shadeHex(T.grass, 14));
    const colorArr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = heightFn(x, z);
      pos.setY(i, y);
      // variación de color
      const n = Math.sin(x * 0.11 + z * 0.07) * Math.cos(x * 0.05 - z * 0.13);
      const c = cGrass.clone().lerp(cGrass2, n * 0.5 + 0.5);
      if (Math.abs(x) < 4.5 && Math.abs(z) < 26) c.lerp(cPath, 0.55); // camino central
      colorArr[i * 3] = c.r; colorArr[i * 3 + 1] = c.g; colorArr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.computeVertexNormals();
    const groundMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: Models.gradientMap(3) });
    terrainMesh = new THREE.Mesh(geo, groundMat);
    if (quality === 'high') { terrainMesh.receiveShadow = true; }
    worldRoot.add(terrainMesh);

    /* Agua (isla de royale o lagos) */
    if (opts.water) {
      waterMesh = VFX.waterPlane(worldSize * 1.9, T.water, shadeHex(T.water, 18));
      waterMesh.position.y = opts.waterLevel !== undefined ? opts.waterLevel : -1.6;
      worldRoot.add(waterMesh);
    }

    /* Vegetación / props */
    const rng = U.seeded(opts.seed || 12345);
    const nTrees = opts.trees !== undefined ? opts.trees : (quality === 'low' ? 40 : 80);
    for (let i = 0; i < nTrees; i++) {
      const x = (rng() - 0.5) * (worldSize - 24), z = (rng() - 0.5) * (worldSize - 24);
      if (Math.abs(x) < 8 && Math.abs(z) < 34) continue; // camino despejado
      if (opts.keepClear && U.dist2(x, z, 0, 0) < opts.keepClear) continue;
      const tr = Models.tree(themeName, rng);
      tr.position.set(x, heightFn(x, z), z);
      worldRoot.add(tr);
    }
    const nRocks = quality === 'low' ? 12 : 26;
    for (let i = 0; i < nRocks; i++) {
      const x = (rng() - 0.5) * (worldSize - 20), z = (rng() - 0.5) * (worldSize - 20);
      if (Math.abs(x) < 7 && Math.abs(z) < 30) continue;
      const rk = Models.rock(themeName, rng);
      rk.position.set(x, heightFn(x, z), z);
      worldRoot.add(rk);
    }

    /* Partículas ambientales */
    const amb = VFX.ambientParticles(T.ambient, quality === 'low' ? 24 : 50, 16);
    worldRoot.add(amb);

    /* Bordes del mundo: muralla visual */
    const wallM = Models.toonMat(shadeHex(T.grass, -25));
    for (let i = 0; i < 4; i++) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(worldSize + 8, 10, 3), wallM);
      const a = i * Math.PI / 2;
      wall.position.set(Math.sin(a) * (worldSize / 2 + 1), 3, Math.cos(a) * (worldSize / 2 + 1));
      wall.rotation.y = a;
      worldRoot.add(wall);
    }

    hemiLight.intensity = T.hemi;
    hemiLight.color = new THREE.Color(T.sky.mid);
    return { theme: themeName, T };
  }

  function makeHeightFn(theme, opts) {
    const scale = opts.hilliness !== undefined ? opts.hilliness : 1;
    const size = opts.size || 300;
    const half = size / 2;
    return (x, z) => {
      let h = Math.sin(x * 0.028) * Math.cos(z * 0.024) * 2.6 * scale
            + Math.sin(x * 0.011 + 2.1) * Math.cos(z * 0.013) * 4.2 * scale
            + Math.sin(x * 0.15) * Math.sin(z * 0.12) * 0.35 * scale;
      // Zona central plana (base)
      const d = Math.hypot(x, z);
      const flat = U.clamp((d - 16) / 22, 0, 1);
      h *= 0.15 + 0.85 * flat;
      if (opts.island) {
        // caída hacia el borde para isla
        const edge = U.clamp((half - 14 - Math.max(Math.abs(x), Math.abs(z))) / 30, 0, 1);
        h = h * edge - (1 - edge) * 6;
      }
      return h;
    };
  }

  function groundY(x, z) {
    if (!heightFn) return 0;
    return heightFn(U.clamp(x, -worldSize / 2 + 2, worldSize / 2 - 2), U.clamp(z, -worldSize / 2 + 2, worldSize / 2 - 2));
  }
  function registerAnim(fn) { animProps.push(fn); }
  function unregisterAnim(fn) { const i = animProps.indexOf(fn); if (i >= 0) animProps.splice(i, 1); }

  /* ---------- Día / noche ---------- */
  function setDayNight(enabled, speed) {
    dayNightOn = enabled;
    if (speed) daySpeed = speed;
    if (!enabled) setTimeOfDay(0.35);
  }
  let dayT = 0.35;
  function setTimeOfDay(t) { dayT = t; applyDayNight(); }
  function applyDayNight() {
    // 0..1: 0.25 mediodía, 0.75 noche
    const sunAngle = (dayT - 0.25) * Math.PI * 2;
    const sunH = Math.sin(dayT * Math.PI * 2 - Math.PI * 0.5) * 0.5 + 0.5; // 1 día, 0 noche aprox
    const daylight = U.clamp(Math.cos((dayT - 0.25) * Math.PI * 2) * 0.5 + 0.5, 0, 1);
    const lx = Math.cos(sunAngle) * 200, ly = 60 + daylight * 200, lz = 80;
    dirLight.position.set(lx, Math.max(20, ly), lz * 0.4);
    sun.position.set(lx, Math.max(-40, ly), lz);
    dirLight.intensity = 0.25 + daylight * 1.15;
    hemiLight.intensity = 0.28 + daylight * 0.65;
    const c = fogColorDay.clone().lerp(fogColorNight, 1 - daylight);
    scene.fog.color.copy(c);
    renderer.setClearColor(c);
    if (starField) starField.userData.mat.opacity = Math.max(0, 0.9 - daylight * 1.4);
    if (skyMesh && skyMesh.userData.top) {
      const u = skyMesh.material.uniforms;
      const night = { top: '#050515', mid: '#0b1030', bot: '#1a1240' };
      u.topColor.value.lerpColors(new THREE.Color(night.top), new THREE.Color(skyMesh.userData.top), daylight);
      u.midColor.value.lerpColors(new THREE.Color(night.mid), new THREE.Color(skyMesh.userData.mid), daylight);
      u.botColor.value.lerpColors(new THREE.Color(night.bot), new THREE.Color(skyMesh.userData.bot), daylight);
    }
  }

  /* ---------- Cámara ---------- */
  const CamRig = {
    mode: 'third', // third | first | aerial
    target: new THREE.Vector3(0, 0, 0),
    yaw: 0, pitch: 0.32,
    dist: 11, height: 5,
    sens: 1, invertX: false,
    _pos: new THREE.Vector3(0, 8, 14),
    _look: new THREE.Vector3(),
    dragActive: false,

    setMode(m) {
      this.mode = m;
      camera.fov = m === 'aerial' ? 50 : m === 'first' ? 70 : 58;
      camera.updateProjectionMatrix();
      if (m === 'aerial') { this.dist = 42; this.pitch = 1.05; }
      else if (m === 'first') { this.dist = 0.01; this.pitch = 0.1; }
      else { this.dist = 11; this.pitch = 0.32; }
    },
    orbit(dx, dy) {
      const s = this.sens * (this.mode === 'aerial' ? 0.004 : 0.006);
      this.yaw -= (this.invertX ? -dx : dx) * s;
      this.pitch = U.clamp(this.pitch + dy * s, this.mode === 'aerial' ? 0.7 : -0.2, 1.25);
    },
    zoom(delta) { this.dist = U.clamp(this.dist + delta, 6, 70); },

    update(dt, targetPos, opts = {}) {
      const shk = VFX.updateShake(dt);
      const shx = (Math.random() - 0.5) * shk * 0.6, shy = (Math.random() - 0.5) * shk * 0.6;
      const m = this.mode;

      if (m === 'first') {
        // Primera persona: sobre la cabeza del objetivo
        const head = new THREE.Vector3(targetPos.x, targetPos.y + 1.55, targetPos.z);
        const back = new THREE.Vector3(Math.sin(this.yaw + Math.PI) * 0.3, 0, Math.cos(this.yaw + Math.PI) * 0.3);
        this._pos.lerp(head.clone().add(back), 1 - Math.exp(-20 * dt));
        this._look.set(
          targetPos.x + Math.sin(this.yaw) * 10,
          targetPos.y + 1.55 + Math.tan(-this.pitch) * 8,
          targetPos.z + Math.cos(this.yaw) * 10
        );
        camera.position.copy(this._pos).add(new THREE.Vector3(shx, shy, 0));
        camera.lookAt(this._look);
        return;
      }

      const dist = m === 'aerial' ? this.dist : this.dist;
      const hOff = Math.sin(this.pitch) * dist;
      const fOff = Math.cos(this.pitch) * dist;
      const desired = new THREE.Vector3(
        targetPos.x - Math.sin(this.yaw) * fOff,
        targetPos.y + (m === 'aerial' ? hOff : 1.2 + Math.sin(this.pitch) * dist * 0.55),
        targetPos.z - Math.cos(this.yaw) * fOff
      );
      // No hundirse en el terreno
      const gy = groundY(desired.x, desired.z) + 0.6;
      if (desired.y < gy) desired.y = gy;
      const lag = opts.fast ? 14 : 7;
      this._pos.x = U.damp(this._pos.x, desired.x, lag, dt);
      this._pos.y = U.damp(this._pos.y, desired.y, lag, dt);
      this._pos.z = U.damp(this._pos.z, desired.z, lag, dt);
      const lookY = m === 'aerial' ? 0 : targetPos.y + 1.1;
      this._look.x = U.damp(this._look.x, targetPos.x, lag, dt);
      this._look.y = U.damp(this._look.y, lookY, lag, dt);
      this._look.z = U.damp(this._look.z, targetPos.z, lag, dt);
      camera.position.set(this._pos.x + shx, this._pos.y + shy, this._pos.z);
      camera.lookAt(this._look);
    }
  };

  /* ---------- Sombra blob barata ---------- */
  const shadowPool = [];
  function blobShadow(obj, size = 1.2) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(size * 0.5, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    const entry = { m, obj, size };
    shadowPool.push(entry);
    return entry;
  }
  function removeBlobShadow(entry) {
    const i = shadowPool.indexOf(entry);
    if (i >= 0) shadowPool.splice(i, 1);
    if (entry.m.parent) entry.m.parent.remove(entry.m);
    entry.m.geometry.dispose(); entry.m.material.dispose();
  }
  function updateShadows() {
    for (const s of shadowPool) {
      s.m.position.set(s.obj.position.x, groundY(s.obj.position.x, s.obj.position.z) + 0.08, s.obj.position.z);
    }
  }

  /* ---------- Update por frame ---------- */
  function update(dt, playerPos) {
    clockT += dt;
    if (dayNightOn) {
      dayT = (dayT + dt * daySpeed) % 1;
      applyDayNight();
    }
    for (const fn of animProps) fn(clockT, dt);
    if (waterMesh) waterMesh.userData.mat.uniforms.t.value = clockT;
    VFX.updateAmbient(dt, clockT, playerPos || { x: 0, z: 0 });
    updateShadows();
    if (skyMesh) skyMesh.position.set(camera.position.x, 0, camera.position.z);
    if (starField) starField.position.set(camera.position.x, 0, camera.position.z);
    if (cloudGroup) cloudGroup.position.set(camera.position.x * 0.9, 0, camera.position.z * 0.9);
    if (dirLightTarget && playerPos) {
      dirLightTarget.position.set(playerPos.x, 0, playerPos.z);
      dirLight.position.set(playerPos.x + 60, 90, playerPos.z + 40);
    }
    VFX.updateAll(dt, clockT);
  }

  function shadeHex(hex, amt) {
    const c = new THREE.Color(hex);
    const hsl = {}; c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, U.clamp(hsl.l + amt / 100, 0, 1));
    return '#' + c.getHexString();
  }

  return {
    init, buildWorld, clearWorld, groundY, registerAnim, unregisterAnim,
    setDayNight, setTimeOfDay,
    CamRig, blobShadow, removeBlobShadow, update,
    THEMES, get scene() { return scene; }, get camera() { return camera; },
    get renderer() { return renderer; }, get quality() { return quality; },
    get worldSize() { return worldSize; },
    get clockT() { return clockT; }
  };
})();
