/* ═════════ Marché de Gros CI — les messages après une action (« Vous êtes connecté », « Votre annonce est en ligne »…) ═════════
   Un seul système pour toute l'application : une bannière en haut de l'écran, aux couleurs du logo, avec une icône qui dit
   le sens (réussi ✓, à savoir i, attention !, échec ×), un petit son (v3/sons.js, réglable dans Mon compte → Sons),
   une barre qui montre le temps restant, et on la touche ou on la glisse vers le haut pour la fermer.
   API : MDGToast.dire(texte, { type: 'ok'|'info'|'alerte'|'erreur', sous: 'précision', duree: ms })
   Sans type, il est deviné d'après le texte (« impossible », « pas de connexion »… → échec ; « connecté », « en ligne »… → réussi). */
(function () {
  'use strict';
  if (window.MDGToast) return;
  const ICO = {
    ok: '<path d="M20 6 9 17l-5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    alerte: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    erreur: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  const deviner = t => /impossible|erreur|échou|refus|pas de connexion|sans réseau|introuvable|invalide|incorrect|banni|trop lourd/i.test(t) ? 'erreur'
    : /attention|vérifiez|limite|bientôt|n’est pas encore|n'est pas encore|indiquez|choisissez|complétez/i.test(t) ? 'alerte'
    : /connecté|en ligne|publié|envoyé|enregistr|vérifié|copié|merci|ajouté|créé|signalé|retiré|supprimé|à jour|accept|conclu|c’est fait|c'est fait/i.test(t) ? 'ok' : 'info';
  const CSS = `.mt-pile{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top, 0px) + 10px);z-index:9600;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;padding:0 12px}
.mt{pointer-events:auto;position:relative;overflow:hidden;width:min(100%,440px);display:flex;align-items:flex-start;gap:12px;padding:13px 14px 15px 13px;border-radius:18px;background:#10392B;color:#F3EFE4;
  box-shadow:0 14px 38px rgba(0,0,0,.34),0 0 0 1px rgba(243,239,228,.08) inset;font:500 15px/1.4 Jost,system-ui,sans-serif;transform:translateY(-130%);opacity:0;transition:transform .42s cubic-bezier(.22,1,.36,1),opacity .25s;touch-action:pan-x;cursor:pointer}
.mt.on{transform:none;opacity:1}
.mt-i{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:#3FB872;color:#0d2a1c}
.mt[data-t="info"] .mt-i{background:rgba(243,239,228,.16);color:#F3EFE4}
.mt[data-t="alerte"] .mt-i{background:#F2C230;color:#10392B}
.mt[data-t="erreur"] .mt-i{background:#E2735B;color:#2a0d07}
.mt-x{flex:1;min-width:0;padding-top:4px}.mt-x b{display:block;font-weight:600}.mt-x small{display:block;margin-top:2px;font-size:13.5px;color:rgba(243,239,228,.78)}
.mt-j{position:absolute;left:0;bottom:0;height:3px;width:100%;background:#F2C230;transform-origin:left;opacity:.85}
.mt[data-t="erreur"] .mt-j{background:#E2735B}.mt[data-t="ok"] .mt-j{background:#3FB872}
@media (prefers-reduced-motion:reduce){.mt{transition:opacity .2s;transform:none}.mt-j{display:none}}`;
  let pile = null;
  function preparer() {
    if (pile && pile.isConnected) return pile;
    if (!document.getElementById('mtCss')) { const s = document.createElement('style'); s.id = 'mtCss'; s.textContent = CSS; document.head.appendChild(s); }
    pile = document.createElement('div'); pile.className = 'mt-pile'; pile.setAttribute('role', 'status'); pile.setAttribute('aria-live', 'polite');
    document.body.appendChild(pile); return pile;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let dernier = { t: '', at: 0 };
  function dire(texte, o) {
    texte = String(texte || '').trim(); if (!texte) return;
    o = o || {};
    if (texte === dernier.t && Date.now() - dernier.at < 1500) return;   // le même message deux fois de suite : une seule bannière
    dernier = { t: texte, at: Date.now() };
    if (!document.body) return addEventListener('DOMContentLoaded', () => dire(texte, o), { once: true });
    const p = preparer(), type = o.type || deviner(texte + ' ' + (o.sous || ''));
    const duree = o.duree || Math.min(6500, 2600 + texte.length * 35);
    while (p.children.length >= 2) p.lastChild.remove();   // le plus récent en haut, deux au plus
    const el = document.createElement('div'); el.className = 'mt'; el.dataset.t = type;
    el.innerHTML = `<span class="mt-i" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICO[type] || ICO.info}</svg></span>
      <span class="mt-x"><b>${esc(texte)}</b>${o.sous ? `<small>${esc(o.sous)}</small>` : ''}</span><i class="mt-j" aria-hidden="true"></i>`;
    p.prepend(el);
    const j = el.querySelector('.mt-j');
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('on'); if (j.animate) j.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: duree, easing: 'linear', fill: 'forwards' }); }));
    let t = setTimeout(fermer, duree);
    function fermer() { clearTimeout(t); el.classList.remove('on'); setTimeout(() => el.remove(), 450); }
    el.addEventListener('click', fermer);
    let y0 = null; el.addEventListener('pointerdown', e => { y0 = e.clientY; });
    el.addEventListener('pointermove', e => { if (y0 != null && e.clientY - y0 < -14) { y0 = null; fermer(); } });
    if (window.MDGSons && MDGSons.confirmer) try { MDGSons.confirmer(type); } catch (_) {}
    if (navigator.vibrate && type === 'erreur') try { navigator.vibrate(35); } catch (_) {}
    return fermer;
  }
  window.MDGToast = { dire, deviner };
})();
