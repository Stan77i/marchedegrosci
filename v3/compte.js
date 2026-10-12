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
    // modifier la ligne existante (sans toucher à user_id) ; la créer seulement si elle n'existe pas encore.
    // (l'ancien « créer ou remplacer » réécrivait user_id et exigeait un droit de modification sur cette colonne : « permission denied »)
    const ecrire = async () => {
      const maj = await N().api('/rest/v1/profils?user_id=eq.' + u.id, { method: 'PATCH', auth: true, body: champs, prefer: 'return=representation' });
      if (maj && maj.length) return maj;
      return N().api('/rest/v1/profils', { method: 'POST', auth: true, body: row, prefer: 'return=representation' });
    };
    const r = await ecrire()
      .catch(e => { throw /profils_pseudo_unique|duplicate/i.test(e.message) ? new Error('Ce pseudonyme est déjà pris. Essayez-en un autre.') : /prenom_check/.test(e.message) ? new Error('Prénom : des lettres uniquement (espaces, tirets et apostrophes acceptés).') : /nom_check/.test(e.message) ? new Error('Nom : des lettres uniquement.') : /pseudo_check/.test(e.message) ? new Error('Pseudonyme : 3 à 24 caractères, lettres, chiffres, point, tiret ou _.') : /profils|schema cache/i.test(e.message) && e.status === 404 ? new Error('Les profils ne sont pas encore activés sur le serveur.') : /permission denied|row-level security/i.test(e.message) ? new Error('Le serveur a refusé l’enregistrement. Reconnectez-vous, puis réessayez.') : e; });
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
.cp-admin{text-decoration:none;color:#F3B48A}@media (max-width:759px){.cp-admin{order:-1;background:rgba(224,122,63,.12)}}@media (min-width:760px){.cp-admin{margin-top:10px;box-shadow:inset 0 1px 0 var(--line);border-radius:0 0 14px 14px}}
/* téléphone : tous les onglets tiennent à l'écran (icône + nom court), rien à faire glisser */
.cp-tc{display:none}
@media (max-width:759px){
  .cp-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;overflow:visible;margin:0 -10px;padding:0}
  .cp-tab{flex-direction:column;justify-content:center;gap:4px;min-height:56px;padding:6px 2px;border-radius:14px;text-align:center}
  .cp-tab svg{width:20px;height:20px}
  .cp-tl{display:none}.cp-tc{display:block;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .cp-tab em{position:absolute;margin:0;transform:translate(13px,-14px);min-width:18px;height:18px;font-size:10.5px;line-height:18px;padding:0 5px}
  .cp-tab{position:relative}
  .cp-admin{order:0}
}
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
.cp-cloche{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(224,122,63,.14);color:#F3B48A}.cp-cloche svg{width:20px;height:20px}
.cp-pousse.is-on .cp-cloche{background:rgba(108,197,140,.16);color:#9fe0b4}
.cp-pousse.is-on .cp-cloche svg{animation:cpCloche 2.6s ease-in-out 1}
@keyframes cpCloche{0%,60%,100%{transform:none}8%{transform:rotate(14deg)}16%{transform:rotate(-12deg)}24%{transform:rotate(8deg)}32%{transform:rotate(-5deg)}40%{transform:rotate(2deg)}}
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
/* avatar : aperçu à gauche (fixe), réglages à droite */
.avx{display:grid;gap:22px}
@media (min-width:640px){.avx{grid-template-columns:200px minmax(0,1fr);gap:34px;align-items:start}}
.avx-pv{display:grid;justify-items:center;gap:10px;padding:22px 12px 18px;border:1px solid var(--line);border-radius:24px;background:radial-gradient(120% 90% at 50% 0%,rgba(245,240,230,.06),transparent 70%)}
@media (min-width:640px){.avx-pv{position:sticky;top:0}}
.avx-big{width:148px;height:148px;border-radius:50%;box-shadow:0 0 0 6px rgba(245,240,230,.05),0 18px 40px rgba(0,0,0,.35)}
.avx-big svg,.avx-big img,.avx-mini svg,.avx-mini img{display:block;border-radius:50%}
.avx-big>*{animation:avxIn var(--ux-d2,200ms) cubic-bezier(.22,1,.36,1)}
.avx-nom{font:500 22px/1.15 'Cormorant Garamond',Georgia,serif;text-align:center;overflow-wrap:anywhere}
.avx-mini{display:flex;gap:18px;padding-top:10px;border-top:1px solid var(--line);width:100%;justify-content:center}
.avx-mini span{display:grid;justify-items:center;gap:6px;align-content:end}.avx-mini small{color:var(--faint);font-size:11.5px}
.avx-mode{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;margin:0 0 20px;border-radius:999px;background:rgba(245,240,230,.06)}
.avx-mode button{min-height:44px;border:0;border-radius:999px;background:none;color:var(--mute);font:600 14.5px Jost,sans-serif;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.avx-mode button:hover{color:var(--ink)}.avx-mode button[aria-selected=true]{background:var(--ink);color:#171512}
.avx-p{display:grid;gap:22px;animation:cpFade var(--ux-d2,200ms) ease both}
.avx-sec{display:grid;gap:4px}.avx-h{display:flex;align-items:center;justify-content:space-between;gap:12px}
.avx-dice{min-height:36px;padding:0 14px;border:1px solid rgba(245,240,230,.2);border-radius:999px;background:none;color:var(--ink);font:500 13px Jost,sans-serif;cursor:pointer}.avx-dice:hover{background:rgba(245,240,230,.06)}
.avx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
.avx-pick{display:grid;justify-items:center;gap:6px;min-height:44px;padding:8px 2px;border:0;border-radius:16px;background:none;color:var(--mute);font:500 12px/1.2 Jost,sans-serif;text-align:center;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.avx-pick svg{border-radius:50%;transition:box-shadow var(--ux-d2,200ms),transform var(--ux-d2,200ms) cubic-bezier(.22,1,.36,1)}
.avx-pick:hover{background:rgba(245,240,230,.05);color:var(--ink)}.avx-pick:hover svg{transform:translateY(-2px)}
.avx-pick[aria-pressed=true]{color:var(--ink)}.avx-pick[aria-pressed=true] svg{box-shadow:0 0 0 3px #1d1a15,0 0 0 5px var(--ink)}
.avx-p .cp-dot[aria-pressed=true]{box-shadow:0 0 0 3px #1d1a15,0 0 0 5px var(--ink)}
.avx-txt{margin:0 0 12px;color:var(--mute);font-size:14.5px}
.avx-drop{display:grid;justify-items:center;gap:6px;padding:40px 18px;border:1.5px dashed rgba(245,240,230,.24);border-radius:24px;text-align:center;cursor:pointer;transition:border-color var(--ux-d2,200ms),background var(--ux-d2,200ms)}
.avx-drop:hover,.avx-drop.is-over{border-color:var(--ink);background:rgba(245,240,230,.04)}
.avx-drop b{font:500 22px/1.2 'Cormorant Garamond',Georgia,serif}.avx-drop span{color:var(--mute);font-size:13.5px}
.avx-drop:focus-within{outline:2px solid var(--acc);outline-offset:2px}
.avx-stage{position:relative;width:240px;height:240px;margin:0 auto 6px;border-radius:24px;overflow:hidden;cursor:grab;touch-action:none;background:#14120f}
.avx-stage.is-drag{cursor:grabbing}.avx-stage canvas{display:block;width:100%;height:100%}
.avx-stage i{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,transparent 119px,rgba(10,9,7,.62) 120px);box-shadow:inset 0 0 0 1px rgba(245,240,230,.12)}
.avx-stage i::after{content:"";position:absolute;left:0;top:0;width:240px;height:240px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(245,240,230,.7)}
.avx-stage:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.avx-zoom{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center;max-width:320px;margin:4px auto 0;width:100%}.avx-zoom .cp-l{margin:0}
.avx-zoom input{width:100%;accent-color:var(--ink);min-height:44px}
.avx-crop .cp-help{text-align:center}.avx-crop .cp-row{justify-content:center}
.avx-file{display:inline-flex;align-items:center}
.avx-act{position:sticky;bottom:-40px;margin:22px -20px -40px;padding:14px 20px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(transparent,#1d1a15 26%);}
@media (min-width:760px){.avx-act{margin:24px -34px -48px;padding:16px 34px 22px}}
@keyframes avxIn{from{opacity:.4;transform:scale(.96)}}
@media (prefers-reduced-motion:reduce){.cp-bg,.cp,.cp-panel{animation:none}.avx-big>*,.avx-p{animation:none}.avx-pick svg{transition:none}}`;
  let css = false, bg = null, rendre = null;
  const ICO = {
    profil: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round"/>',
    activite: '<circle cx="7" cy="8" r="3"/><rect x="14" y="5" width="6" height="6" rx="1"/><path d="M4 15h16M4 19h10" stroke-linecap="round"/>',
    notifs: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke-linecap="round"/>',
    prefs: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke-linecap="round"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    securite: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-linecap="round"/>',
    admin: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="4" rx="1.5"/><rect x="13" y="10" width="7" height="10" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/>'
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
    const tabs = () => [['profil', 'Mon profil', 'Profil'], ['activite', 'Mon activité', 'Activité'], ['notifs', 'Notifications', 'Alertes'], ['prefs', 'Préférences', 'Réglages'], ['securite', 'Sécurité et compte', 'Sécurité']]
      .map(([k, t, c]) => `<button type="button" role="tab" class="cp-tab" data-t="${k}" aria-selected="${tab === k}" aria-label="${t}">${ico(k)}<span class="cp-tl">${t}</span><span class="cp-tc" aria-hidden="true">${c}</span>${k === 'notifs' && nonLues() ? `<em aria-label="${nonLues()} non lues">${nonLues()}</em>` : ''}</button>`).join('')
      // administrateur seulement (vérifié par le serveur avec est_admin ; la page admin revérifie elle-même) : le lien vers le tableau de bord
      + (J('mdg-nuage:admin', false) ? `<a class="cp-tab cp-admin" href="admin.html" aria-label="Tableau de bord">${ico('admin')}<span class="cp-tl">Tableau de bord</span><span class="cp-tc" aria-hidden="true">Admin</span></a>` : '');
    cadre(`<nav class="cp-side" aria-label="Mon espace">${tete()}<div class="cp-tabs" role="tablist">${tabs()}</div></nav><div class="cp-main" role="tabpanel"></div>`, 'Mon espace');
    const main = bg.querySelector('.cp-main');
    const aller = t => { tab = t; bg.querySelector('.cp-side').innerHTML = tete() + `<div class="cp-tabs" role="tablist">${tabs()}</div>`; lier(); VUES[t](main); main.scrollTop = 0; };
    const lier = () => bg.querySelectorAll('.cp-tab').forEach(b => b.onclick = () => aller(b.dataset.t));
    lier(); VUES[tab](main);
    bg.rafraichir = () => aller(tab);
    if (navigator.onLine) charger().then(() => bg && bg.rafraichir && bg.rafraichir());
    const adm0 = J('mdg-nuage:admin', false); if (N().isAdmin) N().isAdmin().then(a => { if (a !== adm0 && bg && bg.rafraichir) bg.rafraichir(); });
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

  /* ——— Notifications sur ce téléphone (v3/pousse.js) : une carte qui dit l'état réel et propose l'action qui convient ——— */
  async function cartePousse(el) {
    const P = window.MDGPousse; if (!el) return;
    const st = P ? await P.etat() : 'impossible';
    const T = {
      actif: ['Notifications activées sur ce téléphone', 'Une réponse à votre prix, un accord, un refus : votre téléphone vous prévient tout de suite, même application fermée, avec le nombre de réponses sur l’icône.', '<button type="button" class="cp-alt" data-pe>Envoyer un essai</button><button type="button" class="cp-alt" data-pd>Désactiver</button>'],
      inactif: ['Être prévenu même application fermée', 'Comme pour vos messages : dès qu’on répond à votre prix, votre téléphone vous le dit, et le nombre de réponses s’affiche sur l’icône.', '<button type="button" class="cp-go" data-pa>Activer les notifications</button>'],
      refuse: ['Notifications bloquées sur ce téléphone', 'Elles ont été refusées. Pour les recevoir : Réglages du téléphone → Notifications → Marché de Gros → Autoriser, puis revenez ici.', ''],
      installer: ['Sur iPhone : ajoutez d’abord l’application', 'Les notifications n’arrivent que dans l’application installée. Touchez Partager, puis « Sur l’écran d’accueil », ouvrez-la depuis l’icône et activez ici.', ''],
      impossible: ['Notifications indisponibles ici', 'Ce navigateur ne permet pas les notifications. Ouvrez le Marché de Gros dans l’application installée ou dans Chrome, Safari ou Edge à jour.', '']
    }[st];
    el.innerHTML = `<div class="cp-card cp-pousse${st === 'actif' ? ' is-on' : ''}"><div style="display:flex;gap:12px;align-items:flex-start"><span aria-hidden="true" class="cp-cloche">${ico('notifs')}</span><span style="flex:1;min-width:0"><b style="display:block;font-size:15.5px;margin-bottom:4px">${T[0]}</b><small style="display:block;color:var(--mute);font-size:13.5px;line-height:1.45">${T[1]}</small></span></div>${T[2] ? `<div class="cp-row" style="margin-top:14px;gap:8px;flex-wrap:wrap">${T[2]}</div>` : ''}<p class="cp-err" role="status" style="margin-top:8px"></p></div>`;
    const msg = el.querySelector('.cp-err'), b = q => el.querySelector(q);
    if (b('[data-pa]')) b('[data-pa]').onclick = async e => { const t = e.currentTarget; t.disabled = true; t.textContent = 'Activation…'; t.setAttribute('aria-busy', 'true');
      try { await P.activer(); N().toast('Notifications activées. Une notification d’essai arrive.'); cartePousse(el); }
      catch (x) { t.disabled = false; t.removeAttribute('aria-busy'); t.textContent = 'Activer les notifications'; const m = String(x.message); msg.textContent = m === 'REFUS' ? 'Vous avez refusé. Autorisez-les dans les réglages du téléphone, puis réessayez.' : m === 'SANS_REPONSE' ? 'Pas de réponse à la demande. Réessayez et touchez « Autoriser ».' : m === 'INSTALLER' ? 'Ajoutez d’abord l’application à l’écran d’accueil.' : 'L’activation n’a pas abouti. Vérifiez la connexion, puis réessayez.'; } };
    if (b('[data-pe]')) b('[data-pe]').onclick = async () => { msg.textContent = 'Envoi…'; const r = await P.essai(); msg.textContent = r && r.envoyees ? 'Envoyée : elle doit apparaître dans quelques secondes.' : 'L’essai n’est pas parti. Désactivez puis réactivez les notifications.'; };
    if (b('[data-pd]')) b('[data-pd]').onclick = async () => { await P.desactiver(); N().toast('Notifications désactivées sur ce téléphone.'); cartePousse(el); };
  }

  const VUES = {
    profil(main) {
      const p = profil || {}, u = me();
      main.innerHTML = `<div class="cp-panel"><h2>Mon profil</h2><p>Ce que les autres voient quand vous publiez ou négociez : votre avatar et ${p.pseudo ? 'votre pseudonyme' : 'votre prénom'}${p.nom_public ? ' et votre nom' : ', avec l’initiale de votre nom'}.</p>
        <div class="cp-avz"><div class="cp-avbig">${A().svg(p.avatar, { size: 112, nom: nomAffiche(p) || '?', seed: u.id })}</div><div class="cp-row"><button type="button" class="cp-alt" data-av>Choisir mon avatar</button>${p.avatar ? '<button type="button" class="cp-alt" data-av0>Revenir aux initiales</button>' : ''}</div></div>
        <form class="cp-f" novalidate>${champ('cp-prenom', 'Prénom', p.prenom, { attrs: 'maxlength="40" autocomplete="given-name" required' })}${champ('cp-nom', 'Nom', p.nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Montré seulement si vous l’acceptez (Préférences). Sinon : son initiale.' })}
        ${champ('cp-pseudo', 'Pseudonyme', p.pseudo, { facultatif: true, attrs: 'maxlength="24" autocomplete="nickname" spellcheck="false"', aide: 'S’il est rempli, il remplace votre prénom auprès des autres. Unique sur le Marché de Gros.' })}
        ${roleSeg(p)}${lieu(p)}
        <div class="cp-row"><button type="submit" class="cp-go">Enregistrer</button><span class="cp-msg" role="status"></span></div></form>
        <h3>Téléphone</h3><div class="cp-card"><div class="cp-kv"><span>Numéro du compte</span><b>${esc(N().fmtTel(u.tel))}</b></div></div>
        <p class="cp-help">Le nom affiché sur chaque annonce (votre nom de vendeur ou d’exploitation) reste celui de l’annonce.</p></div>`;
      lierRole(main);
      main.querySelector('[data-av]').onclick = () => choisirAvatar(() => bg && bg.rafraichir());
      const z = main.querySelector('[data-av0]'); if (z) z.onclick = async () => { try { await enregistrer({ avatar: null }); bg.rafraichir(); N().toast('Avatar : vos initiales.'); } catch (e) { N().toast(e.message); } };
      const f = main.querySelector('form'), msg = main.querySelector('.cp-msg'), go = main.querySelector('.cp-go');
      f.querySelectorAll('.cp-in').forEach(i => i.addEventListener('blur', () => { const k = i.id.slice(3); if (VALID[k] && i.value) valider(f, [k]); }));
      f.onsubmit = async e => {
        e.preventDefault(); msg.textContent = ''; if (!valider(f, ['prenom', 'nom', 'pseudo'])) { f.querySelector('[aria-invalid=true]').focus(); return; }
        if (!navigator.onLine) { msg.textContent = 'Pas de connexion internet : réessayez quand le réseau revient.'; return; }
        go.disabled = true; go.setAttribute('aria-busy', 'true'); go.textContent = 'Enregistrement';
        try { await enregistrer({ prenom: f.querySelector('#cp-prenom').value.trim(), nom: f.querySelector('#cp-nom').value.trim() || null, pseudo: f.querySelector('#cp-pseudo').value.trim() || null, role: roleVal(f), region_slug: f.querySelector('#cp-reg').value || null, ville: f.querySelector('#cp-ville').value.trim() || null });
          bg.rafraichir(); N().toast('Profil enregistré.'); }
        catch (x) { go.disabled = false; go.textContent = 'Enregistrer'; const champPseudo = /pseudonyme/i.test(x.message); if (champPseudo) { f.querySelector('#cp-pseudo').setAttribute('aria-invalid', 'true'); f.querySelector('#cp-pseudo-e').textContent = x.message; } else msg.innerHTML = `<span style="color:#F3A08C">${esc(x.message)}</span>`; }
      };
    },
    activite(main) {
      const G = window.MDGNegoce, u = me(), local = k => J('mdg-v2:' + k, []).filter(x => x && x.productSlug), p = J('mdg-nuage:pousse', {});
      const off = local('offres'), dem = local('demandes'), negos = J('mdg-negoce:liste', []);
      // une proposition n'est « envoyée » ou « reçue » que tant qu'elle attend une réponse ; retirée, refusée ou expirée, elle passe dans « Sans suite »
      const vive = n => n.statut === 'ouverte' && n.dernier_par && n.expire_le && Date.parse(n.expire_le) > Date.now();
      const env = negos.filter(n => vive(n) && n.dernier_par === u.id), rec = negos.filter(n => vive(n) && n.dernier_par !== u.id), ok = negos.filter(n => n.statut === 'conclue'), fin = negos.filter(n => n.statut !== 'conclue' && !vive(n));
      const mk = k => k === 'offres' ? '<svg class="mk" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="#6CC58C"/></svg>' : '<svg class="mk" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="#F2C94C"/></svg>';
      const ann = (k, x) => `<div class="cp-item" style="cursor:default">${mk(k)}<b>${esc(x.productLabel || x.productName || x.productSlug)}${x.quantity ? ' · ' + fmt(x.quantity) + ' ' + esc(x.unit || '') : ''}</b><span class="p">${(k === 'offres' ? x.price : x.budget) ? fmt(k === 'offres' ? x.price : x.budget) : '—'}</span><small>${p[k + ':' + x.id] ? '<span class="cp-tag ok">En ligne</span>' : '<span class="cp-tag warn">Sur cet appareil, en attente d’envoi</span>'} ${x.negociable === false ? '· prix ferme ' : ''}· ${x.createdAt ? ago(x.createdAt) : ''}</small></div>`;
      const neg = n => { const e = n.statut === 'conclue' ? ['Accord conclu', 'ok'] : n.statut === 'close' ? [n.motif_fin === 'annonce_retiree' ? 'Annonce retirée' : 'Négociation arrêtée', ''] : vive(n) ? (n.dernier_par === u.id ? ['En attente de réponse', 'warn'] : ['À vous de répondre', 'acc']) : n.dernier_par ? ['Expirée sans réponse', ''] : ['Proposition retirée ou refusée', ''];
        const lui = n.auteur_id === u.id ? n.proprio_id : n.auteur_id, roleLui = (lui === n.proprio_id) === (n.cible === 'offre') ? 'Vendeur' : 'Acheteur', av = avatar(lui, { size: 30, nom: roleLui });
        return `<button type="button" class="cp-item" data-nego="${n.id}"><span style="grid-row:span 2">${av.svg}</span><b>${esc(n.produit || 'Annonce')}</b><span class="p">${n.statut === 'conclue' ? fmt(n.prix_final) : vive(n) ? fmt(n.dernier_prix) : '—'}</span><small><span class="cp-tag ${e[1]}">${e[0]}</span> ${esc(av.nom ? 'avec ' + av.nom : '')}</small></button>`; };
      const sec = (t, L, f, vide) => `<h3>${t} <span class="cp-tag">${L.length}</span></h3>` + (L.length ? `<div class="cp-list">${L.slice(0, 20).map(f).join('')}</div>` : `<div class="cp-empty">${vide}</div>`);
      main.innerHTML = `<div class="cp-panel"><h2>Mon activité</h2><p>Vos annonces et vos négociations réelles. Rien n’est compté qui n’ait eu lieu.</p>
        ${sec('Mes offres', off, x => ann('offres', x), '<b>Aucune offre</b>Publiez ce que vous avez avec « Vendre ».')}
        ${sec('Mes demandes', dem, x => ann('demandes', x), '<b>Aucune demande</b>Dites ce qu’il vous faut avec « Demander ».')}
        ${sec('Propositions envoyées', env, neg, '<b>Aucune proposition envoyée</b>Sur une annonce, touchez « Proposer un prix ».')}
        ${sec('Propositions reçues', rec, neg, '<b>Aucune proposition reçue</b>Elles arrivent ici quand un acheteur ou un vendeur répond à vos annonces.')}
        ${sec('Accords conclus', ok, neg, '<b>Aucun accord pour l’instant</b>')}
        ${fin.length ? sec('Sans suite', fin, neg, '') : ''}</div>`;
      main.querySelectorAll('[data-nego]').forEach(b => b.onclick = () => { fermer(); G && G.thread(b.dataset.nego); });
      if (G) G.refresh().then(() => { if (bg && main.isConnected && JSON.stringify(J('mdg-negoce:liste', [])) !== JSON.stringify(negos)) VUES.activite(main); });
    },
    notifs(main) {
      const L = notifs();
      main.innerHTML = `<div class="cp-panel"><h2>Notifications</h2><p>Propositions, contre-propositions, accords, refus et expirations de vos négociations, et nouvelles annonces sur vos produits.</p>
        <div data-pousse style="margin:0 0 18px"></div>
        ${L.length ? `<div class="cp-row" style="margin:0 0 12px"><button type="button" class="cp-alt" data-lu>Tout marquer comme lu</button></div><div class="cp-list">${L.slice(0, 60).map((n, i) => `<button type="button" class="cp-item${n.lu ? '' : ' is-new'}" data-i="${i}"><span style="grid-row:span 2;width:10px;height:10px;border-radius:50%;background:${n.lu ? 'transparent' : 'var(--acc)'}"></span><b>${esc(n.texte)}</b><span></span><small>${ago(n.t)}</small></button>`).join('')}</div>`
          : '<div class="cp-empty"><b>Rien de nouveau</b>Les réponses à vos propositions et les accords apparaîtront ici.</div>'}</div>`;
      cartePousse(main.querySelector('[data-pousse]'));
      const lu = main.querySelector('[data-lu]'); if (lu) lu.onclick = () => { W(KN, notifs().map(n => Object.assign(n, { lu: true }))); bg.rafraichir(); };
      main.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const all = notifs(), n = all[+b.dataset.i]; if (!n) return; n.lu = true; W(KN, all); if (n.nego && window.MDGNegoce) { fermer(); MDGNegoce.thread(n.nego); } else bg.rafraichir(); });
    },
    prefs(main) {
      const pf = prefs(), p = profil || {}, S = window.MDGSons, sn = S ? S.reglages() : null;
      main.innerHTML = `<div class="cp-panel"><h2>Préférences</h2><p>Chaque réglage agit vraiment ; ce qui n’existe pas encore est indiqué.</p>
        <h3>Notifications</h3><div class="cp-card">
          <label class="cp-sw"><span>Messages à l’écran<small>Une ligne en bas de l’écran quand une proposition arrive, est acceptée ou refusée</small></span><input type="checkbox" data-pf="toasts" ${pf.toasts ? 'checked' : ''}></label>
</div><div data-pousse style="margin-top:10px"></div>
        <h3>Sons</h3><div class="cp-card"><div class="cp-kv"><span>${sn && sn.on ? 'Activés' : 'Désactivés'} · notes de balafon</span><button type="button" class="cp-alt" data-sons>Régler les sons</button></div></div>
        <h3>Confidentialité</h3><div class="cp-card">
          <label class="cp-sw"><span>Montrer mon nom de famille<small>Sinon, les autres voient « ${esc(p.prenom || 'Prénom')} ${esc(p.nom ? p.nom[0] + '.' : 'N.')} »${p.pseudo ? ' (votre pseudonyme passe avant)' : ''}</small></span><input type="checkbox" data-np ${p.nom_public ? 'checked' : ''}></label></div>
        <p class="cp-help">Le numéro inscrit sur une annonce est visible de tous : c’est ainsi que les acheteurs vous appellent. Vous le choisissez annonce par annonce.</p></div>`;
      main.querySelectorAll('[data-pf]').forEach(i => i.onchange = () => { const o = prefs(); o[i.dataset.pf] = i.checked; W(KPF, o); N().toast('Préférence enregistrée.'); });
      const s = main.querySelector('[data-sons]'); if (s) s.onclick = () => { fermer(); S && S.panneau(); };
      cartePousse(main.querySelector('[data-pousse]'));
      main.querySelector('[data-np]').onchange = async e => { try { await enregistrer({ nom_public: e.target.checked }); N().toast('Préférence enregistrée.'); bg.rafraichir(); } catch (x) { e.target.checked = !e.target.checked; N().toast(x.message); } };
    },
    securite(main) {
      const u = me();
      main.innerHTML = `<div class="cp-panel"><h2>Sécurité et compte</h2><p>Votre numéro et votre code secret à 6 chiffres protègent votre compte.</p>
        <div class="cp-card"><div class="cp-kv"><span>Numéro</span><b>${esc(N().fmtTel(u.tel))}</b></div>
          <div class="cp-kv"><span>Changer de numéro</span><b style="font-weight:400;color:var(--mute);font-size:13.5px">Contactez le Marché de Gros</b></div></div>
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
        go.disabled = true; go.setAttribute('aria-busy', 'true'); go.textContent = 'Vérification'; msg.textContent = '';
        try { await N().signIn(u.tel, c0); await N().api('/auth/v1/user', { method: 'PUT', auth: true, body: { password: c1 } }); f.reset(); msg.innerHTML = '<span class="cp-ok">✓ Code changé</span>'; }
        catch (x) { msg.innerHTML = `<span style="color:#F3A08C">${esc(/incorrect/i.test(x.message) ? 'Code actuel incorrect.' : x.message)}</span>`; }
        go.disabled = false; go.textContent = 'Changer mon code';
      };
      main.querySelector('[data-sos]').onclick = async e => { if (!confirm('Créer un nouveau code de secours ? L’ancien ne fonctionnera plus.')) return; e.target.disabled = true; try { const c = await N().rpc('creer_secours'); fermer(); N().showSecours ? N().showSecours(c) : alert('Votre code de secours : ' + c); } catch (x) { e.target.disabled = false; N().toast(x.message); } };
      main.querySelector('[data-out]').onclick = () => { fermer(); const fin = () => N().toast('Vous êtes sorti du marché. Vos annonces restent publiées.'); if (window.MDGPorte && MDGPorte.sortir) MDGPorte.sortir(fin, () => N().signOut()); else { N().signOut(); fin(); } };  // dans l'application : on « sort du marché » (v3/porte.js)
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
      const b = box.querySelector('.cp-go'); b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'Suppression';
      try { await N().signIn(me().tel, c); await N().rpc('supprimer_compte'); localStorage.removeItem(KP); fermer(); N().signOut(); N().toast('Votre compte est supprimé. Vos annonces ont été retirées.'); }
      catch (x) { er.textContent = /incorrect/i.test(x.message) ? 'Code incorrect.' : /supprimer_compte|schema cache|Could not find/i.test(x.message) ? 'La suppression n’est pas encore activée sur le serveur. Contactez le Marché de Gros.' : x.message; b.disabled = false; b.textContent = 'Supprimer définitivement'; }
    };
  }

  /* ——— choisir son avatar : portrait dessiné, photo (recadrée ici, envoyée dans avatars/<id>.jpg) ou initiales ——— */
  function choisirAvatar(apres, embarque) {
    const u = me(), M = A(), nom = nomAffiche(profil) || '?', cur = M.parse(profil && profil.avatar);
    let mode = cur.mode === 'v1' || cur.mode === 'ph' ? cur.mode : (profil && profil.avatar ? 'ini' : 'v1');
    let o = cur.mode === 'v1' ? cur : M.parse('v1:c=foulard;t=1;k=0;f=' + Math.max(0, cur.f >= 0 ? cur.f : 1));
    let fi = cur.f >= 0 ? cur.f : 1;
    const ph = { img: null, z: 1, x: 0, y: 0, url: '' }; // photo en cours de cadrage
    const S = 240; // côté du cadre de recadrage (px CSS)
    const codeNow = () => mode === 'v1' ? M.code(o) : mode === 'ini' ? 'ini:f=' + fi : cur.mode === 'ph' && !ph.img ? M.code(Object.assign({}, cur, { f: fi })) : '';
    const rnd = n => Math.floor(Math.random() * n);
    const html = () => '<div class="avx"><aside class="avx-pv"><div class="avx-big"></div><b class="avx-nom">' + esc(nom) + '</b><div class="avx-mini" aria-hidden="true"><span><i class="m36"></i><small>Négociation</small></span><span><i class="m24"></i><small>Annonce</small></span></div></aside>'
      + '<div class="avx-c"><div class="avx-mode" role="tablist" aria-label="Type d’avatar">' + [['v1', 'Portrait'], ['ph', 'Photo'], ['ini', 'Initiales']].map(([k, t]) => '<button type="button" role="tab" data-mode="' + k + '" aria-selected="' + (mode === k) + '">' + t + '</button>').join('') + '</div><div class="avx-p"></div></div></div>';
    const zone = embarque || (cadre('<div class="cp-main" style="grid-column:1 / -1"><h2>Mon avatar</h2><p>Il apparaît sur votre profil, à côté de vos annonces et dans vos négociations.</p><div class="cp-avw"></div><div class="cp-row avx-act"><button type="button" class="cp-go" data-ok>Enregistrer</button><button type="button" class="cp-alt" data-no>Annuler</button><span class="cp-msg" role="status"></span></div></div>', 'Mon avatar'), bg.querySelector('.cp-avw'));
    zone.innerHTML = html();
    const P = zone.querySelector('.avx-p'), big = zone.querySelector('.avx-big'), m36 = zone.querySelector('.m36'), m24 = zone.querySelector('.m24');
    function apercu() {
      if (mode === 'ph' && ph.img) { const d = rendu(144).toDataURL('image/jpeg', .8); big.innerHTML = '<img src="' + d + '" alt="" width="148" height="148">'; m36.innerHTML = '<img src="' + d + '" alt="" width="36" height="36">'; m24.innerHTML = '<img src="' + d + '" alt="" width="24" height="24">'; return; }
      const k = codeNow() || 'ini:f=' + fi;
      big.innerHTML = M.svg(k, { size: 148, nom, seed: u.id }); m36.innerHTML = M.svg(k, { size: 36, nom, seed: u.id }); m24.innerHTML = M.svg(k, { size: 24, nom, seed: u.id });
    }
    const dots = (L, key, sel, lab) => '<div class="cp-dots">' + L.map((col, i) => '<button type="button" class="cp-dot" data-' + key + '="' + i + '" style="background:' + col + '" aria-label="' + lab + ' ' + (i + 1) + '" aria-pressed="' + (sel === i) + '"></button>').join('') + '</div>';
    function panneau() {
      zone.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
      if (mode === 'v1') {
        const st = M.STYLES.find(x => x.id === o.c), cols = st && st.tissu ? M.TISSUS : M.CHEVEUX;
        P.innerHTML = '<div class="avx-sec"><div class="avx-h"><span class="cp-l">Coiffure</span><button type="button" class="avx-dice" data-dice>Au hasard</button></div><div class="avx-grid">' + M.STYLES.map(s => '<button type="button" class="avx-pick" data-c="' + s.id + '" aria-pressed="' + (o.c === s.id) + '">' + M.svg(M.code(Object.assign({}, o, { c: s.id, k: !!s.tissu === !!(st && st.tissu) ? o.k : 0 })), { size: 56, nom: s.nom }) + '<span>' + s.nom + '</span></button>').join('') + '</div></div>'
          + '<div class="avx-sec"><span class="cp-l">Teint</span>' + dots(M.TEINTS, 't', o.t, 'Teint') + '</div>'
          + '<div class="avx-sec"><span class="cp-l">' + (st && st.tissu ? 'Couleur du tissu' : 'Couleur des cheveux') + '</span>' + dots(cols, 'k', o.k, 'Couleur') + '</div>'
          + '<div class="avx-sec"><span class="cp-l">Fond</span>' + dots(M.FONDS, 'f', o.f, 'Fond') + '</div>'
          + '<div class="avx-sec"><span class="cp-l">Détail</span><div class="cp-seg">' + M.DETAILS.map(d => '<button type="button" data-a="' + d.id + '" aria-pressed="' + ((o.a || '') === d.id) + '">' + d.nom + '</button>').join('') + '</div></div>';
      } else if (mode === 'ini') {
        P.innerHTML = '<div class="avx-sec"><p class="avx-txt">Vos initiales, « ' + esc(M.initiales(nom)) + ' », sur le fond de votre choix.</p><span class="cp-l">Fond</span>' + dots(M.FONDS, 'fi', fi, 'Fond') + '</div>';
      } else {
        P.innerHTML = ph.img
          ? '<div class="avx-sec avx-crop"><div class="avx-stage" tabindex="0" aria-label="Cadrage de la photo : glissez pour déplacer, flèches du clavier aussi"><canvas width="' + S * 2 + '" height="' + S * 2 + '"></canvas><i aria-hidden="true"></i></div><label class="avx-zoom"><span class="cp-l">Agrandir</span><input type="range" min="1" max="3" step="0.01" value="' + ph.z + '"></label><p class="cp-help">Glissez la photo pour la centrer sur votre visage.</p><div class="cp-row"><label class="cp-alt avx-file">Choisir une autre photo<input type="file" accept="image/*" hidden></label></div></div>'
          : '<div class="avx-sec"><label class="avx-drop"><input type="file" accept="image/*" hidden><b>' + (cur.mode === 'ph' ? 'Changer de photo' : 'Choisir une photo') + '</b><span>Depuis la galerie ou l’appareil photo · JPEG, PNG ou HEIC</span></label><p class="cp-help">Visible de tous, à côté de vos annonces et dans vos négociations. Une photo de vous ou de votre stand, jamais d’une pièce d’identité.</p></div>';
        const fl = P.querySelector('input[type=file]'); if (fl) fl.onchange = () => charger1(fl.files && fl.files[0]);
        const dr = P.querySelector('.avx-drop'); if (dr) { dr.ondragover = e => { e.preventDefault(); dr.classList.add('is-over'); }; dr.ondragleave = () => dr.classList.remove('is-over'); dr.ondrop = e => { e.preventDefault(); dr.classList.remove('is-over'); charger1(e.dataTransfer.files[0]); }; }
        if (ph.img) cadrage();
      }
      apercu();
    }
    function charger1(f) {
      const msg = zone.closest('.cp') && zone.closest('.cp').querySelector('.cp-msg'); if (msg) msg.textContent = '';
      if (!f || !/^image\//.test(f.type || 'image/')) { if (msg) msg.textContent = 'Ce fichier n’est pas une image.'; return; }
      if (ph.url) URL.revokeObjectURL(ph.url);
      ph.url = URL.createObjectURL(f); const im = new Image();
      im.onload = () => { ph.img = im; ph.z = 1; ph.x = 0; ph.y = 0; panneau(); };
      im.onerror = () => { if (msg) msg.textContent = 'Cette image ne s’ouvre pas ici. Essayez une photo JPEG ou PNG.'; };
      im.src = ph.url;
    }
    // la photo couvre le cadre ; x, y = décalage en px du cadre ; z = agrandissement
    const borne = () => { const im = ph.img, k = Math.max(S / im.naturalWidth, S / im.naturalHeight) * ph.z, w = im.naturalWidth * k, h = im.naturalHeight * k; ph.x = Math.min(0, Math.max(S - w, ph.x)); ph.y = Math.min(0, Math.max(S - h, ph.y)); return [k, w, h]; };
    function dessiner(ctx, n) { const [k, w, h] = borne(), r = n / S; ctx.fillStyle = '#1d1a15'; ctx.fillRect(0, 0, n, n); ctx.drawImage(ph.img, ph.x * r, ph.y * r, w * r, h * r); }
    function rendu(n) { const cv = document.createElement('canvas'); cv.width = cv.height = n; dessiner(cv.getContext('2d'), n); return cv; }
    function cadrage() {
      const st = P.querySelector('.avx-stage'), cv = st.querySelector('canvas'), ctx = cv.getContext('2d'), rg = P.querySelector('input[type=range]');
      if (!ph.x && !ph.y) { const [k, w, h] = borne(); ph.x = (S - w) / 2; ph.y = (S - h) / 2; }
      let raf = 0; const peindre = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { dessiner(ctx, S * 2); }); };
      let tAp = 0; const ap = () => { clearTimeout(tAp); tAp = setTimeout(apercu, 90); };
      peindre();
      let g = null;
      st.onpointerdown = e => { g = { x: e.clientX, y: e.clientY, x0: ph.x, y0: ph.y }; st.setPointerCapture(e.pointerId); st.classList.add('is-drag'); };
      st.onpointermove = e => { if (!g) return; ph.x = g.x0 + e.clientX - g.x; ph.y = g.y0 + e.clientY - g.y; peindre(); };
      st.onpointerup = st.onpointercancel = () => { g = null; st.classList.remove('is-drag'); ap(); };
      st.onkeydown = e => { const d = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key]; if (!d) return; e.preventDefault(); ph.x += d[0]; ph.y += d[1]; peindre(); ap(); };
      st.onwheel = e => { e.preventDefault(); zoom(Math.min(3, Math.max(1, ph.z - e.deltaY * .002))); rg.value = ph.z; };
      const zoom = z => { const c0 = S / 2, [k0] = borne(), ix = (c0 - ph.x) / k0, iy = (c0 - ph.y) / k0; ph.z = z; const [k1] = borne(); ph.x = c0 - ix * k1; ph.y = c0 - iy * k1; peindre(); ap(); };
      rg.oninput = () => zoom(+rg.value);
    }
    zone.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !zone.contains(b)) return; const d = b.dataset;
      if (d.mode) { mode = d.mode; panneau(); return; }
      if (d.dice) { const s = M.STYLES[rnd(M.STYLES.length)]; o = { mode: 'v1', c: s.id, t: rnd(M.TEINTS.length), k: rnd((s.tissu ? M.TISSUS : M.CHEVEUX).length), f: rnd(M.FONDS.length), a: M.DETAILS[rnd(M.DETAILS.length)].id }; panneau(); return; }
      if (d.c) { const was = M.STYLES.find(x => x.id === o.c), now = M.STYLES.find(x => x.id === d.c); if (!!was.tissu !== !!now.tissu) o.k = 0; o.c = d.c; }
      else if (d.t) o.t = +d.t; else if (d.k) o.k = +d.k; else if (d.f) { o.f = +d.f; fi = o.f; } else if (d.fi) fi = +d.fi; else if ('a' in d) o.a = d.a; else return;
      panneau();
    });
    panneau();
    // le code à enregistrer ; pour une nouvelle photo, l'envoi a lieu ici (et seulement ici)
    async function finir() {
      if (mode !== 'ph') return codeNow();
      if (!ph.img) { if (cur.mode === 'ph') return codeNow(); throw new Error('Choisissez d’abord une photo, ou un portrait.'); }
      if (!navigator.onLine) throw new Error('Pas de connexion internet : la photo sera envoyée quand le réseau revient.');
      const blob = await new Promise(r => rendu(384).toBlob(r, 'image/jpeg', .84));
      try { await N().televerser('avatars/' + u.id + '.jpg', blob); }
      catch (x) { throw new Error(x.status === 404 || /bucket|not found/i.test(x.message) ? 'La photo de profil n’est pas encore activée sur le serveur (supabase/schema-5.sql). Choisissez un portrait en attendant.' : x.status === 413 ? 'Photo trop lourde. Essayez-en une autre.' : x.code === 'auth' ? 'Votre session a expiré : reconnectez-vous.' : 'La photo n’a pas pu être envoyée : ' + x.message); }
      return 'ph:u=' + u.id + ';v=' + Date.now().toString(36).slice(-6) + ';f=' + fi;
    }
    if (embarque) return finir;
    const ok = bg.querySelector('[data-ok]'), msg = bg.querySelector('.cp-msg');
    ok.onclick = async () => { ok.disabled = true; ok.setAttribute('aria-busy', 'true'); ok.textContent = mode === 'ph' && ph.img ? 'Envoi de la photo' : 'Enregistrement'; msg.textContent = '';
      try { const k = await finir(); await enregistrer({ avatar: k }); N().toast(mode === 'ph' ? 'Photo de profil enregistrée.' : 'Avatar enregistré.'); fermer(true); apres ? apres() : ouvrir('profil'); }
      catch (x) { ok.disabled = false; ok.removeAttribute('aria-busy'); ok.textContent = 'Enregistrer'; msg.textContent = x.message; } };
    bg.querySelector('[data-no]').onclick = () => { fermer(true); apres ? apres() : ouvrir('profil'); };
  }

  /* ——— bienvenue : 3 étapes courtes après la création du compte (les deux dernières peuvent attendre) ——— */
  function bienvenue(opt = {}) {
    const u = me(); if (!u || !A()) return;
    // prénom, nom et pseudonyme déjà saisis à l'inscription : on commence par l'avatar
    let etape = opt.identite ? 2 : 1, getAv = null;
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
        const okb = w.querySelector('[data-ok]'); okb.onclick = async () => { okb.disabled = true; okb.setAttribute('aria-busy', 'true'); let m = ''; try { m = await suite({ avatar: await getAv() }); } catch (x) { m = x.message; } if (m && okb.isConnected) { okb.disabled = false; okb.removeAttribute('aria-busy'); let er = w.querySelector('.cp-msg'); if (!er) { er = document.createElement('span'); er.className = 'cp-msg'; er.setAttribute('role', 'status'); okb.parentNode.appendChild(er); } er.textContent = m; } };
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
