/* ============================================================
   AETHERIA — ui.js
   Menú, HUD, héroes, armería, gacha, mapa de campaña,
   misiones, eventos, ajustes, resultados
   ============================================================ */
'use strict';

const UI = (() => {

  let current = 'loading';
  const screens = ['loading', 'menu', 'heroes', 'armory', 'gacha', 'map', 'missions', 'events', 'settings', 'game'];
  const overlayScreens = ['results', 'pause'];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return U.escape(s); }

  /* ============ Navegación ============ */
  function show(name) {
    current = name;
    for (const s of screens) {
      const e = el('screen-' + s);
      if (e) e.classList.toggle('active', s === name);
    }
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
    if (name === 'menu') { renderMenu(); AudioSys.music('menu'); }
    if (name === 'heroes') renderHeroes();
    if (name === 'armory') renderArmory();
    if (name === 'gacha') renderGacha();
    if (name === 'map') renderMap();
    if (name === 'missions') renderMissions();
    if (name === 'events') renderEvents();
    if (name === 'settings') renderSettings();
    if (name === 'game') { el('hud').classList.add('active'); }
    else el('hud').classList.remove('active');
    AudioSys.sfx('ui');
  }
  function hideOverlay(name) { const e = el('screen-' + name); if (e) e.classList.remove('active'); }
  function showOverlay(name) { el('screen-' + name).classList.add('active'); }

  /* ============ Toast ============ */
  let toastTimer = null;
  function toast(msg, dur = 2200) {
    const t = el('toast');
    t.innerHTML = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), dur);
  }

  /* ============ Menú principal ============ */
  function renderMenu() {
    const d = Save.data;
    renderCurrencies();
    const pc = el('menu-player-card');
    const xpNeed = DATA.xpNeeded(d.player.level);
    pc.innerHTML = `
      <div class="mpc-top">
        <div class="mpc-avatar">${heroBadge(d.activeHero || 'kael', 56)}</div>
        <div class="mpc-info">
          <div class="mpc-name">${esc(d.player.name)} <span class="lvl-chip">Nv. ${d.player.level}</span></div>
          <div class="xp-bar"><div class="xp-fill" style="width:${Math.min(100, d.player.xp / xpNeed * 100)}%"></div></div>
          <div class="mpc-hero">Héroe activo: <b style="color:${DATA.RARITY[DATA.HEROES[d.activeHero || 'kael'].rarity].color}">${DATA.HEROES[d.activeHero || 'kael'].name}</b></div>
        </div>
      </div>`;
    const evs = DATA.activeEvents();
    el('menu-events-strip').innerHTML = evs.length
      ? evs.map(e => `<div class="event-chip">${e.icon} ${esc(e.name)}</div>`).join('')
      : `<div class="event-chip dim">Sin eventos hoy</div>`;
    checkLoginPopup();
    checkNewsPopup();
  }

  function renderCurrencies() {
    const d = Save.data;
    el('cur-gold').textContent = U.fmt(d.player.gold);
    el('cur-gems').textContent = U.fmt(d.player.gems);
    el('cur-tickets').textContent = U.fmt(d.player.tickets);
    // también HUD si visible
    const hg = el('hud-gold'), hm = el('hud-gems');
    if (hg) hg.textContent = U.fmt(d.player.gold);
    if (hm) hm.textContent = U.fmt(d.player.gems);
  }

  function heroBadge(heroId, size = 44) {
    const h = DATA.HEROES[heroId];
    if (!h) return '';
    const r = DATA.RARITY[h.rarity];
    const el_ = DATA.ELEMENTS[h.element];
    return `<div class="hero-badge" style="width:${size}px;height:${size}px;border-color:${r.color};box-shadow:0 0 ${size / 6}px ${r.glow}55">
      <div class="hb-face" style="background:linear-gradient(160deg,${h.model.outfit},${h.model.outfit2})">
        <span style="font-size:${size * 0.42}px">${el_.icon}</span>
      </div>
      <span class="hb-rar" style="background:${r.color}">${h.rarity}</span>
    </div>`;
  }

  /* ============ Login diario ============ */
  function checkLoginPopup() {
    const d = Save.data;
    const today = U.todayKey();
    if (d.login.lastDate === today) return;
    const yesterday = U.todayKey(new Date(Date.now() - 864e5));
    d.login.streak = d.login.lastDate === yesterday ? d.login.streak + 1 : 1;
    d.login.lastDate = today;
    const dayIdx = ((d.login.streak - 1) % 7);
    const reward = DATA.LOGIN_REWARDS[dayIdx];
    const items = Object.entries(reward.item).map(([k, v]) =>
      `<span class="rew-item">${k === 'gold' ? '🪙' : k === 'gems' ? '💎' : '🎟️'} +${U.fmt(v)}</span>`).join('');
    el('login-body').innerHTML = `
      <div class="login-streak">Día ${dayIdx + 1} de 7 · Racha: ${d.login.streak} 🔥</div>
      <div class="login-calendar">${DATA.LOGIN_REWARDS.map((r, i) => {
        const claimed = i < dayIdx;
        const isToday = i === dayIdx;
        return `<div class="cal-day ${claimed ? 'claimed' : ''} ${isToday ? 'today' : ''}">
          <span class="cal-num">${r.day}</span>
          <span class="cal-rew">${r.item.gold ? '🪙' + U.fmt(r.item.gold) : r.item.gems ? '💎' + r.item.gems : '🎟️' + r.item.tickets}</span>
        </div>`;
      }).join('')}</div>
      <div class="login-reward">Hoy recibes: ${items}</div>`;
    showOverlay('login');
    el('login-claim').onclick = () => {
      Game.grantReward(reward.item);
      Save.save();
      AudioSys.sfx('gem');
      hideOverlay('login');
      renderCurrencies();
      toast('¡Recompensa diaria reclamada!');
    };
    Save.save();
  }
  function checkNewsPopup() {
    const d = Save.data;
    if (d.events.seenNews) return;
    d.events.seenNews = true; Save.save();
    setTimeout(() => {
      el('news-body').innerHTML = `
        <p><b>⚔️ AETHERIA 2.0 — Guardianes del Cristal</b></p>
        <p>Nueva versión total del juego:</p>
        <ul style="text-align:left;display:inline-block">
          <li>📖 Campaña con 25 niveles y 6 jefes</li>
          <li>🏰 Defensa Infinita mejorada</li>
          <li>👑 Arena Suprema (battle royale)</li>
          <li>🗺️ Mundo Abierto con historia</li>
          <li>🎭 8 héroes coleccionables + gacha</li>
          <li>🗡️ Armas y armaduras con mejoras</li>
          <li>🎥 3 modos de cámara, ciclo día/noche</li>
        </ul>`;
      showOverlay('news');
      el('news-ok').onclick = () => hideOverlay('news');
    }, 600);
  }

  /* ============ Pantalla Héroes ============ */
  let selectedHero = null;
  function renderHeroes() {
    const d = Save.data;
    const grid = el('heroes-grid');
    grid.innerHTML = Object.values(DATA.HEROES).map(h => {
      const owned = d.heroes.owned.includes(h.id);
      const r = DATA.RARITY[h.rarity];
      const active = (d.activeHero || 'kael') === h.id;
      return `<div class="hero-card ${owned ? '' : 'locked'} ${active ? 'active' : ''}" data-hero="${h.id}"
        style="border-color:${r.color};${active ? `box-shadow:0 0 18px ${r.glow}66` : ''}">
        ${heroBadge(h.id, 62)}
        <div class="hc-name" style="color:${r.color}">${esc(h.name)}</div>
        <div class="hc-title">${esc(h.title)}</div>
        ${owned ? `<div class="hc-lvl">Nv. ${d.heroes.levels[h.id] || 1}</div>` : `<div class="hc-lock">🔒 Invocar</div>`}
        ${active ? '<div class="hc-active">ACTIVO</div>' : ''}
      </div>`;
    }).join('');
    grid.querySelectorAll('.hero-card').forEach(c => {
      c.onclick = () => { selectedHero = c.dataset.hero; AudioSys.sfx('ui'); renderHeroDetail(); };
    });
    if (!selectedHero) selectedHero = d.activeHero || 'kael';
    renderHeroDetail();
  }

  function renderHeroDetail() {
    const d = Save.data;
    const h = DATA.HEROES[selectedHero];
    if (!h) return;
    const owned = d.heroes.owned.includes(h.id);
    const lvl = d.heroes.levels[h.id] || 1;
    const st = DATA.heroStats(h.id, lvl);
    const r = DATA.RARITY[h.rarity];
    const el_ = DATA.ELEMENTS[h.element];
    const panel = el('heroes-detail');
    const upCost = DATA.heroUpgCost(lvl);
    const loadout = d.loadout[h.id] || {};

    let loadoutHtml = '';
    if (owned) {
      const weaponId = loadout.weapon || 'espada_hierro';
      const w = DATA.WEAPONS[weaponId];
      const wPlus = d.weapons.upg[weaponId] || 0;
      const armorSlots = ['head', 'chest', 'boots'].map(slot => {
        const aId = loadout[slot];
        if (aId && DATA.ARMOR[aId]) {
          const a = DATA.ARMOR[aId], ap = d.armor.upg[aId] || 0;
          return `<div class="loadout-slot filled" data-slot="${slot}" style="border-color:${DATA.RARITY[a.rarity].color}">
            <span class="ls-ico">${slot === 'head' ? '⛑' : slot === 'chest' ? '🛡' : '👢'}</span>
            <span class="ls-name">${esc(a.name)}${ap ? ' +' + ap : ''}</span></div>`;
        }
        return `<div class="loadout-slot" data-slot="${slot}"><span class="ls-ico">${slot === 'head' ? '⛑' : slot === 'chest' ? '🛡' : '👢'}</span><span class="ls-name">Vacío</span></div>`;
      }).join('');
      loadoutHtml = `
        <div class="section-title">EQUIPO</div>
        <div class="loadout-row">
          <div class="loadout-slot filled weapon" data-slot="weapon" style="border-color:${DATA.RARITY[w.rarity].color}">
            <span class="ls-ico">⚔</span><span class="ls-name">${esc(w.name)}${wPlus ? ' +' + wPlus : ''}</span></div>
          ${armorSlots}
        </div>
        <div class="hint">Toca un espacio para cambiarlo (Armería → Equipar)</div>`;
    }

    panel.innerHTML = `
      <div class="hd-head" style="border-color:${r.color}">
        ${heroBadge(h.id, 72)}
        <div class="hd-info">
          <div class="hd-name" style="color:${r.color}">${esc(h.name)}</div>
          <div class="hd-title">${esc(h.title)} · ${esc(h.cls)} · <span style="color:${el_.color}">${el_.icon} ${el_.name}</span></div>
          ${owned ? `<div class="hd-lvl">Nivel ${lvl}</div>` : `<div class="hd-locked">🔒 No reclutado — Invócalo en la Grieta</div>`}
        </div>
      </div>
      <div class="hd-desc">${esc(h.desc)}</div>
      ${owned ? `
      <div class="stats-grid">
        <div class="stat"><span>❤️ Vida</span><b>${U.fmt(st.hp)}</b></div>
        <div class="stat"><span>⚔ Ataque</span><b>${U.fmt(st.atk)}</b></div>
        <div class="stat"><span>🛡 Defensa</span><b>${U.fmt(st.def)}</b></div>
        <div class="stat"><span>⚡ Velocidad</span><b>${st.spd.toFixed(1)}</b></div>
        <div class="stat"><span>✨ Crítico</span><b>${Math.round(st.crit * 100)}%</b></div>
      </div>
      <div class="skills-row">
        ${[h.skill1, h.skill2].map(sid => { const s = DATA.SKILLS[sid]; return `<div class="skill-info"><span class="si-icon">${s.icon}</span><div><b>${esc(s.name)}</b> <small>(${s.cd}s)</small><br><small>${esc(s.desc)}</small></div></div>`; }).join('')}
        <div class="skill-info ult"><span class="si-icon">${DATA.ULTS[h.ult].icon}</span><div><b>${esc(DATA.ULTS[h.ult].name)}</b> <small>(Definitiva)</small><br><small>${esc(DATA.ULTS[h.ult].desc)}</small></div></div>
      </div>
      ${loadoutHtml}
      <div class="hd-actions">
        <button class="btn btn-gold" id="hero-upg">⬆ Subir Nv. (${U.fmt(upCost)} 🪙)</button>
        <button class="btn btn-blue" id="hero-select">★ Hacer Activo</button>
      </div>` : `
      <div class="hd-actions"><button class="btn btn-purple" id="hero-gacha-go">✨ Ir a Invocación</button></div>`}
    `;

    if (owned) {
      el('hero-upg').onclick = () => {
        if (d.player.gold >= upCost) {
          Game.spendGold(upCost);
          d.heroes.levels[h.id] = lvl + 1;
          Save.save(); AudioSys.sfx('levelup');
          toast(`${h.name} sube a nivel ${lvl + 1}!`);
          renderCurrencies(); renderHeroes();
        } else { toast('Oro insuficiente'); AudioSys.sfx('uiBack'); }
      };
      el('hero-select').onclick = () => {
        d.activeHero = h.id; Save.save();
        AudioSys.sfx('victory');
        toast(`${h.name} es tu héroe activo`);
        renderHeroes();
      };
      panel.querySelectorAll('.loadout-slot').forEach(slotEl => {
        slotEl.onclick = () => openEquipPicker(h.id, slotEl.dataset.slot);
      });
    } else {
      el('hero-gacha-go').onclick = () => show('gacha');
    }
  }

  function openEquipPicker(heroId, slot) {
    const d = Save.data;
    const isWeapon = slot === 'weapon';
    const items = isWeapon ? DATA.WEAPONS : DATA.ARMOR;
    const ownedIds = Object.keys(isWeapon ? d.weapons.owned : d.armor.owned);
    const list = ownedIds.filter(id => {
      if (isWeapon) return true;
      return DATA.ARMOR[id] && DATA.ARMOR[id].slot === slot;
    });
    el('picker-title').textContent = isWeapon ? 'Equipar Arma' : 'Equipar ' + DATA.ARMOR_SLOTS[slot];
    el('picker-list').innerHTML = list.length ? list.map(id => {
      const it = items[id];
      if (!it) return '';
      const r = DATA.RARITY[it.rarity];
      const plus = (isWeapon ? d.weapons.upg[id] : d.armor.upg[id]) || 0;
      const cur = (d.loadout[heroId] || {})[slot] === id;
      const stat = isWeapon ? `⚔ ${DATA.weaponAtk(id, plus)}` : `🛡 ${DATA.armorStats(id, plus).def} · ❤️ ${DATA.armorStats(id, plus).hp}`;
      const bonus = isWeapon && it.type === DATA.HEROES[heroId].weaponType ? '<span class="cls-bonus">+15% clase</span>' : '';
      return `<div class="picker-item ${cur ? 'current' : ''}" data-id="${id}" style="border-color:${r.color}">
        <div><b style="color:${r.color}">${esc(it.name)}${plus ? ' +' + plus : ''}</b><br><small>${stat} ${bonus}</small></div>
        ${cur ? '<span class="eq-mark">✓</span>' : ''}
      </div>`;
    }).join('') : '<div class="hint">No posees equipo de este tipo. ¡Compra en la Armería!</div>';
    showOverlay('picker');
    el('picker-list').querySelectorAll('.picker-item').forEach(p => {
      p.onclick = () => {
        if (!d.loadout[heroId]) d.loadout[heroId] = {};
        d.loadout[heroId][slot] = p.dataset.id;
        Save.save(); AudioSys.sfx('ui');
        hideOverlay('picker');
        renderHeroDetail();
      };
    });
    el('picker-close').onclick = () => hideOverlay('picker');
  }

  /* ============ Armería ============ */
  let armoryTab = 'weapons';
  function renderArmory() {
    const d = Save.data;
    el('armory-tabs').innerHTML = `
      <button class="tab ${armoryTab === 'weapons' ? 'on' : ''}" data-t="weapons">⚔ Armas</button>
      <button class="tab ${armoryTab === 'armor' ? 'on' : ''}" data-t="armor">🛡 Armaduras</button>`;
    el('armory-tabs').querySelectorAll('.tab').forEach(t => t.onclick = () => { armoryTab = t.dataset.t; renderArmory(); });

    const grid = el('armory-grid');
    if (armoryTab === 'weapons') {
      grid.innerHTML = Object.values(DATA.WEAPONS).map(w => {
        const r = DATA.RARITY[w.rarity];
        const owned = !!d.weapons.owned[w.id];
        const plus = d.weapons.upg[w.id] || 0;
        const canBuy = !owned && d.player.gold >= w.price && d.player.level >= w.lvlReq;
        const upCost = DATA.weaponUpgCost(w.id, plus);
        const equipped = Object.values(d.loadout).some(l => l && l.weapon === w.id);
        return `<div class="item-card" style="border-color:${r.color}">
          <div class="ic-top"><b style="color:${r.color}">${esc(w.name)}</b>${plus ? `<span class="plus">+${plus}</span>` : ''}</div>
          <div class="ic-ico">${weaponIcon(w.type)}</div>
          <div class="ic-stats">
            ⚔ ${DATA.weaponAtk(w.id, plus)} · ⚡ ${(w.spd * 10).toFixed(0) / 10} · ✨ ${Math.round(w.crit * 100)}%
            ${w.element ? ` · <span style="color:${DATA.ELEMENTS[w.element].color}">${DATA.ELEMENTS[w.element].icon}</span>` : ''}
          </div>
          <div class="ic-actions">
            ${owned
              ? `<button class="btn btn-small btn-gold" data-upg="${w.id}" ${d.player.gold < upCost ? 'disabled' : ''}>⬆ ${U.fmt(upCost)}🪙</button>
                 <button class="btn btn-small btn-blue" data-equip="${w.id}">Equipar</button>
                 ${equipped ? '<span class="eq-mark">✓ en uso</span>' : ''}`
              : `<button class="btn btn-small ${canBuy ? 'btn-green' : 'btn-grey'}" data-buy="${w.id}" ${canBuy ? '' : 'disabled'}>
                   ${d.player.level < w.lvlReq ? 'Nv. ' + w.lvlReq : '🪙 ' + U.fmt(w.price)}</button>`}
          </div>
        </div>`;
      }).join('');
      grid.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
        const w = DATA.WEAPONS[b.dataset.buy];
        if (Game.spendGold(w.price)) {
          d.weapons.owned[w.id] = 1;
          Save.save(); AudioSys.sfx('chest');
          toast(`¡Comprado: ${w.name}!`);
          Game.missionEvent('upg_shop', 0);
          renderArmory(); renderCurrencies();
        }
      });
      grid.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => {
        const id = b.dataset.upg;
        const cost = DATA.weaponUpgCost(id, d.weapons.upg[id] || 0);
        if (Game.spendGold(cost)) {
          d.weapons.upg[id] = (d.weapons.upg[id] || 0) + 1;
          Save.save(); AudioSys.sfx('levelup');
          Game.missionEvent('upg', 1);
          renderArmory(); renderCurrencies();
        }
      });
      grid.querySelectorAll('[data-equip]').forEach(b => b.onclick = openEquipPicker.bind(null, d.activeHero || 'kael', 'weapon'));
    } else {
      grid.innerHTML = Object.values(DATA.ARMOR).map(a => {
        const r = DATA.RARITY[a.rarity];
        const owned = !!d.armor.owned[a.id];
        const plus = d.armor.upg[a.id] || 0;
        const st = DATA.armorStats(a.id, plus);
        const canBuy = !owned && d.player.gold >= a.price;
        const upCost = DATA.armorUpgCost(a.id, plus);
        return `<div class="item-card" style="border-color:${r.color}">
          <div class="ic-top"><b style="color:${r.color}">${esc(a.name)}</b>${plus ? `<span class="plus">+${plus}</span>` : ''}
            <span class="slot-tag">${DATA.ARMOR_SLOTS[a.slot]}</span></div>
          <div class="ic-ico">${a.slot === 'head' ? '⛑' : a.slot === 'chest' ? '🛡' : '👢'}</div>
          <div class="ic-stats">🛡 ${st.def} · ❤️ ${U.fmt(st.hp)}${st.spd ? ` · ⚡ +${st.spd}` : ''}</div>
          <div class="ic-actions">
            ${owned
              ? `<button class="btn btn-small btn-gold" data-upg="${a.id}" ${d.player.gold < upCost ? 'disabled' : ''}>⬆ ${U.fmt(upCost)}🪙</button>
                 <button class="btn btn-small btn-blue" data-equip="${a.id}">Equipar</button>`
              : `<button class="btn btn-small ${canBuy ? 'btn-green' : 'btn-grey'}" data-buy="${a.id}" ${canBuy ? '' : 'disabled'}>🪙 ${U.fmt(a.price)}</button>`}
          </div>
        </div>`;
      }).join('');
      grid.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
        const a = DATA.ARMOR[b.dataset.buy];
        if (Game.spendGold(a.price)) {
          d.armor.owned[a.id] = 1;
          Save.save(); AudioSys.sfx('chest');
          toast(`¡Comprado: ${a.name}!`);
          renderArmory(); renderCurrencies();
        }
      });
      grid.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => {
        const id = b.dataset.upg;
        const cost = DATA.armorUpgCost(id, d.armor.upg[id] || 0);
        if (Game.spendGold(cost)) {
          d.armor.upg[id] = (d.armor.upg[id] || 0) + 1;
          Save.save(); AudioSys.sfx('levelup');
          Game.missionEvent('upg', 1);
          renderArmory(); renderCurrencies();
        }
      });
      grid.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => openEquipPicker(d.activeHero || 'kael', DATA.ARMOR[b.dataset.equip].slot));
    }
  }
  function weaponIcon(type) {
    return { espada: '🗡', mandoble: '⚔', lanza: '🔱', arco: '🏹', baston: '🪄', dagas: '🔪', martillo: '🔨' }[type] || '⚔';
  }

  /* ============ Gacha ============ */
  function renderGacha() {
    const d = Save.data;
    const b = DATA.GACHA.banner;
    const feat = DATA.HEROES[b.featured], sub = b.subFeatured.map(id => DATA.HEROES[id]);
    const fr = DATA.RARITY[feat.rarity];
    el('gacha-banner').innerHTML = `
      <div class="gb-art" style="background:radial-gradient(circle at 70% 30%, ${fr.glow}33, transparent 60%), linear-gradient(140deg,#1e1b4b,#4c1d95)">
        <div class="gb-featured">${heroBadge(feat.id, 84)}</div>
        <div class="gb-info">
          <div class="gb-title" style="color:${fr.glow}">✨ ${esc(b.name)} ✨</div>
          <div class="gb-sub">¡${esc(feat.name)}, ${esc(feat.title)} con tasa x3!</div>
          <div class="gb-sub2">También: ${sub.map(s => esc(s.name)).join(' · ')}</div>
        </div>
      </div>
      <div class="gacha-rates">
        <span style="color:${DATA.RARITY.UR.color}">UR ${(DATA.GACHA.rates.find(r => r[0] === 'UR')[1] * 100).toFixed(1)}%</span>
        <span style="color:${DATA.RARITY.SSR.color}">SSR ${(DATA.GACHA.rates.find(r => r[0] === 'SSR')[1] * 100).toFixed(1)}%</span>
        <span style="color:${DATA.RARITY.SR.color}">SR 10%</span>
        <span style="color:${DATA.RARITY.R.color}">R 86%</span>
      </div>
      <div class="pity-info">🛡 Garantizado SR+ cada ${DATA.GACHA.pity4At} · ✨ Garantizado SSR+ cada ${DATA.GACHA.pity5At}
        <br>Actual: <b>${d.gacha.pity4}</b> / <b>${d.gacha.pity5}</b></div>`;
    el('gacha-single-ticket').innerHTML = `🎟️ x1 <small>(tienes ${d.player.tickets})</small>`;
    el('gacha-ten-ticket').innerHTML = `🎟️ x10 <small>(tienes ${d.player.tickets})</small>`;
    el('gacha-single-gems').innerHTML = `💎 150`;
    el('gacha-ten-gems').innerHTML = `💎 1350 <span class="disc">-10%</span>`;
  }

  function rollRarity() {
    const d = Save.data;
    d.gacha.pity4++; d.gacha.pity5++; d.gacha.total++;
    let rar;
    if (d.gacha.pity5 >= DATA.GACHA.pity5At) { rar = Math.random() < 0.06 ? 'UR' : 'SSR'; }
    else if (d.gacha.pity4 >= DATA.GACHA.pity4At) { rar = Math.random() < 0.22 ? 'SSR' : 'SR'; }
    else {
      const roll = Math.random();
      let acc = 0;
      for (const [r, p] of DATA.GACHA.rates) { acc += p; if (roll < acc) { rar = r; break; } }
      rar = rar || 'C';
    }
    if (['SR', 'SSR', 'UR'].includes(rar)) d.gacha.pity4 = 0;
    if (['SSR', 'UR'].includes(rar)) d.gacha.pity5 = 0;
    return rar;
  }
  function doPull(n, currency) {
    const d = Save.data;
    const G = DATA.GACHA;
    const cost = n === 1 ? { tickets: G.costs.single_ticket, gems: G.costs.single_gems }
                         : { tickets: G.costs.ten_tickets, gems: G.costs.ten_gems };
    const have = currency === 'tickets' ? d.player.tickets : d.player.gems;
    if (have < cost[currency]) { toast(currency === 'tickets' ? 'Tickets insuficientes' : 'Gemas insuficientes'); AudioSys.sfx('uiBack'); return; }
    if (currency === 'tickets') d.player.tickets -= cost.tickets;
    else d.player.gems -= cost.gems;

    const results = [];
    for (let i = 0; i < n; i++) {
      let rar = rollRarity();
      // héroe destacado con prob. extra en SSR/UR
      let pool = Object.values(DATA.HEROES).filter(h => h.rarity === rar);
      if (!pool.length) { rar = 'R'; pool = Object.values(DATA.HEROES).filter(h => h.rarity === 'R'); }
      if ((rar === 'SSR' || rar === 'UR') && Math.random() < 0.3) pool = [DATA.HEROES[G.banner.featured], ...pool].filter(Boolean);
      const hero = U.pick(pool);
      const owned = d.heroes.owned.includes(hero.id);
      if (owned) {
        const gems = G.dupeGems[hero.rarity];
        d.player.gems += gems;
        results.push({ hero, dupe: true, gems });
      } else {
        d.heroes.owned.push(hero.id);
        d.heroes.levels[hero.id] = 1;
        results.push({ hero, dupe: false });
      }
    }
    Game.missionEvent('gacha', n);
    if (results.some(r => ['SSR', 'UR'].includes(r.hero.rarity) && !r.dupe)) Game.missionEvent('hero_new', 1);
    Save.save();
    renderCurrencies();
    showPullResults(results);
  }
  function showPullResults(results) {
    const best = results.reduce((a, r) => {
      const order = ['C', 'R', 'SR', 'SSR', 'UR'];
      return order.indexOf(r.hero.rarity) > order.indexOf(a.hero.rarity) ? r : a;
    }, results[0]);
    if (['SSR', 'UR'].includes(best.hero.rarity)) { AudioSys.sfx('gachaRare'); VFX && VFX.flash('#fbbf24', 0.5, 600); }
    else AudioSys.sfx('gacha');
    el('gacha-results').innerHTML = results.map((r, i) => {
      const h = r.hero, rc = DATA.RARITY[h.rarity];
      return `<div class="pull-card rarity-${h.rarity}" style="animation-delay:${i * 0.12}s;border-color:${rc.color};box-shadow:0 0 22px ${rc.glow}44">
        ${heroBadge(h.id, 58)}
        <div class="pc-name" style="color:${rc.color}">${esc(h.name)}</div>
        <div class="pc-rar">${rc.name}</div>
        ${r.dupe ? `<div class="pc-dupe">Repetido → 💎+${r.gems}</div>` : `<div class="pc-new">¡NUEVO!</div>`}
      </div>`;
    }).join('');
    showOverlay('gacha-results');
    el('gacha-results-ok').onclick = () => { hideOverlay('gacha-results'); renderGacha(); };
  }

  /* ============ Mapa de campaña ============ */
  let mapRegion = 0;
  function renderMap() {
    const d = Save.data;
    el('map-region-tabs').innerHTML = DATA.REGIONS.map((r, i) => {
      const unlocked = i === 0 || d.campaign.unlocked > i * 5;
      return `<button class="tab region-tab ${i === mapRegion ? 'on' : ''} ${unlocked ? '' : 'locked'}" data-i="${i}" style="${i === mapRegion ? `border-color:${r.color}` : ''}">
        ${unlocked ? r.name : '🔒 ' + r.name}</button>`;
    }).join('');
    el('map-region-tabs').querySelectorAll('.tab').forEach(t => t.onclick = () => {
      const i = +t.dataset.i;
      if (i * 5 < d.campaign.unlocked - 0 && i > 0 && d.campaign.unlocked <= i * 5) { toast('Completa la región anterior'); return; }
      mapRegion = i; renderMap();
    });

    const reg = DATA.REGIONS[mapRegion];
    const levels = DATA.CAMPAIGN.filter(l => l.regionIdx === mapRegion);
    el('map-region-name').textContent = reg.name;
    el('map-region-desc').textContent = reg.desc;
    el('campaign-map').style.background = `linear-gradient(160deg, ${reg.color}22, #0f172a 65%)`;

    el('map-nodes').innerHTML = levels.map((l, i) => {
      const unlocked = d.campaign.unlocked >= l.id;
      const stars = d.campaign.stars[l.id] || 0;
      const isBoss = !!DATA.BOSSES[l.boss || ''] && l.idxInRegion === 5;
      const bossId = l.idxInRegion === 5 ? l.boss : null;
      const top = 8 + i * 17;
      const left = 50 + Math.sin(i * 1.7 + mapRegion) * 26;
      return `<div class="map-node ${unlocked ? '' : 'locked'} ${isBoss ? 'boss' : ''}" data-lvl="${l.id}"
          style="top:${top}%;left:${left}%;--c:${reg.color}">
        ${unlocked ? `<div class="mn-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>` : '<div class="mn-lock">🔒</div>'}
        <div class="mn-circle">${isBoss ? '👑' : l.id}</div>
        <div class="mn-label">${isBoss ? esc((DATA.BOSSES[bossId] || {}).name || 'Jefe') : 'Nv. ' + l.id}</div>
      </div>`;
    }).join('') + levels.slice(0, -1).map((l, i) => {
      const top = 8 + i * 17, left = 50 + Math.sin(i * 1.7 + mapRegion) * 26;
      const ntop = 8 + (i + 1) * 17, nleft = 50 + Math.sin((i + 1) * 1.7 + mapRegion) * 26;
      return `<div class="map-link" style="top:${top + 7}%;left:${Math.min(left, nleft) + 4}%;width:${Math.abs(nleft - left) + 2 || 2}%;height:${ntop - top - 10}%;${nleft < left ? 'transform:scaleX(-1);' : ''}"></div>`;
    }).join('');

    el('map-nodes').querySelectorAll('.map-node').forEach(n => {
      n.onclick = () => {
        const id = +n.dataset.lvl;
        if (d.campaign.unlocked < id) { toast('🔒 Completa niveles anteriores'); AudioSys.sfx('uiBack'); return; }
        openLevelPopup(id);
      };
    });
  }

  function openLevelPopup(id) {
    const d = Save.data;
    const L = DATA.CAMPAIGN[id - 1];
    const first = !(d.campaign.stars[id] >= 0 && d.campaign.unlocked > id);
    const rew = d.campaign.stars[id] ? L.rewards.replay : L.rewards.first;
    const stars = d.campaign.stars[id] || 0;
    el('level-pop-body').innerHTML = `
      <h3 style="color:${DATA.REGIONS[L.regionIdx].color}">${L.idxInRegion === 5 ? '👑 ' : ''}${esc(L.name)}</h3>
      <div class="lp-region">${DATA.REGIONS[L.regionIdx].name}</div>
      <div class="lp-stats">
        <span>⚡ Poder recomendado: <b>${U.fmt(L.power)}</b></span>
        <span>🌊 Oleadas: <b>${L.waves}</b></span>
        ${L.idxInRegion === 5 ? '<span>⚠️ <b>Nivel de JEFE</b></span>' : ''}
      </div>
      <div class="lp-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <div class="lp-rew">
        <span>🪙 ${U.fmt(rew.gold)}</span><span>💎 ${rew.gems}</span><span>⭐ ${rew.xp} XP</span>
        ${rew.tickets ? `<span>🎟️ ${rew.tickets}</span>` : ''}
      </div>
      ${L.intro ? `<div class="lp-intro">${esc(L.intro)}</div>` : ''}`;
    showOverlay('level-pop');
    el('level-pop-play').onclick = () => {
      hideOverlay('level-pop');
      Modes.start('campaign', { levelId: id });
    };
    el('level-pop-close').onclick = () => hideOverlay('level-pop');
  }

  /* ============ Misiones ============ */
  let missionTab = 'daily';
  function renderMissions() {
    Game.ensureMissions();
    const d = Save.data;
    el('mission-tabs').innerHTML = `
      <button class="tab ${missionTab === 'daily' ? 'on' : ''}" data-t="daily">📅 Diarias</button>
      <button class="tab ${missionTab === 'weekly' ? 'on' : ''}" data-t="weekly">🗓 Semanales</button>
      <button class="tab ${missionTab === 'ach' ? 'on' : ''}" data-t="ach">🏆 Logros</button>`;
    el('mission-tabs').querySelectorAll('.tab').forEach(t => t.onclick = () => { missionTab = t.dataset.t; renderMissions(); });

    const box = el('mission-list');
    if (missionTab === 'daily' || missionTab === 'weekly') {
      const isDaily = missionTab === 'daily';
      const list = isDaily ? d.missions.daily : d.missions.weekly;
      const claimed = isDaily ? d.missions.claimedDaily : d.missions.claimedWeekly;
      const pool = isDaily ? DATA.DAILY_POOL : DATA.WEEKLY_POOL;
      box.innerHTML = list.map(m => {
        const def = pool.find(p => p.id === m.id);
        if (!def) return '';
        const done = m.prog >= def.goal;
        const got = claimed.includes(m.id);
        const rewStr = Object.entries(def.reward).map(([k, v]) =>
          `${k === 'gold' ? '🪙' : k === 'gems' ? '💎' : '🎟️'}+${U.fmt(v)}`).join(' ');
        return `<div class="mission-row ${got ? 'claimed' : ''}">
          <div class="m-info"><b>${esc(def.desc)}</b>
            <div class="m-bar"><div class="m-fill" style="width:${Math.min(100, m.prog / def.goal * 100)}%"></div></div>
          </div>
          <div class="m-right">
            <span class="m-prog">${U.fmt(Math.min(m.prog, def.goal))}/${U.fmt(def.goal)}</span>
            ${got ? '<span class="claimed-mark">✓</span>'
              : `<button class="btn btn-small ${done ? 'btn-green' : 'btn-grey'}" data-claim="${m.id}" ${done ? '' : 'disabled'}>Reclamar<br><small>${rewStr}</small></button>`}
          </div>
        </div>`;
      }).join('');
      box.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
        const pool2 = isDaily ? DATA.DAILY_POOL : DATA.WEEKLY_POOL;
        const def = pool2.find(p => p.id === b.dataset.claim);
        if (!def) return;
        const arr = isDaily ? d.missions.claimedDaily : d.missions.claimedWeekly;
        arr.push(def.id);
        Game.grantReward(def.reward);
        Save.save(); AudioSys.sfx('gem');
        toast('¡Recompensa reclamada!');
        renderCurrencies(); renderMissions();
      });
    } else {
      box.innerHTML = DATA.ACHIEVEMENTS.map(a => {
        const prog = Game.achProgress(a);
        const done = prog >= a.goal;
        const claimed = !!d.achievements[a.id + '_claimed'];
        const rewStr = Object.entries(a.reward).map(([k, v]) => `${k === 'gold' ? '🪙' : k === 'gems' ? '💎' : '🎟️'}+${U.fmt(v)}`).join(' ');
        return `<div class="mission-row ${claimed ? 'claimed' : ''}">
          <div class="m-info"><b>🏆 ${esc(a.name)}</b><br><small>${esc(a.desc)}</small>
            <div class="m-bar"><div class="m-fill" style="width:${Math.min(100, prog / a.goal * 100)}%"></div></div>
          </div>
          <div class="m-right">
            <span class="m-prog">${U.fmt(Math.min(prog, a.goal))}/${U.fmt(a.goal)}</span>
            ${claimed ? '<span class="claimed-mark">✓</span>'
              : `<button class="btn btn-small ${done ? 'btn-green' : 'btn-grey'}" data-ach="${a.id}" ${done ? '' : 'disabled'}>Reclamar<br><small>${rewStr}</small></button>`}
          </div>
        </div>`;
      }).join('');
      box.querySelectorAll('[data-ach]').forEach(b => b.onclick = () => {
        const a = DATA.ACHIEVEMENTS.find(x => x.id === b.dataset.ach);
        d.achievements[a.id + '_claimed'] = true;
        Game.grantReward(a.reward);
        Save.save(); AudioSys.sfx('gem');
        toast('🏆 ¡Logro reclamado!');
        renderCurrencies(); renderMissions();
      });
    }
  }

  /* ============ Eventos + Tienda ============ */
  function renderEvents() {
    const d = Save.data;
    const evs = DATA.activeEvents();
    el('events-list').innerHTML = evs.length ? evs.map(e => `
      <div class="event-card">
        <div class="ec-icon">${e.icon}</div>
        <div class="ec-info"><b>${esc(e.name)}</b><br><small>${esc(e.desc)} · ${e.schedule}</small></div>
        <span class="ec-live">● EN VIVO</span>
      </div>`).join('') : '<div class="hint">Hoy no hay eventos. ¡Vuelve mañana!</div>';

    el('gem-shop').innerHTML = `
      <div class="section-title">💎 TIENDA DE GEMAS</div>
      <div class="gem-packs">${DATA.GEM_PACKS.map(p => `
        <div class="gem-pack">
          <div class="gp-gems">💎 ${U.fmt(p.gems)}</div>
          ${p.bonus ? `<div class="gp-bonus">+${U.fmt(p.bonus)} BONO</div>` : ''}
          <div class="gp-label">${p.label}</div>
          <button class="btn btn-small btn-purple" data-pack="${p.id}">${p.price}</button>
        </div>`).join('')}
      </div>
      <div class="hint">Pago simulado en esta versión de prueba — integración de compras listo para producción.</div>
      <div class="section-title">🎁 OFERTAS DE ORO</div>
      <div class="gem-packs">
        <div class="gem-pack"><div class="gp-gems">🪙 1,000</div><div class="gp-label">Bolsa</div><button class="btn btn-small btn-blue" data-gold="1000" data-cost="50">💎 50</button></div>
        <div class="gem-pack"><div class="gp-gems">🪙 5,000</div><div class="gp-bonus">MEJOR VALOR</div><div class="gp-label">Cofre</div><button class="btn btn-small btn-blue" data-gold="5000" data-cost="220">💎 220</button></div>
        <div class="gem-pack"><div class="gp-gems">🎟️ 1 Ticket</div><div class="gp-label">Invocación</div><button class="btn btn-small btn-blue" data-ticket="1" data-cost="120">💎 120</button></div>
      </div>`;
    el('gem-shop').querySelectorAll('[data-pack]').forEach(b => b.onclick = () => {
      const p = DATA.GEM_PACKS.find(x => x.id === b.dataset.pack);
      d.player.gems += p.gems + p.bonus;
      Save.save(); AudioSys.sfx('gem');
      toast(`💎 +${U.fmt(p.gems + p.bonus)} gemas (demo)`);
      renderCurrencies();
    });
    el('gem-shop').querySelectorAll('[data-gold]').forEach(b => b.onclick = () => {
      const cost = +b.dataset.cost;
      if (Game.spendGems(cost)) {
        Game.addGold(+b.dataset.gold);
        AudioSys.sfx('coin'); toast('🪙 Oro comprado');
        renderCurrencies();
      } else toast('Gemas insuficientes');
    });
    el('gem-shop').querySelectorAll('[data-ticket]').forEach(b => b.onclick = () => {
      const cost = +b.dataset.cost;
      if (Game.spendGems(cost)) {
        d.player.tickets += 1;
        AudioSys.sfx('gem'); toast('🎟️ +1 Ticket');
        renderCurrencies();
      } else toast('Gemas insuficientes');
    });
  }

  /* ============ Ajustes ============ */
  function renderSettings() {
    const s = Save.data.settings;
    el('settings-list').innerHTML = `
      <div class="set-row"><span>🎨 Calidad gráfica</span>
        <div class="seg">
          ${['auto', 'low', 'medium', 'high'].map(q => `<button class="seg-btn ${s.quality === q ? 'on' : ''}" data-q="${q}">${{ auto: 'Auto', low: 'Baja', medium: 'Media', high: 'Alta' }[q]}</button>`).join('')}
        </div></div>
      <div class="set-row"><span>🎥 Cámara por defecto</span>
        <div class="seg">
          ${['third', 'aerial', 'first'].map(c => `<button class="seg-btn ${s.camera === c ? 'on' : ''}" data-cam="${c}">${{ third: '3ª Persona', aerial: 'Aérea', first: '1ª Persona' }[c]}</button>`).join('')}
        </div></div>
      <div class="set-row"><span>🖱 Sensibilidad cámara</span><input type="range" id="set-sens" min="0.4" max="2" step="0.1" value="${s.sens}"></div>
      <div class="set-row"><span>⚔ Auto-ataque</span><button class="toggle ${s.autoAttack ? 'on' : ''}" data-t="autoAttack">${s.autoAttack ? 'ON' : 'OFF'}</button></div>
      <div class="set-row"><span>🔢 Números de daño</span><button class="toggle ${s.dmgNumbers ? 'on' : ''}" data-t="dmgNumbers">${s.dmgNumbers ? 'ON' : 'OFF'}</button></div>
      <div class="set-row"><span>📳 Vibración</span><button class="toggle ${s.shake ? 'on' : ''}" data-t="shake">${s.shake ? 'ON' : 'OFF'}</button></div>
      <div class="set-row"><span>🔊 Efectos de sonido</span><button class="toggle ${s.sfx ? 'on' : ''}" data-t="sfx">${s.sfx ? 'ON' : 'OFF'}</button></div>
      <div class="set-row"><span>🎵 Música</span><button class="toggle ${s.music ? 'on' : ''}" data-t="music">${s.music ? 'ON' : 'OFF'}</button></div>
      <div class="set-row danger"><span>⚠️ Borrar progreso</span><button class="btn btn-small btn-red" id="set-reset">Reiniciar</button></div>
      <div class="credits">AETHERIA · Guardianes del Cristal · v2.0.0<br>Hecho con Three.js — 100% offline</div>`;
    el('settings-list').querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      s.quality = b.dataset.q; Save.save();
      toast('La calidad se aplicará al reiniciar la partida');
      renderSettings();
    });
    el('settings-list').querySelectorAll('[data-cam]').forEach(b => b.onclick = () => {
      s.camera = b.dataset.cam; Save.save(); renderSettings();
    });
    const sens = el('set-sens');
    if (sens) sens.oninput = () => { s.sens = +sens.value; Save.save(); Engine.CamRig.sens = s.sens; };
    el('settings-list').querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const key = b.dataset.t;
      s[key] = !s[key];
      if (key === 'sfx') AudioSys.setSfx(s.sfx);
      if (key === 'music') { AudioSys.setMusic(s.music); if (s.music && current === 'menu') AudioSys.music('menu'); }
      if (key === 'shake') VFX.setShakeEnabled(s.shake);
      Save.save(); renderSettings();
    });
    el('set-reset').onclick = () => {
      if (confirm('¿Seguro que quieres borrar TODO tu progreso?')) {
        Save.reset(); location.reload();
      }
    };
  }

  /* ============ HUD ============ */
  const hudEls = {};
  function initHUD() {
    ['hud-hp-fill', 'hud-hp-txt', 'hud-energy-fill', 'hud-shield', 'skill-1', 'skill-2', 'skill-ult',
     'skill-1-cd', 'skill-2-cd', 'dodge-btn', 'wave-info', 'boss-bar', 'boss-fill', 'boss-name',
     'combo-box', 'combo-num', 'hud-gold', 'hud-gems', 'minimap', 'objective-txt', 'kill-feed',
     'zone-timer', 'royale-alive', 'quest-tracker'].forEach(id => hudEls[id] = el(id));
    VFX.initDamageNumbers(Engine.camera, el('dmg-layer'));
    VFX.setFlashEl(el('flash-overlay'));
  }

  function updateHUD(dt) {
    const p = Combat.player;
    if (!p) return;
    if (hudEls['hud-hp-fill']) {
      hudEls['hud-hp-fill'].style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
      hudEls['hud-hp-txt'].textContent = `${U.fmt(Math.max(0, p.hp))} / ${U.fmt(p.maxHp)}`;
      hudEls['hud-energy-fill'].style.width = p.energy + '%';
      hudEls['hud-shield'].style.width = p.shieldHp > 0 ? Math.min(100, p.shieldHp / p.maxHp * 100) + '%' : '0%';
      // cooldowns
      const s1 = DATA.SKILLS[p.hero.skill1], s2 = DATA.SKILLS[p.hero.skill2];
      setCd('skill-1-cd', p.s1Cd, s1.cd);
      setCd('skill-2-cd', p.s2Cd, s2.cd);
      hudEls['skill-ult'].classList.toggle('ready', p.energy >= 100);
      hudEls['dodge-btn'].classList.toggle('cd', p.dodgeCd > 0);
      // combo
      const cb = Combat.combo;
      if (cb >= 5) {
        hudEls['combo-box'].classList.add('show');
        hudEls['combo-num'].textContent = cb;
      } else hudEls['combo-box'].classList.remove('show');
    }
    const boss = Combat.boss;
    if (boss && !boss.dead) {
      hudEls['boss-bar'].classList.add('show');
      hudEls['boss-fill'].style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
      hudEls['boss-name'].textContent = boss.name + '  ' + '♠'.repeat(boss.phase || 1);
    } else hudEls['boss-bar'].classList.remove('show');
    // minimapa
    drawMinimap();
  }
  function setCd(id, cd, max) {
    const e = hudEls[id];
    if (!e) return;
    if (cd <= 0) { e.style.background = 'none'; e.textContent = ''; }
    else {
      e.style.background = `conic-gradient(rgba(0,0,0,0.75) ${cd / max * 360}deg, transparent 0deg)`;
      e.textContent = Math.ceil(cd);
    }
  }

  let minimapCtx = null;
  function drawMinimap() {
    const mm = hudEls['minimap'];
    if (!mm || mm.style.display === 'none') return;
    if (!minimapCtx) minimapCtx = mm.getContext('2d');
    const ctx = minimapCtx;
    const W = mm.width, H = mm.height;
    ctx.clearRect(0, 0, W, H);
    const p = Combat.player;
    if (!p) return;
    const size = Engine.worldSize;
    const scale = W / size;
    const px = (x) => (x + size / 2) * scale, pz = (z) => H - (z + size / 2) * scale;
    // zona royale
    if (Modes.current === 'royale' && Modes.instance && Modes.instance.zone) {
      const z = Modes.instance.zone;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(z.x), pz(z.z), z.r * scale, 0, 7);
      ctx.stroke();
    }
    // cristal
    const c = Combat.crystal;
    if (c) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(px(c.pos.x) - 3, pz(c.pos.z) - 3, 6, 6); }
    // enemigos
    ctx.fillStyle = '#f87171';
    for (const e of Combat.enemies) {
      if (e.dead) continue;
      const r = e.type === 'boss' ? 4 : 2.2;
      ctx.fillRect(px(e.pos.x) - r / 2, pz(e.pos.z) - r / 2, r, r);
    }
    // cofres/objetivos
    if (Modes.instance && Modes.instance.mapMarkers) {
      ctx.fillStyle = '#fbbf24';
      for (const m of Modes.instance.mapMarkers) {
        ctx.beginPath(); ctx.arc(px(m.x), pz(m.z), 2.5, 0, 7); ctx.fill();
      }
    }
    // jugador (flecha)
    ctx.save();
    ctx.translate(px(p.pos.x), pz(p.pos.z));
    ctx.rotate(-p.facing);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ============ Banners y anuncios ============ */
  function bigBanner(html, cls = '', dur = 2400) {
    const b = el('big-banner');
    b.className = 'big-banner show ' + cls;
    b.innerHTML = html;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), dur);
  }
  let bannerTimer = null;
  function waveBanner(n, total) {
    bigBanner(`<div class="bb-kicker">INVASIÓN</div><div class="bb-main">Oleada ${n}${total ? ' / ' + total : ''}</div>`, 'wave');
    AudioSys.sfx('wave');
  }
  function bossIntro(B) {
    bigBanner(`<div class="bb-kicker">${esc(B.title)}</div><div class="bb-main">👑 ${esc(B.name)}</div>`, 'boss', 3200);
  }
  function ultBanner(heroName, ultName) {
    bigBanner(`<div class="bb-kicker">${esc(heroName)}</div><div class="bb-main">💫 ${esc(ultName)}</div>`, 'ult', 1800);
  }
  function modeBanner(title, sub) {
    bigBanner(`<div class="bb-kicker">${esc(sub)}</div><div class="bb-main">${esc(title)}</div>`, 'mode', 2600);
  }

  function addKillFeed(text) {
    const kf = hudEls['kill-feed'];
    if (!kf) return;
    const div = document.createElement('div');
    div.className = 'kf-item';
    div.textContent = text;
    kf.prepend(div);
    while (kf.children.length > 5) kf.removeChild(kf.lastChild);
    setTimeout(() => div.remove(), 5000);
  }

  /* ============ Diálogos (mundo abierto) ============ */
  let dlgQueue = [], dlgDone = null;
  function showDialogue(name, lines, onDone) {
    dlgQueue = lines.slice(); dlgDone = onDone || null;
    el('dlg-name').textContent = name;
    el('dlg-box').classList.add('show');
    nextDialogue();
  }
  function nextDialogue() {
    if (dlgQueue.length === 0) {
      el('dlg-box').classList.remove('show');
      if (dlgDone) { const f = dlgDone; dlgDone = null; f(); }
      return;
    }
    const t = dlgQueue.shift();
    const txt = el('dlg-text');
    txt.style.opacity = '0';
    setTimeout(() => { txt.textContent = t; txt.style.opacity = '1'; }, 80);
    AudioSys.sfx('ui');
  }

  /* ============ Resultados ============ */
  function showResults(opts) {
    el('results-title').textContent = opts.win ? '¡VICTORIA!' : 'DERROTA';
    el('results-title').className = 'results-title ' + (opts.win ? 'win' : 'lose');
    el('results-sub').textContent = opts.subtitle || '';
    let starsHtml = '';
    if (opts.stars !== undefined) {
      starsHtml = `<div class="results-stars">${[1, 2, 3].map(i =>
        `<span class="r-star ${i <= opts.stars ? 'on' : ''}" style="animation-delay:${i * 0.35}s">★</span>`).join('')}</div>`;
    }
    el('results-body').innerHTML = `
      ${starsHtml}
      ${opts.rows ? opts.rows.map(r => `<div class="res-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') : ''}
      ${opts.rewards ? `<div class="res-rewards">
        ${opts.rewards.gold ? `<span>🪙 +${U.fmt(opts.rewards.gold)}</span>` : ''}
        ${opts.rewards.gems ? `<span>💎 +${U.fmt(opts.rewards.gems)}</span>` : ''}
        ${opts.rewards.xp ? `<span>⭐ +${U.fmt(opts.rewards.xp)} XP</span>` : ''}
        ${opts.rewards.tickets ? `<span>🎟️ +${opts.rewards.tickets}</span>` : ''}
      </div>` : ''}`;
    el('results-retry').style.display = opts.onRetry ? '' : 'none';
    el('results-next').style.display = opts.onNext ? '' : 'none';
    el('results-retry').onclick = opts.onRetry || null;
    el('results-next').onclick = opts.onNext || null;
    el('results-menu').onclick = opts.onMenu || (() => Game.backToMenu());
    showOverlay('results');
    if (opts.win) AudioSys.sfx('victory'); else AudioSys.sfx('fail');
  }

  /* ============ Pausa ============ */
  function showPause() {
    showOverlay('pause');
    el('pause-resume').onclick = () => { hideOverlay('pause'); Game.resume(); };
    el('pause-menu').onclick = () => { hideOverlay('pause'); Game.backToMenu(); };
    el('pause-retry').onclick = () => { hideOverlay('pause'); Game.retry(); };
  }

  /* ============ Tutorial ============ */
  function showTutorialTips() {
    if (Save.data.tutorial.done) return;
    toast('🕹️ Joystick para moverte · ⚔ botón para atacar', 3500);
    setTimeout(() => toast('✨ Usa habilidades y esquiva con ⟳', 3000), 4000);
    setTimeout(() => toast('🎥 Cambia cámara con el botón 📷', 3000), 8000);
    Save.data.tutorial.done = true; Save.save();
  }

  return {
    show, toast, renderCurrencies, heroBadge, initHUD, updateHUD,
    waveBanner, bossIntro, ultBanner, modeBanner, bigBanner, addKillFeed,
    showDialogue, nextDialogue, showResults, showPause, showTutorialTips,
    pull: doPull,
    get current() { return current; },
    weaponIcon
  };
})();
