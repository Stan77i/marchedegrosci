/* ═════════ Marché de Gros CI — Nuage : les annonces partagées entre tous les téléphones ═════════
   Base Supabase (formule gratuite). Le site et l'application utilisent ce même module (même stockage).
   • Lire : tout le monde, sans compte. Les annonces des autres sont gardées en cache sur l'appareil (visibles hors connexion).
   • Publier : compte = numéro de téléphone + code secret à 6 chiffres (pas de SMS : aucun frais).
     Une annonce publiée sans réseau ou sans compte reste sur le téléphone, puis part toute seule (connexion revenue, compte ouvert).
   • « Mes annonces » restent dans mdg-v2:offres / mdg-v2:demandes (inchangé) ; le cache des autres est séparé (mdg-nuage:*).
   • Aucune donnée inventée : seules les annonces réellement publiées apparaissent.
   • Code de secours (12 caractères) remis à l'ouverture du compte : il permet de choisir un nouveau code secret si on l'oublie.
   • Sur un nouveau téléphone, la connexion rapatrie « mes annonces » (pour les modifier ou les retirer d'ici aussi).
   API : MDGNuage.list(kind) · refresh() · sync() · session() · open(raison) · signOut() · report(kind, id, motif) · api() · rpc() · isAdmin()
   Événements : « mdg:change » (l'application relit), « mdg:nuage » (le site relit). */
(function () {
  'use strict';
  const URL0 = 'https://catmsypctymgkjkfzdkt.supabase.co', KEY = 'sb_publishable_KC2au-t8dqasp5ez9Lq6XQ_JvbTtVQ5';
  const DOMAINE = 'tel.marchedegros.ci'; // le compte Supabase est une adresse construite à partir du numéro (aucun e-mail n'est envoyé)
  const K = { e: 'mdg-nuage:empreinte', a: 'mdg-nuage:admin', s: 'mdg-nuage:session', o: 'mdg-nuage:offres', d: 'mdg-nuage:demandes', p: 'mdg-nuage:pousse', t: 'mdg-nuage:maj', vu: 'mdg-nuage:attente-vue', v: 'mdg-nuage:version' };
  const KIND = { offres: 'offres', demandes: 'demandes' };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const local = k => J('mdg-v2:' + k, []).filter(Boolean);
  const tel10 = s => { let d = String(s || '').replace(/\D/g, ''); if (d.length === 13 && d.startsWith('225')) d = d.slice(3); return d.length === 10 ? d : null; };
  const num = v => v == null || v === '' || isNaN(+v) ? null : +v;
  const txt = (v, n) => v == null ? null : String(v).slice(0, n);
  const say = (kind) => { dispatchEvent(new CustomEvent('mdg:change', { detail: { from: 'nuage' } })); dispatchEvent(new CustomEvent('mdg:nuage', { detail: { kind } })); };

  /* ——— requêtes ——— */
  async function api(path, { method = 'GET', body, auth = false, prefer } = {}) {
    const h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (auth) { const s = await token(); if (!s) throw Object.assign(new Error('non connecté'), { code: 'auth' }); h.Authorization = 'Bearer ' + s.access_token; }
    if (prefer) h.Prefer = prefer;
    const r = await fetch(URL0 + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    if (!r.ok) { const m = (j && (j.msg || j.message || j.error_description || j.error)) || ('Erreur ' + r.status);
      // texte refusé par la base (schéma 22 : liens, e-mails, codes) : seulement la phrase pour le membre
      if (/^TEXTE_REFUSE : /.test(m)) throw Object.assign(new Error(m.replace(/^TEXTE_REFUSE : /, '')), { status: r.status, body: j, code: 'texte' });
      // erreur technique de la base (champ, colonne, fonction…) : une phrase simple pour le membre, le détail reste dans la console
      if (/record "new"|has no field|column .* does not exist|could not find the '[a-z_]+' column|relation .* does not exist|function .* does not exist|syntax error/i.test(m) && !/^[A-Z_]+ : /.test(m)) {
        console.warn('[nuage] erreur technique', m);
        throw Object.assign(new Error('Un problème technique a empêché l’envoi. Réessayez dans un instant ; si cela continue, écrivez au Marché de Gros.'), { status: r.status, body: j, code: 'technique', detail: m }); }
      throw Object.assign(new Error(m), { status: r.status, body: j }); }
    return j;
  }

  const rpc = (f, args, auth = true) => api('/rest/v1/rpc/' + f, { method: 'POST', body: args || {}, auth });
  // empreinte d'une annonce telle qu'envoyée : si elle change (modification sur le téléphone), l'annonce repart
  const hash = o => { const t = JSON.stringify(o); let h = 5381; for (let i = 0; i < t.length; i++) h = (h * 33 ^ t.charCodeAt(i)) >>> 0; return h.toString(36); };

  /* ——— compte : numéro + code à 6 chiffres ——— */
  const email = t => '225' + t + '@' + DOMAINE;
  const keep = j => { const s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: { id: j.user && j.user.id, tel: (j.user && j.user.user_metadata && j.user.user_metadata.tel) || null } }; W(K.s, s); return s; };
  const session = () => J(K.s, null);
  async function token() {
    const s = session(); if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s;
    try { const j = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } }); const n = keep(j); n.user.tel = n.user.tel || s.user.tel; W(K.s, n); return n; }
    catch (e) { if (e.status === 400 || e.status === 401) { localStorage.removeItem(K.s); say('compte'); } return null; }
  }
  async function signIn(tel, code) {
    const t = tel10(tel); if (!t) throw new Error('Numéro à 10 chiffres, par exemple 07 01 02 03 04.');
    if (!/^\d{6}$/.test(code)) throw new Error('Le code secret fait 6 chiffres.');
    const j = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email(t), password: code } }).catch(e => { throw e.status === 400 ? new Error('Numéro ou code incorrect.') : e; });
    const s = keep(j); s.user.tel = s.user.tel || t; W(K.s, s); basculer(s.user.id); say('compte'); apresConnexion(); return s;
  }
  async function signUp(tel, code) {
    const t = tel10(tel); if (!t) throw new Error('Numéro à 10 chiffres, par exemple 07 01 02 03 04.');
    if (!/^\d{6}$/.test(code)) throw new Error('Le code secret fait 6 chiffres.');
    if (/^(\d)\1{5}$/.test(code) || code === '123456' || code === '654321') throw new Error('Code trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.');
    const j = await api('/auth/v1/signup', { method: 'POST', body: { email: email(t), password: code, data: { tel: t } } })
      .catch(e => { throw /already|registered|exists/i.test(e.message) ? new Error('Ce numéro a déjà un compte. Choisissez « J’ai déjà un compte ».') : e; });
    if (!j || !j.access_token) throw new Error('Compte créé, mais la connexion a échoué. Réessayez avec « J’ai déjà un compte ».');
    const s = keep(j); s.user.tel = t; W(K.s, s); basculer(s.user.id); say('compte'); apresConnexion();
    s.secours = await rpc('creer_secours').catch(() => null); // montré une seule fois
    return s;
  }
  // code oublié : le code de secours permet d'en choisir un nouveau (renvoie un NOUVEAU code de secours, puis connecte)
  async function recover(tel, cle, code) {
    const t = tel10(tel); if (!t) throw new Error('Numéro à 10 chiffres, par exemple 07 01 02 03 04.');
    if (!/^\d{6}$/.test(code)) throw new Error('Le nouveau code secret fait 6 chiffres.');
    // schéma 72 : la porte « secours_reinitialiser » compte les essais ratés ; un code de secours faux renvoie une réponse vide
    const neuve = await rpc('secours_reinitialiser', { tel: t, cle: String(cle || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), nouveau: code }, false)
      .catch(e => { throw /secours_reinitialiser|schema cache|404/i.test(e.message + e.status) ? new Error('La récupération n’est pas encore activée. Appelez le Marché de Gros.') : e; });
    if (!neuve) throw new Error('Numéro ou code de secours incorrect.');
    const s = await signIn(t, code); s.secours = neuve; return s;
  }
  async function isAdmin() { if (!session()) return false; try { const a = !!(await rpc('est_admin')); W(K.a, a); return a; } catch (_) { return !!J(K.a, false); } }

  /* ——— plusieurs comptes sur le même téléphone ———
     « Mes annonces » (mdg-v2:*) appartiennent au compte noté dans K.own. Quand un autre compte se connecte, les annonces du
     précédent sont rangées de côté (mdg-compte:<id>:*) et celles du nouveau compte reviennent. Une annonce qui n'est pas encore
     partie (publiée hors connexion, juste avant de se connecter) suit le compte qui se connecte : c'est lui qui vient de la publier. */
  const KOWN = 'mdg-nuage:proprio', KINC = 'mdg-compte:inconnu', sac = u => 'mdg-compte:' + u + ':';
  function basculer(uid) {
    if (!uid) return false;
    const cur = J(KOWN, null);
    if (cur === uid) return false;
    if (!cur) { W(KOWN, uid); return false; } // premier compte connu sur ce téléphone : la vérification (verifier) trie le reste
    const p = J(K.p, {}), e = J(K.e, {}), garde = {}, suit = {};
    for (const k of ['offres', 'demandes']) { const L = local(k); garde[k] = L.filter(x => p[k + ':' + x.id]); suit[k] = L.filter(x => !p[k + ':' + x.id]); }
    W(sac(cur) + 'offres', garde.offres); W(sac(cur) + 'demandes', garde.demandes); W(sac(cur) + 'pousse', p); W(sac(cur) + 'empreinte', e);
    for (const k of ['offres', 'demandes']) { W('mdg-v2:' + k, J(sac(uid) + k, []).concat(suit[k])); localStorage.removeItem(sac(uid) + k); }
    W(K.p, J(sac(uid) + 'pousse', {})); W(K.e, J(sac(uid) + 'empreinte', {}));
    localStorage.removeItem(sac(uid) + 'pousse'); localStorage.removeItem(sac(uid) + 'empreinte');
    W(KOWN, uid); say('mes'); return true;
  }
  // garde-fou (téléphones mis à jour depuis une ancienne version) : une annonce déjà envoyée qui n'est pas à ce compte sur le serveur
  // est rangée de côté ; elle revient sur ce téléphone quand son compte se reconnecte.
  async function verifier(s) {
    const p = J(K.p, {}), e = J(K.e, {}), ids = new Set();
    for (const k of ['offres', 'demandes']) { const rows = await api('/rest/v1/' + KIND[k] + '?select=id&user_id=eq.' + s.user.id + '&limit=1000', { auth: true }); (rows || []).forEach(r => ids.add(String(r.id))); }
    let inc = J(KINC, []), bouge = false;
    for (const k of ['offres', 'demandes']) {
      const L = local(k), reste = [];
      for (const x of L) { const key = k + ':' + x.id; if (p[key] && !ids.has(String(p[key]))) { inc.push({ k, x, pid: p[key], h: e[key] }); delete p[key]; delete e[key]; bouge = true; } else reste.push(x); }
      const rev = inc.filter(i => i.k === k && ids.has(String(i.pid)) && !reste.some(y => y.id === i.x.id));
      rev.forEach(i => { reste.push(i.x); p[k + ':' + i.x.id] = i.pid; if (i.h) e[k + ':' + i.x.id] = i.h; bouge = true; });
      inc = inc.filter(i => !rev.includes(i));
      if (bouge) W('mdg-v2:' + k, reste);
    }
    if (bouge) { W(K.p, p); W(K.e, e); W(KINC, inc.slice(-60)); say('mes'); }
  }
  // après connexion : envoyer ce qui attend, puis rapatrier mes annonces publiées depuis un autre téléphone
  async function apresConnexion() { await sync(); await pullMine(); isAdmin().then(() => say('compte')); }
  async function pullMine() {
    const s = session(); if (!s || !navigator.onLine) return 0; let n = 0;
    basculer(s.user.id);
    try { await verifier(s); } catch (x) { if (x.code !== 'auth') console.warn('[nuage] vérification des annonces impossible', x.message); }
    try {
      const p = J(K.p, {}), e = J(K.e, {});
      for (const k of ['offres', 'demandes']) {
        const rows = await api('/rest/v1/' + KIND[k] + '?select=*&status=eq.active&user_id=eq.' + s.user.id + '&order=created_at.desc&limit=60', { auth: true });
        const L = local(k), ids = new Set(L.map(x => x.id)), add = [];
        for (const r of rows || []) {
          const key = k + ':' + r.client_id;
          if (ids.has(r.client_id) || p[key]) continue; // déjà sur ce téléphone, ou retirée ici et en cours de retrait
          const x = fromRow[k](r); x.id = r.client_id; delete x._remote; delete x._rid; delete x.client_id;
          if (k === 'offres') x.agent = r.agent ? { name: r.agent } : null; else x.status = 'affichee';
          add.push(x); p[key] = r.id; e[key] = hash(toRow[k](x));
        }
        if (add.length && W('mdg-v2:' + k, J('mdg-v2:' + k, []).concat(add))) { W(K.p, p); W(K.e, e); n += add.length; }
      }
    } catch (x) { if (x.code !== 'auth') console.warn('[nuage] rapatriement impossible', x.message); }
    if (n) { say('mes'); toast(n > 1 ? n + ' de vos annonces sont maintenant sur cet appareil.' : 'Une de vos annonces est maintenant sur cet appareil.'); }
    return n;
  }
  async function signOut() { const s = session(); if (s && window.MDGPousse) { try { await MDGPousse.oublier(); } catch (_) {} }  // ce téléphone ne reçoit plus les notifications de ce compte
    localStorage.removeItem(K.s); localStorage.removeItem(K.a); say('compte'); if (s) fetch(URL0 + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(() => {}); }

  /* ——— les annonces des autres (cache local) ——— */
  const fromRow = {
    offres: r => ({ id: 'n-' + r.id, _remote: true, _rid: r.id, _uid: r.user_id, client_id: r.client_id, productSlug: r.product_slug, productLabel: r.product_label, productName: r.product_label, regionSlug: r.region_slug, city: r.city || '', quantity: num(r.quantity) || 0, unit: r.unit || 'kg', price: num(r.price), availableFrom: r.available_from || 'maintenant', createdAt: r.created_at, producer: { name: r.seller_name || 'Vendeur', phone: r.phone || '' }, producerName: r.seller_name || 'Vendeur', agent: r.agent || '', negociable: r.negociable !== false, lieu: r.lieu || '', qteMin: num(r.qte_min) || 0, transport: r.transport || '', villeSeule: r.ville_seulement === true, ...(r.pause_le ? { pause: true, pauseLe: r.pause_le } : {}) }),
    demandes: r => ({ id: 'n-' + r.id, _remote: true, _rid: r.id, _uid: r.user_id, client_id: r.client_id, productSlug: r.product_slug, productLabel: r.product_label, productName: r.product_label, regionSlug: r.region_slug, city: r.city || '', quantity: num(r.quantity) || 0, unit: r.unit || 'kg', budget: num(r.budget), deadline: r.deadline || 'semaine', buyerType: r.buyer_type || 'Acheteur', buyerName: r.buyer_name || 'Acheteur', phone: r.phone || '', buyerContact: { tel: r.phone || '' }, createdAt: r.created_at, negociable: r.negociable !== false, lieu: r.lieu || '', criteres: Array.isArray(r.criteres) ? r.criteres : [], detail: r.detail && typeof r.detail === 'object' ? r.detail : {}, exigences: r.exigences || '', transport: r.transport || '', villeSeule: r.ville_seulement === true }),
  };
  // « ville seulement » (schéma 87) : envoyé seulement quand l'annonce l'a choisi une fois (les anciennes annonces ne changent pas)
  const vsRow = x => x.villeSeule === undefined ? {} : { ville_seulement: !!x.villeSeule && !!txt(x.city, 80) };
  const toRow = {
    offres: o => ({ client_id: txt(o.id, 60), product_slug: txt(o.productSlug, 80), product_label: txt(o.productLabel || o.productName, 120), region_slug: txt(o.regionSlug, 60), city: txt(o.city, 80), quantity: num(o.quantity), unit: txt(o.unit, 20), price: num(o.price), available_from: txt(o.availableFrom, 40), seller_name: txt((o.producer && o.producer.name) || o.producerName, 80), phone: null, lieu: txt(o.lieu, 20) || null, agent: txt(o.agent && typeof o.agent === 'object' ? (o.agent.name || 'Agent') : o.agent, 80) || null, negociable: o.negociable !== false, ...(o.qteMin !== undefined ? { qte_min: +o.qteMin > 0 ? +o.qteMin : null } : {}), ...(['inclus', 'hors_ville', 'non'].includes(o.transport) ? { transport: o.transport } : {}),
      // pause (schéma 86) : envoyée seulement si le vendeur s'en est servi (compatibilité avec une base sans la colonne) ; la date reste la même tant que dure la pause
      ...vsRow(o), ...(o.pause !== undefined ? { pause_le: o.pause ? (o.pauseLe || null) : null } : {}) }),
    demandes: d => ({ client_id: txt(d.id, 60), product_slug: txt(d.productSlug, 80), product_label: txt(d.productLabel || d.productName, 120), region_slug: txt(d.regionSlug, 60), city: txt(d.city, 80), quantity: num(d.quantity), unit: txt(d.unit, 20), budget: num(d.budget), deadline: txt(d.deadline, 40), buyer_type: txt(d.buyerType, 60), buyer_name: txt(d.buyerName, 80), phone: null, lieu: txt(d.lieu, 20) || null, negociable: d.negociable !== false, criteres: Array.isArray(d.criteres) ? d.criteres.slice(0, 12) : [], detail: d.detail && typeof d.detail === 'object' ? d.detail : {}, exigences: txt(d.exigences, 300) || null, ...(['vendeur', 'acheteur'].includes(d.transport) ? { transport: d.transport } : {}), ...vsRow(d) }),
  };
  // annonces des autres seulement : celles publiées depuis ce téléphone sont déjà dans « mes annonces »
  const zones = () => J('mdg-nuage:zones', []).filter(z => z && Date.parse(z.expire_le) > Date.now());
  async function zoneAjouter(z) { const r = await api('/rest/v1/zones', { method: 'POST', auth: true, body: z, prefer: 'return=representation' }); W('mdg-nuage:zones', (r || []).concat(J('mdg-nuage:zones', []))); say('liste'); return r && r[0]; }
  async function zoneRetirer(id) { await api('/rest/v1/zones?id=eq.' + encodeURIComponent(id), { method: 'DELETE', auth: true }); W('mdg-nuage:zones', J('mdg-nuage:zones', []).filter(z => z.id !== id)); say('liste'); }
  function list(kind) {
    const mine = new Set(local(kind).map(x => x.id)), cache = J(kind === 'offres' ? K.o : K.d, []);
    return cache.filter(x => x && x.productSlug !== undefined && !mine.has(x.client_id));
  }
  let busy = 0;
  // zones de forte demande posées par l'administration (schema-11) : sans effet si la table n'existe pas encore
  const lireZones = () => { api('/rest/v1/zones?select=*&expire_le=gt.' + encodeURIComponent(new Date().toISOString()) + '&order=created_at.desc&limit=100').then(z => { const avantZ = JSON.stringify(J('mdg-nuage:zones', [])); W('mdg-nuage:zones', z || []); if (JSON.stringify(z || []) !== avantZ) say('liste'); }).catch(() => {}); };
  async function refresh() {
    if (!navigator.onLine || busy & 1) return false; busy |= 1;
    try {
      // schéma 76 : d'abord un petit résumé (quelques octets) ; si rien n'a changé depuis la dernière lecture, on ne retélécharge pas les listes
      const v = await api('/rest/v1/rpc/annonces_version', { method: 'POST', body: {} }).catch(() => null);
      if (v && v === J(K.v, null) && J(K.t, 0) && J(K.o, null) && J(K.d, null)) { lireZones(); return true; }
      const sel = '?select=*&status=eq.active&order=created_at.desc&limit=500';
      const [o, d] = await Promise.all([api('/rest/v1/offres' + sel), api('/rest/v1/demandes' + sel)]);
      lireZones();
      const sig = x => (x || []).map(r => r.id).join(','), was = sig(J(K.o, []).map(x => ({ id: x._rid }))) + '|' + sig(J(K.d, []).map(x => ({ id: x._rid })));
      const avant = new Set(J(K.o, []).concat(J(K.d, [])).map(x => x._rid)), premier = !J(K.t, 0);
      W(K.o, (o || []).map(fromRow.offres)); W(K.d, (d || []).map(fromRow.demandes)); W(K.t, Date.now()); if (v) W(K.v, v);
      if (!premier) { const neuves = { offres: list('offres').filter(x => !avant.has(x._rid)), demandes: list('demandes').filter(x => !avant.has(x._rid)) }; if (neuves.offres.length || neuves.demandes.length) dispatchEvent(new CustomEvent('mdg:nouvelles', { detail: neuves })); }
      if (was !== sig(o) + '|' + sig(d)) say('liste'); // ne prévenir que s'il y a du nouveau
      await stockDuServeur();
      return true;
    } catch (e) { console.warn('[nuage] lecture impossible', e.message); return false; }
    finally { busy &= ~1; }
  }

  /* ——— mon stock : la quantité baisse sur le serveur à chaque vente conclue (schema-12) ; le téléphone la reprend ———
     Offres (J'ai) ET demandes (Je cherche) : 20 t demandées, 10 t convenues → il reste 10 t ; tout convenu → l'annonce sort du marché
     (offre « épuisée », demande « servie »). Appelé avant tout envoi : le téléphone ne renvoie jamais une ancienne quantité (schéma 52). */
  // schéma 93 : la quantité vue sur le serveur (qServeur) repart avec chaque envoi ; sans elle, le serveur refuse de remonter le stock.
  // Fin de vie de l'annonce (finLe) et annonce expirée (expiree) : pour « Prolonger 30 jours » dans Mes publications.
  let colsFin = true;   // base sans les colonnes du schéma 93 : on lit comme avant
  async function stockDuServeur() {
    const s = session(); if (!s) return false;
    try {
      const em = J(K.e, {}); let bouge = false;
      for (const k of ['offres', 'demandes']) {
        const lire = c => api('/rest/v1/' + KIND[k] + '?select=client_id,quantity,status' + (c ? ',expire_le,expiree_le' : '') + '&user_id=eq.' + s.user.id + '&limit=500', { auth: true });
        const rows = await lire(colsFin).catch(e => { if (colsFin && e.code === 'technique') { colsFin = false; return lire(false); } throw e; }) || [];
        const by = new Map(rows.map(r => [r.client_id, r])), champ = k === 'offres' ? 'epuise' : 'servie'; let b = false;
        const L = J('mdg-v2:' + k, []).map(x => { const r = x && by.get(x.id); if (!r || r.status === 'masquee') return x; const q = num(r.quantity), ep = r.status === 'retiree' && !(q > 0) && !r.expiree_le;
          const exp = r.status === 'retiree' && !!r.expiree_le, fin = r.expire_le || null;
          if ((q == null || q === num(x.quantity)) && !!x[champ] === ep && x.qServeur === q && !!x.expiree === exp && (x.finLe || null) === fin) return x;
          b = true; const y = Object.assign({}, x, { quantity: q == null ? x.quantity : q, [champ]: ep, qServeur: q, expiree: exp, finLe: fin }); em[k + ':' + x.id] = hash(toRow[k](y)); return y; });
        if (b) { W('mdg-v2:' + k, L); bouge = true; }
      }
      if (bouge) { W(K.e, em); say('mes'); }
      return true;
    } catch (e) { if (!e || e.code !== 'auth') console.warn('[nuage] lecture du stock impossible', e && e.message); return false; }
  }
  // « Prolonger 30 jours » (schéma 93c) : l'annonce reste en ligne, ou revient si elle a expiré ; renvoie la nouvelle date de fin
  async function prolonger(k, id) {
    const fin = await rpc('annonce_prolonger', { p_cible: k === 'offres' ? 'offre' : 'demande', p_client_id: String(id) });
    await stockDuServeur(); say('mes'); refresh();
    return fin;
  }

  /* ——— mes annonces : envoyer celles qui attendent, retirer celles supprimées sur le téléphone ——— */
  const waiting = () => { const p = J(K.p, {}); return ['offres', 'demandes'].reduce((n, k) => n + local(k).filter(x => x.productSlug && x.regionSlug && !p[k + ':' + x.id]).length, 0); };
  async function sync() {
    if (!navigator.onLine || busy & 2 || !session()) return false; busy |= 2; let changed = false, refus = '';
    basculer(session().user.id);
    // reprendre d'abord les quantités du serveur (ventes conclues) : jamais renvoyer une ancienne quantité ; lecture impossible : on n'envoie rien
    if (!(await stockDuServeur())) { busy &= ~2; return false; }
    try {
      const p = J(K.p, {}), em = J(K.e, {});
      for (const k of ['offres', 'demandes']) {
        const L = local(k), ids = new Set(L.map(x => x.id));
        for (const x of L) {
          if (!x.productSlug || !x.regionSlug) continue;
          const key = k + ':' + x.id, row = toRow[k](x), h = hash(row);
          if (p[key] && (!em[key] || em[key] === h)) { if (!em[key]) { em[key] = h; W(K.e, em); } continue; } // déjà envoyée, inchangée
          // base sans la colonne ville_seulement (schéma 87) ou pause_le (schéma 86) : l'annonce part quand même, sans ce choix
          const envoi = b => api('/rest/v1/' + KIND[k] + '?on_conflict=user_id,client_id', { method: 'POST', body: b, auth: true, prefer: 'return=representation,resolution=merge-duplicates' });
          const sans = (b, c) => { const x = Object.assign({}, b); delete x[c]; return x; };
          const essai = b => envoi(b).catch(e => { const m = (e && e.message) || '';
            if ('ville_seulement' in b && /ville_seulement/.test(m)) return essai(sans(b, 'ville_seulement'));
            if ('quantite_vue' in b && (e.code === 'technique' || /quantite_vue/.test(m))) return essai(sans(b, 'quantite_vue'));
            if ('pause_le' in b && (e.code === 'technique' || /pause_le/.test(m))) return essai(sans(b, 'pause_le'));
            throw e; });
          // quantité du serveur vue par ce téléphone (schéma 93a) : sans elle, une quantité plus haute n'est pas acceptée
          const corps = x.qServeur != null ? Object.assign({}, row, { quantite_vue: x.qServeur }) : row;
          try { const r = await essai(corps); if (r && r[0]) { p[key] = r[0].id; em[key] = h; changed = true; W(K.p, p); W(K.e, em);
              // des ventes ont été conclues entre-temps : le serveur garde son stock, le téléphone le reprend et le dit
              const qs = num(r[0].quantity);
              if (qs != null && num(x.quantity) != null && qs < num(x.quantity)) { await stockDuServeur(); toast('Stock gardé à ' + qs + ' ' + (x.unit || '') + ' : des ventes ont été conclues entre-temps. Vérifiez-le dans Mes publications.'); }
              // stock à zéro sur le téléphone : l'annonce sort du marché ; stock remis : elle revient (jamais une annonce masquée par l'administration, ni une annonce expirée : « Prolonger » la remet)
              if (k === 'offres' && !x.expiree) await api('/rest/v1/offres?id=eq.' + r[0].id + '&status=neq.masquee', { method: 'PATCH', auth: true, body: { status: x.epuise || !(+x.quantity > 0) ? 'retiree' : 'active' }, prefer: 'return=minimal' }).catch(() => {}); } }
          catch (e) { if (e.code === 'auth') throw e; console.warn('[nuage] envoi refusé', e.message); if (/Limite atteinte/.test(e.message)) toast(e.message);
            // règles des annonces (schéma 93a) : la phrase, une fois par session et par annonce ; l'annonce reste sur le téléphone
            else if (/^(ANNONCE_FIGEE|VILLE_INCONNUE|PRIX_REQUIS|QUANTITE_REQUISE|DOUBLON|PRODUIT_REQUIS) : /.test(e.message)) { const kt = 'mdg-nuage:regle:' + key; try { if (!sessionStorage.getItem(kt)) { sessionStorage.setItem(kt, '1'); toast((p[key] ? 'Annonce non mise à jour. ' : 'Annonce non publiée. ') + e.message.replace(/^[A-Z_]+ : /, '').replace(/^./, c => c.toUpperCase())); } } catch (_) {} }
            else if (e.code === 'texte') { const kt = 'mdg-nuage:texte:' + key; try { if (!sessionStorage.getItem(kt)) { sessionStorage.setItem(kt, '1'); toast('Annonce non publiée. ' + e.message + ' Modifiez-la dans Mon compte → Mon activité.'); } } catch (_) {} }
            else if (/^STOCK_(EPUISE|VIDE) : /.test(e.message)) { const ks = 'mdg-nuage:stock:' + key; try { if (!sessionStorage.getItem(ks)) { sessionStorage.setItem(ks, '1'); toast(e.message.replace(/^STOCK_[A-Z]+ : /, '')); } } catch (_) {} }   // schéma 92a
            else if (/COMPTE_BANNI/.test(e.message)) refus = 'banni'; else if (/VERIFICATION_REQUISE/.test(e.message) && refus !== 'banni') refus = 'limite'; }
        }
        for (const key of Object.keys(p)) {
          if (!key.startsWith(k + ':') || ids.has(key.slice(k.length + 1))) continue;
          // retirée sur le téléphone : cachée sur le serveur, la ligne reste (schéma 86, décision 37 : jamais d'effacement ; schéma 93a : le serveur le refuse)
          try { const u = '/rest/v1/' + KIND[k] + '?id=eq.' + encodeURIComponent(p[key]);
            await api(u + '&status=neq.masquee', { method: 'PATCH', auth: true, body: { status: 'retiree', retiree_le: new Date().toISOString() }, prefer: 'return=minimal' });
            delete p[key]; delete em[key]; changed = true; W(K.p, p); W(K.e, em); }
          catch (e) { if (e.code === 'auth') throw e; if (e.status === 404) { delete p[key]; W(K.p, p); } }
        }
      }
    } catch (e) { if (e.code !== 'auth') console.warn('[nuage] synchronisation interrompue', e.message); }
    finally { busy &= ~2; }
    if (changed) { refresh(); say('mes'); }
    if (refus) refuse(refus);
    return changed;
  }
  // la base refuse une annonce : 3 annonces gratuites déjà publiées sans identité vérifiée, ou compte banni.
  // On le dit une fois par session (sync repasse souvent) ; l'annonce reste sur le téléphone et repartira après vérification.
  function refuse(r) {
    const k = 'mdg-nuage:refus:' + r; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (_) {}
    const ID = window.MDGIdentite;
    if (ID && ID.inviter) ID.inviter(r);
    else toast(r === 'banni' ? 'Ce compte a été banni du Marché de Gros.' : 'Vos 3 annonces gratuites sont publiées : faites vérifier votre identité (Mon compte) pour publier les suivantes.');
  }
  async function report(kind, rid, motif) {
    const cible = kind === 'demandes' || kind === 'demande' ? 'demande' : 'offre';
    await api('/rest/v1/signalements', { method: 'POST', body: { cible, cible_id: rid, motif: txt(motif, 300) || null }, auth: !!session(), prefer: 'return=minimal' });
    return true;
  }

  /* ——— fenêtre de connexion (site et application) ——— */
  const CSS = `.ng-bg{position:fixed;inset:0;z-index:9000;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;padding:16px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:ngIn .25s ease both}
@media (min-width:640px){.ng-bg{align-items:center}}
.ng{font-variant-numeric:lining-nums;width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow-x:hidden;overflow-y:auto;background:#1d1a15;color:#F5F0E6;border-radius:28px;padding:24px 22px 22px;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:Jost,system-ui,sans-serif;animation:ngUp .35s cubic-bezier(.22,1,.36,1) both}
.ng h2{margin:0 0 6px;font:600 23px/1.1 Jost,sans-serif;letter-spacing:-.015em}.ng p{margin:0 0 16px;color:#B9AD98;font-size:14.5px;line-height:1.5}
.ng-tabs{display:flex;gap:6px;margin:0 0 18px;padding:4px;border-radius:999px;background:rgba(245,240,230,.06)}
.ng-tabs button{flex:1;min-height:42px;border:0;border-radius:999px;background:none;color:#B9AD98;font:600 14px Jost,sans-serif;cursor:pointer}.ng-tabs button[aria-selected=true]{background:#F5F0E6;color:#171512}
.ng label{display:block;margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#B9AD98}
.ng input{width:100%;box-sizing:border-box;height:52px;margin:0 0 14px;padding:0 16px;border:1px solid rgba(245,240,230,.16);border-radius:16px;background:#14120f;color:#F5F0E6;font:500 18px Jost,sans-serif;letter-spacing:.06em}
.ng input{transition:border-color .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s cubic-bezier(.2,.8,.2,1)}.ng input:focus{outline:none;border-color:#F2C230;box-shadow:0 0 0 3px rgba(242,194,48,.22)}
.ng-go{width:100%;min-height:52px;border:0;border-radius:999px;background:#F3EFE4;color:#10392B;font:700 16px Jost,sans-serif;cursor:pointer}.ng-go[disabled]{opacity:.6}
.ng-x{float:right;width:40px;height:40px;margin:-6px -6px 0 0;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:#F5F0E6;font-size:20px;cursor:pointer}
.ng-err:empty{min-height:0;margin:0 0 14px}.ng-err{min-height:20px;margin:-4px 0 12px;color:#F2C230;font-size:14px}.ng-note{margin:16px 0 0;font-size:12.5px;color:#8f846f;line-height:1.5}
.ng-me{display:flex;flex-direction:column;gap:12px}.ng-me b{font:800 19px/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}.ng-out{min-height:48px;border:1px solid rgba(245,240,230,.2);border-radius:999px;background:none;color:#F5F0E6;font:600 15px Jost,sans-serif;cursor:pointer}
@keyframes ngIn{from{opacity:0}}@keyframes ngUp{from{transform:translateY(24px);opacity:0}}
@media (prefers-reduced-motion:reduce){.ng-bg,.ng{animation:none}}`;
  let css = false, toastT = 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTel = t => t ? String(t).replace(/(\d{2})(?=\d)/g, '$1 ') : '';
  function toast(m, o) {
    if (window.MDGToast) return window.MDGToast.dire(m, o);   // la bannière commune (app/toast.js)
    let el = document.getElementById('ngToast');
    if (!el) { el = document.createElement('div'); el.id = 'ngToast'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9100;max-width:min(92vw,440px);padding:12px 18px;border-radius:16px;background:#F5F0E6;color:#171512;font:600 14px/1.4 Jost,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);transition:opacity .3s'; document.body.appendChild(el); }
    el.textContent = m; el.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { el.style.opacity = '0'; }, 4200);
  }
  const CSS2 = `.ng-id2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}@media (max-width:360px){.ng-id2{grid-template-columns:minmax(0,1fr)}}
.ng-link{display:inline;padding:0;border:0;background:none;color:#F2C230;font:600 14px Jost,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.ng-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:-4px 0 14px}
.ng-list{display:flex;flex-direction:column;gap:8px;margin:4px 0 6px}
.ng-item{display:flex;align-items:center;gap:14px;width:100%;min-height:58px;padding:10px 16px;border:1px solid rgba(245,240,230,.12);border-radius:18px;background:rgba(245,240,230,.04);color:#F5F0E6;font:500 15px/1.3 Jost,sans-serif;text-align:left;text-decoration:none;cursor:pointer}
.ng-item:hover{background:rgba(245,240,230,.08)}.ng-item:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
.ng-item small{display:block;color:#B9AD98;font-size:12.5px;font-weight:400}.ng-item i{margin-left:auto;font-style:normal;color:#B9AD98;display:grid;place-items:center}
.ng-item .ng-dot{min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#F3EFE4;color:#10392B;font:700 12px/22px Jost,sans-serif;text-align:center}
.ng-ticket{position:relative;margin:6px 0 16px;padding:20px 18px 18px;border:1.5px dashed rgba(243,180,138,.6);border-radius:20px;background:repeating-linear-gradient(-45deg,rgba(242,194,48,.06) 0 10px,transparent 10px 20px)}
.ng-ticket output{display:block;font:600 clamp(21px,6.6vw,30px)/1.1 Jost,sans-serif;letter-spacing:.08em;color:#F5F0E6;text-align:center;white-space:nowrap;user-select:all;font-variant-numeric:tabular-nums}
.ng [hidden]{display:none!important}
.ng-ticket small{display:block;margin-top:10px;color:#B9AD98;font-size:12.5px;text-align:center}
.ng-alt{width:100%;min-height:48px;margin:0 0 10px;border:1px solid rgba(245,240,230,.2);border-radius:999px;background:none;color:#F5F0E6;font:600 15px Jost,sans-serif;cursor:pointer}
.ng-warn{padding:12px 14px;border-radius:16px;background:rgba(242,194,48,.12);color:#F3D2BC;font-size:13.5px;line-height:1.45;margin:0 0 14px}
/* ——— la porte : la scène, puis le formulaire, d'un seul tenant ——— */
.ng-bg:has(.ng--porte){background:rgba(8,7,5,.58)}
.ng--porte{position:relative;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:224px minmax(0,1fr);max-width:460px;max-height:calc(100dvh - 16px);padding:0;overflow:hidden;background:#15130F;border-radius:30px;box-shadow:0 40px 100px rgba(0,0,0,.55),0 0 0 1px rgba(245,240,230,.06)}
.ng-scene{position:relative;overflow:hidden;background:#0B231A}
.ng-scene::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:76px;background:linear-gradient(180deg,rgba(21,19,15,0),rgba(21,19,15,.78) 58%,#15130F);pointer-events:none;z-index:2}
.ng-scene .pt-txt{z-index:3}
.ng-form{overflow-x:hidden;overflow-y:auto;padding:4px 24px calc(24px + env(safe-area-inset-bottom));overscroll-behavior:contain}
.ng--porte .ng-x{position:absolute;top:14px;right:14px;float:none;width:38px;height:38px;margin:0;z-index:4;display:grid;place-items:center;border-radius:50%;background:rgba(10,9,7,.46);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px rgba(245,240,230,.16);color:#F5F0E6;font:400 20px/1 Jost,sans-serif;transition:background .2s}
.ng--porte .ng-x:hover{background:rgba(10,9,7,.66)}.ng--porte .ng-x:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
.ng--porte h2{margin:0 0 22px;padding:0;font:500 clamp(25px,7.2vw,30px)/1.12 Jost,sans-serif;letter-spacing:-.022em;color:#F5F0E6;text-wrap:balance}
.ng--porte .ng-lede{margin:-12px 0 22px;color:#A89D89;font-size:15px;line-height:1.5;text-wrap:pretty}
.ng--porte .ng-tabs{margin:0 0 22px;padding:4px;background:rgba(245,240,230,.05)}
.ng--porte .ng-tabs button{min-height:40px;font-weight:500;color:#A89D89}.ng--porte .ng-tabs button[aria-selected=true]{background:#F5F0E6;color:#171512}
.ng-fd{margin:0 0 16px}
.ng--porte label{margin:0 0 8px;font:500 13.5px/1.2 Jost,sans-serif;letter-spacing:0;color:#CFC4B1}.ng--porte label i{font-style:normal;color:#A89D89;margin-left:6px;font-size:13px}
.ng-ip{position:relative;display:flex;align-items:center;border:1px solid rgba(245,240,230,.09);border-radius:14px;background:#1F1B16;transition:border-color .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s cubic-bezier(.2,.8,.2,1),background .2s}
.ng-ip:hover{border-color:rgba(245,240,230,.17)}
.ng-ip:focus-within{border-color:#F2C230;background:#221E18;box-shadow:0 0 0 4px rgba(242,194,48,.14)}
.ng-ip.is-bad{border-color:#E2735B}.ng-ip.is-bad:focus-within{box-shadow:0 0 0 4px rgba(226,115,91,.18)}
.ng--porte .ng-ip input{flex:1;min-width:0;height:56px;margin:0;border:0;background:none;box-shadow:none;outline:none;padding:0 16px;color:#F5F0E6;font:500 18px Jost,sans-serif;letter-spacing:.05em;font-variant-numeric:tabular-nums}
.ng--porte .ng-ip input::placeholder{color:#948A77;letter-spacing:.05em}
.ng--porte .ng-ip input:focus,.ng--porte .ng-ip input:focus-visible{border:0!important;box-shadow:none!important;outline:none!important}
.ng-ip--tel>span{align-self:stretch;display:flex;align-items:center;padding:0 12px 0 16px;border-right:1px solid rgba(245,240,230,.09);color:#A89D89;font:500 16px Jost,sans-serif;letter-spacing:.02em}.ng-ip--tel input{padding-left:12px!important}
.ng-ck{flex:none;width:22px;height:22px;margin-right:14px;border-radius:50%;background:#6CC58C url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='m6.5 11.4 3 3 6-6.4' fill='none' stroke='%23171512' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/22px no-repeat;opacity:0;transform:scale(.6);transition:opacity .2s,transform .32s cubic-bezier(.22,1,.36,1)}
.ng-ip.is-ok .ng-ck{opacity:1;transform:none}
.ng-eye{flex:none;min-height:44px;margin-right:6px;padding:0 12px;border:0;border-radius:10px;background:none;color:#A89D89;font:500 13.5px Jost,sans-serif;cursor:pointer}.ng-eye:hover{color:#F5F0E6;background:rgba(245,240,230,.06)}
.ng-fe{margin:7px 2px 0!important;color:#F3A08C!important;font-size:13.5px!important;line-height:1.4!important}.ng-fe:empty{display:none}
.ng-glob{display:grid;gap:4px;margin:0 0 16px;padding:12px 14px;border-radius:14px;background:rgba(226,115,91,.1);box-shadow:inset 0 0 0 1px rgba(226,115,91,.32);animation:ngUp .32s cubic-bezier(.22,1,.36,1) both}
.ng-glob p{margin:0!important;color:#F6D3C6!important;font-size:14.5px!important}.ng-glob .ng-link{justify-self:start;min-height:32px}
.ng--porte .ng-link{color:#F2C230;font-weight:500;text-decoration:none}.ng--porte .ng-link:hover{text-decoration:underline}
.ng--porte .ng-oubli .ng-link{min-height:40px;color:#CFC4B1;font-size:14px}.ng--porte .ng-oubli .ng-link:hover{color:#F5F0E6}
.ng--porte .ng-row{margin:-8px 0 14px}
.ng--porte .ng-go{position:relative;overflow:hidden;min-height:56px;border-radius:16px;background:#F2C230;color:#171512;font:600 16.5px Jost,sans-serif;letter-spacing:.005em;box-shadow:0 12px 28px -14px rgba(242,194,48,.7);transition:filter .2s,transform .15s,opacity .2s}
.ng--porte .ng-go:hover:not([disabled]){filter:brightness(1.05)}.ng--porte .ng-go:active:not([disabled]){transform:scale(.985)}
.ng--porte .ng-go:focus-visible{outline:2px solid #F5F0E6;outline-offset:3px}
.ng--porte .ng-go[disabled]{opacity:.72}.ng--porte .ng-go[aria-busy=true]{opacity:1}
.ng--porte .ng-note{margin:22px 0 0;padding-top:16px;border-top:1px solid rgba(245,240,230,.07);color:#A89D89;font-size:12.5px}
/* le titre de la porte : le logo en phrase, posé en trois temps (la ligne d'appel monte, « marché » sort de son cache, « de Gros » s'écrit puis un reflet le traverse) */
.ng--porte h2.ng-tt{display:flex;flex-direction:column;gap:2px;margin:0 0 24px}
.ng-tt-a{font:500 17px/1.3 Jost,sans-serif;letter-spacing:.005em;color:#BDB29E}
.ng-tt-b{display:block;font:600 clamp(34px,10.4vw,42px)/1.04 Jost,sans-serif;letter-spacing:-.028em;color:#F3EFE4;white-space:nowrap}
.ng-tt-m{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .02em .08em;margin:0 -.02em -.08em}.ng-tt-m>span{display:inline-block}
.ng-tt-g{display:inline-block;font-weight:800;font-style:italic;letter-spacing:-.02em;color:#F2C230}
/* « de Gros » et « du pays » empilés dans la même case : la largeur du titre ne bouge jamais ; le lecteur d'écran lit « marché de Gros » */
.ng-tt-pile{display:inline-grid;clip-path:inset(-.12em -.3em -.26em -.1em)}.ng-tt-pile>span{grid-area:1/1;display:inline-block}.ng-tt-pile>.ng-tt-y{opacity:0}
.ng-tt-t{display:inline-block;padding:0 .12em .06em .02em;margin:0 -.12em -.06em 0;background:linear-gradient(100deg,#F2C230 0 42%,#FFEDB0 50%,#F2C230 58% 100%) 100% 0/260% 100% no-repeat;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.ng-tt.is-on .ng-tt-a{animation:ngTtA .55s .12s cubic-bezier(.22,1,.36,1) both}
.ng-tt.is-on .ng-tt-m>span{animation:ngTtM .8s .26s cubic-bezier(.22,1,.36,1) both}
.ng-tt.is-on .ng-tt-g{animation:ngTtG .7s .62s cubic-bezier(.65,0,.35,1) both}.ng-tt.is-on .ng-tt-x .ng-tt-t{animation:ngTtS 1.5s 1.45s cubic-bezier(.4,0,.2,1) both}
/* le titre bascule seul, 3 s après l'apparition, « de Gros » monte et s'efface, « du pays » monte du bas avec un reflet et reste 2 s ; puis le retour, à l'inverse ; la séquence recommence toutes les 10 s */
.ng-tt.is-on .ng-tt-x{animation:ngTtX 10s cubic-bezier(.65,0,.35,1) infinite}
.ng-tt.is-on .ng-tt-y{animation:ngTtY 10s cubic-bezier(.65,0,.35,1) infinite}
.ng-tt.is-on .ng-tt-y .ng-tt-t{animation:ngTtR 10s linear infinite}
@keyframes ngTtX{0%,30%{transform:none;opacity:1}35%,57%{transform:translateY(-.5em);opacity:0}62%,100%{transform:none;opacity:1}}
@keyframes ngTtY{0%,32%{transform:translateY(.5em);opacity:0}37%,55%{transform:none;opacity:1}60%,100%{transform:translateY(.5em);opacity:0}}
@keyframes ngTtR{0%,37%{background-position:100% 0}49%,100%{background-position:0 0}}
@keyframes ngTtA{from{opacity:0;transform:translateY(8px);filter:blur(3px)}}
@keyframes ngTtM{from{transform:translateY(105%)}}
@keyframes ngTtG{from{clip-path:inset(-30% 100% -30% -10%);transform:translateX(-6px)}to{clip-path:inset(-30% -10% -30% -10%);transform:none}}
@keyframes ngTtS{from{background-position:100% 0}to{background-position:0 0}}
@media (min-width:760px){.ng-tt-a{font-size:18px}.ng-tt-b{font-size:48px}}
@media (prefers-reduced-motion:reduce){.ng-tt.is-on .ng-tt-a,.ng-tt.is-on .ng-tt-m>span,.ng-tt.is-on .ng-tt-g,.ng-tt.is-on .ng-tt-x,.ng-tt.is-on .ng-tt-x .ng-tt-t,.ng-tt.is-on .ng-tt-y,.ng-tt.is-on .ng-tt-y .ng-tt-t{animation:none}}
/* bureau : la scène à gauche, le formulaire à droite, sans trait entre les deux */
@media (min-width:760px){
  .ng-bg:has(.ng--porte){padding:24px}
  .ng--porte{max-width:1000px;grid-template-columns:minmax(0,1fr) 440px;grid-template-rows:minmax(0,1fr);height:min(640px,calc(100dvh - 48px));border-radius:32px}
  .ng-scene::after{top:0;bottom:0;left:auto;right:-1px;width:56px;height:auto;background:linear-gradient(90deg,rgba(21,19,15,0),rgba(21,19,15,.8) 60%,#15130F)}
  .ng-form{display:flex;flex-direction:column;justify-content:safe center;padding:56px 44px 36px}
  .ng-scene.ps-large{background:radial-gradient(1.2px 1.2px at 18% 14%,rgba(245,240,230,.7),transparent 2px),radial-gradient(1px 1px at 64% 9%,rgba(245,240,230,.55),transparent 2px),radial-gradient(1.4px 1.4px at 82% 26%,rgba(245,240,230,.6),transparent 2px),radial-gradient(1px 1px at 36% 33%,rgba(245,240,230,.45),transparent 2px),radial-gradient(1px 1px at 9% 44%,rgba(245,240,230,.4),transparent 2px),radial-gradient(1.2px 1.2px at 52% 21%,rgba(245,240,230,.5),transparent 2px),linear-gradient(180deg,#07170F 0%,#0B231A 62%)}
  .ng--porte h2{font-size:34px}
}
/* téléphone : un panneau qui monte du bas, titre, champs, bouton, un seul lien pour basculer */
.ng-sw{display:none}
@media (max-width:759px){
  .ng-bg:has(.ng--porte){padding:0;align-items:flex-end}
  .ng--porte{max-width:none;border-radius:28px 28px 0 0;max-height:calc(100dvh - 20px)}
  .ng--porte .ng-tabs,.ng--porte .ng-note,.ng--porte .ng-hint{display:none!important}
  .ng--porte .ng-row{display:flex;justify-content:flex-end}
  .ng-sw{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 6px;margin:16px 0 0!important;color:#8F846F;font-size:15px!important}
  .ng-sw span:empty{display:none}
  .ng-sw .ng-link{min-height:44px;font-size:15px;font-weight:600}
}
/* scène */
.pt{isolation:isolate}.pt-cv{position:absolute;inset:0;display:block}
.pt-txt{position:absolute;left:22px;right:22px;bottom:16px;transition:opacity .42s cubic-bezier(.2,.8,.2,1),transform .42s cubic-bezier(.2,.8,.2,1)}
.pt-txt.is-out{opacity:0;transform:translateY(6px)}
.pt-k{display:flex;align-items:center;gap:8px;color:#CFC4B1;font:500 12.5px/1 Jost,sans-serif}.pt-k em{font-style:normal}
.pt-k i{width:9px;height:9px;flex:none}.pt-k i.pt-i-v, .pt-k i.pt-i-a{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;border-radius:50%;background:rgba(108,197,140,.22);box-shadow:inset 0 0 0 1px rgba(108,197,140,.55);font:normal 11px/1 "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}.pt-k i.pt-i-v::before,.pt-k i.pt-i-a::before{content:"";display:block;width:74%;height:74%;background:var(--sym-o) center/contain no-repeat}.pt-k i.pt-i-a{border-radius:30%;background:rgba(242,194,48,.24);box-shadow:inset 0 0 0 1px rgba(242,194,48,.6)}.pt-k i.pt-i-a::before{content:"";display:block;width:74%;height:74%;background:var(--sym-d) center/contain no-repeat}.pt-i-l{height:2px!important;width:14px!important;border-radius:1px;background:#6AAEF0}
.pt-m{margin:6px 0 0!important;max-width:22ch;color:#F5F0E6!important;font:600 17px/1.15 Jost,sans-serif!important;letter-spacing:-.015em;text-wrap:balance;text-shadow:0 2px 18px rgba(10,9,7,.9)}
.pt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (min-width:760px){.pt-txt{left:40px;right:40px;bottom:40px}.pt-m{font-size:clamp(34px,3.4vw,46px)!important;line-height:1.05!important;max-width:16ch}.pt-k{font-size:13.5px}}
@media (prefers-reduced-motion:reduce){.pt-txt,.ng-ck,.ng-glob{transition:none;animation:none}}`;
  const groupe = c => String(c || '').replace(/(.{4})(?=.)/g, '$1 ');
  function style() { if (!css) { const st = document.createElement('style'); st.textContent = CSS + CSS2; document.head.appendChild(st); css = true; } }
  // fenêtre modale : le focus y entre, y reste (Tab boucle), et revient d'où il venait à la fermeture
  function piege(root) {
    const avant = document.activeElement;
    const focusables = () => [...root.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    const onTab = e => { if (e.key !== 'Tab') return; const f = focusables(); if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
    root.addEventListener('keydown', onTab);
    // téléphone : quand le clavier s'ouvre, le champ touché remonte au milieu de la fenêtre (il n'est plus caché sous le clavier)
    const onFocus = e => { if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !matchMedia('(pointer:coarse)').matches) return; setTimeout(() => { try { const r = e.target.getBoundingClientRect(), vh = (window.visualViewport && visualViewport.height) || innerHeight; if (r.bottom > vh - 16 || r.top < 0) e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }, 320); };
    root.addEventListener('focusin', onFocus);
    return () => { root.removeEventListener('keydown', onTab); if (avant && avant.focus && document.contains(avant)) setTimeout(() => avant.focus({ preventScroll: true }), 0); };
  }
  function shell(html, opt = {}) {
    style();
    document.querySelector('.ng-bg')?.remove();
    const bg = document.createElement('div'); bg.className = 'ng-bg';
    bg.innerHTML = opt.porte ? `<div class="ng ng--porte" role="dialog" aria-modal="true" aria-labelledby="ngT"><div class="ng-scene"></div><div class="ng-form"><button type="button" class="ng-x" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button>${html}</div></div>` : `<div class="ng" role="dialog" aria-modal="true" aria-labelledby="ngT"><button type="button" class="ng-x" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button>${html}</div>`;
    document.body.appendChild(bg);
    if (opt.porte && window.MDGPorte) bg.porte = MDGPorte.monter(bg.querySelector('.ng-scene'), { compact: !matchMedia('(min-width:760px)').matches });
    const rendre = piege(bg), close = () => { if (bg.porte) bg.porte.arreter(); bg.remove(); removeEventListener('keydown', onK); rendre(); }, onK = e => { if (e.key === 'Escape' && !bg.dataset.lock) close(); };
    addEventListener('keydown', onK); bg.addEventListener('click', e => { if (e.target === bg && !bg.dataset.lock) close(); }); bg.querySelector('.ng-x').onclick = close;
    bg.close = close; return bg;
  }
  // le code de secours n'est montré qu'une fois : on demande de confirmer qu'il est noté
  function showSecours(cle, apres) {
    const bg = shell(`<h2 id="ngT">Votre code de secours</h2>
      <p>Si vous oubliez votre code secret, ce code vous permet d’en choisir un nouveau. Notez-le sur papier ou prenez une photo de cet écran.</p>
      <div class="ng-ticket"><output>${esc(groupe(cle))}</output><small>Il ne sera plus affiché. Personne d’autre ne peut le voir, même pas le Marché de Gros.</small></div>
      <button type="button" class="ng-alt ng-copy">Copier le code</button>
      <button type="button" class="ng-go ng-ok">J’ai noté mon code de secours</button>`);
    bg.dataset.lock = '1'; bg.querySelector('.ng-x').hidden = true;
    bg.querySelector('.ng-copy').onclick = e => { (navigator.clipboard ? navigator.clipboard.writeText(cle) : Promise.reject()).then(() => { e.target.textContent = 'Code copié'; }).catch(() => { e.target.textContent = 'Copie impossible : notez-le à la main'; }); };
    bg.querySelector('.ng-ok').onclick = () => { bg.close(); apres && apres(); };
  }
  function open(raison) {
    const s = session();
    if (s) return window.MDGCompte ? MDGCompte.ouvrir() : openCompte(s, waiting());
    const TITRE = { in: raison === 'publie' ? 'Rendez votre annonce visible de tous' : raison === 'negocie' ? 'Connectez-vous pour proposer un prix' : 'Entrez dans le marché.', up: 'Rejoignez le marché.', sos: 'Choisir un nouveau code' };
    const LEDE = {
      in: raison === 'publie' ? 'Elle est enregistrée sur ce téléphone. Connectez-vous pour que les acheteurs et les vendeurs de tout le pays la voient.' : raison === 'negocie' ? 'Le vendeur doit savoir qui lui écrit. Votre numéro et votre code secret suffisent.' : '',
      up: '',
      sos: 'Votre numéro, le code de secours reçu à la création du compte, puis un nouveau code secret.' };
    const BTN = { in: 'Se connecter', up: 'Créer mon compte', sos: 'Choisir mon nouveau code' }, ENC = { in: 'Connexion en cours', up: 'Création du compte', sos: 'Vérification du code de secours' };
    const bg = shell(`<h2 id="ngT"></h2><p class="ng-lede"></p>
        <div class="ng-tabs" role="tablist" aria-label="Connexion ou inscription"><button type="button" role="tab" data-m="in" aria-selected="true">J’ai déjà un compte</button><button type="button" role="tab" data-m="up" aria-selected="false">Créer mon compte</button></div>
        <div class="ng-glob" role="alert" hidden><p></p><button type="button" class="ng-link" hidden></button></div>
        <form novalidate>
          <div class="ng-id" hidden>
            <div class="ng-id2"><div class="ng-fd"><label for="ngPrenom">Prénom</label><div class="ng-ip"><input id="ngPrenom" autocomplete="given-name" maxlength="40" placeholder="Awa" aria-describedby="ngPrenomE"></div><p class="ng-fe" id="ngPrenomE"></p></div>
            <div class="ng-fd"><label for="ngNom">Nom</label><div class="ng-ip"><input id="ngNom" autocomplete="family-name" maxlength="60" placeholder="Koné" aria-describedby="ngNomE"></div><p class="ng-fe" id="ngNomE"></p></div></div>
            <div class="ng-fd"><label for="ngPseudo">Pseudonyme <i>facultatif</i></label><div class="ng-ip"><input id="ngPseudo" autocomplete="nickname" autocapitalize="off" spellcheck="false" maxlength="24" placeholder="awa_mais" aria-describedby="ngPseudoE"><b class="ng-ck" aria-hidden="true"></b></div><p class="ng-fe" id="ngPseudoE"></p></div>
          </div>
          <div class="ng-fd"><label for="ngTel">Votre numéro</label><div class="ng-ip ng-ip--tel"><span aria-hidden="true">+225</span><input id="ngTel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="07 01 02 03 04" maxlength="14" aria-describedby="ngTelE"><b class="ng-ck" aria-hidden="true"></b></div><p class="ng-fe" id="ngTelE"></p></div>
          <div class="ng-fd ng-cle" hidden><label for="ngCle">Code de secours <i>12 caractères</i></label><div class="ng-ip"><input id="ngCle" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" placeholder="ABCD EFGH JKLM" aria-describedby="ngCleE"></div><p class="ng-fe" id="ngCleE"></p></div>
          <div class="ng-fd"><label for="ngCode" class="ng-lc">Code secret <i>6 chiffres</i></label><div class="ng-ip"><input id="ngCode" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="6" placeholder="••••••" aria-describedby="ngCodeE"><button type="button" class="ng-eye" aria-pressed="false">Afficher</button></div><p class="ng-fe" id="ngCodeE"></p></div>
          <div class="ng-fd ng-c2" hidden><label for="ngCode2">Retapez le code</label><div class="ng-ip"><input id="ngCode2" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password" maxlength="6" placeholder="••••••" aria-describedby="ngCode2E"><b class="ng-ck" aria-hidden="true"></b></div><p class="ng-fe" id="ngCode2E"></p></div>
          <div class="ng-row ng-oubli"><button type="button" class="ng-link">Code oublié ?</button></div>
          <button type="submit" class="ng-go"><span>Se connecter</span></button>
        </form>
        <p class="ng-sw"><span></span> <button type="button" class="ng-link"></button></p>
        <p class="ng-note">Gardez votre code secret pour vous, comme celui de Mobile Money. À la création du compte, vous recevez aussi un code de secours : notez-le.</p>`, { porte: true });
    let mode = 'in'; const f = bg.querySelector('form'), go = bg.querySelector('.ng-go'), $ = q => bg.querySelector(q), P = bg.porte;
    const digits = v => { let d = String(v || '').replace(/\D/g, ''); if (d.length > 10 && d.startsWith('225')) d = d.slice(3); return d.slice(0, 10); };
    const champErr = (id, msg) => { const i = $('#' + id), e = $('#' + id + 'E'); i.setAttribute('aria-invalid', msg ? 'true' : 'false'); i.closest('.ng-ip').classList.toggle('is-bad', !!msg); e.textContent = msg || ''; };
    const ok = (id, v) => $('#' + id).closest('.ng-ip').classList.toggle('is-ok', !!v);
    const glob = (msg, action, fn) => { const g = $('.ng-glob'); g.hidden = !msg; g.querySelector('p').textContent = msg || ''; const b = g.querySelector('button'); b.hidden = !action; b.textContent = action || ''; b.onclick = fn || null; };
    const setMode = m => {
      mode = m; P && P.mode && P.mode(m); bg.querySelectorAll('.ng-tabs button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.m === m)));
      $('.ng-tabs').hidden = m === 'sos'; $('.ng-id').hidden = m !== 'up'; $('.ng-c2').hidden = m === 'in'; $('.ng-cle').hidden = m !== 'sos'; $('.ng-oubli').hidden = m !== 'in';
      const SW = { in: ['Pas encore de compte ?', 'Créer un compte', 'up'], up: ['Déjà un compte ?', 'Se connecter', 'in'], sos: ['', 'Retour à la connexion', 'in'] }[m];
      $('.ng-sw span').textContent = SW[0]; $('.ng-sw button').textContent = SW[1]; $('.ng-sw button').onclick = () => setMode(SW[2]);
      const t = $('#ngT'), dm = raison !== 'publie' && raison !== 'negocie' ? { in: 'Entrez dans le', up: 'Rejoignez le' }[m] : '';
      t.classList.toggle('ng-tt', !!dm);
      // le titre de la porte reprend le logo : « marché » crème, « de Gros » maïs, gras italique ; il se rejoue à chaque bascule.
      // « de Gros » passe à « du pays » 3 s après l'apparition, puis revient ; recommence toutes les 10 s (choix du propriétaire, 24/10/2026), en CSS seulement
      if (dm) { t.innerHTML = `<span class="ng-tt-a">${dm}</span><span class="ng-tt-b"><span class="ng-tt-m"><span>marché</span></span> <span class="ng-tt-g"><span class="ng-tt-pile"><span class="ng-tt-x"><span class="ng-tt-t">de Gros</span></span><span class="ng-tt-y" aria-hidden="true"><span class="ng-tt-t">du pays</span></span></span></span></span>`; t.classList.remove('is-on'); void t.offsetWidth; t.classList.add('is-on'); }
      else t.textContent = TITRE[m]; $('.ng-lede').textContent = LEDE[m]; $('.ng-lede').hidden = !LEDE[m];
      $('.ng-lc').innerHTML = (m === 'sos' ? 'Nouveau code secret' : m === 'up' ? 'Choisissez un code secret' : 'Code secret') + ' <i>6 chiffres</i>';
      $('#ngCode').autocomplete = m === 'in' ? 'current-password' : 'new-password'; go.querySelector('span').textContent = BTN[m]; glob('');
      ['ngCode', 'ngCode2', 'ngCle', 'ngPrenom', 'ngNom', 'ngPseudo'].forEach(id => champErr(id, '')); bg.querySelector('.ng-form').scrollTop = 0;
    };
    setMode('in');
    bg.querySelectorAll('.ng-tabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));
    $('.ng-oubli button').onclick = () => { setMode('sos'); $('#ngCle').focus(); };
    // numéro : chiffres groupés par deux pendant la saisie ; l'erreur n'apparaît qu'en quittant le champ
    const tel = $('#ngTel');
    tel.addEventListener('input', () => { const d = digits(tel.value); tel.value = d.replace(/(\d{2})(?=\d)/g, '$1 '); ok('ngTel', d.length === 10); if (d.length === 10) champErr('ngTel', ''); });
    tel.addEventListener('blur', () => { const d = digits(tel.value); champErr('ngTel', d && d.length !== 10 ? 'Le numéro fait 10 chiffres, par exemple 07 01 02 03 04.' : ''); });
    ['ngCode', 'ngCode2'].forEach(id => { const i = $('#' + id); i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); if (i.value.length === 6) champErr(id, ''); compare(); }); });
    $('#ngCode').addEventListener('blur', () => { const v = $('#ngCode').value; champErr('ngCode', v && v.length !== 6 ? 'Le code secret fait exactement 6 chiffres.' : ''); });
    const compare = () => { const a = $('#ngCode').value, b = $('#ngCode2').value; if (mode === 'in') return; ok('ngCode2', b.length === 6 && a === b); champErr('ngCode2', b.length === 6 && a !== b ? 'Les deux codes ne sont pas identiques.' : ''); };
    const eye = $('.ng-eye'); eye.onclick = () => { const on = eye.getAttribute('aria-pressed') !== 'true'; eye.setAttribute('aria-pressed', String(on)); eye.textContent = on ? 'Masquer' : 'Afficher'; ['ngCode', 'ngCode2'].forEach(id => { $('#' + id).type = on ? 'text' : 'password'; }); };
    f.addEventListener('focusin', () => P && P.etat('saisie'));
    const me = (window.MDGApp && J('mdg-app:moi', {}).phone) || ''; if (me) { tel.value = fmtTel(digits(me)); ok('ngTel', digits(me).length === 10); }
    setTimeout(() => $(me ? '#ngCode' : '#ngTel').focus(), 80);
    // identité à l'inscription : prénom et nom ; pseudonyme facultatif (s'il est rempli : unique, vérifié avant de créer le compte)
    const idErr = () => { const pr = $('#ngPrenom').value.trim(), no = $('#ngNom').value.trim(), ps = $('#ngPseudo').value.trim(), L = /^[\p{L}][\p{L} '’.-]*$/u;
      return { ngPrenom: !pr ? 'Entrez votre prénom.' : !L.test(pr) ? 'Des lettres uniquement (espaces, tirets et apostrophes acceptés).' : '',
        ngNom: !no ? 'Entrez votre nom.' : !L.test(no) ? 'Des lettres uniquement.' : '',
        ngPseudo: ps && !/^[A-Za-z0-9_.-]{3,24}$/.test(ps) ? '3 à 24 caractères : lettres sans accent, chiffres, point, tiret ou _.' : '' }; };
    ['ngPrenom', 'ngNom', 'ngPseudo'].forEach(id => $('#' + id).addEventListener('blur', () => { if ($('#' + id).value) champErr(id, idErr()[id]); }));
    let pseudoT = 0; $('#ngPseudo').addEventListener('input', () => { const ps = $('#ngPseudo').value.trim(); ok('ngPseudo', false); clearTimeout(pseudoT); if (!/^[A-Za-z0-9_.-]{3,24}$/.test(ps) || !navigator.onLine) return;
      pseudoT = setTimeout(async () => { try { const libre = await rpc('pseudo_libre', { p: ps }, false); if ($('#ngPseudo').value.trim() !== ps) return; ok('ngPseudo', libre); champErr('ngPseudo', libre ? '' : 'Ce pseudonyme est déjà pris. Essayez-en un autre.'); } catch (_) {} }, 400); });
    const valider = () => {
      const d = digits(tel.value), c = $('#ngCode').value, errs = [];
      if (d.length !== 10) errs.push(['ngTel', d ? 'Le numéro fait 10 chiffres, par exemple 07 01 02 03 04.' : 'Entrez votre numéro.']);
      if (mode === 'sos' && String($('#ngCle').value).replace(/[^A-Za-z0-9]/g, '').length !== 12) errs.push(['ngCle', 'Le code de secours fait 12 caractères.']);
      if (!/^\d{6}$/.test(c)) errs.push(['ngCode', c ? 'Le code secret fait exactement 6 chiffres.' : 'Entrez votre code secret.']);
      if (mode !== 'in' && c !== $('#ngCode2').value) errs.push(['ngCode2', 'Les deux codes ne sont pas identiques.']);
      if (mode === 'up') { const e = idErr(); ['ngPseudo', 'ngNom', 'ngPrenom'].forEach(k => { if (e[k]) errs.unshift([k, e[k]]); }); }
      ['ngPrenom', 'ngNom', 'ngPseudo', 'ngTel', 'ngCle', 'ngCode', 'ngCode2'].forEach(id => champErr(id, (errs.find(e => e[0] === id) || [])[1] || ''));
      if (errs.length) $('#' + errs[0][0]).focus();
      return !errs.length;
    };
    const occupe = on => { go.disabled = on; if (on) go.setAttribute('aria-busy', 'true'); else go.removeAttribute('aria-busy'); bg.querySelectorAll('.ng-tabs button,.ng-oubli button').forEach(b => { b.disabled = on; }); };
    f.onsubmit = async e => {
      e.preventDefault(); glob('');
      if (!valider()) return;
      if (!navigator.onLine) { glob('Pas de connexion internet. Vos annonces restent sur ce téléphone ; réessayez quand le réseau revient.', 'Réessayer', () => f.requestSubmit()); return; }
      const m0 = mode; occupe(true); go.querySelector('span').textContent = ENC[m0]; P && P.etat('envoi');
      try {
        const t = tel.value, c = $('#ngCode').value, ident = { prenom: $('#ngPrenom').value.trim(), nom: $('#ngNom').value.trim(), pseudo: $('#ngPseudo').value.trim() || null };
        if (m0 === 'up' && ident.pseudo) { const libre = await rpc('pseudo_libre', { p: ident.pseudo }, false).catch(() => true); if (!libre) throw new Error('PSEUDO_PRIS'); }
        const r = await (m0 === 'up' ? signUp(t, c) : m0 === 'sos' ? recover(t, $('#ngCle').value, c) : signIn(t, c));
        if (m0 === 'up') { try { await api('/rest/v1/profils', { method: 'POST', auth: true, body: Object.assign({ user_id: r.user.id }, ident), prefer: 'return=minimal' }).catch(e => { if (e.status === 409) return api('/rest/v1/profils?user_id=eq.' + r.user.id, { method: 'PATCH', auth: true, body: ident, prefer: 'return=minimal' }); throw e; }); say('compte'); } catch (e) { console.warn('[nuage] profil non enregistré', e.message); } }
        // réussite confirmée par le serveur : seulement maintenant
        // pas de message dans le bouton (demande du propriétaire) : il reste en attente, la notification de bienvenue suffit
        P && P.etat('ok');
        // l'accueil après la connexion : par son prénom, puis ce qui l'attend (messages, propositions), avec le geste pour y aller
        const fin = () => {
          const pf = window.MDGCompte && MDGCompte.profil ? (MDGCompte.profil() || {}) : {}, prenom = (m0 === 'up' ? ident.pseudo || ident.prenom : pf.pseudo || pf.prenom) || '';
          const qui = prenom ? ', *' + prenom.replace(/\*/g, '') + '*' : '';
          toast(m0 === 'up' ? 'Bienvenue' + (qui || ' sur le *marché*') : m0 === 'sos' ? 'Nouveau code enregistré' : 'Bon retour' + (qui || ' au *marché*'),
            { type: 'ok', sous: m0 === 'sos' ? 'Vous êtes connecté. Gardez ce code pour vous.' : 'Vos annonces partent sur le marché.' });
          if (m0 !== 'up') setTimeout(() => {
            const dm = window.MDGMessages && MDGMessages.unread ? MDGMessages.unread() : 0, ng = window.MDGNegoce && MDGNegoce.unread ? MDGNegoce.unread() : 0;
            if (!dm && !ng) return;
            const parts = [dm ? dm + ' message' + (dm > 1 ? 's' : '') : '', ng ? ng + ' proposition' + (ng > 1 ? 's' : '') : ''].filter(Boolean);
            toast(parts.join(' et ') + (dm + ng > 1 ? ' vous attendent' : ' vous attend'), { type: 'info', action: { t: 'Voir', fn: () => { if (ng && window.MDGNegoce) MDGNegoce.inbox(); else if (window.MDGMessages) MDGMessages.boite(); } } });
          }, 3200);
        };
        const bienvenue = () => { fin(); if (m0 === 'up' && window.MDGCompte) setTimeout(() => MDGCompte.bienvenue({ identite: true }), 300); };
        // application : on « entre dans le marché » (la porte s'ouvre, on la traverse) avant la suite (code de secours, bienvenue)
        const suite = () => { if (r && r.secours) showSecours(r.secours, bienvenue); else bienvenue(); };
        setTimeout(() => {
          const fermer = () => { bg.close(); dispatchEvent(new CustomEvent('mdg:connecte', { detail: { raison } })); };
          // la transition recouvre d'abord la fenêtre de connexion, qui se ferme dessous (pas d'éclair de l'accueil entre les deux)
          if (window.MDGPorte && MDGPorte.entrer && document.documentElement.hasAttribute('data-app')) MDGPorte.entrer(suite, fermer); else { fermer(); suite(); }
        }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 750);
      } catch (x) {
        occupe(false); go.querySelector('span').textContent = BTN[mode]; P && P.etat('erreur'); setTimeout(() => P && P.etat('saisie'), 1400);
        const msg = String(x.message || '');
        if (msg === 'Failed to fetch') glob('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.', 'Réessayer', () => f.requestSubmit());
        else if (/incorrect|invalid/i.test(msg) && mode === 'in') { glob('Numéro ou code secret incorrect. Vérifiez les deux.', 'Code oublié ?', () => { setMode('sos'); $('#ngCle').focus(); }); $('#ngCode').select(); }
        else if (msg === 'PSEUDO_PRIS') { champErr('ngPseudo', 'Ce pseudonyme est déjà pris. Essayez-en un autre.'); $('#ngPseudo').focus(); }
        else if (/déjà un compte/i.test(msg)) glob('Ce numéro a déjà un compte.', 'Me connecter avec ce numéro', () => { setMode('in'); $('#ngCode').focus(); });
        else if (/rate|too many|trop de|429/i.test(msg + (x.status || ''))) glob('Trop d’essais d’affilée. Attendez quelques minutes, puis réessayez.');
        else if (/trop facile/i.test(msg)) { champErr('ngCode', msg); $('#ngCode').focus(); }
        else if (/secours/i.test(msg) && mode === 'sos') champErr('ngCle', msg);
        else glob(msg);
      }
    };
  }
  async function openCompte(s, n) {
    const N = window.MDGNegoce, nonLus = N ? N.unread() : 0;
    const CHEVD = (window.MDGIco && window.MDGIco.svg('suite', 18, 2)) || '›';   // chevron Lucide (app/icones.js)
    const bg = shell(`<h2 id="ngT">Mon compte</h2><div class="ng-me"><p style="margin:0">Connecté avec le numéro</p><b>${esc(fmtTel(s.user.tel))}</b>
      <p>${n ? n + (n > 1 ? ' annonces attendent' : ' annonce attend') + ' le réseau pour partir.' : 'Vos annonces sont visibles de tous.'}</p>
      <div class="ng-sos"></div>
      <div class="ng-list">
        ${N ? `<button type="button" class="ng-item ng-nego"><span>Mes négociations<small>Prix proposés, réponses et accords</small></span>${nonLus ? `<span class="ng-dot" aria-label="${nonLus} non lues">${nonLus}</span>` : `<i aria-hidden="true">${CHEVD}</i>`}</button>` : ''}
        ${window.MDGMessages ? `<button type="button" class="ng-item ng-dm"><span>Messages<small>Écrire directement à un membre · effacés après ${MDGMessages.JOURS} jours</small></span>${MDGMessages.unread() ? `<span class="ng-dot" aria-label="${MDGMessages.unread()} non lus">${MDGMessages.unread()}</span>` : `<i aria-hidden="true">${CHEVD}</i>`}</button>` : ''}
        <a class="ng-item ng-admin" href="admin.html" hidden><span>Tableau de bord<small>Administration : annonces, comptes, signalements</small></span><i aria-hidden="true">${CHEVD}</i></a>
      </div>
      <button type="button" class="ng-out">Me déconnecter</button></div>`);
    bg.querySelector('.ng-out').onclick = () => { signOut(); bg.close(); toast('Déconnecté. Vos annonces restent publiées.'); };
    const ng = bg.querySelector('.ng-nego'); if (ng) ng.onclick = () => { bg.close(); N.inbox(); };
    const dm = bg.querySelector('.ng-dm'); if (dm) dm.onclick = () => { bg.close(); MDGMessages.boite(); };
    if (J(K.a, false)) bg.querySelector('.ng-admin').hidden = false;
    isAdmin().then(a => { bg.querySelector('.ng-admin').hidden = !a; });
    if (!navigator.onLine) return;
    try {
      if (!(await rpc('a_secours'))) {
        const box = bg.querySelector('.ng-sos');
        box.innerHTML = `<p class="ng-warn">Vous n’avez pas encore de code de secours. Sans lui, un code secret oublié ne peut pas être récupéré.</p><button type="button" class="ng-go">Créer mon code de secours</button>`;
        box.querySelector('button').onclick = async e => { e.target.disabled = true; try { const c = await rpc('creer_secours'); bg.close(); showSecours(c, () => toast('Code de secours enregistré.')); } catch (x) { e.target.disabled = false; toast('Impossible pour l’instant : ' + x.message); } };
      }
    } catch (_) {}
  }

  /* ——— cycle de vie ——— */
  let lastWait = waiting(), syncT = 0;
  // une nouvelle annonce sans compte : proposer de se connecter (une fois par annonce)
  function onLocalChange() {
    const n = waiting();
    if (!session() && n > lastWait) { const vu = J(K.vu, 0); if (n > vu) { W(K.vu, n); setTimeout(() => open('publie'), 900); } }
    lastWait = n; clearTimeout(syncT); syncT = setTimeout(sync, 400);
  }
  addEventListener('mdg:change', e => { if (!e.detail || e.detail.from !== 'nuage') onLocalChange(); });
  addEventListener('mdg:publie', onLocalChange);
  addEventListener('online', () => { sync().then(refresh); });
  addEventListener('storage', e => { if (e.key && e.key.startsWith('mdg-v2:')) onLocalChange(); });
  const age = Date.now() - (J(K.t, 0) || 0);
  if (age > 60000) setTimeout(refresh, 300); setTimeout(() => sync().then(pullMine), 1200);
  setInterval(() => { if (!document.hidden) refresh(); }, 120000);

  // envoi d'un fichier dans Supabase Storage (photo de profil) : remplace l'ancien s'il existe
  async function televerser(chemin, blob) {
    const s = await token(); if (!s) throw Object.assign(new Error('non connecté'), { code: 'auth' });
    const r = await fetch(URL0 + '/storage/v1/object/' + chemin, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'x-upsert': 'true', 'Content-Type': blob.type || 'image/jpeg', 'Cache-Control': '3600' }, body: blob });
    if (!r.ok) { let m = ''; try { const j = await r.json(); m = j.message || j.error || ''; } catch (_) {} throw Object.assign(new Error(m || 'Envoi refusé (' + r.status + ')'), { status: r.status }); }
    return true;
  }
  // espace privé (pièces d'identité) : dépôt sans remplacement, effacement, lien signé de courte durée (administrateurs)
  async function stockage(path, { method = 'POST', body, type, json = true } = {}) {
    const s = await token(); if (!s) throw Object.assign(new Error('non connecté'), { code: 'auth' });
    const h = { apikey: KEY, Authorization: 'Bearer ' + s.access_token };
    if (json) h['Content-Type'] = 'application/json'; else { h['Content-Type'] = type || 'image/jpeg'; h['x-upsert'] = 'false'; }
    const r = await fetch(URL0 + '/storage/v1/' + path, { method, headers: h, body: json && body ? JSON.stringify(body) : body });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    if (!r.ok) throw Object.assign(new Error((j && (j.message || j.error)) || ('Envoi refusé (' + r.status + ')')), { status: r.status, body: j });
    return j;
  }
  const deposerPrive = (bucket, chemin, blob) => stockage('object/' + bucket + '/' + chemin, { body: blob, type: blob.type, json: false });
  const effacerPrive = (bucket, chemins) => stockage('object/' + bucket, { method: 'DELETE', body: { prefixes: chemins } });
  const lienSigne = (bucket, chemin, secondes = 60) => stockage('object/sign/' + bucket + '/' + chemin, { body: { expiresIn: secondes } }).then(j => j && j.signedURL ? URL0 + '/storage/v1' + j.signedURL : null);
  // ——— clavier du téléphone : sur iPhone, la page ne rétrécit pas quand le clavier s'ouvre ; seule la zone visible (visualViewport) rétrécit.
  // Les fenêtres posées par-dessus (connexion, Mon espace, négociation) suivent donc cette zone visible : elles tiennent au-dessus du clavier
  // et défilent à l'intérieur, au lieu de cacher les champs du bas sous le clavier. Clavier ouvert : l'image de la porte se replie.
  (function clavier() {
    const vv = window.visualViewport; if (!vv) return;
    const st = document.createElement('style');
    st.textContent = `@media (pointer:coarse){
.ng-bg,.cp-bg,.nx-bg{top:var(--vvt,0px)!important;bottom:auto!important;height:var(--vvh,100%)!important;transition:height .18s ease}
.ng{max-height:calc(var(--vvh,100dvh) - 32px)}
.ng--porte{max-height:calc(var(--vvh,100dvh) - 16px)!important}
.cp{height:min(calc(var(--vvh,100dvh) * .94),820px)!important}
.nx{height:min(calc(var(--vvh,100dvh) * .92),820px)!important}
html.kb .ng-bg{padding:8px!important}
html.kb .ng-bg:has(.ng--porte){padding:0!important}
html.kb .ng--porte{grid-template-rows:0 minmax(0,1fr)!important;max-height:calc(var(--vvh,100dvh) - 16px)!important}
html.kb .ng--porte .ng-scene{border:0}
html.kb .ng--porte .ng-form{padding-top:20px}
html.kb .ng--porte h2{padding-right:48px}
html.kb .cp,html.kb .nx{height:calc(var(--vvh,100dvh) - 8px)!important}}`;
    document.head.appendChild(st);
    const de = document.documentElement; let raf = 0;
    const maj = () => { raf = 0; de.style.setProperty('--vvh', vv.height + 'px'); de.style.setProperty('--vvt', vv.offsetTop + 'px'); de.classList.toggle('kb', vv.height < de.clientHeight * .78); };
    const plan = () => { if (!raf) raf = requestAnimationFrame(maj); };
    vv.addEventListener('resize', plan); vv.addEventListener('scroll', plan); maj();
  })();

  /* ——— pas de liens ni d'hameçonnage (mêmes règles que supabase/schema-22-sans-liens.sql, vérifiées aussi par la base) ——— */
  const TLD = 'com|net|org|ci|fr|info|biz|io|me|ly|app|xyz|site|online|shop|store|link|click|top|africa|gl|gd|to|cc|tv|page|dev|live|club|vip|pro|be|ch|ca|us|uk|gg|ws|im|sn|cm|bf|ml|tg|bj|gh|ng';
  const RX = {
    mail: /[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9-]+\s?\.\s?[a-z]{2,}/i,
    lien: [/(h\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\/|\bwww\s*\.|\bwww\b)/i, new RegExp('\\b[a-z0-9-]*[a-z][a-z0-9-]*(\\s?\\.|\\s?(\\(\\.\\)|\\[\\.\\]|\\(dot\\)|\\[dot\\])\\s?)(' + TLD + ')\\b', 'i'), /\b(point|dot)\s+(com|net|org|info)\b/i],
    reseau: /(\b(face\s*-?\s*book|fb|fbk|f\s*\.\s*b|insta|instagram|instagr\w*|tik\s*-?\s*tok|tiktok|snap|snapchat|whats?\s*-?\s*app?|wh?ats?\s*app+|wh?atsap+|whatsap+|wasap+|watsap+|wtsp|whtsp|wsp|t[eé]l[eé]gram+|messenger|youtube|you\s*tube|linked\s*in|linkedin|twitter|threads)(?![\wÀ-ÿ])|\b(sur|mon|ma|via|par|en)\s+(wa|signal|ig|x)(?![\wÀ-ÿ])|(^|[\s(:])@[a-z0-9_.]{3,})/i,
    ussd: /(\*\s*\d{2,4}\s*(\*\s*\d*\s*)*#|#\s*\d{3}\s*#)/,
    tel: /((\+|00)\s*225([\s.\-]*\d){8,10}|\b(0[157]|2[157])([\s.\-]*\d){8}\b)/,
    code: /(mot\s+de\s+passe|code\s+(secret|confidentiel|pin|otp|sms|de\s+(confirmation|validation|v[ée]rification|retrait|s[ée]curit[ée]|connexion|secours)))/i
  };
  function texteRefus(t) {
    t = String(t || ''); if (!t.trim() || J(K.a, false) === true) return '';   // l'administrateur peut écrire des liens
    if (RX.mail.test(t)) return 'Pas d’adresse e-mail ici : pour votre sécurité, échangez uniquement dans l’application.';
    if (RX.lien.some(r => r.test(t))) return 'Pas de lien ici : pour votre sécurité, les adresses de sites (www, .com, .ci…) sont interdites sur le Marché de Gros, même la nôtre. Échangez uniquement dans l’application.';
    if (RX.reseau.test(t)) return 'Pas de réseaux sociaux ici (Facebook, WhatsApp, Instagram, TikTok…) : pour votre sécurité, échangez uniquement dans l’application.';
    if (RX.ussd.test(t)) return 'Pas de code de transfert à taper (*144*…#) : c’est une ruse fréquente pour faire envoyer de l’argent. Ne payez qu’à la livraison, après avoir vu la marchandise.';
    if (RX.tel.test(t)) return 'Pas de numéro de téléphone ici : pour votre sécurité, les numéros restent cachés sur le Marché de Gros. Échangez avec le bouton « Écrire ».';
    if (RX.code.test(t)) return 'Pour votre sécurité, on ne parle pas de code secret ni de mot de passe ici. Le Marché de Gros ne vous les demandera jamais : ne les donnez à personne.';
    return '';
  }

  window.MDGNuage = { prolonger, texteRefus, URL: URL0, televerser, deposerPrive, effacerPrive, lienSigne, list, zones, zoneAjouter, zoneRetirer, refresh, sync, session, open, signIn, signUp, signOut, recover, report, waiting, toast, api, rpc, isAdmin, pullMine, esc, fmtTel, style, piege, showSecours, openCompte };
})();
