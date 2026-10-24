/* ═════════ Marché de Gros CI — messagerie directe ═════════
   Écrire à un vendeur, un acheteur ou n'importe quel membre, sans annonce et sans quitter l'application.
   Chaque message est gardé 1 an (schéma 60) : l'équipe peut relire les échanges pour régler un litige ; on peut bloquer quelqu'un.
   Serveur : supabase/schema-8.sql (dm_ouvrir, dm_envoyer, dm_liste, dm_messages, dm_lu, dm_masquer, dm_bloquer) ;
   notification sur le téléphone : fonction Edge « pousser » (déclencheur push_dm).
   Les administrateurs écrivent au nom du « Marché de Gros » (logo, mention Officiel) ; chacun peut écrire au Marché de Gros ;
   un administrateur peut écrire à tous les membres d'un coup (supabase/schema-10-admin-messages.sql).
   Un numéro écrit dans un message est masqué par le serveur et signalé aux administrateurs : les échanges restent ici.
   API : MDGMessages.boite() · ecrire(uid, { nom, avatar }) · ecrireMarche({ direct }) (d'abord l'aide, v3/aide.js) · parlerPersonne(texte) · diffuser() · conversation(id) · unread() · refresh()
   Événement : mdg:dm { unread } quand le nombre de conversations à lire change. */
(function () {
  'use strict';
  const JOURS = 365;  // = dm_duree() (schéma 60 : gardés 1 an, l'équipe peut les lire pour régler un litige)
  const KL = 'mdg-dm:liste';
  const N = () => window.MDGNuage, A = () => window.MDGAvatar;
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  // l'avatar : celui que la liste du serveur donne, sinon celui des profils publics déjà connus (v3/compte.js), sinon les initiales
  // le logo du Marché de Gros (messages de l'administration)
  // le petit « dG » du logo Étal vert (app/marque.js), rond comme les autres avatars
  const LOGO = t => window.MDGMarque ? MDGMarque.dg(t, { rond: true }) : `<span aria-hidden="true" style="flex:none;width:${t}px;height:${t}px;border-radius:50%;background:#10392B"></span>`;
  const OFF = '<span class="dm-off">Officiel</span>';
  const admin = () => { try { return JSON.parse(localStorage.getItem('mdg-nuage:admin')) === true; } catch (_) { return false; } };
  // seul le Marché de Gros officiel peut écrire des liens (supabase/schema-22) : dans ses messages, ils deviennent cliquables
  const lienOff = t => esc(t).replace(/\b(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, u => { const h = /^https?:/i.test(u) ? u : 'https://' + u; return /^https?:\/\/[^\s"'<>]+$/i.test(h) ? `<a href="${h}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${u}</a>` : u; });
  const av = (uid, code, nom, t, officiel) => { if (officiel) return LOGO(t); const u = !code && uid && window.MDGCompte ? MDGCompte.avatar(uid, { size: t, nom: nom || '?' }).uri : A() ? A().uri(code, { size: t, nom: nom || '?', seed: uid }) : '';
    return u ? `<img src="${u}" width="${t}" height="${t}" alt="">` : ''; };
  const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jour = t => { const d = new Date(t), a = new Date(); a.setHours(0, 0, 0, 0); const j = Math.round((a - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    return j <= 0 ? 'Aujourd’hui' : j === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const quand = t => { const d = new Date(t), j = (Date.now() - d) / 864e5; return j < 1 && d.getDate() === new Date().getDate() ? heure(t) : j < 2 ? 'hier' : d.toLocaleDateString('fr-FR', { weekday: 'short' }); };
  const reste = t => { const h = Math.max(0, (Date.parse(t) + JOURS * 864e5 - Date.now()) / 36e5); return h < 1 ? 'moins d’une heure' : h < 24 ? Math.round(h) + ' h' : Math.round(h / 24) + ' j'; };
  const err = x => { const m = String(x && x.message || x || ''); return /BLOQUE/.test(m) ? 'Vous ne pouvez plus écrire à cette personne.' : /TROP_VITE/.test(m) ? 'Trop de messages d’un coup. Attendez une minute.'
    : /Failed to fetch|NetworkError/i.test(m) ? 'Pas de réseau. Le message n’est pas parti.' : /dm_|schema cache|Could not find/i.test(m) ? 'La messagerie n’est pas encore activée sur le serveur.' : m || 'Une erreur est survenue.'; };

  // ——— la liste des conversations (gardée sur l'appareil pour s'afficher tout de suite) ———
  let liste = J(KL, []), dernierU = -1, premier = true, ouverte = null;
  const unread = () => liste.filter(c => c.non_lu && c.id !== ouverte).length;
  // pour la cloche de l'accueil : les conversations non lues dont le dernier message est arrivé après « ts » (heure du dernier toucher sur la cloche)
  const unreadDepuis = ts => liste.filter(c => c.non_lu && c.id !== ouverte && (Date.parse(c.updated_at) || 0) > (+ts || 0)).length;
  function annoncer() { const u = unread(); if (u !== dernierU) { dernierU = u; dispatchEvent(new CustomEvent('mdg:dm', { detail: { unread: u } })); } }
  async function refresh() {
    if (!N() || !N().session()) { if (liste.length) { liste = []; W(KL, []); } annoncer(); return liste; }
    if (!navigator.onLine) { annoncer(); return liste; }
    try {
      const avant = new Map(liste.map(c => [c.id, c.updated_at])), r = await N().rpc('dm_liste2').catch(e => /dm_liste2|schema cache|Could not find|404/i.test(e.message + e.status) ? N().rpc('dm_liste') : Promise.reject(e)) || [];
      if (!premier) r.filter(c => c.non_lu && c.id !== ouverte && avant.get(c.id) !== c.updated_at).forEach(c => {
        // l'îlot (app/toast.js) : qui écrit, ce qu'il dit, et « Répondre » ; plusieurs messages d'affilée se regroupent
        const apercu = String(c.dernier_texte || ''), av = c.officiel ? null : (window.MDGCompte && MDGCompte.avatar ? MDGCompte.avatar(c.autre_id, { size: 76, nom: c.autre_nom }).uri : null);
        N().toast(c.autre_nom, { type: 'info', sous: '« ' + apercu.slice(0, 70) + (apercu.length > 70 ? '…' : '') + ' »', img: av || undefined, rond: true, groupe: 'dm', muet: true,
          pluriel: () => 'nouveaux messages', action: { t: 'Répondre', fn: () => conversation(c.id, false, c) } });
        window.MDGSons && MDGSons.signal('proposition');
      });
      premier = false; liste = r; W(KL, r);
    } catch (e) { if (e.code === 'auth') { liste = []; W(KL, []); } }
    annoncer(); return liste;
  }

  // ——— feuille (sombre, plein écran sur téléphone, comme une vraie messagerie) ———
  const CSS = `.dm-bg{position:fixed;inset:0;z-index:9200;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:dmIn .2s ease both}
.dm{--ink:#171512;--mute:#655C4D;--line:rgba(23,21,18,.1);--acc:#10392B;position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:100%;background:#F4EEE3;color:var(--ink);font:400 15px/1.45 Jost,system-ui,sans-serif;animation:dmUp .38s cubic-bezier(.22,1,.36,1) both;overflow:hidden}
@media (min-width:720px){.dm-bg{align-items:center;padding:24px}.dm{height:min(760px,92dvh);border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.55)}}
.dm-h{flex:none;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 10px 10px;border-bottom:1px solid var(--line);background:#EFE7D9}
.dm-ib{flex:none;position:relative;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.07);color:var(--ink);display:grid;place-items:center;cursor:pointer}
.dm-ib svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.dm-ib:focus-visible,.dm button:focus-visible,.dm textarea:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.dm-qui{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:0;background:none;color:inherit;text-align:left;padding:4px;border-radius:14px;cursor:pointer;font:inherit}
.dm-qui img{flex:none;border-radius:50%}.dm-qui span{min-width:0}.dm-qui b{display:block;font-weight:600;font-size:16.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-qui small{display:block;color:var(--mute);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-t{flex:1;min-width:0;margin:0 0 0 6px;font:600 21px/1.1 Jost,sans-serif;letter-spacing:-.015em}.dm-t small{display:block;margin-top:2px;font:400 12.5px Jost,sans-serif;color:var(--mute)}
.dm-b{flex:1;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:14px 14px 18px;-webkit-overflow-scrolling:touch}
.dm-info{display:flex;align-items:center;justify-content:center;gap:7px;margin:2px auto 14px;padding:7px 12px;max-width:340px;border-radius:999px;background:rgba(23,21,18,.05);color:var(--mute);font-size:12.5px;text-align:center}
.dm-garde{margin:-6px auto 14px;padding:9px 12px;max-width:380px;border-radius:14px;background:rgba(242,201,76,.22);color:#5B4300;font-size:12.5px;line-height:1.45;text-align:center}
.dm-info svg{flex:none;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.dm-jour{margin:16px 0 8px;text-align:center;color:var(--mute);font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:capitalize}
.dm-m{display:flex;margin:3px 0}.dm-m.me{justify-content:flex-end}
.dm-m p{max-width:80%;margin:0;padding:9px 13px 7px;border-radius:20px 20px 20px 6px;background:rgba(23,21,18,.08);white-space:pre-wrap;overflow-wrap:anywhere;font-size:15.5px;line-height:1.4}
.dm-m.me p{border-radius:20px 20px 6px 20px;background:#171512;color:#F5F0E6}
.dm-m.suite p{border-top-left-radius:20px}.dm-m.me.suite p{border-top-right-radius:20px;border-top-left-radius:20px}
.dm-m time{display:block;margin-top:2px;text-align:right;font-size:11.5px;color:var(--mute)}.dm-m.me time{color:rgba(245,240,230,.72)}
.dm-m.envoi p{opacity:.6}.dm-m.rate p{box-shadow:inset 0 0 0 1.5px #E2735B}
.dm-m.rate time{opacity:1;color:#E2735B;font-weight:600}.dm-m.rate{cursor:pointer}
.dm-m.neuf p{animation:dmPop .3s cubic-bezier(.22,1,.36,1) both}
.dm-f{flex:none;display:flex;align-items:flex-end;gap:8px;padding:10px 10px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#EFE7D9}
.dm-f textarea{flex:1;min-width:0;min-height:46px;max-height:132px;margin:0;padding:12px 16px;border:1px solid rgba(23,21,18,.14);border-radius:23px;background:#FFFFFF;color:var(--ink);font:400 16px/1.35 Jost,sans-serif;resize:none;box-sizing:border-box}
.dm-f textarea:focus{outline:none;border-color:var(--acc)}
.dm-env{flex:none;width:46px;height:46px;border:0;border-radius:50%;background:var(--acc);color:#F3EFE4;display:grid;place-items:center;cursor:pointer;transition:transform .15s,opacity .2s}
.dm-env svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.dm-env:disabled{opacity:.35;cursor:default}.dm-env:not(:disabled):active{transform:scale(.92)}
.dm-stop{flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;color:var(--mute);font-size:14px}
.dm-stop button{flex:none;min-height:40px;padding:0 14px;border:0;border-radius:999px;background:#EFE7D9;color:var(--ink);font:600 13.5px Jost,sans-serif;cursor:pointer}
.dm-menu{position:absolute;right:10px;top:calc(60px + env(safe-area-inset-top));z-index:3;min-width:220px;padding:6px;border-radius:18px;background:#FFFDF8;border:1px solid rgba(23,21,18,.08);box-shadow:0 14px 34px rgba(23,21,18,.18),0 2px 6px rgba(23,21,18,.08);animation:dmPop .2s ease both}
.dm-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:46px;padding:0 12px;border:0;border-radius:12px;background:none;color:#171512;font:500 15px Jost,sans-serif;text-align:left;cursor:pointer}
.dm-menu button:hover{background:rgba(23,21,18,.06)}.dm-menu .rouge{color:#C0442B}
.dm-l{display:flex;flex-direction:column;gap:2px}
.dm-c{display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;align-items:center;width:100%;padding:10px 10px;border:0;border-radius:18px;background:#F4EEE3;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.dm-c:hover{background:rgba(23,21,18,.06)}.dm-c img{grid-row:span 2;border-radius:50%}
.dm-c b{font-weight:600;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-c small{grid-column:2;color:var(--mute);font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-c time{color:var(--mute);font-size:12px;text-align:right}.dm-c i{grid-column:3;justify-self:end;width:10px;height:10px;border-radius:50%;background:var(--acc)}
.dm-c.neuf b,.dm-c.neuf small{color:var(--ink);font-weight:600}.dm-c.neuf time{color:#10392B}
.dm-l .sw{border-radius:18px}.dm-l .sw+.sw{margin-top:2px}.dm-l .sw>.sw-row{background-color:#F4EEE3!important}
.dm-off{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:rgba(16,57,43,.2);color:#10392B;font:700 10.5px/1.6 Jost,sans-serif;letter-spacing:.06em;text-transform:uppercase;vertical-align:2px}
.dm-act{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.dm-act button,.dm-act a{flex:1 1 200px;display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 14px;border:1px solid rgba(23,21,18,.06);border-radius:18px;background:#FFFDF8;color:var(--ink);font:600 14.5px Jost,sans-serif;text-align:left;text-decoration:none;cursor:pointer;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.dm-act small{display:block;color:var(--mute);font-size:12px;font-weight:400}.dm-act a>svg{flex:none;width:34px;height:34px;padding:7px;border-radius:50%;background:rgba(106,174,240,.16);fill:none;stroke:#6AAEF0;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;box-sizing:border-box}
.dm-dif{display:flex;flex-direction:column;gap:12px;padding:16px}
.dm-dif textarea{min-height:160px;padding:14px 16px;border:1px solid rgba(23,21,18,.16);border-radius:18px;background:#FFFFFF;color:var(--ink);font:400 16px/1.45 Jost,sans-serif;resize:vertical}
.dm-dif textarea:focus{outline:none;border-color:var(--acc)}
.dm-dif .go{min-height:52px;border:0;border-radius:999px;background:var(--acc);color:#F3EFE4;font:700 15.5px Jost,sans-serif;cursor:pointer}.dm-dif .go:disabled{opacity:.5}
.dm-dif p{margin:0;color:var(--mute);font-size:13.5px;line-height:1.5}
.dm-org{display:flex;margin:3px 0 1px;min-width:0}.dm-org:empty{display:none}.dm-org-l{font-style:normal;font-weight:600;color:#10392B}
.dm-vide{padding:56px 18px;text-align:center;color:var(--mute);line-height:1.55}.dm-vide svg{width:54px;height:54px;margin:0 auto 14px;display:block;fill:none;stroke:#6AAEF0;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.dm-vide svg.ms{width:auto;height:auto;fill:initial;stroke:none;margin:0 auto 12px}
.dm-vide b{display:block;margin:0 0 6px;font:600 20px/1.2 Jost,sans-serif;letter-spacing:-.015em;color:var(--ink)}
.dm-vide button{margin-top:16px;min-height:46px;padding:0 18px;border:0;border-radius:999px;background:#EFE7D9;color:var(--ink);font:600 14.5px Jost,sans-serif;cursor:pointer}
@keyframes dmIn{from{opacity:0}}@keyframes dmUp{from{transform:translateY(30px);opacity:0}}@keyframes dmPop{from{transform:scale(.94);opacity:0}}
@media (prefers-reduced-motion:reduce){.dm-bg,.dm,.dm-m.neuf p,.dm-menu{animation:none}}`;
  const I0 = {
    retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    horloge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    envoyer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l2.2 7.1 8.4 1.3-8.4 1.3z"/></svg>',
    bulle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>'
  };
  // même jeu d'icônes que l'application (app/icones.js, Lucide), sinon les dessins ci-dessus
  const LUC = { retour: 'retour', x: 'fermer', plus: 'options', horloge: 'horloge', envoyer: 'envoyer', bulle: 'messages' };
  const I = {}; Object.keys(I0).forEach(k => { const L = window.MDGIco && window.MDGIco.corps(LUC[k]); I[k] = L ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + L + '</svg>' : I0[k]; });
  let bg = null, rendre = null, minuteur = 0;
  function feuille(html, label) {
    if (!document.getElementById('dmCss')) { const st = document.createElement('style'); st.id = 'dmCss'; st.textContent = CSS; document.head.appendChild(st); }
    fermer(true);
    bg = document.createElement('div'); bg.className = 'dm-bg';
    bg.innerHTML = `<div class="dm" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    document.body.appendChild(bg);
    if (!rendre) rendre = N() && N().piege ? N().piege(bg) : null;
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    bg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => fermer());
    document.addEventListener('keydown', touche);
    ajuster();
    return bg;
  }
  function fermer(garder) {
    clearInterval(minuteur); minuteur = 0; ouverte = null;
    if (bg) { bg.remove(); bg = null; }
    if (!garder) { document.removeEventListener('keydown', touche); if (rendre) { rendre(); rendre = null; } annoncer(); }
  }
  function touche(e) { if (e.key === 'Escape' && bg) { const m = bg.querySelector('.dm-menu'); if (m) m.remove(); else fermer(); } }
  // iPhone : la page ne rétrécit pas quand le clavier s'ouvre ; la feuille suit la zone visible pour garder le champ au-dessus du clavier
  function ajuster() {
    const vv = window.visualViewport; if (!bg || !vv || matchMedia('(min-width:720px)').matches) return;
    bg.style.top = vv.offsetTop + 'px'; bg.style.height = vv.height + 'px'; bg.style.bottom = 'auto';
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', ajuster); visualViewport.addEventListener('scroll', ajuster); }

  // ——— la boîte : toutes mes conversations ———
  function boite() {
    if (!N() || !N().session()) { N() && N().open('Connectez-vous pour voir vos messages.'); return; }
    const b = feuille(`<div class="dm-h"><h2 class="dm-t">Messages<small>Gardés 1 an · lisibles par l’équipe</small></h2><button type="button" class="dm-ib" data-x aria-label="Fermer">${I.x}</button></div><div class="dm-b"><div class="dm-act" data-act></div><div class="dm-l" data-l></div></div>`, 'Messages');
    const actions = () => { const z = b.querySelector('[data-act]'); if (!z) return;
      z.innerHTML = admin()
        ? `<button type="button" data-tous>${LOGO(34)}<span>Message à tous les membres<small>Au nom du Marché de Gros, avec le logo</small></span></button><a href="admin.html#messages">${I.bulle}<span>Toutes les conversations<small>Lire, alertes de sortie de l’application</small></span></a>`
        : `<button type="button" data-marche>${LOGO(34)}<span>Écrire au Marché de Gros<small>Une question, un problème, un vol : l’équipe vous répond ici</small></span></button>`;
      const t = z.querySelector('[data-tous]'); if (t) t.onclick = () => diffuser();
      const m = z.querySelector('[data-marche]'); if (m) m.onclick = () => ecrireMarche(); };
    actions(); N().isAdmin().then(() => { if (bg === b) actions(); });
    const dessiner = () => {
      const box = b.querySelector('[data-l]'); if (!box) return; const u = me();
      if (!liste.length) {
        box._h = '';
        box.innerHTML = `<div class="dm-vide">${window.MDGSac ? MDGSac.svg('vide', { t: 70 }) : I.bulle}<b>Aucune conversation</b>Touchez la photo d’un vendeur ou d’un acheteur, puis « Écrire ». Vous pouvez parler de tout, même sans acheter.${window.MDGRep ? '<br><button type="button" data-top>Voir les mieux notés</button>' : ''}</div>`;
        const t = box.querySelector('[data-top]'); if (t) t.onclick = () => { fermer(); MDGRep.classement(); };
        return;
      }
      // relu toutes les 15 s : rien n'est redessiné si rien n'a changé (sinon les avatars clignotent et rejouent leur animation)
      const html = liste.map(c => `<button type="button" class="dm-c${c.non_lu ? ' neuf' : ''}" data-id="${c.id}">${av(c.autre_id, c.autre_avatar, c.autre_nom, 46, c.officiel)}<b>${esc(c.autre_nom)}${c.officiel ? OFF : window.MDGStatut ? ' ' + MDGStatut.puces(c.autre_id, { max: 0, t: 14 }) : ''}</b><time>${quand(c.updated_at)}</time><small>${(() => { const st = !c.officiel && window.MDGCompte && MDGCompte.structure ? MDGCompte.structure(c.autre_id) : null; return st ? `<em class="dm-org-l">${esc(st.nom)} · </em>` : ''; })()}${c.dernier_par === u ? 'Vous : ' : ''}${esc(c.dernier_texte || '')}</small>${c.non_lu ? '<i aria-label="Non lu"></i>' : ''}</button>`).join('');
      if (box._h === html && box.firstChild) return; box._h = html;
      box.innerHTML = html;
      box.querySelectorAll('[data-id]').forEach(el => {
        el.onclick = () => conversation(el.dataset.id, true);
        if (window.MDGNegoce && MDGNegoce.glisser) MDGNegoce.glisser(el, async () => { await N().rpc('dm_masquer', { p_discussion: el.dataset.id }); liste = liste.filter(c => c.id !== el.dataset.id); W(KL, liste); annoncer(); N().toast('Conversation retirée de votre liste. Elle reviendra si la personne vous écrit.'); });
      });
    };
    dessiner();
    refresh().then(() => { if (bg === b) dessiner(); });
    clearInterval(minuteur); minuteur = setInterval(() => { if (!document.hidden && bg === b) refresh().then(() => { if (bg === b) dessiner(); }); }, 15000);
  }

  // ——— écrire à quelqu'un (depuis sa fiche, une annonce, une négociation) ———
  async function ecrire(uid, o = {}) {
    if (!uid) return;
    if (!N() || !N().session()) {
      N() && N().open('Connectez-vous pour écrire à ' + (o.nom || 'ce membre') + '.');
      const apres = () => { removeEventListener('mdg:connecte', apres); setTimeout(() => ecrire(uid, o), 500); };
      addEventListener('mdg:connecte', apres); return;
    }
    if (uid === me()) { N().toast('C’est votre propre compte.'); return; }
    try {
      const id = await N().rpc('dm_ouvrir', { p_autre: uid });
      conversation(id, false, { autre_id: uid, autre_nom: o.nom || 'Membre', autre_avatar: o.avatar || null, officiel: !!o.officiel });
    } catch (x) { N().toast(err(x)); }
  }

  // ——— écrire au Marché de Gros (un administrateur répond) ———
  // D'abord l'aide (v3/aide.js) : des réponses toutes prêtes ; « Je veux parler à une personne » mène ici. { direct: true } : la conversation tout de suite.
  async function ecrireMarche(o = {}) {
    if (!o.direct && window.MDGAide && !admin()) { MDGAide.ouvrir(o); return; }
    if (!N() || !N().session()) { N() && N().open('Connectez-vous pour écrire au Marché de Gros.'); return; }
    try { const uid = await N().rpc('contact_marche'); if (!uid) throw new Error('Aucun administrateur pour l’instant.'); if (uid === me()) { N().toast('Vous êtes l’administrateur : écrivez à un membre, ou à tous.'); return; } ecrire(uid, { nom: 'Marché de Gros', officiel: true }); }
    catch (x) { N().toast(/contact_marche|schema cache|Could not find/i.test(String(x.message)) ? 'Pas encore activé sur le serveur.' : err(x)); }
  }
  // « Je veux parler à une personne » (v3/aide.js) : la question part à l'équipe, qui reçoit la notification des messages (push_dm).
  // Seulement après le toucher « Envoyer à l'équipe ». Renvoie true si le message est parti.
  async function parlerPersonne(texte) {
    const t = String(texte || '').trim(); if (!t) return false;
    if (!N() || !N().session()) { N() && N().open('Connectez-vous pour écrire au Marché de Gros.'); return false; }
    try {
      const uid = await N().rpc('contact_marche'); if (!uid) throw new Error('Aucun administrateur pour l’instant.');
      if (uid === me()) { N().toast('Vous êtes l’administrateur : écrivez à un membre, ou à tous.'); return false; }
      const id = await N().rpc('dm_ouvrir', { p_autre: uid });
      await N().rpc('dm_envoyer', { p_discussion: id, p_texte: '🙋 Je veux parler à une personne.\n' + t });
      N().toast('Message envoyé : l’équipe vous répond ici.');
      conversation(id, false, { autre_id: uid, autre_nom: 'Marché de Gros', officiel: true });
      return true;
    } catch (x) { N().toast(/contact_marche|schema cache|Could not find/i.test(String(x.message)) ? 'Pas encore activé sur le serveur.' : err(x)); return false; }
  }
  // ——— l'administration écrit à tous les membres ———
  function diffuser() {
    if (!admin()) { N().toast('Réservé aux administrateurs.'); return; }
    const b = feuille(`<div class="dm-h"><button type="button" class="dm-ib" data-back aria-label="Retour aux messages">${I.retour}</button><h2 class="dm-t">Message à tous<small>Au nom du Marché de Gros</small></h2><button type="button" class="dm-ib" data-x aria-label="Fermer">${I.x}</button></div>
      <div class="dm-b"><div class="dm-dif"><div style="display:flex;align-items:center;gap:10px">${LOGO(40)}<b>Marché de Gros</b>${OFF}</div>
      <textarea maxlength="2000" placeholder="Bonjour, …" aria-label="Message à tous les membres"></textarea>
      <p>Chaque membre le reçoit dans ses messages, avec le logo, et une notification sur son téléphone. Il peut vous répondre.</p>
      <button type="button" class="go" disabled>Envoyer à tous les membres</button></div></div>`, 'Message à tous les membres');
    b.querySelector('[data-back]').onclick = () => boite();
    const ta = b.querySelector('textarea'), go = b.querySelector('.go');
    ta.oninput = () => { go.disabled = !ta.value.trim(); };
    go.onclick = async () => { const t = ta.value.trim(); if (!t || !await (window.MDGDemande ? MDGDemande.oui('Envoyer ce message à tous les membres ?', { ok: 'Envoyer à tous' }) : Promise.resolve(confirm('Envoyer ce message à tous les membres ?')))) return; go.disabled = true; go.textContent = 'Envoi…';
      try { const n = await N().rpc('admin_diffuser', { p_texte: t }); N().toast('Message envoyé à ' + n + ' membre' + (n > 1 ? 's' : '') + '.'); boite(); }
      catch (x) { go.disabled = false; go.textContent = 'Envoyer à tous les membres'; N().toast(err(x)); } };
    setTimeout(() => ta.focus(), 200);
  }

  // ——— une conversation ———
  async function conversation(id, depuisBoite, meta) {
    if (!id || !N() || !N().session()) return;
    if (window.MDGActivite) MDGActivite.noter('dm', id);   // pour « Reprendre » dans Accueil → Activité
    let c = liste.find(x => x.id === id) || Object.assign({ id, bloque: false, je_bloque: false }, meta || {});
    if (!c.autre_id) { await refresh(); c = liste.find(x => x.id === id) || c; }
    const u = me(); ouverte = id;
    const b = feuille(`<div class="dm-h">${depuisBoite ? `<button type="button" class="dm-ib" data-back aria-label="Retour aux messages">${I.retour}</button>` : ''}
      <button type="button" class="dm-qui" data-profil aria-label="${c.officiel ? 'Marché de Gros' : 'Voir le profil de ' + esc(c.autre_nom)}">${av(c.autre_id, c.autre_avatar, c.autre_nom, 40, c.officiel)}<span><b>${esc(c.autre_nom || 'Membre')}${c.officiel ? OFF : window.MDGStatut ? ' ' + MDGStatut.puces(c.autre_id, { max: 0, t: 15 }) : ''}</b>${!c.officiel && window.MDGCompte && MDGCompte.puceStructure ? `<span class="dm-org">${MDGCompte.puceStructure(c.autre_id)}</span>` : ''}<small data-rep>${c.officiel ? 'L’équipe du Marché de Gros' : window.MDGStatut && MDGStatut.liste(c.autre_id).length ? MDGStatut.puces(c.autre_id, { max: 2, sceau: false }) : 'Voir son profil'}</small></span></button>
      <button type="button" class="dm-ib" data-plus aria-label="Plus d’options" aria-haspopup="menu">${I.plus}</button><button type="button" class="dm-ib" data-x aria-label="Fermer">${I.x}</button></div>
      <div class="dm-b" data-b aria-live="polite"><div class="dm-info">${I.horloge}Les échanges ne sont pas secrets : l’équipe du Marché de Gros peut les lire pour vérifier un accord ou régler un litige. Ils sont gardés 1 an. Restez ici : les numéros sont masqués.</div>${!c.officiel && window.MDGIdentite && MDGIdentite.gardePaiement ? `<div class="dm-garde" data-garde>${MDGIdentite.gardePaiement(c.autre_id, c.autre_nom)}</div>` : ''}<div data-msgs></div></div>
      <div class="dm-f" data-f></div>`, 'Conversation avec ' + (c.autre_nom || 'un membre'));
    const corps = b.querySelector('[data-b]'), zone = b.querySelector('[data-msgs]'), pied = b.querySelector('[data-f]');
    const garde = b.querySelector('[data-garde]');
    if (garde) { const maj = () => { if (!garde.isConnected) return removeEventListener('mdg:identite', maj); garde.innerHTML = MDGIdentite.gardePaiement(c.autre_id, c.autre_nom); }; addEventListener('mdg:identite', maj); }
    if (depuisBoite) b.querySelector('[data-back]').onclick = () => boite();
    b.querySelector('[data-profil]').onclick = () => { if (c.officiel) return; if (window.MDGRep) { fermer(); MDGRep.profil(c.autre_id, { nom: c.autre_nom, avatar: c.autre_avatar }); } };
    if (!c.officiel && window.MDGRep && MDGRep.charger) { const r = MDGRep.resume && MDGRep.resume(c.autre_id); if (r && r.n) b.querySelector('[data-rep]').innerHTML = (window.MDGStatut ? MDGStatut.puces(c.autre_id, { max: 1, sceau: false }) + ' ' : '') + MDGRep.texteNote(r) + ' · voir son profil'; }

    let msgs = [], attente = [];
    const enBas = () => corps.scrollHeight - corps.scrollTop - corps.clientHeight < 80;
    const descendre = () => { corps.scrollTop = corps.scrollHeight; };
    function dessiner(neufs) {
      const tout = msgs.concat(attente); let j = '', prec = null, h = '';
      tout.forEach(m => {
        const jj = jour(m.created_at); if (jj !== j) { j = jj; h += `<div class="dm-jour">${esc(jj)}</div>`; prec = null; }
        const moi = m.auteur_id === u, suite = prec && prec.auteur_id === m.auteur_id && Date.parse(m.created_at) - Date.parse(prec.created_at) < 3e5;
        const etat = m._etat === 'envoi' ? 'Envoi…' : m._etat === 'rate' ? 'Non envoyé · toucher pour réessayer' : heure(m.created_at);
        h += `<div class="dm-m${moi ? ' me' : ''}${suite ? ' suite' : ''}${m._etat ? ' ' + m._etat : ''}${neufs && neufs.has(m.id) ? ' neuf' : ''}" data-m="${m.id}"${m._etat === 'rate' ? ' role="button" tabindex="0"' : ''}><p>${(c.officiel && !moi) || (moi && admin()) ? lienOff(m.texte) : esc(m.texte)}<time title="Gardé encore ${reste(m.created_at)}">${etat}</time></p></div>`;
        prec = m;
      });
      zone.innerHTML = h || `<div class="dm-vide" style="padding:30px 10px">${window.MDGSac ? MDGSac.svg('vide', { t: 60 }) : I.bulle}<b>Dites bonjour</b>Présentez-vous et dites ce que vous cherchez ou proposez.</div>`;
      zone.querySelectorAll('.dm-m.rate').forEach(el => { el.onclick = () => { const m = attente.find(x => x.id === el.dataset.m); if (m) partir(m); }; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.onclick(); } }; });
    }
    async function charger(premiere) {
      const apres = msgs.length ? msgs[msgs.length - 1].created_at : null;
      let r; try { r = await N().rpc('dm_messages', { p_discussion: id, p_apres: apres }) || []; } catch (x) { if (premiere) zone.innerHTML = `<div class="dm-vide" style="padding:30px 10px">${window.MDGSac ? MDGSac.svg('triste', { t: 60 }) : ''}<b>Impossible de charger</b>${esc(err(x))}</div>`; return; }
      if (bg !== b) return;
      const deja = new Set(msgs.map(m => m.id)), neufs = r.filter(m => !deja.has(m.id));
      if (!neufs.length && !premiere) return;
      const bas = premiere || enBas();
      msgs = msgs.concat(neufs);
      dessiner(premiere ? null : new Set(neufs.map(m => m.id)));
      if (bas) descendre();
      if (neufs.some(m => m.auteur_id !== u) || premiere) { N().rpc('dm_lu', { p_discussion: id }).catch(() => {}); const l = liste.find(x => x.id === id); if (l && l.non_lu) { l.non_lu = false; W(KL, liste); } annoncer(); }
    }
    async function partir(m) {
      m._etat = 'envoi'; dessiner(); descendre();
      try {
        const r = await N().rpc('dm_envoyer', { p_discussion: id, p_texte: m.texte });
        attente = attente.filter(x => x !== m);
        if (!msgs.some(x => x.id === r.id)) msgs.push(r);
        const l = liste.find(x => x.id === id);
        if (l) Object.assign(l, { dernier_texte: r.texte.slice(0, 140), dernier_par: u, updated_at: r.created_at }); else liste.unshift(Object.assign({}, c, { dernier_texte: r.texte, dernier_par: u, updated_at: r.created_at, non_lu: false }));
        liste.sort((a, z) => Date.parse(z.updated_at) - Date.parse(a.updated_at)); W(KL, liste);
      } catch (x) {
        m._etat = 'rate'; N().toast(err(x));
        if (/BLOQUE/.test(String(x.message))) { attente = attente.filter(y => y !== m); c.bloque = true; piedDe(); }
      }
      if (bg === b) { dessiner(); descendre(); }
    }
    function piedDe() {
      if (c.je_bloque) { pied.innerHTML = `<div class="dm-stop"><span>Vous avez bloqué ${esc(c.autre_nom)}.</span><button type="button" data-deb>Débloquer</button></div>`; pied.querySelector('[data-deb]').onclick = () => bloquer(false); return; }
      if (c.bloque) { pied.innerHTML = `<div class="dm-stop"><span>Vous ne pouvez plus écrire à cette personne.</span></div>`; return; }
      pied.innerHTML = `<textarea rows="1" maxlength="2000" placeholder="Écrire un message" aria-label="Votre message à ${esc(c.autre_nom)}" enterkeyhint="send"></textarea><button type="button" class="dm-env" aria-label="Envoyer" disabled>${I.envoyer}</button>`;
      const ta = pied.querySelector('textarea'), go = pied.querySelector('.dm-env');
      const grandir = () => { ta.style.height = 'auto'; ta.style.height = Math.min(132, ta.scrollHeight + 2) + 'px'; go.disabled = !ta.value.trim(); };
      const envoyer = () => { const t = ta.value.trim(); if (!t) return;
        // pas de lien, d'e-mail ni de code (supabase/schema-22) : on le dit avant l'envoi, le texte reste dans la case pour être corrigé
        const refus = N().texteRefus ? N().texteRefus(t) : ''; if (refus) { N().toast(refus); ta.focus(); return; }
        ta.value = ''; grandir(); const sg = pied.querySelector('.dm-sug'); if (sg && sg._remplir) sg._remplir(); const m = { id: 'tmp-' + Date.now(), created_at: new Date().toISOString(), auteur_id: u, texte: t }; attente.push(m); partir(m); ta.focus(); };
      ta.addEventListener('input', grandir);
      // avec le Marché de Gros : une rangée d'aide toujours visible au-dessus de la case (v3/aide.js).
      // Case vide : « Aide » + les questions les plus posées ; pendant qu'on écrit : les réponses toutes prêtes qui correspondent.
      if (c.officiel && !admin() && window.MDGAide) { let tSug = 0; const sug = document.createElement('div'); sug.className = 'dm-sug'; pied.prepend(sug);
        const bouton = (x, cls) => `<button type="button"${cls ? ' class="' + cls + '"' : ''} data-q="${x.id}">${esc(x.q)}</button>`;
        const remplir = () => { const v = ta.value.trim(), r = v.length >= 3 ? MDGAide.chercher(v, 4) : [];
          sug.innerHTML = '<button type="button" class="dm-sug-aide" data-aide>💡 Aide</button>' + (r.length ? r.map(x => bouton(x, 'trouve')).join('') : (MDGAide.frequentes ? MDGAide.frequentes(4) : []).map(x => bouton(x)).join(''));
          sug.setAttribute('aria-label', r.length ? 'Réponses toutes prêtes' : 'Questions fréquentes'); sug.scrollLeft = 0;
          sug.querySelector('[data-aide]').onclick = () => MDGAide.ouvrir({ q: ta.value.trim() });
          sug.querySelectorAll('[data-q]').forEach(bt => bt.onclick = () => MDGAide.ouvrir({ id: bt.dataset.q })); };
        sug.setAttribute('role', 'group'); remplir(); sug._remplir = remplir;
        ta.addEventListener('input', () => { clearTimeout(tSug); tSug = setTimeout(remplir, 200); }); }
      // ordinateur : Entrée envoie, Maj+Entrée va à la ligne ; téléphone : le bouton envoie (Entrée va à la ligne)
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover) and (pointer:fine)').matches) { e.preventDefault(); envoyer(); } });
      go.onclick = envoyer;
      ta.addEventListener('focus', () => setTimeout(() => { ajuster(); descendre(); }, 300));
    }
    async function bloquer(oui) {
      try { await N().rpc('dm_bloquer', { p_autre: c.autre_id, p_oui: oui }); c.je_bloque = oui; c.bloque = oui; const l = liste.find(x => x.id === id); if (l) Object.assign(l, { je_bloque: oui, bloque: oui }); W(KL, liste);
        N().toast(oui ? c.autre_nom + ' ne peut plus vous écrire.' : c.autre_nom + ' peut de nouveau vous écrire.'); piedDe();
        if (!oui) refresh().then(() => { const l2 = liste.find(x => x.id === id); if (l2) { c.bloque = l2.bloque; c.je_bloque = l2.je_bloque; piedDe(); } });
      } catch (x) { N().toast(err(x)); }
    }
    b.querySelector('[data-plus]').onclick = e => {
      e.stopPropagation(); const vieux = b.querySelector('.dm-menu'); if (vieux) { vieux.remove(); return; }
      const m = document.createElement('div'); m.className = 'dm-menu'; m.setAttribute('role', 'menu');
      m.innerHTML = c.officiel ? '<button type="button" role="menuitem" data-a="retirer">Retirer de ma liste</button>' : `${window.MDGRep ? '<button type="button" role="menuitem" data-a="profil">Voir son profil et sa note</button>' : ''}<button type="button" role="menuitem" data-a="retirer">Retirer de ma liste</button>${window.MDGIdentite && MDGIdentite.signaler ? '<button type="button" role="menuitem" class="rouge" data-a="signaler">Signaler cette personne</button>' : ''}<button type="button" role="menuitem" class="rouge" data-a="bloquer">${c.je_bloque ? 'Débloquer' : 'Bloquer'} ${esc(c.autre_nom)}</button>`;
      b.querySelector('.dm').appendChild(m); m.querySelector('button').focus();
      const loin = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', loin, true); } }; setTimeout(() => document.addEventListener('click', loin, true), 0);
      m.onclick = async ev => { const a = ev.target.closest('[data-a]'); if (!a) return; m.remove();
        if (a.dataset.a === 'profil') b.querySelector('[data-profil]').click();
        else if (a.dataset.a === 'retirer') { try { await N().rpc('dm_masquer', { p_discussion: id }); liste = liste.filter(x => x.id !== id); W(KL, liste); N().toast('Conversation retirée de votre liste. Elle reviendra si la personne vous écrit.'); depuisBoite ? boite() : fermer(); } catch (x) { N().toast(err(x)); } }
        else if (a.dataset.a === 'signaler') MDGIdentite.signaler(c.autre_id, { nom: c.autre_nom, source: 'dm', ref: id, bloquer: c.je_bloque ? null : () => bloquer(true) });
        else if (a.dataset.a === 'bloquer') { if (c.je_bloque) bloquer(false); else (window.MDGDemande ? MDGDemande.oui('Bloquer ' + c.autre_nom + ' ? Vous ne pourrez plus vous écrire, ni l’un ni l’autre, tant que vous ne le débloquez pas.', { ok: 'Bloquer', danger: true }) : Promise.resolve(confirm('Bloquer ' + c.autre_nom + ' ? Vous ne pourrez plus vous écrire, ni l’un ni l’autre, tant que vous ne le débloquez pas.'))).then(v => { if (v) bloquer(true); }); } };
    };
    piedDe(); dessiner(); zone.innerHTML = window.MDGSac ? MDGSac.charge('Vos messages arrivent…') : '<div class="dm-vide" style="padding:30px 10px">Chargement…</div>';
    await charger(true);
    clearInterval(minuteur); minuteur = setInterval(() => { if (!document.hidden && navigator.onLine && bg === b) charger(false); }, 4000);
    const ta = pied.querySelector('textarea'); if (ta && matchMedia('(hover:hover) and (pointer:fine)').matches) ta.focus();
  }

  // toucher une notification : ouvrir la conversation
  function depuisAdresse() {
    const m = location.hash.match(/[?&]dm=([0-9a-f-]{36})/); if (!m) return;
    try { history.replaceState(history.state, '', location.hash.replace(/[?&]dm=[0-9a-f-]{36}/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = k => { if (N() && N().session()) conversation(m[1]); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-dm' && e.data.dm) conversation(e.data.dm); });

  // Accueil → Activité : les conversations avec des messages non lus (et, pour « Reprendre », une conversation précise)
  const ligneAct = c => ({ k: 'dm', id: c.id, titre: c.autre_nom || 'Conversation', avec: c.autre_nom || '', etat: c.non_lu ? 'moi' : 'attente',
    tag: c.non_lu ? 'Nouveau message' : 'Conversation', apercu: String(c.dernier_texte || '').slice(0, 70), ts: Date.parse(c.updated_at) || 0, ouvrir: () => conversation(c.id) });
  const activite = () => liste.filter(c => c.non_lu && c.id !== ouverte).map(ligneAct);
  const trouverAct = id => { const c = liste.find(x => x.id === id); return c ? ligneAct(c) : null; };
  window.MDGMessages = { boite, ecrire, ecrireMarche, parlerPersonne, diffuser, conversation, unread, unreadDepuis, refresh, JOURS, activite, trouverAct };
  addEventListener('mdg:connecte', () => { premier = true; setTimeout(refresh, 1200); });
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte' && !(N() && N().session())) { liste = []; W(KL, []); fermer(); annoncer(); } });
  addEventListener('hashchange', depuisAdresse);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', depuisAdresse); else depuisAdresse();
  setTimeout(refresh, 2500);
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
})();
