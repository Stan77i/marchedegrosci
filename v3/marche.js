/* ═════════ Marché de Gros — données de marché RÉELLES uniquement ═════════
   Aucune offre, aucun producteur, aucune demande inventés (docs/PHILOSOPHIE.md § 38).
   Données de référence conservées : familles, produits, noms locaux, régions (v2/data.js).
   Données de marché : uniquement ce qui a été publié depuis cet appareil (en attendant un serveur).
   Prix : « prix vendeur » (déclaré, rattaché à une offre) ≠ « prix observé » (≥ 5 observations, ≥ 3 vendeurs, 30 jours). */
(function () {
  'use strict';
  const M = window.MDG = window.MDG || {};
  // centre approximatif de chaque district (chef-lieu) : géographie de référence, pas une donnée de marché
  const REG = { abidjan: [5.36, -4.01, 'Abidjan'], yamoussoukro: [6.82, -5.28, 'Yamoussoukro'], 'bas-sassandra': [4.75, -6.64, 'San-Pédro'], comoe: [6.73, -3.49, 'Abengourou'],
    denguele: [9.51, -7.56, 'Odienné'], 'goh-djiboua': [6.13, -5.95, 'Gagnoa'], lacs: [6.65, -4.71, 'Dimbokro'], lagunes: [5.32, -4.38, 'Dabou'], montagnes: [7.41, -7.55, 'Man'],
    'sassandra-marahoue': [6.88, -6.45, 'Daloa'], savanes: [9.46, -5.63, 'Korhogo'], 'vallee-du-bandama': [7.69, -5.03, 'Bouaké'], woroba: [7.96, -6.67, 'Séguéla'], zanzan: [8.04, -2.8, 'Bondoukou'] };
  const read = k => { try { return JSON.parse(localStorage.getItem('mdg-v2:' + k) || '[]'); } catch (_) { return []; } };
  const jitter = (s, a) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 1000) / 1000 - .5) * a; };

  function load() {
    const offres = read('offres').filter(o => o && o.productSlug && REG[o.regionSlug]);
    const producers = [], offers = [];
    offres.forEach(o => {
      const c = REG[o.regionSlug], id = 'pub-' + o.id, who = (o.producer && o.producer.name) || o.producerName || 'Vendeur';
      producers.push({ id, name: who, regionSlug: o.regionSlug, city: o.city || c[2], latitude: c[0] + jitter(o.id, .3), longitude: c[1] + jitter(o.id + 'x', .3),
        phone: (o.producer && o.producer.phone) || '', published: true, approxCoords: true });
      offers.push({ id: o.id, producerId: id, productSlug: o.productSlug, price: o.price ?? null, currency: 'XOF', unit: o.unit || 'kg', quantity: +o.quantity || 0, city: o.city || c[2], regionSlug: o.regionSlug,
        availableFrom: o.availableFrom || 'maintenant', createdAt: o.createdAt || null, phone: (o.producer && o.producer.phone) || '', seller: who, published: true });
    });
    M.producers = producers; M.offers = offers; M.demands = [];
    return M;
  }
  load();

  /* ——— Prix intelligent ——— */
  const SEUIL = { obs: 5, vendeurs: 3, jours: 30 };
  function prix(slug, offers) {
    const now = Date.now(), list = (offers || M.offers).filter(o => o.productSlug === slug && o.price != null);
    if (!list.length) return { type: 'aucun' };
    const recent = list.filter(o => !o.createdAt || now - new Date(o.createdAt).getTime() <= SEUIL.jours * 864e5);
    const units = {}; recent.forEach(o => (units[o.unit] ||= []).push(o));
    const [unit, grp] = Object.entries(units).sort((a, b) => b[1].length - a[1].length)[0] || [];
    const vendeurs = grp ? new Set(grp.map(o => o.phone || o.seller)).size : 0;
    if (grp && grp.length >= SEUIL.obs && vendeurs >= SEUIL.vendeurs) {
      const v = grp.map(o => o.price).sort((a, b) => a - b), q = p => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
      return { type: 'observe', min: q(.1), max: q(.9), unit, n: grp.length, vendeurs, jours: SEUIL.jours };
    }
    const best = list.slice().sort((a, b) => a.price - b.price)[0];
    return { type: 'vendeur', offre: best, n: list.length };
  }
  const SVG = (d, extra) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + (extra || '') + '>' + d + '</svg>';
  const ICO = {
    // « J'ai / Je cherche » : un point plein (l'offre) et un cercle (la demande) reliés — le vocabulaire de la carte
    // langage commun des marqueurs (v3/marqueurs.js) : cercle vert = offre, carré jaune = demande, triangle violet = recherche, ligne bleue = compatibles
    get match() { return window.MDGMarq ? window.MDGMarq.match : ''; },
    get offre() { return window.MDGMarq ? window.MDGMarq.svg('offre') : ''; },
    get demande() { return window.MDGMarq ? window.MDGMarq.svg('demande') : ''; },
    get recherche() { return window.MDGMarq ? window.MDGMarq.svg('recherche') : ''; },
    get connexion() { return window.MDGMarq ? window.MDGMarq.svg('connexion') : ''; },
    // prix vendeur : une étiquette ; prix observé : une fourchette de points
    vendeur: SVG('<path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0L3.5 12.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/>'),
    observe: SVG('<path d="M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 14V9M12 14V5M17 14v-3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
    vide: SVG('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.5 3"/>')
  };
  const fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  // repère commun : héros, fiches, Acheter, Prix du marché
  function prixHTML(slug, o) {
    o = o || {}; const P = prix(slug, o.offers);
    if (P.type === 'observe') return '<div class="px px--obs"><i class="px-i">' + ICO.observe + '</i><div><span class="px-k">Prix observé du marché</span><b>' + fmt(P.min) + ' – ' + fmt(P.max) + ' F<small> / ' + esc(P.unit) + '</small></b><small>' + P.n + ' observations · ' + P.vendeurs + ' vendeurs · ' + P.jours + ' derniers jours</small></div></div>';
    if (P.type === 'vendeur') { const f = P.offre; return '<div class="px px--decl"><i class="px-i">' + ICO.vendeur + '</i><div><span class="px-k">Prix vendeur</span><b>' + fmt(f.price) + ' F<small> / ' + esc(f.unit) + '</small></b><small>' + esc(f.seller) + ' · ' + esc(f.city) + (f.createdAt ? ' · ' + date(f.createdAt) : '') + (P.n > 1 ? ' · ' + (P.n - 1) + ' autre' + (P.n > 2 ? 's' : '') + ' prix vendeur' : '') + '</small><small class="px-n">Pas assez de données pour calculer un prix du marché</small></div></div>'; }
    return '<div class="px px--none"><i class="px-i">' + ICO.vide + '</i><div><span class="px-k">Prix du marché</span><b class="px-t">' + (o.short ? 'Données en cours de constitution' : 'Pas assez de données pour calculer un prix du marché') + '</b></div></div>';
  }
  // validation téléphone ivoirien : 10 chiffres (01, 05, 07, 21, 25, 27…), +225 facultatif
  const tel = v => { const d = String(v || '').replace(/[\s.\-()]/g, '').replace(/^(\+|00)225/, ''); return /^\d{10}$/.test(d) ? d : null; };
  const telFmt = d => d ? '+225 ' + d.replace(/(\d{2})(?=\d)/g, '$1 ') : '';

  window.MDGMarche = { load, prix, prixHTML, ICO, REG, SEUIL, tel, telFmt };
})();
