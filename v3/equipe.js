/* ═════════ Marché de Gros CI : Espace équipe dans l'application (refonte 2026-11, lot 14) ═════════
   D'après la maquette « MGCI App v2 » de Claude Design (section 5.14) : 7 onglets (Identités, Litiges, Signalements, Comptes,
   Commissions, Diffusion, Journal). Branché sur les mêmes fonctions du serveur que admin.html (v3/admin.js, v3/admin-transport.js,
   v3/admin-fiabilite.js), avec les mêmes paramètres. admin.html garde les vues complètes (transport, niveaux, mesures…).
   • L'accès est vérifié par le serveur (est_admin) avant d'afficher quoi que ce soit ; chaque fonction le vérifie encore.
   • Chaque geste demande un motif : le serveur l'écrit dans admin_journal (schéma 100c).
   • Commissions : seulement « calculée », jamais encaissée, jamais réclamée. Aucun paiement n'est branché.
   API : MDGEquipe.ouvrir({ onglet }) */
(function () {
  'use strict';
  const N = () => window.MDGNuage;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null || isNaN(n) ? '—' : Math.round(+n).toLocaleString('fr-FR').replace(/\s/g, ' ');
  const tel = t => String(t || '').replace(/^225/, '').replace(/(\d{2})(?=\d)/g, '$1 ');
  const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const heure = t => jour(t) + ' · ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const ago = t => { if (!t) return ''; const m = Math.max(0, (Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + Math.round(m) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'le ' + jour(t); };
  const dire = m => { const n = N(); if (n && n.toast) n.toast(m); };
  const ERR = e => window.MDGErreur ? MDGErreur(e) : String((e && e.message) || e || 'Impossible pour l’instant.');
  const rpc = (f, a) => N().rpc(f, a);
  const absente = e => /schema cache|Could not find|PGRST202/i.test(String(e && e.message));
  const PIECE = { cni: 'Carte d’identité', passeport: 'Passeport', carte_consulaire: 'Carte consulaire', permis: 'Permis de conduire' };
  const RETOUR = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const ONGLETS = [['id', 'Identités'], ['lit', 'Litiges'], ['sig', 'Signalements'], ['cpt', 'Comptes'], ['com', 'Commissions'], ['diff', 'Diffusion'], ['jour', 'Journal']];

  let bg = null, S = null;
  const neuf = () => ({ tab: 'id', pret: false, D: {}, err: {}, fait: {}, photos: {}, lit: {}, cptQ: '', cptN: 30, diff: '' });

  /* ——— lecture : chaque partie a son erreur, rien n'empêche le reste ——— */
  const lire = (k, p) => p.then(r => { S.D[k] = r; delete S.err[k]; }).catch(e => { S.err[k] = ERR(e); });
  function charger() {
    const ann = async () => {
      const [sg, mq] = await Promise.all([N().api('/rest/v1/signalements?select=cible,cible_id,motif,user_id,created_at&traite=eq.false&order=created_at.desc&limit=500', { auth: true }), rpc('admin_masquages')]);
      const caches = new Set((mq || []).map(m => m.cible + ':' + m.cible_id)), G = {};
      (sg || []).forEach(s => { const k = s.cible + ':' + s.cible_id; if (caches.has(k)) return; (G[k] = G[k] || { cible: s.cible, id: s.cible_id, n: 0, motifs: [] }).n++; if (s.motif && G[k].motifs.length < 3) G[k].motifs.push(s.motif); });
      const ids = c => Object.values(G).filter(g => g.cible === c).map(g => g.id);
      const get = (t, L) => L.length ? N().api('/rest/v1/' + t + '?select=id,product_label,product_slug,city,status&id=in.(' + L.join(',') + ')', { auth: true }) : Promise.resolve([]);
      const [o, d] = await Promise.all([get('offres', ids('offre')), get('demandes', ids('demande'))]);
      const A = {}; (o || []).forEach(x => { A['offre:' + x.id] = x; }); (d || []).forEach(x => { A['demande:' + x.id] = x; });
      return { masq: mq || [], actives: Object.values(G).map(g => Object.assign(g, { a: A[g.cible + ':' + g.id] })).filter(g => g.a && g.a.status === 'active').sort((x, y) => y.n - x.n) };
    };
    return Promise.all([
      lire('ident', rpc('admin_identite_dossiers').catch(e => absente(e) ? rpc('admin_identite_file') : Promise.reject(e))),
      lire('cmd', rpc('admin_commandes', { p_vue: 'a_traiter' })),
      lire('sig', ann()),
      lire('cpt', rpc('admin_comptes')),
      lire('fiab', rpc('admin_fiabilite')),
      lire('com', rpc('admin_commissions'))
    ]);
  }
  const lireJournal = () => lire('jour', N().api('/rest/v1/admin_journal?select=id,at,admin_id,action,cible_id,motif,detail&order=at.desc&limit=100', { auth: true })).then(() => { if (S.tab === 'jour') corps(); });

  /* ——— ce qui reste à traiter (les nombres des onglets) ——— */
  const idents = () => (S.D.ident || []).filter(v => v.statut === 'en_attente');
  const litiges = () => (S.D.cmd || []).filter(c => c.etat === 'litige');
  const sigs = () => S.D.sig ? S.D.sig.masq.map(m => Object.assign({ k: 'm:' + m.cible_id }, m)).concat(S.D.sig.actives.map(g => Object.assign({ k: 'a:' + g.id }, g))) : [];
  const nombre = id => id === 'id' ? idents().filter(v => !S.fait['id:' + v.id]).length : id === 'lit' ? litiges().filter(c => !S.fait['lit:' + c.id]).length : id === 'sig' ? sigs().filter(x => !S.fait['sig:' + x.k]).length : 0;

  /* ——— le cadre ——— */
  function ouvrir(opts) {
    opts = opts || {}; const n = N(); if (!n) return;
    if (!n.session()) return n.open ? n.open() : null;
    fermer(true); S = neuf(); if (opts.onglet && ONGLETS.some(o => o[0] === opts.onglet)) S.tab = opts.onglet;
    S.depuis = opts.depuis || '';
    bg = document.createElement('div'); bg.className = 'eq-bg'; bg.setAttribute('data-v2', '');
    bg.innerHTML = `<div class="eq" role="dialog" aria-modal="true" aria-labelledby="eqT">
      <div class="eq-top"><button type="button" class="eq-back" data-retour aria-label="Retour au compte">${RETOUR}</button><span aria-hidden="true">Compte</span></div>
      <div class="eq-main"><h1 class="eq-h1" id="eqT" tabindex="-1">Espace équipe</h1><p class="eq-sous">Chaque geste est noté : qui, quand, pourquoi.</p>
      <div data-zone><p class="eq-vide" role="status">Vérification de l’accès…</p></div></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector('[data-retour]').onclick = () => fermer();
    document.addEventListener('keydown', cle);
    // la barre d'onglets reste visible, « Compte » allumé ; un onglet touché ferme l'espace équipe
    if (window.MDGOnglets && MDGOnglets.montrer) try { MDGOnglets.montrer('compte', () => fermer(true)); } catch (_) {}
    bg.querySelector('h1').focus({ preventScroll: true });
    const moi = S;
    rpc('est_admin').then(async a => {
      if (S !== moi) return;
      if (!a) return zone(`<p class="eq-vide">Accès réservé à l’équipe.</p>`);
      zone(`<p class="eq-vide" role="status">Chargement…</p>`);
      await charger(); if (S !== moi) return;
      S.pret = true; dessiner();
      if (S.tab === 'jour') lireJournal();
    }).catch(e => { if (S === moi) zone(`<p class="eq-vide">Vérification impossible : ${esc(ERR(e))}</p><button type="button" class="eq-cont" data-re>Réessayer</button>`, z => { z.querySelector('[data-re]').onclick = () => ouvrir(opts); }); });
  }
  function fermer(calme) {
    document.removeEventListener('keydown', cle);
    if (bg) { bg.remove(); bg = null; if (!calme && window.MDGOnglets && MDGOnglets.cacher) try { MDGOnglets.cacher(); } catch (_) {} }
    if (!calme && S && S.depuis !== 'compte' && window.MDGCompte && MDGCompte.ouvrir && !document.querySelector('.cp-bg')) MDGCompte.ouvrir('accueil');
    if (!calme) S = null;
  }
  function cle(e) { if (e.key === 'Escape' && bg && !document.querySelector('.eq-fbg, .dq-bg')) fermer(); }
  const zone = (h, f) => { const z = bg && bg.querySelector('[data-zone]'); if (!z) return; z.innerHTML = h; if (f) f(z); };

  function dessiner() {
    zone(`<div class="eq-tabs" role="tablist" aria-label="Rubriques"></div><div class="eq-corps" role="tabpanel"></div>
      <a class="eq-tout" href="admin.html">Ouvrir le tableau complet</a>`);
    onglets(); corps();
  }
  function onglets() {
    const b = bg && bg.querySelector('.eq-tabs'); if (!b) return; const x = b.scrollLeft;
    b.innerHTML = ONGLETS.map(([id, l]) => { const n = nombre(id), on = S.tab === id;
      return `<button type="button" role="tab" aria-selected="${on}" data-tab="${id}">${l}${n ? `<span class="eq-n" aria-label="${n} à traiter">${n}</span>` : ''}</button>`; }).join('');
    b.scrollLeft = x;
    if (!b.dataset.vu) { b.dataset.vu = '1'; const a = b.querySelector('[aria-selected=true]'); if (a && a.offsetLeft + a.offsetWidth > b.clientWidth) b.scrollLeft = a.offsetLeft - 8; }
    b.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { if (S.tab === t.dataset.tab) return; S.tab = t.dataset.tab; onglets(); corps(); if (S.tab === 'jour') lireJournal(); });
  }
  function corps() {
    const c = bg && bg.querySelector('.eq-corps'); if (!c) return;
    c.innerHTML = VUES[S.tab](); const f = LIENS[S.tab]; if (f) f(c);
  }
  const majCarte = () => { onglets(); const m = bg && bg.querySelector('.eq-main'), y = m ? m.scrollTop : 0; corps(); if (m) m.scrollTop = y; };
  const erreur = k => S.err[k] ? `<p class="eq-vide">Lecture impossible : ${esc(S.err[k])}</p>` : '';
  const vide = t => `<p class="eq-vide">${t}</p>`;

  /* ——— une petite feuille avec des champs (motif, code, date), comme MDGDemande, dans les couleurs de l'écran ——— */
  function feuille(titre, champs, o) {
    o = o || {};
    return new Promise(res => {
      const f = document.createElement('div'); f.className = 'eq-fbg'; f.setAttribute('data-v2', '');
      f.innerHTML = `<form class="eq-f" role="dialog" aria-modal="true" aria-labelledby="eqFt" novalidate><p id="eqFt" class="eq-ft">${esc(titre)}</p>${champs}
        <p class="eq-ferr" role="alert"></p><div class="eq-duo"><button type="button" class="eq-disc" data-non>Annuler</button><button type="submit" class="eq-go${o.danger ? ' danger' : ''}">${esc(o.ok || 'Confirmer')}</button></div></form>`;
      const retour = document.activeElement, fin = v => { document.removeEventListener('keydown', k, true); f.remove(); if (retour && retour.focus) retour.focus({ preventScroll: true }); res(v); };
      const k = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(null); } };
      document.addEventListener('keydown', k, true);
      f.addEventListener('click', e => { if (e.target === f) fin(null); });
      f.querySelector('[data-non]').onclick = () => fin(null);
      const fo = f.querySelector('form');
      fo.onsubmit = e => { e.preventDefault(); const v = {}; [...fo.elements].forEach(x => { if (x.name) v[x.name] = x.type === 'checkbox' ? x.checked : x.type === 'radio' ? (x.checked ? x.value : v[x.name]) : x.value.trim(); });
        const m = o.valider ? o.valider(v) : ''; if (m) { fo.querySelector('.eq-ferr').textContent = m; return; } fin(v); };
      document.body.appendChild(f);
      (fo.querySelector('input:not([type=radio]), textarea, input') || fo.querySelector('[type=submit]')).focus({ preventScroll: true });
    });
  }
  const motif = (titre, o) => feuille(titre, `<textarea name="m" maxlength="300" rows="3" aria-labelledby="eqFt" placeholder="${esc((o && o.ph) || 'En une phrase')}"></textarea>`,
    Object.assign({ valider: v => v.m.length < 5 ? 'Écrivez la raison en une phrase.' : '' }, o)).then(v => v && v.m);
  // un geste : bouton occupé, réponse du serveur, puis seulement le résultat
  async function geste(b, f, ok) {
    if (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); }
    try { const r = await f(); if (ok) ok(r); majCarte(); return true; }
    catch (e) { if (b && b.isConnected) { b.disabled = false; b.removeAttribute('aria-busy'); } dire('Impossible : ' + ERR(e)); return false; }
  }

  /* ——— 1. Identités ——— */
  const VUES = {}, LIENS = {};
  VUES.id = () => {
    if (S.err.ident) return erreur('ident'); const L = idents();
    if (!L.length) return vide('Aucun dossier à examiner.');
    return `<div class="eq-l">${L.map(v => { const f = S.fait['id:' + v.id], ph = S.photos[v.id];
      const cas = (n, l) => ph && ph[n] ? `<a class="eq-ph" href="${esc(ph[n])}" target="_blank" rel="noopener noreferrer"><img src="${esc(ph[n])}" alt="${l}" referrerpolicy="no-referrer"></a>` : `<button type="button" class="eq-ph vide" data-voir="${v.id}">${l}<small>${ph ? 'Photo introuvable' : 'Toucher pour voir'}</small></button>`;
      return `<div class="eq-c"><div class="eq-tt"><b>${esc(v.nom_saisi || v.profil_pseudo || v.profil_nom || 'Membre')}</b><small>${esc(PIECE[v.piece] || v.piece || 'Pièce')} · envoyé ${ago(v.soumis_le)}${v.tel ? ' · ' + esc(tel(v.tel)) : ''}</small></div>
        <div class="eq-g2">${cas('recto', 'Pièce')}${cas('selfie', 'Visage')}</div>
        ${ph ? `<p class="eq-txt">Code écrit sur la photo du visage : <b class="eq-code">${esc(v.defi || '—')}</b>${v.nom_banni ? ' · <span class="eq-rouge">nom déjà banni</span>' : ''}</p>` : ''}
        ${f ? `<span class="eq-st ${f[0]}">${esc(f[1])}</span>` : `<div class="eq-duo"><button type="button" class="eq-go m" data-idok="${v.id}">Vérifier</button><button type="button" class="eq-disc" data-idko="${v.id}">Refuser</button></div>`}</div>`; }).join('')}</div>`;
  };
  async function photos(v) {
    // l'ouverture est notée par le serveur (registre des accès) ; les liens expirent après 2 minutes
    try { await rpc('admin_identite_ouvrir', { p_id: v.id, p_motif: 'Examen du dossier' }); } catch (e) { if (!absente(e)) { dire('Impossible d’ouvrir : ' + ERR(e)); return false; } }
    const [r, s] = await Promise.all(['recto', 'selfie'].map(n => N().lienSigne('identite', v.dossier + '/' + n + '.jpg', 120).catch(() => null)));
    S.photos[v.id] = { recto: r, selfie: s }; majCarte(); return true;
  }
  const auj = () => new Date().toISOString().slice(0, 10);
  LIENS.id = c => {
    const V = id => idents().find(x => x.id === id);
    c.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { b.disabled = true; photos(V(b.dataset.voir)).then(ok => { if (!ok && b.isConnected) b.disabled = false; }); });
    c.querySelectorAll('[data-idok]').forEach(b => b.onclick = async () => {
      const v = V(b.dataset.idok); if (!v) return;
      if (!S.photos[v.id]) { if (await photos(v)) dire('Comparez la pièce, le visage et le code, puis vérifiez.'); return; }
      const exp = v.expire_le || v.expire_lu || '';
      const r = await feuille('Identité de ' + (v.nom_saisi || 'ce membre') + ' : la pièce, le visage et le code concordent ?',
        `<label class="eq-lab">Date d’expiration lue sur la pièce<input type="date" name="exp" value="${esc(exp)}" required></label>
         <label class="eq-lab">Numéro de la pièce <i>· facultatif</i><input name="num" maxlength="40" value="${esc(v.numero_lu || '')}" autocapitalize="characters"></label>`,
        { ok: 'Vérifier', valider: x => !x.exp ? 'Indiquez la date d’expiration lue sur la pièce.' : x.exp < auj() ? 'Pièce expirée : refusez avec le motif « pièce expirée ».' : '' });
      if (!r) return;
      geste(b, () => rpc('admin_identite_decider', { p_id: v.id, p_statut: 'verifie', p_motif: null, p_nom: null, p_expire: r.exp, p_numero: r.num || null }), () => { S.fait['id:' + v.id] = ['ok', 'Vérifiée']; });
    });
    c.querySelectorAll('[data-idko]').forEach(b => b.onclick = async () => {
      const v = V(b.dataset.idko); if (!v) return;
      const m = await motif('Motif du refus. Le membre le lira.', { ok: 'Refuser', danger: true, ph: 'Par exemple : photo floue' }); if (!m) return;
      geste(b, () => rpc('admin_identite_decider', { p_id: v.id, p_statut: 'refuse', p_motif: m, p_nom: null, p_expire: v.expire_le || null, p_numero: null }), () => { S.fait['id:' + v.id] = ['ko', 'Refusée : ' + m]; });
    });
  };

  /* ——— 2. Litiges ——— */
  const no = n => String(n || '').replace(/^MDG-C-/, '');
  const qte = (n, u) => n == null ? '' : String(n).replace('.', ',') + (u ? ' ' + u : '');
  VUES.lit = () => {
    if (S.err.cmd) return erreur('cmd'); const L = litiges();
    if (!L.length) return vide('Aucun litige à trancher.');
    return `<div class="eq-l">${L.map(c => {
      const f = S.fait['lit:' + c.id], l = S.lit[c.id] || (S.lit[c.id] = { choix: null, part: 50, perdu: false }), rf = c.refus, nph = rf && rf.photos ? rf.photos.length : 0;
      const h = c.litige_echeance ? (Date.parse(c.litige_echeance) - Date.now()) / 36e5 : null;
      const dit = rf ? `${esc(c.acheteur)} refuse ${rf.quantite != null ? esc(qte(rf.quantite, c.unite)) : 'tout'} : « ${esc(rf.motif || 'sans précision')} »` : `${esc(c.acheteur)} dit « ${esc(c.litige_motif || 'sans précision')} »`;
      const opts = [['acheteur', 'Refus accepté', 'L’acheteur ne paie rien'], ['vendeur', 'Refus rejeté', 'L’acheteur paie tout']].concat(c.quantite != null ? [['partage', 'Partager', 'Chacun une part']] : []);
      const perdu = !rf && (l.choix === 'acheteur' || l.choix === 'vendeur');
      return `<div class="eq-c"><div class="eq-tt"><b>Litige n° ${esc(no(c.numero))} · ${esc(c.produit || 'Commande')}</b>
          <small>${dit}</small><small>Vendeur : ${esc(c.vendeur)}${c.quantite != null ? ' · ' + esc(qte(c.quantite, c.unite)) : ''}${c.montant != null ? ' · ' + fmt(c.montant) + ' F' : ''}</small>
          ${h == null ? '' : h > 0 ? `<small>${Math.max(1, Math.round(h))} h restantes pour trancher.</small>` : '<small class="eq-rouge">Échéance dépassée : à trancher maintenant.</small>'}</div>
        ${nph ? (S.photos['c' + c.id] ? `<div class="eq-g4">${S.photos['c' + c.id].map((u, i) => u ? `<a class="eq-ph" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="Photo ${i + 1} de l’acheteur" referrerpolicy="no-referrer"></a>` : '<span class="eq-ph vide">Introuvable</span>').join('')}</div>` : `<button type="button" class="eq-lien" data-rfph="${c.id}">Voir les photos de l’acheteur <span class="eq-nb">${nph}</span></button>`) : ''}
        ${f ? `<p class="eq-ok">Tranché : ${esc(f)}. Les deux sont prévenus. Le geste est noté au journal.</p>` : `
        <div class="eq-radios" role="radiogroup" aria-label="Décision">${opts.map(([id, t, s]) => `<button type="button" role="radio" aria-checked="${l.choix === id}" data-lch="${c.id}" data-v="${id}"><span class="eq-rb" aria-hidden="true"></span><b>${t}</b><small>${s}</small></button>`).join('')}</div>
        ${l.choix === 'partage' ? `<div class="eq-pas"><button type="button" data-lpm="${c.id}" data-d="-10" aria-label="Moins pour l’acheteur" ${l.part <= 10 ? 'disabled' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
          <span aria-live="polite">${l.part}&nbsp;%&nbsp;acheteur · ${100 - l.part}&nbsp;%&nbsp;vendeur</span><button type="button" data-lpm="${c.id}" data-d="10" aria-label="Plus pour l’acheteur" ${l.part >= 90 ? 'disabled' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button></div>` : ''}
        ${perdu ? `<label class="eq-coche"><input type="checkbox" data-lpd="${c.id}" ${l.perdu ? 'checked' : ''}><span>Compter un litige perdu pour ${l.choix === 'acheteur' ? 'le vendeur' : 'l’acheteur'}</span></label>` : ''}
        <button type="button" class="eq-go" data-ltr="${c.id}" ${l.choix ? '' : 'disabled'}>Trancher</button>`}</div>`; }).join('')}</div>`;
  };
  LIENS.lit = c => {
    const C = id => litiges().find(x => x.id === id);
    c.querySelectorAll('[data-lch]').forEach(b => b.onclick = () => { const l = S.lit[b.dataset.lch]; l.choix = b.dataset.v; l.perdu = false; majCarte(); });
    c.querySelectorAll('[data-lpm]').forEach(b => b.onclick = () => { const l = S.lit[b.dataset.lpm]; l.part = Math.min(90, Math.max(10, l.part + +b.dataset.d)); majCarte(); });
    c.querySelectorAll('[data-lpd]').forEach(i => i.onchange = () => { S.lit[i.dataset.lpd].perdu = i.checked; });
    c.querySelectorAll('[data-rfph]').forEach(b => b.onclick = async () => { const x = C(b.dataset.rfph); b.disabled = true;
      S.photos['c' + x.id] = await Promise.all((x.refus.photos || []).map(p => N().lienSigne('preuves', p, 300).catch(() => null))); majCarte(); });
    c.querySelectorAll('[data-ltr]').forEach(b => b.onclick = async () => {
      const x = C(b.dataset.ltr), l = S.lit[x.id]; if (!x || !l.choix) return;
      const note = await motif('Expliquez la décision. Les deux parties la liront.', { ok: 'Trancher' }); if (!note) return;
      const q = l.choix === 'partage' ? Math.round(x.quantite * l.part) / 100 : null;
      const txt = l.choix === 'acheteur' ? 'refus accepté' : l.choix === 'vendeur' ? 'refus rejeté' : 'partage ' + l.part + ' / ' + (100 - l.part);
      let f;
      // même choix que admin.html (v3/admin-transport.js) : refus de marchandise → admin_refus_trancher (quantité refusée retenue) ;
      // autre litige → admin_litige_clore (annulée ou livrée, partie fautive) ou admin_litige_partager (quantité qui n'est pas due)
      if (x.refus) f = () => rpc('admin_refus_trancher', { p_cmd: x.id, p_quantite: l.choix === 'acheteur' ? (x.quantite != null ? x.quantite : x.refus.quantite) : l.choix === 'vendeur' ? 0 : q, p_note: note });
      else if (l.choix === 'partage') f = () => rpc('admin_litige_partager', { p_cmd: x.id, p_quantite: q, p_note: note });
      else f = () => rpc('admin_litige_clore', { p_cmd: x.id, p_issue: l.choix === 'acheteur' ? 'annulee' : 'terminee', p_note: note, p_fautif: l.perdu ? (l.choix === 'acheteur' ? 'vendeur' : 'acheteur') : null });
      geste(b, f, () => { S.fait['lit:' + x.id] = txt; });
    });
  };

  /* ——— 3. Signalements (annonces) ——— */
  VUES.sig = () => {
    if (S.err.sig) return erreur('sig'); const L = sigs();
    if (!L.length) return vide('Aucune annonce signalée.');
    const nomA = a => a.product_label || ((window.MDG && MDG.products || []).find(p => p.slug === a.product_slug) || {}).name || a.product_slug || 'Annonce';
    return `<div class="eq-l">${L.map(x => { const f = S.fait['sig:' + x.k], m = x.k[0] === 'm';
      const t = m ? 'Annonce cachée · ' + (x.produit || 'sans nom') : (x.cible === 'offre' ? 'Offre' : 'Demande') + ' · ' + nomA(x.a) + (x.a.city ? ' · ' + x.a.city : '');
      const w = m ? 'Cachée par les signalements le ' + jour(x.masquee_le) + (x.qui && x.qui.nom ? ' · ' + x.qui.nom : '') + (x.contestation ? ' · contestée : « ' + x.contestation + ' »' : '')
        : x.n + (x.n > 1 ? ' signalements' : ' signalement') + (x.motifs.length ? ' : ' + x.motifs.join(', ') : '');
      return `<div class="eq-c"><div class="eq-tt"><b>${esc(t)}</b><small>${esc(w)}</small></div>
        ${f ? `<span class="eq-st ${f[0]}">${esc(f[1])}</span>` : m ? `<div class="eq-duo"><button type="button" class="eq-go m" data-smq="${x.cible_id}">Masquer</button><button type="button" class="eq-disc" data-sgd="${x.cible_id}">Garder</button></div>`
          : `<button type="button" class="eq-go m" data-sma="${x.id}">Masquer</button>`}</div>`; }).join('')}</div>`;
  };
  LIENS.sig = c => {
    const M = id => S.D.sig.masq.find(x => x.cible_id === id), A = id => S.D.sig.actives.find(x => x.id === id);
    // annonce cachée par 3 signalements (schéma 94e) : la garder cachée (le vendeur lit la raison) ou la remettre en ligne (le vendeur est prévenu)
    c.querySelectorAll('[data-smq]').forEach(b => b.onclick = async () => { const x = M(b.dataset.smq);
      const n = await motif('Pourquoi l’annonce reste cachée ? Le vendeur lira cette phrase.', { ok: 'Masquer' }); if (!n) return;
      geste(b, () => rpc('admin_annonce_maintenir', { p_cible: x.cible, p_id: x.cible_id, p_note: n }), () => { S.fait['sig:m:' + x.cible_id] = ['ko', 'Annonce masquée · le vendeur est prévenu']; }); });
    c.querySelectorAll('[data-sgd]').forEach(b => b.onclick = async () => { const x = M(b.dataset.sgd);
      if (!(await MDGDemande.oui('Remettre cette annonce en ligne ? Le vendeur est prévenu.', { ok: 'Remettre en ligne' }))) return;
      geste(b, () => rpc('admin_annonce_retablir', { p_cible: x.cible, p_id: x.cible_id, p_note: null }), () => { S.fait['sig:m:' + x.cible_id] = ['ok', 'Gardée en ligne']; }); });
    // annonce encore en ligne, signalée : la masquer (comme admin.html, v3/admin.js)
    c.querySelectorAll('[data-sma]').forEach(b => b.onclick = async () => { const x = A(b.dataset.sma);
      if (!(await MDGDemande.oui('Masquer cette annonce ? Elle n’est plus visible sur le marché.', { ok: 'Masquer', danger: true }))) return;
      geste(b, () => N().api('/rest/v1/' + (x.cible === 'offre' ? 'offres' : 'demandes') + '?id=eq.' + x.id, { method: 'PATCH', auth: true, body: { status: 'masquee' }, prefer: 'return=minimal' }),
        () => { S.fait['sig:a:' + x.id] = ['ko', 'Annonce masquée']; }); });
  };

  /* ——— 4. Comptes ——— */
  const susp = () => { const m = {}; ((S.D.fiab && S.D.fiab.suspensions) || []).forEach(s => { m[s.user_id] = s; }); return m; };
  const etat = (c, SU) => c.banni ? 'banni' : SU[c.id] ? 'suspendu' : 'actif';
  const ETAT = { actif: 'Actif', suspendu: 'Suspendu', banni: 'Banni' };
  VUES.cpt = () => {
    if (S.err.cpt) return erreur('cpt');
    const SU = susp(), q = S.cptQ.replace(/\D/g, ''), L = (S.D.cpt || []).filter(c => !q || String(c.tel || '').includes(q)), jr = (S.D.fiab && S.D.fiab.reglages && S.D.fiab.reglages.suspension_jours) || 7;
    return `<label class="eq-cherche"><span class="eq-cache">Chercher un numéro</span><input type="search" inputmode="numeric" data-cq value="${esc(S.cptQ)}" placeholder="Chercher un numéro" autocomplete="off"></label>
      ${L.length ? `<div class="eq-l">${L.slice(0, S.cptN).map(c => { const e = etat(c, SU), s = SU[c.id];
        return `<div class="eq-c"><div class="eq-ligne"><div class="eq-tt"><b>${esc(tel(c.tel))}</b><small>${c.admin ? 'Équipe · ' : ''}inscrit le ${jour(c.created_at)} · vu ${ago(c.last_sign_in_at) || 'jamais'}${s ? ' · jusqu’au ' + jour(s.fin) : ''}</small></div><span class="eq-pa ${e}">${ETAT[e]}</span></div>
          <div class="eq-acts">${c.admin ? '' : e === 'actif' ? `<button type="button" class="eq-disc p" data-csu="${c.id}">Suspendre ${jr} j</button><button type="button" class="eq-dang" data-cba="${c.id}">Bannir</button>` : `<button type="button" class="eq-cont p" data-cle="${c.id}">Lever la sanction</button>`}<button type="button" class="eq-disc p" data-cco="${c.id}">Nouveau code</button></div></div>`; }).join('')}</div>
        ${L.length > S.cptN ? `<button type="button" class="eq-disc" data-cplus>Afficher plus <span class="eq-nb">${L.length - S.cptN}</span></button>` : ''}` : vide(q ? 'Aucun compte avec ce numéro.' : 'Aucun compte.')}`;
  };
  const relireComptes = () => Promise.all([lire('cpt', rpc('admin_comptes')), lire('fiab', rpc('admin_fiabilite'))]);
  LIENS.cpt = c => {
    const C = id => (S.D.cpt || []).find(x => x.id === id), qui = x => tel(x.tel);
    const i = c.querySelector('[data-cq]'); if (i) i.oninput = () => { S.cptQ = i.value; S.cptN = 30; const p = i.selectionStart; corps(); const n = bg.querySelector('[data-cq]'); n.focus(); n.setSelectionRange(p, p); };
    const pl = c.querySelector('[data-cplus]'); if (pl) pl.onclick = () => { S.cptN += 30; majCarte(); };
    c.querySelectorAll('[data-csu]').forEach(b => b.onclick = async () => { const x = C(b.dataset.csu);
      const m = await motif('Suspendre le ' + qui(x) + '. Ses annonces sont cachées. Motif (le membre le lira) :', { ok: 'Suspendre', danger: true }); if (!m) return;
      geste(b, async () => { await rpc('admin_suspendre', { p_user: x.id, p_motif: m }); await relireComptes(); }, () => dire('Compte suspendu. Ses annonces sont cachées.')); });
    c.querySelectorAll('[data-cba]').forEach(b => b.onclick = async () => { const x = C(b.dataset.cba);
      const r = await feuille('Bannir le ' + qui(x) + ' à vie. Ses annonces sont masquées ; il ne peut plus publier, négocier ni écrire.',
        `<fieldset class="eq-choix"><legend class="eq-lab">Motif</legend>${[['arnaque', 'Arnaque'], ['mauvais_produits', 'Mauvais produits à répétition'], ['insultes', 'Insultes'], ['autre', 'Autre']].map(([v, t]) => `<label><input type="radio" name="mo" value="${v}"><span>${t}</span></label>`).join('')}</fieldset>
         <label class="eq-lab">Précisez en une phrase (pour l’équipe)<textarea name="de" maxlength="300" rows="2"></textarea></label>`,
        { ok: 'Bannir', danger: true, valider: v => !v.mo ? 'Choisissez le motif.' : v.de.length < 5 ? 'Précisez en une phrase.' : '' });
      if (!r) return;
      geste(b, async () => { await rpc('admin_bannir', { p_user: x.id, p_motif: r.mo, p_detail: r.de }); await relireComptes(); }, () => dire('Compte banni. Ses annonces sont masquées.')); });
    c.querySelectorAll('[data-cle]').forEach(b => b.onclick = async () => { const x = C(b.dataset.cle), s = susp()[x.id];
      if (x.banni) { const m = await motif('Lever le bannissement du ' + qui(x) + ' ? Ses annonces restent masquées. Pourquoi ?', { ok: 'Lever' }); if (!m) return;
        // admin_lever_bannissement ne prend que le compte (v3/admin.js) : le serveur note le geste et le bannissement d'origine au journal
        return geste(b, async () => { await rpc('admin_lever_bannissement', { p_user: x.id }); await relireComptes(); }, () => dire('Bannissement levé.')); }
      if (!s) return;
      const m = await motif('Lever la suspension du ' + qui(x) + ' ? Pourquoi ?', { ok: 'Lever' }); if (!m) return;
      geste(b, async () => { await rpc('admin_suspension_lever', { p_sanction: s.id, p_motif: m }); await relireComptes(); }, () => dire('Suspension levée. Ses annonces sont revenues.')); });
    c.querySelectorAll('[data-cco]').forEach(b => b.onclick = async () => { const x = C(b.dataset.cco);
      const r = await feuille('Nouveau code secret pour le ' + qui(x) + '. Donnez-le à la personne de vive voix, par téléphone.',
        `<label class="eq-lab">Nouveau code (6 chiffres)<input name="co" inputmode="numeric" maxlength="6" autocomplete="off" pattern="[0-9]*"></label>
         <label class="eq-lab">Pourquoi changer ce code ?<textarea name="mo" maxlength="300" rows="2"></textarea></label>`,
        { ok: 'Enregistrer', valider: v => !/^\d{6}$/.test(v.co) ? 'Le code fait 6 chiffres.' : v.mo.length < 5 ? 'Indiquez la raison en quelques mots.' : '' });
      if (!r) return;
      geste(b, () => rpc('admin_reinitialiser_journal', { compte: x.id, nouveau: r.co, motif: r.mo }), () => dire('Nouveau code enregistré. Les connexions ouvertes de ce compte sont fermées.')); });
  };

  /* ——— 5. Commissions : calculées, jamais encaissées ni réclamées (schémas 30, 95b, 99b) ——— */
  const AVANT = ['avant', 'avant_regle', 'non_reclamee'];
  const stK = k => { const v = k.statut_registre || k.statut; if (k.avant_regle === true || AVANT.includes(v)) return 'avant'; if (v === 'due' && !(k.sequestre === true || k.argent_passe === true)) return 'avant'; return v; };
  VUES.com = () => {
    if (S.err.com) return erreur('com');
    const c = S.D.com || {}, T = c.totaux || {}, AR = c.avant_regle || {};
    // le serveur compte les lignes « avant la règle » dans « calculee » : on les retire (comme v3/admin-transport.js)
    const total = Math.max(0, (+(T.calculee && T.calculee.commission) || 0) - (+AR.commission || 0)), L = c.lignes || [];
    const droite = k => { const s = stK(k); return s === 'calculee' ? 'Calculée ' + fmt(k.commission) + ' F' : s === 'avant' ? 'D’avant la règle' : s === 'suspendue' ? 'Suspendue (litige)' : s === 'annulee' ? 'Annulée' : 'Prévue ' + fmt(k.commission) + ' F'; };
    return `<div class="eq-total"><span>Calculée</span><b>${fmt(total)} F</b></div>
      <p class="eq-sous">Aucun paiement ne passe par l’application. Les 3,5 % sont calculés, jamais prélevés.</p>
      ${L.length ? `<div class="eq-rangs">${L.map(k => `<div class="eq-rang"><div class="eq-tt"><b>${k.numero ? 'Commande n° ' + esc(no(k.numero)) + ' · ' : ''}${esc(k.produit || 'Commande')}</b><small>Vente ${fmt(k.montant_vente)} F</small></div><span class="eq-dr">${esc(droite(k))}</span></div>`).join('')}</div>` : vide('Aucune vente pour l’instant.')}`;
  };

  /* ——— 6. Diffusion ——— */
  VUES.diff = () => `<p class="eq-txt">Un message officiel à tous les membres, avec le logo et la mention « Officiel ».</p>
    <textarea class="eq-ta" data-dt maxlength="2000" aria-label="Message à tous" placeholder="Par exemple : le marché d’Adjamé ferme samedi pour travaux.">${esc(S.diff)}</textarea>
    <span class="eq-cpt" data-dn aria-live="polite">${fmt(S.diff.length)} / 2 000</span>
    <button type="button" class="eq-go" data-dg>Envoyer à tous</button>`;
  LIENS.diff = c => {
    const ta = c.querySelector('[data-dt]'), n = c.querySelector('[data-dn]');
    ta.oninput = () => { S.diff = ta.value; n.textContent = fmt(ta.value.length) + ' / 2 000'; };
    c.querySelector('[data-dg]').onclick = async e => { const b = e.currentTarget, t = ta.value.trim();
      if (t.length < 5) { dire('Écrivez d’abord le message.'); ta.focus(); return; }
      if (!(await MDGDemande.oui('Envoyer ce message à tous les membres ?', { ok: 'Envoyer à tous' }))) return;
      geste(b, () => rpc('admin_diffuser', { p_texte: t }), r => { S.diff = ''; dire('Message envoyé à ' + fmt(+r || 0) + ' membre' + ((+r || 0) > 1 ? 's' : '') + '.'); }); };
  };

  /* ——— 7. Journal (admin_journal, lisible par l'équipe seulement) ——— */
  const GESTE = {
    admin_suspendre: 'a suspendu un compte', admin_suspension_lever: 'a levé une suspension', admin_bannir: 'a banni un compte', admin_lever_bannissement: 'a levé un bannissement',
    admin_bannissement_decider: 'a répondu à une contestation de bannissement', admin_identite_ouvrir: 'a ouvert un dossier d’identité',
    admin_identite_purger: 'a effacé un dossier d’identité arrivé à échéance', admin_identite_photos_effacees: 'a effacé des photos d’identité arrivées à échéance',
    admin_litige_clore: 'a tranché un litige', admin_litige_trancher: 'a tranché un litige', admin_litige_trancher2: 'a tranché un litige', admin_litige_partager: 'a partagé un litige',
    admin_refus_trancher: 'a tranché un refus de marchandise', admin_commande_issue: 'a décidé de l’issue d’une commande', admin_liberer: 'a clôturé une commande',
    admin_affecter: 'a affecté un transporteur', admin_mission_prix: 'a saisi le prix d’un transport', admin_diffuser: 'a écrit à tous les membres',
    admin_contestation_decider: 'a répondu à une contestation', admin_annulation_classer: 'a classé une annulation',
    admin_signalement_membre_traite: 'a traité un signalement', admin_signalements_cible_traites: 'a traité des signalements',
    annonce_maintenue: 'a gardé une annonce cachée', annonce_retablie: 'a remis une annonce en ligne', code_change: 'a changé un code secret',
    numero_rendu: 'a rendu un numéro à son propriétaire', numero_libere: 'a libéré un numéro', admin_structure_decider: 'a décidé d’une structure',
    admin_transporteur_decider: 'a décidé d’un transporteur', admin_transporteur_creer: 'a inscrit un transporteur', admin_niveaux_decider: 'a décidé d’un niveau',
    commande_participation_equipe: 'a proposé un arrangement', commande_participation_retirer: 'a retiré un arrangement'
  };
  const geste1 = j => { const a = j.action, p = (j.detail && j.detail.parametres) || {};
    if (a === 'admin_identite_decider') return p.p_statut === 'verifie' ? 'a vérifié une identité' : p.p_statut === 'refuse' ? 'a refusé une identité' : 'a demandé de nouvelles photos d’identité';
    if (/_regler$|_regle_modifier$|^admin_transport_reseau$/.test(a)) return 'a changé un réglage';
    return GESTE[a] || 'a fait un geste (' + a.replace(/^admin_/, '').replace(/_/g, ' ') + ')'; };
  VUES.jour = () => {
    if (S.err.jour) return erreur('jour'); const L = S.D.jour;
    if (!L) return `<p class="eq-vide" role="status">Chargement…</p>`;
    if (!L.length) return vide('Aucun geste noté pour l’instant.');
    const me = (N().session() || {}).user || {}, T = {}; (S.D.cpt || []).forEach(c => { T[c.id] = tel(c.tel); });
    return `<div class="eq-rangs">${L.map(j => { const qui = j.admin_id === me.id ? 'Vous' : T[j.admin_id] ? 'L’équipe (' + T[j.admin_id] + ')' : 'L’équipe';
      const w = [T[j.cible_id] ? 'Compte ' + T[j.cible_id] : '', j.motif ? 'Motif : ' + j.motif : ''].filter(Boolean).join(' · ');
      return `<div class="eq-jr"><span class="eq-h">${esc(heure(j.at))}</span><b>${esc(qui + ' ' + (qui === 'Vous' ? geste1(j).replace(/^a /, 'avez ') : geste1(j)))}</b>${w ? `<small>${esc(w)}</small>` : ''}</div>`; }).join('')}</div>`;
  };

  window.MDGEquipe = { ouvrir, fermer: () => fermer() };
})();
