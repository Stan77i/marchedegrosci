/* ═════════ Marché de Gros CI — tableau de bord de l'administrateur (admin.html) ═════════
   Réservé aux comptes listés dans la table public.admins : la base refuse tout le reste (sécurité ligne par ligne).
   Rien n'est inventé : chaque chiffre est compté sur les annonces, comptes, signalements et négociations réels. */
(function () {
  'use strict';
  const N = window.MDGNuage, root = document.getElementById('root');
  const esc = N.esc, fmtTel = N.fmtTel;
  const fmt = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const REG = Object.fromEntries((window.MDG && MDG.regions || []).map(r => [r.slug, r.name]));
  const PROD = Object.fromEntries((window.MDG && MDG.products || []).map(p => [p.slug, p.name]));
  const date = t => t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '—';
  const ago = t => { if (!t) return 'jamais'; const m = (Date.now() - Date.parse(t)) / 60000; return m < 60 ? 'il y a ' + Math.max(1, Math.round(m)) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : m < 2880 ? 'hier' : date(t); };
  const D = { offres: [], demandes: [], signalements: [], comptes: [], negos: [], alertes: [], discussions: [], ident: [], sigm: [], sigc: null, err: {} };
  let view = (location.hash.slice(1) || 'apercu'), filt = { type: 'tout', statut: 'tout', q: '' }, showN = 40;

  const ICO = {
    apercu: '<path d="M4 19V9m5 10V5m5 14v-7m5 7v-4" stroke-linecap="round"/>',
    traiter: '<path d="M12 4 21 19H3Z" stroke-linejoin="round"/><path d="M12 10v4m0 2.5v.5" stroke-linecap="round"/>',
    annonces: '<circle cx="7" cy="8" r="3"/><rect x="14" y="5" width="6" height="6" rx="1"/><path d="M4 15h16M4 19h10" stroke-linecap="round"/>',
    comptes: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round"/>',
    negos: '<path d="M4 7h11M4 7l3-3M4 7l3 3M20 17H9m11 0-3-3m3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>',
    messages: '<path d="M4 5.5h16v10H9l-5 4z" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke-linecap="round"/>',
    identites: '<path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
    site: '<path d=""M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/><circle cx="12" cy="12" r="8"/>'
  };
  const LUC = { apercu: 'apercu', traiter: 'traiter', annonces: 'activite', comptes: 'comptes', negos: 'negoce', messages: 'messages', identites: 'verifie', site: 'site' };   // app/icones.js
  // vues ajoutées par d'autres fichiers (v3/admin-transport.js : transporteurs et commandes), sans alourdir celui-ci
  const EXT = window.MDGAdminExt || {};
  const ico = k => { const lk = LUC[k] || (EXT[k] && EXT[k].ico), L = window.MDGIco && lk && window.MDGIco.corps(lk);
    return L ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${L}</svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${ICO[k]}</svg>`; };
  // badge du compte officiel (même sceau partout dans le tableau de bord)
  const BADGE = '<span class="badge-off"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>Administrateur · Officiel</span>';
  const RELIRE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>';
  let toastT = 0;
  const H = { esc, fmt, ago, date, REG, PROD, toast: m => toast(m), rpc: (f, a) => N.rpc(f, a), relire: async () => { await load(); paint(); }, repeindre: () => paint(), top: (t, p, x) => top(t, p, x) };
  function toast(m) { let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = m; el.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { el.style.opacity = '0'; }, 4000); }

  /* ——— porte d'entrée ——— */
  const logo = window.MDGMarque ? MDGMarque.empile({ fond: 'vert', h: 64 }).replace('style="', 'style="margin:0 auto 6px;') : '';
  function gate(t, p, btn) {
    root.innerHTML = `<div class="gate"><div class="card">${logo}<h1>${t}</h1><p>${p}</p>${btn || ''}<p style="margin-top:22px"><a href="application.dc.html" style="color:var(--mute)">Retour à l’application</a></p></div></div>`;
    const b = root.querySelector('[data-login]'); if (b) b.onclick = () => N.open();
  }
  async function start() {
    if (!N.session()) return gate('Tableau de bord', 'Connectez-vous avec le compte administrateur : votre numéro et votre code secret.', '<button class="btn pri" data-login>Se connecter</button>');
    if (!navigator.onLine) return gate('Pas de connexion', 'Le tableau de bord lit les données en direct. Réessayez quand le réseau revient.', '<button class="btn" onclick="location.reload()">Réessayer</button>');
    const a = await N.isAdmin();
    if (!a) return gate('Accès réservé', 'Ce compte (' + esc(fmtTel(N.session().user.tel)) + ') n’est pas administrateur. Pour le devenir, le propriétaire du projet l’ajoute dans Supabase (fichier supabase/a-lancer-dans-sql-editor.sql).', '<button class="btn" data-login>Changer de compte</button>');
    await load(); paint();
  }
  async function load() {
    const get = (k, path, opt) => N.api(path, Object.assign({ auth: true }, opt)).then(r => { D[k] = r || []; delete D.err[k]; }).catch(e => { D.err[k] = e.message; });
    await Promise.all([
      get('offres', '/rest/v1/offres?select=*&order=created_at.desc&limit=2000'),
      get('demandes', '/rest/v1/demandes?select=*&order=created_at.desc&limit=2000'),
      get('signalements', '/rest/v1/signalements?select=*&order=created_at.desc&limit=2000'),
      get('negos', '/rest/v1/negociations?select=*&order=updated_at.desc&limit=1000'),
      N.rpc('admin_comptes').then(r => { D.comptes = r || []; delete D.err.comptes; }).catch(e => { D.err.comptes = e.message; }),
      get('alertes', '/rest/v1/alertes?select=*&order=created_at.desc&limit=500'),
      N.rpc('admin_discussions').then(r => { D.discussions = r || []; delete D.err.discussions; }).catch(e => { D.err.discussions = e.message; }),
      // signalements regroupés par compte, avec preuves et priorité (schéma 18) ; sinon l'ancienne liste
      N.rpc('admin_signalements_comptes').then(r => { D.sigc = r || []; }).catch(() => { D.sigc = null; }),
      N.rpc('admin_signalements_membres').then(r => { D.sigm = r || []; delete D.err.sigm; }).catch(e => { D.sigm = []; if (!/admin_signalements_membres|schema cache|Could not find/i.test(e.message)) D.err.sigm = e.message; }),
      // admin_identite_dossiers (schéma 16 : dates d'expiration, numéro) ; sinon l'ancienne liste
      N.rpc('admin_identite_dossiers').catch(e => { if (/admin_identite_dossiers|schema cache|Could not find/i.test(e.message)) return N.rpc('admin_identite_file'); throw e; })
        .then(r => { D.ident = r || []; delete D.err.identites; }).catch(e => { D.ident = []; if (!/admin_identite_file|schema cache|Could not find/i.test(e.message)) D.err.identites = e.message; else D.identAbsent = true; }),
      ...Object.entries(EXT).map(([k, x]) => x.charger ? x.charger(H).then(() => { delete D.err[k]; }).catch(e => { D.err[k] = e.message; }) : null)
    ]);
    // permis sans date de fin (schéma 21) : le badge vaut 5 ans, l'administrateur vérifie sur la photo qu'aucune date n'est écrite
    try { const sf = new Set(((await N.rpc('admin_identite_sans_fin')) || []).map(x => typeof x === 'string' ? x : x.admin_identite_sans_fin)); D.ident.forEach(v => { v.sans_fin = sf.has(v.id); }); } catch (_) {}
    D.byUser = Object.fromEntries(D.comptes.map(c => [c.id, c]));
    // le compteur du menu de l'application (application.dc.html, v3/compte.js) suit ce qui reste à examiner
    if (!D.err.identites && !D.identAbsent) try { localStorage.setItem('mdg-admin:identites', JSON.stringify({ n: D.ident.filter(v => v.statut === 'en_attente').length, t: Date.now() })); } catch (_) {}
    purger();
  }
  // brouillons abandonnés (30 jours) et dossiers dont les 5 ans de conservation sont passés : effacés à chaque ouverture (schémas 15 et 16).
  // Le serveur seul décide ce qui peut l'être : un dossier encore conservé ne peut pas être effacé, même par l'administrateur.
  let purgeFaite = false;
  async function purger() {
    if (purgeFaite) return; purgeFaite = true;
    let L; try { L = await N.rpc('admin_identite_a_purger'); } catch (_) { return; }
    let n = 0;
    for (const v of L || []) {
      try { await N.effacerPrive('identite', ['recto', 'verso', 'selfie'].map(x => v.dossier + '/' + x + '.jpg')); await N.rpc('admin_identite_purger', { p_id: v.id }); n++; } catch (_) {}
    }
    if (n) toast(n > 1 ? n + ' dossiers d’identité arrivés au bout de leur conservation ont été effacés.' : 'Un dossier d’identité arrivé au bout de sa conservation a été effacé.');
  }

  /* ——— modèle ——— */
  const annonces = () => D.offres.map(r => Object.assign({ k: 'offres', kind: 'offre' }, r)).concat(D.demandes.map(r => Object.assign({ k: 'demandes', kind: 'demande' }, r))).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const nom = r => r.product_label || PROD[r.product_slug] || r.product_slug || 'Produit';
  const lieu = r => (r.city || '') + (r.region_slug && REG[r.region_slug] && REG[r.region_slug] !== r.city ? (r.city ? ', ' : '') + REG[r.region_slug] : '');
  const prix = r => r.kind === 'offre' ? (r.price ? fmt(r.price) + ' F / ' + (r.unit || 'unité') : 'prix à discuter') : (r.budget ? 'budget ' + fmt(r.budget) + ' F / ' + (r.unit || 'unité') : 'budget à discuter');
  const qui = r => r.kind === 'offre' ? (r.seller_name || 'Vendeur') : (r.buyer_name || 'Acheteur');
  const tel = uid => { const c = D.byUser && D.byUser[uid]; return c ? fmtTel(String(c.tel).replace(/^225/, '')) : ''; };
  function signalesParCible() {
    const m = {}; D.signalements.forEach(s => { const k = s.cible + ':' + s.cible_id; (m[k] = m[k] || { cible: s.cible, id: s.cible_id, n: 0, comptes: new Set(), motifs: [], last: s.created_at }); m[k].n++; if (s.user_id) m[k].comptes.add(s.user_id); if (s.motif) m[k].motifs.push(s.motif); });
    return Object.values(m).sort((a, b) => b.n - a.n);
  }
  const aTraiter = () => { const A = annonces(), by = Object.fromEntries(A.map(a => [a.kind + ':' + a.id, a])); return signalesParCible().map(s => Object.assign(s, { a: by[s.cible + ':' + s.id] })).filter(s => s.a); };

  /* ——— dessin ——— */
  function paint() {
    const T = aTraiter(), masq = annonces().filter(a => a.status === 'masquee').length, toDo = T.filter(s => s.a.status === 'active').length + masq;
    const conclu = D.negos.filter(n => n.statut === 'conclue').length;
    const nav = (k, t, n) => `<a class="nav" href="#${k}" ${view === k ? 'aria-current="page"' : ''}>${ico(k)}<span>${t}</span>${n ? `<em>${n}</em>` : ''}</a>`;
    root.innerHTML = `<div class="app"><nav class="rail" aria-label="Tableau de bord">
      <a class="brand" href="#apercu" aria-label="Marché de Gros, tableau de bord administrateur">${window.MDGMarque ? MDGMarque.ligne({ fond: 'vert', h: 22 }) : '<b>Marché de Gros</b>'}${BADGE}</a>
      <div class="navs"><a class="nav retour" href="application.dc.html" aria-label="Retour à l’application"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Application</span></a>${nav('apercu', 'Aperçu')}${nav('traiter', 'À traiter', toDo)}${nav('annonces', 'Annonces')}${nav('comptes', 'Comptes')}${nav('negos', 'Négociations')}${nav('messages', 'Messages', D.alertes.filter(a => !a.vu).length + D.sigm.filter(x => !x.traite).length)}${nav('identites', 'Identités', D.ident.filter(v => v.statut === 'en_attente').length)}${Object.entries(EXT).map(([k, x]) => nav(k, x.titre, x.n ? x.n() : 0)).join('')}</div>
      <span class="sp"></span><a class="nav ext" href="application.dc.html">${ico('site')}<span>Voir l’application</span></a>
      <div class="who">Compte officiel, affiché « Marché de Gros » aux membres<b>${esc(fmtTel(N.session().user.tel))}</b></div></nav>
      <main id="main">${VIEWS[view] ? VIEWS[view]({ T, masq, toDo, conclu }) : EXT[view] ? EXT[view].vue(H) : VIEWS.apercu({ T, masq, toDo, conclu })}</main></div>`;
    bind();
  }
  // une partie des données n'a pas pu être lue : une ligne discrète, le détail se déplie
  const ERR_NOM = { offres: 'offres', demandes: 'demandes', signalements: 'signalements d’annonces', negos: 'négociations', comptes: 'comptes', alertes: 'alertes', discussions: 'conversations', sigm: 'personnes signalées', identites: 'identités' };
  const errBox = () => { const e = Object.entries(D.err); if (!e.length) return '';
    return `<div class="err" role="status"><details><summary>Certaines données n’ont pas pu être lues : ${esc(e.map(([k]) => ERR_NOM[k] || k).join(', '))} <u>détails</u></summary>
      <ul>${e.map(([k, m]) => `<li>${esc((ERR_NOM[k] || k) + ' — ' + m)}</li>`).join('')}${D.err.comptes ? '<li>La liste des comptes demande le fichier supabase/a-lancer-dans-sql-editor.sql.</li>' : ''}</ul></details>
      <button class="btn sm" data-reload>Réessayer</button></div>`; };
  const top = (t, p, extra) => `<div class="top"><div><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}</div><div class="outils">${extra || ''}<button class="btn sm ghost" data-reload title="Relire les données">${RELIRE}Actualiser</button></div></div>${errBox()}`;

  function pouls() {
    const A = annonces(), j0 = new Date(); j0.setHours(0, 0, 0, 0); const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(j0); d.setDate(d.getDate() - i); days.push({ d, o: 0, dm: 0 }); }
    A.forEach(a => { const t = new Date(a.created_at); t.setHours(0, 0, 0, 0); const i = Math.round((t - days[0].d) / 864e5); if (i >= 0 && i < 14) days[i][a.kind === 'offre' ? 'o' : 'dm']++; });
    const max = Math.max(1, ...days.map(x => x.o + x.dm)), unit = max <= 12;
    return `<div class="days" role="img" aria-label="Annonces publiées ces 14 derniers jours : ${days.reduce((s, x) => s + x.o, 0)} offres et ${days.reduce((s, x) => s + x.dm, 0)} demandes">${days.map((x, i) => {
      const n = x.o + x.dm, lab = i === 13 ? 'auj.' : x.d.toLocaleDateString('fr-FR', { day: 'numeric' });
      const body = unit ? '<i class="o"></i>'.repeat(x.o) + '<i class="d"></i>'.repeat(x.dm) : (n ? `<span class="bar" style="height:${(n / max * 100).toFixed(1)}%;--dp:${(x.dm / n * 100).toFixed(1)}%"></span><span class="n">${n}</span>` : '');
      return `<div class="day${i === 13 ? ' today' : ''}" title="${x.d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${x.o} offre(s), ${x.dm} demande(s)">${body}<small>${lab}</small></div>`; }).join('')}</div>
      <div class="leg"><span><i class="o"></i>offre publiée</span><span><i class="d"></i>demande publiée</span>${unit ? '<span>une marque = une annonce</span>' : ''}</div>`;
  }
  function remise() {
    const L = D.negos.filter(n => n.statut === 'conclue' && n.prix_annonce > 0 && n.prix_final > 0);
    if (!L.length) return null; const m = L.reduce((s, n) => s + (n.prix_final - n.prix_annonce) / n.prix_annonce, 0) / L.length * 100;
    return (m <= 0 ? '−' : '+') + Math.abs(m).toFixed(1).replace('.', ',') + ' %';
  }
  const VIEWS = {
    apercu: ({ toDo, conclu }) => {
      const A = annonces(), act = A.filter(a => a.status === 'active'), r = remise(), auj = D.comptes.filter(c => Date.now() - Date.parse(c.created_at) < 7 * 864e5).length;
      const idn = D.ident.filter(v => v.statut === 'en_attente').length;
      const tuile = (h, n, t, alerte) => `<a class="tuile${alerte ? ' alert' : ''}" href="#${h}"><b>${n}</b><span>${t}</span></a>`;
      return top('Aperçu', 'Ce qui se passe sur le Marché de Gros, compté sur les données réelles.') + `
      <div class="tuiles">
        ${tuile('traiter', fmt(toDo), 'annonce' + (toDo > 1 ? 's' : '') + ' à traiter', toDo)}
        ${idn ? tuile('identites', fmt(idn), 'identité' + (idn > 1 ? 's' : '') + ' à examiner', true) : ''}
        ${tuile('annonces', fmt(act.filter(a => a.kind === 'offre').length), 'offres en ligne')}
        ${tuile('annonces', fmt(act.filter(a => a.kind === 'demande').length), 'demandes en ligne')}
        ${tuile('comptes', D.err.comptes ? '—' : fmt(D.comptes.length), 'comptes' + (auj ? ' · ' + auj + ' cette semaine' : ''))}
        ${tuile('negos', fmt(D.negos.filter(n => n.statut === 'ouverte').length), 'négociations en cours')}
        ${tuile('negos', fmt(conclu), 'accords conclus' + (r ? ' · écart moyen ' + r : ''))}
      </div>
      <section class="pouls"><h2>Le pouls du marché</h2><p class="sub">Annonces publiées ces 14 derniers jours.</p>${pouls()}</section>
      <section class="sec"><div class="sec-h"><h2>Dernières annonces</h2><a class="btn sm" href="#annonces">Toutes les annonces</a></div>${listeAnnonces(A.slice(0, 6))}</section>`;
    },
    traiter: ({ T }) => {
      const masq = annonces().filter(a => a.status === 'masquee' && !T.find(s => s.a.id === a.id));
      return top('À traiter', 'Annonces signalées par les utilisateurs, et annonces masquées. Trois signalements de comptes différents masquent une annonce automatiquement.') +
        (T.length + masq.length ? `<div class="list">${T.map(s => rowAnnonce(s.a, s)).join('')}${masq.map(a => rowAnnonce(a)).join('')}</div>` : `<div class="list"><div class="empty"><b>Rien à traiter</b>Aucune annonce signalée ni masquée.</div></div>`);
    },
    annonces: () => {
      let A = annonces(); const q = filt.q.trim().toLowerCase();
      if (filt.type !== 'tout') A = A.filter(a => a.kind === filt.type);
      if (filt.statut !== 'tout') A = A.filter(a => a.status === filt.statut);
      if (filt.user) A = A.filter(a => a.user_id === filt.user);
      if (q) A = A.filter(a => [nom(a), lieu(a), qui(a), a.phone, tel(a.user_id)].join(' ').toLowerCase().includes(q));
      const seg = (k, v, t) => `<button data-f="${k}" data-v="${v}" aria-pressed="${filt[k] === v}">${t}</button>`;
      return top('Annonces', fmt(D.offres.length) + ' offres et ' + fmt(D.demandes.length) + ' demandes au total, masquées comprises.') + `
        <div class="tools"><div class="seg">${seg('type', 'tout', 'Toutes')}${seg('type', 'offre', 'Offres')}${seg('type', 'demande', 'Demandes')}</div>
        <div class="seg">${seg('statut', 'tout', 'Tous états')}${seg('statut', 'active', 'En ligne')}${seg('statut', 'masquee', 'Masquées')}</div>
        <input class="search" type="search" placeholder="Produit, lieu, nom ou numéro" value="${esc(filt.q)}" aria-label="Rechercher une annonce">
        ${filt.user ? `<button class="btn sm" data-clearuser>Compte ${esc(tel(filt.user))} ×</button>` : ''}</div>
        ${listeAnnonces(A)}`;
    },
    comptes: () => top('Comptes', D.err.comptes ? '' : fmt(D.comptes.length) + ' comptes, du plus récent au plus ancien.') + (D.err.comptes ? '' : `<div class="list">${D.comptes.length ? D.comptes.map(c => `
      <div class="row"><span class="mk ${c.admin ? 'o' : 'off'}" style="border-radius:50%" title="${c.admin ? 'administrateur' : ''}"></span>
        <div><b>${esc(fmtTel(String(c.tel).replace(/^225/, '')))} ${c.banni ? `<span class="tag bad">banni · ${esc(MOTIF_BAN[c.banni_motif] || c.banni_motif || '')}</span>` : ''} ${c.verifie ? '<span class="tag ok">identité vérifiée</span>' : ''} ${c.admin ? '<span class="tag ok">admin</span>' : ''} ${c.secours ? '' : '<span class="tag acc">sans code de secours</span>'}</b><small>Inscrit le ${date(c.created_at)} · dernière connexion ${ago(c.last_sign_in_at)}</small></div>
        <div class="c3"><small>${fmt(c.offres)} offre(s) · ${fmt(c.demandes)} demande(s)</small><small>${fmt(c.negociations)} négociation(s)${c.publiees != null && !c.verifie && !c.admin ? ' · ' + Math.min(c.publiees, 3) + '/3 gratuites' : ''}</small></div>
        <div class="c4">${c.signale ? `<span class="tag bad">${c.signale} signalement(s)</span>` : ''}</div>
        <div class="acts">${window.MDGMessages && !c.admin ? `<button class="btn sm" data-ecrire="${c.id}">Écrire</button>` : ''}<button class="btn sm" data-voir="${c.id}">Ses annonces</button><button class="btn sm" data-code="${c.id}" data-tel="${esc(c.tel)}">Nouveau code</button>${c.admin || c.banni == null ? '' : c.banni ? `<button class="btn sm" data-deban="${c.id}">Lever le bannissement</button>` : `<button class="btn sm bad" data-bannir="${c.id}">Bannir</button>`}</div></div>`).join('') : '<div class="empty"><b>Aucun compte</b></div>'}</div>`),
    negos: () => {
      const L = D.negos;
      return top('Négociations', fmt(L.length) + ' au total : ' + fmt(L.filter(n => n.statut === 'ouverte').length) + ' en cours, ' + fmt(L.filter(n => n.statut === 'conclue').length) + ' conclues.') + `<div class="list">${L.length ? L.map(n => `
        <div class="row" data-row="${n.id}"><span class="mk ${n.cible === 'offre' ? 'o' : 'd'}"></span>
          <div><b>${esc(n.produit || 'Annonce')}${n.quantite ? ' · ' + fmt(n.quantite) + ' ' + esc(n.unite || '') : ''}</b><small>${esc(n.ville || '')} · mis à jour ${ago(n.updated_at)}</small></div>
          <div class="c3"><small>Affiché ${n.prix_annonce ? fmt(n.prix_annonce) + ' F' : '—'}</small><small>${n.statut === 'conclue' ? 'Accord ' + fmt(n.prix_final) + ' F' + (n.quantite_finale ? ' × ' + fmt(n.quantite_finale) : '') : 'Dernier prix ' + (n.dernier_prix ? fmt(n.dernier_prix) + ' F' + (n.dernier_quantite ? ' × ' + fmt(n.dernier_quantite) : '') : '—')}</small></div>
          <div class="c4"><span class="tag ${n.statut === 'conclue' ? 'ok' : n.statut === 'close' ? '' : 'acc'}">${n.statut === 'conclue' ? 'conclue' : n.statut === 'close' ? (n.motif_fin === 'annonce_retiree' ? 'annonce retirée' : 'arrêtée') : n.dernier_par && n.expire_le && Date.parse(n.expire_le) > Date.now() ? 'proposition en attente' : 'en cours'}</span></div>
          <div class="acts"><button class="btn sm" data-fil="${n.id}">Lire</button></div></div>`).join('') : '<div class="empty"><b>Aucune négociation</b>Elles apparaîtront ici dès qu’un acheteur proposera un prix.</div>'}</div>`;
    }
  };
  // ——— messages : écrire à tous, alertes « sortie de l'application », toutes les conversations ———
  VIEWS.messages = () => {
    const nv = D.alertes.filter(a => !a.vu).length, L = D.discussions;
    const nomU = uid => { const c = D.byUser && D.byUser[uid]; return c ? fmtTel(String(c.tel).replace(/^225/, '')) : 'compte supprimé'; };
    return top('Messages', 'Écrivez à tous les membres au nom du Marché de Gros, suivez les tentatives de sortir de l’application et lisez les conversations.') + `
      <section class="sec"><div class="sec-h"><h2>Message à tous les membres</h2><p>Chacun le reçoit dans ses messages, avec le logo du Marché de Gros, et une notification.</p></div>
        <div class="list carte"><textarea data-dif maxlength="2000" rows="4" placeholder="Bonjour, …" aria-label="Message à tous les membres"></textarea>
        <div style="display:flex;justify-content:flex-end"><button class="btn pri" data-difgo>Envoyer à tous</button></div></div></section>
      <section class="sec"><div class="sec-h"><h2>Personnes signalées</h2><p>${D.sigc ? (D.sigc.filter(x => x.priorite).length ? D.sigc.filter(x => x.priorite).length + ' à examiner en priorité. ' : '') : D.sigm.filter(x => !x.traite).length ? D.sigm.filter(x => !x.traite).length + ' à traiter. ' : ''}Priorité : une preuve (photo ou conversation jointe), ou au moins 3 personnes différentes en 30 jours. La personne signalée ne sait pas qui l’a signalée. Rien n’est automatique : c’est vous qui décidez.</p></div>
        <div class="list">${D.sigc ? sigComptes() : D.err.sigm ? '<div class="empty"><b>Signalements indisponibles</b>' + esc(D.err.sigm) + '</div>' : D.sigm.length ? D.sigm.map(x => `
          <div class="row${x.traite ? ' is-hidden' : ''}"><span class="mk ${x.traite ? 'off' : 'd'}" style="background:${x.traite ? '' : 'var(--bad)'}"></span>
            <div><b>${esc(MOTIF_BAN[x.motif] || x.motif)} · ${esc(fmtTel(String(x.cible_tel || '').replace(/^225/, '')) || 'compte supprimé')}</b><small>${x.detail ? '« ' + esc(x.detail) + ' »' : 'Sans précision'}</small></div>
            <div class="c3"><small>${x.source === 'dm' ? 'message direct' : x.source === 'negociation' ? 'négociation' : 'profil'} · par ${esc(fmtTel(String(x.auteur_tel || '').replace(/^225/, '')))}</small><small>${ago(x.created_at)}</small></div>
            <div class="c4">${x.signale_par > 1 ? `<span class="tag bad">${x.signale_par} personnes</span>` : ''} ${x.cible_banni ? '<span class="tag bad">banni</span>' : x.cible_verifie ? '<span class="tag ok">vérifié</span>' : ''}</div>
            <div class="acts">${x.source === 'dm' && x.ref_id ? `<button class="btn sm" data-lire="${x.ref_id}">Lire</button>` : ''}${window.MDGMessages ? `<button class="btn sm" data-ecrire="${x.cible_id}">Écrire</button>` : ''}${x.traite ? '' : `<button class="btn sm" data-sigok="${x.id}">Traité</button>`}${x.cible_banni ? '' : `<button class="btn sm bad" data-bannir="${x.cible_id}">Bannir</button>`}</div></div>`).join('') : '<div class="empty"><b>Aucun signalement</b>Les personnes signalées par les membres apparaîtront ici.</div>'}</div></section>
      <section class="sec"><div class="sec-h"><h2>Alertes : sortie de l’application</h2><p>${nv ? nv + ' nouvelle' + (nv > 1 ? 's' : '') + '. ' : ''}Numéro, WhatsApp, autre messagerie ou lien écrit dans un message. Le numéro est masqué pour l’autre personne.</p></div>
        <div class="list">${D.err.alertes ? '<div class="empty"><b>Alertes indisponibles</b>' + esc(D.err.alertes) + '</div>' : D.alertes.length ? D.alertes.map(a => `
          <div class="row${a.vu ? ' is-hidden' : ''}"><span class="mk ${a.vu ? 'off' : 'd'}" style="background:${a.vu ? '' : 'var(--bad)'}"></span>
            <div><b>${esc(a.motif)} · ${esc(nomU(a.user_id))}</b><small>« ${esc(a.extrait || '')} »</small></div>
            <div class="c3"><small>${a.source === 'dm' ? 'message direct' : 'négociation'}</small><small>${ago(a.created_at)}</small></div>
            <div class="c4">${a.vu ? '<span class="tag">vue</span>' : '<span class="tag bad">nouvelle</span>'}</div>
            <div class="acts">${window.MDGMessages && a.user_id ? `<button class="btn sm" data-ecrire="${a.user_id}">Écrire</button>` : ''}${a.source === 'dm' && a.ref_id ? `<button class="btn sm" data-lire="${a.ref_id}">Lire</button>` : ''}${a.vu ? '' : `<button class="btn sm" data-vu="${a.id}">Vue</button>`}${a.user_id && D.byUser[a.user_id] && D.byUser[a.user_id].banni === false && !D.byUser[a.user_id].admin ? `<button class="btn sm bad" data-bannir="${a.user_id}">Bannir</button>` : ''}</div></div>`).join('') : '<div class="empty"><b>Aucune alerte</b>Personne n’a essayé de sortir de l’application.</div>'}</div></section>
      <section class="sec"><div class="sec-h"><h2>Toutes les conversations</h2><p>${fmt(L.length)} conversation(s) des ${window.MDGMessages ? MDGMessages.JOURS : 7} derniers jours.</p></div>
        <div class="list">${D.err.discussions ? '<div class="empty"><b>Conversations indisponibles</b>' + esc(D.err.discussions) + '</div>' : L.length ? L.map(d => `
          <div class="row" data-row="${d.id}"><span class="mk o"></span>
            <div><b>${esc(d.a_nom)} ↔ ${esc(d.b_nom)}</b><small>${esc(d.dernier_texte || '')}</small></div>
            <div class="c3"><small>${esc(fmtTel(d.a_tel || ''))} · ${esc(fmtTel(d.b_tel || ''))}</small><small>${fmt(d.n)} message(s) · ${ago(d.updated_at)}</small></div>
            <div class="c4">${d.alertes > 0 ? `<span class="tag bad">${d.alertes} alerte(s)</span>` : ''}</div>
            <div class="acts"><button class="btn sm" data-lire="${d.id}">Lire</button></div></div>`).join('') : '<div class="empty"><b>Aucune conversation</b></div>'}</div></section>`;
  };
  // ——— personnes signalées, regroupées par compte (schéma 18) ———
  const SRC = { dm: 'discussion', negociation: 'négociation', profil: 'profil' };
  function sigComptes() {
    if (!D.sigc.length) return '<div class="empty"><b>Aucun signalement</b>Les personnes signalées par les membres apparaîtront ici.</div>';
    const tel = t => esc(fmtTel(String(t || '').replace(/^225/, '')) || 'compte supprimé');
    return D.sigc.map(g => { const L = g.signalements || [], nPh = L.reduce((t, x) => t + ((x.preuves || []).length), 0);
      return `<div class="row${g.a_traiter ? '' : ' is-hidden'}" data-sigc="${g.cible_id}"><span class="mk ${g.a_traiter ? 'd' : 'off'}" style="background:${g.priorite ? 'var(--bad)' : g.a_traiter ? 'var(--acc)' : ''}"></span>
        <div><b>${tel(g.cible_tel)}</b><small>${L.length} signalement${L.length > 1 ? 's' : ''} · dernier ${ago(g.dernier)}</small></div>
        <div class="c3"><small>${g.personnes_30j} personne${g.personnes_30j > 1 ? 's' : ''} différente${g.personnes_30j > 1 ? 's' : ''} en 30 jours</small><small>${g.avec_preuve ? 'avec preuve' : 'sans preuve'}${nPh ? ' · ' + nPh + ' photo' + (nPh > 1 ? 's' : '') : ''}</small></div>
        <div class="c4">${g.priorite ? '<span class="tag bad">à examiner en priorité</span> ' : ''}${g.cible_banni ? '<span class="tag bad">banni</span>' : g.cible_verifie ? '<span class="tag ok">vérifié</span>' : ''}</div>
        <div class="acts"><button class="btn sm pri" data-sigvoir="${g.cible_id}">Examiner</button>${window.MDGMessages && g.cible_id ? `<button class="btn sm" data-ecrire="${g.cible_id}">Écrire</button>` : ''}${g.a_traiter ? `<button class="btn sm" data-sigtout="${g.cible_id}">Traité</button>` : ''}${g.cible_banni || !g.cible_id ? '' : `<button class="btn sm bad" data-bannir="${g.cible_id}">Bannir</button>`}</div></div>`; }).join('');
  }
  async function sigExaminer(cid, row) {
    const next = row.nextElementSibling; if (next && next.classList.contains('fil')) { next.remove(); return; }
    const g = D.sigc.find(x => x.cible_id === cid); if (!g) return;
    const el = document.createElement('div'); el.className = 'fil idx'; el.innerHTML = '<div>Chargement des preuves…</div>'; row.after(el);
    const L = g.signalements || [];
    const liens = await Promise.all(L.map(x => Promise.all((x.preuves || []).map(c => N.lienSigne('preuves', c, 120).catch(() => null)))));
    if (!el.isConnected) return;
    el.innerHTML = L.map((x, i) => `<div style="display:flex;flex-direction:column;gap:8px;padding:12px 0;border-top:1px solid var(--line)">
        <p style="margin:0"><b>${esc(MOTIF_BAN[x.motif] || x.motif)}</b> · par ${esc(fmtTel(String(x.auteur_tel || '').replace(/^225/, '')))} · ${ago(x.created_at)} · depuis ${SRC[x.source] || x.source}${x.traite ? ' · traité' : ''}</p>
        <p style="margin:0">« ${esc(x.detail || 'sans précision')} »</p>
        ${liens[i].length ? `<div class="idx-ph">${liens[i].map((u, k) => u ? `<figure><figcaption>Preuve ${k + 1}</figcaption><a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="Preuve ${k + 1}" referrerpolicy="no-referrer"></a></figure>` : '<p>Photo introuvable</p>').join('')}</div>` : ''}
        <p style="margin:0;color:var(--faint);font-size:13px">${x.source === 'dm' && x.ref_id ? `Discussion jointe : <button class="btn sm" data-lire="${x.ref_id}">Lire la discussion</button>` : x.source === 'negociation' && x.ref_id ? 'Négociation jointe : elle apparaît dans l’onglet Négociations.' : x.sans_preuve ? 'Sans preuve : compte seulement pour le nombre de personnes.' : ''}</p></div>`).join('')
      + '<p style="color:var(--faint);font-size:12.5px;margin:8px 0 0">Les liens des photos expirent après deux minutes.</p>';
    el.querySelectorAll('[data-lire]').forEach(b => { const o = document.querySelector('[data-lire="' + b.dataset.lire + '"]:not(.fil [data-lire])'); b.onclick = () => o ? o.click() : toast('Ouvrez la discussion depuis la liste des conversations.'); });
  }
  // ——— identités : dossiers à examiner (supabase/schema-13-identite.sql). Personne n'est « vérifié » sans décision ici. ———
  const PIECE = { cni: 'Carte nationale d’identité', passeport: 'Passeport', carte_consulaire: 'Carte consulaire', permis: 'Permis de conduire' };
  const auj = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const jour = j => j ? new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const expTag = v => { if (v.sans_fin) return '<span class="tag acc">permis sans date de fin</span> '; const e = v.expire_le || v.expire_lu; if (!e) return v.expire_le === undefined ? '' : '<span class="tag">expiration ?</span> ';
    return e < auj() ? `<span class="tag bad">pièce expirée (${jour(e)})</span> ` : `<span class="tag">expire le ${jour(e)}</span> `; };
  VIEWS.identites = () => {
    const att = D.ident.filter(v => v.statut === 'en_attente'), rev = D.ident.filter(v => v.statut === 'verification_manuelle');
    const carte = v => `<div class="row" data-row="${v.id}"><span class="mk ${v.statut === 'en_attente' ? 'd' : 'off'}"></span>
        <div><b>${esc(v.nom_saisi || '—')}</b><small>${esc(PIECE[v.piece] || v.piece)} · envoyé ${ago(v.soumis_le)}${v.essais > 1 ? ' · ' + v.essais + 'e envoi' : ''}</small></div>
        <div class="c3"><small>Compte ${esc(fmtTel(String(v.tel || '').replace(/^225/, '')))} · inscrit le ${date(v.membre_depuis)}</small><small>Profil : ${esc(v.profil_pseudo || v.profil_nom || '—')}</small></div>
        <div class="c4">${expTag(v)}${v.statut === 'en_attente' ? (v.mrz_ok ? '<span class="tag ok">bande MRZ lisible</span>' : v.nom_lu ? '<span class="tag acc">MRZ douteuse</span>' : '<span class="tag">MRZ non lue</span>') : '<span class="tag acc">photos demandées</span>'}${v.nom_banni ? ' <span class="tag bad" title="Une personne bannie a été vérifiée sous ce nom">nom déjà banni</span>' : ''}</div>
        <div class="acts">${v.statut === 'en_attente' ? `<button class="btn sm pri" data-idv="${v.id}">Examiner</button>` : `<button class="btn sm bad" data-iddec="refuse" data-id="${v.id}">Refuser</button>`}</div></div>`;
    return top('Identités', 'Comparez la pièce, le selfie et le code écrit à la main, puis décidez. Une pièce expirée ne peut pas être vérifiée. Tout dossier envoyé est conservé 5 ans (fraude, plainte, réquisition) ; chaque ouverture des photos est notée.') + (D.identAbsent ? `<div class="list"><div class="empty"><b>Pas encore installé</b>Lancez supabase/schema-13-identite.sql dans l’éditeur SQL de Supabase.</div></div>` : `
      <section class="sec"><div class="sec-h"><h2>À examiner</h2><p>${att.length} dossier${att.length > 1 ? 's' : ''}, le plus ancien en premier.</p></div>
        ${att.length ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 0 12px"><button class="btn pri" data-rapide>Examiner en mode rapide (${att.length})</button><small style="color:var(--mute)">Plein écran, un dossier à la fois, les plus nets d’abord. Touches V, P, R et flèches.</small></div>` : ''}
        <div class="list">${att.length ? att.map(carte).join('') : '<div class="empty"><b>Rien à examiner</b>Les dossiers envoyés apparaîtront ici.</div>'}</div></section>
      ${rev.length ? `<section class="sec"><div class="sec-h"><h2>En attente de nouvelles photos</h2><p>Vous avez demandé de refaire des photos ; le membre peut renvoyer son dossier.</p></div><div class="list">${rev.map(carte).join('')}</div></section>` : ''}
      <section class="sec"><div class="sec-h"><h2>Registre des identités</h2><p>Retrouver un dossier conservé (vérifié, refusé, retiré, compte supprimé) : téléphone, nom ou numéro de pièce. Chaque ouverture demande un motif et reste notée.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input class="search" data-reg-q placeholder="07 00 00 00 00, KOUASSI, CI00…" maxlength="60" style="flex:1;min-width:220px"><button class="btn" data-reg-go>Rechercher</button></div>
        <div class="list" data-reg-res></div></section>
      <p style="color:var(--faint);font-size:13px;max-width:70ch">La lecture de la bande MRZ est faite dans le téléphone du membre : c’est une indication, pas une preuve. Vérifiez vous-même que la photo de la pièce et le selfie montrent la même personne, que le code écrit est bien <b>le code affiché</b> et que le nom correspond.</p>`);
  };
  async function examiner(id, row) {
    const next = row.nextElementSibling; if (next && next.classList.contains('fil')) { next.remove(); return; }
    const v = D.ident.find(x => x.id === id); if (!v) return;
    const el = document.createElement('div'); el.className = 'fil idx'; el.innerHTML = '<div>Chargement des photos…</div>'; row.after(el);
    try { await N.rpc('admin_identite_ouvrir', { p_id: v.id, p_motif: 'Examen du dossier' }); } catch (e) { if (!/admin_identite_ouvrir|schema cache|Could not find/i.test(e.message)) { el.innerHTML = '<div>Impossible d’ouvrir : ' + esc(e.message) + '</div>'; return; } }
    const noms = v.piece === 'passeport' ? ['recto', 'selfie'] : ['recto', 'verso', 'selfie'];
    const L = await Promise.all(noms.map(n => N.lienSigne('identite', v.dossier + '/' + n + '.jpg', 120).catch(() => null)));
    if (!el.isConnected) return;
    const expire = v.expire_le || v.expire_lu || '';
    const lab = { recto: 'Pièce, recto', verso: 'Pièce, verso', selfie: 'Selfie avec le code' };
    el.innerHTML = `<div class="idx-ph">${noms.map((n, i) => `<figure><figcaption>${lab[n]}</figcaption>${L[i] ? `<a href="${esc(L[i])}" target="_blank" rel="noopener noreferrer"><img src="${esc(L[i])}" alt="${lab[n]}" referrerpolicy="no-referrer"></a>` : '<p>Photo introuvable</p>'}</figure>`).join('')}</div>
      <div class="idx-info"><p>Code que le membre devait écrire : <b class="idx-code">${esc(v.defi)}</b></p>
        <p>Nom saisi : <b>${esc(v.nom_saisi || '—')}</b>${v.nom_lu ? ` · lu sur la bande MRZ : <b>${esc(v.nom_lu)}</b> ${v.mrz_ok ? '(chiffres de contrôle justes)' : '(lecture douteuse)'}` : ' · bande MRZ non lue'}</p>
        <label>Nom retenu (si vous le corrigez) <input class="search" data-idnom value="${esc(v.nom_saisi || '')}" maxlength="120" style="width:100%;margin-top:6px"></label>
        ${v.sans_fin ? `<p>Le membre indique que <b>son permis n’a pas de date de fin</b> (permis A ou B sans limite). <b>Vérifiez sur la photo qu’aucune date de fin n’est écrite</b> ; s’il y en a une, écrivez-la ci-dessous. Sinon, le badge vaudra jusqu’au <b>${jour(v.expire_le)}</b> (5 ans).</p>` : `<p>Date d’expiration donnée par le membre : <b>${jour(v.expire_le)}</b>${v.expire_lu ? ` · lue sur la bande : <b>${jour(v.expire_lu)}</b>` : ''}. <b>Comparez avec la photo de la pièce.</b></p>`}
        <div style="display:flex;gap:12px;flex-wrap:wrap"><label style="flex:1;min-width:180px">Date d’expiration lue sur la photo <input class="search" type="date" data-idexp value="${esc(expire)}" style="width:100%;margin-top:6px"></label>
          <label style="flex:1;min-width:180px">Numéro de la pièce <input class="search" data-idnum value="${esc(v.numero_lu || '')}" maxlength="40" style="width:100%;margin-top:6px;text-transform:uppercase" placeholder="lu sur la photo"></label></div>
        ${expire && expire < auj() ? '<p class="tag bad" style="display:inline-block">Pièce expirée : refusez avec le motif « pièce expirée ».</p>' : ''}
        <div class="acts" style="justify-content:flex-start"><button class="btn pri" data-iddec="verifie" data-id="${v.id}">Identité vérifiée</button><button class="btn" data-iddec="verification_manuelle" data-id="${v.id}">Photos à refaire</button><button class="btn bad" data-iddec="refuse" data-id="${v.id}">Refuser</button></div>
        <p style="color:var(--faint);font-size:12.5px">Les liens des photos expirent après deux minutes. Rien n’est téléchargé sur cet ordinateur. Cette ouverture est notée dans le registre.</p></div>`;
    bindIdent(el);
  }
  // ——— bannissement à vie (supabase/schema-14-confiance.sql) ———
  const MOTIF_BAN = { arnaque: 'arnaque', mauvais_produits: 'mauvais produits', insultes: 'insultes', autre: 'autre' };
  async function bannir(uid) {
    const c = D.byUser[uid], qui = c ? fmtTel(String(c.tel).replace(/^225/, '')) : 'ce compte';
    const ch = prompt('Bannir ' + qui + ' à vie. Motif :\n1 · Arnaque\n2 · Mauvais produits à répétition\n3 · Insultes dans les discussions\n4 · Autre\n\nTapez le chiffre :');
    if (ch == null) return; const motif = ['arnaque', 'mauvais_produits', 'insultes', 'autre'][+ch.trim() - 1]; if (!motif) return toast('Tapez 1, 2, 3 ou 4.');
    const detail = prompt('Précisez en une phrase (pour l’équipe, le membre ne le lit pas) :'); if (detail == null) return;
    if (!confirm('Confirmer le bannissement à vie de ' + qui + ' ?\nSes annonces seront masquées ; il ne pourra plus publier, négocier, écrire ni faire vérifier son identité.')) return;
    try { await N.rpc('admin_bannir', { p_user: uid, p_motif: motif, p_detail: detail.trim() || null }); await load(); paint(); toast('Compte banni. Ses annonces sont masquées.'); }
    catch (e) { toast(/admin_bannir|schema cache|Could not find/i.test(e.message) ? 'Fonction pas encore installée : lancez supabase/schema-14-confiance.sql.' : 'Impossible : ' + e.message); }
  }
  async function lever(uid) {
    const c = D.byUser[uid], qui = c ? fmtTel(String(c.tel).replace(/^225/, '')) : 'ce compte';
    if (!confirm('Lever le bannissement de ' + qui + ' ? Ses annonces restent masquées : rétablissez-les une par une si besoin.')) return;
    try { await N.rpc('admin_lever_bannissement', { p_user: uid }); await load(); paint(); toast('Bannissement levé.'); } catch (e) { toast('Impossible : ' + e.message); }
  }
  async function decider(b) {
    const v = D.ident.find(x => x.id === b.dataset.id), st = b.dataset.iddec; if (!v) return;
    let motif = null;
    const bx = b.closest('.fil'), expIn = bx && bx.querySelector('[data-idexp]'), numIn = bx && bx.querySelector('[data-idnum]');
    const exp = expIn ? expIn.value || null : (v.expire_le || null);
    if (st === 'verifie' && !exp) return toast('Indiquez la date d’expiration lue sur la photo de la pièce.');
    if (st === 'verifie' && exp < auj()) return toast('Pièce expirée : elle ne peut pas être vérifiée. Refusez avec le motif « pièce expirée ».');
    if (st === 'verifie') { if (!confirm('Confirmer : la pièce, le selfie et le code concordent, et l’identité de ' + (v.nom_saisi || 'ce membre') + ' est vérifiée ?')) return; }
    else { motif = prompt(st === 'refuse' ? 'Motif du refus (le membre le lira) :' : 'Qu’est-ce que le membre doit refaire ? (il le lira)'); if (motif == null) return; if (!motif.trim()) return toast('Indiquez le motif.'); }
    const box = b.closest('.fil'), nomIn = box && box.querySelector('[data-idnom]');
    b.disabled = true;
    try {
      // le dossier est conservé 5 ans (schéma 16) : plus aucun effacement ici
      await N.rpc('admin_identite_decider', { p_id: v.id, p_statut: st, p_motif: motif, p_nom: nomIn ? nomIn.value.trim() || null : null, p_expire: exp, p_numero: numIn ? numIn.value.trim() || null : null });
      await load(); paint();
      toast(st === 'verifie' ? 'Identité vérifiée : le badge apparaît jusqu’à l’expiration de la pièce.' : st === 'refuse' ? 'Dossier refusé (conservé 5 ans).' : 'Le membre est prévenu qu’il doit refaire des photos.');
    } catch (e) { b.disabled = false; toast('Décision impossible : ' + e.message); }
  }
  // ——— registre : retrouver un dossier conservé, l'ouvrir avec un motif (noté) ———
  const ST_REG = { en_attente: 'en examen', verification_manuelle: 'photos à refaire', verifie: 'vérifiée', refuse: 'refusée', remplace: 'remplacée', retire: 'retirée' };
  async function chercherRegistre(box) {
    const q = box.querySelector('[data-reg-q]').value.trim(), res = box.querySelector('[data-reg-res]');
    if (q.length < 3) return toast('Tapez au moins 3 caractères.');
    res.innerHTML = '<div class="empty">Recherche…</div>';
    let L; try { L = await N.rpc('admin_identite_registre', { p_q: q }); } catch (e) { res.innerHTML = `<div class="empty"><b>Impossible</b>${esc(/admin_identite_registre|schema cache|Could not find/i.test(e.message) ? 'Lancez supabase/schema-16-identite-conservation.sql.' : e.message)}</div>`; return; }
    res.innerHTML = (L || []).length ? L.map(r => `<div class="row" data-reg="${r.id}"><span class="mk ${r.statut === 'verifie' ? 'o' : r.statut === 'refuse' ? 'd off' : 'off'}"></span>
        <div><b>${esc(r.nom || '—')}</b><small>${esc(PIECE[r.piece] || r.piece)} n° ${esc(r.numero || '?')} · expire le ${jour(r.expire_le)}</small></div>
        <div class="c3"><small>Tél. ${esc(fmtTel(String(r.tel || '').replace(/^225/, '')))}${r.compte_supprime ? ' · <b>compte supprimé</b>' : ''}</small><small>Envoyé le ${date(r.soumis_le)} · ${ST_REG[r.statut] || r.statut}</small></div>
        <div class="c4"><span class="tag">gardé ${r.garder_jusquau ? 'jusqu’au ' + date(r.garder_jusquau) : 'tant que le compte existe'}</span>${r.acces ? ` <span class="tag">${r.acces} ouverture${r.acces > 1 ? 's' : ''}</span>` : ''}</div>
        <div class="acts">${r.photos ? `<button class="btn sm" data-reg-open="${r.id}">Ouvrir</button>` : '<small>photos effacées</small>'}</div></div>`).join('')
      : '<div class="empty"><b>Aucun dossier</b>Rien ne correspond. Seuls les dossiers envoyés sont conservés.</div>';
    res.querySelectorAll('[data-reg-open]').forEach(b => b.onclick = () => ouvrirRegistre(b.dataset.regOpen, b.closest('.row'), L.find(x => x.id === b.dataset.regOpen)));
  }
  async function ouvrirRegistre(id, row, r) {
    const next = row.nextElementSibling; if (next && next.classList.contains('fil')) { next.remove(); return; }
    const motif = prompt('Pourquoi ouvrez-vous ce dossier ? (noté dans le registre)\nExemple : réquisition de la police n°…, plainte de …'); if (motif == null) return;
    if (motif.trim().length < 3) return toast('Indiquez le motif.');
    let o; try { o = await N.rpc('admin_identite_ouvrir', { p_id: id, p_motif: motif.trim() }); } catch (e) { return toast('Impossible : ' + e.message); }
    const noms = o.piece === 'passeport' ? ['recto', 'selfie'] : ['recto', 'verso', 'selfie'], lab = { recto: 'Pièce, recto', verso: 'Pièce, verso', selfie: 'Selfie avec le code' };
    const [L, H] = await Promise.all([Promise.all(noms.map(n => N.lienSigne('identite', o.dossier + '/' + n + '.jpg', 120).catch(() => null))), N.rpc('admin_identite_acces', { p_id: id }).catch(() => [])]);
    const el = document.createElement('div'); el.className = 'fil idx'; row.after(el);
    el.innerHTML = `<div class="idx-ph">${noms.map((n, i) => `<figure><figcaption>${lab[n]}</figcaption>${L[i] ? `<a href="${esc(L[i])}" target="_blank" rel="noopener noreferrer"><img src="${esc(L[i])}" alt="${lab[n]}" referrerpolicy="no-referrer"></a>` : '<p>Photo introuvable</p>'}</figure>`).join('')}</div>
      <div class="idx-info"><p>Nom : <b>${esc(r && r.nom || '—')}</b> · ${esc(PIECE[r && r.piece] || '')} n° <b>${esc(r && r.numero || '?')}</b> · expire le <b>${jour(r && r.expire_le)}</b> · tél. <b>${esc(fmtTel(String(r && r.tel || '').replace(/^225/, '')))}</b></p>
        <p style="color:var(--faint);font-size:12.5px">Ouvertures de ce dossier : ${(H || []).map(a => `${date(a.quand)} (${esc(fmtTel(String(a.admin_tel || '').replace(/^225/, '')))}) — ${esc(a.motif)}`).join(' · ') || '—'}</p>
        <p style="color:var(--faint);font-size:12.5px">À remettre aux autorités seulement sur réquisition écrite. Les liens expirent après deux minutes.</p></div>`;
  }
  function bindIdent(r) {
    const rq = r.querySelector('[data-reg-q]'), rg = r.querySelector('[data-reg-go]'), box = rq && rq.closest('.sec');
    if (rg) rg.onclick = () => chercherRegistre(box);
    if (rq) rq.onkeydown = e => { if (e.key === 'Enter') chercherRegistre(box); };
    r.querySelectorAll('[data-idv]').forEach(b => b.onclick = () => examiner(b.dataset.idv, b.closest('.row')));
    r.querySelectorAll('[data-iddec]').forEach(b => b.onclick = () => decider(b));
    r.querySelectorAll('[data-rapide]').forEach(b => b.onclick = async () => { b.disabled = true; try { await modeRapide(); } finally { b.disabled = false; } });
  }
  // ——— mode rapide : un dossier à la fois, en plein écran, les « propres » d'abord (supabase/schema-19-admin-identites.sql) ———
  // Le tri (propre · à regarder · suspect) n'est qu'une aide : chaque dossier est regardé et décidé par l'administrateur.
  // Raccourcis : V valider (deux fois pour confirmer) · P photos à refaire · R refuser · ← → précédent / suivant · Échap fermer.
  const MR_REFUS = ['Pièce expirée', 'Photo floue', 'Code absent ou faux', 'Visage différent', 'Pièce d’une autre personne'];
  const MR_REFAIRE = ['Photo floue', 'Code absent ou faux', 'Pièce coupée ou avec un reflet', 'Visage mal visible sur le selfie'];
  const MR_PILE = { propre: ['ok', 'Propre'], regarder: ['moy', 'À regarder'], suspect: ['bad', 'Suspect'] };
  const MR_CSS = `.mr{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;background:var(--bg);overscroll-behavior:contain}
.mr-h{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:12px clamp(14px,3vw,28px);border-bottom:1px solid var(--line);background:var(--champ)}
.mr-h h2{margin:0;font:600 20px/1.1 Jost,sans-serif}.mr-n{font-weight:700;font-size:17px}.mr-n small{font-weight:500;color:var(--mute);font-size:13.5px;margin-left:6px}
.mr-h .sp{flex:1}.mr-k{color:var(--faint);font-size:12.5px}.mr-k kbd{display:inline-block;min-width:20px;padding:0 5px;border:1px solid var(--line);border-radius:6px;font:600 11.5px/18px Jost,sans-serif;text-align:center;color:var(--mute)}
.mr-b{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);align-items:start;gap:20px;padding:18px clamp(14px,3vw,28px) 24px}
.mr-ph{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}
.mr-ph figure{margin:0;display:flex;flex-direction:column;gap:6px;min-width:0}.mr-ph figure.selfie{grid-column:1 / -1}
.mr-ph figcaption{color:var(--mute);font-size:12.5px}
.mr-ph button{display:block;width:100%;padding:0;border:0;border-radius:14px;background:var(--photo);cursor:zoom-in;overflow:hidden}
.mr-ph img{display:block;width:100%;height:clamp(200px,34vh,380px);object-fit:contain}
.mr-ph .vide{display:grid;place-items:center;height:200px;border-radius:14px;background:var(--photo);color:var(--faint);font-size:13px}
.mr-i{display:flex;flex-direction:column;gap:14px;min-width:0}
.mr-code{padding:14px 16px;border:1px solid var(--line);border-radius:18px;background:var(--panel);text-align:center}
.mr-code small{display:block;color:var(--mute);font-size:12.5px}.mr-code b{display:block;font:700 clamp(46px,7vw,72px)/1.05 Jost,system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.14em;color:var(--a)}
.mr-who b{display:block;font-size:19px;font-weight:600}.mr-who small{display:block;color:var(--mute);font-size:13px}
.mr-pile{display:inline-block;padding:3px 11px;border-radius:999px;font-weight:700;font-size:12.5px}
.mr-pile.ok,.mr-c.ok i{background:rgba(108,197,140,.18);color:#8FDCA8}.mr-pile.moy,.mr-c.moy i{background:rgba(242,194,48,.18);color:var(--acc)}.mr-pile.bad,.mr-c.bad i{background:rgba(229,96,79,.2);color:var(--bad-t)}
.mr-cs{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.mr-c{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.35}.mr-c i{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font:700 13px/1 Jost,sans-serif;font-style:normal}
.mr-c.bad span{color:var(--bad-t)}
.mr-f{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mr-f label{display:flex;flex-direction:column;gap:5px;color:var(--mute);font-size:12.5px;min-width:0}.mr-f label.l{grid-column:1 / -1}
.mr-f input{width:100%;height:42px;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:var(--champ);color:var(--ink)}
.mr-a{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px}.mr-a .btn{min-height:50px;font-size:15px;white-space:normal;line-height:1.15}.mr-a .btn kbd{font:600 11px Jost,sans-serif;opacity:.7;border:1px solid currentColor;border-radius:5px;padding:0 4px}
.mr-a .btn.pri{background:#3FA66A;border-color:#3FA66A;color:#0d2a1c}.mr-a .btn.arm{background:var(--v);border-color:var(--v)}
.mr-m{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}
.mr-m b{font-weight:600}.mr-ms{display:flex;flex-wrap:wrap;gap:6px}.mr-ms button{min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:999px;background:var(--champ);cursor:pointer;font-size:13.5px}
.mr-ms button[aria-pressed=true]{background:var(--ink);color:var(--sur);border-color:var(--ink)}.mr-ms button small{opacity:.6;margin-right:5px}
.mr-m input{height:42px;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:var(--champ)}
.mr-fait{padding:10px 14px;border-radius:14px;background:rgba(245,240,230,.07);font-weight:600}
.mr-nav{display:flex;gap:8px}.mr-nav .btn{flex:1}
.mr-z{position:fixed;inset:0;z-index:45;display:grid;place-items:center;background:rgba(0,0,0,.92);cursor:zoom-out;padding:10px}
.mr-z img{max-width:100%;max-height:100%;object-fit:contain}
@media (max-width:480px){.mr-h{flex-wrap:nowrap;gap:10px}.mr-h h2{display:none}.mr-h .mr-n{white-space:nowrap}}
.mr-fin{margin:auto;max-width:460px;text-align:center;padding:40px 20px}.mr-fin h3{margin:0 0 8px;font:600 26px/1.15 Jost,sans-serif}.mr-fin p{color:var(--mute)}
@media (max-width:900px){.mr-b{display:flex;flex-direction:column;align-items:stretch;padding-bottom:110px}.mr-i{display:contents}.mr-code{order:-2;padding:10px 14px}.mr-code b{font-size:52px}.mr-ph{order:-1}.mr-k{display:none}.mr-h h2{font-size:20px}.mr-ph img{height:clamp(160px,30vh,300px)}
  .mr-a{position:fixed;left:0;right:0;bottom:0;z-index:41;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--champ);border-top:1px solid var(--line)}.mr-a .btn kbd{display:none}.mr-a .btn{padding:0 8px;font-size:14px}}`;
  const MR = { L: [], i: 0, liens: {}, ouverts: new Set(), arme: false, mode: null };
  const mrPhotos = v => v.piece === 'passeport' ? ['recto', 'selfie'] : ['recto', 'verso', 'selfie'];
  // liens signés valables 2 minutes ; gardés 100 s pour en avoir toujours un valable
  function mrLiens(v) {
    const c = MR.liens[v.id]; if (c && Date.now() - c.t < 100e3) return c.p;
    const p = Promise.all(mrPhotos(v).map(n => N.lienSigne('identite', v.dossier + '/' + n + '.jpg', 120).catch(() => null)));
    MR.liens[v.id] = { t: Date.now(), p }; return p;
  }
  // sans la fonction du schéma 19 : les mêmes contrôles, calculés ici à partir de la liste
  const MR_ORDRE = { propre: 0, regarder: 1, suspect: 2 };
  function mrDepuisListe() {
    return D.ident.filter(v => v.statut === 'en_attente').map(v => {
      const exp = v.expire_le || null, eOk = !!exp && exp >= auj(), coh = !v.expire_lu || !v.expire_le || v.expire_lu === v.expire_le;
      const pile = v.nom_banni || !eOk || !coh ? 'suspect' : v.mrz_ok && (v.essais || 1) <= 2 ? 'propre' : 'regarder';
      return Object.assign({}, v, { expire_ok: eOk, expire_coherent: coh, nom_ok: null, doublon: null, pile });
    }).sort((a, b) => MR_ORDRE[a.pile] - MR_ORDRE[b.pile] || String(a.soumis_le).localeCompare(String(b.soumis_le)));
  }
  async function modeRapide() {
    if (!document.getElementById('mrCss')) { const s = document.createElement('style'); s.id = 'mrCss'; s.textContent = MR_CSS; document.head.appendChild(s); }
    let L; try { L = await N.rpc('admin_identite_examen'); } catch (e) { if (!/admin_identite_examen|schema cache|Could not find/i.test(e.message)) return toast('Impossible : ' + e.message); L = mrDepuisListe(); }
    if (!(L || []).length) return toast('Rien à examiner pour l’instant.');
    Object.assign(MR, { L, i: 0, liens: {}, ouverts: new Set(), arme: false, mode: null });
    const el = document.createElement('div'); el.className = 'mr'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Mode rapide : dossiers d’identité');
    document.body.appendChild(el); MR.el = el; document.documentElement.style.overflow = 'hidden';
    addEventListener('keydown', mrTouche, true);
    mrMontrer();
  }
  function mrFermer() {
    removeEventListener('keydown', mrTouche, true);
    if (MR.el) MR.el.remove(); MR.el = null; document.documentElement.style.overflow = '';
    const z = document.querySelector('.mr-z'); if (z) z.remove();
    if (MR.L.some(v => v.fait)) load().then(paint);
  }
  const mrReste = () => MR.L.filter(v => !v.fait).length;
  function mrControles(v) {
    const C = [], ok = t => C.push(['ok', '✓', t]), moy = t => C.push(['moy', '!', t]), bad = t => C.push(['bad', '×', t]);
    if (v.doublon) bad('Numéro de pièce déjà utilisé par un autre compte'); else if (!v.numero_lu) moy('Numéro de pièce non lu : recopiez-le depuis la photo'); else if (v.doublon === false) ok('Numéro de pièce jamais vu sur un autre compte');
    if (v.nom_banni) bad('Nom identique à celui d’une personne bannie'); else ok('Aucune personne bannie sous ce nom');
    const exp = v.expire_le || v.expire_lu;
    if (v.expire_ok === false) bad(exp ? 'Pièce expirée le ' + jour(exp) : 'Aucune date d’expiration'); else ok('Pièce valide jusqu’au ' + jour(exp));
    if (v.expire_coherent === false) bad('Date lue sur la bande (' + jour(v.expire_lu) + ') différente de la date saisie (' + jour(v.expire_le) + ')');
    if (v.mrz_ok) ok('Bande de la pièce lue, chiffres de contrôle justes'); else if (v.mrz_ok === false) moy('Bande lue, mais chiffres de contrôle faux'); else moy('Bande de la pièce non lue');
    if (v.nom_ok) ok('Nom saisi identique au nom lu sur la bande'); else if (v.nom_ok === false) moy('Nom saisi différent du nom lu sur la bande'); else if (v.nom_lu) moy('Nom lu sur la bande : à comparer');
    if ((v.essais || 1) > 2) moy(v.essais + 'e envoi de ce membre'); else ok((v.essais || 1) > 1 ? '2e envoi' : 'Premier envoi');
    return C;
  }
  async function mrMontrer() {
    const el = MR.el; if (!el) return;
    MR.arme = false; MR.mode = null;
    if (!mrReste()) {
      const n = k => MR.L.filter(v => v.fait === k).length;
      el.innerHTML = `<div class="mr-h"><h2>Mode rapide</h2><span class="sp"></span><button class="btn sm" data-mr-x>Fermer</button></div>
        <div class="mr-fin"><h3>Tout est examiné</h3><p>${n('verifie')} vérifié${n('verifie') > 1 ? 's' : ''} · ${n('verification_manuelle')} photos à refaire · ${n('refuse')} refusé${n('refuse') > 1 ? 's' : ''}.</p><button class="btn pri" data-mr-x>Revenir au tableau de bord</button></div>`;
      el.querySelectorAll('[data-mr-x]').forEach(b => b.onclick = mrFermer); return;
    }
    const v = MR.L[MR.i], noms = mrPhotos(v), lab = { recto: 'Pièce, recto', verso: 'Pièce, verso', selfie: 'Selfie avec le code' };
    const [cls, plab] = MR_PILE[v.pile] || MR_PILE.regarder, C = mrControles(v), exp = v.expire_le || v.expire_lu || '';
    const FAIT = { verifie: 'Identité vérifiée', verification_manuelle: 'Photos à refaire demandées', refuse: 'Dossier refusé' };
    el.innerHTML = `<div class="mr-h"><h2>Mode rapide</h2><span class="mr-n" data-mr-n>${MR.i + 1} / ${MR.L.length}<small>${mrReste()} restant${mrReste() > 1 ? 's' : ''}</small></span><span class="mr-pile ${cls}">${plab}</span>
        <span class="sp"></span><span class="mr-k"><kbd>V</kbd> valider · <kbd>P</kbd> photos à refaire · <kbd>R</kbd> refuser · <kbd>←</kbd><kbd>→</kbd> dossiers · <kbd>Échap</kbd> fermer</span><button class="btn sm" data-mr-x aria-label="Fermer le mode rapide">Fermer</button></div>
      <div class="mr-b"><div class="mr-ph" data-mr-ph>${noms.map(n => `<figure class="${n}"><figcaption>${lab[n]}</figcaption><div class="vide">Chargement…</div></figure>`).join('')}</div>
        <div class="mr-i">
          <div class="mr-code"><small>Code que le membre devait écrire à la main</small><b>${esc(v.defi || '—')}</b></div>
          <div class="mr-who"><b>${esc(v.nom_saisi || '—')}</b><small>${esc(PIECE[v.piece] || v.piece || '')}${v.nom_lu ? ' · lu sur la bande : ' + esc(v.nom_lu) : ''}</small>
            <small>Compte ${esc(fmtTel(String(v.tel || '').replace(/^225/, '')))} · inscrit le ${date(v.membre_depuis)} · envoyé ${ago(v.soumis_le)}</small></div>
          <ul class="mr-cs">${C.map(([k, s, t]) => `<li class="mr-c ${k}"><i aria-hidden="true">${s}</i><span>${esc(t)}</span></li>`).join('')}</ul>
          ${v.fait ? `<div class="mr-fait">${FAIT[v.fait]}</div>` : `<div class="mr-f">
            <label class="l">Nom retenu (corrigez-le si besoin)<input data-mr-nom value="${esc(v.nom_saisi || '')}" maxlength="120"></label>
            <label>Expire le (lu sur la photo)<input type="date" data-mr-exp value="${esc(exp)}"></label>
            <label>Numéro de la pièce<input data-mr-num value="${esc(v.numero_lu || '')}" maxlength="40" style="text-transform:uppercase" placeholder="lu sur la photo"></label></div>
          <div data-mr-m></div>
          <div class="mr-a"><button class="btn pri" data-mr-d="verifie">Valider <kbd>V</kbd></button><button class="btn" data-mr-d="verification_manuelle">Photos à refaire <kbd>P</kbd></button><button class="btn bad" data-mr-d="refuse">Refuser <kbd>R</kbd></button></div>`}
          <div class="mr-nav"><button class="btn sm" data-mr-p ${MR.i ? '' : 'disabled'}>← Précédent</button><button class="btn sm" data-mr-s ${MR.i < MR.L.length - 1 ? '' : 'disabled'}>Suivant →</button></div>
          <p style="margin:0;color:var(--faint);font-size:12px">Le tri est une aide, pas une décision : regardez les photos. Les liens expirent après deux minutes ; chaque ouverture est notée dans le registre.</p>
        </div></div>`;
    el.querySelectorAll('[data-mr-x]').forEach(b => b.onclick = mrFermer);
    el.querySelector('[data-mr-p]').onclick = () => mrAller(-1);
    el.querySelector('[data-mr-s]').onclick = () => mrAller(1);
    el.querySelectorAll('[data-mr-d]').forEach(b => b.onclick = () => mrAction(b.dataset.mrD));
    el.querySelector('.mr-b').scrollTop = 0;
    // l'ouverture est notée une fois par dossier (registre des accès, schéma 16)
    if (!MR.ouverts.has(v.id)) { MR.ouverts.add(v.id); N.rpc('admin_identite_ouvrir', { p_id: v.id, p_motif: 'Examen du dossier' }).catch(() => {}); }
    const L = await mrLiens(v);
    if (MR.el !== el || MR.L[MR.i] !== v) return;
    const ph = el.querySelector('[data-mr-ph]');
    ph.innerHTML = noms.map((n, i) => `<figure class="${n}"><figcaption>${lab[n]}</figcaption>${L[i] ? `<button type="button" data-mr-z="${i}" aria-label="Agrandir : ${lab[n]}"><img src="${esc(L[i])}" alt="${lab[n]}" referrerpolicy="no-referrer"></button>` : '<div class="vide">Photo introuvable</div>'}</figure>`).join('');
    ph.querySelectorAll('[data-mr-z]').forEach(b => b.onclick = () => mrZoom(L[+b.dataset.mrZ]));
    // le dossier suivant : liens préparés et photos déjà téléchargées
    const s = MR.L.slice(MR.i + 1).find(x => !x.fait);
    if (s) mrLiens(s).then(T => T.forEach(u => { if (u) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = u; } }));
  }
  function mrZoom(u) {
    const z = document.createElement('div'); z.className = 'mr-z'; z.innerHTML = `<img src="${esc(u)}" alt="Photo agrandie" referrerpolicy="no-referrer">`;
    z.onclick = () => z.remove(); document.body.appendChild(z);
  }
  function mrAller(d) { const j = MR.i + d; if (j < 0 || j >= MR.L.length) return; MR.i = j; mrMontrer(); }
  function mrSuivant() {
    const n = MR.L.length, k = [...Array(n).keys()].map(x => (MR.i + 1 + x) % n).find(x => !MR.L[x].fait);
    if (k != null) MR.i = k; mrMontrer();
  }
  function mrAction(st) {
    const v = MR.L[MR.i], el = MR.el; if (!v || v.fait || !el || MR.envoi) return;
    if (st === 'verifie') {
      const exp = el.querySelector('[data-mr-exp]').value || null;
      if (!exp) return toast('Indiquez la date d’expiration lue sur la photo de la pièce.');
      if (exp < auj()) return toast('Pièce expirée : elle ne peut pas être vérifiée. Refusez avec le motif « Pièce expirée ».');
      const b = el.querySelector('[data-mr-d="verifie"]');
      if (!MR.arme) { MR.arme = true; b.classList.add('arm'); b.innerHTML = 'Confirmer <kbd>V</kbd>'; b.title = 'La pièce, le selfie et le code concordent'; return; }
      return mrDecider('verifie', null);
    }
    MR.arme = false; const bv = el.querySelector('[data-mr-d="verifie"]'); if (bv) { bv.classList.remove('arm'); bv.innerHTML = 'Valider <kbd>V</kbd>'; }
    MR.mode = st;
    const M = st === 'refuse' ? MR_REFUS : MR_REFAIRE, box = el.querySelector('[data-mr-m]');
    box.innerHTML = `<div class="mr-m"><b>${st === 'refuse' ? 'Motif du refus' : 'Ce que le membre doit refaire'}</b><small style="color:var(--mute)">Le membre lira ce motif. Touches 1 à ${M.length} pour choisir, Entrée pour confirmer, Échap pour annuler.</small>
      <div class="mr-ms">${M.map((m, i) => `<button type="button" data-mr-mo="${esc(m)}" aria-pressed="false"><small>${i + 1}</small>${esc(m)}</button>`).join('')}</div>
      <input data-mr-libre maxlength="200" placeholder="Autre motif, ou une précision">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ${st === 'refuse' ? 'bad' : 'pri'}" data-mr-ok>${st === 'refuse' ? 'Refuser le dossier' : 'Demander de nouvelles photos'}</button><button class="btn" data-mr-annule>Annuler</button></div></div>`;
    box.querySelectorAll('[data-mr-mo]').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
    box.querySelector('[data-mr-ok]').onclick = mrValiderMotif;
    box.querySelector('[data-mr-annule]').onclick = () => { MR.mode = null; box.innerHTML = ''; };
    box.querySelector('[data-mr-libre]').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); mrValiderMotif(); } };
    box.scrollIntoView({ block: 'nearest' });
  }
  function mrValiderMotif() {
    const box = MR.el && MR.el.querySelector('[data-mr-m]'); if (!box || !MR.mode) return;
    const m = [...box.querySelectorAll('[data-mr-mo][aria-pressed="true"]')].map(b => b.dataset.mrMo), libre = box.querySelector('[data-mr-libre]').value.trim();
    if (libre) m.push(libre);
    if (!m.length) return toast('Choisissez ou écrivez le motif.');
    mrDecider(MR.mode, m.join(' · '));
  }
  async function mrDecider(st, motif) {
    const v = MR.L[MR.i], el = MR.el; if (!v || !el || MR.envoi) return;
    const val = q => { const x = el.querySelector(q); return x ? x.value.trim() || null : null; };
    MR.envoi = true; el.querySelectorAll('.mr-a .btn, [data-mr-ok]').forEach(b => b.disabled = true);
    try {
      await N.rpc('admin_identite_decider', { p_id: v.id, p_statut: st, p_motif: motif, p_nom: val('[data-mr-nom]'), p_expire: val('[data-mr-exp]'), p_numero: val('[data-mr-num]') });
      v.fait = st; const d = D.ident.find(x => x.id === v.id); if (d) d.statut = st;
      MR.envoi = false;
      toast(st === 'verifie' ? 'Identité vérifiée.' : st === 'refuse' ? 'Dossier refusé.' : 'Nouvelles photos demandées.');
      mrSuivant();
    } catch (e) { MR.envoi = false; toast('Décision impossible : ' + e.message); el.querySelectorAll('.mr-a .btn, [data-mr-ok]').forEach(b => b.disabled = false); }
  }
  function mrTouche(e) {
    if (!MR.el || e.ctrlKey || e.metaKey || e.altKey) return;
    const z = document.querySelector('.mr-z');
    if (e.key === 'Escape') { e.preventDefault(); if (z) return z.remove(); if (MR.mode) { MR.mode = null; const b = MR.el.querySelector('[data-mr-m]'); if (b) b.innerHTML = ''; return; } return mrFermer(); }
    if (z) return;
    const t = e.target, champ = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (champ) return;
    const k = e.key.toLowerCase();
    if (MR.mode && /^[1-9]$/.test(k)) { const b = MR.el.querySelectorAll('[data-mr-mo]')[+k - 1]; if (b) { e.preventDefault(); b.click(); } return; }
    if (MR.mode && e.key === 'Enter') { e.preventDefault(); return mrValiderMotif(); }
    if (MR.arme && e.key === 'Enter') { e.preventDefault(); return mrAction('verifie'); }
    if (k === 'v') { e.preventDefault(); mrAction('verifie'); }
    else if (k === 'r') { e.preventDefault(); mrAction('refuse'); }
    else if (k === 'p') { e.preventDefault(); mrAction('verification_manuelle'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); mrAller(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); mrAller(-1); }
  }
  function listeAnnonces(A) {
    if (!A.length) return `<div class="list"><div class="empty"><b>Aucune annonce</b>${filt.q || filt.type !== 'tout' || filt.statut !== 'tout' ? 'Aucune annonce ne correspond à ces filtres.' : 'Les annonces publiées apparaîtront ici.'}</div></div>`;
    const S = Object.fromEntries(signalesParCible().map(s => [s.cible + ':' + s.id, s]));
    return `<div class="list">${A.slice(0, showN).map(a => rowAnnonce(a, S[a.kind + ':' + a.id])).join('')}${A.length > showN ? `<button class="more" data-more>Afficher plus (${A.length - showN} restantes)</button>` : ''}</div>`;
  }
  function rowAnnonce(a, s) {
    const hidden = a.status !== 'active';
    return `<div class="row${hidden ? ' is-hidden' : ''}"><span class="mk ${a.kind === 'offre' ? 'o' : 'd'}${hidden ? ' off' : ''}" title="${a.kind}"></span>
      <div><b>${esc(nom(a))}${a.quantity ? ' · ' + fmt(a.quantity) + ' ' + esc(a.unit || '') : ''}</b><small>${esc(lieu(a) || '—')} · ${esc(prix(a))}</small></div>
      <div class="c3"><small>${esc(qui(a))}${a.phone ? ' · ' + esc(fmtTel(a.phone)) : ''}</small><small>compte ${esc(tel(a.user_id) || '—')} · ${ago(a.created_at)}</small></div>
      <div class="c4">${hidden ? '<span class="tag bad">masquée</span> ' : ''}${s ? `<span class="tag acc">${s.n} signalement${s.n > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="acts">${hidden ? `<button class="btn sm" data-act="active" data-k="${a.k}" data-id="${a.id}">Rétablir</button>` : `<button class="btn sm" data-act="masquee" data-k="${a.k}" data-id="${a.id}">Masquer</button>`}<button class="btn sm bad" data-act="supprimer" data-k="${a.k}" data-id="${a.id}">Supprimer</button></div>
      ${s && s.motifs.length ? `<div class="motifs">${s.motifs.slice(0, 6).map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}</div>`;
  }

  /* ——— actions ——— */
  function bind() {
    const $$ = q => root.querySelectorAll(q);
    $$('[data-ecrire]').forEach(b => b.onclick = () => MDGMessages.ecrire(b.dataset.ecrire, { nom: 'Membre' }));
    bindIdent(root);
    if (!VIEWS[view] && EXT[view] && EXT[view].lier) EXT[view].lier(root, H);
    $$('[data-vu]').forEach(b => b.onclick = async () => { b.disabled = true; try { await N.api('/rest/v1/alertes?id=eq.' + b.dataset.vu, { method: 'PATCH', auth: true, body: { vu: true }, prefer: 'return=minimal' }); const a = D.alertes.find(x => x.id === b.dataset.vu); if (a) a.vu = true; paint(); } catch (e) { b.disabled = false; toast('Impossible : ' + e.message); } });
    const dg = root.querySelector('[data-difgo]'); if (dg) dg.onclick = async () => { const ta = root.querySelector('[data-dif]'), t = ta.value.trim(); if (!t) return toast('Écrivez d’abord le message.'); if (!confirm('Envoyer ce message à tous les membres ?')) return; dg.disabled = true;
      try { const n = await N.rpc('admin_diffuser', { p_texte: t }); ta.value = ''; toast('Message envoyé à ' + n + ' membre(s).'); await load(); paint(); } catch (e) { dg.disabled = false; toast('Envoi impossible : ' + e.message); } };
    $$('[data-lire]').forEach(b => b.onclick = async () => {
      const row = root.querySelector(`[data-row="${b.dataset.lire}"]`) || b.closest('.row'), next = row.nextElementSibling;
      if (next && next.classList.contains('fil')) { next.remove(); return; }
      try {
        const M = await N.rpc('admin_dm', { p_discussion: b.dataset.lire }) || [], d = D.discussions.find(x => x.id === b.dataset.lire);
        const el = document.createElement('div'); el.className = 'fil';
        el.innerHTML = M.length ? M.map(m => `<div class="${d && m.auteur_id === d.a_id ? '' : 'p'}"><em>${esc(d ? (m.auteur_id === d.a_id ? d.a_nom : d.b_nom) : '')} · ${esc(tel(m.auteur_id))} · ${ago(m.created_at)}</em>${esc(m.texte)}</div>`).join('') : '<div>Aucun message (effacés après 7 jours).</div>';
        row.after(el);
      } catch (e) { toast('Lecture impossible : ' + e.message); }
    });
    $$('[data-reload]').forEach(b => b.onclick = async () => { b.disabled = true; await load(); paint(); toast('Données actualisées.'); });
    $$('[data-f]').forEach(b => b.onclick = () => { filt[b.dataset.f] = b.dataset.v; showN = 40; paint(); });
    const s = root.querySelector('.search'); if (s) s.oninput = () => { filt.q = s.value; showN = 40; const pos = s.selectionStart; paint(); const n = root.querySelector('.search'); n.focus(); n.setSelectionRange(pos, pos); };
    $$('[data-more]').forEach(b => b.onclick = () => { showN += 40; paint(); });
    $$('[data-clearuser]').forEach(b => b.onclick = () => { delete filt.user; paint(); });
    $$('[data-voir]').forEach(b => b.onclick = () => { filt = { type: 'tout', statut: 'tout', q: '', user: b.dataset.voir }; location.hash = 'annonces'; });
    $$('[data-act]').forEach(b => b.onclick = async () => {
      const { act, k, id } = b.dataset;
      if (act === 'supprimer' && !confirm('Supprimer définitivement cette annonce ? Les négociations liées restent lisibles ici.')) return;
      b.disabled = true;
      try {
        if (act === 'supprimer') await N.api('/rest/v1/' + k + '?id=eq.' + id, { method: 'DELETE', auth: true });
        else {
          await N.api('/rest/v1/' + k + '?id=eq.' + id, { method: 'PATCH', auth: true, body: { status: act }, prefer: 'return=minimal' });
          // rétablie : on repart de zéro (sinon le prochain signalement la masquerait de nouveau)
          if (act === 'active') await N.api('/rest/v1/signalements?cible=eq.' + (k === 'offres' ? 'offre' : 'demande') + '&cible_id=eq.' + id, { method: 'DELETE', auth: true }).catch(() => {});
        }
        await load(); paint(); toast(act === 'supprimer' ? 'Annonce supprimée.' : act === 'active' ? 'Annonce rétablie.' : 'Annonce masquée.');
      } catch (e) { b.disabled = false; toast('Action impossible : ' + e.message); }
    });
    $$('[data-bannir]').forEach(b => b.onclick = () => bannir(b.dataset.bannir));
    $$('[data-sigvoir]').forEach(b => b.onclick = () => sigExaminer(b.dataset.sigvoir, b.closest('.row')));
    $$('[data-sigtout]').forEach(b => b.onclick = async () => { b.disabled = true; try { await N.rpc('admin_signalements_cible_traites', { p_cible: b.dataset.sigtout }); await load(); paint(); toast('Signalements marqués traités.'); } catch (e) { b.disabled = false; toast('Impossible : ' + e.message); } });
    $$('[data-sigok]').forEach(b => b.onclick = async () => { b.disabled = true; try { await N.rpc('admin_signalement_membre_traite', { p_id: b.dataset.sigok }); const x = D.sigm.find(y => y.id === b.dataset.sigok); if (x) x.traite = true; paint(); } catch (e) { b.disabled = false; toast('Impossible : ' + e.message); } });
    $$('[data-deban]').forEach(b => b.onclick = () => lever(b.dataset.deban));
    $$('[data-code]').forEach(b => b.onclick = async () => {
      const c = prompt('Nouveau code secret à 6 chiffres pour le ' + fmtTel(String(b.dataset.tel).replace(/^225/, '')) + ' :\n(Communiquez-le à la personne par téléphone, de vive voix.)');
      if (c == null) return; if (!/^\d{6}$/.test(c.trim())) return toast('Le code doit faire 6 chiffres.');
      try { await N.rpc('admin_reinitialiser', { compte: b.dataset.code, nouveau: c.trim() }); toast('Nouveau code enregistré. Les connexions ouvertes de ce compte sont fermées.'); }
      catch (e) { toast(/admin_reinitialiser|schema cache|Could not find/i.test(e.message) ? 'Fonction pas encore installée : lancez supabase/a-lancer-dans-sql-editor.sql.' : 'Impossible : ' + e.message); }
    });
    $$('[data-fil]').forEach(b => b.onclick = async () => {
      const row = root.querySelector(`[data-row="${b.dataset.fil}"]`), next = row.nextElementSibling;
      if (next && next.classList.contains('fil')) { next.remove(); return; }
      const n = D.negos.find(x => x.id === b.dataset.fil);
      try {
        const M = await N.api('/rest/v1/messages?select=*&negociation_id=eq.' + n.id + '&order=created_at.asc', { auth: true });
        const role = u => u === n.proprio_id ? (n.cible === 'offre' ? 'vendeur' : 'acheteur') : (n.cible === 'offre' ? 'acheteur' : 'vendeur');
        const lab = { texte: '', prix: 'propose ', accord: 'accepte ', refus: 'refuse ', retrait: 'retire sa proposition ', fin: 'arrête la négociation' };
        const el = document.createElement('div'); el.className = 'fil';
        el.innerHTML = M.length ? M.map(m => `<div class="${m.auteur_id === n.proprio_id ? '' : 'p'}"><em>${role(m.auteur_id)} · ${esc(tel(m.auteur_id))} · ${ago(m.created_at)}</em>${lab[m.genre]}${m.prix ? '<b>' + fmt(m.prix) + ' F' + (m.quantite ? ' × ' + fmt(m.quantite) : '') + '</b>' : ''}${m.issue && m.genre === 'prix' ? ' <span class="tag">' + ({ en_attente: 'en attente', acceptee: 'acceptée', refusee: 'refusée', retiree: 'retirée', remplacee: 'remplacée', expiree: 'expirée' }[m.issue] || '') + '</span>' : ''}${m.texte ? (m.prix ? ' — ' : '') + esc(m.texte) : ''}</div>`).join('') : '<div>Aucun message.</div>';
        row.after(el);
      } catch (e) { toast('Lecture impossible : ' + e.message); }
    });
  }

  addEventListener('hashchange', () => { view = location.hash.slice(1) || 'apercu'; showN = 40; if (root.querySelector('.app')) { paint(); scrollTo(0, 0); } });
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte') start(); });
  start();
})();
