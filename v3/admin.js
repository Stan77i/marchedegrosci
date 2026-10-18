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
  const D = { offres: [], demandes: [], signalements: [], comptes: [], negos: [], alertes: [], discussions: [], ident: [], err: {} };
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
  const ico = k => { const L = window.MDGIco && LUC[k] && window.MDGIco.corps(LUC[k]);
    return L ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${L}</svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${ICO[k]}</svg>`; };
  let toastT = 0;
  function toast(m) { let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = m; el.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { el.style.opacity = '0'; }, 4000); }

  /* ——— porte d'entrée ——— */
  const logo = window.MDGMarque ? MDGMarque.empile({ fond: 'vert', h: 64 }).replace('style="', 'style="margin:0 auto 6px;') : '';
  function gate(t, p, btn) {
    root.innerHTML = `<div class="gate"><div class="card">${logo}<h1>${t}</h1><p>${p}</p>${btn || ''}<p style="margin-top:22px"><a href="./" style="color:var(--mute)">Retour au Marché de Gros</a></p></div></div>`;
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
      N.rpc('admin_identite_file').then(r => { D.ident = r || []; delete D.err.identites; }).catch(e => { D.ident = []; if (!/admin_identite_file|schema cache|Could not find/i.test(e.message)) D.err.identites = e.message; else D.identAbsent = true; })
    ]);
    D.byUser = Object.fromEntries(D.comptes.map(c => [c.id, c]));
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
      <a class="brand" href="#apercu">${logo.replace('width="56" height="56"', 'width="34" height="34"')}<span><b>Marché de Gros</b><small>Tableau de bord</small></span></a>
      ${nav('apercu', 'Aperçu')}${nav('traiter', 'À traiter', toDo)}${nav('annonces', 'Annonces')}${nav('comptes', 'Comptes')}${nav('negos', 'Négociations')}${nav('messages', 'Messages', D.alertes.filter(a => !a.vu).length)}${nav('identites', 'Identités', D.ident.filter(v => v.statut === 'en_attente').length)}
      <span class="sp"></span><a class="nav ext" href="./">${ico('site')}<span>Voir le site</span></a>
      <div class="who">Connecté en administrateur<b>${esc(fmtTel(N.session().user.tel))}</b></div></nav>
      <main id="main">${(VIEWS[view] || VIEWS.apercu)({ T, masq, toDo, conclu })}</main></div>`;
    bind();
  }
  const errBox = () => { const e = Object.entries(D.err); return e.length ? `<p class="tag bad" style="display:block;padding:10px 14px;border-radius:14px;margin:0 0 18px">Lecture incomplète : ${e.map(([k, m]) => esc(k + ' — ' + m)).join(' ; ')}${D.err.comptes ? '. La liste des comptes demande le fichier supabase/a-lancer-dans-sql-editor.sql.' : ''}</p>` : ''; };
  const top = (t, p, extra) => `<div class="top"><div><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}</div><div style="display:flex;gap:8px">${extra || ''}<button class="btn" data-reload>Actualiser</button></div></div>${errBox()}`;

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
      return top('Aperçu', 'Ce qui se passe sur le Marché de Gros, compté sur les données réelles.') + `
      <section class="pouls"><div><h2>Le pouls du marché</h2><p class="sub">Annonces publiées ces 14 derniers jours.</p>${pouls()}</div>
        <div class="chiffres">
          <div class="ch"><b>${fmt(act.filter(a => a.kind === 'offre').length)}</b><span>offres en ligne</span></div>
          <div class="ch"><b>${fmt(act.filter(a => a.kind === 'demande').length)}</b><span>demandes en ligne</span></div>
          <div class="ch"><b>${D.err.comptes ? '—' : fmt(D.comptes.length)}</b><span>comptes${auj ? ' · ' + auj + ' cette semaine' : ''}</span></div>
          <div class="ch${toDo ? ' alert' : ''}"><b>${fmt(toDo)}</b><span>à traiter</span></div>
          <div class="ch"><b>${fmt(D.negos.filter(n => n.statut === 'ouverte').length)}</b><span>négociations en cours</span></div>
          <div class="ch"><b>${fmt(conclu)}</b><span>accords${r ? ' · écart moyen ' + r : ''}</span></div>
        </div></section>
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
        <div class="list" style="padding:16px 18px;display:flex;flex-direction:column;gap:12px"><textarea data-dif maxlength="2000" rows="4" placeholder="Bonjour, …" aria-label="Message à tous les membres" style="width:100%;box-sizing:border-box;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:#14120f;color:var(--ink);font:400 15px/1.45 Jost,sans-serif;resize:vertical"></textarea>
        <div style="display:flex;justify-content:flex-end"><button class="btn pri" data-difgo>Envoyer à tous</button></div></div></section>
      <section class="sec"><div class="sec-h"><h2>Alertes : sortie de l’application</h2><p>${nv ? nv + ' nouvelle' + (nv > 1 ? 's' : '') + '. ' : ''}Numéro, WhatsApp, autre messagerie ou lien écrit dans un message. Le numéro est masqué pour l’autre personne.</p></div>
        <div class="list">${D.err.alertes ? '<div class="empty"><b>Alertes indisponibles</b>' + esc(D.err.alertes) + '</div>' : D.alertes.length ? D.alertes.map(a => `
          <div class="row${a.vu ? ' is-hidden' : ''}"><span class="mk ${a.vu ? 'off' : 'd'}" style="background:${a.vu ? '' : '#E2735B'}"></span>
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
  // ——— identités : dossiers à examiner (supabase/schema-13-identite.sql). Personne n'est « vérifié » sans décision ici. ———
  const PIECE = { cni: 'Carte nationale d’identité', passeport: 'Passeport', carte_consulaire: 'Carte consulaire', permis: 'Permis de conduire' };
  VIEWS.identites = () => {
    const att = D.ident.filter(v => v.statut === 'en_attente'), rev = D.ident.filter(v => v.statut === 'verification_manuelle');
    const carte = v => `<div class="row" data-row="${v.id}"><span class="mk ${v.statut === 'en_attente' ? 'd' : 'off'}"></span>
        <div><b>${esc(v.nom_saisi || '—')}</b><small>${esc(PIECE[v.piece] || v.piece)} · envoyé ${ago(v.soumis_le)}${v.essais > 1 ? ' · ' + v.essais + 'e envoi' : ''}</small></div>
        <div class="c3"><small>Compte ${esc(fmtTel(String(v.tel || '').replace(/^225/, '')))} · inscrit le ${date(v.membre_depuis)}</small><small>Profil : ${esc(v.profil_pseudo || v.profil_nom || '—')}</small></div>
        <div class="c4">${v.statut === 'en_attente' ? (v.mrz_ok ? '<span class="tag ok">bande MRZ lisible</span>' : v.nom_lu ? '<span class="tag acc">MRZ douteuse</span>' : '<span class="tag">MRZ non lue</span>') : '<span class="tag acc">photos demandées</span>'}${v.nom_banni ? ' <span class="tag bad" title="Une personne bannie a été vérifiée sous ce nom">nom déjà banni</span>' : ''}</div>
        <div class="acts">${v.statut === 'en_attente' ? `<button class="btn sm pri" data-idv="${v.id}">Examiner</button>` : `<button class="btn sm bad" data-iddec="refuse" data-id="${v.id}">Refuser</button>`}</div></div>`;
    return top('Identités', 'Comparez la pièce, le selfie et le code écrit à la main, puis décidez. Les photos sont effacées après chaque décision.') + (D.identAbsent ? `<div class="list"><div class="empty"><b>Pas encore installé</b>Lancez supabase/schema-13-identite.sql dans l’éditeur SQL de Supabase.</div></div>` : `
      <section class="sec"><div class="sec-h"><h2>À examiner</h2><p>${att.length} dossier${att.length > 1 ? 's' : ''}, le plus ancien en premier.</p></div>
        <div class="list">${att.length ? att.map(carte).join('') : '<div class="empty"><b>Rien à examiner</b>Les dossiers envoyés apparaîtront ici.</div>'}</div></section>
      ${rev.length ? `<section class="sec"><div class="sec-h"><h2>En attente de nouvelles photos</h2><p>Vous avez demandé de refaire des photos ; le membre peut renvoyer son dossier.</p></div><div class="list">${rev.map(carte).join('')}</div></section>` : ''}
      <p style="color:var(--faint);font-size:13px;max-width:70ch">La lecture de la bande MRZ est faite dans le téléphone du membre : c’est une indication, pas une preuve. Vérifiez vous-même que la photo de la pièce et le selfie montrent la même personne, que le code écrit est bien <b>le code affiché</b> et que le nom correspond.</p>`);
  };
  async function examiner(id, row) {
    const next = row.nextElementSibling; if (next && next.classList.contains('fil')) { next.remove(); return; }
    const v = D.ident.find(x => x.id === id); if (!v) return;
    const el = document.createElement('div'); el.className = 'fil idx'; el.innerHTML = '<div>Chargement des photos…</div>'; row.after(el);
    const noms = v.piece === 'passeport' ? ['recto', 'selfie'] : ['recto', 'verso', 'selfie'];
    const L = await Promise.all(noms.map(n => N.lienSigne('identite', v.dossier + '/' + n + '.jpg', 120).catch(() => null)));
    if (!el.isConnected) return;
    const lab = { recto: 'Pièce, recto', verso: 'Pièce, verso', selfie: 'Selfie avec le code' };
    el.innerHTML = `<div class="idx-ph">${noms.map((n, i) => `<figure><figcaption>${lab[n]}</figcaption>${L[i] ? `<a href="${esc(L[i])}" target="_blank" rel="noopener noreferrer"><img src="${esc(L[i])}" alt="${lab[n]}" referrerpolicy="no-referrer"></a>` : '<p>Photo introuvable</p>'}</figure>`).join('')}</div>
      <div class="idx-info"><p>Code que le membre devait écrire : <b class="idx-code">${esc(v.defi)}</b></p>
        <p>Nom saisi : <b>${esc(v.nom_saisi || '—')}</b>${v.nom_lu ? ` · lu sur la bande MRZ : <b>${esc(v.nom_lu)}</b> ${v.mrz_ok ? '(chiffres de contrôle justes)' : '(lecture douteuse)'}` : ' · bande MRZ non lue'}</p>
        <label>Nom retenu (si vous le corrigez) <input class="search" data-idnom value="${esc(v.nom_saisi || '')}" maxlength="120" style="width:100%;margin-top:6px"></label>
        <div class="acts" style="justify-content:flex-start"><button class="btn pri" data-iddec="verifie" data-id="${v.id}">Identité vérifiée</button><button class="btn" data-iddec="verification_manuelle" data-id="${v.id}">Photos à refaire</button><button class="btn bad" data-iddec="refuse" data-id="${v.id}">Refuser</button></div>
        <p style="color:var(--faint);font-size:12.5px">Les liens des photos expirent après deux minutes. Rien n’est téléchargé sur cet ordinateur.</p></div>`;
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
    if (st === 'verifie') { if (!confirm('Confirmer : la pièce, le selfie et le code concordent, et l’identité de ' + (v.nom_saisi || 'ce membre') + ' est vérifiée ?')) return; }
    else { motif = prompt(st === 'refuse' ? 'Motif du refus (le membre le lira) :' : 'Qu’est-ce que le membre doit refaire ? (il le lira)'); if (motif == null) return; if (!motif.trim()) return toast('Indiquez le motif.'); }
    const box = b.closest('.fil'), nomIn = box && box.querySelector('[data-idnom]');
    b.disabled = true;
    try {
      await N.rpc('admin_identite_decider', { p_id: v.id, p_statut: st, p_motif: motif, p_nom: nomIn ? nomIn.value.trim() || null : null });
      // les photos ne servent plus : on les efface tout de suite (conservation minimale)
      let efface = false;
      try { await N.effacerPrive('identite', ['recto', 'verso', 'selfie'].map(n => v.dossier + '/' + n + '.jpg')); await N.rpc('admin_identite_photos_effacees', { p_id: v.id }); efface = true; } catch (_) {}
      await load(); paint();
      toast((st === 'verifie' ? 'Identité vérifiée : le badge apparaît.' : st === 'refuse' ? 'Dossier refusé.' : 'Le membre est prévenu qu’il doit refaire des photos.') + (efface ? ' Photos effacées.' : ' Attention : les photos n’ont pas pu être effacées.'));
    } catch (e) { b.disabled = false; toast('Décision impossible : ' + e.message); }
  }
  function bindIdent(r) {
    r.querySelectorAll('[data-idv]').forEach(b => b.onclick = () => examiner(b.dataset.idv, b.closest('.row')));
    r.querySelectorAll('[data-iddec]').forEach(b => b.onclick = () => decider(b));
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
