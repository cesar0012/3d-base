/* ============================================================
   AETHERIA — data.js
   Héroes, armas, armaduras, habilidades, enemigos, jefes,
   campaña, misiones, logros, gacha, tienda y economía
   ============================================================ */
'use strict';

const DATA = {};

/* ---------- Rarezas ---------- */
DATA.RARITY = {
  C:   { name: 'Común',     color: '#9ca3af', glow: '#d1d5db', mult: 1.0 },
  R:   { name: 'Raro',      color: '#38bdf8', glow: '#7dd3fc', mult: 1.25 },
  SR:  { name: 'Épico',     color: '#a855f7', glow: '#c084fc', mult: 1.6 },
  SSR: { name: 'Legendario',color: '#f59e0b', glow: '#fbbf24', mult: 2.1 },
  UR:  { name: 'Mítico',    color: '#f43f5e', glow: '#fb7185', mult: 2.8 }
};

/* ---------- Elementos ---------- */
DATA.ELEMENTS = {
  fisico:     { name: 'Físico',      color: '#e2e8f0', icon: 'spark', strongVs: null },
  fuego:      { name: 'Fuego',       color: '#fb923c', icon: 'flame', strongVs: 'hielo' },
  hielo:      { name: 'Hielo',       color: '#7dd3fc', icon: 'snowflake', strongVs: 'naturaleza' },
  rayo:       { name: 'Rayo',        color: '#facc15', icon: 'zap', strongVs: 'agua' },
  naturaleza: { name: 'Naturaleza',  color: '#4ade80', icon: 'leaf', strongVs: 'oscuridad' },
  luz:        { name: 'Luz',         color: '#fde68a', icon: 'sun', strongVs: 'oscuridad' },
  oscuridad:  { name: 'Oscuridad',   color: '#c084fc', icon: 'moon', strongVs: 'luz' }
};
DATA.elementMult = (atkEl, defEl) => {
  if (!atkEl || !defEl) return 1;
  const e = DATA.ELEMENTS[atkEl];
  if (e && e.strongVs === defEl) return 1.5;
  const d = DATA.ELEMENTS[defEl];
  if (d && d.strongVs === atkEl) return 0.75;
  return 1;
};

/* ---------- Habilidades ---------- */
DATA.SKILLS = {
  // Genéricas por clase (cada héroe: skill1, skill2, ultimate)
  torbellino:  { name: 'Torbellino',    icon: 'tornado', cd: 6,  desc: 'Gira dañando a todos los enemigos alrededor.', type: 'aoe',        radius: 4.5, dmgMult: 1.6, element: 'fisico' },
  embestida:   { name: 'Embestida',     icon: 'chevrons', cd: 7,  desc: 'Cargas hacia adelante arrasando enemigos.',    type: 'dash',       dist: 8, dmgMult: 1.4, element: 'fisico' },
  multidisparo:{ name: 'Lluvia de Flechas', icon: 'bow', cd: 8, desc: 'Dispara una andanada de flechas perforantes.', type: 'volley', count: 7, dmgMult: 0.75, element: 'fisico' },
  flecha_hielo:{ name: 'Flecha Gélida', icon: 'snowflake', cd: 9,  desc: 'Flecha de hielo que congela a los impactados.', type: 'projectile', dmgMult: 2.2, element: 'hielo', effect: 'freeze' },
  nova_hiela:  { name: 'Nova de Escarcha', icon: 'snowflake', cd: 12, desc: 'Explosión de hielo: daña y ralentiza el área.', type: 'aoe', radius: 6, dmgMult: 2.4, element: 'hielo', effect: 'freeze' },
  meteoro:     { name: 'Meteoro',       icon: 'meteor', cd: 14, desc: 'Invoca un meteoro devastador en el área objetivo.', type: 'meteor', radius: 5, dmgMult: 3.2, element: 'fuego', effect: 'burn' },
  bola_fuego:  { name: 'Bola de Fuego', icon: 'flame', cd: 6,  desc: 'Proyectil explosivo de fuego.', type: 'projectile', dmgMult: 2.0, element: 'fuego', effect: 'burn' },
  golpe_escudo:{ name: 'Golpe de Escudo', icon: 'shield', cd: 8, desc: 'Aturde a los enemigos cercanos y gana escudo.', type: 'aoe', radius: 4, dmgMult: 1.2, element: 'luz', effect: 'stun', shield: 0.25 },
  luz_sagrada: { name: 'Luz Sagrada',   icon: 'sun', cd: 12, desc: 'Cura al guardián y otorga regeneración.', type: 'heal', heal: 0.35, regen: 4, element: 'luz' },
  golpe_sombra:{ name: 'Golpe Sombrío', icon: 'moon', cd: 9,  desc: 'Teletransporte tras el enemigo con golpe crítico.', type: 'blink', dmgMult: 2.6, element: 'oscuridad' },
  nube_veneno: { name: 'Esporas',       icon: 'leaf', cd: 10, desc: 'Esporas que envenenan y ralentizan el área.', type: 'aoe', radius: 5.5, dmgMult: 1.2, element: 'naturaleza', effect: 'poison' },
  latigo_vida: { name: 'Látigo de Vid', icon: 'sprout', cd: 11, desc: 'Enreda a los enemigos del área (inmoviliza).', type: 'aoe', radius: 5, dmgMult: 1.5, element: 'naturaleza', effect: 'root' },
  invocar_esq: { name: 'Alza-huesos',   icon: 'skull', cd: 16, desc: 'Invoca 3 esqueletos aliados que luchan por ti.', type: 'summon', count: 3, lifetime: 20 },
  drenar_vida: { name: 'Drenar Vida',   icon: 'drop', cd: 9,  desc: 'Roba vida de los enemigos cercanos.', type: 'aoe', radius: 5, dmgMult: 1.4, element: 'oscuridad', lifesteal: 0.6 },
  cadena_rayo: { name: 'Cadena Eléctrica', icon: 'zap', cd: 10, desc: 'Rayo que salta entre enemigos.', type: 'chain', jumps: 4, dmgMult: 1.5, element: 'rayo' },
  furia:        { name: 'Furia',         icon: 'rage', cd: 15, desc: '+60% ataque y velocidad 6 segundos.', type: 'buff', stat: 'atk', amt: 0.6, dur: 6 }
};

DATA.ULTS = {
  filo_infierno: { name: 'Filo del Infierno', icon: 'swords', cost: 100, desc: 'Kael libera un tajo de fuego en línea devastadora.', type: 'line', dmgMult: 4.5, element: 'fuego' },
  lluvia_estelar:{ name: 'Lluvia Estelar',    icon: 'star', cost: 100, desc: 'Lyra bombardea el área con flechas astrales.', type: 'arrowrain', dmgMult: 3.8, element: 'fisico' },
  cero_absoluto: { name: 'Cero Absoluto',     icon: 'snowflake', cost: 100, desc: 'Mira congela todo a su alrededor.', type: 'aoe', radius: 9, dmgMult: 4.2, element: 'hielo', effect: 'freeze' },
  juicio:         { name: 'Juicio Divino',    icon: 'hammer', cost: 100, desc: 'Ronnan invoca espadas de luz que caen en el área.', type: 'swordrain', dmgMult: 4.0, element: 'luz' },
  ejecucion:      { name: 'Ejecución',        icon: 'dagger', cost: 100, desc: 'Zed marca y ejecuta a los enemigos cercanos.', type: 'aoe', radius: 8, dmgMult: 5.2, element: 'oscuridad', execThreshold: 0.15 },
  jardin_silva:   { name: 'Jardín de Silva',  icon: 'sprout', cost: 100, desc: 'Un jardín sanador florece: daño masivo y cura total.', type: 'aoe', radius: 9, dmgMult: 3.6, element: 'naturaleza', heal: 0.5 },
  cataclismo:     { name: 'Cataclismo',       icon: 'meteor', cost: 100, desc: 'Ignis desata una lluvia de meteoros.', type: 'arrowrain', dmgMult: 4.6, element: 'fuego', effect: 'burn' },
  legion_muerta:  { name: 'Legión Muerta',    icon: 'skull', cost: 100, desc: 'Nyx alza un ejército de 6 esqueletos y aterroriza.', type: 'summon', count: 6, lifetime: 30, terror: 3 }
};

/* ---------- Héroes ---------- */
DATA.HEROES = {
  kael:  { id: 'kael', name: 'Kael',  title: 'El Filo Ardiente', rarity: 'R',  element: 'fuego',      cls: 'Guerrero',   base: { hp: 1100, atk: 105, def: 55, spd: 6.2, crit: 0.05 }, skill1: 'torbellino', skill2: 'embestida', ult: 'filo_infierno', weaponType: 'espada', model: { hair: '#7f1d1d', hairStyle: 'spiky', skin: '#ffdbac', outfit: '#b91c1c', outfit2: '#7f1d1d', accent: '#fbbf24' }, desc: 'Un espadachín imparable cuyo acero arde con pasión. El primer guardián del Cristal.' },
  lyra:  { id: 'lyra', name: 'Lyra',  title: 'Ojo de Halcón',    rarity: 'R',  element: 'fisico',     cls: 'Arquera',    base: { hp: 850,  atk: 118, def: 38, spd: 6.8, crit: 0.15 }, skill1: 'multidisparo', skill2: 'embestida', ult: 'lluvia_estelar', weaponType: 'arco', model: { hair: '#065f46', hairStyle: 'ponytail', skin: '#ffe0c2', outfit: '#059669', outfit2: '#064e3b', accent: '#a7f3d0' }, desc: 'Ninguna presa escapa de su arco. Rápida, precisa, letal a distancia.' },
  mira:  { id: 'mira', name: 'Mira',  title: 'Sabia de Escarcha',rarity: 'SR', element: 'hielo',     cls: 'Maga',       base: { hp: 780,  atk: 132, def: 32, spd: 6.0, crit: 0.08 }, skill1: 'nova_hiela', skill2: 'flecha_hielo', ult: 'cero_absoluto', weaponType: 'baston', model: { hair: '#38bdf8', hairStyle: 'long', skin: '#ffe9d6', outfit: '#4f46e5', outfit2: '#312e81', accent: '#e0f2fe' }, desc: 'Archimaga del norte. Convierte el campo de batalla en un invierno eterno.' },
  ronan: { id: 'ronan', name: 'Ronan', title: 'Baluarte Sagrado', rarity: 'SR', element: 'luz',      cls: 'Paladín',    base: { hp: 1450, atk: 92,  def: 78, spd: 5.8, crit: 0.05 }, skill1: 'golpe_escudo', skill2: 'luz_sagrada', ult: 'juicio', weaponType: 'martillo', model: { hair: '#fbbf24', hairStyle: 'short', skin: '#ffdfc0', outfit: '#eab308', outfit2: '#a16207', accent: '#fef9c3' }, desc: 'Un muro de fe. Sus juramentos protegen al Cristal y castigan la oscuridad.' },
  zed:   { id: 'zed',   name: 'Zed',   title: 'Sombra Susurrante',rarity: 'SSR',element: 'oscuridad', cls: 'Pícaro',     base: { hp: 920,  atk: 148, def: 40, spd: 7.4, crit: 0.25 }, skill1: 'golpe_sombra', skill2: 'embestida', ult: 'ejecucion', weaponType: 'dagas', model: { hair: '#111827', hairStyle: 'hood', skin: '#f3d5b5', outfit: '#1f2937', outfit2: '#0b1220', accent: '#c084fc' }, desc: 'Nadie ve su daga dos veces. Aparece, mata, se disuelve en sombras.' },
  sylvie:{ id: 'sylvie',name: 'Sylvie',title: 'Corazón del Bosque',rarity:'SSR',element: 'naturaleza',cls: 'Druida',    base: { hp: 1000, atk: 125, def: 48, spd: 6.4, crit: 0.10 }, skill1: 'latigo_vida', skill2: 'nube_veneno', ult: 'jardin_silva', weaponType: 'lanza', model: { hair: '#65a30d', hairStyle: 'long', skin: '#ffe4cd', outfit: '#16a34a', outfit2: '#14532d', accent: '#ecfccb' }, desc: 'El bosque entero obedece a su canción. Sanadora y depredadora a la vez.' },
  ignis: { id: 'ignis', name: 'Ignis', title: 'Corazón de Magma', rarity: 'SSR',element: 'fuego',    cls: 'Piromante',  base: { hp: 760,  atk: 158, def: 30, spd: 5.9, crit: 0.12 }, skill1: 'bola_fuego', skill2: 'meteoro', ult: 'cataclismo', weaponType: 'baston', model: { hair: '#ea580c', hairStyle: 'spiky', skin: '#ffd9b8', outfit: '#dc2626', outfit2: '#7c2d12', accent: '#fdba74' }, desc: 'Todo lo que toca se vuelve ceniza. Su poder nace del corazón de un volcán.' },
  nyx:   { id: 'nyx',   name: 'Nyx',  title: 'Reina de la Muerte',rarity: 'UR', element: 'oscuridad', cls: 'Nigromante',base: { hp: 900,  atk: 165, def: 42, spd: 6.1, crit: 0.18 }, skill1: 'invocar_esq', skill2: 'drenar_vida', ult: 'legion_muerta', weaponType: 'baston', model: { hair: '#7e22ce', hairStyle: 'long', skin: '#f5e0d0', outfit: '#6b21a8', outfit2: '#2e1065', accent: '#e9d5ff' }, desc: 'La muerte es su ejército. Lo que cae ante ella se levanta a su servicio.' }
};

/* ---------- Armas ---------- */
DATA.WEAPON_TYPES = { espada: 'Espada', mandoble: 'Mandoble', lanza: 'Lanza', arco: 'Arco', baston: 'Bastón', dagas: 'Dagas', martillo: 'Martillo' };
DATA.WEAPONS = {
  espada_hierro:   { id: 'espada_hierro',   name: 'Espada de Hierro',    type: 'espada',   rarity: 'C',   atk: 28, spd: 1.10, crit: 0.05, price: 0,    lvlReq: 1 },
  espada_acero:    { id: 'espada_acero',    name: 'Espada de Acero',     type: 'espada',   rarity: 'R',   atk: 52, spd: 1.12, crit: 0.06, price: 900,  lvlReq: 3 },
  espada_fuego:    { id: 'espada_fuego',    name: 'Filo Volcánico',      type: 'espada',   rarity: 'SR',  atk: 96, spd: 1.10, crit: 0.08, price: 3800, lvlReq: 6, element: 'fuego' },
  espada_aurora:   { id: 'espada_aurora',   name: 'Colmillo de Aurora',  type: 'espada',   rarity: 'SSR', atk: 168, spd: 1.18, crit: 0.12, price: 9800, lvlReq: 10, element: 'luz' },
  mandoble_titan:  { id: 'mandoble_titan',  name: 'Mandoble del Titán',  type: 'mandoble', rarity: 'SR',  atk: 118, spd: 0.82, crit: 0.05, price: 4200, lvlReq: 6 },
  mandoble_drago:  { id: 'mandoble_drago',  name: 'Mandoble Dragón',     type: 'mandoble', rarity: 'SSR', atk: 205, spd: 0.85, crit: 0.08, price: 11000, lvlReq: 11, element: 'fuego' },
  lanza_cazador:   { id: 'lanza_cazador',   name: 'Lanza del Cazador',   type: 'lanza',    rarity: 'C',   atk: 24, spd: 1.15, crit: 0.06, price: 320,  lvlReq: 1 },
  lanza_vid:       { id: 'lanza_vid',       name: 'Lanza de Vid Silvestre', type: 'lanza', rarity: 'SR', atk: 88, spd: 1.16, crit: 0.10, price: 3600, lvlReq: 5, element: 'naturaleza' },
  lanza_vortice:   { id: 'lanza_vortice',   name: 'Lanza del Vórtice',   type: 'lanza',    rarity: 'SSR', atk: 152, spd: 1.22, crit: 0.14, price: 9500, lvlReq: 10, element: 'rayo' },
  arco_cazador:    { id: 'arco_cazador',    name: 'Arco del Cazador',    type: 'arco',     rarity: 'C',   atk: 26, spd: 1.20, crit: 0.08, price: 380,  lvlReq: 1 },
  arco_viento:     { id: 'arco_viento',     name: 'Arco del Vendaval',   type: 'arco',     rarity: 'R',   atk: 50, spd: 1.25, crit: 0.10, price: 950,  lvlReq: 3 },
  arco_luna:       { id: 'arco_luna',       name: 'Arco de Luna Plateada', type: 'arco',   rarity: 'SSR', atk: 160, spd: 1.30, crit: 0.18, price: 10200, lvlReq: 10, element: 'hielo' },
  baston_aprendiz: { id: 'baston_aprendiz', name: 'Bastón de Aprendiz',  type: 'baston',   rarity: 'C',   atk: 27, spd: 1.00, crit: 0.05, price: 350,  lvlReq: 1 },
  baston_rubi:     { id: 'baston_rubi',     name: 'Cetro de Rubí',       type: 'baston',   rarity: 'SR',  atk: 102, spd: 1.02, crit: 0.07, price: 4000, lvlReq: 6, element: 'fuego' },
  baston_eclipse:  { id: 'baston_eclipse',  name: 'Cetro del Eclipse',   type: 'baston',   rarity: 'UR',  atk: 260, spd: 1.05, crit: 0.15, price: 15000, lvlReq: 14, element: 'oscuridad' },
  dagas_sombra:    { id: 'dagas_sombra',    name: 'Colmillos Sombríos',  type: 'dagas',    rarity: 'SR',  atk: 72, spd: 1.55, crit: 0.20, price: 3900, lvlReq: 5 },
  dagas_espectro:  { id: 'dagas_espectro',  name: 'Dagas Espectrales',   type: 'dagas',    rarity: 'SSR', atk: 128, spd: 1.60, crit: 0.26, price: 10500, lvlReq: 10, element: 'oscuridad' },
  martillo_guerra: { id: 'martillo_guerra', name: 'Martillo de Guerra',  type: 'martillo', rarity: 'R',   atk: 64, spd: 0.75, crit: 0.04, price: 1000, lvlReq: 3 },
  martillo_sol:    { id: 'martillo_sol',    name: 'Martillo del Sol',    type: 'martillo', rarity: 'SSR', atk: 190, spd: 0.78, crit: 0.06, price: 10800, lvlReq: 11, element: 'luz' }
};
DATA.weaponUpgCost = (weapon, plus) => Math.floor((DATA.WEAPONS[weapon] ? DATA.WEAPONS[weapon].atk : 20) * 0.35 * (plus + 1) * (1 + plus * 0.5));
DATA.weaponAtk = (id, plus) => { const w = DATA.WEAPONS[id]; if (!w) return 0; return Math.floor(w.atk * (1 + plus * 0.12)); };

/* ---------- Armaduras ---------- */
DATA.ARMOR_SLOTS = { head: 'Casco', chest: 'Pechera', boots: 'Botas' };
DATA.ARMOR = {
  cuero_gorro:  { id: 'cuero_gorro',  name: 'Gorro de Cuero',    slot: 'head',  rarity: 'C',  def: 8,  hp: 40,  spd: 0,    price: 0 },
  cuero_pecho:  { id: 'cuero_pecho',  name: 'Jubón de Cuero',    slot: 'chest', rarity: 'C',  def: 12, hp: 70,  spd: 0,    price: 0 },
  cuero_botas:  { id: 'cuero_botas',  name: 'Botas de Cuero',    slot: 'boots', rarity: 'C',  def: 6,  hp: 25,  spd: 0.2,  price: 0 },
  acero_gorro:  { id: 'acero_gorro',  name: 'Yelmo de Acero',    slot: 'head',  rarity: 'R',  def: 18, hp: 90,  spd: 0,    price: 800 },
  acero_pecho:  { id: 'acero_pecho',  name: 'Coraza de Acero',   slot: 'chest', rarity: 'R',  def: 26, hp: 150, spd: 0,    price: 850 },
  acero_botas:  { id: 'acero_botas',  name: 'Grebas de Acero',   slot: 'boots', rarity: 'R',  def: 12, hp: 60,  spd: 0.25, price: 750 },
  mithril_gorro:{ id: 'mithril_gorro',name: 'Diadema de Mithril',slot: 'head',  rarity: 'SR', def: 32, hp: 170, spd: 0,    price: 3200 },
  mithril_pecho:{ id: 'mithril_pecho',name: 'Malla de Mithril',  slot: 'chest', rarity: 'SR', def: 45, hp: 280, spd: 0,    price: 3400 },
  mithril_botas:{ id: 'mithril_botas',name: 'Botas de Mithril',  slot: 'boots', rarity: 'SR', def: 22, hp: 110, spd: 0.35, price: 3000 },
  dragon_gorro: { id: 'dragon_gorro', name: 'Corona Dracónica',  slot: 'head',  rarity: 'SSR',def: 52, hp: 300, spd: 0,    price: 9000 },
  dragon_pecho: { id: 'dragon_pecho', name: 'Peto de Dragón',    slot: 'chest', rarity: 'SSR',def: 74, hp: 500, spd: 0,    price: 9600 },
  dragon_botas: { id: 'dragon_botas', name: 'Botas Aladas',      slot: 'boots', rarity: 'SSR',def: 36, hp: 190, spd: 0.6,  price: 8800 },
  aether_gorro: { id: 'aether_gorro', name: 'Símbolo del Vacío', slot: 'head',  rarity: 'UR', def: 80, hp: 460, spd: 0.1,  price: 14500 },
  aether_pecho: { id: 'aether_pecho', name: 'Égida de Éter',     slot: 'chest', rarity: 'UR', def: 112,hp: 760, spd: 0.1,  price: 15500 },
  aether_botas: { id: 'aether_botas', name: 'Pasos Etéreos',     slot: 'boots', rarity: 'UR', def: 55, hp: 280, spd: 0.8,  price: 14000 }
};
DATA.armorUpgCost = (a, plus) => Math.floor((DATA.ARMOR[a] ? DATA.ARMOR[a].def : 10) * 0.4 * (plus + 1) * (1 + plus * 0.5));
DATA.armorStats = (id, plus) => { const a = DATA.ARMOR[id]; if (!a) return { def: 0, hp: 0, spd: 0 }; const m = 1 + plus * 0.12; return { def: Math.floor(a.def * m), hp: Math.floor(a.hp * m), spd: a.spd }; };

/* ---------- Enemigos ---------- */
DATA.ENEMIES = {
  slime:     { id: 'slime', name: 'Limo Verde',    hp: 60,  atk: 12, def: 0,  spd: 2.6, range: 1.4, behavior: 'melee',   xp: 8,   gold: 4,  tier: 1, element: 'naturaleza', scale: 1, color: '#4ade80' },
  slime_azul:{ id: 'slime_azul', name: 'Limo Azul',hp: 95,  atk: 16, def: 2,  spd: 2.7, range: 1.4, behavior: 'melee',   xp: 12,  gold: 6,  tier: 1, element: 'hielo', scale: 1.05, color: '#60a5fa' },
  goblin:    { id: 'goblin', name: 'Goblin Saqueador', hp: 85, atk: 15, def: 2, spd: 4.2, range: 1.5, behavior: 'melee', xp: 12, gold: 7,  tier: 1, element: 'fisico', scale: 0.9, color: '#65a30d' },
  lobo:      { id: 'lobo', name: 'Lobo Feroz',     hp: 110, atk: 20, def: 3, spd: 5.6, range: 1.6, behavior: 'charger', xp: 16,  gold: 8,  tier: 1, element: 'fisico', scale: 1, color: '#78716c' },
  arquero_g: { id: 'arquero_g', name: 'Goblin Arquero', hp: 75, atk: 18, def: 1, spd: 3.4, range: 11, behavior: 'ranged', xp: 15, gold: 8, tier: 1, element: 'fisico', scale: 0.9, color: '#4d7c0f' },
  esqueleto: { id: 'esqueleto', name: 'Esqueleto Guerrero', hp: 140, atk: 24, def: 6, spd: 3.6, range: 1.7, behavior: 'melee', xp: 20, gold: 10, tier: 2, element: 'oscuridad', scale: 1, color: '#e7e5e4' },
  orco:      { id: 'orco', name: 'Orco Bruto',     hp: 320, atk: 38, def: 12, spd: 3.0, range: 1.9, behavior: 'melee',  xp: 38,  gold: 20, tier: 2, element: 'fisico', scale: 1.35, color: '#3f6212' },
  mago_osc:  { id: 'mago_osc', name: 'Mago Oscuro', hp: 130, atk: 40, def: 4, spd: 3.0, range: 12, behavior: 'caster', xp: 36, gold: 22, tier: 2, element: 'oscuridad', scale: 1, color: '#581c87' },
  bombardero:{ id: 'bombardero', name: 'Bomba Andante', hp: 70, atk: 55, def: 0, spd: 5.0, range: 2.0, behavior: 'bomber', xp: 22, gold: 12, tier: 2, element: 'fuego', scale: 0.85, color: '#1c1917' },
  golem:     { id: 'golem', name: 'Golem de Piedra', hp: 850, atk: 60, def: 30, spd: 2.2, range: 2.2, behavior: 'melee', xp: 90, gold: 55, tier: 3, element: 'fisico', scale: 1.8, color: '#78716c' },
  espectro:  { id: 'espectro', name: 'Espectro',    hp: 210, atk: 46, def: 8, spd: 4.6, range: 1.8, behavior: 'phaser', xp: 48, gold: 28, tier: 3, element: 'oscuridad', scale: 1.1, color: '#a78bfa' },
  dragoncito:{ id: 'dragoncito', name: 'Dragón Menor', hp: 480, atk: 70, def: 18, spd: 4.0, range: 10, behavior: 'caster', xp: 85, gold: 50, tier: 3, element: 'fuego', scale: 1.2, color: '#b91c1c' }
};

/* ---------- Jefes ---------- */
DATA.BOSSES = {
  rey_slime:  { id: 'rey_slime', name: 'Rey Limo',        base: 'slime',      hpMult: 30, atkMult: 1.4, scale: 3.2, element: 'naturaleza', patterns: ['slam', 'split', 'bounce'], title: 'Tirano Gelatinoso', theme: 'meadow' },
  senor_goblin:{ id: 'senor_goblin', name: 'Grognar, Señor Goblin', base: 'goblin', hpMult: 34, atkMult: 1.5, scale: 2.6, element: 'fisico', patterns: ['charge', 'summon', 'throw'], title: 'Rey de la Horda', theme: 'meadow' },
  golem_obsidiana:{ id: 'golem_obsidiana', name: 'Gólem de Obsidiana', base: 'golem', hpMult: 42, atkMult: 1.7, scale: 3.0, element: 'fisico', patterns: ['slam', 'quake', 'boulder'], title: 'Guardián Colosal', theme: 'desert' },
  lich_escarcha:{ id: 'lich_escarcha', name: 'Lich de Escarcha', base: 'mago_osc', hpMult: 38, atkMult: 1.9, scale: 2.4, element: 'hielo', patterns: ['blizzard', 'summon', 'icicle'], title: 'Nigromante del Norte', theme: 'snow' },
  dragon_fuego:{ id: 'dragon_fuego', name: 'Ignarok, Dragón de Fuego', base: 'dragoncito', hpMult: 50, atkMult: 2.1, scale: 3.4, element: 'fuego', patterns: ['firebreath', 'swoop', 'meteor'], title: 'Devorador de Cielos', theme: 'volcano' },
  devorador:  { id: 'devorador', name: 'El Devorador del Vacío', base: 'espectro', hpMult: 64, atkMult: 2.4, scale: 3.8, element: 'oscuridad', patterns: ['voidzone', 'summon', 'beam', 'enrage'], title: 'El Fin de Todas las Cosas', theme: 'void' }
};

/* ---------- Regiones y Campaña ---------- */
DATA.REGIONS = [
  { id: 'valle',    name: 'Valle Esmeralda',   theme: 'meadow',  color: '#4ade80', desc: 'Praderas apacibles... hasta que la oscuridad llegó.' },
  { id: 'desierto', name: 'Desierto Ardiente', theme: 'desert',  color: '#fbbf24', desc: 'Dunas sin fin guardan tumbas colosales.' },
  { id: 'picos',    name: 'Picos Helados',     theme: 'snow',    color: '#7dd3fc', desc: 'El frío eterno y sus nigromantes.' },
  { id: 'volcan',   name: 'Corona de Fuego',   theme: 'volcano', color: '#fb923c', desc: 'Donde el mundo se derrite.' },
  { id: 'vacio',    name: 'Tierras del Vacío', theme: 'void',    color: '#c084fc', desc: 'La herida final. El Devorador aguarda.' }
];

/* 25 niveles: 5 regiones x 5 + jefe al 5º de cada región */
DATA.CAMPAIGN = (() => {
  const L = [];
  const regions = [
    { r: 'valle',    pool: ['slime', 'goblin', 'lobo', 'slime_azul', 'arquero_g'],                boss: 'rey_slime' },
    { r: 'desierto', pool: ['goblin', 'arquero_g', 'esqueleto', 'orco', 'bombardero'],            boss: 'golem_obsidiana' },
    { r: 'picos',    pool: ['slime_azul', 'esqueleto', 'mago_osc', 'espectro', 'bombardero'],     boss: 'lich_escarcha' },
    { r: 'volcan',   pool: ['orco', 'bombardero', 'dragoncito', 'golem', 'mago_osc'],             boss: 'dragon_fuego' },
    { r: 'vacio',    pool: ['espectro', 'mago_osc', 'dragoncito', 'golem', 'esqueleto'],          boss: 'devorador' }
  ];
  let id = 1;
  regions.forEach((reg, ri) => {
    for (let li = 1; li <= 5; li++) {
      const isBoss = li === 5;
      const waves = isBoss ? 3 : (2 + Math.min(2, li));
      const diff = ri * 5 + li;
      L.push({
        id, region: reg.r, regionIdx: ri, idxInRegion: li, theme: DATA.REGIONS[ri].theme,
        name: isBoss ? DATA.BOSSES[reg.boss].name : `Batalla ${id}`,
        boss: isBoss ? reg.boss : (li === 3 && ri >= 1 ? reg.pool[reg.pool.length - 1] : null),
        waves,
        hpScale: 1 + diff * 0.35, atkScale: 1 + diff * 0.22,
        pool: reg.pool.slice(0, 3 + Math.min(2, li)),
        power: Math.floor(180 + diff * 95),
        rewards: {
          first: { gold: 120 + diff * 45, gems: isBoss ? 120 : 30, xp: 60 + diff * 22, tickets: isBoss ? 2 : (id % 3 === 0 ? 1 : 0) },
          replay: { gold: Math.floor((120 + diff * 45) * 0.35), gems: isBoss ? 30 : 5, xp: Math.floor((60 + diff * 22) * 0.3), tickets: 0 }
        },
        intro: isBoss ? `¡${DATA.BOSSES[reg.boss].title}: ${DATA.BOSSES[reg.boss].name}!` : null
      });
      id++;
    }
  });
  return L;
})();

/* ---------- Misiones ---------- */
DATA.DAILY_POOL = [
  { id: 'd_kills_30',   desc: 'Derrota 30 enemigos',      goal: 30,  reward: { gold: 200, gems: 10 } },
  { id: 'd_kills_60',   desc: 'Derrota 60 enemigos',      goal: 60,  reward: { gold: 400, gems: 20 } },
  { id: 'd_runs_2',     desc: 'Completa 2 batallas',      goal: 2,   reward: { gold: 250, gems: 10 } },
  { id: 'd_boss_1',     desc: 'Derrota a un jefe',        goal: 1,   reward: { gold: 350, gems: 25 } },
  { id: 'd_royale_1',   desc: 'Juega 1 Arena Suprema',    goal: 1,   reward: { gold: 300, gems: 15 } },
  { id: 'd_explore_1',  desc: 'Explora el mundo 1 vez',   goal: 1,   reward: { gold: 200, gems: 10 } },
  { id: 'd_gold_500',   desc: 'Recolecta 500 de oro',     goal: 500, reward: { gold: 150, gems: 10 } },
  { id: 'd_upg_2',      desc: 'Mejora equipo 2 veces',    goal: 2,   reward: { gold: 200, gems: 10 } },
  { id: 'd_combo_15',   desc: 'Consigue un combo de 15',  goal: 15,  reward: { gold: 300, gems: 15 } },
  { id: 'd_nodmg_1',    desc: 'Gana sin daño al Cristal', goal: 1,   reward: { gold: 400, gems: 20 } }
];
DATA.WEEKLY_POOL = [
  { id: 'w_kills_400',  desc: 'Derrota 400 enemigos',     goal: 400, reward: { gold: 2000, gems: 80, tickets: 2 } },
  { id: 'w_boss_5',     desc: 'Derrota 5 jefes',          goal: 5,   reward: { gold: 2500, gems: 100, tickets: 3 } },
  { id: 'w_campaign_5', desc: 'Completa 5 niveles nuevos',goal: 5,   reward: { gold: 2200, gems: 90, tickets: 2 } },
  { id: 'w_royale_5',   desc: 'Top 5 en Arena Suprema x5',goal: 5,   reward: { gold: 2400, gems: 100, tickets: 3 } }
];
DATA.ACHIEVEMENTS = [
  { id: 'a_first_blood', name: 'Primera Sangre',    desc: 'Derrota tu primer enemigo',    goal: 1,    reward: { gems: 20 } },
  { id: 'a_kills_100',   name: 'Cazador',           desc: 'Derrota 100 enemigos',         goal: 100,  reward: { gems: 40, gold: 500 } },
  { id: 'a_kills_1000',  name: 'Exterminador',      desc: 'Derrota 1,000 enemigos',       goal: 1000, reward: { gems: 150, gold: 3000 } },
  { id: 'a_boss_1',      name: 'Matagigantes',      desc: 'Derrota tu primer jefe',       goal: 1,    reward: { gems: 50 } },
  { id: 'a_boss_10',     name: 'Asesino de Titanes',desc: 'Derrota 10 jefes',             goal: 10,   reward: { gems: 120, tickets: 2 } },
  { id: 'a_stars_15',    name: 'Coleccionista',     desc: 'Consigue 15 estrellas',        goal: 15,   reward: { gems: 80, tickets: 1 } },
  { id: 'a_stars_45',    name: 'Perfeccionista',    desc: 'Consigue 45 estrellas',        goal: 45,   reward: { gems: 250, tickets: 3 } },
  { id: 'a_wave_10',     name: 'Defensor',          desc: 'Oleada 10 en Defensa Infinita',goal: 10,   reward: { gems: 60 } },
  { id: 'a_wave_25',     name: 'Leyenda Viva',      desc: 'Oleada 25 en Defensa Infinita',goal: 25,   reward: { gems: 200, tickets: 3 } },
  { id: 'a_royale_1',    name: 'Rey de la Arena',   desc: 'Gana 1 Arena Suprema',        goal: 1,    reward: { gems: 150 } },
  { id: 'a_royale_5',    name: 'Imparable',         desc: 'Gana 5 Arenas Supremas',      goal: 5,    reward: { gems: 400, tickets: 5 } },
  { id: 'a_heroes_3',    name: 'Reclutador',        desc: 'Recluta 3 héroes',            goal: 3,    reward: { gems: 100 } },
  { id: 'a_heroes_all',  name: 'Consejo Completo',  desc: 'Recluta a los 8 héroes',      goal: 8,    reward: { gems: 1000 } },
  { id: 'a_lvl_10',      name: 'Veterano',          desc: 'Alcanza nivel 10 de guardián', goal: 10,   reward: { gems: 100 } },
  { id: 'a_shards_all',  name: 'Restaurador',       desc: 'Recupera los 12 fragmentos',   goal: 12,   reward: { gems: 500 } }
];

/* ---------- Gacha ---------- */
DATA.GACHA = {
  costs: { single_ticket: 1, single_gems: 150, ten_tickets: 10, ten_gems: 1350 },
  rates: [['UR', 0.012], ['SSR', 0.028], ['SR', 0.10], ['R', 0.86]],
  pity4At: 10,   // SR o superior garantizado a las 10
  pity5At: 60,   // SSR o superior garantizado a las 60
  dupeGems: { C: 5, R: 15, SR: 40, SSR: 120, UR: 400 },
  banner: { name: 'Luz del Vacío', featured: 'nyx', subFeatured: ['ignis', 'sylvie'] }
};

/* ---------- Tienda de gemas (monetización) ---------- */
DATA.GEM_PACKS = [
  { id: 'g1',  gems: 60,   bonus: 0,   label: 'Puñado',     price: 'USD 0.99' },
  { id: 'g2',  gems: 300,  bonus: 30,  label: 'Bolsa',      price: 'USD 4.99' },
  { id: 'g3',  gems: 980,  bonus: 120, label: 'Cofre',      price: 'USD 14.99' },
  { id: 'g4',  gems: 3300, bonus: 600, label: 'Montaña',    price: 'USD 44.99' },
  { id: 'g5',  gems: 8000, bonus: 2000,label: 'Astral',     price: 'USD 99.99' }
];

/* ---------- Recompensas de login ---------- */
DATA.LOGIN_REWARDS = [
  { day: 1, item: { gold: 300 } },      { day: 2, item: { gems: 30 } },
  { day: 3, item: { gold: 800 } },      { day: 4, item: { tickets: 1 } },
  { day: 5, item: { gems: 80 } },       { day: 6, item: { gold: 2000 } },
  { day: 7, item: { gems: 150, tickets: 2 } }
];

/* ---------- XP de guardián ---------- */
DATA.xpNeeded = lvl => Math.floor(80 * Math.pow(lvl, 1.55));

/* ---------- Stats de héroe por nivel ---------- */
DATA.heroStats = (heroId, lvl) => {
  const h = DATA.HEROES[heroId]; if (!h) return null;
  const m = 1 + (lvl - 1) * 0.09;
  const r = DATA.RARITY[h.rarity].mult;
  return {
    hp: Math.floor(h.base.hp * m * (1 + (r - 1) * 0.4)),
    atk: Math.floor(h.base.atk * m * (1 + (r - 1) * 0.35)),
    def: Math.floor(h.base.def * m),
    spd: h.base.spd,
    crit: Math.min(0.6, h.base.crit + (lvl - 1) * 0.004)
  };
};
DATA.heroUpgCost = lvl => Math.floor(150 * Math.pow(lvl, 1.4));

/* ---------- Historia (mundo abierto) ---------- */
DATA.STORY = {
  intro: [
    { who: 'Voz del Cristal', text: 'Guardián... el Cristal de Aetheria se ha fragmentado. Doce astillas descansan en tierras corrompidas.' },
    { who: 'Voz del Cristal', text: 'Reúnelas. Recluta héroes. La oscuridad ya ha despertado.' }
  ],
  npcs: {
    elder:  { name: 'Anciana Maera', lines: [
      'Bienvenido, Guardián. El Valle Esmeralda era pacífico... hasta la Fragmentación.',
      'Los campamentos enemigos crecen cada noche. Límpialos y el valle respirará.',
      'Cada fragmento del Cristal que recuperes devolverá luz a estas tierras.' ] },
    smith:  { name: 'Herrero Borin', lines: [
      '¡Chispas! Con oro puedo mejorar tu chatarra... digo, tu equipo legendario.',
      'Pasa por la Armería cuando tengas fundiciones que gastar.',
      'Un consejo: los mandobles pegan fuerte, pero las dagas... las dagas son arte.' ] },
    scout:  { name: 'Exploradora Kai', lines: [
      'He visto arenas que tragan hombres enteros en el Desierto Ardiente.',
      'Dicen que en los Picos Helados caminan los que ya no deberían caminar.',
      'Si vas al Vacío... vuelve. Eso es todo lo que pido.' ] },
    merchant:{ name: 'Mercader Zil', lines: [
      '¡Pociones, tesoros, gangas! Todo tiene precio, amigo.',
      'Los cofres brillantes del campo esconden oro y gemas. ¡Corre antes que los limos!' ] }
  },
  quests: [
    { id: 'q_slimes',  name: 'Plaga de limos',    giver: 'elder', type: 'kill', target: 'slime', count: 8,   reward: { gold: 400, gems: 20 }, text: 'Los limos invaden las praderas. Reduce su número.' },
    { id: 'q_goblins', name: 'Cuevas saqueadas',  giver: 'elder', type: 'kill', target: 'goblin', count: 6,  reward: { gold: 550, gems: 25 }, text: 'Los goblins robaron nuestras reservas. Devuélveles el golpe.' },
    { id: 'q_wolves',  name: 'Aullidos en la niebla', giver: 'scout', type: 'kill', target: 'lobo', count: 6, reward: { gold: 500, gems: 20 }, text: 'Los lobos cazan en manada cerca del río.' },
    { id: 'q_skel',    name: 'Los que caminan',   giver: 'scout', type: 'kill', target: 'esqueleto', count: 8, reward: { gold: 700, gems: 30 }, text: 'Huesos que se mueven. Acaba con ellos antes del anochecer.' },
    { id: 'q_shard0',  name: 'Fragmento del Prado', giver: 'elder', type: 'collect', count: 3, reward: { gold: 800, gems: 50 }, text: 'He visto brillar fragmentos en tres rincones del valle.' }
  ]
};

/* ---------- Eventos ---------- */
DATA.EVENTS = [
  { id: 'e_weekend', name: 'Fiebre del Fin de Semana', desc: 'x2 oro en todas las batallas', icon: 'coin', schedule: 'Sáb y Dom', buff: { goldMult: 2 } },
  { id: 'e_hunter',  name: 'Cazador de Jefes',         desc: 'Jefes dan x3 gemas',           icon: 'crown', schedule: 'Lun a Mié', buff: { bossGemMult: 3 } },
  { id: 'e_arena',   name: 'Semana de la Arena',       desc: 'Recompensas x2 en Arena Suprema', icon: 'swords', schedule: 'Jue a Vie', buff: { royaleMult: 2 } }
];
DATA.activeEvents = () => {
  const day = new Date().getDay(); // 0 dom
  const out = [];
  if (day === 0 || day === 6) out.push(DATA.EVENTS[0]);
  if (day >= 1 && day <= 3) out.push(DATA.EVENTS[1]);
  if (day >= 4 && day <= 5) out.push(DATA.EVENTS[2]);
  return out;
};
DATA.eventBuff = (key) => {
  const evs = DATA.activeEvents();
  for (const e of evs) if (e.buff && e.buff[key]) return e.buff[key];
  return 1;
};
