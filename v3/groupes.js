/* ═════════ Marché de Gros CI — Achats groupés (schéma 35) ═════════
   Plusieurs acheteurs se regroupent sur une offre (un produit, un vendeur, une zone de livraison).
   Le vendeur fixe le prix et les paliers selon le volume ; chacun s'inscrit avec SA quantité ; quand le seuil est atteint,
   le prix final est figé et CHACUN confirme lui-même. Jamais de hausse silencieuse : si le prix monte, on reconfirme.
   Tous confirmés → une commande par participant. Aucun paiement dans l'application.
   API : MDGGroupes.ouvrir(vue?) · MDGGroupes.groupe(id) · MDGGroupes.creer(offre) — offre : { id, productLabel, unit, price, quantity, _uid } */
(function () {
  'use strict';
  if (window.MDGGroupes) return;
  const N = () => window.MDGNuage;
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = v => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(+v || 0).replace(/ /g, ' ');
  const F = v => nf(Math.round(+v || 0)) + ' F';
  const quand = t => t ? new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const reste = t => { const m = (Date.parse(t) - Date.now()) / 6e4; return m <= 0 ? 'terminé' : m < 60 ? Math.round(m) + ' min' : m < 2880 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' jours'; };
  const hors = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network/i.test(String((e && e.message) || e || ''));
  const errTxt = e => hors(e) ? 'Pas de connexion : rien n’a été enregistré. Réessayez quand le réseau revient.' : String((e && e.message) || 'Une erreur est survenue.').replace(/^[A-Z_]+ : /, '');
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : (N() && N().toast && N().toast(t));
  const ST = { propose: ['Proposé au vendeur', 'g'], ouvert: ['Ouvert', 'j'], seuil_atteint: ['Seuil atteint', 'v'], en_attente_confirmation: ['En attente de confirmation', 'j'],
    confirme: ['Confirmé', 'v'], termine: ['Terminé', 'g'], annule: ['Annulé', 'r'], expire: ['Expiré', 'r'] };

  const CSS = `
.gr-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:grIn .2s ease-out}
@keyframes grIn{from{opacity:0}}@keyframes grUp{from{transform:translateY(40px);opacity:.4}}
.gr{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:grUp .28s cubic-bezier(.2,.8,.2,1)}
.gr-h{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px}.gr-h h2{flex:1;margin:0;font:600 23px/1.15 Jost,sans-serif;letter-spacing:-.015em}.gr-h h2:focus{outline:none}
.gr-h h2 em{font-weight:900;font-style:italic;background:linear-gradient(transparent 58%,#F2C230 58%);padding:0 2px}
.gr-x{flex:none;width:44px;height:44px;margin:-8px -6px 0 0;border:0;border-radius:22px;background:transparent;color:#171512;font-size:26px;line-height:1;cursor:pointer}
.gr button:focus-visible,.gr input:focus-visible,.gr select:focus-visible,.gr-x:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.gr-lead{margin:0 0 12px;color:#4A4336;font-size:14px}
.gr-seg{display:flex;gap:6px;margin:6px 0 12px}.gr-seg button{flex:1;min-height:44px;border:1px solid #D9D1BE;border-radius:22px;background:#FFF;color:#171512;font:500 14px Jost,system-ui,sans-serif;cursor:pointer}
.gr-seg button[aria-pressed=true]{background:#10392B;border-color:#10392B;color:#FFFDF8}
.gr-c{display:block;width:100%;text-align:left;background:#FFFDF8;border:0;border-radius:20px;padding:14px 16px;margin:0 0 10px;box-shadow:0 1px 0 rgba(16,57,43,.08);font:inherit;color:inherit;cursor:pointer}
.gr-c b{display:block;font:600 16px/1.25 Jost,sans-serif}.gr-c small{display:block;color:#5E5546;font-size:13px;margin-top:2px}
.gr-t{display:inline-flex;align-items:center;min-height:22px;margin:6px 6px 0 0;padding:0 9px;border-radius:11px;font-size:12px;font-weight:600;background:#ECE6D6;color:#3E382C}
.gr-t.v{background:#DCEFE3;color:#10392B}.gr-t.j{background:#FFF1C2;color:#5C4500}.gr-t.r{background:#FBE3DE;color:#8E2A1C}.gr-t.g{background:#E9E4D3;color:#5E5546}
.gr-jauge{position:relative;height:12px;border-radius:6px;background:#E3DCCB;margin:10px 0 4px;overflow:hidden}.gr-jauge i{position:absolute;inset:0 auto 0 0;background:#10392B;border-radius:6px}
.gr-jauge b{position:absolute;top:-2px;bottom:-2px;width:2px;background:#F2C230}
.gr-bloc{background:#FFFDF8;border-radius:20px;padding:14px 16px;margin:0 0 10px}
.gr-bloc h3{margin:0 0 6px;font:600 16px/1.2 Jost,sans-serif}
.gr-px{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.gr-px strong{font:800 28px/1 Jost,sans-serif;color:#10392B}.gr-px small{color:#5E5546;font-size:13px}
.gr-pal{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px}.gr-pal li{display:flex;justify-content:space-between;padding:7px 10px;border-radius:10px;background:#F3EFE4;font-size:14px}
.gr-pal li.on{background:#DCEFE3;color:#10392B;font-weight:600}
.gr-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0;font-size:14px}.gr-dl dt{color:#5E5546}.gr-dl dd{margin:0;text-align:right;font-weight:600}
.gr-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:12px 0 0;border:0;border-radius:24px;background:#10392B;color:#FFFDF8;font:600 15px Jost,system-ui,sans-serif;cursor:pointer}
.gr-b.s{background:transparent;color:#10392B;box-shadow:inset 0 0 0 1.5px rgba(16,57,43,.35)}.gr-b.r{background:transparent;color:#8E2A1C;box-shadow:inset 0 0 0 1.5px rgba(142,42,28,.35)}.gr-b:disabled{opacity:.5;cursor:default}
.gr-duo{display:flex;gap:8px}.gr-duo .gr-b{flex:1}
.gr-f{display:grid;gap:10px}.gr-f label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546}
.gr-f input,.gr-f select{min-height:44px;padding:0 12px;border:1px solid #D9D1BE;border-radius:12px;background:#FFF;font:500 15px Jost,system-ui,sans-serif;color:#171512;width:100%;box-sizing:border-box}
.gr-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gr-err{margin:8px 0 0;color:#8E2A1C;font-size:13.5px;font-weight:600}.gr-note{margin:6px 0 0;color:#5E5546;font-size:13px}
.gr-conf{margin:10px 0 0;padding:12px 14px;border-radius:16px;background:#FFF6D6;box-shadow:inset 0 0 0 1.5px #E6C65C;font-size:14px}
.gr-vide{text-align:center;padding:18px 8px;color:#4A4336}.gr-vide b{display:block;font:600 17px/1.25 Jost,sans-serif;color:#171512;margin:6px 0 4px}
@media (max-width:340px){.gr-2{grid-template-columns:1fr}}
.gr form{background:none;box-shadow:none;border:0;padding:0;margin:0;border-radius:0}
@media (prefers-reduced-motion:reduce){.gr-bg,.gr{animation:none!important}}`;
  function css() { if (document.getElementById('grpCss')) return; const s = document.createElement('style'); s.id = 'grpCss'; s.textContent = CSS; document.head.appendChild(s); }

  let bg = null, retour = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; document.removeEventListener('keydown', clavier); try { retour && retour.focus(); } catch (_) {} }
  function clavier(e) { if (e.key === 'Escape') fermer(); }
  function boite() {
    css();
    if (!bg) {
      retour = document.activeElement;
      bg = document.createElement('div'); bg.className = 'gr-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Achats groupés');
      bg.innerHTML = '<div class="gr"></div>'; document.body.appendChild(bg);
      bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-grx]')) fermer(); });
      document.addEventListener('keydown', clavier);
    }
    return bg.querySelector('.gr');
  }
  const tete = (t, em, ret) => `<div class="gr-h">${ret ? `<button class="gr-x" data-retour="${ret}" aria-label="Retour" style="margin:-8px 0 0 -8px">${window.MDGIco ? MDGIco.svg('retour', 22, 2) : '‹'}</button>` : ''}<h2 tabindex="-1">${esc(t)}${em ? ' <em>' + esc(em) + '</em>' : ''}</h2><button class="gr-x" data-grx aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`;
  const focusTitre = box => { const h = box.querySelector('h2'); if (h) h.focus(); box.scrollTop = 0; };
  const connecte = () => { if (!N() || !N().session()) { if (N()) N().open(); return false; } return true; };
  const lierRetour = box => box.querySelectorAll('[data-retour]').forEach(b => b.onclick = () => ouvrir(b.dataset.retour));
  const jauge = (total, objectif) => { const max = Math.max(objectif * 1.25, total), w = Math.min(100, total / max * 100), o = objectif / max * 100;
    return `<div class="gr-jauge" role="img" aria-label="${nf(total)} sur ${nf(objectif)} visés"><i style="width:${w.toFixed(1)}%"></i><b style="left:${o.toFixed(1)}%"></b></div>`; };

  // Liste
  let vue = 'ouverts';
  async function ouvrir(v) {
    vue = v || vue; const box = boite();
    box.innerHTML = tete('Achats', 'groupés') + (window.MDGSac ? MDGSac.charge('Un instant…') : '');
    let L = [];
    try { L = (await N().rpc('groupes_liste', { p_vue: vue === 'miens' && me() ? 'miens' : 'ouverts', p_produit: null }, !!me())) || []; }
    catch (e) { if (!bg) return; box.innerHTML = tete('Achats', 'groupés') + `<p class="gr-err" role="alert">${esc(errTxt(e))}</p><button class="gr-b s" data-re>Réessayer</button>`; box.querySelector('[data-re]').onclick = () => ouvrir(vue); return; }
    if (!bg) return;
    box.innerHTML = tete('Achats', 'groupés') +
      `<p class="gr-lead">Chacun confirme sa part : rien n’est commandé sans vous.</p>
      <div class="gr-seg" role="group" aria-label="Afficher"><button data-v="ouverts" aria-pressed="${vue === 'ouverts'}">Groupes ouverts</button><button data-v="miens" aria-pressed="${vue === 'miens'}">Mes groupes</button></div>` +
      (L.length ? L.map(g => `<button class="gr-c" data-g="${g.id}"><b>${esc(g.produit)} · ${esc(g.zone)}</b>
          <small>${esc(g.vendeur)} · ${g.participants} participant${g.participants > 1 ? 's' : ''} · ${nf(g.total)} / ${nf(g.objectif)} ${esc(g.unite)}</small>
          ${jauge(+g.total, +g.objectif)}
          <span class="gr-t ${ST[g.statut][1]}">${ST[g.statut][0]}</span><span class="gr-t">${F(g.prix_courant)} / ${esc(g.unite)}${g.meilleur_prix && +g.meilleur_prix < +g.prix_courant ? ' · jusqu’à ' + F(g.meilleur_prix) : ''}</span>
          ${['ouvert', 'seuil_atteint'].includes(g.statut) ? `<span class="gr-t">reste ${reste(g.date_limite)}</span>` : ''}${g.mon_statut && g.mon_statut !== 'retire' ? '<span class="gr-t v">J’y participe</span>' : ''}${g.je_suis_vendeur ? '<span class="gr-t">Votre offre</span>' : ''}</button>`).join('')
        : `<div class="gr-vide">${window.MDGSac ? MDGSac.svg('vide') : ''}<b>${vue === 'miens' ? 'Aucun groupe pour l’instant' : 'Aucun achat groupé ouvert'}</b>Ouvrez une offre avec un prix et touchez « Achat groupé » pour lancer le premier.</div>`);
    box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { if (b.dataset.v === 'miens' && !connecte()) return; ouvrir(b.dataset.v); });
    box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => groupe(b.dataset.g));
    focusTitre(box);
  }

  // Un groupe
  async function groupe(id, focusSel) {
    const box = boite();
    box.innerHTML = tete('Achat groupé') + (window.MDGSac ? MDGSac.charge('Un instant…') : '');
    let g;
    try { g = await N().rpc('groupe_detail', { p_id: id }, !!me()); }
    catch (e) { if (!bg) return; box.innerHTML = tete('Achat groupé', '', 'ouverts') + `<p class="gr-err" role="alert">${esc(errTxt(e))}</p><button class="gr-b s" data-re>Réessayer</button>`; box.querySelector('[data-re]').onclick = () => groupe(id); lierRetour(box); return; }
    if (!bg) return;
    if (!g) { box.innerHTML = tete('Achat groupé', '', 'ouverts') + '<div class="gr-vide"><b>Groupe introuvable</b></div>'; lierRetour(box); return; }
    const m = g.moi && g.moi.statut !== 'retire' ? g.moi : null, ouvert = ['ouvert', 'seuil_atteint'].includes(g.statut), att = g.statut === 'en_attente_confirmation';
    const prixAff = att || g.statut === 'confirme' || g.statut === 'termine' ? g.prix_final : g.prix_courant;
    const P = (g.paliers || []).slice().sort((a, b) => a.quantite - b.quantite);
    const partFrais = q => g.frais_transport && +g.total > 0 ? g.frais_transport * q / +g.total : null;
    let html = tete(g.produit, g.zone, 'ouverts') +
      `<p class="gr-lead">${esc(g.vendeur)}${g.vendeur_verifie ? ' · identité vérifiée' : ''} · <span class="gr-t ${ST[g.statut][1]}" style="margin:0">${ST[g.statut][0]}</span></p>
      <section class="gr-bloc"><div class="gr-px"><strong>${F(prixAff)}</strong><small>/ ${esc(g.unite)} ${att ? '· prix final figé' : ouvert ? '· prix actuel du groupe' : ''}</small></div>
        ${jauge(+g.total, +g.objectif)}<p class="gr-note" style="margin:0">${nf(g.total)} ${esc(g.unite)} sur ${nf(g.objectif)} visés · ${g.participants} participant${g.participants > 1 ? 's' : ''} sur ${g.min_participants} minimum</p>
        ${P.length ? `<ul class="gr-pal" aria-label="Prix selon le volume"><li class="${+g.total < P[0].quantite ? 'on' : ''}"><span>Moins de ${nf(P[0].quantite)} ${esc(g.unite)}</span><span>${F(g.prix_base)}</span></li>${P.map((p, i) => `<li class="${+g.total >= p.quantite && (!P[i + 1] || +g.total < P[i + 1].quantite) ? 'on' : ''}"><span>Dès ${nf(p.quantite)} ${esc(g.unite)}</span><span>${F(p.prix)}</span></li>`).join('')}</ul>` : '<p class="gr-note">Pas de réduction selon le volume : prix de l’offre.</p>'}</section>
      <section class="gr-bloc"><dl class="gr-dl">
        <dt>Date limite</dt><dd>${quand(g.date_limite)}</dd>${att ? `<dt>Confirmer avant</dt><dd>${quand(g.confirmer_avant)}</dd>` : ''}
        <dt>Livraison</dt><dd>${esc(g.zone)}</dd>
        <dt>Transport partagé</dt><dd>${g.frais_transport ? 'environ ' + F(g.frais_transport) + ' au total' : 'non précisé'}</dd>
        ${g.note ? `<dt>Note</dt><dd>${esc(g.note)}</dd>` : ''}</dl>
        ${g.frais_transport ? '<p class="gr-note">Les frais de transport sont partagés au prorata des quantités. C’est une estimation du vendeur, réglée hors application.</p>' : ''}</section>`;
    // parts (sans noms)
    if ((g.parts || []).length) html += `<section class="gr-bloc"><h3>Les parts</h3><dl class="gr-dl">${g.parts.map((p, i) => `<dt>${p.moi ? '<b>Vous</b>' : 'Participant ' + (i + 1)}</dt><dd>${nf(p.quantite)} ${esc(g.unite)}${att ? ' · ' + (p.statut === 'confirme' ? 'a confirmé' : 'à confirmer') : ''}</dd>`).join('')}</dl></section>`;
    // actions
    let act = '';
    if (g.je_suis_vendeur) {
      if (g.statut === 'propose') act = `<section class="gr-bloc"><h3>Un acheteur propose ce groupe</h3><p class="gr-note">Fixez vos réductions selon le volume (facultatif) et une estimation du transport, ou refusez.</p>${formPaliers(g)}<div class="gr-duo"><button class="gr-b r" data-val="non">Refuser</button><button class="gr-b" data-val="oui">Ouvrir le groupe</button></div></section>`;
      else if (g.statut === 'seuil_atteint') act = `<button class="gr-b" data-lancer>Lancer la confirmation</button><p class="gr-note">Le prix final sera figé à ${F(g.prix_courant)} / ${esc(g.unite)}. Chaque participant aura 48 h pour confirmer.</p>`;
      else if (g.statut === 'ouvert') act = '<p class="gr-note">Quand le seuil sera atteint, vous lancerez la confirmation. À la date limite, elle se lance seule si le seuil est atteint.</p>';
      if (['propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation'].includes(g.statut) && g.statut !== 'propose') act += '<button class="gr-b r" data-annuler>Annuler le groupe</button>';
    } else if (!me()) act = '<button class="gr-b" data-cnx>Se connecter pour participer</button>';
    else if (ouvert) {
      act = `<section class="gr-bloc"><h3>${m ? 'Ma participation' : 'Participer'}</h3><form class="gr-f" data-join novalidate><label>Ma quantité (${esc(g.unite)})<input type="number" inputmode="decimal" min="0.01" step="any" name="q" value="${m ? esc(m.quantite) : ''}" required></label>
        <p class="gr-note" data-apercu></p><p class="gr-err" data-err role="alert"></p><button class="gr-b" type="submit">${m ? 'Changer ma quantité' : 'M’inscrire'}</button></form>
        ${m ? '<button class="gr-b r" data-quitter>Me retirer</button>' : ''}<p class="gr-note">S’inscrire n’est pas acheter : vous confirmerez au prix final, quand le seuil sera atteint.</p></section>`;
    } else if (att && m) {
      const hausse = m.prix_vu != null && +g.prix_final > +m.prix_vu;
      act = m.statut === 'confirme' ? `<section class="gr-bloc"><h3>Vous avez confirmé</h3><p class="gr-note">${nf(m.quantite)} ${esc(g.unite)} à ${F(g.prix_final)} = <b>${F(m.quantite * g.prix_final)}</b>. On attend les autres participants.</p><button class="gr-b r" data-quitter>Me retirer</button></section>`
        : `<section class="gr-conf" role="group" aria-label="Confirmer ma participation"><b>Confirmez votre participation</b><br>${nf(m.quantite)} ${esc(g.unite)} à ${F(g.prix_final)} = <b>${F(m.quantite * g.prix_final)}</b>${partFrais(m.quantite) ? ' + environ ' + F(partFrais(m.quantite)) + ' de transport partagé' : ''}.
          ${hausse ? `<br><b style="color:#8E2A1C">Attention : le prix est plus haut que celui vu à votre inscription (${F(m.prix_vu)}).</b>` : ''}<br>Rien n’est payé dans l’application.
          <div class="gr-duo"><button class="gr-b r" data-conf="non">Me retirer</button><button class="gr-b" data-conf="oui">Je confirme</button></div><p class="gr-err" data-err role="alert"></p></section>`;
    } else if (g.statut === 'confirme' && m && m.commande_id) act = `<button class="gr-b" data-cmd="${m.commande_id}">Suivre ma commande</button>`;
    else if (g.statut === 'expire' && m && g.offre_active) act = `<section class="gr-bloc"><h3>Le seuil n’a pas été atteint</h3><p class="gr-note">Aucune commande n’a été créée. Si vous le souhaitez, vous pouvez acheter seul : une proposition sera envoyée au vendeur pour ${nf(m.quantite)} ${esc(g.unite)} au prix de l’offre (${F(g.prix_base)}).</p><button class="gr-b s" data-seul>Proposer un achat individuel</button></section>`;
    html += act + '<p class="gr-err" data-gerr role="alert"></p>';
    box.innerHTML = html;
    lierRetour(box);
    const gerr = t => { const e = box.querySelector('[data-gerr]'); if (e) { e.textContent = t; e.scrollIntoView({ block: 'center' }); } };
    const agir = async (b, f, ok) => { b.disabled = true; try { const r = await f(); if (ok) toast(ok(r), { type: 'ok' }); await groupe(id); } catch (e) { b.disabled = false; gerr(errTxt(e)); } };
    const cnx = box.querySelector('[data-cnx]'); if (cnx) cnx.onclick = () => connecte();
    const f = box.querySelector('[data-join]');
    if (f) {
      const ap = f.querySelector('[data-apercu]'), inp = f.elements.q;
      const maj = () => { const q = +inp.value || 0; if (!q) { ap.textContent = ''; return; } const tot = +g.total - (m ? +m.quantite : 0) + q;
        const px = P.filter(p => p.quantite <= tot).reduce((a, p) => Math.min(a, p.prix), +g.prix_base); const fr = g.frais_transport && tot ? g.frais_transport * q / tot : 0;
        ap.textContent = 'Avec vous : ' + nf(tot) + ' ' + g.unite + ' → ' + F(px) + ' / ' + g.unite + ' · votre part ' + F(px * q) + (fr ? ' + environ ' + F(fr) + ' de transport' : '') + '.'; };
      inp.oninput = maj; maj();
      f.onsubmit = e => { e.preventDefault(); const q = +inp.value; if (!(q > 0)) { f.querySelector('[data-err]').textContent = 'Indiquez votre quantité.'; return; }
        agir(f.querySelector('[type=submit]'), () => N().rpc('groupe_rejoindre', { p_id: id, p_quantite: q }), r => m ? 'Quantité changée' : 'Vous êtes inscrit · prix actuel ' + F(r.prix)); };
    }
    const qt = box.querySelector('[data-quitter]'); if (qt) qt.onclick = () => { if (confirm('Vous retirer de cet achat groupé ?')) agir(qt, () => N().rpc('groupe_quitter', { p_id: id }), () => 'Vous êtes retiré'); };
    box.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => agir(b, () => N().rpc('groupe_confirmer', { p_id: id, p_oui: b.dataset.conf === 'oui' }),
      r => b.dataset.conf === 'oui' ? (r === 'confirme' ? 'Achat groupé confirmé : votre commande est créée' : 'Confirmé · on attend les autres') : 'Vous êtes retiré'));
    const la = box.querySelector('[data-lancer]'); if (la) la.onclick = () => agir(la, () => N().rpc('groupe_lancer', { p_id: id }), () => 'Confirmation lancée');
    const an = box.querySelector('[data-annuler]'); if (an) an.onclick = () => { if (confirm('Annuler cet achat groupé ? Aucune commande ne sera créée.')) agir(an, () => N().rpc('groupe_annuler', { p_id: id }), () => 'Groupe annulé'); };
    box.querySelectorAll('[data-val]').forEach(b => b.onclick = () => { const pal = lirePaliers(box); if (pal.err) return gerr(pal.err);
      agir(b, () => N().rpc('groupe_valider', { p_id: id, p_oui: b.dataset.val === 'oui', p_paliers: pal.L, p_frais: pal.frais }), () => b.dataset.val === 'oui' ? 'Groupe ouvert' : 'Groupe refusé'); });
    const cm = box.querySelector('[data-cmd]'); if (cm) cm.onclick = () => { fermer(); window.MDGCommandes && MDGCommandes.ouvrir(cm.dataset.cmd); };
    const se = box.querySelector('[data-seul]'); if (se) se.onclick = () => agir(se, async () => { const n = await N().rpc('nego_ouvrir', { cible: 'offre', cible_id: g.offre_id, prix: g.prix_base, quantite: m.quantite, texte: 'Achat groupé expiré : je propose d’acheter seul.' }); fermer(); window.MDGNegoce && MDGNegoce.thread && MDGNegoce.thread(n); }, () => 'Proposition envoyée au vendeur');
    focusTitre(box);
    if (focusSel) { const x = box.querySelector(focusSel); if (x) x.focus(); }
  }

  // paliers : deux lignes au plus dans l'interface (le serveur en accepte cinq)
  const formPaliers = o => `<div class="gr-f"><div class="gr-2"><label>Dès (quantité)<input type="number" inputmode="decimal" min="0" step="any" data-pq="0"></label><label>Prix / ${esc(o.unite || o.unit || '')}<input type="number" inputmode="numeric" min="0" step="1" data-pp="0"></label></div>
    <div class="gr-2"><label>Dès (quantité)<input type="number" inputmode="decimal" min="0" step="any" data-pq="1"></label><label>Prix / ${esc(o.unite || o.unit || '')}<input type="number" inputmode="numeric" min="0" step="1" data-pp="1"></label></div>
    <label>Transport partagé, estimation totale (facultatif)<input type="number" inputmode="numeric" min="0" step="1" data-frais placeholder="F CFA"></label></div>`;
  function lirePaliers(box) {
    const L = [], base = 0;
    for (const i of [0, 1]) { const q = +(box.querySelector(`[data-pq="${i}"]`) || {}).value || 0, p = +(box.querySelector(`[data-pp="${i}"]`) || {}).value || 0;
      if (q || p) { if (!(q > 0 && p > 0)) return { err: 'Chaque palier demande une quantité et un prix.' }; L.push({ quantite: q, prix: p }); } }
    const fr = (box.querySelector('[data-frais]') || {}).value; return { L, frais: fr ? +fr : null, base };
  }

  // Créer depuis une offre
  function creer(o) {
    if (!connecte() || !o || !o.id) return;
    const box = boite(), vend = o._uid && o._uid === me(), dans = j => { const d = new Date(Date.now() + j * 864e5); d.setMinutes(0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
    box.innerHTML = tete(vend ? 'Ouvrir un achat' : 'Proposer un achat', 'groupé') +
      `<p class="gr-lead">${esc(o.productLabel || o.productName || 'Produit')} · ${F(o.price)} / ${esc(o.unit)} · ${nf(o.quantity)} ${esc(o.unit)} disponibles.
      ${vend ? 'Vous fixez les réductions selon le volume.' : 'Le vendeur devra valider le groupe et fixer ses réductions. Vous vous inscrivez avec votre quantité.'}</p>
      <form class="gr-f" novalidate>
        <label>Zone de livraison<input name="zone" maxlength="120" placeholder="ex. Yopougon, marché Siporex" required></label>
        <div class="gr-2"><label>Objectif (${esc(o.unit)})<input type="number" inputmode="decimal" min="1" max="${esc(o.quantity)}" step="any" name="obj" required></label>
          <label>Participants minimum<input type="number" inputmode="numeric" min="2" max="50" step="1" name="min" value="3"></label></div>
        <label>Date limite d’inscription<input type="datetime-local" name="lim" min="${dans(0.3)}" max="${dans(30)}" value="${dans(5)}"></label>
        ${vend ? '<h3 style="margin:6px 0 0;font:600 15px Jost,sans-serif">Réductions selon le volume (facultatif)</h3>' + formPaliers(o) : `<label>Ma quantité (${esc(o.unit)})<input type="number" inputmode="decimal" min="0.01" step="any" name="mq" required></label>`}
        <p class="gr-err" data-err role="alert"></p><button class="gr-b" type="submit">${vend ? 'Ouvrir le groupe' : 'Proposer au vendeur'}</button></form>`;
    lierRetour(box);
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target, er = f.querySelector('[data-err]'), say = t => { er.textContent = t; er.scrollIntoView({ block: 'center' }); };
      const zone = f.elements.zone.value.trim(), obj = +f.elements.obj.value, min = +f.elements.min.value || 2, lim = f.elements.lim.value;
      if (zone.length < 2) return say('Indiquez la zone de livraison.'); if (!(obj > 0)) return say('Indiquez l’objectif.'); if (obj > +o.quantity) return say('L’objectif dépasse la quantité de l’offre.');
      if (!lim) return say('Choisissez la date limite.');
      const rf = N().texteRefus ? N().texteRefus(zone) : ''; if (rf) return say(rf);
      const pal = vend ? lirePaliers(box) : { L: [], frais: null }; if (pal.err) return say(pal.err);
      const mq = vend ? null : +f.elements.mq.value; if (!vend && !(mq > 0)) return say('Indiquez votre quantité.');
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      try { const id = await N().rpc('groupe_creer', { p_offre: o.id, p_zone: zone, p_objectif: obj, p_min: min, p_date_limite: new Date(lim).toISOString(), p_paliers: pal.L, p_frais: pal.frais, p_ma_quantite: mq, p_note: null });
        toast(vend ? 'Achat groupé ouvert' : 'Proposition envoyée au vendeur', { type: 'ok' }); groupe(id); }
      catch (x) { b.disabled = false; say(errTxt(x)); }
    };
    focusTitre(box);
  }

  // lien : #/?groupe=<id>
  function depuisAdresse(h) {
    const mm = String(h || location.hash).match(/[?&]groupe=([0-9a-f-]{36})/); if (!mm) return;
    try { if (!h) history.replaceState(history.state, '', location.hash.replace(/[?&]groupe=[0-9a-f-]{36}/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = k => { if (N() && N().session()) groupe(mm[1]); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-lien') depuisAdresse(e.data.url); });
  depuisAdresse();

  window.MDGGroupes = { ouvrir, groupe, creer };
})();
