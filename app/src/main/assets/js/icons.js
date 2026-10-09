/* ============================================================
   AETHERIA — icons.js
   Iconografía SVG estilo juego (stroke 24x24), sin emoticons
   ============================================================ */
'use strict';

const Ico = (() => {
  const D = {
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9.5 9.3c0-1 1.1-1.6 2.5-1.6s2.5.6 2.5 1.6-1.1 1.5-2.5 1.8-2.5.8-2.5 1.8 1.1 1.6 2.5 1.6 2.5-.6 2.5-1.6"/>',
    gem: '<path d="M7 3h10l4 6-9 12L3 9z"/><path d="M3 9h18"/><path d="M12 21 8.5 9 12 3l3.5 6z"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 3"/>',
    chest: '<path d="M3 10a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9H3z"/><path d="M3 13h18"/><path d="M12 13v2.5"/><rect x="10.6" y="14.6" width="2.8" height="3.2" rx="0.6"/>',
    gift: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8c-3.2 0-4.7-1.1-4.7-2.6S9 2.8 12 8z"/><path d="M12 8c3.2 0 4.7-1.1 4.7-2.6S15 2.8 12 8z"/>',
    sword: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>',
    swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 10"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/>',
    shield: '<path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z"/>',
    bow: '<path d="M4 20C4 11.5 11.5 4 20 4"/><line x1="4" y1="20" x2="20" y2="4"/><path d="M12 4h8v8"/><path d="M4 20l1.2-3.2.6 1.4 1.4.6z"/>',
    staff: '<line x1="9" y1="22" x2="15.5" y2="7"/><circle cx="16.5" cy="5" r="2.6"/><path d="M20 10.5l.7 1.8M22 9l-.4 2"/>',
    dagger: '<path d="M12 2.5 15 9l-3 12.5L9 9z"/><line x1="7.5" y1="9" x2="16.5" y2="9"/><line x1="12" y1="21.5" x2="12" y2="23"/>',
    hammer: '<path d="m15 12-8.4 8.4a1.4 1.4 0 0 1-2-2L13 10"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.9-1.9A2 2 0 0 1 19 8.2V7l-2.3-2.3a6 6 0 0 0-4.2-1.7L9 3l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9"/>',
    spear: '<path d="M15 3l6 6-3.2.8L14.2 6z"/><line x1="14.4" y1="7.6" x2="3" y2="19"/><line x1="3" y1="19" x2="5" y2="21"/>',
    heart: '<path d="M12 21C7 16.5 3 13.2 3 9a4.6 4.6 0 0 1 9-1.6A4.6 4.6 0 0 1 21 9c0 4.2-4 7.5-9 12z"/>',
    skull: '<path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.2 4.7 3 6.2V20h10v-3.8c1.8-1.5 3-3.7 3-6.2a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1.4"/><circle cx="15" cy="10" r="1.4"/><path d="M10.5 17v2M13.5 17v2"/>',
    crown: '<path d="M3 18.5h18"/><path d="M4 18.5 3 7l5 4 4-7 4 7 5-4-1 11.5z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-4.6-3-6.5-.4 1.4-1 2-2 2.5C14 8 13 5 9.5 2c.3 3.5-1 5.3-2.6 7.2C5.3 11 5 12.6 5 15.5 5 19.3 8 22 12 22z"/>',
    snowflake: '<path d="M12 2v20"/><path d="M4.5 7l15 10"/><path d="M19.5 7l-15 10"/><path d="M12 5 9.5 3M12 5l2.5-2M12 19l-2.5 2M12 19l2.5 2"/>',
    zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    leaf: '<path d="M4 20C4 12 10 4 20 4c0 10-6 16-14 16z"/><path d="M4 20C8 14 12 10 17 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    tornado: '<path d="M3 5h13M6 9h12M9 13h9M11 17h5M13 21h2"/>',
    meteor: '<circle cx="8.5" cy="15.5" r="4.5"/><path d="M12 12 21 3"/><path d="M15 15l6-6"/><path d="M10.5 8.5 14 5"/>',
    rage: '<circle cx="12" cy="12" r="9"/><path d="M8 9l4 1.5L16 9"/><path d="M9 15.5h6"/>',
    sprout: '<path d="M12 21v-8"/><path d="M12 13c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6z"/><path d="M12 11c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5z"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    castle: '<path d="M3 21V8l2-2 2 2 2-4 2 4 2-4 2 4 2-2 2 2v13z"/><path d="M9 21v-3.5a3 3 0 0 1 6 0V21"/><path d="M3 12h18"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7"/><path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4c0 3 1.5 4.5 3 4.5"/><path d="M17 6h3c0 3-1.5 4.5-3 4.5"/><path d="M12 14v3"/><path d="M8 21h8"/><path d="M10 17h4l1 4H9z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
    x: '<path d="M5 5l14 14"/><path d="M19 5 5 19"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 9.5v4.5"/><path d="M12 17v.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3.5A8 8 0 1 1 21 12z"/><path d="M8 10h8"/><path d="M8 13.5h5"/>',
    radar: '<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><circle cx="12" cy="12" r="4"/><path d="M12 12l4.5-4.5"/>',
    bomb: '<circle cx="10" cy="14" r="7"/><path d="M14.8 9.2 18 6"/><path d="M16.5 3.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z"/>',
    potion: '<path d="M10 3h4"/><path d="M11 3v5l-4.5 8A4 4 0 0 0 10 21h4a4 4 0 0 0 3.5-5L13 8V3"/><path d="M8 15h8"/>',
    roll: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5.5h-5.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
    sparkles: '<path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/><path d="M5 3l.6 1.7 1.8.6-1.8.6L5 7.6l-.6-1.7-1.8-.6 1.8-.6z"/>',
    helmet: '<path d="M4 14a8 8 0 0 1 16 0v4H4z"/><path d="M4 15.5h16"/><path d="M12 6V3.5"/><path d="M9 10.5h.5M14.5 10.5h.5"/>',
    banner: '<path d="M6 3h12v18l-6-4-6 4z"/><path d="M9.5 8h5"/><path d="M9.5 12h5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>',
    arrowr: '<path d="M4 12h16"/><path d="M13 5l7 7-7 7"/>',
    chevrons: '<path d="M6 5l7 7-7 7"/><path d="M13 5l7 7-7 7"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 4v16"/><path d="M16 4v16"/>',
    home: '<path d="M4 11 12 4l8 7v9h-5v-6h-6v6H4z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3"/><path d="M12 18.5v3"/><path d="M2.5 12h3"/><path d="M18.5 12h3"/><path d="M5.3 5.3l2.1 2.1"/><path d="M16.6 16.6l2.1 2.1"/><path d="M18.7 5.3l-2.1 2.1"/><path d="M7.4 16.6l-2.1 2.1"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    crystal: '<path d="M12 2 5 9l7 13 7-13z"/><path d="M5 9h14"/><path d="M12 2 9 9l3 13"/><path d="M12 2l3 7-3 13"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 12h10L21 8H6"/>',
    boot: '<path d="M6 3v9l-2.5 4v3h13a4 4 0 0 0-2-3.5L12 13V3z"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8 20 3"/><path d="M16 7l3 3M13.5 9.5l2 2"/>',
    arrowup: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
    eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>'
  };

  function n(name, size = 16, cls = '') {
    const body = D[name] || D.spark;
    return `<svg class="ico${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  return { n, has: (k) => !!D[k] };
})();
