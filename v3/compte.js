/* ═════════ Marché de Gros CI — compte : profil, avatar, activité, notifications, préférences, sécurité ═════════
   Le site et l'application utilisent ce même espace (au-dessus de v3/nuage.js, v3/avatar.js, v3/negoce.js, v3/sons.js).
   • Le compte (numéro + code secret, Supabase Auth) reste séparé du profil (table profils : comment on vous appelle).
   • Le numéro n'est pas vérifié par SMS (service payant, non installé) : c'est écrit tel quel, jamais présenté comme vérifié.
   • Aucun réglage factice : ce qui n'existe pas encore est marqué « pas encore disponible ».
   • Aucune statistique inventée : seules vos annonces et négociations réelles sont comptées.
   API : MDGCompte.ouvrir(onglet) · bienvenue() · profil() · avatar(uid) · hydrate(root) · prefs() */
(function () {
  'use strict';
  const ERR = x => window.MDGErreur ? MDGErreur(x) : String((x && x.message) || x || '');   // l'erreur en phrase simple (app/toast.js)
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
    const refus = N().texteRefus ? N().texteRefus(['prenom', 'nom', 'pseudo', 'bio', 'activites', 'structure_nom'].map(k => champs[k] || '').join(' · ')) : '';   // pas de lien ni de code (schéma 22)
    if (refus) throw new Error(refus);
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
    // compte officiel : toujours le logo du Marché de Gros, jamais la photo de la personne qui est derrière
    if (uid && window.MDGStatut && MDGStatut.estOfficiel && MDGStatut.estOfficiel(uid) && window.MDGMarque) {
      const svg = MDGMarque.dg(opt.size || 32, { fond: 'vert', rond: true });
      return { nom: 'Marché de Gros', svg, uri: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.indexOf('xmlns') < 0 ? svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') : svg), officiel: true };
    }
    const c = J(KC, {})[uid];
    if ((!c || Date.now() - c.t > 6e5) && uid) { attente.add(uid); clearTimeout(timer); timer = setTimeout(lot, 120); }
    return { nom: (c && c.a) || opt.nom || '', svg: A() ? A().svg(c && c.av, { size: opt.size || 32, nom: (c && c.a) || opt.nom || '?', seed: uid }) : '', uri: A() ? A().uri(c && c.av, { size: opt.size || 32, nom: (c && c.a) || opt.nom || '?', seed: uid }) : '' };
  }
  async function lot() {
    const ids = [...attente].slice(0, 200); attente = new Set(); if (!ids.length || !N() || !navigator.onLine) return;
    try {
      const repli = e => /profils_publics|schema cache|Could not find|404/i.test(e.message + e.status);
      const r = await N().rpc('profils_publics3', { ids }, false).catch(e => repli(e) ? N().rpc('profils_publics2', { ids }, false) : Promise.reject(e)).catch(e => repli(e) ? N().rpc('profils_publics', { ids }, false) : Promise.reject(e)), c = J(KC, {}), now = Date.now();
      ids.forEach(id => { c[id] = { a: '', av: '', r: '', t: now }; });
      (r || []).forEach(p => { c[p.user_id] = { a: p.affichage || '', av: p.avatar || '', r: p.role || '', st: p.structure_nom ? p.structure_type || '' : '', sn: p.structure_nom || '', sl: p.structure_logo || '', sv: !!p.structure_verifiee, t: now }; });
      W(KC, c); dispatchEvent(new CustomEvent('mdg:profils')); dispatchEvent(new CustomEvent('mdg:change', { detail: { from: 'nuage' } }));
    } catch (_) {}
  }
  // la structure d'un membre (coopérative, groupement, entreprise), d'après le même cache : null si elle agit seule ou si on ne sait pas encore
  function structure(uid) {
    if (!uid || (window.MDGStatut && MDGStatut.estOfficiel && MDGStatut.estOfficiel(uid))) return null;
    const c = J(KC, {})[uid]; if (!c || Date.now() - c.t > 6e5) avatar(uid);
    return c && c.sn ? { type: c.st, nom: c.sn, logo: c.sl, verifiee: !!c.sv, libelle: (STRUCT[c.st] || ['Structure'])[0] } : null;
  }
  // la puce discrète des annonces et des messages : « Coopérative · Akwaba »
  const puceStructure = (uid, o = {}) => { const s = structure(uid); if (!s) return '';
    const sansAccent = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), dit = sansAccent(s.nom).includes(sansAccent(s.libelle).slice(0, 6));
    const txt = dit ? s.nom : s.libelle + ' · ' + s.nom;
    // vérifiée par l'équipe (schéma 39) : coche verte et « vérifiée » lu par les lecteurs d'écran
    return `<span class="st-org${s.verifiee ? ' ok' : ''}" title="${esc(s.libelle + (s.verifiee ? (s.type === 'marche' ? ' vérifié' : ' vérifiée') : '') + ' · ' + s.nom)}">${s.logo && o.logo !== false ? `<img src="${esc(imgStruct(s.logo))}" alt="">` : IC(STRUCT_ICO[s.type] || 'compte', 12)}<span>${esc(txt)}</span>${s.verifiee ? `<b class="st-ok" aria-label="vérifiée">${IC('verifie', 12)}</b>` : ''}</span>`; };
  // remplit les emplacements [data-av-uid] (site) avec l'avatar de la personne
  function hydrate(root) {
    (root || document).querySelectorAll('[data-av-uid]').forEach(el => { const a = avatar(el.dataset.avUid, { size: +el.dataset.avSize || 28, nom: el.dataset.avNom || '' }); el.innerHTML = a.svg; });
  }
  addEventListener('mdg:profils', () => hydrate());

  /* ——— apparence ——— */
  const CSS = `.cp-bg{position:fixed;inset:0;z-index:8800;background:rgba(8,7,5,.62);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:cpIn var(--ux-d2,200ms) ease both}
@media (min-width:760px){.cp-bg{align-items:center;padding:24px}}
/* Mon compte : un en-tête chaud et vivant (qui je suis), puis un papier clair et calme (ce que je fais, mes réglages).
   La couleur porte le sens dans l'activité (vert vendre, jaune chercher, vert profond échanger et vérifié, terracotta le marché ; plus de bleu : décision du 24/10/2026) ; les réglages restent sobres. */
.cp{--bg:#F4EEE3;--card:#FFFDF8;--card2:#EFE7D9;--ink:#171512;--mute:#655C4D;--faint:#6F6553;--line:rgba(23,21,18,.08);--line2:rgba(23,21,18,.14);--acc:#10392B;--acc-t:#10392B;
  --ok:#2E7D4F;--ok-bg:rgba(108,197,140,.2);--warn:#8A6400;--warn-bg:rgba(242,201,76,.24);--blue:#10392B;--blue-bg:rgba(16,57,43,.1);--violet:#6B4FB8;--violet-bg:rgba(176,149,240,.2);--bad:#C0442B;--bad-bg:rgba(226,115,91,.14);
  position:relative;display:flex;flex-direction:column;width:100%;max-width:600px;height:min(94dvh,880px);background:var(--bg);color:var(--ink);border-radius:28px 28px 0 0;box-shadow:0 -10px 60px rgba(0,0,0,.5);
  font:400 15px/1.45 Jost,system-ui,sans-serif;font-variant-numeric:lining-nums tabular-nums;overflow:hidden;animation:cpUp var(--ux-d3,320ms) cubic-bezier(.22,1,.36,1) both}
@media (min-width:760px){.cp{border-radius:28px;height:min(90dvh,840px);box-shadow:0 30px 90px rgba(0,0,0,.5)}}
/* barre du haut : retour à gauche, titre au centre, fermer à droite */
.cp-top{flex:none;position:relative;z-index:2;display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;min-height:64px;padding:12px 8px 4px;background:var(--bg)}
.cp-top::before{content:"";position:absolute;left:50%;top:8px;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(23,21,18,.16)}
@media (min-width:760px){.cp-top::before{display:none}}
.cp-top-t{text-align:center;font:600 16px/1.2 Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity var(--ux-d2,200ms)}
.cp-top.titre .cp-top-t{opacity:1}
.cp-back{width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:rgba(23,21,18,.07);color:var(--ink);cursor:pointer}
.cp-back svg{width:22px;height:22px}
.cp-x{position:absolute;right:14px;top:16px;z-index:4;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.07);color:var(--ink);cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
/* accueil : la barre devient transparente sur l'en-tête */
.cp.sur-hero .cp-top{position:absolute;left:0;right:0;top:0;background:none}
.cp.sur-hero .cp-top::before{background:rgba(255,255,255,.4)}
.cp.sur-hero .cp-x{background:rgba(255,255,255,.18);color:#fff;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.cp.sur-hero.defile .cp-top{background:rgba(244,238,227,.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--line)}
.cp.sur-hero.defile .cp-top::before{background:rgba(23,21,18,.16)}
.cp.sur-hero.defile .cp-x{background:rgba(23,21,18,.07);color:var(--ink)}
.cp-main{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;padding:4px 16px calc(36px + env(safe-area-inset-bottom));overscroll-behavior:contain;scroll-padding-top:72px}
@media (min-width:760px){.cp-main{padding:4px 28px 40px}}
.cp.sur-hero .cp-main{padding-top:0}
.cp-main>h2,.cp-pg>h2,.cp-w>h2{margin:2px 4px 4px;font:600 26px/1.08 Jost,sans-serif;letter-spacing:-.015em;letter-spacing:-.005em}
.cp-main>h2+p,.cp-pg>h2+p,.cp-w>h2+p{margin:0 4px 18px;color:var(--mute);font-size:14px;line-height:1.5}
.cp-pg{animation:cpFade var(--ux-d2,200ms) ease both}
/* l'en-tête de l'accueil : un champ de terre chaude, l'avatar au centre */
.cp-hero{position:relative;margin:0 -16px;padding:64px 20px 44px;color:#fff;text-align:center;overflow:hidden;
  background:radial-gradient(120% 80% at 85% 0%,rgba(242,194,48,.22),transparent 55%),radial-gradient(90% 70% at 0% 100%,rgba(4,20,14,.7),transparent 60%),linear-gradient(165deg,#1C5A43 0%,#10392B 50%,#0A261C 100%)}
@media (min-width:760px){.cp-hero{margin:0 -28px}}
.cp-hero>*{position:relative}
.cp-hero-av{position:relative;width:104px;height:104px;margin:0 auto;border-radius:50%;padding:6px;background:rgba(255,255,255,.18);box-shadow:0 18px 40px rgba(40,12,2,.35)}
.cp-hero-av>svg,.cp-hero-av>img{display:block;width:92px;height:92px;border-radius:50%}
.cp-hero-cam{position:absolute;right:-2px;bottom:-2px;width:36px;height:36px;padding:0;margin:0;-webkit-appearance:none;appearance:none;display:grid;place-items:center;border:0;border-radius:50%;background:#F2C230;color:#171512;cursor:pointer;box-shadow:0 0 0 3px #143F30,0 4px 10px rgba(0,0,0,.3)}
.cp-hero-cam svg{display:block;width:18px;height:18px}.cp-hero-cam:active{transform:scale(.94)}
.cp-hero h2 em{font:800 italic 1em Jost,sans-serif;color:#F2C230;letter-spacing:-.015em}
.cp-hero h2{margin:14px 0 0;font:600 24px/1.1 Jost,sans-serif;letter-spacing:-.01em;overflow-wrap:anywhere}.cp-hero h2 .idv-badge{color:#F3EFE4}
.cp-hero p{margin:6px 0 0;color:rgba(255,255,255,.82);font-size:14px}
.cp-hero-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:10px}
.cp-hero-tags span{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:13px;background:rgba(255,255,255,.16);color:#fff;font:600 12.5px/1 Jost,sans-serif}
.cp-hero-tags span.a{background:#FFE7A8;color:#5B3D00}
.cp-hero-tags span.cp-adm{background:#F2C230;color:#10392B;height:30px;padding:0 12px 0 4px;border-radius:15px;font-size:13px}.cp-adm svg{border-radius:50%;box-shadow:0 0 0 1.5px #10392B}
.cp-off-p{max-width:300px;margin-left:auto;margin-right:auto;line-height:1.4}
.cp-hero-tags span.idok{background:#fff;color:var(--blue)}
.cp-idv{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 14px;padding:12px 14px;border:0;border-radius:18px;background:#FFFDF8;box-shadow:0 4px 14px rgba(23,21,18,.06),inset 0 0 0 1px rgba(23,21,18,.07);color:var(--ink);font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
button.cp-idv:active{transform:scale(.985)}div.cp-idv{cursor:default}
.cp-idv-i{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:rgba(16,57,43,.08);color:var(--blue)}.cp-idv.ko .cp-idv-i{background:var(--bad-bg);color:var(--bad)}
.cp-idv-x{flex:1;min-width:0}.cp-idv b{display:block;font:600 15.5px/1.25 Jost,sans-serif}.cp-idv small{display:block;margin-top:2px;color:var(--mute);font-size:13px;line-height:1.35}
.cp-idv-j{flex:none;display:flex;gap:3px}.cp-idv-j i{width:7px;height:7px;border-radius:50%;background:rgba(23,21,18,.14)}.cp-idv-j i.on{background:var(--warn)}
.cp-idv-c{flex:none;color:var(--mute);display:flex}
.cp-hero-act{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.cp-hero-act button{position:relative;display:flex;align-items:center;justify-content:center;gap:9px;min-height:50px;padding:0 12px;border:1px solid rgba(255,255,255,.22);border-radius:18px;background:rgba(255,255,255,.14);color:#fff;font:600 15px Jost,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.cp-hero-act button:active{background:rgba(255,255,255,.22)}
.cp-hero-act svg{width:20px;height:20px}
.cp-hero-act em{position:absolute;top:-6px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#FFE7A8;color:#5B3D00;font:700 12px/22px Jost,sans-serif;font-style:normal}
/* le papier clair qui remonte sur l'en-tête */
.cp-body{position:relative;margin:-28px -16px 0;padding:22px 16px 0;border-radius:26px 26px 0 0;background:var(--bg)}
@media (min-width:760px){.cp-body{margin:-28px -28px 0;padding:24px 28px 0}}
/* titres de section */
.cp-sh{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:26px 4px 10px}
.cp-sh h3{margin:0;font:600 18px/1.2 Jost,sans-serif;letter-spacing:-.01em}
.cp-sh small{color:var(--mute);font-size:14px}
.cp-sh button,.cp-sh a{border:0;background:none;padding:8px 0;color:var(--acc-t);font:600 14.5px Jost,sans-serif;cursor:pointer;text-decoration:none}
.cp-sto{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cp-sto button{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:10px;align-items:center;min-height:64px;padding:10px 12px;border:1.5px solid var(--line2,rgba(23,21,18,.14));border-radius:16px;background:#fff;color:var(--ink,#171512);text-align:left;cursor:pointer;font:inherit}
.cp-sto button .i{grid-row:span 2;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:rgba(16,57,43,.08);color:#10392B}
.cp-sto button b{font:600 14.5px/1.15 Jost,sans-serif;letter-spacing:-.01em}.cp-sto button small{font-size:12px;line-height:1.3;color:var(--mute,#5E574B)}
.cp-sto button[aria-checked=true]{border-color:#10392B;box-shadow:0 0 0 1px #10392B inset;background:rgba(16,57,43,.04)}.cp-sto button[aria-checked=true] .i{background:#10392B;color:#F2C230}
.cp-st-d{display:grid;gap:14px;margin-top:14px}
.cp-st-row{display:flex;align-items:center;gap:12px}
.cp-st-logo,.cp-st-add{position:relative;flex:none;display:grid;place-items:center;align-content:center;gap:2px;width:76px;height:76px;border:1.5px dashed rgba(16,57,43,.35);border-radius:18px;background:rgba(16,57,43,.03);color:#10392B;font:600 12px/1 Jost,sans-serif;cursor:pointer;overflow:hidden}
.cp-st-logo.plein{border-style:solid;background:#fff}.cp-st-logo img{width:100%;height:100%;object-fit:contain}
.cp-st-logo input,.cp-st-add input{position:absolute;inset:0;opacity:0;cursor:pointer}
.cp-st-logo:focus-within,.cp-st-add:focus-within{outline:2px solid #10392B;outline-offset:2px}
.cp-st-pv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.cp-st-pv>div,.cp-st-pv .cp-st-add{position:relative;width:auto;height:auto;aspect-ratio:1;border-radius:14px;overflow:hidden}
.cp-st-pv img{width:100%;height:100%;object-fit:cover;display:block}
.cp-st-x{position:absolute;top:4px;right:4px;width:28px;height:28px;border:0;border-radius:50%;background:rgba(23,21,18,.72);color:#fff;font:600 16px/1 Jost,sans-serif;cursor:pointer}.cp-st-x::before{content:"";position:absolute;inset:-8px}
.cp-bdg{margin:0 0 4px;padding:14px 16px;border-radius:20px;background:var(--card,#FFFDF8);display:grid;gap:10px;font-size:14px;line-height:1.45;color:var(--mute,#5E574B)}
.cp-bdg p{margin:0}.cp-bdg p b{display:flex;align-items:center;gap:6px;color:var(--ink,#171512);font-weight:600;margin-bottom:2px}
.cp-bdg.ok{background:#DCEFE3;color:#10392B}.cp-bdg.ok p b{color:#10392B}.cp-bdg.att{background:#FFF4CF}
.cp-bdg-r{padding:10px 12px;border-radius:14px;background:rgba(229,96,79,.1);color:#8E2A1C}.cp-bdg-r b{color:#8E2A1C!important}
.cp-bdg-f{display:grid;gap:12px}.cp-bdg-f .cp-st-pv{grid-template-columns:repeat(3,minmax(0,1fr))}
.cp-st-aide{margin:8px 0 0;font-size:12.5px;line-height:1.45;color:var(--mute,#5E574B)}
.cp-voix{font:600 26px/1.08 Jost,sans-serif;letter-spacing:-.015em}.cp-voix em{font:900 italic 1em Jost,sans-serif;color:#10392B;letter-spacing:-.02em;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,rgba(242,194,48,.62) 60%,rgba(242,194,48,.62) 94%,transparent 94%);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.cp-lab{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:24px 16px 8px;font:600 13px/1.2 Jost,sans-serif;letter-spacing:0;color:var(--faint)}
.cp-lab em{font-style:normal;letter-spacing:0;color:var(--mute)}
.cp-lab button{border:0;background:none;padding:6px 0;color:var(--acc-t);font:600 13px Jost,sans-serif;letter-spacing:0;text-transform:none;cursor:pointer}
.cp-note{margin:10px 16px 0;color:var(--faint);font-size:12.5px;line-height:1.45}
/* trois chiffres réels */
.cp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cp-st{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:84px;padding:12px;border:0;border-radius:18px;background:var(--card);color:var(--ink);text-align:left;cursor:pointer;font:inherit;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.05)}
.cp-st:active{transform:scale(.98)}
.cp-st i:not(.n){display:inline-grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:rgba(108,197,140,.22);box-shadow:inset 0 0 0 1px rgba(108,197,140,.55);font:normal 13px/1 "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}.cp-st i:not(.n)::before{content:"";display:block;width:74%;height:74%;background:var(--sym-o) center/contain no-repeat}.cp-st i.d{border-radius:30%;background:rgba(242,194,48,.24);box-shadow:inset 0 0 0 1px rgba(242,194,48,.6)}.cp-st i.d::before{content:"";display:block;width:74%;height:74%;background:var(--sym-d) center/contain no-repeat}.cp-st i.n{display:block;width:10px;height:10px;border-radius:50%;background:#1F8A55}
.cp-st b{font:600 26px/1 Jost,sans-serif;letter-spacing:-.01em}
.cp-st small{color:var(--mute);font-size:12.5px;line-height:1.2}
/* activité : regroupée par jour ; une pastille ronde colorée par le sens, le montant à droite */
.cp-day{margin:14px 4px 6px;color:var(--faint);font-size:13px;font-weight:500}
.cp-feed{background:var(--card);border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.cp-ev{position:relative;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:2px 14px;align-items:center;width:100%;min-height:72px;padding:12px 14px;border:0;background:none;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.cp-ev+.cp-ev::before{content:"";position:absolute;left:76px;right:0;top:0;height:1px;background:var(--line)}
.cp-ev:active{background:rgba(23,21,18,.04)}
.cp-ev .o{grid-row:span 2;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--c-bg,rgba(23,21,18,.06));color:var(--c,var(--ink))}
.cp-ev .o svg{width:22px;height:22px}
.cp-ev[data-ton=offre]{--c:var(--ok);--c-bg:var(--ok-bg)}.cp-ev[data-ton=demande]{--c:var(--warn);--c-bg:var(--warn-bg)}.cp-ev[data-ton=lien]{--c:var(--blue);--c-bg:var(--blue-bg)}.cp-ev[data-ton=marche]{--c:var(--acc-t);--c-bg:rgba(16,57,43,.16)}.cp-ev[data-ton=aide]{--c:var(--mute);--c-bg:rgba(23,21,18,.06)}
.cp-ev b{font-weight:500;font-size:15.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-ev b.long{white-space:normal}
.cp-ev small{grid-column:2;color:var(--mute);font-size:13px;line-height:1.35}
.cp-ev .m{grid-row:span 2;text-align:right;font:600 16px/1.15 Jost,sans-serif;color:var(--c,var(--ink));white-space:nowrap}
.cp-ev .m em{display:block;margin-top:3px;font:500 12px Jost,sans-serif;font-style:normal;color:var(--faint)}
.cp-ev.neuf .o::after{content:"";position:absolute;width:10px;height:10px;margin:-32px 0 0 34px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 2px var(--card)}
.cp-vide{padding:18px 16px;color:var(--mute);font-size:14px;line-height:1.5}
.cp-vide b{display:block;color:var(--ink);font-weight:600;font-size:15px}
/* listes : réglages sobres (icône monochrome), comme des pages d'un carnet */
.cp-statuts{padding:16px;display:flex;flex-direction:column;gap:14px}.cp-statuts .cp-vide{margin:0;padding:0;text-align:left}
.cp-st-l{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.cp-st-l .st-p{height:26px;padding:0 11px;font-size:13px}
.cp-st-go{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;min-height:40px;padding:0 14px;border:0;border-radius:999px;background:rgba(16,57,43,.08);color:#10392B;font:600 14px Jost,system-ui,sans-serif}
.cp-grp{background:var(--card);border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.cp-grp+.cp-grp,.cp-grp+.cp-sh{margin-top:12px}
.cp-r{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:10px 16px;border:0;background:none;color:var(--ink);font:inherit;text-align:left;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color var(--ux-d1,120ms)}
.cp-r+.cp-r::before,.cp-r+.cp-acc::before,.cp-acc+.cp-r::before,.cp-acc+.cp-acc::before{content:"";position:absolute;left:54px;right:0;top:0;height:1px;background:var(--line);z-index:1}
.cp-acc{position:relative}
.cp-r:active{background:rgba(23,21,18,.05)}@media (hover:hover){.cp-r:hover{background:rgba(23,21,18,.03)}}
.cp-r.info{cursor:default}.cp-r.info:active,.cp-r.info:hover{background:none}
.cp-ico{flex:none;width:24px;height:24px;display:grid;place-items:center;color:var(--ink)}.cp-ico svg{width:22px;height:22px}
.cp-r-t{flex:1;min-width:0;display:block}
.cp-r-t b{display:block;font-weight:500;font-size:16px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-r-t small{display:block;margin-top:2px;color:var(--mute);font-size:13px;line-height:1.35}
.cp-r-v{flex:none;max-width:45%;color:var(--mute);font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-chev{flex:none;width:16px;height:16px;fill:none;stroke:var(--faint);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform var(--ux-d3,320ms) cubic-bezier(.22,1,.36,1)}
.cp-r.bad,.cp-r.bad .cp-ico{color:var(--bad)}
summary.cp-r{list-style:none}summary.cp-r::-webkit-details-marker{display:none}
.cp-acc[open]>summary .cp-chev{transform:rotate(90deg)}
.cp-acc-c{padding:2px 16px 18px 54px;animation:cpFade var(--ux-d3,320ms) ease both}
@media (max-width:420px){.cp-acc-c{padding-left:16px}}
/* tuile d'icône colorée (pages de détail) */
.cp-ti{--t:var(--mute);--tb:rgba(23,21,18,.06);flex:none;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:var(--t);background:var(--tb)}
.cp-ti svg{width:19px;height:19px}
.cp-ti[data-ton=offre]{--t:var(--ok);--tb:var(--ok-bg)}.cp-ti[data-ton=demande]{--t:var(--warn);--tb:var(--warn-bg)}.cp-ti[data-ton=vous]{--t:var(--violet);--tb:var(--violet-bg)}.cp-ti[data-ton=lien]{--t:var(--blue);--tb:var(--blue-bg)}.cp-ti[data-ton=marche]{--t:var(--acc-t);--tb:rgba(16,57,43,.16)}.cp-ti[data-ton=bad]{--t:var(--bad);--tb:var(--bad-bg)}
.cp-ti.lg{width:46px;height:46px;border-radius:14px}.cp-ti.lg svg{width:24px;height:24px}
/* pastilles */
.cp-n{flex:none;min-width:22px;height:22px;padding:0 7px;border-radius:11px;background:var(--acc);color:#F3EFE4;font:700 12px/22px Jost,sans-serif;text-align:center}
.cp-tag{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:11px;font:600 12px/1 Jost,sans-serif;background:rgba(23,21,18,.07);color:var(--mute);white-space:nowrap}
.cp-tag.warn{background:var(--warn-bg);color:var(--warn)}.cp-tag.ok{background:var(--ok-bg);color:#31543C}.cp-tag.acc{background:rgba(16,57,43,.18);color:var(--acc-t)}.cp-tag.bleu{background:var(--blue-bg);color:var(--blue)}
/* réputation */
.cp-rep{display:flex;align-items:center;gap:12px;width:100%;margin-top:10px;padding:12px 14px;border:0;border-radius:20px;background:linear-gradient(120deg,rgba(242,201,76,.22),var(--card) 62%);color:var(--ink);text-align:left;font:inherit;cursor:pointer;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.cp-rep-n{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(242,201,76,.3);color:#6E5000;font:700 18px/1 Jost,sans-serif}
.cp-rep b{display:block;font-size:15px;font-weight:600}.cp-rep small{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:2px;color:var(--mute);font-size:13px;line-height:1.35}
.cp-rep .cp-chev{margin-left:auto}
/* lignes d'annonces et de négociations (page Mon activité) */
.cp-it{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2px 12px;align-items:center}
.cp-it .mk{grid-row:span 2;width:34px;height:34px;display:grid;place-items:center}
.cp-it .mk i{display:inline-grid;place-items:center;flex:none;width:26px;height:26px;border-radius:50%;background:rgba(108,197,140,.22);box-shadow:inset 0 0 0 1px rgba(108,197,140,.55);font:normal 15px/1 "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}.cp-it .mk i::before{content:"";display:block;width:74%;height:74%;background:var(--sym-o) center/contain no-repeat}.cp-it .mk i.d{border-radius:30%;background:rgba(242,194,48,.24);box-shadow:inset 0 0 0 1px rgba(242,194,48,.6)}.cp-it .mk i.d::before{content:"";display:block;width:74%;height:74%;background:var(--sym-d) center/contain no-repeat}
.cp-it .mk svg{border-radius:50%}
.cp-it b{font-weight:500;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-it small{grid-column:2;display:flex;align-items:center;flex-wrap:wrap;gap:6px;color:var(--mute);font-size:12.5px}
.cp-it .p{grid-row:span 2;text-align:right;font:600 15px/1.1 Jost,sans-serif;white-space:nowrap}.cp-it .p em{display:block;margin-top:2px;font:400 11.5px Jost,sans-serif;font-style:normal;color:var(--faint)}

.cp-it .pt{grid-row:span 2;width:8px;height:8px;margin:0 12px;border-radius:50%;background:var(--acc)}.cp-it .pt.lu{background:transparent}
/* interrupteur façon iPhone */
.cp-tog{-webkit-appearance:none;appearance:none;flex:none;position:relative;width:51px;height:31px;margin:0;border-radius:16px;background:rgba(23,21,18,.16);cursor:pointer;transition:background var(--ux-d2,200ms)}
.cp-tog::after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:transform var(--ux-d2,200ms) cubic-bezier(.22,1,.36,1)}
.cp-tog:checked{background:var(--acc)}.cp-tog:checked::after{transform:translateX(20px)}
.cp-tog:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
label.cp-r{cursor:pointer}
/* formulaires */
.cp-f{display:grid;gap:14px}
.cp-fg{display:grid;gap:14px;padding:16px;background:var(--card);border-radius:20px;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.cp-l{display:block;margin:0 0 6px;font-size:13px;font-weight:500;color:var(--mute)}.cp-l i{font-style:normal;font-weight:400;color:var(--faint)}
.cp-in,.cp-sel{width:100%;box-sizing:border-box;height:50px;padding:0 14px;border:1px solid var(--line2);border-radius:13px;background:#fff;color:var(--ink);font:500 16px Jost,sans-serif;transition:border-color var(--ux-d2,200ms),box-shadow var(--ux-d2,200ms)}
.cp-in::placeholder{color:var(--faint)}
.cp-in:focus,.cp-sel:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px rgba(16,57,43,.18)}
.cp-in[aria-invalid=true]{border-color:var(--bad)}
.cp-err{margin:6px 0 0;color:var(--bad);font-size:13px}.cp-err:empty{display:none}
.cp-help{margin:6px 0 0;color:var(--faint);font-size:12.5px;line-height:1.45}
.cp-seg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:3px;padding:3px;border-radius:13px;background:var(--card2)}
.cp-seg button{min-height:42px;padding:0 6px;border:0;border-radius:10px;background:none;color:var(--mute);font:600 13.5px/1.15 Jost,sans-serif;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.cp-seg button[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(23,21,18,.15)}
.avx .cp-seg,.avx-sec .cp-seg{display:flex;flex-wrap:wrap;background:none;padding:0;gap:8px}.avx-sec .cp-seg button{min-height:40px;padding:0 14px;border:1px solid var(--line2);border-radius:999px}.avx-sec .cp-seg button[aria-pressed=true]{background:var(--ink);color:var(--bg);box-shadow:none}
.cp-go{min-height:52px;padding:0 24px;border:0;border-radius:16px;background:var(--acc);color:#F3EFE4;font:700 15.5px Jost,sans-serif;cursor:pointer;transition:filter var(--ux-d2,200ms),opacity var(--ux-d2,200ms)}
.cp-go.plein{width:100%}
.cp-go:active{filter:brightness(.94)}.cp-go[disabled]{opacity:.55;cursor:default}
.cp-alt{min-height:46px;padding:0 18px;border:0;border-radius:14px;background:var(--card2);color:var(--ink);font:600 14.5px Jost,sans-serif;cursor:pointer}
.cp-alt:active{filter:brightness(.96)}
.cp-bad{color:var(--bad)}
.cp-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.cp-msg:empty{display:none}
.cp-ok{display:inline-flex;align-items:center;gap:6px;color:var(--ok);font-size:14px;font-weight:600}
.cp-card{padding:14px;background:var(--card);border-radius:20px;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.cp-card+.cp-card{margin-top:12px}
.cp-kv{display:flex;justify-content:space-between;gap:14px;align-items:center;min-height:48px}
.cp-kv span{color:var(--mute);font-size:14px}.cp-kv b{font-weight:600;text-align:right}
/* notifications du téléphone */
.cp-pousse{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}
.cp-pousse b{display:block;font-size:15px;font-weight:600;line-height:1.3}.cp-pousse small{display:block;margin-top:3px;color:var(--mute);font-size:13px;line-height:1.45}
.cp-pousse .cp-row{grid-column:1 / -1;gap:8px}
.cp-pousse .cp-err{grid-column:1 / -1}
/* avatar (page profil) */
.cp-autre{display:grid;gap:6px;padding:12px;border-radius:14px;background:var(--card2)}.cp-autre[hidden]{display:none}.cp-fg2{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:10px}@media (max-width:380px){.cp-fg2{grid-template-columns:minmax(0,1fr)}}
.cp-avz{display:grid;justify-items:center;gap:12px;margin:4px 0 0}
.cp-avbig{position:relative;width:108px;height:108px;border-radius:50%;box-shadow:0 0 0 4px var(--bg),0 0 0 5.5px var(--line2)}
.cp-avbig svg{display:block;border-radius:50%}
.cp-avz .cp-row{justify-content:center}
/* glisser pour retirer (v3/negoce.js) : sur le papier clair, la ligne reste claire et les séparateurs restent fins */
.cp .sw{border-radius:0}.cp .sw+.sw{margin-top:0}.cp .sw>.sw-row{background-color:var(--card)!important;color:var(--ink)}.cp .sw+.sw::before{content:"";position:absolute;left:60px;right:0;top:0;height:1px;background:var(--line);z-index:2}
@media (max-width:360px){.cp-hero-av{width:92px;height:92px;padding:6px}.cp-hero-av>svg,.cp-hero-av>img{width:80px;height:80px}.cp-hero h2{font-size:23px}.cp-hero-act button{font-size:14px;gap:7px}.cp-st b{font-size:22px}}
@media (prefers-reduced-motion:reduce){.cp-tog,.cp-tog::after,.cp-top-t{transition:none}}
/* avatar (choix) */
.cp-avbig svg{display:block;border-radius:50%}
.cp-avp{display:grid;gap:16px}
.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:10px}
.cp-pick{display:grid;justify-items:center;gap:4px;padding:6px 2px;border:2px solid transparent;border-radius:16px;background:none;color:var(--mute);font:500 11.5px/1.2 Jost,sans-serif;cursor:pointer;transition:border-color var(--ux-d2,200ms),background var(--ux-d2,200ms)}
.cp-pick svg{border-radius:50%}.cp-pick:hover{background:rgba(23,21,18,.05)}.cp-pick[aria-pressed=true]{border-color:var(--acc);color:var(--ink)}
.cp-dots{display:flex;flex-wrap:wrap;gap:10px}
.cp-dot{position:relative;width:34px;height:34px;border:0;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(23,21,18,.14)}
.cp-dot::before{content:"";position:absolute;inset:-5px}
.cp-dot[aria-pressed=true]{box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--acc)}
/* étapes de bienvenue */
.cp-steps{display:flex;gap:6px;margin:0 4px 18px}.cp-steps i{flex:1;height:4px;border-radius:2px;background:rgba(23,21,18,.12);transition:background var(--ux-d3,320ms)}.cp-steps i.on{background:var(--acc)}
@keyframes cpIn{from{opacity:0}}@keyframes cpUp{from{transform:translateY(26px);opacity:0}}@keyframes cpFade{from{opacity:0;transform:translateY(6px)}}
/* avatar : aperçu à gauche (fixe), réglages à droite */
.avx{display:grid;gap:22px}
@media (min-width:640px){.avx{grid-template-columns:200px minmax(0,1fr);gap:34px;align-items:start}}
.avx-pv{display:grid;justify-items:center;gap:10px;padding:22px 12px 18px;border:0;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.05);border-radius:24px;background:var(--card)}
@media (min-width:640px){.avx-pv{position:sticky;top:0}}
.avx-big{width:148px;height:148px;border-radius:50%;box-shadow:0 0 0 6px rgba(23,21,18,.05),0 18px 40px rgba(0,0,0,.35)}
.avx-big svg,.avx-big img,.avx-mini svg,.avx-mini img{display:block;border-radius:50%}
.avx-big>*{animation:avxIn var(--ux-d2,200ms) cubic-bezier(.22,1,.36,1)}
.avx-nom{font:600 18px/1.15 Jost,sans-serif;letter-spacing:-.015em;text-align:center;overflow-wrap:anywhere}
.avx-mini{display:flex;gap:18px;padding-top:10px;border-top:1px solid var(--line);width:100%;justify-content:center}
.avx-mini span{display:grid;justify-items:center;gap:6px;align-content:end}.avx-mini small{color:var(--faint);font-size:11.5px}
.avx-mode{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;margin:0 0 20px;border-radius:999px;background:rgba(23,21,18,.06)}
.avx-mode button{min-height:44px;border:0;border-radius:999px;background:none;color:var(--mute);font:600 14.5px Jost,sans-serif;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.avx-mode button:hover{color:var(--ink)}.avx-mode button[aria-selected=true]{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(23,21,18,.15)}
.avx-p{display:grid;gap:22px;animation:cpFade var(--ux-d2,200ms) ease both}
.avx-sec{display:grid;gap:4px}.avx-h{display:flex;align-items:center;justify-content:space-between;gap:12px}
.avx-dice{min-height:36px;padding:0 14px;border:1px solid rgba(23,21,18,.2);border-radius:999px;background:none;color:var(--ink);font:500 13px Jost,sans-serif;cursor:pointer}.avx-dice:hover{background:rgba(23,21,18,.06)}
.avx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
.avx-pick{display:grid;justify-items:center;gap:6px;min-height:44px;padding:8px 2px;border:0;border-radius:16px;background:none;color:var(--mute);font:500 12px/1.2 Jost,sans-serif;text-align:center;cursor:pointer;transition:background var(--ux-d2,200ms),color var(--ux-d2,200ms)}
.avx-pick svg{border-radius:50%;transition:box-shadow var(--ux-d2,200ms),transform var(--ux-d2,200ms) cubic-bezier(.22,1,.36,1)}
.avx-pick:hover{background:rgba(23,21,18,.05);color:var(--ink)}.avx-pick:hover svg{transform:translateY(-2px)}
.avx-pick[aria-pressed=true]{color:var(--ink)}.avx-pick[aria-pressed=true] svg{box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--ink)}
.avx-p .cp-dot[aria-pressed=true]{box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--ink)}
.avx-txt{margin:0 0 12px;color:var(--mute);font-size:14.5px}
.avx-drop{display:grid;justify-items:center;gap:6px;padding:40px 18px;border:1.5px dashed rgba(23,21,18,.24);border-radius:24px;text-align:center;cursor:pointer;transition:border-color var(--ux-d2,200ms),background var(--ux-d2,200ms)}
.avx-drop:hover,.avx-drop.is-over{border-color:var(--ink);background:rgba(23,21,18,.04)}
.avx-drop b{font:600 18px/1.2 Jost,sans-serif;letter-spacing:-.015em}.avx-drop span{color:var(--mute);font-size:13.5px}
.avx-drop:focus-within,.avx-file:focus-within{outline:2px solid var(--acc);outline-offset:2px}.avx-drop,.avx-file{position:relative}.avx-in{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.avx-stage{position:relative;width:240px;height:240px;margin:0 auto 6px;border-radius:24px;overflow:hidden;cursor:grab;touch-action:none;background:#14120f}
.avx-stage.is-drag{cursor:grabbing}.avx-stage canvas{display:block;width:100%;height:100%}
.avx-stage i{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,transparent 119px,rgba(10,9,7,.62) 120px);box-shadow:inset 0 0 0 1px rgba(23,21,18,.12)}
.avx-stage i::after{content:"";position:absolute;left:0;top:0;width:240px;height:240px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.7)}
.avx-stage:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.avx-zoom{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center;max-width:320px;margin:4px auto 0;width:100%}.avx-zoom .cp-l{margin:0}
.avx-zoom input{width:100%;accent-color:var(--ink);min-height:44px}
.avx-crop .cp-help{text-align:center}.avx-crop .cp-row{justify-content:center}
.avx-file{display:inline-flex;align-items:center}
.avx-act{position:sticky;z-index:4;bottom:calc(-36px - env(safe-area-inset-bottom));margin:22px -16px calc(-36px - env(safe-area-inset-bottom));padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:var(--bg);box-shadow:0 -12px 24px -14px rgba(23,21,18,.35)}
.avx-act .cp-go{flex:1}
.avx-rang{display:flex;gap:4px;overflow-x:auto;margin:0 -16px;padding:2px 16px 6px;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch}.avx-rang::-webkit-scrollbar{display:none}
.avx-rang .avx-pick{flex:0 0 76px;scroll-snap-align:start}.avx-rang .avx-pick span{display:block;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avx-zv{display:block;width:58px;height:58px;border-radius:50%;overflow:hidden;transition:box-shadow var(--ux-d2,200ms)}.avx-zv svg{display:block;transform:scale(2.1);transform-origin:var(--ox) var(--oy)}.avx-pick .avx-zv svg{box-shadow:none!important}.avx-pick[aria-pressed=true] .avx-zv{box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--ink)}
.avx-pv{position:relative}
.avx-de{display:none;justify-items:center;gap:2px;padding:0;border:0;background:none;color:var(--mute);font:600 12px/1.2 Jost,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}.avx-pv.avec-de .avx-de{display:grid}
.avx-de3d{display:block;width:58px;height:58px;filter:drop-shadow(0 6px 8px rgba(23,21,18,.18));transition:transform .15s}.avx-de3d svg{display:block}
.avx-de:active .avx-de3d{transform:scale(.9)}.avx-de:focus-visible{outline:2px solid #F2C230;outline-offset:4px;border-radius:14px}
.avx-de.roule .avx-de3d{animation:avxRoule .8s cubic-bezier(.3,1.3,.5,1)}
@keyframes avxRoule{0%{transform:rotate(0)}35%{transform:translateY(-16px) rotate(220deg) scale(1.1)}65%{transform:translateY(0) rotate(380deg) scale(.94)}100%{transform:rotate(360deg)}}
.avx-pop{position:absolute;z-index:5;left:50%;top:-10px;padding:7px 14px;border-radius:999px;background:#10392B;color:#F2C230;font:700 13.5px/1 Jost,sans-serif;white-space:nowrap;box-shadow:0 8px 20px rgba(16,57,43,.3);opacity:0;transform:translate(-50%,6px) scale(.85);pointer-events:none}
.avx-pop.on{animation:avxPop 1.7s cubic-bezier(.22,1,.36,1) both}
@keyframes avxPop{0%{opacity:0;transform:translate(-50%,6px) scale(.85)}14%{opacity:1;transform:translate(-50%,0) scale(1.04)}22%{transform:translate(-50%,0) scale(1)}80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-8px)}}
@media (prefers-reduced-motion:reduce){.avx-de.roule .avx-de3d,.avx-pop.on{animation:none}.avx-pop.on{opacity:1;transform:translate(-50%,0)}}
@media (max-width:639px){.avx-pv{position:sticky;top:-1px;z-index:3;grid-template-columns:auto minmax(0,1fr);justify-items:start;align-items:center;column-gap:16px;row-gap:6px;padding:12px 16px}.avx-big{grid-row:span 2;width:108px;height:108px}.avx-big svg,.avx-big img{width:100%;height:100%}.avx-nom{align-self:end;text-align:left}.avx-mini{align-self:start;justify-content:flex-start;border-top:0;padding-top:0}.avx-pv.avec-de{grid-template-columns:auto minmax(0,1fr) auto}.avx-de{grid-column:3;grid-row:1 / span 2;align-self:center}.avx-pop{top:4px;left:70px}}
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
    bg.innerHTML = `<div class="cp" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="cp-x" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button>${tete}${html}</div>`;
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
  // grande tuile colorée : un état (notifications du téléphone) ; dans les listes de réglages, une icône sobre
  const ti = (n, ton, lg) => lg ? `<span class="cp-ti lg" data-ton="${ton}" aria-hidden="true">${IC(n, 24)}</span>` : `<span class="cp-ico" aria-hidden="true">${IC(n, 22)}</span>`;
  const CHEV = '<svg class="cp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  // une ligne : icône, titre (+ précision), valeur à droite, chevron
  const ligne = o => `<${o.href ? `a href="${o.href}"` : o.cls === 'info' ? 'div' : 'button type="button"'} class="cp-r${o.cls ? ' ' + o.cls : ''}" ${o.attrs || ''}>${o.ico || ''}<span class="cp-r-t"><b>${o.t}</b>${o.s ? `<small>${o.s}</small>` : ''}</span>${o.v != null && o.v !== '' ? `<span class="cp-r-v${o.vf ? ' fort' : ''}">${o.v}</span>` : ''}${o.n ? `<span class="cp-n" aria-label="${o.n} nouveau${o.n > 1 ? 'x' : ''}">${o.n}</span>` : ''}${o.chev === false ? '' : CHEV}</${o.href ? 'a' : o.cls === 'info' ? 'div' : 'button'}>`;
  const TITRES = { accueil: 'Mon compte', profil: 'Profil et avatar', activite: 'Mon activité', notifs: 'Notifications', prefs: 'Réglages', securite: 'Sécurité et compte' };
  const negosDe = () => { const u = me(), L = J('mdg-negoce:liste', []), vive = n => n.statut === 'ouverte' && n.dernier_par && n.expire_le && Date.parse(n.expire_le) > Date.now();
    return { vive, L, env: L.filter(n => vive(n) && n.dernier_par === u.id), rec: L.filter(n => vive(n) && n.dernier_par !== u.id), ok: L.filter(n => n.statut === 'conclue'), fin: L.filter(n => n.statut !== 'conclue' && !vive(n)) }; };
  const mesAnn = k => J('mdg-v2:' + k, []).filter(x => x && x.productSlug);

  function ouvrir(onglet) {
    if (!N()) return; const u = me(); if (!u) return N().open();
    let page = TITRES[onglet] ? onglet : 'accueil';
    cadre(`<header class="cp-top"><span></span><span class="cp-top-t"></span><span></span></header><div class="cp-main"></div>`, 'Mon compte');
    const main = bg.querySelector('.cp-main'), top = bg.querySelector('.cp-top');
    // calme : le contenu se pose sans fondu (à l'ouverture et quand les données arrivent) ; le fondu ne sert qu'en passant d'une page à l'autre
    const aller = (p, calme) => {
      page = p;
      top.innerHTML = (p === 'accueil' ? '<span></span>' : `<button type="button" class="cp-back" data-retour aria-label="Retour à Mon compte">${IC('retour', 22) || '‹'}</button>`) + `<span class="cp-top-t" aria-hidden="true">${TITRES[p]}</span><span></span>`;
      top.classList.remove('titre'); bg.querySelector('.cp').classList.toggle('sur-hero', p === 'accueil'); bg.querySelector('.cp').classList.remove('defile');
      const r = top.querySelector('[data-retour]'); if (r) r.onclick = () => aller('accueil');
      VUES[p](main); main.scrollTop = 0;
      if (calme) main.querySelectorAll('.cp-pg').forEach(x => { x.style.animation = 'none'; });
      const h = main.querySelector('h2'); if (h) h.setAttribute('tabindex', '-1');
    };
    // le titre de la page apparaît dans la barre quand le grand titre est passé
    main.addEventListener('scroll', () => { if (!bg) return;   // la fenêtre vient d'être fermée : plus rien à mettre à jour
      const h = page === 'accueil'; top.classList.toggle('titre', main.scrollTop > (h ? 260 : 48)); bg.querySelector('.cp').classList.toggle('defile', h && main.scrollTop > 200); }, { passive: true });
    bg.aller = aller;
    aller(page, true);
    bg.rafraichir = () => { const y = main.scrollTop; aller(page, true); main.scrollTop = y; };
    // mise à jour venue du réseau : jamais pendant qu'on écrit, ni si un champ a été modifié (sinon la saisie serait perdue, 24/10/2026)
    bg.rafraichirAuto = () => { if (!bg || !main.isConnected) return; const a = document.activeElement;
      if (a && main.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if ([...main.querySelectorAll('input, textarea')].some(x => (x.type === 'checkbox' || x.type === 'radio') ? x.checked !== x.defaultChecked : x.value !== x.defaultValue)) return;
      bg.rafraichir(); };
    if (navigator.onLine) charger().then(() => bg && bg.rafraichirAuto && bg.rafraichirAuto());
    const adm0 = J('mdg-nuage:admin', false); if (N().isAdmin) N().isAdmin().then(a => { if (a !== adm0 && bg && bg.rafraichirAuto) bg.rafraichirAuto(); if (a) compterIdent(); });
    // l'administrateur : dossiers d'identité à examiner (supabase/schema-19), gardés 60 s (même cache que le menu de l'application)
    function compterIdent() {
      const c = J('mdg-admin:identites', {}); if (!navigator.onLine || Date.now() - (c.t || 0) < 60e3) return;
      try { localStorage.setItem('mdg-admin:identites', JSON.stringify({ n: c.n || 0, t: Date.now() })); } catch (_) {}
      N().rpc('admin_identite_compte').then(n => { n = +n || 0; try { localStorage.setItem('mdg-admin:identites', JSON.stringify({ n, t: Date.now() })); } catch (_) {} if (n !== (c.n || 0) && bg && bg.rafraichirAuto && page === 'accueil') bg.rafraichirAuto(); }).catch(() => {});
    }
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
  /* région et ville reliées (app/villes.js) : choisir une région montre ses villes ; choisir une ville remplit sa région.
     Une localité absente de la liste : « Autre localité », avec son nom et la ville principale la plus proche, dans la même région.
     On enregistre alors « Nom (près de Ville) » : la localité reste rattachée à une ville connue, donc à la carte et aux distances. */
  const VL = () => window.MDGVilles;
  const PRES = /^(.*?)\s*\(près de ([^)]+)\)\s*$/;
  const lieu = p => `<div><label class="cp-l" for="cp-reg">Région où vous êtes d’habitude <i>· facultatif</i></label><select class="cp-sel" id="cp-reg"><option value="">—</option>${REGIONS().map(([s, n]) => `<option value="${s}" ${p.region_slug === s ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><p class="cp-help" id="cp-reg-a" aria-live="polite"></p></div>
    <div><label class="cp-l" for="cp-vsel">Ville ou localité <i>· facultatif</i></label><select class="cp-sel" id="cp-vsel"></select></div>
    <div class="cp-autre" hidden><div class="cp-fg2"><div><label class="cp-l" for="cp-ville">Nom de votre localité</label><input class="cp-in" id="cp-ville" maxlength="48" autocomplete="address-level2" placeholder="ex. un village, un campement"></div>
      <div><label class="cp-l" for="cp-pres">Près de quelle ville ?</label><select class="cp-sel" id="cp-pres"></select></div></div>
      <p class="cp-help">Elle reste rattachée à cette ville de la région : on vous montre d’abord ce qui est proche. Vos annonces gardent chacune leur lieu.</p></div>`;
  function lierLieu(root, p) {
    const V = VL(), rs = root.querySelector('#cp-reg'), vs = root.querySelector('#cp-vsel'), box = root.querySelector('.cp-autre'), inp = root.querySelector('#cp-ville'), pres = root.querySelector('#cp-pres'), aide = root.querySelector('#cp-reg-a');
    const nomR = s => (REGIONS().find(r => r[0] === s) || [])[1] || '';
    const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
    // ce qui est enregistré : une ville de la liste, ou « Localité (près de Ville) »
    const v0 = (p && p.ville) || '', m0 = PRES.exec(v0);
    let ville = m0 ? '' : v0, autre = m0 ? m0[1] : '', proche = m0 ? m0[2] : '', enAutre = !!m0;
    if (!V) { vs.innerHTML = opt('__autre', 'Écrire ma localité', true); box.hidden = false; inp.value = v0; pres.closest('div').hidden = true; return; }
    if (ville && !V.region(ville)) { autre = ville; ville = ''; enAutre = true; }
    if (ville) ville = V.propre(ville);   // « Cocody » enregistré avant : une commune d'Abidjan, donc « Abidjan »
    function villes() {
      const r = rs.value, L = r ? V.de(r) : V.toutes().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const choisi = enAutre ? '__autre' : ville;
      vs.innerHTML = opt('', r ? 'Choisissez (chef-lieu : ' + (V.de(r)[0] || '') + ')' : 'Choisissez d’abord la région, ou une ville', !choisi)
        + (r ? L.map(n => opt(n, n, n === choisi)).join('') : L.map(c => opt(c.nom, c.nom + ' · ' + nomR(c.region), c.nom === choisi)).join(''))
        + opt('__autre', 'Autre localité (village, campement…)', choisi === '__autre');
      box.hidden = vs.value !== '__autre';
      if (!box.hidden) { const R = r || V.region(proche); pres.innerHTML = (R ? V.de(R) : []).map(n => opt(n, n, n === (proche || V.de(R)[0]))).join('') || opt('', 'Choisissez d’abord la région', true); pres.disabled = !R; inp.value = autre; }
    }
    rs.onchange = () => { if (ville && V.region(ville) !== rs.value) ville = ''; if (proche && V.region(proche) !== rs.value) proche = ''; aide.textContent = ''; villes(); };
    vs.onchange = () => {
      const v = vs.value;
      if (v === '__autre') { enAutre = true; ville = ''; villes(); setTimeout(() => inp.focus(), 30); return; }
      enAutre = false; autre = ''; ville = v; const r = V.region(v);
      if (r && r !== rs.value) { rs.value = r; aide.textContent = 'Région remplie d’après la ville : ' + nomR(r) + '.'; }
      villes();
    };
    inp.oninput = () => { autre = inp.value; };
    // une localité tapée qui est en fait une ville connue : on la reconnaît et on remplit sa région
    inp.onblur = () => { const r = V.region(inp.value); if (r) { ville = V.propre(inp.value); autre = ''; enAutre = false; if (r !== rs.value) { rs.value = r; aide.textContent = 'Région remplie d’après la ville : ' + nomR(r) + '.'; } villes(); } };
    pres.onchange = () => { proche = pres.value; };
    villes();
  }
  const lieuVal = root => {
    const V = VL(), r = root.querySelector('#cp-reg').value || null, vs = root.querySelector('#cp-vsel').value;
    if (vs && vs !== '__autre') return { region_slug: r || (V && V.region(vs)) || null, ville: vs };
    const nom = root.querySelector('#cp-ville').value.trim(), pr = root.querySelector('#cp-pres');
    if (!nom) return { region_slug: r, ville: null };
    const pres = pr && !pr.disabled && pr.value;
    return { region_slug: r || (V && pres && V.region(pres)) || null, ville: pres ? nom + ' (près de ' + pres + ')' : nom };
  };
  const roleSeg = p => `<div><span class="cp-l" id="cp-role-l">Vous êtes plutôt</span><div class="cp-seg" role="group" aria-labelledby="cp-role-l">${[['acheteur', 'J’achète'], ['vendeur', 'Je vends'], ['les_deux', 'Les deux']].map(([k, t]) => `<button type="button" data-role="${k}" aria-pressed="${p.role === k}">${t}</button>`).join('')}</div></div>`;
  const lierRole = root => root.querySelectorAll('[data-role]').forEach(b => b.onclick = () => root.querySelectorAll('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x === b && x.getAttribute('aria-pressed') !== 'true'))));
  const roleVal = root => { const b = root.querySelector('[data-role][aria-pressed=true]'); return b ? b.dataset.role : null; };
  const ROLE_TXT = { acheteur: 'Acheteur', vendeur: 'Vendeur', les_deux: 'Acheteur et vendeur' };

  /* ——— la structure que le membre représente (supabase/schema-23) : coopérative, groupement, entreprise ———
     Elle rassure : le profil public la montre en tête (logo, nom, preuves), les annonces et les messages portent « Coopérative · Nom ». */
  const STRUCT = { particulier: ['À mon compte', 'Je vends ou j’achète pour moi'], cooperative: ['Coopérative', 'Des producteurs regroupés'], groupement: ['Groupement', 'Association, GIE, groupe de femmes…'], entreprise: ['Entreprise', 'Industrie, négoce, transformation'], marche: ['Marché', 'Un marché et ses commerçants'] };
  const STRUCT_ICO = { particulier: 'compte', cooperative: 'confiance', groupement: 'service', entreprise: 'tableau', marche: 'vendre' };
  const imgStruct = c => c ? (/^(https?:|data:|blob:)/.test(c) ? c : N().URL + '/storage/v1/object/public/activites/' + c) : '';
  const reduireImg = (file, cote = 1000) => new Promise((ok, ko) => { const u = URL.createObjectURL(file), im = new Image(); im.onerror = () => { URL.revokeObjectURL(u); ko(new Error('Image illisible. Essayez une autre photo.')); };
    im.onload = () => { URL.revokeObjectURL(u); const k = Math.min(1, cote / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : ko(new Error('Image illisible.')), 'image/jpeg', .8); }; im.src = u; });
  // le formulaire : 4 choix ; pour une structure, son nom, son logo et jusqu'à 4 preuves (facultatifs). Renvoie { val, verifier }.
  function formStructure(root, p) {
    let type = p.structure_type || '', logo = p.structure_logo || null, preuves = (p.structure_preuves || []).slice(0, 4), nom = p.structure_nom || '';
    const envoyer = async (fichier, quoi) => { const u = me(); const blob = await reduireImg(fichier, quoi === 'logo' ? 600 : 1200), chemin = u.id + '/' + quoi + '-' + Date.now() + '.jpg'; await N().televerser('activites/' + chemin, blob); return chemin; };
    // les choix sont dessinés une fois ; toucher un choix change la sélection SUR PLACE (rien ne se redessine au-dessus,
    // le clavier ne s'ouvre pas tout seul) : la page ne monte ni ne descend
    const libNom = () => type === 'marche' ? 'Nom du marché' : 'Nom de la ' + (type === 'entreprise' ? 'société' : STRUCT[type][0].toLowerCase());
    const exNom = () => type === 'cooperative' ? 'ex. Coopérative Akwaba de Bouaké' : type === 'groupement' ? 'ex. Groupement des femmes de Daloa' : type === 'marche' ? 'ex. Marché de gros de Bouaké' : 'ex. Ivoire Agro Négoce';
    root.innerHTML = `<div class="cp-sto" role="radiogroup" aria-label="Vous représentez">${Object.keys(STRUCT).map(k => `<button type="button" role="radio" aria-checked="${type === k}" data-st="${k}"><span class="i" aria-hidden="true">${IC(STRUCT_ICO[k], 20)}</span><b>${STRUCT[k][0]}</b><small>${STRUCT[k][1]}</small></button>`).join('')}</div><div data-std></div>`;
    const zone = root.querySelector('[data-std]'), garderNom = () => { const n = root.querySelector('#cp-stnom'); if (n) nom = n.value; };
    root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
      garderNom(); const avant = !!(type && type !== 'particulier'); type = b.dataset.st; const apres = type !== 'particulier';
      root.querySelectorAll('[data-st]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      if (avant !== apres) dessiner();
      else if (apres) { const l = zone.querySelector('label[for=cp-stnom]'), n = zone.querySelector('#cp-stnom'); if (l) l.textContent = libNom(); if (n) n.placeholder = exNom(); }
    });
    function dessiner() {
      const st = type && type !== 'particulier';
      zone.innerHTML = `${st ? `<div class="cp-st-d">
          <div><label class="cp-l" for="cp-stnom">${libNom()}</label><input class="cp-in" id="cp-stnom" maxlength="80" autocomplete="organization" value="${esc(nom)}" placeholder="${exNom()}"><p class="cp-err" id="cp-stnom-e" role="alert"></p></div>
          <div class="cp-st-up"><span class="cp-l">Logo <i>· facultatif</i></span><div class="cp-st-row">
            <label class="cp-st-logo${logo ? ' plein' : ''}">${logo ? `<img src="${esc(imgStruct(logo))}" alt="Logo">` : `${IC('photo', 22)}<span>Ajouter</span>`}<input type="file" accept="image/*" data-logo aria-label="${logo ? 'Changer le logo' : 'Ajouter le logo'}"></label>
            ${logo ? '<button type="button" class="cp-alt" data-logo-x>Retirer le logo</button>' : ''}</div></div>
          <div class="cp-st-up"><span class="cp-l">Preuves que la structure existe <i>· facultatif, 4 au plus</i></span>
            <div class="cp-st-pv">${preuves.map((c, i) => `<div><img src="${esc(imgStruct(c))}" alt="Preuve ${i + 1}"><button type="button" class="cp-st-x" data-pv-x="${i}" aria-label="Retirer la preuve ${i + 1}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`).join('')}${preuves.length < 4 ? `<label class="cp-st-add">${IC('photo', 20)}<span>Ajouter</span><input type="file" accept="image/*" data-pv aria-label="Ajouter une preuve"></label>` : ''}</div>
            <p class="cp-st-aide">Une enseigne, un entrepôt, un agrément, une parcelle : ce qui montre que votre structure existe vraiment. Les membres les voient sur votre profil.</p></div>
          <p class="cp-msg" data-st-msg role="status"></p></div>` : ''}`;
      const n = root.querySelector('#cp-stnom'); if (n) n.oninput = () => { nom = n.value; };
      const msg = t => { const m = root.querySelector('[data-st-msg]'); if (m) m.textContent = t || ''; };
      const charge = async (inp, quoi) => { const f = inp.files && inp.files[0]; if (!f) return; if (!navigator.onLine) return msg('Pas de connexion internet : réessayez quand le réseau revient.');
        msg('Envoi de l’image…'); try { const c = await envoyer(f, quoi); const nn = root.querySelector('#cp-stnom'); if (nn) nom = nn.value; if (quoi === 'logo') logo = c; else preuves.push(c); msg(''); dessiner(); }
        catch (x) { msg(/Bucket not found|not found|403|row-level/i.test(String(x.message)) ? 'Les images ne sont pas encore activées sur le serveur.' : 'Envoi impossible. ' + ERR(x)); } };
      const il = root.querySelector('[data-logo]'); if (il) il.onchange = () => charge(il, 'logo');
      const ip = root.querySelector('[data-pv]'); if (ip) ip.onchange = () => charge(ip, 'preuve');
      const lx = root.querySelector('[data-logo-x]'); if (lx) lx.onclick = () => { const nn = root.querySelector('#cp-stnom'); if (nn) nom = nn.value; logo = null; dessiner(); };
      root.querySelectorAll('[data-pv-x]').forEach(b => b.onclick = () => { const nn = root.querySelector('#cp-stnom'); if (nn) nom = nn.value; preuves.splice(+b.dataset.pvX, 1); dessiner(); });
    }
    dessiner();
    const val = () => { const n = root.querySelector('#cp-stnom'); if (n) nom = n.value; const st = type && type !== 'particulier';
      return { structure_type: type || null, structure_nom: st ? nom.trim() || null : null, structure_logo: st ? logo : null, structure_preuves: st ? preuves : [] }; };
    // le nom est obligatoire pour une structure ; pas de lien (schéma 22)
    const verifier = () => { const v = val(), e = root.querySelector('#cp-stnom-e'), n = root.querySelector('#cp-stnom'); if (!n) return true;
      const t = v.structure_nom || '', r = t.length < 2 ? 'Écrivez le nom de votre structure.' : (N().texteRefus ? N().texteRefus(t) : '');
      if (e) e.textContent = r; n.setAttribute('aria-invalid', String(!!r)); if (r) n.focus(); return !r; };
    return { val, verifier };
  }

  /* ——— Badge « Coopérative / Marché vérifié » (schéma 39) : un document officiel + l'identité vérifiée du responsable, examinés par l'équipe ——— */
  const BADGE_TYPES = { cooperative: 'Coopérative', marche: 'Marché' };
  async function badgeStructure(el) {
    if (!el || !N() || !me()) return;
    let d; try { d = await N().rpc('structure_dossier_moi'); } catch (_) { el.innerHTML = ''; return; }
    if (!el.isConnected || !d) return;
    const lib = BADGE_TYPES[d.type], dern = d.dernier, date = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    if (!lib || !d.nom) { el.innerHTML = d.type && d.type !== 'particulier' ? '<p class="cp-st-aide" style="margin:10px 16px 0">Le badge vérifié existe pour les coopératives et les marchés.</p>' : ''; return; }
    const boite = (corps, cls) => `<h3 class="cp-lab">Badge ${lib.toLowerCase()} vérifié</h3><div class="cp-bdg ${cls || ''}">${corps}</div>`;
    if (d.verifiee) { el.innerHTML = boite(`<p><b>${IC('verifie', 18)} ${lib} ${d.type === 'marche' ? 'vérifié' : 'vérifiée'}</b>« ${esc(d.nom)} » porte le badge sur votre profil et vos annonces. Si vous changez le nom ou le type de la structure, il faudra la faire vérifier à nouveau.</p>`, 'ok'); return; }
    if (dern && dern.statut === 'en_attente') {
      el.innerHTML = boite(`<p><b>Dossier en cours d’examen</b>Envoyé le ${date(dern.envoye_le)} pour « ${esc(dern.nom)} ». L’équipe vérifie le document et votre identité ; vous verrez la réponse ici.</p><button type="button" class="cp-alt" data-bx>Retirer le dossier</button>`, 'att');
      el.querySelector('[data-bx]').onclick = async () => { if (!confirm('Retirer votre dossier ? Vous pourrez en envoyer un nouveau.')) return; try { await N().rpc('structure_dossier_retirer'); badgeStructure(el); } catch (x) { N().toast(x.message); } };
      return;
    }
    const refus = dern && dern.statut === 'refusee' ? `<p class="cp-bdg-r"><b>Dossier précédent refusé</b>${esc(dern.motif || '')}</p>` : '';
    if (!d.identite) {
      el.innerHTML = boite(`${refus}<p><b>D’abord, votre identité</b>Le badge confirme qu’un responsable connu se porte garant de « ${esc(d.nom)} ». Faites vérifier votre identité (pièce et selfie), puis revenez ici.</p>${window.MDGIdentite ? '<button type="button" class="cp-go plein" data-bi>Vérifier mon identité</button>' : ''}`);
      const bi = el.querySelector('[data-bi]'); if (bi) bi.onclick = () => window.MDGIdentite.ouvrir();
      return;
    }
    const docs = [];   // { chemin, apercu } : stockage privé, seul l'administrateur peut les ouvrir
    const peindre = (msg) => {
      el.innerHTML = boite(`${refus}<p><b>Faire vérifier « ${esc(d.nom)} »</b>Envoyez la photo d’un document officiel : ${d.type === 'cooperative' ? 'agrément de la coopérative (OHADA), récépissé ou extrait du registre' : 'autorisation de la mairie, carte de délégué ou de gestionnaire du marché, registre du commerce'}. Seule l’équipe le verra.</p>
        <form class="cp-bdg-f" novalidate>
          <div><label class="cp-l" for="cp-fn">Votre fonction</label><input class="cp-in" id="cp-fn" list="cp-fns" maxlength="60" autocomplete="organization-title" placeholder="ex. ${d.type === 'cooperative' ? 'Président' : 'Délégué du marché'}"><datalist id="cp-fns">${(d.type === 'cooperative' ? ['Président', 'Présidente', 'Secrétaire général', 'Trésorier', 'Gérant'] : ['Délégué du marché', 'Présidente des commerçantes', 'Gestionnaire du marché', 'Chef de marché']).map(x => `<option value="${x}">`).join('')}</datalist></div>
          <div><span class="cp-l">Document officiel <i>· 1 à 3 photos</i></span><div class="cp-st-pv">${docs.map((x, i) => `<div><img src="${x.apercu}" alt="Page ${i + 1}"><button type="button" class="cp-st-x" data-dx="${i}" aria-label="Retirer la page ${i + 1}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`).join('')}${docs.length < 3 ? `<label class="cp-st-add">${IC('photo', 20)}<span>Ajouter</span><input type="file" accept="image/*" data-dd aria-label="Ajouter une photo du document"></label>` : ''}</div></div>
          <button type="submit" class="cp-go plein">Envoyer pour vérification</button><p class="cp-msg" role="status" data-bm>${esc(msg || '')}</p></form>`);
      const f = el.querySelector('form'), fn = el.querySelector('#cp-fn'), m = t => { el.querySelector('[data-bm]').textContent = t || ''; };
      fn.value = el.dataset.fn || ''; fn.oninput = () => { el.dataset.fn = fn.value; };
      el.querySelectorAll('[data-dx]').forEach(b => b.onclick = () => { docs.splice(+b.dataset.dx, 1); peindre(); });
      const dd = el.querySelector('[data-dd]'); if (dd) dd.onchange = async () => { const fi = dd.files && dd.files[0]; if (!fi) return; if (!navigator.onLine) return m('Pas de connexion internet.');
        m('Envoi de la photo…'); try { const blob = await reduireImg(fi, 1200), chemin = me().id + '/structure-' + Date.now() + '-' + docs.length + '.jpg';
          await N().deposerPrive('preuves', chemin, blob); docs.push({ chemin, apercu: URL.createObjectURL(blob) }); peindre(); }
        catch (x) { m('Envoi impossible : ' + x.message); } };
      f.onsubmit = async e => { e.preventDefault(); const fv = fn.value.trim();
        if (fv.length < 2) { m('Indiquez votre fonction.'); fn.focus(); return; }
        if (!docs.length) { m('Ajoutez au moins une photo du document.'); return; }
        const go = f.querySelector('.cp-go'); go.disabled = true; go.setAttribute('aria-busy', 'true');
        try { await N().rpc('structure_dossier_envoyer', { p_fonction: fv, p_documents: docs.map(x => x.chemin) }); N().toast('Dossier envoyé.', { sous: 'L’équipe l’examine ; la réponse apparaîtra dans votre profil.' }); badgeStructure(el); }
        catch (x) { go.disabled = false; go.removeAttribute('aria-busy'); m(ERR(x)); } };
    };
    peindre();
  }

  /* ——— Notifications sur ce téléphone (v3/pousse.js) : l'état réel et l'action qui convient ——— */
  const POUSSE_COURT = { actif: 'Activées', inactif: 'Désactivées', refuse: 'Bloquées', installer: 'À installer', impossible: 'Indisponibles' };
  async function cartePousse(el) {
    const P = window.MDGPousse; if (!el) return;
    const st = P ? await P.etat() : 'impossible';
    const T = {
      actif: ['Activées sur ce téléphone', 'Une réponse à votre prix, un accord, un refus : ce téléphone les affiche même application fermée, dès qu’il a du réseau.', '<button type="button" class="cp-alt" data-pd>Désactiver</button>', 'offre'],
      inactif: ['Être prévenu même application fermée', 'Dès qu’on répond à votre prix, votre téléphone vous le dit, avec le nombre de réponses sur l’icône.', '<button type="button" class="cp-go plein" data-pa>Activer les notifications</button>', 'demande'],
      refuse: ['Bloquées sur ce téléphone', 'Réglages du téléphone → Notifications → Marché de Gros → Autoriser, puis revenez ici.', '', 'bad'],
      installer: ['Sur iPhone : ajoutez d’abord l’application', 'Touchez Partager, puis « Sur l’écran d’accueil ». Ouvrez-la depuis l’icône et activez ici.', '', 'demande'],
      impossible: ['Indisponibles dans ce navigateur', 'Ouvrez le Marché de Gros dans l’application installée, ou dans Chrome, Safari ou Edge à jour.', '', 'aide']
    }[st];
    el.innerHTML = `<div class="cp-card cp-pousse">${ti('cloche', T[3], true)}<span><b>${T[0]}</b><small>${T[1]}</small></span>${T[2] ? `<div class="cp-row">${T[2]}</div>` : ''}<p class="cp-err" role="status"></p></div>`;
    const msg = el.querySelector('.cp-err'), b = q => el.querySelector(q);
    if (b('[data-pa]')) b('[data-pa]').onclick = async e => { const t = e.currentTarget; t.disabled = true; t.textContent = 'Activation…'; t.setAttribute('aria-busy', 'true');
      try { const r = await P.activer(); N().toast(r && r.envoyees > 0 ? 'Notifications activées. Un essai vient de partir vers ce téléphone.' : 'Notifications activées, mais l’essai n’est pas parti. Réessayez plus tard.'); cartePousse(el); }
      catch (x) { t.disabled = false; t.removeAttribute('aria-busy'); t.textContent = 'Activer les notifications'; const m = String(x.message); msg.textContent = m === 'REFUS' ? 'Vous avez refusé. Autorisez-les dans les réglages du téléphone, puis réessayez.' : m === 'SANS_REPONSE' ? 'Pas de réponse à la demande. Réessayez et touchez « Autoriser ».' : m === 'INSTALLER' ? 'Ajoutez d’abord l’application à l’écran d’accueil.' : 'L’activation n’a pas abouti. Vérifiez la connexion, puis réessayez.'; } };
    if (b('[data-pe]')) b('[data-pe]').onclick = async () => { msg.textContent = 'Envoi…'; const r = await P.essai(); msg.textContent = r && r.envoyees ? 'Essai parti vers ' + r.envoyees + (r.envoyees > 1 ? ' téléphones.' : ' téléphone.') : 'L’essai n’est pas parti. Désactivez puis réactivez les notifications.'; };
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
      const M = window.MDGMessages, G = window.MDGNegoce, dmN = M && M.unread ? M.unread() : 0, nl = nonLues(), S = window.MDGSons, sn = S ? S.reglages() : null;
      const reg = (REGIONS().find(r => r[0] === p.region_slug) || [])[1], lieuTxt = p.ville || reg || '', adm = J('mdg-nuage:admin', false);
      const mono = n => `<span class="cp-ico" aria-hidden="true">${IC(n, 22)}</span>`;
      const ID = window.MDGIdentite, idC = ID && ID.statutCache(), idS = idC ? idC.statut : 'non_verifie';
      // l'administrateur parle au nom du Marché de Gros (supabase/schema-20) : pas de vérification, pas de nom, pas de numéro visible
      const off0 = !!((idC && (idC.officiel || idC.exempt)) || adm);
      if (ID && navigator.onLine) ID.statut().then(s => { if (s && JSON.stringify(s) !== JSON.stringify(idC) && bg && bg.rafraichirAuto && main.isConnected) bg.rafraichirAuto(); }).catch(() => {});
      // fiabilité (schéma 84) : relue en fond ; la ligne se met à jour seulement si quelque chose a changé
      if (window.MDGRep && MDGRep.lireFiabilite && !off0 && navigator.onLine) { const fv = JSON.stringify(MDGRep.fiabResume());
        MDGRep.lireFiabilite().then(f => { if (f && JSON.stringify(f) !== fv && bg && bg.rafraichirAuto && main.isConnected) bg.rafraichirAuto(); }).catch(() => {}); }
      if (window.MDGRep && MDGRep.lireNiveaux && !off0 && navigator.onLine) { const nvv = JSON.stringify(MDGRep.nivResume());
        MDGRep.lireNiveaux().then(f => { if (f && JSON.stringify(f) !== nvv && bg && bg.rafraichirAuto && main.isConnected) bg.rafraichirAuto(); }).catch(() => {}); }
      // la vérification d'identité, bien en vue tant qu'elle n'est pas faite : 3 annonces gratuites, puis elle est demandée pour publier
      const idBandeau = (() => {
        if (!ID || !idC || idC.exempt || off0 || idS === 'verifie') return '';
        // une seule ligne, discrète : on touche pour ouvrir la vérification (23/10/2026)
        const CHV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
        const T = (cls, ico, t, txt, btn, extra) => btn
          ? `<button type="button" class="cp-idv ${cls}" data-idv aria-label="${esc(t + ' : ' + txt)}"><span class="cp-idv-i" aria-hidden="true">${ico}</span><span class="cp-idv-x"><b>${t}</b><small>${txt}</small></span>${extra || ''}<span class="cp-idv-c">${CHV}</span></button>`
          : `<div class="cp-idv ${cls}" role="status"><span class="cp-idv-i" aria-hidden="true">${ico}</span><span class="cp-idv-x"><b>${t}</b><small>${txt}</small></span></div>`;
        if (idC.banni) return T('ko', IC('fermer', 22), 'Compte banni', 'Il ne peut plus publier, négocier ni écrire.', 1);
        if (idS === 'en_attente') return T('bleu', IC('horloge', 22), 'Vérification en cours', 'L’équipe examine votre dossier.', '');
        if (idS === 'verification_manuelle') return T('', IC('photo', 22), 'Photos à refaire', 'Touchez pour les renvoyer.', 1);
        if (idS === 'expire') return T('ko', IC('horloge', 22), 'Pièce d’identité expirée', 'Refaites la vérification.', 1);
        if (idS === 'refuse') return T('ko', IC('fermer', 22), 'Vérification refusée', 'Voir le motif.', 1);
        const r = ID.gratuitesRestantes(idC);
        return T('', ID.badge(22), idS === 'brouillon' ? 'Terminer ma vérification' : 'Vérifier mon identité',
          r === null ? 'Gratuit · le badge rassure vos partenaires' : r === 0 ? 'Obligatoire pour publier · gratuit' : `${r} annonce${r > 1 ? 's' : ''} gratuite${r > 1 ? 's' : ''} restante${r > 1 ? 's' : ''} · gratuit`,
          1);
      })();
      // l'activité : ce qui s'est vraiment passé, du plus récent au plus ancien, regroupé par jour
      const montant = t => { const m = /(\d[\d  .]*)\s*F(?:\s*\/\s*([\p{L}]+))?/u.exec(t || ''); return m ? `${m[1].trim()} F${m[2] ? `<em>/ ${esc(m[2])}</em>` : ''}` : ''; };
      const evs = notifs().slice(0, 40).map((n, i) => { const nego = /propos|accord|accept|refus|expir|prix/i.test(n.texte), ok = /accord|accept/i.test(n.texte);
          return { t: n.t, ton: ok ? 'offre' : nego ? 'lien' : 'aide', ico: ok ? 'negoce' : nego ? 'negoce' : 'cloche', titre: esc(n.texte), long: true, sous: ok ? 'Accord' : nego ? 'Négociation' : 'Notification', m: montant(n.texte), neuf: !n.lu, attrs: `data-ni="${i}"` }; })
        .concat(off.map(x => ({ t: x.createdAt, ton: 'offre', ico: 'vendre', titre: esc(x.productLabel || x.productName || x.productSlug) + (x.quantity ? ' · ' + fmt(x.quantity) + ' ' + esc(x.unit || '') : ''), sous: 'Offre publiée', m: x.price ? `${fmt(x.price)} F<em>/ ${esc(x.unit || 'kg')}</em>` : '<em>à discuter</em>', attrs: 'data-go="activite"' })))
        .concat(dem.map(x => ({ t: x.createdAt, ton: 'demande', ico: 'demander', titre: esc(x.productLabel || x.productName || x.productSlug) + (x.quantity ? ' · ' + fmt(x.quantity) + ' ' + esc(x.unit || '') : ''), sous: 'Demande publiée', m: x.budget ? `${fmt(x.budget)} F<em>budget / ${esc(x.unit || 'kg')}</em>` : '<em>à discuter</em>', attrs: 'data-go="activite"' })))
        .filter(e => e.t && !isNaN(Date.parse(e.t))).sort((a, b) => Date.parse(b.t) - Date.parse(a.t)).slice(0, 6);
      const jour = t => { const d = new Date(t), a = new Date(), h = new Date(a - 864e5), m = x => x.toDateString(); return m(d) === m(a) ? 'Aujourd’hui' : m(d) === m(h) ? 'Hier' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: d.getFullYear() === a.getFullYear() ? undefined : 'numeric' }); };
      const heure = t => { const d = new Date(t); return 'à ' + d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0'); };
      let fil = '', jPrec = '';
      evs.forEach(e => { const j = jour(e.t); if (j !== jPrec) { fil += (jPrec ? '</div>' : '') + `<p class="cp-day">${j}</p><div class="cp-feed">`; jPrec = j; }
        fil += `<button type="button" class="cp-ev${e.neuf ? ' neuf' : ''}" data-ton="${e.ton}" ${e.attrs}><span class="o" aria-hidden="true">${IC(e.ico, 22)}</span><b${e.long ? ' class="long"' : ''}>${e.titre}</b><span class="m">${e.m}</span><small>${e.sous} ${heure(e.t)}</small></button>`; });
      if (fil) fil += '</div>';
      // vos statuts (v3/statuts.js) : ceux gagnés, et ce qui reste à faire pour les suivants
      const SG = window.MDGStatut;
      if (SG && !SG.get(u.id)) addEventListener('mdg:rep', function f() { removeEventListener('mdg:rep', f); if (bg && bg.rafraichirAuto && main.isConnected) bg.rafraichirAuto(); });
      const stBloc = !SG || off0 ? '' : (() => { const gag = SG.liste(u.id), but = SG.progres(u.id), v = idS === 'verifie';
        return `<div class="cp-sh"><h3>Vos statuts</h3><small>Ils se gagnent, ils ne s’achètent pas</small></div>
          <div class="cp-grp cp-statuts">${gag.length || v ? `<div class="cp-st-l">${SG.puces(u.id, { max: 9, t: 18 })}</div>` : '<p class="cp-vide">Pas encore de statut. Votre identité vérifiée, vos commandes terminées et vos réponses rapides en font gagner, et les autres membres les voient partout : annonces, carte, messages.</p>'}
          ${!v && ID && !(idC && idC.exempt) && !idBandeau ? '<button type="button" class="cp-st-go" data-idv2>' + (ID.badge ? ID.badge(16) : '') + 'Faire vérifier mon identité</button>' : ''}
          ${but.map(x => `<div class="st-but"><b>${x.t}</b><small>${x.fait} sur ${x.total} ${x.txt}</small><div class="st-jauge" role="img" aria-label="${x.fait} sur ${x.total}"><i style="width:${Math.min(100, x.fait / x.total * 100)}%"></i></div></div>`).join('')}</div>`; })();
      main.innerHTML = `<div class="cp-pg">
        <section class="cp-hero" aria-label="Mon identité">
          <div class="cp-hero-av">${off0 && window.MDGMarque ? MDGMarque.dg(114, { fond: 'vert', rond: true }) : (A() ? A().svg(p.avatar, { size: 114, nom: nom || '?', seed: u.id, anime: true }) : '') + `<button type="button" class="cp-hero-cam" data-av aria-label="Changer mon avatar">${IC('photo', 18)}</button>`}</div>
          ${off0 ? `<h2>marché <em>de Gros</em></h2>
          <p class="cp-off-p">${esc(N().fmtTel(u.tel))} · visible par vous seul. Les membres voient « Marché de Gros », jamais votre nom ni votre numéro.</p>
          <div class="cp-hero-tags"><span class="cp-adm">${window.MDGMarque ? MDGMarque.dg(16, { fond: 'vert', rond: true }) : ''}Administrateur · Officiel</span></div>` : `<h2>${nom ? 'Bonjour, <em>' + esc(p.pseudo || p.prenom || nom) + '</em>' : '<em>Bienvenue</em>'}${idS === 'verifie' ? ' ' + ID.badge(22) : ''}</h2>
          <p>${esc(N().fmtTel(u.tel))}</p>
          <div class="cp-hero-tags">${p.role ? `<span>${ROLE_TXT[p.role] || ''}</span>` : ''}${lieuTxt ? `<span>${IC('lieu', 13)}${esc(lieuTxt)}</span>` : ''}${!nom ? '<span class="a">Profil à compléter</span>' : ''}${ID && idC && !idC.exempt ? (idS === 'verifie' ? `<span class="idok">${ID.badge(14)}Identité vérifiée</span>` : idC.banni ? '<span class="a">Compte banni</span>' : '<span class="a">Identité non vérifiée</span>') : ''}</div>`}
          <div class="cp-hero-act">
            ${M ? `<button type="button" data-dm>${IC('messages', 20)}Messages${dmN ? `<em aria-label="${dmN} non lus">${dmN}</em>` : ''}</button>` : ''}
            <button type="button" data-nego>${IC('negoce', 20)}Négociations${ng.rec.length ? `<em aria-label="${ng.rec.length} à vous de répondre">${ng.rec.length}</em>` : ''}</button>
          </div>
        </section>
        <div class="cp-body">
          ${idBandeau}
          ${off0 ? '' : repBtn}
          ${stBloc}
          <div class="cp-sh"><h3>Votre compte</h3><small>${esc(N().fmtTel(u.tel))}</small></div>
          <div class="cp-grp">
            ${off0 ? '' : ligne({ ico: mono('compte'), t: 'Profil et avatar', s: nom ? '' : 'Prénom, rôle, lieu', attrs: 'data-go="profil"' })}
            ${window.MDGBoutique && !off0 ? ligne({ ico: mono('vendre'), t: 'Ma boutique', s: 'Mes offres sur une page à partager, QR code', attrs: 'data-boutique' }) : ''}
            ${window.MDGReleve ? ligne({ ico: mono('barres'), t: 'Mes ventes et achats', s: 'Relevés, bons de transaction, volumes', attrs: 'data-releve' }) : ''}
            ${window.MDGCommandes && !off0 ? (() => { const nC = MDGCommandes.aAgir(); return ligne({ ico: mono('negoce'), t: 'Mes commandes', s: nC ? nC + (nC > 1 ? ' commandes attendent' : ' commande attend') + ' votre action' : 'Suivi du chargement à la réception', n: nC, attrs: 'data-cmds' }); })() : ''}
            ${window.MDGRep && MDGRep.fiabilite && !off0 ? (() => { const f = MDGRep.fiabResume(), sc = f && f.score, nv = f ? +f.non_vues || 0 : 0; return ligne({ ico: mono('tendance'), t: 'Ma fiabilité', s: f && f.suspension ? 'Compte suspendu pour l’instant' : sc && sc.sur ? 'Fiabilité : ' + sc.pourcent + ' % sur ' + sc.sur + ' commande' + (sc.sur > 1 ? 's' : '') : 'Votre score et votre historique', n: nv, attrs: 'data-fiab' }); })() : ''}
            ${window.MDGRep && MDGRep.niveaux && !off0 ? (() => { const f = MDGRep.nivResume(), R = f && f.roles || {}, L = ['vendeur', 'acheteur'].map(k => R[k] && R[k].libelle).filter(Boolean), sursis = ['vendeur', 'acheteur'].some(k => R[k] && R[k].grace_jusqua); return ligne({ ico: mono('confiance'), t: 'Mes niveaux', s: sursis ? 'Un niveau est en sursis : voyez ce qui manque' : L.length ? L.join(' · ') : 'Vendeur fiable, Bon, Excellent, Grand : ce qui manque', n: f ? +f.non_vus || 0 : 0, attrs: 'data-niv' }); })() : ''}
            ${window.MDGAppro && !off0 ? ligne({ ico: mono('tableau'), t: 'Approvisionnement pro', s: 'Besoins réguliers, propositions, comparaison', attrs: 'data-appro' }) : ''}
            ${window.MDGGroupes && !off0 ? ligne({ ico: mono('comptes'), t: 'Achats groupés', s: 'Acheter à plusieurs, moins cher', attrs: 'data-groupes' }) : ''}
            ${window.MDGRacheter && !off0 ? ligne({ ico: mono('echanger'), t: 'Racheter', s: 'Mes achats habituels, prix du jour, rappels', attrs: 'data-racheter' }) : ''}
            ${window.MDGChauffeur && !off0 ? (() => { const e = MDGChauffeur.etat(); return ligne({ ico: mono('distance'), t: 'Espace chauffeur', s: !e.inscrit ? 'Transporteur ? Inscrivez-vous, c’est gratuit' : e.propositions ? e.propositions + (e.propositions > 1 ? ' missions à accepter' : ' mission à accepter') : e.statut === 'verifie' ? 'Profil vérifié · vos missions' : e.statut === 'en_attente' ? 'Vérification en cours · vos missions' : 'Vos missions', n: e.propositions, attrs: 'data-chauffeur' }); })() : ''}
            ${ligne({ ico: mono('cloche'), t: 'Notifications', v: '<span data-pst>…</span>', n: nl, attrs: 'data-go="notifs"' })}
            ${ID && !off0 ? ligne({ ico: mono('verifie'), t: 'Identité', s: (ID.RESUME[idS] || ID.RESUME.non_verifie)[1], v: (ID.RESUME[idS] || ID.RESUME.non_verifie)[0], vf: idS === 'verifie', attrs: 'data-idv' }) : ''}
            ${ligne({ ico: mono('cadenas'), t: 'Sécurité et code secret', attrs: 'data-go="securite"' })}
            ${M && M.ecrireMarche && !adm ? ligne({ ico: mono('service'), t: 'Écrire au Marché de Gros', s: 'Réponses tout de suite, sinon l’équipe répond', attrs: 'data-marche' }) : ''}
            ${adm ? (() => { const nI = +(J('mdg-admin:identites', {}).n) || 0; return ligne({ ico: mono('tableau'), t: 'Tableau de bord', s: nI ? nI + (nI > 1 ? ' dossiers' : ' dossier') + ' à examiner' : 'Administration', n: nI, href: nI ? 'admin.html#identites' : 'admin.html' }); })() : ''}
          </div>
          <div class="cp-grp">${ligne({ ico: mono('sortir'), t: 'Déconnexion', cls: 'bad', chev: false, attrs: 'data-out' })}</div>
          <p class="cp-note">${off0 ? 'Compte officiel : pas de vérification d’identité, pas de note, pas d’étoiles. Tout ce que vous publiez ou écrivez apparaît au nom du « Marché de Gros ».' : 'Votre numéro n’est pas vérifié par SMS.'}</p>
        </div></div>`;
      main.querySelectorAll('[data-go]').forEach(b => b.onclick = () => bg.aller(b.dataset.go));
      const q = s => main.querySelector(s);
      if (q('[data-dm]')) q('[data-dm]').onclick = () => { fermer(); M.boite(); };
      q('[data-nego]').onclick = () => { if (G && G.inbox) { fermer(); G.inbox(); } else bg.aller('activite'); };
      if (q('[data-av]')) q('[data-av]').onclick = () => choisirAvatar(() => ouvrir());
      if (q('[data-idv2]')) q('[data-idv2]').onclick = () => { fermer(); ID.ouvrir(); };
      if (q('[data-marche]')) q('[data-marche]').onclick = () => { fermer(); M.ecrireMarche(); };
      if (q('[data-releve]')) q('[data-releve]').onclick = () => { fermer(); window.MDGReleve.ouvrir(); };
      if (q('[data-boutique]')) q('[data-boutique]').onclick = () => { fermer(); window.MDGBoutique.gerer(); };   // schéma 86
      if (q('[data-cmds]')) q('[data-cmds]').onclick = () => { fermer(); window.MDGCommandes.ouvrir(); };
      if (q('[data-fiab]')) q('[data-fiab]').onclick = () => { fermer(); window.MDGRep.fiabilite(); };
      if (q('[data-niv]')) q('[data-niv]').onclick = () => { fermer(); window.MDGRep.niveaux(); };
      if (q('[data-appro]')) q('[data-appro]').onclick = () => { fermer(); window.MDGAppro.ouvrir(); };
      if (q('[data-groupes]')) q('[data-groupes]').onclick = () => { fermer(); window.MDGGroupes.ouvrir('miens'); };
      if (q('[data-racheter]')) q('[data-racheter]').onclick = () => { fermer(); window.MDGRacheter.habituels(); };
      if (q('[data-chauffeur]')) q('[data-chauffeur]').onclick = () => { fermer(); window.MDGChauffeur.ouvrir(); };
      main.querySelectorAll('[data-idv]').forEach(b => b.onclick = () => { fermer(); ID.ouvrir(); });
      q('[data-out]').onclick = deconnecter;
      main.querySelectorAll('[data-ni]').forEach(b => b.onclick = () => { const all = notifs(), n = all[+b.dataset.ni]; if (!n) return; n.lu = true; W(KN, all); if (n.nego && G) { fermer(); G.thread(n.nego); } else bg.aller('notifs'); });
      remplirRep(q('[data-rep]'), p, u);
      const pst = q('[data-pst]'); (window.MDGPousse ? MDGPousse.etat() : Promise.resolve('impossible')).then(st => { if (pst.isConnected) pst.textContent = POUSSE_COURT[st] || ''; }).catch(() => { pst.textContent = ''; });
    },
    profil(main) {
      const p = profil || {}, u = me();
      main.innerHTML = `<div class="cp-pg"><h2>Profil et avatar</h2><p>Ce que les autres voient quand vous publiez ou négociez : votre avatar et ${p.pseudo ? 'votre pseudonyme' : 'votre prénom'}${p.nom_public ? ' et votre nom' : ', avec l’initiale de votre nom'}.</p>
        <div class="cp-avz"><div class="cp-avbig">${A().svg(p.avatar, { size: 108, nom: nomAffiche(p) || '?', seed: u.id })}</div><div class="cp-row"><button type="button" class="cp-alt" data-av>${p.avatar ? 'Changer d’avatar' : 'Choisir mon avatar'}</button>${p.avatar ? '<button type="button" class="cp-alt" data-av0>Mes initiales</button>' : ''}</div></div>
        <form class="cp-f" novalidate>
          <h3 class="cp-lab">Comment on vous appelle</h3>
          <div class="cp-fg">${champ('cp-prenom', 'Prénom', p.prenom, { attrs: 'maxlength="40" autocomplete="given-name" required' })}${champ('cp-nom', 'Nom', p.nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Les autres ne voient que son initiale, sauf si vous choisissez de le montrer (Confidentialité).' })}
          ${champ('cp-pseudo', 'Pseudonyme', p.pseudo, { facultatif: true, attrs: 'maxlength="24" autocomplete="nickname" spellcheck="false" autocapitalize="off"', aide: 'S’il est rempli, il remplace votre prénom. Unique sur le Marché de Gros.' })}</div>
          <div class="cp-grp"><label class="cp-r">${ti('oeil', 'vous')}<span class="cp-r-t"><b>Montrer mon nom de famille</b><small>Sinon, les autres voient « ${esc(p.prenom || 'Prénom')} ${esc(p.nom ? p.nom[0] + '.' : 'N.')} »${p.pseudo ? ' (votre pseudonyme passe avant)' : ''}</small></span><input type="checkbox" class="cp-tog" role="switch" data-np ${p.nom_public ? 'checked' : ''}></label></div>
          <h3 class="cp-lab">Ce que vous faites, et où</h3>
          <div class="cp-fg">${roleSeg(p)}${lieu(p)}</div>
          <button type="submit" class="cp-go plein">Enregistrer</button><span class="cp-msg" role="status"></span></form>
        <h3 class="cp-lab">Votre structure</h3>
        <form class="cp-f" data-stform novalidate><div class="cp-fg"><div data-stf></div></div><button type="submit" class="cp-go plein">Enregistrer la structure</button><span class="cp-msg" role="status" data-stok></span></form>
        <div data-stv></div>
        <h3 class="cp-lab">Téléphone</h3>
        <div class="cp-grp">${ligne({ ico: ti('telephone', 'aide'), t: esc(N().fmtTel(u.tel)), s: 'Numéro du compte', cls: 'info', chev: false })}</div>
        <p class="cp-note">Le nom affiché sur chaque annonce (nom de vendeur ou d’exploitation) reste celui de l’annonce.</p></div>`;
      lierRole(main); lierLieu(main, p); badgeStructure(main.querySelector('[data-stv]'));
      // nom de famille visible ou non (déplacé de Réglages le 24/10/2026 : c'est ce que les autres voient de vous)
      const np = main.querySelector('[data-np]'); if (np) np.onchange = async e => { try { await enregistrer({ nom_public: e.target.checked }); N().toast('Réglage enregistré.'); } catch (x) { e.target.checked = !e.target.checked; N().toast(x.message); } };
      // la structure (schéma 23)
      const sf = main.querySelector('[data-stform]'), S = formStructure(sf.querySelector('[data-stf]'), p), sok = sf.querySelector('[data-stok]'), sgo = sf.querySelector('.cp-go');
      sf.onsubmit = async e => { e.preventDefault(); sok.textContent = ''; if (!S.verifier()) return; if (!navigator.onLine) { sok.textContent = 'Pas de connexion internet : réessayez quand le réseau revient.'; return; }
        sgo.disabled = true; sgo.setAttribute('aria-busy', 'true');
        try { await enregistrer(S.val()); N().toast('Structure enregistrée.', { sous: 'Elle apparaît sur votre profil et vos annonces.' }); badgeStructure(main.querySelector('[data-stv]')); }
        catch (x) { sok.textContent = x.message; } finally { sgo.disabled = false; sgo.removeAttribute('aria-busy'); } };
      main.querySelector('[data-av]').onclick = () => choisirAvatar(() => ouvrir('profil'));
      const z = main.querySelector('[data-av0]'); if (z) z.onclick = async () => { try { await enregistrer({ avatar: null }); bg.rafraichir(); N().toast('Avatar : vos initiales.'); } catch (e) { N().toast(e.message); } };
      const f = main.querySelector('form'), msg = main.querySelector('.cp-msg'), go = main.querySelector('.cp-go');
      f.querySelectorAll('.cp-in').forEach(i => i.addEventListener('blur', () => { const k = i.id.slice(3); if (VALID[k] && i.value) valider(f, [k]); }));
      f.onsubmit = async e => {
        e.preventDefault(); msg.textContent = ''; if (!valider(f, ['prenom', 'nom', 'pseudo'])) { f.querySelector('[aria-invalid=true]').focus(); return; }
        if (!navigator.onLine) { msg.textContent = 'Pas de connexion internet : réessayez quand le réseau revient.'; return; }
        go.disabled = true; go.setAttribute('aria-busy', 'true'); go.textContent = 'Enregistrement…';
        try { await enregistrer(Object.assign({ prenom: f.querySelector('#cp-prenom').value.trim(), nom: f.querySelector('#cp-nom').value.trim() || null, pseudo: f.querySelector('#cp-pseudo').value.trim() || null, role: roleVal(f) }, lieuVal(f)));
          N().toast('Profil enregistré.'); bg.aller('accueil'); }
        catch (x) { go.disabled = false; go.removeAttribute('aria-busy'); go.textContent = 'Enregistrer'; if (/pseudonyme/i.test(x.message)) { f.querySelector('#cp-pseudo').setAttribute('aria-invalid', 'true'); f.querySelector('#cp-pseudo-e').textContent = x.message; } else msg.innerHTML = `<span class="cp-bad">${esc(ERR(x))}</span>`; }
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
      const sec = (t, L, f, vide) => `<h3 class="cp-lab">${t}${L.length ? '<span class="nbul">' + L.length + '</span>' : ''}</h3><div class="cp-grp">${L.length ? L.slice(0, 20).map(f).join('') : `<p class="cp-vide">${vide}</p>`}</div>`;
      main.innerHTML = `<div class="cp-pg"><h2>Mon activité</h2><p>Vos annonces, vos négociations, vos messages et vos notifications.</p>
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
      main.innerHTML = `<div class="cp-pg"><h2>Notifications</h2><p>Propositions, contre-propositions, accords, refus et expirations. Pour choisir ce que vous recevez sur ce téléphone : Réglages, puis Notifications.</p>

        <h3 class="cp-lab">Récentes${L.some(n => !n.lu) ? '<button type="button" data-lu>Tout marquer comme lu</button>' : ''}</h3>
        <div class="cp-grp">${L.length ? L.slice(0, 60).map((n, i) => `<button type="button" class="cp-r cp-it${n.lu ? '' : ' neuf'}" data-i="${i}"><span class="pt${n.lu ? ' lu' : ''}" aria-label="${n.lu ? 'Lue' : 'Non lue'}"></span><b style="white-space:normal">${esc(n.texte)}</b><span></span><small><span>${ago(n.t)}</span></small></button>`).join('')
          : '<p class="cp-vide"><b>Rien de nouveau</b>Les réponses à vos propositions et les accords apparaîtront ici.</p>'}</div></div>`;
      // les réglages (activer sur ce téléphone, annonces du marché…) sont dans Réglages (app/theme.js), plus ici
      const lu = main.querySelector('[data-lu]'); if (lu) lu.onclick = () => { W(KN, notifs().map(n => Object.assign(n, { lu: true }))); bg.rafraichir(); };
      main.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const all = notifs(), n = all[+b.dataset.i]; if (!n) return; n.lu = true; W(KN, all); if (n.nego && window.MDGNegoce) { fermer(); MDGNegoce.thread(n.nego); } else bg.rafraichir(); });
    },
    prefs(main) {
      const pf = prefs(), p = profil || {}, S = window.MDGSons, sn = S ? S.reglages() : null;
      main.innerHTML = `<div class="cp-pg"><h2>Réglages</h2>
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
        catch (x) { msg.innerHTML = `<span class="cp-bad">${esc(/incorrect/i.test(x.message) ? 'Code actuel incorrect.' : ERR(x))}</span>`; }
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
    box.innerHTML = `<form class="cp-f" novalidate><p style="margin:0;font-size:14.5px">Pour confirmer, tapez votre code secret.</p>${champ('cp-dc', 'Code secret', '', { attrs: 'type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"' })}<div class="cp-row"><button type="submit" class="cp-go" style="background:#C0442B">Supprimer définitivement</button><button type="button" class="cp-alt" data-no>Annuler</button></div></form>`;
    main.querySelector('[data-del]').replaceWith(box);
    box.querySelector('[data-no]').onclick = () => bg.rafraichir();
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const c = box.querySelector('#cp-dc').value, er = box.querySelector('#cp-dc-e'); er.textContent = '';
      if (!/^\d{6}$/.test(c)) { er.textContent = 'Votre code fait 6 chiffres.'; return; }
      const b = box.querySelector('.cp-go'); b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'Suppression';
      try { await N().signIn(me().tel, c); await N().rpc('supprimer_compte'); localStorage.removeItem(KP); fermer(); N().signOut(); N().toast('Votre compte est supprimé. Vos annonces ont été retirées.'); }
      catch (x) { er.textContent = /incorrect/i.test(x.message) ? 'Code incorrect.' : /supprimer_compte|schema cache|Could not find/i.test(x.message) ? 'La suppression n’est pas encore activée sur le serveur. Contactez le Marché de Gros.' : ERR(x); b.disabled = false; b.textContent = 'Supprimer définitivement'; }
    };
  }

  /* ——— choisir son avatar : portrait dessiné, photo (recadrée ici, envoyée dans avatars/<id>.jpg) ou initiales ——— */
  function choisirAvatar(apres, embarque) {
    const u = me(), M = A(), nom = nomAffiche(profil) || '?', cur = M.parse(profil && profil.avatar);
    const PG = window.MDGPerso;   // les personnages du marché (v3/personnages.js)
    let mode = cur.mode === 'v1' || cur.mode === 'ph' || cur.mode === 'mg' ? cur.mode : (profil && profil.avatar ? 'ini' : PG ? 'mg' : 'v1');
    let g = cur.mode === 'mg' && PG ? PG.normal(cur) : PG ? PG.hasard() : null, saut = false;
    let o = cur.mode === 'v1' ? cur : M.parse('v1:c=foulard;t=1;k=0;f=' + Math.max(0, cur.f >= 0 ? cur.f : 1));
    let fi = cur.f >= 0 ? cur.f : 1;
    const ph = { img: null, z: 1, x: 0, y: 0, url: '' }; // photo en cours de cadrage
    const S = 240; // côté du cadre de recadrage (px CSS)
    const codeNow = () => mode === 'mg' && PG ? PG.code(g) : mode === 'v1' ? M.code(o) : mode === 'ini' ? 'ini:f=' + fi : cur.mode === 'ph' && !ph.img ? M.code(Object.assign({}, cur, { f: fi })) : '';
    const rnd = n => Math.floor(Math.random() * n);
    // le dé : une face dessinée (points verts, le 1 en rouge), avec son épaisseur
    const de = n => { const p = { 1: [[24, 24]], 2: [[15, 15], [33, 33]], 3: [[14, 14], [24, 24], [34, 34]], 4: [[15, 15], [33, 15], [15, 33], [33, 33]], 5: [[15, 15], [33, 15], [24, 24], [15, 33], [33, 33]], 6: [[15, 14], [33, 14], [15, 24], [33, 24], [15, 34], [33, 34]] }[n];
      return '<svg viewBox="0 0 52 52" width="58" height="58" aria-hidden="true"><defs><linearGradient id="avxDe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E9E1D0"/></linearGradient></defs><rect x="5" y="6.5" width="44" height="44" rx="11" fill="#BFB49B"/><rect x="2" y="2" width="44" height="44" rx="11" fill="url(#avxDe)" stroke="rgba(23,21,18,.1)"/><rect x="7" y="4.6" width="34" height="6" rx="3" fill="#fff" opacity=".8"/>'
        + p.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="' + (n === 1 ? 5.6 : 4) + '" fill="' + (n === 1 ? '#E2412F' : '#10392B') + '"/><circle cx="' + (x - 1.2) + '" cy="' + (y - 1.2) + '" r="1.1" fill="#fff" opacity=".35"/>').join('') + '</svg>'; };
    const html = () => '<div class="avx"><aside class="avx-pv"><div class="avx-big"></div><b class="avx-nom">' + esc(nom) + '</b><div class="avx-mini" aria-hidden="true"><span><i class="m36"></i><small>Négociation</small></span><span><i class="m24"></i><small>Annonce</small></span></div>' + (PG ? '<button type="button" class="avx-de" data-mgd aria-label="Tirer un personnage au hasard"><span class="avx-de3d">' + de(5) + '</span><small>Au hasard</small></button><span class="avx-pop" aria-live="polite"></span>' : '') + '</aside>'
      + '<div class="avx-c"><div class="avx-mode" role="tablist" aria-label="Type d’avatar">' + (PG ? [['mg', 'Personnage']] : []).concat(cur.mode === 'v1' || !PG ? [['v1', 'Portrait']] : [], [['ph', 'Photo'], ['ini', 'Initiales']]).map(([k, t]) => '<button type="button" role="tab" data-mode="' + k + '" aria-selected="' + (mode === k) + '">' + t + '</button>').join('') + '</div><div class="avx-p"></div></div></div>';
    const zone = embarque || (cadre('<div class="cp-main" style="grid-column:1 / -1"><h2>Mon avatar</h2><p>Il apparaît sur votre profil, à côté de vos annonces et dans vos négociations.</p><div class="cp-avw"></div><div class="cp-row avx-act"><button type="button" class="cp-go" data-ok>Enregistrer</button><button type="button" class="cp-alt" data-no>Annuler</button><span class="cp-msg" role="status"></span></div></div>', 'Mon avatar'), bg.querySelector('.cp-avw'));
    zone.innerHTML = html();
    const P = zone.querySelector('.avx-p'), big = zone.querySelector('.avx-big'), m36 = zone.querySelector('.m36'), m24 = zone.querySelector('.m24');
    function apercu() {
      if (mode === 'ph' && ph.img) { const d = rendu(144).toDataURL('image/jpeg', .8); big.innerHTML = '<img src="' + d + '" alt="" width="148" height="148">'; m36.innerHTML = '<img src="' + d + '" alt="" width="36" height="36">'; m24.innerHTML = '<img src="' + d + '" alt="" width="24" height="24">'; return; }
      const k = codeNow() || 'ini:f=' + fi;
      big.innerHTML = M.svg(k, { size: 148, nom, seed: u.id, anime: true, saut }); saut = false; m36.innerHTML = M.svg(k, { size: 36, nom, seed: u.id }); m24.innerHTML = M.svg(k, { size: 24, nom, seed: u.id });
    }
    const dots = (L, key, sel, lab) => '<div class="cp-dots">' + L.map((col, i) => '<button type="button" class="cp-dot" data-' + key + '="' + i + '" style="background:' + col + '" aria-label="' + lab + ' ' + (i + 1) + '" aria-pressed="' + (sel === i) + '"></button>').join('') + '</div>';
    function panneau() {
      zone.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
      const pv = zone.querySelector('.avx-pv'); if (pv) pv.classList.toggle('avec-de', mode === 'mg' && !!PG);
      if (mode === 'mg' && PG) {
        // garder la position de chaque rangée qui défile, d'un affichage à l'autre
        const pos = {}; P.querySelectorAll('[data-rang]').forEach(r => { pos[r.dataset.rang] = r.scrollLeft; });
        const vignette = (k, i) => M.svg(PG.code(Object.assign({}, g, { [k]: i }, k === 'b' ? { p: 0 } : {})), { size: 58, nom: '' });
        const V = PG.visage(g.b), zoom = { y: 1, m: 1, l: 1, s: 1 };   // yeux, bouche, lunettes, moustache : vignette zoomée sur le visage
        const rang = (t, k, L) => '<div class="avx-sec"><span class="cp-l">' + t + '</span><div class="avx-rang" data-rang="' + k + '">' + L.map((n, i) => '<button type="button" class="avx-pick" data-mgk="' + k + '" data-mgv="' + i + '" aria-pressed="' + (g[k] === i) + '">' + (zoom[k] ? '<span class="avx-zv" style="--ox:' + V.x + '%;--oy:' + V.y + '%">' + vignette(k, i) + '</span>' : vignette(k, i)) + '<span>' + esc(n) + '</span></button>').join('') + '</div></div>';
        const pts = (t, k, L) => '<div class="avx-sec"><span class="cp-l">' + t + '</span><div class="cp-dots">' + L.map((col, i) => '<button type="button" class="cp-dot" data-mgk="' + k + '" data-mgv="' + i + '" style="background:' + col + '" aria-label="' + t + ' ' + (i + 1) + '" aria-pressed="' + (g[k] === i) + '"></button>').join('') + '</div></div>';
        const C = PG.CHOIX, K = PG.COULEURS;
        P.innerHTML = rang('Personnage', 'b', C.b) + pts('Couleur', 'p', K.p(g.b))
          + rang('Yeux', 'y', C.y) + rang('Bouche', 'm', C.m)
          + '<div class="avx-sec"><span class="cp-l">Joues</span><div class="cp-seg"><button type="button" data-mgk="j" data-mgv="1" aria-pressed="' + (g.j === 1) + '">Rosées</button><button type="button" data-mgk="j" data-mgv="0" aria-pressed="' + (g.j === 0) + '">Sans</button></div></div>'
          + rang('Sur la tête', 'h', C.h) + pts('Couleur du chapeau', 'hc', K.hc)
          + rang('Lunettes', 'l', C.l) + rang('Moustache', 's', C.s) + rang('Dans la main', 'i', C.i)
          + pts('Chaussures', 'c', K.c) + pts('Fond', 'f', K.f) + rang('Motif du fond', 'g', K.g);
        P.querySelectorAll('[data-rang]').forEach(r => { if (pos[r.dataset.rang] != null) r.scrollLeft = pos[r.dataset.rang]; else { const on = r.querySelector('[aria-pressed=true]'); if (on) r.scrollLeft = Math.max(0, on.offsetLeft - 16); } });
      } else if (mode === 'v1') {
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
          ? '<div class="avx-sec avx-crop"><div class="avx-stage" tabindex="0" aria-label="Cadrage de la photo : glissez pour déplacer, flèches du clavier aussi"><canvas width="' + S * 2 + '" height="' + S * 2 + '"></canvas><i aria-hidden="true"></i></div><label class="avx-zoom"><span class="cp-l">Agrandir</span><input type="range" min="1" max="3" step="0.01" value="' + ph.z + '"></label><p class="cp-help">Glissez la photo pour la centrer sur votre visage.</p><div class="cp-row"><label class="cp-alt avx-file">Choisir une autre photo<input type="file" accept="image/*" class="avx-in"></label></div></div>'
          : '<div class="avx-sec"><label class="avx-drop"><input type="file" accept="image/*" class="avx-in"><b>' + (cur.mode === 'ph' ? 'Changer de photo' : 'Choisir une photo') + '</b><span>Depuis la galerie ou l’appareil photo · JPEG, PNG ou HEIC</span></label><p class="cp-help">Visible de tous, à côté de vos annonces et dans vos négociations. Une photo de vous ou de votre stand, jamais d’une pièce d’identité.</p></div>';
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
    // le dé roule, montre une nouvelle face, et une étiquette annonce le tirage
    let tPop = 0;
    function lancer(b) {
      const f = 1 + rnd(6), d3 = b.querySelector('.avx-de3d'), pop = zone.querySelector('.avx-pop');
      b.classList.remove('roule'); void b.offsetWidth; b.classList.add('roule');
      setTimeout(() => { if (d3) d3.innerHTML = de(f); }, 260);
      try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
      if (pop) { pop.textContent = ['Tiré au hasard !', 'Nouveau personnage !', 'Et voilà !', 'Bien joué, le dé !'][rnd(4)]; pop.classList.remove('on'); void pop.offsetWidth; pop.classList.add('on'); clearTimeout(tPop); tPop = setTimeout(() => pop.classList.remove('on'), 1700); }
    }
    zone.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !zone.contains(b)) return; const d = b.dataset;
      if (d.mode) { mode = d.mode; saut = mode === 'mg'; panneau(); return; }
      if ('mgd' in d && PG) { g = PG.hasard(); saut = true; panneau(); lancer(b); return; }
      if (d.mgk && PG) { g[d.mgk] = +d.mgv; if (d.mgk === 'b') g.p = 0; g = PG.normal(g); saut = true; panneau(); return; }
      if ('dice' in d) { const s = M.STYLES[rnd(M.STYLES.length)]; o = { mode: 'v1', c: s.id, t: rnd(M.TEINTS.length), k: rnd((s.tissu ? M.TISSUS : M.CHEVEUX).length), f: rnd(M.FONDS.length), a: M.DETAILS[rnd(M.DETAILS.length)].id }; panneau(); return; }
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
      catch (x) { throw new Error(x.status === 404 || /bucket|not found/i.test(x.message) ? 'La photo de profil n’est pas encore activée sur le serveur. Choisissez un portrait en attendant.' : x.status === 413 ? 'Photo trop lourde. Essayez-en une autre.' : x.code === 'auth' ? 'Votre session a expiré : reconnectez-vous.' : 'La photo n’a pas pu être envoyée. ' + ERR(x)); }
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
    cadre(`<div class="cp-main" style="grid-column:1 / -1"><div class="cp-steps" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="cp-w"></div></div>`, 'Bienvenue');
    bg.dataset.lock = '1'; bg.querySelector('.cp-x').hidden = true;
    const w = bg.querySelector('.cp-w');
    const pas = () => bg.querySelectorAll('.cp-steps i').forEach((x, i) => x.classList.toggle('on', i < etape));
    const suite = async (champs, fin) => { try { if (champs && navigator.onLine) await enregistrer(champs); } catch (x) { return ERR(x); } if (fin) { bg.dataset.lock = ''; fermer(); N().toast('Votre compte est prêt. Complétez votre profil quand vous voulez dans « Mon compte ».'); } else { etape++; dessiner(); } return ''; };
    function dessiner() {
      pas();
      if (etape === 1) {
        w.innerHTML = `<h2>Comment vous appelle-t-on&nbsp;?</h2><p>C’est ce que verront les vendeurs et les acheteurs avec qui vous échangez.</p><form class="cp-f cp-panel" novalidate>${champ('cp-prenom', 'Prénom', p().prenom, { attrs: 'maxlength="40" autocomplete="given-name"' })}${champ('cp-nom', 'Nom', p().nom, { facultatif: true, attrs: 'maxlength="60" autocomplete="family-name"', aide: 'Les autres ne voient que son initiale, sauf si vous choisissez de le montrer.' })}<div class="cp-row"><button class="cp-go">Continuer</button><span class="cp-msg" role="status"></span></div></form>`;
        const f = w.querySelector('form'); setTimeout(() => f.querySelector('#cp-prenom').focus(), 60);
        f.onsubmit = async e => { e.preventDefault(); if (!valider(f, ['prenom', 'nom'])) return; const m = await suite({ prenom: f.querySelector('#cp-prenom').value.trim(), nom: f.querySelector('#cp-nom').value.trim() || null }); if (m) f.querySelector('.cp-msg').textContent = m; };
      } else if (etape === 2) {
        w.innerHTML = `<h2>Votre avatar</h2><p>Choisissez ce qui vous ressemble, ou gardez vos initiales.</p><div class="cp-avw cp-panel"></div><div class="cp-row" style="margin-top:20px"><button type="button" class="cp-go" data-ok>Continuer</button><button type="button" class="cp-alt" data-ini>Garder mes initiales</button></div>`;
        getAv = choisirAvatar(null, w.querySelector('.cp-avw'));
        const okb = w.querySelector('[data-ok]'); okb.onclick = async () => { okb.disabled = true; okb.setAttribute('aria-busy', 'true'); let m = ''; try { m = await suite({ avatar: await getAv() }); } catch (x) { m = ERR(x); } if (m && okb.isConnected) { okb.disabled = false; okb.removeAttribute('aria-busy'); let er = w.querySelector('.cp-msg'); if (!er) { er = document.createElement('span'); er.className = 'cp-msg'; er.setAttribute('role', 'status'); okb.parentNode.appendChild(er); } er.textContent = m; } };
        w.querySelector('[data-ini]').onclick = () => suite(null);
      } else if (etape === 3) {
        w.innerHTML = `<h2>Ce que vous faites, et où</h2><p>Pour vous montrer d’abord ce qui vous concerne. Vous pouvez passer cette étape.</p><form class="cp-f cp-panel" novalidate>${roleSeg(p())}${lieu(p())}<div class="cp-row"><button class="cp-go">Continuer</button><button type="button" class="cp-alt" data-skip>Plus tard</button></div></form>`;
        const f = w.querySelector('form'); lierRole(f); lierLieu(f, p());
        f.onsubmit = e => { e.preventDefault(); suite(Object.assign({ role: roleVal(f) }, lieuVal(f))); };
        w.querySelector('[data-skip]').onclick = () => suite(null);
      } else {
        // la structure : coopérative, groupement, entreprise… (schéma 23) — elle rassure ceux qui vous écrivent
        w.innerHTML = `<h2 class="cp-voix">Vous représentez <em>qui ?</em></h2><p>Une coopérative, un groupement ou une entreprise inspire confiance : son nom et son logo apparaissent sur vos annonces et votre profil.</p><form class="cp-f cp-panel" novalidate><div data-stf></div><div class="cp-row"><button class="cp-go">Terminer</button><button type="button" class="cp-alt" data-skip>Plus tard</button></div></form>`;
        const f = w.querySelector('form'), S = formStructure(f.querySelector('[data-stf]'), p());
        f.onsubmit = async e => { e.preventDefault(); if (!S.verifier()) return; const v = S.val(); const m = await suite(v.structure_type ? v : null, true); if (m) { const x = f.querySelector('.cp-row'); x.insertAdjacentHTML('beforebegin', `<p class="cp-msg" role="alert">${esc(m)}</p>`); } };
        w.querySelector('[data-skip]').onclick = () => suite(null, true);
      }
    }
    dessiner();
  }

  // compte ouvert ou fermé : on recharge le profil
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte') { if (me()) charger(); else { profil = null; localStorage.removeItem(KP); dispatchEvent(new CustomEvent('mdg:profil')); } } });
  if (me()) setTimeout(charger, 900);

  // pour la page Réglages (app/theme.js) : enregistrer un réglage du profil (ex. { nom_public: true })
  const regler = champs => enregistrer(champs);
  window.MDGCompte = { regler, ouvrir, bienvenue, profil: () => profil, nomAffiche, avatar, hydrate, prefs, notifs, nonLues, choisirAvatar, structure, puceStructure, STRUCT, imgStruct };
})();
