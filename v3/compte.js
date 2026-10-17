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
  const CSS = `.cp-bg{position:fixed;inset:0;z-index:8800;background:rgba(8,7,5,.66);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:cpIn var(--ux-d2,200ms) ease both}
@media (min-width:760px){.cp-bg{align-items:center;padding:24px}}
/* une seule logique : une page d'accueil (qui je suis, où j'en suis, mes réglages), puis des pages qu'on ouvre et qu'on referme */
.cp{--bg:#17140F;--card:#221E18;--card2:#2B261F;--ink:#F5F0E6;--mute:#B9AD98;--faint:#8F846F;--line:rgba(245,240,230,.08);--acc:#E07A3F;--acc2:#F3B48A;--ok:#6CC58C;--warn:#F2C94C;--blue:#6AAEF0;--violet:#B095F0;--bad:#F08A73;
  position:relative;display:flex;flex-direction:column;width:100%;max-width:600px;height:min(94dvh,860px);background:var(--bg);color:var(--ink);border-radius:28px 28px 0 0;box-shadow:0 -10px 60px rgba(0,0,0,.55);
  font:400 15px/1.45 Jost,system-ui,sans-serif;font-variant-numeric:lining-nums tabular-nums;overflow:hidden;animation:cpUp var(--ux-d3,320ms) cubic-bezier(.22,1,.36,1) both}
@media (min-width:760px){.cp{border-radius:28px;height:min(90dvh,820px);box-shadow:0 30px 90px rgba(0,0,0,.55)}}
.cp::before{content:"";position:absolute;left:50%;top:8px;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(245,240,230,.18)}
@media (min-width:760px){.cp::before{display:none}}
/* barre du haut : retour à gauche, titre au centre, fermer à droite */
.cp-top{flex:none;display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;min-height:64px;padding:12px 8px 4px}
.cp-top-t{text-align:center;font:600 16px/1.2 Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity var(--ux-d2,200ms)}
.cp-top.titre .cp-top-t{opacity:1}
.cp-back{width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:var(--ink);cursor:pointer}
.cp-back svg{width:22px;height:22px}
.cp-x{position:absolute;right:14px;top:16px;z-index:3;width:44px;height:44px;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:var(--ink);cursor:pointer}
.cp-main{flex:1;min-height:0;overflow:auto;padding:4px 16px calc(36px + env(safe-area-inset-bottom));overscroll-behavior:contain;scroll-padding-top:16px}
@media (min-width:760px){.cp-main{padding:4px 28px 40px}}
.cp-main>h2,.cp-pg>h2,.cp-w>h2{margin:2px 4px 4px;font:500 32px/1.08 'Cormorant Garamond',Georgia,serif;letter-spacing:-.005em}
.cp-main>h2+p,.cp-pg>h2+p,.cp-w>h2+p{margin:0 4px 18px;color:var(--mute);font-size:14px;line-height:1.5}
.cp-pg{animation:cpFade var(--ux-d2,200ms) ease both}
/* étiquette de section, comme les réglages de l'iPhone : petite, en capitales, hors des cartes */
.cp-lab{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:24px 16px 8px;font:600 12px/1.2 Jost,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.cp-lab em{font-style:normal;letter-spacing:0;color:var(--mute)}
.cp-lab button{border:0;background:none;padding:6px 0;color:var(--acc2);font:600 13px Jost,sans-serif;letter-spacing:0;text-transform:none;cursor:pointer}
.cp-note{margin:8px 16px 0;color:var(--faint);font-size:12.5px;line-height:1.45}
/* carte groupée et ses lignes */
.cp-grp{background:var(--card);border-radius:18px;overflow:hidden}
.cp-grp+.cp-grp{margin-top:12px}
.cp-r{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:9px 14px;border:0;background:none;color:var(--ink);font:inherit;text-align:left;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color var(--ux-d1,120ms)}
.cp-r+.cp-r::before,.cp-r+.cp-acc::before,.cp-acc+.cp-r::before{content:"";position:absolute;left:58px;right:0;top:0;height:1px;background:var(--line)}
.cp-acc{position:relative}.cp-acc+.cp-acc::before{content:"";position:absolute;left:58px;right:0;top:0;height:1px;background:var(--line);z-index:1}
.cp-r:active{background:rgba(245,240,230,.06)}@media (hover:hover){.cp-r:hover{background:rgba(245,240,230,.04)}}
.cp-r.info{cursor:default}.cp-r.info:active,.cp-r.info:hover{background:none}
.cp-r-t{flex:1;min-width:0;display:block}
.cp-r-t b{display:block;font-weight:500;font-size:15.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-r-t small{display:block;margin-top:2px;color:var(--mute);font-size:13px;line-height:1.35}
.cp-r-v{flex:none;max-width:45%;color:var(--mute);font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-r-v.fort{color:var(--ink);font-weight:600}
.cp-chev{flex:none;width:16px;height:16px;fill:none;stroke:var(--faint);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform var(--ux-d3,320ms) cubic-bezier(.22,1,.36,1)}
.cp-r.bad{color:var(--bad)}.cp-r.centre{justify-content:center;font-weight:600}
summary.cp-r{list-style:none}summary.cp-r::-webkit-details-marker{display:none}
.cp-acc[open]>summary .cp-chev{transform:rotate(90deg)}
.cp-acc-c{padding:2px 16px 18px 58px;animation:cpFade var(--ux-d3,320ms) ease both}
@media (max-width:420px){.cp-acc-c{padding-left:16px}}
/* tuile d'icône : la couleur dit le sens (vert vendre, jaune attendre, violet moi, bleu échanger, terracotta le marché, sable comprendre/protéger) */
.cp-ti{--t:#CFC4B1;flex:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:var(--t);background:rgba(245,240,230,.06);background:color-mix(in srgb,var(--t) 17%,transparent)}
.cp-ti svg{width:18px;height:18px}
.cp-ti[data-ton=offre]{--t:var(--ok)}.cp-ti[data-ton=demande]{--t:var(--warn)}.cp-ti[data-ton=vous]{--t:var(--violet)}.cp-ti[data-ton=lien]{--t:var(--blue)}.cp-ti[data-ton=marche]{--t:#EE9A62}.cp-ti[data-ton=bad]{--t:var(--bad)}
.cp-ti.lg{width:44px;height:44px;border-radius:13px}.cp-ti.lg svg{width:24px;height:24px}
/* pastilles */
.cp-n{flex:none;min-width:22px;height:22px;padding:0 7px;border-radius:11px;background:var(--acc);color:#171512;font:700 12px/22px Jost,sans-serif;text-align:center}
.cp-tag{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:11px;font:600 12px/1 Jost,sans-serif;background:rgba(245,240,230,.08);color:var(--mute);white-space:nowrap}
.cp-tag.warn{background:rgba(242,201,76,.15);color:#F2DC9A}.cp-tag.ok{background:rgba(108,197,140,.16);color:#A9E0BC}.cp-tag.acc{background:rgba(224,122,63,.2);color:var(--acc2)}.cp-tag.bleu{background:rgba(106,174,240,.16);color:#A9CDF5}
/* accueil : la carte d'identité */
.cp-id{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:center;padding:4px 4px 0}
.cp-id-av{position:relative;width:76px;height:76px;border-radius:50%;box-shadow:0 0 0 3px var(--bg),0 0 0 4.5px rgba(245,240,230,.14)}
.cp-id-av svg,.cp-id-av img{display:block;border-radius:50%}
.cp-id h2{margin:0;font:500 30px/1.05 'Cormorant Garamond',Georgia,serif;overflow-wrap:anywhere}
.cp-id p{margin:4px 0 0;color:var(--mute);font-size:14px}
.cp-id-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
@media (max-width:360px){.cp-id{gap:12px}.cp-id-av{width:62px;height:62px}.cp-id-av svg{width:62px;height:62px}.cp-id h2{font-size:26px}.cp-st b{font-size:22px}}
.cp-id-edit{grid-column:1 / -1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;margin-top:14px;border:0;border-radius:14px;background:var(--card);color:var(--ink);font:600 14.5px Jost,sans-serif;cursor:pointer}
.cp-id-edit svg{width:17px;height:17px}
/* accueil : trois chiffres réels, chacun ouvre le détail */
.cp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.cp-st{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:86px;padding:12px;border:0;border-radius:16px;background:var(--card);color:var(--ink);text-align:left;cursor:pointer;font:inherit}
.cp-st:active{transform:scale(.98)}
.cp-st i{display:block;width:10px;height:10px;border-radius:50%;background:var(--ok)}.cp-st i.d{border-radius:2.5px;background:var(--warn)}.cp-st i.n{background:var(--blue)}
.cp-st b{font:600 26px/1 Jost,sans-serif;letter-spacing:-.01em}
.cp-st small{color:var(--mute);font-size:12.5px;line-height:1.2}
/* réputation */
.cp-rep{display:flex;align-items:center;gap:12px;width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:18px;background:linear-gradient(120deg,rgba(242,201,76,.12),var(--card) 60%);color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.cp-rep-n{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:rgba(242,201,76,.16);color:var(--warn);font:700 18px/1 Jost,sans-serif}
.cp-rep b{display:block;font-size:15px;font-weight:600}.cp-rep small{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:2px;color:var(--mute);font-size:13px;line-height:1.35}
.cp-rep .cp-chev{margin-left:auto}
/* annonces et négociations : une ligne nette, le montant aligné à droite */
.cp-it{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2px 12px;align-items:center}
.cp-it .mk{grid-row:span 2;width:32px;height:32px;display:grid;place-items:center}
.cp-it .mk i{display:block;width:11px;height:11px;border-radius:50%;background:var(--ok)}.cp-it .mk i.d{border-radius:2.5px;background:var(--warn)}
.cp-it .mk svg{border-radius:50%}
.cp-it b{font-weight:500;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-it small{grid-column:2;display:flex;align-items:center;flex-wrap:wrap;gap:6px;color:var(--mute);font-size:12.5px}
.cp-it .p{grid-row:span 2;text-align:right;font:600 15px/1.1 Jost,sans-serif;white-space:nowrap}.cp-it .p em{display:block;margin-top:2px;font:400 11.5px Jost,sans-serif;font-style:normal;color:var(--faint)}
.cp-it.neuf{box-shadow:inset 3px 0 0 var(--acc)}
.cp-it .pt{grid-row:span 2;width:8px;height:8px;margin:0 12px;border-radius:50%;background:var(--acc)}.cp-it .pt.lu{background:transparent}
.cp-vide{padding:16px;color:var(--mute);font-size:14px;line-height:1.5}
.cp-vide b{display:block;color:var(--ink);font-weight:600;font-size:14.5px}
/* interrupteur façon iPhone */
.cp-tog{-webkit-appearance:none;appearance:none;flex:none;position:relative;width:51px;height:31px;margin:0;border-radius:16px;background:rgba(245,240,230,.16);cursor:pointer;transition:background var(--ux-d2,200ms)}
.cp-tog::after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transition:transform var(--ux-d2,200ms) cubic-bezier(.22,1,.36,1)}
.cp-tog:checked{background:var(--acc)}.cp-tog:checked::after{transform:translateX(20px)}
.cp-tog:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
label.cp-r{cursor:pointer}
/* formulaires */
.cp-f{display:grid;gap:14px}
.cp-fg{display:grid;gap:14px;padding:16px;background:var(--card);border-radius:18px}
.cp-l{display:block;margin:0 0 6px;font-size:13px;font-weight:500;color:var(--mute)}.cp-l i{font-style:normal;font-weight:400;color:var(--faint)}
.cp-in,.cp-sel{width:100%;box-sizing:border-box;height:50px;padding:0 14px;border:1px solid transparent;border-radius:13px;background:#14110D;color:var(--ink);font:500 16px Jost,sans-serif;transition:border-color var(--ux-d2,200ms),background var(--ux-d2,200ms)}
.cp-in::placeholder{color:var(--faint)}
.cp-in:focus,.cp-sel:focus{outline:none;border-color:var(--acc);background:#110F0B}
.cp-in[aria-invalid=true]{border-color:var(--bad)}
.cp-err{margin:6px 0 0;color:var(--bad);font-size:13px}.cp-err:empty{display:none}
.cp-help{margin:6px 0 0;color:var(--faint);font-size:12.5px;line-height:1.45}
.cp-seg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:3px;padding:3px;border-radius:13px;background:#14110D}
.cp-seg button{min-height:42px;padding:0 6px;border:0;border-radius:10px;background:none;color:var(--mute);font:600 13.5px/1.15 Jost,sans-serif;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.cp-seg button[aria-pressed=true]{background:var(--card2);color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.3)}
.avx .cp-seg,.avx-sec .cp-seg{display:flex;flex-wrap:wrap;background:none;padding:0;gap:8px}.avx-sec .cp-seg button{min-height:40px;padding:0 14px;border:1px solid rgba(245,240,230,.16);border-radius:999px}.avx-sec .cp-seg button[aria-pressed=true]{background:var(--ink);color:#171512;box-shadow:none}
.cp-go{min-height:52px;padding:0 24px;border:0;border-radius:15px;background:var(--acc);color:#171512;font:700 15.5px Jost,sans-serif;cursor:pointer;transition:filter var(--ux-d2,200ms),opacity var(--ux-d2,200ms)}
.cp-go.plein{width:100%}
.cp-go:active{filter:brightness(.94)}.cp-go[disabled]{opacity:.55;cursor:default}
.cp-alt{min-height:46px;padding:0 18px;border:0;border-radius:13px;background:var(--card2);color:var(--ink);font:600 14.5px Jost,sans-serif;cursor:pointer}
.cp-alt:active{filter:brightness(1.1)}
.cp-bad{color:var(--bad)}
.cp-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.cp-msg:empty{display:none}
.cp-ok{display:inline-flex;align-items:center;gap:6px;color:#A9E0BC;font-size:14px;font-weight:600}
.cp-card{padding:14px;background:var(--card);border-radius:18px}
.cp-card+.cp-card{margin-top:12px}
.cp-kv{display:flex;justify-content:space-between;gap:14px;align-items:center;min-height:48px}
.cp-kv span{color:var(--mute);font-size:14px}.cp-kv b{font-weight:600;text-align:right}
/* notifications du téléphone */
.cp-pousse{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}
.cp-pousse b{display:block;font-size:15px;font-weight:600;line-height:1.3}.cp-pousse small{display:block;margin-top:3px;color:var(--mute);font-size:13px;line-height:1.45}
.cp-pousse .cp-row{grid-column:1 / -1;gap:8px}
.cp-pousse .cp-err{grid-column:1 / -1}
/* avatar (page profil) */
.cp-avz{display:grid;justify-items:center;gap:12px;margin:4px 0 0}
.cp-avbig{position:relative;width:108px;height:108px;border-radius:50%;box-shadow:0 0 0 4px var(--bg),0 0 0 5.5px rgba(245,240,230,.14)}
.cp-avz .cp-row{justify-content:center}
@media (prefers-reduced-motion:reduce){.cp-tog,.cp-tog::after,.cp-top-t{transition:none}}
/* avatar (choix) */
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
.cp-steps{display:flex;gap:6px;margin:0 4px 18px}.cp-steps i{flex:1;height:4px;border-radius:2px;background:rgba(245,240,230,.12);transition:background var(--ux-d3,320ms)}.cp-steps i.on{background:var(--acc)}
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
.avx-act{position:sticky;bottom:calc(-36px - env(safe-area-inset-bottom));margin:22px -16px calc(-36px - env(safe-area-inset-bottom));padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(transparent,var(--bg) 26%)}
@media (min-width:760px){.avx-act{bottom:-40px;margin:24px -28px -40px;padding:16px 28px 22px}}
@keyframes avxIn{from{opacity:.4;transform:scale(.96)}}
@media (prefers-reduced-motion:reduce){.cp-bg,.cp,.cp-panel{animation:none}.avx-big>*,.avx-p{animation:none}.avx-pick svg{transition:none}}`;
  let css = false, bg = null, rendre = null;
  function cadre(html, label) {
    if (!css) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); css = true; }
    fermer(true);
    bg = document.createElement('div'); bg.className = 'cp-bg';
    // toujours une barre du haut : la croix y a sa place et ne chevauche jamais le contenu qui défile
    const tete = /^\s*<header class="cp-top"/.test(html) ? '' : '<header class="cp-top"><span></span><span class="cp-top-t"></span><span></span></header>';
    bg.innerHTML = `<div class="cp" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="cp-x" aria-label="Fermer">×</button>${tete}${html}</div>`;
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

  /* ——— l'espace personnel : une page d'accueil, puis des pages qu'on ouvre et qu'on referme (comme les Réglages du téléphone) ——— */
  const IC = (n, t) => (window.MDGIco && window.MDGIco.svg(n, t || 18, 1.9)) || '';
  const ti = (n, ton, lg) => `<span class="cp-ti${lg ? ' lg' : ''}" data-ton="${ton}" aria-hidden="true">${IC(n, lg ? 24 : 18)}</span>`;
  const CHEV = '<svg class="cp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  // une ligne : icône, titre (+ précision), valeur à droite, chevron
  const ligne = o => `<${o.href ? `a href="${o.href}"` : 'button type="button"'} class="cp-r${o.cls ? ' ' + o.cls : ''}" ${o.attrs || ''}>${o.ico || ''}<span class="cp-r-t"><b>${o.t}</b>${o.s ? `<small>${o.s}</small>` : ''}</span>${o.v != null && o.v !== '' ? `<span class="cp-r-v${o.vf ? ' fort' : ''}">${o.v}</span>` : ''}${o.n ? `<span class="cp-n" aria-label="${o.n} nouveau${o.n > 1 ? 'x' : ''}">${o.n}</span>` : ''}${o.chev === false ? '' : CHEV}</${o.href ? 'a' : 'button'}>`;
  const TITRES = { accueil: 'Mon compte', profil: 'Profil et avatar', activite: 'Mon activité', notifs: 'Notifications', prefs: 'Réglages', securite: 'Sécurité et compte' };
  const negosDe = () => { const u = me(), L = J('mdg-negoce:liste', []), vive = n => n.statut === 'ouverte' && n.dernier_par && n.expire_le && Date.parse(n.expire_le) > Date.now();
    return { vive, L, env: L.filter(n => vive(n) && n.dernier_par === u.id), rec: L.filter(n => vive(n) && n.dernier_par !== u.id), ok: L.filter(n => n.statut === 'conclue'), fin: L.filter(n => n.statut !== 'conclue' && !vive(n)) }; };
  const mesAnn = k => J('mdg-v2:' + k, []).filter(x => x && x.productSlug);

  function ouvrir(onglet) {
    if (!N()) return; const u = me(); if (!u) return N().open();
    let page = TITRES[onglet] ? onglet : 'accueil';
    cadre(`<header class="cp-top"><span></span><span class="cp-top-t"></span><span></span></header><div class="cp-main"></div>`, 'Mon espace');
    const main = bg.querySelector('.cp-main'), top = bg.querySelector('.cp-top');
    const aller = p => {
      page = p;
      top.innerHTML = (p === 'accueil' ? '<span></span>' : `<button type="button" class="cp-back" data-retour aria-label="Retour à Mon compte">${IC('retour', 22) || '‹'}</button>`) + `<span class="cp-top-t" aria-hidden="true">${TITRES[p]}</span><span></span>`;
      top.classList.remove('titre');
      const r = top.querySelector('[data-retour]'); if (r) r.onclick = () => aller('accueil');
      VUES[p](main); main.scrollTop = 0;
      const h = main.querySelector('h2'); if (h) h.setAttribute('tabindex', '-1');
    };
    // le titre de la page apparaît dans la barre quand le grand titre est passé
    main.addEventListener('scroll', () => top.classList.toggle('titre', main.scrollTop > 48), { passive: true });
    bg.aller = aller;
    aller(page);
    bg.rafraichir = () => { const y = main.scrollTop; aller(page); main.scrollTop = y; };
    if (navigator.onLine) charger().then(() => bg && bg.rafraichir && bg.rafraichir());
    const adm0 = J('mdg-nuage:admin', false); if (N().isAdmin) N().isAdmin().then(a => { if (a !== adm0 && bg && bg.rafraichir) bg.rafraichir(); });
  }

  // un champ texte avec message d'erreur près de lui
  const champ = (id, label, val, o = {}) => `<div><label class="cp-l" for="${id}">${label}${o.facultatif ? ' <i>· facultatif</i>' : ''}</label><input class="cp-in" id="${id}" value="${esc(val || '')}" ${o.attrs || ''} aria-describedby="${id}-e${o.aide ? ' ' + id + '-a' : ''}"><p class="cp-err" id="${id}-e" role="alert"></p>${o.aide ? `<p class="cp-help" id="${id}-a">${o.aide}</p>` : ''}</div>`;
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
  const lieu = p => `<div><label class="cp-l" for="cp-reg">Région où vous êtes d’habitude <i>· facultatif</i></label><select class="cp-sel" id="cp-reg"><option value="">—</option>${REGIONS().map(([s, n]) => `<option value="${s}" ${p.region_slug === s ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    ${champ('cp-ville', 'Ville ou localité', p.ville, { facultatif: true, attrs: 'maxlength="80" autocomplete="address-level2"', aide: 'Pour vous montrer d’abord ce qui est proche. Vos annonces gardent chacune leur lieu.' })}`;
  const roleSeg = p => `<div><span class="cp-l" id="cp-role-l">Vous êtes plutôt</span><div class="cp-seg" role="group" aria-labelledby="cp-role-l">${[['acheteur', 'J’achète'], ['vendeur', 'Je vends'], ['les_deux', 'Les deux']].map(([k, t]) => `<button type="button" data-role="${k}" aria-pressed="${p.role === k}">${t}</button>`).join('')}</div></div>`;
  const lierRole = root => root.querySelectorAll('[data-role]').forEach(b => b.onclick = () => root.querySelectorAll('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x === b && x.getAttribute('aria-pressed') !== 'true'))));
  const roleVal = root => { const b = root.querySelector('[data-role][aria-pressed=true]'); return b ? b.dataset.role : null; };
  const ROLE_TXT = { acheteur: 'Acheteur', vendeur: 'Vendeur', les_deux: 'Acheteur et vendeur' };

  /* ——— Notifications sur ce téléphone (v3/pousse.js) : l'état réel et l'action qui convient ——— */
  const POUSSE_COURT = { actif: 'Activées', inactif: 'Désactivées', refuse: 'Bloquées', installer: 'À installer', impossible: 'Indisponibles' };
  async function cartePousse(el) {
    const P = window.MDGPousse; if (!el) return;
    const st = P ? await P.etat() : 'impossible';
    const T = {
      actif: ['Activées sur ce téléphone', 'Une réponse à votre prix, un accord, un refus : vous êtes prévenu tout de suite, même application fermée.', '<button type="button" class="cp-alt" data-pe>Envoyer un essai</button><button type="button" class="cp-alt" data-pd>Désactiver</button>', 'offre'],
      inactif: ['Être prévenu même application fermée', 'Dès qu’on répond à votre prix, votre téléphone vous le dit, avec le nombre de réponses sur l’icône.', '<button type="button" class="cp-go plein" data-pa>Activer les notifications</button>', 'demande'],
      refuse: ['Bloquées sur ce téléphone', 'Réglages du téléphone → Notifications → Marché de Gros → Autoriser, puis revenez ici.', '', 'bad'],
      installer: ['Sur iPhone : ajoutez d’abord l’application', 'Touchez Partager, puis « Sur l’écran d’accueil ». Ouvrez-la depuis l’icône et activez ici.', '', 'demande'],
      impossible: ['Indisponibles dans ce navigateur', 'Ouvrez le Marché de Gros dans l’application installée, ou dans Chrome, Safari ou Edge à jour.', '', 'aide']
    }[st];
    el.innerHTML = `<div class="cp-card cp-pousse">${ti('cloche', T[3], true)}<span><b>${T[0]}</b><small>${T[1]}</small></span>${T[2] ? `<div class="cp-row">${T[2]}</div>` : ''}<p class="cp-err" role="status"></p></div>`;
    const msg = el.querySelector('.cp-err'), b = q => el.querySelector(q);
    if (b('[data-pa]')) b('[data-pa]').onclick = async e => { const t = e.currentTarget; t.disabled = true; t.textContent = 'Activation…'; t.setAttribute('aria-busy', 'true');
      try { await P.activer(); N().toast('Notifications activées. Une notification d’essai arrive.'); cartePousse(el); }
      catch (x) { t.disabled = false; t.removeAttribute('aria-busy'); t.textContent = 'Activer les notifications'; const m = String(x.message); msg.textContent = m === 'REFUS' ? 'Vous avez refusé. Autorisez-les dans les réglages du téléphone, puis réessayez.' : m === 'SANS_REPONSE' ? 'Pas de réponse à la demande. Réessayez et touchez « Autoriser ».' : m === 'INSTALLER' ? 'Ajoutez d’abord l’application à l’écran d’accueil.' : 'L’activation n’a pas abouti. Vérifiez la connexion, puis réessayez.'; } };
    if (b('[data-pe]')) b('[data-pe]').onclick = async () => { msg.textContent = 'Envoi…'; const r = await P.essai(); msg.textContent = r && r.envoyees ? 'Envoyée : elle doit apparaître dans quelques secondes.' : 'L’essai n’est pas parti. Désactivez puis réactivez les notifications.'; };
    if (b('[data-pd]')) b('[data-pd]').onclick = async () => { await P.desactiver(); N().toast('Notifications désactivées sur ce téléphone.'); cartePousse(el); };
  }

  // réputation : la note réelle, sinon une phrase ; toucher ouvre le profil public
  function remplirRep(b, p, u) {
    const R = window.MDGRep; if (!b) return; if (!R) { b.remove(); return; }
    b.onclick = () => R.profil(u.id, { nom: nomAffiche(p) || 'Moi', uri: A().uri(p.avatar, { size: 72, nom: nomAffiche(p) || '?', seed: u.id }) });
    (async () => { let r = null; try { r = (await N().rpc('notes_publiques', { ids: [u.id] }))[0]; } catch (_) {}
      if (!b.isConnected) return;
      b.querySelector('[data-repn]').textContent = r ? String(r.moyenne).replace('.', ',') : '—';
      b.querySelector('[data-rept]').innerHTML = r ? R.etoiles(r.moyenne, r.nombre, 13) + ' <span>' + r.nombre + ' avis</span>' : 'Pas encore d’avis : ils arrivent après vos négociations.'; })();
  }
  const repBtn = '<button type="button" class="cp-rep" data-rep><span class="cp-rep-n" data-repn aria-hidden="true">—</span><span><b>Ma réputation</b><small data-rept>Ce que vos partenaires disent de vous</small></span>' + CHEV + '</button>';

  const VUES = {
    accueil(main) {
      const p = profil || {}, u = me(), nom = nomAffiche(p), off = mesAnn('offres'), dem = mesAnn('demandes'), ng = negosDe();
      const M = window.MDGMessages, dmN = M && M.unread ? M.unread() : 0, nl = nonLues(), S = window.MDGSons, sn = S ? S.reglages() : null;
      const reg = (REGIONS().find(r => r[0] === p.region_slug) || [])[1], lieuTxt = p.ville || reg || '';
      const adm = J('mdg-nuage:admin', false);
      main.innerHTML = `<div class="cp-pg">
        <section class="cp-id" aria-label="Mon identité"><div class="cp-id-av">${A() ? A().svg(p.avatar, { size: 76, nom: nom || '?', seed: u.id }) : ''}</div>
          <div><h2>${esc(nom || 'Mon compte')}</h2><p>${esc(N().fmtTel(u.tel))}</p><div class="cp-id-tags">${p.role ? `<span class="cp-tag bleu">${ROLE_TXT[p.role] || ''}</span>` : ''}${lieuTxt ? `<span class="cp-tag">${IC('lieu', 12)}${esc(lieuTxt)}</span>` : ''}${!nom ? '<span class="cp-tag warn">Profil à compléter</span>' : ''}</div></div>
          <button type="button" class="cp-id-edit" data-go="profil">${IC('crayon', 17)}Modifier mon profil</button></section>
        <div class="cp-stats">
          <button type="button" class="cp-st" data-go="activite" aria-label="${off.length} offre${off.length > 1 ? 's' : ''} : voir mon activité"><i></i><b>${off.length}</b><small>offre${off.length > 1 ? 's' : ''}</small></button>
          <button type="button" class="cp-st" data-go="activite" aria-label="${dem.length} demande${dem.length > 1 ? 's' : ''} : voir mon activité"><i class="d"></i><b>${dem.length}</b><small>demande${dem.length > 1 ? 's' : ''}</small></button>
          <button type="button" class="cp-st" data-go="activite" aria-label="${ng.env.length + ng.rec.length} négociation${ng.env.length + ng.rec.length > 1 ? 's' : ''} en cours : voir mon activité"><i class="n"></i><b>${ng.env.length + ng.rec.length}</b><small>en négociation</small></button>
        </div>
        ${repBtn}
        <h3 class="cp-lab">Échanges</h3>
        <div class="cp-grp">
          ${M ? ligne({ ico: ti('messages', 'lien'), t: 'Messages', s: 'Effacés ' + M.JOURS + ' jours après l’envoi', n: dmN, attrs: 'data-dm' }) : ''}
          ${ligne({ ico: ti('negoce', 'lien'), t: 'Négociations', s: ng.rec.length ? ng.rec.length + ' à vous de répondre' : ng.ok.length ? ng.ok.length + ' accord' + (ng.ok.length > 1 ? 's' : '') + ' conclu' + (ng.ok.length > 1 ? 's' : '') : 'Propositions, réponses et accords', n: ng.rec.length, attrs: 'data-go="activite"' })}
          ${ligne({ ico: ti('publications', 'offre'), t: 'Mes annonces', v: String(off.length + dem.length), attrs: 'data-go="activite"' })}
        </div>
        <h3 class="cp-lab">Réglages</h3>
        <div class="cp-grp">
          ${ligne({ ico: ti('cloche', 'demande'), t: 'Notifications', v: '<span data-pst>…</span>', n: nl, attrs: 'data-go="notifs"' })}
          ${S ? ligne({ ico: ti('son', 'marche'), t: 'Sons', v: sn && sn.on ? 'Activés' : 'Désactivés', attrs: 'data-sons' }) : ''}
          ${ligne({ ico: ti('oeil', 'vous'), t: 'Confidentialité et affichage', v: p.nom_public ? 'Nom visible' : 'Initiale', attrs: 'data-go="prefs"' })}
        </div>
        <h3 class="cp-lab">Compte</h3>
        <div class="cp-grp">
          ${ligne({ ico: ti('cadenas', 'aide'), t: 'Sécurité et code secret', attrs: 'data-go="securite"' })}
          ${adm ? ligne({ ico: ti('tableau', 'marche'), t: 'Tableau de bord', s: 'Administration', href: 'admin.html' }) : ''}
        </div>
        <div class="cp-grp">${ligne({ t: 'Me déconnecter', cls: 'bad centre', chev: false, attrs: 'data-out' })}</div>
        <p class="cp-note">Votre numéro n’est pas vérifié par SMS. Rien n’est compté ici qui n’ait eu lieu.</p></div>`;
      main.querySelectorAll('[data-go]').forEach(b => b.onclick = () => bg.aller(b.dataset.go));
      const d = main.querySelector('[data-dm]'); if (d) d.onclick = () => { fermer(); M.boite(); };
      const s = main.querySelector('[data-sons]'); if (s) s.onclick = () => { fermer(); S.panneau(); };
      main.querySelector('[data-out]').onclick = deconnecter;
      remplirRep(main.querySelector('[data-rep]'), p, u);
      const pst = main.querySelector('[data-pst]'); (window.MDGPousse ? MDGPousse.etat() : Promise.resolve('impossible')).then(st => { if (pst.isConnected) pst.textContent = POUSSE_COURT[st] || ''; }).catch(() => { pst.textContent = ''; });
    },
    profil(main) {
      const p = profil || {}, u = me();
      main.innerHTML = `<div class="cp-pg"><h2>Profil et avatar</h2><p>Ce que les autres voient quand vous publiez ou négociez : votre avatar et ${p.pseudo ? 'votre pseudonyme' : 'votre prénom'}${p.nom_public ? ' et votre nom' : ', avec l’initiale de votre nom'}.</p>
        <div class="cp-avz"><div class="cp-avbig">${A().svg(p.avatar, { size: 108, nom: nomAffiche(p) || '?', seed: u.id })}</div><div class="cp-row"><button type="button" class="cp-alt" data-av>${p.avatar ? 'Changer d’avatar' : 'Choisir mon avatar'}</button>${p.avatar ? '<button type="button" class="cp-alt" data-av0>Mes initiales</button>' : ''}</div></div>
        <form class="cp-f" novalidate>
          <h3 class="cp-lab">Comment on vous appelle</h3>
          <div class="cp-fg">${champ('cp-prenom', 'Prénom', p.prenom, { attrs: 'maxlength="40" autocomplete="given-name" required' })}${champ('cp-nom', 'Nom', p.nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Les autres ne voient que son initiale, sauf si vous choisissez de le montrer (Confidentialité).' })}
          ${champ('cp-pseudo', 'Pseudonyme', p.pseudo, { facultatif: true, attrs: 'maxlength="24" autocomplete="nickname" spellcheck="false" autocapitalize="off"', aide: 'S’il est rempli, il remplace votre prénom. Unique sur le Marché de Gros.' })}</div>
          <h3 class="cp-lab">Ce que vous faites, et où</h3>
          <div class="cp-fg">${roleSeg(p)}${lieu(p)}</div>
          <button type="submit" class="cp-go plein">Enregistrer</button><span class="cp-msg" role="status"></span></form>
        <h3 class="cp-lab">Téléphone</h3>
        <div class="cp-grp">${ligne({ ico: ti('telephone', 'aide'), t: esc(N().fmtTel(u.tel)), s: 'Numéro du compte', cls: 'info', chev: false })}</div>
        <p class="cp-note">Le nom affiché sur chaque annonce (nom de vendeur ou d’exploitation) reste celui de l’annonce.</p></div>`;
      lierRole(main);
      main.querySelector('[data-av]').onclick = () => choisirAvatar(() => ouvrir('profil'));
      const z = main.querySelector('[data-av0]'); if (z) z.onclick = async () => { try { await enregistrer({ avatar: null }); bg.rafraichir(); N().toast('Avatar : vos initiales.'); } catch (e) { N().toast(e.message); } };
      const f = main.querySelector('form'), msg = main.querySelector('.cp-msg'), go = main.querySelector('.cp-go');
      f.querySelectorAll('.cp-in').forEach(i => i.addEventListener('blur', () => { const k = i.id.slice(3); if (VALID[k] && i.value) valider(f, [k]); }));
      f.onsubmit = async e => {
        e.preventDefault(); msg.textContent = ''; if (!valider(f, ['prenom', 'nom', 'pseudo'])) { f.querySelector('[aria-invalid=true]').focus(); return; }
        if (!navigator.onLine) { msg.textContent = 'Pas de connexion internet : réessayez quand le réseau revient.'; return; }
        go.disabled = true; go.setAttribute('aria-busy', 'true'); go.textContent = 'Enregistrement…';
        try { await enregistrer({ prenom: f.querySelector('#cp-prenom').value.trim(), nom: f.querySelector('#cp-nom').value.trim() || null, pseudo: f.querySelector('#cp-pseudo').value.trim() || null, role: roleVal(f), region_slug: f.querySelector('#cp-reg').value || null, ville: f.querySelector('#cp-ville').value.trim() || null });
          N().toast('Profil enregistré.'); bg.aller('accueil'); }
        catch (x) { go.disabled = false; go.removeAttribute('aria-busy'); go.textContent = 'Enregistrer'; if (/pseudonyme/i.test(x.message)) { f.querySelector('#cp-pseudo').setAttribute('aria-invalid', 'true'); f.querySelector('#cp-pseudo-e').textContent = x.message; } else msg.innerHTML = `<span class="cp-bad">${esc(x.message)}</span>`; }
      };
    },
    activite(main) {
      const G = window.MDGNegoce, u = me(), pp = J('mdg-nuage:pousse', {}), off = mesAnn('offres'), dem = mesAnn('demandes'), ng = negosDe();
      const prix = (k, x) => { const v = k === 'offres' ? x.price : x.budget; return v ? `${fmt(v)} F<em>${k === 'offres' ? 'prix' : 'budget'} / ${esc(x.unit || 'kg')}</em>` : '<em>à discuter</em>'; };
      const ann = (k, x) => `<div class="cp-r cp-it info"><span class="mk" aria-hidden="true"><i${k === 'offres' ? '' : ' class="d"'}></i></span><b>${esc(x.productLabel || x.productName || x.productSlug)}${x.quantity ? ' · ' + fmt(x.quantity) + ' ' + esc(x.unit || '') : ''}</b><span class="p">${prix(k, x)}</span><small>${pp[k + ':' + x.id] ? '<span class="cp-tag ok">En ligne</span>' : '<span class="cp-tag warn">En attente d’envoi</span>'}${x.negociable === false ? '<span>Prix ferme</span>' : ''}<span>${x.createdAt ? ago(x.createdAt) : ''}</span></small></div>`;
      const neg = n => { const e = n.statut === 'conclue' ? ['Accord conclu', 'ok'] : n.statut === 'close' ? [n.motif_fin === 'annonce_retiree' ? 'Annonce retirée' : 'Arrêtée', ''] : ng.vive(n) ? (n.dernier_par === u.id ? ['En attente', 'warn'] : ['À vous de répondre', 'acc']) : n.dernier_par ? ['Expirée', ''] : ['Retirée ou refusée', ''];
        const lui = n.auteur_id === u.id ? n.proprio_id : n.auteur_id, roleLui = (lui === n.proprio_id) === (n.cible === 'offre') ? 'Vendeur' : 'Acheteur', av = avatar(lui, { size: 32, nom: roleLui }), v = n.statut === 'conclue' ? n.prix_final : ng.vive(n) ? n.dernier_prix : null;
        return `<button type="button" class="cp-r cp-it" data-nego="${n.id}"><span class="mk" aria-hidden="true">${av.svg}</span><b>${esc(n.produit || 'Annonce')}</b><span class="p">${v ? fmt(v) + ' F' : '—'}</span><small><span class="cp-tag ${e[1]}">${e[0]}</span>${av.nom ? '<span>avec ' + esc(av.nom) + '</span>' : ''}</small></button>`; };
      const dms = J('mdg-dm:liste', []), dm = c => `<button type="button" class="cp-r cp-it${c.non_lu ? ' neuf' : ''}" data-dm="${c.id}"><span class="mk" aria-hidden="true">${avatar(c.autre_id, { size: 32, nom: c.autre_nom }).svg}</span><b>${esc(c.autre_nom)}</b><span class="p">${c.non_lu ? '<span class="cp-tag acc">Nouveau</span>' : ''}</span><small><span>${c.dernier_par === u.id ? 'Vous : ' : ''}${esc(c.dernier_texte || '')}</span></small></button>`;
      const sec = (t, L, f, vide) => `<h3 class="cp-lab">${t}<em>${L.length}</em></h3><div class="cp-grp">${L.length ? L.slice(0, 20).map(f).join('') : `<p class="cp-vide">${vide}</p>`}</div>`;
      main.innerHTML = `<div class="cp-pg"><h2>Mon activité</h2><p>Vos annonces et vos négociations réelles. Rien n’est compté qui n’ait eu lieu.</p>
        ${ng.rec.length ? sec('À vous de répondre', ng.rec, neg, '') : ''}
        ${sec('Mes offres', off, x => ann('offres', x), '<b>Aucune offre</b>Publiez ce que vous avez avec « J’ai ».')}
        ${sec('Mes demandes', dem, x => ann('demandes', x), '<b>Aucune demande</b>Dites ce qu’il vous faut avec « Je cherche ».')}
        ${sec('Propositions envoyées', ng.env, neg, 'Sur une annonce, touchez « Proposer un prix ».')}
        ${ng.ok.length ? sec('Accords conclus', ng.ok, neg, '') : ''}
        ${window.MDGMessages ? sec('Messages', dms, dm, 'Touchez la photo d’un membre, puis « Écrire ». Effacés ' + MDGMessages.JOURS + ' jours après l’envoi.') : ''}
        ${ng.fin.length ? sec('Sans suite', ng.fin, neg, '') : ''}
        ${!ng.rec.length ? '<p class="cp-note">Les propositions reçues apparaîtront ici, en haut, dès qu’un membre répond à vos annonces.</p>' : ''}</div>`;
      main.querySelectorAll('[data-nego]').forEach(b => b.onclick = () => { fermer(); G && G.thread(b.dataset.nego); });
      main.querySelectorAll('[data-dm]').forEach(b => b.onclick = () => { fermer(); MDGMessages.conversation(b.dataset.dm); });
      // glisser une négociation vers la gauche pour la retirer de sa liste
      if (G && G.glisser) main.querySelectorAll('[data-nego]').forEach(b => G.glisser(b, async () => { await G.masquer(b.dataset.nego); }));
      if (G) G.refresh().then(() => { if (bg && main.isConnected && JSON.stringify(J('mdg-negoce:liste', [])) !== JSON.stringify(ng.L)) VUES.activite(main); });
    },
    notifs(main) {
      const L = notifs();
      main.innerHTML = `<div class="cp-pg"><h2>Notifications</h2><p>Propositions, contre-propositions, accords, refus et expirations, et nouvelles annonces sur vos produits.</p>
        <div data-pousse></div>
        <h3 class="cp-lab">Récentes${L.some(n => !n.lu) ? '<button type="button" data-lu>Tout marquer comme lu</button>' : ''}</h3>
        <div class="cp-grp">${L.length ? L.slice(0, 60).map((n, i) => `<button type="button" class="cp-r cp-it${n.lu ? '' : ' neuf'}" data-i="${i}"><span class="pt${n.lu ? ' lu' : ''}" aria-label="${n.lu ? 'Lue' : 'Non lue'}"></span><b style="white-space:normal">${esc(n.texte)}</b><span></span><small><span>${ago(n.t)}</span></small></button>`).join('')
          : '<p class="cp-vide"><b>Rien de nouveau</b>Les réponses à vos propositions et les accords apparaîtront ici.</p>'}</div></div>`;
      cartePousse(main.querySelector('[data-pousse]'));
      const lu = main.querySelector('[data-lu]'); if (lu) lu.onclick = () => { W(KN, notifs().map(n => Object.assign(n, { lu: true }))); bg.rafraichir(); };
      main.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const all = notifs(), n = all[+b.dataset.i]; if (!n) return; n.lu = true; W(KN, all); if (n.nego && window.MDGNegoce) { fermer(); MDGNegoce.thread(n.nego); } else bg.rafraichir(); });
    },
    prefs(main) {
      const pf = prefs(), p = profil || {}, S = window.MDGSons, sn = S ? S.reglages() : null;
      main.innerHTML = `<div class="cp-pg"><h2>Réglages</h2><p>Chaque réglage agit vraiment ; ce qui n’existe pas encore n’est pas montré.</p>
        <h3 class="cp-lab">Confidentialité</h3>
        <div class="cp-grp"><label class="cp-r">${ti('oeil', 'vous')}<span class="cp-r-t"><b>Montrer mon nom de famille</b><small>Sinon, les autres voient « ${esc(p.prenom || 'Prénom')} ${esc(p.nom ? p.nom[0] + '.' : 'N.')} »${p.pseudo ? ' (votre pseudonyme passe avant)' : ''}</small></span><input type="checkbox" class="cp-tog" role="switch" data-np ${p.nom_public ? 'checked' : ''}></label></div>
        <p class="cp-note">Votre numéro n’est jamais affiché sur vos annonces : on vous écrit et on vous propose un prix dans l’application.</p>
        <h3 class="cp-lab">À l’écran</h3>
        <div class="cp-grp"><label class="cp-r">${ti('ecran', 'lien')}<span class="cp-r-t"><b>Messages à l’écran</b><small>Une ligne en bas quand une proposition arrive, est acceptée ou refusée</small></span><input type="checkbox" class="cp-tog" role="switch" data-pf="toasts" ${pf.toasts ? 'checked' : ''}></label>
          ${S ? ligne({ ico: ti('son', 'marche'), t: 'Sons', s: 'Notes de balafon', v: sn && sn.on ? 'Activés' : 'Désactivés', attrs: 'data-sons' }) : ''}</div>
        <h3 class="cp-lab">Sur ce téléphone</h3>
        <div data-pousse></div></div>`;
      main.querySelectorAll('[data-pf]').forEach(i => i.onchange = () => { const o = prefs(); o[i.dataset.pf] = i.checked; W(KPF, o); N().toast('Réglage enregistré.'); });
      const s = main.querySelector('[data-sons]'); if (s) s.onclick = () => { fermer(); S && S.panneau(); };
      cartePousse(main.querySelector('[data-pousse]'));
      main.querySelector('[data-np]').onchange = async e => { try { await enregistrer({ nom_public: e.target.checked }); N().toast('Réglage enregistré.'); } catch (x) { e.target.checked = !e.target.checked; N().toast(x.message); } };
    },
    securite(main) {
      const u = me();
      const acc = (ico, t, s, corps, cls) => `<details class="cp-acc"><summary class="cp-r${cls ? ' ' + cls : ''}">${ico}<span class="cp-r-t"><b>${t}</b><small>${s}</small></span>${CHEV}</summary><div class="cp-acc-c">${corps}</div></details>`;
      main.innerHTML = `<div class="cp-pg"><h2>Sécurité et compte</h2><p>Votre numéro et votre code secret à 6 chiffres protègent votre compte.</p>
        <h3 class="cp-lab">Connexion</h3>
        <div class="cp-grp">${ligne({ ico: ti('telephone', 'aide'), t: esc(N().fmtTel(u.tel)), s: 'Votre numéro de connexion. Pour en changer, écrivez au Marché de Gros.', cls: 'info', chev: false })}
          ${acc(ti('cle', 'vous'), 'Changer mon code secret', 'Il vous faut votre code actuel', `<form class="cp-f cp-code" novalidate>${champ('cp-c0', 'Code actuel', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"' })}${champ('cp-c1', 'Nouveau code (6 chiffres)', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"' })}${champ('cp-c2', 'Retapez le nouveau code', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"' })}<button type="submit" class="cp-go plein">Enregistrer le nouveau code</button><span class="cp-msg" role="status"></span></form>`)}
          ${ligne({ ico: ti('bouee', 'demande'), t: 'Nouveau code de secours', s: 'Pour retrouver votre compte si vous oubliez votre code', attrs: 'data-sos' })}</div>
        <h3 class="cp-lab">Appareils</h3>
        <div class="cp-grp">${ligne({ ico: ti('sortir', 'marche'), t: 'Me déconnecter', s: 'Sur ce téléphone seulement', attrs: 'data-out' })}
          ${ligne({ ico: ti('appareils', 'marche'), t: 'Déconnecter tous mes appareils', s: 'Téléphone perdu ou prêté ? Tous devront se reconnecter', attrs: 'data-outall' })}</div>
        <h3 class="cp-lab">Vos données</h3>
        <div class="cp-grp">${acc(ti('donnees', 'aide'), 'Ce que nous gardons', 'Et pourquoi', '<p class="cp-help" style="font-size:13.5px;margin:0">Numéro et code secret (chiffré) : pour vous connecter. Profil : pour vous présenter aux autres. Annonces : pour être trouvées. Négociations et messages : pour que les deux parties gardent la trace de leurs échanges. Signalements : pour la modération. Sur cet appareil : vos annonces en attente, vos réglages et une copie des annonces des autres pour l’usage hors connexion.</p>')}
          ${acc(ti('supprimer', 'bad'), 'Supprimer mon compte', 'Définitif : vos annonces sont retirées', '<p style="margin:0 0 12px;color:var(--mute);font-size:14px;line-height:1.5">Vos annonces sont retirées et les négociations en cours fermées. Votre profil et votre code de secours sont effacés, et la connexion est bloquée. Les accords déjà conclus et les messages restent visibles des deux parties, pour la trace des échanges ; l’autre partie y voit « Compte supprimé ».</p><button type="button" class="cp-alt cp-bad" data-del>Je veux supprimer mon compte…</button>', 'bad')}</div></div>`;
      const f = main.querySelector('.cp-code'), msg = f.querySelector('.cp-msg'), go = f.querySelector('.cp-go');
      f.onsubmit = async e => {
        e.preventDefault(); const c0 = f.querySelector('#cp-c0').value, c1 = f.querySelector('#cp-c1').value, c2 = f.querySelector('#cp-c2').value;
        const err = (id, m) => { f.querySelectorAll('.cp-err').forEach(x => x.textContent = ''); f.querySelector('#' + id + '-e').textContent = m; f.querySelector('#' + id).focus(); };
        if (!/^\d{6}$/.test(c0)) return err('cp-c0', 'Votre code actuel fait 6 chiffres.');
        if (!/^\d{6}$/.test(c1)) return err('cp-c1', 'Le nouveau code fait 6 chiffres.');
        if (/^(\d)\1{5}$/.test(c1) || c1 === '123456' || c1 === '654321') return err('cp-c1', 'Trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.');
        if (c1 !== c2) return err('cp-c2', 'Les deux codes ne sont pas identiques.');
        go.disabled = true; go.setAttribute('aria-busy', 'true'); go.textContent = 'Vérification…'; msg.textContent = '';
        try { await N().signIn(u.tel, c0); await N().api('/auth/v1/user', { method: 'PUT', auth: true, body: { password: c1 } }); f.reset(); msg.innerHTML = '<span class="cp-ok">✓ Code changé</span>'; }
        catch (x) { msg.innerHTML = `<span class="cp-bad">${esc(/incorrect/i.test(x.message) ? 'Code actuel incorrect.' : x.message)}</span>`; }
        go.disabled = false; go.removeAttribute('aria-busy'); go.textContent = 'Enregistrer le nouveau code';
      };
      main.querySelector('[data-sos]').onclick = async e => { if (!confirm('Créer un nouveau code de secours ? L’ancien ne fonctionnera plus.')) return; const b = e.currentTarget; b.disabled = true; try { const c = await N().rpc('creer_secours'); fermer(); N().showSecours ? N().showSecours(c) : alert('Votre code de secours : ' + c); } catch (x) { b.disabled = false; N().toast(x.message); } };
      main.querySelector('[data-out]').onclick = deconnecter;
      main.querySelector('[data-outall]').onclick = async () => { if (!confirm('Déconnecter tous vos appareils, celui-ci compris ?')) return; try { await N().api('/auth/v1/logout?scope=global', { method: 'POST', auth: true }); } catch (_) {} fermer(); N().signOut(); N().toast('Tous vos appareils sont déconnectés.'); };
      main.querySelector('[data-del]').onclick = () => supprimer(main);
    }
  };
  // dans l'application : on « sort du marché » (v3/porte.js)
  function deconnecter() { fermer(); const fin = () => N().toast('Vous êtes sorti du marché. Vos annonces restent publiées.'); if (window.MDGPorte && MDGPorte.sortir) MDGPorte.sortir(fin, () => N().signOut()); else { N().signOut(); fin(); } }
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
        w.innerHTML = `<h2>Comment vous appelle-t-on&nbsp;?</h2><p>C’est ce que verront les vendeurs et les acheteurs avec qui vous échangez.</p><form class="cp-f cp-panel" novalidate>${champ('cp-prenom', 'Prénom', p().prenom, { attrs: 'maxlength="40" autocomplete="given-name"' })}${champ('cp-nom', 'Nom', p().nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Les autres ne voient que son initiale, sauf si vous choisissez de le montrer.' })}<div class="cp-row"><button class="cp-go">Continuer</button><span class="cp-msg" role="status"></span></div></form>`;
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
