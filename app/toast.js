/* ═════════ Marché de Gros CI — l'îlot : une seule pastille vivante pour tout ce que l'application a à dire ═════════
   Au lieu d'empiler des bannières, une pilule sombre en bas de l'écran (dessin de la maquette, 14/11/2026) :
   • elle se TRANSFORME : un nouveau message prend la place du précédent, la pastille s'élargit ou se resserre en douceur ;
   • elle REGROUPE : trois annonces qui arrivent → « 3 nouvelles annonces », pas trois bannières ;
   • elle SUIT une action : « Envoi… » (le sac qui se remplit) devient « Envoyé » ou l'erreur, dans la même pastille ;
   • elle PROPOSE le bon geste : « Répondre », « Voir », « Annuler » ;
   • sobre : du texte seul, sans vignette ni point (le sens est porté par la phrase, le son et la vibration).
   Toucher : le geste proposé (ou fermer). Glisser vers le bas : fermer. Doigt posé ou souris dessus : le temps s'arrête.
   API (compatible avec l'ancienne) :
     MDGToast.dire(texte, { type: 'ok'|'info'|'alerte'|'erreur', sous, duree, img, action: { t, fn }, groupe, pluriel: n => texte })
     MDGToast.suivre(promesse, { attente, ok, erreur, sous }) → la promesse, affichée du début à la fin
   Sans type, il est deviné d'après le texte. Le son (v3/sons.js) et une vibration propre à chaque sens accompagnent. */
(function () {
  'use strict';
  if (window.MDGToast) return;
  const deviner = t => /impossible|erreur|échou|refus|pas de connexion|sans réseau|introuvable|invalide|incorrect|banni|trop lourd|mémoire pleine|n’a pas pu|n'a pas pu|pas de lien|pas de numéro|pas d’adresse|non publiée/i.test(t) ? 'erreur'
    : /attention|vérifiez|limite|bientôt|n’est pas encore|n'est pas encore|indiquez|choisissez|complétez/i.test(t) ? 'alerte'
    : /connecté|en ligne|publié|envoyé|enregistr|vérifié|copié|merci|ajouté|créé|signalé|retiré|supprimé|à jour|accept|conclu|c’est fait|c'est fait/i.test(t) ? 'ok' : 'info';
  // l'écriture du site : une phrase simple, UN mot en valeur (gras italique : maïs sur fond sombre, vert surligné sur fond clair).
  // Le message peut le marquer lui-même (*mot*) ; sinon on prend le premier mot qui dit ce qui s'est passé, puis le premier mot du métier.
  const ETATS = 'publiée?s?|envoyée?s?|enregistrée?s?|connectée?|déconnectée?|vérifiée?s?|copiée?|retirée?s?|supprimée?s?|acceptée?s?|refusée?s?|conclue?s?|signalée?s?|ajoutée?s?|créée?s?|annulée?s?|confirmée?s?|livrée?s?|reçue?s?|impossible|erreur|échec|bienvenue|merci|à jour|en ligne|hors connexion|sans réseau|cachée?|sécurisée?|gratuite?s?';
  const METIER = 'offres?|demandes?|annonces?|négociations?|propositions?|messages?|commandes?|prix|stock|groupes?|alertes?|compte|profil|identité|connexion|réseau|zones?|produits?|photos?|vendeurs?|acheteurs?|transporteurs?|livraison|numéro|code|avis|statut|publications?';
  const BORD = "(^|[\\s'’(«\\-;])", FIN = '(?=$|[\\s.,:;!?»)…])';
  const R_ETAT = new RegExp(BORD + '(' + ETATS + ')' + FIN, 'i'), R_METIER = new RegExp(BORD + '(' + METIER + ')' + FIN, 'i');
  function accent(html) {
    if (/\*[^*]+\*/.test(html)) return html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    const r = R_ETAT.test(html) ? R_ETAT : R_METIER.test(html) ? R_METIER : null;
    return r ? html.replace(r, (_, a, m) => a + '<em>' + m + '</em>') : html;
  }
  const VIBRE = { ok: 12, erreur: [30, 60, 30], alerte: [18, 40, 18] };
  // dessin de la maquette (14/11/2026) : une pilule sombre posée en bas, à 104 px, au-dessus de la barre d'onglets ; texte seul, sans vignette
  const CSS = `.il{position:fixed;left:16px;right:16px;bottom:calc(104px + env(safe-area-inset-bottom,0px));z-index:9600;display:flex;justify-content:center;pointer-events:none;
  opacity:0;transform:translateY(12px);transition:opacity 280ms cubic-bezier(.22,1,.36,1),transform 280ms cubic-bezier(.22,1,.36,1);font-family:Jost,system-ui,sans-serif}
.il.on{opacity:1;transform:none}
.il.part{opacity:0;transform:translateY(12px)}
.il-in{pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:14px;max-width:min(100%,460px);box-sizing:border-box;padding:12px 18px;border-radius:14px;
  background:#171512;color:#F5F0E6;box-shadow:0 10px 30px rgba(23,21,18,.25);text-align:center}
.il-g{display:none}
html[data-theme=sombre] .il-in{box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 0 1px rgba(243,239,228,.12)}
.il-x{min-width:0;display:flex;flex-direction:column;gap:2px}
.il-x b{font:600 14px/1.35 Jost,sans-serif;overflow-wrap:anywhere}
.il-x b em{font-style:normal;font-weight:inherit}
.il-x small{font:500 13px/1.35 Jost,sans-serif;color:#D8CFBF;overflow-wrap:anywhere}
.il-n{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;margin-right:6px;border-radius:10px;background:#F2C230;color:#171512;font:700 12px/1 Jost,sans-serif;vertical-align:1px}
.il-a{position:relative;flex:none;min-height:36px;padding:0 2px;border:0;background:none;color:#F2C230;font:700 14px/1 Jost,system-ui,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.il-a::after{content:"";position:absolute;inset:-6px -8px}
.il-a:focus-visible,.il-in:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.il,.il.part{transition:opacity .2s;transform:none}}`;
  let il = null, cur = null, minuterie = 0, reste = 0, depuis = 0, file = [], affiche = 0, enPause = false;
  function preparer() {
    if (il && il.isConnected) return il;
    if (!document.getElementById('ilCss')) { const s = document.createElement('style'); s.id = 'ilCss'; s.textContent = CSS; document.head.appendChild(s); }
    il = document.createElement('div'); il.className = 'il'; il.setAttribute('role', 'status'); il.setAttribute('aria-live', 'polite'); il.tabIndex = -1;
    document.body.appendChild(il);
    il.addEventListener('click', e => { if (!e.target.closest('.il-in')) return; if (e.target.closest('.il-a')) return; if (cur && cur.action && cur.toucher !== false) lancer(cur.action); else fermer(); });
    let y0 = null;
    il.addEventListener('pointerdown', e => { y0 = e.clientY; pause(true); });
    il.addEventListener('pointermove', e => { if (y0 != null && e.clientY - y0 > 14) { y0 = null; fermer(); } });
    const rep = () => { y0 = null; pause(false); };
    il.addEventListener('pointerup', rep); il.addEventListener('pointercancel', rep); il.addEventListener('pointerleave', rep);
    il.addEventListener('mouseenter', () => pause(true)); il.addEventListener('mouseleave', () => pause(false));
    return il;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function lancer(a) { fermer(); try { a.fn && a.fn(); } catch (_) {} }
  function glyphe(m) {
    if (m.img) return `<span class="il-g"><span class="il-g img${m.rond ? ' rond' : ''}" style="position:absolute;inset:0"><img src="${esc(m.img)}" alt=""></span><i class="il-pt"></i></span>`;
    const S = window.MDGSac, humeur = m.type === 'attente' ? 'charge' : m.type === 'ok' ? 'plein' : m.type === 'erreur' ? 'triste' : 'vide';
    if (!S) return '<span class="il-g seul"><i class="il-pt"></i></span>';   // sans le sac (site) : seulement le point
    return `<span class="il-g">${S.svg(humeur, { t: 36, simple: true })}<i class="il-pt"></i></span>`;
  }
  function dessiner(m, change) {
    const el = preparer(), w0 = el.classList.contains('on') ? el.getBoundingClientRect().width : 0;
    el.dataset.t = m.type;
    el.setAttribute('aria-live', m.type === 'erreur' ? 'assertive' : 'polite'); el.setAttribute('role', m.type === 'erreur' ? 'alert' : 'status');
    el.innerHTML = `<div class="il-in${m.action ? '' : ' sans-a'}${change ? ' chg' : ''}">${glyphe(m)}<span class="il-x"><b>${m.n > 1 ? `<span class="il-n">${m.n}</span>` : ''}${accent(esc(m.texte))}</b>${m.sous ? `<small>${esc(m.sous)}</small>` : ''}</span>${m.action ? `<button type="button" class="il-a">${esc(m.action.t)}</button>` : ''}</div>`;
    const a = el.querySelector('.il-a'); if (a) a.onclick = e => { e.stopPropagation(); lancer(m.action); };
    // la pastille change de largeur en douceur (de l'ancienne à la nouvelle)
    if (!w0) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    el.classList.remove('part');
  }
  function armer(ms) { clearTimeout(minuterie); reste = ms; depuis = Date.now(); if (ms > 0 && !enPause) minuterie = setTimeout(suivant, ms); }
  function pause(oui) {
    if (!cur || cur.type === 'attente') return; enPause = oui;
    if (oui) { clearTimeout(minuterie); reste = Math.max(900, reste - (Date.now() - depuis)); } else { depuis = Date.now(); clearTimeout(minuterie); minuterie = setTimeout(suivant, reste); }
  }
  function suivant() { const m = file.shift(); if (m) montrer(m, true); else fermer(); }
  function fermer() {
    clearTimeout(minuterie); file = []; cur = null; enPause = false;
    if (!il) return; il.classList.remove('on'); il.classList.add('part');
    const el = il; setTimeout(() => { if (!cur && el.isConnected) el.remove(); if (il === el && !cur) il = null; }, 380);
  }
  // 2,4 s comme la maquette ; un texte long ou une erreur restent un peu plus pour être lus
  const duree = m => m.duree || (m.type === 'erreur' ? 5000 : Math.max(2400, Math.min(6000, 1000 + (m.texte.length + (m.sous || '').length) * 35))) + (m.action ? 1500 : 0);
  function montrer(m, change) {
    cur = m; affiche = Date.now(); dessiner(m, change);
    if (m.type !== 'attente') {
      armer(duree(m));
      if (window.MDGSons && MDGSons.confirmer && !m.muet) try { MDGSons.confirmer(m.type); } catch (_) {}
      if (navigator.vibrate && VIBRE[m.type] && !m.muet) try { navigator.vibrate(VIBRE[m.type]); } catch (_) {}
      if (m.type === 'ok' && window.MDGSac && MDGSac.saluer && !m.muet) try { MDGSac.saluer(); } catch (_) {}
    } else clearTimeout(minuterie);
  }
  // une erreur technique du serveur ou du réseau devient une phrase qu'on comprend (le texte brut ne s'affiche jamais)
  const TECH = [
    [/failed to fetch|networkerror|load failed|err_internet|network request failed|fetch failed/i, 'Pas de réseau', 'Vérifiez la connexion, puis réessayez.'],
    [/\bjwt\b|401|not authenticated|invalid token|session expired/i, 'Reconnectez-vous', 'Votre session a expiré.'],
    [/timeout|timed out|\b50[234]\b|statement_timeout/i, 'Le serveur met trop de temps', 'Réessayez dans un instant.'],
    [/schema cache|could not find the function|does not exist|not found in the schema/i, 'Pas encore prêt sur le serveur', 'Réessayez plus tard.'],
    [/row-level security|permission denied|violates|constraint|duplicate key|syntax error|pgrst\d|p0001|sqlstate|unexpected token|is not a function|undefined/i, 'Le serveur a refusé l’opération', 'Réessayez ; si ça continue, écrivez à l’équipe.']
  ];
  const tech = t => TECH.find(r => r[0].test(t));
  // MDGErreur(e) : la phrase à montrer pour une erreur, partout où un module écrit l'erreur dans sa fenêtre (24/10/2026, audit n° 33).
  // Un message du serveur déjà écrit en français (« Seul l'acheteur peut… ») est gardé ; un texte technique ou en anglais devient
  // une phrase simple qui dit quoi faire ; le texte brut part seulement dans la console.
  // codes du serveur qui ont leur propre phrase (schémas 99a, 99b, 99d) ; le plafond lu dans le message, 1 milliard par défaut
  const CODES = {
    MONTANT_MAX: m => { const n = +((m.match(/(\d[\d\s  ]{5,})\s*F/) || [])[1] || '').replace(/\D/g, '') || 1e9;
      return 'Montant trop élevé : ' + (n % 1e9 === 0 ? (n / 1e9) + (n > 1e9 ? ' milliards' : ' milliard') : n.toLocaleString('fr-FR')) + ' F CFA au plus.'; },
    DELAI_DEJA: () => 'Délai déjà demandé : un seul par commande.'
  };
  window.MDGErreur = function (e) {
    const brut = String((e && e.message) || e || ''), code = (brut.match(/^([A-Z_]{3,}) : /) || [])[1];
    if (code && CODES[code]) return CODES[code](brut);
    const m = brut.replace(/^[A-Z_]{3,} : /, '').trim();
    if (navigator.onLine === false || /failed to fetch|networkerror|load failed|err_internet|network request failed/i.test(m)) return 'Pas de connexion : réessayez quand le réseau revient.';
    const t = tech(m); if (t) { try { console.warn('[Marché de Gros]', m); } catch (_) {} return t[1] + '. ' + t[2]; }
    const fr = /[àâçéèêëîïôûùœ’]/i.test(m) || /\b(le|la|les|un|une|vous|votre|pas|est|du|des|au|aux|pour|avec)\b/i.test(m);
    if (m && fr && !/supabase\/|\.sql\b|schema/i.test(m)) return m;
    try { if (m) console.warn('[Marché de Gros]', m); } catch (_) {}
    return 'Impossible pour l’instant. Réessayez dans un instant ; si ça continue, écrivez au Marché de Gros.';
  };
  function lisible(texte, sous) {
    const t = tech(sous || ''); if (t) { const titre = texte.replace(/\s*[:.]\s*$/, ''); return /^(impossible|erreur)$/i.test(titre) ? [t[1], t[2]] : [titre, t[1] + '. ' + t[2]]; }
    const u = tech(texte); if (u) { const m = texte.match(/^([^:]{3,40}?)\s*:\s/), titre = m && !/^(impossible|erreur)$/i.test(m[1].trim()) ? m[1].trim() : ''; return [titre || u[1], titre ? u[1] + '. ' + u[2] : u[2]]; }
    return [texte, sous];
  }
  let dernier = { t: '', at: 0 };
  function dire(texte, o) {
    texte = String(texte || '').trim(); if (!texte) return;
    o = o || {};
    if (texte === dernier.t && Date.now() - dernier.at < 1500 && !o.groupe) return;   // le même message deux fois de suite : une seule fois
    dernier = { t: texte, at: Date.now() };
    if (!document.body) return addEventListener('DOMContentLoaded', () => dire(texte, o), { once: true });
    // phrase longue sans précision : on la coupe en un titre court et une explication (« Pas de lien ici » / « pour votre sécurité… »)
    if (!o.sous && texte.length > 52) { const i = (k => k > 8 && k < 90 ? k : -1)(texte.search(/ : |\. (?=[A-ZÀ-Ý])/));
      if (i > 0) { const sep = texte.slice(i, i + 3) === ' : ' ? 3 : 2, reste = texte.slice(i + sep).trim(); o = Object.assign({}, o, { sous: reste.charAt(0).toUpperCase() + reste.slice(1) }); texte = texte.slice(0, i).replace(/[.:]$/, ''); } }
    [texte, o] = (([t2, s2]) => [t2, s2 === o.sous ? o : Object.assign({}, o, { sous: s2 || '' })])(lisible(texte, o.sous || ''));
    if (texte.length <= 60 && !/[.!?]\s\S/.test(texte)) texte = texte.replace(/\.$/, '');   // un titre court n'a pas de point final (comme les titres de l'app)
    const m = { texte, sous: o.sous || '', type: o.type || deviner(texte + ' ' + (o.sous || '')), duree: o.duree, img: o.img, rond: o.rond, action: o.action, toucher: o.toucher, groupe: o.groupe, pluriel: o.pluriel, n: 1, muet: o.muet };
    // même famille que ce qui est affiché : on regroupe (« 3 nouvelles annonces »)
    if (m.groupe && cur && cur.groupe === m.groupe) {
      m.n = cur.n + 1; if (m.pluriel) m.texte = m.pluriel(m.n, cur);
      montrer(m, true); return fermerLui;
    }
    // une pastille est à l'écran depuis peu : le nouveau message attend son tour (sauf erreur, qui passe devant)
    if (cur && cur.type !== 'attente' && m.type !== 'erreur' && Date.now() - affiche < 1300) { file.push(m); file = file.slice(-3); clearTimeout(minuterie); minuterie = setTimeout(suivant, 1300 - (Date.now() - affiche)); return fermerLui; }
    montrer(m, !!cur);
    return fermerLui;
    function fermerLui() { if (cur === m) fermer(); }
  }
  // suivre une action du début à la fin dans la même pastille
  function suivre(p, o) {
    o = o || {}; const id = {};
    if (document.body) montrer({ texte: o.attente || 'Un instant…', sous: o.sous || '', type: 'attente', n: 1, id }, !!cur);
    const fin = (type, texte, sous) => { if (cur && cur.id !== id && cur.type !== 'attente') return; if (texte) montrer({ texte, sous: sous || '', type, n: 1, action: type === 'erreur' ? o.reessayer : o.action }, true); else if (cur && cur.id === id) fermer(); };
    return Promise.resolve(p).then(r => { fin('ok', typeof o.ok === 'function' ? o.ok(r) : o.ok); return r; },
      e => { fin('erreur', typeof o.erreur === 'function' ? o.erreur(e) : (o.erreur || (e && e.message) || 'Impossible pour l’instant.')); throw e; });
  }
  window.MDGToast = { dire, suivre, deviner, fermer };
})();

/* MDGDemande : la petite feuille de confirmation de l'application, à la place des fenêtres grises du navigateur
   (confirm / prompt : hors charte, sans mode nuit). 24/10/2026, audit antislop n° 34.
   MDGDemande.oui(texte, { ok, annuler, danger }) → Promise<boolean>
   MDGDemande.saisie(texte, { ok, annuler, placeholder }) → Promise<string | null> (null si annulé)
   Échap ou toucher le fond annule ; le focus revient là d'où on venait. Le mode nuit est traduit par app/nuit.js. */
(function () {
  'use strict';
  if (window.MDGDemande) return;
  const CSS = `.dq-bg{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,7,5,.5);font-family:Jost,system-ui,sans-serif}
.dq{width:100%;max-width:480px;box-sizing:border-box;padding:22px 20px calc(18px + env(safe-area-inset-bottom));border-radius:26px 26px 0 0;background:#F4EEE3;color:#171512;box-shadow:0 -12px 40px rgba(0,0,0,.25);animation:dqMonte .28s cubic-bezier(.22,1,.36,1)}
@media (min-width:600px){.dq-bg{align-items:center}.dq{border-radius:26px}}
@keyframes dqMonte{from{transform:translateY(40px)}}
.dq p{margin:0 0 16px;font-size:16.5px;line-height:1.45}
.dq textarea{display:block;width:100%;min-height:88px;box-sizing:border-box;margin:0 0 16px;padding:12px 14px;border:1px solid rgba(23,21,18,.18);border-radius:14px;background:#FFFDF8;color:#171512;font:400 16px/1.4 Jost,sans-serif;resize:vertical}
.dq textarea:focus{outline:2px solid #10392B;outline-offset:1px}
.dq-r{display:flex;gap:10px}
.dq-r button{flex:1;min-height:50px;padding:0 16px;border:0;border-radius:16px;font:600 16px Jost,sans-serif;cursor:pointer}
.dq-r .non{background:rgba(23,21,18,.07);color:#171512}.dq-r .oui{background:#10392B;color:#F3EFE4}.dq-r .oui.danger{background:#C0442B;color:#fff}
.dq-r button:focus-visible{outline:2px solid #10392B;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.dq{animation:none}}`;
  function ouvrir(texte, o, avecSaisie) {
    o = o || {};
    if (!document.getElementById('dqCss')) { const st = document.createElement('style'); st.id = 'dqCss'; st.textContent = CSS; document.head.appendChild(st); }
    return new Promise(resolve => {
      const retour = document.activeElement, bg = document.createElement('div');
      bg.className = 'dq-bg';
      bg.innerHTML = `<div class="dq" role="alertdialog" aria-modal="true" aria-labelledby="dqT"><p id="dqT"></p>${avecSaisie ? '<textarea aria-labelledby="dqT"></textarea>' : ''}
        <div class="dq-r"><button type="button" class="non"></button><button type="button" class="oui${o.danger ? ' danger' : ''}"></button></div></div>`;
      bg.querySelector('#dqT').textContent = texte;
      bg.querySelector('.non').textContent = o.annuler || 'Annuler';
      bg.querySelector('.oui').textContent = o.ok || (avecSaisie ? 'Envoyer' : 'Confirmer');
      const ta = bg.querySelector('textarea'); if (ta && o.placeholder) ta.placeholder = o.placeholder;
      const fin = v => { document.removeEventListener('keydown', cle, true); bg.remove(); if (retour && retour.isConnected && retour.focus) retour.focus({ preventScroll: true }); resolve(v); };
      const non = () => fin(avecSaisie ? null : false), oui = () => fin(avecSaisie ? ta.value.trim() : true);
      const cle = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); non(); }
        else if (e.key === 'Tab') { const f = [...bg.querySelectorAll('textarea, button')]; const i = f.indexOf(document.activeElement);
          e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); } };
      bg.addEventListener('click', e => { if (e.target === bg) non(); });
      bg.querySelector('.non').onclick = non; bg.querySelector('.oui').onclick = oui;
      document.addEventListener('keydown', cle, true);
      document.body.appendChild(bg);
      (ta || bg.querySelector(o.danger ? '.non' : '.oui')).focus({ preventScroll: true });
    });
  }
  window.MDGDemande = { oui: (t, o) => ouvrir(t, o, false), saisie: (t, o) => ouvrir(t, o, true) };
})();

/* MDGFeuille : la feuille du bas de la maquette (14/11/2026) : fond papier, coins de 26 px en haut, poignée, croix ronde,
   voile sombre. Les gestes (délai, problème, annulation, mot secret, suppression du compte…) s'y ouvrent au lieu d'une page pleine.
   MDGFeuille.ouvrir({ label, onFerme }) → { corps, feuille, fermer } ; « corps » reçoit le contenu (classes .fl-h, .fl-s, .fl-ch, .fl-b…).
   Échap, la croix ou le voile ferment ; le focus revient là d'où on venait. */
(function () {
  'use strict';
  if (window.MDGFeuille) return;
  const CSS = `.fl-bg{position:fixed;inset:0;z-index:2147483100;background:rgba(23,21,18,.45);animation:flVoile .28s cubic-bezier(.22,1,.36,1)}
.fl{position:fixed;left:0;right:0;bottom:0;z-index:2147483101;max-width:520px;margin:0 auto;box-sizing:border-box;max-height:88%;overflow-y:auto;overscroll-behavior:contain;
  background:var(--papier);color:var(--encre);border-radius:26px 26px 0 0;padding:10px 16px calc(34px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 32px rgba(0,0,0,.18);
  font-family:Jost,system-ui,sans-serif;animation:flMonte .42s cubic-bezier(.22,1,.36,1)}
@keyframes flVoile{from{opacity:0}}@keyframes flMonte{from{transform:translateY(105%)}}
.fl-po{width:40px;height:5px;border-radius:999px;background:var(--t18);margin:0 auto 6px}
.fl-xr{display:flex;justify-content:flex-end;margin:-4px -6px 0 0;position:sticky;top:0;z-index:1}
.fl-x{width:40px;height:40px;border-radius:999px;border:0;background:var(--lin);display:grid;place-items:center;color:var(--encre);cursor:pointer;position:relative}
.fl-x::after{content:"";position:absolute;inset:-2px}
.fl-c{display:flex;flex-direction:column;gap:10px;margin-top:-28px}
.fl-c form{display:flex;flex-direction:column;gap:10px;margin:0}
.fl-h{margin:0;font:600 24px/1.15 Jost,sans-serif;letter-spacing:-.01em;padding-right:44px;color:var(--encre)}
.fl-h em{font-style:normal;font-weight:inherit;font-family:inherit;letter-spacing:inherit}
.fl-s{margin:0 0 4px;font-size:13.5px;line-height:1.45;color:var(--texte-3)}
.fl-p{margin:0;font-size:15px;line-height:1.45;color:var(--texte-2)}
.fl-p b{color:var(--encre)}
.fl-t{display:block;margin:6px 0 -2px;font-size:14px;font-weight:600;color:var(--texte-2)}
.fl-g{border:0;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;gap:10px}
.fl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px;padding:0;border:0}
.fl-ch{position:relative;display:flex;align-items:center;gap:12px;min-height:54px;padding:8px 16px;box-sizing:border-box;border-radius:16px;border:1.5px solid var(--t10);
  background:var(--carte);color:var(--encre);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fl-ch .rb{width:22px;height:22px;flex:none;box-sizing:border-box;border-radius:999px;border:2px solid var(--t30);display:grid;place-items:center}
.fl-ch.carre .rb{border-radius:7px}
.fl-ch .rb i{width:10px;height:10px;border-radius:999px;background:transparent}
.fl-ch .l{flex:1;min-width:0;font-size:15px;font-weight:600;line-height:1.3}
.fl-ch .l small{display:block;font-size:12.5px;font-weight:400;color:var(--texte-3);margin-top:1px}
.fl-ch .s{flex:none;font-size:12.5px;color:var(--texte-3)}
.fl-ch.h .l{flex:none;white-space:nowrap;font-size:16px;font-weight:700}.fl-ch.h .s{flex:1;min-width:0;text-align:right;font-size:13.5px}
.fl-ch:has(input:checked){border-color:var(--vert)}
.fl-ch:has(input:checked) .rb{border-color:var(--vert)}.fl-ch:has(input:checked) .rb i{background:var(--vert)}
.fl-ch:has(input:focus-visible){outline:2px solid var(--vert);outline-offset:2px}
.fl-ch:has(input:disabled){opacity:.55;cursor:default}
.fl-c input[type=text],.fl-c input[type=password],.fl-c input[type=tel],.fl-c input[type=number],.fl-c input[type=datetime-local],.fl-c input:not([type]),.fl-c textarea{display:block;width:100%;box-sizing:border-box;min-height:50px;
  border-radius:16px;border:1px solid var(--t14);background:var(--champ);padding:12px 14px;font:400 16px/1.4 Jost,sans-serif;color:var(--encre);outline:none}
.fl-c textarea{min-height:96px;resize:none}
.fl-c input:focus-visible,.fl-c textarea:focus-visible{border-color:var(--vert);box-shadow:0 0 0 1px var(--vert)}
.fl-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:4px;padding:0 18px;border:0;border-radius:999px;background:var(--vert);color:var(--action-t);
  font:700 16px Jost,sans-serif;cursor:pointer;text-decoration:none;box-sizing:border-box}
.fl-b[aria-disabled=true],.fl-b:disabled{background:var(--lin-2);color:var(--mute)}
.fl-b.danger{background:#C0442B;color:#FFFDF8}
.fl-b.o{background:none;border:1.5px solid var(--vert);color:var(--vert);min-height:48px;font-size:15px}
.fl-b:focus-visible,.fl-l:focus-visible,.fl-x:focus-visible{outline:2px solid var(--vert);outline-offset:2px}
.fl-l{align-self:center;min-height:44px;padding:0 10px;border:0;background:none;color:var(--texte-2);font:600 14px Jost,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.fl-pied{margin:0;font-size:12.5px;line-height:1.4;color:var(--mute);text-align:center}
.fl-err{margin:0;font-size:14px;line-height:1.4;color:var(--hausse)}.fl-err:empty{display:none}
@media (prefers-reduced-motion:reduce){.fl,.fl-bg{animation:none}}`;
  function ouvrir(o) {
    o = o || {};
    if (!document.getElementById('flCss')) { const st = document.createElement('style'); st.id = 'flCss'; st.textContent = CSS; document.head.appendChild(st); }
    const retour = document.activeElement;
    const voile = document.createElement('div'); voile.className = 'fl-bg';
    const fl = document.createElement('div'); fl.className = 'fl'; fl.setAttribute('data-v2', ''); fl.setAttribute('role', 'dialog'); fl.setAttribute('aria-modal', 'true');
    if (o.label) fl.setAttribute('aria-label', o.label);
    fl.innerHTML = '<div class="fl-po" aria-hidden="true"></div><div class="fl-xr"><button type="button" class="fl-x" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="fl-c"></div>';
    let fini = false;
    const fermer = () => { if (fini) return; fini = true; document.removeEventListener('keydown', cle, true); voile.remove(); fl.remove();
      if (retour && retour.isConnected && retour.focus) try { retour.focus({ preventScroll: true }); } catch (_) {}
      if (o.onFerme) try { o.onFerme(); } catch (_) {} };
    const cle = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(); }
      else if (e.key === 'Tab') { const f = [...fl.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea,select,a[href],[tabindex="0"]')].filter(x => x.offsetParent !== null || x.classList.contains('fl-sr'));
        if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); } }
    };
    voile.onclick = fermer; fl.querySelector('.fl-x').onclick = fermer;
    document.addEventListener('keydown', cle, true);
    document.body.appendChild(voile); document.body.appendChild(fl);
    setTimeout(() => { if (!fini && !fl.contains(document.activeElement)) { const h = fl.querySelector('.fl-h'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } else fl.querySelector('.fl-x').focus({ preventScroll: true }); } }, 30);
    return { corps: fl.querySelector('.fl-c'), feuille: fl, fermer, ouvert: () => !fini };
  }
  window.MDGFeuille = { ouvrir };
})();
