/* ═════════ Marché de Gros CI — messagerie directe ═════════
   Écrire à un vendeur, un acheteur ou n'importe quel membre, sans annonce et sans quitter l'application.
   Chaque message est gardé 1 an (schéma 60) : l'équipe du Marché de Gros peut lire les échanges (décision du propriétaire, 25/10/2026) ; on peut bloquer quelqu'un.
   Serveur : supabase/schema-8.sql (dm_ouvrir, dm_envoyer, dm_liste, dm_messages, dm_lu, dm_masquer, dm_bloquer) ;
   notification sur le téléphone : fonction Edge « pousser » (déclencheur push_dm).
   Les administrateurs écrivent au nom du « Marché de Gros » (logo, mention Officiel) ; chacun peut écrire au Marché de Gros ;
   un administrateur peut écrire à tous les membres d'un coup (supabase/schema-10-admin-messages.sql).
   Un numéro écrit dans un message est masqué par le serveur et signalé aux administrateurs : les échanges restent ici.
   API : MDGMessages.boite() · ecrire(uid, { nom, avatar }) · ecrireMarche({ direct }) (d'abord l'aide, v3/aide.js) · parlerPersonne(texte) · diffuser() · conversation(id) · unread() · refresh()
   Événement : mdg:dm { unread } quand le nombre de conversations à lire change. */
(function () {
  'use strict';
  const JOURS = 365;  // = dm_duree() (schéma 60 : gardés 1 an, l'équipe peut les lire)
  const KL = 'mdg-dm:liste';
  const N = () => window.MDGNuage;
  const TI = n => window.MDGIco ? '<span class="ic-t" aria-hidden="true">' + MDGIco.svg(n, 17, 1.9) + '</span>' : '';   // petite icône dessinée devant un texte (plus d'emoji)
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  const OFF = '<span class="dm-off">Officiel</span>';
  const admin = () => { try { return JSON.parse(localStorage.getItem('mdg-nuage:admin')) === true; } catch (_) { return false; } };
  // seul le Marché de Gros officiel peut écrire des liens (supabase/schema-22) : dans ses messages, ils deviennent cliquables
  const lienOff = t => esc(t).replace(/\b(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, u => { const h = /^https?:/i.test(u) ? u : 'https://' + u; return /^https?:\/\/[^\s"'<>]+$/i.test(h) ? `<a href="${h}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${u}</a>` : u; });
  // maquette : initiales dans un rond (plus d'avatars dessinés) ; le Marché de Gros : son logo carré
  const initiales = n => { const m = String(n || '').trim().split(/\s+/).filter(Boolean); return esc(((m[0] || '?')[0] + (m.length > 1 ? m[m.length - 1][0] : (m[0] || '').slice(1, 2))).toUpperCase()); };
  const rond = (nom, t, officiel) => officiel ? `<img class="dm-logo" src="logo/marque.svg" width="${t}" height="${t}" alt="" style="border-radius:${Math.round(t * .3)}px">`
    : `<span class="dm-ini" aria-hidden="true" style="width:${t}px;height:${t}px;font-size:${t >= 46 ? 13.5 : 13}px">${initiales(nom)}</span>`;
  const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jour = t => { const d = new Date(t), a = new Date(); a.setHours(0, 0, 0, 0); const j = Math.round((a - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    return j <= 0 ? 'Aujourd’hui' : j === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const quand = t => { const d = new Date(t), j = (Date.now() - d) / 864e5; return j < 1 && d.getDate() === new Date().getDate() ? heure(t) : j < 2 ? 'hier' : d.toLocaleDateString('fr-FR', { weekday: 'short' }); };
  const reste = t => { const h = Math.max(0, (Date.parse(t) + JOURS * 864e5 - Date.now()) / 36e5); return h < 1 ? 'moins d’une heure' : h < 24 ? Math.round(h) + ' h' : Math.round(h / 24) + ' j'; };
  const err = x => { const m = String(x && x.message || x || ''); return /BLOQUE/.test(m) ? 'Vous ne pouvez plus écrire à cette personne.' : /TROP_VITE/.test(m) ? 'Trop de messages d’un coup. Attendez une minute.'
    : /Failed to fetch|NetworkError/i.test(m) ? 'Pas de réseau. Le message n’est pas parti.' : /dm_|schema cache|Could not find/i.test(m) ? 'La messagerie n’est pas encore activée sur le serveur.' : (window.MDGErreur ? MDGErreur(x) : (m || 'Une erreur est survenue.')); };

  // ——— messages pas encore partis (schéma 96c) ———
  // Chaque message reçoit sur le téléphone un identifiant unique (cid) et attend dans une file gardée sur l'appareil tant que le
  // serveur ne l'a pas reçu : une coupure de réseau ne le perd pas, et un nouvel essai après une réponse perdue ne crée pas de
  // doublon (le serveur rend le message déjà arrivé).
  const KF = 'mdg-dm:file';
  const cidNeuf = () => ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const fileLire = () => J(KF, []).filter(m => m && m.cid && m.disc && m.texte);
  const fileEcrire = L => W(KF, L.slice(-100));
  const fileRetirer = cid => fileEcrire(fileLire().filter(m => m.cid !== cid));
  // refus du serveur (bloqué, texte refusé, conversation introuvable…) : le message ne repart pas tout seul ; réseau, panne, « trop vite » : il repart
  const definitif = x => !!x && (x.code === 'texte' || (x.status >= 400 && x.status < 500 && x.code !== 'auth' && !/TROP_VITE/.test(String(x.message))));
  async function expedier(m) {
    let r;
    try { r = await N().rpc('dm_envoyer', { p_discussion: m.disc, p_texte: m.texte, p_client: m.cid }); }
    catch (x) {   // serveur sans le schéma 96c : envoi comme avant, sans identifiant
      if ((x.status === 404 || x.status === 400) && /dm_envoyer|schema cache|Could not find|p_client/i.test(String(x.message))) r = await N().rpc('dm_envoyer', { p_discussion: m.disc, p_texte: m.texte });
      else throw x;
    }
    fileRetirer(m.cid); return r;
  }
  let vidage = false;
  async function vider() {
    if (vidage || !navigator.onLine || !N() || !N().session()) return; vidage = true;
    try {
      const u = me();
      for (const m of fileLire().filter(x => x.auteur_id === u)) {
        try { const r = await expedier(m); dispatchEvent(new CustomEvent('mdg:dm-parti', { detail: { cid: m.cid, disc: m.disc, r } })); }
        catch (x) { if (definitif(x)) { fileRetirer(m.cid); dispatchEvent(new CustomEvent('mdg:dm-refuse', { detail: { cid: m.cid, disc: m.disc } })); N().toast(err(x)); } else break; }
      }
    } finally { vidage = false; }
  }

  // la liste des conversations (gardée sur l'appareil pour s'afficher tout de suite)
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

  // feuille plein écran (lot 10 de la refonte, maquette « MGCI App v2 ») : page papier, clair ou sombre selon le thème.
  // Les couleurs sont posées ici (mêmes valeurs que css/mgci-tokens.css et css/sombre.css) : le module marche aussi sur le site.
  const CSS = `.dm-bg{position:fixed;inset:0;z-index:9200;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;animation:dmIn .2s ease both}
.dm{--papier:#F2EBDD;--carte:#FAF4E9;--champ:#FFFAF3;--lin:#E7DCC8;--encre:#171512;--texte-2:#484236;--texte-3:#655C4D;--mute:#6F6553;--vert:#10392B;--action-t:#F3EFE4;--hausse:#B23C24;
--barre:rgba(250,244,233,.94);--t08:rgba(23,21,18,.08);--t14:rgba(23,21,18,.14);--heure-moi:#C5CFC4;--garde:#F6E2B0;--garde-t:#5B4300;--menu:#FFFDF8;--ombre-menu:0 14px 34px rgba(23,21,18,.18),0 2px 6px rgba(23,21,18,.08);
position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:100%;background:var(--papier);color:var(--encre);font:400 15px/1.45 Jost,sans-serif;animation:dmUp .38s cubic-bezier(.22,1,.36,1) both;overflow:hidden}
html[data-theme=sombre] .dm{--papier:#14120F;--carte:#1F1B16;--champ:#25211B;--lin:#2C2720;--encre:#F3EFE4;--texte-2:#DDD3C2;--texte-3:#BFB39E;--mute:#A89C88;--vert:#F2C230;--action-t:#171512;--hausse:#F3A08C;
--barre:rgba(31,27,22,.94);--t08:rgba(243,239,228,.08);--t14:rgba(243,239,228,.14);--heure-moi:#4A3A0A;--garde:#2E2614;--garde-t:#F2D57A;--menu:#25211B;--ombre-menu:0 14px 34px rgba(0,0,0,.5);color-scheme:dark}
.dm-bg.dm-sans,.dm-bg.dm-sans .dm{animation:none}
@media (min-width:720px){.dm-bg{align-items:center;padding:24px}.dm{height:min(760px,92dvh);border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.55)}}
.dm ::selection{background:rgba(242,194,48,.45)}
.dm-h{flex:none;display:flex;align-items:center;gap:6px;padding:calc(8px + env(safe-area-inset-top)) 12px 6px 5px}
.dm-h.bas{padding-bottom:8px}
.dm-ib{flex:none;position:relative;width:44px;height:44px;border:0;border-radius:50%;background:none;color:var(--encre);display:grid;place-items:center;cursor:pointer;padding:0}
.dm-ib svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dm-ret{display:flex;align-items:center;min-height:44px;border:0;background:none;padding:0 10px 0 0;color:var(--texte-3);font:400 14px Jost,sans-serif;cursor:pointer}
.dm-ret svg{width:22px;height:22px;margin:0 0 0 11px;fill:none;stroke:var(--encre);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dm-ret span{margin-left:11px}
.dm button:focus-visible,.dm a:focus-visible,.dm textarea:focus-visible,.dm [tabindex]:focus-visible{outline:2px solid var(--vert);outline-offset:2px}
.dm-qui{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:0;background:none;color:inherit;text-align:left;padding:2px 4px;border-radius:14px;cursor:pointer;font:inherit;min-height:44px}
.dm-qui>span:last-child{min-width:0;display:flex;flex-direction:column}
.dm-qui b{display:flex;align-items:center;gap:6px;min-width:0;font-weight:700;font-size:16px;line-height:1.25}.dm-qui b .nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-qui small{display:block;color:var(--texte-3);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-qui small:empty{display:none}
.dm-ini{flex:none;display:grid;place-items:center;border-radius:999px;background:var(--lin);color:var(--texte-2);font-weight:700;letter-spacing:.01em}
.dm-logo{flex:none;display:block}.dm-ini svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.dm-tete{padding:0 16px 6px}
.dm-tete h2{margin:6px 0 0;font:600 32px/1.05 Jost,sans-serif;letter-spacing:-.015em}
.dm-tete p{margin:6px 0 0;color:var(--texte-3);font-size:13.5px}
.dm-b{flex:1;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:8px 16px 24px;-webkit-overflow-scrolling:touch}
.dm-conv .dm-b{display:flex;flex-direction:column;padding:10px 16px 18px}
/* la liste finit au-dessus de la barre d'onglets du bas (« Activité » allumé) ; la conversation la couvre (maquette) */
.dm-bg.liste{bottom:var(--barre-h, 0px)}
.dm-info{align-self:center;max-width:310px;margin:0 auto 10px;padding:8px 12px;border-radius:12px;background:var(--lin);color:var(--texte-2);font-size:12.5px;line-height:1.4;text-align:center}
.dm-garde{align-self:center;max-width:340px;margin:0 auto 10px;padding:9px 12px;border-radius:12px;background:var(--garde);color:var(--garde-t);font-size:12.5px;line-height:1.45;text-align:center}
.dm-jour{margin:14px 0 6px;text-align:center;color:var(--mute);font-size:12px;font-weight:600;text-transform:capitalize}
.dm-m{display:flex;margin:5px 0}.dm-m.me{justify-content:flex-end}.dm-m.suite{margin-top:2px}
.dm-m p{max-width:80%;margin:0;padding:10px 14px;border-radius:18px;background:var(--carte);color:var(--encre);white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.4}
.dm-m.me p{background:var(--vert);color:var(--action-t)}
.dm-m time{display:block;margin-top:2px;text-align:right;font-size:11.5px;color:var(--mute);font-variant-numeric:tabular-nums}.dm-m.me time{color:var(--heure-moi)}
/* maquette : pas d'heure sous chaque bulle (gardée pour les lecteurs d'écran) ; seul l'état d'un message pas encore parti se voit */
.dm-m:not(.rate):not(.file):not(.envoi) time{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.dm-m.envoi p{opacity:.75}
.dm-m.me.rate p{background:var(--carte);color:var(--encre);box-shadow:inset 0 0 0 1.5px var(--hausse)}.dm-m.me.rate time{color:var(--hausse);font-weight:600}.dm-m.rate,.dm-m.file{cursor:pointer}
.dm-m.file time{font-weight:600}
.dm-m.neuf p{animation:dmPop .28s cubic-bezier(.22,1,.36,1) both}
.dm-f{flex:none;display:flex;align-items:flex-end;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--t08);background:var(--barre);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.dm-f textarea{flex:1;min-width:0;min-height:44px;max-height:132px;margin:0;padding:10px 16px;border:1px solid var(--t14);border-radius:22px;background:var(--champ);color:var(--encre);font:400 16px/1.35 Jost,sans-serif;resize:none;box-sizing:border-box;caret-color:var(--vert)}
.dm-f textarea::placeholder{color:var(--mute)}
.dm-f textarea:focus{outline:none;border-color:var(--vert)}
.dm-env{flex:none;width:44px;height:44px;border:0;border-radius:999px;background:var(--vert);color:var(--action-t);display:grid;place-items:center;cursor:pointer;transition:transform .15s;padding:0}
.dm-env svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.dm-env:disabled{cursor:default}.dm-env:not(:disabled):active{transform:scale(.92)}
.dm-stop{flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;color:var(--texte-3);font-size:14px}
.dm-stop button{flex:none;min-height:44px;padding:0 16px;border:1.5px solid var(--vert);border-radius:999px;background:none;color:var(--vert);font:700 14px Jost,sans-serif;cursor:pointer}
.dm .dm-f:has(.dm-sug){flex-wrap:wrap}
.dm .dm-sug{margin:0 -12px 2px;padding:0 12px 2px}
.dm .dm-sug button{min-height:44px;border:1px solid var(--t14);border-radius:999px;background:var(--carte);color:var(--encre);font:600 13.5px/1.2 Jost,sans-serif}
.dm .dm-sug button.trouve{border-color:var(--vert)}
.dm .dm-sug .dm-sug-aide{background:var(--vert);border-color:var(--vert);color:var(--action-t)}
.dm-menu{position:absolute;right:10px;top:calc(56px + env(safe-area-inset-top));z-index:3;min-width:220px;max-width:calc(100% - 20px);padding:6px;border-radius:18px;background:var(--menu);border:1px solid var(--t08);box-shadow:var(--ombre-menu);animation:dmPop .2s ease both}
.dm-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:46px;padding:0 12px;border:0;border-radius:12px;background:none;color:var(--encre);font:500 15px Jost,sans-serif;text-align:left;cursor:pointer}
.dm-menu button:hover{background:var(--t08)}.dm-menu .rouge{color:var(--hausse)}
.dm-l{display:flex;flex-direction:column}
.dm-c{display:flex;align-items:center;gap:12px;width:100%;min-height:72px;padding:12px 0;border:0;border-bottom:1px solid var(--t08);background:var(--papier);color:var(--encre);text-align:left;font:inherit;cursor:pointer;text-decoration:none;box-sizing:border-box}
.dm-c .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dm-c .nm{display:flex;align-items:center;gap:6px;min-width:0;font-size:15px;font-weight:700;line-height:1.3}.dm-c .nm>span:first-child{min-width:0;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}.dm-c .nm>:not(:first-child){flex:none}
.dm-c .tx>small{color:var(--texte-3);font-size:13.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-c .md{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:5px;min-width:0}
.dm-c time{color:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}
.dm-c i{display:block;width:10px;height:10px;border-radius:50%;background:var(--vert)}
.dm-c>svg{flex:none;width:18px;height:18px;fill:none;stroke:var(--mute);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dm-c.neuf .tx>small{color:var(--encre);font-weight:600}.dm-c.neuf time{color:var(--encre);font-weight:600}
.dm-l .sw{border-radius:0}.dm-l .sw+.sw{margin-top:0}.dm-l .sw>.sw-row{background-color:var(--papier)!important}
.dm-off{flex:none;display:inline-block;padding:1px 7px;border-radius:999px;background:#10392B;color:#F2C230;font:700 11.5px/1.5 Jost,sans-serif}
.dm-org-l{font-style:normal;font-weight:600;color:var(--texte-2)}
.dm-org{display:flex;margin:2px 0 0;min-width:0}.dm-org:empty{display:none}
.dm-tous{display:block;margin:4px 0 0;padding:12px 0;min-height:44px;border:0;background:none;color:var(--vert);font:700 14px Jost,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.dm-dif{display:flex;flex-direction:column;gap:12px;padding:6px 0 0}
.dm-dif .qui{display:flex;align-items:center;gap:10px;font-weight:700}
.dm-dif textarea{min-height:160px;padding:14px 16px;border:1px solid var(--t14);border-radius:18px;background:var(--champ);color:var(--encre);font:400 16px/1.45 Jost,sans-serif;resize:vertical;caret-color:var(--vert)}
.dm-dif textarea:focus{outline:none;border-color:var(--vert)}
.dm-dif .go{min-height:52px;border:0;border-radius:999px;background:var(--vert);color:var(--action-t);font:700 15.5px Jost,sans-serif;cursor:pointer}.dm-dif .go:disabled{background:var(--lin);color:var(--mute);cursor:default}
.dm-dif p{margin:0;color:var(--texte-3);font-size:13.5px;line-height:1.5}
.dm-vide{padding:40px 8px;text-align:center;color:var(--texte-3);line-height:1.55;font-size:14px}.dm-vide>svg{width:54px;height:54px;margin:0 auto 14px;display:block;fill:none;stroke:var(--mute);stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.dm-vide svg.ms{width:auto;height:auto;fill:initial;stroke:none;margin:0 auto 12px}
.dm-vide b{display:block;margin:0 0 6px;font:600 20px/1.2 Jost,sans-serif;letter-spacing:-.015em;color:var(--encre)}
.dm-vide button{margin-top:16px;min-height:44px;padding:0 18px;border:1.5px solid var(--vert);border-radius:999px;background:none;color:var(--vert);font:700 14px Jost,sans-serif;cursor:pointer}
@keyframes dmIn{from{opacity:0}}@keyframes dmUp{from{transform:translateY(30px);opacity:0}}@keyframes dmPop{from{transform:scale(.94);opacity:0}}
@media (prefers-reduced-motion:reduce){.dm-bg,.dm,.dm-m.neuf p,.dm-menu{animation:none}}`;
  const I0 = {
    retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    horloge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    envoyer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l2.2 7.1 8.4 1.3-8.4 1.3z"/></svg>',
    bulle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
  };
  // même jeu d'icônes que l'application (app/icones.js, Lucide), sinon les dessins ci-dessus
  const LUC = { x: 'fermer', plus: 'options', horloge: 'horloge', envoyer: 'envoyer', bulle: 'messages' };
  const I = {}; Object.keys(I0).forEach(k => { const L = LUC[k] && window.MDGIco && window.MDGIco.corps(LUC[k]); I[k] = L ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + L + '</svg>' : I0[k]; });
  let bg = null, rendre = null, minuteur = 0;
  const cacheM = new Map();   // messages déjà lus pendant cette visite (en mémoire seulement)
  function feuille(html, label, cls) {
    if (!document.getElementById('dmCss')) { const st = document.createElement('style'); st.id = 'dmCss'; st.textContent = CSS; document.head.appendChild(st); }
    const deja = !!bg; fermer(true);
    // d'un écran des messages à l'autre : la page change sur place, sans rejouer l'entrée (pas de clignotement)
    bg = document.createElement('div'); bg.className = 'dm-bg' + (deja ? ' dm-sans' : '') + (cls ? '' : ' liste');
    bg.innerHTML = `<div class="dm${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    document.body.appendChild(bg);
    if (!rendre) rendre = N() && N().piege ? N().piege(bg) : null;
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    bg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => fermer());
    document.addEventListener('keydown', touche);
    ajuster();
    return bg;
  }
  function fermer(garder, parOnglet) {
    clearInterval(minuteur); minuteur = 0; ouverte = null;
    if (bg) { bg.remove(); bg = null; if (!garder && !parOnglet && window.MDGOnglets && MDGOnglets.cacher) try { MDGOnglets.cacher(); } catch (_) {} }
    if (!garder) { document.removeEventListener('keydown', touche); if (rendre) { rendre(); rendre = null; } annoncer(); }
  }
  function touche(e) { if (e.key === 'Escape' && bg) { const m = bg.querySelector('.dm-menu'); if (m) m.remove(); else fermer(); } }
  // iPhone : la page ne rétrécit pas quand le clavier s'ouvre ; la feuille suit la zone visible pour garder le champ au-dessus du clavier
  function ajuster() {
    const vv = window.visualViewport; if (!bg || !vv || matchMedia('(min-width:720px)').matches) return;
    const bh = bg.classList.contains('liste') ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barre-h')) || 0 : 0;
    bg.style.top = vv.offsetTop + 'px'; bg.style.height = Math.max(0, vv.height - bh) + 'px'; bg.style.bottom = 'auto';
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', ajuster); visualViewport.addEventListener('scroll', ajuster); }

  // les négociations en cours ou conclues (v3/negoce.js garde sa liste sur l'appareil) : en tête des messages, comme la maquette
  const KN = 'mdg-negoce:liste';
  const negos = () => { const u = me(); if (!u || !window.MDGNegoce) return [];
    return J(KN, []).filter(n => n && n.id && (n.auteur_id === u || n.proprio_id === u) && (n.statut === 'ouverte' || n.statut === 'conclue')).slice(0, 5); };
  const ligneNego = n => { const u = me(), lui = n.auteur_id === u ? n.proprio_id : n.auteur_id;
    const roleLui = (n.cible === 'offre') === (lui === n.proprio_id) ? 'Le vendeur' : 'L’acheteur';
    const connu = window.MDGCompte && MDGCompte.avatar ? MDGCompte.avatar(lui, { size: 46 }).nom : '', nom = connu || roleLui;
    const lu = u === n.auteur_id ? n.lu_auteur : n.lu_proprio, neuf = Date.parse(n.updated_at) > (Date.parse(lu) || 0) + 500;
    return `<button type="button" class="dm-c${neuf ? ' neuf' : ''}" data-nego="${esc(n.id)}">${connu || !window.MDGIco ? rond(nom, 46) : '<span class="dm-ini" aria-hidden="true" style="width:46px;height:46px">' + MDGIco.svg('negoce', 22, 1.8) + '</span>'}<span class="tx"><span class="nm"><span>${esc(nom)}</span></span><small>${n.statut === 'conclue' ? 'Accord conclu' : 'Négociation en cours'} · ${esc(n.produit || 'Annonce')}</small></span><span class="md"><time>${quand(n.updated_at)}</time>${neuf ? '<i aria-label="Non lu"></i>' : ''}</span>${I.chevron}</button>`; };

  // la boîte : toutes mes conversations (o.de : le nom de l'écran d'où l'on vient, écrit à côté de la flèche, ex. « Activité »)
  let deBoite = '';
  function boite(o = {}) {
    if (!N() || !N().session()) { N() && N().open('Connectez-vous pour voir vos messages.'); return; }
    if (o && o.de != null) deBoite = String(o.de);
    const b = feuille(`<div class="dm-h"><button type="button" class="dm-ret" data-x aria-label="${deBoite ? 'Retour à ' + esc(deBoite) : 'Retour'}">${I.retour}${deBoite ? `<span>${esc(deBoite)}</span>` : ''}</button></div>
      <div class="dm-b"><div class="dm-tete" style="padding:0 0 10px"><h2>Messages</h2><p>Gardés 1 an · lisibles par l’équipe</p></div><div class="dm-l" data-n></div><div class="dm-l" data-act></div><div class="dm-l" data-l></div></div>`, 'Messages');
    if (window.MDGOnglets && MDGOnglets.montrer) try { MDGOnglets.montrer('activite', () => fermer(false, true)); } catch (_) {}
    // « Écrire au Marché de Gros » seulement s'il n'y a pas déjà une conversation avec le Marché de Gros dans la liste ;
    // si elle est retirée, la ligne revient (demande du propriétaire, 24/10/2026 : pas de doublon). Rien n'est redessiné si rien ne change.
    const actions = () => { const z = b.querySelector('[data-act]'); if (!z) return;
      const html = admin()
        ? `<button type="button" class="dm-c" data-tous>${rond('', 46, true)}<span class="tx"><span class="nm"><span>Message à tous les membres</span></span><small>Au nom du Marché de Gros, avec le logo</small></span>${I.chevron}</button><a class="dm-c" href="admin.html#messages">${'<span class="dm-ini" aria-hidden="true" style="width:46px;height:46px">' + I.bulle + '</span>'}<span class="tx"><span class="nm"><span>Toutes les conversations</span></span><small>Lire, alertes de sortie de l’application</small></span>${I.chevron}</a>`
        : liste.some(c => c.officiel) ? ''
        : `<button type="button" class="dm-c" data-marche>${rond('', 46, true)}<span class="tx"><span class="nm"><span>Marché de Gros</span>${OFF}</span><small>Écrire à l’équipe : elle vous répond ici</small></span>${I.chevron}</button>`;
      if (z._h === html) return; z._h = html; z.innerHTML = html;
      const t = z.querySelector('[data-tous]'); if (t) t.onclick = () => diffuser();
      const m = z.querySelector('[data-marche]'); if (m) m.onclick = () => ecrireMarche(); };
    const negociations = () => { const z = b.querySelector('[data-n]'); if (!z) return;
      const html = negos().map(ligneNego).join('');
      if (z._h === html) return; z._h = html; z.innerHTML = html;
      z.querySelectorAll('[data-nego]').forEach(el => el.onclick = () => { const id = el.dataset.nego; fermer(); MDGNegoce.thread(id); }); };
    actions(); N().isAdmin().then(() => { if (bg === b) actions(); });
    const dessiner = () => {
      negociations(); actions();
      const box = b.querySelector('[data-l]'); if (!box) return; const u = me();
      if (!liste.length) {
        const vide = `<div class="dm-vide">${window.MDGSac ? MDGSac.svg('vide', { t: 70 }) : I.bulle}<b>Aucune conversation</b>Touchez la photo d’un vendeur ou d’un acheteur, puis « Écrire ». Vous pouvez parler de tout, même sans acheter.${window.MDGRep ? '<br><button type="button" data-top>Voir les mieux notés</button>' : ''}</div>`;
        if (box._h === vide) return; box._h = vide; box.innerHTML = vide;
        const t = box.querySelector('[data-top]'); if (t) t.onclick = () => { fermer(); MDGRep.classement(); };
        return;
      }
      // relu toutes les 15 s : rien n'est redessiné si rien n'a changé
      const html = liste.map(c => { const st = !c.officiel && window.MDGCompte && MDGCompte.structure ? MDGCompte.structure(c.autre_id) : null;
        return `<button type="button" class="dm-c${c.non_lu ? ' neuf' : ''}" data-id="${c.id}">${rond(c.autre_nom, 46, c.officiel)}<span class="tx"><span class="nm"><span>${esc(c.autre_nom)}</span>${c.officiel ? OFF : window.MDGStatut ? MDGStatut.puces(c.autre_id, { max: 0, t: 14 }) : ''}</span><small>${st ? `<em class="dm-org-l">${esc(st.nom)} · </em>` : ''}${c.dernier_par === u ? 'Vous : ' : ''}${esc(c.dernier_texte || '')}</small></span><span class="md"><time>${quand(c.updated_at)}</time>${c.non_lu ? '<i aria-label="Non lu"></i>' : ''}</span>${I.chevron}</button>`; }).join('');
      if (box._h === html && box.firstChild) return; box._h = html;
      box.innerHTML = html;
      box.querySelectorAll('[data-id]').forEach(el => {
        el.onclick = () => conversation(el.dataset.id, true);
        if (window.MDGNegoce && MDGNegoce.glisser) MDGNegoce.glisser(el, async () => { await N().rpc('dm_masquer', { p_discussion: el.dataset.id }); liste = liste.filter(c => c.id !== el.dataset.id); W(KL, liste); annoncer(); actions(); N().toast('Conversation retirée de votre liste. Elle reviendra si la personne vous écrit.'); });
      });
    };
    dessiner();
    refresh().then(() => { if (bg === b) dessiner(); });
    const surNego = () => { if (bg !== b) { removeEventListener('mdg:negoce', surNego); removeEventListener('mdg:activite', surNego); return; } negociations(); };
    addEventListener('mdg:negoce', surNego); addEventListener('mdg:activite', surNego);
    clearInterval(minuteur); minuteur = setInterval(() => { if (!document.hidden && bg === b) refresh().then(() => { if (bg === b) dessiner(); }); }, 15000);
  }

  // écrire à quelqu'un (depuis sa fiche, une annonce, une négociation)
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
      conversation(id, false, { autre_id: uid, autre_nom: o.nom || 'Membre', autre_avatar: o.avatar || null, officiel: !!o.officiel, vs: o.vs || null });
    } catch (x) { N().toast(err(x)); }
  }

  // écrire au Marché de Gros (un administrateur répond)
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
      await N().rpc('dm_envoyer', { p_discussion: id, p_texte: 'Je veux parler à une personne.\n' + t });
      N().toast('Message envoyé : l’équipe vous répond ici.');
      conversation(id, false, { autre_id: uid, autre_nom: 'Marché de Gros', officiel: true });
      return true;
    } catch (x) { N().toast(/contact_marche|schema cache|Could not find/i.test(String(x.message)) ? 'Pas encore activé sur le serveur.' : err(x)); return false; }
  }
  // l'administration écrit à tous les membres
  function diffuser() {
    if (!admin()) { N().toast('Réservé aux administrateurs.'); return; }
    const b = feuille(`<div class="dm-h"><button type="button" class="dm-ret" data-back aria-label="Retour à Messages">${I.retour}<span>Messages</span></button></div>
      <div class="dm-b"><div class="dm-tete" style="padding:0 0 10px"><h2>Message à tous</h2></div><div class="dm-dif"><div class="qui">${rond('', 40, true)}<span>Marché de Gros</span>${OFF}</div>
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

  // une conversation
  async function conversation(id, depuisBoite, meta) {
    if (!id || !N() || !N().session()) return;
    if (window.MDGActivite) MDGActivite.noter('dm', id);   // pour « Reprendre » dans Accueil → Activité
    let c = liste.find(x => x.id === id) || Object.assign({ id, bloque: false, je_bloque: false }, meta || {});
    const vsA = meta && meta.vs && meta.vs.city && window.MDGVilleSeule ? MDGVilleSeule.avertir(meta.vs.sens, meta.vs.city) : '';   // « Vente uniquement à Guiglo » (schéma 87)
    if (!c.autre_id) { await refresh(); c = liste.find(x => x.id === id) || c; }
    const u = me(); ouverte = id;
    const b = feuille(`<div class="dm-h bas"><button type="button" class="dm-ib" data-back aria-label="${depuisBoite ? 'Retour aux messages' : 'Retour'}">${I.retour}</button>
      <button type="button" class="dm-qui" data-profil aria-label="${c.officiel ? 'Marché de Gros' : 'Voir le profil de ' + esc(c.autre_nom)}">${rond(c.autre_nom, 40, c.officiel)}<span><b><span class="nm">${esc(c.autre_nom || 'Membre')}</span>${c.officiel ? OFF : window.MDGStatut ? MDGStatut.puces(c.autre_id, { max: 0, t: 15 }) : ''}</b>${!c.officiel && window.MDGCompte && MDGCompte.puceStructure ? `<span class="dm-org">${MDGCompte.puceStructure(c.autre_id)}</span>` : ''}<small data-rep>${!c.officiel && window.MDGStatut && MDGStatut.liste(c.autre_id).length ? MDGStatut.puces(c.autre_id, { max: 2, sceau: false }) : ''}</small></span></button>
      <button type="button" class="dm-ib" data-plus aria-label="Plus d’options" aria-haspopup="menu">${I.plus}</button></div>
      <div class="dm-b" data-b aria-live="polite"><div class="dm-info">Numéros et liens sont refusés. Messages lisibles par l’équipe, gardés 1 an.</div>${vsA}${!c.officiel && window.MDGIdentite && MDGIdentite.gardePaiement ? `<div class="dm-garde" data-garde>${MDGIdentite.gardePaiement(c.autre_id, c.autre_nom)}</div>` : ''}<div data-msgs></div></div>
      <div class="dm-f" data-f></div>`, 'Conversation avec ' + (c.autre_nom || 'un membre'), 'dm-conv');
    const corps = b.querySelector('[data-b]'), zone = b.querySelector('[data-msgs]'), pied = b.querySelector('[data-f]');
    const garde = b.querySelector('[data-garde]');
    if (garde) { const maj = () => { if (!garde.isConnected) return removeEventListener('mdg:identite', maj); garde.innerHTML = MDGIdentite.gardePaiement(c.autre_id, c.autre_nom); }; addEventListener('mdg:identite', maj); }
    b.querySelector('[data-back]').onclick = () => depuisBoite ? boite() : fermer();
    b.querySelector('[data-profil]').onclick = () => { if (c.officiel) return; if (window.MDGRep) { fermer(); MDGRep.profil(c.autre_id, { nom: c.autre_nom, avatar: c.autre_avatar }); } };
    if (!c.officiel && window.MDGRep && MDGRep.charger) { const r = MDGRep.resume && MDGRep.resume(c.autre_id); if (r && r.n) b.querySelector('[data-rep]').innerHTML = (window.MDGStatut ? MDGStatut.puces(c.autre_id, { max: 1, sceau: false }) + ' ' : '') + MDGRep.texteNote(r); }

    let msgs = (cacheM.get(id) || []).slice(), attente = fileLire().filter(x => x.disc === id && x.auteur_id === u).map(x => Object.assign({ id: 'tmp-' + x.cid, _etat: 'file' }, x));
    // envoyé depuis la file pendant que la conversation est ouverte (vider) : la bulle « en attente » devient le message du serveur
    const surParti = e => { if (!b.isConnected) return removeEventListener('mdg:dm-parti', surParti); const d = e.detail || {}; if (d.disc !== id) return;
      attente = attente.filter(x => x.cid !== d.cid); if (d.r && !msgs.some(x => x.id === d.r.id)) msgs.push(d.r); dessiner(); };
    const surRefus = e => { if (!b.isConnected) return removeEventListener('mdg:dm-refuse', surRefus); const d = e.detail || {}; const m = d.disc === id && attente.find(x => x.cid === d.cid); if (m) { m._etat = 'rate'; dessiner(); } };
    addEventListener('mdg:dm-parti', surParti); addEventListener('mdg:dm-refuse', surRefus);
    const enBas = () => corps.scrollHeight - corps.scrollTop - corps.clientHeight < 80;
    const descendre = () => { corps.scrollTop = corps.scrollHeight; };
    function dessiner(neufs) {
      const tout = msgs.concat(attente); let j = '', prec = null, h = '';
      tout.forEach(m => {
        const jj = jour(m.created_at); if (jj !== j) { j = jj; prec = null; }   // maquette : pas de séparateur « Hier / Aujourd'hui »
        const moi = m.auteur_id === u, suite = prec && prec.auteur_id === m.auteur_id && Date.parse(m.created_at) - Date.parse(prec.created_at) < 3e5;
        const etat = m._etat === 'envoi' ? 'Envoi…' : m._etat === 'rate' ? 'Non envoyé · toucher pour réessayer' : m._etat === 'file' ? 'Partira dès le retour du réseau' : heure(m.created_at);
        h += `<div class="dm-m${moi ? ' me' : ''}${suite ? ' suite' : ''}${m._etat ? ' ' + m._etat : ''}${neufs && neufs.has(m.id) ? ' neuf' : ''}" data-m="${m.id}"${m._etat === 'rate' || m._etat === 'file' ? ' role="button" tabindex="0"' : ''}><p>${(c.officiel && !moi) || (moi && admin()) ? lienOff(m.texte) : esc(m.texte)}<time title="Gardé encore ${reste(m.created_at)}">${etat}</time></p></div>`;
        prec = m;
      });
      const html = h || `<div class="dm-vide" style="padding:30px 10px">${window.MDGSac ? MDGSac.svg('vide', { t: 60 }) : I.bulle}<b>Dites bonjour</b>Présentez-vous et dites ce que vous cherchez ou proposez.</div>`;
      if (zone._h === html) return; zone._h = html; zone.innerHTML = html;
      zone.querySelectorAll('.dm-m.rate, .dm-m.file').forEach(el => { el.onclick = () => { const m = attente.find(x => x.id === el.dataset.m); if (m) partir(m); }; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.onclick(); } }; });
    }
    async function charger(premiere) {
      const apres = msgs.length ? msgs[msgs.length - 1].created_at : null;
      let r; try { r = await N().rpc('dm_messages', { p_discussion: id, p_apres: apres }) || []; } catch (x) { if (premiere && !msgs.length) zone._h = "", zone.innerHTML = `<div class="dm-vide" style="padding:30px 10px">${window.MDGSac ? MDGSac.svg('triste', { t: 60 }) : ''}<b>Impossible de charger</b>${esc(err(x))}</div>`; return; }
      if (bg !== b) return;
      const deja = new Set(msgs.map(m => m.id)), neufs = r.filter(m => !deja.has(m.id));
      if (!neufs.length && !premiere) return;
      const bas = premiere || enBas();
      msgs = msgs.concat(neufs); cacheM.set(id, msgs.slice(-300));
      dessiner(premiere ? null : new Set(neufs.map(m => m.id)));
      if (bas) descendre();
      if (neufs.some(m => m.auteur_id !== u) || premiere) { N().rpc('dm_lu', { p_discussion: id }).catch(() => {}); const l = liste.find(x => x.id === id); if (l && l.non_lu) { l.non_lu = false; W(KL, liste); } annoncer(); }
    }
    async function partir(m) {
      m._etat = 'envoi'; dessiner(); descendre();
      try {
        const r = await expedier(m);
        attente = attente.filter(x => x !== m && x.cid !== m.cid);
        if (!msgs.some(x => x.id === r.id)) msgs.push(r); cacheM.set(id, msgs.slice(-300));
        const l = liste.find(x => x.id === id);
        if (l) Object.assign(l, { dernier_texte: r.texte.slice(0, 140), dernier_par: u, updated_at: r.created_at }); else liste.unshift(Object.assign({}, c, { dernier_texte: r.texte, dernier_par: u, updated_at: r.created_at, non_lu: false }));
        liste.sort((a, z) => Date.parse(z.updated_at) - Date.parse(a.updated_at)); W(KL, liste);
      } catch (x) {
        if (definitif(x)) { fileRetirer(m.cid); m._etat = 'rate'; N().toast(err(x)); }
        else { m._etat = 'file'; N().toast(navigator.onLine ? err(x) + ' Il repartira tout seul.' : 'Pas de réseau. Le message partira dès son retour.'); }
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
        ta.value = ''; grandir(); const sg = pied.querySelector('.dm-sug'); if (sg && sg._remplir) sg._remplir(); const cid = cidNeuf(), m = { id: 'tmp-' + cid, cid, disc: id, created_at: new Date().toISOString(), auteur_id: u, texte: t };
        fileEcrire(fileLire().concat([{ cid, disc: id, created_at: m.created_at, auteur_id: u, texte: t }])); attente.push(m); partir(m); ta.focus(); };
      ta.addEventListener('input', grandir);
      // avec le Marché de Gros : une rangée d'aide toujours visible au-dessus de la case (v3/aide.js).
      // Case vide : « Aide » + les questions les plus posées ; pendant qu'on écrit : les réponses toutes prêtes qui correspondent.
      if (c.officiel && !admin() && window.MDGAide) { let tSug = 0; const sug = document.createElement('div'); sug.className = 'dm-sug'; pied.prepend(sug);
        const bouton = (x, cls) => `<button type="button"${cls ? ' class="' + cls + '"' : ''} data-q="${x.id}">${esc(x.q)}</button>`;
        const remplir = () => { const v = ta.value.trim(), r = v.length >= 3 ? MDGAide.chercher(v, 4) : [];
          sug.innerHTML = '<button type="button" class="dm-sug-aide" data-aide>' + TI('bouee') + 'Aide</button>' + (r.length ? r.map(x => bouton(x, 'trouve')).join('') : (MDGAide.frequentes ? MDGAide.frequentes(4) : []).map(x => bouton(x)).join(''));
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
    // déjà lue pendant cette visite : les messages sont là tout de suite, seuls les nouveaux arrivent ensuite
    piedDe(); if (msgs.length || attente.length) { dessiner(); descendre(); } else zone._h = "", zone.innerHTML = window.MDGSac ? MDGSac.charge('Vos messages arrivent…') : '<div class="dm-vide" style="padding:30px 10px">Chargement…</div>';
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
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte' && !(N() && N().session())) { liste = []; W(KL, []); cacheM.clear(); fermer(); annoncer(); } });
  addEventListener('hashchange', depuisAdresse);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', depuisAdresse); else depuisAdresse();
  setTimeout(refresh, 2500);
  setTimeout(vider, 3000);
  addEventListener('online', () => setTimeout(vider, 1500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) vider(); });
  setInterval(() => { if (!document.hidden && fileLire().length) vider(); }, 30000);
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
})();
