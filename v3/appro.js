/* ═════════ Marché de Gros CI — Approvisionnement professionnel (schéma 34) ═════════
   Restaurants, hôtels, cantines, revendeurs : un BESOIN regroupe plusieurs produits (chacun devient une vraie demande),
   avec fréquence, période de livraison, zone, prix cible facultatif et exigences.
   Les vendeurs répondent par produit (prix, quantité, stock, délai). L'acheteur compare et choisit en ouvrant la négociation.
   Une demande ou une proposition n'est pas une vente : la commission ne naît qu'avec une commande.
   API : MDGAppro.ouvrir(vue?) · MDGAppro.besoin(id) */
(function () {
  'use strict';
  if (window.MDGAppro) return;
  const N = () => window.MDGNuage;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = v => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(+v || 0).replace(/ /g, ' ');
  const F = v => nf(Math.round(+v || 0)) + ' F';
  const jour = t => t ? new Date(t + (String(t).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  const hors = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network/i.test(String((e && e.message) || e || ''));
  const errTxt = e => hors(e) ? 'Pas de connexion : rien n’a été envoyé. Réessayez quand le réseau revient.' : String((e && e.message) || 'Une erreur est survenue.').replace(/^[A-Z_]+ : /, '');
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : (N() && N().toast && N().toast(t));
  const TYPES = { restaurant: 'Restaurant', hotel: 'Hôtel', cantine: 'Cantine', revendeur: 'Revendeur', autre: 'Autre professionnel' };
  const FREQ = { ponctuelle: 'Ponctuelle', hebdomadaire: 'Chaque semaine', mensuelle: 'Chaque mois' };
  const UNITES = ['kg', 'sac', 'tonne', 'caisse', 'cagette', 'régime', 'botte', 'tas', 'litre', 'unité'];
  const prods = () => (window.MDG && MDG.products) || [];
  const regs = () => (window.MDG && MDG.regions) || [];
  const regNom = s => { const r = regs().find(x => x.slug === s); return r ? r.name : s || ''; };
  const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };

  const CSS = `
.ap-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:apIn .2s ease-out}
@keyframes apIn{from{opacity:0}}@keyframes apUp{from{transform:translateY(40px);opacity:.4}}
.ap{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:apUp .28s cubic-bezier(.2,.8,.2,1)}
.ap-h{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px}.ap-h h2{flex:1;margin:0;font:600 23px/1.15 Archivo,'Helvetica Neue',Arial,sans-serif;letter-spacing:-.015em}.ap-h h2:focus{outline:none}
.ap-h h2 em{font-weight:900;font-style:italic;background:linear-gradient(transparent 58%,#F2C230 58%);padding:0 2px}
.ap-x{flex:none;width:44px;height:44px;margin:-8px -6px 0 0;border:0;border-radius:22px;background:transparent;color:#171512;font-size:26px;line-height:1;cursor:pointer}
.ap button:focus-visible,.ap input:focus-visible,.ap select:focus-visible,.ap textarea:focus-visible,.ap-x:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.ap-lead{margin:0 0 12px;color:#4A4336;font-size:14px}
.ap-seg{display:flex;gap:6px;margin:6px 0 12px;flex-wrap:wrap}.ap-seg button{flex:1 1 auto;min-height:44px;padding:0 14px;border:1px solid #D9D1BE;border-radius:22px;background:#FFF;color:#171512;font:500 14px Jost,system-ui,sans-serif;cursor:pointer}
.ap-seg button[aria-pressed=true]{background:#10392B;border-color:#10392B;color:#FFFDF8}
.ap-c{display:block;width:100%;text-align:left;background:#FFFDF8;border:0;border-radius:20px;padding:14px 16px;margin:0 0 10px;box-shadow:0 1px 0 rgba(16,57,43,.08);font:inherit;color:inherit;cursor:pointer}
.ap-c b{display:block;font:600 16px/1.25 Archivo,'Helvetica Neue',Arial,sans-serif}.ap-c small{display:block;color:#5E5546;font-size:13px;margin-top:2px}
.ap-t{display:inline-flex;align-items:center;min-height:22px;margin:6px 6px 0 0;padding:0 9px;border-radius:11px;background:#ECE6D6;color:#3E382C;font-size:12px;font-weight:600}
.ap-t.v{background:#DCEFE3;color:#10392B}.ap-t.j{background:#FFF1C2;color:#5C4500}.ap-t.g{background:#E9E4D3;color:#5E5546}
.ap-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:12px 0 0;border:0;border-radius:24px;background:#10392B;color:#FFFDF8;font:600 15px Jost,system-ui,sans-serif;cursor:pointer}
.ap-b.s{background:transparent;color:#10392B;box-shadow:inset 0 0 0 1.5px rgba(16,57,43,.35)}.ap-b:disabled{opacity:.5;cursor:default}.ap-b.sm{width:auto;min-height:44px;padding:0 16px;margin:8px 0 0;font-size:14px}
.ap-f{display:grid;gap:10px}.ap-f label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546}
.ap-f input,.ap-f select,.ap-f textarea{min-height:44px;padding:0 12px;border:1px solid #D9D1BE;border-radius:12px;background:#FFF;font:500 15px Jost,system-ui,sans-serif;color:#171512;width:100%;box-sizing:border-box}
.ap-f textarea{min-height:70px;padding:10px 12px;resize:vertical}
.ap-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ap-l{background:#FFFDF8;border-radius:18px;padding:12px 14px;display:grid;gap:8px}
.ap-l .ap-2{grid-template-columns:1fr 1fr}.ap-l .t{display:flex;justify-content:space-between;align-items:center}.ap-l .t b{font-weight:600}
.ap-l .t button{min-height:44px;min-width:44px;border:0;background:transparent;color:#8E2A1C;font:600 13px Jost,system-ui,sans-serif;cursor:pointer}
.ap-err{margin:8px 0 0;color:#8E2A1C;font-size:13.5px;font-weight:600}.ap-note{margin:6px 0 0;color:#5E5546;font-size:13px}
.ap-info{background:#E9E3D3;border-radius:16px;padding:11px 14px;margin:0 0 12px;font-size:14px;color:#3E382C}
.ap-sec{margin:18px 0 8px;font:600 11px Jost,sans-serif;letter-spacing:.16em;color:#655C4D;text-transform:uppercase}
.ap-ln{background:#FFFDF8;border-radius:20px;padding:14px 16px;margin:0 0 12px}
.ap-ln h3{margin:0;font:600 17px/1.2 Archivo,'Helvetica Neue',Arial,sans-serif}.ap-ln>small{color:#5E5546;font-size:13px}
.ap-p{border-top:1px solid #ECE6D6;padding:10px 0 0;margin:10px 0 0}
.ap-p .h{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.ap-p .h b{font-weight:600}.ap-p .h strong{font:800 20px/1 Archivo,'Helvetica Neue',Arial,sans-serif;color:#10392B;white-space:nowrap}
.ap-p ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:#4A4336}
.ap-vide{text-align:center;padding:18px 8px;color:#4A4336}.ap-vide b{display:block;font:600 17px/1.25 Archivo,'Helvetica Neue',Arial,sans-serif;color:#171512;margin:6px 0 4px}
.ap-pied{position:sticky;bottom:calc(-24px - env(safe-area-inset-bottom));margin:12px -16px calc(-24px - env(safe-area-inset-bottom));padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:#F3EFE4;box-shadow:0 -8px 16px rgba(243,239,228,.9)}
.ap-duo{display:flex;gap:8px}.ap-duo .ap-b{flex:1}
@media (max-width:340px){.ap-2,.ap-l .ap-2{grid-template-columns:1fr}}
.ap form{background:none;box-shadow:none;border:0;padding:0;margin:0;border-radius:0}
@media (prefers-reduced-motion:reduce){.ap-bg,.ap{animation:none!important}}`;
  function css() { if (document.getElementById('apCss')) return; const s = document.createElement('style'); s.id = 'apCss'; s.textContent = CSS; document.head.appendChild(s); }

  let bg = null, retour = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; document.removeEventListener('keydown', clavier); try { retour && retour.focus(); } catch (_) {} }
  function clavier(e) { if (e.key === 'Escape') fermer(); }
  function boite() {
    css();
    if (!bg) {
      retour = document.activeElement;
      bg = document.createElement('div'); bg.className = 'ap-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Approvisionnement professionnel');
      bg.innerHTML = '<div class="ap"></div>'; document.body.appendChild(bg);
      bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-apx]')) fermer(); });
      document.addEventListener('keydown', clavier);
    }
    return bg.querySelector('.ap');
  }
  const tete = (t, em, retourVue) => `<div class="ap-h">${retourVue ? `<button class="ap-x" data-retour="${retourVue}" aria-label="Retour" style="margin:-8px 0 0 -8px">‹</button>` : ''}<h2 tabindex="-1">${esc(t)}${em ? ' <em>' + esc(em) + '</em>' : ''}</h2><button class="ap-x" data-apx aria-label="Fermer">×</button></div>`;
  const focusTitre = box => { const h = box.querySelector('h2'); if (h) h.focus(); box.scrollTop = 0; };
  const connecte = () => { if (!N() || !N().session()) { if (N()) N().open(); return false; } return true; };
  const attente = (box, t) => { box.innerHTML = tete(t) + (window.MDGSac ? MDGSac.charge('Un instant…') : ''); };
  function lierRetour(box) { box.querySelectorAll('[data-retour]').forEach(b => b.onclick = () => ouvrir(b.dataset.retour)); }
  const periode = x => (x.frequence ? FREQ[x.frequence] + ' · ' : '') + (x.fin ? 'du ' + jour(x.debut) + ' au ' + jour(x.fin) : 'à partir du ' + jour(x.debut));

  // ——— Accueil : mes besoins (acheteur) · besoins des pros (vendeur) ———
  let vue = 'miens';
  async function ouvrir(v) {
    if (!connecte()) return;
    vue = v || vue; const box = boite(); attente(box, 'Approvisionnement');
    let L = [];
    try { L = (await N().rpc('besoins_liste', { p_vue: vue, p_region: null })) || []; }
    catch (e) { if (!bg) return; box.innerHTML = tete('Approvisionnement', 'pro') + `<p class="ap-err" role="alert">${esc(errTxt(e))}</p><button class="ap-b s" data-re>Réessayer</button>`; box.querySelector('[data-re]').onclick = () => ouvrir(vue); return; }
    if (!bg) return;
    box.innerHTML = tete('Approvisionnement', 'pro') +
      `<p class="ap-lead">Restaurants, hôtels, cantines, revendeurs : publiez vos besoins réguliers, recevez des propositions, comparez, choisissez.</p>
      <div class="ap-seg" role="group" aria-label="Afficher"><button data-v="miens" aria-pressed="${vue === 'miens'}">Mes besoins</button><button data-v="ouverts" aria-pressed="${vue === 'ouverts'}">Besoins des pros</button></div>` +
      (L.length ? L.map(x => `<button class="ap-c" data-b="${x.id}"><b>${esc(x.titre)}</b><small>${esc(TYPES[x.type] || '')} · ${esc(regNom(x.region))}${x.ville ? ', ' + esc(x.ville) : ''}</small>
          <small>${esc(x.produits || '')}</small>
          <span class="ap-t">${esc(periode(x))}</span>${vue === 'miens' ? `<span class="ap-t ${x.propositions ? 'v' : 'g'}">${x.propositions} proposition${x.propositions > 1 ? 's' : ''}</span><span class="ap-t ${x.statut === 'ouvert' ? 'j' : 'g'}">${x.statut === 'ouvert' ? 'Ouvert' : x.statut === 'pourvu' ? 'Pourvu' : 'Clos'}</span>` : x.verifie ? '<span class="ap-t v">Acheteur vérifié</span>' : ''}</button>`).join('')
        : `<div class="ap-vide">${window.MDGSac ? MDGSac.svg('vide') : ''}<b>${vue === 'miens' ? 'Aucun besoin publié' : 'Aucun besoin ouvert pour l’instant'}</b>${vue === 'miens' ? 'Décrivez ce qu’il vous faut : les vendeurs concernés vous répondent.' : 'Les besoins des restaurants, hôtels et cantines apparaîtront ici.'}</div>`) +
      (vue === 'miens' ? '<div class="ap-pied"><button class="ap-b" data-nouveau>Publier un besoin</button></div>' : '');
    box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => ouvrir(b.dataset.v));
    box.querySelectorAll('[data-b]').forEach(b => b.onclick = () => besoin(b.dataset.b));
    const nv = box.querySelector('[data-nouveau]'); if (nv) nv.onclick = () => formulaire();
    focusTitre(box);
  }

  // ——— Publier un besoin ———
  function formulaire() {
    const box = boite(), auj = new Date(), dans = n => iso(new Date(auj.getTime() + n * 864e5));
    let lignes = [{ produit: '', quantite: '', unite: 'kg', prix: '' }], freq = 'hebdomadaire';
    const etat = {};
    const sauver = () => { box.querySelectorAll('[data-k]').forEach(i => { etat[i.dataset.k] = i.value; });
      lignes = lignes.map((l, i) => ({ produit: (box.querySelector(`[data-lp="${i}"]`) || {}).value ?? l.produit, quantite: (box.querySelector(`[data-lq="${i}"]`) || {}).value ?? l.quantite,
        unite: (box.querySelector(`[data-lu="${i}"]`) || {}).value ?? l.unite, prix: (box.querySelector(`[data-lx="${i}"]`) || {}).value ?? l.prix })); };
    const v = (k, d) => esc(etat[k] != null ? etat[k] : d);
    const peindre = () => {
      box.innerHTML = tete('Publier un', 'besoin', 'miens') +
        `<p class="ap-lead">Un besoin n’engage à rien : vous recevez des propositions et vous choisissez. Chaque produit compte comme une annonce (3 gratuites, puis identité vérifiée).</p>
        <datalist id="apProds">${prods().map(p => `<option value="${esc(p.name)}"></option>`).join('')}</datalist>
        <form class="ap-f" novalidate>
          <label>Votre établissement<input data-k="titre" maxlength="80" required placeholder="ex. Restaurant Chez Ama" value="${v('titre', '')}"></label>
          <label>Type<select data-k="type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${v('type', 'restaurant') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <div><span style="font-size:13px;color:#5E5546">Fréquence</span><div class="ap-seg" role="group" aria-label="Fréquence">${Object.entries(FREQ).map(([k, l]) => `<button type="button" data-fq="${k}" aria-pressed="${freq === k}">${l}</button>`).join('')}</div></div>
          <div class="ap-2"><label>Livraison à partir du<input type="date" data-k="debut" min="${dans(0)}" value="${v('debut', dans(2))}"></label>
            <label>Jusqu’au (facultatif)<input type="date" data-k="fin" min="${dans(0)}" value="${v('fin', freq === 'ponctuelle' ? '' : dans(30))}"></label></div>
          <div class="ap-2"><label>Zone de livraison<select data-k="region">${regs().map(r => `<option value="${esc(r.slug)}" ${v('region', 'abidjan') === r.slug ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
            <label>Commune ou quartier<input data-k="ville" maxlength="80" placeholder="ex. Cocody" value="${v('ville', '')}"></label></div>
          <h3 class="ap-sec">Produits (10 au plus)</h3>
          ${lignes.map((l, i) => `<div class="ap-l"><div class="t"><b>Produit ${i + 1}</b>${lignes.length > 1 ? `<button type="button" data-rm="${i}" aria-label="Retirer le produit ${i + 1}">Retirer</button>` : ''}</div>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546">Produit<input list="apProds" data-lp="${i}" value="${esc(l.produit)}" placeholder="ex. Tomate" autocomplete="off"></label>
            <div class="ap-2"><label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546">Quantité<input type="number" inputmode="decimal" min="0" step="any" data-lq="${i}" value="${esc(l.quantite)}"></label>
              <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546">Unité<select data-lu="${i}">${UNITES.map(u => `<option ${l.unite === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546">Prix cible par unité (facultatif)<input type="number" inputmode="numeric" min="0" step="1" data-lx="${i}" value="${esc(l.prix)}" placeholder="F CFA"></label></div>`).join('')}
          ${lignes.length < 10 ? '<button type="button" class="ap-b s" data-plus>+ Ajouter un produit</button>' : ''}
          <label>Exigences (facultatif)<textarea data-k="exigences" maxlength="400" placeholder="Qualité, calibre, conditionnement, horaires de livraison…">${v('exigences', '')}</textarea></label>
          <p class="ap-err" data-err role="alert"></p>
          <div class="ap-pied"><button class="ap-b" type="submit">Publier le besoin</button></div></form>`;
      box.querySelectorAll('[data-fq]').forEach(b => b.onclick = () => { sauver(); freq = b.dataset.fq; if (freq === 'ponctuelle') etat.fin = ''; peindre(); });
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { sauver(); lignes.splice(+b.dataset.rm, 1); peindre(); });
      const pl = box.querySelector('[data-plus]'); if (pl) pl.onclick = () => { sauver(); lignes.push({ produit: '', quantite: '', unite: 'kg', prix: '' }); peindre(); const k = box.querySelector(`[data-lp="${lignes.length - 1}"]`); if (k) k.focus(); };
      lierRetour(box);
      box.querySelector('form').onsubmit = async e => {
        e.preventDefault(); sauver(); const er0 = box.querySelector('[data-err]'); er0.textContent = '';
        const er = { set textContent(t) { er0.textContent = t; if (t) er0.scrollIntoView({ block: 'center' }); } };
        const P = prods(), L = [];
        for (const [i, l] of lignes.entries()) {
          const nom = String(l.produit || '').trim(); if (!nom) { er.textContent = 'Choisissez le produit ' + (i + 1) + ' dans la liste.'; return; }
          const p = P.find(x => x.name.toLowerCase() === nom.toLowerCase()) || P.find(x => (x.aliases || []).some(a => a.toLowerCase() === nom.toLowerCase()));
          if (!p) { er.textContent = '« ' + nom + ' » n’est pas dans la liste des produits. Choisissez une proposition de la liste.'; return; }
          if (!(+l.quantite > 0)) { er.textContent = 'Indiquez la quantité de ' + p.name + '.'; return; }
          L.push({ slug: p.slug, label: p.name, quantite: +l.quantite, unite: l.unite, prix_cible: +l.prix > 0 ? +l.prix : null });
        }
        if (!String(etat.titre || '').trim() || String(etat.titre).trim().length < 3) { er.textContent = 'Indiquez le nom de votre établissement.'; return; }
        const rf = N().texteRefus ? N().texteRefus([etat.titre, etat.ville, etat.exigences].join(' · ')) : ''; if (rf) { er.textContent = rf; return; }
        const bt = box.querySelector('[type=submit]'); bt.disabled = true;
        try {
          const id = await N().rpc('besoin_creer', { p_titre: etat.titre, p_type: etat.type, p_frequence: freq, p_debut: etat.debut, p_fin: etat.fin || null,
            p_region: etat.region, p_ville: etat.ville || null, p_exigences: etat.exigences || null, p_lignes: L });
          toast('Besoin publié', { type: 'ok', sous: 'Les vendeurs concernés peuvent vous répondre.' }); try { N().refresh && N().refresh(); } catch (_) {}
          besoin(id);
        } catch (x) { bt.disabled = false; er.textContent = errTxt(x); }
      };
      focusTitre(box);
    };
    peindre();
  }

  // ——— Un besoin : comparaison (acheteur) ou réponse (vendeur) ———
  async function besoin(id) {
    if (!connecte()) return;
    const box = boite(); attente(box, 'Besoin');
    let b, cmp = null;
    try { b = await N().rpc('besoin_public', { p_id: id }); if (b && b.moi) cmp = await N().rpc('besoin_comparer', { p_besoin: id }); }
    catch (e) { if (!bg) return; box.innerHTML = tete('Besoin') + `<p class="ap-err" role="alert">${esc(errTxt(e))}</p><button class="ap-b s" data-re>Réessayer</button>`; box.querySelector('[data-re]').onclick = () => besoin(id); return; }
    if (!bg) return;
    if (!b) { box.innerHTML = tete('Besoin', '', 'ouverts') + '<div class="ap-vide"><b>Besoin introuvable</b>Il a peut-être été retiré.</div>'; lierRetour(box); return; }
    const info = `<div class="ap-info"><b>${esc(TYPES[b.type] || '')}</b> · ${esc(b.acheteur)}${b.verifie ? ' · identité vérifiée' : ''}<br>${esc(periode(b))}<br>Livraison : ${esc(regNom(b.region))}${b.ville ? ', ' + esc(b.ville) : ''}${b.exigences ? '<br>Exigences : ' + esc(b.exigences) : ''}</div>`;
    if (b.moi) return comparer(box, b, cmp || [], info);
    repondre(box, b, info);
  }

  function comparer(box, b, cmp, info) {
    const total = cmp.reduce((s, l) => s + l.propositions.length, 0);
    box.innerHTML = tete(b.titre, '', 'miens') + info +
      `<p class="ap-lead">${total ? 'Comparez les propositions, puis ouvrez celle qui vous convient pour l’accepter ou négocier. Rien n’est conclu tant que vous n’avez pas accepté.' : 'Pas encore de proposition. Les vendeurs qui suivent ces produits ont été prévenus.'}</p>` +
      cmp.map(l => { const P = l.propositions, prixMin = Math.min(...P.filter(p => p.prix != null).map(p => p.prix)), delaiMin = Math.min(...P.filter(p => p.delai_jours != null).map(p => p.delai_jours));
        return `<section class="ap-ln"><h3>${esc(l.produit)}</h3><small>${nf(l.quantite)} ${esc(l.unite)}${l.prix_cible ? ' · prix cible ' + F(l.prix_cible) : ''}${l.statut !== 'active' ? ' · retiré' : ''}</small>` +
          (P.length ? P.map(p => { const r = p.reputation || {};
            return `<div class="ap-p"><div class="h"><b>${esc(p.vendeur)}</b><strong>${p.prix != null ? F(p.prix) : '—'}</strong></div>
              <div>${p.prix === prixMin && P.length > 1 ? '<span class="ap-t v">Le moins cher</span>' : ''}${p.delai_jours === delaiMin && P.length > 1 && isFinite(delaiMin) ? '<span class="ap-t j">Le plus rapide</span>' : ''}${p.verifie ? '<span class="ap-t">Identité vérifiée</span>' : ''}${r.fiable ? '<span class="ap-t v">Vendeur fiable</span>' : ''}${p.statut === 'conclue' ? '<span class="ap-t v">Accord conclu</span>' : ''}</div>
              <ul><li>${nf(p.quantite)} ${esc(l.unite)} proposés</li>${p.stock != null ? `<li>Stock : ${nf(p.stock)}</li>` : ''}${p.delai_jours != null ? `<li>Délai : ${p.delai_jours ? p.delai_jours + ' j' : 'le jour même'}</li>` : ''}
                ${p.prix != null && l.prix_cible ? `<li>${p.prix <= l.prix_cible ? 'Dans votre prix cible' : '+' + F(p.prix - l.prix_cible) + ' / ' + esc(l.unite) + ' au-dessus de la cible'}</li>` : ''}
                <li>${r.avis ? '★ ' + String(r.note).replace('.', ',') + ' (' + r.avis + ' avis)' : 'Pas encore noté'} · ${r.terminees || 0} commande${r.terminees > 1 ? 's' : ''} honorée${r.terminees > 1 ? 's' : ''}</li>
                ${p.prix != null ? `<li>Total : <b>${F(p.prix * p.quantite)}</b></li>` : ''}</ul>
              <button class="ap-b sm" data-nego="${p.nego_id}">${p.statut === 'conclue' ? 'Voir l’accord' : p.dernier_par_moi ? 'Voir la négociation' : 'Choisir et répondre'}</button></div>`; }).join('')
            : '<p class="ap-note">Aucune proposition pour ce produit.</p>') + '</section>'; }).join('') +
      (b.statut === 'ouvert' ? `<div class="ap-duo"><button class="ap-b s" data-st="pourvu">Marquer pourvu</button><button class="ap-b s" data-st="clos">Clore</button></div><p class="ap-note">Pourvu ou clos : les produits encore en ligne sont retirés.</p>`
        : `<p class="ap-note">Ce besoin est ${b.statut === 'pourvu' ? 'pourvu' : 'clos'}.</p><button class="ap-b s" data-st="ouvert">Rouvrir</button>`) + '<p class="ap-err" data-err role="alert"></p>';
    lierRetour(box);
    box.querySelectorAll('[data-nego]').forEach(x => x.onclick = () => { if (window.MDGNegoce && MDGNegoce.thread) { fermer(); MDGNegoce.thread(x.dataset.nego); } });
    box.querySelectorAll('[data-st]').forEach(x => x.onclick = async () => {
      if (x.dataset.st !== 'ouvert' && !confirm(x.dataset.st === 'pourvu' ? 'Marquer ce besoin comme pourvu ? Les produits encore en ligne seront retirés.' : 'Clore ce besoin ? Les produits encore en ligne seront retirés.')) return;
      x.disabled = true; try { await N().rpc('besoin_statut', { p_id: b.id, p_statut: x.dataset.st }); toast(x.dataset.st === 'ouvert' ? 'Besoin rouvert' : 'Besoin mis à jour'); besoin(b.id); }
      catch (e) { x.disabled = false; box.querySelector('[data-err]').textContent = errTxt(e); } });
    focusTitre(box);
  }

  function repondre(box, b, info) {
    const ouvert = b.statut === 'ouvert';
    box.innerHTML = tete(b.titre, '', 'ouverts') + info +
      `<p class="ap-lead">${ouvert ? 'Répondez produit par produit : votre prix, la quantité, votre stock et votre délai. L’acheteur compare puis choisit.' : 'Ce besoin n’accepte plus de propositions.'}</p>` +
      b.lignes.map((l, i) => `<section class="ap-ln"><h3>${esc(l.produit)}</h3><small>${nf(l.quantite)} ${esc(l.unite)}${l.prix_cible ? ' · prix cible ' + F(l.prix_cible) : ''} · ${l.propositions} proposition${l.propositions > 1 ? 's' : ''}</small>
        ${l.ma_nego ? `<p class="ap-note">Vous avez déjà répondu.</p><button class="ap-b sm s" data-nego="${l.ma_nego}">Voir ma proposition</button>`
          : ouvert && l.statut === 'active' ? `<form class="ap-f" data-rep="${i}" style="margin-top:10px" novalidate><div class="ap-2"><label>Votre prix / ${esc(l.unite)}<input type="number" inputmode="numeric" min="1" step="1" name="prix" required></label>
            <label>Quantité<input type="number" inputmode="decimal" min="0" step="any" name="quantite" value="${esc(l.quantite)}"></label></div>
            <div class="ap-2"><label>Stock disponible<input type="number" inputmode="decimal" min="0" step="any" name="stock"></label><label>Délai (jours)<input type="number" inputmode="numeric" min="0" max="90" step="1" name="delai" value="1"></label></div>
            <label>Un mot (facultatif)<input name="note" maxlength="200" placeholder="Qualité, conditionnement…"></label>
            <p class="ap-err" data-err role="alert"></p><button class="ap-b" type="submit">Envoyer ma proposition</button></form>` : '<p class="ap-note">Produit retiré.</p>'}</section>`).join('');
    lierRetour(box);
    box.querySelectorAll('[data-nego]').forEach(x => x.onclick = () => { if (window.MDGNegoce && MDGNegoce.thread) { fermer(); MDGNegoce.thread(x.dataset.nego); } });
    box.querySelectorAll('[data-rep]').forEach(f => f.onsubmit = async e => {
      e.preventDefault(); const l = b.lignes[+f.dataset.rep], er = f.querySelector('[data-err]'), g = n => f.elements[n].value.trim();
      if (!(+g('prix') > 0)) { er.textContent = 'Indiquez votre prix.'; return; } if (!(+g('quantite') > 0)) { er.textContent = 'Indiquez la quantité.'; return; }
      if (g('stock') !== '' && +g('stock') < +g('quantite')) { er.textContent = 'Le stock doit couvrir la quantité proposée.'; return; }
      const rf = g('note') && N().texteRefus ? N().texteRefus(g('note')) : ''; if (rf) { er.textContent = rf; return; }
      const bt = f.querySelector('[type=submit]'); bt.disabled = true; er.textContent = '';
      try { await N().rpc('besoin_repondre', { p_demande: l.demande_id, p_prix: +g('prix'), p_quantite: +g('quantite'), p_stock: g('stock') === '' ? null : +g('stock'), p_delai_jours: g('delai') === '' ? null : +g('delai'), p_note: g('note') || null });
        toast('Proposition envoyée', { type: 'ok', sous: 'L’acheteur la verra dans sa comparaison.' }); besoin(b.id); }
      catch (x) { bt.disabled = false; er.textContent = errTxt(x); }
    });
    focusTitre(box);
  }

  // lien : #/?besoin=<id>
  function depuisAdresse(h) {
    const m = String(h || location.hash).match(/[?&]besoin=([0-9a-f-]{36})/); if (!m) return;
    try { if (!h) history.replaceState(history.state, '', location.hash.replace(/[?&]besoin=[0-9a-f-]{36}/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = k => { if (N() && N().session()) besoin(m[1]); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-lien') depuisAdresse(e.data.url); });
  depuisAdresse();

  window.MDGAppro = { ouvrir, besoin };
})();
