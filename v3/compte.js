/* ═════════ Marché de Gros CI — compte : profil, avatar, activité, notifications, préférences, sécurité ═════════
   Le site et l'application utilisent ce même espace (au-dessus de v3/nuage.js, v3/avatar.js, v3/negoce.js, v3/sons.js).
   • Le compte (numéro + code secret, Supabase Auth) reste séparé du profil (table profils : comment on vous appelle).
   • Le numéro n'est pas vérifié par SMS (service payant, non installé) : c'est écrit tel quel, jamais présenté comme vérifié.
   • Aucun réglage factice : ce qui n'existe pas encore est marqué « pas encore disponible ».
   • Aucune statistique inventée : seules vos annonces et négociations réelles sont comptées.
   API : MDGCompte.ouvrir(onglet) · bienvenue() · profil() · avatar(uid) · hydrate(root) · prefs() */
(function () {
  'use strict';
  const N = () => window.MDGNuage, A = () => window.MDGAvatar;
  const KP = 'mdg-compte:profil', KPF = 'mdg-compte:prefs', KN = 'mdg-notifs', KC = 'mdg-nuage:profils';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null || isNaN(n) ? '—' : Math.round(+n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const me = () => { const s = N() && N().session(); return s && s.user; };
  const ago = t => { const m = Math.max(0, (Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + Math.round(m) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const REGIONS = () => ((window.MDG && MDG.regions) || []).map(r => [r.slug, r.name]);
  const ROLES = [['acheteur', 'J’achète'], ['vendeur', 'Je vends ou je produis'], ['les_deux', 'Les deux']];
  const prefs = () => Object.assign({ toasts: true }, J(KPF, {}));

  /* ——— profil (le mien) ——— */
  let profil = J(KP, null);
  const nomAffiche = p => p ? (p.pseudo || [p.prenom, p.nom_public ? p.nom : (p.nom ? p.nom[0] + '.' : '')].filter(Boolean).join(' ')) : '';
  async function charger() {
    const u = me(); if (!u || !navigator.onLine) return profil;
    try { const r = await N().api('/rest/v1/profils?select=*&user_id=eq.' + u.id, { auth: true }); profil = (r && r[0]) || { user_id: u.id }; W(KP, profil); cacheMe(); dispatchEvent(new CustomEvent('mdg:profil')); } catch (_) {}
    return profil;
  }
  const cacheMe = () => { const u = me(); if (!u || !profil) return; const c = J(KC, {}); c[u.id] = { a: nomAffiche(profil), av: profil.avatar || '', r: profil.role || '', t: Date.now() }; W(KC, c); };
  async function enregistrer(champs) {
    const u = me(); if (!u) throw new Error('Connectez-vous d’abord.');
    const row = Object.assign({ user_id: u.id }, champs);
    const r = await N().api('/rest/v1/profils?on_conflict=user_id', { method: 'POST', auth: true, body: row, prefer: 'return=representation,resolution=merge-duplicates' })
      .catch(e => { throw /profils_pseudo_unique|duplicate/i.test(e.message) ? new Error('Ce pseudonyme est déjà pris. Essayez-en un autre.') : /prenom_check/.test(e.message) ? new Error('Prénom : des lettres uniquement (espaces, tirets et apostrophes acceptés).') : /nom_check/.test(e.message) ? new Error('Nom : des lettres uniquement.') : /pseudo_check/.test(e.message) ? new Error('Pseudonyme : 3 à 24 caractères, lettres, chiffres, point, tiret ou _.') : /profils|schema cache/i.test(e.message) && e.status === 404 ? new Error('Les profils ne sont pas encore activés sur le serveur.') : e; });
    profil = (r && r[0]) || Object.assign(profil || {}, row); W(KP, profil); cacheMe(); dispatchEvent(new CustomEvent('mdg:profil')); return profil;
  }

  /* ——— profils des autres (annonces, négociations) : cache de 10 min ——— */
  let attente = new Set(), timer = 0;
  function avatar(uid, opt = {}) {
    const c = J(KC, {})[uid];
    if ((!c || Date.now() - c.t > 6e5) && uid) { attente.add(uid); clearTimeout(timer); timer = setTimeout(lot, 120); }
    return { nom: (c && c.a) || opt.nom || '', svg: A() ? A().svg(c && c.av, { size: opt.size || 32, nom: (c && c.a) || opt.nom || '?', seed: uid }) : '', uri: A() ? A().uri(c && c.av, { size: opt.size || 32, nom: (c && c.a) || opt.nom || '?', seed: uid }) : '' };
  }
  async function lot() {
    const ids = [...attente].slice(0, 200); attente = new Set(); if (!ids.length || !N() || !navigator.onLine) return;
    try {
      const r = await N().rpc('profils_publics', { ids }, false), c = J(KC, {}), now = Date.now();
      ids.forEach(id => { c[id] = { a: '', av: '', r: '', t: now }; });
      (r || []).forEach(p => { c[p.user_id] = { a: p.affichage || '', av: p.avatar || '', r: p.role || '', t: now }; });
      W(KC, c); dispatchEvent(new CustomEvent('mdg:profils')); dispatchEvent(new CustomEvent('mdg:change', { detail: { from: 'nuage' } }));
    } catch (_) {}
  }
  // remplit les emplacements [data-av-uid] (site) avec l'avatar de la personne
  function hydrate(root) {
    (root || document).querySelectorAll('[data-av-uid]').forEach(el => { const a = avatar(el.dataset.avUid, { size: +el.dataset.avSize || 28, nom: el.dataset.avNom || '' }); el.innerHTML = a.svg; });
  }
  addEventListener('mdg:profils', () => hydrate());

  /* ——— apparence ——— */
  const CSS = `.cp-bg{position:fixed;inset:0;z-index:8800;background:rgba(10,9,7,.62);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:cpIn var(--ux-d2,200ms) ease both}
@media (min-width:760px){.cp-bg{align-items:center;padding:24px}}
.cp{--ink:#F5F0E6;--mute:#B9AD98;--faint:#8f846f;--line:rgba(245,240,230,.12);--acc:#E07A3F;position:relative;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);width:100%;max-width:860px;height:min(94dvh,820px);background:#1d1a15;color:var(--ink);border-radius:28px 28px 0 0;box-shadow:0 30px 80px rgba(0,0,0,.5);font:400 15px/1.5 Jost,system-ui,sans-serif;font-variant-numeric:lining-nums;overflow:hidden;animation:cpUp var(--ux-d3,320ms) cubic-bezier(.22,1,.36,1) both}
@media (min-width:760px){.cp{border-radius:28px;grid-template-columns:230px minmax(0,1fr);grid-template-rows:minmax(0,1fr)}}
.cp-side{display:flex;flex-direction:column;gap:4px;padding:16px 16px 10px;border-bottom:1px solid var(--line);background:#191611}
@media (min-width:760px){.cp-side{padding:22px 14px;border-bottom:0;border-right:1px solid var(--line)}}
.cp-me{display:flex;align-items:center;gap:12px;padding:0 4px 12px}.cp-me svg{flex:none;border-radius:50%}
.cp-me b{display:block;font:500 22px/1.1 'Cormorant Garamond',Georgia,serif}.cp-me small{color:var(--mute);font-size:13px}
.cp-x{position:absolute;right:12px;top:12px;z-index:2;width:44px;height:44px;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:var(--ink);font-size:20px;cursor:pointer}
.cp-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
@media (min-width:760px){.cp-tabs{flex-direction:column;overflow:visible;margin:0;padding:0}}
.cp-tab{flex:none;display:flex;align-items:center;gap:10px;min-height:44px;padding:0 14px;border:0;border-radius:14px;background:none;color:var(--mute);font:500 14.5px Jost,sans-serif;text-align:left;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.cp-tab:hover{color:var(--ink);background:rgba(245,240,230,.05)}.cp-tab[aria-selected=true]{color:var(--ink);background:rgba(245,240,230,.1)}
.cp-tab svg{flex:none;width:18px;height:18px}.cp-tab em{margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--acc);color:#171512;font:700 11.5px/20px Jost,sans-serif;font-style:normal;text-align:center}
.cp-main{overflow:auto;padding:22px 20px 40px;overscroll-behavior:contain}
@media (min-width:760px){.cp-main{padding:30px 34px 48px}}
.cp-main h2{margin:0 0 4px;padding-right:44px;font:500 30px/1.1 'Cormorant Garamond',Georgia,serif}.cp-main h2+p{margin:0 0 20px;color:var(--mute);font-size:14px}
.cp-main h3{margin:26px 0 10px;font:500 21px/1.2 'Cormorant Garamond',serif}
.cp-panel{animation:cpFade var(--ux-d2,200ms) ease both}
.cp-f{display:grid;gap:14px;max-width:520px}
.cp-l{display:block;margin:0 0 6px;font-size:13.5px;color:var(--mute)}.cp-l i{font-style:normal;color:var(--faint)}
.cp-in,.cp-sel{width:100%;box-sizing:border-box;height:50px;padding:0 14px;border:1px solid rgba(245,240,230,.16);border-radius:14px;background:#14120f;color:var(--ink);font:500 16px Jost,sans-serif;transition:border-color var(--ux-d2,200ms)}
.cp-in:focus,.cp-sel:focus{outline:2px solid var(--acc);outline-offset:1px;border-color:transparent}
.cp-in[aria-invalid=true]{border-color:#E2735B}
.cp-err{min-height:0;margin:6px 0 0;color:#F3A08C;font-size:13.5px}
.cp-help{margin:6px 0 0;color:var(--faint);font-size:12.5px;line-height:1.45}
.cp-seg{display:flex;flex-wrap:wrap;gap:8px}
.cp-seg button{min-height:44px;padding:0 16px;border:1px solid rgba(245,240,230,.18);border-radius:999px;background:none;color:var(--ink);font:500 14.5px Jost,sans-serif;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.cp-seg button[aria-pressed=true]{background:var(--ink);color:#171512;border-color:var(--ink)}
.cp-go{min-height:50px;padding:0 24px;border:0;border-radius:999px;background:var(--acc);color:#171512;font:700 15.5px Jost,sans-serif;cursor:pointer;transition:filter var(--ux-d2,200ms),opacity var(--ux-d2,200ms)}
.cp-go:hover{filter:brightness(1.06)}.cp-go[disabled]{opacity:.55;cursor:default}
.cp-alt{min-height:46px;padding:0 18px;border:1px solid rgba(245,240,230,.22);border-radius:999px;background:none;color:var(--ink);font:600 14.5px Jost,sans-serif;cursor:pointer}
.cp-bad{color:#F3A08C;border-color:rgba(226,115,91,.45)}
.cp-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.cp-ok{display:inline-flex;align-items:center;gap:6px;color:#9fd6ae;font-size:14px;font-weight:600}
.cp-card{padding:16px 18px;border:1px solid var(--line);border-radius:20px;background:rgba(245,240,230,.03)}
.cp-card+.cp-card{margin-top:10px}
.cp-kv{display:flex;justify-content:space-between;gap:14px;align-items:center;min-height:52px;border-top:1px solid var(--line)}.cp-kv:first-child{border-top:0}
.cp-kv span{color:var(--mute);font-size:14px}.cp-kv b{font-weight:600;text-align:right}
.cp-tag{display:inline-block;padding:2px 9px;border-radius:999px;font:600 12px/1.5 Jost,sans-serif;background:rgba(245,240,230,.08);color:var(--mute)}
.cp-tag.warn{background:rgba(242,201,76,.14);color:#F2DC9A}.cp-tag.ok{background:rgba(106,174,240,.16);color:#A9CDF5}.cp-tag.acc{background:rgba(224,122,63,.2);color:#F3B48A}
.cp-list{display:flex;flex-direction:column;gap:8px}
.cp-item{display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;align-items:center;width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:16px;background:rgba(245,240,230,.03);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.cp-item:hover{background:rgba(245,240,230,.07)}.cp-item .mk{grid-row:span 2}.cp-item b{font-weight:600}.cp-item small{grid-column:2;color:var(--mute);font-size:13px}.cp-item .p{grid-row:span 2;text-align:right;font:500 20px/1 'Cormorant Garamond',serif}
.cp-item.is-new{border-color:rgba(224,122,63,.6)}
.cp-empty{padding:28px 18px;border:1px dashed var(--line);border-radius:20px;color:var(--mute);text-align:center;font-size:14.5px;line-height:1.55}.cp-empty b{display:block;margin:0 0 4px;color:var(--ink);font:500 20px/1.2 'Cormorant Garamond',serif}
.cp-sw{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:56px;border-top:1px solid var(--line);cursor:pointer}.cp-sw:first-child{border-top:0}
.cp-sw span small{display:block;color:var(--mute);font-size:13px}.cp-sw input{width:22px;height:22px;flex:none;accent-color:var(--acc)}
.cp-na{opacity:.6;cursor:default}
/* avatar */
.cp-avz{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;margin:0 0 6px}
.cp-avbig{position:relative;width:112px;height:112px;border-radius:50%;box-shadow:0 0 0 4px rgba(245,240,230,.08)}
.cp-avbig svg{display:block;border-radius:50%}
.cp-avp{display:grid;gap:16px}
.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:10px}
.cp-pick{display:grid;justify-items:center;gap:4px;padding:6px 2px;border:2px solid transparent;border-radius:16px;background:none;color:var(--mute);font:500 11.5px/1.2 Jost,sans-serif;cursor:pointer;transition:border-color var(--ux-d2,200ms),background var(--ux-d2,200ms)}
.cp-pick svg{border-radius:50%}.cp-pick:hover{background:rgba(245,240,230,.05)}.cp-pick[aria-pressed=true]{border-color:var(--acc);color:var(--ink)}
.cp-dots{display:flex;flex-wrap:wrap;gap:10px}
.cp-dot{position:relative;width:34px;height:34px;border:0;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
.cp-dot::before{content:"";position:absolute;inset:-5px}
.cp-dot[aria-pressed=true]{box-shadow:0 0 0 3px #1d1a15,0 0 0 5px var(--acc)}
/* étapes de bienvenue */
.cp-steps{display:flex;gap:6px;margin:0 0 18px}.cp-steps i{flex:1;height:4px;border-radius:2px;background:rgba(245,240,230,.12);transition:background var(--ux-d3,320ms)}.cp-steps i.on{background:var(--acc)}
@keyframes cpIn{from{opacity:0}}@keyframes cpUp{from{transform:translateY(26px);opacity:0}}@keyframes cpFade{from{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){.cp-bg,.cp,.cp-panel{animation:none}}`;
  let css = false, bg = null, rendre = null;
  const ICO = {
    profil: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round"/>',
    activite: '<circle cx="7" cy="8" r="3"/><rect x="14" y="5" width="6" height="6" rx="1"/><path d="M4 15h16M4 19h10" stroke-linecap="round"/>',
    notifs: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke-linecap="round"/>',
    prefs: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke-linecap="round"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    securite: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-linecap="round"/>'
  };
  const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${ICO[k]}</svg>`;
  function cadre(html, label) {
    if (!css) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); css = true; }
    fermer(true);
    bg = document.createElement('div'); bg.className = 'cp-bg';
    bg.innerHTML = `<div class="cp" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="cp-x" aria-label="Fermer">×</button>${html}</div>`;
    document.body.appendChild(bg);
    const r = N() && N().piege ? N().piege(bg) : null; if (!rendre) rendre = r;
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    bg.querySelector('.cp-x').onclick = () => fermer();
    document.addEventListener('keydown', onKey);
    return bg;
  }
  function fermer(garder) { if (bg) { bg.remove(); bg = null; } if (!garder) { document.removeEventListener('keydown', onKey); if (rendre) { rendre(); rendre = null; } } }
  function onKey(e) { if (e.key === 'Escape' && bg && !bg.dataset.lock) fermer(); }

  /* ——— notifications (journal des vrais événements, alimenté par v3/negoce.js) ——— */
  const notifs = () => J(KN, []);
  const nonLues = () => notifs().filter(n => !n.lu).length;

  /* ——— l'espace personnel ——— */
  function ouvrir(onglet) {
    if (!N()) return; const u = me(); if (!u) return N().open();
    let tab = onglet || 'profil';
    const tete = () => { const p = profil || {}; return `<div class="cp-me">${A() ? A().svg(p.avatar, { size: 52, nom: nomAffiche(p) || N().fmtTel(u.tel), seed: u.id }) : ''}<span><b>${esc(nomAffiche(p) || 'Mon compte')}</b><small>${esc(N().fmtTel(u.tel))}</small></span></div>`; };
    const tabs = () => [['profil', 'Mon profil'], ['activite', 'Mon activité'], ['notifs', 'Notifications'], ['prefs', 'Préférences'], ['securite', 'Sécurité et compte']]
      .map(([k, t]) => `<button type="button" role="tab" class="cp-tab" data-t="${k}" aria-selected="${tab === k}">${ico(k)}<span>${t}</span>${k === 'notifs' && nonLues() ? `<em aria-label="${nonLues()} non lues">${nonLues()}</em>` : ''}</button>`).join('');
    cadre(`<nav class="cp-side" aria-label="Mon espace">${tete()}<div class="cp-tabs" role="tablist">${tabs()}</div></nav><div class="cp-main" role="tabpanel"></div>`, 'Mon espace');
    const main = bg.querySelector('.cp-main');
    const aller = t => { tab = t; bg.querySelector('.cp-side').innerHTML = tete() + `<div class="cp-tabs" role="tablist">${tabs()}</div>`; lier(); VUES[t](main); main.scrollTop = 0; };
    const lier = () => bg.querySelectorAll('.cp-tab').forEach(b => b.onclick = () => aller(b.dataset.t));
    lier(); VUES[tab](main);
    bg.rafraichir = () => aller(tab);
    if (navigator.onLine) charger().then(() => bg && bg.rafraichir && bg.rafraichir());
  }

  // un champ texte avec message d'erreur près de lui
  const champ = (id, label, val, o = {}) => `<div><label class="cp-l" for="${id}">${label}${o.facultatif ? ' <i>facultatif</i>' : ''}</label><input class="cp-in" id="${id}" value="${esc(val || '')}" ${o.attrs || ''} aria-describedby="${id}-e"><p class="cp-err" id="${id}-e" role="alert"></p>${o.aide ? `<p class="cp-help">${o.aide}</p>` : ''}</div>`;
  const VALID = {
    prenom: v => !v.trim() ? 'Indiquez votre prénom.' : !/^[\p{L}][\p{L} '’.-]{0,39}$/u.test(v.trim()) ? 'Des lettres uniquement (espaces, tirets et apostrophes acceptés).' : '',
    nom: v => v.trim() && !/^[\p{L}][\p{L} '’.-]{0,59}$/u.test(v.trim()) ? 'Des lettres uniquement.' : '',
    pseudo: v => v.trim() && !/^[A-Za-z0-9_.-]{3,24}$/.test(v.trim()) ? '3 à 24 caractères : lettres sans accent, chiffres, point, tiret ou _.' : ''
  };
  function valider(root, ids) {
    let ok = true;
    ids.forEach(id => { const el = root.querySelector('#cp-' + id), m = VALID[id](el.value); el.setAttribute('aria-invalid', String(!!m)); root.querySelector('#cp-' + id + '-e').textContent = m; if (m) ok = false; });
    return ok;
  }
  const lieu = p => `<div><label class="cp-l" for="cp-reg">Région où vous êtes d’habitude <i>facultatif</i></label><select class="cp-sel" id="cp-reg"><option value="">—</option>${REGIONS().map(([s, n]) => `<option value="${s}" ${p.region_slug === s ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    ${champ('cp-ville', 'Ville ou localité', p.ville, { facultatif: true, attrs: 'maxlength="80" autocomplete="address-level2"', aide: 'Elle sert à vous proposer ce qui est proche. Changer votre lieu ne déplace pas vos annonces : chacune garde le sien.' })}`;
  const roleSeg = p => `<div><span class="cp-l">Vous êtes plutôt</span><div class="cp-seg" role="group" aria-label="Rôle">${ROLES.map(([k, t]) => `<button type="button" data-role="${k}" aria-pressed="${p.role === k}">${t}</button>`).join('')}</div></div>`;
  const lierRole = root => root.querySelectorAll('[data-role]').forEach(b => b.onclick = () => root.querySelectorAll('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x === b && x.getAttribute('aria-pressed') !== 'true'))));
  const roleVal = root => { const b = root.querySelector('[data-role][aria-pressed=true]'); return b ? b.dataset.role : null; };

  const VUES = {
    profil(main) {
      const p = profil || {}, u = me();
      main.innerHTML = `<div class="cp-panel"><h2>Mon profil</h2><p>Ce que les autres voient quand vous publiez ou négociez : votre avatar et ${p.pseudo ? 'votre pseudonyme' : 'votre prénom'}${p.nom_public ? ' et votre nom' : ', avec l’initiale de votre nom'}.</p>
        <div class="cp-avz"><div class="cp-avbig">${A().svg(p.avatar, { size: 112, nom: nomAffiche(p) || '?', seed: u.id })}</div><div class="cp-row"><button type="button" class="cp-alt" data-av>Choisir mon avatar</button>${p.avatar ? '<button type="button" class="cp-alt" data-av0>Revenir aux initiales</button>' : ''}</div></div>
        <form class="cp-f" novalidate>${champ('cp-prenom', 'Prénom', p.prenom, { attrs: 'maxlength="40" autocomplete="given-name" required' })}${champ('cp-nom', 'Nom', p.nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Montré seulement si vous l’acceptez (Préférences). Sinon : son initiale.' })}
        ${champ('cp-pseudo', 'Pseudonyme', p.pseudo, { facultatif: true, attrs: 'maxlength="24" autocomplete="nickname" spellcheck="false"', aide: 'S’il est rempli, il remplace votre prénom auprès des autres. Unique sur le Marché de Gros.' })}
        ${roleSeg(p)}${lieu(p)}
        <div class="cp-row"><button type="submit" class="cp-go">Enregistrer</button><span class="cp-msg" role="status"></span></div></form>
        <h3>Téléphone</h3><div class="cp-card"><div class="cp-kv"><span>Numéro du compte</span><b>${esc(N().fmtTel(u.tel))} <span class="cp-tag warn">non vérifié par SMS</span></b></div></div>
        <p class="cp-help">La vérification par SMS est payante et n’est pas installée : le numéro est celui que vous avez saisi. Le nom affiché sur chaque annonce (votre nom de vendeur ou d’exploitation) reste celui de l’annonce.</p></div>`;
      lierRole(main);
      main.querySelector('[data-av]').onclick = () => choisirAvatar(() => bg && bg.rafraichir());
      const z = main.querySelector('[data-av0]'); if (z) z.onclick = async () => { try { await enregistrer({ avatar: null }); bg.rafraichir(); N().toast('Avatar : vos initiales.'); } catch (e) { N().toast(e.message); } };
      const f = main.querySelector('form'), msg = main.querySelector('.cp-msg'), go = main.querySelector('.cp-go');
      f.querySelectorAll('.cp-in').forEach(i => i.addEventListener('blur', () => { const k = i.id.slice(3); if (VALID[k] && i.value) valider(f, [k]); }));
      f.onsubmit = async e => {
        e.preventDefault(); msg.textContent = ''; if (!valider(f, ['prenom', 'nom', 'pseudo'])) { f.querySelector('[aria-invalid=true]').focus(); return; }
        if (!navigator.onLine) { msg.textContent = 'Pas de connexion internet : réessayez quand le réseau revient.'; return; }
        go.disabled = true; go.textContent = 'Enregistrement…';
        try { await enregistrer({ prenom: f.querySelector('#cp-prenom').value.trim(), nom: f.querySelector('#cp-nom').value.trim() || null, pseudo: f.querySelector('#cp-pseudo').value.trim() || null, role: roleVal(f), region_slug: f.querySelector('#cp-reg').value || null, ville: f.querySelector('#cp-ville').value.trim() || null });
          bg.rafraichir(); N().toast('Profil enregistré.'); }
        catch (x) { go.disabled = false; go.textContent = 'Enregistrer'; const champPseudo = /pseudonyme/i.test(x.message); if (champPseudo) { f.querySelector('#cp-pseudo').setAttribute('aria-invalid', 'true'); f.querySelector('#cp-pseudo-e').textContent = x.message; } else msg.innerHTML = `<span style="color:#F3A08C">${esc(x.message)}</span>`; }
      };
    },
    activite(main) {
      const G = window.MDGNegoce, u = me(), local = k => J('mdg-v2:' + k, []).filter(x => x && x.productSlug), p = J('mdg-nuage:pousse', {});
      const off = local('offres'), dem = local('demandes'), negos = J('mdg-negoce:liste', []);
      const env = negos.filter(n => n.auteur_id === u.id), rec = negos.filter(n => n.proprio_id === u.id), ok = negos.filter(n => n.statut === 'conclue');
      const mk = k => k === 'offres' ? '<svg class="mk" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="#6CC58C"/></svg>' : '<svg class="mk" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="#F2C94C"/></svg>';
      const ann = (k, x) => `<div class="cp-item" style="cursor:default">${mk(k)}<b>${esc(x.productLabel || x.productName || x.productSlug)}${x.quantity ? ' · ' + fmt(x.quantity) + ' ' + esc(x.unit || '') : ''}</b><span class="p">${(k === 'offres' ? x.price : x.budget) ? fmt(k === 'offres' ? x.price : x.budget) : '—'}</span><small>${p[k + ':' + x.id] ? '<span class="cp-tag ok">En ligne</span>' : '<span class="cp-tag warn">Sur cet appareil, en attente d’envoi</span>'} ${x.negociable === false ? '· prix ferme ' : ''}· ${x.createdAt ? ago(x.createdAt) : ''}</small></div>`;
      const neg = n => { const e = n.statut === 'conclue' ? ['Accord conclu', 'ok'] : n.statut === 'close' ? ['Terminée', ''] : n.dernier_par && n.expire_le && Date.parse(n.expire_le) > Date.now() ? (n.dernier_par === u.id ? ['En attente de réponse', 'warn'] : ['À vous de répondre', 'acc']) : ['En cours', ''];
        const lui = n.auteur_id === u.id ? n.proprio_id : n.auteur_id, av = avatar(lui, { size: 30 });
        return `<button type="button" class="cp-item" data-nego="${n.id}"><span style="grid-row:span 2">${av.svg}</span><b>${esc(n.produit || 'Annonce')}</b><span class="p">${fmt(n.statut === 'conclue' ? n.prix_final : n.dernier_prix)}</span><small><span class="cp-tag ${e[1]}">${e[0]}</span> ${esc(av.nom ? 'avec ' + av.nom : '')}</small></button>`; };
      const sec = (t, L, f, vide) => `<h3>${t} <span class="cp-tag">${L.length}</span></h3>` + (L.length ? `<div class="cp-list">${L.slice(0, 20).map(f).join('')}</div>` : `<div class="cp-empty">${vide}</div>`);
      main.innerHTML = `<div class="cp-panel"><h2>Mon activité</h2><p>Vos annonces et vos négociations réelles. Rien n’est compté qui n’ait eu lieu.</p>
        ${sec('Mes offres', off, x => ann('offres', x), '<b>Aucune offre</b>Publiez ce que vous avez avec « Vendre ».')}
        ${sec('Mes demandes', dem, x => ann('demandes', x), '<b>Aucune demande</b>Dites ce qu’il vous faut avec « Demander ».')}
        ${sec('Propositions envoyées', env, neg, '<b>Aucune proposition envoyée</b>Sur une annonce, touchez « Proposer un prix ».')}
        ${sec('Propositions reçues', rec, neg, '<b>Aucune proposition reçue</b>Elles arrivent ici quand un acheteur ou un vendeur répond à vos annonces.')}
        ${sec('Accords conclus', ok, neg, '<b>Aucun accord pour l’instant</b>')}</div>`;
      main.querySelectorAll('[data-nego]').forEach(b => b.onclick = () => { fermer(); G && G.thread(b.dataset.nego); });
      if (G) G.refresh().then(() => { if (bg && main.isConnected && JSON.stringify(J('mdg-negoce:liste', [])) !== JSON.stringify(negos)) VUES.activite(main); });
    },
    notifs(main) {
      const L = notifs();
      main.innerHTML = `<div class="cp-panel"><h2>Notifications</h2><p>Propositions, contre-propositions, accords, refus et expirations de vos négociations, et nouvelles annonces sur vos produits.</p>
        ${L.length ? `<div class="cp-row" style="margin:0 0 12px"><button type="button" class="cp-alt" data-lu>Tout marquer comme lu</button></div><div class="cp-list">${L.slice(0, 60).map((n, i) => `<button type="button" class="cp-item${n.lu ? '' : ' is-new'}" data-i="${i}"><span style="grid-row:span 2;width:10px;height:10px;border-radius:50%;background:${n.lu ? 'transparent' : 'var(--acc)'}"></span><b>${esc(n.texte)}</b><span></span><small>${ago(n.t)}</small></button>`).join('')}</div>`
          : '<div class="cp-empty"><b>Rien de nouveau</b>Les réponses à vos propositions et les accords apparaîtront ici.</div>'}</div>`;
      const lu = main.querySelector('[data-lu]'); if (lu) lu.onclick = () => { W(KN, notifs().map(n => Object.assign(n, { lu: true }))); bg.rafraichir(); };
      main.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const all = notifs(), n = all[+b.dataset.i]; if (!n) return; n.lu = true; W(KN, all); if (n.nego && window.MDGNegoce) { fermer(); MDGNegoce.thread(n.nego); } else bg.rafraichir(); });
    },
    prefs(main) {
      const pf = prefs(), p = profil || {}, S = window.MDGSons, sn = S ? S.reglages() : null;
      main.innerHTML = `<div class="cp-panel"><h2>Préférences</h2><p>Chaque réglage agit vraiment ; ce qui n’existe pas encore est indiqué.</p>
        <h3>Notifications</h3><div class="cp-card">
          <label class="cp-sw"><span>Messages à l’écran<small>Une ligne en bas de l’écran quand une proposition arrive, est acceptée ou refusée</small></span><input type="checkbox" data-pf="toasts" ${pf.toasts ? 'checked' : ''}></label>
          <div class="cp-sw cp-na"><span>Notifications quand le site est fermé<small>Pas encore disponible</small></span></div>
          <div class="cp-sw cp-na"><span>SMS<small>Pas disponible : service payant</small></span></div></div>
        <h3>Sons</h3><div class="cp-card"><div class="cp-kv"><span>${sn && sn.on ? 'Activés' : 'Désactivés'} · notes de balafon</span><button type="button" class="cp-alt" data-sons>Régler les sons</button></div></div>
        <h3>Confidentialité</h3><div class="cp-card">
          <label class="cp-sw"><span>Montrer mon nom de famille<small>Sinon, les autres voient « ${esc(p.prenom || 'Prénom')} ${esc(p.nom ? p.nom[0] + '.' : 'N.')} »${p.pseudo ? ' (votre pseudonyme passe avant)' : ''}</small></span><input type="checkbox" data-np ${p.nom_public ? 'checked' : ''}></label></div>
        <p class="cp-help">Le numéro inscrit sur une annonce est visible de tous : c’est ainsi que les acheteurs vous appellent. Vous le choisissez annonce par annonce.</p></div>`;
      main.querySelectorAll('[data-pf]').forEach(i => i.onchange = () => { const o = prefs(); o[i.dataset.pf] = i.checked; W(KPF, o); N().toast('Préférence enregistrée.'); });
      const s = main.querySelector('[data-sons]'); if (s) s.onclick = () => { fermer(); S && S.panneau(); };
      main.querySelector('[data-np]').onchange = async e => { try { await enregistrer({ nom_public: e.target.checked }); N().toast('Préférence enregistrée.'); bg.rafraichir(); } catch (x) { e.target.checked = !e.target.checked; N().toast(x.message); } };
    },
    securite(main) {
      const u = me();
      main.innerHTML = `<div class="cp-panel"><h2>Sécurité et compte</h2><p>Votre numéro et votre code secret à 6 chiffres protègent votre compte.</p>
        <div class="cp-card"><div class="cp-kv"><span>Numéro</span><b>${esc(N().fmtTel(u.tel))} <span class="cp-tag warn">non vérifié par SMS</span></b></div>
          <div class="cp-kv"><span>Changer de numéro</span><b style="font-weight:400;color:var(--mute);font-size:13.5px">Pas encore possible sans vérification par SMS</b></div></div>
        <h3>Code secret</h3><form class="cp-f cp-code" novalidate>${champ('cp-c0', 'Code actuel', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"' })}${champ('cp-c1', 'Nouveau code (6 chiffres)', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"' })}${champ('cp-c2', 'Retapez le nouveau code', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"' })}
          <div class="cp-row"><button type="submit" class="cp-go">Changer mon code</button><span class="cp-msg" role="status"></span></div></form>
        <h3>Code de secours</h3><div class="cp-card"><div class="cp-kv"><span>Pour choisir un nouveau code si vous l’oubliez</span><button type="button" class="cp-alt" data-sos>Créer un nouveau code de secours</button></div></div>
        <h3>Connexions</h3><div class="cp-card"><div class="cp-kv"><span>Cet appareil</span><button type="button" class="cp-alt" data-out>Me déconnecter</button></div>
          <div class="cp-kv"><span>Tous mes appareils (téléphone perdu ?)</span><button type="button" class="cp-alt" data-outall>Déconnecter partout</button></div></div>
        <h3>Supprimer mon compte</h3><div class="cp-card"><p style="margin:0 0 12px;color:var(--mute);font-size:14px;line-height:1.5">Vos annonces sont retirées et les négociations en cours fermées. Votre profil et votre code de secours sont effacés, et la connexion est bloquée. Les accords déjà conclus et les messages restent visibles des deux parties, pour la trace des échanges ; l’autre partie y voit « Compte supprimé ».</p>
          <button type="button" class="cp-alt cp-bad" data-del>Supprimer mon compte…</button></div>
        <h3>Données conservées</h3><p class="cp-help" style="font-size:13.5px">Numéro et code secret (chiffré) : pour vous connecter. Profil : pour vous présenter aux autres. Annonces : pour être trouvées. Négociations et messages : pour que les deux parties gardent la trace de leurs échanges. Signalements : pour la modération. Sur cet appareil : vos annonces en attente, vos réglages et une copie des annonces des autres pour l’usage hors connexion.</p></div>`;
      const f = main.querySelector('.cp-code'), msg = f.querySelector('.cp-msg'), go = f.querySelector('.cp-go');
      f.onsubmit = async e => {
        e.preventDefault(); const c0 = f.querySelector('#cp-c0').value, c1 = f.querySelector('#cp-c1').value, c2 = f.querySelector('#cp-c2').value;
        const err = (id, m) => { f.querySelectorAll('.cp-err').forEach(x => x.textContent = ''); f.querySelector('#' + id + '-e').textContent = m; f.querySelector('#' + id).focus(); };
        if (!/^\d{6}$/.test(c0)) return err('cp-c0', 'Votre code actuel fait 6 chiffres.');
        if (!/^\d{6}$/.test(c1)) return err('cp-c1', 'Le nouveau code fait 6 chiffres.');
        if (/^(\d)\1{5}$/.test(c1) || c1 === '123456' || c1 === '654321') return err('cp-c1', 'Trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.');
        if (c1 !== c2) return err('cp-c2', 'Les deux codes ne sont pas identiques.');
        go.disabled = true; go.textContent = 'Vérification…'; msg.textContent = '';
        try { await N().signIn(u.tel, c0); await N().api('/auth/v1/user', { method: 'PUT', auth: true, body: { password: c1 } }); f.reset(); msg.innerHTML = '<span class="cp-ok">✓ Code changé</span>'; }
        catch (x) { msg.innerHTML = `<span style="color:#F3A08C">${esc(/incorrect/i.test(x.message) ? 'Code actuel incorrect.' : x.message)}</span>`; }
        go.disabled = false; go.textContent = 'Changer mon code';
      };
      main.querySelector('[data-sos]').onclick = async e => { if (!confirm('Créer un nouveau code de secours ? L’ancien ne fonctionnera plus.')) return; e.target.disabled = true; try { const c = await N().rpc('creer_secours'); fermer(); N().showSecours ? N().showSecours(c) : alert('Votre code de secours : ' + c); } catch (x) { e.target.disabled = false; N().toast(x.message); } };
      main.querySelector('[data-out]').onclick = () => { fermer(); N().signOut(); N().toast('Déconnecté. Vos annonces restent publiées.'); };
      main.querySelector('[data-outall]').onclick = async () => { if (!confirm('Déconnecter tous vos appareils, celui-ci compris ?')) return; try { await N().api('/auth/v1/logout?scope=global', { method: 'POST', auth: true }); } catch (_) {} fermer(); N().signOut(); N().toast('Tous vos appareils sont déconnectés.'); };
      main.querySelector('[data-del]').onclick = () => supprimer(main);
    }
  };
  function supprimer(main) {
    const box = document.createElement('div'); box.className = 'cp-card'; box.style.marginTop = '10px';
    box.innerHTML = `<form class="cp-f" novalidate><p style="margin:0;font-size:14.5px">Pour confirmer, tapez votre code secret.</p>${champ('cp-dc', 'Code secret', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"' })}<div class="cp-row"><button type="submit" class="cp-go" style="background:#E2735B">Supprimer définitivement</button><button type="button" class="cp-alt" data-no>Annuler</button></div></form>`;
    main.querySelector('[data-del]').replaceWith(box);
    box.querySelector('[data-no]').onclick = () => bg.rafraichir();
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const c = box.querySelector('#cp-dc').value, er = box.querySelector('#cp-dc-e'); er.textContent = '';
      if (!/^\d{6}$/.test(c)) { er.textContent = 'Votre code fait 6 chiffres.'; return; }
      const b = box.querySelector('.cp-go'); b.disabled = true; b.textContent = 'Suppression…';
      try { await N().signIn(me().tel, c); await N().rpc('supprimer_compte'); localStorage.removeItem(KP); fermer(); N().signOut(); N().toast('Votre compte est supprimé. Vos annonces ont été retirées.'); }
      catch (x) { er.textContent = /incorrect/i.test(x.message) ? 'Code incorrect.' : /supprimer_compte|schema cache|Could not find/i.test(x.message) ? 'La suppression n’est pas encore activée sur le serveur. Contactez le Marché de Gros.' : x.message; b.disabled = false; b.textContent = 'Supprimer définitivement'; }
    };
  }

  /* ——— choisir son avatar ——— */
  function choisirAvatar(apres, embarque) {
    const u = me(), M = A(); let o = M.parse((profil && profil.avatar) || 'v1:c=foulard;t=1;k=0;f=1'); if (o.mode === 'ini') o = M.parse('v1:c=foulard;t=1;k=0;f=' + Math.max(0, o.f));
    const nom = nomAffiche(profil) || '?';
    const html = () => { const st = M.STYLES.find(x => x.id === o.c), cols = st && st.tissu ? M.TISSUS : M.CHEVEUX;
      return `<div class="cp-avz"><div class="cp-avbig">${M.svg(M.code(o), { size: 112, nom })}</div>${embarque ? '' : '<p class="cp-help" style="margin:0">Vous pourrez le changer quand vous voulez.</p>'}</div>
      <div class="cp-avp"><div><span class="cp-l">Style</span><div class="cp-grid">${M.STYLES.map(s => `<button type="button" class="cp-pick" data-c="${s.id}" aria-pressed="${o.c === s.id}">${M.svg(M.code(Object.assign({}, o, { c: s.id, k: s.tissu === st.tissu ? o.k : 0 })), { size: 52, nom: s.nom })}<span>${s.nom}</span></button>`).join('')}</div></div>
        <div><span class="cp-l">Teint</span><div class="cp-dots">${M.TEINTS.map((c, i) => `<button type="button" class="cp-dot" data-t="${i}" style="background:${c}" aria-label="Teint ${i + 1}" aria-pressed="${o.t === i}"></button>`).join('')}</div></div>
        <div><span class="cp-l">${st && st.tissu ? 'Couleur du tissu' : 'Couleur des cheveux'}</span><div class="cp-dots">${cols.map((c, i) => `<button type="button" class="cp-dot" data-k="${i}" style="background:${c}" aria-label="Couleur ${i + 1}" aria-pressed="${o.k === i}"></button>`).join('')}</div></div>
        <div><span class="cp-l">Fond</span><div class="cp-dots">${M.FONDS.map((c, i) => `<button type="button" class="cp-dot" data-f="${i}" style="background:${c}" aria-label="Fond ${i + 1}" aria-pressed="${o.f === i}"></button>`).join('')}</div></div>
        <div><span class="cp-l">Détail</span><div class="cp-seg">${M.DETAILS.map(d => `<button type="button" data-a="${d.id}" aria-pressed="${(o.a || '') === d.id}">${d.nom}</button>`).join('')}</div></div></div>`; };
    const zone = embarque || (cadre(`<div class="cp-main" style="grid-column:1 / -1"><h2>Mon avatar</h2><p>Il apparaît sur votre profil et dans vos négociations.</p><div class="cp-avw"></div><div class="cp-row" style="margin-top:20px"><button type="button" class="cp-go" data-ok>Enregistrer cet avatar</button><button type="button" class="cp-alt" data-ini>Garder mes initiales</button><span class="cp-msg" role="status"></span></div></div>`, 'Mon avatar'), bg.querySelector('.cp-avw'));
    const peindre = () => { zone.innerHTML = html(); zone.querySelectorAll('button').forEach(b => b.onclick = () => { const d = b.dataset; if (d.c) { const was = M.STYLES.find(x => x.id === o.c), now = M.STYLES.find(x => x.id === d.c); if (!!was.tissu !== !!now.tissu) o.k = 0; o.c = d.c; } if (d.t) o.t = +d.t; if (d.k) o.k = +d.k; if (d.f) o.f = +d.f; if ('a' in d) o.a = d.a; peindre(); }); };
    peindre();
    if (embarque) return () => M.code(o);
    bg.querySelector('[data-ok]').onclick = async e => { e.target.disabled = true; try { await enregistrer({ avatar: M.code(o) }); N().toast('Avatar enregistré.'); fermer(true); apres ? apres() : ouvrir('profil'); } catch (x) { e.target.disabled = false; bg.querySelector('.cp-msg').textContent = x.message; } };
    bg.querySelector('[data-ini]').onclick = async () => { try { await enregistrer({ avatar: null }); } catch (_) {} fermer(true); apres ? apres() : ouvrir('profil'); };
  }

  /* ——— bienvenue : 3 étapes courtes après la création du compte (les deux dernières peuvent attendre) ——— */
  function bienvenue() {
    const u = me(); if (!u || !A()) return;
    let etape = 1, getAv = null;
    const p = () => profil || {};
    cadre(`<div class="cp-main" style="grid-column:1 / -1"><div class="cp-steps" aria-hidden="true"><i></i><i></i><i></i></div><div class="cp-w"></div></div>`, 'Bienvenue');
    bg.dataset.lock = '1'; bg.querySelector('.cp-x').hidden = true;
    const w = bg.querySelector('.cp-w');
    const pas = () => bg.querySelectorAll('.cp-steps i').forEach((x, i) => x.classList.toggle('on', i < etape));
    const suite = async (champs, fin) => { try { if (champs && navigator.onLine) await enregistrer(champs); } catch (x) { return x.message; } if (fin) { bg.dataset.lock = ''; fermer(); N().toast('Votre compte est prêt. Complétez votre profil quand vous voulez dans « Mon espace ».'); } else { etape++; dessiner(); } return ''; };
    function dessiner() {
      pas();
      if (etape === 1) {
        w.innerHTML = `<h2>Comment vous appelle-t-on ?</h2><p>C’est ce que verront les vendeurs et les acheteurs avec qui vous échangez.</p><form class="cp-f cp-panel" novalidate>${champ('cp-prenom', 'Prénom', p().prenom, { attrs: 'maxlength="40" autocomplete="given-name"' })}${champ('cp-nom', 'Nom', p().nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Les autres ne voient que son initiale, sauf si vous choisissez de le montrer.' })}<div class="cp-row"><button class="cp-go">Continuer</button><span class="cp-msg" role="status"></span></div></form>`;
        const f = w.querySelector('form'); setTimeout(() => f.querySelector('#cp-prenom').focus(), 60);
        f.onsubmit = async e => { e.preventDefault(); if (!valider(f, ['prenom', 'nom'])) return; const m = await suite({ prenom: f.querySelector('#cp-prenom').value.trim(), nom: f.querySelector('#cp-nom').value.trim() || null }); if (m) f.querySelector('.cp-msg').textContent = m; };
      } else if (etape === 2) {
        w.innerHTML = `<h2>Votre avatar</h2><p>Choisissez ce qui vous ressemble, ou gardez vos initiales.</p><div class="cp-avw cp-panel"></div><div class="cp-row" style="margin-top:20px"><button type="button" class="cp-go" data-ok>Continuer</button><button type="button" class="cp-alt" data-ini>Garder mes initiales</button></div>`;
        getAv = choisirAvatar(null, w.querySelector('.cp-avw'));
        w.querySelector('[data-ok]').onclick = () => suite({ avatar: getAv() });
        w.querySelector('[data-ini]').onclick = () => suite(null);
      } else {
        w.innerHTML = `<h2>Ce que vous faites, et où</h2><p>Pour vous montrer d’abord ce qui vous concerne. Vous pouvez passer cette étape.</p><form class="cp-f cp-panel" novalidate>${roleSeg(p())}${lieu(p())}<div class="cp-row"><button class="cp-go">Terminer</button><button type="button" class="cp-alt" data-skip>Plus tard</button></div></form>`;
        const f = w.querySelector('form'); lierRole(f);
        f.onsubmit = e => { e.preventDefault(); suite({ role: roleVal(f), region_slug: f.querySelector('#cp-reg').value || null, ville: f.querySelector('#cp-ville').value.trim() || null }, true); };
        w.querySelector('[data-skip]').onclick = () => suite(null, true);
      }
    }
    dessiner();
  }

  // compte ouvert ou fermé : on recharge le profil
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte') { if (me()) charger(); else { profil = null; localStorage.removeItem(KP); dispatchEvent(new CustomEvent('mdg:profil')); } } });
  if (me()) setTimeout(charger, 900);

  window.MDGCompte = { ouvrir, bienvenue, profil: () => profil, nomAffiche, avatar, hydrate, prefs, notifs, nonLues, choisirAvatar };
})();
