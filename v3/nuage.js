/* ═════════ Marché de Gros CI — Nuage : les annonces partagées entre tous les téléphones ═════════
   Base Supabase (formule gratuite). Le site et l'application utilisent ce même module (même stockage).
   • Lire : tout le monde, sans compte. Les annonces des autres sont gardées en cache sur l'appareil (visibles hors connexion).
   • Publier : compte = numéro de téléphone + code secret à 6 chiffres (pas de SMS : aucun frais).
     Une annonce publiée sans réseau ou sans compte reste sur le téléphone, puis part toute seule (connexion revenue, compte ouvert).
   • « Mes annonces » restent dans mdg-v2:offres / mdg-v2:demandes (inchangé) ; le cache des autres est séparé (mdg-nuage:*).
   • Aucune donnée inventée : seules les annonces réellement publiées apparaissent.
   API : MDGNuage.list(kind) · refresh() · sync() · session() · open(raison) · signOut() · report(kind, id, motif)
   Événements : « mdg:change » (l'application relit), « mdg:nuage » (le site relit). */
(function () {
  'use strict';
  const URL0 = 'https://catmsypctymgkjkfzdkt.supabase.co', KEY = 'sb_publishable_KC2au-t8dqasp5ez9Lq6XQ_JvbTtVQ5';
  const DOMAINE = 'tel.marchedegros.ci'; // le compte Supabase est une adresse construite à partir du numéro (aucun e-mail n'est envoyé)
  const K = { s: 'mdg-nuage:session', o: 'mdg-nuage:offres', d: 'mdg-nuage:demandes', p: 'mdg-nuage:pousse', t: 'mdg-nuage:maj', vu: 'mdg-nuage:attente-vue' };
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
    if (!r.ok) throw Object.assign(new Error((j && (j.msg || j.message || j.error_description || j.error)) || ('Erreur ' + r.status)), { status: r.status, body: j });
    return j;
  }

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
    const s = keep(j); s.user.tel = s.user.tel || t; W(K.s, s); say('compte'); sync(); return s;
  }
  async function signUp(tel, code) {
    const t = tel10(tel); if (!t) throw new Error('Numéro à 10 chiffres, par exemple 07 01 02 03 04.');
    if (!/^\d{6}$/.test(code)) throw new Error('Le code secret fait 6 chiffres.');
    if (/^(\d)\1{5}$/.test(code) || code === '123456' || code === '654321') throw new Error('Code trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.');
    const j = await api('/auth/v1/signup', { method: 'POST', body: { email: email(t), password: code, data: { tel: t } } })
      .catch(e => { throw /already|registered|exists/i.test(e.message) ? new Error('Ce numéro a déjà un compte. Choisissez « J’ai déjà un compte ».') : e; });
    if (!j || !j.access_token) throw new Error('Compte créé, mais la connexion a échoué. Réessayez avec « J’ai déjà un compte ».');
    const s = keep(j); s.user.tel = t; W(K.s, s); say('compte'); sync(); return s;
  }
  async function signOut() { const s = session(); localStorage.removeItem(K.s); say('compte'); if (s) fetch(URL0 + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(() => {}); }

  /* ——— les annonces des autres (cache local) ——— */
  const fromRow = {
    offres: r => ({ id: 'n-' + r.id, _remote: true, _rid: r.id, client_id: r.client_id, productSlug: r.product_slug, productLabel: r.product_label, productName: r.product_label, regionSlug: r.region_slug, city: r.city || '', quantity: num(r.quantity) || 0, unit: r.unit || 'kg', price: num(r.price), availableFrom: r.available_from || 'maintenant', createdAt: r.created_at, producer: { name: r.seller_name || 'Vendeur', phone: r.phone || '' }, producerName: r.seller_name || 'Vendeur', agent: r.agent || '' }),
    demandes: r => ({ id: 'n-' + r.id, _remote: true, _rid: r.id, client_id: r.client_id, productSlug: r.product_slug, productLabel: r.product_label, productName: r.product_label, regionSlug: r.region_slug, city: r.city || '', quantity: num(r.quantity) || 0, unit: r.unit || 'kg', budget: num(r.budget), deadline: r.deadline || 'semaine', buyerType: r.buyer_type || 'Acheteur', buyerName: r.buyer_name || 'Acheteur', phone: r.phone || '', buyerContact: { tel: r.phone || '' }, createdAt: r.created_at }),
  };
  const toRow = {
    offres: o => ({ client_id: txt(o.id, 60), product_slug: txt(o.productSlug, 80), product_label: txt(o.productLabel || o.productName, 120), region_slug: txt(o.regionSlug, 60), city: txt(o.city, 80), quantity: num(o.quantity), unit: txt(o.unit, 20), price: num(o.price), available_from: txt(o.availableFrom, 40), seller_name: txt((o.producer && o.producer.name) || o.producerName, 80), phone: tel10((o.producer && o.producer.phone) || o.phone), agent: txt(o.agent, 80) || null }),
    demandes: d => ({ client_id: txt(d.id, 60), product_slug: txt(d.productSlug, 80), product_label: txt(d.productLabel || d.productName, 120), region_slug: txt(d.regionSlug, 60), city: txt(d.city, 80), quantity: num(d.quantity), unit: txt(d.unit, 20), budget: num(d.budget), deadline: txt(d.deadline, 40), buyer_type: txt(d.buyerType, 60), buyer_name: txt(d.buyerName, 80), phone: tel10(d.phone || (d.buyerContact && d.buyerContact.tel)) }),
  };
  // annonces des autres seulement : celles publiées depuis ce téléphone sont déjà dans « mes annonces »
  function list(kind) {
    const mine = new Set(local(kind).map(x => x.id)), cache = J(kind === 'offres' ? K.o : K.d, []);
    return cache.filter(x => x && x.productSlug !== undefined && !mine.has(x.client_id));
  }
  let busy = 0;
  async function refresh() {
    if (!navigator.onLine || busy & 1) return false; busy |= 1;
    try {
      const sel = '?select=*&status=eq.active&order=created_at.desc&limit=500';
      const [o, d] = await Promise.all([api('/rest/v1/offres' + sel), api('/rest/v1/demandes' + sel)]);
      const sig = x => (x || []).map(r => r.id).join(','), was = sig(J(K.o, []).map(x => ({ id: x._rid }))) + '|' + sig(J(K.d, []).map(x => ({ id: x._rid })));
      W(K.o, (o || []).map(fromRow.offres)); W(K.d, (d || []).map(fromRow.demandes)); W(K.t, Date.now());
      if (was !== sig(o) + '|' + sig(d)) say('liste'); // ne prévenir que s'il y a du nouveau
      return true;
    } catch (e) { console.warn('[nuage] lecture impossible', e.message); return false; }
    finally { busy &= ~1; }
  }

  /* ——— mes annonces : envoyer celles qui attendent, retirer celles supprimées sur le téléphone ——— */
  const waiting = () => { const p = J(K.p, {}); return ['offres', 'demandes'].reduce((n, k) => n + local(k).filter(x => x.productSlug && x.regionSlug && !p[k + ':' + x.id]).length, 0); };
  async function sync() {
    if (!navigator.onLine || busy & 2 || !session()) return false; busy |= 2; let changed = false;
    try {
      const p = J(K.p, {});
      for (const k of ['offres', 'demandes']) {
        const L = local(k), ids = new Set(L.map(x => x.id));
        for (const x of L) {
          if (p[k + ':' + x.id] || !x.productSlug || !x.regionSlug) continue;
          try { const r = await api('/rest/v1/' + KIND[k] + '?on_conflict=user_id,client_id', { method: 'POST', body: toRow[k](x), auth: true, prefer: 'return=representation,resolution=merge-duplicates' }); if (r && r[0]) { p[k + ':' + x.id] = r[0].id; changed = true; W(K.p, p); } }
          catch (e) { if (e.code === 'auth') throw e; console.warn('[nuage] envoi refusé', e.message); if (/Limite atteinte/.test(e.message)) toast(e.message); }
        }
        for (const key of Object.keys(p)) {
          if (!key.startsWith(k + ':') || ids.has(key.slice(k.length + 1))) continue;
          try { await api('/rest/v1/' + KIND[k] + '?id=eq.' + encodeURIComponent(p[key]), { method: 'DELETE', auth: true }); delete p[key]; changed = true; W(K.p, p); }
          catch (e) { if (e.code === 'auth') throw e; if (e.status === 404) { delete p[key]; W(K.p, p); } }
        }
      }
    } catch (e) { if (e.code !== 'auth') console.warn('[nuage] synchronisation interrompue', e.message); }
    finally { busy &= ~2; }
    if (changed) { refresh(); say('mes'); }
    return changed;
  }
  async function report(kind, rid, motif) {
    const cible = kind === 'demandes' || kind === 'demande' ? 'demande' : 'offre';
    await api('/rest/v1/signalements', { method: 'POST', body: { cible, cible_id: rid, motif: txt(motif, 300) || null }, auth: !!session(), prefer: 'return=minimal' });
    return true;
  }

  /* ——— fenêtre de connexion (site et application) ——— */
  const CSS = `.ng-bg{position:fixed;inset:0;z-index:9000;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;padding:16px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:ngIn .25s ease both}
@media (min-width:640px){.ng-bg{align-items:center}}
.ng{width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow:auto;background:#1d1a15;color:#F5F0E6;border-radius:28px;padding:24px 22px 22px;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:Jost,system-ui,sans-serif;animation:ngUp .35s cubic-bezier(.22,1,.36,1) both}
.ng h2{margin:0 0 6px;font:500 28px/1.1 'Cormorant Garamond',Georgia,serif}.ng p{margin:0 0 16px;color:#B9AD98;font-size:14.5px;line-height:1.5}
.ng-tabs{display:flex;gap:6px;margin:0 0 18px;padding:4px;border-radius:999px;background:rgba(245,240,230,.06)}
.ng-tabs button{flex:1;min-height:42px;border:0;border-radius:999px;background:none;color:#B9AD98;font:600 14px Jost,sans-serif;cursor:pointer}.ng-tabs button[aria-selected=true]{background:#F5F0E6;color:#171512}
.ng label{display:block;margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#B9AD98}
.ng input{width:100%;box-sizing:border-box;height:52px;margin:0 0 14px;padding:0 16px;border:1px solid rgba(245,240,230,.16);border-radius:16px;background:#14120f;color:#F5F0E6;font:500 18px Jost,sans-serif;letter-spacing:.06em}
.ng input:focus{outline:2px solid #E07A3F;outline-offset:1px;border-color:transparent}
.ng-go{width:100%;min-height:52px;border:0;border-radius:999px;background:#E07A3F;color:#171512;font:700 16px Jost,sans-serif;cursor:pointer}.ng-go[disabled]{opacity:.6}
.ng-x{float:right;width:40px;height:40px;margin:-6px -6px 0 0;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:#F5F0E6;font-size:20px;cursor:pointer}
.ng-err{min-height:20px;margin:-4px 0 12px;color:#F3B48A;font-size:14px}.ng-note{margin:14px 0 0;font-size:12.5px;color:#8f846f;line-height:1.5}
.ng-me{display:flex;flex-direction:column;gap:12px}.ng-me b{font:500 24px/1 'Cormorant Garamond',serif}.ng-out{min-height:48px;border:1px solid rgba(245,240,230,.2);border-radius:999px;background:none;color:#F5F0E6;font:600 15px Jost,sans-serif;cursor:pointer}
@keyframes ngIn{from{opacity:0}}@keyframes ngUp{from{transform:translateY(24px);opacity:0}}
@media (prefers-reduced-motion:reduce){.ng-bg,.ng{animation:none}}`;
  let css = false, toastT = 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTel = t => t ? String(t).replace(/(\d{2})(?=\d)/g, '$1 ') : '';
  function toast(m) {
    let el = document.getElementById('ngToast');
    if (!el) { el = document.createElement('div'); el.id = 'ngToast'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9100;max-width:min(92vw,440px);padding:12px 18px;border-radius:16px;background:#F5F0E6;color:#171512;font:600 14px/1.4 Jost,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);transition:opacity .3s'; document.body.appendChild(el); }
    el.textContent = m; el.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { el.style.opacity = '0'; }, 4200);
  }
  function open(raison) {
    if (!css) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); css = true; }
    document.querySelector('.ng-bg')?.remove();
    const bg = document.createElement('div'); bg.className = 'ng-bg'; const s = session(), n = waiting();
    bg.innerHTML = `<div class="ng" role="dialog" aria-modal="true" aria-labelledby="ngT"><button type="button" class="ng-x" aria-label="Fermer">×</button>` + (s
      ? `<h2 id="ngT">Mon compte</h2><div class="ng-me"><p>Connecté avec le numéro</p><b>${esc(fmtTel(s.user.tel))}</b><p>${n ? n + (n > 1 ? ' annonces attendent' : ' annonce attend') + ' le réseau pour partir.' : 'Vos annonces sont visibles de tous.'}</p><button type="button" class="ng-out">Me déconnecter</button></div>`
      : `<h2 id="ngT">${raison === 'publie' ? 'Rendez votre annonce visible de tous' : 'Se connecter'}</h2>
        <p>${raison === 'publie' ? 'Elle est enregistrée sur ce téléphone. Connectez-vous pour que les acheteurs et les vendeurs de tout le pays la voient.' : 'Votre numéro et un code secret à 6 chiffres. Pas besoin d’e-mail.'}</p>
        <div class="ng-tabs" role="tablist"><button type="button" role="tab" data-m="in" aria-selected="true">J’ai déjà un compte</button><button type="button" role="tab" data-m="up" aria-selected="false">Créer mon compte</button></div>
        <form novalidate><label for="ngTel">VOTRE NUMÉRO</label><input id="ngTel" inputmode="numeric" autocomplete="tel" placeholder="07 01 02 03 04" maxlength="16">
        <label for="ngCode">CODE SECRET (6 CHIFFRES)</label><input id="ngCode" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" placeholder="••••••">
        <div class="ng-c2" hidden><label for="ngCode2">RETAPEZ LE CODE</label><input id="ngCode2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" placeholder="••••••"></div>
        <p class="ng-err" role="alert"></p><button type="submit" class="ng-go">Se connecter</button></form>
        <p class="ng-note">Gardez votre code secret pour vous, comme celui de Mobile Money. Il n’y a pas encore de récupération par SMS : notez-le.</p>`) + `</div>`;
    document.body.appendChild(bg);
    const close = () => { bg.remove(); removeEventListener('keydown', onK); }, onK = e => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onK); bg.addEventListener('click', e => { if (e.target === bg) close(); }); bg.querySelector('.ng-x').onclick = close;
    if (s) { bg.querySelector('.ng-out').onclick = () => { signOut(); close(); toast('Déconnecté. Vos annonces restent publiées.'); }; return; }
    let mode = 'in'; const f = bg.querySelector('form'), err = bg.querySelector('.ng-err'), go = bg.querySelector('.ng-go');
    bg.querySelectorAll('.ng-tabs button').forEach(b => b.onclick = () => { mode = b.dataset.m; bg.querySelectorAll('.ng-tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b))); bg.querySelector('.ng-c2').hidden = mode !== 'up'; bg.querySelector('#ngCode').autocomplete = mode === 'up' ? 'new-password' : 'current-password'; go.textContent = mode === 'up' ? 'Créer mon compte' : 'Se connecter'; err.textContent = ''; });
    const me = (window.MDGApp && J('mdg-app:moi', {}).phone) || ''; if (me) bg.querySelector('#ngTel').value = fmtTel(me);
    setTimeout(() => bg.querySelector(me ? '#ngCode' : '#ngTel').focus(), 60);
    f.onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      const t = bg.querySelector('#ngTel').value, c = bg.querySelector('#ngCode').value.trim();
      if (mode === 'up' && c !== bg.querySelector('#ngCode2').value.trim()) { err.textContent = 'Les deux codes ne sont pas identiques.'; return; }
      if (!navigator.onLine) { err.textContent = 'Pas de connexion internet. Réessayez quand le réseau revient : vos annonces restent sur ce téléphone.'; return; }
      go.disabled = true; go.textContent = '…';
      try { await (mode === 'up' ? signUp(t, c) : signIn(t, c)); close(); toast(mode === 'up' ? 'Compte créé. Vos annonces partent maintenant.' : 'Connecté. Vos annonces partent maintenant.'); }
      catch (x) { err.textContent = x.message === 'Failed to fetch' ? 'Le serveur ne répond pas. Réessayez dans un instant.' : x.message; go.disabled = false; go.textContent = mode === 'up' ? 'Créer mon compte' : 'Se connecter'; }
    };
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
  if (age > 60000) setTimeout(refresh, 300); setTimeout(sync, 1200);
  setInterval(() => { if (!document.hidden) refresh(); }, 120000);

  window.MDGNuage = { list, refresh, sync, session, open, signIn, signUp, signOut, report, waiting, toast };
})();
