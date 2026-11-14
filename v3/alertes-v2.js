/* ═════════ Marché de Gros CI — écran Alertes (la cloche), maquette « MGCI App v2 » ═════════
   Remplace, dans l'onglet « alertes » de l'accueil, l'ancienne liste : retour « Marché », titre, carte Notifications
   (Activer / Désactiver sur ce téléphone, v3/pousse.js : pas de réglage par catégorie, schéma 91), liste des notifications
   réelles (journal mdg-notifs de v3/negoce.js, annonces qui expirent avec « Prolonger », stock épuisé, mes codes),
   puis « Produits suivis » (v3/alertes.js). Chaque ligne ouvre un écran précis. Rien d'inventé : sans donnée, rien.
   Branché par la liste MDGPlus d'application.dc.html ; navigation par window.MDGV2 (fiche, recherche, marche, annonces). */
(function () {
  'use strict';
  if (window.MDGAlertesV2) return;
  const N = () => window.MDGNuage;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const V2 = () => window.MDGV2 || {};
  const A = () => window.MDGApp || {};
  const fmt = n => A().fmt ? A().fmt(n) : String(n);
  const ago = t => A().ago ? A().ago(t) : '';
  const nomP = s => { const P = V2().prod ? V2().prod(s) : null; return P ? P.name : s; };
  const RETOUR = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>';
  const IC = {
    nego: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3D2E05" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"></path><path d="M8.5 10.5h7"></path></svg>',
    prod: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10392B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5h17l-2 9h-13z"></path><path d="M8 10.5L11 4.5M16 10.5L13 4.5"></path></svg>',
    exp: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3D2E05" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path></svg>',
    vide: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6E2414" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5h17l-2 9h-13z"></path><path d="M8 10.5L11 4.5M16 10.5L13 4.5"></path></svg>',
    cle: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10392B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"></circle><path d="M11 12l8-8M16 7l2 2M14 9l2 2"></path></svg>',
    croix: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
  };
  const lienCss = () => { if (document.querySelector('link[data-pp2]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/v2-profil.css?v=20261114g2'; l.dataset.pp2 = '1'; document.head.appendChild(l); };

  // ——— notifications du téléphone : un seul choix, Activer / Désactiver (règle du 24/10/2026) ———
  const PS = { actif: 'Activées · les nouvelles du marché jamais entre 21 h et 7 h', inactif: 'Désactivées sur ce téléphone', refuse: 'Bloquées : autorisez-les dans les réglages du téléphone', installer: 'Sur iPhone : ajoutez d’abord l’application à l’écran d’accueil', impossible: 'Indisponibles dans ce navigateur' };
  let pEtat = null, pOcc = false;
  const lireEtat = () => { const P = window.MDGPousse; if (!P) { pEtat = 'impossible'; return Promise.resolve(); }
    return Promise.race([P.etat(), new Promise(r => setTimeout(() => r(pEtat || 'inactif'), 4000))]).catch(() => 'impossible').then(e => { if (e !== pEtat) { pEtat = e; peindre(); } }); };
  async function basculer() {
    const P = window.MDGPousse, n = N(); if (!P || pOcc || !(pEtat === 'actif' || pEtat === 'inactif')) return;
    if (!n || !n.session()) { n && n.open('Connectez-vous pour recevoir les notifications.'); return; }
    pOcc = true;
    try {
      if (pEtat === 'actif') { await P.desactiver(); n.toast('Notifications désactivées sur ce téléphone.'); }
      else { const r = await P.activer(); n.toast(r && r.envoyees > 0 ? 'Notifications activées. Un essai vient d’être envoyé.' : 'Notifications activées sur ce téléphone.'); }
    } catch (x) { const c = x && x.message; n.toast(c === 'REFUS' ? 'Autorisez les notifications dans les réglages du téléphone, puis réessayez.' : c === 'INSTALLER' ? 'Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.' : c === 'SANS_REPONSE' ? 'Pas de réponse à la demande. Réessayez et touchez « Autoriser ».' : 'Le réglage n’a pas abouti. Réessayez.'); }
    pOcc = false; pEtat = null; await lireEtat(); peindre();
  }

  // ——— les lignes : seulement des données réelles ———
  const CAT = { proposition: 'Proposition de prix', accord: 'Accord conclu', refus: 'Négociation' };
  const prol = {};   // id → nouvelle date de fin, après « Prolonger »
  function lignes(moiS) {
    const L = [];
    if (!moiS) return L;
    // mes codes (schéma 28) : à donner ou à taper, les plus urgents d'abord
    const C = window.MDGCommandes && MDGCommandes.codes ? MDGCommandes.codes() : [], T = window.MDGChauffeur && MDGChauffeur.codes ? MDGChauffeur.codes() : [];
    [...C.map(c => ({ c, moi: true })), ...T.map(c => ({ c, moi: false }))].sort((a, b) => (b.c.urgent ? 1 : 0) - (a.c.urgent ? 1 : 0)).forEach(({ c, moi }) => L.push({
      k: 'code:' + (c.titre || '') + (c.genre || ''), ic: 'cle', tint: 'v', neuf: !!c.urgent, t: c.titre, s: [c.genre, c.quand].filter(Boolean).join(' · '),
      code: c.code ? c.code : '', voir: c.code ? '' : moi ? 'Afficher' : 'Taper', open: () => c.ouvrir() }));
    // stock épuisé : l'offre n'est plus proposée
    J('mdg-v2:offres', []).filter(x => x && x.productSlug && x.epuise).slice(0, 4).forEach(x => L.push({ k: 'ep:' + x.id, ic: 'vide', tint: 'r', neuf: false, t: 'Stock épuisé', s: nomP(x.productSlug) + ' : l’offre n’est plus proposée', open: () => V2().annonces && V2().annonces() }));
    // journal des notifications (v3/negoce.js) : propositions, accords, refus ; chacune ouvre sa discussion
    const NL = J('mdg-notifs', []);
    const ng = window.MDGNegoce && MDGNegoce.unread ? MDGNegoce.unread() : 0;
    if (ng && !NL.some(n => n && !n.lu && n.nego)) L.push({ k: 'ng', ic: 'nego', tint: 'j', neuf: true, t: 'Propositions de prix', s: ng + (ng > 1 ? ' réponses' : ' réponse') + ' en attente', open: () => MDGNegoce.inbox() });
    NL.slice(0, 40).forEach(n => { if (!n || !n.texte) return; const cle = n.t + '|' + n.texte;
      L.push({ k: 'n:' + cle, ic: 'nego', tint: 'j', neuf: !n.lu, t: String(n.texte).replace(/\.$/, ''), s: (CAT[n.cat] || 'Négociation') + (n.t ? ' · ' + ago(n.t) : ''),
        open: () => { const all = J('mdg-notifs', []), m = all.find(x => x && x.t + '|' + x.texte === cle); if (m) { m.lu = true; W('mdg-notifs', all); dispatchEvent(new CustomEvent('mdg:notifs')); }
          if (n.nego && window.MDGNegoce) MDGNegoce.thread(n.nego); else peindre(); } }); });
    // mes annonces qui expirent dans 3 jours au plus, ou expirées (schéma 93) : « Prolonger 30 jours »
    ['offres', 'demandes'].forEach(k => J('mdg-v2:' + k, []).forEach(x => {
      if (!x || !x.id || !x.productSlug || x.epuise || x.servie) return;
      const fin = Date.parse(x.finLe || ''), j = Math.ceil((fin - Date.now()) / 864e5), fait = prol[k + ':' + x.id];
      if (!fait && !x.expiree && !(fin && j <= 3)) return;
      const nm = nomP(x.productSlug).toLowerCase(), de = (/^[aeéèêiîoôuyh]/i.test(nm) ? 'd’' : 'de ') + nm, quoi = 'Votre ' + (k === 'offres' ? 'offre ' : 'demande ') + de;
      L.push({ k: 'exp:' + k + ':' + x.id, ic: 'exp', tint: 'j', neuf: !fait, t: fait ? quoi + ' est prolongée' : quoi + (x.expiree ? ' a expiré' : j <= 0 ? ' expire aujourd’hui' : ' expire dans ' + j + ' jour' + (j > 1 ? 's' : '')),
        s: fait ? '' : x.expiree ? 'Prolongez-la pour la remettre en ligne' : 'Prolongez-la pour rester visible',
        prolTxt: fait ? 'Prolongée jusqu’au ' + new Date(fait).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '', prolonger: fait ? null : k + ':' + x.id, open: () => V2().annonces && V2().annonces() });
    }));
    return L;
  }

  // ——— rendu ———
  let hote = null, boite = null, actions = {}, dernier = '';
  function trouverHote() {
    const pg = document.querySelector('[data-pg="home"]'); if (!pg) return null;
    const h = [...pg.querySelectorAll('.v2-ttl h1')].find(x => x.textContent.trim() === 'Alertes');
    return h ? h.closest('.v2-ttl').parentElement : null;
  }
  const visible = () => hote && hote.isConnected && hote.style.display !== 'none' && hote.offsetParent !== null;
  function peindre() {
    if (!hote || !hote.isConnected) { hote = trouverHote(); if (!hote) return; }
    if (!boite || !boite.isConnected || boite.parentElement !== hote) { lienCss(); hote.classList.add('al2-hote'); boite = document.createElement('div'); boite.className = 'al2'; hote.appendChild(boite); boite.addEventListener('click', clic); dernier = ''; }
    if (!visible()) return;
    if (pEtat == null) lireEtat();
    const n = N(), moiS = !!(n && n.session()), L = lignes(moiS), AL = window.MDGAlertes, suivis = moiS && AL ? AL.liste() : [];
    actions = {};
    const st = pEtat, on = st === 'actif', dis = !(st === 'actif' || st === 'inactif');
    const rangs = L.map((r, i) => { actions['o' + i] = r.open; if (r.prolonger) actions['p' + i] = r.prolonger;
      return `<div class="al2-r${r.neuf ? ' neuf' : ''}"><button type="button" class="al2-o" data-a="o${i}"><span class="al2-ic ${r.tint}">${IC[r.ic]}</span><span class="al2-tx"><b>${esc(r.t)}</b><small>${esc(r.s)}</small><em>${esc(r.prolTxt || '')}</em></span>${r.code ? `<span class="al2-code">${esc(r.code)}</span>` : ''}</button>${r.prolonger ? `<button type="button" class="al2-prol" data-a="p${i}">Prolonger</button>` : ''}</div>`; }).join('');
    const h = `<div class="al2-ret"><button type="button" data-a="ret" aria-label="Retour au marché">${RETOUR}</button><span>Marché</span></div>
      <h1>Alertes</h1>
      <div class="al2-carte"><span><b>Notifications</b><small>${esc(st ? PS[st] : 'Un instant…')}</small></span><button type="button" class="al2-sw" role="switch" aria-label="Notifications sur ce téléphone" aria-checked="${on}" aria-disabled="${dis}" data-a="sw"><i></i></button></div>
      ${!moiS ? `<div class="al2-vide"><b>Connectez-vous</b><span>Pour voir vos propositions, vos codes et vos produits suivis.</span></div>`
        : !L.length ? '<div class="al2-vide"><b>Aucune alerte</b><span>Suivez un produit pour être prévenu dès qu’une offre arrive.</span></div>' : ''}
      <div class="al2-liste">${rangs}</div>
      ${moiS ? `<div class="al2-suivis"><h2>Produits suivis</h2><div class="al2-ch">${suivis.map((a, i) => { actions['s' + i] = a.product_slug; return `<button type="button" data-a="s${i}" aria-label="Ne plus suivre ${esc(nomP(a.product_slug))}">${esc(nomP(a.product_slug))}${IC.croix}</button>`; }).join('')}<button type="button" class="plus" data-a="suivre">Suivre un produit</button></div></div>` : ''}`;
    if (h === dernier) return;   // rien n'a changé : on ne redessine pas (stabilité)
    dernier = h; boite.innerHTML = h;
  }
  async function clic(e) {
    const b = e.target.closest('[data-a]'); if (!b || !boite.contains(b)) return;
    const a = b.dataset.a, n = N();
    if (a === 'ret') return V2().marche && V2().marche();
    if (a === 'sw') return basculer();
    if (a === 'suivre') return V2().recherche && V2().recherche();
    if (!n || !n.session()) return n && n.open();
    if (a[0] === 'o') { const f = actions[a]; return f && f(); }
    if (a[0] === 'p') { const [k, id] = String(actions[a] || '').split(':'); if (!k) return; b.disabled = true;
      try { const fin = await n.prolonger(k, id); prol[k + ':' + id] = Date.parse(fin) || Date.now() + 30 * 864e5; n.toast('Annonce prolongée de 30 jours.'); }
      catch (_) { b.disabled = false; n.toast('La prolongation n’a pas abouti. Réessayez.'); }
      return peindre(); }
    if (a[0] === 's') { const slug = actions[a], AL = window.MDGAlertes; if (!slug || !AL || !AL.retirer) return; b.disabled = true;
      try { await AL.retirer(slug); n.toast('Vous ne suivez plus ' + nomP(slug) + '.'); } catch (_) { b.disabled = false; n.toast('Le changement n’a pas abouti. Réessayez.'); }
      return peindre(); }
  }

  // l'onglet « alertes » s'ouvre et se ferme par son style (display) : on peint quand il devient visible
  let tP = 0; const plus_tard = () => { clearTimeout(tP); tP = setTimeout(peindre, 40); };
  function guetter() {
    const pg = document.querySelector('[data-pg="home"]'); if (!pg) return setTimeout(guetter, 400);
    new MutationObserver(() => { if (!hote || !hote.isConnected || (visible() && (!boite || !boite.isConnected))) plus_tard(); else if (visible() && !dernier) plus_tard(); })
      .observe(pg, { attributes: true, attributeFilter: ['style'], subtree: true, childList: true });
    let vu = false; setInterval(() => { const v = visible(); if (v && !vu) { pEtat = null; dernier = ''; peindre(); } vu = v; }, 500);
    peindre();
  }
  ['mdg:notifs', 'mdg:alertes', 'mdg:change', 'mdg:negoce', 'mdg:activite', 'mdg:connecte', 'storage'].forEach(ev => addEventListener(ev, () => { if (visible()) plus_tard(); }));
  addEventListener('visibilitychange', () => { if (!document.hidden && visible()) { pEtat = null; lireEtat(); } });
  if (window.MDGAlertes && MDGAlertes.refresh) setTimeout(() => MDGAlertes.refresh(), 1500);
  guetter();
  window.MDGAlertesV2 = { peindre };
})();
