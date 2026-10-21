/* ═════════ Marché de Gros CI — l'îlot : une seule pastille vivante pour tout ce que l'application a à dire ═════════
   Au lieu d'empiler des bannières, une pastille en haut de l'écran qui change de forme :
   • elle se TRANSFORME : un nouveau message prend la place du précédent, la pastille s'élargit ou se resserre en douceur ;
   • elle REGROUPE : trois annonces qui arrivent → « 3 nouvelles annonces », pas trois bannières ;
   • elle SUIT une action : « Envoi… » (le sac qui se remplit) devient « Envoyé » ou l'erreur, dans la même pastille ;
   • elle PROPOSE le bon geste : « Répondre », « Voir », « Annuler » ;
   • elle MONTRE qui ou quoi : la photo du produit, l'avatar de la personne, sinon le sac et son humeur (app/sac.js) ;
   • sobre : pas de carré de couleur ni de barre qui se vide ; un point discret dit le sens (vert réussi, maïs attention, rouge échec).
   Toucher : le geste proposé (ou fermer). Glisser vers le haut : fermer. Doigt posé ou souris dessus : le temps s'arrête.
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
  const VIBRE = { ok: 12, erreur: [30, 60, 30], alerte: [18, 40, 18] };
  const CSS = `.il{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9600;transform:translate(-50%,-18px) scale(.72);opacity:0;
  max-width:min(calc(100vw - 20px),460px);min-width:0;border-radius:26px;background:rgba(255,253,248,.96);color:#171512;
  -webkit-backdrop-filter:blur(22px) saturate(1.6);backdrop-filter:blur(22px) saturate(1.6);
  box-shadow:0 14px 36px rgba(16,57,43,.18),0 2px 6px rgba(16,57,43,.08),0 0 0 1px rgba(23,21,18,.06) inset;
  font:500 15px/1.35 Jost,system-ui,sans-serif;overflow:hidden;cursor:pointer;touch-action:pan-x;
  transition:transform .5s cubic-bezier(.2,1.25,.35,1),opacity .25s,width .42s cubic-bezier(.22,1,.36,1)}
.il.on{transform:translate(-50%,0) scale(1);opacity:1}
.il.part{transform:translate(-50%,-26px) scale(.8);opacity:0;transition:transform .35s cubic-bezier(.55,0,.75,.2),opacity .3s}
.il-in{display:flex;align-items:center;gap:12px;padding:9px 9px 9px 9px;min-height:54px}
.il-in.sans-a{padding-right:18px}
.il-in.chg{animation:ilChg .38s cubic-bezier(.22,1,.36,1)}
@keyframes ilChg{from{opacity:0;transform:translateY(8px);filter:blur(3px)}to{opacity:1;transform:none;filter:none}}
.il-g{position:relative;flex:none;width:38px;height:38px;border-radius:14px;display:grid;place-items:end center;overflow:visible}
.il-g.img{place-items:center;overflow:hidden;background:#F3EFE4}.il-g.img img{width:100%;height:100%;object-fit:contain;padding:3px;box-sizing:border-box;display:block}
.il-g.rond img{object-fit:cover;padding:0}
.il-g.rond{border-radius:50%}
.il-g svg{display:block}
.il-g.seul{width:12px;height:12px;margin-left:8px}.il-g.seul .il-pt{position:static;display:block;box-shadow:none}
.il-pt{position:absolute;right:-2px;top:-2px;width:11px;height:11px;border-radius:50%;background:#6CC58C;box-shadow:0 0 0 2.5px #FFFDF8}
.il[data-t="alerte"] .il-pt{background:#F2C230}.il[data-t="erreur"] .il-pt{background:#EF6F5A}.il[data-t="info"] .il-pt{background:#B9AF98}
.il[data-t="attente"] .il-pt{background:#F2C230;animation:ilPouls 1.1s ease-in-out infinite}
@keyframes ilPouls{50%{transform:scale(.6);opacity:.5}}
.il-x{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.il-x b,.il-x small{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;white-space:normal;width:max-content;max-width:min(310px,calc(100vw - 110px));overflow-wrap:anywhere}
.il-x b{font:600 15.5px/1.28 Jost,sans-serif;letter-spacing:-.01em;-webkit-line-clamp:3}
.il-x b em{font-weight:900;font-style:italic;color:#10392B;padding:0 .06em 0 .02em;background:linear-gradient(transparent 62%,rgba(242,194,48,.65) 62%,rgba(242,194,48,.65) 94%,transparent 94%)}
.il-x small{font-size:13.5px;line-height:1.35;color:#5E5546;-webkit-line-clamp:4;margin-top:2px}
.il-in:not(.sans-a) .il-x b,.il-in:not(.sans-a) .il-x small{max-width:min(240px,calc(100vw - 196px))}
.il-n{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;margin-right:6px;border-radius:10px;background:#F2C230;color:#10392B;font:700 12px/1 Jost,sans-serif;vertical-align:1px}
.il-a{flex:none;height:36px;padding:0 15px;border:0;border-radius:18px;background:#F2C230;color:#10392B;font:600 14px/1 Jost,system-ui,sans-serif;cursor:pointer}
.il-a:active{transform:scale(.96)}
.il-a:focus-visible,.il:focus-visible{outline:2px solid #10392B;outline-offset:2px}
html[data-theme=sombre] .il{background:rgba(30,27,22,.95);color:#F3EFE4;box-shadow:0 14px 36px rgba(0,0,0,.45),0 0 0 1px rgba(243,239,228,.08) inset}
html[data-theme=sombre] .il-x b em{color:#F2C230;background:none}html[data-theme=sombre] .il-x small{color:#B9AD98}html[data-theme=sombre] .il-pt{box-shadow:0 0 0 2.5px #1E1B16}
@media (prefers-reduced-motion:reduce){.il,.il.part{transition:opacity .2s;transform:translate(-50%,0)}.il-in.chg{animation:none}.il-pt{animation:none!important}}`;
  let il = null, cur = null, minuterie = 0, reste = 0, depuis = 0, file = [], affiche = 0, enPause = false;
  function preparer() {
    if (il && il.isConnected) return il;
    if (!document.getElementById('ilCss')) { const s = document.createElement('style'); s.id = 'ilCss'; s.textContent = CSS; document.head.appendChild(s); }
    il = document.createElement('div'); il.className = 'il'; il.setAttribute('role', 'status'); il.setAttribute('aria-live', 'polite'); il.tabIndex = -1;
    document.body.appendChild(il);
    il.addEventListener('click', e => { if (e.target.closest('.il-a')) return; if (cur && cur.action && cur.toucher !== false) lancer(cur.action); else fermer(); });
    let y0 = null;
    il.addEventListener('pointerdown', e => { y0 = e.clientY; pause(true); });
    il.addEventListener('pointermove', e => { if (y0 != null && e.clientY - y0 < -14) { y0 = null; fermer(); } });
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
    return `<span class="il-g">${S.svg(humeur, { t: 30 })}<i class="il-pt"></i></span>`;
  }
  function dessiner(m, change) {
    const el = preparer(), w0 = el.classList.contains('on') ? el.getBoundingClientRect().width : 0;
    el.dataset.t = m.type;
    el.setAttribute('aria-live', m.type === 'erreur' ? 'assertive' : 'polite'); el.setAttribute('role', m.type === 'erreur' ? 'alert' : 'status');
    el.innerHTML = `<div class="il-in${m.action ? '' : ' sans-a'}${change ? ' chg' : ''}">${glyphe(m)}<span class="il-x"><b>${m.n > 1 ? `<span class="il-n">${m.n}</span>` : ''}${esc(m.texte).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</b>${m.sous ? `<small>${esc(m.sous)}</small>` : ''}</span>${m.action ? `<button type="button" class="il-a">${esc(m.action.t)}</button>` : ''}</div>`;
    const a = el.querySelector('.il-a'); if (a) a.onclick = e => { e.stopPropagation(); lancer(m.action); };
    // la pastille change de largeur en douceur (de l'ancienne à la nouvelle)
    if (w0) { el.style.width = 'auto'; const w1 = el.getBoundingClientRect().width; el.style.width = w0 + 'px'; void el.offsetWidth; el.style.width = w1 + 'px'; clearTimeout(el._w); el._w = setTimeout(() => { el.style.width = ''; }, 460); }
    else requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
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
  const duree = m => m.duree || (m.type === 'erreur' ? 7000 : Math.min(6500, 2800 + (m.texte.length + (m.sous || '').length) * 30)) + (m.action ? 1500 : 0);
  function montrer(m, change) {
    cur = m; affiche = Date.now(); dessiner(m, change);
    if (m.type !== 'attente') {
      armer(duree(m));
      if (window.MDGSons && MDGSons.confirmer && !m.muet) try { MDGSons.confirmer(m.type); } catch (_) {}
      if (navigator.vibrate && VIBRE[m.type] && !m.muet) try { navigator.vibrate(VIBRE[m.type]); } catch (_) {}
    } else clearTimeout(minuterie);
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
