/* ═════════ Marché de Gros CI — Racheter et rappels d'achat (schéma 33) ═════════
   RIEN n'est acheté tout seul. Le serveur prépare (prix du jour, stock restant, offres actives) ; l'acheteur choisit,
   ajuste les quantités et CONFIRME. Chaque ligne envoie une proposition au vendeur (nego_ouvrir, qui revérifie tout) :
   le vendeur doit encore accepter. Les rappels préviennent seulement ; ils n'envoient rien.
   API : MDGRacheter.ouvrir(commandeId) · MDGRacheter.habituels() */
(function () {
  'use strict';
  if (window.MDGRacheter) return;
  const N = () => window.MDGNuage;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = v => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(+v || 0).replace(/ /g, ' ');
  const F = v => nf(Math.round(+v || 0)) + ' F';
  const jour = t => t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const hors = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network/i.test(String((e && e.message) || e || ''));
  const errTxt = e => hors(e) ? 'Pas de connexion : rien n’a été envoyé. Réessayez quand le réseau revient.' : String((e && e.message) || 'Une erreur est survenue.').replace(/^[A-Z_]+ : /, '');
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : (N() && N().toast && N().toast(t));

  const CSS = `
.rc-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:rcIn .2s ease-out}
@keyframes rcIn{from{opacity:0}}@keyframes rcUp{from{transform:translateY(40px);opacity:.4}}
.rc{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:rcUp .28s cubic-bezier(.2,.8,.2,1)}
.rc-h{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px}
.rc-h h2{flex:1;margin:0;font:600 23px/1.15 Jost,sans-serif;letter-spacing:-.015em}.rc-h h2:focus{outline:none}
.rc-h h2 em{font-weight:900;font-style:italic;background:linear-gradient(transparent 58%,#F2C230 58%);padding:0 2px}
.rc-x{flex:none;width:44px;height:44px;margin:-8px -6px 0 0;border:0;border-radius:22px;background:transparent;color:#171512;font-size:26px;line-height:1;cursor:pointer}
.rc-x:focus-visible,.rc button:focus-visible,.rc input:focus-visible,.rc select:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.rc-lead{margin:0 0 12px;color:#4A4336;font-size:14px}
.rc-prev{background:#E9E3D3;border-radius:16px;padding:11px 14px;margin:0 0 12px;font-size:14px;color:#3E382C}.rc-prev b{color:#171512}
.rc-o{background:#FFFDF8;border-radius:20px;padding:14px 16px;margin:0 0 10px;box-shadow:0 1px 0 rgba(16,57,43,.08)}
.rc-ot{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.rc-ot b{font:600 16px/1.25 Jost,sans-serif}.rc-ot small{color:#5E5546;font-size:12.5px;text-align:right}
.rc-tag{display:inline-block;margin:4px 0 0;padding:2px 9px;border-radius:10px;background:#DCEFE3;color:#10392B;font-size:12px;font-weight:600}
.rc-px{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:8px 0 2px}.rc-px strong{font:800 24px/1 Jost,sans-serif;color:#10392B}.rc-px small{color:#5E5546;font-size:13px}
.rc-d{display:inline-flex;align-items:center;min-height:24px;padding:0 9px;border-radius:12px;font-size:12.5px;font-weight:600;background:#ECE6D6;color:#3E382C}.rc-d[data-k=plus]{background:#FBE3DE;color:#8E2A1C}.rc-d[data-k=moins]{background:#DCEFE3;color:#10392B}
.rc-q{display:flex;align-items:center;gap:8px;margin:10px 0 0;flex-wrap:wrap}.rc-q label{font-size:13px;color:#5E5546;flex:1 1 100%}
.rc-st{display:flex;align-items:center;border:1px solid #D9D1BE;border-radius:22px;background:#FFF;overflow:hidden}
.rc-st button{width:44px;height:44px;border:0;background:transparent;font:600 22px/1 Jost,system-ui,sans-serif;color:#10392B;cursor:pointer}
.rc-st input{width:76px;height:44px;border:0;text-align:center;font:600 17px Jost,system-ui,sans-serif;color:#171512;background:transparent;-moz-appearance:textfield}
.rc-st input::-webkit-inner-spin-button{-webkit-appearance:none}
.rc-tot{margin-left:auto;font-weight:600;color:#171512}
.rc-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:12px 0 0;border:0;border-radius:24px;background:#10392B;color:#FFFDF8;font:600 15px Jost,system-ui,sans-serif;cursor:pointer}
.rc-b.s{background:transparent;color:#10392B;box-shadow:inset 0 0 0 1.5px rgba(16,57,43,.35)}.rc-b:disabled{opacity:.5;cursor:default}
.rc-note{margin:8px 0 0;color:#5E5546;font-size:13px}.rc-err{margin:8px 0 0;color:#8E2A1C;font-size:13.5px;font-weight:600}
.rc-conf{margin:12px 0 0;padding:12px 14px;border-radius:16px;background:#FFF6D6;box-shadow:inset 0 0 0 1.5px #E6C65C;font-size:14px}
.rc-conf .rc-duo{display:flex;gap:8px}.rc-conf .rc-b{margin-top:10px}
.rc-sec{margin:18px 0 8px;font:600 13px Jost,sans-serif;letter-spacing:0;color:#655C4D;}
.rc-rap{background:#FFFDF8;border-radius:20px;padding:14px 16px;margin:6px 0 10px}
.rc-seg{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.rc-seg button{min-height:44px;padding:0 14px;border:1px solid #D9D1BE;border-radius:22px;background:#FFF;color:#171512;font:500 14px Jost,system-ui,sans-serif;cursor:pointer}
.rc-seg button[aria-pressed=true]{background:#10392B;border-color:#10392B;color:#FFFDF8}
.rc-sel{display:flex;gap:8px;flex-wrap:wrap}.rc-sel label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546;flex:1 1 130px}
.rc-sel select{min-height:44px;padding:0 10px;border:1px solid #D9D1BE;border-radius:12px;background:#FFF;font:500 15px Jost,system-ui,sans-serif;color:#171512}
.rc-li{display:flex;align-items:center;gap:12px;background:#FFFDF8;border-radius:18px;padding:12px 14px;margin:0 0 8px}
.rc-li input[type=checkbox]{width:24px;height:24px;flex:none;accent-color:#10392B}
.rc-li .t{flex:1;min-width:0}.rc-li .t b{display:block;font-weight:600}.rc-li .t small{display:block;color:#5E5546;font-size:12.5px}
.rc-li .rc-b{width:auto;min-height:44px;margin:0;padding:0 14px;font-size:14px}
.rc-pied{position:sticky;bottom:calc(-24px - env(safe-area-inset-bottom));margin:12px -16px calc(-24px - env(safe-area-inset-bottom));padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:#F3EFE4;box-shadow:0 -8px 16px rgba(243,239,228,.9)}
.rc-vide{text-align:center;padding:18px 8px;color:#4A4336}.rc-vide b{display:block;font:600 17px/1.25 Jost,sans-serif;color:#171512;margin:6px 0 4px}
.rc-res{list-style:none;margin:10px 0 0;padding:0}.rc-res li{padding:8px 0;border-top:1px solid #ECE6D6;font-size:14px}.rc-res li.ko{color:#8E2A1C}
.rc form{background:none;box-shadow:none;border:0;padding:0;margin:0;border-radius:0}
@media (prefers-reduced-motion:reduce){.rc-bg,.rc{animation:none!important}}`;
  function css() { if (document.getElementById('rcCss')) return; const s = document.createElement('style'); s.id = 'rcCss'; s.textContent = CSS; document.head.appendChild(s); }

  let bg = null, retour = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; document.removeEventListener('keydown', clavier); try { retour && retour.focus(); } catch (_) {} }
  function clavier(e) { if (e.key === 'Escape') fermer(); }
  function monter(label) {
    css(); if (bg) { bg.querySelector('.rc').innerHTML = ''; return bg.querySelector('.rc'); }
    retour = document.activeElement;
    bg = document.createElement('div'); bg.className = 'rc-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', label);
    bg.innerHTML = '<div class="rc"></div>'; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-rcx]')) fermer(); });
    document.addEventListener('keydown', clavier);
    return bg.querySelector('.rc');
  }
  const tete = (t, em) => `<div class="rc-h"><h2 tabindex="-1">${esc(t)}${em ? ' <em>' + esc(em) + '</em>' : ''}</h2><button class="rc-x" data-rcx aria-label="Fermer">×</button></div>`;
  const focusTitre = box => { const h = box.querySelector('h2'); if (h) h.focus(); };
  const connecte = () => { if (!N() || !N().session()) { if (N()) N().open(); return false; } return true; };

  // quantité proposée : la dernière, sans dépasser ce qui reste
  const qDefaut = (prev, dispo) => { const p = +prev || 1, d = +dispo || 0; return d > 0 ? Math.min(p, d) : p; };
  const ecart = (prix, avant) => {
    if (prix == null || avant == null || +prix === +avant) return prix != null && avant != null ? '<span class="rc-d">Même prix que la dernière fois</span>' : '';
    const d = prix - avant; return `<span class="rc-d" data-k="${d > 0 ? 'plus' : 'moins'}">${d > 0 ? '+' : '−'}${F(Math.abs(d))} depuis votre dernier achat</span>`;
  };
  const stepper = (id, v, max) => `<div class="rc-st"><button type="button" data-moins="${id}" aria-label="Moins">−</button><input type="number" inputmode="decimal" min="0.01" step="any" ${max ? `max="${max}"` : ''} value="${v}" data-q="${id}" aria-label="Quantité"><button type="button" data-plus="${id}" aria-label="Plus">+</button></div>`;
  function lierSteppers(box, onChange) {
    box.querySelectorAll('[data-moins],[data-plus]').forEach(b => b.onclick = () => {
      const id = b.dataset.moins || b.dataset.plus, inp = box.querySelector(`[data-q="${id}"]`), max = +inp.max || Infinity;
      let v = +inp.value || 0; v = b.dataset.plus ? Math.min(max, v + 1) : Math.max(1, v - 1); inp.value = v; onChange(id);
    });
    box.querySelectorAll('[data-q]').forEach(i => i.oninput = () => onChange(i.dataset.q));
  }
  const lireQ = (box, id) => { const i = box.querySelector(`[data-q="${id}"]`); const v = +(i && i.value); return v > 0 ? v : 0; };

  // envoie une proposition (la même que « Proposer un prix ») ; le serveur revérifie stock, prix et annonce
  async function proposer(o, q) {
    return N().rpc('nego_ouvrir', { cible: 'offre', cible_id: o.id, prix: o.prix, quantite: q, texte: 'Je souhaite racheter, comme la dernière fois.' });
  }
  function ouvrirNego(id) { if (id && window.MDGNegoce && MDGNegoce.thread) { fermer(); MDGNegoce.thread(id); } }

  // ——— Racheter un produit, depuis une commande terminée ———
  async function ouvrir(cmdId) {
    if (!connecte()) return;
    const box = monter('Racheter');
    box.innerHTML = tete('Racheter') + (window.MDGSac ? MDGSac.charge('Prix et stock du jour…') : '<p>Chargement…</p>'); focusTitre(box);
    let d;
    try { d = await N().rpc('recommande_preparer', { p_cmd: cmdId }); }
    catch (e) { if (!bg) return; box.innerHTML = tete('Racheter') + `<p class="rc-err" role="alert">${esc(errTxt(e))}</p><button class="rc-b s" data-re>Réessayer</button>`; box.querySelector('[data-re]').onclick = () => ouvrir(cmdId); return; }
    if (!bg) return;
    if (!d || !d.commande) { box.innerHTML = tete('Racheter') + '<div class="rc-vide"><b>Commande introuvable</b>Seul l’acheteur d’une commande peut la racheter.</div>'; return; }
    const c = d.commande, O = d.offres || [];
    const pid = o => 'o' + O.indexOf(o);
    let conf = null;
    const carte = o => {
      const q = qDefaut(c.quantite, o.dispo), titreG = o.genre === 'meme_offre' ? 'Même annonce' : o.genre === 'meme_vendeur' ? 'Même vendeur, autre annonce' : 'Autre vendeur';
      let bas;
      if (o.bloquee) bas = '<p class="rc-note">Cette annonce n’accepte pas de nouvelle proposition pour l’instant.</p>';
      else if (o.ouverte_id) bas = `<p class="rc-note">Une négociation est déjà ouverte sur cette annonce.</p><button class="rc-b s" data-nego="${o.ouverte_id}">Ouvrir la négociation</button>`;
      else bas = `<div class="rc-q"><label for="q-${pid(o)}">Quantité (${esc(o.unite)}) · reste ${nf(o.dispo)}</label>${stepper(pid(o), q, o.dispo).replace('data-q=', `id="q-${pid(o)}" data-q=`)}<span class="rc-tot" data-tot="${pid(o)}">${o.prix != null ? F(q * o.prix) : ''}</span></div>
        ${conf === o.id ? `<div class="rc-conf" role="group" aria-label="Confirmer"><b>Envoyer cette proposition à ${esc(o.vendeur)} ?</b><br>${nf(lireQ(box, pid(o)) || q)} ${esc(o.unite)} à ${F(o.prix)} = <b>${F((lireQ(box, pid(o)) || q) * o.prix)}</b>. Rien n’est payé : le vendeur doit accepter, puis vous créez la commande ensemble.
          <div class="rc-duo"><button class="rc-b s" data-annule>Annuler</button><button class="rc-b" data-ok="${o.id}">Confirmer l’envoi</button></div></div>`
          : `<button class="rc-b" data-prop="${o.id}" ${o.prix == null ? 'disabled' : ''}>Proposer au vendeur</button>`}`;
      return `<article class="rc-o"><div class="rc-ot"><b>${esc(o.vendeur)}${o.verifie && window.MDGIdentite ? ' ' + MDGIdentite.badge(15, true) : ''}</b><small>${esc(o.ville || '')}<br>publiée le ${jour(o.publiee_le)}</small></div>
        <span class="rc-tag">${titreG}</span>
        <div class="rc-px">${o.prix != null ? `<strong>${F(o.prix)}</strong><small>/ ${esc(o.unite)} · prix du jour</small>` : '<small>Prix à discuter</small>'}${o.unite === c.unite ? ecart(o.prix, c.prix_unitaire) : ''}</div>${bas}</article>`;
    };
    const peindre = () => {
      const sauf = {}; box.querySelectorAll('[data-q]').forEach(i => { sauf[i.dataset.q] = i.value; });
      box.innerHTML = tete('Racheter', c.produit || 'ce produit') +
        `<div class="rc-prev">Dernier achat : <b>${nf(c.quantite)} ${esc(c.unite)}</b> à <b>${F(c.prix_unitaire)}</b> chez ${esc(c.vendeur)}${c.termine_le ? ', le ' + jour(c.termine_le) : ''}`.replace(/\.\.$/, '.') + `</div>
        <p class="rc-lead">Prix et stock vérifiés à l’instant. Vous choisissez, vous confirmez : rien ne part sans votre accord.</p>` +
        (O.length ? O.map(carte).join('') : '<div class="rc-vide"><b>Aucune offre active aujourd’hui</b>Ce produit n’est pas en vente en ce moment. Un rappel peut vous prévenir pour vérifier plus tard.</div>') +
        `<p class="rc-err" data-err role="alert"></p>` + blocRappel(c);
      Object.entries(sauf).forEach(([k, v]) => { const i = box.querySelector(`[data-q="${k}"]`); if (i) i.value = v; });
      lierSteppers(box, id => { const o = O.find(x => pid(x) === id), t = box.querySelector(`[data-tot="${id}"]`); if (o && t && o.prix != null) t.textContent = F(lireQ(box, id) * o.prix); });
      box.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => { const o = O.find(x => x.id === b.dataset.prop), q = lireQ(box, pid(o));
        const er = box.querySelector('[data-err]'); if (!q) { er.textContent = 'Indiquez une quantité.'; return; } if (o.dispo && q > o.dispo) { er.textContent = 'Il ne reste que ' + nf(o.dispo) + ' ' + o.unite + ' sur cette offre.'; return; }
        conf = o.id; peindre(); const k = box.querySelector('[data-ok]'); if (k) k.focus(); });
      const an = box.querySelector('[data-annule]'); if (an) an.onclick = () => { conf = null; peindre(); };
      const ok = box.querySelector('[data-ok]'); if (ok) ok.onclick = async () => {
        const o = O.find(x => x.id === ok.dataset.ok), q = lireQ(box, pid(o)) || qDefaut(c.quantite, o.dispo); ok.disabled = true;
        try { const id = await proposer(o, q); toast('Proposition envoyée', { type: 'ok', sous: o.vendeur + ' doit l’accepter.' }); ouvrirNego(id); }
        catch (e) { ok.disabled = false; box.querySelector('[data-err]').textContent = errTxt(e); }
      };
      box.querySelectorAll('[data-nego]').forEach(b => b.onclick = () => ouvrirNego(b.dataset.nego));
      lierRappel(box, c);
    };
    let rap = null; try { rap = ((await N().rpc('mes_rappels')) || []).find(r => r.commande_id === c.id) || null; } catch (_) {}
    const blocRappel = () => {
      const r = rap && rap.actif ? rap : null, f = etatRap.f || (r ? r.frequence : 'aucun'), j = etatRap.j || (r && r.jour) || 1, h = etatRap.h || (r && r.heure) || 7;
      return `<h3 class="rc-sec">Rappel</h3><section class="rc-rap"><p class="rc-note" style="margin:0">Une notification pour penser à racheter. <b>Elle ne commande rien.</b></p>
        <div class="rc-seg" role="group" aria-label="Fréquence du rappel">${[['aucun', 'Aucun'], ['quotidien', 'Chaque jour'], ['hebdomadaire', 'Chaque semaine']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
        ${f !== 'aucun' ? `<div class="rc-sel">${f === 'hebdomadaire' ? `<label>Jour<select data-j>${JOURS.slice(1).map((n, i) => `<option value="${i + 1}" ${j === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
          <label>Heure<select data-h>${Array.from({ length: 17 }, (_, i) => i + 5).map(x => `<option value="${x}" ${h === x ? 'selected' : ''}>${x} h</option>`).join('')}</select></label></div>` : ''}
        ${r ? `<p class="rc-note">Prochain rappel : ${new Date(r.prochain_le).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</p>` : ''}
        <p class="rc-err" data-rerr role="alert"></p><button class="rc-b s" data-rok>${f === 'aucun' ? (r ? 'Arrêter le rappel' : 'Aucun rappel') : r ? 'Mettre à jour le rappel' : 'Activer le rappel'}</button></section>`;
    };
    const etatRap = {};
    const lierRappel = (b2) => {
      b2.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { etatRap.f = b.dataset.f; peindre(); });
      const sj = b2.querySelector('[data-j]'); if (sj) sj.onchange = () => { etatRap.j = +sj.value; };
      const sh = b2.querySelector('[data-h]'); if (sh) sh.onchange = () => { etatRap.h = +sh.value; };
      const ok = b2.querySelector('[data-rok]'); if (!ok) return;
      const f = etatRap.f || (rap && rap.actif ? rap.frequence : 'aucun');
      if (f === 'aucun' && !(rap && rap.actif)) { ok.disabled = true; return; }
      ok.onclick = async () => {
        ok.disabled = true; const er = b2.querySelector('[data-rerr]');
        try {
          if (f === 'aucun') { await N().rpc('rappel_arreter', { p_id: rap.id }); rap.actif = false; toast('Rappel arrêté'); }
          else { rap = await N().rpc('rappel_regler', { p_cmd: c.id, p_frequence: f, p_jour: f === 'hebdomadaire' ? (etatRap.j || (rap && rap.jour) || 1) : null, p_heure: etatRap.h || (rap && rap.heure) || 7 });
            rap.commande_id = c.id; toast('Rappel enregistré', { type: 'ok', sous: 'Il vous préviendra ; il ne commande rien.' }); }
          Object.keys(etatRap).forEach(k => delete etatRap[k]); peindre();
        } catch (e) { ok.disabled = false; er.textContent = errTxt(e); }
      };
    };
    peindre(); focusTitre(box);
  }

  // ——— Mes achats habituels : retrouver, choisir plusieurs produits, tout préparer, confirmer une fois ———
  async function habituels() {
    if (!connecte()) return;
    const box = monter('Racheter');
    box.innerHTML = tete('Racheter') + (window.MDGSac ? MDGSac.charge('Vos achats…') : ''); focusTitre(box);
    let L;
    try { L = (await N().rpc('mes_achats_habituels')) || []; }
    catch (e) { if (!bg) return; box.innerHTML = tete('Racheter') + `<p class="rc-err" role="alert">${esc(errTxt(e))}</p><button class="rc-b s" data-re>Réessayer</button>`; box.querySelector('[data-re]').onclick = habituels; return; }
    if (!bg) return;
    const choix = new Set();
    const peindre = () => {
      box.innerHTML = tete('Mes achats', 'habituels') + '<p class="rc-lead">Les produits de vos commandes terminées. Cochez ceux à racheter : on vérifie le prix et le stock du jour, vous ajustez, puis vous confirmez.</p>' +
        (L.length ? L.map((x, i) => `<div class="rc-li"><input type="checkbox" id="rh${i}" data-c="${i}" ${choix.has(i) ? 'checked' : ''}><label class="t" for="rh${i}"><b>${esc(x.produit || x.slug)}</b>
          <small>${nf(x.quantite)} ${esc(x.unite)} à ${F(x.prix_unitaire)} · ${esc(x.vendeur)} · ${jour(x.dernier)}${x.fois > 1 ? ' · acheté ' + x.fois + ' fois' : ''}</small>
          ${x.rappel && x.rappel.actif ? `<small>Rappel : ${x.rappel.frequence === 'quotidien' ? 'chaque jour' : 'chaque ' + JOURS[x.rappel.jour]} à ${x.rappel.heure} h</small>` : ''}</label>
          <button class="rc-b s" data-un="${i}" aria-label="Racheter ${esc(x.produit || '')}">Voir</button></div>`).join('')
          + `<div class="rc-pied"><button class="rc-b" data-prep ${choix.size ? '' : 'disabled'}>Préparer la sélection${choix.size ? ' (' + choix.size + ')' : ''}</button></div>`
          : '<div class="rc-vide">' + (window.MDGSac ? MDGSac.svg('vide') : '') + '<b>Pas encore d’achat terminé</b>Quand une commande sera terminée, vous pourrez la racheter d’ici en un geste.</div>');
      box.querySelectorAll('[data-c]').forEach(c => c.onchange = () => { const i = +c.dataset.c; c.checked ? choix.add(i) : choix.delete(i); const b = box.querySelector('[data-prep]'); b.disabled = !choix.size; b.textContent = 'Préparer la sélection' + (choix.size ? ' (' + choix.size + ')' : ''); });
      box.querySelectorAll('[data-un]').forEach(b => b.onclick = () => ouvrir(L[+b.dataset.un].commande_id));
      const p = box.querySelector('[data-prep]'); if (p) p.onclick = () => preparer([...choix].map(i => L[i]));
    };
    peindre(); focusTitre(box);
  }

  // la sélection préparée : une ligne par produit, la meilleure offre disponible (même vendeur d'abord), quantités modifiables
  async function preparer(sel) {
    const box = monter('Racheter');
    box.innerHTML = tete('Ma sélection') + (window.MDGSac ? MDGSac.charge('Prix et stock du jour…') : '');
    const R = await Promise.all(sel.map(x => N().rpc('recommande_preparer', { p_cmd: x.commande_id }).catch(e => ({ erreur: errTxt(e) }))));
    if (!bg) return;
    const lignes = R.map((d, i) => {
      const x = sel[i], O = (d && d.offres) || [], libres = O.filter(o => !o.bloquee && !o.ouverte_id && o.prix != null && o.dispo > 0);
      return { x, d, o: libres[0] || null, ouverte: O.find(o => o.ouverte_id), actif: true };
    });
    let etape = 'choix', res = [];
    const peindre = () => {
      const sauf = {}; box.querySelectorAll('[data-q]').forEach(i => { sauf[i.dataset.q] = i.value; });
      const pr = lignes.filter(l => l.o && l.actif), tot = pr.reduce((s, l) => s + (lireQ(box, 'l' + lignes.indexOf(l)) || qDefaut(l.x.quantite, l.o.dispo)) * l.o.prix, 0);
      box.innerHTML = tete('Ma sélection') + '<p class="rc-lead">Une proposition par produit, au prix du jour. Chaque vendeur devra accepter : rien n’est payé ni commandé maintenant.</p>' +
        lignes.map((l, i) => { const x = l.x, o = l.o;
          if (l.d && l.d.erreur) return `<article class="rc-o"><b>${esc(x.produit)}</b><p class="rc-err">${esc(l.d.erreur)}</p></article>`;
          if (!o) return `<article class="rc-o"><div class="rc-ot"><b>${esc(x.produit)}</b></div><p class="rc-note">${l.ouverte ? 'Une négociation est déjà ouverte pour ce produit.' : 'Aucune offre disponible aujourd’hui pour ce produit.'}</p>${l.ouverte ? `<button class="rc-b s" data-nego="${l.ouverte.ouverte_id}">Ouvrir la négociation</button>` : ''}</article>`;
          const q = qDefaut(x.quantite, o.dispo);
          return `<article class="rc-o" style="${l.actif ? '' : 'opacity:.55'}"><div class="rc-ot"><b>${esc(x.produit)}</b><small>${esc(o.vendeur)}<br>${esc(o.ville || '')}</small></div>
            <div class="rc-px"><strong>${F(o.prix)}</strong><small>/ ${esc(o.unite)}</small>${o.unite === x.unite ? ecart(o.prix, x.prix_unitaire) : ''}</div>
            ${l.actif ? `<div class="rc-q"><label for="ql${i}">Quantité (${esc(o.unite)}) · reste ${nf(o.dispo)}</label>${stepper('l' + i, q, o.dispo).replace('data-q=', `id="ql${i}" data-q=`)}<span class="rc-tot" data-tot="l${i}">${F(q * o.prix)}</span></div>` : ''}
            <button class="rc-b s" data-tog="${i}">${l.actif ? 'Retirer de la sélection' : 'Remettre dans la sélection'}</button></article>`; }).join('') +
        (etape === 'resultat' ? `<ul class="rc-res" aria-live="polite">${res.map(r => `<li class="${r.ok ? '' : 'ko'}">${r.ok ? '✓' : '✗'} ${esc(r.t)}</li>`).join('')}</ul><button class="rc-b s" data-fin>Fermer</button>`
        : `<div class="rc-pied">${etape === 'conf' ? `<div class="rc-conf" role="group" aria-label="Confirmer"><b>Envoyer ${pr.length} proposition${pr.length > 1 ? 's' : ''} pour ${F(tot)} au total ?</b><br>Chaque vendeur devra accepter. Rien n’est payé maintenant.<div class="rc-duo"><button class="rc-b s" data-annule>Annuler</button><button class="rc-b" data-envoi>Confirmer l’envoi</button></div></div>`
          : `<button class="rc-b" data-conf ${pr.length ? '' : 'disabled'}>Envoyer ${pr.length} proposition${pr.length > 1 ? 's' : ''} · ${F(tot)}</button>`}<p class="rc-err" data-err role="alert"></p></div>`);
      Object.entries(sauf).forEach(([k, v]) => { const i = box.querySelector(`[data-q="${k}"]`); if (i) i.value = v; });
      lierSteppers(box, id => { const l = lignes[+id.slice(1)], t = box.querySelector(`[data-tot="${id}"]`); if (l && l.o && t) t.textContent = F(lireQ(box, id) * l.o.prix); const b = box.querySelector('[data-conf]'); if (b) { const pr2 = lignes.filter(z => z.o && z.actif); b.textContent = 'Envoyer ' + pr2.length + ' proposition' + (pr2.length > 1 ? 's' : '') + ' · ' + F(pr2.reduce((s, z) => s + (lireQ(box, 'l' + lignes.indexOf(z)) || 0) * z.o.prix, 0)); } });
      box.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => { const l = lignes[+b.dataset.tog]; l.actif = !l.actif; etape = 'choix'; peindre(); });
      box.querySelectorAll('[data-nego]').forEach(b => b.onclick = () => ouvrirNego(b.dataset.nego));
      const cf = box.querySelector('[data-conf]'); if (cf) cf.onclick = () => {
        const mauvaise = lignes.find((l, i) => l.o && l.actif && (!lireQ(box, 'l' + i) || lireQ(box, 'l' + i) > l.o.dispo));
        if (mauvaise) { box.querySelector('[data-err]').textContent = 'Vérifiez la quantité de ' + mauvaise.x.produit + ' (reste ' + nf(mauvaise.o.dispo) + ').'; return; }
        etape = 'conf'; peindre(); const k = box.querySelector('[data-envoi]'); if (k) k.focus(); };
      const an = box.querySelector('[data-annule]'); if (an) an.onclick = () => { etape = 'choix'; peindre(); };
      const ev = box.querySelector('[data-envoi]'); if (ev) ev.onclick = async () => {
        ev.disabled = true; res = [];
        for (const [i, l] of lignes.entries()) { if (!l.o || !l.actif) continue; const q = lireQ(box, 'l' + i);
          try { await proposer(l.o, q); res.push({ ok: true, t: l.x.produit + ' : ' + nf(q) + ' ' + l.o.unite + ' proposés à ' + l.o.vendeur }); }
          catch (e) { res.push({ ok: false, t: l.x.produit + ' : ' + errTxt(e) }); } }
        etape = 'resultat'; peindre();
        const n = res.filter(r => r.ok).length; if (n) toast(n + ' proposition' + (n > 1 ? 's' : '') + ' envoyée' + (n > 1 ? 's' : ''), { type: 'ok', sous: 'Retrouvez-les dans vos négociations.' });
      };
      const fin = box.querySelector('[data-fin]'); if (fin) fin.onclick = fermer;
    };
    peindre(); focusTitre(box);
  }

  // notification de rappel touchée : #/?racheter=<commande>
  function depuisAdresse(h) {
    const m = String(h || location.hash).match(/[?&]racheter=([0-9a-f-]{36})/); if (!m) return;
    try { if (!h) history.replaceState(history.state, '', location.hash.replace(/[?&]racheter=[0-9a-f-]{36}/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = k => { if (N() && N().session()) ouvrir(m[1]); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-lien') depuisAdresse(e.data.url); });
  depuisAdresse();

  window.MDGRacheter = { ouvrir, habituels };
})();
