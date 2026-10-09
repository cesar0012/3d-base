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
    meadow:  { sky: { top: '#2563eb', mid: '#7dd3fc', bot: '#fef3c7' }, fog: '#a8d5f2', sun: '#fff2c8', grass: '#48a860', grass2: '#3d8f52', rock: '#8d9277', water: '#0ea5e9', ambient: '#fbcfe8', hemi: 0.85, tex: 'grass' },
    desert:  { sky: { top: '#0284c7', mid: '#fbbf24', bot: '#fde68a' }, fog: '#f2d5a0', sun: '#fff0b8', grass: '#d9a45b', grass2: '#c08b46', rock: '#a97f4e', water: '#0ea5e9', ambient: '#fde68a', hemi: 0.9, tex: 'ground' },
    snow:    { sky: { top: '#1e3a8a', mid: '#93c5fd', bot: '#e0f2fe' }, fog: '#cfe4f5', sun: '#eaf4ff', grass: '#e8f2f8', grass2: '#d5e5ef', rock: '#94a9bb', water: '#38bdf8', ambient: '#e0f2fe', hemi: 0.95, tex: 'snow' },
    volcano: { sky: { top: '#450a0a', mid: '#b91c1c', bot: '#f97316' }, fog: '#c26a4a', sun: '#ffca8a', grass: '#5b4a44', grass2: '#4a3c38', rock: '#38302b', water: '#ea580c', ambient: '#fdba74', hemi: 0.7, tex: 'rock' },
    void:    { sky: { top: '#0f0524', mid: '#4c1d95', bot: '#a78bfa' }, fog: '#6d5b9e', sun: '#d8b4fe', grass: '#4c3a75', grass2: '#3d2f60', rock: '#53417d', water: '#7c3aed', ambient: '#c4b5fd', hemi: 0.6, tex: 'rock' },
    royale:  { sky: { top: '#0c4a6e', mid: '#38bdf8', bot: '#fde68a' }, fog: '#a5d8e8', sun: '#fff2c8', grass: '#55a06a', grass2: '#47885a', rock: '#84929e', water: '#0ea5e9', ambient: '#bbf7d0', hemi: 0.85, tex: 'grass' }
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
    worldRoot = null; animProps = []; terrainMesh = null; waterMesh = null; grassMat = null; colliders = [];
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
    const seg = quality === 'low' ? 48 : quality === 'medium' ? 72 : 96;
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    heightFn = makeHeightFn(themeName, opts);
    const cGrass = new THREE.Color(T.grass), cGrass2 = new THREE.Color(T.grass2);
    const cRock = new THREE.Color(T.rock);
    const cPath = new THREE.Color(shadeHex(T.grass, 14));
    const WHITE = new THREE.Color('#ffffff');
    const colorArr = new Float32Array(pos.count * 3);
    const tmpC = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = heightFn(x, z);
      pos.setY(i, y);
      // dos octavas de variación (manchas grandes + moteado fino)
      const n1 = Math.sin(x * 0.11 + z * 0.07) * Math.cos(x * 0.05 - z * 0.13);
      const n2 = Math.sin(x * 0.42 + z * 0.36) * Math.cos(x * 0.31 + z * 0.44);
      tmpC.copy(cGrass).lerp(cGrass2, U.clamp(n1 * 0.7 + n2 * 0.3, -1, 1) * 0.5 + 0.5);
      // pendiente → tinte rocoso
      const hx = heightFn(x + 1.4, z) - heightFn(x - 1.4, z);
      const hz = heightFn(x, z + 1.4) - heightFn(x, z - 1.4);
      const slope = Math.sqrt(hx * hx + hz * hz) / 2.8;
      if (slope > 0.32) tmpC.lerp(cRock, Math.min(0.85, (slope - 0.32) * 1.9));
      // tinte por altura (cumbres más claras)
      tmpC.offsetHSL(0, 0, U.clamp(y * 0.008, 0, 0.07));
      if (Math.abs(x) < 4.5 && Math.abs(z) < 26) tmpC.lerp(cPath, 0.55); // camino central
      // aclarar el tinte para que la textura fotográfica aporte el color base
      tmpC.lerp(WHITE, 0.62);
      colorArr[i * 3] = tmpC.r; colorArr[i * 3 + 1] = tmpC.g; colorArr[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.computeVertexNormals();
    // Texturas PBR CC0 (ambientCG) empaquetadas: color × tinte del vértice + normal map
    const texName = T.tex || 'grass';
    const cTex = Models.tex(texName + '_c');
    const nTex = Models.tex(texName + '_n');
    const tile = worldSize / 13;
    cTex.repeat.set(tile, tile); nTex.repeat.set(tile, tile);
    const groundMat = new THREE.MeshToonMaterial({
      vertexColors: true, map: cTex, gradientMap: Models.gradientMap(3)
    });
    if (nTex) { groundMat.normalMap = nTex; groundMat.normalScale = new THREE.Vector2(0.55, 0.55); }
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
    clearColliders();
    const rng = U.seeded(opts.seed || 12345);
    /* Campo de hierba con viento */
    const grass = buildGrassField(themeName, worldSize, rng, opts);
    if (grass) worldRoot.add(grass);
    const nTrees = opts.trees !== undefined ? opts.trees : (quality === 'low' ? 40 : 80);
    for (let i = 0; i < nTrees; i++) {
      const x = (rng() - 0.5) * (worldSize - 24), z = (rng() - 0.5) * (worldSize - 24);
      if (Math.abs(x) < 8 && Math.abs(z) < 34) continue; // camino despejado
      if (opts.keepClear && U.dist2(x, z, 0, 0) < opts.keepClear) continue;
      const tr = Models.tree(themeName, rng);
      tr.position.set(x, heightFn(x, z), z);
      worldRoot.add(tr);
      addCollider(x, z, 0.75); // tronco
    }
    const nRocks = quality === 'low' ? 12 : 26;
    for (let i = 0; i < nRocks; i++) {
      const x = (rng() - 0.5) * (worldSize - 20), z = (rng() - 0.5) * (worldSize - 20);
      if (Math.abs(x) < 7 && Math.abs(z) < 30) continue;
      const rk = Models.rock(themeName, rng);
      rk.position.set(x, heightFn(x, z), z);
      worldRoot.add(rk);
      addCollider(x, z, 1.0);
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
    // semilla por mundo para que cada partida tenga desniveles distintos
    const o1 = (opts.seed || 0) % 7 * 0.7, o2 = (opts.seed || 0) % 13 * 0.5;
    return (x, z) => {
      let h = Math.sin(x * 0.028 + o1) * Math.cos(z * 0.024) * 3.4 * scale
            + Math.sin(x * 0.011 + 2.1 + o2) * Math.cos(z * 0.013) * 5.6 * scale
            + Math.sin(x * 0.065 + o2) * Math.cos(z * 0.058 + o1) * 1.7 * scale
            + Math.sin(x * 0.15) * Math.sin(z * 0.12) * 0.5 * scale;
      // Zona central plana (base) — más reducida para que el relieve llegue cerca
      const d = Math.hypot(x, z);
      const flat = U.clamp((d - 13) / 15, 0, 1);
      h *= 0.15 + 0.85 * flat;
      if (opts.island) {
        // caída hacia el borde para isla
        const edge = U.clamp((half - 14 - Math.max(Math.abs(x), Math.abs(z))) / 30, 0, 1);
        h = h * edge - (1 - edge) * 6;
      }
      return h;
    };
  }

  /* ---------- Colisiones circulares del mundo ---------- */
  let colliders = [];
  function addCollider(x, z, r) { colliders.push({ x, z, r }); }
  function clearColliders() { colliders = []; }
  function resolveCollisions(px, pz, radius) {
    for (const c of colliders) {
      const dx = px - c.x, dz = pz - c.z;
      const d2 = dx * dx + dz * dz;
      const min = c.r + radius;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        const push = min - d;
        px += dx / d * push; pz += dz / d * push;
      }
    }
    return [px, pz];
  }

  /* ---------- Textura de detalle del suelo (grano neutro multiplicativo) ---------- */
  let _detailTex = null;
  function detailTexture() {
    if (_detailTex) return _detailTex;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    // manchas suaves grandes (variación de humedad)
    for (let i = 0; i < 90; i++) {
      const g = 215 + Math.floor(Math.random() * 40);
      const gx = Math.random() * 256, gy = Math.random() * 256, gr = 8 + Math.random() * 26;
      const grad = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, `rgba(${g},${g},${g},0.55)`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = grad;
      x.beginPath(); x.arc(gx, gy, gr, 0, 7); x.fill();
    }
    // grano fino (píxeles) — rango más contrastado para que se note multiplicado
    for (let i = 0; i < 4200; i++) {
      const v = 170 + Math.floor(Math.random() * 85);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(Math.random() * 256, Math.random() * 256, Math.random() < 0.85 ? 1 : 2, 1);
    }
    // rayitas tipo césped rastrillado
    x.strokeStyle = 'rgba(178,178,178,0.25)'; x.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const sx = Math.random() * 256, sy = Math.random() * 256;
      const a = Math.random() * Math.PI;
      const len = 4 + Math.random() * 9;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      x.stroke();
    }
    _detailTex = new THREE.CanvasTexture(c);
    _detailTex.wrapS = _detailTex.wrapT = THREE.RepeatWrapping;
    _detailTex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
    return _detailTex;
  }

  /* ---------- Textura de brizna de hierba (alpha) ---------- */
  let _bladeTex = null;
  function grassBladeTexture() {
    if (_bladeTex) return _bladeTex;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 8; i++) {
      const bx = 5 + i * 7.4 + Math.random() * 3;
      const tipX = bx + (Math.random() - 0.5) * 16;
      const tipY = 2 + Math.random() * 14;
      const grd = x.createLinearGradient(0, 64, 0, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(1, 'rgba(255,255,255,0.75)');
      x.strokeStyle = grd;
      x.lineWidth = 2.6 + Math.random() * 1.6;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(bx, 64);
      x.quadraticCurveTo(bx + (tipX - bx) * 0.3, 34, tipX, tipY);
      x.stroke();
    }
    _bladeTex = new THREE.CanvasTexture(c);
    return _bladeTex;
  }

  /* ---------- Campo de hierba animada (un solo draw call) ---------- */
  let grassMat = null;
  const GRASS_CFG = {
    meadow:  { count: [0, 1600, 3400], base: '#3a7a3e', tip: '#a3dd77', flower: '#fde047', flowerChance: 0.10 },
    desert:  { count: [0, 550, 1100],  base: '#a08140', tip: '#e3c87e', flower: '#fb923c', flowerChance: 0.05 },
    snow:    { count: [0, 750, 1500],  base: '#b6c6d6', tip: '#f6fbfe', flower: '#7dd3fc', flowerChance: 0.04 },
    volcano: { count: [0, 400, 850],   base: '#4d3f36', tip: '#81695f', flower: '#fb923c', flowerChance: 0.07 },
    void:    { count: [0, 950, 2000],  base: '#534077', tip: '#ab8ee6', flower: '#e9d5ff', flowerChance: 0.13 },
    royale:  { count: [0, 1600, 3400], base: '#3a7444', tip: '#a0d57e', flower: '#fde047', flowerChance: 0.10 }
  };
  function buildGrassField(themeName, size, rng, opts) {
    const cfg = GRASS_CFG[themeName] || GRASS_CFG.meadow;
    const qIdx = quality === 'high' ? 2 : quality === 'medium' ? 1 : 0;
    const count = cfg.count[qIdx];
    if (!count) return null;
    const P = [], UV = [], C = [], PH = [], IDX = [];
    const base = new THREE.Color(cfg.base), tip = new THREE.Color(cfg.tip), flower = new THREE.Color(cfg.flower);
    const cLow = new THREE.Color(), cHigh = new THREE.Color();
    let vi = 0, placed = 0, tries = 0;
    while (placed < count && tries < count * 3) {
      tries++;
      const x = (rng() - 0.5) * (size - 14), z = (rng() - 0.5) * (size - 14);
      if (Math.abs(x) < 5 && Math.abs(z) < 27) continue;      // camino despejado
      const y = heightFn(x, z);
      if (opts.island && y < -1.2) continue;                    // bajo el agua
      const slope = Math.abs(heightFn(x + 1.2, z) - y) + Math.abs(heightFn(x, z + 1.2) - y);
      if (slope > 1.1) continue;                                // demasiado empinado
      const w = 0.55 + rng() * 0.55, h = 0.34 + rng() * 0.4;
      const isFlower = rng() < cfg.flowerChance;
      cLow.copy(base).offsetHSL(0, 0, (rng() - 0.5) * 0.07);
      cHigh.copy(tip).offsetHSL(0, 0, (rng() - 0.5) * 0.07);
      if (isFlower) cHigh.copy(flower);
      const rot = rng() * Math.PI;
      for (let q2 = 0; q2 < 2; q2++) {
        const a = rot + q2 * Math.PI / 2;
        const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
        P.push(x - dx, y, z - dz, x + dx, y, z + dz, x + dx, y + h, z + dz, x - dx, y + h, z - dz);
        UV.push(0, 0, 1, 0, 1, 1, 0, 1);
        C.push(cLow.r, cLow.g, cLow.b, cLow.r, cLow.g, cLow.b, cHigh.r, cHigh.g, cHigh.b, cHigh.r, cHigh.g, cHigh.b);
        const ph = x * 0.33 + z * 0.27 + rng() * 1.4;
        PH.push(ph, ph, ph, ph);
        IDX.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      }
      placed++;
    }
    if (!placed) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(PH, 1));
    geo.setIndex(IDX);
    grassMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: grassBladeTexture() },
        time: { value: 0 },
        fogColor: { value: new THREE.Color('#ffffff') },
        fogNear: { value: worldSize * 0.35 },
        fogFar: { value: worldSize * 1.35 }
      },
      vertexShader: `
        attribute float aPhase;
        uniform float time;
        varying vec2 vUv; varying vec3 vColor; varying float vFogDepth;
        void main() {
          vUv = uv; vColor = color;
          vec3 p = position;
          float w1 = sin(time * 1.7 + aPhase);
          float w2 = sin(time * 3.1 + aPhase * 1.37);
          float amt = uv.y * uv.y * 0.17;
          p.x += (w1 * 0.7 + w2 * 0.3) * amt;
          p.z += cos(time * 1.3 + aPhase) * 0.6 * amt;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear, fogFar;
        varying vec2 vUv; varying vec3 vColor; varying float vFogDepth;
        void main() {
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.45) discard;
          vec3 col = vColor * (0.92 + t.r * 0.08);
          float f = smoothstep(fogNear, fogFar, vFogDepth);
          col = mix(col, fogColor, f);
          gl_FragColor = vec4(col, 1.0);
        }`,
      vertexColors: true, side: THREE.DoubleSide
    });
    if (scene && scene.fog) grassMat.uniforms.fogColor.value.copy(scene.fog.color);
    const mesh = new THREE.Mesh(geo, grassMat);
    mesh.frustumCulled = false;
    Engine.registerAnim((t) => { if (grassMat) grassMat.uniforms.time.value = t; });
    return mesh;
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
    if (grassMat) grassMat.uniforms.fogColor.value.copy(c);
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
    addCollider, clearColliders, resolveCollisions,
    CamRig, blobShadow, removeBlobShadow, update,
    THEMES, get scene() { return scene; }, get camera() { return camera; },
    get renderer() { return renderer; }, get quality() { return quality; },
    get worldSize() { return worldSize; },
    get clockT() { return clockT; }
  };
})();
